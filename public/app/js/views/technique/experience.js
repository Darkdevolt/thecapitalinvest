// THE CAPITAL — Analyse technique : expérience Simple / Pro
// UI uniquement. Aucune API, Supabase, donnée ou logique de marché modifiée.
(function(){
  if(window.__atExperienceLoaded)return; window.__atExperienceLoaded=true;
  const root=()=>document.getElementById('view-analyse-technique');
  const isPro=()=>root()?.classList.contains('at-pro');
  function ensureMode(){
    const r=root(), tb=r?.querySelector('.at-toolbar'); if(!r||!tb||document.getElementById('atModeToggle'))return;
    const wrap=document.createElement('div'); wrap.className='at-mode-control'; wrap.innerHTML='<span class="at-mode-label">EXPÉRIENCE</span><button type="button" id="atModeToggle" class="at-mode-switch" aria-label="Basculer entre mode simple et mode professionnel" aria-pressed="false"><span class="at-mode-option simple">Simple</span><span class="at-mode-track"><span class="at-mode-thumb"></span></span><span class="at-mode-option pro">Pro</span></button><span class="at-mode-help" title="Simple : analyse essentielle. Pro : outils avancés, Fibonacci, dessins et indicateurs complets.">i</span>';
    tb.appendChild(wrap);
    const btn=wrap.querySelector('#atModeToggle');
    const saved=localStorage.getItem('tc-at-experience')||'simple';
    const apply=(mode,save=true)=>{const pro=mode==='pro';r.classList.toggle('at-pro',pro);r.classList.toggle('at-simple',!pro);btn.setAttribute('aria-pressed',String(pro));wrap.querySelector('.simple').classList.toggle('active',!pro);wrap.querySelector('.pro').classList.toggle('active',pro);if(save)localStorage.setItem('tc-at-experience',pro?'pro':'simple'); if(typeof atRender==='function'&&window.AT?.hist?.length)setTimeout(()=>atRender(),30)};
    btn.addEventListener('click',()=>apply(isPro()?'simple':'pro'));
    apply(saved==='pro',false);
  }
  function makeToolsIntuitive(){
    const r=root(); if(!r)return;
    r.querySelectorAll('.at-tool,.at-btn').forEach(el=>{
      if(!el.getAttribute('title')&&el.textContent.trim())el.setAttribute('title',el.textContent.trim());
    });
    const draw=r.querySelector('.at-drawtb');
    if(draw&&!draw.querySelector('.at-draw-hint')){const h=document.createElement('span');h.className='at-draw-hint';h.textContent='Sélectionnez un outil puis cliquez sur le graphique';draw.appendChild(h)}
    const ind=r.querySelector('[onclick="atOpenIndModal()"]'); if(ind)ind.setAttribute('title','Choisir les indicateurs à afficher');
    const compare=r.querySelector('[onclick="atCompare()"]'); if(compare)compare.setAttribute('title','Comparer avec un autre titre');
  }
  function refresh(){ensureMode();makeToolsIntuitive()}
  window.atInitExperience=refresh;
  document.addEventListener('click',e=>{const t=e.target.closest('#view-analyse-technique .at-mode-switch');if(t)e.stopPropagation()},{capture:true});
})();
