// Ajouter dans crosshair.js — dans le mousemove de l'overlay :

function atDrawPreview(ctx, W, H, scX, scY) {
  if (AT.drawMode === 'cursor') return;
  
  // Récupérer la position actuelle de la souris depuis une variable globale temporaire
  const mx = AT._mouseX, my = AT._mouseY;
  if (mx == null) return;
  
  ctx.save();
  ctx.strokeStyle = 'rgba(184,150,78,0.4)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  
  if (AT.drawMode === 'hline') {
    ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W-52, my); ctx.stroke();
    ctx.fillStyle = 'var(--gold)'; ctx.fillText('S/R', 6, my - 4);
  } else if (AT.drawMode === 'trend' && AT.trendPts.length === 1) {
    const p1 = AT.trendPts[0];
    ctx.beginPath(); ctx.moveTo(scX(p1.i), scY(p1.p)); ctx.lineTo(mx, my); ctx.stroke();
  } else if (AT.drawMode === 'rect' && AT.rectPts.length === 1) {
    const p1 = AT.rectPts[0];
    ctx.strokeRect(scX(p1.i), scY(p1.p), mx - scX(p1.i), my - scY(p1.p));
  } else if (AT.drawMode === 'fib' && AT.trendPts.length === 1) {
    const p1 = AT.trendPts[0];
    ctx.beginPath(); ctx.moveTo(scX(p1.i), scY(p1.p)); ctx.lineTo(mx, my); ctx.stroke();
  }
  
  ctx.restore();
}

// Puis dans atInitCrosshair, ajouter :
mainEl.addEventListener('mousemove', e => {
  AT._mouseX = e.clientX - rect.left;
  AT._mouseY = e.clientY - rect.top;
  // ... existing code ...
  // Après le clearRect du overlay, ajouter :
  atDrawPreview(ctx, W, H, scX, scY);
});
