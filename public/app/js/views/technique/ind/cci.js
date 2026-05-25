// ═══════════════════════════════════════
// AT Indicator — ATCCI
// ═══════════════════════════════════════

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
