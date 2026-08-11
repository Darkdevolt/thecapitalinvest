// MAIN — The Capital BRVM Dashboard
// Runtime principal : orchestration des données et du rendu.
(function(){
  'use strict';
  window.allCours=Array.isArray(window.allCours)?window.allCours:[];
  window.allIndices=Array.isArray(window.allIndices)?window.allIndices:[];
  window.allBoc=Array.isArray(window.allBoc)?window.allBoc:[];
  window.allFinancials=Array.isArray(window.allFinancials)?window.allFinancials:[];
  window.allAnalyses=Array.isArray(window.allAnalyses)?window.allAnalyses:[];
  window.allEntreprises=Array.isArray(window.allEntreprises)?window.allEntreprises:[];
  window.entMap=window.entMap&&typeof window.entMap==='object'?window.entMap:{};
  if(window.__TC_MAIN_LOADED__){console.log('[MAIN] Déjà chargé, skip.');return;}
  window.__TC_MAIN_LOADED__=true;
  var fundamentalRetryTimer=null,fundamentalRetryCount=0,technicalInitialized=false;

  function loadMobilePolish(){
    if(document.getElementById('tc-mobile-polish'))return;
    var link=document.createElement('link');link.id='tc-mobile-polish';link.rel='stylesheet';link.href='app/css/mobile-polish.css?v=3';document.head.appendChild(link);
    var finalLink=document.createElement('link');finalLink.id='tc-mobile-polish-v2';finalLink.rel='stylesheet';finalLink.href='app/css/mobile-polish-v2.css?v=3';document.head.appendChild(finalLink);
  }

  function loadFinancialPolish(){
    if(document.getElementById('tc-financial-polish'))return;
    var link=document.createElement('link');link.id='tc-financial-polish';link.rel='stylesheet';link.href='app/css/financials-polish.css?v=1';document.head.appendChild(link);
  }

  function loadMobileNavigation(){
    // Single owner: components/sidebar.js is already loaded by app.html.
    // Never inject or initialize a second mobile navigation implementation.
    if(typeof window.initSidebar==='function')window.initSidebar();
  }

  // La page de suivi existe déjà et utilise le même mécanisme de session.
  // On l'intègre explicitement dans les deux niveaux de navigation de l'app
  // sans dupliquer la logique métier du suivi.
  function ensureSuiviNavigation(){
    var href='suivi.html';

    var sidebar=document.getElementById('sidebar');
    if(sidebar&&!sidebar.querySelector('[data-tc-suivi]')){
      var sections=sidebar.querySelectorAll('.sidebar-section');
      var gestionSection=null;
      sections.forEach(function(s){if(String(s.textContent||'').trim()==='Gestion')gestionSection=s;});
      if(gestionSection){
        var item=document.createElement('a');
        item.setAttribute('data-tc-suivi','1');
        item.href=href;
        item.target='_self';
        item.className='nav-item';
        item.style.textDecoration='none';
        item.innerHTML='<span class="icon">☆</span> Suivi';
        gestionSection.insertAdjacentElement('afterend',item);
      }
    }

    var menu=document.getElementById('menu-dd-gestion');
    if(menu&&!menu.querySelector('[data-tc-suivi]')){
      var separator=document.createElement('div');
      separator.className='nav-dropdown-separator';
      var item=document.createElement('a');
      item.setAttribute('data-tc-suivi','1');
      item.href=href;
      item.target='_self';
      item.className='nav-dropdown-item';
      item.style.textDecoration='none';
      item.innerHTML='<span class="icon">☆</span><div><div>Suivi</div><div class="item-desc">Valeurs surveillées & monitoring</div></div>';
      menu.appendChild(separator);
      menu.appendChild(item);
    }
  }

  function ensureTechnicalReady(){
    if(!Array.isArray(window.allCours)||window.allCours.length===0){console.warn('[MAIN] Analyse technique en attente des cours.');return false;}
    if(typeof window.atInit!=='function'){console.warn('[MAIN] atInit indisponible.');return false;}
    try{
      if(!technicalInitialized){var ok=window.atInit();if(ok===false)return false;technicalInitialized=true;console.log('[MAIN] Analyse technique initialisée avec '+window.allCours.length+' cours');}
      else if(typeof window.atRefreshUI==='function')window.atRefreshUI();
      return true;
    }catch(err){technicalInitialized=false;console.error('[MAIN] Erreur initialisation analyse technique:',err);if(typeof window.toast==='function')window.toast('Analyse technique indisponible : '+(err.message||err),'error');return false;}
  }

  async function initApp(){
    console.log('[MAIN] Initialisation...');loadMobilePolish();loadFinancialPolish();loadMobileNavigation();ensureSuiviNavigation();
    if(!document.getElementById('toastContainer')){var tc=document.createElement('div');tc.id='toastContainer';tc.style.cssText='position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';document.body.appendChild(tc);}
    loadAll().catch(function(err){console.error('[MAIN] Erreur loadAll:',err);if(typeof toast==='function')toast('Erreur de chargement des données','error');});
    window.addEventListener('hashchange',function(){if(typeof parseHash==='function')parseHash();if(parseHashFromUrl()==='analyse-technique')ensureTechnicalReady();scheduleFundamentalRender(true);ensureFundamentalReady();});
    if(typeof parseHash==='function')parseHash();setupGlobalEvents();
    var initialView=parseHashFromUrl()||'overview';if(typeof nav==='function')nav(initialView,true);
    scheduleFundamentalRender(true);ensureFundamentalReady();if(initialView==='analyse-technique')ensureTechnicalReady();
  }

  function fetchOrEmpty(endpoint,setter,emptyVal){
    if(typeof window.apiGet!=='function'){console.warn('[MAIN] apiGet non disponible:',endpoint);setter(emptyVal);return Promise.resolve();}
    return window.apiGet(endpoint).then(function(res){var payload=(res&&typeof res==='object'&&'data' in res)?res.data:res;setter(payload||emptyVal);}).catch(function(err){console.warn('[MAIN] '+endpoint+' non chargé:',err.message||err);setter(emptyVal);});
  }

  async function loadAll(){
    await Promise.allSettled([
      fetchOrEmpty('/marche?type=cours',function(d){window.allCours=Array.isArray(d)?d:[];if(typeof window.populateTickerSelect==='function')window.populateTickerSelect();if(typeof window.populateTickerSelects==='function')window.populateTickerSelects();if(parseHashFromUrl()==='analyse-technique')ensureTechnicalReady();renderCurrentView();ensureFundamentalReady();},[]),
      fetchOrEmpty('/marche?type=indices',function(d){window.allIndices=Array.isArray(d)?d:[];renderCurrentView();},[])
    ]);
    await Promise.allSettled([
      fetchOrEmpty('/boc',function(d){window.allBoc=d&&Array.isArray(d.data)?d.data:(Array.isArray(d)?d:[]);},[]),
      fetchOrEmpty('/marche?type=financials',function(d){window.allFinancials=Array.isArray(d)?d:[];if(typeof window.populateTickerSelects==='function')window.populateTickerSelects();renderCurrentView();ensureFundamentalReady();},[]),
      fetchOrEmpty('/marche?type=analyses',function(d){window.allAnalyses=Array.isArray(d)?d:[];renderCurrentView();},[]),
      fetchOrEmpty('/marche?type=entreprises',function(d){window.allEntreprises=Array.isArray(d)?d:[];window.entMap={};window.allEntreprises.forEach(function(e){if(e&&e.ticker)window.entMap[e.ticker]=e;});renderCurrentView();},[])
    ]);
    ensureTechnicalReady();renderCurrentView();ensureFundamentalReady();
    console.log('[MAIN] Données chargées:',{cours:window.allCours.length,indices:window.allIndices.length,boc:window.allBoc.length,financials:window.allFinancials.length,analyses:window.allAnalyses.length,entreprises:window.allEntreprises.length});
  }

  function ensureFundamentalReady(){
    if(parseHashFromUrl()!=='analyse-fondamentale')return;var select=document.getElementById('fundTickerSelect');if(!select)return;
    if(typeof window.populateTickerSelects==='function')window.populateTickerSelects();
    if(select.options.length<=1&&Array.isArray(window.allFinancials)&&window.allFinancials.length){var seen={},tickers=window.allFinancials.map(function(f){return f&&f.ticker?String(f.ticker).toUpperCase():'';}).filter(function(t){return t&&!seen[t]&&(seen[t]=true);}).sort();if(tickers.length)select.innerHTML='<option value="">Choisir un ticker...</option>'+tickers.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');}
    if(select.options.length>1&&!select.value)select.selectedIndex=1;if(select.value&&typeof window.loadFundAnalysis==='function')window.loadFundAnalysis();
  }

  function scheduleFundamentalRender(reset){
    if(reset)fundamentalRetryCount=0;if(fundamentalRetryTimer)clearTimeout(fundamentalRetryTimer);if(parseHashFromUrl()!=='analyse-fondamentale')return;
    fundamentalRetryTimer=setTimeout(function retry(){if(parseHashFromUrl()!=='analyse-fondamentale')return;var activeView=document.querySelector('.view.active');if(!activeView||activeView.id!=='view-analyse-fondamentale'){if(fundamentalRetryCount<20){fundamentalRetryCount++;scheduleFundamentalRender(false);}return;}ensureFundamentalReady();renderCurrentView();fundamentalRetryCount++;if(fundamentalRetryCount<20&&(!Array.isArray(window.allFinancials)||!window.allFinancials.length))scheduleFundamentalRender(false);},250);
  }

  function renderCurrentView(){
    var activeView=document.querySelector('.view.active'),viewId=activeView&&activeView.id?activeView.id.replace('view-',''):'';if(!viewId)return;
    if(viewId==='analyse-technique')ensureTechnicalReady();
    var fnName='render'+viewId.charAt(0).toUpperCase()+viewId.slice(1);
    if(typeof window[fnName]==='function'){try{window[fnName]();}catch(e){console.warn('[MAIN] Render error '+fnName+':',e);if(viewId==='analyse-fondamentale')scheduleFundamentalRender(false);}}
  }

  function parseHashFromUrl(){
    var h=location.hash;if(h.indexOf('#fiche=')===0)return'fiche';if(h.indexOf('#analyse=')===0)return'analyse-detail';
    var map={'#titres':'titres','#marche':'marche','#boc':'boc','#analyses':'analyses','#analyse-detail':'analyse-detail','#analyse-technique':'analyse-technique','#analyse-fondamentale':'analyse-fondamentale','#screener':'screener','#portefeuille':'portefeuille','#alertes':'alertes','#financials':'financials','#financials-detail':'financials-detail','#publications':'publications','#formation':'formation'};return map[h]||'overview';
  }
  function setupGlobalEvents(){document.addEventListener('click',function(e){if(!e.target.closest('.nav-dropdown')&&!e.target.closest('.topnav-logo')){if(typeof closeDropdowns==='function')closeDropdowns();}});document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(typeof closeDropdowns==='function')closeDropdowns();if(typeof closeSidebar==='function')closeSidebar();}});}
  window.loadAll=loadAll;window.initApp=initApp;
})();