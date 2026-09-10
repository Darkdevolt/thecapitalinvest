// ============================================================================
// FICHE SOCIÉTÉ v2 — structure en 8 blocs (cf. ROADMAP-CONCURRENCE.md §1)
//   1 En-tête · 2 Résumé · 3 Fondamentaux · 4 Valorisation (+ secteur)
//   5 Dividendes · 6 Marché · 7 Documents · 8 Conclusion
// Sources : allEntreprises · allCours · historique (API paginée) ·
//           allFinancials · allDividendes · allAnalyses.
// Aucune donnée inventée : une valeur absente affiche « — ».
// ============================================================================

var ficheChartPeriod = 252;
var ficheChartInst = null;
var prevView = 'titres';
var ficheAdjusted = true; // cours ajustés des dividendes par défaut (recommandation rapport)

// ── Formats ────────────────────────────────────────────────────────────────
function fchNum(v, dec) {
  if (v == null || v === '') return '—';           // null / undefined / '' ≠ 0
  var n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 2 : dec });
}
function fchMoney(v) {
  if (v == null || v === '') return '—';
  var n = Number(v);
  if (!isFinite(n)) return '—';
  var a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Bn';
  if (a >= 1e9) return (n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Md';
  if (a >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
  return fchNum(n);
}
function fchPct(v, dec) {
  if (v == null || v === '') return '—';
  var n = Number(v);
  if (!isFinite(n)) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(dec == null ? 1 : dec) + ' %';
}
function fchDate(v) {
  if (!v) return '—';
  var s = String(v).slice(0, 10);
  var p = s.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s;
}
function fchSens(v) { return Number(v) > 0 ? 'pos' : Number(v) < 0 ? 'neg' : 'neu'; }
function fchEsc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
function fchMedian(arr) {
  var a = arr.filter(function (x) { return isFinite(x); }).sort(function (x, y) { return x - y; });
  if (!a.length) return NaN;
  var m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// ── Historique (API paginée par titre) ────────────────────────────────────
function ficheDateValue(value) {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number') return value;
  var raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) { var t = Date.parse(raw); return isNaN(t) ? NaN : t; }
  var m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  var t2 = Date.parse(raw);
  return isNaN(t2) ? NaN : t2;
}
function ficheSortHistory(arr) {
  return (Array.isArray(arr) ? arr.slice() : []).sort(function (a, b) {
    var da = ficheDateValue(a && a.date_seance), db = ficheDateValue(b && b.date_seance);
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return da - db;
  });
}
// Historique par titre : on privilégie le helper canonique (fetch.js) livré
// par la refonte data-layer, avec repli local. Toujours borné dans le temps :
// une API lente ne doit jamais figer la fiche sur « Chargement… ».
async function loadCompleteFicheHistorique(ticker) {
  var run = (async function () {
    if (typeof window.apiGetHistoriqueComplet === 'function') {
      var rows = await window.apiGetHistoriqueComplet(ticker, { pageSize: 1000, maxPages: 12 });
      return ficheSortHistory(Array.isArray(rows) ? rows : []);
    }
    var all = [], pageSize = 1000;
    for (var page = 0; page < 12; page++) {
      var response = await window.apiGet('/marche?type=historique&ticker=' + encodeURIComponent(ticker) + '&limit=' + pageSize + '&offset=' + (page * pageSize) + '&_=' + Date.now(), { cache: 'no-store' });
      var payload = response && typeof response === 'object' && 'data' in response ? response.data : response;
      var batch = Array.isArray(payload) ? payload : [];
      if (!batch.length) break;
      all.push.apply(all, batch);
      if (batch.length < pageSize) break;
    }
    var byKey = new Map();
    all.forEach(function (row) {
      if (!row) return;
      var key = String(row.ticker || ticker).trim().toUpperCase() + '|' + String(row.date_seance || '');
      if (!byKey.has(key)) byKey.set(key, row);
    });
    return ficheSortHistory(Array.from(byKey.values()));
  })();
  var guard = new Promise(function (resolve) { setTimeout(function () { resolve('__timeout__'); }, 9000); });
  var res = await Promise.race([run, guard]);
  return res === '__timeout__' ? [] : res;
}
function histClose(r) {
  if (ficheAdjusted && r && r.cours_ajuste != null && isFinite(Number(r.cours_ajuste))) return Number(r.cours_ajuste);
  return Number(r && (r.cours_cloture != null ? r.cours_cloture : r.cours_normal != null ? r.cours_normal : r.cours));
}

// ── Calculs ──────────────────────────────────────────────────────────────
function fchRatios(f, cp, nbActions) {
  var out = { per: NaN, pbr: NaN, rdt: NaN, roe: NaN, marge: NaN, capi: NaN };
  if (!f) return out;
  var bpa = Number(f.bpa), dpa = Number(f.dpa);
  var fp = Number(f.fonds_propres != null ? f.fonds_propres : f.capitaux_propres);
  var na = Number(f.nombre_actions != null ? f.nombre_actions : (nbActions || NaN));
  if (isFinite(cp) && isFinite(bpa) && bpa > 0) out.per = cp / bpa;
  if (isFinite(cp) && isFinite(dpa) && cp > 0) out.rdt = (dpa / cp) * 100;
  if (isFinite(cp) && isFinite(fp) && isFinite(na) && na > 0 && fp > 0) out.pbr = cp / (fp / na);
  if (isFinite(f.roe)) out.roe = Number(f.roe) <= 1.5 ? Number(f.roe) * 100 : Number(f.roe);
  else if (isFinite(f.resultat_net) && isFinite(fp) && fp !== 0) out.roe = (f.resultat_net / fp) * 100;
  if (isFinite(f.marge_nette)) out.marge = Number(f.marge_nette) <= 1.5 ? Number(f.marge_nette) * 100 : Number(f.marge_nette);
  else if (isFinite(f.resultat_net) && isFinite(f.chiffre_affaires) && f.chiffre_affaires !== 0) out.marge = (f.resultat_net / f.chiffre_affaires) * 100;
  if (isFinite(cp) && isFinite(na)) out.capi = cp * na;
  return out;
}

function fchSectorBenchmark(sector, exclTicker, coursByTicker, entByTicker) {
  var fins = Array.isArray(window.allFinancials) ? window.allFinancials : [];
  var latestByTicker = {};
  fins.forEach(function (f) {
    if (!f || !f.ticker) return;
    var t = String(f.ticker).toUpperCase();
    var ent = entByTicker[t];
    if (!ent || String(ent.secteur || '') !== String(sector || '')) return;
    if (t === exclTicker) return;
    if (!latestByTicker[t] || Number(f.annee) > Number(latestByTicker[t].annee)) latestByTicker[t] = f;
  });
  var pers = [], pbrs = [], rdts = [], roes = [], marges = [], count = 0;
  Object.keys(latestByTicker).forEach(function (t) {
    var f = latestByTicker[t];
    var c = coursByTicker[t];
    var cp = c ? Number(c.cloture != null ? c.cloture : c.cours) : NaN;
    var r = fchRatios(f, cp, entByTicker[t] && entByTicker[t].nombre_actions);
    if (isFinite(r.per)) pers.push(r.per);
    if (isFinite(r.pbr)) pbrs.push(r.pbr);
    if (isFinite(r.rdt)) rdts.push(r.rdt);
    if (isFinite(r.roe)) roes.push(r.roe);
    if (isFinite(r.marge)) marges.push(r.marge);
    count++;
  });
  return { count: count, per: fchMedian(pers), pbr: fchMedian(pbrs), rdt: fchMedian(rdts), roe: fchMedian(roes), marge: fchMedian(marges) };
}

function fchPerf(hist) {
  var h = (hist || []).filter(function (r) { return isFinite(histClose(r)); });
  if (h.length < 2) return { d30: NaN, ytd: NaN, y1: NaN, volAnnuel: NaN };
  var last = histClose(h[h.length - 1]);
  var at = function (backDays) { return histClose(h[Math.max(0, h.length - 1 - backDays)]); };
  var y = new Date().getFullYear();
  var firstOfYear = h.find(function (r) { return String(r.date_seance || '').slice(0, 4) === String(y); });
  var base = firstOfYear ? histClose(firstOfYear) : histClose(h[0]);
  var rets = [];
  for (var i = 1; i < h.length; i++) {
    var p0 = histClose(h[i - 1]), p1 = histClose(h[i]);
    if (p0 > 0) rets.push((p1 - p0) / p0);
  }
  var mean = rets.reduce(function (s, x) { return s + x; }, 0) / (rets.length || 1);
  var varr = rets.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / (rets.length || 1);
  return {
    d30: at(30) > 0 ? ((last - at(30)) / at(30)) * 100 : NaN,
    ytd: base > 0 ? ((last - base) / base) * 100 : NaN,
    y1: at(252) > 0 ? ((last - at(252)) / at(252)) * 100 : NaN,
    volAnnuel: rets.length ? Math.sqrt(varr) * Math.sqrt(252) * 100 : NaN
  };
}

function fchAvgVolume(hist, days) {
  var h = (hist || []).slice(-(days || 20));
  var v = h.map(function (r) { return Number(r.volume); }).filter(function (x) { return isFinite(x) && x >= 0; });
  return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : NaN;
}

function fchConclusion(ent, fins, r, bench, perf, divs) {
  var forces = [], risques = [], surveiller = [];
  var f0 = fins[0], f1 = fins[1];
  if (isFinite(r.roe)) {
    if (r.roe >= 15) forces.push('Rentabilité élevée : ROE de ' + r.roe.toFixed(1) + ' %.');
    else if (r.roe < 5) risques.push('Rentabilité faible : ROE de ' + r.roe.toFixed(1) + ' %.');
  }
  if (isFinite(r.marge)) {
    if (r.marge >= 20) forces.push('Marge nette solide (' + r.marge.toFixed(1) + ' %).');
    else if (r.marge < 5) risques.push('Marge nette étroite (' + r.marge.toFixed(1) + ' %).');
  }
  if (f0 && f1 && isFinite(f0.resultat_net) && isFinite(f1.resultat_net) && f1.resultat_net !== 0) {
    var g = ((f0.resultat_net - f1.resultat_net) / Math.abs(f1.resultat_net)) * 100;
    if (g >= 10) forces.push('Résultat net en hausse de ' + g.toFixed(0) + ' % sur le dernier exercice.');
    else if (g <= -10) risques.push('Résultat net en baisse de ' + Math.abs(g).toFixed(0) + ' % sur le dernier exercice.');
  }
  if (isFinite(r.per) && isFinite(bench.per) && bench.count >= 2) {
    if (r.per < bench.per * 0.8) forces.push('Valorisation attractive : PER ' + r.per.toFixed(1) + 'x vs médiane secteur ' + bench.per.toFixed(1) + 'x.');
    else if (r.per > bench.per * 1.3) surveiller.push('Prime de valorisation : PER ' + r.per.toFixed(1) + 'x vs ' + bench.per.toFixed(1) + 'x pour le secteur.');
  }
  if (isFinite(r.rdt) && r.rdt >= 6) forces.push('Rendement du dividende élevé (' + r.rdt.toFixed(1) + ' %).');
  if (isFinite(perf.volAnnuel) && perf.volAnnuel >= 40) surveiller.push('Volatilité annualisée élevée (' + perf.volAnnuel.toFixed(0) + ' %).');
  var dette = f0 && (f0.dette_nette != null ? f0.dette_nette : f0.dettes_financieres);
  var fp = f0 && (f0.fonds_propres != null ? f0.fonds_propres : f0.capitaux_propres);
  if (isFinite(dette) && isFinite(fp) && fp > 0 && dette / fp > 1) risques.push('Endettement élevé : dette / fonds propres ' + (dette / fp).toFixed(1) + 'x.');
  if (divs && divs.length) {
    var years = divs.map(function (d) { return Number(d.exercice || d.annee); }).filter(isFinite);
    if (years.length >= 3) forces.push('Distribution de dividende régulière (' + years.length + ' exercices).');
  } else {
    surveiller.push('Aucun dividende récent enregistré.');
  }
  if (fins.length < 2) surveiller.push('Moins de deux exercices financiers disponibles : analyse fondamentale limitée.');
  return { forces: forces, risques: risques, surveiller: surveiller };
}

// ── CSS ──────────────────────────────────────────────────────────────────
function injectFicheCss() {
  if (document.getElementById('tc-fiche-v2-css')) return;
  var s = document.createElement('style');
  s.id = 'tc-fiche-v2-css';
  s.textContent = [
    '#view-fiche{padding:24px clamp(14px,3vw,32px) 56px;max-width:1240px;margin-inline:auto}',
    '#view-fiche .fch-back{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:transparent;color:var(--muted);border-radius:7px;padding:7px 12px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.08em;cursor:pointer;margin-bottom:16px}',
    '#view-fiche .fch-back:hover{color:var(--gold-l);border-color:var(--gold)}',
    '#view-fiche .fch-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;padding-bottom:18px;border-bottom:1px solid var(--border2)}',
    '#view-fiche .fch-id .fch-tkr{font:600 11px/1 var(--mono);letter-spacing:.14em;color:var(--gold);text-transform:uppercase}',
    '#view-fiche .fch-id h1{margin:7px 0 5px;font:600 clamp(24px,3vw,34px)/1.1 var(--serif);color:var(--cream)}',
    '#view-fiche .fch-id .fch-tags{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--muted)}',
    '#view-fiche .fch-id .fch-tags span{border:1px solid var(--border2);border-radius:5px;padding:2px 8px}',
    '#view-fiche .fch-px{text-align:right}',
    '#view-fiche .fch-px .fch-p{font:600 30px/1 var(--mono);color:var(--cream);font-variant-numeric:tabular-nums}',
    '#view-fiche .fch-px .fch-p small{font:400 12px var(--sans);color:var(--muted);margin-left:5px}',
    '#view-fiche .fch-px .fch-v{margin-top:6px;font:600 13px var(--mono)}',
    '#view-fiche .fch-px .fch-v.pos{color:var(--green)}#view-fiche .fch-px .fch-v.neg{color:var(--red)}#view-fiche .fch-px .fch-v.neu{color:var(--dim)}',
    '#view-fiche .fch-sec{margin-top:26px}',
    '#view-fiche .fch-sec-t{font:600 9px/1 var(--sans);letter-spacing:.17em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}',
    '#view-fiche .fch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--border2);border:1px solid var(--border2);border-radius:10px;overflow:hidden}',
    '#view-fiche .fch-cell{background:var(--card);padding:14px 16px;display:flex;flex-direction:column;gap:5px}',
    '#view-fiche .fch-cell .l{font:600 8px/1.2 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}',
    '#view-fiche .fch-cell .val{font:500 17px/1.1 var(--mono);color:var(--cream);font-variant-numeric:tabular-nums}',
    '#view-fiche .fch-cell .sub{font:400 10px var(--sans);color:var(--muted)}',
    '#view-fiche .fch-cell .val.pos{color:var(--green)}#view-fiche .fch-cell .val.neg{color:var(--red)}',
    '#view-fiche .fch-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px}',
    '#view-fiche .fch-cols{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:18px;align-items:start}',
    '#view-fiche .chart-container{height:340px}',
    '#view-fiche table.fch-fin{width:100%;border-collapse:collapse;font-size:12px}',
    '#view-fiche table.fch-fin th{text-align:right;padding:9px 10px;font:600 8px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--border)}',
    '#view-fiche table.fch-fin th:first-child{text-align:left}',
    '#view-fiche table.fch-fin td{text-align:right;padding:9px 10px;border-bottom:1px solid var(--border2);color:var(--cream);font-variant-numeric:tabular-nums}',
    '#view-fiche table.fch-fin td:first-child{text-align:left;color:var(--muted)}',
    '#view-fiche .fch-bench{display:grid;grid-template-columns:1fr auto auto;gap:8px 14px;font-size:12px;align-items:center}',
    '#view-fiche .fch-bench .h{font:600 8px var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}',
    '#view-fiche .fch-bench .tkr{color:var(--cream);font-family:var(--mono);text-align:right}',
    '#view-fiche .fch-bench .tkr.pos{color:var(--green)}#view-fiche .fch-bench .tkr.neg{color:var(--red)}',
    '#view-fiche .fch-bench .med{color:var(--muted);font-family:var(--mono);text-align:right}',
    '#view-fiche .fch-bench .lab{color:var(--muted)}',
    '#view-fiche .fch-concl{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}',
    '#view-fiche .fch-concl .box{border:1px solid var(--border2);border-radius:10px;padding:14px 16px}',
    '#view-fiche .fch-concl .box h4{margin:0 0 9px;font:600 9px var(--sans);letter-spacing:.12em;text-transform:uppercase}',
    '#view-fiche .fch-concl .box.f h4{color:var(--green)}#view-fiche .fch-concl .box.r h4{color:var(--red)}#view-fiche .fch-concl .box.s h4{color:var(--warn)}',
    '#view-fiche .fch-concl .box ul{margin:0;padding:0}',
    '#view-fiche .fch-concl .box li{margin:0 0 7px;font-size:11.5px;line-height:1.55;color:var(--cream);list-style:none;padding-left:14px;position:relative}',
    '#view-fiche .fch-concl .box li:before{content:"\\203A";position:absolute;left:0;color:var(--gold)}',
    '#view-fiche .fch-concl .box .empty{font-size:11px;color:var(--dim)}',
    '#view-fiche .fch-docs a{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--border2);border-radius:8px;margin-bottom:8px;font-size:12px;color:var(--cream);text-decoration:none}',
    '#view-fiche .fch-docs a:hover{border-color:var(--gold)}',
    '#view-fiche .fch-docs a span:last-child{color:var(--gold-l)}',
    '#view-fiche .year-tab{border:1px solid var(--border2);background:transparent;color:var(--muted);border-radius:999px;padding:4px 11px;font:500 10px var(--mono);cursor:pointer}',
    '#view-fiche .year-tab.active{background:var(--gold-bg);color:var(--gold-l);border-color:var(--gold)}',
    '#view-fiche .fch-muted{color:var(--dim);font-size:12px}',
    '@media(max-width:820px){#view-fiche .fch-cols{grid-template-columns:1fr}#view-fiche .fch-head{gap:12px}#view-fiche .fch-px{text-align:left}}'
  ].join('\n');
  document.head.appendChild(s);
}

// ── Helpers de composition ──────────────────────────────────────────────
function fchSec(title, inner) { return '<div class="fch-sec"><div class="fch-sec-t">' + title + '</div>' + inner + '</div>'; }
function fchGrid(cells) { return '<div class="fch-grid">' + cells.join('') + '</div>'; }
function fchCell(l, val, sub, sens) { return '<div class="fch-cell"><span class="l">' + l + '</span><span class="val' + (sens ? ' ' + sens : '') + '">' + val + '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>'; }
function fchFinRow(label, arr, key, fmtFn, custom) {
  return '<tr><td>' + label + '</td>' + arr.slice(0, 5).map(function (f) {
    var val = custom ? custom(f) : (fmtFn ? fmtFn(f[key]) : f[key]);
    return '<td>' + (val == null || val === '' ? '—' : val) + '</td>';
  }).join('') + '</tr>';
}
function fchBenchRow(label, mine, med, unit, dec) {
  var lowerBetter = (label === 'PER' || label === 'P/B');
  var cls = (isFinite(mine) && isFinite(med)) ? (lowerBetter ? (mine < med ? 'pos' : 'neg') : (mine > med ? 'pos' : 'neg')) : '';
  return '<span class="lab">' + label + '</span>'
    + '<span class="tkr ' + cls + '">' + (isFinite(mine) ? mine.toFixed(dec) + unit : '—') + '</span>'
    + '<span class="med">' + (isFinite(med) ? med.toFixed(dec) + unit : '—') + '</span>';
}
function fchConclBox(k, title, items) {
  return '<div class="box ' + k + '"><h4>' + title + '</h4>'
    + (items.length ? '<ul>' + items.map(function (x) { return '<li>' + fchEsc(x) + '</li>'; }).join('') + '</ul>'
      : '<div class="empty">Rien de significatif.</div>') + '</div>';
}

// ── Rendu principal ──────────────────────────────────────────────────────
async function openFiche(ticker, from, noHash) {
  var T = String(ticker || '').trim().toUpperCase();
  if (!T) { console.warn('[FICHE] ticker vide'); return false; }
  prevView = from || 'titres';
  window._lastFicheTicker = T;
  var _ficheToken = (window.__ficheToken = (window.__ficheToken || 0) + 1);
  injectFicheCss();

  if (typeof nav === 'function') nav('fiche', true);
  if (!noHash) history.replaceState(null, '', '#fiche=' + encodeURIComponent(T));
  document.title = 'Fiche ' + T + ' · The Capital';

  var view = document.getElementById('view-fiche');
  if (!view) { console.warn('[FICHE] #view-fiche introuvable'); return false; }
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); v.style.display = 'none'; });
  view.classList.add('active'); view.style.display = '';
  view.innerHTML = '<button class="fch-back" type="button" onclick="nav(\'' + prevView + '\')">← Retour</button>'
    + '<div class="fch-muted">Chargement de ' + fchEsc(T) + '…</div>';

  try {
  var entList = Array.isArray(window.allEntreprises) ? window.allEntreprises : [];
  var coursList = Array.isArray(window.allCours) ? window.allCours : [];
  var finList = Array.isArray(window.allFinancials) ? window.allFinancials : [];
  var divList = Array.isArray(window.allDividendes) ? window.allDividendes : [];
  var anaList = Array.isArray(window.allAnalyses) ? window.allAnalyses : [];

  var ent = entList.find(function (e) { return String(e && e.ticker || '').toUpperCase() === T; }) || {};
  var coursNow = coursList.find(function (c) { return String(c && c.ticker || '').toUpperCase() === T; }) || {};
  var fins = finList.filter(function (f) { return String(f && f.ticker || '').toUpperCase() === T; })
    .sort(function (a, b) { return Number(b.annee) - Number(a.annee); });
  var divs = divList.filter(function (d) { return String(d && d.ticker || '').toUpperCase() === T; })
    .sort(function (a, b) { return Number(b.exercice || b.annee || 0) - Number(a.exercice || a.annee || 0); });
  var anas = anaList.filter(function (a) { return String(a && a.ticker || '').toUpperCase() === T; })
    .sort(function (a, b) { return Date.parse(b.date_analyse || 0) - Date.parse(a.date_analyse || 0); });

  var hist = [];
  try { hist = await loadCompleteFicheHistorique(T); } catch (e) { hist = []; }
  try { if (typeof window.tcAdjustedSeries === 'function' && hist.length) hist = window.tcAdjustedSeries(T, hist); } catch (e) {}
  window.ficheHistorique = hist;
  window.__ficheHasAdj = hist.length && hist.some(function (r) { return r && r.cours_ajuste != null && Number(r.cours_ajuste) !== Number(r.cours_cloture != null ? r.cours_cloture : r.cours); });
  var last = hist.length ? hist[hist.length - 1] : null;

  // Un rendu de fiche plus récent a été lancé pendant l'attente réseau :
  // abandonner celui-ci (le nouveau possède désormais le placeholder).
  // Si l'utilisateur a simplement changé de vue, on continue quand même à
  // remplir #view-fiche pour qu'il soit prêt au retour — jamais bloqué sur
  // « Chargement… ».
  if (_ficheToken !== window.__ficheToken) return false;

  var cp = Number(coursNow.cloture != null ? coursNow.cloture : coursNow.cours);
  if (!isFinite(cp) && last) cp = histClose(last);
  var variation = Number(coursNow.variation_pct != null ? coursNow.variation_pct : coursNow.variation);
  var secteur = ent.secteur || (typeof getSector === 'function' ? getSector(T) : '');
  var nbAct = Number(ent.nombre_actions != null ? ent.nombre_actions : ent.nb_actions);

  var f0 = fins[0] || null;
  var r = fchRatios(f0, cp, nbAct);
  if (!isFinite(r.capi)) r.capi = Number(coursNow.capitalisation) || (f0 && Number(f0.cap_boursiere)) || NaN;

  var coursByT = {}, entByT = {};
  coursList.forEach(function (c) { if (c && c.ticker) coursByT[String(c.ticker).toUpperCase()] = c; });
  entList.forEach(function (e) { if (e && e.ticker) entByT[String(e.ticker).toUpperCase()] = e; });
  var bench = fchSectorBenchmark(secteur, T, coursByT, entByT);
  var perf = fchPerf(hist);
  var volMoy = fchAvgVolume(hist, 20);
  var concl = fchConclusion(ent, fins, r, bench, perf, divs);

  var H = [];
  H.push('<button class="fch-back" type="button" onclick="nav(\'' + prevView + '\')">← Retour</button>');

  // 1 · En-tête
  H.push('<div class="fch-head"><div class="fch-id">'
    + '<div class="fch-tkr">' + fchEsc(T) + (ent.compartiment ? ' · ' + fchEsc(ent.compartiment) : '') + '</div>'
    + '<h1>' + fchEsc(ent.nom || ent.nom_court || T) + '</h1>'
    + '<div class="fch-tags">'
    + (secteur ? '<span>' + fchEsc(secteur) + '</span>' : '')
    + (ent.pays ? '<span>' + fchEsc(ent.pays) + '</span>' : '')
    + '<span>BRVM · FCFA</span>'
    + (ent.date_introduction ? '<span>Intro. ' + fchDate(ent.date_introduction) + '</span>' : '')
    + '</div></div>'
    + '<div class="fch-px"><div class="fch-p">' + fchNum(cp) + '<small>FCFA</small></div>'
    + '<div class="fch-v ' + fchSens(variation) + '">' + (isFinite(variation) ? (variation > 0 ? '▲ ' : variation < 0 ? '▼ ' : '') + fchPct(variation, 2) : '—') + '</div>'
    + '<div class="fch-muted" style="margin-top:4px">séance du ' + fchDate((last && last.date_seance) || coursNow.date_seance) + '</div></div></div>');

  // 2 · Résumé
  H.push(fchSec('Résumé', fchGrid([
    fchCell('Capitalisation', fchMoney(r.capi), 'FCFA'),
    fchCell('Volume moyen (20 s.)', isFinite(volMoy) ? fchNum(volMoy, 0) : '—', 'titres / séance'),
    fchCell('Rendement du dividende', isFinite(r.rdt) ? r.rdt.toFixed(2) + ' %' : '—', f0 ? 'exercice ' + f0.annee : ''),
    fchCell('Perf. 30 séances', fchPct(perf.d30), '', fchSens(perf.d30)),
    fchCell('Perf. année en cours', fchPct(perf.ytd), '', fchSens(perf.ytd)),
    fchCell('Perf. 1 an', fchPct(perf.y1), '', fchSens(perf.y1))
  ])));

  // 3 · Fondamentaux
  H.push(fchSec('Fondamentaux', fins.length
    ? '<div class="fch-card" style="overflow-x:auto"><table class="fch-fin"><thead><tr><th>Exercice</th>'
      + fins.slice(0, 5).map(function (f) { return '<th>' + f.annee + '</th>'; }).join('') + '</tr></thead><tbody>'
      + fchFinRow('Chiffre d\'affaires', fins, 'chiffre_affaires', fchMoney)
      + fchFinRow('Résultat brut d\'expl.', fins, 'rbe', fchMoney)
      + fchFinRow('Résultat net', fins, 'resultat_net', fchMoney)
      + fchFinRow('Marge nette', fins, null, null, function (f) { var m = f.marge_nette != null ? (Number(f.marge_nette) <= 1.5 ? f.marge_nette * 100 : f.marge_nette) : (f.resultat_net && f.chiffre_affaires ? f.resultat_net / f.chiffre_affaires * 100 : NaN); return isFinite(m) ? Number(m).toFixed(1) + ' %' : '—'; })
      + fchFinRow('Fonds propres', fins, null, null, function (f) { return fchMoney(f.fonds_propres != null ? f.fonds_propres : f.capitaux_propres); })
      + fchFinRow('Dette nette', fins, null, null, function (f) { return fchMoney(f.dette_nette != null ? f.dette_nette : f.dettes_financieres); })
      + fchFinRow('BPA', fins, 'bpa', function (v) { return isFinite(Number(v)) ? fchNum(v, 0) + ' F' : '—'; })
      + fchFinRow('DPA', fins, 'dpa', function (v) { return isFinite(Number(v)) ? fchNum(v, 0) + ' F' : '—'; })
      + '</tbody></table></div>'
    : '<div class="fch-card fch-muted">États financiers non disponibles pour cette société.</div>'));

  // 4 · Valorisation + secteur
  H.push(fchSec('Valorisation', '<div class="fch-cols">'
    + '<div class="fch-card">' + fchGrid([
      fchCell('PER', isFinite(r.per) ? r.per.toFixed(1) + 'x' : '—'),
      fchCell('P/B (P / Actif net)', isFinite(r.pbr) ? r.pbr.toFixed(2) + 'x' : '—'),
      fchCell('Rendement', isFinite(r.rdt) ? r.rdt.toFixed(2) + ' %' : '—'),
      fchCell('ROE', isFinite(r.roe) ? r.roe.toFixed(1) + ' %' : '—'),
      fchCell('Marge nette', isFinite(r.marge) ? r.marge.toFixed(1) + ' %' : '—')
    ]) + '</div>'
    + '<div class="fch-card"><div class="fch-sec-t" style="margin-bottom:10px">vs secteur' + (bench.count ? ' · ' + bench.count + ' pairs' : '') + '</div>'
    + '<div class="fch-bench"><span class="h lab">Indicateur</span><span class="h tkr">' + fchEsc(T) + '</span><span class="h med">Médiane</span>'
    + fchBenchRow('PER', r.per, bench.per, 'x', 2)
    + fchBenchRow('P/B', r.pbr, bench.pbr, 'x', 2)
    + fchBenchRow('Rendement', r.rdt, bench.rdt, ' %', 1)
    + fchBenchRow('ROE', r.roe, bench.roe, ' %', 1)
    + fchBenchRow('Marge nette', r.marge, bench.marge, ' %', 1)
    + '</div></div></div>'));

  // 4b · Score maison The Capital
  if (typeof window.tcScoreFromMetrics === 'function') {
    var caG = (fins[0] && fins[1] && Number(fins[0].chiffre_affaires) && Number(fins[1].chiffre_affaires))
      ? (fins[0].chiffre_affaires / fins[1].chiffre_affaires - 1) * 100 : null;
    var fpS = f0 ? Number(f0.fonds_propres != null ? f0.fonds_propres : f0.capitaux_propres) : NaN;
    var detteS = f0 ? Number(f0.dette_nette != null ? f0.dette_nette : f0.dettes_financieres) : NaN;
    var sMed = (typeof window.tcSectorMedians === 'function') ? window.tcSectorMedians(secteur || '—') : {};
    var sc = window.tcScoreFromMetrics({
      per: isFinite(r.per) ? r.per : null,
      pbr: isFinite(r.pbr) ? r.pbr : null,
      roe: isFinite(r.roe) ? r.roe : null,
      marge: isFinite(r.marge) ? r.marge : null,
      rdt: isFinite(r.rdt) ? r.rdt : null,
      detteFp: (isFinite(detteS) && isFinite(fpS) && fpS) ? detteS / fpS : null,
      croissance: caG
    }, sMed);
    H.push(fchSec('Score The Capital', '<div class="fch-card">'
      + '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px">'
      + '<span style="font-family:var(--serif);font-size:40px;line-height:1">' + (sc.score == null ? '—' : sc.score) + '</span>'
      + '<span class="fch-muted">/ 100</span><b style="color:var(--gold);font-size:15px">' + fchEsc(sc.label) + '</b></div>'
      + '<div style="overflow-x:auto"><table class="fch-fin"><thead><tr><th>Critère</th><th>Points</th><th>Lecture</th></tr></thead><tbody>'
      + sc.components.map(function (c) {
        return '<tr><td>' + fchEsc(c.l) + '</td><td>' + (c.pts == null ? '<span class="fch-muted">non noté</span>' : c.pts.toFixed(1) + ' / ' + c.max) + '</td>'
          + '<td class="fch-muted" style="white-space:normal">' + fchEsc(c.detail) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<div class="fch-muted" style="margin-top:8px;font-size:11px">Pondération valorisation 25 · rentabilité 25 · croissance 20 · rendement 15 · solidité 15, ramenée sur 100 en ne comptant que les critères calculables depuis la base. Ce n\'est pas un conseil d\'investissement.</div>'
      + '</div>'));
  }

  // 5 · Dividendes
  H.push(fchSec('Dividendes', divs.length
    ? '<div class="fch-card" style="overflow-x:auto"><table class="fch-fin"><thead><tr><th>Exercice</th><th>Montant net</th><th>Rendement</th><th>Détachement</th><th>Paiement</th><th>Statut</th></tr></thead><tbody>'
      + divs.slice(0, 8).map(function (d) {
        var rdt = d.taux_rendement != null ? d.taux_rendement : d.rendement;
        var mnt = d.montant_net != null ? d.montant_net : d.montant;
        return '<tr><td>' + fchEsc(d.exercice || d.annee || '—') + '</td>'
          + '<td>' + (isFinite(Number(mnt)) ? fchNum(mnt, 0) + ' F' : '—') + '</td>'
          + '<td>' + (isFinite(Number(rdt)) ? Number(rdt).toFixed(2) + ' %' : '—') + '</td>'
          + '<td>' + fchDate(d.date_detachement || d.ex_date) + '</td>'
          + '<td>' + fchDate(d.date_paiement_cal || d.date_paiement) + '</td>'
          + '<td>' + fchEsc(d.statut || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
    : '<div class="fch-card fch-muted">Aucun dividende enregistré pour cette société.</div>'));

  // 6 · Marché
  H.push(fchSec('Marché', '<div class="fch-card">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">'
    + '<div class="fch-sec-t" style="margin:0">Cours ' + (ficheAdjusted && window.__ficheHasAdj ? '<span style="color:var(--muted)">(ajusté des dividendes)</span>' : '') + (isFinite(perf.volAnnuel) ? ' · volatilité annualisée ' + perf.volAnnuel.toFixed(0) + ' %' : '') + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
    + (window.__ficheHasAdj ? '<button class="year-tab ' + (ficheAdjusted ? 'active' : '') + '" onclick="setFicheAdjusted(true)">Ajusté</button>'
      + '<button class="year-tab ' + (ficheAdjusted ? '' : 'active') + '" onclick="setFicheAdjusted(false)">Brut</button><span style="width:8px"></span>' : '')
    + [['1M', 30], ['3M', 90], ['6M', 180], ['1A', 252], ['Tout', 99999]].map(function (p) {
      return '<button class="year-tab ' + (p[1] === 252 ? 'active' : '') + '" onclick="setFichePeriod(' + p[1] + ',this)">' + p[0] + '</button>';
    }).join('') + '</div></div>'
    + '<div class="chart-container"><canvas id="chartFiche"></canvas></div></div>'));

  // 7 · Documents
  var docs = fins.filter(function (f) { return f.source_url && /^https?:\/\//i.test(f.source_url); });
  H.push(fchSec('Documents', docs.length
    ? '<div class="fch-card fch-docs">' + docs.slice(0, 8).map(function (f) {
      return '<a href="' + fchEsc(f.source_url) + '" target="_blank" rel="noopener noreferrer">'
        + '<span>' + fchEsc(f.source || ('États financiers ' + f.annee)) + ' · ' + f.annee + '</span><span>Ouvrir ↗</span></a>';
    }).join('') + '</div>'
    : '<div class="fch-card fch-muted">Aucun document source référencé.</div>'));

  // 8 · Conclusion
  H.push(fchSec('Conclusion', '<div class="fch-concl">'
    + fchConclBox('f', 'Points forts', concl.forces)
    + fchConclBox('r', 'Risques', concl.risques)
    + fchConclBox('s', 'À surveiller', concl.surveiller)
    + '</div>'
    + (anas.length && typeof renderAnalyseCard === 'function'
      ? '<div class="fch-sec"><div class="fch-sec-t">Notes The Capital Research</div>' + anas.slice(0, 2).map(function (a) { return renderAnalyseCard(a, true); }).join('') + '</div>'
      : '')));

  view.innerHTML = H.join('');
  window._ficheFins = fins;
  ficheChartPeriod = 252;
  renderFicheChart();
  return true;
  } catch (err) {
    console.error('[FICHE] rendu:', err);
    try {
      // Ne pas laisser le placeholder « Chargement… » : le remplacer par un
      // état d'erreur, sauf si un rendu plus récent a repris la main.
      if (_ficheToken === window.__ficheToken) {
        var vv = document.getElementById('view-fiche');
        if (vv) {
          vv.innerHTML = '<button class="fch-back" type="button" onclick="nav(\'' + prevView + '\')">← Retour</button>'
            + '<div class="fch-sec"><div class="fch-sec-t">' + fchEsc(T) + '</div>'
            + '<div class="fch-card fch-muted">Le détail de cette valeur n\'a pas pu s\'afficher (' + fchEsc(err && err.message || 'erreur') + ').<br>Réessayez depuis la liste des titres.</div></div>';
        }
      }
    } catch (e2) {}
    return false;
  }
}

function renderFiche() {
  var h = location.hash || '';
  var m = h.match(/^#fiche=(.+)$/);
  var t = m ? decodeURIComponent(m[1]) : (window._lastFicheTicker || '');
  if (t) openFiche(t, prevView, true);
}

function renderFicheChart() {
  var cv = document.getElementById('chartFiche');
  if (!cv || typeof Chart === 'undefined') return;
  var data = (window.ficheHistorique || []).slice(-ficheChartPeriod);
  if (!data.length) { if (cv.parentElement) cv.parentElement.innerHTML = '<div class="fch-muted" style="padding:40px;text-align:center">Historique de cours indisponible.</div>'; return; }
  var labels = data.map(function (d) {
    var t = ficheDateValue(d.date_seance);
    return isNaN(t) ? String(d.date_seance || '') : new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  });
  var vals = data.map(histClose);
  if (ficheChartInst) { try { ficheChartInst.destroy(); } catch (e) {} }
  var ds = typeof mkDataset === 'function'
    ? mkDataset(vals)
    : { data: vals, borderColor: '#B8964E', borderWidth: 2, fill: true, backgroundColor: 'rgba(184,150,78,.10)', pointRadius: 0, tension: 0.3 };
  ficheChartInst = new Chart(cv, {
    type: 'line',
    data: { labels: labels, datasets: [ds] },
    options: (typeof chartOpts !== 'undefined' ? chartOpts : { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } })
  });
}

function setFichePeriod(n, btn) {
  ficheChartPeriod = n;
  if (btn) { document.querySelectorAll('#view-fiche .year-tab').forEach(function (b) { b.classList.remove('active'); }); btn.classList.add('active'); }
  renderFicheChart();
}
function setChartPeriod(n, btn) { setFichePeriod(n, btn); }
function setFicheAdjusted(on) {
  ficheAdjusted = !!on;
  document.querySelectorAll('#view-fiche .year-tab').forEach(function (b) {
    var lbl = (b.textContent || '').trim();
    if (lbl === 'Ajusté') b.classList.toggle('active', ficheAdjusted);
    if (lbl === 'Brut') b.classList.toggle('active', !ficheAdjusted);
  });
  renderFicheChart();
}
window.setFicheAdjusted = setFicheAdjusted;

window.openFiche = openFiche;
window.renderFiche = renderFiche;
window.setFichePeriod = setFichePeriod;
window.setChartPeriod = setChartPeriod;
