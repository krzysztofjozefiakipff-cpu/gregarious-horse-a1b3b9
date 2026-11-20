// Planning assumptions, not nationwide conversion benchmarks.
// Columns: orders per lead, attempts per lead, scheduled meetings per lead, drives per scheduled meeting,
// offers per lead, follow-ups per offer. Walk-in matches the daily entry's automatic counts.
const sourceAssumptions = [
  [0.25,1,1,0.35,0.65,0.95],   // Walk-in
  [0.05,1.7,0.23,0.45,0.32,1], // Facebook
  [0.11,1.5,0.38,0.45,0.48,1], // Strona WWW
  [0.20,1.4,0.53,0.50,0.58,1], // Kontakt z salonem
  [0.08,1.5,0.34,0.45,0.42,1], // OTOMOTO
  [0.27,1.3,0.59,0.50,0.64,1], // Polecenia
  [0.07,1.5,0.26,0.45,0.35,1], // Baza retencyjna
  [0.08,1.6,0.31,0.45,0.40,1], // Importerskie
  [0.16,1.3,0.23,0.25,0.65,1], // Broker
  [0.07,1.4,0.28,0.40,0.36,1], // Serwis
  [0.04,1.5,0.19,0.45,0.28,1], // Galerie
  [0.05,1.5,0.23,0.45,0.32,1], // Targi
  [0.07,1.5,0.32,0.45,0.40,1]  // Odzyskane przez BDC
];
const defaultMix = [6, 1, 1, 4, 0, 1, 1, 1, 0, 0, 0, 0];

const sourceProfilePresets={
  salon:{label:'Salonowy',shares:[45,0,0,20,0,15,10,0,0,7,2,1,0]},
  broker:{label:'Brokerowy',shares:[0,0,0,0,0,0,0,0,100,0,0,0,0]},
  internet:{label:'Internetowy',shares:[0,20,25,0,30,0,0,15,0,0,0,0,10]}
};

function sourceProfileShares(types) {
  const valid=Array.isArray(types)&&types.length>=1&&types.length<=3&&new Set(types).size===types.length
    &&types.every(type=>typeof type==='string'&&Object.hasOwn(sourceProfilePresets,type));
  if (!valid) return null;
  const totals=sourceProfilePresets.salon.shares.map((_,index)=>
    types.reduce((sum,type)=>sum+sourceProfilePresets[type].shares[index],0));
  return allocateSourceTargets(100,totals);
}

function allocateSourceTargets(goal,mix) {
  const weight=mix.reduce((sum,v)=>sum+v,0);
  const raw=mix.map(v=>goal*v/weight);
  const allocations=raw.map(Math.floor);
  const remainder=goal-allocations.reduce((sum,v)=>sum+v,0);
  const ranking=raw.map((v,i)=>({i,part:v-allocations[i]})).sort((a,b)=>b.part-a.part||a.i-b.i);
  ranking.slice(0,remainder).forEach(({i})=>allocations[i]++);
  return allocations;
}

function sourceTargets(goal) {
  return allocateSourceTargets(goal,defaultMix).map((orders,index)=>{
    const [attempts,drives,offers,leads,meetings,followUps]=sourceActivityProposal(index,orders);
    const heldMeetings=index===0?meetings:Math.ceil(meetings*0.8);
    return [leads,attempts,meetings,heldMeetings,drives,offers,followUps,orders];
  });
}

function sourceConversionRate(source, observedRate) {
  return Math.max(observedRate??0,sourceAssumptions[source][0]);
}

function sourceHistoryRate(leads, orders) {
  return leads>=60&&orders>=0&&orders<=leads?orders/leads:null;
}

function calibratedSourceRate(source, leads, orders) {
  const history=sourceHistoryRate(leads,orders);
  if (history===null) return null;
  const goal=sourceConversionRate(source);
  const priorWeight=100;
  return Math.max(goal,(orders+priorWeight*goal)/(leads+priorWeight));
}

function sourceActivityProposal(source,orders,observedRate) {
  const [,attemptsPerLead,meetingRate,driveRate,offerRate,followRate]=sourceAssumptions[source];
  const up=(value,rate)=>Math.max(0,Math.ceil(value*rate-1e-9));
  const leads=up(orders,1/sourceConversionRate(source,observedRate));
  const attempts=up(leads,attemptsPerLead);
  const meetings=up(leads,meetingRate);
  const drives=up(meetings,driveRate);
  const offers=Math.max(orders,up(leads,offerRate));
  return [attempts,drives,offers,leads,meetings,up(offers,followRate)];
}

function effectiveCalendarTarget(target,adjustment) {
  if (target==null||!adjustment||!adjustment.workdays) return target;
  return Math.round(target*Math.max(0,adjustment.workdays-adjustment.absentDays)/adjustment.workdays);
}

function dailyTarget(monthTarget,doneBeforeToday,daysLeft,isWorkday) {
  if (monthTarget==null) return null;
  return isWorkday?Math.ceil(Math.max(0,monthTarget-doneBeforeToday)/Math.max(1,daysLeft)):0;
}

function effectiveSourcePlan(rows,adjustment) {
  if (!adjustment) return rows;
  const columns=rows[0].map((_,index)=>{
    const values=rows.map(row=>row[index]);
    const total=values.reduce((sum,value)=>sum+value,0);
    return total?allocateSourceTargets(effectiveCalendarTarget(total,adjustment),values):values;
  });
  return rows.map((_,index)=>columns.map(column=>column[index]));
}
