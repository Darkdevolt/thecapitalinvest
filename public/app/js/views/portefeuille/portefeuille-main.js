// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — POINT D'ENTRÉE (renderPortfolio, init)
// CORRECTIONS : initPortefeuille, checkboxes, chartOpts
// ═══════════════════════════════════════════════════════

let _pfRenderPending = false;
let _pfPeriodTimeout = null;

function populateTickerSelect() {
  const select = document.getElementById('pfTicker');
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  if (!Array.isArray(window.allCours) || window.allCours.length === 0) return;
  const tickers = [...new Set(window.allCours.map(c => c.ticker).filter(Boolean))].sort();
  tickers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = `${t} — ${getPays(t)}`;
    select.appendChild(opt);
  });
}

window.renderPortfolio = function() {
  if (_pfRenderPending) return;
  _pfRenderPending = true;

  try {
    const pf = getPortfolio();
    const cash = getCash();
    const dividends = getDividends();

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
    const pfCash = document.getElementById('pfCash');

    if (!pf.length) {
      resetEmptyState();
      return;
    }

    const cmpMap = calculateCMP(pf);

    let totalValue = 0, totalInvested = 0;
    const rows = [];
    const sectors = {};
    const pays = {};
    const dailyReturns = [];

    pf.forEach(p => {
      const currentPrice = getLatestPrice(p.ticker) || p.price;
      const cmpData = cmpMap[p.ticker.toUpperCase().trim()] || { value: p.price, positions: [p] };
      const cmp = cmpData.value;

      const value = (+p.qty || 0) * currentPrice;
      const invested = (+p.qty || 0) * cmp;
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
        cmp,
        cmpPositions: cmpData.positions,
        value,
        invested,
        pl,
        plPct,
        sector: s,
        pays: py
      });
    });

    const totalPL = totalValue - totalInvested;
    const totalReturn = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    const hist = getPortfolioHistory(window._pfPeriod || 99999);

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

    const totalWithCash = totalValue + cash;

    if (pfTotal) pfTotal.textContent = (typeof fmtM === 'function' ? fmtM(totalWithCash) : totalWithCash.toFixed(0)) + ' FCFA';
    if (pfTotalSub) {
      pfTotalSub.textContent = totalValue >= totalInvested ? '↑ Portefeuille en hausse' : '↓ Portefeuille en baisse';
      pfTotalSub.style.color = totalValue >= totalInvested ? 'var(--green)' : 'var(--red)';
    }
    if (pfInvested) pfInvested.textContent = (typeof fmtM === 'function' ? fmtM(totalInvested) : totalInvested.toFixed(0)) + ' FCFA';
    if (pfCash) pfCash.textContent = (typeof fmtM === 'function' ? fmtM(cash) : cash.toFixed(0)) + ' FCFA (liquide)';
    if (pfPL) {
      pfPL.textContent = (totalPL >= 0 ? '+' : '') + (typeof fmtM === 'function' ? fmtM(totalPL) : totalPL.toFixed(0)) + ' FCFA';
      pfPL.style.color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (pfPLSub) {
      pfPLSub.textContent = totalReturn >= 0 ? `+${typeof fmt === 'function' ? fmt(totalReturn, 2) : totalReturn.toFixed(2)}% de rentabilité` : `${typeof fmt === 'function' ? fmt(totalReturn, 2) : totalReturn.toFixed(2)}% de rentabilité`;
      pfPLSub.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (pfReturn) {
      pfReturn.textContent = (typeof fmt === 'function' ? fmt(totalReturn, 2) : totalReturn.toFixed(2)) + '%';
      pfReturn.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
    }

    if (pfVol) pfVol.textContent = (vol > 0 && hist.values.length >= 2) ? (typeof fmt === 'function' ? fmt(vol * 100, 2) : (vol * 100).toFixed(2)) + '%' : '—';
    if (pfSharpe) pfSharpe.textContent = (sharpe !== 0 && hist.values.length >= 2) ? (typeof fmt === 'function' ? fmt(sharpe, 2) : sharpe.toFixed(2)) : '—';
    if (pfDD) pfDD.textContent = (maxDD > 0 && hist.values.length >= 2) ? '-' + (typeof fmt === 'function' ? fmt(maxDD, 2) : maxDD.toFixed(2)) + '%' : '—';
    if (pfBeta) pfBeta.textContent = '—';

    const tbody = document.getElementById('pfTable');
    if (tbody) {
      tbody.innerHTML = rows.map(p => {
        const priceFound = getLatestPrice(p.ticker) !== null;
        const high52 = get52WeekHigh(p.ticker);
        const low52 = get52WeekLow(p.ticker);

        const purchaseHistory = p.cmpPositions.map(pos =>
          `<div style="font-size:10px;color:var(--dim);padding:2px 0">
            📅 ${typeof fmtDate === 'function' ? fmtDate(pos.date) : pos.date} — ${typeof fmt === 'function' ? fmt(pos.qty) : pos.qty} actions à ${typeof fmt === 'function' ? fmt(pos.price, 2) : pos.price} FCFA
          </div>`
        ).join('');

        return `
          <tr>
            <td style="padding:10px 12px;text-align:center;width:40px">
              <input type="checkbox" class="position-checkbox" data-id="${p.id}" onchange="updateDeleteButton()" style="cursor:pointer">
            </td>
            <td style="padding:10px 12px;">
              <div style="font-family:var(--mono);color:var(--gold);font-weight:600">${p.ticker}</div>
              <div style="font-size:10px;color:var(--dim)">${p.pays}</div>
              <details style="margin-top:4px">
                <summary style="font-size:10px;color:var(--gold);cursor:pointer">📋 ${p.cmpPositions.length} achat(s)</summary>
                <div style="padding:4px 0">${purchaseHistory}</div>
              </details>
            </td>
            <td style="padding:10px 12px;text-align:right">${typeof fmt === 'function' ? fmt(p.qty) : p.qty}</td>
            <td style="padding:10px 12px;text-align:right;font-family:var(--mono);color:var(--gold)">${typeof fmt === 'function' ? fmt(p.cmp, 2) : p.cmp.toFixed(2)}</td>
            <td style="padding:10px 12px;text-align:right;color:${priceFound ? 'inherit' : 'var(--dim)'}">${typeof fmt === 'function' ? fmt(p.currentPrice, 2) : p.currentPrice.toFixed(2)}${!priceFound ? ' <small>(est.)</small>' : ''}</td>
            <td style="padding:10px 12px;text-align:right;color:${p.pl>=0?'var(--green)':'var(--red)'};font-weight:600">${p.pl >= 0 ? '+' : ''}${typeof fmtM === 'function' ? fmtM(p.pl) : p.pl.toFixed(0)}</td>
            <td style="padding:10px 12px;text-align:right;color:${p.plPct>=0?'var(--green)':'var(--red)'}">${typeof fmt === 'function' ? fmt(p.plPct, 2) : p.plPct.toFixed(2)}%</td>
            <td style="padding:10px 12px;text-align:right">${typeof fmtM === 'function' ? fmtM(p.value) : p.value.toFixed(0)}</td>
            <td style="padding:10px 12px;text-align:right">${typeof fmt === 'function' ? fmt(totalValue > 0 ? (p.value/totalValue*100) : 0, 2) : (totalValue > 0 ? (p.value/totalValue*100) : 0).toFixed(2)}%</td>
            <td style="padding:10px 12px;text-align:right">${high52 ? (typeof fmt === 'function' ? fmt(high52, 2) : high52.toFixed(2)) : '—'}</td>
            <td style="padding:10px 12px;text-align:right">${low52 ? (typeof fmt === 'function' ? fmt(low52, 2) : low52.toFixed(2)) : '—'}</td>
            <td style="padding:10px 12px;text-align:center">
              <button onclick="removePosition(${p.id})" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--dim);font-size:11px;cursor:pointer">🗑</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    const countEl = document.getElementById('pfPositionCount');
    if (countEl) countEl.textContent = `${pf.length} position${pf.length > 1 ? 's' : ''} | ${typeof fmtM === 'function' ? fmtM(cash) : cash.toFixed(0)} FCFA liquide`;

    const divEl = document.getElementById('dividendList');
    if (divEl) {
      const totalDividends = dividends.reduce((s, d) => s + (+d.amount || 0), 0);
      divEl.innerHTML = `
        <div style="padding:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <span style="color:var(--dim)">Total dividendes perçus</span>
            <span style="color:var(--gold);font-weight:600">${typeof fmtM === 'function' ? fmtM(totalDividends) : totalDividends.toFixed(0)} FCFA</span>
          </div>
          ${dividends.length ? dividends.slice(-5).map(d => `
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border2)">
              <span>${d.ticker} — ${typeof fmtDate === 'function' ? fmtDate(d.date) : d.date}</span>
              <span style="color:var(--green)">+${typeof fmtM === 'function' ? fmtM(d.amount) : d.amount}</span>
            </div>
          `).join('') : '<div style="font-size:12px;color:var(--dim)">Aucun dividende enregistré</div>'}
        </div>
      `;
    }

    renderPortfolioCharts(rows, totalValue, sectors, pays, hist);
    renderConcentration(rows, totalValue);
    renderDividends(rows);
    renderBenchmark(rows, hist);
    renderCorrelationMatrix(pf);

  } finally {
    _pfRenderPending = false;
  }
}

function resetEmptyState() {
  ['pfTotal','pfInvested','pfPL','pfReturn','pfVolatility','pfSharpe','pfDrawdown','pfBeta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  const tbody = document.getElementById('pfTable');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align:center;padding:32px;color:var(--dim)">
          <div style="font-size:16px;margin-bottom:12px">📋 Votre portefeuille est vide</div>
          <div style="font-size:13px;margin-bottom:20px">Ajoutez une position ci-dessus pour suivre vos investissements BRVM</div>
          <button onclick="document.getElementById('pfTicker').focus()" style="padding:10px 24px;background:var(--gold);border:none;border-radius:8px;color:var(--bg);font-weight:600;cursor:pointer">+ Ajouter une position</button>
        </td>
      </tr>
    `;
  }

  const countEl = document.getElementById('pfPositionCount');
  if (countEl) countEl.textContent = '0 position | Ajoutez des titres BRVM';

  [pfValueChartInst, pfSectorChartInst, pfGeoChartInst, pfPLChartInst].forEach(chart => {
    if (chart) { chart.destroy(); }
  });
  pfValueChartInst = pfSectorChartInst = pfGeoChartInst = pfPLChartInst = null;

  renderMarketOverview();
}

window.setPortfolioPeriod = function(days, btn) {
  document.querySelectorAll('.year-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window._pfPeriod = days;
  if (_pfPeriodTimeout) clearTimeout(_pfPeriodTimeout);
  _pfPeriodTimeout = setTimeout(() => renderPortfolio(), 150);
}

function renderMarketOverview() {
  if (Array.isArray(window.allIndices) && window.allIndices.length > 0) {
    const composite = window.allIndices.find(i => (i.nom || i.ticker || '').toUpperCase().includes('COMPOSITE'));
    const brvm30 = window.allIndices.find(i => (i.nom || i.ticker || '').toUpperCase().includes('30'));

    const pfTotal = document.getElementById('pfTotal');
    if (pfTotal && composite) {
      const val = composite.valeur || composite.cours || composite.dernier || 0;
      pfTotal.innerHTML = `<span style="font-size:14px">BRVM Composite</span><br><span style="font-size:20px;color:var(--gold)">${typeof fmt === 'function' ? fmt(val, 2) : val.toFixed(2)}</span>`;
    }

    const pfInvested = document.getElementById('pfInvested');
    if (pfInvested && brvm30) {
      const val = brvm30.valeur || brvm30.cours || brvm30.dernier || 0;
      pfInvested.innerHTML = `<span style="font-size:14px">BRVM 30</span><br><span style="font-size:20px;color:var(--gold)">${typeof fmt === 'function' ? fmt(val, 2) : val.toFixed(2)}</span>`;
    }
  }

  const divEl = document.getElementById('dividendList');
  if (divEl && Array.isArray(window.allCours) && window.allCours.length > 0) {
    const topGainers = [...window.allCours]
      .filter(c => c.variation !== null && c.variation !== undefined)
      .sort((a, b) => (b.variation || 0) - (a.variation || 0))
      .slice(0, 5);

    divEl.innerHTML = `
      <div style="padding:16px">
        <div style="font-size:14px;font-weight:600;color:var(--gold);margin-bottom:12px">🔥 TOP 5 HAUSSES DU JOUR</div>
        ${topGainers.length ? topGainers.map(c => {
          const v = c.variation || 0;
          return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border2)">
            <span style="color:var(--cream)">${c.ticker}</span>
            <span style="color:var(--green)">+${typeof fmt === 'function' ? fmt(v, 2) : v.toFixed(2)}%</span>
          </div>`;
        }).join('') : '<div style="font-size:12px;color:var(--dim)">Données du jour non disponibles</div>'}
      </div>
    `;
  }

  const valueCanvas = document.getElementById('chartPortfolioValue');
  if (valueCanvas && Array.isArray(window.allIndices) && window.allIndices.length > 0) {
    const compositeHist = window.allIndices
      .filter(i => (i.nom || i.ticker || '').toUpperCase().includes('COMPOSITE'))
      .sort((a, b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0));

    if (compositeHist.length >= 2) {
      const labels = compositeHist.map(d => new Date(d.date_seance || 0).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
      const data = compositeHist.map(d => d.valeur || d.cours || d.dernier || 0);

      if (pfValueChartInst) pfValueChartInst.destroy();
      pfValueChartInst = new Chart(valueCanvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'BRVM Composite',
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
              callbacks: { label: ctx => ' ' + (typeof fmt === 'function' ? fmt(ctx.parsed.y, 2) : ctx.parsed.y.toFixed(2)) + ' pts' }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, maxTicksLimit: 6 } },
            y: { position: 'right', grid: { color: 'rgba(184,150,78,0.06)' }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 } } }
          }
        }
      });
    }
  }

  const sectorCanvas = document.getElementById('chartSectorAlloc');
  if (sectorCanvas && Array.isArray(window.allCours) && window.allCours.length > 0) {
    const sectors = {};
    window.allCours.forEach(c => {
      const s = getSector(c.ticker);
      const cap = (c.cours_cloture || c.cours || 0) * (c.volume || 0);
      sectors[s] = (sectors[s] || 0) + cap;
    });

    const sectorLabels = Object.keys(sectors);
    const sectorData = Object.values(sectors);
    const colors = ['#B8964E', '#4ADE80', '#F87171', '#60A5FA', '#A78BFA', '#FBBF24', '#34D399', '#F472B6', '#818CF8', '#FB923C'];

    if (sectorLabels.length && pfSectorChartInst) pfSectorChartInst.destroy();
    if (sectorLabels.length) {
      pfSectorChartInst = new Chart(sectorCanvas, {
        type: 'doughnut',
        data: { labels: sectorLabels, datasets: [{ data: sectorData, backgroundColor: colors, borderColor: '#1A1610', borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: 'rgba(245,240,232,0.6)', font: { size: 11 }, boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${typeof fmt === 'function' ? fmt(ctx.parsed / sectorData.reduce((a,b)=>a+b,0) * 100, 1) : (ctx.parsed / sectorData.reduce((a,b)=>a+b,0) * 100).toFixed(1)}%` } } }, cutout: '60%' }
      });
    }
  }

  const geoCanvas = document.getElementById('chartGeoAlloc');
  if (geoCanvas && Array.isArray(window.allCours) && window.allCours.length > 0) {
    const pays = {};
    window.allCours.forEach(c => {
      const p = getPays(c.ticker);
      const cap = (c.cours_cloture || c.cours || 0) * (c.volume || 0);
      pays[p] = (pays[p] || 0) + cap;
    });

    const geoLabels = Object.keys(pays);
    const geoData = Object.values(pays);
    const geoColors = ['#B8964E', '#4ADE80', '#60A5FA', '#F87171', '#A78BFA', '#FBBF24'];

    if (geoLabels.length && pfGeoChartInst) pfGeoChartInst.destroy();
    if (geoLabels.length) {
      pfGeoChartInst = new Chart(geoCanvas, {
        type: 'doughnut',
        data: { labels: geoLabels, datasets: [{ data: geoData, backgroundColor: geoColors, borderColor: '#1A1610', borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: 'rgba(245,240,232,0.6)', font: { size: 11 }, boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${typeof fmt === 'function' ? fmt(ctx.parsed / geoData.reduce((a,b)=>a+b,0) * 100, 1) : (ctx.parsed / geoData.reduce((a,b)=>a+b,0) * 100).toFixed(1)}%` } } }, cutout: '60%' }
      });
    }
  }

  const plCanvas = document.getElementById('chartPortfolioPL');
  if (plCanvas) {
    const ctx = plCanvas.getContext('2d');
    ctx.clearRect(0, 0, plCanvas.width, plCanvas.height);
    ctx.font = '14px DM Sans';
    ctx.fillStyle = 'rgba(245,240,232,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('Ajoutez des positions pour voir votre P&L', plCanvas.width / 2, plCanvas.height / 2);
  }

  const concEl = document.getElementById('concentrationStats');
  if (concEl) {
    concEl.innerHTML = `
      <div style="padding:16px;text-align:center">
        <div style="font-size:14px;color:var(--dim);margin-bottom:8px">⚖️ Concentration</div>
        <div style="font-size:12px;color:var(--dim)">Ajoutez des positions pour analyser la concentration de votre portefeuille</div>
      </div>
    `;
  }

  const divEstEl = document.getElementById('dividendStats');
  if (divEstEl) {
    divEstEl.innerHTML = `
      <div style="padding:16px;text-align:center">
        <div style="font-size:14px;color:var(--dim);margin-bottom:8px">💰 Dividendes</div>
        <div style="font-size:12px;color:var(--dim)">Ajoutez des positions pour estimer vos dividendes annuels</div>
      </div>
    `;
  }

  const benchEl = document.getElementById('benchmarkStats');
  if (benchEl && Array.isArray(window.allIndices) && window.allIndices.length > 0) {
    const composite = window.allIndices.filter(i => (i.nom || i.ticker || '').toUpperCase().includes('COMPOSITE'));
    if (composite.length >= 2) {
      const sorted = composite.sort((a, b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0));
      const first = sorted[0], last = sorted[sorted.length - 1];
      const firstVal = +(first.valeur || first.cours || first.dernier || 0);
      const lastVal = +(last.valeur || last.cours || last.dernier || 0);
      const brvmReturn = firstVal > 0 ? (lastVal - firstVal) / firstVal * 100 : 0;

      benchEl.innerHTML = `
        <div style="padding:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <span style="font-size:12px;color:var(--dim)">BRVM Composite (période)</span>
            <span style="font-size:14px;font-weight:600;color:${brvmReturn >= 0 ? 'var(--green)' : 'var(--red)'}">${brvmReturn >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(brvmReturn, 2) : brvmReturn.toFixed(2)}%</span>
          </div>
          <div style="font-size:11px;color:var(--dim)">Ajoutez des positions pour comparer votre performance</div>
        </div>
      `;
    }
  }

  const corrEl = document.getElementById('correlationMatrix');
  if (corrEl) {
    corrEl.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Ajoutez au moins 2 positions pour voir la matrice de corrélation</div>';
  }
}

window.initPortefeuille = function() {
  console.log('initPortefeuille appelé');
  window._pfPeriod = window._pfPeriod || 99999;

  // CORRECTION : toujours appeler populate et render, même si données vides
  populateTickerSelect();
  renderPortfolio();

  // Si les données arrivent plus tard (ex: chargement asynchrone), re-rendre
  window.addEventListener('dataLoaded', () => {
    populateTickerSelect();
    renderPortfolio();
  }, { once: true });
}
