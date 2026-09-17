// THE CAPITAL — Boule d'or : navigation & aide, accessible depuis n'importe
// quelle page de l'app. Remplace l'ancien lien statique « Guide de
// navigation » (icône ◈ dans le header, lien « Guide » du compte) par un
// bouton flottant toujours visible, qui ouvre un panneau de recherche +
// carte du site. Widget autonome : sa propre feuille de style et son propre
// balisage, injectés au chargement — aucune dépendance à app.html.
(function () {
  'use strict';
  if (window.__TC_NAV_ORB_LOADED__) return;
  window.__TC_NAV_ORB_LOADED__ = true;

  var GUIDE = [
    { cat: 'Tableau de bord', icon: '◈', items: [
      { label: "Vue d'ensemble", desc: 'Indices, séance, activité et principaux mouvements du marché.', route: 'overview', href: '/app/app.html' }
    ]},
    { cat: 'Marché', icon: '▦', items: [
      { label: 'Titres BRVM', desc: 'Référentiel des titres cotés et accès aux fiches.', route: 'titres', href: '/app/app.html#titres' },
      { label: 'Marché BRVM', desc: 'Cotations et lecture de la séance.', route: 'marche', href: '/app/app.html#marche' },
      { label: 'Palmarès', desc: 'Hausses, baisses et échanges par période.', route: 'palmares', href: '/app/app.html#palmares' },
      { label: 'Obligations', desc: 'Marché obligataire, rendements, courbe des taux.', route: 'obligations', href: '/app/app.html#obligations' },
      { label: 'BOC', desc: 'Bulletin Officiel de la Cote et informations officielles.', route: 'boc', href: '/app/app.html#boc' }
    ]},
    { cat: 'Analyse', icon: '◎', items: [
      { label: 'Recommandations', desc: 'Avis et analyses disponibles dans The Capital.', route: 'analyses', href: '/app/app.html#analyses' },
      { label: 'Analyse Technique', desc: 'Graphiques, indicateurs, interprétation et opinion.', route: 'analyse-technique', href: '/app/app.html#analyse-technique' },
      { label: 'Analyse Fondamentale', desc: 'Ratios, valorisation DCF et lecture financière.', route: 'analyse-fondamentale', href: '/app/app.html#analyse-fondamentale' },
      { label: 'Screener', desc: 'Filtres combinables, indicateurs au choix, classement.', route: 'screener', href: '/app/app.html#screener' },
      { label: 'Screener Dividendes', desc: 'Filtrage des titres par profil de dividende.', route: 'dividend-screener', href: '/app/app.html#dividend-screener' },
      { label: 'Comparateur', desc: '2 à 6 sociétés, radar, indicateurs personnalisables.', route: 'comparison', href: '/app/app.html#comparison' },
      { label: 'Backtesting', desc: 'Simulation achat & conservation, hypothèses affichées.', route: 'backtest', href: '/app/app.html#backtest' },
      { label: 'Opportunités', desc: 'Signaux de marché du jour sur toute la cote.', route: 'opportunites', href: '/app/app.html#opportunites' },
      { label: 'Outils & Simulateurs', desc: 'Intérêts composés, obligations, fourchette BRVM, score maison.', route: 'outils', href: '/app/app.html#outils' }
    ]},
    { cat: 'Gestion', icon: '◧', items: [
      { label: 'Portefeuille', desc: 'Positions, transactions et performance.', route: 'portefeuille', href: '/app/app.html#portefeuille' },
      { label: 'Alertes', desc: 'Seuils de prix et notifications de suivi.', route: 'alertes', href: '/app/app.html#alertes' }
    ]},
    { cat: 'Données', icon: '≡', items: [
      { label: 'États financiers', desc: 'Comptes et informations financières des sociétés.', route: 'financials', href: '/app/app.html#financials' },
      { label: 'Calendrier', desc: 'Publications et événements attendus.', route: 'publications', href: '/app/app.html#publications' },
      { label: 'Annonces & Documents', desc: 'Documents et annonces émetteurs BRVM.', route: 'documents', href: '/app/app.html#documents' },
      { label: 'Évènements sur valeurs', desc: 'Opérations et événements affectant les titres.', route: 'evenements-valeurs', href: '/app/app.html#evenements-valeurs' }
    ]},
    { cat: 'Mon espace', icon: '◉', items: [
      { label: 'Mon compte', desc: 'Profil, préférences, sécurité et abonnement.', href: '/app/account.html' },
      { label: 'Offres & abonnement', desc: 'Comparer les formules et les tarifs.', href: '/pricing.html' }
    ]},
    { cat: 'Apprendre', icon: '?', items: [
      { label: 'The Capital Institute', desc: 'Ressources pédagogiques et parcours d’apprentissage.', href: '/the-capital-institute/index.html' }
    ]}
  ];

  var CSS = '\n'
    + '#tc-orb-btn{position:fixed;right:22px;bottom:22px;width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;z-index:999998;display:grid;place-items:center;padding:0;background:radial-gradient(circle at 32% 28%,#f3d998,#d4af6a 46%,#9a7430 100%);box-shadow:0 6px 18px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.14) inset,0 0 22px rgba(212,175,106,.35);transition:transform .18s ease,box-shadow .18s ease}'
    + '#tc-orb-btn:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 10px 24px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.18) inset,0 0 30px rgba(212,175,106,.5)}'
    + '#tc-orb-btn:active{transform:translateY(0) scale(.97)}'
    + '#tc-orb-btn svg{width:24px;height:24px;position:relative;z-index:1}'
    + '#tc-orb-btn::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(212,175,106,.55);opacity:0;animation:tc-orb-pulse 2.6s ease-out infinite}'
    + '#tc-orb-btn.tc-orb-seen::before{animation:none;display:none}'
    + '@keyframes tc-orb-pulse{0%{transform:scale(.9);opacity:.55}75%{transform:scale(1.5);opacity:0}100%{transform:scale(1.5);opacity:0}}'
    + '#tc-orb-tip{position:fixed;right:84px;bottom:36px;z-index:999998;background:#15120d;color:#f5f0e8;border:1px solid rgba(212,175,106,.35);padding:7px 11px;border-radius:8px;font:500 11px/1.3 \'DM Sans\',Arial,sans-serif;white-space:nowrap;opacity:0;pointer-events:none;transform:translateX(6px);transition:opacity .16s ease,transform .16s ease;box-shadow:0 8px 20px rgba(0,0,0,.35)}'
    + '#tc-orb-btn:hover+#tc-orb-tip{opacity:1;transform:translateX(0)}'
    + '@media(max-width:640px){#tc-orb-btn{right:14px;bottom:14px;width:48px;height:48px}#tc-orb-btn svg{width:21px;height:21px}#tc-orb-tip{display:none}}'
    + '#tc-orb-overlay{position:fixed;inset:0;z-index:999999;background:rgba(6,5,3,.72);backdrop-filter:blur(3px);display:none;align-items:flex-start;justify-content:center;padding:9vh 16px 40px}'
    + '#tc-orb-overlay.open{display:flex}'
    + '#tc-orb-panel{width:min(760px,100%);max-height:78vh;display:flex;flex-direction:column;background:#13110c;border:1px solid rgba(212,175,106,.22);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.55);overflow:hidden;font-family:\'DM Sans\',Arial,sans-serif;color:#f5f0e8}'
    + '#tc-orb-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(212,175,106,.16)}'
    + '#tc-orb-head-badge{width:34px;height:34px;border-radius:50%;flex:none;background:radial-gradient(circle at 32% 28%,#f3d998,#d4af6a 46%,#9a7430 100%);display:grid;place-items:center;box-shadow:0 0 14px rgba(212,175,106,.4)}'
    + '#tc-orb-head-badge svg{width:16px;height:16px}'
    + '#tc-orb-title{font:700 15px/1.2 \'Playfair Display\',Georgia,serif;letter-spacing:.01em}'
    + '#tc-orb-title span{color:#d4af6a}'
    + '#tc-orb-sub{margin-top:2px;font-size:10.5px;color:rgba(245,240,232,.55)}'
    + '#tc-orb-close{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid rgba(212,175,106,.18);background:transparent;color:rgba(245,240,232,.65);cursor:pointer;font-size:15px;line-height:1;flex:none}'
    + '#tc-orb-close:hover{color:#d4af6a;border-color:rgba(212,175,106,.4)}'
    + '#tc-orb-search-wrap{padding:12px 18px;border-bottom:1px solid rgba(212,175,106,.12)}'
    + '#tc-orb-search{width:100%;box-sizing:border-box;height:40px;border-radius:9px;border:1px solid rgba(212,175,106,.22);background:#1b1712;color:#f5f0e8;padding:0 14px;font:400 13px \'DM Sans\',Arial,sans-serif;outline:none}'
    + '#tc-orb-search:focus{border-color:rgba(212,175,106,.55);box-shadow:0 0 0 3px rgba(212,175,106,.1)}'
    + '#tc-orb-search::placeholder{color:rgba(245,240,232,.4)}'
    + '#tc-orb-body{overflow-y:auto;padding:8px 10px 16px}'
    + '#tc-orb-body::-webkit-scrollbar{width:8px}#tc-orb-body::-webkit-scrollbar-thumb{background:rgba(212,175,106,.28);border-radius:8px}'
    + '.tc-orb-cat{margin:14px 8px 4px;font:700 9.5px \'DM Sans\',Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d4af6a;display:flex;align-items:center;gap:7px}'
    + '.tc-orb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:0 8px}'
    + '.tc-orb-item{display:flex;flex-direction:column;gap:2px;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.02);cursor:pointer;color:inherit;font-family:inherit}'
    + '.tc-orb-item:hover,.tc-orb-item.tc-orb-active{background:rgba(212,175,106,.1);border-color:rgba(212,175,106,.3)}'
    + '.tc-orb-item b{font-size:12px;font-weight:600}'
    + '.tc-orb-item span{font-size:10.5px;color:rgba(245,240,232,.55);line-height:1.4}'
    + '#tc-orb-empty{display:none;padding:34px 16px;text-align:center;color:rgba(245,240,232,.5);font-size:12px}'
    + '#tc-orb-foot{padding:11px 18px;border-top:1px solid rgba(212,175,106,.12);display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:10.5px;color:rgba(245,240,232,.45)}'
    + '#tc-orb-foot a{color:#d4af6a;text-decoration:none}#tc-orb-foot a:hover{text-decoration:underline}'
    + '@media(max-width:640px){.tc-orb-grid{grid-template-columns:1fr}#tc-orb-overlay{padding:6vh 10px 24px}#tc-orb-panel{max-height:84vh}}';

  var COMPASS_SVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9.2" stroke="#0a0804" stroke-width="1.4"/><path d="M15.3 8.7l-2 4.6-4.6 2 2-4.6 4.6-2z" fill="#0a0804"/><circle cx="12" cy="12" r="1.1" fill="#f5f0e8"/></svg>';

  function injectCss() {
    if (document.getElementById('tc-orb-style')) return;
    var style = document.createElement('style');
    style.id = 'tc-orb-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }

  function build() {
    var seen = false;
    try { seen = localStorage.getItem('tc_nav_orb_seen') === '1'; } catch (e) {}

    var btn = el('button', { id: 'tc-orb-btn', type: 'button', 'aria-label': 'Naviguer sur The Capital — perdu ? cliquez ici' }, COMPASS_SVG);
    if (seen) btn.classList.add('tc-orb-seen');
    var tip = el('div', { id: 'tc-orb-tip' }, 'Perdu ? Naviguez ici');

    var overlay = el('div', { id: 'tc-orb-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Navigation The Capital' });
    var panel = el('div', { id: 'tc-orb-panel' });

    var head = el('div', { id: 'tc-orb-head' });
    var badge = el('div', { id: 'tc-orb-head-badge' }, COMPASS_SVG);
    var titleWrap = el('div', null,
      '<div id="tc-orb-title">THE <span>·</span> CAPITAL — Navigation</div>' +
      '<div id="tc-orb-sub">Retrouvez rapidement un outil ou un espace du site</div>');
    var close = el('button', { id: 'tc-orb-close', type: 'button', 'aria-label': 'Fermer' }, '×');
    head.appendChild(badge); head.appendChild(titleWrap); head.appendChild(close);

    var searchWrap = el('div', { id: 'tc-orb-search-wrap' });
    var search = el('input', { id: 'tc-orb-search', type: 'search', autocomplete: 'off', placeholder: 'Rechercher un outil, une valeur, une page…' });
    searchWrap.appendChild(search);

    var body = el('div', { id: 'tc-orb-body' });
    var empty = el('div', { id: 'tc-orb-empty' }, 'Aucun résultat. Essayez un autre mot-clé.');
    body.appendChild(empty);

    GUIDE.forEach(function (group) {
      var catEl = el('div', { class: 'tc-orb-cat', 'data-cat': group.cat.toLowerCase() }, group.icon + ' ' + group.cat);
      var gridEl = el('div', { class: 'tc-orb-grid' });
      group.items.forEach(function (item) {
        var it = el('button', { type: 'button', class: 'tc-orb-item', 'data-q': (item.label + ' ' + item.desc).toLowerCase() },
          '<b>' + item.label + '</b><span>' + item.desc + '</span>');
        it.addEventListener('click', function () { goTo(item); });
        gridEl.appendChild(it);
      });
      body.appendChild(catEl);
      body.appendChild(gridEl);
    });

    var foot = el('div', { id: 'tc-orb-foot' },
      '<span>Astuce : tapez un mot-clé pour filtrer</span>' +
      '<a href="/app/architecture.html">Voir la carte complète du site →</a>');

    panel.appendChild(head);
    panel.appendChild(searchWrap);
    panel.appendChild(body);
    panel.appendChild(foot);
    overlay.appendChild(panel);

    document.body.appendChild(btn);
    document.body.appendChild(tip);
    document.body.appendChild(overlay);

    function goTo(item) {
      var canRoute = item.route && typeof window.nav === 'function' && document.getElementById('view-' + item.route);
      closeModal();
      if (canRoute) { window.nav(item.route); return; }
      window.location.href = item.href;
    }

    function openModal() {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      btn.classList.add('tc-orb-seen');
      try { localStorage.setItem('tc_nav_orb_seen', '1'); } catch (e) {}
      search.value = '';
      filter('');
      setTimeout(function () { search.focus(); }, 30);
    }
    function closeModal() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    function filter(q) {
      q = q.trim().toLowerCase();
      var anyVisible = false;
      Array.prototype.forEach.call(body.querySelectorAll('.tc-orb-grid'), function (grid, i) {
        var cat = body.querySelectorAll('.tc-orb-cat')[i];
        var visibleInCat = 0;
        Array.prototype.forEach.call(grid.children, function (it) {
          var match = !q || it.getAttribute('data-q').indexOf(q) !== -1;
          it.style.display = match ? '' : 'none';
          if (match) visibleInCat++;
        });
        var show = visibleInCat > 0;
        grid.style.display = show ? '' : 'none';
        if (cat) cat.style.display = show ? '' : 'none';
        if (show) anyVisible = true;
      });
      empty.style.display = anyVisible ? 'none' : 'block';
    }

    btn.addEventListener('click', openModal);
    close.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
    });
    search.addEventListener('input', function () { filter(search.value); });
  }

  function init() {
    injectCss();
    build();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
