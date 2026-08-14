// THE CAPITAL — Navigation Guard
// Centralise une navigation prévisible : historique des écrans, retour contextuel,
// liens SPA et bouton précédent du navigateur.
(function () {
  'use strict';
  if (window.__TC_NAV_GUARD__) return;
  window.__TC_NAV_GUARD__ = true;

  var LABELS = {
    overview: "Vue d’ensemble", titres: "Titres BRVM", marche: "Marché BRVM", boc: "BOC / Emprunts",
    analyses: "Recommandations", "analyse-technique": "Analyse technique", "analyse-fondamentale": "Analyse fondamentale",
    screener: "Screener", portefeuille: "Portefeuille", alertes: "Alertes", financials: "États financiers",
    publications: "Calendrier", formation: "Formation", fiche: "Fiche valeur",
    "analyse-detail": "Détail de l’analyse", "financials-detail": "Détail financier"
  };
  var ROOT = ['overview','titres','marche','boc','analyses','analyse-technique','analyse-fondamentale','screener','portefeuille','alertes','financials','publications','formation'];
  var STORAGE = '__tc_navigation_stack_v2__';
  var suppressNext = false;
  var wrapped = false;

  function rawCurrent() {
    if (typeof window.parseHashFromUrl === 'function') {
      try { return window.parseHashFromUrl(); } catch (e) {}
    }
    var h = location.hash || '';
    if (h.indexOf('#fiche=') === 0) return 'fiche';
    if (h.indexOf('#analyse=') === 0) return 'analyse-detail';
    if (h.indexOf('#financials=') === 0) return 'financials-detail';
    var key = h.replace(/^#/, '').split('?')[0];
    return LABELS[key] ? key : 'overview';
  }

  function current() { return rawCurrent(); }
  function label(v) { return LABELS[v] || 'The Capital'; }
  function readStack() {
    try { var x = JSON.parse(sessionStorage.getItem(STORAGE) || '[]'); return Array.isArray(x) ? x : []; }
    catch (e) { return []; }
  }
  function writeStack(s) {
    try { sessionStorage.setItem(STORAGE, JSON.stringify(s.slice(-30))); } catch (e) {}
  }
  function same(a,b) { return a && b && a === b; }

  function ensureStyle() {
    if (document.getElementById('tc-nav-guard-style')) return;
    var s = document.createElement('style'); s.id = 'tc-nav-guard-style';
    s.textContent = '.tc-nav-context{display:flex;align-items:center;gap:9px;margin:0 0 14px;min-height:32px}.tc-nav-back{border:1px solid var(--border2,rgba(184,150,78,.2));background:var(--surface,#13110c);color:var(--cream,#f5f0e8);border-radius:7px;padding:7px 11px;font:500 11px var(--sans,Arial);cursor:pointer}.tc-nav-back:hover{border-color:var(--gold,#b8964e);color:var(--gold,#b8964e)}.tc-nav-trail{font:500 11px var(--sans,Arial);color:var(--dim,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tc-nav-trail strong{color:var(--cream,#f5f0e8);font-weight:500}.tc-nav-home{border:0;background:none;color:var(--dim,#777);font-size:11px;cursor:pointer;padding:0}.tc-nav-home:hover{color:var(--gold,#b8964e)}';
    document.head.appendChild(s);
  }

  function fallbackParent(v) {
    if (v === 'fiche') return 'titres';
    if (v === 'analyse-detail') return 'analyses';
    if (v === 'financials-detail') return 'financials';
    return 'overview';
  }

  function navigate(target, fromBack) {
    if (!target) target = 'overview';
    var before = current();
    if (!fromBack && !same(before, target)) {
      var stack = readStack();
      if (!same(stack[stack.length - 1], before)) stack.push(before);
      writeStack(stack);
    }
    suppressNext = !!fromBack;
    if (typeof window.nav === 'function') window.nav(target);
    else location.hash = target;
  }

  function goBack() {
    var stack = readStack();
    var target = stack.pop();
    writeStack(stack);
    if (!target || target === current()) target = fallbackParent(current());
    navigate(target, true);
  }

  function renderContext() {
    ensureStyle();
    var main = document.querySelector('.main');
    if (!main) return;
    var active = document.querySelector('.view.active');
    if (!active) return;
    var v = current();
    var existing = document.getElementById('tc-nav-context');
    if (existing) existing.remove();
    if (v === 'overview') return;

    var stack = readStack();
    var parent = stack.length ? stack[stack.length - 1] : fallbackParent(v);
    if (parent === v) parent = fallbackParent(v);

    var box = document.createElement('div');
    box.id = 'tc-nav-context'; box.className = 'tc-nav-context';
    var back = document.createElement('button');
    back.type = 'button'; back.className = 'tc-nav-back'; back.textContent = '← Retour';
    back.addEventListener('click', goBack);
    var home = document.createElement('button');
    home.type = 'button'; home.className = 'tc-nav-home'; home.textContent = 'Accueil';
    home.addEventListener('click', function () { writeStack([]); navigate('overview', true); });
    var trail = document.createElement('div'); trail.className = 'tc-nav-trail';
    trail.innerHTML = '<span>' + label(parent) + '</span>  /  <strong>' + label(v) + '</strong>';
    box.appendChild(back); box.appendChild(home); box.appendChild(trail);
    main.insertBefore(box, main.firstChild);
  }

  function wrapNav() {
    if (wrapped || typeof window.nav !== 'function') return false;
    var original = window.nav;
    window.nav = function (target) {
      var before = current();
      if (target && target !== before && !suppressNext) {
        var stack = readStack();
        if (stack[stack.length - 1] !== before) { stack.push(before); writeStack(stack); }
      }
      suppressNext = false;
      return original.apply(this, arguments);
    };
    wrapped = true;
    return true;
  }

  window.tcNavigation = { back: goBack, navigate: navigate, render: renderContext, parentFor: fallbackParent };

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
    if (href.indexOf('app.html') === 0 && href.indexOf('#') !== -1) {
      e.preventDefault();
      var hash = href.split('#')[1];
      navigate(hash, false);
    }
  }, true);

  window.addEventListener('hashchange', function () { setTimeout(renderContext, 0); });
  window.addEventListener('popstate', function () { setTimeout(renderContext, 0); });
  document.addEventListener('DOMContentLoaded', function () {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      wrapNav();
      renderContext();
      if (wrapped || tries > 30) clearInterval(timer);
    }, 100);
  });
  setTimeout(function () { wrapNav(); renderContext(); }, 100);
})();
