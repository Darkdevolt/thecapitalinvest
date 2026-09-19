/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — LOGOS DES SOCIÉTÉS
   Les logos sont déposés dans l'administration (colonne
   entreprises.logo_url). Ce module les affiche partout où un ticker
   apparaît seul (cellule de tableau, pastille, carte), sans que
   chaque vue ait à connaître les logos :

     · tcLogo(ticker, { size, className }) → HTML d'une <img>, ou ''
       si la société n'a pas de logo (l'interface reste inchangée) ;
     · un observateur ajoute le logo devant tout texte qui est
       exactement un ticker connu, y compris dans les vues rendues
       plus tard. Ajouter data-no-logo sur un élément l'en exclut.

   Une société sans logo n'affiche rien de plus qu'avant.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.tcLogo) return;

  var logos = {};

  function refresh() {
    var list = Array.isArray(global.allEntreprises) ? global.allEntreprises : [];
    var map = {};
    list.forEach(function (e) {
      var url = e && e.logo_url ? String(e.logo_url).trim() : '';
      if (!e || !e.ticker || !/^https:\/\//i.test(url)) return;
      map[String(e.ticker).toUpperCase()] = url;
    });
    logos = map;
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.tcLogoUrl = function (ticker) { return logos[String(ticker || '').toUpperCase()] || ''; };

  global.tcLogo = function (ticker, opts) {
    var url = global.tcLogoUrl(ticker);
    if (!url) return '';
    opts = opts || {};
    var size = Number(opts.size) > 0 ? Number(opts.size) : 22;
    return '<img class="tc-logo ' + esc(opts.className || '') + '" src="' + esc(url) + '" alt="" width="' + size +
      '" height="' + size + '" loading="lazy" decoding="async" style="width:' + size + 'px;height:' + size + 'px">';
  };

  /* ── Style : tuile claire pour que le logo reste lisible en thème sombre ── */
  var css = document.createElement('style');
  css.textContent =
    '.tc-logo{display:inline-block;width:22px;height:22px;flex:none;object-fit:contain;box-sizing:border-box;' +
    'vertical-align:middle;margin-right:8px;padding:2px;background:#fff;border-radius:6px}' +
    'td>.tc-logo:first-child,th>.tc-logo:first-child{margin-top:-2px;margin-bottom:-2px}';
  (document.head || document.documentElement).appendChild(css);

  /* ── Décoration automatique des tickers ─────────────────────────── */

  var TICKER = /^[A-Z0-9]{2,6}$/;
  var EXCLUDED = 'svg,canvas,select,option,textarea,input,script,style,noscript,[data-no-logo],[contenteditable="true"]';

  function decorate(textNode) {
    var raw = textNode.nodeValue;
    if (!raw || raw.length > 16) return;
    var key = raw.trim();
    if (!TICKER.test(key) || !logos[key]) return;
    var host = textNode.parentNode;
    if (!host || host.nodeType !== 1 || host.closest(EXCLUDED)) return;
    var before = textNode.previousSibling;
    if (before && before.nodeType === 1 && before.classList.contains('tc-logo')) return;
    var img = document.createElement('img');
    img.className = 'tc-logo';
    img.src = logos[key];
    img.alt = '';
    img.width = 22; img.height = 22;
    img.loading = 'lazy'; img.decoding = 'async';
    host.insertBefore(img, textNode);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { decorate(root); return; }
    if (root.nodeType !== 1) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) decorate(node);
  }

  var pending = [], scheduled = false;
  function flush() {
    scheduled = false;
    var nodes = pending; pending = [];
    if (!Object.keys(logos).length) return;
    nodes.forEach(scan);
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    global.setTimeout(flush, 30);
  }

  function start() {
    refresh();
    scan(document.body);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'characterData') pending.push(m.target);
        else for (var i = 0; i < m.addedNodes.length; i++) pending.push(m.addedNodes[i]);
      });
      schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* Les logos arrivent avec le référentiel : on relit la liste à chaque
     chargement de données et on repasse sur la page déjà affichée. */
  document.addEventListener('tc:dataready', function () { refresh(); scan(document.body); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
