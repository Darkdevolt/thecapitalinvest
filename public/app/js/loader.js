(function(){
  window.loadAll=async function(){
    console.log('[LOADER] Chargement...');
    try{
      const [coursRes,indicesRes,entRes,analysesRes]=await Promise.allSettled([
        window.apiGetCours(),
        window.apiGetIndices(),
        window.apiGetEntreprises(),
        window.apiGetAnalyses()
      ]);

      if(coursRes.status==='fulfilled'){
        const d=coursRes.value;window.allCours=d?.data||d||[];
      }else{window.allCours=[];console.error('[LOADER] Cours:',coursRes.reason);}

      if(indicesRes.status==='fulfilled'){
        const d=indicesRes.value;window.allIndices=d?.data||d||[];
      }else{window.allIndices=[];}

      if(entRes.status==='fulfilled'){
        const d=entRes.value;const ents=d?.data||d||[];
        window.entMap={};ents.forEach(e=>{if(e.ticker)window.entMap[e.ticker]=e;});
      }else{window.entMap={};}

      if(analysesRes.status==='fulfilled'){
        const d=analysesRes.value;window.allAnalyses=d?.data||d||[];
      }else{window.allAnalyses=[];}

      console.log('[LOADER] OK - Cours:',window.allCours.length,'| Indices:',window.allIndices.length,'| Ent:',Object.keys(window.entMap).length);
      window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{cours:window.allCours.length,indices:window.allIndices.length}}));
    }catch(e){
      console.error('[LOADER] Erreur:',e);
      window.allCours=[];window.allIndices=[];window.entMap={};window.allAnalyses=[];
    }
  };
})();
