const $ = selector => document.querySelector(selector);
const sources = ['Salon (WALK)','Facebook','WWW','Karta kontaktu','OTOMOTO','Polecenia','Baza retencyjna','Importerskie','VEHIS i inne portale','Serwis','Galerie','Targi'];
const columns = ['Leady','Kontakty','Spotkania','Umówione jazdy','Jazdy próbne','Oferty','Follow-up','Zamówienia','Wydania'];
const quotes = ['Klient nie czyta w myślach. Zadzwoń.','Dobra jazda próbna zaczyna się od pytania.','Oferta wysłana? Daj klientowi powód, żeby do niej wrócił.','Czasem najlepszy argument to chwila ciszy.','Zamknij dzień, zanim dzień zamknie Ciebie.'];
const fortunes = ['Jutro gwiazdy sprzyjają follow-upom. Zwłaszcza tym wykonanym.','Przed Tobą dobra rozmowa. Numer telefonu jest w CRM-ie.','Ktoś jutro powie „muszę się zastanowić”. Zapytaj, nad czym.','Wróżba widzi dużo ruchu. Dobrze, że masz jazdy próbne.','Jutro może paść „biorę”. Miej pod ręką długopis.'];
const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date());
const dateLabel = (day,options={day:'numeric',month:'long'}) => new Date(day+'T12:00:00Z').toLocaleDateString('pl-PL',options);
const weekday = day => ![0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());
const remainingDays = (start,end) => {
  let count=0;
  for (let at=Date.parse(start); at<Date.parse(end); at+=86400000) {
    if (weekday(new Date(at).toISOString().slice(0,10))) count++;
  }
  return count;
};
const monthStart = (year,month) => new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
let data;
let editDay;
let busy=false;

