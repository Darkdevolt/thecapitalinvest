// THE CAPITAL — Portefeuille utilities
// IMPORTANT: portfolio data is owned by portfolio-store.js + Supabase.
// This file contains only calculations/UI helpers; it must never overwrite the store.

function getPortfolio() {
  return window.portfolioStore && typeof window.portfolioStore.getTransactions === 'function'
    ? rebuildPortfolioFromTransactions(window.portfolioStore.getTransactions())
    : [];
}

function rebuildPortfolioFromTransactions(rows) {
  const lots = [];
  for (const tx of rows || []) {
    const ticker = String(tx.ticker || '').toUpperCase().trim();
    const qty = Number(tx.quantite ?? tx.quantity ?? tx.qty ?? 0);
    const price = Number(tx.prix_unitaire ?? tx.cours ?? tx.price ?? 0);
    if (!ticker || qty <= 0) continue;
    if (String(tx.type).toUpperCase() === 'ACHAT' || String(tx.type).toLowerCase() === 'buy') {
      lots.push({ id: tx.id, serverId: tx.id, ticker, type: 'action', qty, price, date: tx.date_transaction || tx.date });
    } else if (String(tx.type).toUpperCase() === 'VENTE' || String(tx.type).toLowerCase() === 'sell') {
      let remaining = qty;
      for (const lot of lots.filter(x => x.ticker === ticker && x.qty > 0)) {
        if (remaining <= 0) break;
        const take = Math.min(lot.qty, remaining);
        lot.qty -= take;
        remaining -= take;
      }
    }
  }
  return lots.filter(l => l.qty > 0);
}

function savePortfolio(data) {
  if (window.portfolioStore && typeof window.portfolioStore.sync === 'function') {
    window.portfolioStore.sync(data).catch(err => {
      console.error('[PORTFOLIO] Synchronisation Supabase échouée:', err);
      if (typeof toast === 'function') toast(err.message || 'Erreur de synchronisation', 'error');
    });
    return true;
  }
  console.error('[PORTFOLIO] Store Supabase indisponible. Aucune écriture locale effectuée.');
  return false;
}

// Cash/dividendes/journal: use the server transaction API. LocalStorage is not a source of truth.
function getTransactions() {
  return window.portfolioStore && typeof window.portfolioStore.getTransactions === 'function'
    ? window.portfolioStore.getTransactions()
    : [];
}

function saveTransactions() {
  console.warn('[PORTFOLIO] saveTransactions est obsolète: utilisez portfolioStore.addTransaction().');
  return false;
}

function logTransaction(tx) {
  if (!window.portfolioStore || typeof window.portfolioStore.addTransaction !== 'function') {
    console.error('[PORTFOLIO] API transactions indisponible.');
    return Promise.reject(new Error('API portefeuille indisponible'));
  }
  const typeMap = { buy: 'ACHAT', sell: 'VENTE', deposit: 'DEPOT', withdraw: 'RETRAIT', dividend: 'DIVIDENDE' };
  const type = typeMap[String(tx.type || '').toLowerCase()] || String(tx.type || '').toUpperCase();
  return window.portfolioStore.addTransaction({
    type,
    ticker: tx.ticker || null,
    quantity: Number(tx.qty || tx.quantite || 0),
    price: Number(tx.price || tx.cours || 0),
    amount: Number(tx.amount || 0),
    date: tx.date || new Date().toISOString().slice(0, 10),
    note: tx.note || tx.remarque || null
  });
}

function getRealizedPL() {
  return getTransactions().filter(t => ['VENTE', 'sell'].includes(String(t.type))).reduce((s, t) => {
    return s + Number(t.realizedPL || 0);
  }, 0);
}

// Legacy synchronous helpers below are intentionally kept only for UI preferences.
// They are not used for positions, trades or market data.
function getCash() { return 0; }
function saveCash() { console.warn('[PORTFOLIO] Cash doit être enregistré comme transaction Supabase.'); return false; }
function getDividends() { return []; }
function saveDividends() { console.warn('[PORTFOLIO] Dividendes doivent être enregistrés comme transaction Supabase.'); return false; }

function getWatchlist() { return []; }
function saveWatchlist() { console.warn('[WATCHLIST] Utiliser l’API Supabase watchlist.'); return false; }
function getAlerts() { return []; }
function saveAlerts() { console.warn('[ALERTES] Utiliser l’API Supabase alertes_cours.'); return false; }

