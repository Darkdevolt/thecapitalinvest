// THE CAPITAL — Portfolio trade guards
// Frontend-only: cash/position/session guards. No API/Supabase changes.
(function () {
  'use strict';

  const SETTLEMENT_BUSINESS_DAYS = 2;
  let pendingBuyCash = 0;

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function normType(v) {
    return String(v || '').toUpperCase().trim();
  }

  function isoDate(value) {
    const raw = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
  }

  function parseDate(value) {
    const d = new Date(`${isoDate(value)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function isBusinessDay(value) {
    const d = parseDate(value);
    if (!d) return false;
    const day = d.getDay();
    return day !== 0 && day !== 6;
  }

  // J+2 = two following business days, excluding Saturday/Sunday.
  function settlementDate(value) {
    const d = parseDate(value);
    if (!d || !isBusinessDay(value)) return null;
    let remaining = SETTLEMENT_BUSINESS_DAYS;
    while (remaining > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) remaining -= 1;
    }
    return d.toISOString().slice(0, 10);
  }

  function isSettled(value, asOf) {
    const settlement = settlementDate(value);
    if (!settlement) return false;
    return settlement <= isoDate(asOf);
  }

  function transactions() {
    try {
      return typeof window.getTransactions === 'function' ? window.getTransactions() : [];
    } catch (_) {
      return [];
    }
  }

  function tradeDateFromElement(id) {
    return isoDate(document.getElementById(id)?.value);
  }

  function toast(message, type) {
    if (typeof window.toast === 'function') window.toast(message, type || 'error');
  }

  function weekendMessage(date) {
    return `Transaction refusée : le ${date} est un samedi ou un dimanche. Les transactions du portefeuille sont limitées aux jours de séance.`;
  }

  function guardBusinessDay(date) {
    const d = isoDate(date);
    if (!isBusinessDay(d)) {
      toast(weekendMessage(d), 'error');
      return false;
    }
    return true;
  }

  // Cash available for a new purchase.
  // Deposits/dividends are immediate. Purchases consume cash immediately.
  // Sale proceeds only become usable after J+2.
  function cashBalance(asOf) {
    const target = isoDate(asOf);
    let cash = 0;

    for (const tx of transactions()) {
      const type = normType(tx.type);
      const date = isoDate(tx.date_transaction || tx.date);
      if (date > target) continue;

      const qty = num(tx.quantite ?? tx.quantity ?? tx.qty);
      const price = num(tx.prix_unitaire ?? tx.cours ?? tx.price);
      const amount = Math.abs(num(
        tx.montant_net ??
        tx.montant_brut ??
        tx.montant ??
        tx.amount ??
        (qty * price)
      ));

      if (type === 'DEPOT' || type === 'DEPOSIT') {
        cash += amount;
      } else if (type === 'RETRAIT' || type === 'WITHDRAW') {
        cash -= amount;
      } else if (type === 'ACHAT' || type === 'BUY') {
        // Never use a possibly missing/incorrect amount field to create cash.
        cash -= amount > 0 ? amount : qty * price;
      } else if (type === 'VENTE' || type === 'SELL') {
        if (isSettled(date, target)) cash += amount > 0 ? amount : qty * price;
      } else if (type === 'DIVIDENDE' || type === 'DIVIDEND') {
        cash += amount;
      }
    }

    return cash;
  }

  function settledHeldQty(ticker, asOf) {
    const target = isoDate(asOf);
    const wanted = String(ticker || '').toUpperCase().trim();
    if (!wanted) return 0;

    const rows = transactions()
      .filter(tx => String(tx.ticker || '').toUpperCase().trim() === wanted)
      .filter(tx => isoDate(tx.date_transaction || tx.date) <= target)
      .sort((a, b) => {
        const da = isoDate(a.date_transaction || a.date);
        const db = isoDate(b.date_transaction || b.date);
        if (da !== db) return da.localeCompare(db);
        return String(a.id || '').localeCompare(String(b.id || ''));
      });

    const lots = [];
    for (const tx of rows) {
      const type = normType(tx.type);
      const qty = num(tx.quantite ?? tx.quantity ?? tx.qty);
      if (qty <= 0) continue;
      const date = isoDate(tx.date_transaction || tx.date);

      if (type === 'ACHAT' || type === 'BUY') {
        if (isSettled(date, target)) lots.push({ qty });
      } else if (type === 'VENTE' || type === 'SELL') {
        let remaining = qty;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const take = Math.min(lot.qty, remaining);
          lot.qty -= take;
          remaining -= take;
        }
      }
    }

    return lots.reduce((sum, lot) => sum + lot.qty, 0);
  }

  function amountForBuy() {
    const qty = num(document.getElementById('pfQty')?.value);
    const price = num(document.getElementById('pfPrice')?.value);
    if (qty <= 0 || price <= 0) return 0;
    return qty * price;
  }

  function guardBuy() {
    const date = tradeDateFromElement('pfDate');
    if (!guardBusinessDay(date)) return false;

    const qty = num(document.getElementById('pfQty')?.value);
    const price = num(document.getElementById('pfPrice')?.value);
    const amount = amountForBuy();

    if (qty <= 0 || price <= 0 || amount <= 0) {
      toast('Achat refusé : quantité et prix doivent être strictement positifs.', 'error');
      return false;
    }

    const cash = cashBalance(date);
    const available = cash - pendingBuyCash;

    if (available < 0) {
      toast(`Achat refusé : le portefeuille présente déjà un solde disponible négatif de ${Math.abs(cash).toFixed(0)} FCFA.`, 'error');
      return false;
    }

    if (amount > available + 1e-9) {
      toast(`Achat refusé : liquidités disponibles insuffisantes. Disponible : ${available.toFixed(0)} FCFA · Nécessaire : ${amount.toFixed(0)} FCFA.`, 'error');
      return false;
    }

    // Reserve the cash locally until the portfolio store confirms the mutation.
    // This prevents several rapid clicks from spending the same cash multiple times.
    pendingBuyCash += amount;
    return true;
  }

  function guardSell(ticker, qty, date) {
    const tradeDate = isoDate(date);
    if (!guardBusinessDay(tradeDate)) return false;

    const held = settledHeldQty(ticker, tradeDate);
    if (held <= 0) {
      toast(`Vente refusée : aucune action ${ticker} n'est disponible à la vente. Les achats non encore réglés en J+2 ne sont pas vendables.`, 'error');
      return false;
    }

    if (num(qty) > held + 1e-9) {
      toast(`Vente refusée : ${held} titre(s) ${ticker} sont actuellement disponibles à la vente après règlement J+2.`, 'error');
      return false;
    }

    return true;
  }

  function wrapHandlers() {
    if (window.__tcTradeGuardsInstalled) return true;

    // The buy guard must not depend on the presence of sell handlers.
    // Previously, requiring all three handlers meant that a missing sell handler
    // disabled the buy cash protection entirely.
    if (typeof window.addPosition !== 'function') return false;

    const originalAdd = window.addPosition;
    window.addPosition = function () {
      if (!guardBuy()) return false;
      try {
        return originalAdd.apply(this, arguments);
      } catch (error) {
        pendingBuyCash = Math.max(0, pendingBuyCash - amountForBuy());
        throw error;
      }
    };

    if (typeof window.sellPositionQuick === 'function') {
      const originalQuickSell = window.sellPositionQuick;
      window.sellPositionQuick = function () {
        const ticker = document.getElementById('pfSellTicker')?.value;
        const qty = num(document.getElementById('pfSellQty')?.value);
        const date = tradeDateFromElement('pfSellDate');
        if (!guardSell(ticker, qty, date)) return false;
        return originalQuickSell.apply(this, arguments);
      };
    }

    if (typeof window.confirmSell === 'function') {
      const originalConfirmSell = window.confirmSell;
      window.confirmSell = function () {
        const ticker = document.getElementById('sellTicker')?.value;
        const qty = num(document.getElementById('sellQty')?.value);
        const date = tradeDateFromElement('sellDate');
        if (!guardSell(ticker, qty, date)) return false;
        return originalConfirmSell.apply(this, arguments);
      };
    }

    window.getPortfolioCashBalance = cashBalance;
    window.getPortfolioSettlementDate = settlementDate;
    window.getPortfolioSettledQuantity = settledHeldQty;
    window.PORTFOLIO_SETTLEMENT_BUSINESS_DAYS = SETTLEMENT_BUSINESS_DAYS;
    window.__tcTradeGuardsInstalled = true;
    return true;
  }

  // Release local reservations whenever the Store has refreshed its transaction list.
  window.addEventListener('portfolio:updated', () => { pendingBuyCash = 0; });

  let attempts = 0;
  const timer = setInterval(() => {
    if (wrapHandlers() || ++attempts > 120) clearInterval(timer);
  }, 100);

  wrapHandlers();
})();
