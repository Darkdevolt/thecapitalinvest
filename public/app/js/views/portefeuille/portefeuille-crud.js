// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — CRUD (v3)
// Positions (achat/vente/édition), cash, dividendes,
// watchlist, alertes, objectif, rééquilibrage, recherche/tri.
// ═══════════════════════════════════════════════════════

// — ONGLET ACHAT / VENTE —
window.switchPfSubtab = function(tab) {
  document.getElementById('tabBuy').classList.toggle('active', tab === 'buy');
  document.getElementById('tabSell').classList.toggle('active', tab === 'sell');
  document.getElementById('panelBuy').classList.toggle('active', tab === 'buy');
  document.getElementById('panelSell').classList.toggle('active', tab === 'sell');
  if (tab === 'sell') populateSellTickerSelect();
};

function populateSellTickerSelect() {
  const select = document.getElementById('pfSellTicker');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Ticker à vendre...</option>';
  const pf = getPortfolio();
  const tickers = [...new Set(pf.map(p => (p.ticker || '').toUpperCase().trim()))].sort();
  tickers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
  if (tickers.includes(current)) select.value = current;
}

window.updateSellHint = function() {
  const ticker = document.getElementById('pfSellTicker')?.value;
  const hint = document.getElementById('sellHint');
  if (!hint) return;
  if (!ticker) { hint.textContent = ''; return; }
  const pf = getPortfolio();
  const qty = pf.filter(p => (p.ticker || '').toUpperCase().trim() === ticker).reduce((s, p) => s + (+p.qty || 0), 0);
  hint.textContent = `Quantité détenue : ${qty}`;
  const priceEl = document.getElementById('pfSellPrice');
  if (priceEl && !priceEl.value) priceEl.value = getLatestPrice(ticker) || '';
};

// — AJOUT D'UNE POSITION (ACHAT) —
window.addPosition = function() {
  const tickerEl = document.getElementById('pfTicker');
  const typeEl   = document.getElementById('pfType');
  const qtyEl    = document.getElementById('pfQty');
  const priceEl  = document.getElementById('pfPrice');
  const dateEl   = document.getElementById('pfDate');

  const ticker = (tickerEl?.value || '').toUpperCase().trim();
  const type = typeEl?.value || 'action';
  const qty = +qtyEl?.value;
  const price = +priceEl?.value;
  const date = dateEl?.value || new Date().toISOString().split('T')[0];

  if (!ticker) { toast('Sélectionnez un titre.', 'error'); return; }
  if (!qty || qty <= 0) { toast('Quantité invalide.', 'error'); return; }
  if (!price || price <= 0) { toast("Prix d'achat invalide.", 'error'); return; }

  const pf = getPortfolio();
  pf.push({ id: Date.now(), ticker, type, qty, price, date });
  savePortfolio(pf);
  invalidatePortfolioCache();
  logTransaction({ type: 'buy', ticker, qty, price, date });

  qtyEl.value = '';
  priceEl.value = '';
  dateEl.value = '';
  tickerEl.selectedIndex = 0;

  toast(`${qty} × ${ticker} ajouté au portefeuille.`, 'success');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — VENTE RAPIDE (depuis le formulaire principal) —
window.sellPositionQuick = function() {
  const ticker = (document.getElementById('pfSellTicker')?.value || '').toUpperCase().trim();
  const qty = +document.getElementById('pfSellQty')?.value;
  const price = +document.getElementById('pfSellPrice')?.value;
  const date = document.getElementById('pfSellDate')?.value || new Date().toISOString().split('T')[0];
  executeSell(ticker, qty, price, date, () => {
    document.getElementById('pfSellQty').value = '';
    document.getElementById('pfSellPrice').value = '';
    document.getElementById('pfSellDate').value = '';
    document.getElementById('sellHint').textContent = '';
  });
};

// — VENTE VIA MODAL (depuis le tableau) —
window.openSellModal = function(ticker) {
  document.getElementById('sellTicker').value = ticker;
  const pf = getPortfolio();
  const totalQty = pf.filter(p => (p.ticker || '').toUpperCase().trim() === ticker).reduce((s, p) => s + (+p.qty || 0), 0);
  document.getElementById('sellQtyHint').textContent = `Quantité détenue : ${totalQty}`;
  document.getElementById('sellQty').value = '';
  document.getElementById('sellPrice').value = getLatestPrice(ticker) || '';
  document.getElementById('sellDate').value = '';
  document.getElementById('sellModal').classList.add('open');
};
window.closeSellModal = function() { document.getElementById('sellModal').classList.remove('open'); };

window.confirmSell = function() {
  const ticker = document.getElementById('sellTicker').value;
  const qty = +document.getElementById('sellQty').value;
  const price = +document.getElementById('sellPrice').value;
  const date = document.getElementById('sellDate').value || new Date().toISOString().split('T')[0];
  executeSell(ticker, qty, price, date, () => closeSellModal());
};

// Logique commune de vente (FIFO sur les lots d'achat)
function executeSell(ticker, qty, price, date, onSuccess) {
  if (!ticker || !qty || qty <= 0 || !price || price <= 0) { toast('Champs invalides.', 'error'); return; }

  let pf = getPortfolio();
  const lots = pf
    .filter(p => (p.ticker || '').toUpperCase().trim() === ticker)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const totalHeld = lots.reduce((s, l) => s + (+l.qty || 0), 0);
  if (qty > totalHeld) { toast(`Quantité supérieure à la position détenue (${totalHeld}).`, 'error'); return; }

  let remaining = qty;
  let costBasis = 0;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(+lot.qty, remaining);
    costBasis += take * (+lot.price || 0);
    lot.qty = +lot.qty - take;
    remaining -= take;
  }
  pf = pf.filter(p => (p.ticker || '').toUpperCase().trim() !== ticker || +p.qty > 0);
  savePortfolio(pf);
  invalidatePortfolioCache();

  const proceeds = qty * price;
  const realizedPL = proceeds - costBasis;
  logTransaction({ type: 'sell', ticker, qty, price, date, realizedPL });

  toast(`Vente enregistrée — P&L réalisé : ${realizedPL >= 0 ? '+' : ''}${typeof fmtM === 'function' ? fmtM(realizedPL) : realizedPL.toFixed(0)} FCFA`, realizedPL >= 0 ? 'success' : 'error');
  if (typeof onSuccess === 'function') onSuccess();
  if (typeof renderPortfolio === 'function') renderPortfolio();
}

