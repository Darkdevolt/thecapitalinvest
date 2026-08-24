// INIT, Unified application bootstrap
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
      var session = JSON.parse(raw);
      if (!session || !session.access_token || !tokenIsValid(session.access_token)) return null;
      return session;
    } catch (e) {
      return null;
    }
  }

  function requireAuth() {
    if (window.tcSession && window.tcSession.access_token) return true;
    var session = getSession();
    if (session) {
      window.tcSession = session;
      window.tcAccessToken = session.access_token;
      return true;
    }
    var current = location.pathname.split('/').pop() || 'app.html';
    var redirect = encodeURIComponent(current + location.search + location.hash);
    location.replace('login.html?redirect=' + redirect);
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
    var existing = document.querySelector('script[data-tc-runtime="' + src.replace(/"/g, '') + '"]');
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

  function loadStyle(href) {
    if (document.querySelector('link[data-tc-runtime-style="' + href.replace(/"/g, '') + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.tcRuntimeStyle = href;
    document.head.appendChild(link);
  }

  function loadRuntimeLayers() {
    // Navigation is a core layer: it must be available before users start moving between views.
    loadScript('app/js/navigation-guard.js?v=1');

    // Dashboard market-data/UI patch: loaded dynamically so the core HTML and
    // existing views remain untouched while the fixes are independently cache-busted.
    loadScript('app/js/views/overview-fixes.js?v=1');

    // The technical experience is independent: it must never wait for
    // portfolio/fundamental enhancements before becoming interactive.
    loadStyle('app/css/technique-experience.css?v=2');
    // experience.js est desormais declare dans app.html, avec les autres
    // modules de l'analyse technique et dans un ordre fixe. Le charger aussi
    // ici produisait une seconde evaluation sous une URL differente (?v=3
    // contre aucune version cote navigation.js), et donc un second
    // enveloppement de atLoadTicker.

    // Optional enhancements remain non-blocking for the application core.
    loadScript('app/js/views/portefeuille/portfolio-store.js?v=9', function () {
      loadScript('app/js/views/portefeuille/portfolio-crud-patch.js?v=8', function () {
        loadScript('app/js/views/user-data-patch.js?v=7', function () {
          loadScript('app/js/views/fundamental-ratios.js?v=1', function () {
            renderAfterData();
          });
        });
      });
    });
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

  function ensureSuiviNavigation() {
    var href = '/app/suivi.html';
    var sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.querySelector('[data-tc-suivi]')) {
      var sections = sidebar.querySelectorAll('.sidebar-section');
      var gestionSection = null;
      sections.forEach(function (section) {
        if (String(section.textContent || '').trim() === 'Gestion') gestionSection = section;
      });
      if (gestionSection) {
        var item = document.createElement('a');
        item.setAttribute('data-tc-suivi', '1');
        item.href = href;
        item.target = '_self';
        item.className = 'nav-item';
        item.style.textDecoration = 'none';
        item.innerHTML = '<span class="icon">☆</span> Suivi';
        gestionSection.insertAdjacentElement('afterend', item);
      }
    }

    var menu = document.getElementById('menu-dd-gestion');
    if (menu && !menu.querySelector('[data-tc-suivi]')) {
      var separator = document.createElement('div');
      separator.className = 'nav-dropdown-separator';
      var desktopItem = document.createElement('a');
      desktopItem.setAttribute('data-tc-suivi', '1');
      desktopItem.href = href;
      desktopItem.target = '_self';
      desktopItem.className = 'nav-dropdown-item';
      desktopItem.style.textDecoration = 'none';
      desktopItem.innerHTML = '<span class="icon">☆</span><div><div>Suivi</div><div class="item-desc">Valeurs surveillées & monitoring</div></div>';
      menu.appendChild(separator);
      menu.appendChild(desktopItem);
    }
  }

  function init() {
    if (started) return;
    started = true;
    if (!requireAuth()) return;
    normalizeDocument();
    console.log('[INIT] Session authentifiée, démarrage The Capital');

    // CORE: always start the application before optional enhancements.
    if (typeof window.initApp !== 'function') {
      console.error('[INIT] initApp manquant, main.js doit être chargé avant init.js');
      document.body.classList.remove('init-hidden');
      return;
    }

    try { window.initApp(); } catch (e) { console.error('[INIT] initApp:', e); }
    if (typeof window.initSidebar === 'function') {
      try { window.initSidebar(); } catch (e) { console.warn('[INIT] sidebar:', e); }
    }

    ensureSuiviNavigation();
    setTimeout(ensureSuiviNavigation, 0);

    if (typeof window.initUserDataLayer === 'function') {
      try { window.initUserDataLayer(); } catch (e) { console.warn('[INIT] user data:', e); }
    }
    if (window.marketsModule && typeof window.marketsModule.loadData === 'function') {
      try { window.marketsModule.loadData(); } catch (e) { console.warn('[INIT] marketsModule:', e); }
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
