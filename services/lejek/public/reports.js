const reportGet=selector=>document.querySelector(selector);
const reportForm=reportGet('#management-report-form');
const reportResults=reportGet('#management-report-results');
const reportStatus=reportGet('#management-report-status');
const reportPdfExport=reportGet('#export-management-report-pdf');
const reportExport=reportGet('#export-management-report');
const reportNumber=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1});
const reportPercent=new Intl.NumberFormat('pl-PL',{style:'percent',maximumFractionDigits:1});
let reportRevision=0;
let reportFilterRevision=0;
let reportCsv;

function reportElement(tag,label) {
  const node=document.createElement(tag);
  if (label!==undefined) node.textContent=label;
  return node;
}

function reportTable(headers,rows) {
  const table=document.createElement('table');
  const head=table.createTHead().insertRow();
  for (const label of headers) {
    const th=reportElement('th',label);
    th.scope='col';
    head.append(th);
  }
  const body=table.createTBody();
  for (const values of rows) {
    const row=body.insertRow();
    for (const value of values) row.insertCell().textContent=value;
  }
  const wrapper=document.createElement('div');
  wrapper.className='report-table';
  wrapper.tabIndex=0;
  wrapper.setAttribute('role','region');
  wrapper.setAttribute('aria-label',headers[0]);
  wrapper.append(table);
  return wrapper;
}

function showReportFields() {
  const {type,month,day,pdfSalon}=reportForm.elements;
  const daily=type.value==='daily';
  reportGet('#report-day-field').hidden=day.disabled=!daily;
  reportGet('#report-month-field').hidden=month.disabled=daily;
  reportGet('#report-showrooms').hidden=daily;
  reportGet('#report-pdf-salon-field').hidden=pdfSalon.disabled=!daily;
  reportPdfExport.textContent=daily?'Pobierz PDF salonu':'Pobierz PDF';
}

function renderReportPicker(snapshot) {
  const {type,month,day,pdfSalon}=reportForm.elements;
  month.max=snapshot.today.slice(0,7);
  day.max=snapshot.today;
  const firstOpen=!month.value;
  month.value ||= month.max;
  day.value ||= snapshot.today;
  const choices=reportGet('#report-showrooms > div');
  const salonNames=snapshot.salons.map(row=>row.salon);
  if (choices.dataset.salons!==JSON.stringify(salonNames)) {
    const previous=pdfSalon.value;
    pdfSalon.replaceChildren(new Option('Wybierz salon',''),...salonNames.map(salon=>new Option(salon,salon)));
    pdfSalon.value=salonNames.length===1?salonNames[0]:salonNames.includes(previous)?previous:'';
    choices.dataset.salons=JSON.stringify(salonNames);
    choices.replaceChildren(...salonNames.map(salon=>{
      const label=document.createElement('label');
      const checkbox=document.createElement('input');
      checkbox.type='checkbox';
      checkbox.checked=true;
      checkbox.name='salons';
      checkbox.value=salon;
      label.append(checkbox,salon);
      return label;
    }));
  }
  showReportFields();
  if (firstOpen) {
    reportPdfExport.disabled=false;
    if (type.value==='monthly') reportForm.requestSubmit();
  }
}

reportForm.onchange=event=>{
  const {type,month,pdfSalon}=reportForm.elements;
  if (event.target===pdfSalon) {
    reportFilterRevision++;
    return;
  }
  if (event.target===type&&type.value==='marketing'&&month.value===data.today.slice(0,7)) {
    const [year,number]=month.value.split('-').map(Number);
    month.value=monthStart(year,number-2).slice(0,7);
  }
  showReportFields();
  reportRevision++;
  reportFilterRevision++;
  reportCsv=null;
  reportExport.disabled=true;
  reportResults.replaceChildren();
  reportStatus.textContent='Wybierz „Pokaż raport”, aby zobaczyć wyniki dla nowych ustawień.';
};

