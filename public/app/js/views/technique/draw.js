// ═══════════════════════════════════════
// DRAW (CORRIGE — garde anti-double + mainEl declare)
// ═══════════════════════════════════════
if (window.__drawLoaded) {
  console.warn('[DRAW] Deja charge, skip.');
} else {
  window.__drawLoaded = true;

  // ═══════════════════════════════════════
  // DECLARATION mainEl (corrige ReferenceError)
  // ═══════════════════════════════════════
  const mainEl = document.getElementById('atMain') || document.getElementById('main') || document.querySelector('main') || document.querySelector('.at-main');
  if (!mainEl) {
    console.error('[DRAW] mainEl introuvable dans le DOM — recherche de fallback...');
  }

  // NOTE: Le code original de draw.js doit etre insere ici.
  // Les fonctions suivantes sont des placeholders — remplacez-les par votre code original.

  function atRender() {
    if (!AT || !AT.hist || !AT.hist.length) return;
    const canvas = document.getElementById('atCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = atVisibleData();
    // ... logique de rendu du chart ...
    console.log('[DRAW] atRender appele avec', data.length, 'points');
  }
  window.atRender = atRender;

  function atExtract(raw) {
    return raw.map(r => ({
      date: r.date_seance || r.date,
      o: +r.ouverture || +r.o || +r.cours,
      h: +r.haut || +r.h || +r.cours,
      l: +r.bas || +r.l || +r.cours,
      c: +r.cloture || +r.c || +r.cours,
      v: +r.volume || 0
    })).filter(d => d.o && d.h && d.l && d.c);
  }
  window.atExtract = atExtract;

  function atAggregate(hist, interval) {
    if (interval === 'daily' || !interval) return hist;
    // Aggregation hebdo/mensuelle simplifiee
    const groups = {};
    hist.forEach(d => {
      const date = new Date(d.date);
      const key = interval === 'weekly' 
        ? `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`
        : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
      if (!groups[key]) groups[key] = { date: d.date, o: d.o, h: d.h, l: d.l, c: d.c, v: 0 };
      groups[key].h = Math.max(groups[key].h, d.h);
      groups[key].l = Math.min(groups[key].l, d.l);
      groups[key].c = d.c;
      groups[key].v += d.v;
    });
    return Object.values(groups);
  }
  window.atAggregate = atAggregate;
}
