'use strict';
/* ============================================================
   CLIENTS — liste et fiche complète d'un compte, et journal
   d'administration. Lecture : tout administrateur. Actions : compte
   maître, toutes côté serveur (tracées dans le journal) :
     /api/user-data?mode=admin-users   profil, essai, rôle, sécurité, notes
     /api/user-data?mode=admin-billing accès Invest / Institute, commandes
   ============================================================ */
(function (TC) {
  const MASTER = 'diopibrahimabdallah@gmail.com';
  const API = '/api/user-data?mode=admin-users';
  const BILLING = '/api/user-data?mode=admin-billing';
  const PLANS = { free: 'Découverte', investor: 'Investor', pro: 'Professional', elite: 'Elite', all: 'Accès complet', institute: 'Institute' };
  const PERIODS = { weekly: 'Hebdomadaire', monthly: 'Mensuel', quarterly: 'Trimestriel', semiannual: 'Semestriel', annual: 'Annuel' };
  const SUB_ST = { active: ['Actif', 'badge-green'], paused: ['Suspendu', 'badge-orange'], canceled: ['Annulé', 'badge-red'], expired: ['Expiré', 'badge-grey'], trialing: ['En attente', 'badge-grey'], past_due: ['Paiement en retard', 'badge-orange'] };
  const ORDER_ST = { pending: ['En attente de paiement', 'badge-orange'], processing: ['En cours', 'badge-orange'], successful: ['Payée', 'badge-green'], failed: ['Échouée', 'badge-red'], cancelled: ['Annulée', 'badge-grey'], refunded: ['Remboursée', 'badge-grey'] };
  const PROOF_ST = { pending: ['À vérifier', 'badge-orange'], needs_info: ['Infos demandées', 'badge-orange'], approved: ['Validé', 'badge-green'], rejected: ['Rejeté', 'badge-red'] };
  const DAY = 86400000;
  let rows = [], current = null, tab = 'profil', plans = null;

  const esc = v => TC.esc(v == null ? '' : String(v));
  const isMaster = () => String(TC.session?.user?.email || '').trim().toLowerCase() === MASTER;
  const money = v => new Intl.NumberFormat('fr-FR').format(Number(v) || 0) + ' FCFA';
  const dt = v => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const d = v => v ? TC.fmtDate(v) : '—';
  const isoDay = v => v ? new Date(v).toISOString().slice(0, 10) : '';
  const badgeOf = (map, s) => { const x = map[s] || [s || '—', 'badge-grey']; return '<span class="badge ' + x[1] + '">' + esc(x[0]) + '</span>'; };
  const ago = v => {
    if (!v) return 'Jamais';
    const n = Math.floor((Date.now() - Date.parse(v)) / DAY);
    return n <= 0 ? "Aujourd'hui" : n === 1 ? 'Hier' : 'Il y a ' + n + ' j';
  };
  const initials = r => (String(r.nom || r.email || '?').trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase();

  /* ── Journal : description lisible d'une entrée ─────────── */
  const ACTIONS = {
    user_invite: 'Invitation envoyée', user_profile: 'Profil modifié', user_reset_password: 'Réinitialisation du mot de passe envoyée',
    user_magic_link: 'Lien de connexion créé', user_email: 'E-mail envoyé au client', user_suspend: 'Compte suspendu', user_unsuspend: 'Compte réactivé',
    user_confirm_email: 'E-mail confirmé manuellement', user_delete: 'Compte supprimé', user_trial: 'Essai gratuit modifié', user_role: 'Droits administrateur modifiés',
    subscription_assign: 'Accès attribué', subscription_extend: 'Accès prolongé', subscription_update: 'Abonnement modifié',
    subscription_cancel: 'Abonnement annulé', subscription_suspend: 'Abonnement suspendu', subscription_reactivate: 'Abonnement réactivé',
    institute_grant: 'Institute : accès accordé', institute_extend: 'Institute : accès prolongé', institute_suspend: 'Institute : accès suspendu',
    institute_remove: 'Institute : accès retiré', institute_reactivate: 'Institute : accès réactivé',
    payment_confirm: 'Paiement confirmé, accès activé', order_cancel: 'Commande annulée',
    payment_proof_review: 'Reçu de paiement examiné', payment_admin_confirm: 'Encaissement confirmé', payment_admin_cancel: 'Commande annulée',
    app_config_update: 'Options de l’application modifiées', billing_plan_update: 'Formule / tarif modifié',
    INSERT: 'Création', UPDATE: 'Modification', DELETE: 'Suppression'
  };
  const TABLES = {
    users: 'Client', subscriptions: 'Abonnement', payment_orders: 'Commande', payment_proofs: 'Reçu', billing_plans: 'Formule', admin_settings: 'Options',
    entreprises: 'Société', financials: 'États financiers', historique: 'Cours', indices: 'Indices', dividendes: 'Dividendes', evenements_valeurs: 'Évènement sur valeur',
    analyses: 'Analyse', annonces_emetteurs: 'Annonce', boc: 'BOC', obligations: 'Obligation', reportings: 'Reporting'
  };
  const FIELDS = {
    nom: 'Nom', email: 'E-mail', plan: 'Offre', provider: 'Source', provider_reference: 'Référence', plan_code: 'Formule', plan_expire_at: 'Échéance', status: 'Statut', current_period_end: 'Fin d’accès',
    current_period_start: 'Début', trial_ends_at: 'Fin d’essai', trial_started_at: 'Début d’essai', is_admin: 'Administrateur', reason: 'Motif',
    subject: 'Objet', email_sent: 'E-mail envoyé', amount: 'Montant', billing_period: 'Période', reference: 'Référence', note: 'Note',
    monthly_price: 'Prix mensuel', quarterly_price: 'Prix trimestriel', annual_price: 'Prix annuel', active: 'Active', name: 'Nom',
    maintenance: 'Maintenance', banner_enabled: 'Bandeau', banner_text: 'Texte du bandeau', signups_open: 'Inscriptions ouvertes', trial_days: 'Jours d’essai'
  };
  const SKIP = new Set(['updated_at', 'created_at', 'id', 'user_id', 'provider_subscription_id', 'started_at', 'last_sign_in_at', 'canceled_at', 'cancel_reason', 'confirmed_by', 'confirmed_at', 'subscription_id']);
  function fmtVal(k, v) {
    if (v == null || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'oui' : 'non';
    if (k === 'plan' || k === 'plan_code') return PLANS[v] || v;
    if (k === 'status') return (SUB_ST[v] || ORDER_ST[v] || PROOF_ST[v] || [v])[0];
    if (k === 'billing_period') return PERIODS[v] || v;
    if (/_price$|^amount$/.test(k)) return money(v);
    if (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) return d(v);
    if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
    return String(v).slice(0, 120);
  }
  function describe(e) {
    const o = e.old_data && typeof e.old_data === 'object' ? e.old_data : {}, n = e.new_data && typeof e.new_data === 'object' ? e.new_data : {};
    const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter(k => !SKIP.has(k));
    let parts;
    if (e.action === 'INSERT' || !Object.keys(o).length) parts = keys.filter(k => n[k] != null && n[k] !== '').slice(0, 6).map(k => (FIELDS[k] || k) + ' : ' + fmtVal(k, n[k]));
    else parts = keys.filter(k => JSON.stringify(o[k]) !== JSON.stringify(n[k])).slice(0, 8).map(k => (FIELDS[k] || k) + ' : ' + fmtVal(k, o[k]) + ' → ' + fmtVal(k, n[k]));
    return parts.join(' · ');
  }
  function auditRow(e, withTarget) {
    const who = e.actor ? (e.actor.nom || e.actor.email) : (e.actor_id ? 'Système / ' + String(e.actor_id).slice(0, 8) : 'Système');
    const product = (e.new_data && e.new_data.plan_code) || (e.old_data && e.old_data.plan_code);
    const obj = (TABLES[e.table_name] || e.table_name || '') + (product ? ' · ' + (PLANS[product] || product) : '') + (!TABLES[e.table_name] && e.record_id ? ' ' + String(e.record_id).slice(0, 18) : '');
    return '<tr><td class="td-mono">' + dt(e.created_at) + '</td><td><strong>' + esc(ACTIONS[e.action] || e.action) + '</strong><br><span class="td-muted">' + esc(obj) + '</span></td>' +
      (withTarget ? '<td>' + (e.target ? '<a href="#" data-client="' + esc(e.target_id) + '">' + esc(e.target.nom || e.target.email) + '</a>' : '<span class="td-muted">—</span>') + '</td>' : '') +
      '<td class="audit-detail">' + (esc(describe(e)) || '<span class="td-muted">—</span>') + '</td><td class="td-muted">' + esc(who) + '</td></tr>';
  }
  TC.auditRow = auditRow;

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
  const liveSub = s => s && s.status === 'active' && (!s.current_period_end || Date.parse(s.current_period_end) > Date.now());
  const instituteActive = r => (r.subscriptions || []).some(s => s.plan_code === 'institute' && liveSub(s));
  const latest = (subs, institute) => (subs || []).filter(s => (s.plan_code === 'institute') === institute).sort((a, b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at))[0] || null;

  /* ── Liste ───────────────────────────────────────────── */
  function view() {
    return '<div id="cl-list">' +
      '<div class="page-head"><div><div class="page-title">Comptes <em>clients</em></div><div class="page-sub">Tous les comptes, leur offre, leur activité et leur fiche complète. Ouvrez une fiche pour attribuer ou retirer un accès (Invest et Institute), confirmer un paiement, modifier le profil ou l’essai.</div></div>' +
      '<div class="page-actions">' + (isMaster() ? '<button class="btn btn-primary btn-sm" id="cl-invite">+ Inviter un client</button>' : '<span class="badge badge-orange">Lecture seule</span>') +
      '<button class="btn btn-outline btn-sm" id="cl-export">⬇ CSV</button><button class="btn btn-outline btn-sm" id="cl-reload">↺</button></div></div>' +
      '<div class="kpis" id="cl-kpis"></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Clients</span><span class="card-tools">' +
      '<input type="search" id="cl-search" placeholder="Nom ou e-mail…">' +
      '<select id="cl-filter"><option value="">Tous</option><option value="paid">Payants actifs</option><option value="trial">En essai</option><option value="expired">Offre expirée</option><option value="free">Découverte</option><option value="institute">Institute actif</option><option value="suspended">Suspendus</option><option value="unconfirmed">E-mail non confirmé</option><option value="never">Jamais connectés</option><option value="inactive">Inactifs +30 j</option><option value="admin">Administrateurs</option></select>' +
      '<span class="card-count" id="cl-count"></span></span></div>' +
      '<div class="tw capped"><table><thead><tr><th>Client</th><th>Offre Invest</th><th>Institute</th><th>Dernière connexion</th><th>Activité</th><th>Inscription</th><th>Compte</th><th></th></tr></thead><tbody id="cl-tbody">' + TC.rowsLoading(8) + '</tbody></table></div></div></div>' +
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
      ['Institute actifs', rows.filter(instituteActive).length, 'institute'],
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
  async function loadPlans() {
    if (plans) return plans;
    try { const r = await TC.api('/api/user-data?mode=admin-settings', { timeout: 15000 }); plans = r.data?.plans || []; }
    catch (e) { plans = Object.keys(PLANS).filter(k => k !== 'all').map(code => ({ code, name: PLANS[code], active: true })); }
    return plans;
  }

  async function openClient(id) {
    TC.el('cl-list').hidden = true;
    const box = TC.el('cl-detail');
    box.hidden = false;
    if (!current || current.user.id !== id) box.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement de la fiche…</div>';
    window.scrollTo(0, 0);
    try {
      const [res] = await Promise.all([TC.api(API + '&id=' + encodeURIComponent(id), { timeout: 20000 }), loadPlans()]);
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
    const todo = (current.payment_proofs || []).filter(p => p.status === 'pending' || p.status === 'needs_info').length + (current.payment_orders || []).filter(x => x.status === 'pending' || x.status === 'processing').length;
    const tabs = [['profil', 'Profil & essai'], ['acces', 'Accès & abonnements'], ['paiements', 'Paiements' + (todo ? ' (' + todo + ')' : '')], ['institute', 'Institute'], ['activite', 'Activité'], ['notes', 'Notes (' + (current.notes || []).length + ')'], ['historique', 'Historique (' + (current.history || []).length + ')']];
    TC.el('cl-detail').innerHTML =
      '<div class="page-head"><div><button class="btn btn-outline btn-sm" data-back>← Tous les clients</button></div><div class="page-actions"><button class="btn btn-outline btn-sm" data-reload-client>↺</button></div></div>' +
      '<div class="cl-head"><div class="cl-avatar">' + esc(initials(u)) + '</div><div><div class="cl-name">' + esc(u.nom || 'Sans nom') + '</div><div class="cl-mail">' + esc(u.email) + '</div>' +
      '<div class="cl-badges"><span class="badge ' + o.tone + '">Invest : ' + esc(o.label) + '</span>' +
      (instituteActive({ subscriptions: current.subscriptions }) ? '<span class="badge badge-gold">Institute actif</span>' : '') +
      (suspended ? '<span class="badge badge-red">Compte suspendu</span>' : '<span class="badge badge-green">Compte actif</span>') +
      (a.email_confirmed_at ? '' : '<span class="badge badge-orange">E-mail non confirmé</span>') +
      (u.is_admin ? '<span class="badge badge-orange">Administrateur</span>' : '') + '</div></div></div>' +
      '<div class="cl-tabs">' + tabs.map(t => '<button class="cl-tab' + (t[0] === tab ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div id="cl-pane">' + pane() + '</div>';
  }

  function productCard(institute) {
    const m = isMaster(), s = latest(current.subscriptions, institute), live = liveSub(s);
    const title = institute ? 'The Capital Institute' : 'The Capital Invest';
    const days = s && s.current_period_end ? Math.ceil((Date.parse(s.current_period_end) - Date.now()) / DAY) : null;
    let body = '<dl class="kv"><dt>Formule</dt><dd>' + (s ? esc(PLANS[s.plan_code] || s.plan_code) : '—') + '</dd>' +
      '<dt>Statut</dt><dd>' + (s ? badgeOf(SUB_ST, s.status === 'active' && !live ? 'expired' : s.status) : '<span class="badge badge-grey">Aucun accès</span>') + '</dd>' +
      '<dt>Fin d’accès</dt><dd>' + (s ? d(s.current_period_end) + (live && days != null ? ' <span class="td-muted">(' + days + ' j)</span>' : '') : '—') + '</dd>' +
      '<dt>Source</dt><dd>' + (s ? esc(s.provider === 'admin' ? 'Attribué par l’administration' : s.provider || '—') : '—') + '</dd></dl>';
    if (m) {
      body += '<div class="cl-actions">' +
        '<button class="btn btn-primary btn-sm" data-access="assign" data-product="' + (institute ? 'institute' : 'invest') + '">' + (s ? (institute ? 'Modifier l’accès' : 'Changer de formule / dates') : 'Attribuer un accès') + '</button>' +
        (s ? '<button class="btn btn-outline btn-sm" data-access="extend" data-days="30" data-sub="' + esc(s.id) + '">+30 j</button><button class="btn btn-outline btn-sm" data-access="extend" data-days="90" data-sub="' + esc(s.id) + '">+90 j</button><button class="btn btn-outline btn-sm" data-access="extend" data-days="365" data-sub="' + esc(s.id) + '">+1 an</button>' : '') +
        (s && s.status === 'active' ? '<button class="btn btn-orange btn-sm" data-access="suspend" data-sub="' + esc(s.id) + '">Suspendre</button><button class="btn btn-danger btn-sm" data-access="cancel" data-sub="' + esc(s.id) + '">Retirer l’accès</button>' : '') +
        (s && s.status !== 'active' ? '<button class="btn btn-green btn-sm" data-access="reactivate" data-sub="' + esc(s.id) + '">Réactiver</button>' : '') +
        '</div>';
    }
    return '<div class="card"><div class="card-head"><span class="card-title">' + title + '</span>' + (live ? '<span class="badge badge-green">Accès ouvert</span>' : '<span class="badge badge-grey">Pas d’accès</span>') + '</div><div class="card-body">' + body + '</div></div>';
  }

  function receiptBtn(p) { return p.storage_path ? '<button class="btn btn-outline btn-sm" data-receipt="' + esc(p.id) + '">Voir le reçu</button>' : '<span class="td-muted">sans fichier</span>'; }

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
        (m ? '<div class="cl-actions"><button class="btn btn-outline btn-sm" data-act="edit">✎ Modifier nom / e-mail</button><button class="btn btn-outline btn-sm" data-act="role">' + (u.is_admin ? 'Retirer les droits admin' : 'Donner les droits admin') + '</button>' + (a.email_confirmed_at ? '' : '<button class="btn btn-outline btn-sm" data-act="confirm_email">Confirmer l’e-mail</button>') + '</div>' : '') +
        '</div></div>' +
        '<div class="card"><div class="card-head"><span class="card-title">Essai gratuit</span></div><div class="card-body"><dl class="kv">' +
        '<dt>Essai</dt><dd>' + (u.trial_started_at ? d(u.trial_started_at) + ' → ' + d(u.trial_ends_at) + (trialEnd && trialEnd > Date.now() ? ' <span class="badge badge-orange">en cours</span>' : ' <span class="badge badge-grey">terminé</span>') : '—') + '</dd>' +
        '<dt>Offre Invest</dt><dd>' + esc(PLANS[u.plan || 'free'] || u.plan) + (u.plan_expire_at ? ' jusqu’au ' + d(u.plan_expire_at) : '') + '</dd></dl>' +
        (m ? '<div class="cl-actions"><button class="btn btn-outline btn-sm" data-trial="7">Essai +7 j</button><button class="btn btn-outline btn-sm" data-trial="14">+14 j</button><button class="btn btn-outline btn-sm" data-trial="30">+30 j</button><button class="btn btn-outline btn-sm" data-trial="date">Date précise…</button><button class="btn btn-outline btn-sm" data-trial="0">Terminer l’essai</button></div><div class="cl-actions"><button class="btn btn-primary btn-sm" data-tab="acces">Gérer les accès payants →</button></div>' : '') +
        '</div></div></div>' +
        (m ? '<div class="card danger-zone" style="margin-top:16px"><div class="card-head"><span class="card-title">Sécurité du compte</span></div><div class="card-body"><div class="cl-actions" style="margin-top:0">' +
          '<button class="btn btn-primary btn-sm" data-act="email">✉ Envoyer un e-mail</button>' +
          '<button class="btn btn-outline btn-sm" data-act="reset_password">Envoyer une réinitialisation du mot de passe</button>' +
          '<button class="btn btn-outline btn-sm" data-act="magic_link">Créer un lien de connexion</button>' +
          (a.suspended ? '<button class="btn btn-green btn-sm" data-act="unsuspend">Réactiver le compte</button>' : '<button class="btn btn-orange btn-sm" data-act="suspend">Suspendre le compte</button>') +
          '<button class="btn btn-danger btn-sm" data-act="delete">Supprimer le compte</button></div>' +
          '<div class="note" style="margin-top:12px">La suspension bloque la connexion sans rien effacer ; elle est réversible. La suppression efface le compte et toutes ses données (portefeuille, alertes, suivi, notes) : elle est définitive.</div><div id="cl-link"></div></div></div>' : '');
    }
    if (tab === 'acces') {
      const subs = (current.subscriptions || []).slice().sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at));
      return '<div class="note" style="margin-bottom:14px">Invest (marché, analyse, portefeuille) et Institute (formation) sont indépendants : modifier l’un ne touche jamais l’autre. Chaque action est inscrite dans l’historique du client.</div>' +
        '<div class="grid-2">' + productCard(false) + productCard(true) + '</div>' +
        '<div class="card"><div class="card-head"><span class="card-title">Tous les abonnements du client</span></div><div class="tw"><table><thead><tr><th>Produit</th><th>Formule</th><th>Statut</th><th>Début</th><th>Fin</th><th>Source</th><th>Motif de fin</th></tr></thead><tbody>' +
        (subs.length ? subs.map(s => '<tr><td>' + (s.plan_code === 'institute' ? 'Institute' : 'Invest') + '</td><td>' + esc(PLANS[s.plan_code] || s.plan_code) + '</td><td>' + badgeOf(SUB_ST, s.status === 'active' && !liveSub(s) ? 'expired' : s.status) + '</td><td>' + d(s.current_period_start || s.started_at) + '</td><td>' + d(s.current_period_end) + '</td><td class="td-muted">' + esc(s.provider || '—') + '</td><td class="td-muted">' + esc(s.cancel_reason || '—') + '</td></tr>').join('') : TC.rowsEmpty(7, 'Aucun abonnement', 'Ce client n’a jamais eu d’abonnement.')) + '</tbody></table></div></div>';
    }
    if (tab === 'paiements') {
      const orders = current.payment_orders || [], proofs = current.payment_proofs || [];
      const total = orders.filter(o => o.status === 'successful').reduce((s, o) => s + Number(o.amount || 0), 0);
      return '<div class="kpis"><div class="kpi"><div class="kpi-label">Total encaissé</div><div class="kpi-value sm">' + money(total) + '</div></div><div class="kpi"><div class="kpi-label">Commandes</div><div class="kpi-value sm">' + orders.length + '</div></div><div class="kpi"><div class="kpi-label">Reçus à vérifier</div><div class="kpi-value sm">' + proofs.filter(p => p.status === 'pending' || p.status === 'needs_info').length + '</div></div></div>' +
        '<div class="note" style="margin-bottom:14px"><strong>Vérifier un paiement :</strong> ouvrez votre application Wave Business (ou le relevé du moyen utilisé), retrouvez la transaction par sa <strong>référence</strong> et son <strong>montant exact</strong>, puis cliquez « Confirmer le paiement ». L’accès du client s’ouvre immédiatement pour la période payée.</div>' +
        '<div class="card"><div class="card-head"><span class="card-title">Commandes</span><span class="card-tools"><button class="btn btn-outline btn-sm" data-goto="paiements">Centre des paiements →</button></span></div><div class="tw"><table><thead><tr><th>Date</th><th>Formule</th><th>Période</th><th>Montant</th><th>Moyen</th><th>Statut</th><th></th></tr></thead><tbody>' +
        (orders.length ? orders.map(o => '<tr><td class="td-mono">' + dt(o.created_at) + '</td><td>' + esc(PLANS[o.plan_code] || o.plan_code) + '</td><td>' + esc(PERIODS[o.billing_period] || o.billing_period || '—') + '</td><td class="td-mono">' + money(o.amount) + '</td><td>' + esc(o.provider || '—') + '</td><td>' + badgeOf(ORDER_ST, o.status) + (o.paid_at ? '<br><span class="td-muted" style="font-size:11px">payée le ' + dt(o.paid_at) + '</span>' : '') + '</td><td class="r">' +
          (m && o.status !== 'successful' && o.status !== 'cancelled' ? '<button class="btn btn-green btn-sm" data-order="confirm" data-id="' + esc(o.id) + '">Confirmer le paiement</button> <button class="btn btn-outline btn-sm" data-order="cancel" data-id="' + esc(o.id) + '">Annuler</button>' : '') + '</td></tr>').join('') : TC.rowsEmpty(7, 'Aucune commande', 'Le client n’a lancé aucun paiement.')) + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-head"><span class="card-title">Reçus envoyés par le client</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Montant déclaré</th><th>Référence</th><th>Note du client</th><th>Statut</th><th></th></tr></thead><tbody>' +
        (proofs.length ? proofs.map(p => '<tr><td class="td-mono">' + dt(p.created_at) + '</td><td class="td-mono">' + money(p.claimed_amount) + '</td><td class="td-mono">' + esc(p.transaction_reference || '—') + '</td><td class="td-muted">' + esc(p.note || '—') + '</td><td>' + badgeOf(PROOF_ST, p.status) + (p.reviewer_note ? '<br><span class="td-muted" style="font-size:11px">' + esc(p.reviewer_note) + '</span>' : '') + '</td><td class="r">' + receiptBtn(p) + '</td></tr>').join('') : TC.rowsEmpty(6, 'Aucun reçu', '')) + '</tbody></table></div></div>';
    }
    if (tab === 'institute') {
      const p = current.institute;
      const lessons = p && Array.isArray(p.completed_lessons) ? p.completed_lessons : [], courses = p && Array.isArray(p.completed_courses) ? p.completed_courses : [];
      return '<div class="grid-2">' + productCard(true) +
        '<div class="card"><div class="card-head"><span class="card-title">Progression personnelle</span></div><div class="card-body">' +
        (p ? '<dl class="kv"><dt>Leçons terminées</dt><dd>' + lessons.length + '</dd><dt>Parcours terminés</dt><dd>' + courses.length + '</dd><dt>XP</dt><dd>' + (p.xp || 0) + '</dd><dt>Dernière activité</dt><dd>' + dt(p.last_activity_at) + '</dd></dl>' +
          (lessons.length ? '<div style="margin-top:12px" class="td-muted">Leçons : ' + lessons.slice(0, 60).map(l => '<span class="badge badge-grey">' + esc(l) + '</span>').join(' ') + '</div>' : '')
          : '<div class="td-muted">Aucune progression enregistrée pour ce client.</div>') +
        '<div class="note" style="margin-top:12px">La progression est propre à chaque compte : elle suit le client sur tous ses appareils et n’est jamais partagée avec un autre compte.</div></div></div></div>';
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
    return '<div class="card"><div class="card-head"><span class="card-title">Historique des actions d’administration</span><span class="card-count">' + h.length + ' action(s)</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Action</th><th>Détail (avant → après)</th><th>Par</th></tr></thead><tbody>' +
      (h.length ? h.map(e => auditRow(e, false)).join('') : TC.rowsEmpty(4, 'Aucune action enregistrée', 'Les prochaines actions (accès, paiements, profil, essai) apparaîtront ici.')) + '</tbody></table></div></div>';
  }

  /* ── Actions ─────────────────────────────────────────── */
  const post = body => TC.api(API, { method: 'POST', body, timeout: 20000 });
  /* Réponse du serveur appliquée tout de suite à la fiche (la relecture complète
     prend plusieurs secondes : sans cela, rien ne semblait changer). */
  const billing = body => TC.api(BILLING, { method: 'POST', body, timeout: 20000 }).then(r => { applySub(r.data); return r; });
  function applySub(s) {
    if (!current || !s || !s.id || !s.plan_code || s.user_id !== current.user.id) return;
    const list = current.subscriptions || (current.subscriptions = []);
    const i = list.findIndex(x => x.id === s.id);
    if (i >= 0) list[i] = s; else list.unshift(s);
    if (s.plan_code !== 'institute') {
      const on = s.status === 'active';
      current.user.plan = on ? s.plan_code : 'free';
      current.user.plan_expire_at = on ? s.current_period_end : null;
    }
    paintDetail();
  }
  const refresh = () => {
    const box = TC.el('cl-detail');
    if (box && current) box.classList.add('cl-refreshing');
    return openClient(current.user.id).finally(() => { const b = TC.el('cl-detail'); if (b) b.classList.remove('cl-refreshing'); });
  };

  async function act(kind) {
    const u = current.user;
    try {
      if (kind === 'edit') {
        TC.modal.open({ title: 'Modifier le client', subtitle: 'Nom affiché et adresse de connexion', body: '<div class="form-grid">' + TC.fields([{ id: 'cle-nom', label: 'Nom complet', wide: true }, { id: 'cle-email', label: 'E-mail (adresse de connexion)', type: 'email', wide: true }]) + '</div><div class="note">Changer l’e-mail change l’adresse avec laquelle le client se connecte. Prévenez-le.</div>',
          afterOpen() { TC.setVal('cle-nom', u.nom || ''); TC.setVal('cle-email', u.email || ''); },
          async onSave() { try { await post({ action: 'profile', user_id: u.id, nom: TC.val('cle-nom'), email: TC.val('cle-email') }); TC.modal.close(); TC.toast('Client mis à jour', 'ok'); refresh(); load(); } catch (e) { TC.modal.msg(e.message, 'err'); } } });
        return;
      }
      if (kind === 'role') {
        const next = !u.is_admin;
        if (!confirm(next ? 'Donner les droits d’administration à ' + u.email + ' ?' : 'Retirer les droits d’administration de ' + u.email + ' ?')) return;
        await post({ action: 'role', user_id: u.id, is_admin: next });
        TC.toast('Rôle mis à jour', 'ok'); refresh(); return;
      }
      if (kind === 'note') {
        const note = (TC.val('cl-note') || '').trim();
        if (!note) return TC.toast('La note est vide.', 'err');
        await post({ action: 'note', user_id: u.id, note });
        tab = 'notes'; TC.toast('Note ajoutée', 'ok'); refresh(); return;
      }
      if (kind === 'email') {
        TC.modal.open({ title: 'Écrire à ' + (u.nom || u.email), subtitle: u.email + ' · la réponse du client arrivera sur votre adresse', saveLabel: 'Envoyer',
          body: '<div class="form-grid">' + TC.fields([{ id: 'clm-subject', label: 'Objet', wide: true }, { id: 'clm-body', label: 'Message', type: 'textarea', rows: 8, wide: true }]) + '</div><div class="note">L’e-mail part avec la mise en forme The Capital. Une copie est gardée dans les notes du client.</div>',
          async onSave() {
            try { await post({ action: 'email', user_id: u.id, subject: TC.val('clm-subject'), message: TC.val('clm-body') }); TC.modal.close(); TC.toast('E-mail envoyé', 'ok'); refresh(); }
            catch (e) { TC.modal.msg(e.message, 'err'); }
          } });
        return;
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

  async function trial(v) {
    const u = current.user;
    let body;
    if (v === 'date') {
      TC.modal.open({ title: 'Fin de l’essai', subtitle: u.email, body: '<div class="form-grid">' + TC.fields([{ id: 'clt-until', label: 'Essai jusqu’au', type: 'date' }]) + '</div>',
        afterOpen() { TC.setVal('clt-until', isoDay(u.trial_ends_at && Date.parse(u.trial_ends_at) > Date.now() ? u.trial_ends_at : Date.now() + 14 * DAY)); },
        async onSave() { try { await post({ action: 'trial', user_id: u.id, until: TC.val('clt-until') + 'T23:59:59Z' }); TC.modal.close(); TC.toast('Essai mis à jour', 'ok'); refresh(); load(); } catch (e) { TC.modal.msg(e.message, 'err'); } } });
      return;
    }
    const days = Number(v);
    if (days === 0 && !confirm('Terminer l’essai de ' + u.email + ' maintenant ?')) return;
    body = { action: 'trial', user_id: u.id, days };
    try {
      await post(body);
      TC.toast(days ? 'Essai prolongé de ' + days + ' jours' : 'Essai terminé', 'ok');
      refresh(); load();
    } catch (e) { TC.toast(e.message || 'Modification impossible', 'err'); }
  }

  /* Accès Invest / Institute depuis la fiche. */
  function assignModal(product) {
    const u = current.user, institute = product === 'institute', s = latest(current.subscriptions, institute);
    const choices = (plans || []).filter(p => p.active !== false && p.code !== 'all' && (institute ? p.code === 'institute' : p.code !== 'institute' && p.code !== 'free'));
    if (!choices.length) return TC.toast('Aucune formule active pour ce produit (voir « Formules & tarifs »).', 'err');
    const def = new Date(); def.setFullYear(def.getFullYear() + (institute ? 1 : 0)); if (!institute) def.setMonth(def.getMonth() + 1);
    TC.modal.open({
      title: (institute ? 'Institute' : 'Invest') + ' — ' + (s ? 'modifier l’accès' : 'attribuer un accès'), subtitle: u.email, saveLabel: 'Appliquer',
      body: '<div class="form-grid">' + TC.fields([
        { id: 'cla-plan', label: 'Formule', type: 'select', options: choices.map(p => ({ v: p.code, l: p.name || PLANS[p.code] || p.code })) },
        { id: 'cla-end', label: 'Accès jusqu’au', type: 'date' },
        { id: 'cla-note', label: 'Motif (inscrit dans l’historique)', wide: true, placeholder: 'Ex. paiement Wave reçu le …, geste commercial, partenariat…' }
      ]) + '</div><div class="cl-actions"><button type="button" class="btn btn-outline btn-sm" data-end="1">1 mois</button><button type="button" class="btn btn-outline btn-sm" data-end="3">3 mois</button><button type="button" class="btn btn-outline btn-sm" data-end="6">6 mois</button><button type="button" class="btn btn-outline btn-sm" data-end="12">1 an</button></div>' +
        '<div class="note">L’accès s’ouvre immédiatement. ' + (institute ? 'Seul Institute est modifié.' : 'Seul Invest est modifié ; l’offre du compte est mise à jour.') + '</div>',
      afterOpen() {
        TC.setVal('cla-plan', s && choices.some(p => p.code === s.plan_code) ? s.plan_code : choices[0].code);
        TC.setVal('cla-end', isoDay(s && s.current_period_end && Date.parse(s.current_period_end) > Date.now() ? s.current_period_end : def));
        document.querySelectorAll('[data-end]').forEach(b => b.addEventListener('click', () => { const x = new Date(); x.setMonth(x.getMonth() + Number(b.dataset.end)); TC.setVal('cla-end', isoDay(x)); }));
      },
      async onSave() {
        const end = TC.val('cla-end');
        if (!end) return TC.modal.msg('Choisissez une date de fin.', 'err');
        try {
          await billing({ action: 'assign', user_id: u.id, plan_code: TC.val('cla-plan'), current_period_end: end + 'T23:59:59Z', note: TC.val('cla-note') || null });
          const n = TC.val('cla-note');
          if (n) await post({ action: 'note', user_id: u.id, note: 'Accès ' + (institute ? 'Institute' : 'Invest') + ' (' + (PLANS[TC.val('cla-plan')] || TC.val('cla-plan')) + ' jusqu’au ' + end + ') : ' + n }).catch(() => {});
          TC.modal.close(); TC.toast('Accès appliqué', 'ok'); refresh(); load();
        } catch (e) { TC.modal.msg(e.message, 'err'); }
      }
    });
  }

  async function access(el) {
    const kind = el.dataset.access, sid = el.dataset.sub;
    if (kind === 'assign') return assignModal(el.dataset.product);
    const labels = { extend: 'Prolonger de ' + el.dataset.days + ' jours ?', suspend: 'Suspendre cet accès ? Le client le perd jusqu’à réactivation.', cancel: 'Retirer cet accès ? Il est annulé immédiatement.', reactivate: 'Réactiver cet accès ?' };
    if (!confirm(labels[kind] || 'Confirmer ?')) return;
    try {
      if (kind === 'reactivate') {
        const s = (current.subscriptions || []).find(x => x.id === sid);
        if (!s || !s.current_period_end || Date.parse(s.current_period_end) <= Date.now()) {
          /* Accès échu : on repart d'une nouvelle période via « attribuer ». */
          return assignModal(s && s.plan_code === 'institute' ? 'institute' : 'invest');
        }
      }
      await billing(kind === 'extend' ? { action: 'extend', subscription_id: sid, days: Number(el.dataset.days) } : { action: kind, subscription_id: sid });
      TC.toast({ extend: 'Accès prolongé', suspend: 'Accès suspendu', cancel: 'Accès retiré', reactivate: 'Accès réactivé' }[kind], 'ok');
      refresh(); load();
    } catch (e) { TC.toast(e.message || 'Action impossible', 'err'); }
  }

  function orderAction(kind, id) {
    const o = (current.payment_orders || []).find(x => x.id === id);
    if (!o) return;
    if (kind === 'cancel') {
      if (!confirm('Annuler cette commande non payée ?')) return;
      billing({ action: 'cancel_order', order_id: id }).then(() => { TC.toast('Commande annulée', 'ok'); refresh(); }).catch(e => TC.toast(e.message, 'err'));
      return;
    }
    TC.openConfirmOrder(o, current.user, () => { refresh(); load(); });
  }

  /* Confirmation d'un encaissement (partagée avec le module Paiements). */
  TC.openConfirmOrder = function (o, u, done) {
    TC.modal.open({
      title: 'Confirmer le paiement', subtitle: (u && u.email ? u.email + ' · ' : '') + (PLANS[o.plan_code] || o.plan_code) + ' ' + (PERIODS[o.billing_period] || '').toLowerCase() + ' · ' + money(o.amount), saveLabel: 'J’ai vérifié : activer l’accès',
      body: '<div style="padding:4px 0 10px"><div class="note"><strong>Avant de confirmer :</strong> dans Wave Business (ou le relevé du moyen de paiement), vérifiez qu’une transaction de <strong>' + money(o.amount) + '</strong> a bien été reçue et notez sa référence.</div></div>' +
        '<div class="form-grid">' + TC.fields([{ id: 'co-ref', label: 'Référence de la transaction', wide: true, placeholder: 'Référence Wave / Orange Money / virement' }, { id: 'co-note', label: 'Note (facultatif)', wide: true }]) + '</div>',
      async onSave() {
        const ref = (TC.val('co-ref') || '').trim();
        if (!ref) return TC.modal.msg('Indiquez la référence de la transaction reçue : elle sert de preuve.', 'err');
        try {
          const r = await TC.api(BILLING, { method: 'POST', body: { action: 'confirm_order', order_id: o.id, reference: ref, note: TC.val('co-note') || null }, timeout: 20000 });
          TC.modal.close(); TC.toast('Paiement confirmé : accès ouvert jusqu’au ' + d(r.data?.subscription?.current_period_end), 'ok');
          TC.api(API, { method: 'POST', body: { action: 'notify', user_id: o.user_id, kind: 'subscription_active', plan_name: PLANS[o.plan_code] || o.plan_code, end: r.data?.subscription?.current_period_end }, timeout: 15000 })
            .then(x => { if (x.data?.sent) TC.toast('Client prévenu par e-mail', 'ok'); }).catch(() => {});
          if (done) done();
        } catch (e) { TC.modal.msg(e.message, 'err'); }
      }
    });
  };

  /* Reçu affiché dans l'administration (lien signé), sans fenêtre surgissante. */
  TC.showReceipt = async function (proofId) {
    TC.modal.open({ title: 'Reçu de paiement', subtitle: 'Chargement…', readonly: true, body: '<div class="loading"><div class="spinner"></div>Chargement du reçu…</div>' });
    try {
      const r = await TC.api(BILLING + '&receipt=' + encodeURIComponent(proofId), { timeout: 15000 });
      const x = r.data || {};
      const body = document.getElementById('modal-body');
      if (body) body.innerHTML = '<div class="receipt-view">' + (x.kind === 'pdf' ? '<iframe src="' + esc(x.url) + '" title="Reçu PDF"></iframe>' : '<img src="' + esc(x.url) + '" alt="Reçu envoyé par le client">') +
        '<div class="cl-actions"><a class="btn btn-outline btn-sm" href="' + esc(x.url) + '" target="_blank" rel="noopener">Ouvrir en grand ↗</a></div></div>';
    } catch (e) {
      const body = document.getElementById('modal-body');
      if (body) body.innerHTML = '<div class="note err" style="margin:16px">Reçu illisible : ' + esc(e.message) + '</div>';
    }
  };

  function invite() {
    TC.modal.open({ title: 'Inviter un client', subtitle: 'Le client reçoit un e-mail pour créer son mot de passe', saveLabel: 'Envoyer l’invitation',
      body: '<div class="form-grid">' + TC.fields([{ id: 'cli-email', label: 'E-mail', type: 'email' }, { id: 'cli-nom', label: 'Nom complet' }]) + '</div><div class="note">Le compte démarre en offre Découverte avec l’essai gratuit habituel. Vous pourrez ensuite lui attribuer un accès depuis sa fiche.</div>',
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

  /* Ouvrir une fiche depuis un autre module (journal, paiements, abonnements). */
  TC.openClient = function (id) {
    /* Déjà sur la page Clients : le module n'est pas remonté, ouvrir directement. */
    if (TC.el('cl-detail')) { tab = 'profil'; openClient(id); return; }
    TC.__pendingClient = id;
    if (TC.module('utilisateurs')) TC.go('utilisateurs');
  };

  TC.register({
    id: 'utilisateurs', label: 'Clients', group: 'gestion', icon: '☰',
    keywords: 'utilisateur client compte admin identité essai suspension mot de passe notes accès abonnement',
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
        const tr = t.closest('[data-trial]'); if (tr) { trial(tr.dataset.trial); return; }
        const ac = t.closest('[data-access]'); if (ac) { access(ac); return; }
        const od = t.closest('[data-order]'); if (od) { orderAction(od.dataset.order, od.dataset.id); return; }
        const rc = t.closest('[data-receipt]'); if (rc) { TC.showReceipt(rc.dataset.receipt); return; }
        const g = t.closest('[data-goto]'); if (g) { goto(g.dataset.goto); return; }
        const nd = t.closest('[data-note-del]');
        if (nd) { e.preventDefault(); if (confirm('Supprimer cette note ?')) post({ action: 'note_delete', user_id: current.user.id, note_id: Number(nd.dataset.noteDel) }).then(refresh).catch(err => TC.toast(err.message, 'err')); }
      });
      load();
      if (TC.__pendingClient) { const id = TC.__pendingClient; TC.__pendingClient = null; openClient(id); }
    }
  });

  /* ============================================================
     JOURNAL D'ADMINISTRATION — toutes les actions, lisibles :
     qui, quoi, sur quel client, avant → après.
     ============================================================ */
  let entries = [];
  function journalView() {
    return '<div class="page-head"><div><div class="page-title">Journal <em>d’administration</em></div><div class="page-sub">Chaque action d’administration, avec son auteur, le client ou l’objet concerné et le détail avant → après : accès attribués, paiements confirmés, essais, profils, formules, options, et modifications des données de marché.</div></div><div class="page-actions"><button class="btn btn-outline btn-sm" id="jr-export">⬇ CSV</button><button class="btn btn-outline btn-sm" id="jr-reload">↺</button></div></div>' +
      '<div class="kpis" id="jr-kpis"></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Actions</span><span class="card-tools"><input type="search" id="jr-search" placeholder="Client, action, détail…">' +
      '<select id="jr-filter"><option value="">Toutes</option><option value="clients">Clients & accès</option><option value="paiements">Paiements</option><option value="config">Formules & options</option><option value="donnees">Données de marché</option></select>' +
      '<span class="card-count" id="jr-count"></span></span></div><div class="tw capped"><table><thead><tr><th>Date</th><th>Action</th><th>Client</th><th>Détail (avant → après)</th><th>Par</th></tr></thead><tbody id="jr-tbody">' + TC.rowsLoading(5) + '</tbody></table></div>' +
      '<div class="card-body"><button class="btn btn-outline btn-sm" id="jr-more">Charger les actions plus anciennes</button></div></div>';
  }
  const family = e => /^(user_|subscription_|institute_)/.test(e.action) ? 'clients' : /^(payment|order_)/.test(e.action) || /^payment/.test(e.table_name) ? 'paiements' : /^(app_config|billing_plan)/.test(e.action) ? 'config' : 'donnees';
  async function journalLoad(more) {
    const tbody = TC.el('jr-tbody');
    if (!more && tbody) tbody.innerHTML = TC.rowsLoading(5);
    try {
      const before = more && entries.length ? '&before=' + encodeURIComponent(entries[entries.length - 1].created_at) : '';
      const r = await TC.api(API + '&journal=1&limit=300' + before, { timeout: 20000 });
      const got = r.data?.entries || [];
      entries = more ? entries.concat(got) : got;
      const btn = TC.el('jr-more'); if (btn) btn.hidden = got.length < 300;
      journalPaint();
    } catch (e) { if (tbody) tbody.innerHTML = TC.rowsEmpty(5, 'Journal indisponible', e.message || ''); }
  }
  function journalFiltered() {
    const q = (TC.val('jr-search') || '').toLowerCase().trim(), f = TC.val('jr-filter') || '';
    return entries.filter(e => (!f || family(e) === f) && (!q || ((ACTIONS[e.action] || e.action) + ' ' + (e.target ? e.target.email + ' ' + (e.target.nom || '') : '') + ' ' + describe(e) + ' ' + (e.actor ? e.actor.email : '') + ' ' + (TABLES[e.table_name] || e.table_name)).toLowerCase().includes(q)));
  }
  function journalPaint() {
    const day = Date.now() - DAY, week = Date.now() - 7 * DAY;
    TC.el('jr-kpis').innerHTML = [['Actions chargées', entries.length], ['Dernières 24 h', entries.filter(e => Date.parse(e.created_at) > day).length], ['7 derniers jours', entries.filter(e => Date.parse(e.created_at) > week).length], ['Paiements confirmés', entries.filter(e => e.action === 'payment_confirm').length], ['Accès attribués', entries.filter(e => /assign|grant/.test(e.action)).length]]
      .map(x => '<div class="kpi"><div class="kpi-label">' + x[0] + '</div><div class="kpi-value sm">' + x[1] + '</div></div>').join('');
    const list = journalFiltered();
    TC.el('jr-count').textContent = list.length + ' action(s)';
    TC.el('jr-tbody').innerHTML = list.length ? list.map(e => auditRow(e, true)).join('') : TC.rowsEmpty(5, 'Aucune action', 'Aucune action ne correspond aux filtres.');
  }
  function journalCsv() {
    const list = journalFiltered();
    if (!list.length) return;
    const out = list.map(e => ({ date: e.created_at, action: ACTIONS[e.action] || e.action, objet: TABLES[e.table_name] || e.table_name, client: e.target ? e.target.email : '', detail: describe(e), par: e.actor ? e.actor.email : (e.actor_id || '') }));
    TC.download('journal-admin-' + TC.today() + '.csv', TC.toCSV(out, Object.keys(out[0])), 'text/csv;charset=utf-8');
  }
  TC.register({
    id: 'journal', label: 'Journal d’administration', group: 'pilotage', icon: '≣',
    keywords: 'journal audit historique actions log traces qui a fait',
    view: journalView, refresh: () => journalLoad(false),
    mount() {
      entries = [];
      TC.on('jr-reload', 'click', () => journalLoad(false));
      TC.on('jr-more', 'click', () => journalLoad(true));
      TC.on('jr-export', 'click', journalCsv);
      TC.on('jr-search', 'input', journalPaint);
      TC.on('jr-filter', 'change', journalPaint);
      TC.on('jr-tbody', 'click', e => { const c = e.target.closest('[data-client]'); if (c) { e.preventDefault(); TC.openClient(c.dataset.client); } });
      journalLoad(false);
    }
  });
})(window.TC);
