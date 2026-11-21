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

async function buildDailyBriefing(db,{today,sellers,salons,scope,params,sellerTargets,salonPlans,managerId}) {
  const yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
  const month=today.slice(0,7);
  const [calendar,tracking]=await Promise.all([
    list(db,`SELECT person,day,kind,status FROM work_calendar WHERE day<=? AND status IN ('approved','pending') AND `+scope+
      ` UNION ALL SELECT person,day,kind,CASE kind WHEN 'pending' THEN 'pending' ELSE 'approved' END FROM daily_exceptions
      WHERE day<=? AND kind IN ('leave','training','zero','pending') AND `+scope,today,...params,today,...params),
    list(db,'SELECT person,start_day FROM daily_tracking WHERE '+scope,...params)
  ]);
  const personalCalendar=Map.groupBy(calendar,row=>row.person);
  const trackingDays=new Map(tracking.map(row=>[row.person,row.start_day]));
  const schedules=new Map(sellers.map(({id})=>{
    const calendar=personalCalendar.get(id)??[];
    const off=new Set(calendar.filter(row=>row.status==='approved'&&row.kind!=='zero').map(row=>row.day));
    const trackingStart=trackingDays.get(id);
    let day=yesterday;
    while ((!trackingStart||day>=trackingStart)&&(!isSalonWorkday(day)||off.has(day))) {
      day=new Date(Date.parse(day)-86400000).toISOString().slice(0,10);
    }
    return [id,{off,previousDay:trackingStart&&day<trackingStart?null:day}];
  }));
  const months=[...new Set([month,...[...schedules.values()].map(({previousDay})=>previousDay?.slice(0,7)).filter(Boolean)])].sort();
  const first=months[0]+'-01';
  const activeDays=[...new Set([today,...[...schedules.values()].map(({previousDay})=>previousDay).filter(Boolean)])];
  const [results,settings,reviews,signoffs,adjustments,plans]=await Promise.all([
    list(db,'SELECT person,day,counters FROM daily_results WHERE day BETWEEN ? AND ? AND '+scope+' AND '+includedDailyResult,first,today,...params),
    list(db,'SELECT * FROM daily_briefing_settings WHERE day BETWEEN ? AND ? AND '+scope+' ORDER BY day DESC',first,today,...params),
    list(db,`SELECT r.*,a.name AS manager_name FROM daily_briefing_reviews r JOIN accounts a ON a.id=r.manager
      WHERE r.day IN (SELECT value FROM json_each(?)) AND `+scope,JSON.stringify(activeDays),...params),
    list(db,'SELECT * FROM daily_briefing_signoffs WHERE day=? AND '+scope,today,...params),
    calendarAdjustments(db,months,scope,...params),
    Promise.all(salons.flatMap(({salon})=>months.map(async m=>[salon+'/'+m,new Map((await sellerTargets(salon,m)).map(plan=>[plan.id,plan]))])))
  ]);
  const personalResults=Map.groupBy(results,row=>row.person);
  const personalSettings=Map.groupBy(settings,row=>row.person);
  const participants=Map.groupBy(sellers,row=>row.salon);
  const reviewed=new Map(reviews.map(row=>[row.person+'/'+row.day,row]));
  const signed=new Map(signoffs.map(row=>[row.person,row]));
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
      const {off,previousDay}=schedules.get(id);
      const reviewMonth=previousDay?.slice(0,7)??month;
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
      const previousRow=rows.find(row=>row.day===previousDay);
      const previousMatrix=previousRow&&JSON.parse(previousRow.counters)[5];
      const previousActual=summarizeReportRows(previousRow?[previousRow]:[]).actuals;
      const previousStatus=!previousDay?'none':previousRow||dates.some(row=>row.day===previousDay&&row.kind==='zero')?'recorded':'missing';
      const reviewVersion=JSON.stringify([previousDay,previousActual,previousRow?.counters??null]);
      const review=reviewed.get(id+'/'+previousDay);
      const matched=review&&previousStatus==='recorded'&&[reviewVersion,JSON.stringify(previousActual)].includes(review.actuals);
      const correction=todaySettings?JSON.parse(todaySettings.goals):Array(10).fill(null);
      const previousGoals=matched?JSON.parse(review.goals):previousDay?briefingGoalValues(monthlyGoals(reviewMonth),reviewPast,reviewDays,
        previousDay,previousSettings?JSON.parse(previousSettings.goals):[]):[];
      const workday=days.includes(today);
      const todayGoals=briefingGoalValues(sales,past,days,today,correction);
      const defaultTodayGoals=briefingGoalValues(sales,past,days,today);
      const calendarToday=dates.filter(row=>row.day===today);
      const dayOff=workday?null:polishHoliday(today)??calendarToday.find(row=>row.status==='approved'&&row.kind!=='zero')?.kind??'off';
      const pendingToday=workday&&calendarToday.some(row=>row.status==='pending');
      const planVersion=JSON.stringify([todayGoals,dayOff]);
      const signoff=signed.get(id);
      const previousReady=previousStatus==='none'||Boolean(matched);
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
        review:{day:previousDay,version:reviewVersion,status:previousStatus,actual:previousStatus==='recorded'?previousActual:null,goals:previousGoals,
          rows:editable&&validDailyRows(previousMatrix)?previousMatrix:null,
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
