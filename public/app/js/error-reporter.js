/**
 * Remontée visible des erreurs d'exécution.
 *
 * L'audit a montré que la quasi-totalité des pannes de cette application se
 * manifestaient par une section vide et rien d'autre : un script rejeté pour
 * erreur de syntaxe, une fonction absente, une table sans données. L'utilisateur
 * concluait à un défaut d'affichage, et le vrai message dormait dans la console.
 *
 * Ce module rend ces échecs visibles : une bannière discrète apparaît, avec le
 * message réel et de quoi le copier. Il n'altère aucun comportement existant.
 */
(function () {
  'use strict';
  if (window.__TC_ERROR_REPORTER__) return;
  window.__TC_ERROR_REPORTER__ = true;

  var journal = [];
  var MAX = 50;
  var banniere = null;

  function styles() {
    if (document.getElementById('tc-err-style')) return;
    var s = document.createElement('style');
    s.id = 'tc-err-style';
    s.textContent = [
      '#tc-err{position:fixed;left:12px;bottom:12px;z-index:99999;max-width:420px;',
      'background:#2a1614;border:1px solid #7c3f38;border-radius:8px;color:#f3d9d5;',
      'font:12px/1.5 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.5)}',
      '#tc-err header{display:flex;align-items:center;gap:8px;padding:9px 12px;',
      'border-bottom:1px solid #7c3f38;font-weight:600}',
      '#tc-err header button{margin-left:auto;background:none;border:0;color:#c9a7a2;',
      'cursor:pointer;font-size:15px;line-height:1}',
      '#tc-err ul{margin:0;padding:8px 12px;max-height:190px;overflow:auto;list-style:none}',
      '#tc-err li{padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);word-break:break-word}',
      '#tc-err li:last-child{border-bottom:0}',
      '#tc-err footer{padding:8px 12px;border-top:1px solid #7c3f38;display:flex;gap:8px}',
      '#tc-err footer button{background:#7c3f38;border:0;color:#fff;padding:5px 10px;',
      'border-radius:5px;cursor:pointer;font-size:11px}'
    ].join('');
    document.head.appendChild(s);
  }

  function rendre() {
    styles();
    if (!banniere) {
      banniere = document.createElement('div');
      banniere.id = 'tc-err';
      document.body.appendChild(banniere);
    }
    var items = journal.slice(-6).reverse().map(function (e) {
      return '<li><strong>' + escapeHtml(e.type) + '</strong> — ' + escapeHtml(e.message)
        + (e.source ? '<br><span style="opacity:.7">' + escapeHtml(e.source) + '</span>' : '') + '</li>';
    }).join('');
    banniere.innerHTML =
      '<header>⚠ ' + journal.length + ' erreur(s) détectée(s)'
      + '<button type="button" data-close aria-label="Fermer">×</button></header>'
      + '<ul>' + items + '</ul>'
      + '<footer><button type="button" data-copy>Copier le rapport</button></footer>';
    banniere.querySelector('[data-close]').onclick = function () {
      banniere.remove(); banniere = null;
    };
    banniere.querySelector('[data-copy]').onclick = function () {
      var texte = journal.map(function (e) {
        return '[' + e.at + '] ' + e.type + ' : ' + e.message + (e.source ? ' (' + e.source + ')' : '');
      }).join('\n');
      if (navigator.clipboard) navigator.clipboard.writeText(texte);
    };
  }

  function escapeHtml(v) {
    var d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  function signaler(type, message, source) {
    journal.push({
      type: type,
      message: String(message || 'erreur inconnue').slice(0, 300),
      source: source ? String(source).replace(location.origin, '') : '',
      at: new Date().toLocaleTimeString('fr-FR')
    });
    if (journal.length > MAX) journal.shift();
    if (document.body) rendre();
  }

  window.addEventListener('error', function (event) {
    // Script externe non chargé : la cible est l'élément, pas une exception.
    if (event.target && (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
      signaler('Ressource non chargée', event.target.src || event.target.href);
      return;
    }
    signaler('Erreur JavaScript', event.message, event.filename + ':' + event.lineno);
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    var raison = event.reason;
    signaler('Promesse rejetée', (raison && raison.message) || raison);
  });

  /** Consultable depuis la console : TCErrors.rapport() */
  window.TCErrors = {
    rapport: function () { return journal.slice(); },
    vider: function () { journal = []; if (banniere) { banniere.remove(); banniere = null; } }
  };
})();
