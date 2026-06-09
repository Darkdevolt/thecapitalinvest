// ═══════════════════════════════════════════════════════
// VIEW — Portefeuille Simulé
// ═══════════════════════════════════════════════════════
// NOTE: fmt, fmtM, fmtDate sont définis dans utils.js (chargé AVANT)

function getPortfolio() {
  try { return JSON.parse(localStorage.getItem('tc_portfolio') || '[]'); }
  catch { return []; }
}
function savePortfolio(data) { localStorage.setItem('tc_portfolio', JSON.stringify(data)); }

// ═══════════════════════════════════════════════════════
// RÉCUPÉRATION DU COURS ACTUEL
// ═══════════════════════════════════════════════════════
function getLatestPrice(ticker) {
  if (!ticker) return null;
  const t = ticker.toUpperCase().trim();

  // 1. Chercher dans les cours du jour (allCours) — PRIORITAIRE
  if (Array.isArray(window.allCours) && window.allCours.length > 0) {
    const coursJour = window.allCours.find(c => {
      const ct = (c.ticker || '').toUpperCase().trim();
      const ci = (c.code_isin || '').toUpperCase().trim();
      const cl = (c.libelle || '').toUpperCase().trim();
      return ct === t || ci === t || cl === t || ct.startsWith(t) || t.startsWith(ct);
    });
    if (coursJour) {
      const prix = coursJour.cours_cloture || coursJour.dernier_cours || coursJour.cours || coursJour.prix;
      if (prix != null) return +prix;
    }
  }

  // 2. Fallback sur l'historique (allCoursHistorique)
  if (Array.isArray(window.allCoursHistorique) && window.allCoursHistorique.length > 0) {
    const hist = window.allCoursHistorique
      .filter(c => {
        const ct = (c.ticker || '').toUpperCase().trim();
        return ct === t || ct.startsWith(t) || t.startsWith(ct);
      })
      .sort((a, b) => new Date(b.date_seance || 0) - new Date(a.date_seance || 0));
    if (hist.length) {
      const last = hist[0];
      const prix = last.cours_cloture || last.cours_normal || last.cours || last.prix;
      if (prix != null) return +prix;
    }
  }

  // 3. Dernier recours: chercher dans allIndices
  if (Array.isArray(window.allIndices) && window.allIndices.length > 0) {
    const idx = window.allIndices.find(c => {
      const ct = (c.ticker || c.nom || '').toUpperCase().trim();
      return ct === t || ct.startsWith(t);
    });
    if (idx) {
      const prix = idx.valeur || idx.cours || idx.dernier;
      if (prix != null) return +prix;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// ACTIONS
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
  renderPortfolio();
  toast('Position ajoutée', 'success');
  document.getElementById('pfQty').value = '';
  document.getElementById('pfPrice').value = '';
}

window.removePosition = function(id) {
  const pf = getPortfolio().filter(p => p.id !== id);
  savePortfolio(pf);
  renderPortfolio();
  toast('Position supprimée', 'success');
}

// ═══════════════════════════════════════════════════════
// RENDU
// ═══════════════════════════════════════════════════════
window.renderPortfolio = function() {
  console.log('renderPortfolio appelé');
  const pf = getPortfolio();

  // KPIs
  const pfTotal = document.getElementById('pfTotal');
  const pfInvested = document.getElementById('pfInvested');
  const pfPL = document.getElementById('pfPL');
  const pfReturn = document.getElementById('pfReturn');
  const pfVol = document.getElementById('pfVolatility');
  const pfSharpe = document.getElementById('pfSharpe');
  const pfDD = document.getElementById('pfDrawdown');
  const pfBeta = document.getElementById('pfBeta');

  if (!pf.length) {
    if (pfTotal) pfTotal.textContent = '—';
    if (pfInvested) pfInvested.textContent = '—';
    if (pfPL) pfPL.textContent = '—';
    if (pfReturn) pfReturn.textContent = '—';
    if (pfVol) pfVol.textContent = '—';
    if (pfSharpe) pfSharpe.textContent = '—';
    if (pfDD) pfDD.textContent = '—';
    if (pfBeta) pfBeta.textContent = '—';

    const tbody = document.getElementById('pfTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--dim)">Aucune position. Ajoutez-en une ci-dessus.</td></tr>';
    return;
  }

  // Calculs
  let totalValue = 0, totalInvested = 0;
  const rows = [];

  pf.forEach(p => {
    const currentPrice = getLatestPrice(p.ticker) || p.price;
    const value = p.qty * currentPrice;
    const invested = p.qty * p.price;
    const pl = value - invested;
    const plPct = invested > 0 ? (pl / invested) * 100 : 0;

    totalValue += value;
    totalInvested += invested;

    rows.push({ ...p, currentPrice, value, invested, pl, plPct });
  });

  const totalPL = totalValue - totalInvested;
  const totalReturn = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  // Update KPIs
  if (pfTotal) pfTotal.textContent = fmtM(totalValue) + ' FCFA';
  if (pfInvested) pfInvested.textContent = fmtM(totalInvested) + ' FCFA';
  if (pfPL) {
    pfPL.textContent = (totalPL >= 0 ? '+' : '') + fmtM(totalPL) + ' FCFA';
    pfPL.style.color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (pfReturn) {
    pfReturn.textContent = fmt(totalReturn, 2) + '%';
    pfReturn.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (pfVol) pfVol.textContent = '—';
  if (pfSharpe) pfSharpe.textContent = '—';
  if (pfDD) pfDD.textContent = '—';
  if (pfBeta) pfBeta.textContent = '—';

  // Tableau
  const tbody = document.getElementById('pfTable');
  if (tbody) {
    tbody.innerHTML = rows.map(p => {
      const plClass = p.pl >= 0 ? 'up' : 'down';
      const priceFound = getLatestPrice(p.ticker) !== null;
      return `<tr>
        <td style="padding:10px 12px;"><span style="font-family:var(--mono);color:var(--gold)">${p.ticker}</span></td>
        <td style="padding:10px 12px;text-align:right">${fmt(p.qty)}</td>
        <td style="padding:10px 12px;text-align:right">${fmt(p.price, 2)}</td>
        <td style="padding:10px 12px;text-align:right;color:${priceFound ? 'inherit' : 'var(--dim)'}">${fmt(p.currentPrice, 2)}${!priceFound ? ' <small style="color:var(--dim)">(est.)</small>' : ''}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.plPct>=0?'var(--green)':'var(--red)'}">${fmt(p.plPct, 2)}%</td>
        <td style="padding:10px 12px;text-align:right">${fmtM(p.value)}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.pl>=0?'var(--green)':'var(--red)'}">${p.pl >= 0 ? '+' : ''}${fmtM(p.pl)}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.plPct>=0?'var(--green)':'var(--red)'}">${fmt(p.plPct, 2)}%</td>
        <td style="padding:10px 12px;text-align:right">${fmt(totalValue > 0 ? (p.value/totalValue*100) : 0, 2)}%</td>
        <td style="padding:10px 12px;text-align:right">—</td>
        <td style="padding:10px 12px;text-align:right">—</td>
        <td style="padding:10px 12px;text-align:center"><button onclick="removePosition(${p.id})" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--dim);font-size:11px;cursor:pointer">🗑</button></td>
      </tr>`;
    }).join('');
  }

  // Graphiques placeholder
  const valueCanvas = document.getElementById('chartPortfolioValue');
  if (valueCanvas && typeof Chart !== 'undefined') {
    const ctx = valueCanvas.getContext('2d');
    ctx.clearRect(0, 0, valueCanvas.width, valueCanvas.height);
  }
}

window.initPortefeuille = function() {
  console.log('initPortefeuille appelé');
  renderPortfolio();
}
