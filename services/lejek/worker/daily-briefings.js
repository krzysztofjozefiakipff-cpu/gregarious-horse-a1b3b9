const briefingSalesIndexes=[6,7,8,9];
const briefingTotals=people=>briefingSalesIndexes.map((_,i)=>people.reduce((sum,row)=>sum+row.actual[i],0));

function briefingGoalValues(targets,actuals,days,day,correction=[]) {
  if (!days.includes(day)) return targets.map(target=>target==null?null:0);
  const remaining=days.filter(date=>date>=day).length;
  return targets.map((target,i)=>correction?.[i]??dailyTarget(target,actuals[i],remaining,true));
}

function briefingRemainingPlan(targets,past,days,today,todayGoals) {
  const remaining=targets.map((target,i)=>target==null?null:Math.max(0,target-past[i]));
  const dates=days.filter(day=>day>=today);
  return dates.map((day,index)=>{
    const goals=remaining.map((left,i)=>day===today?todayGoals[i]:dailyTarget(left,0,dates.length-index,true));
    goals.forEach((goal,i)=>{
      if (remaining[i]!=null) remaining[i]=Math.max(0,remaining[i]-(goal??0));
    });
    return {day,goals};
  });
}

function acceptedBriefingGoals(signoff,dayOff) {
  if (!signoff) return null;
  const [goals,savedDayOff]=JSON.parse(signoff.accepted_plan);
  return savedDayOff===dayOff?goals:null;
}

async function resolveBriefingPrevious(db,{person,today,manager,review,rows,absence,timestamp,reviewStatement}) {
  const day=review.day;
  const draft=JSON.parse(review.version)[3].draft;
  const counters=absence?null:dailyCounters(rows);
  const currentState=`(SELECT rows FROM daily_drafts WHERE person=?1 AND day=?2) IS ?4
    AND NOT EXISTS (SELECT 1 FROM daily_exceptions WHERE person=?1 AND day=?2 AND kind IN ('leave','training','zero'))
    AND NOT EXISTS (SELECT 1 FROM work_calendar WHERE person=?1 AND day=?2 AND status='approved')`;
  const write=absence
    ?db.prepare(`INSERT INTO work_calendar(person,day,kind,status)
      SELECT ?1,?2,?3,'approved' WHERE ${currentState}
        AND NOT EXISTS (SELECT 1 FROM daily_results WHERE person=?1 AND day=?2)
      ON CONFLICT(person,day) DO UPDATE SET kind=excluded.kind,status='approved'`).bind(person,day,absence,draft)
    :db.prepare(`INSERT INTO daily_results(person,day,counters)
      SELECT ?1,?2,?3 WHERE ${currentState} ON CONFLICT(person,day) DO NOTHING`).bind(person,day,counters,draft);

  const token=crypto.randomUUID();
  const written=`EXISTS (SELECT 1 FROM daily_briefing_day_resolutions WHERE id=?)`;
  const actual=summarizeReportRows(counters?[{counters}]:[]).actuals;
  const version=JSON.stringify(absence?[day,actual,null,'off:'+absence]:[day,actual,counters]);
  const statements=[write,
    db.prepare(`INSERT INTO daily_briefing_day_resolutions
      (id,person,briefing_day,reviewed_day,manager,outcome,draft_rows,resolved_at)
      SELECT ?,?,?,?,?,?,?,? WHERE changes()=1`).bind(token,person,today,day,manager,absence??'work',draft,timestamp),
    reviewStatement(version,true),
    db.prepare(`UPDATE daily_exceptions SET kind='rejected' WHERE person=? AND day=? AND kind='pending' AND ${written}`)
      .bind(person,day,token),
    db.prepare(`DELETE FROM daily_briefing_signoffs WHERE person=? AND day=? AND ${written}`).bind(person,today,token)
  ];
  if (absence) {
    statements.push(db.prepare(`DELETE FROM daily_drafts WHERE person=? AND day=? AND ${written}`).bind(person,day,token));
  } else {
    statements.push(db.prepare(`UPDATE work_calendar SET status='rejected' WHERE person=? AND day=? AND status='pending' AND ${written}`)
      .bind(person,day,token));
  }
  const [result]=await db.batch(statements);
  return Boolean(result.meta.changes);
}

