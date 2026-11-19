// Planning assumptions, not nationwide conversion benchmarks.
// Columns: orders per lead, attempts per lead, scheduled meetings per lead, drives per scheduled meeting,
// offers per lead, follow-ups per offer. Walk-in matches the daily entry's automatic counts.
const sourceAssumptions = [
  [0.20,1,1,0.35,0.55,0.80],   // Walk-in
  [0.035,1.4,0.18,0.45,0.25,0.85], // Facebook
  [0.08,1.3,0.30,0.45,0.40,0.85],  // Strona WWW
  [0.15,1.2,0.45,0.50,0.50,0.85],  // Kontakt z salonem
  [0.06,1.3,0.28,0.45,0.35,0.85],  // OTOMOTO
  [0.20,1.2,0.50,0.50,0.55,0.85],  // Polecenia
  [0.05,1.3,0.20,0.45,0.28,0.85],  // Baza retencyjna
  [0.06,1.4,0.25,0.45,0.32,0.85],  // Importerskie
  [0.12,1.2,0.20,0.25,0.55,0.85],  // Broker
  [0.05,1.2,0.23,0.40,0.28,0.85],  // Serwis
  [0.03,1.4,0.15,0.45,0.22,0.85],  // Galerie
  [0.04,1.4,0.18,0.45,0.26,0.85],  // Targi
  [0.05,1.3,0.25,0.45,0.32,0.85]   // Odzyskane przez BDC
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
  return observedRate??sourceAssumptions[source][0];
}

function calibratedSourceRate(source, leads, orders) {
  if (leads<60||orders<0||orders>leads) return null;
  const priorWeight=100;
  return (orders+priorWeight*sourceAssumptions[source][0])/(leads+priorWeight);
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
