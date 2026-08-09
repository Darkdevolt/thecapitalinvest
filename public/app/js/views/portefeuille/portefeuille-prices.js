// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — PRIX & HISTORIQUES
// Source de cours : pipeline marché existant (/api/marche).
// Le portefeuille ne crée aucune source de prix parallèle.
// ═══════════════════════════════════════════════════════

if (typeof window._pfHistCache === 'undefined') window._pfHistCache = {};
let _pfMarketHydration = null;
let _pfHistoryHydration = null;
let _pfLastMarketSignature = '';

function _normaliseCours(row) {
  if (!row || !row.ticker) return null;
  const ticker = String(row.ticker).toUpperCase().trim();
  const prix = row.cours_cloture ?? row.dernier_cours ?? row.cours ?? row.cloture;
  if (!ticker || prix == null || !Number.isFinite(Number(prix))) return null;
  return { ...row, ticker, cours: Number(prix), cours_cloture: Number(prix) };
}

function _applyMarketRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const normalised = rows.map(_normaliseCours).filter(Boolean);
  if (!normalised.length) return false;
  window.allCours = normalised;
  const signature = normalised.map(x => `${x.ticker}:${x.cours}`).sort().join('|');
  if (signature !== _pfLastMarketSignature) {
    _pfLastMarketSignature = signature;
    window.dispatchEvent(new CustomEvent('portfolio:prices-ready', { detail: { count: normalised.length } }));
    if (typeof window.renderPortfolio === 'function') {
      try { window.renderPortfolio(); } catch (error) { console.error('[PORTFOLIO PRICES] Render:', error); }
    }
  }
  return true;
}

