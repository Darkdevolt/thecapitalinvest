// ═══════════════════════════════════════════════════════
// VIEW — Portefeuille Simulé (VERSION COMPLÈTE & CORRIGÉE)
// ═══════════════════════════════════════════════════════

const _pfHistCache = {};
const _pfPortfolioCache = {};
let _pfRenderPending = false;

function getPortfolio() {
  try { return JSON.parse(localStorage.getItem('tc_portfolio') || '[]'); }
  catch { return []; }
}
function savePortfolio(data) { localStorage.setItem('tc_portfolio', JSON.stringify(data)); }

function getCash() {
  try { return JSON.parse(localStorage.getItem('tc_cash') || '0'); }
  catch { return 0; }
}
function saveCash(amount) { localStorage.setItem('tc_cash', JSON.stringify(amount)); }

function getDividends() {
  try { return JSON.parse(localStorage.getItem('tc_dividends') || '[]'); }
  catch { return []; }
}
function saveDividends(data) { localStorage.setItem('tc_dividends', JSON.stringify(data)); }

// ═══════════════════════════════════════════════════════
// CALCUL DU CMP (COÛT MOYEN PONDÉRÉ)
// ═══════════════════════════════════════════════════════
function calculateCMP(positions) {
  const byTicker = {};
  positions.forEach(p => {
    const t = p.ticker.toUpperCase().trim();
    if (!byTicker[t]) {
      byTicker[t] = { totalQty: 0, totalCost: 0, positions: [] };
    }
    byTicker[t].totalQty += p.qty;
    byTicker[t].totalCost += p.qty * p.price;
    byTicker[t].positions.push(p);
  });

  const cmp = {};
  for (const [ticker, data] of Object.entries(byTicker)) {
    cmp[ticker] = {
      value: data.totalQty > 0 ? data.totalCost / data.totalQty : 0,
      totalQty: data.totalQty,
      totalCost: data.totalCost,
      positions: data.positions
    };
  }
  return cmp;
}

