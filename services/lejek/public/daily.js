const $ = selector => document.querySelector(selector);
const sources = ['Salon (WALK)','Facebook','WWW','Karta kontaktu','OTOMOTO','Polecenia','Baza retencyjna','Importerskie','VEHIS i inne portale','Serwis','Galerie','Targi'];
const columns = ['Leady','Kontakty','Spotkania','Umówione jazdy','Jazdy próbne','Oferty','Follow-up','Zamówienia','Wydania'];
const quotes = ['Klient nie czyta w myślach. Zadzwoń.','Dobra jazda próbna zaczyna się od pytania.','Oferta wysłana? Daj klientowi powód, żeby do niej wrócił.','Czasem najlepszy argument to chwila ciszy.','Zamknij dzień, zanim dzień zamknie Ciebie.'];
const fortunes = ['Jutro gwiazdy sprzyjają follow-upom. Zwłaszcza tym wykonanym.','Przed Tobą dobra rozmowa. Numer telefonu jest w CRM-ie.','Ktoś jutro powie „muszę się zastanowić”. Zapytaj, nad czym.','Wróżba widzi dużo ruchu. Dobrze, że masz jazdy próbne.','Jutro może paść „biorę”. Miej pod ręką długopis.'];
const memes = [
  [
    "„Pan poda najlepszą cenę, bo żona już czeka w aucie”",
    "🚗 ⏳",
    "Żona wysiada. Idzie prosto do auta demonstracyjnego: „Kochanie, ale ja tego koloru nie chcę”."
  ],
  [
    "Auto w rozliczeniu. „Panie, igła”",
    "🔍 🚙",
    "Pytam o historię lakierniczą. Klient: „Każdy element ma swoją”."
  ],
  [
    "„Czy ten samochód jest od ręki?”",
    "🔑 📦",
    "„Tak, stoi przed salonem”. „Super. To poproszę taki sam, tylko w innym kolorze, z innym silnikiem i na jutro”."
  ],
  [
    "Piątek, 17:59. „Tylko jedno pytanie”",
    "🕕 ☕",
    "O 18:47 konfigurujemy już drugie auto. Pytanie było o parking."
  ],
  [
    "„Gdzie indziej mam taniej”",
    "🧾 👀",
    "Porównujemy oferty. Faktycznie, tam jest o 8 tysięcy taniej. Wystarczy doliczyć VAT."
  ],
  [
    "„Panie, ja się jeszcze prześpię z decyzją”",
    "📱 🌙",
    "22:46. SMS: „A ten czarny to jeszcze stoi?”"
  ],
  [
    "Jazda próbna. „Ja tylko po bułki”",
    "🥐 🛣️",
    "Wracamy po 40 minutach. Bułek brak. Kupił wersję z większym silnikiem."
  ],
  [
    "Koniec miesiąca w salonie",
    "📊 📞",
    "Kierownik: „Ile jeszcze możemy zamknąć?”. Handlowiec: „Drzwi. Za chwilę będzie 18”."
  ],
  [
    "„Żadnych dodatków, biorę podstawę”",
    "⚙️ 🚘",
    "Dziesięć minut później: „A jest wersja podstawowa z panoramą, kamerą 360 i grzanymi fotelami?”"
  ],
  [
    "„Kilometry? Głównie do kościoła”",
    "⛪ 🛣️",
    "Na liczniku 290 tysięcy. Parafia chyba w Portugalii."
  ],
  [
    "„Proszę ofertę na maila. Decyzja dzisiaj”",
    "📩 📅",
    "To było w marcu. Jest listopad. Dzisiaj odpisał: „A rabat jeszcze aktualny?”"
  ],
  [
    "„Widziałem w ogłoszeniu, że macie czerwony”",
    "📸 🚗",
    "„Mamy”. „To dobrze. Chcę go zobaczyć, żeby się upewnić, że wolę czarny”."
  ],
  [
    "„Ile pali?”",
    "⛽",
    "Po jeździe próbnej już wiemy. Dwie odpowiedzi: moja i ta przy wciśniętym gazie."
  ],
  [
    "„Proszę zarezerwować do jutra”",
    "📅",
    "Jutro, któremu właśnie stuknęły trzy tygodnie."
  ],
  [
    "„Na pewno nie potrzebuję automatu”",
    "⚙️",
    "Po jeździe: „A można wycenić mojego manuala jeszcze dzisiaj?”"
  ],
  [
    "„Ja nie potrzebuję dużego bagażnika”",
    "📦",
    "Wyjmuje miarkę. Potem z auta psa. To pies ma decydujący głos."
  ],
  [
    "„Czy dywaniki są w cenie?”",
    "🚙",
    "Auto za 190 tysięcy. Negocjacje stanęły na czterech kawałkach gumy."
  ],
  [
    "„Biorę, jak się zmieści w garażu”",
    "📏",
    "Auto weszło. Teraz negocjujemy, który regał idzie na OLX."
  ],
  [
    "„Jestem już pod salonem”",
    "📍",
    "Na mapie: owszem. Pod salonem tej samej marki, 80 kilometrów dalej."
  ],
  [
    "„Proszę mi wysłać jedną ostateczną ofertę”",
    "📩",
    "W folderze: OSTATECZNA_7_PO_ROZMOWIE_Z_ŻONĄ.pdf."
  ],
  [
    "„Zakup na firmę, dane podam później”",
    "🧾",
    "O 16:58: „Fakturę proszę na inną firmę. I jeszcze z innym autem”."
  ],
  [
    "„Dlaczego w ogłoszeniu jest od?”",
    "💬",
    "„Bo to cena wersji podstawowej”. „A do ilu jest to »od«?”"
  ],
  [
    "„Czy można odebrać w sobotę o ósmej?”",
    "🗓️",
    "„Otwieramy o dziewiątej”. „Spokojnie, przyjadę dziesięć minut wcześniej”."
  ],
  [
    "„Poproszę kawę, czarną”",
    "☕",
    "Jedyna rzecz, której kolor ustaliliśmy na pierwszym spotkaniu."
  ],
  [
    "„Jestem zdecydowany na białe”",
    "🎨",
    "Pewność trwała do chwili, gdy na plac wjechało grafitowe."
  ],
  [
    "„To będzie drugie auto, tylko na miasto”",
    "🏙️",
    "Konfiguracja końcowa: 4×4, hak i felgi 20 cali."
  ],
  [
    "„Przyjadę z kimś, kto się zna”",
    "👥",
    "Przyjechali w cztery osoby. Każda ma innego faworyta."
  ],
  [
    "„Czy ubezpieczenie można policzyć osobno?”",
    "🧮",
    "Można. Właśnie do oferty dołączył trzeci kalkulator i wujek z PZU."
  ],
  [
    "„Podjadę tylko zostawić dokumenty”",
    "📂",
    "Godzinę później dokumenty nadal w samochodzie. Za to znamy cenę trzech wersji."
  ],
  [
    "„Czy macie to auto jeszcze na placu?”",
    "🌨️",
    "„Tak, właśnie je odśnieżam”. „Super, proszę wysłać zdjęcie dachu”."
  ],
  [
    "„Proszę mi policzyć ratę”",
    "💳",
    "„Jaka wpłata własna?”. „Najlepiej żadna. I rata też możliwie żadna”."
  ],
  [
    "„Mam tylko 15 minut”",
    "⏱️",
    "Zdążyliśmy ustalić, którą z trzech hybryd zaczniemy omawiać."
  ],
  [
    "„W samochodzie nigdy nie palono”",
    "🔍",
    "Po otwarciu drzwi rzeczoznawca zapytał, czy aby na pewno mówimy o papierosach, a nie o ognisku."
  ],
  [
    "„Proszę tylko o numer VIN”",
    "🔢",
    "Dziesięć minut później klient zna historię auta. Ja nadal nie znam jego imienia."
  ],
  [
    "„Chcę taki jak na zdjęciu”",
    "📸",
    "Na zdjęciu plakat producenta. Zgadza się marka i kolor nieba."
  ],
  [
    "„Kiedy wejdzie nowy model?”",
    "📆",
    "„Za pół roku”. „A czy na ten za pół roku jest już rabat?”"
  ],
  [
    "„Nie kupuję pod wpływem emocji”",
    "❤️",
    "Po odpaleniu silnika: „Ma pan od razu terminal?”"
  ],
  [
    "„Zależy mi na niskim spalaniu”",
    "⛽",
    "Pierwsze pytanie po jeździe próbnej: „A da się wyłączyć ten tryb Eco na stałe?”"
  ],
  [
    "„Czy mogę wpaść bez umawiania?”",
    "📞",
    "Pytanie zadaje, stojąc przy moim biurku."
  ],
  [
    "„Mam już kupca na swoje auto”",
    "🔑",
    "Kupiec chce je obejrzeć w niedzielę. Koniecznie tę, w którą nie może."
  ],
  [
    "„Proszę doliczyć zimówki”",
    "🛞",
    "„Na felgach czy same opony?”. „Panie, żeby zimą jechało, a nie żeby było dalsze pytanie”."
  ],
  [
    "„Dostanę ofertę w PDF-ie?”",
    "📎",
    "Dostał. Wydrukował. Zrobił zdjęcie. Odesłał na WhatsAppie z pytaniem o cenę zaznaczoną na żółto."
  ],
  [
    "„Najpierw zobaczę konkurencję”",
    "🚗",
    "Wraca po godzinie. „Mogę jeszcze raz dostać tę kawę? Samochód biorę”."
  ],
  [
    "„Czy te felgi są standardowe?”",
    "🛞",
    "„Opcjonalne”. „To proszę je zostawić. Tylko standardowo”."
  ],
  [
    "„Dzwonię w sprawie auta z ogłoszenia”",
    "📱",
    "„Którego?”. „No tego, co jest na początku internetu”."
  ],
  [
    "„Chcę wysoki samochód, żeby łatwo wsiadać”",
    "🚙",
    "Wybraliśmy SUV-a. Przetestowała mama. Ostateczną decyzję podjął próg garażu."
  ],
  [
    "„Samochód ma być dla żony”",
    "👥",
    "Żona wybiera kolor. Mąż od pół godziny konfiguruje sobie drugi komplet felg."
  ],
  [
    "„A co pan by wybrał dla siebie?”",
    "🤔",
    "Odpowiadam. Klient: „Rozumiem. To ja poproszę ten drugi”."
  ]
];
let pageMeme;
function nextMeme() {
  const key='lejek.memes.seen.v1';
  let seen=[];
  try {
    const stored=JSON.parse(localStorage.getItem(key));
    if (Array.isArray(stored)) seen=stored;
  } catch {}
  let remaining=memes.filter(([title])=>!seen.includes(title));
  if (!remaining.length) {
    const last=seen.findLast(title=>memes.some(([candidate])=>candidate===title));
    remaining=memes.filter(([title])=>title!==last);
    seen=[];
  }
  const selection=remaining[Math.floor(Math.random()*remaining.length)];
  try {
    localStorage.setItem(key,JSON.stringify([...seen,selection[0]]));
  } catch {}
  return selection;
}
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
let preview=true;

