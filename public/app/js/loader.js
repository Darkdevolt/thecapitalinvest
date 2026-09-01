(function(){
  'use strict';

  // Data loader partagé. Il expose window.loadAll pour compatibilité, mais ne
  // démarre plus de chargement réseau de lui-même : main.js est l'unique
  // orchestrateur du dashboard. Cela supprime la double initialisation et les
  // courses d'écriture sur window.all* qui laissaient parfois la vue vide.
  const unwrap = v => {
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.data)) return v.data;
    if (v && Array.isArray(v.rows)) return v.rows;
    if (v && Array.isArray(v.results)) return v.results;
    return [];
  };
  const cached = key => window.cacheManager?.getCache(key);
  const setGlobals = (key,value) => { window[key] = Array.isArray(value) ? value : []; };
  const critical = {
    cours:'/marche?type=cours',
    indices:'/marche?type=indices',
    entreprises:'/marche?type=entreprises',
    analyses:'/marche?type=analyses'
  };
  const secondary = {
    indicesHistory:'/marche?type=indices_historique&limit=90',
    financials:'/marche?type=financials',
    dividendes:'/marche?type=dividendes',
    boc:'/boc',
    coupons:'/marche?type=coupons'
  };

  function publish(phase){
    window.entMap=Object.fromEntries((window.allEntreprises||[]).map(e=>[e.ticker,e]));
    window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{
      phase,
      cours:(window.allCours||[]).length,
      indices:(window.allIndices||[]).length,
      analyses:(window.allAnalyses||[]).length,
      financials:(window.allFinancials||[]).length,
      entreprises:(window.allEntreprises||[]).length,
      dividendes:(window.allDividendes||[]).length,
      boc:(window.allBoc||[]).length
    }}));
  }

  async function fetchOne(key,endpoint){
    try { return unwrap(await window.apiGet(endpoint)); }
    catch(e) { console.warn('[LOADER] '+key,e); return null; }
  }

  async function loadMap(map,phase){
    const results=await Promise.all(map.map(async([name,endpoint])=>{
      const c=cached(endpoint);
      if(c!==null){ setGlobals(name,unwrap(c)); return [name,null,true]; }
      const value=await fetchOne(name,endpoint);
      if(value!==null) setGlobals(name,value);
      return [name,value,false];
    }));
    results.forEach(([name,value])=>{if(value!==null)setGlobals(name,value);});
    publish(phase);
    return results;
  }

  const loading={};
  window.loadData=async function(key,endpoint,options){
    const target=endpoint||secondary[key];
    if(!target) throw new Error('Ressource inconnue: '+key);
    if(loading[target]) return loading[target];
    loading[target]=(async()=>{
      const c=cached(target),name=options?.globalName||key;
      if(c!==null)setGlobals(name,unwrap(c));
      try{
        const value=await fetchOne(key,target);
        if(value!==null)setGlobals(name,value);
        publish('ondemand');
        return window[name];
      }finally{delete loading[target];}
    })();
    return loading[target];
  };

  window.loadIndexHistory=()=>window.loadData('allIndicesHistory',secondary.indicesHistory,{globalName:'allIndicesHistory'}).then(v=>{
    if(Array.isArray(window.allIndicesHistory)&&window.allIndicesHistory.length) window.allIndices=window.allIndicesHistory;
    publish('indices-history');
    if(typeof window.renderCurrentView==='function') window.renderCurrentView();
    return window.allIndicesHistory;
  });

  async function loadEnrichment(){
    const map=[
      ['allFinancials',secondary.financials],
      ['allDividendes',secondary.dividendes],
      ['allBoc',secondary.boc],
      ['allCoupons',secondary.coupons],
      ['allIndicesHistory',secondary.indicesHistory]
    ];
    await loadMap(map,'enrichment');
    if(Array.isArray(window.allIndicesHistory)&&window.allIndicesHistory.length)window.allIndices=window.allIndicesHistory;
    if(typeof window.renderCurrentView==='function')window.renderCurrentView();
  }

  // Compatibilité pour les modules qui demandent explicitement le loader.
  // Aucun auto-boot ici : main.js pilote le chargement principal.
  window.loadAll=async function(){
    if(window.__tcLoadPromise)return window.__tcLoadPromise;
    window.__tcLoadPromise=(async()=>{
      console.log('[LOADER] Chargement explicite demandé…');
      await loadMap(Object.entries(critical).map(([name,endpoint])=>[name==='indices'?'allIndicesLatest':name,endpoint]),'critical');
      window.allIndices=Array.isArray(window.allIndicesLatest)?window.allIndicesLatest.slice():[];
      return loadEnrichment();
    })();
    return window.__tcLoadPromise;
  };
  window.__tcOptimizedLoadAll=window.loadAll;

  window.__TC_STARTUP_DATA_GATE__=false;
  console.log('[LOADER] Loader prêt (auto-boot désactivé)');
})();
