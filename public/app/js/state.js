// ═══════════════════════════════════════
// STATE — Garde anti-double exécution
// ═══════════════════════════════════════
if (window.__stateLoaded) {
  console.warn('[STATE] Déjà chargé, skip.');
} else {
  window.__stateLoaded = true;

  // ═══════════════════════════════════════
  // VARIABLES GLOBALES (window.* pour résister au double chargement)
  // ═══════════════════════════════════════
  window.allCours = window.allCours || [];
  window.allBoc = window.allBoc || [];
  window.allAnalyses = window.allAnalyses || [];
  window.allFinancials = window.allFinancials || [];
  window.allEntreprises = window.allEntreprises || [];
  window.allIndices = window.allIndices || [];
  window.allCoursHistorique = window.allCoursHistorique || [];
  window.ficheHistorique = window.ficheHistorique || [];
  window.ficheChartPeriod = window.ficheChartPeriod || 30;
  window.ficheChartInst = window.ficheChartInst || null;
  window.compositeChartInst = window.compositeChartInst || null;
  window.techChartInst = window.techChartInst || null;
  window.techVolInst = window.techVolInst || null;
  window.pfValueChartInst = window.pfValueChartInst || null;
  window.pfSectorChartInst = window.pfSectorChartInst || null;
  window.pfGeoChartInst = window.pfGeoChartInst || null;
  window.pfPLChartInst = window.pfPLChartInst || null;
  window.prevView = window.prevView || 'titres';
  window._titreFilter = window._titreFilter || 'all';
  window._bocFilter = window._bocFilter || 'all';
  window._analyseFilter = window._analyseFilter || 'all';
  window._pubFilter = window._pubFilter || 'all';
  window._sortState = window._sortState || {};
  window.entMap = window.entMap || {};
  window._fundMethod = window._fundMethod || 'tcam';

  // Alias locaux pour compatibilité avec le code existant
  var allCours = window.allCours;
  var allBoc = window.allBoc;
  var allAnalyses = window.allAnalyses;
  var allFinancials = window.allFinancials;
  var allEntreprises = window.allEntreprises;
  var allIndices = window.allIndices;
  var allCoursHistorique = window.allCoursHistorique;
  var ficheHistorique = window.ficheHistorique;
  var ficheChartPeriod = window.ficheChartPeriod;
  var ficheChartInst = window.ficheChartInst;
  var compositeChartInst = window.compositeChartInst;
  var techChartInst = window.techChartInst;
  var techVolInst = window.techVolInst;
  var pfValueChartInst = window.pfValueChartInst;
  var pfSectorChartInst = window.pfSectorChartInst;
  var pfGeoChartInst = window.pfGeoChartInst;
  var pfPLChartInst = window.pfPLChartInst;
  var prevView = window.prevView;
  var _titreFilter = window._titreFilter;
  var _bocFilter = window._bocFilter;
  var _analyseFilter = window._analyseFilter;
  var _pubFilter = window._pubFilter;
  var _sortState = window._sortState;
  var entMap = window.entMap;
  var _fundMethod = window._fundMethod;
}
