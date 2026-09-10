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

  // Chargement de script dédupliqué par CHEMIN (sans ?v=). Plusieurs loaders
  // (state, init, loader, vues) demandaient le même fichier avec des ?v=
  // différents -> double, voire triple téléchargement et double exécution
  // (source de gestionnaires d'événements liés deux fois — cf. doublon d'achat
  // au portefeuille). Tout passe désormais par ici.
  window.__tcScriptOnce = window.__tcScriptOnce || {};
  window.tcLoadOnce = function (src) {
    var path = String(src || '').split('?')[0];
    if (!path) return Promise.resolve();
    if (window.__tcScriptOnce[path]) return window.__tcScriptOnce[path];
    try {
      if (document.querySelector('script[src="' + path + '"], script[src^="' + path + '?"]')) {
        window.__tcScriptOnce[path] = Promise.resolve();
        return window.__tcScriptOnce[path];
      }
    } catch (e) {}
    window.__tcScriptOnce[path] = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src; s.async = false; s.dataset.tcOnce = path;
      s.onload = function () { resolve(); };
      s.onerror = function () { console.warn('[LOAD] indisponible : ' + src); resolve(); };
      (document.head || document.documentElement).appendChild(s);
    });
    return window.__tcScriptOnce[path];
  };

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
    if (window.__TC_CLOCK_INTERVAL__) {
      clearInterval(window.__TC_CLOCK_INTERVAL__);
      window.__TC_CLOCK_INTERVAL__ = null;
    }
    window.tcLoadOnce('/app/js/market-ux.js?v=20260827.3');
  })();

  (function loadMarketStatusReconciler(){
    if (document.getElementById('tc-market-status-reconciler-script')) return;
    var script = document.createElement('script');
    script.id = 'tc-market-status-reconciler-script';
    script.src = '/app/js/market-status-reconciler.js?v=20260827.1';
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
