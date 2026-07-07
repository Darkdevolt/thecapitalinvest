// ═══════════════════════════════════════
// AT — Canvas 2D Engine
// ═══════════════════════════════════════

// ── Calculs indicateurs ──
function atSMA(d, n) {
  return d.map((_, i) => i < n - 1 ? null : d.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);
}
function atEMA(d, n) {
  const k = 2 / (n + 1); const r = [d[0]];
  for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k));
  return r;
}
function atBB(d, n = 20) {
  const sma = atSMA(d, n);
  return d.map((_, i) => {
    if (i < n - 1) return { mid: null, upper: null, lower: null };
    const sl = d.slice(i - n + 1, i + 1);
    const std = Math.sqrt(sl.reduce((a, v) => a + Math.pow(v - sma[i], 2), 0) / n);
    return { mid: sma[i], upper: sma[i] + 2 * std, lower: sma[i] - 2 * std };
  });
}
function atRSI(d, n = 14) {
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const c = d[i] - d[i - 1]; c > 0 ? g += c : l += Math.abs(c); }
  g /= n; l /= n;
  const r = new Array(n).fill(null);
  r.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  for (let i = n + 1; i < d.length; i++) {
    const c = d[i] - d[i - 1];
    const gi = c > 0 ? c : 0, li = c < 0 ? -c : 0;
    g = (g * (n - 1) + gi) / n; l = (l * (n - 1) + li) / n;
    r.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  return r;
}
function atMACD(d) {
  const e12 = atEMA(d, 12), e26 = atEMA(d, 26);
  const ml = e12.map((v, i) => v - e26[i]);
  const sl = atEMA(ml, 9);
  return ml.map((v, i) => ({ macd: v, signal: sl[i], hist: v - sl[i] }));
}
function atStoch(h, l, c, k = 14, d = 3) {
  const K = c.map((_, i) => {
    if (i < k - 1) return null;
    const sl = l.slice(i - k + 1, i + 1), sh = h.slice(i - k + 1, i + 1);
    const lo = Math.min(...sl), hi = Math.max(...sh);
    return hi === lo ? 50 : ((c[i] - lo) / (hi - lo)) * 100;
  });
  const D = K.map((_, i) => {
    const sl = K.slice(Math.max(0, i - d + 1), i + 1).filter(v => v !== null);
    return sl.length < d ? null : sl.reduce((a, b) => a + b, 0) / sl.length;
  });
  return { K, D };
}
function atADX(h, l, c, n = 14) {
  const tr = [h[0] - l[0]];
  const pdm = [0], ndm = [0];
  for (let i = 1; i < h.length; i++) {
    tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
    const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  const atr = atSMA(tr, n), sp = atSMA(pdm, n), sn = atSMA(ndm, n);
  return c.map((_, i) => {
    if (!atr[i] || atr[i] === 0) return null;
    const di1 = (sp[i] / atr[i]) * 100, di2 = (sn[i] / atr[i]) * 100;
    const dx = Math.abs(di1 - di2) / (di1 + di2) * 100;
    return { adx: dx, diP: di1, diN: di2 };
  });
}
function atCCI(h, l, c, n = 20) {
  const tp = h.map((_, i) => (h[i] + l[i] + c[i]) / 3);
  const sma = atSMA(tp, n);
  return tp.map((v, i) => {
    if (sma[i] === null) return null;
    const sl = tp.slice(Math.max(0, i - n + 1), i + 1);
    const md = sl.reduce((a, b) => a + Math.abs(b - sma[i]), 0) / sl.length;
    return md === 0 ? 0 : (v - sma[i]) / (0.015 * md);
  });
}
function atVWAP(c, v) {
  let cv = 0, ct = 0;
  return c.map((p, i) => { cv += p * v[i]; ct += v[i]; return ct > 0 ? cv / ct : p; });
}
function atOBV(c, v) {
  let o = 0;
  return c.map((p, i) => { o += i === 0 ? v[i] : p > c[i - 1] ? v[i] : p < c[i - 1] ? -v[i] : 0; return o; });
}
function atHeikinAshi(o, h, l, c) {
  const ho = [o[0]], hc = [c[0]], hh = [h[0]], hl = [l[0]];
  for (let i = 1; i < c.length; i++) {
    const nc = (o[i] + h[i] + l[i] + c[i]) / 4;
    const no = (ho[i - 1] + hc[i - 1]) / 2;
    ho.push(no); hc.push(nc);
    hh.push(Math.max(h[i], no, nc));
    hl.push(Math.min(l[i], no, nc));
  }
  return { o: ho, h: hh, l: hl, c: hc };
}

// ── Extraction données historique ──
function atExtract(raw) {
  return raw.map(d => ({
    date: d.date_seance,
    o: +( d.cours_ouverture || d.ouverture || d.open || d.cours_cloture || d.cours || 0 ),
    h: +( d.plus_haut || d.haut || d.high || d.cours_cloture || d.cours || 0 ),
    l: +( d.plus_bas || d.bas || d.low || d.cours_cloture || d.cours || 0 ),
    c: +( d.cours_cloture || d.cloture || d.cours || d.close || 0 ),
    v: +( d.volume || d.vol || 0 ),
  })).filter(d => d.c > 0);
}

/**
 * Agregation des donnees historiques avec tracabilite complete.
 * 
 * PRINCIPE EDUCATIF pour le debutant :
 * ─────────────────────────────────────
 * Daily    : 1 bougie = 1 jour de cotation
 * Weekly   : 1 bougie = 1 semaine (lundi-vendredi)
 *            -> Open = cours d'ouverture du lundi
 *            -> High = plus haut de la semaine
 *            -> Low  = plus bas de la semaine
 *            -> Close = cours de cloture du vendredi
 *            -> Volume = somme des volumes de la semaine
 * Monthly  : 1 bougie = 1 mois calendaire
 *            -> Meme logique que Weekly sur le mois entier
 */
function atAggregate(data, interval) {
  // ── Cas Daily : pas d'agregation ──
  if (interval === 'daily') {
    AT._lastAggMeta = {
      interval: 'daily',
      candles: data.length,
      sourceCandles: data.length,
      compression: 1,
      description: 'Chaque bougie represente une seance de cotation',
      periodLabel: 'seance'
    };
    return data;
  }

  // ── Bucketisation par periode ──
  const buckets = {};

  data.forEach(d => {
    const dt = new Date(d.date + 'T00:00:00'); // Force timezone neutre
    let key, label, weekStart, weekEnd;

    if (interval === 'weekly') {
      // Trouver le lundi de la semaine
      const dayOfWeek = dt.getDay(); // 0=Dim, 1=Lun, ..., 6=Sam
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - daysToMonday);

      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);

      key = monday.toISOString().slice(0, 10);
      weekStart = monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      weekEnd = friday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      label = 'Sem. ' + weekStart + '-' + weekEnd;

    } else if (interval === 'monthly') {
      const year = dt.getFullYear();
      const month = dt.getMonth(); // 0-11
      const monthName = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

      key = year + '-' + String(month + 1).padStart(2, '0');
      label = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    } else {
      // Fallback securise
      key = d.date;
      label = d.date;
    }

    // ── Creation ou mise a jour du bucket ──
    if (!buckets[key]) {
      buckets[key] = {
        date: key,
        label: label,
        o: d.o,
        h: d.h,
        l: d.l,
        c: d.c,
        v: d.v,
        // Metadonnees internes pour debug/education
        _firstDate: d.date,
        _lastDate: d.date,
        _count: 1,
        _dates: [d.date]
      };
    } else {
      const b = buckets[key];
      b.h = Math.max(b.h, d.h);
      b.l = Math.min(b.l, d.l);
      b.c = d.c; // Cloture = dernier cours de la periode
      b.v += d.v;
      b._lastDate = d.date;
      b._count += 1;
      b._dates.push(d.date);
    }
  });

  const result = Object.values(buckets);

  // ── Metadonnees pour l'UI educative ──
  const compression = result.length > 0 ? Math.round(data.length / result.length * 10) / 10 : 1;

  AT._lastAggMeta = {
    interval: interval,
    candles: result.length,
    sourceCandles: data.length,
    compression: compression,
    description: interval === 'weekly' 
      ? 'Chaque bougie regroupe ' + compression + ' seances (1 semaine)'
      : interval === 'monthly'
      ? 'Chaque bougie regroupe ~' + Math.round(compression) + ' seances (1 mois)'
      : "Pas d'agregation",
    periodLabel: interval === 'weekly' ? 'semaine' : interval === 'monthly' ? 'mois' : 'seance'
  };

  return result;
}

