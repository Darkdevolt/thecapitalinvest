(function(){
  function loadPortfolioStore(next){
    if (window.portfolioStore || window.__TC_PORTFOLIO_STORE_LOADING__) return next();
    window.__TC_PORTFOLIO_STORE_LOADING__ = true;
    var script = document.createElement('script');
    script.src = 'app/js/views/portefeuille/portfolio-store.js?v=1';
    script.onload = next;
    script.onerror = function(){ console.error('[INIT] portfolio-store impossible à charger'); next(); };
    document.head.appendChild(script);
  }

  function init(){
    console.log('[INIT] Démarrage...');
    if (typeof window.initApp === 'function') {
      try {
        window.initApp();
        console.log('[INIT] initApp lancé');
        if (window.marketsModule && typeof window.marketsModule.loadData === 'function') {
          try { window.marketsModule.loadData(); } catch(e) {}
        }
      } catch(e) {
        console.error('[INIT] initApp:', e);
      }
    } else {
      console.error('[INIT] initApp manquant');
    }
  }

  function boot(){ loadPortfolioStore(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
