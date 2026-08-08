// THE CAPITAL — Portfolio Store
// Supabase is the single source of truth. localStorage is only a short-lived UI cache.
(function () {
  const KEY = 'tc_portfolio_runtime_cache';
  let transactions = [];
  let hydrated = false;
  let hydrating = null;

  function token() {
    try {
      const s = JSON.parse(localStorage.getItem('tc_session') || 'null');
      return s?.access_token || localStorage.getItem('tc_token') || localStorage.getItem('token') || '';
    } catch (_) { return localStorage.getItem('tc_token') || localStorage.getItem('token') || ''; }
  }

  async function request(method, body, query = '') {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;
    const response = await fetch(`/api/portfolio-transactions${query}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  function rebuildLots(rows) {
    const lots = [];
    for (const tx of rows || []) {
      const ticker = String(tx.ticker || '').toUpperCase();
      const qty = Number(tx.quantite || 0);
      const price = Number(tx.prix_unitaire ?? tx.cours ?? 0);
      if (!ticker || qty <= 0) continue;
      if (String(tx.type).toUpperCase() === 'ACHAT') {
        lots.push({ id: tx.id, ticker, type: 'action', qty, price, date: tx.date_transaction, serverId: tx.id });
      } else if (String(tx.type).toUpperCase() === 'VENTE') {
        let remaining = qty;
        for (const lot of lots.filter(x => x.ticker === ticker && x.qty > 0)) {
          if (remaining <= 0) break;
          const take = Math.min(lot.qty, remaining);
          lot.qty -= take;
          remaining -= take;
        }
      }
    }
    return lots.filter(l => l.qty > 0);
  }

  async function hydratePortfolio(force = false) {
    if (hydrating && !force) return hydrating;
    hydrating = request('GET').then(payload => {
      transactions = Array.isArray(payload.data) ? payload.data : [];
      hydrated = true;
      try { localStorage.setItem(KEY, JSON.stringify(transactions)); } catch (_) {}
      return transactions;
    }).catch(error => {
      console.warn('[PORTFOLIO] Supabase unavailable:', error.message);
      if (!transactions.length) {
        try { transactions = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { transactions = []; }
      }
      hydrated = true;
      return transactions;
    }).finally(() => { hydrating = null; });
    return hydrating;
  }

  function getPortfolio() {
    return rebuildLots(transactions);
  }

  async function addTransaction(input) {
    const payload = await request('POST', input);
    if (payload.data) transactions.push(payload.data);
    return payload.data;
  }

  async function syncPortfolio(nextLots) {
    const currentLots = rebuildLots(transactions);
    const currentById = new Map(currentLots.map(l => [String(l.id), l]));
    const nextById = new Map((nextLots || []).map(l => [String(l.id), l]));

    for (const lot of nextLots || []) {
      if (!lot.serverId && !currentById.has(String(lot.id))) {
        await addTransaction({ type: 'ACHAT', ticker: lot.ticker, quantity: Number(lot.qty), price: Number(lot.price), date: lot.date });
        continue;
      }
      const old = currentById.get(String(lot.id));
      if (old && (old.qty !== Number(lot.qty) || old.price !== Number(lot.price) || old.date !== lot.date)) {
        const delta = Number(old.qty) - Number(lot.qty);
        if (delta > 0) await addTransaction({ type: 'VENTE', ticker: lot.ticker, quantity: delta, price: Number(old.price), date: lot.date });
      }
    }

    for (const old of currentLots) {
      if (!nextById.has(String(old.id)) && !nextById.has(String(old.serverId))) {
        await request('DELETE', null, `?id=${encodeURIComponent(old.serverId || old.id)}`);
      }
    }

    await hydratePortfolio(true);
    return true;
  }

  window.portfolioStore = { hydrate: hydratePortfolio, sync: syncPortfolio, addTransaction, getTransactions: () => transactions };
  window.getPortfolio = getPortfolio;
  window.savePortfolio = function (data) {
    // Compatibility layer for the existing UI: server write is asynchronous.
    syncPortfolio(data).then(() => {
      if (typeof window.renderPortfolio === 'function') window.renderPortfolio();
    }).catch(error => {
      console.error('[PORTFOLIO] Synchronisation échouée:', error);
      if (typeof window.toast === 'function') window.toast(error.message, 'error');
    });
    return true;
  };

  hydratePortfolio();
})();
