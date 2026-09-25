// ============================================================================
// MATIÈRES PREMIÈRES — cours mondiaux et titres BRVM qui en dépendent.
// Une carte par matière (cours en FCFA, variations, position sur 5 ans), puis,
// pour la matière choisie : sa courbe et le tableau des titres liés, avec
//   • le lien mesuré entre le cours et le chiffre d'affaires publié
//     (corrélation des variations sur un an, sensibilité, indication pour le
//     trimestre en cours) — calcul partagé avec l'analyse fondamentale ;
//   • le lien entre le cours et le COURS DE BOURSE du titre (corrélation des
//     variations mensuelles sur 3 ans, performance sur un an de chacun).
// Source des prix : FMI (Primary Commodity Prices) via FRED, table
// commodity_prices, /api/marche?type=commodities. Aucune donnée inventée.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_MATIERES_V1__) return;
  window.__TC_MATIERES_V1__ = true;

  var ORDRE = ['huile_palme', 'caoutchouc', 'sucre', 'brent', 'cacao', 'coton'];
  var CONTEXTE = {
    cacao: 'La Côte d\'Ivoire fournit environ 40 % du cacao mondial : aucun producteur n\'est coté à la BRVM, mais le cours pèse sur les recettes d\'exportation, le budget ivoirien et la consommation intérieure.',
    coton: 'Culture de rente majeure au Burkina Faso, au Mali et en Côte d\'Ivoire : aucun égreneur n\'est coté, mais le cours influence les revenus agricoles de la sous-région.'
  };
  var SEL = null;
  var HISTO = {};      // ticker -> [{mois, cours}] (fin de mois, ajusté des opérations sur titres)
  var HISTO_EN_COURS = {};

  function g(id) { return document.getElementById(id); }
  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function nf(v, d) { return fin(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '—'; }
  function pcs(v, d) { return fin(v) ? (v > 0 ? '+' : '') + (v * 100).toLocaleString('fr-FR', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) + ' %' : '—'; }
  function cls(v) { return fin(v) ? (v >= 0 ? 'mp-up' : 'mp-down') : ''; }
  function M() { return window.AFMatieres; }
  function nomDe(t) {
    var e = (window.entMap && window.entMap[t]) || (Array.isArray(window.allEntreprises) ? window.allEntreprises.find(function (x) { return x && String(x.ticker).toUpperCase() === t; }) : null) || {};
    return e.nom_court || e.nom || t;
  }
  function coursDe(t) {
    var c = (Array.isArray(window.allCours) ? window.allCours : []).find(function (x) { return x && String(x.ticker).toUpperCase() === t; }) || {};
    var v = Number(c.cloture != null ? c.cloture : c.cours);
    return v > 0 ? v : NaN;
  }
  function moisTxt(m) { return new Date(m + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); }

  function injectStyle() {
    if (g('tc-mp-style')) return;
    var s = document.createElement('style');
    s.id = 'tc-mp-style';
    s.textContent = [
      '#view-matieres-premieres .mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-bottom:18px}',
      '#view-matieres-premieres .mp-card{text-align:left;background:var(--surface,#15130f);border:1px solid var(--border2,rgba(184,150,78,.18));border-radius:10px;padding:14px 15px;cursor:pointer;color:inherit;font:inherit;min-width:0}',
      '#view-matieres-premieres .mp-card:hover{border-color:rgba(184,150,78,.4)}',
      '#view-matieres-premieres .mp-card.on{border-color:var(--gold,#d8b568);box-shadow:0 0 0 1px var(--gold,#d8b568) inset}',
      '#view-matieres-premieres .mp-k{font:600 9px var(--sans,sans-serif);letter-spacing:.12em;text-transform:uppercase;color:var(--gold,#d8b568)}',
      '#view-matieres-premieres .mp-v{font:600 20px var(--mono,monospace);margin-top:6px;color:var(--cream,#eee)}',
      '#view-matieres-premieres .mp-s{font:400 11px var(--sans,sans-serif);color:var(--dim,#999);margin-top:3px}',
      '#view-matieres-premieres .mp-row{display:flex;gap:14px;margin-top:8px;font:600 11px var(--mono,monospace);flex-wrap:wrap}',
      '#view-matieres-premieres .mp-up{color:var(--green,#4ddb9c)}#view-matieres-premieres .mp-down{color:var(--red,#f87171)}',
      '#view-matieres-premieres .mp-range{position:relative;height:4px;border-radius:2px;background:rgba(184,150,78,.15);margin:10px 0 4px}',
      '#view-matieres-premieres .mp-range i{position:absolute;top:-3px;width:10px;height:10px;border-radius:50%;background:var(--gold,#d8b568);transform:translateX(-50%)}',
      '#view-matieres-premieres .mp-chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}',
      '#view-matieres-premieres .mp-chip{font:600 10px var(--mono,monospace);padding:2px 7px;border-radius:5px;background:rgba(184,150,78,.1);color:var(--gold,#d8b568)}',
      '#view-matieres-premieres .mp-panel{background:var(--surface,#15130f);border:1px solid var(--border2,rgba(184,150,78,.18));border-radius:10px;padding:16px;margin-bottom:16px;min-width:0}',
      '#view-matieres-premieres .mp-h{font:600 15px var(--sans,sans-serif);color:var(--cream,#eee);margin:0 0 4px}',
      '#view-matieres-premieres .mp-note{font:400 12px/1.55 var(--sans,sans-serif);color:var(--muted,#aaa);margin:6px 0 12px}',
      '#view-matieres-premieres svg.mp-chart{width:100%;height:auto;display:block}',
      '#view-matieres-premieres .mp-chart text{font:10px var(--mono,monospace);fill:var(--dim,#999)}',
      '#view-matieres-premieres .mp-tbl{width:100%;border-collapse:collapse;font:12px var(--sans,sans-serif)}',
      '#view-matieres-premieres .mp-tbl th{font:600 9px var(--sans,sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--dim,#999);text-align:right;padding:8px 10px;border-bottom:1px solid var(--border2,rgba(184,150,78,.18));white-space:nowrap}',
      '#view-matieres-premieres .mp-tbl td{padding:10px;border-bottom:1px solid rgba(184,150,78,.08);text-align:right;font-family:var(--mono,monospace);vertical-align:top}',
      '#view-matieres-premieres .mp-tbl th:first-child,#view-matieres-premieres .mp-tbl td:first-child{text-align:left;font-family:var(--sans,sans-serif)}',
      '#view-matieres-premieres .mp-tbl small{display:block;color:var(--dim,#999);font:400 10px var(--sans,sans-serif);margin-top:2px;white-space:normal}',
      '#view-matieres-premieres .mp-btn{border:1px solid rgba(184,150,78,.3);background:rgba(184,150,78,.08);color:var(--gold,#d8b568);border-radius:6px;padding:5px 9px;font:600 10px var(--sans,sans-serif);cursor:pointer;white-space:nowrap}',
      '#view-matieres-premieres .mp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '#view-matieres-premieres .mp-scroll table{min-width:860px}',
      '#view-matieres-premieres .mp-src{font:400 11px/1.5 var(--sans,sans-serif);color:var(--dim,#999);margin-top:8px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Graphique ligne en SVG (FCFA, 6 ans) ──────────────────────────── */
  function courbe(points) {
    if (points.length < 2) return '';
    var W = 900, H = 260, L = 64, R = 14, T = 14, B = 26;
    var vals = points.map(function (p) { return p.fcfa; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    function x(i) { return L + i * (W - L - R) / (points.length - 1); }
    function y(v) { return H - B - (v - min) / (max - min) * (H - T - B); }
    var d = points.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.fcfa).toFixed(1); }).join(' ');
    var aire = d + ' L' + x(points.length - 1).toFixed(1) + ' ' + (H - B) + ' L' + L + ' ' + (H - B) + ' Z';
    var grid = [max, (max + min) / 2, min].map(function (v) {
      return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="rgba(184,150,78,.12)"/>' +
        '<text x="' + (L - 8) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + nf(v) + '</text>';
    }).join('');
    var ticks = points.map(function (p, i) {
      return p.mois.slice(5) === '01' ? '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + p.mois.slice(0, 4) + '</text>' : '';
    }).join('');
    var der = points[points.length - 1];
    return '<svg class="mp-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cours mensuel en FCFA">' + grid +
      '<path d="' + aire + '" fill="rgba(216,181,104,.08)"/>' +
      '<path d="' + d + '" fill="none" stroke="#d8b568" stroke-width="2"/>' +
      '<circle cx="' + x(points.length - 1).toFixed(1) + '" cy="' + y(der.fcfa).toFixed(1) + '" r="4" fill="#d8b568"/>' + ticks + '</svg>';
  }

  /* ── Cours de bourse : fin de mois, ajusté des attributions / fractionnements ── */
  function chargerHisto(t) {
    if (HISTO[t] || HISTO_EN_COURS[t] || typeof window.apiGet !== 'function') return;
    HISTO_EN_COURS[t] = true;
    window.apiGet('/marche?type=historique&ticker=' + encodeURIComponent(t) + '&limit=1000').then(function (r) {
      var rows = Array.isArray(r) ? r : (r && Array.isArray(r.data) ? r.data : []);
      var parMois = {};
      rows.forEach(function (x) {
        var d = String(x.date_seance || '').slice(0, 10), c = Number(x.cloture != null ? x.cloture : x.cours_cloture);
        if (!d || !(c > 0)) return;
        var f = typeof window.tcShareFactorAt === 'function' ? window.tcShareFactorAt(t, d) : 1;
        var m = d.slice(0, 7);
        if (!parMois[m] || d > parMois[m].d) parMois[m] = { d: d, cours: c * (f > 0 ? f : 1) };
      });
      HISTO[t] = Object.keys(parMois).sort().map(function (m) { return { mois: m, cours: parMois[m].cours }; });
    }).catch(function () { HISTO[t] = []; }).then(function () {
      HISTO_EN_COURS[t] = false;
      if (document.querySelector('#view-matieres-premieres.active')) render();
    });
  }

  function correl(a, b) {
    var n = a.length;
    if (n < 12) return NaN;
    var ma = a.reduce(function (s, v) { return s + v; }, 0) / n, mb = b.reduce(function (s, v) { return s + v; }, 0) / n;
    var sab = 0, saa = 0, sbb = 0;
    for (var i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) * (a[i] - ma); sbb += (b[i] - mb) * (b[i] - mb); }
    return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
  }

  /* Variations mensuelles du titre et de la matière sur les 36 derniers mois communs. */
  function lienBourse(t, points) {
    var h = HISTO[t];
    if (!h || !h.length) return null;
    var prix = {}; points.forEach(function (p) { prix[p.mois] = p.fcfa; });
    var bourse = {}; h.forEach(function (p) { bourse[p.mois] = p.cours; });
    var mois = h.map(function (p) { return p.mois; }).filter(function (m) { return prix[m] != null; });
    var ra = [], rb = [];
    for (var i = 1; i < mois.length; i++) {
      var m0 = mois[i - 1], m1 = mois[i];
      var d0 = new Date(m0 + '-01'), d1 = new Date(m1 + '-01');
      if ((d1.getFullYear() - d0.getFullYear()) * 12 + d1.getMonth() - d0.getMonth() !== 1) continue;
      ra.push(bourse[m1] / bourse[m0] - 1); rb.push(prix[m1] / prix[m0] - 1);
    }
    ra = ra.slice(-36); rb = rb.slice(-36);
    var der = h[h.length - 1], an = h.filter(function (p) { return p.mois <= prevAn(der.mois); }).pop();
    return { r: correl(ra, rb), n: ra.length, perf12: an ? der.cours / an.cours - 1 : NaN };
  }
  function prevAn(m) { return (Number(m.slice(0, 4)) - 1) + m.slice(4); }

  function lectureR(r) { if (!fin(r)) return 'non établi'; var a = Math.abs(r); return a >= 0.7 ? 'fort' : a >= 0.4 ? 'modéré' : a >= 0.2 ? 'faible' : 'quasi nul'; }

  /* ── Rendu ──────────────────────────────────────────────────────── */
  function carte(cle) {
    var m = M(), def = m.SERIES[cle], pts = m.serieFcfa(cle), st = m.stats(pts);
    if (!st) return '';
    var lies = m.titresLies(cle);
    return '<button type="button" class="mp-card' + (cle === SEL ? ' on' : '') + '" data-mp="' + cle + '">' +
      '<div class="mp-k">' + esc(def.libelle) + '</div>' +
      '<div class="mp-v">' + nf(st.dernier) + ' <span style="font-size:11px;color:var(--dim)">' + esc(def.unite) + '</span></div>' +
      '<div class="mp-s">' + esc(moisTxt(st.mois)) + ' · ' + nf(st.dernierUsd, 1) + ' ' + esc(def.usd) + '</div>' +
      '<div class="mp-row"><span class="' + cls(st.var1m) + '">1 mois ' + pcs(st.var1m) + '</span><span class="' + cls(st.var12m) + '">1 an ' + pcs(st.var12m) + '</span></div>' +
      '<div class="mp-range" title="Position du cours dans sa fourchette des 5 dernières années"><i style="left:' + (fin(st.rang5) ? Math.round(st.rang5 * 100) : 50) + '%"></i></div>' +
      '<div class="mp-s">Fourchette 5 ans : ' + nf(st.min5) + ' – ' + nf(st.max5) + '</div>' +
      '<div class="mp-chips">' + (lies.length ? lies.map(function (l) { return '<span class="mp-chip">' + esc(l.ticker) + '</span>'; }).join('') : '<span class="mp-s" style="margin:0">Aucun titre coté directement exposé</span>') + '</div>' +
      '</button>';
  }

  function detail(cle) {
    var m = M(), def = m.SERIES[cle], pts = m.serieFcfa(cle), st = m.stats(pts);
    var lies = m.titresLies(cle);
    var recents = pts.filter(function (p) { return p.mois >= String(new Date().getFullYear() - 6); });
    var html = '<div class="mp-panel"><div class="mp-h">' + esc(def.libelle) + ' en ' + esc(def.unite) + '</div>' +
      '<div class="mp-note">Moyenne mensuelle du marché mondial, convertie au cours euro/dollar du mois (1 € = 655,957 FCFA). ' +
      'Sur un an : ' + pcs(st.var12m) + ' en FCFA, ' + pcs(st.var12mUsd) + ' en dollars. Moyenne sur 5 ans : ' + nf(st.moy5) + ' ' + esc(def.unite) +
      ' ; le cours actuel est au-dessus de ' + (fin(st.rang5) ? Math.round(st.rang5 * 100) : '—') + ' % des mois de cette période.</div>' +
      courbe(recents) + '</div>';

    html += '<div class="mp-panel"><div class="mp-h">Titres liés et impact</div>';
    if (!lies.length) {
      html += '<div class="mp-note">' + esc(CONTEXTE[cle] || 'Aucun titre coté à la BRVM n\'a un chiffre d\'affaires directement indexé sur ce cours.') + '</div></div>';
      return html;
    }
    html += '<div class="mp-note">Pour chaque titre : le lien mesuré entre ce cours et son chiffre d\'affaires publié (variations sur un an, trimestre contre même trimestre, ' +
      'à défaut année contre année), ce que le cours du trimestre en cours indique pour son prochain chiffre d\'affaires, et le lien avec son cours de bourse ' +
      '(variations mensuelles sur 3 ans). Une corrélation mesure un lien passé, pas une prévision.</div>';
    html += '<div class="mp-scroll"><table class="mp-tbl"><thead><tr>' +
      '<th>Titre</th><th>Cours</th><th>Bourse 1 an</th><th>Lien cours → CA</th><th>Sensibilité du CA</th><th>Indication trimestre en cours</th><th>Lien cours → bourse</th><th></th>' +
      '</tr></thead><tbody>';
    lies.forEach(function (l) {
      var t = l.ticker;
      chargerHisto(t);
      var lien = null, sig = null;
      try { lien = m.lienCa(t, cle); sig = m.signal(t, cle, lien); } catch (e) { lien = null; }
      var base = lien ? (lien.trimestriel.n >= 4 ? lien.trimestriel : lien.annuel) : null;
      var baseTxt = base ? (base === lien.trimestriel ? base.n + ' trimestres' : base.n + ' exercices') : '';
      var lb = lienBourse(t, pts);
      html += '<tr>' +
        '<td><strong>' + esc(t) + '</strong> ' + esc(nomDe(t)) + (l.principal ? '' : ' <small>activité secondaire</small>') + (l.note ? '<small>' + esc(l.note) + '</small>' : '') + '</td>' +
        '<td>' + nf(coursDe(t)) + '</td>' +
        '<td class="' + (lb ? cls(lb.perf12) : '') + '">' + (lb ? pcs(lb.perf12) : (HISTO_EN_COURS[t] ? '…' : '—')) + '</td>' +
        '<td>' + (base && base.n >= 3 && fin(base.r) ? nf(base.r, 2) + '<small>' + lectureR(base.r) + ' · ' + baseTxt + '</small>' : '—<small>pas assez de périodes publiées</small>') + '</td>' +
        '<td>' + (base && base.n >= 3 && fin(base.pente) ? nf(base.pente, 2) + '<small>+10 % de cours ≈ ' + pcs(base.pente * 0.1) + ' de CA</small>' : '—') + '</td>' +
        '<td>' + (sig ? '<span class="' + cls(sig.dCaIndicatif) + '">' + (fin(sig.dCaIndicatif) ? pcs(sig.dCaIndicatif) : '—') + '</span><small>cours ' + esc(sig.label) + ' ' + pcs(sig.dPrix) + ' sur un an' +
          (sig.moisConnus < 3 ? ' (' + sig.moisConnus + ' mois connu' + (sig.moisConnus > 1 ? 's' : '') + ')' : '') + (fin(sig.dCaIndicatif) ? '' : ' · lien trop faible pour chiffrer') + '</small>' : '—') + '</td>' +
        '<td>' + (lb && fin(lb.r) ? nf(lb.r, 2) + '<small>' + lectureR(lb.r) + ' · ' + lb.n + ' mois</small>' : (HISTO_EN_COURS[t] ? '…' : '—')) + '</td>' +
        '<td><button type="button" class="mp-btn" data-mp-ouvrir="' + esc(t) + '">Analyse →</button></td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function render() {
    var root = g('view-matieres-premieres');
    if (!root) return;
    injectStyle();
    var m = M();
    var head = '<div class="page-header"><h1>Matières <span style="color:var(--gold)">premières</span></h1>' +
      '<p>Cours mondiaux en FCFA et impact mesuré sur les titres BRVM qui en dépendent (chiffre d\'affaires et cours de bourse).</p></div>';
    if (!m) { root.innerHTML = head + '<div class="mp-panel"><div class="mp-note">Module de calcul en cours de chargement…</div></div>'; return; }
    if (!m.charge()) {
      root.innerHTML = head + '<div class="mp-panel"><div class="mp-note">Chargement des cours…</div></div>';
      m.charger().then(render).catch(function () {
        root.innerHTML = head + '<div class="mp-panel"><div class="mp-note">Les cours des matières premières n\'ont pas pu être chargés. Réessayez dans un instant.</div></div>';
      });
      return;
    }
    var dispo = ORDRE.filter(function (k) { return m.SERIES[k] && m.serieFcfa(k).length; });
    if (!SEL || dispo.indexOf(SEL) < 0) SEL = dispo[0];
    root.innerHTML = head + '<div class="mp-grid">' + dispo.map(carte).join('') + '</div>' + (SEL ? detail(SEL) : '') +
      '<div class="mp-src">Source : FMI, Primary Commodity Prices (moyennes mensuelles), via la Réserve fédérale de Saint-Louis (FRED) ; parité euro/dollar de la Réserve fédérale. ' +
      'Mise à jour chaque lundi ; le FMI publie un mois écoulé au début du mois suivant. Cours de bourse ajustés des attributions gratuites et fractionnements, hors dividendes. ' +
      'Indications statistiques, pas un conseil en investissement.</div>';
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('#view-matieres-premieres [data-mp],#view-matieres-premieres [data-mp-ouvrir]') : null;
    if (!t) return;
    var o = t.getAttribute('data-mp-ouvrir');
    if (o) { if (typeof window.afOuvrir === 'function') window.afOuvrir(o, 'matieres'); return; }
    SEL = t.getAttribute('data-mp');
    render();
  });
  /* Les états financiers arrivent après les données critiques : le tableau d'impact se recalcule alors. */
  window.addEventListener('tc:dataready', function () { if (document.querySelector('#view-matieres-premieres.active')) render(); });

  window.renderMatieresPremieres = render;
})();
