const communicationDepartments={carwash:'Myjnia',logistics:'Logistyka i transport'};
const salonStaffRoles=['staff','reception','sales_assistant'];
const isDepartmentRole=role=>typeof role==='string'&&Object.hasOwn(communicationDepartments,role.replace(/_manager$/,''));
const staffRoles=[...salonStaffRoles,'carwash_manager','logistics_manager','carwash','logistics'];
const accountRoleOrder=['group','manager','seller',...staffRoles];

const departmentMembership=`(d.manager=a.id OR EXISTS(SELECT 1 FROM communication_department_members dm
  WHERE dm.person=a.id AND dm.department=d.department AND dm.group_name=d.group_name))`;

async function communicationDirectory(db,user,email) {
  const scopes=await lifeScopes(db,user);
  const groups=scopes.filter(item=>item.scope==='group').map(item=>item.name);
  const salons=scopes.filter(item=>item.scope==='salon').map(item=>item.name);
  const members=await list(db,`SELECT a.id,a.email,a.name,a.salon,gs.group_name AS groupName,
      CASE WHEN EXISTS(SELECT 1 FROM account_roles r WHERE r.person=a.id)
        THEN EXISTS(SELECT 1 FROM account_roles r WHERE r.person=a.id AND r.role='manager')
        ELSE a.role='manager' END AS manager
    FROM accounts a LEFT JOIN dealer_group_salons gs USING(salon)
    WHERE a.email<>?1 AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=a.email)
      AND (a.salon IN (SELECT value FROM json_each(?2)) OR gs.group_name IN (SELECT value FROM json_each(?3)))
    ORDER BY a.name,a.id`,email,JSON.stringify(salons),JSON.stringify(groups));
  const heads=await list(db,`SELECT h.email,COALESCE(a.name,'Szef grupy') AS name,h.group_name AS groupName
    FROM dealer_group_heads h LEFT JOIN accounts a ON a.email=h.email
    WHERE h.email<>?1 AND h.group_name IN (SELECT value FROM json_each(?2))
      AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=h.email)`,email,JSON.stringify(groups));
  const departmentAccounts=await list(db,`SELECT DISTINCT a.id,a.email,a.name,a.salon,d.group_name AS groupName
    FROM accounts a JOIN communication_departments d ON ${departmentMembership}
    WHERE a.email<>?1 AND a.role<>'admin' AND d.group_name IN (SELECT value FROM json_each(?2))
      AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=a.email)
    ORDER BY a.name,a.id`,email,JSON.stringify(groups));
  const headEmails=new Set(heads.map(head=>head.email));
  const contacts=[...new Map([...members.filter(member=>
    salons.includes(member.salon)||user.role==='manager'&&member.manager),...departmentAccounts]
    .filter(member=>!headEmails.has(member.email)).map(member=>[member.email,member])).values()];
  return {scopes,groups,members,departmentAccounts,contacts:[...contacts,...heads]};
}