// ── Formatage des dates avec annee complete et contexte agregation ──
function atFmtDate(dateStr, interval) {
  if (!dateStr) return '—';

  const d = new Date(dateStr + 'T00:00:00');

  if (interval === 'monthly') {
    return d.toLocaleDateString('fr-FR', { 
      month: 'short', 
      year: 'numeric' 
    });
  }

  if (interval === 'weekly') {
    // Format: "S3 nov. 2024" (Semaine 3 de novembre)
    const weekNum = Math.ceil(d.getDate() / 7);
    const monthYear = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return 'S' + weekNum + ' ' + monthYear;
  }

  // Daily — format complet
  return d.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
}

// ── Affichage de l'info agregation dans l'UI ──
function atShowAggInfo() {
  const meta = AT._lastAggMeta;
  const el = document.getElementById('atAggInfo');

  if (!el || !meta) return;

  if (meta.interval === 'daily') {
    el.style.display = 'none';
    return;
  }

  const icon = meta.interval === 'weekly' ? '📅' : '📆';
  el.innerHTML = icon + ' ' + meta.candles + ' ' + meta.periodLabel + 's · ' + meta.description;
  el.style.display = 'block';
  el.title = 'Agregation : ' + meta.sourceCandles + ' seances -> ' + meta.candles + ' ' + meta.periodLabel + 's';
}

