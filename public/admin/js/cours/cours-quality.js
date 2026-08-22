/**
 * THE CAPITAL — Contrôle qualité des données de marché
 *
 * La section Cours & Historique permettait de saisir, corriger et supprimer des
 * cotations ligne à ligne. Elle ne permettait pas de répondre à la question qui
 * précède toutes les autres : où sont les problèmes ?
 *
 * Sur une cote d'une cinquantaine de valeurs et plusieurs centaines de séances,
 * une séance manquante, un ticker absent d'une séance ou une clôture hors de son
 * propre intervalle haut/bas ne se voient pas en faisant défiler un tableau. Ces
 * défauts se propagent ensuite partout : variations fausses, graphiques troués,
 * moyennes biaisées, contrôles du pipeline BRVM déclenchés à tort.
 *
 * Ce module balaie les deux tables et remonte huit familles d'anomalies, chacune
 * avec le nombre d'occurrences, le détail des lignes concernées et un accès
 * direct à la correction.
 *
 * Adaptatif au schéma : la liste des colonnes est lue dans la description
 * OpenAPI de PostgREST avant toute requête. Les tables `cours` et `historique`
 * ont divergé dans cette base — c'est ce qui faisait échouer l'écriture du
 * scraper. Aucun nom de colonne n'est donc présumé ici.
 */
