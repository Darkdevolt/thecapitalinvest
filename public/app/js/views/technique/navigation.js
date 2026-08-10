// THE CAPITAL — Analyse technique : navigation, thème et contrôles
// UI uniquement : aucune API, endpoint ou donnée métier modifiée.

function atLoadModernTheme(){
  if(!document.getElementById('atModernCss')){
    const link=document.createElement('link');link.id='atModernCss';link.rel='stylesheet';link.href='/app/css/technique-modern.css';document.head.appendChild(link);
  }
}
function atInstallThemeToggle(){
  const view=document.getElementById('view-analyse-technique'),toolbar=view?.querySelector('.at-toolbar');
  if(!view||!toolbar||document.getElementById('atThemeToggle'))return;
  const btn=document.createElement('button');btn.id='atThemeToggle';btn.type='button';btn.className='at-theme-toggle';btn.innerHTML='<span>Mode clair</span><span class="at-switch" aria-hidden="true"></span>';btn.setAttribute('aria-label','Activer ou désactiver le mode clair');
  const saved=localStorage.getItem('tc-at-theme');
  const set=(light,save=true)=>{view.classList.toggle('at-light',light);btn.querySelector('span:first-child').textContent=light?'Mode sombre':'Mode clair';btn.setAttribute('aria-pressed',String(light));if(save)localStorage.setItem('tc-at-theme',light?'light':'dark');if(typeof atRender==='function'&&window.AT?.hist?.length)setTimeout(()=>atRender(),0)};
  btn.addEventListener('click',()=>set(!view.classList.contains('at-light')));toolbar.appendChild(btn);set(saved==='light',false);
}
function atCleanTechnicalLabels(){
  const replacements={'📥 PNG':'PNG','📄 Rapport':'Rapport','⛶ Focus':'Focus','🌀 Fibonacci':'Fibonacci','⑂ Pitchfork':'Pitchfork','🗑 Effacer tout':'Effacer tout','🌀':'Fib','⑂':'Pitch','🗑':'Effacer'};
  document.querySelectorAll('#view-analyse-technique button,#view-analyse-technique .at-tool').forEach(el=>{let t=el.textContent.trim();if(replacements[t])el.textContent=replacements[t]});
}
function atInitNavigation(){
  atLoadModernTheme();
  const chart=document.getElementById('atMainChart'),sel=document.getElementById('atTicker');
  if(sel)sel.onchange=()=>{if(sel.value&&typeof atLoadTicker==='function')atLoadTicker()};
  if(chart&&!document.getElementById('atNavBar')){
    const nav=document.createElement('div');nav.id='atNavBar';nav.innerHTML='<div class="at-nav-group"><button class="at-nav-btn" type="button" onclick="atZoomIn()" title="Zoomer">+</button><button class="at-nav-btn" type="button" onclick="atZoomOut()" title="Dézoomer">−</button><button class="at-nav-btn" type="button" onclick="atZoomReset()" title="Réinitialiser">100%</button></div><div class="at-nav-sep"></div><div class="at-nav-group"><button class="at-nav-btn" type="button" onclick="atPanLeft()" title="Période précédente">‹</button><button class="at-nav-btn" type="button" onclick="atPanRight()" title="Période suivante">›</button><button class="at-nav-btn" type="button" onclick="atGoToEnd()" title="Dernières données">FIN</button></div>';nav.style.cssText='position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;background:rgba(10,8,4,.92);border:1px solid rgba(184,150,78,.24);border-radius:9px;padding:5px;z-index:50;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.25);';chart.appendChild(nav);
  }
  atInstallThemeToggle();atCleanTechnicalLabels();
}
window.atInitNav=atInitNavigation;window.atInitNavigation=atInitNavigation;
function atZoomIn(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,n=Math.max(.05,r*.8),c=(AT.zoom.start+AT.zoom.end)/2;AT.zoom.start=Math.max(0,c-n/2);AT.zoom.end=Math.min(1,c+n/2);atRender()}
function atZoomOut(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,n=Math.min(1,r*1.25),c=(AT.zoom.start+AT.zoom.end)/2;AT.zoom.start=Math.max(0,c-n/2);AT.zoom.end=Math.min(1,c+n/2);atRender()}
function atZoomReset(){if(!window.AT)return;AT.zoom={start:0,end:1};atRender()}
function atPanLeft(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,s=r*.2;if(AT.zoom.start>0){AT.zoom.start=Math.max(0,AT.zoom.start-s);AT.zoom.end=Math.min(1,AT.zoom.start+r);atRender()}}
function atPanRight(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,s=r*.2;if(AT.zoom.end<1){AT.zoom.end=Math.min(1,AT.zoom.end+s);AT.zoom.start=Math.max(0,AT.zoom.end-r);atRender()}}
function atGoToEnd(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start;AT.zoom.end=1;AT.zoom.start=Math.max(0,1-r);atRender()}
function atTransitionRender(){const w=document.getElementById('atWrap');if(!w)return atRender();w.style.opacity='.55';w.style.transform='scale(.995)';setTimeout(()=>{atRender();w.style.opacity='1';w.style.transform='scale(1)'},120)}
