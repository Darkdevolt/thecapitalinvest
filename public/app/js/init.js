(function(){
  function loadScript(src, done){
    var script = document.createElement('script');
    script.src = src;
    script.onload = done;
    script.onerror = function(){ console.error('[INIT] Script impossible à charger:', src); done(); };
    document.head.appendChild(script);
  }

  function loadRuntimeLayers(done){
    loadScript('app/js/router-patch.js?v=2', function(){
      loadScript('app/js/views/portefeuille/portfolio-store.js?v=2', function(){
        loadScript('app/js/views/portefeuille/portfolio-crud-patch.js?v=1', done);
      });
    });
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

  function boot(){ loadRuntimeLayers(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
