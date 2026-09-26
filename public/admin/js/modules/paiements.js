'use strict';
/* ============================================================
   PAIEMENTS — commandes Wave / virement et reçus envoyés par les
   clients. Valider un reçu active l'abonnement (fonction SQL
   review_payment_proof, contrôlée côté base).
   ============================================================ */
(function (TC) {
  const PLANS = { investor: 'Investor', pro: 'Pro', elite: 'Elite', institute: 'Institute' };
  let orders = [], proofs = [], users = {};
  const esc = v => TC.esc(v == null ? '' : String(v));
  const money = v => new Intl.NumberFormat('fr-FR').format(Number(v) || 0) + ' FCFA';
  const dt = v => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const ST = {
    pending: ['À vérifier', 'badge-orange'], needs_info: ['Infos demandées', 'badge-orange'], approved: ['Validé', 'badge-green'], rejected: ['Rejeté', 'badge-red'],
    processing: ['En cours', 'badge-orange'], successful: ['Payé', 'badge-green'], failed: ['Échoué', 'badge-red'], created: ['Créée', 'badge-grey'], expired: ['Expirée', 'badge-grey'], cancelled: ['Annulée', 'badge-grey']
  };
  const badge = s => { const x = ST[s] || [s || '—', 'badge-grey']; return '<span class="badge ' + x[1] + '">' + esc(x[0]) + '</span>'; };

  function view() {
    return '<div class="page-head"><div><div class="page-title">Paiements <em>& reçus</em></div><div class="page-sub">Commandes passées depuis la page de paiement et reçus envoyés par les clients. Valider un reçu active immédiatement l’abonnement correspondant.</div></div><div class="page-actions"><button class="btn btn-outline btn-sm" id="pay-reload">↺</button></div></div>' +
      '<div class="kpis" id="pay-kpis"></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Reçus à traiter</span><span class="card-tools"><select id="pay-filter"><option value="todo">À traiter</option><option value="">Tous</option><option value="approved">Validés</option><option value="rejected">Rejetés</option></select><span class="card-count" id="pay-count"></span></span></div>' +
      '<div class="tw capped"><table><thead><tr><th>Date</th><th>Client</th><th>Formule</th><th>Montant commande</th><th>Montant déclaré</th><th>Référence</th><th>Statut</th><th></th></tr></thead><tbody id="pay-tbody">' + TC.rowsLoading(8) + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Toutes les commandes</span><span class="card-count" id="ord-count"></span></div><div class="tw capped"><table><thead><tr><th>Date</th><th>Client</th><th>Formule</th><th>Période</th><th>Montant</th><th>Moyen</th><th>Statut</th></tr></thead><tbody id="ord-tbody">' + TC.rowsLoading(7) + '</tbody></table></div></div>';
  }

  async function load() {
    const [o, p, u] = await Promise.all([
      TC.get('payment_orders', 'select=*&order=created_at.desc&limit=500'),
      TC.get('payment_proofs', 'select=*&order=created_at.desc&limit=500'),
      TC.getAll('users', 'select=id,email,nom')
    ]);
    orders = o || []; proofs = p || [];
    users = Object.fromEntries((u || []).map(x => [x.id, x]));
    paint();
  }

  const who = id => { const x = users[id]; return x ? '<strong>' + esc(x.nom || x.email) + '</strong><br><span class="td-muted">' + esc(x.email) + '</span>' : '<span class="td-muted">' + esc(id) + '</span>'; };
  const orderOf = p => orders.find(o => o.id === p.payment_order_id) || {};

  function paint() {
    const paid = orders.filter(o => o.status === 'successful');
    const month = Date.now() - 30 * 86400000;
    const todo = proofs.filter(p => p.status === 'pending' || p.status === 'needs_info');
    TC.el('pay-kpis').innerHTML =
      '<div class="kpi"><div class="kpi-label">Reçus à traiter</div><div class="kpi-value sm">' + todo.length + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Encaissé 30 j</div><div class="kpi-value sm">' + money(paid.filter(o => Date.parse(o.paid_at || o.created_at) > month).reduce((s, o) => s + Number(o.amount || 0), 0)) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Encaissé total</div><div class="kpi-value sm">' + money(paid.reduce((s, o) => s + Number(o.amount || 0), 0)) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Commandes</div><div class="kpi-value sm">' + orders.length + '</div></div>';
    const f = TC.val('pay-filter');
    const list = proofs.filter(p => f === 'todo' ? (p.status === 'pending' || p.status === 'needs_info') : !f || p.status === f);
    TC.el('pay-count').textContent = list.length + ' reçu(s)';
    TC.el('pay-tbody').innerHTML = list.length ? list.map(p => {
      const o = orderOf(p);
      const gap = o.amount != null && p.claimed_amount != null && Number(o.amount) !== Number(p.claimed_amount);
      return '<tr' + (gap ? ' class="row-warn"' : '') + '><td class="td-mono">' + dt(p.created_at) + '</td><td>' + who(p.user_id) + '</td><td>' + esc(PLANS[o.plan_code] || o.plan_code || '—') + ' <span class="td-muted">' + esc(o.billing_period || '') + '</span></td>' +
        '<td class="td-mono">' + money(o.amount) + '</td><td class="td-mono">' + money(p.claimed_amount) + (gap ? ' <span class="badge badge-orange">écart</span>' : '') + '</td><td class="td-mono td-muted">' + esc(p.transaction_reference || '—') + '</td><td>' + badge(p.status) + '</td>' +
        '<td class="r"><button class="btn btn-outline btn-sm" data-review="' + esc(p.id) + '">Examiner</button></td></tr>';
    }).join('') : TC.rowsEmpty(8, f === 'todo' ? 'Aucun reçu en attente' : 'Aucun reçu', f === 'todo' ? 'Tout est à jour.' : '');
    TC.el('ord-count').textContent = orders.length + ' commande(s)';
    TC.el('ord-tbody').innerHTML = orders.length ? orders.map(o => '<tr><td class="td-mono">' + dt(o.created_at) + '</td><td>' + who(o.user_id) + '</td><td>' + esc(PLANS[o.plan_code] || o.plan_code) + '</td><td>' + esc(o.billing_period || '—') + '</td><td class="td-mono">' + money(o.amount) + '</td><td>' + esc(o.provider || '—') + '</td><td>' + badge(o.status) + '</td></tr>').join('') : TC.rowsEmpty(7, 'Aucune commande', 'Les commandes apparaissent ici dès qu’un client lance un paiement.');
  }

  async function receipt(p) {
    if (!p.storage_path) return;
    try {
      await TC.ensureToken();
      const r = await fetch(TC.env.SUPABASE_URL + '/storage/v1/object/authenticated/payment-proofs/' + p.storage_path, { headers: { apikey: TC.env.SUPABASE_ANON, Authorization: 'Bearer ' + TC.session.token } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const url = URL.createObjectURL(await r.blob());
      window.open(url, '_blank', 'noopener');
    } catch (e) { TC.toast('Reçu illisible : ' + e.message, 'err'); }
  }

  function review(id) {
    const p = proofs.find(x => x.id === id);
    if (!p) return;
    const o = orderOf(p), u = users[p.user_id] || {};
    const done = p.status === 'approved' || p.status === 'rejected';
    TC.modal.open({
      title: (PLANS[o.plan_code] || o.plan_code || 'Commande') + ' — ' + money(o.amount),
      subtitle: (u.email || p.user_id) + ' · reçu du ' + dt(p.created_at),
      saveLabel: 'Valider le paiement', readonly: done,
      body: '<div style="padding:16px 24px"><dl class="kv"><dt>Montant de la commande</dt><dd>' + money(o.amount) + '</dd><dt>Montant déclaré</dt><dd>' + money(p.claimed_amount) + '</dd><dt>Référence</dt><dd>' + esc(p.transaction_reference || 'non fournie') + '</dd><dt>Période</dt><dd>' + esc(o.billing_period || '—') + '</dd><dt>Note du client</dt><dd>' + esc(p.note || '—') + '</dd><dt>Statut</dt><dd>' + badge(p.status) + (p.reviewer_note ? ' — ' + esc(p.reviewer_note) : '') + '</dd></dl>' +
        (p.storage_path ? '<div class="cl-actions"><button class="btn btn-outline btn-sm" id="pr-file">Voir le reçu</button></div>' : '') +
        (done ? '' : '<div class="field wide" style="margin-top:14px"><label for="pr-note">Note (visible dans l’historique)</label><textarea id="pr-note" rows="2"></textarea></div><div class="cl-actions"><button class="btn btn-danger btn-sm" id="pr-reject">Rejeter</button><button class="btn btn-orange btn-sm" id="pr-info">Demander des précisions</button></div>') + '</div>',
      afterOpen() {
        TC.on('pr-file', 'click', () => receipt(p));
        TC.on('pr-reject', 'click', () => decide(p, 'rejected'));
        TC.on('pr-info', 'click', () => decide(p, 'needs_info'));
      },
      onSave() { decide(p, 'approved'); }
    });
  }

  async function decide(p, decision) {
    if (decision === 'approved' && !confirm('Valider ce paiement et activer l’abonnement du client ?')) return;
    try {
      await TC.rpc('review_payment_proof', { p_proof_id: p.id, p_reviewer_id: TC.session.user.id, p_decision: decision, p_reviewer_note: TC.val('pr-note') || null });
      TC.modal.close();
      TC.toast(decision === 'approved' ? 'Paiement validé, abonnement activé' : decision === 'rejected' ? 'Reçu rejeté' : 'Précisions demandées', 'ok');
      load();
    } catch (e) { TC.modal.msg(e.message, 'err'); }
  }

  TC.register({
    id: 'paiements', label: 'Paiements', group: 'gestion', icon: '₣',
    keywords: 'paiements reçus wave commandes encaissement validation revenus',
    view, refresh: load,
    mount() { TC.on('pay-reload', 'click', load); TC.on('pay-filter', 'change', paint); TC.on('pay-tbody', 'click', e => { const b = e.target.closest('[data-review]'); if (b) review(b.dataset.review); }); load(); }
  });
})(window.TC);
