// ============================================================
// THE CAPITAL — MAIN
// Bootstrap stable de l'application
// ============================================================

(function(){
  'use strict';
  if(window.__TC_MAIN_LOADED__) return;
  window.__TC_MAIN_LOADED__ = true;

  window.allCours = Array.isArray(window.allCours) ? window.allCours : [];
  window.allIndices = Array.isArray(window.allIndices) ? window.allIndices : [];
  window.allIndicesHistory = Array.isArray(window.allIndicesHistory) ? window.allIndicesHistory : [];
  window.allEntreprises = Array.isArray(window.allEntreprises) ? window.allEntreprises : [];
  window.allAnalyses = Array.isArray(window.allAnalyses) ? window.allAnalyses : [];
  window.allFinancials = Array.isArray(window.allFinancials) ? window.allFinancials : [];
  window.allDividendes = Array.isArray(window.allDividendes) ? window.allDividendes : [];
  window.allBoc = Array.isArray(window.allBoc) ? window.allBoc : [];
  window.allCoupons = Array.isArray(window.allCoupons) ? window.allCoupons : [];
  window.entMap = window.entMap && typeof window.entMap === 'object' ? window.entMap : {};

  function loadStyles(){
    const styles=[
      {id:'tc-mobile-polish',href:'/app/css/mobile-polish.css?v=3'},
      {id:'tc-mobile-polish-v2',href:'/app/css/mobile-polish-v2.css?v=3'},
      {id:'tc-financial-polish',href:'/app/css/financials-polish.css?v=1'}
    ];
    styles.forEach(item=>{
      if(document.getElementById(item.id)) return;
      const link=document.createElement('link');link.id=item.id;link.rel='stylesheet';link.href=item.href;document.head.appendChild(link);
    });
  }

  let technicalInitialized=false;
  function ensureTechnicalReady(){
    if(!Array.isArray(window.allCours)||window.allCours.length===0) return false;
    if(typeof window.atInit!=='function') return false;
    try{
      if(!technicalInitialized){const result=window.atInit();if(result===false)return false;technicalInitialized=true;}
      else if(typeof window.atRefreshUI==='function') window.atRefreshUI();
      return true;
    }catch(error){technicalInitialized=false;console.error('[MAIN] Analyse technique:',error);return false;}
  }

  function parseHashFromUrl(){
    const hash=location.hash||'';
    if(hash.indexOf('#fiche=')===0)return'fiche';
    if(hash.indexOf('#analyse=')===0)return'analyse-detail';
    const map={'#overview':'overview','#titres':'titres','#marche':'marche','#boc':'boc','#analyses':'analyses','#analyse-detail':'analyse-detail','#analyse-technique':'analyse-technique','#analyse-fondamentale':'analyse-fondamentale','#screener':'screener','#portefeuille':'portefeuille','#alertes':'alertes','#financials':'financials','#financials-detail':'financials-detail','#publications':'publications','#formation':'formation','#comparison':'comparison','#dividend-screener':'dividend-screener'};
    return map[hash]||'overview';
  }

  function renderCurrentView(){
    const active=document.querySelector('.view.active');
    if(!active)return;
    const id=active.id||'';
    if(id.indexOf('view-')!==0)return;
    const viewName=id.substring(5);
    if(viewName==='analyse-technique')ensureTechnicalReady();
    const functionName='render'+viewName.charAt(0).toUpperCase()+viewName.slice(1);
    if(typeof window[functionName]!=='function')return;
    try{window[functionName]();}catch(error){console.error('[MAIN] Rendu '+functionName+':',error);}
  }

  let renderTimer=0;
  let renderQueued=false;
  function scheduleRender(){
    if(renderQueued)return;
    renderQueued=true;
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{
      renderQueued=false;
      renderCurrentView();
    },40);
  }

  function setupGlobalEvents(){
    if(window.__TC_GLOBAL_EVENTS__)return;
    window.__TC_GLOBAL_EVENTS__=true;
    document.addEventListener('click',function(event){
      if(!event.target.closest('.nav-dropdown')&&!event.target.closest('.topnav-logo')&&typeof window.closeDropdowns==='function') window.closeDropdowns();
    });
    document.addEventListener('keydown',function(event){
      if(event.key!=='Escape')return;
      if(typeof window.closeDropdowns==='function')window.closeDropdowns();
      if(typeof window.closeSidebar==='function')window.closeSidebar();
    });
    window.addEventListener('tc:dataready',function(){scheduleRender();});
  }

  function loadDataInBackground(){
    let loader=null;
    if(typeof window.__tcOptimizedLoadAll==='function')loader=window.__tcOptimizedLoadAll;
    else if(typeof window.loadAll==='function')loader=window.loadAll;
    if(typeof loader!=='function'){console.warn('[MAIN] Aucun loader disponible.');return;}
    Promise.resolve().then(()=>loader()).catch(error=>{
      console.error('[MAIN] Chargement des données:',error);
      if(typeof window.toast==='function'){try{window.toast('Certaines données sont temporairement indisponibles.','warn');}catch(e){}}
    });
  }

  function ensureFundamentalReady(){
    if(parseHashFromUrl()!=='analyse-fondamentale')return;
    const select=document.getElementById('afTicker')||document.getElementById('fundTickerSelect');
    if(!select)return;
    try{if(typeof window.populateTickerSelects==='function')window.populateTickerSelects();}catch(e){}
    if(select.options&&select.options.length>1&&!select.value)select.selectedIndex=1;
    if(select.value&&typeof window.loadFundAnalysis==='function'){try{window.loadFundAnalysis();}catch(error){console.warn('[MAIN] Analyse fondamentale:',error);}}
  }

  async function initApp(){
    console.log('[MAIN] The Capital — démarrage');
    try{if(typeof window.initSidebar==='function')window.initSidebar();}catch(error){console.warn('[MAIN] Sidebar:',error);}
    setupGlobalEvents();
    const initialView=parseHashFromUrl();
    let routed=false;
    try{
      if(typeof window.nav==='function'){
        routed=window.nav(initialView,true)===true;
      }else if(typeof window.parseHash==='function'){
        window.parseHash();
        routed=true;
      }
    }catch(error){console.warn('[MAIN] Navigation initiale:',error);}

    /*
     * Le routeur possède son propre rendu différé. Le rendu initial n'est
     * donc déclenché ici que si aucun routeur n'a pu prendre la main.
     */
    if(!routed) scheduleRender();

    setTimeout(loadStyles,0);
    setTimeout(loadDataInBackground,0);
    if(initialView==='analyse-fondamentale')setTimeout(ensureFundamentalReady,50);
    if(initialView==='analyse-technique')setTimeout(ensureTechnicalReady,50);
  }

  if(typeof window.__tcLoaderLoadAll!=='function'&&typeof window.loadAll==='function') window.__tcLoaderLoadAll=window.loadAll;
  window.loadAll=function(){
    if(typeof window.__tcOptimizedLoadAll==='function')return window.__tcOptimizedLoadAll();
    if(typeof window.__tcLoaderLoadAll==='function')return window.__tcLoaderLoadAll();
    return Promise.resolve();
  };
  window.initApp=initApp;
  window.renderCurrentView=renderCurrentView;
  window.parseHashFromUrl=parseHashFromUrl;
  window.ensureTechnicalReady=ensureTechnicalReady;
})();
