// ═══════════════════════════════════════
// VIEW — Portefeuille Simulé
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// PORTEFEUILLE
// ═══════════════════════════════════════
function getPortfolio() {
  try { return JSON.parse(localStorage.getItem('tc_portfolio') || '[]'); } catch { return []; }
}
function savePortfolio(data) { localStorage.setItem('tc_portfolio', JSON.stringify(data)); }

function addPosition() {
  const ticker = document.getElementById('pfTicker').value;
  const qty = parseInt(document.getElementById('pfQty').value);
  const price = parseFloat(document.getElementById('pfPrice').value);
  const date = document.getElementById('pfDate').value;
  if (!ticker || !qty || !price) { toast('Remplissez tous les champs', 'warn'); return; }
  const pf = getPortfolio();
  pf.push({ id: Date.now(), ticker, qty, price, date: date || new Date().toISOString().split('T')[0] });
  savePortfolio(pf);
  renderPortfolio();
  toast('Position ajoutée', 'success');
  document.getElementById('pfQty').value = ''; document.getElementById('pfPrice').value = '';
}

function removePosition(id) {
  const pf = getPortfolio().filter(p => p.id !== id);
  savePortfolio(pf);
  renderPortfolio();
  toast('Position supprimée', 'success');
}

// Helper : récupère le vrai dernier cours depuis l'historique (pas allCours qui est obsolète)
function getLatestPriceFromHistory(ticker) {
  if (!Array.isArray(allCoursHistorique)) return null;
  const hist = allCoursHistorique
    .filter(c => c.ticker === ticker && c.date_seance)
    .sort((a, b) => new Date(a.date_seance) - new Date(b.date_seance));
  if (!hist.length) return null;
  const last = hist[hist.length - 1];
  return last.cours_cloture || last.cours_normal || last.cours;
}

function renderPortfolio() {
  const pf = getPortfolio();
  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });

  let totalValue = 0, totalInvested = 0;
  const rows = pf.map(p => {
    // Priorité 1 : historique (vrai dernier cours)
    // Priorité 2 : allCours (fallback)
    const histPrice = getLatestPriceFromHistory(p.ticker);
    const current = byTicker[p.ticker];
    const currentPrice = histPrice || current?.cours || p.price;
    const value = p.qty * currentPrice;
    const invested = p.qty * p.price;
    const pl = value - invested;
    totalValue += value;
    totalInvested += invested;
    const plClass = pl >= 0 ? 'up' : 'down';
    return `<tr>
      <td><span style="font-family:var(--mono);font-size:12px;color:var(--gold)">${p.ticker}</span></td>
      <td class="right">${fmt(p.qty)}</td>
      <td class="right">${fmt(p.price)}</td>
      <td class="right">${fmt(currentPrice)}</td>
      <td class="right">${fmtM(value)}</td>
      <td class="right"><span class="pill ${plClass}">${pl>=0?'+':''}${fmt(pl)}</span></td>
      <td><div class="portf-table-actions"><button onclick="removePosition(${p.id})">✕</button></div></td>
    </tr>`;
  }).join('');

  document.getElementById('pfTable').innerHTML = rows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--dim)">Aucune position. Ajoutez-en une ci-dessus.</td></tr>';
  document.getElementById('pfTotal').textContent = fmtM(totalValue) + ' FCFA';
  document.getElementById('pfInvested').textContent = fmtM(totalInvested) + ' FCFA';
  const pl = totalValue - totalInvested;
  const ret = totalInvested > 0 ? (pl / totalInvested * 100) : 0;
  document.getElementById('pfPL').innerHTML = `<span style="color:${pl>=0?'var(--green)':'var(--red)'}">${pl>=0?'+':''}${fmtM(pl)} FCFA</span>`;
  document.getElementById('pfReturn').innerHTML = `<span style="color:${ret>=0?'var(--green)':'var(--red)'}">${ret>=0?'+':''}${ret.toFixed(2)}%</span>`;
}
