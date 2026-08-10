/* ══════════════════════════════════════════════════════
   FINANCIALS
   Validation métier + provenance + workflow de validation
══════════════════════════════════════════════════════ */

function validateFinancialPayload(body, mode) {
    const errors = [];
    const ticker = String(body.ticker || '').trim().toUpperCase();
    const annee = Number(body.annee);
    const periode = String(body.periode || 'annuel').trim();

    if (!ticker) errors.push('Ticker obligatoire.');
    if (!/^[A-Z0-9.\-]{2,20}$/.test(ticker)) errors.push('Ticker invalide : 2 à 20 caractères alphanumériques, point ou tiret.');
    if (!Number.isInteger(annee) || annee < 1900 || annee > 2100) errors.push('Année invalide : 1900–2100.');
    if (!['annuel','S1','S2','Q1','Q2','Q3','Q4','TTM'].includes(periode)) errors.push('Période invalide.');

    const nonNegative = [
        ['chiffre_affaires','Chiffre d’affaires'], ['ebitda','EBITDA'], ['fonds_propres','Fonds propres'],
        ['dettes_financieres','Dettes financières'], ['total_actif','Total actif'], ['cap_boursiere','Capitalisation'],
        ['dpa','DPA'], ['capex','CAPEX'], ['dividend_yield','Dividend yield'], ['rendement_dividende','Rendement dividende'],
        ['payout_ratio','Payout ratio']
    ];
    nonNegative.forEach(function(pair){
        const value = body[pair[0]];
        if (value !== null && value !== undefined && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
            errors.push(pair[1] + ' doit être un nombre positif ou nul.');
        }
    });

    ['nombre_actions','nb_actions'].forEach(function(key){
        const value = body[key];
        if (value !== null && value !== undefined && value !== '' && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
            errors.push(key + ' doit être strictement positif.');
        }
    });

    if (body.source_url && !/^https?:\/\//i.test(String(body.source_url))) errors.push('URL source invalide : elle doit commencer par http:// ou https://.');
    if (body.source_page !== null && body.source_page !== undefined && body.source_page !== '' && (!Number.isInteger(Number(body.source_page)) || Number(body.source_page) < 1)) {
        errors.push('Page source invalide.');
    }
    if (mode === 'create' && !body.source) errors.push('Source obligatoire pour publier une nouvelle donnée financière.');
    return { ok: errors.length === 0, errors: errors };
}

async function ensureFinancialTickerExists(ticker) {
    const rows = await sbGet('entreprises', 'select=ticker&limit=1&ticker=eq.' + encodeURIComponent(String(ticker).trim().toUpperCase()));
    return !!(rows && rows.length);
}

async function loadFinancials() {
    const rows = await sbGet('financials', 'select=*&order=annee.desc,periode.asc&limit=500');
    finData = rows || [];
    renderFinTable(finData);
    const years = [];
    finData.forEach(function(r){ if (years.indexOf(r.annee) === -1) years.push(r.annee); });
    years.sort(function(a,b){ return b-a; });
    const sel = document.getElementById('fin-year-filter');
    if(sel) sel.innerHTML = '<option value="">Toutes années</option>' + years.map(function(y){ return '<option value="' + y + '">' + y + '</option>'; }).join('');
}

function renderFinTable(data) {
    data = data || [];
    const tb = document.getElementById('fin-tbody');
    const cnt = document.getElementById('fin-count');
    if(cnt) cnt.textContent = data.length;
    if (!tb) return;
    if (!data.length) { tb.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:20px;">Aucun financial</td></tr>'; return; }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        const status = r.validation_status || 'draft';
        const statusClass = status==='validated' ? 'badge-green' : status==='rejected' ? 'badge-red' : status==='review' ? 'badge-orange' : 'badge-blue';
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
            '<td class="td-gold">' + (r.ticker||'—') + '</td>' +
            '<td>' + (r.annee||'—') + '</td>' +
            '<td><span class="badge badge-blue">' + (r.periode||'annuel') + '</span></td>' +
            '<td><span class="badge ' + statusClass + '">' + status + '</span></td>' +
            '<td class="r td-mono">' + fmt(r.chiffre_affaires) + '</td>' +
            '<td class="r td-mono">' + fmt(r.rbe) + '</td>' +
            '<td class="r td-mono">' + fmt(r.resultat_net) + '</td>' +
            '<td class="r td-mono">' + fmt(r.bpa) + '</td>' +
            '<td class="r td-mono">' + fmt(r.dpa) + '</td>' +
            '<td class="r td-mono">' + fmt(r.dettes_financieres) + '</td>' +
            '<td class="td-muted">' + (r.source||'—') + '</td>' +
            '<td><button class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditFin(this)">✎</button> ' +
              '<button class="btn btn-danger btn-sm" data-id="' + r.id + '" onclick="handleDeleteFin(this)">✕</button></td>' +
            '</tr>';
    }).join('');

    var card = tb.closest('.card');
    var existingBar = document.getElementById('bulk-bar-fin');
    if (!existingBar && card) {
        var bar = document.createElement('div');
        bar.id = 'bulk-bar-fin';
        bar.className = 'bulk-bar';
        bar.innerHTML = '<div class="bulk-actions">' +
            '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
            '<button class="btn btn-danger btn-sm" onclick="bulkDeleteFin()">🗑 Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, card.querySelector('.tw'));
    }
    updateBulkBar();
}

