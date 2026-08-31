/* THE CAPITAL — Dark / Light theme switch
   Presentation only. No market, auth, API or subscription logic. */
(function(){
  'use strict';
  if(window.__TC_THEME_LOADED__) return;
  window.__TC_THEME_LOADED__=true;

  var KEY='tc_theme';
  var VALID={dark:true,light:true};
  function getTheme(){try{var v=localStorage.getItem(KEY);return VALID[v]?v:(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}catch(e){return 'dark';}}
  function syncCharts(theme){
    if(!window.Chart) return;
    var light=theme==='light';
    Chart.defaults.color=light?'rgba(29,26,21,.64)':'rgba(245,240,232,.60)';
    Chart.defaults.borderColor=light?'rgba(55,45,28,.12)':'rgba(184,150,78,.12)';
    if(Chart.defaults.plugins&&Chart.defaults.plugins.legend&&Chart.defaults.plugins.legend.labels){Chart.defaults.plugins.legend.labels.color=light?'#1d1a15':'#f5f0e8';}
  }
  function apply(theme){
    theme=VALID[theme]?theme:'dark';
    document.documentElement.dataset.theme=theme;
    document.body.dataset.theme=theme;
    try{localStorage.setItem(KEY,theme);}catch(e){}
    syncCharts(theme);
    var b=document.getElementById('tcThemeToggle');
    if(b){b.setAttribute('aria-pressed',String(theme==='light'));b.setAttribute('aria-label',theme==='light'?'Passer en mode sombre':'Passer en mode clair');b.setAttribute('title',theme==='light'?'Mode sombre':'Mode clair');var icon=b.querySelector('.tc-theme-icon');if(icon)icon.textContent=theme==='light'?'☾':'☼';}
    window.dispatchEvent(new CustomEvent('tc:theme-change',{detail:{theme:theme}}));
    return theme;
  }
  function create(){
    if(document.getElementById('tcThemeToggle')) return;
    var host=document.querySelector('.topnav-right');
    if(!host) return;
    var b=document.createElement('button');
    b.type='button';b.id='tcThemeToggle';b.className='tc-theme-toggle';b.innerHTML='<span class="tc-theme-icon" aria-hidden="true">☼</span>';
    b.addEventListener('click',function(){apply(getTheme()==='dark'?'light':'dark');});
    var mode=document.getElementById('tcDisplayMode');
    host.insertBefore(b,mode||host.querySelector('.topnav-user')||host.firstChild);
    apply(getTheme());
  }
  window.TCTheme={get:getTheme,set:apply,toggle:function(){return apply(getTheme()==='dark'?'light':'dark');}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',create,{once:true});else create();
  new MutationObserver(create).observe(document.documentElement,{childList:true,subtree:true});
})();
