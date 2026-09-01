// INIT — Unified application bootstrap
(function () {
  'use strict';
  var started = false;
  var SESSION_KEY = 'tc_session';

  function decodeBase64Url(value) {
    var input = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    while (input.length % 4) input += '=';
    return atob(input);
  }

  function tokenIsValid(token) {
    try {
      var parts = String(token || '').split('.');
      if (parts.length !== 3) return false;
      var payload = JSON.parse(decodeBase64Url(parts[1]));
      return !!payload.exp && payload.exp * 1000 > Date.now();
    } catch (e) {
      return false;
    }
  }

  function getSession() {
    if (window.tcSession && window.tcSession.access_token) return window.tcSession;
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var session = (parsed && parsed.data && parsed.data.session) || (parsed && parsed.session) || parsed;
      if (!session || !session.access_token || !tokenIsValid(session.access_token)) return null;
      return session;
    } catch (e) {
      return null;
    }
  }

  function requireAuth() {
    var session = getSession();
    if (session && session.access_token) {
      window.tcSession = session;
      window.tcAccessToken = session.access_token;
      return true;
    }
    var target = location.pathname + location.search + location.hash;
    location.replace('/login.html?redirect=' + encodeURIComponent(target));
    return false;
  }

  function normalizeDocument() {
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
    var selector = 'script[data-tc-runtime="' + src.replace(/"/g, '') + '"]';
    var existing = document.querySelector(selector);
    if (existing) {
      if (typeof done === 'function') done();
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.tcRuntime = src;
    script.onload = function () { if (typeof done === 'function') done(); };
    script.onerror = function () {
      console.error('[INIT] Script impossible à charger:', src);
      if (typeof done === 'function') done();
    };
    document.head.appendChild(script);
  }

  function loadRuntimeLayers() {
    loadScript('/app/js/navigation-guard.js?v=1');
    loadScript('/app/js/views/overview-fixes.js?v=1');
    loadScript('/app/js/views/brvm-market-hours.js?v=20260827.3', function () {
      loadScript('/app/js/market-ux.js?v=20260827.2');
    });
    loadScript('/app/js/views/technique/data-bridge.js?v=20260826');
    loadScript('/app/js/views/portefeuille/portfolio-store.js?v=9', function () {
      loadScript('/app/js/views/portefeuille/portfolio-crud-patch.js?v=8', function () {
        loadScript('/app/js/views/user-data-patch.js?v=7', function () {
          loadScript('/app/js/views/fundamental-ratios.js?v=1', function () {
            renderAfterData();
          });
        });
      });
    });
  }

  function loadIntegratedSuivi() {
    if (window.__TC_SUIVI_LOADER__) return;
    window.__TC_SUIVI_LOADER__ = true;
    function load(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    load('/app/js/views/suivi-integrated.js?v=20260827')
      .then(function () { return load('/app/js/views/suivi-metrics-fix.js?v=20260827'); })
      .catch(function (err) { console.error('[SUIVI] Chargement du module intégré impossible', err); });
  }

  function removeObsoleteFormation() {
    document.querySelectorAll('[onclick*="formation"],[href*="#formation"],#nav-formation,#view-formation').forEach(function (node) { node.remove(); });
  }

  function ensureGuideNavigation() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.querySelectorAll('[data-tc-guide], [data-tc-guide-top]').forEach(function (node) { node.remove(); });
    var right = document.querySelector('.topnav-right');
    if (right) right.querySelectorAll('[data-tc-guide-top], [data-open-guide], [data-guide]').forEach(function (node) { node.remove(); });
    if (sidebar && !sidebar.querySelector('[data-tc-guide]')) {
      var section = document.createElement('div');
      section.className = 'sidebar-section tc-guide-section';
      section.textContent = 'Découvrir';
      var item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('data-tc-guide', '1');
      item.setAttribute('data-open-guide', '1');
      item.className = 'nav-item tc-guide-nav';
      item.innerHTML = '<span class="icon">✦</span><span>Guide The Capital</span>';
      sidebar.appendChild(section);
      sidebar.appendChild(item);
    }
  }

  function removeDuplicateSuiviNavigation() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.querySelectorAll('[data-tc-suivi]').forEach(function (node) { node.remove(); });
  }

  function renderAfterData() {
    try {
      if (typeof window.renderCurrentView === 'function') window.renderCurrentView();
      else if (typeof window.parseHash === 'function') window.parseHash();
      if (window.tcNavigation && typeof window.tcNavigation.render === 'function') window.tcNavigation.render();
    } catch (e) {
      console.warn('[INIT] rendu après données:', e);
    }
  }

  function ensureSuiviNavigation() { removeDuplicateSuiviNavigation(); }

  function safeInitApp() {
    if (typeof window.initApp !== 'function') {
      console.error('[INIT] initApp manquant, main.js doit être chargé avant init.js');
      document.body.classList.remove('init-hidden');
      return false;
    }
    try {
      var result = window.initApp();
      if (result && typeof result.catch === 'function') result.catch(function (e) { console.error('[INIT] initApp:', e); });
      return true;
    } catch (e) {
      console.error('[INIT] initApp:', e);
      document.body.classList.remove('init-hidden');
      return false;
    }
  }

  function init() {
    if (started) return;
    started = true;
    if (!requireAuth()) return;

    normalizeDocument();
    console.log('[INIT] Session authentifiée, démarrage The Capital');

    // Ne jamais bloquer l'affichage du dashboard sur un bootstrap secondaire.
    // main.js lance son chargement de données indépendamment et gère ses erreurs.
    safeInitApp();

    removeObsoleteFormation();
    ensureSuiviNavigation();
    ensureGuideNavigation();
    setTimeout(function () {
      removeObsoleteFormation();
      ensureSuiviNavigation();
      ensureGuideNavigation();
    }, 0);

    loadIntegratedSuivi();
    if (typeof window.initUserDataLayer === 'function') {
      try { window.initUserDataLayer(); } catch (e) { console.warn('[INIT] user data:', e); }
    }
    if (window.marketsModule && typeof window.marketsModule.loadData === 'function') {
      try {
        var marketPromise = window.marketsModule.loadData();
        if (marketPromise && typeof marketPromise.catch === 'function') {
          marketPromise.catch(function (e) { console.warn('[INIT] marketsModule:', e); });
        }
      } catch (e) { console.warn('[INIT] marketsModule:', e); }
    }

    document.body.classList.remove('init-hidden');
    renderAfterData();
    setTimeout(loadRuntimeLayers, 0);
  }

  function boot() {
    normalizeDocument();
    if (!requireAuth()) return;
    init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
