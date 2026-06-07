// ═══════════════════════════════════════
// VIEW — Overview / Tableau de bord
// ═══════════════════════════════════════

// Helper : découvre et regroupe les indices par nom, en gardant le plus récent
function getLatestIndices() {
  const map = {};
  (allIndices || []).forEach(row => {
    if (!row?.indice || !row?.date_seance) return;
    const name = String(row.indice).trim();
    if (!map[name] || new Date(row.date_seance) > new Date(map[name].date_seance)) {
      map[name] = row;
    }
  });
  return map; // { "BRVM C": {valeur: 404.59, variation: 0.28, ...}, ... }
}

// Helper : historique complet d'un indice précis (pour le graphique)
function getIndiceHistory(indiceName, maxDays = 30) {
  return (allIndices || [])
    .filter(r => r?.indice && String(r.indice).trim() === indiceName && r?.valeur != null)
    .sort((a, b) => new Date(a.date_seance) - new Date(b.date_seance))
    .slice(-maxDays);
}

function renderOverview() {
  const latest = getLatestIndices();
  const indiceNames = Object.keys(latest);
  
  // Debug : affiche dans la console ce qui est découvert
  console.log('[Overview] Indices découverts :', indiceNames, latest);

  // ─── Mapping des 3 cards vers les noms d'indices réels ───
  const findIndice = (candidates) => {
    for (const c of candidates) {
      const found = indiceNames.find(n => n.toLowerCase() === c.toLowerCase());
      if (found) return found;
    }
    return null;
  };

  const mapCard = {
    composite: {
      candidates: ['BRVM C', 'BRVM Composite', 'COMPOSITE', 'BRVM_C', 'BRVM COMPOSITE'],
      id: 'idx-composite',
      chgId: 'idx-composite-chg',
      labelId: null // on garde le label HTML tel quel
    },
    brvm30: {
      candidates: ['BRVM 30', 'BRVM30', '30', 'BRVM_30'],
      id: 'idx-30',
      chgId: 'idx-30-chg',
      labelId: null
    },
    prestige: {
      candidates: ['BRVM Prestige', 'BRVMPrestige', 'PRESTIGE', 'BRVM_Prestige', 'BRVM PRESTIGE'],
      id: 'idx-prestige',
      chgId: 'idx-prestige-chg',
      labelId: null
    }
  };

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

  // Remplir les 3 cards
  let lastDate = null;
  Object.values(mapCard).forEach(card => {
    const realName = findIndice(card.candidates);
    const data = realName ? latest[realName] : null;
    
    if (data) {
      setIdx(card.id, data.valeur, card.chgId, data.variation);
      if (data.date_seance) lastDate = data.date_seance;
    } else {
      setIdx(card.id, null, card.chgId, null);
    }
  });

  // Date de la dernière séance
  const lastSessionEl = document.getElementById('lastSession');
  if (lastSessionEl) {
    lastSessionEl.textContent = lastDate ? 'Séance ' + fmtDate(lastDate) : '—';
  }

  // ─── Graphique Composite ───
  const chartTarget = findIndice(['BRVM C', 'BRVM Composite', 'COMPOSITE']) || indiceNames[0];
  let chartLabels = [], chartVals = [];
  
  if (chartTarget) {
    const history = getIndiceHistory(chartTarget, 30);
    chartLabels = history.map(d => 
      d?.date_seance ? new Date(d.date_seance).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : '?'
    );
    chartVals = history.map(d => d?.valeur ?? 0);
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
      <span class="stat-change ${cls}" style="font-family:var(--mono);font-size:12px">${v>0?'▲':v<<0?'▼':'='} ${Math.abs(v).toFixed(2)}%</span>
    </div>`;
  }).join('');
}
