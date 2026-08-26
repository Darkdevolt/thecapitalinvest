// ═══════════════════════════════════════════════════════════
// THE CAPITAL — ANALYSE QUANTITATIVE
//
// Module autonome, greffé sous le graphique d'analyse technique.
// Trois règles le gouvernent :
//
//   1. Il ne peut jamais empêcher le graphique de fonctionner.
//      Tout y est encapsulé, aucune exception ne remonte, et son
//      chargement est indépendant du reste de la vue.
//
//   2. Une métrique qui manque de données affiche N/D. Elle ne
//      s'approxime pas, ne se remplace pas par zéro, et ne
//      disparaît pas en silence : l'utilisateur doit voir qu'elle
//      n'a pas pu être calculée, et pourquoi.
//
//   3. Aucune donnée n'est inventée. Le beta et la corrélation
//      exigent une série de référence alignée date à date sur la
//      série du titre. Sans observations communes en nombre
//      suffisant, ils restent N/D.
//
// Source du titre    : historique de cotations déjà chargé par
//                      l'analyse technique (AT.hist).
// Source de référence: BRVM Composite, via allIndicesHistory.
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  if (window.__TC_QUANT_LOADED__) return;
  window.__TC_QUANT_LOADED__ = true;

  const LOG = '[QUANT]';

  /* Nombre de séances de bourse par an, pour l'annualisation. */
  const SEANCES_AN = 252;

  /* Observations communes minimales avant de publier un chiffre.
     En deçà, un beta n'a aucune signification statistique. */
  const MIN_OBS = 20;
  const MIN_OBS_BETA = 30;

  /* Taux sans risque annuel, utilisé par Sharpe et Sortino.
     Modifiable depuis la console : window.TC_TAUX_SANS_RISQUE = 0.04
     Le taux retenu est toujours affiché, pour que le chiffre reste
     vérifiable. */
  function tauxSansRisque() {
    const t = window.TC_TAUX_SANS_RISQUE;
    return (typeof t === 'number' && isFinite(t) && t >= 0 && t < 1) ? t : 0.035;
  }

  const PERIODES = [
    { cle: 30, label: '1M' },
    { cle: 90, label: '3M' },
    { cle: 180, label: '6M' },
    { cle: 252, label: '1A' },
    { cle: 0, label: 'Tout' }
  ];

  let periode = 252;

  /* ── Outils numériques ────────────────────────────────── */

  const nombre = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  };

  const moyenne = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

  /** Écart-type d'échantillon (n-1) : la série est un échantillon, pas la population. */
  function ecartType(xs) {
    if (xs.length < 2) return null;
    const m = moyenne(xs);
    return Math.sqrt(xs.reduce((a, v) => a + (v - m) * (v - m), 0) / (xs.length - 1));
  }

  function variance(xs) {
    if (xs.length < 2) return null;
    const m = moyenne(xs);
    return xs.reduce((a, v) => a + (v - m) * (v - m), 0) / (xs.length - 1);
  }

  function covariance(xs, ys) {
    if (xs.length !== ys.length || xs.length < 2) return null;
    const mx = moyenne(xs), my = moyenne(ys);
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += (xs[i] - mx) * (ys[i] - my);
    return s / (xs.length - 1);
  }

  function correlation(xs, ys) {
    const cov = covariance(xs, ys);
    const sx = ecartType(xs), sy = ecartType(ys);
    if (cov === null || !sx || !sy) return null;
    return cov / (sx * sy);
  }

  /* ── Extraction et alignement des séries ──────────────── */

  const cloture = r => nombre(
    r?.cours_cloture != null ? r.cours_cloture :
      (r?.cloture != null ? r.cloture : (r?.cours != null ? r.cours : r?.c))
  );

  const dateDe = r => String(r?.date_seance || r?.date || r?.d || '').slice(0, 10);

  const normIndice = s => String(s == null ? '' : s)
    .toUpperCase().replace(/[^A-Z0-9]/g, '');

  const CANDIDATS_REFERENCE = ['BRVMC', 'BRVMCOMPOSITE', 'COMPOSITE', 'BRVM30'];

  /** Série de référence : BRVM Composite, à défaut BRVM 30. */
  function serieReference() {
    const source = (Array.isArray(window.allIndicesHistory) && window.allIndicesHistory.length)
      ? window.allIndicesHistory
      : (window.allIndices || []);
    if (!source.length) return { nom: null, points: [] };

    const noms = [...new Set(source.map(r => r && r.indice).filter(Boolean))];
    let choisi = null;
    for (const c of CANDIDATS_REFERENCE) {
      const trouve = noms.find(n => normIndice(n) === c);
      if (trouve) { choisi = trouve; break; }
    }
    if (!choisi) return { nom: null, points: [] };

    const points = source
      .filter(r => r && r.indice === choisi && nombre(r.valeur) !== null)
      .map(r => ({ date: dateDe(r), valeur: nombre(r.valeur) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { nom: choisi, points };
  }

  /** Série du titre, restreinte à la période demandée. */
  function serieTitre() {
    const hist = (window.AT && Array.isArray(window.AT.hist)) ? window.AT.hist : [];
    const points = hist
      .map(r => ({ date: dateDe(r), valeur: cloture(r) }))
      .filter(p => p.date && p.valeur !== null && p.valeur > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    return periode > 0 ? points.slice(-periode) : points;
  }

  /** Rendements arithmétiques successifs, indexés par date d'arrivée. */
  function rendements(points) {
    const out = [];
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1].valeur, p1 = points[i].valeur;
      if (!p0 || p0 <= 0) continue;
      out.push({ date: points[i].date, r: (p1 - p0) / p0 });
    }
    return out;
  }

  /**
   * Alignement date à date. Comparer deux séries de longueurs
   * différentes, ou décalées d'une séance, produit un beta faux
   * sans qu'aucune erreur n'apparaisse : c'est le piège classique.
   */
  function aligner(a, b) {
    const index = new Map(b.map(x => [x.date, x.r]));
    const xs = [], ys = [], dates = [];
    a.forEach(x => {
      if (index.has(x.date)) { xs.push(x.r); ys.push(index.get(x.date)); dates.push(x.date); }
    });
    return { xs, ys, dates };
  }

  /* ── Métriques ────────────────────────────────────────── */

  function drawdownMax(points) {
    if (points.length < 2) return null;
    let sommet = points[0].valeur, pire = 0, dateCreux = null;
    points.forEach(p => {
      if (p.valeur > sommet) sommet = p.valeur;
      const dd = (p.valeur - sommet) / sommet;
      if (dd < pire) { pire = dd; dateCreux = p.date; }
    });
    return { valeur: pire, date: dateCreux };
  }

  function calculer() {
    const titre = serieTitre();
    const reference = serieReference();

    const res = {
      ticker: (window.AT && window.AT.ticker) || null,
      observations: Math.max(0, titre.length - 1),
      debut: titre.length ? titre[0].date : null,
      fin: titre.length ? titre[titre.length - 1].date : null,
      referenceNom: reference.nom,
      obsCommunes: 0,
      manques: []
    };

    if (titre.length < 2) {
      res.manques.push('Historique du titre insuffisant : au moins deux séances sont nécessaires.');
      return res;
    }

    const rTitre = rendements(titre);
    if (rTitre.length < MIN_OBS) {
      res.manques.push('Seulement ' + rTitre.length + ' rendement(s) exploitables ; ' +
        MIN_OBS + ' au minimum pour une mesure de dispersion.');
    }

    /* Performance : premier et dernier cours de la période. */
    const p0 = titre[0].valeur, p1 = titre[titre.length - 1].valeur;
    res.performance = (p0 > 0) ? (p1 - p0) / p0 : null;

    const serie = rTitre.map(x => x.r);
    if (serie.length >= MIN_OBS) {
      const sd = ecartType(serie);
      res.volatiliteJour = sd;
      res.volatilite = sd !== null ? sd * Math.sqrt(SEANCES_AN) : null;
      res.variance = variance(serie);
      res.varianceAn = res.variance !== null ? res.variance * SEANCES_AN : null;
      res.rendementMoyenAn = moyenne(serie) * SEANCES_AN;

      /* Sharpe : excès de rendement rapporté au risque total. */
      const rf = tauxSansRisque();
      if (res.volatilite) res.sharpe = (res.rendementMoyenAn - rf) / res.volatilite;

      /* Sortino : seule la volatilité baissière est pénalisée.
         Un titre qui monte violemment n'est pas risqué pour autant. */
      const seuil = rf / SEANCES_AN;
      const baissiers = serie.filter(r => r < seuil).map(r => r - seuil);
      if (baissiers.length >= 5) {
        const sdDown = Math.sqrt(baissiers.reduce((a, v) => a + v * v, 0) / baissiers.length) * Math.sqrt(SEANCES_AN);
        res.sortino = sdDown > 0 ? (res.rendementMoyenAn - rf) / sdDown : null;
        res.volatiliteBaissiere = sdDown;
      } else {
        res.manques.push('Trop peu de séances baissières pour un ratio de Sortino fiable.');
      }

      /* Valeur en risque historique à 95 %, sur une séance. */
      const trie = serie.slice().sort((a, b) => a - b);
      res.var95 = trie[Math.floor(trie.length * 0.05)];
    }

    const dd = drawdownMax(titre);
    if (dd) { res.drawdown = dd.valeur; res.drawdownDate = dd.date; }

    /* ── Mesures relatives à la référence ── */
    if (!reference.points.length) {
      res.manques.push('Aucune série d\'indice disponible : beta, corrélation et covariance restent incalculables.');
      return res;
    }

    const rRef = rendements(reference.points);
    const { xs, ys } = aligner(rTitre, rRef);
    res.obsCommunes = xs.length;

    if (xs.length < MIN_OBS_BETA) {
      res.manques.push('Seulement ' + xs.length + ' séance(s) communes avec ' +
        (reference.nom || 'l\'indice') + ' ; ' + MIN_OBS_BETA +
        ' au minimum pour un beta significatif.');
      return res;
    }

    res.covariance = covariance(xs, ys);
    res.covarianceAn = res.covariance !== null ? res.covariance * SEANCES_AN : null;
    res.correlation = correlation(xs, ys);

    const varRef = variance(ys);
    res.varianceReference = varRef !== null ? varRef * SEANCES_AN : null;
    res.beta = (res.covariance !== null && varRef) ? res.covariance / varRef : null;

    /* R² : part de la variation du titre expliquée par l'indice. */
    res.r2 = res.correlation !== null ? res.correlation * res.correlation : null;

    /* Alpha de Jensen, annualisé. */
    if (res.beta !== null && res.rendementMoyenAn !== undefined) {
      const rf = tauxSansRisque();
      const rm = moyenne(ys) * SEANCES_AN;
      res.rendementReferenceAn = rm;
      res.alpha = res.rendementMoyenAn - (rf + res.beta * (rm - rf));
    }

    return res;
  }

  /* ── Rendu ────────────────────────────────────────────── */

  const ND = '<span class="q-nd" title="Données insuffisantes">N/D</span>';

  function pct(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return ND;
    return (v >= 0 ? '+' : '') + (v * 100).toFixed(d === undefined ? 2 : d) + ' %';
  }
  function num(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return ND;
    return v.toFixed(d === undefined ? 2 : d);
  }
  function ton(v, inverse) {
    if (v === null || v === undefined || !isFinite(v)) return '';
    const positif = inverse ? v < 0 : v > 0;
    return positif ? ' q-up' : (v === 0 ? '' : ' q-down');
  }

  function css() {
    if (document.getElementById('tc-quant-css')) return;
    const s = document.createElement('style');
    s.id = 'tc-quant-css';
    s.textContent = `
      #atQuant{margin-top:14px;border:1px solid rgba(184,150,78,.18);border-radius:8px;background:rgba(19,17,12,.6);overflow:hidden;}
      #atQuant .q-head{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid rgba(184,150,78,.1);flex-wrap:wrap;}
      #atQuant .q-title{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.45);}
      #atQuant .q-periods{margin-left:auto;display:flex;gap:4px;}
      #atQuant .q-per{padding:4px 10px;background:none;border:1px solid rgba(184,150,78,.2);border-radius:14px;color:rgba(245,240,232,.45);font-size:10px;cursor:pointer;transition:all .15s;}
      #atQuant .q-per:hover{color:#F5F0E8;}
      #atQuant .q-per.on{background:rgba(184,150,78,.14);border-color:#B8964E;color:#B8964E;}
      #atQuant .q-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:1px;background:rgba(184,150,78,.08);}
      #atQuant .q-cell{background:#13110C;padding:13px 15px;}
      #atQuant .q-label{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:rgba(245,240,232,.4);margin-bottom:6px;}
      #atQuant .q-value{font-family:'DM Mono',monospace;font-size:19px;color:#F5F0E8;line-height:1.15;}
      #atQuant .q-value.q-up{color:#4ADE80;} #atQuant .q-value.q-down{color:#F87171;}
      #atQuant .q-sub{font-size:10px;color:rgba(245,240,232,.35);margin-top:5px;line-height:1.45;}
      #atQuant .q-nd{font-size:13px;color:rgba(245,240,232,.28);font-style:italic;}
      #atQuant .q-foot{padding:11px 16px;border-top:1px solid rgba(184,150,78,.1);font-size:11px;color:rgba(245,240,232,.4);line-height:1.6;}
      #atQuant .q-warn{color:#FB923C;}
      #atQuant .q-group{padding:7px 16px;background:rgba(184,150,78,.045);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#B8964E;}
    `;
    document.head.appendChild(s);
  }

  function conteneur() {
    let el = document.getElementById('atQuant');
    if (el) return el;
    const ancre = document.getElementById('atWrap');
    if (!ancre || !ancre.parentNode) return null;
    el = document.createElement('div');
    el.id = 'atQuant';
    ancre.parentNode.insertBefore(el, ancre.nextSibling);
    return el;
  }

  function cellule(label, valeur, sous) {
    return '<div class="q-cell"><div class="q-label">' + label + '</div>' +
      '<div class="q-value' + (sous && sous.ton ? sous.ton : '') + '">' + valeur + '</div>' +
      (sous && sous.texte ? '<div class="q-sub">' + sous.texte + '</div>' : '') + '</div>';
  }

  function rendre() {
    const el = conteneur();
    if (!el) return;
    css();

    const onglets = PERIODES.map(p =>
      '<button class="q-per' + (p.cle === periode ? ' on' : '') + '" data-quant-per="' + p.cle + '">' +
      p.label + '</button>').join('');

    const tete = '<div class="q-head"><span class="q-title">Analyse quantitative</span>' +
      '<div class="q-periods">' + onglets + '</div></div>';

    let r;
    try { r = calculer(); }
    catch (e) {
      console.error(LOG, 'calcul interrompu :', e);
      el.innerHTML = tete + '<div class="q-foot q-warn">Le calcul quantitatif a échoué : ' +
        String(e.message || e) + '. Le graphique et les indicateurs techniques ne sont pas affectés.</div>';
      return;
    }

    if (!r.ticker) {
      el.innerHTML = tete + '<div class="q-foot">Choisissez un titre pour lancer l\'analyse quantitative.</div>';
      return;
    }

    const rf = tauxSansRisque();

    const bloc1 =
      '<div class="q-group">Rendement et risque propres au titre</div><div class="q-grid">' +
      cellule('Performance', pct(r.performance), {
        ton: ton(r.performance),
        texte: r.debut ? 'du ' + r.debut + ' au ' + r.fin : ''
      }) +
      cellule('Volatilité annualisée', pct(r.volatilite), {
        texte: r.volatiliteJour != null ? (r.volatiliteJour * 100).toFixed(2) + ' % par séance' : 'écart-type des rendements'
      }) +
      cellule('Variance annualisée', num(r.varianceAn, 4), { texte: 'carré de la volatilité' }) +
      cellule('Ratio de Sharpe', num(r.sharpe), {
        ton: ton(r.sharpe),
        texte: 'taux sans risque ' + (rf * 100).toFixed(1) + ' %'
      }) +
      cellule('Ratio de Sortino', num(r.sortino), {
        ton: ton(r.sortino),
        texte: r.volatiliteBaissiere != null ? 'volatilité baissière ' + (r.volatiliteBaissiere * 100).toFixed(1) + ' %' : 'pénalise la seule baisse'
      }) +
      cellule('Perte maximale', pct(r.drawdown), {
        ton: ton(r.drawdown, true),
        texte: r.drawdownDate ? 'creux au ' + r.drawdownDate : 'du sommet au creux'
      }) +
      cellule('VaR 95 % (1 séance)', pct(r.var95), {
        ton: ton(r.var95, true),
        texte: 'perte dépassée 1 séance sur 20'
      }) +
      '</div>';

    const bloc2 =
      '<div class="q-group">Comportement relatif à ' + (r.referenceNom || 'l\'indice de référence') + '</div><div class="q-grid">' +
      cellule('Beta', num(r.beta), {
        texte: r.beta == null ? 'sensibilité au marché'
          : (r.beta > 1.05 ? 'amplifie les mouvements du marché'
            : r.beta < 0.95 ? 'amortit les mouvements du marché'
              : 'suit le marché')
      }) +
      cellule('Corrélation', num(r.correlation), {
        texte: r.correlation == null ? '' :
          (Math.abs(r.correlation) > 0.7 ? 'lien fort'
            : Math.abs(r.correlation) > 0.4 ? 'lien modéré' : 'lien faible')
      }) +
      cellule('R²', r.r2 == null ? ND : (r.r2 * 100).toFixed(1) + ' %', {
        texte: 'part expliquée par l\'indice'
      }) +
      cellule('Covariance annualisée', num(r.covarianceAn, 4), { texte: 'co-mouvement brut' }) +
      cellule('Alpha de Jensen', pct(r.alpha), {
        ton: ton(r.alpha),
        texte: 'sur-performance à risque égal'
      }) +
      cellule('Rendement de l\'indice', pct(r.rendementReferenceAn), { texte: 'annualisé sur la période' }) +
      '</div>';

    const base = r.obsCommunes
      ? r.observations + ' rendement(s) sur le titre · ' + r.obsCommunes + ' séance(s) communes avec ' + r.referenceNom
      : r.observations + ' rendement(s) sur le titre';

    const pied = '<div class="q-foot">' + base +
      ' · annualisation sur ' + SEANCES_AN + ' séances' +
      (r.manques.length ? '<br><span class="q-warn">' + r.manques.join('<br>') + '</span>' : '') +
      '</div>';

    el.innerHTML = tete + bloc1 + bloc2 + pied;
  }

  /* ── Branchement ──────────────────────────────────────── */

  function rafraichir() {
    try { rendre(); }
    catch (e) { console.error(LOG, 'rendu interrompu :', e); }
  }
  window.atQuantRefresh = rafraichir;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('[data-quant-per]');
    if (!btn) return;
    periode = parseInt(btn.getAttribute('data-quant-per'), 10) || 0;
    rafraichir();
  });

  /**
   * Greffe sur le chargement d'un titre, sans le remplacer. Une erreur
   * ici ne doit jamais empêcher le graphique de s'afficher : le calcul
   * est donc lancé après coup, hors du fil d'exécution d'origine.
   */
  function greffer() {
    const origine = window.atLoadTicker;
    if (typeof origine !== 'function' || origine.__quant) return false;
    const enrichi = async function () {
      const resultat = await origine.apply(this, arguments);
      setTimeout(rafraichir, 0);
      return resultat;
    };
    enrichi.__quant = true;
    window.atLoadTicker = enrichi;
    console.log(LOG, 'module quantitatif greffé');
    return true;
  }

  if (!greffer()) {
    /* atLoadTicker peut être défini après ce module selon l'ordre de
       chargement. On réessaie brièvement plutôt que d'abandonner. */
    let essais = 0;
    const timer = setInterval(function () {
      if (greffer() || ++essais > 40) clearInterval(timer);
    }, 250);
  }

  /* Premier rendu si un titre est déjà chargé. */
  setTimeout(function () {
    if (window.AT && window.AT.ticker) rafraichir();
  }, 400);

})();
