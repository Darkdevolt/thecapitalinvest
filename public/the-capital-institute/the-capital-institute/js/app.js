/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL INSTITUTE
   app.js : navigation, progression, rendu.

   Application autonome : aucun serveur, aucune API, aucun compte.
   La progression est conservée dans le navigateur de l'utilisateur et
   n'est transmise nulle part. On peut l'exporter et la réimporter pour
   changer d'appareil.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CUR = global.TCI_CURRICULUM || [];
  var GLO = global.TCI_GLOSSAIRE || [];
  var QST = global.TCI_QUESTIONS || {};
  var OUT = global.TCI_OUTILS || [];

  var LS = 'tci-progression-v1';

  var P = { lecons: {}, quiz: {}, notes: {}, debut: null };
  var vue = { nom: 'accueil', parcours: null, lecon: null, outil: null };

  /* ── Utilitaires ──────────────────────────────────────────────── */

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function charger() {
    try {
      var v = localStorage.getItem(LS);
      if (v) P = Object.assign(P, JSON.parse(v));
    } catch (e) { }
    if (!P.debut) { P.debut = new Date().toISOString(); sauver(); }
  }
  function sauver() { try { localStorage.setItem(LS, JSON.stringify(P)); } catch (e) { } }

  function parcours(id) { for (var i = 0; i < CUR.length; i++) if (CUR[i].id === id) return CUR[i]; return null; }
  function lecon(pid, lid) {
    var p = parcours(pid);
    if (!p) return null;
    for (var i = 0; i < p.lecons.length; i++) if (p.lecons[i].id === lid) return p.lecons[i];
    return null;
  }
  function toutesLecons() {
    var out = [];
    CUR.forEach(function (p) { p.lecons.forEach(function (l) { out.push({ p: p, l: l }); }); });
    return out;
  }

  /* ── Progression ──────────────────────────────────────────────── */

  function avancement(p) {
    var faites = p.lecons.filter(function (l) { return P.lecons[l.id]; }).length;
    return { faites: faites, total: p.lecons.length, pct: p.lecons.length ? faites / p.lecons.length : 0 };
  }
  function avancementGlobal() {
    var t = toutesLecons();
    var faites = t.filter(function (x) { return P.lecons[x.l.id]; }).length;
    var qs = Object.keys(P.quiz).map(function (k) { return P.quiz[k]; });
    var justes = qs.reduce(function (s, q) { return s + (q.justes || 0); }, 0);
    var poses = qs.reduce(function (s, q) { return s + (q.total || 0); }, 0);
    return {
      faites: faites, total: t.length, pct: t.length ? faites / t.length : 0,
      justes: justes, poses: poses,
      score: poses ? justes / poses : NaN,
      certifie: faites === t.length && poses > 0 && justes / poses >= 0.7
    };
  }
  function suivante(pid, lid) {
    var t = toutesLecons();
    for (var i = 0; i < t.length; i++) {
      if (t[i].p.id === pid && t[i].l.id === lid) return t[i + 1] || null;
    }
    return null;
  }

  /* ── Rendu : ossature ─────────────────────────────────────────── */

  function rendre() {
    var g = avancementGlobal();
    var barre = $('#tciProgres');
    if (barre) {
      barre.style.width = (g.pct * 100).toFixed(1) + '%';
      var t = $('#tciProgresTexte');
      if (t) t.textContent = g.faites + ' / ' + g.total + ' leçons';
    }
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-nav') === vue.nom);
    });
    var h = $('#tciVue');
    if (!h) return;
    var fn = { accueil: vueAccueil, parcours: vueParcours, lecon: vueLecon, glossaire: vueGlossaire, outils: vueOutils, progression: vueProgression }[vue.nom] || vueAccueil;
    h.innerHTML = fn();
    h.scrollTop = 0;
    if (global.scrollTo) global.scrollTo(0, 0);
    if (vue.nom === 'outils') rendreOutil();
  }

  function aller(nom, a, b) {
    vue = { nom: nom, parcours: a || null, lecon: b || null, outil: vue.outil };
    var hash = nom === 'lecon' ? '#/lecon/' + a + '/' + b : nom === 'parcours' ? '#/parcours/' + a : '#/' + nom;
    if (location.hash !== hash) history.pushState(null, '', hash);
    rendre();
  }

  function lireHash() {
    var h = (location.hash || '').replace(/^#\//, '').split('/');
    if (h[0] === 'lecon' && h[1] && h[2]) vue = { nom: 'lecon', parcours: h[1], lecon: h[2] };
    else if (h[0] === 'parcours' && h[1]) vue = { nom: 'parcours', parcours: h[1] };
    else if (['glossaire', 'outils', 'progression'].indexOf(h[0]) >= 0) vue = { nom: h[0] };
    else vue = { nom: 'accueil' };
  }

  /* ── Vue : accueil ────────────────────────────────────────────── */

  function vueAccueil() {
    var g = avancementGlobal();
    var reprise = null;
    var t = toutesLecons();
    for (var i = 0; i < t.length; i++) if (!P.lecons[t[i].l.id]) { reprise = t[i]; break; }

    var html = '<section class="tci-hero">' +
      '<div class="tci-kicker">The Capital Institute</div>' +
      '<h1>Apprendre la bourse, à partir de la BRVM</h1>' +
      '<p class="tci-hero-p">Six parcours, trente-quatre leçons, quatre-vingt-huit questions et sept calculateurs. ' +
      'Aucun raccourci, aucune promesse de rendement : la matière telle qu\'elle est, expliquée pour être comprise ' +
      'plutôt que pour impressionner.</p>';
    if (reprise) {
      html += '<button class="tci-btn tci-btn-p" data-go="lecon:' + reprise.p.id + ':' + reprise.l.id + '">' +
        (g.faites ? 'Reprendre : ' : 'Commencer : ') + esc(reprise.l.titre) + '</button>';
    } else {
      html += '<div class="tci-fini">Vous avez parcouru l\'ensemble du programme.</div>';
    }
    html += '</section>';

    if (g.faites) {
      html += '<div class="tci-stats">' +
        stat('Leçons terminées', g.faites + ' / ' + g.total) +
        stat('Progression', Math.round(g.pct * 100) + ' %') +
        stat('Questions justes', g.poses ? g.justes + ' / ' + g.poses : '—') +
        stat('Taux de réussite', isFinite(g.score) ? Math.round(g.score * 100) + ' %' : '—') +
        '</div>';
    }

    html += '<h2 class="tci-h2">Les parcours</h2><div class="tci-grid">';
    CUR.forEach(function (p, i) {
      var a = avancement(p);
      html += '<article class="tci-card" data-go="parcours:' + p.id + '">' +
        '<div class="tci-card-num">' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div class="tci-card-niv">' + esc(p.niveau) + ' · ' + esc(p.duree) + '</div>' +
        '<h3>' + esc(p.titre) + '</h3>' +
        '<p class="tci-card-st">' + esc(p.sous_titre) + '</p>' +
        '<p class="tci-card-r">' + esc(p.resume) + '</p>' +
        '<div class="tci-card-bas">' +
        '<div class="tci-bar"><div style="width:' + (a.pct * 100) + '%"></div></div>' +
        '<span>' + a.faites + ' / ' + a.total + '</span></div>' +
        '</article>';
    });
    html += '</div>';

    html += '<div class="tci-avert"><strong>Ce que cette académie n\'est pas.</strong> ' +
      'Elle ne donne aucun conseil d\'investissement, ne recommande aucun titre et ne promet aucun rendement. ' +
      'Elle explique des outils et des raisonnements. Les décisions et leurs conséquences vous appartiennent entièrement.</div>';
    return html;
  }

  function stat(l, v) {
    return '<div class="tci-stat"><span>' + esc(l) + '</span><strong>' + esc(v) + '</strong></div>';
  }

  /* ── Vue : parcours ───────────────────────────────────────────── */

  function vueParcours() {
    var p = parcours(vue.parcours);
    if (!p) return '<p class="tci-vide">Parcours introuvable.</p>';
    var a = avancement(p);

    var html = '<button class="tci-retour" data-go="accueil">← Tous les parcours</button>' +
      '<div class="tci-kicker">' + esc(p.niveau) + ' · ' + esc(p.duree) + '</div>' +
      '<h1>' + esc(p.titre) + '</h1>' +
      '<p class="tci-st">' + esc(p.sous_titre) + '</p>' +
      '<p class="tci-resume">' + esc(p.resume) + '</p>' +
      '<div class="tci-bar tci-bar-l"><div style="width:' + (a.pct * 100) + '%"></div></div>' +
      '<div class="tci-bar-t">' + a.faites + ' leçon' + (a.faites > 1 ? 's' : '') + ' sur ' + a.total + '</div>';

    html += '<div class="tci-lecons">';
    p.lecons.forEach(function (l, i) {
      var fait = !!P.lecons[l.id];
      var q = P.quiz[l.id];
      html += '<button class="tci-lecon' + (fait ? ' fait' : '') + '" data-go="lecon:' + p.id + ':' + l.id + '">' +
        '<span class="tci-lecon-n">' + (fait ? '✓' : i + 1) + '</span>' +
        '<span class="tci-lecon-c"><strong>' + esc(l.titre) + '</strong>' +
        '<small>' + l.objectifs.length + ' objectifs · ' + l.sections.length + ' sections' +
        (q ? ' · quiz ' + q.justes + '/' + q.total : '') + '</small></span>' +
        '<span class="tci-lecon-f">→</span></button>';
    });
    html += '</div>';
    return html;
  }

  /* ── Vue : leçon ──────────────────────────────────────────────── */

  function vueLecon() {
    var p = parcours(vue.parcours), l = lecon(vue.parcours, vue.lecon);
    if (!p || !l) return '<p class="tci-vide">Leçon introuvable.</p>';
    var idx = p.lecons.indexOf(l);

    var html = '<button class="tci-retour" data-go="parcours:' + p.id + '">← ' + esc(p.titre) + '</button>' +
      '<div class="tci-kicker">Leçon ' + (idx + 1) + ' sur ' + p.lecons.length + '</div>' +
      '<h1>' + esc(l.titre) + '</h1>';

    html += '<div class="tci-obj"><div class="tci-obj-t">À la fin de cette leçon, vous saurez</div><ul>' +
      l.objectifs.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul></div>';

    l.sections.forEach(function (s) {
      html += '<section class="tci-sec"><h2>' + esc(s.t) + '</h2>' +
        s.p.map(function (x) { return '<p>' + lier(x) + '</p>'; }).join('') + '</section>';
    });

    if (l.attention) {
      html += '<div class="tci-attention"><div class="tci-att-t">Point de vigilance</div><p>' + esc(l.attention) + '</p></div>';
    }

    html += '<div class="tci-retenir"><div class="tci-ret-t">À retenir</div><ul>' +
      l.retenir.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';

    var qs = QST[l.id];
    if (qs && qs.length) {
      html += '<div class="tci-quiz" id="tciQuiz" data-lecon="' + l.id + '">' +
        '<div class="tci-quiz-t">Vérifier ma compréhension</div>' +
        '<p class="tci-quiz-i">' + qs.length + ' question' + (qs.length > 1 ? 's' : '') +
        '. Une mauvaise réponse n\'est pas une sanction : c\'est le moment où l\'on apprend le plus, à condition de savoir pourquoi.</p>' +
        qs.map(function (q, i) {
          return '<div class="tci-q" data-q="' + i + '">' +
            '<div class="tci-q-t"><span>' + (i + 1) + '</span>' + esc(q.q) + '</div>' +
            '<div class="tci-q-r">' + q.r.map(function (r, j) {
              return '<button class="tci-r" data-rep="' + i + ':' + j + '">' + esc(r) + '</button>';
            }).join('') + '</div>' +
            '<div class="tci-q-e" hidden></div></div>';
        }).join('') +
        '<div class="tci-quiz-score" id="tciScore" hidden></div>' +
        '</div>';
    }

    var suiv = suivante(p.id, l.id);
    html += '<div class="tci-nav-bas">' +
      '<button class="tci-btn ' + (P.lecons[l.id] ? '' : 'tci-btn-p') + '" data-fini="' + l.id + '">' +
      (P.lecons[l.id] ? '✓ Leçon terminée' : 'Marquer comme terminée') + '</button>' +
      (suiv ? '<button class="tci-btn" data-go="lecon:' + suiv.p.id + ':' + suiv.l.id + '">Leçon suivante →</button>' : '') +
      '</div>';
    return html;
  }

  /* Les termes du glossaire présents dans le texte deviennent cliquables,
     mais une seule fois par paragraphe : souligner chaque occurrence
     rendrait la lecture impossible. */
  var TERMES = null;
  function lier(txt) {
    if (!TERMES) {
      TERMES = GLO.map(function (g) { return g.t; })
        .filter(function (t) { return t.length > 3 && t.indexOf('(') < 0; })
        .sort(function (a, b) { return b.length - a.length; });
    }
    var out = esc(txt), pris = {};
    TERMES.forEach(function (t) {
      if (pris[t.toLowerCase()]) return;
      var re = new RegExp('(^|[\\s\\u2019\'(,])(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[\\s.,;:!?)\\u2019\']|$)', 'i');
      if (re.test(out)) {
        out = out.replace(re, function (m, av, mot) {
          return av + '<button class="tci-terme" data-terme="' + esc(t) + '">' + mot + '</button>';
        });
        pris[t.toLowerCase()] = 1;
      }
    });
    return out;
  }

  /* ── Vue : glossaire ──────────────────────────────────────────── */

  var gloFiltre = '', gloCat = '';

  function vueGlossaire() {
    var cats = [];
    GLO.forEach(function (g) { if (cats.indexOf(g.c) < 0) cats.push(g.c); });
    cats.sort();

    var liste = GLO.filter(function (g) {
      if (gloCat && g.c !== gloCat) return false;
      if (!gloFiltre) return true;
      var q = gloFiltre.toLowerCase();
      return g.t.toLowerCase().indexOf(q) >= 0 || g.d.toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.t.localeCompare(b.t, 'fr'); });

    var html = '<h1>Glossaire</h1>' +
      '<p class="tci-st">' + GLO.length + ' notions définies pour l\'usage : ce que le mot change à votre décision.</p>' +
      '<input type="search" class="tci-search" id="tciGloS" placeholder="Rechercher une notion…" value="' + esc(gloFiltre) + '" autocomplete="off">' +
      '<div class="tci-chips"><button class="tci-chip' + (gloCat ? '' : ' on') + '" data-cat="">Toutes</button>' +
      cats.map(function (c) {
        return '<button class="tci-chip' + (gloCat === c ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div>';

    html += liste.length
      ? '<div class="tci-glo">' + liste.map(function (g) {
        return '<div class="tci-gl" id="glo-' + esc(g.t.replace(/[^a-zA-Z]/g, '')) + '">' +
          '<div class="tci-gl-h"><strong>' + esc(g.t) + '</strong><span>' + esc(g.c) + '</span></div>' +
          '<p>' + esc(g.d) + '</p></div>';
      }).join('') + '</div>'
      : '<p class="tci-vide">Aucune notion ne correspond à cette recherche.</p>';
    return html;
  }

  /* ── Vue : outils ─────────────────────────────────────────────── */

  var outilValeurs = {};

  function vueOutils() {
    if (!vue.outil) vue.outil = OUT[0] && OUT[0].id;
    var html = '<h1>Calculateurs</h1>' +
      '<p class="tci-st">Sept outils. Chaque résultat s\'accompagne de sa lecture et de ce que le calcul ne prend pas en compte.</p>' +
      '<div class="tci-chips">' + OUT.map(function (o) {
        return '<button class="tci-chip' + (vue.outil === o.id ? ' on' : '') + '" data-outil="' + o.id + '">' + esc(o.titre) + '</button>';
      }).join('') + '</div><div id="tciOutil"></div>';
    return html;
  }

  function rendreOutil() {
    var host = $('#tciOutil');
    if (!host) return;
    var o = null;
    OUT.forEach(function (x) { if (x.id === vue.outil) o = x; });
    if (!o) { host.innerHTML = ''; return; }

    if (!outilValeurs[o.id]) {
      outilValeurs[o.id] = {};
      o.champs.forEach(function (c) { outilValeurs[o.id][c.k] = c.def; });
    }
    var v = outilValeurs[o.id];

    var html = '<div class="tci-outil">' +
      '<h2>' + esc(o.titre) + '</h2>' +
      '<p class="tci-outil-r">' + esc(o.resume) + '</p>' +
      '<div class="tci-outil-memo">' + esc(o.memo) + '</div>' +
      '<div class="tci-form">' + o.champs.map(function (c) {
        return '<label class="tci-champ"><span>' + esc(c.l) + '</span>' +
          '<span class="tci-inp"><input type="number" step="' + (c.pas || 1) + '" data-oc="' + c.k + '" value="' + esc(v[c.k]) + '">' +
          '<em>' + esc(c.unite) + '</em></span></label>';
      }).join('') + '</div>';

    var r;
    try { r = o.calcule(v); } catch (e) { r = { erreur: 'Le calcul a échoué : ' + e.message }; }

    if (r.erreur) {
      html += '<div class="tci-erreur">' + esc(r.erreur) + '</div>';
    } else {
      html += '<div class="tci-res">' + r.lignes.map(function (l) {
        return '<div class="tci-res-l' + (l.fort ? ' fort' : '') + '">' +
          '<span class="tci-res-t">' + esc(l.l) + '</span>' +
          '<span class="tci-res-v ' + (l.ton === 'bon' ? 'bon' : l.ton === 'mauvais' ? 'mauvais' : '') + '">' + esc(l.v) + '</span>' +
          (l.s ? '<span class="tci-res-s">' + esc(l.s) + '</span>' : '') + '</div>';
      }).join('') + '</div>';

      if (r.table) {
        html += '<div class="tci-tab-w"><table class="tci-tab"><thead><tr>' +
          r.table.entetes.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + r.table.lignes.map(function (l) {
            return '<tr>' + l.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>';
      }
      if (r.lecture && r.lecture.length) {
        html += r.lecture.map(function (x) { return '<div class="tci-lecture">' + esc(x) + '</div>'; }).join('');
      }
      if (r.reserve) html += '<div class="tci-reserve"><strong>Ce que le calcul ne prend pas en compte.</strong> ' + esc(r.reserve) + '</div>';
    }
    html += '</div>';
    host.innerHTML = html;
  }

  /* ── Vue : progression ────────────────────────────────────────── */

  function vueProgression() {
    var g = avancementGlobal();
    var html = '<h1>Ma progression</h1>' +
      '<div class="tci-stats">' +
      stat('Leçons terminées', g.faites + ' / ' + g.total) +
      stat('Progression', Math.round(g.pct * 100) + ' %') +
      stat('Questions posées', String(g.poses)) +
      stat('Taux de réussite', isFinite(g.score) ? Math.round(g.score * 100) + ' %' : '—') +
      '</div>';

    if (g.certifie) {
      html += '<div class="tci-certif">' +
        '<div class="tci-certif-k">Parcours achevé</div>' +
        '<h2>Programme complet</h2>' +
        '<p>Vous avez terminé les ' + g.total + ' leçons avec un taux de réussite de ' + Math.round(g.score * 100) + ' % ' +
        'sur ' + g.poses + ' questions. Commencé le ' + new Date(P.debut).toLocaleDateString('fr-FR') + '.</p>' +
        '<p class="tci-certif-n">Cette mention atteste d\'un parcours de formation. Elle ne constitue ni un diplôme, ' +
        'ni une habilitation, ni une garantie de résultat sur les marchés.</p>' +
        '<button class="tci-btn" id="tciImprimer">Imprimer</button></div>';
    } else if (g.faites) {
      var reste = g.total - g.faites;
      html += '<p class="tci-resume">Il reste ' + reste + ' leçon' + (reste > 1 ? 's' : '') + ' à parcourir' +
        (g.poses && g.score < 0.7 ? ', et le taux de réussite aux questions doit atteindre 70 % pour valider le programme (actuellement ' + Math.round(g.score * 100) + ' %).' : '.') + '</p>';
    }

    html += '<h2 class="tci-h2">Détail par parcours</h2>';
    CUR.forEach(function (p) {
      var a = avancement(p);
      html += '<div class="tci-prog-p"><div class="tci-prog-h">' +
        '<button class="tci-lien" data-go="parcours:' + p.id + '">' + esc(p.titre) + '</button>' +
        '<span>' + a.faites + ' / ' + a.total + '</span></div>' +
        '<div class="tci-bar"><div style="width:' + (a.pct * 100) + '%"></div></div>' +
        '<div class="tci-prog-l">' + p.lecons.map(function (l) {
          var q = P.quiz[l.id];
          return '<button class="tci-prog-i' + (P.lecons[l.id] ? ' fait' : '') + '" data-go="lecon:' + p.id + ':' + l.id + '">' +
            esc(l.titre) + (q ? ' <em>' + q.justes + '/' + q.total + '</em>' : '') + '</button>';
        }).join('') + '</div></div>';
    });

    html += '<h2 class="tci-h2">Mes données</h2>' +
      '<p class="tci-resume">Votre progression est conservée dans ce navigateur uniquement. Elle n\'est transmise ' +
      'nulle part et disparaîtra si vous effacez les données du site. Exportez-la pour la conserver ou changer d\'appareil.</p>' +
      '<div class="tci-actions">' +
      '<button class="tci-btn" id="tciExport">Exporter ma progression</button>' +
      '<button class="tci-btn" id="tciImport">Importer</button>' +
      '<button class="tci-btn tci-btn-d" id="tciReset">Tout effacer</button>' +
      '<input type="file" id="tciFichier" accept="application/json" hidden></div>';
    return html;
  }

  /* ── Quiz ─────────────────────────────────────────────────────── */

  function repondre(lid, qi, ri) {
    var qs = QST[lid];
    if (!qs || !qs[qi]) return;
    var bloc = document.querySelector('.tci-q[data-q="' + qi + '"]');
    if (!bloc || bloc.classList.contains('repondu')) return;
    bloc.classList.add('repondu');

    var q = qs[qi];
    var juste = ri === q.b;
    bloc.querySelectorAll('.tci-r').forEach(function (b, j) {
      b.disabled = true;
      if (j === q.b) b.classList.add('juste');
      else if (j === ri) b.classList.add('faux');
    });
    var e = bloc.querySelector('.tci-q-e');
    e.hidden = false;
    e.className = 'tci-q-e ' + (juste ? 'ok' : 'ko');
    e.innerHTML = '<strong>' + (juste ? 'Exact.' : 'Pas tout à fait.') + '</strong> ' + esc(q.e);

    P.quiz[lid] = P.quiz[lid] || { justes: 0, total: 0 };
    P.quiz[lid].justes += juste ? 1 : 0;
    P.quiz[lid].total += 1;
    sauver();

    var repondus = document.querySelectorAll('.tci-q.repondu').length;
    if (repondus === qs.length) {
      var s = $('#tciScore');
      if (s) {
        var justes = document.querySelectorAll('.tci-r.juste:disabled').length;
        var bons = 0;
        document.querySelectorAll('.tci-q').forEach(function (b) {
          if (b.querySelector('.tci-q-e.ok')) bons++;
        });
        s.hidden = false;
        s.innerHTML = '<strong>' + bons + ' / ' + qs.length + '</strong> — ' +
          (bons === qs.length ? 'toutes les questions sont justes.'
            : bons >= qs.length * 0.6 ? 'l\'essentiel est acquis ; relisez les explications des questions manquées.'
              : 'reprenez la leçon avant de passer à la suivante, les explications ci-dessus indiquent où.');
      }
    }
    var barre = $('#tciProgres');
    if (barre) { var gg = avancementGlobal(); barre.style.width = (gg.pct * 100).toFixed(1) + '%'; }
  }

  /* ── Import / export ──────────────────────────────────────────── */

  function exporter() {
    var U = global.URL || (typeof URL !== 'undefined' ? URL : null);
    if (!U || !U.createObjectURL) { alert('Ce navigateur ne permet pas le téléchargement du fichier.'); return; }
    var b = new Blob([JSON.stringify(P, null, 2)], { type: 'application/json' });
    var u = U.createObjectURL(b);
    var a = document.createElement('a');
    a.href = u;
    a.download = 'progression-the-capital-institute.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { U.revokeObjectURL(u); }, 1000);
  }

  function importer(fichier) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || typeof d !== 'object' || !d.lecons) throw new Error('format');
        P = Object.assign({ lecons: {}, quiz: {}, notes: {}, debut: null }, d);
        if (!P.debut) P.debut = new Date().toISOString();
        sauver();
        rendre();
      } catch (e) {
        alert('Ce fichier ne contient pas une progression exploitable.');
      }
    };
    r.readAsText(fichier);
  }

  /* ── Événements ───────────────────────────────────────────────── */

  function brancher() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-go],[data-fini],[data-rep],[data-cat],[data-outil],[data-terme],[data-nav],button') : null;
      if (!t) return;
      var v;

      if ((v = t.getAttribute('data-terme'))) {
        aller('glossaire');
        gloFiltre = v; gloCat = '';
        rendre();
        var el = document.getElementById('glo-' + v.replace(/[^a-zA-Z]/g, ''));
        if (el) { el.classList.add('vise'); if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }
        return;
      }
      if ((v = t.getAttribute('data-nav'))) { gloFiltre = ''; gloCat = ''; aller(v); return; }
      if ((v = t.getAttribute('data-go'))) {
        var p = v.split(':');
        aller(p[0], p[1], p[2]);
        return;
      }
      if ((v = t.getAttribute('data-fini'))) {
        if (P.lecons[v]) delete P.lecons[v];
        else P.lecons[v] = new Date().toISOString();
        sauver();
        rendre();
        return;
      }
      if ((v = t.getAttribute('data-rep'))) {
        var q = $('#tciQuiz');
        if (!q) return;
        var pr = v.split(':');
        repondre(q.getAttribute('data-lecon'), +pr[0], +pr[1]);
        return;
      }
      if ((v = t.getAttribute('data-cat')) !== null && t.hasAttribute('data-cat')) {
        gloCat = v; rendre(); return;
      }
      if ((v = t.getAttribute('data-outil'))) { vue.outil = v; rendre(); return; }

      switch (t.id) {
        case 'tciExport': exporter(); break;
        case 'tciImport': $('#tciFichier').click(); break;
        case 'tciReset':
          if (confirm('Effacer toute votre progression ? Cette action est définitive.')) {
            P = { lecons: {}, quiz: {}, notes: {}, debut: new Date().toISOString() };
            sauver(); rendre();
          }
          break;
        case 'tciImprimer': global.print(); break;
      }
    });

    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'tciGloS') {
        gloFiltre = t.value;
        var pos = t.selectionStart;
        rendre();
        var n = $('#tciGloS');
        if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { } }
        return;
      }
      var oc = t.getAttribute && t.getAttribute('data-oc');
      if (oc && vue.outil) {
        outilValeurs[vue.outil][oc] = t.value;
        var actif = document.activeElement;
        var cle = actif && actif.getAttribute ? actif.getAttribute('data-oc') : null;
        var sel = actif ? actif.selectionStart : null;
        rendreOutil();
        if (cle) {
          var el = document.querySelector('[data-oc="' + cle + '"]');
          if (el) { el.focus(); try { el.setSelectionRange(sel, sel); } catch (err) { } }
        }
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target.id === 'tciFichier' && e.target.files && e.target.files[0]) {
        importer(e.target.files[0]);
        e.target.value = '';
      }
    });

    global.addEventListener('popstate', function () { lireHash(); rendre(); });
  }

  /* ── Démarrage ────────────────────────────────────────────────── */

  function demarrer() {
    charger();
    lireHash();
    brancher();
    rendre();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();

  global.TCI = { P: P, CUR: CUR, aller: aller, avancement: avancementGlobal };
})(typeof window !== 'undefined' ? window : globalThis);
