/* THE CAPITAL — Dark / Light theme switch
   Presentation only. No market, auth, API or subscription logic. */
(function(){
  'use strict';
  if(window.__TC_THEME_LOADED__) return;
  window.__TC_THEME_LOADED__=true;

  var KEY='tc_theme';
  var VALID={dark:true,light:true};
  function getTheme(){try{var v=localStorage.getItem(KEY);return VALID[v]?v:'dark';}catch(e){return 'dark';}}
  function apply(theme){
    theme=VALID[theme]?theme:'dark';
    document.documentElement.dataset.theme=theme;
    document.body.dataset.theme=theme;
    try{localStorage.setItem(KEY,theme);}catch(e){}
    var b=document.getElementById('tcThemeToggle');
    if(b){b.setAttribute('aria-pressed',String(theme==='light'));b.setAttribute('aria-label',theme==='light'?'Passer en mode sombre':'Passer en mode clair');b.innerHTML=theme==='light'?'☾':'☼';}
    window.dispatchEvent(new CustomEvent('tc:theme-change',{detail:{theme:theme}}));
    return theme;
  }
  function create(){
    if(document.getElementById('tcThemeToggle')) return;
    var host=document.querySelector('.topnav-right');
    if(!host) return;
    var b=document.createElement('button');
    b.type='button'; b.id='tcThemeToggle'; b.className='tc-theme-toggle';
    b.title='Changer de thème';
    b.innerHTML='☼';
    b.addEventListener('click',function(){apply(getTheme()==='dark'?'light':'dark');});
    var mode=document.getElementById('tcDisplayMode');
    host.insertBefore(b,mode||host.querySelector('.topnav-user')||host.firstChild);
    apply(getTheme());
  }
  window.TCTheme={get:getTheme,set:apply,toggle:function(){return apply(getTheme()==='dark'?'light':'dark');}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',create,{once:true});else create();
  new MutationObserver(create).observe(document.documentElement,{childList:true,subtree:true});
})();
