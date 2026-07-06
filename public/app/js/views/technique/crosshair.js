// ═══════════════════════════════════════════════════════════════════════════
// AT — Crosshair, Tooltip, Preview de dessin & Interactions ameliorees
// REMPLACE completement le fichier crosshair.js existant
// ═══════════════════════════════════════════════════════════════════════════

// ── Variables globales pour la preview ──
AT._mouseX = null;
AT._mouseY = null;
AT._previewDraw = null; // Dessin en cours de preview

// ═══════════════════════════════════════
// INIT CROSSHAIR + TOOLTIP + PREVIEW
// ═══════════════════════════════════════
function atInitCrosshair() {
  const mainEl = document.getElementById('atMainChart');
  const tooltip = document.getElementById('atTooltip');
  const overlay = document.getElementById('cvOverlay');
  if (!mainEl || !overlay) return;

  // ── MOUSEMOVE : Crosshair + Tooltip + Preview ──
  mainEl.addEventListener('mousemove', e => {
    const rect = mainEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Stocker pour la preview
    AT._mouseX = mx;
    AT._mouseY = my;

    const W = mainEl.clientWidth;
    const H = mainEl.clientHeight;
    const right = 52;
    const Wr = W - right;

    const data = atVisibleData();
    if (!data.length) return;

    const n = data.length;
    const idx = Math.max(0, Math.min(n - 1, Math.round((mx / Wr) * (n - 1))));
    const d = data[idx];
    if (!d) return;

    const closes = data.map(d => d.c);
    const highs = data.map(d => d.h);
    const lows = data.map(d => d.l);
    const minP = Math.min(...lows) * 0.99;
    const maxP = Math.max(...highs) * 1.01;

    const scX = i => (i / (n - 1 || 1)) * Wr * 0.99 + Wr * 0.005;
    const scY = v => H - ((v - minP) / (maxP - minP)) * H;
    const liveC = d.c;

    // ═══ DESSIN DE L'OVERLAY ═══
    const dpr = window.devicePixelRatio || 1;
    overlay.width = W * dpr;
    overlay.height = H * dpr;
    overlay.style.width = W + 'px';
    overlay.style.height = H + 'px';

    const ctx = overlay.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const cx = scX(idx);

    // ── Crosshair principal ──
    ctx.strokeStyle = 'rgba(184,150,78,0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, my);
    ctx.lineTo(Wr, my);
    ctx.stroke();

    // ── Point sur le prix ──
    ctx.fillStyle = 'var(--gold)';
    ctx.beginPath();
    ctx.arc(cx, scY(liveC), 3, 0, Math.PI * 2);
    ctx.fill();

    // ── Label prix a droite ──
    const priceAtMouse = minP + ((H - my) / H) * (maxP - minP);
    ctx.fillStyle = 'rgba(10,8,4,0.9)';
    ctx.fillRect(Wr + 2, my - 10, 48, 20);
    ctx.fillStyle = 'var(--gold)';
    ctx.font = '10px DM Mono';
    ctx.fillText(fmt(priceAtMouse), Wr + 4, my + 4);

    // ── LABEL DATE en bas ──
    const dateLabel = d.label || atFmtDate(d.date, AT.interval);
    const dateWidth = ctx.measureText(dateLabel).width + 12;
    ctx.fillStyle = 'rgba(10,8,4,0.9)';
    ctx.fillRect(cx - dateWidth / 2, H - 18, dateWidth, 18);
    ctx.fillStyle = 'var(--cream)';
    ctx.font = '10px DM Sans';
    ctx.textAlign = 'center';
    ctx.fillText(dateLabel, cx, H - 5);
    ctx.textAlign = 'left';

    // ═══ PREVIEW DU DESSIN EN COURS ═══
    atDrawPreview(ctx, W, H, scX, scY, mx, my);

    ctx.restore();

    // ═══ TOOLTIP ═══
    tooltip.style.display = 'block';
    const tx = mx > W * 0.6 ? mx - 170 : mx + 16;
    const ty = my > H * 0.7 ? my - 140 : my + 16;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';

    // Calculs indicateurs pour le tooltip
    const rsi = atRSI(closes);
    const bb = atBB(closes);
    const macd = atMACD(closes);
    const stoch = atStoch(highs, lows, closes);

    // Construction du tooltip enrichi
    let tooltipHTML = `
      <div style="color:var(--gold);margin-bottom:6px;font-weight:600;font-size:13px;border-bottom:1px solid rgba(184,150,78,0.2);padding-bottom:4px">
        ${d.label || atFmtDate(d.date, AT.interval)}
        ${d._count ? '<span style="font-size:10px;opacity:0.6"> (' + d._count + ' seances)</span>' : ''}
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:11px">
        <span style="color:var(--dim)">Ouverture</span>
        <span style="color:var(--cream);text-align:right;font-family:DM Mono">${fmt(d.o)}</span>
        <span style="color:var(--dim)">Plus Haut</span>
        <span style="color:var(--green);text-align:right;font-family:DM Mono">${fmt(d.h)}</span>
        <span style="color:var(--dim)">Plus Bas</span>
        <span style="color:var(--red);text-align:right;font-family:DM Mono">${fmt(d.l)}</span>
        <span style="color:var(--dim)">Cloture</span>
        <span style="color:${d.c >= d.o ? 'var(--green)' : 'var(--red)'};text-align:right;font-family:DM Mono;font-weight:600">${fmt(d.c)}</span>
        <span style="color:var(--dim)">Volume</span>
        <span style="color:var(--dim);text-align:right;font-family:DM Mono">${fmtVol(d.v)}</span>
      </div>
    `;

    // Section indicateurs actifs dans le tooltip
    const activeInds = Object.entries(AT.activeInds).filter(([,v]) => v.on);
    if (activeInds.length > 0) {
      tooltipHTML += `<div style="margin-top:8px;border-top:1px solid rgba(184,150,78,0.15);padding-top:6px">
        <div style="color:var(--gold);font-size:10px;margin-bottom:4px;opacity:0.8">INDICATEURS</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px">`;

      activeInds.forEach(([k, v]) => {
        let val = '—';
        if (k === 'rsi' && rsi[idx] != null) val = rsi[idx].toFixed(1);
        else if (k === 'bb' && bb[idx]?.upper) val = fmt(bb[idx].lower) + ' – ' + fmt(bb[idx].upper);
        else if (k === 'macd' && macd[idx]) val = macd[idx].macd.toFixed(2);
        else if (k === 'stoch' && stoch.K[idx] != null) val = stoch.K[idx].toFixed(1) + '/' + stoch.D[idx]?.toFixed(1);

        if (val !== '—') {
          tooltipHTML += `
            <span style="color:${v.color}">● ${v.label}</span>
            <span style="text-align:right;font-family:DM Mono">${val}</span>
          `;
        }
      });

      tooltipHTML += `</div></div>`;
    }

    // Variation si on a la bougie precedente
    if (idx > 0) {
      const prevC = closes[idx - 1];
      const varPct = ((d.c - prevC) / prevC * 100);
      const varColor = varPct >= 0 ? 'var(--green)' : 'var(--red)';
      const varIcon = varPct >= 0 ? '▲' : '▼';
      tooltipHTML += `
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(184,150,78,0.1);text-align:right;font-size:11px">
          <span style="color:${varColor};font-family:DM Mono">${varIcon} ${Math.abs(varPct).toFixed(2)}%</span>
        </div>
      `;
    }

    tooltip.innerHTML = tooltipHTML;

    // ═══ MISE A JOUR DE LA BARRE OHLCV (hover) ═══
    document.getElementById('atO').textContent = fmt(d.o);
    document.getElementById('atH').textContent = fmt(d.h);
    document.getElementById('atL').textContent = fmt(d.l);
    document.getElementById('atC').textContent = fmt(d.c);
    document.getElementById('atC').style.color = d.c >= d.o ? 'var(--green)' : 'var(--red)';
    document.getElementById('atV').textContent = fmtVol(d.v);
    document.getElementById('atLastUpdate').textContent = d.label || atFmtDate(d.date, AT.interval);

    // Marquer qu'on est en mode hover
    mainEl._hovering = true;
  });

  // ── MOUSELEAVE : Reset ──
  mainEl.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
    AT._mouseX = null;
    AT._mouseY = null;

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Restaurer les valeurs du dernier cours (live)
    if (mainEl._hovering) {
      mainEl._hovering = false;
      atRender();
    }
  });

  // ═══════════════════════════════════════
  // CLICK : Dessin avec preview
  // ═══════════════════════════════════════
  mainEl.addEventListener('click', e => {
    if (AT.drawMode === 'cursor') return;

    const rect = mainEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const W = mainEl.clientWidth;
    const H = mainEl.clientHeight;
    const right = 52;

    const data = atVisibleData();
    if (!data.length) return;

    const n = data.length;
    const idx = Math.max(0, Math.min(n - 1, Math.round((mx / (W - right)) * (n - 1))));
    const minP = Math.min(...data.map(d => d.l)) * 0.99;
    const maxP = Math.max(...data.map(d => d.h)) * 1.01;
    const price = minP + ((H - my) / H) * (maxP - minP);
    const pt = { i: idx, p: price };

    const statusEl = document.getElementById('atDrawStatus');
    const toolNames = {
      hline: 'Support/Resistance',
      trend: 'Ligne de tendance',
      channel: 'Canal',
      rect: 'Zone de prix',
      fib: 'Fibonacci',
      pitch: 'Pitchfork',
      text: 'Annotation'
    };

    if (AT.drawMode === 'hline') {
      AT.draws.push({ type: 'hline', price: price });
      atSetDraw('cursor');
      atRender();
      toast(toolNames.hline + ' place a ' + fmt(price), 'success');

    } else if (AT.drawMode === 'trend') {
      AT.trendPts.push(pt);
      if (AT.trendPts.length === 2) {
        AT.draws.push({ type: 'trend', pts: [...AT.trendPts] });
        AT.trendPts = [];
        atSetDraw('cursor');
        atRender();
        toast('Ligne de tendance tracee', 'success');
      } else {
        if (statusEl) statusEl.innerHTML = 'Point 1/2 place → <b>cliquez le point 2</b>';
      }

    } else if (AT.drawMode === 'channel') {
      AT.channelPts.push(pt);
      if (AT.channelPts.length === 3) {
        AT.draws.push({ type: 'channel', pts: [...AT.channelPts] });
        AT.channelPts = [];
        atSetDraw('cursor');
        atRender();
        toast('Canal de tendance trace', 'success');
      } else {
        const step = AT.channelPts.length;
        const msgs = ['', 'Point 1/3 place → cliquez le point 2 (haut)', 'Point 2/3 place → cliquez le point 3 (bas)'];
        if (statusEl) statusEl.innerHTML = msgs[step];
      }

    } else if (AT.drawMode === 'rect') {
      AT.rectPts.push(pt);
      if (AT.rectPts.length === 2) {
        AT.draws.push({ type: 'rect', pts: [...AT.rectPts] });
        AT.rectPts = [];
        atSetDraw('cursor');
        atRender();
        toast('Zone de prix definie', 'success');
      } else {
        if (statusEl) statusEl.innerHTML = 'Coin 1/2 place → <b>cliquez le coin oppose</b>';
      }

    } else if (AT.drawMode === 'fib') {
      AT.trendPts.push(pt);
      if (AT.trendPts.length === 2) {
        // Trier pour avoir bas→haut
        const sorted = [...AT.trendPts].sort((a, b) => a.p - b.p);
        AT.draws.push({ type: 'fib', pts: sorted });
        AT.trendPts = [];
        atSetDraw('cursor');
        atRender();
        toast('Retracements de Fibonacci traces', 'success');
      } else {
        if (statusEl) statusEl.innerHTML = 'Bas place → <b>cliquez le haut</b> du mouvement';
      }

    } else if (AT.drawMode === 'pitch') {
      AT.trendPts.push(pt);
      if (AT.trendPts.length === 3) {
        AT.draws.push({ type: 'pitch', pts: [...AT.trendPts] });
        AT.trendPts = [];
        atSetDraw('cursor');
        atRender();
        toast('Pitchfork d\'Andrews trace', 'success');
      } else {
        const step = AT.trendPts.length;
        const msgs = ['', 'Point 1/3 (origine) place', 'Point 2/3 place → cliquez le point 3'];
        if (statusEl) statusEl.innerHTML = msgs[step];
      }

    } else if (AT.drawMode === 'text') {
      const txt = prompt('Texte de l\'annotation :');
      if (txt && txt.trim()) {
        AT.draws.push({ type: 'text', pt: pt, text: txt.trim() });
        atRender();
        toast('Annotation ajoutee', 'success');
      }
      atSetDraw('cursor');
    }
  });

  // ═══════════════════════════════════════
  // ZOOM MOLETTE
  // ═══════════════════════════════════════
  mainEl.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.12 : -0.12;
    const rect = mainEl.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;

    const rng = AT.zoom.end - AT.zoom.start;
    const newRng = Math.max(0.03, Math.min(1, rng * (1 + delta)));
    const center = AT.zoom.start + rng * ratio;

    AT.zoom.start = Math.max(0, center - newRng * ratio);
    AT.zoom.end = Math.min(1, AT.zoom.start + newRng);

    atRender();
  }, { passive: false });

  // ═══════════════════════════════════════
  // PAN (glisser-deplacer)
  // ═══════════════════════════════════════
  mainEl.addEventListener('mousedown', e => {
    if (AT.drawMode !== 'cursor') return;
    AT.panning = true;
    AT.panStart = e.clientX;
    AT.panZoomStart = { ...AT.zoom };
    mainEl.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!AT.panning) return;
    const dx = e.clientX - AT.panStart;
    const W = mainEl.clientWidth;
    const shift = (dx / W) * (AT.panZoomStart.end - AT.panZoomStart.start) * -1;

    let ns = AT.panZoomStart.start + shift;
    let ne = AT.panZoomStart.end + shift;

    if (ns < 0) { ne -= ns; ns = 0; }
    if (ne > 1) { ns -= (ne - 1); ne = 1; }

    AT.zoom = { start: Math.max(0, ns), end: Math.min(1, ne) };
    atRender();
  });

  document.addEventListener('mouseup', () => {
    if (AT.panning) {
      AT.panning = false;
      mainEl.style.cursor = 'crosshair';
    }
  });

  // Double-clic = reset zoom
  mainEl.addEventListener('dblclick', () => {
    AT.zoom = { start: 0, end: 1 };
    atRender();
    toast('Zoom reinitialise', 'success');
  });
}

