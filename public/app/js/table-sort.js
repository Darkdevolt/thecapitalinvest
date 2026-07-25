// TABLE SORTING UTILITIES
(function() {
  if (window.__TC_TABLE_SORT_LOADED__) return;
  window.__TC_TABLE_SORT_LOADED__ = true;

  window._sortState = {};

  function sortTable(tbodyId, colIndex) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const key = tbodyId + '-' + colIndex;
    const dir = window._sortState[key] === 'asc' ? 'desc' : 'asc';
    window._sortState[key] = dir;

    rows.sort((a, b) => {
      let av = a.cells[colIndex]?.textContent.trim() || '';
      let bv = b.cells[colIndex]?.textContent.trim() || '';
      const an = parseFloat(av.replace(/[^\d\-,.]/g, '').replace(',', '.'));
      const bn = parseFloat(bv.replace(/[^\d\-,.]/g, '').replace(',', '.'));
      
      if (!isNaN(an) && !isNaN(bn)) {
        return dir === 'asc' ? an - bn : bn - an;
      }
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    rows.forEach(r => tbody.appendChild(r));
  }

  window.sortTable = sortTable;
  console.log('[TABLE-SORT] Charge avec succes');
})();
