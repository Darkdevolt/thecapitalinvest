// ═══════════════════════════════════════
// AT Indicator — ATADX
// ═══════════════════════════════════════

function atADX(h, l, c, n = 14) {
  const tr = [h[0] - l[0]];
  const pdm = [0], ndm = [0];
  for (let i = 1; i < h.length; i++) {
    tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
    const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  const atr = atSMA(tr, n), sp = atSMA(pdm, n), sn = atSMA(ndm, n);
  return c.map((_, i) => {
    if (!atr[i] || atr[i] === 0) return null;
    const di1 = (sp[i] / atr[i]) * 100, di2 = (sn[i] / atr[i]) * 100;
    const dx = Math.abs(di1 - di2) / (di1 + di2) * 100;
    return { adx: dx, diP: di1, diN: di2 };
  });
}
