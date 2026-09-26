'use strict';
/* ============================================================
   OPTIONS DE L'APPLICATION — maintenance, bandeau d'annonce,
   inscriptions, durée d'essai, contacts du support.
   Lues par l'application via /api/user-data?mode=public-config.
   ============================================================ */
(function (TC) {
  const MASTER = 'diopibrahimabdallah@gmail.com';
  const API = '/api/user-data?mode=admin-settings';
  let cfg = null, other = [], updatedAt = null;
  const esc = v => TC.esc(v == null ? '' : String(v));
  const isMaster = () => String(TC.session?.user?.email || '').trim().toLowerCase() === MASTER;

  const sw = (id, label, text) => '<div class="opt-row"><div class="opt-text"><strong>' + label + '</strong><span>' + text + '</span></div><label class="switch"><input type="checkbox" id="' + id + '"' + (isMaster() ? '' : ' disabled') + '><i></i></label></div>';

  function view() {
    return '<div class="page-head"><div><div class="page-title">Options de <em>l’application</em></div><div class="page-sub">Ce que voient les clients : maintenance, annonce en haut de l’application, ouverture des inscriptions, durée de l’essai gratuit et contacts du support. Les changements s’appliquent en moins d’une minute.</div></div>' +
      '<div class="page-actions">' + (isMaster() ? '<button class="btn btn-primary btn-sm" id="opt-save">Enregistrer</button>' : '<span class="badge badge-orange">Lecture seule</span>') + '<button class="btn btn-outline btn-sm" id="opt-reload">↺</button></div></div>' +
      '<div id="opt-state" class="note" style="margin-bottom:16px">Chargement…</div>' +
      '<div class="grid-2">' +
      '<div class="card"><div class="card-head"><span class="card-title">Disponibilité</span></div><div class="card-body">' +
      sw('opt-maintenance', 'Mode maintenance', 'L’application affiche un écran de maintenance aux clients. Les administrateurs gardent l’accès.') +
      '<div class="field wide" style="margin-top:10px"><label for="opt-maintenance-msg">Message de maintenance</label><textarea id="opt-maintenance-msg" rows="2"></textarea></div>' +
      sw('opt-signups', 'Inscriptions ouvertes', 'Désactivé : la page d’inscription indique que les inscriptions sont fermées.') +
      '<div class="field" style="margin-top:10px"><label for="opt-trial">Essai gratuit à l’inscription (jours)</label><input type="number" id="opt-trial" min="0" max="365" step="1"><div class="hint">0 = pas d’essai. S’applique aux nouveaux comptes ; pour un client existant, utilisez sa fiche.</div></div>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Bandeau d’annonce</span></div><div class="card-body">' +
      sw('opt-banner', 'Afficher le bandeau', 'Message affiché en haut de l’application pour tous les clients (nouveauté, promotion, incident…).') +
      '<div class="form-grid" style="padding:10px 0 0">' + TC.fields([
        { id: 'opt-banner-text', label: 'Texte (280 caractères max.)', type: 'textarea', rows: 2, wide: true },
        { id: 'opt-banner-level', label: 'Couleur', type: 'select', options: [{ v: 'info', l: 'Information (or)' }, { v: 'success', l: 'Bonne nouvelle (vert)' }, { v: 'warning', l: 'Attention (orange)' }, { v: 'danger', l: 'Incident (rouge)' }] },
        { id: 'opt-banner-until', label: 'Afficher jusqu’au', type: 'date', hint: 'Vide = sans limite.' },
        { id: 'opt-banner-link', label: 'Lien (facultatif)', placeholder: '/pricing.html ou https://…', wide: true }
      ]) + '</div><div id="opt-preview" style="margin-top:8px"></div></div></div></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Support client</span></div><div class="card-body"><div class="form-grid" style="padding:0">' + TC.fields([
        { id: 'opt-support-email', label: 'E-mail du support', type: 'email' },
        { id: 'opt-support-wa', label: 'WhatsApp du support', placeholder: '+225 …' }
      ]) + '</div></div></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Paramètres techniques</span><span class="card-count" id="opt-other-count"></span></div><div class="tw"><table><thead><tr><th>Clé</th><th>Valeur</th><th>Mise à jour</th></tr></thead><tbody id="opt-other">' + TC.rowsLoading(3) + '</tbody></table></div></div>';
  }

  function fill() {
    const c = cfg || {};
    const set = (id, v) => { const n = TC.el(id); if (n) n.checked = !!v; };
    set('opt-maintenance', c.maintenance); set('opt-signups', c.signups_open !== false); set('opt-banner', c.banner_enabled);
    TC.setVal('opt-maintenance-msg', c.maintenance_message || '');
    TC.setVal('opt-trial', c.trial_days != null ? c.trial_days : 14);
    TC.setVal('opt-banner-text', c.banner_text || '');
    TC.setVal('opt-banner-level', c.banner_level || 'info');
    TC.setVal('opt-banner-until', c.banner_until ? String(c.banner_until).slice(0, 10) : '');
    TC.setVal('opt-banner-link', c.banner_link || '');
    TC.setVal('opt-support-email', c.support_email || '');
    TC.setVal('opt-support-wa', c.support_whatsapp || '');
    if (!isMaster()) TC.qsa('#panel-parametres input, #panel-parametres textarea, #panel-parametres select').forEach(n => { n.disabled = true; });
    paintState(); preview();
    TC.el('opt-other-count').textContent = other.length + ' paramètre(s)';
    TC.el('opt-other').innerHTML = other.length ? other.map(r => '<tr><td><strong>' + esc(r.key) + '</strong></td><td><code style="font-size:11px">' + esc(JSON.stringify(r.value)).slice(0, 400) + '</code></td><td class="td-mono td-muted">' + TC.fmtDate(r.updated_at) + '</td></tr>').join('') : TC.rowsEmpty(3, 'Aucun autre paramètre', '');
  }

  function paintState() {
    const c = cfg || {}, parts = [];
    parts.push(c.maintenance ? '<span class="badge badge-red">Maintenance active</span>' : '<span class="badge badge-green">Application ouverte</span>');
    parts.push(c.signups_open !== false ? '<span class="badge badge-green">Inscriptions ouvertes</span>' : '<span class="badge badge-orange">Inscriptions fermées</span>');
    parts.push(c.banner_enabled && c.banner_text ? '<span class="badge badge-gold">Bandeau affiché</span>' : '<span class="badge badge-grey">Pas de bandeau</span>');
    parts.push('<span class="badge badge-grey">Essai ' + (c.trial_days != null ? c.trial_days : 14) + ' j</span>');
    TC.el('opt-state').innerHTML = parts.join(' ') + (updatedAt ? '<span class="td-muted" style="margin-left:8px;font-size:11px">Dernière modification : ' + TC.fmtDate(updatedAt) + '</span>' : '');
  }

  function preview() {
    const text = TC.val('opt-banner-text'), lvl = TC.val('opt-banner-level') || 'info';
    const col = { info: 'var(--gold)', success: 'var(--green)', warning: 'var(--orange)', danger: 'var(--red)' }[lvl];
    TC.el('opt-preview').innerHTML = text ? '<div class="hint" style="margin-bottom:4px">Aperçu</div><div style="border:1px solid ' + col + ';color:' + col + ';background:rgba(0,0,0,.25);border-radius:6px;padding:9px 12px;font-size:12.5px">' + esc(text) + (TC.val('opt-banner-link') ? ' <u>En savoir plus →</u>' : '') + '</div>' : '';
  }

  function collect() {
    const ck = id => !!(TC.el(id) && TC.el(id).checked);
    const until = TC.val('opt-banner-until');
    return {
      maintenance: ck('opt-maintenance'), maintenance_message: TC.val('opt-maintenance-msg'),
      signups_open: ck('opt-signups'), trial_days: Number(TC.val('opt-trial')),
      banner_enabled: ck('opt-banner'), banner_text: TC.val('opt-banner-text'), banner_level: TC.val('opt-banner-level'),
      banner_until: until ? until + 'T23:59:59' : null, banner_link: TC.val('opt-banner-link'),
      support_email: TC.val('opt-support-email'), support_whatsapp: TC.val('opt-support-wa')
    };
  }

  async function load() {
    try {
      const res = await TC.api(API, { timeout: 15000 });
      cfg = res.data?.config || {}; other = res.data?.other || []; updatedAt = res.data?.updated_at || null;
      fill();
    } catch (e) { TC.el('opt-state').innerHTML = '<strong>Options indisponibles.</strong> ' + esc(e.message); TC.el('opt-state').className = 'note err'; }
  }

  async function save() {
    const next = collect();
    if (next.maintenance && !(cfg && cfg.maintenance) && !confirm('Activer le mode maintenance ?\nLes clients ne pourront plus utiliser l’application tant qu’il est actif.')) return;
    if (next.banner_enabled && !next.banner_text.trim()) return TC.toast('Le bandeau est activé mais son texte est vide.', 'err');
    try {
      const res = await TC.api(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'config', config: next }), timeout: 15000 });
      cfg = res.data; updatedAt = new Date().toISOString(); fill();
      TC.toast('Options enregistrées', 'ok');
    } catch (e) { TC.toast(e.message || 'Enregistrement impossible', 'err'); }
  }

  TC.register({
    id: 'parametres', label: 'Options de l’app', group: 'gestion', icon: '⚙',
    keywords: 'settings configuration options maintenance bandeau annonce inscriptions essai support',
    view, refresh: load,
    mount() {
      TC.on('opt-reload', 'click', load);
      TC.on('opt-save', 'click', save);
      ['opt-banner-text', 'opt-banner-level', 'opt-banner-link'].forEach(id => { TC.on(id, 'input', preview); TC.on(id, 'change', preview); });
      load();
    }
  });
})(window.TC);
