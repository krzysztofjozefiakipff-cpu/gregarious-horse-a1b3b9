const metrics = [
  ['Rozmowy z klientami', 'Przeprowadź rozmowy z klientami'],
  ['Umówione jazdy próbne', 'Umów jazdy próbne'],
  ['Odbyte jazdy próbne', 'Zrealizuj pozostałe jazdy próbne'],
  ['Wysłane oferty', 'Przygotuj i wyślij oferty'],
  ['Podpisane zamówienia', '']
];
const quotes = [
  'Dobry dzień zaczyna się od jednej rzeczy zrobionej dobrze.',
  'To, na co poświęcasz uwagę, z czasem zaczyna rosnąć.',
  'Regularność pozwala zrobić więcej, niż podpowiada pierwszy zapał.',
  'Dobra rozmowa zaczyna się od uważnego słuchania.',
  'Małe kroki pozwalają ruszyć nawet w trudnym dniu.',
  'Najwięcej uczymy się z rzeczy, do których wracamy z uwagą.',
  'Daj sobie czas na naukę i powód, żeby spróbować ponownie.'
];
const date = document.querySelector('#date');
const entry = document.querySelector('#entry');
const load = document.querySelector('#load');
const daily = document.querySelector('#daily');
const status = document.querySelector('#status');
const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Warsaw'}).format(new Date());
let state;
let revision=0;
date.value = today;
date.max = today;


function workdays(y, m, from, count) {
  let total = 0;
  for (let offset = 0; offset < count; offset++) {
    const last = new Date(Date.UTC(y, m + offset + 1, 0)).getUTCDate();
    for (let d = offset ? 1 : from; d <= last; d++) {
      const weekday = new Date(Date.UTC(y,m + offset,d)).getUTCDay();
      if (weekday > 0 && weekday < 6) total++;
    }
  }
  return total;
}

function render() {
  const day = date.value;
  if (!day) return;
  const timestamp = new Date(day + 'T00:00:00Z');
  const [year, month, number] = day.split('-').map(Number);
  const qStart = Math.floor((month - 1) / 3) * 3;
  const prefix = day.slice(0,7);
  const records = Object.entries(state.days).filter(([d]) => d <= day);
  const sumOrders = rows => rows.reduce((sum,[,v]) => sum + (v[4] ?? 0), 0);
  const monthRows = records.filter(([d]) => d.startsWith(prefix));
  const quarterRows = records.filter(([d]) => d.startsWith(String(year)) && +d.slice(5,7) > qStart);
  const monthOrders = sumOrders(monthRows);
  const quarterOrders = sumOrders(quarterRows);
  const monthGoal = state.plans[prefix];
  const quarterGoal = Object.keys(state.plans).length===3 ? Object.values(state.plans).reduce((a,b)=>a+b,0) : null;
  const monthGap = monthGoal==null ? null : Math.max(0,monthGoal-monthOrders);
  const quarterGap = quarterGoal==null ? null : Math.max(0,quarterGoal-quarterOrders);
  const left = workdays(year,month-1,number,1);
  const quarterLeft = workdays(year,month-1,number,qStart+4-month);
  const pace = Math.max((monthGap??0)/Math.max(1,left),(quarterGap??0)/Math.max(1,quarterLeft));
  const needed = Math.max(monthGap??0,quarterGap??0);
  const planRows = needed ? sourceTargets(needed,state.person.name) : [];
  const planPerOrder = index => needed ? planRows.reduce((sum,row)=>sum+row[index],0)/needed : 0;
  const goals = [1,2,4,5].map(index=>Math.ceil(pace*planPerOrder(index))).concat(null);
  const values = state.days[day] ?? [];
  const tasks = goals.slice(0,4).map((goal,i) => ({i,gap:Math.max(0,goal-(values[i]??0))}))
    .filter(task=>task.gap).reverse().slice(0,3);
  document.querySelector('#quote').textContent = '„'+quotes[Math.floor(timestamp.getTime()/86400000)%quotes.length]+'”';
  document.querySelector('#tasks').innerHTML = tasks.length ? tasks.map(({i,gap})=>'<li>'+metrics[i][1]+' — <strong>'+gap+'</strong>.</li>').join('') : monthGoal==null && quarterGoal==null ? '<li>Poproś kierownika o wpisanie planu.</li>' : '<li>Dzisiejsze cele są osiągnięte.</li>';
  const completed = goals.slice(0,4).filter((goal,i)=>goal>0 && (values[i]??0)>=goal).length;
  const cards = [['Dzisiaj',completed+' / '+goals.slice(0,4).filter(Boolean).length,'Celów osiągniętych'],['Miesiąc',monthOrders+' / '+(monthGoal??'—'),monthGap==null?'Brak planu':monthGap?'Brakuje '+monthGap+' · dni pracy '+left:'Plan osiągnięty'],['Kwartał',quarterOrders+' / '+(quarterGoal??'—'),quarterGap==null?'Niepełny plan':quarterGap?'Brakuje '+quarterGap+' · dni pracy '+quarterLeft:'Plan osiągnięty']];
  document.querySelector('#cards').innerHTML = cards.map(([title,value,hint])=>'<section><span>'+title+'</span><strong>'+value+'</strong><small>'+hint+'</small></section>').join('');
  document.querySelector('#rows').innerHTML = metrics.map(([label],i)=>{
    const value = values[i];
    const goal = goals[i];
    const score = value == null || goal == null || value===goal ? '' : value<goal ? 'behind' : 'ahead';
    const note = score==='behind'?'Poniżej celu':score==='ahead'?'Powyżej celu':value != null && goal != null?'Cel osiągnięty':'';
    return '<tr><td>'+label+'</td><td>'+(goal??'—')+'</td><td><input aria-label="'+label+'" name="m'+i+'" type="number" min="0" max="99999" step="1" inputmode="numeric" value="'+(value??'')+'"><small style="display:block" class="'+score+'">'+note+'</small></td></tr>';
  }).join('');
}
async function api(params, values) {
  const response = await fetch('/api/daily'+params, values ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)} : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

