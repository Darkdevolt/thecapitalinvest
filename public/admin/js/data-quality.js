/* THE CAPITAL — unified market-data quality engine */
(function(){'use strict';
  var DAY_LIMIT=7.5, TOLERANCE=0.01;
  function num(v){ if(v===null||v===undefined||v==='') return null; var n=Number(String(v).replace(/\s/g,'').replace(',','.')); return Number.isFinite(n)?n:null; }
  function issues(r){
    var a=[], c=num(r.cours_cloture), o=num(r.cours_ouverture), h=num(r.plus_haut), l=num(r.plus_bas), v=num(r.volume), d=r.date_seance, t=String(r.ticker||'').trim();
    if(!t) a.push('Ticker manquant');
    if(!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d).slice(0,10))) a.push('Date invalide');
    if(c===null) a.push('Clôture manquante'); else if(c<0) a.push('Clôture négative');
    if(o!==null&&o<0) a.push('Ouverture négative'); if(h!==null&&h<0) a.push('Haut négatif'); if(l!==null&&l<0) a.push('Bas négatif'); if(v!==null&&v<0) a.push('Volume négatif');
    if(h!==null&&l!==null&&l>h) a.push('Bas > Haut');
    if(c!==null&&l!==null&&c<l) a.push('Clôture < Bas');
    if(c!==null&&h!==null&&c>h) a.push('Clôture > Haut');
    if(o!==null&&l!==null&&o<l) a.push('Ouverture < Bas');
    if(o!==null&&h!==null&&o>h) a.push('Ouverture > Haut');
    var rv=num(r.variation); if(rv!==null&&Math.abs(rv)>DAY_LIMIT) a.push('Variation hors ±'+DAY_LIMIT+' %');
    return a;
  }
  function variation(prev,current){var p=num(prev),c=num(current);if(p===null||c===null||p===0)return null;return Number((((c-p)/p)*100).toFixed(2));}
  window.TheCapitalDataQuality={num:num,issues:issues,variation:variation,VARIATION_LIMIT:DAY_LIMIT,TOLERANCE:TOLERANCE};
})();
