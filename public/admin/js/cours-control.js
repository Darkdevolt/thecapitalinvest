/* THE CAPITAL — Cours & Historique BRVM : poste de pilotage */
(function(){
'use strict';
var state={rows:[],filtered:[],selected:null,view:'table',ticker:'',dateFrom:'',dateTo:'',status:'all',search:''};
var rootId='cours-control-center';

function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c];});}
function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
function fmt(v,d){var n=num(v);return n==null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:d==null?2:d});}
function pct(v){var n=num(v);return n==null?'—':(n>0?'+':'')+n.toFixed(2)+' %';}
function color(v){var n=num(v);return n>0?'#3fb950':n<0?'#e5534b':'var(--muted)';}
function headers(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json'};}
async function api(path,opts){var r=await fetch(SB_REST+path,Object.assign({headers:headers()},opts||{}));if(!r.ok)throw new Error('HTTP '+r.status+' — '+(await r.text()).slice(0,180));return r.json().catch(function(){return [];});}
async function loadRows(){
  setBusy('Chargement du référentiel de cours…');
  try{
    var rows=await api('/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation,valeur_totale&order=date_seance.desc,ticker.asc&limit=5000');
    state.rows=Array.isArray(rows)?rows:[];
    applyFilters();
  }catch(e){setError(e.message);}
}
function setBusy(t){var r=document.getElementById(rootId);if(r)r.querySelector('.cc-status').textContent=t;}
function setError(t){var r=document.getElementById(rootId);if(r)r.querySelector('.cc-status').innerHTML='<span class="cc-bad">'+esc(t)+'</span>';}
function applyFilters(){
  var s=state.search.toUpperCase();
  state.filtered=state.rows.filter(function(r){
    var t=(r.ticker||'').toUpperCase(), d=r.date_seance||'', v=num(r.variation);
    var okSearch=!s||t.indexOf(s)!==-1;
    var okFrom=!state.dateFrom||d>=state.dateFrom, okTo=!state.dateTo||d<=state.dateTo;
    var okStatus=state.status==='all'||(state.status==='up'&&v>0)||(state.status==='down'&&v<0)||(state.status==='flat'&&v===0);
    return okSearch&&okFrom&&okTo&&okStatus;
  });
  render();
}
function stats(){
  var a=state.filtered, up=0,down=0,flat=0,vol=0;
  a.forEach(function(r){var v=num(r.variation)||0;if(v>0)up++;else if(v<0)down++;else flat++;vol+=num(r.volume)||0;});
  return {n:a.length,up:up,down:down,flat:flat,vol:vol};
}
function render(){
  var r=document.getElementById(rootId);if(!r)return;
  var s=stats();
  r.querySelector('.cc-kpis').innerHTML=[
    kpi('Cours affichés',s.n,'sur '+state.rows.length+' enregistrés'),
    kpi('Hausses',s.up,'variation > 0'),kpi('Baisses',s.down,'variation < 0'),kpi('Stables',s.flat,'variation = 0'),kpi('Volume',fmt(s.vol,0),'titres')
  ].join('');
  r.querySelector('.cc-status').textContent='Référentiel chargé · '+state.rows.length+' cours · '+new Date().toLocaleTimeString('fr-FR');
  renderBody();
}
function kpi(a,b,c){return '<div class="cc-kpi"><div>'+a+'</div><strong>'+b+'</strong><small>'+c+'</small></div>';}
function renderBody(){
 var r=document.getElementById(rootId), body=r.querySelector('.cc-body');
 if(state.view==='table')body.innerHTML=tableView();
 else if(state.view==='chart')body.innerHTML=chartView();
 else if(state.view==='health')body.innerHTML=healthView();
 else body.innerHTML=detailView();
}
function tableView(){
 var rows=state.filtered.slice(0,500), h='<div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Ticker</th><th>Date</th><th>Cours</th><th>Variation</th><th>Ouverture</th><th>Haut</th><th>Bas</th><th>Volume</th><th>Valeur</th><th>Contrôle</th><th>Actions</th></tr></thead><tbody>';
 if(!rows.length)h+='<tr><td colspan="11" class="cc-empty">Aucune donnée ne correspond aux filtres.</td></tr>';
 rows.forEach(function(x){
  var v=num(x.variation), check=Math.abs(v||0)<=7.5?'OK':'BLOQUÉ';
  h+='<tr class="'+(state.selected&&state.selected.id===x.id?'sel':'')+'" onclick="window.CoursControl.select(\''+esc(x.id)+'\')">'+
  '<td class="gold">'+esc(x.ticker)+'</td><td>'+esc(x.date_seance)+'</td><td class="num">'+fmt(x.cours_cloture)+'</td><td class="num" style="color:'+color(v)+'">'+pct(v)+'</td><td class="num">'+fmt(x.cours_ouverture)+'</td><td class="num">'+fmt(x.plus_haut)+'</td><td class="num">'+fmt(x.plus_bas)+'</td><td class="num">'+fmt(x.volume,0)+'</td><td class="num">'+fmt(x.valeur_totale,0)+'</td><td><span class="cc-pill '+(check==='OK'?'ok':'bad')+'">'+check+'</span></td><td><button class="cc-btn" onclick="event.stopPropagation();window.CoursControl.edit(\''+esc(x.id)+'\')">Modifier</button> <button class="cc-btn danger" onclick="event.stopPropagation();window.CoursControl.remove(\''+esc(x.id)+'\')">Supprimer</button></td></tr>';
 });
 return h+'</tbody></table></div><div class="cc-foot">'+Math.min(500,rows.length)+' lignes visibles · utilisez les filtres pour réduire le périmètre.</div>';
}
function chartView(){
 var ticker=state.ticker||((state.filtered[0]||{}).ticker||'');
 var rows=state.rows.filter(function(x){return x.ticker===ticker;}).sort(function(a,b){return String(a.date_seance).localeCompare(String(b.date_seance));}).slice(-90);
 if(!rows.length)return '<div class="cc-empty">Sélectionnez un ticker pour afficher sa progression.</div>';
 var w=900,h=310,p=36, vals=rows.map(function(x){return num(x.cours_cloture)||0;}), max=Math.max.apply(null,vals), min=Math.min.apply(null,vals), range=max-min||1;
 var pts=rows.map(function(x,i){return (p+i*(w-2*p)/Math.max(1,rows.length-1))+','+(h-p-(vals[i]-min)*(h-2*p)/range);}).join(' ');
 var bars=rows.map(function(x,i){var v=num(x.volume)||0;var bh=(v/(Math.max.apply(null,rows.map(function(y){return num(y.volume)||0;}))||1))*(h-p-40);return '<rect x="'+(p+i*(w-2*p)/Math.max(1,rows.length-1)-2)+'" y="'+(h-p-bh)+'" width="4" height="'+bh+'" opacity=".25"/>';}).join('');
 return '<div class="cc-chart-head"><div><strong>'+esc(ticker)+'</strong><span> · 90 dernières séances maximum</span></div><select onchange="window.CoursControl.setTicker(this.value)">'+uniqueTickers().map(function(t){return '<option '+(t===ticker?'selected':'')+'>'+esc(t)+'</option>';}).join('')+'</select></div><svg class="cc-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Evolution du cours"><line x1="36" y1="274" x2="864" y2="274"/><line x1="36" y1="36" x2="36" y2="274"/><g>'+bars+'</g><polyline points="'+pts+'" fill="none" stroke="currentColor" stroke-width="2.5"/></svg><div class="cc-chart-meta"><span>Plus bas période : <b>'+fmt(min)+'</b></span><span>Plus haut : <b>'+fmt(max)+'</b></span><span>Dernier : <b>'+fmt(vals[vals.length-1])+'</b></span></div>';
}
function uniqueTickers(){var m={};state.rows.forEach(function(x){if(x.ticker)m[x.ticker]=1;});return Object.keys(m).sort();}
function healthView(){
 var bad=state.filtered.filter(function(x){var v=num(x.variation);return v!=null&&Math.abs(v)>7.5;});
 var missing=state.filtered.filter(function(x){return !x.ticker||!x.date_seance||num(x.cours_cloture)==null;});
 var ranges=state.filtered.filter(function(x){var c=num(x.cours_cloture),lo=num(x.plus_bas),hi=num(x.plus_haut);return c!=null&&((lo!=null&&c<lo)||(hi!=null&&c>hi));});
 return '<div class="cc-health"><div class="cc-health-card"><b>Limite BRVM</b><strong class="'+(bad.length?'cc-bad':'cc-good')+'">'+bad.length+'</strong><span>variation hors ±7,5 %</span></div><div class="cc-health-card"><b>Données incomplètes</b><strong>'+missing.length+'</strong><span>ticker/date/cours manquant</span></div><div class="cc-health-card"><b>Cohérence prix</b><strong class="'+(ranges.length?'cc-bad':'cc-good')+'">'+ranges.length+'</strong><span>cours hors borne haut/bas</span></div><div class="cc-health-list"><h3>À traiter</h3>'+((bad.concat(missing,ranges)).slice(0,30).map(function(x){return '<div><b>'+esc(x.ticker)+'</b> · '+esc(x.date_seance)+' · '+fmt(x.cours_cloture)+' · '+pct(x.variation)+' <button class="cc-btn" onclick="window.CoursControl.edit(\''+esc(x.id)+'\')">Ouvrir</button></div>';}).join('')||'<div class="cc-good">Aucune anomalie détectée dans le périmètre.</div>')+'</div></div>';
}
function detailView(){
 var x=state.selected;if(!x)return '<div class="cc-empty">Sélectionnez une ligne dans Tableau pour ouvrir sa fiche de contrôle.</div>';
 return '<div class="cc-detail"><div><span class="cc-eyebrow">FICHE DE CONTRÔLE</span><h2>'+esc(x.ticker)+' <small>'+esc(x.date_seance)+'</small></h2></div><div class="cc-detail-grid">'+field('Cours de clôture',x.cours_cloture)+field('Variation',pct(x.variation))+field('Ouverture',x.cours_ouverture)+field('Plus haut',x.plus_haut)+field('Plus bas',x.plus_bas)+field('Volume',x.volume)+field('Valeur totale',x.valeur_totale)+'</div><div class="cc-detail-actions"><button class="cc-primary" onclick="window.CoursControl.edit(\''+esc(x.id)+'\')">Modifier cette donnée</button><button class="cc-btn" onclick="window.CoursControl.setView(\'chart\')">Voir son évolution</button></div></div>';
}
function field(a,b){return '<div><span>'+a+'</span><strong>'+esc(typeof b==='number'?fmt(b):b)+'</strong></div>';}
function openEditor(row){
 var r=document.getElementById(rootId), m=document.createElement('div');m.className='cc-modal';m.id='cc-modal';
 m.innerHTML='<div class="cc-modal-box"><div class="cc-modal-head"><div><span>MODIFICATION D’UNE DONNÉE</span><h2>'+esc(row.ticker)+' · '+esc(row.date_seance)+'</h2></div><button onclick="window.CoursControl.closeModal()">×</button></div><div class="cc-edit-grid">'+input('Cours de clôture','e-c',row.cours_cloture)+input('Ouverture','e-o',row.cours_ouverture)+input('Plus haut','e-h',row.plus_haut)+input('Plus bas','e-b',row.plus_bas)+input('Volume','e-v',row.volume)+input('Variation %','e-var',row.variation)+input('Valeur totale','e-val',row.valeur_totale)+'</div><div class="cc-edit-note">La validation vérifie les valeurs avant écriture. Une variation supérieure à ±7,5 % est signalée et ne doit pas être enregistrée comme cours normal.</div><div class="cc-modal-actions"><span id="cc-edit-msg"></span><button class="cc-btn" onclick="window.CoursControl.closeModal()">Annuler</button><button class="cc-primary" onclick="window.CoursControl.save()">Enregistrer la correction</button></div></div>';
 r.appendChild(m);state.selected=row;
}
function input(label,id,val){return '<label>'+label+'<input id="'+id+'" type="number" step="any" value="'+(val==null?'':esc(val))+'"></label>';}
async function save(){var x=state.selected;if(!x)return;var body={};[['e-c','cours_cloture'],['e-o','cours_ouverture'],['e-h','plus_haut'],['e-b','plus_bas'],['e-v','volume'],['e-var','variation'],['e-val','valeur_totale']].forEach(function(a){var v=document.getElementById(a[0]).value;body[a[1]]=v===''?null:Number(v);});var c=num(body.cours_cloture),o=num(body.cours_ouverture),h=num(body.plus_haut),b=num(body.plus_bas),v=num(body.variation);var errors=[];if(c==null||c<0)errors.push('Cours de clôture invalide');if(h!=null&&b!=null&&b>h)errors.push('Plus bas supérieur au plus haut');if(b!=null&&c!=null&&b>c)errors.push('Plus bas supérieur à la clôture');if(o!=null&&h!=null&&o>h)errors.push('Ouverture supérieure au plus haut');if(v!=null&&Math.abs(v)>7.5)errors.push('Variation hors limite ±7,5 %');if(errors.length){document.getElementById('cc-edit-msg').innerHTML='<span class="cc-bad">'+esc(errors.join(' · '))+'</span>';return;}try{await api('/historique?id=eq.'+encodeURIComponent(x.id),{method:'PATCH',headers:Object.assign(headers(),{'Content-Type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify(body)});closeModal();await loadRows();}catch(e){document.getElementById('cc-edit-msg').innerHTML='<span class="cc-bad">'+esc(e.message)+'</span>';}}
function closeModal(){var m=document.getElementById('cc-modal');if(m)m.remove();}
async function remove(id){var x=state.rows.find(function(r){return String(r.id)===String(id)});if(!x)return;if(!confirm('Supprimer définitivement le cours '+x.ticker+' du '+x.date_seance+' ?'))return;try{await api('/historique?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:Object.assign(headers(),{'Prefer':'return=minimal'})});await loadRows();}catch(e){alert(e.message);}}
function select(id){state.selected=state.rows.find(function(x){return String(x.id)===String(id)})||null;renderBody();}
function setTicker(v){state.ticker=v;state.view='chart';renderBody();}
function setView(v){state.view=v;renderBody();}
function build(){
 var p=document.getElementById('panel-cours');if(!p)return;
 p.innerHTML='<div id="'+rootId+'" class="cours-control"><div class="cc-header"><div><div class="cc-eyebrow">THE CAPITAL · ADMIN</div><h1>Poste de pilotage <em>Cours & Historique BRVM</em></h1><p>Une seule interface pour contrôler, comprendre, corriger et analyser les données de cours. Les tables techniques Supabase restent invisibles : vous travaillez avec les données métier.</p></div><button class="cc-primary" onclick="window.CoursControl.refresh()">↻ Actualiser les données</button></div><div class="cc-kpis"></div><div class="cc-toolbar"><input id="cc-search" placeholder="Rechercher un ticker…"><input id="cc-from" type="date"><input id="cc-to" type="date"><select id="cc-status"><option value="all">Toutes variations</option><option value="up">Hausses</option><option value="flat">Stables</option><option value="down">Baisses</option></select><button class="cc-btn" onclick="window.CoursControl.reset()">Réinitialiser</button></div><div class="cc-tabs"><button data-v="table" class="active">Cours</button><button data-v="chart">Progression</button><button data-v="health">Contrôle qualité</button><button data-v="detail">Fiche sélectionnée</button></div><div class="cc-body"></div><div class="cc-status">Initialisation…</div></div>';
 var r=document.getElementById(rootId);
 r.querySelector('#cc-search').oninput=function(){state.search=this.value;applyFilters();};r.querySelector('#cc-from').onchange=function(){state.dateFrom=this.value;applyFilters();};r.querySelector('#cc-to').onchange=function(){state.dateTo=this.value;applyFilters();};r.querySelector('#cc-status').onchange=function(){state.status=this.value;applyFilters();};r.querySelectorAll('.cc-tabs button').forEach(function(b){b.onclick=function(){r.querySelectorAll('.cc-tabs button').forEach(function(x){x.classList.remove('active')});b.classList.add('active');setView(b.dataset.v);};});
 loadRows();
}
window.CoursControl={init:build,refresh:loadRows,select:select,edit:function(id){var x=state.rows.find(function(r){return String(r.id)===String(id)});if(x)openEditor(x);},save:save,remove:remove,closeModal:closeModal,setView:setView,setTicker:setTicker,reset:function(){state.search='';state.dateFrom='';state.dateTo='';state.status='all';state.ticker='';document.getElementById('cc-search').value='';document.getElementById('cc-from').value='';document.getElementById('cc-to').value='';document.getElementById('cc-status').value='all';applyFilters();}};
})();