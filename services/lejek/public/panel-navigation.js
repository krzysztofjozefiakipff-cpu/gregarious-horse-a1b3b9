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
  manager:[['odprawa-dzienna','Odprawa','calendar'],['wykonanie','Wyniki','bars'],['zespol','Zespół','people']],
  group:[['wykonanie','Salony','building'],['plany-salonow','Plany','calendar'],['raporty','Raporty','bars']],
  admin:[['konta-uzytkownikow','Użytkownicy','people'],['salony','Salony','building'],['grupy','Grupy','bars']]
};
const mobileIcons={
  calendar:'<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M8 4v4m8-4v4"/>',
  bars:'<path d="M5 19h14M8 16v-4m4 4V8m4 8V5"/>',
  clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  people:'<circle cx="10" cy="8" r="3"/><path d="M4 19v-1a6 6 0 0 1 12 0v1m2-12a3 3 0 0 1 0 6m0 2a4 4 0 0 1 2 4"/>',
  building:'<rect x="5" y="5" width="14" height="15" rx="1"/><path d="M9 9h1m4 0h1m-6 4h1m4 0h1m-4 7v-3h2v3"/>',
  more:'<path d="M6 12h.01m6 0h.01m6 0h.01" stroke-width="3"/>'
};

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
      link.insertAdjacentHTML('afterbegin','<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+mobileIcons[icon]+'</svg>');
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
