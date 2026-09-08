/* THE CAPITAL — BRVM market status / clock UI
 * Presentation adapter for the central TC_BRVM_MARKET_HOURS engine.
 * No market data is created or changed here.
 */
(function (global, document) {
  'use strict';
  if (global.TC_MARKET_UX && global.TC_MARKET_UX.version) return;

  var timer = null;
  var started = false;

  function pad(n) { return String(n).padStart(2, '0'); }

  function clock(timeZone) {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date());
    } catch (e) {
      var d = new Date();
      return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) {
      if (el && el.textContent !== value) el.textContent = value;
    });
  }

  function update() {
    var engine = global.TC_BRVM_MARKET_HOURS;
    var state = engine && typeof engine.getState === 'function' ? engine.getState(new Date()) : null;
    if (!state) return;

    var label = state.phaseLabel || 'Marché fermé';
    var marketClock = clock('Africa/Abidjan');
    var localClock = clock(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Dakar');

    setText('.tc-market-label', label);
    setText('.tc-market-time', marketClock + ' Abidjan');
    setText('#headerTime', localClock);

    document.querySelectorAll('.tc-live').forEach(function (dot) {
      dot.style.background = state.isOpen ? 'var(--tc-green,#43d982)' : 'var(--tc-red,#ef7272)';
      dot.style.boxShadow = state.isOpen ? '0 0 0 4px rgba(67,217,130,.08)' : '0 0 0 4px rgba(239,114,114,.08)';
      dot.setAttribute('aria-label', label);
    });

    document.querySelectorAll('.tc-market-pill').forEach(function (pill) {
      pill.setAttribute('data-market-phase', state.phase || 'closed');
      pill.setAttribute('title', label + ' · Abidjan ' + marketClock);
    });

    global.TC_BRVM_MARKET_PHASE = state;
  }

  function start() {
    if (started) { update(); return; }
    started = true;
    update();
    if (timer) clearInterval(timer);
    timer = global.setInterval(update, 1000);
  }

  global.TC_MARKET_UX = {
    version: '2026.09.08.1',
    start: start,
    update: update,
    stop: function () {
      if (timer) clearInterval(timer);
      timer = null;
      started = false;
    }
  };

  function boot() {
    if (global.TC_BRVM_MARKET_HOURS) start();
    else setTimeout(boot, 25);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window, document);
