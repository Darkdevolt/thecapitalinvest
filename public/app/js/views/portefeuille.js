// ═══════════════════════════════════════════════════════
// VIEW — Portefeuille Simulé (VERSION SYNCHRONE CORRIGÉE)
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// VARIABLES GLOBALES DES GRAPHIQUES
// ═══════════════════════════════════════════════════════
var pfValueChartInst = null;
var pfSectorChartInst = null;
var pfGeoChartInst = null;
var pfPLChartInst = null;

function getPortfolio() {
  try { return JSON.parse(localStorage.getItem('tc_portfolio') || '[]'); }
  catch { return []; }
}
function savePortfolio(data) { localStorage.setItem('tc_portfolio', JSON.stringify(data)); }

// ═══════════════════════════════════════════════════════
// RÉCUPÉRATION DU COURS ACTUEL — MÊME LOGIQUE QUE TITRES.JS
// ═══════════════════════════════════════════════════════

/**
 * Récupère le cours actuel d'un ticker depuis allCours (données déjà chargées)
 * MÊME MÉTHODE QUE titres.js : allCours.find(c => c.ticker === ticker)
 */
function getLatestPrice(ticker) {
  if (!ticker) return null;
  const t = ticker.toUpperCase().trim();

  // ── Méthode 1 : allCours (cours du jour, déjà chargé dans main.js) ──
  if (Array.isArray(window.allCours) && window.allCours.length > 0) {
    const cours = window.allCours.find(c => c.ticker === t);
    if (cours) {
      const prix = +(cours.cours_cloture || cours.cours_normal || cours.cours || cours.dernier_cours || 0);
      if (prix > 0) return prix;
    }
  }

  // ── Méthode 2 : allCoursHistorique (dernier point = plus récent) ──
  // Note: allCoursHistorique est trié ASC (du plus ancien au plus récent)
  if (Array.isArray(window.allCoursHistorique) && window.allCoursHistorique.length > 0) {
    const histForTicker = window.allCoursHistorique.filter(c => c.ticker === t);
    if (histForTicker.length > 0) {
      // Le dernier élément est le plus récent (tri ASC)
      const last = histForTicker[histForTicker.length - 1];
      const prix = +(last.cours_cloture || last.cours_normal || last.cours || 0);
      if (prix > 0) return prix;
    }
  }

  return null;
}

/**
 * Récupère l'historique complet d'un ticker depuis allCoursHistorique
 */
function getTickerHistory(ticker) {
  if (!ticker || !Array.isArray(window.allCoursHistorique)) return [];
  const t = ticker.toUpperCase().trim();
  return window.allCoursHistorique.filter(c => c.ticker === t);
}

/**
 * Récupère le cours à une date spécifique depuis l'historique
 */
function getPriceAtDate(ticker, dateStr) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;

  // Chercher exactement cette date
  const exact = hist.find(c => c.date_seance === dateStr);
  if (exact) {
    return +(exact.cours_cloture || exact.cours_normal || exact.cours || 0);
  }

  // Sinon, dernier cours avant cette date
  const before = hist
    .filter(c => c.date_seance <= dateStr)
    .sort((a, b) => new Date(b.date_seance) - new Date(a.date_seance));
  if (before.length) {
    return +(before[0].cours_cloture || before[0].cours_normal || before[0].cours || 0);
  }

  return null;
}

/**
 * Calcule le 52-week high/low depuis allCoursHistorique
 */
function get52WeekHigh(ticker) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;
  const vals = hist
    .map(c => +(c.cours_cloture || c.cours_normal || c.cours || 0))
    .filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

function get52WeekLow(ticker) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;
  const vals = hist
    .map(c => +(c.cours_cloture || c.cours_normal || c.cours || 0))
    .filter(v => v > 0);
  return vals.length ? Math.min(...vals) : null;
}

// ═══════════════════════════════════════════════════════
// HELPERS MATHS / STATS
// ═══════════════════════════════════════════════════════
function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function calcVolatility(returns) {
  if (!returns || returns.length < 2) return 0;
  return stdDev(returns) * Math.sqrt(252);
}

function calcSharpe(returns, riskFreeRate = 0.05) {
  if (!returns || returns.length < 2) return 0;
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const vol = stdDev(returns);
  if (vol === 0) return 0;
  return (meanReturn * 252 - riskFreeRate) / (vol * Math.sqrt(252));
}

