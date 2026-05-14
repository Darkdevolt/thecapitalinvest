import { CONFIG } from './config.js';
import { setToken, ensureAuth } from './api.js';
import {
    toast, showLoadingScreen, hideLoadingScreen, showFatalError,
    closeModal, openModal, clearForm, v, set, pf, pi, fmt, fmtPct, clrPct, fmtDate,
    toggleRow, toggleAll, resetSelection, updateBulkBar, isIndice, doubleConfirm
} from './utils.js';

// ── Imports des panels (lazy + initial) ──
import { loadDashboard } from './dashboard.js';

let activeTab = 'dashboard';
let ME = null;

// ── Rendre fonctions disponibles pour les onclick inline ──
window.switchTab = switchTab;
window.switchSubTab = switchSubTab;
window.doLogout = doLogout;
window.closeModal = closeModal;
window.openModal = openModal;
window.clearForm = clearForm;
window.toggleRow = toggleRow;
window.toggleAll = toggleAll;
window.resetSelection = resetSelection;
window.doubleConfirm = doubleConfirm;

// ── Navigation ──
const tabLoaders = {
    dashboard:    () => import('./dashboard.js').then(m => m.loadDashboard()),
    cours:        () => import('./cours.js').then(m => m.loadCours()),
    historique:   () => {},
    entreprises:  () => import('./entreprises.js').then(m => m.loadEntreprises()),
    financials:   () => import('./financials.js').then(m => m.loadFinancials()),
    dividendes:   () => import('./dividendes.js').then(m => m.loadDividendes()),
    analyses:     () => import('./analyses.js').then(m => m.loadAnalyses()),
    utilisateurs: () => import('./utilisateurs.js').then(m => m.loadUsers()),
    scraper:      () => {},
    import:       () => {},
    diagnostic:   () => {},
    indices:      () => import('./indices.js').then(m => m.loadIndices())
};

export function switchTab(name, el) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    const panel = document.getElementById('panel-' + name);
    if (panel) panel.classList.add('active');
    if (el && el.classList) el.classList.add('active');
    if (name !== activeTab) {
        activeTab = name;
        const loader = tabLoaders[name];
        if (typeof loader === 'function') loader();
    }
}

export function switchSubTab(prefix, panelName, el) {
    if (!el) return;
    const container = el.closest('.tab-panel');
    if (!container) return;
    container.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    ['ligne','bulk','view','list','add'].forEach(p => {
        const e2 = document.getElementById(prefix + '-panel-' + p);
        if (e2) e2.style.display = 'none';
    });
    const target = document.getElementById(prefix + '-panel-' + panelName);
    if (target) target.style.display = '';
}

// ── Auth & Init ──
async function init() {
    showLoadingScreen('Vérification de la session...');

    const s = localStorage.getItem(CONFIG.SK);
    if (!s) { location.href = 'login.html'; return; }

    let sess;
    try { sess = JSON.parse(s); } catch(e) { location.href = 'login.html'; return; }

    const session = sess?.data?.session ?? sess?.session ?? sess;
    const userObj = sess?.data?.user ?? sess?.user ?? null;
    const token = session?.access_token ?? sess?.access_token ?? '';

    if (!token) { location.href = 'login.html'; return; }
    setToken(token);

    const userId    = userObj?.id ?? sess?.id ?? null;
    const userEmail = userObj?.email ?? sess?.email ?? '';

    if (!userId) {
        hideLoadingScreen();
        showFatalError('Session invalide', 'Identifiant utilisateur introuvable. Essayez de vous reconnecter.');
        return;
    }

    showLoadingScreen('Vérification des droits admin...');

    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);

        const r = await fetch(
            CONFIG.SB_URL + '/rest/v1/users?select=id,is_admin,email,nom&id=eq.' + encodeURIComponent(userId),
            { headers: { apikey: CONFIG.SB_ANON, Authorization: 'Bearer ' + token }, signal: ctrl.signal }
        );
        clearTimeout(t);

        if (!r.ok) {
            const errText = await r.text();
            throw new Error('HTTP ' + r.status + ' — ' + errText.substring(0, 200));
        }

        let rows = await r.json().catch(() => []);

        if ((!rows || !rows.length) && userEmail) {
            const r2 = await fetch(
                CONFIG.SB_URL + '/rest/v1/users?select=id,is_admin,email,nom&email=eq.' + encodeURIComponent(userEmail),
                { headers: { apikey: CONFIG.SB_ANON, Authorization: 'Bearer ' + token } }
            );
            rows = await r2.json().catch(() => []);
        }

        const user = rows?.[0] ?? null;
        if (!user) {
            hideLoadingScreen();
            showFatalError('Compte introuvable', 'Votre compte n\'existe pas dans la base ou les droits RLS bloquent l\'accès.');
            return;
        }
        if (!user.is_admin) {
            hideLoadingScreen();
            showFatalError('Accès refusé', 'Vous n\'avez pas les droits administrateur.');
            setTimeout(() => location.href = 'app.html', 2000);
            return;
        }

        ME = { is_admin: true, email: user.email || userEmail };
        const adminUserEl = document.getElementById('admin-user');
        if (adminUserEl) adminUserEl.textContent = ME.email;

        hideLoadingScreen();
        await loadDashboard();

    } catch(e) {
        console.error('Init error:', e);
        hideLoadingScreen();
        if (e.name === 'AbortError') {
            showFatalError(
                'Délai dépassé',
                'La connexion a pris trop de temps.<br><br>• Token expiré<br>• RLS Supabase restrictif<br>• Problème réseau'
            );
        } else {
            showFatalError('Erreur de connexion', e.message || 'Erreur inconnue');
        }
    }
}

function doLogout() {
    localStorage.removeItem(CONFIG.SK);
    location.href = 'login.html';
}

// ── Démarrage ──
init().catch(err => {
    console.error('Fatal init error:', err);
    hideLoadingScreen();
    showFatalError('Erreur fatale', err.message || 'Erreur inconnue');
});
