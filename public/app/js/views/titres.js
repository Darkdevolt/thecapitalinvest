// ═══════════════════════════════════════════════════════════════════
// VIEW — Titres BRVM (NOUVEAU DESIGN)
// Vue Cartes avec silhouettes de pays + Tableau + Comparaison
// ═══════════════════════════════════════════════════════════════════

let _titreFilter = 'all';
let _titrePaysFilter = 'all';
let _titreView = 'cards'; // 'cards' ou 'table'
let _selectedForCompare = [];

// Silhouettes SVG stylisées des pays UEMOA
const PAYS_SHAPES = {
  'CI': '<svg viewBox="0 0 60 80" class="country-shape"><path d="M15,5 L45,5 L50,25 L55,40 L50,60 L45,75 L15,75 L10,60 L5,40 L10,25 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  'SN': '<svg viewBox="0 0 70 60" class="country-shape"><path d="M10,15 L35,5 L60,15 L65,35 L55,55 L35,50 L15,55 L5,35 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  'BF': '<svg viewBox="0 0 60 70" class="country-shape"><path d="M20,5 L40,5 L50,20 L55,40 L50,60 L40,65 L20,65 L10,60 L5,40 L10,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  'BJ': '<svg viewBox="0 0 50 80" class="country-shape"><path d="M15,5 L35,5 L40,30 L45,50 L40,75 L15,75 L10,50 L5,30 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  'TG': '<svg viewBox="0 0 40 80" class="country-shape"><path d="M10,5 L30,5 L35,25 L35,55 L30,75 L10,75 L5,55 L5,25 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  'ML': '<svg viewBox="0 0 80 60" class="country-shape"><path d="M10,10 L70,10 L75,30 L70,50 L10,50 L5,30 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  'NE': '<svg viewBox="0 0 70 60" class="country-shape"><path d="M15,5 L55,5 L65,20 L65,40 L55,55 L15,55 L5,40 L5,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  'GW': '<svg viewBox="0 0 50 40" class="country-shape"><path d="M10,10 L40,10 L45,20 L40,30 L10,30 L5,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
};

const PAYS_NAMES = {
  'CI': 'Côte d'Ivoire',
  'SN': 'Sénégal',
  'BF': 'Burkina Faso',
  'BJ': 'Bénin',
  'TG': 'Togo',
  'ML': 'Mali',
  'NE': 'Niger',
  'GW': 'Guinée-Bissau'
};

const PAYS_COLORS = {
  'CI': '#FF8200', // Orange
  'SN': '#00853F', // Vert
  'BF': '#EF2B2D', // Rouge
  'BJ': '#FCD116', // Jaune
  'TG': '#006A4E', // Vert foncé
  'ML': '#14B53A', // Vert
  'NE': '#E05206', // Orange
  'GW': '#FFD700'  // Or
};

