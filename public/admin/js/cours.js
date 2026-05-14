/* ══════════════════════════════════════════════════════
   COURS
══════════════════════════════════════════════════════ */
async function loadCours() {
    const rows = await sbGet('cours', 'select=*&order=date_seance.desc&limit=100');
    coursData = rows || [];
    renderCoursTable(coursData);
}

function renderCoursTable(data) {
    data = data || [];
    const tb    = document.getElementById('cours-tbody');
    const count = document.getElementById('cours-count');
    if (!tb) return;
    if (!data.length) {
        tb.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:20px;">Aucun cours</td></tr>';
        if(count) count.textContent = '0 ligne'; return;
    }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
            '<td class="td-gold">' + r.ticker + '</td>' +
            '<td class="td-muted">' + r.date_seance + '</td>' +
            '<td class="r td-mono">' + fmt(r.cours) + '</td>' +
            '<td class="r td-muted">' + fmt(r.ouverture) + '</td>' +
            '<td class="r td-muted">' + fmt(r.plus_haut) + '</td>' +
            '<td class="r td-muted">' + fmt(r.plus_bas) + '</td>' +
            '<td class="r td-muted">' + fmt(r.volume) + '</td>' +
            '<td class="r" style="color:' + clrPct(r.variation) + ';font-family:var(--mono);">' + fmtPct(r.variation) + '</td>' +
            '<td class="r td-muted">' + fmt(r.capitalisation) + '</td>' +
            '<td class="r td-muted">' + fmt(r.plus_haut_52) + '</td>' +
            '<td class="r td-muted">' + fmt(r.plus_bas_52) + '</td>' +
            '<td>' +
              '<button class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditCours(this)">✎</button> ' +
              '<button class="btn btn-danger btn-sm" data-ticker="' + r.ticker + '" data-date="' + r.date_seance + '" onclick="handleDeleteCours(this)">✕</button>' +
            '</td></tr>';
    }).join('');

    var existingBar = document.getElementById('bulk-bar-cours');
    if (!existingBar) {
        var card = tb.closest('.card');
        if (card) {
            var bar = document.createElement('div');
            bar.id = 'bulk-bar-cours';
            bar.className = 'bulk-bar';
            bar.innerHTML = '<div class="bulk-actions">' +
                '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
                '<button class="btn btn-danger btn-sm" onclick="bulkDeleteCours()">🗑 Supprimer la sélection</button>' +
                '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
                '</div>';
            card.insertBefore(bar, card.querySelector('.tw'));
        }
    }
    updateBulkBar();
    if(count) count.textContent = data.length + ' ligne(s)';
}

function filterCoursTable() {
    const f = v('cours-filter').toUpperCase();
    const d = v('cours-date-filter');
    renderCoursTable(coursData.filter(function(r){
        return (!f || (r.ticker||'').indexOf(f) !== -1) && (!d || r.date_seance === d);
    }));
}

async function addCours() {
    const msg  = document.getElementById('c-msg');
    const body = {
        ticker: v('c-ticker'), date_seance: v('c-date'), cours: pf('c-cours'),
        ouverture: pf('c-ouv'), plus_haut: pf('c-haut'), plus_bas: pf('c-bas'),
        volume: pi('c-vol'), variation: pf('c-var'), capitalisation: pf('c-capi'),
        plus_haut_52: pf('c-h52'), plus_bas_52: pf('c-b52')
    };
    if (!body.ticker || !body.date_seance || body.cours == null) {
        if(msg){ msg.textContent = 'Ticker, date et cours obligatoires'; msg.className = 'msg err'; } return;
    }
    const r = await sbPost('cours', body, 'ticker,date_seance');
    if (r) {
        if(msg){ msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
        clearForm(['c-ticker','c-date','c-cours','c-ouv','c-haut','c-bas','c-vol','c-var','c-capi','c-h52','c-b52']);
        loadCours();
    }
}

function editCours(row) {
    const info = document.getElementById('modal-cours-info');
    if(info) info.textContent = row.ticker + ' — ' + row.date_seance;
    set('modal-cours-id', row.id || '');
    set('modal-cours-val',  row.cours);       set('modal-cours-ouv',  row.ouverture);
    set('modal-cours-haut', row.plus_haut);   set('modal-cours-bas',  row.plus_bas);
    set('modal-cours-vol',  row.volume);      set('modal-cours-var',  row.variation);
    set('modal-cours-capi', row.capitalisation); set('modal-cours-h52', row.plus_haut_52);
    set('modal-cours-b52',  row.plus_bas_52);
    openModal('modal-cours');
}

async function saveCours() {
    const id  = v('modal-cours-id');
    const msg = document.getElementById('modal-cours-msg');
    const body = {
        cours: pf('modal-cours-val'), ouverture: pf('modal-cours-ouv'), plus_haut: pf('modal-cours-haut'),
        plus_bas: pf('modal-cours-bas'), volume: pi('modal-cours-vol'), variation: pf('modal-cours-var'),
        capitalisation: pf('modal-cours-capi'), plus_haut_52: pf('modal-cours-h52'), plus_bas_52: pf('modal-cours-b52')
    };
    const r = await sbPatch('cours', 'id=eq.' + id, body);
    if (r) { if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; } closeModal('modal-cours'); loadCours(); }
}

async function deleteCours(ticker, date) {
    if (!doubleConfirm('Supprimer le cours ' + ticker + ' du ' + date + ' ?')) return;
    const ok = await sbDel('cours', 'ticker=eq.' + encodeURIComponent(ticker) + '&date_seance=eq.' + date);
    if (ok) { toast('Cours supprimé'); loadCours(); }
}
