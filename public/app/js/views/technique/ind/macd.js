// ═══════════════════════════════════════
// AT Indicator — ATMACD
// ═══════════════════════════════════════

function atMACD(d) {
  const e12 = atEMA(d, 12), e26 = atEMA(d, 26);
  const ml = e12.map((v, i) => v - e26[i]);
  const sl = atEMA(ml, 9);
  return ml.map((v, i) => ({ macd: v, signal: sl[i], hist: v - sl[i] }));
}
