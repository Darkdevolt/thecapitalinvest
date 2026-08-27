/* ============================================================
   THE CAPITAL — DIAGNOSTIC DE DÉMARRAGE
   Capture les erreurs JS, les promesses rejetées, les temps de chargement
   et les étapes critiques. Aucun appel réseau métier : ce module ne doit
   jamais bloquer le démarrage de l'administration.
   ============================================================ */
'use strict';
(function(w){
  const started=performance.now(),events=[],MAX=200;
  function safe(value){try{return typeof value==='string'?value:JSON.stringify(value);}catch(e){return String(value);}}
  function push(type,message,detail){events.push({t:Math.round(performance.now()-started),type,message:String(message||'').slice(0,1000),detail:detail?safe(detail).slice(0,2000):''});if(events.length>MAX)events.shift();}
  w.TC_DIAG={started,events,push,mark(name,detail){push('mark',name,detail);},snapshot(){return{generated_at:new Date().toISOString(),page:location.href,user_agent:navigator.userAgent,online:navigator.onLine,elapsed_ms:Math.round(performance.now()-started),events:events.slice(),resources:performance.getEntriesByType('resource').slice(-80).map(r=>({name:r.name,duration:Math.round(r.duration),size:r.transferSize||0}))};},download(){const blob=new Blob([JSON.stringify(this.snapshot(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='the-capital-admin-diagnostic-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}};
  const hiddenStyle=document.createElement('style');hiddenStyle.id='tc-hidden-fix';hiddenStyle.textContent='[hidden]{display:none!important;}';(document.head||document.documentElement).appendChild(hiddenStyle);
  w.addEventListener('error',e=>push('javascript',e.message||'Erreur JavaScript',{file:e.filename,line:e.lineno,column:e.colno,error:e.error&&e.error.stack}));
  w.addEventListener('unhandledrejection',e=>push('promise',e.reason&&e.reason.stack||e.reason||'Promise rejetée'));
  w.addEventListener('offline',()=>push('network','Navigateur passé hors ligne'));
  w.addEventListener('online',()=>push('network','Connexion réseau rétablie'));
  setTimeout(()=>{performance.getEntriesByType('resource').forEach(r=>{if(/\.js(?:\?|$)/i.test(r.name)&&r.duration>3000)push('slow-resource','Script lent: '+r.name,{duration_ms:Math.round(r.duration)});});},3500);

  // Extension non bloquante : les trois nouveaux modules restent dans le noyau
  // admin existant mais sont chargés après son bootstrap. Cela évite de
  // modifier l'ordre historique des scripts ni de recréer un second routeur.
  const EXTENSIONS=[
    {id:'abonnements',label:'Abonnements',group:'Gestion',icon:'◌',src:'/admin/js/modules/abonnements.js?v=20260827'},
    {id:'institute',label:'The Capital Institute',group:'Gestion',icon:'◈',src:'/admin/js/modules/institute.js?v=20260827'},
    {id:'parametres',label:'Paramètres',group:'Gestion',icon:'⚙',src:'/admin/js/modules/parametres.js?v=20260827'}
  ];
  function waitForCore(){return new Promise(resolve=>{const startedAt=Date.now();(function check(){if(w.TC&&typeof TC.register==='function'&&typeof TC.go==='function'&&TC.el('rail-groups')&&TC.el('stage'))return resolve();if(Date.now()-startedAt>15000)return resolve();setTimeout(check,50);})();});}
  function loadScript(src){return new Promise(resolve=>{if(document.querySelector('script[data-tc-extension="'+src+'"]'))return resolve();const s=document.createElement('script');s.src=src;s.async=false;s.dataset.tcExtension=src;s.onload=()=>resolve(true);s.onerror=()=>{push('extension','Module indisponible: '+src);resolve(false);};document.head.appendChild(s);});}
  function ensureNav(module){
    const groups=Array.from(document.querySelectorAll('#rail-groups .rail-group')),group=groups.find(g=>String(g.querySelector('h4')?.textContent||'').trim()===module.group);if(!group)return;
    if(!group.querySelector('[data-go="'+module.id+'"]')){const b=document.createElement('button');b.className='rail-link';b.dataset.go=module.id;b.innerHTML='<span class="rail-ico">'+module.icon+'</span><span>'+module.label+'</span><span class="rail-badge" id="badge-'+module.id+'" hidden></span>';group.appendChild(b);}
    if(!TC.el('panel-'+module.id)){const p=document.createElement('section');p.className='panel';p.id='panel-'+module.id;p.dataset.module=module.id;TC.el('stage').appendChild(p);}
  }
  async function installExtensions(){
    await waitForCore();
    for(const ext of EXTENSIONS){if(!TC.module(ext.id))await loadScript(ext.src);ensureNav(ext);}
    const wanted=location.hash.slice(1);if(EXTENSIONS.some(x=>x.id===wanted))TC.go(wanted,{scroll:false});
    push('extensions','Modules admin complémentaires chargés',EXTENSIONS.map(x=>x.id));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installExtensions,0),{once:true});else setTimeout(installExtensions,0);
})(window);
