/* =====================================================================
   RECOMMANDATION.JS — Moteur de scoring & recommandation d'investissement
   The Capital — BRVM
   ---------------------------------------------------------------------
   S'appuie sur les données déjà chargées par analyse.html :
   allCours, allFinancials, tickerHistorique, fmt, fmtM, fmtDateShort,
   changePill, chartDefaults, calcRSI, generateDemoHistorique, Chart
   ===================================================================== */

(function () {
  'use strict';

  // ---------- ÉTAT ----------
  let recoWeightMode = 'balanced'; // 'technical' | 'balanced' | 'fundamental'
  let recoFilter = 'all';
  let recoSelectedTicker = null;
  let macdChartInst = null, bollChartInst = null;
  window._recoRows = [];

  const WEIGHTS = {
    technical:   { t: 0.75, f: 0.25 },
    balanced:    { t: 0.50, f: 0.50 },
    fundamental: { t: 0.25, f: 0.75 },
  };

  // ---------- HELPERS MATH ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function dailyReturns(prices) {
    const r = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1]) r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return r;
  }

  function stdev(arr) {
    if (arr.length < 2) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
    return Math.sqrt(v);
  }

  function ema(data, period) {
    const k = 2 / (period + 1);
    const out = [];
    let prev = data[0];
    data.forEach((v, i) => {
      prev = i === 0 ? v : v * k + prev * (1 - k);
      out.push(prev);
    });
    return out;
  }

  function computeMACD(prices) {
    if (prices.length < 26) return { macd: [], signal: [], hist: [] };
    const ema12 = ema(prices, 12);
    const ema26 = ema(prices, 26);
    const macd = prices.map((_, i) => ema12[i] - ema26[i]);
    const signal = ema(macd, 9);
    const hist = macd.map((v, i) => v - signal[i]);
    return { macd, signal, hist };
  }

  function computeBollinger(prices, period = 20, mult = 2) {
    const mid = [], upper = [], lower = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) { mid.push(null); upper.push(null); lower.push(null); continue; }
      const slice = prices.slice(i - period + 1, i + 1);
      const m = slice.reduce((a, b) => a + b, 0) / period;
      const sd = stdev(slice);
      mid.push(m); upper.push(m + mult * sd); lower.push(m - mult * sd);
    }
    return { mid, upper, lower };
  }

  function getHistFor(ticker) {
    const c = (allCours || []).find(x => x.ticker === ticker) || {};
    let hist = (tickerHistorique || {})[ticker];
    if (!hist || !hist.length) {
      hist = window.generateDemoHistorique ? window.generateDemoHistorique(ticker, c.cours || 5000) : [];
      tickerHistorique = tickerHistorique || {};
      tickerHistorique[ticker] = hist;
    }
    return hist;
  }

  function latestFinancial(ticker) {
    const rows = (allFinancials || []).filter(f => f.ticker === ticker);
    if (!rows.length) return null;
    return rows.reduce((a, b) => (b.annee > (a?.annee || 0) ? b : a), rows[0]);
  }

  // ---------- SCORING TECHNIQUE ----------
  function scoreTechnical(ticker) {
    const c = (allCours || []).find(x => x.ticker === ticker) || {};
    const hist = getHistFor(ticker);
    const prix = hist.map(d => d.cloture || d.cours || 0).filter(v => v > 0);
    const current = prix.length ? prix[prix.length - 1] : (c.cours || 0);

    const mm20 = prix.length ? prix.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, prix.length) : current;
    const mm50 = prix.length >= 10 ? prix.slice(-Math.min(50, prix.length)).reduce((s, v) => s + v, 0) / Math.min(50, prix.length) : mm20;

    // Tendance : position du cours par rapport aux moyennes mobiles
    let trend = 50;
    trend += clamp(((current - mm20) / (mm20 || 1)) * 250, -25, 25);
    trend += clamp(((current - mm50) / (mm50 || 1)) * 150, -15, 15);
    trend = clamp(trend, 0, 100);

    // Momentum : performance 1M / 3M
    const perf = (n) => {
      const slice = prix.slice(-n);
      if (slice.length < 2) return 0;
      return (slice[slice.length - 1] - slice[0]) / slice[0] * 100;
    };
    const m1 = prix.length >= 2 ? perf(Math.min(21, prix.length)) : parseFloat(c.variation) || 0;
    const m3 = prix.length >= 2 ? perf(Math.min(63, prix.length)) : (parseFloat(c.variation) || 0) * 2;
    let momentum = 50 + clamp(m1 * 1.8, -25, 25) + clamp(m3 * 0.7, -15, 15);
    momentum = clamp(momentum, 0, 100);

    // RSI
    const rsi = (window.calcRSI ? window.calcRSI(prix.length ? prix : [current], 14) : (45 + (parseFloat(c.variation) || 0) * 3));
    let rsiScore;
    if (rsi < 30) rsiScore = 78;       // survente = opportunité, mais volatil
    else if (rsi < 45) rsiScore = 64;
    else if (rsi <= 55) rsiScore = 52;
    else if (rsi <= 70) rsiScore = 38;
    else rsiScore = 20;                // surachat = risque de correction

    // Tendance du volume (accumulation / distribution)
    const vol = hist.map(d => d.volume || 0);
    let volumeTrend = 50;
    if (vol.length >= 20) {
      const recentVol = vol.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const priorVol = vol.slice(-20, -10).reduce((a, b) => a + b, 0) / 10 || 1;
      const volChange = (recentVol - priorVol) / priorVol;
      volumeTrend = 50 + clamp(volChange * 60, -25, 25) * (m1 >= 0 ? 1 : -1);
      volumeTrend = clamp(volumeTrend, 0, 100);
    }

    const overall = (trend * 0.35 + momentum * 0.30 + rsiScore * 0.20 + volumeTrend * 0.15);

    // Volatilité annualisée (pour le niveau de risque)
    const rets = dailyReturns(prix);
    const vola = rets.length ? stdev(rets) * Math.sqrt(252) * 100 : 25;

    return {
      trend, momentum, rsiScore, volumeTrend, overall,
      raw: { current, mm20, mm50, rsi, m1, m3, volatility: vola }
    };
  }

  // ---------- SCORING FONDAMENTAL ----------
  function scoreFundamental(ticker) {
    const c = (allCours || []).find(x => x.ticker === ticker) || {};
    const f = latestFinancial(ticker);
    const cp = parseFloat(c.cours) || 0;

    let profitability = 50, valuation = 50, yieldScore = 50, solidity = 50;
    let roe = null, per = null, divYield = null, solidRatio = null;

    if (f?.resultat_net && f?.fonds_propres) {
      roe = (f.resultat_net / f.fonds_propres) * 100;
      profitability = clamp(40 + roe * 3, 0, 100);
    }
    if (f?.bpa && cp) {
      per = cp / f.bpa;
      // PER bas = mieux valorisé, mais PER négatif ou extrême = pénalisé
      if (per > 0) valuation = clamp(100 - (per - 6) * 5, 5, 100);
      else valuation = 20;
    }
    if (f?.dpa && cp) {
      divYield = (f.dpa / cp) * 100;
      yieldScore = clamp(divYield * 10, 0, 100);
    }
    if (f?.fonds_propres && f?.total_actif) {
      solidRatio = (f.fonds_propres / f.total_actif) * 100;
      solidity = clamp(solidRatio * 2.2, 0, 100);
    }

    const overall = (profitability * 0.30 + valuation * 0.30 + yieldScore * 0.15 + solidity * 0.25);

    return {
      profitability, valuation, yieldScore, solidity, overall,
      raw: { roe, per, divYield, solidRatio, hasData: !!f }
    };
  }

  // ---------- COMPOSITE & LABEL ----------
  function labelFor(score) {
    if (score >= 75) return { key: 'strongbuy', label: 'Achat Fort', cls: 'reco-strongbuy' };
    if (score >= 60) return { key: 'buy', label: 'Achat', cls: 'reco-buy' };
    if (score >= 40) return { key: 'hold', label: 'Conserver', cls: 'reco-hold' };
    if (score >= 25) return { key: 'sell', label: 'Vente', cls: 'reco-sell' };
    return { key: 'strongsell', label: 'Vente Forte', cls: 'reco-strongsell' };
  }

  function riskFor(vola) {
    if (vola < 15) return { key: 'low', label: 'Faible', cls: 'risk-low' };
    if (vola < 30) return { key: 'mid', label: 'Modéré', cls: 'risk-mid' };
    return { key: 'high', label: 'Élevé', cls: 'risk-high' };
  }

  function priceTarget(ticker, composite, tech) {
    const current = tech.raw.current;
    const high52raw = (getHistFor(ticker).map(d => d.cloture || 0).filter(v => v > 0));
    const high52 = high52raw.length ? Math.max(...high52raw) : current * 1.1;
    const low52 = high52raw.length ? Math.min(...high52raw) : current * 0.9;
    const bias = (composite - 50) / 100; // -0.5 .. +0.5
    let target = current * (1 + bias * 0.28);
    // ancrage léger sur les extrêmes 52 semaines pour rester réaliste
    target = clamp(target, low52 * 0.9, high52 * 1.15);
    const upside = current ? ((target - current) / current) * 100 : 0;
    return { target, upside, high52, low52 };
  }

  function buildRationale(ticker, tech, fund, composite) {
    const strengths = [], weaknesses = [];
    if (tech.trend >= 62) strengths.push('Cours au-dessus de ses moyennes mobiles — tendance haussière confirmée.');
    if (tech.trend <= 38) weaknesses.push('Cours sous ses moyennes mobiles — tendance baissière en cours.');
    if (tech.momentum >= 62) strengths.push(`Momentum positif : +${tech.raw.m1.toFixed(1)}% sur 1 mois.`);
    if (tech.momentum <= 38) weaknesses.push(`Momentum négatif : ${tech.raw.m1.toFixed(1)}% sur 1 mois.`);
    if (tech.raw.rsi < 30) strengths.push(`RSI en zone de survente (${tech.raw.rsi.toFixed(0)}) — rebond technique possible.`);
    if (tech.raw.rsi > 70) weaknesses.push(`RSI en zone de surachat (${tech.raw.rsi.toFixed(0)}) — risque de correction à court terme.`);
    if (tech.raw.volatility > 30) weaknesses.push(`Volatilité annualisée élevée (${tech.raw.volatility.toFixed(0)}%) — titre nerveux.`);
    if (tech.raw.volatility < 15) strengths.push(`Faible volatilité (${tech.raw.volatility.toFixed(0)}%) — profil plus stable.`);

    if (fund.raw.hasData) {
      if (fund.raw.roe != null && fund.raw.roe >= 12) strengths.push(`Bonne rentabilité des fonds propres (ROE ≈ ${fund.raw.roe.toFixed(1)}%).`);
      if (fund.raw.roe != null && fund.raw.roe < 6) weaknesses.push(`Rentabilité des fonds propres faible (ROE ≈ ${fund.raw.roe.toFixed(1)}%).`);
      if (fund.raw.per != null && fund.raw.per > 0 && fund.raw.per <= 10) strengths.push(`Valorisation attractive (P/E ≈ ${fund.raw.per.toFixed(1)}x).`);
      if (fund.raw.per != null && fund.raw.per > 18) weaknesses.push(`Valorisation élevée (P/E ≈ ${fund.raw.per.toFixed(1)}x).`);
      if (fund.raw.divYield != null && fund.raw.divYield >= 5) strengths.push(`Rendement du dividende attractif (${fund.raw.divYield.toFixed(2)}%).`);
      if (fund.raw.solidRatio != null && fund.raw.solidRatio >= 25) strengths.push(`Structure financière solide (fonds propres ≈ ${fund.raw.solidRatio.toFixed(0)}% du total bilan).`);
      if (fund.raw.solidRatio != null && fund.raw.solidRatio < 10) weaknesses.push('Niveau de fonds propres relativement faible par rapport au bilan.');
    } else {
      weaknesses.push('Données financières fondamentales incomplètes pour ce titre — analyse basée principalement sur la technique.');
    }
    if (!strengths.length) strengths.push('Aucun signal fort identifié — profil neutre sur les critères analysés.');
    if (!weaknesses.length) weaknesses.push('Aucun signal d\'alerte majeur identifié à ce stade.');
    return { strengths, weaknesses };
  }

  function synthText(ticker, reco) {
    const { label } = reco.badge;
    const dirWord = reco.composite >= 60 ? 'favorable' : reco.composite <= 40 ? 'défavorable' : 'mitigé';
    return `Le titre <b>${ticker}</b> affiche un profil ${dirWord} avec un score global de <b>${reco.composite.toFixed(0)}/100</b>
      (technique : ${reco.tech.overall.toFixed(0)}, fondamental : ${reco.fund.overall.toFixed(0)}).
      La recommandation actuelle est <b>${label}</b>, avec un objectif de cours indicatif de
      <b>${fmt(reco.target.target)} FCFA</b> (potentiel ${reco.target.upside >= 0 ? '+' : ''}${reco.target.upside.toFixed(1)}%)
      et un niveau de risque jugé <b>${reco.risk.label.toLowerCase()}</b> (volatilité annualisée ≈ ${reco.tech.raw.volatility.toFixed(0)}%).`;
  }

  // ---------- CALCUL PRINCIPAL ----------
  function computeReco(ticker) {
    const tech = scoreTechnical(ticker);
    const fund = scoreFundamental(ticker);
    const w = WEIGHTS[recoWeightMode];
    const composite = tech.overall * w.t + fund.overall * w.f;
    const badge = labelFor(composite);
    const risk = riskFor(tech.raw.volatility);
    const target = priceTarget(ticker, composite, tech);
    const reco = { ticker, tech, fund, composite, badge, risk, target };
    reco.rationale = buildRationale(ticker, tech, fund, composite);
    return reco;
  }

  function allTickers() {
    return [...new Set((allCours || []).map(c => c.ticker))];
  }

  // ---------- RENDU : COMPTEURS + TABLEAU + TOP PICKS ----------
  window.renderRecommandations = function () {
    const rows = allTickers().map(computeReco).sort((a, b) => b.composite - a.composite);
    window._recoRows = rows;

    const buy = rows.filter(r => r.badge.key === 'buy' || r.badge.key === 'strongbuy').length;
    const sell = rows.filter(r => r.badge.key === 'sell' || r.badge.key === 'strongsell').length;
    const hold = rows.length - buy - sell;
    setText('reco-buy-count', buy);
    setText('reco-hold-count', hold);
    setText('reco-sell-count', sell);

    renderTopPicks(rows);
    renderRecoTable();

    // Rafraîchissement en tâche de fond avec les historiques réels (plus précis)
    ensureRealHistoriques(rows.map(r => r.ticker));
  };

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderTopPicks(rows) {
    const top = rows.slice(0, 3);
    const grid = document.getElementById('topPicksGrid');
    if (!grid) return;
    if (!top.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = top.map((r, i) => `
      <div class="top-pick-card" onclick="window.__recoSelectTicker('${r.ticker}')">
        <div class="top-pick-rank">${String(i + 1).padStart(2, '0')}</div>
        <div class="top-pick-ticker">${r.ticker} <span class="reco-badge ${r.badge.cls}" style="margin-left:6px">${r.badge.label}</span></div>
        <div class="top-pick-score">${r.composite.toFixed(0)} <span>/100</span></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span class="mini-tag">Objectif ${fmt(r.target.target)} FCFA</span>
          <span class="mini-tag" style="color:${r.target.upside >= 0 ? 'var(--green)' : 'var(--red)'}">${r.target.upside >= 0 ? '+' : ''}${r.target.upside.toFixed(1)}%</span>
          <span class="risk-badge ${r.risk.cls}">Risque ${r.risk.label}</span>
        </div>
        <div class="top-pick-rationale">${r.rationale.strengths[0] || ''}</div>
      </div>
    `).join('');
  }

  function renderRecoTable() {
    let rows = window._recoRows || [];
    if (recoFilter !== 'all') {
      rows = rows.filter(r => {
        if (recoFilter === 'buy') return r.badge.key === 'buy' || r.badge.key === 'strongbuy';
        if (recoFilter === 'sell') return r.badge.key === 'sell' || r.badge.key === 'strongsell';
        if (recoFilter === 'hold') return r.badge.key === 'hold';
        return true;
      });
    }
    const tbody = document.getElementById('recoTable');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r => `
      <tr class="reco-table-row-clickable" onclick="window.__recoSelectTicker('${r.ticker}')">
        <td><span style="font-family:var(--mono);font-size:12px;color:var(--gold)">${r.ticker}</span></td>
        <td class="right">${fmt(r.tech.raw.current)}</td>
        <td class="right">${r.tech.overall.toFixed(0)}</td>
        <td class="right">${r.fund.overall.toFixed(0)}</td>
        <td class="right" style="font-weight:600">${r.composite.toFixed(0)}</td>
        <td><span class="reco-badge ${r.badge.cls}">${r.badge.label}</span></td>
        <td class="right">${fmt(r.target.target)}</td>
        <td class="right" style="color:${r.target.upside >= 0 ? 'var(--green)' : 'var(--red)'}">${r.target.upside >= 0 ? '+' : ''}${r.target.upside.toFixed(1)}%</td>
        <td><span class="risk-badge ${r.risk.cls}">${r.risk.label}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--dim)">Aucun titre pour ce filtre</td></tr>';
  }

  window.setRecoWeight = function (mode, btn) {
    recoWeightMode = mode;
    document.querySelectorAll('#recoWeightBtns .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window.renderRecommandations();
    if (recoSelectedTicker) window.renderRecoDetail(recoSelectedTicker, false);
  };

  window.setRecoFilter = function (f, btn) {
    recoFilter = f;
    document.querySelectorAll('#recommandation .filter-btn[onclick^="setRecoFilter"]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRecoTable();
  };

  window.__recoSelectTicker = function (ticker) {
    window.renderRecoDetail(ticker, true);
    // synchronise aussi le sélecteur de la section Graphique pour cohérence
    const sel = document.getElementById('tickerSelect');
    if (sel) { sel.value = ticker; if (window.loadTickerData) window.loadTickerData(ticker); }
  };

  // ---------- RENDU : FICHE DÉTAILLÉE ----------
  window.renderRecoDetail = function (ticker, scrollTo) {
    recoSelectedTicker = ticker;
    let reco = (window._recoRows || []).find(r => r.ticker === ticker);
    if (!reco) reco = computeReco(ticker);

    setText('recoDetailSub', `${ticker} — pondération : ${{ technical: 'court terme', balanced: 'équilibrée', fundamental: 'long terme' }[recoWeightMode]}`);

    const body = document.getElementById('recoDetailBody');
    if (!body) return;

    const gaugeColor = reco.composite >= 60 ? 'var(--green)' : reco.composite >= 40 ? 'var(--gold)' : 'var(--red)';
    const pct = clamp(reco.composite, 0, 100);

    body.innerHTML = `
      <div class="grid-2" style="align-items:stretch">
        <div>
          <div class="score-gauge-wrap">
            <div class="score-gauge" style="background:conic-gradient(${gaugeColor} 0% ${pct}%, var(--border2) ${pct}% 100%)">
              <div style="position:absolute;inset:12px;border-radius:50%;background:var(--surface)"></div>
              <div class="score-gauge-num">
                <div class="n">${reco.composite.toFixed(0)}</div>
                <div class="l">Score global /100</div>
              </div>
            </div>
            <div>
              <span class="reco-badge ${reco.badge.cls}" style="font-size:13px;padding:6px 14px">${reco.badge.label}</span>
              <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                <span class="mini-tag">Risque : <span class="risk-badge ${reco.risk.cls}" style="margin-left:4px">${reco.risk.label}</span></span>
                <span class="mini-tag">Volatilité ≈ ${reco.tech.raw.volatility.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div style="margin-top:20px" class="target-card">
            <div class="target-block"><div class="l">Cours actuel</div><div class="v">${fmt(reco.tech.raw.current)} FCFA</div></div>
            <div class="target-block"><div class="l">Objectif indicatif</div><div class="v" style="color:var(--gold)">${fmt(reco.target.target)} FCFA</div></div>
            <div class="target-block"><div class="l">Potentiel</div><div class="v" style="color:${reco.target.upside >= 0 ? 'var(--green)' : 'var(--red)'}">${reco.target.upside >= 0 ? '+' : ''}${reco.target.upside.toFixed(1)}%</div></div>
          </div>

          <div style="margin-top:20px" class="synth-text">${synthText(ticker, reco)}</div>
        </div>

        <div>
          <div class="breakdown-row">
            <div class="breakdown-head"><span>Tendance (MM20/MM50)</span><b>${reco.tech.trend.toFixed(0)}</b></div>
            <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${reco.tech.trend}%;background:var(--blue)"></div></div>
          </div>
          <div class="breakdown-row">
            <div class="breakdown-head"><span>Momentum (1M/3M)</span><b>${reco.tech.momentum.toFixed(0)}</b></div>
            <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${reco.tech.momentum}%;background:var(--blue)"></div></div>
          </div>
          <div class="breakdown-row">
            <div class="breakdown-head"><span>RSI (14)</span><b>${reco.tech.rsiScore.toFixed(0)}</b></div>
            <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${reco.tech.rsiScore}%;background:var(--blue)"></div></div>
          </div>
          <div class="breakdown-row">
            <div class="breakdown-head"><span>Rentabilité (ROE)</span><b>${reco.fund.profitability.toFixed(0)}</b></div>
            <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${reco.fund.profitability}%;background:var(--gold)"></div></div>
          </div>
          <div class="breakdown-row">
            <div class="breakdown-head"><span>Valorisation (P/E)</span><b>${reco.fund.valuation.toFixed(0)}</b></div>
            <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${reco.fund.valuation}%;background:var(--gold)"></div></div>
          </div>
          <div class="breakdown-row">
            <div class="breakdown-head"><span>Solidité financière</span><b>${reco.fund.solidity.toFixed(0)}</b></div>
            <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${reco.fund.solidity}%;background:var(--gold)"></div></div>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-top:20px;margin-bottom:0">
        <div>
          <div class="card-title" style="margin-bottom:10px">Points forts</div>
          <ul class="flag-list">${reco.rationale.strengths.map(s => `<li class="flag-good"><span class="flag-dot"></span>${s}</li>`).join('')}</ul>
        </div>
        <div>
          <div class="card-title" style="margin-bottom:10px">Points de vigilance</div>
          <ul class="flag-list">${reco.rationale.weaknesses.map(s => `<li class="flag-bad"><span class="flag-dot"></span>${s}</li>`).join('')}</ul>
        </div>
      </div>
    `;

    if (scrollTo) {
      document.getElementById('recoDetailCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ---------- INDICATEURS AVANCÉS (utilisés aussi dans la section Technique) ----------
  window.renderAdvancedIndicators = function (ticker) {
    const hist = getHistFor(ticker);
    const prix = hist.map(d => d.cloture || d.cours || 0).filter(v => v > 0);
    if (prix.length < 5) return;
    const labels = hist.slice(-prix.length).map(d => fmtDateShort ? fmtDateShort(d.date_seance) : '');

    // Volatilité
    const rets = dailyReturns(prix);
    const vola = rets.length ? stdev(rets) * Math.sqrt(252) * 100 : 0;
    setText('stat-vol', vola.toFixed(1) + '%');
    setHTML('stat-vol-note', riskFor(vola).label + ' · écart-type annualisé');

    // Momentum
    const perf = (n) => { const s = prix.slice(-n); return s.length < 2 ? 0 : (s[s.length - 1] - s[0]) / s[0] * 100; };
    const m1 = perf(Math.min(21, prix.length)), m3 = perf(Math.min(63, prix.length));
    setHTML('stat-mom', `<span style="color:${m1 >= 0 ? 'var(--green)' : 'var(--red)'}">${m1 >= 0 ? '+' : ''}${m1.toFixed(1)}%</span> / <span style="color:${m3 >= 0 ? 'var(--green)' : 'var(--red)'}">${m3 >= 0 ? '+' : ''}${m3.toFixed(1)}%</span>`);

    // MACD
    const { macd, signal, hist: macdHist } = computeMACD(prix);
    if (macd.length) {
      const lastMacd = macd[macd.length - 1], lastSig = signal[signal.length - 1];
      const bullish = lastMacd > lastSig;
      setHTML('stat-macd', `<span style="color:${bullish ? 'var(--green)' : 'var(--red)'}">${bullish ? 'Haussier' : 'Baissier'}</span>`);
      setHTML('stat-macd-note', `MACD ${lastMacd.toFixed(2)} vs signal ${lastSig.toFixed(2)}`);
      renderMacdChart(labels, macd, signal, macdHist);
    }

    // Bollinger
    const boll = computeBollinger(prix, 20, 2);
    const last = prix.length - 1;
    if (boll.upper[last] != null) {
      const width = boll.upper[last] - boll.lower[last];
      const pctB = width ? (prix[last] - boll.lower[last]) / width : 0.5;
      const zone = pctB > 0.85 ? 'Haut de bande' : pctB < 0.15 ? 'Bas de bande' : 'Zone médiane';
      const color = pctB > 0.85 ? 'var(--red)' : pctB < 0.15 ? 'var(--blue)' : 'var(--green)';
      setHTML('stat-boll', `<span style="color:${color}">${(pctB * 100).toFixed(0)}%</span>`);
      setHTML('stat-boll-note', zone);
      renderBollChart(labels, prix, boll);
    }
  };

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function renderMacdChart(labels, macd, signal, histBars) {
    const canvas = document.getElementById('chartMacd');
    if (!canvas || !window.Chart) return;
    if (macdChartInst) macdChartInst.destroy();
    macdChartInst = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type: 'bar', data: histBars, backgroundColor: histBars.map(v => v >= 0 ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'), borderWidth: 0, order: 2 },
          { type: 'line', data: macd, borderColor: '#B8964E', borderWidth: 1.5, pointRadius: 0, tension: 0.25, order: 0 },
          { type: 'line', data: signal, borderColor: '#60A5FA', borderWidth: 1.5, pointRadius: 0, tension: 0.25, order: 1 }
        ]
      },
      options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
    });
  }

  function renderBollChart(labels, prix, boll) {
    const canvas = document.getElementById('chartBoll');
    if (!canvas || !window.Chart) return;
    if (bollChartInst) bollChartInst.destroy();
    bollChartInst = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { data: boll.upper, borderColor: 'rgba(248,113,113,0.6)', borderWidth: 1, pointRadius: 0, fill: '+1', backgroundColor: 'rgba(184,150,78,0.05)', tension: 0.25 },
          { data: boll.mid, borderColor: 'rgba(184,150,78,0.6)', borderWidth: 1, borderDash: [3, 3], pointRadius: 0, fill: false, tension: 0.25 },
          { data: boll.lower, borderColor: 'rgba(96,165,250,0.6)', borderWidth: 1, pointRadius: 0, fill: false, tension: 0.25 },
          { data: prix, borderColor: '#F5F0E8', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.25 }
        ]
      },
      options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }
    });
  }

  // ---------- CHARGEMENT RÉEL DES HISTORIQUES EN ARRIÈRE-PLAN ----------
  let _historiquesLoading = false;
  const _historiqueAttempted = new Set();
  async function ensureRealHistoriques(tickers) {
    if (_historiquesLoading || !window.sbQuery) return;
    const missing = tickers.filter(t => !_historiqueAttempted.has(t));
    if (!missing.length) return;
    _historiquesLoading = true;
    missing.forEach(t => _historiqueAttempted.add(t)); // une seule tentative par titre
    try {
      const results = await Promise.allSettled(
        missing.map(t => window.sbQuery('historique', { ticker: `eq.${t}`, order: 'date_seance.asc', limit: 252 }))
      );
      let changed = false;
      results.forEach((r, i) => {
        const t = missing[i];
        if (r.status === 'fulfilled' && r.value && r.value.length) {
          tickerHistorique[t] = r.value;
          changed = true;
        }
      });
      if (changed) {
        window.renderRecommandations();
        if (recoSelectedTicker) window.renderRecoDetail(recoSelectedTicker, false);
        if (graphTicker && window.renderAdvancedIndicators) window.renderAdvancedIndicators(graphTicker);
      }
    } catch (e) {
      /* silencieux : on garde les estimations */
    } finally {
      _historiquesLoading = false;
    }
  }
})();
