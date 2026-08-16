/* THE CAPITAL — Gestion cohérente des séances de bourse
 * Source unique : historique(date_seance).
 * Aucun changement de schéma Supabase : validation opérateur locale.
 */
(function(){
  'use strict';

  if(window.__TC_SESSION_MANAGER__) return;
  window.__TC_SESSION_MANAGER__=true;

  var ROOT_PREFIX='tc-session-manager';
  var STORE='tc_validated_sessions_v2';
  var state={rows:[],sessions:[],tickers:[],loaded:false,loading:false};

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
  function isWeekend(date){var d=new Date(date+'T00:00:00').getDay();return d===0||d===6;}
  function fmtDate(date){try{return new Date(date+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return date;}}
  function validated(date){try{return JSON.parse(localStorage.getItem(STORE)||'{}')[date]||null;}catch(e){return null;}}
  function setValidated(date){var all={};try{all=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}all[date]={at:new Date().toISOString(),by:(document.getElementById('admin-user')||{}).textContent||'admin'};localStorage.setItem(STORE,JSON.stringify(all));}
  function unsetValidated(date){var all={};try{all=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}delete all[date];localStorage.setItem(STORE,JSON.stringify(all));}

  async function get(path){
    var headers={apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json'};
    var r=await fetch(SB_REST+path,{headers:headers,cache:'no-store'});
    var text=await r.text();
    if(!r.ok)throw new Error('HTTP '+r.status+' — '+text.slice(0,300));
    try{return text?JSON.parse(text):[];}catch(e){return [];}
  }

  async function getAllHistorique(){
    var out=[],from=0,size=1000;
    while(true){
      var q='/historique?select=id,ticker,date_seance,cours_cloture,cours_ouverture,plus_haut,plus_bas,volume,variation,valeur_totale&order=date_seance.desc,id.asc&limit='+size+'&offset='+from;
      var page=await get(q);
      if(!Array.isArray(page)||!page.length)break;
      out=out.concat(page);
      if(page.length<size)break;
      from+=size;
      if(from>1000000)throw new Error('Historique trop volumineux pour le contrôle Admin.');
    }
    return out;
  }

  async function getActiveTickers(){
    var out=[],from=0,size=1000;
    while(true){
      var page=await get('/entreprises?select=ticker,actif&order=ticker.asc&limit='+size+'&offset='+from);
      if(!Array.isArray(page)||!page.length)break;
      page.forEach(function(r){if(r&&r.ticker&&r.actif!==false)out.push(String(r.ticker).trim().toUpperCase());});
      if(page.length<size)break;
      from+=size;
    }
    return Array.from(new Set(out));
  }

  function build(){
    var byDate={};
    state.rows.forEach(function(r){
      var d=String(r.date_seance||'').slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return;
      (byDate[d]||(byDate[d]=[])).push(r);
    });

    state.sessions=Object.keys(byDate).sort().reverse().map(function(date){
      var rows=byDate[date],byTicker={},invalid=[],seen={};
      rows.forEach(function(r){
        var ticker=String(r.ticker||'').trim().toUpperCase();
        if(ticker)(byTicker[ticker]||(byTicker[ticker]=[])).push(r);
        var c=num(r.cours_cloture),o=num(r.cours_ouverture),h=num(r.plus_haut),l=num(r.plus_bas),v=num(r.volume),vr=num(r.variation);
        if(!ticker)invalid.push({ticker:'?',message:'Ticker manquant'});
        if(c==null||c<0)invalid.push({ticker:ticker,message:'Clôture manquante ou négative'});
        if(h!=null&&l!=null&&l>h)invalid.push({ticker:ticker,message:'Plus bas supérieur au plus haut'});
        if(o!=null&&h!=null&&o>h)invalid.push({ticker:ticker,message:'Ouverture supérieure au plus haut'});
        if(o!=null&&l!=null&&o<l)invalid.push({ticker:ticker,message:'Ouverture inférieure au plus bas'});
        if(c!=null&&h!=null&&c>h)invalid.push({ticker:ticker,message:'Clôture supérieure au plus haut'});
        if(c!=null&&l!=null&&c<l)invalid.push({ticker:ticker,message:'Clôture inférieure au plus bas'});
        if(v!=null&&v<0)invalid.push({ticker:ticker,message:'Volume négatif'});
        if(vr!=null&&Math.abs(vr)>7.5)invalid.push({ticker:ticker,message:'Variation > ±7,5 %'});
      });
      var duplicates=Object.keys(byTicker).filter(function(t){return byTicker[t].length>1;});
      var missing=state.tickers.filter(function(t){return !byTicker[t];});
      var weekend=isWeekend(date);
      var structural=invalid.length+duplicates.length+(missing.length?1:0)+(weekend?1:0);
      return {date:date,rows:rows,byTicker:byTicker,count:rows.length,titles:Object.keys(byTicker).length,missing:missing,duplicates:duplicates,invalid:invalid,weekend:weekend,issues:structural,validated:validated(date)};
    });
  }

  function latest(){return state.sessions.length?state.sessions[0]:null;}

  function inject(panelId,mode){
    var panel=document.getElementById(panelId);
    if(!panel)return false;
    var rootId=ROOT_PREFIX+'-'+mode;
    if(document.getElementById(rootId))return true;

    var box=document.createElement('div');
    box.id=rootId;
    box.className='card';
    box.style.marginBottom='16px';
    box.innerHTML=''
      +'<div class="card-header">'
      +'<div><span class="card-title">Séances de bourse — cohérence globale</span>'
      +'<div class="tc-sm-muted" data-role="description" style="font-size:11px;color:var(--muted);margin-top:5px;">Une séance = une date commune à tous les titres. La séance la plus récente est la référence des cours courants.</div></div>'
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto;">'
      +'<select data-role="filter" style="padding:6px 8px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:3px;font-size:11px;">'
      +'<option value="">Toutes</option><option value="latest">Dernière séance</option><option value="issues">Anomalies</option><option value="validated">Validées</option><option value="unvalidated">Non validées</option>'
      +'</select><button type="button" class="btn btn-outline btn-sm" data-role="refresh">↺ Actualiser</button></div></div>'
      +'<div data-role="summary" style="padding:14px 18px;color:var(--muted);font-size:11px;">Chargement…</div>'
      +'<div class="tw"><table><thead><tr>'
      +'<th>Séance</th><th>Statut</th><th class="r">Lignes</th><th class="r">Titres</th><th>Couverture</th><th>Anomalies</th><th style="width:1%;white-space:nowrap;">Actions</th>'
      +'</tr></thead><tbody data-role="body"><tr><td colspan="7"><div class="loading"><div class="spinner"></div></div></td></tr></tbody></table></div>'
      +'<div data-role="detail"></div>';

    if(mode==='cours')panel.insertBefore(box,panel.children[1]||null);
    else panel.insertBefore(box,panel.firstElementChild||null);

    box.querySelector('[data-role="refresh"]').addEventListener('click',load);
    box.querySelector('[data-role="filter"]').addEventListener('change',function(){renderBox(box);});
    return true;
  }

  function status(s){
    if(s.validated)return '<span style="color:#9bc7a0;font-weight:600;">✓ VALIDÉE</span>';
    if(s.issues)return '<span style="color:#e58d84;font-weight:600;">⚠ À CORRIGER</span>';
    return '<span style="color:#d8bd78;font-weight:600;">○ À VALIDER</span>';
  }

  function actionButtons(s){
    var a='<button type="button" class="btn btn-outline btn-sm" data-action="detail" data-date="'+esc(s.date)+'">Voir</button>';
    if(s.validated)a+='<button type="button" class="btn btn-outline btn-sm" data-action="unvalidate" data-date="'+esc(s.date)+'">Annuler validation</button>';
    else if(!s.issues)a+='<button type="button" class="btn btn-primary btn-sm" data-action="validate" data-date="'+esc(s.date)+'">✓ Valider</button>';
    a+='<button type="button" class="btn btn-outline btn-sm" data-action="delete" data-date="'+esc(s.date)+'" style="color:#e58d84;border-color:rgba(210,100,90,.45);">Supprimer séance</button>';
    return a;
  }

  function renderBox(box){
    var body=box.querySelector('[data-role="body"]'),summary=box.querySelector('[data-role="summary"]'),filter=box.querySelector('[data-role="filter"]');
    if(!body||!summary)return;
    var f=filter?filter.value:'';
    var list=state.sessions.filter(function(s){
      if(f==='latest')return s===latest();
      if(f==='issues')return s.issues>0;
      if(f==='validated')return !!s.validated;
      if(f==='unvalidated')return !s.validated;
      return true;
    });
    var last=latest(),total=state.sessions.length,issues=state.sessions.filter(function(s){return s.issues>0;}).length,valid=state.sessions.filter(function(s){return !!s.validated;}).length;
    var lastText=last?'Dernière séance : <strong style="color:var(--cream);">'+esc(last.date)+'</strong> · '+last.titles+'/'+state.tickers.length+' titres ('+(state.tickers.length?Math.round(last.titles/state.tickers.length*100):0)+'%)':'Aucune séance';
    summary.innerHTML=lastText+' · <strong style="color:var(--cream);">'+total+'</strong> séances · <strong style="color:#e58d84;">'+issues+' avec anomalies</strong> · <strong style="color:#9bc7a0;">'+valid+' validées</strong> · '+state.rows.length.toLocaleString('fr-FR')+' lignes contrôlées.';
    if(!list.length){body.innerHTML='<tr><td colspan="7"><div class="empty-state">Aucune séance dans ce filtre.</div></td></tr>';return;}
    body.innerHTML=list.map(function(s){
      var cov=state.tickers.length?Math.round(s.titles/state.tickers.length*100):100;
      var anomaly=s.invalid.length+s.duplicates.length+(s.missing.length?1:0)+(s.weekend?1:0);
      var latestBadge=last&&s.date===last.date?' <span style="font-size:9px;color:var(--gold);font-family:var(--mono);">RÉFÉRENCE</span>':'';
      return '<tr><td><strong>'+esc(fmtDate(s.date))+'</strong>'+latestBadge+'<div style="font:10px var(--mono);color:var(--muted);">'+esc(s.date)+'</div></td><td>'+status(s)+'</td><td class="r">'+s.count.toLocaleString('fr-FR')+'</td><td class="r">'+s.titles+' / '+state.tickers.length+'</td><td>'+cov+'%</td><td><span style="color:'+(anomaly?'#e58d84':'#9bc7a0')+';">'+anomaly+'</span>'+(s.weekend?' · WEEK-END':'')+'</td><td>'+actionButtons(s)+'</td></tr>';
    }).join('');

    body.querySelectorAll('[data-action]').forEach(function(btn){
      btn.addEventListener('click',function(){handleAction(btn.dataset.action,btn.dataset.date,box);});
    });
  }

  function renderAll(){
    document.querySelectorAll('#'+ROOT_PREFIX+'-cours,#'+ROOT_PREFIX+'-archive').forEach(renderBox);
  }

  function detailHtml(s){
    var html='<div style="padding:18px;border-top:1px solid var(--border);">'
      +'<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">'
      +'<div><div style="font:11px var(--mono);color:var(--gold);">SÉANCE · '+esc(s.date)+'</div><div style="font-size:14px;font-weight:600;margin-top:4px;">'+esc(fmtDate(s.date))+'</div></div>'
      +'<button type="button" class="btn btn-outline btn-sm" data-detail-close>Fermer</button></div>';
    if(s.weekend)html+='<div class="info-box" style="margin:12px 0;border-left:3px solid #e58d84;"><strong>Anomalie critique :</strong> date de week-end.</div>';
    if(s.missing.length)html+='<div class="info-box" style="margin:12px 0;"><strong>Titres absents de cette séance :</strong> '+s.missing.map(esc).join(', ')+'</div>';
    if(s.duplicates.length)html+='<div class="info-box" style="margin:12px 0;border-left:3px solid #e58d84;"><strong>Doublons :</strong> '+s.duplicates.map(esc).join(', ')+'</div>';
    if(s.invalid.length)html+='<div style="margin:12px 0;"><div style="font-size:11px;color:#e58d84;font-weight:600;margin-bottom:7px;">ANOMALIES DE DONNÉES</div>'+s.invalid.slice(0,100).map(function(x){return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:11px;"><strong style="display:inline-block;width:65px;">'+esc(x.ticker)+'</strong><span style="color:var(--muted);">'+esc(x.message)+'</span></div>';}).join('')+'</div>';
    html+='<div class="tw" style="max-height:420px;"><table><thead><tr><th>Ticker</th><th class="r">Clôture</th><th class="r">Ouv.</th><th class="r">Haut</th><th class="r">Bas</th><th class="r">Volume</th><th class="r">Var.</th><th></th></tr></thead><tbody>';
    html+=s.rows.map(function(r){var vr=num(r.variation);return '<tr><td><strong>'+esc(r.ticker)+'</strong></td><td class="r">'+(r.cours_cloture==null?'—':esc(r.cours_cloture))+'</td><td class="r">'+(r.cours_ouverture==null?'—':esc(r.cours_ouverture))+'</td><td class="r">'+(r.plus_haut==null?'—':esc(r.plus_haut))+'</td><td class="r">'+(r.plus_bas==null?'—':esc(r.plus_bas))+'</td><td class="r">'+(r.volume==null?'—':Number(r.volume).toLocaleString('fr-FR'))+'</td><td class="r">'+(vr==null?'—':(vr>0?'+':'')+vr.toFixed(2)+'%')+'</td><td><button type="button" class="btn btn-outline btn-sm" data-edit-ticker="'+esc(r.ticker)+'" data-edit-date="'+esc(s.date)+'">Modifier</button></td></tr>';}).join('');
    html+='</tbody></table></div></div>';
    return html;
  }

  function showDetail(date,box){
    var s=state.sessions.find(function(x){return x.date===date;}),detail=box.querySelector('[data-role="detail"]');
    if(!s||!detail)return;
    detail.innerHTML=detailHtml(s);
    detail.querySelector('[data-detail-close]').addEventListener('click',function(){detail.innerHTML='';});
    detail.querySelectorAll('[data-edit-ticker]').forEach(function(btn){btn.addEventListener('click',function(){
      if(typeof openEditor==='function')openEditor(btn.dataset.editTicker,btn.dataset.editDate,'historique');
      else if(typeof editHistorique==='function'){
        var row=(s.rows||[]).find(function(r){return String(r.ticker).toUpperCase()===String(btn.dataset.editTicker).toUpperCase();});
        if(row)editHistorique(row.id);
      }else alert('Éditeur indisponible.');
    });});
    detail.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function deleteSession(date){
    var s=state.sessions.find(function(x){return x.date===date;});if(!s)return;
    var message='SUPPRESSION DE LA SÉANCE '+date+'\n\n'+s.count+' ligne(s) seront supprimées pour TOUS les titres.\nCette action est irréversible.\n\nContinuer ?';
    if(typeof doubleConfirm==='function'){
      if(!doubleConfirm(message))return;
      if(!doubleConfirm('CONFIRMATION FINALE : supprimer définitivement toute la séance '+date+' ?'))return;
    }else if(!window.confirm(message))return;
    try{
      var headers={apikey:SB_ANON,Authorization:'Bearer '+TK,Prefer:'return=minimal'};
      var r=await fetch(SB_REST+'/historique?date_seance=eq.'+encodeURIComponent(date),{method:'DELETE',headers:headers,cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status+' — '+(await r.text()).slice(0,300));
      unsetValidated(date);
      await load();
      if(typeof loadCours==='function')loadCours();
      if(typeof loadHistoriqueTicker==='function')loadHistoriqueTicker();
      if(typeof toast==='function')toast('Séance '+date+' supprimée ('+s.count+' ligne(s))','ok');
      else alert('Séance '+date+' supprimée.');
    }catch(e){
      console.error('[SESSION-MANAGER] suppression:',e);
      if(typeof toast==='function')toast('Suppression impossible : '+e.message,'err');
      else alert('Suppression impossible : '+e.message);
    }
  }

  function validateSession(date){
    var s=state.sessions.find(function(x){return x.date===date;});if(!s)return;
    if(s.issues){
      if(typeof toast==='function')toast('Séance '+date+' non validable : '+s.issues+' anomalie(s).','err');
      return;
    }
    setValidated(date);
    renderAll();
    if(typeof toast==='function')toast('Séance '+date+' validée pour contrôle Admin.','ok');
  }

  function handleAction(action,date,box){
    if(action==='detail')showDetail(date,box);
    else if(action==='delete')deleteSession(date);
    else if(action==='validate'){validateSession(date);}
    else if(action==='unvalidate'){unsetValidated(date);renderAll();}
  }

  async function load(){
    if(state.loading)return;
    state.loading=true;
    document.querySelectorAll('#'+ROOT_PREFIX+'-cours [data-role="summary"],#'+ROOT_PREFIX+'-archive [data-role="summary"]').forEach(function(el){el.innerHTML='<span style="color:var(--gold);">Contrôle en cours… récupération exhaustive de l’historique.</span>';});
    try{
      var result=await Promise.all([getAllHistorique(),getActiveTickers()]);
      state.rows=result[0];state.tickers=result[1];build();state.loaded=true;renderAll();
    }catch(e){
      console.error('[SESSION-MANAGER]',e);
      document.querySelectorAll('#'+ROOT_PREFIX+'-cours [data-role="summary"],#'+ROOT_PREFIX+'-archive [data-role="summary"]').forEach(function(el){el.innerHTML='<span style="color:#e58d84;">Erreur : '+esc(e.message)+'</span>';});
    }finally{state.loading=false;}
  }

  function init(){
    inject('panel-cours','cours');
    inject('panel-archive','archive');
    setTimeout(load,150);
  }

  window.SeancesControl={init:init,refresh:load};
  window.SessionManager=window.SeancesControl;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