// ═══════════════════════════════════════════════════════
// RÉCUPÉRATION DU COURS ACTUEL
// ═══════════════════════════════════════════════════════
function getLatestPrice(ticker) {
  if (!ticker) return null;
  const t = ticker.toUpperCase().trim();

  if (Array.isArray(window.allCours) && window.allCours.length > 0) {
    const coursJour = window.allCours.find(c => {
      const ct = (c.ticker || '').toUpperCase().trim();
      return ct === t || ct.startsWith(t) || t.startsWith(ct);
    });
    if (coursJour) {
      const prix = coursJour.cours_cloture || coursJour.dernier_cours || coursJour.cours;
      if (prix != null) return +prix;
    }
  }

  const cache = _pfHistCache[t];
  if (cache && cache.length > 0) {
    const last = cache[cache.length - 1];
    const prix = last.cours_cloture || last.cours_normal || last.cours;
    if (prix != null) return +prix;
  }

  if (Array.isArray(window.allCoursHistorique) && window.allCoursHistorique.length > 0) {
    const hist = window.allCoursHistorique
      .filter(c => (c.ticker || '').toUpperCase().trim() === t)
      .sort((a, b) => new Date(b.date_seance || 0) - new Date(a.date_seance || 0));
    if (hist.length) {
      const last = hist[0];
      const prix = last.cours_cloture || last.cours_normal || last.cours;
      if (prix != null) return +prix;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// HISTORIQUES PAR TICKER
// ═══════════════════════════════════════════════════════
function getTickerHistory(ticker) {
  if (!ticker) return [];
  const t = ticker.toUpperCase().trim();
  
  if (_pfHistCache[t] && _pfHistCache[t].length > 0) return _pfHistCache[t];
  
  if (Array.isArray(window.allCoursHistorique) && window.allCoursHistorique.length > 0) {
    const hist = window.allCoursHistorique
      .filter(c => (c.ticker || '').toUpperCase().trim() === t)
      .sort((a, b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0));
    if (hist.length > 0) {
      _pfHistCache[t] = hist;
      return hist;
    }
  }
  return [];
}

function getPriceAtDate(ticker, dateStr) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;

  // Normaliser la date de recherche (YYYY-MM-DD -> nombre)
  const tp = dateStr.split("-");
  const targetNum = +tp[0] * 10000 + +tp[1] * 100 + +tp[2];

  let exact = null, lastBefore = null;
  for (const c of hist) {
    const ds = c.date_seance || "";
    let year, month, day;

    // Format ISO: YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
    if (ds.includes("T") || ds.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const p = ds.split("T")[0].split("-");
      year = +p[0]; month = +p[1]; day = +p[2];
    }
    // Format BRVM: DD/MM/YYYY ou DD-MM-YYYY
    else if (ds.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
      const p = ds.split(/[\/\-]/);
      day = +p[0]; month = +p[1]; year = +p[2];
    }
    else continue;

    const cNum = year * 10000 + month * 100 + day;
    if (cNum === targetNum) { exact = c; break; }
    if (cNum < targetNum) lastBefore = c;
  }

  const c = exact || lastBefore;
  if (c) {
    const prix = +(c.cours_cloture || c.cours_normal || c.cours || 0);
    return prix > 0 ? prix : null;
  }
  return null;
}

function get52WeekHigh(ticker) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;
  const vals = hist.map(c => +(c.cours_cloture || c.cours_normal || c.cours || c.haut || 0)).filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

function get52WeekLow(ticker) {
  const hist = getTickerHistory(ticker);
  if (!hist.length) return null;
  const vals = hist.map(c => +(c.cours_cloture || c.cours_normal || c.cours || c.bas || 0)).filter(v => v > 0);
  return vals.length ? Math.min(...vals) : null;
}

// ═══════════════════════════════════════════════════════
// HELPERS MATHS / STATS
// ═══════════════════════════════════════════════════════
function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function calcVolatility(returns) {
  if (!returns || returns.length < 2) return 0;
  return stdDev(returns) * Math.sqrt(252);
}

function calcSharpe(returns, riskFreeRate = 0.05) {
  if (!returns || returns.length < 2) return 0;
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const vol = stdDev(returns);
  if (vol === 0) return 0;
  return (meanReturn * 252 - riskFreeRate) / (vol * Math.sqrt(252));
}

function calcMaxDrawdown(values) {
  if (!values || values.length < 2) return 0;
  let maxDD = 0, peak = values[0];
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function calcCorrelation(x, y) {
  if (!x || !y || x.length < 2 || x.length !== y.length) return 0;
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// ═══════════════════════════════════════════════════════
// HELPERS DONNÉES — CORRIGÉS
// ═══════════════════════════════════════════════════════
function getSector(ticker) {
  if (!ticker) return 'Divers';
  const t = ticker.toUpperCase().trim();
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.secteur) return ent.secteur;
  
  // Mapping par ticker pour BRVM
  const sectorMap = {
    'SNTS': 'Télécommunications',
    'SONATEL': 'Télécommunications',
    'ORANGE': 'Télécommunications',
    'NSBC': 'Banque',
    'SGBCI': 'Banque',
    'ECOBANK': 'Banque',
    'BOA': 'Banque',
    'BIIC': 'Banque',
    'CBIBF': 'Industrie',
    'CIMTOGO': 'Ciment',
    'CIMCO': 'Ciment',
    'SAFCA': 'Agroalimentaire',
    'PALM': 'Agroalimentaire',
    'SAPH': 'Agroalimentaire',
    'SICOR': 'Caoutchouc',
    'TOTAL': 'Pétrole',
    'VIVO': 'Distribution',
    'SOCO': 'Pétrole',
    'ONTBF': 'Finance',
    'BRVM': 'Indice'
  };
  
  for (const [prefix, sector] of Object.entries(sectorMap)) {
    if (t.startsWith(prefix)) return sector;
  }
  
  if (typeof SECTORS !== 'undefined') {
    for (const [k, v] of Object.entries(SECTORS)) {
      if (t.startsWith(k)) return v;
    }
  }
  return 'Divers';
}

function getPays(ticker) {
  if (!ticker) return 'Inconnu';
  const t = ticker.toUpperCase().trim();
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.pays) return ent.pays;
  
  // Mapping correct par suffixe et ticker pour BRVM
  const paysMap = {
    'SNTS': 'Sénégal',
    'SONATEL': 'Sénégal',
    'NSBC': "Côte d'Ivoire",
    'SGBCI': "Côte d'Ivoire",
    'ECOBANK': 'Togo',
    'BOA': 'Burkina Faso',
    'BIIC': "Côte d'Ivoire",
    'CBIBF': 'Burkina Faso',
    'CIMTOGO': 'Togo',
    'CIMCO': 'Cameroun',
    'SAFCA': 'Cameroun',
    'PALM': 'Côte d\'Ivoire',
    'SAPH': 'Côte d\'Ivoire',
    'SICOR': 'Côte d\'Ivoire',
    'TOTAL': 'Côte d\'Ivoire',
    'VIVO': 'Côte d\'Ivoire',
    'SOCO': 'Côte d\'Ivoire',
    'ONTBF': 'Burkina Faso'
  };
  
  if (paysMap[t]) return paysMap[t];
  
  // Fallback sur suffixe
  if (t.endsWith('SN')) return 'Sénégal';
  if (t.endsWith('CI')) return "Côte d'Ivoire";
  if (t.endsWith('BF')) return 'Burkina Faso';
  if (t.endsWith('BJ')) return 'Bénin';
  if (t.endsWith('TG')) return 'Togo';
  if (t.endsWith('ML')) return 'Mali';
  if (t.endsWith('NE')) return 'Niger';
  if (t.endsWith('GW')) return 'Guinée-Bissau';
  if (t.endsWith('CM')) return 'Cameroun';
  
  return 'Inconnu';
}

function getDividendYield(ticker) {
  if (!ticker) return 0;
  const t = ticker.toUpperCase().trim();
  const ent = window.entMap && window.entMap[t];
  if (ent && ent.dividende_yield != null) return +ent.dividende_yield;
  if (Array.isArray(window.allCours)) {
    const c = window.allCours.find(x => (x.ticker || '').toUpperCase().trim() === t);
    if (c && c.dividende_yield != null) return +c.dividende_yield;
    if (c && c.rendement != null) return +c.rendement;
  }
  return 0;
}

// ═══════════════════════════════════════════════════════
// HISTORIQUE DU PORTEFEUILLE
// ═══════════════════════════════════════════════════════
function getPortfolioHistory(periodDays = 99999) {
  const pf = getPortfolio();
  if (!pf.length) return { dates: [], values: [], pls: [] };

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - periodDays);

  const oldestBuy = new Date(Math.min(...pf.map(p => new Date(p.date || now))));
  const effectiveStart = periodDays === 99999 ? oldestBuy : new Date(Math.max(startDate, oldestBuy));

  const dates = [];
  let current = new Date(effectiveStart);
  while (current <= now) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const cacheKey = JSON.stringify({
    period: periodDays,
    pfHash: pf.map(p => `${p.ticker}:${p.qty}:${p.price}:${p.date}`).join('|')
  });

  if (_pfPortfolioCache[cacheKey]) {
    return _pfPortfolioCache[cacheKey];
  }

  const values = [];
  const pls = [];
  const totalValues = [];

  dates.forEach(date => {
    let dayValue = 0;
    let dayInvested = 0;

    pf.forEach(p => {
      const buyDate = new Date(p.date || p.id);
      if (date >= buyDate) {
        const t = p.ticker.toUpperCase().trim();
        const ds = date.toISOString().split('T')[0];
        
        let priceAtDate = getPriceAtDate(t, ds);
        if (!priceAtDate || priceAtDate <= 0) {
          priceAtDate = getLatestPrice(t) || p.price;
        }

        dayValue += p.qty * priceAtDate;
        dayInvested += p.qty * p.price;
      }
    });

    values.push(dayValue);
    pls.push(dayValue - dayInvested);
    totalValues.push(dayValue + cash);
  });

  const result = { dates, values, pls, totalValues };
  _pfPortfolioCache[cacheKey] = result;
  return result;
}

function invalidatePortfolioCache() {
  Object.keys(_pfPortfolioCache).forEach(k => delete _pfPortfolioCache[k]);
}

// ═══════════════════════════════════════════════════════
// PEUPLER LE SELECT DES TICKERS
// ═══════════════════════════════════════════════════════
function populateTickerSelect() {
  const select = document.getElementById('pfTicker');
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  if (!Array.isArray(window.allCours) || window.allCours.length === 0) return;
  const tickers = [...new Set(window.allCours.map(c => c.ticker).filter(Boolean))].sort();
  tickers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = `${t} — ${getPays(t)}`;
    select.appendChild(opt);
  });
}

