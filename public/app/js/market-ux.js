// THE CAPITAL — centralized market UX
(function (global) {
  'use strict';
  if (global.__TC_MARKET_UX_LOADED__) return;
  global.__TC_MARKET_UX_LOADED__ = true;

  var BRVM_TZ = 'Africa/Abidjan';
  var DAKAR_TZ = 'Africa/Dakar';
  var timer = null;

  function engine() {
    return global.TC_BRVM_MARKET_HOURS || null;
  }

  function state() {
    var e = engine();
    return e && typeof e.getState === 'function' ? e.getState(new Date()) : null;
  }

  function formatTime(timeZone) {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
  }

  function userTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (e) {
      return 'UTC';
    }
  }

  function timeZoneLabel(timeZone) {
    if (timeZone === BRVM_TZ) return 'Abidjan';
    if (timeZone === DAKAR_TZ) return 'Dakar';
    return String(timeZone || 'UTC').split('/').pop().replace(/_/g, ' ') || 'UTC';
  }

  function dateKey(value) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BRVM_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(value);
    var out = {};
    parts.forEach(function (part) { out[part.type] = part.value; });
    return out.year + '-' + out.month + '-' + out.day;
  }

  function dateLabel(value) {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: BRVM_TZ,
      weekday: 'long', day: '2-digit', month: 'long'
    }).format(value);
  }

  function sessionAfter(value) {
    var e = engine();
    if (!e || typeof e.getState !== 'function') return null;
    var d = new Date(value || Date.now());
    for (var i = 0; i < 370; i += 1) {
      d.setUTCDate(d.getUTCDate() + 1);
      var s = e.getState(d);
      if (s && s.isTradingDay) return { date: new Date(d), state: s };
    }
    return null;
  }

  function sessionBefore(value) {
    var e = engine();
    if (!e || typeof e.getState !== 'function') return null;
    var d = new Date(value || Date.now());
    for (var i = 0; i < 370; i += 1) {
      d.setUTCDate(d.getUTCDate() - 1);
      var s = e.getState(d);
      if (s && s.isTradingDay) return { date: new Date(d), state: s };
    }
    return null;
  }

  function statusFor(s) {
    if (!s || !s.isTradingDay || s.phase === 'closed' || s.phase === 'official_close') {
      return { code: 'closed', label: 'MARCHÉ FERMÉ' };
    }
    if (s.phase === 'pre_open') return { code: 'preopen', label: 'PRÉ-OUVERTURE' };
    if (s.phase === 'pre_close' || s.phase === 'closing_fixing') {
      return { code: 'preclose', label: 'PRÉ-CLÔTURE' };
    }
    return { code: 'live', label: 'EN DIRECT' };
  }

  function applyStatus() {
    var s = state();
    var status = statusFor(s);
    var badge = document.querySelector('.header-badge');
    if (badge) {
      badge.className = 'header-badge tc-market-badge ' + status.code;
      badge.innerHTML = '<span class="tc-status-dot"></span><span>' + status.label + '</span>';
      badge.title = s && s.reason ? 'BRVM — ' + s.reason : 'BRVM — référence Abidjan';
    }

    var panel = document.getElementById('marketStatus');
    if (panel) {
      panel.className = 'market-status ' + status.code;
      panel.innerHTML = '<span class="status-dot"></span>' + status.label;
      panel.title = 'BRVM — référence horaire : Africa/Abidjan';
    }

    var marketTime = document.getElementById('marketTime');
    if (marketTime) marketTime.textContent = formatTime(BRVM_TZ);

    var next = document.getElementById('marketNext');
    if (next) {
      if (status.code === 'closed') {
        var n = sessionAfter();
        next.textContent = n
          ? 'Prochaine ouverture : 09:00 Abidjan — ' + dateLabel(n.date)
          : 'Prochaine ouverture : indisponible';
      } else if (status.code === 'preopen') {
        next.textContent = 'Ouverture : 09:45 Abidjan';
      } else if (status.code === 'preclose') {
        next.textContent = 'Fermeture : 15:00 Abidjan';
      } else {
        next.textContent = 'Marché actif — référence Abidjan';
      }
    }

    var summary = document.getElementById('tc-market-session-summary');
    if (summary) {
      var today = !!(s && s.isTradingDay && s.date === dateKey(new Date()));
      var previous = today ? null : sessionBefore();
      var upcoming = sessionAfter();
      summary.innerHTML =
        '<div class="tc-session-main"><strong>' + status.label + '</strong>' +
        '<span>Référence : Abidjan — BRVM</span></div>' +
        '<div class="tc-session-meta">' +
        '<span>Dernière séance : <b>' + (today ? "aujourd'hui" : (previous ? dateLabel(previous.date) : '—')) + '</b></span>' +
        '<span>Prochaine ouverture : <b>' + (upcoming ? dateLabel(upcoming.date) + ' — 09:00 Abidjan' : '—') + '</b></span>' +
        '</div>';
    }
  }

  function renderClocks() {
    var host = document.getElementById('headerTime');
    if (!host) return;
    if (host.getAttribute('data-tc-clock-block') !== '1') {
      host.setAttribute('data-tc-clock-block', '1');
      host.classList.add('tc-market-clocks');
      host.innerHTML =
        '<div class="tc-clock-main">' +
          '<span class="tc-clock-kicker">HEURE DU MARCHÉ</span>' +
          '<span class="tc-clock-primary"><b id="tc-clock-abidjan">--:--:--</b><small>🇨🇮 Abidjan — BRVM</small></span>' +
        '</div>' +
        '<div class="tc-clock-list">' +
          '<span><b id="tc-clock-dakar">--:--:--</b><small>🇸🇳 Dakar</small></span>' +
          '<span><b id="tc-clock-user">--:--:--</b><small id="tc-clock-user-label">🌍 Votre heure</small></span>' +
        '</div>';
    }

    var tz = userTimeZone();
    var abidjan = document.getElementById('tc-clock-abidjan');
    var dakar = document.getElementById('tc-clock-dakar');
    var user = document.getElementById('tc-clock-user');
    var label = document.getElementById('tc-clock-user-label');
    if (abidjan) abidjan.textContent = formatTime(BRVM_TZ);
    if (dakar) dakar.textContent = formatTime(DAKAR_TZ);
    if (user) user.textContent = formatTime(tz);
    if (label) label.textContent = '🌍 Votre heure — ' + timeZoneLabel(tz);
  }

  function injectStyles() {
    if (document.getElementById('tc-market-ux-style')) return;
    var style = document.createElement('style');
    style.id = 'tc-market-ux-style';
    style.textContent =
      '.header-badge.tc-market-badge{display:inline-flex;align-items:center;gap:7px;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(184,150,78,.2);background:rgba(184,150,78,.06);font:600 9px var(--mono);letter-spacing:.09em;white-space:nowrap}' +
      '.tc-status-dot{width:7px;height:7px;border-radius:50%;background:#858585;flex:none}' +
      '.tc-market-badge.live .tc-status-dot{background:#65c18c}' +
      '.tc-market-badge.preopen .tc-status-dot{background:#d7b85a}' +
      '.tc-market-badge.preclose .tc-status-dot{background:#d88b4c}' +
      '.tc-market-clocks{display:flex!important;align-items:center;gap:14px;min-width:320px}' +
      '.tc-clock-main,.tc-clock-list,.tc-clock-list span{display:flex;align-items:center}' +
      '.tc-clock-main{gap:9px}' +
      '.tc-clock-kicker{font:500 8px var(--mono);letter-spacing:.12em;color:var(--gold);writing-mode:vertical-rl;transform:rotate(180deg)}' +
      '.tc-clock-primary,.tc-clock-list span{display:flex;flex-direction:column;gap:3px}' +
      '.tc-clock-primary b,.tc-clock-list b{font:500 12px var(--mono);color:var(--text)}' +
      '.tc-clock-primary small,.tc-clock-list small{font:500 7px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:rgba(244,239,230,.48)}' +
      '.tc-clock-list{gap:12px;padding-left:12px;border-left:1px solid var(--line)}' +
      '.tc-session-summary{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:14px 16px;border:1px solid var(--line);background:linear-gradient(110deg,rgba(184,150,78,.07),transparent);border-radius:8px}' +
      '.tc-session-main{display:flex;flex-direction:column;gap:4px}' +
      '.tc-session-main strong{font:600 12px var(--mono)}' +
      '.tc-session-main span,.tc-session-meta span{font-size:10px;color:var(--muted)}' +
      '.tc-session-meta{display:flex;gap:20px;flex-wrap:wrap}' +
      '.tc-session-meta b{color:var(--text)}' +
      '.tc-guide-premium{position:fixed;inset:0;z-index:10001;background:rgba(8,7,5,.97);backdrop-filter:blur(18px);display:none;overflow:auto}' +
      '.tc-guide-premium.open{display:block}' +
      '.tc-guide-inner{width:min(1160px,calc(100% - 32px));margin:0 auto;padding:34px 0 60px}' +
      '.tc-guide-top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:1px solid var(--line);padding-bottom:24px}' +
      '.tc-guide-eyebrow{font:500 9px var(--mono);letter-spacing:.18em;color:var(--gold);text-transform:uppercase}' +
      '.tc-guide-h1{font:700 clamp(38px,6vw,72px)/.98 var(--serif);margin:10px 0}' +
      '.tc-guide-h1 em{color:var(--gold2)}' +
      '.tc-guide-lead{max-width:700px;color:var(--muted);font-size:14px;line-height:1.7}' +
      '.tc-guide-close2{border:1px solid var(--line);background:transparent;color:var(--text);padding:9px 13px;border-radius:7px;cursor:pointer}' +
      '.tc-guide-journey{display:grid;grid-template-columns:repeat(5,1fr);margin:30px 0 44px;border:1px solid var(--line);background:var(--line);gap:1px}' +
      '.tc-guide-step{background:var(--panel);padding:17px;position:relative}' +
      '.tc-guide-step:not(:last-child):after{content:"→";position:absolute;right:-9px;top:50%;transform:translateY(-50%);z-index:2;color:var(--gold);background:var(--panel);padding:2px}' +
      '.tc-guide-step b{font:600 16px var(--serif)}' +
      '.tc-guide-step span{display:block;color:var(--gold);font:500 8px var(--mono);margin-bottom:8px}' +
      '.tc-guide-section-label{font:500 9px var(--mono);letter-spacing:.16em;color:var(--gold);text-transform:uppercase}' +
      '.tc-guide-cards{display:grid;grid-template-columns:1.15fr .85fr;gap:1px;background:var(--line);border:1px solid var(--line);margin-top:16px}' +
      '.tc-guide-card{background:var(--panel);padding:26px;min-height:220px;display:flex;flex-direction:column;position:relative;overflow:hidden;transition:transform .2s ease,background .2s ease}' +
      '.tc-guide-card:nth-child(2),.tc-guide-card:nth-child(5){background:var(--panel2)}' +
      '.tc-guide-card:nth-child(3),.tc-guide-card:nth-child(4){min-height:250px}' +
      '.tc-guide-card:hover{transform:translateY(-2px);background:var(--panel2)}' +
      '.tc-guide-card:after{content:"";position:absolute;right:-50px;bottom:-70px;width:180px;height:180px;border:1px solid rgba(184,150,78,.08);border-radius:50%;pointer-events:none}' +
      '.tc-guide-card-head{display:flex;gap:15px;align-items:flex-start}' +
      '.tc-guide-icon{width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(184,150,78,.24);color:var(--gold2);font:500 11px var(--mono);flex:none}' +
      '.tc-guide-card h3{font:600 23px var(--serif);margin:0 0 6px}' +
      '.tc-guide-card p{color:var(--muted);font-size:12px;line-height:1.65;margin:0}' +
      '.tc-guide-card ul{list-style:none;padding:0;margin:17px 0;display:grid;gap:7px}' +
      '.tc-guide-card li{font-size:11px;color:rgba(244,239,230,.72)}' +
      '.tc-guide-card li:before{content:"•";color:var(--gold);margin-right:7px}' +
      '.tc-guide-action{margin-top:auto;align-self:flex-start;border:1px solid var(--line);background:rgba(184,150,78,.06);color:var(--gold2);padding:9px 12px;border-radius:6px;cursor:pointer;position:relative;z-index:2}' +
      '.tc-guide-action:hover{background:rgba(184,150,78,.13);border-color:var(--gold)}' +
      '.tc-guide-footer{margin-top:34px;padding:22px;border:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(110deg,rgba(184,150,78,.08),transparent)}' +
      '.tc-guide-footer b{font:600 21px var(--serif)}' +
      '.tc-guide-footer span{display:block;color:var(--muted);font-size:11px;margin-top:4px}' +
      '@media(max-width:850px){.tc-clock-list{display:none}.tc-guide-journey{grid-template-columns:1fr 1fr}.tc-guide-step:not(:last-child):after{display:none}.tc-guide-cards{grid-template-columns:1fr}.tc-guide-top{flex-direction:column}.tc-guide-footer{flex-direction:column;align-items:flex-start}}' +
      '@media(max-width:600px){.tc-market-clocks{min-width:0}.tc-clock-kicker{display:none}.tc-guide-inner{width:calc(100% - 24px);padding-top:20px}.tc-guide-h1{font-size:42px}.tc-guide-journey{grid-template-columns:1fr}.tc-guide-card{padding:20px;min-height:0}.tc-guide-card:nth-child(3),.tc-guide-card:nth-child(4){min-height:0}}';
    document.head.appendChild(style);
  }

  var GUIDE = [
    ['01','JE DÉCOUVRE','Comprendre l’écosystème BRVM et les informations disponibles',['Cours, indices et variations','Volumes, BOC et titres cotés','Screener et informations de marché'],'Explorer les marchés','marche','◈'],
    ['02','J’ANALYSE','Comprendre une entreprise avant d’investir',['Analyse fondamentale et technique','Recommandations et comparaison','Dividendes et indicateurs financiers'],'Analyser une entreprise','analyse-fondamentale','◎'],
    ['03','JE SURVEILLE','Transformer une analyse en décision',['Liste de surveillance et notes','Scénarios et simulations','Trading Desk unifié'],'Ouvrir mon espace','desk-workspace.html','◉'],
    ['04','JE DÉCIDE','Structurer et suivre vos investissements',['Positions et performance','Évolution du portefeuille','Lecture simple du P&L'],'Voir mon portefeuille','portefeuille','◧'],
    ['05','JE GÈRE','Ne plus avoir besoin de surveiller constamment le marché',['Alertes de cours','Événements importants','Seuils à surveiller'],'Configurer mes alertes','alertes','△'],
    ['06','DONNÉES','Accéder aux informations financières utiles',['États financiers','Publications','Calendrier','Données disponibles'],'Explorer les données','financials','≡']
  ];

  function navigate(target) {
    if (target === 'desk-workspace.html') {
      global.location.href = '/app/desk-workspace.html';
      return;
    }
    if (typeof global.nav === 'function') {
      global.nav(target);
      return;
    }
    global.location.hash = target;
  }

  function closeGuide() {
    var modal = document.getElementById('tc-guide-premium');
    if (modal) modal.classList.remove('open');
    document.body.classList.remove('tc-guide-open');
  }

  function openGuide() {
    var modal = document.getElementById('tc-guide-premium');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tc-guide-premium';
      modal.className = 'tc-guide-premium';
      var steps = ['Je découvre','J’analyse','Je surveille','Je décide','Je gère'];
      var journey = steps.map(function (label, index) {
        return '<div class="tc-guide-step"><span>0' + (index + 1) + '</span><b>' + label + '</b></div>';
      }).join('');
      var cards = GUIDE.map(function (item) {
        return '<article class="tc-guide-card">' +
          '<div class="tc-guide-card-head"><div class="tc-guide-icon">' + item[6] + '</div><div><h3>' + item[1] + '</h3><p>' + item[2] + '</p></div></div>' +
          '<ul>' + item[3].map(function (point) { return '<li>' + point + '</li>'; }).join('') + '</ul>' +
          '<button class="tc-guide-action" type="button" data-guide-target="' + item[5] + '">' + item[4] + ' →</button>' +
        '</article>';
      }).join('');
      modal.innerHTML =
        '<div class="tc-guide-inner" role="dialog" aria-modal="true" aria-labelledby="tc-guide-title">' +
          '<div class="tc-guide-top"><div><div class="tc-guide-eyebrow">THE CAPITAL / ONBOARDING</div><h1 class="tc-guide-h1" id="tc-guide-title">BIENVENUE SUR <em>THE CAPITAL</em></h1><p class="tc-guide-lead">Comprendre la plateforme en quelques secondes.</p></div><button class="tc-guide-close2" type="button" data-guide-close>Fermer ×</button></div>' +
          '<div class="tc-guide-journey" aria-label="Parcours utilisateur">' + journey + '</div>' +
          '<div class="tc-guide-section-label">Votre parcours</div>' +
          '<div class="tc-guide-cards">' + cards + '</div>' +
          '<div class="tc-guide-footer"><div><b>De l’information à la décision.</b><span>Chaque espace de The Capital est conçu pour passer de l’analyse au suivi, puis à la gestion.</span></div><button class="tc-guide-action" type="button" data-guide-close>Commencer →</button></div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (event) {
        var target = event.target.closest ? event.target.closest('[data-guide-target]') : null;
        if (target) {
          closeGuide();
          navigate(target.getAttribute('data-guide-target'));
          return;
        }
        if ((event.target && event.target.hasAttribute('data-guide-close')) || event.target === modal) closeGuide();
      });
    }
    modal.classList.add('open');
    document.body.classList.add('tc-guide-open');
  }

  function bindGuideTriggers() {
    document.querySelectorAll('[data-open-guide], [data-guide]').forEach(function (node) {
      if (node.getAttribute('data-tc-guide-bound') === '1') return;
      node.setAttribute('data-tc-guide-bound', '1');
      node.addEventListener('click', function (event) {
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
  }

  global.TC_MARKET_UX = {
    start: start,
    getStatus: function () { return statusFor(state()); },
    openGuide: openGuide,
    closeGuide: closeGuide,
    getUserTimeZone: userTimeZone
  };
  global.openCapitalGuide = openGuide;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(window);
