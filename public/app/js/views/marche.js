// ═══════════════════════════════════════
// VIEW — Marché / Analyse Technique
// ═══════════════════════════════════════
(function() {
  if (window.__TC_MARCHE_LOADED__) return;
  window.__TC_MARCHE_LOADED__ = true;

  let _marcheTicker = null;
  let _marchePeriod = 30;
  let _marcheIndicators = [];

  window.renderMarche = async function(ticker) {
    _marcheTicker = ticker || _marcheTicker;
    if (!_marcheTicker) {
      const container = document.getElementById('marcheContent');
      if (container) container.innerHTML = '<div class="empty-state">Sélectionnez un titre pour l’analyse technique</div>';
      return;
    }
    try {
      const history = await loadMarcheHistory(_marcheTicker, _marchePeriod);
      renderMarcheIdxChart(history);
      renderMarcheIndicators(history);
    } catch (err) {
      console.error('[MARCHE] Erreur rendu:', err);
      if (typeof toast === 'function') toast('Erreur chargement marché: ' + err.message, 'error');
    }
  };

  function renderMarcheIdxChart(history) {
    if (window.techChartInst) {
      window.techChartInst.destroy();
      window.techChartInst = null;
    }
    const canvas = document.getElementById('marcheChart');
    if (!canvas) return;
    const labels = history.map(d => fmtDate(d.date || d.date_seance));
    const closes = history.map(d => Number(d.cloture ?? d.cours ?? 0));
    const volumes = history.map(d => Number(d.volume ?? 0));
    if (closes.length < 2) return showChartError(canvas, 'Données insuffisantes');
    try {
      window.techChartInst = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [
          mkDataset(closes, '#B8964E', 'Clôture'),
          { type: 'bar', label: 'Volume', data: volumes, backgroundColor: 'rgba(184,150,78,0.3)', yAxisID: 'y1', barThickness: 2 }
        ]},
        options: {
          ...(window.chartOpts || {}),
          interaction: { intersect: false, mode: 'index' },
          scales: {
            ...((window.chartOpts || {}).scales || {}),
            y1: { type: 'linear', display: true, position: 'left', grid: { display: false }, ticks: { display: false } }
          }
        }
      });
    } catch (err) {
      console.error('[MARCHE] Erreur création chart:', err);
      showChartError(canvas, 'Erreur graphique');
    }
  }

  function showChartError(canvas, msg) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(245,240,232,0.5)';
    ctx.font = '14px DM Sans';
    ctx.textAlign = 'center';
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
  }

  async function loadMarcheHistory(ticker, period) {
    const limit = Math.min(Math.max(Number(period) || 30, 1), 1000);
    try {
      const result = await apiGet(`/marche?type=historique&ticker=${encodeURIComponent(ticker)}&limit=${limit}`);
      const rows = Array.isArray(result) ? result : (result && Array.isArray(result.data) ? result.data : []);
      if (rows.length) return rows.reverse();
    } catch (err) {
      console.warn('[MARCHE] API history indisponible, fallback local:', err.message);
    }

    const tickerCours = (window.allCours || [])
      .filter(c => String(c.ticker || '').toUpperCase() === String(ticker).toUpperCase())
      .sort((a, b) => new Date(a.date_seance) - new Date(b.date_seance))
      .slice(-limit);

    return tickerCours.map(c => ({
      date: c.date_seance,
      date_seance: c.date_seance,
      cloture: c.cloture ?? c.cours,
      cours: c.cours,
      volume: c.volume,
      ouverture: c.ouverture,
      haut: c.haut ?? c.plus_haut,
      bas: c.bas ?? c.plus_bas
    }));
  }

  function renderMarcheIndicators(history) {
    if (!history.length) return;
    const closes = history.map(d => Number(d.cloture ?? d.cours ?? 0));
    updateIndicatorDisplay('rsiValue', calculateRSI(closes, 14));
    updateIndicatorDisplay('macdValue', calculateMACD(closes));
    updateIndicatorDisplay('stochValue', calculateStochastic(history));
  }

  function updateIndicatorDisplay(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value == null || isNaN(value)) { el.textContent = '—'; return; }
    el.textContent = Number(value).toFixed(2);
    let cls = 'neutral';
    if (id === 'rsiValue') cls = value > 70 ? 'overbought' : value < 30 ? 'oversold' : 'neutral';
    el.className = cls;
  }

  function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) { const change = closes[i] - closes[i - 1]; if (change > 0) gains += change; else losses -= change; }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) { const change = closes[i] - closes[i - 1]; avgGain = ((avgGain * (period - 1)) + (change > 0 ? change : 0)) / period; avgLoss = ((avgLoss * (period - 1)) + (change < 0 ? -change : 0)) / period; }
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + avgGain / avgLoss));
  }

  function calculateMACD(closes, fast = 12, slow = 26) {
    if (closes.length < slow) return null;
    const ema = (data, period) => { const k = 2 / (period + 1); let value = data[0]; for (let i = 1; i < data.length; i++) value = data[i] * k + value * (1 - k); return value; };
    return ema(closes, fast) - ema(closes, slow);
  }

  function calculateStochastic(history, period = 14) {
    if (history.length < period) return null;
    const recent = history.slice(-period);
    const highs = recent.map(d => Number(d.haut ?? d.plus_haut ?? d.cloture ?? d.cours ?? 0));
    const lows = recent.map(d => Number(d.bas ?? d.plus_bas ?? d.cloture ?? d.cours ?? 0));
    const current = Number(recent.at(-1).cloture ?? recent.at(-1).cours ?? 0);
    const high = Math.max(...highs), low = Math.min(...lows);
    return high === low ? 50 : ((current - low) / (high - low)) * 100;
  }

  window.setMarcheTicker = function(ticker) { _marcheTicker = ticker; renderMarche(); };
  window.setMarchePeriod = function(days) { _marchePeriod = days; renderMarche(); };
  window.addMarcheIndicator = function(type) { if (!_marcheIndicators.includes(type)) { _marcheIndicators.push(type); renderMarche(); } };
  window.removeMarcheIndicator = function(type) { _marcheIndicators = _marcheIndicators.filter(i => i !== type); renderMarche(); };

  console.log('[MARCHE] Chargé avec succès');
})();
