// ═══════════════════════════════════════
// VIEW — Analyse Fondamentale Avancée
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// ANALYSE FONDAMENTALE AVANCÉE
// ═══════════════════════════════════════
function setFundMethod(method, btn) {
  _fundMethod = method;
  document.querySelectorAll('#view-analyse-fondamentale .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadFundAnalysis();
}

async function loadFundAnalysis() {
  if (document.getElementById('fundTickerSelect').options.length <= 1) {
    populateTickerSelects();
  }
  const ticker = document.getElementById('fundTickerSelect').value;
  if (!ticker) return;

  const fins = allFinancials.filter(f => f.ticker === ticker).sort((a,b) => a.annee - a.annee);
  const cours = allCours.find(c => c.ticker === ticker) || {};
  const cp = parseFloat(cours.cours) || 0;

  if (fins.length < 2) {
    document.getElementById('fundContent').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠</div><div class="empty-title">Données insuffisantes</div><div class="empty-text">Il faut au moins 2 années de données financières.</div></div>`;
    return;
  }

  const annual = fins.filter(f => f.periode === 'annuel' || !f.periode);
  if (annual.length < 2) {
    document.getElementById('fundContent').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠</div><div class="empty-title">Pas assez de données annuelles</div><div class="empty-text">Les forecasts nécessitent des états financiers annuels.</div></div>`;
    return;
  }

  const years = annual.map(f => f.annee);
  const rn = annual.map(f => f.resultat_net);
  const ca = annual.map(f => f.chiffre_affaires);
  const fcf = annual.map(f => (f.cash_flow_operationnel || 0) - (f.capex || 0));

  const tcamRN = calcTCAM(rn);
  const tcamCA = calcTCAM(ca);
  const tcamFCF = calcTCAM(fcf);

  let forecastRN = [], forecastCA = [], forecastFCF = [];
  let forecastYears = [];
  const nbForecast = 3;

  if (_fundMethod === 'tcam') {
    forecastCA = forecastSeries(ca, tcamCA, nbForecast);
    forecastRN = forecastSeries(rn, tcamRN, nbForecast);
    forecastFCF = forecastSeries(fcf, tcamFCF, nbForecast);
    const lastY = years[years.length-1];
    for (let i=1; i<=nbForecast; i++) forecastYears.push(lastY + i);
  } else {
    const regCA = linearRegression(years, ca);
    const regRN = linearRegression(years, rn);
    const regFCF = linearRegression(years, fcf);
    const lastYear = years[years.length-1];
    for (let i=1; i<=nbForecast; i++) {
      const nextYear = lastYear + i;
      forecastYears.push(nextYear);
      forecastCA.push(regCA.slope * nextYear + regCA.intercept);
      forecastRN.push(regRN.slope * nextYear + regRN.intercept);
      forecastFCF.push(regFCF.slope * nextYear + regFCF.intercept);
    }
  }

  const wacc = parseFloat(document.getElementById('fundWACC')?.value || 10) / 100;
  const croissanceLT = parseFloat(document.getElementById('fundGrowth')?.value || 2) / 100;
  const nbProj = parseInt(document.getElementById('fundProjYears')?.value || 3);

  let sumPV = 0;
  for (let i=0; i<Math.min(nbProj, forecastFCF.length); i++) {
    sumPV += forecastFCF[i] / Math.pow(1 + wacc, i+1);
  }
  const lastFCF = forecastFCF[Math.min(nbProj, forecastFCF.length)-1];
  const terminalValue = lastFCF * (1 + croissanceLT) / (wacc - croissanceLT);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, nbProj);
  const enterpriseValue = sumPV + pvTerminal;

  const r2 = calcR2(years, rn);
  const relevance = evaluateRelevance(tcamRN, tcamCA, r2, rn);

  const lastActual = annual[annual.length-1];

  const fundHTML = `
    <div class="grid-3" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-label">Dernier RN (${lastActual.annee})</div>
        <div class="stat-value">${fmtM(lastActual.resultat_net)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">TCAM RN hist.</div>
        <div class="stat-value">${tcamRN.toFixed(1)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pertinence</div>
        <div class="stat-value" style="color:${relevance.color}">${relevance.label}</div>
        <div class="stat-change" style="color:var(--dim);font-size:11px">${relevance.reason}</div>
      </div>
    </div>

    <div class="card mb20">
      <div class="card-header"><div class="card-title">Paramètres DCF & Forecast</div></div>
      <div class="card-body">
        <div class="fund-params">
          <div>
            <label>WACC (%)</label>
            <input type="number" id="fundWACC" value="10" step="0.1" min="1" max="20" onchange="loadFundAnalysis()">
          </div>
          <div>
            <label>Croissance LT (%)</label>
            <input type="number" id="fundGrowth" value="2" step="0.1" min="0" max="5" onchange="loadFundAnalysis()">
          </div>
          <div>
            <label>Années de projection</label>
            <select id="fundProjYears" onchange="loadFundAnalysis()">
              <option value="3" selected>3</option>
              <option value="5">5</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">Forecast (${_fundMethod === 'tcam' ? 'TCAM' : 'Régression'})</div></div>
        <div class="table-wrap">
          <table class="forecast-table">
            <thead><tr><th>Année</th><th>CA</th><th>Résultat Net</th><th>FCF</th></tr></thead>
            <tbody>
              ${forecastYears.map((y, i) => `
                <tr>
                  <td>${y}</td>
                  <td>${fmtM(forecastCA[i])}</td>
                  <td>${fmtM(forecastRN[i])}</td>
                  <td>${fmtM(forecastFCF[i])}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">DCF</div></div>
        <div class="card-body">
          <div class="fin-row"><span class="fin-label">Valeur d'entreprise</span><span class="fin-value">${fmtM(enterpriseValue)}</span></div>
          <div class="fin-row"><span class="fin-label">Valeur terminale</span><span class="fin-value">${fmtM(terminalValue)}</span></div>
          <div class="fin-row"><span class="fin-label">Somme PV FCF</span><span class="fin-value">${fmtM(sumPV)}</span></div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border2)">
            <div class="fin-row"><span class="fin-label">Nombre actions (approx.)</span><span class="fin-value">${fmt(lastActual.nombre_actions || 0)}</span></div>
            <div class="fin-row"><span class="fin-label">Valeur par action</span><span class="fin-value">${lastActual.nombre_actions && lastActual.nombre_actions > 0 ? fmt(enterpriseValue / lastActual.nombre_actions) + ' FCFA' : '—'}</span></div>
            <div class="fin-row"><span class="fin-label">Cours actuel</span><span class="fin-value">${fmt(cp)} FCFA</span></div>
            <div class="fin-row"><span class="fin-label">Potentiel</span><span class="fin-value" style="color:${cp && lastActual.nombre_actions && lastActual.nombre_actions > 0 ? (enterpriseValue / lastActual.nombre_actions > cp ? 'var(--green)' : 'var(--red)') : 'var(--dim)'}">
              ${cp && lastActual.nombre_actions && lastActual.nombre_actions > 0 ? ((enterpriseValue / lastActual.nombre_actions / cp - 1) * 100).toFixed(1) + '%' : '—'}
            </span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('fundContent').innerHTML = fundHTML;
}

