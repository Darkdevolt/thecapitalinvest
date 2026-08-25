(function(){
  window.loadAll=async function(){
    console.log('[LOADER] Chargement...');
    try{
      const [coursRes,indicesRes,indicesHistoryRes,entRes,analysesRes]=await Promise.allSettled([
        window.apiGetCours(),
        window.apiGetIndices(),
        window.apiGetIndicesHistory(30),
        window.apiGetEntreprises(),
        window.apiGetAnalyses()
      ]);

      if(coursRes.status==='fulfilled'){
        const d=coursRes.value;window.allCours=d?.data||d||[];
      }else{window.allCours=[];console.error('[LOADER] Cours:',coursRes.reason);}

      if(indicesRes.status==='fulfilled'){
        const d=indicesRes.value;window.allIndicesLatest=d?.data||d||[];
      }else{window.allIndicesLatest=[];}

      if(indicesHistoryRes.status==='fulfilled'){
        const d=indicesHistoryRes.value;window.allIndices=d?.data||d||[];
        // Fallback to the latest-session payload if historical loading fails.
        if(!window.allIndices.length) window.allIndices=window.allIndicesLatest.slice();
      }else{
        window.allIndices=window.allIndicesLatest.slice();
        console.error('[LOADER] Historique indices:',indicesHistoryRes.reason);
      }

      if(entRes.status==='fulfilled'){
        const d=entRes.value;const ents=d?.data||d||[];
        window.entMap={};window.allEntreprises=ents;
        ents.forEach(e=>{if(e.ticker)window.entMap[e.ticker]=e;});
      }else{window.entMap={};window.allEntreprises=[];}

      if(analysesRes.status==='fulfilled'){
        const d=analysesRes.value;window.allAnalyses=d?.data||d||[];
      }else{window.allAnalyses=[];}

      console.log('[LOADER] OK - Cours:',window.allCours.length,'| Indices:',window.allIndices.length,'| Indices latest:',window.allIndicesLatest.length,'| Ent:',Object.keys(window.entMap).length);
      window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{cours:window.allCours.length,indices:window.allIndices.length}}));
    }catch(e){
      console.error('[LOADER] Erreur:',e);
      window.allCours=[];window.allIndices=[];window.allIndicesLatest=[];window.entMap={};window.allEntreprises=[];window.allAnalyses=[];
    }
  };

  // Load the isolated historical PER patch only after every application script
  // is loaded, so it can safely wrap the financials view without replacing it.
  window.addEventListener('load',function(){
    var script=document.createElement('script');
    script.src='/app/js/views/financials-per.js?v=1';
    script.async=false;
    document.head.appendChild(script);
  });
})();
