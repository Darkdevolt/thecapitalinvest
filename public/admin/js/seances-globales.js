/* THE CAPITAL — Gestion globale des séances de bourse
 * Une séance = cours des titres + indices de la même date.
 * Lecture exhaustive, contrôle de cohérence et validation locale opérateur.
 * Aucun schéma Supabase n'est modifié.
 */
(function(){
  'use strict';
  var ID='tc-seances-globales';
  var STORE='tc_global_sessions_v1';
  var S={hist:[],indices:[],tickers:[],sessions:[]};
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
  function date(v){return String(v||'').slice(0,10);}
  function weekend(d){var x=new Date(d+'T00:00:00').getDay();return x===0||x===6;}
  function fmt(d){try{return new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return d;}}
  function auth(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json'};}
  async function getAll(path){var out=[],offset=0,limit=1000;while(true){var r=await fetch(SB_REST+path+'&limit='+limit+'&offset='+offset,{headers:auth()});var t=await r.text();if(!r.ok)throw Error('HTTP '+r.status+' — '+t.slice(0,220));var p=t?JSON.parse(t):[];if(!Array.isArray(p)||!p.length)break;out=out.concat(p);if(p.length<limit)break;offset+=limit;if(offset>1000000)break;}return out;}
  function saved(d){try{return JSON.parse(localStorage.getItem(STORE)||'{}')[d]||null;}catch(e){return null;}}
  function save(d){var x={};try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}x[d]={at:new Date().toISOString()};localStorage.setItem(STORE,JSON.stringify(x));}
  function unsave(d){var x={};try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}delete x[d];localStorage.setItem(STORE,JSON.stringify(x));}
  async function load(){
    var box=document.getElementById(ID);if(!box)return;
    box.querySelector('[data-global-status]').textContent='Contrôle exhaustif en cours…';
    try{
      S.hist=await getAll('/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation&order=date_seance.asc,id.asc');
      S.indices=await getAll('/indices?select=id,indice,date_seance,valeur,variation,variation_pct&order=date_seance.asc,id.asc');
      var ents=await getAll('/entreprises?select=ticker,actif&order=ticker.asc');
      S.tickers=Array.from(new Set(ents.map(function(x){return String(x.ticker||'').trim();}).filter(Boolean)));
      build();render();
    }catch(e){box.querySelector('[data-global-status]').innerHTML='<span style="color:#e58d84">Erreur : '+esc(e.message)+'</span>';}
  }
  function build(){
    var dates={};S.hist.forEach(function(r){var d=date(r.date_seance);if(d)(dates[d]||(dates[d]={})).hist=true;});S.indices.forEach(function(r){var d=date(r.date_seance);if(d)(dates[d]||(dates[d]={})).idx=true;});
    S.sessions=Object.keys(dates).sort().reverse().map(function(d){
      var h=S.hist.filter(function(r){return date(r.date_seance)===d;}), i=S.indices.filter(function(r){return date(r.date_seance)===d;});
      var ht=new Set(h.map(function(r){return String(r.ticker||'').trim();}).filter(Boolean));
      var ix=new Set(i.map(function(r){return String(r.indice||'').trim();}).filter(Boolean));
      var dupH=h.length-ht.size,dupI=i.length-ix.size;
      var invalid=0;h.forEach(function(r){var c=num(r.cours_cloture),o=num(r.cours_ouverture),hi=num(r.plus_haut),lo=num(r.plus_bas),v=num(r.volume),vr=num(r.variation);if(c==null||c<0)invalid++;if(hi!=null&&lo!=null&&lo>hi)invalid++;if(o!=null&&hi!=null&&o>hi)invalid++;if(o!=null&&lo!=null&&o<lo)invalid++;if(c!=null&&hi!=null&&c>hi)invalid++;if(c!=null&&lo!=null&&c<lo)invalid++;if(v!=null&&v<0)invalid++;if(vr!=null&&Math.abs(vr)>7.5)invalid++;});
      var missingTitles=S.tickers.filter(function(t){return !ht.has(t);});
      var idxNames=Array.from(new Set(S.indices.map(function(r){return String(r.indice||'').trim();}).filter(Boolean))).sort();
      var missingIdx=idxNames.filter(function(t){return !ix.has(t);});
      var problems=invalid+dupH+dupI+(missingTitles.length?1:0)+(missingIdx.length?1:0)+(weekend(d)?1:0);
      return {date:d,h:h,i:i,titles:ht.size,indices:ix.size,missingTitles:missingTitles,missingIdx:missingIdx,invalid:invalid,dupH:dupH,dupI:dupI,weekend:weekend(d),problems:problems,validated:saved(d)};
    });
  }
  function render(){
    var body=document.querySelector('#'+ID+' tbody[data-global-body]'),sum=document.querySelector('#'+ID+' [data-global-status]');if(!body)return;
    var valid=S.sessions.filter(function(x){return x.validated;}).length,bad=S.sessions.filter(function(x){return x.problems;}).length;
    sum.innerHTML='<strong style="color:var(--cream)">'+S.sessions.length+'</strong> séances · <strong style="color:#9bc7a0">'+valid+' validées</strong> · <strong style="color:#e58d84">'+bad+' à contrôler</strong> · '+S.hist.length.toLocaleString('fr-FR')+' cours · '+S.indices.length.toLocaleString('fr-FR')+' indices';
    body.innerHTML=S.sessions.map(function(s){var cov=S.tickers.length?Math.round(s.titles/S.tickers.length*100):100;var st=s.validated?'✓ VALIDÉE':s.problems?'⚠ À CORRIGER':'○ À VALIDER';var color=s.validated?'#9bc7a0':s.problems?'#e58d84':'#d8bd78';return '<tr><td><strong>'+esc(fmt(s.date))+'</strong><div style="font:10px var(--mono);color:var(--muted)">'+esc(s.date)+'</div></td><td style="color:'+color+';font-weight:600">'+st+'</td><td class="r">'+s.titles+' / '+S.tickers.length+' ('+cov+'%)</td><td class="r">'+s.indices+'</td><td>'+s.h.length+' / '+s.i.length+'</td><td style="color:'+(s.problems?'#e58d84':'#9bc7a0')+'">'+s.problems+(s.weekend?' · WEEK-END':'')+'</td><td style="white-space:nowrap"><button class="btn btn-outline btn-sm" data-g-view="'+esc(s.date)+'">Détails</button> '+(s.validated?'<button class="btn btn-outline btn-sm" data-g-un="'+esc(s.date)+'">Annuler</button>':(!s.problems?'<button class="btn btn-primary btn-sm" data-g-val="'+esc(s.date)+'">✓ Valider</button>':''))+'</td></tr>';}).join('')||'<tr><td colspan="7"><div class="empty-state">Aucune séance détectée.</div></td></tr>';
    body.querySelectorAll('[data-g-view]').forEach(function(b){b.onclick=function(){detail(b.dataset.gView);};});body.querySelectorAll('[data-g-val]').forEach(function(b){b.onclick=function(){var s=S.sessions.find(function(x){return x.date===b.dataset.gVal;});if(s&&s.problems){detail(s.date);alert('Cette séance doit être corrigée avant validation.');return;}save(b.dataset.gVal);render();};});body.querySelectorAll('[data-g-un]').forEach(function(b){b.onclick=function(){unsave(b.dataset.gUn);render();};});
  }
  function detail(d){var s=S.sessions.find(function(x){return x.date===d;}),el=document.getElementById('tc-global-detail');if(!s||!el)return;el.innerHTML='<div style="padding:16px 18px;border-top:1px solid var(--border)"><div style="display:flex;justify-content:space-between"><div><div style="font:11px var(--mono);color:var(--gold)">SÉANCE · '+esc(d)+'</div><strong>'+esc(fmt(d))+'</strong></div><button class="btn btn-outline btn-sm" data-g-close>Fermer</button></div><div class="info-box" style="margin:12px 0">Cours : <strong>'+s.h.length+'</strong> lignes · '+s.titles+'/'+S.tickers.length+' titres · Indices : <strong>'+s.i.length+'</strong> lignes · '+s.indices+' indices.</div>'+(s.missingTitles.length?'<div class="info-box" style="margin:8px 0"><strong>Titres manquants :</strong> '+s.missingTitles.map(esc).join(', ')+'</div>':'')+(s.missingIdx.length?'<div class="info-box" style="margin:8px 0;border-left:3px solid #e58d84"><strong>Indices manquants :</strong> '+s.missingIdx.map(esc).join(', ')+'</div>':'')+(s.weekend?'<div class="info-box" style="margin:8px 0;border-left:3px solid #e58d84"><strong>Attention :</strong> date de week-end.</div>':'')+(s.dupH||s.dupI?'<div class="info-box" style="margin:8px 0;border-left:3px solid #e58d84"><strong>Doublons :</strong> '+s.dupH+' cours · '+s.dupI+' indices.</div>':'')+'<div style="margin-top:12px;color:var(--muted);font-size:11px">Règle : les cours et indices sont contrôlés sur <strong>la même date</strong>. Aucune donnée d’une autre séance n’est utilisée pour compléter celle-ci.</div></div>';el.scrollIntoView({behavior:'smooth',block:'nearest'});el.querySelector('[data-g-close]').onclick=function(){el.innerHTML='';};}
  function inject(){if(document.getElementById(ID))return;var panel=document.getElementById('panel-cours');if(!panel)return;var box=document.createElement('div');box.id=ID;box.className='card';box.style.marginTop='20px';box.innerHTML='<div class="card-header"><div><span class="card-title">Gestion globale des séances de bourse</span><div style="font-size:11px;color:var(--muted);margin-top:5px">Une séance unique pour les cours des titres et les indices. Les dates ne sont jamais mélangées.</div></div><button class="btn btn-outline btn-sm" data-global-refresh>↺ Contrôler</button></div><div data-global-status style="padding:14px 18px;color:var(--muted);font-size:11px">Chargement…</div><div class="tw"><table><thead><tr><th>Date de séance</th><th>Statut</th><th class="r">Titres / couverture</th><th class="r">Indices</th><th class="r">Cours / indices</th><th>Anomalies</th><th>Actions</th></tr></thead><tbody data-global-body></tbody></table></div><div id="tc-global-detail"></div>';panel.appendChild(box);box.querySelector('[data-global-refresh]').onclick=load;load();}
  function init(){if(document.getElementById('panel-cours'))inject();else setTimeout(init,400);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();