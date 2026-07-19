// ═══════════════════════════════════════
// VIEW — Marché / Analyse Technique
// ═══════════════════════════════════════
// Guard pattern
(function() {
  if (window.__TC_MARCHE_LOADED__) {
    console.log('[MARCHE] Déjà chargé, skip.');
    return;
  }
  window.__TC_MARCHE_LOADED__ = true;

  // ═══════════════════════════════════════
  // VARIABLES LOCALES
  // ═══════════════════════════════════════
  let _marcheTicker = null;
  let _marchePeriod = 30;
  let _marcheIndicators = [];

  // ═══════════════════════════════════════
  // RENDER PRINCIPAL (correction chartDefaults)
  // ═══════════════════════════════════════
  window.renderMarche = async function(ticker) {
    console.log('[MARCHE] Rendu pour', ticker);

    _marcheTicker = ticker || _marcheTicker;

    if (!_marcheTicker) {
      // Afficher sélecteur
      const container = document.getElementById('marcheContent');
      if (container) {
        container.innerHTML = "<div class=\"empty-state\">Sélectionnez un titre pour l'analyse technique</div>";
      }
      return;
    }

    try {
      // Charger historique
      const history = await loadMarcheHistory(_marcheTicker, _marchePeriod);

      // CORRECTION: utiliser chartOpts (alias chartDefaults défini dans utils.js)
      renderMarcheIdxChart(history);
      renderMarcheIndicators(history);

    } catch (err) {
      console.error('[MARCHE] Erreur rendu:', err);
      toast('Erreur chargement marché: ' + err.message, 'error');
    }
  };

  // ─── CHART PRINCIPAL ───
  function renderMarcheIdxChart(history) {
    // Détruire ancien chart
    if (window.techChartInst) {
      window.techChartInst.destroy();
      window.techChartInst = null;
    }

    const canvas = document.getElementById('marcheChart');
    if (!canvas) return;

    const labels = history.map(d => fmtDate(d.date));
    const closes = history.map(d => d.cloture || d.cours);
    const volumes = history.map(d => d.volume || 0);

    if (closes.length < 2) {
      showChartError(canvas, 'Données insuffisantes');
      return;
    }

    try {
      // CORRECTION: utiliser chartOpts au lieu de chartDefaults
      window.techChartInst = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            mkDataset(closes, '#B8964E', 'Clôture'),
            // Volume en barres
            {
              type: 'bar',
              label: 'Volume',
              data: volumes,
              backgroundColor: 'rgba(184,150,78,0.3)',
              yAxisID: 'y1',
              barThickness: 2
            }
          ]
        },
        options: {
          ...chartOpts,  // CORRECTION: chartOpts existe maintenant
          interaction: { intersect: false, mode: 'index' },
          scales: {
            ...chartOpts.scales,
            y1: {
              type: 'linear',
              display: true,
              position: 'left',
              grid: { display: false },
              ticks: { display: false }
            }
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

  // ─── CHARGEMENT HISTORIQUE ───
  async function loadMarcheHistory(ticker, period) {
    // Essayer API d'abord
    try {
      const data = await apiGet(`/marche/history?ticker=${encodeURIComponent(ticker)}&period=${period}`);
      if (data && data.length) return data;
    } catch (err) {
      console.warn('[MARCHE] API history indisponible, fallback local');
    }

    // Fallback: construire depuis allCours
    const tickerCours = (window.allCours || []).filter(c => c.ticker === ticker)
      .sort((a, b) => new Date(a.date_seance) - new Date(b.date_seance))
      .slice(-period);

    return tickerCours.map(c => ({
      date: c.date_seance,
      cloture: c.cours,
      volume: c.volume,
      ouverture: c.ouverture,
      haut: c.haut,
      bas: c.bas
    }));
  }

  // ─── INDICATEURS TECHNIQUES ───
  function renderMarcheIndicators(history) {
    if (!history.length) return;

    const closes = history.map(d => d.cloture || d.cours);

    // RSI
    const rsi = calculateRSI(closes, 14);
    updateIndicatorDisplay('rsiValue', rsi);

    // MACD
    const macd = calculateMACD(closes);
    updateIndicatorDisplay('macdValue', macd);

    // Stochastique
    const stoch = calculateStochastic(history);
    updateIndicatorDisplay('stochValue', stoch);
  }

  function updateIndicatorDisplay(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value == null || isNaN(value)) {
      el.textContent = '—';
      return;
    }
    el.textContent = value.toFixed(2);

    // Coloration selon valeur
    let cls = 'neutral';
    if (id === 'rsiValue') {
      if (value > 70) cls = 'overbought';
      else if (value < 30) cls = 'oversold';
    }
    el.className = cls;
  }

  // ─── CALCULS INDICATEURS ───
  function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;

    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      avgGain = ((avgGain * (period - 1)) + (change > 0 ? change : 0)) / period;
      avgLoss = ((avgLoss * (period - 1)) + (change < 0 ? -change : 0)) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  function calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
    if (closes.length < slow) return null;

    const ema = (data, period) => {
      const k = 2 / (period + 1);
      let ema = data[0];
      for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
      }
      return ema;
    };

    const fastEMA = ema(closes.slice(-fast * 2), fast);
    const slowEMA = ema(closes.slice(-slow * 2), slow);
    return fastEMA - slowEMA;
  }

  function calculateStochastic(history, period = 14) {
    if (history.length < period) return null;

    const recent = history.slice(-period);
    const highs = recent.map(d => d.haut || d.cloture || d.cours);
    const lows = recent.map(d => d.bas || d.cloture || d.cours);
    const current = recent[recent.length - 1].cloture || recent[recent.length - 1].cours;

    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);

    if (highestHigh === lowestLow) return 50;

    return ((current - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  // ─── EVENT HANDLERS ───
  window.setMarcheTicker = function(ticker) {
    _marcheTicker = ticker;
    renderMarche();
  };

  window.setMarchePeriod = function(days) {
    _marchePeriod = days;
    renderMarche();
  };

  window.addMarcheIndicator = function(type) {
    if (!_marcheIndicators.includes(type)) {
      _marcheIndicators.push(type);
      renderMarche();
    }
  };

  window.removeMarcheIndicator = function(type) {
    _marcheIndicators = _marcheIndicators.filter(i => i !== type);
    renderMarche();
  };

  console.log('[MARCHE] Chargé avec succès');

})();
