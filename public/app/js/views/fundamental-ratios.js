// The Capital — Advanced fundamental ratios, PER and customizable financial series
(function () {
  'use strict';
  var lastTicker = '';
  var perCache = {};
  var chart = null;

  function num(v){var x=Number(v);return Number.isFinite(x)?x:NaN;}
  function first(o,keys){for(var i=0;i<keys.length;i++){var v=num(o&&o[keys[i]]);if(Number.isFinite(v))return v;}return NaN;}
  function money(v){return Number.isFinite(v)?(typeof window.fmtM==='function'?window.fmtM(v):Math.round(v).toLocaleString('fr-FR')):'—';}
  function pct(v){return Number.isFinite(v)?(v*100).toFixed(1)+'%':'—';}
  function mult(v){return Number.isFinite(v)?v.toFixed(2)+'x':'—';}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function fins(){return Array.isArray(window.allFinancials)?window.allFinancials:[];}
  function quotes(){return Array.isArray(window.allCours)?window.allCours:[];}
  function annual(t){return fins().filter(function(f){return String(f&&f.ticker||'').toUpperCase()===t&&(f.periode==='annuel'||!f.periode);}).sort(function(a,b){return(num(a.annee)||0)-(num(b.annee)||0);});}
  function quote(t){return quotes().find(function(c){return String(c&&c.ticker||'').toUpperCase()===t;})||{};}
  function sector(t){if(window.entMap&&window.entMap[t])return window.entMap[t].secteur||window.entMap[t].sector||'';var q=quote(t);return q.secteur||q.sector||'';}
  function metrics(t){var rows=annual(t);if(!rows.length)return null;var f=rows[rows.length-1],q=quote(t),price=first(q,['cours','price','last','close']),shares=first(f,['nombre_actions','nb_actions','actions','shares','nombreAction','nbActions']),ca=first(f,['chiffre_affaires','chiffreAffaires','revenue','ca']),rn=first(f,['resultat_net','resultatNet','net_income','netIncome']),cfo=first(f,['cash_flow_operationnel','cashFlowOperationnel','operating_cash_flow']),capex=first(f,['capex','investissements','investissement']),fcf=Number.isFinite(cfo)&&Number.isFinite(capex)?cfo-capex:NaN,equity=first(f,['capitaux_propres','capitauxPropres','fonds_propres','fondsPropres','equity','total_equity']),assets=first(f,['total_actif','totalActif','actif_total','actifTotal','total_assets','assets']),debt=first(f,['dettes_financieres','dettesFinancieres','dette_financiere','detteFinanciere','dette','total_dette','totalDebt']),ebitda=first(f,['ebitda','EBITDA','resultat_operationnel','resultatOperationnel','ebit']),div=first(f,['dividendes','dividende','dividendes_distribues','dividendesDistribues','dividend']),mc=price>0&&shares>0?price*shares:NaN,eps=Number.isFinite(rn)&&shares>0?rn/shares:NaN,bvps=Number.isFinite(equity)&&shares>0?equity/shares:NaN;return {ticker:t,year:f.annee,price:price,shares:shares,ca:ca,rn:rn,fcf:fcf,equity:equity,assets:assets,debt:debt,ebitda:ebitda,div:div,marketCap:mc,eps:eps,bvps:bvps,pe:price>0&&eps>0?price/eps:NaN,pb:price>0&&bvps>0?price/bvps:NaN,ps:mc>0&&ca>0?mc/ca:NaN,evEbitda:mc>0&&debt>=0&&ebitda>0?(mc+debt)/ebitda:NaN,netMargin:ca>0&&Number.isFinite(rn)?rn/ca:NaN,fcfMargin:ca>0&&Number.isFinite(fcf)?fcf/ca:NaN,fcfYield:mc>0&&Number.isFinite(fcf)?fcf/mc:NaN,roe:equity>0&&Number.isFinite(rn)?rn/equity:NaN,roa:assets>0&&Number.isFinite(rn)?rn/assets:NaN,debtEquity:equity>0&&Number.isFinite(debt)?debt/equity:NaN,divYield:mc>0&&Number.isFinite(div)?div/mc:NaN,sector:sector(t)};}
  function median(a){a=a.filter(Number.isFinite).sort(function(x,y){return x-y;});if(!a.length)return NaN;var m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  function peers(t){var cur=metrics(t);if(!cur)return[];var out=[],seen={};quotes().forEach(function(q){var tk=String(q&&q.ticker||'').toUpperCase();if(!tk||tk===t||seen[tk])return;seen[tk]=1;var m=metrics(tk);if(m&&cur.sector&&m.sector&&String(m.sector).toLowerCase()===String(cur.sector).toLowerCase())out.push(m);});return out;}
  function interpret(name,v){if(!Number.isFinite(v))return'Donnée indisponible';if(name==='PER')return v<10?'multiple bas':v<18?'multiple modéré':v<25?'multiple élevé':'multiple très élevé';if(name==='P/B')return v<1?'sous la valeur comptable':v<2?'prime modérée':'prime élevée';if(name==='P/S')return v<1?'multiple bas':v<3?'multiple modéré':'multiple élevé';return'';}
  function cls(v,med){return Number.isFinite(v)&&Number.isFinite(med)?(v<=med?'positive':'negative'):'';}
  function ratio(label,value,detail,klass){return'<div class="fund-ratio"><span>'+label+'</span><strong class="'+(klass||'')+'">'+value+'</strong><small>'+detail+'</small></div>';}

  function injectStyles(){
    if(document.getElementById('fund-advanced-ratios-css'))return;
    var s=document.createElement('style');s.id='fund-advanced-ratios-css';s.textContent='\
      .fund-ratio-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--border2)}\
      .fund-ratio{background:var(--surface,#111);padding:14px;min-width:0}.fund-ratio span{display:block;color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.06em}.fund-ratio strong{display:block;margin:6px 0;font:500 17px var(--mono);color:var(--cream)}.fund-ratio small{display:block;color:var(--dim);font-size:10px;line-height:1.4}.fund-ratio-year{font:500 10px var(--mono);color:var(--gold)}\
      .fund-sector-summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.fund-sector-chip{padding:7px 9px;border:1px solid var(--border2);border-radius:6px;font-size:10px}.fund-peer-table-wrap{overflow-x:auto}.fund-peer-table{width:100%;min-width:650px;border-collapse:collapse}.fund-peer-table th,.fund-peer-table td{padding:9px 8px;border-bottom:1px solid var(--border2);font-size:10px;text-align:right}.fund-peer-table th:first-child,.fund-peer-table td:first-child{text-align:left}.fund-peer-table th{color:var(--dim);font-size:9px;text-transform:uppercase}.fund-peer-current{background:rgba(184,150,78,.08)}\
      .fund-ratio-note{margin-top:14px;padding:11px;border-left:2px solid var(--gold);background:rgba(184,150,78,.035);color:var(--dim);font-size:10px;line-height:1.5}.positive{color:var(--green)!important}.negative{color:var(--red)!important}\
      .fund-series-panel{margin-top:18px;border-top:1px solid var(--border2);padding-top:16px}.fund-series-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.fund-series-title{font:600 14px var(--serif);color:var(--cream)}.fund-series-note{font-size:10px;color:var(--dim);line-height:1.45;margin-top:4px}.fund-series-filters{display:flex;gap:7px;flex-wrap:wrap;margin:13px 0}.fund-series-filter{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid var(--border2);border-radius:6px;background:var(--surface,#111);color:var(--muted);font-size:9px;cursor:pointer}.fund-series-filter input{accent-color:var(--gold)}.fund-series-filter.active{border-color:rgba(184,150,78,.55);color:var(--gold)}.fund-series-chart{height:300px;margin-top:10px}.fund-series-chart canvas{width:100%!important;height:100%!important}.fund-series-empty{padding:16px;border:1px dashed var(--border2);color:var(--dim);font-size:10px}.fund-series-tools{display:flex;gap:7px;align-items:center}.fund-series-btn{border:1px solid var(--border2);background:none;color:var(--muted);border-radius:5px;padding:6px 8px;font-size:9px;cursor:pointer}.fund-series-btn:hover{color:var(--cream);border-color:var(--gold)}\
      @media(max-width:700px){.fund-ratio-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fund-peer-table{min-width:650px}.fund-ratio{padding:11px}.fund-ratio strong{font-size:15px}.fund-series-chart{height:250px}}\
      @media(max-width:360px){.fund-ratio{padding:9px}.fund-ratio span{font-size:8px}.fund-ratio strong{font-size:13px}}';document.head.appendChild(s);
  }

  async function getPerRows(t){
    if(perCache[t])return perCache[t];
    try{var r=await fetch('/api/per-history?ticker='+encodeURIComponent(t),{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);var d=await r.json();perCache[t]=Array.isArray(d.rows)?d.rows:[];return perCache[t];}catch(e){console.warn('[FUND-PER] API indisponible:',e.message);perCache[t]=[];return[];}
  }

  function seriesDefinitions(){
    return [
      {id:'bpa',label:'BPA',unit:'FCFA/action',color:'gold',get:function(f){var s=first(f,['nombre_actions','nb_actions','actions','shares','nombreAction','nbActions']),r=first(f,['resultat_net','resultatNet','net_income','netIncome']);return s>0&&Number.isFinite(r)?r/s:NaN;}},
      {id:'per',label:'PER',unit:'multiple',color:'green',per:true,get:function(f){return NaN;}},
      {id:'rn',label:'Résultat net',unit:'FCFA',color:'blue',get:function(f){return first(f,['resultat_net','resultatNet','net_income','netIncome']);}},
      {id:'ca',label:'Chiffre d’affaires',unit:'FCFA',color:'violet',get:function(f){return first(f,['chiffre_affaires','chiffreAffaires','revenue','ca']);}},
      {id:'marge',label:'Marge nette',unit:'%',color:'orange',get:function(f){var ca=first(f,['chiffre_affaires','chiffreAffaires','revenue','ca']),rn=first(f,['resultat_net','resultatNet','net_income','netIncome']);return ca>0&&Number.isFinite(rn)?rn/ca*100:NaN;}},
      {id:'roe',label:'ROE',unit:'%',color:'teal',get:function(f){var e=first(f,['capitaux_propres','capitauxPropres','fonds_propres','fondsPropres','equity','total_equity']),r=first(f,['resultat_net','resultatNet','net_income','netIncome']);return e>0&&Number.isFinite(r)?r/e*100:NaN;}},
      {id:'roa',label:'ROA',unit:'%',color:'pink',get:function(f){var a=first(f,['total_actif','totalActif','actif_total','actifTotal','total_assets','assets']),r=first(f,['resultat_net','resultatNet','net_income','netIncome']);return a>0&&Number.isFinite(r)?r/a*100:NaN;}},
      {id:'div',label:'Dividende',unit:'FCFA',color:'yellow',get:function(f){return first(f,['dividendes','dividende','dividendes_distribues','dividendesDistribues','dividend']);}},
      {id:'fcf',label:'Free Cash Flow',unit:'FCFA',color:'cyan',get:function(f){var c=first(f,['cash_flow_operationnel','cashFlowOperationnel','operating_cash_flow']),x=first(f,['capex','investissements','investissement']);return Number.isFinite(c)&&Number.isFinite(x)?c-x:NaN;}}
    ];
  }

  function selectedSeries(){
    var root=document.getElementById('fundSeriesFilters');if(!root)return[];
    var ids=[].slice.call(root.querySelectorAll('input:checked')).map(function(x){return x.value;});
    return seriesDefinitions().filter(function(s){return ids.indexOf(s.id)>-1;});
  }

  async function renderSeries(t){
    var root=document.getElementById('fundSeriesPanel');if(!root)return;
    var defs=seriesDefinitions(),selected=selectedSeries(),rows=annual(t),perRows=await getPerRows(t),perMap={};
    perRows.forEach(function(r){perMap[String(r.annee)]=r;});
    if(!selected.length){if(chart){chart.destroy();chart=null;}document.getElementById('fundSeriesChartEmpty').style.display='block';return;}
    document.getElementById('fundSeriesChartEmpty').style.display='none';
    var labels=rows.map(function(f){return String(f.annee);});
    var datasets=selected.map(function(s){
      var values=rows.map(function(f){if(s.per){var p=perMap[String(f.annee)];return p&&Number.isFinite(Number(p.per))?Number(p.per):NaN;}return s.get(f);});
      return {label:s.label,data:values,borderWidth:1.6,tension:.25,fill:false,pointRadius:3};
    });
    if(chart){chart.destroy();chart=null;}
    var canvas=document.getElementById('fundSeriesChart');if(!canvas||typeof Chart!=='function')return;
    chart=new Chart(canvas,{type:'line',data:{labels:labels,datasets:datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'bottom',labels:{color:'rgba(255,255,255,.65)',font:{size:9},boxWidth:10}},tooltip:{callbacks:{label:function(ctx){var d=selected[ctx.datasetIndex],v=ctx.parsed.y;if(!Number.isFinite(v))return ' '+d.label+' : N/A';return ' '+d.label+' : '+(d.id==='per'?v.toFixed(2)+'x':(d.unit==='%'?v.toFixed(1)+'%':v.toLocaleString('fr-FR')+' '+d.unit));}}}},scales:{x:{ticks:{color:'rgba(255,255,255,.55)',font:{size:9}},grid:{color:'rgba(255,255,255,.06)'}},y:{ticks:{color:'rgba(255,255,255,.55)',font:{size:9}},grid:{color:'rgba(255,255,255,.06)'}}}}});
    var multi=selected.length>1;var note=document.getElementById('fundSeriesModeNote');if(note)note.textContent=multi?'Plusieurs séries sélectionnées : utilisez les infobulles pour comparer les valeurs exactes, les unités restent propres à chaque indicateur.':'Série unique : lecture directe de la valeur par exercice.';
  }

  function addSeriesPanel(content,t){
    if(document.body.dataset.mode!=='pro')return;
    var old=document.getElementById('fundSeriesPanel');if(old)old.remove();
    var panel=document.createElement('div');panel.id='fundSeriesPanel';panel.className='fund-series-panel pro-only';
    var defs=seriesDefinitions();
    var defaults=['bpa','per','rn'];
    panel.innerHTML='<div class="fund-series-head"><div><div class="fund-series-title">Séries financières à afficher</div><div class="fund-series-note">Choisissez les indicateurs à afficher dans le graphique historique : BPA, PER, résultat net, chiffre d’affaires, marges, rentabilité, dividende et FCF.</div></div><div class="fund-series-tools"><button type="button" class="fund-series-btn" id="fundSeriesAll">Tout</button><button type="button" class="fund-series-btn" id="fundSeriesNone">Aucun</button></div></div><div class="fund-series-filters" id="fundSeriesFilters">'+defs.map(function(s){return '<label class="fund-series-filter '+(defaults.indexOf(s.id)>-1?'active':'')+'"><input type="checkbox" value="'+s.id+'" '+(defaults.indexOf(s.id)>-1?'checked':'')+'> '+esc(s.label)+'</label>';}).join('')+'</div><div id="fundSeriesModeNote" class="fund-series-note"></div><div class="fund-series-chart"><canvas id="fundSeriesChart"></canvas></div><div id="fundSeriesChartEmpty" class="fund-series-empty" style="display:none">Sélectionnez au moins un indicateur.</div>';
    content.appendChild(panel);
    panel.querySelectorAll('input').forEach(function(input){input.addEventListener('change',function(){input.closest('label').classList.toggle('active',input.checked);renderSeries(t);});});
    document.getElementById('fundSeriesAll').addEventListener('click',function(){panel.querySelectorAll('input').forEach(function(i){i.checked=true;i.closest('label').classList.add('active');});renderSeries(t);});
    document.getElementById('fundSeriesNone').addEventListener('click',function(){panel.querySelectorAll('input').forEach(function(i){i.checked=false;i.closest('label').classList.remove('active');});renderSeries(t);});
    renderSeries(t);
  }

  async function addCard(){
    injectStyles();
    var content=document.getElementById('fundContent'),select=document.getElementById('fundTickerSelect');
    if(!content||!select||!select.value)return;
    var t=String(select.value).toUpperCase(),m=metrics(t);if(!m)return;
    var perRows=await getPerRows(t),currentYear=new Date().getUTCFullYear(),currentPer=perRows.find(function(r){return Number(r.annee)===currentYear;})||null;
    if(currentPer){m.pe=Number.isFinite(Number(currentPer.per))?Number(currentPer.per):NaN;m.eps=Number.isFinite(Number(currentPer.bpa))?Number(currentPer.bpa):m.eps;}
    var ps=[m].concat(peers(t)),med={pe:median(ps.map(function(x){return x.pe;})),pb:median(ps.map(function(x){return x.pb;})),ps:median(ps.map(function(x){return x.ps;}))};
    var old=document.getElementById('fundRatioAnalysis');if(old)old.remove();
    var card=document.createElement('div');card.id='fundRatioAnalysis';card.className='card fund-ratio-analysis';
    var perDetail=currentPer?(currentPer.per_status==='deficitaire'?'N/A — société déficitaire':currentPer.per_status==='bpa_nul'?'N/A — BPA nul':(currentPer.per_label||'PER courant')+' · '+(currentPer.bpa_reference_label||'')):'PER courant via historique centralisé';
    if(currentPer&&currentPer.bpa_age_label)perDetail+=' · BPA disponible depuis '+currentPer.bpa_age_label;
    var html='<div class="card-header"><div><div class="card-title">Ratios & valorisation</div><div class="fund-section-note">Fondamentaux, structure financière et valorisation relative. Le PER courant utilise le moteur PER centralisé.</div></div><span class="fund-ratio-year">'+esc(m.year)+'</span></div><div class="card-body"><div class="fund-ratio-grid">'+ratio('BPA',money(m.eps)+' FCFA',currentPer&&currentPer.bpa_reference_label?currentPer.bpa_reference_label:'Résultat net / action')+ratio('Valeur comptable / action',money(m.bvps)+' FCFA','Capitaux propres / action')+ratio('PER courant',mult(m.pe),perDetail,cls(m.pe,med.pe))+ratio('P/B',mult(m.pb),interpret('P/B',m.pb),cls(m.pb,med.pb))+ratio('P/S',mult(m.ps),interpret('P/S',m.ps),cls(m.ps,med.ps))+ratio('EV / EBITDA',mult(m.evEbitda),'Valeur d’entreprise / EBITDA')+ratio('Marge nette',pct(m.netMargin),m.netMargin>=.15?'forte rentabilité':m.netMargin>=.08?'rentabilité correcte':'marge sous pression',m.netMargin>=.15?'positive':m.netMargin<0?'negative':'')+ratio('ROE',pct(m.roe),m.roe>=.15?'création de valeur élevée':'Rentabilité des capitaux propres',m.roe>=.15?'positive':m.roe<0?'negative':'')+ratio('ROA',pct(m.roa),'Rentabilité des actifs',m.roa>=.08?'positive':m.roa<0?'negative':'')+ratio('FCF Yield',pct(m.fcfYield),'FCF / capitalisation',m.fcfYield>=.05?'positive':m.fcfYield<0?'negative':'')+ratio('Dette / Fonds propres',mult(m.debtEquity),'Levier financier',m.debtEquity>2?'negative':'')+ratio('Rendement dividende',pct(m.divYield),'Dividendes / capitalisation',m.divYield>0?'positive':'')+'</div><div style="margin-top:20px"><div class="card-title">Valorisation sectorielle</div><div class="fund-section-note">Comparaison avec les sociétés du même secteur disponibles dans les données existantes.</div><div class="fund-sector-summary"><span class="fund-sector-chip">Secteur : <strong>'+esc(m.sector||'Non renseigné')+'</strong></span><span class="fund-sector-chip">Pairs : <strong>'+peers(t).length+'</strong></span><span class="fund-sector-chip">PER médian : <strong>'+mult(med.pe)+'</strong></span><span class="fund-sector-chip">P/B médian : <strong>'+mult(med.pb)+'</strong></span></div><div class="fund-peer-table-wrap"><table class="fund-peer-table"><thead><tr><th>Titre</th><th>Cours</th><th>PER</th><th>P/B</th><th>P/S</th><th>ROE</th><th>Marge nette</th></tr></thead><tbody>';
    ps.sort(function(a,b){return(b.marketCap||0)-(a.marketCap||0);}).forEach(function(p){html+='<tr class="'+(p.ticker===t?'fund-peer-current':'')+'"><td><strong>'+esc(p.ticker)+'</strong></td><td>'+money(p.price)+'</td><td>'+mult(p.pe)+'</td><td>'+mult(p.pb)+'</td><td>'+mult(p.ps)+'</td><td>'+pct(p.roe)+'</td><td>'+pct(p.netMargin)+'</td></tr>';});
    html+='</tbody></table></div><div class="fund-ratio-note"><strong>Lecture :</strong> un PER, P/B ou P/S inférieur à la médiane sectorielle indique une décote relative, pas automatiquement une sous-valorisation. Les PER avec BPA nul ou négatif sont affichés comme non pertinents. Le BPA de référence et son ancienneté sont indiqués lorsque disponibles. Les données manquantes restent non calculées.</div></div></div>';
    card.innerHTML=html;var methodology=content.querySelector('.fund-methodology');if(methodology)content.insertBefore(card,methodology);else content.appendChild(card);
    addSeriesPanel(content,t);lastTicker=t;
  }

  function observe(){
    var target=document.getElementById('fundContent');if(!target)return;
    new MutationObserver(function(){clearTimeout(window.__fundRatioTimer);window.__fundRatioTimer=setTimeout(function(){if(document.body.dataset.mode==='pro')addCard();},120);}).observe(target,{childList:true,subtree:true});
    var select=document.getElementById('fundTickerSelect');if(select)select.addEventListener('change',function(){lastTicker='';setTimeout(addCard,120);});
    window.addEventListener('tc:display-mode-change',function(){setTimeout(function(){if(document.body.dataset.mode==='pro')addCard();else{var p=document.getElementById('fundRatioAnalysis');if(p)p.remove();var s=document.getElementById('fundSeriesPanel');if(s)s.remove();}},80);});
    setTimeout(function(){if(document.body.dataset.mode==='pro')addCard();},150);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
