// THE CAPITAL — Portfolio trade guards
// Enforce the basic cash/position rules without touching API/Supabase.
(function () {
  'use strict';

  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function normType(v) { return String(v || '').toUpperCase().trim(); }

  function transactions() {
    try { return typeof window.getTransactions === 'function' ? window.getTransactions() : []; }
    catch (_) { return []; }
  }

  // Cash available = external funding - withdrawals - purchases + sales + dividends.
  // ACHAT/VENTE are internal transfers between cash and securities; DEPOT/RETRAIT are external flows.
  function cashBalance() {
    let cash = 0;
    for (const tx of transactions()) {
      const type = normType(tx.type);
      const qty = num(tx.quantite ?? tx.quantity ?? tx.qty);
      const price = num(tx.prix_unitaire ?? tx.cours ?? tx.price);
      const amount = num(tx.montant ?? tx.amount ?? (qty * price));
      if (type === 'DEPOT' || type === 'DEPOSIT') cash += amount;
      else if (type === 'RETRAIT' || type === 'WITHDRAW') cash -= amount;
      else if (type === 'ACHAT' || type === 'BUY') cash -= qty * price;
      else if (type === 'VENTE' || type === 'SELL') cash += qty * price;
      else if (type === 'DIVIDENDE' || type === 'DIVIDEND') cash += amount;
    }
    return cash;
  }

  function heldQty(ticker) {
    const t = String(ticker || '').toUpperCase().trim();
    try {
      return (window.getPortfolio ? window.getPortfolio() : [])
        .filter(p => String(p.ticker || '').toUpperCase().trim() === t)
        .reduce((s, p) => s + num(p.qty), 0);
    } catch (_) { return 0; }
  }

  function amountForBuy() {
    const qty = num(document.getElementById('pfQty')?.value);
    const price = num(document.getElementById('pfPrice')?.value);
    return qty * price;
  }

  function guardBuy() {
    const amount = amountForBuy();
    if (amount <= 0) return true;
    const cash = cashBalance();
    if (cash + 1e-9 < amount) {
      if (typeof window.toast === 'function') {
        window.toast(`Achat refusé : liquidités insuffisantes. Disponible : ${cash.toFixed(0)} FCFA · Nécessaire : ${amount.toFixed(0)} FCFA. Provisionnez le compte avant d'acheter.`, 'error');
      }
      return false;
    }
    return true;
  }

  function guardSell(ticker, qty) {
    const held = heldQty(ticker);
    if (held <= 0) {
      if (typeof window.toast === 'function') window.toast(`Vente refusée : vous ne détenez aucune action ${ticker}.`, 'error');
      return false;
    }
    if (num(qty) > held + 1e-9) {
      if (typeof window.toast === 'function') window.toast(`Vente refusée : vous détenez seulement ${held} titre(s) ${ticker}.`, 'error');
      return false;
    }
    return true;
  }

  // Wait for the existing CRUD functions, then wrap them. We do not replace their
  // OHLC/date validation; we only add the cash/position invariant before execution.
  function install() {
    if (window.__tcTradeGuardsInstalled) return true;
    if (typeof window.addPosition !== 'function' || typeof window.sellPositionQuick !== 'function' || typeof window.confirmSell !== 'function') return false;

    const originalAdd = window.addPosition;
    const originalQuickSell = window.sellPositionQuick;
    const originalConfirmSell = window.confirmSell;

    window.addPosition = function () {
      if (!guardBuy()) return;
      return originalAdd.apply(this, arguments);
    };

    window.sellPositionQuick = function () {
      const ticker = document.getElementById('pfSellTicker')?.value;
      const qty = num(document.getElementById('pfSellQty')?.value);
      if (!guardSell(ticker, qty)) return;
      return originalQuickSell.apply(this, arguments);
    };

    window.confirmSell = function () {
      const ticker = document.getElementById('sellTicker')?.value;
      const qty = num(document.getElementById('sellQty')?.value);
      if (!guardSell(ticker, qty)) return;
      return originalConfirmSell.apply(this, arguments);
    };

    window.getPortfolioCashBalance = cashBalance;
    window.__tcTradeGuardsInstalled = true;
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    if (install() || ++attempts > 100) clearInterval(timer);
  }, 100);
  install();
})();
