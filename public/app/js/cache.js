(function(){
  const CACHE_PREFIX='tc_cache_';
  const CACHE_TTL=5*60*1000;
  function now(){return Date.now();}
  window.cacheManager={
    CACHE_PREFIX:CACHE_PREFIX,
    getCache:function(key){
      try{
        const raw=localStorage.getItem(CACHE_PREFIX+key);
        if(!raw)return null;
        const entry=JSON.parse(raw);
        if(!entry||!entry._ts)return null;
        if(now()-entry._ts>CACHE_TTL){localStorage.removeItem(CACHE_PREFIX+key);return null;}
        return entry.data;
      }catch(e){return null;}
    },
    setCache:function(key,data){
      try{
        localStorage.setItem(CACHE_PREFIX+key,JSON.stringify({_ts:now(),data:data}));
        return true;
      }catch(e){
        if(e.name==='QuotaExceededError'||e.code===22){
          window.cacheManager.clearOldCaches();
          try{localStorage.setItem(CACHE_PREFIX+key,JSON.stringify({_ts:now(),data:data}));return true;}catch(e2){return false;}
        }
        return false;
      }
    },
    clearOldCaches:function(){
      const keys=Object.keys(localStorage).filter(k=>k.startsWith(CACHE_PREFIX));
      const entries=keys.map(k=>{
        try{return{key:k,ts:JSON.parse(localStorage.getItem(k))._ts||0};}
        catch(e){return{key:k,ts:0};}
      }).sort((a,b)=>a.ts-b.ts);
      entries.slice(0,Math.ceil(entries.length/2)).forEach(e=>localStorage.removeItem(e.key));
    },
    clearAll:function(){
      Object.keys(localStorage).filter(k=>k.startsWith(CACHE_PREFIX)).forEach(k=>localStorage.removeItem(k));
    }
  };
})();
