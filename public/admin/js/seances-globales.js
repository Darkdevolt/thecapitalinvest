/* THE CAPITAL — Gestion globale des séances de bourse
 * Centre de contrôle non destructif : lecture des données existantes,
 * détection des écarts, calendrier mensuel et validation opérateur.
 * Aucun schéma Supabase n'est modifié.
 */
(function(){
  'use strict';
  var ID='tc-seances-globales', STORE='tc_global_sessions_v3';
  var EXPECTED_INDICES=['BRVM-COMPOSITE','BRVM-30','BRVM-PRESTIGE'];
  var DEFAULT_LIMIT=10, MAX_LIMIT=500;
  var S={hist:[],indices:[],tickers:[],sessions:[],limit:DEFAULT_LIMIT,loadedRows:0,month:null};

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
  function day(v){return String(v||'').slice(0,10);}
  function indexKey(v){var r=String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(r==='BRVMC'||r.indexOf('COMPOSITE')>=0)return 'BRVM-COMPOSITE';if(r.indexOf('30')>=0)return 'BRVM-30';if(r.indexOf('PRESTIGE')>=0)return 'BRVM-PRESTIGE';return r;}
  function isWeekend(d){var n=new Date(d+'T00:00:00').getDay();return n===0||n===6;}
  function isWeekday(d){return !isWeekend(d);}
  function fmt(d){try{return new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return d;}}
  function monthKey(d){return String(d).slice(0,7);}
  function monthLabel(k){var p=k.split('-');return new Date(Number(p[0]),Number(p[1])-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});}
  function auth(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json'};}
  function localOverrides(){try{return JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){return {};}}
  function override(d){return localOverrides()[d]||null;}
  function saveOverride(d,reason){var x=localOverrides();x[d]={at:new Date().toISOString(),reason:String(reason||'Validation manuelle')};localStorage.setItem(STORE,JSON.stringify(x));}
  function removeOverride(d){var x=localOverrides();delete x[d];localStorage.setItem(STORE,JSON.stringify(x));}

  async function getPage(path,limit,offset){var sep=path.indexOf('?')>=0?'&':'?';var r=await fetch(SB_REST+path+sep+'limit='+limit+'&offset='+offset,{headers:auth()});var t=await r.text();if(!r.ok)throw Error('HTTP '+r.status+' — '+t.slice(0,220));var p=t?JSON.parse(t):[];return Array.isArray(p)?p:[];}
  async function getTickers(){var r=await fetch(SB_REST+'/entreprises?select=ticker,actif&order=ticker.asc',{headers:auth()});var t=await r.text();if(!r.ok)throw Error('entreprises — HTTP '+r.status+' — '+t.slice(0,220));var p=t?JSON.parse(t):[];return Array.from(new Set((Array.isArray(p)?p:[]).filter(function(x){return x.actif!==false;}).map(function(x){return String(x.ticker||'').trim();}).filter(Boolean)));}

  async function load(){
    var box=document.getElementById(ID);if(!box)return;
    var status=box.querySelector('[data-global-status]'),input=box.querySelector('[data-global-limit]');
    S.limit=Math.max(1,Math.min(MAX_LIMIT,Number(input&&input.value)||DEFAULT_LIMIT));
    if(input)input.value=S.limit;
    status.innerHTML='⏳ Contrôle progressif des dernières séances…';
    try{
      var rowLimit=Math.max(500,Math.min(5000,S.limit*100));
      S.hist=await getPage('/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation&order=date_seance.desc,id.desc',rowLimit,0);
      S.indices=await getPage('/indices?select=id,indice,date_seance,valeur,variation,variation_pct&order=date_seance.desc,id.desc',rowLimit,0);
      S.tickers=await getTickers(); S.loadedRows=Math.max(S.hist.length,S.indices.length);
      build();
      if(!S.month){var dates=S.sessions.filter(function(x){return x.real;}).map(function(x){return x.date;});S.month=dates.length?monthKey(dates[0]):monthKey(new Date().toISOString());}
      render();
    }catch(e){console.error('[seances-globales]',e);status.innerHTML='<span style="color:#e58d84">Erreur : '+esc(e.message)+'</span>';}
  }

  function build(){
    var dates={};
    S.hist.forEach(function(r){var d=day(r.date_seance);if(d)(dates[d]||(dates[d]={})).hist=true;});
    S.indices.forEach(function(r){var d=day(r.date_seance);if(d)(dates[d]||(dates[d]={})).idx=true;});
    var real=Object.keys(dates).map(function(d){return makeSession(d,true);});
    /* Weekdays without data are explicit missing sessions, but only within the
       loaded range. This avoids pretending that old/unloaded dates were checked. */
    if(real.length){var min=real.reduce(function(a,x){return a<x.date?a:x.date,real[0].date);};var max=real.reduce(function(a,x){return a>x.date?a:x.date,real[0].date);};var cur=new Date(min+'T00:00:00'),end=new Date(max+'T00:00:00');while(cur<=end){var d=cur.toISOString().slice(0,10);if(isWeekday(d)&&!dates[d])real.push(makeSession(d,false));cur.setDate(cur.getDate()+1);}}
    S.sessions=real.sort(function(a,b){return b.date.localeCompare(a.date);});
  }

  function makeSession(d,real){
    var h=real?S.hist.filter(function(r){return day(r.date_seance)===d;}):[], i=real?S.indices.filter(function(r){return day(r.date_seance)===d;}):[];
    var ht=new Set(h.map(function(r){return String(r.ticker||'').trim();}).filter(Boolean));
    var ix=new Set(i.map(function(r){return indexKey(r.indice);}).filter(Boolean));
    var dupH=h.length-ht.size,dupI=i.length-ix.size,invalid=0;
    h.forEach(function(r){var c=num(r.cours_cloture),o=num(r.cours_ouverture),hi=num(r.plus_haut),lo=num(r.plus_bas),v=num(r.volume),vr=num(r.variation);if(c==null||c<0)invalid++;if(hi!=null&&lo!=null&&lo>hi)invalid++;if(o!=null&&hi!=null&&o>hi)invalid++;if(o!=null&&lo!=null&&o<lo)invalid++;if(c!=null&&hi!=null&&c>hi)invalid++;if(c!=null&&lo!=null&&c<lo)invalid++;if(v!=null&&v<0)invalid++;if(vr!=null&&Math.abs(vr)>7.5)invalid++;});
    var missingTitles=S.tickers.filter(function(t){return !ht.has(t);}),missingIdx=EXPECTED_INDICES.filter(function(t){return !ix.has(t);});
    var hard=invalid+dupH+dupI+(real&&isWeekend(d)?1:0), gaps=(real?missingTitles.length+missingIdx.length:1);
    var ov=override(d);
    return {date:d,real:real,h:h,i:i,titles:ht.size,indices:ix.size,missingTitles:missingTitles,missingIdx:missingIdx,invalid:invalid,dupH:dupH,dupI:dupI,weekend:isWeekend(d),hard:hard,gaps:gaps,problems:hard+gaps,validated:!!ov,override:ov};
  }

  function status(s){if(s.validated)return 'VALIDÉE';if(!s.real)return 'SÉANCE ATTENDUE — DONNÉES ABSENTES';if(s.hard)return 'INCOHÉRENCE À CORRIGER';if(s.gaps)return 'DONNÉES INCOMPLÈTES — VALIDATION MANUELLE';return 'CONFORME — À VALIDER';}
  function statusColor(s){return s.validated?'#9bc7a0':s.hard?'#e58d84':s.gaps?'#d8bd78':'#9bc7a0';}

  function render(){
    var root=document.getElementById(ID);if(!root)return;
    var month=S.month||monthKey(new Date().toISOString()), sessions=S.sessions.filter(function(x){return monthKey(x.date)===month;}), real=S.sessions.filter(function(x){return x.real;}), bad=real.filter(function(x){return !x.validated&&(x.hard||x.gaps);}), validated=real.filter(function(x){return x.validated;}).length;
    var statusBox=root.querySelector('[data-global-status]');
    statusBox.innerHTML='<strong style="color:var(--cream)">'+sessions.length+'</strong> jours affichés · <strong style="color:#e58d84">'+bad.length+' alertes</strong> · <strong style="color:#9bc7a0">'+validated+' validées</strong> · '+S.loadedRows.toLocaleString('fr-FR')+' lignes/table chargées à la demande.';
    root.querySelector('[data-month-label]').textContent=monthLabel(month);
    renderCalendar(root,month);
    renderTable(root);
  }

  function renderCalendar(root,month){
    var grid=root.querySelector('[data-calendar]'),first=new Date(month+'-01T00:00:00'),last=new Date(first.getFullYear(),first.getMonth()+1,0),start=(first.getDay()+6)%7,days=last.getDate(),html='';
    for(var i=0;i<start;i++)html+='<div class="tc-cal-cell empty"></div>';
    for(var n=1;n<=days;n++){
      var d=month+'-'+String(n).padStart(2,'0'),s=S.sessions.find(function(x){return x.date===d;}),wk=isWeekend(d);
      var cls='tc-cal-cell '+(wk?'weekend ':'')+(s?(s.validated?'valid ':s.hard?'hard ':s.gaps?'gap ':'ok '):'none ');
      var label=s?status(s):(wk?'Week-end':'Non contrôlé');
      html+='<button type="button" class="'+cls+'" data-cal-day="'+d+'"><span class="tc-cal-day">'+n+'</span><span class="tc-cal-status">'+esc(label)+'</span>'+(s?'<span class="tc-cal-meta">'+s.titles+'/'+S.tickers.length+' titres · '+s.indices+'/'+EXPECTED_INDICES.length+' idx</span>':'')+'</button>';
    }
    grid.innerHTML=html;
    grid.querySelectorAll('[data-cal-day]').forEach(function(b){b.onclick=function(){detail(b.dataset.calDay);};});
  }

  function renderTable(root){
    var body=root.querySelector('tbody[data-global-body]'),rows=S.sessions.filter(function(x){return x.real;}).slice(0,S.limit);
    body.innerHTML=rows.map(function(s){return '<tr><td><strong>'+esc(fmt(s.date))+'</strong><div style="font:10px var(--mono);color:var(--muted)">'+s.date+'</div></td><td style="color:'+statusColor(s)+';font-weight:600">'+esc(status(s))+'</td><td class="r">'+s.titles+' / '+S.tickers.length+'</td><td class="r">'+s.indices+' / '+EXPECTED_INDICES.length+'</td><td style="color:'+(s.hard?'#e58d84':s.gaps?'#d8bd78':'#9bc7a0')+'">'+(s.hard+s.gaps)+'</td><td><div class="tc-session-actions"><button class="btn btn-outline btn-sm" data-g-view="'+s.date+'">Détails</button>'+(s.validated?'<button class="btn btn-outline btn-sm" data-g-un="'+s.date+'">Annuler</button>':(s.hard?'': '<button class="btn btn-primary btn-sm" data-g-val="'+s.date+'">✓ Valider</button>'))+'<button class="btn btn-outline btn-sm" data-g-del="'+s.date+'">🗑 Supprimer</button></div></td></tr>';}).join('')||'<tr><td colspan="6" class="empty-state">Aucune séance réelle dans le bloc chargé.</td></tr>';
    body.querySelectorAll('[data-g-view]').forEach(function(b){b.onclick=function(){detail(b.dataset.gView);};});
    body.querySelectorAll('[data-g-val]').forEach(function(b){b.onclick=function(){manualValidate(b.dataset.gVal);};});
    body.querySelectorAll('[data-g-un]').forEach(function(b){b.onclick=function(){removeOverride(b.dataset.gUn);render();};});
    body.querySelectorAll('[data-g-del]').forEach(function(b){b.onclick=function(){removeSession(b.dataset.gDel,b);};});
  }

  function manualValidate(d){
    var s=S.sessions.find(function(x){return x.date===d;});if(!s)return;
    if(s.hard){detail(d);alert('Validation bloquée : une incohérence structurelle doit être corrigée.');return;}
    var reason=window.prompt('Validation manuelle de la séance '+d+'.\n\n'+(s.gaps?'Des données sont manquantes. Indiquez pourquoi cette séance doit malgré tout être considérée conforme :':'Motif de validation opérateur (facultatif) :'),'Données de marché indisponibles / séance vérifiée manuellement');
    if(reason===null)return;
    saveOverride(d,reason.trim()||'Validation manuelle');render();detail(d);
  }

  function detail(d){
    var s=S.sessions.find(function(x){return x.date===d;}),el=document.getElementById('tc-global-detail');if(!s||!el)return;
    var sourceNames=['historique','cours','cours_brvm','cours_latest','derniers_cours','historique_cours'];
    el.innerHTML='<div class="tc-detail"><div class="tc-detail-head"><div><div class="tc-kicker">SÉANCE · '+esc(d)+'</div><strong>'+esc(fmt(d))+'</strong></div><button class="btn btn-outline btn-sm" data-close>Fermer</button></div><div class="tc-detail-grid"><div><b>'+s.titles+'/'+S.tickers.length+'</b><small>Titres présents</small></div><div><b>'+s.indices+'/'+EXPECTED_INDICES.length+'</b><small>Indices présents</small></div><div><b>'+s.h.length+'</b><small>Lignes cours</small></div><div><b>'+s.i.length+'</b><small>Lignes indices</small></div></div>'+(!s.real?'<div class="tc-alert gap"><b>Séance attendue mais aucune donnée n’est chargée pour cette date.</b><p>Elle est affichée uniquement parce qu’il s’agit d’un jour ouvré compris dans la période contrôlée.</p></div>':'')+(s.missingTitles.length?'<div class="tc-alert gap"><b>Titres manquants ('+s.missingTitles.length+')</b><p>'+s.missingTitles.map(esc).join(', ')+'</p></div>':'')+(s.missingIdx.length?'<div class="tc-alert gap"><b>Indices manquants ('+s.missingIdx.length+')</b><p>'+s.missingIdx.map(esc).join(', ')+'</p></div>':'')+(s.invalid?'<div class="tc-alert hard"><b>'+s.invalid+' ligne(s) de cours incohérente(s)</b><p>Ces incohérences doivent être corrigées avant validation.</p></div>':'')+(s.dupH||s.dupI?'<div class="tc-alert hard"><b>Doublons détectés</b><p>'+s.dupH+' cours · '+s.dupI+' indices.</p></div>':'')+(s.weekend?'<div class="tc-alert hard"><b>Date de week-end</b></div>':'')+(s.validated?'<div class="tc-alert valid"><b>✓ Validation manuelle enregistrée</b><p>Motif : '+esc(s.override.reason)+'<br>Enregistrée le '+esc(s.override.at)+'</p></div>':'')+'<div class="tc-detail-actions">'+(s.validated?'<button class="btn btn-outline btn-sm" data-detail-un>Annuler validation</button>':(!s.hard?'<button class="btn btn-primary btn-sm" data-detail-val>Valider cette séance</button>':''))+'<button class="btn btn-outline btn-sm" data-detail-refresh>Actualiser les données</button></div><div class="tc-source-audit"><b>Contrôle des sources de cours</b><small>Les tables ci-dessous sont comparées en lecture seule pour cette date. Aucune écriture n’est effectuée par cet audit.</small><div data-source-audit>Chargement…</div></div></div>';
    el.scrollIntoView({behavior:'smooth',block:'nearest'});
    el.querySelector('[data-close]').onclick=function(){el.innerHTML='';};
    var v=el.querySelector('[data-detail-val]');if(v)v.onclick=function(){manualValidate(d);};
    var u=el.querySelector('[data-detail-un]');if(u)u.onclick=function(){removeOverride(d);render();detail(d);};
    el.querySelector('[data-detail-refresh]').onclick=function(){load();};
    auditSources(d,sourceNames,el.querySelector('[data-source-audit]'));
  }

  async function auditSources(d,names,box){
    try{var out=await Promise.all(names.map(async function(t){try{var rows=await getPage('/'+t+'?select=id,date_seance,ticker&date_seance=eq.'+encodeURIComponent(d),5000,0);return {t:t,count:rows.length};}catch(e){return {t:t,error:e.message};}}));box.innerHTML=out.map(function(x){return '<div class="tc-source-row"><b>'+esc(x.t)+'</b><span>'+(x.error?'Erreur: '+esc(x.error):x.count+' ligne(s)')+'</span></div>';}).join('');}catch(e){box.textContent='Audit impossible : '+e.message;}
  }

  async function removeSession(d,b){
    if(!confirm('Supprimer TOUS les cours et indices de la séance '+d+' ?'))return;if(!confirm('Confirmation finale : cette action est destructive. Continuer ?'))return;
    b.disabled=true;b.textContent='Suppression…';
    try{var h=await deleteDate('historique',d),i=await deleteDate('indices',d);removeOverride(d);if(typeof toast==='function')toast('Séance supprimée : '+h.length+' cours, '+i.length+' indices.','ok');await load();}catch(e){b.disabled=false;b.textContent='🗑 Supprimer';if(typeof toast==='function')toast('Suppression impossible : '+e.message,'err');else alert(e.message);}
  }
  async function deleteDate(table,d){var r=await fetch(SB_REST+'/'+table+'?date_seance=eq.'+encodeURIComponent(d),{method:'DELETE',headers:Object.assign(auth(),{'Prefer':'return=representation'})});var t=await r.text();if(!r.ok)throw Error(table+' — HTTP '+r.status+' — '+t.slice(0,220));try{return t?JSON.parse(t):[];}catch(e){return [];}}

  function injectStyles(){if(document.getElementById('tc-session-calendar-style'))return;var s=document.createElement('style');s.id='tc-session-calendar-style';s.textContent='.tc-cal-wrap{padding:16px 18px}.tc-cal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.tc-cal-title{text-transform:capitalize;font-family:var(--mono);font-size:13px;color:var(--cream)}.tc-cal-week{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px}.tc-cal-week div{font:9px var(--mono);color:var(--muted);text-align:center;text-transform:uppercase}.tc-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.tc-cal-cell{min-height:82px;border:1px solid var(--border);background:var(--surface);padding:8px;text-align:left;cursor:pointer;border-radius:5px;color:var(--cream)}.tc-cal-cell:hover{border-color:var(--gold)}.tc-cal-cell.empty{visibility:hidden}.tc-cal-cell.weekend{opacity:.45;cursor:default}.tc-cal-cell.hard{border-color:rgba(220,90,90,.65);background:rgba(220,90,90,.06)}.tc-cal-cell.gap{border-color:rgba(216,189,120,.65);background:rgba(216,189,120,.05)}.tc-cal-cell.valid{border-color:rgba(155,199,160,.55);background:rgba(155,199,160,.05)}.tc-cal-cell.none{border-style:dashed}.tc-cal-day{display:block;font:14px var(--mono);margin-bottom:8px}.tc-cal-status{display:block;font-size:9px;line-height:1.3}.tc-cal-meta{display:block;color:var(--muted);font-size:9px;margin-top:6px}.tc-detail{border-top:1px solid var(--border);padding:18px}.tc-detail-head{display:flex;justify-content:space-between;gap:12px}.tc-kicker{font:10px var(--mono);color:var(--gold);margin-bottom:4px}.tc-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.tc-detail-grid>div{border:1px solid var(--border);padding:10px;border-radius:5px;background:var(--surface)}.tc-detail-grid b{display:block;font:16px var(--mono)}.tc-detail-grid small{color:var(--muted)}.tc-alert{padding:10px 12px;margin:8px 0;border-radius:5px;font-size:11px}.tc-alert p{margin:5px 0 0;color:var(--muted);line-height:1.5}.tc-alert.hard{border-left:3px solid #e58d84;background:rgba(220,90,90,.05)}.tc-alert.gap{border-left:3px solid #d8bd78;background:rgba(216,189,120,.05)}.tc-alert.valid{border-left:3px solid #9bc7a0;background:rgba(155,199,160,.05)}.tc-detail-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.tc-source-audit{border-top:1px solid var(--border);padding-top:14px;font-size:11px}.tc-source-audit small{display:block;color:var(--muted);margin:5px 0 10px}.tc-source-row{display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding:7px 0;font:10px var(--mono)}@media(max-width:800px){.tc-cal-cell{min-height:68px;padding:5px}.tc-cal-status{font-size:8px}.tc-detail-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.tc-cal-grid,.tc-cal-week{gap:2px}.tc-cal-cell{min-height:58px}.tc-cal-meta{display:none}}';document.head.appendChild(s);}

  function inject(){if(document.getElementById(ID))return true;var panel=document.getElementById('panel-cours');if(!panel)return false;injectStyles();var box=document.createElement('div');box.id=ID;box.className='card';box.style.cssText='margin:24px 0;border-top:2px solid var(--gold)';box.innerHTML='<div class="card-header"><div><span class="card-title">Gestion des séances de bourse</span><div style="font-size:11px;color:var(--muted);margin-top:5px">Calendrier de contrôle des séances BRVM. Une donnée manquante déclenche une alerte ; une incohérence structurelle reste bloquante.</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select data-global-limit class="input" style="width:90px;height:32px"><option>10</option><option>25</option><option>50</option><option>100</option><option>250</option></select><button class="btn btn-outline btn-sm" data-global-refresh>↺ Actualiser</button></div></div><div data-global-status style="padding:14px 18px;color:var(--muted);font-size:11px">Chargement manuel.</div><div class="tc-cal-wrap"><div class="tc-cal-head"><button class="btn btn-outline btn-sm" data-prev>‹</button><span class="tc-cal-title" data-month-label>—</span><div style="display:flex;gap:6px"><button class="btn btn-outline btn-sm" data-today>Aujourd’hui</button><button class="btn btn-outline btn-sm" data-next>›</button></div></div><div class="tc-cal-week"><div>Lun</div><div>Mar</div><div>Mer</div><div>Jeu</div><div>Ven</div><div>Sam</div><div>Dim</div></div><div class="tc-cal-grid" data-calendar></div></div><div class="tw"><table><thead><tr><th>Date</th><th>Statut</th><th class="r">Titres</th><th class="r">Indices</th><th>Anomalies</th><th>Actions</th></tr></thead><tbody data-global-body></tbody></table></div><div id="tc-global-detail"></div>';
    panel.appendChild(box);
    box.querySelector('[data-global-refresh]').onclick=load;box.querySelector('[data-global-limit]').onchange=load;
    box.querySelector('[data-prev]').onclick=function(){shiftMonth(-1);};box.querySelector('[data-next]').onclick=function(){shiftMonth(1);};box.querySelector('[data-today]').onclick=function(){S.month=monthKey(new Date().toISOString());render();};
    return true;
  }
  function shiftMonth(delta){var p=S.month.split('-'),d=new Date(Number(p[0]),Number(p[1])-1+delta,1);S.month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');render();}
  function init(){if(inject())return;setTimeout(init,300);}
  window.SeancesGlobales={refresh:load,inject:inject,open:function(d){detail(d);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();