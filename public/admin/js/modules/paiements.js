'use strict';
/* ============================================================
   PAIEMENTS — commandes (Wave / virement / mobile money) et reçus
   envoyés par les clients.
   - Valider un reçu : fonction SQL review_payment_proof (contrôlée
     côté base), qui ouvre l'accès pour la période payée.
   - Confirmer une commande sans reçu (encaissement constaté dans Wave
     Business) : /api/user-data?mode=admin-billing, action confirm_order.
   Les reçus s'affichent dans l'administration via un lien signé.
   ============================================================ */
(function (TC) {
  const BILLING = '/api/user-data?mode=admin-billing';
  const PLANS = { investor: 'Investor', pro: 'Professional', elite: 'Elite', institute: 'Institute' };
  const PERIODS = { weekly: 'hebdo', monthly: 'mensuel', quarterly: 'trimestriel', semiannual: 'semestriel', annual: 'annuel' };
  let orders = [], proofs = [], users = {};
  const esc = v => TC.esc(v == null ? '' : String(v));
  const money = v => new Intl.NumberFormat('fr-FR').format(Number(v) || 0) + ' FCFA';
  const dt = v => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const ST = {
    pending: ['À vérifier', 'badge-orange'], needs_info: ['Infos demandées', 'badge-orange'], approved: ['Validé', 'badge-green'], rejected: ['Rejeté', 'badge-red'],
    processing: ['En cours', 'badge-orange'], successful: ['Payée', 'badge-green'], failed: ['Échouée', 'badge-red'], cancelled: ['Annulée', 'badge-grey'], refunded: ['Remboursée', 'badge-grey']
  };
  const ORDER_WAIT = ['En attente de paiement', 'badge-orange'];
  const badge = (s, order) => { const x = order && s === 'pending' ? ORDER_WAIT : ST[s] || [s || '—', 'badge-grey']; return '<span class="badge ' + x[1] + '">' + esc(x[0]) + '</span>'; };
  const isMaster = () => String(TC.session?.user?.email || '').trim().toLowerCase() === 'diopibrahimabdallah@gmail.com';

  function view() {
    return '<div class="page-head"><div><div class="page-title">Paiements <em>& reçus</em></div><div class="page-sub">Commandes passées depuis la page de paiement et reçus envoyés par les clients. Vérifiez l’encaissement dans votre compte Wave Business (référence + montant exact), puis validez : l’accès du client s’ouvre immédiatement.</div></div><div class="page-actions"><button class="btn btn-outline btn-sm" id="pay-reload">↺</button></div></div>' +
      '<div class="kpis" id="pay-kpis"></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Reçus envoyés par les clients</span><span class="card-tools"><select id="pay-filter"><option value="todo">À traiter</option><option value="">Tous</option><option value="approved">Validés</option><option value="rejected">Rejetés</option></select><span class="card-count" id="pay-count"></span></span></div>' +
      '<div class="tw capped"><table><thead><tr><th>Date</th><th>Client</th><th>Formule</th><th>Montant commande</th><th>Montant déclaré</th><th>Référence</th><th>Statut</th><th></th></tr></thead><tbody id="pay-tbody">' + TC.rowsLoading(8) + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Commandes</span><span class="card-tools"><select id="ord-filter"><option value="open">En attente de paiement</option><option value="">Toutes</option><option value="successful">Payées</option><option value="cancelled">Annulées</option></select><span class="card-count" id="ord-count"></span></span></div><div class="tw capped"><table><thead><tr><th>Date</th><th>Client</th><th>Formule</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Reçu</th><th></th></tr></thead><tbody id="ord-tbody">' + TC.rowsLoading(8) + '</tbody></table></div></div>';
  }

  async function load() {
    try {
      const [o, p, u] = await Promise.all([
        TC.get('payment_orders', 'select=*&order=created_at.desc&limit=500'),
        TC.get('payment_proofs', 'select=*&order=created_at.desc&limit=500'),
        TC.getAll('users', 'select=id,email,nom')
      ]);
      orders = o || []; proofs = p || [];
      users = Object.fromEntries((u || []).map(x => [x.id, x]));
      paint();
    } catch (e) {
      TC.el('pay-tbody').innerHTML = TC.rowsEmpty(8, 'Paiements indisponibles', e.message || '');
      TC.el('ord-tbody').innerHTML = TC.rowsEmpty(8, 'Commandes indisponibles', '');
    }
  }

  const who = id => { const x = users[id]; return x ? '<a href="#" data-client="' + esc(id) + '"><strong>' + esc(x.nom || x.email) + '</strong></a><br><span class="td-muted">' + esc(x.email) + '</span>' : '<span class="td-muted">' + esc(id) + '</span>'; };
  const orderOf = p => orders.find(o => o.id === p.payment_order_id) || {};
  const proofsOf = o => proofs.filter(p => p.payment_order_id === o.id);
  const stale = o => o.status === 'pending' && Date.parse(o.created_at) < Date.now() - 2 * 86400000;

  function paint() {
    const paid = orders.filter(o => o.status === 'successful');
    const month = Date.now() - 30 * 86400000;
    const todo = proofs.filter(p => p.status === 'pending' || p.status === 'needs_info');
    const open = orders.filter(o => o.status === 'pending' || o.status === 'processing');
    TC.el('pay-kpis').innerHTML =
      '<div class="kpi clickable" data-kf="todo"><div class="kpi-label">Reçus à traiter</div><div class="kpi-value sm">' + todo.length + '</div></div>' +
      '<div class="kpi clickable" data-kf="open"><div class="kpi-label">Commandes en attente</div><div class="kpi-value sm">' + open.length + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Encaissé 30 j</div><div class="kpi-value sm">' + money(paid.filter(o => Date.parse(o.paid_at || o.created_at) > month).reduce((s, o) => s + Number(o.amount || 0), 0)) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Encaissé total</div><div class="kpi-value sm">' + money(paid.reduce((s, o) => s + Number(o.amount || 0), 0)) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Commandes payées</div><div class="kpi-value sm">' + paid.length + ' / ' + orders.length + '</div></div>';
    const f = TC.val('pay-filter');
    const list = proofs.filter(p => f === 'todo' ? (p.status === 'pending' || p.status === 'needs_info') : !f || p.status === f);
    TC.el('pay-count').textContent = list.length + ' reçu(s)';
    TC.el('pay-tbody').innerHTML = list.length ? list.map(p => {
      const o = orderOf(p);
      const gap = o.amount != null && p.claimed_amount != null && Number(o.amount) !== Number(p.claimed_amount);
      return '<tr' + (gap ? ' class="row-warn"' : '') + '><td class="td-mono">' + dt(p.created_at) + '</td><td>' + who(p.user_id) + '</td><td>' + esc(PLANS[o.plan_code] || o.plan_code || '—') + ' <span class="td-muted">' + esc(PERIODS[o.billing_period] || '') + '</span></td>' +
        '<td class="td-mono">' + money(o.amount) + '</td><td class="td-mono">' + money(p.claimed_amount) + (gap ? ' <span class="badge badge-orange">écart</span>' : '') + '</td><td class="td-mono td-muted">' + esc(p.transaction_reference || '—') + '</td><td>' + badge(p.status) + '</td>' +
        '<td class="r">' + (p.storage_path ? '<button class="btn btn-outline btn-sm" data-receipt="' + esc(p.id) + '">Reçu</button> ' : '') + '<button class="btn btn-primary btn-sm" data-review="' + esc(p.id) + '">Examiner</button></td></tr>';
    }).join('') : TC.rowsEmpty(8, f === 'todo' ? 'Aucun reçu en attente' : 'Aucun reçu', f === 'todo' ? 'Tout est à jour.' : '');
    const of = TC.val('ord-filter');
    const olist = orders.filter(o => of === 'open' ? (o.status === 'pending' || o.status === 'processing') : !of || o.status === of);
    TC.el('ord-count').textContent = olist.length + ' commande(s)';
    TC.el('ord-tbody').innerHTML = olist.length ? olist.map(o => {
      const pr = proofsOf(o);
      const actions = isMaster() && o.status !== 'successful' && o.status !== 'cancelled' ? '<button class="btn btn-green btn-sm" data-confirm="' + esc(o.id) + '">Confirmer le paiement</button> <button class="btn btn-outline btn-sm" data-cancel="' + esc(o.id) + '">Annuler</button>' : '';
      return '<tr' + (stale(o) ? ' class="row-warn" title="En attente depuis plus de 2 jours"' : '') + '><td class="td-mono">' + dt(o.created_at) + '</td><td>' + who(o.user_id) + '</td><td>' + esc(PLANS[o.plan_code] || o.plan_code) + ' <span class="td-muted">' + esc(PERIODS[o.billing_period] || o.billing_period || '') + '</span></td><td class="td-mono">' + money(o.amount) + '</td><td>' + esc(o.provider || '—') + (o.provider_reference ? '<br><span class="td-muted td-mono" style="font-size:11px">' + esc(o.provider_reference) + '</span>' : '') + '</td><td>' + badge(o.status, true) + (o.paid_at ? '<br><span class="td-muted" style="font-size:11px">le ' + dt(o.paid_at) + '</span>' : '') + '</td>' +
        '<td>' + (pr.length ? pr.map(p => '<button class="btn btn-outline btn-sm" data-review="' + esc(p.id) + '">' + (ST[p.status] || [p.status])[0] + '</button>').join(' ') : '<span class="td-muted">aucun</span>') + '</td><td class="r">' + actions + '</td></tr>';
    }).join('') : TC.rowsEmpty(8, 'Aucune commande', of === 'open' ? 'Aucune commande en attente de paiement.' : 'Les commandes apparaissent ici dès qu’un client lance un paiement.');
  }

  function review(id) {
    const p = proofs.find(x => x.id === id);
    if (!p) return;
    const o = orderOf(p), u = users[p.user_id] || {};
    const done = p.status === 'approved' || p.status === 'rejected';
    const gap = o.amount != null && Number(o.amount) !== Number(p.claimed_amount);
    TC.modal.open({
      title: (PLANS[o.plan_code] || o.plan_code || 'Commande') + ' ' + (PERIODS[o.billing_period] || '') + ' — ' + money(o.amount),
      subtitle: (u.nom ? u.nom + ' · ' : '') + (u.email || p.user_id) + ' · reçu du ' + dt(p.created_at),
      saveLabel: 'J’ai vérifié : valider et activer', readonly: done,
      body: '<div style="padding:16px 24px">' +
        (done ? '' : '<div class="note" style="margin-bottom:12px"><strong>Vérification :</strong> 1) ouvrez le reçu ; 2) dans Wave Business, retrouvez la référence <strong>' + esc(p.transaction_reference || '—') + '</strong> ; 3) contrôlez que le montant reçu est bien <strong>' + money(o.amount) + '</strong>. Validez seulement si les trois concordent.</div>') +
        '<dl class="kv"><dt>Montant de la commande</dt><dd>' + money(o.amount) + '</dd><dt>Montant déclaré</dt><dd>' + money(p.claimed_amount) + (gap ? ' <span class="badge badge-orange">écart avec la commande</span>' : '') + '</dd><dt>Référence</dt><dd class="td-mono">' + esc(p.transaction_reference || 'non fournie') + '</dd><dt>Commande</dt><dd class="td-mono">' + esc(o.id || '—') + ' · ' + badge(o.status, true) + '</dd><dt>Note du client</dt><dd>' + esc(p.note || '—') + '</dd><dt>Statut du reçu</dt><dd>' + badge(p.status) + (p.reviewer_note ? ' — ' + esc(p.reviewer_note) : '') + '</dd></dl>' +
        (p.storage_path ? '<div id="pr-preview" class="receipt-view"><div class="loading"><div class="spinner"></div>Chargement du reçu…</div></div>' : '<div class="note err" style="margin-top:12px">Aucun fichier joint.</div>') +
        (done ? '' : '<div class="field wide" style="margin-top:14px"><label for="pr-note">Note (visible dans l’historique, envoyée au client en cas de rejet ou de demande)</label><textarea id="pr-note" rows="2"></textarea></div><div class="cl-actions"><button class="btn btn-danger btn-sm" id="pr-reject">Rejeter</button><button class="btn btn-orange btn-sm" id="pr-info">Demander des précisions</button></div>') + '</div>',
      afterOpen() {
        TC.on('pr-reject', 'click', () => decide(p, 'rejected'));
        TC.on('pr-info', 'click', () => decide(p, 'needs_info'));
        if (p.storage_path) {
          TC.api(BILLING + '&receipt=' + encodeURIComponent(p.id), { timeout: 15000 }).then(r => {
            const x = r.data || {}, box = TC.el('pr-preview');
            if (box) box.innerHTML = (x.kind === 'pdf' ? '<iframe src="' + esc(x.url) + '" title="Reçu PDF"></iframe>' : '<a href="' + esc(x.url) + '" target="_blank" rel="noopener"><img src="' + esc(x.url) + '" alt="Reçu envoyé par le client"></a>') + '<div class="cl-actions"><a class="btn btn-outline btn-sm" href="' + esc(x.url) + '" target="_blank" rel="noopener">Ouvrir en grand ↗</a></div>';
          }).catch(e => { const box = TC.el('pr-preview'); if (box) box.innerHTML = '<div class="note err">Reçu illisible : ' + esc(e.message) + '</div>'; });
        }
      },
      onSave() { decide(p, 'approved'); }
    });
  }

  async function decide(p, decision) {
    const note = TC.val('pr-note') || null;
    if (decision === 'approved' && !confirm('Le montant a bien été reçu ? Valider ce paiement et activer l’accès du client ?')) return;
    if (decision !== 'approved' && !note) return TC.modal.msg('Ajoutez une note : elle explique au client ce qui ne va pas.', 'err');
    try {
      await TC.rpc('review_payment_proof', { p_proof_id: p.id, p_reviewer_id: TC.session.user.id, p_decision: decision, p_reviewer_note: note });
      TC.modal.close();
      TC.toast(decision === 'approved' ? 'Paiement validé, accès activé' : decision === 'rejected' ? 'Reçu rejeté' : 'Précisions demandées', 'ok');
      const o = orderOf(p);
      TC.api('/api/user-data?mode=admin-users', { method: 'POST', timeout: 15000,
        body: { action: 'notify', user_id: p.user_id, kind: decision === 'approved' ? 'subscription_active' : decision === 'rejected' ? 'payment_rejected' : 'payment_info', plan_name: PLANS[o.plan_code] || o.plan_code, note } })
        .then(r => { if (r.data?.sent) TC.toast('Client prévenu par e-mail', 'ok'); }).catch(() => {});
      load();
    } catch (e) { TC.modal.msg(e.message, 'err'); }
  }

  function confirmOrder(id) {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    if (typeof TC.openConfirmOrder === 'function') TC.openConfirmOrder(o, users[o.user_id] || {}, load);
  }
  function cancelOrder(id) {
    if (!confirm('Annuler cette commande non payée ?')) return;
    TC.api(BILLING, { method: 'POST', body: { action: 'cancel_order', order_id: id }, timeout: 15000 })
      .then(() => { TC.toast('Commande annulée', 'ok'); load(); }).catch(e => TC.toast(e.message, 'err'));
  }

  function onClick(e) {
    const t = e.target;
    const c = t.closest('[data-client]'); if (c) { e.preventDefault(); if (TC.openClient) TC.openClient(c.dataset.client); return; }
    const r = t.closest('[data-review]'); if (r) { review(r.dataset.review); return; }
    const rc = t.closest('[data-receipt]'); if (rc) { if (TC.showReceipt) TC.showReceipt(rc.dataset.receipt); return; }
    const cf = t.closest('[data-confirm]'); if (cf) { confirmOrder(cf.dataset.confirm); return; }
    const cn = t.closest('[data-cancel]'); if (cn) { cancelOrder(cn.dataset.cancel); return; }
  }

  TC.register({
    id: 'paiements', label: 'Paiements', group: 'gestion', icon: '₣',
    keywords: 'paiements reçus wave commandes encaissement validation revenus confirmer',
    view, refresh: load,
    mount() {
      TC.on('pay-reload', 'click', load);
      TC.on('pay-filter', 'change', paint);
      TC.on('ord-filter', 'change', paint);
      TC.on('pay-kpis', 'click', e => { const k = e.target.closest('[data-kf]'); if (!k) return; if (k.dataset.kf === 'todo') TC.setVal('pay-filter', 'todo'); else TC.setVal('ord-filter', 'open'); paint(); });
      TC.on('pay-tbody', 'click', onClick);
      TC.on('ord-tbody', 'click', onClick);
      load();
    }
  });
})(window.TC);
