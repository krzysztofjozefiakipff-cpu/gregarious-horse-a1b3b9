const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers});
const monthValid = month => typeof month==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const localDay = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date());
const dayValid = day => typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
const countValid = value => Number.isInteger(value) && value>=0 && value<=1000000;
const textValid = value => typeof value==='string' && value.trim().length>0 && value.length<=120;
async function list(db,sql,...params) { return (await db.prepare(sql).bind(...params).all()).results; }

const sourceCount = 12;
const dailyRowLengths = [9,10,11];
const workday = day => ![0,6].includes(new Date(day+'T00:00:00Z').getUTCDay());
function daysBetween(start,end) {
  const days=[];
  for (let at=Date.parse(start);at<=Date.parse(end);at+=86400000) {
    days.push(new Date(at).toISOString().slice(0,10));
  }
  return days;
}
async function tracking(db,person) {
  await db.prepare('INSERT INTO daily_tracking VALUES (?,?) ON CONFLICT DO NOTHING').bind(person,localDay()).run();
  const {start_day}=await db.prepare('SELECT start_day FROM daily_tracking WHERE person=?').bind(person).first();
  const saved=new Set((await list(db,'SELECT day FROM daily_results WHERE person=? AND day>=?',person,start_day)).map(row=>row.day));
  const exceptions=Object.fromEntries((await list(db,'SELECT day,kind FROM daily_exceptions WHERE person=? AND day>=?',person,start_day)).map(row=>[row.day,row.kind]));
  const days=daysBetween(start_day,localDay()).filter(workday);
  const closed=day=>saved.has(day)||['leave','training','zero'].includes(exceptions[day]);
  const missing=days.filter(day=>day<localDay()&&!closed(day));
  const month=days.filter(day=>day.startsWith(localDay().slice(0,7))&&!['leave','training'].includes(exceptions[day]));
  return {missing,exceptions,progress:[month.filter(closed).length,month.length]};
}

const memeKey=([title,,,key])=>key??title;
async function memeFor(db,user,day) {
  const published=await list(db,"SELECT id,title,caption FROM meme_stories WHERE status='approved'");
  const pool=memes.concat(published.map(({id,title,caption})=>[title,'💬',caption,'story:'+id]));
  if (user.role!=='seller') return pool[Math.floor(Math.random()*pool.length)].slice(0,3);
  const memeTitles=JSON.stringify(pool.map(memeKey));
  await db.prepare(`
    INSERT INTO meme_assignments(person,salon,day,title)
    SELECT ?,?,?,candidate.value
    FROM json_each(?) AS candidate
    LEFT JOIN meme_assignments AS history ON history.salon=? AND history.title=candidate.value
    WHERE NOT EXISTS (SELECT 1 FROM meme_assignments WHERE person=? AND day=?)
    GROUP BY candidate.value
    HAVING MAX(history.day) IS NULL OR MAX(history.day) < ?
    ORDER BY MAX(history.day) ASC, random()
    LIMIT 1
    ON CONFLICT(person,day) DO NOTHING
  `).bind(user.id,user.salon,day,memeTitles,user.salon,user.id,day,day).run();
  const assigned=await db.prepare('SELECT title FROM meme_assignments WHERE person=? AND day=?').bind(user.id,day).first();
  return pool.find(meme=>memeKey(meme)===assigned?.title)?.slice(0,3)??null;
}