async function hydratePortfolioMarketPrices() {
  if (Array.isArray(window.allCours) && window.allCours.length) {
    _applyMarketRows(window.allCours);
    return window.allCours;
  }
  if (_pfMarketHydration) return _pfMarketHydration;
  _pfMarketHydration = fetch('/api/marche?type=cours', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(payload => {
      const rows = Array.isArray(payload) ? payload : (payload?.data || payload?.cours || []);
      _applyMarketRows(rows);
      return window.allCours || [];
    })
    .catch(error => {
      console.error('[PORTFOLIO PRICES] Impossible de charger les cours:', error.message);
      return window.allCours || [];
    })
    .finally(() => { _pfMarketHydration = null; });
  return _pfMarketHydration;
}

function _historicalLimitForPortfolio(tickers) {
  const transactions = typeof window.getTransactions === 'function' ? window.getTransactions() : [];
  const wanted = new Set((tickers || []).map(t => String(t || '').toUpperCase().trim()));
  const dates = transactions
    .filter(tx => wanted.has(String(tx.ticker || '').toUpperCase().trim()))
    .map(tx => new Date(tx.date_transaction || tx.date))
    .filter(d => !Number.isNaN(d.getTime()));
  if (!dates.length) return 365;
  const oldest = Math.min(...dates.map(d => d.getTime()));
  const days = Math.ceil((Date.now() - oldest) / 86400000) + 10;
  return Math.max(365, Math.min(days, 20000));
}

async function hydratePortfolioHistoricalPrices(tickers, limit = null) {
  const unique = [...new Set((tickers || []).map(t => String(t || '').toUpperCase().trim()).filter(Boolean))];
  if (!unique.length) return {};
  const missing = unique.filter(t => !Array.isArray(window._pfHistCache[t]) || window._pfHistCache[t].length === 0);
  if (!missing.length) return Object.fromEntries(unique.map(t => [t, window._pfHistCache[t]]));
  if (_pfHistoryHydration) return _pfHistoryHydration;

  const effectiveLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : _historicalLimitForPortfolio(unique);
  _pfHistoryHydration = Promise.all(missing.map(async ticker => {
    try {
      const response = await fetch(`/api/marche?type=historique&ticker=${encodeURIComponent(ticker)}&limit=${effectiveLimit}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const rows = (Array.isArray(payload) ? payload : (payload?.data || [])).filter(r => r && r.date_seance);
      rows.sort((a,b) => new Date(a.date_seance) - new Date(b.date_seance));
      window._pfHistCache[ticker] = rows;
      return [ticker, rows];
    } catch (error) {
      console.error(`[PORTFOLIO PRICES] Historique ${ticker}:`, error.message);
      window._pfHistCache[ticker] = [];
      return [ticker, []];
    }
  })).then(() => {
    const merged = {};
    unique.forEach(t => { merged[t] = window._pfHistCache[t] || []; });
    window.allCoursHistorique = unique.flatMap(t => merged[t] || []);
    window.dispatchEvent(new CustomEvent('portfolio:history-ready', { detail: { tickers: unique, rows: unique.reduce((n,t) => n + (merged[t]?.length || 0), 0) } }));
    if (typeof window.renderPortfolio === 'function') {
      try { window.renderPortfolio(); } catch (error) { console.error('[PORTFOLIO PRICES] Historical render:', error); }
    }
    return merged;
  }).finally(() => { _pfHistoryHydration = null; });
  return _pfHistoryHydration;
}

function getLatestPrice(ticker) {
  if (!ticker) return null;
  const t = ticker.toUpperCase().trim();
  if (Array.isArray(window.allCours) && window.allCours.length > 0) {
    let coursJour = window.allCours.find(c => (c.ticker || '').toUpperCase().trim() === t);
    if (!coursJour) coursJour = window.allCours.find(c => { const ct = (c.ticker || '').toUpperCase().trim(); return ct.startsWith(t) || t.startsWith(ct); });
    if (coursJour) {
      const prix = coursJour.cours_cloture ?? coursJour.dernier_cours ?? coursJour.cours;
      if (prix != null && Number.isFinite(Number(prix))) return +prix;
    }
  }
  const cache = window._pfHistCache[t];
  if (cache && cache.length > 0) {
    const last = cache[cache.length - 1];
    const prix = last.cours_cloture ?? last.cours_normal ?? last.cours;
    if (prix != null && Number.isFinite(Number(prix))) return +prix;
  }
  if (Array.isArray(window.allCoursHistorique) && window.allCoursHistorique.length > 0) {
    const hist = window.allCoursHistorique.filter(c => (c.ticker || '').toUpperCase().trim() === t).sort((a,b) => new Date(b.date_seance || 0) - new Date(a.date_seance || 0));
    if (hist.length) {
      const last = hist[0];
      const prix = last.cours_cloture ?? last.cours_normal ?? last.cours;
      if (prix != null && Number.isFinite(Number(prix))) return +prix;
    }
  }
  return null;
}

function getTickerHistory(ticker) {
  if (!ticker) return [];
  const t = ticker.toUpperCase().trim();
  if (window._pfHistCache[t] && window._pfHistCache[t].length > 0) return window._pfHistCache[t];
  if (Array.isArray(window.allCoursHistorique) && window.allCoursHistorique.length > 0) {
    const hist = window.allCoursHistorique.filter(c => (c.ticker || '').toUpperCase().trim() === t).sort((a,b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0));
    if (hist.length > 0) { window._pfHistCache[t] = hist; return hist; }
  }
  return [];
}

function invalidateTickerHistoryCache(ticker) { if (ticker) delete window._pfHistCache[(ticker || '').toUpperCase().trim()]; else window._pfHistCache = {}; }

function _findPriceOnOrBefore(hist, dateStr) {
  let lo = 0, hi = hist.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = (hist[mid].date_seance || '').split('T')[0];
    if (d <= dateStr) { result = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return result >= 0 ? hist[result] : null;
}

function getPriceAtDate(ticker, dateStr) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;
  const found = _findPriceOnOrBefore(hist, dateStr);
  if (!found) return null;
  const prix = +(found.cours_cloture ?? found.cours_normal ?? found.cours ?? 0);
  return prix > 0 ? prix : null;
}

function _weekRange(ticker) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  return hist.filter(row => new Date(row.date_seance || 0) >= cutoff);
}

function get52WeekHigh(ticker) {
  const vals = _weekRange(ticker).map(c => +(c.cours_cloture ?? c.cours_normal ?? c.cours ?? c.haut ?? 0)).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

function get52WeekLow(ticker) {
  const vals = _weekRange(ticker).map(c => +(c.cours_cloture ?? c.cours_normal ?? c.cours ?? c.bas ?? 0)).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : null;
}

function _portfolioTickers() {
  try {
    if (typeof window.getPortfolio === 'function') return [...new Set(window.getPortfolio().map(p => String(p.ticker || '').toUpperCase().trim()).filter(Boolean))];
  } catch (_) {}
  return [];
}

async function hydratePortfolioHistoryForCurrentPositions() {
  const tickers = _portfolioTickers();
  if (!tickers.length) return;
  try { await hydratePortfolioHistoricalPrices(tickers); }
  catch (error) { console.warn('[PORTFOLIO PRICES] Hydratation historique:', error); }
}

window.addEventListener('portfolio:updated', hydratePortfolioHistoryForCurrentPositions);
window.addEventListener('portfolio:store-ready', hydratePortfolioHistoryForCurrentPositions);
window.addEventListener('portfolio:prices-ready', hydratePortfolioHistoryForCurrentPositions);
window.addEventListener('dataLoaded', hydratePortfolioHistoryForCurrentPositions);

hydratePortfolioMarketPrices();
setTimeout(hydratePortfolioHistoryForCurrentPositions, 0);

// ═══════════════════════════════════════════════════════
// VALIDATION DES TRANSACTIONS SUR LA SÉANCE RÉELLE
// ═══════════════════════════════════════════════════════
async function _ensureHistoryForTrade(ticker) {
  const t = String(ticker || '').toUpperCase().trim();
  if (!t) return [];
  const cached = getTickerHistory(t);
  if (cached.length) return cached;
  await hydratePortfolioHistoricalPrices([t], 1000);
  return getTickerHistory(t);
}

function _sessionForDate(hist, dateStr) {
  const wanted = String(dateStr || '').slice(0, 10);
  if (!wanted) return null;
  return (hist || []).find(row => String(row.date_seance || '').slice(0, 10) === wanted) || null;
}

function _sessionOHLC(row) {
  if (!row) return null;
  const open = Number(row.cours_ouverture ?? row.ouverture ?? NaN);
  const close = Number(row.cours_cloture ?? row.cloture ?? row.cours_normal ?? NaN);
  const high = Number(row.plus_haut ?? row.haut ?? NaN);
  const low = Number(row.plus_bas ?? row.bas ?? NaN);
  const finite = [open, close, high, low].filter(Number.isFinite);
  if (!finite.length) return null;
  const lower = Number.isFinite(low) ? low : Math.min(...finite);
  const upper = Number.isFinite(high) ? high : Math.max(...finite);
  return { open, close, high: upper, low: lower };
}

window.getTradingSession = async function(ticker, dateStr) {
  const hist = await _ensureHistoryForTrade(ticker);
  const row = _sessionForDate(hist, dateStr);
  const ohlc = _sessionOHLC(row);
  return row && ohlc ? { date: String(row.date_seance).slice(0,10), row, ...ohlc } : null;
};

window.validatePortfolioTradePrice = async function(ticker, dateStr, price) {
  const session = await window.getTradingSession(ticker, dateStr);
  if (!session) return { ok: false, message: `Aucune séance de cotation trouvée pour ${ticker} le ${dateStr}. Choisissez une date de marché.` };
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return { ok: false, message: 'Le prix doit être supérieur à zéro.' };
  if (p < session.low || p > session.high) {
    const f = v => Number.isFinite(v) ? Number(v).toLocaleString('fr-FR',{maximumFractionDigits:2}) : '—';
    return { ok: false, message: `Prix invalide pour ${ticker} le ${session.date}. Fourchette autorisée : ${f(session.low)} – ${f(session.high)} FCFA. Ouverture : ${f(session.open)} · Clôture : ${f(session.close)}.` };
  }
  return { ok: true, session };
};

function _tradeHintText(session) {
  if (!session) return '';
  const f = v => Number.isFinite(v) ? (typeof window.fmt === 'function' ? window.fmt(v, 2) : Number(v).toFixed(2)) : '—';
  return `Séance ${session.date} · Ouv. <strong>${f(session.open)}</strong> · Haut <strong>${f(session.high)}</strong> · Bas <strong>${f(session.low)}</strong> · Clôt. <strong>${f(session.close)}</strong> FCFA`;
}

function _setTradeHint(id, session, message = '') {
  const priceEl = document.getElementById(id);
  if (!priceEl) return;
  let hint = document.getElementById(`${id}SessionHint`);
  if (!hint) {
    hint = document.createElement('div');
    hint.id = `${id}SessionHint`;
    hint.style.cssText = 'font-size:11px;color:var(--dim);margin-top:6px;line-height:1.5';
    priceEl.parentElement?.appendChild(hint);
  }
  hint.innerHTML = session ? _tradeHintText(session) : message;
}

async function _refreshTradeSessionHint(tickerId, dateId, priceId) {
  const ticker = document.getElementById(tickerId)?.value;
  const date = document.getElementById(dateId)?.value;
  const priceEl = document.getElementById(priceId);
  if (!ticker || !date || !priceEl) return;
  _setTradeHint(priceId, null, 'Vérification de la séance…');
  try {
    const session = await window.getTradingSession(ticker, date);
    if (!session) {
      _setTradeHint(priceId, null, `Aucune séance trouvée le ${date}. La transaction sera refusée.`);
      return;
    }
    _setTradeHint(priceId, session);
    if (!priceEl.value || priceEl.dataset.sessionAuto === 'true') {
      if (Number.isFinite(session.close) && session.close > 0) {
        priceEl.value = String(session.close);
        priceEl.dataset.sessionAuto = 'true';
      }
    }
  } catch (_) {
    _setTradeHint(priceId, null, 'Impossible de vérifier la séance. La transaction sera refusée si le cours ne peut pas être vérifié.');
  }
}

function _installTradeFieldBindings() {
  const bindings = [['pfTicker','pfDate','pfPrice'],['pfSellTicker','pfSellDate','pfSellPrice'],['sellTicker','sellDate','sellPrice']];
  bindings.forEach(([tickerId,dateId,priceId]) => {
    const t = document.getElementById(tickerId), d = document.getElementById(dateId), p = document.getElementById(priceId);
    if (!t || !d || !p || p.dataset.sessionBound === 'true') return;
    p.dataset.sessionBound = 'true';
    t.addEventListener('change', () => _refreshTradeSessionHint(tickerId,dateId,priceId));
    d.addEventListener('change', () => _refreshTradeSessionHint(tickerId,dateId,priceId));
    p.addEventListener('input', () => { p.dataset.sessionAuto = 'false'; });
  });
}

document.addEventListener('DOMContentLoaded', _installTradeFieldBindings);
setInterval(_installTradeFieldBindings, 1000);

// ═══════════════════════════════════════════════════════
// BENCHMARK — BRVM COMPOSITE
// ═══════════════════════════════════════════════════════
let _pfBenchmarkCache = null;
async function _loadBRVMComposite() {
  if (_pfBenchmarkCache) return _pfBenchmarkCache;
  try {
    const response = await fetch('/api/marche?type=indices', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const rows = (Array.isArray(payload) ? payload : (payload?.data || [])).filter(r => {
      const name = String(r.indice || r.index || '').toUpperCase().replace(/[-_]/g,' ').trim();
      return name === 'BRVM COMPOSITE' || name === 'BRVM C' || name === 'BRVMC';
    }).map(r => ({ date: String(r.date_seance || r.date || '').slice(0,10), value: Number(r.valeur ?? r.value ?? NaN) }))
      .filter(r => r.date && Number.isFinite(r.value) && r.value > 0);
    rows.sort((a,b) => a.date.localeCompare(b.date));
    _pfBenchmarkCache = rows;
    return rows;
  } catch (error) {
    console.error('[PORTFOLIO BENCHMARK] BRVM Composite:', error.message);
    _pfBenchmarkCache = [];
    return [];
  }
}

async function _renderBRVMCompositeBenchmark() {
  const el = document.getElementById('benchmarkStats');
  if (!el) return;
  const rows = await _loadBRVMComposite();
  const hist = typeof window.getPortfolioHistory === 'function' ? window.getPortfolioHistory(window._pfPeriod || 99999) : { dates: [], returns: [] };
  if (rows.length < 2 || !hist?.dates?.length) {
    el.innerHTML = '<div style="padding:16px"><div style="font-size:11px;color:var(--dim);margin-bottom:6px">Performance vs BRVM Composite</div><strong style="font-size:20px;color:var(--dim)">—</strong><div style="font-size:12px;color:var(--dim);margin-top:6px">Benchmark indisponible : la série BRVM Composite disponible ne contient pas assez de séances pour un calcul fiable.</div></div>';
    return;
  }
  const portfolioDates = (hist.dates || []).map(d => String(d).slice(0,10));
  const firstCommon = portfolioDates.find(d => rows.some(r => r.date >= d));
  const benchmarkSlice = rows.filter(r => r.date >= (firstCommon || rows[0].date));
  if (benchmarkSlice.length < 2) {
    el.innerHTML = '<div style="padding:16px"><div style="font-size:11px;color:var(--dim);margin-bottom:6px">Performance vs BRVM Composite</div><strong style="font-size:20px;color:var(--dim)">—</strong><div style="font-size:12px;color:var(--dim);margin-top:6px">Pas assez de séances BRVM Composite sur la période comparable.</div></div>';
    return;
  }
  const benchmarkReturn = (benchmarkSlice[0].value > 0) ? (benchmarkSlice[benchmarkSlice.length-1].value / benchmarkSlice[0].value - 1) * 100 : null;
  const firstPortfolioIndex = portfolioDates.findIndex(d => d >= benchmarkSlice[0].date);
  const returns = Array.isArray(hist.returns) ? hist.returns : [];
  let portfolioReturn = null;
  if (firstPortfolioIndex >= 0 && returns.length) {
    const slice = returns.slice(Math.max(0, firstPortfolioIndex - 1)).filter(Number.isFinite);
    if (slice.length) portfolioReturn = (slice.reduce((a,r) => a * (1+r), 1) - 1) * 100;
  }
  if (portfolioReturn == null || benchmarkReturn == null) {
    el.innerHTML = '<div style="padding:16px"><div style="font-size:11px;color:var(--dim);margin-bottom:6px">Performance vs BRVM Composite</div><strong style="font-size:20px;color:var(--dim)">—</strong><div style="font-size:12px;color:var(--dim);margin-top:6px">Performance comparable indisponible sur cette période.</div></div>';
    return;
  }
  const alpha = portfolioReturn - benchmarkReturn;
  const pc = portfolioReturn >= 0 ? 'var(--green)' : 'var(--red)';
  const ac = alpha >= 0 ? 'var(--green)' : 'var(--red)';
  el.innerHTML = `<div style="padding:16px"><div style="font-size:11px;color:var(--dim);margin-bottom:8px">Performance vs BRVM Composite</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px"><div><div style="font-size:11px;color:var(--dim)">Portefeuille</div><strong style="font-size:20px;color:${pc}">${portfolioReturn >= 0 ? '+' : ''}${portfolioReturn.toFixed(2)}%</strong></div><div><div style="font-size:11px;color:var(--dim)">BRVM Composite</div><strong style="font-size:20px">${benchmarkReturn >= 0 ? '+' : ''}${benchmarkReturn.toFixed(2)}%</strong></div><div><div style="font-size:11px;color:var(--dim)">Surperformance</div><strong style="font-size:20px;color:${ac}">${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%</strong></div></div><div style="font-size:11px;color:var(--dim);margin-top:10px">Période comparable à partir du ${benchmarkSlice[0].date}.</div></div>`;
}

function _installPortfolioTradeAndBenchmarkHooks() {
  _installTradeFieldBindings();
  if (!window.__TC_PF_TRADE_WRAPPED__ && typeof window.addPosition === 'function') {
    const originalAdd = window.addPosition;
    window.addPosition = async function () {
      const ticker = document.getElementById('pfTicker')?.value;
      const date = document.getElementById('pfDate')?.value || new Date().toISOString().slice(0,10);
      const price = Number(document.getElementById('pfPrice')?.value);
      const result = await window.validatePortfolioTradePrice(ticker, date, price);
      if (!result.ok) { toast(result.message, 'error'); return; }
      return originalAdd.apply(this, arguments);
    };
    window.__TC_PF_TRADE_WRAPPED__ = true;
  }
  if (!window.__TC_PF_SELL_WRAPPED__ && typeof window.sellPositionQuick === 'function' && typeof window.confirmSell === 'function') {
    const originalQuick = window.sellPositionQuick;
    const originalConfirm = window.confirmSell;
    window.sellPositionQuick = async function () {
      const ticker = document.getElementById('pfSellTicker')?.value;
      const date = document.getElementById('pfSellDate')?.value || new Date().toISOString().slice(0,10);
      const price = Number(document.getElementById('pfSellPrice')?.value);
      const result = await window.validatePortfolioTradePrice(ticker, date, price);
      if (!result.ok) { toast(result.message, 'error'); return; }
      return originalQuick.apply(this, arguments);
    };
    window.confirmSell = async function () {
      const ticker = document.getElementById('sellTicker')?.value;
      const date = document.getElementById('sellDate')?.value || new Date().toISOString().slice(0,10);
      const price = Number(document.getElementById('sellPrice')?.value);
      const result = await window.validatePortfolioTradePrice(ticker, date, price);
      if (!result.ok) { toast(result.message, 'error'); return; }
      return originalConfirm.apply(this, arguments);
    };
    window.__TC_PF_SELL_WRAPPED__ = true;
  }
  if (!window.__TC_PF_EDIT_WRAPPED__ && typeof window.confirmEdit === 'function') {
    const originalEdit = window.confirmEdit;
    window.confirmEdit = async function () {
      const id = document.getElementById('editId')?.value;
      const pos = typeof window.getPortfolio === 'function' ? window.getPortfolio().find(p => String(p.id) === String(id)) : null;
      const result = await window.validatePortfolioTradePrice(pos?.ticker, document.getElementById('editDate')?.value, Number(document.getElementById('editPrice')?.value));
      if (!result.ok) { toast(result.message, 'error'); return; }
      return originalEdit.apply(this, arguments);
    };
    window.__TC_PF_EDIT_WRAPPED__ = true;
  }
  if (!window.__TC_PF_BENCHMARK_WRAPPED__ && typeof window.renderBenchmark === 'function') {
    window.renderBenchmark = _renderBRVMCompositeBenchmark;
    window.__TC_PF_BENCHMARK_WRAPPED__ = true;
    try { window.renderBenchmark(); } catch (_) {}
  }
}

setInterval(_installPortfolioTradeAndBenchmarkHooks, 500);
