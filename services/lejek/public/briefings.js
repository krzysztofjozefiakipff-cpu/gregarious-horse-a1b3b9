const briefingHost=document.querySelector('#daily-briefing');
const briefingResults=briefingHost.querySelector('#briefing-results');
const briefingStatus=briefingHost.querySelector('#briefing-status');
const briefingPdf=briefingHost.querySelector('#briefing-pdf');
const briefingSalon=briefingHost.querySelector('#briefing-salon');
const briefingSalesLabels=['Zamówienia','Faktury','Rejestracje','Opinie Google'];
let briefingLoadVersion=0;
let briefingReady=false;
let briefingDownloading=false;

const briefingDisplay=value=>value??'—';
const briefingEnd=(actual,forecast)=>forecast==null?null:actual+forecast;

function briefingTable(headers,rows) {
  const region=reportElement('div');
  region.className='briefing-scroll';
  const table=reportElement('table');
  table.className='briefing-table';
  const header=table.createTHead().insertRow();
  for (const label of headers) {
    const cell=reportElement('th',label);
    cell.scope='col';
    header.append(cell);
  }
  const body=table.createTBody();
  for (const row of rows) {
    const tr=body.insertRow();
    for (const value of row) {
      const td=tr.insertCell();
      if (value instanceof HTMLElement) td.append(value);
      else td.textContent=briefingDisplay(value);
    }
  }
  region.append(table);
  return region;
}

function briefingNumberField(label,value,placeholder) {
  const input=reportElement('input');
  input.type='number';
  input.min='0';
  input.max='1000000';
  input.step='1';
  input.inputMode='numeric';
  input.setAttribute('aria-label',label);
  input.value=value??'';
  input.placeholder=briefingDisplay(placeholder);
  return input;
}

function briefingResultCorrection(person,report) {
  const editor=reportElement('details');
  editor.append(reportElement('summary','Skoryguj wczorajsze wykonanie'));
  const form=reportElement('form');
  const original=person.review.rows;
  const fields=sources.map((source,row)=>columns.map(([index,label])=>
    briefingNumberField(source+' · '+label,original[row]?.[index]||'',0)));
  const updateWalkIn=()=>{
    fields[0][1].value=fields[0][2].value=fields[0][0].value;
  };
  fields[0][1].readOnly=fields[0][2].readOnly=true;
  fields[0][0].oninput=updateWalkIn;
  updateWalkIn();
  const save=reportElement('button','Zapisz korektę wykonania');
  save.type='submit';
  const status=reportElement('p');
  status.setAttribute('role','status');
  form.append(reportElement('p','Wpisz rzeczywiste wyniki według źródeł. Po zapisie plan na pozostałe dni przeliczy się automatycznie.'),
    briefingTable(['Źródło',...columns.map(([,label])=>label)],sources.map((source,i)=>[source,...fields[i]])),save,status);
  form.onsubmit=async event=>{
    event.preventDefault();
    save.disabled=true;
    try {
      const rows=fields.map((inputs,row)=>{
        const values=Array.from({length:11},(_,i)=>original[row]?.[i]??0);
        columns.forEach(([index],i)=>{values[index]=Number(inputs[i].value);});
        return values;
      });
      await api('/api/daily-briefing',{person:person.id,day:report.today,action:'correct',rows,previousRows:original});
      await loadBriefingPanel('Zapisano korektę wykonania i przeliczono pozostały plan dla '+person.name+'.');
    } catch(error) {
      status.textContent=error.message;
      save.disabled=false;
    }
  };
  editor.append(form);
  return editor;
}