// ═══════════════════════════════════════════════════════
// ACTIONS CRUD — POSITIONS
// ═══════════════════════════════════════════════════════
window.addPosition = function() {
  const ticker = document.getElementById('pfTicker').value.trim().toUpperCase();
  const qty = parseInt(document.getElementById('pfQty').value);
  const price = parseFloat(document.getElementById('pfPrice').value);
  const date = document.getElementById('pfDate').value;
  
  if (!ticker || !qty || !price || qty <= 0 || price <= 0) {
    toast('Remplissez tous les champs correctement', 'warn');
    return;
  }
  
  const pf = getPortfolio();
  pf.push({
    id: Date.now(),
    ticker,
    qty,
    price,
    date: date || new Date().toISOString().split('T')[0]
  });
  savePortfolio(pf);
  invalidatePortfolioCache();
  renderPortfolio();
  toast('Position ajoutée', 'success');
  document.getElementById('pfQty').value = '';
  document.getElementById('pfPrice').value = '';
}

window.removePosition = function(id) {
  const pf = getPortfolio().filter(p => p.id !== id);
  savePortfolio(pf);
  invalidatePortfolioCache();
  renderPortfolio();
  toast('Position supprimée', 'success');
}

// ═══════════════════════════════════════════════════════
// CASH (DÉPÔTS/RETRAITS)
// ═══════════════════════════════════════════════════════
window.addCash = function() {
  const amount = parseFloat(document.getElementById('cashAmount').value);
  const type = document.getElementById('cashType').value; // 'deposit' ou 'withdraw'
  
  if (!amount || amount <= 0) {
    toast('Montant invalide', 'warn');
    return;
  }
  
  const currentCash = getCash();
  let newCash;
  
  if (type === 'deposit') {
    newCash = currentCash + amount;
    toast(`Dépôt de ${fmtM(amount)} FCFA effectué`, 'success');
  } else {
    if (currentCash < amount) {
      toast('Fonds insuffisants', 'error');
      return;
    }
    newCash = currentCash - amount;
    toast(`Retrait de ${fmtM(amount)} FCFA effectué`, 'success');
  }
  
  saveCash(newCash);
  renderPortfolio();
}

// ═══════════════════════════════════════════════════════
// DIVIDENDES
// ═══════════════════════════════════════════════════════
window.addDividend = function() {
  const ticker = document.getElementById('divTicker').value.trim().toUpperCase();
  const amount = parseFloat(document.getElementById('divAmount').value);
  const date = document.getElementById('divDate').value;
  
  if (!ticker || !amount || amount <= 0 || !date) {
    toast('Remplissez tous les champs', 'warn');
    return;
  }
  
  const dividends = getDividends();
  dividends.push({
    id: Date.now(),
    ticker,
    amount,
    date,
    received: true
  });
  
  // Ajouter au cash
  const currentCash = getCash();
  saveCash(currentCash + amount);
  
  saveDividends(dividends);
  renderPortfolio();
  toast(`Dividende ${ticker} : +${fmtM(amount)} FCFA`, 'success');
}

