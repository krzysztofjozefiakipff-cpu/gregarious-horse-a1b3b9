function lifeWeek(today) {
  const date=new Date(today+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  return date.toISOString().slice(0,10);
}

async function lifeScopes(db,user) {
  const role=user.role;
  const salons=role==='admin'
    ?await list(db,"SELECT salon FROM accounts WHERE salon<>'' UNION SELECT salon FROM dealer_group_salons ORDER BY salon")
    :role==='group'?await list(db,'SELECT salon FROM dealer_group_salons WHERE group_name=? ORDER BY salon',user.group)
    :role==='manager'?await list(db,"SELECT ? AS salon UNION SELECT salon FROM manager_salons WHERE manager=? ORDER BY salon",user.salon,user.id)
    :[{salon:user.salon}];
  const names=salons.map(row=>row.salon).filter(Boolean);
  const groups=role==='admin'?await list(db,'SELECT name FROM dealer_groups ORDER BY name')
    :role==='group'?[{name:user.group}]
    :await list(db,`SELECT DISTINCT group_name AS name FROM dealer_group_salons
      WHERE salon IN (SELECT value FROM json_each(?)) ORDER BY name`,JSON.stringify(names));
  const all=[
    ...names.map(name=>({scope:'salon',name,moderate:['manager','group','admin'].includes(role)})),
    ...groups.map(({name})=>({scope:'group',name,moderate:['group','admin'].includes(role)}))
  ];
  const preferred=all.find(item=>role==='group'?item.scope==='group':item.scope==='salon'&&item.name===user.salon);
  return preferred?[preferred,...all.filter(item=>item!==preferred)]:all;
}

const lifeText=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
function lifePhoto(value) {
  if (typeof value!=='string'||value.length>240_000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    const bytes=atob(value.slice('data:image/jpeg;base64,'.length));
    return bytes.startsWith('\xff\xd8\xff')&&bytes.endsWith('\xff\xd9');
  } catch { return false; }
}

async function viewSalonLife(db,current,scopes,email,today,week,user,roles,preview) {
  const {scope,name,moderate}=current;
  const posts=await list(db,`SELECT p.id,p.title,p.message,p.photo IS NOT NULL AS hasPhoto,p.published_day AS day,
    (SELECT name FROM accounts a WHERE a.email=p.author) AS author,
    (SELECT count(*) FROM salon_life_reactions r WHERE r.post=p.id) AS reactions,
    EXISTS(SELECT 1 FROM salon_life_reactions r WHERE r.post=p.id AND r.email=?) AS reacted
    FROM salon_life_posts p WHERE p.scope=? AND p.audience=? AND p.status='approved'
    ORDER BY p.published_day DESC,p.id DESC LIMIT 40`,email,scope,name);
  const hit=await db.prepare(`SELECT p.id,p.title,p.message,p.photo IS NOT NULL AS hasPhoto,p.published_day AS day,
    (SELECT name FROM accounts a WHERE a.email=p.author) AS author,
    count(r.email) AS reactions, MAX(r.email=?) AS reacted
    FROM salon_life_posts p JOIN salon_life_reactions r ON r.post=p.id
    WHERE p.scope=? AND p.audience=? AND p.status='approved' AND p.published_day BETWEEN ? AND ?
    GROUP BY p.id ORDER BY reactions DESC,p.id DESC LIMIT 1`).bind(email,scope,name,week,today).first();
  const pending=moderate?await list(db,`SELECT id,title,message,photo IS NOT NULL AS hasPhoto FROM salon_life_posts
    WHERE scope=? AND audience=? AND status='pending' ORDER BY id LIMIT 40`,scope,name):[];
  const ballot=await db.prepare(`SELECT id,question,options FROM salon_life_polls
    WHERE scope=? AND audience=? AND week=?`).bind(scope,name,week).first();
  let poll=null;
  if (ballot) {
    const votes=await list(db,'SELECT choice, count(*) AS votes FROM salon_life_poll_votes WHERE poll=? GROUP BY choice',ballot.id);
    const own=await db.prepare('SELECT choice FROM salon_life_poll_votes WHERE poll=? AND email=?').bind(ballot.id,email).first();
    poll={id:ballot.id,question:ballot.question,choice:own?.choice??null,options:JSON.parse(ballot.options).map((label,i)=>({
      label,votes:votes.find(row=>row.choice===i)?.votes??0
    }))};
  }
  const {firstName,brand}=await loadAccountHeader(db,user);
  return json({role:user.role,roles,accountHeader:{firstName,brand},scopes,current,posts,hit,pending,poll,readOnly:preview});
}

async function handleSalonLife(request,url,db,user,roles,email,preview) {
  const scopes=await lifeScopes(db,user);
  const scope=url.searchParams.get('scope');
  const name=url.searchParams.get('name');
  const current=scope||name?scopes.find(item=>item.scope===scope&&item.name===name):scopes[0];
  if (!current) return json({error:'Ten salon lub grupa nie są dostępne dla Twojego konta.'},403);
  const today=localDay();
  const week=lifeWeek(today);
  const key=[current.scope,current.name];

  if (request.method==='GET'&&url.pathname==='/api/salon-life/photo') {
    const id=Number(url.searchParams.get('id'));
    const row=await db.prepare(`SELECT photo FROM salon_life_posts WHERE id=? AND scope=? AND audience=?
      AND photo IS NOT NULL AND (status='approved' OR (status='pending' AND ?))`).bind(id,...key,Number(current.moderate)).first();
    if (!row) return json({error:'Zdjęcie jest niedostępne.'},404);
    const bytes=Uint8Array.from(atob(row.photo.split(',')[1]),char=>char.charCodeAt(0));
    return new Response(bytes,{headers:{...headers,'Content-Type':'image/jpeg'}});
  }
  if (request.method==='GET') return viewSalonLife(db,current,scopes,email,today,week,user,roles,preview);
  if (url.pathname!=='/api/salon-life'||request.method!=='POST'||preview||request.headers.get('Origin')!==url.origin||
      !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Niedozwolone żądanie.'},403);
  const body=await request.json().catch(()=>null);
  if (!body) return json({error:'Nieprawidłowy formularz.'},400);
  const {action,id}=body;

  if (action==='post') {
    const {title,message,photo}=body;
    if (!lifeText(title,80)||!lifeText(message,800)||(photo!=null&&!lifePhoto(photo)))
      return json({error:'Wpisz tytuł i treść. Zdjęcie powinno mieć maksymalnie 175 KB po zmniejszeniu.'},400);
    await db.prepare('INSERT INTO salon_life_posts(scope,audience,author,title,message,photo) VALUES (?,?,?,?,?,?)')
      .bind(...key,email,title.trim(),message.trim(),photo??null).run();
    return json({ok:true});
  }
  if (action==='react'&&Number.isSafeInteger(id)&&typeof body.active==='boolean') {
    const sql=body.active?`INSERT INTO salon_life_reactions(post,email)
      SELECT id,?1 FROM salon_life_posts WHERE id=?2 AND scope=?3 AND audience=?4 AND status='approved'
      ON CONFLICT(post,email) DO NOTHING`:`DELETE FROM salon_life_reactions WHERE email=?1 AND post IN
      (SELECT id FROM salon_life_posts WHERE id=?2 AND scope=?3 AND audience=?4 AND status='approved')`;
    await db.prepare(sql).bind(email,id,...key).run();
    return json({ok:true});
  }
  if (action==='vote'&&Number.isSafeInteger(id)&&Number.isInteger(body.choice)&&body.choice>=0) {
    const result=await db.prepare(`INSERT INTO salon_life_poll_votes(poll,email,choice)
      SELECT id,?1,?2 FROM salon_life_polls WHERE id=?3 AND scope=?4 AND audience=?5 AND week=?6 AND ?2<json_array_length(options)
      ON CONFLICT(poll,email) DO UPDATE SET choice=excluded.choice`).bind(email,body.choice,id,...key,week).run();
    return result.meta.changes?json({ok:true}):json({error:'Ta ankieta jest niedostępna.'},409);
  }
  if (!current.moderate) return json({error:'Tę zmianę może wprowadzić moderator.'},403);
  if (action==='review'&&Number.isSafeInteger(id)&&['approve','reject','remove'].includes(body.decision)) {
    const approve=body.decision==='approve';
    const result=await db.prepare(`UPDATE salon_life_posts SET status=?,published_day=?
      WHERE id=? AND scope=? AND audience=? AND status=?`)
      .bind(approve?'approved':'rejected',approve?today:null,id,...key,body.decision==='remove'?'approved':'pending').run();
    return result.meta.changes?json({ok:true}):json({error:'Ten wpis został już rozpatrzony.'},409);
  }
  if (action==='poll') {
    const {question,options}=body;
    if (!lifeText(question,120)||!Array.isArray(options)||options.length<2||options.length>4||!options.every(option=>lifeText(option,60)))
      return json({error:'Podaj pytanie i od dwóch do czterech odpowiedzi.'},400);
    const labels=options.map(option=>option.trim());
    if (new Set(labels.map(label=>label.toLocaleLowerCase('pl'))).size!==labels.length)
      return json({error:'Odpowiedzi powinny się różnić.'},400);
    const result=await db.prepare(`INSERT INTO salon_life_polls(scope,audience,week,question,options) VALUES (?,?,?,?,?)
      ON CONFLICT(scope,audience,week) DO NOTHING`).bind(...key,week,question.trim(),JSON.stringify(labels)).run();
    return result.meta.changes?json({ok:true}):json({error:'Ankieta na ten tydzień jest już opublikowana.'},409);
  }
  return json({error:'Nieznana operacja.'},400);
}
