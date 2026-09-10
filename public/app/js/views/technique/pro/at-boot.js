/* ============================================================================
   THE CAPITAL — ANALYSE TECHNIQUE PRO · amorce
   Le poste d'analyse technique (moteur technique/pro/*) était livré mais
   n'était branché nulle part : aucun script chargé, aucune ossature dans
   #view-analyse-technique. Ce fichier fait le raccord —
     1. il pose l'ossature HTML attendue par at-app.js ;
     2. il charge dans l'ordre at-math → at-indicators → at-chart →
        at-analysis → at-app ;
     3. il lance atInit() (les cours peuvent arriver après : at-app se
        recale seul sur l'évènement tc:dataready).
   Aucune API, donnée ou autre vue n'est touchée.
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.__TC_ATP_BOOT__) return;
  w.__TC_ATP_BOOT__ = true;

  var BASE = '/app/js/views/technique/pro/';
  var VER = '?v=20260910';
  var CHAIN = ['at-math.js', 'at-indicators.js', 'at-chart.js', 'at-analysis.js', 'at-app.js'];

  var SHELL =
    '<div class="atx-shell" id="atxShell">' +
    '<div class="atx-toolbar" id="atxToolbar"></div>' +
    '<div class="atx-main">' +
    '<div class="atx-tools" id="atxTools"></div>' +
    '<div class="atx-stage">' +
    '<div class="atx-quote" id="atxQuote"></div>' +
    '<div class="atx-canvas-host" id="atxCanvasHost">' +
    '<div class="atx-tool-hint" id="atxToolHint"></div>' +
    '</div>' +
    '<div class="atx-status" id="atxStatus">Chargement du poste d\'analyse technique…</div>' +
    '</div>' +
    '<div class="atx-side">' +
    '<div class="atx-tabs" id="atxTabs"></div>' +
    '<div class="atx-panel" id="atxPanel"></div>' +
    '</div>' +
    '</div>' +
    '</div>';

  function ensureShell() {
    var view = d.getElementById('view-analyse-technique');
    if (!view) return false;
    if (!d.getElementById('atxCanvasHost')) {
      view.innerHTML = SHELL;
    }
    return true;
  }

  function loadOne(src) {
    if (typeof w.tcLoadOnce === 'function') return w.tcLoadOnce(src);
    return new Promise(function (resolve) {
      var p = String(src).split('?')[0];
      if (d.querySelector('script[src="' + p + '"],script[src^="' + p + '?"]')) return resolve();
      var s = d.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { console.warn('[AT] indisponible : ' + src); resolve(); };
      (d.head || d.documentElement).appendChild(s);
    });
  }

  function loadChain(i) {
    if (i >= CHAIN.length) return Promise.resolve();
    return loadOne(BASE + CHAIN[i] + VER).then(function () { return loadChain(i + 1); });
  }

  // Repli : la vue « simple » (rapport données / indicateurs / lecture /
  // opinion). Elle se monte seule dans #view-analyse-technique et redéfinit
  // renderAnalyseTechnique. Utilisée uniquement si le moteur pro ne se charge
  // pas ou échoue à l'initialisation — l'utilisateur garde une vue qui marche.
  function fallbackSimple(reason) {
    console.warn('[AT] repli sur la vue simple' + (reason ? ' (' + reason + ')' : ''));
    loadOne('/app/js/views/analyse-technique.js?v=3').then(function () {
      if (typeof w.renderAnalyseTechnique === 'function') {
        try { w.renderAnalyseTechnique(); } catch (e) {}
      }
    });
  }

  function start() {
    ensureShell();
    loadChain(0).then(function () {
      if (typeof w.atInit !== 'function') {
        fallbackSimple('moteur pro absent après chargement');
        return;
      }
      try {
        w.atInit();
      } catch (e) {
        console.error('[AT] init pro', e);
        fallbackSimple('atInit a levé une exception');
        return;
      }
      // at-app.js pose son propre renderAnalyseTechnique ; on l'enveloppe pour
      // toujours garantir l'ossature avant qu'il ne s'exécute (une autre vue
      // pourrait avoir vidé #view-analyse-technique entre-temps).
      var real = w.renderAnalyseTechnique;
      w.renderAnalyseTechnique = function () {
        ensureShell();
        if (typeof w.atInit === 'function') { try { w.atInit(); } catch (e) { console.error('[AT] init', e); } }
        if (typeof real === 'function') { try { return real(); } catch (e) { console.error('[AT] render', e); } }
      };
      // main.js expose ce raccord : il relance proprement dès que allCours est prêt.
      if (typeof w.ensureTechnicalReady === 'function') { try { w.ensureTechnicalReady(); } catch (e) {} }
    });
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(window, document);
