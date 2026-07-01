// ─── INDEX CARDS (avec sparklines) — CORRIGÉ : noms dynamiques depuis Supabase ───
function renderIndexCards(latest, indiceNames) {
  // CORRECTION : au lieu de chercher des noms hardcodés, on prend les 3 premiers
  // indices trouvés dans Supabase, triés par nom.
  const sortedNames = indiceNames.sort((a, b) => a.localeCompare(b));
  
  const mapCard = {
    composite: sortedNames[0] || null,
    brvm30: sortedNames[1] || null,
    prestige: sortedNames[2] || null
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

  let lastDate = null;

  Object.entries(mapCard).forEach(([key, realName]) => {
    const data = realName ? latest[realName] : null;
    const cardIds = {
      composite: { id: 'idx-composite', chgId: 'idx-composite-chg', sparkId: 'sparkComposite' },
      brvm30: { id: 'idx-30', chgId: 'idx-30-chg', sparkId: 'spark30' },
      prestige: { id: 'idx-prestige', chgId: 'idx-prestige-chg', sparkId: 'sparkPrestige' }
    };
    const card = cardIds[key];

    if (data && card) {
      setIdx(card.id, data.valeur, card.chgId, data.variation);
      if (data.date_seance) lastDate = data.date_seance;
      const history = getIndiceHistory(realName, 20);
      drawSparkline(card.sparkId, history.map(d => d.valeur));
    } else if (card) {
      setIdx(card.id, null, card.chgId, null);
    }
  });

  const lastSessionEl = document.getElementById('lastSession');
  if (lastSessionEl) lastSessionEl.textContent = lastDate ? 'Séance ' + fmtDate(lastDate) : '—';
}
// ─── COMPOSITE CHART ───
let _compositePeriod = 30;

function renderCompositeChart() {
  // CORRECTION : prend le premier indice disponible au lieu de 'BRVM C' hardcodé
  const latest = getLatestIndices();
  const indiceNames = Object.keys(latest).sort((a, b) => a.localeCompare(b));
  const chartTarget = indiceNames[0] || 'BRVM C'; // fallback uniquement si vide
  
  const history = getIndiceHistory(chartTarget, _compositePeriod);

  const labels = history.map(d =>
    d?.date_seance ? new Date(d.date_seance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '?'
  );
  const values = history.map(d => d?.valeur ?? 0);

  if (compositeChartInst) {
    compositeChartInst.destroy();
    compositeChartInst = null;
  }

  const canvas = document.getElementById('chartComposite');
  if (canvas && labels.length > 1 && values.some(v => v > 0)) {
    compositeChartInst = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ ...mkDataset(values), tension: 0.3, pointRadius: 0, pointHoverRadius: 6 }]
      },
      options: {
        ...chartOpts,
        interaction: { intersect: false, mode: 'index' },
        plugins: { ...chartOpts.plugins, legend: { display: false } }
      }
    });
  }
}
