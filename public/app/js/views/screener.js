// ═══════════════════════════════════════
// VIEW — Screener BRVM
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SCREENER
// ═══════════════════════════════════════
function runScreener() {
  const sector = document.getElementById('scrSector')?.value || '';
  const minP = parseFloat(document.getElementById('scrMinPrice')?.value) || 0;
  const maxP = parseFloat(document.getElementById('scrMaxPrice')?.value) || Infinity;
  const minV = parseFloat(document.getElementById('scrMinVar')?.value) || -Infinity;
  const maxV = parseFloat(document.getElementById('scrMaxVar')?.value) || Infinity;
  const minVol = parseFloat(document.getElementById('scrMinVol')?.value) || 0;

  const byTicker = {};
  allCours.forEach(c => { if (c?.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  let rows = Object.values(byTicker);

  rows = rows.filter(r => {
    const s = getSector(r.ticker);
    if (sector && !s.toLowerCase().includes(sector.toLowerCase())) return false;
    if (r.cours < minP || r.cours > maxP) return false;
    const varVal = parseFloat(r.variation) || 0;
    if (varVal < minV || varVal > maxV) return false;
    if ((r.volume || 0) < minVol) return false;
    return true;
  });

  const countEl = document.getElementById('scrCount');
  if (countEl) countEl.textContent = rows.length + ' resultat(s)';
  
  const tbody = document.getElementById('screenerTable');
  if (!tbody) return;
  
  if (!rows.length) {
    tbody.innerHTML = emptyState('Aucun titre ne correspond aux criteres');
    return;
  }

  tbody.innerHTML = rows
    .sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''))
    .map(c => tickerRow(c, { showCompany: true }))
    .join('');
}