// ── Helper pour le tooltip : recuperer la vraie date source ──
function atGetSourceDate(bucket, interval) {
  if (interval === 'daily') return bucket.date;
  if (bucket._dates && bucket._dates.length > 0) {
    return bucket._dates[bucket._dates.length - 1]; // Derniere date du bucket
  }
  return bucket.date;
}


function atRender() {
  if (AT.rafId) cancelAnimationFrame(AT.rafId);
  AT.rafId = requestAnimationFrame(_atDraw);
}

function _atDraw() {
  const data = atVisibleData();
  if (!data.length) return;

  const closes = data.map(d => d.c);
  const opens = data.map(d => d.o);
  const highs = data.map(d => d.h);
  const lows = data.map(d => d.l);
  const vols = data.map(d => d.v);

  let drawO = opens, drawH = highs, drawL = lows, drawC = closes;
  if (AT.type === 'ha') {
    const ha = atHeikinAshi(opens, highs, lows, closes);
    drawO = ha.o; drawH = ha.h; drawL = ha.l; drawC = ha.c;
  }

  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const curCours = allCours.find(c => c.ticker === AT.ticker);
  const liveC = curCours ? +curCours.cours : last.c;
  const liveVar = curCours ? +curCours.variation : (prev ? ((last.c - prev.c) / prev.c * 100) : 0);
  const varColor = liveVar >= 0 ? '#4ADE80' : '#F87171';

  // Labels complets + format volume lisible
  document.getElementById('atO').textContent = fmt(last.o); 
  document.getElementById('atO').style.color = '';
  document.getElementById('atH').textContent = fmt(last.h);
  document.getElementById('atL').textContent = fmt(last.l);
  document.getElementById('atC').textContent = fmt(liveC); 
  document.getElementById('atC').style.color = liveVar >= 0 ? '#4ADE80' : '#F87171';
  document.getElementById('atV').textContent = fmtVol(last.v);
  document.getElementById('atVar').innerHTML = `<span style="color:${varColor}">${liveVar >= 0 ? '+' : ''}${liveVar.toFixed(2)}%</span>`;
  document.getElementById('atLastUpdate').textContent = fmtDateFull(last.date);

  let minP = Math.min(...drawL.filter(v => v > 0)), maxP = Math.max(...drawH);
  const inds = AT.activeInds;
  if (inds.bb.on) { const bb = atBB(closes); bb.forEach(b => { if(b.upper) maxP = Math.max(maxP, b.upper); if(b.lower) minP = Math.min(minP, b.lower); }); }
  const pad = (maxP - minP) * 0.05;
  minP -= pad; maxP += pad;

  atDrawCanvas('cvMain', (ctx, W, H) => {
    _atDrawMain(ctx, W, H, data, drawO, drawH, drawL, drawC, vols, closes, opens, highs, lows, minP, maxP);
  });

  if (inds.vol.on) atDrawCanvas('cvVol', (ctx, W, H) => _atDrawVol(ctx, W, H, data, vols, drawC, drawO));
  if (inds.rsi.on) { document.getElementById('subRSI').style.display = ''; atDrawCanvas('cvRSI', (ctx, W, H) => _atDrawRSI(ctx, W, H, closes)); }
  if (inds.macd.on) { document.getElementById('subMACD').style.display = ''; atDrawCanvas('cvMACD', (ctx, W, H) => _atDrawMACD(ctx, W, H, closes)); }
  if (inds.stoch.on) { document.getElementById('subStoch').style.display = ''; atDrawCanvas('cvStoch', (ctx, W, H) => _atDrawStoch(ctx, W, H, highs, lows, closes)); }
  if (inds.adx.on) { document.getElementById('subADX').style.display = ''; atDrawCanvas('cvADX', (ctx, W, H) => _atDrawADX(ctx, W, H, highs, lows, closes)); }
  if (inds.cci.on) { document.getElementById('subCCI').style.display = ''; atDrawCanvas('cvCCI', (ctx, W, H) => _atDrawCCI(ctx, W, H, highs, lows, closes)); }
  if (inds.obv.on) { document.getElementById('subOBV').style.display = ''; atDrawCanvas('cvOBV', (ctx, W, H) => _atDrawOBV(ctx, W, H, closes, vols)); }

  atDrawAxisY(minP, maxP);
  atDrawAxisX(data);
  atDrawLegend(closes, highs, lows, vols);
  atUpdateSignals(closes, highs, lows, vols, liveVar, liveC);
  atUpdateActiveInds(closes, highs, lows, vols);
  atUpdateIndexBar();

  atShowAggInfo();

  const tag = document.getElementById('atPriceTag');
  const mainEl = document.getElementById('atMainChart');
  const H = mainEl.clientHeight;
  const scY = v => H - ((v - minP) / (maxP - minP)) * H;
  const tagY = scY(liveC);
  if (tagY > 0 && tagY < H) {
    tag.style.display = 'block';
    tag.style.top = (tagY - 10) + 'px';
    tag.style.background = liveVar >= 0 ? '#4ADE80' : '#F87171';
    tag.style.color = '#0A0804';
    tag.textContent = fmt(liveC);
  } else { tag.style.display = 'none'; }
}

