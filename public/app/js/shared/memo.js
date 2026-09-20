/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — MÉMOS CONTEXTUELS
   memo.js : icône discrète et panneau de lecture.

   Principe : partout où un chiffre demande une explication, une petite
   icône se glisse à côté de son libellé. Elle ne prend pas de place,
   ne s'impose pas, et n'affiche rien tant qu'on ne la sollicite pas.
   Au clic, un panneau latéral donne la définition, la formule, la
   façon de lire le chiffre et ce qu'il ne dit pas.

   Usage dans le HTML : data-memo="rsi" sur n'importe quel élément, ou
   l'appel TCMemo.icon('rsi') qui renvoie le fragment prêt à insérer.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.TCMemo) return;

  var DATA = global.TCMemoData || {};
  var panel = null, backdrop = null, lastFocus = null, showToken = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ── Style, injecté une seule fois ────────────────────────────── */

  function ensureStyle() {
    if (document.getElementById('tc-memo-style')) return;
    var st = document.createElement('style');
    st.id = 'tc-memo-style';
    st.textContent = [
      '.tc-memo-i{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;',
      'margin-left:5px;border:1px solid currentColor;border-radius:50%;font:600 9px/1 "DM Sans",system-ui,sans-serif;',
      'color:inherit;opacity:.38;cursor:help;vertical-align:middle;flex:0 0 auto;background:none;padding:0;',
      'transition:opacity .15s,transform .15s;user-select:none}',
      '.tc-memo-i:hover,.tc-memo-i:focus{opacity:1;transform:scale(1.12);outline:none}',
      '.tc-memo-i:focus-visible{box-shadow:0 0 0 2px rgba(200,162,78,.4)}',

      '.tc-memo-back{position:fixed;inset:0;z-index:11000;background:rgba(8,7,5,.55);',
      'backdrop-filter:blur(2px);opacity:0;transition:opacity .2s}',
      '.tc-memo-back.on{opacity:1}',

      '.tc-memo-panel{position:fixed;top:0;right:0;bottom:0;z-index:11001;width:min(430px,100vw);',
      'background:#13110c;border-left:1px solid rgba(200,162,78,.22);color:#e9e3d6;',
      'font-family:"DM Sans",system-ui,sans-serif;display:flex;flex-direction:column;',
      'transform:translateX(100%);transition:transform .24s cubic-bezier(.4,0,.2,1);',
      'box-shadow:-18px 0 50px rgba(0,0,0,.4)}',
      '.tc-memo-panel.on{transform:translateX(0)}',

      '.tc-memo-head{display:flex;align-items:flex-start;gap:12px;padding:18px 20px 14px;',
      'border-bottom:1px solid rgba(200,162,78,.12)}',
      '.tc-memo-kicker{font:600 9px/1.4 "DM Mono",monospace;letter-spacing:.16em;text-transform:uppercase;',
      'color:#c8a24e;margin-bottom:6px}',
      '.tc-memo-title{font:600 18px/1.3 "Playfair Display",Georgia,serif;color:#e9e3d6;margin:0}',
      '.tc-memo-x{margin-left:auto;width:28px;height:28px;flex:0 0 auto;display:grid;place-items:center;',
      'background:none;border:1px solid rgba(200,162,78,.2);border-radius:5px;color:rgba(233,227,214,.5);',
      'font-size:15px;cursor:pointer;transition:color .15s,border-color .15s}',
      '.tc-memo-x:hover{color:#e9e3d6;border-color:rgba(200,162,78,.5)}',

      '.tc-memo-body{flex:1;overflow-y:auto;padding:6px 20px 30px;scrollbar-width:thin}',
      '.tc-memo-body::-webkit-scrollbar{width:7px}',
      '.tc-memo-body::-webkit-scrollbar-thumb{background:rgba(200,162,78,.2);border-radius:4px}',

      '.tc-memo-sec{margin-top:20px}',
      '.tc-memo-lbl{font:600 9px/1.4 "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase;',
      'color:#c8a24e;padding-bottom:5px;margin-bottom:9px;border-bottom:1px solid rgba(200,162,78,.1)}',
      '.tc-memo-txt{font-size:13px;line-height:1.75;color:rgba(233,227,214,.78);margin:0}',
      '.tc-memo-formule{font-family:"DM Mono",ui-monospace,monospace;font-size:12px;line-height:1.7;',
      'color:rgba(233,227,214,.72);background:#17140e;border-left:2px solid rgba(200,162,78,.35);',
      'padding:11px 13px;border-radius:0 4px 4px 0;margin:0}',
      '.tc-memo-limite{border-left:2px solid #f0a72a;background:rgba(240,167,42,.06);',
      'padding:11px 13px;border-radius:0 4px 4px 0}',
      '.tc-memo-brvm{border-left:2px solid #3fc98a;background:rgba(63,201,138,.06);',
      'padding:11px 13px;border-radius:0 4px 4px 0}',

      '.tc-memo-rel{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}',
      '.tc-memo-rel button{padding:5px 10px;background:none;border:1px solid rgba(200,162,78,.2);',
      'border-radius:13px;color:rgba(233,227,214,.6);font:500 11px "DM Sans",sans-serif;cursor:pointer;',
      'transition:color .15s,border-color .15s}',
      '.tc-memo-rel button:hover{color:#c8a24e;border-color:rgba(200,162,78,.5)}',

      '.tc-memo-foot{padding:14px 20px;border-top:1px solid rgba(200,162,78,.12);',
      'font-size:10.5px;line-height:1.6;color:rgba(233,227,214,.34)}',
      '.tc-memo-search{width:100%;padding:8px 11px;margin-bottom:4px;background:#17140e;',
      'border:1px solid rgba(200,162,78,.2);border-radius:5px;color:#e9e3d6;',
      'font:500 12px "DM Sans",sans-serif}',
      '.tc-memo-search:focus{outline:none;border-color:#c8a24e}',
      '.tc-memo-list{display:flex;flex-direction:column;gap:2px;margin-top:8px}',
      '.tc-memo-list button{text-align:left;padding:9px 11px;background:#17140e;border:none;',
      'border-radius:4px;color:rgba(233,227,214,.75);font:500 12.5px "DM Sans",sans-serif;cursor:pointer;',
      'transition:background .12s}',
      '.tc-memo-list button:hover{background:rgba(200,162,78,.1);color:#e9e3d6}',
      '.tc-memo-list small{display:block;margin-top:3px;font-size:10.5px;color:rgba(233,227,214,.36);',
      'line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

      '.tc-memo-term{border-bottom:1px dotted rgba(200,162,78,.7);cursor:help}',
      '.tc-memo-term:hover,.tc-memo-term:focus{color:#c8a24e;outline:none}',
      '.tc-memo-tip{position:fixed;z-index:11002;display:none;width:min(330px,calc(100vw - 16px));padding:12px 14px;',
      'background:#17140e;border:1px solid rgba(200,162,78,.38);border-radius:8px;color:rgba(233,227,214,.86);',
      'font:400 12px/1.6 "DM Sans",system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.5);pointer-events:none}',
      '.tc-memo-tip p{margin:4px 0 0}.tc-memo-tip-t{font:600 13px/1.3 "DM Sans",sans-serif;color:#e9e3d6}',
      '.tc-memo-tip-l{margin-top:9px;font:600 9px/1.4 "DM Mono",monospace;letter-spacing:.13em;text-transform:uppercase;color:#c8a24e}',
      '.tc-memo-tip-f{font-family:"DM Mono",monospace;font-size:11px;color:rgba(233,227,214,.66)}',
      '.tc-memo-tip-h{margin-top:10px;padding-top:7px;border-top:1px solid rgba(200,162,78,.14);font-size:10.5px;color:rgba(233,227,214,.4)}',
      /* Thème clair, si la vue hôte le demande */
      '.atx-light .tc-memo-i,.af-light .tc-memo-i{opacity:.45}',
      '@media(max-width:520px){.tc-memo-panel{width:100vw}}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── Liens entre notions voisines ─────────────────────────────── */

  var VOISINS = {
    'operations-sur-titres': ['fractionnement', 'attribution-gratuite', 'augmentation-capital-numeraire', 'regroupement-actions'],
    fractionnement: ['operations-sur-titres', 'attribution-gratuite'],
    'attribution-gratuite': ['operations-sur-titres', 'reserves', 'fractionnement'],
    'regroupement-actions': ['operations-sur-titres', 'fractionnement'],
    'augmentation-capital-numeraire': ['operations-sur-titres', 'reserves'],
    rsi: ['divergence', 'stoch', 'macd'],
    macd: ['rsi', 'divergence', 'ma'],
    ma: ['supertrend', 'adx', 'linreg'],
    adx: ['ma', 'supertrend', 'atr'],
    bb: ['atr', 'volatilite'],
    atr: ['bb', 'dimensionnement', 'gain-risque'],
    volume: ['obv', 'mfi', 'liquidite'],
    obv: ['volume', 'mfi', 'divergence'],
    beta: ['volatilite', 'wacc'],
    sharpe: ['sortino', 'volatilite', 'drawdown'],
    sortino: ['sharpe', 'drawdown'],
    drawdown: ['var', 'sharpe'],
    var: ['drawdown', 'volatilite'],
    roe: ['dupont', 'roa', 'pbr'],
    roa: ['roe', 'dupont'],
    dupont: ['roe', 'gearing', 'marge-nette'],
    per: ['peg', 'pbr', 'ev-ebitda'],
    peg: ['per', 'dcf'],
    pbr: ['roe', 'per', 'graham'],
    'ev-ebitda': ['per', 'dette-ebitda', 'dette-nette'],
    dcf: ['wacc', 'valeur-terminale', 'dcf-inverse', 'fcf'],
    wacc: ['beta', 'dcf'],
    'valeur-terminale': ['dcf', 'gordon'],
    'dcf-inverse': ['dcf', 'peg'],
    gordon: ['rendement', 'payout', 'dcf'],
    rendement: ['payout', 'gordon'],
    payout: ['rendement', 'fcf'],
    fcf: ['conversion-cash', 'capex-ca', 'dcf'],
    'conversion-cash': ['fcf', 'marge-nette'],
    gearing: ['dette-nette', 'dette-ebitda', 'autonomie'],
    'dette-nette': ['gearing', 'dette-ebitda', 'ev-ebitda'],
    piotroski: ['altman', 'roe', 'fcf'],
    altman: ['piotroski', 'gearing'],
    graham: ['pbr', 'per', 'marge-securite'],
    'marge-securite': ['dcf', 'graham'],
    'gain-risque': ['dimensionnement', 'atr'],
    dimensionnement: ['gain-risque', 'atr'],
    backtest: ['score-technique'],
    'score-technique': ['backtest', 'divergence'],
    liquidite: ['volume', 'brvm'],
    brvm: ['liquidite']
  };

  /* ── Panneau ──────────────────────────────────────────────────── */

  function build() {
    if (panel) return;
    ensureStyle();
    backdrop = document.createElement('div');
    backdrop.className = 'tc-memo-back';
    backdrop.addEventListener('click', close);

    panel = document.createElement('aside');
    panel.className = 'tc-memo-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', 'Mémo');

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    panel.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-goto-memo]');
      if (b) { open(b.getAttribute('data-goto-memo')); return; }
      if (e.target.closest && e.target.closest('.tc-memo-x')) close();
    });
    panel.addEventListener('input', function (e) {
      if (e.target.classList && e.target.classList.contains('tc-memo-search')) {
        renderList(e.target.value, true);
      }
    });
  }

  function section(label, html, cls) {
    return '<div class="tc-memo-sec"><div class="tc-memo-lbl">' + esc(label) + '</div>' +
      '<div class="' + (cls || 'tc-memo-txt') + '">' + html + '</div></div>';
  }

  function open(key) {
    var m = DATA[key];
    if (!m) { openIndex(); return; }
    build();
    lastFocus = document.activeElement;

    var rel = (VOISINS[key] || []).filter(function (k) { return DATA[k]; });
    panel.innerHTML =
      '<div class="tc-memo-head"><div>' +
      '<div class="tc-memo-kicker">Mémo</div>' +
      '<h2 class="tc-memo-title">' + esc(m.titre) + '</h2>' +
      '</div><button type="button" class="tc-memo-x" aria-label="Fermer">✕</button></div>' +
      '<div class="tc-memo-body">' +
      section('De quoi s\'agit-il', '<p class="tc-memo-txt">' + esc(m.quoi) + '</p>') +
      section('Calcul', esc(m.formule), 'tc-memo-formule') +
      section('Comment le lire', '<p class="tc-memo-txt">' + esc(m.lecture) + '</p>') +
      section('Ce qu\'il ne dit pas', '<p class="tc-memo-txt">' + esc(m.limites) + '</p>', 'tc-memo-limite') +
      (m.brvm ? section('Sur la BRVM', '<p class="tc-memo-txt">' + esc(m.brvm) + '</p>', 'tc-memo-brvm') : '') +
      (rel.length ? '<div class="tc-memo-sec"><div class="tc-memo-lbl">À rapprocher de</div>' +
        '<div class="tc-memo-rel">' + rel.map(function (k) {
          return '<button type="button" data-goto-memo="' + esc(k) + '">' + esc(DATA[k].titre) + '</button>';
        }).join('') + '</div></div>' : '') +
      '</div>' +
      '<div class="tc-memo-foot">Ces mémos expliquent des outils, ils ne recommandent aucune opération. ' +
      '<button type="button" data-goto-memo="__index" style="background:none;border:none;color:#c8a24e;cursor:pointer;font:inherit;padding:0;text-decoration:underline">Voir tous les mémos</button></div>';

    show();
  }

  function openIndex() {
    build();
    panel.innerHTML =
      '<div class="tc-memo-head"><div>' +
      '<div class="tc-memo-kicker">Mémos</div>' +
      '<h2 class="tc-memo-title">Tous les repères</h2>' +
      '</div><button type="button" class="tc-memo-x" aria-label="Fermer">✕</button></div>' +
      '<div class="tc-memo-body">' +
      '<input type="search" class="tc-memo-search" placeholder="Rechercher une notion…" autocomplete="off">' +
      '<div class="tc-memo-list" id="tcMemoList"></div></div>' +
      '<div class="tc-memo-foot">' + Object.keys(DATA).length + ' notions expliquées.</div>';
    renderList('');
    show();
  }

  function renderList(q) {
    var host = panel.querySelector('#tcMemoList');
    if (!host) return;
    var term = String(q || '').trim().toLowerCase();
    var keys = Object.keys(DATA).filter(function (k) {
      if (!term) return true;
      var m = DATA[k];
      return (m.titre + ' ' + m.quoi).toLowerCase().indexOf(term) >= 0 || k.indexOf(term) >= 0;
    }).sort(function (a, b) { return DATA[a].titre.localeCompare(DATA[b].titre); });

    host.innerHTML = keys.length
      ? keys.map(function (k) {
        return '<button type="button" data-goto-memo="' + esc(k) + '">' + esc(DATA[k].titre) +
          '<small>' + esc(DATA[k].quoi) + '</small></button>';
      }).join('')
      : '<div class="tc-memo-txt" style="padding:14px 2px">Aucune notion ne correspond à cette recherche.</div>';
  }

  function show() {
    backdrop.style.display = 'block';
    var raf = global.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    var token = ++showToken;
    raf(function () {
      if (token !== showToken) return; /* fermé entre-temps */
      backdrop.classList.add('on');
      panel.classList.add('on');
    });
    var x = panel.querySelector('.tc-memo-x');
    if (x) x.focus();
  }

  function close() {
    if (!panel) return;
    showToken++;
    panel.classList.remove('on');
    backdrop.classList.remove('on');
    setTimeout(function () { if (backdrop) backdrop.style.display = 'none'; }, 240);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
  }

  /* ── Icône ────────────────────────────────────────────────────── */

  function icon(key, label) {
    if (!DATA[key]) return '';
    ensureStyle();
    var t = label || DATA[key].titre;
    return '<button type="button" class="tc-memo-i" data-memo="' + esc(key) + '" tabindex="0" ' +
      'aria-label="Mémo : ' + esc(t) + '">i</button>';
  }

  /* ── Bulle au survol ──────────────────────────────────────────────
     Sur toute icône ou tout terme portant data-memo, le survol (ou le
     focus clavier) affiche une bulle : ce que c'est, comment ça se
     calcule, ce qu'on peut en déduire. Le clic ouvre le mémo complet. */

  var tip = null, tipTimer = null;

  function tipEl() {
    if (tip) return tip;
    ensureStyle();
    tip = document.createElement('div');
    tip.className = 'tc-memo-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    return tip;
  }

  function shorten(s, n) {
    s = String(s || '');
    if (s.length <= n) return s;
    var c = s.slice(0, n), k = c.lastIndexOf('. ');
    return k > n * 0.5 ? c.slice(0, k + 1) : c.replace(/\s+\S*$/, '') + '…';
  }

  function tipHtml(key) {
    var m = DATA[key];
    if (!m) return '';
    return '<div class="tc-memo-tip-t">' + esc(m.titre) + '</div>' +
      '<p>' + esc(shorten(m.quoi, 240)) + '</p>' +
      (m.formule ? '<div class="tc-memo-tip-l">Calcul</div><p class="tc-memo-tip-f">' + esc(shorten(m.formule, 200)) + '</p>' : '') +
      (m.lecture ? '<div class="tc-memo-tip-l">Ce qu\'on peut en déduire</div><p>' + esc(shorten(m.lecture, 280)) + '</p>' : '') +
      '<div class="tc-memo-tip-h">Cliquez pour le mémo complet</div>';
  }

  function showTip(el) {
    var html = tipHtml(el.getAttribute('data-memo'));
    if (!html) return;
    var t = tipEl();
    t.innerHTML = html;
    t.style.visibility = 'hidden';
    t.style.display = 'block';
    var r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), global.innerWidth - w - 8);
    var top = r.bottom + 8;
    if (top + h > global.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    t.style.left = left + 'px';
    t.style.top = top + 'px';
    t.style.visibility = 'visible';
  }

  function hideTip() { clearTimeout(tipTimer); if (tip) tip.style.display = 'none'; }

  function memoTarget(e) { return e.target && e.target.closest ? e.target.closest('[data-memo]') : null; }

  document.addEventListener('mouseover', function (e) {
    var el = memoTarget(e);
    if (!el) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { showTip(el); }, 120);
  });
  document.addEventListener('mouseout', function (e) { if (memoTarget(e)) hideTip(); });
  document.addEventListener('focusin', function (e) { var el = memoTarget(e); if (el) showTip(el); });
  document.addEventListener('focusout', function (e) { if (memoTarget(e)) hideTip(); });
  global.addEventListener('scroll', hideTip, true);

  /* Terme souligné en pointillés : « <span data-memo="payout">taux de distribution</span> » */
  function term(key, label) {
    var l = label == null ? (DATA[key] ? DATA[key].titre : key) : label;
    if (!DATA[key]) return esc(l);
    ensureStyle();
    return '<span class="tc-memo-term" data-memo="' + esc(key) + '" tabindex="0">' + esc(l) + '</span>';
  }

  /* Délégation globale : tout élément portant data-memo devient cliquable,
     où qu'il soit inséré et quand qu'il le soit. */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-memo]');
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    open(t.getAttribute('data-memo'));
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideTip();
    if (e.key === 'Escape' && panel && panel.classList.contains('on')) close();
  });

  global.TCMemo = {
    open: open,
    index: openIndex,
    close: close,
    icon: icon,
    term: term,
    has: function (k) { return !!DATA[k]; },
    data: DATA,
    /* Ajoute une notion sans toucher au fichier de base : utile si une
       vue tierce veut documenter son propre indicateur. */
    register: function (key, memo) { if (key && memo && memo.titre) DATA[key] = memo; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
