// THE CAPITAL — Analyse technique : expérience Simple / Pro
// Module isolé : ne modifie ni le bootstrap, ni l'authentification, ni les autres vues.
(function(){
  'use strict';
  if(window.__atExperienceLoaded)return;
  window.__atExperienceLoaded=true;

  const root=()=>document.getElementById('view-analyse-technique');
  const isPro=()=>root()?.getAttribute('data-experience-mode')==='pro';
  const safeStorage=(key,value)=>{try{localStorage.setItem(key,value);}catch(e){}};
  const readStorage=(key)=>{try{return localStorage.getItem(key);}catch(e){return null;}};

  function refreshModeUI(pro){
    const r=root(); if(!r)return;
    r.classList.toggle('at-pro',pro);
    r.classList.toggle('at-simple',!pro);
    r.setAttribute('data-experience-mode',pro?'pro':'simple');
    r.setAttribute('data-pro-mode',pro?'true':'false');
    const btn=r.querySelector('#atModeToggle');
    if(btn){
      btn.setAttribute('aria-checked',String(pro));
      btn.setAttribute('aria-pressed',String(pro));
      btn.setAttribute('data-mode',pro?'pro':'simple');
    }
    const wrap=r.querySelector('.at-mode-control');
    if(wrap){
      wrap.querySelector('.simple')?.classList.toggle('active',!pro);
      wrap.querySelector('.pro')?.classList.toggle('active',pro);
    }
  }

  function applyMode(mode,save=true){
    const r=root(); if(!r)return false;
    const pro=String(mode).toLowerCase()==='pro';
    refreshModeUI(pro);
    if(save)safeStorage('tc-at-experience',pro?'pro':'simple');

    // Le preset est appliqué après le changement d'état UI. Il est tolérant aux
    // chargements tardifs : si presets.js n'est pas encore disponible, le mode
    // reste fonctionnel et sera réappliqué lors du prochain boot.
    try{
      if(typeof window.atApplyPreset==='function') window.atApplyPreset(pro?'pro':'decouverte');
      else if(typeof window.atRender==='function'&&Array.isArray(window.AT?.hist)&&window.AT.hist.length) window.atRender();
    }catch(e){console.warn('[AT EXPERIENCE] preset/render:',e);}

    try{window.dispatchEvent(new CustomEvent('tc:at-experience-change',{detail:{mode:pro?'pro':'simple',pro}}));}catch(e){}
    return true;
  }

  function ensureMode(){
    const r=root(),tb=r?.querySelector('.at-toolbar');
    if(!r||!tb)return false;
    let wrap=r.querySelector('.at-mode-control');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='at-mode-control';
      wrap.innerHTML='<span class="at-mode-label">EXPÉRIENCE</span><button type="button" id="atModeToggle" class="at-mode-switch" role="switch" aria-label="Basculer entre mode simple et mode professionnel" aria-checked="false" aria-pressed="false"><span class="at-mode-option simple">Simple</span><span class="at-mode-track"><span class="at-mode-thumb"></span></span><span class="at-mode-option pro">Pro</span></button><span class="at-mode-help" title="Simple : lecture rapide. Pro : outils avancés, dessins et indicateurs complets.">i</span>';
      tb.appendChild(wrap);
    }
    const saved=readStorage('tc-at-experience');
    const current=r.getAttribute('data-experience-mode');
    const wanted=current==='pro'||current==='simple'?current:(saved==='pro'?'pro':'simple');
    refreshModeUI(wanted==='pro');
    return true;
  }

  function makeToolsIntuitive(){
    const r=root();if(!r)return;
    r.querySelectorAll('.at-tool,.at-btn').forEach(el=>{if(!el.getAttribute('title')&&el.textContent.trim())el.setAttribute('title',el.textContent.trim());});
    const draw=r.querySelector('.at-drawtb');
    if(draw&&!draw.querySelector('.at-draw-hint')){const h=document.createElement('span');h.className='at-draw-hint';h.textContent='Sélectionnez un outil puis cliquez sur le graphique';draw.appendChild(h);}
    const ind=r.querySelector('[onclick="atOpenIndModal()"]');if(ind)ind.setAttribute('title','Choisir les indicateurs à afficher');
    const compare=r.querySelector('[onclick="atCompare()"]');if(compare)compare.setAttribute('title','Comparer avec un autre titre');
  }

  // Recharge l'intégralité de l'historique disponible pour le titre, par pages,
  // au lieu de plafonner l'analyse à 3 000 séances. Le module reste isolé.
  async function loadFullHistory(){
    const AT=window.AT;
    if(!AT||typeof window.sb!=='function'||typeof window.atExtract!=='function'||!AT.ticker)return false;
    const pageSize=1000;
    const all=[];
    try{
      for(let offset=0;offset<100000;offset+=pageSize){
        const page=await window.sb('historique',{ticker:`eq.${AT.ticker}`,order:'date_seance.asc',limit:pageSize,offset});
        if(!Array.isArray(page)||!page.length)break;
        all.push(...page);
        if(page.length<pageSize)break;
      }
      if(!all.length)return false;
      const hist=window.atExtract(all);
      if(!Array.isArray(hist)||!hist.length)return false;
      AT.hist=hist.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
      if(AT.histCache)AT.histCache[AT.ticker]=all;
      if(typeof window.atRender==='function')window.atRender();
      const meta=document.getElementById('atTickerMeta');
      if(meta){const last=AT.hist[AT.hist.length-1];meta.textContent=`${AT.hist.length} séances • historique complet disponible • dernier cours ${Number(last?.c||0).toLocaleString('fr-FR')} FCFA`+(last?.date?' • '+last.date:'');}
      return true;
    }catch(e){
      console.warn('[AT EXPERIENCE] historique complet:',e);
      return false;
    }
  }

  function installFullHistory(){
    if(window.__atFullHistoryInstalled||typeof window.atLoadTicker!=='function')return;
    window.__atFullHistoryInstalled=true;
    const original=window.atLoadTicker;
    window.atLoadTicker=async function(){
      const result=await original.apply(this,arguments);
      if(result){
        // L'historique complet est chargé en arrière-plan : le premier rendu
        // reste immédiat et la version longue remplace ensuite les données.
        loadFullHistory();
      }
      return result;
    };
  }

  function boot(){
    try{ensureMode();}catch(e){console.warn('[AT EXPERIENCE] mode:',e);}
    try{makeToolsIntuitive();}catch(e){console.warn('[AT EXPERIENCE] tools:',e);}
    try{installFullHistory();}catch(e){console.warn('[AT EXPERIENCE] history:',e);}
  }

  // Délégation unique : fonctionne même lorsque le bouton est recréé par la vue.
  // Aucun listener direct concurrent ne peut provoquer un double basculement.
  if(!window.__atExperienceClickBound){
    window.__atExperienceClickBound=true;
    document.addEventListener('click',function(e){
      const btn=e.target?.closest?.('#view-analyse-technique #atModeToggle');
      if(!btn)return;
      e.preventDefault();
      e.stopPropagation();
      applyMode(isPro()?'simple':'pro');
    },true);
  }

  window.atInitExperience=boot;
  window.atSetExperienceMode=applyMode;
  boot();
  const timer=setInterval(()=>{if(root()?.querySelector('.at-toolbar'))boot()},150);
  setTimeout(()=>clearInterval(timer),12000);
})();
