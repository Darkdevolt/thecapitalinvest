/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE TECHNIQUE PRO
   at-chart.js : moteur de rendu.

   Deux canevas superposés. Le premier porte tout ce qui coûte cher à
   dessiner — bougies, indicateurs, axes — et n'est redessiné que
   lorsque les données ou l'échelle changent. Le second ne porte que
   le réticule et l'aperçu de l'outil de dessin en cours, redessinés
   à chaque mouvement de souris. Séparer les deux évite de recalculer
   plusieurs centaines de bougies à chaque pixel parcouru.

   Les dessins de l'utilisateur sont stockés en coordonnées de données
   — indice de bougie et prix — et non en pixels : ils restent donc
   accrochés au bon endroit quel que soit le zoom ou la taille de la
   fenêtre.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ATChart) return;

  var M = global.ATMath;

  var AXIS_W = 66;      /* échelle des prix, à droite */
  var TIME_H = 22;      /* échelle des dates, en bas */
  var PANE_GAP = 4;
  var PAD_TOP = 10;
  var PAD_BOTTOM = 8;

  function theme(light) {
    return light ? {
      bg: '#faf8f3', grid: 'rgba(30,26,20,.06)', gridStrong: 'rgba(30,26,20,.10)',
      text: '#4a4438', dim: '#8a8578', gold: '#9a7a30', line: '#9a7a30',
      up: '#1f9d63', down: '#d1453d', upFill: '#1f9d63', downFill: '#d1453d',
      axisBg: 'rgba(250,248,243,.92)', crossLine: 'rgba(60,52,40,.45)',
      tagText: '#faf8f3', paneSep: 'rgba(30,26,20,.10)'
    } : {
      bg: '#0e0c09', grid: 'rgba(200,162,78,.055)', gridStrong: 'rgba(200,162,78,.10)',
      text: '#e9e3d6', dim: '#8a8578', gold: '#c8a24e', line: '#c8a24e',
      up: '#3fc98a', down: '#f0645e', upFill: '#3fc98a', downFill: '#f0645e',
      axisBg: 'rgba(14,12,9,.92)', crossLine: 'rgba(233,227,214,.35)',
      tagText: '#0e0c09', paneSep: 'rgba(200,162,78,.10)'
    };
  }

  var FONT = '11px "DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  var FONT_SM = '10px "DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  var FONT_LBL = '600 11px "DM Sans", system-ui, sans-serif';

  /* ── Formatage ────────────────────────────────────────────────── */

  function fmtPrice(v, decimals) {
    if (!M.fin(v)) return '—';
    var d = decimals != null ? decimals : (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
    return v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtVolume(v) {
    if (!M.fin(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + ' Mrd';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + ' M';
    if (a >= 1e3) return (v / 1e3).toFixed(1) + ' k';
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  }
  function fmtAuto(v, kind) {
    if (kind === 'volume') return fmtVolume(v);
    return fmtPrice(v);
  }
  function fmtDate(iso, interval) {
    if (!iso) return '';
    var parts = String(iso).slice(0, 10).split('-');
    if (parts.length < 3) return String(iso);
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (isNaN(d.getTime())) return String(iso);
    if (interval === 'monthly') return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    if (interval === 'weekly') return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
  function fmtDateLong(iso) {
    if (!iso) return '';
    var parts = String(iso).slice(0, 10).split('-');
    if (parts.length < 3) return String(iso);
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
  }

  /* ── Graduations lisibles ─────────────────────────────────────── */

  function niceTicks(min, max, count) {
    if (!M.fin(min) || !M.fin(max) || min === max) return [min];
    var range = max - min;
    var raw = range / Math.max(1, count);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var start = Math.ceil(min / step) * step;
    var out = [];
    for (var v = start; v <= max + step * 0.001 && out.length < 40; v += step) out.push(Math.round(v / step) * step);
    return out;
  }

  /* ── Fabrique de graphique ────────────────────────────────────── */

  function create(host) {
    var base = document.createElement('canvas');
    var over = document.createElement('canvas');
    base.className = 'atx-canvas atx-base';
    over.className = 'atx-canvas atx-over';
    host.appendChild(base);
    host.appendChild(over);

    var ctxB = base.getContext('2d');
    var ctxO = over.getContext('2d');

    var api = {
      host: host, base: base, over: over,
      width: 0, height: 0, dpr: 1,
      layout: null, view: null, T: theme(false),
      cursor: null
    };

    function resize() {
      var r = host.getBoundingClientRect();
      var w = Math.max(320, Math.floor(r.width));
      var h = Math.max(220, Math.floor(r.height));
      var dpr = Math.min(3, global.devicePixelRatio || 1);
      if (api.width === w && api.height === h && api.dpr === dpr) return false;
      api.width = w; api.height = h; api.dpr = dpr;
      [base, over].forEach(function (cv) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cv.style.width = w + 'px';
        cv.style.height = h + 'px';
      });
      return true;
    }
    api.resize = resize;

    /* ── Calcul de la mise en page ──────────────────────────────── */

    function computeLayout(view) {
      var panes = view.panes || [];
      var chartW = api.width - AXIS_W;
      var totalPaneH = 0;
      panes.forEach(function (p) { totalPaneH += (p.height || 84) + PANE_GAP; });
      var available = api.height - TIME_H - PAD_TOP - PAD_BOTTOM;
      /* Le graphique des prix ne descend jamais sous 42 % de la hauteur :
         empiler beaucoup de panneaux ne doit pas le réduire à une bande. */
      var minPrice = Math.max(140, available * 0.42);
      if (available - totalPaneH < minPrice && panes.length) {
        var scale = Math.max(0.35, (available - minPrice) / Math.max(1, totalPaneH));
        totalPaneH = 0;
        panes.forEach(function (p) {
          p._h = Math.max(46, Math.round((p.height || 84) * scale));
          totalPaneH += p._h + PANE_GAP;
        });
      } else {
        panes.forEach(function (p) { p._h = p.height || 84; });
      }
      var priceH = Math.max(120, available - totalPaneH);

      var y = PAD_TOP;
      var priceRect = { x: 0, y: y, w: chartW, h: priceH };
      y += priceH + PANE_GAP;
      var paneRects = panes.map(function (p) {
        var r = { x: 0, y: y, w: chartW, h: p._h, pane: p };
        y += p._h + PANE_GAP;
        return r;
      });
      return {
        chartW: chartW, axisX: chartW, axisW: AXIS_W,
        price: priceRect, panes: paneRects,
        timeY: api.height - TIME_H - PAD_BOTTOM,
        bottom: y
      };
    }

    /* ── Échelles ───────────────────────────────────────────────── */

    function makeXScale(rect, count, offsetRight) {
      var pad = 2;
      var usable = rect.w - pad * 2 - (offsetRight || 0);
      var slot = count > 0 ? usable / count : usable;
      return {
        slot: slot,
        /* centre de la bougie d'indice visible i */
        at: function (i) { return rect.x + pad + slot * (i + 0.5); },
        /* indice visible sous une abscisse pixel */
        inv: function (px) { return (px - rect.x - pad) / slot - 0.5; }
      };
    }

    function makeYScale(rect, min, max, log) {
      if (!M.fin(min) || !M.fin(max)) { min = 0; max = 1; }
      if (min === max) { min -= Math.abs(min) * 0.02 || 1; max += Math.abs(max) * 0.02 || 1; }
      var top = rect.y + 2, bottom = rect.y + rect.h - 2, h = bottom - top;
      if (log && min > 0) {
        var lmin = Math.log(min), lmax = Math.log(max), lr = lmax - lmin || 1;
        return {
          min: min, max: max, log: true,
          at: function (v) { return M.fin(v) && v > 0 ? bottom - (Math.log(v) - lmin) / lr * h : NaN; },
          inv: function (py) { return Math.exp(lmin + (bottom - py) / h * lr); }
        };
      }
      var r = max - min || 1;
      return {
        min: min, max: max, log: false,
        at: function (v) { return M.fin(v) ? bottom - (v - min) / r * h : NaN; },
        inv: function (py) { return min + (bottom - py) / h * r; }
      };
    }

    /* ── Primitives ─────────────────────────────────────────────── */

    function clipRect(ctx, r) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
    }

    function drawGrid(ctx, rect, xs, ys, ticks, T, xTicks) {
      ctx.save();
      ctx.strokeStyle = T.grid;
      ctx.lineWidth = 1;
      ticks.forEach(function (t) {
        var y = Math.round(ys.at(t)) + 0.5;
        if (y < rect.y || y > rect.y + rect.h) return;
        ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke();
      });
      (xTicks || []).forEach(function (i) {
        var x = Math.round(xs.at(i)) + 0.5;
        if (x < rect.x || x > rect.x + rect.w) return;
        ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke();
      });
      ctx.restore();
    }

    function drawSeries(ctx, rect, xs, ys, values, opt) {
      var started = false, prevNull = true;
      ctx.save();
      ctx.lineWidth = opt.width || 1.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (opt.dash) ctx.setLineDash(opt.dash); else ctx.setLineDash([]);

      if (opt.segmentColor) {
        /* Ligne à couleur variable : chaque segment est tracé seul, ce qui
           permet à SuperTrend de changer de teinte au retournement. */
        for (var i = 1; i < values.length; i++) {
          if (!M.fin(values[i]) || !M.fin(values[i - 1])) continue;
          ctx.strokeStyle = opt.segmentColor(opt.offset != null ? opt.offset + i : i) || opt.color;
          ctx.beginPath();
          ctx.moveTo(xs.at(i - 1), ys.at(values[i - 1]));
          ctx.lineTo(xs.at(i), ys.at(values[i]));
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      if (opt.fill) {
        ctx.beginPath();
        var fillStarted = false, firstX = 0, lastX = 0;
        for (var k = 0; k < values.length; k++) {
          if (!M.fin(values[k])) continue;
          var x = xs.at(k), y = ys.at(values[k]);
          if (!fillStarted) { ctx.moveTo(x, y); firstX = x; fillStarted = true; }
          else ctx.lineTo(x, y);
          lastX = x;
        }
        if (fillStarted) {
          ctx.lineTo(lastX, rect.y + rect.h);
          ctx.lineTo(firstX, rect.y + rect.h);
          ctx.closePath();
          ctx.fillStyle = opt.fill;
          ctx.fill();
        }
      }

      ctx.strokeStyle = opt.color;
      ctx.beginPath();
      for (var j = 0; j < values.length; j++) {
        var v = values[j];
        if (!M.fin(v)) { prevNull = true; continue; }
        var px = xs.at(j), py = ys.at(v);
        if (!M.fin(py)) { prevNull = true; continue; }
        if (prevNull || !started) { ctx.moveTo(px, py); started = true; }
        else if (opt.step) { ctx.lineTo(px, ys.at(values[j - 1])); ctx.lineTo(px, py); }
        else ctx.lineTo(px, py);
        prevNull = false;
      }
      if (started) ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawBand(ctx, xs, ys, upper, lower, color, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha == null ? 0.07 : alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      var started = false, path = [];
      for (var i = 0; i < upper.length; i++) {
        if (!M.fin(upper[i]) || !M.fin(lower[i])) {
          if (started) { closeBand(); started = false; path = []; }
          continue;
        }
        path.push(i);
        started = true;
      }
      if (started) closeBand();
      function closeBand() {
        if (path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(xs.at(path[0]), ys.at(upper[path[0]]));
        for (var k = 1; k < path.length; k++) ctx.lineTo(xs.at(path[k]), ys.at(upper[path[k]]));
        for (var m = path.length - 1; m >= 0; m--) ctx.lineTo(xs.at(path[m]), ys.at(lower[path[m]]));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawCloud(ctx, xs, ys, spanA, spanB, shift, bull, bear, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha == null ? 0.1 : alpha;
      var n = spanA.length;
      for (var i = 1; i < n; i++) {
        var ia = i - shift, ib = i - 1 - shift;
        if (ia < 0 || ib < 0) continue;
        if (!M.fin(spanA[ib]) || !M.fin(spanB[ib]) || !M.fin(spanA[ia]) || !M.fin(spanB[ia])) continue;
        ctx.fillStyle = spanA[ia] >= spanB[ia] ? bull : bear;
        ctx.beginPath();
        ctx.moveTo(xs.at(i - 1), ys.at(spanA[ib]));
        ctx.lineTo(xs.at(i), ys.at(spanA[ia]));
        ctx.lineTo(xs.at(i), ys.at(spanB[ia]));
        ctx.lineTo(xs.at(i - 1), ys.at(spanB[ib]));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawHistogram(ctx, rect, xs, ys, hist) {
      var w = Math.max(1, Math.min(20, xs.slot * 0.66));
      var base = ys.at(hist.baseline != null ? hist.baseline : 0);
      if (!M.fin(base)) base = rect.y + rect.h;
      base = Math.min(rect.y + rect.h, Math.max(rect.y, base));
      for (var i = 0; i < hist.values.length; i++) {
        var v = hist.values[i];
        if (!M.fin(v)) continue;
        var y = ys.at(v);
        if (!M.fin(y)) continue;
        ctx.fillStyle = hist.colorAt ? hist.colorAt(i) : (hist.color || '#888');
        var top = Math.min(y, base), h = Math.max(1, Math.abs(y - base));
        ctx.fillRect(xs.at(i) - w / 2, top, w, h);
      }
    }

    function drawDots(ctx, xs, ys, values, color, radius) {
      ctx.save();
      ctx.fillStyle = color;
      for (var i = 0; i < values.length; i++) {
        if (!M.fin(values[i])) continue;
        var y = ys.at(values[i]);
        if (!M.fin(y)) continue;
        ctx.beginPath();
        ctx.arc(xs.at(i), y, radius || 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawLevels(ctx, rect, ys, levels, T) {
      ctx.save();
      ctx.font = FONT_SM;
      levels.forEach(function (lv) {
        var y = ys.at(lv.value);
        if (!M.fin(y) || y < rect.y - 1 || y > rect.y + rect.h + 1) return;
        ctx.strokeStyle = lv.color || T.gridStrong;
        ctx.lineWidth = lv.width || 1;
        ctx.setLineDash(lv.dash || []);
        ctx.beginPath();
        ctx.moveTo(rect.x, Math.round(y) + 0.5);
        ctx.lineTo(rect.x + rect.w, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        if (lv.label) {
          ctx.fillStyle = lv.color || T.dim;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(lv.label, rect.x + 5, y - 2);
        }
      });
      ctx.restore();
    }

    /* ── Bougies ────────────────────────────────────────────────── */

    function drawPriceBody(ctx, rect, xs, ys, bars, type, T) {
      var n = bars.length;
      var w = Math.max(1, Math.min(22, xs.slot * 0.68));
      var thin = w < 2.4;

      if (type === 'line' || type === 'area' || type === 'baseline') {
        var closes = bars.map(function (b) { return b.c; });
        if (type === 'area') {
          var grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
          grad.addColorStop(0, 'rgba(200,162,78,.22)');
          grad.addColorStop(1, 'rgba(200,162,78,0)');
          drawSeries(ctx, rect, xs, ys, closes, { color: T.gold, width: 2, fill: grad });
        } else if (type === 'baseline') {
          var first = null;
          for (var q = 0; q < closes.length; q++) if (M.fin(closes[q])) { first = closes[q]; break; }
          if (first !== null) {
            var by = ys.at(first);
            ctx.save();
            ctx.strokeStyle = T.dim; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(rect.x, by); ctx.lineTo(rect.x + rect.w, by); ctx.stroke();
            ctx.restore();
            for (var s = 1; s < closes.length; s++) {
              if (!M.fin(closes[s]) || !M.fin(closes[s - 1])) continue;
              ctx.strokeStyle = closes[s] >= first ? T.up : T.down;
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(xs.at(s - 1), ys.at(closes[s - 1]));
              ctx.lineTo(xs.at(s), ys.at(closes[s]));
              ctx.stroke();
            }
          }
        } else {
          drawSeries(ctx, rect, xs, ys, closes, { color: T.gold, width: 2 });
        }
        return;
      }

      for (var i = 0; i < n; i++) {
        var b = bars[i];
        if (!M.fin(b.c)) continue;
        var o = M.fin(b.o) ? b.o : b.c, h = M.fin(b.h) ? b.h : b.c, l = M.fin(b.l) ? b.l : b.c;
        var up = b.c >= o;
        var col = up ? T.up : T.down;
        var x = xs.at(i);
        var yH = ys.at(h), yL = ys.at(l), yO = ys.at(o), yC = ys.at(b.c);

        if (type === 'bar') {
          ctx.strokeStyle = col;
          ctx.lineWidth = thin ? 1 : 1.3;
          ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - w / 2, yO); ctx.lineTo(x, yO); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, yC); ctx.lineTo(x + w / 2, yC); ctx.stroke();
          continue;
        }

        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, yH);
        ctx.lineTo(Math.round(x) + 0.5, yL);
        ctx.stroke();

        var top = Math.min(yO, yC);
        var bh = Math.max(1, Math.abs(yC - yO));
        if (thin) {
          ctx.fillStyle = col;
          ctx.fillRect(x - Math.max(0.5, w / 2), top, Math.max(1, w), bh);
        } else if (type === 'hollow' && up) {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(Math.round(x - w / 2) + 0.5, Math.round(top) + 0.5, Math.round(w), Math.round(bh));
        } else {
          ctx.fillStyle = col;
          ctx.fillRect(Math.round(x - w / 2), Math.round(top), Math.round(w), Math.round(bh));
        }
      }
    }

    /* ── Axes ───────────────────────────────────────────────────── */

    function drawPriceAxis(ctx, layout, rect, ys, ticks, T, kind) {
      ctx.save();
      ctx.fillStyle = T.axisBg;
      ctx.fillRect(layout.axisX, rect.y - 2, layout.axisW, rect.h + 4);
      ctx.font = FONT_SM;
      ctx.fillStyle = T.dim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ticks.forEach(function (t) {
        var y = ys.at(t);
        if (!M.fin(y) || y < rect.y + 4 || y > rect.y + rect.h - 2) return;
        ctx.fillText(fmtAuto(t, kind), layout.axisX + 7, y);
      });
      ctx.strokeStyle = T.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(layout.axisX + 0.5, rect.y - 2);
      ctx.lineTo(layout.axisX + 0.5, rect.y + rect.h + 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawTimeAxis(ctx, layout, xs, bars, interval, T, xTicks) {
      ctx.save();
      ctx.font = FONT_SM;
      ctx.fillStyle = T.dim;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      var y = layout.timeY + 5;
      xTicks.forEach(function (i) {
        var b = bars[i];
        if (!b) return;
        var x = xs.at(i);
        if (x < 26 || x > layout.chartW - 26) return;
        ctx.fillText(fmtDate(b.date, interval), x, y);
      });
      ctx.strokeStyle = T.grid;
      ctx.beginPath();
      ctx.moveTo(0, layout.timeY + 0.5);
      ctx.lineTo(layout.chartW, layout.timeY + 0.5);
      ctx.stroke();
      ctx.restore();
    }

    function drawTag(ctx, x, y, text, bg, fg, align) {
      ctx.save();
      ctx.font = FONT_SM;
      var w = ctx.measureText(text).width + 12;
      var h = 16;
      var rx = align === 'right' ? x : x - w / 2;
      ctx.fillStyle = bg;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(rx, y - h / 2, w, h, 3); ctx.fill(); }
      else ctx.fillRect(rx, y - h / 2, w, h);
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, rx + w / 2, y);
      ctx.restore();
      return { x: rx, y: y - h / 2, w: w, h: h };
    }

    /* ── Dessins de l'utilisateur ───────────────────────────────── */

    var FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];

    function drawUserShapes(ctx, rect, xs, ys, shapes, offset, T, activeId) {
      if (!shapes || !shapes.length) return;
      ctx.save();
      ctx.font = FONT_SM;
      shapes.forEach(function (s) {
        var col = s.color || T.gold;
        var sel = s.id && s.id === activeId;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = sel ? 2.2 : (s.width || 1.4);
        ctx.setLineDash(s.dash || []);
        var p = (s.points || []).map(function (pt) {
          return { x: xs.at(pt.x - offset), y: ys.at(pt.y) };
        });

        if (s.type === 'hline' && p[0]) {
          ctx.beginPath(); ctx.moveTo(rect.x, p[0].y); ctx.lineTo(rect.x + rect.w, p[0].y); ctx.stroke();
          ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
          ctx.fillText(fmtPrice(s.points[0].y), rect.x + 6, p[0].y - 3);
        } else if (s.type === 'vline' && p[0]) {
          ctx.beginPath(); ctx.moveTo(p[0].x, rect.y); ctx.lineTo(p[0].x, rect.y + rect.h); ctx.stroke();
        } else if (s.type === 'trend' && p[1]) {
          ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
          if (s.extend) {
            var dx = p[1].x - p[0].x, dy = p[1].y - p[0].y;
            if (dx !== 0) {
              var k = (rect.x + rect.w - p[1].x) / dx;
              ctx.setLineDash([4, 4]);
              ctx.beginPath(); ctx.moveTo(p[1].x, p[1].y); ctx.lineTo(rect.x + rect.w, p[1].y + dy * k); ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        } else if (s.type === 'arrow' && p[1]) {
          ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
          var ang = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
          ctx.beginPath();
          ctx.moveTo(p[1].x, p[1].y);
          ctx.lineTo(p[1].x - 9 * Math.cos(ang - 0.4), p[1].y - 9 * Math.sin(ang - 0.4));
          ctx.lineTo(p[1].x - 9 * Math.cos(ang + 0.4), p[1].y - 9 * Math.sin(ang + 0.4));
          ctx.closePath(); ctx.fill();
        } else if (s.type === 'rect' && p[1]) {
          ctx.globalAlpha = 0.10;
          ctx.fillRect(p[0].x, p[0].y, p[1].x - p[0].x, p[1].y - p[0].y);
          ctx.globalAlpha = 1;
          ctx.strokeRect(p[0].x, p[0].y, p[1].x - p[0].x, p[1].y - p[0].y);
        } else if (s.type === 'fib' && p[1]) {
          var y0 = s.points[0].y, y1 = s.points[1].y;
          var x0 = Math.min(p[0].x, p[1].x), x1 = Math.max(p[0].x, p[1].x);
          FIB_LEVELS.forEach(function (lv) {
            var val = y0 + (y1 - y0) * lv;
            var yy = ys.at(val);
            if (!M.fin(yy)) return;
            ctx.globalAlpha = lv === 0 || lv === 1 ? 0.85 : 0.55;
            ctx.beginPath();
            ctx.moveTo(x0, yy);
            ctx.lineTo(s.extend ? rect.x + rect.w : x1, yy);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            ctx.fillText((lv * 100).toFixed(1) + '% · ' + fmtPrice(val), x0 + 4, yy - 2);
          });
          ctx.globalAlpha = 0.35;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
        } else if (s.type === 'channel' && p[2]) {
          var ddx = p[1].x - p[0].x, ddy = p[1].y - p[0].y;
          ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p[2].x, p[2].y); ctx.lineTo(p[2].x + ddx, p[2].y + ddy); ctx.stroke();
          ctx.globalAlpha = 0.07;
          ctx.beginPath();
          ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y);
          ctx.lineTo(p[2].x + ddx, p[2].y + ddy); ctx.lineTo(p[2].x, p[2].y);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (s.type === 'pitch' && p[2]) {
          var mx = (p[1].x + p[2].x) / 2, my = (p[1].y + p[2].y) / 2;
          var vx = mx - p[0].x, vy = my - p[0].y;
          var len = Math.hypot(vx, vy) || 1;
          var ext = (rect.w * 1.4) / len;
          [[p[0].x, p[0].y], [p[1].x, p[1].y], [p[2].x, p[2].y]].forEach(function (o, k) {
            ctx.globalAlpha = k === 0 ? 1 : 0.7;
            ctx.beginPath();
            ctx.moveTo(o[0], o[1]);
            ctx.lineTo(o[0] + vx * ext, o[1] + vy * ext);
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
        } else if (s.type === 'measure' && p[1]) {
          var a = s.points[0], b = s.points[1];
          var pct = a.y ? (b.y - a.y) / a.y * 100 : 0;
          var bars = Math.abs(Math.round(b.x - a.x));
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = pct >= 0 ? T.up : T.down;
          ctx.fillRect(p[0].x, p[0].y, p[1].x - p[0].x, p[1].y - p[0].y);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = pct >= 0 ? T.up : T.down;
          ctx.strokeRect(p[0].x, p[0].y, p[1].x - p[0].x, p[1].y - p[0].y);
          var txt = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '% · ' + fmtPrice(b.y - a.y) + ' · ' + bars + ' séances';
          drawTag(ctx, (p[0].x + p[1].x) / 2, p[1].y + (p[1].y > p[0].y ? 14 : -14), txt, pct >= 0 ? T.up : T.down, T.tagText);
        } else if (s.type === 'text' && p[0]) {
          ctx.font = FONT_LBL;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(s.text || '', p[0].x + 4, p[0].y);
          ctx.font = FONT_SM;
        }

        if (sel) {
          ctx.setLineDash([]);
          p.forEach(function (pt) {
            if (!M.fin(pt.x) || !M.fin(pt.y)) return;
            ctx.fillStyle = T.bg;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          });
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    }

    /* ── Repères automatiques ───────────────────────────────────── */

    function drawAutoLevels(ctx, rect, ys, levels, T) {
      if (!levels || !levels.length) return;
      ctx.save();
      ctx.font = FONT_SM;
      levels.forEach(function (lv) {
        var y = ys.at(lv.value);
        if (!M.fin(y) || y < rect.y || y > rect.y + rect.h) return;
        var col = lv.type === 'resistance' ? T.down : T.up;
        ctx.globalAlpha = 0.28 + Math.min(0.4, lv.touches * 0.07);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(rect.x, Math.round(y) + 0.5);
        ctx.lineTo(rect.x + rect.w, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = col;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtPrice(lv.value) + '  ×' + lv.touches, rect.x + rect.w - 6, y - 2);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    }

    function drawMarkers(ctx, rect, xs, ys, markers, offset, T) {
      if (!markers || !markers.length) return;
      ctx.save();
      ctx.font = FONT_SM;
      markers.forEach(function (mk) {
        var i = mk.index - offset;
        if (i < 0) return;
        var x = xs.at(i);
        if (x < rect.x - 10 || x > rect.x + rect.w + 10) return;
        var y = ys.at(mk.price);
        if (!M.fin(y)) return;
        var up = mk.bias > 0;
        var col = up ? T.up : mk.bias < 0 ? T.down : T.dim;
        var oy = up ? y + 16 : y - 16;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        if (up) { ctx.moveTo(x, oy - 8); ctx.lineTo(x - 5, oy); ctx.lineTo(x + 5, oy); }
        else { ctx.moveTo(x, oy + 8); ctx.lineTo(x - 5, oy); ctx.lineTo(x + 5, oy); }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    }

    /* ── Rendu principal ────────────────────────────────────────── */

    api.render = function (view) {
      api.view = view;
      resize();
      var T = api.T = theme(view.light);
      var ctx = ctxB;
      ctx.save();
      ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
      ctx.clearRect(0, 0, api.width, api.height);

      var bars = view.bars || [];
      if (!bars.length) {
        ctx.fillStyle = T.dim;
        ctx.font = FONT_LBL;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(view.emptyMessage || 'Aucune donnée à afficher', api.width / 2, api.height / 2);
        ctx.restore();
        return;
      }

      var layout = api.layout = computeLayout(view);
      var offset = view.offset || 0;
      /* Marge à droite pour laisser respirer la dernière bougie et
         accueillir la projection du nuage Ichimoku. */
      var rightPad = Math.max(0, view.rightPad || 0);
      var xs = makeXScale(layout.price, bars.length + rightPad, 0);

      /* Échelle des prix : bornes issues des bougies visibles, élargies
         par les indicateurs superposés pour qu'aucun ne sorte du cadre. */
      var lo = Infinity, hi = -Infinity;
      bars.forEach(function (b) {
        if (M.fin(b.l)) lo = Math.min(lo, b.l);
        if (M.fin(b.h)) hi = Math.max(hi, b.h);
        if (M.fin(b.c)) { lo = Math.min(lo, b.c); hi = Math.max(hi, b.c); }
      });
      (view.overlays || []).forEach(function (ov) {
        (ov.lines || []).forEach(function (ln) {
          if (ln.hideFromScale) return;
          ln.values.forEach(function (v) { if (M.fin(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
        });
        (ov.bands || []).forEach(function (bd) {
          bd.upper.forEach(function (v) { if (M.fin(v)) hi = Math.max(hi, v); });
          bd.lower.forEach(function (v) { if (M.fin(v)) lo = Math.min(lo, v); });
        });
        (ov.levels || []).forEach(function (lv) { if (M.fin(lv.value)) { lo = Math.min(lo, lv.value); hi = Math.max(hi, lv.value); } });
        (ov.dots || []).forEach(function (dt) {
          dt.values.forEach(function (v) { if (M.fin(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
        });
      });
      if (!M.fin(lo) || !M.fin(hi)) { lo = 0; hi = 1; }
      var span = hi - lo || Math.abs(hi) * 0.05 || 1;
      lo -= span * 0.06; hi += span * 0.08;
      if (view.log && lo <= 0) lo = Math.max(1e-6, hi * 0.0001);

      var ys = makeYScale(layout.price, lo, hi, view.log);
      var ticks = niceTicks(lo, hi, Math.max(3, Math.floor(layout.price.h / 46)));
      var tickCount = Math.max(3, Math.min(9, Math.floor(layout.chartW / 110)));
      var xTicks = [];
      for (var t = 0; t < tickCount; t++) xTicks.push(Math.round(t * (bars.length - 1) / Math.max(1, tickCount - 1)));

      drawGrid(ctx, layout.price, xs, ys, ticks, T, xTicks);

      clipRect(ctx, layout.price);
      (view.overlays || []).forEach(function (ov) {
        if (ov.cloud) drawCloud(ctx, xs, ys, ov.cloud.spanA, ov.cloud.spanB, ov.cloud.shift, ov.cloud.bull, ov.cloud.bear, ov.cloud.alpha);
        (ov.bands || []).forEach(function (bd) { drawBand(ctx, xs, ys, bd.upper, bd.lower, bd.color, bd.alpha); });
      });
      if (view.autoLevels) drawAutoLevels(ctx, layout.price, ys, view.autoLevels, T);
      (view.overlays || []).forEach(function (ov) {
        if (ov.levels) drawLevels(ctx, layout.price, ys, ov.levels, T);
      });

      drawPriceBody(ctx, layout.price, xs, ys, bars, view.type || 'candle', T);

      (view.overlays || []).forEach(function (ov) {
        (ov.lines || []).forEach(function (ln) {
          var vals = ln.values;
          if (ln.shift) {
            var shifted = new Array(vals.length);
            for (var i = 0; i < vals.length; i++) {
              var j = i - ln.shift;
              shifted[i] = j >= 0 && j < vals.length ? vals[j] : null;
            }
            vals = shifted;
          }
          drawSeries(ctx, layout.price, xs, ys, vals, ln);
        });
        (ov.dots || []).forEach(function (dt) { drawDots(ctx, xs, ys, dt.values, dt.color, dt.radius); });
      });

      if (view.compare && view.compare.values) {
        /* La série comparée est ramenée dans l'échelle du titre courant.
           Seule sa forme est comparable, jamais son niveau : c'est indiqué
           dans la légende. */
        var cv = view.compare.values;
        var cmin = Infinity, cmax = -Infinity;
        cv.forEach(function (v) { if (M.fin(v)) { cmin = Math.min(cmin, v); cmax = Math.max(cmax, v); } });
        if (M.fin(cmin) && cmax > cmin) {
          var mapped = cv.map(function (v) { return M.fin(v) ? lo + (v - cmin) / (cmax - cmin) * (hi - lo) : null; });
          drawSeries(ctx, layout.price, xs, ys, mapped, { color: view.compare.color || '#5b9dfb', width: 1.6, dash: [5, 3] });
        }
      }

      if (view.patternShapes) {
        ctx.save();
        ctx.setLineDash([4, 3]);
        view.patternShapes.forEach(function (ps) {
          ctx.strokeStyle = ps.bias > 0 ? T.up : ps.bias < 0 ? T.down : T.dim;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.75;
          var a = ps.from - offset, b = ps.to - offset;
          if (M.fin(ps.neckline)) {
            var ny = ys.at(ps.neckline);
            ctx.beginPath(); ctx.moveTo(xs.at(a), ny); ctx.lineTo(xs.at(b), ny); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        });
        ctx.setLineDash([]);
        ctx.restore();
      }

      drawMarkers(ctx, layout.price, xs, ys, view.markers, offset, T);
      drawUserShapes(ctx, layout.price, xs, ys, view.shapes, offset, T, view.activeShapeId);
      ctx.restore(); /* clip prix */

      /* Étiquette du dernier cours */
      var lastBar = null;
      for (var z = bars.length - 1; z >= 0; z--) if (M.fin(bars[z].c)) { lastBar = bars[z]; break; }
      if (lastBar) {
        var lastPrice = view.livePrice != null && M.fin(view.livePrice) ? view.livePrice : lastBar.c;
        var ly = ys.at(lastPrice);
        if (M.fin(ly) && ly > layout.price.y && ly < layout.price.y + layout.price.h) {
          ctx.save();
          ctx.strokeStyle = view.liveUp === false ? T.down : view.liveUp === true ? T.up : T.gold;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.65;
          ctx.beginPath(); ctx.moveTo(0, Math.round(ly) + 0.5); ctx.lineTo(layout.chartW, Math.round(ly) + 0.5); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
          drawTag(ctx, layout.axisX + 2, ly, fmtPrice(lastPrice), view.liveUp === false ? T.down : T.up, T.tagText, 'right');
          ctx.restore();
        }
      }

      drawPriceAxis(ctx, layout, layout.price, ys, ticks, T);

      /* ── Panneaux ── */
      var paneScales = [];
      layout.panes.forEach(function (rect) {
        var pane = rect.pane;
        var pmin = Infinity, pmax = -Infinity;
        function scan(v) { if (M.fin(v)) { pmin = Math.min(pmin, v); pmax = Math.max(pmax, v); } }
        (pane.lines || []).forEach(function (ln) { ln.values.forEach(scan); });
        if (pane.histogram) pane.histogram.values.forEach(scan);
        (pane.levels || []).forEach(function (lv) { scan(lv.value); });
        if (pane.scale) {
          if (pane.scale[0] != null) pmin = pane.scale[0];
          if (pane.scale[1] != null) pmax = pane.scale[1];
        }
        if (!M.fin(pmin) || !M.fin(pmax)) { pmin = 0; pmax = 1; }
        if (pane.zeroBase && pmin > 0) pmin = 0;
        if (pmin === pmax) { pmin -= 1; pmax += 1; }
        var pad = (pmax - pmin) * 0.08;
        if (!pane.scale || pane.scale[0] == null) pmin -= pad;
        if (!pane.scale || pane.scale[1] == null) pmax += pad;

        var pys = makeYScale(rect, pmin, pmax, false);
        paneScales.push({ rect: rect, ys: pys, pane: pane });

        var pticks = niceTicks(pmin, pmax, Math.max(2, Math.floor(rect.h / 34)));
        ctx.save();
        ctx.strokeStyle = T.paneSep;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(rect.y) - PANE_GAP / 2 + 0.5);
        ctx.lineTo(layout.chartW + layout.axisW, Math.round(rect.y) - PANE_GAP / 2 + 0.5);
        ctx.stroke();
        ctx.restore();

        drawGrid(ctx, rect, xs, pys, pticks, T, xTicks);

        clipRect(ctx, rect);
        (pane.zones || []).forEach(function (z) {
          var y1 = pys.at(z.to), y2 = pys.at(z.from);
          if (!M.fin(y1) || !M.fin(y2)) return;
          ctx.fillStyle = z.color;
          ctx.fillRect(rect.x, Math.min(y1, y2), rect.w, Math.abs(y2 - y1));
        });
        if (pane.levels) drawLevels(ctx, rect, pys, pane.levels, T);
        if (pane.histogram) drawHistogram(ctx, rect, xs, pys, pane.histogram);
        (pane.lines || []).forEach(function (ln) { drawSeries(ctx, rect, xs, pys, ln.values, ln); });
        ctx.restore();

        drawPriceAxis(ctx, layout, rect, pys, pticks, T, pane.format);

        /* Titre du panneau et dernières valeurs */
        ctx.save();
        ctx.font = FONT_LBL;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = T.dim;
        var lx = rect.x + 6;
        ctx.fillText(pane.title || '', lx, rect.y + 3);
        lx += ctx.measureText(pane.title || '').width + 10;
        ctx.font = FONT_SM;
        var idx = view.cursorIndex != null ? view.cursorIndex : bars.length - 1;
        (pane.lines || []).forEach(function (ln) {
          if (ln.hideLabel) return;
          var v = M.fin(ln.values[idx]) ? ln.values[idx] : M.last(ln.values);
          ctx.fillStyle = ln.color;
          var txt = ln.label + ' ' + (M.fin(v) ? (pane.format === 'volume' ? fmtVolume(v) : fmtPrice(v, 2)) : '—');
          ctx.fillText(txt, lx, rect.y + 4);
          lx += ctx.measureText(txt).width + 12;
        });
        if (pane.histogram && !pane.lines) {
          var hv = pane.histogram.values[idx];
          ctx.fillStyle = T.dim;
          ctx.fillText(M.fin(hv) ? (pane.format === 'volume' ? fmtVolume(hv) : fmtPrice(hv, 2)) : '—', lx, rect.y + 4);
        }
        ctx.restore();
      });

      drawTimeAxis(ctx, layout, xs, bars, view.interval, T, xTicks);

      api._xs = xs;
      api._ys = ys;
      api._paneScales = paneScales;
      api._offset = offset;
      ctx.restore();

      api.renderOverlay();
    };

    /* ── Réticule ───────────────────────────────────────────────── */

    api.renderOverlay = function () {
      var view = api.view;
      if (!view) return;
      var ctx = ctxO;
      ctx.save();
      ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
      ctx.clearRect(0, 0, api.width, api.height);

      var layout = api.layout;
      if (!layout || !view.bars || !view.bars.length) { ctx.restore(); return; }
      var T = api.T;
      var xs = api._xs, ys = api._ys;

      /* Aperçu de l'outil de dessin en cours */
      if (view.preview && view.preview.points && view.preview.points.length) {
        clipRect(ctx, layout.price);
        drawUserShapes(ctx, layout.price, xs, ys, [view.preview], api._offset, T, null);
        ctx.restore();
      }

      var cur = api.cursor;
      if (!cur || !view.crosshair) { ctx.restore(); return; }
      var i = Math.round(xs.inv(cur.x));
      if (i < 0) i = 0;
      if (i > view.bars.length - 1) i = view.bars.length - 1;
      var cx = xs.at(i);
      if (cx < 0 || cx > layout.chartW) { ctx.restore(); return; }

      ctx.strokeStyle = T.crossLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(Math.round(cx) + 0.5, layout.price.y);
      ctx.lineTo(Math.round(cx) + 0.5, layout.timeY);
      ctx.stroke();

      var inPrice = cur.y >= layout.price.y && cur.y <= layout.price.y + layout.price.h;
      var activePane = null;
      (api._paneScales || []).forEach(function (ps) {
        if (cur.y >= ps.rect.y && cur.y <= ps.rect.y + ps.rect.h) activePane = ps;
      });
      if (inPrice || activePane) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(cur.y) + 0.5);
        ctx.lineTo(layout.chartW, Math.round(cur.y) + 0.5);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      if (inPrice) {
        drawTag(ctx, layout.axisX + 2, cur.y, fmtPrice(ys.inv(cur.y)), T.gold, T.tagText, 'right');
      } else if (activePane) {
        drawTag(ctx, layout.axisX + 2, cur.y,
          activePane.pane.format === 'volume' ? fmtVolume(activePane.ys.inv(cur.y)) : fmtPrice(activePane.ys.inv(cur.y), 2),
          T.gold, T.tagText, 'right');
      }

      var b = view.bars[i];
      if (b) drawTag(ctx, cx, layout.timeY + 11, fmtDate(b.date, view.interval), T.gold, T.tagText);

      ctx.restore();
      if (typeof view.onCursor === 'function') view.onCursor(i, b);
    };

    api.setCursor = function (pt) { api.cursor = pt; api.renderOverlay(); };

    /* ── Conversions pixel ⇄ données ────────────────────────────── */

    api.toData = function (px, py) {
      if (!api._xs || !api._ys) return null;
      return {
        x: api._xs.inv(px) + (api._offset || 0),
        y: api._ys.inv(py),
        index: Math.round(api._xs.inv(px)) + (api._offset || 0)
      };
    };
    api.inPricePane = function (py) {
      if (!api.layout) return false;
      return py >= api.layout.price.y && py <= api.layout.price.y + api.layout.price.h;
    };
    api.paneAt = function (py) {
      var found = null;
      (api._paneScales || []).forEach(function (ps) {
        if (py >= ps.rect.y && py <= ps.rect.y + ps.rect.h) found = ps;
      });
      return found;
    };
    api.exportPNG = function (name) {
      var out = document.createElement('canvas');
      out.width = base.width; out.height = base.height;
      var c = out.getContext('2d');
      c.fillStyle = api.T.bg;
      c.fillRect(0, 0, out.width, out.height);
      c.drawImage(base, 0, 0);
      var a = document.createElement('a');
      a.download = (name || 'graphique') + '.png';
      a.href = out.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    return api;
  }

  global.ATChart = {
    create: create,
    fmtPrice: fmtPrice,
    fmtVolume: fmtVolume,
    fmtDate: fmtDate,
    fmtDateLong: fmtDateLong,
    niceTicks: niceTicks,
    AXIS_W: AXIS_W
  };
})(typeof window !== 'undefined' ? window : globalThis);
