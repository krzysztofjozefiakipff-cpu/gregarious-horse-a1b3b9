function scrollToOpenedDetails(details,summary=details.querySelector(':scope > summary')) {
  requestAnimationFrame(()=>{
    if (!summary?.isConnected||!details.open) return;
    const start=details.hasAttribute('data-scroll-to-card')?details.parentElement:summary;
    start.scrollIntoView({block:'start'});
  });
}

document.addEventListener('click',event=>{
  const summary=event.target.closest('details:not(#account-menu) > summary');
  if (!summary||event.defaultPrevented) return;
  if (event.target.closest('a, button, input, select, textarea, label')) return;
  const details=summary.parentElement;
  if (!details.open) scrollToOpenedDetails(details,summary);
});

function panelNavigation(render) {
  const positions=new Map();
  const historyKey='panelRoute';
  let entry=history.state?.[historyKey]??crypto.randomUUID();
  let activeUrl=location.href;
  let position=history.state?.panelScroll??0;
  history.scrollRestoration='manual';

  function savePosition() {
    positions.set(entry,window.scrollY);
    history.replaceState({...history.state,[historyKey]:entry,panelScroll:window.scrollY},'');
  }

  function showRoute(state) {
    entry=state?.[historyKey]??crypto.randomUUID();
    activeUrl=location.href;
    position=positions.get(entry)??state?.panelScroll??0;
    render();
    window.scrollTo(0,position);
  }

  function go(hash,context={}) {
    const url=new URL(location.href);
    url.hash=hash;
    if (url.href===location.href&&!Object.keys(context).length) return;
    savePosition();
    const state={...history.state,...context,[historyKey]:crypto.randomUUID(),panelScroll:0};
    history.pushState(state,'',url);
    showRoute(state);
  }

  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-panel-route]');
    if (!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
    const url=new URL(link.href);
    if (url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search) return;
    event.preventDefault();
    go(url.hash);
  });

  window.addEventListener('scroll',()=>positions.set(entry,window.scrollY),{passive:true});
  window.addEventListener('popstate',event=>showRoute(event.state));
  window.addEventListener('hashchange',()=>{
    if (activeUrl!==location.href) showRoute(history.state);
  });
  window.addEventListener('pagehide',savePosition);
  history.replaceState({...history.state,[historyKey]:entry},'');

  return {
    go,
    restoreInitialPosition(anchor) {
      if (history.state?.panelScroll!==undefined) window.scrollTo(0,position);
      else if (anchor) document.getElementById(anchor)?.scrollIntoView();
    }
  };
}

const mobileTabs={
  seller:[['dzisiaj','Dzisiaj','calendar'],['plan','Wyniki','bars'],['kalendarz-pracy','Kalendarz','clock']],
  manager:[['odprawa-dzienna','Dzisiaj','calendar'],['wykonanie','Wyniki','bars'],['zespol','Zespół','people']],
  group:[['wykonanie','Dzisiaj','building'],['plany-salonow','Plany','calendar'],['raporty','Raporty','bars']],
  admin:[['konta-uzytkownikow','Użytkownicy','people'],['salony','Salony','building'],['grupy','Grupy','bars']]
};
const panelIcons={
  calendar:'<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M8 4v4m8-4v4"/>',
  bars:'<path d="M5 19h14M8 16v-4m4 4V8m4 8V5"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  people:'<circle cx="10" cy="8" r="3"/><path d="M4 19v-1a6 6 0 0 1 12 0v1m2-12a3 3 0 0 1 0 6m0 2a4 4 0 0 1 2 4"/>',
  building:'<rect x="5" y="5" width="14" height="15" rx="1"/><path d="M9 9h1m4 0h1m-6 4h1m4 0h1m-4 7v-3h2v3"/>',
  clipboard:'<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2m-6 5h6m-6 4h6m-6 4h3"/>',
  book:'<path d="M12 20c-2-2-5-2.5-9-2V5c4-.5 7 0 9 2 2-2 5-2.5 9-2v13c-4-.5-7 0-9 2V7"/>',
  chat:'<path d="M20 11a8 8 0 0 1-8 8H5l1.5-3A8 8 0 1 1 20 11Z"/><path d="M8 11h8m-8 3h5"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  report:'<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  add:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12h8m-4-4v8"/>',
  settings:'<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="11" cy="17" r="2" fill="currentColor"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="M5.5 15c.5-2 4.5-2 5 0M13 10h5m-5 4h5"/>',
  heart:'<path d="M12 20 4.5 12.5a4.5 4.5 0 0 1 6.4-6.4L12 7.2l1.1-1.1a4.5 4.5 0 0 1 6.4 6.4Z"/>',
  eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  more:'<path d="M6 12h.01m6 0h.01m6 0h.01" stroke-width="3"/>'
};

function panelIcon(name) {
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+panelIcons[name]+'</svg>';
}

