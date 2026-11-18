const reviewNotes = {
  below:['Google nie czyta w myślach. Przypomnij klientowi po odbiorze, że może zostawić opinię.','Klient wyjechał nowym autem. Link do opinii może ruszyć za nim.','Kluczyki przekazane, zdjęcie z odbioru zrobione. Czas powiedzieć klientowi, gdzie może podzielić się wrażeniami.','Google ma wolne miejsce. Zaproś ostatniego klienta do podzielenia się wrażeniami.'],
  on:['Opinie dowiezione. Nawigacja może przestać mówić „przeliczam trasę”.','Plan w punkt. Nawet Google Maps nie znalazłoby krótszej drogi.'],
  above:['Google chyba już wie, gdzie pracujesz. Dobra robota!','Plan został w lusterku wstecznym. Możesz dopić kawę na ciepło.','Zrzut ekranu do rozmowy o podwyżce? Materiał jest.','Opinie przyjechały w komplecie i jeszcze przywiozły kolegów.']
};
const belowPlanNotes = {
  "Kontakty": [
    "Telefon sam nie zadzwoni. Ma w tej sprawie bardzo konsekwentne stanowisko.",
    "Lista kontaktów czeka. Zacznij od osoby, której obiecałeś oddzwonić.",
    "Klient może być gotowy. Twój numer nadal ma ustawione «dzwoń pierwszy».",
    "CRM nie gryzie. Co najwyżej przypomni, komu obiecałeś telefon.",
    "Uwaga, na biurku wykryto sprawny telefon. Czas na pierwsze połączenie.",
    "Na telepatię jeszcze nie ma rubryki. Zadzwoń do klienta, który czeka na odpowiedź."
  ],
  "Jazdy próbne": [
    "Auto demonstracyjne ma dziś mniej ruchu niż ekspres do kawy. Umów jazdę.",
    "Kluczyki leżą na biurku i udają wyposażenie ekspozycji. Zaproponuj klientowi termin.",
    "Place parkingowe są świetne, ale klient nie poczuje na nich zawieszenia. Zaproś go na jazdę.",
    "Auto zna już każdy centymetr placu. Pokaż mu kawałek drogi z klientem za kierownicą.",
    "Tryb parkingowy opanowany do perfekcji. Czas wpisać do kalendarza jazdę próbną.",
    "Fotel kierowcy nie przeprowadzi prezentacji sam. Zaproś klienta, żeby w nim usiadł."
  ],
  "Oferty": [
    "Oferta w szkicach ma skuteczność koperty bez znaczka. Wyślij ją.",
    "PDF sam się nie wyśle. Sprawdzał to już niejeden handlowiec.",
    "Wersja «oferta_final» czeka na swoją premierę. Wyślij ją klientowi po ostatnim sprawdzeniu.",
    "Kalkulator wykonał swoją część roboty. Teraz kolej na przycisk «Wyślij».",
    "Klient prosił o konkrety. Dobra wiadomość: możesz mu je wysłać szybciej niż kalkulator się rozładuje.",
    "Najlepszy rabat w szkicach nikogo jeszcze nie przekonał. Wyślij ofertę klientowi, który na nią czeka."
  ]
};
const abovePlanNotes = [
  "Możesz iść na urlop. Kierownik pewnie poprosi tylko o datę powrotu.",
  "Zasłużyłeś na przerwę. Tym razem kawa ma szansę być wypita na ciepło.",
  "Złóż wniosek o podwyżkę. Załącznik już masz.",
  "Kawa na koszt firmy? Zacznij negocjacje od dwóch.",
  "CRM właśnie sprawdza, czy to na pewno Twój pierwszy bieg.",
  "Plan miał być ambitny. Chyba nie przewidział Ciebie.",
  "Zrób zrzut ekranu. Przy rozmowie o premii może się przydać.",
  "Na dziś wolno Ci zamknąć Excela bez poczucia winy.",
  "Premia sama się nie wynegocjuje. Chociaż te liczby próbują.",
  "Ktoś tu zasłużył na kawę. Dopisz do wyposażenia standardowego.",
  "Jeśli kierownik spyta, co się stało, powiedz: „To było w standardzie”.",
  "Możesz złożyć wniosek o dodatkowy pączek. Uzasadnienie jest powyżej.",
  "Ustaw status „na przerwie”. Tylko nie zapomnij wrócić po komplementy.",
  "Kierownik może już odświeżać raport. Tym razem z ciekawości.",
  "Pora na przerwę. Siadaj, zanim ktoś dopisze Ci kolejne zadanie.",
  "Nie zmieściłeś się w planie. Z tej strony to akurat dobra wiadomość.",
  "Ogłoś przerwę techniczną. Organizm domaga się kawy i oklasków.",
  "Przy negocjacji podwyżki zacznij od: „Pokażę tylko jedną rzecz”.",
  "Niech teraz ktoś spróbuje Ci sprzedać dodatkowe zadanie bez rabatu.",
  "Na placu można odpalić klakson. W biurze wystarczy przybić piątkę.",
  "Jeżeli to był tryb Eco, kierownik będzie chciał zobaczyć Sport.",
  "Zrób miejsce na biurku. Chwalipięctwo najlepiej wygląda na czysto.",
  "Dobra robota. Możesz wybrać, kto dziś stawia kawę.",
  "Prośba o dzień wolny właśnie dostała solidne uzasadnienie."
];
const $ = selector => document.querySelector(selector);
const sources = ['Salon (WALK)','Facebook','WWW','Karta kontaktu','OTOMOTO','Polecenia','Baza retencyjna','Importerskie','VEHIS i inne portale','Serwis','Galerie','Targi'];
// Keep the existing daily row positions. Slot 3 is the retired scheduled-drive count.
const columns = [
  [0,'Leady'],[1,'Kontakty'],[2,'Spotkania'],[4,'Jazdy próbne'],[5,'Oferty'],
  [6,'Follow-up'],[7,'Zamówienia'],[10,'Wystawione faktury'],[8,'Wydania'],[9,'Opinie Google']
];
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
let preview=false;

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
  const funnel=data.funnelPlans?.find(row=>row.month===monthKey);
  const custom=funnel?JSON.parse(funnel.targets):[];
  const actionNumbers=[0,2,3];
  const actionTotal=index=>monthRecords.reduce((sum,[,values])=>sum+(values[index]??0),0);
  const targetFor=index=>custom[actionNumbers.indexOf(index)]??null;
  const todayTasks=[
    {verb:'Skontaktuj się z', forms:['klientem','klientami','klientami'], col:1, index:0},
    {verb:'Przeprowadź', forms:['jazdę próbną','jazdy próbne','jazd próbnych'], col:4, index:2},
    {verb:'Wyślij', forms:['ofertę','oferty','ofert'], col:5, index:3}
  ].map(task=>({...task,gap:Math.max(0,targetFor(task.index)==null
      ?targets.reduce((sum,row)=>sum+row[task.col],0)-(current[task.index]??0)
      :Math.ceil(Math.max(0,targetFor(task.index)-actionTotal(task.index))/daysLeft))}))
    .filter(task=>task.gap>0);
  $('#tasks').innerHTML=todayTasks.length?todayTasks.map(({verb,forms,gap})=>
    '<li><span class="task-action"><span>'+verb+'</span> <strong>'+gap+'</strong> <span>'+pluralForm(gap,forms)+'</span></span></li>').join(''):
    '<li class="task-message">'+(salesGoal==null&&!funnel?'Ustal z kierownikiem cel, a tutaj pojawią się Twoje zadania.':'Brawo! Dzisiejsze cele są zrealizowane.')+'</li>';
  const daysMonth=remainingDays(monthKey+'-01',monthEnd);
  const elapsed=daysMonth-remainingDays(data.today,monthEnd);
  const monthTargets=monthPlan?sourceTargets(monthPlan):[];
  const reviewTarget=data.reviewPlans?.find(row=>row.month===monthKey)?.target??null;
  // Keep the first three custom targets in the order used by existing saved plans.
  const customIndex={1:0,4:1,5:2,0:3,2:4,6:5,10:6,8:7};
  const legacyIndex={1:0,4:2,5:3,7:4};
  const todayFraction=(elapsed+Number(weekday(data.today)))/daysMonth;
  $('#pace').hidden=false;
  const metrics=columns.map(([index,label])=>{
    const actual=monthRecords.reduce((total,[,values])=>{
      const matrix=values[5];
      return total+(Array.isArray(matrix)
        ?matrix.reduce((sum,row)=>sum+(row[index]??0),0)
        :(values[legacyIndex[index]]??0));
    },0);
    const defaultTarget=monthPlan!=null&&index<=7
      ?monthTargets.reduce((sum,row)=>sum+(row[index]??0),0)
      :null;
    const target=index===9?reviewTarget:index===7?(monthPlan??null):(custom[customIndex[index]]??defaultTarget);
    const goal=target==null?null:Math.round(target*todayFraction);
    const delta=goal==null?null:actual-goal;
    return {index,label,actual,target,goal,delta};
  });
  $('#pace-items').innerHTML=metrics.map(({label,actual,target,goal,delta})=>{
    const style=delta<0?'behind':delta>0?'ahead':'';
    const status=delta==null?'Brak celu':delta<0?'Brakuje '+(-delta):delta>0?'Ponad planem o '+delta:'Zgodnie z planem';
    return '<div class="pace-item"><span>'+label+'</span><strong class="pace-count">'+actual+' / '+(goal??'—')+'</strong>'+
      '<strong class="'+style+'">'+status+'</strong>'+(target==null?'':'<small class="pace-month">Cel miesiąca · '+target+'</small>')+'</div>';
  }).join('');
  renderMotivator(metrics,data.today);
}

