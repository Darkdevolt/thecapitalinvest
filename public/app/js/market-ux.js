// THE CAPITAL - centralized market UX
(function (global) {
  "use strict";
  if (global.__TC_MARKET_UX_LOADED__) return;
  global.__TC_MARKET_UX_LOADED__ = true;

  var BRVM_TZ = "Africa/Abidjan";
  var DAKAR_TZ = "Africa/Dakar";
  var timer = null;
  var clockObserver = null;

  function engine() {
    return global.TC_BRVM_MARKET_HOURS || null;
  }

  function state() {
    var e = engine();
    return e && typeof e.getState === "function" ? e.getState(new Date()) : null;
  }

  function formatTime(timeZone) {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date());
  }

  function userTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (e) {
      return "UTC";
    }
  }

  function timeZoneLabel(timeZone) {
    if (timeZone === BRVM_TZ) return "Abidjan";
    if (timeZone === DAKAR_TZ) return "Dakar";
    return String(timeZone || "UTC").split("/").pop().replace(/_/g, " ") || "UTC";
  }

  function dateKey(value) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BRVM_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(value);
    var out = {};
    parts.forEach(function (part) { out[part.type] = part.value; });
    return out.year + "-" + out.month + "-" + out.day;
  }

  function dateLabel(value) {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: BRVM_TZ,
      weekday: "long",
      day: "2-digit",
      month: "long"
    }).format(value);
  }

  function findSession(value, direction) {
    var e = engine();
    if (!e || typeof e.getState !== "function") return null;
    var d = new Date(value || Date.now());
    for (var i = 0; i < 370; i += 1) {
      d.setUTCDate(d.getUTCDate() + direction);
      var s = e.getState(d);
      if (s && s.isTradingDay) return { date: new Date(d), state: s };
    }
    return null;
  }

  function statusFor(s) {
    if (!s || !s.isTradingDay || s.phase === "closed" || s.phase === "official_close") {
      return { code: "closed", label: "MARCHE FERME" };
    }
    if (s.phase === "pre_open") return { code: "preopen", label: "PRE-OUVERTURE" };
    if (s.phase === "pre_close" || s.phase === "closing_fixing") {
      return { code: "preclose", label: "PRE-CLOTURE" };
    }
    return { code: "live", label: "EN DIRECT" };
  }

  function applyStatus() {
    var s = state();
    var status = statusFor(s);
    var badge = document.querySelector(".header-badge");
    if (badge) {
      badge.className = "header-badge tc-market-badge " + status.code;
      badge.innerHTML = "<span class=\"tc-status-dot\"></span><span>" + status.label + "</span>";
      badge.title = s && s.reason ? "BRVM - " + s.reason : "BRVM - reference Abidjan";
    }

    var panel = document.getElementById("marketStatus");
    if (panel) {
      panel.className = "market-status " + status.code;
      panel.innerHTML = "<span class=\"status-dot\"></span>" + status.label;
      panel.title = "BRVM - reference horaire : Africa/Abidjan";
    }

    var marketTime = document.getElementById("marketTime");
    if (marketTime) marketTime.textContent = formatTime(BRVM_TZ);

    var next = document.getElementById("marketNext");
    if (next) {
      if (status.code === "closed") {
        var n = findSession(new Date(), 1);
        next.textContent = n ? "Prochaine ouverture : 09:00 Abidjan - " + dateLabel(n.date) : "Prochaine ouverture : indisponible";
      } else if (status.code === "preopen") {
        next.textContent = "Ouverture : 09:45 Abidjan";
      } else if (status.code === "preclose") {
        next.textContent = "Fermeture : 15:00 Abidjan";
      } else {
        next.textContent = "Marche actif - reference Abidjan";
      }
    }

    var summary = document.getElementById("tc-market-session-summary");
    if (summary) {
      var today = !!(s && s.isTradingDay && s.date === dateKey(new Date()));
      var previous = today ? null : findSession(new Date(), -1);
      var upcoming = findSession(new Date(), 1);
      summary.innerHTML =
        "<div class=\"tc-session-main\"><strong>" + status.label + "</strong><span>Reference : Abidjan - BRVM</span></div>" +
        "<div class=\"tc-session-meta\"><span>Derniere seance : <b>" +
        (today ? "aujourd hui" : (previous ? dateLabel(previous.date) : "-")) +
        "</b></span><span>Prochaine ouverture : <b>" +
        (upcoming ? dateLabel(upcoming.date) + " - 09:00 Abidjan" : "-") +
        "</b></span></div>";
    }
  }

  function clockMarkup() {
    return "<div class=\"tc-clock-main\"><span class=\"tc-clock-kicker\">HEURE DU MARCHE</span>" +
      "<span class=\"tc-clock-primary\"><b id=\"tc-clock-abidjan\">--:--:--</b><small>Abidjan - BRVM</small></span></div>" +
      "<div class=\"tc-clock-list\"><span><b id=\"tc-clock-dakar\">--:--:--</b><small>Dakar</small></span>" +
      "<span><b id=\"tc-clock-user\">--:--:--</b><small id=\"tc-clock-user-label\">Votre heure</small></span></div>";
  }

  // A different header renderer can replace #headerTime. Always rebuild when its
  // clock children disappear instead of relying on a stale data attribute.
  function renderClocks() {
    var host = document.getElementById("headerTime");
    if (!host) return;

    var ab = host.querySelector("#tc-clock-abidjan");
    var da = host.querySelector("#tc-clock-dakar");
    var us = host.querySelector("#tc-clock-user");
    var label = host.querySelector("#tc-clock-user-label");

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

  function injectStyles() {
    if (document.getElementById("tc-market-ux-style")) return;
    var style = document.createElement("style");
    style.id = "tc-market-ux-style";
    style.textContent = [
      ".header{z-index:2000!important;isolation:isolate}",
      ".nav-dropdown{position:relative;z-index:2300}",
      ".nav-dropdown-menu{z-index:2400!important;max-height:calc(100vh - var(--header-h) - 16px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}",
      ".topnav,.topnav-right{overflow:visible!important}",
      ".tc-market-clocks{display:flex!important;align-items:center;gap:14px;min-width:320px;visibility:visible!important;opacity:1!important}",
      ".tc-clock-main,.tc-clock-list,.tc-clock-list span{display:flex;align-items:center}",
      ".tc-clock-main{gap:9px}",
      ".tc-clock-kicker{font:500 8px var(--mono);letter-spacing:.12em;color:var(--gold);writing-mode:vertical-rl;transform:rotate(180deg)}",
      ".tc-clock-primary,.tc-clock-list span{display:flex;flex-direction:column;gap:3px}",
      ".tc-clock-primary b,.tc-clock-list b{font:500 12px var(--mono);color:var(--text)}",
      ".tc-clock-primary small,.tc-clock-list small{font:500 7px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:rgba(244,239,230,.48)}",
      ".tc-clock-list{gap:12px;padding-left:12px;border-left:1px solid var(--line)}",
      ".tc-session-summary{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:14px 16px;border:1px solid var(--line);background:linear-gradient(110deg,rgba(184,150,78,.07),transparent);border-radius:8px}",
      ".tc-session-main{display:flex;flex-direction:column;gap:4px}.tc-session-main strong{font:600 12px var(--mono)}.tc-session-main span,.tc-session-meta span{font-size:10px;color:var(--muted)}.tc-session-meta{display:flex;gap:20px;flex-wrap:wrap}.tc-session-meta b{color:var(--text)}",
      ".tc-guide-premium{position:fixed;inset:0;z-index:30000;background:rgba(8,7,5,.98);backdrop-filter:blur(18px);display:none;overflow:auto;overscroll-behavior:contain}",
      ".tc-guide-premium.open{display:block}.tc-guide-inner{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:34px 0 60px}",
      ".tc-guide-top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:1px solid var(--line);padding-bottom:24px}",
      ".tc-guide-eyebrow,.tc-guide-section-label{font:500 9px var(--mono);letter-spacing:.18em;color:var(--gold);text-transform:uppercase}",
      ".tc-guide-h1{font:700 clamp(38px,6vw,72px)/.98 var(--serif);margin:10px 0}.tc-guide-h1 em{color:var(--gold2)}.tc-guide-lead{max-width:760px;color:var(--muted);font-size:14px;line-height:1.7}",
      ".tc-guide-close2{border:1px solid var(--line);background:transparent;color:var(--text);padding:9px 13px;border-radius:7px;cursor:pointer}",
      ".tc-guide-journey{display:grid;grid-template-columns:repeat(5,1fr);margin:30px 0 44px;border:1px solid var(--line);background:var(--line);gap:1px}.tc-guide-step{background:var(--panel);padding:17px}.tc-guide-step span{display:block;color:var(--gold);font:500 8px var(--mono);margin-bottom:8px}.tc-guide-step b{font:600 16px var(--serif)}",
      ".tc-guide-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin-top:16px}.tc-guide-card{background:var(--panel);padding:26px;min-height:250px;display:flex;flex-direction:column}.tc-guide-card:nth-child(2n){background:var(--panel2)}",
      ".tc-guide-card-head{display:flex;gap:15px;align-items:flex-start}.tc-guide-icon{width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(184,150,78,.24);color:var(--gold2);font:500 11px var(--mono);flex:none}.tc-guide-card h3{font:600 23px var(--serif);margin:0 0 6px}.tc-guide-card p{color:var(--muted);font-size:12px;line-height:1.65;margin:0}",
      ".tc-guide-card ul{list-style:none;padding:0;margin:17px 0;display:grid;gap:7px}.tc-guide-card li{font-size:11px;color:rgba(244,239,230,.78)}.tc-guide-card li:before{content:'•';color:var(--gold);margin-right:7px}.tc-guide-action{margin-top:auto;align-self:flex-start;border:1px solid var(--line);background:rgba(184,150,78,.06);color:var(--gold2);padding:9px 12px;border-radius:6px;cursor:pointer}",
      ".tc-guide-faq{margin-top:34px}.tc-guide-faq-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin-top:16px}.tc-guide-faq-item{background:var(--panel);padding:20px}.tc-guide-faq-item b{display:block;font:600 16px var(--serif);margin-bottom:7px}.tc-guide-faq-item span{font-size:11px;line-height:1.65;color:var(--muted)}",
      ".tc-guide-footer{margin-top:34px;padding:22px;border:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(110deg,rgba(184,150,78,.08),transparent)}.tc-guide-footer b{font:600 21px var(--serif)}.tc-guide-footer span{display:block;color:var(--muted);font-size:11px;margin-top:4px}",
      "@media(max-width:1180px){.tc-market-clocks{min-width:0}.tc-clock-primary small,.tc-clock-list small{font-size:6px}}",
      "@media(max-width:850px){.tc-clock-list{display:none}.tc-guide-journey{grid-template-columns:1fr 1fr}.tc-guide-cards,.tc-guide-faq-grid{grid-template-columns:1fr}.tc-guide-top{flex-direction:column}.tc-guide-footer{flex-direction:column;align-items:flex-start}}",
      "@media(max-width:600px){.tc-market-clocks{min-width:0}.tc-clock-kicker{display:none}.tc-guide-inner{width:calc(100% - 24px);padding-top:20px}.tc-guide-h1{font-size:42px}.tc-guide-journey{grid-template-columns:1fr}.tc-guide-card{padding:20px;min-height:0}}"
    ].join("");
    document.head.appendChild(style);
  }

  var GUIDE = [
    ["01","JE DECOUVRE","Commencer par le marche et comprendre les informations affichees.",["Vue d ensemble BRVM","Titres, indices, BOC et screener","Cours, variations et volumes"],"Explorer le marche","marche","01"],
    ["02","J ANALYSE","Passer de la donnee a une analyse financiere exploitable.",["Recommandations et comparaison","Analyse technique et indicateurs","Analyse fondamentale, ratios et DCF"],"Analyser une entreprise","analyse-fondamentale","02"],
    ["03","JE SURVEILLE","Construire une routine de suivi des opportunites.",["Liste de surveillance et notes","Alertes et seuils de prix","Trading Desk et scenarios"],"Ouvrir mon espace","desk-workspace.html","03"],
    ["04","JE DECIDE","Transformer l analyse en decision et mesurer le resultat.",["Portefeuille et positions","Performance et P&L","Suivi des investissements"],"Voir mon portefeuille","portefeuille","04"],
    ["05","JE GERE","Automatiser le suivi des evenements importants.",["Alertes de cours","Calendrier des publications","Etats financiers et documents"],"Configurer mes alertes","alertes","05"],
    ["06","JE ME FORME","Apprendre les notions necessaires pour utiliser correctement les outils.",["Lexique financier","Parcours The Capital Institute","Comprendre avant d agir"],"Acceder a la formation","formation","06"]
  ];

  function navigate(target) {
    if (target === "desk-workspace.html") {
      global.location.href = "/app/desk-workspace.html";
      return;
    }
    if (typeof global.nav === "function") {
      global.nav(target);
      return;
    }
    global.location.hash = target;
  }

  function closeGuide() {
    var modal = document.getElementById("tc-guide-premium");
    if (modal) modal.classList.remove("open");
    document.body.classList.remove("tc-guide-open");
  }

  function openGuide() {
    var modal = document.getElementById("tc-guide-premium");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "tc-guide-premium";
      modal.className = "tc-guide-premium";

      var steps = ["Je decouvre","J analyse","Je surveille","Je decide","Je gere"];
      var journey = steps.map(function (label, index) {
        return "<div class=\"tc-guide-step\"><span>0" + (index + 1) + "</span><b>" + label + "</b></div>";
      }).join("");

      var cards = GUIDE.map(function (item) {
        return "<article class=\"tc-guide-card\"><div class=\"tc-guide-card-head\"><div class=\"tc-guide-icon\">" + item[6] + "</div><div><h3>" + item[1] + "</h3><p>" + item[2] + "</p></div></div><ul>" +
          item[3].map(function (point) { return "<li>" + point + "</li>"; }).join("") +
          "</ul><button class=\"tc-guide-action\" type=\"button\" data-guide-target=\"" + item[5] + "\">" + item[4] + " -></button></article>";
      }).join("");

      var faq = "<section class=\"tc-guide-faq\"><div class=\"tc-guide-section-label\">QUESTIONS FREQUENTES</div><div class=\"tc-guide-faq-grid\">" +
        "<div class=\"tc-guide-faq-item\"><b>Par ou commencer ?</b><span>Commencez par Vue d ensemble, puis ouvrez un titre depuis Titres BRVM. Utilisez ensuite l analyse fondamentale ou technique.</span></div>" +
        "<div class=\"tc-guide-faq-item\"><b>Ou trouver les prix et indices ?</b><span>Le Marché BRVM centralise les titres, indices, BOC et outils de filtrage.</span></div>" +
        "<div class=\"tc-guide-faq-item\"><b>Comment analyser une societe ?</b><span>Croisez donnees de marche, ratios, etats financiers, dividendes et analyse technique avant de decider.</span></div>" +
        "<div class=\"tc-guide-faq-item\"><b>Comment suivre une opportunite ?</b><span>Ajoutez-la a votre surveillance, configurez une alerte et suivez ensuite la position dans le portefeuille.</span></div>" +
        "<div class=\"tc-guide-faq-item\"><b>Invest et Institute sont-ils identiques ?</b><span>Non. The Capital Invest sert a analyser et gerer les investissements. The Capital Institute est l espace de formation. Les acces sont independants.</span></div>" +
        "<div class=\"tc-guide-faq-item\"><b>Quel fuseau horaire est utilise ?</b><span>La reference du marche est Africa/Abidjan. Dakar et votre heure locale sont affichees separement.</span></div>" +
        "</div></section>";

      modal.innerHTML = "<div class=\"tc-guide-inner\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"tc-guide-title\">" +
        "<div class=\"tc-guide-top\"><div><div class=\"tc-guide-eyebrow\">THE CAPITAL / GUIDE UTILISATEUR</div><h1 class=\"tc-guide-h1\" id=\"tc-guide-title\">BIENVENUE SUR <em>THE CAPITAL</em></h1><p class=\"tc-guide-lead\">Un guide complet pour comprendre la plateforme, trouver les bonnes donnees, analyser une entreprise, surveiller une opportunite, gerer un portefeuille et utiliser The Capital Institute.</p></div><button class=\"tc-guide-close2\" type=\"button\" data-guide-close>Fermer x</button></div>" +
        "<div class=\"tc-guide-journey\" aria-label=\"Parcours utilisateur\">" + journey + "</div>" +
        "<div class=\"tc-guide-section-label\">LES ESPACES DE LA PLATEFORME</div><div class=\"tc-guide-cards\">" + cards + "</div>" + faq +
        "<div class=\"tc-guide-footer\"><div><b>De la donnee a la decision.</b><span>Chaque etape du guide conduit vers un espace reel de la plateforme.</span></div><button class=\"tc-guide-action\" type=\"button\" data-guide-close>Commencer -></button></div></div>";
      document.body.appendChild(modal);

      modal.addEventListener("click", function (event) {
        var target = event.target.closest ? event.target.closest("[data-guide-target]") : null;
        if (target) {
          closeGuide();
          navigate(target.getAttribute("data-guide-target"));
          return;
        }
        if ((event.target && event.target.hasAttribute("data-guide-close")) || event.target === modal) {
          closeGuide();
        }
      });
    }
    modal.classList.add("open");
    document.body.classList.add("tc-guide-open");
  }

  function bindGuideTriggers() {
    document.querySelectorAll("[data-open-guide], [data-guide]").forEach(function (node) {
      if (node.getAttribute("data-tc-guide-bound") === "1") return;
      node.setAttribute("data-tc-guide-bound", "1");
      node.addEventListener("click", function (event) {
        event.preventDefault();
        openGuide();
      });
    });
  }

  function start() {
    injectStyles();
    bindGuideTriggers();
    applyStatus();
    renderClocks();

    if (timer) global.clearInterval(timer);
    timer = global.setInterval(function () {
      applyStatus();
      renderClocks();
      bindGuideTriggers();
    }, 1000);

    if (clockObserver) clockObserver.disconnect();
    var host = document.getElementById("headerTime");
    if (host && global.MutationObserver) {
      clockObserver = new MutationObserver(function () {
        if (!host.querySelector("#tc-clock-abidjan")) renderClocks();
      });
      clockObserver.observe(host, { childList: true, subtree: true });
    }
  }

  global.TC_MARKET_UX = {
    start: start,
    getStatus: function () { return statusFor(state()); },
    openGuide: openGuide,
    closeGuide: closeGuide,
    getUserTimeZone: userTimeZone
  };
  global.openCapitalGuide = openGuide;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);
