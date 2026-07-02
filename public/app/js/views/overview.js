// ═══════════════════════════════════════
// VIEW — Overview / Tableau de bord
// ═══════════════════════════════════════

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

function getIndiceHistory(indiceName, maxDays) {
  maxDays = maxDays || 30;
  return (allIndices || [])
    .filter(function(r) { return r && r.indice && String(r.indice).trim() === indiceName && r.valeur != null; })
    .sort(function(a, b) { return new Date(a.date_seance) - new Date(b.date_seance); })
    .slice(-maxDays);
}

function renderOverview() {
  const latest = getLatestIndices();
  const indiceNames = Object.keys(latest);

  console.log('[Overview] Indices découverts :', indiceNames, latest);

  updateMarketStatus();
  renderIndexCards(latest, indiceNames);
  renderCompositeChart();
  renderSessionAnalytics();
  renderSectorHeatmap();
  renderNewsFeed();
  renderTopMovers();
  renderPubFeed();
  renderAlertFeed();
  renderWatchFeed();
  renderCoursTable();
}

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
    statusEl.innerHTML = (isOpen ? '' : '● ') + '<span class="status-dot"></span>' + (isOpen ? 'Marché Ouvert' : 'Marché Fermé');
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

function renderIndexCards(latest, indiceNames) {
  const findIndice = function(patterns) {
    return indiceNames.find(function(n) {
      return patterns.some(function(p) { return n.toUpperCase().includes(p); });
    }) || null;
  };

  const mapCard = {
    composite: findIndice(['COMPOSITE', 'BRVM C', 'BRVMC']),
    brvm30: findIndice(['30', 'BRVM30']),
    prestige: findIndice(['PRESTIGE'])
  };

  const setIdx = function(id, val, chgId, chg) {
    const el = document.getElementById(id);
    const ce = document.getElementById(chgId);
    if (el) el.textContent = (val != null && !isNaN(+val)) ? fmt(+val, 2) : '—';
    if (ce) {
      const n = parseFloat(chg);
      const cls = isNaN(n) ? 'neutral' : n > 0 ? 'up' : n < 0 ? 'down' : 'neutral';
      ce.className = 'stat-change ' + cls;
      ce.innerHTML = isNaN(n) ? '—' : (n > 0 ? '▲' : n < 0 ? '▼' : '=') + ' ' + Math.abs(n).toFixed(2) + ' pts';
    }
  };

  let lastDate = null;

  Object.entries(mapCard).forEach(function(entry) {
    const key = entry[0];
    const realName = entry[1];
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
      drawSparkline(card.sparkId, history.map(function(d) { return d.valeur; }));
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
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const range = max - min || 1;

  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.strokeStyle = values[values.length-1] >= values[0] ? 'var(--green)' : 'var(--red)';
  ctx.lineWidth = 2;

  values.forEach(function(v, i) {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.8 - h * 0.1;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

let _compositePeriod = 30;

function renderCompositeChart() {
  const latest = getLatestIndices();
  const indiceNames = Object.keys(latest).sort(function(a, b) { return a.localeCompare(b); });
  const chartTarget = indiceNames[0] || 'BRVM C';

  const history = getIndiceHistory(chartTarget, _compositePeriod);

  const labels = history.map(function(d) {
    return d && d.date_seance ? new Date(d.date_seance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '?';
  });
  const values = history.map(function(d) { return d && d.valeur != null ? d.valeur : 0; });

  if (compositeChartInst) {
    compositeChartInst.destroy();
    compositeChartInst = null;
  }

  const canvas = document.getElementById('chartComposite');
  if (canvas && labels.length > 1 && values.some(function(v) { return v > 0; })) {
    compositeChartInst = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ data: values, borderColor: '#B8964E', borderWidth: 2, pointRadius: 0, pointHoverRadius: 6, fill: true, tension: 0.3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false } }
      }
    });
  }
}

function setCompositePeriod(days, btn) {
  document.querySelectorAll('.chart-tabs .year-tab').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  _compositePeriod = days;
  renderCompositeChart();
}

// ═══════════════════════════════════════════════════════
// SESSION ANALYTICS
// ═══════════════════════════════════════════════════════

function renderSessionAnalytics() {
  const container = document.getElementById('sessionAnalytics');
  if (!container) return;

  const byTicker = {};
  allCours.forEach(function(c) { if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const rows = Object.values(byTicker);

  if (!rows.length) {
    container.innerHTML = '';
    return;
  }

  const hausses = rows.filter(function(r) { return parseFloat(r.variation) > 0; }).length;
  const baisses = rows.filter(function(r) { return parseFloat(r.variation) < 0; }).length;
  const stables = rows.filter(function(r) { return parseFloat(r.variation) === 0; }).length;

  const topPerformers = rows.slice().filter(function(r) { return parseFloat(r.variation) > 0; })
    .sort(function(a, b) { return parseFloat(b.variation) - parseFloat(a.variation); })
    .slice(0, 5);

  const topLosers = rows.slice().filter(function(r) { return parseFloat(r.variation) < 0; })
    .sort(function(a, b) { return parseFloat(a.variation) - parseFloat(b.variation); })
    .slice(0, 5);

  const topVolumes = rows.slice().sort(function(a, b) { return (b.volume || 0) - (a.volume || 0); }).slice(0, 5);

  const topValeurs = rows.slice().map(function(r) {
    return { ticker: r.ticker, volume: r.volume, cours: r.cours, valeur: (r.volume || 0) * (r.cours || 0) };
  }).sort(function(a, b) { return b.valeur - a.valeur; }).slice(0, 5);

  var performersHtml = topPerformers.map(function(r) {
    return '<div class="perf-bar-row" onclick="openFiche(\'' + r.ticker + '\')" style="cursor:pointer">' +
      '<span class="perf-ticker">' + r.ticker + '</span>' +
      '<div class="perf-bar-container">' +
        '<div class="perf-bar positive" style="width:' + Math.min(Math.abs(parseFloat(r.variation)) * 3, 100) + '%"></div>' +
      '</div>' +
      '<span class="perf-val positive">+' + parseFloat(r.variation).toFixed(2) + '%</span>' +
    '</div>';
  }).join('');

  var losersHtml = topLosers.map(function(r) {
    return '<div class="perf-bar-row" onclick="openFiche(\'' + r.ticker + '\')" style="cursor:pointer">' +
      '<span class="perf-ticker">' + r.ticker + '</span>' +
      '<div class="perf-bar-container">' +
        '<div class="perf-bar negative" style="width:' + Math.min(Math.abs(parseFloat(r.variation)) * 3, 100) + '%"></div>' +
      '</div>' +
      '<span class="perf-val negative">' + parseFloat(r.variation).toFixed(2) + '%</span>' +
    '</div>';
  }).join('');

  var volumesHtml = topVolumes.map(function(r, i) {
    var pct = topVolumes[0].volume > 0 ? (r.volume / topVolumes[0].volume * 100).toFixed(0) : 0;
    var bg = i === 0 ? 'var(--gold)' : i === 1 ? 'rgba(184,150,78,0.6)' : 'rgba(184,150,78,0.3)';
    return '<div class="top-item" onclick="openFiche(\'' + r.ticker + '\')" style="cursor:pointer">' +
      '<span class="top-rank">' + (i + 1) + '</span>' +
      '<span class="top-ticker">' + r.ticker + '</span>' +
      '<div class="top-bar-container">' +
        '<div class="top-bar" style="width:' + pct + '%;background:' + bg + ';"></div>' +
      '</div>' +
      '<span class="top-val">' + fmt(r.volume) + '</span>' +
    '</div>';
  }).join('');

  var valeursHtml = topValeurs.map(function(r, i) {
    var pct = topValeurs[0].valeur > 0 ? (r.valeur / topValeurs[0].valeur * 100).toFixed(0) : 0;
    var bg = i === 0 ? 'var(--gold)' : i === 1 ? 'rgba(184,150,78,0.6)' : 'rgba(184,150,78,0.3)';
    return '<div class="top-item" onclick="openFiche(\'' + r.ticker + '\')" style="cursor:pointer">' +
      '<span class="top-rank">' + (i + 1) + '</span>' +
      '<span class="top-ticker">' + r.ticker + '</span>' +
      '<div class="top-bar-container">' +
        '<div class="top-bar" style="width:' + pct + '%;background:' + bg + ';"></div>' +
      '</div>' +
      '<span class="top-val">' + fmtM(r.valeur) + '</span>' +
    '</div>';
  }).join('');

  container.innerHTML = '<div class="session-grid">' +
    '<div class="session-card">' +
      '<div class="session-card-title">Performance de la Séance</div>' +
      '<div class="session-bars">' + performersHtml + losersHtml + '</div>' +
    '</div>' +
    '<div class="session-card">' +
      '<div class="session-card-title">Tendances</div>' +
      '<div class="tendance-grid">' +
        '<div class="tendance-item up" onclick="nav(\'titres\')" style="cursor:pointer">' +
          '<div class="tendance-icon">▲</div>' +
          '<div class="tendance-count">' + hausses + '</div>' +
          '<div class="tendance-label">Titres en hausse</div>' +
        '</div>' +
        '<div class="tendance-item neutral" onclick="nav(\'titres\')" style="cursor:pointer">' +
          '<div class="tendance-icon">=</div>' +
          '<div class="tendance-count">' + stables + '</div>' +
          '<div class="tendance-label">Titres stables</div>' +
        '</div>' +
        '<div class="tendance-item down" onclick="nav(\'titres\')" style="cursor:pointer">' +
          '<div class="tendance-icon">▼</div>' +
          '<div class="tendance-count">' + baisses + '</div>' +
          '<div class="tendance-label">Titres en baisse</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="session-card">' +
      '<div class="session-card-title">Top 5 Volumes Transigés</div>' +
      '<div class="top-list">' + volumesHtml + '</div>' +
    '</div>' +
    '<div class="session-card">' +
      '<div class="session-card-title">Top 5 Valeurs Transigées</div>' +
      '<div class="top-list">' + valeursHtml + '</div>' +
    '</div>' +
  '</div>';
}

function renderSectorHeatmap() {
  const bySector = {};
  const byTicker = {};

  allCours.forEach(function(c) {
    if (!c || !c.ticker) return;
    if (!byTicker[c.ticker]) byTicker[c.ticker] = c;
  });

  Object.values(byTicker).forEach(function(c) {
    const sector = getSector(c.ticker) || 'Autre';
    if (!bySector[sector]) bySector[sector] = { total: 0, count: 0, values: [] };
    const v = parseFloat(c.variation) || 0;
    bySector[sector].total += v;
    bySector[sector].count++;
    bySector[sector].values.push(v);
  });

  const container = document.getElementById('sectorHeatmap');
  if (!container) return;

  const sectors = Object.entries(bySector).map(function(entry) {
    return { name: entry[0], avg: entry[1].total / entry[1].count, count: entry[1].count };
  }).sort(function(a, b) { return Math.abs(b.avg) - Math.abs(a.avg); });

  if (!sectors.length) {
    container.innerHTML = '<div class="heatmap-placeholder">Aucune donnée sectorielle</div>';
    return;
  }

  container.innerHTML = sectors.map(function(s) {
    const cls = s.avg > 0 ? 'heatmap-up' : s.avg < 0 ? 'heatmap-down' : 'heatmap-neutral';
    const color = s.avg > 0 ? 'var(--green)' : s.avg < 0 ? 'var(--red)' : 'var(--dim)';
    return '<div class="heatmap-cell ' + cls + '" onclick="nav(\'titres\')" style="cursor:pointer">' +
      '<div class="hm-name">' + s.name + '</div>' +
      '<div class="hm-val" style="color:' + color + '">' + (s.avg > 0 ? '+' : '') + s.avg.toFixed(2) + '%</div>' +
      '<div class="hm-count">' + s.count + ' titre' + (s.count > 1 ? 's' : '') + '</div>' +
    '</div>';
  }).join('');
}

function renderNewsFeed() {
  const container = document.getElementById('newsFeed');
  if (!container) return;

  const recent = (allAnalyses || []).slice(0, 5);

  if (!recent.length) {
    container.innerHTML = '<div class="feed-placeholder">Aucune analyse disponible</div>';
    return;
  }

  container.innerHTML = recent.map(function(a) {
    const badgeClass = (a.recommandation || '').toLowerCase();
    const badgeText = a.recommandation || 'NEWS';
    const ticker = a.ticker || '—';
    return '<div class="feed-item" onclick="openFiche(\'' + ticker + '\')" style="cursor:pointer">' +
      '<span class="feed-badge ' + badgeClass + '">' + badgeText + '</span>' +
      '<div class="feed-title">' + (a.titre || 'Analyse ' + ticker) + '</div>' +
      '<div class="feed-meta">' + ticker + ' • ' + fmtDate(a.date_analyse) + ' • Objectif: ' + (a.objectif || '—') + ' FCFA</div>' +
    '</div>';
  }).join('');
}

let _moversTab = 'gainers';

function setMoversTab(tab, btn) {
  document.querySelectorAll('.tm-tab').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  _moversTab = tab;
  renderTopMovers();
}

// ═══════════════════════════════════════════════════════
// TOP MOVERS — AVEC BARRES + ONGLETS CLIQUABLES + CLIQUE SUR LIGNE
// ═══════════════════════════════════════════════════════

function renderTopMovers() {
  const container = document.getElementById('topMovers');
  if (!container) return;

  // AJOUT : onglets en haut
  var tabsHtml = '<div class="tm-tabs">' +
    '<button class="tm-tab ' + (_moversTab === 'gainers' ? 'active' : '') + '" onclick="setMoversTab(\'gainers\',this)">▲ Hausses</button>' +
    '<button class="tm-tab ' + (_moversTab === 'losers' ? 'active' : '') + '" onclick="setMoversTab(\'losers\',this)">▼ Baisses</button>' +
    '<button class="tm-tab ' + (_moversTab === 'volume' ? 'active' : '') + '" onclick="setMoversTab(\'volume\',this)">⇅ Volumes</button>' +
  '</div>';

  if (!Array.isArray(allCours) || allCours.length === 0) {
    container.innerHTML = tabsHtml + '<div class="feed-placeholder">Aucune donnée</div>';
    return;
  }

  const byTicker = {};
  allCours.forEach(function(c) { if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const values = Object.values(byTicker);

  let sorted = [];

  if (_moversTab === 'gainers') {
    sorted = values.filter(function(c) { return parseFloat(c.variation) > 0; })
      .sort(function(a, b) { return parseFloat(b.variation) - parseFloat(a.variation); }).slice(0, 8);
  } else if (_moversTab === 'losers') {
    sorted = values.filter(function(c) { return parseFloat(c.variation) < 0; })
      .sort(function(a, b) { return parseFloat(a.variation) - parseFloat(b.variation); }).slice(0, 8);
  } else {
    sorted = values.sort(function(a, b) { return (b.volume || 0) - (a.volume || 0); }).slice(0, 8);
  }

  if (!sorted.length) {
    container.innerHTML = tabsHtml + '<div class="feed-placeholder">Aucune donnée</div>';
    return;
  }

  const maxVal = _moversTab === 'volume'
    ? Math.max.apply(null, sorted.map(function(c) { return c.volume || 0; }))
    : Math.max.apply(null, sorted.map(function(c) { return Math.abs(parseFloat(c.variation) || 0); }));

  var rowsHtml = sorted.map(function(c) {
    const v = parseFloat(c.variation) || 0;
    const vol = _moversTab === 'volume';
    const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';

    const barPct = vol
      ? ((c.volume || 0) / maxVal * 100).toFixed(1)
      : (Math.abs(v) / maxVal * 100).toFixed(1);

    const rightVal = vol ? fmt(c.volume) : (Math.abs(v).toFixed(2) + '%');
    const sign = v > 0 ? '+' : '';

    // CLIQUABLE : onclick="openFiche('TICKER')"
    return '<div class="mover-row ' + cls + '" onclick="openFiche(\'' + c.ticker + '\')" style="cursor:pointer" title="Cliquez pour voir ' + c.ticker + '">' +
      '<div class="mover-info">' +
        '<div class="mover-ticker">' + c.ticker + '</div>' +
        '<div class="mover-price">' + fmt(c.cours) + ' FCFA</div>' +
      '</div>' +
      '<div class="mover-bar-wrap">' +
        '<div class="mover-bar-bg">' +
          '<div class="mover-bar-fill ' + cls + '" style="width:' + barPct + '%"></div>' +
        '</div>' +
      '</div>' +
      '<div class="mover-var">' + sign + rightVal + '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = tabsHtml + rowsHtml;
}

function renderPubFeed() {
  const container = document.getElementById('pubFeed');
  if (!container) return;

  const upcoming = (allFinancials || [])
    .filter(function(f) { return f.periode === 'annuel' || f.periode === 's1'; })
    .sort(function(a, b) { return (b.annee || 0) - (a.annee || 0); })
    .slice(0, 5);

  if (!upcoming.length) {
    container.innerHTML = '<div class="feed-placeholder">Aucune publication prévue</div>';
    return;
  }

  container.innerHTML = upcoming.map(function(p) {
    const ticker = p.ticker || '—';
    const year = p.annee || new Date().getFullYear();
    const isPublished = p.resultat_net != null;
    const month = isPublished ? '03' : '06';

    return '<div class="pub-item" onclick="openFiche(\'' + ticker + '\')" style="cursor:pointer">' +
      '<div class="pub-date"><div class="pub-day">15</div><div class="pub-month">' + month + '</div></div>' +
      '<div class="pub-info">' +
        '<div class="pub-ticker">' + ticker + '</div>' +
        '<div class="pub-title">' + p.periode + ' ' + year + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderAlertFeed() {
  const container = document.getElementById('alertFeed');
  if (!container) return;

  const alerts = JSON.parse(localStorage.getItem('tc_alerts') || '[]');
  const active = alerts.filter(function(a) { return !a.triggered; }).slice(0, 5);

  if (!active.length) {
    container.innerHTML = '<div class="feed-placeholder">Aucune alerte active</div>';
    return;
  }

  const byTicker = {};
  allCours.forEach(function(c) { if (c && c.ticker) byTicker[c.ticker] = c; });

  container.innerHTML = active.map(function(a) {
    const c = byTicker[a.ticker];
    const current = c && c.cours ? c.cours : 0;
    const triggered = a.condition === 'above' ? current >= a.price : current <= a.price;

    return '<div class="alert-row ' + (triggered ? 'triggered' : '') + '" onclick="openFiche(\'' + a.ticker + '\')" style="cursor:pointer">' +
      '<div class="alert-ticker">' + a.ticker + '</div>' +
      '<div class="alert-cond">' + (a.condition === 'above' ? '>' : '<') + ' ' + a.price + ' FCFA</div>' +
      '<div class="alert-current">' + fmt(current) + '</div>' +
    '</div>';
  }).join('');
}

function renderWatchFeed() {
  const container = document.getElementById('watchFeed');
  if (!container) return;

  const watchlist = JSON.parse(localStorage.getItem('tc_watchlist') || '[]');
  const positions = JSON.parse(localStorage.getItem('tc_portfolio') || '[]');
  const tickers = Array.from(new Set(watchlist.concat(positions.map(function(p) { return p.ticker; }))));

  if (!tickers.length) {
    container.innerHTML = '<div class="feed-placeholder">Ajoutez des titres à votre watchlist</div>';
    return;
  }

  const byTicker = {};
  allCours.forEach(function(c) { if (c && c.ticker) byTicker[c.ticker] = c; });

  container.innerHTML = tickers.map(function(t) {
    const c = byTicker[t];
    if (!c) return '';
    const v = parseFloat(c.variation) || 0;
    const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
    const ent = entMap[t];
    return '<div class="watch-row ' + cls + '" onclick="openFiche(\'' + t + '\')" style="cursor:pointer">' +
      '<div class="watch-ticker">' + t + '</div>' +
      '<div class="watch-name">' + (ent && ent.nom ? ent.nom : '') + '</div>' +
      '<div class="watch-price">' + fmt(c.cours) + '</div>' +
      '<div class="watch-var">' + (v > 0 ? '+' : '') + v.toFixed(2) + '%</div>' +
    '</div>';
  }).join('');
}

function renderCoursTable() {
  const byTicker = {};
  allCours.forEach(function(c) { if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  const rows = Object.values(byTicker).sort(function(a, b) { return (a && a.ticker || '').localeCompare(b && b.ticker || ''); });

  const countEl = document.getElementById('coursCount');
  if (countEl) countEl.textContent = rows.length + ' titre' + (rows.length > 1 ? 's' : '');

  const tbody = document.getElementById('coursTable');
  if (!tbody) return;

  if (!rows.length) {
    const isConnected = allCours.length === 0 && allEntreprises.length === 0;
    const msg = isConnected
      ? 'Connexion Supabase OK mais aucune donnee dans la table cours_latest.'
      : 'Aucune donnee de cours disponible.';
    tbody.innerHTML = emptyState(msg);
    return;
  }

  tbody.innerHTML = rows.map(function(c) { return tickerRow(c, { showCapital: true }); }).join('');
}
