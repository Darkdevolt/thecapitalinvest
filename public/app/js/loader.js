(function(){
  // Chargement optimisé : les données déjà présentes dans le cache sont affichées
  // immédiatement. Les données critiques sont chargées en priorité ; les jeux
  // lourds (financials, dividendes, BOC) arrivent ensuite sans bloquer l'interface.
  const unwrap=v=>{
    if(Array.isArray(v))return v;
    if(v&&Array.isArray(v.data))return v.data;
    if(v&&Array.isArray(v.rows))return v.rows;
    if(v&&Array.isArray(v.results))return v.results;
    return [];
  };
  const cached=key=>window.cacheManager?.getCache(key);
  const setGlobals=(key,value)=>{window[key]=Array.isArray(value)?value:[];};
  const critical={
    cours:'/marche?type=cours',
    indices:'/marche?type=indices',
    history:'/marche?type=indices_historique&limit=30',
    entreprises:'/marche?type=entreprises',
    analyses:'/marche?type=analyses'
  };
  const enrich={
    financials:'/marche?type=financials',
    dividendes:'/marche?type=dividendes',
    boc:'/boc'
  };

  function publish(phase){
    window.entMap=Object.fromEntries((window.allEntreprises||[]).map(e=>[e.ticker,e]));
    try{
      allCours=window.allCours;allBoc=window.allBoc;allAnalyses=window.allAnalyses;
      allFinancials=window.allFinancials;allEntreprises=window.allEntreprises;
      allIndices=window.allIndices;
    }catch(e){}
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
    try{return unwrap(await window.apiGet(endpoint));}
    catch(e){console.warn('[LOADER] '+key,e);return null;}
  }

  async function loadCritical(){
    const map=[
      ['allCours',critical.cours],
      ['allIndicesLatest',critical.indices],
      ['allIndices',critical.history],
      ['allEntreprises',critical.entreprises],
      ['allAnalyses',critical.analyses]
    ];
    // Cache-first : premier rendu sans attendre le réseau.
    let hadCache=false;
    map.forEach(([name,endpoint])=>{
      const c=cached(endpoint);
      if(c!==null){setGlobals(name,unwrap(c));hadCache=true;}
      else if(name==='allCours')setGlobals(name,[]);
      else if(name==='allIndicesLatest')setGlobals(name,[]);
      else if(name==='allIndices')setGlobals(name,[]);
      else if(name==='allEntreprises')setGlobals(name,[]);
      else if(name==='allAnalyses')setGlobals(name,[]);
    });
    if(!(window.allIndices||[]).length)window.allIndices=(window.allIndicesLatest||[]).slice();
    window.allFinancials=window.allFinancials||[];window.allDividendes=window.allDividendes||[];window.allBoc=window.allBoc||[];
    if(hadCache)publish('cache');

    // Les appels réseau restent parallèles mais ne bloquent plus le premier rendu.
    const results=await Promise.all(map.map(async([name,endpoint])=>[name,await fetchOne(name,endpoint)]));
    results.forEach(([name,value])=>{if(value!==null)setGlobals(name,value);});
    if(!(window.allIndices||[]).length)window.allIndices=(window.allIndicesLatest||[]).slice();
    publish('critical');
  }

  async function loadEnrichment(){
    const map=[['allFinancials',enrich.financials],['allDividendes',enrich.dividendes],['allBoc',enrich.boc]];
    const results=await Promise.all(map.map(async([name,endpoint])=>{
      const c=cached(endpoint);
      if(c!==null){setGlobals(name,unwrap(c));return[name,null];}
      return[name,await fetchOne(name,endpoint)];
    }));
    results.forEach(([name,value])=>{if(value!==null)setGlobals(name,value);});
    publish('enrichment');
    if(typeof window.renderCurrentView==='function')window.renderCurrentView();
    else if(typeof window.renderAnalyses==='function'&&document.getElementById('analysesList'))window.renderAnalyses();
  }

  window.loadAll=async function(){
    if(window.__tcLoadPromise)return window.__tcLoadPromise;
    window.__tcLoadPromise=(async()=>{
      console.log('[LOADER] Chargement optimisé…');
      await loadCritical();
      // L'enrichissement ne retarde plus l'affichage initial.
      loadEnrichment().catch(e=>console.error('[LOADER] Enrichissement:',e));
      console.log('[LOADER] Critique prête | cours:',(window.allCours||[]).length,'| analyses:',(window.allAnalyses||[]).length);
    })();
    return window.__tcLoadPromise;
  };

  // Aucun second chargement complet ici : loadAll est désormais l'unique pipeline.
  window.addEventListener('load',function(){
    var script=document.createElement('script');
    script.src='/app/js/views/financials-per.js?v=1';
    script.async=false;
    document.head.appendChild(script);
  });
})();
