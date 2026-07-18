// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — GRAPHIQUES & ANALYSES (v2)
// ═══════════════════════════════════════════════════════

function _pfDrawPlaceholder(canvas, text) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '14px DM Sans';
  ctx.fillStyle = 'rgba(245,240,232,0.3)';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function renderPortfolioCharts(rows, totalValue, sectors, pays, hist) {
  if (typeof Chart === 'undefined') return;
  const safeTotal = totalValue > 0 ? totalValue : 1;

  const valueCanvas = document.getElementById('chartPortfolioValue');
  if (valueCanvas) {
    if (pfValueChartInst) { pfValueChartInst.destroy(); pfValueChartInst = null; }
    if (!hist.dates.length || !hist.values.length) {
      _pfDrawPlaceholder(valueCanvas, 'Données historiques insuffisantes');
    } else {
      const labels = hist.dates.map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
      pfValueChartInst = new Chart(valueCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Valeur du portefeuille',
            data: hist.values,
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
              callbacks: { label: ctx => ' ' + (typeof fmtM === 'function' ? fmtM(ctx.parsed.y) : ctx.parsed.y.toFixed(0)) + ' FCFA' }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, maxTicksLimit: 6 } },
            y: { position: 'right', grid: { color: 'rgba(184,150,78,0.06)' }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, callback: v => typeof fmtM === 'function' ? fmtM(v) : v.toFixed(0) } }
          }
        }
      });
    }
  }

  const sectorCanvas = document.getElementById('chartSectorAlloc');
  if (sectorCanvas) {
    if (pfSectorChartInst) { pfSectorChartInst.destroy(); pfSectorChartInst = null; }
    const sectorLabels = Object.keys(sectors);
    const sectorData = Object.values(sectors);
    const colors = ['#B8964E', '#4ADE80', '#F87171', '#60A5FA', '#A78BFA', '#FBBF24', '#34D399', '#F472B6', '#818CF8', '#FB923C'];

    if (!sectorLabels.length) {
      _pfDrawPlaceholder(sectorCanvas, 'Aucune donnée');
    } else {
      pfSectorChartInst = new Chart(sectorCanvas, {
        type: 'doughnut',
        data: { labels: sectorLabels, datasets: [{ data: sectorData, backgroundColor: colors, borderColor: '#1A1610', borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: 'rgba(245,240,232,0.6)', font: { size: 11 }, boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${typeof fmt === 'function' ? fmt(ctx.parsed / safeTotal * 100, 1) : (ctx.parsed / safeTotal * 100).toFixed(1)}%` } } }, cutout: '60%' }
      });
    }
  }

  const geoCanvas = document.getElementById('chartGeoAlloc');
  if (geoCanvas) {
    if (pfGeoChartInst) { pfGeoChartInst.destroy(); pfGeoChartInst = null; }
    const geoLabels = Object.keys(pays);
    const geoData = Object.values(pays);
    const geoColors = ['#B8964E', '#4ADE80', '#60A5FA', '#F87171', '#A78BFA', '#FBBF24'];

    if (!geoLabels.length) {
      _pfDrawPlaceholder(geoCanvas, 'Aucune donnée');
    } else {
      pfGeoChartInst = new Chart(geoCanvas, {
        type: 'doughnut',
        data: { labels: geoLabels, datasets: [{ data: geoData, backgroundColor: geoColors, borderColor: '#1A1610', borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: 'rgba(245,240,232,0.6)', font: { size: 11 }, boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${typeof fmt === 'function' ? fmt(ctx.parsed / safeTotal * 100, 1) : (ctx.parsed / safeTotal * 100).toFixed(1)}%` } } }, cutout: '60%' }
      });
    }
  }

  const plCanvas = document.getElementById('chartPortfolioPL');
  if (plCanvas) {
    if (pfPLChartInst) { pfPLChartInst.destroy(); pfPLChartInst = null; }
    if (!hist.dates.length || !hist.pls.length) {
      _pfDrawPlaceholder(plCanvas, 'Données insuffisantes');
    } else {
      const plLabels = hist.dates.map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
      const plColors = hist.pls.map(v => v >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)');

      pfPLChartInst = new Chart(plCanvas, {
        type: 'bar',
        data: { labels: plLabels, datasets: [{ data: hist.pls, backgroundColor: plColors, borderRadius: 2 }] },
        options: { ...chartOpts, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + (ctx.parsed.y >= 0 ? '+' : '') + (typeof fmtM === 'function' ? fmtM(ctx.parsed.y) : ctx.parsed.y.toFixed(0)) + ' FCFA' } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } }, y: { position: 'right', grid: { color: 'rgba(184,150,78,0.06)' }, ticks: { callback: v => typeof fmtM === 'function' ? fmtM(v) : v.toFixed(0) } } } }
      });
    }
  }
}

