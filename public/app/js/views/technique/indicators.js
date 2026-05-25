// ═══════════════════════════════════════
// AT — Indicators Registry
// ═══════════════════════════════════════

// ── Indicateurs actifs ──
function atUpdateActiveInds(closes, highs, lows, vols) {
  const el = document.getElementById('atActiveInds'); if (!el) return;
  const inds = AT.activeInds;
  const n = closes.length;
  const vals = {
    sma20: atSMA(closes,20)[n-1], sma50: atSMA(closes,50)[n-1], sma200: atSMA(closes,200)[n-1],
    ema12: atEMA(closes,12)[n-1], ema26: atEMA(closes,26)[n-1],
    rsi: atRSI(closes)[n-1],
  };
  el.innerHTML = Object.entries(inds).filter(([,v])=>v.on).map(([k,v])=>{
    const val = vals[k] != null ? fmt(vals[k]) : '—';
    return `<div class="at-ind-item">
      <div class="at-ind-dot" style="background:${v.color}"></div>
      <span class="at-ind-name">${v.label}</span>
      <span class="at-ind-val" style="color:${v.color}">${val}</span>
      <span class="at-ind-rm" onclick="atRemoveInd('${k}')">✕</span>
    </div>`;
  }).join('');
}

function atRemoveInd(key) {
  AT.activeInds[key].on = false;
  const sub = AT.activeInds[key].sub;
  if (sub) document.getElementById(sub).style.display = 'none';
  atRender();
}

// ── Modal indicateurs ──
function atOpenIndModal() {
  const modal = document.getElementById('atIndModal');
  const body = document.getElementById('atIndModalBody');
  body.innerHTML = IND_CATALOG.map(cat => `
    <div class="at-ind-cat">${cat.cat}</div>
    ${cat.items.map(item => `
      <div class="at-ind-choice ${AT.activeInds[item.key]?.on ? 'sel' : ''}" onclick="atToggleInd('${item.key}',this)">
        <div class="at-ind-choice-dot" style="background:${AT.activeInds[item.key]?.color||'var(--dim)'}"></div>
        <div>
          <div class="at-ind-choice-name">${item.name}</div>
          <div class="at-ind-choice-desc">${item.desc}</div>
        </div>
      </div>
    `).join('')}
  `).join('');
  modal.classList.add('open');
}
function atCloseIndModal() { document.getElementById('atIndModal').classList.remove('open'); }
function atToggleInd(key, el) {
  const ind = AT.activeInds[key]; if (!ind) return;
  ind.on = !ind.on;
  el.classList.toggle('sel', ind.on);
  if (ind.sub) document.getElementById(ind.sub).style.display = ind.on ? '' : 'none';
  if (AT.hist.length) atRender();
}