// ═══════════════════════════════════════════════════════
// CALCULATEUR DE POSITION
// ═══════════════════════════════════════════════════════
window.calculatePosition = function() {
  const ticker = document.getElementById('calcTicker').value.trim().toUpperCase();
  const qty = parseInt(document.getElementById('calcQty').value);
  const targetPrice = parseFloat(document.getElementById('calcTarget').value);
  
  if (!ticker || !qty || qty <= 0) {
    toast('Remplissez les champs obligatoires', 'warn');
    return;
  }
  
  const currentPrice = getLatestPrice(ticker);
  if (!currentPrice) {
    toast('Cours actuel non disponible', 'warn');
    return;
  }
  
  const investment = qty * currentPrice;
  const currentValue = qty * currentPrice;
  
  let resultHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Investissement</span>
        <span style="color:var(--gold);font-weight:600">${fmtM(investment)} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Cours actuel</span>
        <span>${fmt(currentPrice, 2)} FCFA</span>
      </div>
  `;
  
  if (targetPrice && targetPrice > 0) {
    const targetValue = qty * targetPrice;
    const gain = targetValue - investment;
    const gainPct = (gain / investment) * 100;
    const color = gain >= 0 ? 'var(--green)' : 'var(--red)';
    
    resultHTML += `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Cours cible</span>
        <span>${fmt(targetPrice, 2)} FCFA</span>
      </div>
      <div style="width:100%;height:1px;background:var(--border2);margin:12px 0"></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Valeur cible</span>
        <span style="color:${color};font-weight:600">${fmtM(targetValue)} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--dim)">Gain/Perte potentiel</span>
        <span style="color:${color};font-weight:600">${gain >= 0 ? '+' : ''}${fmtM(gain)} FCFA (${fmt(gainPct, 2)}%)</span>
      </div>
    `;
  }
  
  // Moins-value si cours baisse de 10%, 20%, 50%
  resultHTML += `<div style="margin-top:16px"><div style="font-size:12px;color:var(--dim);margin-bottom:8px">📉 Scénarios de baisse :</div>`;
  [10, 20, 50].forEach(pct => {
    const dropPrice = currentPrice * (1 - pct / 100);
    const dropValue = qty * dropPrice;
    const loss = investment - dropValue;
    resultHTML += `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
        <span style="color:var(--dim)">-${pct}% (${fmt(dropPrice, 2)})</span>
        <span style="color:var(--red)">-${fmtM(loss)} FCFA</span>
      </div>
    `;
  });
  
  resultHTML += `</div></div>`;
  
  document.getElementById('calcResult').innerHTML = resultHTML;
}

// ═══════════════════════════════════════════════════════
// RENDU PRINCIPAL
// ═══════════════════════════════════════════════════════
window.renderPortfolio = function() {
  if (_pfRenderPending) return;
  _pfRenderPending = true;

  try {
    const pf = getPortfolio();
    const cash = getCash();
    const dividends = getDividends();

    const pfTotal = document.getElementById('pfTotal');
    const pfInvested = document.getElementById('pfInvested');
    const pfPL = document.getElementById('pfPL');
    const pfReturn = document.getElementById('pfReturn');
    const pfVol = document.getElementById('pfVolatility');
    const pfSharpe = document.getElementById('pfSharpe');
    const pfDD = document.getElementById('pfDrawdown');
    const pfBeta = document.getElementById('pfBeta');
    const pfTotalSub = document.getElementById('pfTotalSub');
    const pfPLSub = document.getElementById('pfPLSub');
    const pfCash = document.getElementById('pfCash');

    if (!pf.length) {
      resetEmptyState();
      return;
    }

    // Calculer le CMP
    const cmpMap = calculateCMP(pf);

    // ── Calculs par position ──
    let totalValue = 0, totalInvested = 0;
    const rows = [];
    const sectors = {};
    const pays = {};
    const dailyReturns = [];

    pf.forEach(p => {
      const currentPrice = getLatestPrice(p.ticker) || p.price;
      const cmpData = cmpMap[p.ticker.toUpperCase().trim()] || { value: p.price, positions: [p] };
      const cmp = cmpData.value;
      
      const value = p.qty * currentPrice;
      const invested = p.qty * cmp;
      const pl = value - invested;
      const plPct = invested > 0 ? (pl / invested) * 100 : 0;

      totalValue += value;
      totalInvested += invested;

      const s = getSector(p.ticker);
      sectors[s] = (sectors[s] || 0) + value;

      const py = getPays(p.ticker);
      pays[py] = (pays[py] || 0) + value;

      rows.push({ 
        ...p, 
        currentPrice, 
        cmp,
        cmpPositions: cmpData.positions,
        value, 
        invested, 
        pl, 
        plPct, 
        sector: s, 
        pays: py 
      });
    });

    const totalPL = totalValue - totalInvested;
    const totalReturn = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    // ── Historique pour stats ──
    const hist = getPortfolioHistory(window._pfPeriod || 99999);

    if (hist.totalValues.length >= 2) {
      for (let i = 1; i < hist.totalValues.length; i++) {
        if (hist.totalValues[i - 1] > 0) {
          dailyReturns.push((hist.totalValues[i] - hist.totalValues[i - 1]) / hist.totalValues[i - 1]);
        }
      }
    }

    const vol = calcVolatility(dailyReturns);
    const sharpe = calcSharpe(dailyReturns);
    const maxDD = calcMaxDrawdown(hist.values);

    // ── Update KPIs ──
    const totalWithCash = totalValue + cash;
    
    if (pfTotal) pfTotal.textContent = fmtM(totalWithCash) + ' FCFA';
    if (pfTotalSub) {
      pfTotalSub.textContent = totalValue >= totalInvested ? '↑ Portefeuille en hausse' : '↓ Portefeuille en baisse';
      pfTotalSub.style.color = totalValue >= totalInvested ? 'var(--green)' : 'var(--red)';
    }
    if (pfInvested) pfInvested.textContent = fmtM(totalInvested) + ' FCFA';
    if (pfCash) pfCash.textContent = fmtM(cash) + ' FCFA (liquide)';
    if (pfPL) {
      pfPL.textContent = (totalPL >= 0 ? '+' : '') + fmtM(totalPL) + ' FCFA';
      pfPL.style.color = totalPL >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (pfPLSub) {
      pfPLSub.textContent = totalReturn >= 0 ? `+${fmt(totalReturn, 2)}% de rentabilité` : `${fmt(totalReturn, 2)}% de rentabilité`;
      pfPLSub.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (pfReturn) {
      pfReturn.textContent = fmt(totalReturn, 2) + '%';
      pfReturn.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
    }

    if (pfVol) pfVol.textContent = (vol > 0 && hist.totalValues.length >= 2) ? fmt(vol * 100, 2) + '%' : '—';
    if (pfSharpe) pfSharpe.textContent = (sharpe !== 0 && hist.totalValues.length >= 2) ? fmt(sharpe, 2) : '—';
    if (pfDD) pfDD.textContent = (maxDD > 0 && hist.totalValues.length >= 2) ? '-' + fmt(maxDD, 2) + '%' : '—';
    if (pfBeta) pfBeta.textContent = '—';

    // ── Tableau avec historique des achats ──
    const tbody = document.getElementById('pfTable');
    if (tbody) {
      tbody.innerHTML = rows.map(p => {
        const priceFound = getLatestPrice(p.ticker) !== null;
        const high52 = get52WeekHigh(p.ticker);
        const low52 = get52WeekLow(p.ticker);
        
        // Historique des achats pour ce ticker
        const purchaseHistory = p.cmpPositions.map(pos => 
          `<div style="font-size:10px;color:var(--dim);padding:2px 0">
            📅 ${fmtDate(pos.date)} — ${fmt(pos.qty)} actions à ${fmt(pos.price, 2)} FCFA
          </div>`
        ).join('');
        
        return `
          <tr>
            <td style="padding:10px 12px;">
              <div style="font-family:var(--mono);color:var(--gold);font-weight:600">${p.ticker}</div>
              <div style="font-size:10px;color:var(--dim)">${p.pays}</div>
              <details style="margin-top:4px">
                <summary style="font-size:10px;color:var(--gold);cursor:pointer">📋 ${p.cmpPositions.length} achat(s)</summary>
                <div style="padding:4px 0">${purchaseHistory}</div>
              </details>
            </td>
            <td style="padding:10px 12px;text-align:right">${fmt(p.qty)}</td>
            <td style="padding:10px 12px;text-align:right;font-family:var(--mono);color:var(--gold)">${fmt(p.cmp, 2)}</td>
            <td style="padding:10px 12px;text-align:right;color:${priceFound ? 'inherit' : 'var(--dim)'}">${fmt(p.currentPrice, 2)}${!priceFound ? ' <small>(est.)</small>' : ''}</td>
            <td style="padding:10px 12px;text-align:right;color:${p.pl>=0?'var(--green)':'var(--red)'};font-weight:600">${p.pl >= 0 ? '+' : ''}${fmtM(p.pl)}</td>
            <td style="padding:10px 12px;text-align:right;color:${p.plPct>=0?'var(--green)':'var(--red)'}">${fmt(p.plPct, 2)}%</td>
            <td style="padding:10px 12px;text-align:right">${fmtM(p.value)}</td>
            <td style="padding:10px 12px;text-align:right">${fmt(totalValue > 0 ? (p.value/totalValue*100) : 0, 2)}%</td>
            <td style="padding:10px 12px;text-align:right">${high52 ? fmt(high52, 2) : '—'}</td>
            <td style="padding:10px 12px;text-align:right">${low52 ? fmt(low52, 2) : '—'}</td>
            <td style="padding:10px 12px;text-align:center">
              <button onclick="removePosition(${p.id})" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--dim);font-size:11px;cursor:pointer">🗑</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // ── Compteur ──
    const countEl = document.getElementById('pfPositionCount');
    if (countEl) countEl.textContent = `${pf.length} position${pf.length > 1 ? 's' : ''} | ${fmtM(cash)} FCFA liquide`;

    // ── Dividendes reçus ──
    const divEl = document.getElementById('dividendList');
    if (divEl) {
      const totalDividends = dividends.reduce((s, d) => s + d.amount, 0);
      divEl.innerHTML = `
        <div style="padding:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <span style="color:var(--dim)">Total dividendes perçus</span>
            <span style="color:var(--gold);font-weight:600">${fmtM(totalDividends)} FCFA</span>
          </div>
          ${dividends.length ? dividends.slice(-5).map(d => `
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border2)">
              <span>${d.ticker} — ${fmtDate(d.date)}</span>
              <span style="color:var(--green)">+${fmtM(d.amount)}</span>
            </div>
          `).join('') : '<div style="font-size:12px;color:var(--dim)">Aucun dividende enregistré</div>'}
        </div>
      `;
    }

    // ── GRAPHIQUES ──
    renderPortfolioCharts(rows, totalValue, sectors, pays, hist);
    renderConcentration(rows, totalValue);
    renderDividends(rows);
    renderBenchmark(rows, hist);
    renderCorrelationMatrix(pf);

  } finally {
    _pfRenderPending = false;
  }
}

