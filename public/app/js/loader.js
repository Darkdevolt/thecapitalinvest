(function(){
  // Chargement centralisé des données. Les variables sont toujours lues/écrites
  // via window afin d'éviter les divergences entre modules.
  async function hydrateRecommendationData(){
    try{
      if(typeof window.apiGetAnalyses!=='function')return;
      const jobs=await Promise.allSettled([
        window.apiGetAnalyses(),
        typeof window.apiGetFinancials==='function'?window.apiGetFinancials():Promise.resolve([]),
        typeof window.apiGetEntreprises==='function'?window.apiGetEntreprises():Promise.resolve([]),
        typeof window.apiGetCours==='function'?window.apiGetCours():Promise.resolve([]),
        typeof window.apiGet==='function'?window.apiGet('/marche?type=dividendes'):Promise.resolve([])
      ]);
      const unwrap=v=>{if(Array.isArray(v))return v;if(v&&Array.isArray(v.data))return v.data;if(v&&Array.isArray(v.rows))return v.rows;if(v&&Array.isArray(v.results))return v.results;return[]};
      const get=i=>jobs[i].status==='fulfilled'?unwrap(jobs[i].value):[];
      window.allAnalyses=get(0);
      window.allFinancials=get(1);
      window.allEntreprises=get(2);
      window.allCours=get(3);
      window.allDividendes=get(4);
      window.entMap=Object.fromEntries(window.allEntreprises.map(e=>[e.ticker,e]));
      // Certains anciens modules déclarent les collections comme globals.
      try{allAnalyses=window.allAnalyses;allFinancials=window.allFinancials;allEntreprises=window.allEntreprises;allCours=window.allCours;}catch(e){}
      console.log('[RECOMMENDATIONS] Données synchronisées | analyses:',window.allAnalyses.length,'financials:',window.allFinancials.length,'entreprises:',window.allEntreprises.length,'cours:',window.allCours.length);
      if(typeof window.renderAnalyses==='function')window.renderAnalyses();
    }catch(e){console.error('[RECOMMENDATIONS] Synchronisation impossible:',e);}
  }

  window.loadAll=async function(){
    console.log('[LOADER] Chargement des données...');
    const jobs=await Promise.allSettled([
      window.apiGetCours(),window.apiGetIndices(),window.apiGetIndicesHistory(30),window.apiGetEntreprises(),
      window.apiGetAnalyses(),window.apiGetFinancials(),window.apiGet('/marche?type=dividendes'),window.apiGetBOC()
    ]);
    const unwrap=v=>{if(Array.isArray(v))return v;if(v&&Array.isArray(v.data))return v.data;if(v&&Array.isArray(v.rows))return v.rows;if(v&&Array.isArray(v.results))return v.results;return[]};
    const get=i=>jobs[i].status==='fulfilled'?unwrap(jobs[i].value):[];
    window.allCours=get(0);window.allIndicesLatest=get(1);window.allIndices=get(2).length?get(2):get(1);window.allEntreprises=get(3);window.allAnalyses=get(4);window.allFinancials=get(5);window.allDividendes=get(6);window.allBoc=get(7);
    window.entMap=Object.fromEntries(window.allEntreprises.map(e=>[e.ticker,e]));
    try{allCours=window.allCours;allBoc=window.allBoc;allAnalyses=window.allAnalyses;allFinancials=window.allFinancials;allEntreprises=window.allEntreprises;allIndices=window.allIndices;}catch(e){}
    console.log('[LOADER] OK | cours:',window.allCours.length,'| analyses:',window.allAnalyses.length,'| financials:',window.allFinancials.length,'| entreprises:',window.allEntreprises.length,'| dividendes:',window.allDividendes.length);
    window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{cours:window.allCours.length,indices:window.allIndices.length,analyses:window.allAnalyses.length,financials:window.allFinancials.length,entreprises:window.allEntreprises.length,dividendes:window.allDividendes.length,boc:window.allBoc.length}}));
    if(typeof window.renderCurrentView==='function')window.renderCurrentView();
    else if(typeof window.renderAnalyses==='function'&&document.getElementById('analysesList'))window.renderAnalyses();
  };

  // Sécurité : même si ui.js remplace loadAll ou si le premier chargement
  // arrive avant la définition de toutes les vues, on hydrate une seconde fois
  // lorsque tous les scripts sont présents.
  window.addEventListener('load',function(){
    setTimeout(function(){
      hydrateRecommendationData();
      var script=document.createElement('script');
      script.src='/app/js/views/financials-per.js?v=1';
      script.async=false;
      document.head.appendChild(script);
    },150);
  });
})();
