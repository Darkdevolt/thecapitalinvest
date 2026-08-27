// THE CAPITAL — BRVM market session clock
// Source: official BRVM trading calendar / trading hours (UTC).
// Normal: pre-open 09:00-09:45, opening fixing 09:45,
// continuous 09:45-14:00, pre-close 14:00-14:30,
// closing fixing 14:30, last-price 14:30-15:00, close 15:00.
(function () {
  'use strict';
  if (window.__TC_BRVM_MARKET_HOURS__) return;
  window.__TC_BRVM_MARKET_HOURS__ = true;

  var NORMAL = [
    { id: 'preopen', label: 'Pré-ouverture', start: 540, end: 585 },
    { id: 'open-fixing', label: "Fixing d'ouverture", start: 585, end: 585 },
    { id: 'continuous', label: 'Négociation en continu', start: 585, end: 840 },
    { id: 'preclose', label: 'Pré-clôture', start: 840, end: 870 },
    { id: 'close-fixing', label: 'Fixing de clôture', start: 870, end: 870 },
    { id: 'last-price', label: 'Négociation au dernier cours', start: 870, end: 900 },
    { id: 'closed', label: 'Marché fermé', start: 900, end: 1440 }
  ];

  // BRVM 2026 official calendar: no session on these public holidays.
  // Dates marked (*) in the BRVM calendar can be revised by official notice;
  // exceptional notices remain the authoritative override when published.
  var HOLIDAYS_2026 = {
    '2026-01-01': 'Jour de l’an',
    '2026-03-17': 'Lendemain de la nuit du destin',
    '2026-03-20': 'Fête du Ramadan',
    '2026-04-06': 'Lundi de Pâques',
    '2026-05-01': 'Fête du Travail',
    '2026-05-14': 'Jour de l’Ascension',
    '2026-05-25': 'Lundi de Pentecôte',
    '2026-05-27': 'Fête de Tabaski',
    '2026-08-07': 'Jour de l’Indépendance',
    '2026-08-26': 'Fête de Maouloud',
    '2026-12-25': 'Fête de Noël'
  };

  // Explicit exceptional sessions can be added here when BRVM publishes an
  // official notice. We never infer a shortened session merely because a
  // holiday is tomorrow.
  var EXCEPTIONAL = {};

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }

  function nowUTC() {
    var d = new Date();
    return {
      date: d,
      day: d.getUTCDay(),
      key: dateKey(d),
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60
    };
  }

  function scheduleFor(n) {
    if (EXCEPTIONAL[n.key]) return EXCEPTIONAL[n.key];
    return NORMAL;
  }

  function phaseFor() {
    var n = nowUTC();
    if (n.day === 0 || n.day === 6) {
      return { id: 'closed', label: 'Marché fermé', reason: 'Week-end', minutes: n.minutes, schedule: NORMAL };
    }
    if (HOLIDAYS_2026[n.key]) {
      return { id: 'closed', label: 'Marché fermé', reason: HOLIDAYS_2026[n.key], minutes: n.minutes, holiday: true, schedule: NORMAL };
    }

    var schedule = scheduleFor(n);
    var m = n.minutes;
    var pre = schedule[0];
    var openFix = schedule[1];
    var continuous = schedule[2];
    var preclose = schedule[3];
    var closeFix = schedule[4];
    var last = schedule[5];
    var close = schedule[6];

    if (m < pre.start) return { id: 'closed', label: 'Marché fermé', reason: 'Avant pré-ouverture', minutes: m, next: 'Pré-ouverture à ' + pad(Math.floor(pre.start / 60)) + ':' + pad(pre.start % 60) + ' UTC', schedule: schedule };
    if (m < pre.end) return { id: 'preopen', label: pre.label, reason: 'Carnet d’ordres en pré-ouverture', minutes: m, schedule: schedule };

    // The fixing is an instant with a +/-60s random execution window on the
    // official schedule. We expose it as a distinct state around the scheduled
    // timestamp without pretending to know the exact random second.
    if (Math.abs(m - openFix.start) <= (1 / 60)) return { id: 'open-fixing', label: openFix.label, reason: 'Fixing du prix d’ouverture', minutes: m, schedule: schedule };
    if (m < continuous.end) return { id: 'continuous', label: continuous.label, reason: 'Marché ouvert', minutes: m, schedule: schedule };
    if (m < preclose.end) return { id: 'preclose', label: preclose.label, reason: 'Pré-clôture du marché', minutes: m, schedule: schedule };
    if (Math.abs(m - closeFix.start) <= (1 / 60)) return { id: 'close-fixing', label: closeFix.label, reason: 'Fixing du prix de clôture', minutes: m, schedule: schedule };
    if (m < last.end) return { id: 'last-price', label: last.label, reason: 'Dernier cours', minutes: m, schedule: schedule };
    return { id: 'closed', label: close.label, reason: 'Marché clôturé et officialisé', minutes: m, schedule: schedule };
  }

  function countdown(target, current) {
    var diff = Math.max(0, target - current);
    var total = Math.floor(diff * 60);
    var h = Math.floor(total / 3600);
    var min = Math.floor((total % 3600) / 60);
    var sec = total % 60;
    if (h) return h + ' h ' + pad(min) + ' min';
    return min + ' min ' + pad(sec) + ' s';
  }

  function nextTarget(n) {
    var s = scheduleFor(n);
    var targets = [s[0].start, s[0].end, s[2].end, s[3].end, s[5].end];
    for (var i = 0; i < targets.length; i++) if (targets[i] > n.minutes) return targets[i];
    return null;
  }

  function nextLabel(n) {
    if (n.day === 0 || n.day === 6 || HOLIDAYS_2026[n.key] || n.minutes >= 900) return 'prochaine séance : 09:00 UTC';
    var target = nextTarget(n);
    return target == null ? 'prochaine séance : 09:00 UTC' : countdown(target, n.minutes);
  }

  function render() {
    var n = nowUTC();
    var p = phaseFor();
    var status = document.getElementById('marketStatus');
    var time = document.getElementById('marketTime');
    var next = document.getElementById('marketNext');
    if (!status && !time && !next) return;

    var active = p.id !== 'closed';
    if (status) {
      status.className = 'market-status ' + (active ? 'open' : 'closed');
      status.innerHTML = '<span class="status-dot"></span>' + p.label;
      status.title = 'BRVM — horaires officiels en UTC';
    }
    if (time) time.textContent = pad(n.date.getUTCHours()) + ':' + pad(n.date.getUTCMinutes()) + ':' + pad(n.date.getUTCSeconds()) + ' UTC';
    if (next) {
      if (p.id === 'preopen') next.textContent = 'Fixing d’ouverture à 09:45 UTC';
      else if (p.id === 'open-fixing') next.textContent = 'Négociation en continu à 09:45 UTC';
      else if (p.id === 'continuous') next.textContent = 'Pré-clôture à 14:00 UTC';
      else if (p.id === 'preclose') next.textContent = 'Fixing de clôture à 14:30 UTC';
      else if (p.id === 'close-fixing') next.textContent = 'Négociation au dernier cours à 14:30 UTC';
      else if (p.id === 'last-price') next.textContent = 'Fermeture à 15:00 UTC';
      else if (p.holiday) next.textContent = 'Jour férié BRVM — prochaine séance : 09:00 UTC';
      else next.textContent = nextLabel(n);
    }

    window.TC_BRVM_MARKET_PHASE = {
      id: p.id,
      label: p.label,
      open: active,
      utcMinutes: n.minutes,
      date: n.key,
      reason: p.reason,
      holiday: !!p.holiday,
      officialSchedule: p.schedule || NORMAL
    };
  }

  render();
  setInterval(render, 1000);
})();
