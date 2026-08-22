// THE CAPITAL, Crosshair + outils de dessin tactiles
// UI locale uniquement : aucune API, donnée ou source métier modifiée.
if (window.__crosshairLoaded) {
  console.warn('[CROSSHAIR] Déjà chargé, skip.');
} else {
  window.__crosshairLoaded = true;

  function atInitCrosshair() {
    const overlay = document.getElementById('atOverlay');
    if (!overlay) return;
    if (overlay.dataset.atPointerReady === '1') return;
    overlay.dataset.atPointerReady = '1';
    overlay.style.touchAction = 'none';
    overlay.style.userSelect = 'none';
    overlay.style.webkitUserSelect = 'none';
    overlay.style.webkitTouchCallout = 'none';

    const ctx = overlay.getContext('2d');
    const pos = e => {
      const r = overlay.getBoundingClientRect();
      const sx = overlay.width / Math.max(1, r.width);
      const sy = overlay.height / Math.max(1, r.height);
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    };
    const norm = p => ({ x: Math.max(0, Math.min(1, p.x / Math.max(1, overlay.width))), y: Math.max(0, Math.min(1, p.y / Math.max(1, overlay.height))) });

    function repaint() {
      const AT = window.AT;
      if (!AT) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      atDrawStored(ctx, overlay.width, overlay.height);
      if (AT._mouseX != null && AT._mouseY != null && AT.drawMode !== 'cursor') atDrawPreview(ctx, overlay.width, overlay.height);
    }

    function updatePointer(e) {
      const p = pos(e); const AT = window.AT;
      if (!AT) return;
      AT._mouseX = p.x; AT._mouseY = p.y;
      repaint();
    }

    overlay.addEventListener('pointermove', updatePointer, { passive: true });
    overlay.addEventListener('pointerleave', () => {
      const AT = window.AT;
      if (AT) { AT._mouseX = null; AT._mouseY = null; }
      repaint();
    });

    overlay.addEventListener('pointerdown', e => {
      const AT = window.AT;
      if (!AT || AT.drawMode === 'cursor') return;
      e.preventDefault();
      e.stopPropagation();
      try { overlay.setPointerCapture(e.pointerId); } catch (_) {}
      const p = pos(e), n = norm(p), mode = AT.drawMode;

      if (mode === 'hline') {
        AT.draws.push({ type:'hline', p1:n });
        repaint(); atRender();
        if (typeof atSetDraw === 'function') atSetDraw('cursor');
        return;
      }
      if (mode === 'text') {
        const text = window.prompt('Annotation :', '');
        if (text) AT.draws.push({ type:'text', p1:n, text:text.slice(0,120) });
        repaint(); atRender();
        if (typeof atSetDraw === 'function') atSetDraw('cursor');
        return;
      }

      const target = mode === 'rect' ? AT.rectPts : (mode === 'trend' || mode === 'fib' || mode === 'channel' || mode === 'pitch' ? AT.trendPts : null);
      if (!target) return;
      target.push(n);
      const required = mode === 'pitch' || mode === 'channel' ? 3 : 2;
      if (target.length < required) { repaint(); return; }

      if (mode === 'rect') AT.draws.push({ type:'rect', p1:target[0], p2:target[1] });
      if (mode === 'trend') AT.draws.push({ type:'trend', p1:target[0], p2:target[1] });
      if (mode === 'fib') AT.draws.push({ type:'fib', p1:target[0], p2:target[1] });
      if (mode === 'channel') AT.draws.push({ type:'channel', p1:target[0], p2:target[1], p3:target[2] });
      if (mode === 'pitch') AT.draws.push({ type:'pitch', p1:target[0], p2:target[1], p3:target[2] });
      AT.trendPts = []; AT.channelPts = []; AT.rectPts = [];
      repaint(); atRender();
      if (typeof atSetDraw === 'function') atSetDraw('cursor');
    }, { passive: false });

    overlay.addEventListener('pointerup', e => { try { overlay.releasePointerCapture(e.pointerId); } catch (_) {} });
    window.addEventListener('resize', repaint, { passive: true });
    repaint();
  }
  window.atInitCrosshair = atInitCrosshair;

  function atDrawStored(ctx, W, H) {
    const AT = window.AT;
    if (!AT || !Array.isArray(AT.draws)) return;
    const xy = p => ({ x:p.x*W, y:p.y*H });
    ctx.save(); ctx.strokeStyle='#B8964E'; ctx.fillStyle='rgba(184,150,78,.12)'; ctx.lineWidth=1.5; ctx.setLineDash([]);
    AT.draws.forEach(d => {
      const a=xy(d.p1), b=d.p2?xy(d.p2):null, c=d.p3?xy(d.p3):null;
      if(d.type==='hline'){ctx.beginPath();ctx.moveTo(0,a.y);ctx.lineTo(W,a.y);ctx.stroke();}
      else if(d.type==='trend'&&b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
      else if(d.type==='rect'&&b){ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);}
      else if(d.type==='channel'&&b&&c){const dx=b.x-a.x,dy=b.y-a.y;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(c.x+dx,c.y+dy);ctx.stroke();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke();}
      else if(d.type==='fib'&&b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();[0,.236,.382,.5,.618,.786,1].forEach(level=>{const y=a.y+(b.y-a.y)*level;ctx.globalAlpha=.72;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle='#B8964E';ctx.fillText((level*100).toFixed(1)+'%',6,y-3);});}
      else if(d.type==='pitch'&&b&&c){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke();const mx=(b.x+c.x)/2,my=(b.y+c.y)/2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(mx,my);ctx.stroke();}
      else if(d.type==='text'){ctx.fillStyle='#B8964E';ctx.font='600 12px DM Sans, sans-serif';ctx.fillText(d.text||'',a.x,a.y);}
    });
    ctx.restore();
  }
  window.atDrawStored = atDrawStored;

  function atDrawPreview(ctx, W, H) {
    const AT=window.AT;if(!AT||AT.drawMode==='cursor'||AT._mouseX==null)return;
    const mx=AT._mouseX,my=AT._mouseY,p=arr=>({x:arr.x*W,y:arr.y*H}),pts=AT.drawMode==='rect'?AT.rectPts:AT.trendPts;
    ctx.save();ctx.strokeStyle='rgba(184,150,78,.65)';ctx.setLineDash([5,4]);ctx.lineWidth=1.5;
    if(AT.drawMode==='hline'){ctx.beginPath();ctx.moveTo(0,my);ctx.lineTo(W,my);ctx.stroke();}
    else if(pts?.length===1){const a=p(pts[0]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(mx,my);ctx.stroke();}
    else if(pts?.length===2&&(AT.drawMode==='pitch'||AT.drawMode==='channel')){const a=p(pts[0]),b=p(pts[1]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(mx,my);ctx.stroke();}
    ctx.restore();
  }
  window.atDrawPreview=atDrawPreview;
}
