// ═══════════════════════════════════════
// VIEW — Screener BRVM
// ═══════════════════════════════════════
function latestFinancial(ticker) {
  return (Array.isArray(window.allFinancials) ? window.allFinancials : [])
    .filter(f => f.ticker === ticker)
    .sort((a,b) => Number(b.annee || 0) - Number(a.annee || 0))[0] || null;
}
function finNumber(f, ...keys) {
  if (!f) return null;
  for (const key of keys) { const n = Number(f[key]); if (Number.isFinite(n)) return n; }
  return null;
}
function financialGrowth(ticker) {
  const rows = (Array.isArray(window.allFinancials) ? window.allFinancials : []).filter(f => f.ticker === ticker).sort((a,b) => Number(b.annee||0)-Number(a.annee||0));
  if (rows.length < 2) return null;
  const a = Number(rows[0].chiffre_affaires), b = Number(rows[1].chiffre_affaires);
  return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a/b - 1) * 100 : null;
}
function financialRow(ticker, c) {
  const f = latestFinancial(ticker);
  const roe = finNumber(f,'roe') ?? (f?.resultat_net && f?.fonds_propres ? Number(f.resultat_net)/Number(f.fonds_propres)*100 : null);
  const margin = finNumber(f,'marge_nette') ?? (f?.resultat_net && f?.chiffre_affaires ? Number(f.resultat_net)/Number(f.chiffre_affaires)*100 : null);
  const yieldValue = finNumber(f,'dividend_yield','rendement_dividende') ?? (f?.dpa && c?.cours ? Number(f.dpa)/Number(c.cours)*100 : null);
  const debt = finNumber(f,'dette_nette','dette_fin','dettes_financieres');
  const growth = financialGrowth(ticker);
  const pct = v => v == null ? '—' : `${Number(v).toFixed(2)}%`;
  return `<tr><td><strong style="color:var(--gold)">${escapeHtml(ticker)}</strong></td><td>${escapeHtml(c.nom||c.entreprise||c.name||'—')}</td><td class="right">${fmt(c.cours)}</td><td class="right">${fmt(c.variation)}%</td><td class="right">${fmt(c.volume)}</td><td>${escapeHtml(getSector(ticker)||'—')}</td><td class="right pro-only">${pct(roe)}</td><td class="right pro-only">${pct(margin)}</td><td class="right pro-only">${pct(yieldValue)}</td><td class="right pro-only">${debt==null?'—':fmt(debt)}</td><td class="right pro-only">${pct(growth)}</td></tr>`;
}

function ensureFundamentalFilters() {
  const box = document.querySelector('#view-screener .screener-filters');
  if (!box || document.getElementById('scrMinRoe')) return;
  const fields = [
    ['scrMinRoe','ROE min %',true],['scrMinMargin','Marge nette min %',true],['scrMinYield','Dividend yield min %',false],['scrMaxDebt','Dette max',true],['scrMinGrowth','Croissance CA min %',true]
  ];
  fields.forEach(([id,label,proOnly]) => {
    const wrap=document.createElement('div'); if(proOnly)wrap.className='pro-only'; wrap.innerHTML=`<label>${label}</label><input type="number" id="${id}" placeholder="—" step="0.1" oninput="runScreener()">`; box.appendChild(wrap);
  });
  const head=document.querySelector('#view-screener table thead tr');
  if(head && !head.querySelector('.fundamental-head')) ['ROE','Marge nette','Yield','Dette','Croissance CA'].forEach(label=>{const th=document.createElement('th');th.className='right pro-only fundamental-head';th.textContent=label;head.appendChild(th);});
}

function runScreener() {
  ensureFundamentalFilters();
  const sector = document.getElementById('scrSector')?.value || '';
  const minP = parseFloat(document.getElementById('scrMinPrice')?.value); const maxP = parseFloat(document.getElementById('scrMaxPrice')?.value);
  const minV = parseFloat(document.getElementById('scrMinVar')?.value); const maxV = parseFloat(document.getElementById('scrMaxVar')?.value); const minVol = parseFloat(document.getElementById('scrMinVol')?.value);
  const minRoe = parseFloat(document.getElementById('scrMinRoe')?.value); const minMargin = parseFloat(document.getElementById('scrMinMargin')?.value); const minYield = parseFloat(document.getElementById('scrMinYield')?.value); const maxDebt = parseFloat(document.getElementById('scrMaxDebt')?.value); const minGrowth = parseFloat(document.getElementById('scrMinGrowth')?.value);
  const byTicker = {}; (Array.isArray(allCours)?allCours:[]).forEach(c=>{if(c?.ticker&&!byTicker[c.ticker])byTicker[c.ticker]=c;});
  let rows = Object.values(byTicker).filter(r=>{
    const s=getSector(r.ticker); if(sector&&!s.toLowerCase().includes(sector.toLowerCase()))return false;
    if(Number.isFinite(minP)&&r.cours<minP)return false; if(Number.isFinite(maxP)&&r.cours>maxP)return false;
    const varVal=Number(r.variation)||0; if(Number.isFinite(minV)&&varVal<minV)return false; if(Number.isFinite(maxV)&&varVal>maxV)return false; if(Number.isFinite(minVol)&&(r.volume||0)<minVol)return false;
    const f=latestFinancial(r.ticker); const roe=finNumber(f,'roe') ?? (f?.resultat_net&&f?.fonds_propres?Number(f.resultat_net)/Number(f.fonds_propres)*100:null); const margin=finNumber(f,'marge_nette') ?? (f?.resultat_net&&f?.chiffre_affaires?Number(f.resultat_net)/Number(f.chiffre_affaires)*100:null); const yieldValue=finNumber(f,'dividend_yield','rendement_dividende') ?? (f?.dpa&&r.cours ? Number(f.dpa)/Number(r.cours)*100 : null); const debt=finNumber(f,'dette_nette','dette_fin','dettes_financieres'); const growth=financialGrowth(r.ticker);
    if(Number.isFinite(minRoe)&&(roe==null||roe<minRoe))return false; if(Number.isFinite(minMargin)&&(margin==null||margin<minMargin))return false; if(Number.isFinite(minYield)&&(yieldValue==null||yieldValue<minYield))return false; if(Number.isFinite(maxDebt)&&(debt==null||debt>maxDebt))return false; if(Number.isFinite(minGrowth)&&(growth==null||growth<minGrowth))return false;
    return true;
  });
  const countEl=document.getElementById('scrCount'); if(countEl)countEl.textContent=rows.length+' resultat(s)';
  const tbody=document.getElementById('screenerTable'); if(!tbody)return;
  if(!rows.length){tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--dim)">Aucun titre ne correspond aux criteres.</td></tr>';return;}
  tbody.innerHTML=rows.sort((a,b)=>(a.ticker||'').localeCompare(b.ticker||'')).map(c=>financialRow(c.ticker,c)).join('');
}

function renderScreener(){ ensureFundamentalFilters(); runScreener(); }