// ═══════════════════════════════════════
// AT — Compare
// ═══════════════════════════════════════

// ── Compare ──
async function atCompare() {
  if (!AT.ticker) { toast('Sélectionnez un ticker d\'abord', 'warn'); return; }
  const t2 = prompt('Ticker à comparer (ex: ETIT) :');
  if (!t2) return;
  try {
    let raw = AT.histCache[t2];
    if (!raw) { raw = await sb('historique', { ticker: `eq.${t2}`, order: 'date_seance.asc', limit: 5000 }); if(raw) AT.histCache[t2]=raw; }
    AT.compareData = atExtract(Array.isArray(raw)?raw:[]);
    AT.compareTicker = t2;
    atRender();
    toast('Comparaison avec ' + t2 + ' activée', 'success');
  } catch(e) { toast('Erreur : ' + e.message, 'error'); }
}
