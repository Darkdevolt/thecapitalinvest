// THE CAPITAL, Portefeuille analytics, charts and action wiring
(function () {
  'use strict';

  const chartInstances = {};

  function money(v) {
    return typeof window.fmtM === 'function' ? window.fmtM(v) : Number(v || 0).toLocaleString('fr-FR');
  }
  function number(v, d = 2) {
    return typeof window.fmt === 'function' ? window.fmt(v, d) : Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function destroyChart(id) {
    if (chartInstances[id]) {
      try { chartInstances[id].destroy(); } catch (_) {}
      delete chartInstances[id];
    }
  }
  function makeChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof window.Chart !== 'function') return null;
    destroyChart(id);
    chartInstances[id] = new window.Chart(canvas, config);
    return chartInstances[id];
  }

  window.renderPortfolioCharts = function (rows, totalValue, sectors, pays, hist) {
    const labels = (hist?.dates || []).map(d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    makeChart('chartPortfolioValue', {
      type: 'line',
      data: { labels, datasets: [{ label: 'Valeur du portefeuille', data: hist?.values || [], tension: .25, pointRadius: 0, borderWidth: 2, fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => money(v) } } } }
    });
    makeChart('chartPortfolioPL', {
      type: 'line',
      data: { labels, datasets: [{ label: 'P&L cumulé', data: hist?.pls || [], tension: .25, pointRadius: 0, borderWidth: 2, fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => money(v) } } } }
    });
    const sectorLabels = Object.keys(sectors || {});
    makeChart('chartSectorAlloc', {
      type: 'doughnut',
      data: { labels: sectorLabels, datasets: [{ data: sectorLabels.map(k => sectors[k]) }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    const geoLabels = Object.keys(pays || {});
    makeChart('chartGeoAlloc', {
      type: 'doughnut',
      data: { labels: geoLabels, datasets: [{ data: geoLabels.map(k => pays[k]) }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  };

  window.renderConcentration = function (rows, totalValue) {
    const el = document.getElementById('concentrationStats');
    if (!el) return;
    if (!rows?.length || totalValue <= 0) {
      el.innerHTML = '<div style="text-align:center;color:var(--dim);padding:20px">Aucune donnée de concentration.</div>';
      return;
    }
    const sorted = [...rows].sort((a,b) => b.value - a.value);
    const hhi = sorted.reduce((s,r) => s + Math.pow((r.value / totalValue) * 100, 2), 0);
    const top1 = sorted[0];
    const top3 = sorted.slice(0,3).reduce((s,r) => s + r.value, 0) / totalValue * 100;
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:16px">
      <div><div style="font-size:11px;color:var(--dim)">Plus grosse ligne</div><strong style="font-size:18px;color:var(--gold)">${esc(top1.ticker)}</strong><div style="font-size:12px;color:var(--dim)">${number(top1.allocation,2)}%</div></div>
      <div><div style="font-size:11px;color:var(--dim)">Top 3</div><strong style="font-size:18px">${number(top3,2)}%</strong><div style="font-size:12px;color:var(--dim)">du portefeuille investi</div></div>
      <div><div style="font-size:11px;color:var(--dim)">HHI</div><strong style="font-size:18px">${number(hhi,0)}</strong><div style="font-size:12px;color:var(--dim)">0 à 10 000 · plus élevé = plus concentré</div></div>
    </div>`;
  };

  window.renderDividends = function (rows) {
    const el = document.getElementById('dividendStats');
    if (!el) return;
    const divs = typeof window.getDividends === 'function' ? window.getDividends() : [];
    const total = divs.reduce((s,d) => s + Number(d.amount || 0), 0);
    const invested = (rows || []).reduce((s,r) => s + Number(r.invested || 0), 0);
    const netContributions = (() => {
      const txs = typeof window.getTransactions === 'function' ? window.getTransactions() : [];
      return txs.reduce((s,t) => {
        const type = String(t.type || '').toUpperCase();
        const amount = Math.abs(Number(t.montant_net ?? t.montant_brut ?? t.amount ?? 0));
        return type === 'DEPOT' || type === 'DEPOSIT' ? s + amount : type === 'RETRAIT' || type === 'WITHDRAW' ? s - amount : s;
      }, 0);
    })();
    const base = netContributions > 0 ? netContributions : invested;
    const yieldPct = base > 0 ? total / base * 100 : 0;
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:16px">
      <div><div style="font-size:11px;color:var(--dim)">Dividendes perçus</div><strong style="font-size:18px;color:var(--green)">+${money(total)} FCFA</strong></div>
      <div><div style="font-size:11px;color:var(--dim)">Rendement sur capital</div><strong style="font-size:18px">${number(yieldPct,2)}%</strong></div>
      <div><div style="font-size:11px;color:var(--dim)">Versements de dividendes</div><strong style="font-size:18px">${divs.length}</strong></div>
    </div>`;
  };

  window.renderBenchmark = function () {
    const el = document.getElementById('benchmarkStats');
    if (!el) return;
    el.innerHTML = `<div style="padding:16px"><div style="font-size:11px;color:var(--dim);margin-bottom:6px">Performance vs BRVM</div><strong style="font-size:20px;color:var(--dim)">, </strong><div style="font-size:12px;color:var(--dim);margin-top:6px">Comparaison non calculée : aucune série d'indice BRVM compatible n'est exposée au moteur portefeuille actuel. Aucune valeur n'est inventée.</div></div>`;
  };

  window.renderCorrelationMatrix = function (rows) {
    const el = document.getElementById('correlationMatrix');
    if (!el) return;
    const tickers = [...new Set((rows || []).map(r => String(r.ticker || '').toUpperCase().trim()).filter(Boolean))];
    if (tickers.length < 2) {
      el.innerHTML = '<div style="text-align:center;color:var(--dim);padding:20px">Ajoutez au moins 2 titres pour calculer les corrélations.</div>';
      return;
    }
    const dates = (typeof window.getPortfolioHistory === 'function' ? window.getPortfolioHistory(window._pfPeriod || 99999).dates : []) || [];
    const series = {};
    tickers.forEach(t => { series[t] = dates.map(d => typeof window.getPriceAtDate === 'function' ? window.getPriceAtDate(t, new Date(d).toISOString().slice(0,10)) : null); });
    const returns = {};
    tickers.forEach(t => {
      returns[t] = [];
      for (let i=1;i<series[t].length;i++) {
        const a=Number(series[t][i-1]), b=Number(series[t][i]);
        returns[t].push(a>0&&b>0 ? b/a-1 : null);
      }
    });
    let html = '<div style="overflow:auto;padding:12px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="padding:8px;text-align:left">Ticker</th>';
    tickers.forEach(t => { html += `<th style="padding:8px;text-align:right">${esc(t)}</th>`; });
    html += '</tr></thead><tbody>';
    tickers.forEach(a => {
      html += `<tr><th style="padding:8px;text-align:left;color:var(--gold)">${esc(a)}</th>`;
      tickers.forEach(b => {
        const pairedA = [], pairedB = [];
        const aa = returns[a] || [], bb = returns[b] || [];
        const n = Math.min(aa.length, bb.length);
        for (let i=0;i<n;i++) if (Number.isFinite(aa[i]) && Number.isFinite(bb[i])) { pairedA.push(aa[i]); pairedB.push(bb[i]); }
        const c = a === b ? 1 : (typeof window.calcCorrelation === 'function' ? window.calcCorrelation(pairedA, pairedB) : 0);
        html += `<td style="padding:8px;text-align:right;font-family:var(--mono)">${number(c,2)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  };

  const originalRenderPortfolio = window.renderPortfolio;
  if (typeof originalRenderPortfolio === 'function') {
    window.renderPortfolio = function () {
      originalRenderPortfolio();
      try {
        const rows = Array.isArray(window._pfLastRows) ? window._pfLastRows : [];
        if (!rows.length) return;
        const totalValue = rows.reduce((sum, r) => sum + Number(r.value || 0), 0);
        const sectors = {}, pays = {};
        rows.forEach(r => {
          const value = Number(r.value || 0);
          const sector = r.sector || (typeof window.getSector === 'function' ? window.getSector(r.ticker) : 'Autre');
          const country = r.pays || (typeof window.getPays === 'function' ? window.getPays(r.ticker) : ', ');
          sectors[sector] = (sectors[sector] || 0) + value;
          pays[country] = (pays[country] || 0) + value;
        });
        const hist = typeof window.getPortfolioHistory === 'function' ? window.getPortfolioHistory(window._pfPeriod || 99999) : { dates: [], values: [], pls: [], returns: [] };
        window.renderPortfolioCharts(rows, totalValue, sectors, pays, hist);
        window.renderConcentration(rows, totalValue);
        window.renderDividends(rows);
        window.renderBenchmark();
        window.renderCorrelationMatrix(rows);

        // Les indicateurs de risque utilisent désormais les rendements neutralisés
        // des dépôts/retraits, jamais une simple variation de valeur brute.
        const returns = Array.isArray(hist.returns) ? hist.returns.filter(Number.isFinite) : [];
        const vol = typeof window.calcVolatility === 'function' ? window.calcVolatility(returns) : 0;
        const sharpe = typeof window.calcSharpe === 'function' ? window.calcSharpe(returns) : 0;
        const maxDD = typeof window.calcMaxDrawdown === 'function' ? window.calcMaxDrawdown((hist.values || []).filter(Number.isFinite)) : 0;
        const latestPL = hist.pls?.length ? Number(hist.pls[hist.pls.length - 1]) : 0;
        const txs = typeof window.getTransactions === 'function' ? window.getTransactions() : [];
        const netContributions = txs.reduce((s,t) => {
          const type = String(t.type || '').toUpperCase();
          const amount = Math.abs(Number(t.montant_net ?? t.montant_brut ?? t.amount ?? 0));
          return type === 'DEPOT' || type === 'DEPOSIT' ? s + amount : type === 'RETRAIT' || type === 'WITHDRAW' ? s - amount : s;
        }, 0);
        const costBasis = rows.reduce((s,r) => s + Number(r.invested || 0), 0);
        const returnBase = netContributions > 0 ? netContributions : costBasis;
        const globalReturn = returnBase > 0 ? latestPL / returnBase * 100 : 0;

        const pfPL = document.getElementById('pfPL');
        const pfPLSub = document.getElementById('pfPLSub');
        const pfReturn = document.getElementById('pfReturn');
        const pfVol = document.getElementById('pfVolatility');
        const pfSharpe = document.getElementById('pfSharpe');
        const pfDD = document.getElementById('pfDrawdown');
        if (pfPL) { pfPL.textContent = `${latestPL >= 0 ? '+' : ''}${money(latestPL)} FCFA`; pfPL.style.color = latestPL >= 0 ? 'var(--green)' : 'var(--red)'; }
        if (pfPLSub) { pfPLSub.textContent = `${globalReturn >= 0 ? '+' : ''}${number(globalReturn,2)}% de performance globale`; pfPLSub.style.color = globalReturn >= 0 ? 'var(--green)' : 'var(--red)'; }
        if (pfReturn) { pfReturn.textContent = `${number(globalReturn,2)}%`; pfReturn.style.color = globalReturn >= 0 ? 'var(--green)' : 'var(--red)'; }
        if (pfVol) pfVol.textContent = returns.length >= 2 ? `${number(vol * 100,2)}%` : ', ';
        if (pfSharpe) pfSharpe.textContent = returns.length >= 2 ? number(sharpe,2) : ', ';
        if (pfDD) pfDD.textContent = (hist.values || []).length >= 2 ? `-${number(maxDD,2)}%` : ', ';

        const tickers = [...new Set(rows.map(r => String(r.ticker || '').toUpperCase().trim()).filter(Boolean))];
        if (typeof window.hydratePortfolioHistoricalPrices === 'function') {
          const missing = tickers.some(t => !Array.isArray(window._pfHistCache?.[t]) || window._pfHistCache[t].length === 0);
          if (missing && !window.__TC_PF_HISTORY_LOADING__) {
            window.__TC_PF_HISTORY_LOADING__ = true;
            // Sans limite forcée : la fonction détermine la profondeur depuis
            // la transaction la plus ancienne du portefeuille.
            window.hydratePortfolioHistoricalPrices(tickers)
              .catch(e => console.warn('[PORTFOLIO] Historique:', e))
              .finally(() => { window.__TC_PF_HISTORY_LOADING__ = false; });
          }
        }
      } catch (error) {
        console.warn('[PORTFOLIO CHARTS] Analytics render:', error);
      }
    };
  }

  window.addEventListener('portfolio:history-ready', () => {
    if (typeof window.renderPortfolio === 'function') window.renderPortfolio();
  });

  function wirePositionActions(root = document) {
    root.querySelectorAll('.pf-action-btn').forEach(btn => {
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      const row = btn.closest('tr');
      const checkbox = row?.querySelector('.position-checkbox[data-id]');
      const id = checkbox?.dataset.id || '';
      const tickerEl = row?.querySelector('td:nth-child(2) div');
      const ticker = tickerEl?.textContent?.trim() || '';
      const action = btn.textContent.trim().toLowerCase();
      btn.removeAttribute('onclick');
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (action === 'modifier' && typeof window.openEditModal === 'function') window.openEditModal(id);
        else if (action === 'vendre' && typeof window.openSellModal === 'function') window.openSellModal(ticker);
        else if (action === 'supprimer' && typeof window.removePosition === 'function') window.removePosition(id);
      });
    });
  }

  const observer = new MutationObserver(() => wirePositionActions());
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else window.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
  window.addEventListener('load', () => wirePositionActions());
})();