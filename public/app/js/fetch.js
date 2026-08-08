(function(){
  const API_BASE='/api';

  function normalizeEndpoint(endpoint){
    if (!endpoint) return API_BASE;
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    if (path === '/api' || path.startsWith('/api/')) return path;
    return API_BASE + path;
  }

  function getToken(){
    try {
      const session = JSON.parse(localStorage.getItem('tc_session') || 'null');
      if (session && session.access_token) return session.access_token;
    } catch(e) {}
    return localStorage.getItem('tc_token') || localStorage.getItem('token') || '';
  }

  window.apiGet=async function(endpoint,options){
    const url=normalizeEndpoint(endpoint);
    const token=getToken();
    const fetchOpts=Object.assign({},options||{}, {
      headers:Object.assign(
        {'Content-Type':'application/json','Accept':'application/json'},
        token?{'Authorization':'Bearer '+token}:{},
        (options&&options.headers)||{}
      )
    });
    const controller=new AbortController();
    const timeoutId=setTimeout(()=>controller.abort(),15000);
    fetchOpts.signal=controller.signal;
    const cached=window.cacheManager?window.cacheManager.getCache(endpoint):null;

    try{
      const res=await fetch(url,fetchOpts);
      clearTimeout(timeoutId);
      if(!res.ok){
        if(cached){console.warn('[API]',res.status,'- fallback cache:',endpoint);return cached;}
        throw new Error('HTTP '+res.status+' '+res.statusText);
      }
      const contentType=res.headers.get('content-type')||'';
      const data=contentType.includes('application/json')?await res.json():await res.text();
      if(window.cacheManager&&typeof data==='object')window.cacheManager.setCache(endpoint,data);
      return data;
    }catch(err){
      clearTimeout(timeoutId);
      if(cached){console.warn('[API] Fetch fail - cache fallback:',endpoint);return cached;}
      throw err;
    }
  };

  window.apiGetCours=function(){return window.apiGet('/marche?type=cours');};
  window.apiGetIndices=function(){return window.apiGet('/marche?type=indices');};
  window.apiGetEntreprises=function(){return window.apiGet('/marche?type=entreprises');};
  window.apiGetAnalyses=function(){return window.apiGet('/marche?type=analyses');};
  window.apiGetFinancials=function(){return window.apiGet('/marche?type=financials');};
  window.apiGetBOC=function(){return window.apiGet('/boc');};
  window.apiGetApercu=function(){return window.apiGet('/marche?type=apercu');};

  if(!window.api){
    window.api={
      get:window.apiGet,
      post:function(url,data,opts){return window.apiGet(url,Object.assign({},opts||{},{method:'POST',body:JSON.stringify(data)}));}
    };
  }
  console.log('[FETCH] apiGet prêt — base:',API_BASE);
})();
