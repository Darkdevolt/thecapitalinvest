// THE CAPITAL — renderer dispatch reconciliation
// Front-end only: keeps the canonical router render map authoritative.
(function(){
  'use strict';
  if(window.__TC_RENDER_DISPATCH_FIX__) return;
  window.__TC_RENDER_DISPATCH_FIX__=true;

  function patch(){
    if(typeof window.renderCurrentView!=='function' || !window.renderMap) return false;
    if(window.__TC_RENDER_DISPATCH_PATCHED__) return true;

    const original=window.renderCurrentView;
    window.renderCurrentView=function(){
      const active=document.querySelector('.view.active');
      if(!active) return;
      const id=active.id||'';
      if(!id.startsWith('view-')) return original();
      const viewName=id.slice(5);
      const mapped=window.renderMap && window.renderMap[viewName];
      const renderer=mapped && window[mapped];
      if(typeof renderer!=='function') return original();
      if(viewName==='analyse-technique' && typeof window.ensureTechnicalReady==='function'){
        try{window.ensureTechnicalReady();}catch(e){console.warn('[RENDER DISPATCH] technique:',e);}
      }
      try{return renderer();}
      catch(error){console.error('[RENDER DISPATCH] '+mapped+':',error);}
    };
    window.__TC_RENDER_DISPATCH_PATCHED__=true;
    return true;
  }

  if(!patch()){
    let tries=0;
    const timer=setInterval(function(){
      if(patch() || ++tries>80) clearInterval(timer);
    },50);
  }
})();
