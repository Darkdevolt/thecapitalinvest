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
  return map;
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

  console.log('[Overview] Indices découverts :', indiceNames, latest);

  // ─── HERO : Statut marché ───
  updateMarketStatus();

  // ─── INDICES CARDS ───
  renderIndexCards(latest, indiceNames);

  // ─── GRAPHIQUE COMPOSITE ───
  renderCompositeChart();

  // ─── SECTEUR HEATMAP ───
  renderSectorHeatmap();

  // ─── FEEDS DROITE ───
  renderNewsFeed();
  renderTopMovers();
  renderPubFeed();
  renderAlertFeed();
  renderWatchFeed();

  // ─── COURS DU JOUR ───
  renderCoursTable();
}

// ─── MARKET STATUS ───
function updateMarketStatus() {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();
  const day = now.getDay();

  const isOpen = day >= 1 && day <= 5 && (hour > 9 || (hour === 9 && min >= 30)) && (hour < 15 || (hour === 15 && min <= 30));

  const statusEl = document.getElementById('marketStatus');
  const timeEl = document.getElementById('marketTime');
  const nextEl = document.getElementById('marketNext');

  if (statusEl) {
    statusEl.className = 'market-status ' + (isOpen ? '' : 'closed');
    statusEl.innerHTML = (isOpen ? '' : '● ') +
      '<span class="status-dot"></span>' + (isOpen ? 'Marché Ouvert' : 'Marché Fermé') + '';
  }

  if (timeEl) timeEl.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' GMT';

  if (nextEl) {
    if (isOpen) {
      const closeTime = new Date(now);
      closeTime.setHours(15, 30, 0);
      const diff = Math.floor((closeTime - now) / 60000);
      nextEl.textContent = 'Fermeture dans ' + diff + ' min';
    } else {
      nextEl.textContent = 'Prochaine ouverture : lun. 09:30';
    }
  }
}

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

function drawSparkline(canvasId, values) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || values.length < 2) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width, h = rect.height;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;

  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.strokeStyle = values[values.length-1] >= values[0] ? 'var(--green)' : 'var(--red)';
  ctx.lineWidth = 2;

  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.8 - h * 0.1;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
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