function reportSelection() {
  const {type,month,day}=reportForm.elements;
  const query=new URLSearchParams({type:type.value,...(type.value==='daily'?{day:day.value}:{month:month.value})});
  const selected=new Set(new FormData(reportForm).getAll('salons'));
  return {query,selected};
}

function reportMetrics(actuals,targets,expected) {
  return columns.map(([,label],index)=>{
    const value=actuals[index];
    const target=targets[index];
    return [label,reportNumber.format(value),target==null?'—':reportNumber.format(target),
      target>0?reportPercent.format(value/target):'—',
      expected?.[index]==null?'—':reportNumber.format(expected[index])];
  });
}

function reportDailyChecks(check) {
  if (!check) return [];
  const dates=values=>values.map(day=>dateLabel(day)).join(', ')||'—';
  return [
    ['Rozliczenie dni pracy',check.started
      ?(check.approved+check.zero)+' z '+check.required+' · zatwierdzono '+check.approved+' · bez aktywności '+check.zero
      :'Ewidencja jeszcze nierozpoczęta'],
    ['Zapisy robocze',dates(check.drafts)],
    ['Zgłoszenia oczekujące',dates(check.pending)],
    ['Dni bez wpisu',dates(check.missing)]
  ];
}

const dailyReportSales=[6,7,8,9];

function dailySalesTable(salon) {
  const people=[{name:'Razem salon',actuals:salon.totals,targets:salon.targets,expected:salon.expected},...salon.people];
  const summary=reportTable(['Wynik / plan','Zamówienia','Faktury','Rejestracje','Opinie Google'],
    people.map(person=>[person.name+(person.archived?' · archiwum':''),...dailyReportSales.map(index=>{
      const target=person.targets[index];
      return reportNumber.format(person.actuals[index])+' / '+(target==null?'—':reportNumber.format(target));
    })]));
  summary.classList.add('daily-sales-report');
  for (const [row,person] of people.entries()) {
    for (const [column,index] of dailyReportSales.entries()) {
      const target=person.targets[index];
      const actual=person.actuals[index];
      const expected=person.expected[index];
      if (target==null||target<=0) continue;
      const behind=expected>actual+1e-9;
      const status=actual>=target?'Wykonany':behind?'Poniżej tempa':expected>0?'W tempie':'';
      if (!status) continue;
      const marker=reportElement('span',status);
      marker.className=behind?'daily-report-behind':'daily-report-ahead';
      summary.querySelector('tbody').rows[row].cells[column+1].append(marker);
    }
  }
  return summary;
}

function renderDailyManagementSalon(card,salon,csv,closed) {
  card.append(reportElement('h3','Realizacja planów'),dailySalesTable(salon));
  const teamMetrics=reportMetrics(salon.totals,salon.targets,salon.expected);
  const peopleMetrics=salon.people.map(person=>reportMetrics(person.actuals,person.targets,person.expected));
  for (const index of dailyReportSales) {
    csv.push([salon.salon,'Razem',...teamMetrics[index]],...salon.people.map((person,row)=>
      [salon.salon,person.name,...peopleMetrics[row][index]]));
  }

  card.append(reportElement('h3',closed?'Co poprawić w kolejnym miesiącu':'Co zrobić, żeby dowieźć plan'));
  const actions=reportElement('ol');
  actions.className='daily-report-actions';
  for (const {title,evidence,instruction} of salon.actions) {
    const item=reportElement('li');
    item.append(reportElement('strong',title),reportElement('span',evidence),reportElement('p',instruction));
    actions.append(item);
    csv.push([salon.salon,'Razem',title,evidence,instruction]);
  }
  if (!salon.actions.length) {
    card.append(reportElement('p',salon.expected.some(goal=>goal>0)
      ?'Zapisane wyniki są zgodne z tempem dla ustawionych celów. Utrzymaj obecny rytm pracy.'
      :'Ustaw cele salonu i zespołu, aby wyznaczyć tempo i wskazać luki.'));
  } else card.append(actions);

  const headers=['Aktywność','Wynik','Plan miesięczny','Realizacja','Plan do daty'];
  const activities=reportElement('details');
  activities.append(reportElement('summary','Aktywności i rozliczenie dni pracy'),
    reportTable(headers,teamMetrics.slice(0,6)));
  csv.push(...teamMetrics.slice(0,6).map(row=>[salon.salon,'Razem',...row]));
  for (const [index,person] of salon.people.entries()) {
    const details=reportElement('details');
    const name=person.name+(person.archived?' · archiwum':'');
    const metrics=peopleMetrics[index].slice(0,6);
    details.append(reportElement('summary',name),reportTable(headers,metrics));
    csv.push(...metrics.map(row=>[salon.salon,name,...row]));
    if (person.check) {
      const checks=reportDailyChecks(person.check);
      details.append(reportTable(['Sprawdzenie','Wynik'],checks));
      csv.push(...checks.map(row=>[salon.salon,name,...row]));
    }
    activities.append(details);
  }
  card.append(activities);
}

