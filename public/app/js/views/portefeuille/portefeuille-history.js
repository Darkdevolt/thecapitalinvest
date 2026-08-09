// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — HISTORIQUE (v4)
// Valeur de compte = titres valorisés + trésorerie reconstruite.
// Les dépôts/retraits sont des flux externes; achats/ventes/dividendes
// restent des mouvements internes au portefeuille.
// ═══════════════════════════════════════════════════════

const _pfPortfolioCache = {};

function _pfTxDate(tx) {
  return String(tx?.date_transaction || tx?.date || '').slice(0, 10);
}

function _pfTxAmount(tx, fallbackQty = 0, fallbackPrice = 0) {
  const explicit = Number(tx?.montant_net ?? tx?.montant_brut ?? tx?.amount);
  if (Number.isFinite(explicit) && explicit !== 0) return Math.abs(explicit);
  return Math.abs(Number(fallbackQty || 0) * Number(fallbackPrice || 0));
}

function _pfHistoryLotsAtDate(transactions, dateStr) {
  const lots = [];
  const ordered = [...(transactions || [])]
    .filter(tx => _pfTxDate(tx) && _pfTxDate(tx) <= dateStr)
    .sort((a, b) => {
      const da = new Date(a.date_transaction || a.date || 0).getTime();
      const db = new Date(b.date_transaction || b.date || 0).getTime();
      return da !== db ? da - db : String(a.id || '').localeCompare(String(b.id || ''));
    });

  for (const tx of ordered) {
    const ticker = String(tx.ticker || '').toUpperCase().trim();
    const qty = Number(tx.quantite ?? tx.quantity ?? tx.qty ?? 0);
    const price = Number(tx.prix_unitaire ?? tx.cours ?? tx.price ?? 0);
    const type = String(tx.type || '').toUpperCase().trim();
    if (!ticker || qty <= 0) continue;

    if (type === 'ACHAT' || type === 'BUY') {
      lots.push({ ticker, qty, price, date: tx.date_transaction || tx.date, id: tx.id });
    } else if (type === 'VENTE' || type === 'SELL') {
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

function _pfCashAndExternalFlowAtDate(transactions, dateStr) {
  let cash = 0;
  let externalFlow = 0;
  const ordered = [...(transactions || [])]
    .filter(tx => _pfTxDate(tx) && _pfTxDate(tx) <= dateStr)
    .sort((a, b) => {
      const da = new Date(a.date_transaction || a.date || 0).getTime();
      const db = new Date(b.date_transaction || b.date || 0).getTime();
      return da !== db ? da - db : String(a.id || '').localeCompare(String(b.id || ''));
    });

  for (const tx of ordered) {
    const type = String(tx.type || '').toUpperCase().trim();
    const qty = Number(tx.quantite ?? tx.quantity ?? tx.qty ?? 0);
    const price = Number(tx.prix_unitaire ?? tx.cours ?? tx.price ?? 0);
    const amount = _pfTxAmount(tx, qty, price);
    if (type === 'DEPOT' || type === 'DEPOSIT') {
      cash += amount;
      externalFlow += amount;
    } else if (type === 'RETRAIT' || type === 'WITHDRAW') {
      cash -= amount;
      externalFlow -= amount;
    } else if (type === 'ACHAT' || type === 'BUY') {
      cash -= amount;
    } else if (type === 'VENTE' || type === 'SELL') {
      cash += amount;
    } else if (type === 'DIVIDENDE' || type === 'DIVIDEND') {
      cash += amount;
    }
  }
  return { cash, externalFlow };
}

function getPortfolioHistory(periodDays = 99999) {
  const transactions = typeof getTransactions === 'function' ? getTransactions() : [];
  if (!transactions.length) return { dates: [], values: [], pls: [], returns: [], externalFlows: [], cash: [] };

  const datedTransactions = transactions
    .map(tx => ({ tx, date: new Date(tx.date_transaction || tx.date) }))
    .filter(x => !Number.isNaN(x.date.getTime()));
  if (!datedTransactions.length) return { dates: [], values: [], pls: [], returns: [], externalFlows: [], cash: [] };

  const cacheKey = JSON.stringify({
    period: periodDays,
    txHash: transactions.map(t => `${t.id}:${t.type}:${t.ticker}:${t.quantite ?? t.quantity ?? t.qty}:${t.prix_unitaire ?? t.price}:${t.montant_net ?? t.montant_brut ?? t.amount}:${t.date_transaction || t.date}`).join('|'),
    historySignature: Object.entries(window._pfHistCache || {}).map(([t, rows]) => `${t}:${rows?.length || 0}:${rows?.[rows.length - 1]?.date_seance || ''}`).join('|')
  });
  if (_pfPortfolioCache[cacheKey]) return _pfPortfolioCache[cacheKey];

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - periodDays);
  const oldestTransaction = new Date(Math.min(...datedTransactions.map(x => x.date.getTime())));
  const effectiveStart = periodDays === 99999 ? oldestTransaction : new Date(Math.max(startDate.getTime(), oldestTransaction.getTime()));
  if (Number.isNaN(effectiveStart.getTime()) || effectiveStart > now) return { dates: [], values: [], pls: [], returns: [], externalFlows: [], cash: [] };

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
  const returns = [];
  const externalFlows = [];
  const cashSeries = [];
  const priceAvailability = {};

  function priceAtOrBefore(ticker, dateStr) {
    const t = String(ticker || '').toUpperCase().trim();
    if (!t) return null;
    const cache = window._pfHistCache?.[t] || [];
    if (!cache.length) return null;
    let lo = 0, hi = cache.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const d = String(cache[mid].date_seance || '').slice(0, 10);
      if (d <= dateStr) { idx = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (idx < 0) return null;
    const row = cache[idx];
    const price = Number(row.cours_cloture ?? row.cours_normal ?? row.cours ?? 0);
    return price > 0 ? price : null;
  }

  dates.forEach((date, index) => {
    const ds = date.toISOString().slice(0, 10);
    const lots = _pfHistoryLotsAtDate(transactions, ds);
    const { cash, externalFlow } = _pfCashAndExternalFlowAtDate(transactions, ds);
    let securitiesValue = 0;
    let complete = true;

    for (const lot of lots) {
      const price = priceAtOrBefore(lot.ticker, ds);
      if (price == null) {
        complete = false;
        break;
      }
      securitiesValue += lot.qty * price;
    }

    // Une valeur incomplète n'est jamais remplacée par le cours actuel.
    // On ne crée donc pas de faux mouvement de marché.
    const accountValue = complete ? securitiesValue + cash : null;
    const previousValue = values.length ? values[values.length - 1] : null;

    if (accountValue == null) {
      values.push(null);
      pls.push(null);
      externalFlows.push(externalFlow);
      cashSeries.push(cash);
      return;
    }

    values.push(accountValue);
    pls.push(accountValue - externalFlow);
    externalFlows.push(externalFlow);
    cashSeries.push(cash);

    if (previousValue != null && previousValue > 0) {
      // Les dépôts/retraits sont neutralisés pour mesurer la performance du marché.
      const adjustedStart = previousValue;
      const adjustedEnd = accountValue - externalFlow;
      returns.push(adjustedEnd / adjustedStart - 1);
    }
  });

  // Conserve uniquement les points réellement valorisables pour les graphiques.
  const valid = dates.map((date, i) => ({ date, value: values[i], pl: pls[i], flow: externalFlows[i], cash: cashSeries[i] })).filter(x => Number.isFinite(x.value));
  const result = {
    dates: valid.map(x => x.date),
    values: valid.map(x => x.value),
    pls: valid.map(x => x.pl),
    externalFlows: valid.map(x => x.flow),
    cash: valid.map(x => x.cash),
    returns: returns.filter(Number.isFinite)
  };
  _pfPortfolioCache[cacheKey] = result;
  return result;
}

function invalidatePortfolioCache() {
  Object.keys(_pfPortfolioCache).forEach(k => delete _pfPortfolioCache[k]);
}

window.addEventListener('portfolio:updated', invalidatePortfolioCache);
window.addEventListener('portfolio:history-ready', invalidatePortfolioCache);