// ═══════════════════════════════════════════════════════
// GRAPHIQUES (inchangés mais optimisés)
// ═══════════════════════════════════════════════════════
function renderPortfolioCharts(rows, totalValue, sectors, pays, hist) {
  if (typeof Chart === 'undefined') return;

  const valueCanvas = document.getElementById('chartPortfolioValue');
  if (valueCanvas) {
    if (pfValueChartInst) { pfValueChartInst.destroy(); pfValueChartInst = null; }
    if (!hist.dates.length || !hist.values.length) {
      const ctx = valueCanvas.getContext('2d');
      ctx.clearRect(0, 0, valueCanvas.width, valueCanvas.height);
      ctx.font = '14px DM Sans';
      ctx.fillStyle = 'rgba(245,240,232,0.3)';
      ctx.textAlign = 'center';
      ctx.fillText('Données historiques insuffisantes', valueCanvas.width / 2, valueCanvas.height / 2);
      return;
    }

    const labels = hist.dates.map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    const data = hist.totalValues || hist.values;

    pfValueChartInst = new Chart(valueCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Valeur du portefeuille',
          data: data,
          borderColor: '#B8964E',
          backgroundColor: 'rgba(184,150,78,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        ...chartOpts,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1610',
            borderColor: 'rgba(184,150,78,0.3)',
            borderWidth: 1,
            callbacks: { label: ctx => ' ' + fmtM(ctx.parsed.y) + ' FCFA' }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, maxTicksLimit: 6 } },
          y: { position: 'right', grid: { color: 'rgba(184,150,78,0.06)' }, ticks: { color: 'rgba(245,240,232,0.3)', font: { size: 10 }, callback: v => fmtM(v) } }
        }
      }
    });
  }

  const sectorCanvas = document.getElementById('chartSectorAlloc');
  if (sectorCanvas) {
    if (pfSectorChartInst) { pfSectorChartInst.destroy(); pfSectorChartInst = null; }
    const sectorLabels = Object.keys(sectors);
    const sectorData = Object.values(sectors);
    const colors = ['#B8964E', '#4ADE80', '#F87171', '#60A5FA', '#A78BFA', '#FBBF24', '#34D399', '#F472B6', '#818CF8', '#FB923C'];
    
    if (!sectorLabels.length) {
      const ctx = sectorCanvas.getContext('2d');
      ctx.clearRect(0, 0, sectorCanvas.width, sectorCanvas.height);
      ctx.fillText('Aucune donnée', sectorCanvas.width / 2, sectorCanvas.height / 2);
      return;
    }
    
    pfSectorChartInst = new Chart(sectorCanvas, {
      type: 'doughnut',
      data: { labels: sectorLabels, datasets: [{ data: sectorData, backgroundColor: colors, borderColor: '#1A1610', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: 'rgba(245,240,232,0.6)', font: { size: 11 }, boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed / totalValue * 100, 1)}%` } } }, cutout: '60%' }
    });
  }

  const geoCanvas = document.getElementById('chartGeoAlloc');
  if (geoCanvas) {
    if (pfGeoChartInst) { pfGeoChartInst.destroy(); pfGeoChartInst = null; }
    const geoLabels = Object.keys(pays);
    const geoData = Object.values(pays);
    const geoColors = ['#B8964E', '#4ADE80', '#60A5FA', '#F87171', '#A78BFA', '#FBBF24'];
    
    if (!geoLabels.length) {
      const ctx = geoCanvas.getContext('2d');
      ctx.clearRect(0, 0, geoCanvas.width, geoCanvas.height);
      ctx.fillText('Aucune donnée', geoCanvas.width / 2, geoCanvas.height / 2);
      return;
    }
    
    pfGeoChartInst = new Chart(geoCanvas, {
      type: 'doughnut',
      data: { labels: geoLabels, datasets: [{ data: geoData, backgroundColor: geoColors, borderColor: '#1A1610', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: 'rgba(245,240,232,0.6)', font: { size: 11 }, boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed / totalValue * 100, 1)}%` } } }, cutout: '60%' }
    });
  }

  const plCanvas = document.getElementById('chartPortfolioPL');
  if (plCanvas) {
    if (pfPLChartInst) { pfPLChartInst.destroy(); pfPLChartInst = null; }
    if (!hist.dates.length || !hist.pls.length) {
      const ctx = plCanvas.getContext('2d');
      ctx.clearRect(0, 0, plCanvas.width, plCanvas.height);
      ctx.fillText('Données insuffisantes', plCanvas.width / 2, plCanvas.height / 2);
      return;
    }

    const plLabels = hist.dates.map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    const plData = hist.pls;
    const plColors = plData.map(v => v >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)');

    pfPLChartInst = new Chart(plCanvas, {
      type: 'bar',
      data: { labels: plLabels, datasets: [{ data: plData, backgroundColor: plColors, borderRadius: 2 }] },
      options: { ...chartOpts, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + (ctx.parsed.y >= 0 ? '+' : '') + fmtM(ctx.parsed.y) + ' FCFA' } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } }, y: { position: 'right', grid: { color: 'rgba(184,150,78,0.06)' }, ticks: { callback: v => fmtM(v) } } } }
    });
  }
}