function renderManagementReport(report,selected) {
  const daily=report.type==='daily';
  const marketing=report.type==='marketing';
  const salons=report.salons.filter(row=>daily||selected.has(row.salon));
  const csv=marketing?[['Salon','Rodzaj','Handlowiec','Źródło','Leady','Zamówienia','Konwersja','Dodatkowe leady','Podstawa']]
    :[['Salon','Handlowiec','Wskaźnik','Wynik','Plan miesięczny','Realizacja','Plan do daty']];
  reportResults.replaceChildren();
  for (const salon of salons) {
    const card=reportElement('article');
    card.append(reportElement('h2',salon.salon));
    if (marketing) {
      const sourceRows=salon.sources.map(({leads,orders},index)=>[sources[index],leads,orders,leads?reportPercent.format(orders/leads):'—']);
      card.append(reportTable(['Źródło leadów','Leady','Zamówienia','Zamówienia / leady'],sourceRows));
      csv.push(...sourceRows.map(row=>[salon.salon,'Konwersja','',...row,'','']));
      card.append(reportElement('h3','Rekomendowany przydział dodatkowych leadów'));
      const proposals=salon.recommendations.map(({seller,source,extra,leads,orders,basis})=>
        [seller,sources[source],extra,reportPercent.format(orders/leads),basis==='next'?'Plan kolejnego miesiąca':'Plan raportowanego miesiąca']);
      if (proposals.length) {
        card.append(reportTable(['Handlowiec','Źródło','Dodatkowe leady','Konwersja','Podstawa'],proposals));
        csv.push(...salon.recommendations.map(row=>[salon.salon,'Rekomendacja',row.seller,sources[row.source],
          row.leads,row.orders,reportPercent.format(row.orders/row.leads),row.extra,row.basis==='next'?'Plan kolejnego miesiąca':'Plan raportowanego miesiąca']));
      } else card.append(reportElement('p','Brak źródeł spełniających warunki rekomendacji dla handlowców w tym salonie.'));
    } else if (daily) {
      renderDailyManagementSalon(card,salon,csv,report.reportDay?.slice(0,7)>report.month);
    } else {
      const headers=['Aktywność','Wynik','Plan miesięczny','Realizacja'];
      const metrics=reportMetrics(salon.totals,salon.targets);
      card.append(reportTable(headers,metrics.map(row=>row.slice(0,headers.length))));
      csv.push(...metrics.map(row=>[salon.salon,'Razem',...row]));
      for (const person of salon.people) {
        const details=reportElement('details');
        const name=person.name+(person.archived?' · archiwum':'');
        const personnelMetrics=reportMetrics(person.actuals,person.targets,person.expected);
        details.append(reportElement('summary',name),reportTable(headers,personnelMetrics.map(row=>row.slice(0,headers.length))));
        csv.push(...personnelMetrics.map(row=>[salon.salon,name,...row]));
        card.append(details);
      }
    }
    reportResults.append(card);
  }
  reportCsv={rows:csv,filename:'bieg-wyzej-'+report.type+'-'+(report.reportDay??report.month)+'.csv'};
  reportExport.disabled=!salons.length;
  if (marketing) {
    reportResults.prepend(reportElement('p','Konwersja porównuje zamówienia i leady zapisane w tym samym miesiącu. Rekomendacja wymaga planu źródłowego, co najmniej 20 zarejestrowanych leadów, konwersji na poziomie założenia dla źródła oraz luki w liczbie leadów.'));
  }
}

