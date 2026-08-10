// THE CAPITAL — Analyse technique : pont de données historique
// UI/front-end uniquement. Utilise l'endpoint existant sans le modifier.
(function(){
  'use strict';
  if(window.__atHistoryBridgeLoaded)return;
  window.__atHistoryBridgeLoaded=true;

  const norm=v=>String(v==null?'':v).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
  const tickerOf=r=>String(r?.ticker||r?.symbol||r?.symbole||r?.code||r?.code_titre||r?.valeur||'').trim().toUpperCase();
  const priceOf=r=>{for(const k of ['cours','cours_cloture','cloture','close','prix','last','last_price','price']){const n=Number(String(r?.[k]??'').replace(/\s/g,'').replace(/,/g,'.'));if(Number.isFinite(n)&&n>0)return n}return 0};

  async function fetchHistory(ticker){
    const q=encodeURIComponent(String(ticker||'').trim().toUpperCase());
    const res=await fetch(`/api/marche?type=historique&ticker=${q}&limit=1000`,{method:'GET',credentials:'same-origin',cache:'no-store'});
    if(!res.ok)throw new Error(`Historique HTTP ${res.status}`);
    const data=await res.json();
    if(!Array.isArray(data))throw new Error('Réponse historique invalide');
    return data;
  }

  async function resolveTickerHistory(requested){
    const current=(window.allCours||[]).find(r=>norm(tickerOf(r))===norm(requested)) ||
      (window.allCours||[]).find(r=>norm(tickerOf(r)).startsWith(norm(requested))||norm(requested).startsWith(norm(tickerOf(r))));
    const candidates=[tickerOf(current),String(requested||'').trim().toUpperCase()].filter(Boolean).filter((v,i,a)=>a.findIndex(x=>norm(x)===norm(v))===i);
    for(const tk of candidates){
      try{
        const rows=await fetchHistory(tk);
        if(rows.length)return {ticker:tk,rows};
      }catch(e){console.warn('[AT DATA] historique',tk,e.message)}
    }
    return {ticker:candidates[0]||requested,rows:[]};
  }

  function install(){
    if(typeof window.atLoadTicker!=='function')return false;
    if(window.atLoadTicker.__historyBridge)return true;
    const original=window.atLoadTicker;
    async function bridged(){
      const sel=document.getElementById('atTicker');
      const requested=sel?.value||window.AT?.ticker||'';
      if(!requested)return original();
      try{
        const result=await resolveTickerHistory(requested);
        if(result.rows.length){
          window.allCoursHistorique=Array.isArray(window.allCoursHistorique)?window.allCoursHistorique.slice():[];
          const key=norm(result.ticker);
          window.allCoursHistorique=window.allCoursHistorique.filter(r=>norm(tickerOf(r))!==key);
          window.allCoursHistorique.push(...result.rows);
          if(window.AT?.histCache)window.AT.histCache[result.ticker]=result.rows;
        }
      }catch(e){console.warn('[AT DATA] bridge',e)}
      const ok=await original();
      // Si l'original a refusé l'historique alors que le cours courant existe,
      // ne jamais perdre le cours affiché dans les autres vues.
      if(!ok && window.AT && !window.AT.hist.length){
        const row=(window.allCours||[]).find(r=>norm(tickerOf(r))===norm(requested));
        const px=priceOf(row);
        if(px>0){
          window.AT.hist=[{date:new Date().toISOString().slice(0,10),o:px,h:px,l:px,c:px,v:Number(row?.volume||0)}];
          if(typeof window.atRender==='function')window.atRender();
          return true;
        }
      }
      return ok;
    }
    bridged.__historyBridge=true;
    bridged.__originalAtLoadTicker=original;
    window.atLoadTicker=bridged;
    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer)},100);
  setTimeout(()=>clearInterval(timer),15000);
})();
