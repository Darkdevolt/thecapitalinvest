// THE CAPITAL — Analyse technique PRO tools
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
    const AT = window.AT; const el = chart();
    if(!AT || !el) return;
    const rect = el.getBoundingClientRect();
    const px = clamp((clientX - rect.left) / Math.max(1,rect.width),0,1);
    const py = clamp((clientY - rect.top) / Math.max(1,rect.height),0,1);
    const oldStart = Number(AT.zoom?.start ?? 0), oldEnd = Number(AT.zoom?.end ?? 1);
    const oldRange = Math.max(.01, oldEnd-oldStart);
    const newRange = clamp(oldRange*factor,.04,1);
    const anchor = oldStart + oldRange*px;
    AT.zoom.start = clamp(anchor-newRange*px,0,1-newRange);
    AT.zoom.end = AT.zoom.start + newRange;
    render();
  }

  function panByPixels(dx){
    const AT=window.AT; const el=chart();
    if(!AT||!el) return;
    const r=el.getBoundingClientRect();
    const range=Math.max(.01,(AT.zoom?.end??1)-(AT.zoom?.start??0));
    const shift=(dx/Math.max(1,r.width))*range;
    const start=clamp((AT.zoom?.start??0)-shift,0,1-range);
    AT.zoom.start=start; AT.zoom.end=start+range;
    render();
  }

  function installPointerNavigation(){
    const el=chart(); if(!el || el.dataset.atProNav==='1') return;
    el.dataset.atProNav='1';
    el.style.touchAction='none';
    let drag=null, pinch=null;

    el.addEventListener('wheel',function(e){
      if(!isPro()) return;
      e.preventDefault();
      zoomAt(e.deltaY>0?1.12:.88,e.clientX,e.clientY);
    },{passive:false});

    el.addEventListener('pointerdown',function(e){
      if(!isPro() || !window.AT) return;
      if(window.AT.drawMode && window.AT.drawMode !== 'cursor') return;
      if(e.pointerType==='touch'){
        if(!pinch) pinch={};
        pinch[e.pointerId]={x:e.clientX,y:e.clientY};
        const ids=Object.keys(pinch);
        if(ids.length===2){
          const a=pinch[ids[0]],b=pinch[ids[1]];
          pinch.distance=Math.hypot(a.x-b.x,a.y-b.y);
        }
        return;
      }
      drag={id:e.pointerId,x:e.clientX};
      try{el.setPointerCapture(e.pointerId);}catch(_){ }
      e.preventDefault();
    },{passive:false});

    el.addEventListener('pointermove',function(e){
      if(!isPro()) return;
      if(e.pointerType==='touch' && pinch){
        if(pinch[e.pointerId]) pinch[e.pointerId]={x:e.clientX,y:e.clientY};
        const ids=Object.keys(pinch).filter(k=>k!=='distance');
        if(ids.length===2){
          const a=pinch[ids[0]],b=pinch[ids[1]];
          const d=Math.hypot(a.x-b.x,a.y-b.y);
          if(pinch.distance){
            const centerX=(a.x+b.x)/2;
            const centerY=(a.y+b.y)/2;
            zoomAt(pinch.distance/d,centerX,centerY);
          }
          pinch.distance=d;
          e.preventDefault();
        }
        return;
      }
      if(!drag || drag.id!==e.pointerId) return;
      const dx=e.clientX-drag.x;
      if(Math.abs(dx)>0.5){ panByPixels(dx); drag.x=e.clientX; e.preventDefault(); }
    },{passive:false});

    const end=e=>{
      if(pinch){ delete pinch[e.pointerId]; if(Object.keys(pinch).filter(k=>k!=='distance').length<2) delete pinch.distance; }
      if(drag&&drag.id===e.pointerId){ try{el.releasePointerCapture(e.pointerId);}catch(_){ } drag=null; }
    };
    el.addEventListener('pointerup',end,{passive:true});
    el.addEventListener('pointercancel',end,{passive:true});
    el.addEventListener('dblclick',function(e){ if(isPro()){ e.preventDefault(); if(typeof window.atZoomReset==='function')window.atZoomReset(); } });
  }

  function persistKey(){ return 'tc-at-drawings-v2:'+String(window.AT?.ticker||'').trim().toUpperCase(); }
  function saveDrawings(){
    if(!window.AT?.ticker || !Array.isArray(window.AT.draws)) return;
    try{ localStorage.setItem(persistKey(),JSON.stringify(window.AT.draws.slice(0,200))); }catch(e){}
  }
  function restoreDrawings(){
    if(!window.AT?.ticker) return;
    try{
      const raw=localStorage.getItem(persistKey());
      if(!raw)return;
      const data=JSON.parse(raw);
      if(Array.isArray(data)) window.AT.draws=data;
    }catch(e){}
  }

  function patchDrawingPersistence(){
    if(window.__atDrawingPersistencePatched) return;
    window.__atDrawingPersistencePatched=true;
    const originalRender=window.atRender;
    if(typeof originalRender==='function'){
      window.atRender=function(){ const result=originalRender.apply(this,arguments); if(isPro())saveDrawings(); return result; };
    }
    const originalLoad=window.atLoadTicker;
    if(typeof originalLoad==='function'){
      window.atLoadTicker=async function(){
        const result=await originalLoad.apply(this,arguments);
        if(result!==false){ restoreDrawings(); render(); }
        return result;
      };
    }
    window.addEventListener('tc:at-experience-change',function(){
      if(isPro()){ restoreDrawings(); render(); }
    });
  }

  function enhanceDrawingTools(){
    const r=root(); if(!r) return;
    r.querySelectorAll('.at-drawtb .at-btn,.at-left .at-tool').forEach(btn=>{
      if(!btn.title) btn.title=btn.textContent.trim();
      btn.setAttribute('aria-label',btn.title||btn.textContent.trim());
    });
    const draw=r.querySelector('.at-drawtb');
    if(draw){
      draw.style.touchAction='pan-x';
      draw.style.overflowX='auto';
      draw.style.overscrollBehaviorX='contain';
    }
  }

  function boot(){
    if(!root()) return;
    installPointerNavigation();
    patchDrawingPersistence();
    enhanceDrawingTools();
  }

  window.atInitProTools=boot;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  window.addEventListener('tc:at-experience-change',()=>setTimeout(boot,0));
  const timer=setInterval(boot,250);
  setTimeout(()=>clearInterval(timer),10000);
})();
