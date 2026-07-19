// ═══════════════════════════════════════════════════════
// PORTEFEUILLE — POINT D'ENTRÉE (v3)
// renderPortfolio + watchlist, alertes, objectif, transactions,
// recherche/tri, meilleure/pire position, P&L réalisé.
// ═══════════════════════════════════════════════════════

let _pfRenderPending = false;
let _pfPeriodTimeout = null;

function populateTickerSelect() {
  const selects = [document.getElementById('pfTicker'), document.getElementById('watchTicker')];
  selects.forEach(select => {
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
  });
  if (typeof populateSellTickerSelect === 'function') populateSellTickerSelect();
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
    const pfTotalSub = document.getElementById('pfTotalSub');
    const pfPLSub = document.getElementById('pfPLSub');
    const pfCash = document.getElementById('pfCash');
    const pfRealizedPL = document.getElementById('pfRealizedPL');

    // Ces panneaux existent indépendamment des positions
    renderWatchlist();
    renderAlerts();
    renderGoal(0);
    renderTransactionHistory();

    if (pfRealizedPL) {
      const realized = getRealizedPL();
      pfRealizedPL.textContent = (realized >= 0 ? '+' : '') + (typeof fmtM === 'function' ? fmtM(realized) : realized.toFixed(0)) + ' FCFA';
      pfRealizedPL.style.color = realized >= 0 ? 'var(--green)' : realized < 0 ? 'var(--red)' : '';
    }

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
        currentPrice, cmp, cmpPositions: cmpData.positions,
        value, invested, pl, plPct, sector: s, pays: py
      });
    });

    rows.forEach(r => { r.allocation = totalValue > 0 ? (r.value / totalValue * 100) : 0; });

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
      pfPLSub.textContent = `${totalReturn >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(totalReturn, 2) : totalReturn.toFixed(2)}% de rentabilité`;
      pfPLSub.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (pfReturn) {
      pfReturn.textContent = (typeof fmt === 'function' ? fmt(totalReturn, 2) : totalReturn.toFixed(2)) + '%';
      pfReturn.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (pfVol) pfVol.textContent = (vol > 0 && hist.values.length >= 2) ? (typeof fmt === 'function' ? fmt(vol * 100, 2) : (vol * 100).toFixed(2)) + '%' : '—';
    if (pfSharpe) pfSharpe.textContent = (sharpe !== 0 && hist.values.length >= 2) ? (typeof fmt === 'function' ? fmt(sharpe, 2) : sharpe.toFixed(2)) : '—';
    if (pfDD) pfDD.textContent = (maxDD > 0 && hist.values.length >= 2) ? '-' + (typeof fmt === 'function' ? fmt(maxDD, 2) : maxDD.toFixed(2)) + '%' : '—';

    // Meilleure / pire position
    const sortedByPL = [...rows].sort((a, b) => b.plPct - a.plPct);
    const best = sortedByPL[0], worst = sortedByPL[sortedByPL.length - 1];
    const bestEl = document.getElementById('pfBestPos');
    const worstEl = document.getElementById('pfWorstPos');
    if (bestEl && best) {
      bestEl.innerHTML = `${best.ticker} <span style="color:var(--green)">+${typeof fmt === 'function' ? fmt(best.plPct, 1) : best.plPct.toFixed(1)}%</span>`;
    }
    if (worstEl && worst) {
      worstEl.innerHTML = `${worst.ticker} <span style="color:${worst.plPct >= 0 ? 'var(--green)' : 'var(--red)'}">${worst.plPct >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(worst.plPct, 1) : worst.plPct.toFixed(1)}%</span>`;
    }

    // — Recherche + tri sur le tableau —
    window._pfLastRows = rows;
    let displayRows = [...rows];
    const st = window._pfTableState || { search: '', sortBy: 'value', sortDir: 'desc' };
    if (st.search) {
      displayRows = displayRows.filter(r =>
        r.ticker.toUpperCase().includes(st.search) ||
        (r.pays || '').toUpperCase().includes(st.search) ||
        (r.sector || '').toUpperCase().includes(st.search)
      );
    }
    displayRows.sort((a, b) => {
      let av = a[st.sortBy], bv = b[st.sortBy];
      if (typeof av === 'string') { av = av.toUpperCase(); bv = bv.toUpperCase(); return av.localeCompare(bv); }
      return (bv || 0) - (av || 0);
    });

    const tbody = document.getElementById('pfTable');
    if (tbody) {
      if (!displayRows.length) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--dim)">Aucun résultat pour « ${st.search} ».</td></tr>`;
      } else {
        tbody.innerHTML = displayRows.map(p => {
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
                <div style="font-size:10px;color:var(--dim)">${p.pays} · ${p.sector}</div>
                <details style="margin-top:4px">
                  <summary style="font-size:10px;color:var(--gold);cursor:pointer">📋 ${p.cmpPositions.length} achat(s)</summary>
                  <div style="padding:4px 0">${purchaseHistory}</div>
                </details>
              </td>
              <td style="padding:10px 12px;text-align:right">${typeof fmt === 'function' ? fmt(p.qty) : p.qty}</td>
              <td style="padding:10px 12px;text-align:right;font-family:var(--mono);color:var(--gold)">${typeof fmt === 'function' ? fmt(p.cmp, 2) : p.cmp.toFixed(2)}</td>
              <td style="padding:10px 12px;text-align:right;color:${priceFound ? 'inherit' : 'var(--dim)'}">${typeof fmt === 'function' ? fmt(p.currentPrice, 2) : p.currentPrice.toFixed(2)}${!priceFound ? ' <small>(est.)</small>' : ''}</td>
              <td style="padding:10px 12px;text-align:right;color:${p.pl >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:600">${p.pl >= 0 ? '+' : ''}${typeof fmtM === 'function' ? fmtM(p.pl) : p.pl.toFixed(0)}</td>
              <td style="padding:10px 12px;text-align:right"><span class="badge ${p.plPct >= 0 ? 'badge-green' : 'badge-red'}">${p.plPct >= 0 ? '+' : ''}${typeof fmt === 'function' ? fmt(p.plPct, 2) : p.plPct.toFixed(2)}%</span></td>
              <td style="padding:10px 12px;text-align:right">${typeof fmtM === 'function' ? fmtM(p.value) : p.value.toFixed(0)}</td>
              <td style="padding:10px 12px;text-align:right">${typeof fmt === 'function' ? fmt(p.allocation, 2) : p.allocation.toFixed(2)}%</td>
              <td style="padding:10px 12px;text-align:right">${high52 ? (typeof fmt === 'function' ? fmt(high52, 2) : high52.toFixed(2)) : '—'}</td>
              <td style="padding:10px 12px;text-align:right">${low52 ? (typeof fmt === 'function' ? fmt(low52, 2) : low52.toFixed(2)) : '—'}</td>
              <td style="padding:10px 12px;text-align:center">
                <div class="row-actions">
                  <button onclick="openEditModal(${p.id})" title="Modifier">✏️</button>
                  <button onclick="openSellModal('${p.ticker}')" title="Vendre">💹</button>
                  <button class="danger" onclick="removePosition(${p.id})" title="Supprimer">🗑</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
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
          ${dividends.length ? dividends.slice(-5).reverse().map(d => `
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
    if (typeof renderRebalancing === 'function') renderRebalancing(rows, totalValue);
    renderGoal(totalWithCash);

  } finally {
    _pfRenderPending = false;
  }
};

// — WATCHLIST —
function renderWatchlist() {
  const el = document.getElementById('watchlistPanel');
  if (!el) return;
  const list = getWatchlist();
  if (!list.length) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--dim);font-size:13px;padding:12px">Aucun titre suivi.</div>';
    return;
  }
  el.innerHTML = list.map(w => {
    const price = getLatestPrice(w.ticker);
    return `
      <div class="watchlist-card">
        <button class="wl-remove" onclick="removeFromWatchlist('${w.ticker}')" title="Retirer">✕</button>
        <div class="wl-ticker">${w.ticker}</div>
        <div class="wl-price">${price ? (typeof fmt === 'function' ? fmt(price, 2) : price.toFixed(2)) + ' FCFA' : '—'}</div>
        <div style="font-size:10px;color:var(--dim)">Ajouté le ${typeof fmtDate === 'function' ? fmtDate(w.addedAt) : w.addedAt}</div>
      </div>`;
  }).join('');
}

// — ALERTES DE PRIX —
function renderAlerts() {
  const el = document.getElementById('alertsPanel');
  if (!el) return;
  const alerts = getAlerts();
  if (!alerts.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:12px">Aucune alerte active.</div>';
    return;
  }
  el.innerHTML = alerts.map(a => {
    const price = getLatestPrice(a.ticker);
    const triggered = price != null && ((a.condition === 'above' && price >= a.target) || (a.condition === 'below' && price <= a.target));
    return `
      <div class="alert-item ${triggered ? 'triggered' : ''}">
        <span>${triggered ? '🔔' : '⏳'} <b style="color:var(--gold)">${a.ticker}</b> ${a.condition === 'above' ? 'au-dessus de' : 'en dessous de'} ${typeof fmt === 'function' ? fmt(a.target, 2) : a.target} FCFA
          ${price != null ? `<span style="color:var(--dim)"> · actuel ${typeof fmt === 'function' ? fmt(price, 2) : price.toFixed(2)}</span>` : ''}
          ${triggered ? '<span class="badge badge-gold" style="margin-left:6px">Déclenchée</span>' : ''}
        </span>
        <button onclick="removePriceAlert(${a.id})" style="background:none;border:none;color:var(--dim);cursor:pointer">✕</button>
      </div>`;
  }).join('');
}

// — OBJECTIF DE PORTEFEUILLE —
function renderGoal(totalWithCash) {
  const el = document.getElementById('goalSummary');
  if (!el) return;
  const goal = getGoal();
  if (!goal || !goal.target) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:12px">Aucun objectif défini pour l\'instant.</div>';
    return;
  }
  const progress = Math.min(100, (totalWithCash / goal.target) * 100);
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--dim)">
      <span>Progression vers ${typeof fmtM === 'function' ? fmtM(goal.target) : goal.target} FCFA</span>
      <span style="color:var(--gold);font-weight:600">${typeof fmt === 'function' ? fmt(progress, 1) : progress.toFixed(1)}%</span>
    </div>
    <div class="goal-progress-track"><div class="goal-progress-fill" style="width:${progress}%"></div></div>
    ${goal.date ? `<div style="font-size:11px;color:var(--dim)">Échéance : ${typeof fmtDate === 'function' ? fmtDate(goal.date) : goal.date}</div>` : ''}
  `;
}

// — HISTORIQUE DES TRANSACTIONS —
function renderTransactionHistory() {
  const el = document.getElementById('transactionHistoryPanel');
  if (!el) return;
  const txs = getTransactions().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
  if (!txs.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Aucune transaction enregistrée.</div>';
    return;
  }
  const labels = { buy: 'ACHAT', sell: 'VENTE', dividend: 'DIVIDENDE', deposit: 'DÉPÔT', withdraw: 'RETRAIT' };
  el.innerHTML = txs.map(t => {
    const amountLabel = t.type === 'buy' || t.type === 'sell'
      ? `${t.qty} × ${typeof fmt === 'function' ? fmt(t.price, 2) : t.price} FCFA`
      : `${typeof fmtM === 'function' ? fmtM(t.amount) : t.amount} FCFA`;
    const plLabel = t.type === 'sell' && t.realizedPL != null
      ? `<span style="color:${t.realizedPL >= 0 ? 'var(--green)' : 'var(--red)'}">${t.realizedPL >= 0 ? '+' : ''}${typeof fmtM === 'function' ? fmtM(t.realizedPL) : t.realizedPL.toFixed(0)}</span>`
      : '';
    return `
      <div class="tx-item">
        <span style="color:var(--dim)">${typeof fmtDate === 'function' ? fmtDate(t.date) : t.date}</span>
        <span class="tx-type tx-${t.type}">${labels[t.type] || t.type}</span>
        <span>${t.ticker ? `<b style="color:var(--gold)">${t.ticker}</b> — ` : ''}${amountLabel}</span>
        <span>${plLabel}</span>
      </div>`;
  }).join('');
}

function resetEmptyState() {
  ['pfTotal', 'pfInvested', 'pfPL', 'pfReturn', 'pfVolatility', 'pfSharpe', 'pfDrawdown', 'pfBestPos', 'pfWorstPos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  const cash = getCash();
  const pfCash = document.getElementById('pfCash');
  if (pfCash) pfCash.textContent = (typeof fmtM === 'function' ? fmtM(cash) : cash.toFixed(0)) + ' FCFA (liquide)';

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
    if (chart) chart.destroy();
  });
  pfValueChartInst = pfSectorChartInst = pfGeoChartInst = pfPLChartInst = null;

  const concEl = document.getElementById('concentrationStats');
  if (concEl) concEl.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions</div>';
  const divEstEl = document.getElementById('dividendStats');
  if (divEstEl) divEstEl.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions</div>';
  const benchEl = document.getElementById('benchmarkStats');
  if (benchEl) benchEl.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions</div>';
  const corrEl = document.getElementById('correlationMatrix');
  if (corrEl) corrEl.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Ajoutez au moins 2 positions</div>';
  const rebalEl = document.getElementById('rebalancingPanel');
  if (rebalEl) rebalEl.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Définissez des allocations cibles pour voir les suggestions.</div>';
}

window.setPortfolioPeriod = function(days, btn) {
  document.querySelectorAll('.year-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window._pfPeriod = days;
  if (_pfPeriodTimeout) clearTimeout(_pfPeriodTimeout);
  _pfPeriodTimeout = setTimeout(() => renderPortfolio(), 150);
};

window.initPortefeuille = function() {
  window._pfPeriod = window._pfPeriod || 99999;
  populateTickerSelect();
  renderPortfolio();

  window.addEventListener('dataLoaded', () => {
    populateTickerSelect();
    renderPortfolio();
  }, { once: true });
};
