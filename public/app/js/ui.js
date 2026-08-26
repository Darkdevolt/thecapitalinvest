// ═══════════════════════════════════════
// UI — tables, shared loading and rendering
// ═══════════════════════════════════════
// Le chargement des données est centralisé dans main.js.
// Ce module conserve les helpers UI et le bridge back-office.

function sortTable(tbodyId,colIndex){
  const tbody=document.getElementById(tbodyId);if(!tbody)return;
  const rows=Array.from(tbody.querySelectorAll('tr'));const key=tbodyId+'-'+colIndex;
  const dir=_sortState[key]==='asc'?'desc':'asc';_sortState[key]=dir;
  rows.sort((a,b)=>{let av=a.cells[colIndex]?.textContent.trim()||'',bv=b.cells[colIndex]?.textContent.trim()||'';let an=parseFloat(av.replace(/[^\d\-,.]/g,'').replace(',','.')),bn=parseFloat(bv.replace(/[^\d\-,.]/g,'').replace(',','.'));if(!isNaN(an)&&!isNaN(bn))return dir==='asc'?an-bn:bn-an;return dir==='asc'?av.localeCompare(bv):bv.localeCompare(av);});
  rows.forEach(r=>tbody.appendChild(r));
}

function populateTickerSelects(){
  const byTicker={};(Array.isArray(window.allCours)?window.allCours:[]).forEach(c=>{if(c&&c.ticker&&!byTicker[c.ticker])byTicker[c.ticker]=c;});
  const tickers=Object.keys(byTicker).sort();
  const opts=tickers.map(t=>'<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>').join('');
  const pf=document.getElementById('pfTicker');if(pf)pf.innerHTML='<option value="">Ticker...</option>'+opts;
  const al=document.getElementById('alertTicker');if(al)al.innerHTML='<option value="">Ticker...</option>'+opts;
  const fu=document.getElementById('fundTickerSelect');if(fu)fu.innerHTML='<option value="">Choisir un ticker...</option>'+opts;
}

// Les données administrées sont répercutées automatiquement dans les vues.
window.addEventListener('tc:backoffice-source-updated',function(e){
  const d=e.detail||{};
  if(d.source==='dividendes')window.allDividendes=d.data||[];
  if(d.source==='entreprises')window.allEntreprises=d.data||[];
  if(d.source==='cours')window.allCours=d.data||[];
  if(d.source==='indices')window.allIndices=d.data||[];
  if(d.source==='analyses')window.allAnalyses=d.data||[];
  if(d.source==='financials')window.allFinancials=d.data||[];
  if(d.source==='boc')window.allBoc=d.data||[];
  if(Array.isArray(window.allEntreprises))window.entMap=Object.fromEntries(window.allEntreprises.map(x=>[x.ticker,x]));
  try{if(typeof window.renderCurrentView==='function')window.renderCurrentView();}catch(err){console.warn('[APP REFRESH]',err);}
});
