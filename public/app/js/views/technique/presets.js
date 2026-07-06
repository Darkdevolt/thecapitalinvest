// ═══════════════════════════════════════
// AT — Presets & Onboarding
// ═══════════════════════════════════════

const AT_PRESETS = {
  decouverte: {
    name: '🔰 Découverte',
    desc: 'Graphique simple avec tendance de base',
    type: 'line',
    period: 252,
    inds: { sma20: true, vol: true },
    signals: ['trend', 'rsi'],
    edu: true // active les infobulles pédagogiques
  },
  swing: {
    name: '📈 Swing Trading',
    desc: 'Moyennes mobiles + RSI + Volume',
    type: 'candle',
    period: 252,
    inds: { sma20: true, sma50: true, bb: true, rsi: true, macd: true, vol: true },
    signals: ['trend', 'mom', 'rsi', 'macd'],
    edu: false
  },
  pro: {
    name: '🎯 Pro',
    desc: 'Ichimoku, ADX, Stochastique, OBV',
    type: 'candle',
    period: 504,
    inds: { ichimoku: true, adx: true, stoch: true, obv: true, bb: true },
    signals: ['all'],
    edu: false
  }
};

function atApplyPreset(key) {
  const p = AT_PRESETS[key];
  if (!p) return;
  
  // Reset
  Object.keys(AT.activeInds).forEach(k => AT.activeInds[k].on = false);
  
  // Appliquer
  AT.type = p.type;
  AT.period = p.period;
  Object.entries(p.inds).forEach(([k, v]) => {
    if (AT.activeInds[k]) AT.activeInds[k].on = v;
  });
  
  // Activer sous-graphiques visibles
  Object.values(AT.activeInds).forEach(ind => {
    if (ind.sub) document.getElementById(ind.sub).style.display = ind.on ? '' : 'none';
  });
  
  // Activer mode éducatif
  AT.eduMode = p.edu;
  atRender();
  atShowToast(`Preset "${p.name}" appliqué`, 'success');
}

// ── Onboarding tooltip flottant ──
function atShowEduTip(targetId, text, position = 'bottom') {
  if (!AT.eduMode) return;
  const target = document.getElementById(targetId);
  if (!target || target._eduShown) return;
  
  const tip = document.createElement('div');
  tip.className = 'at-edu-tip';
  tip.innerHTML = `
    <div class="at-edu-text">${text}</div>
    <button onclick="this.parentElement.remove()">J'ai compris ✓</button>
  `;
  tip.style.cssText = `
    position:absolute; z-index:1000; background:rgba(10,8,4,0.95);
    border:1px solid var(--gold); border-radius:8px; padding:12px;
    color:var(--cream); font-size:12px; max-width:220px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
  `;
  
  target.style.position = 'relative';
  target.appendChild(tip);
  target._eduShown = true;
  
  // Positionnement
  const rect = target.getBoundingClientRect();
  if (position === 'bottom') tip.style.top = 'calc(100% + 8px)';
  if (position === 'top') tip.style.bottom = 'calc(100% + 8px)';
  tip.style.left = '0';
}
