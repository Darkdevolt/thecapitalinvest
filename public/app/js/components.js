// ═══════════════════════════════════════
// COMPONENTS, The Capital BRVM
// ═══════════════════════════════════════
// Les formatters, toast, debounce et recherche globale ont chacun une source
// unique dans utils.js / search.js. Ce module contient uniquement les
// composants HTML réutilisables de l'application.
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
    const tickerArg = String(c.ticker || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");

    let html = '<tr onclick="openFiche(\''+esc(tickerArg)+'\')">';
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

  console.log('[COMPONENTS] Composants chargés, responsabilités consolidées');
})();
