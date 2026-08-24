// THE CAPITAL, Analyse technique : navigation, thèmes, expérience et résolution ticker
// UI / front-end uniquement : aucune API, endpoint, Supabase ou donnée métier modifiée.
function atLoadModernTheme(){
  if(!document.getElementById('atModernCss')){const link=document.createElement('link');link.id='atModernCss';link.rel='stylesheet';link.href='/app/css/technique-modern.css';document.head.appendChild(link)}
  if(!document.getElementById('atExperienceCss')){const link=document.createElement('link');link.id='atExperienceCss';link.rel='stylesheet';link.href='/app/css/technique-experience.css';document.head.appendChild(link)}
  // Les trois modules complementaires — experience, data-bridge et pro-tools —
  // etaient injectes ici par createElement('script'). Trois consequences :
  //
  //   1. Chacun enveloppe atLoadTicker et atRender. L'ordre d'enveloppement
  //      dependait de la latence reseau, donc du jour : la chaine d'appels
  //      n'etait jamais deux fois la meme.
  //   2. experience.js etait charge deux fois, ici sans version et par
  //      init.js avec ?v=3. Deux URL distinctes, donc deux evaluations que
  //      la garde par identifiant DOM ne pouvait pas rattraper.
  //   3. Un module absent ou lent laissait la vue dans un etat intermediaire
  //      sans que rien ne le signale.
  //
  // Ils sont desormais declares dans app.html, dans un ordre fixe. Il ne
  // reste ici qu'a declencher leur initialisation, si elle existe.
  if(typeof window.atInitExperience==='function')window.atInitExperience();
  if(typeof window.atInitProTools==='function')window.atInitProTools();
}
function atInstallThemeToggle(){
  const view=document.getElementById('view-analyse-technique'),toolbar=view?.querySelector('.at-toolbar');if(!view||!toolbar||document.getElementById('atThemeToggle'))return;
  const btn=document.createElement('button');btn.id='atThemeToggle';btn.type='button';btn.className='at-theme-toggle';btn.innerHTML='<span>Mode clair</span><span class="at-switch" aria-hidden="true"></span>';btn.setAttribute('aria-label','Activer ou désactiver le mode clair');
  const saved=localStorage.getItem('tc-at-theme');const set=(light,save=true)=>{view.classList.toggle('at-light',light);btn.querySelector('span:first-child').textContent=light?'Mode sombre':'Mode clair';btn.setAttribute('aria-pressed',String(light));if(save)localStorage.setItem('tc-at-theme',light?'light':'dark');if(typeof atRender==='function'&&window.AT?.hist?.length)setTimeout(()=>atRender(),0)};
  btn.addEventListener('click',()=>set(!view.classList.contains('at-light')));toolbar.appendChild(btn);set(saved==='light',false);
}
function atCleanTechnicalLabels(){const replacements={'📥 PNG':'PNG','📄 Rapport':'Rapport','⛶ Focus':'Focus','🌀 Fibonacci':'Fibonacci','⑂ Pitchfork':'Pitchfork','🗑 Effacer tout':'Effacer tout','🌀':'Fib','⑂':'Pitch','🗑':'Effacer'};document.querySelectorAll('#view-analyse-technique button,#view-analyse-technique .at-tool').forEach(el=>{const t=el.textContent.trim();if(replacements[t])el.textContent=replacements[t]})}
function atNormTicker(v){return String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,'');}
function atRowTicker(row){if(!row)return '';return atNormTicker(row.ticker||row.symbol||row.symbole||row.code||row.valeur||row.instrument);}
function atRowName(row){if(!row)return '';return String(row.nom||row.libelle||row.entreprise||row.raison_sociale||row.name||'').trim();}
function atRowPrice(row){if(!row)return 0;const candidates=[row.cours,row.cloture,row.cours_cloture,row.close,row.prix,row.last,row.last_price,row.price];for(const v of candidates){const n=typeof v==='string'?Number(v.replace(/\s/g,'').replace(/\./g,'').replace(',','.')):+v;if(Number.isFinite(n)&&n>0)return n}return 0;}
function atResolveCourseRow(requested){const q=atNormTicker(requested);if(!q)return null;const rows=Array.isArray(window.allCours)?window.allCours:[];let row=rows.find(r=>atRowTicker(r)===q);if(row)return row;row=rows.find(r=>atNormTicker(atRowName(r))===q);if(row)return row;const qCompact=q.replace(/[^A-Z0-9]/g,'');return rows.find(r=>{const t=atNormTicker(atRowTicker(r)).replace(/[^A-Z0-9]/g,'');const n=atNormTicker(atRowName(r)).replace(/[^A-Z0-9]/g,'');return t===qCompact||n===qCompact||t.includes(qCompact)||n.includes(qCompact)})||null;}
function atEnsureTickerBridge(){if(window.__atTickerBridgeInstalled)return;if(typeof window.atLoadTicker!=='function')return;const original=window.atLoadTicker;window.__atTickerBridgeInstalled=true;window.atLoadTicker=async function(){const sel=document.getElementById('atTicker');const requested=sel?.value||window.AT?.ticker||'';const row=atResolveCourseRow(requested);const canonical=atRowTicker(row)||atNormTicker(requested);if(row&&sel&&canonical){let option=Array.from(sel.options).find(o=>atNormTicker(o.value)===canonical);if(!option){option=document.createElement('option');option.value=canonical;option.textContent=canonical+(atRowName(row)?', '+atRowName(row):'');sel.appendChild(option)}sel.value=canonical;}const ok=await original();if(ok)return true;const fallback=atResolveCourseRow(canonical||requested);const px=atRowPrice(fallback);if(fallback&&px>0&&window.AT){const date=fallback.date_seance||fallback.date||new Date().toISOString().slice(0,10);window.AT.ticker=canonical||requested;window.AT.hist=[{date,o:px,h:px,l:px,c:px,v:Number(fallback.volume||fallback.vol||0)||0}];window.AT.zoom={start:0,end:1};const tickerEl=document.getElementById('atOhlcTicker');if(tickerEl)tickerEl.textContent=window.AT.ticker;const meta=document.getElementById('atTickerMeta');if(meta)meta.textContent=`Cours actuel ${px.toLocaleString('fr-FR')} FCFA • historique détaillé non disponible pour ce code`;if(typeof atRender==='function')atRender();if(typeof window.toast==='function')window.toast(`Cours ${window.AT.ticker} chargé depuis les cours de marché.`,'success');return true;}return false;};}
function atInitNavigation(){atLoadModernTheme();atEnsureTickerBridge();const chart=document.getElementById('atMainChart');if(chart&&!document.getElementById('atNavBar')){const nav=document.createElement('div');nav.id='atNavBar';nav.className='at-nav-bar';nav.innerHTML='<div class="at-nav-group"><button class="at-nav-btn" type="button" onclick="atZoomIn()" title="Zoomer">+</button><button class="at-nav-btn" type="button" onclick="atZoomOut()" title="Dézoomer">−</button><button class="at-nav-btn" type="button" onclick="atZoomReset()" title="Réinitialiser">100%</button></div><div class="at-nav-sep"></div><div class="at-nav-group"><button class="at-nav-btn" type="button" onclick="atPanLeft()" title="Période précédente">‹</button><button class="at-nav-btn" type="button" onclick="atPanRight()" title="Période suivante">›</button><button class="at-nav-btn" type="button" onclick="atGoToEnd()" title="Dernières données">FIN</button></div>';chart.appendChild(nav)}atInstallThemeToggle();atCleanTechnicalLabels();window.atInitExperience?.();window.atInitProTools?.();}
window.atInitNav=atInitNavigation;window.atInitNavigation=atInitNavigation;
function atZoomIn(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,n=Math.max(.05,r*.8),c=(AT.zoom.start+AT.zoom.end)/2;AT.zoom.start=Math.max(0,c-n/2);AT.zoom.end=Math.min(1,c+n/2);atRender()}
function atZoomOut(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,n=Math.min(1,r*1.25),c=(AT.zoom.start+AT.zoom.end)/2;AT.zoom.start=Math.max(0,c-n/2);AT.zoom.end=Math.min(1,c+n/2);atRender()}
function atZoomReset(){if(!window.AT)return;AT.zoom={start:0,end:1};atRender()}
function atPanLeft(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,s=r*.2;if(AT.zoom.start>0){AT.zoom.start=Math.max(0,AT.zoom.start-s);AT.zoom.end=Math.min(1,AT.zoom.start+r);atRender()}}
function atPanRight(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start,s=r*.2;if(AT.zoom.end<1){AT.zoom.end=Math.min(1,AT.zoom.end+s);AT.zoom.start=Math.max(0,AT.zoom.end-r);atRender()}}
function atGoToEnd(){if(!window.AT)return;const r=AT.zoom.end-AT.zoom.start;AT.zoom.end=1;AT.zoom.start=Math.max(0,1-r);atRender()}
function atTransitionRender(){const w=document.getElementById('atWrap');if(!w)return atRender();w.style.opacity='.55';w.style.transform='scale(.995)';setTimeout(()=>{atRender();w.style.opacity='1';w.style.transform='scale(1)'},120)}