function atDrawCanvas(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  const parent = el.parentElement;
  const W = parent.clientWidth; const H = parent.clientHeight;
  if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  if (el.width !== W * dpr || el.height !== H * dpr) {
    el.width = W * dpr; el.height = H * dpr;
    el.style.width = W + 'px'; el.style.height = H + 'px';
  }
  const ctx = el.getContext('2d');
  ctx.save(); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  fn(ctx, W, H);
  ctx.restore();
}

function atGrid(ctx, W, H, right = 52) {
  ctx.strokeStyle = 'rgba(184,150,78,0.05)'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) { const y = (H / 5) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - right, y); ctx.stroke(); }
  for (let i = 0; i <= 8; i++) { const x = ((W - right) / 8) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
}

function _atDrawMain(ctx, W, H, data, o, h, l, c, vols, closes, rawO, rawH, rawL, minP, maxP) {
  const right = 52;
  atGrid(ctx, W, H, right);
  const n = data.length;
  const Wr = W - right;
  const scX = i => (i / (n - 1 || 1)) * Wr + Wr * 0.01;
  const scY = v => H - ((v - minP) / (maxP - minP)) * H;
  const cw = Math.max(1.5, Math.min(18, Wr / n - 1.5));

  const inds = AT.activeInds;

  if (inds.ichimoku.on && closes.length >= 52) {
    const tenkan = closes.map((_, i) => i < 8 ? null : (Math.max(...rawH.slice(i-8,i+1)) + Math.min(...rawL.slice(i-8,i+1)))/2);
    const kijun = closes.map((_, i) => i < 25 ? null : (Math.max(...rawH.slice(i-25,i+1)) + Math.min(...rawL.slice(i-25,i+1)))/2);
    const senkA = tenkan.map((v,i) => v && kijun[i] ? (v+kijun[i])/2 : null);
    const senkB = closes.map((_, i) => i < 51 ? null : (Math.max(...rawH.slice(i-51,i+1))+Math.min(...rawL.slice(i-51,i+1)))/2);
    ctx.globalAlpha = 0.12;
    for (let i = 1; i < n; i++) {
      if (!senkA[i] || !senkB[i]) continue;
      const bull = senkA[i] >= senkB[i];
      ctx.fillStyle = bull ? '#4ADE80' : '#F87171';
      const x1 = scX(i-1), x2 = scX(i);
      ctx.beginPath();
      ctx.moveTo(x1, scY(senkA[i-1]||senkA[i])); ctx.lineTo(x2, scY(senkA[i]));
      ctx.lineTo(x2, scY(senkB[i])); ctx.lineTo(x1, scY(senkB[i-1]||senkB[i]));
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    [[tenkan,'#26a69a'],[kijun,'#e5534b']].forEach(([arr,col]) => {
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath();
      arr.forEach((v,i) => { if(!v) return; i===0||!arr[i-1]?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v)); });
      ctx.stroke();
    });
  }

  if (inds.bb.on) {
    const bb = atBB(closes);
    ['upper','lower'].forEach(k => {
      ctx.strokeStyle = 'rgba(184,150,78,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3,4]);
      ctx.beginPath();
      bb.forEach((b, i) => { if (!b[k]) return; i===0||!bb[i-1][k]?ctx.moveTo(scX(i),scY(b[k])):ctx.lineTo(scX(i),scY(b[k])); });
      ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.strokeStyle = 'rgba(184,150,78,0.15)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); bb.forEach((b,i) => { if(!b.mid) return; i===0||!bb[i-1].mid?ctx.moveTo(scX(i),scY(b.mid)):ctx.lineTo(scX(i),scY(b.mid)); }); ctx.stroke();
  }

  if (inds.vwap.on) {
    const vw = atVWAP(closes, vols);
    ctx.strokeStyle = '#e879f9'; ctx.lineWidth = 1.5; ctx.setLineDash([5,4]);
    ctx.beginPath(); vw.forEach((v,i) => i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v))); ctx.stroke(); ctx.setLineDash([]);
  }

  const maConf = [
    ['sma20',()=>atSMA(closes,20)],['sma50',()=>atSMA(closes,50)],['sma200',()=>atSMA(closes,200)],
    ['ema12',()=>atEMA(closes,12)],['ema26',()=>atEMA(closes,26)],
  ];
  maConf.forEach(([key, fn]) => {
    if (!inds[key].on) return;
    const vals = fn();
    ctx.strokeStyle = inds[key].color; ctx.lineWidth = 1.5;
    ctx.beginPath();
    vals.forEach((v, i) => { if (v===null) return; i===0||vals[i-1]===null?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v)); });
    ctx.stroke();
  });

  if (AT.compareData && AT.compareData.length) {
    const cd = AT.compareData.slice(-n);
    const cMin = Math.min(...cd.map(d=>d.c)), cMax = Math.max(...cd.map(d=>d.c));
    ctx.strokeStyle = 'rgba(96,165,250,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    cd.forEach((d,i) => {
      const normV = minP + ((d.c - cMin)/(cMax-cMin||1))*(maxP-minP);
      i===0?ctx.moveTo(scX(i),scY(normV)):ctx.lineTo(scX(i),scY(normV));
    });
    ctx.stroke();
  }

  if (AT.type === 'line' || AT.type === 'area') {
    if (AT.type === 'area') {
      const grad = ctx.createLinearGradient(0,0,0,H);
      grad.addColorStop(0,'rgba(184,150,78,0.15)'); grad.addColorStop(1,'rgba(184,150,78,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(scX(0), scY(c[0]));
      c.forEach((v,i) => ctx.lineTo(scX(i), scY(v)));
      ctx.lineTo(scX(n-1), H); ctx.lineTo(scX(0), H); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#B8964E'; ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(184,150,78,0.4)';
    ctx.shadowBlur = 6;
    ctx.beginPath(); c.forEach((v,i) => i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v))); ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (AT.type === 'bar') {
    for (let i = 0; i < n; i++) {
      const up = c[i] >= o[i]; const x = scX(i);
      ctx.strokeStyle = up ? '#4ADE80' : '#F87171'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, scY(h[i])); ctx.lineTo(x, scY(l[i])); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - cw*0.4, scY(o[i])); ctx.lineTo(x, scY(o[i])); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, scY(c[i])); ctx.lineTo(x + cw*0.4, scY(c[i])); ctx.stroke();
    }
  } else {
    for (let i = 0; i < n; i++) {
      const up = c[i] >= o[i]; const x = scX(i);
      const bullC = '#26a69a', bearC = '#ef5350';
      ctx.strokeStyle = up ? bullC : bearC; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, scY(h[i])); ctx.lineTo(x, scY(l[i])); ctx.stroke();
      const bodyH = Math.abs(scY(c[i]) - scY(o[i])) || 1;
      ctx.fillStyle = up ? bullC : bearC;
      ctx.fillRect(x - cw/2, Math.min(scY(c[i]),scY(o[i])), cw, bodyH);
    }
  }

  AT.draws.forEach(draw => atRenderDraw(ctx, draw, scX, scY, W, H));

  const lx = scX(n-1);
  ctx.strokeStyle = 'rgba(184,150,78,0.3)'; ctx.lineWidth = 0.5; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke(); ctx.setLineDash([]);
}

