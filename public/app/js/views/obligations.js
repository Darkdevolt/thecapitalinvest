// ============================================================================
// OBLIGATIONS BRVM  (P2 roadmap — « tout ce qui est lié à l'obligation »)
// Consultation du marché obligataire : cours du jour, rendement courant,
// rendement à l'échéance (YTM approx.), courbe des taux, et par ligne un
// tableau d'amortissement (in fine / amortissement constant / annuités
// constantes) reconstruit à partir des caractéristiques.
// Source : /api/marche?type=obligations et ?type=obligations_marche.
// Hypothèses affichées : valeur nominale (10 000 FCFA par défaut, ajustable),
// périodicité, méthode d'amortissement. Aucune donnée inventée — un champ
// absent en base reste « — ».
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_OBLIGATIONS_V1__) return;
  window.__TC_OBLIGATIONS_V1__ = true;

  var LIST = null;
  var MARCHE = null;
  var CARAC = null; // code_obligation -> fiche technique DC/BR (ISIN, etc.)
  var loading = false;
  var VN = 10000;
  var METHODE = 'in_fine';   // in_fine | amort_constant | annuites_constantes
  var FREQ = 1;              // coupons par an
  var SEL = null;            // code sélectionné
  var SORT = { key: 'maturite', dir: 1 };
  var chartCurve = null, chartFlux = null;

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function nf(v, dec) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 0 : dec }) : '—'; }
  function pct(v, dec) { var n = Number(v); return isFinite(n) ? (n > 0 ? '+' : '') + nf(n, dec == null ? 2 : dec) + ' %' : '—'; }
  function g(id) { return document.getElementById(id); }
  function ymd(v) { return v ? String(v).slice(0, 10) : ''; }
  function dLabel(s) { var d = ymd(s); if (!d) return '—'; var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function yearsBetween(a, b) {
    if (!a || !b) return null;
    var d = (new Date(b) - new Date(a)) / (365.25 * 24 * 3600 * 1000);
    return isFinite(d) ? d : null;
  }

  function souverain(o) {
    var s = ((o.code || '') + ' ' + (o.nom || '')).toUpperCase();
    return /BIDC|BOAD|EBID|TPCI|TPBF|TPML|TPNE|TPSN|TPTG|TPCI|ETAT|TRESOR|SUKUK|CI\.O|SN\.O|BF\.O|ML\.O|TG\.O|BN\.O|NE\.O/.test(s);
  }

  // rendement à l'échéance — approximation analytique (comme le simulateur Outils)
  function metrics(o) {
    var seance = MARCHE && MARCHE.date_seance ? MARCHE.date_seance : (o.date_seance || new Date().toISOString().slice(0, 10));
    var n = yearsBetween(seance, o.date_maturite);
    var prix = num(o.cours);
    var taux = num(o.taux_facial);
    var couponAnnuel = (taux != null) ? taux / 100 * VN : null;
    var courant = (couponAnnuel != null && prix) ? couponAnnuel / prix * 100 : null;
    var ytm = null;
    if (couponAnnuel != null && prix && n && n > 0) {
      ytm = ((couponAnnuel + (VN - prix) / n) / ((VN + prix) / 2)) * 100;
    }
    return { n: n, prix: prix, taux: taux, couponAnnuel: couponAnnuel, courant: courant, ytm: ytm, seance: seance };
  }

  // tableau d'amortissement reconstruit
  function schedule(o) {
    var m = metrics(o);
    if (m.taux == null || !m.n || m.n <= 0) return null;
    var years = Math.max(1, Math.round(m.n));
    var i = m.taux / 100 / FREQ;
    var periods = years * FREQ;
    var rows = [];
    var crd = VN;
    if (METHODE === 'in_fine') {
      for (var k = 1; k <= periods; k++) {
        var interet = VN * i;
        var amort = (k === periods) ? VN : 0;
        rows.push({ k: k, crd0: crd, interet: interet, amort: amort, annuite: interet + amort, crd1: crd - amort });
        crd -= amort;
      }
    } else if (METHODE === 'amort_constant') {
      var a = VN / periods;
      for (var k2 = 1; k2 <= periods; k2++) {
        var int2 = crd * i;
        rows.push({ k: k2, crd0: crd, interet: int2, amort: a, annuite: int2 + a, crd1: crd - a });
        crd -= a;
      }
    } else { // annuites_constantes
      var A = i > 0 ? VN * i / (1 - Math.pow(1 + i, -periods)) : VN / periods;
      for (var k3 = 1; k3 <= periods; k3++) {
        var int3 = crd * i;
        var amort3 = A - int3;
        rows.push({ k: k3, crd0: crd, interet: int3, amort: amort3, annuite: A, crd1: crd - amort3 });
        crd -= amort3;
      }
    }
    return { rows: rows, periods: periods, years: years, i: i, freq: FREQ, methode: METHODE };
  }

  // ---- données ----
  function load() {
    if (LIST) return Promise.resolve();
    if (typeof window.apiGet !== 'function') { LIST = []; CARAC = {}; return Promise.resolve(); }
    return Promise.all([
      window.apiGet('/marche?type=obligations').catch(function () { return []; }),
      window.apiGet('/marche?type=obligations_marche&limit=5').catch(function () { return []; }),
      window.apiGet('/marche?type=obligations_caracteristiques&limit=500').catch(function () { return []; })
    ]).then(function (r) {
      var rows = Array.isArray(r[0]) ? r[0] : (r[0] && r[0].data) || [];
      var mar = Array.isArray(r[1]) ? r[1] : (r[1] && r[1].data) || [];
      var fiches = Array.isArray(r[2]) ? r[2] : (r[2] && r[2].data) || [];
      LIST = rows.filter(function (o) { return o && o.code; });
      MARCHE = mar[0] || null;
      // Une même obligation (rapprochement par nom, admin DC/BR) peut avoir
      // plusieurs fiches (ex. tranches) : garder la plus récemment publiée.
      CARAC = {};
      fiches.forEach(function (f) {
        if (!f || !f.code_obligation) return;
        var prev = CARAC[f.code_obligation];
        if (!prev || String(f.date_jouissance || '') > String(prev.date_jouissance || '')) CARAC[f.code_obligation] = f;
      });
    });
  }

  // ---- rendu ----
  function injectCss() {
    if (g('tc-obl-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-obl-css';
    s.textContent = [
      '#view-obligations .ob-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}',
      '#view-obligations .ob-kpi{background:var(--card,#181410);border:1px solid rgba(245,240,232,.09);border-radius:10px;padding:13px 15px}',
      '#view-obligations .ob-kpi .k{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}',
      '#view-obligations .ob-kpi .v{font-family:var(--mono,monospace);font-size:18px;margin-top:5px;font-variant-numeric:tabular-nums}',
      '#view-obligations .ob-params{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:14px}',
      '#view-obligations .ob-field{display:flex;flex-direction:column;gap:4px}',
      '#view-obligations .ob-field label{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--gold)}',
      '#view-obligations select,#view-obligations input{background:var(--surface,#13110C);border:1px solid rgba(245,240,232,.16);color:var(--cream,#F5F0E8);border-radius:8px;padding:8px 10px;font:inherit}',
      '#view-obligations .ob-card{background:var(--card,#181410);border:1px solid rgba(245,240,232,.09);border-radius:12px;padding:16px;margin-bottom:16px}',
      '#view-obligations .ob-chart{height:300px}',
      '#view-obligations table{width:100%;border-collapse:collapse;font-size:13px}',
      '#view-obligations th,#view-obligations td{padding:8px 10px;border-bottom:1px solid rgba(245,240,232,.08);text-align:left;white-space:nowrap}',
      '#view-obligations td.r,#view-obligations th.r{text-align:right;font-variant-numeric:tabular-nums}',
      '#view-obligations thead th{cursor:pointer;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)}',
      '#view-obligations tbody tr{cursor:pointer}#view-obligations tbody tr:hover td{background:rgba(245,240,232,.04)}',
      '#view-obligations .ob-code{font-family:var(--mono,monospace);font-weight:700;color:var(--gold)}',
      '#view-obligations .ob-nom{font-size:11px;color:var(--dim)}',
      '#view-obligations .pos{color:var(--green,#4ADE80)}#view-obligations .neg{color:var(--red,#F87171)}',
      '#view-obligations .ob-note{font-size:11.5px;line-height:1.55;color:var(--muted,rgba(245,240,232,.6))}',
      '#view-obligations .ob-back{background:transparent;border:1px solid rgba(245,240,232,.2);color:var(--cream);border-radius:7px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer;margin-bottom:12px}',
      '#view-obligations .ob-empty{padding:26px;text-align:center;color:var(--dim)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function kpi(k, v, cls) { return '<div class="ob-kpi"><div class="k">' + esc(k) + '</div><div class="v ' + (cls || '') + '">' + v + '</div></div>'; }

  function paramsBar() {
    return '<div class="ob-params">'
      + '<div class="ob-field"><label for="obVN">Valeur nominale</label><input type="number" id="obVN" min="100" step="500" value="' + VN + '" style="width:130px"></div>'
      + '<div class="ob-field"><label for="obMethode">Amortissement</label><select id="obMethode">'
      + '<option value="in_fine"' + (METHODE === 'in_fine' ? ' selected' : '') + '>In fine (remboursement à l\'échéance)</option>'
      + '<option value="amort_constant"' + (METHODE === 'amort_constant' ? ' selected' : '') + '>Amortissement constant du capital</option>'
      + '<option value="annuites_constantes"' + (METHODE === 'annuites_constantes' ? ' selected' : '') + '>Annuités constantes</option>'
      + '</select></div>'
      + '<div class="ob-field"><label for="obFreq">Périodicité</label><select id="obFreq">'
      + '<option value="1"' + (FREQ === 1 ? ' selected' : '') + '>Annuelle</option>'
      + '<option value="2"' + (FREQ === 2 ? ' selected' : '') + '>Semestrielle</option>'
      + '<option value="4"' + (FREQ === 4 ? ' selected' : '') + '>Trimestrielle</option>'
      + '</select></div>'
      + '</div>';
  }

  function bindParams() {
    if (g('obVN')) g('obVN').addEventListener('change', function () { VN = Math.max(100, num(this.value) || 10000); render(); });
    if (g('obMethode')) g('obMethode').addEventListener('change', function () { METHODE = this.value; render(); });
    if (g('obFreq')) g('obFreq').addEventListener('change', function () { FREQ = num(this.value) || 1; render(); });
  }

  function drawCurve(rows) {
    var cv = g('obCurve');
    if (!cv || typeof Chart === 'undefined') return;
    if (chartCurve) { try { chartCurve.destroy(); } catch (e) {} chartCurve = null; }
    var pts = rows.map(function (r) { return r.m.n && r.m.ytm != null ? { x: r.m.n, y: r.m.ytm, s: souverain(r.o), code: r.o.code } : null; }).filter(Boolean);
    if (pts.length < 2) { cv.parentElement.innerHTML = '<div class="ob-empty">Courbe des taux indisponible : pas assez de lignes avec échéance et prix exploitables.</div>'; return; }
    var sov = pts.filter(function (p) { return p.s; });
    var corp = pts.filter(function (p) { return !p.s; });
    // tendance : régression linéaire simple sur tous les points
    var n = pts.length, sx = 0, sy = 0, sxy = 0, sx2 = 0;
    pts.forEach(function (p) { sx += p.x; sy += p.y; sxy += p.x * p.y; sx2 += p.x * p.x; });
    var den = n * sx2 - sx * sx;
    var slope = den ? (n * sxy - sx * sy) / den : 0;
    var inter = (sy - slope * sx) / n;
    var xs = pts.map(function (p) { return p.x; });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    chartCurve = new Chart(cv, {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'Souverain / régional', data: sov, backgroundColor: '#B8964E', pointRadius: 5 },
          { label: 'Corporate', data: corp, backgroundColor: '#60A5FA', pointRadius: 5 },
          { label: 'Tendance', type: 'line', data: [{ x: xmin, y: slope * xmin + inter }, { x: xmax, y: slope * xmax + inter }], borderColor: 'rgba(245,240,232,.4)', borderDash: [5, 4], pointRadius: 0, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'rgba(245,240,232,.7)', font: { size: 11 } } },
          tooltip: { callbacks: { label: function (c) { return (c.raw.code || '') + ' · ' + nf(c.raw.x, 1) + ' ans · ' + nf(c.raw.y, 2) + ' %'; } } }
        },
        scales: {
          x: { title: { display: true, text: 'Années à maturité', color: 'rgba(245,240,232,.5)' }, ticks: { color: 'rgba(245,240,232,.4)' }, grid: { color: 'rgba(245,240,232,.06)' } },
          y: { title: { display: true, text: 'Rendement à l\'échéance (%)', color: 'rgba(245,240,232,.5)' }, ticks: { color: 'rgba(245,240,232,.4)', callback: function (v) { return v + ' %'; } }, grid: { color: 'rgba(245,240,232,.06)' } }
        }
      }
    });
  }

  function ficheOf(o) { return (CARAC && CARAC[o.code]) || null; }

  var COLS = [
    { k: 'code', l: 'Code', v: function (r) { return '<span class="ob-code">' + esc(r.o.code) + '</span><div class="ob-nom">' + esc((r.o.nom || '').slice(0, 30)) + '</div>'; } },
    { k: 'isin', l: 'ISIN', v: function (r) { var f = ficheOf(r.o); return f && f.isin ? '<span class="ob-code" style="color:var(--cream)">' + esc(f.isin) + '</span>' : '—'; } },
    { k: 'taux', l: 'Taux facial', cls: 'r', v: function (r) { return r.m.taux != null ? nf(r.m.taux, 2) + ' %' : '—'; } },
    { k: 'maturite', l: 'Maturité', cls: 'r', v: function (r) { return dLabel(r.o.date_maturite); } },
    { k: 'n', l: 'Années rest.', cls: 'r', v: function (r) { return r.m.n != null ? nf(r.m.n, 1) : '—'; } },
    { k: 'prix', l: 'Cours', cls: 'r', v: function (r) { return r.m.prix != null ? nf(r.m.prix) : '—'; } },
    { k: 'coupon_couru', l: 'Coupon couru', cls: 'r', v: function (r) { return num(r.o.coupon_couru) != null ? nf(r.o.coupon_couru, 2) : '—'; } },
    { k: 'courant', l: 'Rdt courant', cls: 'r', v: function (r) { return r.m.courant != null ? nf(r.m.courant, 2) + ' %' : '—'; } },
    { k: 'ytm', l: 'Rdt échéance', cls: 'r', v: function (r) { return r.m.ytm != null ? '<b>' + nf(r.m.ytm, 2) + ' %</b>' : '—'; } }
  ];

  function sortRows(rows) {
    var k = SORT.key, d = SORT.dir;
    return rows.slice().sort(function (a, b) {
      var va, vb;
      if (k === 'code') { va = a.o.code || ''; vb = b.o.code || ''; return va.localeCompare(vb) * d; }
      if (k === 'isin') { va = (ficheOf(a.o) || {}).isin || ''; vb = (ficheOf(b.o) || {}).isin || ''; return va.localeCompare(vb) * d; }
      if (k === 'maturite') { va = a.o.date_maturite || ''; vb = b.o.date_maturite || ''; return String(va).localeCompare(String(vb)) * d; }
      if (k === 'coupon_couru') { va = num(a.o.coupon_couru); vb = num(b.o.coupon_couru); }
      else { va = a.m[k]; vb = b.m[k]; }
      va = va == null ? -Infinity : va; vb = vb == null ? -Infinity : vb;
      return (va - vb) * d;
    });
  }

  function renderList() {
    var view = g('view-obligations');
    injectCss();
    var rows = (LIST || []).map(function (o) { return { o: o, m: metrics(o) }; });
    var m = MARCHE || {};

    view.innerHTML = ''
      + '<div class="page-header"><h1>Obligations <span style="color:var(--gold)">BRVM</span></h1>'
      + '<p>Cours du jour, rendement courant et à l\'échéance, courbe des taux et tableau d\'amortissement par ligne. Cliquez une obligation pour le détail.</p></div>'
      + '<div class="ob-kpis">'
      + kpi('Lignes cotées', m.nb_lignes != null ? nf(m.nb_lignes) : nf(rows.length))
      + kpi('Capitalisation obligataire', num(m.capitalisation_obligations) != null ? nf(m.capitalisation_obligations) + ' F' : '—')
      + kpi('Valeur des transactions', num(m.valeur_transactions) != null ? nf(m.valeur_transactions) + ' F' : '—')
      + kpi('Séance', m.date_seance ? dLabel(m.date_seance) : '—')
      + '</div>'
      + paramsBar()
      + (rows.length
        ? '<div class="ob-card"><div class="ob-note" style="margin-bottom:8px;text-transform:uppercase;letter-spacing:.1em;font-size:9px;color:var(--gold)">Courbe des taux</div><div class="ob-chart"><canvas id="obCurve"></canvas></div></div>'
          + '<div class="ob-card" style="overflow-x:auto"><table><thead><tr>'
          + COLS.map(function (c) { return '<th class="' + (c.cls || '') + '" data-k="' + c.k + '">' + esc(c.l) + (SORT.key === c.k ? (SORT.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('')
          + '</tr></thead><tbody>'
          + sortRows(rows).map(function (r) {
            return '<tr data-code="' + esc(r.o.code) + '">' + COLS.map(function (c) { return '<td class="' + (c.cls || '') + '">' + c.v(r) + '</td>'; }).join('') + '</tr>';
          }).join('')
          + '</tbody></table></div>'
          + '<p class="ob-note">Hypothèses : valeur nominale ' + nf(VN) + ' FCFA (ajustable ci-dessus), coupons ' + (FREQ === 1 ? 'annuels' : FREQ === 2 ? 'semestriels' : 'trimestriels') + '. '
          + 'Le <b>rendement courant</b> = coupon annuel / cours. Le <b>rendement à l\'échéance</b> est une approximation ( C + (VN − prix)/n ) / ( (VN + prix)/2 ), sans calcul actuariel exact ni réinvestissement des coupons. '
          + 'Maturité et taux facial sont lus dans la base ou déduits du libellé. Ceci n\'est pas un conseil d\'investissement.</p>'
        : '<div class="ob-empty">Aucune obligation en base. Lancez la récupération dans Admin → Récupération BRVM.</div>');

    bindParams();
    view.querySelectorAll('thead th[data-k]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (SORT.key === k) SORT.dir = -SORT.dir; else { SORT.key = k; SORT.dir = (k === 'code' || k === 'maturite') ? 1 : -1; }
        renderList();
      });
    });
    view.querySelectorAll('tbody tr[data-code]').forEach(function (tr) {
      tr.addEventListener('click', function () { SEL = tr.getAttribute('data-code'); render(); });
    });
    if (rows.length) drawCurve(rows);
  }

  function renderDetail() {
    var view = g('view-obligations');
    injectCss();
    var o = (LIST || []).find(function (x) { return x.code === SEL; });
    if (!o) { SEL = null; return renderList(); }
    var m = metrics(o);
    var sch = schedule(o);
    var fiche = ficheOf(o);

    var carac = [
      ['Code', o.code],
      ['Émetteur', o.nom || '—']
    ];
    if (fiche) {
      carac.push(['ISIN', fiche.isin || '—']);
      if (fiche.raison_sociale_emetteur) carac.push(['Raison sociale', fiche.raison_sociale_emetteur]);
      if (fiche.registraire) carac.push(['Registraire', fiche.registraire]);
      if (fiche.valeur_nominale != null) carac.push(['Valeur nominale (DC/BR)', nf(fiche.valeur_nominale) + ' FCFA']);
      if (fiche.nombre_titres != null) carac.push(['Nombre de titres', nf(fiche.nombre_titres)]);
      if (fiche.mode_remboursement) carac.push(['Mode de remboursement', fiche.mode_remboursement]);
      if (fiche.modalite_paiement) carac.push(['Modalité de paiement', fiche.modalite_paiement]);
    }
    carac = carac.concat([
      ['Taux facial', m.taux != null ? nf(m.taux, 2) + ' %' : '—'],
      ['Émission', dLabel(o.date_emission)],
      ['Maturité', dLabel(o.date_maturite)],
      ['Années restantes', m.n != null ? nf(m.n, 2) : '—'],
      ['Cours du jour', m.prix != null ? nf(m.prix) + ' FCFA' : '—'],
      ['Coupon couru', num(o.coupon_couru) != null ? nf(o.coupon_couru, 2) + ' FCFA' : '—'],
      ['Dernier paiement', o.dernier_paiement_date ? dLabel(o.dernier_paiement_date) + (o.dernier_paiement_valeur != null ? ' · ' + nf(o.dernier_paiement_valeur, 2) : '') : '—'],
      ['Coupon annuel (VN ' + nf(VN) + ')', m.couponAnnuel != null ? nf(m.couponAnnuel) + ' FCFA' : '—'],
      ['Rendement courant', m.courant != null ? nf(m.courant, 2) + ' %' : '—'],
      ['Rendement à l\'échéance', m.ytm != null ? nf(m.ytm, 2) + ' %' : '—']
    ]);

    var methLabel = METHODE === 'in_fine' ? 'In fine' : METHODE === 'amort_constant' ? 'Amortissement constant' : 'Annuités constantes';

    view.innerHTML = ''
      + '<button type="button" class="ob-back" id="obBack">← Toutes les obligations</button>'
      + '<div class="page-header"><h1>' + esc(o.code) + ' <span style="color:var(--gold)">' + esc((o.nom || '').slice(0, 40)) + '</span></h1></div>'
      + paramsBar()
      + '<div class="ob-card"><div class="ob-note" style="margin-bottom:8px;text-transform:uppercase;letter-spacing:.1em;font-size:9px;color:var(--gold)">Caractéristiques</div>'
      + '<div style="overflow-x:auto"><table><tbody>'
      + carac.map(function (c) { return '<tr><td>' + esc(c[0]) + '</td><td class="r">' + esc(c[1]) + '</td></tr>'; }).join('')
      + '</tbody></table></div></div>'
      + (sch
        ? '<div class="ob-card"><div class="ob-note" style="margin-bottom:8px;text-transform:uppercase;letter-spacing:.1em;font-size:9px;color:var(--gold)">Tableau d\'amortissement — ' + esc(methLabel) + ' · ' + (FREQ === 1 ? 'annuel' : FREQ === 2 ? 'semestriel' : 'trimestriel') + '</div>'
          + '<div class="ob-chart"><canvas id="obFlux"></canvas></div>'
          + '<div style="overflow-x:auto;margin-top:12px"><table><thead><tr><th>Échéance</th><th class="r">CRD début</th><th class="r">Intérêt</th><th class="r">Amortissement</th><th class="r">Annuité</th><th class="r">CRD fin</th></tr></thead><tbody>'
          + sch.rows.map(function (r) {
            return '<tr><td>' + r.k + ' / ' + sch.periods + '</td><td class="r">' + nf(r.crd0) + '</td><td class="r">' + nf(r.interet) + '</td><td class="r">' + nf(r.amort) + '</td><td class="r">' + nf(r.annuite) + '</td><td class="r">' + nf(Math.max(0, r.crd1)) + '</td></tr>';
          }).join('')
          + '</tbody></table></div>'
          + '<p class="ob-note" style="margin-top:10px">Reconstruction à partir du taux facial, de la valeur nominale et de la maturité — <b>' + esc(methLabel) + '</b>. Le type d\'amortissement réel figure dans la note d\'information de l\'émission ; ce tableau est un modèle. Hors fiscalité, frais et clauses particulières (différé, call…).</p>'
          + '</div>'
        : '<div class="ob-card ob-note">Tableau d\'amortissement impossible : taux facial ou maturité manquants pour cette ligne.</div>');

    if (g('obBack')) g('obBack').addEventListener('click', function () { SEL = null; render(); });
    bindParams();
    if (sch) drawFlux(sch);
  }

  function drawFlux(sch) {
    var cv = g('obFlux');
    if (!cv || typeof Chart === 'undefined') return;
    if (chartFlux) { try { chartFlux.destroy(); } catch (e) {} chartFlux = null; }
    chartFlux = new Chart(cv, {
      type: 'bar',
      data: {
        labels: sch.rows.map(function (r) { return 'É' + r.k; }),
        datasets: [
          { label: 'Intérêt', data: sch.rows.map(function (r) { return Math.round(r.interet); }), backgroundColor: '#B8964E' },
          { label: 'Amortissement', data: sch.rows.map(function (r) { return Math.round(r.amort); }), backgroundColor: '#60A5FA' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'rgba(245,240,232,.7)', font: { size: 11 } } } },
        scales: {
          x: { stacked: true, ticks: { color: 'rgba(245,240,232,.4)', maxTicksLimit: 12 }, grid: { display: false } },
          y: { stacked: true, ticks: { color: 'rgba(245,240,232,.4)', callback: function (v) { return nf(v); } }, grid: { color: 'rgba(245,240,232,.06)' } }
        }
      }
    });
  }

  function render() {
    var view = g('view-obligations');
    if (!view) return;
    injectCss();
    if (loading) return;
    if (!LIST) {
      view.innerHTML = '<div class="page-header"><h1>Obligations <span style="color:var(--gold)">BRVM</span></h1></div><div class="ob-empty">Chargement du marché obligataire…</div>';
      loading = true;
      load().then(function () { loading = false; render(); });
      return;
    }
    if (SEL) renderDetail(); else renderList();
  }

  window.renderObligations = render;
})();
