// ═══════════════════════════════════════
// AT Indicator — ATRSI
// ═══════════════════════════════════════

function atRSI(d, n = 14) {
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const c = d[i] - d[i - 1]; c > 0 ? g += c : l += Math.abs(c); }
  g /= n; l /= n;
  const r = new Array(n).fill(null);
  r.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  for (let i = n + 1; i < d.length; i++) {
    const c = d[i] - d[i - 1];
    const gi = c > 0 ? c : 0, li = c < 0 ? -c : 0;
    g = (g * (n - 1) + gi) / n; l = (l * (n - 1) + li) / n;
    r.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  return r;
}
