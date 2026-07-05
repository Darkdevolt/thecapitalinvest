// ═══════════════════════════════════════════════════════════════════
// VIEW — Titres BRVM — CORRECTION Z-INDEX & VISIBILITÉ
// Problème : cartes générées mais cachées par un overlay/drap
// Solution : z-index correct, position relative, overflow visible
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── ÉTAT GLOBAL ─────────────────────────────────────────────────
  window._titreFilter      = window._titreFilter      || "all";
  window._titrePaysFilter  = window._titrePaysFilter  || "all";
  window._titreView        = window._titreView        || "cards";
  window._selectedForCompare = window._selectedForCompare || [];
  window._titreSort        = window._titreSort        || { field: null, dir: 1 };
  window._titreSearch      = window._titreSearch      || "";

  var _histByTicker = {};
  var _dynamicSectors = [];
  var _sectorCounts = {};
  var _cssInjected = false;
  var _listenersAttached = false;
  var _headerCreated = false;
  var _dataCheckInterval = null;
  var _isInitialized = false;

  // ─── DONNÉES PAYS (UEMOA) ─────────────────────────────────────────
  var PAYS_NAMES = {
    "CI": "Côte d'Ivoire", "SN": "Sénégal", "BF": "Burkina Faso", "BJ": "Bénin",
    "TG": "Togo", "ML": "Mali", "NE": "Niger", "GW": "Guinée-Bissau"
  };

  var PAYS_COLORS = {
    "CI": "#FF8200", "SN": "#00853F", "BF": "#EF2B2D", "BJ": "#FCD116",
    "TG": "#006A4E", "ML": "#14B53A", "NE": "#E05206", "GW": "#FFD700"
  };

  // ─── HELPERS ───────────────────────────────────────────────────────
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeFmt(v) { return (typeof fmt === "function") ? fmt(v) : String(v == null ? "" : v); }
  function safeFmtM(v) { return (typeof fmtM === "function") ? fmtM(v) : String(v == null ? "" : v); }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  // ─── DEBUG ─────────────────────────────────────────────────────────
  function log(msg, data) {
    console.log("[TITRES] " + msg, data !== undefined ? data : "");
  }

  // ─── VÉRIFICATION DONNÉES ────────────────────────────────────────
  function hasData() {
    var hasCours = typeof allCours !== "undefined" && Array.isArray(allCours) && allCours.length > 0;
    return { hasCours: hasCours, ready: hasCours };
  }

  // ─── EXTRACTION DYNAMIQUE DES SECTEURS ─────────────────────────────
  function extractDynamicSectors() {
    var sectors = new Set();
    var counts = {};

    if (typeof entMap !== "undefined" && entMap) {
      Object.keys(entMap).forEach(function (tk) {
        var ent = entMap[tk];
        if (ent && ent.secteur) {
          var s = normalizeSector(ent.secteur);
          if (s) {
            sectors.add(s);
            counts[s] = (counts[s] || 0) + 1;
          }
        }
      });
    }

    if (sectors.size === 0 && typeof allCours !== "undefined" && Array.isArray(allCours)) {
      allCours.forEach(function (c) {
        if (c && c.secteur) {
          var s = normalizeSector(c.secteur);
          if (s) {
            sectors.add(s);
            counts[s] = (counts[s] || 0) + 1;
          }
        }
      });
    }

    _dynamicSectors = Array.from(sectors).sort(function (a, b) {
      return (counts[b] || 0) - (counts[a] || 0);
    });

    _sectorCounts = counts;
    return _dynamicSectors;
  }

  function normalizeSector(raw) {
    if (!raw) return "";
    var s = String(raw).trim().toLowerCase();
    if (!s) return "";
    if (s.endsWith("s") && s.length > 3) s = s.slice(0, -1);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function getSectorFromEntMap(ticker) {
    if (typeof entMap !== "undefined" && entMap && entMap[ticker] && entMap[ticker].secteur) {
      return normalizeSector(entMap[ticker].secteur);
    }
    if (typeof getSector === "function") return getSector(ticker);
    return "Autre";
  }

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────────
  function renderTitres() {
    log("=== renderTitres() appelé ===");
    
    var dataStatus = hasData();
    if (!dataStatus.ready) {
      log("Données non prêtes, attente...");
      showLoader();
      startDataWatcher();
      return;
    }

    if (_isInitialized) {
      log("Déjà initialisé, mise à jour uniquement...");
      updateDataAndRender();
      return;
    }

    _doInit();
  }

  function showLoader() {
    var container = document.getElementById("view-titres");
    if (!container) return;
    injectTitresCSS();
    if (container.querySelector(".tc-titres-header")) return;
    container.innerHTML =
      '<div class="tc-empty" style="padding:80px 20px;">' +
        '<div class="tc-empty-icon">⏳</div>' +
        '<div>Chargement des données BRVM...</div>' +
      '</div>';
  }

  function startDataWatcher() {
    if (_dataCheckInterval) return;
    log("Démarrage watcher...");
    var attempts = 0;
    _dataCheckInterval = setInterval(function () {
      attempts++;
      var status = hasData();
      if (status.ready) {
        log("Données prêtes !");
        clearInterval(_dataCheckInterval);
        _dataCheckInterval = null;
        renderTitres();
      } else if (attempts > 60) {
        clearInterval(_dataCheckInterval);
        _dataCheckInterval = null;
        showError("Timeout après 30s");
      }
    }, 500);
  }

  function showError(msg) {
    var container = document.getElementById("view-titres");
    if (!container) return;
    var results = container.querySelector("#titresResults");
    if (results) {
      results.innerHTML = '<div class="tc-empty"><div class="tc-empty-icon">⚠️</div><div>' + esc(msg) + '</div></div>';
    } else {
      container.innerHTML = '<div class="tc-empty"><div class="tc-empty-icon">⚠️</div><div>' + esc(msg) + '</div></div>';
    }
  }

  function _doInit() {
    log("=== INITIALISATION COMPLÈTE ===");
    
    var container = document.getElementById("view-titres");
    if (!container) {
      log("ERREUR FATAL: #view-titres n'existe pas");
      return;
    }

    buildData();
    
    if (!_headerCreated) {
      createHeader();
      _headerCreated = true;
    }
    
    filterTitres();
    
    _isInitialized = true;
    log("=== Initialisation terminée ===");
  }

  function updateDataAndRender() {
    log("=== MISE À JOUR DONNÉES ===");
    buildData();
    updateSectorPills();
    filterTitres();
  }

  function buildData() {
    var byTicker = {};
    if (typeof allCours !== "undefined" && Array.isArray(allCours)) {
      allCours.forEach(function (c) {
        if (c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker] = c;
      });
    }
    
    window._titresRows = Object.values(byTicker);
    log("Titres uniques:", window._titresRows.length);

    _histByTicker = buildHistoryIndex();
    extractDynamicSectors();

    window._titresRows.forEach(function (row) {
      var ent = (typeof entMap !== "undefined" && entMap) ? entMap[row.ticker] : null;
      row._pays = (ent && ent.pays) || "CI";
      row._secteur = getSectorFromEntMap(row.ticker);
      row._nom = (ent && ent.nom) || row.ticker;

      var hist = _histByTicker[row.ticker] || [];
      row._volumeAnormal = isVolumeAnormal(row.ticker, row.volume, hist);
      row._tendanceHaussiere = isTendanceHaussiere(row.ticker, hist);
      row._proche52Haut = isProche52Haut(row.ticker, row.cours, hist);
      row._proche52Bas = isProche52Bas(row.ticker, row.cours, hist);
    });
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

  // ─── CSS CORRIGÉ ─────────────────────────────────────────────────
  // FIX CRITIQUE : z-index, position, visibility pour éviter le "drap"
  function injectTitresCSS() {
    if (_cssInjected) return;
    var css = `
      /* ─── FIX CRITIQUE : Le container principal doit être visible ─── */
      #view-titres {
        position: relative;
        z-index: 1;
        min-height: 100vh;
        overflow: visible;
      }

      /* ─── FIX : S'assurer que le contenu n'est pas caché ─── */
      #titresResults {
        position: relative;
        z-index: 2;
        min-height: 200px;
        overflow: visible;
      }

      .tc-titres-header {
        position: relative;
        z-index: 3;
        padding: 24px 0;
        border-bottom: 1px solid var(--border);
        margin-bottom: 24px;
      }
      .tc-titres-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .tc-titres-title {
        font-family: var(--serif);
        font-size: clamp(28px, 4vw, 48px);
        font-weight: 900;
        line-height: 1.05;
        color: var(--cream);
        letter-spacing: -1px;
      }
      .tc-titres-title em { font-style: italic; color: var(--gold); }

      .tc-titres-search-wrap {
        position: relative;
        flex: 1;
        max-width: 360px;
      }
      .tc-titres-search-wrap input {
        width: 100%;
        padding: 10px 14px 10px 38px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--r);
        color: var(--cream);
        font-family: var(--sans);
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s;
      }
      .tc-titres-search-wrap input:focus { border-color: var(--gold); }
      .tc-titres-search-wrap input::placeholder { color: var(--dim); }
      .tc-titres-search-wrap::before {
        content: '🔍';
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        opacity: 0.5;
        pointer-events: none;
      }

      .tc-view-toggle {
        display: flex;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--r);
        padding: 3px;
        gap: 3px;
      }
      .tc-view-btn {
        background: transparent;
        border: none;
        color: var(--muted);
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-family: var(--sans);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        transition: all 0.2s;
      }
      .tc-view-btn.active {
        background: var(--gold-bg);
        color: var(--gold);
      }
      .tc-view-btn:hover:not(.active) { color: var(--cream); }

      .tc-filters-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .tc-filter-group {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .tc-filter-label {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin-right: 4px;
      }
      .tc-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 20px;
        color: var(--muted);
        font-family: var(--sans);
        font-size: 12px;
        font-weight: 400;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }
      .tc-pill:hover {
        border-color: var(--gold-dim);
        color: var(--cream);
        background: var(--card2);
      }
      .tc-pill.active {
        background: var(--gold-bg);
        border-color: rgba(184,150,78,0.3);
        color: var(--gold);
      }
      .tc-pill .tc-count {
        font-size: 10px;
        opacity: 0.5;
        font-family: var(--mono);
      }
      .tc-pays-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        display: inline-block;
      }
      .tc-reset {
        margin-left: auto;
        padding: 6px 14px;
        background: transparent;
        border: 1px dashed var(--border);
        border-radius: var(--r);
        color: var(--muted);
        font-family: var(--sans);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s;
      }
      .tc-reset:hover {
        border-color: var(--red);
        color: var(--red);
      }

      /* ─── FIX CRITIQUE : Grille de cartes ─── */
      .tc-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1px;
        background: var(--border);
        border: 1px solid var(--border);
        position: relative;
        z-index: 2;
      }

      /* ─── FIX CRITIQUE : Carte individuelle ─── */
      .tc-titre-card {
        background: var(--card);
        padding: 28px 24px;
        cursor: pointer;
        transition: background 0.3s;
        position: relative;
        overflow: hidden;
        animation: fadeUp 0.6s ease forwards;
        opacity: 0;
        z-index: 2;
      }
      .tc-titre-card:nth-child(1) { animation-delay: 0.05s; }
      .tc-titre-card:nth-child(2) { animation-delay: 0.10s; }
      .tc-titre-card:nth-child(3) { animation-delay: 0.15s; }
      .tc-titre-card:nth-child(4) { animation-delay: 0.20s; }
      .tc-titre-card:nth-child(5) { animation-delay: 0.25s; }
      .tc-titre-card:nth-child(6) { animation-delay: 0.30s; }
      .tc-titre-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, var(--gold), transparent);
        transform: scaleX(0);
        transition: transform 0.4s ease;
      }
      .tc-titre-card:hover { background: var(--surface); }
      .tc-titre-card:hover::before { transform: scaleX(1); }
      .tc-titre-card.up { border-left: 2px solid var(--green); }
      .tc-titre-card.down { border-left: 2px solid var(--red); }
      .tc-titre-card.neutral { border-left: 2px solid var(--stone); }

      .tc-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .tc-card-pays {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
        padding: 3px 10px;
        background: var(--bg-row);
        border-radius: 3px;
      }
      .tc-card-badges { display: flex; gap: 6px; flex-wrap: wrap; }

      .tc-card-ticker {
        font-family: var(--serif);
        font-size: 24px;
        font-weight: 700;
        color: var(--cream);
        letter-spacing: -0.5px;
        margin-bottom: 4px;
      }
      .tc-card-nom {
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 20px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tc-card-price-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .tc-card-price {
        font-family: var(--serif);
        font-size: 28px;
        font-weight: 700;
        color: var(--cream);
        font-variant-numeric: tabular-nums;
      }
      .tc-card-price span {
        font-size: 12px;
        font-weight: 400;
        color: var(--muted);
        margin-left: 4px;
      }
      .tc-card-var {
        font-family: var(--mono);
        font-size: 14px;
        font-weight: 500;
        padding: 4px 10px;
        border-radius: 3px;
        font-variant-numeric: tabular-nums;
      }
      .tc-card-var.up { background: rgba(74,222,128,0.1); color: var(--green); border: 1px solid rgba(74,222,128,0.2); }
      .tc-card-var.down { background: rgba(248,113,113,0.1); color: var(--red); border: 1px solid rgba(248,113,113,0.2); }
      .tc-card-var.neutral { background: rgba(245,240,232,0.05); color: var(--muted); border: 1px solid var(--border2); }

      .tc-sparkline-wrap {
        height: 50px;
        margin-bottom: 16px;
      }
      .tc-sparkline-wrap canvas {
        width: 100%;
        height: 100%;
      }

      .tc-card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 14px;
        border-top: 1px solid var(--border2);
        font-size: 12px;
        color: var(--muted);
      }
      .tc-card-footer .tc-sector-tag {
        background: var(--gold-bg);
        color: var(--gold);
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.05em;
      }
      .tc-card-compare {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--border2);
      }
      .tc-card-compare label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--muted);
        cursor: pointer;
      }
      .tc-card-compare input[type="checkbox"] {
        accent-color: var(--gold);
        width: 14px; height: 14px;
      }

      .tc-table-wrap {
        border: 1px solid var(--border);
        overflow: hidden;
      }
      .tc-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .tc-table thead th {
        padding: 12px 14px;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
        border-bottom: 1px solid var(--border);
        background: rgba(0,0,0,0.3);
        text-align: left;
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        transition: color 0.2s;
        font-family: var(--sans);
      }
      .tc-table thead th:hover { color: var(--cream); }
      .tc-table thead th.r, .tc-table td.r { text-align: right; }
      .tc-table thead th.sortable::after {
        content: ' ⇅';
        opacity: 0.3;
        font-size: 9px;
      }
      .tc-table thead th.sort-asc::after { content: ' ▲'; opacity: 1; color: var(--gold); }
      .tc-table thead th.sort-desc::after { content: ' ▼'; opacity: 1; color: var(--gold); }
      .tc-table tbody tr {
        border-bottom: 1px solid rgba(245,240,232,0.05);
        transition: background 0.15s;
        cursor: pointer;
      }
      .tc-table tbody tr:hover { background: var(--bg-row); }
      .tc-table tbody tr:last-child { border-bottom: none; }
      .tc-table td {
        padding: 12px 14px;
        vertical-align: middle;
        font-variant-numeric: tabular-nums;
      }
      .tc-table .tc-ticker-cell { font-weight: 700; color: var(--cream); }
      .tc-table .tc-pays-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        display: inline-block;
      }

      .tc-compare-trigger {
        position: fixed;
        bottom: 24px; right: 24px;
        background: var(--gold);
        color: var(--bg);
        border: none;
        border-radius: 2px;
        padding: 12px 20px;
        font-family: var(--sans);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: var(--shadow);
        z-index: 150;
        display: none;
        align-items: center;
        gap: 8px;
        transition: all 0.3s;
      }
      .tc-compare-trigger.visible { display: flex; }
      .tc-compare-trigger:hover {
        background: var(--gold-l);
        transform: translateY(-2px);
      }
      .tc-compare-drawer {
        position: fixed;
        right: 0; top: 0; bottom: 0;
        width: 380px;
        max-width: 90vw;
        background: var(--surface);
        border-left: 1px solid var(--border);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        z-index: 200;
        display: flex;
        flex-direction: column;
        box-shadow: -10px 0 40px rgba(0,0,0,0.4);
      }
      .tc-compare-drawer.open { transform: translateX(0); }
      .tc-drawer-header {
        padding: 24px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .tc-drawer-title {
        font-family: var(--serif);
        font-size: 20px;
        font-weight: 700;
        color: var(--cream);
      }
      .tc-drawer-close {
        background: none;
        border: none;
        color: var(--muted);
        font-size: 24px;
        cursor: pointer;
        padding: 4px;
        transition: color 0.2s;
      }
      .tc-drawer-close:hover { color: var(--cream); }
      .tc-drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      .tc-drawer-item {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--r);
        padding: 16px;
        margin-bottom: 10px;
      }
      .tc-drawer-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--border);
        display: flex;
        gap: 10px;
      }
      .tc-btn {
        flex: 1;
        padding: 12px;
        border-radius: 2px;
        border: none;
        font-family: var(--sans);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        cursor: pointer;
        transition: all 0.2s;
      }
      .tc-btn-primary {
        background: var(--gold);
        color: var(--bg);
      }
      .tc-btn-primary:hover { background: var(--gold-l); }
      .tc-btn-secondary {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--muted);
      }
      .tc-btn-secondary:hover {
        border-color: var(--gold-dim);
        color: var(--cream);
      }

      .tc-empty {
        text-align: center;
        padding: 80px 20px;
        color: var(--muted);
        font-size: 14px;
      }
      .tc-empty-icon {
        font-size: 3rem;
        margin-bottom: 16px;
        opacity: 0.3;
      }

      @media (max-width: 900px) {
        .tc-titres-top { flex-direction: column; align-items: stretch; }
        .tc-titres-search-wrap { max-width: none; }
        .tc-cards-grid { grid-template-columns: 1fr; }
        .tc-compare-drawer { width: 100%; max-width: 100%; }
      }
    `;
    var style = document.createElement('style');
    style.id = 'tc-titres-style';
    style.textContent = css;
    document.head.appendChild(style);
    _cssInjected = true;
  }

  // ─── CRÉATION DU HEADER (UNE SEULE FOIS) ─────────────────────────
  function createHeader() {
    var container = document.getElementById("view-titres");
    if (!container) return;

    injectTitresCSS();

    container.innerHTML = '';

    var paysPills = Object.keys(PAYS_NAMES).map(function (code) {
      return '<button class="tc-pill" data-pays="' + esc(code) + '">' +
        '<span class="tc-pays-dot" style="background:' + PAYS_COLORS[code] + '"></span>' +
        esc(PAYS_NAMES[code]) +
      '</button>';
    }).join("");

    var sectorPills = _dynamicSectors.map(function (s) {
      return '<button class="tc-pill" data-sector="' + esc(s) + '">' +
        esc(s) + ' <span class="tc-count">(' + (_sectorCounts[s] || 0) + ')</span>' +
      '</button>';
    }).join("");

    var headerHtml =
      '<div class="tc-titres-header">' +
        '<div class="tc-titres-top">' +
          '<h2 class="tc-titres-title">Titres <em>BRVM</em></h2>' +
          '<div class="tc-titres-search-wrap">' +
            '<input type="text" id="searchTitres" placeholder="Rechercher un ticker, une société..." value="' + esc(window._titreSearch) + '">' +
          '</div>' +
          '<div class="tc-view-toggle">' +
            '<button class="tc-view-btn" data-view="cards">Cartes</button>' +
            '<button class="tc-view-btn" data-view="table">Tableau</button>' +
          '</div>' +
        '</div>' +
        '<div class="tc-filters-row">' +
          '<div class="tc-filter-group">' +
            '<span class="tc-filter-label">Pays</span>' +
            '<button class="tc-pill" data-pays="all">Tous</button>' +
            paysPills +
          '</div>' +
          '<div class="tc-filter-group" style="margin-left:16px;" id="sectorFilters">' +
            '<span class="tc-filter-label">Secteur</span>' +
            '<button class="tc-pill" data-sector="all">Tous</button>' +
            sectorPills +
          '</div>' +
          '<button class="tc-reset" id="resetTitresBtn">↺ Réinitialiser</button>' +
        '</div>' +
      '</div>' +
      '<div id="titresResults"></div>' +
      '<button class="tc-compare-trigger" id="compareTrigger">' +
        'Comparer <span id="compareTriggerText">0</span>' +
      '</button>' +
      '<div class="tc-compare-drawer" id="compareDrawer">' +
        '<div class="tc-drawer-header">' +
          '<div class="tc-drawer-title">Comparaison</div>' +
          '<button class="tc-drawer-close" id="closeDrawer">&times;</button>' +
        '</div>' +
        '<div class="tc-drawer-body" id="compareDrawerBody"></div>' +
        '<div class="tc-drawer-footer">' +
          '<button class="tc-btn tc-btn-secondary" id="clearCompareBtn">Vider</button>' +
          '<button class="tc-btn tc-btn-primary" id="launchCompareBtn">Comparer</button>' +
        '</div>' +
      '</div>';

    container.innerHTML = headerHtml;

    var searchInput = document.getElementById("searchTitres");
    if (searchInput) {
      searchInput.addEventListener("input", debounce(function (e) {
        window._titreSearch = e.target.value;
        filterTitres();
      }, 250));
    }

    var resetBtn = document.getElementById("resetTitresBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetTitresFilters);

    var filtersRow = container.querySelector(".tc-filters-row");
    if (filtersRow) {
      filtersRow.addEventListener("click", function (e) {
        var pill = e.target.closest("[data-pays]");
        if (pill) {
          setPaysFilter(pill.getAttribute("data-pays"));
          return;
        }
        var sect = e.target.closest("[data-sector]");
        if (sect) setTitreFilter(sect.getAttribute("data-sector"));
      });
    }

    var viewToggle = container.querySelector(".tc-view-toggle");
    if (viewToggle) {
      viewToggle.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-view]");
        if (btn) setTitreView(btn.getAttribute("data-view"));
      });
    }

    var compareTrigger = document.getElementById("compareTrigger");
    if (compareTrigger) {
      compareTrigger.addEventListener("click", function () {
        var drawer = document.getElementById("compareDrawer");
        if (drawer) drawer.classList.add("open");
      });
    }

    var closeDrawer = document.getElementById("closeDrawer");
    if (closeDrawer) {
      closeDrawer.addEventListener("click", function () {
        var drawer = document.getElementById("compareDrawer");
        if (drawer) drawer.classList.remove("open");
      });
    }

    var clearCompareBtn = document.getElementById("clearCompareBtn");
    if (clearCompareBtn) clearCompareBtn.addEventListener("click", clearSelection);

    var launchCompareBtn = document.getElementById("launchCompareBtn");
    if (launchCompareBtn) launchCompareBtn.addEventListener("click", compareSelected);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var drawer = document.getElementById("compareDrawer");
        if (drawer) drawer.classList.remove("open");
      }
    });

    attachResultsListeners();
    updateHeaderState();
  }

  function updateSectorPills() {
    var sectorGroup = document.getElementById("sectorFilters");
    if (!sectorGroup) return;

    var sectorPills = _dynamicSectors.map(function (s) {
      var isActive = window._titreFilter === s;
      return '<button class="tc-pill ' + (isActive ? 'active' : '') + '" data-sector="' + esc(s) + '">' +
        esc(s) + ' <span class="tc-count">(' + (_sectorCounts[s] || 0) + ')</span>' +
      '</button>';
    }).join("");

    sectorGroup.innerHTML =
      '<span class="tc-filter-label">Secteur</span>' +
      '<button class="tc-pill ' + (window._titreFilter === "all" ? 'active' : '') + '" data-sector="all">Tous</button>' +
      sectorPills;
  }

  function updateHeaderState() {
    document.querySelectorAll("[data-pays]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-pays") === window._titrePaysFilter);
    });
    document.querySelectorAll("[data-sector]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-sector") === window._titreFilter);
    });
    document.querySelectorAll("[data-view]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === window._titreView);
    });
    var searchInput = document.getElementById("searchTitres");
    if (searchInput && searchInput.value !== window._titreSearch) {
      searchInput.value = window._titreSearch;
    }
  }

  // ─── FILTRES / TRI ─────────────────────────────────────────────────
  function setTitreView(view) {
    window._titreView = view;
    document.querySelectorAll(".tc-view-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === view);
    });
    filterTitres();
  }

  function setPaysFilter(pays) {
    window._titrePaysFilter = pays;
    document.querySelectorAll("[data-pays]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-pays") === pays);
    });
    filterTitres();
  }

  function setTitreFilter(f) {
    window._titreFilter = f;
    document.querySelectorAll("[data-sector]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-sector") === f);
    });
    filterTitres();
  }

  var _sortDebounceTimer = null;
  function sortTitresBy(field) {
    clearTimeout(_sortDebounceTimer);
    _sortDebounceTimer = setTimeout(function () {
      var sort = window._titreSort;
      if (sort.field === field) {
        sort.dir = -sort.dir;
      } else {
        sort.field = field;
        sort.dir = 1;
      }
      filterTitres();
    }, 50);
  }

  function resetTitresFilters() {
    window._titreFilter = "all";
    window._titrePaysFilter = "all";
    window._titreSort = { field: null, dir: 1 };
    window._titreSearch = "";
    var searchInput = document.getElementById("searchTitres");
    if (searchInput) searchInput.value = "";
    document.querySelectorAll("[data-pays]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-pays") === "all");
    });
    document.querySelectorAll("[data-sector]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-sector") === "all");
    });
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

  var _filterDebounceTimer = null;
  function filterTitres() {
    clearTimeout(_filterDebounceTimer);
    _filterDebounceTimer = setTimeout(_doFilterTitres, 10);
  }

  function _doFilterTitres() {
    log("=== _doFilterTitres() ===");
    var q = window._titreSearch.toLowerCase().trim();
    var rows = window._titresRows || [];
    log("Rows au départ:", rows.length);

    if (window._titrePaysFilter !== "all") {
      rows = rows.filter(function (r) { return r._pays === window._titrePaysFilter; });
    }

    if (window._titreFilter !== "all") {
      rows = rows.filter(function (r) { return r._secteur === window._titreFilter; });
    }

    if (q) {
      rows = rows.filter(function (r) {
        return (r.ticker || "").toLowerCase().indexOf(q) !== -1 ||
               (r._nom || "").toLowerCase().indexOf(q) !== -1;
      });
    }

    rows = applySort(rows);
    log("Rows après filtre/tri:", rows.length);

    var resultsContainer = document.getElementById("titresResults");
    log("resultsContainer:", resultsContainer ? "TROUVÉ" : "MANQUANT");
    if (!resultsContainer) {
      log("ERREUR: #titresResults introuvable !");
      return;
    }

    if (!rows.length) {
      resultsContainer.innerHTML =
        '<div class="tc-empty">' +
          '<div class="tc-empty-icon">📭</div>' +
          '<div>Aucun titre ne correspond à vos critères</div>' +
        '</div>';
      updateCompareUI();
      return;
    }

    if (window._titreView === "cards") {
      var cardsHtml = renderCardsView(rows);
      log("Injection HTML cartes, longueur:", cardsHtml.length);
      resultsContainer.innerHTML = cardsHtml;
      
      setTimeout(function () {
        rows.forEach(function (c) {
          var v = parseFloat(c.variation) || 0;
          var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
          drawSparkline(c.ticker, cls);
        });
      }, 50);
    } else {
      resultsContainer.innerHTML = renderTableView(rows);
    }

    updateCompareUI();
    log("=== filterTitres terminé ===");
  }

  // ─── DÉLÉGATION ÉVÉNEMENTS ───────────────────────────────────────
  function attachResultsListeners() {
    if (_listenersAttached) return;
    var container = document.getElementById("view-titres");
    if (!container) return;

    container.addEventListener("click", function (e) {
      if (e.target.closest(".tc-card-compare") || e.target.closest("th")) return;
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

    _listenersAttached = true;
  }

  // ─── VUE CARTES ────────────────────────────────────────────────────
  function renderCardsView(rows) {
    return '<div class="tc-cards-grid">' + rows.map(renderTitreCard).join("") + '</div>';
  }

  function renderTitreCard(c) {
    var v = parseFloat(c.variation) || 0;
    var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
    var sign = v > 0 ? "+" : "";
    var paysColor = PAYS_COLORS[c._pays] || "#B8964E";
    var isChecked = window._selectedForCompare.indexOf(c.ticker) !== -1;

    var badges = "";
    if (c._volumeAnormal) badges += '<span class="tagp">🔥 Volume</span>';
    if (c._tendanceHaussiere) badges += '<span class="badge-green">📈 Tendance</span>';
    if (c._proche52Haut) badges += '<span class="badge-orange">⚠️ 52H</span>';
    if (c._proche52Bas) badges += '<span class="badge-red">📉 52B</span>';

    return '<div class="tc-titre-card ' + cls + '" data-ticker="' + esc(c.ticker) + '">' +
      '<div class="tc-card-header">' +
        '<span class="tc-card-pays" style="color:' + paysColor + '">' + esc(PAYS_NAMES[c._pays] || c._pays) + '</span>' +
        '<div class="tc-card-badges">' + badges + '</div>' +
      '</div>' +
      '<div class="tc-card-ticker">' + esc(c.ticker) + '</div>' +
      '<div class="tc-card-nom">' + esc(c._nom) + '</div>' +
      '<div class="tc-card-price-row">' +
        '<span class="tc-card-price">' + safeFmt(c.cours) + '<span>FCFA</span></span>' +
        '<span class="tc-card-var ' + cls + '">' + sign + v.toFixed(2) + '%</span>' +
      '</div>' +
      '<div class="tc-sparkline-wrap">' +
        '<canvas id="spark-' + esc(c.ticker) + '" width="240" height="50"></canvas>' +
      '</div>' +
      '<div class="tc-card-footer">' +
        '<span class="tc-sector-tag">' + esc(c._secteur) + '</span>' +
        '<span>Vol ' + safeFmt(c.volume) + '</span>' +
      '</div>' +
      '<div class="tc-card-compare">' +
        '<label onclick="event.stopPropagation()">' +
          '<input type="checkbox" data-role="compare-toggle" data-ticker="' + esc(c.ticker) + '" ' + (isChecked ? "checked" : "") + '>' +
          '<span>Ajouter à la comparaison</span>' +
        '</label>' +
      '</div>' +
    '</div>';
  }

  // ─── SPARKLINE ─────────────────────────────────────────────────────
  function drawSparkline(ticker, cls) {
    try {
      var canvas = document.getElementById("spark-" + ticker);
      if (!canvas || !canvas.getContext) return;
      var hist = (_histByTicker[ticker] || []).slice(-30);
      if (hist.length < 2) return;

      var values = hist.map(function (h) { return parseFloat(h.cours_cloture || h.cours || 0); });
      var ctx = canvas.getContext("2d");
      var w = 240, h = 50, pad = 4;

      var dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";

      ctx.clearRect(0, 0, w, h);

      var min = Math.min.apply(null, values);
      var max = Math.max.apply(null, values);
      var range = (max - min) || 1;

      var points = values.map(function (val, i) {
        return {
          x: pad + (i / (values.length - 1)) * (w - pad * 2),
          y: h - pad - ((val - min) / range) * (h - pad * 2)
        };
      });

      var grad = ctx.createLinearGradient(0, 0, 0, h);
      var color = cls === "up" ? "74,222,128" : cls === "down" ? "248,113,113" : "107,114,128";
      grad.addColorStop(0, "rgba(" + color + ",0.15)");
      grad.addColorStop(1, "rgba(" + color + ",0.0)");

      ctx.beginPath();
      ctx.moveTo(points[0].x, h - pad);
      points.forEach(function (p) { ctx.lineTo(p.x, p.y); });
      ctx.lineTo(points[points.length - 1].x, h - pad);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      points.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = "rgb(" + color + ")";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      var last = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(" + color + ")";
      ctx.fill();
    } catch (err) {
      console.warn("drawSparkline failed for " + ticker + ":", err);
    }
  }

  // ─── VUE TABLEAU ───────────────────────────────────────────────────
  function sortArrow(field) {
    var sort = window._titreSort;
    if (sort.field !== field) return "";
    return sort.dir === 1 ? "sort-asc" : "sort-desc";
  }

  function renderTableView(rows) {
    return '<div class="tc-table-wrap">' +
      '<table class="tc-table">' +
        '<thead><tr>' +
          '<th>Pays</th>' +
          '<th data-field="ticker" class="sortable ' + sortArrow("ticker") + '">Ticker</th>' +
          '<th data-field="_nom" class="sortable ' + sortArrow("_nom") + '">Société</th>' +
          '<th data-field="cours" class="r sortable ' + sortArrow("cours") + '">Cours</th>' +
          '<th data-field="variation" class="r sortable ' + sortArrow("variation") + '">Variation</th>' +
          '<th data-field="volume" class="r sortable ' + sortArrow("volume") + '">Volume</th>' +
          '<th data-field="capitalisation" class="r sortable ' + sortArrow("capitalisation") + '">Cap.</th>' +
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

    var varClass = v > 0 ? 'badge-green' : v < 0 ? 'badge-red' : '';
    var varHtml = v > 0 ? '▲ ' + v.toFixed(2) + '%' : v < 0 ? '▼ ' + Math.abs(v).toFixed(2) + '%' : '= 0.00%';

    return '<tr data-ticker="' + esc(c.ticker) + '">' +
      '<td><span class="tc-pays-dot" style="background:' + paysColor + '" title="' + esc(PAYS_NAMES[c._pays] || "") + '"></span></td>' +
      '<td class="tc-ticker-cell">' + esc(c.ticker) + '</td>' +
      '<td>' + esc(c._nom) + '</td>' +
      '<td class="r" style="font-weight:600;">' + safeFmt(c.cours) + '</td>' +
      '<td class="r"><span class="tag ' + varClass + '">' + varHtml + '</span></td>' +
      '<td class="r">' + safeFmt(c.volume) + '</td>' +
      '<td class="r">' + (c.capitalisation ? safeFmtM(c.capitalisation) : "—") + '</td>' +
      '<td><span class="tagp">' + esc(c._secteur) + '</span></td>' +
      '<td><label onclick="event.stopPropagation()">' +
        '<input type="checkbox" data-role="compare-toggle" data-ticker="' + esc(c.ticker) + '" ' + (isChecked ? "checked" : "") + ' style="accent-color:#B8964E;width:14px;height:14px;">' +
      '</label></td>' +
    '</tr>';
  }

  // ─── INDICATEURS ───────────────────────────────────────────────────
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

  // ─── COMPARAISON ───────────────────────────────────────────────────
  function toggleCompare(ticker, checked) {
    var list = window._selectedForCompare;
    if (checked) {
      if (list.indexOf(ticker) === -1) list.push(ticker);
    } else {
      window._selectedForCompare = list.filter(function (t) { return t !== ticker; });
    }
    updateCompareUI();
  }

  function updateCompareUI() {
    var n = window._selectedForCompare.length;
    var trigger = document.getElementById("compareTrigger");
    var triggerText = document.getElementById("compareTriggerText");
    var drawerBody = document.getElementById("compareDrawerBody");

    if (trigger) trigger.classList.toggle("visible", n > 0);
    if (triggerText) triggerText.textContent = n;

    if (drawerBody) {
      if (n === 0) {
        drawerBody.innerHTML = '<div class="tc-empty" style="padding:40px 20px;">Sélectionnez des titres pour comparer</div>';
      } else {
        drawerBody.innerHTML = window._selectedForCompare.map(function (tk) {
          var row = (window._titresRows || []).find(function (r) { return r.ticker === tk; });
          if (!row) return "";
          var v = parseFloat(row.variation) || 0;
          var sign = v > 0 ? "+" : "";
          var varClass = v > 0 ? 'badge-green' : v < 0 ? 'badge-red' : '';
          return '<div class="tc-drawer-item">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<div style="font-family:var(--serif);font-weight:700;font-size:16px;">' + esc(row.ticker) + '</div>' +
              '<div style="font-size:12px;color:var(--muted);">' + esc(row._nom) + '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
              '<span style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;">' + safeFmt(row.cours) + ' FCFA</span>' +
              '<span class="tag ' + varClass + '">' + sign + v.toFixed(2) + '%</span>' +
            '</div>' +
          '</div>';
        }).join("");
      }
    }
  }

  function clearSelection() {
    window._selectedForCompare = [];
    document.querySelectorAll('input[data-role="compare-toggle"]').forEach(function (cb) { cb.checked = false; });
    updateCompareUI();
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

  // ─── API PUBLIQUE ──────────────────────────────────────────────────
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

  // ─── AUTO-INIT ───────────────────────────────────────────────────
  log("Script chargé. Vérification initiale...");
  if (hasData().ready) {
    log("Données prêtes, init immédiate");
    renderTitres();
  } else {
    log("Données non prêtes, watcher...");
    startDataWatcher();
  }

})();
