// ═══════════════════════════════════════
// AT Indicator — ATBB
// ═══════════════════════════════════════

function atBB(d, n = 20) {
  const sma = atSMA(d, n);
  return d.map((_, i) => {
    if (i < n - 1) return { mid: null, upper: null, lower: null };
    const sl = d.slice(i - n + 1, i + 1);
    const std = Math.sqrt(sl.reduce((a, v) => a + Math.pow(v - sma[i], 2), 0) / n);
    return { mid: sma[i], upper: sma[i] + 2 * std, lower: sma[i] - 2 * std };
  });
}