function calcMaxDrawdown(values) {
  if (!values || values.length < 2) return 0;
  let maxDD = 0, peak = values[0];
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function calcCorrelation(x, y) {
  if (!x || !y || x.length < 2 || x.length !== y.length) return 0;
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// ═══════════════════════════════════════════════════════
// HELPERS DONNÉES
// ═══════════════════════════════════════════════════════
function getSector(ticker) {
  if (!ticker) return 'Divers';
  const t = ticker.toUpperCase().trim();
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.secteur) return ent.secteur;
  if (typeof SECTORS !== 'undefined') {
    for (const [k, v] of Object.entries(SECTORS)) {
      if (t.startsWith(k)) return v;
    }
  }
  return 'Divers';
}

function getPays(ticker) {
  if (!ticker) return 'Inconnu';
  const t = ticker.toUpperCase().trim();
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.pays) return ent.pays;
  if (t.endsWith('SN')) return 'Sénégal';
  if (t.endsWith('CI')) return "Côte d'Ivoire";
  if (t.endsWith('BF')) return 'Burkina Faso';
  if (t.endsWith('BJ')) return 'Bénin';
  if (t.endsWith('TG')) return 'Togo';
  if (t.endsWith('ML')) return 'Mali';
  if (t.endsWith('NE')) return 'Niger';
  if (t.endsWith('GW')) return 'Guinée-Bissau';
  return 'Inconnu';
}

function getDividendYield(ticker) {
  if (!ticker) return 0;
  const t = ticker.toUpperCase().trim();
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.dividende_yield != null) return +ent.dividende_yield;
  if (Array.isArray(window.allCours)) {
    const c = window.allCours.find(x => x.ticker === t);
    if (c && c.dividende_yield != null) return +c.dividende_yield;
    if (c && c.rendement != null) return +c.rendement;
  }
  return 0;
}

// ═══════════════════════════════════════════════════════
// HISTORIQUE DU PORTEFEUILLE — VERSION SYNCHRONE
// ═══════════════════════════════════════════════════════
function getPortfolioHistory(periodDays = 99999) {
  const pf = getPortfolio();
  if (!pf.length) return { dates: [], values: [], pls: [] };

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - periodDays);

  const oldestBuy = new Date(Math.min(...pf.map(p => new Date(p.date || now))));
  const effectiveStart = periodDays === 99999 ? oldestBuy : new Date(Math.max(startDate, oldestBuy));

  const dates = [];
  let current = new Date(effectiveStart);
  while (current <= now) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const values = [];
  const pls = [];

  for (const date of dates) {
    let dayValue = 0;
    let dayInvested = 0;
    const ds = date.toISOString().split('T')[0];

    for (const p of pf) {
      const buyDate = new Date(p.date || p.id);
      if (date >= buyDate) {
        const priceAtDate = getPriceAtDate(p.ticker, ds) || p.price;
        dayValue += p.qty * priceAtDate;
        dayInvested += p.qty * p.price;
      }
    }

    values.push(dayValue);
    pls.push(dayValue - dayInvested);
  }

  return { dates, values, pls };
}

