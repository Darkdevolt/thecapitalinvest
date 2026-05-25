// ═══════════════════════════════════════
// AT — Zoom & Pan
// ═══════════════════════════════════════

// ── Resize panneaux (drag) ──
let _resizing = null;
function atStartResize(e, id) {
  _resizing = { id, startY: e.clientY, startH: document.getElementById(id).clientHeight };
  document.addEventListener('mousemove', _atOnResize);
  document.addEventListener('mouseup', _atStopResize);
  e.preventDefault();
}
function _atOnResize(e) {
  if (!_resizing) return;
  const el = document.getElementById(_resizing.id);
  const newH = Math.max(50, Math.min(200, _resizing.startH + (e.clientY - _resizing.startY)));
  el.style.height = newH + 'px';
  atRender();
}
function _atStopResize() { _resizing = null; document.removeEventListener('mousemove', _atOnResize); document.removeEventListener('mouseup', _atStopResize); }

// ── Crosshair + tooltip ──
function atInitCrosshair() {
  const mainEl = document.getElementById('atMainChart');
  const tooltip = document.getElementById('atTooltip');
  const overlay = document.getElementById('cvOverlay');
  if (!mainEl || !overlay) return;

  mainEl.addEventListener('mousemove', e => {
    const rect = mainEl.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const W = mainEl.clientWidth, H = mainEl.clientHeight, right = 52;
    const Wr = W - right;
    const data = atVisibleData(); if (!data.length) return;
    const n = data.length;
    const idx = Math.max(0, Math.min(n-1, Math.round((mx / Wr) * (n-1))));
    const d = data[idx]; if (!d) return;
    const closes = data.map(d=>d.c), highs=data.map(d=>d.h), lows=data.map(d=>d.l);
    const minP = Math.min(...lows)*0.99, maxP = Math.max(...highs)*1.01;
    const scX = i => (i/(n-1||1))*Wr*0.99 + Wr*0.005;
    const scY = v => H - ((v-minP)/(maxP-minP))*H;
    const liveC = d.c;

    // Draw overlay crosshair
    const dpr = window.devicePixelRatio||1;
    overlay.width = W*dpr; overlay.height = H*dpr;
    overlay.style.width=W+'px'; overlay.style.height=H+'px';
    const ctx = overlay.getContext('2d');
    ctx.save(); ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(184,150,78,0.25)'; ctx.lineWidth=0.5;
    const cx = scX(idx);
    ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,my); ctx.lineTo(Wr,my); ctx.stroke();
    // Dot on price
    ctx.fillStyle='var(--gold)'; ctx.beginPath(); ctx.arc(cx,scY(liveC),3,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Tooltip
    const priceAtMouse = minP + ((H-my)/H)*(maxP-minP);
    tooltip.style.display='block';
    const tx = mx > W*0.6 ? mx-160 : mx+12;
    const ty = my > H*0.7 ? my-110 : my+12;
    tooltip.style.left=tx+'px'; tooltip.style.top=ty+'px';
    const rsi = atRSI(closes); const bb=atBB(closes);
    tooltip.innerHTML = `<div style="color:var(--gold);margin-bottom:4px;font-weight:600">${d.date ? atFmtDate(d.date,AT.interval) : '—'}</div>
      <div>O <span style="color:var(--cream)">${fmt(d.o)}</span></div>
      <div>H <span style="color:var(--green)">${fmt(d.h)}</span></div>
      <div>L <span style="color:var(--red)">${fmt(d.l)}</span></div>
      <div>C <span style="color:var(--cream)">${fmt(d.c)}</span></div>
      <div>Vol <span style="color:var(--dim)">${fmt(d.v)}</span></div>
      ${rsi[idx]!=null?`<div style="margin-top:4px;border-top:1px solid rgba(184,150,78,0.15);padding-top:4px">RSI <span style="color:#fb923c">${rsi[idx].toFixed(1)}</span></div>`:''}
      ${bb[idx]?.upper?`<div>BB <span style="color:rgba(184,150,78,0.7)">${fmt(bb[idx].lower)}–${fmt(bb[idx].upper)}</span></div>`:''}`;

    // Update OHLCV bar with hovered candle
    document.getElementById('atO').textContent=fmt(d.o);
    document.getElementById('atH').textContent=fmt(d.h);
    document.getElementById('atL').textContent=fmt(d.l);
    document.getElementById('atC').textContent=fmt(d.c);
    document.getElementById('atC').style.color=d.c>=d.o?'var(--green)':'var(--red)';
    document.getElementById('atV').textContent=fmt(d.v);
    document.getElementById('atLastUpdate').textContent=atFmtDate(d.date,AT.interval);
  });

  mainEl.addEventListener('mouseleave', () => {
    tooltip.style.display='none';
    const ctx=overlay.getContext('2d'); ctx.clearRect(0,0,overlay.width,overlay.height);
  });

  // Click pour dessiner
  mainEl.addEventListener('click', e => {
    if (AT.drawMode === 'cursor') return;
    const rect = mainEl.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    const W=mainEl.clientWidth, H=mainEl.clientHeight, right=52;
    const data = atVisibleData(); if(!data.length) return;
    const n=data.length;
    const idx = Math.max(0,Math.min(n-1,Math.round((mx/(W-right))*(n-1))));
    const minP=Math.min(...data.map(d=>d.l))*0.99, maxP=Math.max(...data.map(d=>d.h))*1.01;
    const price = minP+((H-my)/H)*(maxP-minP);
    const pt = { i: idx, p: price };

    if (AT.drawMode === 'hline') {
      AT.draws.push({ type:'hline', price }); atSetDraw('cursor'); atRender();
    } else if (AT.drawMode === 'trend') {
      AT.trendPts.push(pt);
      if (AT.trendPts.length===2) { AT.draws.push({type:'trend',pts:[...AT.trendPts]}); AT.trendPts=[]; atSetDraw('cursor'); atRender(); }
      else { document.getElementById('atDrawStatus').textContent='Cliquez le point 2 de la tendance'; }
    } else if (AT.drawMode === 'channel') {
      AT.channelPts.push(pt);
      if (AT.channelPts.length===3) { AT.draws.push({type:'channel',pts:[...AT.channelPts]}); AT.channelPts=[]; atSetDraw('cursor'); atRender(); }
      else { document.getElementById('atDrawStatus').textContent=`Point ${AT.channelPts.length+1}/3`; }
    } else if (AT.drawMode === 'rect') {
      AT.rectPts.push(pt);
      if (AT.rectPts.length===2) { AT.draws.push({type:'rect',pts:[...AT.rectPts]}); AT.rectPts=[]; atSetDraw('cursor'); atRender(); }
      else { document.getElementById('atDrawStatus').textContent='Cliquez le coin opposé'; }
    } else if (AT.drawMode === 'fib') {
      AT.trendPts.push(pt);
      if (AT.trendPts.length===2) { AT.draws.push({type:'fib',pts:[...AT.trendPts]}); AT.trendPts=[]; atSetDraw('cursor'); atRender(); }
      else { document.getElementById('atDrawStatus').textContent='Cliquez le haut du retracement'; }
    } else if (AT.drawMode === 'pitch') {
      AT.trendPts.push(pt);
      if (AT.trendPts.length===3) { AT.draws.push({type:'pitch',pts:[...AT.trendPts]}); AT.trendPts=[]; atSetDraw('cursor'); atRender(); }
      else { document.getElementById('atDrawStatus').textContent=`Point ${AT.trendPts.length+1}/3 du pitchfork`; }
    } else if (AT.drawMode === 'text') {
      const txt = prompt('Texte de l\'annotation :');
      if (txt) { AT.draws.push({type:'text',pt,text:txt}); }
      atSetDraw('cursor'); atRender();
    }
  });

  // Zoom molette
  mainEl.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.1 : -0.1;
    const rect = mainEl.getBoundingClientRect();
    const ratio = (e.clientX-rect.left) / rect.width;
    const rng = AT.zoom.end - AT.zoom.start;
    const newRng = Math.max(0.05, Math.min(1, rng*(1+delta)));
    const center = AT.zoom.start + rng*ratio;
    AT.zoom.start = Math.max(0, center - newRng*ratio);
    AT.zoom.end = Math.min(1, AT.zoom.start + newRng);
    atRender();
  }, { passive: false });

  // Pan
  mainEl.addEventListener('mousedown', e => {
    if (AT.drawMode !== 'cursor') return;
    AT.panning = true; AT.panStart = e.clientX;
    AT.panZoomStart = { ...AT.zoom };
    mainEl.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', e => {
    if (!AT.panning) return;
    const dx = e.clientX - AT.panStart;
    const W = mainEl.clientWidth;
    const shift = (dx / W) * (AT.panZoomStart.end - AT.panZoomStart.start) * -1;
    let ns = AT.panZoomStart.start + shift, ne = AT.panZoomStart.end + shift;
    if (ns < 0) { ne -= ns; ns = 0; }
    if (ne > 1) { ns -= (ne-1); ne = 1; }
    AT.zoom = { start: Math.max(0,ns), end: Math.min(1,ne) };
    atRender();
  });
  document.addEventListener('mouseup', () => {
    if (AT.panning) { AT.panning=false; document.getElementById('atMainChart').style.cursor='crosshair'; }
  });
}
