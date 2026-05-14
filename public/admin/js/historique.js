/* ══════════════════════════════════════════════════════
   HISTORIQUE.JS — Chargement
══════════════════════════════════════════════════════ */
console.log('[historique.js] Fichier chargé ✓');

// ── Vérification dépendances critiques ──
if (typeof sbGet !== 'function' || typeof sbPost !== 'function' || typeof sbDel !== 'function') {
    console.error('[historique.js] ERREUR : sbGet / sbPost / sbDel non disponibles. Vérifiez que api.js est bien chargé AVANT historique.js dans admin.html');
}

// ── État global ──
if (typeof window.histData === 'undefined') window.histData = [];

// ── Fallbacks si utils.js/main.js défaillants ──
const _fmt    = (typeof fmt === 'function')    ? fmt    : v => (v == null || v === '') ? '—' : String(v);
const _fmtPct = (typeof fmtPct === 'function')  ? fmtPct : v => (v == null || v === '') ? '—' : String(v) + '%';
const _clrPct = (typeof clrPct === 'function')  ? clrPct : () => 'inherit';
const _toast  = (typeof toast === 'function')   ? toast  : m => console.log('[toast]', m);
const _confirm= (typeof doubleConfirm === 'function') ? doubleConfirm : m => confirm(m);

// ── Helpers DOM ──
const _v   = id => { const el = document.getElementById(id); return el ? el.value : ''; };
const _set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════
   1. AJOUT LIGNE UNIQUE