(function () {
  'use strict';

  if (window.__TC_COURS_QUALITY__) return;
  window.__TC_COURS_QUALITY__ = true;

  /** Variation maximale autorisée sur une séance à la BRVM, en pourcentage. */
  var LIMITE_VARIATION = 7.5;
  /** Profondeur d'analyse par défaut, en nombre de séances. */
  var SEANCES_DEFAUT = 60;

  var schema = null;
  var dernierRapport = null;

  // ─── Utilitaires ─────────────────────────────────────────────────────────

  function esc(v) {
    var d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  function nb(v, dec) {
    var n = Number(v);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', {
      minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0
    });
  }

  /** Colonnes réellement présentes dans une table, d'après PostgREST. */
  async function chargerSchema() {
    if (schema) return schema;
    schema = {};
    try {
      var r = await fetch(SB_REST + '/', {
        headers: sbHeaders({ Accept: 'application/openapi+json' }), cache: 'no-store'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var spec = await r.json();
      var defs = (spec && (spec.definitions || (spec.components && spec.components.schemas))) || {};
      Object.keys(defs).forEach(function (t) {
        if (defs[t] && defs[t].properties) schema[t] = Object.keys(defs[t].properties);
      });
    } catch (e) {
      console.warn('[QUALITE] Schéma non lisible :', e && e.message);
    }
    return schema;
  }

  var aColonne = function (table, col) {
    return !!(schema[table] && schema[table].indexOf(col) !== -1);
  };

  /** Premier nom de colonne existant parmi les candidats proposés. */
  function colonne(table, candidats) {
    for (var i = 0; i < candidats.length; i++) {
      if (aColonne(table, candidats[i])) return candidats[i];
    }
    return null;
  }

  function valeur(row, table, candidats) {
    var c = colonne(table, candidats);
    return c ? row[c] : undefined;
  }

  // ─── Lecture des données ─────────────────────────────────────────────────

  /**
   * PostgREST plafonne les réponses. La lecture est donc paginée explicitement
   * plutôt que bornée par une limite unique qui tronquerait sans le signaler.
   */
  async function lireTout(table, params, plafond) {
    var out = [];
    var taille = 1000;
    for (var page = 0; page < 40; page++) {
      var suffixe = params + '&offset=' + (page * taille) + '&limit=' + taille;
      var lot = await sbGet(table, suffixe);
      if (!Array.isArray(lot) || !lot.length) break;
      out = out.concat(lot);
      if (lot.length < taille) break;
      if (plafond && out.length >= plafond) break;
    }
    return out;
  }

  async function collecter(seances) {
    await chargerSchema();
    if (!schema.historique) throw new Error('Table « historique » introuvable.');

    // Séances à analyser : les N plus récentes réellement présentes.
    var dates = await sbGet('historique',
      'select=date_seance&order=date_seance.desc&limit=' + (seances * 60));
    var liste = [];
    var vues = {};
    (dates || []).forEach(function (r) {
      if (r.date_seance && !vues[r.date_seance]) { vues[r.date_seance] = 1; liste.push(r.date_seance); }
    });
    liste = liste.slice(0, seances).sort();
    if (!liste.length) throw new Error('Aucune séance dans l’historique.');

    var depuis = liste[0];
    var hist = await lireTout('historique',
      'select=*&date_seance=gte.' + depuis + '&order=date_seance.asc,ticker.asc');
    var cours = schema.cours
      ? await lireTout('cours', 'select=*&date_seance=gte.' + depuis + '&order=date_seance.asc,ticker.asc')
      : [];
    var entreprises = await sbGet('entreprises', 'select=ticker,nom,actif&order=ticker.asc') || [];

    return { seances: liste, hist: hist, cours: cours, entreprises: entreprises };
  }

  // ─── Contrôles ───────────────────────────────────────────────────────────

  function anomalie(code, titre, gravite, explication, lignes) {
    return { code: code, titre: titre, gravite: gravite, explication: explication, lignes: lignes };
  }

  /**
   * 1. Séances absentes. On ne se fie pas au calendrier : un jour ouvré sans
   *    cotation peut être un jour férié régional. Le signal retenu est le trou
   *    isolé — un jour ouvré vide encadré de deux séances actives.
   */
  function seancesManquantes(d) {
    var presentes = {};
    d.seances.forEach(function (s) { presentes[s] = true; });
    var debut = new Date(d.seances[0]);
    var fin = new Date(d.seances[d.seances.length - 1]);
    var trous = [];
    for (var j = new Date(debut); j <= fin; j.setDate(j.getDate() + 1)) {
      var jour = j.getDay();
      if (jour === 0 || jour === 6) continue;
      var iso = j.toISOString().slice(0, 10);
      if (!presentes[iso]) trous.push({ date: iso, detail: 'jour ouvré sans aucune cotation' });
    }
    if (!trous.length) return null;
    return anomalie('seances_manquantes', 'Séances absentes', trous.length > 3 ? 'haute' : 'moyenne',
      'Jours ouvrés sans aucune cotation entre la première et la dernière séance analysée. '
      + 'Un jour férié régional est normal ; une série de trous indique une collecte interrompue.',
      trous);
  }

  /**
   * 2. Tickers absents d'une séance alors qu'ils cotaient la veille. C'est le
   *    défaut le plus courant après une collecte partielle, et le plus invisible.
   */
  function tickersManquants(d) {
    var parSeance = {};
    d.hist.forEach(function (r) {
      if (!r.date_seance || !r.ticker) return;
      (parSeance[r.date_seance] = parSeance[r.date_seance] || {})[r.ticker] = true;
    });
    var manques = [];
    for (var i = 1; i < d.seances.length; i++) {
      var veille = parSeance[d.seances[i - 1]] || {};
      var jour = parSeance[d.seances[i]] || {};
      var absents = Object.keys(veille).filter(function (t) { return !jour[t]; });
      // Une séance totalement vide relève du contrôle précédent, pas de celui-ci.
      if (absents.length && Object.keys(jour).length) {
        manques.push({
          date: d.seances[i],
          detail: absents.length + ' valeur(s) absente(s) : ' + absents.slice(0, 12).join(', ')
            + (absents.length > 12 ? '…' : '')
        });
      }
    }
    if (!manques.length) return null;
    return anomalie('tickers_manquants', 'Valeurs absentes d’une séance', 'haute',
      'Ces valeurs cotaient la veille et n’apparaissent pas dans la séance. '
      + 'Elles créent des trous dans les graphiques et faussent les variations de la séance suivante.',
      manques);
  }

  /** 3. Doublons sur le couple ticker + date, qui doit être unique. */
  function doublons(d, table, lignes) {
    var vus = {};
    var dbl = [];
    lignes.forEach(function (r) {
      var cle = r.ticker + '@' + r.date_seance;
      if (vus[cle]) dbl.push({ date: r.date_seance, detail: r.ticker + ' — enregistrement en double' });
      else vus[cle] = true;
    });
    if (!dbl.length) return null;
    return anomalie('doublons_' + table, 'Doublons dans « ' + table + ' »', 'haute',
      'Le couple ticker + date de séance doit être unique. Des doublons faussent les totaux '
      + 'et rendent le résultat des mises à jour imprévisible.', dbl);
  }

  /**
   * 4. Cohérence des bornes : la clôture et l'ouverture doivent tenir dans
   *    l'intervalle plus bas / plus haut, et le plus haut dominer le plus bas.
   */
  function bornes(d) {
    var pbs = [];
    d.hist.forEach(function (r) {
      var haut = Number(valeur(r, 'historique', ['plus_haut']));
      var bas = Number(valeur(r, 'historique', ['plus_bas']));
      var clo = Number(valeur(r, 'historique', ['cours_cloture', 'cloture', 'cours']));
      var ouv = Number(valeur(r, 'historique', ['cours_ouverture', 'ouverture']));
      if (!isFinite(haut) || !isFinite(bas)) return; // bornes non renseignées : hors périmètre
      if (haut < bas) {
        pbs.push({ date: r.date_seance, detail: r.ticker + ' — plus haut (' + nb(haut) + ') inférieur au plus bas (' + nb(bas) + ')' });
        return;
      }
      if (isFinite(clo) && (clo > haut || clo < bas)) {
        pbs.push({ date: r.date_seance, detail: r.ticker + ' — clôture ' + nb(clo) + ' hors de l’intervalle [' + nb(bas) + ' ; ' + nb(haut) + ']' });
      }
      if (isFinite(ouv) && (ouv > haut || ouv < bas)) {
        pbs.push({ date: r.date_seance, detail: r.ticker + ' — ouverture ' + nb(ouv) + ' hors de l’intervalle [' + nb(bas) + ' ; ' + nb(haut) + ']' });
      }
    });
    if (!pbs.length) return null;
    return anomalie('bornes', 'Bornes incohérentes', 'haute',
      'Une clôture ou une ouverture située hors de l’intervalle plus bas / plus haut de sa propre '
      + 'séance est arithmétiquement impossible : l’une des quatre valeurs est erronée.', pbs);
  }

  /**
   * 5. Variation publiée contre variation recalculée depuis la séance
   *    précédente, et dépassement de la limite réglementaire de 7,5 %.
   */
  function variations(d) {
    var parTicker = {};
    d.hist.forEach(function (r) {
      if (!r.ticker) return;
      (parTicker[r.ticker] = parTicker[r.ticker] || []).push(r);
    });
    var horsLimite = [];
    var incoherentes = [];
    Object.keys(parTicker).forEach(function (t) {
      var lignes = parTicker[t].slice().sort(function (a, b) {
        return String(a.date_seance).localeCompare(String(b.date_seance));
      });
      for (var i = 0; i < lignes.length; i++) {
        var r = lignes[i];
        var pub = Number(valeur(r, 'historique', ['variation_pct', 'variation']));
        var clo = Number(valeur(r, 'historique', ['cours_cloture', 'cloture', 'cours']));
        if (isFinite(pub) && Math.abs(pub) > LIMITE_VARIATION + 1e-9) {
          horsLimite.push({ date: r.date_seance, detail: t + ' — variation ' + nb(pub, 2) + ' % (limite ' + LIMITE_VARIATION + ' %)' });
        }
        if (i === 0) continue;
        var prec = Number(valeur(lignes[i - 1], 'historique', ['cours_cloture', 'cloture', 'cours']));
        if (!isFinite(prec) || prec <= 0 || !isFinite(clo)) continue;
        var calc = ((clo - prec) / prec) * 100;
        if (isFinite(pub) && Math.abs(pub - calc) > 0.3) {
          incoherentes.push({
            date: r.date_seance,
            detail: t + ' — publiée ' + nb(pub, 2) + ' %, recalculée ' + nb(calc, 2) + ' % (clôture précédente ' + nb(prec) + ')'
          });
        }
      }
    });
    var out = [];
    if (horsLimite.length) {
      out.push(anomalie('variation_limite', 'Variations hors limite BRVM', 'haute',
        'La BRVM plafonne la variation d’une séance à ' + LIMITE_VARIATION + ' %. Un dépassement traduit '
        + 'presque toujours une erreur de saisie du cours ou une séance manquante entre les deux dates.',
        horsLimite));
    }
    if (incoherentes.length) {
      out.push(anomalie('variation_incoherente', 'Variations incohérentes', 'moyenne',
        'La variation enregistrée ne correspond pas à celle que produisent les deux clôtures '
        + 'successives. Soit la variation est fausse, soit un cours l’est, soit une séance manque '
        + 'entre les deux dates.', incoherentes));
    }
    return out;
  }

  /** 6. Valeurs nulles ou à zéro sur des champs qui ne peuvent pas l'être. */
  function valeursSuspectes(d) {
    var pbs = [];
    d.hist.forEach(function (r) {
      var clo = valeur(r, 'historique', ['cours_cloture', 'cloture', 'cours']);
      if (clo == null || clo === '') {
        pbs.push({ date: r.date_seance, detail: r.ticker + ' — clôture absente' });
      } else if (Number(clo) === 0) {
        pbs.push({ date: r.date_seance, detail: r.ticker + ' — clôture à zéro' });
      } else if (Number(clo) < 0) {
        pbs.push({ date: r.date_seance, detail: r.ticker + ' — clôture négative (' + nb(clo) + ')' });
      }
    });
    if (!pbs.length) return null;
    return anomalie('valeurs_suspectes', 'Clôtures absentes ou nulles', 'haute',
      'Une clôture vide, nulle ou négative n’a pas de sens sur un marché actions et contamine '
      + 'toute moyenne ou variation qui s’appuie dessus.', pbs);
  }

  /**
   * 7. Divergence entre `cours` et `historique`. Les deux tables décrivent la
   *    même réalité : tout écart signale une écriture partielle.
   */
  function divergence(d) {
    if (!d.cours.length) return null;
    var index = {};
    d.hist.forEach(function (r) { index[r.ticker + '@' + r.date_seance] = r; });
    var pbs = [];
    d.cours.forEach(function (c) {
      var h = index[c.ticker + '@' + c.date_seance];
      if (!h) {
        pbs.push({ date: c.date_seance, detail: c.ticker + ' — présent dans « cours », absent de « historique »' });
        return;
      }
      var vc = Number(valeur(c, 'cours', ['cours_cloture', 'cloture', 'cours']));
      var vh = Number(valeur(h, 'historique', ['cours_cloture', 'cloture', 'cours']));
      if (isFinite(vc) && isFinite(vh) && Math.abs(vc - vh) > 0.01) {
        pbs.push({ date: c.date_seance, detail: c.ticker + ' — clôture ' + nb(vc) + ' dans « cours » contre ' + nb(vh) + ' dans « historique »' });
      }
    });
    if (!pbs.length) return null;
    return anomalie('divergence', 'Divergence entre « cours » et « historique »', 'haute',
      'Les deux tables décrivent la même séance et doivent concorder. Un écart provient d’une '
      + 'écriture interrompue ou d’une correction appliquée d’un seul côté.', pbs);
  }

  /** 8. Cotations rattachées à un ticker absent ou inactif du référentiel. */
  function tickersInconnus(d) {
    var connus = {};
    var inactifs = {};
    d.entreprises.forEach(function (e) {
      var t = String(e.ticker || '').trim().toUpperCase();
      if (!t) return;
      connus[t] = true;
      if (e.actif === false) inactifs[t] = true;
    });
    var vus = {};
    var pbs = [];
    d.hist.forEach(function (r) {
      var t = String(r.ticker || '').trim().toUpperCase();
      if (!t || vus[t]) return;
      vus[t] = true;
      if (!connus[t]) pbs.push({ date: r.date_seance, detail: t + ' — absent du référentiel Entreprises' });
      else if (inactifs[t]) pbs.push({ date: r.date_seance, detail: t + ' — marqué inactif mais cote encore' });
    });
    if (!pbs.length) return null;
    return anomalie('tickers_inconnus', 'Valeurs hors référentiel', 'moyenne',
      'Ces tickers cotent sans fiche entreprise correspondante, ou sont marqués inactifs alors '
      + 'qu’ils cotent encore. Ils n’apparaîtront pas correctement côté application.', pbs);
  }

  // ─── Analyse ─────────────────────────────────────────────────────────────

  function analyser(d) {
    var out = [];
    var pousser = function (a) { if (a) out.push(a); };
    pousser(seancesManquantes(d));
    pousser(tickersManquants(d));
    pousser(doublons(d, 'historique', d.hist));
    if (d.cours.length) pousser(doublons(d, 'cours', d.cours));
    pousser(bornes(d));
    variations(d).forEach(pousser);
    pousser(valeursSuspectes(d));
    pousser(divergence(d));
    pousser(tickersInconnus(d));
    return out;
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────

  function rendre(d, anomalies) {
    var hote = document.getElementById('tc-quality-body');
    if (!hote) return;

    var totalLignes = anomalies.reduce(function (s, a) { return s + a.lignes.length; }, 0);
    var hautes = anomalies.filter(function (a) { return a.gravite === 'haute'; }).length;

    var entete =
      '<div class="tcq-stats">'
      + '<div class="tcq-stat"><strong>' + d.seances.length + '</strong><span>séances analysées</span></div>'
      + '<div class="tcq-stat"><strong>' + nb(d.hist.length) + '</strong><span>cotations lues</span></div>'
      + '<div class="tcq-stat"><strong class="' + (anomalies.length ? 'bad' : 'good') + '">'
      + anomalies.length + '</strong><span>type(s) d’anomalie</span></div>'
      + '<div class="tcq-stat"><strong class="' + (totalLignes ? 'bad' : 'good') + '">'
      + nb(totalLignes) + '</strong><span>occurrence(s)</span></div>'
      + '</div>'
      + '<div class="tcq-period">Période : du ' + esc(d.seances[0]) + ' au '
      + esc(d.seances[d.seances.length - 1]) + '</div>';

    if (!anomalies.length) {
      hote.innerHTML = entete
        + '<div class="tcq-clean">Aucune anomalie détectée sur la période analysée. '
        + 'Séances continues, bornes cohérentes, variations conformes, tables concordantes.</div>';
      return;
    }

    var blocs = anomalies.map(function (a, i) {
      var apercu = a.lignes.slice(0, 60).map(function (l) {
        return '<tr><td class="tcq-date">' + esc(l.date) + '</td><td>' + esc(l.detail) + '</td></tr>';
      }).join('');
      var reste = a.lignes.length > 60
        ? '<div class="tcq-more">… et ' + (a.lignes.length - 60) + ' autre(s) occurrence(s).</div>' : '';
      return '<details class="tcq-item tcq-' + a.gravite + '"' + (i === 0 ? ' open' : '') + '>'
        + '<summary><span class="tcq-badge">' + (a.gravite === 'haute' ? 'critique' : 'à vérifier') + '</span>'
        + '<span class="tcq-titre">' + esc(a.titre) + '</span>'
        + '<span class="tcq-count">' + a.lignes.length + '</span></summary>'
        + '<p class="tcq-expl">' + esc(a.explication) + '</p>'
        + '<div class="tcq-table-wrap"><table class="tcq-table"><thead><tr><th>Séance</th><th>Détail</th></tr></thead>'
        + '<tbody>' + apercu + '</tbody></table></div>' + reste
        + '</details>';
    }).join('');

    hote.innerHTML = entete
      + (hautes ? '<div class="tcq-alert">' + hautes + ' anomalie(s) critique(s) : '
        + 'elles faussent directement les calculs affichés côté application.</div>' : '')
      + blocs
      + '<button type="button" class="tcq-export" id="tc-quality-export">Exporter le rapport (CSV)</button>';

    var bouton = document.getElementById('tc-quality-export');
    if (bouton) bouton.addEventListener('click', exporter);
  }

  function exporter() {
    if (!dernierRapport) return;
    var lignes = [['type', 'gravite', 'seance', 'detail']];
    dernierRapport.forEach(function (a) {
      a.lignes.forEach(function (l) { lignes.push([a.titre, a.gravite, l.date, l.detail]); });
    });
    var csv = lignes.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'controle-qualite-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ─── Orchestration ───────────────────────────────────────────────────────

  async function lancer() {
    var hote = document.getElementById('tc-quality-body');
    var bouton = document.getElementById('tc-quality-run');
    var champ = document.getElementById('tc-quality-depth');
    if (!hote) return;
    if (bouton) bouton.disabled = true;
    hote.innerHTML = '<div class="tcq-loading">Analyse en cours…</div>';
    try {
      var profondeur = Math.min(Math.max(parseInt(champ && champ.value, 10) || SEANCES_DEFAUT, 5), 400);
      var d = await collecter(profondeur);
      var anomalies = analyser(d);
      dernierRapport = anomalies;
      rendre(d, anomalies);
    } catch (e) {
      hote.innerHTML = '<div class="tcq-error">Analyse impossible : ' + esc(e && e.message) + '</div>';
    } finally {
      if (bouton) bouton.disabled = false;
    }
  }

  /** Insère le bloc dans le panneau Cours, au-dessus du formulaire de saisie. */
  function installer() {
    var panneau = document.getElementById('panel-cours');
    if (!panneau || document.getElementById('tc-quality-card')) return;
    var carte = document.createElement('div');
    carte.id = 'tc-quality-card';
    carte.className = 'card';
    carte.style.marginBottom = '16px';
    carte.innerHTML =
      '<div class="card-header"><span class="card-title">Contrôle qualité des données</span></div>'
      + '<div class="tcq-controls">'
      + '  <label for="tc-quality-depth">Profondeur</label>'
      + '  <input type="number" id="tc-quality-depth" value="' + SEANCES_DEFAUT + '" min="5" max="400" step="5">'
      + '  <span class="tcq-unit">séances</span>'
      + '  <button type="button" id="tc-quality-run" class="btn">Lancer l’analyse</button>'
      + '  <span class="tcq-hint">Aucune écriture : lecture seule.</span>'
      + '</div>'
      + '<div id="tc-quality-body" class="tcq-body">'
      + '<div class="tcq-idle">Huit contrôles sont appliqués aux tables « cours » et « historique » : '
      + 'séances absentes, valeurs manquantes dans une séance, doublons, bornes incohérentes, '
      + 'variations hors limite ou incohérentes, clôtures nulles, divergence entre les deux tables, '
      + 'valeurs hors référentiel.</div></div>';

    var premier = panneau.querySelector('.card');
    if (premier && premier.nextSibling) panneau.insertBefore(carte, premier.nextSibling);
    else panneau.appendChild(carte);

    var bouton = document.getElementById('tc-quality-run');
    if (bouton) bouton.addEventListener('click', lancer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installer);
  } else {
    installer();
  }

  window.TCQualite = { lancer: lancer, installer: installer };
})();
