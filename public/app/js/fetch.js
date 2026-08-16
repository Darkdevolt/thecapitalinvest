(function(){
  const API_BASE='/api';

  function normalizeEndpoint(endpoint){
    if(!endpoint) return API_BASE;
    if(/^https?:\/\//i.test(endpoint)) return endpoint;
    const path=endpoint.startsWith('/')?endpoint:'/'+endpoint;
    if(path==='/api'||path.startsWith('/api/')) return path;
    return API_BASE+path;
  }

  function getToken(){
    try{
      const session=JSON.parse(localStorage.getItem('tc_session')||'null');
      if(session?.access_token) return session.access_token;
    }catch(e){}
    return localStorage.getItem('tc_token')||localStorage.getItem('token')||'';
  }

  async function request(method,endpoint,body,options){
    const url=normalizeEndpoint(endpoint);
    const opts=options||{};
    const token=getToken();
    const headers=Object.assign(
      {'Accept':'application/json'},
      body!==undefined?{'Content-Type':'application/json'}:{},
      token?{'Authorization':'Bearer '+token}:{},
      opts.headers||{}
    );
    const controller=new AbortController();
    const timeoutId=setTimeout(()=>controller.abort(),15000);
    const fetchOpts=Object.assign({},opts,{method,headers,signal:controller.signal});
    if(body!==undefined) fetchOpts.body=typeof body==='string'?body:JSON.stringify(body);

    const cacheKey=method==='GET'?endpoint:null;
    const cached=cacheKey&&window.cacheManager?window.cacheManager.getCache(cacheKey):null;
    try{
      const res=await fetch(url,fetchOpts);
      clearTimeout(timeoutId);
      const contentType=res.headers.get('content-type')||'';
      const data=contentType.includes('application/json')?await res.json():await res.text();
      if(!res.ok){
        const message=(data&&data.error)||(data&&data.message)||res.statusText||('HTTP '+res.status);
        throw new Error('HTTP '+res.status+' '+message);
      }
      if(cacheKey&&window.cacheManager&&data&&typeof data==='object') window.cacheManager.setCache(cacheKey,data);
      return data;
    }catch(err){
      clearTimeout(timeoutId);
      if(method==='GET'&&cached){console.warn('[API] fallback cache:',endpoint);return cached;}
      if(err.name==='AbortError') throw new Error('API timeout: '+endpoint);
      throw err;
    }
  }

  window.apiGet=(endpoint,options)=>request('GET',endpoint,undefined,options);
  window.apiPost=(endpoint,data,options)=>request('POST',endpoint,data,options);
  window.apiPut=(endpoint,data,options)=>request('PUT',endpoint,data,options);
  window.apiPatch=(endpoint,data,options)=>request('PATCH',endpoint,data,options);
  window.apiDelete=(endpoint,data,options)=>request('DELETE',endpoint,data,options);

  window.apiGetCours=()=>window.apiGet('/marche?type=cours');
  window.apiGetIndices=()=>window.apiGet('/marche?type=indices');
  window.apiGetEntreprises=()=>window.apiGet('/marche?type=entreprises');
  window.apiGetAnalyses=()=>window.apiGet('/marche?type=analyses');
  window.apiGetFinancials=()=>window.apiGet('/marche?type=financials');
  window.apiGetBOC=()=>window.apiGet('/boc');
  window.apiGetApercu=()=>window.apiGet('/marche?type=apercu');
  window.apiGetPerHistory=(ticker)=>window.apiGet('/per-history?ticker='+encodeURIComponent(String(ticker||'').trim().toUpperCase()));
  window.apiRefreshPerHistory=(ticker,full)=>window.apiPost('/per-history',{ticker:String(ticker||'').trim().toUpperCase(),full:full!==false});

  window.api={
    get:window.apiGet,
    post:window.apiPost,
    put:window.apiPut,
    patch:window.apiPatch,
    delete:window.apiDelete
  };

  // Patch chargé dynamiquement pour éviter de modifier l'ordre des modules
  // historiques de l'application. Il se réessaie jusqu'à ce que les vues
  // Titres/Fiche aient exposé leurs fonctions globales.
  function loadTitleFixes(){
    if(document.getElementById('tc-title-fixes-script')) return;
    const s=document.createElement('script');
    s.id='tc-title-fixes-script';
    s.src='/app/js/titres-navigation-fixes.js?v=20260815';
    s.async=false;
    s.onload=()=>console.log('[FETCH] Patch Titres/Fiche chargé');
    s.onerror=()=>console.warn('[FETCH] Patch Titres/Fiche indisponible');
    (document.head||document.documentElement).appendChild(s);
  }

  function loadPerHistory(){
    if(document.getElementById('tc-per-history-script')) return;
    const s=document.createElement('script');
    s.id='tc-per-history-script';
    s.src='/app/js/views/per-history.js?v=20260816';
    s.async=false;
    s.onload=()=>console.log('[FETCH] Historique PER chargé');
    s.onerror=()=>console.warn('[FETCH] Historique PER indisponible');
    (document.head||document.documentElement).appendChild(s);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',loadTitleFixes,{once:true});
    document.addEventListener('DOMContentLoaded',loadPerHistory,{once:true});
  }else{
    loadTitleFixes();
    loadPerHistory();
  }

  console.log('[FETCH] API client chargé, CRUD HTTP complet');
})();