══════════════════════════════════════════════════════ */
async function addHistorique() {
    const msg = document.getElementById('h-msg');
    const body = {
        ticker: (_v('h-ticker') || '').toUpperCase().trim(),
        date_seance: _v('h-date'),
        cours_cloture: parseFloat(_v('h-cloture')),
        ouverture: parseFloat(_v('h-ouverture')) || null,
        plus_haut: parseFloat(_v('h-haut')) || null,
        plus_bas: parseFloat(_v('h-bas')) || null,
        volume: parseInt(_v('h-vol'), 10) || null,
        variation: parseFloat(_v('h-var')) || null
    };

    if (!body.ticker || !body.date_seance || isNaN(body.cours_cloture)) {
        if (msg) { msg.textContent = 'Champs obligatoires manquants (Ticker, Date, Clôture)'; msg.className = 'msg err'; }
        return;
    }

    try {
        const r = await sbPost('historique', body, 'ticker,date_seance');
        if (r) {
            if (msg) { msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
            if (typeof clearForm === 'function') clearForm(['h-ticker','h-date','h-cloture','h-ouverture','h-haut','h-bas','h-vol','h-var']);
        } else {
            if (msg) { msg.textContent = 'Échec de l\'enregistrement'; msg.className = 'msg err'; }
        }
    } catch (err) {
        console.error('[historique.js] addHistorique erreur:', err);
        if (msg) { msg.textContent = 'Erreur réseau / serveur'; msg.className = 'msg err'; }
    }
}

/* ══════════════════════════════════════════════════════
   2. IMPORT CSV BULK
══════════════════════════════════════════════════════ */
async function importBulk() {
    const raw = _v('bulk-csv');
    const msg = document.getElementById('bulk-msg');
    if (!raw) { if (msg) { msg.textContent = 'CSV vide'; msg.className = 'msg err'; } return; }

    const lines = raw.split('\n').filter(l => l.trim());
    const rows = [];
    for (const line of lines) {
        const p = line.split(',');
        const ticker = p[0], date = p[1], cloture = p[2], ouv = p[3], haut = p[4], bas = p[5], vol = p[6], vari = p[7];
        if (!ticker || !date) continue;
        rows.push({
            ticker: ticker.trim().toUpperCase(),
            date_seance: date.trim(),
            cours_cloture: parseFloat(cloture),
            ouverture: parseFloat(ouv) || null,
            plus_haut: parseFloat(haut) || null,
            plus_bas: parseFloat(bas) || null,
            volume: parseInt(vol, 10) || null,
            variation: parseFloat(vari) || null
        });
    }

    if (!rows.length) { if (msg) { msg.textContent = 'Aucune ligne valide'; msg.className = 'msg err'; } return; }

    try {
        const r = await sbPost('historique', rows, 'ticker,date_seance');
        if (r) {
            if (msg) { msg.textContent = `✓ ${rows.length} lignes importées`; msg.className = 'msg ok'; }
            _set('bulk-csv', '');
            const preview = document.getElementById('bulk-preview');
            if (preview) preview.style.display = 'none';
        } else {
            if (msg) { msg.textContent = 'Échec de l\'import'; msg.className = 'msg err'; }
        }
    } catch (err) {
        console.error('[historique.js] importBulk erreur:', err);
        if (msg) { msg.textContent = 'Erreur réseau / serveur'; msg.className = 'msg err'; }
    }
}

function parseBulkPreview() {
    const raw = _v('bulk-csv');
    const msg = document.getElementById('bulk-msg');
    const preview = document.getElementById('bulk-preview');
    const tbody = document.getElementById('bulk-preview-tbody');

    if (!raw) {
        if (msg) { msg.textContent = 'CSV vide'; msg.className = 'msg err'; }
        if (preview) preview.style.display = 'none';
        return;
    }

    const lines = raw.split('\n').filter(l => l.trim());
    if (tbody) {
        tbody.innerHTML = lines.slice(0, 20).map(line => {
            const p = line.split(',');
            const ticker = p[0], date = p[1], cloture = p[2], vol = p[6], vari = p[7];
            const ok = ticker && date && !isNaN(parseFloat(cloture));
            return `<tr>
                <td>${escapeHtml(ticker || '—')}</td>
                <td>${escapeHtml(date || '—')}</td>
                <td>${escapeHtml(cloture || '—')}</td>
                <td>${escapeHtml(vol || '—')}</td>
                <td>${escapeHtml(vari || '—')}</td>
                <td>${ok ? '✅' : '❌'}</td>
            </tr>`;
        }).join('');
    }
    if (preview) preview.style.display = '';
    if (msg) { msg.textContent = `${lines.length} lignes détectées`; msg.className = 'msg info'; }
}

/* ══════════════════════════════════════════════════════
   3. CONSULTATION TABLEAU
══════════════════════════════════════════════════════ */
async function loadHistoriqueTicker() {
    const ticker = _v('hist-ticker-search');
    const from = _v('hist-date-from');
    const to = _v('hist-date-to');
    const tb = document.getElementById('hist-tbody');

    if (!tb) {
        console.error('[historique.js] Élément #hist-tbody introuvable dans le DOM');
        return;
    }

    if (!ticker) {
        tb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Entrez un ticker et cliquez Charger</td></tr>';
        const btnDel = document.getElementById('btn-del-all-hist');
        if (btnDel) btnDel.style.display = 'none';
        window.histData = [];
        removeBulkBarHist();
        return;
    }

    let params = 'select=*&ticker=eq.' + encodeURIComponent(ticker) + '&order=date_seance.desc';
    if (from) params += '&date_seance=gte.' + encodeURIComponent(from);
    if (to)   params += '&date_seance=lte.' + encodeURIComponent(to);

    try {
        console.log('[historique.js] Requête Supabase:', params);
        const rows = await sbGet('historique', params);
        window.histData = rows || [];
        console.log('[historique.js] Résultat:', window.histData.length, 'lignes');

        const btnDel = document.getElementById('btn-del-all-hist');

        if (!window.histData.length) {
            tb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Aucun historique pour ce ticker</td></tr>';
            if (btnDel) btnDel.style.display = 'none';
            removeBulkBarHist();
            return;
        }

        if (typeof resetSelection === 'function') resetSelection();

        tb.innerHTML = window.histData.map(r => `
            <tr>
                <td><input type="checkbox" class="row-check" data-id="${escapeHtml(r.id)}"></td>
                <td class="td-gold">${escapeHtml(r.ticker)}</td>
                <td class="td-muted">${r.date_seance}</td>
                <td class="r td-mono">${_fmt(r.cours_cloture)}</td>
                <td class="r td-muted">${_fmt(r.ouverture)}</td>
                <td class="r td-muted">${_fmt(r.plus_haut)}</td>
                <td class="r td-muted">${_fmt(r.plus_bas)}</td>
                <td class="r td-muted">${_fmt(r.volume)}</td>
                <td class="r" style="color:${_clrPct(r.variation)};font-family:var(--mono);">${_fmtPct(r.variation)}</td>
                <td><button class="btn btn-danger btn-sm btn-del-hist" data-id="${escapeHtml(r.id)}">✕</button></td>
            </tr>
        `).join('');

        attachHistTableEvents(tb);
        ensureBulkBarHist();
        if (typeof updateBulkBar === 'function') updateBulkBar();
        updateHistBulkCount();
        if (btnDel) btnDel.style.display = '';

    } catch (err) {
        console.error('[historique.js] loadHistoriqueTicker erreur:', err);
        tb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:20px;">Erreur de chargement des données</td></tr>';
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
    } catch (err) {
        console.error('[historique.js] deleteHistRow erreur:', err);
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
    } catch (err) {
        console.error('[historique.js] deleteAllHistoriqueTicker erreur:', err);
        _toast('Erreur suppression');
    }
}

/* ══════════════════════════════════════════════════════
   5. BULK BAR
══════════════════════════════════════════════════════ */
function ensureBulkBarHist() {
    const tb = document.getElementById('hist-tbody');
    if (!tb) return;
    const card = tb.closest('.card');
    if (!card) return;
    if (document.getElementById('bulk-bar-hist')) return;

    const bar = document.createElement('div');
    bar.id = 'bulk-bar-hist';
    bar.className = 'bulk-bar';
    bar.innerHTML = `
        <div class="bulk-actions">
            <span id="hist-bulk-count" class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>
            <button class="btn btn-danger btn-sm" id="hist-bulk-del">🗑 Supprimer la sélection</button>
            <button class="btn btn-outline btn-sm" id="hist-bulk-reset">↺ Tout désélectionner</button>
        </div>
    `;

    const ref = card.querySelector('.tw') || card.querySelector('.table-wrap') || tb.parentNode;
    if (ref && ref.parentNode === card) {
        card.insertBefore(bar, ref);
    } else {
        card.appendChild(bar);
    }

    const btnDel = bar.querySelector('#hist-bulk-del');
    const btnReset = bar.querySelector('#hist-bulk-reset');
    if (btnDel) btnDel.addEventListener('click', runBulkDeleteHist);
    if (btnReset) btnReset.addEventListener('click', () => {
        if (typeof resetSelection === 'function') resetSelection();
        if (typeof updateBulkBar === 'function') updateBulkBar();
        updateHistBulkCount();
    });
}

function removeBulkBarHist() {
    const bar = document.getElementById('bulk-bar-hist');
    if (bar) bar.remove();
}

function updateHistBulkCount() {
    const span = document.getElementById('hist-bulk-count');
    if (!span) return;
    const checked = document.querySelectorAll('#hist-tbody .row-check:checked');
    span.textContent = checked.length + ' sélectionné(s)';
}

async function runBulkDeleteHist() {
    if (typeof bulkDeleteHist === 'function') {
        return bulkDeleteHist(); // utilise main.js s'il existe
    }
    const checked = document.querySelectorAll('#hist-tbody .row-check:checked');
    const ids = Array.from(checked).map(cb => cb.dataset.id).filter(Boolean);
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
    if (typeof resetSelection === 'function') resetSelection();
    updateHistBulkCount();
}

/* ══════════════════════════════════════════════════════
   6. ÉVÉNEMENTS (délégation — attachée UNE SEULE FOIS)
══════════════════════════════════════════════════════ */
function attachHistTableEvents(tb) {
    if (!tb || tb.dataset.histEvents === '1') return;
    tb.dataset.histEvents = '1';

    tb.addEventListener('change', e => {
        if (e.target.classList.contains('row-check')) {
            const id = e.target.dataset.id;
            if (typeof toggleRow === 'function') toggleRow(id, e.target);
            updateHistBulkCount();
        }
    });

    tb.addEventListener('click', e => {
        const btn = e.target.closest('.btn-del-hist');
        if (btn) {
            e.stopPropagation();
            deleteHistRow(btn.dataset.id);
        }
    });
}

/* ══════════════════════════════════════════════════════
   7. COMPATIBILITÉ INLINE onclick
══════════════════════════════════════════════════════ */
function handleDeleteHist(btn) {
    if (btn && btn.dataset && btn.dataset.id) deleteHistRow(btn.dataset.id);
}

/* ══════════════════════════════════════════════════════
   8. EXPOSITION GLOBALE
══════════════════════════════════════════════════════ */
window.addHistorique = addHistorique;
window.importBulk = importBulk;
window.parseBulkPreview = parseBulkPreview;
window.loadHistoriqueTicker = loadHistoriqueTicker;
window.deleteHistRow = deleteHistRow;
window.deleteAllHistoriqueTicker = deleteAllHistoriqueTicker;
window.handleDeleteHist = handleDeleteHist;
window.runBulkDeleteHist = runBulkDeleteHist;
window.updateHistBulkCount = updateHistBulkCount;