const actionsByMetric={
  0:'Wróć do nowych zapytań i uzupełnij leady.',
  1:'Oddzwoń najpierw do klientów, którzy czekają na odpowiedź.',
  2:'Zaproponuj zainteresowanym klientom konkretną godzinę spotkania.',
  4:'Potwierdź z klientami terminy jazd i przygotuj auta.',
  5:'Dokończ oferty dla klientów najbliżej decyzji i wyślij je.',
  6:'Wróć do wysłanych ofert i ustal z klientami następny krok.',
  7:'Skontaktuj się z klientami, którzy są najbliżej podpisania zamówienia.',
  10:'Sprawdź, które transakcje mają komplet dokumentów do wystawienia faktury.',
  8:'Potwierdź terminy odbiorów i sprawdź gotowość aut.',
  9:'Po odbiorze zaproś klientów do podzielenia się szczerą opinią.'
};
const belowSummaryNotes=[
  'Tu lejek włączył hamulec. Zacznij od pierwszego kroku poniżej.',
  'Tu mamy korek. Najpierw odblokuj ten odcinek.',
  'Temat nie zniknie po odświeżeniu raportu. Jeden konkretny ruch będzie lepszy.',
  'Tu warto wrzucić bieg. Rozgrzewkę mamy już za sobą.'
];

