/* ══════════════════════════════════════════════════════
   UTILISATEURS / CLIENTÈLE
══════════════════════════════════════════════════════ */
async function loadUsers() {
    const rows = await sbGet('users', 'select=*&order=created_at.desc&limit=200');
    usrData = rows || [];
    renderClienteleIntelligence();
    renderUsrTable(usrData);
}

function escUsr(v) {
    return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
}
function clientNum(v) { return Number(v || 0).toLocaleString('fr-FR'); }
function clientPct(a,b) { return b ? ((Number(a||0)/Number(b))*100).toLocaleString('fr-FR',{maximumFractionDigits:1})+' %' : '0 %'; }
function clientMoney(v) { return Number(v||0).toLocaleString('fr-FR'); }

async function loadClienteleSummary() {
    try {
        const data = await fetch(SB_REST + '/rpc/admin_clientele_summary', {
            method:'POST',
            headers:{apikey:SB_ANON,Authorization:'Bearer '+TK,'Content-Type':'application/json'},
            body:'{}'
        });
        if(!data.ok) throw new Error('HTTP '+data.status);
        return await data.json();
    } catch(e) {
        console.warn('[clientele]', e);
        return null;
    }
}

function barChart(items, total, suffix) {
    if(!items || !items.length) return '<div style="padding:18px;color:var(--muted);text-align:center;font-size:11px;">Aucune donnée</div>';
    return '<div class="ci-bars">' + items.map(function(x){
        var value=Number(x.value||0), width=total ? Math.max(2,(value/total)*100) : 0;
        return '<div class="ci-bar-row"><div class="ci-bar-label">'+escUsr(x.label)+'</div><div class="ci-bar-track"><div class="ci-bar-fill" style="width:'+width+'%"></div></div><div class="ci-bar-value">'+clientNum(value)+(suffix||'')+'</div></div>';
    }).join('') + '</div>';
}

function lineChart(items) {
    if(!items || !items.length) return '<div style="padding:18px;color:var(--muted);text-align:center;font-size:11px;">Aucune donnée</div>';
    var max=Math.max.apply(null,items.map(function(x){return Number(x.count||0);})); max=Math.max(max,1);
    var w=720,h=180,p=24;
    var pts=items.map(function(x,i){
        var px=p+(i*Math.max(1,(w-p*2)/Math.max(1,items.length-1)));
        var py=h-p-(Number(x.count||0)/max)*(h-p*2);
        return {x:px,y:py,label:String(x.month||'').slice(5),value:Number(x.count||0)};
    });
    var path=pts.map(function(pt,i){return (i?'L':'M')+pt.x.toFixed(1)+' '+pt.y.toFixed(1);}).join(' ');
    var dots=pts.map(function(pt){return '<circle cx="'+pt.x.toFixed(1)+'" cy="'+pt.y.toFixed(1)+'" r="3" fill="var(--gold)"><title>'+escUsr(pt.label)+': '+clientNum(pt.value)+'</title></circle>';}).join('');
    var labels=pts.map(function(pt,i){return (i===0||i===pts.length-1||i%2===0)?'<text x="'+pt.x.toFixed(1)+'" y="'+(h-5)+'" text-anchor="middle" fill="var(--muted)" font-size="9">'+escUsr(pt.label)+'</text>':'';}).join('');
    return '<svg viewBox="0 0 '+w+' '+h+'" class="ci-line" role="img" aria-label="Evolution mensuelle des inscriptions"><path d="'+path+'" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots+labels+'</svg>';
}

function renderClienteleIntelligence() {
    var panel=document.getElementById('panel-utilisateurs');
    if(!panel || document.getElementById('clientele-intelligence')) return;
    var anchor=panel.querySelector('.section-header');
    var box=document.createElement('div'); box.id='clientele-intelligence';
    box.innerHTML='<div class="ci-loading">Chargement de l\'intelligence clientèle…</div>';
    if(anchor) anchor.insertAdjacentElement('afterend',box); else panel.prepend(box);
    fetchClienteleInto(box);
}

