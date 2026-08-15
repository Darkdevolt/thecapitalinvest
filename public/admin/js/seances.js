/* THE CAPITAL — Contrôle des séances de bourse
 * Vue séance par séance : intégrité, week-end, doublons, couverture des titres,
 * cohérence OHLC/variation et validation opérateur.
 * La validation opérateur est conservée localement tant qu'aucune table dédiée
 * de validation n'est autorisée en base.
 */
(function(){
  'use strict';
  var ROOT_ID='tc-seances-control';
  var STORE='tc_validated_sessions_v1';
  var state={rows:[],sessions:[],tickers:[],filter:'',loaded:false};

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function n(v){var x=Number(v);return Number.isFinite(x)?x:null;}
  function pct(v){var x=n(v);return x==null?'—':(x>0?'+':'')+x.toFixed(2)+'%';}
  function day(date){return new Date(date+'T00:00:00').getDay();}
  function weekend(date){var d=day(date);return d===0||d===6;}
  function fmtDate(s){try{return new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return s;}}
  function key(date){return 'tc-session-'+date;}
  function validated(date){try{return JSON.parse(localStorage.getItem(STORE)||'{}')[date]||null;}catch(e){return null;}}
  function setValidated(date,user){var x={};try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}x[date]={validated_at:new Date().toISOString(),validated_by:user||'admin'};localStorage.setItem(STORE,JSON.stringify(x));}
  function unvalidate(date){var x={};try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}delete x[date];localStorage.setItem(STORE,JSON.stringify(x));}

  async function get(path){
    var h={apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json'};
    var r=await fetch(SB_REST+path,{headers:h});
    var text=await r.text();
    if(!r.ok) throw Error('HTTP '+r.status+' — '+text.slice(0,250));
    try{return text?JSON.parse(text):[];}catch(e){return []}
  }
  async function allRows(){
    var out=[],from=0,size=1000;
    while(true){
      var q='/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation,valeur_totale&order=date_seance.asc,id.asc&limit='+size+'&offset='+from;
      var page=await get(q); if(!Array.isArray(page)||!page.length) break;
      out=out.concat(page); if(page.length<size) break; from+=size;
      if(from>1000000) break;
    }
    return out;
  }
  async function allTickers(){
    var out=[],from=0,size=1000;
    while(true){
      var page=await get('/entreprises?select=ticker,actif&order=ticker.asc&limit='+size+'&offset='+from);
      if(!Array.isArray(page)||!page.length) break;
      out=out.concat(page.filter(function(x){return x&&x.ticker;}));
      if(page.length<size) break; from+=size;
    }
    return Array.from(new Set(out.map(function(x){return String(x.ticker).trim();}).filter(Boolean)));
  }

  function buildSessions(){
    var map={};
    state.rows.forEach(function(r){var d=String(r.date_seance||'').slice(0,10);if(!d)return;(map[d]||(map[d]=[])).push(r);});
    state.sessions=Object.keys(map).sort().reverse().map(function(date){
      var rows=map[date], by={}; rows.forEach(function(r){var t=String(r.ticker||'').trim();if(t) (by[t]||(by[t]=[])).push(r);});
      var duplicates=Object.keys(by).filter(function(t){return by[t].length>1;});
      var invalid=[];
      rows.forEach(function(r){
        var c=n(r.cours_cloture),o=n(r.cours_ouverture),h=n(r.plus_haut),l=n(r.plus_bas),v=n(r.volume),vr=n(r.variation);
        if(c==null||c<0) invalid.push({type:'COURS',ticker:r.ticker,message:'Clôture manquante ou négative'});
        if(h!=null&&l!=null&&l>h) invalid.push({type:'OHLC',ticker:r.ticker,message:'Plus bas supérieur au plus haut'});
        if(o!=null&&h!=null&&o>h) invalid.push({type:'OHLC',ticker:r.ticker,message:'Ouverture supérieure au plus haut'});
        if(o!=null&&l!=null&&o<l) invalid.push({type:'OHLC',ticker:r.ticker,message:'Ouverture inférieure au plus bas'});
        if(c!=null&&h!=null&&c>h) invalid.push({type:'OHLC',ticker:r.ticker,message:'Clôture supérieure au plus haut'});
        if(c!=null&&l!=null&&c<l) invalid.push({type:'OHLC',ticker:r.ticker,message:'Clôture inférieure au plus bas'});
        if(v!=null&&v<0) invalid.push({type:'VOLUME',ticker:r.ticker,message:'Volume négatif'});
        if(vr!=null&&Math.abs(vr)>7.5) invalid.push({type:'VARIATION',ticker:r.ticker,message:'Variation > ±7,5 %, contrôle manuel requis'});
      });
      var covered=state.tickers.filter(function(t){return !!by[t];});
      var missing=state.tickers.filter(function(t){return !by[t];});
      var weekendFlag=weekend(date);
      var issues=invalid.length+duplicates.length+(missing.length?1:0)+(weekendFlag?1:0);
      return {date:date,rows:rows,by:by,count:rows.length,titles:Object.keys(by).length,missing:missing,duplicates:duplicates,invalid:invalid,weekend:weekendFlag,issues:issues,validated:validated(date)};
    });
  }

  function inject(){
    if(document.getElementById(ROOT_ID)) return;
    var panel=document.getElementById('panel-cours'); if(!panel)return;
    var box=document.createElement('div');box.id=ROOT_ID;box.className='card';box.style.marginBottom='16px';
    box.innerHTML='<div class="card-header"><div><span class="card-title">Validation des séances de bourse</span><div style="font-size:11px;color:var(--muted);margin-top:5px;">Contrôle séance par séance avant publication : couverture des titres, dates, doublons, OHLC, volumes et variations.</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto;"><select id="tc-session-filter" style="padding:6px 8px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:3px;font-size:11px;"><option value="">Toutes les séances</option><option value="issues">Avec anomalies</option><option value="validated">Validées</option><option value="unvalidated">Non validées</option></select><button class="btn btn-outline btn-sm" id="tc-session-refresh">↺ Contrôler</button></div></div><div id="tc-session-summary" style="padding:14px 18px;color:var(--muted);font-size:11px;">Chargement du contrôle des séances…</div><div class="tw"><table><thead><tr><th>Date de séance</th><th>Statut</th><th class="r">Cours</th><th class="r">Titres</th><th>Couverture</th><th>Anomalies</th><th style="width:1%;white-space:nowrap;">Actions</th></tr></thead><tbody id="tc-session-body"><tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr></tbody></table></div><div id="tc-session-detail"></div>';
    panel.insertBefore(box,panel.children[1]||null);
    document.getElementById('tc-session-refresh').onclick=load;
    document.getElementById('tc-session-filter').onchange=render;
  }

  function status(s){
    if(s.validated) return '<span style="color:#9bc7a0;font-weight:600;">✓ VALIDÉE</span>';
    if(s.issues) return '<span style="color:#e58d84;font-weight:600;">⚠ À CORRIGER</span>';
    return '<span style="color:#d8bd78;font-weight:600;">○ À VALIDER</span>';
  }
  function render(){
    var body=document.getElementById('tc-session-body'),summary=document.getElementById('tc-session-summary'),filter=document.getElementById('tc-session-filter');if(!body)return;
    var f=filter?filter.value:'';var list=state.sessions.filter(function(s){return !f||(f==='issues'&&s.issues)||(f==='validated'&&s.validated)||(f==='unvalidated'&&!s.validated);});
    var total=state.sessions.length,issues=state.sessions.filter(function(s){return s.issues;}).length,valid=state.sessions.filter(function(s){return s.validated;}).length,week=state.sessions.filter(function(s){return s.weekend;}).length;
    summary.innerHTML='<strong style="color:var(--cream);">'+total+'</strong> séances · <strong style="color:#9bc7a0;">'+valid+' validées</strong> · <strong style="color:#e58d84;">'+issues+' avec anomalies</strong> · <strong style="color:#e58d84;">'+week+' week-end</strong> · <strong style="color:var(--cream);">'+state.rows.length.toLocaleString('fr-FR')+'</strong> lignes contrôlées';
    if(!list.length){body.innerHTML='<tr><td colspan="7"><div class="empty-state">Aucune séance dans ce filtre.</div></td></tr>';return;}
    body.innerHTML=list.map(function(s){
      var cov=state.tickers.length?Math.round((s.titles/state.tickers.length)*100):100;
      var anomaly=s.invalid.length+s.duplicates.length+(s.missing.length?1:0)+(s.weekend?1:0);
      var actions='<button class="btn btn-outline btn-sm tc-session-view" data-date="'+esc(s.date)+'">Voir les cours</button>';
      if(s.validated) actions+='<button class="btn btn-outline btn-sm tc-session-unvalidate" data-date="'+esc(s.date)+'">Annuler validation</button>';
      else if(!s.issues) actions+='<button class="btn btn-primary btn-sm tc-session-validate" data-date="'+esc(s.date)+'">✓ Valider</button>';
      if(s.issues) actions+='<button class="btn btn-outline btn-sm tc-session-detail-btn" data-date="'+esc(s.date)+'">Détails</button>';
      if(s.weekend) actions+='<button class="btn btn-outline btn-sm tc-session-delete" data-date="'+esc(s.date)+'" style="color:#e58d84;border-color:rgba(210,100,90,.45);">Supprimer séance</button>';
      return '<tr><td><strong>'+esc(fmtDate(s.date))+'</strong><div style="font:10px var(--mono);color:var(--muted);">'+esc(s.date)+'</div></td><td>'+status(s)+'</td><td class="r">'+s.count.toLocaleString('fr-FR')+'</td><td class="r">'+s.titles+' / '+state.tickers.length+'</td><td>'+cov+'%</td><td><span style="color:'+(anomaly?'#e58d84':'#9bc7a0')+';">'+anomaly+'</span>'+(s.weekend?' · WEEK-END':'')+'</td><td>'+actions+'</td></tr>';
    }).join('');
    body.querySelectorAll('.tc-session-view,.tc-session-detail-btn').forEach(function(b){b.onclick=function(){showDetail(b.dataset.date);};});
    body.querySelectorAll('.tc-session-validate').forEach(function(b){b.onclick=function(){validateSession(b.dataset.date);};});
    body.querySelectorAll('.tc-session-unvalidate').forEach(function(b){b.onclick=function(){unvalidate(b.dataset.date);render();};});
    body.querySelectorAll('.tc-session-delete').forEach(function(b){b.onclick=function(){deleteSession(b.dataset.date);};});
  }

  function showDetail(date){
    var s=state.sessions.find(function(x){return x.date===date;}),el=document.getElementById('tc-session-detail');if(!s||!el)return;
    var html='<div style="padding:18px;border-top:1px solid var(--border);"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;"><div><div style="font:11px var(--mono);color:var(--gold);">SÉANCE · '+esc(s.date)+'</div><div style="font-size:14px;font-weight:600;margin-top:4px;">'+esc(fmtDate(s.date))+'</div></div><button class="btn btn-outline btn-sm" id="tc-session-close-detail">Fermer</button></div>';
    if(s.weekend) html+='<div class="info-box" style="margin:12px 0;border-left:3px solid #e58d84;"><strong>Anomalie critique :</strong> cette séance tombe un samedi/dimanche. Elle ne doit pas exister comme séance BRVM normale.</div>';
    if(s.missing.length) html+='<div class="info-box" style="margin:12px 0;"><strong>Titres absents :</strong> '+s.missing.map(esc).join(', ')+'</div>';
    if(s.duplicates.length) html+='<div class="info-box" style="margin:12px 0;border-left:3px solid #e58d84;"><strong>Doublons :</strong> '+s.duplicates.map(esc).join(', ')+'</div>';
    if(s.invalid.length) html+='<div style="margin:12px 0;"><div style="font-size:11px;color:#e58d84;font-weight:600;margin-bottom:7px;">ANOMALIES DE DONNÉES</div>'+s.invalid.slice(0,80).map(function(x){var row=s.by[x.ticker]&&s.by[x.ticker][0];return '<div style="display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:11px;"><strong style="width:60px;">'+esc(x.ticker)+'</strong><span style="flex:1;color:var(--muted);">'+esc(x.message)+'</span><button class="btn btn-outline btn-sm tc-session-edit" data-ticker="'+esc(x.ticker)+'" data-date="'+esc(date)+'">Modifier</button></div>';}).join('')+'</div>';
    html+='<div class="tw" style="max-height:420px;"><table><thead><tr><th>Ticker</th><th class="r">Clôture</th><th class="r">Ouverture</th><th class="r">Haut</th><th class="r">Bas</th><th class="r">Volume</th><th class="r">Var.</th><th></th></tr></thead><tbody>'+s.rows.map(function(r){return '<tr><td><strong>'+esc(r.ticker)+'</strong></td><td class="r">'+(r.cours_cloture==null?'—':r.cours_cloture)+'</td><td class="r">'+(r.cours_ouverture==null?'—':r.cours_ouverture)+'</td><td class="r">'+(r.plus_haut==null?'—':r.plus_haut)+'</td><td class="r">'+(r.plus_bas==null?'—':r.plus_bas)+'</td><td class="r">'+(r.volume==null?'—':Number(r.volume).toLocaleString('fr-FR'))+'</td><td class="r">'+pct(r.variation)+'</td><td><button class="btn btn-outline btn-sm tc-session-edit" data-ticker="'+esc(r.ticker)+'" data-date="'+esc(date)+'">Modifier</button></td></tr>';}).join('')+'</tbody></table></div></div>';
    el.innerHTML=html;el.scrollIntoView({behavior:'smooth',block:'start'});
    el.querySelector('#tc-session-close-detail').onclick=function(){el.innerHTML='';};
    el.querySelectorAll('.tc-session-edit').forEach(function(b){b.onclick=function(){if(typeof openEditor==='function')openEditor(b.dataset.ticker,b.dataset.date,'historique');else alert('Éditeur indisponible.');};});
  }

  function validateSession(date){
    var s=state.sessions.find(function(x){return x.date===date;});if(!s)return;
    if(s.issues){alert('Cette séance ne peut pas être validée : '+s.issues+' anomalie(s) détectée(s). Corrigez-les d’abord.');showDetail(date);return;}
    var user=(document.getElementById('admin-user')||{}).textContent||'admin';setValidated(date,user.trim());buildSessions();render();
  }

  async function deleteSession(date){
    var s=state.sessions.find(function(x){return x.date===date;});if(!s)return;
    if(!confirm('SUPPRIMER TOUTE LA SÉANCE '+date+' ?\n\n'+s.count+' ligne(s) seront supprimées définitivement. Cette action est recommandée uniquement si la date est une anomalie (ex. samedi/dimanche).'))return;
    try{
      var h={apikey:SB_ANON,Authorization:'Bearer '+TK,Prefer:'return=minimal'};
      var r=await fetch(SB_REST+'/historique?date_seance=eq.'+encodeURIComponent(date),{method:'DELETE',headers:h});
      if(!r.ok)throw Error('HTTP '+r.status+' — '+(await r.text()).slice(0,250));
      unvalidate(date);await load();alert('Séance '+date+' supprimée : '+s.count+' ligne(s).');
    }catch(e){alert('Suppression impossible : '+e.message);}
  }

  async function load(){
    inject();var sum=document.getElementById('tc-session-summary');if(sum)sum.innerHTML='<span style="color:var(--gold);">Contrôle en cours… récupération exhaustive de l’historique.</span>';
    try{state.rows=await allRows();state.tickers=await allTickers();buildSessions();state.loaded=true;render();}
    catch(e){if(sum)sum.innerHTML='<span style="color:#e58d84;">Erreur de contrôle : '+esc(e.message)+'</span>';console.error('[SEANCES]',e);}
  }

  function init(){inject();setTimeout(load,150);}
  window.SeancesControl={init:init,refresh:load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
