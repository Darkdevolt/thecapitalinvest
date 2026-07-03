// ═══════════════════════════════════════════════════════════════════
// VIEW — Titres BRVM — REDESIGN « DARK TERMINAL PREMIUM »
// Dynamique : secteurs extraits depuis entMap/Supabase
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── ÉTAT GLOBAL ───────────────────────────────────────────────────
  window._titreFilter   = window._titreFilter   || "all";
  window._titrePaysFilter = window._titrePaysFilter || "all";
  window._titreView     = window._titreView     || "cards";
  window._selectedForCompare = window._selectedForCompare || [];
  window._titreSort     = window._titreSort     || { field: null, dir: 1 };
  window._titreSearch   = window._titreSearch   || "";

  var _histByTicker = {};
  var _dynamicSectors = [];   // ← Secteurs extraits dynamiquement
  var _sectorCounts = {};     // ← Fréquence pour trier les filtres

  // ─── DESIGN TOKENS (CSS injecté) ───────────────────────────────────
  var DARK_CSS = `
    <style id="brvm-dark-theme">
      :root {
        --bg-primary: #0B0F19;
        --bg-secondary: #111827;
        --bg-card: rgba(255,255,255,0.03);
        --bg-card-hover: rgba(255,255,255,0.06);
        --border-subtle: rgba(255,255,255,0.06);
        --text-primary: #F3F4F6;
        --text-secondary: #9CA3AF;
        --accent-gold: #D4AF37;
        --accent-green: #10B981;
        --accent-red: #EF4444;
        --glass: backdrop-filter: blur(12px);
      }
      #view-titres {
        background: var(--bg-primary);
        min-height: 100vh;
        padding: 24px;
        color: var(--text-primary);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .brvm-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: rgba(11,15,25,0.85);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid var(--border-subtle);
        padding: 16px 24px;
        margin: -24px -24px 24px -24px;
      }
      .brvm-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .brvm-title {
        font-size: 1.5rem;
        font-weight: 700;
        background: linear-gradient(135deg, #D4AF37 0%, #F3F4F6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: -0.02em;
      }
      .brvm-search-wrap {
        position: relative;
        flex: 1;
        max-width: 400px;
      }
      .brvm-search {
        width: 100%;
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 10px 16px 10px 40px;
        color: var(--text-primary);
        font-size: 0.9rem;
        transition: all 0.2s;
      }
      .brvm-search:focus {
        outline: none;
        border-color: var(--accent-gold);
        box-shadow: 0 0 0 3px rgba(212,175,55,0.1);
      }
      .brvm-search-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      .brvm-view-toggle {
        display: flex;
        background: var(--bg-secondary);
        border-radius: 10px;
        padding: 4px;
        gap: 4px;
      }
      .brvm-view-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 500;
        transition: all 0.2s;
      }
      .brvm-view-btn.active {
        background: rgba(212,175,55,0.15);
        color: var(--accent-gold);
      }
      .brvm-filters-dock {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
        align-items: center;
      }
      .brvm-filter-group {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        align-items: center;
      }
      .brvm-filter-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        margin-right: 4px;
      }
      .brvm-pill {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }
      .brvm-pill:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
        transform: translateY(-1px);
      }
      .brvm-pill.active {
        background: rgba(212,175,55,0.15);
        border-color: rgba(212,175,55,0.3);
        color: var(--accent-gold);
      }
      .brvm-pays-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .brvm-pays-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .brvm-reset {
        background: transparent;
        border: 1px dashed var(--border-subtle);
        color: var(--text-secondary);
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        cursor: pointer;
        margin-left: auto;
        transition: all 0.2s;
      }
      .brvm-reset:hover {
        border-color: var(--accent-red);
        color: var(--accent-red);
      }
      /* ─── CARTES ─── */
      .brvm-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .brvm-card {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
        animation: cardEnter 0.5s ease-out backwards;
      }
      .brvm-card:nth-child(1) { animation-delay: 0.05s; }
      .brvm-card:nth-child(2) { animation-delay: 0.10s; }
      .brvm-card:nth-child(3) { animation-delay: 0.15s; }
      .brvm-card:nth-child(4) { animation-delay: 0.20s; }
      .brvm-card:nth-child(5) { animation-delay: 0.25s; }
      .brvm-card:nth-child(6) { animation-delay: 0.30s; }
      .brvm-card:hover {
        background: var(--bg-card-hover);
        border-color: rgba(212,175,55,0.2);
        transform: translateY(-4px);
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      }
      .brvm-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, transparent, var(--accent-gold), transparent);
        opacity: 0;
        transition: opacity 0.3s;
      }
      .brvm-card:hover::before {
        opacity: 1;
      }
      .brvm-card.up { border-left: 3px solid var(--accent-green); }
      .brvm-card.down { border-left: 3px solid var(--accent-red); }
      .brvm-card.neutral { border-left: 3px solid #6B7280; }
      @keyframes cardEnter {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .brvm-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      .brvm-card-pays {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 4px 10px;
        border-radius: 6px;
        background: rgba(255,255,255,0.05);
      }
      .brvm-card-badges {
        display: flex;
        gap: 6px;
      }
      .brvm-badge {
        font-size: 0.7rem;
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 600;
      }
      .brvm-badge.hot { background: rgba(239,68,68,0.15); color: #FCA5A5; }
      .brvm-badge.trend { background: rgba(16,185,129,0.15); color: #6EE7B7; }
      .brvm-badge.alert { background: rgba(245,158,11,0.15); color: #FCD34D; }
      .brvm-badge.alert-low { background: rgba(59,130,246,0.15); color: #93C5FD; }
      .brvm-card-ticker {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin-bottom: 2px;
      }
      .brvm-card-nom {
        font-size: 0.85rem;
        color: var(--text-secondary);
        margin-bottom: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .brvm-card-price-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .brvm-card-price {
        font-size: 1.5rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .brvm-card-var {
        font-size: 0.9rem;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 8px;
        font-variant-numeric: tabular-nums;
      }
      .brvm-card-var.up { background: rgba(16,185,129,0.15); color: var(--accent-green); }
      .brvm-card-var.down { background: rgba(239,68,68,0.15); color: var(--accent-red); }
      .brvm-card-var.neutral { background: rgba(107,114,128,0.15); color: #9CA3AF; }
      .brvm-sparkline-wrap {
        height: 50px;
        margin-bottom: 12px;
        position: relative;
      }
      .brvm-sparkline-wrap canvas {
        width: 100%;
        height: 100%;
      }
      .brvm-card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
        color: var(--text-secondary);
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
      }
      .brvm-sector-tag {
        background: rgba(212,175,55,0.1);
        color: var(--accent-gold);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .brvm-compare {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
      }
      .brvm-compare label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        color: var(--text-secondary);
        cursor: pointer;
      }
      .brvm-compare input[type="checkbox"] {
        accent-color: var(--accent-gold);
        width: 16px;
        height: 16px;
      }
      /* ─── TABLEAU ─── */
      .brvm-table-wrap {
        margin-top: 24px;
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        overflow: hidden;
      }
      .brvm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      .brvm-table thead {
        background: var(--bg-secondary);
      }
      .brvm-table th {
        padding: 14px 16px;
        text-align: left;
        font-weight: 600;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        transition: color 0.2s;
      }
      .brvm-table th:hover {
        color: var(--text-primary);
      }
      .brvm-table th.sortable::after {
        content: ' ⇅';
        opacity: 0.3;
        font-size: 0.75rem;
      }
      .brvm-table th.sort-asc::after { content: ' ▲'; opacity: 1; color: var(--accent-gold); }
      .brvm-table th.sort-desc::after { content: ' ▼'; opacity: 1; color: var(--accent-gold); }
      .brvm-table td {
        padding: 14px 16px;
        border-top: 1px solid var(--border-subtle);
        font-variant-numeric: tabular-nums;
      }
      .brvm-table tbody tr {
        transition: background 0.15s;
        cursor: pointer;
      }
      .brvm-table tbody tr:hover {
        background: var(--bg-card-hover);
      }
      .brvm-table .right { text-align: right; }
      .brvm-pill-table {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .brvm-pill-table.up { background: rgba(16,185,129,0.15); color: var(--accent-green); }
      .brvm-pill-table.down { background: rgba(239,68,68,0.15); color: var(--accent-red); }
      .brvm-pill-table.neutral { background: rgba(107,114,128,0.15); color: #9CA3AF; }
      /* ─── DRAWER COMPARAISON ─── */
      .brvm-compare-drawer {
        position: fixed;
        right: 0;
        top: 0;
        bottom: 0;
        width: 380px;
        max-width: 90vw;
        background: var(--bg-secondary);
        border-left: 1px solid var(--border-subtle);
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 200;
        display: flex;
        flex-direction: column;
        box-shadow: -10px 0 40px rgba(0,0,0,0.4);
      }
      .brvm-compare-drawer.open {
        transform: translateX(0);
      }
      .brvm-drawer-header {
        padding: 24px;
        border-bottom: 1px solid var(--border-subtle);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brvm-drawer-title {
        font-size: 1.1rem;
        font-weight: 700;
      }
      .brvm-drawer-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 4px;
      }
      .brvm-drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      .brvm-drawer-item {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
      }
      .brvm-drawer-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--border-subtle);
        display: flex;
        gap: 12px;
      }
      .brvm-btn {
        flex: 1;
        padding: 12px;
        border-radius: 10px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.9rem;
      }
      .brvm-btn-primary {
        background: linear-gradient(135deg, #D4AF37 0%, #B8941F 100%);
        color: #000;
      }
      .brvm-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(212,175,55,0.3);
      }
      .brvm-btn-secondary {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        color: var(--text-primary);
      }
      .brvm-btn-secondary:hover {
        background: var(--bg-card-hover);
      }
      .brvm-compare-trigger {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: linear-gradient(135deg, #D4AF37 0%, #B8941F 100%);
        color: #000;
        border: none;
        border-radius: 50px;
        padding: 14px 24px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 8px 30px rgba(212,175,55,0.3);
        z-index: 150;
        transition: all 0.3s;
        display: none;
        align-items: center;
        gap: 8px;
      }
      .brvm-compare-trigger.visible {
        display: flex;
        animation: bounceIn 0.5s;
      }
      .brvm-compare-trigger:hover {
        transform: scale(1.05);
      }
      @keyframes bounceIn {
        0% { transform: scale(0.3); opacity: 0; }
        50% { transform: scale(1.05); }
        70% { transform: scale(0.9); }
        100% { transform: scale(1); opacity: 1; }
      }
      .brvm-empty {
        text-align: center;
        padding: 60px 20px;
        color: var(--text-secondary);
      }
      .brvm-empty-icon {
        font-size: 3rem;
        margin-bottom: 16px;
        opacity: 0.5;
      }
    </style>
  `;

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

  // ─── EXTRACTION DYNAMIQUE DES SECTEURS ─────────────────────────────
  // Plus de tableau codé en dur ! On scanne entMap et on déduit.
  function extractDynamicSectors() {
    var sectors = new Set();
    var counts = {};

    if (typeof entMap !== "undefined" && entMap) {
      Object.keys(entMap).forEach(function (tk) {
        var ent = entMap[tk];
        if (ent && ent.secteur) {
          var s = normalizeSector(ent.secteur);
          sectors.add(s);
          counts[s] = (counts[s] || 0) + 1;
        }
      });
    }

    // Si entMap est vide ou pas de secteurs, on essaie depuis allCours
    if (sectors.size === 0 && typeof allCours !== "undefined" && Array.isArray(allCours)) {
      allCours.forEach(function (c) {
        if (c && c.secteur) {
          var s = normalizeSector(c.secteur);
          sectors.add(s);
          counts[s] = (counts[s] || 0) + 1;
        }
      });
    }

    // Tri par fréquence décroissante
    _dynamicSectors = Array.from(sectors).sort(function (a, b) {
      return (counts[b] || 0) - (counts[a] || 0);
    });

    _sectorCounts = counts;
    return _dynamicSectors;
  }

  // Normalise les noms de secteur (ex: "banque" → "Banque", "assurances" → "Assurance")
  function normalizeSector(raw) {
    if (!raw) return "Autre";
    var s = String(raw).trim().toLowerCase();
    // Singularisation basique
    if (s.endsWith("s") && s.length > 3) s = s.slice(0, -1);
    // Capitalisation
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function getSector(ticker) {
    if (typeof entMap !== "undefined" && entMap && entMap[ticker] && entMap[ticker].secteur) {
      return normalizeSector(entMap[ticker].secteur);
    }
    if (typeof getSectorOriginal === "function") return getSectorOriginal(ticker);
    return "Autre";
  }

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────────
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

      // Extraction dynamique des secteurs AVANT de rendre les filtres
      extractDynamicSectors();

      window._titresRows.forEach(function (row) {
        var ent = (typeof entMap !== "undefined" && entMap) ? entMap[row.ticker] : null;
        row._pays = (ent && ent.pays) || "CI";
        row._secteur = getSector(row.ticker);
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

  // ─── HEADER ────────────────────────────────────────────────────────
  function renderTitresHeader() {
    var container = document.getElementById("view-titres");
    if (!container) return;

    // Injecte le CSS une seule fois
    if (!document.getElementById("brvm-dark-theme")) {
      document.head.insertAdjacentHTML("beforeend", DARK_CSS);
    }

    if (container.querySelector(".brvm-header")) return;

    var paysPills = Object.keys(PAYS_NAMES).map(function (code) {
      var isActive = window._titrePaysFilter === code;
      return '<button class="brvm-pill brvm-pays-pill ' + (isActive ? 'active' : '') + '" data-pays="' + code + '">' +
        '<span class="brvm-pays-dot" style="background:' + PAYS_COLORS[code] + '"></span>' +
        PAYS_NAMES[code] +
      '</button>';
    }).join("");

    // Filtres secteurs dynamiques
    var sectorPills = _dynamicSectors.map(function (s) {
      var isActive = window._titreFilter === s;
      return '<button class="brvm-pill ' + (isActive ? 'active' : '') + '" data-sector="' + esc(s) + '">' +
        esc(s) + ' <span style="opacity:0.5;font-size:0.75em;">(' + (_sectorCounts[s] || 0) + ')</span>' +
      '</button>';
    }).join("");

    var headerHtml =
      '<div class="brvm-header">' +
        '<div class="brvm-header-top">' +
          '<div class="brvm-title">📈 Titres BRVM</div>' +
          '<div class="brvm-search-wrap">' +
            '<span class="brvm-search-icon">🔍</span>' +
            '<input class="brvm-search" id="searchTitres" placeholder="Rechercher un ticker, une société..." value="' + esc(window._titreSearch) + '">' +
          '</div>' +
          '<div class="brvm-view-toggle">' +
            '<button class="brvm-view-btn ' + (window._titreView === "cards" ? "active" : "") + '" data-view="cards">Cartes</button>' +
            '<button class="brvm-view-btn ' + (window._titreView === "table" ? "active" : "") + '" data-view="table">Tableau</button>' +
          '</div>' +
        '</div>' +
        '<div class="brvm-filters-dock">' +
          '<div class="brvm-filter-group">' +
            '<span class="brvm-filter-label">Pays</span>' +
            '<button class="brvm-pill ' + (window._titrePaysFilter === "all" ? 'active' : '') + '" data-pays="all">Tous</button>' +
            paysPills +
          '</div>' +
          '<div class="brvm-filter-group" style="margin-left:16px;">' +
            '<span class="brvm-filter-label">Secteur</span>' +
            '<button class="brvm-pill ' + (window._titreFilter === "all" ? 'active' : '') + '" data-sector="all">Tous</button>' +
            sectorPills +
          '</div>' +
          '<button class="brvm-reset" id="resetTitresBtn">↺ Réinitialiser</button>' +
        '</div>' +
      '</div>' +
      '<div id="titresResults"></div>' +
      '<button class="brvm-compare-trigger" id="compareTrigger">' +
        '<span>⚖️</span> <span id="compareTriggerText">0</span>' +
      '</button>' +
      '<div class="brvm-compare-drawer" id="compareDrawer">' +
        '<div class="brvm-drawer-header">' +
          '<div class="brvm-drawer-title">Comparaison</div>' +
          '<button class="brvm-drawer-close" id="closeDrawer">&times;</button>' +
        '</div>' +
        '<div class="brvm-drawer-body" id="compareDrawerBody"></div>' +
        '<div class="brvm-drawer-footer">' +
          '<button class="brvm-btn brvm-btn-secondary" id="clearCompareBtn">Vider</button>' +
          '<button class="brvm-btn brvm-btn-primary" id="launchCompareBtn">Comparer</button>' +
        '</div>' +
      '</div>';

    container.innerHTML = headerHtml;

    // Listeners
    document.getElementById("searchTitres").addEventListener("input", debounce(function (e) {
      window._titreSearch = e.target.value;
      filterTitres();
    }, 250));

    document.getElementById("resetTitresBtn").addEventListener("click", resetTitresFilters);

    // Délégation filtres pays
    container.querySelector(".brvm-filters-dock").addEventListener("click", function (e) {
      var pill = e.target.closest("[data-pays]");
      if (pill) {
        setPaysFilter(pill.getAttribute("data-pays"));
        return;
      }
      var sect = e.target.closest("[data-sector]");
      if (sect) {
        setTitreFilter(sect.getAttribute("data-sector"));
      }
    });

    // Toggle view
    container.querySelector(".brvm-view-toggle").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-view]");
      if (btn) setTitreView(btn.getAttribute("data-view"));
    });

    // Drawer
    document.getElementById("compareTrigger").addEventListener("click", function () {
      document.getElementById("compareDrawer").classList.add("open");
    });
    document.getElementById("closeDrawer").addEventListener("click", function () {
      document.getElementById("compareDrawer").classList.remove("open");
    });
    document.getElementById("clearCompareBtn").addEventListener("click", clearSelection);
    document.getElementById("launchCompareBtn").addEventListener("click", compareSelected);

    attachResultsListeners();
  }

  // ─── FILTRES / TRI ─────────────────────────────────────────────────
  function setTitreView(view) {
    window._titreView = view;
    document.querySelectorAll(".brvm-view-btn").forEach(function (b) {
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
    window._titreSearch = "";
    document.getElementById("searchTitres").value = "";
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

  function filterTitres() {
    var q = window._titreSearch.toLowerCase().trim();
    var rows = window._titresRows || [];

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

    var resultsContainer = document.getElementById("titresResults");
    if (!resultsContainer) return;

    if (!rows.length) {
      resultsContainer.innerHTML =
        '<div class="brvm-empty">' +
          '<div class="brvm-empty-icon">📭</div>' +
          '<div>Aucun titre ne correspond à vos critères</div>' +
        '</div>';
      updateCompareUI();
      return;
    }

    if (window._titreView === "cards") {
      resultsContainer.innerHTML = renderCardsView(rows);
      // Dessine les sparklines après injection DOM
      setTimeout(function () {
        rows.forEach(function (c) {
          var v = parseFloat(c.variation) || 0;
          var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
          drawSparkline(c.ticker, cls);
        });
      }, 0);
    } else {
      resultsContainer.innerHTML = renderTableView(rows);
    }

    updateCompareUI();
  }

  // ─── DÉLÉGATION ÉVÉNEMENTS ───────────────────────────────────────
  function attachResultsListeners() {
    var container = document.getElementById("view-titres");
    if (!container || container._listenersAttached) return;

    container.addEventListener("click", function (e) {
      if (e.target.closest(".brvm-compare") || e.target.closest("th")) return;
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

  // ─── VUE CARTES ────────────────────────────────────────────────────
  function renderCardsView(rows) {
    return '<div class="brvm-grid">' + rows.map(renderTitreCard).join("") + '</div>';
  }

  function renderTitreCard(c) {
    var v = parseFloat(c.variation) || 0;
    var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
    var sign = v > 0 ? "+" : "";
    var paysColor = PAYS_COLORS[c._pays] || "#B8964E";
    var isChecked = window._selectedForCompare.indexOf(c.ticker) !== -1;

    var badges = "";
    if (c._volumeAnormal) badges += '<span class="brvm-badge hot">🔥 Volume</span>';
    if (c._tendanceHaussiere) badges += '<span class="brvm-badge trend">📈 Tendance</span>';
    if (c._proche52Haut) badges += '<span class="brvm-badge alert">⚠️ 52H</span>';
    if (c._proche52Bas) badges += '<span class="brvm-badge alert-low">📉 52B</span>';

    return '<div class="brvm-card ' + cls + '" data-ticker="' + esc(c.ticker) + '">' +
      '<div class="brvm-card-header">' +
        '<span class="brvm-card-pays" style="color:' + paysColor + '">' + esc(PAYS_NAMES[c._pays] || c._pays) + '</span>' +
        '<div class="brvm-card-badges">' + badges + '</div>' +
      '</div>' +
      '<div class="brvm-card-ticker">' + esc(c.ticker) + '</div>' +
      '<div class="brvm-card-nom">' + esc(c._nom) + '</div>' +
      '<div class="brvm-card-price-row">' +
        '<span class="brvm-card-price">' + safeFmt(c.cours) + ' <span style="font-size:0.6em;opacity:0.6;">FCFA</span></span>' +
        '<span class="brvm-card-var ' + cls + '">' + sign + v.toFixed(2) + '%</span>' +
      '</div>' +
      '<div class="brvm-sparkline-wrap">' +
        '<canvas id="spark-' + esc(c.ticker) + '" width="240" height="50"></canvas>' +
      '</div>' +
      '<div class="brvm-card-footer">' +
        '<span class="brvm-sector-tag">' + esc(c._secteur) + '</span>' +
        '<span>Vol ' + safeFmt(c.volume) + '</span>' +
      '</div>' +
      '<div class="brvm-compare">' +
        '<label onclick="event.stopPropagation()">' +
          '<input type="checkbox" data-role="compare-toggle" data-ticker="' + esc(c.ticker) + '" ' + (isChecked ? "checked" : "") + '>' +
          '<span>Ajouter à la comparaison</span>' +
        '</label>' +
      '</div>' +
    '</div>';
  }

  // ─── SPARKLINE AVEC GRADIENT ───────────────────────────────────────
  function drawSparkline(ticker, cls) {
    var canvas = document.getElementById("spark-" + ticker);
    if (!canvas || !canvas.getContext) return;
    var hist = (_histByTicker[ticker] || []).slice(-30);
    if (hist.length < 2) return;

    var values = hist.map(function (h) { return parseFloat(h.cours_cloture || h.cours || 0); });
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height, pad = 4;

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

    // Fill gradient
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    var color = cls === "up" ? "16,185,129" : cls === "down" ? "239,68,68" : "107,114,128";
    grad.addColorStop(0, "rgba(" + color + ",0.2)");
    grad.addColorStop(1, "rgba(" + color + ",0.0)");

    ctx.beginPath();
    ctx.moveTo(points[0].x, h - pad);
    points.forEach(function (p) { ctx.lineTo(p.x, p.y); });
    ctx.lineTo(points[points.length - 1].x, h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = "rgb(" + color + ")";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Glow point at end
    var last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(" + color + ")";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + color + ",0.3)";
    ctx.fill();
  }

  // ─── VUE TABLEAU ───────────────────────────────────────────────────
  function sortArrow(field) {
    var sort = window._titreSort;
    if (sort.field !== field) return "";
    return sort.dir === 1 ? "sort-asc" : "sort-desc";
  }

  function renderTableView(rows) {
    return '<div class="brvm-table-wrap">' +
      '<table class="brvm-table">' +
        '<thead><tr>' +
          '<th>Pays</th>' +
          '<th data-field="ticker" class="sortable ' + sortArrow("ticker") + '">Ticker</th>' +
          '<th data-field="_nom" class="sortable ' + sortArrow("_nom") + '">Société</th>' +
          '<th data-field="cours" class="right sortable ' + sortArrow("cours") + '">Cours</th>' +
          '<th data-field="variation" class="right sortable ' + sortArrow("variation") + '">Variation</th>' +
          '<th data-field="volume" class="right sortable ' + sortArrow("volume") + '">Volume</th>' +
          '<th data-field="capitalisation" class="right sortable ' + sortArrow("capitalisation") + '">Cap.</th>' +
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

    return '<tr data-ticker="' + esc(c.ticker) + '">' +
      '<td><span class="brvm-pays-dot" style="background:' + paysColor + '" title="' + esc(PAYS_NAMES[c._pays] || "") + '"></span></td>' +
      '<td style="font-weight:700;">' + esc(c.ticker) + '</td>' +
      '<td>' + esc(c._nom) + '</td>' +
      '<td class="right" style="font-weight:600;">' + safeFmt(c.cours) + '</td>' +
      '<td class="right"><span class="brvm-pill-table ' + cls + '">' + sign + v.toFixed(2) + '%</span></td>' +
      '<td class="right">' + safeFmt(c.volume) + '</td>' +
      '<td class="right">' + (c.capitalisation ? safeFmtM(c.capitalisation) : "—") + '</td>' +
      '<td><span class="brvm-sector-tag">' + esc(c._secteur) + '</span></td>' +
      '<td><label onclick="event.stopPropagation()">' +
        '<input type="checkbox" data-role="compare-toggle" data-ticker="' + esc(c.ticker) + '" ' + (isChecked ? "checked" : "") + ' style="accent-color:#D4AF37;width:16px;height:16px;">' +
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
        drawerBody.innerHTML = '<div style="color:var(--text-secondary);text-align:center;padding:40px 20px;">Sélectionnez des titres pour comparer</div>';
      } else {
        drawerBody.innerHTML = window._selectedForCompare.map(function (tk) {
          var row = (window._titresRows || []).find(function (r) { return r.ticker === tk; });
          if (!row) return "";
          var v = parseFloat(row.variation) || 0;
          var cls = v > 0 ? "up" : v < 0 ? "down" : "neutral";
          var sign = v > 0 ? "+" : "";
          return '<div class="brvm-drawer-item">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<div style="font-weight:700;">' + esc(row.ticker) + '</div>' +
              '<div style="font-size:0.85rem;color:var(--text-secondary);">' + esc(row._nom) + '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
              '<span style="font-size:1.1rem;font-weight:700;">' + safeFmt(row.cours) + ' FCFA</span>' +
              '<span class="brvm-pill-table ' + cls + '">' + sign + v.toFixed(2) + '%</span>' +
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
      if (typeof toast === "function") toast("Sélectionnez au moins 2 titres", "warning");
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

})();
