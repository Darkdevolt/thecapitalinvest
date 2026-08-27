/* The Capital — account history model + CSV export helper.
 * Keeps account movements separate from the trading journal.
 */
(function () {
  'use strict';

  window.TheCapitalAccountHistory = {
    TYPES: ['apport', 'retrait', 'achat', 'vente', 'dividende', 'frais', 'tva', 'autre'],

    normalize: function (rows) {
      return (Array.isArray(rows) ? rows : []).map(function (r) {
        return {
          date: r.date || r.created_at || '',
          type: r.type || 'autre',
          instrument: r.instrument || r.symbol || '',
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
          fees: Number(r.fees || r.frais || 0),
          vat: Number(r.vat || r.tva || 0),
          balance: r.balance == null ? null : Number(r.balance),
          reference: r.reference || ''
        };
      });
    },

    toCSV: function (rows) {
      var normalized = this.normalize(rows);
      var headers = ['Date','Type','Instrument','Débit','Crédit','Frais','TVA','Solde','Référence'];
      var esc = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lines = [headers.map(esc).join(';')];
      normalized.forEach(function (r) {
        lines.push([r.date,r.type,r.instrument,r.debit,r.credit,r.fees,r.vat,r.balance == null ? '' : r.balance,r.reference].map(esc).join(';'));
      });
      return '\ufeff' + lines.join('\n');
    },

    downloadCSV: function (rows, filename) {
      var blob = new Blob([this.toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'the-capital-historique-compte.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };
})();
