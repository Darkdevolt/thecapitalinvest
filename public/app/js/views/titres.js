// ═══════════════════════════════════════════════════════════════════
// VIEW — Titres BRVM (NOUVEAU DESIGN)
// Vue Cartes avec silhouettes de pays + Tableau + Comparaison
// ═══════════════════════════════════════════════════════════════════

let _titreFilter = "all";
let _titrePaysFilter = "all";
let _titreView = "cards";
let _selectedForCompare = [];

// Silhouettes SVG stylisees des pays UEMOA
const PAYS_SHAPES = {
  "CI": '<svg viewBox="0 0 60 80" class="country-shape"><path d="M15,5 L45,5 L50,25 L55,40 L50,60 L45,75 L15,75 L10,60 L5,40 L10,25 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  "SN": '<svg viewBox="0 0 70 60" class="country-shape"><path d="M10,15 L35,5 L60,15 L65,35 L55,55 L35,50 L15,55 L5,35 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  "BF": '<svg viewBox="0 0 60 70" class="country-shape"><path d="M20,5 L40,5 L50,20 L55,40 L50,60 L40,65 L20,65 L10,60 L5,40 L10,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  "BJ": '<svg viewBox="0 0 50 80" class="country-shape"><path d="M15,5 L35,5 L40,30 L45,50 L40,75 L15,75 L10,50 L5,30 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  "TG": '<svg viewBox="0 0 40 80" class="country-shape"><path d="M10,5 L30,5 L35,25 L35,55 L30,75 L10,75 L5,55 L5,25 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  "ML": '<svg viewBox="0 0 80 60" class="country-shape"><path d="M10,10 L70,10 L75,30 L70,50 L10,50 L5,30 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  "NE": '<svg viewBox="0 0 70 60" class="country-shape"><path d="M15,5 L55,5 L65,20 L65,40 L55,55 L15,55 L5,40 L5,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  "GW": '<svg viewBox="0 0 50 40" class="country-shape"><path d="M10,10 L40,10 L45,20 L40,30 L10,30 L5,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
};

const PAYS_NAMES = {
  "CI": "Cote d'Ivoire",
  "SN": "Senegal",
  "BF": "Burkina Faso",
  "BJ": "Benin",
  "TG": "Togo",
  "ML": "Mali",
  "NE": "Niger",
  "GW": "Guinee-Bissau"
};

const PAYS_COLORS = {
  "CI": "#FF8200",
  "SN": "#00853F",
  "BF": "#EF2B2D",
  "BJ": "#FCD116",
  "TG": "#006A4E",
  "ML": "#14B53A",
  "NE": "#E05206",
  "GW": "#FFD700"
};