// ═══════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════════════════════
function renderTitres() {
  const byTicker = {};
  allCours.forEach(c => { if (c?.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  window._titresRows = Object.values(byTicker);

  // Ajouter les métadonnées (pays, secteur, etc.)
  window._titresRows.forEach(row => {
    const ent = entMap[row.ticker];
    row._pays = (ent && ent.pays) || 'CI';
    row._secteur = getSector(row.ticker);
    row._nom = (ent && ent.nom) || row.ticker;

    // Calculer indicateurs
    row._volumeAnormal = isVolumeAnormal(row.ticker, row.volume);
    row._tendanceHaussiere = isTendanceHaussiere(row.ticker);
    row._proche52Haut = isProche52Haut(row.ticker, row.cours);
    row._proche52Bas = isProche52Bas(row.ticker, row.cours);
  });

  renderTitresHeader();
  filterTitres();
}

// ═══════════════════════════════════════════════════════
// HEADER AVEC FILTRES PAYS (silhouettes)
// ═══════════════════════════════════════════════════════
function renderTitresHeader() {
  const container = document.getElementById('view-titres');
  if (!container) return;

  // Vérifier si le header existe déjà
  let header = container.querySelector('.titres-header');
  if (header) return; // Déjà renderé

  // Créer le header avec silhouettes de pays
  const paysFilterHtml = Object.keys(PAYS_SHAPES).map(code => {
    return '<button class="pays-filter-btn ' + (_titrePaysFilter === code ? 'active' : '') + '" ' +
      'onclick="setPaysFilter('' + code + '', this)" ' +
      'title="' + PAYS_NAMES[code] + '">' +
      '<span class="pays-shape">' + PAYS_SHAPES[code] + '</span>' +
      '<span class="pays-code">' + code + '</span>' +
    '</button>';
  }).join('');

  const headerHtml = '<div class="titres-header">' +
    '<div class="titres-view-toggle">' +
      '<button class="view-btn ' + (_titreView === 'cards' ? 'active' : '') + '" onclick="setTitreView('cards', this)">◫ Cartes</button>' +
      '<button class="view-btn ' + (_titreView === 'table' ? 'active' : '') + '" onclick="setTitreView('table', this)">☰ Tableau</button>' +
    '</div>' +
    '<div class="titres-search-wrap">' +
      '<input class="titres-search" id="searchTitres" placeholder="🔍 Rechercher un ticker, une société..." oninput="filterTitres()">' +
    '</div>' +
    '<div class="titres-pays-filter">' +
      '<button class="pays-filter-btn ' + (_titrePaysFilter === 'all' ? 'active' : '') + '" onclick="setPaysFilter('all', this)" title="Tous les pays">' +
        '<span class="pays-shape-all">◫</span>' +
        '<span class="pays-code">ALL</span>' +
      '</button>' +
      paysFilterHtml +
    '</div>' +
    '<div class="titres-sector-filter">' +
      '<button class="sector-filter-btn ' + (_titreFilter === 'all' ? 'active' : '') + '" onclick="setTitreFilter('all', this)">Tous</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === 'banque' ? 'active' : '') + '" onclick="setTitreFilter('banque', this)">Banque</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === 'agro' ? 'active' : '') + '" onclick="setTitreFilter('agro', this)">Agro</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === 'industrie' ? 'active' : '') + '" onclick="setTitreFilter('industrie', this)">Industrie</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === 'telecom' ? 'active' : '') + '" onclick="setTitreFilter('telecom', this)">Telecom</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === 'distribution' ? 'active' : '') + '" onclick="setTitreFilter('distribution', this)">Distribution</button>' +
    '</div>' +
    '<div class="titres-compare-bar" id="compareBar" style="display:none">' +
      '<span id="compareCount">0 sélectionné</span>' +
      '<button onclick="compareSelected()">Comparer</button>' +
      '<button onclick="clearSelection()">✕</button>' +
    '</div>' +
  '</div>';

  // Insérer après le page-header existant
  const pageHeader = container.querySelector('.page-header');
  if (pageHeader) {
    pageHeader.insertAdjacentHTML('afterend', headerHtml);
  }
}

// ═══════════════════════════════════════════════════════
// FILTRES
// ═══════════════════════════════════════════════════════
function setTitreView(view, btn) {
  _titreView = view;
  document.querySelectorAll('.titres-view-toggle .view-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterTitres();
}

function setPaysFilter(pays, btn) {
  _titrePaysFilter = pays;
  document.querySelectorAll('.pays-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterTitres();
}

function setTitreFilter(f, btn) {
  _titreFilter = f;
  document.querySelectorAll('.sector-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterTitres();
}

function filterTitres() {
  const q = (document.getElementById('searchTitres')?.value || '').toLowerCase();
  let rows = window._titresRows || [];

  // Filtre pays
  if (_titrePaysFilter !== 'all') {
    rows = rows.filter(r => r._pays === _titrePaysFilter);
  }

  // Filtre secteur
  if (_titreFilter !== 'all') {
    rows = rows.filter(r => r._secteur.toLowerCase().includes(_titreFilter.toLowerCase()));
  }

  // Recherche texte
  if (q) {
    rows = rows.filter(r => 
      (r.ticker || '').toLowerCase().includes(q) || 
      (r._nom || '').toLowerCase().includes(q)
    );
  }

  const container = document.getElementById('titresResults');
  if (!container) {
    // Créer le conteneur s'il n'existe pas
    const viewTitres = document.getElementById('view-titres');
    if (viewTitres) {
      viewTitres.insertAdjacentHTML('beforeend', '<div id="titresResults"></div>');
    }
  }

  const resultsContainer = document.getElementById('titresResults');
  if (!resultsContainer) return;

  if (!rows.length) {
    resultsContainer.innerHTML = '<div class="titres-empty">Aucun titre trouvé</div>';
    return;
  }

  if (_titreView === 'cards') {
    resultsContainer.innerHTML = renderCardsView(rows);
  } else {
    resultsContainer.innerHTML = renderTableView(rows);
  }
}

// ═══════════════════════════════════════════════════════
// VUE CARTES (avec silhouettes de pays)
// ═══════════════════════════════════════════════════════
function renderCardsView(rows) {
  return '<div class="titres-cards-grid">' +
    rows.map(c => renderTitreCard(c)).join('') +
  '</div>';
}

function renderTitreCard(c) {
  const v = parseFloat(c.variation) || 0;
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
  const sign = v > 0 ? '+' : '';
  const paysColor = PAYS_COLORS[c._pays] || '#B8964E';
  const paysShape = PAYS_SHAPES[c._pays] || '';

  // Indicateurs
  let badges = '';
  if (c._volumeAnormal) badges += '<span class="titre-badge hot" title="Volume anormalement élevé">🔥</span>';
  if (c._tendanceHaussiere) badges += '<span class="titre-badge trend" title="Tendance haussière">📈</span>';
  if (c._proche52Haut) badges += '<span class="titre-badge alert" title="Proche du 52s haut">⚠️</span>';

  // Mini sparkline (si historique disponible)
  const sparklineId = 'spark-' + c.ticker;

  return '<div class="titre-card ' + cls + '" onclick="openFiche('' + c.ticker + '')">' +
    '<div class="titre-card-header">' +
      '<div class="titre-card-pays" style="color:' + paysColor + '">' + paysShape + '</div>' +
      '<div class="titre-card-badges">' + badges + '</div>' +
    '</div>' +
    '<div class="titre-card-body">' +
      '<div class="titre-card-ticker">' + c.ticker + '</div>' +
      '<div class="titre-card-nom">' + c._nom + '</div>' +
      '<div class="titre-card-price-row">' +
        '<span class="titre-card-price">' + fmt(c.cours) + ' FCFA</span>' +
        '<span class="titre-card-var ' + cls + '">' + sign + v.toFixed(2) + '%</span>' +
      '</div>' +
      '<div class="titre-card-sparkline">' +
        '<canvas id="' + sparklineId + '" width="120" height="40"></canvas>' +
      '</div>' +
    '</div>' +
    '<div class="titre-card-footer">' +
      '<span class="titre-card-sector">' + (entMap[c.ticker]?.secteur || 'Autre') + '</span>' +
      '<span class="titre-card-volume">Vol: ' + fmt(c.volume) + '</span>' +
    '</div>' +
    '<div class="titre-card-compare">' +
      '<label class="compare-checkbox">' +
        '<input type="checkbox" onchange="toggleCompare('' + c.ticker + '', this.checked)" ' + 
        (_selectedForCompare.includes(c.ticker) ? 'checked' : '') + '>' +
        '<span>Comparer</span>' +
      '</label>' +
    '</div>' +
  '</div>';
}

// ═══════════════════════════════════════════════════════
// VUE TABLEAU
// ═══════════════════════════════════════════════════════
function renderTableView(rows) {
  return '<div class="titres-table-wrap">' +
    '<table class="tc-table">' +
      '<thead>' +
        '<tr>' +
          '<th>Pays</th>' +
          '<th>Ticker</th>' +
          '<th>Société</th>' +
          '<th class="right">Cours</th>' +
          '<th class="right">Variation</th>' +
          '<th class="right">Volume</th>' +
          '<th class="right">Cap</th>' +
          '<th>Secteur</th>' +
          '<th></th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        rows.map(c => renderTitreTableRow(c)).join('') +
      '</tbody>' +
    '</table>' +
  '</div>';
}

function renderTitreTableRow(c) {
  const v = parseFloat(c.variation) || 0;
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
  const sign = v > 0 ? '+' : '';
  const paysColor = PAYS_COLORS[c._pays] || '#B8964E';

  return '<tr onclick="openFiche('' + c.ticker + '')">' +
    '<td><span class="pays-dot" style="background:' + paysColor + '"></span></td>' +
    '<td class="ticker-cell">' + c.ticker + '</td>' +
    '<td class="company-cell">' + c._nom + '</td>' +
    '<td class="price-cell right">' + fmt(c.cours) + '</td>' +
    '<td class="var-cell right"><span class="pill ' + cls + '">' + sign + v.toFixed(2) + '%</span></td>' +
    '<td class="vol-cell right">' + fmt(c.volume) + '</td>' +
    '<td class="cap-cell right">' + (c.capitalisation ? fmtM(c.capitalisation) : '—') + '</td>' +
    '<td class="sector-cell right"><span class="sector-badge ' + c._secteur + '">' + (entMap[c.ticker]?.secteur || 'Autre') + '</span></td>' +
    '<td><label class="compare-checkbox"><input type="checkbox" onchange="toggleCompare('' + c.ticker + '', this.checked)"></label></td>' +
  '</tr>';
}

// ═══════════════════════════════════════════════════════
// INDICATEURS (calculés depuis les données API)
// ═══════════════════════════════════════════════════════
function isVolumeAnormal(ticker, currentVolume) {
  // Volume anormal = > 2x la moyenne des 20 derniers jours
  const history = (allCoursHistorique || []).filter(h => h.ticker === ticker).slice(-20);
  if (history.length < 5) return false;
  const avg = history.reduce((sum, h) => sum + (h.volume || 0), 0) / history.length;
  return currentVolume > avg * 2;
}

function isTendanceHaussiere(ticker) {
  // Tendance haussière = cours > SMA 20
  const history = (allCoursHistorique || []).filter(h => h.ticker === ticker).slice(-20);
  if (history.length < 20) return false;
  const sma20 = history.reduce((sum, h) => sum + (h.cours_cloture || h.cours || 0), 0) / history.length;
  const last = history[history.length - 1];
  return (last.cours_cloture || last.cours || 0) > sma20;
}

function isProche52Haut(ticker, currentPrice) {
  const history = (allCoursHistorique || []).filter(h => h.ticker === ticker);
  if (history.length < 20) return false;
  const high52 = Math.max(...history.map(h => h.plus_haut || h.cours || 0));
  return currentPrice > high52 * 0.95; // À 5% du 52s haut
}

function isProche52Bas(ticker, currentPrice) {
  const history = (allCoursHistorique || []).filter(h => h.ticker === ticker);
  if (history.length < 20) return false;
  const low52 = Math.min(...history.map(h => h.plus_bas || h.cours || 0));
  return currentPrice < low52 * 1.05; // À 5% du 52s bas
}

// ═══════════════════════════════════════════════════════
// COMPARAISON MULTI-TITRES
// ═══════════════════════════════════════════════════════
function toggleCompare(ticker, checked) {
  if (checked) {
    if (!_selectedForCompare.includes(ticker)) {
      _selectedForCompare.push(ticker);
    }
  } else {
    _selectedForCompare = _selectedForCompare.filter(t => t !== ticker);
  }
  updateCompareBar();
}

function updateCompareBar() {
  const bar = document.getElementById('compareBar');
  const count = document.getElementById('compareCount');
  if (!bar || !count) return;

  if (_selectedForCompare.length > 0) {
    bar.style.display = 'flex';
    count.textContent = _selectedForCompare.length + ' sélectionné' + (_selectedForCompare.length > 1 ? 's' : '');
  } else {
    bar.style.display = 'none';
  }
}

function clearSelection() {
  _selectedForCompare = [];
  document.querySelectorAll('.compare-checkbox input').forEach(cb => cb.checked = false);
  updateCompareBar();
  filterTitres();
}

function compareSelected() {
  if (_selectedForCompare.length < 2) {
    toast('Sélectionnez au moins 2 titres à comparer', 'warning');
    return;
  }
  // Stocker la sélection et naviguer vers la page de comparaison
  sessionStorage.setItem('compareTickers', JSON.stringify(_selectedForCompare));
  nav('analyse-technique'); // Ou créer une page dédiée
}
