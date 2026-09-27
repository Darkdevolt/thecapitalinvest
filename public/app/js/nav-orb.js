// THE CAPITAL — Boule d'or : The Capital AI + navigation, accessible depuis
// n'importe quelle page de l'app. Un bouton flottant ouvre un panneau à deux
// onglets : l'assistant d'analyse (qui sait quelle page et quelle valeur sont
// consultées) et la carte du site. Widget autonome : sa propre feuille de
// style et son propre balisage, injectés au chargement.
// API : window.tcOrb.open('ai' | 'nav', question?) ; ?ai=1 dans l'URL ouvre l'IA.
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
      { label: 'Matières premières', desc: 'Palme, caoutchouc, sucre, Brent, cacao : cours en FCFA et impact sur les titres liés.', route: 'matieres-premieres', href: '/app/app.html#matieres-premieres' },
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

  /* Libellé lisible de la vue affichée, transmis à l'IA comme contexte. */
  var VIEW_LABELS = {};
  GUIDE.forEach(function (g) { g.items.forEach(function (it) { if (it.route) VIEW_LABELS[it.route] = it.label; }); });
  VIEW_LABELS.fiche = 'Fiche valeur';
  VIEW_LABELS['financials-detail'] = 'États financiers (détail)';
  VIEW_LABELS['analyse-detail'] = 'Analyse (détail)';

  var CSS = '\n'
    + '#tc-orb-btn{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;z-index:999998;display:grid;place-items:center;padding:0;background:radial-gradient(circle at 32% 28%,#f3d998,#d4af6a 46%,#9a7430 100%);box-shadow:0 6px 18px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.14) inset,0 0 22px rgba(212,175,106,.35);transition:transform .18s ease,box-shadow .18s ease}'
    + '#tc-orb-btn:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 10px 24px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.18) inset,0 0 30px rgba(212,175,106,.5)}'
    + '#tc-orb-btn:active{transform:translateY(0) scale(.97)}'
    + '#tc-orb-btn svg{width:26px;height:26px;position:relative;z-index:1}'
    + '#tc-orb-btn::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(212,175,106,.55);opacity:0;animation:tc-orb-pulse 2.6s ease-out infinite}'
    + '#tc-orb-btn.tc-orb-seen::before{animation:none;display:none}'
    + '#tc-orb-btn.tc-orb-open{transform:scale(.92)}'
    + '@keyframes tc-orb-pulse{0%{transform:scale(.9);opacity:.55}75%{transform:scale(1.5);opacity:0}100%{transform:scale(1.5);opacity:0}}'
    + '#tc-orb-tip{position:fixed;right:88px;bottom:37px;z-index:999998;background:#15120d;color:#f5f0e8;border:1px solid rgba(212,175,106,.35);padding:7px 11px;border-radius:8px;font:500 11px/1.3 \'DM Sans\',Arial,sans-serif;white-space:nowrap;opacity:0;pointer-events:none;transform:translateX(6px);transition:opacity .16s ease,transform .16s ease;box-shadow:0 8px 20px rgba(0,0,0,.35)}'
    + '#tc-orb-btn:hover+#tc-orb-tip{opacity:1;transform:translateX(0)}'
    + '@media(max-width:640px){#tc-orb-btn{right:14px;bottom:14px;width:50px;height:50px}#tc-orb-btn svg{width:22px;height:22px}#tc-orb-tip{display:none}}'
    /* Panneau ancré près de la boule, sans masquer la page : l'IA accompagne la lecture. */
    + '#tc-orb-overlay{position:fixed;inset:0;z-index:999999;background:rgba(6,5,3,.35);display:none}'
    + '#tc-orb-overlay.open{display:block}'
    + '#tc-orb-panel{position:fixed;z-index:1000000;right:22px;bottom:90px;width:min(460px,calc(100vw - 32px));height:min(680px,calc(100vh - 120px));display:flex;flex-direction:column;background:#13110c;border:1px solid rgba(212,175,106,.26);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 40px rgba(212,175,106,.08);overflow:hidden;font-family:\'DM Sans\',Arial,sans-serif;color:#f5f0e8;transform-origin:100% 100%;animation:tc-orb-in .18s ease-out}'
    + '#tc-orb-panel.tc-wide{width:min(760px,calc(100vw - 32px))}'
    + '@keyframes tc-orb-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}'
    + '#tc-orb-head{display:flex;align-items:center;gap:12px;padding:14px 16px 0}'
    + '#tc-orb-head-badge{width:32px;height:32px;border-radius:50%;flex:none;background:radial-gradient(circle at 32% 28%,#f3d998,#d4af6a 46%,#9a7430 100%);display:grid;place-items:center;box-shadow:0 0 14px rgba(212,175,106,.4)}'
    + '#tc-orb-head-badge svg{width:16px;height:16px}'
    + '#tc-orb-title{font:700 15px/1.2 \'Playfair Display\',Georgia,serif;letter-spacing:.01em}'
    + '#tc-orb-title span{color:#d4af6a}'
    + '#tc-orb-sub{margin-top:2px;font-size:10.5px;color:rgba(245,240,232,.55)}'
    + '#tc-orb-close{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid rgba(212,175,106,.18);background:transparent;color:rgba(245,240,232,.65);cursor:pointer;font-size:15px;line-height:1;flex:none}'
    + '#tc-orb-close:hover{color:#d4af6a;border-color:rgba(212,175,106,.4)}'
    + '#tc-orb-tabs{display:flex;gap:4px;padding:12px 16px 0;border-bottom:1px solid rgba(212,175,106,.16)}'
    + '.tc-orb-tab{background:none;border:none;border-bottom:2px solid transparent;color:rgba(245,240,232,.55);font:600 12px \'DM Sans\',Arial,sans-serif;padding:8px 10px 10px;cursor:pointer;letter-spacing:.02em}'
    + '.tc-orb-tab:hover{color:#f5f0e8}'
    + '.tc-orb-tab.active{color:#d4af6a;border-bottom-color:#d4af6a}'
    + '.tc-orb-pane{display:none;flex:1;min-height:0;flex-direction:column}'
    + '.tc-orb-pane.active{display:flex}'
    /* Navigation */
    + '#tc-orb-search-wrap{padding:12px 16px;border-bottom:1px solid rgba(212,175,106,.12)}'
    + '#tc-orb-search{width:100%;box-sizing:border-box;height:40px;border-radius:9px;border:1px solid rgba(212,175,106,.22);background:#1b1712;color:#f5f0e8;padding:0 14px;font:400 13px \'DM Sans\',Arial,sans-serif;outline:none}'
    + '#tc-orb-search:focus{border-color:rgba(212,175,106,.55);box-shadow:0 0 0 3px rgba(212,175,106,.1)}'
    + '#tc-orb-search::placeholder{color:rgba(245,240,232,.4)}'
    + '#tc-orb-body{overflow-y:auto;padding:8px 10px 16px;flex:1;min-height:0}'
    + '#tc-orb-body::-webkit-scrollbar,#tc-ai-log::-webkit-scrollbar{width:8px}#tc-orb-body::-webkit-scrollbar-thumb,#tc-ai-log::-webkit-scrollbar-thumb{background:rgba(212,175,106,.28);border-radius:8px}'
    + '.tc-orb-cat{margin:14px 8px 4px;font:700 9.5px \'DM Sans\',Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d4af6a;display:flex;align-items:center;gap:7px}'
    + '.tc-orb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:0 8px}'
    + '.tc-orb-item{display:flex;flex-direction:column;gap:2px;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.02);cursor:pointer;color:inherit;font-family:inherit}'
    + '.tc-orb-item:hover{background:rgba(212,175,106,.1);border-color:rgba(212,175,106,.3)}'
    + '.tc-orb-item b{font-size:12px;font-weight:600}'
    + '.tc-orb-item span{font-size:10.5px;color:rgba(245,240,232,.55);line-height:1.4}'
    + '#tc-orb-empty{display:none;padding:34px 16px;text-align:center;color:rgba(245,240,232,.5);font-size:12px}'
    + '#tc-orb-foot{padding:11px 16px;border-top:1px solid rgba(212,175,106,.12);display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:10.5px;color:rgba(245,240,232,.45)}'
    + '#tc-orb-foot a{color:#d4af6a;text-decoration:none}#tc-orb-foot a:hover{text-decoration:underline}'
    /* Capital AI */
    + '#tc-ai-ctx{display:flex;align-items:center;gap:8px;padding:9px 16px;font-size:10.5px;color:rgba(245,240,232,.5);border-bottom:1px solid rgba(212,175,106,.1)}'
    + '#tc-ai-ctx b{color:#d6c5a2;font-weight:600}'
    + '#tc-ai-mode{margin-left:auto;display:inline-flex;gap:3px}'
    + '#tc-ai-mode button{background:transparent;color:rgba(245,240,232,.55);border:1px solid rgba(212,175,106,.2);border-radius:6px;padding:3px 7px;font:600 10px \'DM Sans\',Arial,sans-serif;cursor:pointer}'
    + '#tc-ai-mode button.active{color:#17120a;background:#d4af6a;border-color:#d4af6a}'
    + '#tc-ai-clear{background:none;border:none;color:rgba(245,240,232,.45);font:500 10px \'DM Sans\',Arial,sans-serif;cursor:pointer;padding:3px 4px}'
    + '#tc-ai-clear:hover{color:#d4af6a}'
    + '#tc-ai-log{flex:1;min-height:0;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}'
    + '.tc-ai-msg{font-size:13px;line-height:1.6;border-radius:13px;padding:11px 14px;max-width:100%;overflow-wrap:anywhere}'
    + '.tc-ai-user{align-self:flex-end;background:#221c13;border:1px solid rgba(212,175,106,.18);max-width:86%;white-space:pre-wrap}'
    + '.tc-ai-bot{align-self:stretch;background:#18150f;border:1px solid rgba(255,255,255,.05)}'
    + '.tc-ai-bot p{margin:0 0 8px}.tc-ai-bot p:last-child{margin-bottom:0}'
    + '.tc-ai-bot h4{margin:10px 0 6px;font:700 13.5px \'Playfair Display\',Georgia,serif;color:#e8cf95}.tc-ai-bot h4:first-child{margin-top:0}'
    + '.tc-ai-bot ul,.tc-ai-bot ol{margin:4px 0 8px;padding-left:20px}.tc-ai-bot li{margin:4px 0}.tc-ai-bot li::marker{color:#d4af6a}'
    + '.tc-ai-bot strong{color:#f3dca6;font-weight:600}.tc-ai-bot em{color:rgba(245,240,232,.78)}'
    + '.tc-ai-bot code{background:rgba(212,175,106,.1);border-radius:4px;padding:1px 4px;font-size:12px}'
    + '.tc-ai-bot .tc-ai-note{display:block;margin-top:8px;padding-top:8px;border-top:1px solid rgba(212,175,106,.12);font-size:11.5px;color:rgba(245,240,232,.55);font-style:italic}'
    + '.tc-ai-bot .tc-ai-tbl{overflow-x:auto;margin:6px 0 10px}'
    + '.tc-ai-bot table{border-collapse:collapse;font-size:11.5px;width:100%}'
    + '.tc-ai-bot th,.tc-ai-bot td{border-bottom:1px solid rgba(212,175,106,.14);padding:5px 7px;text-align:left;white-space:nowrap}'
    + '.tc-ai-bot th{color:#d4af6a;font-weight:600}'
    + '.tc-ai-err{color:#e8a0a0}'
    + '.tc-ai-typing{display:inline-flex;gap:4px;align-items:center;height:14px}'
    + '.tc-ai-typing i{width:6px;height:6px;border-radius:50%;background:#d4af6a;opacity:.3;animation:tc-ai-dot 1.1s infinite}'
    + '.tc-ai-typing i:nth-child(2){animation-delay:.18s}.tc-ai-typing i:nth-child(3){animation-delay:.36s}'
    + '@keyframes tc-ai-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}'
    + '#tc-ai-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px}'
    + '.tc-ai-chip{border:1px solid rgba(212,175,106,.22);background:#18140f;color:#d8cfbf;padding:6px 10px;border-radius:999px;font:500 11px \'DM Sans\',Arial,sans-serif;cursor:pointer;text-align:left}'
    + '.tc-ai-chip:hover{border-color:#d4af6a;color:#fff}'
    + '#tc-ai-form{display:flex;gap:8px;align-items:flex-end;padding:12px 16px;border-top:1px solid rgba(212,175,106,.14)}'
    + '#tc-ai-input{flex:1;resize:none;overflow-y:hidden;min-height:42px;max-height:130px;box-sizing:border-box;border-radius:11px;border:1px solid rgba(212,175,106,.22);background:#0e0c09;color:#f5f0e8;padding:11px 13px;font:400 13px/1.45 \'DM Sans\',Arial,sans-serif;outline:none}'
    + '#tc-ai-input:focus{border-color:rgba(212,175,106,.55)}'
    + '#tc-ai-input::placeholder{color:rgba(245,240,232,.38)}'
    + '#tc-ai-send{width:42px;height:42px;flex:none;border-radius:11px;border:none;cursor:pointer;background:#d4af6a;color:#17120a;font-size:17px;font-weight:700;display:grid;place-items:center}'
    + '#tc-ai-send:disabled{opacity:.45;cursor:default}'
    + '#tc-ai-disc{padding:0 16px 10px;font-size:9.5px;color:rgba(245,240,232,.38);line-height:1.4}'
    + '@media(max-width:640px){#tc-orb-panel,#tc-orb-panel.tc-wide{right:8px;left:8px;bottom:72px;width:auto;height:calc(100vh - 88px);height:calc(100dvh - 88px)}.tc-orb-grid{grid-template-columns:1fr}}';

  var SPARK_SVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.8l1.9 5.6c.3.9 1 1.6 1.9 1.9l5.6 1.9-5.6 1.9c-.9.3-1.6 1-1.9 1.9L12 21.6l-1.9-5.6c-.3-.9-1-1.6-1.9-1.9L2.6 12.2l5.6-1.9c.9-.3 1.6-1 1.9-1.9L12 2.8z" fill="#0a0804"/><circle cx="18.6" cy="5.2" r="1.3" fill="#0a0804"/></svg>';

  var HISTORY_KEY = 'tc_ai_history';
  var MAX_HISTORY = 30;

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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Markdown réduit (titres, listes, gras, italique, tableaux) rendu en HTML
     après échappement : l'utilisateur ne voit jamais d'astérisques bruts. */
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/\*+/g, '');
  }
  function renderMarkdown(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], list = null, para = [];
    function flushPara() { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } }
    function closeList() { if (list) { out.push('</' + list + '>'); list = null; } }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], t = line.trim(), m;
      if (!t) { flushPara(); closeList(); continue; }
      if (/^\|.*\|$/.test(t) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
        flushPara(); closeList();
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var html = '<div class="tc-ai-tbl"><table><thead><tr>' + cells(t).map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
          html += '<tr>' + cells(lines[i]).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          i++;
        }
        i--;
        out.push(html + '</tbody></table></div>');
        continue;
      }
      if ((m = t.match(/^#{1,6}\s+(.*)$/))) { flushPara(); closeList(); out.push('<h4>' + inline(m[1]) + '</h4>'); continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushPara(); closeList(); continue; }
      if ((m = t.match(/^[-*•]\s+(.*)$/))) {
        flushPara(); if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
        out.push('<li>' + inline(m[1]) + '</li>'); continue;
      }
      if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) {
        flushPara(); if (list !== 'ol') { closeList(); out.push('<ol start="' + m[1] + '">'); list = 'ol'; }
        out.push('<li>' + inline(m[2]) + '</li>'); continue;
      }
      if (/^\*?(rappel|avertissement|note)\b/i.test(t.replace(/^\*+/, '')) || /^\*[^*].*\*$/.test(t)) {
        flushPara(); closeList(); out.push('<span class="tc-ai-note">' + inline(t) + '</span>'); continue;
      }
      if (list && /^\s{2,}/.test(line)) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, '<br>' + inline(t) + '</li>'); continue; }
      closeList(); para.push(t);
    }
    flushPara(); closeList();
    return out.join('');
  }

  function session() {
    try { return JSON.parse(localStorage.getItem('tc_session') || 'null'); } catch (e) { return null; }
  }
  function getMode() { try { return localStorage.getItem('tc_display_mode') === 'pro' ? 'pro' : 'simple'; } catch (e) { return 'simple'; } }
  function loadHistory() { try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]') || []; } catch (e) { return []; } }
  function saveHistory(h) { try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-MAX_HISTORY))); } catch (e) {} }

  /* Page et valeur consultées, pour des réponses ancrées dans ce que l'utilisateur regarde. */
  function pageContext() {
    var active = document.querySelector('.view.active');
    var view = active && active.id ? active.id.replace(/^view-/, '') : '';
    var label = VIEW_LABELS[view] || (document.title || '').split(',')[0] || 'The Capital';
    var ticker = view === 'fiche' ? String(window._lastFicheTicker || '').toUpperCase() : '';
    return { view: view, label: label, ticker: ticker };
  }

  function build() {
    var seen = false;
    try { seen = localStorage.getItem('tc_nav_orb_seen') === '1'; } catch (e) {}
    var tab = 'ai';
    try { tab = localStorage.getItem('tc_orb_tab') === 'nav' ? 'nav' : 'ai'; } catch (e) {}

    var btn = el('button', { id: 'tc-orb-btn', type: 'button', 'aria-label': 'Ouvrir The Capital AI et la navigation' }, SPARK_SVG);
    if (seen) btn.classList.add('tc-orb-seen');
    var tip = el('div', { id: 'tc-orb-tip' }, 'Capital AI · Navigation');

    var overlay = el('div', { id: 'tc-orb-overlay' });
    var panel = el('div', { id: 'tc-orb-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'The Capital AI et navigation' });

    var head = el('div', { id: 'tc-orb-head' });
    head.appendChild(el('div', { id: 'tc-orb-head-badge' }, SPARK_SVG));
    head.appendChild(el('div', null,
      '<div id="tc-orb-title">THE <span>·</span> CAPITAL AI</div>' +
      '<div id="tc-orb-sub">Analyse financière BRVM, sur les données de la base</div>'));
    var close = el('button', { id: 'tc-orb-close', type: 'button', 'aria-label': 'Fermer' }, '×');
    head.appendChild(close);

    var tabs = el('div', { id: 'tc-orb-tabs', role: 'tablist' });
    var tabAi = el('button', { type: 'button', class: 'tc-orb-tab', role: 'tab', 'data-tab': 'ai' }, '✦ Capital AI');
    var tabNav = el('button', { type: 'button', class: 'tc-orb-tab', role: 'tab', 'data-tab': 'nav' }, 'Navigation');
    tabs.appendChild(tabAi); tabs.appendChild(tabNav);

    /* ── Onglet Capital AI ── */
    var paneAi = el('div', { class: 'tc-orb-pane', 'data-pane': 'ai' });
    var ctxBar = el('div', { id: 'tc-ai-ctx' });
    var ctxText = el('span');
    var clearBtn = el('button', { id: 'tc-ai-clear', type: 'button', title: 'Effacer la conversation' }, 'Effacer');
    var modeWrap = el('span', { id: 'tc-ai-mode' },
      '<button type="button" data-mode="simple" title="Réponse synthétique">Simple</button><button type="button" data-mode="pro" title="Analyse détaillée">Pro</button>');
    ctxBar.appendChild(ctxText); ctxBar.appendChild(modeWrap); ctxBar.appendChild(clearBtn);
    var log = el('div', { id: 'tc-ai-log', 'aria-live': 'polite' });
    var chips = el('div', { id: 'tc-ai-chips' });
    var form = el('form', { id: 'tc-ai-form' });
    var input = el('textarea', { id: 'tc-ai-input', rows: '1', maxlength: '2000', placeholder: 'Posez une question sur une valeur, un ratio, le marché…' });
    var sendBtn = el('button', { id: 'tc-ai-send', type: 'submit', 'aria-label': 'Envoyer' }, '↑');
    form.appendChild(input); form.appendChild(sendBtn);
    var disc = el('div', { id: 'tc-ai-disc' }, 'The Capital AI n’est pas un conseiller agréé : la décision d’investissement vous appartient.');
    paneAi.appendChild(ctxBar); paneAi.appendChild(log); paneAi.appendChild(chips); paneAi.appendChild(form); paneAi.appendChild(disc);

    /* ── Onglet Navigation ── */
    var paneNav = el('div', { class: 'tc-orb-pane', 'data-pane': 'nav' });
    var searchWrap = el('div', { id: 'tc-orb-search-wrap' });
    var search = el('input', { id: 'tc-orb-search', type: 'search', autocomplete: 'off', placeholder: 'Rechercher un outil, une page…' });
    searchWrap.appendChild(search);
    var body = el('div', { id: 'tc-orb-body' });
    var empty = el('div', { id: 'tc-orb-empty' }, 'Aucun résultat. Essayez un autre mot-clé, ou posez la question à Capital AI.');
    body.appendChild(empty);
    GUIDE.forEach(function (group) {
      var catEl = el('div', { class: 'tc-orb-cat' }, group.icon + ' ' + group.cat);
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
      '<a href="/app/architecture.html">Carte complète du site →</a>');
    paneNav.appendChild(searchWrap); paneNav.appendChild(body); paneNav.appendChild(foot);

    panel.appendChild(head); panel.appendChild(tabs); panel.appendChild(paneAi); panel.appendChild(paneNav);
    document.body.appendChild(btn);
    document.body.appendChild(tip);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    panel.style.display = 'none';

    var history = loadHistory();
    var busy = false;

    function isOpen() { return panel.style.display !== 'none'; }

    function setTab(t) {
      tab = t === 'nav' ? 'nav' : 'ai';
      try { localStorage.setItem('tc_orb_tab', tab); } catch (e) {}
      [tabAi, tabNav].forEach(function (b) {
        var on = b.getAttribute('data-tab') === tab;
        b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      paneAi.classList.toggle('active', tab === 'ai');
      paneNav.classList.toggle('active', tab === 'nav');
      panel.classList.toggle('tc-wide', tab === 'nav');
      if (!isOpen()) return;
      if (tab === 'ai') { refreshContext(); setTimeout(function () { input.focus(); }, 30); }
      else { search.value = ''; filter(''); setTimeout(function () { search.focus(); }, 30); }
    }

    function setMode(m) {
      m = m === 'pro' ? 'pro' : 'simple';
      try { localStorage.setItem('tc_display_mode', m); } catch (e) {}
      Array.prototype.forEach.call(modeWrap.querySelectorAll('button'), function (b) { b.classList.toggle('active', b.getAttribute('data-mode') === m); });
    }

    function suggestions(ctx) {
      if (ctx.ticker) return [
        'Analyse ' + ctx.ticker + ' : fondamentaux, marges et risques',
        'Le cours de ' + ctx.ticker + ' est-il cher par rapport à ses bénéfices ?',
        'Historique des dividendes de ' + ctx.ticker
      ];
      if (ctx.view === 'portefeuille') return ['Comment diversifier un portefeuille BRVM ?', 'Quels indicateurs suivre pour mes positions ?'];
      if (ctx.view === 'dividend-screener') return ['Quelles valeurs ont le meilleur rendement du dividende ?', 'Un rendement élevé est-il toujours une bonne affaire ?'];
      if (ctx.view === 'obligations') return ['Explique le rendement actuariel d’une obligation', 'Actions ou obligations sur la BRVM : quelles différences ?'];
      return ['Quelles valeurs ont le PER le plus bas ?', 'Quelles valeurs ont le meilleur rendement du dividende ?', 'Explique simplement le ROE et le payout'];
    }

    function refreshContext() {
      var ctx = pageContext();
      ctxText.innerHTML = ctx.ticker ? 'Sur la fiche <b>' + esc(ctx.ticker) + '</b>' : 'Page : <b>' + esc(ctx.label) + '</b>';
      chips.innerHTML = '';
      if (history.length > 2) { chips.style.display = 'none'; return; }
      chips.style.display = '';
      suggestions(ctx).forEach(function (s) {
        var c = el('button', { type: 'button', class: 'tc-ai-chip' }); c.textContent = s;
        c.addEventListener('click', function () { ask(s); });
        chips.appendChild(c);
      });
    }

    function bubble(role, text, extraClass) {
      var d = el('div', { class: 'tc-ai-msg ' + (role === 'user' ? 'tc-ai-user' : 'tc-ai-bot') + (extraClass ? ' ' + extraClass : '') });
      if (role === 'user') d.textContent = text; else d.innerHTML = renderMarkdown(text);
      log.appendChild(d);
      return d;
    }
    function renderLog() {
      log.innerHTML = '';
      if (!history.length) bubble('ai', 'Bonjour. Je suis **The Capital AI**. Posez-moi une question sur une valeur, un ratio ou le marché : je réponds à partir des données de la base The Capital.');
      history.forEach(function (m) { bubble(m.role, m.text, m.error ? 'tc-ai-err' : ''); });
      log.scrollTop = log.scrollHeight;
    }

    function ask(q) {
      q = String(q || '').trim();
      if (!q || busy) return;
      var s = session();
      if (!s || !s.access_token) { location.href = '/login.html?redirect=' + encodeURIComponent(location.pathname + location.hash); return; }
      var ctx = pageContext();
      history.push({ role: 'user', text: q }); saveHistory(history);
      bubble('user', q);
      input.value = ''; autosize();
      chips.style.display = 'none';
      var pending = bubble('ai', ''); pending.innerHTML = '<span class="tc-ai-typing"><i></i><i></i><i></i></span>';
      log.scrollTop = log.scrollHeight;
      busy = true; sendBtn.disabled = true;
      var mode = getMode();
      var context = (mode === 'simple'
        ? 'Réponds de manière synthétique, structurée et orientée décision : 5 points courts maximum, sans perdre les chiffres essentiels.'
        : 'Réponds avec une analyse professionnelle détaillée et structurée. Explique les hypothèses et les risques sans inventer de données.')
        + ' L’utilisateur consulte actuellement : ' + ctx.label + (ctx.ticker ? ' (valeur ' + ctx.ticker + ')' : '') + '.';
      /* Derniers échanges, pour les questions de suivi (« et pour SGBC ? »). */
      var prior = history.slice(-7, -1).map(function (m) { return (m.role === 'user' ? 'Utilisateur : ' : 'The Capital AI : ') + String(m.text).slice(0, 1200); }).join('\n');
      if (prior) context += '\nConversation précédente :\n' + prior;
      fetch('/api/capital-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify({ question: q, context: context, ticker: ctx.ticker || undefined })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.status === 401) throw new Error('Votre session a expiré : reconnectez-vous pour utiliser Capital AI.');
          if (!r.ok) throw new Error((data && (data.error || data.message)) || 'Le moteur IA est temporairement indisponible.');
          return (data.data && data.data.answer) || 'Réponse indisponible.';
        });
      }).then(function (answer) {
        history.push({ role: 'ai', text: answer });
        pending.innerHTML = renderMarkdown(answer);
      }).catch(function (e) {
        var msg = (e && e.message) || 'Impossible de contacter le moteur IA.';
        history.push({ role: 'ai', text: msg, error: true });
        pending.classList.add('tc-ai-err'); pending.textContent = msg;
      }).then(function () {
        saveHistory(history);
        busy = false; sendBtn.disabled = false;
        pending.scrollIntoView({ block: 'start', behavior: 'smooth' });
        if (isOpen()) input.focus();
      });
    }

    function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 130) + 'px'; input.style.overflowY = input.scrollHeight > 130 ? 'auto' : 'hidden'; }

    function goTo(item) {
      var canRoute = item.route && typeof window.nav === 'function' && document.getElementById('view-' + item.route);
      closePanel();
      if (canRoute) { window.nav(item.route); return; }
      window.location.href = item.href;
    }

    function openPanel(which, question) {
      overlay.classList.add('open');
      panel.style.display = 'flex';
      btn.classList.add('tc-orb-seen', 'tc-orb-open');
      try { localStorage.setItem('tc_nav_orb_seen', '1'); } catch (e) {}
      setTab(which || tab);
      if (question) { setTab('ai'); ask(question); }
    }
    function closePanel() {
      overlay.classList.remove('open');
      panel.style.display = 'none';
      btn.classList.remove('tc-orb-open');
    }

    function filter(q) {
      q = q.trim().toLowerCase();
      var anyVisible = false;
      var cats = body.querySelectorAll('.tc-orb-cat');
      Array.prototype.forEach.call(body.querySelectorAll('.tc-orb-grid'), function (grid, i) {
        var visibleInCat = 0;
        Array.prototype.forEach.call(grid.children, function (it) {
          var match = !q || it.getAttribute('data-q').indexOf(q) !== -1;
          it.style.display = match ? '' : 'none';
          if (match) visibleInCat++;
        });
        var show = visibleInCat > 0;
        grid.style.display = show ? '' : 'none';
        if (cats[i]) cats[i].style.display = show ? '' : 'none';
        if (show) anyVisible = true;
      });
      empty.style.display = anyVisible ? 'none' : 'block';
    }

    btn.addEventListener('click', function () { if (isOpen()) closePanel(); else openPanel(); });
    close.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);
    tabAi.addEventListener('click', function () { setTab('ai'); });
    tabNav.addEventListener('click', function () { setTab('nav'); });
    Array.prototype.forEach.call(modeWrap.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });
    clearBtn.addEventListener('click', function () { history = []; saveHistory(history); renderLog(); refreshContext(); input.focus(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
    });
    search.addEventListener('input', function () { filter(search.value); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) closePanel();
    });

    setMode(getMode());
    renderLog();
    setTab(tab);

    window.tcOrb = { open: openPanel, close: closePanel, ask: function (q) { openPanel('ai', q); } };

    /* Ancienne page /capital-ai.html et liens « ?ai=1 » : ouvrir directement l'IA. */
    try {
      var params = new URLSearchParams(location.search);
      if (params.get('ai') === '1') {
        params.delete('ai');
        var qs = params.toString();
        window.history.replaceState(window.history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
        openPanel('ai');
      }
    } catch (e) {}
  }

  function init() {
    injectCss();
    build();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
