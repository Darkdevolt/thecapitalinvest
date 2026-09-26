'use strict';
/* ============================================================
   MESSAGES CLIENTS — demandes reçues par le formulaire de contact
   (table contacts) et journal des actions d'administration.
   ============================================================ */
(function (TC) {
  let msgs = [], logs = [], users = {};
  const esc = v => TC.esc(v == null ? '' : String(v));
  const dt = v => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  /* ── Messages ────────────────────────────────────────── */
  function viewMsgs() {
    return '<div class="page-head"><div><div class="page-title">Messages <em>clients</em></div><div class="page-sub">Demandes envoyées depuis le formulaire de contact du site. Répondez par e-mail puis marquez la demande comme traitée.</div></div><div class="page-actions"><button class="btn btn-outline btn-sm" id="sup-export">⬇ CSV</button><button class="btn btn-outline btn-sm" id="sup-reload">↺</button></div></div>' +
      '<div class="kpis" id="sup-kpis"></div><div class="card"><div class="card-head"><span class="card-title">Demandes</span><span class="card-tools"><input type="search" id="sup-search" placeholder="Nom, e-mail, objet…"><select id="sup-filter"><option value="open">À traiter</option><option value="">Toutes</option><option value="done">Traitées</option></select><span class="card-count" id="sup-count"></span></span></div>' +
      '<div class="tw capped"><table><thead><tr><th>Date</th><th>De</th><th>Objet</th><th>Message</th><th>Statut</th><th></th></tr></thead><tbody id="sup-tbody">' + TC.rowsLoading(6) + '</tbody></table></div></div>';
  }
  async function loadMsgs() { msgs = (await TC.get('contacts', 'select=*&order=created_at.desc&limit=1000')) || []; paintMsgs(); }
  function paintMsgs() {
    const open = msgs.filter(m => !m.traite);
    TC.el('sup-kpis').innerHTML = '<div class="kpi"><div class="kpi-label">À traiter</div><div class="kpi-value sm">' + open.length + '</div></div><div class="kpi"><div class="kpi-label">Reçues 30 j</div><div class="kpi-value sm">' + msgs.filter(m => Date.parse(m.created_at) > Date.now() - 30 * 86400000).length + '</div></div><div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value sm">' + msgs.length + '</div></div>';
    const q = (TC.val('sup-search') || '').toLowerCase().trim(), f = TC.val('sup-filter');
    const list = msgs.filter(m => (!q || [m.prenom, m.nom, m.email, m.objet, m.message].join(' ').toLowerCase().includes(q)) && (f === 'open' ? !m.traite : f === 'done' ? m.traite : true));
    TC.el('sup-count').textContent = list.length + ' demande(s)';
    TC.el('sup-tbody').innerHTML = list.length ? list.map(m => '<tr><td class="td-mono">' + dt(m.created_at) + '</td><td><strong>' + esc([m.prenom, m.nom].filter(Boolean).join(' ') || '—') + '</strong><br><span class="td-muted">' + esc(m.email) + '</span></td><td>' + esc(m.objet || '—') + '</td><td class="td-muted" style="max-width:360px">' + esc(String(m.message || '').slice(0, 140)) + (String(m.message || '').length > 140 ? '…' : '') + '</td><td>' + (m.traite ? '<span class="badge badge-green">Traitée</span>' : '<span class="badge badge-orange">À traiter</span>') + '</td><td class="r"><button class="btn btn-outline btn-sm" data-open="' + m.id + '">Ouvrir</button></td></tr>').join('') : TC.rowsEmpty(6, f === 'open' ? 'Aucune demande en attente' : 'Aucune demande', '');
  }
  function openMsg(id) {
    const m = msgs.find(x => String(x.id) === String(id));
    if (!m) return;
    const subject = 'Re: ' + (m.objet || 'Votre message à The Capital');
    TC.modal.open({
      title: m.objet || 'Message', subtitle: [m.prenom, m.nom].filter(Boolean).join(' ') + ' · ' + m.email + ' · ' + dt(m.created_at),
      saveLabel: m.traite ? 'Rouvrir' : 'Marquer comme traitée',
      body: '<div style="padding:16px 24px"><div class="cl-note" style="white-space:pre-wrap">' + esc(m.message) + '</div><div class="cl-actions"><a class="btn btn-primary btn-sm" href="mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent(subject) + '">Répondre par e-mail</a><button class="btn btn-danger btn-sm" id="sup-del">Supprimer</button></div></div>',
      afterOpen() {
        TC.on('sup-del', 'click', async () => {
          if (!confirm('Supprimer définitivement ce message ?')) return;
          try { await TC.del('contacts', 'id=eq.' + m.id); TC.modal.close(); TC.toast('Message supprimé', 'ok'); loadMsgs(); } catch (e) { TC.modal.msg(e.message, 'err'); }
        });
      },
      async onSave() {
        try { await TC.patch('contacts', 'id=eq.' + m.id, { traite: !m.traite }); TC.modal.close(); TC.toast(m.traite ? 'Demande rouverte' : 'Demande traitée', 'ok'); loadMsgs(); } catch (e) { TC.modal.msg(e.message, 'err'); }
      }
    });
  }

  /* ── Journal d'administration ────────────────────────── */
  const LABELS = {
    subscription_assign: 'Abonnement attribué', subscription_extend: 'Abonnement prolongé', subscription_update: 'Abonnement modifié',
    subscription_cancel: 'Abonnement annulé', subscription_suspend: 'Abonnement suspendu', subscription_reactivate: 'Abonnement réactivé',
    institute_grant: 'Accès Institute attribué', institute_extend: 'Institute prolongé', institute_remove: 'Institute retiré',
    user_invite: 'Client invité', user_profile: 'Profil modifié', user_reset_password: 'Réinitialisation du mot de passe', user_magic_link: 'Lien de connexion créé',
    user_suspend: 'Compte suspendu', user_unsuspend: 'Compte réactivé', user_delete: 'Compte supprimé', user_confirm_email: 'E-mail confirmé',
    app_config_update: 'Options de l’app modifiées', billing_plan_update: 'Formule modifiée'
  };
  function viewLog() {
    return '<div class="page-head"><div><div class="page-title">Journal <em>d’administration</em></div><div class="page-sub">Qui a fait quoi, quand : abonnements, comptes clients, options et formules.</div></div><div class="page-actions"><button class="btn btn-outline btn-sm" id="log-reload">↺</button></div></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Actions</span><span class="card-tools"><input type="search" id="log-search" placeholder="Action, table, identifiant…"><span class="card-count" id="log-count"></span></span></div><div class="tw capped"><table><thead><tr><th>Date</th><th>Action</th><th>Par</th><th>Élément</th><th></th></tr></thead><tbody id="log-tbody">' + TC.rowsLoading(5) + '</tbody></table></div></div>';
  }
  async function loadLog() {
    const [l, u] = await Promise.all([TC.get('admin_audit_log', 'select=*&order=created_at.desc&limit=1000'), TC.getAll('users', 'select=id,email,nom')]);
    logs = l || []; users = Object.fromEntries((u || []).map(x => [x.id, x])); paintLog();
  }
  function paintLog() {
    const q = (TC.val('log-search') || '').toLowerCase().trim();
    const list = logs.filter(x => !q || [x.action, LABELS[x.action], x.table_name, x.record_id, users[x.actor_id]?.email, users[x.record_id]?.email].join(' ').toLowerCase().includes(q));
    TC.el('log-count').textContent = list.length + ' action(s)';
    TC.el('log-tbody').innerHTML = list.length ? list.map((x, i) => {
      const target = users[x.record_id] ? users[x.record_id].email : (x.table_name + ' · ' + String(x.record_id || '').slice(0, 24));
      return '<tr><td class="td-mono">' + dt(x.created_at) + '</td><td>' + esc(LABELS[x.action] || x.action) + '</td><td class="td-muted">' + esc(users[x.actor_id]?.email || (x.actor_id ? String(x.actor_id).slice(0, 8) : 'système')) + '</td><td class="td-muted">' + esc(target) + '</td><td class="r">' + (x.old_data || x.new_data ? '<button class="btn btn-outline btn-sm" data-i="' + logs.indexOf(x) + '">Détail</button>' : '') + '</td></tr>';
    }).join('') : TC.rowsEmpty(5, 'Aucune action', '');
  }
  function detail(i) {
    const x = logs[i]; if (!x) return;
    const pre = v => '<pre style="white-space:pre-wrap;font:11px var(--mono);max-height:240px;overflow:auto;background:rgba(0,0,0,.3);padding:10px;border-radius:5px">' + esc(JSON.stringify(v, null, 2)) + '</pre>';
    TC.modal.open({ title: LABELS[x.action] || x.action, subtitle: dt(x.created_at), readonly: true, body: '<div style="padding:16px 24px"><div class="hint">Avant</div>' + pre(x.old_data) + '<div class="hint" style="margin-top:10px">Après</div>' + pre(x.new_data) + '</div>' });
  }

  TC.register({
    id: 'support', label: 'Messages clients', group: 'gestion', icon: '✉',
    keywords: 'contact messages support demandes clients',
    view: viewMsgs, refresh: loadMsgs,
    mount() {
      TC.on('sup-reload', 'click', loadMsgs); TC.on('sup-search', 'input', paintMsgs); TC.on('sup-filter', 'change', paintMsgs);
      TC.on('sup-tbody', 'click', e => { const b = e.target.closest('[data-open]'); if (b) openMsg(b.dataset.open); });
      TC.on('sup-export', 'click', () => { if (msgs.length) TC.download('messages-' + TC.today() + '.csv', TC.toCSV(msgs, ['created_at', 'prenom', 'nom', 'email', 'objet', 'message', 'traite']), 'text/csv;charset=utf-8'); });
      loadMsgs();
    }
  });
  TC.register({
    id: 'journal', label: 'Journal admin', group: 'gestion', icon: '≡',
    keywords: 'audit journal historique actions administration traçabilité',
    view: viewLog, refresh: loadLog,
    mount() { TC.on('log-reload', 'click', loadLog); TC.on('log-search', 'input', paintLog); TC.on('log-tbody', 'click', e => { const b = e.target.closest('[data-i]'); if (b) detail(Number(b.dataset.i)); }); loadLog(); }
  });
})(window.TC);