function _atDrawVol(ctx, W, H, data, vols, c, o) {
  const right = 52; const Wr = W - right;
  const n = vols.length; const maxV = Math.max(...vols) || 1;
  const scX = i => (i/(n-1||1))*Wr*0.99 + Wr*0.005;
  const bw = Math.max(1, Wr/n - 1);
  vols.forEach((v, i) => {
    const bh = (v/maxV)*(H-8);
    const up = c[i] >= o[i];
    ctx.fillStyle = up ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)';
    ctx.fillRect(scX(i)-bw/2, H-bh, bw, bh);
  });
  const smaV = atSMA(vols, Math.min(20, n));
  ctx.strokeStyle = 'rgba(184,150,78,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); smaV.forEach((v,i)=>{ if(!v) return; const y=H-(v/maxV)*(H-8); i===0?ctx.moveTo(scX(i),y):ctx.lineTo(scX(i),y); }); ctx.stroke();
  const lastV = vols[vols.length-1];
  document.getElementById('lblVol').textContent = `Volume · ${fmtVol(lastV)}`;
}

function _atDrawRSI(ctx, W, H, closes) {
  const right = 52; const Wr = W-right;
  const rsi = atRSI(closes);
  const scX = i => (i/(closes.length-1||1))*Wr*0.99;
  const scY = v => H - (v/100)*H*0.88 - H*0.06;
  ctx.fillStyle='rgba(248,113,113,0.06)'; ctx.fillRect(0,scY(70),Wr,scY(100)-scY(70));
  ctx.fillStyle='rgba(74,222,128,0.06)'; ctx.fillRect(0,scY(30),Wr,scY(0)-scY(30));
  [30,50,70].forEach(l => {
    ctx.strokeStyle=l===50?'rgba(184,150,78,0.15)':'rgba(184,150,78,0.25)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(0,scY(l)); ctx.lineTo(Wr,scY(l)); ctx.stroke();
  });
  ctx.strokeStyle='#fb923c'; ctx.lineWidth=1.5;
  ctx.beginPath(); rsi.forEach((v,i)=>{if(!v)return; i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v));});  ctx.stroke();
  const last = rsi[rsi.length-1];
  document.getElementById('lblRSI').textContent = `RSI (14) · ${last ? last.toFixed(1) : '—'}`;
}

