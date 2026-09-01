// THE CAPITAL — Dashboard market-data/UI fixes
(function () {
  'use strict';
  if (window.__TC_OVERVIEW_FIXES__) return;
  window.__TC_OVERVIEW_FIXES__ = true;

  /*
   * Ce module ne doit jamais remplacer renderOverview().
   * L'ancienne version interceptait chaque rendu, lançait plusieurs requêtes
   * puis recréait le graphique une seconde fois. Comme main.js rend la vue à
   * chaque arrivée de données, cela pouvait monopoliser le thread principal.
   *
   * Le correctif est maintenant passif : CSS + calendrier chargé une seule
   * fois après le bootstrap principal. Le rendu du dashboard reste sous le
   * contrôle de main.js.
   */

  function injectCSS() {
    if (document.getElementById('tc-dashboard-market-fixes')) return;
    var style = document.createElement('style');
    style.id = 'tc-dashboard-market-fixes';
    style.textContent = [
      '#topMovers .movers-label-row,#topMovers .mover-row{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(76px,auto) minmax(78px,92px);align-items:center;column-gap:8px}',
      '#topMovers .movers-label-row{padding:5px 12px 7px}',
      '#topMovers .mover-row{min-width:0;padding:9px 12px}',
      '#topMovers .mover-security{min-width:0;overflow:hidden}',
      '#topMovers .mover-symbol,#topMovers .mover-name{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#topMovers .mover-price{white-space:nowrap;text-align:right;font-family:var(--mono);font-size:11px}',
      '#topMovers .mover-change{text-align:right;min-width:0;overflow:visible}',
      '#topMovers .mover-change-value{display:inline-block;white-space:nowrap;font-family:var(--mono);font-size:11px;font-weight:600}',
      '.tc-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}',
      '.tc-calendar-status{font-family:var(--mono);font-size:10px;color:var(--dim);white-space:nowrap}',
      '.tc-calendar-body{display:block!important;padding:0 4px}',
      '.tc-calendar-item{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(184,150,78,.06)}',
      '.tc-calendar-item:last-child{border-bottom:0}',
      '.tc-calendar-date{font-family:var(--mono);font-size:11px;color:var(--gold);text-align:center;line-height:1.2}',
      '.tc-calendar-date strong{display:block;font-size:16px}',
      '.tc-calendar-info{min-width:0}',
      '.tc-calendar-ticker{font-family:var(--mono);font-size:11px;color:var(--cream);font-weight:600}',
      '.tc-calendar-desc{font-size:11px;color:var(--dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tc-calendar-badge{font-size:9px;padding:3px 6px;border:1px solid var(--border2);border-radius:999px;color:var(--muted);white-space:nowrap;text-transform:uppercase}',
      '.tc-calendar-empty{padding:20px 8px;text-align:center;color:var(--dim);font-size:12px}',
      '@media(max-width:700px){#topMovers .movers-label-row,#topMovers .mover-row{grid-template-columns:22px minmax(0,1fr) minmax(64px,auto) minmax(62px,78px);column-gap:5px}.tc-calendar-item{grid-template-columns:48px minmax(0,1fr) auto;gap:7px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function esc(value) {
    var d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function dateInfo(value) {
    if (!value) return null;
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return { day: d.toLocaleDateString('fr-FR', { day: '2-digit' }), month: d.toLocaleDateString('fr-FR', { month: 'short' }), time: d.getTime() };
  }

  function renderCalendar() {
    var container = document.getElementById('newsFeed') || document.getElementById('pubFeed');
    if (!container) return;
    var list = [];

    (Array.isArray(window.allDividendes) ? window.allDividendes : []).forEach(function (row) {
      list.push({
        instrument: row && row.ticker || '—',
        nature: 'dividende',
        detach: dateInfo(row && (row.date_detachement || row.ex_date)),
        pay: dateInfo(row && row.date_paiement),
        status: row && row.statut || 'confirmé',
        detail: row && row.annee ? 'Exercice ' + row.annee : ''
      });
    });

    (Array.isArray(window.allCoupons) ? window.allCoupons : []).forEach(function (row) {
      list.push({
        instrument: row && (row.code || row.isin) || '—',
        nature: 'coupon',
        detach: dateInfo(row && row.date_detachement),
        pay: dateInfo(row && row.date_paiement),
        status: row && row.statut || 'prévisionnel',
        detail: row && row.numero_coupon != null ? 'Coupon n°' + row.numero_coupon : 'Coupon'
      });
    });

    var now = Date.now();
    var items = list.map(function (item) {
      var next = [item.detach, item.pay].filter(Boolean).filter(function (d) { return d.time >= now; }).sort(function (a, b) { return a.time - b.time; })[0];
      return next ? Object.assign({}, item, { next: next }) : null;
    }).filter(Boolean).sort(function (a, b) { return a.next.time - b.next.time; }).slice(0, 5);

    var title = 'Prochaines échéances';
    if (!items.length) {
      items = list.map(function (item) {
        var last = [item.pay, item.detach].filter(Boolean).sort(function (a, b) { return b.time - a.time; })[0];
        return last ? Object.assign({}, item, { next: last }) : null;
      }).filter(Boolean).sort(function (a, b) { return b.next.time - a.next.time; }).slice(0, 5);
      title = 'Dernières échéances';
    }

    container.classList.remove('dashboard-news-grid');
    container.classList.add('tc-calendar-body');

    var parent = container.closest('.dashboard-news') || container.parentElement;
    if (parent) {
      var eyebrow = parent.querySelector('.eyebrow');
      var cardTitle = parent.querySelector('.card-title');
      if (eyebrow) eyebrow.textContent = 'CALENDRIER MARCHÉ';
      if (cardTitle) cardTitle.textContent = title;
    }

    if (!items.length) {
      container.innerHTML = '<div class="tc-calendar-empty">Aucune échéance renseignée.</div>';
      return;
    }

    container.innerHTML = items.map(function (item) {
      var details = [];
      if (item.detach) details.push('Détachement ' + item.detach.day + ' ' + item.detach.month);
      if (item.pay) details.push('Paiement ' + item.pay.day + ' ' + item.pay.month);
      if (item.detail) details.push(item.detail);
      return '<div class="tc-calendar-item"><div class="tc-calendar-date"><strong>' + item.next.day + '</strong>' + item.next.month + '</div>' +
        '<div class="tc-calendar-info"><div class="tc-calendar-ticker">' + esc(item.instrument) + ' · ' + esc(item.nature) + '</div>' +
        '<div class="tc-calendar-desc">' + esc(details.join(' · ')) + '</div></div>' +
        '<span class="tc-calendar-badge">' + esc(item.status) + '</span></div>';
    }).join('');
  }

  async function loadCalendarOnce() {
    if (window.__TC_OVERVIEW_CALENDAR_LOADED__) {
      renderCalendar();
      return;
    }
    window.__TC_OVERVIEW_CALENDAR_LOADED__ = true;
    try {
      var jobs = [];
      if (!Array.isArray(window.allDividendes) || !window.allDividendes.length) jobs.push(window.apiGet('/marche?type=dividendes'));
      if (!Array.isArray(window.allCoupons)) jobs.push(window.apiGet('/marche?type=coupons'));
      if (jobs.length) await Promise.allSettled(jobs);
    } catch (e) {
      console.warn('[OVERVIEW FIX] Calendrier indisponible:', e);
    }
    renderCalendar();
  }

  injectCSS();
  window.addEventListener('tc:dataready', loadCalendarOnce, { once: true });
  setTimeout(loadCalendarOnce, 1500);
})();
