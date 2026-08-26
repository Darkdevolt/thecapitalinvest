// ═══════════════════════════════════════
// LOADER, The Capital BRVM
// ═══════════════════════════════════════
// Le chargement principal des données appartient à main.js.
// Ce fichier conserve uniquement le patch différé PER, afin d'éviter une
// seconde définition concurrente de loadAll().
(function(){
  'use strict';

  if(window.__TC_LOADER_LOADED__) {
    console.log('[LOADER] Déjà chargé, skip.');
    return;
  }
  window.__TC_LOADER_LOADED__ = true;

  function loadDeferredFinancialsPatch(){
    if(document.getElementById('tc-financials-per-script')) return;
    var script=document.createElement('script');
    script.id='tc-financials-per-script';
    script.src='/app/js/views/financials-per.js?v=1';
    script.async=false;
    script.onload=function(){ console.log('[LOADER] Patch PER chargé'); };
    script.onerror=function(){ console.warn('[LOADER] Patch PER indisponible'); };
    (document.head||document.documentElement).appendChild(script);
  }

  if(document.readyState==='loading'){
    window.addEventListener('load',loadDeferredFinancialsPatch,{once:true});
  }else{
    loadDeferredFinancialsPatch();
  }
})();
