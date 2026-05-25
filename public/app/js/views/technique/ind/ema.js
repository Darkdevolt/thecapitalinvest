// ═══════════════════════════════════════
// AT Indicator — ATEMA
// ═══════════════════════════════════════

function atEMA(d, n) {
  const k = 2 / (n + 1); const r = [d[0]];
  for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k));
  return r;
}