function getGoal() {
  try { return JSON.parse(localStorage.getItem('tc_goal') || 'null'); } catch { return null; }
}
function saveGoal(data) {
  try { localStorage.setItem('tc_goal', JSON.stringify(data)); return true; }
  catch (e) { console.error('saveGoal échec:', e); return false; }
}
function getTargetAllocation() {
  try { return JSON.parse(localStorage.getItem('tc_target_alloc') || '{}'); } catch { return {}; }
}
function saveTargetAllocation(data) {
  try { localStorage.setItem('tc_target_alloc', JSON.stringify(data)); return true; }
  catch (e) { console.error('saveTargetAllocation échec:', e); return false; }
}

function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
  const variance = arr.reduce((a,b)=>a+Math.pow(b-mean,2),0)/(arr.length-1);
  return Math.sqrt(variance);
}
function calcVolatility(returns) { return !returns || returns.length < 2 ? 0 : stdDev(returns)*Math.sqrt(252); }
function calcSharpe(returns,riskFreeRate=0.05) {
  if(!returns||returns.length<2)return 0;
  const meanReturn=returns.reduce((a,b)=>a+b,0)/returns.length, vol=stdDev(returns);
  return vol===0?0:(meanReturn*252-riskFreeRate)/(vol*Math.sqrt(252));
}
function calcMaxDrawdown(values) {
  if(!values||values.length<2)return 0; let peak=values[0],maxDD=0;
  for(let i=1;i<values.length;i++){if(values[i]>peak)peak=values[i];if(peak>0)maxDD=Math.max(maxDD,(peak-values[i])/peak);}
  return maxDD*100;
}
function calcCorrelation(arr1,arr2) {
  const n=Math.min(arr1.length,arr2.length); if(n<2)return 0;
  const a1=arr1.slice(-n),a2=arr2.slice(-n),m1=a1.reduce((s,v)=>s+v,0)/n,m2=a2.reduce((s,v)=>s+v,0)/n;
  let num=0,den1=0,den2=0;
  for(let i=0;i<n;i++){const d1=a1[i]-m1,d2=a2[i]-m2;num+=d1*d2;den1+=d1*d1;den2+=d2*d2;}
  const den=Math.sqrt(den1*den2); return den===0?0:num/den;
}
function getDividendYield(ticker) {
  if(!ticker||!window.allFinancials)return 0;
  const fin=window.allFinancials.find(f=>(f.ticker||'').toUpperCase().trim()===ticker.toUpperCase().trim()&&f.dpa!=null);
  const price=getLatestPrice(ticker); return !fin||!price||price<=0?0:(fin.dpa/price)*100;
}
function calculateCMP(pf) {
  const map={}; (pf||[]).forEach(p=>{const t=(p.ticker||'').toUpperCase().trim();if(!map[t])map[t]={totalQty:0,totalCost:0,positions:[]};map[t].totalQty+=+p.qty||0;map[t].totalCost+=(+p.qty||0)*(+p.price||0);map[t].positions.push(p);});
  const result={}; for(const t in map){const d=map[t];result[t]={value:d.totalQty>0?d.totalCost/d.totalQty:0,positions:d.positions};} return result;
}
function toast(message,type='info') {
  let container=document.getElementById('toastContainer'); if(!container){container=document.createElement('div');container.id='toastContainer';container.className='toast-container';document.body.appendChild(container);}
  const el=document.createElement('div');el.className=`toast toast-${type}`;el.textContent=message;container.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300);},3800);
}
function downloadCSV(filename,rows){const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
window.exportPositionsCSV=function(rows){if(!rows||!rows.length){toast('Aucune position à exporter.','error');return;}const header=['Ticker','Pays','Secteur','Quantité','CMP','Cours actuel','Valeur','P&L','P&L %','Allocation %'];const data=rows.map(r=>[r.ticker,r.pays,r.sector,r.qty,(+r.cmp).toFixed(2),(+r.currentPrice).toFixed(2),(+r.value).toFixed(0),(+r.pl).toFixed(0),(+r.plPct).toFixed(2),(+(r.allocation||0)).toFixed(2)]);downloadCSV(`portefeuille_positions_${new Date().toISOString().split('T')[0]}.csv`,[header,...data]);toast('Export des positions généré.','success');};
window.exportTransactionsCSV=function(){const txs=getTransactions().sort((a,b)=>new Date(b.date_transaction||b.date)-new Date(a.date_transaction||a.date));if(!txs.length){toast('Aucune transaction à exporter.','error');return;}const header=['Date','Type','Ticker','Quantité','Prix/Montant','P&L Réalisé'];const data=txs.map(t=>[t.date_transaction||t.date,t.type,t.ticker||'-',t.quantite||t.qty||'-',t.prix_unitaire??t.price??t.amount??'-',t.realizedPL??'-']);downloadCSV(`portefeuille_transactions_${new Date().toISOString().split('T')[0]}.csv`,[header,...data]);toast('Export des transactions généré.','success');};
