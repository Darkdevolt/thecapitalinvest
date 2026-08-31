/* THE CAPITAL INSTITUTE — UI controls */
(function(){
  'use strict';
  if(window.__TCI_UI_POLISH__) return;
  window.__TCI_UI_POLISH__=true;

  var KEY='tci_theme';

  function theme(){
    try{
      var v=localStorage.getItem(KEY);
      if(v==='light'||v==='dark') return v;
    }catch(e){}
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
  }

  function apply(v){
    v=v==='light'?'light':'dark';
    document.documentElement.setAttribute('data-tci-theme',v);
    try{localStorage.setItem(KEY,v)}catch(e){}
    var b=document.getElementById('tciThemeToggle');
    if(b){
      var icon=b.querySelector('.tci-theme-icon');
      if(icon) icon.textContent=v==='light'?'☾':'☼';
      b.setAttribute('aria-label',v==='light'?'Passer en mode sombre':'Passer en mode clair');
      b.setAttribute('title',v==='light'?'Mode sombre':'Mode clair');
    }
  }

  function addTheme(){
    if(document.getElementById('tciThemeToggle')) return;
    var nav=document.querySelector('.tci-nav');
    if(!nav) return;
    var b=document.createElement('button');
    b.type='button';
    b.id='tciThemeToggle';
    b.className='tci-theme-toggle';
    b.innerHTML='<span class="tci-theme-icon" aria-hidden="true">☼</span><span>Clair</span>';
    b.addEventListener('click',function(){apply(theme()==='dark'?'light':'dark')});
    nav.appendChild(b);
    apply(theme());
  }

  function boot(){
    apply(theme());
    addTheme();
    setTimeout(addTheme,150);
    setTimeout(addTheme,700);
    setTimeout(addTheme,1600);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  new MutationObserver(function(){
    if(!document.getElementById('tciThemeToggle')) addTheme();
  }).observe(document.body||document.documentElement,{childList:true,subtree:true});
})();
