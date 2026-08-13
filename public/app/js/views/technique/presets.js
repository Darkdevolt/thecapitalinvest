// ═══════════════════════════════════════
// AT, Presets & Onboarding
// ═══════════════════════════════════════

const AT_PRESETS = {
  decouverte: {
    name: '🔰 Découverte',
    desc: 'Graphique simple avec tendance de base',
    type: 'line',
    period: 252,
    inds: { sma20: true, vol: true },
    signals: ['trend', 'rsi'],
    edu: true
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
    desc: 'Historique complet + outils avancés + indicateurs complets',
    type: 'candle',
    // 99999 = tout l'historique disponible. atVisibleData utilise cette
    // valeur explicitement pour ne pas tronquer les données.
    period: 99999,
    inds: { ichimoku: true, adx: true, stoch: true, obv: true, bb: true, sma20: true, sma50: true, sma200: true, ema12: true, ema26: true, vol: true, rsi: true, macd: true, cci: true, vwap: true },
    signals: ['all'],
    edu: false
  }
};

function atApplyPreset(key) {
  const p = AT_PRESETS[key];
  if (!p || !window.AT) return;

  Object.keys(AT.activeInds).forEach(k => AT.activeInds[k].on = false);
  AT.type = p.type;
  AT.period = p.period;
  Object.entries(p.inds).forEach(([k, v]) => {
    if (AT.activeInds[k]) AT.activeInds[k].on = v;
  });

  Object.values(AT.activeInds).forEach(ind => {
    if (ind.sub) {
      const el = document.getElementById(ind.sub);
      if (el) el.style.display = ind.on ? '' : 'none';
    }
  });

  AT.eduMode = p.edu;
  if (typeof atRender === 'function') atRender();
  if (typeof atShowToast === 'function') atShowToast(`Preset "${p.name}" appliqué`, 'success');
}

function atShowEduTip(targetId, text, position = 'bottom') {
  if (!AT.eduMode) return;
  const target = document.getElementById(targetId);
  if (!target || target._eduShown) return;

  const tip = document.createElement('div');
  tip.className = 'at-edu-tip';
  tip.innerHTML = `<div class="at-edu-text">${text}</div><button onclick="this.parentElement.remove()">J'ai compris ✓</button>`;
  tip.style.cssText = `position:absolute;z-index:1000;background:rgba(10,8,4,0.95);border:1px solid var(--gold);border-radius:8px;padding:12px;color:var(--cream);font-size:12px;max-width:220px;box-shadow:0 8px 32px rgba(0,0,0,0.4);`;
  target.style.position = 'relative';
  target.appendChild(tip);
  target._eduShown = true;
  if (position === 'bottom') tip.style.top = 'calc(100% + 8px)';
  if (position === 'top') tip.style.bottom = 'calc(100% + 8px)';
  tip.style.left = '0';
}
