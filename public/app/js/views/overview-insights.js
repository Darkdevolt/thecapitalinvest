/**
 * THE CAPITAL — Enrichissement du tableau de bord
 *
 * Le tableau de bord existant répond à la question « comment va le marché ».
 * Il ne répond pas à « comment vont mes positions », ni à « ce mouvement
 * concerne-t-il quelques valeurs ou l'ensemble de la cote ». Ce module ajoute
 * quatre blocs qui traitent ces angles, sans modifier une seule ligne du
 * rendu existant.
 *
 * Principe de conception : aucune requête réseau supplémentaire. Tout est
 * calculé à partir des données déjà chargées par l'application — window.allCours,
 * window.allIndices, window.allEntreprises — et du portefeuille déjà en mémoire.
 * Un bloc qui ne dispose pas de ses données ne s'affiche pas : il ne laisse ni
 * cadre vide ni valeur à zéro trompeuse.
 *
 * Blocs ajoutés :
 *   1. Synthèse du portefeuille — valorisation, performance latente, variation
 *      du jour en montant, principal contributeur et principal détracteur.
 *   2. Largeur de marché — répartition hausses / baisses / stables et ratio
 *      A/D, qui distingue une progression d'indice portée par toute la cote
 *      d'une progression portée par deux ou trois capitalisations.
 *   3. Activité — valeur transigée du jour comparée à la moyenne des vingt
 *      dernières séances, et concentration des échanges sur le premier quintile.
 *   4. Liste de suivi — variations du jour des valeurs surveillées.
 */