function renderConcentration(rows, totalValue) {
  const el = document.getElementById('concentrationStats');
  if (!el) return;
  if (!rows.length || totalValue <= 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions</div>';
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
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Top 3 positions</span>
        <span style="font-size:14px;font-weight:600;color:var(--gold)">${typeof fmt === 'function' ? fmt(top3Pct, 1) : top3Pct.toFixed(1)}%</span>
      </div>
      <div style="width:100%;height:6px;background:var(--border2);border-radius:3px;margin-bottom:16px;overflow:hidden">
        <div style="width:${Math.min(top3Pct, 100)}%;height:100%;background:var(--gold);border-radius:3px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Indice HHI</span>
        <span style="font-size:14px;font-weight:600;color:${hhiLabel === 'Élevée' ? 'var(--red)' : hhiLabel === 'Modérée' ? 'var(--gold)' : 'var(--green)'}">${typeof fmt === 'function' ? fmt(hhi, 0) : hhi.toFixed(0)} — ${hhiLabel}</span>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-top:8px">
        ${top3.map((r, i) => `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>${i+1}. ${r.ticker} (${r.pays})</span><span style="color:var(--cream)">${typeof fmt === 'function' ? fmt(r.value/totalValue*100, 1) : (r.value/totalValue*100).toFixed(1)}%</span></div>`).join('')}
      </div>
    </div>
  `;
}

function renderDividends(rows) {
  const el = document.getElementById('dividendStats');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions</div>';
    return;
  }
  let totalDividend = 0;
  const divDetails = [];
  rows.forEach(r => {
    const yield_ = getDividendYield(r.ticker);
    const divEstime = r.value * (yield_ / 100);
    totalDividend += divEstime;
    if (yield_ > 0) divDetails.push({ ticker: r.ticker, yield: yield_, value: r.value, div: divEstime });
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const portfolioYield = totalValue > 0 ? (totalDividend / totalValue * 100) : 0;

  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Rendement estimé (dividende)</span>
        <span style="font-size:18px;font-weight:600;color:var(--gold)">${typeof fmt === 'function' ? fmt(portfolioYield, 2) : portfolioYield.toFixed(2)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <span style="font-size:12px;color:var(--dim)">Dividendes annuels estimés</span>
        <span style="font-size:14px;font-weight:600;color:var(--green)">+${typeof fmtM === 'function' ? fmtM(totalDividend) : totalDividend.toFixed(0)} FCFA</span>
      </div>
      <div style="font-size:11px;color:var(--dim)">
        ${divDetails.length ? divDetails.map(d => `<div style="display:flex;justify-content:space-between;margin-bottom:4px;padding:4px 0;border-bottom:1px solid var(--border2)"><span>${d.ticker} <small style="color:var(--gold)">(${typeof fmt === 'function' ? fmt(d.yield, 2) : d.yield.toFixed(2)}%)</small></span><span style="color:var(--cream)">${typeof fmtM === 'function' ? fmtM(d.div) : d.div.toFixed(0)}</span></div>`).join('') : '<div style="text-align:center;padding:8px">Aucune donnée de dividende disponible</div>'}
      </div>
    </div>
  `;
}

function renderBenchmark(rows, hist) {
  const el = document.getElementById('benchmarkStats');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions pour comparer avec le benchmark</div>';
    return;
  }
  let brvmReturn = 0, brvmDataFound = false;
  if (Array.isArray(window.allIndices) && window.allIndices.length > 0) {
    const composite = window.allIndices.filter(i => (i.nom || i.ticker || '').toUpperCase().includes('COMPOSITE'));
    if (composite.length >= 2) {
      const sorted = composite.sort((a, b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0));
      const first = sorted[0], last = sorted[sorted.length - 1];
      const firstVal = +(first.valeur || first.cours || first.dernier || 0);
      const lastVal = +(last.valeur || last.cours || last.dernier || 0);
      if (firstVal > 0) { brvmReturn = (lastVal - firstVal) / firstVal * 100; brvmDataFound = true; }
    }
  }
  const pfReturn = hist.values.length >= 2 && hist.values[0] > 0 ? (hist.values[hist.values.length - 1] - hist.values[0]) / hist.values[0] * 100 : 0;
  const outperformance = pfReturn - brvmReturn;

  if (!brvmDataFound) {
    el.innerHTML = `<div style="padding:16px;text-align:center"><p style="color:var(--dim);font-size:13px">Données BRVM Composite non disponibles</p></div>`;
    return;
  }
  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px"><span style="font-size:12px;color:var(--dim)">Votre portefeuille</span><span style="font-size:14px;font-weight:600;color:${pfReturn >= 0 ? 'var(--green)' : 'var(--red)'}">${pfReturn >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(pfReturn, 2) : pfReturn.toFixed(2)}%</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px"><span style="font-size:12px;color:var(--dim)">BRVM Composite</span><span style="font-size:14px;font-weight:600;color:${brvmReturn >= 0 ? 'var(--green)' : 'var(--red)'}">${brvmReturn >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(brvmReturn, 2) : brvmReturn.toFixed(2)}%</span></div>
      <div style="width:100%;height:1px;background:var(--border2);margin:12px 0"></div>
      <div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--dim)">Surperformance</span><span style="font-size:16px;font-weight:600;color:${outperformance >= 0 ? 'var(--green)' : 'var(--red)'}">${outperformance >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(outperformance, 2) : outperformance.toFixed(2)}%</span></div>
    </div>
  `;
}

function renderCorrelationMatrix(pf) {
  const el = document.getElementById('correlationMatrix');
  if (!el) return;
  if (pf.length < 2) { el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Ajoutez au moins 2 positions</div>'; return; }

  const tickers = pf.map(p => (p.ticker || '').toUpperCase().trim());
  const returns = {};
  tickers.forEach(t => {
    const prices = getTickerHistory(t).map(c => +(c.cours_cloture || c.cours_normal || c.cours || 0)).filter(v => v > 0);
    returns[t] = [];
    for (let i = 1; i < prices.length; i++) returns[t].push((prices[i] - prices[i - 1]) / prices[i - 1]);
  });

  const minLen = Math.min(...Object.values(returns).map(r => r.length));
  if (!isFinite(minLen) || minLen < 5) { el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px">Données insuffisantes</div>'; return; }
  tickers.forEach(t => { returns[t] = returns[t].slice(-minLen); });

  let html = '<div style="display:grid;gap:2px;padding:8px;overflow:auto">';
  html += '<div style="display:contents"><div style="width:50px"></div>';
  tickers.forEach(t => { html += `<div style="width:50px;text-align:center;font-size:10px;color:var(--gold);font-family:var(--mono);padding:4px 2px">${t}</div>`; });
  html += '</div>';

  tickers.forEach(t1 => {
    html += '<div style="display:contents">';
    html += `<div style="width:50px;text-align:right;font-size:10px;color:var(--gold);font-family:var(--mono);padding:4px 2px">${t1}</div>`;
    tickers.forEach(t2 => {
      const corr = t1 === t2 ? 1 : calcCorrelation(returns[t1], returns[t2]);
      const color = corr > 0.7 ? 'rgba(248,113,113,0.7)' : corr > 0.3 ? 'rgba(251,191,36,0.5)' : corr > -0.3 ? 'rgba(245,240,232,0.1)' : corr > -0.7 ? 'rgba(74,222,128,0.3)' : 'rgba(74,222,128,0.6)';
      html += `<div style="width:50px;height:32px;display:flex;align-items:center;justify-content:center;background:${color};border-radius:3px;font-size:10px;color:var(--cream);font-family:var(--mono)">${typeof fmt === 'function' ? fmt(corr, 2) : corr.toFixed(2)}</div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="display:flex;gap:12px;justify-content:center;margin-top:8px;font-size:10px;color:var(--dim)"><span>🔴 Élevée</span><span>🟡 Modérée</span><span>⚪ Faible</span><span>🟢 Négative</span></div>';
  el.innerHTML = html;
}
