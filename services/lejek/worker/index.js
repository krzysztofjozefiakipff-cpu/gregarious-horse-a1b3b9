const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers});
const monthValid = month => typeof month==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const localDay = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date());
const dayValid = day => typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
const countValid = value => Number.isInteger(value) && value>=0 && value<=1000000;
const textValid = value => typeof value==='string' && value.trim().length>0 && value.length<=120;
const outsideArchive=(address,covered)=>`NOT EXISTS (SELECT 1 FROM archive_report_days archive
  WHERE archive.email=${address} AND ${covered})`;
const inReportDay=(address,day)=>outsideArchive(address,
  `archive.first_excluded_day<=${day} AND (archive.restored_day IS NULL OR ${day}<archive.restored_day)`);
const inReportMonth=(address,month)=>outsideArchive(address,
  `archive.first_excluded_day<=${month}||'-01'
    AND (archive.restored_day IS NULL OR date(${month}||'-01','+1 month')<=archive.restored_day)`);
const resultAddress=table=>`(SELECT email FROM accounts WHERE id=${table}.person)`;
const includedResult=(table,month)=>inReportMonth(resultAddress(table),month);
const includedDailyResult=inReportDay(resultAddress('daily_results'),'daily_results.day');
const validBrandLogo=logo=>typeof logo==='string'&&logo.length<=56000&&
  (logo===''||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo));
async function list(db,sql,...params) { return (await db.prepare(sql).bind(...params).all()).results; }

const sourceCount = 13;
const supportedDailySourceCounts = [12, sourceCount];
const dailyRowLengths = [9,10,11];
const validDailyRows=rows=>Array.isArray(rows)&&supportedDailySourceCounts.includes(rows.length)&&
  rows.every(row=>Array.isArray(row)&&dailyRowLengths.includes(row.length)&&row.every(countValid));
function dailyCounters(rows) {
  const totals=[1,3,4,5,7].map(index=>rows.reduce((sum,row)=>sum+row[index],0));
  return JSON.stringify([...totals,rows]);
}
const normalizeWalkIn=rows=>{rows[0][1]=rows[0][2]=rows[0][0];};
const insertDailyResult=`INSERT INTO daily_results (person,day,counters)
  SELECT ?1,?2,?3
  WHERE NOT EXISTS (SELECT 1 FROM daily_exceptions WHERE person=?1 AND day=?2 AND kind!='rejected')
    AND NOT EXISTS (SELECT 1 FROM work_calendar WHERE person=?1 AND day=?2 AND status='approved')`;
const workday = day => {
  const weekday=new Date(day+'T00:00:00Z').getUTCDay();
  return weekday!==0&&(weekday!==6||day>='2026-11-19');
};
function daysBetween(start,end) {
  const days=[];
  for (let at=Date.parse(start);at<=Date.parse(end);at+=86400000) {
    days.push(new Date(at).toISOString().slice(0,10));
  }
  return days;
}
const calendarKinds=['leave','saturday','other','training','sick'];
function calendarMonthDays(month) {
  const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
  return daysBetween(month+'-01',month+'-'+String(last).padStart(2,'0'));
}

async function calendarAdjustments(db,months,scope,...params) {
  const keys=months.map(()=>'?').join(',');
  const rows=await list(db,`SELECT person,day,kind FROM work_calendar
      WHERE status='approved' AND substr(day,1,7) IN (${keys}) AND ${scope}
    UNION ALL SELECT person,day,kind FROM daily_exceptions
      WHERE kind='leave' AND substr(day,1,7) IN (${keys}) AND ${scope}`,...months,...params,...months,...params);
  const totals=new Map();
  for (const {person,day,kind} of rows) {
    if (!workday(day)) continue;
    const month=day.slice(0,7);
    const key=person+'/'+month;
    if (!totals.has(key)) totals.set(key,{workdays:calendarMonthDays(month).filter(workday).length,absentDays:0});
    const offset=totals.get(key);
    if (kind==='leave'||kind==='sick') offset.absentDays++;
    else if (kind==='saturday'||kind==='other') offset.workdays--;
  }
  return Object.fromEntries([...totals].filter(([,value])=>value.absentDays>0));
}

async function tracking(db,person,readOnly=false) {
  if (!readOnly) await db.prepare('INSERT INTO daily_tracking VALUES (?,?) ON CONFLICT DO NOTHING').bind(person,localDay()).run();
  const start_day=(await db.prepare('SELECT start_day FROM daily_tracking WHERE person=?').bind(person).first())?.start_day??localDay();
  const saved=new Set((await list(db,'SELECT day FROM daily_results WHERE person=? AND day>=?',person,start_day)).map(row=>row.day));
  const exceptions=Object.fromEntries((await list(db,'SELECT day,kind FROM daily_exceptions WHERE person=? AND day>=?',person,start_day)).map(row=>[row.day,row.kind]));
  const scheduled=await list(db,"SELECT day FROM work_calendar WHERE person=? AND status='approved' AND day>=?",person,start_day);
  for (const {day} of scheduled) exceptions[day]='leave';
  const days=daysBetween(start_day,localDay()).filter(workday);
  const closed=day=>saved.has(day)||['leave','training','zero'].includes(exceptions[day]);
  const drafts=await list(db,'SELECT day FROM daily_drafts WHERE person=? AND day<?',person,localDay());
  const missing=[...new Set([...days.filter(day=>day<localDay()),...drafts.map(row=>row.day)])]
    .filter(day=>!closed(day)).sort();
  const month=days.filter(day=>day.startsWith(localDay().slice(0,7))&&!['leave','training'].includes(exceptions[day]));
  return {missing,exceptions,progress:[month.filter(closed).length,month.length]};
}