function renderBriefingSeller(person,report,open,salon) {
  const details=reportElement('details');
  details.className='briefing-seller';
  details.dataset.seller=person.id;
  details.setAttribute('name','briefing-seller-'+salon);
  details.open=open;
  const review=person.review;
  const summary=reportElement('summary');
  const name=reportElement('span',person.name+(person.archived?' · archiwum':person.ownForecast?' · Twoja prognoza':''));
  name.className='briefing-seller-name';
  const completed=reportElement('span',review.confirmed?'Wykonana'
    :review.status==='off'?'Dzień wolny':review.status==='missing'?'Brak wpisu':'Do odprawy');
  completed.className='briefing-completed-badge';
  completed.dataset.complete=String(Boolean(review.confirmed));
  completed.hidden=!person.editable;
  if (person.editable&&review.status!=='off') details.dataset.reviewComplete=String(Boolean(review.confirmed));
  summary.append(name,completed);
  details.append(summary);
  if (person.editable) {
    const section=reportElement('h3','Wczoraj · '+dateLabel(report.yesterday));
    const message=reportElement('p',review.confirmed?'Omówiono z handlowcem · '+review.confirmed.by
      :review.stale?'Wynik zmienił się od potwierdzenia. Omów go ponownie.'
      :review.status==='off'?'Dzień wolny.'
      :review.status==='missing'?'Handlowiec nie zatwierdził jeszcze wyniku.'
      :'Porównaj wykonanie z planem i potwierdź po rozmowie.');
    message.setAttribute('role','status');
    details.append(section,message);
    if (review.actual) {
      details.append(briefingTable(['Cel','Plan na dzień','Wykonanie','Status'],
        columns.map(([,label],i)=>[label,review.goals[i],review.actual[i],
          review.goals[i]==null?'—':review.actual[i]>=review.goals[i]?'Wykonany':'Poniżej celu'])));
      if (!review.confirmed&&!data.previewUser) {
        const confirm=reportElement('button','Potwierdź wykonanie po rozmowie');
        confirm.type='button';
        confirm.onclick=async()=>{
          confirm.disabled=true;
          try {
            await api('/api/daily-briefing',{person:person.id,day:report.today,action:'confirm',actual:review.actual});
            completed.textContent='Wykonana';
            completed.dataset.complete=details.dataset.reviewComplete='true';
            updateBriefingProgress();
            message.textContent='Zapisano potwierdzenie rozmowy i wyniku.';
          } catch(error) {
            message.textContent=error.message;
            confirm.disabled=false;
          }
        };
        details.append(confirm);
      }
      if (review.rows&&!data.previewUser) details.append(briefingResultCorrection(person,report));
    }
  }

  const form=reportElement('form');
  const editable=person.editable&&!data.previewUser;
  const forecastEditable=(person.editable||person.ownForecast)&&!data.previewUser;
  const goals=columns.map(([,label],i)=>briefingNumberField('Dzisiejsza korekta · '+label,person.correction[i],person.todayGoals[i]));
  const forecast=briefingSalesLabels.map((label,i)=>briefingNumberField('Jeszcze w tym miesiącu · '+label,person.manual[i],person.automaticForecast[i]));
  if (person.editable) {
    form.append(reportElement('h3','Dzisiaj · '+dateLabel(report.today)));
    if (person.workday) {
      form.append(briefingTable(['Cel','Na dziś',...(editable?['Korekta']:[])],
        columns.map(([,label],i)=>[label,person.todayGoals[i],...(editable?[goals[i]]:[])])));
    } else form.append(reportElement('p','Dzień wolny.'));
  }
  form.append(reportElement('h3','Realizacja i prognoza do końca miesiąca'));
  form.append(briefingTable(['Wskaźnik','Wykonano','Plan','Jeszcze w tym miesiącu','Razem na koniec'],
    briefingSalesLabels.map((label,i)=>{
      const total=reportElement('span',briefingDisplay(briefingEnd(person.actual[i],person.forecast[i])));
      if (forecastEditable) {
        const field=forecast[i];
        field.oninput=()=>{
          const remaining=!field.validity.valid?null:field.value===''?person.automaticForecast[i]:field.valueAsNumber;
          total.textContent=briefingDisplay(briefingEnd(person.actual[i],remaining));
        };
      }
      return [label,person.actual[i],person.plan[i],forecastEditable?forecast[i]:person.forecast[i],total];
    })));
  if (forecastEditable) {
    const submit=reportElement('button',editable?'Zapisz korekty':'Zapisz prognozę');
    submit.type='submit';
    const status=reportElement('p');
    status.setAttribute('role','status');
    form.append(reportElement('p','Wpisz przewidywany dodatkowy wynik w kolumnie „Jeszcze w tym miesiącu”. Puste pole używa prognozy automatycznej.'),
      submit,status);
    form.onsubmit=async event=>{
      event.preventDefault();
      const read=input=>input.value===''?null:Number(input.value);
      submit.disabled=true;
      try {
        await api('/api/daily-briefing',{person:person.id,day:report.today,action:'save',
          goals:editable&&person.workday?goals.map(read):goals.map(()=>null),forecast:forecast.map(read)});
        await loadBriefingPanel('Zapisano korekty dla '+person.name+'.');
      } catch(error) {
        status.textContent=error.message;
      } finally {
        submit.disabled=false;
      }
    };
  }
  details.append(form);
  if (person.remainingPlan.length) {
    const schedule=reportElement('details');
    schedule.append(reportElement('summary','Plan na pozostałe dni pracy w miesiącu'),
      reportElement('p','Rozkład zakłada wykonanie pokazanych celów i aktualizuje się po każdym zapisanym dniu.'),
      briefingTable(['Dzień',...columns.map(([,label])=>label)],
        person.remainingPlan.map(({day,goals})=>[dateLabel(day),...goals])));
    details.append(schedule);
  }
  return details;
}

