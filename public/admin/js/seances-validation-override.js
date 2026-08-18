/* THE CAPITAL — Validation manuelle des séances avec données temporairement indisponibles.
 * Une absence de données attendues (ex. indices manquants) est une anomalie informative,
 * pas une incohérence de marché. Les incohérences de cours, doublons et dates anormales
 * restent bloquantes. Aucun changement de schéma Supabase.
 */
(function(){
  'use strict';
  var ID='tc-seances-calendrier';
  var STORE='tc_global_sessions_v2';

  function getAdmin(){
    var el=document.getElementById('admin-user');
    return el&&el.textContent?el.textContent.trim():'admin';
  }
  function save(date,reason){
    var x={};
    try{x=JSON.parse(localStorage.getItem(STORE)||'{}');}catch(e){}
    x[date]={at:new Date().toISOString(),by:getAdmin(),override:true,reason:reason||'Données de séance indisponibles au moment du contrôle.'};
    localStorage.setItem(STORE,JSON.stringify(x));
  }
  function onlyDataGap(warning){
    if(!warning)return false;
    var t=warning.textContent.toLowerCase();
    return t.indexOf('indice')>=0 &&
      t.indexOf('incohérence')<0 &&
      t.indexOf('doublon')<0 &&
      t.indexOf('week-end')<0;
  }
  function apply(){
    var root=document.getElementById(ID);if(!root)return;
    var detail=root.querySelector('[data-cal-detail]');if(!detail)return;
    var warning=detail.querySelector('.tc-cal-warning');
    if(!onlyDataGap(warning))return;
    if(detail.querySelector('[data-cal-gap-validate]'))return;

    var actions=detail.querySelector('.tc-cal-actions');if(!actions)return;
    var close=actions.querySelector('[data-cal-close]');
    if(!close)return;
    var title=detail.querySelector('.tc-cal-detail-title');
    var text=(title&&title.textContent)||'';
    var date='';
    var m=text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if(m)date=m[3]+'-'+m[2]+'-'+m[1];
    if(!date){
      var buttons=root.querySelectorAll('[data-cal-date]');
      for(var i=0;i<buttons.length;i++){
        if(buttons[i].classList.contains('selected')){date=buttons[i].getAttribute('data-cal-date');break;}
      }
    }
    if(!date)return;

    var hint=actions.querySelector('.tc-cal-hint');
    if(hint)hint.remove();
    var btn=document.createElement('button');
    btn.type='button';btn.className='btn btn-primary btn-sm';btn.setAttribute('data-cal-gap-validate','1');
    btn.textContent='✓ Valider malgré les données manquantes';
    btn.onclick=function(){
      var reason=window.prompt('Motif de validation manuelle :','Les données d’indices de cette séance ne sont pas disponibles. Les cours des actions ont été contrôlés.');
      if(reason===null)return;
      reason=reason.trim();
      if(!reason)reason='Données d’indices indisponibles ; séance validée manuellement après contrôle des cours.';
      save(date,reason);
      if(typeof window.toast==='function')window.toast('Séance validée manuellement malgré les données manquantes.','ok');
      var refresh=detail.querySelector('[data-cal-close]');
      if(refresh)refresh.click();
      var r=root.querySelector('[data-cal-refresh]');if(r)r.click();
    };
    actions.insertBefore(btn,close);

    var note=document.createElement('div');
    note.className='tc-cal-manual-note';
    note.innerHTML='<strong>Validation manuelle possible.</strong> Les données attendues sont incomplètes, mais aucune incohérence de cours ni doublon n’a été détecté. La validation sera enregistrée comme une exception opérateur.';
    warning.parentNode.insertBefore(note,warning.nextSibling);
  }

  function boot(){
    var root=document.getElementById(ID);
    if(!root){setTimeout(boot,250);return;}
    var observer=new MutationObserver(apply);
    observer.observe(root,{subtree:true,childList:true});
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
