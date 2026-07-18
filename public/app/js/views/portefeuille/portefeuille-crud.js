// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — CRUD (v2 — reconstruit à partir du vrai HTML)
// Couvre : positions, cash (dépôt/retrait), dividendes,
// sélection multiple + suppression groupée, calculateur.
// ═══════════════════════════════════════════════════════

// — AJOUT D'UNE POSITION —
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

  if (!ticker) { alert('Sélectionnez un titre.'); return; }
  if (!qty || qty <= 0) { alert('Quantité invalide.'); return; }
  if (!price || price <= 0) { alert("Prix d'achat invalide."); return; }

  const pf = getPortfolio();
  pf.push({ id: Date.now(), ticker, type, qty, price, date });
  savePortfolio(pf);
  invalidatePortfolioCache();

  qtyEl.value = '';
  priceEl.value = '';
  dateEl.value = '';
  tickerEl.selectedIndex = 0;

  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — SUPPRESSION D'UNE POSITION —
window.removePosition = function(id) {
  if (!confirm('Supprimer cette position ?')) return;
  const pf = getPortfolio().filter(p => String(p.id) !== String(id));
  savePortfolio(pf);
  invalidatePortfolioCache();
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

  if (typeof renderPortfolio === 'function') renderPortfolio();
};

// — CASH (DÉPÔTS / RETRAITS) —
window.addCash = function() {
  const typeEl = document.getElementById('cashType');
  const amountEl = document.getElementById('cashAmount');

  const type = typeEl?.value;
  const amount = +amountEl?.value;

  if (!amount || amount <= 0) { alert('Montant invalide.'); return; }

  const current = getCash();
  let updated;
  if (type === 'withdraw') {
    if (amount > current) { alert('Solde liquide insuffisant pour ce retrait.'); return; }
    updated = current - amount;
  } else {
    updated = current + amount;
  }

  saveCash(updated);
  amountEl.value = '';
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

  if (!ticker) { alert('Renseignez un ticker.'); return; }
  if (!amount || amount <= 0) { alert('Montant invalide.'); return; }

  const dividends = getDividends();
  dividends.push({ ticker, amount, date });
  saveDividends(dividends);

  tickerEl.value = '';
  amountEl.value = '';
  dateEl.value = '';

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
