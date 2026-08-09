// MAIN — The Capital BRVM Dashboard
// Runtime principal : orchestration des données et du rendu.
(function() {
  'use strict';

  // STATE est chargé avant MAIN dans app.html et reste la source unique de l'état global.
  window.allCours = Array.isArray(window.allCours) ? window.allCours : [];
  window.allIndices = Array.isArray(window.allIndices) ? window.allIndices : [];
  window.allBoc = Array.isArray(window.allBoc) ? window.allBoc : [];
  window.allFinancials = Array.isArray(window.allFinancials) ? window.allFinancials : [];
  window.allAnalyses = Array.isArray(window.allAnalyses) ? window.allAnalyses : [];
  window.allEntreprises = Array.isArray(window.allEntreprises) ? window.allEntreprises : [];
  window.entMap = window.entMap && typeof window.entMap === 'object' ? window.entMap : {};

  if (window.__TC_MAIN_LOADED__) {
    console.log('[MAIN] Déjà chargé, skip.');
    return;
  }
  window.__TC_MAIN_LOADED__ = true;

  async function initApp() {
    console.log('[MAIN] Initialisation...');
    if (!document.getElementById('toastContainer')) {
      var tc = document.createElement('div');
      tc.id = 'toastContainer';
      tc.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(tc);
    }

    loadAll().catch(function(err) {
      console.error('[MAIN] Erreur loadAll:', err);
      if (typeof toast === 'function') toast('Erreur de chargement des données', 'error');
    });

    window.addEventListener('hashchange', function() {
      if (typeof parseHash === 'function') parseHash();
    });

    if (typeof parseHash === 'function') parseHash();
    setupGlobalEvents();

    var initialView = parseHashFromUrl() || 'overview';
    if (typeof nav === 'function') nav(initialView, true);
    console.log('[MAIN] Initialisation terminée');
  }

  function fetchOrEmpty(endpoint, setter, emptyVal) {
    if (typeof window.apiGet !== 'function') {
      console.warn('[MAIN] apiGet non disponible:', endpoint);
      setter(emptyVal);
      return Promise.resolve();
    }
    return window.apiGet(endpoint)
      .then(function(res) {
        var payload = (res && typeof res === 'object' && 'data' in res) ? res.data : res;
        setter(payload || emptyVal);
      })
      .catch(function(err) {
        console.warn('[MAIN] ' + endpoint + ' non chargé:', err.message || err);
        setter(emptyVal);
      });
  }

  async function loadAll() {
    // Les données financières sont indépendantes : une API lente ne bloque pas le reste.
    await Promise.allSettled([
      fetchOrEmpty('/marche?type=cours', function(d) {
        window.allCours = Array.isArray(d) ? d : [];
        if (typeof window.populateTickerSelect === 'function') window.populateTickerSelect();
        renderCurrentView();
      }, []),
      fetchOrEmpty('/marche?type=indices', function(d) {
        window.allIndices = Array.isArray(d) ? d : [];
        renderCurrentView();
      }, [])
    ]);

    await Promise.allSettled([
      fetchOrEmpty('/boc', function(d) {
        window.allBoc = d && Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
      }, []),
      fetchOrEmpty('/marche?type=financials', function(d) {
        window.allFinancials = Array.isArray(d) ? d : [];
      }, []),
      fetchOrEmpty('/marche?type=analyses', function(d) {
        window.allAnalyses = Array.isArray(d) ? d : [];
      }, []),
      fetchOrEmpty('/marche?type=entreprises', function(d) {
        window.allEntreprises = Array.isArray(d) ? d : [];
        window.entMap = {};
        window.allEntreprises.forEach(function(e) {
          if (e && e.ticker) window.entMap[e.ticker] = e;
        });
      }, [])
    ]);

    renderCurrentView();
    console.log('[MAIN] Données chargées:', {
      cours: window.allCours.length,
      indices: window.allIndices.length,
      boc: window.allBoc.length,
      financials: window.allFinancials.length,
      analyses: window.allAnalyses.length,
      entreprises: window.allEntreprises.length
    });
  }

  function renderCurrentView() {
    var activeView = document.querySelector('.view.active');
    var viewId = activeView && activeView.id ? activeView.id.replace('view-', '') : '';
    if (!viewId) return;
    var fnName = 'render' + viewId.charAt(0).toUpperCase() + viewId.slice(1);
    if (typeof window[fnName] === 'function') {
      try {
        window[fnName]();

        // Analyse fondamentale : si le premier rendu TCAM n'a pas produit
        // la vue complète, relance automatiquement le mode Régression.
        // Cela évite de devoir cliquer manuellement sur « Régression » après
        // l'ouverture de la page, notamment lorsque certaines séries rendent
        // le TCAM mathématiquement non calculable (valeurs négatives/nulles).
        if (viewId === 'analyse-fondamentale') {
          setTimeout(function() {
            var content = document.getElementById('fundContent');
            var rendered = content && content.querySelector('.fund-hero');
            if (!rendered && typeof window.setFundMethod === 'function') {
              var regressionBtn = document.querySelector('#view-analyse-fondamentale .fund-method-switch .filter-btn:last-child') ||
                                  document.querySelector('#view-analyse-fondamentale .filter-btn:last-child');
              window.setFundMethod('regression', regressionBtn || null);
            }
          }, 120);
        }
      } catch(e) {
        console.warn('[MAIN] Render error ' + fnName + ':', e);
        if (viewId === 'analyse-fondamentale' && typeof window.setFundMethod === 'function') {
          var regressionBtn = document.querySelector('#view-analyse-fondamentale .fund-method-switch .filter-btn:last-child') ||
                              document.querySelector('#view-analyse-fondamentale .filter-btn:last-child');
          try { window.setFundMethod('regression', regressionBtn || null); } catch (_) {}
        }
      }
    }
  }

  function parseHashFromUrl() {
    var h = location.hash;
    if (h.indexOf('#fiche=') === 0) return 'fiche';
    if (h.indexOf('#analyse=') === 0) return 'analyse-detail';
    var map = {
      '#titres': 'titres', '#marche': 'marche', '#boc': 'boc', '#analyses': 'analyses',
      '#analyse-detail': 'analyse-detail', '#analyse-technique': 'analyse-technique',
      '#analyse-fondamentale': 'analyse-fondamentale', '#screener': 'screener',
      '#portefeuille': 'portefeuille', '#alertes': 'alertes', '#financials': 'financials',
      '#financials-detail': 'financials-detail', '#publications': 'publications', '#formation': 'formation'
    };
    return map[h] || 'overview';
  }

  function setupGlobalEvents() {
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.nav-dropdown') && !e.target.closest('.topnav-logo')) {
        if (typeof closeDropdowns === 'function') closeDropdowns();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (typeof closeDropdowns === 'function') closeDropdowns();
        if (typeof closeSidebar === 'function') closeSidebar();
      }
    });
  }

  window.loadAll = loadAll;
  window.initApp = initApp;
})();
