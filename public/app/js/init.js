(function(){
  function init(){
    console.log('[INIT] Démarrage...');
    if(typeof window.loadAll==='function'){
      window.loadAll().then(function(){
        console.log('[INIT] Données OK');
        if(typeof window.initApp==='function'){try{window.initApp();}catch(e){console.error('[INIT] initApp:',e);}}
        if(window.marketsModule&&typeof window.marketsModule.loadData==='function'){try{window.marketsModule.loadData();}catch(e){}}
      }).catch(function(err){console.error('[INIT] Erreur loadAll:',err);});
    }else{console.error('[INIT] loadAll manquant');}
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();
