'use strict';
/* ============================================================
   THE CAPITAL INSTITUTE — étudiants, accès et progression.
   Accès gérés ici ou depuis la fiche client (même API, même
   journal) : /api/user-data?mode=admin-billing. La progression est
   propre à chaque compte (table institute_progress, une ligne par
   client).
   ============================================================ */
(function (TC) {
  const BILLING = '/api/user-data?mode=admin-billing';
  const MASTER = 'diopibrahimabdallah@gmail.com';
  const DAY = 86400000;
  let state = { rows: [], stats: {} }, allUsers = null;
  const esc = v => TC.esc(v == null ? '' : String(v));
  const date = v => v ? TC.fmtDate(v) : '—';
  const isoDay = v => new Date(v).toISOString().slice(0, 10);
  const isMaster = () => String(TC.session?.user?.email || '').trim().toLowerCase() === MASTER;
  const ST = { active: ['Actif', 'badge-green'], paused: ['Suspendu', 'badge-orange'], canceled: ['Retiré', 'badge-red'], expired: ['Expiré', 'badge-grey'] };

  function statusOf(r) {
    const s = r.subscription || {};
    if (s.status === 'active' && !r.access_active) return 'expired';
    return s.status || 'expired';
  }

  function view() {
    return '<div class="page-head"><div><div class="page-title">The Capital <em>Institute</em></div><div class="page-sub">Étudiants, accès et progression. Chaque étudiant a sa propre progression, liée à son compte et synchronisée sur tous ses appareils. Toutes les actions sont inscrites dans le journal d’administration.</div></div><div class="page-actions">' +
      (isMaster() ? '<button class="btn btn-primary btn-sm" id="inst-grant">+ Accorder l’accès Institute</button>' : '<span class="badge badge-orange">Lecture seule</span>') +
      '<button class="btn btn-outline btn-sm" id="inst-reload">↺</button></div></div>' +
      '<div class="kpis" id="inst-kpis"></div><div class="card"><div class="card-head"><span class="card-title">Étudiants</span><span class="card-tools"><input id="inst-search" type="search" placeholder="Email ou nom…"><select id="inst-filter"><option value="">Tous</option><option value="active">Actifs</option><option value="expired">Expirés</option><option value="paused">Suspendus</option><option value="canceled">Retirés</option></select><span class="card-count" id="inst-count"></span></span></div>' +
      '<div class="tw capped"><table><thead><tr><th>Étudiant</th><th>Statut</th><th>Début</th><th>Fin d’accès</th><th>Parcours</th><th>Leçons</th><th>XP</th><th>Dernière activité</th><th></th></tr></thead><tbody id="inst-tbody">' + TC.rowsLoading(9) + '</tbody></table></div></div>';
  }

  function load() {
    const tbody = TC.el('inst-tbody');
    if (tbody) tbody.innerHTML = TC.rowsLoading(9);
    return TC.api('/api/user-data?mode=admin-institute', { timeout: 20000 }).then(res => { const d = res.data || {}; state = { rows: d.rows || [], stats: d.stats || {} }; paint(); })
      .catch(e => { if (tbody) tbody.innerHTML = TC.rowsEmpty(9, 'Impossible de charger Institute', e.message || 'Erreur API'); });
  }

  function paint() {
    const st = state.stats;
    TC.el('inst-kpis').innerHTML = [['Étudiants', st.students || 0], ['Accès actifs', st.active || 0], ['Sans accès actif', st.expired || 0], ['Parcours terminés', st.courses_completed || 0], ['Leçons terminées', st.lessons_completed || 0]]
      .map(x => '<div class="kpi"><div class="kpi-label">' + x[0] + '</div><div class="kpi-value sm">' + x[1] + '</div></div>').join('');
    filter();
  }

  function filter() {
    const q = (TC.val('inst-search') || '').toLowerCase().trim(), f = TC.val('inst-filter') || '';
    const list = state.rows.filter(r => {
      const hay = ((r.user && r.user.email || '') + ' ' + (r.user && r.user.nom || '')).toLowerCase();
      return (!q || hay.indexOf(q) >= 0) && (!f || statusOf(r) === f);
    });
    TC.el('inst-count').textContent = list.length + ' étudiant(s)';
    TC.el('inst-tbody').innerHTML = list.length ? list.map(r => {
      const p = r.progress || {}, s = r.subscription || {}, key = statusOf(r), x = ST[key] || [key, 'badge-grey'];
      const courses = Array.isArray(p.completed_courses) ? p.completed_courses.length : 0, lessons = Array.isArray(p.completed_lessons) ? p.completed_lessons.length : 0;
      const days = s.current_period_end ? Math.ceil((Date.parse(s.current_period_end) - Date.now()) / DAY) : null;
      const acts = isMaster() ? '<button class="btn btn-outline btn-sm" data-edit="' + esc(s.id) + '">Gérer</button>' : '';
      return '<tr><td><a href="#" data-client="' + esc(s.user_id) + '"><strong>' + esc(r.user && (r.user.nom || r.user.email) || s.user_id) + '</strong></a><br><span class="td-muted">' + esc(r.user && r.user.email || '') + '</span></td>' +
        '<td><span class="badge ' + x[1] + '">' + esc(x[0]) + '</span></td><td>' + date(s.started_at) + '</td><td>' + date(s.current_period_end) + (key === 'active' && days != null ? '<br><span class="td-muted" style="font-size:11px">' + days + ' j</span>' : '') + '</td>' +
        '<td>' + courses + '</td><td>' + lessons + '</td><td>' + (p.xp || 0) + '</td><td>' + date(p.last_activity_at) + '</td><td class="r">' + acts + '</td></tr>';
    }).join('') : TC.rowsEmpty(9, 'Aucun étudiant', 'Aucun accès Institute enregistré.');
  }

  const billing = body => TC.api(BILLING, { method: 'POST', body, timeout: 20000 });

  async function grant(preset) {
    if (!allUsers) {
      try { allUsers = await TC.getAll('users', 'select=id,email,nom&order=email.asc'); } catch (e) { return TC.toast(e.message, 'err'); }
    }
    const def = new Date(); def.setFullYear(def.getFullYear() + 1);
    TC.modal.open({
      title: 'Accorder l’accès Institute', subtitle: 'Accès formation, indépendant de l’offre Invest', saveLabel: 'Accorder',
      body: '<div class="form-grid">' + TC.fields([
        { id: 'ig-user', label: 'Client', type: 'select', wide: true, options: (allUsers || []).map(u => ({ v: u.id, l: (u.nom ? u.nom + ' · ' : '') + u.email })) },
        { id: 'ig-end', label: 'Accès jusqu’au', type: 'date' }
      ]) + '</div><div class="cl-actions"><button type="button" class="btn btn-outline btn-sm" data-m="1">1 mois</button><button type="button" class="btn btn-outline btn-sm" data-m="6">6 mois</button><button type="button" class="btn btn-outline btn-sm" data-m="12">1 an</button></div>',
      afterOpen() {
        if (preset) TC.setVal('ig-user', preset);
        TC.setVal('ig-end', isoDay(def));
        document.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { const x = new Date(); x.setMonth(x.getMonth() + Number(b.dataset.m)); TC.setVal('ig-end', isoDay(x)); }));
      },
      async onSave() {
        const end = TC.val('ig-end');
        if (!end) return TC.modal.msg('Choisissez une date de fin.', 'err');
        try { await billing({ action: 'assign', user_id: TC.val('ig-user'), plan_code: 'institute', current_period_end: end + 'T23:59:59Z' }); TC.modal.close(); TC.toast('Accès Institute accordé', 'ok'); load(); }
        catch (e) { TC.modal.msg(e.message, 'err'); }
      }
    });
  }

  function edit(sid) {
    const r = state.rows.find(x => String(x.subscription && x.subscription.id) === String(sid));
    if (!r) return;
    const s = r.subscription, key = statusOf(r);
    TC.modal.open({
      title: r.user ? (r.user.nom || r.user.email) : s.user_id, subtitle: 'Institute · ' + (ST[key] || [key])[0] + ' · fin ' + date(s.current_period_end), saveLabel: 'Enregistrer la date',
      body: '<div class="form-grid">' + TC.fields([{ id: 'ie-end', label: 'Accès jusqu’au', type: 'date' }]) + '</div>' +
        '<div class="cl-actions"><button type="button" class="btn btn-outline btn-sm" data-x="30">+30 j</button><button type="button" class="btn btn-outline btn-sm" data-x="90">+90 j</button><button type="button" class="btn btn-outline btn-sm" data-x="365">+1 an</button></div>' +
        '<div class="cl-actions">' + (s.status === 'active' ? '<button type="button" class="btn btn-orange btn-sm" data-y="suspend">Suspendre</button><button type="button" class="btn btn-danger btn-sm" data-y="cancel">Retirer l’accès</button>' : '<button type="button" class="btn btn-green btn-sm" data-y="reactivate">Réactiver</button>') + '</div>' +
        '<div class="note">Enregistrer la date remet l’accès en « actif » jusqu’à cette date. La progression de l’étudiant est conservée quoi qu’il arrive.</div>',
      afterOpen() {
        TC.setVal('ie-end', s.current_period_end ? isoDay(s.current_period_end) : isoDay(Date.now() + 365 * DAY));
        document.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => run({ action: 'extend', subscription_id: s.id, days: Number(b.dataset.x) }, 'Accès prolongé')));
        document.querySelectorAll('[data-y]').forEach(b => b.addEventListener('click', () => {
          const y = b.dataset.y;
          if (y === 'reactivate' && (!s.current_period_end || Date.parse(s.current_period_end) <= Date.now())) return TC.modal.msg('Accès échu : choisissez une nouvelle date puis « Enregistrer la date ».', 'err');
          if (y !== 'reactivate' && !confirm(y === 'cancel' ? 'Retirer l’accès Institute de ce client ?' : 'Suspendre l’accès Institute ?')) return;
          run({ action: y, subscription_id: s.id }, { suspend: 'Accès suspendu', cancel: 'Accès retiré', reactivate: 'Accès réactivé' }[y]);
        }));
      },
      onSave() {
        const end = TC.val('ie-end');
        if (!end) return TC.modal.msg('Choisissez une date.', 'err');
        return run({ action: 'update', subscription_id: s.id, status: 'active', current_period_end: end + 'T23:59:59Z' }, 'Accès mis à jour');
      }
    });
  }

  function run(body, msg) {
    return billing(body).then(() => { TC.modal.close(); TC.toast(msg, 'ok'); load(); }).catch(e => TC.modal.msg(e.message, 'err'));
  }

  function bind() {
    TC.on('inst-reload', 'click', load);
    TC.on('inst-grant', 'click', () => grant());
    TC.on('inst-search', 'input', filter);
    TC.on('inst-filter', 'change', filter);
    TC.on('inst-tbody', 'click', e => {
      const c = e.target.closest('[data-client]'); if (c) { e.preventDefault(); if (TC.openClient) TC.openClient(c.dataset.client); return; }
      const b = e.target.closest('[data-edit]'); if (b) edit(b.dataset.edit);
    });
  }
  TC.register({ id: 'institute', label: 'The Capital Institute', group: 'gestion', icon: '◈', keywords: 'institute étudiants formation progression cours xp badges suivi accès', view, mount() { bind(); load(); }, refresh: load });
})(window.TC);
