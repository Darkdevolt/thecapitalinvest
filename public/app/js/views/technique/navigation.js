// ═══════════════════════════════════════
// AT — Smooth Navigation
// ═══════════════════════════════════════

function atInitNavigation() {
  const nav = document.createElement('div');
  nav.id = 'atNavBar';
  nav.innerHTML = `
    <div class="at-nav-group">
      <button class="at-nav-btn" onclick="atZoomIn()" title="Zoomer">🔍+</button>
      <button class="at-nav-btn" onclick="atZoomOut()" title="Dézoomer">🔍-</button>
      <button class="at-nav-btn" onclick="atZoomReset()" title="Reset">⌂</button>
    </div>
    <div class="at-nav-sep"></div>
    <div class="at-nav-group">
      <button class="at-nav-btn" onclick="atPanLeft()" title="← Gauche">◀</button>
      <button class="at-nav-btn" onclick="atPanRight()" title="Droite →">▶</button>
    </div>
    <div class="at-nav-sep"></div>
    <div class="at-nav-group">
      <button class="at-nav-btn" onclick="atGoToEnd()" title="Dernier cours">▶|</button>
    </div>
  `;
  nav.style.cssText = `
    position:absolute; bottom:12px; left:50%; transform:translateX(-50%);
    display:flex; gap:4px; background:rgba(10,8,4,0.85);
    border:1px solid rgba(184,150,78,0.2); border-radius:10px;
    padding:6px; z-index:50; backdrop-filter:blur(8px);
  `;
  document.getElementById('atMainChart')?.appendChild(nav);
}

function atZoomIn() {
  const rng = AT.zoom.end - AT.zoom.start;
  const newRng = Math.max(0.05, rng * 0.8);
  const center = (AT.zoom.start + AT.zoom.end) / 2;
  AT.zoom.start = Math.max(0, center - newRng/2);
  AT.zoom.end = Math.min(1, center + newRng/2);
  atRender();
}

function atZoomOut() {
  const rng = AT.zoom.end - AT.zoom.start;
  const newRng = Math.min(1, rng * 1.25);
  const center = (AT.zoom.start + AT.zoom.end) / 2;
  AT.zoom.start = Math.max(0, center - newRng/2);
  AT.zoom.end = Math.min(1, center + newRng/2);
  atRender();
}

function atZoomReset() {
  AT.zoom = { start: 0, end: 1 };
  atRender();
}

function atPanLeft() {
  const rng = AT.zoom.end - AT.zoom.start;
  const shift = rng * 0.2;
  if (AT.zoom.start > 0) {
    AT.zoom.start = Math.max(0, AT.zoom.start - shift);
    AT.zoom.end = AT.zoom.start + rng;
    atRender();
  }
}

function atPanRight() {
  const rng = AT.zoom.end - AT.zoom.start;
  const shift = rng * 0.2;
  if (AT.zoom.end < 1) {
    AT.zoom.end = Math.min(1, AT.zoom.end + shift);
    AT.zoom.start = AT.zoom.end - rng;
    atRender();
  }
}

function atGoToEnd() {
  const rng = AT.zoom.end - AT.zoom.start;
  AT.zoom.end = 1;
  AT.zoom.start = 1 - rng;
  atRender();
}

// ── Animation de transition entre tickers ──
function atTransitionRender() {
  const wrap = document.getElementById('atWrap');
  if (wrap) {
    wrap.style.opacity = '0.5';
    wrap.style.transform = 'scale(0.99)';
    setTimeout(() => {
      atRender();
      wrap.style.opacity = '1';
      wrap.style.transform = 'scale(1)';
    }, 150);
  } else {
    atRender();
  }
}
