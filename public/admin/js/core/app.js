/* ============================================================
   THE CAPITAL — NOYAU / APPLICATION
   ============================================================ */
'use strict';
(function (TC) {
    const modules = [], byId = {}; let current = '';
    const GROUPS = [{id:'pilotage',label:'Pilotage'},{id:'marche',label:'Données de marché'},{id:'societes',label:'Sociétés cotées'},{id:'diffusion',label:'Diffusion'},{id:'gestion',label:'Gestion'}];
    TC.register = function (module) { if (byId[module.id]) return; modules.push(module); byId[module.id] = module; };
    TC.module = id => byId[id];
    function bootMsg(text){ const n=TC.el('boot-msg'); if(n)n.textContent=text; }
    function reportBoot(code,error,extra){
        const report={app:'The Capital Admin',code,error:String(error&&error.message||error||''),stack:String(error&&error.stack||''),step:TC._bootStep||'',time:new Date().toISOString(),duration_ms:Math.round(performance.now()-(TC._bootStarted||performance.now())),online:navigator.onLine,url:location.href,extra:extra||{}};
        window.__TC_ADMIN_BOOT_REPORT__=report;
        console.error('[TC BOOT]',report);
        try{localStorage.setItem('tc_admin_boot_report',JSON.stringify(report));}catch(e){}
        return report;
    }
    function bootFatal(title,detail,code,error){
        reportBoot(code||'BOOT_FATAL',error||detail,{detail});
        const boot=TC.el('boot');
        boot.innerHTML='<img src="'+TC.env.LOGO+'" alt=""><div class="fatal"><h2>'+TC.esc(title)+'</h2><p>'+TC.esc(detail)+'</p><p class="boot-code">Code diagnostic : <b>'+TC.esc(code||'BOOT_FATAL')+'</b></p><button class="btn btn-primary" id="boot-retry">Réessayer</button><button class="btn" id="boot-report">Rapport technique</button></div>';
        boot.hidden=false;
        TC.el('boot-retry').onclick=()=>location.reload();
        TC.el('boot-report').onclick=()=>{const r=window.__TC_ADMIN_BOOT_REPORT__||{};const b=new Blob([JSON.stringify(r,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='thecapital-admin-diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
    }
    TC._bootStarted=performance.now(); TC._bootStep='initialisation';
    const watchdog=setTimeout(()=>{if(!TC._bootReady)bootFatal('Démarrage bloqué','Le contrôle de démarrage a dépassé 10 secondes. Le rapport identifie l’étape exacte.','ADMIN_BOOT_TIMEOUT',new Error('Boot timeout'));},10000);
    window.addEventListener('error',e=>{if(!TC._bootReady)reportBoot('JAVASCRIPT_ERROR',e.error||new Error(e.message),{file:e.filename,line:e.lineno,column:e.colno});});
    window.addEventListener('unhandledrejection',e=>{if(!TC._bootReady)reportBoot('UNHANDLED_PROMISE',e.reason);});
    function paintRail(){const h=TC.el('rail-groups');h.innerHTML=GROUPS.map(g=>{const items=modules.filter(m=>m.group===g.id);if(!items.length)return '';return '<div class="rail-group"><h4>'+TC.esc(g.label)+'</h4>'+items.map(m=>'<button class="rail-link" data-go="'+m.id+'"><span class="rail-ico">'+(m.icon||'·')+'</span><span>'+TC.esc(m.label)+'</span><span class="rail-badge" id="badge-'+m.id+'" hidden></span></button>').join('')+'</div>';}).join('');}
    function paintStage(){TC.el('stage').innerHTML=modules.map(m=>'<section class="panel" id="panel-'+m.id+'" data-module="'+m.id+'"></section>').join('');}
    TC.badge=function(id,count){const n=TC.el('badge-'+id);if(!n)return;n.hidden=!count;if(count)n.textContent=count>99?'99+':String(count);};
    const mounted={};
    TC.go=function(id,options){const m=byId[id],o=options||{};if(!m)return;TC.qsa('.panel').forEach(p=>p.classList.remove('active'));TC.qsa('.rail-link').forEach(b=>b.classList.toggle('active',b.dataset.go===id));const p=TC.el('panel-'+id);if(!p)return;p.classList.add('active');if(!mounted[id]){p.innerHTML=typeof m.view==='function'?m.view():'';mounted[id]=true;try{if(typeof m.mount==='function')m.mount();}catch(e){console.error('[TC] Montage '+id,e);reportBoot('MODULE_MOUNT_ERROR',e,{module:id});p.innerHTML='<div class="note err"><strong>Section indisponible.</strong> '+TC.esc(e.message)+'</div>';}}else if(typeof m.refresh==='function'&&o.reload!==false&&current!==id){try{m.refresh();}catch(e){console.error('[TC] Refresh '+id,e);}}current=id;if(location.hash.slice(1)!==id)history.replaceState(null,'','#'+id);TC.el('rail').classList.remove('open');if(o.scroll!==false)window.scrollTo({top:0,behavior:'smooth'});};
    TC.currentModule=()=>current;
    let paletteIndex=0,paletteHits=[];
    function paintPalette(q){q=String(q||'').toLowerCase().trim();paletteHits=modules.filter(m=>!q||(m.label+' '+m.id+' '+(m.keywords||'')).toLowerCase().indexOf(q)!==-1);paletteIndex=0;TC.el('palette-list').innerHTML=paletteHits.length?paletteHits.map((m,i)=>'<div class="palette-item'+(i===0?' sel':'')+'" data-go="'+m.id+'"><span class="rail-ico">'+(m.icon||'·')+'</span>'+TC.esc(m.label)+'<span class="grp">'+TC.esc((GROUPS.find(g=>g.id===m.group)||{}).label||'')+'</span></div>').join(''):'<div class="palette-item">Aucune section ne correspond.</div>';}
    function paletteOpen(){TC.el('palette').classList.add('open');const i=TC.el('palette-input');i.value='';paintPalette('');setTimeout(()=>i.focus(),40);} function paletteClose(){TC.el('palette').classList.remove('open');}
    function paletteMove(d){if(!paletteHits.length)return;paletteIndex=(paletteIndex+d+paletteHits.length)%paletteHits.length;TC.qsa('#palette-list .palette-item').forEach((n,i)=>n.classList.toggle('sel',i===paletteIndex));}
    TC.health={set(level,text){const d=TC.el('health-dot'),l=TC.el('health-text');if(!d||!l)return;d.className='health-dot '+level;l.innerHTML=text;},async probe(){this.set('busy','Contrôle de la base…');try{const [s,a]=await Promise.all([TC.get('historique','select=date_seance&order=date_seance.desc&limit=1',6000),TC.count('historique','or=(cours_cloture.lt.0,plus_haut.lt.0,plus_bas.lt.0,volume.lt.0)')]);const last=s&&s[0]&&s[0].date_seance,bad=a.value||0;let text='Dernière séance <b>'+(last?TC.fmtDate(last):'inconnue')+'</b>';let level='ok';if(!last){level='err';text='Aucune séance en base';}else if(bad){level='err';text+=' · <b>'+bad+'</b> anomalie(s)';}else{text+=' · base saine';}this.set(level,text);TC.badge('diagnostic',bad);TC.lastSession=last||null;}catch(e){this.set('err','Contrôle impossible');}}};
    TC.boot=async function(){
        TC._bootStarted=performance.now(); TC._bootStep='session locale'; bootMsg('Vérification de la session…');
        try{
            if(!TC.loadSession()){location.href='/login.html';return;}
            const user=TC.session.user||{}, userId=user.id, email=user.email||'';
            if(!userId&&!email){bootFatal('Session incomplète','Aucun identifiant utilisateur trouvé.','ADMIN_IDENTITY_MISSING');return;}
            TC._bootStep='droits administrateur / users'; bootMsg('Vérification des droits d’administration…');
            const profile=await TC.checkAdmin(user);
            if(!profile.is_admin){bootFatal('Accès refusé','Ce compte ne dispose pas des droits d’administration.','ADMIN_NOT_AUTHORIZED');setTimeout(()=>location.href='/app.html',2600);return;}
            TC._bootStep='construction interface'; TC.session.profile=profile; TC.el('who').textContent=profile.email||email;paintRail();paintStage();TC.el('boot').hidden=true;TC.el('shell').hidden=false;TC._bootReady=true;clearTimeout(watchdog);
            TC.el('rail').addEventListener('click',e=>{const l=e.target.closest('[data-go]');if(l)TC.go(l.dataset.go);});TC.el('rail-toggle').onclick=()=>TC.el('rail').classList.toggle('open');TC.el('logout').onclick=()=>{TC.clearSession();location.href='/login.html';};TC.el('refresh-all').onclick=()=>{TC.invalidateTickers();const m=byId[current];if(m&&m.refresh)m.refresh();TC.health.probe();TC.toast('Section rechargée depuis Supabase','info');};TC.el('health-chip').onclick=()=>TC.go('diagnostic');
            TC.el('palette-open').onclick=paletteOpen;TC.el('palette-input').oninput=e=>paintPalette(e.target.value);TC.el('palette-list').onclick=e=>{const i=e.target.closest('[data-go]');if(i){paletteClose();TC.go(i.dataset.go);}};TC.el('palette').onclick=e=>{if(e.target.id==='palette')paletteClose();};document.addEventListener('keydown',e=>{const o=TC.el('palette').classList.contains('open');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();o?paletteClose():paletteOpen();return;}if(!o)return;if(e.key==='Escape')paletteClose();else if(e.key==='ArrowDown'){e.preventDefault();paletteMove(1);}else if(e.key==='ArrowUp'){e.preventDefault();paletteMove(-1);}else if(e.key==='Enter'){e.preventDefault();const p=paletteHits[paletteIndex];if(p){paletteClose();TC.go(p.id);}}});
            const wanted=location.hash.slice(1);TC.go(byId[wanted]?wanted:'dashboard');TC.health.probe();setInterval(()=>TC.health.probe(),300000);TC.tickers().then(()=>TC.tickerDatalist('tickers-list')).catch(e=>console.warn('[TC] référentiel différé',e));
        }catch(e){if(TC._bootReady)return;const code=e.code||'ADMIN_BOOT_ERROR';const detail=code==='REQUEST_TIMEOUT'?'Supabase ne répond pas dans le délai imparti.':code==='ADMIN_PROFILE_NOT_FOUND'?'Profil absent de users ou lecture bloquée par RLS.':code==='ADMIN_HTTP_401'||code==='ADMIN_HTTP_403'?'Supabase refuse l’accès au profil administrateur.':e.message||'Erreur inconnue pendant le démarrage.';bootFatal('Démarrage de l’administration impossible',detail,code,e);}
    };
})(window.TC);