const memeKey=([title,,,key])=>key??title;
async function memeFor(db,user,day,readOnly=false) {
  const published=await list(db,"SELECT id,title,caption FROM meme_stories WHERE status='approved'");
  const pool=memes.concat(published.map(({id,title,caption})=>[title,'💬',caption,'story:'+id]));
  if (user.role!=='seller') return pool[Math.floor(Math.random()*pool.length)].slice(0,3);
  const memeTitles=JSON.stringify(pool.map(memeKey));
  if (!readOnly) await db.prepare(`
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
  const skills=[
    ['Pierwszy kontakt i powitanie', /powita|przywita|pierwsz.{0,12}kontakt|oddzwo|czas reakcji|przyjęcie klienta/iu],
    ['Rozpoznanie potrzeb klienta', /potrzeb|oczekiwa|budżet|pytani|użytkowani|kwalifikac/iu],
    ['Prezentacja samochodu', /wyposażeni|prezentac|parametr|zasięg|napęd|spalani|korzyś|bagażnik|ładowani|gwarancj/iu],
    ['Jazda próbna', /jazd.{0,7}próbn|trasa testow|samochód testow/iu],
    ['Oferta i finansowanie', /ofert|finansowan|leasing|kredyt|ubezpiecze|rabat|wycen|odkup/iu],
    ['Kontakt po spotkaniu', /follow[ -]?up|ponown.{0,10}kontakt|po spotkaniu|po wizycie|po wysłaniu|następn.{0,8}krok/iu],
    ['Obiekcje i domknięcie sprzedaży', /obiekcj|zastrzeże|negocjac|domkni|zamówieni|podpisani|decyzj.{0,12}klient/iu],
    ['Wydanie auta i obsługa posprzedażowa', /wydani.{0,12}(aut|pojazd|samoch)|po zakupie|po odbiorze|posprzedaż|opini.{0,10}google|serwis/iu],
    ['Standard pracy w salonie', /procedur|dokument|zgod|crm|rejestr|faktur|termin|salon|klient/iu]
  ];
  const actionable=/należy|powinien|powinna|trzeba|wymaga|obowiązk|standard|zapytaj|zaproponuj|przedstaw|wyjaśnij|potwierdź|ustal|sprawdź|przekaż|zaprezentuj/iu;
  const gap=/\b(?:nie|brak|pominięto|niewykonano)\b|niezgodnoś|pominął|pominęła/iu;
  const metadata=/^(?:spis treści|strona\s+\d|copyright|poufne\b|autor\s*:|data\s*:|wersja\s*:)|\.{3,}\s*\d+\s*$/iu;
  const segmenter=new Intl.Segmenter('pl',{granularity:'sentence'});
  const topics=skills.map(()=>[]);
  const seen=new Set();
  for (const block of text.replaceAll('\r','').split(/\n[ \t]*\n|\f+/)) {
    const lines=block.split('\n').map(line=>line.trim()).filter(line=>line&&!metadata.test(line));
    const heading=lines.length>1&&lines[0].length<=100&&!/[.!?]$/.test(lines[0])&&!actionable.test(lines[0])
      ?lines.shift():'';
    const segments=lines
      .flatMap(part=>Array.from(segmenter.segment(part),({segment})=>segment));
    for (const segment of segments) {
      const fact=segment.replace(/\s+/g,' ').replace(/^(?:[•·▪]|- |\d+[.)] )\s*/u,'').trim();
      if (fact.length<24||fact.length>600||metadata.test(fact)) continue;
      const key=fact.toLocaleLowerCase('pl').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      if (seen.has(key)) continue;
      const index=skills.findIndex(([,pattern])=>pattern.test(fact));
      const fallback=heading?skills.findIndex(([,pattern])=>pattern.test(heading)):-1;
      const topic=index>=0?index:fallback;
      if (topic<0) continue;
      seen.add(key);
      const priority=(gap.test(fact)?4:0)+(actionable.test(fact)?3:0)+Number(index>=0);
      topics[topic].push({fact,priority});
    }
  }
  return topics.flatMap((items,index)=>items.map(({fact,priority})=>{
    const [title,pattern]=skills[index];
    const match=fact.match(/\b\d+(?:[,.]\d+)?\s*(?:%|km\b|kWh\b|godzin\p{L}*|minut\p{L}*|dni\b|zł\b)/iu)
      ??fact.match(pattern)??fact.match(/\p{L}{6,}/u);
    if (!match) return null;
    const before=fact.slice(0,match.index);
    const after=fact.slice(match.index+match[0].length);
    const question=before.replace(/\p{L}+$/u,'')+'[…]'+after.replace(/^\p{L}+/u,'');
    return {title,question,topic:fact,remember:'Przypomnij sobie tę zasadę przed następną rozmową z klientem.',priority};
  })).filter(Boolean).sort((a,b)=>b.priority-a.priority)
    .map(({priority,...lesson})=>lesson);
}
const lessonDay=value=>Date.parse(value+'T00:00:00Z')/86400000;

function validAccountPassword(password) {
  return typeof password === 'string' && [...password].length >= 8 && password.length <= 128;
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
  const viewer = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!viewer || !request.headers.get('oai-authenticated-user-id')) return json({error:'Zaloguj się do konta CARVAMO.'},401);
  const verifiedAdmin=request.headers.get('x-lejek-verified-admin')==='1';
  const preview=url.searchParams.has('podglad');
  const target=url.searchParams.get('podglad')?.trim().toLowerCase();
  if (preview&&(!verifiedAdmin||request.method!=='GET'))
    return json({error:'Podgląd konta jest dostępny tylko dla administratora i służy do odczytu.'},403);
  if (preview&&!textValid(target)) return json({error:'Wybierz konto do podglądu.'},400);
  const owner=verifiedAdmin&&!preview;
  const email=preview?target:viewer;
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
  if (requested&&!roles.includes(requested)&&(preview||request.method!=='GET')) return json({error:'Nie masz już wybranej roli. Odśwież widok.'},403);
  const role=roles.includes(requested)?requested:roles[0];
  if (managementPage) {
    return role==='seller'
      ? new Response(null,{status:303,headers:{...headers,Location:'/daily.html'}})
      : serveAsset(path,request.method);
  }

  const user={...assigned,role,group:head?.group_name};
  const signedInAs=assigned?.name?.trim()||email;
  const previewUser=preview?{name:signedInAs,viewer}:null;
  const invitedNewAccount=async(address,roles)=>{
    const sent=env.inviteReady&&await env.sendInvitation(address,signedInAs,roles).catch(()=>false);
    return json({ok:true,invitation:sent?'sent':'failed'});
  };

  const accountRole=(table,role)=>`(EXISTS (SELECT 1 FROM account_roles ar WHERE ar.person=${table}.id AND ar.role='${role}')
    OR (${table}.role='${role}' AND NOT EXISTS (SELECT 1 FROM account_roles ar WHERE ar.person=${table}.id)
      AND NOT EXISTS (SELECT 1 FROM dealer_group_heads h WHERE h.email=${table}.email)))`;
  const eligibleForPlans=table=>`(NOT ${accountRole(table,'manager')}
    AND NOT EXISTS (SELECT 1 FROM dealer_group_heads h WHERE h.email=${table}.email)
    AND NOT EXISTS (SELECT 1 FROM account_roles ar WHERE ar.person=${table}.id AND ar.role='group'))`;
  const members=accountRole('accounts','seller');
  const managers=accountRole('accounts','manager');
  const groupSalon='salon IN (SELECT salon FROM dealer_group_salons WHERE group_name=?)';
  const filters={admin:'',group:' AND '+groupSalon,manager:' AND (salon=? OR salon IN (SELECT salon FROM manager_salons WHERE manager=?))',seller:' AND id=?'};
  const params=user.role==='admin'?[]:user.role==='group'?[user.group]:user.role==='manager'?[user.salon,user.id]:[user.id];
  const accountStatuses=`CASE WHEN EXISTS (SELECT 1 FROM archived_users au WHERE au.email=accounts.email) THEN 'inactive'
         WHEN EXISTS (SELECT 1 FROM lejek_credentials lc WHERE lc.email=accounts.email) THEN 'active'
         ELSE 'pending' END AS accountStatus,
    (SELECT date(p.first_excluded_day,'-1 day') FROM archive_report_days p
      WHERE p.email=accounts.email AND p.restored_day IS NULL) AS reportThroughDay`;
  const sellerQuery='SELECT id,name,salon,'+eligibleForPlans('accounts')+' AS planEligible,'+accountStatuses+' FROM accounts WHERE '+members+filters[user.role];
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
  const planScope=scope+' AND person IN (SELECT id FROM accounts WHERE '+eligibleForPlans('accounts')+')';
  const storyScope=user.role==='admin'?'':' AND '+scope;
  const managesSalonPlans=['group','manager'].includes(user.role);
  const sellerTargets=async (salon,month)=>{
    const rows=await list(db,`
      SELECT a.id,a.name,p.target AS orders,r.target AS reviews,f.targets,k.version,sp.targets AS source_targets,profile.shares AS source_profile,
        EXISTS (SELECT 1 FROM archived_users x WHERE x.email=a.email) AS archived
      FROM accounts a
      LEFT JOIN plans p ON p.person=a.id AND p.month=?
      LEFT JOIN review_plans r ON r.person=a.id AND r.month=?
      LEFT JOIN funnel_plans f ON f.person=a.id AND f.month=?
      LEFT JOIN seller_plan_approvals k ON k.person=a.id AND k.month=?
      LEFT JOIN seller_source_plans sp ON sp.person=a.id AND sp.month=?
      LEFT JOIN seller_source_profiles profile ON profile.person=a.id
      WHERE a.salon=? AND ${accountRole('a','seller')} AND ${eligibleForPlans('a')}
        AND ${inReportMonth('a.email','?7')}
      ORDER BY a.id
    `,month,month,month,month,month,salon,month);
    return rows.map(row=>{
      const funnel=JSON.parse(row.targets??'[]');
      const targets=[row.orders,funnel[7]??null,funnel[6]??null,row.reviews];
      const complete=targets.every(countValid);
      const profile=JSON.parse(row.source_profile??'null');
      return {id:row.id,name:row.name,archived:Boolean(row.archived),targets,sourceProfile:profile?.shares??profile,sourceProfileTypes:profile?.types??[],sourceTargets:JSON.parse(row.source_targets??'null'),funnelTargets:Array.from({length:6},(_,index)=>funnel[index]??null),complete,version:complete?row.version:null};
    });
  };
  const salonContributors=(salon,month,historical=false)=>list(db,`SELECT a.id,a.name FROM accounts a
    WHERE a.salon=? AND ${accountRole('a','seller')} AND NOT ${eligibleForPlans('a')}
      AND ${inReportMonth('a.email','?2')}
      ${historical?'':'AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email=a.email)'}
    ORDER BY a.name,a.id`,salon,month);
  const approvalSet=(team,hasContributors)=>(team.length||hasContributors)&&team.every(person=>person.version)
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
    const historyView=url.searchParams.get('history')==='1';
    const historicalMonth=month<localDay().slice(0,7);
    const sellerById=new Map(sellers.map(seller=>[seller.id,seller]));
    const archivedActivity=new Map();
    const sellerSalons=new Map(sellers.map(seller=>[seller.id,seller.salon]));
    const totals=new Map(salons.map(({salon})=>[salon,[0,0,0,0]]));
    const daily=await list(db,'SELECT person,counters FROM daily_results WHERE substr(day,1,7)=? AND day<=? AND '+scope+' AND '+includedDailyResult,month,localDay(),...params);
    const metricIndexes=[7,8,10,9];
    for (const row of daily) {
      const total=totals.get(sellerSalons.get(row.person));
      if (!total) continue;
      const counters=JSON.parse(row.counters);
      const counts=[counters[4]??0,0,0,0];
      for (const source of Array.isArray(counters[5])?counters[5]:[]) {
        for (let i=1;i<metricIndexes.length;i++) counts[i]+=source[metricIndexes[i]]??0;
      }
      counts.forEach((value,i)=>{total[i]+=value;});
      const seller=sellerById.get(row.person);
      if (historyView&&seller.accountStatus==='inactive') {
        if (!archivedActivity.has(row.person)) {
          archivedActivity.set(row.person,{name:seller.name,salon:seller.salon,
            through:seller.reportThroughDay,actuals:[0,0,0,0]});
        }
        counts.forEach((value,i)=>{archivedActivity.get(row.person).actuals[i]+=value;});
      }
    }
    const historicalRates=new Map();
    if (user.role==='manager') {
      const cutoff=[month,localDay().slice(0,7)].sort()[0];
      const history=await list(db,`SELECT person,counters FROM daily_results
        WHERE day>=date(?||'-01','-3 months') AND day<?||'-01' AND `+scope+' AND '+includedDailyResult,cutoff,cutoff,...params);
      for (const row of history) {
        const salon=sellerSalons.get(row.person);
        const matrix=JSON.parse(row.counters)[5];
        if (!salon||!Array.isArray(matrix)) continue;
        if (!historicalRates.has(salon)) historicalRates.set(salon,Array.from({length:sourceCount},()=>({leads:0,orders:0})));
        const totals=historicalRates.get(salon);
        matrix.slice(0,sourceCount).forEach((source,index)=>{
          totals[index].leads+=source[0]??0;
          totals[index].orders+=source[7]??0;
        });
      }
    }
    const adjustments=await calendarAdjustments(db,[month],scope,...params);
    const plans=[];
    for (const {salon} of salons) {
      const storedTeam=await sellerTargets(salon,month);
      const team=storedTeam.filter(person=>!person.archived);
      const planTeam=historicalMonth?storedTeam.filter(person=>
        !person.archived||sellerById.get(person.id)?.reportThroughDay?.slice(0,7)>month):team;
      const contributors=await salonContributors(salon,month);
      const planContributors=historicalMonth?await salonContributors(salon,month,true):contributors;
      const approvals=approvalSet(team,contributors.length);
      const historicalApprovals=historicalMonth?approvalSet(planTeam,planContributors.length):null;
      const automatic=[0,0,0,0];
      for (const person of planTeam) person.targets.forEach((target,index)=>{
        automatic[index]+=effectiveCalendarTarget(target,adjustments[person.id+'/'+month])??0;
      });
      const saved=await db.prepare(`SELECT p.manager,p.targets,k.approvals FROM salon_plans p
        LEFT JOIN salon_plan_approval_sets k USING (salon,month) WHERE p.salon=? AND p.month=?`).bind(salon,month).first();
      const direct=await db.prepare(`SELECT p.targets,locked.salon IS NOT NULL AS protected
        FROM direct_salon_plans p LEFT JOIN protected_direct_salon_plans locked USING (salon,month)
        WHERE p.salon=? AND p.month=?`).bind(salon,month).first();
      const change=direct&&await db.prepare(`SELECT r.id,r.status,r.proposed_targets,r.reason,a.name AS requester
        FROM salon_plan_change_requests r JOIN accounts a ON a.id=r.requester
        WHERE r.salon=? AND r.month=? ORDER BY r.id DESC LIMIT 1`).bind(salon,month).first();
      const managers=await assignedManagers(salon);
      const override=Boolean(saved?.approvals&&(saved.approvals===approvals||saved.approvals===historicalApprovals));
      const manual=direct??(override?saved:null);
      const history=historicalRates.get(salon)??[];
      const sourceRates=history.map(({leads,orders},index)=>calibratedSourceRate(index,leads,orders));
      const sourceHistoryRates=history.map(({leads,orders})=>sourceHistoryRate(leads,orders));
      plans.push({salon,automatic,sourceRates,sourceHistoryRates,configured:automatic.map((_,index)=>Boolean(manual)||planTeam.some(person=>person.targets[index]!=null)),targets:manual?JSON.parse(manual.targets):automatic,override,direct:Boolean(direct),protected:Boolean(direct?.protected),
        change:change?{id:change.id,status:change.status,targets:JSON.parse(change.proposed_targets),reason:change.reason,requester:change.requester}:null,
        contributors,actuals:totals.get(salon),editable:Boolean(approvals&&managers.length),managers,
        manager:managers.find(manager=>manager.id===saved?.manager)?.id??null,
        team:team.map(({version,...person})=>({...person,approved:Boolean(version),absenceAdjustment:adjustments[person.id+'/'+month]??null}))});
    }
    const pendingChanges=user.role==='group'?await list(db,`SELECT salon,month FROM salon_plan_change_requests
      WHERE status='pending' AND ${groupSalon} ORDER BY month,salon`,user.group):[];
    return json({plans,pendingChanges,...(historyView?{archivedActivity:[...archivedActivity.values()]}:{})});
  }
  if (request.method==='GET' && path==='/api/lesson-packs') {
    const salon=url.searchParams.get('salon');
    if (!canManage||!managedSalons.has(salon)) return json({error:'Brak dostępu do salonu.'},403);
    const id=url.searchParams.get('id');
    if (id!==null) {
      const pack=await db.prepare('SELECT lessons FROM lesson_packs WHERE salon=? AND id=?').bind(salon,id).first();
      return pack?json({lessons:JSON.parse(pack.lessons)}):json({error:'Nie znaleziono paczki.'},404);
    }
    const packs=await list(db,`SELECT id,name,active,json_array_length(lessons) AS count
      FROM lesson_packs WHERE salon=? ORDER BY id DESC`,salon);
    return json({packs});
  }
  if (request.method==='GET' && path==='/api/work-calendar') {
    const person=Number(url.searchParams.get('person'));
    const month=url.searchParams.get('month');
    if (!['seller','manager','group','admin'].includes(user.role)||!sellers.some(seller=>seller.id===person))
      return json({error:'Brak dostępu do kalendarza.'},403);
    if (!monthValid(month)) return json({error:'Wybierz poprawny miesiąc.'},400);
    const entries=await list(db,`SELECT c.day,c.kind,c.status,NULL AS reason FROM work_calendar c WHERE c.person=?1 AND substr(c.day,1,7)=?2
      AND NOT EXISTS (SELECT 1 FROM daily_exceptions e WHERE e.person=c.person AND e.day=c.day AND e.kind='pending')
      UNION ALL SELECT e.day,CASE WHEN e.kind IN ('leave','training') THEN e.kind ELSE 'noActivity' END,
        CASE e.kind WHEN 'pending' THEN 'pending' WHEN 'rejected' THEN 'rejected' WHEN 'zero' THEN 'approved' ELSE 'recorded' END,
        e.reason FROM daily_exceptions e WHERE e.person=?1 AND substr(e.day,1,7)=?2
          AND (e.kind='pending' OR NOT EXISTS (SELECT 1 FROM work_calendar c WHERE c.person=e.person AND c.day=e.day))
      ORDER BY day`,person,month);
    return json({entries:entries.map(({reason,...entry})=>reason?{...entry,reason}:entry),automaticDays:calendarMonthDays(month).filter(day=>!workday(day))});
  }
  if (request.method==='GET' && path==='/api/daily/reopen') {
    const person=Number(url.searchParams.get('person'));
    if (user.role!=='manager'||!sellers.some(seller=>seller.id===person&&seller.accountStatus!=='inactive'))
      return json({error:'Brak uprawnień do odblokowania dni tego handlowca.'},403);
    const days=await list(db,`SELECT day FROM daily_results
      WHERE person=? AND day<=? AND json_type(counters,'$[5]')='array' ORDER BY day DESC`,person,localDay());
    return json({days:days.map(row=>row.day)});
  }
  if (request.method==='GET' && ['/api/state','/api/daily'].includes(path)) {
    const month=url.searchParams.get('month');
    if (!monthValid(month)) return json({error:'Wybierz poprawny miesiąc.'},400);
    const period=url.searchParams.get('period');
    if (period!==null&&(path!=='/api/daily'||user.role!=='seller'||!['month','quarter','year'].includes(period)))
      return json({error:'Wybierz poprawny okres.'},400);
    const first=period==='year'?1:period==='month'?Number(month.slice(5)):Math.floor((Number(month.slice(5))-1)/3)*3+1;
    const months=Array.from({length:period==='year'?12:period==='month'?1:3},(_,i)=>month.slice(0,5)+String(first+i).padStart(2,'0'));
    const placeholders=months.map(()=>'?').join(',');
    const reviewPlans=await list(db,'SELECT person,month,target FROM review_plans WHERE month IN ('+placeholders+') AND '+planScope+' AND '+includedResult('review_plans','review_plans.month'),...months,...params);
    const funnelPlans=await list(db,'SELECT person,month,targets FROM funnel_plans WHERE month IN ('+placeholders+') AND '+planScope+' AND '+includedResult('funnel_plans','funnel_plans.month'),...months,...params);
    const absenceAdjustments=await calendarAdjustments(db,months,scope,...params);
    const groupName=user.role==='group'?user.group:user.role==='manager'
      ?(await db.prepare('SELECT group_name FROM dealer_group_salons WHERE salon=?').bind(user.salon).first())?.group_name:null;
    let groupBrand=null;
    if (groupName) {
      const saved=await db.prepare('SELECT logo FROM dealer_group_brand WHERE group_name=?').bind(groupName).first();
      const logos=saved?[]:await list(db,`SELECT DISTINCT b.logo FROM dealer_brand b JOIN dealer_group_salons gs USING(salon)
        WHERE gs.group_name=? AND b.logo<>'' LIMIT 2`,groupName);
      groupBrand={name:groupName,logo:saved?.logo??(logos.length===1?logos[0].logo:'')};
    }
    if (path==='/api/daily') {
      const daily = await list(db,'SELECT person,day,counters FROM daily_results WHERE substr(day,1,7) IN ('+placeholders+') AND '+scope+' AND '+includedDailyResult,...months,...params);
      const plans = await list(db,'SELECT person,month,target FROM plans WHERE month IN ('+placeholders+') AND '+planScope+' AND '+includedResult('plans','plans.month'),...months,...params);
      if (period&&months[0]>localDay().slice(0,7)&&!plans.length&&!reviewPlans.length&&
          !funnelPlans.some(row=>JSON.parse(row.targets).some(target=>target!=null)))
        return json({error:'Kierownik nie ustawił planu na ten okres.'},404);
      const availableMonths=user.role==='seller'&&!period?await list(db,`SELECT month FROM plans WHERE person=?1
        UNION SELECT month FROM review_plans WHERE person=?1
        UNION SELECT month FROM funnel_plans WHERE person=?1 AND EXISTS (SELECT 1 FROM json_each(targets) WHERE value IS NOT NULL)
        UNION SELECT substr(day,1,7) AS month FROM daily_results WHERE person=?1
        ORDER BY month`,user.id):[];
      const sourcePlans=user.role==='seller'?await list(db,'SELECT month,targets FROM seller_source_plans WHERE month IN ('+placeholders+') AND '+planScope+' AND '+includedResult('seller_source_plans','seller_source_plans.month'),...months,...params):[];
      const personal=user.role==='seller'?await tracking(db,user.id,preview):null;
      if (personal) {
        const drafts=await list(db,'SELECT day,rows FROM daily_drafts WHERE person=? AND day IN (?,?)',
          user.id,localDay(),personal.missing[0]??null);
        personal.drafts=Object.fromEntries(drafts.map(({day,rows})=>[day,JSON.parse(rows)]));
      }
      const brand=personal?await db.prepare('SELECT name,logo FROM dealer_brand WHERE salon=?').bind(user.salon).first():null;
      const calendar=await list(db,`SELECT person,day,kind,status FROM work_calendar
        WHERE (substr(day,1,7) IN (${placeholders}) OR status='pending') AND ${scope}
        UNION ALL SELECT person,day,kind,'approved' FROM daily_exceptions
        WHERE substr(day,1,7) IN (${placeholders}) AND kind IN ('leave','training') AND ${scope}
        ORDER BY day`,...months,...params,...months,...params);
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
      const meme=sidebarMode==='meme'?await memeFor(db,user,today,preview):null;
      const assignedGif=trending&&personal?await db.prepare('SELECT gif_id FROM giphy_daily WHERE person=? AND day=?').bind(user.id,today).first():null;
      const giphy=trending?{key:env.GIPHY_API_KEY,id:assignedGif?.gif_id??null}:null;
      const memeVotes=personal&&sidebarMode==='meme'
        ?Object.fromEntries((await list(db,'SELECT source,vote FROM meme_votes WHERE person=? AND day=?',user.id,today)).map(row=>[row.source,row.vote]))
        :{};
      if (personal&&meme&&memeVotes.local==null&&await db.prepare('SELECT 1 FROM meme_reactions WHERE person=? AND day=?').bind(user.id,today).first()) {
        memeVotes.local=1;
      }
      const memeStories=canManage?await list(db,"SELECT id,title,caption FROM meme_stories WHERE status='pending'"+storyScope+' ORDER BY id LIMIT 50',...params):[];
      const packs=personal?await list(db,`SELECT published_day,lessons FROM lesson_packs
        WHERE salon=? AND active=1 ORDER BY published_day,id`,user.salon):[];
      const lessons=packs.flatMap(pack=>JSON.parse(pack.lessons));
      const position=lessons.length?Math.max(0,lessonDay(today)-lessonDay(packs[0].published_day))%lessons.length:0;
      const lesson=lessons[position]??null;
      let ranking=null;
      if (personal) {
        const group=await db.prepare('SELECT group_name FROM dealer_group_salons WHERE salon=?').bind(user.salon).first();
        const rankingStart=period?months[0]:today.slice(0,7);
        const rankingEnd=period?months.at(-1):rankingStart;
        const candidates=await list(db,`SELECT a.id,a.name,a.salon,p.monthly_targets,
          COALESCE((SELECT SUM(json_extract(d.counters,'$[4]')) FROM daily_results d
            WHERE d.person=a.id AND substr(d.day,1,7) BETWEEN ?1 AND ?2 AND d.day<=?3
              AND ${inReportDay('a.email','d.day')}),0) AS orders
          FROM accounts a JOIN (
            SELECT person,json_group_array(json_array(month,target)) AS monthly_targets FROM plans WHERE month BETWEEN ?1 AND ?2
              AND ${includedResult('plans','plans.month')}
            GROUP BY person HAVING SUM(target)>0
          ) p ON p.person=a.id
          WHERE ${accountRole('a','seller')} AND ${eligibleForPlans('a')}
          AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email=a.email)
          AND (a.salon=?4 OR a.salon IN (SELECT salon FROM dealer_group_salons WHERE group_name=?5))`,
          rankingStart,rankingEnd,today,user.salon,group?.group_name??null);
        const rankingAdjustments=await calendarAdjustments(db,period?months:[rankingStart],
          'person IN (SELECT value FROM json_each(?))',JSON.stringify(candidates.map(row=>row.id)));
        const ranks=candidates.map(row=>({...row,target:JSON.parse(row.monthly_targets).reduce((sum,[month,target])=>
          sum+effectiveCalendarTarget(target,rankingAdjustments[row.id+'/'+month]),0)})).filter(row=>row.target>0);
        ranks.sort((a,b)=>b.orders*a.target-a.orders*b.target || b.orders-a.orders || String(a.id).localeCompare(String(b.id)));
        const salonRanks=ranks.filter(row=>row.salon===user.salon);
        const positionIn=rows=>{
          const index=rows.findIndex(row=>row.id===user.id);
          return index<0?null:{place:index+1,total:rows.length};
        };
        const self=ranks.find(row=>row.id===user.id);
        ranking={
          salon:positionIn(salonRanks),
          group:group?positionIn(ranks):null,
          groupName:group?.group_name??null,
          percent:self?self.orders/self.target*100:null,
          podium:(group?ranks:salonRanks).slice(0,3).map((row,index)=>({
            place:index+1, name:row.name?.trim().split(/\s+/)[0]||'Handlowiec',
            salon:row.salon, self:row.id===user.id
          }))
        };
      }
      const groups=user.role==='admin'?await list(db,`SELECT g.name,
        (SELECT group_concat(salon, char(10)) FROM dealer_group_salons WHERE group_name=g.name) AS salons,
        (SELECT group_concat(email, char(10)) FROM dealer_group_heads h WHERE group_name=g.name
          AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email=h.email)) AS heads
        FROM dealer_groups g ORDER BY g.name`):[];
      const managerAssignments=user.role==='admin'?await list(db,`SELECT a.id,a.name,a.salon,m.salon AS additional
        FROM accounts a LEFT JOIN manager_salons m ON m.manager=a.id
        WHERE ${accountRole('a','manager')}
          AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email=a.email)
        ORDER BY a.name,a.id,m.salon`):[];
      const users=!canManage?[]:await list(db,`SELECT a.email,a.name,a.salon,h.group_name AS dealerGroup,
        COALESCE((SELECT group_concat(ar.role) FROM account_roles ar WHERE ar.person=a.id),CASE WHEN h.email IS NULL THEN a.role ELSE 'group' END) AS roles, EXISTS (SELECT 1 FROM archived_users WHERE email=a.email) AS archived,
        contact.first_name AS firstName,contact.last_name AS lastName,contact.phone
        FROM accounts a LEFT JOIN dealer_group_heads h ON h.email=a.email
        LEFT JOIN account_contact_details contact ON contact.person=a.id WHERE `+
        (owner?`a.role<>'admin'
          UNION ALL SELECT h.email,h.email,'',h.group_name,'group',EXISTS (SELECT 1 FROM archived_users WHERE email=h.email),NULL,NULL,NULL FROM dealer_group_heads h
          WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.email=h.email)`:delegatedWhere)+
        ' ORDER BY 2,1',...(owner?[]:[email,...delegatedParams]));
      return json({signedInAs,previewUser,users,roles,managerAssignments,groupBrand,role:user.role,dealerGroup:user.role==='group'?user.group:null,sellers,plans,reviewPlans,funnelPlans,sourcePlans,daily,teamDay,previousDaily,personal,availableMonths:availableMonths.map(row=>row.month),calendar,absenceAdjustments,brand,salons,groups,ranking,approvals,cause,sidebarMode,meme,memeVotes,memeStories,giphy,giphyAvailable:Boolean(env.GIPHY_API_KEY),lesson,salon:user.salon??null,today});
    }
    const [results,plans,accounts]=await Promise.all([
      list(db,'SELECT person,month,source,counters FROM results WHERE month IN ('+placeholders+') AND '+scope+' AND '+includedResult('results','results.month'),...months,...params),
      list(db,'SELECT person,month,target FROM plans WHERE month IN ('+placeholders+') AND '+planScope+' AND '+includedResult('plans','plans.month'),...months,...params),
      user.role==='seller'?[]:list(db,`SELECT id,email,name,salon,CASE WHEN ${user.role==='manager'?'0':managers} THEN 'manager' ELSE 'seller' END AS role, ${accountStatuses}
        FROM accounts WHERE ${user.role==='manager'?members:'('+members+' OR '+managers+')'}${filters[user.role]} ORDER BY id`,...params),
    ]);
    const sourcePlans=await list(db,'SELECT person,month,targets FROM seller_source_plans WHERE month IN ('+placeholders+') AND '+planScope+' AND '+includedResult('seller_source_plans','seller_source_plans.month'),...months,...params);
    const membership=await list(db,`SELECT a.id,m.value AS month FROM accounts a CROSS JOIN json_each(?) m
      WHERE ${inReportMonth('a.email','m.value')}
        AND a.id IN (SELECT id FROM accounts WHERE ${members}${filters[user.role]})`,JSON.stringify(months),...params);
    const reportMonths=new Map();
    for (const {id,month} of membership) {
      if (!reportMonths.has(id)) reportMonths.set(id,[]);
      reportMonths.get(id).push(month);
    }
    const reportSellers=sellers.map(seller=>({...seller,reportMonths:reportMonths.get(seller.id)??[]}));
    return json({signedInAs,previewUser,roles,role:user.role,groupBrand,sourcePlans,sellers:reportSellers,results,plans,reviewPlans,funnelPlans,accounts,salons,absenceAdjustments});
  }
  if (request.method!=='POST' || request.headers.get('Origin')!==url.origin ||
      !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Niedozwolone żądanie.'},403);
  let body;
  try {body=await request.json();} catch {return json({error:'Nieprawidłowy formularz.'},400);}
  if (!body || typeof body!=='object') return json({error:'Nieprawidłowy formularz.'},400);
  if (['/api/salon-plans','/api/salon-plans/approve','/api/salon-plans/seller','/api/salon-plans/source-profile','/api/salon-plans/direct','/api/salon-plans/request-change','/api/salon-plans/decide-change'].includes(path)) {
    if (!managesSalonPlans) return json({error:'Brak dostępu do planów salonu.'},403);
    const {salon,month,manager,targets,person}=body;
    if (!monthValid(month)||!managedSalons.has(salon)) return json({error:'Wybierz miesiąc i salon w swoim zakresie.'},403);
    const fourTargets=()=>Array.isArray(targets)&&targets.length===4&&targets.every(n=>Number.isSafeInteger(n)&&n>=0);
    const recordOwner=role=>db.prepare(`INSERT INTO direct_salon_plan_owners (salon,month,role)
      SELECT ?,?,? WHERE changes()>0 ON CONFLICT(salon,month) DO UPDATE SET role=excluded.role`).bind(salon,month,role);
    if (path==='/api/salon-plans/direct') {
      if (!fourTargets()) return json({error:'Wpisz cztery cele salonu jako liczby całkowite od 0.'},400);
      const encoded=JSON.stringify(targets);
      const [saved]=await db.batch([
        db.prepare(`INSERT INTO direct_salon_plans (salon,month,targets)
          SELECT ?1,?2,?3 WHERE ?4='group' OR NOT EXISTS (
            SELECT 1 FROM protected_direct_salon_plans WHERE salon=?1 AND month=?2
          ) ON CONFLICT(salon,month) DO UPDATE SET targets=excluded.targets`).bind(salon,month,encoded,user.role),
        recordOwner(user.role),
        db.prepare(`UPDATE salon_plan_change_requests SET status='superseded'
          WHERE salon=? AND month=? AND status='pending' AND base_targets<>? AND ?='group'`).bind(salon,month,encoded,user.role)
      ]);
      return saved.meta.changes?json({ok:true}):json({error:'Ten plan ustala szef grupy. Wyślij prośbę o korektę.'},403);
    }
    if (path==='/api/salon-plans/request-change') {
      if (user.role!=='manager') return json({error:'Prośbę o korektę wysyła kierownik salonu.'},403);
      if (!fourTargets()||typeof body.reason!=='string'||!body.reason.trim()||body.reason.trim().length>500)
        return json({error:'Wpisz cztery cele i uzasadnienie do 500 znaków.'},400);
      const request=await db.prepare(`INSERT INTO salon_plan_change_requests
        (salon,month,requester,base_targets,proposed_targets,reason)
        SELECT salon,month,?3,targets,?4,?5 FROM protected_direct_salon_plans
        WHERE salon=?1 AND month=?2 AND targets<>?4
        ON CONFLICT DO NOTHING`).bind(salon,month,user.id,JSON.stringify(targets),body.reason.trim()).run();
      return request.meta.changes?json({ok:true})
        :json({error:'Zmień co najmniej jeden cel. Plan musi być ustalony przez szefa i nie może mieć oczekującej prośby.'},409);
    }
    if (path==='/api/salon-plans/decide-change') {
      if (user.role!=='group') return json({error:'O korekcie decyduje szef grupy.'},403);
      const {id,approve}=body;
      if (!Number.isSafeInteger(id)||id<1||typeof approve!=='boolean') return json({error:'Wybierz prośbę i decyzję.'},400);
      if (!approve) {
        const declined=await db.prepare(`UPDATE salon_plan_change_requests SET status='rejected'
          WHERE id=? AND salon=? AND month=? AND status='pending'`).bind(id,salon,month).run();
        return declined.meta.changes?json({ok:true}):json({error:'Ta prośba została już rozpatrzona.'},409);
      }
      const [,accepted]=await db.batch([
        db.prepare(`UPDATE direct_salon_plans AS p SET targets=(
          SELECT proposed_targets FROM salon_plan_change_requests WHERE id=?3
        ) WHERE salon=?1 AND month=?2 AND EXISTS (
          SELECT 1 FROM salon_plan_change_requests r WHERE r.id=?3 AND r.salon=p.salon AND r.month=p.month
            AND r.status='pending' AND r.base_targets=p.targets
        )`).bind(salon,month,id),
        db.prepare(`UPDATE salon_plan_change_requests SET status='approved'
          WHERE id=? AND salon=? AND month=? AND status='pending' AND changes()>0`).bind(id,salon,month),
        recordOwner('group')
      ]);
      return accepted.meta.changes?json({ok:true}):json({error:'Plan lub status prośby się zmienił. Odśwież widok.'},409);
    }
    if (path==='/api/salon-plans'&&user.role==='manager'&&await db.prepare(
      'SELECT 1 FROM protected_direct_salon_plans WHERE salon=? AND month=?'
    ).bind(salon,month).first()) return json({error:'Ten plan ustala szef grupy. Wyślij prośbę o korektę.'},403);
    const team=(await sellerTargets(salon,month)).filter(person=>!person.archived);
    if (path.endsWith('/source-profile')) {
      if (user.role!=='manager'||!team.some(row=>row.id===person))
        return json({error:'Profil ustawia kierownik przypisanego salonu.'},403);
      const {types}=body;
      const shares=types===undefined?body.shares:sourceProfileShares(types);
      if (types!==undefined&&shares===null)
        return json({error:'Wybierz od jednego do trzech różnych typów profilu.'},400);
      if (!Array.isArray(shares)||shares.length!==sourceCount||!shares.every(value=>countValid(value)&&value<=100)||
          shares.reduce((sum,value)=>sum+value,0)!==100)
        return json({error:'Udziały źródeł muszą być liczbami całkowitymi od 0 do 100 i sumować się do 100%.'},400);
      await db.prepare(`INSERT INTO seller_source_profiles(person,shares) VALUES (?,?)
        ON CONFLICT(person) DO UPDATE SET shares=excluded.shares`).bind(person,JSON.stringify(types===undefined?shares:{shares,types})).run();
      return json({ok:true});
    }
    if (path.endsWith('/seller')) {
      if (user.role!=='manager'||!team.some(row=>row.id===person))
        return json({error:'Cele handlowca zmienia kierownik przypisanego salonu.'},403);
      const sourceTargets=body.sourceTargets;
      if (sourceTargets!==undefined&&(!Array.isArray(sourceTargets)||sourceTargets.length!==sourceCount||
         !sourceTargets.every(row=>Array.isArray(row)&&row.length===10&&row.every(countValid))))
        return json({error:'Sprawdź wartości planu według źródeł.'},400);
      if (!sourceTargets&&team.some(row=>row.id===person&&row.sourceTargets))
        return json({error:'Ten plan edytuj według źródeł.'},409);
      const totals=sourceTargets?.reduce((sum,row)=>sum.map((value,index)=>value+row[index]),Array(10).fill(0));
      const manual=totals?totals.slice(0,4):targets;
      if (!Array.isArray(manual)||manual.length!==4||!manual.every(countValid))
        return json({error:'Wpisz cztery poprawne cele handlowca.'},400);
      const funnelTargets=totals?totals.slice(4):body.funnelTargets;
      if (funnelTargets!==undefined&&(!Array.isArray(funnelTargets)||funnelTargets.length!==6||!funnelTargets.every(countValid)))
        return json({error:'Sprawdź sześć celów działań handlowca.'},400);
      const existing=await db.prepare('SELECT targets FROM funnel_plans WHERE person=? AND month=?').bind(person,month).first();
      const previous=JSON.parse(existing?.targets??'[]');
      const funnel=Array.from({length:8},(_,i)=>previous[i]??null);
      if (funnelTargets) funnel.splice(0,6,...funnelTargets);
      funnel[6]=manual[2];
      funnel[7]=manual[1];
      await db.batch([
        db.prepare('INSERT INTO plans VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET target=excluded.target').bind(person,month,manual[0]),
        db.prepare('INSERT INTO review_plans VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET target=excluded.target').bind(person,month,manual[3]),
        db.prepare('INSERT INTO funnel_plans VALUES (?,?,?) ON CONFLICT(person,month) DO UPDATE SET targets=excluded.targets').bind(person,month,JSON.stringify(funnel)),
        ...(sourceTargets?[db.prepare(`INSERT INTO seller_source_plans VALUES (?,?,?) ON CONFLICT(person,month)
          DO UPDATE SET targets=excluded.targets`).bind(person,month,JSON.stringify(sourceTargets))]:[])
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
    const approvals=approvalSet(team,(await salonContributors(salon,month)).length);
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
  if (['/api/lesson-import','/api/lessons','/api/lesson-packs'].includes(path) && canManage) {
    const salon=body.salon||(user.role==='manager'&&salons.length===1?salons[0].salon:null);
    if (!textValid(salon) || !managedSalons.has(salon))
      return json({error:'Wybierz salon.'},400);
    if (path==='/api/lesson-packs') {
      if (!Number.isSafeInteger(body.id)||typeof body.active!=='boolean')
        return json({error:'Sprawdź paczkę pytań.'},400);
      const result=await db.prepare(`UPDATE lesson_packs SET active=?,published_day=CASE
        WHEN active=0 AND ?=1 THEN ? ELSE published_day END WHERE salon=? AND id=?`)
        .bind(Number(body.active),Number(body.active),localDay(),salon,body.id).run();
      return result.meta.changes?json({ok:true}):json({error:'Nie znaleziono paczki w tym salonie.'},404);
    }
    if (path==='/api/lesson-import') {
      if (body.mode!=='pack')
        return json({error:'Widok lekcji został zaktualizowany. Odśwież stronę i sprawdź „Paczki pytań”. Jeśli pliku tam nie ma, zaimportuj go ponownie.'},409);
      if (typeof body.filename!=='string'||body.filename.length>255||!/[.](pdf|docx|xlsx|pptx|txt)$/i.test(body.filename)||
          typeof body.file!=='string'||!body.file||body.file.length>20_971_520)
        return json({error:'Wybierz PDF, DOCX, XLSX, PPTX lub TXT do 15 MB.'},400);
      try {
        const text=(await env.extractLessonText(body.filename,body.file));
        const lessons=lessonDrafts(text);
        if (lessons.length) {
          await db.prepare(`INSERT INTO lesson_packs(salon,name,published_day,lessons)
            VALUES (?,?,?,?) ON CONFLICT(salon,name) DO UPDATE
            SET active=0,published_day=excluded.published_day,lessons=excluded.lessons`)
            .bind(salon,body.filename,localDay(),JSON.stringify(lessons)).run();
          return json({count:lessons.length});
        }
        if (text.trim()) return json({error:'Nie znaleziono zagadnień sprzedażowych. Wybierz dokument ze standardami obsługi, oceną wizyty lub informacjami o produkcie albo dodaj lekcję ręcznie.'},422);
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
    await db.prepare(`INSERT INTO lesson_packs(salon,name,active,published_day,lessons)
      VALUES (?,'Lekcje dodane ręcznie',1,?,?) ON CONFLICT(salon,name)
      DO UPDATE SET active=1,published_day=excluded.published_day,lessons=excluded.lessons`)
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
        SELECT salon FROM lesson_packs WHERE salon=? UNION ALL
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
    const manager=await db.prepare("SELECT id,salon FROM accounts WHERE id=? AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email=accounts.email) AND "+managers).bind(body.manager).first();
    if (!manager) return json({error:'Wybierz konto kierownika.'},400);
    const additional=[...new Set(body.salons.map(salon=>salon.trim()))].filter(salon=>salon!==manager.salon);
    if (!additional.every(salon=>managedSalons.has(salon))) return json({error:'Wybierz salony z listy.'},400);
    await db.batch([
      db.prepare('DELETE FROM manager_salons WHERE manager=?').bind(manager.id),
      ...additional.map(salon=>db.prepare('INSERT INTO manager_salons(manager,salon) VALUES (?,?)').bind(manager.id,salon))
    ]);
    return json({ok:true});
  }
  if (path==='/api/users/invite' && canManage) {
    if (!textValid(body.email)) return json({error:'Wybierz użytkownika.'},400);
    const address=body.email.trim().toLowerCase();
    if (address===email||address===env.sharedAdmin||(!owner&&!await canEditDelegated(address)))
      return json({error:'Nie możesz zaprosić tej osoby.'},403);
    const account=await db.prepare(`SELECT a.id,a.role,h.group_name
      FROM accounts a LEFT JOIN dealer_group_heads h ON h.email=a.email
      WHERE a.email=? AND NOT EXISTS (SELECT 1 FROM archived_users x WHERE x.email=a.email)`)
      .bind(address).first();
    if (!account||account.role==='admin') return json({error:'Wybierz aktywne konto użytkownika.'},404);
    if (!env.inviteReady) return json({error:'Wysyłka zaproszeń jest chwilowo niedostępna.'},503);
    const explicit=await list(db,'SELECT role FROM account_roles WHERE person=?',account.id);
    const roles=(explicit.length?explicit.map(row=>row.role):[account.group_name?'group':account.role])
      .filter(role=>['group','manager','seller'].includes(role)&&(role!=='group'||account.group_name));
    if (!roles.length) return json({error:'Konto nie ma przypisanej roli.'},409);
    const sent=await env.sendInvitation(address,signedInAs,roles).catch(()=>false);
    return sent?json({ok:true}):json({error:'Nie udało się wysłać zaproszenia. Spróbuj ponownie za chwilę.'},503);
  }
  if (path==='/api/users/archive' && canManage) {
    if (!textValid(body.email)||typeof body.archived!=='boolean') return json({error:'Wybierz użytkownika.'},400);
    const address=body.email.trim().toLowerCase();
    const account=await db.prepare('SELECT role FROM accounts WHERE email=?').bind(address).first();
    if (address===env.sharedAdmin||address===email||account?.role==='admin') return json({error:'Nie można usunąć dostępu administratora.'},403);
    if (!owner&&!await canEditDelegated(address)) return json({error:'Nie możesz zarządzać tym kontem.'},403);
    const head=await db.prepare('SELECT 1 FROM dealer_group_heads WHERE email=?').bind(address).first();
    if (!account&&!head) return json({error:'Nie znaleziono użytkownika.'},404);
    const day=localDay();
    const archive=body.archived?[
      db.prepare(`INSERT INTO archive_report_days (email,first_excluded_day)
        SELECT ?1,date(?2,'+1 day') WHERE NOT EXISTS (SELECT 1 FROM archived_users WHERE email=?1)
        ON CONFLICT(email,first_excluded_day) DO UPDATE SET restored_day=NULL`).bind(address,day),
      db.prepare('INSERT INTO archived_users(email) VALUES (?) ON CONFLICT DO NOTHING').bind(address)
    ]:[
      db.prepare(`UPDATE archive_report_days SET restored_day=max(?,first_excluded_day)
        WHERE email=? AND restored_day IS NULL`).bind(day,address),
      db.prepare('DELETE FROM archived_users WHERE email=?').bind(address)
    ];
    await db.batch([
      ...archive,
      db.prepare('DELETE FROM lejek_sessions WHERE email=?').bind(address),
      db.prepare('DELETE FROM lejek_password_resets WHERE email=?').bind(address)
    ]);
    return json({ok:true});
  }
  if (path==='/api/users' && canManage) {
    const {firstName,lastName,phone,roles:chosen,salon,dealerGroup}=body;
    const needsSalon=Array.isArray(chosen)&&chosen.some(role=>role!=='group');
    if (!Array.isArray(chosen)||!chosen.length||chosen.length>3||new Set(chosen).size!==chosen.length||
        !chosen.every(role=>['group','manager','seller'].includes(role))||
        (needsSalon&&!textValid(salon))||!textValid(body.email)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
      return json({error:'Podaj dane użytkownika i zaznacz co najmniej jedną rolę. Dla kierownika lub handlowca wybierz salon.'},400);
    const address=body.email.trim().toLowerCase();
    const current=await db.prepare('SELECT id,role FROM accounts WHERE email=?').bind(address).first();
    const creating=body.createOnly===true||!current;
    const structured=creating||firstName!==undefined||lastName!==undefined||phone!==undefined;
    const validName=value=>typeof value==='string'&&value.trim().length>0&&value.length<=60;
    const validPhone=typeof phone==='string'&&phone.length<=32&&/^\+?[0-9() .-]+$/.test(phone.trim())
      &&/^\d{7,15}$/.test(phone.replace(/\D/g,''));
    if (structured&&(!validName(firstName)||(creating?!validName(lastName):lastName!==''&&!validName(lastName))))
      return json({error:'Uzupełnij imię i nazwisko.'},400);
    if (structured&&(creating||phone!=='')&&!validPhone)
      return json({error:'Podaj poprawny numer telefonu (od 7 do 15 cyfr).'},400);
    const name=structured?[firstName.trim(),lastName.trim()].filter(Boolean).join(' '):body.name;
    if (!structured&&!textValid(name))
      return json({error:'Uzupełnij dane użytkownika.'},400);
    if (address===env.sharedAdmin||address===email||current?.role==='admin') return json({error:'Tym formularzem nie można zmienić konta administratora.'},403);
    const wantsGroup=chosen.includes('group');
    const createOnly=body.createOnly===true;
    if (wantsGroup&&user.role==='group'&&(!createOnly||dealerGroup!=null&&dealerGroup!==''&&dealerGroup!==user.group))
      return json({error:'Szef grupy może nadać tę rolę tylko nowemu użytkownikowi w swojej grupie.'},403);
    if (user.role==='manager'&&chosen.some(role=>role!=='seller') ||
        !owner&&needsSalon&&!managedSalons.has(salon.trim()))
      return json({error:'Nie możesz nadać tych ról w wybranym salonie.'},403);
    if (!owner&&!createOnly&&!await canEditDelegated(address))
      return json({error:'Nie możesz zarządzać tym kontem.'},403);
    if (createOnly&&(current||await db.prepare('SELECT 1 FROM dealer_group_heads WHERE email=?').bind(address).first()))
      return json({error:'Konto z tym adresem e-mail już istnieje.'},409);
    if (needsSalon&&!managedSalons.has(salon.trim())) return json({error:'Wybierz salon z listy dodanych salonów.'},400);
    const group=wantsGroup?(user.role==='group'?user.group:(textValid(dealerGroup)?dealerGroup.trim():null)):null;
    if (wantsGroup&&(!group||!await db.prepare('SELECT 1 FROM dealer_groups WHERE name=?').bind(group).first()))
      return json({error:'Wybierz grupę dealerską.'},400);
    const fallback=chosen.includes('manager')?'manager':'seller';
    const password=body.password??'';
    if (password!==''&&!validAccountPassword(password))
      return json({error:'Hasło do Biegu Wyżej musi mieć od 8 do 128 znaków.'},400);
    const credentials=password?await env.passwordStatements(address,password):[];
    const insertAccount='INSERT INTO accounts(email,name,salon,role) VALUES (?,?,?,?)';
    const updateAccount=' ON CONFLICT(email) DO UPDATE SET name=excluded.name,salon=excluded.salon,role=excluded.role';
    await db.batch([
      db.prepare(insertAccount+(creating?'':updateAccount))
        .bind(address,name.trim(),needsSalon?salon.trim():'',fallback),
      ...(structured?[db.prepare(`INSERT INTO account_contact_details(person,first_name,last_name,phone)
        SELECT id,?,?,? FROM accounts WHERE email=? ON CONFLICT(person) DO UPDATE SET
          first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone
        `).bind(firstName.trim(),lastName.trim(),phone.trim(),address)]:[]),
      db.prepare('DELETE FROM account_roles WHERE person=(SELECT id FROM accounts WHERE email=?)').bind(address),
      ...chosen.map(role=>db.prepare('INSERT INTO account_roles SELECT id,? FROM accounts WHERE email=?').bind(role,address)),
      group?db.prepare('INSERT INTO dealer_group_heads VALUES (?,?)'+
        (createOnly?'':' ON CONFLICT(email) DO UPDATE SET group_name=excluded.group_name')).bind(address,group)
        :db.prepare('DELETE FROM dealer_group_heads WHERE email=?').bind(address),
      ...(!chosen.includes('manager')&&current?[db.prepare('DELETE FROM manager_salons WHERE manager=?').bind(current.id)]:[]),
      ...credentials
    ]);
    return creating?invitedNewAccount(address,chosen):json({ok:true});
  }
  if (path==='/api/accounts' && user.role!=='seller') {
    if (!textValid(body.name)||!textValid(body.salon)||!['manager','seller'].includes(body.role)||
        !textValid(body.email)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return json({error:'Uzupełnij poprawnie wszystkie pola.'},400);
    const targetEmail=body.email.trim().toLowerCase();
    const salon=body.salon.trim();
    if (targetEmail===env.sharedAdmin) return json({error:'Nie można zmienić konta administratora.'},403);
    if (!validAccountPassword(body.password))
      return json({error:'Hasło do Biegu Wyżej musi mieć od 8 do 128 znaków.'},400);
    if (user.role!=='admin'&&!managedSalons.has(salon) || user.role==='manager'&&body.role!=='seller')
      return json({error:'Nie możesz nadać tej roli w wybranym salonie.'},403);
    const current=await db.prepare('SELECT id,role,salon FROM accounts WHERE email=?').bind(targetEmail).first();
    if (current||await db.prepare('SELECT 1 FROM dealer_group_heads WHERE email=?').bind(targetEmail).first())
      return json({error:'Konto już istnieje. Zmiany wprowadź w sekcji Zarządzaj użytkownikami.'},409);
    const credentials=await env.passwordStatements(targetEmail,body.password);
    await db.batch([
      db.prepare('INSERT INTO accounts(email,name,salon,role) VALUES (?,?,?,?)')
        .bind(targetEmail,body.name.trim(),salon,body.role),
      ...credentials
    ]);
    return invitedNewAccount(targetEmail,[body.role]);
  }
  if (path==='/api/group-brand') {
    if (user.role!=='group') return json({error:'Logo grupy może zmienić szef grupy dealerskiej.'},403);
    const {logo}=body;
    if (!validBrandLogo(logo)) return json({error:'Sprawdź format logo grupy.'},400);
    await db.prepare(`INSERT INTO dealer_group_brand (group_name,logo) VALUES (?,?)
      ON CONFLICT(group_name) DO UPDATE SET logo=excluded.logo`).bind(user.group,logo).run();
    return json({ok:true});
  }
  if (path==='/api/brand' && canManage) {
    const {salon,name,logo}=body;
    const omitName=user.role==='group'&&(name===undefined||typeof name==='string'&&!name.trim());
    if (!textValid(salon)||(!omitName&&!textValid(name))||
        (logo!==undefined&&!validBrandLogo(logo))) return json({error:'Sprawdź dane dealera i format logo.'},400);
    if (user.role!=='admin'&&!managedSalons.has(salon.trim())) return json({error:'Nie masz dostępu do salonu.'},403);
    await db.prepare(`INSERT INTO dealer_brand (salon,name,logo) VALUES (?1,COALESCE(?2,?1),COALESCE(?3,''))
      ON CONFLICT(salon) DO UPDATE SET name=COALESCE(?2,dealer_brand.name),logo=COALESCE(?3,dealer_brand.logo)`)
      .bind(salon.trim(),omitName?null:name.trim(),logo??null).run();
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
  if (path==='/api/daily/backfill') {
    if (!owner) return json({error:'Zaległe wpisy dla handlowców zapisuje administrator.'},403);
    const {person,day,rows}=body;
    if (!sellers.some(seller=>seller.id===person&&seller.accountStatus!=='inactive'))
      return json({error:'Wybierz aktywne konto handlowca.'},400);
    if (!dayValid(day)||day>localDay()) return json({error:'Wybierz dzisiejszą lub wcześniejszą datę.'},400);
    if (!validDailyRows(rows)) return json({error:'Sprawdź wartości aktywności w poszczególnych źródłach.'},400);
    normalizeWalkIn(rows);
    if (!rows.some(row=>row.some(v=>v>0))) return json({error:'Wpisz co najmniej jedno wykonane działanie.'},400);
    const written=await db.prepare(insertDailyResult+`
      AND EXISTS (SELECT 1 FROM accounts a WHERE a.id=?1 AND ${accountRole('a','seller')}
        AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email=a.email) AND ${inReportDay('a.email','?2')})
      AND NOT EXISTS (SELECT 1 FROM work_calendar WHERE person=?1 AND day=?2 AND status='pending')
      AND NOT EXISTS (SELECT 1 FROM daily_drafts WHERE person=?1 AND day=?2)
      ON CONFLICT(person,day) DO NOTHING`).bind(person,day,dailyCounters(rows)).run();
    return written.meta.changes?json({ok:true})
      :json({error:'Tego dnia nie można zatwierdzić. Sprawdź, czy ma już wpis, zapis roboczy lub zgłoszenie w kalendarzu oraz czy konto było wtedy aktywne.'},409);
  }
  if (!sellers.some(p=>p.id===body.person&&p.accountStatus!=='inactive')) return json({error:'Brak uprawnień do tego handlowca.'},403);
  if (path==='/api/daily/reopen') {
    if (user.role!=='manager'||!sellers.some(seller=>seller.id===body.person&&seller.accountStatus!=='inactive'))
      return json({error:'Brak uprawnień do odblokowania dni tego handlowca.'},403);
    const {person,day}=body;
    if (!dayValid(day)||day>localDay()) return json({error:'Sprawdź datę wpisu.'},400);
    const [,removed]=await db.batch([
      db.prepare(`INSERT INTO daily_drafts (person,day,rows)
        SELECT person,day,json_extract(counters,'$[5]') FROM daily_results
        WHERE person=? AND day=? AND json_type(counters,'$[5]')='array'
        ON CONFLICT(person,day) DO UPDATE SET rows=excluded.rows`).bind(person,day),
      db.prepare(`DELETE FROM daily_results
        WHERE person=? AND day=? AND json_type(counters,'$[5]')='array'`).bind(person,day)
    ]);
    return removed.meta.changes?json({ok:true}):json({error:'Nie ma zatwierdzonego wpisu z podziałem na źródła dla tego dnia.'},409);
  }
  if (path==='/api/work-calendar') {
    if (!['seller','manager'].includes(user.role)) return json({error:'Brak dostępu do kalendarza.'},403);
    const {person,day,kind,action}=body;
    if (!dayValid(day)||(!workday(day)&&!(action==='save'&&body.endDay&&body.endDay!==day))||!['save','remove','approve','reject','revoke'].includes(action))
      return json({error:'Wybierz dzień od poniedziałku do soboty i poprawną operację.'},400);
    const seller=user.role==='seller';
    if (seller&&(day<localDay()||!['save','remove'].includes(action)))
      return json({error:'Możesz planować dni od dziś. Zatwierdzone dni zmienia kierownik.'},403);
    let change;
    if (action==='remove') {
      change=await db.prepare(`DELETE FROM work_calendar WHERE person=? AND day=? AND (?=0 OR status!='approved')`)
        .bind(person,day,Number(seller)).run();
    } else if (action==='revoke') {
      change=await db.prepare("UPDATE work_calendar SET status='pending' WHERE person=? AND day=? AND status='approved'")
        .bind(person,day).run();
    } else if (action==='reject') {
      change=await db.prepare("UPDATE work_calendar SET status='rejected' WHERE person=? AND day=? AND status='pending'")
        .bind(person,day).run();
    } else if (action==='approve') {
      change=await db.prepare(`UPDATE work_calendar SET status='approved' WHERE person=?1 AND day=?2 AND status='pending'
        AND NOT EXISTS (SELECT 1 FROM daily_results WHERE person=?1 AND day=?2)
        AND NOT EXISTS (SELECT 1 FROM daily_exceptions WHERE person=?1 AND day=?2 AND kind!='rejected')`)
        .bind(person,day).run();
    } else {
      if (!calendarKinds.includes(kind)||kind==='saturday'&&new Date(day+'T00:00:00Z').getUTCDay()!==6)
        return json({error:'Wybierz rodzaj nieobecności. Wolną sobotę można zaznaczyć tylko w sobotę.'},400);
      const endDay=body.endDay??day;
      if (!dayValid(endDay)||endDay<day||(Date.parse(endDay)-Date.parse(day))/86400000>=366||
          (endDay!==day&&!['leave','sick'].includes(kind)))
        return json({error:'Sprawdź zakres dat. Urlop i chorobowe można wpisać za maksymalnie 366 dni.'},400);
      const days=daysBetween(day,endDay).filter(workday);
      change=await db.prepare(`WITH selected AS (SELECT value AS day FROM json_each(?2)),
        eligible AS (
          SELECT day FROM selected WHERE ?5=0 OR NOT EXISTS (
            SELECT 1 FROM work_calendar c WHERE c.person=?1 AND c.day=selected.day
              AND c.status='approved' AND c.kind IN ('saturday','other')
          )
        )
        INSERT INTO work_calendar(person,day,kind,status)
        SELECT ?1,day,?3,?4 FROM eligible WHERE NOT EXISTS (
          SELECT 1 FROM eligible e
          WHERE EXISTS (SELECT 1 FROM daily_results WHERE person=?1 AND day=e.day)
             OR EXISTS (SELECT 1 FROM daily_exceptions WHERE person=?1 AND day=e.day AND kind!='rejected')
             OR EXISTS (SELECT 1 FROM work_calendar c WHERE c.person=?1 AND c.day=e.day
               AND ((?4='pending' AND c.status='approved') OR (?5=1 AND c.status!='rejected' AND c.kind<>?3)))
        )
        ON CONFLICT(person,day) DO UPDATE SET kind=excluded.kind,status=excluded.status`)
        .bind(person,JSON.stringify(days),kind,seller?'pending':'approved',Number(endDay!==day)).run();
    }
    return change.meta.changes?json({ok:true,days:change.meta.changes}):json({error:'Brak dni do zapisania albo w wybranym zakresie są rozliczone dni lub inne zgłoszenia. Sprawdź kalendarz.'},409);
  }
  if (path==='/api/review' && user.role!=='seller') {
    const revoke=body.action==='revoke';
    if (!dayValid(body.day)||(!revoke&&typeof body.approve!=='boolean')) return json({error:'Sprawdź decyzję.'},400);
    const changed=await db.prepare('UPDATE daily_exceptions SET kind=? WHERE person=? AND day=? AND kind=?')
      .bind(revoke?'pending':body.approve?'zero':'rejected',body.person,body.day,revoke?'zero':'pending').run();
    return changed.meta.changes?json({ok:true}):json({error:'Zgłoszenie jest już rozliczone.'},409);
  }
  if (user.role==='group') return json({error:'Ten poziom dostępu służy do przeglądania wyników i zarządzania zespołem.'},403);
  if (path==='/api/daily' || path==='/api/day-exception') {
    if (user.role!=='seller') return json({error:'Dzienny wpis zapisuje handlowiec.'},403);
    const {day}=body;
    if (!dayValid(day)||day>localDay()) return json({error:'Sprawdź datę wpisu.'},400);
    const {missing,exceptions}=await tracking(db,user.id);
    const reportingToday=path==='/api/day-exception'&&body.kind==='pending'&&day===localDay();
    if (day !== (missing[0] ?? localDay())&&!reportingToday)
      return json({error:'Najpierw rozlicz najstarszy zaległy dzień.'},409);
    if (['pending','leave','training','zero'].includes(exceptions[day])) return json({error:'Ten dzień ma już status rozliczenia.'},409);
    if (path==='/api/day-exception') {
      if (!['leave','training','pending'].includes(body.kind)||body.kind==='pending'&&!textValid(body.reason))
        return json({error:'Wybierz status i podaj powód dnia bez aktywności.'},400);
      const changed=await db.prepare("INSERT INTO daily_exceptions SELECT ?1,?2,?3,?4 WHERE NOT EXISTS (SELECT 1 FROM daily_results WHERE person=?1 AND day=?2) AND NOT EXISTS (SELECT 1 FROM work_calendar WHERE person=?1 AND day=?2 AND status IN ('approved','pending')) ON CONFLICT(person,day) DO UPDATE SET kind=excluded.kind,reason=excluded.reason WHERE kind='rejected'")
        .bind(user.id,day,body.kind,body.kind==='pending'?body.reason.trim():'').run();
      return changed.meta.changes?json({ok:true}):json({error:'Ten dzień jest już rozliczony.'},409);
    }
    const {rows,draft=false}=body;
    if (typeof draft!=='boolean') return json({error:'Sprawdź tryb zapisu.'},400);
    if (!validDailyRows(rows)) return json({error:'Wpisz co najmniej jedno wykonane działanie.'},400);
    normalizeWalkIn(rows);
    if (draft) {
      const written=await db.prepare(`INSERT INTO daily_drafts (person,day,rows)
        SELECT ?1,?2,?3
        WHERE NOT EXISTS (SELECT 1 FROM daily_results WHERE person=?1 AND day=?2)
          AND NOT EXISTS (SELECT 1 FROM daily_exceptions WHERE person=?1 AND day=?2 AND kind!='rejected')
          AND NOT EXISTS (SELECT 1 FROM work_calendar WHERE person=?1 AND day=?2 AND status='approved')
        ON CONFLICT(person,day) DO UPDATE SET rows=excluded.rows`)
        .bind(user.id,day,JSON.stringify(rows)).run();
      return written.meta.changes?json({ok:true}):json({error:'Ten dzień jest już rozliczony.'},409);
    }
    if (!rows.some(row=>row.some(v=>v>0))) return json({error:'Wpisz co najmniej jedno wykonane działanie.'},400);
    const written=await db.prepare(insertDailyResult+' ON CONFLICT(person,day) DO NOTHING')
      .bind(user.id,day,dailyCounters(rows)).run();
    return written.meta.changes?json({ok:true}):json({error:'Ten dzień jest już zapisany.'},409);
  }
  if (path==='/api/plans' && user.role!=='seller') {
    if (!sellers.some(person=>person.id===body.person&&person.planEligible&&person.accountStatus!=='inactive'))
      return json({error:'Ta osoba rozlicza działania w planie salonu i nie ma indywidualnego planu.'},403);
    if (!monthValid(body.month)||!Array.isArray(body.targets)||body.targets.length!==3||!body.targets.every(countValid)) return json({error:'Wpisz trzy cele miesięczne.'},400);
    const reviewTargets=body.reviewTargets;
    if (reviewTargets!==undefined&&(!Array.isArray(reviewTargets)||reviewTargets.length!==3||!reviewTargets.every(value=>value===null||countValid(value))))
      return json({error:'Sprawdź cele dotyczące opinii Google.'},400);
    const funnelTargets=body.funnelTargets;
    const validFunnel=value=>Array.isArray(value)&&[3,8].includes(value.length)&&value.every(target=>target===null||countValid(target));
    if (funnelTargets!==undefined&&(!Array.isArray(funnelTargets)||funnelTargets.length!==3||!funnelTargets.every(validFunnel)))
      return json({error:'Sprawdź cele lejka.'},400);
    const first=Math.floor((Number(body.month.slice(5))-1)/3)*3+1;
    const quarter=Array.from({length:3},(_,i)=>body.month.slice(0,5)+String(first+i).padStart(2,'0'));
    if (await db.prepare('SELECT 1 FROM seller_source_plans WHERE person=? AND month IN (?,?,?)')
      .bind(body.person,...quarter).first())
      return json({error:'Ten kwartał zawiera plan według źródeł. Edytuj go w Administracja → Plany salonów.'},409);
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