function _atDrawMACD(ctx, W, H, closes) {
  const right = 52; const Wr = W-right;
  const macd = atMACD(closes);
  const n = macd.length;
  const vals = macd.map(d => [d.macd, d.signal, d.hist]).flat().filter(v => !isNaN(v));
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const rng = maxV - minV || 1;
  const scX = i => (i/(n-1||1))*Wr*0.99;
  const scY = v => H - ((v-minV)/rng)*H*0.86 - H*0.07;
  const zero = scY(0);
  ctx.strokeStyle='rgba(184,150,78,0.2)'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(0,zero); ctx.lineTo(Wr,zero); ctx.stroke();
  const bw = Math.max(1, Wr/n - 1);
  macd.forEach((d,i) => {
    const x = scX(i), bh = Math.abs(scY(d.hist)-zero);
    ctx.fillStyle = d.hist>=0?'rgba(74,222,128,0.55)':'rgba(248,113,113,0.55)';
    ctx.fillRect(x-bw/2, d.hist>=0?zero-bh:zero, bw, bh||1);
  });
  [[macd.map(d=>d.macd),'#60a5fa'],[macd.map(d=>d.signal),'#f87171']].forEach(([arr,col]) => {
    ctx.strokeStyle=col; ctx.lineWidth=1.5;
    ctx.beginPath(); arr.forEach((v,i)=>i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v))); ctx.stroke();
  });
  const last = macd[macd.length-1];
  document.getElementById('lblMACD').textContent = `MACD · ${last?last.macd.toFixed(1):''} · Sig: ${last?last.signal.toFixed(1):''}`;
}

