// ═══════════════════════════════════════
// VIEW — Screener BRVM
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SCREENER
// ═══════════════════════════════════════
function runScreener() {
  const sector = document.getElementById('scrSector').value;
  const minP = parseFloat(document.getElementById('scrMinPrice').value) || 0;
  const maxP = parseFloat(document.getElementById('scrMaxPrice').value) || Infinity;
  const minV = parseFloat(document.getElementById('scrMinVar').value) || -Infinity;
  const maxV = parseFloat(document.getElementById('scrMaxVar').value) || Infinity;
  const minVol = parseFloat(document.getElementById('scrMinVol').value) || 0;

  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });
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

  document.getElementById('scrCount').textContent = rows.length + ' résultat(s)';
  const ent = Object.fromEntries(allEntreprises.map(e => [e.ticker, e]));
  document.getElementById('screenerTable').innerHTML = rows.sort((a,b) => (a.ticker||'').localeCompare(b.ticker||'')).map(c =>
    `<tr onclick="openFiche('${c.ticker}','screener')">
      <td><span style="font-family:var(--mono);font-size:12px;color:var(--gold)">${c.ticker}</span></td>
      <td>${ent[c.ticker]?.nom || c.ticker}</td>
      <td class="right">${fmt(c.cours)}</td>
      <td class="right">${changePill(c.variation)}</td>
      <td class="right">${fmt(c.volume)}</td>
      <td><span class="sector-tag">${getSector(c.ticker)}</span></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--dim)">Aucun titre ne correspond aux critères</td></tr>';
}