// ═══════════════════════════════════════
// COMPONENTS, The Capital BRVM
// ═══════════════════════════════════════
// Les formatters, toast et debounce appartiennent à utils.js.
// Ce module ne conserve que les composants UI spécifiques.
(function(){
  'use strict';

  function esc(value){
    return typeof window.escapeHtml === 'function'
      ? window.escapeHtml(value)
      : String(value == null ? '' : value)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  window.emptyState = window.emptyState || function(msg){
    return '<tr><td colspan="99" class="tc-empty">'+esc(msg || 'Aucune donnée')+'</td></tr>';
  };

  window.getPays = window.getPays || function(ticker){
    const e = (window.entMap && window.entMap[ticker]) || null;
    return (e && e.pays) || 'UEMOA';
  };

  window.tickerRow = window.tickerRow || function(c, opts){
    opts = opts || {};
    c = c || {};
    const ticker = esc(c.ticker || '');
    const v = parseFloat(c.variation) || 0;
    const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'neutral';
    const sign = v > 0 ? '+' : '';
    const sector = typeof window.getSector === 'function' ? window.getSector(c.ticker) : 'Divers';
    const sectorClass = esc(String(sector).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]/g,''));
    const ent = (window.entMap && window.entMap[c.ticker]) || null;
    const nom = ent && ent.nom ? ent.nom : '';
    const displaySector = ent && ent.secteur ? ent.secteur : sector;

    let html = '<tr onclick="openFiche(\''+ticker.replace(/'/g,'\\\'')+'\')">';
    html += '<td class="ticker-cell">'+ticker+'</td>';
    if(opts.showCompany) html += '<td class="company-cell">'+esc(nom)+'</td>';
    html += '<td class="price-cell right">'+esc(fmt(c.cours,0))+'</td>';
    html += '<td class="var-cell right"><span class="pill '+cls+'">'+sign+v.toFixed(2)+'%</span></td>';
    if(opts.show52Week){
      html += '<td class="right mono">'+esc(c.high_52 || ', ')+'</td>';
      html += '<td class="right mono">'+esc(c.low_52 || ', ')+'</td>';
    }
    html += '<td class="vol-cell right">'+esc(fmt(c.volume))+'</td>';
    if(opts.showCapital) html += '<td class="cap-cell right">'+esc(c.capitalisation ? fmtM(c.capitalisation) : ', ')+'</td>';
    html += '<td class="sector-cell right"><span class="sector-badge '+sectorClass+'">'+esc(displaySector)+'</span></td></tr>';
    return html;
  };

  window.initGlobalSearch = window.initGlobalSearch || function(){
    const input=document.getElementById('globalSearchInput') || document.getElementById('globalSearch');
    const results=document.getElementById('globalSearchResults');
    if(!input || !results || input.dataset.tcSearchBound==='1') return;
    input.dataset.tcSearchBound='1';

    input.addEventListener('input',window.debounce(function(e){
      const q=String(e.target.value||'').toLowerCase().trim();
      if(!q){ results.classList.remove('open'); results.innerHTML=''; return; }

      const matches=(Array.isArray(window.allCours)?window.allCours:[]).filter(function(c){
        const ent=window.entMap && window.entMap[c.ticker];
        return c && c.ticker && (
          String(c.ticker).toLowerCase().includes(q) ||
          Boolean(ent && ent.nom && String(ent.nom).toLowerCase().includes(q))
        );
      }).slice(0,8);

      if(!matches.length){
        results.innerHTML='<div class="gsr-item"><span class="gsr-name">Aucun résultat</span></div>';
      }else{
        results.innerHTML=matches.map(function(c){
          const ent=window.entMap && window.entMap[c.ticker];
          const ticker=esc(c.ticker);
          const name=ent && ent.nom ? ', '+esc(ent.nom) : '';
          const sector=ent && ent.secteur ? esc(ent.secteur) : 'Autre';
          const safeTicker=String(c.ticker).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
          return '<div class="gsr-item" data-ticker="'+ticker+'">'+
            '<div><span class="gsr-ticker">'+ticker+'</span><span class="gsr-name">'+name+'</span></div>'+
            '<span class="gsr-sector">'+sector+'</span></div>';
        }).join('');

        results.querySelectorAll('[data-ticker]').forEach(function(item){
          item.addEventListener('click',function(){
            const ticker=item.getAttribute('data-ticker');
            if(typeof window.openFiche==='function') window.openFiche(ticker);
            results.classList.remove('open');
          });
        });
      }
      results.classList.add('open');
    },200));

    document.addEventListener('click',function(e){
      if(!e.target.closest('.global-search')) results.classList.remove('open');
    });
  };

  // Initialisation différée pour garantir que le DOM et les données sont prêts.
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',window.initGlobalSearch,{once:true});
  else window.initGlobalSearch();
})();
