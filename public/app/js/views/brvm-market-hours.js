// THE CAPITAL — BRVM central market calendar / session engine
// Official trading hours: https://www.brvm.org/fr/horaires-de-cotation
// Official 2026 calendar: https://www.brvm.org/fr/brvm-calendrier-de-cotation-2026
(function (global) {
  'use strict';
  if (global.TC_BRVM_MARKET_HOURS && global.TC_BRVM_MARKET_HOURS.version) return;
  var LABELS = { closed:'Marché fermé', pre_open:'Pré-ouverture', opening_fixing:"Fixing d'ouverture", continuous:'Négociation en continu', pre_close:'Pré-clôture', closing_fixing:'Fixing de clôture', last_price:'Négociation au dernier cours', official_close:'Fermeture et officialisation' };
  var NORMAL = [
    {phase:'pre_open',start:540,end:585}, {phase:'opening_fixing',start:585,end:585},
    {phase:'continuous',start:585,end:840}, {phase:'pre_close',start:840,end:870},
    {phase:'closing_fixing',start:870,end:870}, {phase:'last_price',start:870,end:900},
    {phase:'official_close',start:900,end:900}
  ];
  var HOLIDAY_EVE = [
    {phase:'pre_open',start:540,end:570}, {phase:'opening_fixing',start:570,end:570},
    {phase:'continuous',start:570,end:660}, {phase:'pre_close',start:660,end:690},
    {phase:'closing_fixing',start:690,end:690}, {phase:'last_price',start:690,end:720},
    {phase:'official_close',start:720,end:720}
  ];
  // BRVM's published 2026 calendar, updated for the official notice moving
  // Maouloud's public holiday to Tuesday 25 August 2026.
  var HOLIDAYS_2026 = {
    '2026-01-01':'Jour de l’an',
    '2026-03-17':'Lendemain de la nuit du destin',
    '2026-03-20':'Fête du Ramadan',
    '2026-04-06':'Lundi de Pâques',
    '2026-05-01':'Fête du Travail',
    '2026-05-14':'Jour de l’Ascension',
    '2026-05-25':'Lundi de Pentecôte',
    '2026-05-27':'Fête de Tabaski',
    '2026-08-07':'Jour de l’Indépendance',
    '2026-08-25':'Fête de Maouloud',
    '2026-12-25':'Fête de Noël'
  };
  var EXCEPTIONAL = {};
  function pad(n) { return String(n).padStart(2, '0'); }
  function key(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function dateOf(value) {
    var d = value instanceof Date ? new Date(value) : (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(String(value) + 'T00:00:00Z') : new Date(value || Date.now()));
    if (isNaN(d.getTime())) throw Error('Invalid BRVM date');
    return d;
  }
  function minutes(d) { return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000; }
  function iso(d, m) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, m, 0)).toISOString(); }
  function weekend(d) { return d.getUTCDay() === 0 || d.getUTCDay() === 6; }
  function schedule(d) {
    var k = key(d), exceptional = EXCEPTIONAL[k];
    if (exceptional) return {type: exceptional.type || 'exceptional', reason: exceptional.reason || 'Séance exceptionnelle BRVM', phases: exceptional.phases || NORMAL};
    if (weekend(d) || HOLIDAYS_2026[k]) return {type:'closed', reason:weekend(d) ? 'Week-end' : HOLIDAYS_2026[k], phases:[]};
    return {type:'normal', reason:'Horaire normal BRVM', phases:NORMAL};
  }
  function nextTradingDay(from) {
    var d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    for (var i = 0; i < 370; i += 1) {
      var s = schedule(d);
      if (s.phases.length) return {date:new Date(d), schedule:s};
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return null;
  }
  function stateFor(value) {
    var d = dateOf(value), k = key(d), s = schedule(d), m = minutes(d), phase = 'closed', phaseStart = null, phaseEnd = null;
    if (s.phases.length) {
      for (var i = 0; i < s.phases.length; i += 1) {
        var p = s.phases[i];
        var matches = p.start === p.end ? Math.abs(m - p.start) < (1 / 60) : (m >= p.start && m < p.end);
        if (matches) { phase = p.phase; phaseStart = iso(d, p.start); phaseEnd = iso(d, p.end); break; }
      }
    }
    var nextPhase = 'pre_open', nextPhaseAt = null;
    if (s.phases.length) {
      var currentIndex = s.phases.findIndex(function (p) { return p.phase === phase; });
      if (currentIndex >= 0 && currentIndex < s.phases.length - 1) {
        nextPhase = s.phases[currentIndex + 1].phase;
        nextPhaseAt = iso(d, s.phases[currentIndex + 1].start);
      } else {
        var next = new Date(d); next.setUTCDate(next.getUTCDate() + 1);
        var nextDay = nextTradingDay(next);
        if (nextDay) { nextPhase = nextDay.schedule.phases[0].phase; nextPhaseAt = iso(nextDay.date, nextDay.schedule.phases[0].start); }
      }
      if (phase === 'closed') {
        var upcoming = s.phases.find(function (p) { return p.start > m; });
        if (upcoming) { nextPhase = upcoming.phase; nextPhaseAt = iso(d, upcoming.start); }
      }
    } else {
      var tomorrow = new Date(d); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      var nextSession = nextTradingDay(tomorrow);
      if (nextSession) { nextPhase = nextSession.schedule.phases[0].phase; nextPhaseAt = iso(nextSession.date, nextSession.schedule.phases[0].start); }
    }
    return {
      date:k,
      isTradingDay:!!s.phases.length,
      isOpen:phase !== 'closed' && phase !== 'official_close',
      phase:phase,
      phaseLabel:LABELS[phase],
      phaseStart:phaseStart,
      phaseEnd:phaseEnd,
      nextPhase:nextPhase,
      nextPhaseAt:nextPhaseAt,
      scheduleType:s.type,
      reason:s.reason,
      timezone:'Africa/Abidjan',
      randomizationSeconds:60,
      officialSource:'BRVM'
    };
  }
  function render() {
    var d = new Date(), state = stateFor(d), status = document.getElementById('marketStatus'), time = document.getElementById('marketTime'), next = document.getElementById('marketNext');
    if (status) { status.className = 'market-status ' + (state.isOpen ? 'open' : 'closed'); status.innerHTML = '<span class="status-dot"></span>' + state.phaseLabel; status.title = 'BRVM — référence horaire : Abidjan (Africa/Abidjan)'; }
    if (time) time.textContent = new Intl.DateTimeFormat('fr-FR', {timeZone:'Africa/Abidjan',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
    if (next) next.textContent = state.nextPhaseAt ? 'Prochaine phase : ' + LABELS[state.nextPhase] + ' à ' + new Date(state.nextPhaseAt).toLocaleTimeString('fr-FR', {timeZone:'Africa/Abidjan',hour:'2-digit',minute:'2-digit',hour12:false}) : 'Aucune prochaine séance disponible';
    global.TC_BRVM_MARKET_PHASE = state;
  }
  global.TC_BRVM_MARKET_HOURS = {
    version:'2026.08.27.1', labels:LABELS, normalPhases:NORMAL, holidayEvePhases:HOLIDAY_EVE,
    holidays2026:HOLIDAYS_2026, exceptionalSessions:EXCEPTIONAL,
    getState:function (value) { return stateFor(value || new Date()); },
    isTradingDay:function (value) { return stateFor(value).isTradingDay; },
    isOpen:function (value) { return stateFor(value).isOpen; },
    configureExceptionalSession:function (date, config) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !config || !Array.isArray(config.phases)) throw Error('Invalid exceptional BRVM session');
      EXCEPTIONAL[date] = {type:config.type || 'exceptional', reason:config.reason || 'Séance exceptionnelle BRVM', phases:config.phases};
      render();
    }
  };
  render();
  clearInterval(global.__TC_BRVM_MARKET_INTERVAL__);
  global.__TC_BRVM_MARKET_INTERVAL__ = setInterval(render, 1000);
})(window);