function renderMotivator(metrics,day) {
  const dayIndex=Math.floor(Date.parse(day)/86400000);
  const ranked=metrics.filter(metric=>metric.goal>0)
    .sort((a,b)=>b.actual/b.goal-a.actual/a.goal||b.delta-a.delta);
  const strongest=ranked[0];
  const gaps=ranked.filter(metric=>metric.delta<0).reverse();
  const weakest=gaps[0]??ranked.at(-1);
  const percent=metric=>new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(100*metric.actual/metric.goal)+'% celu na dziś';
  const best=$('#motivation-best');
  const low=$('#motivation-low');
  best.hidden=!strongest||strongest===weakest&&strongest.delta<0;
  low.hidden=!weakest||weakest===strongest&&weakest.delta>=0;
  if (!best.hidden) {
    const notes=strongest.index===9?reviewNotes.above:abovePlanNotes;
    const note=strongest.delta>0?notes[dayIndex%notes.length]
      :strongest.delta===0?'Tu jesteś na planie. Nawigacja nie musi przeliczać trasy.'
      :'Tu jesteś najbliżej celu. Silnik pracuje, jeszcze kawałek drogi.';
    best.textContent='Najmocniejszy punkt · '+strongest.label+' · '+percent(strongest)+'. '+note;
  }
  if (!low.hidden) {
    const notes=weakest.index===9?reviewNotes.below:(belowPlanNotes[weakest.label]??belowSummaryNotes);
    const note=weakest.delta<0?notes[dayIndex%notes.length]:'Tu masz najmniejszy zapas. Trzymaj tempo, a kawa może zostać w kubku.';
    low.textContent=(weakest.delta<0?'Najdalej od celu':'Najmniejszy zapas')+' · '+weakest.label+' · '+percent(weakest)+'. '+note;
  }
  const list=$('#motivation-actions');
  list.replaceChildren();
  for (const metric of gaps.slice(0,3)) {
    const li=document.createElement('li');
    const head=document.createElement('strong');
    head.textContent=metric.label+' · brakuje '+(-metric.delta);
    li.append(head,' — '+actionsByMetric[metric.index]);
    list.append(li);
  }
  const message=$('#motivation-message');
  message.textContent=!ranked.length?'Ustal z kierownikiem cele, żeby Lejek mógł wskazać priorytety.'
    :!gaps.length?'Dziś wszystkie mierzone obszary są na planie. Dobra robota — dopij kawę i utrzymaj tempo.'
    :gaps.length>3?'Zacznij od tych trzech. Pozostałe braki widać w zestawieniu powyżej.':'Zacznij od pierwszego punktu i odhaczaj kolejne.';
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

let giphyRequest;
async function giphyResults(config,assignedId) {
  const params=new URLSearchParams({api_key:config.key,rating:'g'});
  if (!assignedId) params.set('limit','50');
  const endpoint=assignedId?encodeURIComponent(assignedId):'trending';
  const response=await fetch('https://api.giphy.com/v1/gifs/'+endpoint+'?'+params,{
    cache:'no-store',signal:AbortSignal.timeout(6500)
  });
  if (!response.ok) throw new Error('GIF niedostępny.');
  const {data}=await response.json();
  return (assignedId?[data]:data??[]).filter(item=>{
    const media=item?.images?.fixed_width?.url;
    const url=URL.canParse(media??'')?new URL(media):null;
    return typeof item?.id==='string'&&url?.protocol==='https:'&&url.hostname.endsWith('.giphy.com');
  });
}

async function dailyGif(config,readOnly) {
  let items=await giphyResults(config,config.id);
  if (!config.id&&!readOnly&&items.length) {
    const {id}=await api('/api/giphy-assign',{ids:items.map(item=>item.id)});
    if (!id) return null;
    if (!items.some(item=>item.id===id)) items=await giphyResults(config,id);
    return items.find(item=>item.id===id)??null;
  }
  return items[0]??null;
}

function renderGif(config,readOnly) {
  const card=$('#giphy-card');
  const icon=$('#meme-icon');
  const caption=$('#meme-caption');
  card.hidden=true;
  $('#meme-like').hidden=!data.meme;
  icon.hidden=false;
  caption.hidden=false;
  if (!config||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const request=giphyRequest??=dailyGif(config,readOnly).catch(()=>null);
  request.then(item=>{
    if (!item||$('#meme').hidden||request!==giphyRequest) return;
    const image=$('#giphy-image');
    image.onload=()=>{
      if (request!==giphyRequest||$('#meme').hidden) return;
      $('#meme-title').hidden=true;
      icon.hidden=true;
      caption.hidden=true;
      $('#meme-like').hidden=true;
      card.hidden=false;
    };
    image.onerror=()=>{card.hidden=true;};
    image.alt=item.content_description||item.title||'GIF dnia';
    image.src=item.images.fixed_width.url;
  });
}

const sourceSelect=$('#entry-source');
function showEntrySource(index) {
  sourceSelect.value=String(index);
  for (const row of $('#rows').rows) row.classList.toggle('active-source',Number(row.dataset.source)===index);
  $('#entry-prev').disabled=index===0;
  $('#entry-next').disabled=index===sources.length-1;
  $('#entry-count').textContent=(index+1)+' z '+sources.length;
}

function updateSourceStatuses() {
  for (const [index,row] of Array.from($('#rows').rows).entries()) {
    const inputs=Array.from(row.querySelectorAll('input'));
    const hasResults=inputs.some(input=>Number(input.value)>0);
    sourceSelect.options[index].textContent=sources[index]+(hasResults?' — wpisano wyniki':'');
  }
}

sourceSelect.onchange=()=>showEntrySource(Number(sourceSelect.value));
$('#entry-prev').onclick=()=>showEntrySource(Number(sourceSelect.value)-1);
$('#entry-next').onclick=()=>showEntrySource(Number(sourceSelect.value)+1);
$('#rows').addEventListener('input',updateSourceStatuses);
$('#entry').addEventListener('invalid',event=>{
  const row=event.target.closest('[data-source]');
  if (!row||!matchMedia('(max-width:1050px)').matches) return;
  const firstInvalid=$('#rows input:invalid');
  if (event.target===firstInvalid) showEntrySource(Number(row.dataset.source));
},true);

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
  const lesson=data.lesson;
  $('#lesson-title').textContent=lesson?.title??'Lekcje w przygotowaniu';
  $('#lesson-topic').textContent=lesson?.topic??'Kierownik salonu może opublikować tutaj krótkie lekcje ze standardów obsługi.';
  $('#lesson-remember').hidden=!lesson;
  $('#lesson-remember span').textContent=lesson?.remember??'';
  renderPlans(records);
  const ranking=data.ranking;
  const rankText=rank=>rank.place+'. miejsce (z '+rank.total+')';
  $('#seller-ranking').textContent=ranking
    ?'Ranking miesiąca · Salon: '+rankText(ranking.salon)+(ranking.group?' · Grupa: '+rankText(ranking.group):'')+' · Realizacja: '+new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(ranking.percent)+'%'
    :'';
  $('#entry-date').textContent=dateLabel(day);
  $('#backlog').hidden=!next;
  $('#backlog-text').textContent=next?personal.missing.length+' do rozliczenia · '+dateLabel(next)+(waiting?' · Czeka na zatwierdzenie':''):'';
  $('#resolve').hidden=!next||day===next||waiting;
  for (const button of document.querySelectorAll('[data-kind]')) button.hidden=!next||day!==next||waiting;
  $('#reason').hidden=true;
  $('#save').disabled=readOnly||busy||Boolean(blocked)||locked;
  const matrix=records[day]?.[5];
  const legacy=records[day]&&!matrix;
  $('#columns').innerHTML='<tr><th scope="col">Źródło</th>'+columns.map(([,name])=>'<th scope="col">'+name+'</th>').join('')+'</tr>';
  const previousSource=$('#entry-grid').dataset.day===day?Number(sourceSelect.value):0;
  $('#entry-grid').dataset.day=day;
  $('#rows').innerHTML=legacy?'':sources.map((name,r)=>'<tr data-source="'+r+'"><th scope="row">'+name+'</th>'+columns.map(([c,label])=>
    '<td><span class="entry-field-label" aria-hidden="true">'+label+'</span><input type="number" min="0" max="1000000" step="1" inputmode="numeric" aria-label="'+name+' – '+label+'" name="v'+r+'_'+c+'" value="'+(matrix?.[r]?.[c]??'')+'"'+(locked||readOnly?' disabled':'')+'></td>').join('')+'</tr>').join('');
  $('#mobile-entry').hidden=Boolean(legacy);
  $('#entry-navigation').hidden=Boolean(legacy);
  $('#entry-grid').hidden=Boolean(legacy);
  if (!legacy) {
    sourceSelect.replaceChildren(...sources.map((name,i)=>new Option(name,String(i))));
    showEntrySource(previousSource);
    updateSourceStatuses();
  }
  $('#status').textContent=readOnly?'Podgląd · zapis dostępny na koncie handlowca.':legacy?'Dzień zapisano wcześniej w formacie sumarycznym.':locked?'Dzień rozliczony.':blocked?'Najpierw rozlicz zaległość.':'';
  const showMeme=data.sidebarMode==='meme';
  $('#cause').hidden=showMeme;
  $('#meme').hidden=!showMeme;
  $('#meme-actions').hidden=readOnly;
  $('#meme-like').hidden=!data.meme;
  $('#meme-like').disabled=Boolean(data.memeLiked);
  $('#meme-like').textContent=data.memeLiked?'Rozbawiło mnie ✓':'Rozbawiło mnie';
  if (showMeme) {
    const [title,icon,caption]=data.meme??['Na dziś wszystkie memy są rozdane.', '🙂', 'Zajrzyj jutro po kolejną scenkę z salonu.'];
    $('#meme-title').hidden=false;
    $('#meme-title').textContent=title;
    $('#meme-icon').textContent=icon;
    $('#meme-caption').textContent=caption;
    renderGif(data.giphy,readOnly);
  }
  $('#cause-title').textContent=cause?.title??'Cel w przygotowaniu';
  $('#cause-org').textContent=cause?.organization??'';
  $('#cause-description').textContent=cause?.description??'Organizacja i opis pojawią się po opublikowaniu celu.';
  const [done,expected]=personal.progress;
  $('#progress-text').textContent=done+' z '+expected+' dni pracy rozliczonych do dziś';
  $('#progress').max=expected||1;
  $('#progress').value=done;
  $('#fortune').textContent=records[data.today]?fortunes[dayIndex%fortunes.length]:'Otworzy się po zapisaniu dzisiejszych wyników.';
  selectSellerTab();
  $('#daily').hidden=false;
}

function renderSalonSummary() {
  const month=data.today.slice(0,7);
  const results=$('#salon-results');
  results.replaceChildren();
  const pct=(orders,target)=>new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(100*orders/target)+'%';
  const describe=(orders,target)=>target>0?orders+' / '+target+' · '+pct(orders,target):orders+' zam. · Brak planu';
  const targets=new Map(data.plans.filter(plan=>plan.month===month).map(plan=>[plan.person,plan.target]));
  const ordersBySeller=new Map();
  for (const result of data.daily) {
    if (!result.day.startsWith(month)||result.day>data.today) continue;
    ordersBySeller.set(result.person,(ordersBySeller.get(result.person)??0)+(JSON.parse(result.counters)[4]??0));
  }
  for (const {salon} of data.salons) {
    const team=data.sellers.filter(seller=>seller.salon===salon);
    const planned=team.filter(seller=>(targets.get(seller.id)??0)>0);
    const total=planned.reduce((sum,seller)=>sum+targets.get(seller.id),0);
    const orders=planned.reduce((sum,seller)=>sum+(ordersBySeller.get(seller.id)??0),0);
    const detail=document.createElement('details');
    const summary=document.createElement('summary');
    summary.textContent=salon+' · '+describe(orders,total)+' · '+planned.length+' z '+team.length+' osób z planem';
    detail.append(summary);
    const people=document.createElement('ul');
    for (const seller of team) {
      const item=document.createElement('li');
      item.textContent=seller.name+' · '+describe(ordersBySeller.get(seller.id)??0,targets.get(seller.id));
      people.append(item);
    }
    detail.append(people);
    results.append(detail);
  }
  if (!results.children.length) results.textContent='Brak przypisanych salonów.';
}

function selectManagementView() {
  const administration=location.hash==='#administracja';
  $('#performance-view').hidden=administration;
  $('#administration-view').hidden=!administration;
  $('#management-performance').setAttribute('aria-current',administration?'false':'page');
  $('#management-admin').setAttribute('aria-current',administration?'page':'false');
}
window.addEventListener('hashchange',selectManagementView);

function renderAdmin() {
  $('#dealer').textContent='Panel salonu';
  $('#admin').hidden=false;
  selectManagementView();
  $('#management-team-link').textContent=data.role==='group'?'Konta zespołu':'Konta zespołu i ustawienia planów';
  renderSalonSummary();
  $('#group-editor').hidden=data.role!=='admin';
  $('#group-list').textContent=data.groups.map(group=>group.name+' · '+(group.salons??'').replaceAll('\n',', ')+' · '+(group.heads??'').replaceAll('\n',', ')).join(' / ');
  $('#absence-panel').hidden=data.role==='group';
  $('#lesson-editor').hidden=data.role==='group';
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
  const lessonSalon=$('#lesson-salon');
  const selectedSalon=lessonSalon.value;
  const lessonSalons=data.role==='admin'?data.salons.map(({salon})=>salon):[data.salon];
  lessonSalon.replaceChildren(...lessonSalons.map(salon=>new Option(salon,salon)));
  if (lessonSalons.includes(selectedSalon)) lessonSalon.value=selectedSalon;
  $('#lesson-salon-label').hidden=data.role!=='admin';
  if (data.role==='admin') {
    const form=$('#brand');
    const selected=form.elements.salon.value;
    form.elements.salon.replaceChildren(...data.salons.map(({salon})=>new Option(salon,salon)));
    if (selected) form.elements.salon.value=selected;
    renderStoryQueue();
    $('#giphy-option').disabled=!data.giphyAvailable;
    $('#sidebar-settings').elements.mode.value=data.giphy?'giphy':data.sidebarMode;
    $('#charity').elements.month.value ||= data.today.slice(0,7);
  }
}
function renderStoryQueue() {
  const queue=$('#story-queue');
  queue.replaceChildren();
  if (!data.memeStories.length) queue.textContent='Brak nowych zgłoszeń.';
  for (const {id,title,caption} of data.memeStories) {
    const form=document.createElement('form');
    form.innerHTML='<label>Tytuł <input name="title" maxlength="120" required></label><label>Historia <textarea name="caption" maxlength="500" required></textarea></label><div><button>Zatwierdź</button> <button type="button" class="secondary">Odrzuć</button></div>';
    form.elements.title.value=title;
    form.elements.caption.value=caption;
    form.onsubmit=event=>{
      event.preventDefault();
      run(()=>api('/api/meme-review',{id,approve:true,...Object.fromEntries(new FormData(form))}));
    };
    form.querySelector('.secondary').onclick=()=>run(()=>api('/api/meme-review',{id,approve:false}));
    queue.append(form);
  }
}

function selectSellerTab() {
  const requested=location.hash.slice(1);
  const links=[...document.querySelectorAll('[data-seller-tab]')];
  const active=links.some(link=>link.dataset.sellerTab===requested)?requested:'dzisiaj';
  for (const link of links) {
    if (link.dataset.sellerTab===active) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  for (const panel of document.querySelectorAll('[data-seller-panel]')) {
    panel.hidden=panel.dataset.sellerPanel!==active;
  }
}
window.addEventListener('hashchange',()=>{
  if ($('#daily').hidden) return;
  selectSellerTab();
  window.scrollTo(0,0);
});

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
    ranking:{salon:{place:3,total:8},group:{place:7,total:24},percent:0},
    reviewPlans:[{month:actual.today.slice(0,7),target:5}],daily:[],personal:{missing:[],exceptions:{},progress:[0,0]},
    sidebarMode:actual.sidebarMode,cause:actual.cause,meme:actual.meme,giphy:actual.giphy,
    lesson:{title:'Pierwszy kontakt',topic:'Przywitaj klienta, przedstaw się i zapytaj, czego potrzebuje.',remember:'Najpierw wysłuchaj, potem zaproponuj rozwiązanie.'}};
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
$('#resolve').onclick=()=>{editDay=data.personal.missing[0];renderSeller();$('#rows .active-source input')?.focus();};
$('#entry').onsubmit=event=>{
  event.preventDefault();
  if(data.role!=='seller') return;
  const day=editDay??data.today;
  const rows=sources.map((_,r)=>{
    const row=Array(11).fill(0);
    for (const [index] of columns) row[index]=Number(event.target.elements['v'+r+'_'+index].value);
    return row;
  });
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
$('#meme-like').onclick=async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  try {
    await api('/api/meme-like',{});
    data.memeLiked=true;
    button.textContent='Rozbawiło mnie ✓';
  } catch(error) {
    $('#meme-status').textContent=error.message;
    button.disabled=false;
  }
};
$('#meme-suggest').onclick=event=>{
  const form=$('#meme-form');
  form.hidden=!form.hidden;
  event.currentTarget.setAttribute('aria-expanded',String(!form.hidden));
  if (!form.hidden) form.elements.title.focus();
};
$('#meme-form').onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const submit=form.querySelector('button');
  submit.disabled=true;
  try {
    await api('/api/meme-story',Object.fromEntries(new FormData(form)));
    form.reset();
    form.hidden=true;
    $('#meme-suggest').setAttribute('aria-expanded','false');
    $('#meme-status').textContent='Dzięki! Historia czeka na decyzję administratora.';
  } catch(error) {
    $('#meme-status').textContent=error.message;
  } finally {
    submit.disabled=false;
  }
};
$('#group-editor').onsubmit=event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(event.target));
  run(()=>api('/api/group',{name:values.name,headEmail:values.headEmail,salons:values.salons.split(/\r?\n/).map(line=>line.trim()).filter(Boolean)}));
};
const lessonEditor=$('#lesson-editor');
const lessonDraftList=$('#lesson-drafts');
let lessonBusy=false;
function updateLessonButtons() {
  const total=lessonDraftList.children.length;
  $('#lesson-publish').disabled=lessonBusy||total===0;
  $('#lesson-add').disabled=lessonBusy||total>=40;
  $('#lesson-import').disabled=lessonBusy;
}
function appendLesson({title='',topic='',remember=''}={}) {
  const field=document.createElement('fieldset');
  field.innerHTML='<legend>Lekcja</legend><label>Tytuł <input data-lesson="title" maxlength="120" required></label><label>Zagadnienie <textarea data-lesson="topic" maxlength="650" rows="3" required></textarea></label><label>Zapamiętaj! <textarea data-lesson="remember" maxlength="220" rows="2" required></textarea></label><button type="button" class="secondary">Usuń szkic</button>';
  for (const [key,value] of Object.entries({title,topic,remember})) field.querySelector('[data-lesson="'+key+'"]').value=value;
  field.querySelector('button').onclick=()=>{field.remove();updateLessonButtons();};
  lessonDraftList.append(field);
  updateLessonButtons();
}
$('#lesson-add').onclick=()=>appendLesson();
$('#lesson-import').onclick=async ()=>{
  const file=$('#lesson-file').files[0];
  const status=$('#lesson-status');
  if (!file||file.size>15*1024*1024) {status.textContent='Wybierz plik do 15 MB.';return;}
  lessonBusy=true;
  updateLessonButtons();
  status.textContent='Odczytuję plik…';
  try {
    const encoded=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',')[1]);
      reader.onerror=()=>reject(new Error('Nie udało się otworzyć pliku.'));
      reader.readAsDataURL(file);
    });
    const result=await api('/api/lesson-import',{salon:$('#lesson-salon').value,filename:file.name,file:encoded});
    lessonDraftList.replaceChildren();
    for (const lesson of result.lessons) appendLesson(lesson);
    status.textContent='Przygotowano '+result.lessons.length+' szkiców. Sprawdź i uzupełnij podsumowania przed publikacją.';
  } catch(error) {status.textContent=error.message;}
  finally {lessonBusy=false;updateLessonButtons();}
};
lessonEditor.onsubmit=async event=>{
  event.preventDefault();
  const status=$('#lesson-status');
  const lessons=Array.from(lessonDraftList.children,field=>Object.fromEntries(Array.from(field.querySelectorAll('[data-lesson]'),input=>[input.dataset.lesson,input.value.trim()])));
  lessonBusy=true;
  updateLessonButtons();
  try {
    await api('/api/lessons',{salon:$('#lesson-salon').value,lessons});
    status.textContent='Opublikowano serię. Pierwsza lekcja jest już widoczna w salonie.';
  } catch(error) {status.textContent=error.message;}
  finally {lessonBusy=false;updateLessonButtons();}
};
$('#sidebar-settings').onsubmit=event=>{
  event.preventDefault();
  giphyRequest=undefined;
  run(()=>api('/api/sidebar',{mode:event.target.elements.mode.value}));
};
$('#charity').onsubmit=event=>{
  event.preventDefault();
  const form=event.target;
  run(()=>api('/api/cause',Object.fromEntries(new FormData(form))));
};
refresh().catch(error=>{$('#load').textContent=error.message;});
