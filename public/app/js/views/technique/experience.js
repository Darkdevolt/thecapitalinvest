// THE CAPITAL — Analyse technique : expérience Simple / Pro
// UI uniquement. Aucune API, Supabase, donnée ou logique de marché modifiée.
(function(){
  'use strict';
  if(window.__atExperienceLoaded)return;
  window.__atExperienceLoaded=true;

  const root=()=>document.getElementById('view-analyse-technique');
  const isPro=()=>root()?.getAttribute('data-experience-mode')==='pro' || root()?.classList.contains('at-pro');

  function applyMode(mode,save=true){
    const r=root();
    if(!r)return false;
    const pro=mode==='pro';

    // Une seule source visuelle d'état : classes + attribut de données.
    // L'attribut permet au CSS et aux autres modules de lire le mode sans
    // dépendre d'un état JS fragile.
    r.classList.toggle('at-pro',pro);
    r.classList.toggle('at-simple',!pro);
    r.setAttribute('data-experience-mode',pro?'pro':'simple');
    r.setAttribute('data-pro-mode',pro?'true':'false');

    const btn=r.querySelector('#atModeToggle');
    const wrap=r.querySelector('.at-mode-control');
    if(btn){
      btn.setAttribute('aria-checked',String(pro));
      btn.setAttribute('aria-pressed',String(pro));
      btn.setAttribute('data-mode',pro?'pro':'simple');
      btn.dataset.mode=pro?'pro':'simple';
    }
    if(wrap){
      const simple=wrap.querySelector('.simple');
      const proOption=wrap.querySelector('.pro');
      if(simple)simple.classList.toggle('active',!pro);
      if(proOption)proOption.classList.toggle('active',pro);
    }

    if(save){
      try{localStorage.setItem('tc-at-experience',pro?'pro':'simple');}catch(e){console.warn('[AT EXPERIENCE] localStorage:',e);}
    }

    // Le mode Pro est une expérience d'interface, pas un preset d'indicateurs.
    // On rerend uniquement si des données existent déjà.
    if(typeof window.atRender==='function'&&Array.isArray(window.AT?.hist)&&window.AT.hist.length){
      requestAnimationFrame(()=>{try{window.atRender();}catch(e){console.warn('[AT EXPERIENCE] render:',e);}});
    }

    // Informe les modules techniques sans créer de dépendance bloquante.
    try{window.dispatchEvent(new CustomEvent('tc:at-experience-change',{detail:{mode:pro?'pro':'simple',pro}}));}catch(e){}
    return true;
  }

  function readSavedMode(){
    try{return localStorage.getItem('tc-at-experience')==='pro'?'pro':'simple';}
    catch(e){return 'simple';}
  }

  function ensureMode(){
    const r=root(),tb=r?.querySelector('.at-toolbar');
    if(!r||!tb)return false;

    let wrap=r.querySelector('.at-mode-control');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='at-mode-control';
      wrap.innerHTML='<span class="at-mode-label">EXPÉRIENCE</span><button type="button" id="atModeToggle" class="at-mode-switch" role="switch" aria-label="Basculer entre mode simple et mode professionnel" aria-checked="false" aria-pressed="false"><span class="at-mode-option simple">Simple</span><span class="at-mode-track"><span class="at-mode-thumb"></span></span><span class="at-mode-option pro">Pro</span></button><span class="at-mode-help" title="Simple : lecture rapide. Pro : outils avancés, Fibonacci, dessins et indicateurs complets.">i</span>';
      tb.appendChild(wrap);
    }

    const btn=wrap.querySelector('#atModeToggle');
    if(btn&&!btn.dataset.bound){
      btn.dataset.bound='1';
      const toggle=()=>applyMode(isPro()?'simple':'pro');
      btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();toggle();});
      btn.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();toggle();}
        if(e.key==='ArrowLeft')applyMode('simple');
        if(e.key==='ArrowRight')applyMode('pro');
      });
    }

    const saved=readSavedMode();
    // Ne réinitialise pas un choix déjà effectué par l'utilisateur lors d'un
    // rerender de la vue.
    const current=r.getAttribute('data-experience-mode');
    applyMode(current==='pro'||current==='simple'?current:saved,false);
    return true;
  }

  function makeToolsIntuitive(){
    const r=root(); if(!r)return;
    r.querySelectorAll('.at-tool,.at-btn').forEach(el=>{
      if(!el.getAttribute('title')&&el.textContent.trim())el.setAttribute('title',el.textContent.trim());
    });
    const draw=r.querySelector('.at-drawtb');
    if(draw&&!draw.querySelector('.at-draw-hint')){
      const h=document.createElement('span');
      h.className='at-draw-hint';
      h.textContent='Sélectionnez un outil puis cliquez sur le graphique';
      draw.appendChild(h);
    }
    const ind=r.querySelector('[onclick="atOpenIndModal()"]');
    if(ind)ind.setAttribute('title','Choisir les indicateurs à afficher');
    const compare=r.querySelector('[onclick="atCompare()"]');
    if(compare)compare.setAttribute('title','Comparer avec un autre titre');
  }

  function rowTicker(row){return String(row?.ticker ?? row?.symbol ?? row?.code ?? row?.symbole ?? row?.valeur ?? '').trim().toUpperCase();}
  function rowName(row){return String(row?.nom ?? row?.entreprise ?? row?.name ?? row?.libelle ?? '').trim();}
  function rowPrice(row){const value=row?.cours ?? row?.cloture ?? row?.cours_cloture ?? row?.close ?? row?.prix;const n=Number(value);return Number.isFinite(n)&&n>0?n:null;}
  function findCourse(ticker){const wanted=String(ticker||'').trim().toUpperCase();return (Array.isArray(window.allCours)?window.allCours:[]).find(r=>rowTicker(r)===wanted)||null;}

  function installCourseFallback(){
    const sel=document.getElementById('atTicker'); if(!sel)return;
    if(Array.isArray(window.allCours)&&window.allCours.length){
      const current=String(sel.value||window.AT?.ticker||'').trim().toUpperCase();
      const seen=new Set();
      const rows=window.allCours.filter(r=>{const t=rowTicker(r);if(!t||seen.has(t))return false;seen.add(t);return true;}).sort((a,b)=>rowTicker(a).localeCompare(rowTicker(b)));
      if(rows.length){
        const previous=current;
        sel.innerHTML='<option value="">Choisir un titre…</option>'+rows.map(r=>{const t=rowTicker(r),n=rowName(r);return `<option value="${t}">${t}${n?' — '+n:''}</option>`}).join('');
        if(previous&&rows.some(r=>rowTicker(r)===previous))sel.value=previous;
        sel.disabled=false;
      }
    }
  }

  function installTickerRecovery(){
    if(window.__atTickerRecoveryInstalled)return;
    if(typeof window.atLoadTicker!=='function')return;
    window.__atTickerRecoveryInstalled=true;
    const original=window.atLoadTicker;
    window.atLoadTicker=async function(){
      const sel=document.getElementById('atTicker'),ticker=String(sel?.value||'').trim().toUpperCase();
      if(!ticker)return original.apply(this,arguments);
      try{
        const result=await original.apply(this,arguments);
        if((!Array.isArray(window.AT?.hist)||!window.AT.hist.length)){
          const row=findCourse(ticker),price=rowPrice(row);
          if(row&&price){
            window.AT.ticker=ticker;
            window.AT.hist=[{date:row.date_seance||new Date().toISOString().slice(0,10),o:Number(row.cours_ouverture??price)||price,h:Number(row.plus_haut??price)||price,l:Number(row.plus_bas??price)||price,c:price,v:Number(row.volume)||0}];
            const meta=document.getElementById('atTickerMeta');
            if(meta)meta.textContent=`Cours actuel • ${price.toLocaleString('fr-FR')} FCFA • historique détaillé à compléter`;
            if(typeof window.atRender==='function')window.atRender();
            return true;
          }
        }
        return result;
      }catch(error){
        const row=findCourse(ticker),price=rowPrice(row);
        if(row&&price){
          window.AT.ticker=ticker;
          window.AT.hist=[{date:row.date_seance||new Date().toISOString().slice(0,10),o:price,h:price,l:price,c:price,v:Number(row.volume)||0}];
          const meta=document.getElementById('atTickerMeta');
          if(meta)meta.textContent=`Cours actuel • ${price.toLocaleString('fr-FR')} FCFA`;
          if(typeof window.atRender==='function')window.atRender();
          return true;
        }
        throw error;
      }
    };
  }

  function boot(){
    try{ensureMode();}catch(e){console.warn('[AT EXPERIENCE] mode:',e);}
    try{makeToolsIntuitive();}catch(e){console.warn('[AT EXPERIENCE] tools:',e);}
    try{installCourseFallback();}catch(e){console.warn('[AT EXPERIENCE] courses:',e);}
    try{installTickerRecovery();}catch(e){console.warn('[AT EXPERIENCE] recovery:',e);}
  }

  window.atInitExperience=boot;
  window.atSetExperienceMode=applyMode;

  document.addEventListener('click',e=>{
    const t=e.target.closest('#view-analyse-technique #atModeToggle');
    if(t)e.stopPropagation();
  },{capture:true});

  boot();
  const timer=setInterval(()=>{if(root()?.querySelector('.at-toolbar'))boot()},100);
  setTimeout(()=>clearInterval(timer),8000);
})();