async function fetchClienteleInto(box) {
    var d=await loadClienteleSummary();
    if(!d){box.innerHTML='<div class="card"><div style="padding:18px;color:var(--muted);">Impossible de charger les indicateurs clientèle.</div></div>';return;}
    var plans=[{label:'Free',value:d.free},{label:'Pro',value:d.pro},{label:'Elite',value:d.elite}];
    var engagement=[{label:'Actifs 30 jours',value:d.active_30d},{label:'Actifs 90 jours',value:d.active_90d},{label:'Inactifs 90+ jours',value:d.inactive_90d},{label:'Jamais connectés',value:d.never_connected}];
    box.innerHTML='<style>'+
      '#clientele-intelligence{display:flex;flex-direction:column;gap:14px;margin-bottom:18px}.ci-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.ci-kpi{background:var(--card);border:1px solid var(--border);border-radius:7px;padding:13px}.ci-kpi label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}.ci-kpi b{display:block;font-family:var(--mono);font-size:21px;color:var(--gold);margin-top:6px}.ci-kpi small{display:block;color:var(--muted);font-size:9px;margin-top:3px}.ci-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ci-card{background:var(--card);border:1px solid var(--border);border-radius:7px;overflow:hidden}.ci-head{padding:12px 14px;border-bottom:1px solid var(--border-s);display:flex;justify-content:space-between;align-items:center}.ci-head strong{font-family:var(--serif);font-size:16px}.ci-head span{font-size:9px;color:var(--muted)}.ci-body{padding:14px}.ci-bars{display:flex;flex-direction:column;gap:11px}.ci-bar-row{display:grid;grid-template-columns:105px 1fr 48px;gap:8px;align-items:center}.ci-bar-label,.ci-bar-value{font-size:10px}.ci-bar-value{text-align:right;font-family:var(--mono)}.ci-bar-track{height:7px;background:rgba(245,240,232,.06);border-radius:5px;overflow:hidden}.ci-bar-fill{height:100%;background:var(--gold);border-radius:5px}.ci-line{width:100%;height:180px;display:block}.ci-note{font-size:10px;color:var(--muted);line-height:1.5;margin-top:10px}.ci-loading{padding:18px;background:var(--card);border:1px solid var(--border);border-radius:7px;color:var(--muted);font-size:11px}@media(max-width:1050px){.ci-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.ci-grid{grid-template-columns:1fr}.ci-kpis{grid-template-columns:1fr 1fr}.ci-bar-row{grid-template-columns:85px 1fr 40px}}@media(max-width:480px){.ci-kpis{grid-template-columns:1fr 1fr}.ci-kpi b{font-size:18px}}</style>'+
      '<div class="ci-kpis">'+
        '<div class="ci-kpi"><label>Clientèle totale</label><b>'+clientNum(d.total)+'</b><small>comptes enregistrés</small></div>'+
        '<div class="ci-kpi"><label>Payants actifs</label><b>'+clientNum(d.paid_active)+'</b><small>'+clientPct(d.paid_active,d.total)+' de la base</small></div>'+
        '<div class="ci-kpi"><label>Actifs 30 jours</label><b>'+clientNum(d.active_30d)+'</b><small>'+clientPct(d.active_30d,d.total)+' de la base</small></div>'+
        '<div class="ci-kpi"><label>Nouveaux 30 jours</label><b>'+clientNum(d.new_30d)+'</b><small>'+clientNum(d.new_90d)+' sur 90 jours</small></div>'+
        '<div class="ci-kpi"><label>À renouveler</label><b>'+clientNum(d.expiring_30d)+'</b><small>dans les 30 prochains jours</small></div>'+
        '<div class="ci-kpi"><label>Inactifs 90+ jours</label><b>'+clientNum(d.inactive_90d)+'</b><small>'+clientPct(d.inactive_90d,d.total)+' de la base</small></div>'+ 
      '</div>'+ 
      '<div class="ci-grid">'+
        '<div class="ci-card"><div class="ci-head"><strong>Mix clientèle</strong><span>répartition par plan</span></div><div class="ci-body">'+barChart(plans,d.total)+'</div></div>'+ 
        '<div class="ci-card"><div class="ci-head"><strong>Engagement</strong><span>activité récente</span></div><div class="ci-body">'+barChart(engagement,d.total)+'</div></div>'+ 
        '<div class="ci-card"><div class="ci-head"><strong>Acquisition</strong><span>12 derniers mois</span></div><div class="ci-body">'+lineChart(d.registrations)+'</div></div>'+ 
        '<div class="ci-card"><div class="ci-head"><strong>Connexions</strong><span>12 derniers mois</span></div><div class="ci-body">'+lineChart(d.last_signins)+'</div></div>'+ 
      '</div>'+ 
      '<div class="ci-card"><div class="ci-head"><strong>Lecture commerciale</strong><span>indicateurs calculés depuis la table utilisateurs</span></div><div class="ci-body"><div class="ci-note"><strong>'+clientNum(d.paid_active)+'</strong> abonnements payants actuellement actifs · <strong>'+clientNum(d.expired_paid)+'</strong> abonnements payants expirés · <strong>'+clientNum(d.expiring_30d)+'</strong> arrivent à échéance sous 30 jours · <strong>'+clientNum(d.never_connected)+'</strong> comptes n\'ont encore jamais enregistré de connexion. Ces indicateurs sont descriptifs : aucun chiffre de chiffre d\'affaires client n\'est inventé sans donnée tarifaire ou transactionnelle.</div></div></div>';
}

