// ═══════════════════════════════════════
// API — Supabase Client
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SUPABASE HELPER
// ═══════════════════════════════════════
async function sb(table, params) {
  params = params || {};
  const url = new URL(`${SB_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

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
    throw new Error(`${table}: ${r.status} ${r.statusText} ${text}`);
  }
  return r.json();
}

// ═══════════════════════════════════════
// AUTH & INIT — BLOCAGE STRICT
// ═══════════════════════════════════════
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
  document.body.classList.remove('init-hidden');

  let loginScreen = document.getElementById('loginScreen');
  if (!loginScreen) {
    loginScreen = document.createElement('div');
    loginScreen.id = 'loginScreen';
    loginScreen.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:9999;';
    loginScreen.innerHTML = `
      <div style="text-align:center;max-width:360px;padding:40px;">
        <div style="font-family:var(--serif);font-size:28px;font-weight:700;letter-spacing:3px;color:var(--cream);margin-bottom:8px;">THE <span style="color:var(--gold)">·</span> CAPITAL</div>
        <div style="font-size:12px;color:var(--dim);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:40px;">Intelligence Financière Africaine</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:32px;">
          <div style="font-size:14px;color:var(--muted);margin-bottom:24px;">Connectez-vous pour accéder à la plateforme</div>
          <button onclick="window.location.href='login.html'" style="width:100%;padding:12px;background:var(--gold);border:none;border-radius:8px;color:var(--bg);font-family:var(--sans);font-size:14px;font-weight:600;cursor:pointer;">Se connecter</button>
          <div style="margin-top:16px;font-size:12px;color:var(--dim);">Pas encore de compte ? <a href="register.html" style="color:var(--gold);text-decoration:none;">S'inscrire</a></div>
        </div>
        <div style="margin-top:24px;font-size:11px;color:var(--dim);">© 2026 The Capital — BRVM</div>
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

// ═══════════════════════════════════════════════════════
// LOAD ALL DATA — CORRECTION : Promise.allSettled
// ═══════════════════════════════════════════════════════
async function loadAll() {
  try {
    const results = await Promise.allSettled([
      sb('cours_latest'),
      sb('boc'),
      sb('analyses'),
      sb('financials'),
      sb('entreprises'),
      sb('indices'),
      sb('historique', { order: 'date_seance.asc' })
    ]);

    if (results[0].status === 'fulfilled') allCours = results[0].value || [];
    else { allCours = []; console.warn('cours_latest échoué:', results[0].reason); }

    if (results[1].status === 'fulfilled') allBoc = results[1].value || [];
    else { allBoc = []; console.warn('boc échoué:', results[1].reason); }

    if (results[2].status === 'fulfilled') allAnalyses = results[2].value || [];
    else { allAnalyses = []; console.warn('analyses échoué:', results[2].reason); }

    if (results[3].status === 'fulfilled') allFinancials = results[3].value || [];
    else { allFinancials = []; console.warn('financials échoué:', results[3].reason); }

    if (results[4].status === 'fulfilled') allEntreprises = results[4].value || [];
    else { allEntreprises = []; console.warn('entreprises échoué:', results[4].reason); }

    if (results[5].status === 'fulfilled') allIndices = results[5].value || [];
    else { allIndices = []; console.warn('indices échoué:', results[5].reason); }

    if (results[6].status === 'fulfilled') allCoursHistorique = results[6].value || [];
    else { allCoursHistorique = []; console.warn('historique échoué:', results[6].reason); }

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

    // Dispatch event
    window.dispatchEvent(new Event('dataLoaded'));

    // Render initial view
    if (typeof renderOverview === 'function') renderOverview();
    if (typeof renderTitres === 'function') renderTitres();

  } catch (e) {
    console.error('Erreur chargement données:', e);
    toast('Erreur de chargement des données', 'error');
  }
}
