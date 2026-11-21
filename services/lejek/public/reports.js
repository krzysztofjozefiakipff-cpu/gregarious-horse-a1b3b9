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

const briefingPdfDialog=reportGet('#briefing-pdf-dialog');
const briefingPdfShare=briefingPdfDialog.querySelector('#briefing-pdf-share');
const briefingPdfDownload=briefingPdfDialog.querySelector('#briefing-pdf-download');
const briefingPdfStatus=briefingPdfDialog.querySelector('#briefing-pdf-status');
const briefingPdfOptions=briefingPdfDialog.querySelector('#briefing-pdf-options');
const briefingPdfPreview=briefingPdfDialog.querySelector('#briefing-pdf-preview');
const briefingPdfView=briefingPdfDialog.querySelector('#briefing-pdf-view');
let briefingPdfAddress;

briefingPdfDialog.onclose=()=>{
  URL.revokeObjectURL(briefingPdfAddress);
  briefingPdfAddress=undefined;
  briefingPdfDownload.removeAttribute('href');
  briefingPdfShare.onclick=null;
  briefingPdfPreview.onclick=null;
  briefingPdfView.querySelector('iframe')?.remove();
  briefingPdfDialog.classList.remove('previewing');
  briefingPdfOptions.hidden=false;
  briefingPdfView.hidden=true;
};

async function requestManagementPdf(endpoint) {
  const response=await fetch(endpoint,{cache:'no-store'});
  if (!response.ok) throw new Error((await response.json().catch(()=>null))?.error||'Nie udało się przygotować PDF.');
  const filename=response.headers.get('Content-Disposition')?.match(/filename="([^"]+\.pdf)"/)?.[1];
  if (!response.headers.get('Content-Type')?.startsWith('application/pdf')||!filename)
    throw new Error('Serwer nie zwrócił pliku PDF.');
  return new File([await response.blob()],filename,{type:'application/pdf'});
}

function showManagementPdf(file,endpoint,salon,title,back) {
  briefingPdfDialog.setAttribute('aria-label',title);
  briefingPdfDialog.querySelector('h2').textContent=title;
  briefingPdfView.querySelector('button').textContent=back;
  const shareData={files:[file]};
  briefingPdfAddress=URL.createObjectURL(file);
  briefingPdfDownload.href=briefingPdfAddress;
  briefingPdfDownload.download=file.name;
  briefingPdfPreview.onclick=()=>{
    const frame=reportElement('iframe');
    frame.title=title;
    frame.src=endpoint+'&disposition=inline';
    briefingPdfOptions.hidden=true;
    briefingPdfView.hidden=false;
    briefingPdfDialog.classList.add('previewing');
    briefingPdfView.append(frame);
    briefingPdfView.querySelector('button').focus();
  };
  briefingPdfDialog.querySelector('#briefing-pdf-scope').textContent=salon||'Wszystkie salony';
  briefingPdfShare.hidden=!(navigator.share&&navigator.canShare?.(shareData));
  briefingPdfShare.onclick=async()=>{
    briefingPdfStatus.textContent='';
    try {
      await navigator.share(shareData);
    } catch(error) {
      if (error.name!=='AbortError') briefingPdfStatus.textContent='Nie udało się udostępnić pliku. Otwórz podgląd PDF.';
    }
  };
  briefingPdfStatus.textContent='';
  briefingPdfDialog.showModal();
}

function showReportFields() {
  const {type,month,day,salon}=reportForm.elements;
  const daily=type.value==='daily';
  reportGet('#report-day-field').hidden=day.disabled=!daily;
  reportGet('#report-month-field').hidden=month.disabled=daily;
  reportGet('#report-filter-salon').textContent=salon.selectedOptions[0]?.textContent||'Brak salonów';
  const date=daily?day.value:month.value;
  reportGet('#report-filter-period').textContent=!date?'Wybierz okres':daily?dateLabel(date):monthLabel(date);
}

function renderReportPicker(snapshot) {
  const {type,month,day,salon}=reportForm.elements;
  month.max=snapshot.today.slice(0,7);
  day.max=snapshot.today;
  const firstOpen=!month.value;
  month.value ||= month.max;
  day.value ||= snapshot.today;
  const salonNames=snapshot.salons.map(row=>row.salon);
  const signature=JSON.stringify(salonNames);
  if (salon.dataset.salons!==signature) {
    const previous=salon.value;
    const options=salonNames.map(name=>new Option(name,name));
    if (salonNames.length>1) options.unshift(new Option('Wszystkie salony',''));
    salon.replaceChildren(...options);
    if (salonNames.includes(previous)) salon.value=previous;
    salon.dataset.salons=signature;
  }
  showReportFields();
  if (firstOpen) {
    reportPdfExport.disabled=!salon.options.length;
    if (type.value==='monthly'&&salon.options.length) reportForm.requestSubmit();
  }
}

