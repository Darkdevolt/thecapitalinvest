/* THE CAPITAL — Dark / Light theme switch
   Presentation only. No market, auth, API or subscription logic. */
(function(){
  'use strict';
  if(window.__TC_THEME_LOADED__) return;
  window.__TC_THEME_LOADED__=true;

  var KEY='tc_theme';
  var VALID={dark:true,light:true};

  function getTheme(){
    try{
      var v=localStorage.getItem(KEY);
      return VALID[v]?v:(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
    }catch(e){return 'dark';}
  }

  function syncCharts(theme){
    if(!window.Chart) return;
    var light=theme==='light';
    Chart.defaults.color=light?'rgba(29,26,21,.64)':'rgba(245,240,232,.60)';
    Chart.defaults.borderColor=light?'rgba(55,45,28,.12)':'rgba(184,150,78,.12)';
    if(Chart.defaults.plugins&&Chart.defaults.plugins.legend&&Chart.defaults.plugins.legend.labels){
      Chart.defaults.plugins.legend.labels.color=light?'#1d1a15':'#f5f0e8';
    }
  }

  function apply(theme){
    theme=VALID[theme]?theme:'dark';
    document.documentElement.dataset.theme=theme;
    if(document.body) document.body.dataset.theme=theme;
    try{localStorage.setItem(KEY,theme);}catch(e){}
    syncCharts(theme);

    var b=document.getElementById('tcThemeToggle');
    if(b){
      b.setAttribute('aria-pressed',String(theme==='light'));
      b.setAttribute('aria-label',theme==='light'?'Passer en mode sombre':'Passer en mode clair');
      b.setAttribute('title',theme==='light'?'Mode sombre':'Mode clair');
      var icon=b.querySelector('.tc-theme-icon');
      if(icon) icon.textContent=theme==='light'?'☾':'☀';
    }

    window.dispatchEvent(new CustomEvent('tc:theme-change',{detail:{theme:theme}}));
    return theme;
  }

  function findHost(){
    return document.querySelector('.topnav-right') ||
           document.querySelector('.header .topnav-right') ||
           document.querySelector('.header .topnav') ||
           document.querySelector('.header');
  }

  function create(){
    var host=findHost();
    if(!host) return false;

    var b=document.getElementById('tcThemeToggle');

    if(!b){
      b=document.createElement('button');
      b.type='button';
      b.id='tcThemeToggle';
      b.className='tc-theme-toggle';
      b.innerHTML='<span class="tc-theme-icon" aria-hidden="true">☀</span><span class="tc-theme-label">THÈME</span>';
      b.addEventListener('click',function(){
        apply(getTheme()==='dark'?'light':'dark');
      });

      var mode=document.getElementById('tcDisplayMode');
      var user=host.querySelector('.topnav-user');

      if(mode) host.insertBefore(b,mode);
      else if(user) host.insertBefore(b,user);
      else host.appendChild(b);
    }

    apply(getTheme());
    return true;
  }

  window.TCTheme={
    get:getTheme,
    set:apply,
    toggle:function(){return apply(getTheme()==='dark'?'light':'dark');}
  };

  function boot(){
    create();
    setTimeout(create,100);
    setTimeout(create,500);
    setTimeout(create,1200);
    setTimeout(create,2500);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }

  new MutationObserver(function(){
    if(!document.getElementById('tcThemeToggle')) create();
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
