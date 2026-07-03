// ═══════════════════════════════════════════════════════════════════
// VIEW — Titres BRVM — VERSION ULTRA PREMIUM & DESIGN NEXT-GEN
// ═══════════════════════════════════════════════════════════════════

(function () {

  // ─── ÉTAT GLOBAL (Source unique) ───────────────────────────────────
  window._titreFilter = window._titreFilter || "all";
  window._titrePaysFilter = window._titrePaysFilter || "all";
  window._titreView = window._titreView || "cards";
  window._selectedForCompare = window._selectedForCompare || [];
  window._titreSort = window._titreSort || { field: null, dir: 1 };

  var _histByTicker = {};

  // ─── CONFIGURATION VISUELLE (UEMOA) ────────────────────────────────
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
  var SECTEUR_LABELS = { all: "Tous Secteurs", banque: "Banques", agro: "Agriculture", industrie: "Industrie", telecom: "Télécoms", distribution: "Distribution" };

  // ─── INJECTION DES STYLES PREMIUM ──────────────────────────────────
  function injectStyles() {
    if (document.getElementById("premium-interface-styles")) return;
    var css = `
      :root {
        --bg-main: #0f141c;
        --bg-card: #161c26;
        --border-color: #242f41;
        --text-muted: #8493a8;
        --text-main: #f1f5f9;
        --bull-color: #10b981;
        --bear-color: #ef4444;
        --accent-color: #3b82f6;
        --font-stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      #view-titres { font-family: var(--font-stack); color: var(--text-main); background: var(--bg-main); padding: 20px; min-height: 100vh; }
      .titres-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; background: var(--bg-card); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); }
      .header-top-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
      .titres-view-toggle { display: inline-flex; background: var(--bg-main); padding: 4px; border-radius: 8px; border: 1px solid var(--border-color); }
      .view-btn { background: transparent; border: none; color: var(--text-muted); padding: 6px 14px; font-size: 13px; font-weight: 500; border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
      .view-btn.active { background: var(--bg-card); color: var(--text-main); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
      .titres-search-wrap { position: relative; display: flex; align-items: center; gap: 8px; flex-grow: 1; max-width: 400px; }
      .titres-search { width: 100%; background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 12px; border-radius: 8px; font-size: 14px; outline: none; transition: border 0.2s; }
      .titres-search:focus { border-color: var(--accent-color); }
      .titres-reset-btn { background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-muted); padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
      .titres-reset-btn:hover { color: var(--text-main); border-color: var(--text-muted); }
      .titres-pays-filter { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .pays-filter-btn { background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-muted); padding: 6px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; transition: all 0.2s; }
      .pays-filter-btn:hover, .pays-filter-btn.active { border-color: var(--accent-color); color: var(--text-main); background: rgba(59, 130, 246, 0.05); }
      .country-shape { width: 16px; height: 16px; transition: transform 0.2s; }
      .pays-filter-btn:hover .country-shape { transform: scale(1.1); }
      .titres-sector-filter { display: flex; flex-wrap: wrap; gap: 6px; border-top: 1px solid var(--border-color); padding-top: 12px; }
      .sector-filter-btn { background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: 5px 12px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s; }
      .sector-filter-btn.active, .sector-filter-btn:hover { background: var(--border-color); color: var(--text-main); }
      .titres-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
      .titre-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; position: relative; transition: transform 0.2s, border-color 0.2s; cursor: pointer; }
      .titre-card:hover { transform: translateY(-2px); border-color: #334155; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); }
      .titre-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .titre-card-badges { display: flex; gap: 4px; }
      .badge-ui { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
      .badge-ui.hot { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
      .badge-ui.trend { background: rgba(16,185,129,0.1); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
      .badge-ui.alert-high { background: rgba(245,158,11,0.1); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
      .badge-ui.alert-low { background: rgba(99,102,241,0.1); color: #818cf8; border: 1px solid rgba(99,102,241,0.2); }
      .titre-card-ticker { font-size: 18px; font-weight: 700; letter-spacing: -0.025em; }
      .titre-card-nom { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 12px; }
      .titre-card-price-row { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
      .titre-card-price { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .titre-card-var { font-size: 13px; font-weight: 600; border-radius: 4px; padding: 2px 6px; }
      .titre-card-var.up { background: rgba(16,185,129,0.15); color: var(--bull-color); }
      .titre-card-var.down { background: rgba(239,68,68,0.15); color: var(--bear-color); }
      .titre-card-var.neutral { background: rgba(148,163,184,0.15); color: var(--text-muted); }
      .titre-card-sparkline { height: 45px; display: flex; align-items: center; justify-content: center; margin: 8px 0; }
      .titre-card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 8px; }
      .titre-card-sector { background: var(--bg-main); padding: 2px 6px; border-radius: 4px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .titre-card-compare { position: absolute; top: 12px; right: 12px; display: none; }
      .titre-card:hover .titre-card-compare { display: block; }
      .titres-table-wrap { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; }
      .tc-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
      .tc-table th { background: rgba(15,20,28,0.6); color: var(--text-muted); font-weight: 600; padding: 12px 16px; border-bottom: 1px solid var(--border-color); cursor: pointer; user-select: none; }
      .tc-table th.sortable:hover { color: var(--text-main); }
      .tc-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
      .tc-table tbody tr:hover { background: rgba(255,255,255,0.02); cursor: pointer; }
      .pill { font-weight: 600; padding: 3px 8px; border-radius: 6px; font-size: 12px; display: inline-block; }
      .pill.up { background: rgba(16,185,129,0.15); color: var(--bull-color); }
      .pill.down { background: rgba(239,68,68,0.15); color: var(--bear-color); }
      .sector-badge { font-size: 11px; color: var(--text-muted); background: var(--bg-main); padding: 3px 8px; border-radius: 12px; border: 1px solid var(--border-color); }
      .pays-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .titres-compare-bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--accent-color); color: #fff; padding: 10px 20px; border-radius: 30px; display: flex; align-items: center; gap: 16px; box-shadow: 0 10px 25px -5px rgba(59,130,246,0.5); z-index: 999; font-size: 14px; font-weight: 600; }
      .titres-compare-bar button { background: #fff; border: none; color: var(--accent-color); padding: 6px 14px; border-radius: 20px; font-weight: 700; cursor: pointer; font-size: 12px; }
      .compare-checkbox input { cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent-color); }
    `;
    var style = document.createElement("style");
    style.id = "premium-interface-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

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
      injectStyles();
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
  // HEADER AVEC FILTRES MODERNISÉS
  // ═══════════════════════════════════════════════════════════════════
  function renderTitresHeader() {
    var container = document.getElementById("view-titres");
    if (!container || container.querySelector(".titres-header")) return;

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
      '<div class="header-top-row">' +
        '<div class="titres-view-toggle">' +
          '<button class="view-btn ' + (window._titreView === "cards" ? "active" : "") + '" onclick="setTitreView(\'cards\', this)">📊 Cartes</button>' +
          '<button class="view-btn ' + (window._titreView === "table" ? "active" : "") + '" onclick="setTitreView(\'table\', this)">📋 Tableau</button>' +
        '</div>' +
        '<div class="titres-search-wrap">' +
          '<input class="titres-search" id="searchTitres" placeholder="Rechercher ticker, entreprise...">' +
          '<button class="titres-reset-btn" id="resetTitresBtn" title="Réinitialiser">🔄</button>' +
        '</div>' +
        '<div class="titres-pays-filter">' +
          '<button class="pays-filter-btn ' + (window._titrePaysFilter === "all" ? "active" : "") + '" onclick="setPaysFilter(\'all\', this)" title="Tous les pays">' +
            '<span class="pays-code">TOUS</span>' +
          '</button>' +
          paysFilterHtml +
        '</div>' +
      '</div>' +
      '<div class="titres-sector-filter">' + sectorFilterHtml + '</div>' +
      '<div class="titres-compare-bar" id="compareBar" style="display:none">' +
        '<span id="compareCount">0 sélectionné</span>' +
        '<button onclick="compareSelected()">Lancer l\'analyse</button>' +
        '<button onclick="clearSelection()" style="background:transparent;color:#fff;margin-left:8px;">✕</button>' +
      '</div>' +
    '</div>';

    var pageHeader = container.querySelector(".page-header");
    if (pageHeader) pageHeader.insertAdjacentHTML("afterend", headerHtml);
    else container.insertAdjacentHTML("afterbegin", headerHtml);

    document.getElementById("searchTitres").addEventListener("input", debounce(filterTitres, 250));
    document.getElementById("resetTitresBtn").addEventListener("click", resetTitresFilters);
  }

  // ═══════════════════════════════════════════════════════════════════
  // GESTION DES FILTRES ET ACCESSEURS
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
    if (sort.field === field) sort.dir = -sort.dir;
    else { sort.field = field; sort.dir = 1; }
    filterTitres();
  }

  function resetTitresFilters() {
    window._titreFilter = "all"; window._titrePaysFilter = "all"; window._titreSort = { field: null, dir: 1 };
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
        return ((parseFloat(va) || 0) - (parseFloat(vb) || 0)) * dir;
      }
      return String(va || "").toLowerCase().localeCompare(String(vb || "").toLowerCase()) * dir;
    });
  }

  function filterTitres() {
    var q = (document.getElementById("searchTitres") && document.getElementById("searchTitres").value || "").toLowerCase().trim();
    var rows = window._titresRows || [];

    if (window._titrePaysFilter !== "all") rows = rows.filter(function (r) { return r._pays === window._titrePaysFilter; });
    if (window._titreFilter !== "all") rows = rows.filter(function (r) { return (r._secteur || "").toLowerCase().indexOf(window._titreFilter.toLowerCase()) !== -1; });
    if (q) {
      rows = rows.filter(function (r) {
        return (r.ticker || "").toLowerCase().indexOf(q) !== -1 || (r._nom || "").toLowerCase().indexOf(q) !== -1;
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
      resultsContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Aucun actif trouvé</div>';
      updateCompareBar();
      return;
    }

    if (window._titreView === "cards") {
      resultsContainer.innerHTML = '<div class="titres-cards-grid">' + rows.map(renderTitreCard).join("") + '</div>';
      rows.forEach(function (c) {
        var v = parseFloat(c.variation) || 0;
        drawSparkline(c.ticker, v > 0 ? "up" : v < 0 ? "down" : "neutral");
      });
    } else {
      resultsContainer.innerHTML = renderTableView(rows);
    }
    updateCompareBar();
  }

  function attachResultsListeners(container) {
    if (!container || container._listenersAttached) return;
    container.addEventListener("click", function (e) {
      if (e.target.closest(".compare-checkbox")) return;
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
  // VUE CARTES DE TRADING
  // ═══════════════════════════════════════════════════════════════════
  function renderTitreCard(c) {
    var v = parseFloat(c.variation) || 0;
    var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
    var sign = v > 0 ? "+" : "";
    var paysColor = PAYS_COLORS[c._pays] || "#3b82f6";
    var isChecked = window._selectedForCompare.indexOf(c.ticker) !== -1;

    var badges = "";
    if (c._volumeAnormal) badges += '<span class="badge-ui hot"><span style="width:5px;height:5px;border-radius:50%;background:#ef4444"></span>Vol 2x</span>';
    if (c._tendanceHaussiere) badges += '<span class="badge-ui trend"><span style="width:5px;height:5px;border-radius:50%;background:#10b981"></span>Haussier</span>';
    if (c._proche52Haut) badges += '<span class="badge-ui alert-high">52W Haut</span>';
    if (c._proche52Bas) badges += '<span class="badge-ui alert-low">52W Bas</span>';

    return '<div class="titre-card" data-ticker="' + esc(c.ticker) + '">' +
      '<div class="titre-card-header">' +
        '<div style="display:flex;align-items:center;gap:6px;color:' + paysColor + '">' +
          (PAYS_SHAPES[c._pays] || '') + '<span style="font-size:11px;font-weight:700;">' + c._pays + '</span>' +
        '</div>' +
        '<div class="titre-card-badges">' + badges + '</div>' +
      '</div>' +
      '<div>' +
        '<div class="titre-card-ticker">' + esc(c.ticker) + '</div>' +
        '<div class="titre-card-nom">' + esc(c._nom) + '</div>' +
        '<div class="titre-card-price-row">' +
          '<span class="titre-card-price">' + safeFmt(c.cours) + ' <span style="font-size:11px;color:var(--text-muted)">XOF</span></span>' +
          '<span class="titre-card-var ' + cls + '">' + sign + v.toFixed(2) + '%</span>' +
        '</div>' +
        '<div class="titre-card-sparkline">' +
          '<canvas id="spark-' + esc(c.ticker) + '" style="width:100%;height:45px;"></canvas>' +
        '</div>' +
      '</div>' +
      '<div class="titre-card-footer">' +
        '<span class="titre-card-sector">' + esc(safeSector(c.ticker)) + '</span>' +
        '<span>Vol: ' + safeFmt(c.volume) + '</span>' +
      '</div>' +
      '<div class="titre-card-compare">' +
        '<label class="compare-checkbox" onclick="event.stopPropagation()">' +
          '<input type="checkbox" data-role="compare-toggle" data-ticker="' + esc(c.ticker) + '" ' + (isChecked ? "checked" : "") + '>' +
        '</label>' +
      '</div>' +
    '</div>';
  }

  // ─── RENDER SPARKLINE (RAZOR SHARP ET ZONE GRADIENT) ─────────────────
  function drawSparkline(ticker, cls) {
    var canvas = document.getElementById("spark-" + ticker);
    if (!canvas) return;
    var hist = (_histByTicker[ticker] || []).slice(-25);
    if (hist.length < 2) return;

    var values = hist.map(function (h) { return parseFloat(h.cours_cloture || h.cours || 0); });
    var ctx = canvas.getContext("2d");
    
    // Support Haute Densité (écrans Retina/4K) sans flou
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 45 * dpr;
    ctx.scale(dpr, dpr);

    var w = rect.width, h = 45, pad = 4;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = (max - min) || 1;

    var points = values.map(function (val, i) {
      return {
        x: pad + (i / (values.length - 1)) * (w - pad * 2),
        y: h - pad - ((val - min) / range) * (h - pad * 2)
      };
    });

    var strokeColor = cls === "up" ? "#10b981" : cls === "down" ? "#ef4444" : "#64748b";
    var fillColor = cls === "up" ? "rgba(16,185,129,0.06)" : cls === "down" ? "rgba(239,68,68,0.06)" : "rgba(100,116,139,0.06)";

    // Tracé de la surface sous la courbe
    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    points.forEach(function (pt) { ctx.lineTo(pt.x, pt.y); });
    ctx.lineTo(points[points.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Tracé de la courbe principale
    ctx.beginPath();
    points.forEach(function (pt, i) { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // ═══════════════════════════════════════════════════════════════════
  // VUE TABLEAU FINANCIER STRUCTURÉ
  // ═══════════════════════════════════════════════════════════════════
  function sortArrow(field) {
    var sort = window._titreSort;
    if (sort.field !== field) return "";
    return sort.dir === 1 ? ' <span style="color:var(--accent-color)">▲</span>' : ' <span style="color:var(--accent-color)">▼</span>';
  }

  function renderTableView(rows) {
    return '<div class="titres-table-wrap">' +
      '<table class="tc-table">' +
        '<thead><tr>' +
          '<th style="width:40px"></th>' +
          '<th data-field="ticker" class="sortable">Symbole' + sortArrow("ticker") + '</th>' +
          '<th data-field="_nom" class="sortable">Société' + sortArrow("_nom") + '</th>' +
          '<th data-field="cours" style="text-align:right" class="sortable">Cours (XOF)' + sortArrow("cours") + '</th>' +
          '<th data-field="variation" style="text-align:right" class="sortable">Chg %' + sortArrow("variation") + '</th>' +
          '<th data-field="volume" style="text-align:right" class="sortable">Volume' + sortArrow("volume") + '</th>' +
          '<th data-field="capitalisation" style="text-align:right" class="sortable">Cap.' + sortArrow("capitalisation") + '</th>' +
          '<th>Secteur</th>' +
          '<th style="width:40px">Comp.</th>' +
        '</tr></thead>' +
        '<tbody>' + rows.map(renderTitreTableRow).join("") + '</tbody>' +
      '</table>' +
    '</div>';
  }

  function renderTitreTableRow(c) {
    var v = parseFloat(c.variation) || 0;
    var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
    var sign = v > 0 ? "+" : "";
    var paysColor = PAYS_COLORS[c._pays] || "#3b82f6";
    var isChecked = window._selectedForCompare.indexOf(c.ticker) !== -1;

    return '<tr data-ticker="' + esc(c.ticker) + '">' +
      '<td><span class="pays-dot" style="background:' + paysColor + '" title="' + esc(PAYS_NAMES[c._pays]) + '"></span></td>' +
      '<td style="font-weight:700;letter-spacing:-0.01em;">' + esc(c.ticker) + '</td>' +
      '<td style="color:var(--text-main); font-size:12px;">' + esc(c._nom) + '</td>' +
      '<td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">' + safeFmt(c.cours) + '</td>' +
      '<td style="text-align:right"><span class="pill ' + cls + '">' + sign + v.toFixed(2) + '%</span></td>' +
      '<td style="text-align:right;color:var(--text-muted);font-variant-numeric:tabular-nums;">' + safeFmt(c.volume) + '</td>' +
      '<td style="text-align:right;font-weight:500;color:var(--text-muted);">' + (c.capitalisation ? safeFmtM(c.capitalisation) : "&#8212;") + '</td>' +
      '<td><span class="sector-badge">' + esc(safeSector(c.ticker)) + '</span></td>' +
      '<td><label class="compare-checkbox" onclick="event.stopPropagation()">' +
        '<input type="checkbox" data-role="compare-toggle" data-ticker="' + esc(c.ticker) + '" ' + (isChecked ? "checked" : "") + '>' +
      '</label></td>' +
    '</tr>';
  }

  // ─── ALGORITHMES ANALYTIQUES ────────────────────────────────────────
  function historyFor(ticker, history) {
    if (history) return history;
    return ((typeof allCoursHistorique !== "undefined" && allCoursHistorique) || []).filter(function (h) { return h.ticker === ticker; });
  }
  function isVolumeAnormal(ticker, currentVolume, history) {
    var h = historyFor(ticker, history).slice(-20); if (h.length < 5) return false;
    var avg = h.reduce(function (sum, x) { return sum + (x.volume || 0); }, 0) / h.length;
    return currentVolume > avg * 2;
  }
  function isTendanceHaussiere(ticker, history) {
    var h = historyFor(ticker, history).slice(-20); if (h.length < 20) return false;
    var sma20 = h.reduce(function (sum, x) { return sum + (x.cours_cloture || x.cours || 0); }, 0) / h.length;
    var last = h[h.length - 1]; return (last.cours_cloture || last.cours || 0) > sma20;
  }
  function isProche52Haut(ticker, currentPrice, history) {
    var h = historyFor(ticker, history); if (h.length < 20) return false;
    var high52 = h.reduce(function (max, x) { return Math.max(max, x.plus_haut || x.cours || 0); }, -Infinity);
    return currentPrice > high52 * 0.95;
  }
  function isProche52Bas(ticker, currentPrice, history) {
    var h = historyFor(ticker, history); if (h.length < 20) return false;
    var low52 = h.reduce(function (min, x) { return Math.min(min, x.plus_bas || x.cours || Infinity); }, Infinity);
    return currentPrice < low52 * 1.05;
  }

  // ─── GESTION MODULES COMPARAISON ────────────────────────────────────
  function toggleCompare(ticker, checked) {
    var list = window._selectedForCompare;
    if (checked) { if (list.indexOf(ticker) === -1) list.push(ticker); }
    else { window._selectedForCompare = list.filter(function (t) { return t !== ticker; }); }
    updateCompareBar();
  }

  function updateCompareBar() {
    var bar = document.getElementById("compareBar");
    var count = document.getElementById("compareCount");
    if (!bar || !count) return;
    var n = window._selectedForCompare.length;
    if (n > 0) { bar.style.display = "flex"; count.textContent = n + " titre" + (n > 1 ? "s" : "") + " à comparer"; }
    else { bar.style.display = "none"; }
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
    try { sessionStorage.setItem("compareTickers", JSON.stringify(window._selectedForCompare)); }
    catch (err) { console.error("Échec persistance sélection :", err); }
    if (typeof nav === "function") nav("analyse-technique");
  }

  // ─── API EXPOSÉE ───────────────────────────────────────────────────
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

})();
