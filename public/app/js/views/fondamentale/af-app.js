/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE FONDAMENTALE PRO
   af-app.js : interface.

   Aucun endpoint n'est créé. Le module lit window.allFinancials,
   window.allCours et window.allEntreprises, déjà chargés par
   l'application, exactement comme le faisait l'ancienne vue.

   Toutes les hypothèses de valorisation sont modifiables et
   mémorisées par titre. Les données absentes des états publiés
   peuvent être saisies : elles débloquent alors les ratios qui en
   dépendent, et restent visuellement distinguées des données source.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.__AFP_APP__) return;
  global.__AFP_APP__ = true;

  var C = global.AFCore;
  var V = global.AFValuation;
  var fin = C.fin, pos = C.pos;

  var LS = {
    hyp: 'tc-af-hyp:', ov: 'tc-af-data:', tab: 'tc-af-tab', poids: 'tc-af-poids', portee: 'tc-af-portee',
    stat: 'tc-af-stat', exclus: 'tc-af-exclus'
  };

  var PORTEES = [
    { id: 'sousSecteur', l: 'Sous-secteur' },
    { id: 'secteur', l: 'Secteur' },
    { id: 'marche', l: 'Marché entier' }
  ];

  /* Une entrée par méthode de valorisation individuelle, y compris
     chaque multiple pris séparément (PER, PBR, PSR, VE/EBE, cours sur
     flux libre) : source unique du libellé, utilisée par la pondération,
     le tableau de synthèse et le rapport exporté, pour ne jamais avoir
     trois noms différents pour la même méthode. */
  var METHODE_LABELS = {
    dcf: 'Flux actualisés (DCF)',
    ddm: 'Dividendes (Gordon-Shapiro)',
    dyMarche: 'Dividende / rendement de marché',
    per: 'Cours / Bénéfice (PER)',
    pbr: 'Cours / Actif net (PBR)',
    psr: 'Cours / Chiffre d\'affaires (PSR)',
    evEbitda: 'VE / Excédent brut',
    pfcf: 'Cours / Flux libre',
    vcpa: 'Actif net par action (VCPA)',
    residuel: 'Revenu résiduel',
    graham: 'Graham'
  };
  var METHODE_GROUPES = [
    { titre: 'Flux et dividendes', cles: ['dcf', 'ddm', 'dyMarche'] },
    { titre: 'Multiples de comparables', cles: ['per', 'pbr', 'psr', 'evEbitda', 'pfcf'] },
    { titre: 'Valeur comptable et autres', cles: ['vcpa', 'residuel', 'graham'] }
  ];
  var METHODE_COULEURS = ['#c8a24e', '#3fc98a', '#60a5fa', '#f0a72a', '#a78bfa', '#f0645e', '#4ade80', '#e879f9', '#38bdf8'];

  var S = {
    ticker: '', analyse: null, inter: null, hypotheses: null, wacc: null,
    tab: 'synthese', overrides: {}, poids: null,
    /* Mémorise, en session seulement (pas persisté), le dernier poids
       actif de chaque méthode désactivée par l'interrupteur on/off, pour
       le restaurer tel quel à la réactivation plutôt que de retomber
       sur le poids par défaut du secteur. */
    poidsMemoire: {},
    resultats: null, comparables: null, comparablesMarche: null, unite: 'auto',
    portee: 'sousSecteur',
    /* Statistique (médiane ou moyenne) et pairs exclus du groupe de
       comparables : préférences globales de l'utilisateur, pas propres
       à un titre — exclure une société jugée non représentative (bénéfice
       proche de zéro faussant son PER, par exemple) vaut pour toutes les
       analyses où elle apparaîtrait comme pair. */
    comparablesStat: 'moyenne', comparablesExclus: []
  };
  global.AF = S;

  /* ── Utilitaires d'affichage ──────────────────────────────────── */

  function $(id) { return document.getElementById(id); }
  function root() { return $('view-analyse-fondamentale'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function notify(m, k) { if (typeof global.toast === 'function') global.toast(m, k || 'info'); }
  /* « Chiffre d'affaires », ou « Produit net bancaire » pour une banque (helper de score-maison.js). */
  function ca(forme) {
    if (typeof global.tcCaLabel === 'function') return global.tcCaLabel(S.ticker, forme);
    return forme === 'court' ? 'CA' : forme === 'min' ? 'chiffre d\'affaires' : 'Chiffre d\'affaires';
  }

  /* Le mémo n'est ajouté que si la notion existe vraiment dans la base :
     une icône qui ouvrirait un panneau vide serait pire que rien. */
  function memo(cle) {
    return global.TCMemo && global.TCMemo.has(cle) ? global.TCMemo.icon(cle) : '';
  }

  var ND = '<span class="af-nd">non calculable</span>';

  function n0(v) { return fin(v) ? Math.round(v).toLocaleString('fr-FR') : null; }
  function n2(v, d) { return fin(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }) : null; }
  function pc(v, d) { return fin(v) ? (v * 100).toFixed(d == null ? 1 : d) + ' %' : null; }
  function pcs(v, d) { return fin(v) ? (v > 0 ? '+' : '') + (v * 100).toFixed(d == null ? 1 : d) + ' %' : null; }

  /* Les montants sont énormes en francs CFA : on les ramène à l'échelle
     lisible plutôt que d'aligner douze chiffres. */
  function mont(v) {
    if (!fin(v)) return null;
    var a = Math.abs(v);
    /* Jamais de « Bn » (billion anglais, 10^12) : au-delà de 1 000 milliards on
       reste en Mrd, l'unité de tout le reste de l'application. */
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 1 : 2) + ' Mrd';
    if (a >= 1e6) return (v / 1e6).toFixed(1) + ' M';
    if (a >= 1e3) return Math.round(v).toLocaleString('fr-FR');
    return v.toFixed(0);
  }
  function or(v, fallback) { return v == null ? (fallback || ND) : v; }
  function tone(v, seuil, inverse) {
    if (!fin(v)) return '';
    var bon = inverse ? v <= seuil : v >= seuil;
    return bon ? 'af-up' : 'af-down';
  }
  /* Indicateur de hausse/baisse par rapport à l'exercice précédent, affiché
     à côté d'une valeur — indépendant de tout seuil de qualité : sert
     uniquement à répondre à « est-ce que ça monte ou ça baisse ? ». */
  function trend(vals, i, inverse) {
    if (i <= 0 || !vals) return '';
    var cur = vals[i], prev = vals[i - 1];
    if (!fin(cur) || !fin(prev)) return '';
    var delta = cur - prev;
    if (delta === 0) return '<span class="af-trend af-trend-flat" title="Stable par rapport à l\'exercice précédent">→</span>';
    var up = delta > 0;
    var cls = inverse ? (up ? 'af-trend-down' : 'af-trend-up') : (up ? 'af-trend-up' : 'af-trend-down');
    var pctTxt = prev !== 0 ? ' (' + (up ? '+' : '') + ((delta / Math.abs(prev)) * 100).toFixed(1) + ' %)' : '';
    return '<span class="af-trend ' + cls + '" title="' + (up ? 'En hausse' : 'En baisse') + esc(pctTxt) + ' par rapport à l\'exercice précédent">' +
      (up ? '▲' : '▼') + '</span>';
  }


  /* ── Visualisations financières ────────────────────────────────
     Couche purement visuelle : toutes les valeurs proviennent de S.analyse.
     Aucun calcul métier n'est modifié. */

  /* Évolution d'une série entre son premier et son dernier point connu,
     annualisée (taux de croissance annuel moyen) dès que c'est possible :
     une variation totale sur cinq ans ne répond pas à « ça progresse de
     combien par an ? ». Repli sur la variation simple si l'un des deux
     bornes n'est pas strictement positive (le TCAM n'a alors pas de sens). */
  function seriesGrowth(s) {
    var idx = [];
    s.values.forEach(function (v, i) { if (fin(v)) idx.push(i); });
    if (idx.length < 2) return null;
    var i0 = idx[0], i1 = idx[idx.length - 1];
    var first = s.values[i0], last = s.values[i1], n = i1 - i0;
    if (n < 1) return null;
    if (first > 0 && last > 0) {
      var cagr = Math.pow(last / first, 1 / n) - 1;
      return { up: cagr >= 0, txt: (cagr >= 0 ? '+' : '') + (cagr * 100).toFixed(1) + ' %/an', annuel: true };
    }
    if (first !== 0) {
      var delta = (last - first) / Math.abs(first);
      return { up: delta >= 0, txt: (delta >= 0 ? '+' : '') + (delta * 100).toFixed(1) + ' %', annuel: false };
    }
    return null;
  }

  /* Même calcul que seriesGrowth, sur un tableau de valeurs brut plutôt
     qu'un objet série de graphique — pour l'afficher à côté d'un libellé
     de ligne de tableau (états financiers), pas seulement dans une légende
     de courbe. */
  function croissanceAnnualisee(vals) { return seriesGrowth({ values: vals }); }

  /* Badge de croissance annualisée à poser à côté d'un libellé de ligne :
     répond directement à « ça progresse de combien par an, au total ? »,
     complément de la flèche `trend()` qui ne compare que les deux derniers
     exercices. */
  function tcamBadge(vals, inverse) {
    var g = croissanceAnnualisee(vals);
    if (!g) return '';
    var bon = inverse ? !g.up : g.up;
    return '<span class="af-row-tcam ' + (bon ? 'af-up' : 'af-down') + '" title="Taux de variation annualisé sur toute la période affichée">' +
      (g.up ? '▲' : '▼') + ' ' + (g.annuel ? 'TCAM ' : '') + g.txt + '</span>';
  }

  function dernierFini(vs) {
    for (var i = vs.length - 1; i >= 0; i--) { if (fin(vs[i])) return vs[i]; }
    return null;
  }

  /* ── Registre des graphiques interactifs ──────────────────────────
     Chaque graphique (ligne, barres ou projection) enregistre ici la
     position de ses points en coordonnées SVG. Le survol à la souris,
     câblé une seule fois par délégation d'évènement (voir afChartsInit),
     retrouve ainsi instantanément les valeurs sous le curseur sans avoir
     à ré-analyser le graphique. Remis à zéro à chaque rendu complet (voir
     render()) pour ne pas accumuler indéfiniment les graphiques quittés. */
  var CHART_SEQ = 0;
  var CHART_DATA = {};
  var CHART_COLORS = ['#d8b568', '#4ddb9c', '#60a5fa', '#f3b555', '#c084fc'];

  /* Un graphique sans point à tracer ne doit jamais disparaître en
     silence : la case vide qui en résultait dans une mise en page à deux
     colonnes se lisait comme une erreur d'affichage plutôt que comme
     l'absence, légitime, de cette donnée pour la société. */
  function chartVide(titre, desc, message) {
    return '<div class="af-chart af-chart-empty"><div class="af-chart-head"><div><strong>' + esc(titre) + '</strong><span>' + esc(desc || '') + '</span></div></div>' +
      '<div class="af-chart-empty-msg">' + esc(message || 'Historique insuffisant pour tracer un graphique.') + '</div></div>';
  }

  function chartSerie(titre, desc, labels, series, format) {
    var W = 760, H = 250, L = 66, R = 20, T = 20, B = 34;
    var vals = [];
    series.forEach(function(s){ s.values.forEach(function(v){ if(fin(v)) vals.push(v); }); });
    if (!vals.length) return chartVide(titre, desc);
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    var zero = min < 0 && max > 0 ? H - B - ((0-min)/(max-min))*(H-T-B) : null;
    function x(i){ return L + (labels.length <= 1 ? 0 : i*(W-L-R)/(labels.length-1)); }
    function y(v){ return H-B - ((v-min)/(max-min))*(H-T-B); }
    function path(vs){
      return vs.map(function(v,i){ return (i?'L':'M')+' '+x(i).toFixed(1)+' '+(fin(v)?y(v).toFixed(1):(H-B)); }).join(' ');
    }
    /* Trois repères chiffrés (haut / milieu / bas) : sans eux, une courbe
       qui monte ou descend ne dit rien de l'ordre de grandeur réel. */
    var grid = '', ticks = [max, min + (max - min) / 2, min];
    ticks.forEach(function (t, g) {
      var yy = T + g * (H - T - B) / 2;
      grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="af-chart-grid"/>';
      grid += '<text x="' + (L - 8) + '" y="' + (yy + 3).toFixed(1) + '" class="af-chart-ylabel" text-anchor="end">' + esc(format(t)) + '</text>';
    });
    var id = 'c' + (++CHART_SEQ);
    var points = labels.map(function (lb, i) {
      var items = [];
      series.forEach(function (s, si) {
        var v = s.values[i];
        if (fin(v)) items.push({ label: s.label, value: format(v), color: CHART_COLORS[si % 5] });
      });
      return { x: x(i), label: lb, items: items };
    });
    CHART_DATA[id] = { W: W, H: H, T: T, B: B, points: points };
    var svg='<div class="af-chart" data-chart-id="'+id+'"><div class="af-chart-head"><div><strong>'+esc(titre)+'</strong><span>'+esc(desc||'')+'</span></div></div>'+
      '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(titre)+'">'+grid;
    if(zero!==null) svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+zero.toFixed(1)+'" y2="'+zero.toFixed(1)+'" class="af-chart-zero"/>';
    series.forEach(function(s,si){
      svg+='<path d="'+path(s.values)+'" class="af-chart-line af-chart-c'+(si%5)+'"/>';
      s.values.forEach(function(v,i){ if(fin(v)) svg+='<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="3.2" class="af-chart-dot af-chart-c'+(si%5)+'"/>'; });
    });
    labels.forEach(function(lb,i){ svg+='<text x="'+x(i).toFixed(1)+'" y="'+(H-12)+'" class="af-chart-label" text-anchor="middle">'+esc(lb)+'</text>'; });
    svg+='</svg>';
    /* La légende, pas le graphique, porte les chiffres : un nom de série,
       sa dernière valeur, et son taux de croissance annualisé, chacun sur
       sa propre ligne — jamais un texte posé sur la courbe, qui se
       chevauche dès que deux lignes se rapprochent. */
    svg += '<div class="af-chart-legend">' + series.map(function (s, si) {
      var last = dernierFini(s.values);
      var g = seriesGrowth(s);
      return '<span class="af-chart-leg-row"><i class="af-chart-key af-chart-c' + (si % 5) + '"></i>' +
        '<span class="af-chart-leg-l">' + esc(s.label) + '</span>' +
        (last != null ? '<span class="af-chart-leg-v">' + esc(format(last)) + '</span>' : '') +
        (g ? '<span class="af-chart-leg-t ' + (g.up ? 'af-up' : 'af-down') + '">' + (g.up ? '▲' : '▼') + ' ' +
          (g.annuel ? 'TCAM ' : '') + g.txt + '</span>' : '') +
        '</span>';
    }).join('') + '</div></div>';
    return svg;
  }

  /* Diagramme en bâtons : un agrégat annuel (chiffre d'affaires, résultat,
     flux) est un montant ponctuel par exercice, pas une grandeur qui
     « coule » d'une année à l'autre — une barre par exercice se lit plus
     naturellement qu'une ligne pour ce type de donnée, peu nombreuse et
     discrète. */
  function chartBarresVert(titre, desc, labels, series, format) {
    var W = 760, H = 250, L = 66, R = 20, T = 20, B = 34;
    var vals = [];
    series.forEach(function (s) { s.values.forEach(function (v) { if (fin(v)) vals.push(v); }); });
    if (!vals.length) return chartVide(titre, desc);
    var max = Math.max.apply(null, vals.concat([0])), min = Math.min.apply(null, vals.concat([0]));
    if (max === min) max += 1;
    function y(v) { return H - B - ((v - min) / (max - min)) * (H - T - B); }
    var zeroY = y(0);
    var groupW = (W - L - R) / labels.length;
    var gap = Math.max(3, groupW * 0.1);
    var barW = Math.max(2, (groupW - gap * (series.length + 1)) / series.length);
    var grid = '', ticks = [max, min + (max - min) / 2, min];
    ticks.forEach(function (t, g) {
      var yy = T + g * (H - T - B) / 2;
      grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="af-chart-grid"/>';
      grid += '<text x="' + (L - 8) + '" y="' + (yy + 3).toFixed(1) + '" class="af-chart-ylabel" text-anchor="end">' + esc(format(t)) + '</text>';
    });
    var bars = '', points = [];
    labels.forEach(function (lb, i) {
      var gx = L + i * groupW, items = [];
      series.forEach(function (s, si) {
        var v = s.values[i];
        if (!fin(v)) return;
        var bx = gx + gap + si * (barW + gap);
        var yTop = Math.min(y(v), zeroY), h = Math.max(1, Math.abs(y(v) - zeroY));
        bars += '<rect x="' + bx.toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" class="af-bar-rect af-chart-c' + (si % 5) + '"/>';
        items.push({ label: s.label, value: format(v), color: CHART_COLORS[si % 5] });
      });
      points.push({ x: gx + groupW / 2, label: lb, items: items });
    });
    var id = 'c' + (++CHART_SEQ);
    CHART_DATA[id] = { W: W, H: H, T: T, B: B, points: points };
    var svg = '<div class="af-chart" data-chart-id="' + id + '"><div class="af-chart-head"><div><strong>' + esc(titre) + '</strong><span>' + esc(desc || '') + '</span></div></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(titre) + '">' + grid +
      (min < 0 ? '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + zeroY.toFixed(1) + '" y2="' + zeroY.toFixed(1) + '" class="af-chart-zero"/>' : '') +
      bars;
    labels.forEach(function (lb, i) { svg += '<text x="' + (L + i * groupW + groupW / 2).toFixed(1) + '" y="' + (H - 12) + '" class="af-chart-label" text-anchor="middle">' + esc(lb) + '</text>'; });
    svg += '</svg>';
    svg += '<div class="af-chart-legend">' + series.map(function (s, si) {
      var last = dernierFini(s.values);
      var g = seriesGrowth(s);
      return '<span class="af-chart-leg-row"><i class="af-chart-key af-chart-c' + (si % 5) + '"></i>' +
        '<span class="af-chart-leg-l">' + esc(s.label) + '</span>' +
        (last != null ? '<span class="af-chart-leg-v">' + esc(format(last)) + '</span>' : '') +
        (g ? '<span class="af-chart-leg-t ' + (g.up ? 'af-up' : 'af-down') + '">' + (g.up ? '▲' : '▼') + ' ' +
          (g.annuel ? 'TCAM ' : '') + g.txt + '</span>' : '') +
        '</span>';
    }).join('') + '</div></div>';
    return svg;
  }

  /* Mini-graphique encadré : la couleur du tracé indique si la série est
     globalement en hausse (vert) ou en baisse (rouge) entre son premier et
     son dernier point ; `inverse` retourne cette lecture pour les grandeurs
     où une baisse est le signe positif (endettement, PER…). */
  function sparkline(values, format, inverse) {
    var vs = (values || []).map(function(v){ return fin(v) ? v : NaN; });
    var valid = vs.filter(fin);
    if (valid.length < 2) return '';
    var W = 92, H = 30, P = 3;
    var min = Math.min.apply(null, valid), max = Math.max.apply(null, valid);
    if (min === max) { min -= 1; max += 1; }
    function x(i){ return P + (vs.length <= 1 ? 0 : i * (W - P*2) / (vs.length-1)); }
    function y(v){ return H-P - ((v-min)/(max-min))*(H-P*2); }
    var path = '', last = null, firstIdx = -1, lastIdx = -1;
    vs.forEach(function(v,i){
      if (!fin(v)) { last = null; return; }
      if (firstIdx < 0) firstIdx = i;
      lastIdx = i;
      path += (last === null ? 'M' : 'L') + ' ' + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      last = v;
    });
    var dirRaw = '';
    if (firstIdx >= 0 && lastIdx > firstIdx) {
      var d = vs[lastIdx] - vs[firstIdx];
      dirRaw = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    }
    var dirColor = (dirRaw === '' || dirRaw === 'flat') ? 'flat' : (inverse ? (dirRaw === 'up' ? 'down' : 'up') : dirRaw);
    var dot = lastIdx >= 0 ? '<circle cx="'+x(lastIdx).toFixed(1)+'" cy="'+y(vs[lastIdx]).toFixed(1)+'" r="2.6" class="af-spark-dot af-spark-c-'+dirColor+'"><title>'+esc(format ? format(vs[lastIdx]) : vs[lastIdx])+'</title></circle>' : '';
    var arrow = dirRaw === 'up' ? '▲' : dirRaw === 'down' ? '▼' : '→';
    /* Le rouge et le vert seuls ne disent pas « de combien » : un chiffre
       à côté de la flèche évite de deviner l'ampleur du mouvement rien
       qu'à l'œil sur un tracé large de quelques dizaines de pixels. */
    var pctTxt = '';
    if (firstIdx >= 0 && lastIdx > firstIdx && vs[firstIdx]) {
      var deltaP = (vs[lastIdx] - vs[firstIdx]) / Math.abs(vs[firstIdx]);
      pctTxt = (deltaP >= 0 ? '+' : '') + (deltaP * 100).toFixed(0) + ' %';
    }
    /* Ligne seule, sans aire remplie sous la courbe : demandé explicitement
       pour rester net — la couleur du trait et le texte suffisent à porter
       la tendance. */
    return '<span class="af-spark-wrap af-spark-w-' + dirColor + '">' +
      '<span class="af-spark" aria-hidden="true"><svg viewBox="0 0 '+W+' '+H+'">' +
      '<path d="'+path+'" class="af-spark-line af-spark-c-'+dirColor+'"/>'+dot+'</svg></span>' +
      '<span class="af-spark-txt af-spark-c-' + dirColor + '">' + arrow + (pctTxt ? ' ' + pctTxt : '') + '</span>' +
      '</span>';
  }

  /* Historique en trait plein, projection en pointillé, séparés par un
     repère vertical : un tableau de chiffres projetés ne permet pas de
     voir d'un coup d'œil si la projection prolonge sagement la tendance
     ou part dans une direction que l'historique ne suggérait pas. */
  function chartProjection(titre, anneesHist, valsHist, anneesProj, valsProj, format) {
    var labels = anneesHist.concat(anneesProj);
    var allVals = valsHist.concat(valsProj).filter(fin);
    if (allVals.length < 2) return chartVide(titre, 'Historique publié et projection', 'Historique insuffisant pour projeter une courbe.');
    var W = 760, H = 210, L = 66, R = 20, T = 18, B = 32;
    var min = Math.min.apply(null, allVals), max = Math.max.apply(null, allVals);
    if (min === max) { min -= 1; max += 1; }
    function x(i) { return L + (labels.length <= 1 ? 0 : i * (W - L - R) / (labels.length - 1)); }
    function y(v) { return H - B - ((v - min) / (max - min)) * (H - T - B); }
    var grid = '', ticks = [max, min + (max - min) / 2, min];
    ticks.forEach(function (t, g) {
      var yy = T + g * (H - T - B) / 2;
      grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" class="af-chart-grid"/>';
      grid += '<text x="' + (L - 8) + '" y="' + (yy + 3).toFixed(1) + '" class="af-chart-ylabel" text-anchor="end">' + esc(format(t)) + '</text>';
    });
    var histPts = [];
    valsHist.forEach(function (v, i) { if (fin(v)) histPts.push([x(i), y(v), i]); });
    var pathHist = histPts.map(function (p, i) { return (i ? 'L' : 'M') + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var projPts = histPts.length ? [histPts[histPts.length - 1]] : [];
    valsProj.forEach(function (v, i) { if (fin(v)) projPts.push([x(valsHist.length + i), y(v)]); });
    var pathProj = projPts.length > 1 ? projPts.map(function (p, i) { return (i ? 'L' : 'M') + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') : '';
    var sepX = x(valsHist.length - 0.5);
    var id = 'c' + (++CHART_SEQ);
    var points = labels.map(function (lb, i) {
      var v = i < valsHist.length ? valsHist[i] : valsProj[i - valsHist.length];
      var items = fin(v) ? [{ label: i < valsHist.length ? 'Historique' : 'Projection', value: format(v), color: CHART_COLORS[0] }] : [];
      return { x: x(i), label: lb, items: items };
    });
    CHART_DATA[id] = { W: W, H: H, T: T, B: B, points: points };
    var svg = '<div class="af-chart" data-chart-id="' + id + '"><div class="af-chart-head"><div><strong>' + esc(titre) + '</strong>' +
      '<span>Trait plein : historique publié · pointillé : projection</span></div></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(titre) + '">' + grid +
      '<line x1="' + sepX.toFixed(1) + '" x2="' + sepX.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" class="af-chart-zero"/>' +
      (pathHist ? '<path d="' + pathHist + '" class="af-chart-line af-chart-c0"/>' : '') +
      (pathProj ? '<path d="' + pathProj + '" class="af-chart-line af-chart-c0 af-chart-line-proj"/>' : '');
    histPts.forEach(function (p) { svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" class="af-chart-dot af-chart-c0"/>'; });
    projPts.slice(1).forEach(function (p) { svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" class="af-chart-dot af-chart-c0 af-chart-dot-proj"/>'; });
    labels.forEach(function (lb, i) { svg += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 10) + '" class="af-chart-label" text-anchor="middle">' + esc(String(lb)) + '</text>'; });
    svg += '</svg></div>';
    return svg;
  }

  function financialCharts(a){
    var labels=a.years.map(String);
    return '<div class="af-chart-grid">'+
      chartBarresVert('Performance financière','Évolution des principaux agrégats publiés',labels,[
        {label:ca(),values:a.rows.map(function(r){return r.ca;})},
        {label:'Résultat brut',values:a.rows.map(function(r){return r.rbe;})},
        {label:'Résultat net',values:a.rows.map(function(r){return r.rn;})}
      ],function(v){return mont(v);})+
      chartBarresVert('Cash flow','Flux opérationnel, investissements et flux libre',labels,[
        {label:'Flux opérationnel',values:a.rows.map(function(r){return r.cfo;})},
        {label:'Investissements',values:a.rows.map(function(r){return r.capex;})},
        {label:'Flux libre',values:a.rows.map(function(r){return r.fcf;})}
      ],function(v){return mont(v);})+
      '</div>';
  }

  function ratioCharts(a){
    var labels=a.years.map(String);
    return '<div class="af-chart-grid">'+
      chartSerie('Rentabilité','Évolution des rendements',labels,[
        {label:'ROE',values:a.ratios.map(function(r){return fin(r.roe)?r.roe*100:NaN;})},
        {label:'ROA',values:a.ratios.map(function(r){return fin(r.roa)?r.roa*100:NaN;})},
        {label:'ROCE',values:a.ratios.map(function(r){return fin(r.roce)?r.roce*100:NaN;})}
      ],function(v){return n2(v,1)+' %';})+
      chartSerie('Marges','Évolution des marges bénéficiaires',labels,[
        {label:'Marge RBE',values:a.ratios.map(function(r){return fin(r.margeBrute)?r.margeBrute*100:NaN;})},
        {label:'Marge nette',values:a.ratios.map(function(r){return fin(r.margeNette)?r.margeNette*100:NaN;})},
        {label:'Marge FCF',values:a.ratios.map(function(r){return fin(r.margeFcf)?r.margeFcf*100:NaN;})}
      ],function(v){return n2(v,1)+' %';})+
      chartSerie('Structure financière','Levier et dette dans le temps',labels,[
        {label:'Gearing',values:a.ratios.map(function(r){return r.gearing;})},
        {label:'Dette / EBITDA',values:a.ratios.map(function(r){return r.detteEbitda;})}
      ],function(v){return n2(v,2)+' x';})+
      '</div>';
  }

  /* ── Pop-up graphique au survol et au clic ─────────────────────── */

  /* Boîte flottante réutilisée pour tous les graphiques : créée une seule
     fois, repositionnée à chaque survol, plutôt qu'un tooltip HTML natif
     (`<title>`) qui n'affiche qu'un seul point à la fois après un délai. */
  var afTip = null;
  function afTipEl() {
    if (!afTip) { afTip = document.createElement('div'); afTip.className = 'af-chart-tip'; document.body.appendChild(afTip); }
    return afTip;
  }
  function afChartHide() {
    if (afTip) afTip.style.display = 'none';
    var lines = document.querySelectorAll('.af-chart-hover-line');
    for (var i = 0; i < lines.length; i++) lines[i].remove();
  }
  function afChartHover(e, chartEl) {
    var data = CHART_DATA[chartEl.getAttribute('data-chart-id')];
    var svg = chartEl.querySelector('svg');
    if (!data || !svg) { afChartHide(); return; }
    var rect = svg.getBoundingClientRect();
    if (!rect.width) { afChartHide(); return; }
    var svgX = (e.clientX - rect.left) * (data.W / rect.width);
    var best = 0, bestD = Infinity;
    data.points.forEach(function (p, i) { var d = Math.abs(p.x - svgX); if (d < bestD) { bestD = d; best = i; } });
    var p = data.points[best];
    if (!p || !p.items.length) { afChartHide(); return; }
    var line = svg.querySelector('.af-chart-hover-line');
    if (!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'af-chart-hover-line');
      svg.appendChild(line);
    }
    line.setAttribute('x1', p.x); line.setAttribute('x2', p.x);
    line.setAttribute('y1', 0); line.setAttribute('y2', data.H);
    var tip = afTipEl();
    tip.innerHTML = '<div class="af-chart-tip-l">' + esc(String(p.label)) + '</div>' +
      p.items.map(function (it) {
        return '<div class="af-chart-tip-row"><i style="background:' + it.color + '"></i><span>' + esc(it.label) + '</span><b>' + esc(it.value) + '</b></div>';
      }).join('');
    tip.style.display = 'block';
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = e.clientX + 16, top = e.clientY + 16;
    if (left + tw > window.innerWidth - 8) left = e.clientX - tw - 16;
    if (top + th > window.innerHeight - 8) top = e.clientY - th - 16;
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = Math.max(4, top) + 'px';
  }

  /* Pop-up générique : un graphique agrandi, ouvert au clic sur une ligne
     de tableau plutôt que de multiplier les petits graphiques fixes pour
     chaque poste (bilan, capitaux propres, actions, trimestres…). */
  function afModal(titre, contenuHtml) {
    var old = document.getElementById('afModalOverlay');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'afModalOverlay';
    overlay.className = 'af-modal-overlay';
    overlay.innerHTML = '<div class="af-modal" role="dialog" aria-modal="true" aria-label="' + esc(titre) + '">' +
      '<div class="af-modal-head"><strong>' + esc(titre) + '</strong><button type="button" class="af-modal-close" aria-label="Fermer">✕</button></div>' +
      '<div class="af-modal-body">' + contenuHtml + '</div></div>';
    /* Ajoutée à l'intérieur de la vue, pas à document.body : les
       graphiques qu'elle contient dépendent des règles CSS et des
       variables (--af-gold, --af-up…) portées par #view-analyse-
       fondamentale, qui ne descendraient pas jusqu'à un enfant de body. */
    (root() || document.body).appendChild(overlay);
    function close() { afChartHide(); overlay.remove(); document.removeEventListener('keydown', onKey); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.af-modal-close').addEventListener('click', close);
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.af-modal-close').focus();
  }

  /* Cliquer une ligne des états financiers ouvre l'historique complet de
     ce seul poste, y compris ceux qui n'ont pas de courbe dédiée dans les
     graphiques du haut de l'onglet (bilan, capitaux propres, actions, BPA…). */
  function onEtatsRowClick(tr) {
    var a = S.analyse;
    if (!a) return;
    var k = tr.getAttribute('data-af-row'), lbl = tr.getAttribute('data-af-row-label');
    var brut = tr.getAttribute('data-af-row-brut') === '1';
    var labels = a.years.map(String);
    var values = a.rows.map(function (r) { return r[k]; });
    var fmt = brut ? function (v) { return n0(v); } : function (v) { return mont(v); };
    afModal(lbl, chartBarresVert(lbl, 'Historique complet publié', labels, [{ label: lbl, values: values }], fmt));
  }

  /* Cliquer une ligne du tableau trimestres/semestres ouvre la
     répartition infra-annuelle de cet exercice, pour le chiffre
     d'affaires, le résultat brut d'exploitation et le résultat net. */
  function onInterRowClick(tr) {
    var it = S.inter;
    if (!it) return;
    var y = tr.getAttribute('data-af-year');
    var periodesKeys = ['t1', 't2', 't3', 't4', 's1', 's2'];
    var periodesLbl = { t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', s1: 'S1', s2: 'S2' };
    var body = FLUX_KEYS.map(function (k) {
      var lbl = labelChampInter()[k];
      var parAnnee = it.champs[k] && it.champs[k][y];
      if (!parAnnee) return '';
      var periodes = periodesKeys.filter(function (p) { return parAnnee[p]; });
      if (periodes.length < 2) return '';
      var labels = periodes.map(function (p) { return periodesLbl[p]; });
      var values = periodes.map(function (p) { return parAnnee[p].valeur; });
      return chartBarresVert(lbl, String(y), labels, [{ label: lbl, values: values }], mont);
    }).join('');
    afModal('Répartition infra-annuelle — ' + y, body || '<p class="af-note">Pas assez de trimestres ou de semestres publiés pour ' + esc(String(y)) + '.</p>');
  }

  /* ── Sélecteur de titres ──────────────────────────────────────── */

  function tickers() {
    var all = Array.isArray(global.allFinancials) ? global.allFinancials : [];
    var seen = {}, out = [];
    all.forEach(function (f) {
      var t = String(f && f.ticker || '').trim().toUpperCase();
      if (!t || seen[t]) return;
      seen[t] = 1;
      out.push(t);
    });
    var cours = Array.isArray(global.allCours) ? global.allCours : [];
    var noms = {};
    cours.forEach(function (r) { noms[String(r.ticker || '').toUpperCase()] = r.nom || r.libelle || ''; });
    return out.sort().map(function (t) { return { ticker: t, nom: noms[t] || '' }; });
  }

  function fillSelect() {
    var sel = $('afTicker');
    if (!sel) return 0;
    var list = tickers();
    var keep = sel.value || S.ticker;
    sel.innerHTML = '<option value="">Choisir un titre…</option>' +
      list.map(function (o) {
        return '<option value="' + esc(o.ticker) + '">' + esc(o.ticker) + (o.nom ? ' — ' + esc(o.nom) : '') + '</option>';
      }).join('');
    if (keep) sel.value = keep;
    sel.disabled = !list.length;
    var c = $('afTickerCount');
    if (c) c.textContent = list.length ? list.length + ' sociétés avec états financiers' : 'En attente des états financiers';
    return list.length;
  }

  /* ── Chargement d'un titre ────────────────────────────────────── */

  function load(ticker) {
    if (!ticker) return false;
    S.ticker = String(ticker).toUpperCase();
    S.overrides = read(LS.ov + S.ticker, {}) || {};
    var a = C.analyse(S.ticker, S.overrides);
    S.analyse = a;
    try { S.inter = C.intermediaire(S.ticker); } catch (e) { S.inter = { enough: false, raison: 'erreur de calcul' }; }
    if (!a.enough) {
      S.hypotheses = null; S.resultats = null;
      render();
      return false;
    }
    var saved = read(LS.hyp + S.ticker, null);
    S.hypotheses = Object.assign(V.hypothesesInitiales(a), saved || {});
    S.poids = poidsInitiaux(V.poidsDefaut(a.data));
    S.portee = read(LS.portee, null) || 'sousSecteur';
    refreshComparables();
    recompute();
    render();
    return true;
  }

  /* Recalcule le groupe de comparables (portée + statistique + pairs
     exclus, ces deux derniers étant des préférences globales) et le
     rendement médian de marché utilisé par la méthode « dividende /
     rendement de marché ». Centralisé ici pour que la portée, la
     statistique et les exclusions restent toujours cohérentes entre
     elles, quel que soit le réglage modifié. */
  function refreshComparables() {
    var opts = { portee: S.portee, exclus: S.comparablesExclus, stat: S.comparablesStat };
    try { S.comparables = C.comparables(S.ticker, opts); }
    catch (e) { S.comparables = null; }
    /* Rendement de référence pour la méthode « dividende / rendement de
       marché » : toujours calculé sur le marché entier, indépendamment de
       la portée choisie ci-dessus pour les multiples — un rendement
       exigé n'a pas à se limiter au sous-secteur pour rester pertinent,
       à la différence d'un PER ou d'un PBR. Les pairs exclus et la
       statistique choisie restent appliqués. */
    try { S.comparablesMarche = C.comparables(S.ticker, Object.assign({}, opts, { portee: 'marche' })); }
    catch (e) { S.comparablesMarche = null; }
  }

  /* ── Recalcul de toutes les valorisations ─────────────────────── */

  function recompute() {
    if (!S.analyse || !S.analyse.enough || !S.hypotheses) { S.resultats = null; return; }
    var H = S.hypotheses;
    var a = S.analyse;
    var financier = C.estFinancier(a.data.secteur || a.data.sousSecteur);

    var w = V.wacc(H);
    S.wacc = w;
    /* Pour une banque ou un assureur, le WACC classique mélange le coût
       des fonds propres à un coût de la « dette » dont la composition
       réelle (dépôts, refinancement interbancaire...) n'a rien à voir
       avec une dette industrielle destinée à financer des actifs — la
       pondération capitaux propres / dette calculée plus haut (souvent
       très majoritairement « dette ») sous-estimerait alors fortement le
       taux d'actualisation. Le revenu résiduel, méthode de référence pour
       ce secteur, actualise déjà uniquement au coût des fonds propres :
       le DCF (mineur dans la pondération sectorielle mais pas nul) fait
       de même par cohérence, sauf taux imposé manuellement. */
    var taux = fin(H.tauxManuel) ? H.tauxManuel : (financier ? w.coutFondsPropres : w.valeur);

    var base = Object.assign({}, H, { taux: taux });
    var D = V.dcf(base);
    var med = S.comparables ? S.comparables.medianes : {};
    var mu = V.multiples(Object.assign({}, H, {
      perRef: fin(H.perRef) ? H.perRef : med.per,
      pbrRef: fin(H.pbrRef) ? H.pbrRef : med.pbr,
      psrRef: fin(H.psrRef) ? H.psrRef : med.psr,
      evEbitdaRef: fin(H.evEbitdaRef) ? H.evEbitdaRef : med.evEbitda,
      pfcfRef: fin(H.pfcfRef) ? H.pfcfRef : NaN
    }));
    var dd = V.ddm(Object.assign({}, H, {
      rendementExige: fin(H.rendementExige) ? H.rendementExige : w.coutFondsPropres,
      croissance: fin(H.croissanceDividende) ? H.croissanceDividende : 0.03,
      cours: a.data.price
    }));
    var rr = V.revenuResiduel(Object.assign({}, H, {
      rendementExige: fin(H.rendementExige) ? H.rendementExige : w.coutFondsPropres,
      croissance: H.croissance, croissancePerpetuelle: H.croissancePerpetuelle, annees: H.annees,
      /* Le dernier exercice est justement celui où le dividende manque le
         plus souvent (publié après le reste des comptes) : on retient la
         moyenne historique du taux de distribution plutôt que la seule
         dernière année, qui reviendrait à supposer 0 % de distribution
         future pour une société qui distribue depuis toujours. */
      payoutRef: fin(H.payoutRef) ? H.payoutRef : a.moyennes.payout
    }));
    var gr = V.graham(H.bpa, H.anpa, H.facteurGraham);

    function mult(cle) { var l = mu.lignes.filter(function (x) { return x.cle === cle; })[0]; return l && l.utilisable ? l.valeur : NaN; }

    /* Valeur comptable par action retenue telle quelle comme cible (fair
       value = 1× l'actif net), sans passer par un multiple de pairs :
       une méthode à part entière, plus prudente que le PBR (qui suppose
       que le marché a raison de payer plus ou moins que le comptable),
       demandée explicitement pour compléter le PER, l'EV/EBIT et le
       rendement plutôt que d'être noyée dans le multiple de comparables. */
    var vcpaDirect = fin(H.anpa) && H.anpa > 0 ? H.anpa : NaN;

    /* Dividende par action de référence : le dernier connu, même si
       l'exercice le plus récent ne l'a pas encore publié (même logique
       que le revenu résiduel plus haut). */
    var dpaRef = fin(H.dividende) ? H.dividende : NaN;
    if (!fin(dpaRef)) {
      for (var iDpa = a.rows.length - 1; iDpa >= 0; iDpa--) {
        if (fin(a.rows[iDpa].dpa) && a.rows[iDpa].dpa > 0) { dpaRef = a.rows[iDpa].dpa; break; }
      }
    }
    /* Cible par le rendement : le dividende de référence rapporté au
       rendement médian de l'ensemble du marché (pas du seul sous-secteur
       — un rendement exigé se compare à l'éventail des placements
       disponibles, pas seulement aux pairs directs), plutôt qu'à un coût
       des fonds propres calculé par CAPM. Méthode plus simple que le
       Gordon-Shapiro ci-dessus, à dessein : elle sert de recoupement,
       pas de remplacement. */
    var dyMarche = S.comparablesMarche ? S.comparablesMarche.medianes.rendement : NaN;
    var vcDyMarche = pos(dpaRef) && fin(dyMarche) && dyMarche > 0 ? dpaRef / dyMarche : NaN;

    S.resultats = {
      taux: taux, financier: financier,
      dcf: D,
      sensibilite: D.ok ? V.sensibilite(base) : null,
      inverse: D.ok ? V.dcfInverse(base, a.data.price) : null,
      scenarios: D.ok ? V.scenarios(base, a.data.price) : null,
      multiples: mu,
      ddm: dd,
      residuel: rr,
      graham: gr,
      vcpaDirect: vcpaDirect,
      dyMarche: { dpaRef: dpaRef, rendementMarche: dyMarche, valeur: vcDyMarche },
      synthese: V.synthese({
        dcf: D.ok ? D.parAction : NaN,
        ddm: dd.ok ? dd.valeur : NaN,
        per: mult('per'), pbr: mult('pbr'), psr: mult('psr'), evEbitda: mult('evEbitda'), pfcf: mult('pfcf'),
        residuel: rr.ok ? rr.valeur : NaN,
        graham: gr.ok ? gr.valeur : NaN,
        vcpa: vcpaDirect,
        dyMarche: vcDyMarche
      }, S.poids, a.data.price)
    };
  }

  function saveHyp() { if (S.ticker) store(LS.hyp + S.ticker, S.hypotheses); }
  function saveOv() { if (S.ticker) store(LS.ov + S.ticker, S.overrides); }

  /* ── Onglets ──────────────────────────────────────────────────── */

  /* Le "sep" marque le début d'un groupe visuel dans la barre d'onglets
     (simple séparateur, aucune incidence sur le routage : chaque onglet
     garde son data-aftab et son gestionnaire de clic habituels). Sert à
     donner une structure lisible à neuf onglets plutôt qu'une rangée
     plate : vue d'ensemble, données chiffrées, valorisation, évaluation. */
  var TABS = [
    { id: 'synthese', l: 'Synthèse', t: 'Vue d\'ensemble : score de qualité, valorisation de synthèse et signaux de lecture.' },
    { id: 'etats', l: 'États financiers', sep: true, t: 'Comptes annuels publiés, exercice par exercice.' },
    { id: 'ratios', l: 'Ratios', t: 'Rentabilité, structure financière, flux et valorisation, sur tous les exercices.' },
    { id: 'croissance', l: 'Croissance', t: 'Taux de croissance annuel moyen, régularité et projection.' },
    { id: 'intermediaire', l: 'Intermédiaire', t: 'Trimestres et semestres : comparaison à la même période l\'an dernier, cumul depuis le début de l\'exercice, saisonnalité.' },
    { id: 'valorisation', l: 'Valorisation', sep: true, t: 'Hypothèses et calcul de la valeur cible (DCF, multiples, dividendes...).' },
    { id: 'sensibilite', l: 'Sensibilité', t: 'Matrice de sensibilité de la valorisation et scénarios pessimiste/central/optimiste.' },
    { id: 'comparables', l: 'Comparables', t: 'Comparaison aux pairs du secteur ou du marché.' },
    { id: 'qualite', l: 'Qualité', sep: true, t: 'Score de qualité maison et score de Piotroski, en détail.' },
    { id: 'donnees', l: 'Données & hypothèses', t: 'Remarques sur les données, saisie des postes manquants, hypothèses en vigueur.' }
  ];

  function render() {
    var host = $('afPanel');
    if (!host) return;
    /* Remis à zéro à chaque rendu complet : les graphiques du panneau
       précédent quittent le DOM avec host.innerHTML, leurs entrées dans
       CHART_DATA seraient sinon accumulées pour rien tout au long de la
       session. */
    CHART_DATA = {}; CHART_SEQ = 0;
    afChartHide();
    var t = $('afTabs');
    if (t) t.innerHTML = TABS.map(function (x) {
      return (x.sep ? '<span class="af-tab-sep"></span>' : '') +
        '<button type="button" class="af-tab' + (x.id === S.tab ? ' on' : '') + '" data-aftab="' + x.id + '" title="' + esc(x.t || '') + '">' + x.l + '</button>';
    }).join('');

    renderHeader();

    if (!S.ticker) { host.innerHTML = vide('Aucun titre sélectionné', 'Choisissez une société dans le sélecteur pour afficher ses états financiers, ses ratios et sa valorisation.'); return; }
    if (!S.analyse || !S.analyse.enough) {
      host.innerHTML = vide('Données indisponibles', S.analyse && S.analyse.raison ? S.analyse.raison.charAt(0).toUpperCase() + S.analyse.raison.slice(1) + '.' : 'Aucun exercice annuel n\'a été trouvé pour ce titre.');
      return;
    }
    var fn = {
      synthese: paneSynthese, etats: paneEtats, ratios: paneRatios, croissance: paneCroissance,
      intermediaire: paneIntermediaire,
      valorisation: paneValorisation, sensibilite: paneSensibilite, comparables: paneComparables,
      qualite: paneQualite, donnees: paneDonnees
    }[S.tab] || paneSynthese;
    host.innerHTML = fn();
  }

  function vide(titre, txt) {
    return '<div class="af-empty"><div class="af-empty-t">' + esc(titre) + '</div><p>' + esc(txt) + '</p></div>';
  }
  function groupe(l, cle) { return '<div class="af-group">' + esc(l) + (cle ? memo(cle) : '') + '</div>'; }
  function note(txt) { return '<p class="af-note">' + txt + '</p>'; }

  var PORTEE_LABEL = { sousSecteur: 'sous-secteur', secteur: 'secteur', marche: 'marché entier' };

  /* Sélecteur de portée des comparables : trois boutons, la portée
     retenue mémorisée par appareil (pas par titre, le choix relève de
     la méthode, pas de la société consultée). */
  function porteeToggle() {
    return '<div class="af-portee">' + PORTEES.map(function (p) {
      return '<button type="button" class="af-portee-btn' + (S.portee === p.id ? ' on' : '') + '" data-afportee="' + p.id + '">' + p.l + '</button>';
    }).join('') + '</div>';
  }

  var STATS = [{ id: 'moyenne', l: 'Moyenne' }, { id: 'mediane', l: 'Médiane' }];
  function statToggle() {
    return '<div class="af-portee" title="Statistique retenue pour agréger les pairs">' + STATS.map(function (s) {
      return '<button type="button" class="af-portee-btn' + (S.comparablesStat === s.id ? ' on' : '') + '" data-afstat="' + s.id + '">' + s.l + '</button>';
    }).join('') + '</div>';
  }

  /* Avertit quand la portée demandée n'a pas assez de pairs et qu'un
     repli automatique a eu lieu : la médiane affichée ne correspond
     alors pas à ce que le bouton actif laisse penser. */
  function porteeNote(cmp) {
    if (!cmp) return '';
    var retenusTxt = cmp.pairsRetenus && cmp.pairsRetenus.length !== cmp.pairs.length
      ? ' (' + cmp.pairsRetenus.length + ' retenue(s) après exclusions)' : '';
    var txt = 'Comparables : ' + cmp.pairs.length + ' société(s)' + retenusTxt + ' — portée « ' + PORTEE_LABEL[cmp.portee] + ' »' +
      (cmp.sousSecteur ? ' (' + esc(cmp.sousSecteur) + ')' : (cmp.secteur ? ' (' + esc(cmp.secteur) + ')' : '')) + '.';
    if (cmp.repli) {
      txt += ' Repli automatique depuis « ' + PORTEE_LABEL[cmp.repli] + ' », faute d\'au moins deux pairs à ce niveau.';
    }
    return note(txt);
  }

  function renderHeader() {
    var h = $('afHeader');
    if (!h) return;
    if (!S.analyse || !S.analyse.enough) { h.innerHTML = ''; return; }
    var d = S.analyse.data, r = S.analyse.dernier;
    var syn = S.resultats && S.resultats.synthese;
    function cell(l, v, cls) {
      return '<div class="af-h"><span class="af-h-l">' + l + '</span><span class="af-h-v ' + (cls || '') + '">' + v + '</span></div>';
    }
    h.innerHTML =
      '<div class="af-h-head"><strong>' + esc(d.ticker) + '</strong>' +
      (d.nom ? '<span class="af-h-nom">' + esc(d.nom) + '</span>' : '') +
      (d.secteur ? '<span class="af-h-sec">' + esc(d.secteur) + '</span>' : '') + '</div>' +
      cell('Cours', or(n0(d.price)) + ' FCFA', 'af-gold') +
      cell('Capitalisation', or(mont(d.marketCap))) +
      cell('Exercices', S.analyse.rows.length + ' (' + S.analyse.years[0] + '–' + S.analyse.years[S.analyse.years.length - 1] + ')') +
      cell('PER', or(n2(r.per)), tone(r.per, 15, true)) +
      cell('ROE', or(pc(r.roe)), tone(r.roe, 0.12)) +
      cell('Rendement', or(pc(r.rendement, 2)), tone(r.rendement, 0.04)) +
      (syn && fin(syn.valeur) ? cell('Valeur estimée', n0(syn.valeur) + ' FCFA', 'af-gold') : '') +
      (syn && fin(syn.potentiel) ? cell('Potentiel', pcs(syn.potentiel), syn.potentiel >= 0 ? 'af-up' : 'af-down') : '');
  }

  /* ── Onglet Synthèse ──────────────────────────────────────────── */

  function paneSynthese() {
    var a = S.analyse, r = a.dernier, ex = a.dernierExercice, q = a.qualite;
    var syn = S.resultats && S.resultats.synthese;
    var html = '';

    if (q.enough) {
      var pct = q.note100;
      html += '<div class="af-verdict ' + (pct >= 65 ? 'af-t-bon' : pct >= 45 ? 'af-t-moyen' : 'af-t-faible') + '">' +
        '<div class="af-verdict-n">' + Math.round(pct) + '<small>/100</small></div>' +
        '<div><div class="af-verdict-l">' + esc(q.mention.charAt(0).toUpperCase() + q.mention.slice(1)) + '</div>' +
        '<div class="af-verdict-s">Note construite sur ' + q.piliers.filter(function (p) { return fin(p.note); }).length +
        ' piliers, détaillée dans l\'onglet Qualité.</div></div></div>';
      html += '<div class="af-piliers">' + q.piliers.map(function (p) {
        var w = fin(p.note) ? p.note / p.sur * 100 : 0;
        return '<div class="af-pilier"><div class="af-pilier-t"><span>' + esc(p.nom) + '</span>' +
          '<span>' + (fin(p.note) ? Math.round(p.note) + '/' + p.sur : '—') + '</span></div>' +
          '<div class="af-bar"><div style="width:' + w + '%"></div></div></div>';
      }).join('') + '</div>';
    }

    if (syn && fin(syn.valeur)) {
      html += groupe('Valorisation de synthèse', 'dcf');
      html += '<div class="af-val-head">' +
        '<div><div class="af-val-l">Valeur estimée</div><div class="af-val-v">' + n0(syn.valeur) + ' <small>FCFA</small></div></div>' +
        '<div><div class="af-val-l">Cours</div><div class="af-val-v af-dim">' + or(n0(syn.cours)) + '</div></div>' +
        '<div><div class="af-val-l">Potentiel</div><div class="af-val-v ' + (syn.potentiel >= 0 ? 'af-up' : 'af-down') + '">' + or(pcs(syn.potentiel)) + '</div></div>' +
        '</div>';
      if (syn.fourchette) {
        html += note('Les ' + syn.retenues + ' méthodes exploitables donnent une fourchette de <strong>' +
          n0(syn.fourchette.bas) + '</strong> à <strong>' + n0(syn.fourchette.haut) + '</strong> FCFA. ' +
          'La valeur retenue est leur moyenne pondérée, les poids étant modifiables dans l\'onglet Valorisation.');
      }
      if (syn.avertissement) html += '<div class="af-warn">' + esc(syn.avertissement) + '</div>';
      if (fin(syn.margeSecurite)) {
        html += '<div class="af-mini"><span>Marge de sécurité' + memo('marge-securite') + '</span><strong class="' +
          (syn.margeSecurite >= 0.3 ? 'af-up' : syn.margeSecurite >= 0 ? '' : 'af-down') + '">' + pc(syn.margeSecurite) + '</strong></div>';
      }
    }

    html += groupe('Dernier exercice publié · ' + ex.annee);
    html += '<div class="af-stats">' +
      st(ca(), or(mont(ex.ca)), pcs(r.croissanceCa) ? 'variation de ' + pcs(r.croissanceCa) : '', 'ca', a.rows.map(function(x){return x.ca;}), mont) +
      st('Résultat brut d\'exploitation', or(mont(ex.rbe)), or(pc(r.margeBrute), '') + ' de marge', 'marge-exploitation', a.rows.map(function(x){return x.rbe;}), mont) +
      st('Résultat net', or(mont(ex.rn)), or(pc(r.margeNette), '') + ' de marge', 'marge-nette', a.rows.map(function(x){return x.rn;}), mont) +
      st('Flux de trésorerie libre', or(mont(ex.fcf)), or(pc(r.margeFcf), '') + ' du ' + ca('min'), 'fcf', a.rows.map(function(x){return x.fcf;}), mont) +
      st('Capitaux propres', or(mont(ex.cp)), or(pc(r.autonomie), '') + ' du bilan', 'autonomie', a.rows.map(function(x){return x.cp;}), mont) +
      st('Dette financière', or(mont(ex.dette)), 'levier de ' + or(n2(r.gearing), '—'), 'gearing', a.rows.map(function(x){return x.dette;}), mont, true) +
      '</div>';

    html += groupe('Signaux de lecture');
    html += lectures();

    if (a.alertes.length) {
      var graves = a.alertes.filter(function (x) { return x.niveau === 'grave'; });
      var moyens = a.alertes.filter(function (x) { return x.niveau === 'moyen'; });
      if (graves.length || moyens.length) {
        html += groupe('Points de vigilance sur les données');
        graves.concat(moyens).forEach(function (al) {
          html += '<div class="af-alerte af-a-' + al.niveau + '">' + esc(al.txt) + '</div>';
        });
      }
      html += note('<button type="button" class="af-lien" data-aftab="donnees">Voir les ' + a.alertes.length +
        ' remarques sur la qualité des données</button>');
    }

    html += '<p class="af-disclaimer">Cette analyse est produite à partir des états financiers publiés et des hypothèses ' +
      'affichées dans l\'onglet Valorisation. Elle ne constitue pas un conseil en investissement et ne remplace pas la ' +
      'lecture des rapports annuels.</p>';
    return html;
  }

  function st(l, v, s, cle, values, format, inverse) {
    return '<div class="af-stat"><div class="af-stat-top"><div class="af-stat-l">' + esc(l) + (cle ? memo(cle) : '') + '</div>' +
      sparkline(values, format, inverse) + '</div><div class="af-stat-v">' + v + '</div>' +
      (s ? '<div class="af-stat-s">' + s + '</div>' : '') + '</div>';
  }

  /* Quelques lectures automatiques, chacune motivée par une phrase. */
  function lectures() {
    var a = S.analyse, r = a.dernier, m = a.moyennes, cr = a.croissances;
    var out = [];
    function dire(ton, txt) { out.push({ ton: ton, txt: txt }); }

    if (fin(r.roe)) {
      if (r.roe >= 0.15) dire('bon', 'La société dégage ' + pc(r.roe) + ' de rentabilité sur ses capitaux propres. Au-delà de 15 % durablement, une entreprise crée de la valeur pour ses actionnaires.');
      else if (r.roe < 0.05) dire('mauvais', 'La rentabilité des capitaux propres est de ' + pc(r.roe) + '. En dessous du coût du capital, la société détruit de la valeur, même si elle est bénéficiaire comptablement.');
    }
    if (fin(r.dupont.levier) && fin(r.roe) && r.dupont.levier > 2.5 && r.roe > 0.12) {
      dire('vigilance', 'Le ROE de ' + pc(r.roe) + ' repose sur un levier de ' + n2(r.dupont.levier) + ' : une part importante vient de l\'endettement, pas de la performance industrielle.');
    }
    if (fin(r.conversionCash)) {
      if (r.conversionCash >= 1) dire('bon', 'Chaque franc de résultat net se traduit par ' + n2(r.conversionCash) + ' franc de trésorerie opérationnelle : les bénéfices sont réels.');
      else if (r.conversionCash < 0.7) dire('mauvais', 'Seuls ' + pc(r.conversionCash, 0) + ' du résultat net se retrouvent en trésorerie. Une part des bénéfices reste immobilisée en créances ou en stocks, ou relève d\'écritures comptables.');
    }
    if (fin(cr.ca.value)) {
      if (cr.ca.value >= 0.10) dire('bon', 'Le ' + ca('min') + ' progresse de ' + pc(cr.ca.value) + ' par an sur ' + cr.ca.annees + ' ans, en hausse ' + cr.regularite.exercicesHausse + ' exercices sur ' + cr.regularite.exercices + '.');
      else if (cr.ca.value < 0) dire('mauvais', 'Le ' + ca('min') + ' recule de ' + pc(Math.abs(cr.ca.value)) + ' par an sur la période. Toute valorisation par croissance devient hasardeuse.');
    } else if (cr.ca.raison) {
      dire('vigilance', 'Le taux de croissance du ' + ca('min') + ' n\'est pas calculable : ' + cr.ca.raison + '.');
    }
    if (fin(r.detteEbitda) && r.detteEbitda > 4) dire('mauvais', 'La dette représente ' + n2(r.detteEbitda) + ' années de résultat brut d\'exploitation. Au-delà de quatre, elle contraint sérieusement l\'investissement comme la distribution.');
    if (fin(r.payout)) {
      if (r.payout > 1) dire('mauvais', 'Le dividende dépasse le bénéfice de l\'exercice : il est financé par la trésorerie ou par la dette, ce qui ne peut pas durer.');
      else if (r.payout > 0.85) dire('vigilance', 'Le taux de distribution atteint ' + pc(r.payout, 0) + '. La marge de manœuvre est mince : un exercice difficile suffirait à contraindre une coupe.');
      else if (r.payout > 0 && r.payout < 0.5 && fin(r.rendement) && r.rendement > 0.04) dire('bon', 'Un rendement de ' + pc(r.rendement, 2) + ' avec un taux de distribution de seulement ' + pc(r.payout, 0) + ' : le dividende est confortablement couvert.');
    }
    var perHist = S.comparablesStat === 'mediane' ? m.perMediane : m.per;
    if (fin(r.per) && fin(perHist) && r.per > 0 && perHist > 0) {
      var ecart = r.per / perHist - 1;
      if (Math.abs(ecart) > 0.25) dire(ecart > 0 ? 'vigilance' : 'bon', 'Le PER de ' + n2(r.per) + ' se situe ' + pc(Math.abs(ecart), 0) + (ecart > 0 ? ' au-dessus' : ' en dessous') + ' de sa ' + (S.comparablesStat === 'mediane' ? 'médiane' : 'moyenne') + ' historique de ' + n2(perHist) + '.');
    }
    var inv = S.resultats && S.resultats.inverse;
    if (inv && inv.ok && fin(inv.croissanceImplicite)) {
      dire('info', 'Au cours actuel, le marché suppose une croissance des flux de ' + pc(inv.croissanceImplicite) + ' par an. ' + inv.lecture);
    }

    if (!out.length) return note('Les données disponibles ne permettent pas de dégager de signal marquant.');
    return out.map(function (o) {
      return '<div class="af-lecture af-l-' + o.ton + '">' + esc(o.txt) + '</div>';
    }).join('');
  }

  /* ── Onglet États financiers ──────────────────────────────────── */

  function paneEtats() {
    var a = S.analyse;
    var lignes = [
      { k: 'ca', l: ca(), memo: 'ca', gras: true },
      { k: 'rbe', l: 'Résultat brut d\'exploitation', memo: 'marge-exploitation' },
      { k: 'ebit', l: 'Résultat d\'exploitation', saisi: true },
      { k: 'rn', l: 'Résultat net', gras: true },
      { sep: 'Bilan' },
      { k: 'actif', l: 'Total du bilan' },
      { k: 'cp', l: 'Capitaux propres', gras: true },
      { k: 'dette', l: 'Dettes financières', memo: 'gearing', inverse: true },
      { k: 'treso', l: 'Trésorerie', saisi: true, memo: 'dette-nette' },
      { sep: 'Flux de trésorerie' },
      { k: 'cfo', l: 'Flux opérationnel' },
      { k: 'capex', l: 'Investissements', memo: 'capex-ca' },
      { k: 'fcf', l: 'Flux de trésorerie libre', memo: 'fcf', gras: true },
      { sep: 'Données par action' },
      { k: 'actions', l: 'Nombre d\'actions', brut: true },
      { k: 'bpa', l: 'Bénéfice par action', brut: true },
      { k: 'dpa', l: 'Dividende par action', brut: true, memo: 'rendement' }
    ];

    var html = groupe('États financiers annuels · ' + a.rows.length + ' exercices');
    html += financialCharts(a);
    html += note('Les montants sont exprimés en francs CFA. Les valeurs sur fond ambré ont été saisies dans l\'onglet ' +
      'Données et ne proviennent pas des états publiés. Les cellules vides correspondent à des postes non publiés par la source. ' +
      'Le taux à côté de chaque libellé (« TCAM ») est le taux de croissance annuel moyen sur toute la période affichée ; ' +
      'la flèche sur le dernier exercice compare seulement celui-ci au précédent.');
    html += '<div class="af-scroll"><table class="af-table af-etats"><thead><tr><th></th>' +
      a.years.map(function (y) { return '<th class="r">' + y + '</th>'; }).join('') + '</tr></thead><tbody>';

    lignes.forEach(function (li) {
      if (li.sep) {
        html += '<tr class="af-sep"><td colspan="' + (a.years.length + 1) + '">' + esc(li.sep) + '</td></tr>';
        return;
      }
      var serie = a.rows.map(function (r) { return r[li.k]; });
      var trCls = ['af-row-click']; if (li.gras) trCls.push('af-gras');
      html += '<tr class="' + trCls.join(' ') + '" data-af-row="' + li.k + '" data-af-row-label="' + esc(li.l) +
        '" data-af-row-brut="' + (li.brut ? '1' : '0') + '" tabindex="0" title="Cliquer pour voir l\'historique complet en graphique"><td>' +
        esc(li.l) + (li.memo ? memo(li.memo) : '') + tcamBadge(serie, li.inverse) + '</td>' +
        a.rows.map(function (r, i) {
          var v = r[li.k];
          var saisi = r['_saisi_' + li.k];
          var txt = fin(v) ? (li.brut ? n0(v) : mont(v)) : '—';
          var badge = i === a.rows.length - 1 ? trend(serie, i, li.inverse) : '';
          return '<td class="r' + (saisi ? ' af-saisi' : '') + (fin(v) ? '' : ' af-vide') + '">' + txt + badge + '</td>';
        }).join('') + '</tr>';
    });
    html += '</tbody></table></div>';

    var sources = a.rows.filter(function (r) { return r.source || r.sourceUrl; });
    if (sources.length) {
      html += groupe('Sources');
      html += '<div class="af-sources">' + sources.map(function (r) {
        return '<div class="af-source"><span>' + r.annee + '</span>' +
          (r.sourceUrl ? '<a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener">' + esc(r.source || 'document') + '</a>'
            : '<span>' + esc(r.source) + '</span>') +
          (r.sourcePage ? '<small>page ' + esc(r.sourcePage) + '</small>' : '') + '</div>';
      }).join('') + '</div>';
    }
    return html;
  }

  /* ── Onglet Ratios ────────────────────────────────────────────── */

  function paneRatios() {
    var a = S.analyse;
    var blocs = [
      {
        t: 'Rentabilité', l: [
          ['margeBrute', 'Marge d\'exploitation (RBE)', 'pc', 'marge-exploitation'],
          ['margeNette', 'Marge nette', 'pc', 'marge-nette'],
          ['roe', 'Rentabilité des capitaux propres', 'pc', 'roe', [0.12]],
          ['roa', 'Rentabilité des actifs', 'pc', 'roa'],
          ['roce', 'Rentabilité des capitaux employés', 'pc']
        ]
      },
      {
        t: 'Structure financière', l: [
          ['gearing', 'Levier financier', 'n2', 'gearing', [1, true]],
          ['autonomie', 'Autonomie financière', 'pc', 'autonomie'],
          ['detteActif', 'Dette rapportée au bilan', 'pc'],
          ['detteEbitda', 'Dette nette sur excédent brut', 'n2', 'dette-ebitda', [3, true]],
          ['levier', 'Multiplicateur des capitaux propres', 'n2']
        ]
      },
      {
        t: 'Efficacité et flux', l: [
          ['rotationActifs', 'Rotation des actifs', 'n2'],
          ['margeFcf', 'Marge de flux libre', 'pc', 'fcf'],
          ['conversionCash', 'Conversion en trésorerie', 'n2', 'conversion-cash'],
          ['capexCa', 'Intensité capitalistique', 'pc', 'capex-ca']
        ]
      },
      {
        t: 'Par action', l: [
          ['bpa', 'Bénéfice par action', 'n0'],
          ['dpa', 'Dividende par action', 'n0'],
          ['anpa', 'Actif net par action', 'n0'],
          ['fcfpa', 'Flux libre par action', 'n0']
        ]
      },
      {
        t: 'Valorisation au cours actuel', l: [
          ['per', 'Cours sur bénéfice', 'n2', 'per'],
          ['pbr', 'Cours sur actif net', 'n2', 'pbr'],
          ['psr', 'Cours sur ' + ca('min'), 'n2'],
          ['evEbitda', 'Valeur d\'entreprise sur excédent brut', 'n2', 'ev-ebitda'],
          ['pfcf', 'Cours sur flux libre', 'n2'],
          ['rendement', 'Rendement du dividende', 'pc2', 'rendement', [0.04]],
          ['payout', 'Taux de distribution', 'pc', 'payout']
        ]
      }
    ];

    var html = ratioCharts(a);
    html += note('Chaque ratio est calculé pour tous les exercices disponibles. Les multiples de valorisation ' +
      'rapportent le <strong>cours d\'aujourd\'hui</strong> aux comptes de chaque exercice : ils servent à situer la ' +
      'valorisation actuelle par rapport à l\'histoire de la société, pas à reconstituer une valorisation passée.');

    blocs.forEach(function (b) {
      html += groupe(b.t);
      html += '<div class="af-scroll"><table class="af-table"><thead><tr><th></th>' +
        a.years.map(function (y) { return '<th class="r">' + y + '</th>'; }).join('') + '</tr></thead><tbody>';
      b.l.forEach(function (row) {
        var k = row[0], lbl = row[1], fmt = row[2], mk = row[3], seuil = row[4];
        var serie = a.ratios.map(function(x){ return x[k]; });
        html += '<tr><td><span class="af-ratio-label">' + esc(lbl) + (mk ? memo(mk) : '') + '</span>' +
          sparkline(serie, function(v){ return fmt === 'pc' || fmt === 'pc2' ? pc(v, fmt === 'pc2' ? 2 : 1) : n2(v); }, seuil && seuil[1]) +
          '</td>' +
          a.ratios.map(function (r, i) {
            var v = r[k];
            var txt = !fin(v) ? '—'
              : fmt === 'pc' ? pc(v) : fmt === 'pc2' ? pc(v, 2) : fmt === 'n0' ? n0(v) : n2(v);
            /* Seul le dernier exercice porte un jugement bon/mauvais fondé
               sur un seuil : sur l'historique complet, la couleur guiderait
               l'œil vers des années qui ne représentent plus la situation
               actuelle. La flèche de tendance, elle, ne juge pas — elle
               indique juste si le dernier exercice est en hausse ou en
               baisse par rapport au précédent, sur toutes les lignes. */
            var isLast = i === a.ratios.length - 1;
            var cls = seuil && isLast ? ' ' + tone(v, seuil[0], seuil[1]) : '';
            var badge = isLast ? trend(serie, i, seuil && seuil[1]) : '';
            return '<td class="r' + (fin(v) ? '' : ' af-vide') + cls + '">' + txt + badge + '</td>';
          }).join('') + '</tr>';
      });
      html += '</tbody></table></div>';
    });
    return html;
  }

  /* ── Onglet Croissance ────────────────────────────────────────── */

  function paneCroissance() {
    var a = S.analyse, cr = a.croissances;
    var html = groupe('Taux de croissance annuel moyen');
    html += note('Le taux annuel moyen ne se calcule qu\'entre deux bornes strictement positives. Lorsqu\'un exercice ' +
      'est en perte, le taux n\'existe pas mathématiquement : la raison est affichée plutôt qu\'un chiffre trompeur.');
    html += '<div class="af-stats">';
    [['ca', ca()], ['rbe', 'Résultat brut'], ['rn', 'Résultat net'],
    ['fcf', 'Flux libre'], ['bpa', 'Bénéfice par action'], ['dpa', 'Dividende par action'],
    ['cp', 'Capitaux propres']].forEach(function (x) {
      var t = cr[x[0]];
      html += '<div class="af-stat"><div class="af-stat-l">' + x[1] + '</div>' +
        '<div class="af-stat-v ' + (fin(t.value) ? (t.value >= 0 ? 'af-up' : 'af-down') : '') + '">' +
        (fin(t.value) ? (t.value >= 0 ? '▲ ' : '▼ ') + pcs(t.value) : '<span class="af-nd">—</span>') + '</div>' +
        '<div class="af-stat-s">' + (fin(t.value) ? 'par an sur ' + t.annees + ' exercices' : esc(t.raison)) + '</div></div>';
    });
    html += '</div>';

    var r = cr.regularite;
    if (fin(r.value)) {
      html += groupe('Régularité');
      html += note('Un ' + ca('min') + ' qui progresse chaque année vaut mieux qu\'un ' + ca('min') + ' qui double ' +
        'puis s\'effondre, même à taux moyen identique.');
      html += '<div class="af-stats">' +
        '<div class="af-stat"><div class="af-stat-l">Exercices en hausse</div>' +
        '<div class="af-stat-v">' + r.exercicesHausse + ' <small>sur ' + r.exercices + '</small></div>' +
        '<div class="af-bar af-bar-sm"><div style="width:' + Math.round(r.value * 100) + '%"></div></div>' +
        '<div class="af-stat-s">' + pc(r.value, 0) + ' des exercices</div></div>' +
        st('Dispersion des variations', or(n2(r.dispersion)), fin(r.dispersion) ? (r.dispersion < 0.5 ? 'croissance très régulière' : r.dispersion < 1.2 ? 'croissance modérément régulière' : 'croissance heurtée') : '') +
        '</div>';
    }

    if (cr.regCa) {
      html += groupe('Tendance linéaire du ' + ca('min'));
      html += '<div class="af-stats">' +
        st('Pente', or(mont(cr.regCa.slope)) + ' par an', 'progression moyenne en valeur absolue') +
        st('Qualité de l\'ajustement', or(pc(cr.regCa.r2, 0)), fin(cr.regCa.r2) ? (cr.regCa.r2 > 0.85 ? 'la croissance est presque parfaitement linéaire' : cr.regCa.r2 > 0.6 ? 'la tendance linéaire décrit correctement la série' : 'la série s\'écarte nettement d\'une droite') : '') +
        '</div>';
    }

    html += groupe('Projection');
    html += '<div class="af-form">' +
      champ('Méthode de projection', 'select', 'methodeProj', S.hypotheses.methodeProj || 'tcam',
        [['tcam', 'Taux de croissance annuel moyen'], ['regression', 'Régression linéaire'], ['manuel', 'Taux saisi manuellement']]) +
      champ('Taux retenu si saisi manuellement', 'pct', 'tauxProjManuel', S.hypotheses.tauxProjManuel) +
      champ('Nombre d\'exercices projetés', 'int', 'anneesProj', S.hypotheses.anneesProj || 3) +
      '</div>';

    var proj = projection();
    if (proj) {
      html += '<div class="af-chart-grid">' + ['ca', 'rn', 'fcf'].map(function (k) {
        var lbl = { ca: ca(), rn: 'Résultat net', fcf: 'Flux libre' }[k];
        return chartProjection(lbl, a.years, a.rows.map(function (r) { return r[k]; }), proj.annees, proj[k], mont);
      }).join('') + '</div>';
      html += '<div class="af-scroll"><table class="af-table"><thead><tr><th></th>' +
        proj.annees.map(function (y) { return '<th class="r">' + y + '</th>'; }).join('') + '</tr></thead><tbody>' +
        ['ca', 'rn', 'fcf'].map(function (k) {
          var lbl = { ca: ca(), rn: 'Résultat net', fcf: 'Flux libre' }[k];
          return '<tr><td>' + lbl + '</td>' + proj[k].map(function (v) {
            return '<td class="r">' + or(mont(v), '—') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      html += note('Projection mécanique, sans jugement sur la stratégie de la société ni sur son marché. ' +
        'Elle sert à cadrer un ordre de grandeur, pas à prédire un résultat. ' + esc(proj.methodeTxt));
    } else {
      html += note(S.hypotheses.methodeProj === 'manuel'
        ? 'Saisissez un taux pour que la projection au taux manuel s\'affiche : elle ne se substitue jamais silencieusement au taux de croissance historique.'
        : 'La projection demande au moins trois exercices renseignés pour la grandeur retenue.');
    }
    return html;
  }

  function projection() {
    var a = S.analyse, H = S.hypotheses;
    var n = Math.max(1, Math.min(10, Math.round(H.anneesProj || 3)));
    var methode = H.methodeProj || 'tcam';
    var dernier = a.years[a.years.length - 1];
    var annees = [];
    for (var i = 1; i <= n; i++) annees.push(dernier + i);
    var out = { annees: annees, methodeTxt: '' };
    var ok = false;

    ['ca', 'rn', 'fcf'].forEach(function (k) {
      var serie = a.rows.map(function (r) { return r[k]; });
      var last = null;
      for (var j = serie.length - 1; j >= 0; j--) if (fin(serie[j])) { last = serie[j]; break; }
      var vals = [];
      if (methode === 'regression') {
        var reg = C.regression(a.years, serie);
        for (var i2 = 0; i2 < n; i2++) vals.push(reg ? reg.at(annees[i2]) : NaN);
        if (reg) ok = true;
      } else {
        /* Le mode manuel ne doit jamais se replier en silence sur le TCAM
           historique quand le taux n'est pas encore saisi : ce serait
           appliquer une méthode que l'utilisateur n'a pas choisie sans le
           dire, exactement ce que le reste du module s'interdit ailleurs. */
        var g = methode === 'manuel' ? (fin(H.tauxProjManuel) ? H.tauxProjManuel : NaN)
          : (a.croissances[k] && fin(a.croissances[k].value) ? a.croissances[k].value : NaN);
        var v = last;
        for (var i3 = 0; i3 < n; i3++) {
          v = fin(v) && fin(g) ? v * (1 + g) : NaN;
          vals.push(v);
        }
        if (fin(g)) ok = true;
      }
      out[k] = vals;
    });
    out.methodeTxt = methode === 'regression' ? 'Méthode retenue : prolongement de la droite des moindres carrés.'
      : methode === 'manuel' ? 'Méthode retenue : taux saisi manuellement, appliqué uniformément.'
        : 'Méthode retenue : prolongement du taux de croissance annuel moyen observé, propre à chaque grandeur.';
    return ok ? out : null;
  }

  /* ── Onglet Intermédiaire ─────────────────────────────────────── */

  function labelChampInter() { return { ca: ca(), rbe: 'Résultat brut d\'exploitation', rn: 'Résultat net' }; }

  /* Une valeur déduite (T2 = S1 − T1, par exemple) porte le même badge
     ambré que les données saisies manuellement ailleurs dans ce module :
     une seule convention visuelle pour « ceci ne vient pas tel quel de
     la source », plutôt que d'en inventer une deuxième. */
  function badgeDeduit(brut) {
    return brut ? '' : '<span class="af-badge-deduit" title="Valeur déduite par soustraction (période cumulée moins périodes déjà connues), non publiée telle quelle">déduit</span>';
  }

  function paneIntermediaire() {
    var it = S.inter;
    if (!it || !it.enough) {
      return vide('Aucune donnée intermédiaire', it && it.raison ? it.raison.charAt(0).toUpperCase() + it.raison.slice(1) + '.' : 'Aucun trimestre ni semestre publié pour ce titre.');
    }
    var html = '';

    html += groupe('Trimestres et semestres');
    html += note('Quand un cumul publié (semestre ou annuel) et une période déjà connue permettent de déduire la ' +
      'période manquante par simple soustraction, elle est calculée ici et signalée <span class="af-badge-deduit">déduit</span> ' +
      'plutôt que laissée vide. Seules les grandeurs du compte de résultat s\'y prêtent : un bilan est une photo à une ' +
      'date, pas une somme de trimestres. Cliquer un exercice affiche sa répartition par trimestre ou semestre en graphique.');
    html += '<div class="af-scroll"><table class="af-table"><thead><tr><th>Exercice</th>' +
      ['t1', 't2', 't3', 't4', 's1', 's2', 'm9', 'annuel'].map(function (p) { return '<th class="r">' + esc(it.labels[p]) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      it.annees.slice().reverse().map(function (y) {
        var v = it.champs.ca[y];
        return '<tr class="af-inter-row-click" data-af-year="' + y + '" tabindex="0" title="Cliquer pour voir la répartition par trimestre/semestre"><td>' + y + '</td>' + ['t1', 't2', 't3', 't4', 's1', 's2', 'm9', 'annuel'].map(function (p) {
          var cell = v[p];
          if (!cell) return '<td class="r af-vide">—</td>';
          return '<td class="r' + (cell.brut ? '' : ' af-saisi') + '">' + mont(cell.valeur) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    html += note('Grandeur affichée : ' + ca('min') + '. Le résultat brut d\'exploitation et le résultat net suivent la ' +
      'même reconstruction et servent aux comparaisons ci-dessous.');

    html += groupe('Comparaison à la même période l\'an dernier');
    html += note('Chaque période n\'est comparée qu\'à son équivalent exact de l\'exercice précédent — un trimestre ' +
      'contre le même trimestre, un semestre contre le même semestre, jamais l\'un contre l\'autre.');
    if (!it.comparaisons.length) {
      html += note('Aucune période récente n\'a d\'équivalent publié sur l\'exercice précédent pour établir une comparaison.');
    } else {
      it.comparaisons.forEach(function (cmp) {
        html += '<div class="af-cat">' + esc(cmp.label) + ' ' + cmp.annee + ' vs ' + esc(cmp.label) + ' ' + (cmp.annee - 1) + badgeDeduit(cmp.brut) + '</div>';
        html += '<div class="af-stats">' + FLUX_KEYS.map(function (c) {
          var f = cmp.champs[c];
          if (!f.valeur) return '';
          return st(labelChampInter()[c], mont(f.valeur.valeur),
            fin(f.croissance) ? '<span class="' + (f.croissance >= 0 ? 'af-up' : 'af-down') + '">' + pcs(f.croissance) + '</span> vs ' + or(mont(f.precedent && f.precedent.valeur), '—')
              : (f.precedent ? '' : 'aucune période équivalente l\'an dernier'));
        }).join('') + '</div>';
      });
    }

    html += groupe('Cumul depuis le début de l\'exercice');
    if (!it.ytd) {
      html += note('Aucun trimestre du dernier exercice n\'est encore déterminé : le cumul depuis le début de l\'année ne peut pas être établi.');
    } else {
      var yc = it.ytd.champs.ca;
      html += note('Cumul ' + esc(it.ytd.label) + ' ' + it.ytd.annee + ' comparé au même cumul, à date comparable, sur l\'exercice ' + it.ytd.anneePrecedente + '.');
      html += '<div class="af-val-head">' +
        '<div><div class="af-val-l">Cumul ' + esc(it.ytd.label) + ' ' + it.ytd.annee + '</div><div class="af-val-v">' + or(mont(yc.courant)) + '</div></div>' +
        '<div><div class="af-val-l">Même cumul, ' + it.ytd.anneePrecedente + '</div><div class="af-val-v af-dim">' + or(mont(yc.precedent)) + '</div></div>' +
        '<div><div class="af-val-l">Évolution</div><div class="af-val-v ' + (fin(yc.croissance) ? (yc.croissance >= 0 ? 'af-up' : 'af-down') : '') + '">' + or(pcs(yc.croissance), '—') + '</div></div>' +
        '</div>';
      html += '<div class="af-stats">' + FLUX_KEYS.filter(function (c) { return c !== 'ca'; }).map(function (c) {
        var f = it.ytd.champs[c];
        return st(labelChampInter()[c], or(mont(f.courant), '—'), fin(f.croissance) ? pcs(f.croissance) + ' vs même cumul l\'an dernier' : '');
      }).join('') + '</div>';
    }

    html += groupe('Saisonnalité de l\'activité');
    (it.incoherences || []).forEach(function (x) { html += '<div class="af-warn">' + esc(x.txt) + '</div>'; });
    var s = it.saisonnalite;
    if (!s) {
      html += note('Pas assez d\'exercices avec à la fois un détail infra-annuel et un annuel complet pour établir une saisonnalité.');
    } else {
      html += note('Part moyenne du ' + ca('min') + ' réalisée par ' + s.granularite + ', sur ' + s.exercices +
        ' exercice(s) au découpage complet et rapproché de l\'annuel. La ligne pointillée marque le partage parfaitement ' +
        'égal (' + (s.granularite === 'trimestre' ? '25 % chacun' : '50 % chacun') + ') : au-dessus, ce ' + s.granularite + ' pèse plus que sa part théorique.');
      html += saisonBars(s);
      html += '<div class="af-warn" style="' + (s.marquee ? '' : 'background:var(--af-panel-2);border-left-color:var(--af-line-strong)') + '">' + esc(s.verdict) + '</div>';
    }

    return html;
  }

  /* ── Poids des méthodes : le total reste TOUJOURS à 100 % ─────────────
     Un poids modifié à la main est compensé, au prorata, sur les autres
     méthodes actives ; désactiver une méthode reporte son poids sur les autres,
     l'activer le prélève sur elles. Sans cela, monter le PER à 60 % laissait un
     total de 145 % que le calcul renormalisait en silence : ce que l'on saisissait
     n'était pas ce qui s'appliquait. Les poids sont manipulés en pourcentages
     entiers, répartis par la méthode du plus fort reste : la somme tombe
     exactement sur 100. */
  function repartirPoids(poids, total) {
    var keys = Object.keys(poids || {});
    var vals = keys.map(function (k) { return Math.max(0, Number(poids[k]) || 0); });
    var somme = vals.reduce(function (s, v) { return s + v; }, 0);
    var out = {};
    keys.forEach(function (k) { out[k] = 0; });
    if (!somme || !(total > 0)) return out;
    var brut = vals.map(function (v) { return v / somme * total; });
    var ent = brut.map(Math.floor);
    var reste = total - ent.reduce(function (s, v) { return s + v; }, 0);
    brut.map(function (b, i) { return { i: i, f: b - ent[i] }; })
      .filter(function (o) { return vals[o.i] > 0; })
      .sort(function (a, b) { return b.f - a.f; })
      .slice(0, reste).forEach(function (o) { ent[o.i]++; });
    keys.forEach(function (k, i) { out[k] = ent[i] / 100; });
    return out;
  }

  /* Poids de départ : ceux enregistrés s'ils existent et sont exploitables, sinon ceux du secteur ; toujours ramenés à 100 %. */
  function poidsInitiaux(defauts) {
    var saved = read(LS.poids, null);
    var exploitable = saved && Object.keys(saved).some(function (k) { return Number(saved[k]) > 0; });
    return repartirPoids(exploitable ? saved : defauts, 100);
  }

  function fixerPoids(cle, pct) {
    pct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    var autres = {};
    Object.keys(S.poids).forEach(function (k) { if (k !== cle && (S.poids[k] || 0) > 0) autres[k] = S.poids[k]; });
    if (!Object.keys(autres).length) pct = 100;
    var nouveau = repartirPoids(autres, 100 - pct);
    Object.keys(S.poids).forEach(function (k) { S.poids[k] = k === cle ? pct / 100 : (nouveau[k] || 0); });
  }

  function totalPoids() {
    return Math.round(Object.keys(S.poids).reduce(function (s, k) { return s + (S.poids[k] || 0); }, 0) * 100);
  }

  var FLUX_KEYS = ['ca', 'rbe', 'rn'];

  function saisonBars(s) {
    var keys = s.granularite === 'trimestre' ? ['t1', 't2', 't3', 't4'] : ['s1', 's2'];
    var labels = { t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', s1: 'S1', s2: 'S2' };
    var baseline = s.granularite === 'trimestre' ? 0.25 : 0.5;
    var vals = keys.map(function (k) { return fin(s.parts[k]) ? s.parts[k] : 0; });
    var maxScale = Math.max(baseline * 1.4, Math.max.apply(null, vals) * 1.15, 0.01);
    var baselinePct = Math.min(96, baseline / maxScale * 100);
    return '<div class="af-season">' +
      '<div class="af-season-baseline" style="bottom:' + baselinePct + '%"></div>' +
      keys.map(function (k, i) {
        var v = s.parts[k];
        var h = fin(v) ? Math.min(100, v / maxScale * 100) : 0;
        var dominant = s.dominante === k;
        return '<div class="af-season-col">' +
          '<div class="af-season-v">' + (fin(v) ? pc(v, 0) : '—') + '</div>' +
          '<div class="af-season-track"><div class="af-season-bar' + (dominant && s.marquee ? ' af-season-dom' : '') + '" style="height:' + h + '%"></div></div>' +
          '<div class="af-season-l">' + labels[k] + '</div>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  /* ── Onglet Valorisation ──────────────────────────────────────── */

  /* Une ligne de barre horizontale, à l'échelle passée en paramètre :
     factorisée parce que la comparaison des méthodes de valorisation et
     la composition du DCF ont exactement le même besoin — une colonne de
     chiffres ne permet pas de voir d'un coup d'œil les ordres de grandeur
     relatifs. */
  function barreValeur(label, val, max, cls, off, fmt) {
    var w = Math.max(2, Math.abs(val) / max * 100);
    return '<div class="af-vbar-row' + (off ? ' af-off' : '') + '">' +
      '<div class="af-vbar-label">' + esc(label) + '</div>' +
      '<div class="af-vbar-track"><div class="af-vbar-fill ' + cls + '" style="width:' + w.toFixed(1) + '%"></div></div>' +
      '<div class="af-vbar-val">' + fmt(val) + '</div></div>';
  }

  /* Barres horizontales, toutes à la même échelle que le cours actuel :
     une colonne de chiffres ne permet pas de voir d'un coup d'œil combien
     de méthodes situent la société au-dessus ou en dessous de son cours. */
  function valuationBars(syn) {
    var cours = syn.cours;
    var lignes = syn.lignes.filter(function (l) { return fin(l.valeur) && l.valeur > 0; });
    if (!lignes.length) return '';
    var max = Math.max.apply(null, lignes.map(function (l) { return l.valeur; }).concat(fin(cours) ? [cours] : []));
    if (!max) return '';
    var html = '<div class="af-vbars">';
    if (fin(cours)) html += barreValeur('Cours actuel', cours, max, 'af-vbar-cours', false, function (v) { return n0(v) + ' FCFA'; });
    lignes.forEach(function (l) {
      var cls = fin(cours) ? (l.valeur >= cours ? 'af-vbar-up' : 'af-vbar-down') : 'af-vbar-neutre';
      html += barreValeur(METHODE_LABELS[l.cle], l.valeur, max, cls, !l.retenue, function (v) { return n0(v) + ' FCFA'; });
    });
    html += '</div>';
    return html;
  }

  /* Camembert de répartition : le tracé s'appuie sur l'astuce classique
     du cercle en pointillés (stroke-dasharray) plutôt que sur une
     bibliothèque externe, pour rester cohérent avec le reste du module. */
  function chartDonut(segments) {
    var total = segments.reduce(function (s, x) { return s + (fin(x.value) && x.value > 0 ? x.value : 0); }, 0);
    if (!total) return '';
    var R = 42, CX = 54, CY = 54, EP = 20, C = 2 * Math.PI * R;
    var offset = 0;
    var arcs = segments.map(function (seg) {
      var v = fin(seg.value) && seg.value > 0 ? seg.value : 0;
      var frac = v / total;
      var len = frac * C;
      var arc = v > 0 ? '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="none" stroke="' + seg.color + '" stroke-width="' + EP +
        '" stroke-dasharray="' + len.toFixed(1) + ' ' + (C - len).toFixed(1) + '" stroke-dashoffset="' + (-offset).toFixed(1) + '">' +
        '<title>' + esc(seg.label) + ' · ' + (frac * 100).toFixed(0) + ' %</title></circle>' : '';
      offset += len;
      return arc;
    }).join('');
    return '<svg viewBox="0 0 108 108" class="af-donut" role="img" aria-label="Répartition des poids par méthode">' +
      '<g transform="rotate(-90 ' + CX + ' ' + CY + ')">' + arcs + '</g></svg>';
  }

  /* Composition visuelle de la valeur d'entreprise : chaque flux annuel
     actualisé, puis la valeur terminale actualisée — pour voir d'un coup
     d'œil la part que représente chacun, plutôt que de la déduire du
     pourcentage isolé affiché dans le tableau. */
  function dcfBars(D) {
    var rows = D.flux.map(function (f) { return { label: 'Flux actualisé — année ' + f.annee, val: f.actualise }; });
    rows.push({ label: 'Valeur terminale actualisée', val: D.valeurTerminaleActualisee, accent: true });
    var vals = rows.map(function (r) { return r.val; }).filter(fin);
    if (!vals.length) return '';
    var max = Math.max.apply(null, vals.map(Math.abs));
    if (!max) return '';
    var html = '<div class="af-vbars">' + rows.map(function (r) {
      return barreValeur(r.label, r.val, max, r.accent ? 'af-vbar-cours' : 'af-vbar-neutre', false, mont);
    }).join('') + '</div>';
    return html;
  }

  function paneValorisation() {
    var H = S.hypotheses, R = S.resultats, w = S.wacc, a = S.analyse;
    if (!R) return vide('Valorisation indisponible', 'Les hypothèses n\'ont pas pu être établies.');
    var html = '';

    html += groupe('Coût du capital', 'wacc');
    html += '<div class="af-form">' +
      champ('Taux sans risque', 'pct', 'tauxSansRisque', H.tauxSansRisque) +
      champ('Prime de risque du marché', 'pct', 'primeMarche', H.primeMarche) +
      champ('Beta', 'num', 'beta', H.beta) +
      champ('Prime de taille', 'pct', 'primeTaille', H.primeTaille) +
      champ('Prime d\'illiquidité', 'pct', 'primeLiquidite', H.primeLiquidite) +
      champ('Coût de la dette', 'pct', 'coutDette', H.coutDette) +
      champ('Taux d\'impôt', 'pct', 'tauxImpot', H.tauxImpot) +
      champ('Taux d\'actualisation imposé', 'pct', 'tauxManuel', H.tauxManuel, null, 'laisser vide pour utiliser le calcul ci-dessus') +
      '</div>';
    html += '<div class="af-wacc">' +
      '<div><span>Coût des fonds propres</span><strong>' + pc(w.coutFondsPropres, 2) + '</strong></div>' +
      '<div><span>Coût de la dette après impôt</span><strong>' + pc(w.coutDetteNet, 2) + '</strong></div>' +
      '<div><span>Pondération</span><strong>' + pc(w.poidsCp, 0) + ' / ' + pc(w.poidsDette, 0) + '</strong></div>' +
      '<div class="af-wacc-r"><span>Taux retenu</span><strong>' + pc(R.taux, 2) + '</strong></div>' +
      '</div>';
    if (fin(H.tauxManuel)) html += note('Un taux a été imposé manuellement : le calcul détaillé ci-dessus est conservé pour information mais n\'est pas utilisé.');

    html += groupe('Actualisation des flux', 'dcf');
    html += '<div class="af-form">' +
      champ('Flux de départ', 'mont', 'fcfDepart', H.fcfDepart, null,
        'flux normatif, moyenne des trois derniers exercices : ' + or(mont(H.fcfNormatif), '—')) +
      champ('Croissance de la première année', 'pct', 'croissance', H.croissance) +
      champ('Croissance perpétuelle', 'pct', 'croissancePerpetuelle', H.croissancePerpetuelle) +
      champ('Horizon de projection', 'int', 'annees', H.annees) +
      champ('Dette nette', 'mont', 'detteNette', H.detteNette) +
      '</div>';

    var D = R.dcf;
    if (!D.ok) {
      html += '<div class="af-warn"><strong>Le calcul n\'aboutit pas.</strong><br>' +
        D.erreurs.map(esc).join('<br>') + '</div>';
    } else {
      html += '<div class="af-scroll"><table class="af-table"><thead><tr>' +
        '<th>Exercice</th><th class="r">Croissance</th><th class="r">Flux projeté</th>' +
        '<th class="r">Facteur</th><th class="r">Flux actualisé</th></tr></thead><tbody>' +
        D.flux.map(function (f) {
          return '<tr><td>Année ' + f.annee + '</td><td class="r">' + pc(f.croissance) + '</td>' +
            '<td class="r">' + mont(f.flux) + '</td><td class="r">' + n2(f.facteur, 3) + '</td>' +
            '<td class="r">' + mont(f.actualise) + '</td></tr>';
        }).join('') +
        '<tr class="af-gras"><td colspan="4">Somme des flux actualisés</td><td class="r">' + mont(D.sommeActualisee) + '</td></tr>' +
        '<tr><td colspan="4">Valeur terminale' + memo('valeur-terminale') + ' — ' + esc(D.methodeTerminale) + '</td><td class="r">' + mont(D.valeurTerminale) + '</td></tr>' +
        '<tr><td colspan="4">Valeur terminale actualisée <span class="af-dim">(' + pc(D.partTerminale, 0) + ' du total)</span></td><td class="r">' + mont(D.valeurTerminaleActualisee) + '</td></tr>' +
        '<tr class="af-gras"><td colspan="4">Valeur d\'entreprise</td><td class="r">' + mont(D.valeurEntreprise) + '</td></tr>' +
        '<tr><td colspan="4">Dette nette' + memo('dette-nette') + '</td><td class="r">− ' + mont(D.detteNette) + '</td></tr>' +
        '<tr class="af-gras"><td colspan="4">Valeur des fonds propres</td><td class="r">' + mont(D.valeurFondsPropres) + '</td></tr>' +
        '<tr class="af-total"><td colspan="4">Valeur par action</td><td class="r">' + n0(D.parAction) + ' FCFA</td></tr>' +
        '</tbody></table></div>';
      var dbars = dcfBars(D);
      if (dbars) {
        html += note('Composition de la valeur d\'entreprise : chaque flux actualisé, à la même échelle que la valeur ' +
          'terminale actualisée (en or) — souvent la part la plus importante, ce que le tableau ci-dessus indique déjà ' +
          'en pourcentage.');
        html += dbars;
      }
      D.reserves.forEach(function (r) { html += '<div class="af-warn">' + esc(r) + '</div>'; });
    }

    if (R.inverse && R.inverse.ok) {
      html += groupe('Ce que le cours suppose déjà', 'dcf-inverse');
      html += '<div class="af-stats">' +
        st(R.inverse.enButee ? 'Croissance implicite (plancher)' : 'Croissance implicite', pcs(R.inverse.croissanceImplicite), 'que le cours actuel intègre') +
        st('Croissance réalisée', or(pcs(R.inverse.croissanceHistorique)), 'sur l\'historique disponible') +
        '</div>' + note(esc(R.inverse.lecture));
      if (R.inverse.enButee) html += '<div class="af-warn">La recherche n\'a pas convergé dans l\'intervalle exploré (−30 % à +60 % par an) : ce chiffre est une borne, pas une valeur précise.</div>';
    }

    html += groupe('Actualisation des dividendes', 'gordon');
    html += '<div class="af-form">' +
      champ('Dividende de référence', 'num', 'dividende', H.dividende) +
      champ('Croissance du dividende', 'pct', 'croissanceDividende', H.croissanceDividende) +
      champ('Rendement exigé', 'pct', 'rendementExige', H.rendementExige, null,
        'par défaut le coût des fonds propres : ' + pc(w.coutFondsPropres, 2)) +
      '</div>';
    if (R.ddm.ok) {
      html += '<div class="af-methode"><span>Gordon-Shapiro</span><strong>' + n0(R.ddm.valeur) + ' FCFA</strong></div>';
      if (R.ddm.deuxPhases && R.ddm.deuxPhases.ok) {
        html += '<div class="af-methode"><span>Deux phases</span><strong>' + n0(R.ddm.deuxPhases.valeur) + ' FCFA</strong></div>';
      }
    } else {
      html += '<div class="af-warn">' + R.ddm.erreurs.map(esc).join('<br>') + '</div>';
    }

    html += groupe('Dividende / rendement de marché');
    html += note('Cible plus simple que le Gordon-Shapiro : le dividende de référence rapporté au rendement médian de ' +
      '<strong>l\'ensemble du marché</strong> (toutes valeurs BRVM suivies, pas seulement les pairs du secteur), sans ' +
      'hypothèse de croissance ni de coût du capital. Sert de recoupement, pas de remplacement.');
    if (pos(R.dyMarche.valeur)) {
      html += '<div class="af-methode"><span>Dividende ' + or(n0(R.dyMarche.dpaRef), '—') + ' FCFA ÷ rendement marché ' +
        or(pc(R.dyMarche.rendementMarche, 2), '—') + '</span><strong>' + n0(R.dyMarche.valeur) + ' FCFA</strong></div>';
    } else {
      html += '<div class="af-warn">' + (!pos(R.dyMarche.dpaRef) ? 'Aucun dividende connu, même historique, pour ce titre.' : 'Rendement médian du marché indisponible.') + '</div>';
    }

    html += groupe('Multiples de comparables', 'per');
    html += porteeToggle();
    var med = S.comparables ? S.comparables.medianes : {};
    var statLbl = S.comparablesStat === 'moyenne' ? 'moyenne' : 'médiane';
    html += S.comparables ? porteeNote(S.comparables) : note('Aucun comparable disponible pour calculer une ' + statLbl + '.');
    html += note('Les multiples de référence sont par défaut la ' + statLbl + ' du groupe de pairs ci-dessus, pairs ' +
      'exclus et statistique choisis dans l\'onglet Comparables. Vous pouvez leur substituer vos propres multiples.');
    html += '<div class="af-form">' +
      champ('Cours sur bénéfice', 'num', 'perRef', fin(H.perRef) ? H.perRef : med.per, null, statLbl + ' : ' + or(n2(med.per), '—')) +
      champ('Cours sur actif net', 'num', 'pbrRef', fin(H.pbrRef) ? H.pbrRef : med.pbr, null, statLbl + ' : ' + or(n2(med.pbr), '—')) +
      champ('Cours sur ' + ca('min'), 'num', 'psrRef', fin(H.psrRef) ? H.psrRef : med.psr, null, statLbl + ' : ' + or(n2(med.psr), '—')) +
      champ('Valeur d\'entreprise sur excédent brut', 'num', 'evEbitdaRef', fin(H.evEbitdaRef) ? H.evEbitdaRef : med.evEbitda, null, statLbl + ' : ' + or(n2(med.evEbitda), '—')) +
      champ('Cours sur flux libre', 'num', 'pfcfRef', H.pfcfRef) +
      '</div>';
    html += '<div class="af-scroll"><table class="af-table"><thead><tr><th>Méthode</th><th class="r">Multiple</th>' +
      '<th class="r">Base par action</th><th class="r">Valeur</th></tr></thead><tbody>' +
      R.multiples.lignes.map(function (l) {
        return '<tr' + (l.utilisable ? '' : ' class="af-off"') + '><td>' + esc(l.libelle) + '</td>' +
          '<td class="r">' + or(n2(l.multiple), '—') + '</td>' +
          '<td class="r">' + or(n0(l.base), '—') + '</td>' +
          '<td class="r">' + (l.utilisable ? n0(l.valeur) + ' FCFA' : '<span class="af-nd">' + esc(l.note) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    html += groupe('Valeur comptable et autres méthodes');
    html += note('L\'actif net par action est ici retenu <strong>tel quel</strong> comme valeur cible — un P/B de 1×, ' +
      'plus prudent que le PBR ci-dessus qui applique le multiple que le marché accorde aux pairs. C\'est une méthode ' +
      'à part entière, pas une variante du PBR : elle ne suppose aucune prime ni décote sur les fonds propres.');
    html += '<div class="af-methode"><span>Actif net par action (VCPA)</span><strong>' +
      (pos(R.vcpaDirect) ? n0(R.vcpaDirect) + ' FCFA' : '<span class="af-nd">non calculable</span>') + '</strong></div>';

    html += note('Le revenu résiduel réutilise la croissance perpétuelle fixée ci-dessus pour l\'actualisation des flux ' +
      '(pas la croissance de départ, économiquement intenable à l\'infini) et suppose, sauf indication contraire, que ' +
      'la société continue à distribuer le même taux de son bénéfice que par le passé plutôt que 0 %.');
    html += '<div class="af-form">' +
      champ('Taux de distribution retenu (projection)', 'pct', 'payoutRef', H.payoutRef, null,
        'par défaut la moyenne historique : ' + or(pc(a.moyennes.payout, 0), '0 % (aucun historique)')) +
      '</div>';
    html += '<div class="af-methode"><span>Revenu résiduel' + memo('revenu-residuel') + '</span><strong>' +
      (R.residuel.ok ? n0(R.residuel.valeur) + ' FCFA' : '<span class="af-nd">' + esc(R.residuel.raison) + '</span>') + '</strong></div>';
    if (R.residuel.ok) html += note('Taux de distribution retenu pour la projection : ' + pc(R.residuel.payoutRetenu, 0) + '. Croissance perpétuelle : ' + pc(R.residuel.croissancePerpetuelle, 1) + '.');
    html += '<div class="af-methode"><span>Nombre de Graham' + memo('graham') + '</span><strong>' +
      (R.graham.ok ? n0(R.graham.valeur) + ' FCFA' : '<span class="af-nd">' + esc(R.graham.raison) + '</span>') + '</strong></div>';

    var syn = R.synthese;
    html += groupe('Valeur cible pondérée', 'dcf');
    var contribs = syn.lignes.filter(function (l) { return l.retenue; });
    html += '<div class="af-cible-hero">' +
      '<div class="af-cible-main"><div class="af-cible-l">Valeur cible pondérée</div><div class="af-cible-v">' +
        (fin(syn.valeur) ? n0(syn.valeur) : '<span class="af-nd">non calculable</span>') + (fin(syn.valeur) ? ' <small>FCFA</small>' : '') + '</div></div>' +
      '<div class="af-cible-side">' +
        '<div class="af-cible-item"><span>Cours actuel</span><strong class="af-dim">' + or(n0(syn.cours), '—') + '</strong></div>' +
        '<div class="af-cible-item"><span>Potentiel</span><strong class="' + (fin(syn.potentiel) ? (syn.potentiel >= 0 ? 'af-up' : 'af-down') : '') + '">' + or(pcs(syn.potentiel), '—') + '</strong></div>' +
        '<div class="af-cible-item"><span>Méthodes retenues</span><strong>' + syn.retenues + ' / ' + syn.lignes.length + '</strong></div>' +
      '</div>' +
      (contribs.length ? '<div class="af-cible-donut-row">' +
        chartDonut(contribs.map(function (l, i) { return { label: METHODE_LABELS[l.cle], value: l.poidsEffectif, color: METHODE_COULEURS[i % METHODE_COULEURS.length] }; })) +
        '<div class="af-cible-legend">' + contribs.map(function (l, i) {
          return '<span><i style="background:' + METHODE_COULEURS[i % METHODE_COULEURS.length] + '"></i>' + esc(METHODE_LABELS[l.cle]) + ' · ' + pc(l.poidsEffectif, 0) + '</span>';
        }).join('') + '</div>' +
      '</div>' : '') +
      '</div>';
    if (syn.fourchette && contribs.length > 1) {
      html += note('Fourchette des ' + syn.retenues + ' méthodes retenues : <strong>' + n0(syn.fourchette.bas) + '</strong> à <strong>' + n0(syn.fourchette.haut) + '</strong> FCFA.');
    }
    if (syn.avertissement) html += '<div class="af-warn">' + esc(syn.avertissement) + '</div>';

    var vbars = valuationBars(syn);
    if (vbars) {
      html += groupe('Comparaison visuelle des méthodes', 'dcf');
      html += note('Chaque barre est la valeur par action obtenue par une méthode, à la même échelle que le cours ' +
        'actuel (en or). En <span class="af-up">vert</span>, les méthodes au-dessus du cours ; en <span class="af-down">rouge</span>, ' +
        'celles en dessous. Les méthodes désactivées apparaissent grisées.');
      html += vbars;
    }

    html += groupe('Pondération par méthode');
    html += note((V.estFinancier(a.data.secteur || a.data.sousSecteur)
      ? 'Établissement financier : les poids de départ favorisent le revenu résiduel, les dividendes et le PBR plutôt ' +
        'que le DCF classique, dont le flux de trésorerie disponible n\'a pas de sens économique pour une banque ou un assureur.'
      : 'Les méthodes ne se valent pas selon les sociétés. Sur une valeur de rendement, privilégiez l\'actualisation ' +
        'des dividendes ; sur une société de croissance, le DCF.') +
      ' Chaque multiple de comparables se pondère individuellement, et le total reste toujours à 100 % : ce que vous ' +
      'ajoutez à une méthode (jusqu\'à 100 %) est retiré, au prorata, aux autres. L\'interrupteur active ou désactive une méthode : ' +
      'décochée, elle sort du calcul, son poids est reporté sur les autres, et sa valeur reste affichée à titre de repère.');
    METHODE_GROUPES.forEach(function (grp) {
      html += '<div class="af-poids-groupe"><div class="af-poids-groupe-t">' + esc(grp.titre) + '</div>';
      grp.cles.forEach(function (k) {
        var ligne = syn.lignes.filter(function (l) { return l.cle === k; })[0];
        var actif = (S.poids[k] || 0) > 0;
        var pctVal = Math.round((S.poids[k] || 0) * 100);
        var valTxt = ligne && fin(ligne.valeur) ? n0(ligne.valeur) + ' FCFA' : '<span class="af-nd">non calculable</span>';
        html += '<div class="af-poids-row' + (ligne && ligne.retenue ? '' : ' af-off') + '">' +
          '<label class="af-poids-toggle-wrap" title="' + (actif ? 'Désactiver' : 'Activer') + ' cette méthode">' +
            '<input type="checkbox" class="af-poids-toggle" data-poids-on="' + k + '"' + (actif ? ' checked' : '') + ' aria-label="Activer ' + esc(METHODE_LABELS[k]) + '">' +
            '<span class="af-poids-toggle-track"></span>' +
          '</label>' +
          '<div class="af-poids-label">' + esc(METHODE_LABELS[k]) + '</div>' +
          '<input type="range" class="af-poids-slider" min="0" max="100" step="1" data-poids="' + k + '" value="' + pctVal + '"' + (actif ? '' : ' disabled') + ' aria-label="Poids ' + esc(METHODE_LABELS[k]) + '">' +
          '<div class="af-poids-pct"><input type="number" min="0" max="100" step="1" data-poids="' + k + '" value="' + pctVal + '"' + (actif ? '' : ' disabled') + '><span>%</span></div>' +
          '<div class="af-poids-val">' + valTxt + '</div>' +
          '</div>';
      });
      html += '</div>';
    });
    var totalSaisi = totalPoids();
    var poidsNonCalculables = syn.lignes.filter(function (l) { return l.poids > 0 && !l.retenue; }).reduce(function (s, l) { return s + l.poids; }, 0);
    html += '<div class="af-poids-total ' + (totalSaisi === 100 ? 'af-up' : 'af-down') + '">Total des poids : <strong>' + totalSaisi + ' %</strong>' +
      (totalSaisi === 100 ? ' — réparti à 100 %' : ' — anormal, rétablissez les poids par défaut') + '</div>';
    if (poidsNonCalculables > 0.0001) {
      html += note(Math.round(poidsNonCalculables * 100) + ' % du poids porte sur des méthodes non calculables pour cette société : il est reporté au ' +
        'prorata sur les méthodes retenues (colonne « Poids effectif » ci-dessous), de sorte que la valeur retenue reste bien une moyenne pondérée à 100 %.');
    }
    html += '<button type="button" class="af-lien" id="afResetPoids">Rétablir les poids par défaut du secteur</button>';

    html += groupe('Détail des méthodes');
    html += '<div class="af-scroll"><table class="af-table"><thead><tr><th>Méthode</th><th class="r">Valeur</th>' +
      '<th class="r">Poids saisi</th><th class="r">Poids effectif</th></tr></thead><tbody>' +
      syn.lignes.map(function (l) {
        return '<tr' + (l.retenue ? '' : ' class="af-off"') + '><td>' + esc(METHODE_LABELS[l.cle]) + '</td>' +
          '<td class="r">' + (l.retenue ? n0(l.valeur) + ' FCFA' : '<span class="af-nd">écartée</span>') + '</td>' +
          '<td class="r">' + pc(l.poids, 0) + '</td>' +
          '<td class="r">' + (l.retenue ? pc(l.poidsEffectif, 0) : '—') + '</td></tr>';
      }).join('') +
      '<tr class="af-total"><td>Total</td><td class="r"></td><td class="r">' + totalPoids() + ' %</td><td class="r">' + (syn.retenues ? '100 %' : '—') + '</td></tr>' +
      (fin(syn.valeur) ? '<tr class="af-total"><td>Valeur retenue</td><td class="r">' + n0(syn.valeur) + ' FCFA</td>' +
        '<td class="r"></td><td class="r">' + or(pcs(syn.potentiel), '—') + '</td></tr>' : '') +
      '</tbody></table></div>';

    html += '<div class="af-actions">' +
      '<button type="button" class="af-btn" id="afReset">Rétablir les hypothèses d\'origine</button>' +
      '<button type="button" class="af-btn" id="afRapport">Exporter le rapport</button>' +
      '<button type="button" class="af-btn" id="afCsv">Exporter les données</button>' +
      '</div>';
    return html;
  }

  /* ── Onglet Sensibilité ───────────────────────────────────────── */

  function paneSensibilite() {
    var R = S.resultats;
    if (!R || !R.dcf.ok) return vide('Sensibilité indisponible', 'Le calcul des flux actualisés doit d\'abord aboutir.');
    var s = R.sensibilite;
    var ref = R.dcf.parAction;
    var cours = S.analyse.data.price;

    var html = groupe('Matrice de sensibilité');
    html += note('Valeur par action selon le taux d\'actualisation (en lignes) et la croissance perpétuelle (en colonnes). ' +
      'C\'est le tableau le plus utile de toute la valorisation : il montre à quel point le résultat dépend de deux ' +
      'hypothèses que personne ne peut observer.');
    html += '<div class="af-scroll"><table class="af-table af-matrice"><thead><tr><th>Taux \\ croissance</th>' +
      s.croissances.map(function (g) { return '<th class="r">' + pc(g) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      s.grille.map(function (ligne, i) {
        return '<tr><th>' + pc(s.taux[i]) + '</th>' + ligne.map(function (c) {
          if (c.invalide || !fin(c.valeur)) return '<td class="r af-vide">—</td>';
          var cls = pos(cours) ? (c.valeur > cours * 1.15 ? 'af-cell-bon' : c.valeur < cours * 0.85 ? 'af-cell-mauvais' : 'af-cell-neutre') : '';
          var isRef = Math.abs(c.valeur - ref) < 1;
          return '<td class="r ' + cls + (isRef ? ' af-cell-ref' : '') + '">' + n0(c.valeur) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    html += note('La cellule encadrée correspond aux hypothèses retenues. Les cellules vertes valorisent le titre plus de ' +
      '15 % au-dessus du cours, les rouges plus de 15 % en dessous. Sur cette matrice, la valeur va de <strong>' +
      n0(s.min) + '</strong> à <strong>' + n0(s.max) + '</strong> FCFA, soit un écart de <strong>' + pc(s.etendue, 0) +
      '</strong>. Toute valorisation qui ne s\'accompagne pas de cet ordre de grandeur est incomplète.');

    if (R.scenarios) {
      html += groupe('Scénarios');
      html += note('Un investisseur décide en fonction de ce qu\'il perd dans le mauvais cas, pas de ce qu\'il gagne dans le bon.');
      html += '<div class="af-scenarios">' + R.scenarios.map(function (sc) {
        return '<div class="af-scenario af-sc-' + sc.cle + '">' +
          '<div class="af-sc-t">' + esc(sc.nom) + '</div>' +
          '<div class="af-sc-v">' + (sc.ok ? n0(sc.valeur) + ' <small>FCFA</small>' : '<span class="af-nd">non calculable</span>') + '</div>' +
          '<div class="af-sc-p ' + (sc.ok && sc.potentiel >= 0 ? 'af-up' : 'af-down') + '">' + (sc.ok ? or(pcs(sc.potentiel), '') : '') + '</div>' +
          '<div class="af-sc-n">' + esc(sc.note) + '</div>' +
          '<div class="af-sc-h">croissance ' + pc(sc.hypotheses.croissance) + ' · taux ' + pc(sc.hypotheses.taux) +
          ' · perpétuelle ' + pc(sc.hypotheses.croissancePerpetuelle) + '</div>' +
          '</div>';
      }).join('') + '</div>';
    }
    return html;
  }

  /* ── Onglet Comparables ───────────────────────────────────────── */

  function paneComparables() {
    var cmp = S.comparables;
    var html = groupe('Comparaison') + porteeToggle();
    if (!cmp || !cmp.pairs.length) {
      html += note('Aucune autre société de cette portée ne dispose d\'états financiers exploitables. Essayez une portée plus large.');
      return html;
    }
    var base = S.analyse;
    var statLabel = S.comparablesStat === 'moyenne' ? 'Moyenne' : 'Médiane';

    var cols = [
      ['per', 'PER', 'n2', 'per'], ['pbr', 'PBR', 'n2', 'pbr'], ['psr', 'PSR', 'n2'],
      ['evEbitda', 'EV/EBE', 'n2', 'ev-ebitda'], ['roe', 'ROE', 'pc', 'roe'],
      ['margeNette', 'Marge nette', 'pc', 'marge-nette'], ['gearing', 'Levier', 'n2', 'gearing'],
      ['rendement', 'Rendement', 'pc2', 'rendement']
    ];

    html += porteeNote(cmp);
    html += groupe('Statistique et pairs retenus');
    html += note('Un pair dont le bénéfice est tombé presque à zéro produit un PER ou un PBR sans signification ' +
      'économique — à décocher au cas par cas plutôt qu\'à subir dans la moyenne ou la médiane du groupe. La médiane ' +
      'reste la statistique recommandée (peu sensible à une valeur extrême isolée) ; la moyenne reste disponible pour ' +
      'qui la préfère.');
    html += statToggle();
    var exclusIci = cmp.pairs.filter(function (a) { return S.comparablesExclus.indexOf(a.data.ticker) >= 0; }).map(function (a) { return a.data.ticker; });
    if (exclusIci.length) {
      html += note(exclusIci.length + ' pair(s) exclu(s) du calcul ici : ' + esc(exclusIci.join(', ')) +
        '. <button type="button" class="af-lien" id="afReinitExclus">Rétablir tous les pairs</button>');
    }
    html += note('Comparaison au dernier exercice publié de chaque société. Les sociétés n\'ayant pas publié la même ' +
      'année, les écarts de calendrier peuvent expliquer une partie des différences.');
    html += '<div class="af-scroll"><table class="af-table af-comp"><thead><tr><th></th><th>Titre</th>' +
      cols.map(function (c) { return '<th class="r">' + c[1] + (c[3] ? memo(c[3]) : '') + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      '<tr class="af-moi"><td></td><td><strong>' + esc(base.data.ticker) + '</strong><small>' + esc(base.data.nom || '') + ' (ce titre)</small></td>' +
      cols.map(function (c) {
        var v = base.dernier[c[0]];
        var txt = !fin(v) ? '—' : c[2] === 'pc' ? pc(v) : c[2] === 'pc2' ? pc(v, 2) : n2(v);
        return '<td class="r">' + txt + '</td>';
      }).join('') + '</tr>' +
      cmp.pairs.map(function (a) {
        var r = a.dernier;
        var tick = a.data.ticker;
        var exclu = S.comparablesExclus.indexOf(tick) >= 0;
        return '<tr' + (exclu ? ' class="af-off"' : '') + '>' +
          '<td><input type="checkbox" data-afexclu="' + esc(tick) + '"' + (exclu ? '' : ' checked') + ' aria-label="Inclure ' + esc(tick) + ' dans le calcul" title="Inclure ou exclure ce pair du calcul"></td>' +
          '<td data-afgoto="' + esc(tick) + '" style="cursor:pointer"><strong>' + esc(tick) + '</strong><small>' + esc(a.data.nom || '') + '</small></td>' +
          cols.map(function (c) {
            var v = r[c[0]];
            var txt = !fin(v) ? '—' : c[2] === 'pc' ? pc(v) : c[2] === 'pc2' ? pc(v, 2) : n2(v);
            return '<td class="r">' + txt + '</td>';
          }).join('') + '</tr>';
      }).join('') +
      '<tr class="af-mediane"><td></td><td>' + statLabel + ' des ' + cmp.pairsRetenus.length + ' pair(s) retenu(s)</td>' +
      cols.map(function (c) {
        var v = cmp.medianes[c[0]];
        var txt = !fin(v) ? '—' : c[2] === 'pc' ? pc(v) : c[2] === 'pc2' ? pc(v, 2) : n2(v);
        return '<td class="r">' + txt + '</td>';
      }).join('') + '</tr>' +
      '</tbody></table></div>';

    html += groupe('Valeur cible par les multiples du groupe de pairs');
    html += note('Équation à l\'inconnue : le multiple (' + statLabel.toLowerCase() + ' des pairs retenus ci-dessus, le ' +
      'fait observé) est appliqué à la grandeur par action de la société (le fait publié) pour déduire le cours ' +
      'qu\'impliquerait un alignement sur ses pairs.');
    var exd = base.dernierExercice, drn = base.dernier;
    var dn = fin(drn.detteNette) ? drn.detteNette : 0, actions = base.data.shares;
    /* Quatre multiples, pas seulement PER et PBR : chacun raconte une
       histoire différente (rentabilité, actif, chiffre d'affaires, cash
       operationnel avant amortissements), et les passer sous silence
       laisserait croire que seuls deux d'entre eux se prêtent à l'exercice. */
    var cibles = [
      { l: 'PER × BPA', m: cmp.medianes.per, base: exd.bpa, cle: 'per',
        calc: function () { return fin(this.m) && fin(this.base) && this.base > 0 ? this.m * this.base : NaN; } },
      { l: 'PBR × actif net par action', m: cmp.medianes.pbr, base: drn.anpa, cle: 'pbr',
        calc: function () { return fin(this.m) && fin(this.base) && this.base > 0 ? this.m * this.base : NaN; } },
      { l: 'PSR × ' + ca('min') + ' par action', m: cmp.medianes.psr, base: drn.capa, cle: 'psr',
        calc: function () { return fin(this.m) && fin(this.base) && this.base > 0 ? this.m * this.base : NaN; } },
      { l: 'VE/EBE appliqué au résultat brut', m: cmp.medianes.evEbitda, base: exd.rbe, cle: 'evEbitda',
        calc: function () { return fin(this.m) && fin(this.base) && this.base > 0 && pos(actions) ? (this.m * this.base - dn) / actions : NaN; } }
    ];
    cibles.forEach(function (c) { c.valeur = c.calc(); });
    html += '<div class="af-scroll"><table class="af-table"><thead><tr><th>Méthode</th>' +
      '<th class="r">Multiple (' + statLabel.toLowerCase() + ')</th><th class="r">Grandeur par action</th><th class="r">Valeur cible</th><th class="r">Potentiel</th></tr></thead><tbody>' +
      cibles.map(function (c) {
        var pot = fin(c.valeur) && pos(base.data.price) ? c.valeur / base.data.price - 1 : NaN;
        return '<tr><td>' + esc(c.l) + '</td><td class="r">' + or(n2(c.m), '—') + '</td>' +
          '<td class="r">' + or(n0(c.base), '—') + '</td>' +
          '<td class="r">' + (fin(c.valeur) ? n0(c.valeur) + ' FCFA' : '<span class="af-nd">non calculable</span>') + '</td>' +
          '<td class="r ' + (fin(pot) ? (pot >= 0 ? 'af-up' : 'af-down') : '') + '">' + or(pcs(pot), '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    html += note('Valeurs reportées automatiquement comme multiples de référence par défaut dans l\'onglet Valorisation ' +
      '(section « Multiples de comparables »), où elles peuvent être remplacées par vos propres hypothèses.');
    var cibleValides = cibles.filter(function (c) { return fin(c.valeur) && c.valeur > 0; });
    if (cibleValides.length) {
      var maxCible = Math.max.apply(null, cibleValides.map(function (c) { return c.valeur; }).concat(pos(base.data.price) ? [base.data.price] : []));
      html += '<div class="af-vbars">';
      if (pos(base.data.price)) html += barreValeur('Cours actuel', base.data.price, maxCible, 'af-vbar-cours', false, function (v) { return n0(v) + ' FCFA'; });
      cibleValides.forEach(function (c) {
        var cls = pos(base.data.price) ? (c.valeur >= base.data.price ? 'af-vbar-up' : 'af-vbar-down') : 'af-vbar-neutre';
        html += barreValeur(c.l, c.valeur, maxCible, cls, false, function (v) { return n0(v) + ' FCFA'; });
      });
      html += '</div>';
    }

    html += groupe('Position relative');
    var r = base.dernier;
    html += '<div class="af-stats">' + cols.map(function (c) {
      var v = r[c[0]], m = cmp.medianes[c[0]];
      if (!fin(v) || !fin(m) || m === 0) return '';
      var ecart = v / m - 1;
      var inverse = ['per', 'pbr', 'psr', 'evEbitda', 'gearing'].indexOf(c[0]) >= 0;
      return st(c[1], pcs(ecart, 0), inverse
        ? (ecart > 0 ? 'plus cher que la ' + statLabel.toLowerCase() : 'moins cher que la ' + statLabel.toLowerCase())
        : (ecart > 0 ? 'au-dessus de la ' + statLabel.toLowerCase() : 'en dessous de la ' + statLabel.toLowerCase()));
    }).join('') + '</div>';
    html += note('Un multiple inférieur à la ' + statLabel.toLowerCase() + ' n\'est pas en soi une occasion : il peut ' +
      'refléter une rentabilité plus faible ou un risque plus élevé. Croisez systématiquement les multiples avec le ROE et le levier.');
    return html;
  }

  /* ── Onglet Qualité ───────────────────────────────────────────── */

  function paneQualite() {
    var a = S.analyse, q = a.qualite, p = a.piotroski;
    var html = '';

    if (q.enough) {
      html += groupe('Score de qualité');
      html += note('Grille de lecture assumée, contestable pilier par pilier. Chaque note est décomposée ci-dessous ' +
        'pour que vous puissiez juger de sa pertinence plutôt que d\'accepter un chiffre.');
      html += q.piliers.map(function (pl) {
        var w = fin(pl.note) ? pl.note / pl.sur * 100 : 0;
        return '<div class="af-qpilier">' +
          '<div class="af-qp-head"><span>' + esc(pl.nom) + '</span>' +
          '<strong>' + (fin(pl.note) ? Math.round(pl.note) + ' / ' + pl.sur : '<span class="af-nd">non noté</span>') + '</strong></div>' +
          '<div class="af-bar"><div style="width:' + w + '%"></div></div>' +
          '<div class="af-qp-m">' + esc(pl.motif) + '</div>' +
          (pl.details.length ? '<div class="af-qp-d">' + pl.details.map(function (d) {
            return '<span>' + esc(d.l) + ' <strong>' + (fin(d.n) ? Math.round(d.n) + '/' + d.sur : '—') + '</strong></span>';
          }).join('') + '</div>' : '') +
          '</div>';
      }).join('');
      if (q.pilliersManquants.length) {
        html += note('Piliers non notés faute de données : ' + q.pilliersManquants.map(esc).join(', ') + '. ' +
          'La note globale est ramenée aux seuls piliers évaluables.');
      }
    }

    html += groupe('Score de Piotroski', 'piotroski');
    if (!p.enough) {
      html += '<div class="af-warn">' + esc(p.raison || 'Trop peu de tests évaluables.') + '</div>';
    } else {
      html += '<div class="af-piotro"><div class="af-piotro-n">' + p.score + '<small>/' + p.sur + '</small></div>' +
        '<div><div class="af-piotro-l">' + esc(p.lecture.charAt(0).toUpperCase() + p.lecture.slice(1)) + '</div>' +
        '<div class="af-piotro-s">Comparaison des exercices ' + p.exercices[0] + ' et ' + p.exercices[1] + '.</div></div></div>';
      var grp = {};
      p.tests.forEach(function (t) { (grp[t.groupe] = grp[t.groupe] || []).push(t); });
      Object.keys(grp).forEach(function (g) {
        html += '<div class="af-cat">' + esc(g) + '</div>';
        grp[g].forEach(function (t) {
          html += '<div class="af-test af-test-' + (!t.evaluable ? 'na' : t.reussi ? 'ok' : 'ko') + '">' +
            '<span class="af-test-i">' + (!t.evaluable ? '·' : t.reussi ? '✓' : '✗') + '</span>' +
            '<span class="af-test-l">' + esc(t.libelle) + '</span>' +
            '<span class="af-test-d">' + esc(t.detail) + '</span></div>';
        });
      });
      if (p.manquants.length) {
        html += note('Le score original compte neuf tests. Ici ' + p.sur + ' sont évaluables : ' +
          p.manquants.map(esc).join(', ') + ' ' + (p.manquants.length > 1 ? 'demandent' : 'demande') +
          ' des données absentes des états publiés. Vous pouvez les saisir dans l\'onglet Données pour compléter le score.');
      }
    }
    return html;
  }

  /* ── Onglet Données et hypothèses ─────────────────────────────── */

  function paneDonnees() {
    var a = S.analyse;
    var html = groupe('Remarques sur les données');
    if (!a.alertes.length) html += note('Aucune anomalie détectée dans les états financiers chargés.');
    else html += a.alertes.map(function (al) {
      return '<div class="af-alerte af-a-' + al.niveau + '">' + esc(al.txt) + '</div>';
    }).join('');

    html += groupe('Compléter les données manquantes');
    html += note('Les états publiés ne contiennent ni la trésorerie, ni l\'actif et le passif circulants, ni le résultat ' +
      'd\'exploitation. Plutôt que de les estimer en silence, ils sont laissés vides. En les saisissant ici, vous ' +
      'débloquez la dette nette exacte, le ratio de liquidité générale et le test de Piotroski correspondant. ' +
      'Les valeurs saisies apparaissent sur fond ambré dans les états financiers.');

    var champs = [
      ['treso', 'Trésorerie'], ['ebit', 'Résultat d\'exploitation'],
      ['actifCirculant', 'Actif circulant'], ['passifCirculant', 'Passif circulant']
    ];
    html += '<div class="af-scroll"><table class="af-table af-saisie"><thead><tr><th>Exercice</th>' +
      champs.map(function (c) { return '<th class="r">' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      a.rows.map(function (r) {
        var ov = S.overrides[r.annee] || {};
        return '<tr><td>' + r.annee + '</td>' + champs.map(function (c) {
          return '<td class="r"><input type="number" step="any" data-ov="' + r.annee + ':' + c[0] + '" ' +
            'value="' + (fin(C.num(ov[c[0]])) ? ov[c[0]] : '') + '" placeholder="—"></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    html += '<div class="af-actions"><button type="button" class="af-btn" id="afClearOv">Effacer les données saisies</button></div>';

    html += groupe('Hypothèses de valorisation en vigueur');
    var H = S.hypotheses;
    var liste = [
      ['Flux de départ', or(mont(H.fcfDepart))], ['Croissance initiale', or(pc(H.croissance))],
      ['Croissance perpétuelle', or(pc(H.croissancePerpetuelle))], ['Horizon', H.annees + ' ans'],
      ['Taux sans risque', or(pc(H.tauxSansRisque, 2))], ['Prime de marché', or(pc(H.primeMarche, 2))],
      ['Beta', or(n2(H.beta))], ['Prime de taille', or(pc(H.primeTaille, 2))],
      ['Prime d\'illiquidité', or(pc(H.primeLiquidite, 2))], ['Coût de la dette', or(pc(H.coutDette, 2))],
      ['Taux d\'impôt', or(pc(H.tauxImpot, 0))], ['Dette nette', or(mont(H.detteNette))],
      ['Nombre d\'actions', or(n0(H.actions))],
      ['Taux d\'actualisation retenu', or(pc(S.resultats ? S.resultats.taux : NaN, 2))]
    ];
    html += '<div class="af-scroll"><table class="af-table"><tbody>' + liste.map(function (l) {
      return '<tr><td>' + l[0] + '</td><td class="r">' + l[1] + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    html += note('Ces hypothèses sont mémorisées par titre dans votre navigateur. Elles ne sont ni transmises ni partagées.');
    return html;
  }

  /* ── Champs de saisie ─────────────────────────────────────────── */

  function champ(label, type, cle, valeur, options, aide) {
    var v = '';
    if (type === 'pct') v = fin(valeur) ? (valeur * 100).toFixed(2).replace(/\.?0+$/, '') : '';
    else if (type === 'mont') v = fin(valeur) ? Math.round(valeur) : '';
    else if (fin(valeur)) v = valeur;
    else if (typeof valeur === 'string') v = valeur;

    var input;
    if (type === 'select') {
      input = '<select data-hyp="' + cle + '" data-type="select">' + options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(valeur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    } else {
      input = '<input type="number" step="' + (type === 'int' ? '1' : 'any') + '" data-hyp="' + cle + '" ' +
        'data-type="' + type + '" value="' + esc(v) + '" placeholder="—">' +
        (type === 'pct' ? '<span class="af-unit">%</span>' : '');
    }
    return '<label class="af-champ"><span class="af-champ-l">' + esc(label) + '</span>' + input +
      (aide ? '<small>' + esc(aide) + '</small>' : '') + '</label>';
  }

  /* ── Export ───────────────────────────────────────────────────── */

  function download(txt, nom, type) {
    var b = new Blob([txt], { type: type });
    var u = URL.createObjectURL(b);
    var a = document.createElement('a');
    a.href = u; a.download = nom;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }

  function exportCsv() {
    var a = S.analyse;
    if (!a || !a.enough) return;
    var lignes = [];
    var head = ['poste'].concat(a.years);
    lignes.push(head.join(';'));
    [['ca', 'chiffre_affaires'], ['rbe', 'resultat_brut'], ['rn', 'resultat_net'], ['cp', 'capitaux_propres'],
    ['actif', 'total_actif'], ['dette', 'dettes_financieres'], ['cfo', 'flux_operationnel'],
    ['capex', 'investissements'], ['fcf', 'flux_libre'], ['actions', 'nombre_actions'],
    ['bpa', 'bpa'], ['dpa', 'dpa']].forEach(function (k) {
      lignes.push([k[1]].concat(a.rows.map(function (r) { return fin(r[k[0]]) ? r[k[0]] : ''; })).join(';'));
    });
    lignes.push('');
    lignes.push(['ratio'].concat(a.years).join(';'));
    ['margeBrute', 'margeNette', 'roe', 'roa', 'gearing', 'autonomie', 'detteEbitda', 'rotationActifs',
      'margeFcf', 'conversionCash', 'per', 'pbr', 'psr', 'evEbitda', 'rendement', 'payout'].forEach(function (k) {
        lignes.push([k].concat(a.ratios.map(function (r) { return fin(r[k]) ? r[k].toFixed(4) : ''; })).join(';'));
      });
    download(lignes.join('\n'), 'fondamentaux_' + S.ticker + '.csv', 'text/csv;charset=utf-8');
    notify('Données exportées.', 'success');
  }

  function exportRapport() {
    var a = S.analyse, R = S.resultats, w = S.wacc, H = S.hypotheses;
    if (!a || !a.enough) return;
    var L = [], sep = function (t) { L.push('', '─'.repeat(68), t.toUpperCase(), '─'.repeat(68)); };
    var P = function (v, d) { return fin(v) ? (v * 100).toFixed(d == null ? 2 : d) + ' %' : 'non calculable'; };
    var N = function (v) { return fin(v) ? Math.round(v).toLocaleString('fr-FR') : 'non calculable'; };

    L.push('THE CAPITAL — RAPPORT D\'ANALYSE FONDAMENTALE');
    L.push('='.repeat(68));
    L.push('Société    : ' + a.data.ticker + (a.data.nom ? ' — ' + a.data.nom : ''));
    if (a.data.secteur) L.push('Secteur    : ' + a.data.secteur);
    L.push('Édité le   : ' + new Date().toLocaleString('fr-FR'));
    L.push('Exercices  : ' + a.rows.length + ' (' + a.years[0] + ' à ' + a.years[a.years.length - 1] + ')');
    L.push('Cours      : ' + N(a.data.price) + ' FCFA');

    sep('Qualité financière');
    if (a.qualite.enough) {
      L.push('Note globale : ' + Math.round(a.qualite.note100) + ' / 100 — ' + a.qualite.mention);
      a.qualite.piliers.forEach(function (p) {
        L.push('  · ' + p.nom + ' : ' + (fin(p.note) ? Math.round(p.note) + '/' + p.sur : 'non noté'));
        L.push('    ' + p.motif);
      });
    }
    if (a.piotroski.enough) {
      L.push('');
      L.push('Piotroski : ' + a.piotroski.score + ' / ' + a.piotroski.sur + ' — ' + a.piotroski.lecture);
      a.piotroski.tests.forEach(function (t) {
        L.push('  ' + (!t.evaluable ? '·' : t.reussi ? '+' : '-') + ' ' + t.libelle + ' — ' + t.detail);
      });
    }

    sep('Ratios du dernier exercice');
    var r = a.dernier;
    [['Marge d\'exploitation (RBE)', P(r.margeBrute)], ['Marge nette', P(r.margeNette)], ['ROE', P(r.roe)], ['ROA', P(r.roa)],
    ['Levier financier', fin(r.gearing) ? r.gearing.toFixed(2) : 'non calculable'],
    ['Autonomie financière', P(r.autonomie)], ['Conversion en trésorerie', fin(r.conversionCash) ? r.conversionCash.toFixed(2) : 'non calculable'],
    ['PER', fin(r.per) ? r.per.toFixed(2) : 'non calculable'], ['PBR', fin(r.pbr) ? r.pbr.toFixed(2) : 'non calculable'],
    ['Rendement', P(r.rendement)], ['Taux de distribution', P(r.payout)]].forEach(function (x) {
      L.push('  ' + x[0].padEnd(30) + ' : ' + x[1]);
    });

    sep('Croissance');
    ['ca', 'rbe', 'rn', 'fcf', 'dpa'].forEach(function (k) {
      var t = a.croissances[k];
      var lbl = { ca: ca(), rbe: 'Résultat brut', rn: 'Résultat net', fcf: 'Flux libre', dpa: 'Dividende' }[k];
      L.push('  ' + lbl.padEnd(24) + ' : ' + (fin(t.value) ? P(t.value) + ' par an sur ' + t.annees + ' ans' : 'non calculable — ' + t.raison));
    });

    if (R) {
      sep('Hypothèses de valorisation');
      L.push('  Flux de départ           : ' + N(H.fcfDepart));
      L.push('  Croissance initiale      : ' + P(H.croissance));
      L.push('  Croissance perpétuelle   : ' + P(H.croissancePerpetuelle));
      L.push('  Horizon                  : ' + H.annees + ' ans');
      L.push('  Taux sans risque         : ' + P(H.tauxSansRisque));
      L.push('  Prime de marché          : ' + P(H.primeMarche));
      L.push('  Beta                     : ' + (fin(H.beta) ? H.beta.toFixed(2) : '—'));
      L.push('  Prime de taille          : ' + P(H.primeTaille));
      L.push('  Prime d\'illiquidité      : ' + P(H.primeLiquidite));
      L.push('  Coût des fonds propres   : ' + P(w.coutFondsPropres));
      L.push('  Taux d\'actualisation     : ' + P(R.taux));

      sep('Résultats de valorisation');
      if (R.dcf.ok) {
        L.push('  Flux actualisés          : ' + N(R.dcf.parAction) + ' FCFA par action');
        L.push('    dont valeur terminale  : ' + P(R.dcf.partTerminale, 0) + ' du total');
        R.dcf.reserves.forEach(function (x) { L.push('    réserve : ' + x); });
      } else {
        L.push('  Flux actualisés          : calcul impossible');
        R.dcf.erreurs.forEach(function (e) { L.push('    ' + e); });
      }
      L.push('  Dividendes actualisés    : ' + (R.ddm.ok ? N(R.ddm.valeur) + ' FCFA' : 'inapplicable'));
      L.push('  Dividende / rdt marché   : ' + (pos(R.dyMarche.valeur) ? N(R.dyMarche.valeur) + ' FCFA' : 'inapplicable'));
      R.multiples.lignes.forEach(function (l) {
        L.push('  ' + METHODE_LABELS[l.cle].padEnd(26) + ' : ' + (l.utilisable ? N(l.valeur) + ' FCFA (multiple ' + l.multiple.toFixed(2) + ')' : 'inapplicable'));
      });
      L.push('  Actif net par action     : ' + (pos(R.vcpaDirect) ? N(R.vcpaDirect) + ' FCFA' : 'inapplicable'));
      L.push('  Revenu résiduel          : ' + (R.residuel.ok ? N(R.residuel.valeur) + ' FCFA' : 'inapplicable'));
      L.push('  Nombre de Graham         : ' + (R.graham.ok ? N(R.graham.valeur) + ' FCFA' : 'inapplicable'));
      L.push('');
      var syn = R.synthese;
      if (fin(syn.valeur)) {
        L.push('  VALEUR RETENUE           : ' + N(syn.valeur) + ' FCFA');
        L.push('  Fourchette               : ' + N(syn.fourchette.bas) + ' à ' + N(syn.fourchette.haut) + ' FCFA');
        L.push('  Potentiel                : ' + P(syn.potentiel, 1));
        L.push('  Marge de sécurité        : ' + P(syn.margeSecurite, 1));
        if (syn.avertissement) L.push('  ' + syn.avertissement);
      }
      if (R.sensibilite) {
        L.push('');
        L.push('  Sur la matrice de sensibilité, la valeur va de ' + N(R.sensibilite.min) +
          ' à ' + N(R.sensibilite.max) + ' FCFA, soit un écart de ' + P(R.sensibilite.etendue, 0) + '.');
      }
      if (R.inverse && R.inverse.ok) {
        L.push('  Croissance implicite du cours actuel : ' + P(R.inverse.croissanceImplicite));
        L.push('  ' + R.inverse.lecture);
      }
      if (R.scenarios) {
        L.push('');
        R.scenarios.forEach(function (s) {
          L.push('  ' + s.nom.padEnd(14) + ' : ' + (s.ok ? N(s.valeur) + ' FCFA (' + P(s.potentiel, 1) + ')' : 'non calculable'));
        });
      }
    }

    if (a.alertes.length) {
      sep('Remarques sur les données');
      a.alertes.forEach(function (x) { L.push('  [' + x.niveau + '] ' + x.txt); });
    }

    L.push('', '='.repeat(68));
    L.push('Rapport produit par The Capital à partir des états financiers publiés.');
    L.push('Les hypothèses de valorisation sont celles affichées ci-dessus et ont été');
    L.push('choisies par l\'utilisateur. Ce document ne constitue pas un conseil en');
    L.push('investissement et ne remplace pas la lecture des rapports annuels.');

    download(L.join('\n'), 'fondamentale_' + S.ticker + '_' + new Date().toISOString().slice(0, 10) + '.txt', 'text/plain;charset=utf-8');
    notify('Rapport exporté.', 'success');
  }

  /* ── Événements ───────────────────────────────────────────────── */

  function bind() {
    var r = root();
    if (!r || r.dataset.afBound === '1') return;
    r.dataset.afBound = '1';

    r.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'afTicker') { load(t.value); return; }

      var hyp = t.getAttribute && t.getAttribute('data-hyp');
      if (hyp) {
        var type = t.getAttribute('data-type');
        if (type === 'select') S.hypotheses[hyp] = t.value;
        else {
          var v = t.value === '' ? NaN : Number(t.value);
          S.hypotheses[hyp] = !isFinite(v) ? NaN : (type === 'pct' ? v / 100 : v);
        }
        saveHyp(); recompute(); render();
        return;
      }

      var poids = t.getAttribute && t.getAttribute('data-poids');
      if (poids) {
        if (t.value === '') return;               /* champ vidé le temps de retaper : on attend la valeur */
        fixerPoids(poids, Number(t.value));       /* le total reste à 100 % : les autres poids s'ajustent */
        store(LS.poids, S.poids);
        recompute(); render();
        return;
      }

      var poidsOn = t.getAttribute && t.getAttribute('data-poids-on');
      if (poidsOn) {
        if (t.checked) {
          var restaure = S.poidsMemoire[poidsOn];
          var defaut = (V.poidsDefaut(S.analyse.data) || {})[poidsOn];
          fixerPoids(poidsOn, Math.round((fin(restaure) && restaure > 0 ? restaure : (fin(defaut) && defaut > 0 ? defaut : 0.10)) * 100));
        } else {
          var actives = Object.keys(S.poids).filter(function (k) { return (S.poids[k] || 0) > 0; });
          if (actives.length > 1) {
            S.poidsMemoire[poidsOn] = S.poids[poidsOn];
            fixerPoids(poidsOn, 0);
          } else {
            notify('Une méthode au moins doit rester active : le total des poids est toujours de 100 %.', 'info');
          }
        }
        store(LS.poids, S.poids);
        recompute(); render();
        return;
      }

      var exclu = t.getAttribute && t.getAttribute('data-afexclu');
      if (exclu) {
        var idx = S.comparablesExclus.indexOf(exclu);
        if (t.checked) { if (idx >= 0) S.comparablesExclus.splice(idx, 1); }
        else { if (idx < 0) S.comparablesExclus.push(exclu); }
        store(LS.exclus, S.comparablesExclus);
        refreshComparables();
        recompute();
        render();
        return;
      }

      var ov = t.getAttribute && t.getAttribute('data-ov');
      if (ov) {
        var parts = ov.split(':');
        S.overrides[parts[0]] = S.overrides[parts[0]] || {};
        if (t.value === '') delete S.overrides[parts[0]][parts[1]];
        else S.overrides[parts[0]][parts[1]] = Number(t.value);
        saveOv();
        var keep = S.tab;
        load(S.ticker);
        S.tab = keep;
        render();
      }
    });

    /* Survol des graphiques : un seul écouteur délégué pour tous les
       graphiques du panneau, plutôt qu'un par graphique — ils sont
       recréés à chaque rendu, un écouteur par instance fuirait sans
       jamais être retiré. */
    r.addEventListener('mousemove', function (e) {
      var chartEl = e.target.closest ? e.target.closest('.af-chart[data-chart-id]') : null;
      if (chartEl) afChartHover(e, chartEl); else afChartHide();
    });
    r.addEventListener('mouseleave', afChartHide, true);

    r.addEventListener('click', function (e) {
      var rowClick = e.target.closest ? e.target.closest('.af-row-click,.af-inter-row-click') : null;
      if (rowClick) {
        if (rowClick.classList.contains('af-row-click')) onEtatsRowClick(rowClick);
        else onInterRowClick(rowClick);
        return;
      }
      var t = e.target.closest ? e.target.closest('[data-aftab],[data-afgoto],button') : null;
      if (!t) return;
      var v;
      if ((v = t.getAttribute('data-aftab'))) { S.tab = v; store(LS.tab, v); render(); return; }
      if ((v = t.getAttribute('data-afgoto'))) {
        var sel = $('afTicker');
        if (sel) sel.value = v;
        load(v);
        return;
      }
      if ((v = t.getAttribute('data-afportee'))) {
        S.portee = v;
        store(LS.portee, v);
        refreshComparables();
        recompute();
        render();
        return;
      }
      if ((v = t.getAttribute('data-afstat'))) {
        S.comparablesStat = v;
        store(LS.stat, v);
        refreshComparables();
        recompute();
        render();
        return;
      }
      switch (t.id) {
        case 'afReset':
          S.hypotheses = V.hypothesesInitiales(S.analyse);
          try { localStorage.removeItem(LS.hyp + S.ticker); } catch (err) { }
          recompute(); render();
          notify('Hypothèses rétablies.', 'success');
          break;
        case 'afResetPoids':
          S.poids = V.poidsDefaut(S.analyse.data);
          store(LS.poids, S.poids);
          recompute(); render();
          notify('Poids rétablis.', 'success');
          break;
        case 'afClearOv':
          S.overrides = {};
          try { localStorage.removeItem(LS.ov + S.ticker); } catch (err) { }
          var k = S.tab; load(S.ticker); S.tab = k; render();
          notify('Données saisies effacées.', 'success');
          break;
        case 'afRapport': exportRapport(); break;
        case 'afCsv': exportCsv(); break;
        case 'afMemos': if (global.TCMemo) global.TCMemo.index(); break;
        case 'afReinitExclus':
          S.comparablesExclus = [];
          store(LS.exclus, S.comparablesExclus);
          refreshComparables();
          recompute(); render();
          notify('Tous les pairs sont de nouveau inclus.', 'success');
          break;
      }
    });

    /* Les lignes cliquables sont des <tr>, pas des boutons : sans ceci,
       un clavier ne peut pas les activer malgré leur tabindex. */
    r.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var rowClick = e.target.closest ? e.target.closest('.af-row-click,.af-inter-row-click') : null;
      if (!rowClick) return;
      e.preventDefault();
      if (rowClick.classList.contains('af-row-click')) onEtatsRowClick(rowClick);
      else onInterRowClick(rowClick);
    });
  }

  /* ── Amorçage ─────────────────────────────────────────────────── */

  var booted = false;

  function init() {
    if (!$('afPanel')) return false;
    if (!booted) {
      S.tab = read(LS.tab, 'synthese');
      S.poids = poidsInitiaux(Object.assign({}, V.POIDS_DEFAUT));
      S.comparablesStat = read(LS.stat, 'moyenne');
      S.comparablesExclus = read(LS.exclus, []);
      bind();
      booted = true;
    }
    var n = fillSelect();
    if (!n) { render(); return false; }
    if (!S.ticker) {
      var first = tickers()[0];
      if (first) { var sel = $('afTicker'); if (sel) sel.value = first.ticker; load(first.ticker); }
    } else render();
    return true;
  }

  global.afInit = function () {
    try { return init(); } catch (e) { console.error('[AF]', e); return false; }
  };
  global.renderAnalyseFondamentale = function () {
    if (!booted) { global.afInit(); return; }
    fillSelect();
    render();
  };
  /* Nom historique conservé : d'autres vues l'appellent encore. */
  global.loadFundAnalysis = function () { global.afInit(); };

  global.addEventListener('tc:dataready', function () { if (booted) { fillSelect(); if (S.ticker) load(S.ticker); } });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(global.afInit, 0); }, { once: true });
  }
})(typeof window !== 'undefined' ? window : globalThis);