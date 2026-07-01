// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — UTILITAIRES
// ═══════════════════════════════════════════════════════

// Variables globales pour les graphiques (déclarées ici pour être accessibles partout)
let pfValueChartInst = null;
let pfSectorChartInst = null;
let pfGeoChartInst = null;
let pfPLChartInst = null;


function getPortfolio() {
  try { return JSON.parse(localStorage.getItem('tc_portfolio') || '[]'); }
  catch { return []; }
}
function savePortfolio(data) { localStorage.setItem('tc_portfolio', JSON.stringify(data)); }

function getCash() {
  try { return JSON.parse(localStorage.getItem('tc_cash') || '0'); }
  catch { return 0; }
}
function saveCash(amount) { localStorage.setItem('tc_cash', JSON.stringify(amount)); }

function getDividends() {
  try { return JSON.parse(localStorage.getItem('tc_dividends') || '[]'); }
  catch { return []; }
}
function saveDividends(data) { localStorage.setItem('tc_dividends', JSON.stringify(data)); }

// ── MATHS / STATS ──
function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function calcVolatility(returns) {
  if (!returns || returns.length < 2) return 0;
  return stdDev(returns) * Math.sqrt(252);
}

function calcSharpe(returns, riskFreeRate = 0.05) {
  if (!returns || returns.length < 2) return 0;
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const vol = stdDev(returns);
  if (vol === 0) return 0;
  return (meanReturn * 252 - riskFreeRate) / (vol * Math.sqrt(252));
}

function calcMaxDrawdown(values) {
  if (!values || values.length < 2) return 0;
  let maxDD = 0, peak = values[0];
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function calcCorrelation(x, y) {
  if (!x || !y || x.length < 2 || x.length !== y.length) return 0;
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// ── CMP (COÛT MOYEN PONDÉRÉ) ──
function calculateCMP(positions) {
  const byTicker = {};
  positions.forEach(p => {
    const t = p.ticker.toUpperCase().trim();
    if (!byTicker[t]) {
      byTicker[t] = { totalQty: 0, totalCost: 0, positions: [] };
    }
    byTicker[t].totalQty += p.qty;
    byTicker[t].totalCost += p.qty * p.price;
    byTicker[t].positions.push(p);
  });

  const cmp = {};
  for (const [ticker, data] of Object.entries(byTicker)) {
    cmp[ticker] = {
      value: data.totalQty > 0 ? data.totalCost / data.totalQty : 0,
      totalQty: data.totalQty,
      totalCost: data.totalCost,
      positions: data.positions
    };
  }
  return cmp;
}

// ── DONNÉES SECTEUR / PAYS / DIVIDENDES ──
function getSector(ticker) {
  if (!ticker) return 'Divers';
  const t = ticker.toUpperCase().trim();

  // 1. Priorité: données Supabase (entreprises)
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.secteur) return ent.secteur;

  // 2. Fallback: variable globale SECTORS si définie ailleurs
  if (typeof SECTORS !== 'undefined') {
    for (const [k, v] of Object.entries(SECTORS)) {
      if (t.startsWith(k)) return v;
    }
  }

  return 'Divers';
}

function getPays(ticker) {
  if (!ticker) return 'Inconnu';
  const t = ticker.toUpperCase().trim();

  // 1. Priorité: données Supabase (entreprises)
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.pays) return ent.pays;

  // 2. Fallback: déduire du suffixe du ticker (standard BRVM)
  if (t.endsWith('SN')) return 'Sénégal';
  if (t.endsWith('CI')) return "Côte d'Ivoire";
  if (t.endsWith('BF')) return 'Burkina Faso';
  if (t.endsWith('BJ')) return 'Bénin';
  if (t.endsWith('TG')) return 'Togo';
  if (t.endsWith('ML')) return 'Mali';
  if (t.endsWith('NE')) return 'Niger';
  if (t.endsWith('GW')) return 'Guinée-Bissau';
  if (t.endsWith('CM')) return 'Cameroun';

  return 'Inconnu';
}

function getDividendYield(ticker) {
  if (!ticker) return 0;
  const t = ticker.toUpperCase().trim();
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.dividende_yield != null) return +ent.dividende_yield;
  if (Array.isArray(window.allCours)) {
    const c = window.allCours.find(x => (x.ticker || '').toUpperCase().trim() === t);
    if (c && c.dividende_yield != null) return +c.dividende_yield;
    if (c && c.rendement != null) return +c.rendement;
  }
  return 0;
}
