// THE CAPITAL — Application bootstrap
// Runtime unique : router + Supabase portfolio + authenticated user data.
(function () {
  'use strict';

  function normalizeDocument() {
    // L'ancien <base target="_blank"> cassait la navigation interne de la SPA.
    var base = document.querySelector('base');
    if (base) base.remove();

    // Les liens internes restent dans l'application.
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href && href.charAt(0) !== '#' && !/^(https?:|mailto:|tel:|javascript:)/i.test(href)) {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
  }

  function loadScript(src, done) {
    var script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = done;
    script.onerror = function () {
      console.error('[INIT] Script impossible à charger:', src);
      done();
    };
    document.head.appendChild(script);
  }

  function loadRuntimeLayers(done) {
    // Une seule couche de navigation et les stores Supabase modernes.
    loadScript('app/js/router.js?v=6', function () {
      loadScript('app/js/views/portefeuille/portfolio-store.js?v=6', function () {
        loadScript('app/js/views/portefeuille/portfolio-crud-patch.js?v=5', function () {
          loadScript('app/js/views/user-data-patch.js?v=4', done);
        });
      });
    });
  }

  function init() {
    normalizeDocument();
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
    normalizeDocument();
    loadRuntimeLayers(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
