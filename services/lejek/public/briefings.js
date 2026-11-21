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

function briefingTable(headers,rows,compact=false) {
  const region=reportElement('div');
  region.className='briefing-scroll';
  const table=reportElement('table');
  table.className=compact?'briefing-table briefing-table-compact':'briefing-table';
  const header=table.createTHead().insertRow();
  for (const label of headers) {
    const cell=reportElement('th',label);
    cell.scope='col';
    header.append(cell);
  }
  const body=table.createTBody();
  for (const row of rows) {
    const tr=body.insertRow();
    for (const [index,value] of row.entries()) {
      const td=tr.insertCell();
      if (compact) td.dataset.label=headers[index];
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
  editor.append(reportElement('summary','Skoryguj wykonanie według źródeł'));
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
  const entry=briefingTable(['Źródło',...columns.map(([,label])=>label)],sources.map((source,i)=>[source,...fields[i]]),true);
  entry.querySelector('table').classList.remove('briefing-table-compact');
  entry.classList.add('activity-entry-table');
  const rows=[...entry.querySelectorAll('tbody tr')];
  rows[0].cells[2].classList.add('mobile-automatic-field');
  rows[0].cells[3].classList.add('mobile-automatic-field');
  addNumberControlsIn(entry);
  addMobileEntryPicker(entry,rows,sources);
  form.append(reportElement('p','Wpisz rzeczywiste wyniki według źródeł. Po zapisie plan na pozostałe dni przeliczy się automatycznie.'),
    entry,save,status);
  form.onsubmit=async event=>{
    event.preventDefault();
    save.disabled=true;
    try {
      const rows=fields.map((inputs,row)=>{
        const values=Array.from({length:11},(_,i)=>original[row]?.[i]??0);
        columns.forEach(([index],i)=>{values[index]=Number(inputs[i].value);});
        return values;
      });
      await api('/api/daily-briefing',{person:person.id,day:report.today,action:'correct',rows,previousRows:original,version:person.review.version});
      await loadBriefingPanel('Zapisano korektę wykonania · '+person.name,person.id);
    } catch(error) {
      status.textContent=error.message;
      save.disabled=false;
    }
  };
  editor.append(form);
  return editor;
}

function briefingOverview(headers,rows) {
  const overview=briefingTable(headers,rows);
  overview.classList.add('briefing-overview');
  return overview;
}

function briefingFold(label,...nodes) {
  const details=reportElement('details');
  details.className='briefing-extra';
  details.append(reportElement('summary',label),...nodes);
  return details;
}

function briefingStepper(active,completed) {
  const stepper=reportElement('ol');
  stepper.className='briefing-stepper';
  ['Wykonanie','Plan na dziś','Zatwierdzenie'].forEach((label,i)=>{
    const step=reportElement('li',label);
    if (completed||i+1<active) step.dataset.done='true';
    else if (i+1===active) step.setAttribute('aria-current','step');
    stepper.append(step);
  });
  return stepper;
}

function briefingStep(number,title,state) {
  const section=reportElement('section');
  section.className='briefing-step';
  const heading=reportElement('div');
  heading.className='briefing-step-heading';
  const index=reportElement('span',String(number));
  index.className='briefing-step-number';
  index.setAttribute('aria-hidden','true');
  const badge=reportElement('span',state);
  badge.className='briefing-step-badge';
  heading.append(index,reportElement('h3',title),badge);
  section.append(heading);
  return section;
}

function briefingStatusLine() {
  const status=reportElement('p');
  status.className='briefing-action-status';
  status.setAttribute('role','status');
  return status;
}

function briefingAction(parent,label,person,report,payload,message) {
  const button=reportElement('button',label);
  button.type='button';
  const status=briefingStatusLine();
  button.onclick=async()=>{
    button.disabled=true;
    try {
      await api('/api/daily-briefing',{person:person.id,day:report.today,...payload});
      await loadBriefingPanel(message,person.id);
    } catch(error) {
      status.textContent=error.message;
      button.disabled=false;
    }
  };
  parent.append(button,status);
  return button;
}

function briefingSave(form,label,person,report,fields,part) {
  const submit=reportElement('button',label);
  submit.type='submit';
  const status=briefingStatusLine();
  form.append(submit,status);
  form.onsubmit=async event=>{
    event.preventDefault();
    submit.disabled=true;
    try {
      const values=fields.map(input=>input.value===''?null:input.valueAsNumber);
      await api('/api/daily-briefing',{person:person.id,day:report.today,action:'save',part,[part]:values});
      await loadBriefingPanel('Zapisano '+(part==='goals'?'cele':'prognozę')+' · '+person.name,person.id);
    } catch(error) {
      status.textContent=error.message;
      submit.disabled=false;
    }
  };
  return submit;
}

function briefingCalendarLink() {
  const link=reportElement('a','Otwórz kalendarz pracy');
  link.href='#kalendarz-pracy';
  link.dataset.panelRoute='';
  return link;
}

function briefingReviewStep(person,report,canEdit) {
  const {review}=person;
  const title=review.day?'Poprzedni dzień pracy · '+dateLabel(review.day):'Poprzedni dzień pracy';
  const state=review.confirmed?'Potwierdzony':review.status==='none'?'Nie dotyczy':review.status==='missing'?'Brak wpisu':'Do potwierdzenia';
  const step=briefingStep(1,title,state);
  if (review.day&&review.day!==report.yesterday) step.append(reportElement('p','Kalendarz pominął dni wolne.'));
  if (review.status==='none') step.append(reportElement('p','Ewidencja handlowca nie obejmuje wcześniejszego dnia pracy.'));
  if (review.status==='missing') step.append(
    reportElement('p','Poczekaj na zatwierdzenie wpisu handlowca lub rozpatrz jego zgłoszenie w kalendarzu.'),briefingCalendarLink());
  if (review.stale) step.append(reportElement('p','Wyniki zmieniły się od potwierdzenia. Sprawdź je ponownie.'));
  if (!review.actual) return step;
  if (review.confirmed) step.append(reportElement('p','Potwierdził: '+review.confirmed.by));
  step.append(briefingOverview(['Aktywność','Plan','Wykonanie'],
    columns.map(([,label],i)=>{
      const actual=reportElement('span',String(review.actual[i]));
      if (review.goals[i]!=null&&review.actual[i]<review.goals[i]) {
        actual.className='briefing-below-target';
        const note=reportElement('span',' · poniżej celu');
        note.className='entry-visually-hidden';
        actual.append(note);
      }
      return [label,review.goals[i],actual];
    })));
  if (canEdit&&!review.confirmed) briefingAction(step,'Potwierdź wykonanie',person,report,
    {action:'confirm',actual:review.actual,version:review.version},'Potwierdzono poprzedni dzień pracy · '+person.name);
  if (canEdit&&review.rows) step.append(briefingResultCorrection(person,report));
  return step;
}

function briefingTodayStep(person,report,canEdit,onDraftChange) {
  const {signoff}=person;
  const state=signoff.accepted?'Zaakceptowany':person.pendingToday?'Zgłoszenie w toku':person.workday?'Do akceptacji':'Dzień wolny';
  const step=briefingStep(2,'Dzisiaj · '+dateLabel(report.today),state);
  if (person.pendingToday) {
    step.append(reportElement('p','Rozpatrz zgłoszenie na dziś przed zaakceptowaniem dnia.'),briefingCalendarLink());
    return step;
  }

  let fields=[],save,accept;
  if (person.workday) {
    step.append(briefingOverview(['Aktywność','Cel na dziś'],columns.map(([,label],i)=>[label,person.todayGoals[i]])));
    if (canEdit) {
      const editor=briefingFold('Zmień cele na dziś');
      const form=reportElement('form');
      fields=columns.map(([,label],i)=>briefingNumberField('Korekta · '+label,person.correction[i],person.todayGoals[i]));
      form.append(briefingOverview(['Aktywność','Korekta'],columns.map(([,label],i)=>[label,fields[i]])));
      addNumberControlsIn(form);
      save=briefingSave(form,'Zapisz korektę celów',person,report,fields,'goals');
      editor.append(form);
      step.append(editor);
    }
  } else {
    const reason=calendarKinds[person.dayOff]??(person.dayOff==='off'?'Zgodnie z grafikiem':person.dayOff);
    step.append(reportElement('p',reason+' · bez celów na dziś.'));
  }
  if (!signoff.previousReady) step.append(reportElement('p','Najpierw potwierdź wykonanie z poprzedniego dnia pracy.'));
  if (canEdit&&signoff.previousReady&&!signoff.accepted) {
    accept=briefingAction(step,person.workday?'Zaakceptuj plan na dziś':'Zaakceptuj dzień wolny',person,report,
      {action:'accept-today',version:signoff.planVersion},'Zaakceptowano dzisiejszy dzień · '+person.name);
  }
  if (save) {
    const baseline=fields.map(field=>field.value);
    const update=()=>{
      const dirty=fields.some((field,i)=>field.value!==baseline[i]||field.validity.badInput);
      save.disabled=!dirty;
      if (accept) accept.disabled=dirty;
      onDraftChange(dirty);
    };
    fields.forEach(field=>field.oninput=update);
    update();
  }
  return step;
}

function briefingForecast(person,report,canEdit) {
  const section=reportElement('details');
  section.className='briefing-extra';
  const form=reportElement('form');
  const fields=briefingSalesLabels.map((label,i)=>briefingNumberField('Jeszcze w tym miesiącu · '+label,person.manual[i],person.automaticForecast[i]));
  form.append(briefingTable(['Wskaźnik','Wykonano','Plan','Jeszcze w tym miesiącu','Razem na koniec'],
    briefingSalesLabels.map((label,i)=>{
      const total=reportElement('span',briefingDisplay(briefingEnd(person.actual[i],person.forecast[i])));
      if (canEdit) {
        const field=fields[i];
        field.oninput=()=>{
          const remaining=!field.validity.valid?null:field.value===''?person.automaticForecast[i]:field.valueAsNumber;
          total.textContent=briefingDisplay(briefingEnd(person.actual[i],remaining));
        };
      }
      return [label,person.actual[i],person.plan[i],canEdit?fields[i]:person.forecast[i],total];
    }),true));
  if (canEdit) {
    form.append(reportElement('p','Puste pole korzysta z prognozy automatycznej.'));
    addNumberControlsIn(form);
    briefingSave(form,'Zapisz prognozę',person,report,fields,'forecast');
  }
  section.append(reportElement('summary','Realizacja i prognoza miesiąca'),form);
  return section;
}

function renderBriefingSeller(person,report,open,salon) {
  const details=reportElement('details');
  details.className='briefing-seller';
  details.dataset.seller=person.id;
  details.setAttribute('name','briefing-seller-'+salon);
  details.open=open;
  const summary=reportElement('summary');
  const name=reportElement('span',person.name+(person.archived?' · archiwum':person.ownForecast?' · Twoja prognoza':''));
  name.className='briefing-seller-name';
  const {signoff,review}=person;
  if (person.editable) {
    const state=signoff.completed?'Zatwierdzona':signoff.accepted?'Do zatwierdzenia':person.pendingToday?'Zgłoszenie w toku'
      :signoff.previousReady?'Plan na dziś':review.status==='missing'?'Brak wpisu':'Sprawdź wykonanie';
    const badge=reportElement('span',state);
    badge.className='briefing-completed-badge';
    badge.dataset.complete=details.dataset.reviewComplete=String(signoff.completed);
    summary.append(name,badge);
  } else summary.append(name);
  details.append(summary);

  const canEdit=person.editable&&!previewTarget;
  if (person.editable) {
    const stage=signoff.accepted?3:signoff.previousReady?2:1;
    details.dataset.actionable=String(canEdit&&!signoff.completed&&
      (stage===1?review.status==='recorded':!person.pendingToday));
    const workflow=reportElement('div');
    workflow.className='briefing-workflow';
    workflow.append(briefingStepper(stage,signoff.completed));

    let active;
    if (stage===1) {
      active=briefingReviewStep(person,report,canEdit);
    } else {
      const final=briefingStep(3,'Podsumowanie odprawy',signoff.completed?'Zatwierdzona':'Gotowa');
      let finish;
      if (stage===3) {
        if (signoff.completed) {
          final.append(reportElement('p','Odprawa została zapisana.'));
          const next=reportElement('button','Następna odprawa');
          next.type='button';
          next.className='secondary';
          next.dataset.briefingNext='';
          next.onclick=openNextBriefing;
          final.append(next);
        } else {
          final.append(reportElement('p','Wykonanie potwierdzone. '+(person.workday?'Plan na dziś zaakceptowany.':'Dzień wolny zaakceptowany.')));
          if (canEdit) finish=briefingAction(final,'Zatwierdź odprawę',person,report,
            {action:'complete',version:signoff.completionVersion},'Zatwierdzono odprawę · '+person.name);
        }
      }
      const today=briefingTodayStep(person,report,canEdit,dirty=>{if (finish) finish.disabled=dirty;});
      active=stage===2?today:final;
      const previous=briefingReviewStep(person,report,canEdit);
      workflow.append(active,briefingFold('Poprzedni dzień pracy',previous));
      if (stage===3) workflow.append(briefingFold('Plan na dziś',today));
    }
    if (stage===1) workflow.append(active);
    active.classList.add('briefing-current-step');
    const heading=active.querySelector('h3');
    heading.tabIndex=-1;
    details.append(workflow);
  }
  details.append(briefingForecast(person,report,(person.editable||person.ownForecast)&&!previewTarget));
  if (person.remainingPlan.length) {
    const schedule=reportElement('details');
    schedule.className='briefing-extra';
    schedule.append(reportElement('summary','Plan na pozostałe dni pracy'),
      briefingTable(['Dzień',...columns.map(([,label])=>label)],
        person.remainingPlan.map(({day,goals})=>[dateLabel(day),...goals])));
    details.append(schedule);
  }
  return details;
}

async function loadBriefingPanel(message='',focusSeller) {
  const version=++briefingLoadVersion;
  briefingReady=false;
  briefingPdf.disabled=true;
  briefingStatus.textContent='Wczytywanie odprawy…';
  const open=new Set([...briefingResults.querySelectorAll('details[data-seller][open]')].map(row=>row.dataset.seller));
  try {
    const report=await api('/api/daily-briefing');
    if (version!==briefingLoadVersion||briefingHost.hidden) return;
    briefingHost.querySelector('#briefing-dates').textContent=dateLabel(report.today,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
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
    briefingStatus.textContent=message;
    if (focusSeller) {
      const row=briefingResults.querySelector('[data-seller="'+focusSeller+'"]');
      if (row?.open&&!row.closest('article').hidden) focusBriefingStep(row);
    }
  } catch(error) {
    if (version===briefingLoadVersion) briefingStatus.textContent=error.message;
  }
}

function focusBriefingStep(row) {
  const target=row.querySelector('.briefing-current-step h3')??row.querySelector('summary');
  target.focus({preventScroll:true});
  row.scrollIntoView({block:'start'});
}

function openNextBriefing() {
  const row=briefingResults.querySelector('article:not([hidden]) [data-actionable="true"]');
  if (!row) return;
  row.open=true;
  focusBriefingStep(row);
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
  box.querySelector('strong').textContent='Zatwierdzone odprawy · '+done+' z '+total;
  const progress=box.querySelector('progress');
  progress.max=total||1;
  progress.value=done;
  const hasActionable=Boolean(briefingResults.querySelector('article:not([hidden]) [data-actionable="true"]'));
  for (const button of briefingHost.querySelectorAll('[data-briefing-next]')) button.hidden=!hasActionable;
}

function filterBriefingSalons() {
  const selected=briefingSalon.value;
  for (const card of briefingResults.children) card.hidden=Boolean(selected&&card.dataset.salon!==selected);
  updateBriefingProgress();
}

briefingSalon.onchange=filterBriefingSalons;
briefingHost.querySelector('#briefing-next').onclick=openNextBriefing;
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
