// MAIN, The Capital BRVM Dashboard
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
  function loadMobileNavigation(){if(typeof window.initSidebar==='function')window.initSidebar();}

  // Un seul espace pour le suivi et le travail de décision.
  function ensureDeskTradingNavigation(){
    var href='desk-workspace.html';
    var sidebar=document.getElementById('sidebar');
    if(sidebar&&!sidebar.querySelector('[data-tc-desk]')){
      var sections=sidebar.querySelectorAll('.sidebar-section');
      var gestionSection=null;
      sections.forEach(function(s){if(String(s.textContent||'').trim()==='Gestion')gestionSection=s;});
      if(gestionSection){
        var item=document.createElement('a');
        item.setAttribute('data-tc-desk','1');item.href=href;item.target='_self';item.className='nav-item';item.style.textDecoration='none';
        item.innerHTML='<span class="icon">▣</span> Desk Trading';
        gestionSection.insertAdjacentElement('afterend',item);
      }
    }
    var menu=document.getElementById('menu-dd-gestion');
    if(menu&&!menu.querySelector('[data-tc-desk]')){
      var separator=document.createElement('div');separator.className='nav-dropdown-separator';
      var item=document.createElement('a');item.setAttribute('data-tc-desk','1');item.href=href;item.target='_self';item.className='nav-dropdown-item';item.style.textDecoration='none';
      item.innerHTML='<span class="icon">▣</span><div><div>Desk Trading</div><div class="item-desc">Suivis, décisions, simulations et positions</div></div>';
      menu.appendChild(separator);menu.appendChild(item);
    }
  }

  function ensureGuide(){
    if(document.getElementById('tc-guide-btn'))return;
    var style=document.createElement('style');style.id='tc-guide-style';style.textContent='.tc-guide-btn{border:1px solid var(--border2);background:rgba(184,150,78,.08);color:var(--gold);border-radius:7px;padding:7px 10px;font-size:11px;cursor:pointer;white-space:nowrap}.tc-guide-btn:hover{border-color:var(--gold);background:rgba(184,150,78,.14)}.tc-guide-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:10000;display:none;align-items:center;justify-content:center;padding:18px}.tc-guide-overlay.open{display:flex}.tc-guide-box{width:min(760px,100%);max-height:88vh;overflow:auto;background:var(--card,#181410);border:1px solid var(--border,rgba(184,150,78,.18));border-radius:12px;padding:20px;color:var(--cream,#f5f0e8)}.tc-guide-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.tc-guide-title{font:700 22px var(--serif,serif)}.tc-guide-close{border:0;background:none;color:var(--muted);font-size:24px;cursor:pointer}.tc-guide-search{width:100%;margin:14px 0;padding:11px;background:var(--surface,#13110c);border:1px solid var(--border);border-radius:7px;color:var(--cream);outline:0}.tc-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tc-guide-item{border:1px solid rgba(184,150,78,.12);border-radius:8px;background:var(--surface,#13110c);padding:12px}.tc-guide-item b{display:block;font-size:12px;margin-bottom:5px}.tc-guide-item span{display:block;font-size:11px;color:var(--muted);line-height:1.5}.tc-guide-link{margin-top:9px;border:1px solid var(--border);background:none;color:var(--gold);border-radius:6px;padding:6px 8px;font-size:10px;cursor:pointer}@media(max-width:650px){.tc-guide-grid{grid-template-columns:1fr}}';document.head.appendChild(style);
    var right=document.querySelector('.topnav-right');if(!right)return;
    var btn=document.createElement('button');btn.id='tc-guide-btn';btn.className='tc-guide-btn';btn.type='button';btn.textContent='ⓘ Guide';right.insertBefore(btn,right.firstChild);
    var overlay=document.createElement('div');overlay.id='tc-guide-overlay';overlay.className='tc-guide-overlay';overlay.innerHTML='<div class="tc-guide-box" role="dialog" aria-modal="true" aria-labelledby="tc-guide-title"><div class="tc-guide-head"><div class="tc-guide-title" id="tc-guide-title">Guide The Capital</div><button class="tc-guide-close" id="tc-guide-close" aria-label="Fermer">×</button></div><input class="tc-guide-search" id="tc-guide-search" placeholder="Ex. je veux voir mes dividendes…" autocomplete="off"><div class="tc-guide-grid" id="tc-guide-grid"></div></div></div>';document.body.appendChild(overlay);
    var items=[
      ['Surveiller une valeur','Ajoutez et consultez vos titres favoris, variations, liquidité et notes.','Ouvrir Suivis','desk-workspace.html#suivi'],
      ['Analyser une décision','Construisez une idée avec sens, prix, objectif, stop, horizon et justification.','Ouvrir Idées','desk-workspace.html#ideas'],
      ['Tester un scénario','Calculez capital engagé, gain, perte, rendement et ratio risque/rendement.','Ouvrir Simulations','desk-workspace.html#sim'],
      ['Suivre mes positions','Retrouvez vos positions simulées et leur P&L.','Ouvrir Positions','desk-workspace.html#positions'],
      ['Comprendre les marchés','Consultez les cours, indices, BOC et titres BRVM.','Ouvrir Marché','app.html#marche'],
      ['Analyser une entreprise','Utilisez l’analyse fondamentale pour les ratios, historiques et valorisations.','Ouvrir Analyse fondamentale','app.html#analyse-fondamentale'],
      ['Voir les publications','Retrouvez le calendrier et les publications disponibles.','Ouvrir Calendrier','app.html#publications'],
      ['Apprendre','Accédez à la formation, au lexique et aux guides.','Ouvrir Formation','app.html#formation'],
      ['Pourquoi Suivis + Trading Desk ?','Suivis = ce que je surveille. Trading Desk = ce que je fais avec ce que je surveille. Ils sont maintenant réunis dans un même workspace pour éviter les ruptures de navigation.','Ouvrir le Desk','desk-workspace.html']
    ];
    var grid=document.getElementById('tc-guide-grid'),search=document.getElementById('tc-guide-search');
    function renderGuide(filter){var f=String(filter||'').toLowerCase();grid.innerHTML=items.filter(function(x){return(x[0]+' '+x[1]).toLowerCase().indexOf(f)>-1;}).map(function(x){return '<div class="tc-guide-item"><b>'+x[0]+'</b><span>'+x[1]+'</span><button class="tc-guide-link" data-href="'+x[3]+'">'+x[2]+' →</button></div>';}).join('')||'<div class="tc-guide-item"><span>Aucun résultat. Essayez « surveiller », « simulation », « position » ou « analyse ».</span></div>';grid.querySelectorAll('[data-href]').forEach(function(a){a.addEventListener('click',function(){var h=a.getAttribute('data-href');if(h.indexOf('desk-workspace.html')===0){location.href=h;return}if(h.indexOf('app.html#')===0){var hash=h.split('#')[1];if(typeof nav==='function')nav(hash);else location.hash=hash;closeGuide();}});});}
    function openGuide(){overlay.classList.add('open');search.value='';renderGuide('');setTimeout(function(){search.focus();},30)}function closeGuide(){overlay.classList.remove('open')}
    btn.addEventListener('click',openGuide);document.getElementById('tc-guide-close').addEventListener('click',closeGuide);overlay.addEventListener('click',function(e){if(e.target===overlay)closeGuide()});search.addEventListener('input',function(){renderGuide(search.value)});document.addEventListener('keydown',function(e){if(e.key==='Escape')closeGuide()});renderGuide('');
  }

  function ensureTechnicalReady(){
    if(!Array.isArray(window.allCours)||window.allCours.length===0){console.warn('[MAIN] Analyse technique en attente des cours.');return false;}
    if(typeof window.atInit!=='function'){console.warn('[MAIN] atInit indisponible.');return false;}
    try{if(!technicalInitialized){var ok=window.atInit();if(ok===false)return false;technicalInitialized=true;}else if(typeof window.atRefreshUI==='function')window.atRefreshUI();return true;}
    catch(err){technicalInitialized=false;console.error('[MAIN] Erreur initialisation analyse technique:',err);if(typeof window.toast==='function')window.toast('Analyse technique indisponible : '+(err.message||err),'error');return false;}
  }
  async function initApp(){
    console.log('[MAIN] Initialisation...');loadMobilePolish();loadFinancialPolish();loadMobileNavigation();ensureDeskTradingNavigation();ensureGuide();
    if(!document.getElementById('toastContainer')){var tc=document.createElement('div');tc.id='toastContainer';tc.style.cssText='position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';document.body.appendChild(tc);}
    loadAll().catch(function(err){console.error('[MAIN] Erreur loadAll:',err);if(typeof toast==='function')toast('Erreur de chargement des données','error');});
    window.addEventListener('hashchange',function(){if(typeof parseHash==='function')parseHash();if(parseHashFromUrl()==='analyse-technique')ensureTechnicalReady();scheduleFundamentalRender(true);ensureFundamentalReady();});
    if(typeof parseHash==='function')parseHash();setupGlobalEvents();var initialView=parseHashFromUrl()||'overview';if(typeof nav==='function')nav(initialView,true);scheduleFundamentalRender(true);ensureFundamentalReady();if(initialView==='analyse-technique')ensureTechnicalReady();
  }
  function fetchOrEmpty(endpoint,setter,emptyVal){
    if(typeof window.apiGet!=='function'){console.warn('[MAIN] apiGet non disponible:',endpoint);setter(emptyVal);return Promise.resolve();}
    return window.apiGet(endpoint).then(function(res){var payload=(res&&typeof res==='object'&&'data' in res)?res.data:res;setter(payload||emptyVal);}).catch(function(err){console.warn('[MAIN] '+endpoint+' non chargé:',err.message||err);setter(emptyVal);});
  }
  /**
   * Consolidation des indices.
   *
   * Deux notions distinctes portaient le même nom, ce qui rendait le
   * résultat dépendant de l'ordre d'exécution :
   *   - /marche?type=indices             renvoie le DERNIER état
   *   - /marche?type=indices_historique  renvoie la SÉRIE
   *
   * overview.js attend une série dans window.allIndices : getLatestIndices()
   * en déduit lui-même le dernier état, mais getIndiceHistory() a besoin des
   * trente derniers points. Alimenté avec le seul dernier état, le graphique
   * composite affiche « Données insuffisantes » sans lever d'erreur.
   *
   * Chaque notion a désormais son nom, et allIndices reçoit la série. Le
   * repli sur le dernier état garantit que les cartes d'indices restent
   * affichées même si l'historique est indisponible.
   */
  function applyIndices(){
    var history=Array.isArray(window.allIndicesHistory)?window.allIndicesHistory:[];
    var latest=Array.isArray(window.allIndicesLatest)?window.allIndicesLatest:[];
    window.allIndices=history.length?history:latest.slice();
    renderCurrentView();
  }

  async function loadAll(){
    await Promise.allSettled([
      fetchOrEmpty('/marche?type=cours',function(d){window.allCours=Array.isArray(d)?d:[];if(typeof window.populateTickerSelect==='function')window.populateTickerSelect();if(typeof window.populateTickerSelects==='function')window.populateTickerSelects();if(parseHashFromUrl()==='analyse-technique')ensureTechnicalReady();renderCurrentView();ensureFundamentalReady();},[]),
      fetchOrEmpty('/marche?type=indices',function(d){window.allIndicesLatest=Array.isArray(d)?d:[];applyIndices();},[]),
      fetchOrEmpty('/marche?type=indices_historique&limit=90',function(d){window.allIndicesHistory=Array.isArray(d)?d:[];applyIndices();},[])
    ]);
    await Promise.allSettled([
      fetchOrEmpty('/boc',function(d){window.allBoc=d&&Array.isArray(d.data)?d.data:(Array.isArray(d)?d:[]);},[]),
      fetchOrEmpty('/marche?type=financials',function(d){window.allFinancials=Array.isArray(d)?d:[];if(typeof window.populateTickerSelects==='function')window.populateTickerSelects();renderCurrentView();ensureFundamentalReady();},[]),
      fetchOrEmpty('/marche?type=analyses',function(d){window.allAnalyses=Array.isArray(d)?d:[];renderCurrentView();},[]),
      fetchOrEmpty('/marche?type=entreprises',function(d){window.allEntreprises=Array.isArray(d)?d:[];window.entMap={};window.allEntreprises.forEach(function(e){if(e&&e.ticker)window.entMap[e.ticker]=e;});renderCurrentView();},[]),
      fetchOrEmpty('/marche?type=dividendes',function(d){window.allDividendes=Array.isArray(d)?d:[];renderCurrentView();},[]),
      /* Historique court des cotations. /marche?type=cours ne renvoie que la
         derniere seance : le bloc « Activite de la seance » du tableau de bord
         a besoin d'au moins deux seances pour comparer, et restait donc vide.
         Mille lignes couvrent une vingtaine de seances sur 47 valeurs. Charge
         en seconde vague : son absence ne retarde jamais l'affichage. */
      fetchOrEmpty('/marche?type=historique&limit=1000',function(d){window.allCoursHistory=Array.isArray(d)?d:[];renderCurrentView();},[]),
      /* Coupons obligataires. Tant que la table n'existe pas, la route renvoie
         un tableau vide : le calendrier n'affiche alors que les dividendes. */
      fetchOrEmpty('/marche?type=coupons',function(d){window.allCoupons=Array.isArray(d)?d:[];renderCurrentView();},[])
    ]);
    ensureTechnicalReady();renderCurrentView();ensureFundamentalReady();
    console.log('[APP LOAD] Cours:',(window.allCours||[]).length,
      '| Indices série:',(window.allIndicesHistory||[]).length,
      '| Indices dernier état:',(window.allIndicesLatest||[]).length,
      '| Dividendes:',(window.allDividendes||[]).length,
      '| Historique cours:',(window.allCoursHistory||[]).length,
      '| Coupons:',(window.allCoupons||[]).length);
    window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{
      cours:(window.allCours||[]).length,indices:(window.allIndices||[]).length
    }}));
  }
  function ensureFundamentalReady(){
    if(parseHashFromUrl()!=='analyse-fondamentale')return;var select=document.getElementById('fundTickerSelect');if(!select)return;if(typeof window.populateTickerSelects==='function')window.populateTickerSelects();
    if(select.options.length<=1&&Array.isArray(window.allFinancials)&&window.allFinancials.length){var seen={},tickers=window.allFinancials.map(function(f){return f&&f.ticker?String(f.ticker).toUpperCase():'';}).filter(function(t){return t&&!seen[t]&&(seen[t]=true);}).sort();if(tickers.length)select.innerHTML='<option value="">Choisir un ticker...</option>'+tickers.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');}
    if(select.options.length>1&&!select.value)select.selectedIndex=1;if(select.value&&typeof window.loadFundAnalysis==='function')window.loadFundAnalysis();
  }
  function scheduleFundamentalRender(reset){if(reset)fundamentalRetryCount=0;if(fundamentalRetryTimer)clearTimeout(fundamentalRetryTimer);if(parseHashFromUrl()!=='analyse-fondamentale')return;fundamentalRetryTimer=setTimeout(function retry(){if(parseHashFromUrl()!=='analyse-fondamentale')return;var activeView=document.querySelector('.view.active');if(!activeView||activeView.id!=='view-analyse-fondamentale'){if(fundamentalRetryCount<20){fundamentalRetryCount++;scheduleFundamentalRender(false);}return;}ensureFundamentalReady();renderCurrentView();fundamentalRetryCount++;if(fundamentalRetryCount<20&&(!Array.isArray(window.allFinancials)||!window.allFinancials.length))scheduleFundamentalRender(false);},250);}
  function renderCurrentView(){var activeView=document.querySelector('.view.active'),viewId=activeView&&activeView.id?activeView.id.replace('view-',''):'';if(!viewId)return;if(viewId==='analyse-technique')ensureTechnicalReady();var fnName='render'+viewId.charAt(0).toUpperCase()+viewId.slice(1);if(typeof window[fnName]==='function'){try{window[fnName]();}catch(e){console.warn('[MAIN] Render error '+fnName+':',e);if(viewId==='analyse-fondamentale')scheduleFundamentalRender(false);}}}
  function parseHashFromUrl(){var h=location.hash;if(h.indexOf('#fiche=')===0)return'fiche';if(h.indexOf('#analyse=')===0)return'analyse-detail';var map={'#titres':'titres','#marche':'marche','#boc':'boc','#analyses':'analyses','#analyse-detail':'analyse-detail','#analyse-technique':'analyse-technique','#analyse-fondamentale':'analyse-fondamentale','#screener':'screener','#portefeuille':'portefeuille','#alertes':'alertes','#financials':'financials','#financials-detail':'financials-detail','#publications':'publications','#formation':'formation','#comparison':'comparison','#dividend-screener':'dividend-screener'};return map[h]||'overview';}
  function setupGlobalEvents(){document.addEventListener('click',function(e){if(!e.target.closest('.nav-dropdown')&&!e.target.closest('.topnav-logo')){if(typeof closeDropdowns==='function')closeDropdowns();}});document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(typeof closeDropdowns==='function')closeDropdowns();if(typeof closeSidebar==='function')closeSidebar();}});}
  window.loadAll=loadAll;window.initApp=initApp;
})();
