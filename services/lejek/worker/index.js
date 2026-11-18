const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => Response.json(body,{status,headers});
const monthValid = month => typeof month==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const localDay = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date());
const dayValid = day => typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
const countValid = value => Number.isInteger(value) && value>=0 && value<=1000000;
const textValid = value => typeof value==='string' && value.trim().length>0 && value.length<=120;
async function list(db,sql,...params) { return (await db.prepare(sql).bind(...params).all()).results; }

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/')) {
    const asset = path==='/'?'/index.html':path;
    if (request.method!=='GET' || !Object.hasOwn(assets,asset)) return new Response('Nie znaleziono',{status:404});
    return new Response(assets[asset],{headers:{...headers,'Content-Type':asset.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'self'"}});
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
      return json({role:user.role,sellers,plans,daily});
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
  if (!sellers.some(p=>p.id===body.person)) return json({error:'Brak uprawnień do tego handlowca.'},403);
  if (path==='/api/daily') {
    if (user.role!=='seller') return json({error:'Dzienny wpis zapisuje handlowiec.'},403);
    if (!dayValid(body.day) || body.day>localDay() || !Array.isArray(body.values) ||
        body.values.length!==5 || !body.values.every(v=>v===null||countValid(v)))
      return json({error:'Sprawdź datę i wpisane liczby.'},400);
    await db.prepare('INSERT INTO daily_results(person,day,counters) VALUES (?,?,?) ON CONFLICT(person,day) DO UPDATE SET counters=excluded.counters')
      .bind(body.person,body.day,JSON.stringify(body.values)).run();
    return json({ok:true});
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
