// ═══════════════════════════════════════
// AT — Watchlist, Axes & Legend
// ═══════════════════════════════════════

// ── Watchlist ──
function atUpdateWatchlist() {
  const el = document.getElementById('atWatchlist'); if (!el) return;
  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });
  el.innerHTML = Object.values(byTicker).sort((a,b)=>(a.ticker||'').localeCompare(b.ticker||'')).map(c => {
    const v = parseFloat(c.variation);
    const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'dim';
    const active = c.ticker === AT.ticker ? 'at-wl-active' : '';
    return `<div class="at-wl-item ${active}" onclick="document.getElementById('atTicker').value='${c.ticker}';atLoadTicker()">
      <span class="at-wl-ticker">${c.ticker}</span>
      <div style="text-align:right">
        <div class="at-wl-price" style="color:${v>0?'var(--green)':v<0?'var(--red)':'var(--dim)'}">${fmt(c.cours)}</div>
        <div class="at-wl-chg" style="color:${v>0?'var(--green)':v<0?'var(--red)':'var(--dim)'}">${v>0?'▲':v<0?'▼':'='} ${Math.abs(v).toFixed(2)}%</div>
      </div>
    </div>`;
  }).join('');
}

function atUpdateIndexBar() {
  const latest = allIndices[0];
  const prev = allIndices[1];
  if (latest && prev) {
    const chgComp = ((latest.brvm_composite - prev.brvm_composite) / prev.brvm_composite * 100).toFixed(2);
    const chg30 = ((latest.brvm_30 - prev.brvm_30) / prev.brvm_30 * 100).toFixed(2);
    document.getElementById('atIdxComp').innerHTML = `${fmt(latest.brvm_composite,2)} <span style="color:${chgComp>=0?'var(--green)':'var(--red)'}">${chgComp>=0?'▲':'▼'}${Math.abs(chgComp)}%</span>`;
    document.getElementById('atIdx30').innerHTML = `${fmt(latest.brvm_30,2)} <span style="color:${chg30>=0?'var(--green)':'var(--red)'}">${chg30>=0?'▲':'▼'}${Math.abs(chg30)}%</span>`;
  }
  document.getElementById('atBBTime').textContent = new Date().toLocaleTimeString('fr-FR') + ' GMT';
}

// ── Axes ──
function atDrawAxisY(minP, maxP) {
  const el = document.getElementById('atAxisY'); if (!el) return;
  const steps = 6;
  el.innerHTML = Array.from({length: steps+1}, (_, i) => {
    const v = minP + (maxP - minP) * (1 - i/steps);
    return `<span>${fmt(v)}</span>`;
  }).join('');
}
function atDrawAxisX(data) {
  const el = document.getElementById('atAxisX'); if (!el) return;
  const n = data.length; const steps = Math.min(8, n);
  el.innerHTML = Array.from({length: steps}, (_, i) => {
    const idx = Math.round(i * (n-1) / (steps-1));
    return `<span>${atFmtDate(data[idx]?.date, AT.interval)}</span>`;
  }).join('');
}

// ── Légende ──
function atDrawLegend(closes, highs, lows, vols) {
  const el = document.getElementById('atLegend'); if (!el) return;
  const inds = AT.activeInds;
  const items = [{ color: 'var(--gold)', label: AT.ticker || '—' }];
  const maConf = [['sma20',atSMA(closes,20)],['sma50',atSMA(closes,50)],['sma200',atSMA(closes,200)],['ema12',atEMA(closes,12)],['ema26',atEMA(closes,26)]];
  maConf.forEach(([k,vals]) => { if(inds[k].on) { const v=vals[vals.length-1]; if(v) items.push({color:inds[k].color, label:`${inds[k].label}: ${fmt(v)}`}); }});
  if (inds.bb.on) { const bb=atBB(closes); const b=bb[bb.length-1]; if(b.upper) items.push({color:'rgba(184,150,78,0.6)',label:`BB: ${fmt(b.lower)}–${fmt(b.upper)}`}); }
  if (inds.vwap.on) { const vw=atVWAP(closes,vols); items.push({color:'#e879f9',label:`VWAP: ${fmt(vw[vw.length-1])}`}); }
  if (AT.compareTicker) items.push({color:'rgba(96,165,250,0.7)', label:AT.compareTicker});
  el.innerHTML = items.map(it => `<div class="at-leg-item"><div class="at-leg-dot" style="background:${it.color}"></div>${it.label}</div>`).join('');
}