// ═══════════════════════════════════════
// PREVIEW DES DESSINS (apercu avant clic)
// ═══════════════════════════════════════
function atDrawPreview(ctx, W, H, scX, scY, mx, my) {
  if (AT.drawMode === 'cursor') return;
  if (mx == null || my == null) return;

  const data = atVisibleData();
  if (!data.length) return;

  const n = data.length;
  const right = 52;
  const Wr = W - right;
  const idx = Math.max(0, Math.min(n - 1, Math.round((mx / Wr) * (n - 1))));
  const minP = Math.min(...data.map(d => d.l)) * 0.99;
  const maxP = Math.max(...data.map(d => d.h)) * 1.01;
  const price = minP + ((H - my) / H) * (maxP - minP);

  ctx.save();
  ctx.strokeStyle = 'rgba(184,150,78,0.5)';
  ctx.fillStyle = 'rgba(184,150,78,0.1)';
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.2;

  // ── HLINE : Ligne horizontale suivant la souris ──
  if (AT.drawMode === 'hline') {
    ctx.beginPath();
    ctx.moveTo(0, my);
    ctx.lineTo(Wr, my);
    ctx.stroke();

    // Label preview
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(10,8,4,0.85)';
    ctx.fillRect(6, my - 16, 80, 16);
    ctx.fillStyle = 'var(--gold)';
    ctx.font = '10px DM Mono';
    ctx.fillText('S/R ' + fmt(price), 10, my - 4);

    // Indicateur "cliquez pour placer"
    ctx.fillStyle = 'rgba(184,150,78,0.7)';
    ctx.font = '10px DM Sans';
    ctx.fillText('Cliquez pour placer', mx + 10, my - 10);
  }

  // ── TREND : Ligne depuis le premier point ──
  else if (AT.drawMode === 'trend' && AT.trendPts.length === 1) {
    const p1 = AT.trendPts[0];
    ctx.beginPath();
    ctx.moveTo(scX(p1.i), scY(p1.p));
    ctx.lineTo(mx, my);
    ctx.stroke();

    // Points
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(96,165,250,0.8)';
    ctx.beginPath(); ctx.arc(scX(p1.i), scY(p1.p), 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(96,165,250,0.7)';
    ctx.font = '10px DM Sans';
    ctx.fillText('Point 2/2', mx + 10, my - 10);
  }

  // ── CHANNEL : 2 lignes paralleles depuis les 2 premiers points ──
  else if (AT.drawMode === 'channel' && AT.channelPts.length >= 1) {
    if (AT.channelPts.length === 1) {
      const p1 = AT.channelPts[0];
      ctx.beginPath();
      ctx.moveTo(scX(p1.i), scY(p1.p));
      ctx.lineTo(mx, my);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(96,165,250,0.8)';
      ctx.beginPath(); ctx.arc(scX(p1.i), scY(p1.p), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(96,165,250,0.7)';
      ctx.font = '10px DM Sans';
      ctx.fillText('Point 2/3 (haut)', mx + 10, my - 10);

    } else if (AT.channelPts.length === 2) {
      const [p1, p2] = AT.channelPts;
      ctx.beginPath();
      ctx.moveTo(scX(p1.i), scY(p1.p));
      ctx.lineTo(scX(p2.i), scY(p2.p));
      ctx.stroke();

      // Ligne parallele suivant la souris
      const dy = my - scY(p2.p);
      ctx.beginPath();
      ctx.moveTo(scX(p1.i), scY(p1.p) + dy);
      ctx.lineTo(scX(p2.i), scY(p2.p) + dy);
      ctx.stroke();

      // Zone entre les deux lignes (preview)
      ctx.fillStyle = 'rgba(96,165,250,0.05)';
      ctx.beginPath();
      ctx.moveTo(scX(p1.i), scY(p1.p));
      ctx.lineTo(scX(p2.i), scY(p2.p));
      ctx.lineTo(scX(p2.i), scY(p2.p) + dy);
      ctx.lineTo(scX(p1.i), scY(p1.p) + dy);
      ctx.closePath();
      ctx.fill();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(96,165,250,0.7)';
      ctx.font = '10px DM Sans';
      ctx.fillText('Point 3/3 (bas)', mx + 10, my - 10);
    }
  }

  // ── RECT : Rectangle depuis le premier coin ──
  else if (AT.drawMode === 'rect' && AT.rectPts.length === 1) {
    const p1 = AT.rectPts[0];
    const x1 = scX(p1.i);
    const y1 = scY(p1.p);

    ctx.fillStyle = 'rgba(184,150,78,0.08)';
    ctx.fillRect(Math.min(x1, mx), Math.min(y1, my), Math.abs(mx - x1), Math.abs(my - y1));
    ctx.strokeRect(Math.min(x1, mx), Math.min(y1, my), Math.abs(mx - x1), Math.abs(my - y1));

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(184,150,78,0.7)';
    ctx.font = '10px DM Sans';
    ctx.fillText('Coin 2/2', mx + 10, my - 10);
  }

  // ── FIB : Ligne + niveaux preview ──
  else if (AT.drawMode === 'fib' && AT.trendPts.length === 1) {
    const p1 = AT.trendPts[0];
    const p1y = scY(p1.p);

    ctx.beginPath();
    ctx.moveTo(scX(p1.i), p1y);
    ctx.lineTo(mx, my);
    ctx.stroke();

    // Preview des niveaux Fibonacci
    const lo = Math.min(p1.p, price);
    const hi = Math.max(p1.p, price);
    const rng = hi - lo;

    ctx.setLineDash([3, 5]);
    [0.236, 0.382, 0.5, 0.618, 0.786].forEach(l => {
      const fy = scY(lo + rng * (1 - l));
      ctx.strokeStyle = 'rgba(184,150,78,0.25)';
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(Wr, fy);
      ctx.stroke();

      ctx.fillStyle = 'rgba(184,150,78,0.5)';
      ctx.font = '9px DM Mono';
      ctx.fillText((l * 100).toFixed(1) + '%', 4, fy - 2);
    });

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(74,222,128,0.7)';
    ctx.font = '10px DM Sans';
    ctx.fillText('Haut du mouvement', mx + 10, my - 10);
  }

  // ── TEXT : Curseur avec icone texte ──
  else if (AT.drawMode === 'text') {
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(201,168,76,0.15)';
    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'var(--gold)';
    ctx.font = '14px DM Sans';
    ctx.fillText('T', mx - 4, my + 5);

    ctx.fillStyle = 'rgba(201,168,76,0.7)';
    ctx.font = '10px DM Sans';
    ctx.fillText('Cliquez pour texte', mx + 16, my - 4);
  }

  // ── PITCH : 3 points avec lignes ──
  else if (AT.drawMode === 'pitch') {
    if (AT.trendPts.length === 1) {
      const p1 = AT.trendPts[0];
      ctx.beginPath();
      ctx.moveTo(scX(p1.i), scY(p1.p));
      ctx.lineTo(mx, my);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(167,139,250,0.8)';
      ctx.beginPath(); ctx.arc(scX(p1.i), scY(p1.p), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(167,139,250,0.7)';
      ctx.font = '10px DM Sans';
      ctx.fillText('Point 2/3', mx + 10, my - 10);

    } else if (AT.trendPts.length === 2) {
      const [p1, p2] = AT.trendPts;
      ctx.beginPath();
      ctx.moveTo(scX(p1.i), scY(p1.p));
      ctx.lineTo(scX(p2.i), scY(p2.p));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(scX(p1.i), scY(p1.p));
      ctx.lineTo(mx, my);
      ctx.stroke();

      // Ligne mediane preview
      const mdx = (scX(p2.i) + mx) / 2;
      const mdy = (scY(p2.p) + my) / 2;
      ctx.strokeStyle = 'rgba(167,139,250,0.3)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(scX(p1.i), scY(p1.p));
      ctx.lineTo(mdx + (mdx - scX(p1.i)) * 2, mdy + (mdy - scY(p1.p)) * 2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(167,139,250,0.7)';
      ctx.font = '10px DM Sans';
      ctx.fillText('Point 3/3', mx + 10, my - 10);
    }
  }

  // ── Curseur personnalise selon l'outil ──
  const toolCursors = {
    hline: 'row-resize',
    trend: 'crosshair',
    channel: 'crosshair',
    rect: 'crosshair',
    fib: 'crosshair',
    pitch: 'crosshair',
    text: 'text'
  };
  mainEl.style.cursor = toolCursors[AT.drawMode] || 'crosshair';

  ctx.restore();
}

// ═══════════════════════════════════════
// INIT GLOBAL (conserve depuis l'original)
// ═══════════════════════════════════════
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
