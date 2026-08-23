/**
 * THE CAPITAL — États financiers : saisie complète, Excel et documents
 *
 * Ajoute au panneau États financiers trois blocs que l'ancienne interface
 * n'offrait pas : la saisie des 66 postes SYSCOHADA regroupés par état, le
 * modèle Excel en import et export, et le dépôt des rapports en PDF.
 *
 * Le formulaire est engendré à partir de FinancialsSchema. Aucun champ n'est
 * écrit en dur ici : ajouter un poste au dictionnaire le fait apparaître dans
 * le formulaire, dans le classeur et dans les contrôles, sans toucher à ce
 * fichier. C'est ce qui empêchera les trois listes de diverger à nouveau.
 *
 * L'écriture est adaptative : les colonnes réellement présentes en base sont
 * lues avant tout envoi. Si la migration SYSCOHADA n'a pas encore été
 * exécutée, les postes inconnus sont écartés et signalés, au lieu de faire
 * échouer l'enregistrement entier — PostgREST rejette la requête complète dès
 * qu'une seule colonne est inconnue.
 */
(function () {
  'use strict';

  if (window.__TC_FIN_ADMIN__) return;
  window.__TC_FIN_ADMIN__ = true;

  var schema = null;
  var courant = { ticker: '', annee: new Date().getFullYear() - 1, periode: 'annuel' };

  var S = function () { return window.FinancialsSchema; };

  function esc(v) {
    var d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  function nb(v) {
    var n = Number(v);
    return isFinite(n) ? n.toLocaleString('fr-FR') : '—';
  }

  function toast2(msg, type) {
    if (typeof toast === 'function') toast(msg, type || 'ok');
    else console.log('[FIN]', msg);
  }

  async function chargerSchema() {
    if (schema) return schema;
    schema = {};
    try {
      var r = await fetch(SB_REST + '/', {
        headers: sbHeaders({ Accept: 'application/openapi+json' }), cache: 'no-store'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var spec = await r.json();
      var defs = (spec && (spec.definitions || (spec.components && spec.components.schemas))) || {};
      Object.keys(defs).forEach(function (t) {
        if (defs[t] && defs[t].properties) schema[t] = Object.keys(defs[t].properties);
      });
    } catch (e) {
      console.warn('[FIN] Schéma non lisible :', e && e.message);
    }
    return schema;
  }

  function ajuster(table, ligne) {
    var cols = schema && schema[table];
    if (!cols || !cols.length) return { ligne: ligne, ignorees: [] };
    var set = {};
    cols.forEach(function (c) { set[c] = true; });
    var out = {};
    var ignorees = [];
    Object.keys(ligne).forEach(function (k) {
      if (set[k]) out[k] = ligne[k];
      else if (ligne[k] != null && ligne[k] !== '') ignorees.push(k);
    });
    return { ligne: out, ignorees: ignorees };
  }

  function champMeta(m) {
    if (m.type === 'liste') {
      return '<select id="fin-' + m.cle + '" class="fin-input">'
        + '<option value=""></option>'
        + m.options.map(function (o) {
            return '<option value="' + esc(o) + '"' + (m.defaut === o ? ' selected' : '') + '>'
              + esc(o.replace(/_/g, ' ')) + '</option>';
          }).join('')
        + '</select>';
    }
    var type = m.type === 'date' ? 'date' : (m.type === 'entier' ? 'number' : 'text');
    return '<input type="' + type + '" id="fin-' + m.cle + '" class="fin-input"'
      + (m.defaut ? ' value="' + esc(m.defaut) + '"' : '')
      + (m.requis ? ' required' : '') + '>';
  }

  function blocEtat(etat) {
    var lignes = etat.postes.map(function (p) {
      var cls = 'fin-poste fin-n' + p.niveau;
      var aide = p.aide ? ' <span class="fin-aide" title="' + esc(p.aide) + '">?</span>' : '';
      var calc = p.calcul
        ? '<span class="fin-calc" title="Contrôlé contre : '
          + esc(p.calcul.join(' + ').replace(/\+ -/g, '− ')) + '">Σ</span>'
        : '';
      return '<div class="' + cls + '">'
        + '<label for="fin-' + p.cle + '">' + esc(p.libelle) + aide + calc + '</label>'
        + '<input type="number" step="any" id="fin-' + p.cle + '" data-poste="' + p.cle + '" class="fin-input fin-num">'
        + '</div>';
    }).join('');
    return '<details class="fin-etat" open>'
      + '<summary><span class="fin-etat-titre">' + esc(etat.titre) + '</span>'
      + '<span class="fin-etat-resume">' + esc(etat.resume) + '</span></summary>'
      + '<div class="fin-postes">' + lignes + '</div></details>';
  }

  function construireFormulaire() {
    return '<div class="fin-meta">'
      + S().META.map(function (m) {
          return '<div class="fin-meta-champ">'
            + '<label for="fin-' + m.cle + '">' + esc(m.libelle)
            + (m.requis ? ' <em>*</em>' : '') + '</label>' + champMeta(m) + '</div>';
        }).join('')
      + '</div>'
      + S().ETATS.map(blocEtat).join('')
      + '<div id="fin-controles" class="fin-controles"></div>'
      + '<div class="fin-actions">'
      + '  <button type="button" id="fin-charger" class="btn ghost">Charger l\'exercice</button>'
      + '  <button type="button" id="fin-vider" class="btn ghost">Vider</button>'
      + '  <button type="button" id="fin-verifier" class="btn ghost">Vérifier la cohérence</button>'
      + '  <button type="button" id="fin-enregistrer" class="btn">Enregistrer</button>'
      + '</div>';
  }

  function lireFormulaire() {
    var out = {};
    S().META.forEach(function (m) {
      var el = document.getElementById('fin-' + m.cle);
      if (!el) return;
      var v = String(el.value || '').trim();
      if (!v) return;
      out[m.cle] = (m.type === 'entier') ? Number(v) : v;
    });
    S().tousPostes().forEach(function (p) {
      var el = document.getElementById('fin-' + p.cle);
      if (!el) return;
      var v = String(el.value || '').trim();
      if (v === '') return;
      var n = Number(v.replace(',', '.'));
      if (isFinite(n)) out[p.cle] = n;
    });
    return out;
  }

  function remplirFormulaire(ligne) {
    S().META.concat(S().tousPostes()).forEach(function (c) {
      var el = document.getElementById('fin-' + c.cle);
      if (!el) return;
      var v = ligne ? ligne[c.cle] : null;
      el.value = (v == null) ? '' : v;
    });
  }

  function afficherControles(ecarts, contexte) {
    var hote = document.getElementById('fin-controles');
    if (!hote) return;
    if (!ecarts.length) {
      hote.innerHTML = '<div class="fin-ok">Cohérence vérifiée : sous-totaux, équilibre du bilan et concordance du résultat net sont conformes' + (contexte ? ' (' + esc(contexte) + ')' : '') + '.</div>';
      return;
    }
    hote.innerHTML = '<div class="fin-ecarts"><strong>' + ecarts.length + ' écart(s) de cohérence</strong><p>Ces écarts sont signalés, pas corrigés. Vérifiez avant d\'enregistrer.</p><ul>'
      + ecarts.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul></div>';
  }

  function verifier() { afficherControles(S().controler(lireFormulaire())); }

  function contexte() {
    var t = String((document.getElementById('fin-ticker') || {}).value || '').trim().toUpperCase();
    var a = Number((document.getElementById('fin-annee') || {}).value);
    var p = String((document.getElementById('fin-periode') || {}).value || 'annuel');
    return { ticker: t, annee: a, periode: p };
  }

  async function charger() {
    var c = contexte();
    if (!c.ticker || !c.annee) { toast2('Renseignez le ticker et l\'exercice.', 'err'); return; }
    var rows = await sbGet('financials', 'select=*&ticker=eq.' + encodeURIComponent(c.ticker) + '&annee=eq.' + c.annee + '&limit=1');
    if (!rows || !rows.length) { toast2('Aucun exercice enregistré pour ' + c.ticker + ' ' + c.annee + '.', 'warn'); return; }
    remplirFormulaire(rows[0]);
    afficherControles(S().controler(rows[0]), c.ticker + ' ' + c.annee);
    toast2('Exercice chargé.', 'ok');
  }

  async function enregistrer() {
    var ligne = lireFormulaire();
    if (!ligne.ticker || !ligne.annee) { toast2('Ticker et exercice obligatoires.', 'err'); return; }
    ligne.ticker = String(ligne.ticker).toUpperCase();
    var ecarts = S().controler(ligne);
    if (ecarts.length && !confirm(ecarts.length + ' écart(s) de cohérence détecté(s).\n\n' + ecarts.slice(0, 5).map(function (e) { return '• ' + e.message; }).join('\n') + (ecarts.length > 5 ? '\n…' : '') + '\n\nEnregistrer malgré tout ?')) return;
    await chargerSchema();
    var a = ajuster('financials', ligne);
    if (a.ignorees.length) toast2('Colonnes absentes de la base, non enregistrées : ' + a.ignorees.join(', ') + '. La migration SYSCOHADA a-t-elle été exécutée ?', 'warn');
    var res = await sbPost('financials', a.ligne, 'ticker,annee');
    if (res) { toast2('Exercice ' + a.ligne.ticker + ' ' + a.ligne.annee + ' enregistré.', 'ok'); afficherControles(ecarts, a.ligne.ticker + ' ' + a.ligne.annee); }
  }

  async function exporterExcel() {
    var c = contexte();
    var params = 'select=*&order=annee.desc&limit=200';
    if (c.ticker) params += '&ticker=eq.' + encodeURIComponent(c.ticker);
    var rows = (await sbGet('financials', params)) || [];
    try { toast2('Classeur généré : ' + window.FinancialsExcel.exporter(rows, { ticker: c.ticker }) + ' (' + rows.length + ' exercice(s)).', 'ok'); }
    catch (e) { toast2('Export impossible : ' + e.message, 'err'); }
  }

  function importerExcel(fichier) {
    var lecteur = new FileReader();
    lecteur.onload = async function () {
      var hote = document.getElementById('fin-import-apercu');
      try {
        var r = window.FinancialsExcel.importer(new Uint8Array(lecteur.result));
        if (!r.lignes.length) { hote.innerHTML = '<div class="fin-ecarts">Aucun exercice exploitable dans ce fichier.</div>'; return; }
        hote.innerHTML = '<div class="fin-apercu"><strong>' + r.lignes.length + ' exercice(s) prêt(s) à l\'import</strong><div class="fin-apercu-liste">' + r.lignes.map(function (l) { return '<span class="fin-chip">' + esc(l.ticker) + ' ' + esc(l.annee) + '</span>'; }).join('') + '</div>'
          + (r.anomalies.length ? '<p class="fin-warn">' + r.anomalies.length + ' avertissement(s) :</p><ul>' + r.anomalies.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' : '')
          + (r.ecarts.length ? '<p class="fin-warn">' + r.ecarts.length + ' écart(s) de cohérence :</p><ul>' + r.ecarts.slice(0, 12).map(function (e) { return '<li>' + esc(e.annee) + ' — ' + esc(e.message) + '</li>'; }).join('') + '</ul>' : '<p class="fin-ok-inline">Aucun écart de cohérence détecté.</p>')
          + '<button type="button" class="btn" id="fin-import-confirmer">Enregistrer ces ' + r.lignes.length + ' exercice(s)</button></div>';
        document.getElementById('fin-import-confirmer').addEventListener('click', async function () {
          this.disabled = true;
          await chargerSchema();
          var ok = 0, echecs = 0, ignoreesGlobal = {};
          for (var i = 0; i < r.lignes.length; i++) {
            var a = ajuster('financials', r.lignes[i]);
            a.ignorees.forEach(function (c) { ignoreesGlobal[c] = true; });
            var res = await sbPost('financials', a.ligne, 'ticker,annee');
            if (res) ok++; else echecs++;
          }
          var restantes = Object.keys(ignoreesGlobal);
          toast2(ok + ' exercice(s) enregistré(s)' + (echecs ? ', ' + echecs + ' en échec' : '') + (restantes.length ? '. Colonnes absentes de la base : ' + restantes.join(', ') : '.'), echecs ? 'warn' : 'ok');
          if (typeof window.loadFinancials === 'function') window.loadFinancials();
        });
      } catch (e) { hote.innerHTML = '<div class="fin-ecarts">Lecture impossible : ' + esc(e.message) + '</div>'; }
    };
    lecteur.readAsArrayBuffer(fichier);
  }

  function jeton() { return (window.TC_ENV && window.TC_ENV.getToken()) || (typeof TK !== 'undefined' ? TK : ''); }

  async function apiDocs(methode, corps, requete) {
    var entetes = { Accept: 'application/json', Authorization: 'Bearer ' + jeton() };
    if (corps) entetes['Content-Type'] = 'application/json';
    var r = await fetch('/api/financials-upload' + (requete || ''), { method: methode, headers: entetes, body: corps ? JSON.stringify(corps) : undefined, cache: 'no-store' });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
    return d.data;
  }

  async function listerDocs() {
    var hote = document.getElementById('fin-docs-liste');
    if (!hote) return;
    var c = contexte();
    try {
      var docs = await apiDocs('GET', null, c.ticker ? '?ticker=' + encodeURIComponent(c.ticker) : '');
      if (!docs.length) { hote.innerHTML = '<div class="fin-vide">Aucun document déposé' + (c.ticker ? ' pour ' + esc(c.ticker) : '') + '.</div>'; return; }
      hote.innerHTML = '<table class="fin-docs"><thead><tr><th>Ticker</th><th>Exercice</th><th>Type</th><th>Fichier</th><th>Visible</th><th></th></tr></thead><tbody>'
        + docs.map(function (d) { return '<tr><td class="td-gold">' + esc(d.ticker) + '</td><td>' + esc(d.annee) + ' · ' + esc(d.periode) + '</td><td>' + esc(String(d.type_document).replace(/_/g, ' ')) + '</td><td><a href="' + esc(d.fichier_url) + '" target="_blank" rel="noopener">' + esc(d.fichier_nom) + '</a>' + (d.taille_octets ? ' <span class="fin-taille">' + Math.round(d.taille_octets / 1024) + ' Ko</span>' : '') + '</td><td>' + (d.publie ? 'oui' : 'non') + '</td><td><button type="button" class="fin-suppr" data-id="' + esc(d.id) + '">Supprimer</button></td></tr>'; }).join('')
        + '</tbody></table>';
      Array.prototype.forEach.call(hote.querySelectorAll('.fin-suppr'), function (b) { b.addEventListener('click', async function () { if (!confirm('Supprimer définitivement ce document ?')) return; try { await apiDocs('DELETE', null, '?id=' + encodeURIComponent(b.getAttribute('data-id'))); toast2('Document supprimé.', 'ok'); listerDocs(); } catch (e) { toast2('Suppression impossible : ' + e.message, 'err'); } }); });
    } catch (e) { hote.innerHTML = '<div class="fin-ecarts">Liste indisponible : ' + esc(e.message) + '. La table financials_documents existe-t-elle ?</div>'; }
  }

  async function deposerDoc() {
    var fichier = (document.getElementById('fin-doc-fichier') || {}).files;
    fichier = fichier && fichier[0];
    var c = contexte();
    var msg = document.getElementById('fin-doc-msg');
    var poser = function (t, cls) { if (msg) { msg.textContent = t; msg.className = 'msg ' + (cls || ''); } };
    if (!fichier) return poser('Choisissez un fichier PDF.', 'err');
    if (!/\.pdf$/i.test(fichier.name)) return poser('Seuls les fichiers PDF sont acceptés.', 'err');
    if (!c.ticker || !c.annee) return poser('Renseignez le ticker et l\'exercice en haut du formulaire.', 'err');
    var meta = { ticker: c.ticker, annee: c.annee, periode: c.periode, type_document: (document.getElementById('fin-doc-type') || {}).value || 'etats_financiers', titre: (document.getElementById('fin-doc-titre') || {}).value || null, publie: !(document.getElementById('fin-doc-brouillon') || {}).checked };
    try {
      poser('Préparation du dépôt…');
      var prep = await apiDocs('POST', Object.assign({ action: 'prepare', filename: fichier.name }, meta));
      poser('Téléversement (' + Math.round(fichier.size / 1024) + ' Ko)…');
      var up = await fetch(prep.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: fichier });
      if (!up.ok) throw new Error('Téléversement refusé (HTTP ' + up.status + ')');
      poser('Enregistrement…');
      await apiDocs('POST', Object.assign({ action: 'finalize', path: prep.path, filename: fichier.name, taille: fichier.size }, meta));
      poser('Document déposé.', 'ok');
      document.getElementById('fin-doc-fichier').value = '';
      listerDocs();
    } catch (e) { poser('Échec : ' + e.message, 'err'); }
  }

  function installer() {
    var panneau = document.getElementById('panel-financials');
    if (!panneau || document.getElementById('fin-avance') || !S()) return;
    var carte = document.createElement('div');
    carte.id = 'fin-avance';
    carte.className = 'card';
    carte.style.marginBottom = '16px';
    carte.innerHTML = '<div class="card-header"><span class="card-title">Saisie complète — plan SYSCOHADA</span></div>'
      + '<div class="fin-corps">' + construireFormulaire() + '</div>'
      + '<div class="card-header fin-sep"><span class="card-title">Modèle Excel</span></div>'
      + '<div class="fin-corps"><p class="fin-note">Le classeur comporte une feuille par état, postes en lignes et exercices en colonnes. Sa structure est engendrée à partir du même dictionnaire que ce formulaire.</p>'
      + '<div class="fin-actions"><button type="button" id="fin-excel-export" class="btn ghost">Exporter / modèle vierge</button><label class="btn ghost" for="fin-excel-fichier">Importer un classeur</label><input type="file" id="fin-excel-fichier" accept=".xlsx,.xls" hidden></div><div id="fin-import-apercu"></div></div>'
      + '<div class="card-header fin-sep"><span class="card-title">États financiers en PDF</span></div>'
      + '<div class="fin-corps"><p class="fin-note">Le document déposé est rattaché au ticker et à l\'exercice saisis ci-dessus. Publié, il devient consultable depuis la fiche de la valeur dans l\'application.</p>'
      + '<div class="fin-doc-form"><select id="fin-doc-type" class="fin-input"><option value="etats_financiers">États financiers</option><option value="rapport_annuel">Rapport annuel</option><option value="rapport_semestriel">Rapport semestriel</option><option value="communique">Communiqué</option><option value="note_information">Note d\'information</option><option value="autre">Autre</option></select>'
      + '<input type="text" id="fin-doc-titre" class="fin-input" placeholder="Titre (facultatif)"><input type="file" id="fin-doc-fichier" accept="application/pdf" class="fin-input"><label class="fin-check"><input type="checkbox" id="fin-doc-brouillon"> Ne pas publier</label><button type="button" id="fin-doc-deposer" class="btn">Déposer</button></div>'
      + '<div id="fin-doc-msg" class="msg"></div><div id="fin-docs-liste"></div></div>';
    panneau.insertBefore(carte, panneau.firstChild ? panneau.firstChild.nextSibling : null);
    var lier = function (id, ev, fn) { var el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
    lier('fin-charger', 'click', charger);
    lier('fin-vider', 'click', function () { remplirFormulaire(null); document.getElementById('fin-controles').innerHTML = ''; });
    lier('fin-verifier', 'click', verifier);
    lier('fin-enregistrer', 'click', enregistrer);
    lier('fin-excel-export', 'click', exporterExcel);
    lier('fin-excel-fichier', 'change', function () { if (this.files && this.files[0]) importerExcel(this.files[0]); });
    lier('fin-doc-deposer', 'click', deposerDoc);
    lier('fin-ticker', 'change', listerDocs);
    var annee = document.getElementById('fin-annee');
    if (annee && !annee.value) annee.value = courant.annee;
    listerDocs();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer);
  else installer();

  window.TCFinancialsAdmin = { installer: installer, listerDocs: listerDocs };
})();