async function buildDailyBriefing(db,{today,sellers,salons,scope,params,sellerTargets,salonPlans,managerId}) {
  const yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
  const month=today.slice(0,7);
  const [calendar,tracking]=await Promise.all([
    list(db,`SELECT person,day,kind,status,NULL AS reason FROM work_calendar WHERE day<=? AND status IN ('approved','pending') AND `+scope+
      ` UNION ALL SELECT person,day,kind,CASE kind WHEN 'pending' THEN 'pending' ELSE 'approved' END,reason FROM daily_exceptions
      WHERE day<=? AND kind IN ('leave','training','zero','pending') AND `+scope,today,...params,today,...params),
    list(db,'SELECT person,start_day FROM daily_tracking WHERE '+scope,...params)
  ]);
  const personalCalendar=Map.groupBy(calendar,row=>row.person);
  const trackingDays=new Map(tracking.map(row=>[row.person,row.start_day]));
  const schedules=new Map(sellers.map(({id})=>{
    const calendar=personalCalendar.get(id)??[];
    const off=new Set(calendar.filter(row=>row.status==='approved'&&row.kind!=='zero').map(row=>row.day));
    let day=yesterday;
    while (!isSalonWorkday(day)||off.has(day)) {
      day=new Date(Date.parse(day)-86400000).toISOString().slice(0,10);
    }
    return [id,{off,candidate:day}];
  }));
  const months=[...new Set([month,...[...schedules.values()].map(({candidate})=>candidate.slice(0,7))])].sort();
  const first=months[0]+'-01';
  const activeDays=[...new Set([...schedules.values()].map(({candidate})=>candidate))];
  const [results,drafts,settings,reviews,signoffs,adjustments,plans]=await Promise.all([
    list(db,'SELECT person,day,counters FROM daily_results WHERE day BETWEEN ? AND ? AND '+scope+' AND '+includedDailyResult,first,today,...params),
    list(db,`SELECT person,day,rows FROM daily_drafts WHERE day IN (SELECT value FROM json_each(?))
      AND ${scope} AND ${inReportDay(resultAddress('daily_drafts'),'daily_drafts.day')}`,JSON.stringify(activeDays),...params),
    list(db,'SELECT * FROM daily_briefing_settings WHERE day BETWEEN ? AND ? AND '+scope+' ORDER BY day DESC',first,today,...params),
    list(db,`SELECT r.*,a.name AS manager_name FROM daily_briefing_reviews r JOIN accounts a ON a.id=r.manager
      WHERE r.day IN (SELECT value FROM json_each(?)) AND `+scope,JSON.stringify(activeDays),...params),
    list(db,'SELECT * FROM daily_briefing_signoffs WHERE (day=? OR day IN (SELECT value FROM json_each(?))) AND '+scope,
      today,JSON.stringify(activeDays),...params),
    calendarAdjustments(db,months,scope,...params),
    Promise.all(salons.flatMap(({salon})=>months.map(async m=>[salon+'/'+m,new Map((await sellerTargets(salon,m)).map(plan=>[plan.id,plan]))])))
  ]);
  const personalResults=Map.groupBy(results,row=>row.person);
  const draftByDay=new Map(drafts.map(row=>[row.person+'/'+row.day,row.rows]));
  const personalSettings=Map.groupBy(settings,row=>row.person);
  const participants=Map.groupBy(sellers,row=>row.salon);
  const reviewed=new Map(reviews.map(row=>[row.person+'/'+row.day,row]));
  const signed=new Map(signoffs.map(row=>[row.person+'/'+row.day,row]));
  const plansByMonth=new Map(plans);
  const salonPlanByName=new Map(salonPlans.map(row=>[row.salon,row]));

  return {type:'briefing',month,today,yesterday,generatedAt:new Date().toISOString(),salons:salons.map(({salon})=>{
    const people=(participants.get(salon)??[]).flatMap(seller=>{
      const {id,name}=seller;
      const rows=personalResults.get(id)??[];
      const current=rows.filter(row=>row.day>=month+'-01');
      const archived=seller.accountStatus==='inactive';
      if (archived&&!current.length) return [];
      const editable=!archived&&Boolean(seller.planEligible);
      const dates=personalCalendar.get(id)??[];
      const {off,candidate}=schedules.get(id);
      const previousRow=rows.find(row=>row.day===candidate);
      const draft=draftByDay.get(id+'/'+candidate);
      const approvedZero=dates.some(row=>row.day===candidate&&row.kind==='zero');
      const pendingPrevious=dates.find(row=>row.day===candidate&&row.status==='pending');
      const previousDay=candidate;
      const reviewMonth=previousDay.slice(0,7);
      const scheduled=m=>reportWorkdays(m).filter(date=>!off.has(date));
      const days=scheduled(month);
      const reviewDays=reviewMonth===month?days:scheduled(reviewMonth);
      const monthlyGoals=m=>reportSellerTargets(plansByMonth.get(salon+'/'+m)?.get(id),adjustments[id+'/'+m]);
      const sales=monthlyGoals(month);
      const actuals=summarizeReportRows(current).actuals;
      const past=summarizeReportRows(current.filter(row=>row.day<today)).actuals;
      const reviewPast=summarizeReportRows(rows.filter(row=>row.day.startsWith(reviewMonth)&&row.day<previousDay)).actuals;
      const personSettings=personalSettings.get(id)??[];
      const todaySettings=personSettings.find(row=>row.day===today);
      const previousSettings=personSettings.find(row=>row.day===previousDay);
      const forecastSettings=personSettings.find(row=>row.day.startsWith(month));
      const previousMatrix=previousRow?JSON.parse(previousRow.counters)[5]:draft?JSON.parse(draft):null;
      const previousStatus=previousRow||approvedZero?'recorded':draft?'draft':pendingPrevious?'pending':'missing';
      const previousActual=summarizeReportRows(previousRow?[previousRow]
        :previousStatus==='draft'&&validDailyRows(previousMatrix)?[{counters:dailyCounters(previousMatrix)}]:[]).actuals;
      const reviewVersion=JSON.stringify(previousStatus==='recorded'?[previousDay,previousActual,previousRow?.counters??null]
        :[previousDay,previousActual,null,{draft:draft??null,pending:pendingPrevious?[pendingPrevious.kind,pendingPrevious.reason]:null}]);
      const review=reviewed.get(id+'/'+previousDay);
      const matched=review&&(review.actuals===reviewVersion||
        previousStatus==='recorded'&&review.actuals===JSON.stringify(previousActual));
      const correction=todaySettings?JSON.parse(todaySettings.goals):Array(10).fill(null);
      const previousGoals=review?JSON.parse(review.goals)
        :acceptedBriefingGoals(signed.get(id+'/'+previousDay),null)??briefingGoalValues(monthlyGoals(reviewMonth),reviewPast,reviewDays,
          previousDay,previousSettings?JSON.parse(previousSettings.goals):[]);
      const workday=days.includes(today);
      const defaultTodayGoals=briefingGoalValues(sales,past,days,today);
      const calendarToday=dates.filter(row=>row.day===today);
      const dayOff=workday?null:polishHoliday(today)??calendarToday.find(row=>row.status==='approved'&&row.kind!=='zero')?.kind??'off';
      const pendingToday=workday&&calendarToday.some(row=>row.status==='pending');
      const signoff=signed.get(id+'/'+today);
      const storedGoals=acceptedBriefingGoals(signoff,dayOff);
      const todayGoals=storedGoals??briefingGoalValues(sales,past,days,today,correction);
      const planVersion=JSON.stringify([todayGoals,dayOff]);
      const previousReady=Boolean(matched);
      const accepted=previousReady&&!pendingToday&&signoff?.accepted_plan===planVersion;
      const completionVersion=JSON.stringify([previousDay,matched?review.reviewed_at:null,reviewVersion,planVersion]);
      const completed=accepted&&signoff.completed_version===completionVersion;
      const firstTracking=[trackingDays.get(id),current[0]?.day].filter(Boolean).sort()[0];
      const elapsed=firstTracking?days.filter(day=>day>=firstTracking&&day<today).length:0;
      const remaining=days.filter(day=>day>=today).length;
      const manual=forecastSettings?JSON.parse(forecastSettings.forecast):[];
      const baseline=forecastSettings?JSON.parse(forecastSettings.baseline):[];
      const hasHistory=current.some(row=>row.day<today);
      const automaticForecast=briefingSalesIndexes.map(i=>{
        if (!remaining||archived) return 0;
        if (!elapsed||!hasHistory) return null;
        return Math.max(0,Math.round(past[i]*remaining/elapsed)-(actuals[i]-past[i]));
      });
      const forecast=briefingSalesIndexes.map((i,slot)=>remaining&&!archived&&manual[slot]!=null
        ?Math.max(0,manual[slot]-Math.max(0,actuals[i]-baseline[slot])):automaticForecast[slot]);
      return [{id,name,archived,editable,ownForecast:!archived&&id===managerId,workday,todayGoals,defaultTodayGoals,correction,dayOff,pendingToday,
        signoff:{previousReady,planVersion,accepted,completionVersion,completed},
        remainingPlan:editable?briefingRemainingPlan(sales,past,days,today,todayGoals):[],
        review:{day:previousDay,version:reviewVersion,status:previousStatus,absenceRequest:pendingPrevious?{kind:pendingPrevious.kind,reason:pendingPrevious.reason}:null,actual:['recorded','draft'].includes(previousStatus)?previousActual:null,goals:previousGoals,
          rows:validDailyRows(previousMatrix)?previousMatrix:null,
          confirmed:matched?{by:review.manager_name,at:review.reviewed_at}:null,stale:Boolean(review&&!matched)},
        actual:briefingSalesIndexes.map(i=>actuals[i]),plan:briefingSalesIndexes.map(i=>sales[i]),
        forecast,automaticForecast,manual:forecast.map((value,i)=>!archived&&remaining&&manual[i]!=null?value:null)}];
    });
    const target=salonPlanByName.get(salon);
    const plan=[0,2,1,3].map(i=>target?.configured[i]?target.targets[i]:null);
    const actual=briefingTotals(people);
    const missing=briefingSalesIndexes.map((_,i)=>people.filter(row=>row.forecast[i]==null).length);
    const forecast=briefingSalesIndexes.map((_,i)=>missing[i]===people.length&&people.length?null:
      people.reduce((sum,row)=>sum+(row.forecast[i]??0),0));
    return {salon,plan,actual,forecast,missing,people};
  })};
}
