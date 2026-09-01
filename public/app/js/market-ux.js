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
  function renderClocks() { var host = document.getElementById("headerTime"); if (!host) return; var ab = host.querySelector("#tc-clock-abidjan"), da = host.querySelector("#tc-clock-dakar"), us = host.querySelector("#tc-clock-user"), label = host.querySelector("#tc-clock-user-label"); if (!ab || !da || !us || !label) { host.classList.add("tc-market-clocks"); host.setAttribute("data-tc-clock-block", "1"); host.innerHTML = clockMarkup(); ab = host.querySelector("#tc-clock-abidjan"); da = host.querySelector("#tc-clock-dakar"); us = host.querySelector("#tc-clock-user"); label = host.querySelector("#tc-clock-user-label"); } var tz = userTimeZone(); if (ab) ab.textContent = formatTime(BRVM_TZ); if (da) da.textContent = formatTime(DAKAR_TZ); if (us) us.textContent = formatTime(tz); if (label) label.textContent = "Votre heure - " + timeZoneLabel(tz); }

  function injectStyles() {
    if (document.getElementById("tc-market-ux-style")) return;
    var style = document.createElement("style"); style.id = "tc-market-ux-style";
    style.textContent = [
      ".header{z-index:2000!important;isolation:isolate}", ".nav-dropdown{position:relative;z-index:2300}", ".nav-dropdown-menu{z-index:2400!important;max-height:calc(100vh - var(--header-h) - 16px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}", ".topnav,.topnav-right{overflow:visible!important}", ".tc-market-clocks{display:flex!important;align-items:center;gap:14px;min-width:320px;visibility:visible!important;opacity:1!important}", ".tc-clock-main,.tc-clock-list,.tc-clock-list span{display:flex;align-items:center}", ".tc-clock-main{gap:9px}", ".tc-clock-kicker{font:500 8px var(--mono);letter-spacing:.12em;color:var(--gold);writing-mode:vertical-rl;transform:rotate(180deg)}", ".tc-clock-primary,.tc-clock-list span{display:flex;flex-direction:column;gap:3px}", ".tc-clock-primary b,.tc-clock-list b{font:500 12px var(--mono);color:var(--text)}", ".tc-clock-primary small,.tc-clock-list small{font:500 7px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:rgba(244,239,230,.48)}", ".tc-clock-list{gap:12px;padding-left:12px;border-left:1px solid var(--line)}", ".tc-session-summary{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:14px 16px;border:1px solid var(--line);background:linear-gradient(110deg,rgba(184,150,78,.07),transparent);border-radius:8px}", ".tc-session-main{display:flex;flex-direction:column;gap:4px}.tc-session-main strong{font:600 12px var(--mono)}.tc-session-main span,.tc-session-meta span{font-size:10px;color:var(--muted)}.tc-session-meta{display:flex;gap:20px;flex-wrap:wrap}.tc-session-meta b{color:var(--text)}"
    ].join("");
    document.head.appendChild(style);
  }

  function bindGuideTriggers() { document.querySelectorAll("[data-open-guide], [data-guide]").forEach(function (node) { if (node.getAttribute("data-tc-guide-bound") === "1") return; node.setAttribute("data-tc-guide-bound", "1"); node.addEventListener("click", function (event) { event.preventDefault(); if (global.openCapitalGuide) global.openCapitalGuide(); }); }); }
  function start() { injectStyles(); bindGuideTriggers(); applyStatus(); renderClocks(); if (timer) global.clearInterval(timer); timer = global.setInterval(function () { applyStatus(); renderClocks(); bindGuideTriggers(); }, 1000); if (clockObserver) clockObserver.disconnect(); var host = document.getElementById("headerTime"); if (host && global.MutationObserver) { clockObserver = new MutationObserver(function () { if (!host.querySelector("#tc-clock-abidjan")) renderClocks(); }); clockObserver.observe(host, { childList: true, subtree: true }); } }
  global.TC_MARKET_UX = { start: start, getStatus: function () { return statusFor(state()); }, getUserTimeZone: userTimeZone };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})(window);