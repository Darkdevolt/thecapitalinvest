// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — UTILITAIRES (v3)
// NOTE : getSector() et getPays() sont dans utils.js
// ═══════════════════════════════════════════════════════

function getPortfolio() {
  try { return JSON.parse(localStorage.getItem('tc_portfolio') || '[]'); }
  catch { return []; }
}
function savePortfolio(data) {
  try { localStorage.setItem('tc_portfolio', JSON.stringify(data)); return true; }
  catch (e) { console.error('savePortfolio échec:', e); return false; }
}

function getCash() {
  try { return +JSON.parse(localStorage.getItem('tc_cash') || '0') || 0; }
  catch { return 0; }
}
function saveCash(amount) {
  try { localStorage.setItem('tc_cash', JSON.stringify(+amount || 0)); return true; }
  catch (e) { console.error('saveCash échec:', e); return false; }
}

function getDividends() {
  try { return JSON.parse(localStorage.getItem('tc_dividends') || '[]'); }
  catch { return []; }
}
function saveDividends(data) {
  try { localStorage.setItem('tc_dividends', JSON.stringify(data)); return true; }
  catch (e) { console.error('saveDividends échec:', e); return false; }
}

// — TRANSACTIONS (journal unifié : achats, ventes, dividendes, cash) —
function getTransactions() {
  try { return JSON.parse(localStorage.getItem('tc_transactions') || '[]'); }
  catch { return []; }
}
function saveTransactions(data) {
  try { localStorage.setItem('tc_transactions', JSON.stringify(data)); return true; }
  catch (e) { console.error('saveTransactions échec:', e); return false; }
}
function logTransaction(tx) {
  const list = getTransactions();
  list.push({ id: Date.now() + Math.random(), ...tx });
  saveTransactions(list);
}
function getRealizedPL() {
  return getTransactions().filter(t => t.type === 'sell').reduce((s, t) => s + (+t.realizedPL || 0), 0);
}

// — WATCHLIST —
function getWatchlist() {
  try { return JSON.parse(localStorage.getItem('tc_watchlist') || '[]'); }
  catch { return []; }
}
function saveWatchlist(data) {
  try { localStorage.setItem('tc_watchlist', JSON.stringify(data)); return true; }
  catch (e) { console.error('saveWatchlist échec:', e); return false; }
}

// — ALERTES DE PRIX —
function getAlerts() {
  try { return JSON.parse(localStorage.getItem('tc_alerts') || '[]'); }
  catch { return []; }
}
function saveAlerts(data) {
  try { localStorage.setItem('tc_alerts', JSON.stringify(data)); return true; }
  catch (e) { console.error('saveAlerts échec:', e); return false; }
}

// — OBJECTIF DE PORTEFEUILLE —
function getGoal() {
  try { return JSON.parse(localStorage.getItem('tc_goal') || 'null'); }
  catch { return null; }
}
function saveGoal(data) {
  try { localStorage.setItem('tc_goal', JSON.stringify(data)); return true; }
  catch (e) { console.error('saveGoal échec:', e); return false; }
}

// — ALLOCATIONS CIBLES (rééquilibrage) —
function getTargetAllocation() {
  try { return JSON.parse(localStorage.getItem('tc_target_alloc') || '{}'); }
  catch { return {}; }
}
function saveTargetAllocation(data) {
  try { localStorage.setItem('tc_target_alloc', JSON.stringify(data)); return true; }
  catch (e) { console.error('saveTargetAllocation échec:', e); return false; }
}

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
    if (peak > 0) {
      const dd = (peak - values[i]) / peak;
      if (dd > maxDD) maxDD = dd;
    }
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

// — TOAST (remplace alert()) —
function toast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

// — EXPORT CSV —
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.exportPositionsCSV = function(rows) {
  if (!rows || !rows.length) { toast('Aucune position à exporter.', 'error'); return; }
  const header = ['Ticker', 'Pays', 'Secteur', 'Quantité', 'CMP', 'Cours actuel', 'Valeur', 'P&L', 'P&L %', 'Allocation %'];
  const data = rows.map(r => [
    r.ticker, r.pays, r.sector, r.qty,
    (+r.cmp).toFixed(2), (+r.currentPrice).toFixed(2), (+r.value).toFixed(0),
    (+r.pl).toFixed(0), (+r.plPct).toFixed(2), (+(r.allocation || 0)).toFixed(2)
  ]);
  downloadCSV(`portefeuille_positions_${new Date().toISOString().split('T')[0]}.csv`, [header, ...data]);
  toast('Export des positions généré.', 'success');
};

window.exportTransactionsCSV = function() {
  const txs = getTransactions().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!txs.length) { toast('Aucune transaction à exporter.', 'error'); return; }
  const header = ['Date', 'Type', 'Ticker', 'Quantité', 'Prix/Montant', 'P&L Réalisé'];
  const data = txs.map(t => [
    t.date, t.type, t.ticker || '-', t.qty || '-',
    t.price != null ? t.price : (t.amount != null ? t.amount : '-'),
    t.realizedPL != null ? (+t.realizedPL).toFixed(0) : '-'
  ]);
  downloadCSV(`portefeuille_transactions_${new Date().toISOString().split('T')[0]}.csv`, [header, ...data]);
  toast('Export des transactions généré.', 'success');
};
