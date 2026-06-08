// ═══════════════════════════════════════════════════════
// VIEW — Portefeuille Simulé (Complet)
// ═══════════════════════════════════════════════════════

// ── Helpers ──
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

function getPriceHistory(ticker, days = 252) {
  if (!Array.isArray(window.allCoursHistorique)) return [];
  const hist = window.allCoursHistorique
    .filter(c => c.ticker === ticker && c.date_seance)
    .sort((a, b) => new Date(a.date_seance) - new Date(b.date_seance));
  return hist.slice(-days).map(c => ({
    date: c.date_seance,
    price: c.cours_cloture || c.cours_normal || c.cours
  }));
}

function getBRVMHistory(days = 252) {
  if (!Array.isArray(window.allIndices)) return [];
  const idx = window.allIndices
    .filter(i => i.indice === 'BRVM Composite' && i.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return idx.slice(-days).map(i => ({
    date: i.date,
    price: i.valeur
  }));
}

function fmt(n) { return n == null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }); }
function fmtM(n) { return n == null ? '—' : (n / 1e6).toFixed(2) + 'M'; }
function fmtPct(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }

// ── Standard deviation ──
function stdDev(arr) {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sq = arr.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / arr.length);
}

// ── Correlation ──
function correlation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const sx = x.slice(-n), sy = y.slice(-n);
  const mx = sx.reduce((a, b) => a + b, 0) / n;
  const my = sy.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xv = sx[i] - mx, yv = sy[i] - my;
    num += xv * yv;
    dx += xv * xv;
    dy += yv * yv;
  }
  const den = Math.sqrt(dx * dy);
  return den ? num / den : 0;
}

// ── Sector map ──
function getSector(ticker) {
  const e = (window.allEntreprises || []).find(en => en.ticker === ticker);
  return e?.secteur || 'Autre';
}

function getCompanyName(ticker) {
  const e = (window.allEntreprises || []).find(en => en.ticker === ticker);
  return e?.nom || ticker;
}

function getCountry(ticker) {
  const e = (window.allEntreprises || []).find(en => en.ticker === ticker);
  return e?.pays || 'Inconnu';
}

// ── Dividend yield estimate ──
function getDivYield(ticker) {
  const fin = (window.allFinancials || []).find(f => f.ticker === ticker);
  if (fin?.dividende && fin?.cours) {
    return (fin.dividende / fin.cours) * 100;
  }
  return 0;
}

