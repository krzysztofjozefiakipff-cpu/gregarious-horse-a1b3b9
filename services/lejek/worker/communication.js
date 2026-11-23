const communicationPositions={reception:'Recepcja',sales_assistant:'Asystent sprzedaży',carwash:'Pracownik myjni',logistics:'Pracownik logistyki'};
const communicationDepartments={carwash:'Myjnia',logistics:'Logistyka'};

async function communicationDirectory(db,user,email) {
  const scopes=await lifeScopes(db,user);
  const groups=scopes.filter(item=>item.scope==='group').map(item=>item.name);
  const salons=scopes.filter(item=>item.scope==='salon').map(item=>item.name);
  const members=await list(db,`SELECT a.id,a.email,a.name,a.salon,gs.group_name AS groupName,
      cp.position,CASE WHEN EXISTS(SELECT 1 FROM account_roles r WHERE r.person=a.id)
        THEN EXISTS(SELECT 1 FROM account_roles r WHERE r.person=a.id AND r.role='manager')
        ELSE a.role='manager' END AS manager
    FROM accounts a LEFT JOIN dealer_group_salons gs USING(salon)
    LEFT JOIN communication_positions cp ON cp.email=a.email AND cp.salon=a.salon
    WHERE a.email<>?1 AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=a.email)
      AND (a.salon IN (SELECT value FROM json_each(?2)) OR gs.group_name IN (SELECT value FROM json_each(?3)))
    ORDER BY a.name,a.id`,email,JSON.stringify(salons),JSON.stringify(groups));
  const heads=await list(db,`SELECT h.email,COALESCE(a.name,'Szef grupy') AS name,h.group_name AS groupName
    FROM dealer_group_heads h LEFT JOIN accounts a ON a.email=h.email
    WHERE h.email<>?1 AND h.group_name IN (SELECT value FROM json_each(?2))
      AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=h.email)`,email,JSON.stringify(groups));
  const headEmails=new Set(heads.map(head=>head.email));
  const contacts=members.filter(member=>!headEmails.has(member.email)&&
    (salons.includes(member.salon)||user.role==='manager'&&member.manager));
  return {scopes,groups,members,contacts:[...contacts,...heads]};
}

