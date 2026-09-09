// ============================================================================
// COURS AJUSTÉS  (P0 roadmap — la table `historique` ne stocke que le brut)
// window.tcAdjustedSeries(ticker, rows) : renvoie une COPIE des lignes avec un
// champ `cours_ajuste` = clôture rétro-ajustée des détachements de dividende.
// Méthode standard : facteur_i = (clôture_veille_ex − dividende) / clôture_veille_ex,
// appliqué en produit cumulé à toutes les séances antérieures à l'ex-date.
// Aucune donnée inventée : sans dividende connu, cours_ajuste = clôture brute.
// ============================================================================
(function () {
  'use strict';
  if (window.tcAdjustedSeries) return;

  function close(r) {
    return Number(r && (r.cours_cloture != null ? r.cours_cloture : r.cours_normal != null ? r.cours_normal : r.cours));
  }
  function ymd(v) { return v ? String(v).slice(0, 10) : ''; }

  function dividendsFor(ticker) {
    var t = String(ticker || '').toUpperCase();
    return (Array.isArray(window.allDividendes) ? window.allDividendes : [])
      .filter(function (d) { return d && String(d.ticker).toUpperCase() === t; })
      .map(function (d) {
        return {
          ex: ymd(d.date_detachement || d.ex_date),
          montant: Number(d.montant_net != null ? d.montant_net : d.montant)
        };
      })
      .filter(function (d) { return d.ex && isFinite(d.montant) && d.montant > 0; })
      .sort(function (a, b) { return a.ex < b.ex ? -1 : 1; });
  }

  window.tcAdjustedSeries = function (ticker, rows) {
    var src = Array.isArray(rows) ? rows.slice() : [];
    src.sort(function (a, b) {
      var da = ymd(a && a.date_seance), db = ymd(b && b.date_seance);
      return da < db ? -1 : da > db ? 1 : 0;
    });
    var out = src.map(function (r) {
      var o = {};
      for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k];
      o.cours_ajuste = close(r);
      return o;
    });
    var divs = dividendsFor(ticker);
    if (!divs.length || out.length < 2) return out;

    // Pour chaque ex-date : clôture de la dernière séance STRICTEMENT avant l'ex-date.
    divs.forEach(function (d) {
      var prevClose = null;
      for (var i = 0; i < out.length; i++) {
        var day = ymd(out[i].date_seance);
        if (day && day < d.ex) prevClose = close(out[i]);
        else if (day && day >= d.ex) break;
      }
      if (prevClose == null || !(prevClose > 0)) return;
      var factor = (prevClose - d.montant) / prevClose;
      if (!(factor > 0) || factor >= 1) return;
      // applique le facteur à toutes les séances antérieures à l'ex-date
      for (var j = 0; j < out.length; j++) {
        var dj = ymd(out[j].date_seance);
        if (dj && dj < d.ex) out[j].cours_ajuste = Number(out[j].cours_ajuste) * factor;
      }
    });
    return out;
  };
})();