function renderPanelTabs(nav,role,active,hrefForRoute) {
  const tabs=[...mobileTabs[role],['wiecej','Więcej','more']];
  if (nav.dataset.role!==role) {
    nav.dataset.role=role;
    nav.replaceChildren(...tabs.map(([route,label,icon])=>{
      const link=document.createElement('a');
      link.dataset.route=route;
      if (!hrefForRoute) link.dataset.panelRoute='';
      link.href=hrefForRoute?hrefForRoute(route):'#'+route;
      link.textContent=label;
      link.insertAdjacentHTML('afterbegin',panelIcon(icon));
      return link;
    }));
  }
  const current=tabs.some(([route])=>route===active)?active:'wiecej';
  for (const link of nav.children) {
    if (link.dataset.route===current) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  nav.hidden=false;
}

const mobileNumberEntry=matchMedia('(max-width:1050px)');
let numberEntryId=0;

function addNumberControls(input,label) {
  const field=document.createElement('span');
  field.className='number-entry';
  const labelElement=input.closest('label');
  if (labelElement) {
    const group=document.createElement('div');
    group.className='number-entry-labeled';
    input.id||='number-entry-'+ ++numberEntryId;
    labelElement.htmlFor=input.id;
    labelElement.replaceWith(group);
    group.append(labelElement,field);
  } else input.replaceWith(field);
  input.inputMode='numeric';
  input.enterKeyHint='next';
  const buttonFor=delta=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=delta<0?'−1':'+1';
    button.setAttribute('aria-label',(delta<0?'Odejmij jedno':'Dodaj jedno')+' · '+label);
    button.onclick=()=>{
      if (input.readOnly||input.disabled||!(input.validity.valid||input.validity.valueMissing)) return;
      const current=input.valueAsNumber||0;
      const next=current+delta;
      if (next<Number(input.min||0)||next>Number(input.max||Number.MAX_SAFE_INTEGER)) return;
      input.value=String(next);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    };
    return button;
  };
  field.append(buttonFor(-1),input,buttonFor(1));
}

function addNumberControlsIn(host) {
  for (const input of host.querySelectorAll('input[type="number"]')) {
    if (input.readOnly||input.disabled||input.closest('.number-entry')) continue;
    addNumberControls(input,input.getAttribute('aria-label')||input.closest('label')?.textContent.trim()||'Wartość');
  }
}

document.addEventListener('keydown',event=>{
  const input=event.target;
  if (event.defaultPrevented||event.key!=='Enter'||event.isComposing||!mobileNumberEntry.matches||
      input.type!=='number'||!input.closest('.number-entry')||!input.form) return;
  event.preventDefault();
  if (!input.reportValidity()) return;
  const fields=[...input.form.querySelectorAll('.number-entry input:not(:disabled):not([readonly])')]
    .filter(field=>field.checkVisibility?.()??Boolean(field.getClientRects().length));
  const next=fields[fields.indexOf(input)+1];
  const submit=[...input.form.elements].find(field=>field.type==='submit'&&!field.disabled&&(field.checkVisibility?.()??Boolean(field.getClientRects().length)));
  (next??submit)?.focus();
});

function addMobileEntryPicker(host,panels,labels,caption='Źródło kontaktu',onSelect) {
  const button=document.createElement('button');
  button.type='button';
  button.className='secondary mobile-entry-picker';
  button.setAttribute('aria-haspopup','dialog');
  const subtitle=document.createElement('span');
  subtitle.textContent=caption;
  const name=document.createElement('strong');
  button.append(subtitle,name);

  const dialog=document.createElement('dialog');
  dialog.className='mobile-entry-dialog';
  dialog.setAttribute('aria-label',caption);
  const heading=document.createElement('div');
  heading.className='mobile-entry-dialog-heading';
  const title=document.createElement('strong');
  title.textContent=caption;
  const close=document.createElement('button');
  close.type='button';
  close.className='secondary';
  close.textContent='Zamknij';
  close.onclick=()=>dialog.close();
  heading.append(title,close);
  const options=document.createElement('div');
  options.className='mobile-entry-options';
  let active=0;
  const select=index=>{
    active=index;
    name.textContent=labels[index];
    panels.forEach((panel,i)=>{
      panel.classList.toggle('mobile-entry-active',i===index);
      if (i===index&&panel.tagName==='DETAILS') panel.open=true;
    });
    [...options.children].forEach((option,i)=>option.setAttribute('aria-pressed',String(i===index)));
  };
  labels.forEach((label,index)=>{
    const option=document.createElement('button');
    option.type='button';
    option.className='secondary';
    option.textContent=label;
    option.onclick=()=>{
      select(index);
      dialog.close();
      onSelect?.(index);
      if (panels[index].matches('details[name]')) scrollToOpenedDetails(panels[index],button);
    };
    options.append(option);
  });
  dialog.append(heading,options);
  button.onclick=()=>{
    dialog.showModal();
    options.children[active].focus();
  };
  host.prepend(button,dialog);
  panels.forEach(panel=>panel.classList.add('mobile-entry-panel'));
  host.addEventListener('invalid',event=>{
    if (!mobileNumberEntry.matches||event.target!==host.querySelector('input:invalid')) return;
    const index=panels.findIndex(panel=>panel.contains(event.target));
    if (index>=0) select(index);
  },true);
  select(0);
  return select;
}
