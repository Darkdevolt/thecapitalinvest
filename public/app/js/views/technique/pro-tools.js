// THE CAPITAL, Analyse technique PRO tools
// Isolé à la vue Analyse technique. Ne modifie aucune API, donnée métier ou autre vue.
(function(){
  'use strict';
  if(window.__atProToolsLoaded) return;
  window.__atProToolsLoaded = true;

  const root = () => document.getElementById('view-analyse-technique');
  const chart = () => document.getElementById('atOverlay') || document.getElementById('cvMain');
  const isPro = () => root()?.getAttribute('data-experience-mode') === 'pro';
  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
  function render(){ if(typeof window.atRender === 'function') { try{ window.atRender(); }catch(e){ console.warn('[AT PRO] render',e); } } }

  function zoomAt(factor, clientX, clientY){
    const AT = window.AT; const el = chart(); if(!AT || !el) return;
    const rect = el.getBoundingClientRect();
    const px = clamp((clientX - rect.left) / Math.max(1,rect.width),0,1);
    const oldStart = Number(AT.zoom?.start ?? 0), oldEnd = Number(AT.zoom?.end ?? 1);
    const oldRange = Math.max(.01, oldEnd-oldStart), newRange = clamp(oldRange*factor,.04,1);
    const anchor = oldStart + oldRange*px;
    AT.zoom.start = clamp(anchor-newRange*px,0,1-newRange); AT.zoom.end = AT.zoom.start + newRange; render();
  }
  function panByPixels(dx){
    const AT=window.AT, el=chart(); if(!AT||!el)return;
    const r=el.getBoundingClientRect(), range=Math.max(.01,(AT.zoom?.end??1)-(AT.zoom?.start??0));
    const shift=(dx/Math.max(1,r.width))*range, start=clamp((AT.zoom?.start??0)-shift,0,1-range);
    AT.zoom.start=start; AT.zoom.end=start+range; render();
  }
  function installPointerNavigation(){
    const el=chart(); if(!el || el.dataset.atProNav==='1') return; el.dataset.atProNav='1'; el.style.touchAction='none';
    let drag=null, pinch=null;
    el.addEventListener('wheel',e=>{if(!isPro())return;e.preventDefault();zoomAt(e.deltaY>0?1.12:.88,e.clientX,e.clientY)},{passive:false});
    el.addEventListener('pointerdown',e=>{
      if(!isPro()||!window.AT)return;
      if(window.AT.drawMode&&window.AT.drawMode!=='cursor')return;
      if(e.pointerType==='touch'){if(!pinch)pinch={};pinch[e.pointerId]={x:e.clientX,y:e.clientY};const ids=Object.keys(pinch);if(ids.length===2){const a=pinch[ids[0]],b=pinch[ids[1]];pinch.distance=Math.hypot(a.x-b.x,a.y-b.y)}return;}
      drag={id:e.pointerId,x:e.clientX};try{el.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault();
    },{passive:false});
    el.addEventListener('pointermove',e=>{
      if(!isPro())return;
      if(e.pointerType==='touch'&&pinch){if(pinch[e.pointerId])pinch[e.pointerId]={x:e.clientX,y:e.clientY};const ids=Object.keys(pinch).filter(k=>k!=='distance');if(ids.length===2){const a=pinch[ids[0]],b=pinch[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch.distance){const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;zoomAt(pinch.distance/d,cx,cy)}pinch.distance=d;e.preventDefault()}return;}
      if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>.5){panByPixels(dx);drag.x=e.clientX;e.preventDefault()}
    },{passive:false});
    const end=e=>{if(pinch){delete pinch[e.pointerId];if(Object.keys(pinch).filter(k=>k!=='distance').length<2)delete pinch.distance}if(drag&&drag.id===e.pointerId){try{el.releasePointerCapture(e.pointerId)}catch(_){}drag=null}};
    el.addEventListener('pointerup',end,{passive:true});el.addEventListener('pointercancel',end,{passive:true});
    el.addEventListener('dblclick',e=>{if(isPro()){e.preventDefault();if(typeof window.atZoomReset==='function')window.atZoomReset()} });
  }

  function persistKey(){return 'tc-at-drawings-v2:'+String(window.AT?.ticker||'').trim().toUpperCase()}
  function saveDrawings(){if(!window.AT?.ticker||!Array.isArray(window.AT.draws))return;try{localStorage.setItem(persistKey(),JSON.stringify(window.AT.draws.slice(0,200)))}catch(e){}}
  function restoreDrawings(){if(!window.AT?.ticker)return;try{const raw=localStorage.getItem(persistKey());if(!raw)return;const data=JSON.parse(raw);if(Array.isArray(data))window.AT.draws=data}catch(e){}}
  function patchDrawingPersistence(){
    if(window.__atDrawingPersistencePatched)return;window.__atDrawingPersistencePatched=true;
    const originalRender=window.atRender;if(typeof originalRender==='function')window.atRender=function(){const result=originalRender.apply(this,arguments);if(isPro())saveDrawings();return result};
    const originalLoad=window.atLoadTicker;if(typeof originalLoad==='function')window.atLoadTicker=async function(){const result=await originalLoad.apply(this,arguments);if(result!==false){restoreDrawings();render()}return result};
    window.addEventListener('tc:at-experience-change',()=>{if(isPro()){restoreDrawings();render()}});
  }

  /* ── Gestion intuitive des éléments ajoutés ─────────────────────────── */
  function injectManagerStyles(){
    if(document.getElementById('at-elements-manager-style'))return;
    const s=document.createElement('style');s.id='at-elements-manager-style';s.textContent=`
      .at-elements-manager{margin:8px 0 12px;padding:12px 14px;border:1px solid rgba(184,150,78,.18);border-radius:12px;background:rgba(184,150,78,.035);display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:var(--sans,Arial,sans-serif)}
      .at-elements-manager .at-em-title{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim,#888);font-weight:600;margin-right:2px}
      .at-em-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(184,150,78,.16);background:rgba(255,255,255,.025);color:var(--cream,#eee);border-radius:999px;padding:5px 8px 5px 10px;font-size:11px}
      .at-em-chip button{width:18px;height:18px;border:0;border-radius:50%;background:rgba(248,113,113,.1);color:#f87171;cursor:pointer;line-height:18px;padding:0;font-size:13px}.at-em-chip button:hover{background:#f87171;color:#160b0b}
      .at-em-action{border:1px solid rgba(184,150,78,.2);background:transparent;color:var(--muted,#aaa);border-radius:7px;padding:6px 9px;font-size:10px;cursor:pointer;transition:.18s}.at-em-action:hover{color:var(--cream,#fff);border-color:var(--gold,#b8964e);background:rgba(184,150,78,.07)}
      .at-em-empty{font-size:11px;color:var(--dim,#777)}
      .at-draw-hint{font-size:10px;color:var(--dim,#777);margin-left:auto;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.025)}
      @media(max-width:700px){.at-em-chip{font-size:10px}.at-em-action{font-size:9px}.at-draw-hint{width:100%;margin-left:0}}
    `;document.head.appendChild(s);
  }
  function indicatorCatalog(){return Array.isArray(window.IND_CATALOG)?window.IND_CATALOG.flatMap(g=>g.items||[]):[]}
  function refreshManager(){
    const r=root();if(!r)return;injectManagerStyles();
    let box=r.querySelector('.at-elements-manager');
    if(!box){box=document.createElement('div');box.className='at-elements-manager';const anchor=r.querySelector('.at-toolbar')||r.querySelector('.at-drawtb');if(anchor)anchor.parentNode.insertBefore(box,anchor.nextSibling);else r.prepend(box)}
    const AT=window.AT||{}, active=AT.activeInds||{};box.innerHTML='<span class="at-em-title">Éléments actifs</span>';
    let count=0;
    indicatorCatalog().forEach(item=>{if(active[item.key]?.on){count++;const chip=document.createElement('span');chip.className='at-em-chip';chip.innerHTML=`<span>${item.name}</span><button type="button" data-remove-ind="${item.key}" aria-label="Retirer ${item.name}" title="Retirer">×</button>`;box.appendChild(chip)}});
    if(Array.isArray(AT.draws)&&AT.draws.length){count++;const chip=document.createElement('span');chip.className='at-em-chip';chip.innerHTML=`<span>✎ ${AT.draws.length} dessin${AT.draws.length>1?'s':''}</span><button type="button" data-remove-last aria-label="Supprimer le dernier dessin" title="Supprimer le dernier dessin">−</button>`;box.appendChild(chip)}
    if(!count){const e=document.createElement('span');e.className='at-em-empty';e.textContent='Aucun ajout actif — votre graphique reste propre.';box.appendChild(e)}
    const reset=document.createElement('button');reset.type='button';reset.className='at-em-action';reset.textContent='Réinitialiser les indicateurs';reset.title='Désactiver tous les indicateurs';reset.addEventListener('click',()=>{Object.values(active).forEach(v=>{if(v)v.on=false});render();refreshManager()});box.appendChild(reset);
    const clear=document.createElement('button');clear.type='button';clear.className='at-em-action';clear.textContent='Effacer les dessins';clear.title='Supprimer tous les dessins du graphique';clear.addEventListener('click',()=>{if(Array.isArray(AT.draws)){AT.draws=[];saveDrawings();render();refreshManager()}});box.appendChild(clear);
  }
  function installManagerEvents(){
    const r=root();if(!r||r.dataset.atManagerEvents==='1')return;r.dataset.atManagerEvents='1';
    r.addEventListener('click',e=>{
      const ind=e.target?.closest?.('[data-remove-ind]');if(ind){e.preventDefault();const key=ind.getAttribute('data-remove-ind');if(window.AT?.activeInds?.[key])window.AT.activeInds[key].on=false;render();refreshManager();return}
      if(e.target?.closest?.('[data-remove-last]')){e.preventDefault();if(Array.isArray(window.AT?.draws)){window.AT.draws.pop();saveDrawings();render();refreshManager()}}
    });
  }
  function enhanceDrawingTools(){
    const r=root();if(!r)return;
    r.querySelectorAll('.at-drawtb .at-btn,.at-left .at-tool').forEach(btn=>{if(!btn.title)btn.title=btn.textContent.trim();btn.setAttribute('aria-label',btn.title||btn.textContent.trim())});
    const draw=r.querySelector('.at-drawtb');if(draw){draw.style.touchAction='pan-x';draw.style.overflowX='auto';draw.style.overscrollBehaviorX='contain';if(!draw.querySelector('.at-draw-hint')){const h=document.createElement('span');h.className='at-draw-hint';h.textContent='Sélectionnez un outil puis cliquez sur le graphique';draw.appendChild(h)}}
  }
  function boot(){if(!root())return;installPointerNavigation();patchDrawingPersistence();enhanceDrawingTools();installManagerEvents();refreshManager()}
  window.atInitProTools=boot;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('tc:at-experience-change',()=>setTimeout(boot,0));
  const timer=setInterval(boot,250);setTimeout(()=>clearInterval(timer),10000);
})();
