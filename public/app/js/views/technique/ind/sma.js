// ═══════════════════════════════════════
// AT Indicator — ATSMA
// ═══════════════════════════════════════

function atSMA(d, n) {
  return d.map((_, i) => i < n - 1 ? null : d.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);
}
