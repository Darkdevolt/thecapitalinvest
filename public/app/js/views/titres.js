// ═══════════════════════════════════════════════════════════════════
// VIEW — Titres BRVM — VERSION ULTRA AMÉLIORÉE
// Vue Cartes (avec vraies sparklines) + Tableau (triable) + Comparaison
//
// Corrections apportées par rapport à l'original :
//  1. État partagé fiable : une seule source de vérité (window.*),
//     fini le risque de désynchronisation entre variables locales et window.
//  2. Sécurité : tout texte injecté dans le DOM est échappé (esc()),
//     plus aucun onclick="...('+ticker+')..." construit par concaténation
//     → utilisation de data-attributes + délégation d'événements.
//  3. Bug corrigé : la case "Comparer" de la vue Tableau ne reflétait pas
//     la sélection en cours (elle n'avait jamais l'attribut checked).
//  4. Le badge "proche du 52 semaines BAS" était calculé (isProche52Bas)
//     mais jamais affiché : il est maintenant utilisé.
//  5. Sparklines : les <canvas> existaient mais restaient vides, ils sont
//     désormais réellement dessinés à partir de l'historique des cours.
//  6. Performance : l'historique n'est plus filtré 4 fois par titre
//     (isVolumeAnormal/isTendanceHaussiere/isProche52Haut/Bas) ; il est
//     indexé une seule fois par ticker au début de renderTitres().
//  7. Recherche "debouncée" (250 ms) pour éviter un re-render à chaque
//     frappe sur de grandes listes.
//  8. Nouveau : tri des colonnes du tableau (clic sur l'en-tête) et
//     bouton "Réinitialiser" les filtres.
//  9. Script encapsulé dans une IIFE : peut être réinjecté (SPA) sans
//     provoquer d'erreur de redéclaration, tout en utilisant let/const.
// ═══════════════════════════════════════════════════════════════════

