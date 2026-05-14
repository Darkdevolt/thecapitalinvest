'use strict';

let TK = '', ME = null;
let coursData = [], finData = [], divData = [], entData = [], usrData = [], histData = [], idxData = [], anData = [];
let diagData = null;
let activeTab = 'dashboard';

/* ── INIT ───────────────────────────────────────────────────── */
async function init() {
    showLoadingScreen('Vérification de la session...');

    const s = localStorage.getItem(SK);
    if (!s) { location.href = 'login.html'; return; }

    let sess;
    try { sess = JSON.parse(s); } catch(e) { location.href = 'login.html'; return; }

    const session = sess && sess.data && sess.data.session ? sess.data.session : (sess && sess.session ? sess.session : sess);
    const userObj = sess && sess.data && sess.data.user ? sess.data.user : (sess && sess.user ? sess.user : null);

    TK = session && session.access_token ? session.access_token : (sess && sess.access_token ? sess.access_token : '');
    if (!TK) { location.href = 'login.html'; return; }

    const userId    = userObj && userObj.id ? userObj.id : (sess && sess.id ? sess.id : null);
    const userEmail = userObj && userObj.email ? userObj.email : (sess && sess.email ? sess.email : '');

    if (!userId) {
        hideLoadingScreen();
        showFatalError('Session invalide', 'Identifiant utilisateur introuvable dans la session. Essayez de vous reconnecter.');
        return;
    }

    showLoadingScreen('Vérification des droits admin...');

    try {
        const ctrl = new AbortController();
        const t = setTimeout(function() { ctrl.abort(); }, 10000);

        const r = await fetch(
            SB_REST + '/users?select=id,is_admin,email,nom&id=eq.' + encodeURIComponent(userId),
            { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + TK }, signal: ctrl.signal }
        );
        clearTimeout(t);

        if (!r.ok) {
            const errText = await r.text();
            throw new Error('HTTP ' + r.status + ' — ' + errText.substring(0, 200));
        }

        let rows = await r.json().catch(function() { return []; });

        if (!rows || !rows.length && userEmail) {
            const r2 = await fetch(
                SB_REST + '/users?select=id,is_admin,email,nom&email=eq.' + encodeURIComponent(userEmail),
                { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + TK } }
            );
            rows = await r2.json().catch(function() { return []; });
        }

        const user = rows && rows[0] ? rows[0] : null;
        if (!user) {
            hideLoadingScreen();
            showFatalError('Compte introuvable', 'Votre compte n\'existe pas dans la base ou les droits RLS bloquent l\'accès.');
            return;
        }
        if (!user.is_admin) {
            hideLoadingScreen();
            showFatalError('Accès refusé', 'Vous n\'avez pas les droits administrateur.');
            setTimeout(function() { location.href = 'app.html'; }, 2000);
            return;
        }

        ME = { is_admin: true, email: user.email || userEmail };
        const adminUserEl = document.getElementById('admin-user');
        if (adminUserEl) adminUserEl.textContent = ME.email;

        hideLoadingScreen();
        if (typeof loadDashboard === 'function') await loadDashboard();
        else console.warn('[main] loadDashboard non disponible');

    } catch(e) {
        console.error('Init error:', e);
        hideLoadingScreen();
        if (e.name === 'AbortError') {
            showFatalError(
                'Délai dépassé',
                'La connexion a pris trop de temps.<br><br>' +
                '• Token expiré<br>• RLS Supabase restrictif<br>• Problème réseau'
            );
        } else {
            showFatalError('Erreur de connexion', e.message || 'Erreur inconnue');
        }
    }
}

function doLogout() { localStorage.removeItem(SK); location.href = 'login.html'; }

/* ── NAVIGATION ───────────────────────────────────────────────── */
const tabLoaders = {
    dashboard:    function(){ if(typeof loadDashboard === 'function') loadDashboard(); },
    cours:        function(){ if(typeof loadCours === 'function') loadCours(); },
    historique:   function(){ if(typeof loadHistoriqueTicker === 'function') loadHistoriqueTicker(); },
    entreprises:  function(){ if(typeof loadEntreprises === 'function') loadEntreprises(); },
    financials:   function(){ if(typeof loadFinancials === 'function') loadFinancials(); },
    dividendes:   function(){ if(typeof loadDividendes === 'function') loadDividendes(); },
    analyses:     function(){ if(typeof loadAnalyses === 'function') loadAnalyses(); },
    utilisateurs: function(){ if(typeof loadUsers === 'function') loadUsers(); },
    import:       function(){},
    indices:      function(){ if(typeof loadIndices === 'function') loadIndices(); }
};

function switchTab(name, el) {
    document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
    document.querySelectorAll('.admin-tab').forEach(function(t){ t.classList.remove('active'); });
    const panel = document.getElementById('panel-' + name);
    if (panel) panel.classList.add('active');
    if (el && el.classList) el.classList.add('active');
    if (name !== activeTab) { activeTab = name; if (typeof tabLoaders[name] === 'function') tabLoaders[name](); }
}

