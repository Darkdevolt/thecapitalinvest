(function(){
  // Pipeline unique de chargement : cache valide d'abord, données critiques
  // ensuite, enrichissements en arrière-plan. Les anciennes vues peuvent
  // toujours demander les données lourdes à la demande via loadData.
  const unwrap=v=>{
    if(Array.isArray(v))return v;
    if(v&&Array.isArray(v.data))return v.data;
    if(v&&Array.isArray(v.rows))return v.rows;
    if(v&&Array.isArray(v.results))return v.results;
    return [];
  };
  const cached=key=>window.cacheManager?.getCache(key);
  const setGlobals=(key,value)=>{window[key]=Array.isArray(value)?value:[];};
  const critical={cours:'/marche?type=cours',indices:'/marche?type=indices',entreprises:'/marche?type=entreprises',analyses:'/marche?type=analyses'};
  const secondary={indicesHistory:'/marche?type=indices_historique&limit=90',financials:'/marche?type=financials',dividendes:'/marche?type=dividendes',boc:'/boc',coupons:'/marche?type=coupons'};

  function publish(phase){
    window.entMap=Object.fromEntries((window.allEntreprises||[]).map(e=>[e.ticker,e]));
    try{allCours=window.allCours;allBoc=window.allBoc;allAnalyses=window.allAnalyses;allFinancials=window.allFinancials;allEntreprises=window.allEntreprises;allIndices=window.allIndices;}catch(e){}
    window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{phase,cours:(window.allCours||[]).length,indices:(window.allIndices||[]).length,analyses:(window.allAnalyses||[]).length,financials:(window.allFinancials||[]).length,entreprises:(window.allEntreprises||[]).length,dividendes:(window.allDividendes||[]).length,boc:(window.allBoc||[]).length}}));
  }
  async function fetchOne(key,endpoint){try{return unwrap(await window.apiGet(endpoint));}catch(e){console.warn('[LOADER] '+key,e);return null;}}
  async function loadMap(map,phase){
    const results=await Promise.all(map.map(async([name,endpoint])=>{
      const c=cached(endpoint);if(c!==null){setGlobals(name,unwrap(c));return[name,null,true];}
      const value=await fetchOne(name,endpoint);if(value!==null)setGlobals(name,value);return[name,value,false];
    }));
    results.forEach(([name,value])=>{if(value!==null)setGlobals(name,value);});publish(phase);return results;
  }
  async function loadCritical(){
    const map=[['allCours',critical.cours],['allIndicesLatest',critical.indices],['allEntreprises',critical.entreprises],['allAnalyses',critical.analyses]];
    let hadCache=false;
    map.forEach(([name,endpoint])=>{const c=cached(endpoint);if(c!==null){setGlobals(name,unwrap(c));hadCache=true;}else setGlobals(name,[]);});
    window.allIndices=Array.isArray(window.allIndicesLatest)?window.allIndicesLatest.slice():[];
    window.allIndicesHistory=Array.isArray(window.allIndicesHistory)?window.allIndicesHistory:[];
    window.allFinancials=window.allFinancials||[];window.allDividendes=window.allDividendes||[];window.allBoc=window.allBoc||[];window.allCoupons=window.allCoupons||[];
    if(hadCache)publish('cache');
    const results=await Promise.all(map.map(async([name,endpoint])=>[name,await fetchOne(name,endpoint)]));
    results.forEach(([name,value])=>{if(value!==null)setGlobals(name,value);});
    window.allIndices=Array.isArray(window.allIndicesLatest)?window.allIndicesLatest.slice():[];publish('critical');
  }
  const loading={};
  window.loadData=async function(key,endpoint,options){
    const target=endpoint||secondary[key];if(!target)throw new Error('Ressource inconnue: '+key);if(loading[target])return loading[target];
    loading[target]=(async()=>{const c=cached(target);const name=options?.globalName||key;if(c!==null)setGlobals(name,unwrap(c));try{const value=await fetchOne(key,target);if(value!==null)setGlobals(name,value);publish('ondemand');return window[name];}finally{delete loading[target];}})();
    return loading[target];
  };
  window.loadIndexHistory=()=>window.loadData('allIndicesHistory',secondary.indicesHistory,{globalName:'allIndicesHistory'}).then(v=>{window.allIndices=Array.isArray(window.allIndicesHistory)&&window.allIndicesHistory.length?window.allIndicesHistory:window.allIndices;publish('indices-history');if(typeof window.renderCurrentView==='function')window.renderCurrentView();return window.allIndicesHistory;});
  async function loadEnrichment(){
    const map=[['allFinancials',secondary.financials],['allDividendes',secondary.dividendes],['allBoc',secondary.boc],['allCoupons',secondary.coupons],['allIndicesHistory',secondary.indicesHistory]];
    await loadMap(map,'enrichment');if(Array.isArray(window.allIndicesHistory)&&window.allIndicesHistory.length)window.allIndices=window.allIndicesHistory;if(typeof window.renderCurrentView==='function')window.renderCurrentView();
  }
  window.loadAll=async function(){if(window.__tcLoadPromise)return window.__tcLoadPromise;window.__tcLoadPromise=(async()=>{console.log('[LOADER] Chargement optimisé…');await loadCritical();loadEnrichment().catch(e=>console.error('[LOADER] Enrichissement:',e));console.log('[LOADER] Critique prête | cours:',(window.allCours||[]).length,'| analyses:',(window.allAnalyses||[]).length);})();return window.__tcLoadPromise;};
  window.__tcOptimizedLoadAll=window.loadAll;
  // main.js possède encore un ancien loadAll local. Le pipeline optimisé est
  // donc déclenché indépendamment : fetch.js déduplique les requêtes identiques
  // et bloque les jeux lourds pendant le tout premier passage de main.js.
  function bootOptimized(){if(window.__tcOptimizedBooted)return;window.__tcOptimizedBooted=true;window.__TC_STARTUP_DATA_GATE__=true;setTimeout(function(){window.__TC_STARTUP_DATA_GATE__=false;window.__tcOptimizedLoadAll().catch(e=>console.error('[LOADER] Boot optimisé:',e));},0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootOptimized,{once:true});else bootOptimized();
  window.addEventListener('load',function(){var script=document.createElement('script');script.src='/app/js/views/financials-per.js?v=1';script.async=false;document.head.appendChild(script);});
})();
