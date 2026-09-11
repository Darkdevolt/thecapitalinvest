/* ============================================================================
   THE CAPITAL — Application des formules (front)
   ----------------------------------------------------------------------------
   S'appuie sur window.TC.can(feature) (tiers.js). Tant que le mode serveur
   n'est pas "on", TC.can() renvoie toujours true : ce module ne change alors
   rien de visible — badges et murs n'apparaissent qu'une fois l'application
   réelle activée (variable d'environnement TC_TIERS=on).

   Deux traitements, choisis par module :
     - HARD_LOCK  : la vue est remplacée par un mur payant classique
                    (Recommandations, Technique, Fondamentale, Backtest,
                    Obligations, Portefeuille, Alertes).
     - PREVIEW    : la vue reste utilisable mais sa partie basse s'estompe
                    sous un bandeau d'offre — l'utilisateur voit qu'il y a
                    plus à débloquer sans que rien ne soit caché d'emblée
                    (Screener, Comparateur, Screener Dividendes, Opportunités).

   Certaines nuances du rapport (historique BOC/Palmarès, export calendrier,
   DCF au sein de la Fondamentale) restent à affiner à l'intérieur de leur
   vue respective — hors de portée d'un gate au niveau de la route.
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.__TC_TIERS_UI__) return;
  w.__TC_TIERS_UI__ = true;

  var HARD_LOCK = {
    analyses: { feature: 'recommandations', tier: 'investor', label: 'Recommandations', desc: 'Notes et recommandations The Capital Research sur les valeurs de la cote.' },
    'analyse-technique': { feature: 'technique', tier: 'investor', label: 'Analyse technique', desc: 'Poste d\'analyse technique complet : graphique, indicateurs, signaux, plan de trade, backtests.' },
    'analyse-fondamentale': { feature: 'fondamentale', tier: 'investor', label: 'Analyse fondamentale', desc: 'Ratios de valorisation, DCF et lecture fondamentale de chaque société.' },
    backtest: { feature: 'backtest', tier: 'pro', label: 'Backtesting', desc: 'Test de stratégies sur l\'historique complet de la BRVM.' },
    obligations: { feature: 'obligations', tier: 'investor', label: 'Obligations', desc: 'Marché obligataire, courbe des taux et tableaux d\'amortissement.' },
    portefeuille: { feature: 'portefeuille', tier: 'investor', label: 'Portefeuille', desc: 'Suivi de portefeuille réel, valorisation et performance.' },
    alertes: { feature: 'alertes_prix', tier: 'investor', label: 'Alertes', desc: 'Alertes de seuil de cours sur les valeurs suivies.' }
  };

  var PREVIEW = {
    screener: { feature: 'screener', tier: 'pro', label: 'Screener' },
    comparison: { feature: 'comparateur', tier: 'investor', label: 'Comparateur' },
    'dividend-screener': { feature: 'screener', tier: 'pro', label: 'Screener Dividendes' },
    opportunites: { feature: 'opportunites_full', tier: 'pro', label: "Écran d'opportunités" }
  };

  var TIER_LABEL = { investor: 'Investor', pro: 'Professional', elite: 'Elite' };
  var UPGRADE_HREF = { investor: '/register.html?plan=investor&period=monthly', pro: '/register.html?plan=pro&period=monthly' };

  function esc(v) { var e = d.createElement('div'); e.textContent = v == null ? '' : String(v); return e.innerHTML; }
  function locked(id, entry) { return !!entry && typeof w.TC === 'object' && !w.TC.can(entry.feature); }

  function injectCss() {
    if (d.getElementById('tc-tiers-css')) return;
    var s = d.createElement('style');
    s.id = 'tc-tiers-css';
    s.textContent =
      '.tc-navitem.tc-locked,.tc-rail-link.tc-locked{opacity:.62}' +
      '.tc-lock-badge{margin-left:5px;font-size:9px;vertical-align:1px;opacity:.85}' +
      '.tc-paywall{max-width:560px;margin:48px auto;padding:34px 30px;border:1px solid rgba(184,150,78,.22);border-radius:14px;background:#161210;text-align:center;font-family:"DM Sans",sans-serif;color:#f5f0e8}' +
      '.tc-paywall .tc-pw-lock{font-size:26px;margin-bottom:10px}' +
      '.tc-paywall h2{font-family:"Playfair Display",serif;font-size:22px;margin:0 0 10px;color:#f5f0e8}' +
      '.tc-paywall p{font-size:13px;line-height:1.6;color:rgba(245,240,232,.66);margin:0 0 18px}' +
      '.tc-paywall .tc-pw-tier{display:inline-block;margin-bottom:16px;padding:4px 11px;border-radius:999px;background:rgba(184,150,78,.14);color:#d4af6a;font:600 10px "DM Mono",monospace;letter-spacing:.08em;text-transform:uppercase}' +
      '.tc-paywall a.tc-pw-btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 22px;border-radius:8px;background:#b8964e;color:#14100a;font:700 12px "DM Sans",sans-serif;letter-spacing:.03em;text-decoration:none}' +
      '.tc-paywall a.tc-pw-btn:hover{opacity:.9}' +
      '.tc-preview-wrap{position:relative;max-height:calc(100vh - 260px);min-height:420px;overflow:hidden}' +
      '.tc-preview-wrap:after{content:"";position:absolute;left:0;right:0;bottom:0;height:160px;background:linear-gradient(180deg,transparent,var(--tc-bg,#0e0c09) 88%);pointer-events:none}' +
      '.tc-preview-bar{position:sticky;left:0;right:0;bottom:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:-8px;padding:14px 18px;border:1px solid rgba(184,150,78,.28);border-radius:12px;background:rgba(22,18,15,.96);backdrop-filter:blur(6px);font-family:"DM Sans",sans-serif}' +
      '.tc-preview-bar strong{color:#f5f0e8;font-size:13px}' +
      '.tc-preview-bar span{display:block;color:rgba(245,240,232,.6);font-size:11px;margin-top:2px}' +
      '.tc-preview-bar a{flex:0 0 auto;display:inline-flex;align-items:center;padding:10px 18px;border-radius:8px;background:#b8964e;color:#14100a;font:700 11px "DM Sans",sans-serif;text-decoration:none;white-space:nowrap}';
    d.head.appendChild(s);
  }

  function paywallHtml(entry) {
    var tier = TIER_LABEL[entry.tier] || entry.tier;
    return '<div class="tc-paywall">' +
      '<div class="tc-pw-lock">🔒</div>' +
      '<div class="tc-pw-tier">Formule ' + esc(tier) + '</div>' +
      '<h2>' + esc(entry.label) + '</h2>' +
      '<p>' + esc(entry.desc || ('Ce module fait partie de la formule ' + tier + '.')) + '</p>' +
      '<a class="tc-pw-btn" href="' + esc(UPGRADE_HREF[entry.tier] || '/index.html#offres') + '">Passer à ' + esc(tier) + '</a>' +
      '</div>';
  }

  function previewBarHtml(entry) {
    var tier = TIER_LABEL[entry.tier] || entry.tier;
    return '<div class="tc-preview-bar"><div><strong>Aperçu limité</strong>' +
      '<span>La vue complète de ' + esc(entry.label) + ' fait partie de la formule ' + esc(tier) + '.</span></div>' +
      '<a href="' + esc(UPGRADE_HREF[entry.tier] || '/index.html#offres') + '">Passer à ' + esc(tier) + '</a></div>';
  }

  function applyHardLock(id, entry) {
    var view = d.getElementById('view-' + id);
    if (!view) return;
    view.dataset.tcPaywall = '1';
    view.innerHTML = paywallHtml(entry);
  }

  function applyPreview(id, entry) {
    var view = d.getElementById('view-' + id);
    if (!view || view.dataset.tcPreviewed === '1') return;
    view.dataset.tcPreviewed = '1';
    var wrap = d.createElement('div');
    wrap.className = 'tc-preview-wrap';
    while (view.firstChild) wrap.appendChild(view.firstChild);
    view.appendChild(wrap);
    var bar = d.createElement('div');
    bar.innerHTML = previewBarHtml(entry);
    view.appendChild(bar.firstChild);
  }

  // Un rendu de vue peut être asynchrone (données réseau) : on réaffirme le
  // mur / l'aperçu pendant une courte fenêtre plutôt qu'une seule fois.
  function guardView(id) {
    var hard = HARD_LOCK[id], prev = PREVIEW[id];
    if (!hard && !prev) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (hard && locked(id, hard)) applyHardLock(id, hard);
      else if (prev && locked(id, prev)) applyPreview(id, prev);
      if (tries >= 6) clearInterval(timer);
    }, 250);
  }

  function badgeNav() {
    var all = {};
    Object.keys(HARD_LOCK).forEach(function (k) { all[k] = HARD_LOCK[k]; });
    Object.keys(PREVIEW).forEach(function (k) { if (!all[k]) all[k] = PREVIEW[k]; });
    d.querySelectorAll('[data-route]').forEach(function (el) {
      var id = el.getAttribute('data-route');
      var entry = all[id];
      if (!entry) return;
      var isLocked = locked(id, entry);
      el.classList.toggle('tc-locked', isLocked);
      var badge = el.querySelector('.tc-lock-badge');
      if (isLocked && !badge) {
        badge = d.createElement('span');
        badge.className = 'tc-lock-badge';
        badge.textContent = '🔒';
        badge.title = 'Formule ' + (TIER_LABEL[entry.tier] || entry.tier);
        el.appendChild(badge);
      } else if (!isLocked && badge) {
        badge.remove();
      }
    });
  }

  function wrapNav() {
    if (typeof w.nav !== 'function' || w.nav.__tcTiersWrapped) return;
    var orig = w.nav;
    var wrapped = function (id, noHash) {
      var r = orig.apply(this, arguments);
      guardView(id);
      return r;
    };
    wrapped.__tcTiersWrapped = true;
    w.nav = wrapped;
  }

  function boot() {
    injectCss();
    wrapNav();
    badgeNav();
    // La vue déjà active au chargement (deep-link / rechargement) doit aussi
    // être gardée : window.nav() n'est pas rappelé dans ce cas.
    var active = d.querySelector('.view.active');
    if (active && active.id.indexOf('view-') === 0) guardView(active.id.slice(5));
  }

  w.addEventListener('tc:entitlements', function () { boot(); });
  if (typeof w.TC === 'object' && w.TC.tiersReady && w.TC.tiersReady()) boot();

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window, document);
