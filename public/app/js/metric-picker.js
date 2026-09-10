// ============================================================================
// SÉLECTEUR D'INDICATEURS PARTAGÉ  (Screener, Comparateur, et vues futures)
// Sort la liste d'indicateurs « en dur » du code vers un choix utilisateur :
// bouton « Indicateurs », liste à cocher groupée, préréglages, mémorisé en
// localStorage par vue. Chaque indicateur sait se formater (fmt) et, pour le
// screener, quel sens est « meilleur » (hi: 'high' | 'low' | null).
// Les valeurs viennent des objets de ligne déjà construits par chaque vue —
// aucun calcul supplémentaire ici.
// ============================================================================
(function () {
  'use strict';
  if (window.TC_METRICS) return;

  function nf(v, d) { var n = Number(v); return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 0 : d }) : '—'; }
  function pf(v, d) { var n = Number(v); return isFinite(n) ? (n > 0 ? '+' : '') + nf(n, d == null ? 2 : d) + ' %' : '—'; }
  function money(v) { var n = Number(v); if (!isFinite(n)) return '—'; var a = Math.abs(n); if (a >= 1e9) return nf(n / 1e9, 2) + ' Md'; if (a >= 1e6) return nf(n / 1e6, 1) + ' M'; return nf(n); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function x1(v) { return v != null && isFinite(v) ? Number(v).toFixed(1) + 'x' : '—'; }
  function x2(v) { return v != null && isFinite(v) ? Number(v).toFixed(2) + 'x' : '—'; }
  function p1(v) { return v != null && isFinite(v) ? Number(v).toFixed(1) + ' %' : '—'; }
  function p2(v) { return v != null && isFinite(v) ? Number(v).toFixed(2) + ' %' : '—'; }

  // Chaque indicateur : k (clé du champ dans la ligne), l (libellé), g (groupe),
  // f (formatage), hi (sens favorable pour le screener), cmp (comparable dans
  // le comparateur : true par défaut).
  var CAT = [
    { k: 'cours', l: 'Cours', g: 'Marché', f: function (r) { return nf(r.cours); }, hi: null },
    { k: 'variation', l: 'Variation du jour', g: 'Marché', f: function (r) { return pf(r.variation, 2); }, hi: 'high' },
    { k: 'volume', l: 'Volume', g: 'Marché', f: function (r) { return nf(r.volume); }, hi: 'high' },
    { k: 'turnover', l: 'Valeur transigée', g: 'Marché', f: function (r) { return money(r.turnover) + ' F'; }, hi: 'high' },
    { k: 'capi', l: 'Capitalisation', g: 'Marché', f: function (r) { return money(r.capi) + ' F'; }, hi: null },
    { k: 'per', l: 'PER', g: 'Valorisation', f: function (r) { return x1(r.per); }, hi: 'low' },
    { k: 'pbr', l: 'P / B', g: 'Valorisation', f: function (r) { return x2(r.pbr); }, hi: 'low' },
    { k: 'rdt', l: 'Rendement dividende', g: 'Valorisation', f: function (r) { return p2(r.rdt); }, hi: 'high' },
    { k: 'roe', l: 'ROE', g: 'Rentabilité', f: function (r) { return p1(r.roe); }, hi: 'high' },
    { k: 'marge', l: 'Marge nette', g: 'Rentabilité', f: function (r) { return p1(r.marge); }, hi: 'high' },
    { k: 'croissance', l: 'Croissance du CA', g: 'Rentabilité', f: function (r) { return r.croissance != null ? pf(r.croissance, 0) : '—'; }, hi: 'high' },
    { k: 'detteFp', l: 'Dette nette / FP', g: 'Solidité', f: function (r) { return x2(r.detteFp); }, hi: 'low' },
    { k: 'score', l: 'Score The Capital', g: 'Synthèse', f: function (r) { return r.score != null ? String(r.score) : '—'; }, hi: 'high' },
    { k: 'secteur', l: 'Secteur', g: 'Identité', f: function (r) { return esc(r.secteur || '—'); }, hi: null, cmp: false },
    { k: 'pays', l: 'Pays', g: 'Identité', f: function (r) { return esc(r.pays || '—'); }, hi: null, cmp: false }
  ];

  var ALLK = CAT.map(function (m) { return m.k; });
  var PRESETS = {
    'Complet': ALLK.slice(),
    'Essentiel': ['cours', 'variation', 'per', 'rdt', 'score'],
    'Value': ['cours', 'per', 'pbr', 'rdt', 'score'],
    'Dividende': ['cours', 'rdt', 'marge', 'detteFp', 'score'],
    'Qualité': ['cours', 'roe', 'marge', 'detteFp', 'score'],
    'Croissance': ['cours', 'croissance', 'roe', 'per', 'score'],
    'Marché': ['cours', 'variation', 'volume', 'turnover', 'capi']
  };

  function keyFor(id) { return 'tc_metrics_' + id; }
  function metaFor(k) { for (var i = 0; i < CAT.length; i++) if (CAT[i].k === k) return CAT[i]; return null; }

  function getSelection(id, defaults) {
    try {
      var raw = localStorage.getItem(keyFor(id));
      if (raw) {
        var a = JSON.parse(raw);
        if (Array.isArray(a)) { a = a.filter(function (k) { return metaFor(k); }); if (a.length) return a; }
      }
    } catch (e) {}
    return (defaults && defaults.length) ? defaults.slice() : PRESETS.Complet.slice();
  }
  function setSelection(id, keys) { try { localStorage.setItem(keyFor(id), JSON.stringify(keys)); } catch (e) {} }

  function injectCss() {
    if (document.getElementById('tc-mp-css')) return;
    var s = document.createElement('style');
    s.id = 'tc-mp-css';
    s.textContent = [
      '.tc-mp-wrap{position:relative;display:inline-block}',
      '.tc-mp-btn{border:1px solid var(--border2,rgba(184,150,78,.2));background:transparent;color:var(--gold-l,#D4AF6A);border-radius:7px;padding:6px 12px;font:600 10px var(--sans,system-ui);text-transform:uppercase;letter-spacing:.06em;cursor:pointer}',
      '.tc-mp-btn:hover{border-color:var(--gold,#B8964E)}',
      '.tc-mp-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:900;width:280px;max-height:60vh;overflow:auto;background:var(--card,#181410);border:1px solid rgba(245,240,232,.14);border-radius:12px;padding:12px;box-shadow:0 18px 44px rgba(0,0,0,.5)}',
      '.tc-mp-pop[hidden]{display:none}',
      '.tc-mp-presets{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;border-bottom:1px solid rgba(245,240,232,.08);padding-bottom:10px}',
      '.tc-mp-presets button{border:1px solid rgba(245,240,232,.16);background:var(--surface,#13110C);color:var(--muted,rgba(245,240,232,.6));border-radius:999px;padding:4px 10px;font-size:10px;cursor:pointer}',
      '.tc-mp-presets button:hover{color:var(--gold-l,#D4AF6A);border-color:var(--gold,#B8964E)}',
      '.tc-mp-gl{font:600 8px var(--sans,system-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--dim,rgba(245,240,232,.34));margin:8px 0 4px}',
      '.tc-mp-pop label{display:flex;align-items:center;gap:8px;padding:4px 2px;font-size:12px;color:var(--cream,#F5F0E8);cursor:pointer}',
      '.tc-mp-pop label input{accent-color:var(--gold,#B8964E)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function groups() {
    var m = {}, order = [];
    CAT.forEach(function (x) { if (!m[x.g]) { m[x.g] = []; order.push(x.g); } m[x.g].push(x); });
    return order.map(function (g) { return { name: g, items: m[g] }; });
  }

  // host : élément où insérer le bouton. onChange(keys) appelé à chaque
  // modification. Renvoie la sélection initiale.
  function mount(host, viewId, defaults, onChange) {
    injectCss();
    var sel = getSelection(viewId, defaults);
    var wrap = document.createElement('span');
    wrap.className = 'tc-mp-wrap';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'tc-mp-btn'; btn.textContent = '⚙ Indicateurs';
    var pop = document.createElement('div'); pop.className = 'tc-mp-pop'; pop.hidden = true;
    wrap.appendChild(btn); wrap.appendChild(pop);
    host.appendChild(wrap);

    function paint() {
      pop.innerHTML = '<div class="tc-mp-presets">'
        + Object.keys(PRESETS).map(function (p) { return '<button type="button" data-p="' + esc(p) + '">' + esc(p) + '</button>'; }).join('')
        + '</div>'
        + groups().map(function (g) {
          return '<div class="tc-mp-gl">' + esc(g.name) + '</div>'
            + g.items.map(function (mm) {
              return '<label><input type="checkbox" value="' + mm.k + '"' + (sel.indexOf(mm.k) >= 0 ? ' checked' : '') + '> ' + esc(mm.l) + '</label>';
            }).join('');
        }).join('');
      pop.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          if (cb.checked) { if (sel.indexOf(cb.value) < 0) sel.push(cb.value); }
          else sel = sel.filter(function (v) { return v !== cb.value; });
          if (!sel.length) { sel = ['cours']; }
          setSelection(viewId, sel);
          onChange(sel.slice());
        });
      });
      pop.querySelectorAll('[data-p]').forEach(function (b) {
        b.addEventListener('click', function () {
          sel = (PRESETS[b.getAttribute('data-p')] || PRESETS.Complet).slice();
          setSelection(viewId, sel); paint(); onChange(sel.slice());
        });
      });
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; if (!pop.hidden) paint(); });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) pop.hidden = true; });

    return sel.slice();
  }

  window.TC_METRICS = {
    CAT: CAT, PRESETS: PRESETS, metaFor: metaFor,
    getSelection: getSelection, setSelection: setSelection, mount: mount,
    fmt: { nf: nf, pf: pf, money: money, x1: x1, x2: x2, p1: p1, p2: p2 }
  };
})();
