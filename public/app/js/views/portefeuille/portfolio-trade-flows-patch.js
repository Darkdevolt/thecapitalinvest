// THE CAPITAL, Portefeuille trade & flux flows patch
// Frontend-only: uses the existing portfolio transaction API/store.
(function () {
  'use strict';

  function toastSafe(message, type) {
    if (typeof window.toast === 'function') window.toast(message, type || 'info');
    else console[type === 'error' ? 'error' : 'log'](message);
  }

  async function validateTrade(ticker, date, price) {
    if (typeof window.validatePortfolioTradePrice !== 'function') {
      return { ok: false, message: 'Le module de validation des séances n’est pas disponible.' };
    }
    return window.validatePortfolioTradePrice(ticker, date, price);
  }

  async function recordSale(ticker, qty, price, date, closeModal) {
    ticker = String(ticker || '').toUpperCase().trim();
    qty = Number(qty);
    price = Number(price);
    date = String(date || new Date().toISOString().slice(0, 10));

    if (!ticker || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      toastSafe('Ticker, quantité et prix sont obligatoires.', 'error');
      return;
    }

    const lots = typeof window.getPortfolio === 'function' ? window.getPortfolio() : [];
    const held = lots.filter(p => String(p.ticker || '').toUpperCase().trim() === ticker)
      .reduce((sum, p) => sum + Number(p.qty || 0), 0);
    if (qty > held) {
      toastSafe(`Quantité supérieure à la position détenue (${held}).`, 'error');
      return;
    }

    const validation = await validateTrade(ticker, date, price);
    if (!validation.ok) {
      toastSafe(validation.message, 'error');
      return;
    }

    if (!window.portfolioStore || typeof window.portfolioStore.addTransaction !== 'function') {
      toastSafe('Le portefeuille n’est pas encore prêt. Réessayez dans un instant.', 'error');
      return;
    }

    try {
      const proceeds = qty * price;
      const lotsOrdered = lots.filter(p => String(p.ticker || '').toUpperCase().trim() === ticker)
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      let remaining = qty;
      let costBasis = 0;
      for (const lot of lotsOrdered) {
        if (remaining <= 0) break;
        const take = Math.min(Number(lot.qty || 0), remaining);
        costBasis += take * Number(lot.price || 0);
        remaining -= take;
      }
      const realizedPL = proceeds - costBasis;

      // Une vente est une transaction interne : elle augmente la trésorerie,
      // mais n'est PAS un apport de capital externe.
      await window.portfolioStore.addTransaction({
        type: 'VENTE',
        ticker,
        quantity: qty,
        price,
        amount: proceeds,
        date,
        note: 'Vente de titres',
        realizedPL
      });

      if (typeof closeModal === 'function') closeModal();
      document.getElementById('pfSellQty')?.setAttribute('value', '');
      if (document.getElementById('pfSellQty')) document.getElementById('pfSellQty').value = '';
      if (document.getElementById('pfSellPrice')) document.getElementById('pfSellPrice').value = '';
      if (document.getElementById('pfSellDate')) document.getElementById('pfSellDate').value = '';
      if (document.getElementById('sellHint')) document.getElementById('sellHint').textContent = '';
      if (typeof window.renderPortfolio === 'function') window.renderPortfolio();
      toastSafe(`Vente enregistrée, ${qty} × ${ticker} à ${price.toLocaleString('fr-FR')} FCFA. P&L réalisé : ${realizedPL >= 0 ? '+' : ''}${Math.round(realizedPL).toLocaleString('fr-FR')} FCFA`, realizedPL >= 0 ? 'success' : 'error');
    } catch (error) {
      console.error('[PORTFOLIO] Vente:', error);
      toastSafe(error.message || 'Impossible d’enregistrer la vente.', 'error');
    }
  }

  function install() {
    if (typeof window.getPortfolio !== 'function') return false;

    window.sellPositionQuick = function () {
      const ticker = document.getElementById('pfSellTicker')?.value;
      const qty = document.getElementById('pfSellQty')?.value;
      const price = document.getElementById('pfSellPrice')?.value;
      const date = document.getElementById('pfSellDate')?.value || new Date().toISOString().slice(0, 10);
      recordSale(ticker, qty, price, date, null);
    };

    window.confirmSell = function () {
      const ticker = document.getElementById('sellTicker')?.value;
      const qty = document.getElementById('sellQty')?.value;
      const price = document.getElementById('sellPrice')?.value;
      const date = document.getElementById('sellDate')?.value || new Date().toISOString().slice(0, 10);
      recordSale(ticker, qty, price, date, window.closeSellModal);
    };

    return true;
  }

  // portefeuille-crud.js may be evaluated after this patch; wait until its
  // public handlers exist, then replace only the broken sale handlers.
  let tries = 0;
  const timer = setInterval(() => {
    if (install() || ++tries > 120) clearInterval(timer);
  }, 100);

  window.addEventListener('portfolio:store-ready', install);
  window.addEventListener('portfolio:updated', install);
})();
