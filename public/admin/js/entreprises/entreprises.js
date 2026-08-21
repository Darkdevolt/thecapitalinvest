/* ══════════════════════════════════════════════════════
   ENTREPRISES
══════════════════════════════════════════════════════ */
async function loadEntreprises() {
    const rows = await sbGet('entreprises', 'select=*&order=ticker.asc');
    entData = (rows || []).filter(function(r){ return !isIndice(r.ticker); });
    renderEntTable(entData);
}

function renderEntTable(data) {
    data = data || [];
    const tb = document.getElementById('ent-tbody');
    const cnt = document.getElementById('ent-count');
    if(cnt) cnt.textContent = data.length;
    if (!tb) return;
    if (!data.length) { tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px;">Aucune entreprise</td></tr>'; return; }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.ticker + '" onchange="toggleRow(\'' + r.ticker + '\',this)"></td>' +
            '<td class="td-gold">' + r.ticker + '</td>' +
            '<td>' + r.nom + '</td>' +
            '<td class="td-muted">' + (r.secteur||'—') + '</td>' +
            '<td class="td-muted">' + (r.pays||'—') + '</td>' +
            '<td><span class="badge ' + (r.compartiment==='PRESTIGE'?'badge-gold':'badge-blue') + '">' + (r.compartiment||'—') + '</span></td>' +
            '<td class="td-muted">' + (r.isin||'—') + '</td>' +
            '<td><span class="badge badge-green">Actif</span></td>' +
            '<td><button class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditEnt(this)">✎</button> ' +
              '<button class="btn btn-danger btn-sm" data-ticker="' + r.ticker + '" onclick="handleDeleteEnt(this)">✕</button></td>' +
            '</tr>';
    }).join('');

    var card = tb.closest('.card');
    var existingBar = document.getElementById('bulk-bar-ent');
    if (!existingBar && card) {
        var bar = document.createElement('div');
        bar.id = 'bulk-bar-ent';
        bar.className = 'bulk-bar';
        bar.innerHTML = '<div class="bulk-actions">' +
            '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
            '<button class="btn btn-danger btn-sm" onclick="bulkDeleteEnt()">🗑 Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, card.querySelector('.tw'));
    }
    updateBulkBar();
}

function filterEntTable() {
    const f = v('ent-search').toLowerCase();
    renderEntTable(entData.filter(function(r){ return !f || (r.ticker+r.nom+(r.secteur||'')+(r.pays||'')).toLowerCase().indexOf(f) !== -1; }));
}

function openEntModal(row) {
    const title = document.getElementById('modal-ent-title');
    if(title) title.textContent = 'Modifier ' + row.ticker;
    set('modal-ent-ticker', row.ticker);
    set('modal-ent-nom', row.nom); set('modal-ent-secteur', row.secteur);
    set('modal-ent-pays', row.pays); set('modal-ent-compart', row.compartiment);
    set('modal-ent-isin', row.isin); set('modal-ent-actions', row.nombre_actions);
    set('modal-ent-desc', row.description);
    openModal('modal-entreprise');
}

async function saveEntreprise() {
    const ticker = v('modal-ent-ticker');
    const msg    = document.getElementById('modal-ent-msg');
    const body = {
        nom: v('modal-ent-nom'), secteur: v('modal-ent-secteur'), pays: v('modal-ent-pays'),
        compartiment: v('modal-ent-compart'), isin: v('modal-ent-isin'),
        nombre_actions: pi('modal-ent-actions'), description: v('modal-ent-desc')
    };
    const r = await sbPatch('entreprises', 'ticker=eq.' + encodeURIComponent(ticker), body);
    if (r) { if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; } closeModal('modal-entreprise'); loadEntreprises(); }
}

