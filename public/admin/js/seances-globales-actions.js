/* THE CAPITAL — Actions des séances globales
 * Ajoute les actions de séance et persiste les validations manuelles.
 * Utilise admin_audit_log existant : aucun changement de schéma Supabase.
 */
(function(){
  'use strict';
  var STYLE_ID='tc-global-session-actions-style';
  var BTN_CLASS='tc-global-delete-session';
  var STORE='tc_global_sessions_v4';
  var HYDRATE_KEY='tc_session_override_hydrated_v1';

  function auth(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json','Content-Type':'application/json'};}
  function json(v){try{return JSON.parse(v);}catch(e){return null;}}
  function overrides(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){return {};}}
  function writeLocal(a){try{localStorage.setItem(STORE,JSON.stringify(a));}catch(e){console.warn('[session-persistence] localStorage',e);}}

  async function persistOverride(date,reason){
    var payload={session_date:date,reason:reason||'Validation manuelle',validated_at:new Date().toISOString(),source:'admin-session-calendar'};
    var url=SB_REST+'/admin_audit_log';
    var r=await fetch(url,{method:'POST',headers:Object.assign(auth(),{'Prefer':'return=minimal'}),body:JSON.stringify({action:'SESSION_VALIDATION_OVERRIDE',table_name:'seance_bourse',record_id:String(date),new_data:payload})});
    var text=await r.text();
    if(!r.ok)throw Error('Persistance validation — HTTP '+r.status+' — '+text.slice(0,220));
  }

  async function removeOverride(date){
    var payload={session_date:date,removed_at:new Date().toISOString(),source:'admin-session-calendar'};
    var url=SB_REST+'/admin_audit_log';
    var r=await fetch(url,{method:'POST',headers:Object.assign(auth(),{'Prefer':'return=minimal'}),body:JSON.stringify({action:'SESSION_VALIDATION_OVERRIDE_REMOVED',table_name:'seance_bourse',record_id:String(date),new_data:payload})});
    var text=await r.text();
    if(!r.ok)throw Error('Suppression validation — HTTP '+r.status+' — '+text.slice(0,220));
  }

  async function loadServerOverrides(){
    var url=SB_REST+'/admin_audit_log?select=record_id,new_data,created_at&table_name=eq.seance_bourse&action=eq.SESSION_VALIDATION_OVERRIDE&order=created_at.desc&limit=5000';
    var removed=SB_REST+'/admin_audit_log?select=record_id,created_at&table_name=eq.seance_bourse&action=eq.SESSION_VALIDATION_OVERRIDE_REMOVED&order=created_at.desc&limit=5000';
    var [vr,rr]=await Promise.all([fetch(url,{headers:auth()}),fetch(removed,{headers:auth()})]);
    var vt=await vr.text(),rt=await rr.text();
    if(!vr.ok)throw Error('Lecture validations — HTTP '+vr.status+' — '+vt.slice(0,220));
    if(!rr.ok)throw Error('Lecture annulations — HTTP '+rr.status+' — '+rt.slice(0,220));
    var vals=json(vt)||[], rems=json(rt)||[], removedAt={};
    rems.forEach(function(x){if(x.record_id&&!removedAt[x.record_id])removedAt[x.record_id]=x.created_at;});
    var out={};
    vals.forEach(function(x){
      if(!x.record_id||out[x.record_id])return;
      var rm=removedAt[x.record_id];
      if(rm&&String(rm)>=String(x.created_at))return;
      var d=x.new_data||{};
      out[x.record_id]={at:d.validated_at||x.created_at,reason:d.reason||'Validation manuelle'};
    });
    return out;
  }

  async function hydrate(){
    try{
      var server=await loadServerOverrides();
      var local=overrides(), merged=Object.assign({},local,server);
      Object.keys(local).forEach(function(k){if(!server[k])delete merged[k];});
      writeLocal(merged);
      sessionStorage.setItem(HYDRATE_KEY,'1');
      return true;
    }catch(e){
      console.warn('[session-persistence] hydration impossible, fonctionnement local conservé',e);
      return false;
    }
  }

  /* Intercepte uniquement le store des validations de séances. Les autres
     usages de localStorage de l'application restent totalement inchangés. */
  function installPersistenceBridge(){
    if(window.__tcSessionPersistenceBridge)return;
    var originalSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      originalSet.call(this,key,value);
      if(this===localStorage&&key===STORE){
        var next=json(value)||{},prev=window.__tcSessionOverridesLast||{};
        window.__tcSessionOverridesLast=next;
        Object.keys(next).forEach(function(date){
          if(!prev[date]||prev[date].at!==next[date].at){
            persistOverride(date,next[date].reason).catch(function(e){console.error('[session-persistence]',e);});
          }
        });
        Object.keys(prev).forEach(function(date){
          if(!next[date])removeOverride(date).catch(function(e){console.error('[session-persistence]',e);});
        });
      }
    };
    window.__tcSessionPersistenceBridge=true;
  }

  async function initPersistence(){
    installPersistenceBridge();
    var hydrated=await hydrate();
    if(hydrated&&window.SeancesGlobales&&typeof window.SeancesGlobales.refresh==='function')window.SeancesGlobales.refresh();
  }

  async function deleteDate(table,date){
    var url=SB_REST+'/'+table+'?date_seance=eq.'+encodeURIComponent(date);
    var r=await fetch(url,{method:'DELETE',headers:Object.assign(auth(),{'Prefer':'return=representation'})});
    var text=await r.text();
    if(!r.ok) throw Error(table+' — HTTP '+r.status+' — '+text.slice(0,220));
    try{return text?JSON.parse(text):[];}catch(e){return [];}
  }

  async function removeSession(date,button){
    if(!date||button.dataset.busy==='1')return;
    var first=window.confirm('Supprimer la séance du '+date+' ?\n\nCette action supprimera tous les cours ET tous les indices de cette date.');
    if(!first)return;
    var second=window.confirm('CONFIRMATION FINALE\n\nSupprimer définitivement toute la séance '+date+' ?');
    if(!second)return;
    button.dataset.busy='1';button.disabled=true;button.textContent='Suppression…';
    try{
      var h=await deleteDate('historique',date),i=await deleteDate('indices',date);
      var a=overrides();delete a[date];writeLocal(a);
      button.textContent='✓ Supprimée';button.style.opacity='.65';
      var msg='Séance '+date+' supprimée : '+(Array.isArray(h)?h.length:0)+' cours et '+(Array.isArray(i)?i.length:0)+' indices.';
      if(typeof toast==='function')toast(msg,'ok');else alert(msg);
      setTimeout(function(){if(window.SeancesGlobales&&typeof window.SeancesGlobales.refresh==='function')window.SeancesGlobales.refresh();else location.reload();},400);
    }catch(e){
      console.error('[seances-globales-actions]',e);button.dataset.busy='0';button.disabled=false;button.textContent='✕ Supprimer';
      if(typeof toast==='function')toast('Suppression impossible : '+e.message,'err');else alert('Suppression impossible : '+e.message);
    }
  }

  function style(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent='.'+BTN_CLASS+'{color:#e58d84!important;border-color:rgba(210,100,90,.55)!important;background:transparent}.'+BTN_CLASS+':hover{background:rgba(210,100,90,.10)!important}.tc-session-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}';
    document.head.appendChild(s);
  }

  function decorate(){
    var root=document.getElementById('tc-seances-globales');if(!root)return;
    root.querySelectorAll('tbody tr').forEach(function(tr){
      if(tr.querySelector('.'+BTN_CLASS))return;
      var view=tr.querySelector('[data-g-view]');if(!view)return;
      var date=view.getAttribute('data-g-view'),actions=tr.lastElementChild;if(!actions)return;
      var b=document.createElement('button');b.type='button';b.className='btn btn-outline btn-sm '+BTN_CLASS;b.textContent='✕ Supprimer séance';b.title='Supprimer tous les cours et indices de cette séance';
      b.addEventListener('click',function(){removeSession(date,b);});actions.appendChild(b);
    });
  }

  function init(){
    style();decorate();
    var root=document.getElementById('tc-seances-globales');
    if(root&&!root.__tcDeleteObserver){var obs=new MutationObserver(function(){decorate();});obs.observe(root,{childList:true,subtree:true});root.__tcDeleteObserver=obs;}
    setTimeout(decorate,300);setTimeout(decorate,1000);
    initPersistence();
  }
  function boot(){init();if(!document.getElementById('tc-seances-globales'))setTimeout(boot,500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();