async function handleCommunication(request,url,db,user,email,preview) {
  if (preview) return json({error:'Skrzynka jest dostępna na własnym koncie.'},403);
  const position=(await db.prepare('SELECT position FROM communication_positions WHERE email=? AND salon=?').bind(email,user.salon??'').first())?.position??null;
  const groups=(await lifeScopes(db,user)).filter(scope=>scope.scope==='group').map(scope=>scope.name);
  const access=`(EXISTS(SELECT 1 FROM communication_participants p WHERE p.thread=t.id AND p.email=?1)
     OR (t.kind='department' AND t.group_name IN (SELECT value FROM json_each(?3))
       AND EXISTS(SELECT 1 FROM communication_departments d WHERE d.group_name=t.group_name
         AND d.department=t.department AND (d.department=?2 OR d.manager=?4))))`;
  const scope=[email,position,JSON.stringify(groups),user.id??null];
  const thread=url.searchParams.get('thread');
  if (request.method==='GET') {
    if (url.searchParams.has('count')) {
      const result=await db.prepare(`SELECT COUNT(*) AS unread FROM communication_messages m
        JOIN communication_threads t ON t.id=m.thread LEFT JOIN communication_reads r ON r.thread=t.id AND r.email=?1
        WHERE ${access} AND m.author<>?1 AND m.id>COALESCE(r.last_read,0)`).bind(...scope).first();
      const events=await db.prepare('SELECT COUNT(*) AS unread FROM communication_events WHERE person=? AND read_at IS NULL').bind(user.id??null).first();
      const managesDepartment=await db.prepare(`SELECT 1 FROM communication_departments WHERE manager=?
        AND group_name IN (SELECT value FROM json_each(?)) LIMIT 1`).bind(user.id??null,JSON.stringify(groups)).first();
      return json({unread:result.unread+events.unread,managesDepartment:Boolean(managesDepartment)});
    }
    if (thread) {
      const info=await db.prepare(`SELECT t.id,t.title,t.kind FROM communication_threads t WHERE ${access} AND t.id=?5`).bind(...scope,thread).first();
      if (!info) return json({error:'Nie znaleziono rozmowy.'},404);
      const before=Number(url.searchParams.get('before'))||null;
      const messages=await list(db,`SELECT m.id,m.message,m.created_at AS date,m.author=?1 AS own,
          COALESCE(a.name,'Szef grupy') AS author FROM communication_messages m
        LEFT JOIN accounts a ON a.email=m.author WHERE m.thread=?2 AND (?3 IS NULL OR m.id<?3)
        ORDER BY m.id DESC LIMIT 51`,email,thread,before);
      return json({thread:info,messages:messages.slice(0,50).reverse(),hasOlder:messages.length>50});
    }
    const {contacts,scopes,members}=await communicationDirectory(db,user,email);
    const departments=await list(db,`SELECT group_name AS groupName,department,manager FROM communication_departments
      WHERE group_name IN (SELECT value FROM json_each(?))`,JSON.stringify(groups));
    const ownDepartments=departments.filter(item=>item.manager===user.id);
    const managedGroups=user.role==='group'?[user.group]:[...new Set(ownDepartments.map(item=>item.groupName))];
    const departmentPeople=members.filter(member=>managedGroups.includes(member.groupName));
    const inbox=await list(db,`SELECT t.id,t.title,t.kind,m.created_at AS date,
       (SELECT COUNT(*) FROM communication_messages x WHERE x.thread=t.id AND x.author<>?1
         AND x.id>COALESCE(r.last_read,0)) AS unread
      FROM communication_threads t JOIN communication_messages m ON m.id=(SELECT MAX(id) FROM communication_messages WHERE thread=t.id)
      LEFT JOIN communication_reads r ON r.thread=t.id AND r.email=?1
      WHERE ${access} ORDER BY (unread>0) DESC,m.id DESC LIMIT 100`,...scope);
    const events=await list(db,`SELECT id,kind,subject,read_at IS NULL AS unread FROM communication_events
      WHERE person=? ORDER BY unread DESC,id DESC LIMIT 50`,user.id??null);
    return json({inbox,events,contacts:contacts.map(({email:contact,name,salon,groupName})=>({contact,name,salon,groupName})),groups,
      departments,departmentLabels:communicationDepartments,ownDepartments,
      departmentAdmin:user.role==='group'?user.group:null,
      departmentPeople:departmentPeople.map(({id,name,salon,position,groupName})=>({id,name,salon,position,groupName})),
      announcements:scopes.filter(item=>item.moderate).map(({scope,name})=>({scope,name})),
      positions:communicationPositions});
  }
  if (request.method!=='POST'||request.headers.get('Origin')!==url.origin||
      !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Niedozwolone żądanie.'},403);
  let body;
  try {body=await request.json();} catch {return json({error:'Nieprawidłowe dane.'},400);}
  if (!body||typeof body!=='object') return json({error:'Nieprawidłowe dane.'},400);
  if (body.action==='event-read') {
    if (!Number.isSafeInteger(body.id)) return json({error:'Nieprawidłowe powiadomienie.'},400);
    await db.prepare("UPDATE communication_events SET read_at=datetime('now') WHERE id=? AND person=? AND read_at IS NULL")
      .bind(body.id,user.id??null).run();
    return json({ok:true});
  }
  if (body.action==='department-manager'||body.action==='department-staff') {
    const {group,department,person}=body;
    if (!groups.includes(group)||typeof department!=='string'||!Object.hasOwn(communicationDepartments,department))
      return json({error:'Wybierz dział z własnej grupy.'},403);
    const create=body.action==='department-manager';
    const office=await db.prepare('SELECT manager FROM communication_departments WHERE group_name=? AND department=?').bind(group,department).first();
    if (create ? user.role!=='group'||user.group!==group : !office||office.manager!==user.id)
      return json({error:'Brak uprawnień do zarządzania działem.'},403);
    const member=await db.prepare(`SELECT a.id,a.email,a.salon,cp.position FROM accounts a
      JOIN dealer_group_salons gs USING(salon)
      LEFT JOIN communication_positions cp ON cp.email=a.email AND cp.salon=a.salon
      WHERE a.id=? AND gs.group_name=? AND a.role<>'admin'
      AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=a.email)`).bind(person??null,group).first();
    if (!member) return json({error:'Wybierz pracownika z tej grupy.'},400);
    if (create) {
      await db.prepare(`INSERT INTO communication_departments(group_name,department,manager) VALUES (?,?,?)
        ON CONFLICT(group_name,department) DO UPDATE SET manager=excluded.manager`).bind(group,department,member.id).run();
    } else if (body.remove===true) {
      await db.prepare('DELETE FROM communication_positions WHERE email=? AND salon=? AND position=?').bind(member.email,member.salon,department).run();
    } else {
      const saved=await db.prepare(`INSERT INTO communication_positions(email,salon,position) VALUES (?,?,?)
        ON CONFLICT(email) DO UPDATE SET salon=excluded.salon,position=excluded.position
        WHERE communication_positions.salon<>excluded.salon OR communication_positions.position=excluded.position`).bind(member.email,member.salon,department).run();
      if (!saved.meta.changes) return json({error:'Pracownik ma już inne stanowisko.'},409);
    }
    return json({ok:true});
  }
  if (body.action==='read'||body.action==='reply') {
    const info=await db.prepare(`SELECT t.id,t.kind FROM communication_threads t WHERE ${access} AND t.id=?5`).bind(...scope,body.thread??null).first();
    if (!info) return json({error:'Nie znaleziono rozmowy.'},404);
    if (body.action==='read') {
      if (!Number.isSafeInteger(body.last)) return json({error:'Nieprawidłowy numer wiadomości.'},400);
      await db.prepare(`INSERT INTO communication_reads(thread,email,last_read)
        SELECT thread,?2,id FROM communication_messages WHERE thread=?1 AND id=?3
        ON CONFLICT(thread,email) DO UPDATE SET last_read=MAX(last_read,excluded.last_read)`).bind(info.id,email,body.last).run();
    } else {
      if (info.kind==='announcement'||!lifeText(body.message,4000)) return json({error:'Sprawdź treść odpowiedzi.'},400);
      await db.prepare('INSERT INTO communication_messages(thread,author,message) VALUES (?,?,?)').bind(info.id,email,body.message.trim()).run();
    }
    return json({ok:true});
  }
  if (body.action!=='send'||!lifeText(body.title,100)||!lifeText(body.message,4000)) return json({error:'Podaj temat i treść wiadomości.'},400);
  const {contacts,scopes,members}=await communicationDirectory(db,user,email);
  const recipients=new Set([email]);
  let group=null,department=null;
  if (body.kind==='direct'&&contacts.some(contact=>contact.email===body.recipient)) recipients.add(body.recipient);
  else if (body.kind==='department'&&groups.includes(body.group)&&typeof body.department==='string'&&await db.prepare(
    'SELECT 1 FROM communication_departments WHERE group_name=? AND department=?').bind(body.group,body.department).first()) {
    group=body.group;
    department=body.department;
  } else if (body.kind==='announcement'&&scopes.some(scope=>scope.moderate&&scope.scope===body.scope&&scope.name===body.audience)) {
    for (const member of members) if ((body.scope==='group'?member.groupName:member.salon)===body.audience) recipients.add(member.email);
    group=body.scope==='group'?body.audience:(await db.prepare('SELECT group_name FROM dealer_group_salons WHERE salon=?').bind(body.audience).first())?.group_name??null;
    const heads=await list(db,'SELECT email FROM dealer_group_heads h WHERE group_name=? AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=h.email)',group);
    for (const head of heads) recipients.add(head.email);
  } else return json({error:'Brak dostępu do wybranego odbiorcy.'},403);
  if (body.kind==='announcement'&&recipients.size===1) return json({error:'Wybrany odbiorca nie ma aktywnych użytkowników.'},400);
  const id=crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO communication_threads(id,author,kind,title,group_name,department) VALUES (?,?,?,?,?,?)')
      .bind(id,email,body.kind,department?communicationDepartments[department]+' · '+body.title.trim():body.title.trim(),group,department),
    db.prepare('INSERT INTO communication_participants(thread,email) SELECT ?1,value FROM json_each(?2)').bind(id,JSON.stringify([...recipients])),
    db.prepare('INSERT INTO communication_messages(thread,author,message) VALUES (?,?,?)').bind(id,email,body.message.trim())
  ]);
  return json({thread:id},201);
}
