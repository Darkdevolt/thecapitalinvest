// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — PRIX & HISTORIQUES (v4)
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

async function hydratePortfolioHistoricalPrices(tickers, limit = 365) {
  const unique = [...new Set((tickers || []).map(t => String(t || '').toUpperCase().trim()).filter(Boolean))];
  if (!unique.length) return {};

  const missing = unique.filter(t => !Array.isArray(window._pfHistCache[t]) || window._pfHistCache[t].length === 0);
  if (!missing.length) return Object.fromEntries(unique.map(t => [t, window._pfHistCache[t]]));
  if (_pfHistoryHydration) return _pfHistoryHydration;

  _pfHistoryHydration = Promise.all(missing.map(async ticker => {
    try {
      const response = await fetch(`/api/marche?type=historique&ticker=${encodeURIComponent(ticker)}&limit=${limit}`, { cache: 'no-store' });
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
  })).then(entries => {
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
    if (!coursJour) {
      coursJour = window.allCours.find(c => {
        const ct = (c.ticker || '').toUpperCase().trim();
        return ct.startsWith(t) || t.startsWith(ct);
      });
    }
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
    const hist = window.allCoursHistorique
      .filter(c => (c.ticker || '').toUpperCase().trim() === t)
      .sort((a, b) => new Date(b.date_seance || 0) - new Date(a.date_seance || 0));
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
    const hist = window.allCoursHistorique
      .filter(c => (c.ticker || '').toUpperCase().trim() === t)
      .sort((a, b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0));
    if (hist.length > 0) {
      window._pfHistCache[t] = hist;
      return hist;
    }
  }
  return [];
}

function invalidateTickerHistoryCache(ticker) {
  if (ticker) delete window._pfHistCache[(ticker || '').toUpperCase().trim()];
  else window._pfHistCache = {};
}

function _findPriceOnOrBefore(hist, dateStr) {
  let lo = 0, hi = hist.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = (hist[mid].date_seance || '').split('T')[0];
    if (d <= dateStr) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
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

function get52WeekHigh(ticker) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;
  const vals = hist.map(c => +(c.cours_cloture ?? c.cours_normal ?? c.cours ?? c.haut ?? 0)).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

function get52WeekLow(ticker) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;
  const vals = hist.map(c => +(c.cours_cloture ?? c.cours_normal ?? c.cours ?? c.bas ?? 0)).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : null;
}

hydratePortfolioMarketPrices();
