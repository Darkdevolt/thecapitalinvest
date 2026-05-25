// ═══════════════════════════════════════
// VIEW — Overview / Tableau de bord
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════
function renderOverview() {
  const indices = allIndices || [];
  
  const setIdx = (id, val, chgId, chg) => {
    const el = document.getElementById(id); 
    const ce = document.getElementById(chgId);
    if (el) el.textContent = (val != null && !isNaN(+val)) ? fmt(+val, 2) : '—';
    if (ce) {
      const n = parseFloat(chg);
      const cls = isNaN(n) ? 'neutral' : n > 0 ? 'up' : n < 0 ? 'down' : 'neutral';
      ce.className = `stat-change ${cls}`;
      ce.innerHTML = isNaN(n) ? '—' : (n > 0 ? '▲' : n < 0 ? '▼' : '=') + ' ' + Math.abs(n).toFixed(2) + ' pts';
    }
  };

  let chartLabels = [], chartVals = [];
  
  if (indices.length >= 2) {
    const [l, p] = [indices[0], indices[1]];
    setIdx('idx-composite', l?.brvm_composite, 'idx-composite-chg', (l?.brvm_composite ?? 0) - (p?.brvm_composite ?? 0));
    setIdx('idx-30', l?.brvm_30, 'idx-30-chg', (l?.brvm_30 ?? 0) - (p?.brvm_30 ?? 0));
    setIdx('idx-prestige', l?.brvm_prestige, 'idx-prestige-chg', (l?.brvm_prestige ?? 0) - (p?.brvm_prestige ?? 0));
    
    const lastSessionEl = document.getElementById('lastSession');
    if (lastSessionEl) lastSessionEl.textContent = l?.date_seance ? 'Séance ' + fmtDate(l.date_seance) : '—';
    
    const rev = [...indices].slice(0, 30).reverse();
    chartLabels = rev.map(d => d?.date_seance ? new Date(d.date_seance).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : '?');
    chartVals = rev.map(d => d?.brvm_composite ?? 0);
  } else if (indices.length === 1) {
    const l = indices[0];
    setIdx('idx-composite', l?.brvm_composite, 'idx-composite-chg', 0);
    setIdx('idx-30', l?.brvm_30, 'idx-30-chg', 0);
    setIdx('idx-prestige', l?.brvm_prestige, 'idx-prestige-chg', 0);
    
    const lastSessionEl = document.getElementById('lastSession');
    if (lastSessionEl) lastSessionEl.textContent = l?.date_seance ? 'Séance ' + fmtDate(l.date_seance) : '—';
  } else {
    ['idx-composite', 'idx-30', 'idx-prestige'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    const lastSessionEl = document.getElementById('lastSession');
    if (lastSessionEl) lastSessionEl.textContent = 'Aucune donnée indice';
  }

  if (compositeChartInst) {
    compositeChartInst.destroy();
    compositeChartInst = null;
  }
  
  const canvas = document.getElementById('chartComposite');
  if (canvas && chartLabels.length > 1 && chartVals.some(v => v > 0)) {
    compositeChartInst = new Chart(canvas, {
      type: 'line',
      data: { labels: chartLabels, datasets: [mkDataset(chartVals)] },
      options: chartOpts
    });
  } else if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(245,240,232,0.3)';
      ctx.font = '13px DM Sans';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée historique', canvas.width / 2, canvas.height / 2);
    }
  }

  renderCoursTable();
  renderTopMovers();
}

function renderCoursTable() {
  const byTicker = {};
  allCours.forEach(c => { if (c?.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const rows = Object.values(byTicker).sort((a, b) => (a?.ticker || '').localeCompare(b?.ticker || ''));
  document.getElementById('coursCount').textContent = rows.length + ' titre' + (rows.length > 1 ? 's' : '');
  if (!rows.length) {
    const isConnected = allCours.length === 0 && allEntreprises.length === 0;
    const message = isConnected 
      ? '⚠️ Connexion Supabase OK mais aucune donnée dans la table cours_latest. Vérifiez que vos données sont bien insérées.'
      : 'Aucune donnée de cours disponible.';
    document.getElementById('coursTable').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--dim)">' + message + '</td></tr>';
    return;
  }
  document.getElementById('coursTable').innerHTML = rows.map(c =>
    `<tr onclick="openFiche('${c.ticker}','overview')">
      <td><strong style="font-family:var(--mono);font-size:12px;color:var(--gold)">${c.ticker}</strong></td>
      <td class="right">${fmt(c.cours)}</td>
      <td class="right">${changePill(c.variation)}</td>
      <td class="right">${fmt(c.volume)}</td>
      <td class="right">${c.capitalisation ? fmtM(c.capitalisation) : '—'}</td>
      <td><span class="sector-tag">${getSector(c.ticker)}</span></td>
    </tr>`).join('');
}

function renderTopMovers() {
  if (!Array.isArray(allCours) || allCours.length === 0) {
    document.getElementById('topMovers').innerHTML = '<div style="padding:20px;text-align:center;color:var(--dim);font-size:13px">Aucune donnée de cours disponible</div>';
    return;
  }
  const byTicker = {};
  allCours.forEach(c => { if (c?.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const sorted = Object.values(byTicker)
    .filter(c => c?.variation != null && !isNaN(parseFloat(c.variation)))
    .sort((a, b) => Math.abs(parseFloat(b.variation || 0)) - Math.abs(parseFloat(a.variation || 0)))
    .slice(0, 8);
  if (!sorted.length) { 
    document.getElementById('topMovers').innerHTML = '<div style="padding:20px;text-align:center;color:var(--dim);font-size:13px">Aucune variation disponible</div>'; 
    return; 
  }
  document.getElementById('topMovers').innerHTML = sorted.map(c => {
    const v = parseFloat(c.variation);
    const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
    return `<div onclick="openFiche('${c.ticker}','overview')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid rgba(184,150,78,0.04);cursor:pointer" onmouseenter="this.style.background='rgba(184,150,78,0.03)'" onmouseleave="this.style.background=''">
      <div>
        <div style="font-family:var(--mono);font-size:12px;font-weight:500;color:var(--cream)">${c.ticker}</div>
        <div style="font-size:11px;color:var(--dim)">${fmt(c.cours)} FCFA</div>
      </div>
      <span class="stat-change ${cls}" style="font-family:var(--mono);font-size:12px">${v>0?'▲':v<0?'▼':'='} ${Math.abs(v).toFixed(2)}%</span>
    </div>`;
  }).join('');
}