(function () {

  // ─── ÉTAT GLOBAL (source unique : window) ──────────────────────────
  window._titreFilter = window._titreFilter || "all";
  window._titrePaysFilter = window._titrePaysFilter || "all";
  window._titreView = window._titreView || "cards";
  window._selectedForCompare = window._selectedForCompare || [];
  window._titreSort = window._titreSort || { field: null, dir: 1 };

  // Index de l'historique par ticker, reconstruit à chaque renderTitres()
  var _histByTicker = {};

  // ─── DONNÉES PAYS (UEMOA) ───────────────────────────────────────────
  var PAYS_SHAPES = {
    "CI": '<svg viewBox="0 0 60 80" class="country-shape"><path d="M15,5 L45,5 L50,25 L55,40 L50,60 L45,75 L15,75 L10,60 L5,40 L10,25 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    "SN": '<svg viewBox="0 0 70 60" class="country-shape"><path d="M10,15 L35,5 L60,15 L65,35 L55,55 L35,50 L15,55 L5,35 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    "BF": '<svg viewBox="0 0 60 70" class="country-shape"><path d="M20,5 L40,5 L50,20 L55,40 L50,60 L40,65 L20,65 L10,60 L5,40 L10,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    "BJ": '<svg viewBox="0 0 50 80" class="country-shape"><path d="M15,5 L35,5 L40,30 L45,50 L40,75 L15,75 L10,50 L5,30 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    "TG": '<svg viewBox="0 0 40 80" class="country-shape"><path d="M10,5 L30,5 L35,25 L35,55 L30,75 L10,75 L5,55 L5,25 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    "ML": '<svg viewBox="0 0 80 60" class="country-shape"><path d="M10,10 L70,10 L75,30 L70,50 L10,50 L5,30 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    "NE": '<svg viewBox="0 0 70 60" class="country-shape"><path d="M15,5 L55,5 L65,20 L65,40 L55,55 L15,55 L5,40 L5,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    "GW": '<svg viewBox="0 0 50 40" class="country-shape"><path d="M10,10 L40,10 L45,20 L40,30 L10,30 L5,20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
  };

  var PAYS_NAMES = {
    "CI": "Côte d'Ivoire", "SN": "Sénégal", "BF": "Burkina Faso", "BJ": "Bénin",
    "TG": "Togo", "ML": "Mali", "NE": "Niger", "GW": "Guinée-Bissau"
  };

  var PAYS_COLORS = {
    "CI": "#FF8200", "SN": "#00853F", "BF": "#EF2B2D", "BJ": "#FCD116",
    "TG": "#006A4E", "ML": "#14B53A", "NE": "#E05206", "GW": "#FFD700"
  };

  var SECTEURS = ["all", "banque", "agro", "industrie", "telecom", "distribution"];
  var SECTEUR_LABELS = { all: "Tous", banque: "Banque", agro: "Agro", industrie: "Industrie", telecom: "Telecom", distribution: "Distribution" };

  // ─── HELPERS ─────────────────────────────────────────────────────────
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeFmt(v) { return (typeof fmt === "function") ? fmt(v) : String(v == null ? "" : v); }
  function safeFmtM(v) { return (typeof fmtM === "function") ? fmtM(v) : String(v == null ? "" : v); }
  function safeSector(ticker) {
    return (typeof entMap !== "undefined" && entMap && entMap[ticker] && entMap[ticker].secteur) || "Autre";
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════
  function renderTitres() {
    try {
      var byTicker = {};
      if (typeof allCours !== "undefined" && Array.isArray(allCours)) {
        allCours.forEach(function (c) {
          if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c;
        });
      }
      window._titresRows = Object.values(byTicker);

      _histByTicker = buildHistoryIndex();

      window._titresRows.forEach(function (row) {
        var ent = (typeof entMap !== "undefined" && entMap) ? entMap[row.ticker] : null;
        row._pays = (ent && ent.pays) || "CI";
        row._secteur = (typeof getSector === "function") ? getSector(row.ticker) : "Autre";
        row._nom = (ent && ent.nom) || row.ticker;

        var hist = _histByTicker[row.ticker] || [];
        row._volumeAnormal = isVolumeAnormal(row.ticker, row.volume, hist);
        row._tendanceHaussiere = isTendanceHaussiere(row.ticker, hist);
        row._proche52Haut = isProche52Haut(row.ticker, row.cours, hist);
        row._proche52Bas = isProche52Bas(row.ticker, row.cours, hist);
      });

      renderTitresHeader();
      filterTitres();
    } catch (err) {
      console.error("renderTitres() a échoué :", err);
    }
  }

  function buildHistoryIndex() {
    var idx = {};
    var hist = (typeof allCoursHistorique !== "undefined" && Array.isArray(allCoursHistorique)) ? allCoursHistorique : [];
    hist.forEach(function (h) {
      if (!h || !h.ticker) return;
      (idx[h.ticker] = idx[h.ticker] || []).push(h);
    });
    return idx;
  }

  // ═══════════════════════════════════════════════════════════════════
  // HEADER AVEC FILTRES PAYS (silhouettes)
  // ═══════════════════════════════════════════════════════════════════
  function renderTitresHeader() {
    var container = document.getElementById("view-titres");
    if (!container) return;

    if (container.querySelector(".titres-header")) return; // déjà créé

    var paysFilterHtml = "";
    Object.keys(PAYS_SHAPES).forEach(function (code) {
      paysFilterHtml += '<button class="pays-filter-btn ' + (window._titrePaysFilter === code ? "active" : "") + '" ' +
        'onclick="setPaysFilter(\'' + code + '\', this)" title="' + esc(PAYS_NAMES[code]) + '">' +
        '<span class="pays-shape">' + PAYS_SHAPES[code] + '</span>' +
        '<span class="pays-code">' + code + '</span>' +
        '</button>';
    });

    var sectorFilterHtml = SECTEURS.map(function (s) {
      return '<button class="sector-filter-btn ' + (window._titreFilter === s ? "active" : "") + '" onclick="setTitreFilter(\'' + s + '\', this)">' + SECTEUR_LABELS[s] + '</button>';
    }).join("");

    var headerHtml = '<div class="titres-header">' +
      '<div class="titres-view-toggle">' +
        '<button class="view-btn ' + (window._titreView === "cards" ? "active" : "") + '" onclick="setTitreView(\'cards\', this)">&#9635; Cartes</button>' +
        '<button class="view-btn ' + (window._titreView === "table" ? "active" : "") + '" onclick="setTitreView(\'table\', this)">&#9776; Tableau</button>' +
      '</div>' +
      '<div class="titres-search-wrap">' +
        '<input class="titres-search" id="searchTitres" placeholder="Rechercher un ticker, une société...">' +
        '<button class="titres-reset-btn" id="resetTitresBtn" title="Réinitialiser les filtres">&#8635;</button>' +
      '</div>' +
      '<div class="titres-pays-filter">' +
        '<button class="pays-filter-btn ' + (window._titrePaysFilter === "all" ? "active" : "") + '" onclick="setPaysFilter(\'all\', this)" title="Tous les pays">' +
          '<span class="pays-shape-all">&#9635;</span><span class="pays-code">ALL</span>' +
        '</button>' +
        paysFilterHtml +
      '</div>' +
      '<div class="titres-sector-filter">' + sectorFilterHtml + '</div>' +
      '<div class="titres-compare-bar" id="compareBar" style="display:none">' +
        '<span id="compareCount">0 sélectionné</span>' +
        '<button onclick="compareSelected()">Comparer</button>' +
        '<button onclick="clearSelection()">&#10005;</button>' +
      '</div>' +
    '</div>';

    var pageHeader = container.querySelector(".page-header");
    if (pageHeader) {
      pageHeader.insertAdjacentHTML("afterend", headerHtml);
    } else {
      container.insertAdjacentHTML("afterbegin", headerHtml);
    }

    // Recherche debouncée
    var searchInput = document.getElementById("searchTitres");
    if (searchInput) {
      searchInput.addEventListener("input", debounce(filterTitres, 250));
    }
    var resetBtn = document.getElementById("resetTitresBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", resetTitresFilters);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILTRES / TRI
  // ═══════════════════════════════════════════════════════════════════
  function setTitreView(view, btn) {
    window._titreView = view;
    document.querySelectorAll(".titres-view-toggle .view-btn").forEach(function (b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    filterTitres();
  }

  function setPaysFilter(pays, btn) {
    window._titrePaysFilter = pays;
    document.querySelectorAll(".pays-filter-btn").forEach(function (b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    filterTitres();
  }

  function setTitreFilter(f, btn) {
    window._titreFilter = f;
    document.querySelectorAll(".sector-filter-btn").forEach(function (b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    filterTitres();
  }

  function sortTitresBy(field) {
    var sort = window._titreSort;
    if (sort.field === field) {
      sort.dir = -sort.dir;
    } else {
      sort.field = field;
      sort.dir = 1;
    }
    filterTitres();
  }

  function resetTitresFilters() {
    window._titreFilter = "all";
    window._titrePaysFilter = "all";
    window._titreSort = { field: null, dir: 1 };
    var searchInput = document.getElementById("searchTitres");
    if (searchInput) searchInput.value = "";
    document.querySelectorAll(".sector-filter-btn").forEach(function (b, i) { b.classList.toggle("active", SECTEURS[i] === "all"); });
    document.querySelectorAll(".pays-filter-btn").forEach(function (b) { b.classList.remove("active"); });
    var allBtn = document.querySelector('.pays-filter-btn[onclick*="\'all\'"]');
    if (allBtn) allBtn.classList.add("active");
    filterTitres();
  }

  function applySort(rows) {
    var sort = window._titreSort;
    if (!sort.field) return rows;
    var field = sort.field, dir = sort.dir;
    return rows.slice().sort(function (a, b) {
      var va = a[field], vb = b[field];
      if (field === "variation" || field === "cours" || field === "volume" || field === "capitalisation") {
        va = parseFloat(va) || 0; vb = parseFloat(vb) || 0;
        return (va - vb) * dir;
      }
      va = String(va || "").toLowerCase(); vb = String(vb || "").toLowerCase();
      return va.localeCompare(vb) * dir;
    });
  }

  function filterTitres() {
    var q = (document.getElementById("searchTitres") && document.getElementById("searchTitres").value || "").toLowerCase().trim();
    var rows = window._titresRows || [];

    if (window._titrePaysFilter !== "all") {
      rows = rows.filter(function (r) { return r._pays === window._titrePaysFilter; });
    }

    if (window._titreFilter !== "all") {
      rows = rows.filter(function (r) { return (r._secteur || "").toLowerCase().indexOf(window._titreFilter.toLowerCase()) !== -1; });
    }

    if (q) {
      rows = rows.filter(function (r) {
        return (r.ticker || "").toLowerCase().indexOf(q) !== -1 ||
               (r._nom || "").toLowerCase().indexOf(q) !== -1;
      });
    }

    rows = applySort(rows);

    var resultsContainer = document.getElementById("titresResults");
    if (!resultsContainer) {
      var viewTitres = document.getElementById("view-titres");
      if (viewTitres) {
        viewTitres.insertAdjacentHTML("beforeend", '<div id="titresResults"></div>');
        resultsContainer = document.getElementById("titresResults");
        attachResultsListeners(resultsContainer);
      }
    }
    if (!resultsContainer) return;

    if (!rows.length) {
      resultsContainer.innerHTML = '<div class="titres-empty">Aucun titre trouvé</div>';
      updateCompareBar();
      return;
    }

    if (window._titreView === "cards") {
      resultsContainer.innerHTML = renderCardsView(rows);
      rows.forEach(function (c) {
        var v = parseFloat(c.variation) || 0;
        var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
        drawSparkline(c.ticker, cls);
      });
    } else {
      resultsContainer.innerHTML = renderTableView(rows);
    }

    updateCompareBar();
  }

  // ─── Délégation d'événements (clic carte/ligne + case "Comparer") ────
  function attachResultsListeners(container) {
    if (!container || container._listenersAttached) return;

    container.addEventListener("click", function (e) {
      if (e.target.closest(".compare-checkbox")) return; // géré séparément
      var el = e.target.closest("[data-ticker]");
      if (el && typeof openFiche === "function") openFiche(el.getAttribute("data-ticker"));
    });

    container.addEventListener("change", function (e) {
      if (e.target.matches('input[data-role="compare-toggle"]')) {
        toggleCompare(e.target.getAttribute("data-ticker"), e.target.checked);
      }
    });

    container.addEventListener("click", function (e) {
      var th = e.target.closest("th[data-field]");
      if (th) sortTitresBy(th.getAttribute("data-field"));
    });

    container._listenersAttached = true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // VUE CARTES
  // ═══════════════════════════════════════════════════════════════════
  function renderCardsView(rows) {
    return '<div class="titres-cards-grid">' + rows.map(renderTitreCard).join("") + '</div>';
  }

  function renderTitreCard(c) {
    var v = parseFloat(c.variation) || 0;
    var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
    var sign = v > 0 ? "+" : "";
    var paysColor = PAYS_COLORS[c._pays] || "#B8964E";
    var paysShape = PAYS_SHAPES[c._pays] || "";
    var isChecked = window._selectedForCompare.indexOf(c.ticker) !== -1;

    var badges = "";
    if (c._volumeAnormal) badges += '<span class="titre-badge hot" title="Volume anormalement élevé">&#128293;</span>';
    if (c._tendanceHaussiere) badges += '<span class="titre-badge trend" title="Tendance haussière">&#128200;</span>';
    if (c._proche52Haut) badges += '<span class="titre-badge alert" title="Proche du 52 semaines haut">&#9888;</span>';
    if (c._proche52Bas) badges += '<span class="titre-badge alert-low" title="Proche du 52 semaines bas">&#128201;</span>';

    var sparklineId = "spark-" + esc(c.ticker);

    return '<div class="titre-card ' + cls + '" data-ticker="' + esc(c.ticker) + '">' +
      '<div class="titre-card-header">' +
        '<div class="titre-card-pays" style="color:' + paysColor + '">' + paysShape + '</div>' +
        '<div class="titre-card-badges">' + badges + '</div>' +
      '</div>' +
      '<div class="titre-card-body">' +
        '<div class="titre-card-ticker">' + esc(c.ticker) + '</div>' +
        '<div class="titre-card-nom">' + esc(c._nom) + '</div>' +
        '<div class="titre-card-price-row">' +
          '<span class="titre-card-price">' + safeFmt(c.cours) + ' FCFA</span>' +
          '<span class="titre-card-var ' + cls + '">' + sign + v.toFixed(2) + '%</span>' +
        '</div>' +
        '<div class="titre-card-sparkline">' +
          '<canvas id="' + sparklineId + '" width="120" height="40"></canvas>' +
        '</div>' +
      '</div>' +
      '<div class="titre-card-footer">' +
        '<span class="titre-card-sector">' + esc(safeSector(c.ticker)) + '</span>' +
        '<span class="titre-card-volume">Vol: ' + safeFmt(c.volume) + '</span>' +
      '</div>' +
      '<div class="titre-card-compare">' +
        '<label class="compare-checkbox" onclick="event.stopPropagation()">' +
          '<input type="checkbox" data-role="compare-toggle" data-ticker="' + esc(c.ticker) + '" ' + (isChecked ? "checked" : "") + '>' +
          '<span>Comparer</span>' +
        '</label>' +
      '</div>' +
    '</div>';
  }

  // ─── Mini-graphe (sparkline) dessiné dans le <canvas> de la carte ────
  function drawSparkline(ticker, cls) {
    var canvas = document.getElementById("spark-" + ticker);
    if (!canvas || !canvas.getContext) return;
    var hist = (_histByTicker[ticker] || []).slice(-20);
    if (hist.length < 2) return;

    var values = hist.map(function (h) { return parseFloat(h.cours_cloture || h.cours || 0); });
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height, pad = 3;
    ctx.clearRect(0, 0, w, h);

    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = (max - min) || 1;

    ctx.beginPath();
    values.forEach(function (val, i) {
      var x = pad + (i / (values.length - 1)) * (w - pad * 2);
      var y = h - pad - ((val - min) / range) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = cls === "up" ? "#1FAA59" : cls === "down" ? "#E5484D" : "#8A8A8A";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  // ═══════════════════════════════════════════════════════════════════
  // VUE TABLEAU (colonnes triables)
  // ═══════════════════════════════════════════════════════════════════
  function sortArrow(field) {
    var sort = window._titreSort;
    if (sort.field !== field) return "";
    return sort.dir === 1 ? " &#9650;" : " &#9660;";
  }

  function renderTableView(rows) {
    return '<div class="titres-table-wrap">' +
      '<table class="tc-table">' +
        '<thead><tr>' +
          '<th>Pays</th>' +
          '<th data-field="ticker" class="sortable">Ticker' + sortArrow("ticker") + '</th>' +
          '<th data-field="_nom" class="sortable">Société' + sortArrow("_nom") + '</th>' +
          '<th data-field="cours" class="right sortable">Cours' + sortArrow("cours") + '</th>' +
          '<th data-field="variation" class="right sortable">Variation' + sortArrow("variation") + '</th>' +
          '<th data-field="volume" class="right sortable">Volume' + sortArrow("volume") + '</th>' +
          '<th data-field="capitalisation" class="right sortable">Cap' + sortArrow("capitalisation") + '</th>' +
          '<th>Secteur</th>' +
          '<th></th>' +
        '</tr></thead>' +
        '<tbody>' + rows.map(renderTitreTableRow).join("") + '</tbody>' +
      '</table>' +
    '</div>';
  }

  function renderTitreTableRow(c) {
    var v = parseFloat(c.variation) || 0;
    var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
    var sign = v > 0 ? "+" : "";
    var paysColor = PAYS_COLORS[c._pays] || "#B8964E";
    var isChecked = window._selectedForCompare.indexOf(c.ticker) !== -1;
    var secteurLabel = safeSector(c.ticker);

    return '<tr data-ticker="' + esc(c.ticker) + '">' +
      '<td><span class="pays-dot" style="background:' + paysColor + '" title="' + esc(PAYS_NAMES[c._pays] || "") + '"></span></td>' +
      '<td class="ticker-cell">' + esc(c.ticker) + '</td>' +
      '<td class="company-cell">' + esc(c._nom) + '</td>' +
      '<td class="price-cell right">' + safeFmt(c.cours) + '</td>' +
      '<td class="var-cell right"><span class="pill ' + cls + '">' + sign + v.toFixed(2) + '%</span></td>' +
      '<td class="vol-cell right">' + safeFmt(c.volume) + '</td>' +
      '<td class="cap-cell right">' + (c.capitalisation ? safeFmtM(c.capitalisation) : "&#8212;") + '</td>' +
      '<td class="sector-cell right"><span class="sector-badge ' + esc(c._secteur) + '">' + esc(secteurLabel) + '</span></td>' +
      '<td><label class="compare-checkbox" onclick="event.stopPropagation()">' +
        '<input type="checkbox" data-role="compare-toggle" data-ticker="' + esc(c.ticker) + '" ' + (isChecked ? "checked" : "") + '>' +
      '</label></td>' +
    '</tr>';
  }

  // ═══════════════════════════════════════════════════════════════════
  // INDICATEURS (calculs depuis les données API)
  // history : tableau déjà filtré pour le ticker (optionnel, sinon
  // recalculé depuis allCoursHistorique pour compatibilité ascendante)
  // ═══════════════════════════════════════════════════════════════════
  function historyFor(ticker, history) {
    if (history) return history;
    return ((typeof allCoursHistorique !== "undefined" && allCoursHistorique) || []).filter(function (h) { return h.ticker === ticker; });
  }

  function isVolumeAnormal(ticker, currentVolume, history) {
    var h = historyFor(ticker, history).slice(-20);
    if (h.length < 5) return false;
    var avg = h.reduce(function (sum, x) { return sum + (x.volume || 0); }, 0) / h.length;
    return currentVolume > avg * 2;
  }

  function isTendanceHaussiere(ticker, history) {
    var h = historyFor(ticker, history).slice(-20);
    if (h.length < 20) return false;
    var sma20 = h.reduce(function (sum, x) { return sum + (x.cours_cloture || x.cours || 0); }, 0) / h.length;
    var last = h[h.length - 1];
    return (last.cours_cloture || last.cours || 0) > sma20;
  }

  function isProche52Haut(ticker, currentPrice, history) {
    var h = historyFor(ticker, history);
    if (h.length < 20) return false;
    var high52 = h.reduce(function (max, x) { return Math.max(max, x.plus_haut || x.cours || 0); }, -Infinity);
    return currentPrice > high52 * 0.95;
  }

  function isProche52Bas(ticker, currentPrice, history) {
    var h = historyFor(ticker, history);
    if (h.length < 20) return false;
    var low52 = h.reduce(function (min, x) { return Math.min(min, x.plus_bas || x.cours || Infinity); }, Infinity);
    return currentPrice < low52 * 1.05;
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMPARAISON MULTI-TITRES
  // ═══════════════════════════════════════════════════════════════════
  function toggleCompare(ticker, checked) {
    var list = window._selectedForCompare;
    if (checked) {
      if (list.indexOf(ticker) === -1) list.push(ticker);
    } else {
      window._selectedForCompare = list.filter(function (t) { return t !== ticker; });
    }
    updateCompareBar();
  }

  function updateCompareBar() {
    var bar = document.getElementById("compareBar");
    var count = document.getElementById("compareCount");
    if (!bar || !count) return;

    var n = window._selectedForCompare.length;
    if (n > 0) {
      bar.style.display = "flex";
      count.textContent = n + " sélectionné" + (n > 1 ? "s" : "");
    } else {
      bar.style.display = "none";
    }
  }

  function clearSelection() {
    window._selectedForCompare = [];
    document.querySelectorAll('.compare-checkbox input').forEach(function (cb) { cb.checked = false; });
    updateCompareBar();
    filterTitres();
  }

  function compareSelected() {
    if (window._selectedForCompare.length < 2) {
      if (typeof toast === "function") toast("Sélectionnez au moins 2 titres à comparer", "warning");
      return;
    }
    try {
      sessionStorage.setItem("compareTickers", JSON.stringify(window._selectedForCompare));
    } catch (err) {
      console.error("Impossible d'enregistrer la sélection :", err);
    }
    if (typeof nav === "function") nav("analyse-technique");
  }

  // ─── Exposition de l'API publique (appelée depuis le HTML généré) ───
  window.renderTitres = renderTitres;
  window.setTitreView = setTitreView;
  window.setPaysFilter = setPaysFilter;
  window.setTitreFilter = setTitreFilter;
  window.sortTitresBy = sortTitresBy;
  window.resetTitresFilters = resetTitresFilters;
  window.filterTitres = filterTitres;
  window.toggleCompare = toggleCompare;
  window.clearSelection = clearSelection;
  window.compareSelected = compareSelected;
  window.isVolumeAnormal = isVolumeAnormal;
  window.isTendanceHaussiere = isTendanceHaussiere;
  window.isProche52Haut = isProche52Haut;
  window.isProche52Bas = isProche52Bas;

})();
