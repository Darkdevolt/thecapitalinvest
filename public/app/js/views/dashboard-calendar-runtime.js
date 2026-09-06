/* THE CAPITAL — dashboard calendar integrity runtime
 * Only real dates returned by the existing dividend/coupon datasets are shown.
 * No placeholder day, month or synthetic publication date is ever generated.
 */
(function (w, d) {
  'use strict';
  if (w.__TC_DASHBOARD_CALENDAR_RUNTIME__) return;
  w.__TC_DASHBOARD_CALENDAR_RUNTIME__ = true;

  function dateInfo(value) {
    if (!value) return null;
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return {
      time: date.getTime(),
      day: date.toLocaleDateString('fr-FR', { day: '2-digit' }),
      month: date.toLocaleDateString('fr-FR', { month: 'short' }),
      full: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    };
  }

  function esc(value) {
    var el = d.createElement('div');
    el.textContent = value == null ? '' : String(value);
    return el.innerHTML;
  }

  function buildRows() {
    var rows = [];
    (Array.isArray(w.allDividendes) ? w.allDividendes : []).forEach(function (row) {
      var detach = dateInfo(row && (row.date_detachement || row.ex_date));
      var pay = dateInfo(row && row.date_paiement);
      rows.push({
        instrument: row && row.ticker || row && row.code || '',
        nature: 'Dividende',
        detach: detach,
        pay: pay,
        status: row && row.statut || 'confirmé',
        detail: row && row.annee ? 'Exercice ' + row.annee : ''
      });
    });
    (Array.isArray(w.allCoupons) ? w.allCoupons : []).forEach(function (row) {
      var detach = dateInfo(row && row.date_detachement);
      var pay = dateInfo(row && row.date_paiement);
      rows.push({
        instrument: row && (row.code || row.isin || row.ticker) || '',
        nature: 'Coupon',
        detach: detach,
        pay: pay,
        status: row && row.statut || 'prévisionnel',
        detail: row && row.numero_coupon != null ? 'Coupon n°' + row.numero_coupon : ''
      });
    });
    return rows.filter(function (row) { return row.instrument && (row.detach || row.pay); });
  }

  function render() {
    var container = d.getElementById('newsFeed') || d.getElementById('pubFeed');
    if (!container) return false;

    var rows = buildRows();
    var now = Date.now();
    var upcoming = rows.map(function (row) {
      var dates = [row.detach, row.pay].filter(Boolean).filter(function (date) { return date.time >= now; }).sort(function (a, b) { return a.time - b.time; });
      return dates.length ? Object.assign({}, row, { next: dates[0] }) : null;
    }).filter(Boolean).sort(function (a, b) { return a.next.time - b.next.time; }).slice(0, 5);

    var title = 'Prochaines échéances';
    if (!upcoming.length) {
      upcoming = rows.map(function (row) {
        var dates = [row.pay, row.detach].filter(Boolean).sort(function (a, b) { return b.time - a.time; });
        return dates.length ? Object.assign({}, row, { next: dates[0] }) : null;
      }).filter(Boolean).sort(function (a, b) { return b.next.time - a.next.time; }).slice(0, 5);
      title = 'Dernières échéances';
    }

    container.classList.remove('dashboard-news-grid');
    container.classList.add('tc-calendar-body');
    var parent = container.closest('.dashboard-news') || container.parentElement;
    if (parent) {
      var eyebrow = parent.querySelector('.eyebrow');
      var cardTitle = parent.querySelector('.card-title');
      var refresh = parent.querySelector('.news-refresh');
      if (eyebrow) eyebrow.textContent = 'CALENDRIER MARCHÉ';
      if (cardTitle) cardTitle.textContent = title;
      if (refresh) {
        refresh.removeAttribute('onclick');
        refresh.onclick = function () { render(); };
      }
    }

    if (!upcoming.length) {
      container.innerHTML = '<div class="tc-calendar-empty">Aucune échéance réelle renseignée.</div>';
      return true;
    }

    container.innerHTML = upcoming.map(function (row) {
      var details = [];
      if (row.detach) details.push('Détachement ' + row.detach.full);
      if (row.pay) details.push('Paiement ' + row.pay.full);
      if (row.detail) details.push(row.detail);
      return '<div class="tc-calendar-item">' +
        '<div class="tc-calendar-date"><strong>' + esc(row.next.day) + '</strong>' + esc(row.next.month) + '</div>' +
        '<div class="tc-calendar-info"><div class="tc-calendar-ticker">' + esc(row.instrument) + ' · ' + esc(row.nature) + '</div>' +
        '<div class="tc-calendar-desc">' + esc(details.join(' · ')) + '</div></div>' +
        '<span class="tc-calendar-badge">' + esc(row.status) + '</span></div>';
    }).join('');
    return true;
  }

  function schedule() {
    setTimeout(render, 50);
  }

  w.addEventListener('tc:dataready', function (event) {
    var phase = event && event.detail && event.detail.phase;
    if (phase === 'enrichment' || phase === 'ondemand') schedule();
  });
  w.addEventListener('load', schedule);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})(window, document);