// ═══════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════════════════════
function renderTitres() {
  const byTicker = {};
  allCours.forEach(function(c) { if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c; });
  window._titresRows = Object.values(byTicker);

  // Ajouter les metadonnees
  window._titresRows.forEach(function(row) {
    const ent = entMap[row.ticker];
    row._pays = (ent && ent.pays) || "CI";
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
  const container = document.getElementById("view-titres");
  if (!container) return;

  // Verifier si le header existe deja
  let header = container.querySelector(".titres-header");
  if (header) return;

  // Creer le header avec silhouettes de pays
  var paysFilterHtml = "";
  Object.keys(PAYS_SHAPES).forEach(function(code) {
    paysFilterHtml += '<button class="pays-filter-btn ' + (_titrePaysFilter === code ? "active" : "") + '" ' +
      'onclick="setPaysFilter(\'' + code + '\', this)" ' +
      'title="' + PAYS_NAMES[code] + '">' +
      '<span class="pays-shape">' + PAYS_SHAPES[code] + '</span>' +
      '<span class="pays-code">' + code + '</span>' +
    '</button>';
  });

  var headerHtml = '<div class="titres-header">' +
    '<div class="titres-view-toggle">' +
      '<button class="view-btn ' + (_titreView === "cards" ? "active" : "") + '" onclick="setTitreView(\'cards\', this)">&#9635; Cartes</button>' +
      '<button class="view-btn ' + (_titreView === "table" ? "active" : "") + '" onclick="setTitreView(\'table\', this)">&#9776; Tableau</button>' +
    '</div>' +
    '<div class="titres-search-wrap">' +
      '<input class="titres-search" id="searchTitres" placeholder="Rechercher un ticker, une societe..." oninput="filterTitres()">' +
    '</div>' +
    '<div class="titres-pays-filter">' +
      '<button class="pays-filter-btn ' + (_titrePaysFilter === "all" ? "active" : "") + '" onclick="setPaysFilter(\'all\', this)" title="Tous les pays">' +
        '<span class="pays-shape-all">&#9635;</span>' +
        '<span class="pays-code">ALL</span>' +
      '</button>' +
      paysFilterHtml +
    '</div>' +
    '<div class="titres-sector-filter">' +
      '<button class="sector-filter-btn ' + (_titreFilter === "all" ? "active" : "") + '" onclick="setTitreFilter(\'all\', this)">Tous</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === "banque" ? "active" : "") + '" onclick="setTitreFilter(\'banque\', this)">Banque</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === "agro" ? "active" : "") + '" onclick="setTitreFilter(\'agro\', this)">Agro</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === "industrie" ? "active" : "") + '" onclick="setTitreFilter(\'industrie\', this)">Industrie</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === "telecom" ? "active" : "") + '" onclick="setTitreFilter(\'telecom\', this)">Telecom</button>' +
      '<button class="sector-filter-btn ' + (_titreFilter === "distribution" ? "active" : "") + '" onclick="setTitreFilter(\'distribution\', this)">Distribution</button>' +
    '</div>' +
    '<div class="titres-compare-bar" id="compareBar" style="display:none">' +
      '<span id="compareCount">0 selectionne</span>' +
      '<button onclick="compareSelected()">Comparer</button>' +
      '<button onclick="clearSelection()">&#10005;</button>' +
    '</div>' +
  '</div>';

  // Inserer apres le page-header existant
  var pageHeader = container.querySelector(".page-header");
  if (pageHeader) {
    pageHeader.insertAdjacentHTML("afterend", headerHtml);
  }
}

// ═══════════════════════════════════════════════════════
// FILTRES
// ═══════════════════════════════════════════════════════
function setTitreView(view, btn) {
  _titreView = view;
  document.querySelectorAll(".titres-view-toggle .view-btn").forEach(function(b) { b.classList.remove("active"); });
  if (btn) btn.classList.add("active");
  filterTitres();
}

function setPaysFilter(pays, btn) {
  _titrePaysFilter = pays;
  document.querySelectorAll(".pays-filter-btn").forEach(function(b) { b.classList.remove("active"); });
  if (btn) btn.classList.add("active");
  filterTitres();
}

function setTitreFilter(f, btn) {
  _titreFilter = f;
  document.querySelectorAll(".sector-filter-btn").forEach(function(b) { b.classList.remove("active"); });
  if (btn) btn.classList.add("active");
  filterTitres();
}

function filterTitres() {
  var q = (document.getElementById("searchTitres") && document.getElementById("searchTitres").value || "").toLowerCase();
  var rows = window._titresRows || [];

  // Filtre pays
  if (_titrePaysFilter !== "all") {
    rows = rows.filter(function(r) { return r._pays === _titrePaysFilter; });
  }

  // Filtre secteur
  if (_titreFilter !== "all") {
    rows = rows.filter(function(r) { return r._secteur.toLowerCase().indexOf(_titreFilter.toLowerCase()) !== -1; });
  }

  // Recherche texte
  if (q) {
    rows = rows.filter(function(r) { 
      return (r.ticker || "").toLowerCase().indexOf(q) !== -1 || 
        (r._nom || "").toLowerCase().indexOf(q) !== -1;
    });
  }

  var container = document.getElementById("titresResults");
  if (!container) {
    var viewTitres = document.getElementById("view-titres");
    if (viewTitres) {
      viewTitres.insertAdjacentHTML("beforeend", '<div id="titresResults"></div>');
    }
  }

  var resultsContainer = document.getElementById("titresResults");
  if (!resultsContainer) return;

  if (!rows.length) {
    resultsContainer.innerHTML = '<div class="titres-empty">Aucun titre trouve</div>';
    return;
  }

  if (_titreView === "cards") {
    resultsContainer.innerHTML = renderCardsView(rows);
  } else {
    resultsContainer.innerHTML = renderTableView(rows);
  }
}

// ═══════════════════════════════════════════════════════
// VUE CARTES
// ═══════════════════════════════════════════════════════
function renderCardsView(rows) {
  return '<div class="titres-cards-grid">' +
    rows.map(function(c) { return renderTitreCard(c); }).join("") +
  '</div>';
}

function renderTitreCard(c) {
  var v = parseFloat(c.variation) || 0;
  var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
  var sign = v > 0 ? "+" : "";
  var paysColor = PAYS_COLORS[c._pays] || "#B8964E";
  var paysShape = PAYS_SHAPES[c._pays] || "";

  // Indicateurs
  var badges = "";
  if (c._volumeAnormal) badges += '<span class="titre-badge hot" title="Volume anormalement eleve">&#128293;</span>';
  if (c._tendanceHaussiere) badges += '<span class="titre-badge trend" title="Tendance haussiere">&#128200;</span>';
  if (c._proche52Haut) badges += '<span class="titre-badge alert" title="Proche du 52s haut">&#9888;</span>';

  var sparklineId = "spark-" + c.ticker;

  return '<div class="titre-card ' + cls + '" onclick="openFiche(\'' + c.ticker + '\')">' +
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
      '<span class="titre-card-sector">' + (entMap[c.ticker] && entMap[c.ticker].secteur || "Autre") + '</span>' +
      '<span class="titre-card-volume">Vol: ' + fmt(c.volume) + '</span>' +
    '</div>' +
    '<div class="titre-card-compare">' +
      '<label class="compare-checkbox">' +
        '<input type="checkbox" onchange="toggleCompare(\'' + c.ticker + '\', this.checked)" ' + 
        (_selectedForCompare.indexOf(c.ticker) !== -1 ? "checked" : "") + '>' +
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
          '<th>Societe</th>' +
          '<th class="right">Cours</th>' +
          '<th class="right">Variation</th>' +
          '<th class="right">Volume</th>' +
          '<th class="right">Cap</th>' +
          '<th>Secteur</th>' +
          '<th></th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        rows.map(function(c) { return renderTitreTableRow(c); }).join("") +
      '</tbody>' +
    '</table>' +
  '</div>';
}

function renderTitreTableRow(c) {
  var v = parseFloat(c.variation) || 0;
  var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
  var sign = v > 0 ? "+" : "";
  var paysColor = PAYS_COLORS[c._pays] || "#B8964E";

  return '<tr onclick="openFiche(\'' + c.ticker + '\')">' +
    '<td><span class="pays-dot" style="background:' + paysColor + '"></span></td>' +
    '<td class="ticker-cell">' + c.ticker + '</td>' +
    '<td class="company-cell">' + c._nom + '</td>' +
    '<td class="price-cell right">' + fmt(c.cours) + '</td>' +
    '<td class="var-cell right"><span class="pill ' + cls + '">' + sign + v.toFixed(2) + '%</span></td>' +
    '<td class="vol-cell right">' + fmt(c.volume) + '</td>' +
    '<td class="cap-cell right">' + (c.capitalisation ? fmtM(c.capitalisation) : "&#8212;") + '</td>' +
    '<td class="sector-cell right"><span class="sector-badge ' + c._secteur + '">' + (entMap[c.ticker] && entMap[c.ticker].secteur || "Autre") + '</span></td>' +
    '<td><label class="compare-checkbox"><input type="checkbox" onchange="toggleCompare(\'' + c.ticker + '\', this.checked)"></label></td>' +
  '</tr>';
}

// ═══════════════════════════════════════════════════════
// INDICATEURS (calculs depuis les donnees API)
// ═══════════════════════════════════════════════════════
function isVolumeAnormal(ticker, currentVolume) {
  var history = (allCoursHistorique || []).filter(function(h) { return h.ticker === ticker; }).slice(-20);
  if (history.length < 5) return false;
  var avg = history.reduce(function(sum, h) { return sum + (h.volume || 0); }, 0) / history.length;
  return currentVolume > avg * 2;
}

function isTendanceHaussiere(ticker) {
  var history = (allCoursHistorique || []).filter(function(h) { return h.ticker === ticker; }).slice(-20);
  if (history.length < 20) return false;
  var sma20 = history.reduce(function(sum, h) { return sum + (h.cours_cloture || h.cours || 0); }, 0) / history.length;
  var last = history[history.length - 1];
  return (last.cours_cloture || last.cours || 0) > sma20;
}

function isProche52Haut(ticker, currentPrice) {
  var history = (allCoursHistorique || []).filter(function(h) { return h.ticker === ticker; });
  if (history.length < 20) return false;
  var high52 = Math.max.apply(null, history.map(function(h) { return h.plus_haut || h.cours || 0; }));
  return currentPrice > high52 * 0.95;
}

function isProche52Bas(ticker, currentPrice) {
  var history = (allCoursHistorique || []).filter(function(h) { return h.ticker === ticker; });
  if (history.length < 20) return false;
  var low52 = Math.min.apply(null, history.map(function(h) { return h.plus_bas || h.cours || 0; }));
  return currentPrice < low52 * 1.05;
}

// ═══════════════════════════════════════════════════════
// COMPARAISON MULTI-TITRES
// ═══════════════════════════════════════════════════════
function toggleCompare(ticker, checked) {
  if (checked) {
    if (_selectedForCompare.indexOf(ticker) === -1) {
      _selectedForCompare.push(ticker);
    }
  } else {
    _selectedForCompare = _selectedForCompare.filter(function(t) { return t !== ticker; });
  }
  updateCompareBar();
}

function updateCompareBar() {
  var bar = document.getElementById("compareBar");
  var count = document.getElementById("compareCount");
  if (!bar || !count) return;

  if (_selectedForCompare.length > 0) {
    bar.style.display = "flex";
    count.textContent = _selectedForCompare.length + " selectionne" + (_selectedForCompare.length > 1 ? "s" : "");
  } else {
    bar.style.display = "none";
  }
}

function clearSelection() {
  _selectedForCompare = [];
  document.querySelectorAll(".compare-checkbox input").forEach(function(cb) { cb.checked = false; });
  updateCompareBar();
  filterTitres();
}

function compareSelected() {
  if (_selectedForCompare.length < 2) {
    toast("Selectionnez au moins 2 titres a comparer", "warning");
    return;
  }
  sessionStorage.setItem("compareTickers", JSON.stringify(_selectedForCompare));
  nav("analyse-technique");
}