(function () {
  'use strict';

  if (window.__TC_OVERVIEW_INSIGHTS__) return;
  window.__TC_OVERVIEW_INSIGHTS__ = true;

  var SEANCES_REFERENCE = 20;

  // ─── Utilitaires ─────────────────────────────────────────────────────────

  function esc(v) {
    var d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  function nombre(v, dec) {
    var n = Number(v);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', {
      minimumFractionDigits: dec == null ? 0 : dec,
      maximumFractionDigits: dec == null ? 0 : dec
    });
  }

  /** Les montants BRVM atteignent vite le milliard : on abrège au-delà du million. */
  function montant(v) {
    var n = Number(v);
    if (!isFinite(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Md';
    if (abs >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    return nombre(n);
  }

  function signe(v, dec, suffixe) {
    var n = Number(v);
    if (!isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + nombre(n, dec) + (suffixe || '');
  }

  var sens = function (v) { return Number(v) > 0 ? 'pos' : Number(v) < 0 ? 'neg' : 'neu'; };

  /** Dernière cotation connue par ticker, toutes séances confondues. */
  function derniersCours() {
    var map = {};
    (window.allCours || []).forEach(function (r) {
      if (!r || !r.ticker) return;
      var t = String(r.ticker).trim().toUpperCase();
      if (!map[t] || String(r.date_seance) > String(map[t].date_seance)) map[t] = r;
    });
    return map;
  }

  var cloture = function (r) {
    return Number(r && (r.cours_cloture != null ? r.cours_cloture : r.cours));
  };

  function nomSociete(ticker) {
    var e = (window.allEntreprises || []).find(function (x) {
      return String(x.ticker).trim().toUpperCase() === ticker;
    });
    return (e && e.nom) || ticker;
  }

  // ─── 1. Synthèse du portefeuille ─────────────────────────────────────────

  /**
   * Reconstitue les positions à partir du journal des transactions.
   * Le coût de revient est moyenné sur les achats ; les ventes réduisent la
   * quantité sans altérer ce coût moyen, convention usuelle du PRU.
   */
  function positions(transactions) {
    var parTicker = {};
    (transactions || [])
      .slice()
      .sort(function (a, b) {
        return String(a.date_transaction || '').localeCompare(String(b.date_transaction || ''));
      })
      .forEach(function (tx) {
        var type = String(tx.type || '').toUpperCase();
        if (type !== 'ACHAT' && type !== 'VENTE') return;
        var t = String(tx.ticker || '').trim().toUpperCase();
        if (!t || t === 'CASH') return;
        var q = Number(tx.quantite) || 0;
        if (!parTicker[t]) parTicker[t] = { ticker: t, quantite: 0, cout: 0 };
        var p = parTicker[t];
        if (type === 'ACHAT') {
          p.quantite += q;
          p.cout += Number(tx.montant_net) || (q * (Number(tx.cours) || 0));
        } else {
          if (p.quantite > 0) p.cout -= p.cout * (Math.min(q, p.quantite) / p.quantite);
          p.quantite -= q;
        }
      });
    return Object.keys(parTicker)
      .map(function (k) { return parTicker[k]; })
      .filter(function (p) { return p.quantite > 0.000001; });
  }

  function synthesePortefeuille(transactions) {
    var cours = derniersCours();
    var lignes = positions(transactions).map(function (p) {
      var r = cours[p.ticker];
      var prix = cloture(r);
      var valeur = isFinite(prix) ? prix * p.quantite : NaN;
      var pct = Number(r && (r.variation_pct != null ? r.variation_pct : r.variation));
      // Variation du jour en montant : le pourcentage s'applique au cours de
      // clôture, la veille valant donc prix / (1 + pct/100).
      var veille = (isFinite(prix) && isFinite(pct) && pct !== -100) ? prix / (1 + pct / 100) : NaN;
      var jour = (isFinite(valeur) && isFinite(veille)) ? (prix - veille) * p.quantite : NaN;
      return {
        ticker: p.ticker, quantite: p.quantite, cout: p.cout,
        valeur: valeur, latent: isFinite(valeur) ? valeur - p.cout : NaN,
        jour: jour, pct: pct
      };
    }).filter(function (l) { return isFinite(l.valeur); });

    if (!lignes.length) return null;

    var somme = function (cle) {
      return lignes.reduce(function (s, l) { return s + (isFinite(l[cle]) ? l[cle] : 0); }, 0);
    };
    var valeur = somme('valeur');
    var cout = somme('cout');
    var jour = somme('jour');
    var triJour = lignes.slice().sort(function (a, b) { return (b.jour || 0) - (a.jour || 0); });

    return {
      lignes: lignes.length,
      valeur: valeur,
      cout: cout,
      latent: valeur - cout,
      latentPct: cout > 0 ? ((valeur - cout) / cout) * 100 : NaN,
      jour: jour,
      jourPct: (valeur - jour) > 0 ? (jour / (valeur - jour)) * 100 : NaN,
      meilleur: triJour[0],
      pire: triJour[triJour.length - 1]
    };
  }

  function rendrePortefeuille(hote, s) {
    if (!s) {
      hote.innerHTML =
        '<div class="tci-card tci-empty">'
        + '<div class="tci-empty-title">Aucune position en portefeuille</div>'
        + '<div class="tci-empty-text">Enregistrez vos opérations pour suivre ici votre '
        + 'valorisation, votre performance latente et votre variation du jour.</div>'
        + '<button type="button" class="tci-btn" onclick="nav(\'portefeuille\')">Ouvrir le portefeuille</button>'
        + '</div>';
      return;
    }
    var contrib = function (l, label) {
      if (!l || !isFinite(l.jour) || l.jour === 0) return '';
      return '<div class="tci-contrib">'
        + '<span class="tci-contrib-label">' + label + '</span>'
        + '<span class="tci-contrib-ticker">' + esc(l.ticker) + '</span>'
        + '<span class="tci-val ' + sens(l.jour) + '">' + signe(l.jour, 0, ' FCFA') + '</span>'
        + '</div>';
    };
    hote.innerHTML =
      '<div class="tci-card">'
      + '<div class="tci-head"><span class="tci-title">Mon portefeuille</span>'
      + '<span class="tci-sub">' + s.lignes + ' ligne' + (s.lignes > 1 ? 's' : '') + '</span></div>'
      + '<div class="tci-grid">'
      + '  <div class="tci-metric"><span class="tci-label">Valorisation</span>'
      + '    <span class="tci-value">' + montant(s.valeur) + '</span><span class="tci-unit">FCFA</span></div>'
      + '  <div class="tci-metric"><span class="tci-label">Plus-value latente</span>'
      + '    <span class="tci-value ' + sens(s.latent) + '">' + signe(s.latent, 0) + '</span>'
      + '    <span class="tci-unit ' + sens(s.latent) + '">' + signe(s.latentPct, 2, ' %') + '</span></div>'
      + '  <div class="tci-metric"><span class="tci-label">Variation du jour</span>'
      + '    <span class="tci-value ' + sens(s.jour) + '">' + signe(s.jour, 0) + '</span>'
      + '    <span class="tci-unit ' + sens(s.jour) + '">' + signe(s.jourPct, 2, ' %') + '</span></div>'
      + '</div>'
      + '<div class="tci-contribs">' + contrib(s.meilleur, 'Contributeur') + contrib(s.pire, 'Détracteur') + '</div>'
      + '</div>';
  }

  // ─── 2. Largeur de marché ────────────────────────────────────────────────

  /**
   * Un indice qui progresse ne dit pas si la hausse est générale. Le ratio
   * avances / déclins le dit : proche de 1, le mouvement est étroit ; très
   * supérieur à 1, il est porté par l'ensemble de la cote.
   */
  function largeur(cours) {
    var h = 0, b = 0, s = 0;
    Object.keys(cours).forEach(function (t) {
      var v = Number(cours[t].variation_pct != null ? cours[t].variation_pct : cours[t].variation);
      if (!isFinite(v)) return;
      if (v > 0) h++; else if (v < 0) b++; else s++;
    });
    var total = h + b + s;
    if (!total) return null;
    return { hausses: h, baisses: b, stables: s, total: total, ratio: b > 0 ? h / b : (h > 0 ? Infinity : 0) };
  }

  function rendreLargeur(hote, l) {
    if (!l) { hote.innerHTML = ''; return; }
    var pct = function (n) { return (n / l.total) * 100; };
    var lecture = l.ratio === Infinity ? 'Hausse généralisée'
      : l.ratio >= 2 ? 'Hausse largement partagée'
      : l.ratio >= 1.2 ? 'Tendance haussière'
      : l.ratio >= 0.8 ? 'Marché partagé'
      : l.ratio >= 0.5 ? 'Tendance baissière'
      : 'Baisse largement partagée';
    hote.innerHTML =
      '<div class="tci-card">'
      + '<div class="tci-head"><span class="tci-title">Largeur de marché</span>'
      + '<span class="tci-sub">' + l.total + ' valeurs cotées</span></div>'
      + '<div class="tci-bar" role="img" aria-label="' + esc(lecture) + '">'
      + '  <span class="pos" style="width:' + pct(l.hausses) + '%"></span>'
      + '  <span class="neu" style="width:' + pct(l.stables) + '%"></span>'
      + '  <span class="neg" style="width:' + pct(l.baisses) + '%"></span>'
      + '</div>'
      + '<div class="tci-legend">'
      + '  <span><i class="pos"></i>' + l.hausses + ' en hausse</span>'
      + '  <span><i class="neu"></i>' + l.stables + ' stables</span>'
      + '  <span><i class="neg"></i>' + l.baisses + ' en baisse</span>'
      + '</div>'
      + '<div class="tci-reading"><strong>' + esc(lecture) + '</strong>'
      + '<span class="tci-sub"> — ratio A/D '
      + (l.ratio === Infinity ? '∞' : nombre(l.ratio, 2)) + '</span></div>'
      + '</div>';
  }

  // ─── 3. Activité ─────────────────────────────────────────────────────────

  /**
   * Compare la valeur transigée de la dernière séance à la moyenne des vingt
   * précédentes, et mesure la concentration : sur un marché étroit, une part
   * élevée sur cinq valeurs est la norme, mais son évolution est instructive.
   */
  function activite() {
    var parDate = {};
    /* La séance du jour seule ne permet aucune comparaison. On privilégie
       l'historique court lorsqu'il est chargé, et l'on retombe sur le
       dernier instantané sinon, auquel cas le bloc s'efface, comme prevu. */
    var source = (Array.isArray(window.allCoursHistory) && window.allCoursHistory.length)
      ? window.allCoursHistory
      : (window.allCours || []);
    source.forEach(function (r) {
      var d = r && r.date_seance;
      var v = Number(r && (r.valeur_totale != null ? r.valeur_totale : r.valeur_transigee));
      if (!d || !isFinite(v)) return;
      (parDate[d] = parDate[d] || []).push({ ticker: r.ticker, valeur: v });
    });
    var dates = Object.keys(parDate).sort();
    if (dates.length < 2) return null;

    var derniere = dates[dates.length - 1];
    var lignes = parDate[derniere];
    var total = lignes.reduce(function (s, x) { return s + x.valeur; }, 0);
    if (!total) return null;

    var precedentes = dates.slice(-1 - SEANCES_REFERENCE, -1).map(function (d) {
      return parDate[d].reduce(function (s, x) { return s + x.valeur; }, 0);
    }).filter(function (v) { return v > 0; });
    var moyenne = precedentes.length
      ? precedentes.reduce(function (a, b) { return a + b; }, 0) / precedentes.length
      : NaN;

    var top5 = lignes.slice().sort(function (a, b) { return b.valeur - a.valeur; }).slice(0, 5);
    return {
      date: derniere,
      total: total,
      moyenne: moyenne,
      ecart: isFinite(moyenne) && moyenne > 0 ? ((total - moyenne) / moyenne) * 100 : NaN,
      seances: precedentes.length,
      concentration: (top5.reduce(function (s, x) { return s + x.valeur; }, 0) / total) * 100,
      meneur: top5[0]
    };
  }

  function rendreActivite(hote, a) {
    if (!a) { hote.innerHTML = ''; return; }
    var lecture = !isFinite(a.ecart) ? ''
      : a.ecart >= 50 ? 'Activité nettement supérieure à la normale'
      : a.ecart >= 15 ? 'Activité soutenue'
      : a.ecart <= -50 ? 'Activité très faible'
      : a.ecart <= -15 ? 'Activité en retrait'
      : 'Activité conforme à la moyenne';
    hote.innerHTML =
      '<div class="tci-card">'
      + '<div class="tci-head"><span class="tci-title">Activité de la séance</span>'
      + '<span class="tci-sub">moyenne sur ' + a.seances + ' séances</span></div>'
      + '<div class="tci-grid">'
      + '  <div class="tci-metric"><span class="tci-label">Valeur transigée</span>'
      + '    <span class="tci-value">' + montant(a.total) + '</span><span class="tci-unit">FCFA</span></div>'
      + '  <div class="tci-metric"><span class="tci-label">Écart à la moyenne</span>'
      + '    <span class="tci-value ' + sens(a.ecart) + '">' + signe(a.ecart, 0, ' %') + '</span>'
      + '    <span class="tci-unit">' + esc(lecture) + '</span></div>'
      + '  <div class="tci-metric"><span class="tci-label">Part des 5 premières</span>'
      + '    <span class="tci-value">' + nombre(a.concentration, 0) + ' %</span>'
      + '    <span class="tci-unit">' + (a.meneur ? 'dont ' + esc(a.meneur.ticker) : '') + '</span></div>'
      + '</div></div>';
  }

  // ─── 4. Liste de suivi ───────────────────────────────────────────────────

  function rendreSuivi(hote, watchlist) {
    var cours = derniersCours();
    var lignes = (watchlist || []).map(function (w) {
      var t = String(w.ticker || '').trim().toUpperCase();
      var r = cours[t];
      if (!r) return null;
      var v = Number(r.variation_pct != null ? r.variation_pct : r.variation);
      return { ticker: t, nom: nomSociete(t), cours: cloture(r), pct: v };
    }).filter(Boolean).sort(function (a, b) { return (b.pct || 0) - (a.pct || 0); });

    if (!lignes.length) { hote.innerHTML = ''; return; }

    hote.innerHTML =
      '<div class="tci-card">'
      + '<div class="tci-head"><span class="tci-title">Ma liste de suivi</span>'
      + '<span class="tci-sub">' + lignes.length + ' valeur' + (lignes.length > 1 ? 's' : '') + '</span></div>'
      + '<div class="tci-watch">'
      + lignes.slice(0, 8).map(function (l) {
          return '<button type="button" class="tci-watch-row" onclick="nav(\'fiche\');'
            + 'window.openFiche&&window.openFiche(\'' + esc(l.ticker) + '\')">'
            + '<span class="tci-watch-tick">' + esc(l.ticker) + '</span>'
            + '<span class="tci-watch-name">' + esc(l.nom) + '</span>'
            + '<span class="tci-watch-cours">' + nombre(l.cours) + '</span>'
            + '<span class="tci-val ' + sens(l.pct) + '">' + signe(l.pct, 2, ' %') + '</span>'
            + '</button>';
        }).join('')
      + '</div></div>';
  }

  // ─── Orchestration ───────────────────────────────────────────────────────

  function hote(id) { return document.getElementById(id); }

  async function rendre() {
    var cours = derniersCours();

    var cibleLargeur = hote('tciBreadth');
    if (cibleLargeur) rendreLargeur(cibleLargeur, largeur(cours));

    var cibleActivite = hote('tciActivity');
    if (cibleActivite) rendreActivite(cibleActivite, activite());

    var ciblePf = hote('tciPortfolio');
    if (ciblePf) {
      try {
        var tx = window.portfolioStore && typeof window.portfolioStore.getTransactions === 'function'
          ? await window.portfolioStore.getTransactions()
          : [];
        rendrePortefeuille(ciblePf, synthesePortefeuille(tx));
      } catch (e) {
        // Une session expirée ou une table absente ne doit pas vider le reste
        // du tableau de bord : le bloc s'efface, les autres restent.
        console.warn('[OVERVIEW] Synthèse portefeuille indisponible :', e && e.message);
        ciblePf.innerHTML = '';
      }
    }

    var cibleSuivi = hote('tciWatch');
    if (cibleSuivi) {
      try {
        var r = await fetch('/api/user-data?mode=watchlist', {
          headers: { Authorization: 'Bearer ' + (window.TC_ENV ? window.TC_ENV.getToken() : '') },
          cache: 'no-store'
        });
        var d = await r.json();
        rendreSuivi(cibleSuivi, r.ok && d.success ? d.data : []);
      } catch (e) {
        cibleSuivi.innerHTML = '';
      }
    }
  }

  /**
   * Greffe sur renderOverview sans le remplacer : la fonction d'origine est
   * appelée telle quelle, l'enrichissement s'exécute ensuite.
   */
  function greffer() {
    var origine = window.renderOverview;
    if (typeof origine !== 'function') return false;
    if (origine.__tciWrapped) return true;
    var enrichi = function () {
      var resultat = origine.apply(this, arguments);
      Promise.resolve().then(rendre).catch(function (e) {
        console.warn('[OVERVIEW] Enrichissement :', e && e.message);
      });
      return resultat;
    };
    enrichi.__tciWrapped = true;
    window.renderOverview = enrichi;
    return true;
  }

  if (!greffer()) {
    // renderOverview peut être défini après ce module selon l'ordre de
    // chargement : on réessaie brièvement plutôt que d'imposer une dépendance.
    var essais = 0;
    var timer = setInterval(function () {
      if (greffer() || ++essais > 40) clearInterval(timer);
    }, 150);
  }

  window.TCOverviewInsights = { rendre: rendre };
})();