// ═══════════════════════════════════════════════════════
// CONCENTRATION, DIVIDENDES, BENCHMARK, CORRÉLATION
// (inchangés — voir version précédente)
// ═══════════════════════════════════════════════════════
function renderConcentration(rows, totalValue) {
  const el = document.getElementById('concentrationStats');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions</div>';
    return;
  }
  const top3 = [...rows].sort((a, b) => b.value - a.value).slice(0, 3);
  const top3Pct = top3.reduce((s, r) => s + (r.value / totalValue * 100), 0);
  const hhi = rows.reduce((s, r) => s + Math.pow(r.value / totalValue * 100, 2), 0);
  let hhiLabel = 'Faible';
  if (hhi > 2500) hhiLabel = 'Élevée';
  else if (hhi > 1500) hhiLabel = 'Modérée';

  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Top 3 positions</span>
        <span style="font-size:14px;font-weight:600;color:var(--gold)">${fmt(top3Pct, 1)}%</span>
      </div>
      <div style="width:100%;height:6px;background:var(--border2);border-radius:3px;margin-bottom:16px;overflow:hidden">
        <div style="width:${top3Pct}%;height:100%;background:var(--gold);border-radius:3px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Indice HHI</span>
        <span style="font-size:14px;font-weight:600;color:${hhiLabel === 'Élevée' ? 'var(--red)' : hhiLabel === 'Modérée' ? 'var(--gold)' : 'var(--green)'}">${fmt(hhi, 0)} — ${hhiLabel}</span>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-top:8px">
        ${top3.map((r, i) => `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>${i+1}. ${r.ticker} (${r.pays})</span><span style="color:var(--cream)">${fmt(r.value/totalValue*100, 1)}%</span></div>`).join('')}
      </div>
    </div>
  `;
}

function renderDividends(rows) {
  const el = document.getElementById('dividendStats');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions</div>';
    return;
  }
  let totalDividend = 0;
  const divDetails = [];
  rows.forEach(r => {
    const yield_ = getDividendYield(r.ticker);
    const divEstime = r.value * (yield_ / 100);
    totalDividend += divEstime;
    if (yield_ > 0) divDetails.push({ ticker: r.ticker, yield: yield_, value: r.value, div: divEstime });
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const portfolioYield = totalValue > 0 ? (totalDividend / totalValue * 100) : 0;

  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <span style="font-size:12px;color:var(--dim)">Rendement estimé (dividende)</span>
        <span style="font-size:18px;font-weight:600;color:var(--gold)">${fmt(portfolioYield, 2)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <span style="font-size:12px;color:var(--dim)">Dividendes annuels estimés</span>
        <span style="font-size:14px;font-weight:600;color:var(--green)">+${fmtM(totalDividend)} FCFA</span>
      </div>
      <div style="font-size:11px;color:var(--dim)">
        ${divDetails.length ? divDetails.map(d => `<div style="display:flex;justify-content:space-between;margin-bottom:4px;padding:4px 0;border-bottom:1px solid var(--border2)"><span>${d.ticker} <small style="color:var(--gold)">(${fmt(d.yield, 2)}%)</small></span><span style="color:var(--cream)">${fmtM(d.div)}</span></div>`).join('') : '<div style="text-align:center;padding:8px">Aucune donnée de dividende disponible</div>'}
      </div>
    </div>
  `;
}