function renderUsrTable(data) {
    data = data || [];
    const tb = document.getElementById('usr-tbody');
    const cnt = document.getElementById('usr-count');
    if(cnt) cnt.textContent = data.length;
    if (!tb) return;
    if (!data.length) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">Aucun utilisateur</td></tr>'; return; }
    resetSelection();
    tb.innerHTML = data.map(function(r){
        return '<tr>' +
            '<td><input type="checkbox" class="row-check" data-id="' + r.id + '" onchange="toggleRow(\'' + r.id + '\',this)"></td>' +
            '<td>' + r.email + '</td>' +
            '<td>' + (r.nom||'—') + '</td>' +
            '<td><span class="badge ' + (r.plan==='elite'?'badge-gold':r.plan==='pro'?'badge-blue':'badge-green') + '">' + (r.plan||'free') + '</span></td>' +
            '<td class="td-muted">' + fmtDate(r.plan_expire_at) + '</td>' +
            '<td>' + (r.is_admin?'✓':'—') + '</td>' +
            '<td class="td-muted">' + fmtDate(r.created_at) + '</td>' +
            '<td><button class="btn btn-outline btn-sm" data-row="' + encodeURIComponent(JSON.stringify(r)) + '" onclick="handleEditUsr(this)">✎</button></td>' +
            '</tr>';
    }).join('');

    var card = tb.closest('.card');
    var existingBar = document.getElementById('bulk-bar-usr');
    if (!existingBar && card) {
        var bar = document.createElement('div');
        bar.id = 'bulk-bar-usr';
        bar.className = 'bulk-bar';
        bar.innerHTML = '<div class="bulk-actions">' +
            '<span class="bulk-count" style="font-size:12px;color:var(--muted);">0 sélectionné(s)</span>' +
            '<button class="btn btn-danger btn-sm" onclick="bulkDeleteUsr()">🗑 Supprimer la sélection</button>' +
            '<button class="btn btn-outline btn-sm" onclick="resetSelection();updateBulkBar();">↺ Tout désélectionner</button>' +
            '</div>';
        card.insertBefore(bar, card.querySelector('.tw'));
    }
    updateBulkBar();
}

function filterUsrTable() {
    const f = v('usr-search').toLowerCase();
    const p = v('usr-plan-filter');
    renderUsrTable(usrData.filter(function(r){
        return (!f || (r.email+(r.nom||'')).toLowerCase().indexOf(f) !== -1) && (!p || r.plan === p);
    }));
}

function openUsrModal(row) {
    set('modal-usr-id', row.id);
    set('modal-usr-plan',   row.plan||'free');
    set('modal-usr-expiry', row.plan_expire_at ? row.plan_expire_at.split('T')[0] : '');
    set('modal-usr-nom',    row.nom);
    set('modal-usr-admin',  String(row.is_admin));
    openModal('modal-user');
}

async function saveUser() {
    const id  = v('modal-usr-id');
    const msg = document.getElementById('modal-usr-msg');
    const body = {
        plan: v('modal-usr-plan'), plan_expire_at: v('modal-usr-expiry')||null,
        nom: v('modal-usr-nom'), is_admin: v('modal-usr-admin') === 'true'
    };
    const r = await sbPatch('users', 'id=eq.' + id, body);
    if (r) { if(msg){ msg.textContent = '✓ Modifié'; msg.className = 'msg ok'; } closeModal('modal-user'); loadUsers(); }
}