// ═══════════════════════════════════════════════════════
// ADD / REMOVE POSITION
// ═══════════════════════════════════════════════════════
function addPosition() {
  const ticker = document.getElementById('pfTicker').value;
  const qty = parseInt(document.getElementById('pfQty').value);
  const price = parseFloat(document.getElementById('pfPrice').value);
  const date = document.getElementById('pfDate').value;
  if (!ticker || !qty || !price) { toast('Remplissez tous les champs', 'warn'); return; }
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

function removePosition(id) {
  const pf = getPortfolio().filter(p => p.id !== id);
  savePortfolio(pf);
  renderPortfolio();
  toast('Position supprimée', 'success');
}

// ═══════════════════════════════════════════════════════
// RENDER PORTFOLIO
// ═══════════════════════════════════════════════════════
function renderPortfolio() {
  const pf = getPortfolio();
  if (!pf.length) {
    renderEmptyPortfolio();
    return;
  }

  // ── Build position data ──
  const positions = pf.map(p => {
    const histPrice = getLatestPriceFromHistory(p.ticker);
    const currentPrice = histPrice || p.price;
    const value = p.qty * currentPrice;
    const invested = p.qty * p.price;
    const pl = value - invested;
    const plPct = invested > 0 ? (pl / invested) * 100 : 0;
    const sector = getSector(p.ticker);
    const company = getCompanyName(p.ticker);
    const country = getCountry(p.ticker);
    const divYield = getDivYield(p.ticker);
    const hist = getPriceHistory(p.ticker, 252);
    const high52 = hist.length ? Math.max(...hist.map(h => h.price)) : currentPrice;
    const low52 = hist.length ? Math.min(...hist.map(h => h.price)) : currentPrice;
    return { ...p, currentPrice, value, invested, pl, plPct, sector, company, country, divYield, high52, low52, hist };
  });

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalInvested = positions.reduce((s, p) => s + p.invested, 0);
  const totalPL = totalValue - totalInvested;
  const totalReturn = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  // ── KPIs ──
  renderKPIs(positions, totalValue, totalInvested, totalPL, totalReturn);

  // ── Charts ──
  renderPortfolioCharts(positions, totalValue);

  // ── Correlation Matrix ──
  renderCorrelationMatrix(positions);

  // ── Detailed Table ──
  renderPortfolioTable(positions, totalValue);

  // ── Concentration ──
  renderConcentration(positions, totalValue);

  // ── Dividends ──
  renderDividends(positions, totalValue);

  // ── Benchmark ──
  renderBenchmark(positions, totalValue, totalInvested);
}

function renderEmptyPortfolio() {
  // Reset KPIs
  document.getElementById('pfTotal').textContent = '—';
  document.getElementById('pfInvested').textContent = '—';
  document.getElementById('pfPL').textContent = '—';
  document.getElementById('pfPL').style.color = '';
  document.getElementById('pfReturn').textContent = '—';
  document.getElementById('pfReturn').style.color = '';
  document.getElementById('pfVolatility').textContent = '—';
  document.getElementById('pfSharpe').textContent = '—';
  document.getElementById('pfDrawdown').textContent = '—';
  document.getElementById('pfDrawdown').style.color = '';
  document.getElementById('pfBeta').textContent = '—';

  // Reset sub-labels
  const pfTotalSub = document.getElementById('pfTotalSub');
  if (pfTotalSub) pfTotalSub.textContent = '';
  const pfPLSub = document.getElementById('pfPLSub');
  if (pfPLSub) pfPLSub.textContent = '';

  // Reset charts
  ['chartPortfolioValue', 'chartSectorAlloc', 'chartGeoAlloc', 'chartPortfolioPL'].forEach(id => {
    const canvas = document.getElementById(id);
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });

  // Reset correlation
  const corr = document.getElementById('correlationMatrix');
  if (corr) corr.innerHTML = 'Ajoutez au moins 2 positions pour voir la matrice de corrélation';

  // Reset table
  const tbody = document.getElementById('pfTable');
  if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--dim)">Aucune position. Ajoutez-en une ci-dessus.</td></tr>';

  // Reset stats
  document.getElementById('concentrationStats').innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour analyser la concentration</div>';
  document.getElementById('dividendStats').innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour estimer les dividendes</div>';
  document.getElementById('benchmarkStats').innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour comparer avec le benchmark</div>';
}