async function addEntreprise() {
    const msg  = document.getElementById('ne-msg');
    const body = {
        ticker: v('ne-ticker'), nom: v('ne-nom'), secteur: v('ne-secteur'), pays: v('ne-pays'),
        compartiment: v('ne-compart'), isin: v('ne-isin'), description: v('ne-desc'), nombre_actions: pi('ne-actions')
    };
    if (!body.ticker || !body.nom) { if(msg){ msg.textContent = 'Ticker et nom obligatoires'; msg.className = 'msg err'; } return; }
    const r = await sbPost('entreprises', body, 'ticker');
    if (r) {
        if(msg){ msg.textContent = '✓ Créée'; msg.className = 'msg ok'; }
        clearForm(['ne-ticker','ne-nom','ne-secteur','ne-isin','ne-desc','ne-actions']);
        loadEntreprises();
    }
}

async function deleteEntreprise(ticker) {
    if (!doubleConfirm("Supprimer l'entreprise " + ticker + " ? Cette action est irréversible.")) return;
    const ok = await sbDel('entreprises', 'ticker=eq.' + encodeURIComponent(ticker));
    if (ok) { toast('Entreprise supprimée'); loadEntreprises(); }
}

/* Référentiel des actions — utilisé par le contrôle Cours / Historique.
   Affiche toujours le code central et le nom de l'entreprise, sans modifier les données de marché. */
(function installMarketActionReference(){
    'use strict';
    var ID='tc-market-action-reference';
    var loaded=false;
    function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
    async function load(){
        try{
            var rows=await sbGet('entreprises','select=ticker,nom,secteur,compartiment&order=ticker.asc');
            rows=(rows||[]).filter(function(r){return r&&r.ticker&&!isIndice(r.ticker);});
            render(rows);
        }catch(e){console.warn('[The Capital] Référentiel actions:',e);}
    }
    function render(rows){
        var panels=[document.getElementById('panel-historique'),document.getElementById('panel-cours')];
        panels.forEach(function(panel){
            if(!panel)return;
            var old=panel.querySelector('#'+ID); if(old)old.remove();
            var card=document.createElement('div');card.id=ID;card.className='card';card.style.marginBottom='16px';
            var options=rows.map(function(r){return '<option value="'+esc(r.ticker)+'">'+esc(r.ticker)+' — '+esc(r.nom||'')+'</option>';}).join('');
            card.innerHTML='<div class="card-header"><span class="card-title">Référentiel des actions</span><span style="font-size:11px;color:var(--muted);margin-left:auto">'+rows.length+' sociétés · Code central + dénomination</span></div>'+
              '<div style="padding:12px 18px 4px"><input id="tc-action-filter" type="search" placeholder="Rechercher une société ou un code…" list="tc-action-list" autocomplete="off" style="width:100%;padding:9px 10px;background:var(--surface);border:1px solid var(--border);color:var(--cream);border-radius:4px;font-size:11px"><datalist id="tc-action-list">'+options+'</datalist></div>'+
              '<div class="tw" style="max-height:280px;overflow:auto"><table><thead><tr><th>Code central</th><th>Entreprise</th><th>Secteur</th><th>Compartiment</th></tr></thead><tbody>'+rows.map(function(r){return '<tr data-search="'+esc((r.ticker+' '+(r.nom||'')+' '+(r.secteur||'')).toLowerCase())+'"><td class="td-gold">'+esc(r.ticker)+'</td><td>'+esc(r.nom||'—')+'</td><td class="td-muted">'+esc(r.secteur||'—')+'</td><td class="td-muted">'+esc(r.compartiment||'—')+'</td></tr>';}).join('')+'</tbody></table></div>';
            panel.insertBefore(card,panel.firstElementChild&&panel.firstElementChild.classList.contains('section-header')?panel.children[1]:panel.firstChild);
            var input=card.querySelector('#tc-action-filter');input.addEventListener('input',function(){var q=(this.value||'').toLowerCase().trim();card.querySelectorAll('tbody tr').forEach(function(tr){tr.style.display=!q||tr.dataset.search.indexOf(q)!==-1?'':'none';});});
        });
        loaded=true;
    }
    function ensure(){if(!loaded)load();}
    document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.admin-tab');if(b)setTimeout(ensure,80);});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else setTimeout(ensure,200);
})();
