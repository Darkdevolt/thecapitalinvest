// ═══════════════════════════════════════
// VIEW, Analyse Fondamentale Avancée
// ═══════════════════════════════════════

let _fundMethod = 'tcam';
let _fundCssLoaded = false;

function ensureFundamentalStyles() {
  if (_fundCssLoaded || document.getElementById('fundamental-view-css')) return;
  const link = document.createElement('link');
  link.id = 'fundamental-view-css';
  link.rel = 'stylesheet';
  link.href = 'app/css/analyse-fondamentale.css?v=1';
  document.head.appendChild(link);
  _fundCssLoaded = true;
}

function setFundMethod(method, btn) {
  _fundMethod = method;
  document.querySelectorAll('#view-analyse-fondamentale .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadFundAnalysis();
}

function formatFundNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ', ';
  return fmtM(n);
}

function safeRate(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

async function loadFundAnalysis() {
  ensureFundamentalStyles();

  const select = document.getElementById('fundTickerSelect');
  const content = document.getElementById('fundContent');
  if (!select || !content) return;

  if (select.options.length <= 1 && typeof populateTickerSelects === 'function') {
    populateTickerSelects();
  }

  const ticker = select.value;
  if (!ticker) {
    content.innerHTML = `
      <div class="fund-empty">
        <div class="fund-empty-mark">FA</div>
        <h2>Sélectionnez un titre</h2>
        <p>Choisissez un ticker pour afficher les données financières, les tendances historiques, le forecast et la valorisation DCF.</p>
      </div>`;
    return;
  }

  const fins = (Array.isArray(allFinancials) ? allFinancials : [])
    .filter(f => String(f.ticker).toUpperCase() === String(ticker).toUpperCase())
    .sort((a,b) => Number(a.annee) - Number(b.annee));
  const cours = (Array.isArray(allCours) ? allCours : []).find(c => String(c.ticker).toUpperCase() === String(ticker).toUpperCase()) || {};
  const cp = parseFloat(cours.cours) || 0;

  if (fins.length < 2) {
    content.innerHTML = `<div class="fund-empty"><div class="fund-empty-mark">!</div><h2>Données insuffisantes</h2><p>Il faut au moins 2 années de données financières pour calculer une tendance historique et un forecast.</p></div>`;
    return;
  }

  const annual = fins.filter(f => f.periode === 'annuel' || !f.periode);
  if (annual.length < 2) {
    content.innerHTML = `<div class="fund-empty"><div class="fund-empty-mark">!</div><h2>Pas assez de données annuelles</h2><p>Les projections fondamentales utilisent les états financiers annuels disponibles.</p></div>`;
    return;
  }

  const years = annual.map(f => Number(f.annee));
  const rn = annual.map(f => safeRate(f.resultat_net));
  const ca = annual.map(f => safeRate(f.chiffre_affaires));
  const fcf = annual.map(f => safeRate(f.cash_flow_operationnel) - safeRate(f.capex));

  const tcamRN = calcTCAM(rn);
  const tcamCA = calcTCAM(ca);
  const tcamFCF = calcTCAM(fcf);

  let forecastRN = [], forecastCA = [], forecastFCF = [], forecastYears = [];
  const nbForecast = 3;
  const lastY = years[years.length - 1];

  if (_fundMethod === 'tcam') {
    forecastCA = forecastSeries(ca, tcamCA, nbForecast);
    forecastRN = forecastSeries(rn, tcamRN, nbForecast);
    forecastFCF = forecastSeries(fcf, tcamFCF, nbForecast);
  } else {
    const regCA = linearRegression(years, ca);
    const regRN = linearRegression(years, rn);
    const regFCF = linearRegression(years, fcf);
    for (let i = 1; i <= nbForecast; i++) {
      const nextYear = lastY + i;
      forecastCA.push(regCA.slope * nextYear + regCA.intercept);
      forecastRN.push(regRN.slope * nextYear + regRN.intercept);
      forecastFCF.push(regFCF.slope * nextYear + regFCF.intercept);
    }
  }
  for (let i = 1; i <= nbForecast; i++) forecastYears.push(lastY + i);

  const waccInput = document.getElementById('fundWACC');
  const growthInput = document.getElementById('fundGrowth');
  const projInput = document.getElementById('fundProjYears');
  const wacc = parseFloat(waccInput?.value || 10) / 100;
  const croissanceLT = parseFloat(growthInput?.value || 2) / 100;
  const nbProj = Math.max(1, Math.min(5, parseInt(projInput?.value || 3, 10)));

  const dcfValid = Number.isFinite(wacc) && Number.isFinite(croissanceLT) && wacc > croissanceLT && wacc > 0;
  let sumPV = 0, terminalValue = 0, pvTerminal = 0, enterpriseValue = 0;

  if (dcfValid) {
    for (let i = 0; i < Math.min(nbProj, forecastFCF.length); i++) {
      sumPV += forecastFCF[i] / Math.pow(1 + wacc, i + 1);
    }
    const lastFCF = forecastFCF[Math.min(nbProj, forecastFCF.length) - 1];
    terminalValue = lastFCF * (1 + croissanceLT) / (wacc - croissanceLT);
    pvTerminal = terminalValue / Math.pow(1 + wacc, nbProj);
    enterpriseValue = sumPV + pvTerminal;
  }

  const r2 = calcR2(years, rn);
  const relevance = evaluateRelevance(tcamRN, tcamCA, r2, rn);
  const lastActual = annual[annual.length - 1];
  const shares = Number(lastActual.nombre_actions) || 0;
  const fairValue = dcfValid && shares > 0 ? enterpriseValue / shares : 0;
  const upside = fairValue > 0 && cp > 0 ? (fairValue / cp - 1) * 100 : null;
  const latestCA = safeRate(lastActual.chiffre_affaires);
  const latestRN = safeRate(lastActual.resultat_net);
  const latestFCF = fcf[fcf.length - 1];
  const margin = latestCA !== 0 ? latestRN / latestCA * 100 : null;
  const fcfMargin = latestCA !== 0 ? latestFCF / latestCA * 100 : null;

  const trendClass = relevance.label === 'Forte' ? 'positive' : relevance.label === 'Faible' ? 'negative' : 'neutral';
  const upsideClass = upside == null ? 'neutral' : upside >= 0 ? 'positive' : 'negative';

  content.innerHTML = `
    <div class="fund-hero">
      <div>
        <div class="fund-kicker">ANALYSE FONDAMENTALE · ${ticker}</div>
        <h2>${ticker}, Lecture fondamentale</h2>
        <p>Historique financier, trajectoire de croissance, hypothèses de projection et valorisation intrinsèque. Les hypothèses restent modifiables.</p>
      </div>
      <div class="fund-market-box">
        <span>Cours actuel</span>
        <strong>${cp ? fmt(cp) + ' FCFA' : ', '}</strong>
        <small>Dernière cotation disponible</small>
      </div>
    </div>

    <div class="fund-kpi-grid">
      <div class="fund-kpi"><span>CA · ${lastActual.annee}</span><strong>${formatFundNumber(latestCA)}</strong><small>TCAM ${Number.isFinite(tcamCA) ? tcamCA.toFixed(1) + '%' : ', '}</small></div>
      <div class="fund-kpi"><span>Résultat net</span><strong>${formatFundNumber(latestRN)}</strong><small>TCAM ${Number.isFinite(tcamRN) ? tcamRN.toFixed(1) + '%' : ', '}</small></div>
      <div class="fund-kpi"><span>Marge nette</span><strong>${margin == null ? ', ' : margin.toFixed(1) + '%'}</strong><small>FCF margin ${fcfMargin == null ? ', ' : fcfMargin.toFixed(1) + '%'}</small></div>
      <div class="fund-kpi"><span>Qualité du forecast</span><strong class="${trendClass}">${relevance.label}</strong><small>${relevance.reason}</small></div>
    </div>

    <div class="fund-toolbar card">
      <div class="fund-methods">
        <div><span class="fund-control-label">Méthode de projection</span><strong>${_fundMethod === 'tcam' ? 'TCAM historique' : 'Régression linéaire'}</strong></div>
        <div class="fund-method-switch">
          <button class="filter-btn ${_fundMethod === 'tcam' ? 'active' : ''}" onclick="setFundMethod('tcam',this)">TCAM</button>
          <button class="filter-btn ${_fundMethod === 'regression' ? 'active' : ''}" onclick="setFundMethod('regression',this)">Régression</button>
        </div>
      </div>
    </div>

    <div class="grid-2 fund-main-grid">
      <div class="card">
        <div class="card-header"><div><div class="card-title">Hypothèses de valorisation</div><div class="fund-section-note">Modifiez une hypothèse pour recalculer immédiatement.</div></div></div>
        <div class="card-body">
          <div class="fund-params">
            <label><span>WACC</span><input type="number" id="fundWACC" value="${(wacc * 100).toFixed(1)}" step="0.1" min="1" max="30" onchange="loadFundAnalysis()"><small>Coût moyen pondéré du capital</small></label>
            <label><span>Croissance LT</span><input type="number" id="fundGrowth" value="${(croissanceLT * 100).toFixed(1)}" step="0.1" min="0" max="10" onchange="loadFundAnalysis()"><small>Croissance perpétuelle</small></label>
            <label><span>Projection</span><select id="fundProjYears" onchange="loadFundAnalysis()"><option value="3" ${nbProj===3?'selected':''}>3 ans</option><option value="5" ${nbProj===5?'selected':''}>5 ans</option></select><small>Horizon explicite du DCF</small></label>
          </div>
          ${dcfValid ? '' : '<div class="fund-warning"><strong>Hypothèses DCF invalides.</strong> Le WACC doit être strictement supérieur à la croissance à long terme. La valeur intrinsèque n’est pas calculée tant que ce point n’est pas corrigé.</div>'}
        </div>
      </div>

      <div class="card fund-valuation-card">
        <div class="card-header"><div><div class="card-title">Valorisation DCF</div><div class="fund-section-note">Valeur d’entreprise issue des FCF projetés.</div></div></div>
        <div class="card-body">
          <div class="fund-value-highlight"><span>Valeur par action</span><strong>${fairValue ? fmt(fairValue) + ' FCFA' : ', '}</strong><b class="${upsideClass}">${upside == null ? ', ' : (upside >= 0 ? '+' : '') + upside.toFixed(1) + '%'}</b></div>
          <div class="fin-row"><span class="fin-label">Valeur d'entreprise</span><span class="fin-value">${dcfValid ? formatFundNumber(enterpriseValue) : ', '}</span></div>
          <div class="fin-row"><span class="fin-label">Valeur terminale</span><span class="fin-value">${dcfValid ? formatFundNumber(terminalValue) : ', '}</span></div>
          <div class="fin-row"><span class="fin-label">PV des FCF</span><span class="fin-value">${dcfValid ? formatFundNumber(sumPV) : ', '}</span></div>
          <div class="fin-row"><span class="fin-label">Nombre d’actions</span><span class="fin-value">${shares ? fmt(shares) : ', '}</span></div>
          <div class="fund-explain"><strong>Comment lire ce résultat ?</strong><p>La valeur par action est une estimation fondée sur les flux de trésorerie projetés et les hypothèses saisies. Elle ne constitue pas un objectif de cours et devient très sensible au WACC et à la croissance terminale.</p></div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div><div class="card-title">Prévisions financières</div><div class="fund-section-note">${_fundMethod === 'tcam' ? 'Projection par croissance historique composée.' : 'Projection par tendance linéaire des années disponibles.'}</div></div></div>
        <div class="table-wrap"><table class="forecast-table"><thead><tr><th>Année</th><th>CA</th><th>Résultat net</th><th>FCF</th></tr></thead><tbody>${forecastYears.map((y,i)=>`<tr><td><strong>${y}</strong></td><td>${formatFundNumber(forecastCA[i])}</td><td>${formatFundNumber(forecastRN[i])}</td><td>${formatFundNumber(forecastFCF[i])}</td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-header"><div><div class="card-title">Lecture des fondamentaux</div><div class="fund-section-note">Points clés à vérifier avant d’utiliser le DCF.</div></div></div>
        <div class="card-body fund-checks">
          <div class="fund-check"><span class="${tcamCA >= 0 ? 'positive' : 'negative'}">●</span><div><strong>Chiffre d’affaires</strong><p>TCAM historique : ${Number.isFinite(tcamCA) ? tcamCA.toFixed(1) + '%' : 'non calculable'}.</p></div></div>
          <div class="fund-check"><span class="${tcamRN >= 0 ? 'positive' : 'negative'}">●</span><div><strong>Résultat net</strong><p>TCAM historique : ${Number.isFinite(tcamRN) ? tcamRN.toFixed(1) + '%' : 'non calculable'}.</p></div></div>
          <div class="fund-check"><span class="${r2 >= 0.5 ? 'positive' : 'neutral'}">●</span><div><strong>Stabilité de la tendance</strong><p>R² de la tendance du résultat net : ${Number.isFinite(r2) ? r2.toFixed(2) : ', '}.</p></div></div>
          <div class="fund-check"><span class="${upsideClass}">●</span><div><strong>Écart au cours</strong><p>${upside == null ? 'Valorisation indisponible.' : upside >= 0 ? 'La valeur DCF ressort au-dessus du cours actuel.' : 'La valeur DCF ressort sous le cours actuel.'}</p></div></div>
        </div>
      </div>
    </div>

    <div class="fund-methodology">
      <strong>Méthodologie</strong>
      <span>TCAM = croissance annuelle composée des données disponibles.</span>
      <span>Régression = tendance linéaire sur les années disponibles.</span>
      <span>DCF = valeur actuelle des FCF projetés + valeur terminale.</span>
      <span>Les résultats dépendent directement de la qualité et de la profondeur des données financières.</span>
    </div>
  `;
}

function calcTCAM(series) {
  const values = series.map(Number);
  if (values.length < 2) return NaN;
  const first = values[0], last = values[values.length - 1];
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last < 0) return NaN;
  return (Math.pow(last / first, 1 / (values.length - 1)) - 1) * 100;
}

function forecastSeries(series, tcamPercent, nbYears) {
  const last = Number(series[series.length - 1]);
  if (!Number.isFinite(last) || !Number.isFinite(tcamPercent)) return Array(nbYears).fill(NaN);
  const rate = tcamPercent / 100;
  return Array.from({length: nbYears}, (_, i) => last * Math.pow(1 + rate, i + 1));
}

function linearRegression(x, y) {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: Number(y[y.length - 1]) || 0 };
  let sumX=0, sumY=0, sumXY=0, sumX2=0;
  for (let i=0; i<n; i++) { sumX += x[i]; sumY += y[i]; sumXY += x[i]*y[i]; sumX2 += x[i]*x[i]; }
  const den = n*sumX2 - sumX*sumX;
  if (den === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n*sumXY - sumX*sumY) / den;
  const intercept = (sumY - slope*sumX) / n;
  return { slope, intercept };
}

function calcR2(x, y) {
  const n = x.length;
  if (n < 3) return NaN;
  const r = linearRegression(x, y);
  const yMean = y.reduce((a,b)=>a+b,0)/n;
  let ssRes = 0, ssTot = 0;
  for (let i=0; i<n; i++) { const f = r.slope*x[i] + r.intercept; ssRes += Math.pow(y[i]-f,2); ssTot += Math.pow(y[i]-yMean,2); }
  return ssTot === 0 ? 1 : 1 - ssRes/ssTot;
}

function evaluateRelevance(tcamRN, tcamCA, r2, rnSeries) {
  let score = 0;
  const reasons = [];
  if (isNaN(tcamRN)) { score -= 2; reasons.push('TCAM RN non calculable'); }
  else if (Math.abs(tcamRN) > 40) { score -= 2; reasons.push('TCAM RN extrême'); }
  if (isNaN(tcamCA)) { score -= 1; reasons.push('TCAM CA non calculable'); }
  if (!isNaN(r2) && r2 < 0.5) { score -= 1; reasons.push('R² faible'); }
  if (rnSeries.length >= 3) {
    const changes = [];
    for (let i=1; i<rnSeries.length; i++) if (rnSeries[i-1] !== 0) changes.push(Math.abs(rnSeries[i]/rnSeries[i-1]-1));
    if (changes.length) {
      const avgChange = changes.reduce((a,b)=>a+b,0)/changes.length;
      if (avgChange > 0.3) { score -= 1; reasons.push('Volatilité élevée'); }
    }
  }
  if (score >= -1) return { label: 'Forte', color: 'var(--green)', reason: 'Données relativement stables' };
  if (score === -2) return { label: 'Moyenne', color: 'var(--gold)', reason: reasons.join('; ') || 'Quelques réserves' };
  return { label: 'Faible', color: 'var(--red)', reason: reasons.join('; ') || 'Données instables' };
}
