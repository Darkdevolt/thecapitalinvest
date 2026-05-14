/* ══════════════════════════════════════════════════════
   UTILISATEURS
══════════════════════════════════════════════════════ */
async function loadUsers() {
    const rows = await sbGet('users', 'select=*&order=created_at.desc&limit=200');
    usrData = rows || [];
    renderUsrTable(usrData);
}

function renderUsrTable(data) {
    data = data || [];
    const tb = document.getElementById('usr-tbody');
    const cnt = document.getElementById('usr-count');
    if(cnt) cnt.textContent = data.length;
    if (!tb) return;
    if (!data.length) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">Aucun utilisateur</td></tr>'; return; }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
            '<td>' + r.email + '</td>' +
            '<td>' + (r.nom||'—') + '</td>' +
            '<td><span class="badge ' + (r.plan==='elite'?'badge-gold':r.plan==='pro'?'badge-blue':'badge-green') + '">' + (r.plan||'free') + '</span></td>' +
            '<td class="td-muted">' + fmtDate(r.plan_expiry) + '</td>' +
            '<td>' + (r.is_admin?'✓':'—') + '</td>' +
            '<td class="td-muted">' + fmtDate(r.created_at) + '</td>' +
            '<td><button class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditUsr(this)">✎</button></td>' +
            '</tr>';
    }).join('');

    var card = tb.closest('.card');
    var existingBar = document.getElementById('bulk-bar-usr');
    if (!existingBar && card) {
        var bar = document.createElement('div');
        bar.id = 'bulk-bar-usr';
        bar.className = 'bulk-bar';
        bar.innerHTML = '<div class="bulk-actions">' +
            '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
            '<button class="btn btn-danger btn-sm" onclick="bulkDeleteUsr()">🗑 Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, card.querySelector('.tw'));
    }
    updateBulkBar();
}

function filterUsrTable() {
    const f = v('usr-search').toLowerCase();
    const p = v('usr-plan-filter');
    renderUsrTable(usrData.filter(function(r){
        return (!f || (r.email+(r.nom||'')).toLowerCase().indexOf(f) !== -1) && (!p || r.plan === p);
    }));
}

function openUsrModal(row) {
    set('modal-usr-id', row.id);
    set('modal-usr-plan',   row.plan||'free');
    set('modal-usr-expiry', row.plan_expiry ? row.plan_expiry.split('T')[0] : '');
    set('modal-usr-nom',    row.nom);
    set('modal-usr-admin',  String(row.is_admin));
    openModal('modal-user');
}

async function saveUser() {
    const id  = v('modal-usr-id');
    const msg = document.getElementById('modal-usr-msg');
    const body = {
        plan: v('modal-usr-plan'), plan_expiry: v('modal-usr-expiry')||null,
        nom: v('modal-usr-nom'), is_admin: v('modal-usr-admin') === 'true'
    };
    const r = await sbPatch('users', 'id=eq.' + id, body);
    if (r) { if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; } closeModal('modal-user'); loadUsers(); }
}