// ═══════════════════════════════════════════════════════
// KPIs
// ═══════════════════════════════════════════════════════
function renderKPIs(positions, totalValue, totalInvested, totalPL, totalReturn) {
  // Volatilité annualisée (252 jours)
  let vol = 0;
  const portfolioReturns = [];
  const maxDays = Math.max(...positions.map(p => p.hist.length), 0);
  for (let i = 1; i < maxDays; i++) {
    let dayValue = 0, prevValue = 0;
    positions.forEach(p => {
      if (p.hist.length > i) {
        dayValue += p.qty * p.hist[p.hist.length - 1 - i].price;
        prevValue += p.qty * p.hist[p.hist.length - i].price;
      }
    });
    if (prevValue > 0) portfolioReturns.push((dayValue - prevValue) / prevValue);
  }
  if (portfolioReturns.length > 1) {
    vol = stdDev(portfolioReturns) * Math.sqrt(252) * 100;
  }

  // Sharpe (taux sans risque approx = 5%)
  const riskFree = 5;
  const sharpe = vol > 0 ? ((totalReturn - riskFree) / vol) : 0;

  // Max Drawdown
  let maxDD = 0, peak = totalInvested;
  for (let i = 0; i < maxDays; i++) {
    let v = 0;
    positions.forEach(p => {
      if (p.hist.length > i) v += p.qty * p.hist[p.hist.length - 1 - i].price;
    });
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((v - peak) / peak) * 100 : 0;
    if (dd < maxDD) maxDD = dd;
  }

  // Beta vs BRVM
  let beta = 0;
  const brvmHist = getBRVMHistory(252);
  if (brvmHist.length > 20 && portfolioReturns.length > 20) {
    const brvmReturns = [];
    for (let i = 1; i < brvmHist.length; i++) {
      brvmReturns.push((brvmHist[i].price - brvmHist[i-1].price) / brvmHist[i-1].price);
    }
    const n = Math.min(portfolioReturns.length, brvmReturns.length);
    const pRet = portfolioReturns.slice(-n);
    const bRet = brvmReturns.slice(-n);
    const cov = correlation(pRet, bRet) * stdDev(pRet) * stdDev(bRet);
    const bVar = stdDev(bRet);
    beta = bVar > 0 ? (cov / (bVar * bVar)) : 0;
  }

  // Update DOM
  const pfTotal = document.getElementById('pfTotal');
  if (pfTotal) pfTotal.textContent = fmtM(totalValue) + ' FCFA';

  const pfTotalSub = document.getElementById('pfTotalSub');
  if (pfTotalSub) pfTotalSub.textContent = totalValue >= totalInvested ? '↑ vs investi' : '↓ vs investi';

  const pfInvested = document.getElementById('pfInvested');
  if (pfInvested) pfInvested.textContent = fmtM(totalInvested) + ' FCFA';

  const pfPL = document.getElementById('pfPL');
  if (pfPL) {
    pfPL.textContent = (totalPL >= 0 ? '+' : '') + fmtM(totalPL) + ' FCFA';
    pfPL.style.color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
  }

  const pfPLSub = document.getElementById('pfPLSub');
  if (pfPLSub) pfPLSub.textContent = totalPL >= 0 ? 'En gain' : 'En perte';

  const pfReturn = document.getElementById('pfReturn');
  if (pfReturn) {
    pfReturn.textContent = fmtPct(totalReturn);
    pfReturn.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
  }

  const pfVol = document.getElementById('pfVolatility');
  if (pfVol) pfVol.textContent = fmt(vol) + '%';

  const pfSharpe = document.getElementById('pfSharpe');
  if (pfSharpe) pfSharpe.textContent = fmt(sharpe);

  const pfDD = document.getElementById('pfDrawdown');
  if (pfDD) {
    pfDD.textContent = fmt(maxDD) + '%';
    pfDD.style.color = 'var(--red)';
  }

  const pfBeta = document.getElementById('pfBeta');
  if (pfBeta) pfBeta.textContent = fmt(beta);
}

