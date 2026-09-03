// MAIN — The Capital BRVM Dashboard
// Orchestration légère : le rendu du shell est prioritaire, les données sont chargées par loader.js.
(function () {
  'use strict';

  window.allCours = Array.isArray(window.allCours) ? window.allCours : [];
  window.allIndices = Array.isArray(window.allIndices) ? window.allIndices : [];
  window.allBoc = Array.isArray(window.allBoc) ? window.allBoc : [];
  window.allFinancials = Array.isArray(window.allFinancials) ? window.allFinancials : [];
  window.allAnalyses = Array.isArray(window.allAnalyses) ? window.allAnalyses : [];
  window.allEntreprises = Array.isArray(window.allEntreprises) ? window.allEntreprises : [];
  window.entMap = window.entMap && typeof window.entMap === 'object' ? window.entMap : {};

  if (window.__TC_MAIN_LOADED__) return;
  window.__TC_MAIN_LOADED__ = true;

  var fundamentalRetryTimer = null;
  var fundamentalRetryCount = 0;
  var technicalInitialized = false;

  function loadStyles() {
    if (!document.getElementById('tc-mobile-polish')) {
      var mobile = document.createElement('link');
      mobile.id = 'tc-mobile-polish';
      mobile.rel = 'stylesheet';
      mobile.href = '/app/css/mobile-polish.css?v=3';
      document.head.appendChild(mobile);
    }
    if (!document.getElementById('tc-mobile-polish-v2')) {
      var mobile2 = document.createElement('link');
      mobile2.id = 'tc-mobile-polish-v2';
      mobile2.rel = 'stylesheet';
      mobile2.href = '/app/css/mobile-polish-v2.css?v=3';
      document.head.appendChild(mobile2);
    }
    if (!document.getElementById('tc-financial-polish')) {
      var fin = document.createElement('link');
      fin.id = 'tc-financial-polish';
      fin.rel = 'stylesheet';
      fin.href = '/app/css/financials-polish.css?v=1';
      document.head.appendChild(fin);
    }
  }

  function ensureTechnicalReady() {
    if (!Array.isArray(window.allCours) || window.allCours.length === 0) return false;
    if (typeof window.atInit !== 'function') return false;
    try {
      if (!technicalInitialized) {
        var ok = window.atInit();
        if (ok === false) return false;
        technicalInitialized = true;
      } else if (typeof window.atRefreshUI === 'function') {
        window.atRefreshUI();
      }
      return true;
    } catch (err) {
      technicalInitialized = false;
      console.error('[MAIN] Analyse technique:', err);
      return false;
    }
  }

  function parseHashFromUrl() {
    var h = location.hash || '';
    if (h.indexOf('#fiche=') === 0) return 'fiche';
    if (h.indexOf('#analyse=') === 0) return 'analyse-detail';
    var map = {
      '#titres': 'titres',
      '#marche': 'marche',
      '#boc': 'boc',
      '#analyses': 'analyses',
      '#analyse-detail': 'analyse-detail',
      '#analyse-technique': 'analyse-technique',
      '#analyse-fondamentale': 'analyse-fondamentale',
      '#screener': 'screener',
      '#portefeuille': 'portefeuille',
      '#alertes': 'alertes',
      '#financials': 'financials',
      '#financials-detail': 'financials-detail',
      '#publications': 'publications',
      '#formation': 'formation',
      '#comparison': 'comparison',
      '#dividend-screener': 'dividend-screener'
    };
    return map[h] || 'overview';
  }

  function renderCurrentView() {
    var active = document.querySelector('.view.active');
    var viewId = active && active.id ? active.id.replace('view-', '') : '';
    if (!viewId) return;

    if (viewId === 'analyse-technique') ensureTechnicalReady();

    var name = 'render' + viewId.charAt(0).toUpperCase() + viewId.slice(1);
    if (typeof window[name] === 'function') {
      try {
        window[name]();
      } catch (e) {
        console.warn('[MAIN] Render ' + name + ':', e);
        if (viewId === 'analyse-fondamentale') scheduleFundamentalRender(false);
      }
    }
  }

  function ensureFundamentalReady() {
    if (parseHashFromUrl() !== 'analyse-fondamentale') return;

    var select = document.getElementById('fundTickerSelect') || document.getElementById('afTicker');
    if (!select) return;

    if (typeof window.populateTickerSelects === 'function') {
      try { window.populateTickerSelects(); } catch (e) {}
    }

    if (select.options && select.options.length > 1 && !select.value) {
      select.selectedIndex = 1;
    }

    if (select.value && typeof window.loadFundAnalysis === 'function') {
      try { window.loadFundAnalysis(); } catch (e) { console.warn('[MAIN] loadFundAnalysis:', e); }
    }
  }

  function scheduleFundamentalRender(reset) {
    if (reset) fundamentalRetryCount = 0;
    if (fundamentalRetryTimer) clearTimeout(fundamentalRetryTimer);
    if (parseHashFromUrl() !== 'analyse-fondamentale') return;

    fundamentalRetryTimer = setTimeout(function retry() {
      if (parseHashFromUrl() !== 'analyse-fondamentale') return;
      ensureFundamentalReady();
      renderCurrentView();
      fundamentalRetryCount += 1;
      if (fundamentalRetryCount < 8 && !window.allFinancials.length) {
        scheduleFundamentalRender(false);
      }
    }, 300);
  }

  function setupGlobalEvents() {
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-dropdown') && !e.target.closest('.topnav-logo')) {
        if (typeof window.closeDropdowns === 'function') window.closeDropdowns();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (typeof window.closeDropdowns === 'function') window.closeDropdowns();
        if (typeof window.closeSidebar === 'function') window.closeSidebar();
      }
    });

    window.addEventListener('tc:dataready', function () {
      renderCurrentView();
      ensureFundamentalReady();
    });
  }

  function loadDataInBackground() {
    var loader = window.__tcOptimizedLoadAll || window.loadAll;
    if (typeof loader !== 'function') return;
    Promise.resolve()
      .then(function () { return loader(); })
      .catch(function (err) {
        console.error('[MAIN] Chargement données:', err);
        if (typeof window.toast === 'function') {
          window.toast('Certaines données sont temporairement indisponibles.', 'warn');
        }
      });
  }

  async function initApp() {
    console.log('[MAIN] Initialisation légère...');

    if (typeof window.initSidebar === 'function') {
      try { window.initSidebar(); } catch (e) {}
    }

    setupGlobalEvents();

    var initialView = parseHashFromUrl();
    if (typeof window.parseHash === 'function') {
      try { window.parseHash(); } catch (e) {}
    }
    if (typeof window.nav === 'function') {
      try { window.nav(initialView, true); } catch (e) {}
    }

    // Le premier rendu ne doit attendre aucun appel réseau.
    renderCurrentView();

    // Les feuilles de style secondaires et les données partent après le premier paint.
    setTimeout(loadStyles, 0);
    setTimeout(loadDataInBackground, 0);

    if (initialView === 'analyse-fondamentale') {
      scheduleFundamentalRender(true);
      ensureFundamentalReady();
    }
    if (initialView === 'analyse-technique') ensureTechnicalReady();
  }

  // Compatibilité : les autres modules peuvent toujours appeler window.loadAll().
  window.loadAll = function () {
    var loader = window.__tcOptimizedLoadAll || window.__tcLoaderLoadAll || window.loadAll;
    if (typeof window.__tcOptimizedLoadAll === 'function') return window.__tcOptimizedLoadAll();
    if (typeof window.__tcLoaderLoadAll === 'function') return window.__tcLoaderLoadAll();
    return Promise.resolve();
  };

  window.initApp = initApp;
  window.renderCurrentView = renderCurrentView;
  window.parseHashFromUrl = parseHashFromUrl;
  window.ensureTechnicalReady = ensureTechnicalReady;
})();
