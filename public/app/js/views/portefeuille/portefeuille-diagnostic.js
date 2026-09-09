// ============================================================================
// PORTEFEUILLE v2 — Diagnostic (détection des oublis) · méthode CMP · import CSV
// (P2 roadmap — RichBourse en fait un argument fort, cf. rapport §9)
// Bloc greffé sur #view-portefeuille APRÈS renderPortfolio. Lecture seule pour
// le diagnostic ; l'import ajoute des transactions via l'API existante.
// ============================================================================
(function () {
  'use strict';
  if (window.__TC_PF_DIAG__) return;
  window.__TC_PF_DIAG__ = true;

  function esc(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function n(v) { var x = Number(v); return isFinite(x) ? x : null; }
  function fmt(v) { var x = Number(v); return isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '—'; }
  function txQty(t) { return n(t.quantite != null ? t.quantite : t.quantity != null ? t.quantity : t.qty); }
  function txPrice(t) { return n(t.prix_unitaire != null ? t.prix_unitaire : t.cours != null ? t.cours : t.price); }
  function txDate(t) { return String(t.date_transaction || t.date || '').slice(0, 10); }
  function txType(t) { return String(t.type || '').toUpperCase().trim(); }
  function txNet(t) { return n(t.montant_net != null ? t.montant_net : t.montant); }

  function entKnown(tk) {
    return !!(window.entMap && window.entMap[tk]) ||
      (Array.isArray(window.allCours) && window.allCours.some(function (c) { return c && String(c.ticker).toUpperCase() === tk; }));
  }
  function coursOf(tk) {
    var c = (Array.isArray(window.allCours) ? window.allCours : []).find(function (x) { return x && String(x.ticker).toUpperCase() === tk; });
    return c ? n(c.cloture != null ? c.cloture : c.cours) : null;
  }

  // Rejoue le journal et remonte les anomalies.
  function diagnose(txs) {
    var issues = [];
    var rows = (txs || []).slice().sort(function (a, b) {
      var da = Date.parse(txDate(a) || 0), db = Date.parse(txDate(b) || 0);
      return da !== db ? da - db : String(a.id || '').localeCompare(String(b.id || ''));
    });
    var held = {}, cash = 0, cashTracked = false, prevDate = '';
    rows.forEach(function (t) {
      var ty = txType(t), tk = String(t.ticker || '').toUpperCase().trim(), q = txQty(t), p = txPrice(t), net = txNet(t), d = txDate(t);
      if (!d) issues.push({ s: 'err', m: 'Transaction sans date (' + (ty || '?') + ' ' + (tk || '') + ').' });
      else if (prevDate && d < prevDate) issues.push({ s: 'info', m: 'Transaction du ' + d + ' saisie après une transaction du ' + prevDate + ' (ordre chronologique à vérifier).' });
      if (d) prevDate = d;

      if (ty === 'ACHAT' || ty === 'VENTE') {
        if (tk && tk !== 'CASH' && !entKnown(tk)) issues.push({ s: 'warn', m: 'Ticker inconnu de la cote : ' + esc(tk) + ' (' + ty + ' du ' + d + ').' });
        if (q == null || q <= 0) issues.push({ s: 'err', m: ty + ' ' + esc(tk) + ' du ' + d + ' : quantité manquante ou nulle.' });
        if (p == null || p <= 0) issues.push({ s: 'err', m: ty + ' ' + esc(tk) + ' du ' + d + ' : prix unitaire manquant ou nul.' });
        if (ty === 'ACHAT') { held[tk] = (held[tk] || 0) + (q || 0); cash -= (net != null ? net : (q || 0) * (p || 0)); }
        else {
          var avail = held[tk] || 0;
          if ((q || 0) > avail + 1e-6) issues.push({ s: 'err', m: 'Vente de ' + fmt(q) + ' ' + esc(tk) + ' le ' + d + ' : seulement ' + fmt(avail) + ' en portefeuille (achat manquant ?).' });
          held[tk] = avail - (q || 0);
          cash += (net != null ? net : (q || 0) * (p || 0));
        }
      } else if (ty === 'DEPOT' || ty === 'DIVIDENDE') { cashTracked = true; cash += (net != null ? Math.abs(net) : 0); }
      else if (ty === 'RETRAIT') { cashTracked = true; cash -= (net != null ? Math.abs(net) : 0); if (cash < -1e-6) issues.push({ s: 'warn', m: 'Retrait du ' + d + ' : le solde espèces devient négatif (' + fmt(cash) + ' FCFA).' }); }
      else if (ty) issues.push({ s: 'warn', m: 'Type de transaction non reconnu : ' + esc(ty) + ' (' + d + ').' });
    });

    Object.keys(held).forEach(function (tk) {
      if (held[tk] > 1e-6 && tk !== 'CASH' && coursOf(tk) == null) {
        issues.push({ s: 'warn', m: 'Position détenue sur ' + esc(tk) + ' (' + fmt(held[tk]) + ') mais aucun cours courant disponible : valorisation impossible.' });
      }
      if (held[tk] < -1e-6) issues.push({ s: 'err', m: 'Quantité négative sur ' + esc(tk) + ' (' + fmt(held[tk]) + ') : le journal est incohérent.' });
    });

    return { issues: issues, positions: Object.keys(held).filter(function (k) { return held[k] > 1e-6; }).length, cash: cashTracked ? cash : null };
  }

  function injectCss() {
    if (document.getElementById('tc-pfdiag-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-pfdiag-css';
    s.textContent = [
      '#view-portefeuille .pfd{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-top:16px}',
      '#view-portefeuille .pfd h3{margin:0 0 4px;font:600 10px var(--sans);letter-spacing:.13em;text-transform:uppercase;color:var(--gold)}',
      '#view-portefeuille .pfd p.pfd-sub{margin:0 0 12px;font-size:11px;color:var(--muted)}',
      '#view-portefeuille .pfd-list{display:flex;flex-direction:column;gap:6px}',
      '#view-portefeuille .pfd-i{display:flex;gap:9px;font-size:12px;line-height:1.5;color:var(--cream);padding:7px 10px;border:1px solid var(--border2);border-radius:8px}',
      '#view-portefeuille .pfd-i b{flex:0 0 auto;font:700 8px var(--sans);letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:999px;height:fit-content}',
      '#view-portefeuille .pfd-i.err b{color:var(--red);border:1px solid var(--red)}',
      '#view-portefeuille .pfd-i.warn b{color:var(--warn);border:1px solid var(--warn)}',
      '#view-portefeuille .pfd-i.info b{color:var(--muted);border:1px solid var(--border)}',
      '#view-portefeuille .pfd-ok{font-size:12px;color:var(--green)}',
      '#view-portefeuille .pfd-cmp{font-size:12px;line-height:1.7;color:var(--muted)}',
      '#view-portefeuille .pfd-cmp code{color:var(--cream);font-family:var(--mono);font-size:11px}',
      '#view-portefeuille .pfd textarea{width:100%;box-sizing:border-box;min-height:90px;background:var(--surface);border:1px solid var(--border2);border-radius:8px;color:var(--cream);font:400 12px var(--mono);padding:10px;outline:none}',
      '#view-portefeuille .pfd textarea:focus{border-color:var(--gold)}',
      '#view-portefeuille .pfd-btn{margin-top:10px;border:1px solid var(--gold);background:var(--gold-bg);color:var(--gold-l);border-radius:8px;padding:7px 16px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:.06em;cursor:pointer}',
      '#view-portefeuille .pfd-btn:disabled{opacity:.5;cursor:default}',
      '#view-portefeuille .pfd-prev{margin-top:10px;font-size:11px;color:var(--muted)}',
      '#view-portefeuille .pfd-prev .bad{color:var(--red)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function parseCsv(text) {
    var out = [], errs = [];
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      line = line.trim();
      if (!line || /^(date|#)/i.test(line)) return;
      var p = line.split(/[;,\t]/).map(function (x) { return x.trim(); });
      if (p.length < 3) { errs.push('L' + (i + 1) + ' : format attendu date;type;ticker;quantité;prix'); return; }
      var d = p[0], ty = (p[1] || '').toUpperCase(), tk = (p[2] || '').toUpperCase();
      var row = { date: d, type: ty, ticker: tk };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { errs.push('L' + (i + 1) + ' : date « ' + d + " » (attendu AAAA-MM-JJ)"); return; }
      if (['ACHAT', 'VENTE'].indexOf(ty) >= 0) {
        row.quantity = Number(p[3]); row.price = Number(p[4]);
        if (!(row.quantity > 0) || !(row.price > 0)) { errs.push('L' + (i + 1) + ' : quantité et prix positifs requis'); return; }
      } else if (['DEPOT', 'RETRAIT', 'DIVIDENDE'].indexOf(ty) >= 0) {
        row.amount = Number(p[3]); row.ticker = tk || 'CASH';
        if (!(row.amount > 0)) { errs.push('L' + (i + 1) + ' : montant positif requis'); return; }
      } else { errs.push('L' + (i + 1) + ' : type « ' + ty + ' » non reconnu (ACHAT/VENTE/DEPOT/RETRAIT/DIVIDENDE)'); return; }
      out.push(row);
    });
    return { rows: out, errs: errs };
  }

  function mount() {
    var view = document.getElementById('view-portefeuille');
    if (!view || !window.portfolioStore) return;
    injectCss();
    var box = document.getElementById('pfDiag');
    if (!box) { box = document.createElement('div'); box.id = 'pfDiag'; view.appendChild(box); }

    var txs = window.portfolioStore.getTransactions ? window.portfolioStore.getTransactions() : [];
    var d = diagnose(txs);
    var byS = { err: [], warn: [], info: [] };
    d.issues.forEach(function (x) { (byS[x.s] || byS.info).push(x); });
    var ordered = byS.err.concat(byS.warn, byS.info);

    box.innerHTML =
      '<div class="pfd"><h3>Diagnostic du portefeuille</h3>'
      + '<p class="pfd-sub">' + txs.length + ' transactions · ' + d.positions + ' positions'
      + (d.cash != null ? ' · solde espèces estimé ' + fmt(d.cash) + ' FCFA' : '') + '</p>'
      + (ordered.length
        ? '<div class="pfd-list">' + ordered.map(function (x) {
          return '<div class="pfd-i ' + x.s + '"><b>' + (x.s === 'err' ? 'Bloquant' : x.s === 'warn' ? 'Attention' : 'Info') + '</b><span>' + x.m + '</span></div>';
        }).join('') + '</div>'
        : '<div class="pfd-ok">Aucune incohérence détectée dans le journal des opérations.</div>')
      + '</div>'

      + '<div class="pfd"><h3>Méthode de calcul</h3>'
      + '<div class="pfd-cmp">'
      + 'Coût moyen pondéré (PRU) : <code>Σ(montants d\'achat) / Σ(quantités achetées)</code>. Les ventes réduisent la quantité détenue, <b>pas</b> le PRU.<br>'
      + 'Plus-value latente : <code>valeur actuelle − PRU × quantité détenue</code>.<br>'
      + 'Plus-value réalisée : <code>produit net des ventes − PRU × quantités vendues</code>.<br>'
      + 'Rendement : plus-value rapportée aux capitaux investis. Cash gagné = dividendes et gains <b>effectivement encaissés</b> (distinct du latent).'
      + '</div></div>'

      + '<div class="pfd"><h3>Import d\'un relevé</h3>'
      + '<p class="pfd-sub">Une opération par ligne — <code>date;type;ticker;quantité;prix</code> (ACHAT/VENTE) ou <code>date;type;;montant</code> (DEPOT/RETRAIT/DIVIDENDE). Date AAAA-MM-JJ.</p>'
      + '<textarea id="pfImp" placeholder="2026-03-15;ACHAT;SNTS;10;17200&#10;2026-06-20;DIVIDENDE;SNTS;;12500"></textarea>'
      + '<div class="pfd-prev" id="pfImpPrev"></div>'
      + '<button type="button" class="pfd-btn" id="pfImpBtn" disabled>Analyser</button>'
      + '</div>';

    var ta = document.getElementById('pfImp'), prev = document.getElementById('pfImpPrev'), btn = document.getElementById('pfImpBtn');
    var parsed = { rows: [], errs: [] };
    ta.addEventListener('input', function () {
      parsed = parseCsv(ta.value);
      prev.innerHTML = (parsed.rows.length ? parsed.rows.length + ' opération(s) valides. ' : '')
        + (parsed.errs.length ? '<span class="bad">' + parsed.errs.length + ' ligne(s) ignorée(s) : ' + esc(parsed.errs.slice(0, 3).join(' · ')) + (parsed.errs.length > 3 ? '…' : '') + '</span>' : '');
      btn.disabled = !parsed.rows.length;
      btn.textContent = 'Importer ' + parsed.rows.length + ' opération' + (parsed.rows.length > 1 ? 's' : '');
    });
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      var ok = 0, ko = 0;
      for (var i = 0; i < parsed.rows.length; i++) {
        var r = parsed.rows[i];
        btn.textContent = 'Import ' + (i + 1) + '/' + parsed.rows.length + '…';
        try {
          if (r.type === 'ACHAT' || r.type === 'VENTE') await window.portfolioStore.addTransaction({ type: r.type, ticker: r.ticker, quantity: r.quantity, price: r.price, date: r.date });
          else await window.portfolioStore.addTransaction({ type: r.type, ticker: r.ticker, amount: r.amount, montant: r.amount, date: r.date });
          ok++;
        } catch (e) { ko++; }
      }
      btn.textContent = ok + ' importée(s)' + (ko ? ', ' + ko + ' échec(s)' : '');
      if (typeof window.toast === 'function') window.toast(ok + ' opération(s) importée(s)' + (ko ? ', ' + ko + ' en échec' : ''), ko ? 'warn' : 'success');
      if (typeof window.renderPortfolio === 'function') setTimeout(window.renderPortfolio, 400);
    });
  }

  function hook() {
    if (typeof window.renderPortfolio !== 'function') return false;
    if (window.renderPortfolio.__pfDiagWrapped) return true;
    var orig = window.renderPortfolio;
    var wrapped = function () {
      var res = orig.apply(this, arguments);
      Promise.resolve().then(mount).catch(function () {});
      return res;
    };
    wrapped.__pfDiagWrapped = true;
    window.renderPortfolio = wrapped;
    return true;
  }

  if (!hook()) { var k = 0, iv = setInterval(function () { if (hook() || ++k > 60) clearInterval(iv); }, 150); }
  window.addEventListener('portfolio:updated', function () {
    var v = document.getElementById('view-portefeuille');
    if (v && v.classList.contains('active')) Promise.resolve().then(mount);
  });
})();