// ═══════════════════════════════════════════════════════
// CALCUL DU CMP (Coût Moyen Pondéré)
// ═══════════════════════════════════════════════════════
function calculateCMP(positions) {
  // Groupe par ticker
  const byTicker = {};
  positions.forEach(p => {
    const t = p.ticker.toUpperCase().trim();
    if (!byTicker[t]) {
      byTicker[t] = { totalQty: 0, totalCost: 0, positions: [] };
    }
    byTicker[t].totalQty += p.qty;
    byTicker[t].totalCost += p.qty * p.price;
    byTicker[t].positions.push(p);
  });

  // Calculer CMP pour chaque ticker
  const cmp = {};
  for (const [ticker, data] of Object.entries(byTicker)) {
    cmp[ticker] = data.totalQty > 0 ? data.totalCost / data.totalQty : 0;
  }
  return cmp;
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

  // Vérifier que le ticker existe dans allCours
  const exists = Array.isArray(window.allCours) && window.allCours.some(c => c.ticker === ticker);
  if (!exists) {
    toast('Ticker non trouvé dans la base BRVM', 'warn');
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
// RENDU PRINCIPAL — VERSION SYNCHRONE
// ═══════════════════════════════════════════════════════
window.renderPortfolio = function() {
  console.log('renderPortfolio appelé');

  const pf = getPortfolio();

  // ── KPIs refs ──
  const pfTotal = document.getElementById('pfTotal');
  const pfInvested = document.getElementById('pfInvested');
  const pfPL = document.getElementById('pfPL');
  const pfReturn = document.getElementById('pfReturn');
  const pfVol = document.getElementById('pfVolatility');
  const pfSharpe = document.getElementById('pfSharpe');
  const pfDD = document.getElementById('pfDrawdown');
  const pfBeta = document.getElementById('pfBeta');
  const pfTotalSub = document.getElementById('pfTotalSub');
  const pfPLSub = document.getElementById('pfPLSub');

  if (!pf.length) {
    resetEmptyState();
    return;
  }

  // ── Calculer CMP par ticker ──
  const cmp = calculateCMP(pf);

  // ── Calculs par position ──
  let totalValue = 0, totalInvested = 0;
  const rows = [];
  const sectors = {};
  const pays = {};

  pf.forEach(p => {
    const currentPrice = getLatestPrice(p.ticker) || p.price;
    const value = p.qty * currentPrice;
    const invested = p.qty * p.price;
    const pl = value - invested;
    const plPct = invested > 0 ? (pl / invested) * 100 : 0;

    totalValue += value;
    totalInvested += invested;

    const s = getSector(p.ticker);
    sectors[s] = (sectors[s] || 0) + value;

    const py = getPays(p.ticker);
    pays[py] = (pays[py] || 0) + value;

    rows.push({ 
      ...p, 
      currentPrice, 
      value, 
      invested, 
      pl, 
      plPct, 
      sector: s, 
      pays: py,
      cmp: cmp[p.ticker.toUpperCase().trim()] || p.price,
      priceFound: getLatestPrice(p.ticker) !== null
    });
  });

  const totalPL = totalValue - totalInvested;
  const totalReturn = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  // ── Historique pour stats avancées ──
  const hist = getPortfolioHistory(252);

  // Calcul des rendements journaliers
  const dailyReturns = [];
  if (hist.values.length >= 2) {
    for (let i = 1; i < hist.values.length; i++) {
      if (hist.values[i - 1] > 0) {
        dailyReturns.push((hist.values[i] - hist.values[i - 1]) / hist.values[i - 1]);
      }
    }
  }

  const vol = calcVolatility(dailyReturns);
  const sharpe = calcSharpe(dailyReturns);
  const maxDD = calcMaxDrawdown(hist.values);
  const beta = 1.0;

  // ── Update KPIs ──
  if (pfTotal) pfTotal.textContent = fmtM(totalValue) + ' FCFA';
  if (pfTotalSub) pfTotalSub.textContent = totalValue >= totalInvested ? '↑ Portefeuille en hausse' : '↓ Portefeuille en baisse';
  if (pfInvested) pfInvested.textContent = fmtM(totalInvested) + ' FCFA';
  if (pfPL) {
    pfPL.textContent = (totalPL >= 0 ? '+' : '') + fmtM(totalPL) + ' FCFA';
    pfPL.style.color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (pfPLSub) {
    pfPLSub.textContent = totalReturn >= 0 ? `+${fmt(totalReturn, 2)}% depuis l'achat` : `${fmt(totalReturn, 2)}% depuis l'achat`;
    pfPLSub.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (pfReturn) {
    pfReturn.textContent = fmt(totalReturn, 2) + '%';
    pfReturn.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (pfVol) pfVol.textContent = vol > 0 ? fmt(vol * 100, 2) + '%' : '—';
  if (pfSharpe) pfSharpe.textContent = sharpe !== 0 ? fmt(sharpe, 2) : '—';
  if (pfDD) pfDD.textContent = maxDD > 0 ? '-' + fmt(maxDD, 2) + '%' : '—';
  if (pfBeta) pfBeta.textContent = fmt(beta, 2);

  // ── Tableau avec CMP ──
  const tbody = document.getElementById('pfTable');
  if (tbody) {
    tbody.innerHTML = rows.map(p => {
      const high52 = get52WeekHigh(p.ticker);
      const low52 = get52WeekLow(p.ticker);
      return `<tr>
        <td style="padding:10px 12px;"><span style="font-family:var(--mono);color:var(--gold)">${p.ticker}</span></td>
        <td style="padding:10px 12px;text-align:right">${fmt(p.qty)}</td>
        <td style="padding:10px 12px;text-align:right">${fmt(p.price, 2)}</td>
        <td style="padding:10px 12px;text-align:right">${fmt(p.cmp, 2)}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.priceFound ? 'inherit' : 'var(--dim)'}">${fmt(p.currentPrice, 2)}${!p.priceFound ? ' <small style="color:var(--dim)">(est.)</small>' : ''}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.plPct>=0?'var(--green)':'var(--red)'}">${fmt(p.plPct, 2)}%</td>
        <td style="padding:10px 12px;text-align:right">${fmtM(p.value)}</td>
        <td style="padding:10px 12px;text-align:right;color:${p.pl>=0?'var(--green)':'var(--red)'}">${p.pl >= 0 ? '+' : ''}${fmtM(p.pl)}</td>
        <td style="padding:10px 12px;text-align:right">${fmt(totalValue > 0 ? (p.value/totalValue*100) : 0, 2)}%</td>
        <td style="padding:10px 12px;text-align:right">${high52 ? fmt(high52, 2) : '—'}</td>
        <td style="padding:10px 12px;text-align:right">${low52 ? fmt(low52, 2) : '—'}</td>
        <td style="padding:10px 12px;text-align:center"><button onclick="removePosition(${p.id})" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--dim);font-size:11px;cursor:pointer">🗑</button></td>
      </tr>`;
    }).join('');
  }

  // ── Compteur de positions ──
  const countEl = document.getElementById('pfPositionCount');
  if (countEl) countEl.textContent = `${pf.length} position${pf.length > 1 ? 's' : ''}`;

  // ── GRAPHIQUES ──
  renderPortfolioCharts(rows, totalValue, sectors, pays, hist);

  // ── Concentration ──
  renderConcentration(rows, totalValue);

  // ── Dividendes ──
  renderDividends(rows);

  // ── Performance vs BRVM ──
  renderBenchmark(rows, hist);

  // ── Matrice de corrélation ──
  renderCorrelationMatrix(pf);
}

// ═══════════════════════════════════════════════════════
// GRAPHIQUES
// ═══════════════════════════════════════════════════════
function renderPortfolioCharts(rows, totalValue, sectors, pays, hist) {
  if (typeof Chart === 'undefined') return;

  const pf = getPortfolio();

  // ── 1. Évolution de la Valeur (Line) ──
  const valueCanvas = document.getElementById('chartPortfolioValue');
  if (valueCanvas) {
    if (pfValueChartInst) { pfValueChartInst.destroy(); pfValueChartInst = null; }

    const labels = hist.dates.map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    const data = hist.values;

    pfValueChartInst = new Chart(valueCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Valeur du portefeuille',
          data: data,
          borderColor: '#B8964E',
          backgroundColor: 'rgba(184,150,78,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        ...chartOpts,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1610',
            borderColor: 'rgba(184,150,78,0.3)',
            borderWidth: 1,
            titleColor: '#B8964E',
            bodyColor: '#F5F0E8',
            callbacks: { label: ctx => ' ' + fmtM(ctx.parsed.y) + ' FCFA' }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, maxTicksLimit: 6 } },
          y: { position: 'right', grid: { color: 'rgba(184,150,78,0.06)' }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, callback: v => fmtM(v) } }
        }
      }
    });
  }

  // ── 2. Allocation Sectorielle (Doughnut) ──
  const sectorCanvas = document.getElementById('chartSectorAlloc');
  if (sectorCanvas) {
    if (pfSectorChartInst) { pfSectorChartInst.destroy(); pfSectorChartInst = null; }

    const sectorLabels = Object.keys(sectors);
    const sectorData = Object.values(sectors);
    const colors = ['#B8964E', '#4ADE80', '#F87171', '#60A5FA', '#A78BFA', '#FBBF24', '#34D399', '#F472B6', '#818CF8', '#FB923C'];

    pfSectorChartInst = new Chart(sectorCanvas, {
      type: 'doughnut',
      data: {
        labels: sectorLabels,
        datasets: [{
          data: sectorData,
          backgroundColor: colors,
          borderColor: '#1A1610',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: 'rgba(245,240,232,0.6)', font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            backgroundColor: '#1A1610',
            borderColor: 'rgba(184,150,78,0.3)',
            borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed / totalValue * 100, 1)}%` }
          }
        },
        cutout: '60%'
      }
    });
  }

  // ── 3. Répartition Géographique (Doughnut) ──
  const geoCanvas = document.getElementById('chartGeoAlloc');
  if (geoCanvas) {
    if (pfGeoChartInst) { pfGeoChartInst.destroy(); pfGeoChartInst = null; }

    const geoLabels = Object.keys(pays);
    const geoData = Object.values(pays);
    const geoColors = ['#B8964E', '#4ADE80', '#60A5FA', '#F87171', '#A78BFA', '#FBBF24'];

    pfGeoChartInst = new Chart(geoCanvas, {
      type: 'doughnut',
      data: {
        labels: geoLabels,
        datasets: [{
          data: geoData,
          backgroundColor: geoColors,
          borderColor: '#1A1610',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: 'rgba(245,240,232,0.6)', font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            backgroundColor: '#1A1610',
            borderColor: 'rgba(184,150,78,0.3)',
            borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed / totalValue * 100, 1)}%` }
          }
        },
        cutout: '60%'
      }
    });
  }

  // ── 4. P&L Cumulé (Bar) ──
  const plCanvas = document.getElementById('chartPortfolioPL');
  if (plCanvas) {
    if (pfPLChartInst) { pfPLChartInst.destroy(); pfPLChartInst = null; }

    const plLabels = hist.dates.map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    const plData = hist.pls;
    const plColors = plData.map(v => v >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)');

    pfPLChartInst = new Chart(plCanvas, {
      type: 'bar',
      data: {
        labels: plLabels,
        datasets: [{
          label: 'P&L cumulé',
          data: plData,
          backgroundColor: plColors,
          borderRadius: 2,
          borderSkipped: false
        }]
      },
      options: {
        ...chartOpts,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1610',
            borderColor: 'rgba(184,150,78,0.3)',
            borderWidth: 1,
            callbacks: { label: ctx => ' ' + (ctx.parsed.y >= 0 ? '+' : '') + fmtM(ctx.parsed.y) + ' FCFA' }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, maxTicksLimit: 6 } },
          y: { position: 'right', grid: { color: 'rgba(184,150,78,0.06)' }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, callback: v => fmtM(v) } }
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════
// CONCENTRATION
// ═══════════════════════════════════════════════════════
function renderConcentration(rows, totalValue) {
  const el = document.getElementById('concentrationStats');
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour analyser la concentration</div>';
    return;
  }

  const top3 = [...rows].sort((a, b) => b.value - a.value).slice(0, 3);
  const top3Pct = top3.reduce((s, r) => s + (r.value / totalValue * 100), 0);

  const hhi = rows.reduce((s, r) => s + Math.pow(r.value / totalValue * 100, 2), 0);
  let hhiLabel = 'Faible';
  if (hhi > 2500) hhiLabel = 'Élevée';
  else if (hhi > 1500) hhiLabel = 'Modérée';

  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Top 3 positions</span>
        <span style="font-size:14px;font-weight:600;color:var(--gold)">${fmt(top3Pct, 1)}%</span>
      </div>
      <div style="width:100%;height:6px;background:var(--border2);border-radius:3px;margin-bottom:16px;overflow:hidden">
        <div style="width:${top3Pct}%;height:100%;background:var(--gold);border-radius:3px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Indice HHI</span>
        <span style="font-size:14px;font-weight:600;color:${hhiLabel === 'Élevée' ? 'var(--red)' : hhiLabel === 'Modérée' ? 'var(--gold)' : 'var(--green)'}">${fmt(hhi, 0)} — ${hhiLabel}</span>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-top:8px">
        ${top3.map((r, i) => `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span>${i+1}. ${r.ticker}</span>
          <span style="color:var(--cream)">${fmt(r.value/totalValue*100, 1)}%</span>
        </div>`).join('')}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// DIVIDENDES ESTIMÉS
// ═══════════════════════════════════════════════════════
function renderDividends(rows) {
  const el = document.getElementById('dividendStats');
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour estimer les dividendes</div>';
    return;
  }

  let totalDividend = 0;
  const divDetails = [];

  rows.forEach(r => {
    const yield_ = getDividendYield(r.ticker);
    const divEstime = r.value * (yield_ / 100);
    totalDividend += divEstime;
    if (yield_ > 0) {
      divDetails.push({ ticker: r.ticker, yield: yield_, value: r.value, div: divEstime });
    }
  });

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const portfolioYield = totalValue > 0 ? (totalDividend / totalValue * 100) : 0;

  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Rendement estimé</span>
        <span style="font-size:18px;font-weight:600;color:var(--gold)">${fmt(portfolioYield, 2)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-size:12px;color:var(--dim)">Dividendes annuels estimés</span>
        <span style="font-size:14px;font-weight:600;color:var(--green)">+${fmtM(totalDividend)} FCFA</span>
      </div>
      <div style="font-size:11px;color:var(--dim)">
        ${divDetails.length ? divDetails.map(d => `<div style="display:flex;justify-content:space-between;margin-bottom:4px;padding:4px 0;border-bottom:1px solid var(--border2)">
          <span>${d.ticker} <small style="color:var(--gold)">(${fmt(d.yield, 2)}%)</small></span>
          <span style="color:var(--cream)">${fmtM(d.div)}</span>
        </div>`).join('') : '<div style="text-align:center;padding:8px">Aucune donnée de dividende disponible</div>'}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// PERFORMANCE VS BRVM
// ═══════════════════════════════════════════════════════
function renderBenchmark(rows, hist) {
  const el = document.getElementById('benchmarkStats');
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour comparer avec le benchmark</div>';
    return;
  }

  let brvmReturn = 0;
  if (Array.isArray(window.allIndices) && window.allIndices.length > 0) {
    const composite = window.allIndices.filter(i => 
      (i.nom || i.ticker || '').toUpperCase().includes('COMPOSITE')
    );
    if (composite.length >= 2) {
      const sorted = composite.sort((a, b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const firstVal = +(first.valeur || first.cours || first.dernier || 0);
      const lastVal = +(last.valeur || last.cours || last.dernier || 0);
      if (firstVal > 0) {
        brvmReturn = (lastVal - firstVal) / firstVal * 100;
      }
    }
  }

  const pfReturn = hist.values.length >= 2 && hist.values[0] > 0
    ? (hist.values[hist.values.length - 1] - hist.values[0]) / hist.values[0] * 100
    : 0;

  const outperformance = pfReturn - brvmReturn;

  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Votre portefeuille</span>
        <span style="font-size:14px;font-weight:600;color:${pfReturn >= 0 ? 'var(--green)' : 'var(--red)'}">${pfReturn >= 0 ? '+' : ''}${fmt(pfReturn, 2)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">BRVM Composite</span>
        <span style="font-size:14px;font-weight:600;color:${brvmReturn >= 0 ? 'var(--green)' : 'var(--red)'}">${brvmReturn >= 0 ? '+' : ''}${fmt(brvmReturn, 2)}%</span>
      </div>
      <div style="width:100%;height:1px;background:var(--border2);margin:12px 0"></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:var(--dim)">Surperformance</span>
        <span style="font-size:16px;font-weight:600;color:${outperformance >= 0 ? 'var(--green)' : 'var(--red)'}">${outperformance >= 0 ? '+' : ''}${fmt(outperformance, 2)}%</span>
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--dim);text-align:center">
        ${outperformance >= 0 ? '✓ Vous battez le marché' : '⚠ Vous sous-performez le marché'}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// MATRICE DE CORRÉLATION
// ═══════════════════════════════════════════════════════
function renderCorrelationMatrix(pf) {
  const el = document.getElementById('correlationMatrix');
  if (!el) return;

  if (pf.length < 2) {
    el.innerHTML = 'Ajoutez au moins 2 positions pour voir la matrice de corrélation';
    return;
  }

  const tickers = pf.map(p => p.ticker.toUpperCase().trim());
  const returns = {};

  tickers.forEach(t => {
    const hist = getTickerHistory(t);
    const prices = hist.map(c => +(c.cours_cloture || c.cours_normal || c.cours || 0)).filter(v => v > 0);
    returns[t] = [];
    for (let i = 1; i < prices.length; i++) {
      returns[t].push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  });

  const minLen = Math.min(...Object.values(returns).map(r => r.length));
  if (minLen < 5) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px">Données historiques insuffisantes pour calculer la corrélation</div>';
    return;
  }

  tickers.forEach(t => { returns[t] = returns[t].slice(-minLen); });

  let html = '<div style="display:grid;gap:2px;padding:8px;overflow:auto">';

  html += '<div style="display:contents">';
  html += '<div style="width:50px"></div>';
  tickers.forEach(t => {
    html += `<div style="width:50px;text-align:center;font-size:10px;color:var(--gold);font-family:var(--mono);padding:4px 2px">${t}</div>`;
  });
  html += '</div>';

  tickers.forEach(t1 => {
    html += '<div style="display:contents">';
    html += `<div style="width:50px;text-align:right;font-size:10px;color:var(--gold);font-family:var(--mono);padding:4px 2px">${t1}</div>`;
    tickers.forEach(t2 => {
      const corr = t1 === t2 ? 1 : calcCorrelation(returns[t1], returns[t2]);
      const color = corr > 0.7 ? 'rgba(248,113,113,0.7)' : corr > 0.3 ? 'rgba(251,191,36,0.5)' : corr > -0.3 ? 'rgba(245,240,232,0.1)' : corr > -0.7 ? 'rgba(74,222,128,0.3)' : 'rgba(74,222,128,0.6)';
      html += `<div style="width:50px;height:32px;display:flex;align-items:center;justify-content:center;background:${color};border-radius:3px;font-size:10px;color:var(--cream);font-family:var(--mono)">${fmt(corr, 2)}</div>`;
    });
    html += '</div>';
  });

  html += '</div>';
  html += '<div style="display:flex;gap:12px;justify-content:center;margin-top:8px;font-size:10px;color:var(--dim)">';
  html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(74,222,128,0.6);border-radius:2px;margin-right:4px"></span>Négative</span>';
  html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(245,240,232,0.1);border-radius:2px;margin-right:4px"></span>Faible</span>';
  html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(251,191,36,0.5);border-radius:2px;margin-right:4px"></span>Modérée</span>';
  html += '<span><span style="display:inline-block;width:10px;height:10px;background:rgba(248,113,113,0.7);border-radius:2px;margin-right:4px"></span>Élevée</span>';
  html += '</div>';

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// ÉTAT VIDE
// ═══════════════════════════════════════════════════════
function resetEmptyState() {
  const pfTotal = document.getElementById('pfTotal');
  const pfInvested = document.getElementById('pfInvested');
  const pfPL = document.getElementById('pfPL');
  const pfReturn = document.getElementById('pfReturn');
  const pfVol = document.getElementById('pfVolatility');
  const pfSharpe = document.getElementById('pfSharpe');
  const pfDD = document.getElementById('pfDrawdown');
  const pfBeta = document.getElementById('pfBeta');

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

  const countEl = document.getElementById('pfPositionCount');
  if (countEl) countEl.textContent = '0 position';

  if (pfValueChartInst) { pfValueChartInst.destroy(); pfValueChartInst = null; }
  if (pfSectorChartInst) { pfSectorChartInst.destroy(); pfSectorChartInst = null; }
  if (pfGeoChartInst) { pfGeoChartInst.destroy(); pfGeoChartInst = null; }
  if (pfPLChartInst) { pfPLChartInst.destroy(); pfPLChartInst = null; }

  ['concentrationStats', 'dividendStats', 'benchmarkStats'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour analyser</div>';
  });

  const corrEl = document.getElementById('correlationMatrix');
  if (corrEl) corrEl.innerHTML = 'Ajoutez au moins 2 positions pour voir la matrice de corrélation';
}

// ═══════════════════════════════════════════════════════
// PÉRIODE DU GRAPHIQUE
// ═══════════════════════════════════════════════════════
window.setPortfolioPeriod = function(days, btn) {
  document.querySelectorAll('#view-portefeuille .year-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window._pfPeriod = days;
  renderPortfolio();
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
window.initPortefeuille = function() {
  console.log('initPortefeuille appelé');
  window._pfPeriod = window._pfPeriod || 99999;
  renderPortfolio();
}

