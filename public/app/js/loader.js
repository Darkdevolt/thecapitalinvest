// UNIFIED DATA LOADER + GLOBAL NAVIGATION
(function(){
  'use strict';
  var loading = null;
  function normalize(res){ return res && typeof res === 'object' && 'data' in res ? res.data : res; }
  function api(endpoint){
    if(typeof window.apiGet !== 'function') return Promise.reject(new Error('apiGet indisponible'));
    return window.apiGet(endpoint);
  }

  // app.html appelle ces fonctions directement depuis les boutons du header.
  // Elles doivent exister avant toute interaction utilisateur.
  window.closeDropdowns = function(){
    document.querySelectorAll('.nav-dropdown.open').forEach(function(dd){ dd.classList.remove('open'); });
    document.querySelectorAll('.nav-dropdown-menu.open').forEach(function(menu){ menu.classList.remove('open'); });
  };
  window.toggleDropdown = function(id){
    var target=document.getElementById(id);
    if(!target) return;
    var wasOpen=target.classList.contains('open');
    window.closeDropdowns();
    if(!wasOpen){
      target.classList.add('open');
      var menu=target.querySelector('.nav-dropdown-menu');
      if(menu) menu.classList.add('open');
    }
  };
  document.addEventListener('click',function(e){
    if(!e.target.closest('.nav-dropdown')) window.closeDropdowns();
  });

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