function filterFinTable() {
    const f = v('fin-filter').toUpperCase();
    const y = v('fin-year-filter');
    renderFinTable(finData.filter(function(r){
        return (!f || (r.ticker||'').indexOf(f) !== -1) && (!y || String(r.annee) === y);
    }));
}

function openFinModal(row) {
    const title = document.getElementById('modal-fin-title');
    if(title) title.textContent = 'Modifier ' + row.ticker + ' ' + row.annee + ' — ' + (row.periode || 'annuel');
    set('modal-fin-id', row.id);
    set('modal-fin-ca', row.chiffre_affaires); set('modal-fin-rbe', row.rbe);
    set('modal-fin-rn', row.resultat_net); set('modal-fin-bpa', row.bpa);
    set('modal-fin-dpa', row.dpa); set('modal-fin-fp', row.fonds_propres);
    set('modal-fin-dettes', row.dettes_financieres); set('modal-fin-actif', row.total_actif);
    set('modal-fin-cfo', row.cash_flow_operationnel); set('modal-fin-capex', row.capex);
    set('modal-fin-source', row.source); set('modal-fin-source-url', row.source_url);
    set('modal-fin-source-page', row.source_page); set('modal-fin-status', row.validation_status || 'draft');
    set('modal-fin-notes', row.validation_notes);
    openModal('modal-financial');
}

async function saveFinancial() {
    const id  = v('modal-fin-id');
    const msg = document.getElementById('modal-fin-msg');
    const body = {
        chiffre_affaires: pf('modal-fin-ca'), rbe: pf('modal-fin-rbe'), resultat_net: pf('modal-fin-rn'),
        bpa: pf('modal-fin-bpa'), dpa: pf('modal-fin-dpa'), fonds_propres: pf('modal-fin-fp'),
        dettes_financieres: pf('modal-fin-dettes'), total_actif: pf('modal-fin-actif'),
        cash_flow_operationnel: pf('modal-fin-cfo'), capex: pf('modal-fin-capex'),
        source: v('modal-fin-source'), source_url: v('modal-fin-source-url'), source_page: pi('modal-fin-source-page'),
        validation_status: v('modal-fin-status') || 'draft', validation_notes: v('modal-fin-notes') || null
    };
    const check = validateFinancialPayload(Object.assign({ ticker: v('modal-fin-ticker') || 'OK', annee: v('modal-fin-annee') || new Date().getFullYear(), periode: v('modal-fin-periode') || 'annuel' }, body), 'update');
    if (!check.ok) { if(msg){ msg.textContent = '⚠ ' + check.errors.join(' '); msg.className = 'msg err'; } return; }
    if (body.validation_status === 'validated') { body.validated_at = new Date().toISOString(); }
    const r = await sbPatch('financials', 'id=eq.' + encodeURIComponent(id), body);
    if (r) { if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; } closeModal('modal-financial'); loadFinancials(); }
}

