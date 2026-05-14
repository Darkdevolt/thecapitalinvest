/* ══════════════════════════════════════════════════════
   DIVIDENDES
══════════════════════════════════════════════════════ */
async function loadDividendes() {
    const rows = await sbGet('dividendes_calendrier', 'select=*&order=annee.desc&limit=200');
    divData = rows || [];
    renderDivTable(divData);
}

function renderDivTable(data) {
    data = data || [];
    const tb = document.getElementById('div-tbody');
    const cnt = document.getElementById('div-count');
    if(cnt) cnt.textContent = data.length;
    if (!tb) return;
    if (!data.length) { tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px;">Aucun dividende</td></tr>'; return; }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
            '<td class="td-gold">' + r.ticker + '</td>' +
            '<td>' + r.annee + '</td>' +
            '<td class="td-muted">' + (r.exercice||'—') + '</td>' +
            '<td class="r td-mono">' + fmt(r.montant) + '</td>' +
            '<td class="r" style="color:var(--green);font-family:var(--mono);">' + fmtPct(r.taux_rendement) + '</td>' +
            '<td class="td-muted">' + fmtDate(r.date_detachement) + '</td>' +
            '<td class="td-muted">' + fmtDate(r.date_paiement) + '</td>' +
            '<td><span class="badge ' + (r.statut==='payé'?'badge-green':r.statut==='prévisionnel'?'badge-orange':'badge-gold') + '">' + (r.statut||'—') + '</span></td>' +
            '<td><button class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditDiv(this)">✎</button> ' +
              '<button class="btn btn-danger btn-sm" data-id="' + r.id + '" onclick="handleDeleteDiv(this)">✕</button></td>' +
            '</tr>';
    }).join('');

    var card = tb.closest('.card');
    var existingBar = document.getElementById('bulk-bar-div');
    if (!existingBar && card) {
        var bar = document.createElement('div');
        bar.id = 'bulk-bar-div';
        bar.className = 'bulk-bar';
        bar.innerHTML = '<div class="bulk-actions">' +
            '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
            '<button class="btn btn-danger btn-sm" onclick="bulkDeleteDiv()">🗑 Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, card.querySelector('.tw'));
    }
    updateBulkBar();
}

function filterDivTable() {
    const f = v('div-filter').toLowerCase();
    renderDivTable(divData.filter(function(r){ return !f || (r.ticker+(r.notes||'')).toLowerCase().indexOf(f) !== -1; }));
}

async function addDividende() {
    const msg  = document.getElementById('div-msg');
    const annee = pi('div-annee');
    const exerciceVal = v('div-exercice').trim();
    const body = {
        ticker: v('div-ticker'), annee: annee, montant: pf('div-montant'),
        taux_rendement: pf('div-tx'),
        statut: v('div-statut')
    };
    if (v('div-detach')) body.date_detachement = v('div-detach');
    if (v('div-paie')) body.date_paiement = v('div-paie');
    if (v('div-notes')) body.notes = v('div-notes');
    body.exercice = exerciceVal || String(annee || new Date().getFullYear());
    if (!body.ticker || !body.annee || body.montant == null || !body.exercice) { if(msg){ msg.textContent = 'Ticker, année, montant et exercice obligatoires'; msg.className = 'msg err'; } return; }
    const r = await sbPost('dividendes_calendrier', body, 'ticker,annee');
    if (r) {
        if(msg){ msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
        clearForm(['div-ticker','div-annee','div-montant','div-tx','div-detach','div-paie','div-exercice','div-notes']);
        loadDividendes();
    }
}

function editDividende(row) {
    const info = document.getElementById('modal-div-info');
    if(info) info.textContent = row.ticker + ' — ' + row.annee;
    set('modal-div-id', row.id);
    set('modal-div-ticker', row.ticker);
    set('modal-div-annee', row.annee);
    set('modal-div-montant', row.montant);
    set('modal-div-tx', row.taux_rendement);
    set('modal-div-detach', row.date_detachement ? row.date_detachement.split('T')[0] : '');
    set('modal-div-paie', row.date_paiement ? row.date_paiement.split('T')[0] : '');
    set('modal-div-statut', row.statut || 'confirmé');
    set('modal-div-exercice', row.exercice || '');
    set('modal-div-notes', row.notes);
    openModal('modal-dividende');
}

async function saveDividende() {
    const id  = v('modal-div-id');
    const msg = document.getElementById('modal-div-msg');
    const body = {
        montant: pf('modal-div-montant'),
        taux_rendement: pf('modal-div-tx'),
        statut: v('modal-div-statut')
    };
    if (v('modal-div-detach')) body.date_detachement = v('modal-div-detach');
    if (v('modal-div-paie')) body.date_paiement = v('modal-div-paie');
    if (v('modal-div-exercice')) body.exercice = v('modal-div-exercice');
    if (v('modal-div-notes')) body.notes = v('modal-div-notes');
    const r = await sbPatch('dividendes_calendrier', 'id=eq.' + id, body);
    if (r) {
        if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; }
        closeModal('modal-dividende');
        loadDividendes();
    }
}

async function deleteDivRow(id) {
    if (!doubleConfirm('Supprimer ce dividende ?')) return;
    const ok = await sbDel('dividendes_calendrier', 'id=eq.' + id);
    if (ok) loadDividendes();
}
