// ═══════════════════════════════════════
// MAIN — Entry Point (CORRIGÉ)
// ═══════════════════════════════════════

// Auth & Init — BLOCAGE STRICT
(async function initApp() {
  const raw = localStorage.getItem(SK);

  if (!raw) {
    showLoginScreen();
    return;
  }

  let session;
  try {
    session = JSON.parse(raw);
    if (!session?.access_token) throw new Error('no token');
  } catch (e) {
    localStorage.removeItem(SK);
    showLoginScreen();
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SB_KEY
      }
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('session invalide');

    const user = await res.json();

    document.body.classList.remove('init-hidden');

    const avatar = (user.email || 'U')[0].toUpperCase();
    const name = user.email || 'Utilisateur';

    const sbAvatar = document.getElementById('sidebarAvatar');
    const sbName = document.getElementById('sidebarName');
    const sbRole = document.getElementById('sidebarRole');
    if (sbAvatar) sbAvatar.textContent = avatar;
    if (sbName) sbName.textContent = name;
    if (sbRole) sbRole.textContent = 'BRVM';

    const hdAvatar = document.getElementById('headerAvatar');
    const hdName = document.getElementById('headerName');
    if (hdAvatar) hdAvatar.textContent = avatar;
    if (hdName) hdName.textContent = name;
    // Plan utilisateur depuis Supabase (fallback 'free' si non défini)
    window._userPlan = user.plan || user.role || 'free';

    if (window._userPlan === 'pro' || window._userPlan === 'admin') {
      const adminLink = document.getElementById('adminLink');
      if (adminLink) adminLink.style.display = 'block';
    }

    loadAll();

  } catch (e) {
    console.warn('Auth echouee :', e);
    localStorage.removeItem(SK);
    showLoginScreen();
  }
})();

function showLoginScreen() {
  const sidebar = document.getElementById('sidebar');
  const header = document.querySelector('.header');
  const breadcrumb = document.getElementById('breadcrumb');

  document.body.classList.remove('init-hidden');

  let loginScreen = document.getElementById('loginScreen');
  if (!loginScreen) {
    loginScreen = document.createElement('div');
    loginScreen.id = 'loginScreen';
    loginScreen.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:9999;';
    loginScreen.innerHTML = `
      <div style="text-align:center;max-width:360px;padding:40px;">
        <div style="font-family:var(--serif);font-size:28px;font-weight:700;letter-spacing:3px;color:var(--cream);margin-bottom:8px;">THE <span style="color:var(--gold)">&#183;</span> CAPITAL</div>
        <div style="font-size:12px;color:var(--dim);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px;">Intelligence Financiere Africaine</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:32px;">
          <div style="font-size:14px;color:var(--muted);margin-bottom:24px;">Connectez-vous pour acceder a la plateforme</div>
          <button onclick="window.location.href='login.html'" style="width:100%;padding:12px;background:var(--gold);border:none;border-radius:8px;color:var(--bg);font-family:var(--sans);font-size:14px;font-weight:600;cursor:pointer;">Se connecter</button>
          <div style="margin-top:16px;font-size:12px;color:var(--dim);">Pas encore de compte ? <a href="register.html" style="color:var(--gold);text-decoration:none;">S'inscrire</a></div>
        </div>
        <div style="margin-top:24px;font-size:11px;color:var(--dim);">&#169; 2026 The Capital &#8212; BRVM</div>
      </div>
    `;
    document.body.appendChild(loginScreen);
  }
  loginScreen.style.display = 'flex';
}

function doLogout() {
  localStorage.removeItem(SK);
  window.location.reload();
}

