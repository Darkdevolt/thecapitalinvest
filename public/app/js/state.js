// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let allCours = [], allBoc = [], allAnalyses = [], allFinancials = [], allEntreprises = [], allIndices = [];
let ficheHistorique = [], ficheChartPeriod = 30;
let ficheChartInst = null, compositeChartInst = null, techChartInst = null, techVolInst = null;
let prevView = 'titres';
let _titreFilter = 'all', _bocFilter = 'all', _analyseFilter = 'all', _pubFilter = 'all';
let _sortState = {};
let entMap = {};
let _fundMethod = 'tcam';