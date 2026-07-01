// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — CRUD (Ajout/Suppression/Calculs)
// ═══════════════════════════════════════════════════════

window.addPosition = function() {
  const ticker = document.getElementById('pfTicker').value.trim().toUpperCase();
  const qty = parseInt(document.getElementById('pfQty').value);
  const price = parseFloat(document.getElementById('pfPrice').value);
  const date = document.getElementById('pfDate').value;

  if (!ticker || !qty || !price || qty <= 0 || price <= 0) {
    toast('Remplissez tous les champs correctement', 'warn');
    return;
  }

  const pf = getPortfolio();
  pf.push({
    id: Date.now(),
    ticker,
    qty,
    price,
    date: date || new Date().toISOString().split('T')[0]
  });
  savePortfolio(pf);
  invalidatePortfolioCache();
  renderPortfolio();
  toast('Position ajoutée', 'success');
  document.getElementById('pfQty').value = '';
  document.getElementById('pfPrice').value = '';
}

window.removePosition = function(id) {
  const pf = getPortfolio().filter(p => p.id !== id);
  savePortfolio(pf);
  invalidatePortfolioCache();
  renderPortfolio();
  toast('Position supprimée', 'success');
}

window.addCash = function() {
  const amount = parseFloat(document.getElementById('cashAmount').value);
  const type = document.getElementById('cashType').value;

  if (!amount || amount <= 0) {
    toast('Montant invalide', 'warn');
    return;
  }

  const currentCash = getCash();
  let newCash;

  if (type === 'deposit') {
    newCash = currentCash + amount;
    toast(`Dépôt de ${fmtM(amount)} FCFA effectué`, 'success');
  } else {
    if (currentCash < amount) {
      toast('Fonds insuffisants', 'error');
      return;
    }
    newCash = currentCash - amount;
    toast(`Retrait de ${fmtM(amount)} FCFA effectué`, 'success');
  }

  saveCash(newCash);
  renderPortfolio();
}

window.addDividend = function() {
  const ticker = document.getElementById('divTicker').value.trim().toUpperCase();
  const amount = parseFloat(document.getElementById('divAmount').value);
  const date = document.getElementById('divDate').value;

  if (!ticker || !amount || amount <= 0 || !date) {
    toast('Remplissez tous les champs', 'warn');
    return;
  }

  const dividends = getDividends();
  dividends.push({
    id: Date.now(),
    ticker,
    amount,
    date,
    received: true
  });

  const currentCash = getCash();
  saveCash(currentCash + amount);

  saveDividends(dividends);
  renderPortfolio();
  toast(`Dividende ${ticker} : +${fmtM(amount)} FCFA`, 'success');
}

window.calculatePosition = function() {
  const ticker = document.getElementById('calcTicker').value.trim().toUpperCase();
  const qty = parseInt(document.getElementById('calcQty').value);
  const targetPrice = parseFloat(document.getElementById('calcTarget').value);

  if (!ticker || !qty || qty <= 0) {
    toast('Remplissez les champs obligatoires', 'warn');
    return;
  }

  const currentPrice = getLatestPrice(ticker);
  if (!currentPrice) {
    toast('Cours actuel non disponible', 'warn');
    return;
  }

  const investment = qty * currentPrice;
  const currentValue = qty * currentPrice;

  let resultHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Investissement</span>
        <span style="color:var(--gold);font-weight:600">${fmtM(investment)} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Cours actuel</span>
        <span>${fmt(currentPrice, 2)} FCFA</span>
      </div>
  `;

  if (targetPrice && targetPrice > 0) {
    const targetValue = qty * targetPrice;
    const gain = targetValue - investment;
    const gainPct = (gain / investment) * 100;
    const color = gain >= 0 ? 'var(--green)' : 'var(--red)';

    resultHTML += `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Cours cible</span>
        <span>${fmt(targetPrice, 2)} FCFA</span>
      </div>
      <div style="width:100%;height:1px;background:var(--border2);margin:12px 0"></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Valeur cible</span>
        <span style="color:${color};font-weight:600">${fmtM(targetValue)} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Gain/Perte potentiel</span>
        <span style="color:${color};font-weight:600">${gain >= 0 ? '+' : ''}${fmtM(gain)} FCFA (${fmt(gainPct, 2)}%)</span>
      </div>
    `;
  }

  resultHTML += `<div style="margin-top:16px"><div style="font-size:12px;color:var(--dim);margin-bottom:8px">📉 Scénarios de baisse :</div>`;
  [10, 20, 50].forEach(pct => {
    const dropPrice = currentPrice * (1 - pct / 100);
    const dropValue = qty * dropPrice;
    const loss = investment - dropValue;
    resultHTML += `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
        <span style="color:var(--dim)">-${pct}% (${fmt(dropPrice, 2)})</span>
        <span style="color:var(--red)">-${fmtM(loss)} FCFA</span>
      </div>
    `;
  });

  resultHTML += `</div></div>`;

  document.getElementById('calcResult').innerHTML = resultHTML;
}
