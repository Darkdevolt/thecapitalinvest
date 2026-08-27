// THE CAPITAL — Market UX layer
// UI only: consumes the single BRVM session engine exposed by
// public/app/js/views/brvm-market-hours.js. No market/business API is duplicated here.
(function (global) {
  'use strict';
  if (global.__TC_MARKET_UX_LOADED__) return;
  global.__TC_MARKET_UX_LOADED__ = true;

  var BRVM_TZ = 'Africa/Abidjan';
  var DAKAR_TZ = 'Africa/Dakar';
  var DAY_NAMES = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  function pad(value) { return String(value).padStart(2, '0'); }
  function engine() { return global.TC_BRVM_MARKET_HOURS || null; }
  function stateAt(date) {
    var e = engine();
    return e && typeof e.getState === 'function' ? e.getState(date || new Date()) : null;
  }
  function browserTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (e) { return 'UTC'; }
  }
  function clock(timeZone) {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: timeZone,
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date());
  }
  function dateKey(date, timeZone) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    var map = {};
    parts.forEach(function (part) { map[part.type] = part.value; });
    return map.year + '-' + map.month + '-' + map.day;
  }
  function dateLabel(date, timeZone) {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: timeZone, weekday: 'long', day: '2-digit', month: 'long'
    }).format(date);
  }
  function zoneCity(timeZone) {
    if (timeZone === BRVM_TZ) return 'Abidjan';
    if (timeZone === DAKAR_TZ) return 'Dakar';
    var value = String(timeZone || 'UTC').split('/').pop().replace(/_/g, ' ');
    return value || 'UTC';
  }
  function nextSession(from) {
    var base = new Date(from || Date.now());
    for (var i = 0; i < 370; i += 1) {
      base.setUTCDate(base.getUTCDate() + 1);
      var candidate = stateAt(base);
      if (candidate && candidate.isTradingDay) return { date: new Date(base), state: candidate };
    }
    return null;
  }
  function previousSession(from) {
    var base = new Date(from || Date.now());
    for (var i = 0; i < 370; i += 1) {
      base.setUTCDate(base.getUTCDate() - 1);
      var candidate = stateAt(base);
      if (candidate && candidate.isTradingDay) return { date: new Date(base), state: candidate };
    }
    return null;
  }
  function marketStatus(state) {
    if (!state || !state.isTradingDay || state.phase === 'closed' || state.phase === 'official_close') {
      return { code: 'closed', label: 'MARCHÉ FERMÉ' };
    }
    if (state.phase === 'pre_open') return { code: 'preopen', label: 'PRÉ-OUVERTURE' };
    if (state.phase === 'pre_close' || state.phase === 'closing_fixing') {
      return { code: 'preclose', label: 'PRÉ-CLÔTURE' };
    }
    return { code: 'live', label: 'EN DIRECT' };
  }
  function nextSessionText(state) {
    var next = nextSession(new Date());
    if (!next) return 'Prochaine ouverture : indisponible';
    var time = next.state && next.state.nextPhaseAt;
    if (time) {
      var hhmm = new Date(time).toLocaleTimeString('fr-FR', {
        timeZone: BRVM_TZ, hour: '2-digit', minute: '2-digit', hour12: false
      });
      return 'Prochaine ouverture : ' + hhmm + ' Abidjan';
    }
    return 'Prochaine ouverture : 09:00 Abidjan';
  }
  function updateStatus() {
    var state = stateAt(new Date());
    var status = marketStatus(state);
    var badge = document.querySelector('.header-badge');
    if (badge) {
      badge.className = 'header-badge tc-market-badge ' + status.code;
      badge.innerHTML = '<span class="tc-status-dot"></span><span>' + status.label + '</span>';
      badge.title = state && state.reason ? 'BRVM — ' + state.reason : 'BRVM — référence Abidjan';
      badge.setAttribute('aria-label', status.label);
    }
    var panel = document.getElementById('marketStatus');
    if (panel) {
      panel.className = 'market-status ' + status.code;
      panel.innerHTML = '<span class="status-dot"></span>' + status.label;
      panel.title = 'BRVM — référence horaire : Abidjan (Africa/Abidjan)';
    }
    var marketTime = document.getElementById('marketTime');
    if (marketTime) marketTime.textContent = clock(BRVM_TZ);

    var marketNext = document.getElementById('marketNext');
    if (marketNext) {
      if (status.code === 'closed') {
        marketNext.textContent = nextSessionText(state);
      } else if (status.code === 'preopen') {
        marketNext.textContent = 'Ouverture : 09:45 Abidjan';
      } else if (status.code === 'preclose') {
        marketNext.textContent = 'Fermeture : 15:00 Abidjan';
      } else {
        marketNext.textContent = 'Marché actif · référence Abidjan';
      }
    }

    var summary = document.getElementById('tc-market-session-summary');
    if (summary) renderSessionSummary(summary, state, status);
  }
  function renderSessionSummary(container, state, status) {
    var now = new Date();
    var todayKey = dateKey(now, BRVM_TZ);
    var previous = previousSession(now);
    var next = nextSession(now);
    var todayIsSession = state && state.isTradingDay && state.date === todayKey;
    var lastText = todayIsSession ? 'aujourd’hui' : (previous ? dateLabel(previous.date, BRVM_TZ) : '—');
    var nextText = next ? dateLabel(next.date, BRVM_TZ) : '—';
    container.innerHTML =
      '<div class="tc-session-main"><strong>' + status.label + '</strong>' +
      '<span>Référence : Abidjan · BRVM</span></div>' +
      '<div class="tc-session-meta"><span>Dernière séance : <b>' + lastText + '</b></span>' +
      '<span>Prochaine ouverture : <b>' + nextText + ' · 09:00 Abidjan</b></span></div>';
  }
  function ensureClockBlock() {
    var host = document.getElementById('headerTime');
    if (!host) return;
    if (host.dataset.tcClockBlock === '1') return;
    host.dataset.tcClockBlock = '1';
    host.classList.add('tc-market-clocks');
    host.innerHTML =
      '<div class="tc-clock-main"><span class="tc-clock-kicker">HEURE DU MARCHÉ</span>' +
      '<span class="tc-clock-primary"><b id="tc-clock-abidjan">--:--:--</b><small>🇨🇮 Abidjan · BRVM</small></span></div>' +
      '<div class="tc-clock-list"><span><b id="tc-clock-dakar">--:--:--</b><small>🇸🇳 Dakar</small></span>' +
      '<span><b id="tc-clock-user">--:--:--</b><small id="tc-clock-user-label">🌍 Votre heure</small></span></div>';
  }
  function updateClocks() {
    ensureClockBlock();
    var userZone = browserTimeZone();
    var abidjan = document.getElementById('tc-clock-abidjan');
    var dakar = document.getElementById('tc-clock-dakar');
    var user = document.getElementById('tc-clock-user');
    var userLabel = document.getElementById('tc-clock-user-label');
    if (abidjan) abidjan.textContent = clock(BRVM_TZ);
    if (dakar) dakar.textContent = clock(DAKAR_TZ);
    if (user) user.textContent = clock(userZone);
    if (userLabel) userLabel.textContent = '🌍 Votre heure · ' + zoneCity(userZone);
  }
  function injectStyles() {
    if (document.getElementById('tc-market-ux-style')) return;
    var style = document.createElement('style');
    style.id = 'tc-market-ux-style';
    style.textContent = '\
.header-badge.tc-market-badge{display:inline-flex;align-items:center;gap:7px;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(184,150,78,.2);background:rgba(184,150,78,.06);font:600 9px var(--mono);letter-spacing:.09em;white-space:nowrap}\
.tc-market-badge .tc-status-dot{width:7px;height:7px;border-radius:50%;background:#858585;box-shadow:0 0 0 3px rgba(133,133,133,.08)}\
.tc-market-badge.live .tc-status-dot{background:#65c18c;box-shadow:0 0 0 3px rgba(101,193,140,.12)}\
.tc-market-badge.preopen .tc-status-dot{background:#d7b85a;box-shadow:0 0 0 3px rgba(215,184,90,.12)}\
.tc-market-badge.preclose .tc-status-dot{background:#d88b4c;box-shadow:0 0 0 3px rgba(216,139,76,.12)}\
.tc-market-clocks{display:flex!important;align-items:center;gap:14px;min-width:320px;color:var(--muted);line-height:1.05}\
.tc-clock-main,.tc-clock-list,.tc-clock-list span{display:flex;align-items:center}.tc-clock-main{gap:9px}.tc-clock-kicker{font:500 8px var(--mono);letter-spacing:.12em;color:var(--gold);writing-mode:vertical-rl;transform:rotate(180deg)}\
.tc-clock-primary,.tc-clock-list span{display:flex;flex-direction:column;gap:3px}.tc-clock-primary b,.tc-clock-list b{font:500 12px var(--mono);color:var(--text)}.tc-clock-primary small,.tc-clock-list small{font:500 7px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:rgba(244,239,230,.48)}.tc-clock-list{gap:12px;padding-left:12px;border-left:1px solid var(--line)}\
.tc-session-summary{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:14px 16px;border:1px solid var(--line);background:linear-gradient(110deg,rgba(184,150,78,.07),transparent);border-radius:8px}.tc-session-main{display:flex;flex-direction:column;gap:4px}.tc-session-main strong{font:600 12px var(--mono);letter-spacing:.08em}.tc-session-main span,.tc-session-meta span{font-size:10px;color:var(--muted)}.tc-session-meta{display:flex;gap:20px;flex-wrap:wrap}.tc-session-meta b{color:var(--text);font-weight:600}\
.tc-guide-premium{position:fixed;inset:0;z-index:10001;background:rgba(8,7,5,.97);backdrop-filter:blur(18px);display:none;overflow:auto}.tc-guide-premium.open{display:block}.tc-guide-inner{width:min(1160px,calc(100% - 32px));margin:0 auto;padding:34px 0 60px}.tc-guide-top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:1px solid var(--line);padding-bottom:24px}.tc-guide-eyebrow{font:500 9px var(--mono);letter-spacing:.18em;color:var(--gold);text-transform:uppercase}.tc-guide-h1{font:700 clamp(38px,6vw,72px)/.98 var(--serif);margin:10px 0}.tc-guide-h1 em{color:var(--gold2)}.tc-guide-lead{max-width:700px;color:var(--muted);font-size:14px;line-height:1.7}.tc-guide-close2{border:1px solid var(--line);background:transparent;color:var(--text);padding:9px 13px;border-radius:7px;cursor:pointer;font:500 10px var(--mono);text-transform:uppercase}.tc-guide-journey{display:grid;grid-template-columns:repeat(5,1fr);margin:30px 0 44px;border:1px solid var(--line);background:var(--line);gap:1px}.tc-guide-step{background:var(--panel);padding:17px 16px;position:relative}.tc-guide-step:not(:last-child):after{content:'→';position:absolute;right:-9px;top:50%;transform:translateY(-50%);z-index:2;color:var(--gold);background:var(--panel);font:500 12px var(--mono);padding:2px}.tc-guide-step b{font:600 16px var(--serif)}.tc-guide-step span{display:block;color:var(--gold);font:500 8px var(--mono);margin-bottom:8px}.tc-guide-section-label{font:500 9px var(--mono);letter-spacing:.16em;color:var(--gold);text-transform:uppercase}.tc-guide-cards{display:grid;grid-template-columns:1.15fr .85fr;gap:1px;background:var(--line);border:1px solid var(--line);margin-top:16px}.tc-guide-card{background:var(--panel);padding:26px;min-height:220px;display:flex;flex-direction:column;position:relative;overflow:hidden}.tc-guide-card:nth-child(2),.tc-guide-card:nth-child(5){background:var(--panel2)}.tc-guide-card:nth-child(3),.tc-guide-card:nth-child(4){min-height:250px}.tc-guide-card:after{content:'';position:absolute;right:-50px;bottom:-70px;width:180px;height:180px;border:1px solid rgba(184,150,78,.08);border-radius:50%}.tc-guide-card-head{display:flex;gap:15px;align-items:flex-start}.tc-guide-icon{width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(184,150,78,.24);color:var(--gold2);font:500 11px var(--mono);flex:none}.tc-guide-card h3{font:600 23px var(--serif);margin:0 0 6px}.tc-guide-card p{color:var(--muted);font-size:12px;line-height:1.65;margin:0;max-width:520px}.tc-guide-card ul{list-style:none;padding:0;margin:17px 0;display:grid;gap:7px}.tc-guide-card li{font-size:11px;color:rgba(244,239,230,.72)}.tc-guide-card li:before{content:'—';color:var(--gold);margin-right:7px}.tc-guide-action{margin-top:auto;align-self:flex-start;border:1px solid var(--line);background:rgba(184,150,78,.06);color:var(--gold2);padding:9px 12px;border-radius:6px;font:500 9px var(--mono);letter-spacing:.07em;text-transform:uppercase;cursor:pointer;position:relative;z-index:2}.tc-guide-action:hover{background:rgba(184,150,78,.13);border-color:var(--gold)}.tc-guide-footer{margin-top:34px;padding:22px;border:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(110deg,rgba(184,150,78,.08),transparent)}.tc-guide-footer b{font:600 21px var(--serif)}.tc-guide-footer span{display:block;color:var(--muted);font-size:11px;margin-top:4px}\
@media(max-width:850px){.tc-market-clocks{min-width:0}.tc-clock-list{display:none}.tc-guide-journey{grid-template-columns:1fr 1fr}.tc-guide-step:not(:last-child):after{display:none}.tc-guide-cards{grid-template-columns:1fr}.tc-guide-top{flex-direction:column}.tc-guide-footer{flex-direction:column;align-items:flex-start}}\
@media(max-width:600px){.tc-market-clocks{gap:6px}.tc-clock-kicker{display:none}.tc-clock-primary small{font-size:6px}.tc-market-badge{max-width:130px;overflow:hidden}.tc-guide-inner{width:calc(100% - 24px);padding-top:20px}.tc-guide-h1{font-size:42px}.tc-guide-journey{grid-template-columns:1fr}.tc-guide-card{padding:20px;min-height:0}.tc-guide-card h3{font-size:21px}}';
    document.head.appendChild(style);
  }
  function guideTarget(target) {
    if (target === 'desk-workspace.html') { global.location.href = '/app/desk-workspace.html'; return; }
    if (typeof global.nav === 'function') { global.nav(target); return; }
    global.location.hash = target;
  }
  var GUIDE = [
    ['01','MARCHÉ','Comprendre ce qui se passe sur la BRVM',['Cours, indices et variations','Volumes, BOC et titres cotés','Screener et informations de marché'],'Explorer les marchés','marche'],
    ['02','ANALYSE','Comprendre une entreprise avant d’investir',['Analyse fondamentale et technique','Recommandations et comparaison','Dividendes et indicateurs financiers'],'Analyser une entreprise','analyse-fondamentale'],
    ['03','SUIVI & TRADING','Transformer une analyse en décision',['Liste de surveillance et notes','Scénarios et simulations','Trading Desk unifié'],'Ouvrir mon espace','desk-workspace.html'],
    ['04','PORTEFEUILLE','Suivre vos investissements',['Positions et performance','Évolution du portefeuille','Lecture simple du P&L'],'Voir mon portefeuille','portefeuille'],
    ['05','ALERTES','Ne plus avoir besoin de surveiller constamment le marché',['Alertes de cours','Événements importants','Seuils à surveiller'],'Configurer mes alertes','alertes'],
    ['06','DONNÉES','Accéder aux informations financières',['États financiers','Publications','Calendrier','Données disponibles'],'Explorer les données','financials']
  ];
  function openGuide() {
    var modal = document.getElementById('tc-guide-premium');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tc-guide-premium';
      modal.className = 'tc-guide-premium';
      var cards = GUIDE.map(function (item) {
        return '<article class="tc-guide-card"><div class="tc-guide-card-head"><div class="tc-guide-icon">' + item[0] + '</div><div><h3>' + item[1] + '</h3><p>' + item[2] + '</p></div></div><ul>' + item[3].map(function (line) { return '<li>' + line + '</li>'; }).join('') + '</ul><button class="tc-guide-action" type="button" data-guide-target="' + item[5] + '">' + item[4] + ' →</button></article>';
      }).join('');
      modal.innerHTML = '<div class="tc-guide-inner"><div class="tc-guide-top"><div><div class="tc-guide-eyebrow">THE CAPITAL · GUIDE</div><h1 class="tc-guide-h1">Bienvenue sur <em>The Capital.</em></h1><p class="tc-guide-lead">Comprendre la plateforme en quelques secondes. Suivez le parcours qui vous correspond, du marché à la gestion de vos investissements.</p></div><button class="tc-guide-close2" type="button">Fermer ×</button></div><div class="tc-guide-journey">' + ['Je découvre','J’analyse','Je surveille','Je décide','Je gère'].map(function (label, index) { return '<div class="tc-guide-step"><span>0' + (index + 1) + '</span><b>' + label + '</b></div>'; }).join('') + '</div><div class="tc-guide-section-label">Les espaces The Capital</div><div class="tc-guide-cards">' + cards + '</div><div class="tc-guide-footer"><div><b>Vous ne savez pas par où commencer ?</b><span>Commencez par Marché, puis Analyse. Le reste vient naturellement.</span></div><button class="tc-guide-action" type="button" data-guide-target="marche">Commencer le parcours →</button></div></div>';
      document.body.appendChild(modal);
      modal.querySelector('.tc-guide-close2').addEventListener('click', function () { modal.classList.remove('open'); });
      modal.addEventListener('click', function (event) { if (event.target === modal) modal.classList.remove('open'); });
      modal.querySelectorAll('[data-guide-target]').forEach(function (button) {
        button.addEventListener('click', function () { modal.classList.remove('open'); guideTarget(button.getAttribute('data-guide-target')); });
      });
    }
    modal.classList.add('open');
  }
  function ensureGuideButton() {
    var button = document.getElementById('tc-guide-btn');
    if (!button) {
      var host = document.querySelector('.topnav-right');
      if (!host) return;
      button = document.createElement('button');
      button.id = 'tc-guide-btn';
      button.type = 'button';
      button.className = 'tc-guide-btn';
      host.insertBefore(button, host.firstChild);
    }
    if (button.dataset.tcPremium === '1') return;
    button.dataset.tcPremium = '1';
    button.textContent = 'ⓘ Guide';
    button.onclick = openGuide;
  }
  function boot() {
    injectStyles();
    ensureGuideButton();
    updateClocks();
    updateStatus();
    if (global.__TC_MARKET_UX_INTERVAL__) clearInterval(global.__TC_MARKET_UX_INTERVAL__);
    global.__TC_MARKET_UX_INTERVAL__ = setInterval(function () {
      ensureGuideButton();
      updateClocks();
      updateStatus();
    }, 1000);
  }
  global.TC_MARKET_UX = {
    timezone: BRVM_TZ,
    getState: stateAt,
    getNextSession: nextSession,
    getPreviousSession: previousSession,
    refresh: function () { updateClocks(); updateStatus(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window);
