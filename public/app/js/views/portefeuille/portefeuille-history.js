// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — HISTORIQUE
// ═══════════════════════════════════════════════════════

const _pfPortfolioCache = {};

function getPortfolioHistory(periodDays = 99999) {
  const pf = getPortfolio();
  if (!pf.length) return { dates: [], values: [], pls: [] };

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - periodDays);

  const oldestBuy = new Date(Math.min(...pf.map(p => new Date(p.date || now))));
  const effectiveStart = periodDays === 99999 ? oldestBuy : new Date(Math.max(startDate, oldestBuy));

  const dates = [];
  let current = new Date(effectiveStart);
  while (current <= now) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const cacheKey = JSON.stringify({
    period: periodDays,
    pfHash: pf.map(p => `${p.ticker}:${p.qty}:${p.price}:${p.date}`).join('|')
  });

  if (_pfPortfolioCache[cacheKey]) {
    return _pfPortfolioCache[cacheKey];
  }

  const values = [];
  const pls = [];

  dates.forEach(date => {
    let dayValue = 0;
    let dayInvested = 0;

    pf.forEach(p => {
      const buyDate = new Date(p.date || p.id);
      if (date >= buyDate) {
        const t = p.ticker.toUpperCase().trim();
        const ds = date.toISOString().split('T')[0];

        let priceAtDate = getPriceAtDate(t, ds);
        if (!priceAtDate || priceAtDate <= 0) {
          priceAtDate = getLatestPrice(t) || p.price;
        }

        dayValue += p.qty * priceAtDate;
        dayInvested += p.qty * p.price;
      }
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