// ═══════════════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════════════
function renderPortfolioCharts(positions, totalValue) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js non disponible');
    return;
  }

  // 1. Évolution de la valeur (line)
  const valueCanvas = document.getElementById('chartPortfolioValue');
  if (valueCanvas) {
    const maxDays = Math.max(...positions.map(p => p.hist.length), 0);
    const labels = [];
    const data = [];
    for (let i = maxDays - 1; i >= 0; i--) {
      let v = 0;
      let hasData = false;
      positions.forEach(p => {
        if (p.hist.length > i) {
          v += p.qty * p.hist[p.hist.length - 1 - i].price;
          hasData = true;
        }
      });
      if (hasData) {
        const d = positions[0].hist[maxDays - 1 - i]?.date || '';
        labels.push(d);
        data.push(v);
      }
    }
    if (window.pfValueChartInst) window.pfValueChartInst.destroy();
    window.pfValueChartInst = new Chart(valueCanvas, {
      type: 'line',
      data: {
        labels: labels.slice(-60),
        datasets: [{
          label: 'Valeur du portefeuille',
          data: data.slice(-60),
          borderColor: '#b8964e',
          backgroundColor: 'rgba(184,150,78,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            grid: { color: 'rgba(184,150,78,0.05)' },
            ticks: { color: '#888', font: { size: 10 }, callback: v => (v/1e6).toFixed(1)+'M' }
          }
        }
      }
    });
  }

  // 2. Allocation sectorielle (doughnut)
  const allocCanvas = document.getElementById('chartSectorAlloc');
  if (allocCanvas) {
    const sectors = {};
    positions.forEach(p => {
      sectors[p.sector] = (sectors[p.sector] || 0) + p.value;
    });
    const labels = Object.keys(sectors);
    const data = Object.values(sectors);
    const colors = ['#b8964e','#4a90d9','#4ade80','#f87171','#a78bfa','#fbbf24','#60a5fa','#34d399'];
    if (window.pfSectorChartInst) window.pfSectorChartInst.destroy();
    window.pfSectorChartInst = new Chart(allocCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#0f0e0b',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'right', labels: { color: '#aaa', font: { size: 11 }, boxWidth: 12 } }
        }
      }
    });
  }

  // 3. Répartition géographique (doughnut)
  const geoCanvas = document.getElementById('chartGeoAlloc');
  if (geoCanvas) {
    const countries = {};
    positions.forEach(p => {
      countries[p.country] = (countries[p.country] || 0) + p.value;
    });
    const labels = Object.keys(countries);
    const data = Object.values(countries);
    const colors = ['#b8964e','#4a90d9','#4ade80','#f87171','#a78bfa','#fbbf24'];
    if (window.pfGeoChartInst) window.pfGeoChartInst.destroy();
    window.pfGeoChartInst = new Chart(geoCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#0f0e0b',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'right', labels: { color: '#aaa', font: { size: 11 }, boxWidth: 12 } }
        }
      }
    });
  }

  // 4. P&L cumulé (bar)
  const plCanvas = document.getElementById('chartPortfolioPL');
  if (plCanvas) {
    const labels = positions.map(p => p.ticker);
    const data = positions.map(p => p.pl);
    const colors = data.map(v => v >= 0 ? '#4ade80' : '#f87171');
    if (window.pfPLChartInst) window.pfPLChartInst.destroy();
    window.pfPLChartInst = new Chart(plCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'P&L',
          data,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#888', font: { size: 10 } }, grid: { display: false } },
          y: {
            grid: { color: 'rgba(184,150,78,0.05)' },
            ticks: { color: '#888', font: { size: 10 }, callback: v => (v/1e6).toFixed(1)+'M' }
          }
        }
      }
    });
  }
}

