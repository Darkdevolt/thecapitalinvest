// ═══════════════════════════════════════
// AT — Crosshair & Tooltip
// ═══════════════════════════════════════

// ── Init AT ──
function atInit() {
  // Peupler le select ticker
  const byTicker = {};
  allCours.forEach(c => { if(!byTicker[c.ticker]) byTicker[c.ticker]=c; });
  const tickers = Object.keys(byTicker).sort();
  const sel = document.getElementById('atTicker');
  if(sel) sel.innerHTML='<option value="">Ticker...</option>'+tickers.map(t=>`<option value="${t}">${t}</option>`).join('');
  atInitCrosshair();
  atUpdateWatchlist();
  // Observer redimensionnement
  const ro = new ResizeObserver(() => { if(AT.hist.length) atRender(); });
  const wrap = document.getElementById('atWrap');
  if(wrap) ro.observe(wrap);
}