reportForm.onsubmit=async event=>{
  event.preventDefault();
  const {query,selected}=reportSelection();
  const revision=++reportRevision;
  reportExport.disabled=true;
  reportResults.replaceChildren();
  if (query.get('type')!=='daily'&&!selected.size) {
    reportStatus.textContent='Wybierz przynajmniej jeden salon.';
    return;
  }
  reportStatus.textContent='Wczytywanie raportu…';
  try {
    const report=await api('/api/management-reports?'+query);
    if (revision!==reportRevision) return;
    const date=dateLabel(report.through,{day:'numeric',month:'long',year:'numeric'});
    const generated=report.generatedAt?new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit'}).format(new Date(report.generatedAt)):null;
    reportStatus.textContent=monthLabel(report.month)+' · wyniki do '+date+(generated?' · wygenerowano o '+generated:'');
    renderManagementReport(report,selected);
  } catch (error) {
    if (revision===reportRevision) reportStatus.textContent=error.message;
  }
};

reportExport.onclick=()=>{
  if (!reportCsv||reportExport.disabled) return;
  const escape=value=>{
    const cell=String(value??'');
    const safe=typeof value==='string'&&/^[\t\r\n ]*[=+@-]/.test(cell)?"'"+cell:cell;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  const file=new Blob(['\uFEFF',reportCsv.rows.map(row=>row.map(escape).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(file);
  const link=document.createElement('a');
  link.href=url;
  link.download=reportCsv.filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};


reportPdfExport.onclick=async ()=>{
  if (reportPdfExport.disabled||!reportForm.reportValidity()) return;
  const {query,selected}=reportSelection();
  const daily=query.get('type')==='daily';
  const salon=reportForm.elements.pdfSalon.value;
  if (daily?!salon:!selected.size) {
    reportStatus.textContent=daily?'Wybierz salon do pobrania PDF.':'Wybierz przynajmniej jeden salon.';
    if (daily) reportForm.elements.pdfSalon.focus();
    return;
  }
  query.set('format','pdf');
  if (daily) query.set('salon',salon);
  else for (const name of selected) query.append('salon',name);
  if (data.role) query.set('role',data.role);
  if (previewTarget) query.set('podglad',previewTarget);
  reportPdfExport.disabled=true;
  const revision=reportFilterRevision;
  try {
    const response=await fetch('/api/management-reports?'+query,{cache:'no-store'});
    if (!response.ok) throw new Error((await response.json().catch(()=>null))?.error);
    const filename=response.headers.get('Content-Disposition')?.match(/filename="([^"]+\.pdf)"/)?.[1];
    if (!response.headers.get('Content-Type')?.startsWith('application/pdf')||!filename) {
      throw new Error('Serwer nie zwrócił pliku PDF.');
    }
    if (daily&&response.headers.get('X-Lejek-Report-Layout')!=='daily-plans') {
      throw new Error('Serwer zwrócił starszy układ raportu dziennego. Odśwież stronę i pobierz raport ponownie.');
    }
    const file=await response.blob();
    if (revision!==reportFilterRevision) return;
    const url=URL.createObjectURL(file);
    const link=document.createElement('a');
    link.href=url;
    link.download=filename;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch (error) {
    if (revision===reportFilterRevision) reportStatus.textContent=error.message||'Nie udało się przygotować PDF.';
  } finally {
    reportPdfExport.disabled=false;
  }
};
