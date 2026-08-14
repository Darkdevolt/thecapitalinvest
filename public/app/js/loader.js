// UNIFIED DATA LOADER
(function(){
  'use strict';
  var loading = null;
  function normalize(res){ return res && typeof res === 'object' && 'data' in res ? res.data : res; }
  function api(endpoint){
    if(typeof window.apiGet !== 'function') return Promise.reject(new Error('apiGet indisponible'));
    return window.apiGet(endpoint);
  }
  window.loadAll = function(force){
    if(loading && !force) return loading;
    loading = Promise.allSettled([
      api('/marche?type=cours'),
      api('/marche?type=indices'),
      api('/marche?type=entreprises'),
      api('/marche?type=analyses'),
      api('/marche?type=financials'),
      api('/boc')
    ]).then(function(r){
      var cours=normalize(r[0].value)||[], indices=normalize(r[1].value)||[], ents=normalize(r[2].value)||[], analyses=normalize(r[3].value)||[], financials=normalize(r[4].value)||[], boc=normalize(r[5].value)||[];
      window.allCours=Array.isArray(cours)?cours:[];
      window.allIndices=Array.isArray(indices)?indices:[];
      window.allEntreprises=Array.isArray(ents)?ents:[];
      window.allAnalyses=Array.isArray(analyses)?analyses:[];
      window.allFinancials=Array.isArray(financials)?financials:[];
      window.allBoc=Array.isArray(boc)?boc:(boc&&Array.isArray(boc.data)?boc.data:[]);
      window.entMap={}; window.allEntreprises.forEach(function(e){if(e&&e.ticker)window.entMap[String(e.ticker).toUpperCase()]=e;});
      if(typeof window.populateTickerSelect==='function')window.populateTickerSelect();
      if(typeof window.populateTickerSelects==='function')window.populateTickerSelects();
      window.dispatchEvent(new CustomEvent('tc:dataready',{detail:{cours:window.allCours.length,indices:window.allIndices.length,entreprises:window.allEntreprises.length,analyses:window.allAnalyses.length,financials:window.allFinancials.length,boc:window.allBoc.length}}));
      return window.allCours;
    }).finally(function(){ loading=null; });
    return loading;
  };
})();
