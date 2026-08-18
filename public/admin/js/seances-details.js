/* THE CAPITAL — Détails opérationnels d'une séance */
(function(){
'use strict';
var MODAL='tc-session-details-modal';
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;')}
function num(v){var n=Number(v);return Number.isFinite(n)?n.toLocaleString('fr-FR'): '—'}
function auth(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json','Content-Type':'application/json'}}
async function get(path){var r=await fetch(SB_REST+path,{headers:auth()}),t=await r.text();if(!r.ok)throw Error('HTTP '+r.status+' — '+t.slice(0,240));return t?JSON.parse(t):[]}
function close(){var m=document.getElementById(MODAL);if(m)m.remove()}
function openModal(date){
 close();
 var m=document.createElement('div');m.id=MODAL;m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
 m.innerHTML='<div style="width:min(1180px,96vw);max-height:92vh;overflow:auto;background:var(--surface,#111);border:1px solid var(--border,#333);box-shadow:0 20px 60px rgba(0,0,0,.45);border-top:2px solid var(--gold,#c9a45c)"><div class="card-header" style="position:sticky;top:0;z-index:2;background:var(--surface,#111);display:flex;align-items:center"><div><span class="card-title">DÉTAILS DE LA SÉANCE</span><div style="font:11px var(--mono);color:var(--gold);margin-top:4px">${esc(date)}</div></div><button class="btn btn-outline btn-sm" data-close style="margin-left:auto">✕ Fermer</button></div><div id="tc-session-details-body" style="padding:18px"><div class="loading"><div class="spinner"></div><p>Chargement des données de la séance…</p></div></div></div>';
 document.body.appendChild(m);m.querySelector('[data-close]').onclick=close;m.addEventListener('click',function(e){if(e.target===m)close()});
 load(date);
}
async function load(date){
 var body=document.getElementById('tc-session-details-body');
 try{
  var rows=await get('/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation,valeur_totale&date_seance=eq.'+encodeURIComponent(date)+'&order=ticker.asc&limit=5000');
  var idx=[];try{idx=await get('/indices?select=id,indice,date_seance,valeur,variation,variation_pct&date_seance=eq.'+encodeURIComponent(date)+'&order=indice.asc&limit=100')}catch(e){}
  rows=Array.isArray(rows)?rows:[];idx=Array.isArray(idx)?idx:[];
  var bad=rows.filter(function(r){var c=Number(r.cours_cloture),o=Number(r.cours_ouverture),h=Number(r.plus_haut),l=Number(r.plus_bas),v=Number(r.volume),vr=Number(r.variation);return !Number.isFinite(c)||c<0||(Number.isFinite(h)&&Number.isFinite(l)&&l>h)||(Number.isFinite(o)&&Number.isFinite(h)&&o>h)||(Number.isFinite(o)&&Number.isFinite(l)&&o<l)||(Number.isFinite(c)&&Number.isFinite(h)&&c>h)||(Number.isFinite(c)&&Number.isFinite(l)&&c<l)||(Number.isFinite(v)&&v<0)||(Number.isFinite(vr)&&Math.abs(vr)>7.5)});
  var html='<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:18px"><div class="kpi"><div class="kpi-label">Cours</div><div class="kpi-value">'+rows.length+'</div></div><div class="kpi"><div class="kpi-label">Indices</div><div class="kpi-value">'+idx.length+'</div></div><div class="kpi"><div class="kpi-label">Anomalies</div><div class="kpi-value" style="color:'+(bad.length?'#e58d84':'#9bc7a0')+'">'+bad.length+'</div></div><div class="kpi"><div class="kpi-label">Statut</div><div class="kpi-value" style="font-size:16px">'+(bad.length?'À CORRIGER':'CONTRÔLABLE')+'</div></div></div>';
  html+='<div class="actions-row" style="margin-bottom:14px"><button class="btn btn-primary btn-sm" data-manage-cours>Gérer les cours de cette séance</button><button class="btn btn-outline btn-sm" data-manage-hist>Ouvrir dans Historique</button><button class="btn btn-outline btn-sm" data-refresh-details>↺ Actualiser</button></div>';
  if(bad.length)html+='<div class="tc-alert hard" style="margin-bottom:14px"><strong>'+bad.length+' ligne(s) présentent une anomalie.</strong> Corrigez-les dans le module Cours avant de valider la séance.</div>';
  html+='<div class="tw"><table><thead><tr><th>Ticker</th><th class="r">Clôture</th><th class="r">Ouverture</th><th class="r">+Haut</th><th class="r">+Bas</th><th class="r">Volume</th><th class="r">Variation%</th><th>Contrôle</th></tr></thead><tbody>';
  html+=rows.map(function(r){var isBad=bad.indexOf(r)>=0;return '<tr><td><strong>'+esc(r.ticker)+'</strong></td><td class="r">'+num(r.cours_cloture)+'</td><td class="r">'+num(r.cours_ouverture)+'</td><td class="r">'+num(r.plus_haut)+'</td><td class="r">'+num(r.plus_bas)+'</td><td class="r">'+num(r.volume)+'</td><td class="r">'+num(r.variation)+'</td><td style="color:'+(isBad?'#e58d84':'#9bc7a0')+'">'+(isBad?'✕ À corriger':'✓ OK')+'</td></tr>'}).join('');
  html+='</tbody></table></div>';
  if(!rows.length)html+='<div class="info-box">Aucun cours enregistré pour cette date.</div>';
  if(idx.length){html+='<div style="margin-top:20px;font-weight:600">Indices de la séance</div><div class="tw" style="margin-top:8px"><table><thead><tr><th>Indice</th><th class="r">Valeur</th><th class="r">Variation</th><th class="r">Variation %</th></tr></thead><tbody>'+idx.map(function(r){return '<tr><td>'+esc(r.indice)+'</td><td class="r">'+num(r.valeur)+'</td><td class="r">'+num(r.variation)+'</td><td class="r">'+num(r.variation_pct)+'</td></tr>'}).join('')+'</tbody></table></div>'}
  body.innerHTML=html;
  body.querySelector('[data-refresh-details]').onclick=function(){load(date)};
  body.querySelector('[data-manage-cours]').onclick=function(){var f=document.getElementById('cours-date-filter');if(f)f.value=date;if(typeof switchTab==='function'){var tabs=document.querySelectorAll('.admin-tab');switchTab('cours',tabs[1]||null)}if(typeof loadCours==='function')setTimeout(loadCours,100);close()};
  body.querySelector('[data-manage-hist]').onclick=function(){var from=document.getElementById('hist-date-from'),to=document.getElementById('hist-date-to');if(from)from.value=date;if(to)to.value=date;var sub=document.querySelector('#panel-historique .sub-tab:nth-child(3)');if(typeof switchTab==='function'){var tabs=document.querySelectorAll('.admin-tab');switchTab('historique',tabs[2]||null)}if(sub&&typeof switchSubTab==='function')switchSubTab('hist','view',sub);setTimeout(function(){if(typeof loadHistoriqueTicker==='function')loadHistoriqueTicker()},100);close()};
 }catch(e){body.innerHTML='<div class="tc-alert hard"><strong>Impossible de charger les détails.</strong><br>'+esc(e.message)+'</div><button class="btn btn-outline btn-sm" data-close>Fermer</button>';body.querySelector('[data-close]').onclick=close}
}
function intercept(e){var b=e.target.closest&&e.target.closest('[data-view]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();var d=b.getAttribute('data-view');if(d)openModal(d)}
document.addEventListener('click',intercept,true);
window.tcOpenSessionDetails=openModal;
})();
