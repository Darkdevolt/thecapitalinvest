// ═══════════════════════════════════════════════════════════════════════════
// THE CAPITAL — Prévision de dividendes
// Détermine, pour un titre, le prochain dividende net par action : un
// versement annoncé (dividendes_calendrier, statut confirmé/prévisionnel ou
// détachement futur) en priorité ; à défaut une estimation basée sur le
// dernier dividende réellement versé, toujours signalée comme telle. Utilisé
// par la fiche titre et le portefeuille pour répondre à « combien vais-je
// toucher ? », y compris sur un titre pas encore détenu.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }

  function divsFor(ticker) {
    var T = String(ticker || '').toUpperCase().trim();
    var list = Array.isArray(window.allDividendes) ? window.allDividendes : [];
    return list.filter(function (d) { return String(d && d.ticker || '').toUpperCase().trim() === T; });
  }

  function netOf(brut, irvm) {
    var b = num(brut), t = irvm != null ? num(irvm) : 12;
    if (b === null || t === null) return null;
    return Math.round(b * (1 - t / 100) * 100) / 100;
  }

  function fromRow(d, source) {
    var brut = num(d.montant);
    var irvm = d.taux_irvm != null ? num(d.taux_irvm) : 12;
    return {
      source: source,
      statut: d.statut || (source === 'estimation' ? 'payé' : 'confirmé'),
      exercice: d.exercice || d.annee || null,
      brut: brut,
      irvm: irvm,
      net: d.montant_net != null ? num(d.montant_net) : netOf(brut, irvm),
      date_detachement: source === 'annonce' ? (d.date_detachement || d.ex_date || null) : null,
      date_paiement: source === 'annonce' ? (d.date_paiement_cal || d.date_paiement || null) : null
    };
  }

  /**
   * Prochain dividende attendu pour un ticker, ou null si aucun historique
   * de dividende n'existe pour ce titre.
   */
  function nextDividend(ticker) {
    var divs = divsFor(ticker);
    if (!divs.length) return null;
    var today = new Date().toISOString().slice(0, 10);

    // « confirmé » ne veut dire « à venir » que si sa date ne s'est pas déjà
    // écoulée : dans les données réelles, un dividende versé il y a six ans
    // reste marqué confirmé — seule la date permet de savoir s'il est passé.
    // Un « prévisionnel » compte en revanche par nature, même sans date fixée.
    var upcoming = divs.filter(function (d) {
      var statut = String(d.statut || '').toLowerCase();
      var detach = d.date_detachement || d.ex_date;
      var future = !!detach && detach >= today;
      return statut === 'prévisionnel' || (statut === 'confirmé' && future);
    }).sort(function (a, b) {
      var da = a.date_detachement || a.ex_date || '9999-99-99';
      var db = b.date_detachement || b.ex_date || '9999-99-99';
      return String(da).localeCompare(String(db));
    });
    if (upcoming.length) return fromRow(upcoming[0], 'annonce');

    // Rien d'annoncé : on projette le dernier exercice réellement versé,
    // sans date — ce n'est pas un engagement de l'émetteur.
    var past = divs.slice().sort(function (a, b) {
      return Number(b.exercice || b.annee || 0) - Number(a.exercice || a.annee || 0);
    });
    return past[0] ? fromRow(past[0], 'estimation') : null;
  }

  /** Idem, ramené à une quantité de titres (détenue ou simulée). */
  function forecastForQuantity(ticker, quantite) {
    var nd = nextDividend(ticker);
    if (!nd) return null;
    var q = Number(quantite) || 0;
    var out = {};
    for (var k in nd) out[k] = nd[k];
    out.quantite = q;
    out.montantBrut = nd.brut != null ? Math.round(nd.brut * q * 100) / 100 : null;
    out.montantNet = nd.net != null ? Math.round(nd.net * q * 100) / 100 : null;
    return out;
  }

  /**
   * Revenu de dividendes prévisionnel pour un ensemble de positions
   * [{ticker, qty}], triées par montant net attendu décroissant. Ignore les
   * titres sans aucun historique de dividende.
   */
  function forecastForPositions(positions) {
    var rows = (positions || []).map(function (p) {
      return forecastForQuantity(p.ticker, p.qty != null ? p.qty : p.quantite);
    }).filter(Boolean);
    rows.sort(function (a, b) { return (b.montantNet || 0) - (a.montantNet || 0); });
    var total = rows.reduce(function (s, r) { return s + (r.montantNet || 0); }, 0);
    return { rows: rows, total: Math.round(total * 100) / 100 };
  }

  window.tcNextDividend = nextDividend;
  window.tcDividendForecast = forecastForQuantity;
  window.tcPortfolioDividendForecast = forecastForPositions;
})();
