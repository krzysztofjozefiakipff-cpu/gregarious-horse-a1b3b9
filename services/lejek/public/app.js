const get = id => document.getElementById(id);
let people = [], salons = [], accounts = [];
const sources = ['WALK','Facebook','WWW','Karta kontaktu','OTOMOTO','Polecenia','Baza retencyjna','Importerskie','VEHIS i inne portale','Serwis','Galerie','Targi'];
const fields = ['Leady','Skuteczne kontakty','Kwalifikacja','Oferty','Negocjacje','Sprzedaż','Umówione wizyty','Odbyte umówione wizyty','Jazdy próbne','Klienci z follow-upem','Interakcje follow-up'];
const extras = [
  'Leady online z pomiarem czasu reakcji','Pierwsza reakcja do 15 min',
  'Odbyte wizyty, na których wykonano jazdę','Klienci po jeździe objęci pomiarem konwersji','Zamówienia w tej grupie po jeździe',
  'Wydane auta','Opinie Google po wydaniu','Pozyskane polecenia po wydaniu',
  'Klienci z terminem serwisu w okresie','Powroty do ASO w tej grupie',
  'Klienci kwalifikujący się do wymiany','Wymiany w tej grupie',
  'Odpowiedzi NPS','Promotorzy (9–10)','Krytycy (0–6)'
];
const empty = () => fields.map(() => 0);
let entries = {}, plans = {}, reviewPlans = {};
const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const planFor = (person,month) => plans[month+'/'+people[person].id] ?? null;
function record(person,source,month=get('month').value) {
  return entries[[month,people[person].id,source].join('/')] ?? empty();
}
const escape = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function api(path,body) {
  const response=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error);
  return data;
}
let revision=0;
let firstView=true;
async function refresh() {
  const latest=++revision;
  const month=get('month').value;
  get('status').textContent='Wczytywanie danych…';
  get('dashboard').hidden=true;
  if(!month) {get('status').textContent='Wybierz miesiąc.';return;}
  try {
    const data=await api('/api/state?month='+encodeURIComponent(month));
    if(latest!==revision) return;
    const prior=get('seller').value?people[+get('seller').value]?.id:null;
    people=data.sellers;
    salons=[...new Set(people.map(p=>p.salon))];
    accounts=data.accounts;
    entries=Object.fromEntries(data.results.map(r=>[[r.month,r.person,r.source].join('/'),JSON.parse(r.counters)]));
    plans=Object.fromEntries(data.plans.map(r=>[r.month+'/'+r.person,r.target]));
    reviewPlans=Object.fromEntries(data.reviewPlans.map(r=>[r.month+'/'+r.person,r.target]));
    get('role').value=data.role;
    get('roleLabel').textContent=get('role').selectedOptions[0].textContent;
    get('accountPanel').hidden=data.role!=='admin';
    document.querySelectorAll('nav button').forEach(button=>{button.hidden=data.role==='seller'&&button.dataset.tab!=='journey';});
    get('accountTable').innerHTML=table(['Imię i nazwisko','E-mail','Salon','Rola'],accounts.map(a=>[escape(a.name),escape(a.email),escape(a.salon),{admin:'Administrator',manager:'Kierownik',seller:'Handlowiec'}[a.role]]));
    updateFilters(prior);
    if(firstView && data.role==='seller') { location.replace('/daily.html'); return; }
    firstView=false;
    get('dashboard').hidden=false;
    get('status').textContent=people.length?'':'Brak przypisanych handlowców.';
  } catch(error) {
    if(latest===revision) get('status').textContent=error.message;
  }
}
const sum = rows => rows.reduce((total, row) => total.map((v,i) => v+row[i]),empty());
const nf = new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1});
const pct = (a,b) => b ? nf.format(100*a/b)+'%' : '—';
const table = (head,rows) => '<table><thead><tr>'+head.map(v=>'<th scope="col">'+v+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const options = (el,rows) => {el.replaceChildren(...rows.map(([value,label])=>new Option(label,value)));};
function available() {
  const role=get('role').value;
  return people.map((_,i)=>i).filter(i => role==='seller' ? i===0 : (!get('salon').value || people[i].salon===get('salon').value));
}
function updateFilters(priorPerson=undefined) {
  const role=get('role').value;
  const prior=get('salon').value;
  options(get('salon'),role==='admin' ? [['','Wszystkie salony'],...salons.map(s=>[s,s])] : [[salons[0] ?? '',salons[0] ?? '—']]);
  if(role==='admin' && salons.includes(prior)) get('salon').value=prior;
  get('salon').disabled=role!=='admin';
  const selected=priorPerson===undefined?get('seller').value:String(people.findIndex(p=>p.id===priorPerson));
  options(get('seller'),[...(role==='seller'?[]:[['','Wszyscy handlowcy']]),...available().map(i=>[i,people[i].name])]);
  if(available().some(i=>String(i)===selected)) get('seller').value=selected;
  get('seller').disabled=role==='seller';
  render();
}
function render() {
  const scope = available().filter(i=>!get('seller').value || String(i)===get('seller').value);
  const bySource=sources.map((_,s)=>sum(scope.map(i=>record(i,s))));
  const total=sum(bySource);
  get('edit').disabled=!scope.length;
  renderJourney(scope,bySource,total);
  const report=renderQuarter(scope);
  const current=report.find(row=>row.month===get('month').value);
  const plan=current?.target ?? null;
  renderWorkbookPace(scope,bySource,current);
  renderInlineSheet(scope,bySource);
  const summaries=[['Leady',total[0],'Unikalne szanse sprzedażowe'],['Skuteczne kontakty',total[1],pct(total[1],total[0])+' leadów'],['Sprzedaż',total[5],plan!==null ? 'Cel po korekcie: '+plan+' aut':'Brak ustalonego celu po korekcie'],['Wykonanie planu',pct(total[5],plan),'Konwersja lead → sprzedaż: '+pct(total[5],total[0])]];
  get('cards').innerHTML=summaries.map(([label,value,detail])=>'<article class="card"><small>'+label+'</small><strong>'+value+'</strong><small>'+detail+'</small></article>').join('');
  get('monthlyPace').innerHTML='<div class="row"><strong>Tempo miesiąca</strong><span>'+
    (current?.expected==null?'Uzupełnij cele i rozliczenia poprzednich miesięcy.':
      display(current.sold)+' sprzedanych / '+display(current.expected)+' według tempa · '+pct(current.progress,1)+' miesiąca')+'</span></div>';
  get('salonPanel').hidden=get('role').value!=='admin';
  get('salonTable').innerHTML=table(['Salon','Leady','Sprzedaż','Lead → sprzedaż','Cel bazowy'],salons.filter(s=>scope.some(i=>people[i].salon===s)).map(s=>{
    const team=scope.filter(i=>people[i].salon===s);
    const figures=sum(team.flatMap(i=>sources.map((_,source)=>record(i,source))));
    return [escape(s),figures[0],figures[5],pct(figures[5],figures[0]),display(sumKnown(team.map(i=>planFor(i,get('month').value))))];
  }));
  get('funnel').innerHTML=fields.slice(0,6).map((label,i)=>'<div class="row"><span>'+label+'</span><strong>'+total[i]+'</strong></div><div class="bar"><span style="width:'+(total[0]?Math.min(100,total[i]/total[0]*100):0)+'%"></span></div>').join('');
  const activity=[...fields.slice(6).map((label,i)=>[label,total[i+6]]),['Skuteczność umawiania',pct(total[6],total[1])],['Frekwencja wizyt',pct(total[7],total[6])]];
  get('activities').innerHTML=activity.map(([label,v])=>'<div class="row metric"><span>'+label+'</span><strong>'+v+'</strong></div>').join('');
  get('teamPanel').hidden=get('role').value==='seller';
  get('team').innerHTML=table(['Handlowiec','Salon','Leady','Sprzedaż','Lead → sprzedaż','Cel bazowy'],scope.map(i=>{
    const row=sum(sources.map((_,s)=>record(i,s)));
    return [escape(people[i].name),escape(people[i].salon),row[0],row[5],pct(row[5],row[0]),planFor(i,get('month').value) ?? '—'];
  }));
  get('sourceTable').innerHTML=table(['Źródło','Leady','Kontakty','Kontakt / lead','Umówione','Odbyte','Frekwencja','Jazdy','Oferty','Sprzedaż','Sprzedaż / lead'],bySource.map((r,i)=>[sources[i],r[0],r[1],pct(r[1],r[0]),r[6],r[7],pct(r[7],r[6]),r[8],r[3],r[5],pct(r[5],r[0])]));
}
const workbookSteps=[
  ['Leady','Pozyskaj i zarejestruj nowe szanse z kanałów wskazanych poniżej.'],
  ['Kontakty','Wróć do leadów bez skutecznej rozmowy i ponów kontakt.'],
  ['Umówione wizyty','Zaproponuj konkretne daty i godziny zakwalifikowanym klientom.'],
  ['Odbyte wizyty','Potwierdź najbliższe spotkania i umów nowy termin klientom, którzy nie przyszli.'],
  ['Jazdy próbne','Zarezerwuj auto demonstracyjne i zaproponuj jazdę klientom rozważającym zakup.'],
  ['Oferty','Wyślij konkretną ofertę klientom po rozmowie o potrzebach i finansowaniu.'],
  ['Follow-up','Skontaktuj się z klientami po wysłaniu oferty i ustal kolejny krok.'],
  ['Zamówienia','Zacznij od otwartych ofert z najbliższym terminem decyzji i uzgodnij podpisanie zamówienia.']
];
const workbookOrder=[0,1,6,7,8,3,9,5];
function renderWorkbookPace(scope,actual,current) {
  const month=get('month').value;
  const months=quarterMonths(month);
  const date=today();
  const rows=scope.map(person=>quarterReport(months,date,months.map(m=>planFor(person,m)),
    months.map(m=>sum(sources.map((_,source)=>record(person,source,m)))[5])).find(r=>r.month===month));
  const configured=rows.length>0&&rows.every(r=>r?.target!=null);
  const targets=configured?scope.map((person,i)=>sourceTargets(rows[i].target,people[person].name)):null;
  const perSource=sources.map((_,i)=>workbookSteps.map((_,j)=>targets?.reduce((n,t)=>n+t[i][j],0)??null));
  const progress=current?.progress??0;
  const counts=workbookOrder.map(k=>actual.reduce((n,r)=>n+r[k],0));
  const metrics=workbookSteps.map(([label,action],i)=>{
    const target=configured?perSource.reduce((n,r)=>n+r[i],0):null;
    const expected=target===null?null:target*progress;
    const value=counts[i];
    const diff=expected===null?0:value-expected;
    const tone=expected===null||!progress||Math.abs(diff)<1e-9?'':diff<0?'red':'green';
    return {label,action,target,expected,value,tone,deficit:diff<0?Math.ceil(-diff-1e-9):0,remaining:target===null?null:Math.max(0,target-value),i};
  });
  const sales=metrics.at(-1);
  const pace=sales.expected===null||!progress?'':' · Na dziś: '+display(sales.expected);
  get('workbookHero').innerHTML='<h3>Zamówienia w tym miesiącu</h3><strong>'+sales.value+' / '+display(sales.target)+'</strong>'+
    '<p>'+(sales.remaining===null?'Brak ustalonego celu':sales.remaining===0?'Plan wykonany':'Do planu brakuje: '+sales.remaining)+pace+'</p>';
  get('workbookStages').innerHTML=table(['Etap','Wynik','Na dziś','Brak do planu'],metrics.map(m=>{
    const arrow=m.tone==='red'?'↓ ':m.tone==='green'?'↑ ':'';
    const label=m.tone==='red'?'Poniżej tempa':m.tone==='green'?'Powyżej tempa':progress?'Zgodnie z tempem':'';
    return [m.label,'<span class="status-cell '+(m.tone==='red'?'behind':m.tone==='green'?'ahead':'neutral')+'">'+
      (m.expected===null?'':arrow)+'<span class="sr-only">'+(m.expected===null?'':label+' · ')+'</span>'+m.value+'</span>',
      display(m.expected),display(m.remaining)];
  }));
  const priorities=metrics.filter(m=>m.deficit>0).sort((a,b)=>b.deficit/(b.expected||1)-a.deficit/(a.expected||1)).slice(0,2);
  const channel=m=>sources.map((name,i)=>[name,Math.ceil(perSource[i][m.i]*progress-actual[i][workbookOrder[m.i]]-1e-9)])
    .filter(([,gap])=>gap>0).sort((a,b)=>b[1]-a[1])[0]?.[0];
  get('workbookActions').innerHTML=!configured?'<p>Cele ustawia kierownik lub administrator.</p>':
    !progress?'<p>Ocena tempa rozpocznie się pierwszego dnia miesiąca.</p>':
    priorities.length?'<ol>'+priorities.map(m=>'<li><strong>'+m.label+' · '+m.deficit+' do tempa'+
      (channel(m)?' · zacznij od: '+channel(m):'')+'</strong><br>'+m.action+'</li>').join('')+'</ol>':
    '<p>Wyniki są zgodne z tempem lub powyżej.</p>';
  get('workbookSources').innerHTML=table(['Źródło',...workbookSteps.map(([label])=>label)],sources.map((name,i)=>[name,...workbookOrder.map((id,j)=>{
    const value=actual[i][id], goal=perSource[i][j];
    return goal===null?value+' / —':'<span class="'+(progress&&value+1e-9<goal*progress?'source-gap':progress&&value>goal*progress+1e-9?'ahead':'')+'">'+value+' / '+goal+'</span>';
  })]));
}
const sheetOrder=[0,1,6,7,8,3,9,5];
const sheetRates=[[1,0],[7,6],[5,0]];
function drawSheetRates() {
  const table=get('inlineSheet');
  const rows=[...table.querySelectorAll('tbody tr')].map(row=>{
    const values=empty();
    row.querySelectorAll('input').forEach(input=>{values[+input.dataset.field]=input.valueAsNumber||0;});
    return values;
  });
  rows.forEach((values,i)=>sheetRates.forEach(([a,b],j)=>table.querySelector('#sheet-rate-'+i+'-'+j).textContent=pct(values[a],values[b])));
  const totals=sum(rows);
  sheetOrder.forEach(k=>table.querySelector('#sheet-total-'+k).textContent=totals[k]);
  sheetRates.forEach(([a,b],j)=>table.querySelector('#sheet-total-rate-'+j).textContent=pct(totals[a],totals[b]));
}
function renderInlineSheet(scope,bySource) {
  const editable=scope.length===1;
  get('sheetSave').hidden=!editable;
  get('sheetStatus').textContent='';
  get('sheetHint').textContent=editable?'Wpisz wyniki w tabeli. Konwersje przeliczą się od razu.':'Wybierz jednego handlowca, aby wpisać wyniki.';
  const labels=['Leady','Kontakty','Umówione','Odbyte','Jazdy','Oferty','Follow-up','Zamówienia'];
  const rates=['Kontakt / lead','Odbyte / umówione','Sprzedaż / lead'];
  const head='<thead><tr><th scope="col">Źródło</th>'+[...labels,...rates].map(label=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead>';
  const body=bySource.map((row,i)=>'<tr><th scope="row">'+sources[i]+'</th>'+sheetOrder.map((k,j)=>
    '<td>'+(editable?'<input type="number" min="0" max="1000000" step="1" required data-field="'+k+'" data-source="'+i+'" aria-label="'+sources[i]+' – '+labels[j]+'" value="'+row[k]+'">':row[k])+'</td>').join('')+
    sheetRates.map(([a,b],j)=>'<td id="sheet-rate-'+i+'-'+j+'">'+pct(row[a],row[b])+'</td>').join('')+'</tr>').join('');
  const totals=sum(bySource);
  const foot='<tfoot><tr><th scope="row">Razem</th>'+sheetOrder.map(k=>'<td id="sheet-total-'+k+'">'+totals[k]+'</td>').join('')+
    sheetRates.map(([a,b],j)=>'<td id="sheet-total-rate-'+j+'">'+pct(totals[a],totals[b])+'</td>').join('')+'</tr></tfoot>';
  get('inlineSheet').innerHTML='<table>'+head+'<tbody>'+body+'</tbody>'+foot+'</table>';
  get('sheetForm').oninput=drawSheetRates;
  get('sheetForm').onsubmit=async event=>{
    event.preventDefault();
    if(!editable) return;
    const person=scope[0],month=get('month').value;
    const records=bySource.map((_,source)=>{
      const old=record(person,source);
      const row=old.slice();
      get('inlineSheet').querySelectorAll('input[data-source="'+source+'"]').forEach(input=>{row[+input.dataset.field]=input.valueAsNumber;});
      return {source,row,changed:sheetOrder.some(k=>row[k]!==old[k])};
    }).filter(r=>r.changed).map(({source,row})=>({source,row}));
    if(!records.length) {get('sheetStatus').textContent='Brak zmian.';return;}
    get('sheetSave').disabled=true;
    try {
      await api('/api/results-table',{person:people[person].id,month,records});
      if(get('month').value===month) {await refresh();get('sheetStatus').textContent='Zapisano wyniki.';}
    } catch(error) {get('sheetStatus').textContent=error.message;}
    finally {get('sheetSave').disabled=false;}
  };
}
function renderJourney(scope,bySource,total) {
  get('journeyEdit').disabled=!scope.length;
  get('journeyScope').textContent=scope.length===1 ? people[scope[0]].name : scope.length ? 'Podsumowanie wybranego zespołu' : 'Brak handlowców w wybranym zakresie';
  const records=scope.flatMap(person=>sources.map((_,source)=>record(person,source)));
  const tracked=records.filter(row=>Array.isArray(row[11]));
  const measure=index=>{
    const values=tracked.map(row=>row[11][index]).filter(Number.isInteger);
    return values.length ? values.reduce((a,b)=>a+b,0) : null;
  };
  const rate=(num,den)=>measure(num)!==null ? pct(measure(num),measure(den)) : '—';
  const measuredVisits=tracked.filter(row=>Number.isInteger(row[11][2])).reduce((n,row)=>n+row[7],0);
  const nps=measure(12)>0 && measure(13)!==null && measure(14)!==null ? nf.format(100*(measure(13)-measure(14))/measure(12)) : '—';
  const stages=[
    ['TOFU','Pozyskanie',[
      'Zapisz unikalny lead i jego pierwsze źródło. Klienta z internetu zachowaj pod tym samym źródłem po wizycie w salonie.',
      'Zanotuj model lub egzemplarz, którym interesuje się klient. Zaproponuj kalkulację raty, wycenę odkupu lub wideo auta.'
    ],[['Wszystkie źródła',total[0]],['Źródła online', [1,2,4,7,8].reduce((total,i)=>total+bySource[i][0],0)],['Walk-in',bySource[0][0]]]],
    ['MOFU','Kontakt i kwalifikacja',[
      'Podejmij pierwszą próbę kontaktu w ciągu 5–15 minut. Osobno odnotuj skuteczną rozmowę.',
      'Ustal budżet, sposób finansowania, termin zakupu i odkup. Zaproponuj termin wizyty lub uzgodnij termin kolejnego kontaktu.'
    ],[['Pierwsza reakcja do 15 min',rate(1,0)],['Skuteczny kontakt / lead',pct(total[1],total[0])],['Umówione wizyty / lead',pct(total[6],total[0])],['Frekwencja wizyt',pct(total[7],total[6])]]],
    ['BOFU','Wizyta, oferta i zamówienie',[
      'Dopasuj jazdę próbną do potrzeb klienta. Możesz przejść do oferty również przez telefon lub online.',
      'Przedstaw cenę auta, finansowanie, ubezpieczenie i odkup. Uzgodnij następny krok i zapisz podpisane zamówienie.'
    ],[['Wizyta → jazda w grupie mierzonej',pct(measure(2),measuredVisits)],['Jazda → zamówienie w grupie mierzonej',rate(4,3)],['Lead → zamówienie',pct(total[5],total[0])],['Zamówienia',total[5]]]],
    ['FLYWHEEL','Wydanie, serwis i kolejny zakup',[
      'Przy wydaniu auta omów serwis, poproś o opinię i zapytaj o polecenia.',
      'Zaplanuj kontakt około sześciu miesięcy przed końcem leasingu lub najmu. Zakwalifikowaną szansę wymiany rejestruj w bazie retencyjnej.'
    ],[['Wydane auta',display(measure(5))],['Opinie Google',display(measure(6))],['Polecenia',display(measure(7))],['Powrót do ASO',rate(9,8)],['Wymiana auta w salonie',rate(11,10)],['NPS',nps]]]
  ];
  get('journeyStages').innerHTML=stages.map(([phase,title,actions,metrics])=>
    '<article class="panel journey-card"><div class="eyebrow">'+phase+'</div><h2>'+title+
    '</h2><ol>'+actions.map(action=>'<li>'+action+'</li>').join('')+'</ol>'+
    metrics.map(([label,value])=>'<div class="row metric"><span>'+label+'</span><strong>'+value+'</strong></div>').join('')+'</article>').join('');
}
const sumKnown = values => values.length && values.every(v=>v!==null) ? values.reduce((a,b)=>a+b,0) : null;
const display = value => value === null || value === undefined ? '—' : nf.format(value);
function renderQuarter(scope) {
  const months=quarterMonths(get('month').value);
  const date=today();
  const reports=scope.map(i=>quarterReport(months,date,months.map(m=>planFor(i,m)),
    months.map(m=>sum(sources.map((_,s)=>record(i,s,m)))[5])));
  const report=months.map((month,index)=>{
    const rows=reports.map(r=>r[index]);
    const aggregate=field=>sumKnown(rows.map(r=>r[field]));
    return {month,base:aggregate('base'),carry:aggregate('carry'),target:aggregate('target'),
      sold:aggregate('sold'),expected:aggregate('expected'),remaining:aggregate('remaining'),progress:monthProgress(month,date)};
  });
  const base=sumKnown(report.map(r=>r.base));
  const sold=sumKnown(report.map(r=>r.sold));
  const scheduled=sumKnown(report.map(r=>r.base===null?null:r.base*r.progress));
  const elapsed=months.length ? Math.round(100*months.reduce((v,m)=>{
    const [y,n]=m.split('-').map(Number);
    const days=new Date(Date.UTC(y,n,0)).getUTCDate();
    return v+days*monthProgress(m,date);
  },0)/months.reduce((v,m)=>{const [y,n]=m.split('-').map(Number);return v+new Date(Date.UTC(y,n,0)).getUTCDate();},0)) : null;
  const delta=(actual,expected)=>expected===null?'—':(actual-expected>0?'+':'')+nf.format(actual-expected);
  const selected=report.find(r=>r.month===get('month').value);
  const cards=[['Realizacja kwartału',pct(sold,base),display(sold)+' / '+display(base)+' aut'],
    ['Upływ kwartału',elapsed===null?'—':elapsed+'%','Dni kalendarzowe'],
    ['Plan kwartalny na dziś',display(scheduled),delta(sold,scheduled)+' aut względem tempa'],
    ['Cel miesiąca na dziś',display(selected?.expected),selected ? delta(selected.sold,selected.expected)+' aut względem tempa':'']];
  get('quarterCards').innerHTML=cards.map(([label,value,detail])=>'<article class="card"><small>'+label+'</small><strong>'+value+'</strong><small>'+detail+'</small></article>').join('');
  get('quarterNote').textContent=months.length ? 'Okres '+months[0]+' – '+months[2]+'. Stan na '+date+'.' : 'Wybierz miesiąc.';
  get('quarterTable').innerHTML=table(['Miesiąc','Cel bazowy','Do nadrobienia','Cel po korekcie','Sprzedano','Realizacja','Upływ miesiąca','Wg tempa','Różnica','Pozostało'],report.map(r=>[
    r.month,display(r.base),display(r.carry),display(r.target),display(r.sold),pct(r.sold,r.target),pct(r.progress,1),display(r.expected),
    r.expected===null?'—':'<span class="'+(r.sold>=r.expected?'ahead':'behind')+'">'+delta(r.sold,r.expected)+'</span>',display(r.remaining)
  ]));
  get('editPlan').hidden=get('role').value==='seller'||!months.length;
  get('editPlan').disabled=!scope.length;
  return report;
}
function loadPlanInputs() {
  const months=quarterMonths(get('month').value);
  get('planInputs').innerHTML=months.map((month,i)=>'<label>'+month+' · zamówienia<input id="goal'+i+'" type="number" min="0" max="1000000" step="1" required></label><label>'+month+' · opinie Google<input id="review-goal'+i+'" type="number" min="0" max="1000000" step="1"></label>').join('');
  const seller=+get('planPerson').value;
  months.forEach((m,i)=>{
    get('goal'+i).value=planFor(seller,m)??'';
    get('review-goal'+i).value=reviewPlans[m+'/'+people[seller].id]??'';
  });
  get('planError').textContent='';
}
get('editPlan').onclick=()=>{
  options(get('planPerson'),available().map(i=>[i,people[i].name]));
  if(get('seller').value) get('planPerson').value=get('seller').value;
  loadPlanInputs();
  get('planEditor').showModal();
};
get('planPerson').onchange=loadPlanInputs;
get('cancelPlan').onclick=()=>get('planEditor').close();
async function saveForm(event,path,payload,dialog,errorId) {
  event.preventDefault();
  const submit=event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled=true;
  get(errorId).textContent='';
  try {await api(path,payload);get(dialog).close();await refresh();}
  catch(error) {get(errorId).textContent=error.message;}
  finally {submit.disabled=false;}
}
get('planForm').onsubmit=event=>saveForm(event,'/api/plans',{
  month:get('month').value,person:people[+get('planPerson').value].id,
  targets:quarterMonths(get('month').value).map((_,i)=>get('goal'+i).valueAsNumber),
  reviewTargets:quarterMonths(get('month').value).map((_,i)=>get('review-goal'+i).value===''?null:get('review-goal'+i).valueAsNumber)
},'planEditor','planError');
get('addAccount').onclick=()=>{
  get('accountForm').reset();
  get('accountError').textContent='';
  get('accountEditor').showModal();
};
get('cancelAccount').onclick=()=>get('accountEditor').close();
get('accountForm').onsubmit=event=>saveForm(event,'/api/accounts',
  Object.fromEntries(new FormData(event.currentTarget)), 'accountEditor','accountError');
const benchmarks=benchmarksFromWorkbook.map(([contact,visit,drive,offer,follow,close],i)=>
  [sources[i],pct(contact,1),i===0?'—':pct(visit,1),pct(offer,1),pct(follow,1),pct(close,1)]);
get('bench').innerHTML=table(['Źródło','Kontakt / lead','Odbyte / kontakt','Oferta / kontakt','Follow-up / oferta','Zamówienie / lead'],benchmarks);
document.querySelectorAll('nav button').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('nav button').forEach(b=>{b.setAttribute('aria-selected',String(b===button));get(b.dataset.tab).hidden=b!==button && !(get('role').value==='seller' && button.dataset.tab==='journey' && b.dataset.tab==='plan');});
  get('heading').textContent=button.dataset.tab==='overview'?'Lejek sprzedaży':button.textContent;
}));
const calc=()=>{
  const target=get('target'), rate=get('rate');
  get('needed').textContent=target.value && rate.value && target.validity.valid && rate.validity.valid ? nf.format(Math.ceil(target.valueAsNumber*100/rate.valueAsNumber)) : '—';
};
['target','rate'].forEach(id=>get(id).addEventListener('input',calc));
get('inputs').innerHTML=fields.map((label,i)=>'<label>'+label+'<input id="value'+i+'" type="number" min="0" max="1000000" step="1" required></label>').join('');
get('extraInputs').innerHTML=extras.map((label,i)=>'<label>'+label+'<input id="extra'+i+'" type="number" min="0" max="1000000" step="1"></label>').join('');
function loadEntry() {
  const row=record(+get('entrySeller').value,+get('entrySource').value);
  fields.forEach((_,i)=>{get('value'+i).value=row[i];});
  extras.forEach((_,i)=>{get('extra'+i).value=row[11]?.[i] ?? '';});
  get('error').textContent='';
}
function openEntry(showExtras) {
  if(!get('month').value){get('month').reportValidity();return;}
  options(get('entrySeller'),available().map(i=>[i,people[i].name]));
  if(get('seller').value) get('entrySeller').value=get('seller').value;
  options(get('entrySource'),sources.map((s,i)=>[i,s]));
  loadEntry();
  get('journeyDetails').open=showExtras;
  get('editor').showModal();
}
get('edit').onclick=()=>openEntry(false);
get('journeyEdit').onclick=()=>openEntry(true);
get('entrySeller').onchange=loadEntry;
get('entrySource').onchange=loadEntry;
get('cancel').onclick=()=>get('editor').close();
get('entry').onsubmit=event=>saveForm(event,'/api/results',{
  month:get('month').value,person:people[+get('entrySeller').value].id,
  source:+get('entrySource').value,row:[...fields.map((_,i)=>get('value'+i).valueAsNumber),extras.map((_,i)=>get('extra'+i).value===''?null:get('extra'+i).valueAsNumber)]
},'editor','error');
get('salon').onchange=()=>updateFilters();
get('seller').onchange=render;
get('month').onchange=refresh;
get('month').value=today().slice(0,7);
refresh();
calc();