async function loadBriefingPanel(message='') {
  const version=++briefingLoadVersion;
  briefingReady=false;
  briefingPdf.disabled=true;
  briefingStatus.textContent='Wczytywanie odprawy…';
  const open=new Set([...briefingResults.querySelectorAll('details[data-seller][open]')].map(row=>row.dataset.seller));
  try {
    const report=await api('/api/daily-briefing');
    if (version!==briefingLoadVersion||briefingHost.hidden) return;
    briefingHost.querySelector('#briefing-dates').textContent=dateLabel(report.today)+' · Wyniki za '+dateLabel(report.yesterday);
    const previous=briefingSalon.selectedIndex<0?null:briefingSalon.value;
    const salons=report.salons.map(row=>row.salon);
    briefingSalon.replaceChildren(...salons.map(salon=>new Option(salon,salon)));
    if (salons.length>1) briefingSalon.add(new Option('Wszystkie salony',''),0);
    briefingSalon.value=salons.includes(previous)?previous:salons.length>1?'':salons[0]??'';
    briefingHost.querySelector('#briefing-salon-filter').hidden=salons.length<2;
    briefingResults.replaceChildren();
    for (const salon of report.salons) {
      const card=reportElement('article');
      card.dataset.salon=salon.salon;
      const heading=reportElement('div');
      heading.className='briefing-salon-heading';
      const count=reportElement('span');
      count.className='briefing-salon-count';
      heading.append(reportElement('h2',salon.salon),count);
      const totals=reportElement('details');
      totals.className='briefing-salon-totals';
      totals.append(reportElement('summary','Wyniki i prognoza salonu'),
        briefingTable(['Wskaźnik','Wykonano','Plan','Jeszcze w tym miesiącu','Razem na koniec'],
          briefingSalesLabels.map((label,i)=>[label,salon.actual[i],salon.plan[i],
            salon.forecast[i]==null?null:salon.forecast[i]+(salon.missing[i]?' (częściowa)':''),
            salon.missing[i]?null:briefingEnd(salon.actual[i],salon.forecast[i])])));
      card.append(heading,totals);
      if (!salon.people.length) card.append(reportElement('p','Brak handlowców do odprawy.'));
      for (const person of salon.people) card.append(renderBriefingSeller(person,report,open.has(String(person.id)),salon.salon));
      briefingResults.append(card);
    }
    filterBriefingSalons();
    briefingReady=Boolean(report.salons.length);
    briefingPdf.disabled=!briefingReady||briefingDownloading;
    briefingStatus.textContent=message||'Prognoza automatyczna korzysta z tempa z zakończonych dni pracy i aktualnego wykonania.';
  } catch(error) {
    if (version===briefingLoadVersion) briefingStatus.textContent=error.message;
  }
}

function updateBriefingProgress() {
  let done=0,total=0;
  for (const card of briefingResults.children) {
    const count=card.querySelector('.briefing-salon-count');
    const reviews=card.querySelectorAll('[data-review-complete]');
    const complete=card.querySelectorAll('[data-review-complete="true"]').length;
    count.textContent=reviews.length?complete+' z '+reviews.length:'';
    if (card.hidden) continue;
    done+=complete;
    total+=reviews.length;
  }
  const box=briefingHost.querySelector('#briefing-progress');
  box.hidden=!total;
  box.querySelector('strong').textContent='Ukończone rozmowy · '+done+' z '+total;
  const progress=box.querySelector('progress');
  progress.max=total||1;
  progress.value=done;
}

function filterBriefingSalons() {
  const selected=briefingSalon.value;
  for (const card of briefingResults.children) card.hidden=Boolean(selected&&card.dataset.salon!==selected);
  updateBriefingProgress();
}

briefingSalon.onchange=filterBriefingSalons;
briefingHost.querySelector('#briefing-refresh').onclick=()=>loadBriefingPanel();
briefingPdf.onclick=async()=>{
  if (!briefingReady||briefingDownloading) return;
  briefingDownloading=briefingPdf.disabled=true;
  try {
    const query=new URLSearchParams({format:'pdf',role:data.role});
    if (briefingSalon.value) query.set('salon',briefingSalon.value);
    if (previewTarget) query.set('podglad',previewTarget);
    const response=await fetch('/api/daily-briefing?'+query,{cache:'no-store'});
    if (!response.ok) throw Error((await response.json().catch(()=>null))?.error||'Nie udało się pobrać raportu.');
    const filename=response.headers.get('Content-Disposition')?.match(/filename="([^"]+\.pdf)"/)?.[1];
    if (!filename||!response.headers.get('Content-Type')?.startsWith('application/pdf'))
      throw Error('Serwer nie zwrócił pliku PDF.');
    const address=URL.createObjectURL(await response.blob());
    const link=reportElement('a');
    link.href=address;
    link.download=filename;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(address),1000);
  } catch(error) {
    briefingStatus.textContent=error.message;
  } finally {
    briefingDownloading=false;
    briefingPdf.disabled=!briefingReady;
  }
};
