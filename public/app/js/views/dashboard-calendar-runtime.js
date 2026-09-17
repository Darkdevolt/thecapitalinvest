/* THE CAPITAL — dashboard calendar integrity runtime
 * The calendar is deliberately isolated from the news feed.
 * Only real dividend/coupon dates are displayed.
 */
(function (w, d) {
  'use strict';
  if (w.__TC_DASHBOARD_CALENDAR_RUNTIME__) return;
  w.__TC_DASHBOARD_CALENDAR_RUNTIME__ = true;

  var retryCount = 0, retryTimer = null;

  function esc(value) {
    var el = d.createElement('div');
    el.textContent = value == null ? '' : String(value);
    return el.innerHTML;
  }

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

  function buildRows() {
    var rows = [];
    (Array.isArray(w.allDividendes) ? w.allDividendes : []).forEach(function (row) {
      var detach = dateInfo(row && (row.date_detachement || row.ex_date));
      var pay = dateInfo(row && row.date_paiement);
      if (row && row.ticker && (detach || pay)) rows.push({ instrument: row.ticker, nature: 'Dividende', detach: detach, pay: pay, status: row.statut || 'confirmé', detail: row.annee ? 'Exercice ' + row.annee : '' });
    });
    (Array.isArray(w.allCoupons) ? w.allCoupons : []).forEach(function (row) {
      var detach = dateInfo(row && row.date_detachement);
      var pay = dateInfo(row && row.date_paiement);
      var instrument = row && (row.code || row.isin || row.ticker);
      if (instrument && (detach || pay)) rows.push({ instrument: instrument, nature: 'Coupon', detach: detach, pay: pay, status: row.statut || 'prévisionnel', detail: row.numero_coupon != null ? 'Coupon n°' + row.numero_coupon : '' });
    });
    return rows;
  }

  function ensureCalendarCard() {
    var existing = d.getElementById('tcMarketCalendar');
    if (existing) return existing;
    var news = d.querySelector('#view-overview .dashboard-news');
    var stats = d.getElementById('overviewStats');
    var anchor = news || stats;
    if (!anchor || !anchor.parentElement) return null;

    var section = d.createElement('section');
    section.id = 'tcMarketCalendar';
    section.className = 'dashboard-news tc-market-calendar card';
    section.setAttribute('aria-label', 'Calendrier marché');
    section.innerHTML = '<div class="dashboard-news-head"><div><div class="eyebrow">CALENDRIER MARCHÉ</div><div class="card-title">Prochaines échéances</div></div><button type="button" class="news-refresh tc-calendar-refresh">Actualiser</button></div><div id="tcCalendarFeed" class="tc-calendar-body"><div class="tc-calendar-empty">Chargement…</div></div>';
    anchor.parentElement.insertBefore(section, anchor);
    return section;
  }

  function render() {
    var section = ensureCalendarCard();
    if (!section) return { rendered: false, hasData: false };
    var container = d.getElementById('tcCalendarFeed');
    if (!container) return { rendered: false, hasData: false };

    var rows = buildRows(), now = Date.now();
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

    var titleEl = section.querySelector('.card-title');
    if (titleEl) titleEl.textContent = title;
    var refresh = section.querySelector('.tc-calendar-refresh');
    if (refresh && !refresh.dataset.bound) {
      refresh.dataset.bound = '1';
      refresh.addEventListener('click', function () { retryCount = 0; schedule(0); });
    }

    if (!upcoming.length) {
      container.innerHTML = '<div class="tc-calendar-empty">Aucune échéance réelle renseignée.</div>';
      return { rendered: true, hasData: rows.length > 0 };
    }

    container.innerHTML = upcoming.map(function (row) {
      var details = [];
      if (row.detach) details.push('Détachement ' + row.detach.full);
      if (row.pay) details.push('Paiement ' + row.pay.full);
      if (row.detail) details.push(row.detail);
      return '<div class="tc-calendar-item ' + (row.next.time < now ? 'is-past' : 'is-future') + '"><div class="tc-calendar-date"><strong>' + esc(row.next.day) + '</strong>' + esc(row.next.month) + '</div><div class="tc-calendar-info"><div class="tc-calendar-ticker">' + esc(row.instrument) + ' · ' + esc(row.nature) + ' <span class="tc-calendar-when">' + (row.next.time < now ? 'Passé' : 'À venir') + '</span></div><div class="tc-calendar-desc">' + esc(details.join(' · ')) + '</div></div><span class="tc-calendar-badge">' + esc(row.status) + '</span></div>';
    }).join('');
    return { rendered: true, hasData: true };
  }

  function injectCSS() {
    if (d.getElementById('tc-calendar-runtime-style')) return;
    var style = d.createElement('style');
    style.id = 'tc-calendar-runtime-style';
    style.textContent = [
      '#view-overview .tc-market-calendar{margin:0 0 14px;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,rgba(27,23,18,.98),rgba(18,16,13,.98));border:1px solid rgba(184,150,78,.16);box-shadow:0 8px 28px rgba(0,0,0,.22)}',
      '#view-overview .tc-market-calendar .dashboard-news-head{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:54px;padding:12px 16px;background:rgba(184,150,78,.045);border-bottom:1px solid rgba(184,150,78,.12)}',
      '#view-overview .tc-market-calendar .dashboard-news-head>div:first-child{min-width:0;flex:1}',
      '#view-overview .tc-market-calendar .eyebrow{margin:0 0 3px;font:600 8px/1 var(--sans);letter-spacing:.16em;color:var(--gold);text-transform:uppercase}',
      '#view-overview .tc-market-calendar .card-title{margin:0;font:600 12px/1.15 var(--sans);letter-spacing:.08em;color:var(--cream);text-transform:uppercase}',
      '#view-overview .tc-market-calendar .news-refresh{flex:0 0 auto;height:27px;padding:0 10px;border:1px solid rgba(184,150,78,.2);border-radius:6px;background:rgba(184,150,78,.055);color:var(--muted);font:500 9px var(--sans);cursor:pointer;white-space:nowrap}',
      '#view-overview .tc-calendar-body{display:block!important;padding:2px 16px 4px}',
      '#view-overview .tc-calendar-item{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(184,150,78,.07);min-width:0}',
      '#view-overview .tc-calendar-item:last-child{border-bottom:0}',
      '#view-overview .tc-calendar-date{font-family:var(--mono);font-size:9px;color:var(--gold);text-align:center;line-height:1.15}',
      '#view-overview .tc-calendar-date strong{display:block;font-size:17px;line-height:1.05}',
      '#view-overview .tc-calendar-info{min-width:0}',
      '#view-overview .tc-calendar-ticker{font-family:var(--mono);font-size:10px;color:var(--cream);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#view-overview .tc-calendar-when{margin-left:6px;font-family:var(--sans);font-size:8px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}',
      '#view-overview .tc-calendar-desc{font:500 9px/1.3 var(--sans);color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#view-overview .tc-calendar-badge{font:600 8px var(--sans);letter-spacing:.04em;text-transform:uppercase;padding:4px 7px;border:1px solid var(--border2);border-radius:999px;color:var(--muted);white-space:nowrap}',
      '#view-overview .tc-calendar-empty{padding:18px 8px;text-align:center;color:var(--dim);font:500 10px var(--sans)}',
      '@media(max-width:700px){#view-overview .tc-calendar-item{grid-template-columns:48px minmax(0,1fr) auto;gap:7px}}'
    ].join('');
    d.head.appendChild(style);
  }

  function schedule(delay) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(function () {
      retryTimer = null;
      var result = render();
      if (result && !result.hasData && retryCount < 20) { retryCount += 1; schedule(250); }
      else retryCount = 0;
    }, delay == null ? 50 : delay);
  }

  injectCSS();
  w.addEventListener('tc:dataready', function () { retryCount = 0; schedule(30); });
  w.addEventListener('load', function () { retryCount = 0; schedule(50); });
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { schedule(50); }, { once: true });
  else schedule(50);
})(window, document);
