const reportCounterIndexes=[0,1,2,4,5,6,7,10,8,9];
const reportSalesIndexes=[6,8,7,9];
const reportClockFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',dateStyle:'short',timeStyle:'medium'});

function reportClock(now=new Date()) {
  const [day,time]=reportClockFormatter.format(now).split(' ');
  return {day,time};
}

async function recordReportEvent(db,email,kind) {
  const {day,time}=reportClock();
  await db.prepare(`INSERT INTO management_report_events VALUES (?,?,?,?)
    ON CONFLICT(email,day,kind) DO UPDATE SET local_time=min(local_time,excluded.local_time)`).bind(email,day,kind,time).run();
}

function addReportCounts(totals,values) {
  values.forEach((value,index)=>{totals[index]+=value;});
}

function summarizeReportRows(rows) {
  const actuals=reportCounterIndexes.map(()=>0);
  const sources=Array.from({length:sourceCount},()=>({leads:0,orders:0}));
  for (const row of rows) {
    const values=JSON.parse(row.counters);
    if (Array.isArray(values[5])) {
      for (const [index,source] of values[5].entries()) {
        addReportCounts(actuals,reportCounterIndexes.map(i=>source[i]??0));
        sources[index].leads+=source[0]??0;
        sources[index].orders+=source[7]??0;
      }
    } else {
      // Old aggregate-only records did not track lead sources.
      addReportCounts(actuals,[0,values[0]??0,0,values[2]??0,values[3]??0,0,values[4]??0,0,0,0]);
    }
  }
  return {actuals,sources};
}

function reportSellerTargets(plan,adjustment) {
  if (!plan) return reportCounterIndexes.map(()=>null);
  const [orders,registrations,invoices,reviews]=plan.targets;
  const fallback=orders==null?[]:sourceTargets(orders);
  return [...[3,0,4,1,2,5].map(index=>plan.funnelTargets[index]??(fallback.length
    ?fallback.reduce((sum,row)=>sum+row[[1,4,5,0,2,6][index]],0):null)),
  orders,invoices,registrations,reviews].map(target=>effectiveCalendarTarget(target,adjustment));
}

const reportWorkMonths=new Map();
function reportWorkdays(month) {
  if (!reportWorkMonths.has(month)) reportWorkMonths.set(month,calendarMonthDays(month).filter(isSalonWorkday));
  return reportWorkMonths.get(month);
}

function recommendLeadSources(sellers,plans,nextPlans) {
  const assignable=[1,2,4,7,8,12];
  const nextBySeller=new Map(nextPlans.map(plan=>[plan.id,plan]));
  const plansBySeller=new Map(plans.map(plan=>[plan.id,plan]));
  const recommendations=[];
  for (const seller of sellers) {
    if (seller.archived) continue;
    const next=nextBySeller.get(seller.id);
    const plan=next?.sourceTargets?.length?next:plansBySeller.get(seller.id);
    if (!plan?.sourceTargets?.length) continue;
    const planned=effectiveSourcePlan(plan.sourceTargets,plan.absenceAdjustment);
    for (const source of assignable) {
      const {leads,orders}=seller.sources[source];
      const extra=Math.max(0,(planned[source]?.[0]??0)-leads);
      const conversion=leads?orders/leads:0;
      if (extra>0&&leads>=20&&orders>0&&orders<=leads&&conversion>=sourceAssumptions[source][0]) {
        recommendations.push({seller:seller.name,source,extra,leads,orders,basis:plan===next?'next':'current'});
      }
    }
  }
  return recommendations.sort((a,b)=>b.extra-a.extra||b.orders/b.leads-a.orders/a.leads);
}