function renderBenchmark(rows, hist) {
  const el = document.getElementById('benchmarkStats');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px;padding:20px">Chargez des positions</div>';
    return;
  }
  let brvmReturn = 0, brvmDataFound = false;
  if (Array.isArray(window.allIndices) && window.allIndices.length > 0) {
    const composite = window.allIndices.filter(i => (i.nom || i.ticker || '').toUpperCase().includes('COMPOSITE'));
    if (composite.length >= 2) {
      const sorted = composite.sort((a, b) => new Date(a.date_seance || 0) - new Date(b.date_seance || 0));
      const first = sorted[0], last = sorted[sorted.length - 1];
      const firstVal = +(first.valeur || first.cours || first.dernier || 0);
      const lastVal = +(last.valeur || last.cours || last.dernier || 0);
      if (firstVal > 0) { brvmReturn = (lastVal - firstVal) / firstVal * 100; brvmDataFound = true; }
    }
  }
  const pfReturn = hist.totalValues.length >= 2 && hist.totalValues[0] > 0 ? (hist.totalValues[hist.totalValues.length - 1] - hist.totalValues[0]) / hist.totalValues[0] * 100 : 0;
  const outperformance = pfReturn - brvmReturn;

  if (!brvmDataFound) {
    el.innerHTML = `<div style="padding:16px;text-align:center"><p style="color:var(--dim);font-size:13px">Données BRVM Composite non disponibles</p></div>`;
    return;
  }
  el.innerHTML = `
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px"><span style="font-size:12px;color:var(--dim)">Votre portefeuille</span><span style="font-size:14px;font-weight:600;color:${pfReturn >= 0 ? 'var(--green)' : 'var(--red)'}">${pfReturn >= 0 ? '+' : ''}${fmt(pfReturn, 2)}%</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px"><span style="font-size:12px;color:var(--dim)">BRVM Composite</span><span style="font-size:14px;font-weight:600;color:${brvmReturn >= 0 ? 'var(--green)' : 'var(--red)'}">${brvmReturn >= 0 ? '+' : ''}${fmt(brvmReturn, 2)}%</span></div>
      <div style="width:100%;height:1px;background:var(--border2);margin:12px 0"></div>
      <div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--dim)">Surperformance</span><span style="font-size:16px;font-weight:600;color:${outperformance >= 0 ? 'var(--green)' : 'var(--red)'}">${outperformance >= 0 ? '+' : ''}${fmt(outperformance, 2)}%</span></div>
    </div>
  `;
}

