// ═══════════════════════════════════════
// AT Indicator — ATVWAP
// ═══════════════════════════════════════

function atVWAP(c, v) {
  let cv = 0, ct = 0;
  return c.map((p, i) => { cv += p * v[i]; ct += v[i]; return ct > 0 ? cv / ct : p; });
}
