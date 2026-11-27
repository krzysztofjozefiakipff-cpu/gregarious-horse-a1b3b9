const reportCounterIndexes=[0,1,2,4,5,6,7,10,8,9];
const reportSalesIndexes=[6,8,7,9];
const dailyReportTime='08:00:00';
const dailyActionMetrics=[
  ['Dopływ leadów','Porównaj liczbę zapytań w CRM z planem, sprawdź działanie formularzy i przydziel nowe leady osobom, które mają czas na kontakt.'],
  ['Próby kontaktu','Przejrzyj z zespołem leady bez odpowiedzi. Przydziel oddzwonienia i ustal termin kolejnej próby dla każdego klienta.'],
  ['Spotkania','Wybierz klientów po pierwszej rozmowie i przydziel handlowcom konkretne terminy spotkań do zaproponowania.'],
  ['Jazdy próbne','Zarezerwuj auta demonstracyjne i poproś handlowców o umówienie jazd z aktywnymi klientami.'],
  ['Oferty','Przejrzyj otwarte szanse po spotkaniach i ustal, kto i do kiedy wyśle ofertę każdemu klientowi.'],
  ['Follow-up','Przejrzyj oferty bez odpowiedzi. Przypisz właściciela i termin kolejnego kontaktu, zacznij od klientów bliskich decyzji.'],
  ['Zamówienia','Przejrzyj z handlowcami transakcje bliskie podpisu. Przy każdej ustal przeszkodę, osobę odpowiedzialną i termin domknięcia.'],
  ['Faktury','Zestaw podpisane zamówienia z planem wydań. Usuń blokady w finansowaniu, płatnościach i dokumentach do faktury.'],
  ['Rejestracje','Sprawdź terminy wydań i komplet dokumentów. Przypisz uzupełnienie każdego braku i zarezerwuj terminy rejestracji.'],
  ['Opinie Google','Przejrzyj ostatnie wydania i poproś handlowców o wysłanie klientom linku do opinii po odbiorze auta.']
];
const dailyDigitalSources=[[1,'Facebook'],[2,'Strona WWW'],[4,'OTOMOTO']];
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

