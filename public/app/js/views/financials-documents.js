/**
 * THE CAPITAL — Documents financiers côté application
 *
 * Affiche les rapports déposés depuis l'administration, dans la fiche de la
 * valeur et dans la vue États financiers.
 *
 * Les chiffres saisis dans la base ne remplacent pas le document source : le
 * rapport annuel porte les notes annexes, les méthodes comptables retenues et
 * l'opinion du commissaire aux comptes. Un investisseur qui veut vérifier un
 * agrégat ou comprendre un retraitement a besoin du document, pas seulement de
 * la ligne qui en a été extraite.
 *
 * La lecture est directe et anonyme : la règle RLS de `financials_documents`
 * n'expose que les documents marqués publiés. Aucune session n'est requise, et
 * les brouillons restent invisibles même en interrogeant la table.
 */
(function () {
  'use strict';

  if (window.__TC_FIN_DOCS__) return;
  window.__TC_FIN_DOCS__ = true;

  var cache = {};

  var LIBELLES = {
    etats_financiers: 'États financiers',
    rapport_annuel: 'Rapport annuel',
    rapport_semestriel: 'Rapport semestriel',
    communique: 'Communiqué',
    note_information: "Note d'information",
    autre: 'Document'
  };

  function esc(v) {
    var d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  function poids(octets) {
    var n = Number(octets);
    if (!isFinite(n) || n <= 0) return '';
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' Mo';
    return Math.round(n / 1024) + ' Ko';
  }

  async function charger(ticker) {
    var t = String(ticker || '').trim().toUpperCase();
    if (!t) return [];
    if (cache[t]) return cache[t];
    try {
      var url = TC_ENV.SUPABASE_REST + '/financials_documents'
        + '?select=*&publie=eq.true&ticker=eq.' + encodeURIComponent(t)
        + '&order=annee.desc&limit=100';
      var r = await fetch(url, {
        headers: { apikey: TC_ENV.SUPABASE_ANON_KEY, Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      cache[t] = await r.json();
      return cache[t];
    } catch (e) {
      // Table absente ou règle restrictive : le bloc s'efface, la fiche reste
      // parfaitement utilisable sans lui.
      console.warn('[FIN-DOCS] indisponible :', e && e.message);
      cache[t] = [];
      return cache[t];
    }
  }

  function rendre(docs, ticker) {
    if (!docs.length) return '';
    var parAnnee = {};
    docs.forEach(function (d) { (parAnnee[d.annee] = parAnnee[d.annee] || []).push(d); });
    var annees = Object.keys(parAnnee).sort(function (a, b) { return b - a; });

    return '<div class="fdoc-card">'
      + '<div class="fdoc-head"><span class="fdoc-title">Publications officielles</span>'
      + '<span class="fdoc-sub">' + docs.length + ' document' + (docs.length > 1 ? 's' : '')
      + ' — ' + esc(ticker) + '</span></div>'
      + '<p class="fdoc-note">Documents déposés par l\'émetteur. Ils portent les notes annexes '
      + 'et l\'opinion du commissaire aux comptes, que les chiffres saisis ne restituent pas.</p>'
      + annees.map(function (an) {
          return '<div class="fdoc-annee">'
            + '<div class="fdoc-annee-titre">' + esc(an) + '</div>'
            + '<div class="fdoc-liste">'
            + parAnnee[an].map(function (d) {
                return '<a class="fdoc-item" href="' + esc(d.fichier_url)
                  + '" target="_blank" rel="noopener noreferrer">'
                  + '<span class="fdoc-type">' + esc(LIBELLES[d.type_document] || 'Document') + '</span>'
                  + '<span class="fdoc-nom">' + esc(d.titre || d.fichier_nom) + '</span>'
                  + '<span class="fdoc-meta">' + esc(d.periode || '')
                  + (poids(d.taille_octets) ? ' · ' + poids(d.taille_octets) : '') + '</span>'
                  + '<span class="fdoc-fleche">PDF ↗</span></a>';
              }).join('')
            + '</div></div>';
        }).join('')
      + '</div>';
  }

  /** Insère le bloc dans un hôte donné, en le vidant s'il n'y a rien à montrer. */
  async function afficher(hoteId, ticker) {
    var hote = document.getElementById(hoteId);
    if (!hote) return;
    if (!ticker) { hote.innerHTML = ''; return; }
    var docs = await charger(ticker);
    hote.innerHTML = rendre(docs, String(ticker).toUpperCase());
  }

  /**
   * Greffe sur les vues existantes sans les remplacer. Le conteneur est créé à
   * la volée s'il n'existe pas : aucune modification du balisage n'est requise.
   */
  function conteneur(vueId, id) {
    var vue = document.getElementById(vueId);
    if (!vue) return null;
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      vue.appendChild(el);
    }
    return el;
  }

  function greffer(nomFonction, vueId, conteneurId, extraireTicker) {
    var origine = window[nomFonction];
    if (typeof origine !== 'function' || origine.__fdocWrapped) return typeof origine === 'function';
    var enrichi = function () {
      var resultat = origine.apply(this, arguments);
      Promise.resolve().then(function () {
        conteneur(vueId, conteneurId);
        afficher(conteneurId, extraireTicker(arguments));
      }).catch(function (e) { console.warn('[FIN-DOCS]', e && e.message); });
      return resultat;
    };
    enrichi.__fdocWrapped = true;
    window[nomFonction] = enrichi;
    return true;
  }

  function tickerCourant() {
    return (window.state && (window.state.ficheTicker || window.state.currentTicker))
      || window.currentTicker
      || (location.hash.match(/fiche=([A-Z0-9]+)/i) || [])[1]
      || '';
  }

  function installer() {
    var a = greffer('renderFiche', 'view-fiche', 'fdoc-fiche', tickerCourant);
    var b = greffer('renderFinancialsDetail', 'view-financials-detail', 'fdoc-financials', tickerCourant);
    return a || b;
  }

  if (!installer()) {
    var essais = 0;
    var timer = setInterval(function () {
      if (installer() || ++essais > 40) clearInterval(timer);
    }, 150);
  }

  window.TCFinancialsDocs = { afficher: afficher, charger: charger };
})();
