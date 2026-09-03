// THE CAPITAL - centralized market UX
(function (global) {
  "use strict";
  if (global.__TC_MARKET_UX_LOADED__) return;
  global.__TC_MARKET_UX_LOADED__ = true;

  var BRVM_TZ = "Africa/Abidjan";
  var DAKAR_TZ = "Africa/Dakar";
  var timer = null;
  var clockObserver = null;

  function engine() { return global.TC_BRVM_MARKET_HOURS || null; }
  function state() { var e = engine(); return e && typeof e.getState === "function" ? e.getState(new Date()) : null; }
  function formatTime(timeZone) { return new Intl.DateTimeFormat("fr-FR", { timeZone: timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()); }
  function userTimeZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } }
  function timeZoneLabel(timeZone) { if (timeZone === BRVM_TZ) return "Abidjan"; if (timeZone === DAKAR_TZ) return "Dakar"; return String(timeZone || "UTC").split("/").pop().replace(/_/g, " ") || "UTC"; }
  function dateKey(value) { var parts = new Intl.DateTimeFormat("en-CA", { timeZone: BRVM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); var out = {}; parts.forEach(function (part) { out[part.type] = part.value; }); return out.year + "-" + out.month + "-" + out.day; }
  function dateLabel(value) { return new Intl.DateTimeFormat("fr-FR", { timeZone: BRVM_TZ, weekday: "long", day: "2-digit", month: "long" }).format(value); }
  function findSession(value, direction) { var e = engine(); if (!e || typeof e.getState !== "function") return null; var d = new Date(value || Date.now()); for (var i = 0; i < 370; i += 1) { d.setUTCDate(d.getUTCDate() + direction); var s = e.getState(d); if (s && s.isTradingDay) return { date: new Date(d), state: s }; } return null; }
  function statusFor(s) { if (!s || !s.isTradingDay || s.phase === "closed" || s.phase === "official_close") return { code: "closed", label: "MARCHE FERME" }; if (s.phase === "pre_open") return { code: "preopen", label: "PRE-OUVERTURE" }; if (s.phase === "pre_close" || s.phase === "closing_fixing") return { code: "preclose", label: "PRE-CLOTURE" }; return { code: "live", label: "EN DIRECT" }; }

  function applyStatus() {
    var s = state(), status = statusFor(s), badge = document.querySelector(".header-badge");
    if (badge) { badge.className = "header-badge tc-market-badge " + status.code; badge.innerHTML = "<span class=\"tc-status-dot\"></span><span>" + status.label + "</span>"; badge.title = s && s.reason ? "BRVM - " + s.reason : "BRVM - reference Abidjan"; }
    var panel = document.getElementById("marketStatus");
    if (panel) { panel.className = "market-status " + status.code; panel.innerHTML = "<span class=\"status-dot\"></span>" + status.label; panel.title = "BRVM - reference horaire : Africa/Abidjan"; }
    var marketTime = document.getElementById("marketTime"); if (marketTime) marketTime.textContent = formatTime(BRVM_TZ);
    var next = document.getElementById("marketNext");
    if (next) { if (status.code === "closed") { var n = findSession(new Date(), 1); next.textContent = n ? "Prochaine ouverture : 09:00 Abidjan - " + dateLabel(n.date) : "Prochaine ouverture : indisponible"; } else if (status.code === "preopen") next.textContent = "Ouverture : 09:45 Abidjan"; else if (status.code === "preclose") next.textContent = "Fermeture : 15:00 Abidjan"; else next.textContent = "Marche actif - reference Abidjan"; }
    var summary = document.getElementById("tc-market-session-summary");
    if (summary) { var today = !!(s && s.isTradingDay && s.date === dateKey(new Date())); var previous = today ? null : findSession(new Date(), -1); var upcoming = findSession(new Date(), 1); summary.innerHTML = "<div class=\"tc-session-main\"><strong>" + status.label + "</strong><span>Reference : Abidjan - BRVM</span></div><div class=\"tc-session-meta\"><span>Derniere seance : <b>" + (today ? "aujourd hui" : (previous ? dateLabel(previous.date) : "-")) + "</b></span><span>Prochaine ouverture : <b>" + (upcoming ? dateLabel(upcoming.date) + " - 09:00 Abidjan" : "-") + "</b></span></div>"; }
  }

  function clockMarkup() { return "<div class=\"tc-clock-main\"><span class=\"tc-clock-kicker\">HEURE DU MARCHE</span><span class=\"tc-clock-primary\"><b id=\"tc-clock-abidjan\">--:--:--</b><small>Abidjan - BRVM</small></span></div><div class=\"tc-clock-list\"><span><b id=\"tc-clock-dakar\">--:--:--</b><small>Dakar</small></span><span><b id=\"tc-clock-user\">--:--:--</b><small id=\"tc-clock-user-label\">Votre heure</small></span></div>"; }
  function renderClocks() {
    var host = document.getElementById("headerTime");
    if (!host) return;
    var ab = host.querySelector("#tc-clock-abidjan"), da = host.querySelector("#tc-clock-dakar"), us = host.querySelector("#tc-clock-user"), label = host.querySelector("#tc-clock-user-label");
    if (!ab || !da || !us || !label) {
      host.classList.add("tc-market-clocks");
      host.setAttribute("data-tc-clock-block", "1");
      host.innerHTML = clockMarkup();
      ab = host.querySelector("#tc-clock-abidjan");
      da = host.querySelector("#tc-clock-dakar");
      us = host.querySelector("#tc-clock-user");
      label = host.querySelector("#tc-clock-user-label");
    }
    var tz = userTimeZone();
    if (ab) ab.textContent = formatTime(BRVM_TZ);
    if (da) da.textContent = formatTime(DAKAR_TZ);
    if (us) us.textContent = formatTime(tz);
    if (label) label.textContent = "Votre heure - " + timeZoneLabel(tz);
  }

  function bindGuideTriggers() {
    document.querySelectorAll("[data-open-guide], [data-guide]").forEach(function (node) {
      if (node.getAttribute("data-tc-guide-bound") === "1") return;
      node.setAttribute("data-tc-guide-bound", "1");
      node.addEventListener("click", function (event) { event.preventDefault(); if (global.openCapitalGuide) global.openCapitalGuide(); });
    });
  }

  function start() {
    /* All geometry is owned by static CSS. This runtime only updates text and
       state classes; it never injects stylesheet rules. */
    bindGuideTriggers();
    applyStatus();
    renderClocks();
    if (timer) global.clearInterval(timer);
    timer = global.setInterval(function () { applyStatus(); renderClocks(); bindGuideTriggers(); }, 1000);
    if (clockObserver) clockObserver.disconnect();
    var host = document.getElementById("headerTime");
    if (host && global.MutationObserver) {
      clockObserver = new MutationObserver(function () {
        if (!host.querySelector("#tc-clock-abidjan")) renderClocks();
      });
      clockObserver.observe(host, { childList: true, subtree: true });
    }
  }

  global.TC_MARKET_UX = { start: start, getStatus: function () { return statusFor(state()); }, getUserTimeZone: userTimeZone };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})(window);
