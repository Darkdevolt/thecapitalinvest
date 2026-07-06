// ═══════════════════════════════════════
// AT — Explainable Signals
// ═══════════════════════════════════════

function atUpdateSignals(closes, highs, lows, vols, liveVar, liveC) {
  const n = closes.length;
  const signals = [];
  
  // ── Calculs ──
  const sma20 = atSMA(closes, atGetIndParam('sma20', 'period') || 20);
  const sma50 = atSMA(closes, atGetIndParam('sma50', 'period') || 50);
  const lc = closes[n-1], ls20 = sma20[n-1], ls50 = sma50[n-1];
  
  // 1. TREND
  let trendScore = 0, trendReason = '';
  if (ls20 && ls50) {
    if (lc > ls20 && ls20 > ls50) { trendScore = 2; trendReason = 'Prix > SMA20 > SMA50'; }
    else if (lc < ls20 && ls20 < ls50) { trendScore = -2; trendReason = 'Prix < SMA20 < SMA50'; }
    else { trendScore = 0; trendReason = 'Moyennes enchevêtrées'; }
  }
  signals.push({ id: 'sigTrend', label: 'Tendance', value: trendScore, reason: trendReason, icon: '📊' });
  
  // 2. MOMENTUM (RSI)
  const rsi = atRSI(closes, atGetIndParam('rsi', 'period') || 14);
  const lr = rsi[n-1];
  let rsiScore = 0, rsiReason = '';
  if (lr > 70) { rsiScore = -1; rsiReason = `RSI ${lr.toFixed(1)} > 70 (surachat)`; }
  else if (lr < 30) { rsiScore = 1; rsiReason = `RSI ${lr.toFixed(1)} < 30 (survente)`; }
  else { rsiReason = `RSI ${lr.toFixed(1)} — zone neutre`; }
  signals.push({ id: 'sigMom', label: 'Momentum', value: rsiScore, reason: rsiReason, icon: '⚡' });
  
  // 3. VOLATILITÉ (Bollinger)
  const bb = atBB(closes, atGetIndParam('bb', 'period') || 20);
  const lb = bb[n-1];
  let volScore = 0, volReason = '';
  if (lb?.upper) {
    const width = ((lb.upper - lb.lower) / lb.mid * 100);
    if (width > 5) { volScore = 0; volReason = `Volatilité élevée (${width.toFixed(1)}%)`; }
    else if (width < 1.5) { volScore = 0; volReason = `Compression des bandes (${width.toFixed(1)}%)`; }
    else { volReason = `Volatilité normale (${width.toFixed(1)}%)`; }
  }
  signals.push({ id: 'sigVol', label: 'Volatilité', value: volScore, reason: volReason, icon: '🌊' });
  
  // 4. MACD
  const macd = atMACD(closes);
  const lm = macd[n-1], lm2 = macd[n-2];
  let macdScore = 0, macdReason = '';
  if (lm && lm2) {
    if (lm.macd > lm.signal && lm2.macd <= lm2.signal) { macdScore = 1; macdReason = 'Croisement MACD haussier'; }
    else if (lm.hist > 0) { macdScore = 0.5; macdReason = 'Histogramme positif'; }
    else { macdScore = -0.5; macdReason = 'Histogramme négatif'; }
  }
  signals.push({ id: 'sigMACD', label: 'MACD', value: macdScore, reason: macdReason, icon: '📉' });
  
  // ── Score global ──
  const totalScore = signals.reduce((a, s) => a + s.value, 0);
  const glob = totalScore >= 2 ? ['ACHAT FORT', 'b', '#4ADE80'] 
    : totalScore >= 0.5 ? ['ACHAT', 'b', '#4ADE80']
    : totalScore <= -2 ? ['VENTE FORTE', 's', '#F87171']
    : totalScore <= -0.5 ? ['VENTE', 's', '#F87171']
    : ['NEUTRE', 'n', '#FBBF24'];
  
  // ── Rendu ──
  const container = document.getElementById('atSignalsPanel');
  if (container) {
    container.innerHTML = `
      <div class="at-sig-header">
        <div class="at-sig-glob" style="background:${glob[2]}20;color:${glob[2]};border:1px solid ${glob[2]}40">
          ${glob[0]} <span style="font-size:11px;opacity:0.7">Score ${totalScore.toFixed(1)}/10</span>
        </div>
        ${AT.eduMode ? `<div class="at-sig-help">💡 Cliquez un signal pour comprendre le calcul</div>` : ''}
      </div>
      <div class="at-sig-grid">
        ${signals.map(s => `
          <div class="at-sig-card ${s.value > 0 ? 'bull' : s.value < 0 ? 'bear' : 'neutral'}" 
               onclick="atShowSignalDetail('${s.id}')">
            <div class="at-sig-icon">${s.icon}</div>
            <div class="at-sig-name">${s.label}</div>
            <div class="at-sig-bar">
              <div class="at-sig-fill" style="width:${Math.min(100, Math.abs(s.value/2)*100)}%;background:${s.value>0?'var(--green)':s.value<0?'var(--red)':'var(--dim)'}"></div>
            </div>
            ${AT.eduMode ? `<div class="at-sig-reason">${s.reason}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Fallback pour les IDs legacy
  const legacyMap = { 'sigTrend': signals[0], 'sigMom': signals[1], 'sigVol': signals[2], 'sigMACD': signals[3] };
  Object.entries(legacyMap).forEach(([id, sig]) => {
    const el = document.getElementById(id); if (!el) return;
    const cls = sig.value > 0 ? 'sig-b' : sig.value < 0 ? 'sig-s' : 'sig-n';
    el.textContent = sig.label.toUpperCase();
    el.className = `sig-badge ${cls}`;
  });
}

function atShowSignalDetail(id) {
  // Pourrait ouvrir un modal avec l'explication détaillée
  const sig = document.getElementById(id);
  if (sig) sig.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
