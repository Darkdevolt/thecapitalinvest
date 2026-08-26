/* The Capital Institute — product integration bridge.
 * Keeps the learning engine independent while giving it a consistent
 * navigation boundary with the main The Capital application.
 */
(function(){
  'use strict';
  var MAIN_URL='/';
  var stateEl;

  function addCapitalLink(){
    var main=document.querySelector('main');
    if(!main || document.querySelector('.tci-capital-link')) return;
    var link=document.createElement('a');
    link.className='tci-capital-link';
    link.href=MAIN_URL;
    link.innerHTML='<span aria-hidden="true">←</span><span>Retour à The Capital</span>';
    main.insertBefore(link,main.firstChild);
  }

  function addUserState(){
    var nav=document.querySelector('.tci-nav');
    if(!nav || document.querySelector('.tci-user-state')) return;
    stateEl=document.createElement('span');
    stateEl.className='tci-user-state';
    stateEl.textContent='FORMATION';
    nav.appendChild(stateEl);
  }

  function emitReady(){
    try{ window.dispatchEvent(new CustomEvent('thecapital:institute-ready',{detail:{version:'2.0'}})); }catch(e){}
  }

  function init(){
    addCapitalLink();
    addUserState();
    emitReady();
  }

  new MutationObserver(function(){addCapitalLink();addUserState();}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
