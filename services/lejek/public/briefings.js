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

function briefingTable(headers,rows,showCellLabels=false) {
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
    for (const [index,value] of row.entries()) {
      const td=tr.insertCell();
      if (showCellLabels) td.dataset.label=headers[index];
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

function briefingResultEditor(person,report,updateActuals,resolve=false) {
  const form=reportElement('form');
  const original=person.review.rows??[];
  const fields=sources.map((source,row)=>columns.map(([index,label])=>
    briefingNumberField(source+' · '+label,original[row]?.[index]||'',0)));
  const updateWalkIn=()=>{
    fields[0][1].value=fields[0][2].value=fields[0][0].value;
  };
  fields[0][1].readOnly=fields[0][2].readOnly=true;
  fields[0][0].oninput=updateWalkIn;
  updateWalkIn();
  const save=reportElement('button',person.review.confirmed?'Potwierdź ponownie':'Potwierdź wykonanie');
  save.type='submit';
  const status=reportElement('p');
  status.setAttribute('role','status');
  const entry=briefingTable(['Źródło',...columns.map(([,label])=>label)],sources.map((source,i)=>[source,...fields[i]]),true);
  entry.classList.add('activity-entry-table');
  const rows=[...entry.querySelectorAll('tbody tr')];
  rows[0].cells[2].classList.add('mobile-automatic-field');
  rows[0].cells[3].classList.add('mobile-automatic-field');
  addNumberControlsIn(entry);
  const selectSource=addMobileEntryPicker(entry,rows,sources);
  selectSource(Math.max(0,original.findIndex(row=>row.some(value=>value>0))));
  const readRows=()=>fields.map((inputs,row)=>{
    const values=Array.from({length:11},(_,i)=>original[row]?.[i]??0);
    columns.forEach(([index],i)=>{values[index]=Number(inputs[i].value);});
    return values;
  });
  const baseline=JSON.stringify(readRows());
  const modified=()=>JSON.stringify(readRows())!==baseline;
  const update=()=>{
    const values=readRows();
    const changed=JSON.stringify(values)!==baseline;
    save.textContent=resolve?'Zapisz i potwierdź wykonanie':changed
      ?(person.review.confirmed?'Zapisz zmiany i potwierdź ponownie':'Zapisz zmiany i potwierdź')
      :'Potwierdź wykonanie';
    save.disabled=Boolean(person.review.confirmed)&&!changed;
    updateActuals(changed?columns.map(([index])=>values.reduce((total,row)=>total+row[index],0)):person.review.actual??columns.map(()=>null));
  };
  form.append(reportElement('h4','Wpis według źródeł'),entry,save,status);
  form.addEventListener('input',update);
  update();
  form.onsubmit=async event=>{
    event.preventDefault();
    if (save.disabled) return;
    const edits=modified()?{rows:readRows(),previousRows:original}:{};
    save.disabled=true;
    try {
      const result=resolve?{action:'resolve-previous',rows:readRows()}
        :{action:'confirm',actual:person.review.actual,...edits};
      await api('/api/daily-briefing',{person:person.id,day:report.today,version:person.review.version,...result});
      await loadBriefingPanel('Potwierdzono poprzedni dzień pracy · '+person.name,person.id);
    } catch(error) {
      status.textContent=error.message;
      save.disabled=false;
    }
  };
  return form;
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
  ['Wykonanie','Plan na dziś','Prognoza'].forEach((label,i)=>{
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
      const values=fields.map((input,i)=>{
        const value=input.value===''?null:input.valueAsNumber;
        return part==='goals'&&value===person.defaultTodayGoals[i]?null:value;
      });
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

function briefingSourceReview(rows) {
  const usedSources=sources.flatMap((name,i)=>rows[i]?.some(value=>value>0)?[[name,rows[i]]]:[]);
  const details=briefingFold('Zobacz wpis według źródeł');
  if (!usedSources.length) {
    details.append(reportElement('p','We wpisie nie ma zapisanych aktywności.'));
    return details;
  }
  const entry=briefingTable(['Źródło',...columns.map(([,label])=>label)],
    usedSources.map(([name,values])=>[name,...columns.map(([index])=>values[index]??0)]),true);
  entry.classList.add('activity-entry-table');
  addMobileEntryPicker(entry,[...entry.querySelectorAll('tbody tr')],usedSources.map(([name])=>name));
  details.append(entry);
  return details;
}

function briefingPreviousResolution(person,report,renderActuals) {
  const section=reportElement('div');
  section.className='briefing-resolution';
  const label=reportElement('label','Ustalenie z rozmowy');
  const choice=reportElement('select');
  choice.append(new Option('Wybierz',''),new Option('Dzień pracy · zapisz wykonanie','work'),new Option('Dzień wolny','off'));
  label.append(choice);
  const work=briefingResultEditor(person,report,renderActuals,true);
  const absenceForm=reportElement('form');
  const absenceLabel=reportElement('label','Rodzaj dnia wolnego');
  const absence=reportElement('select');
  absence.required=true;
  absence.append(new Option('Wybierz rodzaj',''));
  const kinds=['leave','sick','training','other'];
  if (new Date(person.review.day+'T00:00:00Z').getUTCDay()===6) kinds.push('saturday');
  for (const kind of kinds) absence.append(new Option(calendarKinds[kind],kind));
  if (kinds.includes(person.review.absenceRequest?.kind)) absence.value=person.review.absenceRequest.kind;
  absenceLabel.append(absence);
  const save=reportElement('button','Zapisz i potwierdź dzień wolny');
  save.type='submit';
  const status=briefingStatusLine();
  absenceForm.append(absenceLabel,save,status);
  absenceForm.onsubmit=async event=>{
    event.preventDefault();
    save.disabled=true;
    try {
      await api('/api/daily-briefing',{person:person.id,day:report.today,action:'resolve-previous',
        version:person.review.version,absence:absence.value});
      await loadBriefingPanel('Zapisano dzień wolny · '+person.name,person.id);
    } catch(error) {
      status.textContent=error.message;
      save.disabled=false;
    }
  };
  const update=()=>{
    work.hidden=choice.value!=='work';
    absenceForm.hidden=choice.value!=='off';
  };
  choice.value=person.review.status==='draft'?'work':'';
  choice.onchange=update;
  update();
  section.append(label,work,absenceForm);
  return section;
}

const briefingReviewStates={recorded:'Do potwierdzenia',draft:'Zapis roboczy',pending:'Zgłoszenie w toku',missing:'Brak wpisu'};

function briefingReviewStep(person,report,canEdit) {
  const {review}=person;
  const title=review.day?'Ostatni dzień pracy · '+dateLabel(review.day):'Ostatni dzień pracy';
  const state=review.confirmed?'Potwierdzony':briefingReviewStates[review.status];
  const step=briefingStep(1,title,state);
  if (review.day&&review.day!==report.yesterday) step.append(reportElement('p','Kalendarz pominął dni wolne.'));
  if (review.status==='draft') step.append(
    reportElement('p','Handlowiec zapisał szkic. Sprawdź liczby i zapisz ustalenia z rozmowy.'));
  if (review.absenceRequest) {
    const {kind,reason}=review.absenceRequest;
    const label=kind==='pending'?'Brak aktywności':calendarKinds[kind];
    step.append(reportElement('p','Oczekujące zgłoszenie · '+label+(reason?' · '+reason:'')));
  }
  if (review.status==='missing') step.append(
    reportElement('p','Handlowiec nie zapisał wpisu na ten dzień. Uzupełnij wykonanie lub oznacz dzień wolny.'));
  if (review.stale) step.append(reportElement('p','Wyniki zmieniły się od potwierdzenia. Sprawdź je ponownie.'));
  if (review.confirmed) step.append(reportElement('p','Potwierdził: '+review.confirmed.by));
  const actualCells=columns.map(()=>reportElement('span'));
  const renderActuals=values=>values.forEach((value,i)=>{
    const cell=actualCells[i];
    cell.textContent=briefingDisplay(value);
    const behind=value!=null&&review.goals[i]!=null&&value<review.goals[i];
    cell.classList.toggle('briefing-below-target',behind);
    if (behind) {
      const note=reportElement('span',' · poniżej celu');
      note.className='entry-visually-hidden';
      cell.append(note);
    }
  });
  renderActuals(review.actual??columns.map(()=>null));
  step.append(briefingOverview(['Aktywność','Plan','Wykonanie'],
    columns.map(([,label],i)=>[label,review.goals[i],actualCells[i]])));
  if (canEdit&&['draft','pending','missing'].includes(review.status)) {
    step.append(briefingPreviousResolution(person,report,renderActuals));
  } else if (canEdit&&review.status==='recorded'&&review.rows) {
    step.append(briefingResultEditor(person,report,renderActuals));
  } else {
    if (review.rows) step.append(briefingSourceReview(review.rows));
    if (canEdit&&review.status==='recorded'&&!review.confirmed) briefingAction(step,'Potwierdź wykonanie',person,report,
      {action:'confirm',actual:review.actual,version:review.version},'Potwierdzono poprzedni dzień pracy · '+person.name);
  }
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
    if (canEdit) {
      const form=reportElement('form');
      fields=columns.map(([,label],i)=>briefingNumberField('Cel na dziś · '+label,person.todayGoals[i],person.defaultTodayGoals[i]));
      form.append(briefingOverview(['Aktywność','Cel na dziś'],columns.map(([,label],i)=>[label,fields[i]])),
        reportElement('p','Cele pochodzą z planu dnia handlowca. Zmień tylko te, które wymagają korekty.'));
      addNumberControlsIn(form);
      save=briefingSave(form,'Zapisz cele',person,report,fields,'goals');
      step.append(form);
    } else {
      step.append(briefingOverview(['Aktywność','Cel na dziś'],columns.map(([,label],i)=>[label,person.todayGoals[i]])));
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

function briefingMonthSummary(month) {
  const table=briefingOverview(['Wskaźnik','Wyk. / plan','Na koniec'],
    briefingSalesLabels.map((label,i)=>[
      label,month.actual[i]+' / '+briefingDisplay(month.plan[i]),
      briefingEnd(month.actual[i],month.forecast[i])
    ]));
  table.classList.add('briefing-month-summary');
  table.querySelector('table').setAttribute('aria-label','Realizacja i prognoza miesiąca');
  return table;
}

function briefingForecast(person,report,canEdit,onDraftChange=()=>{}) {
  const section=reportElement('div');
  section.className='briefing-month';
  section.append(briefingMonthSummary(person));
  if (!canEdit) return section;

  const editor=briefingFold('Zmień prognozę');
  const form=reportElement('form');
  const fields=briefingSalesLabels.map((label,i)=>briefingNumberField('Jeszcze w tym miesiącu · '+label,person.manual[i],person.automaticForecast[i]));
  const baseline=fields.map(field=>field.value);
  form.append(briefingOverview(['Wskaźnik','Jeszcze w tym miesiącu'],briefingSalesLabels.map((label,i)=>[label,fields[i]])),
    reportElement('p','Wpisz dodatkowy wynik do końca miesiąca. Puste pole korzysta z prognozy automatycznej.'));
  addNumberControlsIn(form);
  const save=briefingSave(form,'Zapisz prognozę',person,report,fields,'forecast');
  const update=()=>{
    const dirty=fields.some((field,i)=>field.value!==baseline[i]||field.validity.badInput);
    save.disabled=!dirty;
    onDraftChange(dirty);
  };
  fields.forEach(field=>field.oninput=update);
  update();
  editor.append(form);
  section.append(editor);
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
  const initials=person.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase('pl');
  const avatar=reportElement('span',initials);
  avatar.className='briefing-avatar';
  avatar.setAttribute('aria-hidden','true');
  const caption=reportElement('span');
  caption.className='briefing-seller-caption';
  caption.append(name);
  const {signoff,review}=person;
  const previousLabel='Wpis z ostatniego dnia pracy'+(review.day?' · '+dateLabel(review.day):'');
  if (person.editable) {
    const awaitingToday=signoff.previousReady&&person.pendingToday;
 const state=signoff.completed?'Zatwierdzona':signoff.accepted?'Do zatwierdzenia'
      :signoff.previousReady?(awaitingToday?'Zgłoszenie w toku':'Plan na dziś')
      :review.status==='recorded'?'Sprawdź wykonanie':briefingReviewStates[review.status];
 const attention=awaitingToday||(!signoff.previousReady&&['missing','draft','pending'].includes(review.status));
    const badge=reportElement('span',state);
    badge.className='briefing-completed-badge';
    badge.dataset.complete=details.dataset.reviewComplete=String(signoff.completed);
    badge.dataset.tone=signoff.completed?'done':attention?'attention':'active';
    caption.append(badge);
  }
  summary.append(avatar,caption);
  details.append(summary);

  const canEdit=person.editable&&!previewTarget;
  if (person.editable) {
    const stage=signoff.accepted?3:signoff.previousReady?2:1;
    details.dataset.actionable=String(canEdit&&!signoff.completed&&
      (stage===1||!person.pendingToday));
    const workflow=reportElement('div');
    workflow.className='briefing-workflow';
    workflow.append(briefingStepper(stage,signoff.completed));

    let active;
    if (stage===1) {
      active=briefingReviewStep(person,report,canEdit);
    } else {
      const final=briefingStep(3,'Realizacja i prognoza miesiąca',signoff.completed?'Zatwierdzona':'Do sprawdzenia');
      let finish, dirtyGoals=false, dirtyForecast=false;
      const updateFinish=()=>{if (finish) finish.disabled=dirtyGoals||dirtyForecast;};
      if (stage===3) {
        final.append(briefingForecast(person,report,canEdit,dirty=>{
          dirtyForecast=dirty;
          updateFinish();
        }));
        if (signoff.completed) {
          final.append(reportElement('p','Odprawa została zapisana.'));
          const next=reportElement('button','Następna odprawa');
          next.type='button';
          next.className='secondary';
          next.dataset.briefingNext='';
          next.onclick=openNextBriefing;
          final.append(next);
        } else {
          if (canEdit) finish=briefingAction(final,'Zatwierdź prognozę i odprawę',person,report,
            {action:'complete',version:signoff.completionVersion},'Zatwierdzono odprawę · '+person.name);
        }
      }
      const today=briefingTodayStep(person,report,canEdit,dirty=>{
        dirtyGoals=dirty;
        updateFinish();
      });
      active=stage===2?today:final;
      const previous=briefingReviewStep(person,report,canEdit);
      workflow.append(active,briefingFold(previousLabel,previous));
      if (stage===3) workflow.append(briefingFold('Plan na dziś',today));
    }
    if (stage===1) workflow.append(active);
    active.classList.add('briefing-current-step');
    const heading=active.querySelector('h3');
    heading.tabIndex=-1;
    details.append(workflow);
  }
  if (!person.editable) details.append(
    briefingFold(previousLabel,briefingReviewStep(person,report,false)),
    briefingFold('Realizacja i prognoza miesiąca',briefingForecast(person,report,person.ownForecast&&!previewTarget)));
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
  const openTotals=new Set([...briefingResults.querySelectorAll('.briefing-salon-totals[open]')].map(row=>row.closest('article').dataset.salon));
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
    if (!report.salons.length) {
      const empty=reportElement('p','Brak przypisanych salonów do odprawy.');
      empty.className='briefing-empty';
      briefingResults.append(empty);
    }
    for (const salon of report.salons) {
      const card=reportElement('article');
      card.dataset.salon=salon.salon;
      const heading=reportElement('div');
      heading.className='briefing-salon-heading';
      const count=reportElement('span');
      count.className='briefing-salon-count';
      const icon=reportElement('span');
      icon.className='briefing-salon-icon';
      icon.innerHTML=panelIcon('building');
      heading.append(icon,reportElement('h2',salon.salon),count);
      const totals=reportElement('details');
      totals.className='briefing-salon-totals';
      totals.open=openTotals.has(salon.salon);
      totals.append(reportElement('summary','Wyniki i prognoza salonu'),
        briefingTable(['Wskaźnik','Wykonano','Plan','Jeszcze w tym miesiącu','Razem na koniec'],
          briefingSalesLabels.map((label,i)=>[label,salon.actual[i],salon.plan[i],
            salon.forecast[i]==null?null:salon.forecast[i]+(salon.missing[i]?' (częściowa)':''),
            salon.missing[i]?null:briefingEnd(salon.actual[i],salon.forecast[i])])));
      card.append(heading);
      if (!salon.people.length) card.append(reportElement('p','Brak handlowców do odprawy.'));
      for (const person of salon.people) card.append(renderBriefingSeller(person,report,open.has(String(person.id)),salon.salon));
      if (salon.people.length) card.append(totals);
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
  for (const card of briefingResults.querySelectorAll('article[data-salon]')) {
    const count=card.querySelector('.briefing-salon-count');
    const reviews=card.querySelectorAll('[data-review-complete]');
    const complete=card.querySelectorAll('[data-review-complete="true"]').length;
    count.hidden=!reviews.length;
    count.textContent=complete+' z '+reviews.length;
    count.setAttribute('aria-label','Zatwierdzone odprawy: '+count.textContent);
    if (card.hidden) continue;
    done+=complete;
    total+=reviews.length;
  }
  const box=briefingHost.querySelector('#briefing-progress');
  box.hidden=!total;
  box.querySelector('strong').textContent='Zatwierdzone odprawy · '+done+' z '+total;
  box.querySelector('#briefing-progress-note').textContent=done===total?'Wszystkie odprawy zatwierdzone.':'Pozostało do zatwierdzenia: '+(total-done);
  const progress=box.querySelector('progress');
  progress.max=total||1;
  progress.value=done;
  const hasActionable=Boolean(briefingResults.querySelector('article:not([hidden]) [data-actionable="true"]'));
  for (const button of briefingHost.querySelectorAll('[data-briefing-next]')) button.hidden=!hasActionable;
}

function filterBriefingSalons() {
  const selected=briefingSalon.value;
  for (const card of briefingResults.querySelectorAll('article[data-salon]')) card.hidden=Boolean(selected&&card.dataset.salon!==selected);
  updateBriefingProgress();
}

briefingSalon.onchange=filterBriefingSalons;
briefingHost.querySelector('#briefing-next').onclick=openNextBriefing;
briefingHost.querySelector('#briefing-refresh').onclick=()=>loadBriefingPanel();
briefingPdf.onclick=async()=>{
  if (!briefingReady||briefingDownloading) return;
  briefingDownloading=briefingPdf.disabled=true;
  briefingStatus.textContent='Przygotowywanie raportu PDF…';
  try {
    const query=new URLSearchParams({format:'pdf',role:data.role});
    const salon=briefingSalon.value;
    if (salon) query.set('salon',salon);
    if (previewTarget) query.set('podglad',previewTarget);
    const endpoint='/api/daily-briefing?'+query;
    const file=await requestManagementPdf(endpoint);
    if (briefingHost.hidden) return;
    showManagementPdf(file,endpoint,salon,'Raport odprawy');
    briefingStatus.textContent='';
  } catch(error) {
    briefingStatus.textContent=error.message;
  } finally {
    briefingDownloading=false;
    briefingPdf.disabled=!briefingReady;
  }
};