async function addFinancial() {
    const msg = document.getElementById('fin-msg');
    const body = {
        ticker: v('fin-ticker').toUpperCase(), annee: pi('fin-annee'), periode: v('fin-periode')||'annuel',
        chiffre_affaires: pf('fin-ca'), rbe: pf('fin-rbe'), resultat_net: pf('fin-rn'),
        ebit: pf('fin-ebit'), ebitda: pf('fin-ebitda'), bpa: pf('fin-bpa'), dpa: pf('fin-dpa'),
        fonds_propres: pf('fin-fp'), dettes_financieres: pf('fin-dettes'), dette_nette: pf('fin-dette-nette'),
        total_actif: pf('fin-actif'), nombre_actions: pi('fin-nb-actions'), nb_actions: pi('fin-nb-actions'),
        cash_flow_operationnel: pf('fin-cfo'), capex: pf('fin-capex'), source: v('fin-source'),
        source_url: v('fin-source-url'), source_page: pi('fin-source-page'),
        validation_status: v('fin-status') || 'draft', validation_notes: v('fin-validation-notes') || null
    };
    const check = validateFinancialPayload(body, 'create');
    if (!check.ok) { if(msg){ msg.textContent = '⚠ ' + check.errors.join(' '); msg.className = 'msg err'; } return; }
    const exists = await ensureFinancialTickerExists(body.ticker);
    if (!exists) { if(msg){ msg.textContent = '⚠ Le ticker ' + body.ticker + ' n’existe pas dans Entreprises.'; msg.className = 'msg err'; } return; }
    if (body.validation_status === 'validated') body.validated_at = new Date().toISOString();
    const r = await sbPost('financials', body, 'ticker,annee,periode');
    if (r) {
        if(msg){ msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
        clearForm(['fin-ticker','fin-annee','fin-ca','fin-rbe','fin-rn','fin-ebit','fin-ebitda','fin-dpa','fin-fp','fin-dettes','fin-dette-nette','fin-actif','fin-nb-actions','fin-cfo','fin-capex','fin-source','fin-source-url','fin-source-page','fin-validation-notes']);
        loadFinancials();
    }
}

async function prefillFinancialFromTicker() {
    const ticker = v('fin-ticker').toUpperCase();
    const annee = v('fin-annee');
    if (!ticker) { toast('Entrez un ticker d’abord', 'err'); return; }
    let params = 'select=*&ticker=eq.' + encodeURIComponent(ticker) + '&order=annee.desc&limit=1';
    if (annee) params += '&annee=eq.' + annee;
    const rows = await sbGet('financials', params);
    if (!rows || !rows.length) {
        const ent = await sbGet('entreprises', 'select=nombre_actions,nb_actions&ticker=eq.' + encodeURIComponent(ticker));
        if (ent && ent[0] && (ent[0].nombre_actions || ent[0].nb_actions)) { set('fin-nb-actions', ent[0].nombre_actions || ent[0].nb_actions); toast('Nb. actions chargé depuis entreprises', 'info'); }
        else toast('Aucun financial trouvé pour ' + ticker, 'err');
        return;
    }
    const r = rows[0];
    set('fin-annee', r.annee); set('fin-ca', r.chiffre_affaires); set('fin-rbe', r.rbe);
    set('fin-rn', r.resultat_net); set('fin-ebit', r.ebit); set('fin-ebitda', r.ebitda);
    set('fin-bpa', r.bpa); set('fin-dpa', r.dpa); set('fin-fp', r.fonds_propres);
    set('fin-dettes', r.dettes_financieres); set('fin-dette-nette', r.dette_nette);
    set('fin-actif', r.total_actif); set('fin-nb-actions', r.nombre_actions || r.nb_actions);
    set('fin-cfo', r.cash_flow_operationnel); set('fin-capex', r.capex); set('fin-source', r.source);
    set('fin-source-url', r.source_url); set('fin-source-page', r.source_page); set('fin-validation-notes', r.validation_notes);
    const periodeEl = document.getElementById('fin-periode');
    if (periodeEl && r.periode) periodeEl.value = r.periode;
    const statusEl = document.getElementById('fin-status');
    if (statusEl) statusEl.value = r.validation_status || 'draft';
    toast('Financial ' + r.annee + ' chargé pour ' + ticker, 'ok');
}

async function deleteFinancial(id) {
    if (!doubleConfirm('Supprimer ce financial ?')) return;
    const ok = await sbDel('financials', 'id=eq.' + encodeURIComponent(id));
    if (ok) { toast('Financial supprimé'); loadFinancials(); }
}
