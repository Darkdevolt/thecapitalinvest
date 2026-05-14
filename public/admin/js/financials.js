/* ══════════════════════════════════════════════════════
   FINANCIALS
══════════════════════════════════════════════════════ */
async function loadFinancials() {
    const rows = await sbGet('financials', 'select=*&order=annee.desc&limit=200');
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
    if (!data  Je continue avec les fichiers restants :

---

### 11. `public/admin/js/financials.js` (suite)

```javascript
    if (!data.length) { tb.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:20px;">Aucun financial</td></tr>'; return; }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
            '<td class="td-gold">' + r.ticker + '</td>' +
            '<td>' + r.annee + '</td>' +
            '<td><span class="badge badge-blue">' + (r.periode||'annuel') + '</span></td>' +
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
    if(title) title.textContent = 'Modifier ' + row.ticker + ' ' + row.annee;
    set('modal-fin-id', row.id);
    set('modal-fin-ca', row.chiffre_affaires); set('modal-fin-rbe', row.rbe);
    set('modal-fin-rn', row.resultat_net);     set('modal-fin-bpa', row.bpa);
    set('modal-fin-dpa', row.dpa);             set('modal-fin-fp', row.fonds_propres);
    set('modal-fin-dettes', row.dettes_financieres); set('modal-fin-actif', row.total_actif);
    set('modal-fin-cfo', row.cash_flow_operationnel); set('modal-fin-capex', row.capex);
    set('modal-fin-source', row.source);
    openModal('modal-financial');
}

async function saveFinancial() {
    const id  = v('modal-fin-id');
    const msg = document.getElementById('modal-fin-msg');
    const body = {
        chiffre_affaires: pf('modal-fin-ca'), rbe: pf('modal-fin-rbe'), resultat_net: pf('modal-fin-rn'),
        bpa: pf('modal-fin-bpa'), dpa: pf('modal-fin-dpa'), fonds_propres: pf('modal-fin-fp'),
        dettes_financieres: pf('modal-fin-dettes'), total_actif: pf('modal-fin-actif'),
        cash_flow_operationnel: pf('modal-fin-cfo'), capex: pf('modal-fin-capex'), source: v('modal-fin-source')
    };
    const r = await sbPatch('financials', 'id=eq.' + id, body);
    if (r) { if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; } closeModal('modal-financial'); loadFinancials(); }
}

async function addFinancial() {
    const msg  = document.getElementById('fin-msg');
    const body = {
        ticker: v('fin-ticker'), annee: pi('fin-annee'), periode: v('fin-periode')||'annuel',
        chiffre_affaires: pf('fin-ca'), rbe: pf('fin-rbe'), resultat_net: pf('fin-rn'),
        bpa: pf('fin-bpa'), dpa: pf('fin-dpa'), fonds_propres: pf('fin-fp'),
        dettes_financieres: pf('fin-dettes'), total_actif: pf('fin-actif'),
        nombre_actions: pi('fin-nb-actions'), cash_flow_operationnel: pf('fin-cfo'),
        capex: pf('fin-capex'), source: v('fin-source')
    };
    if (!body.ticker || !body.annee) { if(msg){ msg.textContent = 'Ticker et année obligatoires'; msg.className = 'msg err'; } return; }
    const r = await sbPost('financials', body, 'ticker,annee,periode');
    if (r) {
        if(msg){ msg.textContent = '✓ Enregistré'; msg.className = 'msg ok'; }
        clearForm(['fin-ticker','fin-annee','fin-ca','fin-rbe','fin-rn','fin-bpa','fin-dpa','fin-fp','fin-dettes','fin-actif','fin-nb-actions','fin-cfo','fin-capex','fin-source']);
        loadFinancials();
    }
}

async function prefillFinancialFromTicker() {
    const ticker = v('fin-ticker');
    const annee  = v('fin-annee');
    if (!ticker) { toast('Entrez un ticker d\'abord', 'err'); return; }
    let params = 'select=*&ticker=eq.' + encodeURIComponent(ticker) + '&order=annee.desc&limit=1';
    if (annee) params += '&annee=eq.' + annee;
    const rows = await sbGet('financials', params);
    if (!rows || !rows.length) {
        const ent = await sbGet('entreprises', 'select=nombre_actions&ticker=eq.' + encodeURIComponent(ticker));
        if (ent && ent[0] && ent[0].nombre_actions) { set('fin-nb-actions', ent[0].nombre_actions); toast('Nb. actions chargé depuis entreprises', 'info'); }
        else toast('Aucun financial trouvé pour ' + ticker, 'err');
        return;
    }
    const r = rows[0];
    set('fin-annee', r.annee);       set('fin-ca', r.chiffre_affaires);
    set('fin-rbe', r.rbe);           set('fin-rn', r.resultat_net);
    set('fin-bpa', r.bpa);           set('fin-dpa', r.dpa);
    set('fin-fp', r.fonds_propres);  set('fin-dettes', r.dettes_financieres);
    set('fin-actif', r.total_actif); set('fin-nb-actions', r.nombre_actions);
    set('fin-cfo', r.cash_flow_operationnel); set('fin-capex', r.capex);
    set('fin-source', r.source);
    const periodeEl = document.getElementById('fin-periode');
    if (periodeEl && r.periode) periodeEl.value = r.periode;
    toast('Financial ' + r.annee + ' chargé pour ' + ticker, 'ok');
}

async function deleteFinancial(id) {
    if (!doubleConfirm('Supprimer ce financial ?')) return;
    const ok = await sbDel('financials', 'id=eq.' + id);
    if (ok) { toast('Financial supprimé'); loadFinancials(); }
}