function switchSubTab(prefix, panel, el) {
    if (!el) return;
    const container = el.closest('.tab-panel');
    if (!container) return;
    container.querySelectorAll('.sub-tab').forEach(function(t){ t.classList.remove('active'); });
    el.classList.add('active');
    ['ligne','bulk','view','list','add'].forEach(function(p){
        const e2 = document.getElementById(prefix + '-panel-' + p);
        if (e2) e2.style.display = 'none';
    });
    const target = document.getElementById(prefix + '-panel-' + panel);
    if (target) target.style.display = '';
}

/* ── SUPPRESSION MULTI-LIGNES (BULK DELETE) ─────────────────── */
var selectedRows = new Set();

function toggleRow(id, el) {
    if (el.checked) selectedRows.add(id);
    else selectedRows.delete(id);
    updateBulkBar();
}

function toggleAll(ids, el) {
    if (el.checked) ids.forEach(function(id){ selectedRows.add(id); });
    else ids.forEach(function(id){ selectedRows.delete(id); });
    document.querySelectorAll('.row-check[data-id]').forEach(function(cb){
        cb.checked = el.checked;
    });
    updateBulkBar();
}

function updateBulkBar() {
    var bars = document.querySelectorAll('.bulk-bar');
    bars.forEach(function(bar){
        var count = bar.querySelector('.bulk-count');
        var actions = bar.querySelector('.bulk-actions');
        if (count) count.textContent = selectedRows.size + ' sélectionné(s)';
        if (actions) {
            if (selectedRows.size > 0) actions.classList.add('active');
            else actions.classList.remove('active');
        }
    });
}

function resetSelection() {
    selectedRows.clear();
    document.querySelectorAll('.row-check').forEach(function(cb){ cb.checked = false; });
    updateBulkBar();
}

async function bulkDelete(table, idField, reloadFn, msgLabel) {
    if (selectedRows.size === 0) { toast('Aucune ligne sélectionnée', 'err'); return; }
    var ids = Array.from(selectedRows);
    var label = msgLabel || 'ligne(s)';
    if (!doubleConfirm('Supprimer ' + ids.length + ' ' + label + ' ? Cette action est irréversible.')) return;
    if (!doubleConfirm('⚠️ CONFIRMATION FINALE : ' + ids.length + ' ' + label + ' seront définitivement effacées. Continuer ?')) return;

    var deleted = 0;
    for (var i = 0; i < ids.length; i++) {
        var ok = await sbDel(table, idField + '=eq.' + ids[i]);
        if (ok) deleted++;
    }
    toast('✓ ' + deleted + '/' + ids.length + ' ' + label + ' supprimée(s)', deleted === ids.length ? 'ok' : 'err');
    resetSelection();
    reloadFn();
}

/* ── HANDLERS BOUTONS & SUPPRESSIONS SÉCURISÉES ──────────────── */
function handleEditCours(el) { editCours(JSON.parse(decodeURIComponent(el.dataset.row))); }
function handleDeleteCours(el) { deleteCours(el.dataset.ticker, el.dataset.date); }
function handleEditUsr(el) { openUsrModal(JSON.parse(decodeURIComponent(el.dataset.row))); }
function handleDeleteHist(el) { deleteHistRow(el.dataset.id); }
function handleDeleteAllHist(el) { deleteAllHistoriqueTicker(); }
function handleEditEnt(el) { openEntModal(JSON.parse(decodeURIComponent(el.dataset.row))); }
function handleDeleteEnt(el) { deleteEntreprise(el.dataset.ticker); }
function handleEditFin(el) { openFinModal(JSON.parse(decodeURIComponent(el.dataset.row))); }
function handleDeleteFin(el) { deleteFinancial(el.dataset.id); }
function handleDeleteDiv(el) { deleteDivRow(el.dataset.id); }
function handleEditDiv(el) { editDividende(JSON.parse(decodeURIComponent(el.dataset.row))); }
function handleDeleteAn(el) { deleteAnalyseRow(el.dataset.id); }
function handleEditAn(el) { editAnalyse(JSON.parse(decodeURIComponent(el.dataset.row))); }
function handleDeleteBoc(el) { deleteBocRow(el.dataset.id); }
function handleDeleteIdx(el) { deleteIndiceRow(el.dataset.id); }
function handleEditIdx(el) { editIndice(JSON.parse(decodeURIComponent(el.dataset.row))); }

function bulkDeleteCours() { bulkDelete('cours', 'id', loadCours, 'cours'); }
function bulkDeleteEnt() { bulkDelete('entreprises', 'ticker', loadEntreprises, 'entreprises'); }
function bulkDeleteFin() { bulkDelete('financials', 'id', loadFinancials, 'financials'); }
function bulkDeleteDiv() { bulkDelete('dividendes_calendrier', 'id', loadDividendes, 'dividendes'); }
function bulkDeleteUsr() { bulkDelete('users', 'id', loadUsers, 'utilisateurs'); }
function bulkDeleteIdx() { bulkDelete('indices', 'id', loadIndices, 'indices'); }
function bulkDeleteAn() { bulkDelete('analyses', 'id', loadAnalyses, 'analyses'); }
function bulkDeleteHist() { bulkDelete('historique', 'id', loadHistoriqueTicker, 'lignes historique'); }
