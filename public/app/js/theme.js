/* THE CAPITAL — Theme engine
   Presentation only. No market, auth, API or subscription logic.
   The theme is managed from the account/preferences UI; this module
   intentionally does not inject a header or floating theme button. */
(function(){
  'use strict';
  if(window.__TC_THEME_LOADED__) return;
  window.__TC_THEME_LOADED__=true;

  var KEY='tc_theme';
  var VALID={dark:true,light:true};

  function getTheme(){
    try{
      var v=localStorage.getItem(KEY);
      return VALID[v] ? v : (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    }catch(e){ return 'dark'; }
  }

  function syncCharts(theme){
    if(!window.Chart) return;
    var light=theme==='light';
    Chart.defaults.color=light?'rgba(29,26,21,.64)':'rgba(245,240,232,.60)';
    Chart.defaults.borderColor=light?'rgba(55,45,28,.12)':'rgba(184,150,78,.12)';
    if(Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels){
      Chart.defaults.plugins.legend.labels.color=light?'#1d1a15':'#f5f0e8';
    }
  }

  function apply(theme){
    theme=VALID[theme] ? theme : 'dark';
    document.documentElement.dataset.theme=theme;
    if(document.body) document.body.dataset.theme=theme;
    try{ localStorage.setItem(KEY,theme); }catch(e){}
    syncCharts(theme);
    window.dispatchEvent(new CustomEvent('tc:theme-change',{detail:{theme:theme}}));
    return theme;
  }

  window.TCTheme={
    get:getTheme,
    set:apply,
    toggle:function(){ return apply(getTheme()==='dark'?'light':'dark'); }
  };

  function boot(){ apply(getTheme()); }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
