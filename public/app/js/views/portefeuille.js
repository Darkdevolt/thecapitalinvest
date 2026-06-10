// ═══════════════════════════════════════════════════════
// VIEW — Portefeuille Simulé (VERSION COMPLÈTE & OPTIMALE)
// ═══════════════════════════════════════════════════════
// NOTE: fmt, fmtM, fmtDate, chartOpts, mkDataset sont dans utils.js

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

  // 1. Cours du jour (allCours) — PRIORITAIRE
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

  // 2. Fallback historique
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

  // 3. Indices
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
  const dailyStd = stdDev(returns);
  return dailyStd * Math.sqrt(252); // annualisé
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

function calcBeta(stockReturns, marketReturns) {
  if (!stockReturns || !marketReturns || stockReturns.length < 2 || stockReturns.length !== marketReturns.length) return 0;
  const n = stockReturns.length;
  const meanStock = stockReturns.reduce((a, b) => a + b, 0) / n;
  const meanMarket = marketReturns.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varMarket = 0;
  for (let i = 0; i < n; i++) {
    cov += (stockReturns[i] - meanStock) * (marketReturns[i] - meanMarket);
    varMarket += Math.pow(marketReturns[i] - meanMarket, 2);
  }
  cov /= (n - 1);
  varMarket /= (n - 1);
  return varMarket === 0 ? 0 : cov / varMarket;
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
  // Fallback sur SECTORS de utils.js
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
  // Fallback par convention ticker
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
  // Fallback: chercher dans allCours
  if (Array.isArray(window.allCours)) {
    const c = window.allCours.find(x => (x.ticker || '').toUpperCase().trim() === t);
    if (c && c.dividende_yield != null) return +c.dividende_yield;
    if (c && c.rendement != null) return +c.rendement;
  }
  return 0;
}

function get52WeekHigh(ticker) {
  if (!ticker || !Array.isArray(window.allCoursHistorique)) return null;
  const t = ticker.toUpperCase().trim();
  const hist = window.allCoursHistorique
    .filter(c => (c.ticker || '').toUpperCase().trim() === t)
    .map(c => +(c.cours_cloture || c.cours_normal || c.cours || 0))
    .filter(v => v > 0);
  return hist.length ? Math.max(...hist) : null;
}

function get52WeekLow(ticker) {
  if (!ticker || !Array.isArray(window.allCoursHistorique)) return null;
  const t = ticker.toUpperCase().trim();
  const hist = window.allCoursHistorique
    .filter(c => (c.ticker || '').toUpperCase().trim() === t)
    .map(c => +(c.cours_cloture || c.cours_normal || c.cours || 0))
    .filter(v => v > 0);
  return hist.length ? Math.min(...hist) : null;
}

