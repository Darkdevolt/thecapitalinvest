/**
 * Tri des colonnes de tableau.
 *
 * Ce fichier était référencé par app.html et appelé par six en-têtes de colonne
 * (onclick="sortTable('coursTable', n)") mais n'existait pas dans le dépôt :
 * chaque clic sur un en-tête levait une ReferenceError et ne triait rien.
 *
 * Le tri s'applique au <tbody> désigné, sans toucher aux données sous-jacentes,
 * et distingue les valeurs numériques (cours, variations, volumes, formats
 * français « 12 345,67 » et pourcentages) du texte.
 */
(function () {
  'use strict';

  var directions = Object.create(null);

  /** Convertit un contenu de cellule en nombre, ou renvoie NaN si c'est du texte. */
  function toNumber(text) {
    var raw = String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[%+]/g, '')
      .replace(/FCFA|XOF/gi, '')
      .trim();
    if (!raw || raw === '-' || raw === '—') return NaN;

    var negative = /^\(.*\)$/.test(raw);
    if (negative) raw = raw.slice(1, -1);

    // Format français : espaces comme séparateurs de milliers, virgule décimale.
    if (raw.indexOf(',') > -1) raw = raw.replace(/[\s.]/g, '').replace(',', '.');
    else raw = raw.replace(/\s/g, '');

    if (!/^-?\d*\.?\d+$/.test(raw)) return NaN;
    var value = Number(raw);
    return negative ? -value : value;
  }

  function cellValue(row, index) {
    var cell = row.cells && row.cells[index];
    if (!cell) return '';
    return (cell.getAttribute('data-sort') || cell.textContent || '').trim();
  }

  window.sortTable = function sortTable(tbodyId, columnIndex) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    var rows = Array.prototype.slice.call(tbody.rows)
      .filter(function (row) { return row.cells.length > columnIndex; });
    if (rows.length < 2) return;

    var key = tbodyId + ':' + columnIndex;
    var ascending = directions[key] !== 'asc';
    directions[key] = ascending ? 'asc' : 'desc';

    rows.sort(function (a, b) {
      var left = cellValue(a, columnIndex);
      var right = cellValue(b, columnIndex);
      var nLeft = toNumber(left);
      var nRight = toNumber(right);
      var bothNumeric = !isNaN(nLeft) && !isNaN(nRight);

      // Les cellules vides restent en fin de tri, quel que soit le sens.
      if (!left && right) return 1;
      if (left && !right) return -1;

      var result = bothNumeric
        ? nLeft - nRight
        : left.localeCompare(right, 'fr', { sensitivity: 'base', numeric: true });
      return ascending ? result : -result;
    });

    var fragment = document.createDocumentFragment();
    rows.forEach(function (row) { fragment.appendChild(row); });
    tbody.appendChild(fragment);
  };
})();
