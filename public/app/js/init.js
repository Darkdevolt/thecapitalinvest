// THE CAPITAL — Unified application bootstrap
(function () {
  'use strict';

  var started = false;

  function normalizeDocument() {
    // app.html used to contain <base target="_blank">. Remove it immediately,
    // before any application navigation can use it.
    document.querySelectorAll('base').forEach(function (base) { base.remove(); });
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href && href.charAt(0) !== '#' && !/^(https?:|mailto:|tel:|javascript:)/i.test(href)) {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
  }

  function loadScript(src, done) {
    var existing = document.querySelector('script[data-tc-runtime="' + src.replace(/"/g, '') + '"]');
    if (existing) { done(); return; }
    var script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.tcRuntime = src;
    script.onload = done;
    script.onerror = function () {
      console.error('[INIT] Script impossible à charger:', src);
      done();
    };
    document.head.appendChild(script);
  }

  function loadRuntimeLayers(done) {
    loadScript('app/js/views/portefeuille/portfolio-store.js?v=8', function () {
      loadScript('app/js/views/portefeuille/portfolio-crud-patch.js?v=7', function () {
        loadScript('app/js/views/user-data-patch.js?v=6', done);
      });
    });
  }

  function renderAfterData() {
    try {
      if (typeof window.renderCurrentView === 'function') window.renderCurrentView();
      else if (typeof window.parseHash === 'function') window.parseHash();
    } catch (e) {
      console.warn('[INIT] rendu après données:', e);
    }
  }

  function init() {
    if (started) return;
    started = true;
    normalizeDocument();
    console.log('[INIT] Démarrage The Capital — architecture unifiée');

    if (typeof window.initApp !== 'function') {
      console.error('[INIT] initApp manquant — main.js doit être chargé avant init.js');
      document.body.classList.remove('init-hidden');
      return;
    }

    try {
      window.initApp();
      console.log('[INIT] initApp lancé');
    } catch (e) {
      console.error('[INIT] initApp:', e);
    }

    if (typeof window.initUserDataLayer === 'function') {
      try { window.initUserDataLayer(); } catch (e) { console.warn('[INIT] user data:', e); }
    }

    if (window.marketsModule && typeof window.marketsModule.loadData === 'function') {
      try { window.marketsModule.loadData(); } catch (e) { console.warn('[INIT] marketsModule:', e); }
    }

    // The shell must become visible even if a secondary module fails.
    document.body.classList.remove('init-hidden');
    renderAfterData();
  }

  function boot() {
    normalizeDocument();
    loadRuntimeLayers(init);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
