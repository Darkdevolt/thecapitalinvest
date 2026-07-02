// ═══════════════════════════════════════
// VIEW — Titres BRVM
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// TITRES
// ═══════════════════════════════════════
function renderTitres() {
  const byTicker = {};
  allCours.forEach(c => { if (c?.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  window._titresRows = Object.values(byTicker);
  filterTitres();
}

function setTitreFilter(f, btn) {
  _titreFilter = f;
  document.querySelectorAll('#view-titres .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterTitres();
}

function filterTitres() {
  const q = (document.getElementById('searchTitres')?.value || '').toLowerCase();
  let rows = window._titresRows || [];
  
  if (_titreFilter !== 'all') {
    rows = rows.filter(r => getSector(r.ticker).toLowerCase().includes(_titreFilter.toLowerCase()));
  }
  if (q) {
    rows = rows.filter(r => 
      (r.ticker || '').toLowerCase().includes(q) || 
      (r.nom || r.ticker || '').toLowerCase().includes(q)
    );
  }
  
  const tbody = document.getElementById('titresTable');
  if (!tbody) return;
  
  if (!rows.length) {
    tbody.innerHTML = emptyState('Aucun titre trouve');
    return;
  }
  
  tbody.innerHTML = rows
    .sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''))
    .map(c => tickerRow(c, { showCompany: true, show52Week: true }))
    .join('');
}
