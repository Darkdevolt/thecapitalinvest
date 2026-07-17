// ═══════════════════════════════════════
// ZOOM (CORRIGE — garde anti-double + utilise window.AT)
// ═══════════════════════════════════════
if (window.__zoomLoaded) {
  console.warn('[ZOOM] Deja charge, skip.');
} else {
  window.__zoomLoaded = true;

  let _resizing = false;

  function atInitZoom() {
    const canvas = document.getElementById('atCanvas');
    if (!canvas) return;

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const AT = window.AT;
      if (!AT) return;

      const delta = e.deltaY > 0 ? 0.05 : -0.05;
      const range = AT.zoom.end - AT.zoom.start;

      if (delta > 0 && range <= 0.1) return; // Zoom max atteint
      if (delta < 0 && range >= 1) return;   // Zoom min atteint

      const center = (AT.zoom.start + AT.zoom.end) / 2;
      let newRange = Math.max(0.05, Math.min(1, range + delta));

      AT.zoom.start = Math.max(0, center - newRange / 2);
      AT.zoom.end = Math.min(1, center + newRange / 2);

      atRender();
    }, { passive: false });
  }
  window.atInitZoom = atInitZoom;

  function atInitNav() {
    const AT = window.AT;
    if (!AT) return;

    const wrap = document.getElementById('atWrap');
    if (!wrap) return;

    let isPanning = false;
    let startX = 0;
    let startZoom = null;

    wrap.addEventListener('mousedown', e => {
      if (e.button !== 0 || AT.drawMode !== 'cursor') return;
      isPanning = true;
      startX = e.clientX;
      startZoom = { ...AT.zoom };
      wrap.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', e => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const range = startZoom.end - startZoom.start;
      const shift = (dx / wrap.offsetWidth) * range;

      AT.zoom.start = Math.max(0, startZoom.start - shift);
      AT.zoom.end = Math.min(1, startZoom.end - shift);

      if (AT.zoom.end - AT.zoom.start < range) {
        AT.zoom.start = AT.zoom.end - range;
      }

      atRender();
    });

    document.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        wrap.style.cursor = 'crosshair';
      }
    });
  }
  window.atInitNav = atInitNav;
}