// ═══════════════════════════════════════════════════════
// HISTORIQUE DU PORTEFEUILLE (simulation)
// ═══════════════════════════════════════════════════════
function getPortfolioHistory(periodDays = 99999) {
  const pf = getPortfolio();
  if (!pf.length) return [];

  // Date de début = date d'achat la plus ancienne ou periodDays en arrière
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - periodDays);

  const oldestBuy = new Date(Math.min(...pf.map(p => new Date(p.date || now))));
  const effectiveStart = periodDays === 99999 ? oldestBuy : new Date(Math.max(startDate, oldestBuy));

  // Générer les dates de trading (jours ouvrés simplifiés)
  const dates = [];
  const values = [];
  const pls = [];

  let current = new Date(effectiveStart);
  while (current <= now) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // pas weekend
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  // Pour chaque date, calculer la valeur du portefeuille
  dates.forEach(date => {
    let dayValue = 0;
    let dayInvested = 0;

    pf.forEach(p => {
      const buyDate = new Date(p.date || p.id);
      if (date >= buyDate) {
        // Chercher le prix à cette date dans l'historique
        const t = p.ticker.toUpperCase().trim();
        let priceAtDate = p.price; // fallback

        if (Array.isArray(window.allCoursHistorique)) {
          const ds = date.toISOString().split('T')[0];
          const hist = window.allCoursHistorique
            .filter(c => (c.ticker || '').toUpperCase().trim() === t && c.date_seance === ds)
            .sort((a, b) => new Date(b.date_seance) - new Date(a.date_seance));
          if (hist.length) {
            priceAtDate = +(hist[0].cours_cloture || hist[0].cours_normal || hist[0].cours || p.price);
          } else {
            // Si pas de donnée pour cette date, utiliser le dernier cours connu avant
            const before = window.allCoursHistorique
              .filter(c => (c.ticker || '').toUpperCase().trim() === t && new Date(c.date_seance) <= date)
              .sort((a, b) => new Date(b.date_seance) - new Date(a.date_seance));
            if (before.length) {
              priceAtDate = +(before[0].cours_cloture || before[0].cours_normal || before[0].cours || p.price);
            } else {
              // Pas d'historique du tout → utiliser cours actuel
              priceAtDate = getLatestPrice(t) || p.price;
            }
          }
        } else {
          priceAtDate = getLatestPrice(t) || p.price;
        }

        dayValue += p.qty * priceAtDate;
        dayInvested += p.qty * p.price;
      }
    });

    values.push(dayValue);
    pls.push(dayValue - dayInvested);
  });

  return { dates, values, pls };
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
// RENDU PRINCIPAL
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

  // ── Calculs par position ──
  let totalValue = 0, totalInvested = 0;
  const rows = [];
  const sectors = {};
  const pays = {};
  const dailyReturns = [];

  pf.forEach(p => {
    const currentPrice = getLatestPrice(p.ticker) || p.price;
    const value = p.qty * currentPrice;
    const invested = p.qty * p.price;
    const pl = value - invested;
    const plPct = invested > 0 ? (pl / invested) * 100 : 0;

    totalValue += value;
    totalInvested += invested;

    // Secteur
    const s = getSector(p.ticker);
    sectors[s] = (sectors[s] || 0) + value;

    // Pays
    const py = getPays(p.ticker);
    pays[py] = (pays[py] || 0) + value;

    rows.push({ ...p, currentPrice, value, invested, pl, plPct, sector: s, pays: py });
  });

  const totalPL = totalValue - totalInvested;
  const totalReturn = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  // ── Historique pour stats avancées ──
  const hist = getPortfolioHistory(252);

  // Calcul des rendements journaliers
  if (hist.values.length >= 2) {
    for (let i = 1; i < hist.values.length; i++) {
      if (hist.values[i - 1] > 0) {
        dailyReturns.push((hist.values[i] - hist.values[i - 1]) / hist.values[i - 1]);
      }
    }
  }

  // Volatilité
  const vol = calcVolatility(dailyReturns);

  // Sharpe
  const sharpe = calcSharpe(dailyReturns);

  // Max Drawdown
  const maxDD = calcMaxDrawdown(hist.values);

  // Beta vs BRVM Composite
  let beta = 0;
  if (Array.isArray(window.allIndices) && window.allIndices.length > 0) {
    const compositeHist = window.allIndices
      .filter(i => (i.nom || i.ticker || '').toUpperCase().includes('COMPOSITE'))
      .sort((a, b) => new Date(b.date_seance || 0) - new Date(a.date_seance || 0));
    // Simplification: on ne calcule pas le beta réel sans historique aligné
    // On met un placeholder basé sur la corrélation des returns
    beta = 1.0; // placeholder, à affiner avec données réelles
  }

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

  // ── Tableau ──
  const tbody = document.getElementById('pfTable');
  if (tbody) {
    tbody.innerHTML = rows.map(p => {
      const priceFound = getLatestPrice(p.ticker) !== null;
      const high52 = get52WeekHigh(p.ticker);
      const low52 = get52WeekLow(p.ticker);
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

  // Top 3 positions
  const top3 = [...rows].sort((a, b) => b.value - a.value).slice(0, 3);
  const top3Pct = top3.reduce((s, r) => s + (r.value / totalValue * 100), 0);

  // HHI (Herfindahl-Hirschman Index)
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

  // Récupérer l'évolution du BRVM Composite sur la même période
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

  // Return du portefeuille
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

  // Récupérer l'historique de chaque ticker
  const tickers = pf.map(p => p.ticker.toUpperCase().trim());
  const priceHistories = {};

  tickers.forEach(t => {
    if (Array.isArray(window.allCoursHistorique)) {
      priceHistories[t] = window.allCoursHistorique
        .filter(c => (c.ticker || '').toUpperCase().trim() === t)
        .sort((a, b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0))
        .map(c => +(c.cours_cloture || c.cours_normal || c.cours || 0))
        .filter(v => v > 0);
    }
  });

  // Calculer les rendements pour chaque ticker
  const returns = {};
  tickers.forEach(t => {
    const prices = priceHistories[t] || [];
    returns[t] = [];
    for (let i = 1; i < prices.length; i++) {
      returns[t].push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  });

  // Trouver la longueur minimale
  const minLen = Math.min(...Object.values(returns).map(r => r.length));
  if (minLen < 5) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px">Données historiques insuffisantes pour calculer la corrélation</div>';
    return;
  }

  // Tronquer à la même longueur
  tickers.forEach(t => { returns[t] = returns[t].slice(-minLen); });

  // Construire la matrice
  let html = '<div style="display:grid;gap:2px;padding:8px;overflow:auto">';

  // Header
  html += '<div style="display:contents">';
  html += '<div style="width:50px"></div>';
  tickers.forEach(t => {
    html += `<div style="width:50px;text-align:center;font-size:10px;color:var(--gold);font-family:var(--mono);padding:4px 2px">${t}</div>`;
  });
  html += '</div>';

  // Rows
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

  // Vider les graphiques
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

  // Re-render avec la nouvelle période
  // On stocke la période active
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
