// THE CAPITAL — BRVM market session clock
// Official normal BRVM schedule: UTC
// Pre-opening 09:00-09:45 | Opening fixing 09:45
// Continuous 09:45-14:00 | Pre-closing 14:00-14:30
// Closing fixing 14:30 | Last-price trading 14:30-15:00
// Market official close 15:00. The BRVM notes a random +/- 60s around phase times.
(function () {
  'use strict';
  if (window.__TC_BRVM_MARKET_HOURS__) return;
  window.__TC_BRVM_MARKET_HOURS__ = true;

  var PHASES = [
    { id: 'preopen', label: 'Pré-ouverture', start: 9 * 60, end: 9 * 60 + 45 },
    { id: 'open-fixing', label: "Fixing d'ouverture", start: 9 * 60 + 45, end: 9 * 60 + 45 },
    { id: 'continuous', label: 'Négociation en continu', start: 9 * 60 + 45, end: 14 * 60 },
    { id: 'preclose', label: 'Pré-clôture', start: 14 * 60, end: 14 * 60 + 30 },
    { id: 'close-fixing', label: 'Fixing de clôture', start: 14 * 60 + 30, end: 14 * 60 + 30 },
    { id: 'last-price', label: 'Négociation au dernier cours', start: 14 * 60 + 30, end: 15 * 60 },
    { id: 'closed', label: 'Marché fermé', start: 15 * 60, end: 24 * 60 }
  ];

  function nowUTC() {
    var d = new Date();
    return {
      date: d,
      day: d.getUTCDay(),
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60
    };
  }

  function phaseFor() {
    var n = nowUTC();
    if (n.day === 0 || n.day === 6) return { id: 'closed', label: 'Marché fermé', reason: 'Week-end', minutes: n.minutes };
    var m = n.minutes;
    if (m < 9 * 60) return { id: 'closed', label: 'Marché fermé', reason: 'Avant pré-ouverture', minutes: m, next: 'Pré-ouverture à 09:00 UTC' };
    if (m < 9 * 60 + 45) return { id: 'preopen', label: 'Pré-ouverture', reason: 'Carnet d’ordres en pré-ouverture', minutes: m };
    if (m < 14 * 60) return { id: 'continuous', label: 'Négociation en continu', reason: 'Marché ouvert', minutes: m };
    if (m < 14 * 60 + 30) return { id: 'preclose', label: 'Pré-clôture', reason: 'Pré-clôture du marché', minutes: m };
    if (m < 15 * 60) return { id: 'last-price', label: 'Négociation au dernier cours', reason: 'Dernier cours', minutes: m };
    return { id: 'closed', label: 'Marché fermé', reason: 'Marché clôturé et officialisé', minutes: m };
  }

  function countdown(target, current) {
    var diff = target - current;
    if (diff < 0) diff = 0;
    var total = Math.floor(diff * 60);
    var h = Math.floor(total / 3600);
    var min = Math.floor((total % 3600) / 60);
    var sec = total % 60;
    if (h) return h + ' h ' + String(min).padStart(2, '0') + ' min';
    return min + ' min ' + String(sec).padStart(2, '0') + ' s';
  }

  function nextLabel(n) {
    var m = n.minutes;
    var targets = [9 * 60, 9 * 60 + 45, 14 * 60, 14 * 60 + 30, 15 * 60];
    for (var i = 0; i < targets.length; i++) {
      if (targets[i] > m) return countdown(targets[i], m);
    }
    return 'prochaine séance : 09:00 UTC';
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
    if (time) time.textContent = String(n.date.getUTCHours()).padStart(2, '0') + ':' + String(n.date.getUTCMinutes()).padStart(2, '0') + ':' + String(n.date.getUTCSeconds()).padStart(2, '0') + ' UTC';
    if (next) {
      if (p.id === 'preopen') next.textContent = 'Fixing d’ouverture à 09:45 UTC';
      else if (p.id === 'continuous') next.textContent = 'Pré-clôture à 14:00 UTC';
      else if (p.id === 'preclose') next.textContent = 'Fixing de clôture à 14:30 UTC';
      else if (p.id === 'last-price') next.textContent = 'Fermeture à 15:00 UTC';
      else if (n.day === 0 || n.day === 6 || n.minutes >= 15 * 60) next.textContent = nextLabel(n);
      else next.textContent = p.next || nextLabel(n);
    }

    window.TC_BRVM_MARKET_PHASE = {
      id: p.id,
      label: p.label,
      open: active,
      utcMinutes: n.minutes,
      officialSchedule: PHASES
    };
  }

  var originalRender = window.renderOverview;
  if (typeof originalRender === 'function') {
    window.renderOverview = function () {
      originalRender.apply(this, arguments);
      render();
    };
  }

  render();
  setInterval(render, 1000);
})();