function setPortfolioPeriod(days, btn) {
  document.querySelectorAll('#view-portefeuille .chart-tabs .year-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Re-render with selected period (simplified: just re-render all)
  renderPortfolio();
}

// ═══════════════════════════════════════════════════════
// CORRELATION MATRIX
// ═══════════════════════════════════════════════════════
function renderCorrelationMatrix(positions) {
  const container = document.getElementById('correlationMatrix');
  if (!container) return;
  if (positions.length < 2) {
    container.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Ajoutez au moins 2 positions pour voir la matrice de corrélation</div>';
    return;
  }

  const tickers = positions.map(p => p.ticker);
  const returns = positions.map(p => {
    const r = [];
    for (let i = 1; i < p.hist.length; i++) {
      r.push((p.hist[i].price - p.hist[i-1].price) / p.hist[i-1].price);
    }
    return r;
  });

  const n = tickers.length;
  let html = `<div class="corr-matrix" style="grid-template-columns: repeat(${n+1}, minmax(40px, 1fr)); gap: 2px; padding: 8px;">`;

  // Header row
  html += '<div class="corr-cell header" style="font-size:9px;color:var(--dim);background:none;cursor:default;"></div>';
  tickers.forEach(t => html += `<div class="corr-cell header" style="font-size:9px;color:var(--dim);background:none;cursor:default;">${t}</div>`);

  tickers.forEach((t1, i) => {
    html += `<div class="corr-cell header" style="font-size:9px;color:var(--dim);background:none;cursor:default;">${t1}</div>`;
    tickers.forEach((t2, j) => {
      if (i === j) {
        html += '<div class="corr-cell diag" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:10px;font-weight:500;border-radius:4px;background:var(--border2);color:var(--dim);">1.00</div>';
      } else {
        const corr = correlation(returns[i], returns[j]);
        const cls = corr >= 0 ? 'pos' : 'neg';
        const bg = corr > 0
          ? `rgba(74,222,128,${Math.min(Math.abs(corr)*0.3,0.3)})`
          : `rgba(248,113,113,${Math.min(Math.abs(corr)*0.3,0.3)})`;
        html += `<div class="corr-cell ${cls}" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:10px;font-weight:500;border-radius:4px;cursor:pointer;transition:transform 0.15s;background:${bg};color:${corr>=0?'var(--green)':'var(--red)'}" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">${corr.toFixed(2)}</div>`;
      }
    });
  });
  html += '</div>';
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// DETAILED TABLE
// ═══════════════════════════════════════════════════════
function renderPortfolioTable(positions, totalValue) {
  const tbody = document.getElementById('pfTable');
  if (!tbody) return;

  const countEl = document.getElementById('pfPositionCount');
  if (countEl) countEl.textContent = `${positions.length} position${positions.length > 1 ? 's' : ''}`;

  const rows = positions.map(p => {
    const alloc = totalValue > 0 ? (p.value / totalValue * 100) : 0;
    const plClass = p.pl >= 0 ? 'up' : 'down';
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(184,150,78,0.04);">
          <span style="font-family:var(--mono);font-size:12px;color:var(--gold);display:block;">${p.ticker}</span>
          <span style="font-size:11px;color:var(--dim);">${p.company}</span>
        </td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:var(--cream);">${fmt(p.qty)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:var(--cream);">${fmt(p.price)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:var(--cream);">${fmt(p.currentPrice)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:${p.plPct>=0?'var(--green)':'var(--red)'};">${fmtPct(p.plPct)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:var(--cream);">${fmtM(p.value)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:${p.pl>=0?'var(--green)':'var(--red)'};">${p.pl >= 0 ? '+' : ''}${fmtM(p.pl)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:${p.plPct>=0?'var(--green)':'var(--red)'};">${fmtPct(p.plPct)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:var(--cream);">${fmt(alloc)}%</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:var(--cream);">${fmt(p.high52)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid rgba(184,150,78,0.04);font-family:var(--mono);font-size:12px;color:var(--cream);">${fmt(p.low52)}</td>
        <td style="padding:10px 12px;text-align:center;border-bottom:1px solid rgba(184,150,78,0.04);">
          <button onclick="removePosition(${p.id})" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--dim);font-size:11px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'" onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--dim)'">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

// ═══════════════════════════════════════════════════════
// CONCENTRATION (HHI)
// ═══════════════════════════════════════════════════════
function renderConcentration(positions, totalValue) {
  const container = document.getElementById('concentrationStats');
  if (!container) return;
  if (!positions.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour analyser la concentration</div>';
    return;
  }

  const sorted = [...positions].sort((a, b) => b.value - a.value);
  const hhi = sorted.reduce((sum, p) => {
    const share = totalValue > 0 ? (p.value / totalValue) : 0;
    return sum + share * share * 10000;
  }, 0);

  let html = `
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:12px;color:var(--muted)">Indice HHI (concentration)</span>
        <span style="font-family:var(--mono);font-size:16px;color:var(--gold-light);font-weight:500;">${fmt(hhi)}</span>
      </div>
      <div style="height:4px;background:var(--border2);border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:${Math.min(hhi/10000*100,100)}%;background:var(--gold);border-radius:2px;transition:width 0.5s ease;"></div>
      </div>
      <div style="font-size:10px;color:var(--dim);margin-top:4px;">${hhi > 2500 ? '⚠️ Concentration élevée' : hhi > 1500 ? 'Concentration modérée' : '✅ Diversification satisfaisante'}</div>
    </div>
  `;

  sorted.slice(0, 3).forEach((p, i) => {
    const pct = totalValue > 0 ? (p.value / totalValue * 100) : 0;
    html += `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(184,150,78,0.04);">
        <div style="font-family:var(--mono);font-size:11px;color:var(--dim);width:24px;">#${i+1}</div>
        <div style="font-family:var(--mono);font-size:12px;color:var(--gold);width:60px;">${p.ticker}</div>
        <div style="flex:1;height:6px;background:var(--border2);border-radius:3px;overflow:hidden;">
          <div style="height:100%;border-radius:3px;background:var(--gold);transition:width 0.5s ease;width:${pct}%"></div>
        </div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--cream);width:50px;text-align:right;">${fmt(pct)}%</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// DIVIDENDS
// ═══════════════════════════════════════════════════════
function renderDividends(positions, totalValue) {
  const container = document.getElementById('dividendStats');
  if (!container) return;
  if (!positions.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour estimer les dividendes</div>';
    return;
  }

  const totalDiv = positions.reduce((s, p) => s + (p.value * p.divYield / 100), 0);
  const avgYield = totalValue > 0 ? (totalDiv / totalValue * 100) : 0;

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(184,150,78,0.04);">
      <div style="font-size:12px;color:var(--muted)">Rendement moyen estimé</div>
      <div style="font-family:var(--mono);font-size:14px;color:var(--gold-light);font-weight:500;">${fmt(avgYield)}%</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(184,150,78,0.04);">
      <div style="font-size:12px;color:var(--muted)">Dividendes annuels estimés</div>
      <div style="font-family:var(--mono);font-size:14px;color:var(--gold-light);font-weight:500;">${fmtM(totalDiv)} FCFA</div>
    </div>
    <div style="margin-top:12px;border-top:1px solid var(--border2);padding-top:12px;">
  `;

  positions.forEach(p => {
    const divAmt = p.value * p.divYield / 100;
    html += `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(184,150,78,0.04);">
        <div style="font-size:12px;color:var(--muted)">${p.ticker} <span style="color:var(--dim);font-size:11px;">(${fmt(p.divYield)}%)</span></div>
        <div style="font-family:var(--mono);font-size:13px;color:var(--cream);font-weight:500;">${fmtM(divAmt)}</div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// BENCHMARK (vs BRVM)
// ═══════════════════════════════════════════════════════
function renderBenchmark(positions, totalValue, totalInvested) {
  const container = document.getElementById('benchmarkStats');
  if (!container) return;
  if (!positions.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour comparer avec le benchmark</div>';
    return;
  }

  // BRVM return over same period
  const brvmHist = getBRVMHistory(252);
  let brvmReturn = 0;
  if (brvmHist.length >= 2) {
    const first = brvmHist[0].price;
    const last = brvmHist[brvmHist.length - 1].price;
    brvmReturn = first > 0 ? ((last - first) / first) * 100 : 0;
  }

  const pfReturn = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  const alpha = pfReturn - brvmReturn;
  const alphaClass = alpha >= 0 ? 'outperf' : 'underperf';
  const alphaColor = alpha >= 0 ? 'var(--green)' : 'var(--red)';

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(184,150,78,0.04);">
      <div style="font-size:12px;color:var(--muted)">Rendement Portefeuille</div>
      <div style="font-family:var(--mono);font-size:14px;color:var(--cream);font-weight:500;">${fmtPct(pfReturn)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(184,150,78,0.04);">
      <div style="font-size:12px;color:var(--muted)">Rendement BRVM Composite</div>
      <div style="font-family:var(--mono);font-size:14px;color:var(--cream);font-weight:500;">${fmtPct(brvmReturn)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--border2);margin-top:8px;">
      <div style="font-size:13px;color:var(--cream);font-weight:500;">Alpha (surperformance)</div>
      <div style="font-family:var(--mono);font-size:16px;color:${alphaColor};font-weight:500;">${alpha >= 0 ? '+' : ''}${fmt(alpha)}%</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(184,150,78,0.04);">
      <div style="font-size:12px;color:var(--muted)">Beta</div>
      <div style="font-family:var(--mono);font-size:14px;color:var(--cream);font-weight:500;" id="benchBeta">—</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// INIT — Populate ticker select
// ═══════════════════════════════════════════════════════
function initPortefeuille() {
  // Populate ticker select
  const select = document.getElementById('pfTicker');
  if (select && window.allCours) {
    select.innerHTML = '<option value="">Ticker...</option>' +
      window.allCours.map(c => `<option value="${c.ticker}">${c.ticker}</option>`).join('');
  }
  renderPortfolio();
}
