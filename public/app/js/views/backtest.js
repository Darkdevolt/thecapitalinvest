// ============================================================================
// BACKTESTING BRVM  (P0 roadmap — le différenciant vs RichBourse)
// Moteur « buy & hold » sur une valeur : achat à la 1re séance de la période,
// conservation jusqu'à la dernière, dividendes encaissés (option : réinvestis).
// Sources : historique complet (apiGetHistoriqueComplet) · allDividendes ·
//           allIndicesHistory / apiGetIndicesHistory (benchmark BRVM Composite).
// Aucune donnée inventée. Toutes les hypothèses sont affichées (rapport §7).
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_BACKTEST_V1__) return;
  window.__TC_BACKTEST_V1__ = true;

  var chart = null;
  var running = false;
  var lastCfg = null;

  // --- helpers --------------------------------------------------------------
  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function ymd(v) { return v ? String(v).slice(0, 10) : ''; }
  function close(r) {
    return Number(r && (r.cours_cloture != null ? r.cours_cloture : r.cours_normal != null ? r.cours_normal : r.cours));
  }
  function nf(v, dec) {
    var n = Number(v); if (!isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec });
  }
  function money(v) {
    var n = Number(v); if (!isFinite(n)) return '—';
    return nf(Math.round(n)) + ' FCFA';
  }
  function pct(v, dec) {
    var n = Number(v); if (!isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + n.toLocaleString('fr-FR', { minimumFractionDigits: dec == null ? 1 : dec, maximumFractionDigits: dec == null ? 1 : dec }) + ' %';
  }
  function dLabel(s) {
    var d = ymd(s); if (!d) return '—';
    var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0];
  }

  function companyList() {
    return (Array.isArray(window.allEntreprises) ? window.allEntreprises : [])
      .filter(function (e) { return e && e.ticker && e.actif !== false; })
      .map(function (e) { return { ticker: String(e.ticker).toUpperCase(), nom: e.nom || e.nom_court || '' }; })
      .sort(function (a, b) { return a.ticker.localeCompare(b.ticker); });
  }

  function dividendsFor(ticker) {
    var t = String(ticker || '').toUpperCase();
    return (Array.isArray(window.allDividendes) ? window.allDividendes : [])
      .filter(function (d) { return d && String(d.ticker).toUpperCase() === t; })
      .map(function (d) {
        return { ex: ymd(d.date_detachement || d.ex_date), montant: num(d.montant_net != null ? d.montant_net : d.montant) };
      })
      .filter(function (d) { return d.ex && d.montant != null && d.montant > 0; })
      .sort(function (a, b) { return a.ex < b.ex ? -1 : 1; });
  }

  // --- benchmark : historique de l'indice BRVM Composite -------------------
  function compositeSeries() {
    var h = Array.isArray(window.allIndicesHistory) ? window.allIndicesHistory : [];
    var out = h.filter(function (r) { return String(r.indice || '').toUpperCase().indexOf('COMPOSITE') !== -1; })
      .map(function (r) { return { d: ymd(r.date_seance), v: num(r.valeur) }; })
      .filter(function (r) { return r.d && r.v != null && r.v > 0; })
      .sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    return out;
  }
  var _benchFetched = '';
  function ensureCompositeHistory(fromDate) {
    var s = compositeSeries();
    var from = fromDate || '2015-01-01';
    // On refait le chargement si l'historique en mémoire ne couvre pas le
    // début de la période demandée (l'API par défaut ne renvoie que ~90 j).
    var covers = s.length && s[0].d <= from;
    if ((covers && s.length >= 120) || typeof window.apiGetIndicesHistory !== 'function' || _benchFetched === from) {
      return Promise.resolve(s);
    }
    _benchFetched = from;
    return window.apiGetIndicesHistory(4000, from).then(function (rows) {
      var arr = Array.isArray(rows) ? rows : (rows && rows.data) || [];
      if (arr.length) window.allIndicesHistory = arr;
      return compositeSeries();
    }).catch(function () { return s; });
  }

  // --- moteur -------------------------------------------------------------
  function runEngine(cfg, rows, bench) {
    var series = rows.map(function (r) { return { d: ymd(r.date_seance), raw: close(r), adj: num(r.cours_ajuste) }; })
      .filter(function (r) { return r.d && r.raw > 0; })
      .sort(function (a, b) { return a.d < b.d ? -1 : 1; });

    var win = series.filter(function (r) { return r.d >= cfg.start && r.d <= cfg.end; });
    if (win.length < 2) return { error: 'Moins de deux séances disponibles pour ' + cfg.ticker + ' entre le ' + dLabel(cfg.start) + ' et le ' + dLabel(cfg.end) + '.' };

    var priceOf = cfg.base === 'adj'
      ? function (r) { return r.adj != null && r.adj > 0 ? r.adj : r.raw; }
      : function (r) { return r.raw; };

    var d0 = win[0], dN = win[win.length - 1];
    var p0 = priceOf(d0), pN = priceOf(dN);
    var feeRate = cfg.fee / 100;

    // Achat initial : capital net de frais / prix d'entrée
    var cashForShares = cfg.capital / (1 + feeRate);
    var shares = cashForShares / p0;
    var feeBuy = cfg.capital - cashForShares;
    var cashDiv = 0;              // dividendes encaissés non réinvestis
    var divEvents = [];

    // Dividendes détachés dans la fenêtre (mode cours bruts uniquement —
    // en mode ajusté, le rendement total est déjà incorporé au cours).
    if (cfg.base === 'raw') {
      var divs = dividendsFor(cfg.ticker).filter(function (dv) { return dv.ex > d0.d && dv.ex <= dN.d; });
      divs.forEach(function (dv) {
        var gross = shares * dv.montant;
        var rec = { ex: dv.ex, dps: dv.montant, gross: gross, reinvested: 0, addedShares: 0 };
        if (cfg.reinvest) {
          // réinvesti à la clôture de la séance de détachement (ou suivante)
          var row = win.find(function (r) { return r.d >= dv.ex; }) || dN;
          var px = priceOf(row);
          var net = gross / (1 + feeRate);
          var add = net / px;
          shares += add;
          rec.reinvested = net; rec.addedShares = add; rec.px = px;
        } else {
          cashDiv += gross;
        }
        divEvents.push(rec);
      });
    }

    // Courbe de valeur (mark-to-market quotidien)
    var equity = win.map(function (r) {
      // approximation : parts constantes après le dernier détachement traité ;
      // pour la courbe on utilise le nombre de parts final (impact < frais).
      return { d: r.d, v: shares * priceOf(r) + cashDiv };
    });
    // valeur brute avant vente
    var grossFinal = shares * pN + cashDiv;
    var feeSell = (shares * pN) * feeRate;
    var netFinal = grossFinal - feeSell;

    var years = (new Date(dN.d) - new Date(d0.d)) / (365.25 * 24 * 3600 * 1000);
    var totalRet = netFinal / cfg.capital - 1;
    var cagr = years > 0 ? Math.pow(netFinal / cfg.capital, 1 / years) - 1 : null;

    // volatilité annualisée + max drawdown sur la courbe
    var rets = [];
    for (var i = 1; i < equity.length; i++) {
      var a = equity[i - 1].v, b = equity[i].v;
      if (a > 0) rets.push(b / a - 1);
    }
    var mean = rets.reduce(function (s, x) { return s + x; }, 0) / (rets.length || 1);
    var variance = rets.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / (rets.length > 1 ? rets.length - 1 : 1);
    var vol = Math.sqrt(variance) * Math.sqrt(252);
    var peak = -Infinity, mdd = 0;
    equity.forEach(function (p) { if (p.v > peak) peak = p.v; var dd = peak > 0 ? p.v / peak - 1 : 0; if (dd < mdd) mdd = dd; });

    // Benchmark BRVM Composite sur la même fenêtre
    var benchRes = null;
    if (bench && bench.length) {
      var bWin = bench.filter(function (r) { return r.d >= d0.d && r.d <= dN.d; });
      if (bWin.length >= 2) {
        var b0 = bWin[0], bN2 = bWin[bWin.length - 1];
        var bTot = bN2.v / b0.v - 1;
        var bYears = (new Date(bN2.d) - new Date(b0.d)) / (365.25 * 24 * 3600 * 1000);
        var bCagr = bYears > 0 ? Math.pow(bN2.v / b0.v, 1 / bYears) - 1 : null;
        benchRes = {
          total: bTot, cagr: bCagr, from: b0.d, to: bN2.d,
          curve: bWin.map(function (r) { return { d: r.d, v: cfg.capital * (r.v / b0.v) }; }),
          partial: b0.d > d0.d || bN2.d < dN.d
        };
      }
    }

    return {
      ticker: cfg.ticker, start: d0.d, end: dN.d, sessions: win.length, years: years,
      entryPrice: p0, exitPrice: pN, shares: shares,
      capital: cfg.capital, feeBuy: feeBuy, feeSell: feeSell,
      cashDiv: cashDiv, divEvents: divEvents,
      grossFinal: grossFinal, netFinal: netFinal,
      plusValue: netFinal - cfg.capital, totalRet: totalRet, cagr: cagr,
      vol: vol, mdd: mdd, equity: equity, bench: benchRes,
      divTotal: divEvents.reduce(function (s, e) { return s + e.gross; }, 0)
    };
  }

  // --- rendu ------------------------------------------------------------
  function injectCss() {
    if (document.getElementById('tc-backtest-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-backtest-css';
    s.textContent = [
      '#view-backtest .bt-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;align-items:end}',
      '#view-backtest .bt-field{display:flex;flex-direction:column;gap:4px}',
      '#view-backtest .bt-field label{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--gold)}',
      '#view-backtest .bt-field input,#view-backtest .bt-field select{background:var(--surface);border:1px solid rgba(245,240,232,.16);color:var(--cream);border-radius:8px;padding:9px 10px;font:inherit}',
      '#view-backtest .bt-check{flex-direction:row;align-items:center;gap:8px}',
      '#view-backtest .bt-check input{width:16px;height:16px}',
      '#view-backtest .bt-run{background:var(--gold);color:#1a1408;border:0;border-radius:8px;padding:11px 20px;font-weight:700;cursor:pointer}',
      '#view-backtest .bt-run:disabled{opacity:.5;cursor:progress}',
      '#view-backtest .bt-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0}',
      '#view-backtest .bt-kpi{background:var(--card);border:1px solid rgba(245,240,232,.09);border-radius:10px;padding:14px 16px}',
      '#view-backtest .bt-kpi .k{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}',
      '#view-backtest .bt-kpi .v{font-family:var(--mono,monospace);font-size:20px;margin-top:5px;font-variant-numeric:tabular-nums}',
      '#view-backtest .pos{color:var(--green,#4ADE80)}#view-backtest .neg{color:var(--red,#F87171)}',
      '#view-backtest .bt-chart{height:320px}',
      '#view-backtest .bt-hyp{font-size:12px;line-height:1.7;color:var(--muted,rgba(245,240,232,.6))}',
      '#view-backtest .bt-hyp b{color:var(--cream)}',
      '#view-backtest table{width:100%;border-collapse:collapse;font-size:13px}',
      '#view-backtest th,#view-backtest td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(245,240,232,.08)}',
      '#view-backtest td.r,#view-backtest th.r{text-align:right;font-variant-numeric:tabular-nums}',
      '#view-backtest .bt-err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.4);color:var(--red,#F87171);padding:12px 14px;border-radius:8px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function shell() {
    var comps = companyList();
    var opts = comps.map(function (c) { return '<option value="' + esc(c.ticker) + '">' + esc(c.ticker) + (c.nom ? ' — ' + esc(c.nom) : '') + '</option>'; }).join('');
    var today = new Date().toISOString().slice(0, 10);
    var fiveY = new Date(Date.now() - 5 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    return ''
      + '<div class="page-header"><h1>Backtesting <span style="color:var(--gold)">BRVM</span></h1>'
      + '<p>Simulation « achat &amp; conservation » sur une valeur — dividendes, frais, comparaison à l\'indice. Toutes les hypothèses sont affichées.</p></div>'
      + '<div class="card mb20"><div class="card-body"><form class="bt-form" id="btForm">'
      + '<div class="bt-field"><label for="btTicker">Valeur</label><select id="btTicker">' + (opts || '<option value="">—</option>') + '</select></div>'
      + '<div class="bt-field"><label for="btStart">Début</label><input type="date" id="btStart" value="' + fiveY + '"></div>'
      + '<div class="bt-field"><label for="btEnd">Fin</label><input type="date" id="btEnd" value="' + today + '"></div>'
      + '<div class="bt-field"><label for="btCapital">Capital initial (FCFA)</label><input type="number" id="btCapital" min="1000" step="1000" value="1000000"></div>'
      + '<div class="bt-field"><label for="btFee">Frais achat + vente (%)</label><input type="number" id="btFee" min="0" max="10" step="0.05" value="1"></div>'
      + '<div class="bt-field"><label for="btBase">Base de cours</label><select id="btBase"><option value="raw">Cours bruts + dividendes</option><option value="adj">Cours ajustés (rendement total)</option></select></div>'
      + '<div class="bt-field bt-check"><input type="checkbox" id="btReinvest" checked><label for="btReinvest" style="text-transform:none;letter-spacing:0;color:var(--cream)">Réinvestir les dividendes</label></div>'
      + '<div class="bt-field"><button type="submit" class="bt-run" id="btRun">Lancer la simulation</button></div>'
      + '</form></div></div>'
      + '<div id="btOut"></div>';
  }

  function renderResult(res, cfg) {
    var out = document.getElementById('btOut');
    if (!out) return;
    if (res.error) { out.innerHTML = '<div class="bt-err">' + esc(res.error) + '</div>'; return; }

    var pv = res.plusValue >= 0 ? 'pos' : 'neg';
    var vsB = res.bench ? (res.totalRet - res.bench.total) : null;

    var kpis = ''
      + kpi('Valeur finale nette', money(res.netFinal))
      + kpi('Plus / moins-value', money(res.plusValue), pv)
      + kpi('Performance totale', pct(res.totalRet * 100), res.totalRet >= 0 ? 'pos' : 'neg')
      + kpi('Performance annualisée', res.cagr == null ? '—' : pct(res.cagr * 100), res.cagr >= 0 ? 'pos' : 'neg')
      + kpi('Dividendes perçus', money(res.divTotal))
      + kpi('Volatilité annualisée', pct(res.vol * 100, 1))
      + kpi('Perte max (drawdown)', pct(res.mdd * 100, 1), 'neg')
      + (res.bench ? kpi('BRVM Composite (période)', pct(res.bench.total * 100), res.bench.total >= 0 ? 'pos' : 'neg') : '')
      + (vsB != null ? kpi('Surperformance vs indice', pct(vsB * 100), vsB >= 0 ? 'pos' : 'neg') : '');

    var opsRows = '';
    opsRows += '<tr><td>' + dLabel(res.start) + '</td><td>Achat initial</td><td class="r">' + nf(res.entryPrice) + '</td><td class="r">' + nf(res.shares, 2) + '</td><td class="r">' + money(res.capital - res.feeBuy) + '</td></tr>';
    res.divEvents.forEach(function (e) {
      opsRows += '<tr><td>' + dLabel(e.ex) + '</td><td>Dividende ' + nf(e.dps) + ' FCFA/action'
        + (e.reinvested ? ' — réinvesti (+' + nf(e.addedShares, 2) + ' act.)' : ' — encaissé') + '</td>'
        + '<td class="r">' + (e.px ? nf(e.px) : '—') + '</td><td class="r">' + (e.addedShares ? '+' + nf(e.addedShares, 2) : '—') + '</td>'
        + '<td class="r">' + money(e.gross) + '</td></tr>';
    });
    opsRows += '<tr><td>' + dLabel(res.end) + '</td><td>Valeur finale (vente, frais ' + money(res.feeSell) + ')</td><td class="r">' + nf(res.exitPrice) + '</td><td class="r">' + nf(res.shares, 2) + '</td><td class="r">' + money(res.netFinal) + '</td></tr>';

    var divYes = cfg.reinvest ? 'oui' : 'non';
    var baseTxt = cfg.base === 'adj' ? 'cours ajustés des détachements (rendement total implicite)' : 'cours de clôture bruts + dividendes traités explicitement';
    var benchTxt = res.bench
      ? ('BRVM Composite, clôture de l\'indice, du ' + dLabel(res.bench.from) + ' au ' + dLabel(res.bench.to) + (res.bench.partial ? ' <b>(période partielle — historique d\'indice limité)</b>' : ''))
      : 'indisponible sur la période (historique d\'indice insuffisant)';

    out.innerHTML = ''
      + '<div class="bt-kpis">' + kpis + '</div>'
      + '<div class="card mb20"><div class="card-header"><div class="card-title">Évolution du portefeuille</div>'
      + '<button type="button" id="btCsv" style="background:transparent;border:1px solid rgba(245,240,232,.2);color:var(--cream);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer">Export CSV</button></div>'
      + '<div class="card-body"><div class="bt-chart"><canvas id="btChart"></canvas></div></div></div>'
      + '<div class="card mb20"><div class="card-header"><div class="card-title">Journal des opérations</div></div><div class="card-body" style="overflow-x:auto">'
      + '<table><thead><tr><th>Date</th><th>Opération</th><th class="r">Cours</th><th class="r">Parts</th><th class="r">Montant</th></tr></thead><tbody>' + opsRows + '</tbody></table></div></div>'
      + '<div class="card"><div class="card-header"><div class="card-title">Hypothèses de la simulation</div></div><div class="card-body"><div class="bt-hyp">'
      + '• <b>Capital initial</b> : ' + money(res.capital) + '<br>'
      + '• <b>Période effective</b> : du ' + dLabel(res.start) + ' au ' + dLabel(res.end) + ' — ' + res.sessions + ' séances, ' + nf(res.years, 2) + ' an(s). Les bornes sont calées sur les séances réellement cotées.<br>'
      + '• <b>Frais</b> : ' + nf(cfg.fee, 2) + ' % à l\'achat et à la vente (achat ' + money(res.feeBuy) + ', vente ' + money(res.feeSell) + '). Aucun autre frais (garde, courtage fixe) ni fiscalité.<br>'
      + '• <b>Dividendes</b> : source <i>dividendes_calendrier</i>, ' + res.divEvents.length + ' détachement(s) sur la période. Réinvestissement : <b>' + divYes + '</b>' + (cfg.base === 'adj' ? ' — ignoré ici car les cours ajustés intègrent déjà le rendement total.' : ' (au cours de clôture de la séance de détachement, frais d\'achat déduits).') + '<br>'
      + '• <b>Base de cours</b> : ' + baseTxt + '. Source : table <i>historique</i> (BRVM, clôtures officielles).<br>'
      + '• <b>Exécution</b> : à la clôture, sans slippage ni impact marché ; liquidité supposée suffisante.<br>'
      + '• <b>Benchmark</b> : ' + benchTxt + '.<br>'
      + '• <b>Biais du survivant</b> : seules les valeurs encore cotées disposent d\'un historique complet. Les titres radiés / fusionnés durant la période ne sont pas simulables et ne figurent pas dans la liste.<br>'
      + '• <b>Volatilité</b> : écart-type des rendements quotidiens de la courbe de valeur, annualisé (×√252). <b>Drawdown</b> : perte maximale depuis un plus-haut.'
      + '</div></div></div>';

    drawChart(res);
    var cx = document.getElementById('btCsv');
    if (cx) cx.addEventListener('click', function () { exportCsv(res); });
  }

  function kpi(k, v, cls) {
    return '<div class="bt-kpi"><div class="k">' + esc(k) + '</div><div class="v ' + (cls || '') + '">' + v + '</div></div>';
  }

  function drawChart(res) {
    var cv = document.getElementById('btChart');
    if (!cv || typeof Chart === 'undefined') return;
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
    var labels = res.equity.map(function (p) { return p.d; });
    var ds = [{
      label: res.ticker + ' (buy & hold)',
      data: res.equity.map(function (p) { return Math.round(p.v); }),
      borderColor: '#B8964E', backgroundColor: 'rgba(184,150,78,.10)',
      fill: true, tension: .2, pointRadius: 0, borderWidth: 2
    }];
    if (res.bench && res.bench.curve.length) {
      var bmap = {};
      res.bench.curve.forEach(function (p) { bmap[p.d] = Math.round(p.v); });
      ds.push({
        label: 'BRVM Composite (rebasé)',
        data: labels.map(function (d) { return bmap[d] != null ? bmap[d] : null; }),
        borderColor: 'rgba(245,240,232,.45)', borderDash: [5, 4],
        fill: false, tension: .2, pointRadius: 0, borderWidth: 1.5, spanGaps: true
      });
    }
    chart = new Chart(cv, {
      type: 'line',
      data: { labels: labels, datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: 'rgba(245,240,232,.7)', font: { size: 11 } } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ' : ' + nf(c.parsed.y) + ' FCFA'; } } }
        },
        scales: {
          x: { ticks: { color: 'rgba(245,240,232,.4)', maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { color: 'rgba(245,240,232,.4)', callback: function (v) { return nf(v); } }, grid: { color: 'rgba(245,240,232,.06)' } }
        }
      }
    });
  }

  function exportCsv(res) {
    var lines = [['date', 'valeur_portefeuille_fcfa', 'benchmark_brvm_composite_rebasé'].join(';')];
    var bmap = {};
    if (res.bench) res.bench.curve.forEach(function (p) { bmap[p.d] = Math.round(p.v); });
    res.equity.forEach(function (p) { lines.push([p.d, Math.round(p.v), bmap[p.d] != null ? bmap[p.d] : ''].join(';')); });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backtest-' + res.ticker + '-' + res.start + '_' + res.end + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // --- orchestration ---------------------------------------------------
  function readCfg() {
    var g = function (id) { return document.getElementById(id); };
    var t = g('btTicker') ? String(g('btTicker').value || '').toUpperCase() : '';
    return {
      ticker: t,
      start: g('btStart') ? g('btStart').value : '',
      end: g('btEnd') ? g('btEnd').value : '',
      capital: Math.max(1000, num(g('btCapital') && g('btCapital').value) || 1000000),
      fee: Math.max(0, Math.min(10, num(g('btFee') && g('btFee').value) || 0)),
      base: g('btBase') ? g('btBase').value : 'raw',
      reinvest: g('btReinvest') ? g('btReinvest').checked : true
    };
  }

  function launch() {
    if (running) return;
    var cfg = readCfg();
    lastCfg = cfg;
    var out = document.getElementById('btOut');
    var btn = document.getElementById('btRun');
    if (!cfg.ticker) { if (out) out.innerHTML = '<div class="bt-err">Sélectionnez une valeur.</div>'; return; }
    if (!cfg.start || !cfg.end || cfg.start >= cfg.end) { if (out) out.innerHTML = '<div class="bt-err">Renseignez une période valide (début &lt; fin).</div>'; return; }
    running = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Calcul…'; }
    if (out) out.innerHTML = '<div class="bt-hyp" style="padding:20px">Chargement de l\'historique de ' + esc(cfg.ticker) + '…</div>';

    var histP = (typeof window.apiGetHistoriqueComplet === 'function')
      ? window.apiGetHistoriqueComplet(cfg.ticker, { pageSize: 1000, maxPages: 20, dateFrom: cfg.start, dateTo: cfg.end })
      : Promise.resolve([]);
    var guard = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 22000); });

    Promise.race([Promise.all([histP, ensureCompositeHistory(cfg.start)]), guard])
      .then(function (arr) {
        var rows = arr[0] || [];
        var bench = arr[1] || [];
        if (!Array.isArray(rows) || rows.length < 2) {
          renderResult({ error: 'Historique indisponible pour ' + cfg.ticker + ' sur la période demandée.' }, cfg);
          return;
        }
        var adj = (typeof window.tcAdjustedSeries === 'function') ? window.tcAdjustedSeries(cfg.ticker, rows) : rows;
        var res = runEngine(cfg, adj, bench);
        renderResult(res, cfg);
      })
      .catch(function (e) {
        renderResult({ error: 'Échec du calcul : ' + (e && e.message === 'timeout' ? 'délai dépassé au chargement des données.' : (e && e.message) || 'erreur inconnue') + '.' }, cfg);
      })
      .then(function () {
        running = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Lancer la simulation'; }
      });
  }

  function render() {
    var view = document.getElementById('view-backtest');
    if (!view) return;
    injectCss();
    if (!view.dataset.btMounted) {
      view.innerHTML = shell();
      view.dataset.btMounted = '1';
      var form = document.getElementById('btForm');
      if (form) form.addEventListener('submit', function (e) { e.preventDefault(); launch(); });
      var baseSel = document.getElementById('btBase');
      var reinv = document.getElementById('btReinvest');
      if (baseSel && reinv) baseSel.addEventListener('change', function () {
        reinv.disabled = baseSel.value === 'adj';
        reinv.parentElement.style.opacity = baseSel.value === 'adj' ? '.45' : '1';
      });
    } else {
      // repopuler la liste si les sociétés sont arrivées après le 1er montage
      var sel = document.getElementById('btTicker');
      if (sel && sel.options.length <= 1) {
        var comps = companyList();
        if (comps.length) sel.innerHTML = comps.map(function (c) { return '<option value="' + esc(c.ticker) + '">' + esc(c.ticker) + (c.nom ? ' — ' + esc(c.nom) : '') + '</option>'; }).join('');
      }
    }
  }

  window.renderBacktest = render;
})();
