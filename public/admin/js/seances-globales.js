/* THE CAPITAL — Gestion globale des séances de bourse
 * Une séance = cours des titres + indices de la même date.
 * Chargement progressif : aucune récupération exhaustive à l'ouverture.
 * Par défaut, affiche les 10 séances récentes nécessitant une correction.
 * L'administrateur peut augmenter la limite et recharger à la demande.
 * Aucun schéma Supabase n'est modifié.
 */
(function(){
  'use strict';
  var ID='tc-seances-globales';
  var STORE='tc_global_sessions_v2';
  var EXPECTED_INDICES=['BRVM-COMPOSITE','BRVM-30','BRVM-PRESTIGE'];
  var DEFAULT_LIMIT=10;
  var MAX_LIMIT=500;
  var S={hist:[],indices:[],tickers:[],sessions:[],limit:DEFAULT_LIMIT,loadedRows:0};

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
  function date(v){return String(v||'').slice(0,10);}
  function indexKey(v){var raw=String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(raw==='BRVMC'||raw.indexOf('COMPOSITE')>=0)return 'BRVM-COMPOSITE';if(raw.indexOf('30')>=0)return 'BRVM-30';if(raw.indexOf('PRESTIGE')>=0)return 'BRVM-PRESTIGE';return raw;}
  function weekend(d){var x=new Date(d+'T00:00:00').getDay();return x===0||x===6;}
  function fmt(d){try{return new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return d;}}
  function auth(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json'};}

  async function getPage(path,limit,offset){
    var sep=path.indexOf('?')>=0?'&':'?';
    var r=await fetch(SB_REST+path+sep+'limit='+limit+'&offset='+offset,{headers:auth()});
    var t=await r.text();
    if(!r.ok)throw Error('HTTP '+r.status+' — '+t.slice(0,220));
    var p=t?JSON.parse(t):[];
    return Array.isArray(p)?p:[];
  }

  async function getTickers(){
    var r=await fetch(SB_REST+'/entreprises?select=ticker,actif&order=ticker.asc',{headers:auth()});
    var t=await r.text();
    if(!r.ok)throw Error('entreprises — HTTP '+r.status+' — '+t.slice(0,220));
    var p=t?JSON.parse(t):[];
    return Array.from(new Set((Array.isArray(p)?p:[]).map(function(x){return String(x.ticker||'').trim();}).filter(Boolean)));
  }

  async function load(){
    var box=document.getElementById(ID);if(!box)return;
    var status=box.querySelector('[data-global-status]');
    var limitInput=box.querySelector('[data-global-limit]');
    var requested=Number(limitInput&&limitInput.value)||DEFAULT_LIMIT;
    S.limit=Math.max(1,Math.min(MAX_LIMIT,requested));
    if(limitInput)limitInput.value=S.limit;
    if(status)status.innerHTML='⏳ Recherche progressive des séances à contrôler…';
    try{
      /*
       * On ne charge volontairement qu'un bloc récent de données.
       * Le volume est borné et dépend du nombre demandé, au lieu de
       * parcourir tout l'historique à chaque ouverture de l'onglet.
       * Un bloc de 1000 lignes par table suffit généralement à couvrir
       * plusieurs séances ; le bouton "Afficher plus" permet d'augmenter
       * la profondeur à la demande.
       */
      var rowLimit=Math.max(500,Math.min(5000,S.limit*100));
      S.hist=await getPage('/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation&order=date_seance.desc,id.desc',rowLimit,0);
      S.indices=await getPage('/indices?select=id,indice,date_seance,valeur,variation,variation_pct&order=date_seance.desc,id.desc',rowLimit,0);
      S.tickers=await getTickers();
      S.loadedRows=Math.max(S.hist.length,S.indices.length);
      build();
      render();
    }catch(e){
      console.error('[seances-globales]',e);
      if(status)status.innerHTML='<span style="color:#e58d84">Erreur de chargement : '+esc(e.message)+'</span>';
    }
  }

  function build(){
    var dates={};
    S.hist.forEach(function(r){var d=date(r.date_seance);if(d)(dates[d]||(dates[d]={})).hist=true;});
    S.indices.forEach(function(r){var d=date(r.date_seance);if(d)(dates[d]||(dates[d]={})).idx=true;});
    S.sessions=Object.keys(dates).sort().reverse().map(function(d){
      var h=S.hist.filter(function(r){return date(r.date_seance)===d;});
      var i=S.indices.filter(function(r){return date(r.date_seance)===d;});
      var ht=new Set(h.map(function(r){return String(r.ticker||'').trim();}).filter(Boolean));
      var ix=new Set(i.map(function(r){return indexKey(r.indice);}).filter(Boolean));
      var dupH=h.length-ht.size,dupI=i.length-ix.size,invalid=0;
      h.forEach(function(r){var c=num(r.cours_cloture),o=num(r.cours_ouverture),hi=num(r.plus_haut),lo=num(r.plus_bas),v=num(r.volume),vr=num(r.variation);if(c==null||c<0)invalid++;if(hi!=null&&lo!=null&&lo>hi)invalid++;if(o!=null&&hi!=null&&o>hi)invalid++;if(o!=null&&lo!=null&&o<lo)invalid++;if(c!=null&&hi!=null&&c>hi)invalid++;if(c!=null&&lo!=null&&c<lo)invalid++;if(v!=null&&v<0)invalid++;if(vr!=null&&Math.abs(vr)>7.5)invalid++;});
      var missingTitles=S.tickers.filter(function(t){return !ht.has(t);});
      var missingIdx=EXPECTED_INDICES.filter(function(t){return !ix.has(t);});
      var problems=invalid+dupH+dupI+missingTitles.length+missingIdx.length+(weekend(d)?1:0);
      return {date:d,h:h,i:i,titles:ht.size,indices:ix.size,missingTitles:missingTitles,missingIdx:missingIdx,invalid:invalid,dupH:dupH,dupI:dupI,weekend:weekend(d),problems:problems,validated:saved(d)};
    });
  }

  function render(){
    var root=document.getElementById(ID),body=root&&root.querySelector('tbody[data-global-body]'),sum=root&&root.querySelector('[data-global-status]');if(!body)return;
    var bad=S.sessions.filter(function(x){return x.problems&&!x.validated;});
    var good=S.sessions.filter(function(x){return !x.problems&&!x.validated;});
    var valid=S.sessions.filter(function(x){return x.validated;}).length;
    var displayed=bad.slice(0,S.limit);
    if(displayed.length<S.limit)displayed=displayed.concat(good.slice(0,S.limit-displayed.length));
    var hidden=S.sessions.length-displayed.length;
    sum.innerHTML='<strong style="color:var(--cream)">'+displayed.length+'</strong> séances affichées · <strong style="color:#e58d84">'+bad.length+' à corriger</strong> · <strong style="color:#9bc7a0">'+valid+' validées</strong> · données chargées : '+S.loadedRows.toLocaleString('fr-FR')+' lignes/table';
    body.innerHTML=displayed.map(function(s){
      var cov=S.tickers.length?Math.round(s.titles/S.tickers.length*100):100;
      var st=s.validated?'✓ VALIDÉE':s.problems?'⚠ À CORRIGER':'○ À VALIDER';
      var color=s.validated?'#9bc7a0':s.problems?'#e58d84':'#d8bd78';
      return '<tr><td><strong>'+esc(fmt(s.date))+'</strong><div style="font:10px var(--mono);color:var(--muted)">'+esc(s.date)+'</div></td><td style="color:'+color+';font-weight:600">'+st+'</td><td class="r">'+s.titles+' / '+S.tickers.length+' ('+cov+'%)</td><td class="r">'+s.indices+' / '+EXPECTED_INDICES.length+'</td><td>'+s.h.length+' / '+s.i.length+'</td><td style="color:'+(s.problems?'#e58d84':'#9bc7a0')+'">'+s.problems+(s.weekend?' · WEEK-END':'')+'</td><td><div class="tc-session-actions"><button class="btn btn-outline btn-sm" data-g-view="'+esc(s.date)+'">Détails</button> '+(s.validated?'<button class="btn btn-outline btn-sm" data-g-un="'+esc(s.date)+'">Annuler</button>':(!s.problems?'<button class="btn btn-primary btn-sm" data-g-val="'+esc(s.date)+'">✓ Valider</button>':''))+'<button type="button" class="btn btn-outline btn-sm tc-delete-session" data-g-del="'+esc(s.date)+'">🗑 Supprimer</button></div></td></tr>';
    }).join('')||'<tr><td colspan="7"><div class="empty-state">Aucune séance à afficher dans le bloc actuellement chargé.</div></td></tr>';
    body.querySelectorAll('[data-g-view]').forEach(function(b){b.onclick=function(){detail(b.dataset.gView);};});
    body.querySelectorAll('[data-g-val]').forEach(function(b){b.onclick=function(){var s=S.sessions.find(function(x){return x.date===b.dataset.gVal;});if(s&&s.problems){detail(s.date);alert('Cette séance doit être corrigée avant validation.');return;}save(b.dataset.gVal);render();};});
    body.querySelectorAll('[data-g-un]').forEach(function(b){b.onclick=function(){unsave(b.dataset.gUn);render();};});
    body.querySelectorAll('[data-g-del]').forEach(function(b){b.onclick=function(){removeSession(b.dataset.gDel,b);};});
    var more=root.querySelector('[data-global-more]');
    if(more)more.style.display=hidden>0?'inline-flex':'none';
  }

  function saved(d){try{return JSON.parse(localStorage.getItem(STORE)||'{}')[d]||null;}catch(e){return null;}}
  function save(d){var x={};try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}x[d]={at:new Date().toISOString()};localStorage.setItem(STORE,JSON.stringify(x));}
  function unsave(d){var x={};try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}delete x[d];localStorage.setItem(STORE,JSON.stringify(x));}

  function detail(d){var s=S.sessions.find(function(x){return x.date===d;}),el=document.getElementById('tc-global-detail');if(!s||!el)return;el.innerHTML='<div style="padding:16px 18px;border-top:1px solid var(--border)"><div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font:11px var(--mono);color:var(--gold)">SÉANCE · '+esc(d)+'</div><strong>'+esc(fmt(d))+'</strong></div><button class="btn btn-outline btn-sm" data-g-close>Fermer</button></div><div class="info-box" style="margin:12px 0">Cours : <strong>'+s.h.length+'</strong> lignes · '+s.titles+'/'+S.tickers.length+' titres · Indices : <strong>'+s.i.length+'</strong> lignes · '+s.indices+'/'+EXPECTED_INDICES.length+' indices.</div>'+(s.missingTitles.length?'<div class="info-box" style="margin:8px 0;border-left:3px solid #e58d84"><strong>Titres manquants ('+s.missingTitles.length+') :</strong> '+s.missingTitles.map(esc).join(', ')+'</div>':'')+(s.missingIdx.length?'<div class="info-box" style="margin:8px 0;border-left:3px solid #e58d84"><strong>Indices manquants ('+s.missingIdx.length+') :</strong> '+s.missingIdx.map(esc).join(', ')+'</div>':'')+(s.invalid?'<div class="info-box" style="margin:8px 0;border-left:3px solid #e58d84"><strong>Lignes de cours incohérentes :</strong> '+s.invalid+'</div>':'')+(s.dupH||s.dupI?'<div class="info-box" style="margin:8px 0;border-left:3px solid #e58d84"><strong>Doublons :</strong> '+s.dupH+' cours · '+s.dupI+' indices.</div>':'')+(s.weekend?'<div class="info-box" style="margin:8px 0;border-left:3px solid #e58d84"><strong>Attention :</strong> date de week-end.</div>':'')+'<div style="margin-top:12px;color:var(--muted);font-size:11px">Règle : cours et indices doivent appartenir à <strong>la même date de séance</strong>. Aucune donnée d’une autre date n’est utilisée.</div></div>';el.scrollIntoView({behavior:'smooth',block:'nearest'});el.querySelector('[data-g-close]').onclick=function(){el.innerHTML='';};}

  async function removeSession(d,b){
    if(!d||b.dataset.busy==='1')return;
    if(!window.confirm('Supprimer la séance du '+d+' ?\n\nCela supprimera TOUS les cours historiques ET TOUS les indices de cette date.'))return;
    if(!window.confirm('CONFIRMATION FINALE\n\nSupprimer définitivement la séance '+d+' ?'))return;
    b.dataset.busy='1';b.disabled=true;b.textContent='Suppression…';
    try{
      var h=await deleteDate('historique',d),i=await deleteDate('indices',d);
      unsave(d);
      if(typeof toast==='function')toast('Séance '+d+' supprimée : '+h.length+' cours et '+i.length+' indices.','ok');
      else alert('Séance '+d+' supprimée.\n'+h.length+' cours et '+i.length+' indices.');
      await load();
    }catch(e){b.dataset.busy='0';b.disabled=false;b.textContent='🗑 Supprimer';console.error(e);if(typeof toast==='function')toast('Suppression impossible : '+e.message,'err');else alert('Suppression impossible : '+e.message);}
  }

  async function deleteDate(table,d){var r=await fetch(SB_REST+'/'+table+'?date_seance=eq.'+encodeURIComponent(d),{method:'DELETE',headers:Object.assign(auth(),{'Prefer':'return=representation'})});var t=await r.text();if(!r.ok)throw Error(table+' — HTTP '+r.status+' — '+t.slice(0,220));try{return t?JSON.parse(t):[];}catch(e){return [];}}

  function inject(){
    if(document.getElementById(ID))return true;
    var panel=document.getElementById('panel-cours');if(!panel)return false;
    var box=document.createElement('div');box.id=ID;box.className='card';box.style.cssText='margin-top:24px;margin-bottom:24px;border-top:2px solid var(--gold);';
    box.innerHTML='<div class="card-header"><div><span class="card-title">Gestion des séances de bourse</span><div style="font-size:11px;color:var(--muted);margin-top:5px">Contrôle progressif : aucune récupération exhaustive à l’ouverture. Les séances problématiques récentes sont affichées en priorité.</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label style="font-size:11px;color:var(--muted)">Afficher</label><select data-global-limit class="input" style="width:90px;height:32px"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="250">250</option></select><span style="font-size:11px;color:var(--muted)">séances</span><button class="btn btn-outline btn-sm" data-global-refresh>↺ Charger</button><button class="btn btn-outline btn-sm" data-global-more style="display:none">＋ Charger davantage</button></div></div><div data-global-status style="padding:14px 18px;color:var(--muted);font-size:11px">Prêt — cliquez sur « Charger » pour lancer le contrôle.</div><div class="tw"><table><thead><tr><th>Date de séance</th><th>Statut</th><th class="r">Titres / couverture</th><th class="r">Indices</th><th>Cours / indices</th><th>Anomalies</th><th>Actions</th></tr></thead><tbody data-global-body><tr><td colspan="7" style="padding:20px;color:var(--muted)">Aucune donnée chargée.</td></tr></tbody></table></div><div id="tc-global-detail"></div>';
    panel.appendChild(box);
    box.querySelector('[data-global-refresh]').onclick=load;
    box.querySelector('[data-global-limit]').onchange=load;
    box.querySelector('[data-global-more]').onclick=function(){var input=box.querySelector('[data-global-limit]');var n=Math.min(MAX_LIMIT,(Number(input.value)||DEFAULT_LIMIT)*2);input.value=n;load();};
    return true;
  }

  function init(){if(inject())return;setTimeout(init,300);}
  window.SeancesGlobales={refresh:load,inject:inject};
  function boot(){init();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();