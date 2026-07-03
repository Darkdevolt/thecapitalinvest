// ═══════════════════════════════════════
// API — Supabase Client (CORRIGÉ)
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SUPABASE HELPER (CORRIGÉ)
// ═══════════════════════════════════════
async function sb(table, params) {
  params = params || {};

  // CORRECTION: Vérifier que SB_URL et SB_KEY existent
  if (typeof SB_URL === 'undefined' || !SB_URL) {
    console.error('SB_URL non défini. Vérifiez que utils.js est chargé avant api.js');
    throw new Error('SB_URL non défini');
  }
  if (typeof SB_KEY === 'undefined' || !SB_KEY) {
    console.error('SB_KEY non défini. Vérifiez que utils.js est chargé avant api.js');
    throw new Error('SB_KEY non défini');
  }

  const url = new URL(`${SB_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  try {
    const r = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'apikey': SB_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error(`Erreur API ${table}: ${r.status} ${r.statusText}`, text);
      throw new Error(`${table}: ${r.status} ${r.statusText} ${text}`);
    }
    return r.json();
  } catch (e) {
    console.error(`Erreur fetch ${table}:`, e.message);
    throw e;
  }
}

// ═══════════════════════════════════════
// AUTH & INIT — BLOCAGE STRICT (CORRIGÉ)
// ═══════════════════════════════════════
(async function initApp() {
  // CORRECTION: Vérifier que SK existe
  if (typeof SK === 'undefined') {
    console.error('SK non défini. Vérifiez que utils.js est chargé avant api.js');
    showLoginScreen();
    return;
  }

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

    // CORRECTION: Plan utilisateur depuis Supabase (fallback 'free' si non défini)
    window._userPlan = user.plan || user.role || 'free';

    if (window._userPlan === 'pro' || window._userPlan === 'admin') {
      const adminLink = document.getElementById('adminLink');
      if (adminLink) adminLink.style.display = 'block';
    }

    loadAll();

  } catch (e) {
    console.warn('Auth échouée :', e);
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
        <div style="font-size:12px;color:var(--dim);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px;">Intelligence Financière Africaine</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:32px;">
          <div style="font-size:14px;color:var(--muted);margin-bottom:24px;">Connectez-vous pour accéder à la plateforme</div>
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
// LOAD ALL DATA — Ajout allCoursHistorique
// ═══════════════════════════════════════
async function loadAll() {
  try {
    // CORRECTION: Utiliser Promise.allSettled pour éviter qu'un échec bloque tout
    const results = await Promise.allSettled([
      sb('cours_latest', {}),
      sb('boc', { order: 'date_seance.desc', limit: 200 }),
      sb('analyses', { order: 'date_analyse.desc', limit: 100 }),
      sb('financials', { order: 'annee.desc,periode.desc', limit: 500 }),
      sb('entreprises', { limit: 500 }),
      sb('indices', { order: 'date_seance.desc', limit: 90 }),
      sb('historique', { order: 'date_seance.asc' })
    ]);

    if (results[0].status === 'fulfilled') allCours = results[0].value || [];
    else { console.error('cours échoué:', results[0].reason); allCours = []; }

    if (results[1].status === 'fulfilled') allBoc = results[1].value || [];
    else { console.error('boc échoué:', results[1].reason); allBoc = []; }

    if (results[2].status === 'fulfilled') allAnalyses = results[2].value || [];
    else { console.error('analyses échoué:', results[2].reason); allAnalyses = []; }

    if (results[3].status === 'fulfilled') allFinancials = results[3].value || [];
    else { console.error('financials échoué:', results[3].reason); allFinancials = []; }

    if (results[4].status === 'fulfilled') allEntreprises = results[4].value || [];
    else { console.error('entreprises échoué:', results[4].reason); allEntreprises = []; }

    if (results[5].status === 'fulfilled') allIndices = results[5].value || [];
    else { console.warn('indices échoué:', results[5].reason); allIndices = []; }

    if (results[6].status === 'fulfilled') allCoursHistorique = results[6].value || [];
    else { console.warn('historique échoué:', results[6].reason); allCoursHistorique = []; }

    // Exposer globalement
    window.allCours = allCours;
    window.allBoc = allBoc;
    window.allAnalyses = allAnalyses;
    window.allFinancials = allFinancials;
    window.allEntreprises = allEntreprises;
    window.allIndices = allIndices;
    window.allCoursHistorique = allCoursHistorique;

    // Build entMap
    entMap = {};
    allEntreprises.forEach(e => { if (e.ticker) entMap[e.ticker] = e; });
    window.entMap = entMap;

    // Dispatch event pour notifier que les données sont prêtes
    window.dispatchEvent(new Event('dataLoaded'));

    // CORRECTION: Vérifier que les fonctions existent avant de les appeler
    if (typeof renderOverview === 'function') renderOverview();
    else console.warn('renderOverview non définie');

    if (typeof renderTitres === 'function') renderTitres();
    else console.warn('renderTitres non définie');

    if (typeof renderBoc === 'function') renderBoc();
    else console.warn('renderBoc non définie');

    if (typeof renderAnalyses === 'function') renderAnalyses();
    else console.warn('renderAnalyses non définie');

    if (typeof renderFinancials === 'function') renderFinancials();
    else console.warn('renderFinancials non définie');

    if (typeof renderPublications === 'function') renderPublications();
    else console.warn('renderPublications non définie');

    if (typeof populateTickerSelects === 'function') populateTickerSelects();

    if (typeof atInit === 'function') atInit();

    if (typeof initGlobalSearch === 'function') initGlobalSearch();

    if (typeof runScreener === 'function') runScreener();

    if (typeof initPortefeuille === 'function') initPortefeuille();

    try {
      if (typeof renderAlerts === 'function') renderAlerts();
    } catch (e) {
      console.warn('renderAlerts error:', e);
    }

    if (typeof parseHash === 'function') parseHash();
    else console.warn('parseHash non définie');

  } catch (e) {
    console.error('Erreur chargement données:', e);
    toast('Erreur de chargement des données', 'error');
  }
}
