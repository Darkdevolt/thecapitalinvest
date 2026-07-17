// ═══════════════════════════════════════
// INDICATORS (CORRIGE — garde anti-double + utilise window.AT)
// ═══════════════════════════════════════
if (window.__indicatorsLoaded) {
  console.warn('[INDICATORS] Deja charge, skip.');
} else {
  window.__indicatorsLoaded = true;

  // Parametres des indicateurs
  const IND_PARAMS = {
    sma: { periods: [20, 50, 200], colors: ['#60a5fa', '#f87171', '#a78bfa'] },
    ema: { periods: [12, 26], colors: ['#4ade80', '#fb923c'] },
    bb: { period: 20, mult: 2, color: 'rgba(184,150,78,0.5)' },
    rsi: { period: 14, overbought: 70, oversold: 30, color: '#fb923c' },
    macd: { fast: 12, slow: 26, signal: 9, colors: ['#60a5fa', '#f87171', '#4ade80'] },
    stoch: { k: 14, d: 3, overbought: 80, oversold: 20, colors: ['#e879f9', '#60a5fa'] },
    adx: { period: 14, color: '#f59e0b' },
    cci: { period: 20, color: '#a78bfa' },
    obv: { color: '#4ade80' }
  };
  window.IND_PARAMS = IND_PARAMS;

  // ── Calcul SMA ──
  function calcSMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[i - j].c;
      result.push(sum / period);
    }
    return result;
  }
  window.calcSMA = calcSMA;

  // ── Calcul EMA ──
  function calcEMA(data, period) {
    const k = 2 / (period + 1);
    const result = [];
    let ema = data[0]?.c || 0;
    for (let i = 0; i < data.length; i++) {
      if (i === 0) { result.push(ema); continue; }
      ema = data[i].c * k + ema * (1 - k);
      result.push(ema);
    }
    return result;
  }
  window.calcEMA = calcEMA;

  // ── Calcul Bollinger Bands ──
  function calcBB(data, period, mult) {
    const middle = calcSMA(data, period);
    const upper = [], lower = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { upper.push(null); lower.push(null); continue; }
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const diff = data[i - j].c - middle[i];
        sum += diff * diff;
      }
      const std = Math.sqrt(sum / period);
      upper.push(middle[i] + mult * std);
      lower.push(middle[i] - mult * std);
    }
    return { middle, upper, lower };
  }
  window.calcBB = calcBB;

  // ── Calcul RSI ──
  function calcRSI(data, period) {
    const result = [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = data[i].c - data[i - 1].c;
      if (change > 0) gains += change; else losses -= change;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = 0; i < data.length; i++) {
      if (i <= period) { result.push(null); continue; }
      const change = data[i].c - data[i - 1].c;
      if (change > 0) { avgGain = (avgGain * (period - 1) + change) / period; avgLoss = (avgLoss * (period - 1)) / period; }
      else { avgGain = (avgGain * (period - 1)) / period; avgLoss = (avgLoss * (period - 1) - change) / period; }
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
    return result;
  }
  window.calcRSI = calcRSI;

  // ── Calcul MACD ──
  function calcMACD(data, fast, slow, signal) {
    const emaFast = calcEMA(data, fast);
    const emaSlow = calcEMA(data, slow);
    const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
    const signalLine = calcEMA(macdLine.map(v => ({ c: v || 0 })), signal);
    const histogram = macdLine.map((v, i) => v - (signalLine[i] || 0));
    return { macd: macdLine, signal: signalLine, histogram };
  }
  window.calcMACD = calcMACD;

  // ── Calcul Stochastique ──
  function calcStoch(data, k, d) {
    const kLine = [];
    for (let i = 0; i < data.length; i++) {
      if (i < k - 1) { kLine.push(null); continue; }
      let lowest = Infinity, highest = -Infinity;
      for (let j = 0; j < k; j++) {
        lowest = Math.min(lowest, data[i - j].l);
        highest = Math.max(highest, data[i - j].h);
      }
      const range = highest - lowest;
      kLine.push(range === 0 ? 50 : 100 * (data[i].c - lowest) / range);
    }
    const dLine = calcSMA(kLine.map(v => ({ c: v || 0 })), d);
    return { k: kLine, d: dLine };
  }
  window.calcStoch = calcStoch;

  // ── Calcul VWAP ──
  function calcVWAP(data) {
    let cumTPV = 0, cumVol = 0;
    return data.map(d => {
      const tp = (d.h + d.l + d.c) / 3;
      cumTPV += tp * d.v;
      cumVol += d.v;
      return cumVol === 0 ? d.c : cumTPV / cumVol;
    });
  }
  window.calcVWAP = calcVWAP;

  // ── Calcul ADX ──
  function calcADX(data, period) {
    const tr = [], plusDM = [], minusDM = [];
    for (let i = 1; i < data.length; i++) {
      tr.push(Math.max(data[i].h - data[i].l, Math.abs(data[i].h - data[i-1].c), Math.abs(data[i].l - data[i-1].c)));
      plusDM.push(data[i].h - data[i-1].h > data[i-1].l - data[i].l ? Math.max(data[i].h - data[i-1].h, 0) : 0);
      minusDM.push(data[i-1].l - data[i].l > data[i].h - data[i-1].h ? Math.max(data[i-1].l - data[i].l, 0) : 0);
    }
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period) { result.push(null); continue; }
      let atr = 0, pDI = 0, mDI = 0;
      for (let j = 0; j < period; j++) {
        atr += tr[i - j - 1] || 0;
        pDI += plusDM[i - j - 1] || 0;
        mDI += minusDM[i - j - 1] || 0;
      }
      atr /= period; pDI = (pDI / period) / atr * 100; mDI = (mDI / period) / atr * 100;
      const dx = Math.abs(pDI - mDI) / (pDI + mDI) * 100;
      result.push(dx);
    }
    return result;
  }
  window.calcADX = calcADX;

  // ── Calcul CCI ──
  function calcCCI(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); continue; }
      let sum = 0;
      for (let j = 0; j < period; j++) sum += (data[i - j].h + data[i - j].l + data[i - j].c) / 3;
      const sma = sum / period;
      let meanDev = 0;
      for (let j = 0; j < period; j++) meanDev += Math.abs((data[i - j].h + data[i - j].l + data[i - j].c) / 3 - sma);
      meanDev /= period;
      result.push(meanDev === 0 ? 0 : ((data[i].h + data[i].l + data[i].c) / 3 - sma) / (0.015 * meanDev));
    }
    return result;
  }
  window.calcCCI = calcCCI;

  // ── Calcul OBV ──
  function calcOBV(data) {
    let obv = 0;
    return data.map((d, i) => {
      if (i === 0) return 0;
      if (d.c > data[i-1].c) obv += d.v;
      else if (d.c < data[i-1].c) obv -= d.v;
      return obv;
    });
  }
  window.calcOBV = calcOBV;
}
