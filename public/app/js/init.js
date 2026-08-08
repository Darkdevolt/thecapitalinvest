(function(){
  function init(){
    console.log('[INIT] Démarrage...');
    // CORRECTION: on appelle directement initApp() (qui gère déjà loadAll() en interne,
    // + le routing + les events). On n'appelle plus loadAll() séparément ici,
    // ce qui évite le double chargement (loadAll x2/x3) et les requêtes annulées.
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
