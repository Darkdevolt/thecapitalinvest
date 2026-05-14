/* ══════════════════════════════════════════════════════
   INDICES
══════════════════════════════════════════════════════ */
async function loadIndices() {
    const rows = await sbGet('indices', 'select=*&order=date_seance.desc&limit=200');
    idxData = rows || [];
    renderIndicesTable(idxData);
}

function renderIndicesTable(data) {
    data = data || [];
    const tb = document.getElementById('idx-tbody');
    const cnt = document.getElementById('idx-count');
    if(cnt) cnt.textContent = data.length;
    if (!tb) return;
    if (!data.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">Aucun indice</td></tr>'; return; }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
            '<td class="td-gold">' + (r.indice || '—') + '</td>' +
            '<td class="td-muted">' + (r.date_seance || '—') + '</td>' +
            '<td class="r td-mono">' + fmt(r.valeur) + '</td>' +
            '<td class="r" style="color:' + clrPct(r.variation) + ';font-family:var(--mono);">' + fmtPct(r.variation) + '</td>' +
            '<td class="r td-muted">' + (r.variation_pct != null ? Number(r.variation_pct).toFixed(2) + '%' : '—') + '</td>' +
            '<td>' +
              '<button class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditIdx(this)">✎</button> ' +
              '<button class="btn btn-danger btn-sm" data-id="' + r.id + '" onclick="handleDeleteIdx(this)">✕</button>' +
            '</td>' +
            '</tr>';
    }).join('');

    var card = tb.closest('.card');
    var existingBar = document.getElementById('bulk-bar-idx');
    if (!existingBar && card) {
        var bar = document.createElement('div');
        bar.id = 'bulk-bar-idx';
        bar.className = 'bulk-bar';
        bar.innerHTML = '<div class="bulk-actions">' +
            '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
            '<button class="btn btn-danger btn-sm" onclick="bulkDeleteIdx()">🗑 Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, card.querySelector('.tw'));
    }
    updateBulkBar();
}

function filterIndicesTable() {
    const f = v('idx-filter').toUpperCase();
    const d = v('idx-date-filter');
    renderIndicesTable(idxData.filter(function(r){
        return (!f || (r.indice||'').indexOf(f) !== -1) && (!d || r.date_seance === d);
    }));
}

async function addIndice() {
    const msg = document.getElementById('idx-msg');
    const body = {
        indice: v('idx-indice'), date_seance: v('idx-date'), valeur: pf('idx-valeur'),
        variation: pf('idx-var'), variation_pct: pf('idx-varpct')
    };
    if (!body.indice || !body.date_seance || body.valeur == null) {
        if(msg){ msg.textContent = 'Indice, date et valeur obligatoires'; msg.className = 'msg err'; } return;
    }
    const r = await sbPost('indices', body, 'indice,date_seance');
    if (r) {
        if(msg){ msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
        clearForm(['idx-indice','idx-date','idx-valeur','idx-var','idx-varpct']);
        loadIndices();
    }
}

async function deleteIndiceRow(id) {
    if (!doubleConfirm("Supprimer cet indice ?")) return;
    const ok = await sbDel('indices', 'id=eq.' + id);
    if (ok) loadIndices();
}

function editIndice(row) {
    const info = document.getElementById('modal-idx-info');
    if(info) info.textContent = (row.indice || '—') + ' — ' + (row.date_seance || '—');
    set('modal-idx-id', row.id);
    set('modal-idx-indice', row.indice);
    set('modal-idx-date', row.date_seance);
    set('modal-idx-valeur', row.valeur);
    set('modal-idx-var', row.variation);
    set('modal-idx-varpct', row.variation_pct);
    openModal('modal-indice');
}

async function saveIndice() {
    const id  = v('modal-idx-id');
    const msg = document.getElementById('modal-idx-msg');
    const body = {
        valeur: pf('modal-idx-valeur'),
        variation: pf('modal-idx-var'),
        variation_pct: pf('modal-idx-varpct')
    };
    const r = await sbPatch('indices', 'id=eq.' + id, body);
    if (r) {
        if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; }
        closeModal('modal-indice');
        loadIndices();
    }
}