async function buildManagementReport(db,{type,month,through,reportDay,sellers,salons,scope,params,loadPlans}) {
  const first=month+'-01';
  const days=reportWorkdays(month);
  const nextDate=new Date(first+'T00:00:00Z');
  nextDate.setUTCMonth(nextDate.getUTCMonth()+1);
  const nextMonth=nextDate.toISOString().slice(0,7);
  const range='day BETWEEN ? AND ? AND '+scope;
  const [daily,drafts,calendar,exceptions,trackingRows,adjustments,planData,nextPlanData,events,archives]=await Promise.all([
    list(db,'SELECT person,day,counters FROM daily_results WHERE '+range+' AND '+includedDailyResult,first,through,...params),
    type==='daily'?list(db,'SELECT person,day FROM daily_drafts WHERE '+range,first,through,...params):[],
    list(db,"SELECT person,day,kind,status FROM work_calendar WHERE (substr(day,1,7)=? OR day=?) AND "+scope,
      month,type==='daily'?reportDay:null,...params),
    list(db,'SELECT person,day,kind FROM daily_exceptions WHERE '+range,first,through,...params),
    list(db,'SELECT person,start_day FROM daily_tracking WHERE '+scope,...params),
    calendarAdjustments(db,[month],scope,...params),
    loadPlans(month),
    type==='marketing'?loadPlans(nextMonth):null,
    type==='daily'?list(db,"SELECT email,kind FROM management_report_events WHERE day=? AND local_time<=?",reportDay,'11:00:00'):[],
    type==='daily'?list(db,`SELECT a.id AS person,p.first_excluded_day,p.restored_day FROM archive_report_days p
      JOIN accounts a USING(email) WHERE ${scope.replace(/^person /,'a.id ')}`,...params):[]
  ]);
  const byPerson=rows=>Map.groupBy(rows,row=>row.person);
  const records=byPerson(daily), draftsByPerson=byPerson(drafts), absences=byPerson(calendar),
    exceptionsByPerson=byPerson(exceptions), archivesByPerson=byPerson(archives);
  const started=new Map(trackingRows.map(row=>[row.person,row.start_day]));
  const eventKeys=new Set(events.map(row=>row.email+'/'+row.kind));
  const plansBySalon=new Map(planData.plans.map(plan=>[plan.salon,plan]));
  const nextBySalon=new Map(nextPlanData?.plans.map(plan=>[plan.salon,plan])??[]);
  const sellerEmails=type==='daily'?new Map((await list(db,'SELECT id,email FROM accounts WHERE '+scope.replace(/^person /,'id '),...params))
    .map(row=>[row.id,row.email])):new Map();
  const salonsWithSellers=Map.groupBy(sellers,seller=>seller.salon);
  const archiveDaysBySeller=new Map(sellers.map(seller=>[seller.id,archivesByPerson.get(seller.id)??[]]));

  return {type,month,through,salons:salons.map(({salon})=>{
    const plan=plansBySalon.get(salon);
    const sellerPlans=plan?.team??[];
    const byId=new Map(sellerPlans.map(person=>[person.id,person]));
    const people=(salonsWithSellers.get(salon)??[]).flatMap(seller=>{
      const rows=records.get(seller.id)??[];
      const archived=seller.accountStatus==='inactive';
      if (archived&&!rows.length) return [];
      const {actuals,sources}=summarizeReportRows(rows);
      const adjustment=adjustments[seller.id+'/'+month];
      const targets=reportSellerTargets(byId.get(seller.id),adjustment);
      const leave=new Set((absences.get(seller.id)??[]).filter(row=>row.status==='approved').map(row=>row.day));
      const zero=new Set();
      const pending=new Set((absences.get(seller.id)??[]).filter(row=>row.status==='pending').map(row=>row.day));
      for (const {day,kind} of exceptionsByPerson.get(seller.id)??[]) {
        if (kind==='zero') zero.add(day);
        if (kind==='leave'||kind==='training') leave.add(day);
        if (kind==='pending') pending.add(day);
      }
      const scheduled=days.filter(day=>!leave.has(day));
      const elapsed=scheduled.filter(day=>day<=through).length;
      const expected=targets.map(target=>target==null?null:scheduled.length?target*elapsed/scheduled.length:0);
      const weakest=expected.map((goal,index)=>({goal,index,ratio:goal>0?actuals[index]/goal:1}))
        .filter(metric=>metric.goal>0&&metric.ratio<1).sort((a,b)=>a.ratio-b.ratio||b.goal-a.goal)[0];
      const item={id:seller.id,name:seller.name,archived,actuals,sources,targets,expected,
        weakest:weakest?{index:weakest.index,gap:Math.ceil(weakest.goal-actuals[weakest.index])}:null};
      if (type==='daily'&&!archived) {
        const start=started.get(seller.id);
        const archivedPeriods=archiveDaysBySeller.get(seller.id);
        const required=start?scheduled.filter(day=>day>=start&&day<=through&&
          !archivedPeriods.some(interval=>interval.first_excluded_day<=day&&(!interval.restored_day||day<interval.restored_day))):[];
        const approved=new Set(rows.map(row=>row.day));
        const draftDays=new Set((draftsByPerson.get(seller.id)??[]).map(row=>row.day));
        const open=required.filter(day=>!approved.has(day)&&!zero.has(day));
        const email=sellerEmails.get(seller.id);
        item.check={login:eventKeys.has(email+'/login'),read:eventKeys.has(email+'/read'),
          readExpected:isSalonWorkday(reportDay)&&!leave.has(reportDay),
          started:Boolean(start),required:required.length,approved:required.filter(day=>approved.has(day)).length,
          zero:required.filter(day=>!approved.has(day)&&zero.has(day)).length,
          pending:open.filter(day=>pending.has(day)),drafts:open.filter(day=>!pending.has(day)&&draftDays.has(day)),
          missing:open.filter(day=>!pending.has(day)&&!draftDays.has(day))};
      }
      return [item];
    });
    const totals=reportCounterIndexes.map(()=>0);
    const sources=Array.from({length:sourceCount},()=>({leads:0,orders:0}));
    for (const person of people) {
      addReportCounts(totals,person.actuals);
      for (const [index,source] of person.sources.entries()) {
        sources[index].leads+=source.leads;
        sources[index].orders+=source.orders;
      }
    }
    const salonTargets=reportCounterIndexes.map((_,index)=>{
      const slot=reportSalesIndexes.indexOf(index);
      if (slot>=0) return plan?.configured[slot]?plan.targets[slot]:null;
      const goals=people.map(person=>person.targets[index]).filter(value=>value!=null);
      return goals.length?goals.reduce((sum,value)=>sum+value,0):null;
    });
    return {salon,totals,targets:salonTargets,people,sources,
      recommendations:type==='marketing'?recommendLeadSources(people,sellerPlans,nextBySalon.get(salon)?.team??[]):[]};
  })};
}

