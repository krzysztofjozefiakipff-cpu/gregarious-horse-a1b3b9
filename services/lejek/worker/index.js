const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers});
const monthValid = month => typeof month==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const localDay = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date());
const dayValid = day => typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
const countValid = value => Number.isInteger(value) && value>=0 && value<=1000000;
const textValid = value => typeof value==='string' && value.trim().length>0 && value.length<=120;
async function list(db,sql,...params) { return (await db.prepare(sql).bind(...params).all()).results; }

const sourceCount = 12;
const columnCount = 9;
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

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/')) {
    const asset = path==='/'?'/daily.html':path;
    if (request.method!=='GET' || !Object.hasOwn(assets,asset)) return new Response('Nie znaleziono',{status:404});
    return new Response(assets[asset],{headers:{...headers,'Content-Type':asset.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'"}});
  }
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!email || !request.headers.get('oai-authenticated-user-id')) return json({error:'Zaloguj się do konta CARVAMO.'},401);
  const owner = request.headers.get('x-lejek-verified-admin')==='1';
  const db = env.DB;
  const assigned = await db.prepare('SELECT id, name, salon, role FROM accounts WHERE email=?').bind(email).first();
  const user = owner ? {id:assigned?.id,role:'admin'} : assigned?.role==='admin' ? null : assigned;
  if (!user) return json({error:'Administrator musi przypisać Ci rolę w lejku.'},403);

  const sellers = user.role==='admin'
    ? await list(db,"SELECT id,name,salon FROM accounts WHERE role='seller' ORDER BY id")
    : user.role==='manager'
      ? await list(db,"SELECT id,name,salon FROM accounts WHERE role='seller' AND salon=? ORDER BY id",user.salon)
      : [{id:user.id,name:user.name,salon:user.salon}];
  const scope = user.role==='admin'
    ? "person IN (SELECT id FROM accounts WHERE role='seller')"
    : user.role==='manager'
      ? "person IN (SELECT id FROM accounts WHERE role='seller' AND salon=?)"
      : "person=?";
  const params = user.role==='admin'?[]:user.role==='manager'?[user.salon]:[user.id];
  if (request.method==='GET' && ['/api/state','/api/daily'].includes(path)) {
    const month=url.searchParams.get('month');
    if (!monthValid(month)) return json({error:'Wybierz poprawny miesiąc.'},400);
    const first=Math.floor((Number(month.slice(5))-1)/3)*3+1;
    const months=[first,first+1,first+2].map(n=>month.slice(0,5)+String(n).padStart(2,'0'));
    if (path==='/api/daily') {
      const daily = await list(db,'SELECT person,day,counters FROM daily_results WHERE substr(day,1,7) IN (?,?,?) AND '+scope,...months,...params);
      const plans = await list(db,'SELECT person,month,target FROM plans WHERE month IN (?,?,?) AND '+scope,...months,...params);
      const personal=user.role==='seller'?await tracking(db,user.id):null;
      const brand=personal?await db.prepare('SELECT name,logo FROM dealer_brand WHERE salon=?').bind(user.salon).first():null;
      const salons=user.role==='admin'?await list(db,'SELECT DISTINCT salon FROM accounts ORDER BY salon'):[];
      const approvals=personal?[]:await list(db,"SELECT person,day,reason FROM daily_exceptions WHERE kind='pending' AND "+scope+' ORDER BY day',...params);
      const cause=await db.prepare('SELECT title,organization,description FROM charity_causes WHERE month=?').bind(localDay().slice(0,7)).first();
      return json({role:user.role,sellers,plans,daily,personal,brand,salons,approvals,cause,today:localDay()});
    }
    const [results,plans,accounts]=await Promise.all([
      list(db,'SELECT person,month,source,counters FROM results WHERE month IN (?,?,?) AND '+scope,...months,...params),
      list(db,'SELECT person,month,target FROM plans WHERE month IN (?,?,?) AND '+scope,...months,...params),
      user.role==='admin'?list(db,'SELECT id,email,name,salon,role FROM accounts ORDER BY id'):[],
    ]);
    return json({role:user.role,sellers,results,plans,accounts});
  }
  if (request.method!=='POST' || request.headers.get('Origin')!==url.origin ||
      !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Niedozwolone żądanie.'},403);
  let body;
  try {body=await request.json();} catch {return json({error:'Nieprawidłowy formularz.'},400);}
  if (!body || typeof body!=='object') return json({error:'Nieprawidłowy formularz.'},400);
  if (path==='/api/accounts' && user.role==='admin') {
    if (!textValid(body.name)||!textValid(body.salon)||!['manager','seller'].includes(body.role)||
        !textValid(body.email)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return json({error:'Uzupełnij poprawnie wszystkie pola.'},400);
    const result=await db.prepare('INSERT INTO accounts(email,name,salon,role) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING')
      .bind(body.email.trim().toLowerCase(),body.name.trim(),body.salon.trim(),body.role).run();
    if (!result.meta.changes) return json({error:'Konto z tym adresem już istnieje.'},409);
    return json({ok:true});
  }
  if (path==='/api/brand' && user.role==='admin') {
    if (!textValid(body.salon)||!textValid(body.name)||typeof body.logo!=='string'||body.logo.length>56000||
        (body.logo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.logo))) return json({error:'Sprawdź nazwę i logo dealera.'},400);
    await db.prepare('INSERT INTO dealer_brand VALUES (?,?,?) ON CONFLICT(salon) DO UPDATE SET name=excluded.name,logo=excluded.logo')
      .bind(body.salon.trim(),body.name.trim(),body.logo).run();
    return json({ok:true});
  }
  if (path==='/api/cause' && user.role==='admin') {
    if (!monthValid(body.month)||![body.title,body.organization,body.description].every(textValid)) return json({error:'Uzupełnij informacje o celu.'},400);
    await db.prepare('INSERT INTO charity_causes VALUES (?,?,?,?) ON CONFLICT(month) DO UPDATE SET title=excluded.title,organization=excluded.organization,description=excluded.description')
      .bind(body.month,body.title.trim(),body.organization.trim(),body.description.trim()).run();
    return json({ok:true});
  }
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
    if (!Array.isArray(rows)||rows.length!==sourceCount||!rows.every(row=>Array.isArray(row)&&row.length===columnCount&&row.every(countValid))||
        !rows.some(row=>row.some(v=>v>0))) return json({error:'Wpisz co najmniej jedno wykonane działanie.'},400);
    const totals=[1,3,4,5,7].map(i=>rows.reduce((sum,row)=>sum+row[i],0));
    const written=await db.prepare("INSERT INTO daily_results SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM daily_exceptions WHERE person=? AND day=? AND kind!='rejected') ON CONFLICT(person,day) DO NOTHING")
      .bind(user.id,day,JSON.stringify([...totals,rows]),user.id,day).run();
    return written.meta.changes?json({ok:true}):json({error:'Ten dzień jest już zapisany.'},409);
  }
  if (path==='/api/plans' && user.role!=='seller') {
    if (!monthValid(body.month)||!Array.isArray(body.targets)||body.targets.length!==3||!body.targets.every(countValid)) return json({error:'Wpisz trzy cele miesięczne.'},400);
    const first=Math.floor((Number(body.month.slice(5))-1)/3)*3+1;
    await db.batch(body.targets.map((target,i)=>db.prepare('INSERT INTO plans(person,month,target) VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET target=excluded.target')
      .bind(body.person,body.month.slice(0,5)+String(first+i).padStart(2,'0'),target)));
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
