// ═══════════════════════════════════════
// AT Indicator — ATHEIKINASHI
// ═══════════════════════════════════════

function atHeikinAshi(o, h, l, c) {
  const ho = [o[0]], hc = [c[0]], hh = [h[0]], hl = [l[0]];
  for (let i = 1; i < c.length; i++) {
    const nc = (o[i] + h[i] + l[i] + c[i]) / 4;
    const no = (ho[i - 1] + hc[i - 1]) / 2;
    ho.push(no); hc.push(nc);
    hh.push(Math.max(h[i], no, nc));
    hl.push(Math.min(l[i], no, nc));
  }
  return { o: ho, h: hh, l: hl, c: hc };
}
