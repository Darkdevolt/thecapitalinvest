
// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let marcheAllCours = [], allBoc = [], allFinancials = [], allIndices = [];
let _marcheCoursFilter = 'all', _marchePubFilter = 'all';
let marcheIdxChartInst = null, marcheIdxPeriod = 30;

// ═══════════════════════════════════════
// LOAD — TOUT passe par l'API (plus de sbQuery direct)
// ═══════════════════════════════════════
async function loadMarche() {
  try {
    const [coursRes, bocRes, financialsRes, indicesRes] = await Promise.allSettled([
      fetch('/api/marche?type=cours').then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/boc').then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/marche?type=financials').then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/marche?type=indices').then(r => r.ok ? r.json() : Promise.reject(r.status)),
    ]);

    if (coursRes.status === 'fulfilled') allCours = coursRes.value.data || [];
    if (bocRes.status === 'fulfilled') allBoc = bocRes.value.data || [];
    if (financialsRes.status === 'fulfilled') allFinancials = financialsRes.value.data || [];
    if (indicesRes.status === 'fulfilled') allIndices = indicesRes.value.data || [];

    // Plus jamais de données fictives

    renderIndices();
    renderCours();
    renderPalmares();
    renderDividendes();
    renderPublications();
    renderCalendrier();
    renderSeanceStats();
    
  } catch (err) {
    console.error('Erreur chargement marché:', err);
    document.getElementById('marche-coursTable').innerHTML = 
      '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--red)">Erreur de chargement des données. Veuillez réessayer.</td></tr>';
  }
}

// ═══════════════════════════════════════
// RENDER INDICES
// ═══════════════════════════════════════
function renderMarcheIndices() {
  const data = allIndices.slice(0, 2);
  const [latest, prev] = data;
  if (!latest) {
    ['composite','30','prestige'].forEach(id => {
      document.getElementById('idx-'+id).textContent = '—';
    });
  } else {
    const setIdx = (id, val, prev_val) => {
      document.getElementById('idx-'+id).textContent = fmt(val, 2);
      const diff = prev_val ? val - prev_val : 0;
      const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
      const ce = document.getElementById('idx-'+id+'-chg');
      ce.className = 'stat-change ' + cls;
      ce.innerHTML = (diff > 0 ? '▲' : diff < 0 ? '▼' : '=') + ' ' + Math.abs(diff).toFixed(2) + ' pts (' + Math.abs(diff / (prev_val||val) * 100).toFixed(2) + '%)';
    };
    if (latest.brvm_composite) setIdx('composite', latest.brvm_composite, prev?.brvm_composite);
    if (latest.brvm_30) setIdx('30', latest.brvm_30, prev?.brvm_30);
    if (latest.brvm_prestige) setIdx('prestige', latest.brvm_prestige, prev?.brvm_prestige);
  }
  renderIdxChart();
}

function renderMarcheIdxChart() {
  const slice = allIndices.slice(0, marcheIdxPeriod).reverse();
  const labels = slice.map(d => fmtDateShort(d.date_seance));
  const composite = slice.map(d => d.brvm_composite);
  const brvm30 = slice.map(d => d.brvm_30);

  if (marcheIdxChartInst) marcheIdxChartInst.destroy();
  marcheIdxChartInst = new Chart(document.getElementById('marche-chartIndices'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { ...mkLineDataset(composite, '#B8964E'), label: 'Composite' },
        { ...mkLineDataset(brvm30, '#60A5FA'), label: 'BRVM 30', fill: false },
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          display: true,
          labels: { color: 'rgba(245,240,232,0.5)', font: { size: 11, family: 'DM Mono' }, boxWidth: 20, padding: 16 }
        }
      }
    }
  });
}

function setMarcheIdxPeriod(n, btn) {
  marcheIdxPeriod = n;
  document.querySelectorAll('#marcheIdxPeriodBtns .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderIdxChart();
}

// ═══════════════════════════════════════
// RENDER COURS
// ═══════════════════════════════════════
function renderMarcheCours() {
  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });
  window._coursRows = Object.values(byTicker);
  const latestDate = allCours[0]?.date_seance;
  if (latestDate) document.getElementById('marche-coursDate').textContent = fmtDate(latestDate);
  filterCours();
}