function calcTCAM(series) {
  if (series.length < 2) return 0;
  const first = series[0], last = series[series.length-1];
  if (first === 0 || first < 0 && last > 0) return NaN;
  const n = series.length - 1;
  return (Math.pow(last / first, 1/n) - 1) * 100;
}

function forecastSeries(series, tcamPercent, nbYears) {
  const last = series[series.length-1];
  const rate = tcamPercent / 100;
  let res = [];
  for (let i=1; i<=nbYears; i++) {
    res.push(last * Math.pow(1 + rate, i));
  }
  return res;
}

function linearRegression(x, y) {
  const n = x.length;
  let sumX=0, sumY=0, sumXY=0, sumX2=0;
  for (let i=0; i<n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i]*y[i];
    sumX2 += x[i]*x[i];
  }
  const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
  const intercept = (sumY - slope*sumX) / n;
  return { slope, intercept };
}

function calcR2(x, y) {
  const n = x.length;
  if (n < 3) return NaN;
  const r = linearRegression(x, y);
  const yMean = y.reduce((a,b)=>a+b,0)/n;
  let ssRes = 0, ssTot = 0;
  for (let i=0; i<n; i++) {
    const f = r.slope * x[i] + r.intercept;
    ssRes += Math.pow(y[i] - f, 2);
    ssTot += Math.pow(y[i] - yMean, 2);
  }
  return 1 - ssRes/ssTot;
}

function evaluateRelevance(tcamRN, tcamCA, r2, rnSeries) {
  let score = 0;
  let reasons = [];
  if (isNaN(tcamRN)) { score -= 2; reasons.push('TCAM non calculable'); }
  else if (Math.abs(tcamRN) > 40) { score -= 2; reasons.push('TCAM extrême'); }
  if (!isNaN(r2) && r2 < 0.5) { score -= 1; reasons.push('R² faible'); }
  if (rnSeries.length >= 3) {
    const changes = [];
    for (let i=1; i<rnSeries.length; i++) {
      if (rnSeries[i-1] !== 0) changes.push(Math.abs(rnSeries[i]/rnSeries[i-1] - 1));
    }
    const avgChange = changes.reduce((a,b)=>a+b,0)/changes.length;
    if (avgChange > 0.3) { score -= 1; reasons.push('Volatilité élevée'); }
  }
  if (score >= -1) return { label: 'Forte', color: 'var(--green)', reason: 'Données stables, forecast fiable' };
  else if (score === -2) return { label: 'Moyenne', color: 'var(--gold)', reason: reasons.join('; ') };
  else return { label: 'Faible', color: 'var(--red)', reason: reasons.join('; ') };
}