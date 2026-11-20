const reportGet=selector=>document.querySelector(selector);
const reportForm=reportGet('#management-report-form');
const reportResults=reportGet('#management-report-results');
const reportStatus=reportGet('#management-report-status');
const reportExport=reportGet('#export-management-report');
const reportNumber=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1});
const reportPercent=new Intl.NumberFormat('pl-PL',{style:'percent',maximumFractionDigits:1});
let reportRevision=0;
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
  const {type,month,day}=reportForm.elements;
  const daily=type.value==='daily';
  reportGet('#report-day-field').hidden=day.disabled=!daily;
  reportGet('#report-month-field').hidden=month.disabled=daily;
  reportGet('#report-showrooms').hidden=daily;
}

function renderReportPicker(snapshot) {
  const {type,month,day}=reportForm.elements;
  month.max=snapshot.today.slice(0,7);
  day.max=snapshot.today;
  const firstOpen=!month.value;
  month.value ||= month.max;
  day.value ||= snapshot.today;
  const choices=reportGet('#report-showrooms > div');
  const salonNames=snapshot.salons.map(row=>row.salon);
  if (choices.dataset.salons!==JSON.stringify(salonNames)) {
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
  if (firstOpen&&type.value==='monthly') reportForm.requestSubmit();
}

reportForm.elements.type.onchange=()=>{
  const {type,month}=reportForm.elements;
  if (type.value==='marketing'&&month.value===data.today.slice(0,7)) {
    const [year,number]=month.value.split('-').map(Number);
    month.value=monthStart(year,number-2).slice(0,7);
  }
  showReportFields();
};

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
  const yesNo=value=>value?'Tak':'Nie';
  const dates=values=>values.map(day=>dateLabel(day)).join(', ')||'—';
  return [
    ['Logowanie do 11:00',yesNo(check.login)],
    ['Potwierdzony odczyt zadań do 11:00',check.readExpected?yesNo(check.read):'Dzień wolny'],
    ['Rozliczenie dni pracy',check.started
      ?(check.approved+check.zero)+' z '+check.required+' · zatwierdzono '+check.approved+' · bez aktywności '+check.zero
      :'Ewidencja jeszcze nierozpoczęta'],
    ['Zapisy robocze',dates(check.drafts)],
    ['Zgłoszenia oczekujące',dates(check.pending)],
    ['Dni bez wpisu',dates(check.missing)]
  ];
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
    } else {
      const headers=['Aktywność','Wynik','Plan miesięczny','Realizacja',...(daily?['Plan do daty']:[])];
      const metrics=reportMetrics(salon.totals,salon.targets);
      card.append(reportTable(headers,metrics.map(row=>row.slice(0,headers.length))));
      csv.push(...metrics.map(row=>[salon.salon,'Razem',...row]));
      for (const person of salon.people) {
        const details=reportElement('details');
        const name=person.name+(person.archived?' · archiwum':'');
        const personnelMetrics=reportMetrics(person.actuals,person.targets,person.expected);
        details.append(reportElement('summary',name),reportTable(headers,personnelMetrics.map(row=>row.slice(0,headers.length))));
        csv.push(...personnelMetrics.map(row=>[salon.salon,name,...row]));
        if (daily&&!person.archived) {
          const check=reportDailyChecks(person.check);
          const weakest=person.weakest?columns[person.weakest.index][1]+' · brakuje '+person.weakest.gap+' do tempa'
            :person.expected.some(goal=>goal>0)?'Aktywności w tempie lub powyżej.':'Brak celu do oceny.';
          details.append(reportElement('p','Największa trudność · '+weakest),reportTable(['Sprawdzenie','Wynik'],check));
          csv.push([salon.salon,name,'Największa trudność',weakest],...check.map(row=>[salon.salon,name,...row]));
          details.open=true;
        }
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
  const {type,month,day}=reportForm.elements;
  const selected=new Set(new FormData(reportForm).getAll('salons'));
  const revision=++reportRevision;
  reportExport.disabled=true;
  reportResults.replaceChildren();
  if (type.value!=='daily'&&!selected.size) {
    reportStatus.textContent='Wybierz przynajmniej jeden salon.';
    return;
  }
  reportStatus.textContent='Wczytywanie raportu…';
  try {
    const query=new URLSearchParams({type:type.value,...(type.value==='daily'?{day:day.value}:{month:month.value})});
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