// ═══════════════════════════════════════
// LOAD — 100% SUPABASE (CORRIGÉ)
// ═══════════════════════════════════════
async function loadAll() {
  try {
    // CORRECTION: Vérifier que sb() existe avant de l'appeler
    if (typeof sb !== 'function') {
      console.error('Fonction sb() non definie. Verifiez que api.js est charge avant main.js');
      toast('Erreur: API non initialisee', 'error');
      return;
    }

    const results = await Promise.allSettled([
      sb('cours_latest', {}),
      sb('boc', { order: 'date_seance.desc', limit: 200 }),
      sb('analyses', { order: 'date_analyse.desc', limit: 100 }),
      sb('financials', { order: 'annee.desc,periode.desc', limit: 500 }),
      sb('entreprises', { limit: 500 }),
      sb('indices', { order: 'date_seance.desc', limit: 90 }),
      sb('historique', { order: 'date_seance.asc' }),
    ]);

    if (results[0].status === 'fulfilled') allCours = results[0].value || [];
    else toast('Erreur chargement cours: ' + results[0].reason, 'error');

    if (results[1].status === 'fulfilled') allBoc = results[1].value || [];
    else toast('Erreur chargement BOC: ' + results[1].reason, 'error');

    if (results[2].status === 'fulfilled') allAnalyses = results[2].value || [];
    else toast('Erreur chargement analyses: ' + results[2].reason, 'error');

    if (results[3].status === 'fulfilled') allFinancials = results[3].value || [];
    else toast('Erreur chargement financials: ' + results[3].reason, 'error');

    if (results[4].status === 'fulfilled') allEntreprises = results[4].value || [];
    else toast('Erreur chargement entreprises: ' + results[4].reason, 'error');

    if (results[5].status === 'fulfilled') allIndices = results[5].value || [];
    else { 
      allIndices = [];
      toast('Erreur chargement indices: ' + results[5].reason, 'warn');
    }

    if (results[6].status === 'fulfilled') allCoursHistorique = results[6].value || [];
    else {
      allCoursHistorique = [];
      console.warn('Erreur chargement historique:', results[6].reason);
    }

    entMap = Object.fromEntries(allEntreprises.map(e => [e.ticker, e]));

    // Exposer globalement pour toutes les vues
    window.allCours = allCours;
    window.allBoc = allBoc;
    window.allAnalyses = allAnalyses;
    window.allFinancials = allFinancials;
    window.allEntreprises = allEntreprises;
    window.allIndices = allIndices;
    window.allCoursHistorique = allCoursHistorique;
    window.entMap = entMap;

    // Dispatch dataLoaded AVANT les renders
    window.dispatchEvent(new Event('dataLoaded'));

    // CORRECTION: Appeler les renders avec verification
    if (typeof renderOverview === 'function') renderOverview();
    else console.warn('renderOverview non definie');

    if (typeof renderTitres === 'function') renderTitres();
    else console.warn('renderTitres non definie');

    if (typeof renderBoc === 'function') renderBoc();
    else console.warn('renderBoc non definie');

    if (typeof renderAnalyses === 'function') renderAnalyses();
    else console.warn('renderAnalyses non definie');

    if (typeof renderFinancials === 'function') renderFinancials();
    else console.warn('renderFinancials non definie');

    if (typeof renderPublications === 'function') renderPublications();
    else console.warn('renderPublications non definie');

    populateTickerSelects();

    if (typeof atInit === 'function') atInit();
    else console.warn('atInit non definie');

    if (typeof initGlobalSearch === 'function') initGlobalSearch();
    else console.warn('initGlobalSearch non definie');

    if (typeof runScreener === 'function') runScreener();
    else console.warn('runScreener non definie');

    if (typeof initPortefeuille === 'function') {
      initPortefeuille();
    }

    try { 
      if (typeof renderAlerts === "function") renderAlerts(); 
    } catch(e) { 
      console.warn("renderAlerts error:", e); 
    }

    // CORRECTION: parseHash est maintenant dans router.js, appele ici
    if (typeof parseHash === 'function') {
      parseHash();
    } else {
      console.warn('parseHash non definie');
    }
  } catch(e) {
    toast('Erreur globale de chargement: ' + e.message, 'error');
  }
}

function populateTickerSelects() {
  const byTicker = {};
  if (Array.isArray(allCours)) {
    allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = c; });
  }
  const tickers = Object.keys(byTicker).sort();
  const opts = tickers.map(t => `<option value="${t}">${t}</option>`).join('');

  const pf = document.getElementById('pfTicker');
  if (pf) pf.innerHTML = '<option value="">Ticker...</option>' + opts;

  const al = document.getElementById('alertTicker');
  if (al) al.innerHTML = '<option value="">Ticker...</option>' + opts;

  const fu = document.getElementById('fundTickerSelect');
  if (fu) fu.innerHTML = '<option value="">Choisir un ticker...</option>' + opts;
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
window.addEventListener('hashchange', function() {
  if (typeof parseHash === 'function') parseHash();
});
