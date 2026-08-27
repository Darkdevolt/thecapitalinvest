(function(){
  // Chargement centralisé des données. Les variables sont toujours lues/écrites
  // via window afin d'éviter les divergences entre loader.js et ui.js.
  window.loadAll=async function(){
    console.log('[LOADER] Chargement des données...');
    const endpoints={
      cours:window.apiGetCours,
      indices:window.apiGetIndices,
      indicesHistory:()=>window.apiGetIndicesHistory(30),
      entreprises:window.apiGetEntreprises,
      analyses:window.apiGetAnalyses,
      financials:window.apiGetFinancials,
      dividendes:()=>window.apiGet('/marche?type=dividendes'),
      boc:window.apiGetBOC
    };
    try{
      const keys=Object.keys(endpoints);
      const results=await Promise.allSettled(keys.map(k=>endpoints[k]()));
      const unwrap=v=>{
        if(Array.isArray(v))return v;
        if(v&&Array.isArray(v.data))return v.data;
        if(v&&Array.isArray(v.rows))return v.rows;
        if(v&&Array.isArray(v.results))return v.results;
        return [];
      };
      const data={};
      keys.forEach((k,i)=>{data[k]=results[i].status==='fulfilled'?unwrap(results[i].value):[];if(results[i].status==='rejected')console.error('[LOADER] '+k+':',results[i].reason);});

      window.allCours=data.cours;
      window.allIndicesLatest=data.indices;
      window.allIndices=data.indicesHistory.length?data.indicesHistory:data.indices.slice();
      window.allEntreprises=data.entreprises;
      window.allAnalyses=data.analyses;
      window.allFinancials=data.financials;
      window.allDividendes=data.dividendes;
      window.allBoc=data.boc;
      window.entMap=Object.fromEntries(window.allEntreprises.map(e=>[e.ticker,e]));

      // Compatibilité avec les anciens modules qui utilisent les identifiants
      // globaux directement au lieu de window.*.
      try{allCours=window.allCours;allBoc=window.allBoc;allAnalyses=window.allAnalyses;allFinancials=window.allFinancials;allEntreprises=window.allEntreprises;allIndices=window.allIndices;}catch(e){}

      console.log('[LOADER] OK | cours:',window.allCours.length,'| analyses:',window.allAnalyses.length,'| financials:',window.allFinancials.length,'| entreprises:',window.allEntreprises.length,'| dividendes:',window.allDividendes.length);
      window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{cours:window.allCours.length,indices:window.allIndices.length,analyses:window.allAnalyses.length,financials:window.allFinancials.length,entreprises:window.allEntreprises.length,dividendes:window.allDividendes.length,boc:window.allBoc.length}}));
      // Le renderer de ui.js peut être appelé ici même si son propre loadAll n'a
      // pas encore été exécuté : les données sont déjà disponibles.
      if(typeof window.renderCurrentView==='function')window.renderCurrentView();
      else if(typeof window.renderAnalyses==='function'&&document.getElementById('analysesList'))window.renderAnalyses();
    }catch(e){
      console.error('[LOADER] Erreur:',e);
      window.allCours=[];window.allIndices=[];window.allIndicesLatest=[];window.entMap={};window.allEntreprises=[];window.allAnalyses=[];window.allFinancials=[];window.allDividendes=[];window.allBoc=[];
    }
  };

  window.addEventListener('load',function(){
    var script=document.createElement('script');
    script.src='/app/js/views/financials-per.js?v=1';
    script.async=false;
    document.head.appendChild(script);
  });
})();