async function refresh() {
  const latest = ++revision;
  daily.hidden=true;
  load.textContent='Wczytywanie danych…';
  try {
    const data=await api('?month='+encodeURIComponent(date.value.slice(0,7)));
    if (latest!==revision) return;
    load.textContent='';
    document.querySelector('.heading').hidden=false;
    if (data.role!=='seller') {
      entry.hidden=true;
      document.querySelector('.actions').hidden=true;
      document.querySelector('#quote').hidden=true;
      const cards=document.querySelector('#cards');
      cards.replaceChildren();
      for (const person of data.sellers) {
        const section=document.createElement('section');
        const past=data.daily.filter(r=>r.person===person.id && r.day<=date.value);
        const orders=rows=>rows.reduce((n,r)=>n+(JSON.parse(r.counters)[4]??0),0);
        const month=date.value.slice(0,7);
        const plan=data.plans.find(p=>p.person===person.id&&p.month===month)?.target;
        const quarterPlans=data.plans.filter(p=>p.person===person.id);
        const quarterPlan=quarterPlans.length===3?quarterPlans.reduce((n,p)=>n+p.target,0):'—';
        section.textContent=person.name+' · '+person.salon+' | Miesiąc '+orders(past.filter(r=>r.day.startsWith(month)))+'/'+(plan??'—')+' | Kwartał '+orders(past)+'/'+quarterPlan;
        cards.append(section);
      }
      if (!data.sellers.length) load.textContent='Brak przypisanych handlowców.';
    } else {
      document.querySelector('#panel').hidden=true;
      state={person:data.sellers[0],plans:Object.fromEntries(data.plans.map(p=>[p.month,p.target])),
        days:Object.fromEntries(data.daily.map(r=>[r.day,JSON.parse(r.counters)]))};
      render();
    }
    daily.hidden=false;
  } catch(error) {
    if (latest===revision) load.textContent=error.message;
  }
}
date.addEventListener('change',()=>{if(date.value&&date.checkValidity())refresh();});
entry.addEventListener('submit',async event=>{
  event.preventDefault();
  if (!date.value || !date.checkValidity()) return date.reportValidity();
  const day=date.value;
  const values=metrics.map((_,i)=>{const value=entry.elements['m'+i].value;return value===''?null:Number(value);});
  const button=entry.querySelector('button');
  button.disabled=true;
  try {
    await api('',{person:state.person.id,day,values});
    if (day===date.value) {
      state.days[day]=values;
      render();
      status.textContent='Zapisano wynik dnia.';
    }
  } catch(error) {status.textContent=error.message;}
  finally {button.disabled=false;}
});
refresh();
