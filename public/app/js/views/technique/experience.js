// THE CAPITAL — Analyse technique : expérience Simple / Pro
// UI uniquement. Aucune API, Supabase, donnée ou logique de marché modifiée.
(function(){
  if(window.__atExperienceLoaded)return; window.__atExperienceLoaded=true;
  const root=()=>document.getElementById('view-analyse-technique');
  const isPro=()=>root()?.classList.contains('at-pro');

  function applyMode(mode,save=true){
    const r=root(); if(!r)return false;
    const pro=mode==='pro';
    r.classList.toggle('at-pro',pro);
    r.classList.toggle('at-simple',!pro);
    const btn=r.querySelector('#atModeToggle');
    const wrap=r.querySelector('.at-mode-control');
    if(btn){btn.setAttribute('aria-checked',String(pro));btn.setAttribute('aria-pressed',String(pro));btn.setAttribute('data-mode',pro?'pro':'simple');}
    wrap?.querySelector('.simple')?.classList.toggle('active',!pro);
    wrap?.querySelector('.pro')?.classList.toggle('active',pro);
    if(save)localStorage.setItem('tc-at-experience',pro?'pro':'simple');
    if(typeof atRender==='function'&&window.AT?.hist?.length)setTimeout(()=>atRender(),30);
    return true;
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
      btn.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        applyMode(isPro()?'simple':'pro');
      });
      btn.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();applyMode(isPro()?'simple':'pro');}
      });
    }
    const saved=localStorage.getItem('tc-at-experience')==='pro'?'pro':'simple';
    applyMode(saved,false);
    return true;
  }

  function makeToolsIntuitive(){
    const r=root(); if(!r)return;
    r.querySelectorAll('.at-tool,.at-btn').forEach(el=>{if(!el.getAttribute('title')&&el.textContent.trim())el.setAttribute('title',el.textContent.trim())});
    const draw=r.querySelector('.at-drawtb');
    if(draw&&!draw.querySelector('.at-draw-hint')){const h=document.createElement('span');h.className='at-draw-hint';h.textContent='Sélectionnez un outil puis cliquez sur le graphique';draw.appendChild(h)}
    const ind=r.querySelector('[onclick="atOpenIndModal()"]'); if(ind)ind.setAttribute('title','Choisir les indicateurs à afficher');
    const compare=r.querySelector('[onclick="atCompare()"]'); if(compare)compare.setAttribute('title','Comparer avec un autre titre');
  }

  function refresh(){ensureMode();makeToolsIntuitive();installCourseFallback();}

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
          if(row&&price){window.AT.ticker=ticker;window.AT.hist=[{date:row.date_seance||new Date().toISOString().slice(0,10),o:Number(row.cours_ouverture??price)||price,h:Number(row.plus_haut??price)||price,l:Number(row.plus_bas??price)||price,c:price,v:Number(row.volume)||0}];const meta=document.getElementById('atTickerMeta');if(meta)meta.textContent=`Cours actuel • ${price.toLocaleString('fr-FR')} FCFA • historique détaillé à compléter`;if(typeof atRender==='function')atRender();return true;}
        }
        return result;
      }catch(error){
        const row=findCourse(ticker),price=rowPrice(row);
        if(row&&price){window.AT.ticker=ticker;window.AT.hist=[{date:row.date_seance||new Date().toISOString().slice(0,10),o:price,h:price,l:price,c:price,v:Number(row.volume)||0}];const meta=document.getElementById('atTickerMeta');if(meta)meta.textContent=`Cours actuel • ${price.toLocaleString('fr-FR')} FCFA`;if(typeof atRender==='function')atRender();return true;}
        throw error;
      }
    };
  }

  window.atInitExperience=refresh;
  window.atSetExperienceMode=applyMode;
  document.addEventListener('click',e=>{const t=e.target.closest('#view-analyse-technique #atModeToggle');if(t)e.stopPropagation()},{capture:true});

  const boot=()=>{
    refresh();
    installTickerRecovery();
    installCourseFallback();
  };
  boot();
  const timer=setInterval(()=>{if(root()?.querySelector('.at-toolbar'))boot()},100);
  setTimeout(()=>clearInterval(timer),8000);
})();