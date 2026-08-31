/* The Capital — Unified application header */
(function(){
  'use strict';

  function pad(n){ return String(n).padStart(2,'0'); }

  // One single market clock. No secondary/overlapping clocks are created.
  function updateMarketClock(){
    var el=document.querySelector('[data-market-clock], #marketClock, .market-clock');
    if(!el) return;
    var now=new Date();
    el.textContent=pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());
  }

  function getMarketPhase(){
    var now=new Date();
    // BRVM cash market: indicative phases for the user-facing header.
    var minutes=now.getHours()*60+now.getMinutes();
    if(minutes < 8*60) return 'Marché fermé';
    if(minutes < 9*60) return 'Pré-ouverture';
    if(minutes < 14*60) return 'Cotation continue';
    if(minutes < 15*60) return 'Pré-clôture';
    if(minutes < 16*60) return 'Clôture';
    return 'Marché fermé';
  }

  function updateMarketPhase(){
    var els=document.querySelectorAll('[data-market-phase], #marketPhase, .market-phase');
    var phase=getMarketPhase();
    els.forEach(function(el){ el.textContent=phase; });
  }

  function removeDuplicateClocks(){
    var selectors=['#headerClockSecondary','#secondaryClock','.header-clock-secondary','.clock-overlay','.market-clock-secondary'];
    document.querySelectorAll(selectors.join(',')).forEach(function(el){
      if(el.parentNode) el.parentNode.removeChild(el);
    });
  }

  // Make every native/select-style header listbox usable and accessible.
  function initHeaderSelects(){
    document.querySelectorAll('header select, .header select, [data-header-select]').forEach(function(select){
      if(select.__tcBound) return;
      select.__tcBound=true;
      select.addEventListener('change',function(){
        select.dispatchEvent(new CustomEvent('tc:header-selection',{bubbles:true,detail:{value:select.value}}));
      });
    });

    document.querySelectorAll('[role="listbox"][data-header-listbox]').forEach(function(box){
      if(box.__tcBound) return;
      box.__tcBound=true;
      box.addEventListener('click',function(e){
        var option=e.target.closest('[role="option"]');
        if(!option) return;
        box.querySelectorAll('[role="option"]').forEach(function(o){o.setAttribute('aria-selected','false');});
        option.setAttribute('aria-selected','true');
        box.dispatchEvent(new CustomEvent('tc:header-selection',{bubbles:true,detail:{value:option.dataset.value||option.textContent.trim()}}));
      });
    });
  }

  function boot(){
    removeDuplicateClocks();
    updateMarketClock();
    updateMarketPhase();
    initHeaderSelects();
    setInterval(function(){ updateMarketClock(); updateMarketPhase(); },1000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
