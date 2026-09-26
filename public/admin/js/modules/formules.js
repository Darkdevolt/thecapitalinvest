'use strict';
/* ============================================================
   FORMULES & TARIFS — prix, description, avantages et visibilité
   des formules (table billing_plans), sans toucher au code.
   ============================================================ */
(function (TC) {
  const MASTER = 'diopibrahimabdallah@gmail.com';
  const API = '/api/user-data?mode=admin-settings';
  const PERIODS = [['weekly_price', 'Semaine'], ['monthly_price', 'Mois'], ['quarterly_price', 'Trimestre'], ['semiannual_price', 'Semestre'], ['annual_price', 'An']];
  let plans = [];
  const esc = v => TC.esc(v == null ? '' : String(v));
  const isMaster = () => String(TC.session?.user?.email || '').trim().toLowerCase() === MASTER;
  const price = v => v == null || v === '' ? '—' : new Intl.NumberFormat('fr-FR').format(Number(v)) + ' F';

  function view() {
    return '<div class="page-head"><div><div class="page-title">Formules <em>& tarifs</em></div><div class="page-sub">Prix par période, description, liste des avantages et visibilité de chaque formule. Un changement de prix vaut pour les nouvelles souscriptions ; les abonnements en cours ne sont pas modifiés.</div></div>' +
      '<div class="page-actions">' + (isMaster() ? '' : '<span class="badge badge-orange">Lecture seule</span>') + '<button class="btn btn-outline btn-sm" id="pl-reload">↺</button></div></div>' +
      '<div class="card"><div class="tw"><table><thead><tr><th>Formule</th><th>Code</th>' + PERIODS.map(p => '<th class="r">' + p[1] + '</th>').join('') + '<th>Avantages</th><th>Statut</th><th></th></tr></thead><tbody id="pl-tbody">' + TC.rowsLoading(PERIODS.length + 5) + '</tbody></table></div></div>' +
      '<div class="note">Les formules désactivées ne sont plus proposées à l’achat ni attribuables, mais les clients qui les ont gardent leur accès jusqu’à échéance.</div>';
  }

  async function load() {
    try {
      const res = await TC.api(API, { timeout: 15000 });
      plans = res.data?.plans || [];
      paint();
    } catch (e) { TC.el('pl-tbody').innerHTML = TC.rowsEmpty(PERIODS.length + 5, 'Formules indisponibles', e.message); }
  }

  function paint() {
    TC.el('pl-tbody').innerHTML = plans.length ? plans.map(p => '<tr><td><strong>' + esc(p.name) + '</strong>' + (p.description ? '<br><span class="td-muted" style="font-size:11px">' + esc(p.description).slice(0, 90) + '</span>' : '') + '</td><td class="td-mono td-muted">' + esc(p.code) + '</td>' +
      PERIODS.map(x => '<td class="r td-mono">' + price(p[x[0]]) + '</td>').join('') +
      '<td class="td-muted">' + (Array.isArray(p.features) ? p.features.length : 0) + '</td>' +
      '<td><span class="badge ' + (p.active ? 'badge-green' : 'badge-grey') + '">' + (p.active ? 'Active' : 'Désactivée') + '</span></td>' +
      '<td class="r">' + (isMaster() ? '<button class="btn btn-outline btn-sm" data-edit="' + esc(p.code) + '">Modifier</button>' : '') + '</td></tr>').join('') : TC.rowsEmpty(PERIODS.length + 5, 'Aucune formule', '');
  }

  function edit(code) {
    const p = plans.find(x => x.code === code);
    if (!p) return;
    TC.modal.open({
      title: 'Formule ' + p.name, subtitle: 'Code ' + p.code + ' · prix en FCFA, vide = période non proposée',
      body: '<div class="form-grid">' + TC.fields([
        { id: 'pl-name', label: 'Nom affiché' },
        { id: 'pl-order', label: 'Ordre d’affichage', type: 'number', step: '1' }
      ].concat(PERIODS.map(x => ({ id: 'pl-' + x[0], label: 'Prix / ' + x[1].toLowerCase(), type: 'number', step: '1' }))).concat([
        { id: 'pl-active', label: 'Statut', type: 'select', options: [{ v: 'true', l: 'Active (proposée)' }, { v: 'false', l: 'Désactivée' }] },
        { id: 'pl-desc', label: 'Description', type: 'textarea', rows: 2, wide: true },
        { id: 'pl-features', label: 'Avantages (un par ligne)', type: 'textarea', rows: 6, wide: true }
      ])) + '</div>',
      afterOpen() {
        TC.setVal('pl-name', p.name); TC.setVal('pl-order', p.display_order ?? '');
        PERIODS.forEach(x => TC.setVal('pl-' + x[0], p[x[0]] ?? ''));
        TC.setVal('pl-active', String(!!p.active)); TC.setVal('pl-desc', p.description || '');
        TC.setVal('pl-features', (Array.isArray(p.features) ? p.features : []).map(f => typeof f === 'string' ? f : (f.label || f.name || JSON.stringify(f))).join('\n'));
      },
      async onSave() {
        const plan = { name: TC.val('pl-name'), display_order: TC.val('pl-order'), active: TC.val('pl-active') === 'true', description: TC.val('pl-desc'), features: TC.val('pl-features').split('\n') };
        PERIODS.forEach(x => { plan[x[0]] = TC.val('pl-' + x[0]) === '' ? null : Number(TC.val('pl-' + x[0])); });
        if (!plan.active && p.active && !confirm('Désactiver la formule « ' + p.name + ' » ? Elle ne sera plus proposée à l’achat.')) return;
        try {
          await TC.api(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'plan', code: p.code, plan }), timeout: 15000 });
          TC.modal.close(); TC.toast('Formule enregistrée', 'ok'); load();
        } catch (e) { TC.modal.msg(e.message, 'err'); }
      }
    });
  }

  TC.register({
    id: 'formules', label: 'Formules & tarifs', group: 'gestion', icon: '◇',
    keywords: 'formules tarifs prix plans pro elite investor abonnement offre',
    view, refresh: load,
    mount() { TC.on('pl-reload', 'click', load); TC.on('pl-tbody', 'click', e => { const b = e.target.closest('[data-edit]'); if (b) edit(b.dataset.edit); }); load(); }
  });
})(window.TC);