reportForm.onchange=event=>{
  const {type,month}=reportForm.elements;
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
  const {type,month,day,salon}=reportForm.elements;
  const liveBriefing=type.value==='daily'&&data.role==='manager'&&day.value===data.today;
  const path=liveBriefing?'/api/daily-briefing':'/api/management-reports';
  const query=new URLSearchParams(liveBriefing?{}:{type:type.value,
    ...(type.value==='daily'?{day:day.value}:{month:month.value})});
  return {path,query,salon:salon.value,liveBriefing};
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

function reportSalesTable(salon,people=[]) {
  const rows=[{name:'Razem salon',actuals:salon.totals,targets:salon.targets,expected:salon.expected},...people];
  const summary=reportTable(['Wynik / plan','Zamówienia','Faktury','Rejestracje','Opinie Google'],
    rows.map(person=>[person.name+(person.archived?' · archiwum':''),...dailyReportSales.map(index=>{
      const target=person.targets[index];
      return reportNumber.format(person.actuals[index])+' / '+(target==null?'—':reportNumber.format(target));
    })]));
  summary.classList.add('daily-sales-report');
  for (const [row,person] of rows.entries()) {
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
  card.append(reportElement('h3','Realizacja planów'),reportSalesTable(salon,salon.people));
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

function reportSourceConversionRows(salon) {
  return salon.sources.map(({leads,orders},index)=>[sources[index],leads,orders,
    leads?reportPercent.format(orders/leads):'—']);
}

function renderMonthlyManagementSalon(card,salon,csv) {
  const metrics=reportMetrics(salon.totals,salon.targets,salon.expected);
  card.append(reportElement('h3','Realizacja sprzedaży i cele'),reportSalesTable(salon));
  const details=reportElement('details');
  details.append(reportElement('summary','Aktywności salonu'),
    reportTable(['Aktywność','Wynik','Plan miesięczny','Realizacja','Plan do daty'],metrics.slice(0,6)));
  const conversion=reportSourceConversionRows(salon);
  const table=reportTable(['Źródło','Leady','Zamówienia','Konwersja'],conversion);
  table.classList.add('report-source-conversion');
  const orderHeading=table.querySelector('thead th:nth-child(3)');
  orderHeading.setAttribute('aria-label','Zamówienia');
  const short=reportElement('abbr','Zam.');
  short.title='Zamówienia';
  short.setAttribute('aria-hidden','true');
  orderHeading.replaceChildren(reportElement('span','Zamówienia'),short);
  const note=reportElement('p','Konwersja to zamówienia podzielone przez leady z danego źródła w wybranym okresie. Bez leadów pokazujemy kreskę.');
  note.className='report-conversion-note';
  card.append(details,reportElement('h3','Konwersja według źródła pozyskania'),note,table);
  csv.push(...metrics.map(row=>[salon.salon,'Realizacja',...row,'','','']));
  csv.push(...conversion.map(([source,leads,orders,rate])=>
    [salon.salon,'Konwersja',source,'','','','',leads,orders,rate]));
}

function marketingStageValues(source,stage) {
  const numerator=source.stages[stage.numerator];
  const denominator=source.stages[stage.denominator];
  const ratio=denominator?(stage.frequency?reportNumber.format(numerator/denominator):reportPercent.format(numerator/denominator)):'—';
  return [stage.label,numerator,denominator,ratio];
}

function renderMarketingBenchmarks(benchmarks,csv) {
  const panel=reportElement('details');
  panel.className='marketing-market-reference';
  panel.append(reportElement('summary','Benchmark rynkowy · '+reportPercent.format(benchmarks.market[0].rows[0][1])+' zakupu z leadów WWW w USA'),
    reportElement('p',benchmarks.marketNote));
  for (const {study,sample,url,rows} of benchmarks.market) {
    const link=reportElement('a',study);
    link.href=url;
    panel.append(link,reportElement('p',sample),reportTable(['Wskaźnik','Średnia w badaniu'],
      rows.map(([label,rate])=>[label,reportPercent.format(rate)])));
    for (const [label,rate] of rows) csv.push(['','Benchmark USA','',label,'','',reportPercent.format(rate),'','','',study+' · '+sample+' · '+url,'']);
  }
  return panel;
}

function renderMarketingSalon(card,salon,benchmarks,csv) {
  card.append(reportElement('h3','Wskazówki dla marketingu'));
  if (!salon.recommendations.length) {
    card.append(reportElement('p','Brak źródeł, dla których dane i plan wskazują zmianę dopływu lub obsługi.'));
  } else renderMarketingActions(card,salon,csv);
  card.append(reportElement('h3','Konwersja według źródła'),
    reportTable(['Źródło leadów','Leady','Zamówienia','Zamówienia / leady'],reportSourceConversionRows(salon)));
  const funnel=reportElement('details');
  funnel.append(reportElement('summary','Etapy lejka według źródła'));
  for (const [index,source] of salon.sources.entries()) {
    const stages=benchmarks.stages.map(stage=>marketingStageValues(source,stage));
    for (const stage of stages) csv.push([salon.salon,'Etap',sources[index],...stage,'','','','','']);
    if (!source.stages.some(Boolean)) continue;
    const channel=reportElement('details');
    channel.append(reportElement('summary',sources[index]),
      reportTable(['Etap','Licznik','Mianownik','Wskaźnik'],stages));
    funnel.append(channel);
  }
  if (funnel.children.length===1) funnel.append(reportElement('p','Brak aktywności z przypisanym źródłem.'));
  card.append(funnel);
}

function renderMarketingActions(card,salon,csv) {
  const list=reportElement('ul');
  list.className='marketing-actions';
  for (const {source,extra,leads,orders,rate,targetRate,plan,basis,action,advice} of salon.recommendations) {
    const item=reportElement('li');
    if (extra) item.classList.add('marketing-increase');
    item.append(reportElement('strong',sources[source]+' · '+(extra?'+'+extra+' leadów':action)),
      reportElement('p',advice));
    const observed=rate==null?'—':reportPercent.format(rate);
    const target=reportPercent.format(targetRate);
    item.append(reportElement('small',leads+' leadów · '+orders+' zam. · '+observed+' / '+target+' założenia'+
      (plan?' · '+basis.toLowerCase()+' '+plan+' leadów':'')));
    list.append(item);
    csv.push([salon.salon,'Wskazówka',sources[source],'Zamówienia / leady',orders,leads,observed,
      plan||'',target,extra||'',plan?basis:'',action+'. '+advice]);
  }
  card.append(list);
}

function renderManagementReport(report,selectedSalon) {
  const daily=report.type==='daily';
  const marketing=report.type==='marketing';
  const salons=report.salons.filter(row=>!selectedSalon||row.salon===selectedSalon);
  const csv=marketing?[['Salon','Rodzaj','Źródło','Wskaźnik','Licznik','Mianownik','Wartość','Plan leadów','Założenie konwersji','Dodatkowe leady','Podstawa','Działanie']]
    :daily?[['Salon','Handlowiec','Wskaźnik','Wynik','Plan miesięczny','Realizacja','Plan do daty']]
    :[['Salon','Rodzaj','Wskaźnik lub źródło','Wynik','Plan miesięczny','Realizacja','Plan do daty','Leady','Zamówienia','Konwersja']];
  reportResults.replaceChildren();
  for (const salon of salons) {
    const card=reportElement('article');
    const title=reportElement('h2',salon.salon);
    title.className='report-salon-title';
    card.append(title);
    if (marketing) {
      renderMarketingSalon(card,salon,report.marketing,csv);
    } else if (daily) {
      renderDailyManagementSalon(card,salon,csv,report.reportDay?.slice(0,7)>report.month);
    } else renderMonthlyManagementSalon(card,salon,csv);
    reportResults.append(card);
  }
  if (report.type==='monthly'&&salons.length>1) reportResults.prepend(monthlyReportOverview(salons));
  if (marketing) reportResults.prepend(reportElement('p',report.marketing.method),
    renderMarketingBenchmarks(report.marketing,csv));
  reportCsv={rows:csv,filename:'bieg-wyzej-'+report.type+'-'+(report.reportDay??report.month)+'.csv'};
  reportExport.disabled=!salons.length;
}

function monthlyReportOverview(salons) {
  const overview=reportElement('section');
  overview.id='report-monthly-overview';
  const metrics=[['Zamówienia',6],['Faktury',7],['Rejestracje',8],['Opinie Google',9]];
  const combined=createResultsCard('monthly-report-overview-title');
  const indexByMetric={7:6,10:7,8:8,9:9};
  for (const cell of combined.querySelectorAll('[data-seller-result]')) {
    const index=indexByMetric[cell.dataset.sellerResult];
    const actual=salons.reduce((sum,salon)=>sum+salon.totals[index],0);
    const plan=salons.every(salon=>salon.targets[index]!=null)
      ?salons.reduce((sum,salon)=>sum+salon.targets[index],0):null;
    cell.textContent=reportNumber.format(actual)+' / '+(plan==null?'—':reportNumber.format(plan));
  }
  const heading=reportElement('h2','Wszystkie salony · razem');
  heading.id='monthly-report-overview-title';
  overview.append(heading,combined,reportTable(['Salon',...metrics.map(([label])=>label)],
    salons.map(salon=>[salon.salon,...metrics.map(([,index])=>reportNumber.format(salon.totals[index]))])));
  return overview;
}

function renderLiveBriefingReport(report,selectedSalon) {
  const salons=report.salons.filter(row=>!selectedSalon||row.salon===selectedSalon);
  const labels=['Zamówienia','Faktury','Rejestracje','Opinie Google'];
  const headers=['Wskaźnik','Wykonano','Plan','Jeszcze w miesiącu','Prognoza na koniec'];
  const format=value=>value==null?'—':reportNumber.format(value);
  const rows=({actual,plan,forecast,missing})=>labels.map((label,index)=>{
    const partial=Boolean(missing?.[index]);
    return [label,format(actual[index]),format(plan[index]),format(forecast[index])+
      (partial&&forecast[index]!=null?' (częściowa)':''),
      format(!partial&&forecast[index]!=null?actual[index]+forecast[index]:null)];
  });
  const csv=[['Salon','Handlowiec',...headers]];
  for (const salon of salons) {
    const card=reportElement('article');
    const title=reportElement('h2',salon.salon);
    title.className='report-salon-title';
    const team=salon.people.filter(person=>person.editable);
    const done=team.filter(person=>person.signoff.completed).length;
    card.append(title,reportElement('p',done+' z '+team.length+' odpraw zatwierdzonych'),reportTable(headers,rows(salon)));
    csv.push(...rows(salon).map(row=>[salon.salon,'Razem',...row]));
    for (const person of salon.people) {
      const details=reportElement('details');
      const name=person.name+(person.archived?' · archiwum':'');
      details.append(reportElement('summary',name),reportTable(headers,rows(person)));
      card.append(details);
      csv.push(...rows(person).map(row=>[salon.salon,name,...row]));
    }
    reportResults.append(card);
  }
  reportCsv={rows:csv,filename:'bieg-wyzej-odprawa-'+report.today+'.csv'};
  reportExport.disabled=!salons.length;
}

reportForm.onsubmit=async event=>{
  event.preventDefault();
  const {path,query,salon,liveBriefing}=reportSelection();
  const revision=++reportRevision;
  reportExport.disabled=true;
  reportResults.replaceChildren();
  reportStatus.textContent='Wczytywanie raportu…';
  try {
    const report=await api(path+'?'+query);
    if (revision!==reportRevision) return;
    const date=dateLabel(liveBriefing?report.today:report.through,{day:'numeric',month:'long',year:'numeric'});
    const generated=report.generatedAt?new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit'}).format(new Date(report.generatedAt)):null;
    reportStatus.textContent=monthLabel(report.month)+' · wyniki do '+date+(generated?' · wygenerowano o '+generated:'');
    if (liveBriefing) renderLiveBriefingReport(report,salon);
    else renderManagementReport(report,salon);
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
  const {path,query,salon,liveBriefing}=reportSelection();
  query.set('format','pdf');
  if (salon) query.set('salon',salon);
  if (data.role) query.set('role',data.role);
  if (previewTarget) query.set('podglad',previewTarget);
  reportPdfExport.disabled=true;
  const revision=reportFilterRevision;
  const endpoint=path+'?'+query;
  try {
    const file=await requestManagementPdf(endpoint);
    if (revision!==reportFilterRevision||reportGet('#management-reports').hidden) return;
    const title=liveBriefing?'Raport odprawy':reportForm.elements.type.selectedOptions[0].textContent;
    showManagementPdf(file,endpoint,salon,title,'Wróć do raportów');
  } catch (error) {
    if (revision===reportFilterRevision) reportStatus.textContent=error.message||'Nie udało się przygotować PDF.';
  } finally {
    reportPdfExport.disabled=false;
  }
};
