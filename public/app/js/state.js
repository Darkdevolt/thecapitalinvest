// ═══════════════════════════════════════
// STATE, The Capital BRVM
// ═══════════════════════════════════════
// Guard pattern : empêche le double chargement
(function() {
  if (window.__TC_STATE_LOADED__) {
    console.log('[STATE] Déjà chargé, skip.');
    return;
  }
  window.__TC_STATE_LOADED__ = true;

  // ═══════════════════════════════════════
  // ÉTAT GLOBAL (encapsulé)
  // ═══════════════════════════════════════
  window.allCours = [];
  window.allBoc = [];
  window.allAnalyses = [];
  window.allFinancials = [];
  window.allEntreprises = [];
  window.allIndices = [];

  window.ficheHistorique = [];
  window.ficheChartPeriod = 30;

  // Chart instances (pour destruction propre)
  window.ficheChartInst = null;
  window.compositeChartInst = null;
  window.techChartInst = null;
  window.techVolInst = null;

  window.prevView = 'titres';

  // Filtres
  window._titreFilter = 'all';
  window._bocFilter = 'all';
  window._analyseFilter = 'all';
  window._pubFilter = 'all';

  // Tri
  window._sortState = {};

  // Mapping entreprises
  window.entMap = {};

  // Méthode fondamentale
  window._fundMethod = 'tcam';

  // Charge le moteur UX BRVM après l'état global, sans toucher aux APIs,
  // données, tables ou à la logique d'authentification existante.
  (function loadMarketUX(){
    if (document.getElementById('tc-market-ux-script')) return;
    var script = document.createElement('script');
    script.id = 'tc-market-ux-script';
    script.src = '/app/js/market-ux.js?v=20260827';
    script.defer = true;
    document.head.appendChild(script);
  })();

  // ═══════════════════════════════════════
  // HELPERS DE DESTRUCTION DE CHARTS
  // ═══════════════════════════════════════
  window.destroyChart = function(chartVar) {
    if (chartVar && typeof chartVar.destroy === 'function') {
      chartVar.destroy();
    }
    return null;
  };

  window.destroyAllCharts = function() {
    ficheChartInst = destroyChart(ficheChartInst);
    compositeChartInst = destroyChart(compositeChartInst);
    techChartInst = destroyChart(techChartInst);
    techVolInst = destroyChart(techVolInst);
  };

  console.log('[STATE] Chargé avec succès');

})();
