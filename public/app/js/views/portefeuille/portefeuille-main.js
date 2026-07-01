// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — POINT D'ENTRÉE (renderPortfolio, init)
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

      const value = p.qty * currentPrice;
      const invested = p.qty * cmp;
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

    if (pfTotal) pfTotal.textContent = fmtM(totalWithCash) + ' FCFA';
    if (pfTotalSub) {
      pfTotalSub.textContent = totalValue >= totalInvested ? '↑ Portefeuille en hausse' : '↓ Portefeuille en baisse';
      pfTotalSub.style.color = totalValue >= totalInvested ? 'var(--green)' : 'var(--red)';
    }
    if (pfInvested) pfInvested.textContent = fmtM(totalInvested) + ' FCFA';
    if (pfCash) pfCash.textContent = fmtM(cash) + ' FCFA (liquide)';
    if (pfPL) {
      pfPL.textContent = (totalPL >= 0 ? '+' : '') + fmtM(totalPL) + ' FCFA';
      pfPL.style.color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (pfPLSub) {
      pfPLSub.textContent = totalReturn >= 0 ? `+${fmt(totalReturn, 2)}% de rentabilité` : `${fmt(totalReturn, 2)}% de rentabilité`;
      pfPLSub.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (pfReturn) {
      pfReturn.textContent = fmt(totalReturn, 2) + '%';
      pfReturn.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
    }

    if (pfVol) pfVol.textContent = (vol > 0 && hist.values.length >= 2) ? fmt(vol * 100, 2) + '%' : '—';
    if (pfSharpe) pfSharpe.textContent = (sharpe !== 0 && hist.values.length >= 2) ? fmt(sharpe, 2) : '—';
    if (pfDD) pfDD.textContent = (maxDD > 0 && hist.values.length >= 2) ? '-' + fmt(maxDD, 2) + '%' : '—';
    if (pfBeta) pfBeta.textContent = '—';

    const tbody = document.getElementById('pfTable');
    if (tbody) {
      tbody.innerHTML = rows.map(p => {
        const priceFound = getLatestPrice(p.ticker) !== null;
        const high52 = get52WeekHigh(p.ticker);
        const low52 = get52WeekLow(p.ticker);

        const purchaseHistory = p.cmpPositions.map(pos => 
          `<div style="font-size:10px;color:var(--dim);padding:2px 0">
            📅 ${fmtDate(pos.date)} — ${fmt(pos.qty)} actions à ${fmt(pos.price, 2)} FCFA
          </div>`
        ).join('');

        return `
          <tr>
            <td style="padding:10px 12px;">
              <div style="font-family:var(--mono);color:var(--gold);font-weight:600">${p.ticker}</div>
              <div style="font-size:10px;color:var(--dim)">${p.pays}</div>
              <details style="margin-top:4px">
                <summary style="font-size:10px;color:var(--gold);cursor:pointer">📋 ${p.cmpPositions.length} achat(s)</summary>
                <div style="padding:4px 0">${purchaseHistory}</div>
              </details>
            </td>
            <td style="padding:10px 12px;text-align:right">${fmt(p.qty)}</td>
            <td style="padding:10px 12px;text-align:right;font-family:var(--mono);color:var(--gold)">${fmt(p.cmp, 2)}</td>
            <td style="padding:10px 12px;text-align:right;color:${priceFound ? 'inherit' : 'var(--dim)'}">${fmt(p.currentPrice, 2)}${!priceFound ? ' <small>(est.)</small>' : ''}</td>
            <td style="padding:10px 12px;text-align:right;color:${p.pl>=0?'var(--green)':'var(--red)'};font-weight:600">${p.pl >= 0 ? '+' : ''}${fmtM(p.pl)}</td>
            <td style="padding:10px 12px;text-align:right;color:${p.plPct>=0?'var(--green)':'var(--red)'}">${fmt(p.plPct, 2)}%</td>
            <td style="padding:10px 12px;text-align:right">${fmtM(p.value)}</td>
            <td style="padding:10px 12px;text-align:right">${fmt(totalValue > 0 ? (p.value/totalValue*100) : 0, 2)}%</td>
            <td style="padding:10px 12px;text-align:right">${high52 ? fmt(high52, 2) : '—'}</td>
            <td style="padding:10px 12px;text-align:right">${low52 ? fmt(low52, 2) : '—'}</td>
            <td style="padding:10px 12px;text-align:center">
              <button onclick="removePosition(${p.id})" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--dim);font-size:11px;cursor:pointer">🗑</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    const countEl = document.getElementById('pfPositionCount');
    if (countEl) countEl.textContent = `${pf.length} position${pf.length > 1 ? 's' : ''} | ${fmtM(cash)} FCFA liquide`;

    const divEl = document.getElementById('dividendList');
    if (divEl) {
      const totalDividends = dividends.reduce((s, d) => s + d.amount, 0);
      divEl.innerHTML = `
        <div style="padding:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <span style="color:var(--dim)">Total dividendes perçus</span>
            <span style="color:var(--gold);font-weight:600">${fmtM(totalDividends)} FCFA</span>
          </div>
          ${dividends.length ? dividends.slice(-5).map(d => `
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border2)">
              <span>${d.ticker} — ${fmtDate(d.date)}</span>
              <span style="color:var(--green)">+${fmtM(d.amount)}</span>
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
  if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--dim)">Aucune position. Ajoutez-en une ci-dessus.</td></tr>';
  const countEl = document.getElementById('pfPositionCount');
  if (countEl) countEl.textContent = '0 position';

  [pfValueChartInst, pfSectorChartInst, pfGeoChartInst, pfPLChartInst].forEach(chart => {
    if (chart) { chart.destroy(); }
  });
  pfValueChartInst = pfSectorChartInst = pfGeoChartInst = pfPLChartInst = null;
}

window.setPortfolioPeriod = function(days, btn) {
  document.querySelectorAll('.year-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window._pfPeriod = days;
  if (_pfPeriodTimeout) clearTimeout(_pfPeriodTimeout);
  _pfPeriodTimeout = setTimeout(() => renderPortfolio(), 150);
}

window.initPortefeuille = function() {
  console.log('initPortefeuille appelé');
  window._pfPeriod = window._pfPeriod || 99999;
  populateTickerSelect();
  window.addEventListener('dataLoaded', () => { populateTickerSelect(); renderPortfolio(); }, { once: true });
  renderPortfolio();
}
