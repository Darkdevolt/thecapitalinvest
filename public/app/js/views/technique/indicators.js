// ═══════════════════════════════════════
// AT — Smart Indicator Panel
// ═══════════════════════════════════════

const IND_PARAMS = {
  sma: { label: 'SMA', defaultPeriod: 20, min: 5, max: 300, color: '#60a5fa' },
  ema: { label: 'EMA', defaultPeriod: 20, min: 5, max: 300, color: '#4ade80' },
  rsi: { label: 'RSI', defaultPeriod: 14, min: 2, max: 50, color: '#fb923c' },
  bb: { label: 'Bollinger', defaultPeriod: 20, min: 5, max: 100, color: 'rgba(184,150,78,0.5)' },
  macd: { label: 'MACD', params: [{k:'fast',v:12},{k:'slow',v:26},{k:'signal',v:9}] },
  stoch: { label: 'Stochastique', params: [{k:'k',v:14},{k:'d',v:3}] },
};

// ── Stockage des paramètres utilisateur ──
AT.indParams = AT.indParams || {};

function atGetIndParam(key, subKey) {
  return AT.indParams[key]?.[subKey] ?? IND_PARAMS[key.split(/\d+/)[0]]?.defaultPeriod ?? 14;
}

function atSetIndParam(key, subKey, val) {
  AT.indParams[key] = AT.indParams[key] || {};
  AT.indParams[key][subKey] = parseInt(val);
  atRender();
}

// ── Modal amélioré avec recherche ──
function atOpenIndModal() {
  const modal = document.getElementById('atIndModal');
  const body = document.getElementById('atIndModalBody');
  
  body.innerHTML = `
    <div style="margin-bottom:16px">
      <input type="text" id="atIndSearch" placeholder="🔍 Rechercher un indicateur..." 
        style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(184,150,78,0.2);
        color:var(--cream);padding:8px 12px;border-radius:6px;outline:none"
        oninput="atFilterInds(this.value)">
    </div>
    <div id="atIndResults">${atRenderIndCatalog()}</div>
  `;
  
  modal.classList.add('open');
  setTimeout(() => document.getElementById('atIndSearch')?.focus(), 100);
}

function atRenderIndCatalog(filter = '') {
  const f = filter.toLowerCase();
  return IND_CATALOG.map(cat => {
    const items = cat.items.filter(it => 
      it.name.toLowerCase().includes(f) || it.desc.toLowerCase().includes(f)
    );
    if (!items.length && f) return '';
    
    return `
      <div class="at-ind-cat">${cat.cat}</div>
      ${items.map(item => {
        const isOn = AT.activeInds[item.key]?.on;
        const pKey = item.key.replace(/\d+/g, '');
        const hasParams = IND_PARAMS[pKey];
        const currentPeriod = atGetIndParam(item.key, 'period');
        
        return `
          <div class="at-ind-choice ${isOn ? 'sel' : ''}" data-key="${item.key}">
            <div style="display:flex;align-items:center;gap:10px;flex:1">
              <div class="at-ind-choice-dot" style="background:${AT.activeInds[item.key]?.color||'var(--dim)'}"></div>
              <div>
                <div class="at-ind-choice-name">${item.name}</div>
                <div class="at-ind-choice-desc">${item.desc}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${isOn && hasParams ? `
                <div class="at-ind-param" onclick="event.stopPropagation()">
                  <label>Période</label>
                  <input type="number" value="${currentPeriod}" 
                    min="${hasParams.min}" max="${hasParams.max}"
                    onchange="atSetIndParam('${item.key}', 'period', this.value)">
                </div>
              ` : ''}
              <div class="at-ind-toggle ${isOn ? 'on' : ''}" onclick="atToggleInd('${item.key}')">
                ${isOn ? '✓' : '+'}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }).join('');
}

function atFilterInds(q) {
  document.getElementById('atIndResults').innerHTML = atRenderIndCatalog(q);
}

// ── Mise à jour du rendu des valeurs actives ──
function atUpdateActiveInds(closes, highs, lows, vols) {
  const el = document.getElementById('atActiveInds'); if (!el) return;
  const inds = AT.activeInds;
  const n = closes.length;
  
  // Calculs dynamiques selon les paramètres utilisateur
  const vals = {};
  if (inds.sma20.on) vals.sma20 = atSMA(closes, atGetIndParam('sma20', 'period'))[n-1];
  if (inds.sma50.on) vals.sma50 = atSMA(closes, atGetIndParam('sma50', 'period'))[n-1];
  if (inds.ema12.on) vals.ema12 = atEMA(closes, atGetIndParam('ema12', 'period'))[n-1];
  if (inds.rsi.on) vals.rsi = atRSI(closes, atGetIndParam('rsi', 'period'))[n-1];
  
  el.innerHTML = Object.entries(inds).filter(([,v])=>v.on).map(([k,v])=>{
    const val = vals[k] != null ? fmt(vals[k]) : '—';
    const period = atGetIndParam(k, 'period');
    const label = period ? `${v.label.replace(/\d+/, '')}${period}` : v.label;
    return `<div class="at-ind-item">
      <div class="at-ind-dot" style="background:${v.color}"></div>
      <span class="at-ind-name">${label}</span>
      <span class="at-ind-val" style="color:${v.color}">${val}</span>
      <span class="at-ind-rm" onclick="atRemoveInd('${k}')">✕</span>
    </div>`;
  }).join('');
}