async function api(path,body) {
  const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const result=await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function pluralForm(count,forms) {
  if (count===1) return forms[0];
  const last=count%10;
  const lastTwo=count%100;
  return last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?forms[1]:forms[2];
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
  const todayTasks=[
    {verb:'Skontaktuj się z', forms:['klientem','klientami','klientami'], note:'Zacznij od osoby, która czeka na odpowiedź.', col:1, index:0},
    {verb:'Umów', forms:['jazdę próbną','jazdy próbne','jazd próbnych'], note:'Zaproponuj od razu konkretny termin.', col:2, index:1},
    {verb:'Wyślij', forms:['ofertę','oferty','ofert'], note:'Zacznij od klienta, który jest najbliżej decyzji.', col:5, index:3}
  ].map(task=>({...task,gap:Math.max(0,targets.reduce((sum,row)=>sum+row[task.col],0)-(current[task.index]??0))}))
    .filter(task=>task.gap>0);
  $('#tasks').innerHTML=todayTasks.length?todayTasks.map(({verb,forms,note,gap})=>
    '<li><span class="task-action"><span>'+verb+'</span> <strong>'+gap+'</strong> <span>'+pluralForm(gap,forms)+'</span></span>'+
    '<small class="task-note">'+note+'</small></li>').join(''):
    '<li class="task-message">'+(salesGoal==null?'Ustal z kierownikiem cel, a tutaj pojawią się Twoje zadania.':'Brawo! Dzisiejsze cele są zrealizowane.')+'</li>';
  const daysMonth=remainingDays(monthKey+'-01',monthEnd);
  const elapsed=daysMonth-remainingDays(data.today,monthEnd);
  const monthTargets=monthPlan?sourceTargets(monthPlan):[];
  $('#pace').innerHTML=monthPlan==null?'':[['Kontakty',1,0],['Jazdy',4,2],['Oferty',5,3]].map(([label,col,i])=>{
    const goal=Math.round(monthTargets.reduce((sum,row)=>sum+row[col],0)*(elapsed+Number(weekday(data.today)))/daysMonth);
    const delta=monthRecords.reduce((sum,[,v])=>sum+(v[i]??0),0)-goal;
    return '<span>'+label+' <strong class="'+(delta<0?'behind':delta>0?'ahead':'')+'">'+(delta>0?'+':'')+delta+'</strong></span>';
  }).join('');
}

function renderQuote(text) {
  const full=$('#quote');
  if (full.textContent===text) return;
  full.textContent=text;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  const card=full.closest('.quote');
  const animated=$('#quote-animated');
  const letters=Array.from(text);
  const interval=Math.min(42,1600/letters.length);
  let started;
  card.classList.add('is-typing');
  animated.textContent='';
  function frame(now) {
    started ??= now;
    const count=Math.floor((now-started)/interval);
    if (count>=letters.length||motion.matches) {
      card.classList.remove('is-typing');
      return;
    }
    animated.textContent=letters.slice(0,count).join('');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderSeller(readOnly=false) {
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
  renderQuote(quotes[dayIndex%quotes.length]);
  renderPlans(records);
  $('#entry-date').textContent=dateLabel(day);
  $('#backlog').hidden=!next;
  $('#backlog-text').textContent=next?personal.missing.length+' do rozliczenia · '+dateLabel(next)+(waiting?' · Czeka na zatwierdzenie':''):'';
  $('#resolve').hidden=!next||day===next||waiting;
  for (const button of document.querySelectorAll('[data-kind]')) button.hidden=!next||day!==next||waiting;
  $('#reason').hidden=true;
  $('#save').disabled=readOnly||busy||Boolean(blocked)||locked;
  const matrix=records[day]?.[5];
  const legacy=records[day]&&!matrix;
  $('#columns').innerHTML='<tr><th scope="col">Źródło</th>'+columns.map(name=>'<th scope="col">'+name+'</th>').join('')+'</tr>';
  $('#rows').innerHTML=legacy?'':sources.map((name,r)=>'<tr><th scope="row">'+name+'</th>'+columns.map((label,c)=>
    '<td><input type="number" min="0" max="1000000" step="1" inputmode="numeric" aria-label="'+name+' – '+label+'" name="v'+r+'_'+c+'" value="'+(matrix?.[r]?.[c]??'')+'"'+(locked||readOnly?' disabled':'')+'></td>').join('')+'</tr>').join('');
  $('#status').textContent=readOnly?'Podgląd · zapis dostępny na koncie handlowca.':legacy?'Dzień zapisano wcześniej w formacie sumarycznym.':locked?'Dzień rozliczony.':blocked?'Najpierw rozlicz zaległość.':'';
  const showMeme=data.sidebarMode==='meme';
  $('#cause').hidden=showMeme;
  $('#meme').hidden=!showMeme;
  if (showMeme) {
    const [title,icon,caption]=pageMeme ??= nextMeme();
    $('#meme-title').textContent=title;
    $('#meme-icon').textContent=icon;
    $('#meme-caption').textContent=caption;
  }
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
    $('#sidebar-settings').elements.mode.value=data.sidebarMode;
    $('#charity').elements.month.value ||= data.today.slice(0,7);
  }
}
function showView() {
  $('#daily').hidden=true;
  $('#admin').hidden=true;
  if (data.role==='seller') {
    renderSeller();
    return;
  }
  $('#preview-bar').hidden=false;
  $('#view-switch').textContent=preview?'Zarządzanie salonem':'Podgląd handlowca';
  if (!preview) {
    renderAdmin();
    return;
  }
  const actual=data;
  const [year,month]=actual.today.split('-').map(Number);
  const quarterStart=Math.floor((month-1)/3)*3;
  data={today:actual.today,sellers:[{salon:'Salon demonstracyjny'}],
    plans:[0,1,2].map(offset=>({month:monthStart(year,quarterStart+offset).slice(0,7),target:12})),
    daily:[],personal:{missing:[],exceptions:{},progress:[0,0]},
    sidebarMode:actual.sidebarMode,cause:actual.cause};
  try { renderSeller(true); } finally { data=actual; }
}
$('#view-switch').onclick=()=>{preview=!preview;showView();};
async function refresh() {
  data=await api('/api/daily?month='+today.slice(0,7));
  $('#load').textContent='';
  $('#display-date').textContent=dateLabel(data.today,{day:'numeric',month:'long',year:'numeric'});
  showView();
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
  if(data.role!=='seller') return;
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
$('#sidebar-settings').onsubmit=event=>{
  event.preventDefault();
  run(()=>api('/api/sidebar',{mode:event.target.elements.mode.value}));
};
$('#charity').onsubmit=event=>{
  event.preventDefault();
  const form=event.target;
  run(()=>api('/api/cause',Object.fromEntries(new FormData(form))));
};
refresh().catch(error=>{$('#load').textContent=error.message;});
