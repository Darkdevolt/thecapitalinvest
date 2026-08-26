// ═══════════════════════════════════════
// UI — tables, shared loading and rendering
// ═══════════════════════════════════════

function sortTable(tbodyId, colIndex) {
  const tbody=document.getElementById(tbodyId); if(!tbody)return;
  const rows=Array.from(tbody.querySelectorAll('tr')); const key=tbodyId+'-'+colIndex;
  const dir=_sortState[key]==='asc'?'desc':'asc'; _sortState[key]=dir;
  rows.sort((a,b)=>{let av=a.cells[colIndex]?.textContent.trim()||'',bv=b.cells[colIndex]?.textContent.trim()||'';let an=parseFloat(av.replace(/[^\d\-,.]/g,'').replace(',','.')),bn=parseFloat(bv.replace(/[^\d\-,.]/g,'').replace(',','.'));if(!isNaN(an)&&!isNaN(bn))return dir==='asc'?an-bn:bn-an;return dir==='asc'?av.localeCompare(bv):bv.localeCompare(av);});
  rows.forEach(r=>tbody.appendChild(r));
}

// Source publique canonique : API/back-office bridge.
async function loadAll() {
  try {
    const results=await Promise.allSettled([
      window.apiGet('/marche?type=cours'),window.apiGet('/boc'),window.apiGet('/marche?type=analyses'),
      window.apiGet('/marche?type=financials'),window.apiGet('/marche?type=entreprises'),
      window.apiGet('/marche?type=indices'),window.apiGet('/marche?type=dividendes')
    ]);
    const arr=x=>Array.isArray(x)?x:(x?.data||x?.rows||[]), value=i=>results[i].status==='fulfilled'?arr(results[i].value):[];
    if(results[0].status==='fulfilled')allCours=value(0);else toast('Erreur chargement cours: '+results[0].reason,'error');
    if(results[1].status==='fulfilled')allBoc=value(1);else toast('Erreur chargement BOC: '+results[1].reason,'error');
    if(results[2].status==='fulfilled')allAnalyses=value(2);else toast('Erreur chargement analyses: '+results[2].reason,'error');
    if(results[3].status==='fulfilled')allFinancials=value(3);else toast('Erreur chargement financiers: '+results[3].reason,'error');
    if(results[4].status==='fulfilled')allEntreprises=value(4);else toast('Erreur chargement entreprises: '+results[4].reason,'error');
    if(results[5].status==='fulfilled')allIndices=value(5);else{allIndices=[];toast('Erreur chargement indices: '+results[5].reason,'warn');}
    window.allDividendes=results[6].status==='fulfilled'?value(6):[];
    entMap=Object.fromEntries(allEntreprises.map(e=>[e.ticker,e]));
    renderOverview();renderTitres();renderBoc();renderAnalyses();renderFinancials();renderPublications();populateTickerSelects();
    if(typeof atInit==='function')atInit(); if(typeof initGlobalSearch==='function')initGlobalSearch(); if(typeof runScreener==='function')runScreener();
    if(typeof renderPortfolio==='function')renderPortfolio(); if(typeof renderAlerts==='function')renderAlerts(); parseHash();
  } catch(e){toast('Erreur globale de chargement: '+e.message,'error');console.error('[APP LOAD]',e);}
}

function populateTickerSelects(){
  const byTicker={};allCours.forEach(c=>{if(c.ticker&&!byTicker[c.ticker])byTicker[c.ticker]=c;});
  const tickers=Object.keys(byTicker).sort(),opts=tickers.map(t=>`<option value="${t}">${t}</option>`).join('');
  const pf=document.getElementById('pfTicker');if(pf)pf.innerHTML='<option value="">Ticker...</option>'+opts;
  const al=document.getElementById('alertTicker');if(al)al.innerHTML='<option value="">Ticker...</option>'+opts;
  const fu=document.getElementById('fundTickerSelect');if(fu)fu.innerHTML='<option value="">Choisir un ticker...</option>'+opts;
}

// Les données administrées sont répercutées automatiquement dans les vues.
window.addEventListener('tc:backoffice-source-updated',function(e){
  const d=e.detail||{};
  if(d.source==='dividendes')window.allDividendes=d.data||[];
  if(d.source==='entreprises')allEntreprises=d.data||[];
  if(d.source==='cours')allCours=d.data||[];
  if(d.source==='indices')allIndices=d.data||[];
  if(d.source==='analyses')allAnalyses=d.data||[];
  if(d.source==='financials')allFinancials=d.data||[];
  if(d.source==='boc')allBoc=d.data||[];
  if(Array.isArray(allEntreprises))entMap=Object.fromEntries(allEntreprises.map(x=>[x.ticker,x]));
  try{if(typeof window.renderCurrentView==='function')window.renderCurrentView();}catch(err){console.warn('[APP REFRESH]',err);}
});