async function handleCommunication(request,url,db,user,email,preview) {
  if (preview) return json({error:'Skrzynka jest dostępna na własnym koncie.'},403);
  const groups=(await lifeScopes(db,user)).filter(scope=>scope.scope==='group').map(scope=>scope.name);
  const access=`(EXISTS(SELECT 1 FROM communication_participants p WHERE p.thread=t.id AND p.email=?1)
     OR (t.kind='department' AND t.group_name IN (SELECT value FROM json_each(?2))
       AND EXISTS(SELECT 1 FROM communication_departments d WHERE d.group_name=t.group_name
         AND d.department=t.department AND (d.manager=?3 OR EXISTS (
           SELECT 1 FROM communication_department_members dm
           WHERE dm.person=?3 AND dm.group_name=d.group_name AND dm.department=d.department)))))`;
  const scope=[email,JSON.stringify(groups),user.id??null];
  const thread=url.searchParams.get('thread');
  if (request.method==='GET') {
    if (url.searchParams.has('count')) {
      const result=await db.prepare(`SELECT COUNT(*) AS unread FROM communication_messages m
        JOIN communication_threads t ON t.id=m.thread LEFT JOIN communication_reads r ON r.thread=t.id AND r.email=?1
        WHERE ${access} AND m.author<>?1 AND m.id>COALESCE(r.last_read,0)`).bind(...scope).first();
      const events=await db.prepare('SELECT COUNT(*) AS unread FROM communication_events WHERE person=? AND read_at IS NULL').bind(user.id??null).first();
      const managesDepartment=await db.prepare(`SELECT 1 FROM communication_departments WHERE manager=? AND department||'_manager'=?
        AND group_name IN (SELECT value FROM json_each(?)) LIMIT 1`).bind(user.id??null,user.activeRole,JSON.stringify(groups)).first();
      return json({unread:result.unread+events.unread,managesDepartment:Boolean(managesDepartment)});
    }
    if (thread) {
      const info=await db.prepare(`SELECT t.id,t.title,t.kind FROM communication_threads t WHERE ${access} AND t.id=?4`).bind(...scope,thread).first();
      if (!info) return json({error:'Nie znaleziono rozmowy.'},404);
      const before=Number(url.searchParams.get('before'))||null;
      const messages=await list(db,`SELECT m.id,m.message,m.created_at AS date,m.author=?1 AS own,
          COALESCE(a.name,'Szef grupy') AS author FROM communication_messages m
        LEFT JOIN accounts a ON a.email=m.author WHERE m.thread=?2 AND (?3 IS NULL OR m.id<?3)
        ORDER BY m.id DESC LIMIT 51`,email,thread,before);
      return json({thread:info,messages:messages.slice(0,50).reverse(),hasOlder:messages.length>50});
    }
    const {contacts,scopes,members,departmentAccounts}=await communicationDirectory(db,user,email);
    const departments=await list(db,`SELECT group_name AS groupName,department,name,manager FROM communication_departments
      WHERE group_name IN (SELECT value FROM json_each(?))`,JSON.stringify(groups));
    const ownDepartments=departments.filter(item=>item.manager===user.id&&item.department+'_manager'===user.activeRole);
    const managedGroups=user.role==='group'?[user.group]:[...new Set(ownDepartments.map(item=>item.groupName))];
    const standaloneAccounts=await list(db,`SELECT a.id,a.name,a.salon,g.group_name AS groupName
      FROM communication_department_accounts g JOIN accounts a ON a.id=g.person
      WHERE a.email<>?1 AND g.group_name IN (SELECT value FROM json_each(?2))
        AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=a.email)`,email,JSON.stringify(managedGroups));
    const departmentPeople=[...new Map([...members,...departmentAccounts,...standaloneAccounts].filter(member=>
      managedGroups.includes(member.groupName)).map(member=>[JSON.stringify([member.id,member.groupName]),member])).values()];
    const memberships=await list(db,`SELECT person,group_name AS groupName,department FROM communication_department_members
      WHERE group_name IN (SELECT value FROM json_each(?))`,JSON.stringify(managedGroups));
    const inbox=await list(db,`SELECT t.id,t.title,t.kind,m.created_at AS date,
       (SELECT COUNT(*) FROM communication_messages x WHERE x.thread=t.id AND x.author<>?1
         AND x.id>COALESCE(r.last_read,0)) AS unread
      FROM communication_threads t JOIN communication_messages m ON m.id=(SELECT MAX(id) FROM communication_messages WHERE thread=t.id)
      LEFT JOIN communication_reads r ON r.thread=t.id AND r.email=?1
      WHERE ${access} ORDER BY (unread>0) DESC,m.id DESC LIMIT 100`,...scope);
    const events=await list(db,`SELECT id,kind,subject,read_at IS NULL AS unread FROM communication_events
      WHERE person=? ORDER BY unread DESC,id DESC LIMIT 50`,user.id??null);
    return json({inbox,events,contacts:contacts.map(({email:contact,name,salon,groupName})=>({contact,name,salon,groupName})),groups,
      departments,ownDepartments,memberships,
      departmentAdmin:user.role==='group'?user.group:null,
      departmentPeople:departmentPeople.map(({id,name,salon,groupName})=>({id,name,salon,groupName})),
      announcements:scopes.filter(item=>item.moderate).map(({scope,name})=>({scope,name}))});
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
    const appoint=body.action==='department-manager';
    const office=await db.prepare('SELECT manager FROM communication_departments WHERE group_name=? AND department=?').bind(group,department).first();
    if (!office||(appoint ? user.role!=='group'||user.group!==group : office.manager!==user.id||user.activeRole!==department+'_manager'))
      return json({error:'Brak uprawnień do zarządzania działem.'},403);
    const member=await db.prepare(`SELECT a.id,a.email,a.role FROM accounts a
      WHERE a.id=?1 AND a.email<>?3 AND a.role<>'admin'
      AND NOT EXISTS(SELECT 1 FROM dealer_group_heads h WHERE h.email=a.email)
      AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=a.email)
      AND (EXISTS(SELECT 1 FROM dealer_group_salons gs WHERE gs.salon=a.salon AND gs.group_name=?2)
        OR EXISTS(SELECT 1 FROM communication_departments d WHERE d.group_name=?2 AND ${departmentMembership})
        OR EXISTS(SELECT 1 FROM communication_department_accounts da WHERE da.person=a.id AND da.group_name=?2))`)
      .bind(person??null,group,email).first();
    if (!member) return json({error:'Wybierz aktywnego pracownika z tej grupy.'},400);
    const role=appoint?department+'_manager':department;
    const insertRole=db.prepare('INSERT OR IGNORE INTO account_roles(person,role) VALUES (?,?)').bind(member.id,role);
    const preserveLegacy=db.prepare(`INSERT INTO account_roles(person,role)
      SELECT id,role FROM accounts WHERE id=?1 AND salon<>'' AND NOT EXISTS(SELECT 1 FROM account_roles WHERE person=?1)`).bind(member.id);
    if (appoint) {
      await db.batch([
        preserveLegacy,insertRole,
        db.prepare('UPDATE communication_departments SET manager=? WHERE group_name=? AND department=?').bind(member.id,group,department),
        db.prepare(`DELETE FROM account_roles WHERE person=?1 AND role=?2 AND NOT EXISTS(
          SELECT 1 FROM communication_departments d WHERE d.manager=?1 AND d.department||'_manager'=?2)`).bind(office.manager,role)
      ]);
    } else if (body.remove===true) {
      const assignment=await db.prepare('SELECT 1 FROM communication_department_members WHERE person=? AND group_name=? AND department=?')
        .bind(member.id,group,department).first();
      if (!assignment) return json({error:'Pracownik nie należy do tego działu.'},404);
      await db.batch([
        db.prepare('DELETE FROM communication_department_members WHERE person=? AND group_name=? AND department=?').bind(member.id,group,department),
        db.prepare('DELETE FROM account_roles WHERE person=? AND role=?').bind(member.id,role)
      ]);
    } else {
      const assignment=await db.prepare('SELECT group_name FROM communication_department_members WHERE person=? AND department=?')
        .bind(member.id,department).first();
      if (assignment&&assignment.group_name!==group) return json({error:'Pracownik ma tę rolę w innej grupie.'},409);
      await db.batch([
        preserveLegacy,insertRole,
        db.prepare('INSERT OR IGNORE INTO communication_department_members(person,group_name,department) VALUES (?,?,?)').bind(member.id,group,department)
      ]);
    }
    return json({ok:true});
  }
  if (body.action==='read'||body.action==='reply') {
    const info=await db.prepare(`SELECT t.id,t.kind FROM communication_threads t WHERE ${access} AND t.id=?4`).bind(...scope,body.thread??null).first();
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
  const {contacts,scopes,members,departmentAccounts}=await communicationDirectory(db,user,email);
  const recipients=new Set([email]);
  let group=null,department=null,departmentName=null;
  if (body.kind==='direct'&&contacts.some(contact=>contact.email===body.recipient)) recipients.add(body.recipient);
  else if (body.kind==='department'&&groups.includes(body.group)&&typeof body.department==='string'&&(departmentName=(await db.prepare(
    'SELECT name FROM communication_departments WHERE group_name=? AND department=?').bind(body.group,body.department).first())?.name)) {
    group=body.group;
    department=body.department;
  } else if (body.kind==='announcement'&&scopes.some(scope=>scope.moderate&&scope.scope===body.scope&&scope.name===body.audience)) {
    const audienceMembers=body.scope==='group'?[...members,...departmentAccounts]:members;
    for (const member of audienceMembers) if ((body.scope==='group'?member.groupName:member.salon)===body.audience) recipients.add(member.email);
    group=body.scope==='group'?body.audience:(await db.prepare('SELECT group_name FROM dealer_group_salons WHERE salon=?').bind(body.audience).first())?.group_name??null;
    const heads=await list(db,'SELECT email FROM dealer_group_heads h WHERE group_name=? AND NOT EXISTS(SELECT 1 FROM archived_users x WHERE x.email=h.email)',group);
    for (const head of heads) recipients.add(head.email);
  } else return json({error:'Brak dostępu do wybranego odbiorcy.'},403);
  if (body.kind==='announcement'&&recipients.size===1) return json({error:'Wybrany odbiorca nie ma aktywnych użytkowników.'},400);
  const id=crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO communication_threads(id,author,kind,title,group_name,department) VALUES (?,?,?,?,?,?)')
      .bind(id,email,body.kind,departmentName?departmentName+' · '+body.title.trim():body.title.trim(),group,department),
    db.prepare('INSERT INTO communication_participants(thread,email) SELECT ?1,value FROM json_each(?2)').bind(id,JSON.stringify([...recipients])),
    db.prepare('INSERT INTO communication_messages(thread,author,message) VALUES (?,?,?)').bind(id,email,body.message.trim())
  ]);
  return json({thread:id},201);
}