function _atDrawStoch(ctx, W, H, h, l, c) {
  const right=52; const Wr=W-right;
  const st = atStoch(h,l,c);
  const n=st.K.length;
  const scX=i=>(i/(n-1||1))*Wr*0.99;
  const scY=v=>H-(v/100)*H*0.86-H*0.07;
  ctx.fillStyle='rgba(248,113,113,0.06)'; ctx.fillRect(0,scY(80),Wr,scY(100)-scY(80));
  ctx.fillStyle='rgba(74,222,128,0.06)'; ctx.fillRect(0,scY(20),Wr,scY(0)-scY(20));
  [20,50,80].forEach(l=>{ ctx.strokeStyle='rgba(184,150,78,0.2)'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(0,scY(l)); ctx.lineTo(Wr,scY(l)); ctx.stroke(); });
  [[st.K,'#e879f9'],[st.D,'#60a5fa']].forEach(([arr,col])=>{
    ctx.strokeStyle=col; ctx.lineWidth=1.2;
    ctx.beginPath(); arr.forEach((v,i)=>{if(!v)return; i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v));}); ctx.stroke();
  });
  const lk=st.K[n-1],ld=st.D[n-1];
  document.getElementById('lblStoch').textContent=`Stoch · %K:${lk?lk.toFixed(1):'—'} %D:${ld?ld.toFixed(1):'—'}`;
}

function _atDrawADX(ctx, W, H, h, l, c) {
  const right=52; const Wr=W-right;
  const adx=atADX(h,l,c);
  const n=adx.length;
  const scX=i=>(i/(n-1||1))*Wr*0.99;
  const scY=v=>H-(v/100)*H*0.86-H*0.07;
  ctx.strokeStyle='rgba(184,150,78,0.2)'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(0,scY(25)); ctx.lineTo(Wr,scY(25)); ctx.stroke();
  [[adx.map(d=>d?.adx),'#f59e0b'],[adx.map(d=>d?.diP),'#4ade80'],[adx.map(d=>d?.diN),'#f87171']].forEach(([arr,col])=>{
    ctx.strokeStyle=col; ctx.lineWidth=1.2;
    ctx.beginPath(); arr.forEach((v,i)=>{if(!v)return; i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v));}); ctx.stroke();
  });
  const last=adx[n-1];
  document.getElementById('lblADX').textContent=`ADX · ${last?last.adx.toFixed(1):'—'} (+DI:${last?last.diP.toFixed(1):'—'} -DI:${last?last.diN.toFixed(1):'—'})`;
}

function _atDrawCCI(ctx, W, H, h, l, c) {
  const right=52; const Wr=W-right;
  const cci=atCCI(h,l,c);
  const vals=cci.filter(v=>v!==null); const minV=Math.min(-200,...vals), maxV=Math.max(200,...vals);
  const n=cci.length;
  const scX=i=>(i/(n-1||1))*Wr*0.99;
  const scY=v=>H-((v-minV)/(maxV-minV))*H*0.86-H*0.07;
  [[-100,0.06,'rgba(248,113,113'],[100,0.06,'rgba(74,222,128']].forEach(([level,alpha,col])=>{
    ctx.fillStyle=`${col},${alpha})`; ctx.fillRect(0,Math.min(scY(level),scY(level<0?minV:maxV)),Wr,Math.abs(scY(level)-scY(level<0?minV:maxV)));
  });
  [-100,0,100].forEach(l=>{ctx.strokeStyle='rgba(184,150,78,0.2)'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(0,scY(l)); ctx.lineTo(Wr,scY(l)); ctx.stroke();});
  ctx.strokeStyle='#a78bfa'; ctx.lineWidth=1.5;
  ctx.beginPath(); cci.forEach((v,i)=>{if(!v)return; i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v));}); ctx.stroke();
  const last=cci[n-1];
  document.getElementById('lblCCI').textContent=`CCI (20) · ${last?last.toFixed(1):'—'}`;
}