async function generateDailyReports(db) {
  const {day,time}=reportClock();
  if (time<'11:00:00') return null;
  const recipients=await list(db,`SELECT a.email,'manager' AS role FROM accounts a
    WHERE NOT EXISTS (SELECT 1 FROM archived_users x WHERE x.email=a.email)
      AND (EXISTS (SELECT 1 FROM account_roles r WHERE r.person=a.id AND r.role='manager')
        OR (a.role='manager' AND NOT EXISTS (SELECT 1 FROM account_roles r WHERE r.person=a.id)
          AND NOT EXISTS (SELECT 1 FROM dealer_group_heads h WHERE h.email=a.email)))
    UNION ALL SELECT h.email,'group' FROM dealer_group_heads h
    WHERE NOT EXISTS (SELECT 1 FROM archived_users x WHERE x.email=h.email)
      AND (NOT EXISTS (SELECT 1 FROM accounts a JOIN account_roles r ON r.person=a.id WHERE a.email=h.email)
        OR EXISTS (SELECT 1 FROM accounts a JOIN account_roles r ON r.person=a.id AND r.role='group' WHERE a.email=h.email))`);
  let failures=0;
  for (const {email,role} of recipients) {
    if (await db.prepare('SELECT 1 FROM management_daily_reports WHERE email=? AND role=? AND day=?').bind(email,role,day).first()) continue;
    const url=new URL('/api/management-reports','https://biegwyzej.pl');
    url.search=new URLSearchParams({type:'daily',role,day});
    try {
      const response=await handle(new Request(url,{headers:{'oai-authenticated-user-email':email,'oai-authenticated-user-id':'report-scheduler'}}),{DB:db},true);
      if (!response.ok) failures++;
    } catch { failures++; }
  }
  if (failures) throw new Error('Nie udało się wygenerować '+failures+' raportów dziennych.');
  return day;
}
