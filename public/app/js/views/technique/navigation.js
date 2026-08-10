// THE CAPITAL — Analyse technique : navigation et sélection du titre
// UI uniquement : aucune API, endpoint ou donnée métier modifiée.

function atInitNavigation(){
  const chart=document.getElementById('atMainChart');
  if(chart&&!document.getElementById('atNavBar')){
    const nav=document.createElement('div');nav.id='atNavBar';
    nav.innerHTML='<div class="at-nav-group"><button class="at-nav-btn" type="button" onclick="atZoomIn()" title="Zoomer">+</button><button class="at-nav-btn" type="button" onclick="atZoomOut()" title="Dézoomer">−</button><button class="at-nav-btn" type="button" onclick="atZoomReset()" title="Réinitialiser">100%</button></div><div class="at-nav-sep"></div><div class="at-nav-group"><button class="at-nav-btn" type="button" onclick="atPanLeft()" title="Période précédente">‹</button><button class="at-nav-btn" type="button" onclick="atPanRight()" title="Période suivante">›</button><button class="at-nav-btn" type="button" onclick="atGoToEnd()" title="Dernières données">FIN</button></div>';
    nav.style.cssText='position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;background:rgba(10,8,4,.92);border:1px solid rgba(184,150,78,.24);border-radius:9px;padding:5px;z-index:50;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.25);';
    chart.appendChild(nav);
  }
  atEnhanceTickerPicker();
}

// Compatibilité avec index.js : l'ancien nom était atInitNav.
window.atInitNav=atInitNavigation;
window.atInitNavigation=atInitNavigation;

function atEnhanceTickerPicker(){
  const select=document.getElementById('atTicker');
  if(!select||select.dataset.tcEnhanced==='1') return;
  select.dataset.tcEnhanced='1';

  const parent=select.parentElement||select;
  const search=document.createElement('input');
  search.id='atTickerSearch';search.type='search';search.autocomplete='off';
  search.placeholder='Rechercher un titre…';
  search.setAttribute('aria-label','Rechercher un ticker');
  search.style.cssText='width:100%;box-sizing:border-box;margin:0 0 7px;padding:9px 11px;background:rgba(255,255,255,.025);border:1px solid rgba(184,150,78,.18);border-radius:7px;color:var(--cream);font:500 11px var(--mono);outline:none;';
  parent.insertBefore(search,select);

  const original=Array.from(select.options).map(o=>({value:o.value,text:o.textContent}));
  const rebuild=(q='')=>{
    const query=q.trim().toUpperCase();
    const current=select.value;
    const list=original.filter(o=>!query||o.value.toUpperCase().includes(query)||o.text.toUpperCase().includes(query));
    select.innerHTML='';
    list.forEach(o=>{const opt=document.createElement('option');opt.value=o.value;opt.textContent=o.text;select.appendChild(opt)});
    if(list.some(o=>o.value===current)) select.value=current;
  };

  search.addEventListener('input',()=>rebuild(search.value));
  search.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      const first=Array.from(select.options).find(o=>o.value);
      if(first){select.value=first.value;select.dispatchEvent(new Event('change',{bubbles:true}));}
    }
  });
  select.addEventListener('change',()=>{
    if(select.value&&typeof window.atLoadTicker==='function') window.atLoadTicker();
  });

  // Sur mobile, le select natif reste le contrôle principal : le champ de recherche
  // sert simplement à réduire rapidement la liste sans remplacer le comportement natif.
}

function atZoomIn(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,n=Math.max(.05,r*.8),c=(AT.zoom.start+AT.zoom.end)/2;AT.zoom.start=Math.max(0,c-n/2);AT.zoom.end=Math.min(1,c+n/2);atRender()}
function atZoomOut(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,n=Math.min(1,r*1.25),c=(AT.zoom.start+AT.zoom.end)/2;AT.zoom.start=Math.max(0,c-n/2);AT.zoom.end=Math.min(1,c+n/2);atRender()}
function atZoomReset(){if(!window.AT)return;AT.zoom={start:0,end:1};atRender()}
function atPanLeft(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,s=r*.2;if(AT.zoom.start>0){AT.zoom.start=Math.max(0,AT.zoom.start-s);AT.zoom.end=Math.min(1,AT.zoom.start+r);atRender()}}
function atPanRight(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,s=r*.2;if(AT.zoom.end<1){AT.zoom.end=Math.min(1,AT.zoom.end+s);AT.zoom.start=Math.max(0,AT.zoom.end-r);atRender()}}
function atGoToEnd(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start;AT.zoom.end=1;AT.zoom.start=Math.max(0,1-r);atRender()}
function atTransitionRender(){const w=document.getElementById('atWrap');if(!w)return atRender();w.style.opacity='.55';w.style.transform='scale(.995)';setTimeout(()=>{atRender();w.style.opacity='1';w.style.transform='scale(1)'},120)}
