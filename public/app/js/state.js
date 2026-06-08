// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════

let allCours = [], allBoc = [], allAnalyses = [], allFinancials = [], allEntreprises = [], allIndices = [];
let allCoursHistorique = [];  // ← AJOUTÉ : données historiques des cours
let ficheHistorique = [], ficheChartPeriod = 30;
let ficheChartInst = null, compositeChartInst = null, techChartInst = null, techVolInst = null;
let prevView = 'titres';
let _titreFilter = 'all', _bocFilter = 'all', _analyseFilter = 'all', _pubFilter = 'all';
let _sortState = {};
let entMap = {};
let _fundMethod = 'tcam';

// ── Chart instances Portefeuille ──
let pfValueChartInst = null;
let pfSectorChartInst = null;
let pfGeoChartInst = null;
let pfPLChartInst = null;