function _atDrawOBV(ctx, W, H, c, v) {
  const right=52; const Wr=W-right;
  const obv=atOBV(c,v);
  const n=obv.length; const minV=Math.min(...obv), maxV=Math.max(...obv); const rng=maxV-minV||1;
  const scX=i=>(i/(n-1||1))*Wr*0.99;
  const scY=v=>H-((v-minV)/rng)*H*0.86-H*0.07;
  const grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba(74,222,128,0.2)'); grad.addColorStop(1,'rgba(74,222,128,0)');
  ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(scX(0),scY(obv[0]));
  obv.forEach((v,i)=>ctx.lineTo(scX(i),scY(v)));
  ctx.lineTo(scX(n-1),H); ctx.lineTo(scX(0),H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#4ade80'; ctx.lineWidth=1.5;
  ctx.beginPath(); obv.forEach((v,i)=>i===0?ctx.moveTo(scX(i),scY(v)):ctx.lineTo(scX(i),scY(v))); ctx.stroke();
  const fmtObv=v=>{ const a=Math.abs(v); return a>=1e6?(v/1e6).toFixed(1)+'M':a>=1e3?(v/1e3).toFixed(0)+'k':v.toFixed(0); };
  document.getElementById('lblOBV').textContent=`OBV · ${fmtObv(obv[n-1]||0)}`;
}
// ═══════════════════════════════════════
// AT — Navigation Bar (Mini Overview)
// ═══════════════════════════════════════

let navDragging = false;
let navResizeL = false;
let navResizeR = false;
let navStartX = 0;
let navStartZoom = null;

function atDrawNav() {
  const el = document.getElementById('cvNav');
  const wrap = document.getElementById('atNavWrap');
  if (!el || !wrap || !AT.hist.length) return;

  const W = wrap.clientWidth;
  const H = 48;
  const dpr = window.devicePixelRatio || 1;
  if (el.width !== W * dpr || el.height !== H * dpr) {
    el.width = W * dpr; el.height = H * dpr;
    el.style.width = W + 'px'; el.style.height = H + 'px';
  }
  const ctx = el.getContext('2d');
  ctx.save(); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const data = AT.hist;
  const n = data.length;
  const closes = data.map(d => d.c);
  const minC = Math.min(...closes);
  const maxC = Math.max(...closes);
  const rng = maxC - minC || 1;

  // Dessiner la ligne d'aperçu complète
  ctx.strokeStyle = 'rgba(184,150,78,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = (i / (n - 1 || 1)) * W;
    const y = H - ((d.c - minC) / rng) * (H - 8) - 4;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Zone de sélection (zoom actuel)
  const selX = AT.zoom.start * W;
  const selW = (AT.zoom.end - AT.zoom.start) * W;

  // Fond extérieur (assombri)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, selX, H);
  ctx.fillRect(selX + selW, 0, W - selX - selW, H);

  // Bordures de la sélection
  ctx.strokeStyle = 'rgba(184,150,78,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(selX, 2, selW, H - 4);

  // Handles de resize (gauche / droite)
  const handleW = 6;
  ctx.fillStyle = 'rgba(184,150,78,0.9)';
  ctx.fillRect(selX - handleW/2, H/2 - 8, handleW, 16);
  ctx.fillRect(selX + selW - handleW/2, H/2 - 8, handleW, 16);

  ctx.restore();
}

function atInitNav() {
  const el = document.getElementById('cvNav');
  if (!el) return;

  const getX = e => {
    const rect = el.getBoundingClientRect();
    return (e.clientX - rect.left) / rect.width;
  };

  el.addEventListener('mousedown', e => {
    const x = getX(e);
    const selX = AT.zoom.start;
    const selW = AT.zoom.end - AT.zoom.start;
    const edge = 0.02; // 2% de marge pour les handles

    if (Math.abs(x - selX) < edge) {
      navResizeL = true;
    } else if (Math.abs(x - (selX + selW)) < edge) {
      navResizeR = true;
    } else if (x >= selX && x <= selX + selW) {
      navDragging = true;
    }
    navStartX = x;
    navStartZoom = { ...AT.zoom };
  });

  window.addEventListener('mousemove', e => {
    if (!navDragging && !navResizeL && !navResizeR) return;
    const x = getX(e);
    const dx = x - navStartX;
    const zs = navStartZoom.start;
    const ze = navStartZoom.end;

    if (navDragging) {
      AT.zoom.start = Math.max(0, Math.min(1 - (ze - zs), zs + dx));
      AT.zoom.end = AT.zoom.start + (ze - zs);
    } else if (navResizeL) {
      AT.zoom.start = Math.max(0, Math.min(ze - 0.05, zs + dx));
    } else if (navResizeR) {
      AT.zoom.end = Math.min(1, Math.max(zs + 0.05, ze + dx));
    }
    atRender();
    atDrawNav();
  });

  window.addEventListener('mouseup', () => {
    navDragging = false; navResizeL = false; navResizeR = false;
  });
}
