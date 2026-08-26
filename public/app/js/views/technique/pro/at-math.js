/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE TECHNIQUE PRO
   at-math.js : bibliothèque de calcul.

   Fonctions pures, sans dépendance au DOM, sans appel réseau.
   Aucune API, aucun endpoint, aucune source de données n'est touché
   par ce fichier : il ne fait que transformer des tableaux de nombres.

   Convention de série : un tableau aligné sur les bougies, de même
   longueur qu'elles, dont les premières valeurs valent null tant que
   la fenêtre de calcul n'est pas remplie. Aucune valeur n'est
   inventée pour combler un début de série.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ATMath) return;

  var SEANCES_AN = 252;

  /* ── Utilitaires numériques ───────────────────────────────────── */

  function num(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var n = Number(String(v).replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function nulls(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = null; return a; }
  function last(a) { if (!a || !a.length) return null; for (var i = a.length - 1; i >= 0; i--) if (a[i] !== null && a[i] !== undefined && !(typeof a[i] === 'number' && isNaN(a[i]))) return a[i]; return null; }
  function lastIdx(a) { if (!a) return -1; for (var i = a.length - 1; i >= 0; i--) if (fin(a[i])) return i; return -1; }
  function mean(a) { if (!a.length) return NaN; var s = 0, k = 0; for (var i = 0; i < a.length; i++) if (fin(a[i])) { s += a[i]; k++; } return k ? s / k : NaN; }
  function variance(a, sample) {
    var vals = a.filter(fin); if (vals.length < 2) return NaN;
    var m = mean(vals), s = 0;
    for (var i = 0; i < vals.length; i++) s += (vals[i] - m) * (vals[i] - m);
    return s / (sample === false ? vals.length : vals.length - 1);
  }
  function stdev(a, sample) { var v = variance(a, sample); return fin(v) ? Math.sqrt(v) : NaN; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) if (fin(a[i])) s += a[i]; return s; }
  function quantile(sorted, p) {
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * p, base = Math.floor(pos), rest = pos - base;
    return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function round(v, d) { var f = Math.pow(10, d || 0); return Math.round(v * f) / f; }

  /* ── Moyennes ─────────────────────────────────────────────────── */

  function sma(src, n) {
    var out = nulls(src.length), acc = 0, count = 0;
    for (var i = 0; i < src.length; i++) {
      var v = src[i];
      if (!fin(v)) { acc = 0; count = 0; continue; }
      acc += v; count++;
      if (count > n) { acc -= src[i - n]; count = n; }
      if (count === n) out[i] = acc / n;
    }
    return out;
  }

  function ema(src, n) {
    var out = nulls(src.length), k = 2 / (n + 1), prev = null, seed = 0, seen = 0;
    for (var i = 0; i < src.length; i++) {
      var v = src[i];
      if (!fin(v)) continue;
      if (prev === null) {
        seed += v; seen++;
        if (seen === n) { prev = seed / n; out[i] = prev; }
        continue;
      }
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  /* Moyenne mobile de Wilder : lissage utilisé par RSI, ATR et ADX. */
  function rma(src, n) {
    var out = nulls(src.length), prev = null, seed = 0, seen = 0;
    for (var i = 0; i < src.length; i++) {
      var v = src[i];
      if (!fin(v)) continue;
      if (prev === null) {
        seed += v; seen++;
        if (seen === n) { prev = seed / n; out[i] = prev; }
        continue;
      }
      prev = (prev * (n - 1) + v) / n;
      out[i] = prev;
    }
    return out;
  }

  function wma(src, n) {
    var out = nulls(src.length), denom = n * (n + 1) / 2;
    for (var i = n - 1; i < src.length; i++) {
      var s = 0, ok = true;
      for (var j = 0; j < n; j++) { var v = src[i - j]; if (!fin(v)) { ok = false; break; } s += v * (n - j); }
      if (ok) out[i] = s / denom;
    }
    return out;
  }

  /* Hull : réactive sans le retard des moyennes classiques. */
  function hma(src, n) {
    var half = wma(src, Math.max(1, Math.round(n / 2)));
    var full = wma(src, n);
    var diff = src.map(function (_, i) { return fin(half[i]) && fin(full[i]) ? 2 * half[i] - full[i] : null; });
    return wma(diff, Math.max(1, Math.round(Math.sqrt(n))));
  }

  function dema(src, n) {
    var e1 = ema(src, n), e2 = ema(e1.map(function (v) { return fin(v) ? v : null; }), n);
    return src.map(function (_, i) { return fin(e1[i]) && fin(e2[i]) ? 2 * e1[i] - e2[i] : null; });
  }

  function tema(src, n) {
    var e1 = ema(src, n), e2 = ema(e1, n), e3 = ema(e2, n);
    return src.map(function (_, i) { return fin(e1[i]) && fin(e2[i]) && fin(e3[i]) ? 3 * e1[i] - 3 * e2[i] + e3[i] : null; });
  }

  function movingAverage(kind, src, n) {
    switch (String(kind || 'sma').toLowerCase()) {
      case 'ema': return ema(src, n);
      case 'wma': return wma(src, n);
      case 'hma': return hma(src, n);
      case 'dema': return dema(src, n);
      case 'tema': return tema(src, n);
      case 'rma': return rma(src, n);
      default: return sma(src, n);
    }
  }

  /* ── Volatilité et enveloppes ─────────────────────────────────── */

  function bollinger(src, n, mult) {
    n = n || 20; mult = mult || 2;
    var mid = sma(src, n), up = nulls(src.length), lo = nulls(src.length), bw = nulls(src.length), pb = nulls(src.length);
    for (var i = n - 1; i < src.length; i++) {
      if (!fin(mid[i])) continue;
      var s = 0, ok = true;
      for (var j = 0; j < n; j++) { var v = src[i - j]; if (!fin(v)) { ok = false; break; } s += (v - mid[i]) * (v - mid[i]); }
      if (!ok) continue;
      var sd = Math.sqrt(s / n);
      up[i] = mid[i] + mult * sd;
      lo[i] = mid[i] - mult * sd;
      bw[i] = mid[i] ? (up[i] - lo[i]) / mid[i] * 100 : null;
      pb[i] = up[i] !== lo[i] ? (src[i] - lo[i]) / (up[i] - lo[i]) : 0.5;
    }
    return { mid: mid, upper: up, lower: lo, width: bw, percentB: pb };
  }

  function trueRange(h, l, c) {
    var out = nulls(h.length);
    for (var i = 0; i < h.length; i++) {
      if (!fin(h[i]) || !fin(l[i])) continue;
      out[i] = i === 0 || !fin(c[i - 1]) ? h[i] - l[i]
        : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    }
    return out;
  }

  function atr(h, l, c, n) { return rma(trueRange(h, l, c), n || 14); }

  function keltner(h, l, c, n, mult) {
    n = n || 20; mult = mult || 2;
    var mid = ema(c, n), a = atr(h, l, c, n);
    return {
      mid: mid,
      upper: c.map(function (_, i) { return fin(mid[i]) && fin(a[i]) ? mid[i] + mult * a[i] : null; }),
      lower: c.map(function (_, i) { return fin(mid[i]) && fin(a[i]) ? mid[i] - mult * a[i] : null; })
    };
  }

  function donchian(h, l, n) {
    n = n || 20;
    var up = nulls(h.length), lo = nulls(h.length), mid = nulls(h.length);
    for (var i = n - 1; i < h.length; i++) {
      var hi = -Infinity, low = Infinity, ok = true;
      for (var j = 0; j < n; j++) {
        if (!fin(h[i - j]) || !fin(l[i - j])) { ok = false; break; }
        if (h[i - j] > hi) hi = h[i - j];
        if (l[i - j] < low) low = l[i - j];
      }
      if (!ok) continue;
      up[i] = hi; lo[i] = low; mid[i] = (hi + low) / 2;
    }
    return { upper: up, lower: lo, mid: mid };
  }

  /* ── Momentum ─────────────────────────────────────────────────── */

  function rsi(src, n) {
    n = n || 14;
    var gains = nulls(src.length), losses = nulls(src.length);
    for (var i = 1; i < src.length; i++) {
      if (!fin(src[i]) || !fin(src[i - 1])) continue;
      var d = src[i] - src[i - 1];
      gains[i] = d > 0 ? d : 0;
      losses[i] = d < 0 ? -d : 0;
    }
    var ag = rma(gains, n), al = rma(losses, n);
    return src.map(function (_, i) {
      if (!fin(ag[i]) || !fin(al[i])) return null;
      if (al[i] === 0) return 100;
      var rs = ag[i] / al[i];
      return 100 - 100 / (1 + rs);
    });
  }

  function stochRsi(src, nRsi, nStoch, kSmooth, dSmooth) {
    nRsi = nRsi || 14; nStoch = nStoch || 14; kSmooth = kSmooth || 3; dSmooth = dSmooth || 3;
    var r = rsi(src, nRsi), raw = nulls(src.length);
    for (var i = 0; i < src.length; i++) {
      if (!fin(r[i])) continue;
      var hi = -Infinity, lo = Infinity, ok = true;
      for (var j = 0; j < nStoch; j++) {
        var v = r[i - j];
        if (!fin(v)) { ok = false; break; }
        if (v > hi) hi = v; if (v < lo) lo = v;
      }
      if (!ok) continue;
      raw[i] = hi === lo ? 50 : (r[i] - lo) / (hi - lo) * 100;
    }
    var k = sma(raw, kSmooth);
    return { k: k, d: sma(k, dSmooth) };
  }

  function stochastic(h, l, c, nK, smoothK, nD) {
    nK = nK || 14; smoothK = smoothK || 1; nD = nD || 3;
    var raw = nulls(c.length);
    for (var i = nK - 1; i < c.length; i++) {
      var hi = -Infinity, lo = Infinity, ok = true;
      for (var j = 0; j < nK; j++) {
        if (!fin(h[i - j]) || !fin(l[i - j])) { ok = false; break; }
        if (h[i - j] > hi) hi = h[i - j];
        if (l[i - j] < lo) lo = l[i - j];
      }
      if (!ok || !fin(c[i])) continue;
      raw[i] = hi === lo ? 50 : (c[i] - lo) / (hi - lo) * 100;
    }
    var k = smoothK > 1 ? sma(raw, smoothK) : raw;
    return { k: k, d: sma(k, nD) };
  }

  function macd(src, fast, slow, signal) {
    fast = fast || 12; slow = slow || 26; signal = signal || 9;
    var ef = ema(src, fast), es = ema(src, slow);
    var line = src.map(function (_, i) { return fin(ef[i]) && fin(es[i]) ? ef[i] - es[i] : null; });
    var sig = ema(line, signal);
    var hist = line.map(function (v, i) { return fin(v) && fin(sig[i]) ? v - sig[i] : null; });
    return { macd: line, signal: sig, hist: hist };
  }

  function adx(h, l, c, n) {
    n = n || 14;
    var tr = trueRange(h, l, c), pdm = nulls(h.length), ndm = nulls(h.length);
    for (var i = 1; i < h.length; i++) {
      if (!fin(h[i]) || !fin(h[i - 1]) || !fin(l[i]) || !fin(l[i - 1])) continue;
      var up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
      pdm[i] = up > dn && up > 0 ? up : 0;
      ndm[i] = dn > up && dn > 0 ? dn : 0;
    }
    var atrS = rma(tr, n), pS = rma(pdm, n), nS = rma(ndm, n);
    var diP = nulls(h.length), diN = nulls(h.length), dx = nulls(h.length);
    for (var k = 0; k < h.length; k++) {
      if (!fin(atrS[k]) || atrS[k] === 0 || !fin(pS[k]) || !fin(nS[k])) continue;
      diP[k] = pS[k] / atrS[k] * 100;
      diN[k] = nS[k] / atrS[k] * 100;
      var s = diP[k] + diN[k];
      dx[k] = s === 0 ? 0 : Math.abs(diP[k] - diN[k]) / s * 100;
    }
    return { adx: rma(dx, n), diP: diP, diN: diN };
  }

  function cci(h, l, c, n) {
    n = n || 20;
    var tp = c.map(function (_, i) { return fin(h[i]) && fin(l[i]) && fin(c[i]) ? (h[i] + l[i] + c[i]) / 3 : null; });
    var m = sma(tp, n), out = nulls(c.length);
    for (var i = n - 1; i < c.length; i++) {
      if (!fin(m[i])) continue;
      var dev = 0, ok = true;
      for (var j = 0; j < n; j++) { if (!fin(tp[i - j])) { ok = false; break; } dev += Math.abs(tp[i - j] - m[i]); }
      if (!ok) continue;
      dev /= n;
      out[i] = dev === 0 ? 0 : (tp[i] - m[i]) / (0.015 * dev);
    }
    return out;
  }

  function williamsR(h, l, c, n) {
    n = n || 14;
    var out = nulls(c.length);
    for (var i = n - 1; i < c.length; i++) {
      var hi = -Infinity, lo = Infinity, ok = true;
      for (var j = 0; j < n; j++) {
        if (!fin(h[i - j]) || !fin(l[i - j])) { ok = false; break; }
        if (h[i - j] > hi) hi = h[i - j];
        if (l[i - j] < lo) lo = l[i - j];
      }
      if (!ok || !fin(c[i])) continue;
      out[i] = hi === lo ? -50 : (hi - c[i]) / (hi - lo) * -100;
    }
    return out;
  }

  function roc(src, n) {
    n = n || 12;
    return src.map(function (v, i) {
      var p = src[i - n];
      return i >= n && fin(v) && fin(p) && p !== 0 ? (v - p) / p * 100 : null;
    });
  }

  function momentum(src, n) {
    n = n || 10;
    return src.map(function (v, i) { return i >= n && fin(v) && fin(src[i - n]) ? v - src[i - n] : null; });
  }

  function trix(src, n) {
    n = n || 15;
    var e3 = ema(ema(ema(src, n), n), n);
    return e3.map(function (v, i) {
      var p = e3[i - 1];
      return fin(v) && fin(p) && p !== 0 ? (v - p) / p * 100 : null;
    });
  }

  function aroon(h, l, n) {
    n = n || 25;
    var up = nulls(h.length), dn = nulls(h.length);
    for (var i = n; i < h.length; i++) {
      var hi = -Infinity, lo = Infinity, hIdx = i, lIdx = i, ok = true;
      for (var j = 0; j <= n; j++) {
        if (!fin(h[i - j]) || !fin(l[i - j])) { ok = false; break; }
        if (h[i - j] > hi) { hi = h[i - j]; hIdx = i - j; }
        if (l[i - j] < lo) { lo = l[i - j]; lIdx = i - j; }
      }
      if (!ok) continue;
      up[i] = (n - (i - hIdx)) / n * 100;
      dn[i] = (n - (i - lIdx)) / n * 100;
    }
    return { up: up, down: dn, osc: up.map(function (v, i) { return fin(v) && fin(dn[i]) ? v - dn[i] : null; }) };
  }

  function ultimateOscillator(h, l, c, s1, s2, s3) {
    s1 = s1 || 7; s2 = s2 || 14; s3 = s3 || 28;
    var bp = nulls(c.length), tr = nulls(c.length);
    for (var i = 1; i < c.length; i++) {
      if (!fin(c[i]) || !fin(c[i - 1]) || !fin(h[i]) || !fin(l[i])) continue;
      var trueLow = Math.min(l[i], c[i - 1]);
      bp[i] = c[i] - trueLow;
      tr[i] = Math.max(h[i], c[i - 1]) - trueLow;
    }
    function avg(n) {
      var out = nulls(c.length);
      for (var i = n; i < c.length; i++) {
        var b = 0, t = 0, ok = true;
        for (var j = 0; j < n; j++) { if (!fin(bp[i - j]) || !fin(tr[i - j])) { ok = false; break; } b += bp[i - j]; t += tr[i - j]; }
        if (ok && t !== 0) out[i] = b / t;
      }
      return out;
    }
    var a1 = avg(s1), a2 = avg(s2), a3 = avg(s3);
    return c.map(function (_, i) {
      return fin(a1[i]) && fin(a2[i]) && fin(a3[i]) ? 100 * (4 * a1[i] + 2 * a2[i] + a3[i]) / 7 : null;
    });
  }

  /* ── Volume ───────────────────────────────────────────────────── */

  function obv(c, v) {
    var out = nulls(c.length), acc = 0, started = false;
    for (var i = 0; i < c.length; i++) {
      if (!fin(c[i]) || !fin(v[i])) continue;
      if (!started) { started = true; out[i] = 0; continue; }
      var prev = c[i - 1];
      if (fin(prev)) acc += c[i] > prev ? v[i] : c[i] < prev ? -v[i] : 0;
      out[i] = acc;
    }
    return out;
  }

  function vwap(h, l, c, v) {
    var cv = 0, ct = 0;
    return c.map(function (_, i) {
      if (!fin(c[i])) return null;
      var tp = fin(h[i]) && fin(l[i]) ? (h[i] + l[i] + c[i]) / 3 : c[i];
      var vol = fin(v[i]) ? v[i] : 0;
      cv += tp * vol; ct += vol;
      return ct > 0 ? cv / ct : tp;
    });
  }

  /* VWAP glissant : plus lisible qu'un VWAP cumulé depuis l'origine
     lorsque l'historique couvre plusieurs années. */
  function rollingVwap(h, l, c, v, n) {
    n = n || 20;
    var out = nulls(c.length);
    for (var i = n - 1; i < c.length; i++) {
      var pv = 0, vv = 0, ok = true;
      for (var j = 0; j < n; j++) {
        if (!fin(c[i - j])) { ok = false; break; }
        var tp = fin(h[i - j]) && fin(l[i - j]) ? (h[i - j] + l[i - j] + c[i - j]) / 3 : c[i - j];
        var vol = fin(v[i - j]) ? v[i - j] : 0;
        pv += tp * vol; vv += vol;
      }
      if (ok) out[i] = vv > 0 ? pv / vv : c[i];
    }
    return out;
  }

  function mfi(h, l, c, v, n) {
    n = n || 14;
    var tp = c.map(function (_, i) { return fin(h[i]) && fin(l[i]) && fin(c[i]) ? (h[i] + l[i] + c[i]) / 3 : null; });
    var pos = nulls(c.length), neg = nulls(c.length);
    for (var i = 1; i < c.length; i++) {
      if (!fin(tp[i]) || !fin(tp[i - 1])) continue;
      var flow = tp[i] * (fin(v[i]) ? v[i] : 0);
      pos[i] = tp[i] > tp[i - 1] ? flow : 0;
      neg[i] = tp[i] < tp[i - 1] ? flow : 0;
    }
    var out = nulls(c.length);
    for (var k = n; k < c.length; k++) {
      var p = 0, ng = 0, ok = true;
      for (var j = 0; j < n; j++) { if (!fin(pos[k - j]) || !fin(neg[k - j])) { ok = false; break; } p += pos[k - j]; ng += neg[k - j]; }
      if (!ok) continue;
      out[k] = ng === 0 ? 100 : 100 - 100 / (1 + p / ng);
    }
    return out;
  }

  /* Chaikin Money Flow : pression acheteuse rapportée au volume. */
  function cmf(h, l, c, v, n) {
    n = n || 20;
    var mfv = nulls(c.length);
    for (var i = 0; i < c.length; i++) {
      if (!fin(h[i]) || !fin(l[i]) || !fin(c[i])) continue;
      var rng = h[i] - l[i];
      var mult = rng === 0 ? 0 : ((c[i] - l[i]) - (h[i] - c[i])) / rng;
      mfv[i] = mult * (fin(v[i]) ? v[i] : 0);
    }
    var out = nulls(c.length);
    for (var k = n - 1; k < c.length; k++) {
      var a = 0, b = 0, ok = true;
      for (var j = 0; j < n; j++) { if (!fin(mfv[k - j])) { ok = false; break; } a += mfv[k - j]; b += fin(v[k - j]) ? v[k - j] : 0; }
      if (ok && b > 0) out[k] = a / b;
    }
    return out;
  }

  /* ── Tendance avancée ─────────────────────────────────────────── */

  function superTrend(h, l, c, n, mult) {
    n = n || 10; mult = mult || 3;
    var a = atr(h, l, c, n), line = nulls(c.length), dir = nulls(c.length);
    var upPrev = null, dnPrev = null, dirPrev = 1;
    for (var i = 0; i < c.length; i++) {
      if (!fin(a[i]) || !fin(c[i]) || !fin(h[i]) || !fin(l[i])) continue;
      var mid = (h[i] + l[i]) / 2;
      var up = mid - mult * a[i];
      var dn = mid + mult * a[i];
      if (upPrev !== null && fin(c[i - 1])) up = c[i - 1] > upPrev ? Math.max(up, upPrev) : up;
      if (dnPrev !== null && fin(c[i - 1])) dn = c[i - 1] < dnPrev ? Math.min(dn, dnPrev) : dn;
      var d = dirPrev;
      if (dnPrev !== null && c[i] > dnPrev) d = 1;
      else if (upPrev !== null && c[i] < upPrev) d = -1;
      line[i] = d === 1 ? up : dn;
      dir[i] = d;
      upPrev = up; dnPrev = dn; dirPrev = d;
    }
    return { line: line, dir: dir };
  }

  function psar(h, l, step, maxStep) {
    step = step || 0.02; maxStep = maxStep || 0.2;
    var out = nulls(h.length);
    if (h.length < 2) return out;
    var bull = true, af = step, ep = h[0], sar = l[0];
    for (var i = 1; i < h.length; i++) {
      if (!fin(h[i]) || !fin(l[i])) continue;
      sar = sar + af * (ep - sar);
      if (bull) {
        if (fin(l[i - 1])) sar = Math.min(sar, l[i - 1]);
        if (i > 1 && fin(l[i - 2])) sar = Math.min(sar, l[i - 2]);
        if (l[i] < sar) { bull = false; sar = ep; ep = l[i]; af = step; }
        else if (h[i] > ep) { ep = h[i]; af = Math.min(maxStep, af + step); }
      } else {
        if (fin(h[i - 1])) sar = Math.max(sar, h[i - 1]);
        if (i > 1 && fin(h[i - 2])) sar = Math.max(sar, h[i - 2]);
        if (h[i] > sar) { bull = true; sar = ep; ep = h[i]; af = step; }
        else if (l[i] < ep) { ep = l[i]; af = Math.min(maxStep, af + step); }
      }
      out[i] = sar;
    }
    return out;
  }

  function ichimoku(h, l, c, pConv, pBase, pSpan) {
    pConv = pConv || 9; pBase = pBase || 26; pSpan = pSpan || 52;
    function midpoint(n) {
      var out = nulls(h.length);
      for (var i = n - 1; i < h.length; i++) {
        var hi = -Infinity, lo = Infinity, ok = true;
        for (var j = 0; j < n; j++) {
          if (!fin(h[i - j]) || !fin(l[i - j])) { ok = false; break; }
          if (h[i - j] > hi) hi = h[i - j];
          if (l[i - j] < lo) lo = l[i - j];
        }
        if (ok) out[i] = (hi + lo) / 2;
      }
      return out;
    }
    var conv = midpoint(pConv), base = midpoint(pBase), spanB = midpoint(pSpan);
    var spanA = c.map(function (_, i) { return fin(conv[i]) && fin(base[i]) ? (conv[i] + base[i]) / 2 : null; });
    /* Les nuages sont projetés de pBase séances vers l'avant. Le décalage
       est appliqué au moment du tracé, pas ici, pour garder l'alignement
       des séries sur les bougies. */
    return { conversion: conv, base: base, spanA: spanA, spanB: spanB, lagging: c, shift: pBase };
  }

  /* Régression linéaire glissante et canal à n écarts-types. */
  function linRegChannel(src, n, mult) {
    n = n || 100; mult = mult || 2;
    var vals = [];
    for (var i = src.length - n; i < src.length; i++) if (i >= 0 && fin(src[i])) vals.push({ x: i, y: src[i] });
    if (vals.length < 5) return null;
    var mx = 0, my = 0;
    vals.forEach(function (p) { mx += p.x; my += p.y; });
    mx /= vals.length; my /= vals.length;
    var sxy = 0, sxx = 0;
    vals.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); });
    if (sxx === 0) return null;
    var slope = sxy / sxx, intercept = my - slope * mx;
    var resid = vals.map(function (p) { return p.y - (slope * p.x + intercept); });
    var sd = stdev(resid, false);
    var ssTot = 0, ssRes = 0;
    vals.forEach(function (p, k) { ssTot += (p.y - my) * (p.y - my); ssRes += resid[k] * resid[k]; });
    return {
      slope: slope, intercept: intercept, sd: sd, mult: mult,
      from: vals[0].x, to: vals[vals.length - 1].x,
      r2: ssTot === 0 ? null : 1 - ssRes / ssTot,
      at: function (x) { return slope * x + intercept; }
    };
  }

  /* ── Points pivots ────────────────────────────────────────────── */

  function pivotPoints(h, l, c, method) {
    if (!fin(h) || !fin(l) || !fin(c)) return null;
    var p = (h + l + c) / 3, r = h - l;
    if (String(method).toLowerCase() === 'fibonacci') {
      return {
        pivot: p,
        r1: p + 0.382 * r, r2: p + 0.618 * r, r3: p + 1.000 * r,
        s1: p - 0.382 * r, s2: p - 0.618 * r, s3: p - 1.000 * r
      };
    }
    return {
      pivot: p,
      r1: 2 * p - l, r2: p + r, r3: h + 2 * (p - l),
      s1: 2 * p - h, s2: p - r, s3: l - 2 * (h - p)
    };
  }

  /* ── Structure de marché ──────────────────────────────────────── */

  /* Fractales de Bill Williams : un sommet est un plus haut entourÃ©
     de `left` et `right` bougies plus basses. */
  function fractals(h, l, left, right) {
    left = left || 2; right = right || 2;
    var highs = [], lows = [];
    for (var i = left; i < h.length - right; i++) {
      if (!fin(h[i]) || !fin(l[i])) continue;
      var isHigh = true, isLow = true;
      for (var j = 1; j <= left; j++) {
        if (!(h[i] > h[i - j])) isHigh = false;
        if (!(l[i] < l[i - j])) isLow = false;
      }
      for (var k = 1; k <= right; k++) {
        if (!(h[i] > h[i + k])) isHigh = false;
        if (!(l[i] < l[i + k])) isLow = false;
      }
      if (isHigh) highs.push({ i: i, v: h[i] });
      if (isLow) lows.push({ i: i, v: l[i] });
    }
    return { highs: highs, lows: lows };
  }

  /* Supports et résistances : les pivots sont regroupés par proximité,
     puis classés par nombre de touches et par fraîcheur. */
  function supportResistance(h, l, c, opts) {
    opts = opts || {};
    var tol = opts.tolerance || 0.015;
    var maxLevels = opts.max || 6;
    var f = fractals(h, l, opts.left || 3, opts.right || 3);
    var pts = f.highs.map(function (p) { return { i: p.i, v: p.v, kind: 'r' }; })
      .concat(f.lows.map(function (p) { return { i: p.i, v: p.v, kind: 's' }; }))
      .sort(function (a, b) { return a.v - b.v; });
    var clusters = [];
    pts.forEach(function (p) {
      var target = null;
      for (var i = 0; i < clusters.length; i++) {
        if (Math.abs(clusters[i].value - p.v) / clusters[i].value <= tol) { target = clusters[i]; break; }
      }
      if (!target) { clusters.push({ value: p.v, points: [p], lastIndex: p.i }); return; }
      target.points.push(p);
      target.value = mean(target.points.map(function (x) { return x.v; }));
      target.lastIndex = Math.max(target.lastIndex, p.i);
    });
    var price = last(c);
    var n = c.length;
    return clusters
      .map(function (cl) {
        var recency = n > 1 ? cl.lastIndex / (n - 1) : 1;
        return {
          value: cl.value,
          touches: cl.points.length,
          lastIndex: cl.lastIndex,
          score: cl.points.length * (0.5 + 0.5 * recency),
          type: fin(price) && cl.value > price ? 'resistance' : 'support',
          distance: fin(price) && price ? (cl.value - price) / price * 100 : null
        };
      })
      .filter(function (cl) { return cl.touches >= (opts.minTouches || 2); })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, maxLevels)
      .sort(function (a, b) { return a.value - b.value; });
  }

  /* ZigZag en pourcentage : ossature des figures chartistes. */
  function zigzag(h, l, threshold) {
    threshold = (threshold || 5) / 100;
    var pts = [];
    if (!h.length) return pts;
    var dir = 0, lastIdxV = 0, lastVal = fin(c0(h, l, 0)) ? c0(h, l, 0) : h[0];
    function c0(hh, ll, i) { return fin(hh[i]) && fin(ll[i]) ? (hh[i] + ll[i]) / 2 : NaN; }
    pts.push({ i: 0, v: lastVal, kind: 'start' });
    for (var i = 1; i < h.length; i++) {
      if (!fin(h[i]) || !fin(l[i])) continue;
      if (dir >= 0 && h[i] > lastVal) { lastVal = h[i]; lastIdxV = i; dir = 1; }
      else if (dir <= 0 && l[i] < lastVal) { lastVal = l[i]; lastIdxV = i; dir = -1; }
      if (dir === 1 && lastVal > 0 && (lastVal - l[i]) / lastVal >= threshold) {
        pts.push({ i: lastIdxV, v: lastVal, kind: 'high' });
        dir = -1; lastVal = l[i]; lastIdxV = i;
      } else if (dir === -1 && lastVal > 0 && (h[i] - lastVal) / lastVal >= threshold) {
        pts.push({ i: lastIdxV, v: lastVal, kind: 'low' });
        dir = 1; lastVal = h[i]; lastIdxV = i;
      }
    }
    pts.push({ i: lastIdxV, v: lastVal, kind: dir === 1 ? 'high' : 'low' });
    return pts.filter(function (p, k, arr) { return k === 0 || p.i !== arr[k - 1].i; });
  }

  /* Chandeliers Heikin-Ashi : chaque bougie est lissée par la précédente,
     ce qui efface le bruit de séance et rend la tendance plus lisible. Les
     prix obtenus ne sont plus des prix de marché : ils servent à lire une
     direction, jamais à fixer un niveau d'entrée. */
  function heikinAshi(o, h, l, c) {
    var ho = [], hc = [], hh = [], hl = [];
    for (var i = 0; i < c.length; i++) {
      if (!fin(o[i]) || !fin(h[i]) || !fin(l[i]) || !fin(c[i])) {
        ho.push(null); hc.push(null); hh.push(null); hl.push(null);
        continue;
      }
      var close = (o[i] + h[i] + l[i] + c[i]) / 4;
      var open = fin(ho[i - 1]) && fin(hc[i - 1]) ? (ho[i - 1] + hc[i - 1]) / 2 : (o[i] + c[i]) / 2;
      ho.push(open); hc.push(close);
      hh.push(Math.max(h[i], open, close));
      hl.push(Math.min(l[i], open, close));
    }
    return { o: ho, h: hh, l: hl, c: hc };
  }

  /* ── Statistiques de performance et de risque ─────────────────── */

  function returns(c, log) {
    var out = [];
    for (var i = 1; i < c.length; i++) {
      if (!fin(c[i]) || !fin(c[i - 1]) || c[i - 1] <= 0) continue;
      out.push(log ? Math.log(c[i] / c[i - 1]) : c[i] / c[i - 1] - 1);
    }
    return out;
  }

  function maxDrawdown(c) {
    var peak = -Infinity, worst = 0, peakIdx = 0, troughIdx = 0, curPeak = 0;
    for (var i = 0; i < c.length; i++) {
      if (!fin(c[i])) continue;
      if (c[i] > peak) { peak = c[i]; curPeak = i; }
      var dd = peak > 0 ? c[i] / peak - 1 : 0;
      if (dd < worst) { worst = dd; peakIdx = curPeak; troughIdx = i; }
    }
    return { value: worst, peakIndex: peakIdx, troughIndex: troughIdx, duration: troughIdx - peakIdx };
  }

  function skewness(r) {
    var vals = r.filter(fin); if (vals.length < 3) return NaN;
    var m = mean(vals), sd = stdev(vals);
    if (!fin(sd) || sd === 0) return NaN;
    var s = 0; vals.forEach(function (v) { s += Math.pow((v - m) / sd, 3); });
    return s / vals.length;
  }

  function kurtosis(r) {
    var vals = r.filter(fin); if (vals.length < 4) return NaN;
    var m = mean(vals), sd = stdev(vals);
    if (!fin(sd) || sd === 0) return NaN;
    var s = 0; vals.forEach(function (v) { s += Math.pow((v - m) / sd, 4); });
    return s / vals.length - 3;
  }

  /* Volatilité de Parkinson : exploite l'amplitude haut/bas, donc plus
     efficace que la volatilité de clôture à nombre d'observations égal. */
  function parkinsonVol(h, l) {
    var s = 0, n = 0;
    for (var i = 0; i < h.length; i++) {
      if (!fin(h[i]) || !fin(l[i]) || l[i] <= 0) continue;
      var r = Math.log(h[i] / l[i]);
      s += r * r; n++;
    }
    if (n < 5) return NaN;
    return Math.sqrt(s / (4 * Math.log(2) * n)) * Math.sqrt(SEANCES_AN);
  }

  function garmanKlassVol(o, h, l, c) {
    var s = 0, n = 0;
    for (var i = 0; i < c.length; i++) {
      if (!fin(o[i]) || !fin(h[i]) || !fin(l[i]) || !fin(c[i]) || o[i] <= 0 || l[i] <= 0) continue;
      var hl = Math.log(h[i] / l[i]), co = Math.log(c[i] / o[i]);
      s += 0.5 * hl * hl - (2 * Math.log(2) - 1) * co * co;
      n++;
    }
    if (n < 5 || s <= 0) return NaN;
    return Math.sqrt(s / n) * Math.sqrt(SEANCES_AN);
  }

  function historicalVar(r, level) {
    var vals = r.filter(fin).slice().sort(function (a, b) { return a - b; });
    if (vals.length < 20) return NaN;
    return quantile(vals, 1 - (level || 0.95));
  }

  function conditionalVar(r, level) {
    var v = historicalVar(r, level);
    if (!fin(v)) return NaN;
    var tail = r.filter(function (x) { return fin(x) && x <= v; });
    return tail.length ? mean(tail) : v;
  }

  /* Exposant de Hurst par analyse R/S : > 0,5 persistance, < 0,5 retour
     à la moyenne, ≈ 0,5 marche aléatoire. */
  function hurst(r) {
    var vals = r.filter(fin);
    if (vals.length < 64) return NaN;
    var sizes = [8, 16, 32, 64, 128, 256].filter(function (s) { return s <= vals.length / 2; });
    if (sizes.length < 3) return NaN;
    var xs = [], ys = [];
    sizes.forEach(function (n) {
      var chunks = Math.floor(vals.length / n), rs = [];
      for (var k = 0; k < chunks; k++) {
        var seg = vals.slice(k * n, (k + 1) * n);
        var m = mean(seg), cum = 0, mn = Infinity, mx = -Infinity;
        seg.forEach(function (v) { cum += v - m; if (cum < mn) mn = cum; if (cum > mx) mx = cum; });
        var sd = stdev(seg, false);
        if (fin(sd) && sd > 0) rs.push((mx - mn) / sd);
      }
      if (rs.length) { xs.push(Math.log(n)); ys.push(Math.log(mean(rs))); }
    });
    if (xs.length < 3) return NaN;
    var mx2 = mean(xs), my = mean(ys), sxy = 0, sxx = 0;
    for (var i = 0; i < xs.length; i++) { sxy += (xs[i] - mx2) * (ys[i] - my); sxx += (xs[i] - mx2) * (xs[i] - mx2); }
    return sxx === 0 ? NaN : sxy / sxx;
  }

  function correlation(a, b) {
    var n = Math.min(a.length, b.length), xa = [], xb = [];
    for (var i = 0; i < n; i++) if (fin(a[i]) && fin(b[i])) { xa.push(a[i]); xb.push(b[i]); }
    if (xa.length < 5) return NaN;
    var ma = mean(xa), mb = mean(xb), sab = 0, sa = 0, sb = 0;
    for (var k = 0; k < xa.length; k++) {
      sab += (xa[k] - ma) * (xb[k] - mb);
      sa += (xa[k] - ma) * (xa[k] - ma);
      sb += (xb[k] - mb) * (xb[k] - mb);
    }
    return sa === 0 || sb === 0 ? NaN : sab / Math.sqrt(sa * sb);
  }

  function beta(assetR, benchR) {
    var n = Math.min(assetR.length, benchR.length), xa = [], xb = [];
    for (var i = 0; i < n; i++) if (fin(assetR[i]) && fin(benchR[i])) { xa.push(assetR[i]); xb.push(benchR[i]); }
    if (xa.length < 20) return NaN;
    var ma = mean(xa), mb = mean(xb), cov = 0, varb = 0;
    for (var k = 0; k < xa.length; k++) { cov += (xa[k] - ma) * (xb[k] - mb); varb += (xb[k] - mb) * (xb[k] - mb); }
    return varb === 0 ? NaN : cov / varb;
  }

  /* ── Chandeliers japonais ─────────────────────────────────────── */

  var CANDLE_RULES = [
    {
      key: 'marteau', name: 'Marteau', bias: 1,
      test: function (b) {
        return b.lowerWick >= 2 * b.body && b.upperWick <= b.body * 0.6 && b.body > 0 && b.trendDown;
      },
      note: 'Longue mèche basse après une baisse : les vendeurs perdent le contrôle en séance.'
    },
    {
      key: 'pendu', name: 'Pendu', bias: -1,
      test: function (b) {
        return b.lowerWick >= 2 * b.body && b.upperWick <= b.body * 0.6 && b.body > 0 && b.trendUp;
      },
      note: 'Même forme que le marteau, mais en haut de tendance : signal de retournement baissier.'
    },
    {
      key: 'etoile-filante', name: 'Étoile filante', bias: -1,
      test: function (b) {
        return b.upperWick >= 2 * b.body && b.lowerWick <= b.body * 0.6 && b.body > 0 && b.trendUp;
      },
      note: 'Rejet net des plus hauts après une hausse.'
    },
    {
      key: 'marteau-inverse', name: 'Marteau inversé', bias: 1,
      test: function (b) {
        return b.upperWick >= 2 * b.body && b.lowerWick <= b.body * 0.6 && b.body > 0 && b.trendDown;
      },
      note: 'Tentative de rebond en bas de tendance, à confirmer sur la séance suivante.'
    },
    {
      key: 'doji', name: 'Doji', bias: 0,
      test: function (b) { return b.range > 0 && b.body <= b.range * 0.08; },
      note: 'Ouverture et clôture confondues : indécision, souvent une pause avant décision.'
    },
    {
      key: 'doji-libellule', name: 'Doji libellule', bias: 1,
      test: function (b) { return b.range > 0 && b.body <= b.range * 0.08 && b.lowerWick >= b.range * 0.6; },
      note: 'Pression acheteuse en fin de séance après un creux marqué.'
    },
    {
      key: 'doji-pierre-tombale', name: 'Doji pierre tombale', bias: -1,
      test: function (b) { return b.range > 0 && b.body <= b.range * 0.08 && b.upperWick >= b.range * 0.6; },
      note: 'Tout le gain de séance est rendu : pression vendeuse sur les plus hauts.'
    },
    {
      key: 'marubozu-haussier', name: 'Marubozu haussier', bias: 1,
      test: function (b) { return b.bull && b.range > 0 && b.body >= b.range * 0.9; },
      note: 'Séance achetée de bout en bout, sans mèche significative.'
    },
    {
      key: 'marubozu-baissier', name: 'Marubozu baissier', bias: -1,
      test: function (b) { return !b.bull && b.range > 0 && b.body >= b.range * 0.9; },
      note: 'Séance vendue de bout en bout.'
    },
    {
      key: 'avalement-haussier', name: 'Avalement haussier', bias: 2,
      test: function (b) {
        return b.prev && !b.prev.bull && b.bull && b.o <= b.prev.c && b.c >= b.prev.o && b.body > b.prev.body;
      },
      note: 'Le corps haussier englobe le corps baissier précédent : reprise de contrôle des acheteurs.'
    },
    {
      key: 'avalement-baissier', name: 'Avalement baissier', bias: -2,
      test: function (b) {
        return b.prev && b.prev.bull && !b.bull && b.o >= b.prev.c && b.c <= b.prev.o && b.body > b.prev.body;
      },
      note: 'Le corps baissier englobe le corps haussier précédent.'
    },
    {
      key: 'harami-haussier', name: 'Harami haussier', bias: 1,
      test: function (b) {
        return b.prev && !b.prev.bull && b.bull && b.body < b.prev.body * 0.6 &&
          Math.max(b.o, b.c) <= Math.max(b.prev.o, b.prev.c) && Math.min(b.o, b.c) >= Math.min(b.prev.o, b.prev.c);
      },
      note: 'Contraction de l\'amplitude après une baisse : la pression vendeuse s\'épuise.'
    },
    {
      key: 'harami-baissier', name: 'Harami baissier', bias: -1,
      test: function (b) {
        return b.prev && b.prev.bull && !b.bull && b.body < b.prev.body * 0.6 &&
          Math.max(b.o, b.c) <= Math.max(b.prev.o, b.prev.c) && Math.min(b.o, b.c) >= Math.min(b.prev.o, b.prev.c);
      },
      note: 'Contraction de l\'amplitude après une hausse.'
    },
    {
      key: 'etoile-du-matin', name: 'Étoile du matin', bias: 2,
      test: function (b) {
        if (!b.prev || !b.prev2) return false;
        return !b.prev2.bull && b.prev.body < b.prev2.body * 0.5 && b.bull && b.c > (b.prev2.o + b.prev2.c) / 2;
      },
      note: 'Baisse, indécision, puis reprise : configuration de retournement haussier sur trois séances.'
    },
    {
      key: 'etoile-du-soir', name: 'Étoile du soir', bias: -2,
      test: function (b) {
        if (!b.prev || !b.prev2) return false;
        return b.prev2.bull && b.prev.body < b.prev2.body * 0.5 && !b.bull && b.c < (b.prev2.o + b.prev2.c) / 2;
      },
      note: 'Hausse, indécision, puis rechute : retournement baissier sur trois séances.'
    },
    {
      key: 'trois-soldats', name: 'Trois soldats blancs', bias: 2,
      test: function (b) {
        if (!b.prev || !b.prev2) return false;
        return b.bull && b.prev.bull && b.prev2.bull && b.c > b.prev.c && b.prev.c > b.prev2.c &&
          b.body > b.avgBody * 0.8 && b.prev.body > b.avgBody * 0.6;
      },
      note: 'Trois séances haussières consécutives de bonne amplitude.'
    },
    {
      key: 'trois-corbeaux', name: 'Trois corbeaux noirs', bias: -2,
      test: function (b) {
        if (!b.prev || !b.prev2) return false;
        return !b.bull && !b.prev.bull && !b.prev2.bull && b.c < b.prev.c && b.prev.c < b.prev2.c &&
          b.body > b.avgBody * 0.8 && b.prev.body > b.avgBody * 0.6;
      },
      note: 'Trois séances baissières consécutives de bonne amplitude.'
    },
    {
      key: 'pénétrante', name: 'Ligne pénétrante', bias: 1,
      test: function (b) {
        return b.prev && !b.prev.bull && b.bull && b.o < b.prev.c && b.c > (b.prev.o + b.prev.c) / 2 && b.c < b.prev.o;
      },
      note: 'Ouverture en gap baissier puis clôture au-dessus du milieu du corps précédent.'
    },
    {
      key: 'couverture-nuage', name: 'Couverture en nuage noir', bias: -1,
      test: function (b) {
        return b.prev && b.prev.bull && !b.bull && b.o > b.prev.c && b.c < (b.prev.o + b.prev.c) / 2 && b.c > b.prev.o;
      },
      note: 'Ouverture en gap haussier puis clôture sous le milieu du corps précédent.'
    }
  ];

  function candleFeatures(o, h, l, c, i, avgBody, trendSlope) {
    if (!fin(o[i]) || !fin(h[i]) || !fin(l[i]) || !fin(c[i])) return null;
    function make(k) {
      if (k < 0 || !fin(o[k])) return null;
      return {
        o: o[k], h: h[k], l: l[k], c: c[k],
        bull: c[k] >= o[k],
        body: Math.abs(c[k] - o[k]),
        range: h[k] - l[k]
      };
    }
    var b = make(i);
    b.upperWick = h[i] - Math.max(o[i], c[i]);
    b.lowerWick = Math.min(o[i], c[i]) - l[i];
    b.prev = make(i - 1);
    b.prev2 = make(i - 2);
    b.avgBody = avgBody;
    b.trendUp = trendSlope > 0;
    b.trendDown = trendSlope < 0;
    return b;
  }

  function detectCandles(o, h, l, c, lookback) {
    lookback = lookback || 25;
    var found = [];
    var bodies = [];
    for (var k = 0; k < c.length; k++) if (fin(o[k]) && fin(c[k])) bodies.push(Math.abs(c[k] - o[k]));
    var avgBody = mean(bodies.slice(-120)) || 0;
    var start = Math.max(2, c.length - lookback);
    var ma = sma(c, Math.min(20, Math.max(5, Math.floor(c.length / 4))));
    for (var i = start; i < c.length; i++) {
      var slope = fin(ma[i]) && fin(ma[i - 3]) ? ma[i] - ma[i - 3] : (fin(c[i]) && fin(c[i - 3]) ? c[i] - c[i - 3] : 0);
      var b = candleFeatures(o, h, l, c, i, avgBody, slope);
      if (!b) continue;
      CANDLE_RULES.forEach(function (rule) {
        var ok = false;
        try { ok = rule.test(b); } catch (e) { ok = false; }
        if (ok) found.push({ index: i, key: rule.key, name: rule.name, bias: rule.bias, note: rule.note });
      });
    }
    /* Le doji simple est absorbé par ses variantes plus informatives. */
    var keys = {};
    found.forEach(function (f) { keys[f.index] = keys[f.index] || []; keys[f.index].push(f); });
    var cleaned = [];
    Object.keys(keys).forEach(function (idx) {
      var group = keys[idx];
      var special = group.filter(function (g) { return g.key !== 'doji'; });
      (special.length ? special : group).forEach(function (g) { cleaned.push(g); });
    });
    return cleaned.sort(function (a, b2) { return b2.index - a.index; });
  }

  /* ── Figures chartistes ───────────────────────────────────────── */

  function detectChartPatterns(h, l, c, opts) {
    opts = opts || {};
    var pts = zigzag(h, l, opts.threshold || 4);
    if (pts.length < 5) return [];
    var out = [];
    var tol = opts.tolerance || 0.035;
    var n = c.length;
    var recentCut = n - (opts.window || 180);

    function near(a, b) { return b !== 0 && Math.abs(a - b) / Math.abs(b) <= tol; }
    function fmtLvl(v) {
      return fin(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 }) : '—';
    }

    for (var i = 2; i < pts.length; i++) {
      var p1 = pts[i - 2], p2 = pts[i - 1], p3 = pts[i];
      if (p1.i < recentCut) continue;

      if (p1.kind === 'high' && p3.kind === 'high' && p2.kind === 'low' && near(p1.v, p3.v)) {
        out.push({
          type: 'double-sommet', name: 'Double sommet', bias: -1,
          from: p1.i, to: p3.i, neckline: p2.v, level: (p1.v + p3.v) / 2,
          target: p2.v - ((p1.v + p3.v) / 2 - p2.v),
          note: 'Deux sommets de même hauteur séparés par un creux. La figure se valide sous ' + round(p2.v, 0) + '.'
        });
      }
      if (p1.kind === 'low' && p3.kind === 'low' && p2.kind === 'high' && near(p1.v, p3.v)) {
        out.push({
          type: 'double-creux', name: 'Double creux', bias: 1,
          from: p1.i, to: p3.i, neckline: p2.v, level: (p1.v + p3.v) / 2,
          target: p2.v + (p2.v - (p1.v + p3.v) / 2),
          note: 'Deux creux de même profondeur séparés par un sommet. La figure se valide au-dessus de ' + round(p2.v, 0) + '.'
        });
      }
    }

    for (var k = 4; k < pts.length; k++) {
      var a = pts[k - 4], b = pts[k - 3], cc = pts[k - 2], d = pts[k - 1], e = pts[k];
      if (a.i < recentCut) continue;
      if (a.kind === 'high' && cc.kind === 'high' && e.kind === 'high' && b.kind === 'low' && d.kind === 'low') {
        if (cc.v > a.v && cc.v > e.v && near(a.v, e.v)) {
          var neck = (b.v + d.v) / 2;
          out.push({
            type: 'tete-epaules', name: 'Tête-épaules', bias: -2,
            from: a.i, to: e.i, neckline: neck, level: cc.v,
            target: neck - (cc.v - neck),
            note: 'Sommet central plus haut que les deux épaules. Objectif théorique sous la ligne de cou, à ' + fmtLvl(neck - (cc.v - neck)) + '.'
          });
        }
      }
      if (a.kind === 'low' && cc.kind === 'low' && e.kind === 'low' && b.kind === 'high' && d.kind === 'high') {
        if (cc.v < a.v && cc.v < e.v && near(a.v, e.v)) {
          var neck2 = (b.v + d.v) / 2;
          out.push({
            type: 'tete-epaules-inv', name: 'Tête-épaules inversée', bias: 2,
            from: a.i, to: e.i, neckline: neck2, level: cc.v,
            target: neck2 + (neck2 - cc.v),
            note: 'Creux central plus bas que les deux épaules. Objectif théorique au-dessus de la ligne de cou, à ' + fmtLvl(neck2 + (neck2 - cc.v)) + '.'
          });
        }
      }
    }

    /* Triangles : deux sommets et deux creux, lus par la pente de chaque
       enveloppe sur la même fenêtre. */
    var tail = pts.slice(-6);
    var hi = tail.filter(function (p) { return p.kind === 'high'; });
    var lo = tail.filter(function (p) { return p.kind === 'low'; });
    if (hi.length >= 2 && lo.length >= 2) {
      var h1 = hi[hi.length - 2], h2 = hi[hi.length - 1];
      var l1 = lo[lo.length - 2], l2 = lo[lo.length - 1];
      var hSlope = (h2.v - h1.v) / Math.max(1, h2.i - h1.i);
      var lSlope = (l2.v - l1.v) / Math.max(1, l2.i - l1.i);
      var scale = Math.abs(mean([h1.v, h2.v, l1.v, l2.v])) || 1;
      var hFlat = Math.abs(hSlope) / scale < 0.0006;
      var lFlat = Math.abs(lSlope) / scale < 0.0006;
      var from = Math.min(h1.i, l1.i), to = Math.max(h2.i, l2.i);
      if (from >= recentCut) {
        if (hFlat && lSlope > 0) out.push({ type: 'triangle-ascendant', name: 'Triangle ascendant', bias: 1, from: from, to: to, level: (h1.v + h2.v) / 2, note: 'Sommets alignés, creux de plus en plus hauts : pression acheteuse sous une résistance horizontale.' });
        else if (lFlat && hSlope < 0) out.push({ type: 'triangle-descendant', name: 'Triangle descendant', bias: -1, from: from, to: to, level: (l1.v + l2.v) / 2, note: 'Creux alignés, sommets de plus en plus bas : pression vendeuse sur un support horizontal.' });
        else if (hSlope < 0 && lSlope > 0) out.push({ type: 'triangle-symetrique', name: 'Triangle symétrique', bias: 0, from: from, to: to, level: (h2.v + l2.v) / 2, note: 'Compression de l\'amplitude : la sortie donnera la direction.' });
        else if (hSlope > 0 && lSlope > 0 && hSlope < lSlope) out.push({ type: 'biseau-ascendant', name: 'Biseau ascendant', bias: -1, from: from, to: to, level: h2.v, note: 'Hausse à amplitude décroissante : essoufflement fréquent.' });
        else if (hSlope < 0 && lSlope < 0 && hSlope > lSlope) out.push({ type: 'biseau-descendant', name: 'Biseau descendant', bias: 1, from: from, to: to, level: l2.v, note: 'Baisse à amplitude décroissante : essoufflement fréquent.' });
      }
    }

    var seen = {};
    return out.filter(function (p) {
      var key = p.type + ':' + p.from + ':' + p.to;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort(function (x, y) { return y.to - x.to; }).slice(0, 6);
  }

  /* ── Divergences ──────────────────────────────────────────────── */

  function detectDivergences(c, h, l, osc, label, opts) {
    opts = opts || {};
    var out = [];
    var f = fractals(h, l, opts.left || 3, opts.right || 3);
    var window = opts.window || 120;
    var cut = c.length - window;

    function scan(points, isHigh) {
      var valid = points.filter(function (p) { return p.i >= cut && fin(osc[p.i]); });
      for (var i = 1; i < valid.length; i++) {
        var a = valid[i - 1], b = valid[i];
        if (b.i - a.i < 4) continue;
        var priceUp = b.v > a.v, oscUp = osc[b.i] > osc[a.i];
        if (isHigh && priceUp && !oscUp) {
          out.push({ kind: 'baissiere', hidden: false, label: label, from: a.i, to: b.i, bias: -1, note: 'Nouveau sommet sur le cours sans confirmation du ' + label + ' : divergence baissière classique.' });
        } else if (isHigh && !priceUp && oscUp) {
          out.push({ kind: 'baissiere-cachee', hidden: true, label: label, from: a.i, to: b.i, bias: -1, note: 'Sommet plus bas sur le cours mais plus haut sur le ' + label + ' : divergence baissière cachée, continuation de baisse.' });
        } else if (!isHigh && !priceUp && oscUp) {
          out.push({ kind: 'haussiere', hidden: false, label: label, from: a.i, to: b.i, bias: 1, note: 'Nouveau creux sur le cours sans confirmation du ' + label + ' : divergence haussière classique.' });
        } else if (!isHigh && priceUp && !oscUp) {
          out.push({ kind: 'haussiere-cachee', hidden: true, label: label, from: a.i, to: b.i, bias: 1, note: 'Creux plus haut sur le cours mais plus bas sur le ' + label + ' : divergence haussière cachée, continuation de hausse.' });
        }
      }
    }
    scan(f.highs, true);
    scan(f.lows, false);
    return out.sort(function (a, b) { return b.to - a.to; }).slice(0, opts.max || 4);
  }

  /* ── Backtest de stratégies élémentaires ──────────────────────── */

  /* Le backtest est délibérément conservateur : entrée et sortie à la
     clôture de la séance qui suit le signal, jamais sur la bougie du
     signal elle-même. Aucun résultat n'est publié sous cinq opérations. */
  function backtest(bars, signalFn, opts) {
    opts = opts || {};
    var fees = opts.fees != null ? opts.fees : 0.0; /* en fraction, aller-retour */
    var trades = [];
    var position = null;
    var equity = [];
    var cash = 1;

    for (var i = 1; i < bars.length; i++) {
      var sig = 0;
      try { sig = signalFn(i - 1) || 0; } catch (e) { sig = 0; }
      var px = bars[i].c;
      if (!fin(px)) { equity.push({ i: i, v: position ? cash * px / position.entry : cash }); continue; }

      if (!position && sig > 0) {
        position = { entryIndex: i, entry: px, entryDate: bars[i].date };
      } else if (position && sig < 0) {
        var gross = px / position.entry - 1;
        var net = gross - fees;
        cash *= 1 + net;
        trades.push({
          entryIndex: position.entryIndex, exitIndex: i,
          entryDate: position.entryDate, exitDate: bars[i].date,
          entry: position.entry, exit: px, ret: net, bars: i - position.entryIndex
        });
        position = null;
      }
      equity.push({ i: i, v: position ? cash * (px / position.entry) : cash });
    }

    if (position) {
      var lastPx = null;
      for (var k = bars.length - 1; k >= 0; k--) if (fin(bars[k].c)) { lastPx = bars[k].c; break; }
      if (lastPx !== null) {
        var g = lastPx / position.entry - 1 - fees;
        cash *= 1 + g;
        trades.push({
          entryIndex: position.entryIndex, exitIndex: bars.length - 1,
          entryDate: position.entryDate, exitDate: bars[bars.length - 1].date,
          entry: position.entry, exit: lastPx, ret: g, bars: bars.length - 1 - position.entryIndex, open: true
        });
      }
    }

    if (trades.length < (opts.minTrades || 5)) {
      return { enough: false, trades: trades, count: trades.length, minTrades: opts.minTrades || 5 };
    }

    var wins = trades.filter(function (t) { return t.ret > 0; });
    var losses = trades.filter(function (t) { return t.ret <= 0; });
    var grossWin = sum(wins.map(function (t) { return t.ret; }));
    var grossLoss = Math.abs(sum(losses.map(function (t) { return t.ret; })));
    var eqVals = equity.map(function (e) { return e.v; });
    var dd = maxDrawdown(eqVals);

    return {
      enough: true,
      count: trades.length,
      trades: trades.slice(-12).reverse(),
      winRate: wins.length / trades.length,
      avgReturn: mean(trades.map(function (t) { return t.ret; })),
      avgWin: wins.length ? mean(wins.map(function (t) { return t.ret; })) : null,
      avgLoss: losses.length ? mean(losses.map(function (t) { return t.ret; })) : null,
      profitFactor: grossLoss === 0 ? null : grossWin / grossLoss,
      totalReturn: cash - 1,
      maxDrawdown: dd.value,
      avgBars: mean(trades.map(function (t) { return t.bars; })),
      equity: equity,
      expectancy: mean(trades.map(function (t) { return t.ret; }))
    };
  }

  /* ── Export ───────────────────────────────────────────────────── */

  global.ATMath = {
    SEANCES_AN: SEANCES_AN,
    num: num, fin: fin, nulls: nulls, last: last, lastIdx: lastIdx,
    mean: mean, variance: variance, stdev: stdev, sum: sum, quantile: quantile,
    clamp: clamp, round: round,
    sma: sma, ema: ema, rma: rma, wma: wma, hma: hma, dema: dema, tema: tema,
    movingAverage: movingAverage,
    bollinger: bollinger, keltner: keltner, donchian: donchian,
    trueRange: trueRange, atr: atr,
    rsi: rsi, stochRsi: stochRsi, stochastic: stochastic, macd: macd, adx: adx,
    cci: cci, williamsR: williamsR, roc: roc, momentum: momentum, trix: trix,
    aroon: aroon, ultimateOscillator: ultimateOscillator,
    obv: obv, vwap: vwap, rollingVwap: rollingVwap, mfi: mfi, cmf: cmf,
    superTrend: superTrend, psar: psar, ichimoku: ichimoku, heikinAshi: heikinAshi,
    linRegChannel: linRegChannel, pivotPoints: pivotPoints,
    fractals: fractals, supportResistance: supportResistance, zigzag: zigzag,
    returns: returns, maxDrawdown: maxDrawdown, skewness: skewness, kurtosis: kurtosis,
    parkinsonVol: parkinsonVol, garmanKlassVol: garmanKlassVol,
    historicalVar: historicalVar, conditionalVar: conditionalVar, hurst: hurst,
    correlation: correlation, beta: beta,
    detectCandles: detectCandles, detectChartPatterns: detectChartPatterns,
    detectDivergences: detectDivergences,
    backtest: backtest,
    CANDLE_RULES: CANDLE_RULES
  };
})(typeof window !== 'undefined' ? window : globalThis);
