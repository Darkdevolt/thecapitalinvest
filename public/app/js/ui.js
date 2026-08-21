// ═══════════════════════════════════════
// UI, Table Sort + Shared
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
// STATUT DE SÉANCE — source canonique de publication
// Une séance incomplète n'est jamais utilisée comme séance publique courante.
// ═══════════════════════════════════════
let marketSessionStatus = null;

async function loadMarketSessionStatus() {
  try {
    const status = await window.apiGet('/session-status');
    marketSessionStatus = status || null;
    renderMarketSessionStatus(status);
    return status;
  } catch (e) {
    console.warn('[SESSION] Impossible de contrôler la séance:', e);
    renderMarketSessionStatus(null, e.message);
    return null;
  }
}

function renderMarketSessionStatus(status, errorMessage) {
  let el = document.getElementById('tc-market-session-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tc-market-session-status';
    el.style.cssText = 'margin:12px 0 18px;padding:12px 16px;border:1px solid var(--border,#333);border-radius:6px;font-size:12px;line-height:1.5;';
    const target = document.querySelector('main') || document.querySelector('.main') || document.body;
    target.prepend(el);
  }

  if (errorMessage) {
    el.textContent = 'Données de marché : contrôle de séance temporairement indisponible.';
    return;
  }
  if (!status) return;

  const latest = status.latest_status || {};
  if (status.confirmed && status.confirmed_date) {
    const currentIsConfirmed = latest.date === status.confirmed_date && latest.complete;
    el.innerHTML = '<strong style="color:var(--gold,#d8bd78)">✓ SÉANCE '+(currentIsConfirmed?'CONFIRMÉE':'CONFIRMÉE DE RÉFÉRENCE')+'</strong> · '+status.confirmed_date+' · données complètes et contrôlées.' +
      (currentIsConfirmed ? '' : ' La dernière séance détectée ('+(latest.date||'—')+') n’est pas encore complète ; les données affichées restent celles de la dernière séance confirmée.');
    return;
  }
  el.innerHTML = '<strong>⚠ DONNÉES DE MARCHÉ EN ATTENTE DE CONFIRMATION</strong> · '+(latest.date||'Aucune séance disponible')+'. La séance courante présente encore des éléments manquants ou incohérents.';
}

// ═══════════════════════════════════════
// LOAD — marché via la source canonique historique Supabase
// ═══════════════════════════════════════
async function loadAll() {
  try {
    const results = await Promise.allSettled([
      window.apiGet('/session-status'),
      sb('boc', { order: 'date_seance.desc', limit: 200 }),
      sb('analyses', { order: 'date_analyse.desc', limit: 100 }),
      sb('financials', { order: 'annee.desc,periode.desc', limit: 500 }),
      sb('entreprises', { limit: 500 }),
    ]);

    const sessionResult = results[0];
    if (sessionResult.status === 'fulfilled') {
      marketSessionStatus = sessionResult.value || null;
      renderMarketSessionStatus(marketSessionStatus);
      const payload = sessionResult.value || {};
      allCours = Array.isArray(payload.cours) ? payload.cours : [];
      allIndices = Array.isArray(payload.indices) ? payload.indices : [];
    } else {
      allCours = [];
      allIndices = [];
      renderMarketSessionStatus(null, String(sessionResult.reason || ''));
      toast('Erreur contrôle séance: ' + sessionResult.reason, 'error');
    }

    if (results[1].status === 'fulfilled') allBoc = results[1].value || [];
    else toast('Erreur chargement BOC: ' + results[1].reason, 'error');

    if (results[2].status === 'fulfilled') allAnalyses = results[2].value || [];
    else toast('Erreur chargement analyses: ' + results[2].reason, 'error');

    if (results[3].status === 'fulfilled') allFinancials = results[3].value || [];
    else toast('Erreur chargement financiers: ' + results[3].reason, 'error');

    if (results[4].status === 'fulfilled') allEntreprises = results[4].value || [];
    else toast('Erreur chargement entreprises: ' + results[4].reason, 'error');

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
