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
  var integer = new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function num(value){
    var n=Number(value);
    return Number.isFinite(n) ? nf.format(n) : '—';
  }

  function fcfa(value){
    var n=Number(value);
    return Number.isFinite(n) ? integer.format(n) + ' FCFA' : '—';
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

  function indexRow(rows,name){
    var target=String(name).toUpperCase();
    return (rows||[]).find(function(row){
      return String(row.indice||'').trim().toUpperCase()===target;
    });
  }

  function formatDate(date){
    if(!date) return 'Séance indisponible';
    try{
      return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'long',year:'numeric',timeZone:'Africa/Abidjan'})
        .format(new Date(date+'T12:00:00Z'));
    }catch(e){ return date; }
  }

  function render(data){
    var indices=Array.isArray(data.indices)?data.indices:[];
    var cours=Array.isArray(data.cours)?data.cours:[];
    var composite=indexRow(indices,'BRVM-COMPOSITE');
    var brvm30=indexRow(indices,'BRVM-30');
    var date=data.session_date || data.cours_date || data.indices_date || '';

    if(!composite || !brvm30 || !cours.length) throw new Error('Données BRVM incomplètes');

    var valid=cours.filter(function(row){
      return row && Number.isFinite(Number(row.variation_pct)) && Number.isFinite(Number(row.cours));
    });

    var top=valid.slice().sort(function(a,b){return Number(b.variation_pct)-Number(a.variation_pct);}).slice(0,5);
    var flop=valid.slice().sort(function(a,b){return Number(a.variation_pct)-Number(b.variation_pct);}).slice(0,5);

    var totalVolume=valid.reduce(function(sum,row){return sum+Number(row.volume||0);},0);
    var totalValue=valid.reduce(function(sum,row){return sum+Number(row.valeur_transigee!=null?row.valeur_transigee:(row.valeur_totale||0));},0);
    var active=valid.slice().sort(function(a,b){
      return Number(b.valeur_transigee!=null?b.valeur_transigee:(b.valeur_totale||0))-
             Number(a.valeur_transigee!=null?a.valeur_transigee:(a.valeur_totale||0));
    }).slice(0,3);

    function indexBlock(label,row){
      return '<article class="tc-lmp-index">'+
        '<div class="tc-lmp-index-top"><span>'+esc(label)+'</span><i class="tc-lmp-state '+changeClass(row.variation_pct)+'"></i></div>'+
        '<strong>'+num(row.valeur)+'</strong>'+
        '<span class="tc-lmp-change '+changeClass(row.variation_pct)+'">'+pct(row.variation_pct)+'</span>'+ 
      '</article>';
    }

    function flowItem(row){
      var value=row.valeur_transigee!=null?row.valeur_transigee:row.valeur_totale;
      return '<li><span>'+esc(row.ticker||'—')+'</span><b>'+fcfa(value)+'</b></li>';
    }

    function mover(row){
      return '<li class="tc-lmp-mover '+changeClass(row.variation_pct)+'">'+
        '<div><b>'+esc(row.ticker||'—')+'</b><small>'+fcfa(row.cours)+'</small></div>'+
        '<strong>'+pct(row.variation_pct)+'</strong>'+ 
      '</li>';
    }

    root.innerHTML='<section class="tc-lmp-section" aria-labelledby="tc-lmp-title">'+
      '<div class="tc-lmp-wrap">'+
        '<div class="tc-lmp-heading">'+
          '<div><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2 id="tc-lmp-title">Une lecture claire du marché.</h2></div>'+
          '<div class="tc-lmp-intro"><p>The Capital permet de comprendre la dynamique de la séance, en un regard, à partir des données réelles du marché.</p><span class="tc-lmp-date">DERNIÈRE SÉANCE · '+esc(formatDate(date))+'</span></div>'+
        '</div>'+
        '<div class="tc-lmp-core">'+
          '<article class="tc-lmp-panel tc-lmp-trend">'+
            '<div class="tc-lmp-panel-head"><span>01</span><h3>TENDANCE DU MARCHÉ</h3></div>'+ 
            '<div class="tc-lmp-indices">'+indexBlock('BRVM Composite',composite)+indexBlock('BRVM 30',brvm30)+'</div>'+ 
          '</article>'+ 
          '<article class="tc-lmp-panel tc-lmp-flow">'+
            '<div class="tc-lmp-panel-head"><span>02</span><h3>FLUX &amp; ACTIVITÉ</h3></div>'+ 
            '<div class="tc-lmp-metrics">'+
              '<div><small>VALEUR ÉCHANGÉE</small><strong>'+fcfa(totalValue)+'</strong></div>'+ 
              '<div><small>VOLUME</small><strong>'+integer.format(totalVolume)+'</strong></div>'+ 
              '<div><small>TITRES ACTIFS</small><strong>'+integer.format(valid.length)+'</strong></div>'+ 
            '</div>'+ 
            '<div class="tc-lmp-active"><span>PLUS ACTIFS · VALEUR ÉCHANGÉE</span><ul>'+active.map(flowItem).join('')+'</ul></div>'+ 
          '</article>'+ 
        '</div>'+ 
        '<div class="tc-lmp-movers">'+
          '<article class="tc-lmp-mover-panel"><div class="tc-lmp-mover-head"><span>TOP 5 HAUSSES</span><em>COURS · VARIATION</em></div><ol>'+top.map(mover).join('')+'</ol></article>'+ 
          '<article class="tc-lmp-mover-panel"><div class="tc-lmp-mover-head"><span>TOP 5 BAISSES</span><em>COURS · VARIATION</em></div><ol>'+flop.map(mover).join('')+'</ol></article>'+ 
        '</div>'+ 
        '<div class="tc-lmp-source"><span>DONNÉES DE MARCHÉ RÉELLES · SOURCE API THE CAPITAL</span><span>Lecture publique · sans authentification</span></div>'+ 
      '</div>'+ 
    '</section>';
  }

  function loading(){
    root.innerHTML='<section class="tc-lmp-section tc-lmp-loading"><div class="tc-lmp-wrap"><div class="tc-lmp-heading"><div><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2>Une lecture claire du marché.</h2></div><p>Chargement de la dernière séance disponible.</p></div><div class="tc-lmp-loading-line"></div></div></section>';
  }

  function fallback(){
    root.innerHTML='<section class="tc-lmp-section tc-lmp-error"><div class="tc-lmp-wrap"><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2>Marché momentanément indisponible</h2><p>Les données de la dernière séance ne sont pas accessibles pour le moment.</p></div></section>';
  }

  loading();
  fetch(endpoint,{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'})
    .then(function(res){if(!res.ok) throw new Error('HTTP '+res.status);return res.json();})
    .then(function(payload){
      var data=payload && payload.text ? JSON.parse(payload.text) : payload;
      if(!data || data.success===false) throw new Error('API BRVM indisponible');
      render(data);
    })
    .catch(function(err){console.warn('[TC Landing Market]',err);fallback();});
})();
