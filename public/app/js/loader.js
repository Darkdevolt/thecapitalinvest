// DATA LOADER — The Capital BRVM Dashboard
(function() {
  if (window.__TC_LOADER_LOADED__) return;
  window.__TC_LOADER_LOADED__ = true;

  window.allCours = [];
  window.allIndices = [];
  window.allBoc = [];
  window.allFinancials = [];
  window.allAnalyses = [];
  window.allEntreprises = [];
  window.entMap = {};

  async function loadAll() {
    try {
      const results = await Promise.allSettled([
        (window.apiGet ? window.apiGet('/marche?type=cours') : Promise.resolve([])),
        (window.apiGet ? window.apiGet('/marche?type=indices') : Promise.resolve([])),
        (window.apiGet ? window.apiGet('/boc') : Promise.resolve([])),
        (window.apiGet ? window.apiGet('/marche?type=financials') : Promise.resolve([])),
        (window.apiGet ? window.apiGet('/marche?type=analyses') : Promise.resolve([])),
        (window.apiGet ? window.apiGet('/marche?type=entreprises') : Promise.resolve([])),
      ]);

      window.allCours = results[0].status === 'fulfilled' ? (results[0].value || []) : [];
      window.allIndices = results[1].status === 'fulfilled' ? (results[1].value || []) : [];
      window.allBoc = results[2].status === 'fulfilled' ? (results[2].value || []) : [];
      window.allFinancials = results[3].status === 'fulfilled' ? (results[3].value || []) : [];
      window.allAnalyses = results[4].status === 'fulfilled' ? (results[4].value || []) : [];
      window.allEntreprises = results[5].status === 'fulfilled' ? (results[5].value || []) : [];

      window.entMap = Object.fromEntries(window.allEntreprises.map(e => [e.ticker, e]));

      console.log('[LOADER] Donnees chargees:', {
        cours: window.allCours.length,
        indices: window.allIndices.length,
        boc: window.allBoc.length,
        financials: window.allFinancials.length,
        analyses: window.allAnalyses.length,
        entreprises: window.allEntreprises.length
      });

      return true;
    } catch(e) {
      console.error('[LOADER] Erreur globale:', e);
      return false;
    }
  }

  window.loadAll = loadAll;
  console.log('[LOADER] Charge avec succes');
})();