async function api(path,body) {
  const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const result=await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function renderPlans(records) {
  const [year,month]=data.today.split('-').map(Number);
  const monthKey=data.today.slice(0,7);
  const quarter=Math.floor((month-1)/3);
  const monthEnd=monthStart(year,month);
  const quarterEnd=monthStart(year,quarter*3+3);
  const monthPlan=data.plans.find(row=>row.month===monthKey)?.target;
  const quarterPlan=data.plans.length===3?data.plans.reduce((total,row)=>total+row.target,0):null;
  const sales=entries=>entries.reduce((total,[,values])=>total+(values[4]??0),0);
  const toDate=Object.entries(records).filter(([day])=>day<=data.today);
  const monthRecords=toDate.filter(([day])=>day.startsWith(monthKey));
  const monthSales=sales(monthRecords);
  const quarterSales=sales(toDate);
  const monthGap=monthPlan==null?0:Math.max(0,monthPlan-monthSales);
  const quarterGap=quarterPlan==null?0:Math.max(0,quarterPlan-quarterSales);
  const daysLeft=Math.max(1,remainingDays(data.today,monthEnd));
  const salesGoal=monthPlan==null&&quarterPlan==null?null:Math.ceil(Math.max(monthGap/daysLeft,quarterGap/Math.max(1,remainingDays(data.today,quarterEnd))));
  const current=records[data.today]??[];
  const cards=[['Dzisiaj',current[4]??0,salesGoal==null?null:salesGoal+(current[4]??0)],['Miesiąc',monthSales,monthPlan],['Kwartał',quarterSales,quarterPlan]];
  $('#cards').innerHTML=cards.map(([name,value,target])=>{
    const gap=target==null?null:target-value;
    return '<section><span>'+name+'</span><strong>'+value+' / '+(target??'—')+'</strong><small class="'+(gap>0?'behind':gap<0?'ahead':'')+'">'+
      (gap==null?'Brak planu':gap>0?'Brakuje '+gap:gap<0?'Ponad plan':'Plan osiągnięty')+'</small></section>';
  }).join('');
  const targets=salesGoal?sourceTargets(salesGoal):[];
  const todayTasks=[['Skontaktuj się z klientami',1,0],['Umów jazdy próbne',2,1],['Wyślij oferty',5,3]]
    .map(([label,col,i])=>[label,Math.max(0,targets.reduce((sum,row)=>sum+row[col],0)-(current[i]??0))]).filter(([,gap])=>gap>0);
  $('#tasks').innerHTML=todayTasks.length?todayTasks.map(([label,gap])=>'<li><strong>'+gap+'</strong> · '+label+'</li>').join(''):
    '<li>'+(salesGoal==null?'Poproś kierownika o ustawienie planu.':'Dzisiejsze cele są osiągnięte.')+'</li>';
  const daysMonth=remainingDays(monthKey+'-01',monthEnd);
  const elapsed=daysMonth-remainingDays(data.today,monthEnd);
  const monthTargets=monthPlan?sourceTargets(monthPlan):[];
  $('#pace').innerHTML=monthPlan==null?'':[['Kontakty',1,0],['Jazdy',4,2],['Oferty',5,3]].map(([label,col,i])=>{
    const goal=Math.round(monthTargets.reduce((sum,row)=>sum+row[col],0)*(elapsed+Number(weekday(data.today)))/daysMonth);
    const delta=monthRecords.reduce((sum,[,v])=>sum+(v[i]??0),0)-goal;
    return '<span>'+label+' <strong class="'+(delta<0?'behind':delta>0?'ahead':'')+'">'+(delta>0?'+':'')+delta+'</strong></span>';
  }).join('');
}

function renderSeller() {
  const {brand,personal,cause}=data;
  const salon=data.sellers[0].salon;
  $('#dealer').textContent=brand?.name??salon;
  $('#salon').textContent=brand?salon:'';
  $('#logo').hidden=!brand?.logo;
  if (brand?.logo) $('#logo').src=brand.logo;
  const records=Object.fromEntries(data.daily.map(row=>[row.day,JSON.parse(row.counters)]));
  const next=personal.missing[0];
  const day=next&&editDay===next?editDay:data.today;
  const exception=personal.exceptions[day];
  const waiting=personal.exceptions[next]==='pending';
  const blocked=(next&&day!==next)||exception==='pending';
  const locked=Boolean(records[day]||exception==='zero'||exception==='leave'||exception==='training');
  const dayIndex=Math.floor(Date.parse(data.today)/86400000);
  $('#quote').textContent=quotes[dayIndex%quotes.length];
  renderPlans(records);
  $('#entry-date').textContent=dateLabel(day);
  $('#backlog').hidden=!next;
  $('#backlog-text').textContent=next?personal.missing.length+' do rozliczenia · '+dateLabel(next)+(waiting?' · Czeka na zatwierdzenie':''):'';
  $('#resolve').hidden=!next||day===next||waiting;
  for (const button of document.querySelectorAll('[data-kind]')) button.hidden=!next||day!==next||waiting;
  $('#reason').hidden=true;
  $('#save').disabled=busy||Boolean(blocked)||locked;
  const matrix=records[day]?.[5];
  const legacy=records[day]&&!matrix;
  $('#columns').innerHTML='<tr><th scope="col">Źródło</th>'+columns.map(name=>'<th scope="col">'+name+'</th>').join('')+'</tr>';
  $('#rows').innerHTML=legacy?'':sources.map((name,r)=>'<tr><th scope="row">'+name+'</th>'+columns.map((label,c)=>
    '<td><input type="number" min="0" max="1000000" step="1" inputmode="numeric" aria-label="'+name+' – '+label+'" name="v'+r+'_'+c+'" value="'+(matrix?.[r]?.[c]??'')+'"'+(locked?' disabled':'')+'></td>').join('')+'</tr>').join('');
  $('#status').textContent=legacy?'Dzień zapisano wcześniej w formacie sumarycznym.':locked?'Dzień rozliczony.':blocked?'Najpierw rozlicz zaległość.':'';
  $('#cause-title').textContent=cause?.title??'Cel w przygotowaniu';
  $('#cause-org').textContent=cause?.organization??'';
  $('#cause-description').textContent=cause?.description??'Organizacja i opis pojawią się po opublikowaniu celu.';
  const [done,expected]=personal.progress;
  $('#progress-text').textContent=done+' z '+expected+' dni pracy rozliczonych do dziś';
  $('#progress').max=expected||1;
  $('#progress').value=done;
  $('#fortune').textContent=records[data.today]?fortunes[dayIndex%fortunes.length]:'Otworzy się po zapisaniu dzisiejszych wyników.';
  $('#daily').hidden=false;
}

function renderAdmin() {
  $('#dealer').textContent='Panel salonu';
  $('#admin').hidden=false;
  $('#team').textContent=data.sellers.length+' handlowców';
  const reviews=$('#reviews');
  reviews.replaceChildren();
  if (!data.approvals.length) reviews.textContent='Brak zgłoszeń do rozpatrzenia.';
  for (const review of data.approvals) {
    const card=document.createElement('article');
    const label=document.createElement('strong');
    label.textContent=data.sellers.find(seller=>seller.id===review.person)?.name+' · '+dateLabel(review.day);
    const note=document.createElement('p');
    note.textContent=review.reason;
    card.append(label,note);
    for (const approve of [true,false]) {
      const button=document.createElement('button');
      button.textContent=approve?'Zatwierdź dzień bez aktywności':'Odrzuć';
      button.onclick=()=>run(()=>api('/api/review',{person:review.person,day:review.day,approve}));
      card.append(button);
    }
    reviews.append(card);
  }
  $('#settings').hidden=data.role!=='admin';
  if (data.role==='admin') {
    const form=$('#brand');
    const selected=form.elements.salon.value;
    form.elements.salon.replaceChildren(...data.salons.map(({salon})=>new Option(salon,salon)));
    if (selected) form.elements.salon.value=selected;
    $('#charity').elements.month.value ||= data.today.slice(0,7);
  }
}
async function refresh() {
  data=await api('/api/daily?month='+today.slice(0,7));
  $('#load').textContent='';
  $('#display-date').textContent=dateLabel(data.today,{day:'numeric',month:'long',year:'numeric'});
  if(data.role==='seller') renderSeller();
  else renderAdmin();
}
async function run(operation,openCookie=false) {
  if (busy) return;
  busy=true;
  $('#save').disabled=true;
  try {
    await operation();
    editDay=null;
    busy=false;
    await refresh();
    if (openCookie) $('#cookie').open=true;
    if (data.role!=='seller') $('#load').textContent='Zapisano zmiany.';
  } catch(error) {
    $('#load').textContent=error.message;
    if(data?.role==='seller') {
      const day=editDay??data.today;
      $('#status').textContent=error.message;
      $('#save').disabled=Boolean(data.personal.missing[0]&&day!==data.personal.missing[0])||data.personal.exceptions[day]==='pending';
    }
  } finally {busy=false;}
}
$('#resolve').onclick=()=>{editDay=data.personal.missing[0];renderSeller();$('#rows input')?.focus();};
$('#entry').onsubmit=event=>{
  event.preventDefault();
  const day=editDay??data.today;
  const rows=sources.map((_,r)=>columns.map((__,c)=>Number(event.target.elements['v'+r+'_'+c].value)));
  run(()=>api('/api/daily',{person:data.sellers[0].id,day,rows}),day===data.today);
};
for (const button of document.querySelectorAll('[data-kind]')) button.onclick=()=>{
  const {kind}=button.dataset;
  const reason=$('#reason');
  if(kind==='pending'&&(!reason.value.trim()||reason.hidden)){reason.hidden=false;reason.focus();return;}
  run(()=>api('/api/day-exception',{person:data.sellers[0].id,day:editDay,kind,reason:reason.value})).then(()=>{if(reason.hidden) reason.value='';});
};
$('#brand').onsubmit=event=>{
  event.preventDefault();
  const {salon,name,logo}=event.target.elements;
  const file=logo.files[0];
  if(file?.size>40960){$('#load').textContent='Logo może mieć maksymalnie 40 KB.';return;}
  run(async ()=>{
    const encoded=file?await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('Nie udało się odczytać logo.'));
      reader.readAsDataURL(file);
    }):'';
    await api('/api/brand',{salon:salon.value,name:name.value,logo:encoded});
  });
};
$('#charity').onsubmit=event=>{
  event.preventDefault();
  const form=event.target;
  run(()=>api('/api/cause',Object.fromEntries(new FormData(form))));
};
refresh().catch(error=>{$('#load').textContent=error.message;});
