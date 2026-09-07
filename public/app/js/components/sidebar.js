/* Compatibility shim.
 * The navigation runtime is centralized in components/header.js.
 * Kept because app.html still loads this legacy component path.
 */
(function(){
  'use strict';
  function boot(){
    if(window.TCHeader && typeof window.TCHeader.initSidebar==='function') window.TCHeader.initSidebar();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();