// ═══════════════════════════════════════
// AT Indicator — ATOBV
// ═══════════════════════════════════════

function atOBV(c, v) {
  let o = 0;
  return c.map((p, i) => { o += i === 0 ? v[i] : p > c[i - 1] ? v[i] : p < c[i - 1] ? -v[i] : 0; return o; });
}
