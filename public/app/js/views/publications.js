// ============================================================================
// CALENDRIER UNIFIÉ v2  (P1 roadmap)
// Événements financiers : détachement de dividende · paiement · publication
// d'états financiers. Groupés par mois, à venir en premier. Filtre par type,
// recherche, export iCal (.ics). Clic → fiche.
// Sources : allDividendes (dividendes_calendrier) · allFinancials.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_CALENDAR_V2__) return;
  window.__TC_CALENDAR_V2__ = true;

  var STATE = { type: 'all', q: '' };
  var MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var TYPES = {
    detachement: { l: 'Détachement', c: 'var(--gold-l)' },
    paiement: { l: 'Paiement', c: 'var(--green)' },
    publication: { l: 'Publication', c: 'var(--blue)' }
  };

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function nf(v) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : null; }
  function nom(t) { return (window.entMap && window.entMap[t] && window.entMap[t].nom) || t; }
  function ymd(v) {
    if (!v) return null;
    var s = String(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  function collect() {
    var ev = [];
    (Array.isArray(window.allDividendes) ? window.allDividendes : []).forEach(function (d) {
      if (!d || !d.ticker) return;
      var t = String(d.ticker).toUpperCase();
      var ex = String(d.exercice || d.annee || '');
      var mnt = d.montant_net != null ? d.montant_net : d.montant;
      var dd = ymd(d.date_detachement || d.ex_date);
      var dp = ymd(d.date_paiement_cal || d.date_paiement);
      var sub = (nf(mnt) ? nf(mnt) + ' FCFA' : '') + (ex ? (nf(mnt) ? ' · ' : '') + 'exercice ' + ex : '');
      if (dd) ev.push({ date: dd, type: 'detachement', ticker: t, title: 'Détachement du dividende', sub: sub, statut: d.statut || '' });
      if (dp) ev.push({ date: dp, type: 'paiement', ticker: t, title: 'Paiement du dividende', sub: sub, statut: d.statut || '' });
    });
    (Array.isArray(window.allFinancials) ? window.allFinancials : []).forEach(function (f) {
      if (!f || !f.ticker) return;
      var dpub = ymd(f.date_publication);
      if (!dpub) return;
      var t = String(f.ticker).toUpperCase();
      var per = f.periode && f.periode !== 'annuel' ? String(f.periode).toUpperCase() : 'annuels';
      ev.push({ date: dpub, type: 'publication', ticker: t, title: 'Publication des comptes ' + per + ' ' + (f.annee || ''), sub: '', statut: f.validation_status || '' });
    });
    // dédup
    var seen = {};
    ev = ev.filter(function (e) {
      var k = e.date + '|' + e.type + '|' + e.ticker + '|' + e.title;
      if (seen[k]) return false; seen[k] = 1; return true;
    });
    ev.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.ticker.localeCompare(b.ticker); });
    return ev;
  }

  function filtered(ev) {
    var q = STATE.q.toLowerCase();
    return ev.filter(function (e) {
      if (STATE.type !== 'all' && e.type !== STATE.type) return false;
      if (q && e.ticker.toLowerCase().indexOf(q) < 0 && nom(e.ticker).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function ics(ev) {
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Capital//Calendrier BRVM//FR', 'CALSCALE:GREGORIAN'];
    ev.forEach(function (e, i) {
      var d = e.date.replace(/-/g, '');
      lines.push('BEGIN:VEVENT');
      lines.push('UID:tc-' + i + '-' + e.ticker + '-' + d + '@thecapitalinvest');
      lines.push('DTSTART;VALUE=DATE:' + d);
      lines.push('SUMMARY:' + e.ticker + ' — ' + e.title + (e.sub ? ' (' + e.sub + ')' : ''));
      lines.push('DESCRIPTION:' + nom(e.ticker) + ' · ' + (TYPES[e.type] ? TYPES[e.type].l : e.type));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'calendrier-brvm.ics'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function injectCss() {
    if (document.getElementById('tc-cal-v2-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-cal-v2-css';
    s.textContent = [
      '#view-publications{padding:24px clamp(14px,3vw,32px) 56px;max-width:1040px;margin-inline:auto}',
      '#view-publications .cal-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px}',
      '#view-publications .cal-bar input{flex:1 1 220px;min-width:0;background:var(--surface);border:1px solid var(--border2);border-radius:8px;color:var(--cream);padding:8px 12px;font:400 12px var(--sans);outline:none}',
      '#view-publications .cal-bar input:focus{border-color:var(--gold)}',
      '#view-publications .cal-f{border:1px solid var(--border2);background:transparent;color:var(--muted);border-radius:999px;padding:5px 12px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.05em;cursor:pointer}',
      '#view-publications .cal-f.on{color:var(--gold-l);border-color:var(--gold);background:var(--gold-bg)}',
      '#view-publications .cal-ics{margin-left:auto;border:1px solid var(--border2);background:transparent;color:var(--gold-l);border-radius:7px;padding:6px 12px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.06em;cursor:pointer}',
      '#view-publications .cal-month{margin-top:22px}',
      '#view-publications .cal-month-h{font:600 10px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--gold);padding-bottom:8px;border-bottom:1px solid var(--border2);margin-bottom:10px}',
      '#view-publications .cal-row{display:grid;grid-template-columns:56px 1fr auto;gap:14px;align-items:center;padding:11px 8px;border-bottom:1px solid var(--border2);cursor:pointer}',
      '#view-publications .cal-row:hover{background:rgba(184,150,78,.05)}',
      '#view-publications .cal-d{text-align:center;font:600 15px/1 var(--mono);color:var(--cream)}',
      '#view-publications .cal-d small{display:block;font:400 9px var(--sans);color:var(--dim);margin-top:3px;text-transform:uppercase}',
      '#view-publications .cal-main .t{font:500 13px var(--sans);color:var(--cream)}',
      '#view-publications .cal-main .s{font:400 11px var(--sans);color:var(--muted);margin-top:2px}',
      '#view-publications .cal-badge{font:700 8px var(--sans);letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}',
      '#view-publications .cal-tkr{font:600 11px var(--mono);color:var(--gold);margin-right:8px}',
      '#view-publications .cal-empty{padding:40px;text-align:center;color:var(--dim);font-size:13px}',
      '#view-publications .cal-past{opacity:.5}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function draw() {
    var view = document.getElementById('view-publications');
    if (!view) return;
    var all = collect();
    var rows = filtered(all);
    var today = new Date().toISOString().slice(0, 10);

    var body;
    if (!rows.length) {
      body = '<div class="cal-empty">Aucun événement dans le calendrier pour ces critères.<br>Les dates proviennent de <code>dividendes_calendrier</code> et des dates de publication des états financiers.</div>';
    } else {
      // à venir d'abord, puis passé (récent -> ancien)
      var future = rows.filter(function (e) { return e.date >= today; });
      var past = rows.filter(function (e) { return e.date < today; }).reverse();
      var ordered = future.concat(past);
      var groups = {}, order = [];
      ordered.forEach(function (e) {
        var key = e.date.slice(0, 7);
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(e);
      });
      body = order.map(function (key) {
        var y = key.slice(0, 4), m = Number(key.slice(5, 7)) - 1;
        return '<div class="cal-month"><div class="cal-month-h">' + MONTHS[m] + ' ' + y + '</div>'
          + groups[key].map(function (e) {
            var T = TYPES[e.type] || { l: e.type, c: 'var(--muted)' };
            var dd = e.date.slice(8, 10);
            var past = e.date < today;
            return '<div class="cal-row ' + (past ? 'cal-past' : '') + '" onclick="openFiche && openFiche(\'' + esc(e.ticker) + '\',\'publications\')">'
              + '<div class="cal-d">' + dd + '<small>' + MONTHS[m].replace('.', '') + '</small></div>'
              + '<div class="cal-main"><div class="t"><span class="cal-tkr">' + esc(e.ticker) + '</span>' + esc(e.title) + '</div>'
              + '<div class="s">' + esc(nom(e.ticker)) + (e.sub ? ' · ' + esc(e.sub) : '') + (e.statut ? ' · ' + esc(e.statut) : '') + '</div></div>'
              + '<span class="cal-badge" style="color:' + T.c + '">' + T.l + '</span></div>';
          }).join('') + '</div>';
      }).join('');
    }

    view.innerHTML =
      '<div class="page-header"><h1>Calendrier <span style="color:var(--gold)">financier</span></h1>'
      + '<p>Détachements, paiements de dividendes et publications de comptes — ' + all.length + ' événements.</p></div>'
      + '<div class="cal-bar"><input id="calQ" placeholder="Filtrer par ticker ou société…" value="' + esc(STATE.q) + '">'
      + [['all', 'Tous'], ['detachement', 'Détachement'], ['paiement', 'Paiement'], ['publication', 'Publication']].map(function (f) {
        return '<button type="button" class="cal-f ' + (STATE.type === f[0] ? 'on' : '') + '" data-t="' + f[0] + '">' + f[1] + '</button>';
      }).join('')
      + '<button type="button" class="cal-ics" id="calIcs">Export iCal</button></div>'
      + body;

    var q = document.getElementById('calQ');
    q.addEventListener('input', function () { STATE.q = this.value; var pos = this.selectionStart; draw(); var nq = document.getElementById('calQ'); if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} } });
    view.querySelectorAll('.cal-f').forEach(function (b) {
      b.addEventListener('click', function () { STATE.type = b.getAttribute('data-t'); draw(); });
    });
    document.getElementById('calIcs').addEventListener('click', function () { ics(filtered(all)); });
  }

  function renderPublications() { injectCss(); draw(); }
  window.renderPublications = renderPublications;
  window.filterPublications = renderPublications;
  window.setPubFilter = function (f) { STATE.type = (f === 'annuel' || f === 's1' || f === 't1' || f === 't2' || f === 't3') ? 'publication' : (f || 'all'); renderPublications(); };
})();
