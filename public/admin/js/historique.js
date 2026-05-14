/* ══════════════════════════════════════════════════════
   HISTORIQUE
══════════════════════════════════════════════════════ */
async function addHistorique() {
    const msg  = document.getElementById('h-msg');
    const body = {
        ticker: v('h-ticker'), date_seance: v('h-date'), cours_cloture: pf('h-cloture'),
        ouverture: pf('h-ouverture'), plus_haut: pf('h-haut'), plus_bas: pf('h-bas'),
        volume: pi('h-vol'), variation: pf('h-var')
    };
    if (!body.ticker || !body.date_seance || body.cours_cloture == null) {
        if(msg){ msg.textContent = 'Champs obligatoires manquants'; msg.className = 'msg err'; } return;
    }
    const r = await sbPost('historique', body, 'ticker,date_seance');
    if (r) {
        if(msg){ msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
        clearForm(['h-ticker','h-date','h-cloture','h-ouverture','h-haut','h-bas','h-vol','h-var']);
    }
}

async function importBulk() {
    const raw = v('bulk-csv');
    const msg = document.getElementById('bulk-msg');
    if (!raw) { if(msg){ msg.textContent = 'CSV vide'; msg.className = 'msg err'; } return; }
    const lines = raw.split('\n').filter(function(l){ return l.trim(); });
    const rows = [];
    lines.forEach(function(line){
        const parts = line.split(',');
        const ticker = parts[0], date = parts[1], cloture = parts[2],
              ouv = parts[3], haut = parts[4], bas = parts[5], vol = parts[6], vari = parts[7];
        if (!ticker || !date) return;
        rows.push({
            ticker: ticker.trim().toUpperCase(), date_seance: date.trim(),
            cours_cloture: parseFloat(cloture), ouverture: parseFloat(ouv)||null,
            plus_haut: parseFloat(haut)||null, plus_bas: parseFloat(bas)||null,
            volume: parseInt(vol)||null, variation: parseFloat(vari)||null
        });
    });
    if (!rows.length) { if(msg){ msg.textContent = 'Aucune ligne valide'; msg.className = 'msg err'; } return; }
    const r = await sbPost('historique', rows, 'ticker,date_seance');
    if (r) { if(msg){ msg.textContent = '✓ ' + rows.length + ' lignes importées'; msg.className = 'msg ok'; } set('bulk-csv',''); }
}

function parseBulkPreview() {
    const raw = v('bulk-csv');
    const msg = document.getElementById('bulk-msg');
    if (!raw) { if(msg){ msg.textContent = 'CSV vide'; msg.className = 'msg err'; } return; }
    const lines = raw.split('\n').filter(function(l){ return l.trim(); });
    const preview = document.getElementById('bulk-preview');
    const tbody   = document.getElementById('bulk-preview-tbody');
    if(preview) preview.style.display = '';
    if(tbody) tbody.innerHTML = lines.slice(0,20).map(function(line){
        const p = line.split(',');
        const ticker = p[0], date = p[1], cloture = p[2], vol = p[6], vari = p[7];
        const ok = ticker && date && !isNaN(parseFloat(cloture));
        return '<tr><td>' + (ticker||'—') + '</td><td>' + (date||'—') + '</td><td>' + (cloture||'—') + '</td><td>' + (vol||'—') + '</td><td>' + (vari||'—') + '</td><td>' + (ok?'✅':'❌') + '</td></tr>';
    }).join('');
    if(msg){ msg.textContent = lines.length + ' lignes détectées'; msg.className = 'msg info'; }
}

async function loadHistoriqueTicker() {
    const ticker = v('hist-ticker-search');
    const from   = v('hist-date-from');
    const to     = v('hist-date-to');
    const tb     = document.getElementById('hist-tbody');
    if (!ticker) { if(tb) tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px;">Entrez un ticker</td></tr>'; return; }
    let params = 'select=*&ticker=eq.' + encodeURIComponent(ticker) + '&order=date_seance.desc';
    if (from) params += '&date_seance=gte.' + from;
    if (to)   params += '&date_seance=lte.' + to;
    const rows = await sbGet('historique', params);
    histData = rows || [];
    if (!tb) return;
    const btnDel = document.getElementById('btn-del-all-hist');
    if (!histData.length) {
        tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px;">Aucun historique</td></tr>';
        if(btnDel) btnDel.style.display = 'none';
    } else {
        resetSelection();
        tb.innerHTML = histData.map(function(r){
            return '<tr>' +
                '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
                '<td class="td-gold">' + r.ticker + '</td>' +
                '<td class="td-muted">' + r.date_seance + '</td>' +
                '<td class="r td-mono">' + fmt(r.cours_cloture) + '</td>' +
                '<td class="r td-muted">' + fmt(r.ouverture) + '</td>' +
                '<td class="r td-muted">' + fmt(r.plus_haut) + '</td>' +
                '<td class="r td-muted">' + fmt(r.plus_bas) + '</td>' +
                '<td class="r td-muted">' + fmt(r.volume) + '</td>' +
                '<td class="r" style="color:' + clrPct(r.variation) + ';font-family:var(--mono);">' + fmtPct(r.variation) + '</td>' +
                '<td><button class="btn btn-danger btn-sm" data-id="' + r.id + '" onclick="handleDeleteHist(this)">✕</button></td>' +
                '</tr>';
        }).join('');

        var card = tb.closest('.card');
        var existingBar = document.getElementById('bulk-bar-hist');
        if (!existingBar && card) {
            var bar = document.createElement('div');
            bar.id = 'bulk-bar-hist';
            bar.className = 'bulk-bar';
            bar.innerHTML = '<div class="bulk-actions">' +
                '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
                '<button class="btn btn-danger btn-sm" onclick="bulkDeleteHist()">🗑 Supprimer la sélection</button>' +
                '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
                '</div>';
            card.insertBefore(bar, card.querySelector('.tw'));
        }
        updateBulkBar();
        if(btnDel) btnDel.style.display = '';
    }
}

async function deleteHistRow(id) {
    if (!doubleConfirm('Supprimer cette ligne historique ?')) return;
    const ok = await sbDel('historique', 'id=eq.' + id);
    if (ok) { toast('Ligne supprimée'); loadHistoriqueTicker(); }
}

async function deleteAllHistoriqueTicker() {
    const ticker = v('hist-ticker-search');
    if (!ticker || !doubleConfirm('Supprimer TOUT l\'historique de ' + ticker + ' ? Cette action efface toutes les données historiques pour ce ticker.')) return;
    const ok = await sbDel('historique', 'ticker=eq.' + encodeURIComponent(ticker));
    if (ok) { toast('Historique supprimé'); loadHistoriqueTicker(); }
}
