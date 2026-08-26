// ═══════════════════════════════════════
// SEARCH, The Capital BRVM
// ═══════════════════════════════════════
(function(){
  'use strict';

  function esc(value){
    return typeof window.escapeHtml === 'function'
      ? window.escapeHtml(value)
      : String(value == null ? '' : value)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  window.initGlobalSearch = function(){
    const input = document.getElementById('globalSearchInput');
    const results = document.getElementById('globalSearchResults');
    if(!input || !results || input.dataset.tcSearchBound==='1') return;
    input.dataset.tcSearchBound='1';

    if(!document.getElementById('tc-mobile-global-search-position')){
      const style=document.createElement('style');
      style.id='tc-mobile-global-search-position';
      style.textContent='@media (max-width: 768px){#globalSearchResults{position:fixed!important;top:calc(var(--header-h) + 8px)!important;left:12px!important;right:12px!important;width:auto!important;max-width:none!important;max-height:min(52vh,320px)!important;z-index:10050!important}}';
      document.head.appendChild(style);
    }

    const render=window.debounce(function(e){
      const q=String(e.target.value||'').toLowerCase().trim();
      if(!q){results.classList.remove('open');results.innerHTML='';return;}

      const byTicker={};
      (Array.isArray(window.allCours)?window.allCours:[]).forEach(function(c){
        if(c && c.ticker && !byTicker[c.ticker]) byTicker[c.ticker]=c;
      });
      const matches=Object.values(byTicker).filter(function(c){
        const ent=window.entMap && window.entMap[c.ticker];
        return String(c.ticker).toLowerCase().includes(q) || Boolean(ent && ent.nom && String(ent.nom).toLowerCase().includes(q));
      }).slice(0,8);

      if(!matches.length){
        results.innerHTML='<div class="gsr-item"><span class="gsr-name">Aucun résultat</span></div>';
        results.classList.add('open');
        return;
      }

      results.innerHTML=matches.map(function(c){
        const ent=window.entMap && window.entMap[c.ticker];
        const ticker=esc(c.ticker);
        const name=ent && ent.nom ? esc(ent.nom) : ticker;
        const sector=typeof window.getSector==='function' ? esc(window.getSector(c.ticker)) : 'Divers';
        return '<button type="button" class="gsr-item" data-ticker="'+ticker+'">'+
          '<span><span class="gsr-ticker">'+ticker+'</span><span class="gsr-name">'+name+'</span></span>'+
          '<span class="gsr-sector">'+sector+'</span></button>';
      }).join('');

      results.querySelectorAll('[data-ticker]').forEach(function(item){
        item.addEventListener('click',function(){
          const ticker=item.getAttribute('data-ticker');
          if(typeof window.openFiche==='function') window.openFiche(ticker,'overview');
          results.classList.remove('open');
          input.value='';
        });
      });
      results.classList.add('open');
    },200);

    input.addEventListener('input',render);
    input.addEventListener('keydown',function(e){
      if(e.key==='Escape'){results.classList.remove('open');input.blur();}
    });
    document.addEventListener('click',function(e){
      if(!e.target.closest('#globalSearch')) results.classList.remove('open');
    });
  };

  document.addEventListener('keydown',function(e){
    if(e.key==='/' && document.activeElement && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){
      const input=document.getElementById('globalSearchInput');
      if(input){e.preventDefault();input.focus();}
    }
    if(e.key==='Escape'){
      document.getElementById('globalSearchResults')?.classList.remove('open');
      if(window.innerWidth<=768 && typeof window.closeSidebar==='function') window.closeSidebar();
    }
  });
})();
