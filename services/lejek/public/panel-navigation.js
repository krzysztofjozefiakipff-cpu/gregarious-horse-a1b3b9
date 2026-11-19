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
