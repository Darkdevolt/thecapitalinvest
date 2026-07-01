// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — UTILITAIRES (CORRIGÉ — pas de redéclaration)
// ═══════════════════════════════════════════════════════
// NOTE : getSector() et getPays() sont dans utils.js (100% Supabase)
// On supprime les doublons ici pour éviter les conflits.
// ═══════════════════════════════════════════════════════

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

// — MATHS / STATS —
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
  let peak = values[0], maxDD = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) peak = values[i];
    const dd = (peak - values[i]) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function calcCorrelation(arr1, arr2) {
  const n = Math.min(arr1.length, arr2.length);
  if (n < 2) return 0;
  const a1 = arr1.slice(-n), a2 = arr2.slice(-n);
  const m1 = a1.reduce((s, v) => s + v, 0) / n;
  const m2 = a2.reduce((s, v) => s + v, 0) / n;
  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = a1[i] - m1, d2 = a2[i] - m2;
    num += d1 * d2; den1 += d1 * d1; den2 += d2 * d2;
  }
  const den = Math.sqrt(den1 * den2);
  return den === 0 ? 0 : num / den;
}

// — DIVIDEND YIELD —
function getDividendYield(ticker) {
  if (!ticker || !window.allFinancials) return 0;
  const t = ticker.toUpperCase().trim();
  const fin = window.allFinancials.find(f => (f.ticker || '').toUpperCase().trim() === t && f.dpa != null);
  if (!fin) return 0;
  const price = getLatestPrice(ticker);
  if (!price || price <= 0) return 0;
  return (fin.dpa / price) * 100;
}

// — CMP (Coût Moyen Pondéré) —
function calculateCMP(pf) {
  const map = {};
  pf.forEach(p => {
    const t = (p.ticker || '').toUpperCase().trim();
    if (!map[t]) map[t] = { totalQty: 0, totalCost: 0, positions: [] };
    map[t].totalQty += (+p.qty || 0);
    map[t].totalCost += (+p.qty || 0) * (+p.price || 0);
    map[t].positions.push(p);
  });
  const result = {};
  for (const t in map) {
    const data = map[t];
    result[t] = { value: data.totalQty > 0 ? data.totalCost / data.totalQty : 0, positions: data.positions };
  }
  return result;
}

// — HISTORIQUE PORTEFEUILLE —
function getPortfolioHistory(days) {
  const pf = getPortfolio();
  if (!pf.length) return { dates: [], values: [], pls: [] };

  const now = new Date(), cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  const allDates = new Set();
  pf.forEach(p => {
    const hist = getTickerHistory(p.ticker);
    hist.forEach(h => {
      const d = new Date(h.date_seance || 0);
      if (d >= cutoff && d <= now) allDates.add(d.toISOString().split('T')[0]);
    });
  });

  const sortedDates = Array.from(allDates).sort();
  const dates = [], values = [], pls = [];
  let totalInvested = 0;
  pf.forEach(p => { totalInvested += (+p.qty || 0) * (+p.price || 0); });

  sortedDates.forEach(dateStr => {
    const d = new Date(dateStr);
    let dayValue = 0, dayInvested = 0;
    pf.forEach(p => {
      const price = getPriceAtDate(p.ticker, dateStr);
      if (price != null && price > 0) {
        dayValue += (+p.qty || 0) * price;
        dayInvested += (+p.qty || 0) * (+p.price || 0);
      }
    });
    if (dayValue > 0) { dates.push(d); values.push(dayValue); pls.push(dayValue - dayInvested); }
  });
  return { dates, values, pls };
}
