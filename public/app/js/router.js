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

  if (window.__TC_CLOCK_INTERVAL__) clearInterval(window.__TC_CLOCK_INTERVAL__);
  window.__TC_CLOCK_INTERVAL__ = clockInterval;

  window.TITLES = {
    overview: "Vue d'ensemble — BRVM",
    titres: 'Titres BRVM',
    boc: 'BOC — Bulletin Officiel',
    marche: 'Marché BRVM',
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

  window.BREADCRUMBS = {
    overview: [{ label: 'Tableau de bord', view: 'overview' }],
    titres: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Titres BRVM', view: 'titres' }],
    fiche: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Titres BRVM', view: 'titres' }, { label: 'Fiche', view: 'fiche' }],
    boc: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'BOC', view: 'boc' }],
    marche: [{ label: 'Tableau de bord', view: 'overview' }, { label: 'Marché BRVM', view: 'marche' }],
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

  window.nav = function(id, noHash) {
    // Marché BRVM est une page standalone : l'ancien routeur essayait de
    // traiter "marche" comme une vue interne inexistante, ce qui rendait
    // l'entrée de sidebar non fonctionnelle.
    if (id === 'marche') {
      window.location.href = 'marche.html';
      return;
    }

    if (typeof destroyAllCharts === 'function') destroyAllCharts();

    document.querySelectorAll('.nav-dropdown-item, .nav-dropdown-btn').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });

    const v = document.getElementById('view-' + id);
    if (v) {
      v.classList.add('active');
      v.style.display = '';
    }

    const navEl = document.getElementById('nav-' + id);
    if (navEl) navEl.classList.add('active');

    const parentMenu = navEl?.closest('.nav-dropdown');
    if (parentMenu) {
      const parentBtn = parentMenu.querySelector('.nav-dropdown-btn');
      if (parentBtn) parentBtn.classList.add('active');
    }

    if (!noHash) setHashForView(id);

    setTimeout(() => callViewRender(id), 50);

    const searchResults = document.getElementById('globalSearchResults');
    if (searchResults) searchResults.classList.remove('open');
    if (typeof closeDropdowns === 'function') closeDropdowns();
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb(id);
  };

  function callViewRender(viewId) {
    const renderMap = {
      overview: 'renderOverview',
      titres: 'renderTitres',
      boc: 'renderBOC',
      analyses: 'renderAnalyses',
      'analyse-detail': 'renderAnalyseDetail',
      'analyse-technique': 'renderAnalyseTechnique',
      'analyse-fondamentale': 'renderAnalyseFondamentale',
      screener: 'renderScreener',
      portefeuille: 'renderPortfolio',
      alertes: 'renderAlertes',
      financials: 'renderFinancials',
      'financials-detail': 'renderFinancialsDetail',
      fiche: 'renderFiche',
      publications: 'renderPublications',
      formation: 'renderFormation'
    };

    const fnName = renderMap[viewId];
    if (fnName && typeof window[fnName] === 'function') {
      try { window[fnName](); }
      catch (err) { console.error(`[ROUTER] Erreur render ${viewId}:`, err); }
    }
  }

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

  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains('open');
    sidebar.classList.toggle('open', !isOpen);
    if (overlay) overlay.classList.toggle('open', !isOpen);
  };

  window.closeSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  };

  window.updateBreadcrumb = function(viewId) {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;
    const items = BREADCRUMBS[viewId] || BREADCRUMBS.overview;
    bc.innerHTML = items.map((item, i) => {
      if (i === items.length - 1) return `<span class="bc-current">${escapeHtml(item.label)}</span>`;
      return `<a href="#${item.view}" onclick="nav('${item.view}');return false;">${escapeHtml(item.label)}</a><span class="bc-sep">›</span>`;
    }).join('');
  };

  window.setHashForView = function(id) {
    const hashMap = {
      overview: '', titres: '#titres', boc: '#boc', analyses: '#analyses',
      'analyse-detail': '#analyse-detail', 'analyse-technique': '#analyse-technique',
      'analyse-fondamentale': '#analyse-fondamentale', screener: '#screener',
      portefeuille: '#portefeuille', alertes: '#alertes', financials: '#financials',
      'financials-detail': '#financials-detail', fiche: '#fiche',
      publications: '#publications', formation: '#formation'
    };
    const h = hashMap[id] || '';
    if (h !== location.hash) history.replaceState(null, '', h || location.pathname);
    const title = TITLES[id];
    if (title) document.title = title + ' — The Capital';
  };

  window.parseHash = function() {
    const h = location.hash;
    if (h.startsWith('#fiche=')) {
      const ticker = decodeURIComponent(h.replace('#fiche=', ''));
      if (typeof openFiche === 'function') openFiche(ticker, 'titres', true);
      return;
    }
    if (h.startsWith('#analyse=')) {
      const id = h.replace('#analyse=', '');
      if (typeof openAnalyseDetail === 'function') openAnalyseDetail(+id, true);
      return;
    }
    const map = {
      '#titres': 'titres', '#boc': 'boc', '#analyses': 'analyses',
      '#analyse-detail': 'analyse-detail', '#analyse-technique': 'analyse-technique',
      '#analyse-fondamentale': 'analyse-fondamentale', '#screener': 'screener',
      '#portefeuille': 'portefeuille', '#alertes': 'alertes', '#financials': 'financials',
      '#financials-detail': 'financials-detail', '#publications': 'publications', '#formation': 'formation'
    };
    const view = map[h] || 'overview';
    if (typeof nav === 'function') nav(view, true);
  };

  window.escapeHtml = function(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  };

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
