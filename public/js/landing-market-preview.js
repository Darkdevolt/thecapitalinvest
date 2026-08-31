/* THE CAPITAL — Public BRVM market preview */
(function(){
'use strict';
if(window.__TC_LANDING_MARKET_PREVIEW__)return;window.__TC_LANDING_MARKET_PREVIEW__=true;
var root=document.getElementById('tcLandingMarketPreview');if(!root)return;
var endpoint='/api/marche-public',storageKey='tc:brvm:public-snapshot:v2',nf=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}),integer=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function num(v){var n=Number(v);return Number.isFinite(n)?nf.format(n):'—'}
function fcfa(v){var n=Number(v);return Number.isFinite(n)?integer.format(n)+' FCFA':'—'}
function pct(v){var n=Number(v);return Number.isFinite(n)?(n>0?'+':'')+n.toFixed(2).replace('.',',')+' %':'—'}
function cls(v){var n=Number(v);return Number.isFinite(n)?n>0?'up':n<0?'down':'flat':'flat'}
function indexRow(rows,name){var target=String(name).toUpperCase();return(rows||[]).find(function(r){return String(r.indice||'').trim().toUpperCase()===target})}
function date(v){if(!v)return'Séance indisponible';try{return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'long',year:'numeric',timeZone:'Africa/Abidjan'}).format(new Date(v+'T12:00:00Z'))}catch(e){return v}}
function normalize(payload){var data=payload&&payload.text?JSON.parse(payload.text):payload;return data&&data.success!==false?data:null}
function render(data){
var indices=Array.isArray(data.indices)?data.indices:[],cours=Array.isArray(data.cours)?data.cours:[],composite=indexRow(indices,'BRVM-COMPOSITE'),brvm30=indexRow(indices,'BRVM-30'),session=data.session_date||data.cours_date||data.indices_date||'';
if(!composite||!brvm30||!cours.length)throw Error('Données BRVM incomplètes');
var valid=cours.filter(function(r){return r&&Number.isFinite(Number(r.variation_pct))&&Number.isFinite(Number(r.cours))});
if(!valid.length)throw Error('Cours BRVM indisponibles');
var top=valid.slice().sort(function(a,b){return Number(b.variation_pct)-Number(a.variation_pct)}).slice(0,5),flop=valid.slice().sort(function(a,b){return Number(a.variation_pct)-Number(b.variation_pct)}).slice(0,5);
var volume=valid.reduce(function(s,r){return s+Number(r.volume||0)},0),value=valid.reduce(function(s,r){return s+Number(r.valeur_transigee!=null?r.valeur_transigee:r.valeur_totale||0)},0);
var active=valid.slice().sort(function(a,b){return Number(b.valeur_transigee!=null?b.valeur_transigee:b.valeur_totale||0)-Number(a.valeur_transigee!=null?a.valeur_transigee:a.valeur_totale||0)}).slice(0,3);
function indexBlock(label,r){return'<article class="tc-lmp-index"><div class="tc-lmp-index-top"><span>'+esc(label)+'</span><i class="tc-lmp-state '+cls(r.variation_pct)+'"></i></div><strong>'+num(r.valeur)+'</strong><span class="tc-lmp-change '+cls(r.variation_pct)+'">'+pct(r.variation_pct)+'</span></article>'}
function activeItem(r){var v=r.valeur_transigee!=null?r.valeur_transigee:r.valeur_totale;return'<li><span>'+esc(r.ticker||'—')+'</span><b>'+fcfa(v)+'</b></li>'}
function mover(r){return'<li class="tc-lmp-mover '+cls(r.variation_pct)+'"><div><b>'+esc(r.ticker||'—')+'</b><small>'+fcfa(r.cours)+'</small></div><strong>'+pct(r.variation_pct)+'</strong></li>'}
root.innerHTML='<section class="tc-lmp-section" aria-labelledby="tc-lmp-title"><div class="tc-lmp-wrap"><div class="tc-lmp-heading"><div><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2 id="tc-lmp-title">Une lecture claire du marché.</h2></div><div class="tc-lmp-intro"><p>The Capital permet de comprendre la dynamique de la séance, en un regard, à partir des données réelles du marché.</p><span class="tc-lmp-date">DERNIÈRE SÉANCE · '+esc(date(session))+'</span></div></div><div class="tc-lmp-core"><article class="tc-lmp-panel tc-lmp-trend"><div class="tc-lmp-panel-head"><span>01</span><h3>TENDANCE DU MARCHÉ</h3></div><div class="tc-lmp-indices">'+indexBlock('BRVM Composite',composite)+indexBlock('BRVM 30',brvm30)+'</div></article><article class="tc-lmp-panel tc-lmp-flow"><div class="tc-lmp-panel-head"><span>02</span><h3>FLUX &amp; ACTIVITÉ</h3></div><div class="tc-lmp-metrics"><div><small>VALEUR ÉCHANGÉE</small><strong>'+fcfa(value)+'</strong></div><div><small>VOLUME</small><strong>'+integer.format(volume)+'</strong></div><div><small>TITRES ACTIFS</small><strong>'+integer.format(valid.length)+'</strong></div></div><div class="tc-lmp-active"><span>PLUS ACTIFS · VALEUR ÉCHANGÉE</span><ul>'+active.map(activeItem).join('')+'</ul></div></article></div><div class="tc-lmp-movers"><article class="tc-lmp-mover-panel"><div class="tc-lmp-mover-head"><span>TOP 5 HAUSSES</span><em>COURS · VARIATION</em></div><ol>'+top.map(mover).join('')+'</ol></article><article class="tc-lmp-mover-panel"><div class="tc-lmp-mover-head"><span>TOP 5 BAISSES</span><em>COURS · VARIATION</em></div><ol>'+flop.map(mover).join('')+'</ol></article></div><div class="tc-lmp-source"><span>DONNÉES DE MARCHÉ RÉELLES · SOURCE API THE CAPITAL</span><span>Lecture publique · sans authentification</span></div></div></section>';
}
function loading(){root.innerHTML='<section class="tc-lmp-section tc-lmp-loading"><div class="tc-lmp-wrap"><div class="tc-lmp-heading"><div><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2>Une lecture claire du marché.</h2></div><p>Chargement de la dernière séance disponible.</p></div><div class="tc-lmp-loading-line"></div></div></section>';}
function fallback(){root.innerHTML='<section class="tc-lmp-section tc-lmp-error"><div class="tc-lmp-wrap"><span class="tc-lmp-kicker">MARCHÉ · BRVM</span><h2>Marché momentanément indisponible</h2><p>Les données de la dernière séance ne sont pas accessibles pour le moment.</p></div></section>';}
function readLocal(){try{var raw=localStorage.getItem(storageKey);if(!raw)return null;var cached=JSON.parse(raw);return cached&&cached.data?cached:null}catch(e){return null}}
function writeLocal(data){try{localStorage.setItem(storageKey,JSON.stringify({saved_at:Date.now(),data:data}))}catch(e){}}
function isNewer(next,current){if(!current)return true;var a=Date.parse(next.generated_at||'')||0,b=Date.parse(current.generated_at||'')||0;return a>b||String(next.session_date||'')>String(current.session_date||'')}
var cached=readLocal(),currentData=null;
if(cached){try{var localData=normalize(cached.data);if(localData){render(localData);currentData=localData}}catch(e){console.warn('[TC Landing Market] cached snapshot invalid',e)}}
if(!currentData)loading();
fetch(endpoint,{headers:{Accept:'application/json'},credentials:'omit',cache:'default',priority:'high'}).then(function(res){if(!res.ok)throw Error('HTTP '+res.status);return res.json()}).then(function(payload){var data=normalize(payload);if(!data)throw Error('API BRVM indisponible');if(isNewer(data,currentData)){render(data);writeLocal(data);currentData=data}else if(!currentData){render(data);writeLocal(data);currentData=data}}).catch(function(err){if(!currentData){console.warn('[TC Landing Market]',err);fallback()}else{console.warn('[TC Landing Market] silent refresh failed',err)}});
})();
