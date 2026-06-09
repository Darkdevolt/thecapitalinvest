// ═══════════════════════════════════════════════════════
// VIEW — Portefeuille Simulé (VERSION TEST MINIMALE)
// ═══════════════════════════════════════════════════════

function getPortfolio() {
  try { return JSON.parse(localStorage.getItem('tc_portfolio') || '[]'); }
  catch { return []; }
}
function savePortfolio(data) { localStorage.setItem('tc_portfolio', JSON.stringify(data)); }

function getLatestPriceFromHistory(ticker) {
  if (!Array.isArray(window.allCoursHistorique)) return null;
  const hist = window.allCoursHistorique
    .filter(c => c.ticker === ticker && c.date_seance)
    .sort((a, b) => new Date(a.date_seance) - new Date(b.date_seance));
  if (!hist.length) return null;
  const last = hist[hist.length - 1];
  return last.cours_cloture || last.cours_normal || last.cours;
}

function fmt(n) { return n == null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }); }

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
  document.getElementById('pfQty').value = '';
  document.getElementById('pfPrice').value = '';
}

function removePosition(id) {
  const pf = getPortfolio().filter(p => p.id !== id);
  savePortfolio(pf);
  renderPortfolio();
  toast('Position supprimée', 'success');
}

function renderPortfolio() {
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

  // Calculs basiques
  let totalValue = 0, totalInvested = 0;
  const rows = [];

  pf.forEach(p => {
    const histPrice = getLatestPriceFromHistory(p.ticker);
    const currentPrice = histPrice || p.price;
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
    pfReturn.textContent = fmtPct(totalReturn);
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
      return `<tr>
        <td style="padding:10px 12px;"><span style="font-family:var(--mono);color:var(--gold)">${p.ticker}</span></td>
        <td style="padding:10px 12px;text-align:right">${fmt(p.qty)}</td>
        <td style="padding:10px 12px;text-align:right">${fmt(p.price)}</td>
        <td style="padding:10px 12px;text-align:right">${fmt(p.currentPrice)}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.plPct>=0?'var(--green)':'var(--red)'}">${fmtPct(p.plPct)}</td>
        <td style="padding:10px 12px;text-align:right">${fmtM(p.value)}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.pl>=0?'var(--green)':'var(--red)'}">${p.pl >= 0 ? '+' : ''}${fmtM(p.pl)}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.plPct>=0?'var(--green)':'var(--red)'}">${fmtPct(p.plPct)}</td>
        <td style="padding:10px 12px;text-align:right">${fmt(totalValue > 0 ? (p.value/totalValue*100) : 0)}%</td>
        <td style="padding:10px 12px;text-align:right">—</td>
        <td style="padding:10px 12px;text-align:right">—</td>
        <td style="padding:10px 12px;text-align:center"><button onclick="removePosition(${p.id})" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--dim);font-size:11px;cursor:pointer">🗑</button></td>
      </tr>`;
    }).join('');
  }

  // Graphiques placeholder
  const valueCanvas = document.getElementById('chartPortfolioValue');
  if (valueCanvas && typeof Chart !== 'undefined') {
    // Simple line chart
    const ctx = valueCanvas.getContext('2d');
    ctx.clearRect(0, 0, valueCanvas.width, valueCanvas.height);
  }
}

function initPortefeuille() {
  console.log('initPortefeuille appelé');
  renderPortfolio();
}
