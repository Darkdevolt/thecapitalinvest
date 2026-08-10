// THE CAPITAL — Analyse technique : navigation, thème et expérience
// UI uniquement : aucune API, endpoint ou donnée métier modifiée.
function atLoadModernTheme(){
  if(!document.getElementById('atModernCss')){const link=document.createElement('link');link.id='atModernCss';link.rel='stylesheet';link.href='/app/css/technique-modern.css';document.head.appendChild(link)}
  if(!document.getElementById('atExperienceCss')){const link=document.createElement('link');link.id='atExperienceCss';link.rel='stylesheet';link.href='/app/css/technique-experience.css';document.head.appendChild(link)}
  if(!document.getElementById('atExperienceJs')){const s=document.createElement('script');s.id='atExperienceJs';s.src='/app/js/views/technique/experience.js';s.onload=()=>window.atInitExperience?.();document.head.appendChild(s)} else window.atInitExperience?.();
}
function atInstallThemeToggle(){
  const view=document.getElementById('view-analyse-technique'),toolbar=view?.querySelector('.at-toolbar');if(!view||!toolbar||document.getElementById('atThemeToggle'))return;
  const btn=document.createElement('button');btn.id='atThemeToggle';btn.type='button';btn.className='at-theme-toggle';btn.innerHTML='<span>Mode clair</span><span class="at-switch" aria-hidden="true"></span>';btn.setAttribute('aria-label','Activer ou désactiver le mode clair');
  const saved=localStorage.getItem('tc-at-theme');const set=(light,save=true)=>{view.classList.toggle('at-light',light);btn.querySelector('span:first-child').textContent=light?'Mode sombre':'Mode clair';btn.setAttribute('aria-pressed',String(light));if(save)localStorage.setItem('tc-at-theme',light?'light':'dark');if(typeof atRender==='function'&&window.AT?.hist?.length)setTimeout(()=>atRender(),0)};
  btn.addEventListener('click',()=>set(!view.classList.contains('at-light')));toolbar.appendChild(btn);set(saved==='light',false);
}
function atCleanTechnicalLabels(){const replacements={'📥 PNG':'PNG','📄 Rapport':'Rapport','⛶ Focus':'Focus','🌀 Fibonacci':'Fibonacci','⑂ Pitchfork':'Pitchfork','🗑 Effacer tout':'Effacer tout','🌀':'Fib','⑂':'Pitch','🗑':'Effacer'};document.querySelectorAll('#view-analyse-technique button,#view-analyse-technique .at-tool').forEach(el=>{const t=el.textContent.trim();if(replacements[t])el.textContent=replacements[t]})}
function atInitNavigation(){
  atLoadModernTheme();
  const chart=document.getElementById('atMainChart');
  if(chart&&!document.getElementById('atNavBar')){const nav=document.createElement('div');nav.id='atNavBar';nav.className='at-nav-bar';nav.innerHTML='<div class="at-nav-group"><button class="at-nav-btn" type="button" onclick="atZoomIn()" title="Zoomer">+</button><button class="at-nav-btn" type="button" onclick="atZoomOut()" title="Dézoomer">−</button><button class="at-nav-btn" type="button" onclick="atZoomReset()" title="Réinitialiser">100%</button></div><div class="at-nav-sep"></div><div class="at-nav-group"><button class="at-nav-btn" type="button" onclick="atPanLeft()" title="Période précédente">‹</button><button class="at-nav-btn" type="button" onclick="atPanRight()" title="Période suivante">›</button><button class="at-nav-btn" type="button" onclick="atGoToEnd()" title="Dernières données">FIN</button></div>';chart.appendChild(nav)}
  atInstallThemeToggle();atCleanTechnicalLabels();window.atInitExperience?.();
}
window.atInitNav=atInitNavigation;window.atInitNavigation=atInitNavigation;
function atZoomIn(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,n=Math.max(.05,r*.8),c=(AT.zoom.start+AT.zoom.end)/2;AT.zoom.start=Math.max(0,c-n/2);AT.zoom.end=Math.min(1,c+n/2);atRender()}
function atZoomOut(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,n=Math.min(1,r*1.25),c=(AT.zoom.start+AT.zoom.end)/2;AT.zoom.start=Math.max(0,c-n/2);AT.zoom.end=Math.min(1,c+n/2);atRender()}
function atZoomReset(){if(!window.AT)return;AT.zoom={start:0,end:1};atRender()}
function atPanLeft(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,s=r*.2;if(AT.zoom.start>0){AT.zoom.start=Math.max(0,AT.zoom.start-s);AT.zoom.end=Math.min(1,AT.zoom.start+r);atRender()}}
function atPanRight(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,s=r*.2;if(AT.zoom.end<1){AT.zoom.end=Math.min(1,AT.zoom.end+s);AT.zoom.start=Math.max(0,AT.zoom.end-r);atRender()}}
function atGoToEnd(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start;AT.zoom.end=1;AT.zoom.start=Math.max(0,1-r);atRender()}
function atTransitionRender(){const w=document.getElementById('atWrap');if(!w)return atRender();w.style.opacity='.55';w.style.transform='scale(.995)';setTimeout(()=>{atRender();w.style.opacity='1';w.style.transform='scale(1)'},120)}
