// INITIALIZATION — The Capital BRVM Dashboard
(function() {
  if (window.__TC_INIT_LOADED__) return;
  window.__TC_INIT_LOADED__ = true;

  function parseHashFromUrl() {
    const h = location.hash;
    if (h.indexOf('#fiche=') === 0) return 'fiche';
    if (h.indexOf('#analyse=') === 0) return 'analyse-detail';
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

  function setupGlobalEvents() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-dropdown') && !e.target.closest('.topnav-logo')) {
        if (typeof closeDropdowns === 'function') closeDropdowns();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (typeof closeDropdowns === 'function') closeDropdowns();
        if (typeof closeSidebar === 'function') closeSidebar();
      }
    });
  }

  async function initApp() {
    console.log('[INIT] Initialisation...');

    if (!document.getElementById('toastContainer')) {
      const tc = document.createElement('div');
      tc.id = 'toastContainer';
      tc.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(tc);
    }

    if (window.loadAll) {
      window.loadAll().catch((err) => {
        console.error('[INIT] Erreur loadAll:', err);
        if (typeof toast === 'function') toast('Erreur de chargement des donnees', 'error');
      });
    }

    window.addEventListener('hashchange', () => {
      if (typeof parseHash === 'function') parseHash();
    });
    if (typeof parseHash === 'function') parseHash();

    setupGlobalEvents();

    const initialView = parseHashFromUrl() || 'overview';
    if (typeof nav === 'function') {
      nav(initialView, true);
    }

    console.log('[INIT] Initialisation terminee');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  console.log('[INIT] Charge avec succes');
})();
