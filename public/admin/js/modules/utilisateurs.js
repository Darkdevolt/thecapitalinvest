'use strict';
/* ============================================================
   CLIENTS — liste et fiche complète d'un compte.
   Lecture : tout administrateur. Actions : compte maître.
   Les champs protégés (rôle, essai) sont écrits avec la session de
   l'administrateur ; le reste passe par /api/user-data?mode=admin-users.
   ============================================================ */
(function (TC) {
  const MASTER = 'diopibrahimabdallah@gmail.com';
  const API = '/api/user-data?mode=admin-users';
  const PLANS = { free: 'Découverte', investor: 'Investor', pro: 'Pro', elite: 'Elite', all: 'Accès complet', institute: 'Institute' };
  const DAY = 86400000;
  let rows = [], current = null, tab = 'profil';

  const esc = v => TC.esc(v == null ? '' : String(v));
  const isMaster = () => String(TC.session?.user?.email || '').trim().toLowerCase() === MASTER;
  const money = v => new Intl.NumberFormat('fr-FR').format(Number(v) || 0) + ' FCFA';
  const dt = v => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const d = v => v ? TC.fmtDate(v) : '—';
  const ago = v => {
    if (!v) return 'Jamais';
    const n = Math.floor((Date.now() - Date.parse(v)) / DAY);
    return n <= 0 ? "Aujourd'hui" : n === 1 ? 'Hier' : 'Il y a ' + n + ' j';
  };
  const initials = r => (String(r.nom || r.email || '?').trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase();

  /* ── Statuts ─────────────────────────────────────────── */
  function offer(r) {
    const plan = r.plan || 'free';
    const end = r.plan_expire_at ? Date.parse(r.plan_expire_at) : null;
    const trialEnd = r.trial_ends_at ? Date.parse(r.trial_ends_at) : null;
    if (plan !== 'free') {
      if (end && end < Date.now()) return { key: 'expired', label: (PLANS[plan] || plan) + ' expiré', tone: 'badge-red' };
      const days = end ? Math.ceil((end - Date.now()) / DAY) : null;
      return { key: 'paid', label: PLANS[plan] || plan, tone: plan === 'elite' ? 'badge-gold' : 'badge-blue', sub: days != null ? (days <= 30 ? 'échéance ' + days + ' j' : 'jusqu’au ' + d(r.plan_expire_at)) : 'sans échéance' };
    }
    if (trialEnd && trialEnd > Date.now()) return { key: 'trial', label: 'Essai', tone: 'badge-orange', sub: Math.ceil((trialEnd - Date.now()) / DAY) + ' j restants' };
    return { key: 'free', label: 'Découverte', tone: 'badge-grey', sub: trialEnd ? 'essai terminé' : '' };
  }
  const instituteActive = r => (r.subscriptions || []).some(s => s.plan_code === 'institute' && s.status === 'active' && (!s.current_period_end || Date.parse(s.current_period_end) > Date.now()));

  /* ── Liste ───────────────────────────────────────────── */
  function view() {
    return '<div id="cl-list">' +
      '<div class="page-head"><div><div class="page-title">Comptes <em>clients</em></div><div class="page-sub">Tous les comptes, leur offre, leur activité et leur fiche complète. Cliquez sur un client pour gérer son accès, son essai, ses paiements et ses notes.</div></div>' +
      '<div class="page-actions">' + (isMaster() ? '<button class="btn btn-primary btn-sm" id="cl-invite">+ Inviter un client</button>' : '<span class="badge badge-orange">Lecture seule</span>') +
      '<button class="btn btn-outline btn-sm" id="cl-export">⬇ CSV</button><button class="btn btn-outline btn-sm" id="cl-reload">↺</button></div></div>' +
      '<div class="kpis" id="cl-kpis"></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Clients</span><span class="card-tools">' +
      '<input type="search" id="cl-search" placeholder="Nom ou e-mail…">' +
      '<select id="cl-filter"><option value="">Tous</option><option value="paid">Payants actifs</option><option value="trial">En essai</option><option value="expired">Offre expirée</option><option value="free">Découverte</option><option value="institute">Institute actif</option><option value="suspended">Suspendus</option><option value="unconfirmed">E-mail non confirmé</option><option value="never">Jamais connectés</option><option value="inactive">Inactifs +30 j</option><option value="admin">Administrateurs</option></select>' +
      '<span class="card-count" id="cl-count"></span></span></div>' +
      '<div class="tw capped"><table><thead><tr><th>Client</th><th>Offre</th><th>Institute</th><th>Dernière connexion</th><th>Activité</th><th>Inscription</th><th>Compte</th><th></th></tr></thead><tbody id="cl-tbody">' + TC.rowsLoading(8) + '</tbody></table></div></div></div>' +
      '<div id="cl-detail" hidden></div>';
  }

  async function load() {
    const tbody = TC.el('cl-tbody');
    if (tbody) tbody.innerHTML = TC.rowsLoading(8);
    try {
      const res = await TC.api(API, { timeout: 20000 });
      rows = (res.data?.rows || []).map(r => Object.assign(r, { __offer: offer(r) }));
      paintKpis(); filter();
    } catch (e) {
      if (tbody) tbody.innerHTML = TC.rowsEmpty(8, 'Impossible de charger les comptes', e.message || 'Erreur API');
    }
  }

  function paintKpis() {
    const month = Date.now() - 30 * DAY;
    const k = [
      ['Comptes', rows.length, ''],
      ['Payants actifs', rows.filter(r => r.__offer.key === 'paid').length, 'paid'],
      ['En essai', rows.filter(r => r.__offer.key === 'trial').length, 'trial'],
      ['Offres expirées', rows.filter(r => r.__offer.key === 'expired').length, 'expired'],
      ['Inscrits 30 j', rows.filter(r => Date.parse(r.created_at) > month).length, ''],
      ['Actifs 30 j', rows.filter(r => r.last_sign_in_at && Date.parse(r.last_sign_in_at) > month).length, ''],
      ['Suspendus', rows.filter(r => r.suspended).length, 'suspended']
    ];
    TC.el('cl-kpis').innerHTML = k.map(x => '<div class="kpi' + (x[2] ? ' clickable" data-f="' + x[2] : '') + '"><div class="kpi-label">' + x[0] + '</div><div class="kpi-value sm">' + x[1] + '</div></div>').join('');
  }

  function match(r, f) {
    const month = Date.now() - 30 * DAY;
    switch (f) {
      case 'paid': case 'trial': case 'expired': case 'free': return r.__offer.key === f;
      case 'institute': return instituteActive(r);
      case 'suspended': return r.suspended;
      case 'unconfirmed': return r.has_auth && !r.email_confirmed_at;
      case 'never': return !r.last_sign_in_at;
      case 'inactive': return !r.last_sign_in_at || Date.parse(r.last_sign_in_at) < month;
      case 'admin': return !!r.is_admin;
      default: return true;
    }
  }

  function filter() {
    const q = (TC.val('cl-search') || '').toLowerCase().trim(), f = TC.val('cl-filter') || '';
    const list = rows.filter(r => (!q || ((r.email || '') + ' ' + (r.nom || '')).toLowerCase().includes(q)) && match(r, f));
    TC.el('cl-count').textContent = list.length + ' compte(s)';
    TC.el('cl-tbody').innerHTML = list.length ? list.map(r => {
      const o = r.__offer, c = r.counts || {};
      const acct = r.suspended ? '<span class="badge badge-red">Suspendu</span>' : r.has_auth && !r.email_confirmed_at ? '<span class="badge badge-orange">Non confirmé</span>' : '<span class="badge badge-green">Actif</span>';
      return '<tr class="' + (r.suspended || o.key === 'expired' ? 'row-warn' : '') + '" data-open="' + esc(r.id) + '" style="cursor:pointer">' +
        '<td><strong>' + esc(r.nom || '—') + '</strong>' + (r.is_admin ? ' <span class="badge badge-orange">Admin</span>' : '') + '<br><span class="td-muted">' + esc(r.email) + '</span></td>' +
        '<td><span class="badge ' + o.tone + '">' + esc(o.label) + '</span>' + (o.sub ? '<br><span class="td-muted" style="font-size:11px">' + esc(o.sub) + '</span>' : '') + '</td>' +
        '<td>' + (instituteActive(r) ? '<span class="badge badge-gold">Actif</span>' : '<span class="td-muted">—</span>') + '</td>' +
        '<td class="td-muted">' + ago(r.last_sign_in_at) + '</td>' +
        '<td class="td-mono td-muted" title="Opérations de portefeuille · alertes · valeurs suivies">' + (c.transactions || 0) + ' · ' + (c.alertes || 0) + ' · ' + (c.watchlist || 0) + '</td>' +
        '<td class="td-mono td-muted">' + d(r.created_at) + '</td><td>' + acct + '</td>' +
        '<td class="r"><button class="btn btn-outline btn-sm" data-open="' + esc(r.id) + '">Fiche</button></td></tr>';
    }).join('') : TC.rowsEmpty(8, 'Aucun compte', 'Aucun client ne correspond aux filtres.');
  }

  /* ── Fiche client ────────────────────────────────────── */
  async function openClient(id) {
    TC.el('cl-list').hidden = true;
    const box = TC.el('cl-detail');
    box.hidden = false;
    box.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement de la fiche…</div>';
    window.scrollTo(0, 0);
    try {
      const res = await TC.api(API + '&id=' + encodeURIComponent(id), { timeout: 20000 });
      current = res.data;
      paintDetail();
    } catch (e) {
      box.innerHTML = '<div class="note err"><strong>Fiche indisponible.</strong> ' + esc(e.message) + '</div><div class="cl-actions"><button class="btn btn-outline btn-sm" data-back>← Retour</button></div>';
    }
  }

  function closeClient() {
    current = null;
    TC.el('cl-detail').hidden = true;
    TC.el('cl-list').hidden = false;
  }

  function paintDetail() {
    const u = current.user, a = current.auth || {}, o = offer(u);
    const suspended = !!a.suspended;
    const tabs = [['profil', 'Profil & accès'], ['abonnements', 'Abonnements'], ['paiements', 'Paiements'], ['activite', 'Activité'], ['notes', 'Notes (' + (current.notes || []).length + ')'], ['historique', 'Historique']];
    TC.el('cl-detail').innerHTML =
      '<div class="page-head"><div><button class="btn btn-outline btn-sm" data-back>← Tous les clients</button></div><div class="page-actions"><button class="btn btn-outline btn-sm" data-reload-client>↺</button></div></div>' +
      '<div class="cl-head"><div class="cl-avatar">' + esc(initials(u)) + '</div><div><div class="cl-name">' + esc(u.nom || 'Sans nom') + '</div><div class="cl-mail">' + esc(u.email) + '</div>' +
      '<div class="cl-badges"><span class="badge ' + o.tone + '">' + esc(o.label) + '</span>' +
      (suspended ? '<span class="badge badge-red">Compte suspendu</span>' : '<span class="badge badge-green">Compte actif</span>') +
      (a.email_confirmed_at ? '' : '<span class="badge badge-orange">E-mail non confirmé</span>') +
      (u.is_admin ? '<span class="badge badge-orange">Administrateur</span>' : '') + '</div></div></div>' +
      '<div class="cl-tabs">' + tabs.map(t => '<button class="cl-tab' + (t[0] === tab ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div id="cl-pane">' + pane() + '</div>';
  }

  function pane() {
    const u = current.user, a = current.auth || {}, m = isMaster();
    if (tab === 'profil') {
      const trialEnd = u.trial_ends_at ? Date.parse(u.trial_ends_at) : null;
      return '<div class="grid-2"><div class="card"><div class="card-head"><span class="card-title">Identité</span></div><div class="card-body"><dl class="kv">' +
        '<dt>Nom</dt><dd>' + esc(u.nom || '—') + '</dd><dt>E-mail</dt><dd>' + esc(u.email) + '</dd>' +
        '<dt>E-mail confirmé</dt><dd>' + (a.email_confirmed_at ? dt(a.email_confirmed_at) : 'Non') + '</dd>' +
        '<dt>Connexion</dt><dd>' + esc((a.providers || []).join(', ') || 'e-mail') + '</dd>' +
        '<dt>Inscription</dt><dd>' + dt(u.created_at) + '</dd><dt>Dernière connexion</dt><dd>' + dt(a.last_sign_in_at || u.last_sign_in_at) + '</dd>' +
        '<dt>Conditions acceptées</dt><dd>' + (u.legal_consent_at ? dt(u.legal_consent_at) + (u.legal_version ? ' (v. ' + esc(u.legal_version) + ')' : '') : '—') + '</dd>' +
        '<dt>Rôle</dt><dd>' + (u.is_admin ? 'Administrateur' : 'Client') + '</dd></dl>' +
        (m ? '<div class="cl-actions"><button class="btn btn-outline btn-sm" data-act="edit">✎ Modifier le nom</button><button class="btn btn-outline btn-sm" data-act="role">' + (u.is_admin ? 'Retirer les droits admin' : 'Donner les droits admin') + '</button>' + (a.email_confirmed_at ? '' : '<button class="btn btn-outline btn-sm" data-act="confirm_email">Confirmer l’e-mail</button>') + '</div>' : '') +
        '</div></div>' +
        '<div class="card"><div class="card-head"><span class="card-title">Offre & essai</span></div><div class="card-body"><dl class="kv">' +
        '<dt>Offre Invest</dt><dd>' + esc(PLANS[u.plan || 'free'] || u.plan) + '</dd><dt>Échéance</dt><dd>' + d(u.plan_expire_at) + '</dd>' +
        '<dt>Essai</dt><dd>' + (u.trial_started_at ? d(u.trial_started_at) + ' → ' + d(u.trial_ends_at) + (trialEnd && trialEnd > Date.now() ? ' <span class="badge badge-orange">en cours</span>' : ' <span class="badge badge-grey">terminé</span>') : '—') + '</dd>' +
        '<dt>Institute</dt><dd>' + (current.institute ? (current.institute.xp || 0) + ' XP · ' + ((current.institute.completed_courses || []).length) + ' cours terminés' : '—') + '</dd></dl>' +
        (m ? '<div class="cl-actions"><button class="btn btn-outline btn-sm" data-trial="7">Essai +7 j</button><button class="btn btn-outline btn-sm" data-trial="14">+14 j</button><button class="btn btn-outline btn-sm" data-trial="30">+30 j</button><button class="btn btn-outline btn-sm" data-trial="0">Terminer l’essai</button><button class="btn btn-primary btn-sm" data-goto="abonnements">Gérer l’abonnement →</button></div>' : '') +
        '</div></div></div>' +
        (m ? '<div class="card danger-zone" style="margin-top:16px"><div class="card-head"><span class="card-title">Sécurité du compte</span></div><div class="card-body"><div class="cl-actions" style="margin-top:0">' +
          '<button class="btn btn-outline btn-sm" data-act="reset_password">Envoyer une réinitialisation du mot de passe</button>' +
          '<button class="btn btn-outline btn-sm" data-act="magic_link">Créer un lien de connexion</button>' +
          (a.suspended ? '<button class="btn btn-green btn-sm" data-act="unsuspend">Réactiver le compte</button>' : '<button class="btn btn-orange btn-sm" data-act="suspend">Suspendre le compte</button>') +
          '<button class="btn btn-danger btn-sm" data-act="delete">Supprimer le compte</button></div>' +
          '<div class="note" style="margin-top:12px">La suspension bloque la connexion sans rien effacer ; elle est réversible. La suppression efface le compte et toutes ses données (portefeuille, alertes, suivi, notes) : elle est définitive.</div><div id="cl-link"></div></div></div>' : '');
    }
    if (tab === 'abonnements') {
      const subs = current.subscriptions || [];
      return '<div class="card"><div class="card-head"><span class="card-title">Abonnements</span><span class="card-tools">' + (isMaster() ? '<button class="btn btn-primary btn-sm" data-goto="abonnements">Attribuer / modifier →</button>' : '') + '</span></div><div class="tw"><table><thead><tr><th>Produit</th><th>Formule</th><th>Statut</th><th>Début</th><th>Fin</th><th>Source</th></tr></thead><tbody>' +
        (subs.length ? subs.map(s => '<tr><td>' + (s.plan_code === 'institute' ? 'The Capital Institute' : 'The Capital Invest') + '</td><td>' + esc(PLANS[s.plan_code] || s.plan_code) + '</td><td><span class="badge ' + (s.status === 'active' ? 'badge-green' : s.status === 'canceled' ? 'badge-red' : 'badge-orange') + '">' + esc(s.status) + '</span></td><td>' + d(s.current_period_start || s.started_at) + '</td><td>' + d(s.current_period_end) + '</td><td class="td-muted">' + esc(s.provider || '—') + '</td></tr>').join('') : TC.rowsEmpty(6, 'Aucun abonnement', 'Ce client n’a jamais eu d’abonnement.')) + '</tbody></table></div></div>';
    }
    if (tab === 'paiements') {
      const pays = current.payments || [], orders = current.payment_orders || [], proofs = current.payment_proofs || [];
      const total = pays.filter(p => /succe|paid|approved/i.test(p.status)).reduce((s, p) => s + Number(p.amount || 0), 0) + orders.filter(o => o.status === 'successful').reduce((s, o) => s + Number(o.amount || 0), 0);
      return '<div class="kpis"><div class="kpi"><div class="kpi-label">Total encaissé</div><div class="kpi-value sm">' + money(total) + '</div></div><div class="kpi"><div class="kpi-label">Commandes</div><div class="kpi-value sm">' + orders.length + '</div></div><div class="kpi"><div class="kpi-label">Preuves à vérifier</div><div class="kpi-value sm">' + proofs.filter(p => p.status === 'pending' || p.status === 'needs_info').length + '</div></div></div>' +
        '<div class="card"><div class="card-head"><span class="card-title">Commandes & preuves de paiement</span><span class="card-tools"><button class="btn btn-outline btn-sm" data-goto="paiements">Centre des paiements →</button></span></div><div class="tw"><table><thead><tr><th>Date</th><th>Formule</th><th>Période</th><th>Montant</th><th>Moyen</th><th>Statut</th></tr></thead><tbody>' +
        (orders.length ? orders.map(o => '<tr><td>' + d(o.created_at) + '</td><td>' + esc(PLANS[o.plan_code] || o.plan_code) + '</td><td>' + esc(o.billing_period || '—') + '</td><td class="td-mono">' + money(o.amount) + '</td><td>' + esc(o.provider || '—') + '</td><td><span class="badge ' + (o.status === 'successful' ? 'badge-green' : o.status === 'failed' ? 'badge-red' : 'badge-orange') + '">' + esc(o.status) + '</span></td></tr>').join('') : TC.rowsEmpty(6, 'Aucune commande', '')) + '</tbody></table></div></div>' +
        (pays.length ? '<div class="card"><div class="card-head"><span class="card-title">Paiements enregistrés</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Montant</th><th>Statut</th><th>Moyen</th><th>Référence</th></tr></thead><tbody>' + pays.map(p => '<tr><td>' + d(p.paid_at || p.created_at) + '</td><td class="td-mono">' + money(p.amount) + '</td><td>' + esc(p.status) + '</td><td>' + esc(p.provider || '—') + '</td><td class="td-mono td-muted">' + esc(p.invoice_reference || '—') + '</td></tr>').join('') + '</tbody></table></div></div>' : '');
    }
    if (tab === 'activite') {
      const tx = current.transactions || [], al = current.alertes || [], wl = current.watchlist || [], ev = current.events || [];
      return '<div class="kpis"><div class="kpi"><div class="kpi-label">Opérations portefeuille</div><div class="kpi-value sm">' + tx.length + '</div></div><div class="kpi"><div class="kpi-label">Alertes</div><div class="kpi-value sm">' + al.length + '</div></div><div class="kpi"><div class="kpi-label">Valeurs suivies</div><div class="kpi-value sm">' + wl.length + '</div></div></div>' +
        '<div class="grid-2"><div class="card"><div class="card-head"><span class="card-title">Dernières opérations</span></div><div class="tw capped"><table><thead><tr><th>Date</th><th>Titre</th><th>Sens</th><th>Qté</th><th>Cours</th></tr></thead><tbody>' +
        (tx.length ? tx.slice(0, 50).map(t => '<tr><td>' + d(t.date_transaction) + '</td><td class="td-key">' + esc(t.ticker) + '</td><td>' + esc(t.type) + '</td><td class="td-mono">' + TC.fmtInt(t.quantite) + '</td><td class="td-mono">' + TC.fmtInt(t.prix_unitaire || t.cours) + '</td></tr>').join('') : TC.rowsEmpty(5, 'Aucune opération', '')) + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-head"><span class="card-title">Alertes & suivi</span></div><div class="card-body">' +
        (al.length ? al.map(x => '<div>' + (x.active ? '🟢' : '⚪') + ' <strong>' + esc(x.ticker) + '</strong> ' + (x.type_alerte === 'HAUSSE' ? '≥' : '≤') + ' ' + TC.fmtInt(x.seuil) + ' F</div>').join('') : '<div class="td-muted">Aucune alerte.</div>') +
        '<div style="margin-top:12px" class="td-muted">Suivi : ' + (wl.length ? wl.map(w => '<span class="badge badge-grey">' + esc(w.ticker) + '</span>').join(' ') : 'aucune valeur') + '</div></div></div></div>' +
        (ev.length ? '<div class="card"><div class="card-head"><span class="card-title">Événements récents</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Événement</th></tr></thead><tbody>' + ev.map(e => '<tr><td>' + dt(e.occurred_at) + '</td><td>' + esc(e.event_name) + '</td></tr>').join('') + '</tbody></table></div></div>' : '');
    }
    if (tab === 'notes') {
      const notes = current.notes || [];
      return '<div class="card"><div class="card-head"><span class="card-title">Notes internes</span></div><div class="card-body">' +
        (isMaster() ? '<div class="field wide"><textarea id="cl-note" rows="3" placeholder="Échange avec le client, demande particulière, relance prévue…"></textarea></div><div class="cl-actions" style="margin:8px 0 18px"><button class="btn btn-primary btn-sm" data-act="note">Ajouter la note</button></div>' : '') +
        (notes.length ? notes.map(n => '<div class="cl-note">' + esc(n.note) + '<small>' + dt(n.created_at) + (isMaster() ? ' · <a href="#" data-note-del="' + n.id + '" style="color:var(--red)">supprimer</a>' : '') + '</small></div>').join('') : '<div class="td-muted">Aucune note pour ce client. Les notes ne sont visibles que des administrateurs.</div>') +
        '</div></div>';
    }
    const h = current.history || [];
    return '<div class="card"><div class="card-head"><span class="card-title">Historique des actions d’administration</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Action</th></tr></thead><tbody>' +
      (h.length ? h.map(x => '<tr><td>' + dt(x.created_at) + '</td><td>' + esc(x.action) + '</td></tr>').join('') : TC.rowsEmpty(2, 'Aucune action enregistrée', '')) + '</tbody></table></div></div>';
  }

  /* ── Actions ─────────────────────────────────────────── */
  const post = body => TC.api(API, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
  const refresh = () => openClient(current.user.id);

  async function act(kind) {
    const u = current.user;
    try {
      if (kind === 'edit') {
        TC.modal.open({ title: 'Modifier le client', subtitle: u.email, body: '<div class="form-grid">' + TC.fields([{ id: 'cle-nom', label: 'Nom complet', wide: true }]) + '</div>',
          afterOpen() { TC.setVal('cle-nom', u.nom || ''); },
          async onSave() { try { await post({ action: 'profile', user_id: u.id, nom: TC.val('cle-nom') }); TC.modal.close(); TC.toast('Client mis à jour', 'ok'); refresh(); } catch (e) { TC.modal.msg(e.message, 'err'); } } });
        return;
      }
      if (kind === 'role') {
        const next = !u.is_admin;
        if (!confirm(next ? 'Donner les droits d’administration à ' + u.email + ' ?' : 'Retirer les droits d’administration de ' + u.email + ' ?')) return;
        await TC.patch('users', 'id=eq.' + encodeURIComponent(u.id), { is_admin: next });
        TC.toast('Rôle mis à jour', 'ok'); refresh(); return;
      }
      if (kind === 'note') {
        const note = (TC.val('cl-note') || '').trim();
        if (!note) return TC.toast('La note est vide.', 'err');
        await post({ action: 'note', user_id: u.id, note });
        tab = 'notes'; TC.toast('Note ajoutée', 'ok'); refresh(); return;
      }
      if (kind === 'reset_password' || kind === 'magic_link') {
        const r = await post({ action: kind, user_id: u.id });
        const link = r.data?.link;
        TC.el('cl-link').innerHTML = '<div class="note" style="margin-top:12px">' + (kind === 'reset_password' ? (r.data?.email_sent ? '<strong>E-mail de réinitialisation envoyé.</strong> ' : '<strong>E-mail non envoyé.</strong> ') : '<strong>Lien de connexion créé.</strong> ') +
          (link ? 'Vous pouvez aussi transmettre ce lien au client (usage unique, durée limitée) :<div class="field" style="margin-top:8px"><input readonly value="' + esc(link) + '" onclick="this.select()"></div>' : '') + '</div>';
        return;
      }
      if (kind === 'suspend') {
        const reason = prompt('Suspendre ' + u.email + ' ?\nLe client ne pourra plus se connecter. Motif (facultatif) :', '');
        if (reason === null) return;
        await post({ action: 'suspend', user_id: u.id, reason });
        TC.toast('Compte suspendu', 'ok'); refresh(); load(); return;
      }
      if (kind === 'unsuspend') { await post({ action: 'unsuspend', user_id: u.id }); TC.toast('Compte réactivé', 'ok'); refresh(); load(); return; }
      if (kind === 'confirm_email') { await post({ action: 'confirm_email', user_id: u.id }); TC.toast('E-mail confirmé', 'ok'); refresh(); return; }
      if (kind === 'delete') {
        const typed = prompt('Suppression DÉFINITIVE du compte et de toutes ses données.\nPour confirmer, saisissez l’adresse e-mail du compte :\n' + u.email, '');
        if (typed === null) return;
        await post({ action: 'delete', user_id: u.id, confirm_email: typed });
        TC.toast('Compte supprimé', 'ok'); closeClient(); load(); return;
      }
    } catch (e) { TC.toast(e.message || 'Action impossible', 'err'); }
  }

  async function trial(days) {
    const u = current.user;
    const now = Date.now();
    let body;
    if (days === 0) {
      if (!confirm('Terminer l’essai de ' + u.email + ' maintenant ?')) return;
      body = { trial_ends_at: new Date(now).toISOString() };
    } else {
      const base = u.trial_ends_at && Date.parse(u.trial_ends_at) > now ? Date.parse(u.trial_ends_at) : now;
      body = { trial_ends_at: new Date(base + days * DAY).toISOString() };
      if (!u.trial_started_at) body.trial_started_at = new Date(now).toISOString();
    }
    try {
      await TC.patch('users', 'id=eq.' + encodeURIComponent(u.id), body);
      TC.toast(days ? 'Essai prolongé de ' + days + ' jours' : 'Essai terminé', 'ok');
      refresh(); load();
    } catch (e) { TC.toast(e.message || 'Modification impossible', 'err'); }
  }

  function invite() {
    TC.modal.open({ title: 'Inviter un client', subtitle: 'Le client reçoit un e-mail pour créer son mot de passe', saveLabel: 'Envoyer l’invitation',
      body: '<div class="form-grid">' + TC.fields([{ id: 'cli-email', label: 'E-mail', type: 'email' }, { id: 'cli-nom', label: 'Nom complet' }]) + '</div><div class="note">Le compte démarre en offre Découverte avec l’essai gratuit habituel. Vous pourrez ensuite lui attribuer une formule dans « Abonnements ».</div>',
      async onSave() {
        try { await post({ action: 'invite', email: TC.val('cli-email'), nom: TC.val('cli-nom') }); TC.modal.close(); TC.toast('Invitation envoyée', 'ok'); load(); }
        catch (e) { TC.modal.msg(e.message, 'err'); }
      } });
  }

  function exportCsv() {
    if (!rows.length) return;
    const out = rows.map(r => ({ email: r.email, nom: r.nom || '', offre: r.__offer.label, echeance: r.plan_expire_at || '', essai_fin: r.trial_ends_at || '', institute: instituteActive(r) ? 'oui' : '', derniere_connexion: r.last_sign_in_at || '', inscription: r.created_at, suspendu: r.suspended ? 'oui' : '', admin: r.is_admin ? 'oui' : '', operations: r.counts?.transactions || 0, alertes: r.counts?.alertes || 0, suivi: r.counts?.watchlist || 0 }));
    TC.download('clients-' + TC.today() + '.csv', TC.toCSV(out, Object.keys(out[0])), 'text/csv;charset=utf-8');
  }

  function goto(id) { if (TC.module(id)) TC.go(id); }

  TC.register({
    id: 'utilisateurs', label: 'Clients', group: 'gestion', icon: '☰',
    keywords: 'utilisateur client compte admin identité essai suspension mot de passe notes',
    view, refresh: () => current ? refresh() : load(),
    mount() {
      tab = 'profil'; current = null;
      TC.on('cl-reload', 'click', load);
      TC.on('cl-invite', 'click', invite);
      TC.on('cl-export', 'click', exportCsv);
      TC.on('cl-search', 'input', filter);
      TC.on('cl-filter', 'change', filter);
      TC.on('cl-kpis', 'click', e => { const k = e.target.closest('[data-f]'); if (k) { TC.setVal('cl-filter', k.dataset.f); filter(); } });
      TC.on('cl-tbody', 'click', e => { const n = e.target.closest('[data-open]'); if (n) { tab = 'profil'; openClient(n.dataset.open); } });
      TC.on('cl-detail', 'click', e => {
        const t = e.target;
        if (t.closest('[data-back]')) { closeClient(); return; }
        if (t.closest('[data-reload-client]')) { refresh(); return; }
        const tb = t.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; paintDetail(); return; }
        const a = t.closest('[data-act]'); if (a) { act(a.dataset.act); return; }
        const tr = t.closest('[data-trial]'); if (tr) { trial(Number(tr.dataset.trial)); return; }
        const g = t.closest('[data-goto]'); if (g) { goto(g.dataset.goto); return; }
        const nd = t.closest('[data-note-del]');
        if (nd) { e.preventDefault(); if (confirm('Supprimer cette note ?')) post({ action: 'note_delete', user_id: current.user.id, note_id: Number(nd.dataset.noteDel) }).then(refresh).catch(err => TC.toast(err.message, 'err')); }
      });
      load();
    }
  });
})(window.TC);