function summarizeReportRows(rows,marketing=false) {
  const actuals=reportCounterIndexes.map(()=>0);
  const sources=Array.from({length:sourceCount},()=>marketing?{leads:0,orders:0,stages:Array(9).fill(0)}:{leads:0,orders:0});
  for (const row of rows) {
    const values=JSON.parse(row.counters);
    if (Array.isArray(values[5])) {
      for (const [index,source] of values[5].entries()) {
        addReportCounts(actuals,reportCounterIndexes.map(i=>source[i]??0));
        sources[index].leads+=source[0]??0;
        sources[index].orders+=source[7]??0;
        if (marketing) addReportCounts(sources[index].stages,reportCounterIndexes.slice(0,9).map(i=>source[i]??0));
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
  return [...[3,0,4,1,2,5].map((index,metric)=>plan.funnelTargets[index]??(fallback.length
    ?fallback.reduce((sum,row)=>sum+(row[reportCounterIndexes[metric]]??0),0):null)),
  orders,invoices,registrations,reviews].map(target=>effectiveCalendarTarget(target,adjustment));
}

const reportWorkMonths=new Map();
function reportWorkdays(month) {
  if (!reportWorkMonths.has(month)) reportWorkMonths.set(month,calendarMonthDays(month).filter(isSalonWorkday));
  return reportWorkMonths.get(month);
}

function reportPaceGap(expected,actual) {
  return Math.max(0,Math.ceil((expected??0)-actual-1e-9));
}

function dailyLeadAction(sourceGoals) {
  const candidates=dailyDigitalSources.flatMap(([source,label])=>{
    const plan=sourceGoals?.[source];
    if (!plan?.expected) return [];
    const {actualLeads:leads,actualOrders:orders}=plan;
    const gap=reportPaceGap(plan.expected,leads);
    if (!gap) return [];
    const adequate=leads>=20&&orders<=leads&&orders/leads>=plan.rate;
    return [{label,gap,leads,orders,adequate}];
  }).sort((a,b)=>Number(b.adequate)-Number(a.adequate)||b.gap-a.gap);
  const source=candidates[0];
  if (!source) return null;
  const {label,gap,leads,orders,adequate}=source;
  return {
    evidence:label+' · wśród handlowców z planem dla tego źródła brakuje '+gap+' leadów do tempa. Wynik '+orders+' zam. / '+leads+' leadów od początku miesiąca.',
    instruction:adequate
      ?'Uzgodnij z marketingiem uzupełnienie luki w źródle „'+label+'” i przydziel nowe zapytania handlowcom, którzy mogą je obsłużyć.'
      :'Sprawdź z marketingiem jakość zapytań i z handlowcami ich obsługę w źródle „'+label+'”. Zwiększenie dopływu zaplanuj po weryfikacji konwersji.'
  };
}

function reportSalonExpected(salon,days,elapsed) {
  return salon.targets.map((target,index)=>{
    if (target==null) return null;
    if (reportSalesIndexes.includes(index)) return days?target*elapsed/days:0;
    return salon.people.reduce((sum,person)=>sum+(person.expected[index]??0),0);
  });
}

function completeDailySalon(salon,month,through,sourceGoals) {
  const days=reportWorkdays(month);
  const elapsed=days.filter(day=>day<=through).length;
  const remaining=days.length-elapsed;
  const expected=reportSalonExpected(salon,days.length,elapsed);
  const open=salon.people.flatMap(({name,check})=>{
    const count=check?check.missing.length+check.drafts.length+check.pending.length:0;
    return count?[{name,count}]:[];
  }).sort((a,b)=>b.count-a.count);
  const actions=[];
  if (open.length) actions.push({title:'Uzupełnij brakujące dane',
    evidence:open.reduce((sum,row)=>sum+row.count,0)+' nierozliczonych dni pracy w zespole. '+open.slice(0,3).map(row=>row.name+' ('+row.count+')').join(', ')+'.',
    instruction:'Poproś o zapisanie i zatwierdzenie zaległych aktywności. Rozpatrz oczekujące zgłoszenia w kalendarzu przed oceną wyników.'});
  const gaps=expected.map((goal,index)=>({index,gap:reportPaceGap(goal,salon.totals[index]),
    ratio:goal>0?salon.totals[index]/goal:1})).filter(row=>row.gap>0);
  const funnel=gaps.filter(row=>!reportSalesIndexes.includes(row.index)).sort((a,b)=>a.ratio-b.ratio||b.gap-a.gap);
  const priorities=[...funnel.slice(0,2),...gaps.filter(row=>reportSalesIndexes.includes(row.index))];
  for (const {index,gap} of priorities) {
    const [title,instruction]=dailyActionMetrics[index];
    const sourceAction=index===0?dailyLeadAction(sourceGoals):null;
    const owners=salon.people.filter(person=>!person.archived).map(person=>({
      name:person.name,gap:reportPaceGap(person.expected[index],person.actuals[index])
    })).filter(person=>person.gap).sort((a,b)=>b.gap-a.gap).slice(0,3);
    const toClose=remaining&&reportSalesIndexes.includes(index)?salon.targets[index]-salon.totals[index]:0;
    const evidence='Brakuje '+gap+' do tempa salonu.'
      +(toClose>0?' Do celu miesięcznego pozostało '+toClose+' w '+remaining+' dni pracy.':'')
      +(owners.length?' Największe luki: '+owners.map(row=>row.name+' ('+row.gap+')').join(', ')+'.':'');
    actions.push({title,evidence:evidence+(sourceAction?' '+sourceAction.evidence:''),instruction:sourceAction?.instruction??instruction});
  }
  const individuallyBehind=salon.people.filter(person=>!person.archived&&person.weakest&&
    !priorities.some(row=>row.index===person.weakest.index));
  if (individuallyBehind.length) actions.push({title:'Wsparcie handlowców poniżej własnego tempa',
    evidence:individuallyBehind.slice(0,3).map(({name,weakest})=>
      name+' · '+dailyActionMetrics[weakest.index][0]+', brakuje '+weakest.gap).join(' | '),
    instruction:'Omów z każdym handlowcem wskazany obszar i ustal działania na następny dzień pracy.'});
  return {...salon,expected,actions};
}

const marketingStages=[
  {label:'Próby kontaktu / lead',numerator:1,denominator:0,frequency:true},
  {label:'Spotkania / leady',numerator:2,denominator:0},
  {label:'Jazdy próbne / spotkania',numerator:3,denominator:2},
  {label:'Oferty / leady',numerator:4,denominator:0},
  {label:'Follow-up / ofertę',numerator:5,denominator:4,frequency:true},
  {label:'Zamówienia / oferty',numerator:6,denominator:4},
  {label:'Zamówienia / leady',numerator:6,denominator:0},
  {label:'Faktury / zamówienia',numerator:7,denominator:6},
  {label:'Rejestracje / faktury',numerator:8,denominator:7}
];
const marketingMarket=[
  {study:'Foureyes, raport 2026 · dane z 2025',sample:'Kwalifikowane leady ze stron dealerów w USA',
    url:'https://www.foureyes.io/blog/2026-automotive-dealer-benchmarks-report',
    rows:[['Zakup / kwalifikowane leady',.117]]},
  {study:'Foureyes, badanie ok. 700 dealerów · II połowa 2023',sample:'Nowe auta, zapytania internetowe i telefoniczne w USA',
    url:'https://www.foureyes.io/blog/dealership-data-study-appointment-rates',
    rows:[['Kontakt dwustronny / leady, internet',.60],['Kontakt dwustronny / leady, telefon',.73],
      ['Umówione wizyty / nawiązane kontakty, internet',.32],['Umówione wizyty / nawiązane kontakty, telefon',.73],
      ['Sprzedaż / odbyte wizyty, internet i telefon',.41]]}
];
const marketingMethod='Wskaźniki dzielą liczbę zdarzeń w wybranym okresie i źródle. Wpisy nie łączą etapów tego samego klienta, więc wynik może przekroczyć 100%. Próby kontaktu i follow-up pokazują częstotliwość. Brak mianownika oznaczamy kreską.';
const marketingMarketNote='Punkt odniesienia z USA. Raporty mierzą zakup i kontakt dwustronny, a Bieg Wyżej rejestruje zamówienia i próby kontaktu. Założenia planu dla źródeł to cele wewnętrzne. Brak porównywalnej publicznej średniej dla Polski dla tych etapów i źródeł.';
const marketingGuidance=[
  'Zwiększ liczbę wizyt dzięki kampanii lokalnej z zaproszeniem do salonu.',
  'Dołóż formularze Meta z wyborem modelu, salonu i terminu zakupu.',
  'Kieruj ruch na formularz konkretnego modelu z możliwością umówienia jazdy.',
  'Promuj połączenia do właściwego salonu i sprawdź odbieralność w godzinach kampanii.',
  'Wyróżnij ogłoszenia aut dostępnych od ręki i uzupełnij cenę, zdjęcia oraz wersję.',
  'Poproś klientów po odbiorze o polecenia i oznaczaj źródło zapytań.',
  'Skieruj kampanię do klientów blisko wymiany auta lub końca finansowania.',
  'Uzgodnij z importerem przydział zapytań według modelu i obszaru salonu.',
  'Poproś brokerów o zapytania z określonym modelem, budżetem i terminem.',
  'Zaproś klientów serwisu na wycenę odkupu lub jazdę próbną.',
  'Na stoisku zbieraj zgłoszenia z wybranym modelem i terminem kontaktu.',
  'Po wydarzeniu kieruj zapytania do salonu po modelu i terminie zakupu.',
  'Przekaż do BDC kontakty do odzyskania i sprawdzaj ponowne umówienia.'
];

function marketingAnalysis(sources,goals,nextPlans,closed) {
  const nextLeads=Array(sourceCount).fill(0);
  for (const plan of nextPlans) {
    if (!plan.sourceTargets?.length) continue;
    const targets=effectiveSourcePlan(plan.sourceTargets,plan.absenceAdjustment);
    targets.forEach((row,index)=>{nextLeads[index]+=row[7];});
  }
  const recommendations=[];
  for (const [source,{leads,orders,stages}] of sources.entries()) {
    const [targetRate,,meetingRate,driveRate,offerRate]=sourceAssumptions[source];
    const basis=closed&&nextLeads[source]>0?'Plan kolejnego miesiąca':closed?'Plan badanego miesiąca':'Plan narastająco do daty';
    const plan=closed?(nextLeads[source]||goals[source].leads):Math.ceil(goals[source].expected-1e-9);
    const gap=Math.max(0,plan-leads);
    const rate=leads?orders/leads:null;
    let action,advice,extra=0,priority;
    if ((!leads&&orders)||rate>1) {
      [action,advice,priority]=['Sprawdź przypisanie','Zweryfikuj źródło w CRM i sprawdź, ile zamówień dotyczy leadów z wcześniejszych okresów.',3];
    } else if (leads<20) {
      if (!gap&&!leads) continue;
      [action,advice,priority]=['Zbierz próbę','Oceń źródło po zebraniu co najmniej 20 leadów. Przy tej próbie nie zwiększaj jeszcze przydziału.',2];
    } else if (rate<targetRate) {
      const [,attempts,meetings,drives,offers]=stages;
      const candidates=[
        [meetings/leads/meetingRate,'Więcej spotkań','Sprawdź jakość zapytań i czas reakcji. Z handlowcami przejrzyj zaproszenia na spotkanie.'],
        [offers/leads/offerRate,'Więcej ofert','Sprawdź zgodność reklamy z ofertą, dostępność aut i wysyłanie ofert po kontakcie.']
      ];
      if (meetings>=10) candidates.push([drives/meetings/driveRate,'Więcej jazd próbnych','Sprawdź dostępność aut demonstracyjnych i możliwość rezerwacji jazdy.']);
      const [score,stage,hint]=candidates.sort((a,b)=>a[0]-b[0])[0];
      action=score<1?stage:'Sprawdź domknięcie';
      advice=!attempts?'Sprawdź obsługę w CRM. W raporcie brak zarejestrowanych prób kontaktu.':score<1?hint
        :'Przejrzyj oferty bez zamówienia, przyczyny utraty i ponowny kontakt przed zwiększeniem dopływu.';
      priority=1;
    } else if (gap) {
      [action,advice,extra,priority]=['Zwiększ dopływ',marketingGuidance[source],gap,0];
    } else if (!goals[source].leads&&!nextLeads[source]) {
      [action,advice,priority]=['Ustal plan leadów','Wynik jest na poziomie założenia. Ustal wolumen dla salonu i sprawdź koszt zamówienia.',2];
    } else continue;
    recommendations.push({source,leads,orders,rate,targetRate,plan,basis,extra,action,advice,priority});
  }
  return recommendations.sort((a,b)=>a.priority-b.priority||b.extra-a.extra||b.leads-a.leads);
}

async function buildManagementReport(db,{type,month,through,reportDay,sellers,salons,scope,params,loadPlans}) {
  const first=month+'-01';
  const marketing=type==='marketing';
  const closed=marketing&&month<reportClock().day.slice(0,7);
  const days=reportWorkdays(month);
  const elapsedThrough=days.filter(day=>day<=through).length;
  const nextDate=new Date(first+'T00:00:00Z');
  nextDate.setUTCMonth(nextDate.getUTCMonth()+1);
  const nextMonth=nextDate.toISOString().slice(0,7);
  const goalsMonth=type==='daily'?reportDay.slice(0,7):month;
  const sameMonth=goalsMonth===month;
  const range='day BETWEEN ? AND ? AND '+scope;
  const [daily,drafts,calendar,exceptions,trackingRows,adjustments,planData,nextPlanData,goalPlanData,archives]=await Promise.all([
    loadPlanActivity(db,first,through,scope,params,type==='monthly'),
    type==='daily'?list(db,'SELECT person,day FROM daily_drafts WHERE '+range,first,through,...params):[],
    list(db,"SELECT person,day,kind,status FROM work_calendar WHERE substr(day,1,7) IN (?,?) AND "+scope,month,goalsMonth,...params),
    list(db,'SELECT person,day,kind FROM daily_exceptions WHERE substr(day,1,7) IN (?,?) AND '+scope,month,goalsMonth,...params),
    list(db,'SELECT person,start_day FROM daily_tracking WHERE '+scope,...params),
    calendarAdjustments(db,sameMonth?[month]:[month,goalsMonth],scope,...params),
    loadPlans(month),
    marketing&&closed?loadPlans(nextMonth):null,
    sameMonth?null:loadPlans(goalsMonth),
    type==='daily'?list(db,`SELECT a.id AS person,p.first_excluded_day,p.restored_day FROM archive_report_days p
      JOIN accounts a USING(email) WHERE ${scope.replace(/^person /,'a.id ')}`,...params):[]
  ]);
  const byPerson=rows=>Map.groupBy(rows,row=>row.person);
  const records=byPerson(daily), draftsByPerson=byPerson(drafts), absences=byPerson(calendar),
    exceptionsByPerson=byPerson(exceptions), archivesByPerson=byPerson(archives);
  const started=new Map(trackingRows.map(row=>[row.person,row.start_day]));
  const plansBySalon=new Map(planData.plans.map(plan=>[plan.salon,plan]));
  const nextBySalon=new Map(nextPlanData?.plans.map(plan=>[plan.salon,plan])??[]);
  const goalPlansBySalon=new Map(goalPlanData?.plans.map(plan=>[plan.salon,plan])??[]);
  const salonsWithSellers=Map.groupBy(sellers,seller=>seller.salon);
  const archiveDaysBySeller=new Map(sellers.map(seller=>[seller.id,archivesByPerson.get(seller.id)??[]]));

  return {type,month,through,...(marketing?{marketing:{stages:marketingStages,market:marketingMarket,
    method:marketingMethod,marketNote:marketingMarketNote}}:{}),salons:salons.map(({salon})=>{
    const plan=plansBySalon.get(salon);
    const sellerPlans=plan?.team??[];
    const byId=new Map(sellerPlans.map(person=>[person.id,person]));
    const goalPlans=sameMonth?byId:new Map((goalPlansBySalon.get(salon)?.team??[]).map(person=>[person.id,person]));
    const dailyGoals=[];
    const sourceGoals=Array.from({length:sourceCount},()=>({expected:0,leads:0,orders:0,actualLeads:0,actualOrders:0}));
    const people=(salonsWithSellers.get(salon)??[]).flatMap(seller=>{
      const rows=records.get(seller.id)??[];
      const archived=seller.accountStatus==='inactive';
      if (archived&&!rows.length) return [];
      const {actuals,sources}=summarizeReportRows(rows,marketing);
      const adjustment=adjustments[seller.id+'/'+month];
      const sellerPlan=byId.get(seller.id);
      const targets=reportSellerTargets(sellerPlan,adjustment);
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
      if ((type==='daily'||marketing)&&!archived&&scheduled.length&&sellerPlan?.sourceTargets?.length) {
        for (const [index,row] of effectiveSourcePlan(sellerPlan.sourceTargets,adjustment).entries()) {
          if (!row[7]) continue;
          const goal=sourceGoals[index];
          goal.leads+=row[7];
          goal.orders+=row[0];
          goal.expected+=row[7]*elapsed/scheduled.length;
          goal.actualLeads+=sources[index].leads;
          goal.actualOrders+=sources[index].orders;
        }
      }
      const weakest=expected.map((goal,index)=>({goal,index,ratio:goal>0?actuals[index]/goal:1}))
        .filter(metric=>metric.goal>0&&metric.ratio<1).sort((a,b)=>a.ratio-b.ratio||b.goal-a.goal)[0];
      const item={id:seller.id,name:seller.name,archived,actuals,sources,targets,expected,
        weakest:weakest?{index:weakest.index,gap:Math.ceil(weakest.goal-actuals[weakest.index])}:null};
      if (type==='daily'&&!archived) {
        const goalTargets=sameMonth?targets:reportSellerTargets(goalPlans.get(seller.id),adjustments[seller.id+'/'+goalsMonth]);
        const workday=isSalonWorkday(reportDay)&&!leave.has(reportDay);
        const remaining=reportWorkdays(goalsMonth).filter(day=>day>=reportDay&&!leave.has(day)).length;
        dailyGoals.push({name:seller.name,workday,targets:goalTargets.map((target,index)=>
          dailyTarget(target,sameMonth?actuals[index]:0,remaining,workday))});
        const start=started.get(seller.id);
        const archivedPeriods=archiveDaysBySeller.get(seller.id);
        const required=start?scheduled.filter(day=>day>=start&&day<=through&&
          !archivedPeriods.some(interval=>interval.first_excluded_day<=day&&(!interval.restored_day||day<interval.restored_day))):[];
        const approved=new Set(rows.map(row=>row.day));
        const draftDays=new Set((draftsByPerson.get(seller.id)??[]).map(row=>row.day));
        const open=required.filter(day=>!approved.has(day)&&!zero.has(day));
        item.check={started:Boolean(start),required:required.length,approved:required.filter(day=>approved.has(day)).length,
          zero:required.filter(day=>!approved.has(day)&&zero.has(day)).length,
          pending:open.filter(day=>pending.has(day)),drafts:open.filter(day=>!pending.has(day)&&draftDays.has(day)),
          missing:open.filter(day=>!pending.has(day)&&!draftDays.has(day))};
      }
      return [item];
    });
    const totals=reportCounterIndexes.map(()=>0);
    const sources=Array.from({length:sourceCount},()=>marketing?{leads:0,orders:0,stages:Array(9).fill(0)}:{leads:0,orders:0});
    for (const person of people) {
      addReportCounts(totals,person.actuals);
      for (const [index,source] of person.sources.entries()) {
        sources[index].leads+=source.leads;
        sources[index].orders+=source.orders;
        if (marketing) addReportCounts(sources[index].stages,source.stages);
      }
    }
    const salonTargets=reportCounterIndexes.map((_,index)=>{
      const slot=reportSalesIndexes.indexOf(index);
      if (slot>=0) return plan?.configured[slot]?plan.targets[slot]:null;
      const goals=people.map(person=>person.targets[index]).filter(value=>value!=null);
      return goals.length?goals.reduce((sum,value)=>sum+value,0):null;
    });
    const summary={salon,totals,targets:salonTargets,people,sources,recommendations:[]};
    if (marketing) return {salon,sources,recommendations:marketingAnalysis(sources,sourceGoals,
      nextBySalon.get(salon)?.team??[],closed)};
    if (type==='monthly') return {salon,totals,targets:salonTargets,sources,
      expected:reportSalonExpected(summary,days.length,elapsedThrough)};
    if (type==='daily') return completeDailySalon({...summary,dailyGoals},month,through,sourceGoals.map((source,index)=>({
      ...source,rate:Math.max(sourceAssumptions[index][0],source.leads?source.orders/source.leads:0)
    })));
    return summary;
  })};
}

async function generateDailyReports(db) {
  const {day,time}=reportClock();
  if (time<dailyReportTime) return null;
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
    if (await db.prepare("SELECT 1 FROM management_daily_reports WHERE email=? AND role=? AND day=? AND json_extract(payload,'$.dailyGoalsDate')=day")
      .bind(email,role,day).first()) continue;
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
