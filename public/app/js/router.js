// THE CAPITAL — Single Application Router
(function () {
  'use strict';
  if (window.__TC_ROUTER_LOADED__) return;
  window.__TC_ROUTER_LOADED__ = true;

  window.TITLES = {
    overview:"Vue d'ensemble, BRVM", titres:'Titres BRVM', boc:'BOC, Bulletin Officiel', marche:'Marché BRVM', analyses:'Recommandations',
    'analyse-fondamentale':'Analyse Fondamentale','analyse-detail':'Détail Analyse','analyse-technique':'Analyse Technique', screener:'Screener BRVM',
    portefeuille:'Portefeuille', alertes:'Alertes de Prix', financials:'États Financiers','financials-detail':'Détail Financier', fiche:'Fiche Titre',
    publications:'Calendrier des Publications', comparison:'Comparateur de valeurs','dividend-screener':'Screener Dividendes',
    backtest:'Backtesting BRVM', outils:'Outils & Simulateurs'
  };

  window.BREADCRUMBS = {
    overview:[{label:'Tableau de bord',view:'overview'}],
    titres:[{label:'Tableau de bord',view:'overview'},{label:'Titres BRVM',view:'titres'}],
    fiche:[{label:'Tableau de bord',view:'overview'},{label:'Titres BRVM',view:'titres'},{label:'Fiche',view:'fiche'}],
    boc:[{label:'Tableau de bord',view:'overview'},{label:'BOC',view:'boc'}],
    marche:[{label:'Tableau de bord',view:'overview'},{label:'Marché BRVM',view:'marche'}],
    analyses:[{label:'Tableau de bord',view:'overview'},{label:'Recommandations',view:'analyses'}],
    'analyse-detail':[{label:'Tableau de bord',view:'overview'},{label:'Analyses',view:'analyses'},{label:'Détail',view:'analyse-detail'}],
    'analyse-technique':[{label:'Tableau de bord',view:'overview'},{label:'Analyse Technique',view:'analyse-technique'}],
    'analyse-fondamentale':[{label:'Tableau de bord',view:'overview'},{label:'Analyse Fondamentale',view:'analyse-fondamentale'}],
    screener:[{label:'Tableau de bord',view:'overview'},{label:'Screener',view:'screener'}],
    portefeuille:[{label:'Tableau de bord',view:'overview'},{label:'Portefeuille',view:'portefeuille'}],
    alertes:[{label:'Tableau de bord',view:'overview'},{label:'Alertes',view:'alertes'}],
    financials:[{label:'Tableau de bord',view:'overview'},{label:'États Financiers',view:'financials'}],
    'financials-detail':[{label:'Tableau de bord',view:'overview'},{label:'États Financiers',view:'financials'},{label:'Détail',view:'financials-detail'}],
    publications:[{label:'Tableau de bord',view:'overview'},{label:'Calendrier',view:'publications'}],
    comparison:[{label:'Tableau de bord',view:'overview'},{label:'Comparateur',view:'comparison'}],
    'dividend-screener':[{label:'Tableau de bord',view:'overview'},{label:'Screener Dividendes',view:'dividend-screener'}],
    backtest:[{label:'Tableau de bord',view:'overview'},{label:'Backtesting',view:'backtest'}],
    outils:[{label:'Tableau de bord',view:'overview'},{label:'Outils & Simulateurs',view:'outils'}]
  };

  window.renderMap = {
    overview:'renderOverview', titres:'renderTitres', boc:'renderBOC', marche:'renderMarche', analyses:'renderAnalyses',
    'analyse-detail':'renderAnalyseDetail','analyse-technique':'renderAnalyseTechnique','analyse-fondamentale':'renderAnalyseFondamentale',
    screener:'renderScreener', portefeuille:'renderPortfolio', alertes:'renderAlertes', financials:'renderFinancials','financials-detail':'renderFinancialsDetail',
    fiche:'renderFiche', publications:'renderPublications', comparison:'renderComparison','dividend-screener':'renderDividendScreener',
    backtest:'renderBacktest', outils:'renderOutils'
  };

  function injectDashboardStability(){
    if(document.getElementById('tc-dashboard-stability')) return;
    const style=document.createElement('style');
    style.id='tc-dashboard-stability';
    style.textContent=`
      #view-overview{min-width:0!important}
      #view-overview #overviewStats{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:16px!important;width:100%!important;min-width:0!important;align-items:stretch!important}
      #view-overview #overviewStats .stat-card{height:auto!important;min-height:122px!important;min-width:0!important;overflow:hidden!important;box-sizing:border-box!important;padding:18px 20px!important}
      #view-overview #overviewStats .stat-value{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;line-height:1.15!important;font-variant-numeric:tabular-nums!important}
      #view-overview #overviewStats .stat-label,#view-overview #overviewStats .stat-change{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      @media(max-width:1050px){#view-overview #overviewStats{grid-template-columns:repeat(3,minmax(180px,1fr))!important;overflow-x:auto!important;padding-bottom:3px!important}#view-overview #overviewStats .stat-card{min-width:180px!important}}
      @media(max-width:900px){#view-overview #overviewStats{grid-template-columns:1fr!important;overflow:visible!important}#view-overview #overviewStats .stat-card{min-width:0!important}}
    `;
    document.head.appendChild(style);
  }

  window.nav = function(id, noHash) {
    const view = document.getElementById('view-' + id);
    if (!view) { console.warn('[ROUTER] Vue introuvable:', id); return false; }
    if (typeof destroyAllCharts === 'function') destroyAllCharts();
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
    document.querySelectorAll('.nav-dropdown-item,.nav-dropdown-btn,[data-route]').forEach(el => el.classList.remove('active'));
    view.classList.add('active'); view.style.display = '';
    const navEls = Array.from(document.querySelectorAll('[data-route="' + id + '"]'));
    navEls.forEach(el => el.classList.add('active'));
    const navEl = document.getElementById('nav-' + id) || navEls.find(el => el.closest('.nav-dropdown')) || navEls[0];
    const parentMenu = navEl?.closest('.nav-dropdown');
    if (parentMenu) parentMenu.querySelector('.nav-dropdown-btn')?.classList.add('active');
    if (!noHash) setHashForView(id);
    setTimeout(() => {
      if (typeof window.renderCurrentView === 'function') { window.renderCurrentView(); return; }
      const fn = window[renderMap[id]];
      if (typeof fn === 'function') { try { fn(); } catch (err) { console.error('[ROUTER] Render ' + id + ':', err); } }
    }, 30);
    document.getElementById('globalSearchResults')?.classList.remove('open');
    if (typeof closeDropdowns === 'function') closeDropdowns();
    updateBreadcrumb(id);
    if (typeof closeSidebar === 'function') closeSidebar();
    return true;
  };

  window.toggleDropdown = function(id) {
    const dd = document.getElementById(id), menu = document.getElementById('menu-' + id), btn = dd?.querySelector('.nav-dropdown-btn');
    if (!menu || !btn) return;
    const open = menu.classList.contains('open');
    closeDropdowns();
    if (!open) { menu.classList.add('open'); btn.classList.add('open'); btn.setAttribute('aria-expanded','true'); }
  };

  window.closeDropdowns = function() {
    document.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.nav-dropdown-btn').forEach(b => { b.classList.remove('open'); b.setAttribute('aria-expanded','false'); });
  };

  window.toggleSidebar = function() {
    const s=document.getElementById('sidebar'), o=document.getElementById('overlay');
    if (!s) return;
    const open=s.classList.contains('open');
    s.classList.toggle('open',!open); o?.classList.toggle('open',!open);
  };
  window.closeSidebar = function() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('overlay')?.classList.remove('open'); };

  window.updateBreadcrumb = function(viewId) {
    const bc=document.getElementById('breadcrumb'); if(!bc) return;
    const items=BREADCRUMBS[viewId]||BREADCRUMBS.overview;
    bc.innerHTML=items.map((item,i)=>i===items.length-1?`<span class="bc-current">${escapeHtml(item.label)}</span>`:`<a href="#${encodeURIComponent(item.view)}" data-breadcrumb-route="${escapeHtml(item.view)}">${escapeHtml(item.label)}</a><span class="bc-sep">›</span>`).join('');
  };

  if (!window.__TC_BREADCRUMB_EVENTS__) {
    window.__TC_BREADCRUMB_EVENTS__ = true;
    document.addEventListener('click', function (event) {
      const link = event.target.closest?.('[data-breadcrumb-route]');
      if (!link) return;
      const id = link.getAttribute('data-breadcrumb-route');
      if (!id || typeof window.nav !== 'function') return;
      event.preventDefault();
      window.nav(id);
    });
  }

  if (!window.__TC_COMMAND_NAV_EVENTS__) {
    window.__TC_COMMAND_NAV_EVENTS__ = true;
    document.addEventListener('click', function (event) {
      const target = event.target.closest?.('.tc-brand[data-route], .tc-navitem[data-route], .tc-rail-link[data-route]');
      if (!target) return;
      const id = target.getAttribute('data-route');
      if (!id || typeof window.nav !== 'function') return;
      event.preventDefault();
      event.stopPropagation();
      window.nav(id);
    }, true);
  }

  window.setHashForView = function(id) {
    const hashMap={overview:'',titres:'#titres',boc:'#boc',marche:'#marche',analyses:'#analyses','analyse-detail':'#analyse-detail','analyse-technique':'#analyse-technique','analyse-fondamentale':'#analyse-fondamentale',backtest:'#backtest',outils:'#outils',screener:'#screener',portefeuille:'#portefeuille',alertes:'#alertes',financials:'#financials','financials-detail':'#financials-detail',fiche:'#fiche',publications:'#publications',comparison:'#comparison','dividend-screener':'#dividend-screener'};
    const h=hashMap[id]||'';
    if(h!==location.hash){ if(window.__TC_HASH_SET__) history.pushState({view:id},'',h||location.pathname); else history.replaceState({view:id},'',h||location.pathname); window.__TC_HASH_SET__=true; }
    if(TITLES[id]) document.title=TITLES[id]+', The Capital';
  };

  window.parseHash = function() {
    const h=location.hash;
    if(h.startsWith('#fiche=')){const t=decodeURIComponent(h.slice(7));if(typeof openFiche==='function')openFiche(t,'titres',true);return;}
    if(h.startsWith('#analyse=')){const id=h.slice(9);if(typeof openAnalyseDetail==='function')openAnalyseDetail(+id,true);return;}
    const map={'#titres':'titres','#boc':'boc','#marche':'marche','#analyses':'analyses','#analyse-detail':'analyse-detail','#analyse-technique':'analyse-technique','#analyse-fondamentale':'analyse-fondamentale','#backtest':'backtest','#outils':'outils','#screener':'screener','#portefeuille':'portefeuille','#alertes':'alertes','#financials':'financials','#financials-detail':'financials-detail','#publications':'publications','#comparison':'comparison','#dividend-screener':'dividend-screener'};
    nav(map[h]||'overview',true);
  };

  if(!window.__TC_ROUTER_POPSTATE__){window.__TC_ROUTER_POPSTATE__=true;window.addEventListener('popstate',function(){if(typeof parseHash==='function')parseHash();});}
  window.escapeHtml=function(text){const d=document.createElement('div');d.textContent=text==null?'':String(text);return d.innerHTML;};

  injectDashboardStability();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>console.log('[ROUTER] Single-app router chargé — navigation + command shell'),{once:true});
  else console.log('[ROUTER] Single-app router chargé — navigation + command shell');
})();