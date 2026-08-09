// THE CAPITAL — Portefeuille analytics, charts and action wiring
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
    makeChart('pfValueChart', {
      type: 'line',
      data: { labels, datasets: [{ label: 'Valeur du portefeuille', data: hist?.values || [], tension: .25, pointRadius: 0, borderWidth: 2, fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => money(v) } } } }
    });
    makeChart('pfPLChart', {
      type: 'line',
      data: { labels, datasets: [{ label: 'P&L cumulé', data: hist?.pls || [], tension: .25, pointRadius: 0, borderWidth: 2, fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => money(v) } } } }
    });
    const sectorLabels = Object.keys(sectors || {});
    makeChart('pfSectorChart', {
      type: 'doughnut',
      data: { labels: sectorLabels, datasets: [{ data: sectorLabels.map(k => sectors[k]) }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    const geoLabels = Object.keys(pays || {});
    makeChart('pfGeoChart', {
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
      <div><div style="font-size:11px;color:var(--dim)">Top 3</div><strong style="font-size:18px">${number(top3,2)}%</strong><div style="font-size:12px;color:var(--dim)">du portefeuille</div></div>
      <div><div style="font-size:11px;color:var(--dim)">HHI</div><strong style="font-size:18px">${number(hhi,0)}</strong><div style="font-size:12px;color:var(--dim)">concentration</div></div>
    </div>`;
  };

  window.renderDividends = function (rows) {
    const el = document.getElementById('dividendStats');
    if (!el) return;
    const divs = typeof window.getDividends === 'function' ? window.getDividends() : [];
    const total = divs.reduce((s,d) => s + Number(d.amount || 0), 0);
    const invested = (rows || []).reduce((s,r) => s + Number(r.invested || 0), 0);
    const yieldPct = invested > 0 ? total / invested * 100 : 0;
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:16px">
      <div><div style="font-size:11px;color:var(--dim)">Dividendes perçus</div><strong style="font-size:18px;color:var(--green)">+${money(total)} FCFA</strong></div>
      <div><div style="font-size:11px;color:var(--dim)">Rendement sur coût</div><strong style="font-size:18px">${number(yieldPct,2)}%</strong></div>
      <div><div style="font-size:11px;color:var(--dim)">Opérations</div><strong style="font-size:18px">${divs.length}</strong></div>
    </div>`;
  };

  window.renderBenchmark = function (rows, hist) {
    const el = document.getElementById('benchmarkStats');
    if (!el) return;
    const values = hist?.values || [];
    if (values.length < 2) {
      el.innerHTML = '<div style="text-align:center;color:var(--dim);padding:20px">Pas assez d’historique pour calculer la performance.</div>';
      return;
    }
    const portfolioReturn = values[0] > 0 ? (values[values.length - 1] / values[0] - 1) * 100 : 0;
    el.innerHTML = `<div style="padding:16px"><div style="font-size:11px;color:var(--dim);margin-bottom:6px">Performance portefeuille sur la période</div><strong style="font-size:24px;color:${portfolioReturn >= 0 ? 'var(--green)' : 'var(--red)'}">${portfolioReturn >= 0 ? '+' : ''}${number(portfolioReturn,2)}%</strong><div style="font-size:12px;color:var(--dim);margin-top:6px">Le benchmark BRVM sera affiché dès qu’une série d’indice correspondante est disponible.</div></div>`;
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
        returns[t].push(a>0&&b>0 ? b/a-1 : 0);
      }
    });
    let html = '<div style="overflow:auto;padding:12px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="padding:8px;text-align:left">Ticker</th>';
    tickers.forEach(t => { html += `<th style="padding:8px;text-align:right">${esc(t)}</th>`; });
    html += '</tr></thead><tbody>';
    tickers.forEach(a => {
      html += `<tr><th style="padding:8px;text-align:left;color:var(--gold)">${esc(a)}</th>`;
      tickers.forEach(b => {
        const c = a === b ? 1 : (typeof window.calcCorrelation === 'function' ? window.calcCorrelation(returns[a], returns[b]) : 0);
        html += `<td style="padding:8px;text-align:right;font-family:var(--mono)">${number(c,2)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  };

  // Les positions agrégées utilisent des UUID Supabase. Les anciens onclick
  // injectés dans le HTML les interprétaient comme du JavaScript invalide.
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
