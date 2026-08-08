// THE CAPITAL — Application bootstrap
// Runtime unique : router + Supabase portfolio + authenticated user data.
(function () {
  'use strict';

  function loadScript(src, done) {
    var script = document.createElement('script');
    script.src = src;
    script.onload = done;
    script.onerror = function () {
      console.error('[INIT] Script impossible à charger:', src);
      done();
    };
    document.head.appendChild(script);
  }

  function loadRuntimeLayers(done) {
    // router.js est la seule couche de navigation.
    // Aucun router-patch / ancien adaptateur n'est chargé.
    loadScript('app/js/router.js?v=4', function () {
      loadScript('app/js/views/portefeuille/portfolio-store.js?v=4', function () {
        loadScript('app/js/views/portefeuille/portfolio-crud-patch.js?v=3', function () {
          loadScript('app/js/views/user-data-patch.js?v=2', done);
        });
      });
    });
  }

  function init() {
    console.log('[INIT] Démarrage The Capital — architecture unifiée');

    if (typeof window.initApp === 'function') {
      try {
        window.initApp();
        console.log('[INIT] initApp lancé');

        if (typeof window.initUserDataLayer === 'function') {
          window.initUserDataLayer();
        }

        if (window.marketsModule && typeof window.marketsModule.loadData === 'function') {
          try { window.marketsModule.loadData(); } catch (e) {
            console.warn('[INIT] marketsModule:', e);
          }
        }
      } catch (e) {
        console.error('[INIT] initApp:', e);
      }
    } else {
      console.error('[INIT] initApp manquant');
    }
  }

  function boot() {
    loadRuntimeLayers(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
