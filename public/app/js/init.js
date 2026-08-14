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

  // Navigation globale : les boutons HTML appellent directement ces fonctions.
  // On les expose ici, après le chargement des couches UI, afin d'éviter les
  // boutons Marché/Analyse/Gestion inertes lorsque leur ancien handler manque.
  window.closeDropdowns = function () {
    document.querySelectorAll('.nav-dropdown.open').forEach(function (el) { el.classList.remove('open'); });
    document.querySelectorAll('.nav-dropdown-menu.open').forEach(function (el) { el.classList.remove('open'); });
    document.querySelectorAll('.nav-dropdown-btn.active').forEach(function (el) { el.classList.remove('active'); });
  };

  window.toggleDropdown = function (id) {
    var box = document.getElementById(id);
    if (!box) return false;
    var wasOpen = box.classList.contains('open');
    window.closeDropdowns();
    if (!wasOpen) {
      box.classList.add('open');
      var menu = box.querySelector('.nav-dropdown-menu');
      var btn = box.querySelector('.nav-dropdown-btn');
      if (menu) menu.classList.add('open');
      if (btn) btn.classList.add('active');
    }
    return !wasOpen;
  };

  var NAV_VIEWS = ['overview','titres','marche','boc','analyses','analyse-detail','analyse-technique','analyse-fondamentale','screener','portefeuille','alertes','financials','financials-detail','publications','formation'];

  window.nav = function (view, initial) {
    view = String(view || 'overview').replace(/^#/, '');
    if (NAV_VIEWS.indexOf(view) === -1) view = 'overview';
    var target = document.getElementById('view-' + view);
    if (!target) {
      console.warn('[NAV] Vue introuvable:', view);
      return false;
    }

    document.querySelectorAll('.view').forEach(function (el) { el.classList.remove('active'); });
    target.classList.add('active');

    document.querySelectorAll('.nav-item, .nav-dropdown-item, .nav-dropdown-btn').forEach(function (el) { el.classList.remove('active'); });
    var side = document.querySelector('.nav-item[onclick*="nav(\'' + view + '\'"]');
    if (side) side.classList.add('active');
    var top = document.getElementById('nav-' + view);
    if (top) top.classList.add('active');
    if (view === 'marche') {
      var marketBtn = document.getElementById('nav-marche-btn');
      if (marketBtn) marketBtn.classList.add('active');
    }

    var breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) breadcrumb.textContent = ({overview:'Tableau de bord',titres:'Titres BRVM',marche:'Marché BRVM',boc:'BOC / Emprunts',analyses:'Recommandations','analyse-detail':'Analyse', 'analyse-technique':'Analyse Technique','analyse-fondamentale':'Analyse Fondamentale',screener:'Screener',portefeuille:'Portefeuille',alertes:'Alertes',financials:'États Financiers','financials-detail':'États Financiers',publications:'Calendrier',formation:'Formation'})[view] || 'The Capital';

    window.closeDropdowns();
    if (location.hash !== '#' + view && !initial) history.pushState(null, '', '#' + view);
    if (typeof window.renderCurrentView === 'function') {
      try { window.renderCurrentView(); } catch (e) { console.warn('[NAV] rendu:', e); }
    }
    if (view === 'analyse-technique' && typeof window.atRefreshUI === 'function') {
      try { window.atRefreshUI(); } catch (e) {}
    }
    return true;
  };

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
    loadStyle('app/css/technique-experience.css?v=2');
    loadScript('app/js/views/technique/experience.js?v=3');
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
    } catch (e) { console.warn('[INIT] rendu après données:', e); }
  }

  function ensureSuiviNavigation() {
    var href = '/app/suivi.html';
    var sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.querySelector('[data-tc-suivi]')) {
      var sections = sidebar.querySelectorAll('.sidebar-section');
      var gestionSection = null;
      sections.forEach(function (section) { if (String(section.textContent || '').trim() === 'Gestion') gestionSection = section; });
      if (gestionSection) {
        var item = document.createElement('a'); item.setAttribute('data-tc-suivi','1'); item.href=href; item.target='_self'; item.className='nav-item'; item.style.textDecoration='none'; item.innerHTML='<span class="icon">☆</span> Suivi'; gestionSection.insertAdjacentElement('afterend',item);
      }
    }
    var menu=document.getElementById('menu-dd-gestion');
    if(menu&&!menu.querySelector('[data-tc-suivi]')){var separator=document.createElement('div');separator.className='nav-dropdown-separator';var desktopItem=document.createElement('a');desktopItem.setAttribute('data-tc-suivi','1');desktopItem.href=href;desktopItem.target='_self';desktopItem.className='nav-dropdown-item';desktopItem.style.textDecoration='none';desktopItem.innerHTML='<span class="icon">☆</span><div><div>Suivi</div><div class="item-desc">Valeurs surveillées & monitoring</div></div>';menu.appendChild(separator);menu.appendChild(desktopItem);}
  }

  function init() {
    if (started) return;
    started = true;
    if (!requireAuth()) return;
    normalizeDocument();
    console.log('[INIT] Session authentifiée, démarrage The Capital');
    if (typeof window.initApp !== 'function') { console.error('[INIT] initApp manquant, main.js doit être chargé avant init.js'); document.body.classList.remove('init-hidden'); return; }
    try { window.initApp(); } catch (e) { console.error('[INIT] initApp:', e); }
    if (typeof window.initSidebar === 'function') { try { window.initSidebar(); } catch (e) { console.warn('[INIT] sidebar:', e); } }
    ensureSuiviNavigation(); setTimeout(ensureSuiviNavigation, 0);
    if (typeof window.initUserDataLayer === 'function') { try { window.initUserDataLayer(); } catch (e) { console.warn('[INIT] user data:', e); } }
    if (window.marketsModule && typeof window.marketsModule.loadData === 'function') { try { window.marketsModule.loadData(); } catch (e) { console.warn('[INIT] marketsModule:', e); } }
    document.body.classList.remove('init-hidden'); renderAfterData(); setTimeout(loadRuntimeLayers, 0);
  }

  function boot() {
    normalizeDocument();
    if (!requireAuth()) return;
    init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
