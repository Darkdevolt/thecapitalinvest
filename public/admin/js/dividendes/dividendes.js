/* ══════════════════════════════════════════════════════
   DIVIDENDES — année = exercice bénéficiaire
   Édition directe depuis le formulaire Admin
══════════════════════════════════════════════════════ */
var divEditingId = null;

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
    if (!data.length) { tb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Aucun dividende</td></tr>'; return; }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
            '<td class="td-gold">' + (r.ticker || '—') + '</td>' +
            '<td>' + (r.annee || '—') + '</td>' +
            '<td class="r td-mono">' + fmt(r.montant) + '</td>' +
            '<td class="r" style="color:var(--green);font-family:var(--mono);">' + fmtPct(r.taux_rendement) + '</td>' +
            '<td class="td-muted">' + fmtDate(r.date_detachement) + '</td>' +
            '<td class="td-muted">' + fmtDate(r.date_paiement) + '</td>' +
            '<td><span class="badge ' + (r.statut==='payé'?'badge-green':r.statut==='prévisionnel'?'badge-orange':'badge-gold') + '">' + (r.statut||'—') + '</span></td>' +
            '<td>' +
              '<button type="button" class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditDiv(this);return false;">✎ Modifier</button> ' +
              '<button type="button" class="btn btn-danger btn-sm" data-id="' + r.id + '" onclick="handleDeleteDiv(this);return false;">✕</button>' +
            '</td>' +
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
            '<button type="button" class="btn btn-danger btn-sm" onclick="bulkDeleteDiv();return false;">🗑 Supprimer la sélection</button>' +
            '<button type="button" class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();return false;">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, card.querySelector('.tw'));
    }
    updateBulkBar();
}

function filterDivTable() {
    const f = v('div-filter').toLowerCase();
    renderDivTable(divData.filter(function(r){ return !f || ((r.ticker || '')+(r.notes || '')).toLowerCase().indexOf(f) !== -1; }));
}

function resetDivEditMode() {
    divEditingId = null;
    var btn = document.querySelector('#panel-dividendes .actions-row .btn-primary');
    if (btn) btn.textContent = 'Enregistrer';
    var msg = document.getElementById('div-msg');
    if (msg) { msg.textContent = ''; msg.className = 'msg'; }
}

function cancelDivEdit() {
    divEditingId = null;
    clearForm(['div-ticker','div-annee','div-montant','div-tx','div-detach','div-paie','div-notes']);
    set('div-statut','confirmé');
    var btn = document.querySelector('#panel-dividendes .actions-row .btn-primary');
    if (btn) btn.textContent = 'Enregistrer';
    var msg = document.getElementById('div-msg');
    if (msg) { msg.textContent = 'Modification annulée'; msg.className = 'msg info'; }
}

async function addDividende() {
    const msg = document.getElementById('div-msg');
    const body = {
        ticker: v('div-ticker').toUpperCase(),
        annee: pi('div-annee'),
        montant: pf('div-montant'),
        taux_rendement: pf('div-tx'),
        statut: v('div-statut')
    };
    if (v('div-detach')) body.date_detachement = v('div-detach');
    if (v('div-paie')) body.date_paiement = v('div-paie');
    if (v('div-notes')) body.notes = v('div-notes');
    if (!body.ticker || !body.annee || body.montant == null) { if(msg){ msg.textContent = 'Ticker, année et montant obligatoires'; msg.className = 'msg err'; } return; }

    if (divEditingId) {
        const r = await sbPatch('dividendes_calendrier', 'id=eq.' + encodeURIComponent(divEditingId), body);
        if (r) {
            if(msg){ msg.textContent = '✓ Dividende modifié'; msg.className = 'msg ok'; }
            divEditingId = null;
            clearForm(['div-ticker','div-annee','div-montant','div-tx','div-detach','div-paie','div-notes']);
            set('div-statut','confirmé');
            var b = document.querySelector('#panel-dividendes .actions-row .btn-primary');
            if (b) b.textContent = 'Enregistrer';
            await loadDividendes();
        }
        return;
    }

    const r = await sbPost('dividendes_calendrier', body, 'ticker,annee');
    if (r) {
        if(msg){ msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
        clearForm(['div-ticker','div-annee','div-montant','div-tx','div-detach','div-paie','div-notes']);
        loadDividendes();
    }
}

/* IMPORTANT : aucune fenêtre modale n'est ouverte pour les dividendes.
   L'édition se fait directement dans le formulaire de la section, afin
   qu'aucun overlay invisible ne puisse bloquer la souris ou le clavier. */
function handleEditDiv(button) {
    if (!button) return false;
    try {
        const raw = decodeURIComponent(button.getAttribute('data-row') || '');
        if (!raw) return false;
        const row = JSON.parse(raw);
        divEditingId = row.id;
        set('div-ticker', row.ticker || '');
        set('div-annee', row.annee || '');
        set('div-montant', row.montant);
        set('div-tx', row.taux_rendement);
        set('div-detach', row.date_detachement ? String(row.date_detachement).split('T')[0] : '');
        set('div-paie', row.date_paiement ? String(row.date_paiement).split('T')[0] : '');
        set('div-statut', row.statut || 'confirmé');
        set('div-notes', row.notes || '');
        var saveBtn = document.querySelector('#panel-dividendes .actions-row .btn-primary');
        if (saveBtn) saveBtn.textContent = 'Enregistrer la modification';
        var msg = document.getElementById('div-msg');
        if (msg) { msg.textContent = 'Modification de ' + (row.ticker || '') + ' — ' + (row.annee || '') + ' : modifiez les champs puis enregistrez.'; msg.className = 'msg info'; }
        var panel = document.getElementById('panel-dividendes');
        var formCard = panel ? panel.querySelector('.card') : null;
        if (formCard && formCard.scrollIntoView) formCard.scrollIntoView({behavior:'smooth', block:'start'});
        setTimeout(function(){ var first = document.getElementById('div-montant'); if(first) first.focus(); }, 250);
    } catch (e) {
        console.error('[dividendes] Impossible de charger la fiche:', e);
        toast('Impossible de charger ce dividende.', 'err');
    }
    return false;
}

function handleDeleteDiv(button) {
    if (!button) return false;
    const id = button.getAttribute('data-id');
    if (id) deleteDivRow(id);
    return false;
}

async function deleteDivRow(id) {
    if (!doubleConfirm('Supprimer ce dividende ?')) return;
    const ok = await sbDel('dividendes_calendrier', 'id=eq.' + encodeURIComponent(id));
    if (ok) loadDividendes();
}
