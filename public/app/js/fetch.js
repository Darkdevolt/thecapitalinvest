(function(){
  const API_BASE='/api';
  const inflight=new Map();
  const startupBackground=new Map();
  const HEAVY_STARTUP=/^\/marche\?type=(financials|dividendes|historique|indices_historique|coupons)(?:&|$)|^\/boc(?:\?|$)/;

  function normalizeEndpoint(endpoint){
    if(!endpoint)return API_BASE;
    if(/^https?:\/\//i.test(endpoint))return endpoint;
    const path=endpoint.startsWith('/')?endpoint:'/'+endpoint;
    if(path==='/api'||path.startsWith('/api/'))return path;
    return API_BASE+path;
  }

  function getToken(){
    if(window.TC_ENV&&typeof window.TC_ENV.getToken==='function'){
      const token=window.TC_ENV.getToken();
      if(token)return token;
    }
    try{
      const stored=JSON.parse(localStorage.getItem('tc_session')||'null');
      const session=(stored&&stored.data&&stored.data.session)||(stored&&stored.session)||stored;
      if(session&&session.access_token)return session.access_token;
    }catch(e){}
    return localStorage.getItem('tc_token')||localStorage.getItem('token')||'';
  }

  function scheduleHeavyStartup(endpoint,options){
    if(startupBackground.has(endpoint))return;
    const opts=Object.assign({},options||{},{__tcBackground:true});
    const run=()=>request('GET',endpoint,undefined,opts)
      .then(()=>console.log('[API] Données lourdes chargées en arrière-plan:',endpoint))
      .catch(err=>console.warn('[API] Chargement arrière-plan:',endpoint,err.message||err))
      .finally(()=>startupBackground.delete(endpoint));
    startupBackground.set(endpoint,true);
    if(window.requestIdleCallback)window.requestIdleCallback(run,{timeout:2500});
    else setTimeout(run,900);
  }

  async function request(method,endpoint,body,options){
    const opts=options||{};
    const isBackground=opts.__tcBackground===true;

    /*
     * Le premier écran ne doit jamais attendre les gros datasets.
     * main.js est exécuté avant init.js dans app.html : le gate doit donc
     * vivre ici, au niveau du client API, pour être effectif dès le bootstrap.
     * Une donnée en cache est rendue immédiatement ; sinon un tableau vide
     * permet au dashboard de s'afficher et la vraie requête part en idle.
     */
    if(method==='GET'&&!isBackground&&HEAVY_STARTUP.test(endpoint)){
      let cached=null;
      try{cached=window.cacheManager&&window.cacheManager.getCache(endpoint);}catch(e){}
      scheduleHeavyStartup(endpoint,options);
      if(cached!==null&&cached!==undefined)return cached;
      return [];
    }

    const url=normalizeEndpoint(endpoint);
    const key=method==='GET'?endpoint:null;
    if(key&&inflight.has(key))return inflight.get(key);

    const fetchOptions=Object.assign({},opts);
    delete fetchOptions.__tcBackground;

    const promise=(async()=>{
      const token=getToken();
      const headers=Object.assign(
        {'Accept':'application/json'},
        body!==undefined?{'Content-Type':'application/json'}:{},
        token?{'Authorization':'Bearer '+token}:{},
        fetchOptions.headers||{}
      );
      const controller=new AbortController();
      const timeoutId=setTimeout(()=>controller.abort(),15000);
      const fetchOpts=Object.assign({},fetchOptions,{method,headers,signal:controller.signal});
      if(body!==undefined)fetchOpts.body=typeof body==='string'?body:JSON.stringify(body);

      const cached=key&&window.cacheManager?window.cacheManager.getCache(key):null;
      try{
        const res=await fetch(url,fetchOpts);
        clearTimeout(timeoutId);
        const contentType=res.headers.get('content-type')||'';
        const data=contentType.includes('application/json')?await res.json():await res.text();
        if(!res.ok){
          const message=(data&&data.error)||(data&&data.message)||res.statusText||('HTTP '+res.status);
          throw new Error('HTTP '+res.status+' '+message);
        }
        if(key&&window.cacheManager&&data&&typeof data==='object')window.cacheManager.setCache(key,data);
        return data;
      }catch(err){
        clearTimeout(timeoutId);
        if(method==='GET'&&cached){
          console.warn('[API] fallback cache:',endpoint);
          return cached;
        }
        if(err.name==='AbortError')throw new Error('API timeout: '+endpoint);
        throw err;
      }
    })();

    if(key)inflight.set(key,promise);
    try{return await promise;}
    finally{if(key&&inflight.get(key)===promise)inflight.delete(key);}
  }

  window.apiGet=(endpoint,options)=>request('GET',endpoint,undefined,options);
  window.apiPost=(endpoint,data,options)=>request('POST',endpoint,data,options);
  window.apiPut=(endpoint,data,options)=>request('PUT',endpoint,data,options);
  window.apiPatch=(endpoint,data,options)=>request('PATCH',endpoint,data,options);
  window.apiDelete=(endpoint,data,options)=>request('DELETE',endpoint,data,options);
  window.apiGetCours=()=>window.apiGet('/marche?type=cours');
  window.apiGetIndices=()=>window.apiGet('/marche?type=indices');
  window.apiGetIndicesHistory=(limit=30)=>window.apiGet('/marche?type=indices_historique&limit='+encodeURIComponent(limit));
  window.apiGetEntreprises=()=>window.apiGet('/marche?type=entreprises');
  window.apiGetAnalyses=()=>window.apiGet('/marche?type=analyses');
  window.apiGetFinancials=()=>window.apiGet('/marche?type=financials');
  window.apiGetBOC=()=>window.apiGet('/boc');
  window.apiGetApercu=()=>window.apiGet('/marche?type=apercu');
  window.api={get:window.apiGet,post:window.apiPost,put:window.apiPut,patch:window.apiPatch,delete:window.apiDelete};

  function loadTitleFixes(){
    if(document.getElementById('tc-title-fixes-script'))return;
    const s=document.createElement('script');
    s.id='tc-title-fixes-script';
    s.src='/app/js/views/titres-navigation-fixes.js?v=20260815';
    s.async=false;
    s.onload=()=>console.log('[FETCH] Patch Titres/Fiche chargé');
    s.onerror=()=>console.warn('[FETCH] Patch Titres/Fiche indisponible');
    (document.head||document.documentElement).appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadTitleFixes,{once:true});
  else loadTitleFixes();
  console.log('[FETCH] API client chargé, démarrage léger + données lourdes différées');
})();