function setCompositePeriod(days, btn) {
  document.querySelectorAll('.chart-tabs .year-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _compositePeriod = days;
  renderCompositeChart();
}

// ─── SECTOR HEATMAP ───
function renderSectorHeatmap() {
  const bySector = {};
  const byTicker = {};

  allCours.forEach(c => {
    if (!c?.ticker) return;
    if (!byTicker[c.ticker]) byTicker[c.ticker] = c;
  });

  Object.values(byTicker).forEach(c => {
    const sector = getSector(c.ticker) || 'Autre';
    if (!bySector[sector]) bySector[sector] = { total: 0, count: 0, values: [] };
    const v = parseFloat(c.variation) || 0;
    bySector[sector].total += v;
    bySector[sector].count++;
    bySector[sector].values.push(v);
  });

  const container = document.getElementById('sectorHeatmap');
  if (!container) return;

  const sectors = Object.entries(bySector).map(([name, data]) => ({
    name,
    avg: data.total / data.count,
    count: data.count
  })).sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg));

  if (!sectors.length) {
    container.innerHTML = '<div class="heatmap-placeholder">Aucune donnée sectorielle</div>';
    return;
  }

  container.innerHTML = sectors.map(s => {
    const cls = s.avg > 0 ? 'heatmap-up' : s.avg < 0 ? 'heatmap-down' : 'heatmap-neutral';
    const color = s.avg > 0 ? 'var(--green)' : s.avg < 0 ? 'var(--red)' : 'var(--dim)';
    return `<div class="heatmap-cell ${cls}">
      <div class="hm-name">${s.name}</div>
      <div class="hm-val" style="color:${color}">${s.avg > 0 ? '+' : ''}${s.avg.toFixed(2)}%</div>
      <div class="hm-count">${s.count} titre${s.count > 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
}

// ─── NEWS FEED ───
function renderNewsFeed() {
  const container = document.getElementById('newsFeed');
  if (!container) return;

  const recent = (allAnalyses || []).slice(0, 5);

  if (!recent.length) {
    container.innerHTML = '<div class="feed-placeholder">Aucune analyse disponible</div>';
    return;
  }

  container.innerHTML = recent.map(a => {
    const badgeClass = (a.recommandation || '').toLowerCase();
    const badgeText = a.recommandation || 'NEWS';
    const ticker = a.ticker || '—';
    return `<div class="feed-item">
      <span class="feed-badge ${badgeClass}">${badgeText}</span>
      <div class="feed-title">${a.titre || 'Analyse ' + ticker}</div>
      <div class="feed-meta">${ticker} • ${fmtDate(a.date_analyse)} • Objectif: ${a.objectif || '—'} FCFA</div>
    </div>`;
  }).join('');
}

// ─── TOP MOVERS ───
let _moversTab = 'gainers';

function setMoversTab(tab, btn) {
  document.querySelectorAll('.tm-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _moversTab = tab;
  renderTopMovers();
}

function renderTopMovers() {
  const container = document.getElementById('topMovers');
  if (!container) return;

  if (!Array.isArray(allCours) || allCours.length === 0) {
    container.innerHTML = '<div class="feed-placeholder">Aucune donnée</div>';
    return;
  }

  const byTicker = {};
  allCours.forEach(c => { if (c?.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const values = Object.values(byTicker);

  let sorted = [];

  if (_moversTab === 'gainers') {
    sorted = values.filter(c => parseFloat(c.variation) > 0)
      .sort((a, b) => parseFloat(b.variation) - parseFloat(a.variation)).slice(0, 8);
  } else if (_moversTab === 'losers') {
    sorted = values.filter(c => parseFloat(c.variation) < 0)
      .sort((a, b) => parseFloat(a.variation) - parseFloat(b.variation)).slice(0, 8);
  } else {
    sorted = values.sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 8);
  }

  if (!sorted.length) {
    container.innerHTML = '<div class="feed-placeholder">Aucune donnée</div>';
    return;
  }

  container.innerHTML = sorted.map(c => {
    const v = parseFloat(c.variation) || 0;
    const vol = _moversTab === 'volume';
    const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
    const rightVal = vol ? fmt(c.volume) : (Math.abs(v).toFixed(2) + '%');
    const rightIcon = vol ? '' : (v > 0 ? '▲' : v < 0 ? '▼' : '=');

    return `<div class="mover-row ${cls}">
      <div class="mover-ticker">${c.ticker}</div>
      <div class="mover-price">${fmt(c.cours)} FCFA</div>
      <div class="mover-var">${rightIcon} ${rightVal}</div>
    </div>`;
  }).join('');
}

// ─── PUBLICATIONS FEED ───
function renderPubFeed() {
  const container = document.getElementById('pubFeed');
  if (!container) return;

  const upcoming = (allFinancials || [])
    .filter(f => f.periode === 'annuel' || f.periode === 's1')
    .sort((a, b) => (b.annee || 0) - (a.annee || 0))
    .slice(0, 5);

  if (!upcoming.length) {
    container.innerHTML = '<div class="feed-placeholder">Aucune publication prévue</div>';
    return;
  }

  container.innerHTML = upcoming.map(p => {
    const ticker = p.ticker || '—';
    const year = p.annee || new Date().getFullYear();
    const isPublished = p.resultat_net != null;
    const month = isPublished ? '03' : '06';

    return `<div class="pub-item">
      <div class="pub-date"><div class="pub-day">15</div><div class="pub-month">${month}</div></div>
      <div class="pub-info">
        <div class="pub-ticker">${ticker}</div>
        <div class="pub-title">${p.periode} ${year}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── ALERTES FEED ───
function renderAlertFeed() {
  const container = document.getElementById('alertFeed');
  if (!container) return;

  const alerts = JSON.parse(localStorage.getItem('tc_alerts') || '[]');
  const active = alerts.filter(a => !a.triggered).slice(0, 5);

  if (!active.length) {
    container.innerHTML = '<div class="feed-placeholder">Aucune alerte active</div>';
    return;
  }

  const byTicker = {};
  allCours.forEach(c => { if (c?.ticker) byTicker[c.ticker] = c; });

  container.innerHTML = active.map(a => {
    const c = byTicker[a.ticker];
    const current = c?.cours || 0;
    const triggered = a.condition === 'above' ? current >= a.price : current <= a.price;

    return `<div class="alert-row ${triggered ? 'triggered' : ''}">
      <div class="alert-ticker">${a.ticker}</div>
      <div class="alert-cond">${a.condition === 'above' ? '>' : '<'} ${a.price} FCFA</div>
      <div class="alert-current">${fmt(current)}</div>
    </div>`;
  }).join('');
}

// ─── WATCHLIST FEED ───
function renderWatchFeed() {
  const container = document.getElementById('watchFeed');
  if (!container) return;

  const watchlist = JSON.parse(localStorage.getItem('tc_watchlist') || '[]');
  const positions = JSON.parse(localStorage.getItem('tc_portfolio') || '[]');
  const tickers = [...new Set([...watchlist, ...positions.map(p => p.ticker)])];

  if (!tickers.length) {
    container.innerHTML = '<div class="feed-placeholder">Ajoutez des titres à votre watchlist</div>';
    return;
  }

  const byTicker = {};
  allCours.forEach(c => { if (c?.ticker) byTicker[c.ticker] = c; });

  container.innerHTML = tickers.map(t => {
    const c = byTicker[t];
    if (!c) return '';
    const v = parseFloat(c.variation) || 0;
    const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
    const ent = entMap[t];
    return `<div class="watch-row ${cls}">
      <div class="watch-ticker">${t}</div>
      <div class="watch-name">${ent?.nom || ''}</div>
      <div class="watch-price">${fmt(c.cours)}</div>
      <div class="watch-var">${v > 0 ? '+' : ''}${v.toFixed(2)}%</div>
    </div>`;
  }).join('');
}

// ─── COURS TABLE ───
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
    document.getElementById('coursTable').innerHTML = '<tr><td colspan="6" class="empty-msg">' + message + '</td></tr>';
    return;
  }
  document.getElementById('coursTable').innerHTML = rows.map(c =>
    `<tr>
      <td><strong>${c.ticker}</strong></td>
      <td>${fmt(c.cours)}</td>
      <td>${changePill(c.variation)}</td>
      <td>${fmt(c.volume)}</td>
      <td>${c.capitalisation ? fmtM(c.capitalisation) : '—'}</td>
      <td>${getSector(c.ticker)}</td>
    </tr>`).join('');
}
