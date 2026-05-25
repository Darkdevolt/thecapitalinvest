// ═══════════════════════════════════════
// AT — Drawing Tools
// ═══════════════════════════════════════

// ── Dessin ──
function atRenderDraw(ctx, draw, scX, scY, W, H) {
  ctx.save();
  if (draw.type === 'hline') {
    ctx.strokeStyle='rgba(201,168,76,0.8)'; ctx.lineWidth=1; ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(0,scY(draw.price)); ctx.lineTo(W-52,scY(draw.price)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(201,168,76,0.8)'; ctx.font='9px DM Mono'; ctx.fillText('S/R '+fmt(draw.price,2), 6, scY(draw.price)-3);
  } else if (draw.type === 'trend' && draw.pts && draw.pts.length === 2) {
    ctx.strokeStyle='rgba(96,165,250,0.85)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(scX(draw.pts[0].i), scY(draw.pts[0].p)); ctx.lineTo(scX(draw.pts[1].i), scY(draw.pts[1].p)); ctx.stroke();
  } else if (draw.type === 'channel' && draw.pts && draw.pts.length === 3) {
    const [p1,p2,p3] = draw.pts;
    const dy = scY(p3.p) - scY(p2.p);
    ctx.strokeStyle='rgba(96,165,250,0.6)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(scX(p1.i),scY(p1.p)); ctx.lineTo(scX(p2.i),scY(p2.p)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(scX(p1.i),scY(p1.p)+dy); ctx.lineTo(scX(p2.i),scY(p2.p)+dy); ctx.stroke();
  } else if (draw.type === 'rect' && draw.pts && draw.pts.length === 2) {
    const x1=scX(draw.pts[0].i), x2=scX(draw.pts[1].i);
    const y1=scY(draw.pts[0].p), y2=scY(draw.pts[1].p);
    ctx.fillStyle='rgba(184,150,78,0.06)'; ctx.strokeStyle='rgba(184,150,78,0.4)'; ctx.lineWidth=1;
    ctx.fillRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));
    ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));
  } else if (draw.type === 'fib' && draw.pts && draw.pts.length === 2) {
    const lo=Math.min(draw.pts[0].p,draw.pts[1].p), hi=Math.max(draw.pts[0].p,draw.pts[1].p), rng=hi-lo;
    [[0,'rgba(74,222,128,0.7)'],[0.236,'rgba(245,240,232,0.4)'],[0.382,'rgba(245,240,232,0.4)'],[0.5,'rgba(201,168,76,0.6)'],[0.618,'rgba(245,240,232,0.4)'],[0.786,'rgba(245,240,232,0.3)'],[1,'rgba(248,113,113,0.7)']].forEach(([l,col])=>{
      const price=lo+rng*(1-l);
      ctx.strokeStyle=col; ctx.lineWidth=l===0||l===1?1.5:0.8; ctx.setLineDash(l===0||l===1?[]:[3,5]);
      ctx.beginPath(); ctx.moveTo(0,scY(price)); ctx.lineTo(W-52,scY(price)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=col; ctx.font='9px DM Mono'; ctx.fillText((l*100).toFixed(1)+'% '+fmt(price,2), 6, scY(price)-3);
    });
  } else if (draw.type === 'text' && draw.pt) {
    ctx.fillStyle='rgba(201,168,76,0.9)'; ctx.font='11px DM Sans';
    ctx.fillText(draw.text||'Note', scX(draw.pt.i), scY(draw.pt.p));
  } else if (draw.type === 'pitch' && draw.pts && draw.pts.length === 3) {
    const [p1,p2,p3]=draw.pts;
    const mx=(scX(p2.i)+scX(p3.i))/2, my=(scY(p2.p)+scY(p3.p))/2;
    ctx.strokeStyle='rgba(167,139,250,0.7)'; ctx.lineWidth=1;
    [[scX(p1.i),scY(p1.p),mx,my],[scX(p1.i),scY(p1.p),scX(p2.i),scY(p2.p)],[scX(p1.i),scY(p1.p),scX(p3.i),scY(p3.p)]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2+(x2-x1)*2,y2+(y2-y1)*2); ctx.stroke();
    });
  }
  ctx.restore();
}
