/* THE CAPITAL — header runtime compatibility module. */
(function(){
  'use strict';
  if(window.__TC_HEADER_RUNTIME_FIX__) return;
  window.__TC_HEADER_RUNTIME_FIX__=true;

  function positionOpenMenus(){
    document.querySelectorAll('.header .nav-dropdown-menu.open').forEach(function(menu){
      var dropdown=menu.closest('.nav-dropdown');
      var button=dropdown&&dropdown.querySelector('.nav-dropdown-btn');
      if(!button)return;
      var rect=button.getBoundingClientRect();
      var width=Math.min(menu.offsetWidth||320,window.innerWidth-20);
      var left=Math.max(10,Math.min(rect.left,window.innerWidth-width-10));
      menu.style.top=Math.round(rect.bottom+9)+'px';
      menu.style.left=Math.round(left)+'px';
      menu.style.right='auto';
    });
  }

  function install(){
    if(typeof window.toggleDropdown!=='function')return false;
    if(window.toggleDropdown.__tcGeometryWrapped)return true;
    var original=window.toggleDropdown;
    var wrapped=function(id){
      var result=original.apply(this,arguments);
      window.requestAnimationFrame(positionOpenMenus);
      return result;
    };
    wrapped.__tcGeometryWrapped=true;
    wrapped.__tcOriginal=original;
    window.toggleDropdown=wrapped;
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){install();positionOpenMenus();},{once:true});
  else install();
  setTimeout(install,50);
  setTimeout(install,250);
  window.addEventListener('resize',positionOpenMenus,{passive:true});
  window.addEventListener('scroll',positionOpenMenus,{passive:true});
})();
