// ═══════════════════════════════════════
// MAIN — The Capital BRVM Dashboard
// ═══════════════════════════════════════
// Guard pattern: empêche le double chargement
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

    // 2. Charger les données de base
    try {
      await loadAll();
    } catch (err) {
      console.error('[MAIN] Erreur loadAll:', err);
      toast('Erreur de chargement des données', 'error');
    }

    // 3. Setup router hash
    window.addEventListener('hashchange', parseHash);
    parseHash();

    // 4. Setup global events
    setupGlobalEvents();

    console.log('[MAIN] Initialisation terminée');
  }

  // ═══════════════════════════════════════
  // DATA LOADING (avec fallback cache)
  // ═══════════════════════════════════════
  async function loadAll() {
    const promises = [];

    // Cours
    promises.push(
      apiGet('/marche?type=cours')
        .then(data => { allCours = data || []; })
        .catch(err => { console.warn('[MAIN] cours non chargés:', err); allCours = []; })
    );

    // Indices
    promises.push(
      apiGet('/marche?type=indices')
        .then(data => { allIndices = data || []; })
        .catch(err => { console.warn('[MAIN] indices non chargés:', err); allIndices = []; })
    );

    // BOC
    promises.push(
      apiGet('/boc')
        .then(data => { allBoc = data || []; })
        .catch(err => { console.warn('[MAIN] BOC non chargé:', err); allBoc = []; })
    );

    // Financials
    promises.push(
      apiGet('/marche?type=financials')
        .then(data => { allFinancials = data || []; })
        .catch(err => { console.warn('[MAIN] financials non chargés:', err); allFinancials = []; })
    );

    // Analyses
    promises.push(
      apiGet('/marche?type=analyses')
        .then(data => { allAnalyses = data || []; })
        .catch(err => { console.warn('[MAIN] analyses non chargées:', err); allAnalyses = []; })
    );

    // Entreprises — CORRECTION : endpoint séparé /entreprises au lieu de /marche?type=entreprises
    // Car l'API n'a pas de case 'entreprises' dans handleMarche
    promises.push(
      apiGet('/marche?type=entreprises')
        .then(data => {
          if (data && data.data) {
            allEntreprises = data.data || [];
          } else {
            allEntreprises = data || [];
          }
          entMap = {};
          allEntreprises.forEach(e => { if (e?.ticker) entMap[e.ticker] = e; });
        })
        .catch(err => { 
          console.warn('[MAIN] entreprises non chargées:', err); 
          allEntreprises = []; 
          entMap = {}; 
        })
    );

    await Promise.all(promises);

    // Build entMap (au cas où la promise ci-dessus échoue)
    entMap = {};
    allEntreprises.forEach(e => { if (e?.ticker) entMap[e.ticker] = e; });

    // Render initial view — TOUJOURS afficher l'interface meme sans donnees
    const initialView = parseHashFromUrl() || 'overview';

    // Forcer le rendu de l'overview si disponible, meme avec donnees vides
    if (typeof renderOverview === 'function') {
      try {
        renderOverview();
      } catch (renderErr) {
        console.error('[MAIN] Erreur renderOverview:', renderErr);
        // Fallback : afficher un message minimal
        const appEl = document.getElementById('app') || document.getElementById('mainContent') || document.body;
        if (appEl && !appEl.innerHTML.trim()) {
          appEl.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">' +
            '<h2 style="color:#e2e8f0;margin-bottom:16px;">The Capital</h2>' +
            '<p>Chargement des donnees en cours...</p>' +
            '<p style="font-size:12px;margin-top:16px;opacity:0.6;">' +
            'Si le chargement persiste, verifiez votre connexion ou rechargez la page.</p>' +
            '<button onclick="location.reload()" style="margin-top:20px;padding:8px 16px;' +
            'background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;">' +
            'Recharger</button></div>';
        }
      }
    }

    console.log('[MAIN] Données chargées:', {
      cours: allCours.length,
      indices: allIndices.length,
      boc: allBoc.length,
      financials: allFinancials.length,
      analyses: allAnalyses.length,
      entreprises: allEntreprises.length
    });
  }

  // ═══════════════════════════════════════
  // API HELPER (avec gestion d'erreur robuste)
  // ═══════════════════════════════════════
  async function apiGet(endpoint) {
    const url = '/api' + endpoint;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // Essayer de parser l'erreur
        let errBody = '';
        try { errBody = await res.text(); } catch(e) {}
        throw new Error('HTTP ' + res.status + ': ' + res.statusText + ' — ' + errBody.slice(0, 200));
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error('Reponse non-JSON: ' + text.slice(0, 200));
      }
      const json = await res.json();
      // CORRECTION : certains endpoints retournent { data: [...] }, d'autres directement [...]
      // On normalise pour toujours retourner le tableau
      let result;
      if (json && Array.isArray(json.data)) {
        result = json.data;
      } else if (json && json.success && Array.isArray(json.data)) {
        result = json.data;
      } else {
        result = json;
      }
      // Stocker en cache localStorage pour fallback futur
      try {
        localStorage.setItem('tc_cache_' + endpoint, JSON.stringify(result));
      } catch(e) {}
      return result;
    } catch (err) {
      console.error('[API] ' + endpoint + ':', err);
      // Retourner donnees en cache localStorage si dispo
      const cached = localStorage.getItem('tc_cache_' + endpoint);
      if (cached) {
        try { return JSON.parse(cached); } catch(e) {}
      }
      return null;
    }
  }

  // ═══════════════════════════════════════
  // HASH PARSING (correction de atInit)
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
    // Fermer dropdowns au clic extérieur
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.nav-dropdown') && !e.target.closest('.topnav-logo')) {
        if (typeof closeDropdowns === 'function') closeDropdowns();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (typeof closeDropdowns === 'function') closeDropdowns();
        if (typeof closeSidebar === 'function') closeSidebar();
      }
    });
  }

  // ═══════════════════════════════════════
  // EXPORTS (pour compatibilité)
  // ═══════════════════════════════════════
  window.apiGet = apiGet;
  window.loadAll = loadAll;
  window.initApp = initApp;

  // Auto-init quand DOM prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
