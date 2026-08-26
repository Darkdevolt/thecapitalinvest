// ═══════════════════════════════════════
// AT — Compare
// ═══════════════════════════════════════

// ── Compare ──
async function atCompare() {
  if (!AT.ticker) { toast('Sélectionnez un ticker d\'abord', 'warn'); return; }
  const t2 = prompt('Ticker à comparer (ex: ETIT) :');
  if (!t2) return;
  const ticker = String(t2).trim().toUpperCase();
  try {
    let raw = AT.histCache[ticker];
    if (!raw && typeof window.tcLoadHistoryComplete === 'function') {
      raw = await window.tcLoadHistoryComplete(ticker);
      if (raw?.length) AT.histCache[ticker] = raw;
    }
    if (!raw) {
      raw = await sb('historique', { ticker: `eq.${ticker}`, order: 'date_seance.asc', limit: 5000 });
      if (raw) AT.histCache[ticker] = raw;
    }
    AT.compareData = atExtract(Array.isArray(raw) ? raw : []);
    AT.compareTicker = ticker;
    atRender();
    toast('Comparaison avec ' + ticker + ' activée', 'success');
  } catch(e) { toast('Erreur : ' + e.message, 'error'); }
}
