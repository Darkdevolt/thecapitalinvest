// ═══════════════════════════════════════
// ROUTER — The Capital BRVM
// ═══════════════════════════════════════
// Guard pattern: empêche le double chargement
(function() {
  if (window.__TC_ROUTER_LOADED__) {
    console.log('[ROUTER] Déjà chargé, skip.');
    return;
  }
  window.__TC_ROUTER_LOADED__ = true;

  // ═══════════════════════════════════════
  // CLOCK & NAV
  // ═══════════════════════════════════════
  const clockInterval = setInterval(() => {
    const el = document.getElementById('headerTime');
    if (el) {
      el.textContent = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }) + ' GMT';
    }
  }, 1000);

  // Nettoyer l'intervalle si rechargé
  if (window.__TC_CLOCK_INTERVAL__) {
    clearInterval(window.__TC_CLOCK_INTERVAL__);
  }
  window.__TC_CLOCK_INTERVAL__ = clockInterval;

  // ═══════════════════════════════════════
  // TITRES DES PAGES
  // ═══════════════════════════════════════
  window.TITLES = {
    overview: "Vue d'ensemble — BRVM",
    titres: 'Titres BRVM',
    boc: 'BOC — Bulletin Officiel',
    analyses: 'Recommandations',
    'analyse-fondamentale': 'Analyse Fondamentale',
    'analyse-detail': 'Détail Analyse',
    'analyse-technique': 'Analyse Technique',
    screener: 'Screener BRVM',
    portefeuille: 'Portefeuille',
    alertes: 'Alertes de Prix',
    financials: 'États Financiers',
    'financials-detail': 'Détail Financier',
    fiche: 'Fiche Titre',
    publications: 'Calendrier des Publications',
    formation: 'Formation BRVM'
  };

  // ═══════════════════════════════════════
  // BREADCRUMBS
  // ═══════════════════════════════════════
  window.BREADCRUMBS = {
    overview: [{ label: 'Tableau de bord', view: 'overview' }],
    titres: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Titres BRVM', view: 'titres' }],
    fiche: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Titres BRVM', view: 'titres' }, { label: 'Fiche', view: 'fiche' }],
    boc: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'BOC', view: 'boc' }],
    analyses: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Recommandations', view: 'analyses' }],
    'analyse-detail': [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Analyses', view: 'analyses' }, { label: 'Détail', view: 'analyse-detail' }],
    'analyse-technique': [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Analyse Technique', view: 'analyse-technique' }],
    screener: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Screener', view: 'screener' }],
    'analyse-fondamentale': [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Analyse Fondamentale', view: 'analyse-fondamentale' }],
    portefeuille: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Portefeuille', view: 'portefeuille' }],
    alertes: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Alertes', view: 'alertes' }],
    financials: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'États Financiers', view: 'financials' }],
    'financials-detail': [{ label: 'Tableau de bord', view: 'overview' }, { label: 'États Financiers', view: 'financials' }, { label: 'Détail', view: 'financials-detail' }],
    publications: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Calendrier', view: 'publications' }],
    formation: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Formation', view: 'formation' }]
  };

  // ═══════════════════════════════════════
  // NAVIGATION PRINCIPALE
  // ═══════════════════════════════════════
  window.nav = function(id, noHash) {
    // Détruire les charts avant de changer de vue (évite fuites mémoire)
    if (typeof destroyAllCharts === 'function') {
      destroyAllCharts();
    }

    // Reset nav active
    document.querySelectorAll('.nav-dropdown-item, .nav-dropdown-btn').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });

    // Activer la vue
    const v = document.getElementById('view-' + id);
    if (v) {
      v.classList.add('active');
      v.style.display = '';
    }

    // Activer nav item
    const navEl = document.getElementById('nav-' + id);
    if (navEl) navEl.classList.add('active');

    // Activer parent dropdown
    const parentMenu = navEl?.closest('.nav-dropdown');
    if (parentMenu) {
      const parentBtn = parentMenu.querySelector('.nav-dropdown-btn');
      if (parentBtn) parentBtn.classList.add('active');
    }

    // Update hash
    if (!noHash) setHashForView(id);

    // Appeler le render spécifique à la vue (avec vérification)
    setTimeout(() => {
      callViewRender(id);
    }, 50);

    // Fermer overlays
    const searchResults = document.getElementById('globalSearchResults');
    if (searchResults) searchResults.classList.remove('open');
    if (typeof closeDropdowns === 'function') closeDropdowns();
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb(id);
  };

  // ═══════════════════════════════════════
  // RENDER DISPATCHER (centralisé)
  // ═══════════════════════════════════════
  function callViewRender(viewId) {
    const renderMap = {
      'overview': 'renderOverview',
      'titres': 'renderTitres',
      'boc': 'renderBOC',
      'analyses': 'renderAnalyses',
      'analyse-detail': 'renderAnalyseDetail',
      'analyse-technique': 'renderAnalyseTechnique',
      'analyse-fondamentale': 'renderAnalyseFondamentale',
      'screener': 'renderScreener',
      'portefeuille': 'renderPortfolio',
      'alertes': 'renderAlertes',
      'financials': 'renderFinancials',
      'financials-detail': 'renderFinancialsDetail',
      'fiche': 'renderFiche',
      'publications': 'renderPublications',
      'formation': 'renderFormation'
    };

    const fnName = renderMap[viewId];
    if (fnName && typeof window[fnName] === 'function') {
      try {
        window[fnName]();
      } catch (err) {
        console.error(`[ROUTER] Erreur render ${viewId}:`, err);
      }
    }
  }

  // ═══════════════════════════════════════
  // DROPDOWNS
  // ═══════════════════════════════════════
  window.toggleDropdown = function(id) {
    const dd = document.getElementById(id);
    if (!dd) return;
    const menu = document.getElementById('menu-' + id);
    const btn = dd.querySelector('.nav-dropdown-btn');
    if (!menu || !btn) return;

    const isOpen = menu.classList.contains('open');
    if (typeof closeDropdowns === 'function') closeDropdowns();
    if (!isOpen) {
      menu.classList.add('open');
      btn.classList.add('open');
    }
  };

  window.closeDropdowns = function() {
    document.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.nav-dropdown-btn').forEach(b => b.classList.remove('open'));
  };

  // ═══════════════════════════════════════
  // SIDEBAR
  // ═══════════════════════════════════════
  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    } else {
      sidebar.classList.add('open');
      if (overlay) overlay.classList.add('open');
    }
  };

  window.closeSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  };

  // ═══════════════════════════════════════
  // BREADCRUMB
  // ═══════════════════════════════════════
  window.updateBreadcrumb = function(viewId) {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;

    const items = BREADCRUMBS[viewId] || BREADCRUMBS['overview'];
    bc.innerHTML = items.map((item, i) => {
      if (i === items.length - 1) {
        return `<span class="bc-current">${escapeHtml(item.label)}</span>`;
      }
      return `<a href="#${item.view}" onclick="nav('${item.view}');return false;">${escapeHtml(item.label)}</a><span class="bc-sep">›</span>`;
    }).join('');
  };

  // ═══════════════════════════════════════
  // HASH MANAGEMENT
  // ═══════════════════════════════════════
  window.setHashForView = function(id) {
    const hashMap = {
      overview: '',
      titres: '#titres',
      boc: '#boc',
      analyses: '#analyses',
      'analyse-detail': '#analyse-detail',
      'analyse-technique': '#analyse-technique',
      'analyse-fondamentale': '#analyse-fondamentale',
      screener: '#screener',
      portefeuille: '#portefeuille',
      alertes: '#alertes',
      financials: '#financials',
      'financials-detail': '#financials-detail',
      fiche: '#fiche',
      publications: '#publications',
      formation: '#formation'
    };

    const h = hashMap[id] || '';
    if (h !== location.hash) {
      history.replaceState(null, '', h || location.pathname);
    }

    // Update page title
    const title = TITLES[id];
    if (title) {
      document.title = title + ' — The Capital';
    }
  };

  window.parseHash = function() {
    const h = location.hash;

    // Fiche spécifique
    if (h.startsWith('#fiche=')) {
      const ticker = decodeURIComponent(h.replace('#fiche=', ''));
      if (typeof openFiche === 'function') {
        openFiche(ticker, 'titres', true);
      }
      return;
    }

    // Analyse spécifique
    if (h.startsWith('#analyse=')) {
      const id = h.replace('#analyse=', '');
      if (typeof openAnalyseDetail === 'function') {
        openAnalyseDetail(+id, true);
      }
      return;
    }

    // Vue standard
    const map = {
      '#titres': 'titres',
      '#boc': 'boc',
      '#analyses': 'analyses',
      '#analyse-detail': 'analyse-detail',
      '#analyse-technique': 'analyse-technique',
      '#analyse-fondamentale': 'analyse-fondamentale',
      '#screener': 'screener',
      '#portefeuille': 'portefeuille',
      '#alertes': 'alertes',
      '#financials': 'financials',
      '#financials-detail': 'financials-detail',
      '#publications': 'publications',
      '#formation': 'formation'
    };

    const view = map[h] || 'overview';
    if (typeof nav === 'function') {
      nav(view, true);
    }
  };

  // ═══════════════════════════════════════
  // HTML ESCAPE (sécurité XSS)
  // ═══════════════════════════════════════
  window.escapeHtml = function(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  };

  // ═══════════════════════════════════════
  // EVENT LISTENERS (déclarés une seule fois)
  // ═══════════════════════════════════════
  if (!window.__TC_ROUTER_EVENTS__) {
    window.__TC_ROUTER_EVENTS__ = true;

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.nav-dropdown') && !e.target.closest('.topnav-logo')) {
        if (typeof closeDropdowns === 'function') closeDropdowns();
      }
    });
  }

  console.log('[ROUTER] Chargé avec succès');

})();
