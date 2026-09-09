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

/**
 * Peuple TOUS les menus déroulants de tickers de l'application, une bonne fois.
 * Source : la cote (allCours) complétée par le référentiel (allEntreprises) —
 * ainsi un titre sans cotation du jour reste sélectionnable. Le libellé montre
 * « TICKER — Société » quand le nom est connu. La sélection en cours est
 * préservée. Idempotent : on marque le <select> avec son nombre d'options.
 */
function populateTickerSelects(){
  const set={};
  (Array.isArray(window.allCours)?window.allCours:[]).forEach(c=>{if(c&&c.ticker)set[String(c.ticker).trim().toUpperCase()]=1;});
  (Array.isArray(window.allEntreprises)?window.allEntreprises:[]).forEach(e=>{if(e&&e.ticker)set[String(e.ticker).trim().toUpperCase()]=1;});
  const em=(window.entMap&&typeof window.entMap==='object')?window.entMap:{};
  const tickers=Object.keys(set).sort();
  if(!tickers.length)return;
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const optsFor=ph=>'<option value="">'+ph+'</option>'+tickers.map(t=>{
    const e=em[t]||{};const nom=e.nom||e.nom_court||e.raison_sociale||'';
    return '<option value="'+t+'">'+esc(t)+(nom?' — '+esc(nom):'')+'</option>';
  }).join('');
  // id → texte du placeholder
  const targets={
    pfTicker:'Ticker...', alertTicker:'Ticker...',
    fundTickerSelect:'Choisir un ticker...', afTicker:'Choisir un ticker...',
    atTicker:'Ticker...', cmpTickerA:'Titre A', cmpTickerB:'Titre B'
  };
  Object.keys(targets).forEach(id=>{
    const el=document.getElementById(id);
    if(!el||el.tagName!=='SELECT')return;
    if(el.dataset.tcTickerCount===String(tickers.length))return; // déjà à jour
    const keep=el.value;
    el.innerHTML=optsFor(targets[id]);
    if(keep&&set[keep.toUpperCase()])el.value=keep;
    el.dataset.tcTickerCount=String(tickers.length);
  });
}

// Repeuple dès que les données arrivent, puis à chaque changement de vue.
window.addEventListener('tc:dataready',function(){try{populateTickerSelects();}catch(e){}});
document.addEventListener('DOMContentLoaded',function(){try{populateTickerSelects();}catch(e){}});
window.populateTickerSelects=populateTickerSelects;
window.sortTable=sortTable;

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
