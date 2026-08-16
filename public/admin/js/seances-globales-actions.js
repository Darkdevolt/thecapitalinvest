/* THE CAPITAL — Actions des séances globales
 * Ajoute une action de suppression visible pour chaque séance.
 * Supprime les cours ET les indices de la date sélectionnée.
 * Aucun schéma Supabase n'est modifié.
 */
(function(){
  'use strict';
  var STYLE_ID='tc-global-session-actions-style';
  var BTN_CLASS='tc-global-delete-session';

  function esc(v){return String(v==null?'':v).replace(/'/g,"\\'");}
  function auth(){return {apikey:SB_ANON,Authorization:'Bearer '+TK,Accept:'application/json'};}

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
    button.dataset.busy='1';
    button.disabled=true;
    button.textContent='Suppression…';
    try{
      var h=await deleteDate('historique',date);
      var i=await deleteDate('indices',date);
      button.textContent='✓ Supprimée';
      button.style.opacity='.65';
      var msg='Séance '+date+' supprimée : '+(Array.isArray(h)?h.length:0)+' cours et '+(Array.isArray(i)?i.length:0)+' indices.';
      if(typeof toast==='function')toast(msg,'ok');else alert(msg);
      setTimeout(function(){
        if(window.SeancesGlobales&&typeof window.SeancesGlobales.refresh==='function')window.SeancesGlobales.refresh();
        else location.reload();
      },400);
    }catch(e){
      console.error('[seances-globales-actions]',e);
      button.dataset.busy='0';button.disabled=false;button.textContent='✕ Supprimer';
      if(typeof toast==='function')toast('Suppression impossible : '+e.message,'err');else alert('Suppression impossible : '+e.message);
    }
  }

  function style(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent='.'+BTN_CLASS+'{color:#e58d84!important;border-color:rgba(210,100,90,.55)!important;background:transparent}.${BTN_CLASS}:hover{background:rgba(210,100,90,.10)!important}.tc-session-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}';
    document.head.appendChild(s);
  }

  function decorate(){
    var root=document.getElementById('tc-seances-globales');
    if(!root)return;
    root.querySelectorAll('tbody tr').forEach(function(tr){
      if(tr.querySelector('.'+BTN_CLASS))return;
      var view=tr.querySelector('[data-g-view]');
      if(!view)return;
      var date=view.getAttribute('data-g-view');
      var actions=tr.lastElementChild;
      if(!actions)return;
      var b=document.createElement('button');
      b.type='button';b.className='btn btn-outline btn-sm '+BTN_CLASS;b.textContent='✕ Supprimer séance';b.title='Supprimer tous les cours et indices de cette séance';
      b.addEventListener('click',function(){removeSession(date,b);});
      actions.appendChild(b);
    });
  }

  function init(){
    style();
    decorate();
    var root=document.getElementById('tc-seances-globales');
    if(root&&!root.__tcDeleteObserver){
      var obs=new MutationObserver(function(){decorate();});
      obs.observe(root,{childList:true,subtree:true});
      root.__tcDeleteObserver=obs;
    }
    setTimeout(decorate,300);setTimeout(decorate,1000);
  }

  function boot(){
    init();
    if(!document.getElementById('tc-seances-globales'))setTimeout(boot,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();