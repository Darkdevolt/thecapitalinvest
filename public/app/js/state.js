// ═══════════════════════════════════════
// STATE — The Capital BRVM
// ═══════════════════════════════════════
// Guard pattern: empêche le double chargement
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