// — ÉDITION D'UNE POSITION —
window.openEditModal = function(id) {
  const pf = getPortfolio();
  const pos = pf.find(p => String(p.id) === String(id));
  if (!pos) return;
  document.getElementById('editId').value = pos.id;
  document.getElementById('editQty').value = pos.qty;
  document.getElementById('editPrice').value = pos.price;
  document.getElementById('editDate').value = pos.date;
  document.getElementById('editModal').classList.add('open');
};
window.closeEditModal = function() { document.getElementById('editModal').classList.remove('open'); };

window.confirmEdit = function() {
  const id = document.getElementById('editId').value;
  const qty = +document.getElementById('editQty').value;
  const price = +document.getElementById('editPrice').value;
  const date = document.getElementById('editDate').value;
  if (!qty || qty <= 0 || !price || price <= 0) { toast('Valeurs invalides.', 'error'); return; }

  const pf = getPortfolio();
  const pos = pf.find(p => String(p.id) === String(id));
  if (!pos) return;
  pos.qty = qty; pos.price = price; pos.date = date;
  savePortfolio(pf);
  invalidatePortfolioCache();
  closeEditModal();
  toast('Position mise à jour.', 'success');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — SUPPRESSION D'UNE POSITION —
window.removePosition = function(id) {
  if (!confirm('Supprimer cette position ?')) return;
  const pf = getPortfolio().filter(p => String(p.id) !== String(id));
  savePortfolio(pf);
  invalidatePortfolioCache();
  toast('Position supprimée.', 'info');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — SÉLECTION MULTIPLE —
window.toggleSelectAllPositions = function(masterCheckbox) {
  document.querySelectorAll('.position-checkbox[data-id]').forEach(cb => {
    cb.checked = masterCheckbox.checked;
  });
  updateDeleteButton();
};

window.updateDeleteButton = function() {
  const checked = document.querySelectorAll('.position-checkbox[data-id]:checked');
  const bar = document.getElementById('bulkActionBar');
  const count = document.getElementById('bulkActionCount');
  if (count) count.textContent = `${checked.length} sélectionnée(s)`;
  if (bar) bar.style.display = checked.length > 0 ? 'flex' : 'none';
};

window.deleteSelectedPositions = function() {
  const checked = document.querySelectorAll('.position-checkbox[data-id]:checked');
  if (!checked.length) return;
  if (!confirm(`Supprimer ${checked.length} position(s) sélectionnée(s) ?`)) return;

  const idsToRemove = Array.from(checked).map(cb => cb.dataset.id);
  const pf = getPortfolio().filter(p => !idsToRemove.includes(String(p.id)));
  savePortfolio(pf);
  invalidatePortfolioCache();
  toast(`${idsToRemove.length} position(s) supprimée(s).`, 'info');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — CASH (DÉPÔTS / RETRAITS) —
window.addCash = function() {
  const typeEl = document.getElementById('cashType');
  const amountEl = document.getElementById('cashAmount');

  const type = typeEl?.value;
  const amount = +amountEl?.value;

  if (!amount || amount <= 0) { toast('Montant invalide.', 'error'); return; }

  const current = getCash();
  let updated;
  if (type === 'withdraw') {
    if (amount > current) { toast('Solde liquide insuffisant pour ce retrait.', 'error'); return; }
    updated = current - amount;
  } else {
    updated = current + amount;
  }

  saveCash(updated);
  logTransaction({ type: type === 'withdraw' ? 'withdraw' : 'deposit', amount, date: new Date().toISOString().split('T')[0] });
  amountEl.value = '';
  toast(type === 'withdraw' ? 'Retrait enregistré.' : 'Dépôt enregistré.', 'success');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — DIVIDENDES —
window.addDividend = function() {
  const tickerEl = document.getElementById('divTicker');
  const amountEl = document.getElementById('divAmount');
  const dateEl   = document.getElementById('divDate');

  const ticker = (tickerEl?.value || '').toUpperCase().trim();
  const amount = +amountEl?.value;
  const date = dateEl?.value || new Date().toISOString().split('T')[0];

  if (!ticker) { toast('Renseignez un ticker.', 'error'); return; }
  if (!amount || amount <= 0) { toast('Montant invalide.', 'error'); return; }

  const dividends = getDividends();
  dividends.push({ ticker, amount, date });
  saveDividends(dividends);
  logTransaction({ type: 'dividend', ticker, amount, date });

  tickerEl.value = '';
  amountEl.value = '';
  dateEl.value = '';

  toast(`Dividende de ${ticker} enregistré.`, 'success');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — CALCULATEUR DE POSITION —
window.calculatePosition = function() {
  const tickerEl = document.getElementById('calcTicker');
  const qtyEl    = document.getElementById('calcQty');
  const targetEl = document.getElementById('calcTarget');
  const resultEl = document.getElementById('calcResult');
  if (!resultEl) return;

  const ticker = (tickerEl?.value || '').toUpperCase().trim();
  const qty = +qtyEl?.value;
  const target = +targetEl?.value || null;

  if (!ticker || !qty || qty <= 0) {
    resultEl.innerHTML = '<div style="color:var(--dim);font-size:13px">Renseignez un ticker et une quantité valides.</div>';
    return;
  }

  const currentPrice = getLatestPrice(ticker);
  if (!currentPrice) {
    resultEl.innerHTML = `<div style="color:var(--dim);font-size:13px">Aucun cours disponible pour ${ticker}.</div>`;
    return;
  }

  const cost = qty * currentPrice;
  let targetHtml = '';
  if (target && target > 0) {
    const targetValue = qty * target;
    const gain = targetValue - cost;
    const gainPct = cost > 0 ? (gain / cost * 100) : 0;
    targetHtml = `
      <div style="display:flex;justify-content:space-between;margin-top:8px">
        <span style="font-size:12px;color:var(--dim)">Valeur au cours cible</span>
        <span style="font-size:14px;font-weight:600">${typeof fmtM === 'function' ? fmtM(targetValue) : targetValue.toFixed(0)} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:12px;color:var(--dim)">Gain/Perte potentiel</span>
        <span style="font-size:14px;font-weight:600;color:${gain >= 0 ? 'var(--green)' : 'var(--red)'}">${gain >= 0 ? '+' : ''}${typeof fmtM === 'function' ? fmtM(gain) : gain.toFixed(0)} FCFA (${gainPct >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(gainPct, 2) : gainPct.toFixed(2)}%)</span>
      </div>`;
  }

  resultEl.innerHTML = `
    <div style="padding:12px;background:var(--border2);border-radius:8px">
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:12px;color:var(--dim)">Cours actuel</span>
        <span style="font-size:14px;font-weight:600;color:var(--gold)">${typeof fmt === 'function' ? fmt(currentPrice, 2) : currentPrice.toFixed(2)} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:12px;color:var(--dim)">Coût total (${qty} titres)</span>
        <span style="font-size:14px;font-weight:600">${typeof fmtM === 'function' ? fmtM(cost) : cost.toFixed(0)} FCFA</span>
      </div>
      ${targetHtml}
    </div>
  `;
};

// — WATCHLIST —
window.addToWatchlist = function() {
  const el = document.getElementById('watchTicker');
  const ticker = (el?.value || '').toUpperCase().trim();
  if (!ticker) { toast('Sélectionnez un titre.', 'error'); return; }
  const list = getWatchlist();
  if (list.some(w => w.ticker === ticker)) { toast('Déjà présent dans la watchlist.', 'error'); return; }
  list.push({ ticker, addedAt: new Date().toISOString().split('T')[0] });
  saveWatchlist(list);
  el.selectedIndex = 0;
  toast(`${ticker} ajouté à la watchlist.`, 'success');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};
window.removeFromWatchlist = function(ticker) {
  saveWatchlist(getWatchlist().filter(w => w.ticker !== ticker));
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — ALERTES DE PRIX —
window.addPriceAlert = function() {
  const tickerEl = document.getElementById('alertTicker');
  const condEl = document.getElementById('alertCondition');
  const targetEl = document.getElementById('alertTarget');
  const ticker = (tickerEl?.value || '').toUpperCase().trim();
  const condition = condEl?.value;
  const target = +targetEl?.value;
  if (!ticker || !target || target <= 0) { toast('Champs invalides.', 'error'); return; }

  const alerts = getAlerts();
  alerts.push({ id: Date.now(), ticker, condition, target, active: true });
  saveAlerts(alerts);
  tickerEl.value = '';
  targetEl.value = '';
  toast('Alerte créée.', 'success');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};
window.removePriceAlert = function(id) {
  saveAlerts(getAlerts().filter(a => String(a.id) !== String(id)));
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — OBJECTIF DE PORTEFEUILLE —
window.setPortfolioGoal = function() {
  const targetEl = document.getElementById('goalTarget');
  const dateEl = document.getElementById('goalDate');
  const target = +targetEl?.value;
  if (!target || target <= 0) { toast('Montant cible invalide.', 'error'); return; }
  saveGoal({ target, date: dateEl?.value || null });
  toast('Objectif enregistré.', 'success');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — RÉÉQUILIBRAGE : ALLOCATIONS CIBLES —
window.setTargetAllocation = function() {
  const tickerEl = document.getElementById('rebalTicker');
  const pctEl = document.getElementById('rebalPct');
  const ticker = (tickerEl?.value || '').toUpperCase().trim();
  const pct = +pctEl?.value;
  if (!ticker || !pct || pct <= 0) { toast('Champs invalides.', 'error'); return; }

  const alloc = getTargetAllocation();
  alloc[ticker] = pct;
  saveTargetAllocation(alloc);
  tickerEl.value = '';
  pctEl.value = '';
  toast('Allocation cible enregistrée.', 'success');
  if (typeof renderPortfolio === 'function') renderPortfolio();
};
window.removeTargetAllocation = function(ticker) {
  const alloc = getTargetAllocation();
  delete alloc[ticker];
  saveTargetAllocation(alloc);
  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — RECHERCHE / TRI DU TABLEAU —
window._pfTableState = { search: '', sortBy: 'value', sortDir: 'desc' };
window.filterPositionsTable = function() {
  window._pfTableState.search = (document.getElementById('pfSearch')?.value || '').toUpperCase().trim();
  if (typeof renderPortfolio === 'function') renderPortfolio();
};
window.sortPositionsTable = function(col) {
  window._pfTableState.sortBy = col;
  if (typeof renderPortfolio === 'function') renderPortfolio();
};
