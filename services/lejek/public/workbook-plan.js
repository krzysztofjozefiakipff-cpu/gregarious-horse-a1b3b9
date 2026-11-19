const benchmarksFromWorkbook = [[1, 0, 0.8, 0.7, 0.8, 0.3], [0.65, 0.25, 0.7, 0.45, 0.8, 0.035], [0.8, 0.4, 0.75, 0.55, 0.8, 0.06], [0.9, 0.65, 0.8, 0.7, 0.8, 0.2], [0.85, 0.45, 0.75, 0.55, 0.8, 0.075], [0.95, 0.65, 0.85, 0.7, 0.8, 0.25], [0.75, 0.35, 0.75, 0.55, 0.8, 0.07], [0.8, 0.4, 0.75, 0.6, 0.8, 0.06], [0.85, 0.45, 0.75, 0.55, 0.8, 0.07], [0.8, 0.4, 0.75, 0.5, 0.8, 0.06], [0.7, 0.3, 0.7, 0.45, 0.8, 0.04], [0.7, 0.3, 0.7, 0.45, 0.8, 0.04]];
const defaultMix = [6, 1, 1, 4, 0, 1, 1, 1, 0, 0, 0, 0];

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
  const allocations=allocateSourceTargets(goal,defaultMix);
  const up=(value,rate)=>Math.ceil(value*rate-1e-9);
  return allocations.map((sales,i)=>{
    const [contact,visit,drive,offer,follow,close]=benchmarksFromWorkbook[i];
    const lead=Math.ceil(sales/close-1e-9);
    const contacts=up(lead,contact);
    const visits=up(contacts,visit);
    const offers=up(contacts,offer);
    return [lead,contacts,Math.ceil(visits/.8),visits,up(i===0?lead:visits,drive),offers,up(offers,follow),sales];
  });
}


function sourceActivityProposal(source,orders,observedRate) {
  // BDC starts from the retention profile until the salon has its own assumptions.
  const [contact,visit,drive,offer,follow,close]=benchmarksFromWorkbook[source]??benchmarksFromWorkbook[6];
  const leads=Math.ceil(orders/(observedRate??close)-1e-9);
  const contacts=Math.ceil(leads*contact);
  const meetings=source===0?leads:Math.ceil(contacts*visit);
  const drives=Math.ceil(meetings*drive);
  const offers=Math.ceil(contacts*offer);
  return [contacts,drives,offers,leads,meetings,Math.ceil(offers*follow)];
}