function setMarcheCoursFilter(f, btn) {
  _marcheCoursFilter = f;
  document.querySelectorAll('#cours .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterCours();
}

function filterMarcheCours() {
  const q = (document.getElementById('marche-searchCours')?.value || '').toLowerCase();
  let rows = window._coursRows || [];
  if (_marcheCoursFilter === 'up') rows = rows.filter(r => parseFloat(r.variation) > 0);
  else if (_marcheCoursFilter === 'down') rows = rows.filter(r => parseFloat(r.variation) < 0);
  else if (_marcheCoursFilter !== 'all') rows = rows.filter(r => getSector(r.ticker).toLowerCase().includes(_marcheCoursFilter));
  if (q) rows = rows.filter(r => (r.ticker||'').toLowerCase().includes(q) || (r.nom||'').toLowerCase().includes(q));

  document.getElementById('marche-coursCount').textContent = rows.length + ' titres';
  const tbody = document.getElementById('marche-coursTable');
  tbody.innerHTML = rows.sort((a,b) => (a.ticker||'').localeCompare(b.ticker||'')).map(c =>
    `<tr>
      <td><span style="font-family:var(--mono);font-size:12px;font-weight:500;color:var(--gold)">${c.ticker}</span></td>
      <td style="color:var(--cream);font-size:12px">${c.nom || c.ticker}</td>
      <td class="right">${fmt(c.cours)}</td>
      <td class="right">${changePill(c.variation)}</td>
      <td class="right" style="color:var(--dim)">${c.plus_haut ? fmt(c.plus_haut) : '—'}</td>
      <td class="right" style="color:var(--dim)">${c.plus_bas ? fmt(c.plus_bas) : '—'}</td>
      <td class="right">${fmt(c.volume)}</td>
      <td class="right">${c.capitalisation ? fmtM(c.capitalisation) : '—'}</td>
      <td><span class="sector-tag">${getSector(c.ticker)}</span></td>
    </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--dim)">Aucun titre trouvé</td></tr>';
}

// ═══════════════════════════════════════
// RENDER PALMARES
// ═══════════════════════════════════════
function renderMarchePalmares() {
  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const all = Object.values(byTicker).filter(c => c.variation != null);
  const sorted = [...all].sort((a,b) => b.variation - a.variation);
  const top5up = sorted.filter(c => c.variation > 0).slice(0, 5);
  const top5down = [...all].sort((a,b) => a.variation - b.variation).filter(c => c.variation < 0).slice(0, 5);
  const topVol = [...all].sort((a,b) => b.volume - a.volume).slice(0, 5);

  const rowUp = c => `<tr><td><span style="font-family:var(--mono);font-size:12px;color:var(--gold)">${c.ticker}</span></td><td class="right">${fmt(c.cours)}</td><td class="right">${changePill(c.variation)}</td><td class="right">${fmt(c.volume)}</td></tr>`;
  const rowVol = c => `<tr><td><span style="font-family:var(--mono);font-size:12px;color:var(--gold)">${c.ticker}</span></td><td class="right">${fmt(c.volume)}</td><td class="right">${fmt(c.cours)}</td><td class="right">${changePill(c.variation)}</td><td class="right">${c.cours && c.volume ? fmtM(c.cours * c.volume) : '—'}</td></tr>`;

  document.getElementById('marche-topHausses').innerHTML = top5up.map(rowUp).join('') || '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--dim)">—</td></tr>';
  document.getElementById('marche-topBaisses').innerHTML = top5down.map(rowUp).join('') || '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--dim)">—</td></tr>';
  document.getElementById('marche-topVolumes').innerHTML = topVol.map(rowVol).join('') || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--dim)">—</td></tr>';
}

// ═══════════════════════════════════════
// RENDER DIVIDENDES
// ═══════════════════════════════════════
function renderMarcheDividendes() {
  const coursMap = {};
  allCours.forEach(c => { if (!coursMap[c.ticker]) coursMap[c.ticker] = c; });
  const rows = allFinancials.filter(f => f.dpa).sort((a,b) => {
    const rdtA = (coursMap[a.ticker]?.cours && a.dpa) ? a.dpa / coursMap[a.ticker].cours : 0;
    const rdtB = (coursMap[b.ticker]?.cours && b.dpa) ? b.dpa / coursMap[b.ticker].cours : 0;
    return rdtB - rdtA;
  });

  document.getElementById('marche-dividendesTable').innerHTML = rows.map(f => {
    const c = coursMap[f.ticker];
    const cp = c?.cours;
    const rdt = (cp && f.dpa) ? ((f.dpa / cp) * 100).toFixed(2) + '%' : '—';
    const distrib = (f.bpa && f.dpa) ? ((f.dpa / f.bpa) * 100).toFixed(0) + '%' : '—';
    const rdtNum = cp && f.dpa ? f.dpa / cp * 100 : 0;
    const rdtColor = rdtNum > 5 ? 'var(--green)' : rdtNum > 2 ? 'var(--gold)' : 'var(--muted)';
    return `<tr>
      <td><span style="font-family:var(--mono);font-size:12px;color:var(--gold)">${f.ticker}</span></td>
      <td style="font-size:12px;color:var(--muted)">${c?.nom || f.ticker}</td>
      <td class="right">${cp ? fmt(cp) : '—'}</td>
      <td class="right" style="color:var(--gold-light);font-weight:500">${fmt(f.dpa)}</td>
      <td class="right" style="color:${rdtColor};font-weight:500">${rdt}</td>
      <td class="right">${f.bpa ? fmt(f.bpa) : '—'}</td>
      <td class="right">${distrib}</td>
      <td class="right" style="color:var(--dim)">${f.annee || '—'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--dim)">Données de dividendes non disponibles</td></tr>';
}

// ═══════════════════════════════════════
// RENDER PUBLICATIONS (BOC)
// ═══════════════════════════════════════
function renderMarchePublications() {
  window._pubRows = allBoc;
  filterPub();
}

function setMarchePubFilter(f, btn) {
  _marchePubFilter = f;
  document.querySelectorAll('#publications .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterPub();
}

function filterMarchePub() {
  const q = (document.getElementById('marche-searchPub')?.value || '').toLowerCase();
  let rows = window._pubRows || [];
  if (_marchePubFilter !== 'all') rows = rows.filter(r => (r.type||'').toLowerCase().includes(_marchePubFilter));
  if (q) rows = rows.filter(r => (r.titre||'').toLowerCase().includes(q) || (r.emetteur||'').toLowerCase().includes(q));

  const grid = document.getElementById('marche-pubGrid');
  grid.innerHTML = rows.length ? rows.map(bocCard).join('') :
    `<div style="grid-column:1/-1" class="empty-state"><div class="empty-icon">◉</div><div class="empty-title">Aucune publication</div><div class="empty-text">Modifiez vos critères</div></div>`;
}

function marcheBocCard(boc) {
  const type = (boc.type || 'obligation').toLowerCase();
  const typeLabel = { obligation:'Obligation', action:'Action', opcvm:'OPCVM' }[type] || type;
  const details = [
    boc.taux && ['Taux', boc.taux.toFixed(2) + '%'],
    boc.montant && ['Montant', fmtM(boc.montant) + ' FCFA'],
    boc.valeur_nominale && ['Val. Nominale', fmt(boc.valeur_nominale) + ' FCFA'],
    boc.prix_offre && ['Prix d\'offre', fmt(boc.prix_offre) + ' FCFA'],
    boc.valeur_liquidative && ['Val. Liquid.', fmt(boc.valeur_liquidative) + ' FCFA'],
    boc.date_echeance && ['Échéance', fmtDate(boc.date_echeance)],
  ].filter(Boolean);
  return `<div class="boc-card">
    <div class="boc-header">
      <div><div class="boc-title">${boc.titre||'—'}</div><div class="boc-emetteur">${boc.emetteur||'—'}</div></div>
      <span class="boc-type ${type}">${typeLabel}</span>
    </div>
    <div class="boc-body">${details.map(([k,v])=>`<div class="boc-row"><span class="boc-key">${k}</span><span class="boc-val">${v}</span></div>`).join('')}</div>
    <div class="boc-footer">📅 ${fmtDate(boc.date_seance)}</div>
  </div>`;
}

// ═══════════════════════════════════════
// RENDER CALENDRIER — Plus de données codées en dur
// ═══════════════════════════════════════
function renderMarcheCalendrier() {
  document.getElementById('marche-calendrierList').innerHTML = `
    <div class="event-item" style="justify-content:center;padding:30px;">
      <div style="text-align:center;color:var(--dim);">
        <div style="font-size:24px;margin-bottom:8px;">📅</div>
        <div style="font-size:13px;margin-bottom:4px;">Calendrier en cours de construction</div>
        <div style="font-size:11px;">Les prochaines AG et dividendes seront affichées ici.</div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// RENDER SEANCE STATS
// ═══════════════════════════════════════
function renderMarcheSeanceStats() {
  const byTicker = {};
  allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const rows = Object.values(byTicker);
  const hausse = rows.filter(c => c.variation > 0).length;
  const baisse = rows.filter(c => c.variation < 0).length;
  const stable = rows.filter(c => c.variation == 0).length;
  const totalVol = rows.reduce((s, c) => s + (c.volume || 0), 0);
  const totalCap = rows.reduce((s, c) => s + (c.capitalisation || 0), 0);
  const topGain = rows.reduce((m, c) => (!m || c.variation > m.variation) ? c : m, null);

  const stats = [
    ['Titres en hausse', hausse + ' titres', 'var(--green)'],
    ['Titres en baisse', baisse + ' titres', 'var(--red)'],
    ['Titres stables', stable + ' titres', 'var(--dim)'],
    ['Volume total échangé', fmt(totalVol) + ' titres', 'var(--cream)'],
    ['Capitalisation totale', fmtM(totalCap), 'var(--cream)'],
    ['Meilleure performance', topGain ? topGain.ticker + ' +' + parseFloat(topGain.variation).toFixed(2) + '%' : '—', 'var(--gold)'],
  ];

  document.getElementById('marche-seanceStats').innerHTML = stats.map(([l, v, c]) =>
    `<div class="seance-row">
      <span class="seance-label">${l}</span>
      <span class="seance-val" style="color:${c}">${v}</span>
    </div>`
  ).join('');
}

// INIT
loadAll();
