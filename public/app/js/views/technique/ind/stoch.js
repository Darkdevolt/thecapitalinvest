// ═══════════════════════════════════════
// AT Indicator — ATSTOCH
// ═══════════════════════════════════════

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
