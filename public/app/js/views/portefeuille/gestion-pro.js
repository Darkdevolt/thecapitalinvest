// ============================================================================
// THE CAPITAL — Espace Gérant (formule Professional)
// ----------------------------------------------------------------------------
// Mode activable dans la vue Portefeuille pour les gérants (SGI, conseillers,
// family offices) : registre de clients, profil de risque et limites, barème
// de frais par client, tableau de bord de l'encours, contrôle des limites,
// relevé client imprimable à l'identité du gérant, export et import Excel.
// Les opérations d'un client sont celles du compte portant son code (couche
// multi-comptes : préfixe « @@code@@ »), le moteur du portefeuille reste
// inchangé. Données : /api/user-data?mode=gestion-clients|gestion-parametres.
// ============================================================================
(function (w, d) {
  'use strict';
  if (w.TCGestion) return;

  var MODE_KEY = 'tc_gestion_mode';
  var XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var PROFILS = { prudent: 'Prudent', equilibre: 'Équilibré', dynamique: 'Dynamique' };
  var TYPES = { particulier: 'Particulier', entreprise: 'Entreprise', institutionnel: 'Institutionnel' };
  /* Limites par défaut d'un profil (en % de la valeur totale du portefeuille). */
  var LIMITES = {
    prudent: { ligne_max_pct: 10, actions_max_pct: 40, cash_min_pct: 10, cash_max_pct: 40, perte_alerte_pct: 8 },
    equilibre: { ligne_max_pct: 15, actions_max_pct: 70, cash_min_pct: 5, cash_max_pct: 25, perte_alerte_pct: 12 },
    dynamique: { ligne_max_pct: 25, actions_max_pct: 100, cash_min_pct: 0, cash_max_pct: 15, perte_alerte_pct: 20 }
  };
  var LIMITE_LABELS = [
    ['ligne_max_pct', 'Poids max. d\'une ligne (%)'],
    ['actions_max_pct', 'Actions max. (%)'],
    ['cash_min_pct', 'Liquidités min. (%)'],
    ['cash_max_pct', 'Liquidités max. (%)'],
    ['perte_alerte_pct', 'Alerte moins-value latente (%)']
  ];
  /* Barème BRVM appliqué par défaut par l'API (lib : FEE_*). */
  var FRAIS_STD = { courtage_pct: 1.2, tva_pct: 18, brvm_pct: 0.07, dcbr_pct: 0.05 };
  var FRAIS_LABELS = [
    ['courtage_pct', 'Courtage (%)'], ['tva_pct', 'TVA sur courtage (%)'], ['brvm_pct', 'Redevance BRVM (%)'], ['dcbr_pct', 'Redevance DC/BR (%)'],
    ['gestion_annuelle_pct', 'Frais de gestion annuels (%)'], ['droits_garde_pct', 'Droits de garde annuels (%)'], ['performance_pct', 'Commission de performance (%)']
  ];

  var state = { clients: [], params: {}, loaded: false, loading: null, error: '', marque: null, open: true };

  function esc(v) { var e = d.createElement('div'); e.textContent = v == null ? '' : String(v); return e.innerHTML; }
  function num(v) { if (v == null || v === '') return null; var n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function nf(v, dec) { var n = Number(v); return v != null && isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }) : '—'; }
  function pf(v, dec) { return v == null || !isFinite(v) ? '—' : nf(v, dec == null ? 1 : dec) + ' %'; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function dl(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function toast(m, t) { if (typeof w.toast === 'function') w.toast(m, t || 'info'); }
  function allowed() { return !w.TC || typeof w.TC.can !== 'function' || w.TC.can('gestion_pro'); }
  function readMode() { try { return localStorage.getItem(MODE_KEY) === '1'; } catch (e) { return false; } }
  function writeMode(v) { try { localStorage.setItem(MODE_KEY, v ? '1' : '0'); } catch (e) {} }
  function active() { return allowed() && readMode(); }

  // ── accès serveur ─────────────────────────────────────────────────────
  function api(method, mode, body, id) {
    var ep = '/user-data?mode=' + mode + (id ? '&id=' + encodeURIComponent(id) : '');
    var fn = method === 'GET' ? w.apiGet : method === 'POST' ? w.apiPost : method === 'PUT' ? w.apiPut : w.apiDelete;
    if (typeof fn !== 'function') return Promise.reject(new Error('Connexion requise.'));
    var p = method === 'GET' ? fn(ep, { cache: 'no-store' }) : method === 'DELETE' ? fn(ep) : fn(ep, body);
    return p.catch(function (e) { var m = String((e && e.message) || 'Erreur'); var err = new Error(m.replace(/^HTTP \d+ /, '')); err.code = (m.match(/^HTTP (\d+)/) || [])[1]; throw err; });
  }
  function unwrap(r, key) { if (!r) return null; if (r[key] !== undefined) return r[key]; if (r.data && r.data[key] !== undefined) return r.data[key]; return r.data !== undefined ? r.data : r; }
  function load(force) {
    if (state.loading) return state.loading;
    if (state.loaded && !force) return Promise.resolve();
    state.loading = Promise.all([api('GET', 'gestion-clients'), api('GET', 'gestion-parametres')]).then(function (r) {
      state.clients = unwrap(r[0], 'clients') || [];
      state.params = unwrap(r[1], 'parametres') || {};
      state.loaded = true; state.error = '';
      state.clients.forEach(function (c) { if (w.TCPfAccounts) w.TCPfAccounts.remember(c.code); });
    }).catch(function (e) {
      state.error = (e && e.code === '403') || /PLAN|réservé/.test(String(e && e.message)) ? 'plan' : ((e && e.message) || 'Chargement impossible.');
    }).then(function () { state.loading = null; });
    return state.loading;
  }
  function loadMarque() {
    if (state.marque) return Promise.resolve(state.marque);
    if (typeof w.apiGet !== 'function') return Promise.resolve({});
    return w.apiGet('/user-data?mode=simulateur-profil', { cache: 'no-store' }).then(function (r) {
      var pr = unwrap(r, 'profil'); state.marque = (pr && pr.marque) || {}; return state.marque;
    }).catch(function () { return {}; });
  }

  // ── règles ───────────────────────────────────────────────────────────
  function byCode(code) { return state.clients.find(function (c) { return c.code === code; }) || null; }
  function limitesOf(c) {
    var base = LIMITES[c.profil_risque] || LIMITES.equilibre;
    var prof = (state.params.profils && state.params.profils[c.profil_risque]) || {};
    var out = {}, k;
    for (k in base) out[k] = base[k];
    for (k in prof) if (prof[k] != null) out[k] = prof[k];
    for (k in (c.limites || {})) if (c.limites[k] != null) out[k] = c.limites[k];
    return out;
  }
  function fraisOf(c) {
    var out = {}, k, src = [FRAIS_STD, state.params.frais || {}, (c && c.frais) || {}];
    src.forEach(function (s) { for (k in s) if (s[k] != null) out[k] = s[k]; });
    return out;
  }
  /* Barème transmis à l'API seulement s'il diffère du barème standard. */
  function fraisFor(code) {
    var c = byCode(code); if (!c || !active()) return null;
    var f = fraisOf(c), diff = false;
    ['courtage_pct', 'tva_pct', 'brvm_pct', 'dcbr_pct'].forEach(function (k) { if (Math.abs((f[k] || 0) - FRAIS_STD[k]) > 1e-9) diff = true; });
    return diff ? { courtage_pct: f.courtage_pct, tva_pct: f.tva_pct, brvm_pct: f.brvm_pct, dcbr_pct: f.dcbr_pct } : null;
  }

  // ── calculs ──────────────────────────────────────────────────────────
  function price(ticker, fallback) {
    var p = null;
    try { if (typeof w.getLatestPrice === 'function') p = Number(w.getLatestPrice(ticker)); } catch (e) {}
    if (!(p > 0)) { var c = (w.allCours || []).find(function (x) { return String(x.ticker).toUpperCase() === ticker; }); p = c ? Number(c.cours || c.dernier || c.close) : null; }
    return p > 0 ? p : fallback;
  }
  function nameOf(ticker) { var c = (w.allCours || []).find(function (x) { return String(x.ticker).toUpperCase() === ticker; }); return c ? (c.nom || c.societe || c.libelle || '') : ''; }
  function txsOf(code) {
    var A = w.TCPfAccounts; if (!A) return [];
    return A.allTransactions().filter(function (t) { return A.acctOf(t) === code; });
  }
  function analyse(c) {
    var A = w.TCPfAccounts, txs = txsOf(c.code);
    var lots = A ? A.rebuildLots(txs) : [];
    var pos = {}, cash = 0, apports = 0, dividendes = 0;
    lots.forEach(function (l) {
      var p = pos[l.ticker] || (pos[l.ticker] = { ticker: l.ticker, qty: 0, cost: 0 });
      p.qty += l.qty; p.cost += l.qty * l.price;
    });
    txs.forEach(function (t) {
      var type = String(t.type || '').toUpperCase(), net = Number(t.montant_net) || 0;
      if (type === 'DEPOT') { cash += net; apports += net; }
      else if (type === 'RETRAIT') { cash += net; apports += net; }
      else if (type === 'DIVIDENDE') { cash += net; dividendes += net; }
      else if (type === 'VENTE') cash += net;
      else if (type === 'ACHAT') cash -= net;
    });
    var lignes = Object.keys(pos).map(function (k) {
      var p = pos[k], px = price(k, p.qty ? p.cost / p.qty : 0);
      return { ticker: k, nom: nameOf(k), qty: p.qty, pru: p.qty ? p.cost / p.qty : 0, cours: px, valeur: p.qty * px, pv: p.qty * px - p.cost, cost: p.cost };
    }).sort(function (a, b) { return b.valeur - a.valeur; });
    var titres = lignes.reduce(function (s, l) { return s + l.valeur; }, 0);
    var cost = lignes.reduce(function (s, l) { return s + l.cost; }, 0);
    var total = titres + cash;
    lignes.forEach(function (l) { l.poids = total > 0 ? l.valeur / total * 100 : 0; });
    var lim = limitesOf(c), alerts = [];
    var cashPct = total > 0 ? cash / total * 100 : 0, actPct = total > 0 ? titres / total * 100 : 0;
    var maxL = lignes[0];
    if (total > 0) {
      lignes.forEach(function (l) { if (l.poids > lim.ligne_max_pct + 1e-9) alerts.push(l.ticker + ' pèse ' + pf(l.poids) + ' (max. ' + pf(lim.ligne_max_pct, 0) + ')'); });
      if (actPct > lim.actions_max_pct + 1e-9) alerts.push('Actions ' + pf(actPct) + ' (max. ' + pf(lim.actions_max_pct, 0) + ')');
      if (cashPct < lim.cash_min_pct - 1e-9) alerts.push('Liquidités ' + pf(cashPct) + ' (min. ' + pf(lim.cash_min_pct, 0) + ')');
      if (cashPct > lim.cash_max_pct + 1e-9) alerts.push('Liquidités ' + pf(cashPct) + ' (max. ' + pf(lim.cash_max_pct, 0) + ')');
      lignes.forEach(function (l) { if (l.cost > 0 && l.pv / l.cost * 100 < -lim.perte_alerte_pct) alerts.push(l.ticker + ' en moins-value de ' + pf(l.pv / l.cost * 100)); });
    }
    if (cash < -1) alerts.push('Solde espèces négatif');
    var f = fraisOf(c);
    var honoraires = total * ((f.gestion_annuelle_pct || 0) + (f.droits_garde_pct || 0)) / 100;
    return {
      client: c, txs: txs, lignes: lignes, titres: titres, cash: cash, total: total, apports: apports, dividendes: dividendes,
      pv: titres - cost, pvPct: cost > 0 ? (titres - cost) / cost * 100 : null,
      perf: apports > 0 ? (total - apports) / apports * 100 : null,
      cashPct: cashPct, actPct: actPct, maxLigne: maxL, alerts: alerts, limites: lim, frais: f, honoraires: honoraires
    };
  }

  // ── styles ───────────────────────────────────────────────────────────
  var CSS = ''
    + '#tcGestion{margin-bottom:16px;font-size:13.5px}'
    + '.gp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;justify-content:space-between;background:linear-gradient(135deg,rgba(184,150,78,.14),rgba(184,150,78,.03));border:1px solid rgba(184,150,78,.35);border-radius:12px;padding:12px 16px}'
    + '.gp-bar .t b{display:block;font-size:14px;letter-spacing:.02em}.gp-bar .t span{font-size:12px;color:var(--muted,rgba(245,240,232,.62))}'
    + '.gp-switch{display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;font-weight:600;font-size:12.5px}'
    + '.gp-switch i{position:relative;width:42px;height:24px;border-radius:12px;background:rgba(245,240,232,.18);transition:.2s}'
    + '.gp-switch i:after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#f5f0e8;transition:.2s}'
    + '.gp-switch.on i{background:var(--gold,#B8964E)}.gp-switch.on i:after{left:21px;background:#17120a}'
    + '.gp-lock{font-size:12px;color:var(--muted,rgba(245,240,232,.65))}.gp-lock a{color:var(--gold,#B8964E);font-weight:600}'
    + '.gp-body{margin-top:12px;border:1px solid rgba(245,240,232,.1);border-radius:12px;background:var(--card,rgba(245,240,232,.02));padding:16px}'
    + '.gp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}'
    + '.gp-kpi{border:1px solid rgba(245,240,232,.1);border-radius:10px;padding:10px 12px;background:rgba(245,240,232,.03)}'
    + '.gp-kpi .k{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,rgba(245,240,232,.55))}.gp-kpi .v{font-size:18px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}'
    + '.gp-kpi.gp-kmain{background:linear-gradient(135deg,rgba(184,150,78,.2),rgba(184,150,78,.05));border-color:rgba(184,150,78,.45)}.gp-kpi.gp-kmain .v{color:var(--gold,#B8964E)}'
    + '.gp-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.gp-tools .sp{flex:1}'
    + '.gp-tools input[type=search]{background:rgba(245,240,232,.04);border:1px solid rgba(245,240,232,.14);color:inherit;border-radius:8px;padding:8px 10px;font:inherit;min-width:200px}'
    + '.gp-btn{background:transparent;border:1px solid rgba(245,240,232,.2);color:inherit;border-radius:8px;padding:8px 12px;font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}'
    + '.gp-btn:hover{border-color:var(--gold,#B8964E)}.gp-btn.gold{background:var(--gold,#B8964E);border-color:var(--gold,#B8964E);color:#17120a;font-weight:600}.gp-btn.sm{padding:5px 9px;font-size:11.5px}.gp-btn.danger{border-color:rgba(224,122,106,.5);color:#e07a6a}'
    + '.gp-tw{overflow-x:auto}.gp-t{width:100%;border-collapse:collapse;font-size:13px}'
    + '.gp-t th{text-align:right;font-weight:500;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted,rgba(245,240,232,.55));padding:8px 10px;border-bottom:1px solid rgba(245,240,232,.12);white-space:nowrap}'
    + '.gp-t th:first-child,.gp-t td:first-child{text-align:left}.gp-t td{padding:9px 10px;border-bottom:1px solid rgba(245,240,232,.07);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}'
    + '.gp-t tr.sel td{background:rgba(184,150,78,.08)}.gp-t tr.off td{opacity:.5}.gp-t td .n{font-weight:600}.gp-t td small{display:block;color:var(--muted,rgba(245,240,232,.55));font-size:11px}'
    + '.gp-t td.acts div{display:flex;gap:6px;justify-content:flex-end}'
    + '.gp-tag{display:inline-block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;border-radius:20px;padding:2px 8px;border:1px solid rgba(245,240,232,.2);margin-left:6px;vertical-align:middle}'
    + '.gp-tag.prudent{border-color:rgba(127,199,154,.5);color:#7fc79a}.gp-tag.equilibre{border-color:rgba(184,150,78,.6);color:var(--gold,#B8964E)}.gp-tag.dynamique{border-color:rgba(224,122,106,.55);color:#e07a6a}'
    + '.gp-pos{color:#7fc79a}.gp-neg{color:#e07a6a}.gp-al{color:#e8a23a;cursor:help}.gp-ok{color:#7fc79a}'
    + '.gp-empty{padding:26px;text-align:center;color:var(--muted,rgba(245,240,232,.6))}.gp-note{font-size:11.5px;color:var(--muted,rgba(245,240,232,.55));margin-top:10px;line-height:1.5}'
    + '.gp-modal{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto}'
    + '.gp-dlg{width:100%;max-width:760px;background:var(--surface,#15120d);border:1px solid rgba(245,240,232,.14);border-radius:14px;padding:20px;color:var(--cream,#f5f0e8);box-shadow:0 20px 60px rgba(0,0,0,.5)}'
    + '.gp-dlg h3{margin:0 0 4px;font-size:18px}.gp-dlg h4{margin:18px 0 8px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold,#B8964E)}.gp-dlg .sub{font-size:12px;color:var(--muted,rgba(245,240,232,.6))}'
    + '.gp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.gp-grid.c3{grid-template-columns:repeat(3,minmax(0,1fr))}.gp-grid .full{grid-column:1/-1}'
    + '.gp-dlg label{display:block;font-size:11px;color:var(--muted,rgba(245,240,232,.65));margin-bottom:4px}'
    + '.gp-dlg input,.gp-dlg select,.gp-dlg textarea{width:100%;box-sizing:border-box;background:rgba(245,240,232,.04);border:1px solid rgba(245,240,232,.14);color:inherit;border-radius:8px;padding:8px 10px;font:inherit;min-width:0}'
    + '.gp-dlg select{color-scheme:dark}.gp-dlg select option{background:#15120d;color:#f5f0e8}.gp-dlg textarea{min-height:64px;resize:vertical}'
    + '.gp-dlg .foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:18px;align-items:center}.gp-dlg .foot .sp{flex:1}.gp-msg{font-size:12px;color:#e07a6a}'
    + '.gp-ptab{width:100%;border-collapse:collapse;font-size:12.5px}.gp-ptab th,.gp-ptab td{padding:6px;border-bottom:1px solid rgba(245,240,232,.08);text-align:left}.gp-ptab input{padding:6px 8px}'
    + '@media (max-width:640px){.gp-grid,.gp-grid.c3{grid-template-columns:1fr}.gp-tools input[type=search]{min-width:0;flex:1 1 100%}.gp-tools .sp{display:none}}';
  function injectCss() { if (d.getElementById('tc-gestion-css')) return; var s = d.createElement('style'); s.id = 'tc-gestion-css'; s.textContent = CSS; d.head.appendChild(s); }

  // ── rendu ────────────────────────────────────────────────────────────
  var filter = '';
  function mount() {
    var view = d.getElementById('view-portefeuille'); if (!view) return;
    injectCss();
    var box = d.getElementById('tcGestion');
    if (!box) {
      box = d.createElement('div'); box.id = 'tcGestion';
      var header = view.querySelector('.page-header');
      if (header && header.nextSibling) view.insertBefore(box, header.nextSibling); else view.insertBefore(box, view.firstChild);
    }
    var accBar = d.getElementById('tcPfAccountBar');  // l'Espace Gérant précède la barre « Client »
    if (accBar && accBar.parentNode === box.parentNode && (box.compareDocumentPosition(accBar) & Node.DOCUMENT_POSITION_PRECEDING)) accBar.parentNode.insertBefore(box, accBar);
    paint(box);
  }
  function paint(box) {
    var on = active();
    var bar = '<div class="gp-bar"><div class="t"><b>Espace Gérant</b><span>Gérez les portefeuilles de vos clients : fiches, limites, frais, relevés.</span></div>';
    if (!allowed()) {
      box.innerHTML = bar + '<div class="gp-lock">Réservé à la formule Professional. <a href="/payment.html?plan=pro&period=monthly">Passer à Professional</a></div></div>';
      return;
    }
    bar += '<span class="gp-switch' + (on ? ' on' : '') + '" id="gpToggle" role="switch" aria-checked="' + on + '" tabindex="0"><i></i>' + (on ? 'Activé' : 'Activer') + '</span></div>';
    if (!on) { box.innerHTML = bar; wireToggle(box); return; }
    if (!state.loaded && !state.error) {
      box.innerHTML = bar + '<div class="gp-body"><div class="gp-empty">Chargement de vos clients…</div></div>';
      wireToggle(box);
      load().then(function () { paint(box); if (w.TCPfAccounts) w.TCPfAccounts.refresh(); });
      return;
    }
    if (state.error) {
      box.innerHTML = bar + '<div class="gp-body"><div class="gp-empty">' + (state.error === 'plan' ? 'Espace Gérant réservé à la formule Professional.' : esc(state.error)) + ' <button class="gp-btn sm" id="gpRetry">Réessayer</button></div></div>';
      wireToggle(box);
      var r = box.querySelector('#gpRetry'); if (r) r.onclick = function () { state.error = ''; load(true).then(function () { paint(box); }); };
      return;
    }
    var rows = state.clients.map(analyse);
    var act = rows.filter(function (r) { return r.client.actif !== false; });
    var aum = act.reduce(function (s, r) { return s + r.total; }, 0);
    var cash = act.reduce(function (s, r) { return s + r.cash; }, 0);
    var pv = act.reduce(function (s, r) { return s + r.pv; }, 0);
    var hon = act.reduce(function (s, r) { return s + r.honoraires; }, 0);
    var nAl = act.filter(function (r) { return r.alerts.length; }).length;
    var A = w.TCPfAccounts, unassigned = A ? A.allTransactions().filter(function (t) { return A.acctOf(t) === '__none__'; }).length : 0;
    var orphan = {}; if (A) A.allTransactions().forEach(function (t) { var a = A.acctOf(t); if (a !== '__none__' && !byCode(a)) orphan[a] = 1; });
    var sel = w.tcActiveAccount;
    var kpi = function (k, v, cls) { return '<div class="gp-kpi ' + (cls || '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div></div>'; };
    var f = filter.toLowerCase();
    var shown = rows.filter(function (r) { var c = r.client; return !f || (c.nom + ' ' + c.code + ' ' + (c.email || '') + ' ' + (c.numero_compte || '')).toLowerCase().indexOf(f) >= 0; });
    var body = '<div class="gp-body">'
      + '<div class="gp-kpis">'
      + kpi('Encours sous gestion', nf(Math.round(aum)) + ' F', 'gp-kmain')
      + kpi('Clients actifs', nf(act.length))
      + kpi('Liquidités', nf(Math.round(cash)) + ' F')
      + kpi('Plus-value latente', '<span class="' + (pv >= 0 ? 'gp-pos' : 'gp-neg') + '">' + (pv >= 0 ? '+' : '') + nf(Math.round(pv)) + ' F</span>')
      + kpi('Honoraires estimés / an', nf(Math.round(hon)) + ' F')
      + kpi('Clients hors limites', '<span class="' + (nAl ? 'gp-al' : 'gp-ok') + '">' + nAl + '</span>')
      + '</div>'
      + '<div class="gp-tools"><input type="search" id="gpSearch" placeholder="Rechercher un client, un code, un compte…" value="' + esc(filter) + '"><span class="sp"></span>'
      + '<button class="gp-btn gold" id="gpNew">＋ Nouveau client</button><button class="gp-btn" id="gpImport">Importer (Excel/CSV)</button>'
      + '<button class="gp-btn" id="gpExport">Exporter le registre</button><button class="gp-btn" id="gpParams">Paramètres</button>'
      + '<input type="file" id="gpFile" accept=".xlsx,.xls,.csv" hidden></div>';
    if (!rows.length) {
      body += '<div class="gp-empty">Aucun client pour l\'instant. Créez une fiche (« Nouveau client ») ou importez votre liste existante.<br>'
        + 'Chaque client dispose de son propre portefeuille : sélectionnez-le dans la barre « Client » pour enregistrer ses opérations.</div>';
    } else {
      body += '<div class="gp-tw"><table class="gp-t"><thead><tr><th>Client</th><th>Valorisation</th><th>Liquidités</th><th>+/- latente</th><th>Perf. / apports</th><th>Poids</th><th>Lignes</th><th>Contrôle</th><th></th></tr></thead><tbody>'
        + shown.map(function (r) {
          var c = r.client;
          return '<tr class="' + (c.code === sel ? 'sel ' : '') + (c.actif === false ? 'off' : '') + '"><td><span class="n">' + esc(c.nom) + '</span><span class="gp-tag ' + esc(c.profil_risque) + '">' + esc(PROFILS[c.profil_risque] || '') + '</span>'
            + '<small>' + esc(c.code) + (c.numero_compte ? ' · ' + esc(c.numero_compte) : '') + (c.actif === false ? ' · archivé' : '') + '</small></td>'
            + '<td>' + nf(Math.round(r.total)) + '</td><td>' + nf(Math.round(r.cash)) + '<small>' + pf(r.cashPct) + '</small></td>'
            + '<td class="' + (r.pv >= 0 ? 'gp-pos' : 'gp-neg') + '">' + (r.pv >= 0 ? '+' : '') + nf(Math.round(r.pv)) + '<small>' + pf(r.pvPct) + '</small></td>'
            + '<td class="' + (r.perf == null ? '' : r.perf >= 0 ? 'gp-pos' : 'gp-neg') + '">' + pf(r.perf) + '</td>'
            + '<td>' + pf(aum > 0 && c.actif !== false ? r.total / aum * 100 : null) + '</td><td>' + r.lignes.length + '</td>'
            + '<td>' + (r.alerts.length ? '<span class="gp-al" title="' + esc(r.alerts.join('\n')) + '">⚠ ' + r.alerts.length + '</span>' : (r.total > 0 ? '<span class="gp-ok">✓</span>' : '—')) + '</td>'
            + '<td class="acts"><div><button class="gp-btn sm gold" data-open="' + esc(c.code) + '">' + (c.code === sel ? 'Ouvert' : 'Ouvrir') + '</button>'
            + '<button class="gp-btn sm" data-edit="' + esc(c.id) + '">Fiche</button><button class="gp-btn sm" data-rel="' + esc(c.id) + '">Relevé</button></div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    var notes = [];
    if (sel && sel !== '__all__' && byCode(sel)) notes.push('Portefeuille affiché ci-dessous : <b>' + esc(byCode(sel).nom) + '</b>. Les achats, ventes, dépôts et dividendes saisis sont rattachés à ce client' + (fraisFor(sel) ? ' et calculés avec son barème de frais' : '') + '.');
    else notes.push('Ouvrez un client pour afficher son portefeuille et saisir ses opérations. La vue « Tous les clients » consolide l\'ensemble.');
    if (unassigned) notes.push(unassigned + ' opération(s) ne sont rattachées à aucun client (visibles dans « Non affecté »).');
    var orph = Object.keys(orphan);
    if (orph.length) notes.push('Comptes sans fiche client : ' + orph.map(esc).join(', ') + '. Créez une fiche avec le même code pour les suivre ici.');
    body += '<div class="gp-note">' + notes.join('<br>') + '</div></div>';
    box.innerHTML = bar + body;
    wireToggle(box); wire(box, rows);
  }
  function wireToggle(box) {
    var t = box.querySelector('#gpToggle'); if (!t) return;
    var go = function () {
      var on = !readMode(); writeMode(on);
      if (!on && w.TCPfAccounts) { /* retour au portefeuille personnel */ }
      paint(box); if (w.TCPfAccounts) w.TCPfAccounts.refresh();
    };
    t.onclick = go; t.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  }
  function wire(box, rows) {
    var q = function (s) { return box.querySelector(s); };
    var s = q('#gpSearch');
    if (s) s.addEventListener('input', function () { filter = s.value; var pos = s.selectionStart; paint(box); var n = box.querySelector('#gpSearch'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
    q('#gpNew').onclick = function () { editClient(null); };
    q('#gpParams').onclick = editParams;
    q('#gpExport').onclick = function () { exportBook(rows); };
    q('#gpImport').onclick = function () { q('#gpFile').click(); };
    q('#gpFile').onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) importFile(f); };
    box.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { if (w.TCPfAccounts) w.TCPfAccounts.select(b.getAttribute('data-open')); var v = d.getElementById('tcPfAccountBar'); if (v) v.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    box.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editClient(state.clients.find(function (c) { return c.id === b.getAttribute('data-edit'); })); }; });
    box.querySelectorAll('[data-rel]').forEach(function (b) { b.onclick = function () { var r = rows.find(function (x) { return x.client.id === b.getAttribute('data-rel'); }); if (r) releve(r); }; });
  }
  function refreshAll() { var box = d.getElementById('tcGestion'); if (box) paint(box); if (w.TCPfAccounts) w.TCPfAccounts.refresh(); }

  // ── fenêtres ─────────────────────────────────────────────────────────
  function modal(html) {
    var m = d.createElement('div'); m.className = 'gp-modal'; m.innerHTML = '<div class="gp-dlg" role="dialog" aria-modal="true">' + html + '</div>';
    d.body.appendChild(m);
    var close = function () { m.remove(); d.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    m.addEventListener('mousedown', function (e) { if (e.target === m) close(); });
    d.addEventListener('keydown', onKey);
    return { el: m, close: close, q: function (s) { return m.querySelector(s); } };
  }
  function input(id, label, val, type, extra, cls) {
    return '<div class="' + (cls || '') + '"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" type="' + (type || 'text') + '"' + (type === 'number' ? ' step="any"' : '') + ' value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></div>';
  }
  function select(id, label, val, opts, cls) {
    return '<div class="' + (cls || '') + '"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '">' + Object.keys(opts).map(function (k) { return '<option value="' + k + '"' + (k === val ? ' selected' : '') + '>' + esc(opts[k]) + '</option>'; }).join('') + '</select></div>';
  }

  function editClient(c) {
    var isNew = !c; c = c || { profil_risque: 'equilibre', type_client: 'particulier', date_ouverture: today(), frais: {}, limites: {}, actif: true };
    var defL = limitesOf(Object.assign({}, c, { limites: {} })), defF = fraisOf(Object.assign({}, c, { frais: {} }));
    var m = modal('<h3>' + (isNew ? 'Nouveau client' : esc(c.nom)) + '</h3><div class="sub">' + (isNew ? 'La fiche crée aussi le portefeuille du client (même code).' : 'Code ' + esc(c.code) + ' · ouvert le ' + dl(c.date_ouverture)) + '</div>'
      + '<h4>Identité</h4><div class="gp-grid">'
      + input('gcNom', 'Nom ou raison sociale *', c.nom, 'text', ' maxlength="120"')
      + input('gcCode', 'Code client * (identifiant du portefeuille)', c.code, 'text', ' maxlength="40"' + (isNew ? '' : ' readonly'))
      + select('gcType', 'Type de client', c.type_client, TYPES)
      + input('gcCompte', 'N° de compte titres', c.numero_compte, 'text', ' maxlength="60"')
      + input('gcEmail', 'E-mail', c.email, 'email', ' maxlength="120"')
      + input('gcTel', 'Téléphone', c.telephone, 'tel', ' maxlength="40"')
      + input('gcOuv', 'Date d\'ouverture', c.date_ouverture, 'date')
      + input('gcHorizon', 'Horizon de placement', c.horizon, 'text', ' maxlength="60" placeholder="ex. 5 ans"')
      + '</div><h4>Profil et limites</h4><div class="gp-grid c3">'
      + select('gcProfil', 'Profil de risque', c.profil_risque, PROFILS)
      + LIMITE_LABELS.map(function (l) { return input('gcL_' + l[0], l[1], c.limites && c.limites[l[0]], 'number', ' min="0" max="100" placeholder="' + esc(defL[l[0]]) + ' (profil)"'); }).join('')
      + input('gcObjectif', 'Objectif', c.objectif, 'text', ' maxlength="300" placeholder="Revenu, croissance, préservation…"', 'full')
      + '</div><h4>Barème de frais du client</h4><div class="gp-grid c3">'
      + FRAIS_LABELS.map(function (l) { return input('gcF_' + l[0], l[1], c.frais && c.frais[l[0]], 'number', ' min="0" placeholder="' + esc(defF[l[0]] != null ? defF[l[0]] : '0') + ' (défaut)"'); }).join('')
      + '</div><div class="sub" style="margin-top:6px">Champs vides : barème par défaut de vos paramètres (ou barème BRVM standard). Courtage, TVA et redevances s\'appliquent aux achats et ventes saisis pour ce client.</div>'
      + '<h4>Notes</h4><textarea id="gcNotes" maxlength="2000">' + esc(c.notes || '') + '</textarea>'
      + '<div class="foot">' + (isNew ? '' : '<button class="gp-btn danger" id="gcDel">Supprimer la fiche</button><button class="gp-btn" id="gcArch">' + (c.actif === false ? 'Réactiver' : 'Archiver') + '</button>')
      + '<span class="sp"></span><span class="gp-msg" id="gcMsg"></span><button class="gp-btn" id="gcCancel">Annuler</button><button class="gp-btn gold" id="gcSave">Enregistrer</button></div>');
    var q = m.q;
    q('#gcProfil').onchange = function () {
      var L = limitesOf(Object.assign({}, c, { profil_risque: this.value, limites: {} }));
      LIMITE_LABELS.forEach(function (l) { q('#gcL_' + l[0]).placeholder = L[l[0]] + ' (profil)'; });
    };
    q('#gcCancel').onclick = m.close;
    var msg = function (t) { q('#gcMsg').textContent = t || ''; };
    q('#gcSave').onclick = function () {
      var body = {
        nom: q('#gcNom').value.trim(), type_client: q('#gcType').value, numero_compte: q('#gcCompte').value.trim(),
        email: q('#gcEmail').value.trim(), telephone: q('#gcTel').value.trim(), date_ouverture: q('#gcOuv').value || null,
        horizon: q('#gcHorizon').value.trim(), profil_risque: q('#gcProfil').value, objectif: q('#gcObjectif').value.trim(),
        notes: q('#gcNotes').value.trim(), limites: {}, frais: {}
      };
      if (isNew) body.code = q('#gcCode').value.trim();
      LIMITE_LABELS.forEach(function (l) { var v = num(q('#gcL_' + l[0]).value); if (v != null) body.limites[l[0]] = v; });
      FRAIS_LABELS.forEach(function (l) { var v = num(q('#gcF_' + l[0]).value); if (v != null) body.frais[l[0]] = v; });
      if (!body.nom) { msg('Le nom est obligatoire.'); return; }
      if (isNew && (!body.code || /@/.test(body.code))) { msg('Code client obligatoire (sans « @ »).'); return; }
      q('#gcSave').disabled = true; msg('');
      (isNew ? api('POST', 'gestion-clients', body) : api('PUT', 'gestion-clients', body, c.id)).then(function (r) {
        var saved = unwrap(r, 'data') || body;
        if (isNew) { state.clients.push(saved); if (w.TCPfAccounts) w.TCPfAccounts.remember(saved.code); }
        else state.clients = state.clients.map(function (x) { return x.id === c.id ? saved : x; });
        state.clients.sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom)); });
        m.close(); refreshAll(); toast(isNew ? 'Client « ' + saved.nom + ' » créé.' : 'Fiche enregistrée.', 'success');
      }).catch(function (e) { q('#gcSave').disabled = false; msg((e && e.message) || 'Enregistrement impossible.'); });
    };
    if (!isNew) {
      q('#gcArch').onclick = function () {
        api('PUT', 'gestion-clients', { actif: c.actif === false }, c.id).then(function (r) {
          var saved = unwrap(r, 'data'); state.clients = state.clients.map(function (x) { return x.id === c.id ? saved : x; });
          m.close(); refreshAll();
        }).catch(function (e) { msg(e.message); });
      };
      q('#gcDel').onclick = function () {
        var n = txsOf(c.code).length;
        if (!w.confirm('Supprimer la fiche de « ' + c.nom + ' » ?' + (n ? '\n\nSes ' + n + ' opération(s) restent dans le portefeuille (compte « ' + c.code + ' »).' : ''))) return;
        api('DELETE', 'gestion-clients', null, c.id).then(function () {
          state.clients = state.clients.filter(function (x) { return x.id !== c.id; });
          m.close(); refreshAll(); toast('Fiche supprimée.', 'success');
        }).catch(function (e) { msg(e.message); });
      };
    }
    setTimeout(function () { var f = q(isNew ? '#gcNom' : '#gcEmail'); if (f) f.focus(); }, 30);
  }

  function editParams() {
    var p = state.params || {}, fr = p.frais || {}, pr = p.profils || {};
    var m = modal('<h3>Paramètres de l\'Espace Gérant</h3><div class="sub">S\'appliquent à tous les clients, sauf valeurs propres saisies dans leur fiche.</div>'
      + '<h4>Barème de frais par défaut</h4><div class="gp-grid c3">'
      + FRAIS_LABELS.map(function (l) { return input('gpF_' + l[0], l[1], fr[l[0]], 'number', ' min="0" placeholder="' + esc(FRAIS_STD[l[0]] != null ? FRAIS_STD[l[0]] : 0) + '"'); }).join('')
      + '</div><h4>Limites par profil de risque</h4><div class="gp-tw"><table class="gp-ptab"><thead><tr><th></th>' + Object.keys(PROFILS).map(function (k) { return '<th>' + PROFILS[k] + '</th>'; }).join('') + '</tr></thead><tbody>'
      + LIMITE_LABELS.map(function (l) {
        return '<tr><td>' + esc(l[1]) + '</td>' + Object.keys(PROFILS).map(function (k) { var v = pr[k] && pr[k][l[0]]; return '<td><input type="number" step="any" min="0" max="100" id="gpP_' + k + '_' + l[0] + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + LIMITES[k][l[0]] + '"></td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>'
      + '<h4>Relevé client</h4>' + input('gpMention', 'Mention réglementaire en bas de relevé', p.mention_releve, 'text', ' maxlength="300" placeholder="Agrément CREPMF n°…, adresse, contact"', 'full')
      + '<div class="sub" style="margin-top:6px">Le logo, le nom et la couleur des relevés sont ceux de « Mon identité » (simulateur d\'ordre obligataire › Personnaliser).</div>'
      + '<div class="foot"><span class="sp"></span><span class="gp-msg" id="gpMsg"></span><button class="gp-btn" id="gpCancel">Annuler</button><button class="gp-btn gold" id="gpSave">Enregistrer</button></div>');
    var q = m.q;
    q('#gpCancel').onclick = m.close;
    q('#gpSave').onclick = function () {
      var out = { frais: {}, profils: {}, mention_releve: q('#gpMention').value.trim() };
      FRAIS_LABELS.forEach(function (l) { var v = num(q('#gpF_' + l[0]).value); if (v != null) out.frais[l[0]] = v; });
      Object.keys(PROFILS).forEach(function (k) { out.profils[k] = {}; LIMITE_LABELS.forEach(function (l) { var v = num(q('#gpP_' + k + '_' + l[0]).value); if (v != null) out.profils[k][l[0]] = v; }); });
      q('#gpSave').disabled = true;
      api('PUT', 'gestion-parametres', { parametres: out }).then(function (r) {
        state.params = unwrap(r, 'parametres') || out; m.close(); refreshAll(); toast('Paramètres enregistrés.', 'success');
      }).catch(function (e) { q('#gpSave').disabled = false; q('#gpMsg').textContent = e.message; });
    };
  }

  // ── relevé client (impression / PDF) ─────────────────────────────────
  function releve(r) {
    loadMarque().then(function (B) {
      var c = r.client, bc = /^#[0-9a-f]{6}$/i.test(B.couleur || '') ? B.couleur : null;
      var acc = bc || '#9a7b3c', band = bc || '#14110c';
      var n = parseInt((bc || '#14110c').slice(1), 16), lum = (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255;
      var ink = lum > 0.6 ? '#17120a' : '#ffffff';
      var y0 = new Date().getFullYear() + '-01-01';
      var mv = r.txs.filter(function (t) { return String(t.date_transaction || '') >= y0; }).sort(function (a, b) { return String(b.date_transaction).localeCompare(String(a.date_transaction)); });
      var TL = { ACHAT: 'Achat', VENTE: 'Vente', DEPOT: 'Dépôt', RETRAIT: 'Retrait', DIVIDENDE: 'Dividende' };
      var brand = (B.logo ? '<img src="' + esc(B.logo) + '" alt="">' : '') + '<b>' + esc(B.nom || 'THE · CAPITAL') + '</b>';
      var k = function (l, v) { return '<div class="kpi"><span>' + esc(l) + '</span><b>' + v + '</b></div>'; };
      var html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Relevé ' + esc(c.nom) + ' — ' + dl(today()) + '</title>'
        + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet"><style>'
        + '@page{size:A4;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:"DM Sans",Arial,sans-serif;color:#1d1a14;font-size:11px;background:#fff}'
        + '.s{max-width:186mm;margin:0 auto}.band{display:flex;justify-content:space-between;align-items:center;background:' + band + ';color:' + ink + ';border-radius:10px;padding:14px 18px}'
        + '.band .l{display:flex;align-items:center;gap:12px}.band img{max-height:38px;max-width:160px;object-fit:contain;background:#fff;border-radius:6px;padding:3px}.band b{font:700 15px/1.2 "Playfair Display",Georgia,serif;letter-spacing:.04em}'
        + '.band .r{text-align:right}.band .r b{display:block;font:700 13px "DM Sans",sans-serif;letter-spacing:0}.band .r span{font-size:10px;opacity:.75}'
        + '.id{display:grid;grid-template-columns:1.3fr 1fr;gap:14px;margin:14px 2px}.id h1{margin:0 0 4px;font:700 18px/1.2 "Playfair Display",Georgia,serif}.id .m{color:#6f6656;line-height:1.55}'
        + '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.kpi{border:1px solid #e6dcc8;border-radius:9px;padding:8px 10px;background:#faf7f0}.kpi span{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:#8a7d64}.kpi b{display:block;margin-top:3px;font-size:13.5px}'
        + '.kpi:first-child{background:' + band + ';border-color:' + band + '}.kpi:first-child span,.kpi:first-child b{color:' + ink + '}'
        + 'h2{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:' + acc + ';margin:14px 0 4px;padding-bottom:4px;border-bottom:1.5px solid ' + acc + '}'
        + 'table{width:100%;border-collapse:collapse}th{font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:#8a7d64;text-align:right;padding:5px 6px;border-bottom:1px solid #e6dcc8;font-weight:600}th:first-child,td:first-child{text-align:left}'
        + 'td{padding:4.5px 6px;border-bottom:1px solid #eee6d6;text-align:right;font-variant-numeric:tabular-nums}tr.tot td{font-weight:700;border-top:1.5px solid ' + acc + ';border-bottom:0}.pos{color:#1f7a4d}.neg{color:#a4262c}'
        + '.al{margin-top:6px;padding:8px 10px;border-radius:8px;background:#fff6e6;border:1px solid #f0d49a;color:#7a5410;line-height:1.5}.ok{color:#1f7a4d}'
        + '.foot{margin-top:16px;padding-top:8px;border-top:1px solid #eee6d6;font-size:8.5px;color:#8a7d64;line-height:1.5;display:flex;justify-content:space-between;gap:16px}table,tr{page-break-inside:avoid}'
        + '</style></head><body><div class="s">'
        + '<div class="band"><div class="l">' + brand + '</div><div class="r"><b>Relevé de portefeuille</b><span>Au ' + dl(today()) + '</span></div></div>'
        + '<div class="id"><div><h1>' + esc(c.nom) + '</h1><div class="m">' + esc(TYPES[c.type_client] || '') + ' · profil ' + esc(PROFILS[c.profil_risque] || '') + (c.objectif ? '<br>Objectif : ' + esc(c.objectif) : '') + (c.horizon ? ' · horizon ' + esc(c.horizon) : '') + '</div></div>'
        + '<div class="m" style="text-align:right">Code client : <b>' + esc(c.code) + '</b>' + (c.numero_compte ? '<br>Compte titres : ' + esc(c.numero_compte) : '') + (c.date_ouverture ? '<br>Client depuis le ' + dl(c.date_ouverture) : '') + '</div></div>'
        + '<div class="kpis">' + k('Valeur totale', nf(Math.round(r.total)) + ' FCFA') + k('Titres', nf(Math.round(r.titres)) + ' F')
        + k('Liquidités', nf(Math.round(r.cash)) + ' F') + k('Apports nets', nf(Math.round(r.apports)) + ' F') + '</div>'
        + '<div class="kpis">' + k('Performance / apports', pf(r.perf, 2)) + k('+/- value latente', '<span class="' + (r.pv >= 0 ? 'pos' : 'neg') + '">' + (r.pv >= 0 ? '+' : '') + nf(Math.round(r.pv)) + ' F</span>')
        + k('Dividendes perçus', nf(Math.round(r.dividendes)) + ' F') + k('Lignes', String(r.lignes.length)) + '</div>'
        + '<h2>Positions</h2><table><thead><tr><th>Valeur</th><th>Quantité</th><th>PRU</th><th>Cours</th><th>Valorisation</th><th>+/- latente</th><th>Poids</th></tr></thead><tbody>'
        + (r.lignes.length ? r.lignes.map(function (l) {
          return '<tr><td><b>' + esc(l.ticker) + '</b> ' + esc(l.nom) + '</td><td>' + nf(l.qty) + '</td><td>' + nf(l.pru) + '</td><td>' + nf(l.cours) + '</td><td>' + nf(Math.round(l.valeur)) + '</td><td class="' + (l.pv >= 0 ? 'pos' : 'neg') + '">' + (l.pv >= 0 ? '+' : '') + nf(Math.round(l.pv)) + '</td><td>' + pf(l.poids) + '</td></tr>';
        }).join('') : '<tr><td colspan="7">Aucune position.</td></tr>')
        + '<tr><td>Liquidités</td><td></td><td></td><td></td><td>' + nf(Math.round(r.cash)) + '</td><td></td><td>' + pf(r.cashPct) + '</td></tr>'
        + '<tr class="tot"><td>Total</td><td></td><td></td><td></td><td>' + nf(Math.round(r.total)) + '</td><td class="' + (r.pv >= 0 ? 'pos' : 'neg') + '">' + (r.pv >= 0 ? '+' : '') + nf(Math.round(r.pv)) + '</td><td>100 %</td></tr></tbody></table>'
        + '<h2>Conformité au profil</h2>' + (r.alerts.length ? '<div class="al">' + r.alerts.map(esc).join('<br>') + '</div>' : '<div class="ok">Portefeuille conforme aux limites du profil ' + esc(PROFILS[c.profil_risque] || '') + ' (ligne max. ' + pf(r.limites.ligne_max_pct, 0) + ', liquidités ' + pf(r.limites.cash_min_pct, 0) + ' à ' + pf(r.limites.cash_max_pct, 0) + ').</div>')
        + '<h2>Mouvements depuis le 1er janvier</h2><table><thead><tr><th>Date</th><th>Opération</th><th>Valeur</th><th>Quantité</th><th>Cours</th><th>Frais</th><th>Montant net</th></tr></thead><tbody>'
        + (mv.length ? mv.map(function (t) {
          var ty = String(t.type).toUpperCase(), cash = ty === 'DEPOT' || ty === 'RETRAIT';
          return '<tr><td>' + dl(t.date_transaction) + '</td><td>' + esc(TL[ty] || ty) + '</td><td>' + (cash ? '—' : esc(t.ticker)) + '</td><td>' + (ty === 'ACHAT' || ty === 'VENTE' ? nf(t.quantite) : '—') + '</td><td>' + (ty === 'ACHAT' || ty === 'VENTE' ? nf(t.cours) : '—') + '</td><td>' + (Number(t.total_frais) ? nf(Math.round(t.total_frais)) : '—') + '</td><td>' + nf(Math.round(Math.abs(Number(t.montant_net) || 0))) + '</td></tr>';
        }).join('') : '<tr><td colspan="7">Aucun mouvement sur la période.</td></tr>') + '</tbody></table>'
        + (r.honoraires > 0 ? '<h2>Frais de gestion</h2><div>Frais de gestion et droits de garde estimés : <b>' + nf(Math.round(r.honoraires)) + ' FCFA par an</b> (' + pf((r.frais.gestion_annuelle_pct || 0) + (r.frais.droits_garde_pct || 0), 2) + ' de l\'encours actuel).</div>' : '')
        + '<div class="foot"><span>' + (state.params.mention_releve ? '<b>' + esc(state.params.mention_releve) + '</b><br>' : (B.mention ? '<b>' + esc(B.mention) + '</b><br>' : ''))
        + 'Valorisation au dernier cours connu de la BRVM. Document d\'information établi à partir des opérations enregistrées ; il ne remplace pas le relevé officiel du teneur de compte.</span><span style="white-space:nowrap">' + esc(B.nom || 'thecapitalinvest.app') + '</span></div>'
        + '</div><script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>';
      var win = w.open('', '_blank');
      if (!win) { toast('Autorisez les fenêtres pour imprimer le relevé.', 'error'); return; }
      win.document.open(); win.document.write(html); win.document.close();
    });
  }

  // ── Excel ────────────────────────────────────────────────────────────
  function loadXlsx() {
    if (w.XLSX) return Promise.resolve(w.XLSX);
    return new Promise(function (resolve, reject) {
      var s = d.createElement('script'); s.src = XLSX_SRC; s.async = true;
      s.onload = function () { w.XLSX ? resolve(w.XLSX) : reject(new Error('Moteur Excel indisponible.')); };
      s.onerror = function () { reject(new Error('Moteur Excel indisponible.')); };
      d.head.appendChild(s);
    });
  }
  var COLS = [['code', 'Code'], ['nom', 'Nom'], ['type_client', 'Type'], ['profil_risque', 'Profil'], ['numero_compte', 'Compte titres'], ['email', 'E-mail'], ['telephone', 'Téléphone'], ['date_ouverture', 'Ouverture'], ['objectif', 'Objectif'], ['horizon', 'Horizon']];
  function exportBook(rows) {
    loadXlsx().then(function (X) {
      var reg = [COLS.map(function (c) { return c[1]; }).concat(['Valorisation', 'Liquidités', '+/- latente', 'Perf. / apports %', 'Lignes', 'Contrôle'])];
      rows.forEach(function (r) {
        var c = r.client;
        reg.push(COLS.map(function (k) { var v = c[k[0]]; return k[0] === 'type_client' ? TYPES[v] || v : k[0] === 'profil_risque' ? PROFILS[v] || v : v == null ? '' : v; })
          .concat([Math.round(r.total), Math.round(r.cash), Math.round(r.pv), r.perf == null ? '' : Math.round(r.perf * 100) / 100, r.lignes.length, r.alerts.join(' ; ') || 'Conforme']));
      });
      var pos = [['Code client', 'Client', 'Valeur', 'Société', 'Quantité', 'PRU', 'Cours', 'Valorisation', '+/- latente', 'Poids %']];
      rows.forEach(function (r) { r.lignes.forEach(function (l) { pos.push([r.client.code, r.client.nom, l.ticker, l.nom, l.qty, Math.round(l.pru), l.cours, Math.round(l.valeur), Math.round(l.pv), Math.round(l.poids * 100) / 100]); }); });
      var wb = X.utils.book_new();
      var w1 = X.utils.aoa_to_sheet(reg); w1['!cols'] = reg[0].map(function () { return { wch: 16 }; });
      X.utils.book_append_sheet(wb, w1, 'Clients');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(pos), 'Positions');
      X.writeFile(wb, 'Registre-clients-' + today() + '.xlsx');
    }).catch(function (e) { toast(e.message, 'error'); });
  }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
  var HEAD = { code: 'code', codeclient: 'code', identifiant: 'code', nom: 'nom', client: 'nom', raisonsociale: 'nom', nomclient: 'nom', type: 'type_client', typeclient: 'type_client',
    profil: 'profil_risque', profilderisque: 'profil_risque', comptetitres: 'numero_compte', compte: 'numero_compte', numerodecompte: 'numero_compte', email: 'email', mail: 'email', courriel: 'email',
    telephone: 'telephone', tel: 'telephone', ouverture: 'date_ouverture', dateouverture: 'date_ouverture', datedouverture: 'date_ouverture', objectif: 'objectif', horizon: 'horizon' };
  function pick(map, v) { var n = norm(v); for (var k in map) if (norm(map[k]) === n || norm(k) === n) return k; return null; }
  function importFile(file) {
    loadXlsx().then(function (X) {
      return file.arrayBuffer().then(function (buf) {
        if (!/\.csv$/i.test(file.name)) return X.read(buf, { type: 'array', cellDates: true });
        var txt = new TextDecoder('utf-8').decode(buf);  // CSV : UTF-8, sinon Windows-1252 (export Excel)
        if (txt.indexOf('\uFFFD') >= 0) txt = new TextDecoder('windows-1252').decode(buf);
        return X.read(txt.replace(/^\uFEFF/, ''), { type: 'string', cellDates: true });
      }).then(function (wb) { return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }); }); })
      .then(function (data) {
        var items = [], skipped = 0, existing = {};
        state.clients.forEach(function (c) { existing[c.code.toLowerCase()] = 1; });
        data.forEach(function (row) {
          var o = {};
          Object.keys(row).forEach(function (h) { var k = HEAD[norm(h)]; if (k) o[k] = row[h]; });
          if (o.date_ouverture instanceof Date) o.date_ouverture = o.date_ouverture.toISOString().slice(0, 10);
          else if (o.date_ouverture) { var m = String(o.date_ouverture).match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/); o.date_ouverture = m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : String(o.date_ouverture).slice(0, 10); }
          o.nom = String(o.nom || '').trim(); o.code = String(o.code || '').trim().replace(/@/g, '');
          if (!o.code && o.nom) o.code = o.nom.split(/\s+/).map(function (x) { return x[0]; }).join('').toUpperCase().slice(0, 6) + '-' + (items.length + 1);
          if (!o.nom || !o.code || existing[o.code.toLowerCase()]) { skipped++; return; }
          o.type_client = pick(TYPES, o.type_client) || 'particulier';
          o.profil_risque = pick(PROFILS, o.profil_risque) || 'equilibre';
          ['numero_compte', 'email', 'telephone', 'objectif', 'horizon'].forEach(function (k) { if (o[k] != null) o[k] = String(o[k]).trim(); });
          existing[o.code.toLowerCase()] = 1; items.push(o);
        });
        if (!items.length) { toast('Aucun nouveau client à importer' + (skipped ? ' (' + skipped + ' ligne(s) ignorée(s) : nom manquant ou code déjà utilisé).' : '.'), 'warn'); return; }
        if (!w.confirm('Importer ' + items.length + ' client(s) ?' + (skipped ? '\n' + skipped + ' ligne(s) ignorée(s) (nom manquant ou code déjà utilisé).' : ''))) return;
        var ok = 0, errs = [];
        return items.reduce(function (p, it) {
          return p.then(function () { return api('POST', 'gestion-clients', it).then(function (r) { ok++; var s = unwrap(r, 'data'); if (s) { state.clients.push(s); if (w.TCPfAccounts) w.TCPfAccounts.remember(s.code); } }).catch(function (e) { errs.push(it.nom + ' : ' + e.message); }); });
        }, Promise.resolve()).then(function () {
          state.clients.sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom)); });
          refreshAll();
          toast(ok + ' client(s) importé(s).' + (errs.length ? ' ' + errs.length + ' erreur(s) : ' + errs.slice(0, 2).join(' | ') : ''), errs.length ? 'warn' : 'success');
        });
      }).catch(function (e) { toast('Fichier illisible : ' + ((e && e.message) || ''), 'error'); });
  }

  // ── API publique et accroches ────────────────────────────────────────
  w.TCGestion = {
    active: active,
    codes: function () { return state.clients.map(function (c) { return c.code; }); },
    labelFor: function (code) { var c = byCode(code); return c ? c.nom + ' · ' + c.code : code; },
    fraisFor: fraisFor,
    editClient: function (c) { if (!state.loaded) load().then(function () { editClient(c); }); else editClient(c); },
    reload: function () { return load(true).then(refreshAll); }
  };

  var origRender = null;
  function hook() {
    if (origRender || typeof w.renderPortfolio !== 'function') return false;
    origRender = w.renderPortfolio;
    w.renderPortfolio = function () { var r = origRender.apply(this, arguments); try { mount(); } catch (e) { console.error('[GESTION]', e); } return r; };
    return true;
  }
  var tries = 0, timer = setInterval(function () { if (hook() || ++tries > 80) clearInterval(timer); }, 200);
  w.addEventListener('portfolio:updated', function () { setTimeout(mount, 80); });
  w.addEventListener('tc:entitlements', function () { setTimeout(mount, 0); });
  setTimeout(mount, 600);
  if (active()) load().then(function () { mount(); if (w.TCPfAccounts) w.TCPfAccounts.refresh(); });
})(window, document);