function lessonDrafts(text) {
  const sentences=paragraph=>Array.from(new Intl.Segmenter('pl',{granularity:'sentence'}).segment(paragraph),item=>item.segment.trim());
  return text.replaceAll('\r','').split(/\n[ \t]*\n|\f+/)
    .flatMap(block=>{
      const lines=block.split('\n').map(line=>line.trim()).filter(Boolean);
      if (!lines.length) return [];
      const heading=lines.length>1&&lines[0].length<=100?lines.shift().replace(/[:;]$/,''):'';
      const parts=sentences(lines.join(' ')).filter(part=>part.length>=20);
      return parts.map((part,index)=>({
        title:(heading?heading+(index?' · '+(index+1):''):part.split(/\s+/).slice(0,7).join(' ')).slice(0,120),
        topic:part.slice(0,650),
        remember:part.length<=220?part:part.slice(0,217).replace(/\s+\S*$/,'')+'…'
      }));
    }).slice(0,40);
}
const lessonDay=value=>Date.parse(value+'T00:00:00Z')/86400000;

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/')) {
    const asset = path==='/'?'/daily.html':path;
    if (request.method!=='GET' || !Object.hasOwn(assets,asset)) return new Response('Nie znaleziono',{status:404});
    return new Response(assets[asset],{headers:{...headers,'Content-Type':asset.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.giphy.com https://giphy.com; connect-src 'self' https://api.giphy.com; object-src 'none'; base-uri 'none'; form-action 'self'"}});
  }
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!email || !request.headers.get('oai-authenticated-user-id')) return json({error:'Zaloguj się do konta CARVAMO.'},401);
  const owner = request.headers.get('x-lejek-verified-admin')==='1';
  const db = env.DB;
  const assigned = await db.prepare('SELECT id, name, salon, role FROM accounts WHERE email=?').bind(email).first();
  const head=await db.prepare('SELECT group_name FROM dealer_group_heads WHERE email=?').bind(email).first();
  const user = owner ? {id:assigned?.id,role:'admin'} : head ? {role:'group',group:head.group_name} : assigned?.role==='admin' ? null : assigned;
  if (!user) return json({error:'Administrator musi przypisać Ci rolę w lejku.'},403);

  const members="role='seller' AND NOT EXISTS (SELECT 1 FROM dealer_group_heads WHERE email=accounts.email)";
  const groupSalon='salon IN (SELECT salon FROM dealer_group_salons WHERE group_name=?)';
  const filters={admin:'',group:' AND '+groupSalon,manager:' AND salon=?',seller:' AND id=?'};
  const params=user.role==='admin'?[]:user.role==='group'?[user.group]:user.role==='manager'?[user.salon]:[user.id];
  const sellerQuery='SELECT id,name,salon FROM accounts WHERE '+members+filters[user.role];
  const sellers=await list(db,sellerQuery+' ORDER BY id',...params);
  const scope='person IN (SELECT id FROM accounts WHERE '+members+filters[user.role]+')';
  const salons=user.role==='admin'
    ?await list(db,'SELECT salon FROM accounts UNION SELECT salon FROM dealer_group_salons ORDER BY salon')
    :user.role==='group'?await list(db,'SELECT salon FROM dealer_group_salons WHERE group_name=? ORDER BY salon',user.group)
    :[{salon:user.salon}];
  const managedSalons=new Set(salons.map(({salon})=>salon));
  if (request.method==='GET' && ['/api/state','/api/daily'].includes(path)) {
    const month=url.searchParams.get('month');
    if (!monthValid(month)) return json({error:'Wybierz poprawny miesiąc.'},400);
    const first=Math.floor((Number(month.slice(5))-1)/3)*3+1;
    const months=[first,first+1,first+2].map(n=>month.slice(0,5)+String(n).padStart(2,'0'));
    const reviewPlans=await list(db,'SELECT person,month,target FROM review_plans WHERE month IN (?,?,?) AND '+scope,...months,...params);
    const funnelPlans=await list(db,'SELECT person,month,targets FROM funnel_plans WHERE month IN (?,?,?) AND '+scope,...months,...params);
    if (path==='/api/daily') {
      const daily = await list(db,'SELECT person,day,counters FROM daily_results WHERE substr(day,1,7) IN (?,?,?) AND '+scope,...months,...params);
      const plans = await list(db,'SELECT person,month,target FROM plans WHERE month IN (?,?,?) AND '+scope,...months,...params);
      const personal=user.role==='seller'?await tracking(db,user.id):null;
      const brand=personal?await db.prepare('SELECT name,logo FROM dealer_brand WHERE salon=?').bind(user.salon).first():null;
      const approvals=personal?[]:await list(db,"SELECT person,day,reason FROM daily_exceptions WHERE kind='pending' AND "+scope+' ORDER BY day',...params);
      const cause=await db.prepare('SELECT title,organization,description FROM charity_causes WHERE month=?').bind(localDay().slice(0,7)).first();
      const sidebar=await db.prepare('SELECT mode FROM dashboard_sidebar WHERE id=1').bind().first();
      const today=localDay();
      const sidebarMode=sidebar?.mode??'cause';
      const pref=await db.prepare('SELECT enabled FROM giphy_preference WHERE id=1').bind().first();
      const mixed=sidebarMode==='meme'&&Boolean(env.GIPHY_API_KEY)&&(pref?.enabled??1);
      // Keep the source stable across reloads, with an independent choice per seller and Warsaw date.
      const sourceSeed=mixed&&personal
        ?new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(today+':'+user.id)))
        :null;
      const trending=mixed&&(!sourceSeed||sourceSeed[0]<128);
      const meme=sidebarMode==='meme'?await memeFor(db,user,today):null;
      const assignedGif=trending&&personal?await db.prepare('SELECT gif_id FROM giphy_daily WHERE person=? AND day=?').bind(user.id,today).first():null;
      const giphy=trending?{key:env.GIPHY_API_KEY,id:assignedGif?.gif_id??null}:null;
      const memeVotes=personal&&sidebarMode==='meme'
        ?Object.fromEntries((await list(db,'SELECT source,vote FROM meme_votes WHERE person=? AND day=?',user.id,today)).map(row=>[row.source,row.vote]))
        :{};
      if (personal&&meme&&memeVotes.local==null&&await db.prepare('SELECT 1 FROM meme_reactions WHERE person=? AND day=?').bind(user.id,today).first()) {
        memeVotes.local=1;
      }
      const memeStories=user.role==='admin'?await list(db,"SELECT id,title,caption FROM meme_stories WHERE status='pending' ORDER BY id LIMIT 50"):[];
      const series=personal?await db.prepare('SELECT published_day,lessons FROM salon_lessons WHERE salon=?').bind(user.salon).first():null;
      const lessons=series?JSON.parse(series.lessons):[];
      const position=lessons.length?Math.max(0,lessonDay(today)-lessonDay(series.published_day))%lessons.length:0;
      const lesson=lessons[position]??null;
      let ranking=null;
      if (personal) {
        const group=await db.prepare('SELECT group_name FROM dealer_group_salons WHERE salon=?').bind(user.salon).first();
        const rankingMonth=today.slice(0,7);
        const ranks=await list(db,`SELECT a.id,a.salon,p.target,
          COALESCE(SUM(json_extract(d.counters,'$[4]')),0) AS orders
          FROM accounts a JOIN plans p ON p.person=a.id AND p.month=? AND p.target>0
          LEFT JOIN daily_results d ON d.person=a.id AND substr(d.day,1,7)=p.month AND d.day<=?
          WHERE a.role='seller' AND NOT EXISTS (SELECT 1 FROM dealer_group_heads h WHERE h.email=a.email)
          AND (a.salon=? OR a.salon IN (SELECT salon FROM dealer_group_salons WHERE group_name=?))
          GROUP BY a.id,a.salon,p.target`,rankingMonth,today,user.salon,group?.group_name??null);
        const self=ranks.find(row=>row.id===user.id);
        if (self) {
          const place=rows=>({place:1+rows.filter(row=>row.orders*self.target>self.orders*row.target).length,total:rows.length});
          ranking={salon:place(ranks.filter(row=>row.salon===user.salon)),group:group?place(ranks):null,percent:self.orders/self.target*100};
        }
      }
      const groups=user.role==='admin'?await list(db,`SELECT g.name,
        (SELECT group_concat(salon, char(10)) FROM dealer_group_salons WHERE group_name=g.name) AS salons,
        (SELECT group_concat(email, char(10)) FROM dealer_group_heads WHERE group_name=g.name) AS heads
        FROM dealer_groups g ORDER BY g.name`):[];
      return json({role:user.role,sellers,plans,reviewPlans,funnelPlans,daily,personal,brand,salons,groups,ranking,approvals,cause,sidebarMode,meme,memeVotes,memeStories,giphy,giphyAvailable:Boolean(env.GIPHY_API_KEY),lesson,salon:user.salon??null,today});
    }
    const [results,plans,accounts]=await Promise.all([
      list(db,'SELECT person,month,source,counters FROM results WHERE month IN (?,?,?) AND '+scope,...months,...params),
      list(db,'SELECT person,month,target FROM plans WHERE month IN (?,?,?) AND '+scope,...months,...params),
      user.role==='seller'?[]:list(db,"SELECT id,email,name,salon,role FROM accounts WHERE role IN ('manager','seller')"+(user.role==='manager'?" AND role='seller'":'')+filters[user.role]+' ORDER BY id',...params),
    ]);
    return json({role:user.role,sellers,results,plans,reviewPlans,funnelPlans,accounts,salons});
  }
  if (request.method!=='POST' || request.headers.get('Origin')!==url.origin ||
      !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Niedozwolone żądanie.'},403);
  let body;
  try {body=await request.json();} catch {return json({error:'Nieprawidłowy formularz.'},400);}
  if (!body || typeof body!=='object') return json({error:'Nieprawidłowy formularz.'},400);
  if (['/api/lesson-import','/api/lessons'].includes(path) && ['admin','manager'].includes(user.role)) {
    const salon=user.role==='manager'?user.salon:body.salon;
    if (!textValid(salon) || (user.role==='admin' && !await db.prepare('SELECT 1 FROM accounts WHERE salon=?').bind(salon).first()))
      return json({error:'Wybierz salon.'},400);
    if (path==='/api/lesson-import') {
      if (typeof body.filename!=='string'||!/[.](pdf|docx|xlsx|pptx|txt)$/i.test(body.filename)||
          typeof body.file!=='string'||!body.file||body.file.length>20_971_520)
        return json({error:'Wybierz PDF, DOCX, XLSX, PPTX lub TXT do 15 MB.'},400);
      try {
        const lessons=lessonDrafts((await env.extractLessonText(body.filename,body.file)).slice(0,120_000));
        if (lessons.length) return json({lessons});
        return json({error:'Brak tekstu do odczytania. Jeśli to skan, użyj pliku z rozpoznanym tekstem lub dodaj lekcję ręcznie.'},422);
      } catch {
        return json({error:'Nie udało się odczytać pliku. Sprawdź format lub dodaj lekcję ręcznie.'},422);
      }
    }
    if (!Array.isArray(body.lessons)||body.lessons.length<1||body.lessons.length>40||
        !body.lessons.every(lesson=>lesson&&textValid(lesson.title)&&typeof lesson.topic==='string'&&
          lesson.topic.trim()&&lesson.topic.length<=650&&typeof lesson.remember==='string'&&lesson.remember.trim()&&lesson.remember.length<=220))
      return json({error:'Uzupełnij tytuł, zagadnienie i „Zapamiętaj!” dla każdej lekcji.'},400);
    const lessons=body.lessons.map(({title,topic,remember})=>({title:title.trim(),topic:topic.trim(),remember:remember.trim()}));
    await db.prepare('INSERT INTO salon_lessons VALUES (?,?,?) ON CONFLICT(salon) DO UPDATE SET published_day=excluded.published_day,lessons=excluded.lessons')
      .bind(salon,localDay(),JSON.stringify(lessons)).run();
    return json({ok:true});
  }
  if (path==='/api/group' && user.role==='admin') {
    const {name,salons:groupSalons,headEmail}=body;
    if (!textValid(name)||!Array.isArray(groupSalons)||!groupSalons.length||groupSalons.length>100||
        !groupSalons.every(textValid)||!textValid(headEmail)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(headEmail.trim()))
      return json({error:'Podaj nazwę grupy, adres szefa i co najmniej jeden salon.'},400);
    const groupName=name.trim();
    const headAddress=headEmail.trim().toLowerCase();
    const chosen=[...new Set(groupSalons.map(salon=>salon.trim()))];
    const occupied=await list(db,'SELECT salon FROM dealer_group_salons WHERE group_name<>?',groupName);
    if (occupied.some(({salon})=>chosen.includes(salon)))
      return json({error:'Jeden z salonów należy już do innej grupy.'},409);
    await db.batch([
      db.prepare('INSERT INTO dealer_groups VALUES (?) ON CONFLICT DO NOTHING').bind(groupName),
      ...chosen.map(salon=>db.prepare('INSERT INTO dealer_group_salons VALUES (?,?) ON CONFLICT DO NOTHING').bind(salon,groupName)),
      db.prepare('INSERT INTO dealer_group_heads VALUES (?,?) ON CONFLICT(email) DO UPDATE SET group_name=excluded.group_name').bind(headAddress,groupName)
    ]);
    return json({ok:true});
  }
  if (path==='/api/accounts' && user.role!=='seller') {
    if (!textValid(body.name)||!textValid(body.salon)||!['manager','seller'].includes(body.role)||
        !textValid(body.email)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return json({error:'Uzupełnij poprawnie wszystkie pola.'},400);
    const targetEmail=body.email.trim().toLowerCase();
    const salon=body.salon.trim();
    if (user.role!=='admin'&&!managedSalons.has(salon) || user.role==='manager'&&body.role!=='seller')
      return json({error:'Nie możesz nadać tej roli w wybranym salonie.'},403);
    const current=await db.prepare('SELECT role,salon FROM accounts WHERE email=?').bind(targetEmail).first();
    const currentHead=await db.prepare('SELECT 1 FROM dealer_group_heads WHERE email=?').bind(targetEmail).first();
    if (current?.role==='admin'||targetEmail===email||user.role!=='admin'&&(currentHead||current&&(!managedSalons.has(current.salon)||user.role==='manager'&&current.role!=='seller')))
      return json({error:'Nie możesz zmienić uprawnień tego konta.'},403);
    await db.batch([
      db.prepare('INSERT INTO accounts(email,name,salon,role) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,salon=excluded.salon,role=excluded.role')
        .bind(targetEmail,body.name.trim(),salon,body.role),
      ...(currentHead?[db.prepare('DELETE FROM dealer_group_heads WHERE email=?').bind(targetEmail)]:[])
    ]);
    return json({ok:true});
  }
  if (path==='/api/brand' && user.role==='admin') {
    if (!textValid(body.salon)||!textValid(body.name)||typeof body.logo!=='string'||body.logo.length>56000||
        (body.logo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.logo))) return json({error:'Sprawdź nazwę i logo dealera.'},400);
    await db.prepare('INSERT INTO dealer_brand VALUES (?,?,?) ON CONFLICT(salon) DO UPDATE SET name=excluded.name,logo=excluded.logo')
      .bind(body.salon.trim(),body.name.trim(),body.logo).run();
    return json({ok:true});
  }
  if (path==='/api/meme-vote' && user.role==='seller') {
    const {source,vote,day}=body;
    if (!['local','giphy'].includes(source)||![-1,1].includes(vote)) return json({error:'Wybierz reakcję.'},400);
    if (day!==localDay()) return json({error:'Odśwież stronę, aby zagłosować na dzisiejszy mem.'},409);
    const assignment=source==='local'?'meme_assignments':'giphy_daily';
    const result=await db.prepare(`
      INSERT INTO meme_votes(person,day,source,vote)
      SELECT person,day,?,? FROM ${assignment} WHERE person=? AND day=?
      ON CONFLICT(person,day,source) DO UPDATE SET vote=excluded.vote
    `).bind(source,vote,user.id,day).run();
    return result.meta.changes?json({ok:true}):json({error:'Nie znaleziono dzisiejszego mema.'},409);
  }
  const storyValid=()=>textValid(body.title)&&typeof body.caption==='string'&&body.caption.trim().length>0&&body.caption.length<=500;
  if (path==='/api/meme-story' && user.role==='seller') {
    if (!storyValid()) return json({error:'Podaj tytuł i historię (do 500 znaków).'},400);
    await db.prepare('INSERT INTO meme_stories(person,title,caption) VALUES (?,?,?)')
      .bind(user.id,body.title.trim(),body.caption.trim()).run();
    return json({ok:true});
  }
  if (path==='/api/meme-review' && user.role==='admin') {
    if (!Number.isSafeInteger(body.id)||typeof body.approve!=='boolean'||(body.approve&&!storyValid()))
      return json({error:'Sprawdź treść i decyzję.'},400);
    const change=body.approve
      ?await db.prepare("UPDATE meme_stories SET title=?,caption=?,status='approved' WHERE id=? AND status='pending'").bind(body.title.trim(),body.caption.trim(),body.id).run()
      :await db.prepare("UPDATE meme_stories SET status='rejected' WHERE id=? AND status='pending'").bind(body.id).run();
    return change.meta.changes?json({ok:true}):json({error:'Historia jest już rozpatrzona.'},409);
  }
  if (path==='/api/giphy-assign' && user.role==='seller' && env.GIPHY_API_KEY) {
    const ids=body.ids;
    if (!Array.isArray(ids)||ids.length<1||ids.length>50||!ids.every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id)))
      return json({error:'Brak odpowiednich GIF-ów.'},400);
    const day=localDay();
    await db.prepare(`
      INSERT INTO giphy_daily(person,salon,day,gif_id)
      SELECT ?,?,?,candidate.value FROM json_each(?) AS candidate
      WHERE NOT EXISTS (SELECT 1 FROM giphy_daily WHERE salon=? AND day=? AND gif_id=candidate.value)
      ORDER BY candidate.key LIMIT 1
      ON CONFLICT(person,day) DO NOTHING
    `).bind(user.id,user.salon,day,JSON.stringify(ids),user.salon,day).run();
    const assigned=await db.prepare('SELECT gif_id FROM giphy_daily WHERE person=? AND day=?').bind(user.id,day).first();
    return json({id:assigned?.gif_id??null});
  }
  if (path==='/api/sidebar' && user.role==='admin') {
    if (!['cause','meme','giphy'].includes(body.mode)||(body.mode==='giphy'&&!env.GIPHY_API_KEY))
      return json({error:'Wybierz dostępną zawartość sekcji.'},400);
    await db.batch([
      db.prepare('INSERT INTO dashboard_sidebar VALUES (1,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode').bind(body.mode==='giphy'?'meme':body.mode),
      db.prepare('INSERT INTO giphy_preference VALUES (1,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled').bind(Number(body.mode==='giphy'))
    ]);
    return json({ok:true});
  }
  if (path==='/api/cause' && user.role==='admin') {
    if (!monthValid(body.month)||![body.title,body.organization,body.description].every(textValid)) return json({error:'Uzupełnij informacje o celu.'},400);
    await db.prepare('INSERT INTO charity_causes VALUES (?,?,?,?) ON CONFLICT(month) DO UPDATE SET title=excluded.title,organization=excluded.organization,description=excluded.description')
      .bind(body.month,body.title.trim(),body.organization.trim(),body.description.trim()).run();
    return json({ok:true});
  }
  if (user.role==='group') return json({error:'Ten poziom dostępu służy do przeglądania wyników i zarządzania zespołem.'},403);
  if (!sellers.some(p=>p.id===body.person)) return json({error:'Brak uprawnień do tego handlowca.'},403);
  if (path==='/api/review' && user.role!=='seller') {
    if (!dayValid(body.day)||typeof body.approve!=='boolean') return json({error:'Sprawdź decyzję.'},400);
    const changed=await db.prepare("UPDATE daily_exceptions SET kind=? WHERE person=? AND day=? AND kind='pending'")
      .bind(body.approve?'zero':'rejected',body.person,body.day).run();
    return changed.meta.changes?json({ok:true}):json({error:'Zgłoszenie jest już rozliczone.'},409);
  }
  if (path==='/api/daily' || path==='/api/day-exception') {
    if (user.role!=='seller') return json({error:'Dzienny wpis zapisuje handlowiec.'},403);
    const {day}=body;
    if (!dayValid(day)||day>localDay()) return json({error:'Sprawdź datę wpisu.'},400);
    const {missing,exceptions}=await tracking(db,user.id);
    if (day !== (missing[0] ?? localDay()))
      return json({error:'Najpierw rozlicz najstarszy zaległy dzień.'},409);
    if (['pending','leave','training','zero'].includes(exceptions[day])) return json({error:'Ten dzień ma już status rozliczenia.'},409);
    if (path==='/api/day-exception') {
      if (!['leave','training','pending'].includes(body.kind)||body.kind==='pending'&&!textValid(body.reason))
        return json({error:'Wybierz status i podaj powód dnia bez aktywności.'},400);
      const changed=await db.prepare("INSERT INTO daily_exceptions SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM daily_results WHERE person=? AND day=?) ON CONFLICT(person,day) DO UPDATE SET kind=excluded.kind,reason=excluded.reason WHERE kind='rejected'")
        .bind(user.id,day,body.kind,body.kind==='pending'?body.reason.trim():'',user.id,day).run();
      return changed.meta.changes?json({ok:true}):json({error:'Ten dzień jest już rozliczony.'},409);
    }
    const {rows}=body;
    if (!Array.isArray(rows)||rows.length!==sourceCount||!rows.every(row=>Array.isArray(row)&&dailyRowLengths.includes(row.length)&&row.every(countValid))||
        !rows.some(row=>row.some(v=>v>0))) return json({error:'Wpisz co najmniej jedno wykonane działanie.'},400);
    const totals=[1,3,4,5,7].map(i=>rows.reduce((sum,row)=>sum+row[i],0));
    const written=await db.prepare("INSERT INTO daily_results SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM daily_exceptions WHERE person=? AND day=? AND kind!='rejected') ON CONFLICT(person,day) DO NOTHING")
      .bind(user.id,day,JSON.stringify([...totals,rows]),user.id,day).run();
    return written.meta.changes?json({ok:true}):json({error:'Ten dzień jest już zapisany.'},409);
  }
  if (path==='/api/plans' && user.role!=='seller') {
    if (!monthValid(body.month)||!Array.isArray(body.targets)||body.targets.length!==3||!body.targets.every(countValid)) return json({error:'Wpisz trzy cele miesięczne.'},400);
    const reviewTargets=body.reviewTargets;
    if (reviewTargets!==undefined&&(!Array.isArray(reviewTargets)||reviewTargets.length!==3||!reviewTargets.every(value=>value===null||countValid(value))))
      return json({error:'Sprawdź cele dotyczące opinii Google.'},400);
    const funnelTargets=body.funnelTargets;
    const validFunnel=value=>Array.isArray(value)&&[3,8].includes(value.length)&&value.every(target=>target===null||countValid(target));
    if (funnelTargets!==undefined&&(!Array.isArray(funnelTargets)||funnelTargets.length!==3||!funnelTargets.every(validFunnel)))
      return json({error:'Sprawdź cele lejka.'},400);
    const first=Math.floor((Number(body.month.slice(5))-1)/3)*3+1;
    await db.batch(body.targets.map((target,i)=>db.prepare('INSERT INTO plans(person,month,target) VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET target=excluded.target')
      .bind(body.person,body.month.slice(0,5)+String(first+i).padStart(2,'0'),target)).concat((reviewTargets??[]).map((target,i)=>{
        const month=body.month.slice(0,5)+String(first+i).padStart(2,'0');
        return target===null
          ?db.prepare('DELETE FROM review_plans WHERE person=? AND month=?').bind(body.person,month)
          :db.prepare('INSERT INTO review_plans(person,month,target) VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET target=excluded.target').bind(body.person,month,target);
      }), (funnelTargets??[]).map((targets,i)=>{
        const month=body.month.slice(0,5)+String(first+i).padStart(2,'0');
        return targets.every(value=>value===null)
          ?db.prepare('DELETE FROM funnel_plans WHERE person=? AND month=?').bind(body.person,month)
          :db.prepare('INSERT INTO funnel_plans VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET targets=excluded.targets').bind(body.person,month,JSON.stringify(targets));
      })));
    return json({ok:true});
  }
  if (path==='/api/results' || path==='/api/results-table') {
    const {month}=body;
    const records=path==='/api/results'?[body]:body.records;
    if (!monthValid(month)||!Array.isArray(records)||!records.length||records.length>12||
        records.some(record=>!record||!Number.isInteger(record.source)||record.source<0||record.source>11)||
        new Set(records.map(({source})=>source)).size!==records.length)
      return json({error:'Sprawdź miesiąc i źródła wyników.'},400);
    for (const {source,row} of records) {
      if (!Array.isArray(row)||![11,12].includes(row.length)||!row.slice(0,11).every(countValid))
        return json({error:'Sprawdź liczby etapów i aktywności w wierszu '+(source+1)+'.'},400);
      const extra=row[11];
      if (row.length===12 && (!Array.isArray(extra)||extra.length!==15||!extra.every(v=>v===null||countValid(v))||
          extra[0]>row[0]||extra[2]>row[7]||extra[3]>row[8]||
          [[0,1],[3,4],[8,9],[10,11]].some(([den,num])=>(extra[den]===null)!==(extra[num]===null)||extra[num]>extra[den])||
          !([12,13,14].every(i=>extra[i]===null)||[12,13,14].every(i=>extra[i]!==null))||extra[13]+extra[14]>extra[12]))
        return json({error:'Sprawdź dodatkowe wskaźniki w wierszu '+(source+1)+'.'},400);
    }
    await db.batch(records.map(({source,row})=>db.prepare('INSERT INTO results(person,month,source,counters) VALUES (?,?,?,?) ON CONFLICT(person,month,source) DO UPDATE SET counters=excluded.counters')
      .bind(body.person,month,source,JSON.stringify(row))));
    return json({ok:true});
  }
  return json({error:'Brak uprawnień do tej operacji.'},403);
}

export default {async fetch(request, env) {
  try {return await handle(request,env);}
  catch (error) {console.error(error.message);return json({error:'Nie udało się obsłużyć żądania. Spróbuj ponownie.'},500);}
}};
