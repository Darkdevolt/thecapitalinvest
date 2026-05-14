/* ══════════════════════════════════════════════════════
   ANALYSES
══════════════════════════════════════════════════════ */
async function loadAnalyses() {
    const rows = await sbGet('analyses', 'select=*&order=date_analyse.desc&limit=100');
    anData = rows || [];
    const list = document.getElementById('an-list');
    const cnt = document.getElementById('an-count');
    if(cnt) cnt.textContent = (rows || []).length;
    if (!list) return;
    if (!rows || !rows.length) { list.innerHTML = '<div style="padding:18px;color:var(--muted);text-align:center;">Aucune analyse</div>'; return; }

    resetSelection();
    list.innerHTML = '<div class="tw"><table style="width:100%;font-size:13px;">' +
        '<thead><tr>' +
        '<th><input type="checkbox" class="row-check" onchange="toggleAll(anData.map(function(r){return r.id}),this)"></th>' +
        '<th>Titre</th><th>Ticker</th><th>Recommandation</th><th>Cible</th><th>Date</th><th>Actions</th>' +
        '</tr></thead><tbody>' +
        rows.map(function(r){
            var resume = (r.resume || '').substring(0, 180) + ((r.resume || '').length > 180 ? '...' : '');
            return '<tr>' +
                '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
                '<td style="font-family:var(--serif);color:var(--gold);">' + (r.titre || 'Sans titre') + '</td>' +
                '<td>' + r.ticker + '</td>' +
                '<td><span class="badge ' + (r.recommandation === 'Acheter' ? 'badge-green' : r.recommandation === 'Vendre' ? 'badge-red' : 'badge-gold') + '">' + r.recommandation + '</span></td>' +
                '<td class="r td-mono">' + fmt(r.cours_cible) + '</td>' +
                '<td class="td-muted">' + fmtDate(r.date_analyse) + '</td>' +
                '<td>' +
                    '<button class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditAn(this)">✎</button> ' +
                    '<button class="btn btn-danger btn-sm" data-id="' + r.id + '" onclick="handleDeleteAn(this)">✕</button>' +
                '</td>' +
                '</tr>';
        }).join('') + '</tbody></table></div>';

    var card = list.closest('.card');
    var existingBar = document.getElementById('bulk-bar-an');
    if (!existingBar && card) {
        var bar = document.createElement('div');
        bar.id = 'bulk-bar-an';
        bar.className = 'bulk-bar';
        bar.innerHTML = '<div class="bulk-actions">' +
            '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
            '<button class="btn btn-danger btn-sm" onclick="bulkDeleteAn()">🗑 Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, card.querySelector('#an-list'));
    }
    updateBulkBar();
}

async function deleteAnalyseRow(id) {
    if (!doubleConfirm('Supprimer cette analyse ?')) return;
    const ok = await sbDel('analyses', 'id=eq.' + id);
    if (ok) loadAnalyses();
}

async function addAnalyse() {
    const msg  = document.getElementById('an-msg');
    const body = {
        ticker: v('an-ticker'), recommandation: v('an-reco'),
        titre: v('an-titre'),
        date_analyse: v('an-date')||new Date().toISOString().split('T')[0],
        analyste: v('an-analyste'), commentaire: v('an-resume')
    };
    var cible = pf('an-cible');
    if (cible != null) body.cours_cible = cible;
    var ref = pf('an-cours');
    if (ref != null) body.cours_reference = ref;
    if (!body.ticker || !body.recommandation) { if(msg){ msg.textContent = 'Ticker et recommandation obligatoires'; msg.className = 'msg err'; } return; }
    const r = await sbPost('analyses', body);
    if (r) {
        if(msg){ msg.textContent = '✓ Publiée'; msg.className = 'msg ok'; }
        clearForm(['an-ticker','an-titre','an-cible','an-cours','an-analyste','an-resume']);
        const disp = document.getElementById('an-potentiel-display');
        if(disp) disp.value = '';
        loadAnalyses();
    }
}

async function prefillAnalyseFromTicker() {
    const ticker = v('an-ticker');
    if (!ticker) return;
    const rows = await sbGet('cours', 'select=cours&order=date_seance.desc&limit=1&ticker=eq.' + encodeURIComponent(ticker));
    if (rows && rows[0] && rows[0].cours) {
        set('an-cours', rows[0].cours);
        calcPotentiel();
    }
}

function editAnalyse(row) {
    const info = document.getElementById('modal-an-info');
    if(info) info.textContent = row.ticker + ' — ' + (row.date_analyse || '—');
    set('modal-an-id', row.id);
    set('modal-an-ticker', row.ticker);
    set('modal-an-date', row.date_analyse ? row.date_analyse.split('T')[0] : '');
    set('modal-an-titre', row.titre || '');
    set('modal-an-reco', row.recommandation);
    set('modal-an-cible', row.cours_cible || row.objectif_cours);
    set('modal-an-analyste', row.analyste);
    set('modal-an-resume', row.commentaire || '');
    openModal('modal-analyse');
}

async function saveAnalyse() {
    const id  = v('modal-an-id');
    const msg = document.getElementById('modal-an-msg');
    const body = {
        titre: v('modal-an-titre'),
        recommandation: v('modal-an-reco'),
        analyste: v('modal-an-analyste'),
        commentaire: v('modal-an-resume')
    };
    var cible = pf('modal-an-cible');
    if (cible != null) body.cours_cible = cible;
    const r = await sbPatch('analyses', 'id=eq.' + id, body);
    if (r) {
        if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; }
        closeModal('modal-analyse');
        loadAnalyses();
    }
}
