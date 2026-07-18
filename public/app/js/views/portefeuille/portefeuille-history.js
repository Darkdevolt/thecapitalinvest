// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — HISTORIQUE (v2)
// ═══════════════════════════════════════════════════════

const _pfPortfolioCache = {};

function getPortfolioHistory(periodDays = 99999) {
  const pf = getPortfolio();
  if (!pf.length) return { dates: [], values: [], pls: [] };

  const cacheKey = JSON.stringify({
    period: periodDays,
    pfHash: pf.map(p => `${p.ticker}:${p.qty}:${p.price}:${p.date}`).join('|')
  });
  if (_pfPortfolioCache[cacheKey]) return _pfPortfolioCache[cacheKey];

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - periodDays);

  const validDates = pf.map(p => new Date(p.date || now)).filter(d => !isNaN(d));
  const oldestBuy = validDates.length ? new Date(Math.min(...validDates)) : now;
  const effectiveStart = periodDays === 99999 ? oldestBuy : new Date(Math.max(startDate, oldestBuy));

  if (isNaN(effectiveStart) || effectiveStart > now) {
    return { dates: [], values: [], pls: [] };
  }

  const dates = [];
  let current = new Date(effectiveStart);
  const maxIterations = 20000;
  let iter = 0;
  while (current <= now && iter < maxIterations) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
    iter++;
  }

  const values = [];
  const pls = [];

  dates.forEach(date => {
    let dayValue = 0;
    let dayInvested = 0;

    pf.forEach(p => {
      const buyDate = new Date(p.date || now);
      if (isNaN(buyDate) || date < buyDate) return;

      const t = (p.ticker || '').toUpperCase().trim();
      const ds = date.toISOString().split('T')[0];

      let priceAtDate = getPriceAtDate(t, ds);
      if (!priceAtDate || priceAtDate <= 0) {
        priceAtDate = getLatestPrice(t) || p.price;
      }

      dayValue += (+p.qty || 0) * priceAtDate;
      dayInvested += (+p.qty || 0) * (+p.price || 0);
    });

    values.push(dayValue);
    pls.push(dayValue - dayInvested);
  });

  const result = { dates, values, pls };
  _pfPortfolioCache[cacheKey] = result;
  return result;
}

function invalidatePortfolioCache() {
  Object.keys(_pfPortfolioCache).forEach(k => delete _pfPortfolioCache[k]);
}
