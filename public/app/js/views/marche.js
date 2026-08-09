// THE CAPITAL — Vue Marché BRVM
(function () {
  if (window.__TC_MARCHE_LOADED__) return;
  window.__TC_MARCHE_LOADED__ = true;

  let _marcheTicker = null;
  let _marchePeriod = 30;

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    const d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—';
  }

  function pct(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(2)} %` : '—';
  }

  function getCours() {
    return Array.isArray(window.allCours) ? window.allCours : [];
  }

  function getIndices() {
    return Array.isArray(window.allIndices) ? window.allIndices : [];
  }

  function renderMarketShell(container) {
    const cours = getCours();
    const indices = getIndices();
    const sorted = [...cours].sort((a, b) => {
      const av = Number(a.variation ?? a.var ?? 0);
      const bv = Number(b.variation ?? b.var ?? 0);
      return bv - av;
    });

    const latestIndices = new Map();
    for (const row of indices) {
      const key = String(row.indice || row.nom || row.code || '').toUpperCase();
      if (!latestIndices.has(key)) latestIndices.set(key, row);
    }

    const findIndex = (...names) => {
      for (const [key, row] of latestIndices) {
        if (names.some(name => key.includes(name))) return row;
      }
      return null;
    };

    const composite = findIndex('COMPOSITE');
    const brvm30 = findIndex('30');
    const prestige = findIndex('PRESTIGE');

    container.innerHTML = `
      <div class="page-header">
        <h1>Marché <span style="color:var(--gold)">BRVM</span></h1>
        <p>Cours, indices et analyse des titres — données provenant de l'API marché.</p>
      </div>

      <div class="grid-3" style="margin-bottom:18px">
        ${indexCard('BRVM Composite', composite)}
        ${indexCard('BRVM 30', brvm30)}
        ${indexCard('BRVM Prestige', prestige)}
      </div>

      <div class="card" style="margin-bottom:18px">
        <div class="card-header">
          <div class="card-title">Cours BRVM</div>
          <div style="font-size:12px;color:var(--dim)">${cours.length} titre(s)</div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ticker</th><th>Société</th><th>Secteur</th><th class="r">Cours</th><th class="r">Variation</th><th class="r">Volume</th><th></th></tr></thead>
            <tbody>
              ${cours.length ? sorted.map(row => {
                const ticker = row.ticker || row.symbol || '';
                const variation = Number(row.variation ?? row.var ?? 0);
                return `<tr>
                  <td><strong style="color:var(--gold)">${esc(ticker)}</strong></td>
                  <td>${esc(row.nom ?? row.entreprise ?? row.name ?? '—')}</td>
                  <td>${esc(row.secteur ?? '—')}</td>
                  <td class="r">${money(row.cours ?? row.cloture)}</td>
                  <td class="r" style="color:${variation > 0 ? 'var(--success,#4ADE80)' : variation < 0 ? 'var(--danger,#F87171)' : 'var(--muted)'}">${pct(row.variation ?? row.var)}</td>
                  <td class="r">${money(row.volume)}</td>
                  <td><button type="button" class="btn btn-sm" onclick="setMarcheTicker('${esc(ticker)}')">Analyser</button></td>
                </tr>`;
              }).join('') : '<tr><td colspan="7"><div class="empty-state">Aucun cours reçu depuis l’API.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div id="marcheAnalysis" class="card">
        <div class="card-header">
          <div class="card-title">Analyse technique</div>
          <div id="marcheSelectedTicker" style="font-family:var(--mono);font-size:11px;color:var(--gold)">${esc(_marcheTicker || 'Sélectionnez un titre')}</div>
        </div>
        <div class="card-body">
          <div class="grid-7030">
            <div><canvas id="marcheChart" height="110"></canvas></div>
            <div id="marcheIndicators" style="display:grid;gap:8px"></div>
          </div>
        </div>
      </div>
    `;

    if (_marcheTicker) loadAndRenderAnalysis(_marcheTicker);
  }

  function indexCard(label, row) {
    if (!row) return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">—</div><div class="stat-change">—</div></div>`;
    const value = row.valeur ?? row.value ?? row.cloture ?? row.cours;
    const variation = row.variation ?? row.var;
    return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${money(value)}</div><div class="stat-change">${pct(variation)}</div></div>`;
  }

  window.renderMarche = function (ticker) {
    if (ticker) _marcheTicker = ticker;
    const container = document.getElementById('view-marche');
    if (!container) {
      console.warn('[MARCHE] Vue #view-marche introuvable');
      return;
    }
    renderMarketShell(container);
  };

  async function loadHistory(ticker, period) {
    const limit = Math.min(Math.max(Number(period) || 30, 1), 1000);
    const result = await apiGet(`/marche?type=historique&ticker=${encodeURIComponent(ticker)}&limit=${limit}`);
    const rows = Array.isArray(result) ? result : (result && Array.isArray(result.data) ? result.data : []);
    return rows;
  }

  async function loadAndRenderAnalysis(ticker) {
    const label = document.getElementById('marcheSelectedTicker');
    if (label) label.textContent = ticker;
    try {
      const history = await loadHistory(ticker, _marchePeriod);
      renderChart(history);
      renderIndicators(history);
    } catch (err) {
      console.error('[MARCHE] Erreur historique:', err);
      const box = document.getElementById('marcheIndicators');
      if (box) box.innerHTML = `<div class="empty-state">Impossible de charger l'historique de ${esc(ticker)}.</div>`;
    }
  }

  function renderChart(history) {
    const canvas = document.getElementById('marcheChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (window.techChartInst) window.techChartInst.destroy();
    const labels = history.map(d => fmtDate(d.date || d.date_seance));
    const closes = history.map(d => Number(d.cloture ?? d.cours ?? 0));
    if (closes.length < 2) return;
    window.techChartInst = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Clôture', data: closes, borderColor: '#B8964E', backgroundColor: 'rgba(184,150,78,0.08)', fill: true, tension: 0.25 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { beginAtZero: false } } }
    });
  }

  function renderIndicators(history) {
    const box = document.getElementById('marcheIndicators');
    if (!box) return;
    const closes = history.map(d => Number(d.cloture ?? d.cours ?? 0));
    const rsi = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);
    box.innerHTML = `<div class="stat-card"><div class="stat-label">RSI 14</div><div class="stat-value">${rsi == null ? '—' : rsi.toFixed(2)}</div></div><div class="stat-card"><div class="stat-label">MACD</div><div class="stat-value">${macd == null ? '—' : macd.toFixed(2)}</div></div>`;
  }

  function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change; else losses -= change;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      avgGain = ((avgGain * (period - 1)) + Math.max(change, 0)) / period;
      avgLoss = ((avgLoss * (period - 1)) + Math.max(-change, 0)) / period;
    }
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + avgGain / avgLoss));
  }

  function calculateMACD(closes, fast = 12, slow = 26) {
    if (closes.length < slow) return null;
    const ema = (data, period) => {
      const k = 2 / (period + 1);
      let value = data[0];
      for (let i = 1; i < data.length; i++) value = data[i] * k + value * (1 - k);
      return value;
    };
    return ema(closes, fast) - ema(closes, slow);
  }

  window.setMarcheTicker = function (ticker) {
    _marcheTicker = ticker;
    renderMarche(ticker);
    document.getElementById('marcheAnalysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.setMarchePeriod = function (days) {
    _marchePeriod = days;
    if (_marcheTicker) loadAndRenderAnalysis(_marcheTicker);
  };

  console.log('[MARCHE] Vue marché unifiée chargée');
})();
