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
