/* THE CAPITAL — reliable header interactions */
(function(){
  'use strict';
  if(window.__TC_HEADER_INTERACTIONS_FIX__) return;
  window.__TC_HEADER_INTERACTIONS_FIX__=true;

  function bind(){
    document.addEventListener('click', function(e){
      var route=e.target.closest && e.target.closest('[data-route]');
      if(route && !e.target.closest('input,select,textarea')){
        var id=route.getAttribute('data-route');
        if(id && typeof window.nav==='function'){
          e.preventDefault();
          window.nav(id);
        }
        return;
      }
      var dropdown=e.target.closest && e.target.closest('[data-dropdown]');
      if(dropdown && typeof window.toggleDropdown==='function'){
        e.preventDefault();
        window.toggleDropdown(dropdown.getAttribute('data-dropdown'));
        return;
      }
      if(!e.target.closest('.nav-dropdown') && typeof window.closeDropdowns==='function') window.closeDropdowns();
      if(e.target.closest('#tcMobileMenu') && typeof window.toggleSidebar==='function') window.toggleSidebar();
      if(e.target.closest('#overlay') && typeof window.closeSidebar==='function') window.closeSidebar();
    }, true);

    document.addEventListener('keydown', function(e){
      if(e.key==='Escape' && typeof window.closeDropdowns==='function') window.closeDropdowns();
      var route=e.target.closest && e.target.closest('[data-route]');
      if(route && (e.key==='Enter'||e.key===' ')){
        e.preventDefault();
        if(typeof window.nav==='function') window.nav(route.getAttribute('data-route'));
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
