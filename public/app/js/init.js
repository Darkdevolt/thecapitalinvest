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
    } catch (e) { return false; }
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
    } catch (e) { return null; }
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
    if (existing) { if (typeof done === 'function') done(); return; }
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

  /*
   * Startup optimizer.
   * main.js conserve son orchestration historique, mais les datasets lourds
   * ne doivent jamais bloquer le premier rendu. Les endpoints secondaires
   * sont servis depuis le cache s'il existe, sinon ils retournent immédiatement
   * un tableau vide et sont chargés en arrière-plan après le premier paint.
   */
  function installStartupOptimizer() {
    if (window.__TC_STARTUP_OPTIMIZER__) return;
    if (typeof window.apiGet !== 'function') return;

    var originalApiGet = window.apiGet;
    var background = new Map();
    var heavy = /^\/marche\?type=(financials|dividendes|historique|indices_historique|coupons)(?:&|$)|^\/boc(?:\?|$)/;

    function unwrap(value) {
      if (Array.isArray(value)) return value;
      if (value && Array.isArray(value.data)) return value.data;
      if (value && Array.isArray(value.rows)) return value.rows;
      return [];
    }

    function publish(endpoint, value) {
      var data = unwrap(value);
      if (endpoint.indexOf('indices_historique') !== -1) {
        window.allIndicesHistory = data;
        if (data.length) window.allIndices = data;
      } else if (endpoint.indexOf('financials') !== -1) {
        window.allFinancials = data;
      } else if (endpoint.indexOf('dividendes') !== -1) {
        window.allDividendes = data;
      } else if (endpoint.indexOf('historique') !== -1) {
        window.allCoursHistory = data;
      } else if (endpoint.indexOf('coupons') !== -1) {
        window.allCoupons = data;
      } else if (/^\/boc(?:\?|$)/.test(endpoint)) {
        window.allBoc = data;
      }
      try {
        window.dispatchEvent(new CustomEvent('tc:dataready', { detail: { phase: 'background', endpoint: endpoint } }));
      } catch (e) {}
      if (typeof window.renderCurrentView === 'function') {
        try { window.renderCurrentView(); } catch (e) { console.warn('[INIT] background render:', e); }
      }
    }

    function schedule(endpoint) {
      if (background.has(endpoint)) return background.get(endpoint);
      var delay = window.requestIdleCallback ? 400 : 1200;
      var promise = new Promise(function (resolve) {
        var run = function () {
          originalApiGet(endpoint).then(function (value) {
            publish(endpoint, value);
            resolve(value);
          }).catch(function (error) {
            console.warn('[INIT] background data:', endpoint, error);
            resolve([]);
          }).finally(function () {
            background.delete(endpoint);
          });
        };
        if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 2500 });
        else setTimeout(run, delay);
      });
      background.set(endpoint, promise);
      return promise;
    }

    window.apiGet = function (endpoint, options) {
      if (typeof endpoint !== 'string' || !heavy.test(endpoint)) {
        return originalApiGet(endpoint, options);
      }
      var cached = null;
      try { cached = window.cacheManager && window.cacheManager.getCache(endpoint); } catch (e) {}
      if (cached !== null && cached !== undefined) {
        schedule(endpoint);
        return Promise.resolve(cached);
      }
      schedule(endpoint);
      return Promise.resolve([]);
    };

    window.__TC_STARTUP_DATA_GATE__ = true;
    window.__TC_STARTUP_OPTIMIZER__ = true;
    console.log('[INIT] Startup optimizer activé');
  }

  /* app.html charge déjà le routeur, les vues et navigation-guard.
     Ne jamais les recharger : un double chargement crée des wrappers et
     plusieurs rendus concurrents du dashboard. */
  function loadRuntimeLayers() {
    loadScript('/app/js/views/overview-fixes.js?v=2');
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
    } catch (e) { console.warn('[INIT] rendu après données:', e); }
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
    installStartupOptimizer();
    console.log('[INIT] Session authentifiée, démarrage The Capital');
    safeInitApp();

    removeObsoleteFormation();
    ensureSuiviNavigation();
    ensureGuideNavigation();
    setTimeout(function () {
      removeObsoleteFormation();
      ensureSuiviNavigation();
      ensureGuideNavigation();
    }, 0);

    document.body.classList.remove('init-hidden');

    /* Les modules secondaires sont différés et ne relancent plus le bootstrap. */
    setTimeout(function () {
      loadIntegratedSuivi();
      if (typeof window.initUserDataLayer === 'function') {
        try { window.initUserDataLayer(); } catch (e) { console.warn('[INIT] user data:', e); }
      }
      setTimeout(loadRuntimeLayers, 250);
    }, 1200);
  }

  function boot() {
    normalizeDocument();
    if (!requireAuth()) return;
    init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
