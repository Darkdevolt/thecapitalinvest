// THE CAPITAL — Portfolio Store
// Source de vérité unique : Supabase via /api/portfolio-transactions.
(function () {
  'use strict';

  let transactions = [];
  let hydrating = null;

  function token() {
    try {
      const s = JSON.parse(localStorage.getItem('tc_session') || 'null');
      return s?.access_token || '';
    } catch (_) { return ''; }
  }

  async function request(method, body, query = '') {
    const headers = { Accept: 'application/json' };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
    const response = await fetch(`/api/portfolio-transactions${query}`, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  function transactionOrder(a, b) {
    const da = new Date(a?.date_transaction || a?.date || 0).getTime();
    const db = new Date(b?.date_transaction || b?.date || 0).getTime();
    if (da !== db) return da - db;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  }

  // Les lots doivent toujours être reconstruits dans l'ordre chronologique.
  // Cela garantit que le FIFO achat/vente ne dépend pas de l'ordre renvoyé par l'API.
  function rebuildLots(rows) {
    const lots = [];
    const ordered = [...(rows || [])].sort(transactionOrder);
    for (const tx of ordered) {
      const ticker = String(tx.ticker || '').toUpperCase().trim();
      const qty = Number(tx.quantite ?? tx.quantity ?? tx.qty ?? 0);
      const price = Number(tx.prix_unitaire ?? tx.cours ?? tx.price ?? 0);
      const type = String(tx.type || '').toUpperCase();
      if (!ticker || qty <= 0) continue;

      if (type === 'ACHAT') {
        lots.push({ id: tx.id, ticker, type: 'action', qty, price, date: tx.date_transaction || tx.date, serverId: tx.id });
      } else if (type === 'VENTE') {
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
      return transactions;
    }).catch(error => {
      console.error('[PORTFOLIO] Supabase indisponible:', error.message);
      transactions = [];
      if (typeof window.toast === 'function') window.toast('Impossible de charger le portefeuille', 'error');
      return transactions;
    }).finally(() => { hydrating = null; });
    return hydrating;
  }

  function getPortfolio() { return rebuildLots(transactions); }
  function getTransactions() { return transactions.slice(); }

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
      const old = currentById.get(String(lot.id));
      const nextQty = Number(lot.qty || 0);
      const oldQty = old ? Number(old.qty || 0) : 0;

      if (!lot.serverId && !old) {
        await addTransaction({ type: 'ACHAT', ticker: lot.ticker, quantity: nextQty, price: Number(lot.price), date: lot.date });
        continue;
      }

      if (old && (old.price !== Number(lot.price) || old.date !== lot.date)) {
        await request('DELETE', undefined, `?id=${encodeURIComponent(old.serverId || old.id)}`);
        await addTransaction({ type: 'ACHAT', ticker: lot.ticker, quantity: nextQty, price: Number(lot.price), date: lot.date });
        continue;
      }

      if (old && oldQty > nextQty) {
        await addTransaction({ type: 'VENTE', ticker: lot.ticker, quantity: oldQty - nextQty, price: Number(old.price), date: lot.date });
      } else if (old && nextQty > oldQty) {
        await addTransaction({ type: 'ACHAT', ticker: lot.ticker, quantity: nextQty - oldQty, price: Number(old.price), date: lot.date });
      }
    }

    for (const old of currentLots) {
      if (!nextById.has(String(old.id)) && !nextById.has(String(old.serverId))) {
        await request('DELETE', undefined, `?id=${encodeURIComponent(old.serverId || old.id)}`);
      }
    }

    await hydratePortfolio(true);
    return true;
  }

  window.portfolioStore = { hydrate: hydratePortfolio, sync: syncPortfolio, addTransaction, getTransactions };
  window.getPortfolio = getPortfolio;
  window.savePortfolio = function (data) {
    syncPortfolio(data).then(() => {
      if (typeof window.renderPortfolio === 'function') window.renderPortfolio();
    }).catch(error => {
      console.error('[PORTFOLIO] Synchronisation échouée:', error);
      if (typeof window.toast === 'function') window.toast(error.message, 'error');
    });
    return true;
  };
  window.getTransactions = getTransactions;
  hydratePortfolio();
})();
