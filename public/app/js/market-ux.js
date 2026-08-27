// THE CAPITAL - centralized market UX
(function (global) {
  'use strict';
  if (global.__TC_MARKET_UX_LOADED__) return;
  global.__TC_MARKET_UX_LOADED__ = true;

  var BRVM_TZ = 'Africa/Abidjan';
  var DAKAR_TZ = 'Africa/Dakar';
  var DAY_NAMES = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  function getEngine() { return global.TC_BRVM_MARKET_HOURS || null; }
  function getState(date) { var e = getEngine(); return e && typeof e.getState === 'function' ? e.getState(date || new Date()) : null; }
  function clock(tz) { return new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()); }
  function userZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } }
  function zoneName(tz) { if (tz === BRVM_TZ) return 'Abidjan'; if (tz === DAKAR_TZ) return 'Dakar'; return String(tz || 'UTC').split('/').pop().replace(/_/g, ' ') || 'UTC'; }
  function dateKey(date) { var p = new Intl.DateTimeFormat('en-CA', { timeZone: BRVM_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date), o = {}; p.forEach(function (x) { o[x.type] = x.value; }); return o.year + '-' + o.month + '-' + o.day; }
  function dateLabel(date) { return new Intl.DateTimeFormat('fr-FR', { timeZone: BRVM_TZ, weekday: 'long', day: '2-digit', month: 'long' }).format(date); }
  function nextSession(from) { var d = new Date(from || Date.now()); for (var i = 0; i < 370; i += 1) { d.setUTCDate(d.getUTCDate() + 1); var s = getState(d); if (s && s.isTradingDay) return { date: new Date(d), state: s }; } return null; }
  function previousSession(from) { var d = new Date(from || Date.now()); for (var i = 0; i < 370; i += 1) { d.setUTCDate(d.getUTCDate() - 1); var s = getState(d); if (s && s.isTradingDay) return { date: new Date(d), state: s }; } return null; }

  function statusFor(state) {
    if (!state || !state.isTradingDay || state.phase === 'closed' || state.phase === 'official_close') return { code: 'closed', label: 'MARCHE FERME' };
    if (state.phase === 'pre_open') return { code: 'preopen', label: 'PRE-OUVERTURE' };
    if (state.phase === 'pre_close' || state.phase === 'closing_fixing') return { code: 'preclose', label: 'PRE-CLOTURE' };
    return { code: 'live', label: 'EN DIRECT' };
  }

  function updateStatus() {
    var state = getState(new Date()), status = statusFor(state), badge = document.querySelector('.header-badge');
    if (badge) { badge.className = 'header-badge tc-market-badge ' + status.code; badge.innerHTML = '<span class="tc-status-dot"></span><span>' + status.label + '</span>'; badge.title = state && state.reason ? 'BRVM - ' + state.reason : 'BRVM - reference Abidjan'; }
    var panel = document.getElementById('marketStatus');
    if (panel) { panel.className = 'market-status ' + status.code; panel.innerHTML = '<span class="status-dot"></span>' + status.label; panel.title = 'BRVM - reference : Africa/Abidjan'; }
    var time = document.getElementById('marketTime');
    if (time) time.textContent = clock(BRVM_TZ);
    var next = document.getElementById('marketNext');
    if (next) {
      if (status.code === 'closed') { var n = nextSession(); next.textContent = n ? 'Prochaine ouverture : 09:00 Abidjan - ' + dateLabel(n.date) : 'Prochaine ouverture : indisponible'; }
      else if (status.code === 'preopen') next.textContent = 'Ouverture : 09:45 Abidjan';
      else if (status.code === 'preclose') next.textContent = 'Fermeture : 15:00 Abidjan';
      else next.textContent = 'Marche actif - reference Abidjan';
    }
    var summary = document.getElementById('tc-market-session-summary');
    if (summary) {
      var today = state && state.isTradingDay && state.date === dateKey(new Date());
      var previous = previousSession();
      var upcoming = nextSession();
      summary.innerHTML = '<div class="tc-session-main"><strong>' + status.label + '</strong><span>Reference : Abidjan - BRVM</span></div><div class="tc-session-meta"><span>Derniere seance : <b>' + (today ? "aujourd'hui" : (previous ? dateLabel(previous.date) : '-')) + '</b></span><span>Prochaine ouverture : <b>' + (upcoming ? dateLabel(upcoming.date) : '-') + ' - 09:00 Abidjan</b></span></div>';
    }
  }

  function updateClocks() {
    var host = document.getElementById('headerTime');
    if (!host) return;
    if (host.dataset.tcClockBlock !== '1') {
      host.dataset.tcClockBlock = '1';
      host.classList.add('tc-market-clocks');
      host.innerHTML = '<div class="tc-clock-main"><span class="tc-clock-kicker">HEURE DU MARCHE</span><span class="tc-clock-primary"><b id="tc-clock-abidjan">--:--:--</b><small>&#x1F1E8;&#x1F1EE; Abidjan - BRVM</small></span></div><div class="tc-clock-list"><span><b id="tc-clock-dakar">--:--:--</b><small>&#x1F1F8;&#x1F1F3; Dakar</small></span><span><b id="tc-clock-user">--:--:--</b><small id="tc-clock-user-label">&#x1F30D; Votre heure</small></span></div>';
    }
    var tz = userZone(), a = document.getElementById('tc-clock-abidjan'), d = document.getElementById('tc-clock-dakar'), u = document.getElementById('tc-clock-user'), label = document.getElementById('tc-clock-user-label');
    if (a) a.textContent = clock(BRVM_TZ);
    if (d) d.textContent = clock(DAKAR_TZ);
    if (u) u.textContent = clock(tz);
    if (label) label.innerHTML = '&#x1F30D; Votre heure - ' + zoneName(tz);
  }

  function injectStyles() {
    if (document.getElementById('tc-market-ux-style')) return;
    var s = document.createElement('style'); s.id = 'tc-market-ux-style';
    s.textContent = '.header-badge.tc-market-badge{display:inline-flex;align-items:center;gap:7px;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid rgba(184,150,78,.2);background:rgba(184,150,78,.06);font:600 9px var(--mono);letter-spacing:.09em;white-space:nowrap}.tc-status-dot{width:7px;height:7px;border-radius:50%;background:#858585}.tc-market-badge.live .tc-status-dot{background:#65c18c}.tc-market-badge.preopen .tc-status-dot{background:#d7b85a}.tc-market-badge.preclose .tc-status-dot{background:#d88b4c}.tc-market-clocks{display:flex!important;align-items:center;gap:14px;min-width:320px}.tc-clock-main,.tc-clock-list,.tc-clock-list span{display:flex;align-items:center}.tc-clock-main{gap:9px}.tc-clock-kicker{font:500 8px var(--mono);letter-spacing:.12em;color:var(--gold);writing-mode:vertical-rl;transform:rotate(180deg)}.tc-clock-primary,.tc-clock-list span{display:flex;flex-direction:column;gap:3px}.tc-clock-primary b,.tc-clock-list b{font:500 12px var(--mono);color:var(--text)}.tc-clock-primary small,.tc-clock-list small{font:500 7px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:rgba(244,239,230,.48)}.tc-clock-list{gap:12px;padding-left:12px;border-left:1px solid var(--line)}.tc-session-summary{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:14px 16px;border:1px solid var(--line);background:linear-gradient(110deg,rgba(184,150,78,.07),transparent);border-radius:8px}.tc-session-main{display:flex;flex-direction:column;gap:4px}.tc-session-main strong{font:600 12px var(--mono)}.tc-session-main span,.tc-session-meta span{font-size:10px;color:var(--muted)}.tc-session-meta{display:flex;gap:20px;flex-wrap:wrap}.tc-session-meta b{color:var(--text)}.tc-guide-premium{position:fixed;inset:0;z-index:10001;background:rgba(8,7,5,.97);backdrop-filter:blur(18px);display:none;overflow:auto}.tc-guide-premium.open{display:block}.tc-guide-inner{width:min(1160px,calc(100% - 32px));margin:0 auto;padding:34px 0 60px}.tc-guide-top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:1px solid var(--line);padding-bottom:24px}.tc-guide-eyebrow{font:500 9px var(--mono);letter-spacing:.18em;color:var(--gold);text-transform:uppercase}.tc-guide-h1{font:700 clamp(38px,6vw,72px)/.98 var(--serif);margin:10px 0}.tc-guide-h1 em{color:var(--gold2)}.tc-guide-lead{max-width:700px;color:var(--muted);font-size:14px;line-height:1.7}.tc-guide-close2{border:1px solid var(--line);background:transparent;color:var(--text);padding:9px 13px;border-radius:7px;cursor:pointer}.tc-guide-journey{display:grid;grid-template-columns:repeat(5,1fr);margin:30px 0 44px;border:1px solid var(--line);background:var(--line);gap:1px}.tc-guide-step{background:var(--panel);padding:17px;position:relative}.tc-guide-step:not(:last-child):after{content:"->";position:absolute;right:-9px;top:50%;transform:translateY(-50%);z-index:2;color:var(--gold);background:var(--panel);padding:2px}.tc-guide-step b{font:600 16px var(--serif)}.tc-guide-step span{display:block;color:var(--gold);font:500 8px var(--mono);margin-bottom:8px}.tc-guide-section-label{font:500 9px var(--mono);letter-spacing:.16em;color:var(--gold);text-transform:uppercase}.tc-guide-cards{display:grid;grid-template-columns:1.15fr .85fr;gap:1px;background:var(--line);border:1px solid var(--line);margin-top:16px}.tc-guide-card{background:var(--panel);padding:26px;min-height:220px;display:flex;flex-direction:column;position:relative;overflow:hidden}.tc-guide-card:nth-child(2),.tc-guide-card:nth-child(5){background:var(--panel2)}.tc-guide-card:nth-child(3),.tc-guide-card:nth-child(4){min-height:250px}.tc-guide-card:after{content:"";position:absolute;right:-50px;bottom:-70px;width:180px;height:180px;border:1px solid rgba(184,150,78,.08);border-radius:50%}.tc-guide-card-head{display:flex;gap:15px;align-items:flex-start}.tc-guide-icon{width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(184,150,78,.24);color:var(--gold2);font:500 11px var(--mono);flex:none}.tc-guide-card h3{font:600 23px var(--serif);margin:0 0 6px}.tc-guide-card p{color:var(--muted);font-size:12px;line-height:1.65;margin:0}.tc-guide-card ul{list-style:none;padding:0;margin:17px 0;display:grid;gap:7px}.tc-guide-card li{font-size:11px;color:rgba(244,239,230,.72)}.tc-guide-card li:before{content:"-";color:var(--gold);margin-right:7px}.tc-guide-action{margin-top:auto;align-self:flex-start;border:1px solid var(--line);background:rgba(184,150,78,.06);color:var(--gold2);padding:9px 12px;border-radius:6px;cursor:pointer;position:relative;z-index:2}.tc-guide-action:hover{background:rgba(184,150,78,.13);border-color:var(--gold)}.tc-guide-footer{margin-top:34px;padding:22px;border:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(110deg,rgba(184,150,78,.08),transparent)}.tc-guide-footer b{font:600 21px var(--serif)}.tc-guide-footer span{display:block;color:var(--muted);font-size:11px;margin-top:4px}@media(max-width:850px){.tc-clock-list{display:none}.tc-guide-journey{grid-template-columns:1fr 1fr}.tc-guide-step:not(:last-child):after{display:none}.tc-guide-cards{grid-template-columns:1fr}.tc-guide-top{flex-direction:column}.tc-guide-footer{flex-direction:column;align-items:flex-start}}@media(max-width:600px){.tc-guide-inner{width:calc(100% - 24px);padding-top:20px}.tc-guide-h1{font-size:42px}.tc-guide-journey{grid-template-columns:1fr}.tc-guide-card{padding:20px;min-height:0}}';
    document.head.appendChild(s);
  }

  var GUIDE = [
    ['01','MARCHE','Comprendre ce qui se passe sur la BRVM',['Cours, indices et variations','Volumes, BOC et titres cotes','Screener et informations de marche'],'Explorer les marches','marche'],
    ['02','ANALYSE','Comprendre une entreprise avant d investir',['Analyse fondamentale et technique','Recommandations et comparaison','Dividendes et indicateurs financiers'],'Analyser une entreprise','analyse-fondamentale'],
    ['03','SUIVI & TRADING','Transformer une analyse en decision',['Liste de surveillance et notes','Scenarios et simulations','Trading Desk unifie'],'Ouvrir mon espace','desk-workspace.html'],
    ['04','PORTEFEUILLE','Suivre vos investissements',['Positions et performance','Evolution du portefeuille','Lecture simple du P&L'],'Voir mon portefeuille','portefeuille'],
    ['05','ALERTES','Ne plus avoir besoin de surveiller constamment le marche',['Alertes de cours','Evenements importants','Seuils a surveiller'],'Configurer mes alertes','alertes'],
    ['06','DONNEES','Acceder aux informations financieres',['Etats financiers','Publications','Calendrier','Donnees disponibles'],'Explorer les donnees','financials']
  ];

  function guideNavigate(target) {
    if (target === 'desk-workspace.html') { global.location.href = '/app/desk-workspace.html'; return; }
    if (typeof global.nav === 'function') { global.nav(target); return; }
    global.location.hash = target;
  }

  function openGuide() {
    var modal = document.getElementById('tc-guide-premium');
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'tc-guide-premium'; modal.className = 'tc-guide-premium';
      var cards = GUIDE.map(function (item) { return '<article class="tc-guide-card"><div class="tc-guide-card-head"><div class="tc-guide-icon">' + item[0] + '</div><div><h3>' + item[1] + '</h3><p>' + item[2] + '</p></div></div><ul>' + item[3].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul><button class="tc-guide-action" type="button" data-guide-target="' + item[5] + '">' + item[4] + ' -></button></article>'; }).join('');
      modal.innerHTML = '<div class="tc-guide-inner"><div class="tc-guide-top"><div><div class="tc-guide-eyebrow">THE CAPITAL - GUIDE</div><h1 class="tc-guide-h1">BIENVENUE SUR <em>THE CAPITAL.</em></h1><p class="tc-guide-lead">Comprendre la plateforme en quelques secondes. Du marche a l analyse, du suivi a la gestion de vos investissements.</p></div><button class="tc-guide-close2" type="button">Fermer</button></div><div class="tc-guide-journey">' + ['Je decouvre','J analyse','Je surveille','Je decide','Je gere'].map(function (x, i) { return '<div class="tc-guide-step"><span>0' + (i + 1) + '</span><b>' + x + '</b></div>'; }).join('') + '</div><div class="tc-guide-section-label">Les espaces The Capital</div><div class="tc-guide-cards">' + cards + '</div><div class="tc-guide-footer"><div><b>Vous ne savez pas par ou commencer ?</b><span>Commencez par Marche, puis Analyse. Le reste vient naturellement.</span></div><button class="tc-guide-action" type="button" data-guide-target="marche">Commencer le parcours -></button></div></div>';
      document.body.appendChild(modal);
      modal.querySelector('.tc-guide-close2').addEventListener('click', function () { modal.classList.remove('open'); });
      modal.addEventListener('click', function (event) { if (event.target === modal) modal.classList.remove('open'); });
      modal.querySelectorAll('[data-guide-target]').forEach(function (button) { button.addEventListener('click', function () { modal.classList.remove('open'); guideNavigate(button.getAttribute('data-guide-target')); }); });
    }
    modal.classList.add('open');
  }

  function ensureGuideButton() {
    var button = document.getElementById('tc-guide-btn');
    if (!button) { var host = document.querySelector('.topnav-right'); if (!host) return; button = document.createElement('button'); button.id = 'tc-guide-btn'; button.type = 'button'; button.className = 'tc-guide-btn'; host.insertBefore(button, host.firstChild); }
    if (button.dataset.tcPremium === '1') return;
    button.dataset.tcPremium = '1'; button.textContent = 'Guide'; button.onclick = openGuide;
  }

  function boot() {
    injectStyles();
    if (global.__TC_CLOCK_INTERVAL__) { clearInterval(global.__TC_CLOCK_INTERVAL__); global.__TC_CLOCK_INTERVAL__ = null; }
    ensureGuideButton(); updateClocks(); updateStatus();
    if (global.__TC_MARKET_UX_INTERVAL__) clearInterval(global.__TC_MARKET_UX_INTERVAL__);
    global.__TC_MARKET_UX_INTERVAL__ = setInterval(function () { ensureGuideButton(); updateClocks(); updateStatus(); }, 1000);
  }

  global.TC_MARKET_UX = { timezone: BRVM_TZ, getState: getState, getNextSession: nextSession, getPreviousSession: previousSession, refresh: function () { updateClocks(); updateStatus(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(window);
