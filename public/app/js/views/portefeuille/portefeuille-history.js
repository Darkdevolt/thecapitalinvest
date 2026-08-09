// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — HISTORIQUE (v3)
// ═══════════════════════════════════════════════════════

const _pfPortfolioCache = {};

function _pfHistoryLotsAtDate(transactions, dateStr) {
  const lots = [];
  const ordered = [...(transactions || [])].filter(tx => String(tx.date_transaction || tx.date || '').slice(0,10) <= dateStr).sort((a,b) => {
    const da = new Date(a.date_transaction || a.date || 0).getTime();
    const db = new Date(b.date_transaction || b.date || 0).getTime();
    return da !== db ? da - db : String(a.id || '').localeCompare(String(b.id || ''));
  });

  for (const tx of ordered) {
    const ticker = String(tx.ticker || '').toUpperCase().trim();
    const qty = Number(tx.quantite ?? tx.quantity ?? tx.qty ?? 0);
    const price = Number(tx.prix_unitaire ?? tx.cours ?? tx.price ?? 0);
    const type = String(tx.type || '').toUpperCase();
    if (!ticker || qty <= 0) continue;

    if (type === 'ACHAT') {
      lots.push({ ticker, qty, price, date: tx.date_transaction || tx.date, id: tx.id });
    } else if (type === 'VENTE') {
      let remaining = qty;
      for (const lot of lots.filter(l => l.ticker === ticker && l.qty > 0)) {
        if (remaining <= 0) break;
        const take = Math.min(lot.qty, remaining);
        lot.qty -= take;
        remaining -= take;
      }
    }
  }
  return lots.filter(l => l.qty > 0);
}

function getPortfolioHistory(periodDays = 99999) {
  const transactions = typeof getTransactions === 'function' ? getTransactions() : [];
  const buys = transactions.filter(tx => String(tx.type || '').toUpperCase() === 'ACHAT' && Number(tx.quantite ?? tx.quantity ?? tx.qty ?? 0) > 0);
  if (!buys.length) return { dates: [], values: [], pls: [] };

  const cacheKey = JSON.stringify({
    period: periodDays,
    txHash: transactions.map(t => `${t.id}:${t.type}:${t.ticker}:${t.quantite ?? t.quantity ?? t.qty}:${t.prix_unitaire ?? t.price}:${t.date_transaction || t.date}`).join('|')
  });
  if (_pfPortfolioCache[cacheKey]) return _pfPortfolioCache[cacheKey];

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - periodDays);
  const validDates = buys.map(p => new Date(p.date_transaction || p.date)).filter(d => !isNaN(d));
  const oldestBuy = new Date(Math.min(...validDates));
  const effectiveStart = periodDays === 99999 ? oldestBuy : new Date(Math.max(startDate, oldestBuy));
  if (isNaN(effectiveStart) || effectiveStart > now) return { dates: [], values: [], pls: [] };

  const dates = [];
  let current = new Date(effectiveStart);
  let iter = 0;
  while (current <= now && iter < 20000) {
    if (current.getDay() !== 0 && current.getDay() !== 6) dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
    iter++;
  }

  const values = [];
  const pls = [];
  dates.forEach(date => {
    const ds = date.toISOString().split('T')[0];
    const lots = _pfHistoryLotsAtDate(transactions, ds);
    let dayValue = 0;
    let dayInvested = 0;
    lots.forEach(p => {
      let priceAtDate = getPriceAtDate(p.ticker, ds);
      if (!priceAtDate || priceAtDate <= 0) priceAtDate = getLatestPrice(p.ticker) || p.price;
      dayValue += p.qty * priceAtDate;
      dayInvested += p.qty * p.price;
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
