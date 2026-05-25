// ═══════════════════════════════════════
// VIEW — Titres BRVM
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// TITRES
// ═══════════════════════════════════════
function renderTitres() {
  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });
  window._titresRows = Object.values(byTicker);
  filterTitres();
}

function setTitreFilter(f, btn) {
  _titreFilter = f;
  document.querySelectorAll('#view-titres .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterTitres();
}

function filterTitres() {
  const q = (document.getElementById('searchTitres')?.value || '').toLowerCase();
  let rows = window._titresRows || [];
  if (_titreFilter !== 'all') rows = rows.filter(r => getSector(r.ticker).toLowerCase().includes(_titreFilter));
  if (q) rows = rows.filter(r => (r.ticker||'').toLowerCase().includes(q) || (r.nom||r.ticker||'').toLowerCase().includes(q));
  const ent = Object.fromEntries(allEntreprises.map(e => [e.ticker, e]));
  if (!rows.length) {
    document.getElementById('titresTable').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--dim)">Aucun titre trouvé</td></tr>';
    return;
  }
  document.getElementById('titresTable').innerHTML = rows.sort((a,b) => (a.ticker||'').localeCompare(b.ticker||'')).map(c =>
    `<tr onclick="openFiche('${c.ticker}','titres')">
      <td><span style="font-family:var(--mono);font-size:13px;font-weight:500;color:var(--gold)">${c.ticker}</span></td>
      <td style="color:var(--cream)">${ent[c.ticker]?.nom || c.ticker}</td>
      <td class="right">${fmt(c.cours)}</td>
      <td class="right">${changePill(c.variation)}</td>
      <td class="right" style="color:var(--dim)">${c.plus_haut_52 ? fmt(c.plus_haut_52) : '—'}</td>
      <td class="right" style="color:var(--dim)">${c.plus_bas_52 ? fmt(c.plus_bas_52) : '—'}</td>
      <td class="right">${fmt(c.volume)}</td>
      <td><span class="sector-tag">${getSector(c.ticker)}</span></td>
    </tr>`).join('');
}