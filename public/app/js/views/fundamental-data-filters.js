// The Capital — Dynamic fundamental data selector
// PRO-only UI. Reads existing loaded data; never modifies Supabase data.
(function () {
  'use strict';

  var METRIC_META = {
    ca:{label:'Chiffre d’affaires',group:'Résultats',fmt:'money'}, ebitda:{label:'EBITDA',group:'Résultats',fmt:'money'}, ebit:{label:'EBIT',group:'Résultats',fmt:'money'}, resultat_net:{label:'Résultat net',group:'Résultats',fmt:'money'}, resultat_net_part:{label:'Résultat net part du groupe',group:'Résultats',fmt:'money'}, bpa:{label:'BPA',group:'Par action',fmt:'money'}, dpa:{label:'DPA',group:'Par action',fmt:'money'}, actif_net_par_action:{label:'Actif net par action',group:'Par action',fmt:'money'}, fonds_propres:{label:'Fonds propres',group:'Bilan',fmt:'money'}, total_actif:{label:'Total actif',group:'Bilan',fmt:'money'}, dette_nette:{label:'Dette nette',group:'Endettement',fmt:'money'}, tresorerie:{label:'Trésorerie',group:'Bilan',fmt:'money'}, cap_boursiere:{label:'Capitalisation boursière',group:'Marché',fmt:'money'}, roe:{label:'ROE',group:'Rentabilité',fmt:'pct'}, roe_calc:{label:'ROE calculé',group:'Rentabilité',fmt:'pct'}, roa:{label:'ROA',group:'Rentabilité',fmt:'pct'}, marge_nette:{label:'Marge nette',group:'Marges',fmt:'pct'}, croissance_ca:{label:'Croissance CA',group:'Croissance',fmt:'pct'}, croissance_rn:{label:'Croissance résultat net',group:'Croissance',fmt:'pct'}, dividend_yield:{label:'Dividend Yield',group:'Dividendes',fmt:'pct'}, payout_ratio:{label:'Payout Ratio',group:'Dividendes',fmt:'pct'}, coussin_securite:{label:'Coussin de sécurité',group:'Valorisation',fmt:'pct'},
      dette_fin:{label:'Dette financière',group:'Endettement',fmt:'money'}, dettes_financieres:{label:'Dettes financières',group:'Endettement',fmt:'money'}, rbe:{label:'RBE',group:'Résultats',fmt:'money'}, resultat_exploitation:{label:'Résultat d’exploitation',group:'Résultats',fmt:'money'}, cash_flow_operationnel:{label:'Flux de trésorerie opérationnel',group:'Cash-flow',fmt:'money'}, capex:{label:'CAPEX',group:'Cash-flow',fmt:'money'}, ebitda_margin:{label:'Marge EBITDA',group:'Marges',fmt:'pct'}, ebit_margin:{label:'Marge EBIT',group:'Marges',fmt:'pct'}, fcf:{label:'Free Cash Flow',group:'Cash-flow',fmt:'money'}, fcf_margin:{label:'Marge FCF',group:'Marges',fmt:'pct'}, net_debt_ebitda:{label:'Dette nette / EBITDA',group:'Endettement',fmt:'mult'}, gearing:{label:'Gearing',group:'Endettement',fmt:'pct'}, earnings_yield:{label:'Earnings Yield',group:'Valorisation',fmt:'pct'}, dividend_growth:{label:'Croissance du dividende',group:'Dividendes',fmt:'pct'}, per:{label:'PER',group:'Valorisation',fmt:'mult'}, per_forward:{label:'PER forward',group:'Valorisation',fmt:'mult'}, pb:{label:'P/B',group:'Valorisation',fmt:'mult'}, ps:{label:'P/S',group:'Valorisation',fmt:'mult'}, ev_ebitda:{label:'EV / EBITDA',group:'Valorisation',fmt:'mult'}
  };

  function num(v){var n=Number(v);return Number.isFinite(n)?n:NaN;}
  function data(){
    var a=Array.isArray(window.allFinancialsAnnuels)?window.allFinancialsAnnuels:null;
    if(!a && Array.isArray(window.allFinancials)) a=window.allFinancials;
    return a||[];
  }
  function selectedTicker(){var s=document.getElementById('fundTickerSelect');return s&&s.value?String(s.value).toUpperCase():'';}
  function rows(){var t=selectedTicker();return data().filter(function(r){return String(r&&r.ticker||'').toUpperCase()===t;}).sort(function(a,b){return (num(a.annee)||0)-(num(b.annee)||0);});}
  function fmt(v,type){if(!Number.isFinite(v))return '—';if(type==='pct')return (v>1||v<-1?(v).toFixed(1):(v*100).toFixed(1))+'%';if(type==='mult')return v.toFixed(2)+'x';return Math.round(v).toLocaleString('fr-FR');}
  function calc(r,key){
    var ca=num(r.chiffre_affaires),rn=num(r.resultat_net),eb=num(r.ebitda),ebit=num(r.ebit),eq=num(r.fonds_propres),act=num(r.total_actif),debt=num(r.dette_nette),cash=num(r.tresorerie),shares=num(r.nb_actions||r.nombre_actions),cap=num(r.cap_boursiere),bpa=num(r.bpa),dpa=num(r.dpa),price=num(r.cours||r.price);
    if(key==='fcf'){var cfo=num(r.cash_flow_operationnel),capex=num(r.capex);return Number.isFinite(cfo)&&Number.isFinite(capex)?cfo-capex:NaN;}
    if(key==='ebitda_margin')return ca&&Number.isFinite(eb)?eb/ca:NaN;
    if(key==='ebit_margin')return ca&&Number.isFinite(ebit)?ebit/ca:NaN;
    if(key==='fcf_margin'){var f=calc(r,'fcf');return ca&&Number.isFinite(f)?f/ca:NaN;}
    if(key==='net_debt_ebitda')return eb&&Number.isFinite(debt)?debt/eb:NaN;
    if(key==='gearing')return eq&&Number.isFinite(debt)?debt/eq:NaN;
    if(key==='earnings_yield')return Number.isFinite(bpa)&&price>0?bpa/price:NaN;
    if(key==='per')return Number.isFinite(bpa)&&bpa>0&&price>0?price/bpa:NaN;
    if(key==='pb')return Number.isFinite(eq)&&shares>0&&price>0?price/(eq/shares):NaN;
    if(key==='ps')return Number.isFinite(cap)&&ca>0?cap/ca:NaN;
    if(key==='ev_ebitda')return Number.isFinite(cap)&&Number.isFinite(debt)&&eb>0?(cap+debt)/eb:NaN;
    if(key==='dividend_growth'){return NaN;}
    return num(r[key]);
  }
  function available(){
    var rs=rows(), keys=Object.keys(METRIC_META), out=[];
    keys.forEach(function(k){if(rs.some(function(r){return Number.isFinite(calc(r,k));}))out.push(k);});
    return out;
  }
  function inject(){
    if(document.getElementById('fundDynamicFilterCss'))return;
    var s=document.createElement('style');s.id='fundDynamicFilterCss';s.textContent='.fund-dynamic-filter{margin-top:18px;border:1px solid var(--border2);background:var(--surface,#111)}.fund-dynamic-filter-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid var(--border2)}.fund-dynamic-filter-title{font-size:12px;font-weight:600}.fund-dynamic-filter-note{color:var(--dim);font-size:10px;margin-top:3px}.fund-dynamic-actions{display:flex;gap:6px;flex-wrap:wrap}.fund-dynamic-actions button{font:500 10px var(--mono);padding:6px 8px;background:transparent;color:var(--cream);border:1px solid var(--border2);border-radius:5px;cursor:pointer}.fund-dynamic-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--border2)}.fund-dynamic-group{background:var(--surface,#111);padding:11px}.fund-dynamic-group h4{margin:0 0 8px;font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--gold)}.fund-dynamic-check{display:flex;align-items:center;gap:7px;margin:6px 0;color:var(--cream);font-size:10px}.fund-dynamic-check input{accent-color:var(--gold)}.fund-dynamic-chart{height:300px;margin-top:1px;background:var(--surface,#111);padding:14px;overflow:auto}.fund-dynamic-table{width:100%;border-collapse:collapse;font-size:10px}.fund-dynamic-table th,.fund-dynamic-table td{padding:7px 8px;border-bottom:1px solid var(--border2);text-align:right;white-space:nowrap}.fund-dynamic-table th:first-child,.fund-dynamic-table td:first-child{text-align:left}.fund-dynamic-legend{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.fund-dynamic-legend span{padding:5px 7px;border:1px solid var(--border2);border-radius:4px;font-size:9px}.fund-dynamic-empty{color:var(--dim);font-size:10px;padding:18px;text-align:center}@media(max-width:900px){.fund-dynamic-groups{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.fund-dynamic-groups{grid-template-columns:1fr}.fund-dynamic-filter-head{align-items:flex-start;flex-direction:column}}';document.head.appendChild(s);
  }
  function render(){
    var content=document.getElementById('fundContent'),t=selectedTicker();if(!content||!t)return;
    inject();var old=document.getElementById('fundDynamicFilter');if(old)old.remove();var keys=available();
    var wrap=document.createElement('div');wrap.id='fundDynamicFilter';wrap.className='fund-dynamic-filter';
    var head=document.createElement('div');head.className='fund-dynamic-filter-head';head.innerHTML='<div><div class="fund-dynamic-filter-title">Séries financières à afficher</div><div class="fund-dynamic-filter-note">Mode PRO · toutes les métriques calculables à partir des données financières disponibles pour cette société.</div></div><div class="fund-dynamic-actions"><button type="button" data-fd-all>Tout</button><button type="button" data-fd-none>Aucun</button></div>';wrap.appendChild(head);
    var groups={};keys.forEach(function(k){var g=METRIC_META[k].group;(groups[g]||(groups[g]=[])).push(k);});var grid=document.createElement('div');grid.className='fund-dynamic-groups';Object.keys(groups).forEach(function(g){var box=document.createElement('div');box.className='fund-dynamic-group';box.innerHTML='<h4>'+g+'</h4>';groups[g].forEach(function(k){var id='fd-'+k,lab=document.createElement('label');lab.className='fund-dynamic-check';lab.innerHTML='<input type="checkbox" id="'+id+'" data-fd-key="'+k+'" checked><span>'+METRIC_META[k].label+'</span>';box.appendChild(lab);});grid.appendChild(box);});wrap.appendChild(grid);
    var chart=document.createElement('div');chart.className='fund-dynamic-chart';chart.innerHTML='<div class="fund-dynamic-empty">Sélectionnez les indicateurs à afficher.</div>';wrap.appendChild(chart);
    content.appendChild(wrap);
    function draw(){
      var selected=[].slice.call(wrap.querySelectorAll('[data-fd-key]:checked')).map(function(x){return x.getAttribute('data-fd-key');}),rs=rows();if(!selected.length||!rs.length){chart.innerHTML='<div class="fund-dynamic-empty">Aucune série sélectionnée.</div>';return;}
      var html='<div class="fund-dynamic-legend">';selected.forEach(function(k){html+='<span>'+METRIC_META[k].label+'</span>';});html+='</div><table class="fund-dynamic-table"><thead><tr><th>Exercice</th>';selected.forEach(function(k){html+='<th>'+METRIC_META[k].label+'</th>';});html+='</tr></thead><tbody>';rs.forEach(function(r){html+='<tr><td>'+String(r.annee||'—')+'</td>';selected.forEach(function(k){html+='<td>'+fmt(calc(r,k),METRIC_META[k].fmt)+'</td>';});html+='</tr>';});html+='</tbody></table>';chart.innerHTML=html;
    }
    wrap.querySelectorAll('[data-fd-key]').forEach(function(c){c.addEventListener('change',draw);});wrap.querySelector('[data-fd-all]').addEventListener('click',function(){wrap.querySelectorAll('[data-fd-key]').forEach(function(c){c.checked=true;});draw();});wrap.querySelector('[data-fd-none]').addEventListener('click',function(){wrap.querySelectorAll('[data-fd-key]').forEach(function(c){c.checked=false;});draw();});draw();
  }
  function observe(){
    var content=document.getElementById('fundContent');if(!content)return;
    var select=document.getElementById('fundTickerSelect');if(select)select.addEventListener('change',function(){setTimeout(render,180);});
    new MutationObserver(function(){clearTimeout(window.__fundDynamicTimer);window.__fundDynamicTimer=setTimeout(render,120);}).observe(content,{childList:true,subtree:true});
    setTimeout(render,300);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
