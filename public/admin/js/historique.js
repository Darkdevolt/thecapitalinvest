(function() {
"use strict";

console.log('[HIST] Chargement historique.js');

/* ── Variables locales à ce fichier, pas de conflit avec main.js ── */
var histData = window.histData || [];
var histSelected = window.selectedRows || new Set();

function histToggleRow(id, el) {
    if (el.checked) histSelected.add(id);
    else histSelected.delete(id);
    updateHistBulkCount();
}

function histResetSelection() {
    histSelected.clear();
    document.querySelectorAll('#hist-tbody .row-check').forEach(cb => cb.checked = false);
    updateHistBulkCount();
}

const _fmt    = (typeof fmt === 'function')    ? fmt    : v => (v == null || v === '') ? '—' : String(v);
const _fmtPct = (typeof fmtPct === 'function')  ? fmtPct : v => (v == null || v === '') ? '—' : String(v) + '%';
const _clrPct = (typeof clrPct === 'function')  ? clrPct : () => 'inherit';
const _toast  = (typeof toast === 'function')   ? toast  : m => console.log('[toast]', m);
const _confirm= (typeof doubleConfirm === 'function') ? doubleConfirm : m => confirm(m);

const $ = id => document.getElementById(id);
const _v = id => { const el = $(id); return el ? el.value : ''; };
const _set = (id, val) => { const el = $(id); if (el) el.value = val; };

function escapeHtml(t) {
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════
   1. AJOUT LIGNE UNIQUE
══════════════════════════════════════════════════════ */
async function addHistorique() {
    const msg = $('h-msg');
    const body = {
        ticker: (_v('h-ticker') || '').toUpperCase().trim(),
        date_seance: _v('h-date'),
        cours_cloture: parseFloat(_v('h-cloture')),
        cours_ouverture: parseFloat(_v('h-ouverture')) || null,
        plus_haut: parseFloat(_v('h-haut')) || null,
        plus_bas: parseFloat(_v('h-bas')) || null,
        volume: parseInt(_v('h-vol'), 10) || null,
        variation: parseFloat(_v('h-var')) || null
    };
    if (!body.ticker || !body.date_seance || isNaN(body.cours_cloture)) {
        if (msg) { msg.textContent = 'Champs obligatoires manquants'; msg.className = 'msg err'; }
        return;
    }
    try {
        const r = await sbPost('historique', body, 'ticker,date_seance');
        if (r) {
            if (msg) { msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
            if (typeof clearForm === 'function') clearForm(['h-ticker','h-date','h-cloture','h-ouverture','h-haut','h-bas','h-vol','h-var']);
        } else {
            if (msg) { msg.textContent = 'Échec enregistrement'; msg.className = 'msg err'; }
        }
    } catch (e) {
        console.error('[HIST] addHistorique:', e);
        if (msg) { msg.textContent = 'Erreur réseau'; msg.className = 'msg err'; }
    }
}

/* ══════════════════════════════════════════════════════
   2. IMPORT CSV BULK
══════════════════════════════════════════════════════ */
async function importBulk() {
    const raw = _v('bulk-csv'), msg = $('bulk-msg');
    if (!raw) { if (msg) { msg.textContent = 'CSV vide'; msg.className = 'msg err'; } return; }

    const lines = raw.split('\n').filter(l => l.trim());
    const rows = [];
    for (const line of lines) {
        const p = line.split(',');
        if (!p[0] || !p[1]) continue;
        rows.push({
            ticker: p[0].trim().toUpperCase(),
            date_seance: p[1].trim(),
            cours_cloture: parseFloat(p[2]),
            cours_ouverture: parseFloat(p[3]) || null,
            plus_haut: parseFloat(p[4]) || null,
            plus_bas: parseFloat(p[5]) || null,
            volume: parseInt(p[6], 10) || null,
            variation: parseFloat(p[7]) || null
        });
    }
    if (!rows.length) { if (msg) { msg.textContent = 'Aucune ligne valide'; msg.className = 'msg err'; } return; }

    try {
        const r = await sbPost('historique', rows, 'ticker,date_seance');
        if (r) {
            if (msg) { msg.textContent = '✓ ' + rows.length + ' lignes importées'; msg.className = 'msg ok'; }
            _set('bulk-csv', '');
            const pr = $('bulk-preview');
            if (pr) pr.style.display = 'none';
        } else {
            if (msg) { msg.textContent = 'Échec import'; msg.className = 'msg err'; }
        }
    } catch (e) {
        console.error('[HIST] importBulk:', e);
        if (msg) { msg.textContent = 'Erreur réseau'; msg.className = 'msg err'; }
    }
}

function parseBulkPreview() {
    const raw = _v('bulk-csv'), msg = $('bulk-msg'), preview = $('bulk-preview'), tbody = $('bulk-preview-tbody');
    if (!raw) {
        if (msg) { msg.textContent = 'CSV vide'; msg.className = 'msg err'; }
        if (preview) preview.style.display = 'none';
        return;
    }
    const lines = raw.split('\n').filter(l => l.trim());
    if (tbody) {
        tbody.innerHTML = lines.slice(0, 20).map(line => {
            const p = line.split(',');
            const ok = p[0] && p[1] && !isNaN(parseFloat(p[2]));
            return '<tr><td>' + escapeHtml(p[0] || '—') + '</td><td>' + escapeHtml(p[1] || '—') + '</td><td>' + escapeHtml(p[2] || '—') + '</td><td>' + escapeHtml(p[6] || '—') + '</td><td>' + escapeHtml(p[7] || '—') + '</td><td>' + (ok ? '✅' : '❌') + '</td></tr>';
        }).join('');
    }
    if (preview) preview.style.display = '';
    if (msg) { msg.textContent = lines.length + ' lignes détectées'; msg.className = 'msg info'; }
}

/* ══════════════════════════════════════════════════════
   3. CONSULTATION TABLEAU
══════════════════════════════════════════════════════ */
async function loadHistoriqueTicker() {
    const ticker = _v('hist-ticker-search');
    const from   = _v('hist-date-from');
    const to     = _v('hist-date-to');
    const tb     = $('hist-tbody');

    if (!tb) { console.error('[HIST] #hist-tbody introuvable'); return; }

    if (!ticker) {
        tb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Entrez un ticker et cliquez Charger</td></tr>';
        const btnDel = $('btn-del-all-hist');
        if (btnDel) btnDel.style.display = 'none';
        histData = [];
        removeBulkBarHist();
        return;
    }

    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;"><div class="spinner" style="border-top-color:var(--gold);border-color:var(--border);border-width:2px;border-style:solid;border-radius:50%;width:20px;height:20px;animation:spin .8s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px;"></div>Chargement...</td></tr>';

    let params = 'select=*&ticker=eq.' + encodeURIComponent(ticker) + '&order=date_seance.desc';
    if (from) params += '&date_seance=gte.' + encodeURIComponent(from);
    if (to)   params += '&date_seance=lte.' + encodeURIComponent(to);

    try {
        console.log('[HIST] Requête:', params);
        const rows = await sbGet('historique', params);
        console.log('[HIST] Réponse:', rows);

        histData = rows || [];
        window.histData = histData;

        const btnDel = $('btn-del-all-hist');

        if (!histData.length) {
            tb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Aucun historique pour ce ticker</td></tr>';
            if (btnDel) btnDel.style.display = 'none';
            removeBulkBarHist();
            return;
        }

        histResetSelection();

        tb.innerHTML = histData.map(r => '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + escapeHtml(r.id) + '" onchange="histToggleRow(\'' + escapeHtml(r.id) + '\',this)"></td>' +
            '<td class="td-gold">' + escapeHtml(r.ticker) + '</td>' +
            '<td class="td-muted">' + r.date_seance + '</td>' +
            '<td class="r td-mono">' + _fmt(r.cours_cloture) + '</td>' +
            '<td class="r td-muted">' + _fmt(r.cours_ouverture) + '</td>' +
            '<td class="r td-muted">' + _fmt(r.plus_haut) + '</td>' +
            '<td class="r td-muted">' + _fmt(r.plus_bas) + '</td>' +
            '<td class="r td-muted">' + _fmt(r.volume) + '</td>' +
            '<td class="r" style="color:' + _clrPct(r.variation) + ';font-family:var(--mono);">' + _fmtPct(r.variation) + '</td>' +
            '<td><button class="btn btn-danger btn-sm" data-id="' + escapeHtml(r.id) + '" onclick="deleteHistRow(\'' + escapeHtml(r.id) + '\')">✕</button></td>' +
            '</tr>').join('');

        ensureBulkBarHist();
        updateHistBulkCount();
        if (btnDel) btnDel.style.display = '';

    } catch (err) {
        console.error('[HIST] Erreur chargement:', err);
        tb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--red);padding:20px;">Erreur : ' + escapeHtml(err.message || 'inconnue') + '</td></tr>';
    }
}

/* ══════════════════════════════════════════════════════
   4. SUPPRESSIONS
══════════════════════════════════════════════════════ */
async function deleteHistRow(id) {
    if (!id) return;
    if (!_confirm('Supprimer cette ligne historique ?')) return;
    try {
        const ok = await sbDel('historique', 'id=eq.' + encodeURIComponent(id));
        if (ok) {
            _toast('Ligne supprimée');
            loadHistoriqueTicker();
        }
    } catch (e) {
        console.error('[HIST] deleteHistRow:', e);
        _toast('Erreur suppression');
    }
}

async function deleteAllHistoriqueTicker() {
    const ticker = _v('hist-ticker-search');
    if (!ticker) return;
    if (!_confirm('Supprimer TOUT l\'historique de ' + ticker + ' ?')) return;
    try {
        const ok = await sbDel('historique', 'ticker=eq.' + encodeURIComponent(ticker));
        if (ok) {
            _toast('Historique supprimé');
            loadHistoriqueTicker();
        }
    } catch (e) {
        console.error('[HIST] deleteAllHistoriqueTicker:', e);
        _toast('Erreur suppression');
    }
}

/* ══════════════════════════════════════════════════════
   5. BULK BAR
══════════════════════════════════════════════════════ */
function ensureBulkBarHist() {
    const tb = $('hist-tbody');
    if (!tb) return;
    const card = tb.closest('.card');
    if (!card) return;
    if ($('bulk-bar-hist')) return;

    const bar = document.createElement('div');
    bar.id = 'bulk-bar-hist';
    bar.className = 'bulk-bar';
    bar.innerHTML = '<div class="bulk-actions">' +
        '<span id="hist-bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
        '<button class="btn btn-danger btn-sm" onclick="runBulkDeleteHist()">🗑 Supprimer la sélection</button>' +
        '<button class="btn btn-outline btn-sm" onclick="histResetSelection();updateHistBulkCount();">↺ Tout désélectionner</button>' +
        '</div>';

    const ref = card.querySelector('.tw') || tb.parentNode;
    if (ref && ref.parentNode === card) card.insertBefore(bar, ref);
    else card.appendChild(bar);
}

function removeBulkBarHist() {
    const bar = $('bulk-bar-hist');
    if (bar) bar.remove();
}

function updateHistBulkCount() {
    const span = $('hist-bulk-count');
    if (!span) return;
    span.textContent = document.querySelectorAll('#hist-tbody .row-check:checked').length + ' sélectionné(s)';
}

async function runBulkDeleteHist() {
    if (typeof bulkDeleteHist === 'function' && typeof selectedRows !== 'undefined') {
        return bulkDeleteHist();
    }
    const ids = Array.from(document.querySelectorAll('#hist-tbody .row-check:checked')).map(cb => cb.dataset.id).filter(Boolean);
    if (!ids.length) { _toast('Aucune ligne sélectionnée'); return; }
    if (!_confirm('Supprimer ' + ids.length + ' ligne(s) ?')) return;

    let okCount = 0;
    for (const id of ids) {
        try {
            const ok = await sbDel('historique', 'id=eq.' + encodeURIComponent(id));
            if (ok) okCount++;
        } catch (e) { console.error(e); }
    }
    _toast(okCount + ' ligne(s) supprimée(s)');
    loadHistoriqueTicker();
    histResetSelection();
}

/* ══════════════════════════════════════════════════════
   6. EXPOSITION GLOBALE
══════════════════════════════════════════════════════ */
window.addHistorique = addHistorique;
window.importBulk = importBulk;
window.parseBulkPreview = parseBulkPreview;
window.loadHistoriqueTicker = loadHistoriqueTicker;
window.deleteHistRow = deleteHistRow;
window.deleteAllHistoriqueTicker = deleteAllHistoriqueTicker;
window.runBulkDeleteHist = runBulkDeleteHist;
window.histToggleRow = histToggleRow;
window.histResetSelection = histResetSelection;
window.updateHistBulkCount = updateHistBulkCount;

})();
