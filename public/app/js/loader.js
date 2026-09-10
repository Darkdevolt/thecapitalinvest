(function(){
  const unwrap=v=>{if(Array.isArray(v))return v;if(v&&Array.isArray(v.data))return v.data;if(v&&Array.isArray(v.rows))return v.rows;if(v&&Array.isArray(v.results))return v.results;return[];};
  // cache.js n'est pas chargé dans app.html : sans ce garde, window.cacheManager
  // vaut undefined, `cached()` renvoyait undefined, et loadMap prenait undefined
  // pour un « hit » -> les données secondaires (financials, dividendes, BOC,
  // coupons, historique d'indices) n'étaient JAMAIS chargées.
  const cached=key=>{ try { return window.cacheManager ? window.cacheManager.getCache(key) : null; } catch(e){ return null; } };
  const setGlobals=(key,value)=>{window[key]=Array.isArray(value)?value:[];};
  const critical={cours:'/marche?type=cours',indices:'/marche?type=indices',entreprises:'/marche?type=entreprises',analyses:'/marche?type=analyses'};
  const secondary={indicesHistory:'/marche?type=indices_historique&limit=90',financials:'/marche?type=financials',dividendes:'/marche?type=dividendes',boc:'/boc',coupons:'/marche?type=coupons'};
  function publish(phase){window.entMap=Object.fromEntries((window.allEntreprises||[]).map(e=>[e.ticker,e]));window.allCours=Array.isArray(window.allCours)?window.allCours:[];window.allBoc=Array.isArray(window.allBoc)?window.allBoc:[];window.allAnalyses=Array.isArray(window.allAnalyses)?window.allAnalyses:[];window.allFinancials=Array.isArray(window.allFinancials)?window.allFinancials:[];window.allEntreprises=Array.isArray(window.allEntreprises)?window.allEntreprises:[];window.allIndices=Array.isArray(window.allIndices)?window.allIndices:[];window.allDividendes=Array.isArray(window.allDividendes)?window.allDividendes:[];window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{phase,cours:window.allCours.length,indices:window.allIndices.length,analyses:window.allAnalyses.length,financials:window.allFinancials.length,entreprises:window.allEntreprises.length,dividendes:window.allDividendes.length}}));if(typeof window.renderCurrentView==='function')setTimeout(window.renderCurrentView,0);}
  async function fetchOne(key,endpoint){try{return unwrap(await window.apiGet(endpoint));}catch(e){console.warn('[LOADER] '+key,e);return null;}}
  async function loadMap(map,phase){const results=await Promise.all(map.map(async([name,endpoint])=>{const c=cached(endpoint);if(c!==null){setGlobals(name,unwrap(c));return[name,null,true];}const value=await fetchOne(name,endpoint);if(value!==null)setGlobals(name,value);return[name,value,false];}));results.forEach(([name,value])=>{if(value!==null)setGlobals(name,value);});publish(phase);return results;}
  async function loadCritical(){const map=[['allCours',critical.cours],['allIndicesLatest',critical.indices],['allEntreprises',critical.entreprises],['allAnalyses',critical.analyses]];map.forEach(([name,endpoint])=>{const c=cached(endpoint);if(c!==null)setGlobals(name,unwrap(c));else setGlobals(name,[]);});window.allIndices=Array.isArray(window.allIndicesLatest)?window.allIndicesLatest.slice():[];window.allIndicesHistory=Array.isArray(window.allIndicesHistory)?window.allIndicesHistory:[];window.allFinancials=window.allFinancials||[];window.allDividendes=window.allDividendes||[];window.allBoc=window.allBoc||[];window.allCoupons=window.allCoupons||[];const results=await Promise.all(map.map(async([name,endpoint])=>[name,await fetchOne(name,endpoint)]));results.forEach(([name,value])=>{if(value!==null)setGlobals(name,value);});window.allIndices=Array.isArray(window.allIndicesLatest)?window.allIndicesLatest.slice():[];publish('critical');}
  const loading={};
  window.loadData=async function(key,endpoint,options){const target=endpoint||secondary[key];if(!target)throw new Error('Ressource inconnue: '+key);if(loading[target])return loading[target];loading[target]=(async()=>{const c=cached(target),name=options?.globalName||key;if(c!==null)setGlobals(name,unwrap(c));try{const value=await fetchOne(key,target);if(value!==null)setGlobals(name,value);publish('ondemand');return window[name];}finally{delete loading[target];}})();return loading[target];};
  // NE PAS écraser window.allIndices (dernier point) avec l'historique : la vue
  // Marché lisait alors la 1re ligne « COMPOSITE » de l'historique (valeur d'une
  // ancienne séance) au lieu de la cotation du jour. Les deux globales restent
  // distinctes : allIndices = dernière séance, allIndicesHistory = série.
  window.loadIndexHistory=()=>window.loadData('allIndicesHistory',secondary.indicesHistory,{globalName:'allIndicesHistory'}).then(()=>window.allIndicesHistory);
  async function loadEnrichment(){const map=[['allFinancials',secondary.financials],['allDividendes',secondary.dividendes],['allBoc',secondary.boc],['allCoupons',secondary.coupons],['allIndicesHistory',secondary.indicesHistory]];await loadMap(map,'enrichment');publish('enrichment');}
  window.loadAll=async function(){if(window.__tcLoadPromise)return window.__tcLoadPromise;window.__tcLoadPromise=(async()=>{console.log('[LOADER] Chargement optimisé…');await loadCritical();await loadEnrichment();console.log('[LOADER] Données prêtes | cours:',window.allCours.length,'| analyses:',window.allAnalyses.length);})();return window.__tcLoadPromise;};
  window.__tcOptimizedLoadAll=window.loadAll;
  const styles=[
    // dashboard-final-polish.css retiré : sa présentation est reprise, en une
    // seule couche lisible, par /app/css/dashboard.css chargé dans app.html.
    ['/app/css/dashboard-final-runtime.css?v=1','tc-dashboard-final-runtime']
  ];
  styles.forEach(([href,id])=>{if(document.getElementById(id))return;const style=document.createElement('link');style.id=id;style.rel='stylesheet';style.href=href;document.head.appendChild(style);});
  const viewModules=['/app/js/views/overview.js?v=1','/app/js/views/titres.js?v=1','/app/js/views/boc.js?v=2','/app/js/views/marche.js?v=2','/app/js/views/analyses.js?v=1','/app/js/views/fiche.js?v=3','/app/js/views/technique/pro/at-boot.js?v=20260910','/app/js/views/analyse-fondamentale.js?v=3','/app/js/views/screener.js?v=2','/app/js/views/backtest.js?v=2','/app/js/views/outils.js?v=1','/app/js/views/opportunites.js?v=1','/app/js/views/palmares.js?v=1','/app/js/views/obligations.js?v=2','/app/js/views/portefeuille.js?v=2','/app/js/views/alertes.js?v=1','/app/js/views/financials.js?v=1','/app/js/views/publications.js?v=1','/app/js/views/comparison.js?v=2','/app/js/views/dividend-screener.js?v=1'];
  function loadScript(src){
    if(typeof window.tcLoadOnce==='function')return window.tcLoadOnce(src);
    return new Promise(resolve=>{const p=String(src).split('?')[0];if(document.querySelector('script[src="'+p+'"],script[src^="'+p+'?"]'))return resolve();const s=document.createElement('script');s.src=src;s.async=false;s.dataset.tcView=src;s.onload=()=>resolve();s.onerror=()=>{console.warn('[LOADER] '+src+' indisponible');resolve();};document.head.appendChild(s);});
  }
  const viewsReady=Promise.all(viewModules.map(loadScript)).then(()=>{window.__TC_VIEWS_READY__=true;if(typeof window.renderCurrentView==='function')window.renderCurrentView();});window.__tcViewsReady=viewsReady;
  window.addEventListener('load',function(){loadScript('/app/js/views/recommendations-fixes.js?v=20260827');loadScript('/app/js/views/financials-per.js?v=1');loadScript('/js/accessibility-runtime.js?v=1');loadScript('/app/js/runtime-recovery.js?v=1');loadScript('/app/js/views/dashboard-final-runtime.js?v=1');loadScript('/app/js/views/dashboard-chart-runtime.js?v=1');loadScript('/app/js/views/dashboard-calendar-runtime.js?v=20260910');});
})();
