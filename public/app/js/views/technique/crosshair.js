// ═══════════════════════════════════════
// CROSSHAIR (CORRIGE — garde anti-double + utilise window.AT)
// ═══════════════════════════════════════
if (window.__crosshairLoaded) {
  console.warn('[CROSSHAIR] Deja charge, skip.');
} else {
  window.__crosshairLoaded = true;

  function atInitCrosshair() {
    const canvas = document.getElementById('atCanvas');
    const overlay = document.getElementById('atOverlay');
    if (!canvas || !overlay) return;

    const ctx = overlay.getContext('2d');
    const mainEl = document.getElementById('atMain') || document.getElementById('main') || document.querySelector('main');
    if (!mainEl) {
      console.error('[CROSSHAIR] mainEl introuvable');
      return;
    }

    const rect = mainEl.getBoundingClientRect();

    overlay.addEventListener('mousemove', e => {
      const AT = window.AT;
      if (!AT) return;

      AT._mouseX = e.clientX - rect.left;
      AT._mouseY = e.clientY - rect.top;

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // Lignes de crosshair
      ctx.strokeStyle = 'rgba(184,150,78,0.3)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(AT._mouseX, 0);
      ctx.lineTo(AT._mouseX, overlay.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, AT._mouseY);
      ctx.lineTo(overlay.width, AT._mouseY);
      ctx.stroke();

      ctx.setLineDash([]);

      // Preview des dessins
      atDrawPreview(ctx, overlay.width, overlay.height);
    });

    overlay.addEventListener('mouseleave', () => {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    });
  }
  window.atInitCrosshair = atInitCrosshair;

  function atDrawPreview(ctx, W, H) {
    const AT = window.AT;
    if (!AT || AT.drawMode === 'cursor') return;

    const mx = AT._mouseX, my = AT._mouseY;
    if (mx == null) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(184,150,78,0.4)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;

    if (AT.drawMode === 'hline') {
      ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
      ctx.fillStyle = '#B8964E'; ctx.fillText('S/R', 6, my - 4);
    } else if (AT.drawMode === 'trend' && AT.trendPts.length === 1) {
      const p1 = AT.trendPts[0];
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(mx, my); ctx.stroke();
    } else if (AT.drawMode === 'rect' && AT.rectPts.length === 1) {
      const p1 = AT.rectPts[0];
      ctx.strokeRect(p1.x, p1.y, mx - p1.x, my - p1.y);
    } else if (AT.drawMode === 'fib' && AT.trendPts.length === 1) {
      const p1 = AT.trendPts[0];
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(mx, my); ctx.stroke();
    }

    ctx.restore();
  }
  window.atDrawPreview = atDrawPreview;
}