function renderCorrelationMatrix(pf) {
  const el = document.getElementById('correlationMatrix');
  if (!el) return;
  if (pf.length < 2) { el.innerHTML = 'Ajoutez au moins 2 positions'; return; }
  
  const tickers = pf.map(p => p.ticker.toUpperCase().trim());
  const returns = {};
  tickers.forEach(t => {
    const prices = getTickerHistory(t).map(c => +(c.cours_cloture || c.cours_normal || c.cours || 0)).filter(v => v > 0);
    returns[t] = [];
    for (let i = 1; i < prices.length; i++) returns[t].push((prices[i] - prices[i - 1]) / prices[i - 1]);
  });
  
  const minLen = Math.min(...Object.values(returns).map(r => r.length));
  if (minLen < 5) { el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:13px">Données insuffisantes</div>'; return; }
  tickers.forEach(t => { returns[t] = returns[t].slice(-minLen); });

  let html = '<div style="display:grid;gap:2px;padding:8px;overflow:auto">';
  html += '<div style="display:contents"><div style="width:50px"></div>';
  tickers.forEach(t => { html += `<div style="width:50px;text-align:center;font-size:10px;color:var(--gold);font-family:var(--mono);padding:4px 2px">${t}</div>`; });
  html += '</div>';
  
  tickers.forEach(t1 => {
    html += '<div style="display:contents">';
    html += `<div style="width:50px;text-align:right;font-size:10px;color:var(--gold);font-family:var(--mono);padding:4px 2px">${t1}</div>`;
    tickers.forEach(t2 => {
      const corr = t1 === t2 ? 1 : calcCorrelation(returns[t1], returns[t2]);
      const color = corr > 0.7 ? 'rgba(248,113,113,0.7)' : corr > 0.3 ? 'rgba(251,191,36,0.5)' : corr > -0.3 ? 'rgba(245,240,232,0.1)' : corr > -0.7 ? 'rgba(74,222,128,0.3)' : 'rgba(74,222,128,0.6)';
      html += `<div style="width:50px;height:32px;display:flex;align-items:center;justify-content:center;background:${color};border-radius:3px;font-size:10px;color:var(--cream);font-family:var(--mono)">${fmt(corr, 2)}</div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="display:flex;gap:12px;justify-content:center;margin-top:8px;font-size:10px;color:var(--dim)"><span>🔴 Élevée</span><span>🟡 Modérée</span><span>⚪ Faible</span><span>🟢 Négative</span></div>';
  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// ÉTAT VIDE
// ═══════════════════════════════════════════════════════
function resetEmptyState() {
  ['pfTotal','pfInvested','pfPL','pfReturn','pfVolatility','pfSharpe','pfDrawdown','pfBeta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  const tbody = document.getElementById('pfTable');
  if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--dim)">Aucune position. Ajoutez-en une ci-dessus.</td></tr>';
  const countEl = document.getElementById('pfPositionCount');
  if (countEl) countEl.textContent = '0 position';
  
  [pfValueChartInst, pfSectorChartInst, pfGeoChartInst, pfPLChartInst].forEach(chart => {
    if (chart) { chart.destroy(); }
  });
  pfValueChartInst = pfSectorChartInst = pfGeoChartInst = pfPLChartInst = null;
}

// ═══════════════════════════════════════════════════════
// PÉRIODE & INIT
// ═══════════════════════════════════════════════════════
let _pfPeriodTimeout = null;
window.setPortfolioPeriod = function(days, btn) {
  document.querySelectorAll('.year-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  window._pfPeriod = days;
  if (_pfPeriodTimeout) clearTimeout(_pfPeriodTimeout);
  _pfPeriodTimeout = setTimeout(() => renderPortfolio(), 150);
}

window.initPortefeuille = function() {
  console.log('initPortefeuille appelé');
  window._pfPeriod = window._pfPeriod || 99999;
  populateTickerSelect();
  window.addEventListener('dataLoaded', () => { populateTickerSelect(); renderPortfolio(); }, { once: true });
  renderPortfolio();
}
