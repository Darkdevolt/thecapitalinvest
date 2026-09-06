/* THE CAPITAL — runtime recovery
 * Ensures asynchronous dashboard modules render after data and never leave
 * permanent loading placeholders when an endpoint returns no rows.
 */
(function(){
  'use strict';
  if(window.__TC_RUNTIME_RECOVERY__) return;
  window.__TC_RUNTIME_RECOVERY__ = true;

  function render(){
    try{
      if(typeof window.renderCurrentView === 'function') window.renderCurrentView();
    }catch(error){ console.error('[RUNTIME] Dashboard render:', error); }
  }

  function settleLoading(){
    document.querySelectorAll('#view-overview .loading,#view-overview .skeleton').forEach(function(el){
      if(!el.dataset.tcSettled){
        el.dataset.tcSettled='1';
        el.classList.add('tc-runtime-empty');
      }
    });
  }

  window.addEventListener('tc:dataready', function(){
    render();
    setTimeout(render, 150);
    setTimeout(render, 600);
    setTimeout(settleLoading, 900);
  });

  window.addEventListener('error', function(event){
    if(event && event.error) console.error('[RUNTIME] Erreur JavaScript:', event.error);
  });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, {once:true});
  else render();
})();
