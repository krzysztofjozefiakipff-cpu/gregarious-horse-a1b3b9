const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers});
const monthValid = month => typeof month==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const localDay = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date());
const dayValid = day => typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
const countValid = value => Number.isInteger(value) && value>=0 && value<=1000000;
const textValid = value => typeof value==='string' && value.trim().length>0 && value.length<=120;
async function list(db,sql,...params) { return (await db.prepare(sql).bind(...params).all()).results; }

const sourceCount = 13;
const supportedDailySourceCounts = [12, sourceCount];
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

function validAccountPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

function serveAsset(path,method) {
    const asset = path==='/'?'/daily.html':path;
    if (method!=='GET' || !Object.hasOwn(assets,asset)) return new Response('Nie znaleziono',{status:404});
    return new Response(assets[asset],{headers:{...headers,'Content-Type':asset.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.giphy.com https://giphy.com; connect-src 'self' https://api.giphy.com; object-src 'none'; base-uri 'none'; form-action 'self'"}});
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const managementPage=path==='/zarzadzanie.html';
  if (path==='/index.html'&&request.method==='GET') {
    return new Response(null,{status:303,headers:{...headers,Location:'/daily.html'}});
  }
  if (!path.startsWith('/api/')&&!managementPage) return serveAsset(path,request.method);
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!email || !request.headers.get('oai-authenticated-user-id')) return json({error:'Zaloguj się do konta CARVAMO.'},401);
  const owner = request.headers.get('x-lejek-verified-admin')==='1';
  const db = env.DB;
  if (!owner&&await db.prepare('SELECT 1 FROM archived_users WHERE email=?').bind(email).first())
    return json({error:'To konto nie ma obecnie dostępu do Lejka.'},403);
  const assigned = await db.prepare('SELECT id, name, salon, role FROM accounts WHERE email=?').bind(email).first();
  const head=await db.prepare('SELECT group_name FROM dealer_group_heads WHERE email=?').bind(email).first();
  const explicitRoles=assigned?await list(db,'SELECT role FROM account_roles WHERE person=?',assigned.id):[];
  const roles=owner?['admin']:explicitRoles.length?['group','manager','seller'].filter(role=>
    explicitRoles.some(row=>row.role===role)&&(role!=='group'||head))
    :head?['group']:['manager','seller'].includes(assigned?.role)?[assigned.role]:[];
  if (!roles.length) return json({error:'Administrator musi przypisać Ci rolę w lejku.'},403);
  const requested=url.searchParams.get('role');
  if (requested&&!roles.includes(requested)&&request.method!=='GET') return json({error:'Nie masz już wybranej roli. Odśwież widok.'},403);
  const role=roles.includes(requested)?requested:roles[0];
  if (managementPage) {
    return role==='seller'
      ? new Response(null,{status:303,headers:{...headers,Location:'/daily.html'}})
      : serveAsset(path,request.method);
  }

  const user={...assigned,role,group:head?.group_name};

  const accountRole=(table,role)=>`(EXISTS (SELECT 1 FROM account_roles ar WHERE ar.person=${table}.id AND ar.role='${role}')
    OR (${table}.role='${role}' AND NOT EXISTS (SELECT 1 FROM account_roles ar WHERE ar.person=${table}.id)
      AND NOT EXISTS (SELECT 1 FROM dealer_group_heads h WHERE h.email=${table}.email)))`;
  const members=accountRole('accounts','seller');
  const managers=accountRole('accounts','manager');
  const groupSalon='salon IN (SELECT salon FROM dealer_group_salons WHERE group_name=?)';
  const filters={admin:'',group:' AND '+groupSalon,manager:' AND (salon=? OR salon IN (SELECT salon FROM manager_salons WHERE manager=?))',seller:' AND id=?'};
  const params=user.role==='admin'?[]:user.role==='group'?[user.group]:user.role==='manager'?[user.salon,user.id]:[user.id];
  const accountStatuses=`NOT EXISTS (SELECT 1 FROM report_exclusions re WHERE re.person=accounts.id) AS includeInReports,
    CASE WHEN EXISTS (SELECT 1 FROM archived_users au WHERE au.email=accounts.email) THEN 'inactive'
         WHEN EXISTS (SELECT 1 FROM lejek_credentials lc WHERE lc.email=accounts.email) THEN 'active'
         ELSE 'pending' END AS accountStatus`;
  const sellerQuery='SELECT id,name,salon,'+accountStatuses+' FROM accounts WHERE '+members+filters[user.role];
  const sellers=await list(db,sellerQuery+' ORDER BY id',...params);
  const scope='person IN (SELECT id FROM accounts WHERE '+members+filters[user.role]+')';
  const salons=user.role==='admin'
    ?await list(db,"SELECT salon FROM accounts WHERE salon<>'' UNION SELECT salon FROM dealer_group_salons ORDER BY salon")
    :user.role==='group'?await list(db,'SELECT salon FROM dealer_group_salons WHERE group_name=? ORDER BY salon',user.group)
    :user.role==='manager'?await list(db,'SELECT ? AS salon UNION SELECT salon FROM manager_salons WHERE manager=? ORDER BY salon',...params)
    :[{salon:user.salon}];
  const managedSalons=new Set(salons.map(({salon})=>salon));
  const canManage=['admin','group','manager'].includes(user.role);
  // A delegated operator may manage only subordinate accounts in their full scope.
  const delegatedScope=user.role==='manager'
    ? filters.manager+' AND '+accountRole('a','seller')+' AND NOT '+accountRole('a','manager')
    : filters.group+` AND NOT EXISTS (
      SELECT 1 FROM manager_salons ms WHERE ms.manager=a.id AND NOT EXISTS (
        SELECT 1 FROM dealer_group_salons gs WHERE gs.salon=ms.salon AND gs.group_name=?
      )
    )`;
  const delegatedParams=user.role==='group'?[...params,user.group]:params;
  const delegatedWhere=`a.role IN ('manager','seller') AND a.email<>?
    AND NOT EXISTS (SELECT 1 FROM dealer_group_heads dh WHERE dh.email=a.email)
    AND NOT EXISTS (SELECT 1 FROM account_roles ar WHERE ar.person=a.id AND ar.role='group')
    `+delegatedScope;
  const canEditDelegated=address=>db.prepare(
    'SELECT 1 FROM accounts a WHERE a.email=? AND '+delegatedWhere
  ).bind(address,email,...delegatedParams).first();
  const reportsOnly=path==='/api/state'&&user.role!=='seller';
  const reportScope=reportsOnly?scope+' AND person NOT IN (SELECT person FROM report_exclusions)':scope;
  const reportSetting=(address,include)=>include===undefined?[]:[include
    ?db.prepare('DELETE FROM report_exclusions WHERE person=(SELECT id FROM accounts WHERE email=?)').bind(address)
    :db.prepare('INSERT INTO report_exclusions SELECT id FROM accounts WHERE email=? ON CONFLICT DO NOTHING').bind(address)];
  const storyScope=user.role==='admin'?'':' AND '+scope;
  const managesSalonPlans=['group','manager'].includes(user.role);
  const sellerTargets=async (salon,month)=>{
    const rows=await list(db,`
      SELECT a.id,a.name,p.target AS orders,r.target AS reviews,f.targets,k.version
      FROM accounts a
      LEFT JOIN plans p ON p.person=a.id AND p.month=?
      LEFT JOIN review_plans r ON r.person=a.id AND r.month=?
      LEFT JOIN funnel_plans f ON f.person=a.id AND f.month=?
      LEFT JOIN seller_plan_approvals k ON k.person=a.id AND k.month=?
      WHERE a.salon=? AND ${accountRole('a','seller')}
        AND NOT EXISTS (SELECT 1 FROM archived_users x WHERE x.email=a.email)
      ORDER BY a.id
    `,month,month,month,month,salon);
    return rows.map(row=>{
      const funnel=JSON.parse(row.targets??'[]');
      const targets=[row.orders,funnel[7]??null,funnel[6]??null,row.reviews];
      const complete=targets.every(countValid);
      return {id:row.id,name:row.name,targets,funnelTargets:Array.from({length:6},(_,index)=>funnel[index]??null),complete,version:complete?row.version:null};
    });
  };
  const approvalSet=team=>team.length&&team.every(person=>person.version)
    ?JSON.stringify(team.map(person=>[person.id,person.version])):null;
  const assignedManagers=salon=>list(db,`
    SELECT a.id,a.name FROM accounts a
    WHERE ${accountRole('a','manager')}
      AND NOT EXISTS (SELECT 1 FROM archived_users au WHERE au.email=a.email)
      AND (a.salon=? OR EXISTS (SELECT 1 FROM manager_salons ms WHERE ms.manager=a.id AND ms.salon=?))
    ORDER BY a.name,a.id
  `,salon,salon);
  if (path==='/api/salon-plans'&&request.method==='GET') {
    if (!owner&&!managesSalonPlans) return json({error:'Brak dostępu do planów salonu.'},403);
    const month=url.searchParams.get('month');
    if (!monthValid(month)) return json({error:'Wybierz poprawny miesiąc.'},400);
    const sellerSalons=new Map(sellers.map(seller=>[seller.id,seller.salon]));
    const totals=new Map(salons.map(({salon})=>[salon,[0,0,0,0]]));
    const daily=await list(db,'SELECT person,counters FROM daily_results WHERE substr(day,1,7)=? AND day<=? AND '+scope,month,localDay(),...params);
    const metricIndexes=[7,8,10,9];
    for (const row of daily) {
      const total=totals.get(sellerSalons.get(row.person));
      if (!total) continue;
      const counters=JSON.parse(row.counters);
      total[0]+=counters[4]??0;
      for (const source of Array.isArray(counters[5])?counters[5]:[]) {
        for (let i=1;i<metricIndexes.length;i++) total[i]+=source[metricIndexes[i]]??0;
      }
    }
    const plans=[];
    for (const {salon} of salons) {
      const team=await sellerTargets(salon,month);
      const approvals=approvalSet(team);
      const automatic=[0,0,0,0];
      for (const person of team) person.targets.forEach((target,index)=>{automatic[index]+=target??0;});
      const saved=await db.prepare(`SELECT p.manager,p.targets,k.approvals FROM salon_plans p
        LEFT JOIN salon_plan_approval_sets k USING (salon,month) WHERE p.salon=? AND p.month=?`).bind(salon,month).first();
      const managers=await assignedManagers(salon);
      const override=Boolean(approvals&&saved?.approvals===approvals);
      plans.push({salon,automatic,configured:automatic.map((_,index)=>override||team.some(person=>person.targets[index]!=null)),targets:override?JSON.parse(saved.targets):automatic,override,
        actuals:totals.get(salon),editable:Boolean(approvals&&managers.length),managers,
        manager:managers.find(manager=>manager.id===saved?.manager)?.id??null,
        team:team.map(({version,...person})=>({...person,approved:Boolean(version)}))});
    }
    return json({plans});
  }
  if (request.method==='GET' && ['/api/state','/api/daily'].includes(path)) {
    const month=url.searchParams.get('month');
    if (!monthValid(month)) return json({error:'Wybierz poprawny miesiąc.'},400);
    const first=Math.floor((Number(month.slice(5))-1)/3)*3+1;
    const months=[first,first+1,first+2].map(n=>month.slice(0,5)+String(n).padStart(2,'0'));
    const reviewPlans=await list(db,'SELECT person,month,target FROM review_plans WHERE month IN (?,?,?) AND '+reportScope,...months,...params);
    const funnelPlans=await list(db,'SELECT person,month,targets FROM funnel_plans WHERE month IN (?,?,?) AND '+reportScope,...months,...params);
    if (path==='/api/daily') {
      const daily = await list(db,'SELECT person,day,counters FROM daily_results WHERE substr(day,1,7) IN (?,?,?) AND '+scope,...months,...params);
      const plans = await list(db,'SELECT person,month,target FROM plans WHERE month IN (?,?,?) AND '+reportScope,...months,...params);
      const personal=user.role==='seller'?await tracking(db,user.id):null;
      const brand=personal?await db.prepare('SELECT name,logo FROM dealer_brand WHERE salon=?').bind(user.salon).first():null;
      const approvals=personal?[]:await list(db,"SELECT person,day,reason FROM daily_exceptions WHERE kind='pending' AND "+scope+' ORDER BY day',...params);
      const cause=await db.prepare('SELECT title,organization,description FROM charity_causes WHERE month=?').bind(localDay().slice(0,7)).first();
      const sidebar=await db.prepare('SELECT mode FROM dashboard_sidebar WHERE id=1').bind().first();
      const today=localDay();
      const teamDay=['manager','group','admin'].includes(user.role)?await list(db,`SELECT accounts.id AS person,t.start_day AS started,d.person IS NOT NULL AS saved,e.kind, EXISTS (SELECT 1 FROM archived_users WHERE email=accounts.email) AS archived
        FROM accounts
        LEFT JOIN daily_tracking t ON t.person=accounts.id
        LEFT JOIN daily_results d ON d.person=accounts.id AND d.day=?
        LEFT JOIN daily_exceptions e ON e.person=accounts.id AND e.day=?
        WHERE ${members}${filters[user.role]}`,today,today,...params):null;
      const previousDaily=personal?await db.prepare('SELECT day,counters FROM daily_results WHERE person=? AND day<? ORDER BY day DESC LIMIT 1').bind(user.id,today).first():null;
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
      const memeStories=canManage?await list(db,"SELECT id,title,caption FROM meme_stories WHERE status='pending'"+storyScope+' ORDER BY id LIMIT 50',...params):[];
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
          WHERE ${accountRole('a','seller')}
          AND NOT EXISTS (SELECT 1 FROM report_exclusions re WHERE re.person=a.id)
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
      const managerAssignments=user.role==='admin'?await list(db,`SELECT a.id,a.name,a.salon,m.salon AS additional
        FROM accounts a LEFT JOIN manager_salons m ON m.manager=a.id
        WHERE ${accountRole('a','manager')}
        ORDER BY a.name,a.id,m.salon`):[];
      const users=!canManage?[]:await list(db,`SELECT a.email,a.name,a.salon,h.group_name AS dealerGroup,
        COALESCE((SELECT group_concat(ar.role) FROM account_roles ar WHERE ar.person=a.id),CASE WHEN h.email IS NULL THEN a.role ELSE 'group' END) AS roles, EXISTS (SELECT 1 FROM archived_users WHERE email=a.email) AS archived,
        NOT EXISTS (SELECT 1 FROM report_exclusions re WHERE re.person=a.id) AS includeInReports
        FROM accounts a LEFT JOIN dealer_group_heads h ON h.email=a.email WHERE `+
        (owner?`a.role<>'admin'
          UNION ALL SELECT h.email,h.email,'',h.group_name,'group',EXISTS (SELECT 1 FROM archived_users WHERE email=h.email),1 FROM dealer_group_heads h
          WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.email=h.email)`:delegatedWhere)+
        ' ORDER BY 2,1',...(owner?[]:[email,...delegatedParams]));
      return json({users,roles,managerAssignments,role:user.role,dealerGroup:user.role==='group'?user.group:null,sellers,plans,reviewPlans,funnelPlans,daily,teamDay,previousDaily,personal,brand,salons,groups,ranking,approvals,cause,sidebarMode,meme,memeVotes,memeStories,giphy,giphyAvailable:Boolean(env.GIPHY_API_KEY),lesson,salon:user.salon??null,today});
    }
    const [results,plans,accounts]=await Promise.all([
      list(db,'SELECT person,month,source,counters FROM results WHERE month IN (?,?,?) AND '+reportScope,...months,...params),
      list(db,'SELECT person,month,target FROM plans WHERE month IN (?,?,?) AND '+reportScope,...months,...params),
      user.role==='seller'?[]:list(db,`SELECT id,email,name,salon,CASE WHEN ${user.role==='manager'?'0':managers} THEN 'manager' ELSE 'seller' END AS role, ${accountStatuses}
        FROM accounts WHERE ${user.role==='manager'?members:'('+members+' OR '+managers+')'}${filters[user.role]} ORDER BY id`,...params),
    ]);
    return json({roles,role:user.role,sellers:reportsOnly?sellers.filter(seller=>seller.includeInReports):sellers,results,plans,reviewPlans,funnelPlans,accounts,salons});
  }
  if (request.method!=='POST' || request.headers.get('Origin')!==url.origin ||
      !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Niedozwolone żądanie.'},403);
  let body;
  try {body=await request.json();} catch {return json({error:'Nieprawidłowy formularz.'},400);}
  if (!body || typeof body!=='object') return json({error:'Nieprawidłowy formularz.'},400);
  if (['/api/salon-plans','/api/salon-plans/approve','/api/salon-plans/seller'].includes(path)) {
    if (!managesSalonPlans) return json({error:'Brak dostępu do planów salonu.'},403);
    const {salon,month,manager,targets,person}=body;
    if (!monthValid(month)||!managedSalons.has(salon)) return json({error:'Wybierz miesiąc i salon w swoim zakresie.'},403);
    const team=await sellerTargets(salon,month);
    if (path.endsWith('/seller')) {
      if (user.role!=='manager'||!team.some(row=>row.id===person))
        return json({error:'Cele handlowca zmienia kierownik przypisanego salonu.'},403);
      if (!Array.isArray(targets)||targets.length!==4||!targets.every(countValid))
        return json({error:'Wpisz cztery poprawne cele handlowca.'},400);
      const {funnelTargets}=body;
      if (funnelTargets!==undefined&&(!Array.isArray(funnelTargets)||funnelTargets.length!==6||!funnelTargets.every(countValid)))
        return json({error:'Sprawdź sześć celów działań handlowca.'},400);
      const existing=await db.prepare('SELECT targets FROM funnel_plans WHERE person=? AND month=?').bind(person,month).first();
      const previous=JSON.parse(existing?.targets??'[]');
      const funnel=Array.from({length:8},(_,i)=>previous[i]??null);
      if (funnelTargets) funnel.splice(0,6,...funnelTargets);
      funnel[6]=targets[2];
      funnel[7]=targets[1];
      await db.batch([
        db.prepare('INSERT INTO plans VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET target=excluded.target').bind(person,month,targets[0]),
        db.prepare('INSERT INTO review_plans VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET target=excluded.target').bind(person,month,targets[3]),
        db.prepare('INSERT INTO funnel_plans VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET targets=excluded.targets').bind(person,month,JSON.stringify(funnel))
      ]);
      return json({ok:true});
    }
    if (path.endsWith('/approve')) {
      const individual=team.find(row=>row.id===person);
      if (!individual?.complete) return json({error:'Najpierw uzupełnij cztery cele handlowca.'},409);
      if (!individual.version) await db.prepare('INSERT INTO seller_plan_approvals VALUES (?,?,?) ON CONFLICT DO NOTHING')
        .bind(person,month,crypto.randomUUID()).run();
      return json({ok:true});
    }
    const approvals=approvalSet(team);
    if (!approvals) return json({error:'Najpierw zatwierdź plany wszystkich handlowców salonu.'},409);
    if (!Array.isArray(targets)||targets.length!==4||!targets.every(n=>Number.isSafeInteger(n)&&n>=0))
      return json({error:'Wpisz cztery poprawne cele.'},400);
    const managers=await assignedManagers(salon);
    const existing=await db.prepare('SELECT manager FROM salon_plans WHERE salon=? AND month=?').bind(salon,month).first();
    const responsible=user.role==='group'?manager:managers.some(row=>row.id===existing?.manager)?existing.manager:user.id;
    if (!managers.some(row=>row.id===responsible)) return json({error:'Wybierz kierownika przypisanego do salonu.'},403);
    await db.batch([
      db.prepare(`INSERT INTO salon_plans VALUES (?,?,?,?) ON CONFLICT(salon,month)
        DO UPDATE SET manager=excluded.manager,targets=excluded.targets`).bind(salon,month,responsible,JSON.stringify(targets)),
      db.prepare(`INSERT INTO salon_plan_approval_sets VALUES (?,?,?) ON CONFLICT(salon,month)
        DO UPDATE SET approvals=excluded.approvals`).bind(salon,month,approvals)
    ]);
    return json({ok:true});
  }
  if (['/api/lesson-import','/api/lessons'].includes(path) && canManage) {
    const salon=body.salon||(user.role==='manager'&&salons.length===1?salons[0].salon:null);
    if (!textValid(salon) || !managedSalons.has(salon))
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
  if (path==='/api/group/salon' && user.role==='group') {
    if (!textValid(body.salon)) return json({error:'Podaj nazwę salonu.'},400);
    const salon=body.salon.trim();
    if (managedSalons.has(salon)) return json({ok:true});
    const inserted=await db.prepare(`INSERT INTO dealer_group_salons(salon,group_name)
      SELECT ?,? WHERE NOT EXISTS (
        SELECT salon FROM dealer_group_salons WHERE salon=? UNION ALL
        SELECT salon FROM accounts WHERE salon=? UNION ALL
        SELECT salon FROM dealer_brand WHERE salon=? UNION ALL
        SELECT salon FROM salon_lessons WHERE salon=? UNION ALL
        SELECT salon FROM manager_salons WHERE salon=?
      )`).bind(salon,user.group,salon,salon,salon,salon,salon).run();
    return inserted.meta.changes?json({ok:true}):json({error:'Salon już istnieje. Poproś administratora o przypisanie go do grupy.'},409);
  }
  if (path==='/api/group' && user.role==='admin') {
    const {name,salons:groupSalons}=body;
    const headEmails=body.headEmails??(body.headEmail?[body.headEmail]:[]);
    if (!textValid(name)||!Array.isArray(groupSalons)||groupSalons.length>100||
        !groupSalons.every(textValid)||!Array.isArray(headEmails)||headEmails.length>100||
        !headEmails.every(address=>textValid(address)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim())))
      return json({error:'Podaj nazwę grupy i sprawdź nazwy salonów.'},400);
    const groupName=name.trim();
    const headAddresses=[...new Set(headEmails.map(address=>address.trim().toLowerCase()))];
    const otherHeads=await list(db,'SELECT email FROM dealer_group_heads WHERE group_name<>?',groupName);
    if (otherHeads.some(row=>headAddresses.includes(row.email)))
      return json({error:'Jeden z szefów jest już przypisany do innej grupy.'},409);
    const chosen=[...new Set(groupSalons.map(salon=>salon.trim()))];
    const occupied=await list(db,'SELECT salon FROM dealer_group_salons WHERE group_name<>?',groupName);
    if (occupied.some(({salon})=>chosen.includes(salon)))
      return json({error:'Jeden z salonów należy już do innej grupy.'},409);
    await db.batch([
      db.prepare('INSERT INTO dealer_groups VALUES (?) ON CONFLICT DO NOTHING').bind(groupName),
      ...chosen.map(salon=>db.prepare('INSERT INTO dealer_group_salons VALUES (?,?) ON CONFLICT DO NOTHING').bind(salon,groupName)),
      ...headAddresses.map(address=>db.prepare('INSERT INTO dealer_group_heads VALUES (?,?) ON CONFLICT(email) DO NOTHING').bind(address,groupName))
    ]);
    return json({ok:true});
  }
  if (path==='/api/group/remove' && user.role==='admin') {
    const {name,salon,email:headEmail}=body;
    if (!textValid(name)||(salon!==undefined&&!textValid(salon))||
        (headEmail!==undefined&&!textValid(headEmail))||(salon!==undefined&&headEmail!==undefined))
      return json({error:'Sprawdź grupę i wskazane przypisanie.'},400);
    if (salon!==undefined) {
      await db.prepare('DELETE FROM dealer_group_salons WHERE group_name=? AND salon=?').bind(name,salon).run();
      return json({ok:true});
    }
    const headScope=headEmail===undefined?'group_name=?':'group_name=? AND email=?';
    const args=headEmail===undefined?[name]:[name,headEmail];
    await db.batch([
      db.prepare(`INSERT INTO account_roles(person,role)
        SELECT a.id,'group' FROM accounts a
        JOIN dealer_group_heads h ON h.email=a.email
        WHERE h.email IN (SELECT email FROM dealer_group_heads WHERE ${headScope})
        AND NOT EXISTS (SELECT 1 FROM account_roles ar WHERE ar.person=a.id)`).bind(...args),
      db.prepare('DELETE FROM dealer_group_heads WHERE '+headScope).bind(...args),
      ...(headEmail===undefined?[
        db.prepare('DELETE FROM dealer_group_salons WHERE group_name=?').bind(name),
        db.prepare('DELETE FROM dealer_groups WHERE name=?').bind(name)
      ]:[])
    ]);
    return json({ok:true});
  }
  if (path==='/api/manager-salons' && user.role==='admin') {
    if (!Number.isSafeInteger(body.manager)||!Array.isArray(body.salons)||body.salons.length>100||!body.salons.every(textValid))
      return json({error:'Sprawdź kierownika i listę salonów.'},400);
    const manager=await db.prepare("SELECT id,salon FROM accounts WHERE id=? AND "+managers).bind(body.manager).first();
    if (!manager) return json({error:'Wybierz konto kierownika.'},400);
    const additional=[...new Set(body.salons.map(salon=>salon.trim()))].filter(salon=>salon!==manager.salon);
    if (!additional.every(salon=>managedSalons.has(salon))) return json({error:'Wybierz salony z listy.'},400);
    await db.batch([
      db.prepare('DELETE FROM manager_salons WHERE manager=?').bind(manager.id),
      ...additional.map(salon=>db.prepare('INSERT INTO manager_salons(manager,salon) VALUES (?,?)').bind(manager.id,salon))
    ]);
    return json({ok:true});
  }
  if (path==='/api/users/archive' && canManage) {
    if (!textValid(body.email)||typeof body.archived!=='boolean') return json({error:'Wybierz użytkownika.'},400);
    const address=body.email.trim().toLowerCase();
    const account=await db.prepare('SELECT role FROM accounts WHERE email=?').bind(address).first();
    if (address===env.sharedAdmin||address===email||account?.role==='admin') return json({error:'Nie można usunąć dostępu administratora.'},403);
    if (!owner&&!await canEditDelegated(address)) return json({error:'Nie możesz zarządzać tym kontem.'},403);
    const head=await db.prepare('SELECT 1 FROM dealer_group_heads WHERE email=?').bind(address).first();
    if (!account&&!head) return json({error:'Nie znaleziono użytkownika.'},404);
    const sql=body.archived?'INSERT INTO archived_users(email) VALUES (?) ON CONFLICT DO NOTHING':'DELETE FROM archived_users WHERE email=?';
    await db.batch([
      db.prepare(sql).bind(address),
      db.prepare('DELETE FROM lejek_sessions WHERE email=?').bind(address)
    ]);
    return json({ok:true});
  }
  if (path==='/api/users' && canManage) {
    if (body.includeInReports!==undefined&&typeof body.includeInReports!=='boolean')
      return json({error:'Nieprawidłowe ustawienie raportów.'},400);
    const {name,roles:chosen,salon,dealerGroup}=body;
    const needsSalon=Array.isArray(chosen)&&chosen.some(role=>role!=='group');
    if (!textValid(name)||!Array.isArray(chosen)||!chosen.length||chosen.length>3||new Set(chosen).size!==chosen.length||
        !chosen.every(role=>['group','manager','seller'].includes(role))||
        (needsSalon&&!textValid(salon))||!textValid(body.email)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
      return json({error:'Podaj dane użytkownika i zaznacz co najmniej jedną rolę. Dla kierownika lub handlowca wybierz salon.'},400);
    const address=body.email.trim().toLowerCase();
    const current=await db.prepare('SELECT id,role FROM accounts WHERE email=?').bind(address).first();
    if (address===env.sharedAdmin||address===email||current?.role==='admin') return json({error:'Tym formularzem nie można zmienić konta administratora.'},403);
    if (user.role!=='admin') {
      if (!needsSalon||!managedSalons.has(salon.trim())||chosen.some(role=>role==='group'||user.role==='manager'&&role!=='seller'))
        return json({error:'Nie możesz nadać tych ról w wybranym salonie.'},403);
      if (body.createOnly!==true&&!await canEditDelegated(address))
        return json({error:'Nie możesz zarządzać tym kontem.'},403);
    }
    if (body.createOnly===true&&(current||await db.prepare('SELECT 1 FROM dealer_group_heads WHERE email=?').bind(address).first()))
      return json({error:'Użytkownik już istnieje. Przejdź do sekcji Zarządzaj użytkownikami.'},409);
    if (needsSalon&&!managedSalons.has(salon.trim())) return json({error:'Wybierz salon z listy dodanych salonów.'},400);
    const group=chosen.includes('group')&&textValid(dealerGroup)?dealerGroup.trim():null;
    if (chosen.includes('group')&&(!group||!await db.prepare('SELECT 1 FROM dealer_groups WHERE name=?').bind(group).first()))
      return json({error:'Wybierz grupę dealerską.'},400);
    const fallback=chosen.includes('manager')?'manager':'seller';
    const password=body.password??'';
    if ((body.createOnly===true||!current||password!=='')&&!validAccountPassword(password))
      return json({error:'Hasło do Biegu Wyżej musi mieć od 12 do 128 znaków.'},400);
    const credentials=password?await env.passwordStatements(address,password):[];
    if (!owner&&body.createOnly!==true&&!await canEditDelegated(address))
      return json({error:'Nie możesz zarządzać tym kontem.'},403);
    const createOnly=body.createOnly===true;
    if (!owner&&createOnly&&await db.prepare('SELECT 1 FROM dealer_group_heads WHERE email=?').bind(address).first())
      return json({error:'Użytkownik już istnieje.'},409);
    const insertAccount='INSERT INTO accounts(email,name,salon,role) VALUES (?,?,?,?)';
    const updateAccount=' ON CONFLICT(email) DO UPDATE SET name=excluded.name,salon=excluded.salon,role=excluded.role';
    await db.batch([
      db.prepare(insertAccount+(createOnly?'':updateAccount))
        .bind(address,name.trim(),needsSalon?salon.trim():'',fallback),
      db.prepare('DELETE FROM account_roles WHERE person=(SELECT id FROM accounts WHERE email=?)').bind(address),
      ...chosen.map(role=>db.prepare('INSERT INTO account_roles SELECT id,? FROM accounts WHERE email=?').bind(role,address)),
      group?db.prepare('INSERT INTO dealer_group_heads VALUES (?,?) ON CONFLICT(email) DO UPDATE SET group_name=excluded.group_name').bind(address,group)
        :db.prepare('DELETE FROM dealer_group_heads WHERE email=?').bind(address),
      ...(!chosen.includes('manager')&&current?[db.prepare('DELETE FROM manager_salons WHERE manager=?').bind(current.id)]:[]),
      ...credentials,
      ...reportSetting(address,body.includeInReports)
    ]);
    return json({ok:true});
  }
  if (path==='/api/accounts' && user.role!=='seller') {
    if (body.includeInReports!==undefined&&typeof body.includeInReports!=='boolean')
      return json({error:'Nieprawidłowe ustawienie raportów.'},400);
    if (!textValid(body.name)||!textValid(body.salon)||!['manager','seller'].includes(body.role)||
        !textValid(body.email)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return json({error:'Uzupełnij poprawnie wszystkie pola.'},400);
    const targetEmail=body.email.trim().toLowerCase();
    const salon=body.salon.trim();
    if (targetEmail===env.sharedAdmin) return json({error:'Nie można zmienić konta administratora.'},403);
    if (!validAccountPassword(body.password))
      return json({error:'Hasło do Biegu Wyżej musi mieć od 12 do 128 znaków.'},400);
    if (user.role!=='admin'&&!managedSalons.has(salon) || user.role==='manager'&&body.role!=='seller')
      return json({error:'Nie możesz nadać tej roli w wybranym salonie.'},403);
    const current=await db.prepare('SELECT id,role,salon FROM accounts WHERE email=?').bind(targetEmail).first();
    if (current||await db.prepare('SELECT 1 FROM dealer_group_heads WHERE email=?').bind(targetEmail).first())
      return json({error:'Konto już istnieje. Zmiany wprowadź w sekcji Zarządzaj użytkownikami.'},409);
    const credentials=await env.passwordStatements(targetEmail,body.password);
    await db.batch([
      db.prepare('INSERT INTO accounts(email,name,salon,role) VALUES (?,?,?,?)')
        .bind(targetEmail,body.name.trim(),salon,body.role),
      ...credentials,
      ...reportSetting(targetEmail,body.includeInReports)
    ]);
    return json({ok:true});
  }
  if (path==='/api/brand' && canManage) {
    if (!textValid(body.salon)||!textValid(body.name)||typeof body.logo!=='string'||body.logo.length>56000||
        (body.logo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.logo))) return json({error:'Sprawdź nazwę i logo dealera.'},400);
    if (user.role!=='admin'&&!managedSalons.has(body.salon.trim())) return json({error:'Nie masz dostępu do salonu.'},403);
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
  if (path==='/api/meme-review' && canManage) {
    if (!Number.isSafeInteger(body.id)||typeof body.approve!=='boolean'||(body.approve&&!storyValid()))
      return json({error:'Sprawdź treść i decyzję.'},400);
    const change=body.approve
      ?await db.prepare("UPDATE meme_stories SET title=?,caption=?,status='approved' WHERE id=? AND status='pending'"+storyScope).bind(body.title.trim(),body.caption.trim(),body.id,...params).run()
      :await db.prepare("UPDATE meme_stories SET status='rejected' WHERE id=? AND status='pending'"+storyScope).bind(body.id,...params).run();
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
  if (!sellers.some(p=>p.id===body.person)) return json({error:'Brak uprawnień do tego handlowca.'},403);
  if (path==='/api/review' && user.role!=='seller') {
    if (!dayValid(body.day)||typeof body.approve!=='boolean') return json({error:'Sprawdź decyzję.'},400);
    const changed=await db.prepare("UPDATE daily_exceptions SET kind=? WHERE person=? AND day=? AND kind='pending'")
      .bind(body.approve?'zero':'rejected',body.person,body.day).run();
    return changed.meta.changes?json({ok:true}):json({error:'Zgłoszenie jest już rozliczone.'},409);
  }
  if (user.role==='group') return json({error:'Ten poziom dostępu służy do przeglądania wyników i zarządzania zespołem.'},403);
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
    if (!Array.isArray(rows)||!supportedDailySourceCounts.includes(rows.length)||!rows.every(row=>Array.isArray(row)&&dailyRowLengths.includes(row.length)&&row.every(countValid))) return json({error:'Wpisz co najmniej jedno wykonane działanie.'},400);
    rows[0][1]=rows[0][0];
    rows[0][2]=rows[0][0];
    if (!rows.some(row=>row.some(v=>v>0))) return json({error:'Wpisz co najmniej jedno wykonane działanie.'},400);
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
    if (!monthValid(month)||!Array.isArray(records)||!records.length||records.length>sourceCount||
        records.some(record=>!record||!Number.isInteger(record.source)||record.source<0||record.source>=sourceCount)||
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
