// THE CAPITAL — Single Application Router
// Une seule navigation pour toutes les vues de l'application.
(function () {
  if (window.__TC_ROUTER_LOADED__) return;
  window.__TC_ROUTER_LOADED__ = true;

  const clockInterval = setInterval(() => {
    const el = document.getElementById('headerTime');
    if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' GMT';
  }, 1000);
  if (window.__TC_CLOCK_INTERVAL__) clearInterval(window.__TC_CLOCK_INTERVAL__);
  window.__TC_CLOCK_INTERVAL__ = clockInterval;

  window.TITLES = {
    overview: "Vue d'ensemble — BRVM", titres: 'Titres BRVM', boc: 'BOC — Bulletin Officiel',
    marche: 'Marché BRVM', analyses: 'Recommandations', 'analyse-fondamentale': 'Analyse Fondamentale',
    'analyse-detail': 'Détail Analyse', 'analyse-technique': 'Analyse Technique', screener: 'Screener BRVM',
    portefeuille: 'Portefeuille', alertes: 'Alertes de Prix', financials: 'États Financiers',
    'financials-detail': 'Détail Financier', fiche: 'Fiche Titre', publications: 'Calendrier des Publications',
    formation: 'Formation BRVM'
  };

  window.BREADCRUMBS = {
    overview: [{label:'Tableau de bord',view:'overview'}],
    titres: [{label:'Tableau de bord',view:'overview'},{label:'Titres BRVM',view:'titres'}],
    fiche: [{label:'Tableau de bord',view:'overview'},{label:'Titres BRVM',view:'titres'},{label:'Fiche',view:'fiche'}],
    boc: [{label:'Tableau de bord',view:'overview'},{label:'BOC',view:'boc'}],
    marche: [{label:'Tableau de bord',view:'overview'},{label:'Marché BRVM',view:'marche'}],
    analyses: [{label:'Tableau de bord',view:'overview'},{label:'Recommandations',view:'analyses'}],
    'analyse-detail': [{label:'Tableau de bord',view:'overview'},{label:'Analyses',view:'analyses'},{label:'Détail',view:'analyse-detail'}],
    'analyse-technique': [{label:'Tableau de bord',view:'overview'},{label:'Analyse Technique',view:'analyse-technique'}],
    'analyse-fondamentale': [{label:'Tableau de bord',view:'overview'},{label:'Analyse Fondamentale',view:'analyse-fondamentale'}],
    screener: [{label:'Tableau de bord',view:'overview'},{label:'Screener',view:'screener'}],
    portefeuille: [{label:'Tableau de bord',view:'overview'},{label:'Portefeuille',view:'portefeuille'}],
    alertes: [{label:'Tableau de bord',view:'overview'},{label:'Alertes',view:'alertes'}],
    financials: [{label:'Tableau de bord',view:'overview'},{label:'États Financiers',view:'financials'}],
    'financials-detail': [{label:'Tableau de bord',view:'overview'},{label:'États Financiers',view:'financials'},{label:'Détail',view:'financials-detail'}],
    publications: [{label:'Tableau de bord',view:'overview'},{label:'Calendrier',view:'publications'}],
    formation: [{label:'Tableau de bord',view:'overview'},{label:'Formation',view:'formation'}]
  };

  const renderMap = {
    overview:'renderOverview', titres:'renderTitres', boc:'renderBOC', marche:'renderMarche', analyses:'renderAnalyses',
    'analyse-detail':'renderAnalyseDetail', 'analyse-technique':'renderAnalyseTechnique',
    'analyse-fondamentale':'renderAnalyseFondamentale', screener:'renderScreener', portefeuille:'renderPortfolio',
    alertes:'renderAlertes', financials:'renderFinancials', 'financials-detail':'renderFinancialsDetail',
    fiche:'renderFiche', publications:'renderPublications', formation:'renderFormation'
  };

  window.nav = function (id, noHash) {
    const view = document.getElementById('view-' + id);
    if (!view) {
      console.warn('[ROUTER] Vue introuvable:', id);
      return false;
    }

    if (typeof destroyAllCharts === 'function') destroyAllCharts();
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
    document.querySelectorAll('.nav-dropdown-item, .nav-dropdown-btn').forEach(el => el.classList.remove('active'));

    view.classList.add('active');
    view.style.display = '';
    const navEl = document.getElementById('nav-' + id);
    if (navEl) navEl.classList.add('active');
    const parentMenu = navEl?.closest('.nav-dropdown');
    if (parentMenu) parentMenu.querySelector('.nav-dropdown-btn')?.classList.add('active');

    if (!noHash) setHashForView(id);
    setTimeout(() => {
      const fn = window[renderMap[id]];
      if (typeof fn === 'function') {
        try { fn(); } catch (err) { console.error('[ROUTER] Render ' + id + ':', err); }
      }
    }, 30);

    document.getElementById('globalSearchResults')?.classList.remove('open');
    if (typeof closeDropdowns === 'function') closeDropdowns();
    updateBreadcrumb(id);
    if (typeof closeSidebar === 'function') closeSidebar();
    return true;
  };

  window.toggleDropdown = function (id) {
    const dd = document.getElementById(id), menu = document.getElementById('menu-' + id), btn = dd?.querySelector('.nav-dropdown-btn');
    if (!menu || !btn) return;
    const open = menu.classList.contains('open');
    closeDropdowns();
    if (!open) { menu.classList.add('open'); btn.classList.add('open'); }
  };
  window.closeDropdowns = function () {
    document.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.nav-dropdown-btn').forEach(b => b.classList.remove('open'));
  };
  window.toggleSidebar = function () {
    const s=document.getElementById('sidebar'),o=document.getElementById('overlay'); if(!s)return;
    const open=s.classList.contains('open'); s.classList.toggle('open',!open); o?.classList.toggle('open',!open);
  };
  window.closeSidebar = function () { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('overlay')?.classList.remove('open'); };

  window.updateBreadcrumb = function (viewId) {
    const bc=document.getElementById('breadcrumb'); if(!bc)return;
    const items=BREADCRUMBS[viewId]||BREADCRUMBS.overview;
    bc.innerHTML=items.map((item,i)=>i===items.length-1?`<span class="bc-current">${escapeHtml(item.label)}</span>`:`<a href="#${item.view}" onclick="nav('${item.view}');return false;">${escapeHtml(item.label)}</a><span class="bc-sep">›</span>`).join('');
  };

  window.setHashForView = function (id) {
    const hashMap={overview:'',titres:'#titres',boc:'#boc',marche:'#marche',analyses:'#analyses','analyse-detail':'#analyse-detail','analyse-technique':'#analyse-technique','analyse-fondamentale':'#analyse-fondamentale',screener:'#screener',portefeuille:'#portefeuille',alertes:'#alertes',financials:'#financials','financials-detail':'#financials-detail',fiche:'#fiche',publications:'#publications',formation:'#formation'};
    const h=hashMap[id]||''; if(h!==location.hash) history.replaceState(null,'',h||location.pathname); if(TITLES[id]) document.title=TITLES[id]+' — The Capital';
  };

  window.parseHash = function () {
    const h=location.hash;
    if(h.startsWith('#fiche=')){ const t=decodeURIComponent(h.slice(7)); if(typeof openFiche==='function')openFiche(t,'titres',true); return; }
    if(h.startsWith('#analyse=')){ const id=h.slice(9); if(typeof openAnalyseDetail==='function')openAnalyseDetail(+id,true); return; }
    const map={'#titres':'titres','#boc':'boc','#marche':'marche','#analyses':'analyses','#analyse-detail':'analyse-detail','#analyse-technique':'analyse-technique','#analyse-fondamentale':'analyse-fondamentale','#screener':'screener','#portefeuille':'portefeuille','#alertes':'alertes','#financials':'financials','#financials-detail':'financials-detail','#publications':'publications','#formation':'formation'};
    nav(map[h]||'overview',true);
  };

  window.escapeHtml = function (text) { const d=document.createElement('div'); d.textContent=text==null?'':String(text); return d.innerHTML; };
  if(!window.__TC_ROUTER_EVENTS__){
    window.__TC_ROUTER_EVENTS__=true;
    document.addEventListener('click',e=>{if(!e.target.closest('.nav-dropdown')&&!e.target.closest('.topnav-logo'))closeDropdowns();});
  }
  console.log('[ROUTER] Single-app router chargé');
})();
