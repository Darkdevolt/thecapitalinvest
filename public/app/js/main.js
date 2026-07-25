// ═══════════════════════════════════════
// MAIN — The Capital BRVM Dashboard
// ═══════════════════════════════════════
(function() {
  if (window.__TC_MAIN_LOADED__) {
    console.log('[MAIN] Déjà chargé, skip.');
    return;
  }
  window.__TC_MAIN_LOADED__ = true;

  // ═══════════════════════════════════════
  // INIT SEQUENCE
  // ═══════════════════════════════════════
  async function initApp() {
    console.log('[MAIN] Initialisation...');

    // 1. Toast container check
    if (!document.getElementById('toastContainer')) {
      const tc = document.createElement('div');
      tc.id = 'toastContainer';
      tc.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(tc);
    }

    // 2. Lancer le chargement des données en arrière-plan
    // NE PAS await — laisse l'interface s'afficher tout de suite
    loadAll().catch(err => {
      console.error('[MAIN] Erreur loadAll:', err);
      toast('Erreur de chargement des données', 'error');
    });

    // 3. Setup router hash
    window.addEventListener('hashchange', parseHash);
    parseHash();

    // 4. Setup global events
    setupGlobalEvents();

    // 5. Afficher la vue immédiatement, même sans données
    const initialView = parseHashFromUrl() || 'overview';
    if (typeof nav === 'function') {
      nav(initialView, true);
    }

    console.log('[MAIN] Initialisation terminée');
  }

  // ═══════════════════════════════════════
  // DATA LOADING (non bloquant)
  // ═══════════════════════════════════════
  async function loadAll() {
    const fetchOrEmpty = (endpoint, setter, emptyVal) => {
      if (typeof window.apiGet !== 'function') {
        console.warn('[MAIN] apiGet non disponible');
        setter(emptyVal);
        return Promise.resolve();
      }
      return window.apiGet(endpoint)
        .then(data => { setter(data || emptyVal); })
        .catch(err => {
          console.warn('[MAIN] ' + endpoint + ' non chargé:', err.message || err);
          setter(emptyVal);
        });
    };

    const promises = [
      fetchOrEmpty('/marche?type=cours', d => { allCours = d; }, []),
      fetchOrEmpty('/marche?type=indices', d => { allIndices = d; }, []),
      fetchOrEmpty('/boc', d => { allBoc = d; }, []),
      fetchOrEmpty('/marche?type=financials', d => { allFinancials = d; }, []),
      fetchOrEmpty('/marche?type=analyses', d => { allAnalyses = d; }, []),
      fetchOrEmpty('/marche?type=entreprises', d => {
        allEntreprises = d || [];
        entMap = {};
        allEntreprises.forEach(e => { if (e?.ticker) entMap[e.ticker] = e; });
      }, [])
    ];

    await Promise.all(promises);

    // Re-render la vue active avec les nouvelles données
    const activeView = document.querySelector('.view.active');
    const viewId = activeView?.id?.replace('view-', '');
    if (viewId) {
      const fnName = 'render' + viewId.charAt(0).toUpperCase() + viewId.slice(1);
      if (typeof window[fnName] === 'function') {
        try { window[fnName](); } catch(e) {}
      }
    }

    console.log('[MAIN] Données chargées:', {
      cours: allCours?.length || 0,
      indices: allIndices?.length || 0,
      boc: allBoc?.length || 0,
      financials: allFinancials?.length || 0,
      analyses: allAnalyses?.length || 0,
      entreprises: allEntreprises?.length || 0
    });
  }

  // ═══════════════════════════════════════
  // HASH PARSING
  // ═══════════════════════════════════════
  function parseHashFromUrl() {
    const h = location.hash;
    if (h.startsWith('#fiche=')) return 'fiche';
    if (h.startsWith('#analyse=')) return 'analyse-detail';
    const map = {
      '#titres': 'titres',
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
      '#formation': 'formation'
    };
    return map[h] || 'overview';
  }

  // ═══════════════════════════════════════
  // GLOBAL EVENTS
  // ═══════════════════════════════════════
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

  // ═══════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════
  window.loadAll = loadAll;
  window.initApp = initApp;

  // Auto-init quand DOM prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
