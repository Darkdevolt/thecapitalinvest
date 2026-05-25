// ═══════════════════════════════════════
// UI — Table Sort + Shared
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// TABLE SORT
// ═══════════════════════════════════════
function sortTable(tbodyId, colIndex) {
  const tbody = document.getElementById(tbodyId);
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const key = tbodyId + '-' + colIndex;
  const dir = _sortState[key] === 'asc' ? 'desc' : 'asc';
  _sortState[key] = dir;
  rows.sort((a, b) => {
    let av = a.cells[colIndex]?.textContent.trim() || '';
    let bv = b.cells[colIndex]?.textContent.trim() || '';
    const an = parseFloat(av.replace(/[^\d\-,.]/g, '').replace(',', '.'));
    const bn = parseFloat(bv.replace(/[^\d\-,.]/g, '').replace(',', '.'));
    if (!isNaN(an) && !isNaN(bn)) return dir === 'asc' ? an - bn : bn - an;
    return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  rows.forEach(r => tbody.appendChild(r));
}

// ═══════════════════════════════════════
// LOAD — 100% SUPABASE, PAS DE DEMO
// ═══════════════════════════════════════
async function loadAll() {
  try {
    const results = await Promise.allSettled([
      sb('cours_latest', {}),
      sb('boc', { order: 'date_seance.desc', limit: 200 }),
      sb('analyses', { order: 'date_analyse.desc', limit: 100 }),
      sb('financials', { order: 'annee.desc,periode.desc', limit: 500 }),
      sb('entreprises', { limit: 500 }),
      sb('indices', { order: 'date_seance.desc', limit: 90 }),
    ]);

    if (results[0].status === 'fulfilled') allCours = results[0].value || [];
    else toast('Erreur chargement cours: ' + results[0].reason, 'error');

    if (results[1].status === 'fulfilled') allBoc = results[1].value || [];
    else toast('Erreur chargement BOC: ' + results[1].reason, 'error');

    if (results[2].status === 'fulfilled') allAnalyses = results[2].value || [];
    else toast('Erreur chargement analyses: ' + results[2].reason, 'error');

    if (results[3].status === 'fulfilled') allFinancials = results[3].value || [];
    else toast('Erreur chargement financiers: ' + results[3].reason, 'error');

    if (results[4].status === 'fulfilled') allEntreprises = results[4].value || [];
    else toast('Erreur chargement entreprises: ' + results[4].reason, 'error');

    if (results[5].status === 'fulfilled') allIndices = results[5].value || [];
    else { 
      allIndices = [];
      toast('Erreur chargement indices: ' + results[5].reason, 'warn');
    }

    entMap = Object.fromEntries(allEntreprises.map(e => [e.ticker, e]));

    renderOverview();
    renderTitres();
    renderBoc();
    renderAnalyses();
    renderFinancials();
    renderPublications();
    populateTickerSelects();
    atInit();
    initGlobalSearch();
    runScreener();
    renderPortfolio();
    renderAlerts();
    parseHash();
  } catch(e) {
    toast('Erreur globale de chargement: ' + e.message, 'error');
  }
}

function populateTickerSelects() {
  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const tickers = Object.keys(byTicker).sort();
  const opts = tickers.map(t => `<option value="${t}">${t}</option>`).join('');

  const pf = document.getElementById('pfTicker');
  if (pf) pf.innerHTML = '<option value="">Ticker...</option>' + opts;

  const al = document.getElementById('alertTicker');
  if (al) al.innerHTML = '<option value="">Ticker...</option>' + opts;

  const fu = document.getElementById('fundTickerSelect');
  if (fu) fu.innerHTML = '<option value="">Choisir un ticker...</option>' + opts;
}