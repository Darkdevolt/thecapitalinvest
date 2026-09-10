// ═══════════════════════════════════════
// VIEW — Analyse Fondamentale Avancée
// ═══════════════════════════════════════

let _fundMethod = 'tcam';
let _fundCssLoaded = false;
let _fundLoading = null;

function ensureFundamentalStyles() {
  if (_fundCssLoaded || document.getElementById('fundamental-view-css')) return;
  const link = document.createElement('link'); link.id = 'fundamental-view-css'; link.rel = 'stylesheet';
  link.href = '/app/css/analyse-fondamentale.css?v=1'; document.head.appendChild(link); _fundCssLoaded = true;
}
function setFundMethod(method, btn) { _fundMethod = method; document.querySelectorAll('#view-analyse-fondamentale .filter-btn').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active'); loadFundAnalysis(); }
function formatFundNumber(value) { const n = Number(value); return Number.isFinite(n) ? fmtM(n) : '—'; }
function safeRate(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }

async function ensureFundamentalData(ticker) {
  const key = String(ticker || '').trim().toUpperCase();
  if (!key) return { financials: [], courses: [] };
  if (_fundLoading) return _fundLoading;
  _fundLoading = (async () => {
    let financials = (Array.isArray(window.allFinancials) ? window.allFinancials : []).filter(f => String(f?.ticker || '').toUpperCase() === key);
    let courses = (Array.isArray(window.allCours) ? window.allCours : []).filter(c => String(c?.ticker || '').toUpperCase() === key);
    const jobs = [];
    if (financials.length < 2 && typeof window.apiGetFinancials === 'function') jobs.push(window.apiGetFinancials().then(rows => { if (Array.isArray(rows)) financials = rows.filter(f => String(f?.ticker || '').toUpperCase() === key); }).catch(e => console.warn('[FUND] financials API', e)));
    if (!courses.length && typeof window.apiGetCours === 'function') jobs.push(window.apiGetCours().then(rows => { if (Array.isArray(rows)) courses = rows.filter(c => String(c?.ticker || '').toUpperCase() === key); }).catch(e => console.warn('[FUND] cours API', e)));
    await Promise.all(jobs);
    return { financials, courses };
  })();
  try { return await _fundLoading; } finally { _fundLoading = null; }
}

async function loadFundAnalysis() {
  ensureFundamentalStyles();
  const select = document.getElementById('fundTickerSelect') || document.getElementById('afTicker');
  const content = document.getElementById('fundContent');
  if (!select || !content) return;
  if ((select.options?.length || 0) <= 1 && typeof populateTickerSelects === 'function') populateTickerSelects();
  const ticker = String(select.value || '').trim().toUpperCase();
  if (!ticker) { content.innerHTML='<div class="fund-empty"><div class="fund-empty-mark">FA</div><h2>Sélectionnez un titre</h2><p>Choisissez un ticker pour afficher les données financières et la valorisation.</p></div>'; return; }
  content.innerHTML='<div class="fund-empty"><div class="fund-empty-mark">…</div><h2>Chargement des données</h2><p>Récupération des états financiers et de la dernière cotation.</p></div>';
  const data = await ensureFundamentalData(ticker);
  const fins = data.financials.slice().sort((a,b)=>Number(a.annee)-Number(b.annee));
  const cours = data.courses[0] || {};
  const cp = Number(cours.cours ?? cours.cours_cloture ?? cours.cloture ?? 0);
  if (fins.length < 2) { content.innerHTML='<div class="fund-empty"><div class="fund-empty-mark">!</div><h2>Données insuffisantes</h2><p>Il faut au moins 2 années de données financières pour calculer une tendance historique et un forecast.</p></div>'; return; }
  const annual=fins.filter(f=>f.periode==='annuel'||!f.periode);
  if (annual.length < 2) { content.innerHTML='<div class="fund-empty"><div class="fund-empty-mark">!</div><h2>Pas assez de données annuelles</h2><p>Les projections fondamentales utilisent les états financiers annuels disponibles.</p></div>'; return; }
  const years=annual.map(f=>Number(f.annee)),rn=annual.map(f=>safeRate(f.resultat_net)),ca=annual.map(f=>safeRate(f.chiffre_affaires)),fcf=annual.map(f=>safeRate(f.cash_flow_operationnel)-safeRate(f.capex));
  const tcamRN=calcTCAM(rn),tcamCA=calcTCAM(ca),tcamFCF=calcTCAM(fcf),nbForecast=3,lastY=years[years.length-1];
  let forecastRN=[],forecastCA=[],forecastFCF=[],forecastYears=[];
  if(_fundMethod==='tcam'){forecastCA=forecastSeries(ca,tcamCA,nbForecast);forecastRN=forecastSeries(rn,tcamRN,nbForecast);forecastFCF=forecastSeries(fcf,tcamFCF,nbForecast);}else{const rCA=linearRegression(years,ca),rRN=linearRegression(years,rn),rFCF=linearRegression(years,fcf);for(let i=1;i<=nbForecast;i++){const y=lastY+i;forecastYears.push(y);forecastCA.push(rCA.slope*y+rCA.intercept);forecastRN.push(rRN.slope*y+rRN.intercept);forecastFCF.push(rFCF.slope*y+rFCF.intercept);}}
  if(!forecastYears.length)for(let i=1;i<=nbForecast;i++)forecastYears.push(lastY+i);
  const wacc=parseFloat(document.getElementById('fundWACC')?.value||10)/100,growth=parseFloat(document.getElementById('fundGrowth')?.value||2)/100,nbProj=Math.max(1,Math.min(5,parseInt(document.getElementById('fundProjYears')?.value||3,10)));
  const dcfValid=Number.isFinite(wacc)&&Number.isFinite(growth)&&wacc>growth&&wacc>0;let sumPV=0,terminalValue=0,enterpriseValue=0;
  if(dcfValid){for(let i=0;i<Math.min(nbProj,forecastFCF.length);i++)sumPV+=forecastFCF[i]/Math.pow(1+wacc,i+1);const lastFCF=forecastFCF[Math.min(nbProj,forecastFCF.length)-1];terminalValue=lastFCF*(1+growth)/(wacc-growth);enterpriseValue=sumPV+terminalValue/Math.pow(1+wacc,nbProj);}
  const r2=calcR2(years,rn),relevance=evaluateRelevance(tcamRN,tcamCA,r2,rn),lastActual=annual[annual.length-1],shares=Number(lastActual.nombre_actions)||0,fairValue=dcfValid&&shares>0?enterpriseValue/shares:0,upside=fairValue>0&&cp>0?(fairValue/cp-1)*100:null,latestCA=safeRate(lastActual.chiffre_affaires),latestRN=safeRate(lastActual.resultat_net),latestFCF=fcf[fcf.length-1],margin=latestCA?latestRN/latestCA*100:null,fcfMargin=latestCA?latestFCF/latestCA*100:null;
  const tone=upside==null?'neutral':upside>=0?'positive':'negative';
  content.innerHTML=`<div class="fund-hero"><div><div class="fund-kicker">ANALYSE FONDAMENTALE · ${ticker}</div><h2>${ticker} — Lecture fondamentale</h2><p>Historique financier, croissance, hypothèses de projection et valorisation DCF.</p></div><div class="fund-market-box"><span>Cours actuel</span><strong>${cp?fmt(cp)+' FCFA':'—'}</strong><small>Dernière cotation disponible</small></div></div><div class="fund-kpi-grid"><div class="fund-kpi"><span>CA · ${lastActual.annee}</span><strong>${formatFundNumber(latestCA)}</strong><small>TCAM ${Number.isFinite(tcamCA)?tcamCA.toFixed(1)+'%':'—'}</small></div><div class="fund-kpi"><span>Résultat net</span><strong>${formatFundNumber(latestRN)}</strong><small>TCAM ${Number.isFinite(tcamRN)?tcamRN.toFixed(1)+'%':'—'}</small></div><div class="fund-kpi"><span>Marge nette</span><strong>${margin==null?'—':margin.toFixed(1)+'%'}</strong><small>FCF margin ${fcfMargin==null?'—':fcfMargin.toFixed(1)+'%'}</small></div><div class="fund-kpi"><span>Qualité du forecast</span><strong>${relevance.label}</strong><small>${relevance.reason}</small></div></div><div class="fund-toolbar card"><div class="fund-methods"><div><span class="fund-control-label">Méthode de projection</span><strong>${_fundMethod==='tcam'?'TCAM historique':'Régression linéaire'}</strong></div><div class="fund-method-switch"><button class="filter-btn ${_fundMethod==='tcam'?'active':''}" onclick="setFundMethod('tcam',this)">TCAM</button><button class="filter-btn ${_fundMethod==='regression'?'active':''}" onclick="setFundMethod('regression',this)">Régression</button></div></div></div><div class="grid-2 fund-main-grid"><div class="card"><div class="card-header"><div><div class="card-title">Hypothèses de valorisation</div></div></div><div class="card-body"><div class="fund-params"><label><span>WACC</span><input type="number" id="fundWACC" value="${(wacc*100).toFixed(1)}" step="0.1" min="1" max="30" onchange="loadFundAnalysis()"></label><label><span>Croissance LT</span><input type="number" id="fundGrowth" value="${(growth*100).toFixed(1)}" step="0.1" min="0" max="10" onchange="loadFundAnalysis()"></label><label><span>Projection</span><select id="fundProjYears" onchange="loadFundAnalysis()"><option value="3" ${nbProj===3?'selected':''}>3 ans</option><option value="5" ${nbProj===5?'selected':''}>5 ans</option></select></label></div>${dcfValid?'':'<div class="fund-warning"><strong>Hypothèses DCF invalides.</strong> Le WACC doit être strictement supérieur à la croissance LT.</div>'}</div></div><div class="card fund-valuation-card"><div class="card-header"><div><div class="card-title">Valorisation DCF</div></div></div><div class="card-body"><div class="fund-value-highlight"><span>Valeur par action</span><strong>${fairValue?fmt(fairValue)+' FCFA':'—'}</strong><b class="${tone}">${upside==null?'—':(upside>=0?'+':'')+upside.toFixed(1)+'%'}</b></div><div class="fin-row"><span class="fin-label">Valeur d’entreprise</span><span class="fin-value">${dcfValid?formatFundNumber(enterpriseValue):'—'}</span></div><div class="fin-row"><span class="fin-label">Valeur terminale</span><span class="fin-value">${dcfValid?formatFundNumber(terminalValue):'—'}</span></div><div class="fin-row"><span class="fin-label">PV des FCF</span><span class="fin-value">${dcfValid?formatFundNumber(sumPV):'—'}</span></div><div class="fin-row"><span class="fin-label">Nombre d’actions</span><span class="fin-value">${shares?fmt(shares):'—'}</span></div></div></div></div><div class="grid-2"><div class="card"><div class="card-header"><div class="card-title">Prévisions financières</div></div><div class="table-wrap"><table class="forecast-table"><thead><tr><th>Année</th><th>CA</th><th>Résultat net</th><th>FCF</th></tr></thead><tbody>${forecastYears.map((y,i)=>`<tr><td><strong>${y}</strong></td><td>${formatFundNumber(forecastCA[i])}</td><td>${formatFundNumber(forecastRN[i])}</td><td>${formatFundNumber(forecastFCF[i])}</td></tr>`).join('')}</tbody></table></div></div><div class="card"><div class="card-header"><div class="card-title">Lecture des fondamentaux</div></div><div class="card-body fund-checks"><div class="fund-check"><strong>Chiffre d’affaires</strong><p>TCAM : ${Number.isFinite(tcamCA)?tcamCA.toFixed(1)+'%':'non calculable'}.</p></div><div class="fund-check"><strong>Résultat net</strong><p>TCAM : ${Number.isFinite(tcamRN)?tcamRN.toFixed(1)+'%':'non calculable'}.</p></div><div class="fund-check"><strong>Stabilité</strong><p>R² : ${Number.isFinite(r2)?r2.toFixed(2):'—'}.</p></div><div class="fund-check"><strong>Écart au cours</strong><p>${upside==null?'Valorisation indisponible.':upside>=0?'DCF au-dessus du cours actuel.':'DCF sous le cours actuel.'}</p></div></div></div></div>`;
}
function calcTCAM(series){const values=series.map(Number);if(values.length<2)return NaN;const first=values[0],last=values[values.length-1];if(!Number.isFinite(first)||!Number.isFinite(last)||first<=0||last<0)return NaN;return(Math.pow(last/first,1/(values.length-1))-1)*100;}
function forecastSeries(series,tcamPercent,nbYears){const last=Number(series[series.length-1]);if(!Number.isFinite(last)||!Number.isFinite(tcamPercent))return Array(nbYears).fill(NaN);return Array.from({length:nbYears},(_,i)=>last*Math.pow(1+tcamPercent/100,i+1));}
function linearRegression(x,y){const n=x.length;if(n<2)return{slope:0,intercept:Number(y[y.length-1])||0};let sx=0,sy=0,sxy=0,sx2=0;for(let i=0;i<n;i++){sx+=x[i];sy+=y[i];sxy+=x[i]*y[i];sx2+=x[i]*x[i];}const den=n*sx2-sx*sx;if(!den)return{slope:0,intercept:sy/n};const slope=(n*sxy-sx*sy)/den;return{slope,intercept:(sy-slope*sx)/n};}
function calcR2(x,y){const n=x.length;if(n<3)return NaN;const r=linearRegression(x,y),ym=y.reduce((a,b)=>a+b,0)/n;let ssRes=0,ssTot=0;for(let i=0;i<n;i++){const f=r.slope*x[i]+r.intercept;ssRes+=(y[i]-f)**2;ssTot+=(y[i]-ym)**2;}return ssTot===0?1:1-ssRes/ssTot;}
function evaluateRelevance(tcamRN,tcamCA,r2,rnSeries){let score=0,reasons=[];if(isNaN(tcamRN)){score-=2;reasons.push('TCAM RN non calculable');}else if(Math.abs(tcamRN)>40){score-=2;reasons.push('TCAM RN extrême');}if(isNaN(tcamCA)){score-=1;reasons.push('TCAM CA non calculable');}if(!isNaN(r2)&&r2<0.5){score-=1;reasons.push('R² faible');}if(rnSeries.length>=3){const c=[];for(let i=1;i<rnSeries.length;i++)if(rnSeries[i-1]!==0)c.push(Math.abs(rnSeries[i]/rnSeries[i-1]-1));if(c.length&&c.reduce((a,b)=>a+b,0)/c.length>0.3){score-=1;reasons.push('Volatilité élevée');}}if(score>=-1)return{label:'Forte',reason:'Données relativement stables'};if(score===-2)return{label:'Moyenne',reason:reasons.join('; ')||'Quelques réserves'};return{label:'Faible',reason:reasons.join('; ')||'Données instables'};}
window.setFundMethod=setFundMethod; window.loadFundAnalysis=loadFundAnalysis;
// Le routeur cherche renderMap['analyse-fondamentale'] = 'renderAnalyseFondamentale'.
window.renderAnalyseFondamentale=function(){
  try{ensureFundamentalStyles();}catch(e){}
  if(typeof populateTickerSelects==='function'){try{populateTickerSelects();}catch(e){}}
  try{loadFundAnalysis();}catch(e){console.warn('[FOND] render',e);}
};