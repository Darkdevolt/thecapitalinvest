// ═══════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// CLOCK & NAV
// ═══════════════════════════════════════
setInterval(() => {
  document.getElementById('headerTime').textContent =
    new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' GMT';
}, 1000);

const TITLES = {
  overview:'Vue d\'ensemble — BRVM',
  titres:'Titres BRVM',
  boc:'BOC — Bulletin Officiel',
  analyses:'Recommandations',
  'analyse-fondamentale':'Analyse Fondamentale',
  'analyse-detail':'Détail Analyse',
  'analyse-technique':'Analyse Technique',
  screener:'Screener BRVM',
  portefeuille:'Portefeuille',
  alertes:'Alertes de Prix',
  financials:'États Financiers',
  'financials-detail':'Détail Financier',
  fiche:'Fiche Titre',
  publications:'Calendrier des Publications',
  formation:'Formation BRVM'
};

const BREADCRUMBS = {
  overview: [{label:'Tableau de bord', view:'overview'}],
  titres: [{label:'Tableau de bord', view:'overview'}, {label:'Titres BRVM', view:'titres'}],
  fiche: [{label:'Tableau de bord', view:'overview'}, {label:'Titres BRVM', view:'titres'}, {label:'Fiche', view:'fiche'}],
  boc: [{label:'Tableau de bord', view:'overview'}, {label:'BOC', view:'boc'}],
  analyses: [{label:'Tableau de bord', view:'overview'}, {label:'Recommandations', view:'analyses'}],
  'analyse-detail': [{label:'Tableau de bord', view:'overview'}, {label:'Analyses', view:'analyses'}, {label:'Détail', view:'analyse-detail'}],
  'analyse-technique': [{label:'Tableau de bord', view:'overview'}, {label:'Analyse Technique', view:'analyse-technique'}],
  screener: [{label:'Tableau de bord', view:'overview'}, {label:'Screener', view:'screener'}],
  'analyse-fondamentale': [{label:'Tableau de bord', view:'overview'}, {label:'Analyse Fondamentale', view:'analyse-fondamentale'}],
  portefeuille: [{label:'Tableau de bord', view:'overview'}, {label:'Portefeuille', view:'portefeuille'}],
  alertes: [{label:'Tableau de bord', view:'overview'}, {label:'Alertes', view:'alertes'}],
  financials: [{label:'Tableau de bord', view:'overview'}, {label:'États Financiers', view:'financials'}],
  'financials-detail': [{label:'Tableau de bord', view:'overview'}, {label:'États Financiers', view:'financials'}, {label:'Détail', view:'financials-detail'}],
  publications: [{label:'Tableau de bord', view:'overview'}, {label:'Calendrier', view:'publications'}],
  formation: [{label:'Tableau de bord', view:'overview'}, {label:'Formation', view:'formation'}]
};

function nav(id, noHash) {
  document.querySelectorAll('.nav-dropdown-item, .nav-dropdown-btn').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
   const v = document.getElementById('view-' + id);
  if (v) {
    v.classList.add('active');
    v.style.display = '';
  }
  const navEl = document.getElementById('nav-' + id);
  if (navEl) navEl.classList.add('active');
  // Activer aussi le bouton parent dropdown
  const parentMenu = navEl?.closest('.nav-dropdown');
  if (parentMenu) {
    const parentBtn = parentMenu.querySelector('.nav-dropdown-btn');
    if (parentBtn) parentBtn.classList.add('active');
  }
  if (!noHash) setHashForView(id);

  // Appeler le render spécifique à la vue
  if (id === 'portefeuille' && typeof renderPortfolio === 'function') {
    setTimeout(() => renderPortfolio(), 50); // petit délai pour s'assurer que le DOM est prêt
  }
  document.getElementById('globalSearchResults').classList.remove('open');
  closeDropdowns();
  updateBreadcrumb(id);
}
  function toggleDropdown(id) {
  const dd = document.getElementById(id);
  const menu = document.getElementById('menu-' + id);
  const btn = dd.querySelector('.nav-dropdown-btn');
  const isOpen = menu.classList.contains('open');
  closeDropdowns();
  if (!isOpen) {
    menu.classList.add('open');
    btn.classList.add('open');
  }
}

function closeDropdowns() {
  document.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.nav-dropdown-btn').forEach(b => b.classList.remove('open'));
}

// Fermer dropdowns au clic extérieur

// ═══════════════════════════════════════
// HELPERS UI
// ═══════════════════════════════════════
function toggleSidebar() {
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
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.nav-dropdown') && !e.target.closest('.topnav-logo')) {
    closeDropdowns();
  }
});
function updateBreadcrumb(viewId) {
  const bc = document.getElementById('breadcrumb');
  const items = BREADCRUMBS[viewId] || BREADCRUMBS['overview'];
  bc.innerHTML = items.map((item, i) => {
    if (i === items.length - 1) return `<span>${item.label}</span>`;
    return `<a onclick="nav('${item.view}')">${item.label}</a><span>›</span>`;
  }).join('');
}

function setHashForView(id) {
  const hashMap = { overview:'', titres:'#titres', boc:'#boc', analyses:'#analyses', 'analyse-detail':'#analyse-detail', 'analyse-technique':'#analyse-technique', 'analyse-fondamentale':'#analyse-fondamentale', screener:'#screener', portefeuille:'#portefeuille', alertes:'#alertes', financials:'#financials', 'financials-detail':'#financials-detail', fiche:'#fiche', publications:'#publications', formation:'#formation' };
  const h = hashMap[id] || '';
  if (h !== location.hash) history.replaceState(null, '', h || location.pathname);
}

function parseHash() {
  const h = location.hash;
  if (h.startsWith('#fiche=')) {
    const ticker = h.replace('#fiche=', '');
    openFiche(ticker, 'titres', true);
    return;
  }
  if (h.startsWith('#analyse=')) {
    const id = h.replace('#analyse=', '');
    openAnalyseDetail(+id, true);
    return;
  }
  const map = { '#titres':'titres', '#boc':'boc', '#analyses':'analyses', '#analyse-detail':'analyse-detail', '#analyse-technique':'analyse-technique', '#analyse-fondamentale':'analyse-fondamentale', '#screener':'screener', '#portefeuille':'portefeuille', '#alertes':'alertes', '#financials':'financials', '#financials-detail':'financials-detail', '#publications':'publications', '#formation':'formation' };
  const view = map[h] || 'overview';
  nav(view, true);
}
