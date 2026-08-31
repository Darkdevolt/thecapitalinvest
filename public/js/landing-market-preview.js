/* THE CAPITAL — Public BRVM market preview
   Read-only, no authentication. Uses the existing public /api/marche endpoint. */
(function(){
  'use strict';
  if(window.__TC_LANDING_MARKET_PREVIEW__) return;
  window.__TC_LANDING_MARKET_PREVIEW__ = true;

  var root = document.getElementById('tcLandingMarketPreview');
  if(!root) return;

  var endpoint = '/api/marche?type=apercu';
  var nf = new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2});

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function number(value){
    var n=Number(value);
    return Number.isFinite(n) ? nf.format(n) : '—';
  }

  function pct(value){
    var n=Number(value);
    if(!Number.isFinite(n)) return '—';
    return (n>0?'+':'') + n.toFixed(2).replace('.',',') + ' %';
  }

  function changeClass(value){
    var n=Number(value);
    return Number.isFinite(n) ? (n>0?'up':n<0?'down':'flat') : 'flat';
  }

  function findIndex(rows, names){
    return (rows||[]).find(function(row){
      var name=String(row.indice||'').trim().toUpperCase();
      return names.some(function(x){return name===x || name.indexOf(x)>=0;});
    });
  }

  function render(data){
    var indices=data.indices||[];
    var cours=data.cours||[];
    var composite=findIndex(indices,['BRVM C','BRVM COMPOSITE']);
    var brvm30=findIndex(indices,['BRVM 30']);
    var prestige=findIndex(indices,['BRVM PRESTIGE']);

    var valid=cours.filter(function(r){return Number.isFinite(Number(r.variation_pct));});
    var top=valid.slice().sort(function(a,b){return Number(b.variation_pct)-Number(a.variation_pct);}).slice(0,3);
    var flop=valid.slice().sort(function(a,b){return Number(a.variation_pct)-Number(b.variation_pct);}).slice(0,3);

    var date=data.session_date || data.cours_date || data.indices_date || '';
    var dateLabel='Séance BRVM';
    if(date){
      try{dateLabel=new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'long',year:'numeric',timeZone:'Africa/Abidjan'}).format(new Date(date+'T12:00:00Z'));}catch(e){}
    }

    function indexCard(label,row){
      var value=row?row.valeur:null, variation=row?row.variation_pct:null;
      return '<article class="tc-lmp-index">'+
        '<span class="tc-lmp-label">'+esc(label)+'</span>'+
        '<strong>'+number(value)+'</strong>'+
        '<span class="tc-lmp-change '+changeClass(variation)+'">'+pct(variation)+'</span>'+ 
      '</article>';
    }

    function mover(row){
      var variation=row.variation_pct;
      return '<div class="tc-lmp-row">'+
        '<div><b>'+esc(row.ticker||'—')+'</b><small>'+esc(row.date_seance||'')+'</small></div>'+
        '<strong class="'+changeClass(variation)+'">'+pct(variation)+'</strong>'+ 
      '</div>';
    }

    root.innerHTML='<div class="tc-lmp-shell">'+
      '<div class="tc-lmp-head">'+
        '<div><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2>Le marché, avant même de vous connecter.</h2><p>Un aperçu public de la dernière séance disponible : indices, meilleures hausses et plus fortes baisses.</p></div>'+
        '<div class="tc-lmp-session"><span class="tc-lmp-live"><i></i> DONNÉES PUBLIQUES</span><b>'+esc(dateLabel)+'</b></div>'+
      '</div>'+
      '<div class="tc-lmp-indices">'+indexCard('BRVM Composite',composite)+indexCard('BRVM 30',brvm30)+indexCard('BRVM Prestige',prestige)+'</div>'+
      '<div class="tc-lmp-movers">'+
        '<div class="tc-lmp-list"><div class="tc-lmp-list-head"><span>TOP HAUSSES</span><em>Variation séance</em></div>'+ (top.length?top.map(mover).join(''):'<div class="tc-lmp-empty">Données indisponibles</div>') +'</div>'+ 
        '<div class="tc-lmp-list"><div class="tc-lmp-list-head"><span>TOP BAISSES</span><em>Variation séance</em></div>'+ (flop.length?flop.map(mover).join(''):'<div class="tc-lmp-empty">Données indisponibles</div>') +'</div>'+ 
      '</div>'+
      '<div class="tc-lmp-foot"><span>Les données détaillées, historiques et analyses sont disponibles dans The Capital.</span><a href="/app/login.html" class="tc-lmp-cta">Accéder à la plateforme <span>→</span></a></div>'+
    '</div>';
  }

  function loading(){
    root.innerHTML='<div class="tc-lmp-shell tc-lmp-loading"><div class="tc-lmp-head"><div><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2>Lecture du marché…</h2><p>Chargement de la dernière séance disponible.</p></div></div><div class="tc-lmp-skeletons"><span></span><span></span><span></span></div></div>';
  }

  function fallback(){
    root.innerHTML='<div class="tc-lmp-shell tc-lmp-error"><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2>Le marché est momentanément indisponible.</h2><p>Vous pourrez retrouver les données complètes directement dans la plateforme.</p><a href="/app/login.html" class="tc-lmp-cta">Accéder à The Capital <span>→</span></a></div>';
  }

  loading();
  fetch(endpoint,{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'})
    .then(function(res){if(!res.ok) throw new Error('HTTP '+res.status);return res.json();})
    .then(render)
    .catch(function(err){console.warn('[TC Landing Market]',err);fallback();});
})();
