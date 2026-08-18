/* THE CAPITAL — Calendrier des séances de bourse
 * Couche de visualisation/gestion uniquement : ne modifie aucun schéma Supabase.
 * Source : historique + indices. Validation opérateur partagée avec seances-globales.js.
 */
(function(){
  'use strict';
  var ID='tc-seances-calendrier';
  var STORE='tc_global_sessions_v2';
  var EXPECTED=['BRVM-COMPOSITE','BRVM-30','BRVM-PRESTIGE'];
  var state={month:new Date().getMonth(),year:new Date().getFullYear(),sessions:{},loading:false};

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function dateKey(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
  function weekend(key){var d=new Date(key+'T00:00:00').getDay();return d===0||d===6;}
  function fmtMonth(){return new Date(state.year,state.month,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).replace(/^./,function(c){return c.toUpperCase();});}
  function auth(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json'};}
  function validated(d){try{return JSON.parse(localStorage.getItem(STORE)||'{}')[d]||null;}catch(e){return null;}}
  function saveValidation(d){var x={};try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}x[d]={at:new Date().toISOString(),by:(document.getElementById('admin-user')||{}).textContent||'admin'};localStorage.setItem(STORE,JSON.stringify(x));}
  function unvalidate(d){var x={};try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}delete x[d];localStorage.setItem(STORE,JSON.stringify(x));}

  async function page(table,select){
    var url=SB_REST+'/'+table+'?select='+select+'&order=date_seance.desc&limit=5000';
    var r=await fetch(url,{headers:auth(),cache:'no-store'});var t=await r.text();
    if(!r.ok)throw Error(table+' — HTTP '+r.status+' — '+t.slice(0,220));
    var p=t?JSON.parse(t):[];return Array.isArray(p)?p:[];
  }

  async function load(){
    if(state.loading)return;
    var root=document.getElementById(ID);if(!root)return;
    state.loading=true; root.querySelector('[data-cal-status]').textContent='Chargement des séances…';
    try{
      var h=await page('historique','id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation');
      var i=await page('indices','id,indice,date_seance,valeur,variation,variation_pct');
      var map={};
      h.forEach(function(r){var d=String(r.date_seance||'').slice(0,10);if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(d))return;(map[d]||(map[d]={date:d,h:[],i:[]})).h.push(r);});
      i.forEach(function(r){var d=String(r.date_seance||'').slice(0,10);if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(d))return;(map[d]||(map[d]={date:d,h:[],i:[]})).i.push(r);});
      Object.keys(map).forEach(function(d){var s=map[d],tickers={};s.h.forEach(function(r){var t=String(r.ticker||'').trim().toUpperCase();if(t)tickers[t]=(tickers[t]||0)+1;});var idx={};s.i.forEach(function(r){var raw=String(r.indice||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(raw==='BRVMC'||raw.indexOf('COMPOSITE')>=0)idx['BRVM-COMPOSITE']=1;else if(raw.indexOf('30')>=0)idx['BRVM-30']=1;else if(raw.indexOf('PRESTIGE')>=0)idx['BRVM-PRESTIGE']=1;});var dup=Object.keys(tickers).filter(function(t){return tickers[t]>1;}).length;var invalid=0;s.h.forEach(function(r){var c=Number(r.cours_cloture),o=Number(r.cours_ouverture),hi=Number(r.plus_haut),lo=Number(r.plus_bas),v=Number(r.volume),vr=Number(r.variation);if(!Number.isFinite(c)||c<0)invalid++;if(Number.isFinite(hi)&&Number.isFinite(lo)&&lo>hi)invalid++;if(Number.isFinite(o)&&Number.isFinite(hi)&&o>hi)invalid++;if(Number.isFinite(o)&&Number.isFinite(lo)&&o<lo)invalid++;if(Number.isFinite(c)&&Number.isFinite(hi)&&c>hi)invalid++;if(Number.isFinite(c)&&Number.isFinite(lo)&&c<lo)invalid++;if(Number.isFinite(v)&&v<0)invalid++;if(Number.isFinite(vr)&&Math.abs(vr)>7.5)invalid++;});s.titles=Object.keys(tickers).length;s.indices=Object.keys(idx).length;s.duplicates=dup;s.invalid=invalid;s.missingIndices=EXPECTED.filter(function(x){return !idx[x];}).length;s.issues=invalid+dup+s.missingIndices+(weekend(d)?1:0);s.validated=validated(d);});
      state.sessions=map;render();
      root.querySelector('[data-cal-status]').textContent='Calendrier synchronisé · '+Object.keys(map).length.toLocaleString('fr-FR')+' séances détectées dans le bloc chargé.';
    }catch(e){console.error('[seances-calendrier]',e);root.querySelector('[data-cal-status]').innerHTML='<span style="color:#e58d84">Erreur : '+esc(e.message)+'</span>';}
    finally{state.loading=false;}
  }

  function cellClass(s){if(!s)return 'empty';if(s.validated)return 'validated';if(s.issues)return 'issue';return 'ready';}
  function render(){
    var root=document.getElementById(ID);if(!root)return;var first=new Date(state.year,state.month,1).getDay();first=(first+6)%7;var days=new Date(state.year,state.month+1,0).getDate();var html='';
    for(var i=0;i<first;i++)html+='<div class="tc-cal-day tc-cal-outside"></div>';
    for(var d=1;d<=days;d++){
      var key=dateKey(state.year,state.month,d),s=state.sessions[key],we=weekend(key),cl=s?cellClass(s):(we?'weekend':'empty');
      html+='<button type="button" class="tc-cal-day '+cl+'" data-cal-date="'+key+'">'+
        '<span class="tc-cal-num">'+d+'</span>'+
        (s?'<span class="tc-cal-count">'+s.titles+' titres</span><span class="tc-cal-meta">'+s.h.length+' cours · '+s.indices+'/'+EXPECTED.length+' idx</span>'+(s.issues?'<span class="tc-cal-alert">'+s.issues+' anomalie'+(s.issues>1?'s':'')+'</span>':'<span class="tc-cal-ok">✓ cohérente</span>'):'<span class="tc-cal-meta">'+(we?'Week-end':'Aucune séance')+'</span>')+
      '</button>';
    }
    root.querySelector('[data-cal-grid]').innerHTML=html;
    root.querySelectorAll('[data-cal-date]').forEach(function(b){b.onclick=function(){detail(b.dataset.calDate);};});
    root.querySelector('[data-cal-month]').textContent=fmtMonth();
    var keys=Object.keys(state.sessions).filter(function(k){return k.slice(0,7)===state.year+'-'+String(state.month+1).padStart(2,'0');});
    var issues=keys.filter(function(k){return state.sessions[k].issues;}).length,valid=keys.filter(function(k){return state.sessions[k].validated;}).length;
    root.querySelector('[data-cal-month-summary]').innerHTML='<strong>'+keys.length+'</strong> séances · <span class="tc-cal-red">'+issues+' anomalie'+(issues>1?'s':'')+'</span> · <span class="tc-cal-green">'+valid+' validées</span>';
  }

  function detail(d){
    var root=document.getElementById(ID),s=state.sessions[d],el=root&&root.querySelector('[data-cal-detail]');if(!root||!el)return;
    var dt=new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    if(!s){el.innerHTML='<div class="tc-cal-detail"><div class="tc-cal-detail-title">'+esc(dt)+'</div><div class="tc-cal-empty-detail">Aucune donnée de séance pour cette date.</div></div>';return;}
    var status=s.validated?'✓ VALIDÉE':s.issues?'⚠ À CORRIGER':'○ PRÊTE À VALIDER';
    el.innerHTML='<div class="tc-cal-detail"><div class="tc-cal-detail-head"><div><div class="tc-cal-kicker">SÉANCE BRVM</div><div class="tc-cal-detail-title">'+esc(dt)+'</div></div><span class="tc-cal-status '+cellClass(s)+'">'+status+'</span></div>'+
      '<div class="tc-cal-detail-stats"><div><strong>'+s.h.length+'</strong><span>Cours</span></div><div><strong>'+s.titles+'</strong><span>Titres</span></div><div><strong>'+s.indices+'/'+EXPECTED.length+'</strong><span>Indices</span></div><div><strong>'+s.issues+'</strong><span>Anomalies</span></div></div>'+
      (s.issues?'<div class="tc-cal-warning">'+(s.invalid?s.invalid+' incohérence'+(s.invalid>1?'s':'')+' de cours · ':'')+(s.duplicates?s.duplicates+' doublon'+(s.duplicates>1?'s':'')+' · ':'')+(s.missingIndices?s.missingIndices+' indice'+(s.missingIndices>1?'s':'')+' manquant'+(s.missingIndices>1?'s':''):'')+(weekend(d)?' · date de week-end':'')+'</div>':'<div class="tc-cal-success">La séance ne présente pas d’anomalie détectée.</div>')+
      '<div class="tc-cal-actions">'+(s.validated?'<button type="button" class="btn btn-outline btn-sm" data-cal-unvalidate>Annuler validation</button>':(!s.issues?'<button type="button" class="btn btn-primary btn-sm" data-cal-validate>✓ Valider la séance</button>':'<span class="tc-cal-hint">Corrigez les anomalies avant validation.</span>'))+'<button type="button" class="btn btn-outline btn-sm" data-cal-close>Fermer</button></div></div>';
    el.querySelector('[data-cal-close]').onclick=function(){el.innerHTML='';};
    var v=el.querySelector('[data-cal-validate]');if(v)v.onclick=function(){saveValidation(d);s.validated=validated(d);render();detail(d);};
    var u=el.querySelector('[data-cal-unvalidate]');if(u)u.onclick=function(){unvalidate(d);s.validated=null;render();detail(d);};
    el.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function inject(){
    if(document.getElementById(ID))return true;var panel=document.getElementById('panel-cours');if(!panel)return false;
    var box=document.createElement('section');box.id=ID;box.className='card tc-cal-card';
    box.innerHTML='<div class="card-header tc-cal-header"><div><div class="card-title">Calendrier des séances de bourse</div><div class="tc-cal-subtitle">Vue quotidienne pour piloter les séances BRVM, repérer les anomalies et valider les dates.</div></div><div class="tc-cal-nav"><button type="button" class="btn btn-outline btn-sm" data-cal-prev>‹</button><strong data-cal-month>—</strong><button type="button" class="btn btn-outline btn-sm" data-cal-next>›</button><button type="button" class="btn btn-outline btn-sm" data-cal-today>Aujourd’hui</button><button type="button" class="btn btn-outline btn-sm" data-cal-refresh>↺</button></div></div><div class="tc-cal-toolbar"><div data-cal-month-summary>—</div><div class="tc-cal-legend"><span><i class="ready"></i>Séance cohérente</span><span><i class="issue"></i>Anomalie</span><span><i class="validated"></i>Validée</span><span><i class="empty"></i>Sans séance</span></div></div><div class="tc-cal-week"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div><div class="tc-cal-grid" data-cal-grid></div><div data-cal-detail></div><div class="tc-cal-footer" data-cal-status>Initialisation…</div>';
    panel.insertBefore(box,panel.firstElementChild||null);
    var style=document.createElement('style');style.id='tc-cal-style';style.textContent='.tc-cal-card{margin:0 0 20px;border-top:2px solid var(--gold)}.tc-cal-header{align-items:center}.tc-cal-subtitle{font-size:11px;color:var(--muted);margin-top:5px}.tc-cal-nav{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.tc-cal-nav strong{min-width:150px;text-align:center;font-size:13px}.tc-cal-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);flex-wrap:wrap}.tc-cal-toolbar strong{color:var(--cream)}.tc-cal-legend{display:flex;gap:12px;flex-wrap:wrap}.tc-cal-legend span{display:flex;align-items:center;gap:5px}.tc-cal-legend i{width:9px;height:9px;border-radius:2px;border:1px solid var(--border);display:inline-block}.tc-cal-legend i.ready{background:rgba(216,189,120,.25);border-color:rgba(216,189,120,.55)}.tc-cal-legend i.issue{background:rgba(229,141,132,.22);border-color:rgba(229,141,132,.55)}.tc-cal-legend i.validated{background:rgba(155,199,160,.24);border-color:rgba(155,199,160,.55)}.tc-cal-legend i.empty{background:rgba(255,255,255,.025)}.tc-cal-week,.tc-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;background:var(--border)}.tc-cal-week{background:transparent;padding:10px 1px 5px}.tc-cal-week span{text-align:center;font:10px var(--mono);color:var(--muted);text-transform:uppercase}.tc-cal-day{min-height:92px;border:0;border-radius:0;background:var(--surface);color:var(--cream);padding:9px;text-align:left;display:flex;flex-direction:column;gap:4px;cursor:pointer;transition:background .15s,transform .1s}.tc-cal-day:hover{background:rgba(255,255,255,.055)}.tc-cal-day.tc-cal-outside{background:var(--bg);cursor:default}.tc-cal-day.ready{box-shadow:inset 3px 0 0 rgba(216,189,120,.8)}.tc-cal-day.issue{box-shadow:inset 3px 0 0 #e58d84;background:rgba(229,141,132,.045)}.tc-cal-day.validated{box-shadow:inset 3px 0 0 #9bc7a0;background:rgba(155,199,160,.045)}.tc-cal-day.weekend{opacity:.42;cursor:default}.tc-cal-num{font-size:14px;font-weight:700}.tc-cal-count{font-size:10px;color:var(--cream)}.tc-cal-meta{font:9px var(--mono);color:var(--muted);line-height:1.35}.tc-cal-alert{font-size:9px;color:#e58d84;font-weight:600}.tc-cal-ok{font-size:9px;color:#9bc7a0}.tc-cal-red{color:#e58d84}.tc-cal-green{color:#9bc7a0}.tc-cal-detail{border-top:1px solid var(--border);padding:16px 18px}.tc-cal-detail-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.tc-cal-kicker{font:10px var(--mono);color:var(--gold)}.tc-cal-detail-title{font-size:14px;font-weight:650;margin-top:4px}.tc-cal-status{font-size:10px;font-weight:700}.tc-cal-status.ready{color:#d8bd78}.tc-cal-status.issue{color:#e58d84}.tc-cal-status.validated{color:#9bc7a0}.tc-cal-detail-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0}.tc-cal-detail-stats div{padding:10px 12px;background:var(--bg);border:1px solid var(--border);display:flex;flex-direction:column;gap:3px}.tc-cal-detail-stats strong{font-size:16px}.tc-cal-detail-stats span{font-size:9px;color:var(--muted);text-transform:uppercase}.tc-cal-warning,.tc-cal-success{padding:10px 12px;font-size:11px}.tc-cal-warning{border-left:3px solid #e58d84;background:rgba(229,141,132,.06);color:#e58d84}.tc-cal-success{border-left:3px solid #9bc7a0;background:rgba(155,199,160,.05);color:#9bc7a0}.tc-cal-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.tc-cal-hint{font-size:10px;color:var(--muted);padding:7px 0}.tc-cal-empty-detail{padding:15px 0;color:var(--muted);font-size:11px}.tc-cal-footer{padding:10px 18px;font-size:10px;color:var(--muted);border-top:1px solid var(--border)}@media(max-width:800px){.tc-cal-day{min-height:78px;padding:7px}.tc-cal-detail-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.tc-cal-week span{font-size:8px}.tc-cal-day{min-height:70px;padding:5px}.tc-cal-count{display:none}.tc-cal-nav strong{min-width:120px}.tc-cal-day .tc-cal-meta{font-size:8px}}';document.head.appendChild(style);
    box.querySelector('[data-cal-prev]').onclick=function(){state.month--;if(state.month<0){state.month=11;state.year--;}render();};
    box.querySelector('[data-cal-next]').onclick=function(){state.month++;if(state.month>11){state.month=0;state.year++;}render();};
    box.querySelector('[data-cal-today]').onclick=function(){var d=new Date();state.month=d.getMonth();state.year=d.getFullYear();render();};
    box.querySelector('[data-cal-refresh]').onclick=load;
    return true;
  }
  function boot(){if(inject())load();else setTimeout(boot,150);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
