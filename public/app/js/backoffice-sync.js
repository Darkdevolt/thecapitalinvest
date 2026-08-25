/* ============================================================
   THE CAPITAL — BACK-OFFICE / APP BRIDGE
   Source de vérité : back-office / API publique.
   Ne bloque jamais le rendu initial.
   ============================================================ */
(function (w) {
  'use strict';
  var state = w.TC_BACKOFFICE = w.TC_BACKOFFICE || {
    status:'idle', startedAt:null, finishedAt:null, lastSync:null, sources:{}, errors:[], version:'1.2.0'
  };
  var sources = {
    entreprises:function(){return w.apiGetEntreprises?w.apiGetEntreprises():w.apiGet('/marche?type=entreprises');},
    cours:function(){return w.apiGetCours?w.apiGetCours():w.apiGet('/marche?type=cours');},
    indices:function(){return w.apiGetIndices?w.apiGetIndices():w.apiGet('/marche?type=indices');},
    indices_historique:function(){return w.apiGetIndicesHistory?w.apiGetIndicesHistory(30):w.apiGet('/marche?type=indices_historique&limit=30');},
    dividendes:function(){return w.apiGet('/marche?type=dividendes');},
    analyses:function(){return w.apiGetAnalyses?w.apiGetAnalyses():w.apiGet('/marche?type=analyses');},
    financials:function(){return w.apiGetFinancials?w.apiGetFinancials():w.apiGet('/marche?type=financials');},
    boc:function(){return w.apiGetBOC?w.apiGetBOC():w.apiGet('/boc');},
    apercu:function(){return w.apiGetApercu?w.apiGetApercu():w.apiGet('/marche?type=apercu');}
  };
  function emit(type,detail){try{w.dispatchEvent(new CustomEvent(type,{detail:detail||{}}));}catch(e){}}
  function unwrap(data){if(data&&Array.isArray(data.data))return data.data;if(data&&Array.isArray(data.rows))return data.rows;return data;}
  function publish(key,data){
    var value=unwrap(data);
    state.sources[key]={ok:true,fetchedAt:new Date().toISOString(),count:Array.isArray(value)?value.length:null,data:value};
    var globals={entreprises:'allEntreprises',cours:'allCours',indices:'allIndices',indices_historique:'allIndicesHistory',dividendes:'allDividendes',analyses:'allAnalyses',financials:'allFinancials',boc:'allBoc',apercu:'allApercu'};
    if(globals[key]&&Array.isArray(value))w[globals[key]]=value;
    emit('tc:backoffice-source-updated',{source:key,data:value,count:state.sources[key].count});
  }
  async function sync(options){
    options=options||{}; if(state.status==='loading'&&!options.force)return state;
    state.status='loading';state.startedAt=new Date().toISOString();state.errors=[];emit('tc:backoffice-sync-start',state);
    var keys=Object.keys(sources), results=await Promise.allSettled(keys.map(function(key){return Promise.resolve().then(function(){return sources[key]();});}));
    results.forEach(function(result,i){var key=keys[i];if(result.status==='fulfilled')publish(key,result.value);else{var error=String(result.reason&&result.reason.message||result.reason||'Erreur inconnue');state.sources[key]={ok:false,fetchedAt:new Date().toISOString(),error:error};state.errors.push({source:key,error:error});}});
    state.finishedAt=new Date().toISOString();state.lastSync=state.finishedAt;state.status=state.errors.length?'partial':'ready';emit('tc:backoffice-sync-complete',state);return state;
  }
  function get(source){var item=state.sources[source];return item&&item.ok?item.data:null;}
  function freshness(source){var item=state.sources[source];return item&&item.fetchedAt?Math.max(0,Date.now()-new Date(item.fetchedAt).getTime()):null;}
  w.tcBackofficeSync=sync;w.tcBackofficeData=get;w.tcBackofficeFreshness=freshness;
  function start(){setTimeout(function(){sync();},0);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
