/* THE CAPITAL — dashboard runtime compatibility layer
 *
 * This module must never replace the canonical Overview renderer.
 * overview.js owns the dashboard presentation and data rendering; this file
 * only reconciles late-loaded data and runs the dashboard enrichment module.
 * No fake market values are generated here.
 */
(function(w){
  'use strict';
  if(w.__TC_OVERVIEW_RUNTIME_FIX__) return;
  w.__TC_OVERVIEW_RUNTIME_FIX__=true;

  var renderTimer=0;
  var wrappedRenderer=null;
  var insightRunning=false;
  var insightPending=false;

  function runInsights(){
    if(!w.TCOverviewInsights || typeof w.TCOverviewInsights.rendre!=='function') return;
    if(insightRunning){ insightPending=true; return; }
    insightRunning=true;
    insightPending=false;
    Promise.resolve(w.TCOverviewInsights.rendre())
      .catch(function(error){ console.warn('[OVERVIEW] Enrichissement:',error); })
      .finally(function(){
        insightRunning=false;
        if(insightPending) runInsights();
      });
  }

  function installRenderer(){
    if(typeof w.renderOverview!=='function') return false;
    if(w.renderOverview.__tcCanonicalWrapper) return true;

    var original=w.renderOverview;
    var wrapped=function(){
      var result;
      try {
        result=original.apply(this,arguments);
      } finally {
        runInsights();
      }
      return result;
    };
    wrapped.__tcCanonicalWrapper=true;
    wrapped.__tcOriginal=original;
    w.renderOverview=wrapped;
    wrappedRenderer=wrapped;
    return true;
  }

  function schedule(){
    clearTimeout(renderTimer);
    renderTimer=setTimeout(function(){
      installRenderer();
      var view=document.getElementById('view-overview');
      if(wrappedRenderer && view && view.classList.contains('active')){
        try { wrappedRenderer(); } catch(error) { console.error('[OVERVIEW] Rendu:',error); }
      }
    },40);
  }

  w.setMoversTab=w.setMoversTab||function(tab){
    w.__TC_MOVERS_TAB__=tab||'gainers';
    if(typeof w.renderTopMovers==='function'){
      try{ w.renderTopMovers(); }catch(error){ console.warn('[OVERVIEW] Top movers:',error); }
    }
  };

  w.addEventListener('tc:dataready',schedule);
  w.addEventListener('tc:header-ready',schedule);

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',schedule,{once:true});
  }else{
    schedule();
  }

  var attempts=0;
  var timer=setInterval(function(){
    attempts++;
    if(installRenderer() || attempts>=80) clearInterval(timer);
  },100);
})(window);