// THE CAPITAL — Single Application Router
// Une seule navigation pour toutes les vues de l'application.
(function () {
  if (window.__TC_ROUTER_LOADED__) return;
  window.__TC_ROUTER_LOADED__ = true;

  const clockInterval = setInterval(() => {
    const el = document.getElementById('headerTime');
    if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' GMT';
  }, 1000);
  if (window.__TC_CLOCK_INTERVAL__) clearInterval(window.__TC_CLOCK_INTERVAL__);
  window.__TC_CLOCK_INTERVAL__ = clockInterval;

  window.TITLES = {
    overview: "Vue d'ensemble — BRVM", titres: 'Titres BRVM', boc: 'BOC — Bulletin Officiel',
    marche: 'Marché BRVM', analyses: 'Recommandations', 'analyse-fondamentale': 'Analyse Fondamentale',
    'analyse-detail': 'Détail Analyse', 'analyse-technique': 'Analyse Technique', screener: 'Screener BRVM',
    portefeuille: 'Portefeuille', alertes: 'Alertes de Prix', financials: 'États Financiers',
    'financials-detail': 'Détail Financier', fiche: 'Fiche Titre', publications: 'Calendrier des Publications',
    formation: 'Formation BRVM'
  };

  window.BREADCRUMBS = {
    overview: [{label:'Tableau de bord',view:'overview'}],
    titres: [{label:'Tableau de bord',view:'overview'},{label:'Titres BRVM',view:'titres'}],
    fiche: [{label:'Tableau de bord',view:'overview'},{label:'Titres BRVM',view:'titres'},{label:'Fiche',view:'fiche'}],
    boc: [{label:'Tableau de bord',view:'overview'},{label:'BOC',view:'boc'}],
    marche: [{label:'Tableau de bord',view:'overview'},{label:'Marché BRVM',view:'marche'}],
    analyses: [{label:'Tableau de bord',view:'overview'},{label:'Recommandations',view:'analyses'}],
    'analyse-detail': [{label:'Tableau de bord',view:'overview'},{label:'Analyses',view:'analyses'},{label:'Détail',view:'analyse-detail'}],
    'analyse-technique': [{label:'Tableau de bord',view:'overview'},{label:'Analyse Technique',view:'analyse-technique'}],
    'analyse-fondamentale': [{label:'Tableau de bord',view:'overview'},{label:'Analyse Fondamentale',view:'analyse-fondamentale'}],
    screener: [{label:'Tableau de bord',view:'overview'},{label:'Screener',view:'screener'}],
    portefeuille: [{label:'Tableau de bord',view:'overview'},{label:'Portefeuille',view:'portefeuille'}],
    alertes: [{label:'Tableau de bord',view:'overview'},{label:'Alertes',view:'alertes'}],
    financials: [{label:'Tableau de bord',view:'overview'},{label:'États Financiers',view:'financials'}],
    'financials-detail': [{label:'Tableau de bord',view:'overview'},{label:'États Financiers',view:'financials'},{label:'Détail',view:'financials-detail'}],
    publications: [{label:'Tableau de bord',view:'overview'},{label:'Calendrier',view:'publications'}],
    formation: [{label:'Tableau de bord',view:'overview'},{label:'Formation',view:'formation'}]
  };

  const renderMap = {
    overview:'renderOverview', titres:'renderTitres', boc:'renderBOC', marche:'renderMarche', analyses:'renderAnalyses',
    'analyse-detail':'renderAnalyseDetail', 'analyse-technique':'renderAnalyseTechnique',
    'analyse-fondamentale':'renderAnalyseFondamentale', screener:'renderScreener', portefeuille:'renderPortfolio',
    alertes:'renderAlertes', financials:'renderFinancials', 'financials-detail':'renderFinancialsDetail',
    fiche:'renderFiche', publications:'renderPublications', formation:'renderFormation'
  };

  window.nav = function (id, noHash) {
    const view = document.getElementById('view-' + id);
    if (!view) {
      console.warn('[ROUTER] Vue introuvable:', id);
      return false;
    }

    if (typeof destroyAllCharts === 'function') destroyAllCharts();
    document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
    document.querySelectorAll('.nav-dropdown-item, .nav-dropdown-btn').forEach(el => el.classList.remove('active'));

    view.classList.add('active');
    view.style.display = '';
    const navEl = document.getElementById('nav-' + id);
    if (navEl) navEl.classList.add('active');
    const parentMenu = navEl?.closest('.nav-dropdown');
    if (parentMenu) parentMenu.querySelector('.nav-dropdown-btn')?.classList.add('active');

    if (!noHash) setHashForView(id);
    setTimeout(() => {
      const fn = window[renderMap[id]];
      if (typeof fn === 'function') {
        try { fn(); } catch (err) { console.error('[ROUTER] Render ' + id + ':', err); }
      }
    }, 30);

    document.getElementById('globalSearchResults')?.classList.remove('open');
    if (typeof closeDropdowns === 'function') closeDropdowns();
    updateBreadcrumb(id);
    if (typeof closeSidebar === 'function') closeSidebar();
    return true;
  };

  window.toggleDropdown = function (id) {
    const dd = document.getElementById(id), menu = document.getElementById('menu-' + id), btn = dd?.querySelector('.nav-dropdown-btn');
    if (!menu || !btn) return;
    const open = menu.classList.contains('open');
    closeDropdowns();
    if (!open) { menu.classList.add('open'); btn.classList.add('open'); }
  };
  window.closeDropdowns = function () {
    document.querySelectorAll('.nav-dropdown-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.nav-dropdown-btn').forEach(b => b.classList.remove('open'));
  };
  window.toggleSidebar = function () {
    const s=document.getElementById('sidebar'),o=document.getElementById('overlay'); if(!s)return;
    const open=s.classList.contains('open'); s.classList.toggle('open',!open); o?.classList.toggle('open',!open);
  };
  window.closeSidebar = function () { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('overlay')?.classList.remove('open'); };

  window.updateBreadcrumb = function (viewId) {
    const bc=document.getElementById('breadcrumb'); if(!bc)return;
    const items=BREADCRUMBS[viewId]||BREADCRUMBS.overview;
    bc.innerHTML=items.map((item,i)=>i===items.length-1?`<span class="bc-current">${escapeHtml(item.label)}</span>`:`<a href="#${item.view}" onclick="nav('${item.view}');return false;">${escapeHtml(item.label)}</a><span class="bc-sep">›</span>`).join('');
  };

  window.setHashForView = function (id) {
    const hashMap={overview:'',titres:'#titres',boc:'#boc',marche:'#marche',analyses:'#analyses','analyse-detail':'#analyse-detail','analyse-technique':'#analyse-technique','analyse-fondamentale':'#analyse-fondamentale',screener:'#screener',portefeuille:'#portefeuille',alertes:'#alertes',financials:'#financials','financials-detail':'#financials-detail',fiche:'#fiche',publications:'#publications',formation:'#formation'};
    const h=hashMap[id]||''; if(h!==location.hash) history.replaceState(null,'',h||location.pathname); if(TITLES[id]) document.title=TITLES[id]+' — The Capital';
  };

  window.parseHash = function () {
    const h=location.hash;
    if(h.startsWith('#fiche=')){ const t=decodeURIComponent(h.slice(7)); if(typeof openFiche==='function')openFiche(t,'titres',true); return; }
    if(h.startsWith('#analyse=')){ const id=h.slice(9); if(typeof openAnalyseDetail==='function')openAnalyseDetail(+id,true); return; }
    const map={'#titres':'titres','#boc':'boc','#marche':'marche','#analyses':'analyses','#analyse-detail':'analyse-detail','#analyse-technique':'analyse-technique','#analyse-fondamentale':'analyse-fondamentale','#screener':'screener','#portefeuille':'portefeuille','#alertes':'alertes','#financials':'financials','#financials-detail':'financials-detail','#publications':'publications','#formation':'formation'};
    nav(map[h]||'overview',true);
  };

  window.escapeHtml = function (text) { const d=document.createElement('div'); d.textContent=text==null?'':String(text); return d.innerHTML; };
  if(!window.__TC_ROUTER_EVENTS__){
    window.__TC_ROUTER_EVENTS__=true;
    document.addEventListener('click',e=>{if(!e.target.closest('.nav-dropdown')&&!e.target.closest('.topnav-logo'))closeDropdowns();});
  }

  // ═══════════════════════════════════════
  // DASHBOARD UX — interactions non destructives
  // Ne modifie aucune source de données ni le pipeline /api/marche.
  // ═══════════════════════════════════════
  function openTicker(ticker) {
    if (!ticker) return;
    if (typeof window.openFiche === 'function') {
      window.openFiche(String(ticker), 'titres');
    } else {
      location.hash = '#fiche=' + encodeURIComponent(String(ticker));
    }
  }

  function indexLabel(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('30')) return 'BRVM 30';
    if (n.includes('prestige')) return 'BRVM Prestige';
    return 'BRVM Composite';
  }

  function latestIndex(name) {
    const rows = Array.isArray(window.allIndices) ? window.allIndices : [];
    const normalized = String(name || '').trim().toLowerCase();
    const candidates = normalized.includes('30')
      ? ['brvm 30','brvm30','30','brvm_30']
      : normalized.includes('prestige')
        ? ['brvm prestige','brvmprestige','prestige','brvm prestige']
        : ['brvm c','brvm composite','composite','brvm_c','brvm composite'];
    return rows.filter(r => r && r.indice && candidates.includes(String(r.indice).trim().toLowerCase()))
      .sort((a,b) => new Date(b.date_seance || 0) - new Date(a.date_seance || 0))[0] || null;
  }

  function showIndexDetails(indexName) {
    const label = indexLabel(indexName);
    const row = latestIndex(indexName);
    if (!row) {
      if (typeof window.toast === 'function') window.toast('Aucune donnée disponible pour ' + label, 'info');
      return;
    }

    let modal = document.getElementById('tc-index-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tc-index-modal';
      modal.innerHTML = `
        <div class="tc-index-backdrop" data-close-index></div>
        <div class="tc-index-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-index-title">
          <button class="tc-index-close" type="button" data-close-index aria-label="Fermer">×</button>
          <div class="tc-index-kicker">INDICE BRVM</div>
          <h2 id="tc-index-title"></h2>
          <div class="tc-index-value" id="tc-index-value"></div>
          <div class="tc-index-grid">
            <div><span>Variation</span><strong id="tc-index-change"></strong></div>
            <div><span>Séance</span><strong id="tc-index-date"></strong></div>
          </div>
          <button class="tc-index-market" type="button" id="tc-index-market">Voir le marché</button>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => {
        if (e.target.closest('[data-close-index]')) modal.classList.remove('open');
        if (e.target.id === 'tc-index-market') { modal.classList.remove('open'); window.nav('marche'); }
      });
    }

    const value = Number(row.valeur);
    const change = Number(row.variation);
    document.getElementById('tc-index-title').textContent = label;
    document.getElementById('tc-index-value').textContent = Number.isFinite(value) ? value.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
    const changeEl = document.getElementById('tc-index-change');
    changeEl.textContent = Number.isFinite(change) ? `${change > 0 ? '+' : ''}${change.toFixed(2)} %` : '—';
    changeEl.className = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    document.getElementById('tc-index-date').textContent = row.date_seance ? new Date(row.date_seance).toLocaleDateString('fr-FR') : '—';
    modal.classList.add('open');
  }

  function installDashboardInteractions() {
    if (window.__TC_DASHBOARD_UX__) return;
    window.__TC_DASHBOARD_UX__ = true;

    const style = document.createElement('style');
    style.id = 'tc-dashboard-ux-style';
    style.textContent = `
      #idx-composite,#idx-30,#idx-prestige{cursor:pointer}
      .tc-index-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px)}
      .tc-index-dialog{position:fixed;left:50%;top:50%;transform:translate(-50%,-46%);width:min(520px,calc(100vw - 32px));background:var(--card,#171512);border:1px solid rgba(184,150,78,.35);border-radius:18px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:.18s ease}
      #tc-index-modal.open .tc-index-dialog{opacity:1;pointer-events:auto;transform:translate(-50%,-50%)}
      .tc-index-close{position:absolute;right:14px;top:10px;border:0;background:transparent;color:var(--dim,#aaa);font-size:28px;cursor:pointer}
      .tc-index-kicker{font-size:10px;letter-spacing:.16em;color:var(--gold,#b8964e);font-weight:700}
      #tc-index-title{margin:8px 0 12px;color:var(--text,#f5f0e8)}
      .tc-index-value{font-size:34px;font-weight:700;color:var(--text,#f5f0e8);font-variant-numeric:tabular-nums}
      .tc-index-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}
      .tc-index-grid div{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px}
      .tc-index-grid span{display:block;font-size:11px;color:var(--dim,#999);margin-bottom:5px}.tc-index-grid strong{font-size:14px}
      .tc-index-market{width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(184,150,78,.45);background:rgba(184,150,78,.12);color:var(--gold,#b8964e);cursor:pointer;font-weight:700}
      .mover-row{cursor:pointer;transition:background .15s ease,transform .15s ease}.mover-row:hover{background:rgba(184,150,78,.07);transform:translateX(2px)}
      .tc-search-dropdown{position:absolute;z-index:10000;min-width:280px;max-width:min(420px,calc(100vw - 24px));max-height:320px;overflow:auto;background:var(--card,#171512);border:1px solid rgba(184,150,78,.28);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.35);display:none;padding:5px}
      .tc-search-dropdown.open{display:block}.tc-search-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;cursor:pointer}.tc-search-item:hover{background:rgba(184,150,78,.1)}
      .tc-search-item strong{color:var(--gold,#b8964e)}.tc-search-item span{color:var(--dim,#aaa);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    `;
    document.head.appendChild(style);

    document.addEventListener('click', e => {
      const card = e.target.closest('#idx-composite,#idx-30,#idx-prestige');
      if (card) {
        const name = card.id === 'idx-30' ? 'BRVM 30' : card.id === 'idx-prestige' ? 'BRVM Prestige' : 'BRVM Composite';
        showIndexDetails(name);
        return;
      }
      const mover = e.target.closest('.mover-row');
      if (mover) {
        const ticker = mover.querySelector('.ticker')?.textContent?.trim();
        if (ticker) openTicker(ticker);
      }
    });

    setupTickerSearch();
  }

  function setupTickerSearch() {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="password"])'));
    const input = inputs.find(el => {
      const text = `${el.id || ''} ${el.name || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
      return /ticker|symbole|symbol|recherche.*titre|titre.*recherche|search.*ticker|chercher.*titre/.test(text);
    });
    if (!input || input.dataset.tcTickerSearch === '1') return;
    input.dataset.tcTickerSearch = '1';
    input.setAttribute('autocomplete','off');

    const wrapper = input.parentElement;
    if (!wrapper) return;
    if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
    const dropdown = document.createElement('div');
    dropdown.className = 'tc-search-dropdown';
    wrapper.appendChild(dropdown);

    function render(q) {
      const term = String(q || '').trim().toLowerCase();
      if (!term) { dropdown.classList.remove('open'); return; }
      const companies = Array.isArray(window.allEntreprises) ? window.allEntreprises : [];
      const courses = Array.isArray(window.allCours) ? window.allCours : [];
      const map = new Map();
      companies.forEach(e => { if (e?.ticker) map.set(String(e.ticker).toUpperCase(), e); });
      courses.forEach(c => { if (c?.ticker && !map.has(String(c.ticker).toUpperCase())) map.set(String(c.ticker).toUpperCase(), c); });
      const matches = Array.from(map.entries()).filter(([ticker,e]) => {
        const name = String(e?.nom || e?.name || e?.raison_sociale || '').toLowerCase();
        return ticker.toLowerCase().includes(term) || name.includes(term);
      }).slice(0, 8);
      if (!matches.length) { dropdown.innerHTML = '<div class="tc-search-item"><span>Aucun titre trouvé</span></div>'; dropdown.classList.add('open'); return; }
      dropdown.innerHTML = matches.map(([ticker,e]) => `<div class="tc-search-item" data-tc-ticker="${escapeHtml(ticker)}"><strong>${escapeHtml(ticker)}</strong><span>${escapeHtml(e?.nom || e?.name || e?.raison_sociale || '')}</span></div>`).join('');
      dropdown.classList.add('open');
    }
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('focus', () => { if (input.value.trim()) render(input.value); });
    dropdown.addEventListener('mousedown', e => {
      const item = e.target.closest('[data-tc-ticker]');
      if (!item) return;
      e.preventDefault();
      const ticker = item.dataset.tcTicker;
      input.value = ticker;
      dropdown.classList.remove('open');
      openTicker(ticker);
    });
    document.addEventListener('click', e => {
      if (!wrapper.contains(e.target)) dropdown.classList.remove('open');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDashboardInteractions, {once:true});
  } else {
    installDashboardInteractions();
  }
  window.addEventListener('hashchange', () => setTimeout(setupTickerSearch, 80));

  console.log('[ROUTER] Single-app router chargé');
})();
