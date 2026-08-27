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
  window.allCours = [];
  window.allBoc = [];
  window.allAnalyses = [];
  window.allFinancials = [];
  window.allEntreprises = [];
  window.allIndices = [];
  window.ficheHistorique = [];
  window.ficheChartPeriod = 30;
  window.ficheChartInst = null;
  window.compositeChartInst = null;
  window.techChartInst = null;
  window.techVolInst = null;
  window.prevView = 'titres';
  window._titreFilter = 'all';
  window._bocFilter = 'all';
  window._analyseFilter = 'all';
  window._pubFilter = 'all';
  window._sortState = {};
  window.entMap = {};
  window._fundMethod = 'tcam';

  (function loadMarketUX(){
    if (document.getElementById('tc-market-ux-script')) return;
    if (window.__TC_CLOCK_INTERVAL__) {
      clearInterval(window.__TC_CLOCK_INTERVAL__);
      window.__TC_CLOCK_INTERVAL__ = null;
    }
    var script = document.createElement('script');
    script.id = 'tc-market-ux-script';
    script.src = '/app/js/market-ux.js?v=20260827.3';
    script.defer = true;
    document.head.appendChild(script);
  })();

  (function loadMarketStatusReconciler(){
    if (document.getElementById('tc-market-status-reconciler-script')) return;
    var script = document.createElement('script');
    script.id = 'tc-market-status-reconciler-script';
    script.src = '/app/js/market-status-reconciler.js?v=20260827.1';
    script.defer = true;
    document.head.appendChild(script);
  })();

  (function loadUIConsistency(){
    if (document.getElementById('tc-ui-consistency-script')) return;
    var script = document.createElement('script');
    script.id = 'tc-ui-consistency-script';
    script.src = '/app/js/ui-consistency.js?v=20260827.1';
    script.defer = true;
    document.head.appendChild(script);
  })();

  window.destroyChart = function(chartVar) {
    if (chartVar && typeof chartVar.destroy === 'function') chartVar.destroy();
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
