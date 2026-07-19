// ═══════════════════════════════════════════════════════
// AJOUT v3 — Panneau de rééquilibrage (allocations cibles)
// ═══════════════════════════════════════════════════════

function renderRebalancing(rows, totalValue) {
  const el = document.getElementById('rebalancingPanel');
  if (!el) return;
  const targets = getTargetAllocation();
  const tickers = Object.keys(targets);

  if (!tickers.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Définissez des allocations cibles ci-dessus pour voir les suggestions de rééquilibrage.</div>';
    return;
  }

  const byTicker = {};
  rows.forEach(r => { byTicker[r.ticker] = (byTicker[r.ticker] || 0) + r.value; });

  let html = '<div style="padding:16px">';
  tickers.forEach(t => {
    const targetPct = targets[t];
    const currentValue = byTicker[t] || 0;
    const currentPct = totalValue > 0 ? (currentValue / totalValue * 100) : 0;
    const diff = currentPct - targetPct;
    const diffValue = (diff / 100) * totalValue;
    const balanced = Math.abs(diff) < 1;
    const action = balanced
      ? 'Équilibré'
      : (diff > 0
          ? `Vendre ~${typeof fmtM === 'function' ? fmtM(Math.abs(diffValue)) : Math.abs(diffValue).toFixed(0)} FCFA`
          : `Acheter ~${typeof fmtM === 'function' ? fmtM(Math.abs(diffValue)) : Math.abs(diffValue).toFixed(0)} FCFA`);
    const color = balanced ? 'var(--green)' : (diff > 0 ? 'var(--red)' : 'var(--gold)');

    html += `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="color:var(--cream);font-family:var(--mono);font-weight:600">${t}</span>
          <span style="color:var(--dim)">Cible ${typeof fmt === 'function' ? fmt(targetPct, 1) : targetPct.toFixed(1)}% · Actuel ${typeof fmt === 'function' ? fmt(currentPct, 1) : currentPct.toFixed(1)}%</span>
        </div>
        <div style="position:relative;width:100%;height:8px;background:var(--border2);border-radius:4px;overflow:hidden">
          <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(currentPct, 100)}%;background:var(--gold);border-radius:4px"></div>
          <div style="position:absolute;left:${Math.min(targetPct, 100)}%;top:-3px;width:2px;height:14px;background:var(--cream)"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:11px;color:${color};font-weight:600">${action}</span>
          <button onclick="removeTargetAllocation('${t}')" style="font-size:10px;color:var(--dim);background:none;border:none;cursor:pointer">✕ retirer</button>
        </div>
      </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}
