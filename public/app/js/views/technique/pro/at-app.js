/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE TECHNIQUE PRO
   at-app.js : état, chargement des données, interface.

   ── Sources de données ───────────────────────────────────────────
   Aucun endpoint n'est créé ni modifié. Le module lit exactement
   les mêmes sources que le reste de l'application :

     • window.allCours                     cours du jour, déjà chargés
     • window.allCoursHistory              historique court, déjà chargé
     • GET /api/marche?type=historique     via window.apiGet, paginé
     • window.allIndicesHistory            série BRVM Composite

   L'historique est chargé une seule fois par titre puis conservé en
   mémoire pour la durée de la session : changer d'intervalle, de
   période ou d'indicateur ne déclenche jamais de nouvelle requête.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.__ATP_APP__) return;
  global.__ATP_APP__ = true;

  var M = global.ATMath;
  var IND = global.ATIndicators;
  var CH = global.ATChart;
  var AN = global.ATAnalysis;

  var PAGE = 1000;
  var MAX_PAGES = 40;
  var LS = {
    theme: 'tc-atp-theme',
    preset: 'tc-atp-preset',
    inds: 'tc-atp-indicators',
    type: 'tc-atp-type',
    shapes: 'tc-atp-shapes:',
    tab: 'tc-atp-tab',
    watch: 'tc-atp-watchlist'
  };

  /* ── État ─────────────────────────────────────────────────────── */

  var S = {
    ticker: '', name: '',
    raw: [],            /* bougies quotidiennes, ordre chronologique */
    bars: [],           /* bougies agrégées selon l'intervalle */
    type: 'candle',
    interval: 'daily',
    period: 252,
    log: false,
    light: false,
    zoom: { start: 0, end: 1 },
    indicators: [],     /* [{uid, id, params}] */
    shapes: [],
    tool: 'cursor',
    pending: null,      /* dessin en cours de construction */
    activeShapeId: null,
    tab: 'signaux',
    compare: null,
    cache: {},          /* ticker -> bougies quotidiennes */
    loading: false,
    error: '',
    cursorIndex: null,
    autoLevels: true,
    showMarkers: true,
    analysis: null,
    screenRows: null,
    screenState: '',
    backtestId: 'ma-cross',
    watch: []
  };
  global.AT = S;

  var chart = null;
  var el = {};
  var rafId = null;

  /* ── Utilitaires ──────────────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }
  function root() { return $('view-analyse-technique'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function store(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { } }
  function read(k, def) {
    try {
      var v = localStorage.getItem(k);
      if (v == null) return def;
      if (typeof def === 'string') return v;
      return JSON.parse(v);
    } catch (e) { return def; }
  }
  function notify(msg, kind) {
    if (typeof global.toast === 'function') global.toast(msg, kind || 'info');
    else console.log('[AT]', msg);
  }
  function fp(v, d) { return CH.fmtPrice(v, d); }
  function fv(v) { return CH.fmtVolume(v); }
  function pctTxt(v, d) {
    if (!M.fin(v)) return '<span class="atx-nd">—</span>';
    var cls = v > 0 ? 'atx-up' : v < 0 ? 'atx-down' : '';
    return '<span class="' + cls + '">' + (v > 0 ? '+' : '') + v.toFixed(d == null ? 2 : d) + ' %</span>';
  }
  function nd(txt) { return '<span class="atx-nd">' + esc(txt || 'données insuffisantes') + '</span>'; }

  /* ── Normalisation des lignes de marché ───────────────────────── */

  function norm(v) {
    return String(v == null ? '' : v).trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
  }
  function rowTicker(r) {
    return String((r && (r.ticker || r.symbol || r.symbole || r.code || r.code_titre || r.valeur)) || '').trim().toUpperCase();
  }
  function rowName(r) {
    return String((r && (r.nom || r.libelle || r.entreprise || r.nom_societe || r.societe || r.raison_sociale || r.company)) || '').trim();
  }
  function pick(r, keys) {
    for (var i = 0; i < keys.length; i++) {
      var n = M.num(r[keys[i]]);
      if (M.fin(n)) return n;
    }
    return NaN;
  }
  function rowDate(r) {
    var v = r && (r.date_seance || r.date || r.dt || r.seance || r.cours_date || r.jour);
    return v ? String(v).slice(0, 10) : '';
  }
  function toBar(r) {
    var c = pick(r, ['cours_cloture', 'cloture', 'close', 'cours', 'prix', 'last', 'last_price', 'price']);
    if (!M.fin(c) || c <= 0) return null;
    var o = pick(r, ['cours_ouverture', 'ouverture', 'open']);
    var h = pick(r, ['plus_haut', 'haut', 'high']);
    var l = pick(r, ['plus_bas', 'bas', 'low']);
    var v = pick(r, ['volume', 'vol', 'quantite', 'quantity', 'nombre_titres']);
    return {
      date: rowDate(r),
      o: M.fin(o) && o > 0 ? o : c,
      h: M.fin(h) && h > 0 ? Math.max(h, c) : c,
      l: M.fin(l) && l > 0 ? Math.min(l, c) : c,
      c: c,
      v: M.fin(v) && v >= 0 ? v : 0
    };
  }
  function cleanSeries(rows) {
    var byDate = {};
    (rows || []).forEach(function (r) {
      var b = toBar(r);
      if (!b || !b.date) return;
      byDate[b.date] = b;
    });
    return Object.keys(byDate).sort().map(function (k) { return byDate[k]; });
  }

  function marketRows() { return Array.isArray(global.allCours) ? global.allCours : []; }
  function findMarketRow(t) {
    var q = norm(t);
    var rows = marketRows();
    var exact = null, partial = null;
    rows.forEach(function (r) {
      var k = norm(rowTicker(r));
      if (!k) return;
      if (k === q) exact = exact || r;
      else if (!partial && (k.indexOf(q) === 0 || q.indexOf(k) === 0)) partial = r;
    });
    return exact || partial || null;
  }

  /* ── Chargement de l'historique ───────────────────────────────── */

  /* Trois sources, essayées dans l'ordre du moins coûteux au plus
     coûteux. La requête réseau n'intervient qu'en dernier, et son
     résultat est mémorisé pour la session. */
  async function loadHistory(ticker) {
    var key = norm(ticker);
    if (S.cache[key] && S.cache[key].length) return S.cache[key];

    var local = [];
    ['allCoursHistorique', 'allCoursHistory'].forEach(function (name) {
      var arr = global[name];
      if (!Array.isArray(arr) || !arr.length) return;
      arr.forEach(function (r) { if (norm(rowTicker(r)) === key) local.push(r); });
    });

    var remote = [];
    if (typeof global.apiGet === 'function') {
      try {
        for (var page = 0; page < MAX_PAGES; page++) {
          var url = '/marche?type=historique&ticker=' + encodeURIComponent(ticker) +
            '&limit=' + PAGE + '&offset=' + (page * PAGE);
          var res = await global.apiGet(url);
          var data = res && typeof res === 'object' && 'data' in res ? res.data : res;
          if (!Array.isArray(data) || !data.length) break;
          remote = remote.concat(data);
          if (data.length < PAGE) break;
        }
      } catch (e) {
        console.warn('[AT] historique indisponible pour', ticker, e && e.message);
      }
    }

    var series = cleanSeries(remote.concat(local));

    /* Dernier filet : le cours du jour est déjà en mémoire. S'il est
       plus récent que la dernière ligne d'historique, il complète la
       série plutôt que de la remplacer. */
    var live = findMarketRow(ticker);
    if (live) {
      var lb = toBar(live);
      if (lb && lb.c > 0) {
        if (!lb.date) lb.date = new Date().toISOString().slice(0, 10);
        if (!series.length || series[series.length - 1].date < lb.date) series.push(lb);
      }
    }

    if (series.length) S.cache[key] = series;
    return series;
  }

  /* ── Agrégation ───────────────────────────────────────────────── */

  function aggregate(bars, interval) {
    if (interval === 'daily' || !interval) return bars.slice();
    var buckets = {}, order = [];
    bars.forEach(function (b) {
      if (!b.date) return;
      var parts = b.date.split('-');
      var key;
      if (interval === 'weekly') {
        var dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        var dow = dt.getDay();
        dt.setDate(dt.getDate() - (dow === 0 ? 6 : dow - 1));
        key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      } else if (interval === 'monthly') {
        key = parts[0] + '-' + parts[1] + '-01';
      } else if (interval === 'quarterly') {
        key = parts[0] + '-' + String(Math.floor((+parts[1] - 1) / 3) * 3 + 1).padStart(2, '0') + '-01';
      } else key = b.date;

      if (!buckets[key]) {
        buckets[key] = { date: key, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, count: 1, last: b.date, first: b.date };
        order.push(key);
      } else {
        var k = buckets[key];
        k.h = Math.max(k.h, b.h);
        k.l = Math.min(k.l, b.l);
        k.c = b.c;
        k.v += b.v;
        k.count++;
        k.last = b.date;
      }
    });
    return order.sort().map(function (k) { return buckets[k]; });
  }

  function columns(bars) {
    return {
      dates: bars.map(function (b) { return b.date; }),
      o: bars.map(function (b) { return b.o; }),
      h: bars.map(function (b) { return b.h; }),
      l: bars.map(function (b) { return b.l; }),
      c: bars.map(function (b) { return b.c; }),
      v: bars.map(function (b) { return b.v; })
    };
  }

  /* Fenêtre affichée : période choisie, puis zoom à l'intérieur. */
  function windowRange() {
    var n = S.bars.length;
    if (!n) return { from: 0, to: 0 };
    var periodStart = S.period >= 99999 ? 0 : Math.max(0, n - S.period);
    var visN = n - periodStart;
    var from = periodStart + Math.floor(S.zoom.start * visN);
    var to = periodStart + Math.ceil(S.zoom.end * visN);
    from = M.clamp(from, 0, n - 1);
    to = M.clamp(to, from + 2, n);
    return { from: from, to: to };
  }

  /* ── Indicateurs actifs ───────────────────────────────────────── */

  var uidSeq = 1;
  function addIndicator(id, params) {
    var def = IND.byId(id);
    if (!def) return null;
    if (!def.multi && S.indicators.some(function (x) { return x.id === id; })) {
      notify(def.name + ' est déjà affiché.', 'warn');
      return null;
    }
    var item = { uid: 'i' + (uidSeq++), id: id, params: Object.assign(IND.defaults(id), params || {}) };
    S.indicators.push(item);
    persistIndicators();
    return item;
  }
  function removeIndicator(uid) {
    S.indicators = S.indicators.filter(function (x) { return x.uid !== uid; });
    persistIndicators();
  }
  function persistIndicators() {
    store(LS.inds, S.indicators.map(function (x) { return { id: x.id, params: x.params }; }));
  }
  function applyPreset(key) {
    var p = IND.presets[key];
    if (!p) return;
    S.indicators = [];
    p.indicators.forEach(function (x) { addIndicator(x.id, x.params); });
    store(LS.preset, key);
    persistIndicators();
    renderAll();
  }
  global.atApplyPreset = applyPreset;

  function computeIndicators(cols) {
    var overlays = [], panes = [];
    S.indicators.forEach(function (item) {
      var def = IND.byId(item.id);
      if (!def) return;
      var out;
      try { out = def.compute(cols, item.params); }
      catch (e) { console.warn('[AT] indicateur', item.id, e); return; }
      if (!out) return;
      out.uid = item.uid;
      out.title = def.title ? def.title(item.params) : def.name;
      out.def = def;
      out.item = item;
      if (def.overlay) overlays.push(out); else panes.push(out);
    });
    return { overlays: overlays, panes: panes };
  }

  /* ── Dessins ──────────────────────────────────────────────────── */

  var TOOLS = [
    { id: 'cursor', icon: '↖', label: 'Curseur', hint: '', points: 0 },
    { id: 'hline', icon: '─', label: 'Horizontale', hint: 'Cliquez au niveau souhaité.', points: 1 },
    { id: 'vline', icon: '│', label: 'Verticale', hint: 'Cliquez sur la séance souhaitée.', points: 1 },
    { id: 'trend', icon: '╱', label: 'Tendance', hint: 'Cliquez deux points.', points: 2, extend: true },
    { id: 'arrow', icon: '➔', label: 'Flèche', hint: 'Cliquez le départ puis la pointe.', points: 2 },
    { id: 'channel', icon: '⫽', label: 'Canal', hint: 'Deux points pour la base, un troisième pour la largeur.', points: 3 },
    { id: 'rect', icon: '▭', label: 'Zone', hint: 'Cliquez deux coins opposés.', points: 2 },
    { id: 'fib', icon: '⚏', label: 'Fibonacci', hint: 'Cliquez le point bas puis le point haut.', points: 2, extend: true },
    { id: 'pitch', icon: '⑂', label: 'Pitchfork', hint: 'Trois points : pivot, puis les deux branches.', points: 3 },
    { id: 'measure', icon: '⇔', label: 'Mesure', hint: 'Cliquez le début puis la fin du mouvement.', points: 2 },
    { id: 'text', icon: 'T', label: 'Annotation', hint: 'Cliquez où placer le texte.', points: 1 }
  ];
  function toolDef(id) { for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) return TOOLS[i]; return TOOLS[0]; }

  function shapeKey() { return LS.shapes + norm(S.ticker); }
  function saveShapes() { if (S.ticker) store(shapeKey(), S.shapes.slice(0, 300)); }
  function loadShapes() { S.shapes = S.ticker ? (read(shapeKey(), []) || []) : []; }

  function setTool(id) {
    S.tool = id;
    S.pending = null;
    var r = root();
    if (r) r.querySelectorAll('[data-tool]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tool') === id);
    });
    var hint = $('atxToolHint');
    if (hint) {
      var t = toolDef(id);
      hint.textContent = id === 'cursor' ? '' : t.label + ' — ' + t.hint;
      hint.classList.toggle('show', id !== 'cursor');
    }
    if (chart) chart.over.style.cursor = id === 'cursor' ? 'crosshair' : 'copy';
    draw();
  }

  function clearShapes() {
    if (!S.shapes.length) { notify('Aucun tracé à effacer.', 'info'); return; }
    S.shapes = [];
    S.activeShapeId = null;
    saveShapes();
    draw();
    notify('Tracés effacés.', 'success');
  }
  function undoShape() {
    if (!S.shapes.length) return;
    S.shapes.pop();
    saveShapes();
    draw();
  }

  /* ── Rendu du graphique ───────────────────────────────────────── */

  function buildView() {
    var range = windowRange();
    var visible = S.bars.slice(range.from, range.to);
    if (!visible.length) return { bars: [], light: S.light };

    /* Les indicateurs sont calculés sur toute la série puis découpés
       à la fenêtre : une moyenne à 200 séances reste donc correcte même
       lorsqu'on n'affiche qu'un mois. */
    var full = columns(S.bars);
    var computed = computeIndicators(full);

    function slice(arr) { return arr.slice(range.from, range.to); }

    var overlays = computed.overlays.map(function (ov) {
      return {
        uid: ov.uid, title: ov.title,
        lines: (ov.lines || []).map(function (ln) {
          return Object.assign({}, ln, { values: slice(ln.values) });
        }),
        bands: (ov.bands || []).map(function (b) {
          return Object.assign({}, b, { upper: slice(b.upper), lower: slice(b.lower) });
        }),
        dots: (ov.dots || []).map(function (d) {
          return Object.assign({}, d, { values: slice(d.values) });
        }),
        levels: ov.levels,
        cloud: ov.cloud ? {
          spanA: slice(ov.cloud.spanA), spanB: slice(ov.cloud.spanB),
          shift: ov.cloud.shift, bull: ov.cloud.bull, bear: ov.cloud.bear, alpha: ov.cloud.alpha
        } : null
      };
    });

    var panes = computed.panes.map(function (p) {
      return {
        uid: p.uid, title: p.title, height: p.def.height || 84,
        format: p.format, scale: p.scale, zones: p.zones, levels: p.levels,
        zeroBase: p.zeroBase,
        lines: (p.lines || []).map(function (ln) { return Object.assign({}, ln, { values: slice(ln.values) }); }),
        histogram: p.histogram ? Object.assign({}, p.histogram, {
          values: slice(p.histogram.values),
          colorAt: p.histogram.colorAt ? function (i) { return p.histogram.colorAt(i + range.from); } : null
        }) : null
      };
    });

    var live = findMarketRow(S.ticker);
    var livePrice = live ? pick(live, ['cours', 'cours_cloture', 'cloture', 'close', 'prix', 'last']) : NaN;
    var liveVar = live ? pick(live, ['variation', 'var', 'variation_pct', 'evolution']) : NaN;

    var autoLevels = null;
    if (S.autoLevels && S.bars.length >= 60) {
      try {
        autoLevels = M.supportResistance(full.h, full.l, full.c, { max: 6, minTouches: 2, tolerance: 0.018 });
      } catch (e) { autoLevels = null; }
    }

    var markers = null;
    if (S.showMarkers && S.bars.length >= 40) {
      try {
        markers = M.detectCandles(full.o, full.h, full.l, full.c, Math.min(140, S.bars.length))
          .filter(function (cd) { return Math.abs(cd.bias) >= 2 && cd.index >= range.from && cd.index < range.to; })
          .slice(0, 30)
          .map(function (cd) {
            return { index: cd.index, price: cd.bias > 0 ? full.l[cd.index] : full.h[cd.index], bias: cd.bias, name: cd.name };
          });
      } catch (e) { markers = null; }
    }

    var compareVals = null;
    if (S.compare && S.compare.bars && S.compare.bars.length) {
      var byDate = {};
      S.compare.bars.forEach(function (b) { byDate[b.date] = b.c; });
      compareVals = visible.map(function (b) { return byDate[b.date] != null ? byDate[b.date] : null; });
    }

    return {
      bars: visible,
      offset: range.from,
      type: S.type,
      interval: S.interval,
      log: S.log,
      light: S.light,
      overlays: overlays,
      panes: panes,
      shapes: S.shapes,
      activeShapeId: S.activeShapeId,
      preview: S.pending ? Object.assign({}, S.pending, { points: S.pending.points.concat(S.pending.cursor ? [S.pending.cursor] : []) }) : null,
      autoLevels: autoLevels,
      markers: markers,
      compare: compareVals ? { values: compareVals, color: '#5b9dfb' } : null,
      livePrice: M.fin(livePrice) && livePrice > 0 ? livePrice : null,
      liveUp: M.fin(liveVar) ? liveVar >= 0 : null,
      crosshair: true,
      rightPad: Math.max(2, Math.round(visible.length * 0.03)),
      cursorIndex: S.cursorIndex != null ? S.cursorIndex : null,
      onCursor: onCursor,
      emptyMessage: S.loading ? 'Chargement de l\'historique…' : (S.error || 'Sélectionnez un titre pour lancer l\'analyse')
    };
  }

  function draw() {
    if (!chart) return;
    if (rafId && global.cancelAnimationFrame) global.cancelAnimationFrame(rafId);
    var raf = global.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    rafId = raf(function () {
      rafId = null;
      try { chart.render(buildView()); }
      catch (e) { console.error('[AT] rendu', e); }
    });
  }

  function onCursor(i, bar) {
    var range = windowRange();
    S.cursorIndex = i;
    updateQuote(bar, range.from + i);
  }

  /* ── Bandeau de cotation ──────────────────────────────────────── */

  function updateQuote(bar, absIndex) {
    var host = $('atxQuote');
    if (!host) return;
    if (!S.bars.length) { host.innerHTML = ''; return; }
    var idx = absIndex != null ? absIndex : S.bars.length - 1;
    var b = bar || S.bars[idx] || S.bars[S.bars.length - 1];
    if (!b) return;
    var prev = S.bars[idx - 1];
    var chg = prev && prev.c ? (b.c - prev.c) / prev.c * 100 : null;
    var live = findMarketRow(S.ticker);
    var livePx = live ? pick(live, ['cours', 'cours_cloture', 'cloture', 'close', 'prix']) : NaN;

    function cell(label, value, cls) {
      return '<div class="atx-q"><span class="atx-q-l">' + label + '</span><span class="atx-q-v ' + (cls || '') + '">' + value + '</span></div>';
    }
    var upCls = b.c >= b.o ? 'atx-up' : 'atx-down';
    host.innerHTML =
      '<div class="atx-q-head"><strong>' + esc(S.ticker || '—') + '</strong>' +
      (S.name ? '<span class="atx-q-name">' + esc(S.name) + '</span>' : '') + '</div>' +
      cell('Ouv.', fp(b.o)) +
      cell('Haut', fp(b.h), 'atx-up') +
      cell('Bas', fp(b.l), 'atx-down') +
      cell('Clôt.', fp(b.c), upCls) +
      cell('Var.', chg == null ? '—' : (chg > 0 ? '+' : '') + chg.toFixed(2) + ' %', chg == null ? '' : chg >= 0 ? 'atx-up' : 'atx-down') +
      cell('Volume', fv(b.v)) +
      cell('Séance', CH.fmtDateLong(b.date)) +
      (b.count > 1 ? cell('Agrégat', b.count + ' séances') : '') +
      (M.fin(livePx) && livePx > 0 ? cell('Dernier cours', fp(livePx) + ' FCFA', 'atx-gold') : '');
  }

  /* ── Sélecteur de titres ──────────────────────────────────────── */

  function tickerOptions() {
    var seen = {}, out = [];
    marketRows().forEach(function (r) {
      var t = rowTicker(r);
      if (!t) return;
      var k = norm(t);
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ ticker: t, name: rowName(r), price: pick(r, ['cours', 'cours_cloture', 'cloture', 'close']), variation: pick(r, ['variation', 'var', 'variation_pct']) });
    });
    return out.sort(function (a, b) { return a.ticker.localeCompare(b.ticker); });
  }

  function fillTickerSelect() {
    var sel = $('atTicker');
    if (!sel) return 0;
    var list = tickerOptions();
    var keep = sel.value || S.ticker;
    sel.innerHTML = '<option value="">Choisir un titre…</option>' +
      list.map(function (o) {
        return '<option value="' + esc(o.ticker) + '">' + esc(o.ticker) + (o.name ? ' — ' + esc(o.name) : '') + '</option>';
      }).join('');
    if (keep) {
      var match = list.filter(function (o) { return norm(o.ticker) === norm(keep); })[0];
      if (match) sel.value = match.ticker;
    }
    sel.disabled = !list.length;
    var count = $('atxTickerCount');
    if (count) count.textContent = list.length ? list.length + ' valeurs cotées' : 'En attente des cours du marché';
    return list.length;
  }

  /* ── Chargement d'un titre ────────────────────────────────────── */

  async function loadTicker(requested) {
    var sel = $('atTicker');
    var t = requested || (sel && sel.value) || S.ticker;
    if (!t) { notify('Choisissez un titre pour lancer l\'analyse.', 'warn'); return false; }

    var row = findMarketRow(t);
    var canonical = (row && rowTicker(row)) || String(t).trim().toUpperCase();

    S.loading = true;
    S.error = '';
    S.ticker = canonical;
    S.name = row ? rowName(row) : '';
    S.zoom = { start: 0, end: 1 };
    S.cursorIndex = null;
    S.compare = null;
    S.screenRows = S.screenRows;
    if (sel && sel.value !== canonical) {
      var has = Array.prototype.some.call(sel.options, function (o) { return o.value === canonical; });
      if (!has) {
        var opt = document.createElement('option');
        opt.value = canonical;
        opt.textContent = canonical;
        sel.appendChild(opt);
      }
      sel.value = canonical;
    }
    setStatus('Chargement de l\'historique de ' + canonical + '…');
    draw();

    var series = [];
    try { series = await loadHistory(canonical); }
    catch (e) { console.error('[AT]', e); }

    S.loading = false;

    if (!series.length) {
      S.raw = []; S.bars = [];
      S.error = 'Aucune donnée de cotation disponible pour ' + canonical + '.';
      setStatus(S.error, 'warn');
      S.analysis = null;
      draw();
      renderSide();
      return false;
    }

    S.raw = series;
    S.bars = aggregate(series, S.interval);
    loadShapes();
    recomputeAnalysis();
    setStatus(series.length + ' séance' + (series.length > 1 ? 's' : '') +
      ' · du ' + CH.fmtDateLong(series[0].date) + ' au ' + CH.fmtDateLong(series[series.length - 1].date));
    updateQuote();
    draw();
    renderSide();
    renderWatchlist();
    return true;
  }
  global.atLoadTicker = function (t) { return loadTicker(typeof t === 'string' ? t : null); };

  function setStatus(msg, kind) {
    var s = $('atxStatus');
    if (!s) return;
    s.textContent = msg || '';
    s.className = 'atx-status' + (kind ? ' atx-status-' + kind : '');
  }

  /* ── Analyse ──────────────────────────────────────────────────── */

  function benchmarkSeries() {
    var src = Array.isArray(global.allIndicesHistory) && global.allIndicesHistory.length
      ? global.allIndicesHistory
      : (Array.isArray(global.allIndices) ? global.allIndices : []);
    if (!src.length) return null;
    var dates = [], values = [];
    src.slice().sort(function (a, b) {
      return String(rowDate(a)).localeCompare(String(rowDate(b)));
    }).forEach(function (r) {
      var d = rowDate(r);
      var v = pick(r, ['brvm_composite', 'composite', 'brvm_c', 'valeur', 'indice']);
      if (d && M.fin(v) && v > 0) { dates.push(d); values.push(v); }
    });
    return dates.length > 25 ? { name: 'BRVM Composite', dates: dates, values: values } : null;
  }

  function recomputeAnalysis() {
    if (!S.bars.length) { S.analysis = null; return; }
    /* L'analyse porte toujours sur les séances quotidiennes, jamais sur
       l'agrégat hebdomadaire ou mensuel : les seuils usuels des
       indicateurs sont calibrés sur des séances. */
    var cols = columns(S.raw);
    var res = { cols: cols };
    try { res.signals = AN.signals(cols); } catch (e) { console.warn('[AT] signaux', e); }
    try { res.plan = AN.tradePlan(cols, res.signals); } catch (e) { console.warn('[AT] plan', e); }
    try { res.stats = AN.statistics(cols, benchmarkSeries()); } catch (e) { console.warn('[AT] stats', e); }
    try { res.structure = AN.structure(cols); } catch (e) { console.warn('[AT] structure', e); }
    S.analysis = res;
  }

  /* ── Panneau latéral ──────────────────────────────────────────── */

  var TABS = [
    { id: 'signaux', label: 'Signaux' },
    { id: 'plan', label: 'Plan' },
    { id: 'stats', label: 'Statistiques' },
    { id: 'structure', label: 'Structure' },
    { id: 'indicateurs', label: 'Indicateurs' },
    { id: 'backtest', label: 'Backtest' },
    { id: 'balayage', label: 'Balayage' },
    { id: 'suivi', label: 'Suivi' }
  ];

  function renderSide() {
    var host = $('atxPanel');
    if (!host) return;
    var tabsEl = $('atxTabs');
    if (tabsEl) {
      tabsEl.innerHTML = TABS.map(function (t) {
        return '<button type="button" class="atx-tab' + (t.id === S.tab ? ' on' : '') + '" data-tab="' + t.id + '">' + t.label + '</button>';
      }).join('');
    }
    var fn = {
      signaux: paneSignals, plan: panePlan, stats: paneStats, structure: paneStructure,
      indicateurs: paneIndicators, backtest: paneBacktest, balayage: paneScreen, suivi: paneWatch
    }[S.tab] || paneSignals;
    host.innerHTML = fn();
  }

  function needTicker() {
    return '<div class="atx-empty"><div class="atx-empty-t">Aucun titre sélectionné</div>' +
      '<p>Choisissez une valeur dans le sélecteur en haut à gauche pour afficher son analyse.</p></div>';
  }

  function paneSignals() {
    if (!S.analysis) return needTicker();
    var sig = S.analysis.signals;
    if (!sig || !sig.enough) {
      return '<div class="atx-empty"><div class="atx-empty-t">Historique trop court</div><p>' +
        (sig ? 'Le faisceau de signaux demande au moins ' + sig.need + ' séances ; ' + sig.have + ' sont disponibles.' : 'Analyse indisponible.') +
        '</p></div>';
    }
    var s = sig.score;
    var deg = M.clamp((s + 100) / 200, 0, 1);
    var html = '<div class="atx-verdict atx-tone-' + sig.verdict.tone + '">' +
      '<div class="atx-verdict-score">' + (s > 0 ? '+' : '') + s.toFixed(0) + '</div>' +
      '<div class="atx-verdict-body">' +
      '<div class="atx-verdict-label">' + esc(sig.verdict.label) + '</div>' +
      '<div class="atx-verdict-sub">' + sig.counts.positive + ' signaux favorables · ' + sig.counts.negative +
      ' défavorables · ' + sig.counts.neutral + ' neutres — cohérence ' + sig.confidence + '</div>' +
      '</div></div>' +
      '<div class="atx-gauge"><div class="atx-gauge-fill" style="left:50%;width:' + Math.abs(s / 2) + '%;' +
      (s < 0 ? 'transform:translateX(-100%);' : '') + 'background:' + (s >= 0 ? 'var(--atx-up)' : 'var(--atx-down)') + '"></div>' +
      '<div class="atx-gauge-mid"></div></div>' +
      '<p class="atx-note">Le score agrège ' + sig.counts.total + ' tests pondérés sur une échelle de −100 à +100. ' +
      'Une cohérence faible signifie que les signaux se contredisent : le score global perd alors de sa valeur, quel que soit son niveau.</p>';

    Object.keys(sig.groups).forEach(function (g) {
      html += '<div class="atx-group">' + esc(g) + '</div>';
      sig.groups[g].forEach(function (it) {
        var cls = it.score == null ? 'neutral' : it.score > 0.2 ? 'bull' : it.score < -0.2 ? 'bear' : 'neutral';
        var w = it.score == null ? 0 : Math.abs(it.score) / 2 * 100;
        html += '<div class="atx-sig atx-' + cls + '">' +
          '<div class="atx-sig-top"><span class="atx-sig-name">' + esc(it.label) + '</span>' +
          '<span class="atx-sig-val">' + (it.score == null ? '—' : (it.score > 0 ? '+' : '') + it.score.toFixed(1)) + '</span></div>' +
          '<div class="atx-sig-bar"><div style="width:' + w + '%"></div></div>' +
          '<div class="atx-sig-why">' + esc(it.reason) + '</div>' +
          (it.detail ? '<div class="atx-sig-detail">' + esc(it.detail) + '</div>' : '') +
          '</div>';
      });
    });
    html += '<p class="atx-disclaimer">Cette lecture est technique. Elle ne tient compte ni des résultats de la société, ni de son actualité, ni de la liquidité réelle du carnet d\'ordres, et ne constitue pas un conseil en investissement.</p>';
    return html;
  }

  function panePlan() {
    if (!S.analysis) return needTicker();
    var p = S.analysis.plan;
    if (!p || !p.enough) {
      return '<div class="atx-empty"><div class="atx-empty-t">Plan indisponible</div>' +
        '<p>Le calcul des niveaux demande au moins quarante séances de cotation et une amplitude moyenne exploitable.</p></div>';
    }
    var long = p.direction === 'long';
    var html = '<div class="atx-plan-head atx-' + (long ? 'bull' : 'bear') + '">' +
      '<span>Scénario ' + (long ? 'haussier' : 'baissier') + '</span>' +
      '<span class="atx-plan-rr">Gain/risque ' + (M.fin(p.rr1) ? p.rr1.toFixed(2) : '—') + ' puis ' + (M.fin(p.rr2) ? p.rr2.toFixed(2) : '—') + '</span></div>';

    function row(label, value, sub, cls) {
      return '<div class="atx-plan-row"><div class="atx-plan-l">' + label + '</div>' +
        '<div class="atx-plan-v ' + (cls || '') + '">' + value + '</div>' +
        (sub ? '<div class="atx-plan-s">' + sub + '</div>' : '') + '</div>';
    }
    html += row('Cours de référence', fp(p.entry) + ' FCFA', 'dernière clôture connue');
    html += row('Invalidation', fp(p.stop) + ' FCFA',
      esc(p.stopBasis) + ' — soit ' + p.riskPct.toFixed(2) + ' % du cours', long ? 'atx-down' : 'atx-up');
    html += row('Premier objectif', fp(p.target1) + ' FCFA', esc(p.targetBasis), long ? 'atx-up' : 'atx-down');
    html += row('Second objectif', fp(p.target2) + ' FCFA', 'projection au-delà du premier niveau', long ? 'atx-up' : 'atx-down');
    html += row('Amplitude moyenne', fp(p.atr) + ' FCFA', p.atrPct.toFixed(2) + ' % du cours sur 14 séances');

    if (M.fin(p.rr1) && p.rr1 < 1) {
      html += '<div class="atx-warn">Le premier objectif rapporte moins que le risque encouru. Sur ce niveau d\'entrée, ' +
        'la configuration ne présente pas un rapport gain/risque favorable : attendre un repli vers l\'invalidation ' +
        'ou viser directement le second objectif change entièrement l\'équation.</div>';
    }

    html += '<div class="atx-group">Dimensionnement</div>' +
      '<div class="atx-sizer">' +
      '<label>Capital <input type="number" id="atxCapital" value="5000000" min="0" step="100000"></label>' +
      '<label>Risque <input type="number" id="atxRisk" value="2" min="0.1" max="20" step="0.1"><span>%</span></label>' +
      '</div><div id="atxSizeOut" class="atx-size-out"></div>' +
      '<p class="atx-note">Le nombre de titres est calculé pour que la perte, en cas de retour au niveau d\'invalidation, ' +
      'reste égale au pourcentage de capital indiqué. Il ne tient compte ni des frais de courtage ni de la profondeur du carnet d\'ordres.</p>';

    var levelsHtml = '';
    if (p.supports.length) {
      levelsHtml += '<div class="atx-group">Supports repérés</div>' + p.supports.map(function (x) {
        return '<div class="atx-level atx-up"><span>' + fp(x.value) + '</span><span class="atx-level-m">' +
          x.touches + ' contacts · ' + (x.distance != null ? x.distance.toFixed(1) + ' %' : '—') + '</span></div>';
      }).join('');
    }
    if (p.resistances.length) {
      levelsHtml += '<div class="atx-group">Résistances repérées</div>' + p.resistances.map(function (x) {
        return '<div class="atx-level atx-down"><span>' + fp(x.value) + '</span><span class="atx-level-m">' +
          x.touches + ' contacts · +' + (x.distance != null ? x.distance.toFixed(1) + ' %' : '—') + '</span></div>';
      }).join('');
    }
    return html + levelsHtml;
  }

  function paneStats() {
    if (!S.analysis) return needTicker();
    var st = S.analysis.stats;
    if (!st || !st.enough) {
      return '<div class="atx-empty"><div class="atx-empty-t">Statistiques indisponibles</div><p>' +
        (st ? 'Il faut au moins ' + st.need + ' séances ; ' + st.have + ' sont disponibles.' : '') + '</p></div>';
    }
    function cell(label, value, sub, tone) {
      return '<div class="atx-stat"><div class="atx-stat-l">' + label + '</div>' +
        '<div class="atx-stat-v ' + (tone || '') + '">' + value + '</div>' +
        (sub ? '<div class="atx-stat-s">' + sub + '</div>' : '') + '</div>';
    }
    function P(v, d) { return M.fin(v) ? (v > 0 ? '+' : '') + (v * 100).toFixed(d == null ? 1 : d) + ' %' : '—'; }
    function N(v, d) { return M.fin(v) ? v.toFixed(d == null ? 2 : d) : '—'; }
    function tone(v, inverse) { return !M.fin(v) ? '' : (inverse ? v < 0 : v > 0) ? 'atx-up' : v === 0 ? '' : 'atx-down'; }

    var html = '<div class="atx-group">Performance · ' + st.sessions + ' séances, du ' +
      CH.fmtDate(st.period.from) + ' au ' + CH.fmtDate(st.period.to) + '</div><div class="atx-stats">' +
      cell('Performance totale', P(st.totalReturn), 'sur toute la période chargée', tone(st.totalReturn)) +
      cell('Rendement annualisé', M.fin(st.cagr) ? P(st.cagr) : nd('période trop courte'), 'taux composé équivalent', tone(st.cagr)) +
      cell('Séances positives', M.fin(st.positiveDays) ? (st.positiveDays * 100).toFixed(1) + ' %' : '—', 'part des séances en hausse') +
      cell('Meilleure séance', P(st.bestDay), '', 'atx-up') +
      cell('Pire séance', P(st.worstDay), '', 'atx-down') +
      '</div>';

    html += '<div class="atx-group">Risque</div><div class="atx-stats">' +
      cell('Volatilité annualisée', M.fin(st.volAnn) ? (st.volAnn * 100).toFixed(1) + ' %' : '—', 'écart-type des clôtures') +
      cell('Volatilité Parkinson', M.fin(st.volParkinson) ? (st.volParkinson * 100).toFixed(1) + ' %' : nd(), 'estimée par l\'amplitude haut/bas') +
      cell('Volatilité Garman-Klass', M.fin(st.volGarmanKlass) ? (st.volGarmanKlass * 100).toFixed(1) + ' %' : nd(), 'intègre ouverture et clôture') +
      cell('Perte maximale', P(st.maxDrawdown), M.fin(st.maxDrawdown) ? 'du ' + CH.fmtDate(st.drawdownFrom) + ' au ' + CH.fmtDate(st.drawdownTo) + ' (' + st.drawdownDuration + ' séances)' : '', 'atx-down') +
      cell('VaR 95 % à 1 séance', P(st.var95), 'perte dépassée une séance sur vingt', 'atx-down') +
      cell('VaR 99 % à 1 séance', P(st.var99), 'perte dépassée une séance sur cent', 'atx-down') +
      cell('Perte moyenne au-delà', P(st.cvar95), 'moyenne des pertes qui dépassent la VaR 95 %', 'atx-down') +
      '</div>';

    html += '<div class="atx-group">Rapports rendement/risque</div><div class="atx-stats">' +
      cell('Sharpe', N(st.sharpe), 'taux sans risque retenu ' + (st.riskFree * 100).toFixed(1) + ' %', tone(st.sharpe)) +
      cell('Sortino', N(st.sortino), 'ne pénalise que la volatilité baissière', tone(st.sortino)) +
      cell('Calmar', N(st.calmar), 'rendement annualisé rapporté à la perte maximale', tone(st.calmar)) +
      '</div>';

    html += '<div class="atx-group">Forme de la distribution</div><div class="atx-stats">' +
      cell('Asymétrie', N(st.skewness), M.fin(st.skewness) ? (st.skewness < -0.3 ? 'queue de pertes plus lourde' : st.skewness > 0.3 ? 'queue de gains plus lourde' : 'distribution presque symétrique') : '') +
      cell('Aplatissement', N(st.kurtosis), M.fin(st.kurtosis) ? (st.kurtosis > 1 ? 'valeurs extrêmes plus fréquentes que la loi normale' : 'extrêmes proches de la loi normale') : '') +
      cell('Exposant de Hurst', N(st.hurst), M.fin(st.hurst) ? (st.hurst > 0.55 ? 'série persistante : les tendances se prolongent' : st.hurst < 0.45 ? 'série antipersistante : retour à la moyenne fréquent' : 'proche d\'une marche aléatoire') : nd('série trop courte')) +
      '</div>';

    html += '<div class="atx-group">Liquidité</div><div class="atx-stats">' +
      cell('Volume moyen', M.fin(st.avgVolume) ? fv(st.avgVolume) : '—', 'titres par séance cotée') +
      cell('Volume médian', M.fin(st.medianVolume) ? fv(st.medianVolume) : '—', 'moins sensible aux séances exceptionnelles') +
      cell('Séances traitées', M.fin(st.liquidity) ? (st.liquidity * 100).toFixed(0) + ' %' : '—', 'part des séances avec un volume non nul') +
      '</div>';

    if (st.benchmark) {
      var b = st.benchmark;
      html += '<div class="atx-group">Comportement relatif au ' + esc(b.name) + '</div><div class="atx-stats">' +
        cell('Beta', N(b.beta), M.fin(b.beta) ? (b.beta > 1.05 ? 'amplifie les mouvements du marché' : b.beta < 0.95 ? 'amortit les mouvements du marché' : 'suit le marché') : '') +
        cell('Corrélation', N(b.correlation), M.fin(b.correlation) ? (Math.abs(b.correlation) > 0.7 ? 'lien fort' : Math.abs(b.correlation) > 0.4 ? 'lien modéré' : 'lien faible') : '') +
        cell('R²', M.fin(b.r2) ? (b.r2 * 100).toFixed(1) + ' %' : '—', 'part de variation expliquée par l\'indice') +
        cell('Alpha de Jensen', P(b.alpha), 'sur-performance à risque de marché égal', tone(b.alpha)) +
        cell('Rendement de l\'indice', P(b.benchReturnAnn), 'annualisé sur la période commune') +
        '</div><p class="atx-note">Calculé sur ' + b.observations + ' séances communes, appariées date à date.</p>';
    }

    if (st.warnings && st.warnings.length) {
      html += '<div class="atx-warn">' + st.warnings.map(esc).join('<br>') + '</div>';
    }
    return html;
  }

  function paneStructure() {
    if (!S.analysis) return needTicker();
    var st = S.analysis.structure;
    if (!st) return needTicker();
    var cols = S.analysis.cols;
    var n = cols.c.length;
    var price = cols.c[n - 1];
    var html = '';

    html += '<div class="atx-group">Supports et résistances</div>';
    if (!st.levels.length) html += nd('Aucun niveau n\'a été touché au moins deux fois sur la période.');
    else {
      html += '<p class="atx-note">Niveaux issus des pivots de la série, regroupés lorsqu\'ils sont distants de moins de 1,8 %. ' +
        'Le nombre de contacts et la fraîcheur du dernier contact déterminent leur importance.</p>';
      st.levels.slice().reverse().forEach(function (lv) {
        var isRes = lv.value > price;
        html += '<div class="atx-level ' + (isRes ? 'atx-down' : 'atx-up') + '">' +
          '<span>' + fp(lv.value) + ' FCFA</span>' +
          '<span class="atx-level-m">' + (isRes ? 'résistance' : 'support') + ' · ' + lv.touches + ' contacts · ' +
          (lv.distance != null ? (lv.distance > 0 ? '+' : '') + lv.distance.toFixed(1) + ' %' : '—') + '</span></div>';
      });
    }

    html += '<div class="atx-group">Figures chartistes</div>';
    if (!st.patterns.length) html += nd('Aucune figure identifiable sur la fenêtre analysée.');
    else st.patterns.forEach(function (p) {
      var cls = p.bias > 0 ? 'bull' : p.bias < 0 ? 'bear' : 'neutral';
      html += '<div class="atx-card atx-' + cls + '">' +
        '<div class="atx-card-t">' + esc(p.name) + '<span class="atx-card-d">' +
        CH.fmtDate(cols.dates[p.from]) + ' → ' + CH.fmtDate(cols.dates[p.to]) + '</span></div>' +
        '<p>' + esc(p.note) + '</p>' +
        (M.fin(p.target) ? '<div class="atx-card-m">Objectif géométrique : ' + fp(p.target) + ' FCFA' +
          (M.fin(price) && price ? ' (' + ((p.target - price) / price * 100).toFixed(1) + ' %)' : '') + '</div>' : '') +
        '</div>';
    });

    html += '<div class="atx-group">Divergences</div>';
    if (!st.divergences.length) html += nd('Aucune divergence récente entre le cours et les oscillateurs.');
    else st.divergences.forEach(function (dv) {
      var age = n - 1 - dv.to;
      html += '<div class="atx-card atx-' + (dv.bias > 0 ? 'bull' : 'bear') + '">' +
        '<div class="atx-card-t">' + esc(dv.label) + ' · ' + esc(dv.kind.replace('-', ' ')) +
        '<span class="atx-card-d">il y a ' + age + ' séance' + (age > 1 ? 's' : '') + '</span></div>' +
        '<p>' + esc(dv.note) + '</p></div>';
    });

    html += '<div class="atx-group">Chandeliers récents</div>';
    if (!st.candles.length) html += nd('Aucune configuration remarquable sur les douze dernières séances.');
    else {
      var seen = {};
      st.candles.slice(0, 8).forEach(function (cd) {
        var key = cd.key + cd.index;
        if (seen[key]) return;
        seen[key] = 1;
        var cls = cd.bias > 0 ? 'bull' : cd.bias < 0 ? 'bear' : 'neutral';
        html += '<div class="atx-card atx-' + cls + '">' +
          '<div class="atx-card-t">' + esc(cd.name) + '<span class="atx-card-d">' + CH.fmtDate(cols.dates[cd.index]) + '</span></div>' +
          '<p>' + esc(cd.note) + '</p></div>';
      });
    }
    return html;
  }

  function paneIndicators() {
    var html = '<div class="atx-group">Profils</div><div class="atx-presets">';
    Object.keys(IND.presets).forEach(function (k) {
      html += '<button type="button" class="atx-preset" data-preset="' + k + '" title="' + esc(IND.presets[k].hint) + '">' +
        esc(IND.presets[k].label) + '</button>';
    });
    html += '</div>';

    html += '<div class="atx-group">Indicateurs affichés (' + S.indicators.length + ')</div>';
    if (!S.indicators.length) {
      html += '<p class="atx-note">Aucun indicateur. Choisissez un profil ci-dessus ou ajoutez-les un à un.</p>';
    } else {
      S.indicators.forEach(function (item) {
        var def = IND.byId(item.id);
        if (!def) return;
        html += '<div class="atx-ind" data-uid="' + item.uid + '">' +
          '<div class="atx-ind-head">' +
          '<span class="atx-ind-n">' + esc(def.title ? def.title(item.params) : def.name) + '</span>' +
          '<span class="atx-ind-c">' + esc(def.cat) + '</span>' +
          '<button type="button" class="atx-x" data-remove="' + item.uid + '" title="Retirer">✕</button>' +
          '</div><div class="atx-ind-params">' +
          (def.params || []).map(function (p) {
            var val = item.params[p.key];
            if (p.type === 'select') {
              return '<label>' + esc(p.label) + '<select data-param="' + item.uid + ':' + p.key + '">' +
                p.options.map(function (o) {
                  return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(val) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
                }).join('') + '</select></label>';
            }
            if (p.type === 'color') {
              return '<label>' + esc(p.label) + '<input type="color" value="' + esc(val) + '" data-param="' + item.uid + ':' + p.key + '"></label>';
            }
            if (p.type === 'bool') {
              return '<label class="atx-chk"><input type="checkbox"' + (val ? ' checked' : '') + ' data-param="' + item.uid + ':' + p.key + '">' + esc(p.label) + '</label>';
            }
            return '<label>' + esc(p.label) + '<input type="number" value="' + esc(val) + '" min="' + (p.min != null ? p.min : '') +
              '" max="' + (p.max != null ? p.max : '') + '" step="' + (p.step || 1) + '" data-param="' + item.uid + ':' + p.key + '"></label>';
          }).join('') +
          '</div></div>';
      });
    }

    html += '<div class="atx-group">Ajouter un indicateur</div>';
    IND.categories().forEach(function (cat) {
      html += '<div class="atx-cat">' + esc(cat) + '</div><div class="atx-add-grid">';
      IND.list.filter(function (d) { return d.cat === cat; }).forEach(function (d) {
        html += '<button type="button" class="atx-add" data-add="' + d.id + '" title="' + esc(d.desc) + '">' +
          '<span>' + esc(d.name) + '</span><small>' + esc(d.desc.slice(0, 88)) + '…</small></button>';
      });
      html += '</div>';
    });
    return html;
  }

  function paneBacktest() {
    if (!S.analysis) return needTicker();
    var html = '<div class="atx-group">Stratégie testée</div><div class="atx-strats">';
    AN.strategies.forEach(function (s) {
      html += '<button type="button" class="atx-strat' + (s.id === S.backtestId ? ' on' : '') + '" data-strat="' + s.id + '">' + esc(s.short) + '</button>';
    });
    html += '</div>';

    var res;
    try { res = AN.backtest(S.analysis.cols, S.backtestId, { fees: 0.02 }); }
    catch (e) { return html + nd('Le backtest a échoué : ' + esc(e.message)); }
    if (!res) return html + nd('Stratégie inconnue.');

    html += '<p class="atx-note">' + esc(res.strategy.desc) + '</p>' +
      '<p class="atx-note">Entrée et sortie à la clôture de la séance qui suit le signal, jamais sur la bougie du signal. ' +
      'Frais forfaitaires de 2 % par aller-retour. Le résultat porte sur l\'historique disponible et ne préjuge de rien.</p>';

    if (!res.enough) {
      return html + '<div class="atx-warn">La stratégie n\'a déclenché que ' + res.count + ' opération' + (res.count > 1 ? 's' : '') +
        ' sur cet historique. En deçà de ' + res.minTrades + ', aucun taux de réussite n\'aurait de valeur statistique et rien n\'est publié.</div>';
    }

    function cell(l, v, s, tone) {
      return '<div class="atx-stat"><div class="atx-stat-l">' + l + '</div><div class="atx-stat-v ' + (tone || '') + '">' + v + '</div>' +
        (s ? '<div class="atx-stat-s">' + s + '</div>' : '') + '</div>';
    }
    function P(v, d) { return M.fin(v) ? (v > 0 ? '+' : '') + (v * 100).toFixed(d == null ? 1 : d) + ' %' : '—'; }
    var beat = res.buyHold != null && M.fin(res.totalReturn) ? res.totalReturn - res.buyHold : null;

    html += '<div class="atx-stats">' +
      cell('Opérations', res.count, 'sur ' + S.analysis.cols.c.length + ' séances') +
      cell('Taux de réussite', (res.winRate * 100).toFixed(0) + ' %', '', res.winRate >= 0.5 ? 'atx-up' : 'atx-down') +
      cell('Gain net cumulé', P(res.totalReturn), 'frais déduits', res.totalReturn > 0 ? 'atx-up' : 'atx-down') +
      cell('Facteur de profit', M.fin(res.profitFactor) ? res.profitFactor.toFixed(2) : '—', 'gains bruts / pertes brutes', res.profitFactor > 1 ? 'atx-up' : 'atx-down') +
      cell('Espérance par opération', P(res.expectancy, 2), 'moyenne des résultats', res.expectancy > 0 ? 'atx-up' : 'atx-down') +
      cell('Gain moyen', P(res.avgWin, 2), '', 'atx-up') +
      cell('Perte moyenne', P(res.avgLoss, 2), '', 'atx-down') +
      cell('Perte maximale', P(res.maxDrawdown), 'sur la courbe de capital', 'atx-down') +
      cell('Durée moyenne', M.fin(res.avgBars) ? Math.round(res.avgBars) + ' séances' : '—', 'par opération') +
      (res.buyHold != null ? cell('Achat et conservation', P(res.buyHold), 'référence sur la même période') : '') +
      '</div>';

    if (beat != null) {
      html += beat > 0
        ? '<div class="atx-card atx-bull"><p>La stratégie devance l\'achat-conservation de ' + (beat * 100).toFixed(1) +
        ' points sur cette période. Un écart favorable sur un seul titre et une seule période reste toutefois fragile : ' +
        'il faudrait le retrouver sur plusieurs valeurs pour y voir autre chose qu\'un accident.</p></div>'
        : '<div class="atx-card atx-bear"><p>La stratégie reste ' + Math.abs(beat * 100).toFixed(1) +
        ' points derrière l\'achat-conservation. Sur cet historique, s\'agiter aura coûté plus que de ne rien faire.</p></div>';
    }

    if (res.trades && res.trades.length) {
      html += '<div class="atx-group">Dernières opérations</div><table class="atx-table"><thead><tr>' +
        '<th>Entrée</th><th>Sortie</th><th class="r">Achat</th><th class="r">Vente</th><th class="r">Résultat</th></tr></thead><tbody>' +
        res.trades.map(function (t) {
          return '<tr><td>' + CH.fmtDate(t.entryDate) + '</td><td>' + CH.fmtDate(t.exitDate) + (t.open ? ' *' : '') + '</td>' +
            '<td class="r">' + fp(t.entry) + '</td><td class="r">' + fp(t.exit) + '</td>' +
            '<td class="r ' + (t.ret >= 0 ? 'atx-up' : 'atx-down') + '">' + (t.ret >= 0 ? '+' : '') + (t.ret * 100).toFixed(1) + ' %</td></tr>';
        }).join('') + '</tbody></table>' +
        (res.trades.some(function (t) { return t.open; }) ? '<p class="atx-note">* position encore ouverte à la dernière séance, valorisée au dernier cours.</p>' : '');
    }
    return html;
  }

  function paneScreen() {
    var html = '<div class="atx-group">Balayage technique du marché</div>' +
      '<p class="atx-note">Le balayage charge l\'historique de chaque valeur cotée, puis calcule pour toutes les mêmes ' +
      'indicateurs que ceux du graphique. Le premier passage prend quelques secondes ; ensuite, tout est en mémoire.</p>' +
      '<button type="button" class="atx-btn atx-btn-primary" id="atxRunScreen">' +
      (S.screenRows ? 'Relancer le balayage' : 'Lancer le balayage') + '</button>';
    if (S.screenState) html += '<div class="atx-progress">' + esc(S.screenState) + '</div>';

    if (!S.screenRows) return html;
    if (!S.screenRows.length) return html + nd('Aucune valeur ne dispose de soixante séances d\'historique.');

    html += '<div class="atx-group">' + S.screenRows.length + ' valeurs analysées</div>' +
      '<table class="atx-table atx-screen"><thead><tr>' +
      '<th data-sort="ticker">Titre</th><th class="r" data-sort="price">Cours</th>' +
      '<th class="r" data-sort="rsi">RSI</th><th class="r" data-sort="adx">ADX</th>' +
      '<th data-sort="trend">Tendance</th><th class="r" data-sort="perf20">1 mois</th>' +
      '<th class="r" data-sort="perf252">1 an</th><th class="r" data-sort="volRatio">Vol.</th></tr></thead><tbody>' +
      S.screenRows.map(function (r) {
        var trendCls = r.trend === 'Haussière' ? 'atx-up' : r.trend === 'Baissière' ? 'atx-down' : '';
        var rsiCls = M.fin(r.rsi) ? (r.rsi > 70 ? 'atx-down' : r.rsi < 30 ? 'atx-up' : '') : '';
        return '<tr data-goto="' + esc(r.ticker) + '">' +
          '<td><strong>' + esc(r.ticker) + '</strong>' + (r.superTrendFlip ? ' <span class="atx-flip" title="Retournement du SuperTrend sur la dernière séance">⟳</span>' : '') + '</td>' +
          '<td class="r">' + fp(r.price) + '</td>' +
          '<td class="r ' + rsiCls + '">' + (M.fin(r.rsi) ? r.rsi.toFixed(0) : '—') + '</td>' +
          '<td class="r">' + (M.fin(r.adx) ? r.adx.toFixed(0) : '—') + '</td>' +
          '<td class="' + trendCls + '">' + esc(r.trend) + '</td>' +
          '<td class="r">' + pctTxt(r.perf20, 1) + '</td>' +
          '<td class="r">' + pctTxt(r.perf252, 1) + '</td>' +
          '<td class="r">' + (M.fin(r.volRatio) ? r.volRatio.toFixed(1) + '×' : '—') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="atx-note">Cliquez une ligne pour ouvrir la valeur dans le graphique. Le symbole ⟳ signale un retournement ' +
      'du SuperTrend sur la dernière séance. La colonne Vol. compare le volume du jour à sa moyenne à vingt séances.</p>';
    return html;
  }

  function paneWatch() {
    var rows = tickerOptions();
    var watch = S.watch || [];
    var html = '<div class="atx-group">Valeurs suivies</div>';
    if (!watch.length) html += '<p class="atx-note">Aucune valeur suivie. Utilisez l\'étoile à côté du sélecteur pour ajouter le titre affiché.</p>';
    else {
      html += '<div class="atx-watch">' + watch.map(function (t) {
        var r = rows.filter(function (x) { return norm(x.ticker) === norm(t); })[0];
        var v = r ? r.variation : NaN;
        return '<div class="atx-watch-i' + (norm(t) === norm(S.ticker) ? ' on' : '') + '" data-goto="' + esc(t) + '">' +
          '<span class="atx-watch-t">' + esc(t) + '</span>' +
          '<span class="atx-watch-p">' + (r && M.fin(r.price) ? fp(r.price) : '—') + '</span>' +
          '<span class="atx-watch-v ' + (M.fin(v) ? (v >= 0 ? 'atx-up' : 'atx-down') : '') + '">' +
          (M.fin(v) ? (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(2) + ' %' : '—') + '</span>' +
          '<button type="button" class="atx-x" data-unwatch="' + esc(t) + '">✕</button></div>';
      }).join('') + '</div>';
    }

    html += '<div class="atx-group">Toutes les valeurs</div><div class="atx-watch">' +
      rows.map(function (r) {
        return '<div class="atx-watch-i' + (norm(r.ticker) === norm(S.ticker) ? ' on' : '') + '" data-goto="' + esc(r.ticker) + '">' +
          '<span class="atx-watch-t">' + esc(r.ticker) + '</span>' +
          '<span class="atx-watch-p">' + (M.fin(r.price) ? fp(r.price) : '—') + '</span>' +
          '<span class="atx-watch-v ' + (M.fin(r.variation) ? (r.variation >= 0 ? 'atx-up' : 'atx-down') : '') + '">' +
          (M.fin(r.variation) ? (r.variation >= 0 ? '▲ ' : '▼ ') + Math.abs(r.variation).toFixed(2) + ' %' : '—') + '</span></div>';
      }).join('') + '</div>';
    return html;
  }

  function renderWatchlist() {
    var btn = $('atxWatchBtn');
    if (!btn) return;
    var on = S.watch.indexOf(S.ticker) >= 0;
    btn.classList.toggle('on', on);
    btn.title = on ? 'Retirer du suivi' : 'Ajouter au suivi';
  }

  /* ── Balayage ─────────────────────────────────────────────────── */

  async function runScreen() {
    var list = tickerOptions();
    if (!list.length) { notify('Les cours du marché ne sont pas encore chargés.', 'warn'); return; }
    var series = {};
    for (var i = 0; i < list.length; i++) {
      S.screenState = 'Chargement ' + (i + 1) + ' / ' + list.length + ' — ' + list[i].ticker;
      if (S.tab === 'balayage') renderSide();
      try {
        var h = await loadHistory(list[i].ticker);
        if (h && h.length >= 60) series[list[i].ticker] = columns(h);
      } catch (e) { /* une valeur illisible ne doit pas interrompre le balayage */ }
    }
    S.screenState = '';
    S.screenRows = AN.screen(series, { sort: 'perf20', desc: true });
    if (S.tab === 'balayage') renderSide();
    notify(S.screenRows.length + ' valeurs analysées.', 'success');
  }

  /* ── Export ───────────────────────────────────────────────────── */

  function exportCSV() {
    if (!S.bars.length) { notify('Aucune donnée à exporter.', 'warn'); return; }
    var lines = ['date;ouverture;plus_haut;plus_bas;cloture;volume'];
    S.bars.forEach(function (b) {
      lines.push([b.date, b.o, b.h, b.l, b.c, b.v].join(';'));
    });
    download(lines.join('\n'), S.ticker + '_' + S.interval + '.csv', 'text/csv;charset=utf-8');
    notify('Données exportées.', 'success');
  }

  function exportReport() {
    if (!S.analysis) { notify('Sélectionnez d\'abord un titre.', 'warn'); return; }
    var a = S.analysis;
    var L = [];
    var sep = function (t) { L.push('', '─'.repeat(66), t.toUpperCase(), '─'.repeat(66)); };
    L.push('THE CAPITAL — RAPPORT D\'ANALYSE TECHNIQUE');
    L.push('='.repeat(66));
    L.push('Titre      : ' + S.ticker + (S.name ? ' — ' + S.name : ''));
    L.push('Édité le   : ' + new Date().toLocaleString('fr-FR'));
    L.push('Historique : ' + a.cols.c.length + ' séances, du ' + a.cols.dates[0] + ' au ' + a.cols.dates[a.cols.dates.length - 1]);
    L.push('Affichage  : ' + S.interval + ' · ' + (S.period >= 99999 ? 'tout l\'historique' : S.period + ' séances') + ' · ' + S.type);

    if (a.signals && a.signals.enough) {
      sep('Synthèse des signaux');
      L.push('Score global : ' + (a.signals.score > 0 ? '+' : '') + a.signals.score.toFixed(0) + ' / 100');
      L.push('Lecture      : ' + a.signals.verdict.label);
      L.push('Cohérence    : ' + a.signals.confidence + ' (' + a.signals.counts.positive + ' favorables, ' +
        a.signals.counts.negative + ' défavorables, ' + a.signals.counts.neutral + ' neutres)');
      Object.keys(a.signals.groups).forEach(function (g) {
        L.push('', '  ' + g.toUpperCase());
        a.signals.groups[g].forEach(function (s) {
          L.push('    · ' + s.label + (s.score == null ? '' : ' (' + (s.score > 0 ? '+' : '') + s.score.toFixed(1) + ')'));
          L.push('      ' + s.reason);
        });
      });
    }

    if (a.plan && a.plan.enough) {
      var p = a.plan;
      sep('Plan de trade');
      L.push('Scénario      : ' + (p.direction === 'long' ? 'haussier' : 'baissier'));
      L.push('Référence     : ' + fp(p.entry) + ' FCFA');
      L.push('Invalidation  : ' + fp(p.stop) + ' FCFA (' + p.riskPct.toFixed(2) + ' % du cours)');
      L.push('                ' + p.stopBasis);
      L.push('Objectif 1    : ' + fp(p.target1) + ' FCFA — gain/risque ' + (M.fin(p.rr1) ? p.rr1.toFixed(2) : '—'));
      L.push('Objectif 2    : ' + fp(p.target2) + ' FCFA — gain/risque ' + (M.fin(p.rr2) ? p.rr2.toFixed(2) : '—'));
      L.push('                ' + p.targetBasis);
      L.push('ATR (14)      : ' + fp(p.atr) + ' FCFA soit ' + p.atrPct.toFixed(2) + ' % du cours');
    }

    if (a.stats && a.stats.enough) {
      var s = a.stats;
      var P = function (v, d) { return M.fin(v) ? (v > 0 ? '+' : '') + (v * 100).toFixed(d == null ? 2 : d) + ' %' : 'données insuffisantes'; };
      var N = function (v) { return M.fin(v) ? v.toFixed(2) : 'données insuffisantes'; };
      sep('Statistiques');
      L.push('Performance totale       : ' + P(s.totalReturn));
      L.push('Rendement annualisé      : ' + P(s.cagr));
      /* Une volatilité n'a pas de sens signé : on la publie sans « + ». */
      var V = function (v) { return M.fin(v) ? (v * 100).toFixed(1) + ' %' : 'données insuffisantes'; };
      L.push('Volatilité annualisée    : ' + V(s.volAnn));
      L.push('Volatilité Parkinson     : ' + V(s.volParkinson));
      L.push('Volatilité Garman-Klass  : ' + V(s.volGarmanKlass));
      L.push('Sharpe / Sortino / Calmar: ' + N(s.sharpe) + ' / ' + N(s.sortino) + ' / ' + N(s.calmar));
      L.push('Perte maximale           : ' + P(s.maxDrawdown) + ' (du ' + s.drawdownFrom + ' au ' + s.drawdownTo + ')');
      L.push('VaR 95 % / 99 %          : ' + P(s.var95) + ' / ' + P(s.var99));
      L.push('Asymétrie / Aplatissement: ' + N(s.skewness) + ' / ' + N(s.kurtosis));
      L.push('Exposant de Hurst        : ' + N(s.hurst));
      L.push('Volume moyen             : ' + fv(s.avgVolume) + ' titres par séance');
      if (s.benchmark) {
        L.push('Beta / corrélation       : ' + N(s.benchmark.beta) + ' / ' + N(s.benchmark.correlation) +
          ' (contre ' + s.benchmark.name + ', ' + s.benchmark.observations + ' séances communes)');
        L.push('Alpha de Jensen          : ' + P(s.benchmark.alpha));
      }
      (s.warnings || []).forEach(function (w) { L.push('Réserve : ' + w); });
    }

    if (a.structure) {
      sep('Structure de marché');
      if (a.structure.levels.length) {
        L.push('Niveaux techniques :');
        a.structure.levels.slice().reverse().forEach(function (lv) {
          L.push('  · ' + fp(lv.value) + ' FCFA — ' + lv.type + ', ' + lv.touches + ' contacts' +
            (lv.distance != null ? ', ' + (lv.distance > 0 ? '+' : '') + lv.distance.toFixed(1) + ' %' : ''));
        });
      } else L.push('Aucun niveau touché au moins deux fois.');
      if (a.structure.patterns.length) {
        L.push('', 'Figures :');
        a.structure.patterns.forEach(function (p) { L.push('  · ' + p.name + ' — ' + p.note); });
      }
      if (a.structure.divergences.length) {
        L.push('', 'Divergences :');
        a.structure.divergences.forEach(function (d) { L.push('  · ' + d.label + ' ' + d.kind + ' — ' + d.note); });
      }
      if (a.structure.candles.length) {
        L.push('', 'Chandeliers récents :');
        a.structure.candles.slice(0, 6).forEach(function (c) {
          L.push('  · ' + a.cols.dates[c.index] + ' — ' + c.name);
        });
      }
    }

    if (S.indicators.length) {
      sep('Indicateurs affichés');
      S.indicators.forEach(function (it) {
        var def = IND.byId(it.id);
        if (def) L.push('  · ' + (def.title ? def.title(it.params) : def.name));
      });
    }

    L.push('', '='.repeat(66));
    L.push('Rapport produit par The Capital à partir des cotations de la BRVM.');
    L.push('Analyse strictement technique : elle ignore les fondamentaux, l\'actualité');
    L.push('de la société et la profondeur réelle du carnet d\'ordres. Elle ne');
    L.push('constitue pas un conseil en investissement.');

    download(L.join('\n'), 'analyse_' + S.ticker + '_' + new Date().toISOString().slice(0, 10) + '.txt', 'text/plain;charset=utf-8');
    notify('Rapport exporté.', 'success');
  }

  function download(content, name, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ── Interactions du graphique ────────────────────────────────── */

  function localPoint(e) {
    var r = chart.over.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function bindChart() {
    var cv = chart.over;
    var drag = null;

    cv.addEventListener('pointermove', function (e) {
      var p = localPoint(e);
      if (drag) {
        var dx = p.x - drag.x;
        var range = drag.zoom.end - drag.zoom.start;
        var shift = dx / Math.max(1, chart.layout ? chart.layout.chartW : cv.width) * range;
        var start = M.clamp(drag.zoom.start - shift, 0, 1 - range);
        S.zoom = { start: start, end: start + range };
        draw();
        return;
      }
      chart.setCursor(p);
      if (S.pending) {
        var d = chart.toData(p.x, p.y);
        if (d) { S.pending.cursor = { x: d.x, y: d.y }; chart.renderOverlay(); }
      }
    });

    cv.addEventListener('pointerleave', function () {
      chart.setCursor(null);
      S.cursorIndex = null;
      updateQuote();
    });

    cv.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var p = localPoint(e);
      if (S.tool === 'cursor') {
        if (!chart.inPricePane(p.y)) return;
        drag = { x: p.x, zoom: { start: S.zoom.start, end: S.zoom.end } };
        try { cv.setPointerCapture(e.pointerId); } catch (err) { }
        cv.style.cursor = 'grabbing';
        return;
      }
      if (!chart.inPricePane(p.y)) return;
      e.preventDefault();
      var d = chart.toData(p.x, p.y);
      if (!d) return;
      var t = toolDef(S.tool);

      if (S.tool === 'text') {
        var txt = global.prompt('Texte de l\'annotation :', '');
        if (txt) {
          S.shapes.push({ id: 's' + Date.now(), type: 'text', points: [{ x: d.x, y: d.y }], text: String(txt).slice(0, 140) });
          saveShapes();
        }
        setTool('cursor');
        draw();
        return;
      }

      if (!S.pending) S.pending = { id: 's' + Date.now(), type: S.tool, points: [], extend: !!t.extend };
      S.pending.points.push({ x: d.x, y: d.y });
      if (S.pending.points.length >= t.points) {
        var shape = { id: S.pending.id, type: S.pending.type, points: S.pending.points, extend: S.pending.extend };
        S.shapes.push(shape);
        S.pending = null;
        saveShapes();
        setTool('cursor');
      }
      draw();
    });

    function endDrag(e) {
      if (!drag) return;
      drag = null;
      try { cv.releasePointerCapture(e.pointerId); } catch (err) { }
      cv.style.cursor = S.tool === 'cursor' ? 'crosshair' : 'copy';
    }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);

    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = localPoint(e);
      var w = chart.layout ? chart.layout.chartW : cv.clientWidth;
      var anchor = M.clamp(p.x / Math.max(1, w), 0, 1);
      var range = S.zoom.end - S.zoom.start;
      var factor = e.deltaY > 0 ? 1.15 : 0.87;
      var next = M.clamp(range * factor, 0.02, 1);
      var focus = S.zoom.start + range * anchor;
      var start = M.clamp(focus - next * anchor, 0, 1 - next);
      S.zoom = { start: start, end: start + next };
      draw();
    }, { passive: false });

    cv.addEventListener('dblclick', function () {
      S.zoom = { start: 0, end: 1 };
      draw();
    });

    /* Support tactile : pincer pour zoomer, glisser pour se déplacer. */
    var touches = {};
    var pinchDist = null;
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    cv.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinchDist) {
        e.preventDefault();
        var d2 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        var range = S.zoom.end - S.zoom.start;
        var next = M.clamp(range * (pinchDist / Math.max(1, d2)), 0.02, 1);
        var center = (S.zoom.start + S.zoom.end) / 2;
        var start = M.clamp(center - next / 2, 0, 1 - next);
        S.zoom = { start: start, end: start + next };
        pinchDist = d2;
        draw();
      }
    }, { passive: false });
    cv.addEventListener('touchend', function () { pinchDist = null; }, { passive: true });
  }

  /* ── Barre d'outils ───────────────────────────────────────────── */

  var PERIODS = [
    { v: 20, l: '1M' }, { v: 60, l: '3M' }, { v: 120, l: '6M' },
    { v: 252, l: '1A' }, { v: 504, l: '2A' }, { v: 1260, l: '5A' }, { v: 99999, l: 'Max' }
  ];
  var TYPES = [
    { v: 'candle', l: 'Chandeliers' }, { v: 'hollow', l: 'Creux' }, { v: 'bar', l: 'Barres' },
    { v: 'line', l: 'Ligne' }, { v: 'area', l: 'Aire' }, { v: 'baseline', l: 'Base 0' }
  ];
  var INTERVALS = [
    { v: 'daily', l: 'Jour' }, { v: 'weekly', l: 'Semaine' },
    { v: 'monthly', l: 'Mois' }, { v: 'quarterly', l: 'Trimestre' }
  ];

  function buildToolbar() {
    var host = $('atxToolbar');
    if (!host) return;
    host.innerHTML =
      '<div class="atx-tb-g atx-tb-ticker">' +
      '<select id="atTicker" class="atx-select"><option value="">Choisir un titre…</option></select>' +
      '<button type="button" class="atx-icon" id="atxWatchBtn" title="Ajouter au suivi">★</button>' +
      '<span class="atx-hint" id="atxTickerCount"></span>' +
      '</div>' +
      '<div class="atx-tb-g"><span class="atx-tb-l">Type</span>' +
      TYPES.map(function (t) { return '<button type="button" class="atx-btn" data-type="' + t.v + '">' + t.l + '</button>'; }).join('') +
      '</div>' +
      '<div class="atx-tb-g"><span class="atx-tb-l">Période</span>' +
      PERIODS.map(function (p) { return '<button type="button" class="atx-btn" data-period="' + p.v + '">' + p.l + '</button>'; }).join('') +
      '</div>' +
      '<div class="atx-tb-g"><span class="atx-tb-l">Unité</span>' +
      INTERVALS.map(function (i) { return '<button type="button" class="atx-btn" data-interval="' + i.v + '">' + i.l + '</button>'; }).join('') +
      '</div>' +
      '<div class="atx-tb-g">' +
      '<button type="button" class="atx-btn" data-toggle="log" title="Échelle logarithmique : les variations en pourcentage occupent la même hauteur, quel que soit le niveau du cours">Log</button>' +
      '<button type="button" class="atx-btn on" data-toggle="autoLevels" title="Supports et résistances détectés automatiquement">Niveaux</button>' +
      '<button type="button" class="atx-btn on" data-toggle="showMarkers" title="Repères des configurations en chandeliers marquées">Repères</button>' +
      '<button type="button" class="atx-btn" data-toggle="light" title="Basculer entre fond sombre et fond clair">Clair</button>' +
      '</div>' +
      '<div class="atx-tb-g atx-tb-right">' +
      '<button type="button" class="atx-btn" id="atxCompare" title="Superposer un second titre, ramené à la même échelle">Comparer</button>' +
      '<button type="button" class="atx-btn" id="atxPng">PNG</button>' +
      '<button type="button" class="atx-btn" id="atxCsv">CSV</button>' +
      '<button type="button" class="atx-btn" id="atxReport">Rapport</button>' +
      '<button type="button" class="atx-btn" id="atxFullscreen" title="Plein écran">⛶</button>' +
      '</div>';

    var tools = $('atxTools');
    if (tools) {
      tools.innerHTML = TOOLS.map(function (t) {
        return '<button type="button" class="atx-tool" data-tool="' + t.id + '" title="' + esc(t.label + (t.hint ? ' — ' + t.hint : '')) + '">' + t.icon + '</button>';
      }).join('') +
        '<div class="atx-tool-sep"></div>' +
        '<button type="button" class="atx-tool" id="atxUndo" title="Annuler le dernier tracé">↶</button>' +
        '<button type="button" class="atx-tool atx-tool-danger" id="atxClear" title="Effacer tous les tracés">🗑</button>';
    }
    syncToolbar();
  }

  function syncToolbar() {
    var r = root();
    if (!r) return;
    r.querySelectorAll('[data-type]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-type') === S.type); });
    r.querySelectorAll('[data-period]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-period') === S.period); });
    r.querySelectorAll('[data-interval]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-interval') === S.interval); });
    r.querySelectorAll('[data-toggle]').forEach(function (b) { b.classList.toggle('on', !!S[b.getAttribute('data-toggle')]); });
    r.querySelectorAll('[data-tool]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === S.tool); });
    r.classList.toggle('atx-light', S.light);
  }

  function renderAll() {
    syncToolbar();
    draw();
    renderSide();
  }

  /* ── Événements ───────────────────────────────────────────────── */

  function bindEvents() {
    var r = root();
    if (!r || r.dataset.atxBound === '1') return;
    r.dataset.atxBound = '1';

    r.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'atTicker') { loadTicker(t.value); return; }
      var param = t.getAttribute && t.getAttribute('data-param');
      if (param) {
        var parts = param.split(':');
        var item = S.indicators.filter(function (x) { return x.uid === parts[0]; })[0];
        if (!item) return;
        item.params[parts[1]] = t.type === 'checkbox' ? t.checked : (t.type === 'number' ? +t.value : t.value);
        persistIndicators();
        draw();
        renderSide();
      }
    });

    r.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'atxCapital' || t.id === 'atxRisk') {
        var cap = +($('atxCapital') || {}).value;
        var rk = +($('atxRisk') || {}).value;
        var out = $('atxSizeOut');
        if (!out || !S.analysis || !S.analysis.plan || !S.analysis.plan.enough) return;
        var sz = S.analysis.plan.sizing(cap, rk);
        out.innerHTML = sz && sz.quantity > 0
          ? '<strong>' + sz.quantity.toLocaleString('fr-FR') + ' titres</strong> — capital engagé ' +
          fp(sz.engaged) + ' FCFA, perte plafonnée à ' + fp(sz.budget) + ' FCFA'
          : '<span class="atx-nd">Le risque autorisé ne permet pas d\'acheter un seul titre à ce niveau d\'invalidation.</span>';
      }
    });

    r.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button,[data-goto],[data-sort]') : null;
      if (!t) return;

      var v;
      if ((v = t.getAttribute('data-type'))) { S.type = v; store(LS.type, v); renderAll(); return; }
      if ((v = t.getAttribute('data-period'))) { S.period = +v; S.zoom = { start: 0, end: 1 }; renderAll(); return; }
      if ((v = t.getAttribute('data-interval'))) {
        S.interval = v;
        S.bars = aggregate(S.raw, v);
        S.zoom = { start: 0, end: 1 };
        renderAll();
        updateQuote();
        return;
      }
      if ((v = t.getAttribute('data-toggle'))) {
        S[v] = !S[v];
        if (v === 'light') store(LS.theme, S.light ? 'light' : 'dark');
        renderAll();
        return;
      }
      if ((v = t.getAttribute('data-tool'))) { setTool(v); return; }
      if ((v = t.getAttribute('data-tab'))) { S.tab = v; store(LS.tab, v); renderSide(); return; }
      if ((v = t.getAttribute('data-preset'))) { applyPreset(v); return; }
      if ((v = t.getAttribute('data-add'))) { addIndicator(v); renderAll(); return; }
      if ((v = t.getAttribute('data-remove'))) { removeIndicator(v); renderAll(); return; }
      if ((v = t.getAttribute('data-strat'))) { S.backtestId = v; renderSide(); return; }
      if ((v = t.getAttribute('data-unwatch'))) {
        e.stopPropagation();
        S.watch = S.watch.filter(function (x) { return norm(x) !== norm(v); });
        store(LS.watch, S.watch);
        renderSide(); renderWatchlist();
        return;
      }
      if ((v = t.getAttribute('data-goto'))) { loadTicker(v); return; }
      if ((v = t.getAttribute('data-sort'))) {
        if (!S.screenRows) return;
        S._sortKey = S._sortKey === v ? v : v;
        S._sortDesc = S._sortLast === v ? !S._sortDesc : true;
        S._sortLast = v;
        S.screenRows.sort(function (a, b) {
          var va = a[v], vb = b[v];
          if (typeof va === 'string') return S._sortDesc ? String(vb).localeCompare(va) : String(va).localeCompare(vb);
          if (va == null) return 1;
          if (vb == null) return -1;
          return S._sortDesc ? vb - va : va - vb;
        });
        renderSide();
        return;
      }

      switch (t.id) {
        case 'atxWatchBtn':
          if (!S.ticker) return;
          if (S.watch.indexOf(S.ticker) >= 0) S.watch = S.watch.filter(function (x) { return x !== S.ticker; });
          else S.watch.push(S.ticker);
          store(LS.watch, S.watch);
          renderWatchlist();
          if (S.tab === 'suivi') renderSide();
          break;
        case 'atxUndo': undoShape(); break;
        case 'atxClear': clearShapes(); break;
        case 'atxPng':
          if (!S.bars.length) { notify('Aucun graphique à exporter.', 'warn'); return; }
          chart.exportPNG(S.ticker + '_' + new Date().toISOString().slice(0, 10));
          break;
        case 'atxCsv': exportCSV(); break;
        case 'atxReport': exportReport(); break;
        case 'atxFullscreen': toggleFullscreen(); break;
        case 'atxCompare': doCompare(); break;
        case 'atxRunScreen': runScreen(); break;
      }
    });

    document.addEventListener('keydown', function (e) {
      var r2 = root();
      if (!r2 || !r2.classList.contains('active')) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target.tagName || '').toUpperCase())) return;
      if (e.key === 'Escape') {
        if (S.pending) { S.pending = null; draw(); }
        else if (r2.classList.contains('atx-full')) toggleFullscreen();
        else setTool('cursor');
      } else if (e.key === 'ArrowLeft') { panBy(-0.08); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { panBy(0.08); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { zoomBy(0.85); }
      else if (e.key === '-') { zoomBy(1.18); }
      else if (e.key === '0') { S.zoom = { start: 0, end: 1 }; draw(); }
    });

    global.addEventListener('resize', function () {
      if (!root() || !root().classList.contains('active')) return;
      draw();
    });
  }

  function panBy(f) {
    var range = S.zoom.end - S.zoom.start;
    var start = M.clamp(S.zoom.start + range * f, 0, 1 - range);
    S.zoom = { start: start, end: start + range };
    draw();
  }
  function zoomBy(f) {
    var range = S.zoom.end - S.zoom.start;
    var next = M.clamp(range * f, 0.02, 1);
    var center = (S.zoom.start + S.zoom.end) / 2;
    var start = M.clamp(center - next / 2, 0, 1 - next);
    S.zoom = { start: start, end: start + next };
    draw();
  }

  function toggleFullscreen() {
    var r = root();
    if (!r) return;
    r.classList.toggle('atx-full');
    document.body.classList.toggle('atx-body-full', r.classList.contains('atx-full'));
    setTimeout(draw, 60);
  }

  async function doCompare() {
    if (!S.ticker) { notify('Sélectionnez d\'abord un titre.', 'warn'); return; }
    if (S.compare) { S.compare = null; draw(); notify('Comparaison retirée.', 'info'); return; }
    var list = tickerOptions().map(function (o) { return o.ticker; }).filter(function (t) { return norm(t) !== norm(S.ticker); });
    var input = global.prompt('Titre à superposer (' + list.slice(0, 8).join(', ') + '…) :', list[0] || '');
    if (!input) return;
    var row = findMarketRow(input);
    var canonical = (row && rowTicker(row)) || String(input).trim().toUpperCase();
    setStatus('Chargement de ' + canonical + ' pour comparaison…');
    var series = await loadHistory(canonical);
    if (!series.length) { notify('Aucun historique disponible pour ' + canonical + '.', 'error'); setStatus(''); return; }
    S.compare = { ticker: canonical, bars: aggregate(series, S.interval) };
    setStatus(canonical + ' superposé. La série comparée est ramenée à l\'échelle du titre affiché : seule sa forme est comparable, pas son niveau.');
    draw();
  }

  /* ── Amorçage ─────────────────────────────────────────────────── */

  function restore() {
    S.light = read(LS.theme, 'dark') === 'light';
    S.type = read(LS.type, 'candle');
    S.tab = read(LS.tab, 'signaux');
    S.watch = read(LS.watch, []) || [];
    var saved = read(LS.inds, null);
    if (Array.isArray(saved) && saved.length) {
      saved.forEach(function (x) { if (IND.byId(x.id)) addIndicator(x.id, x.params); });
    } else {
      applyPresetSilent(read(LS.preset, 'tendance'));
    }
  }
  function applyPresetSilent(key) {
    var p = IND.presets[key] || IND.presets.tendance;
    S.indicators = [];
    p.indicators.forEach(function (x) { addIndicator(x.id, x.params); });
  }

  var booted = false;

  function init() {
    var host = $('atxCanvasHost');
    if (!host) return false;
    if (!booted) {
      restore();
      chart = create();
      buildToolbar();
      bindEvents();
      bindChart();
      setTool('cursor');
      booted = true;
    }
    var count = fillTickerSelect();
    renderWatchlist();
    if (!count) {
      setStatus('En attente des cours du marché…');
      renderSide();
      return false;
    }
    if (!S.ticker) {
      var sel = $('atTicker');
      var first = tickerOptions()[0];
      if (first) { if (sel) sel.value = first.ticker; loadTicker(first.ticker); }
    } else {
      draw();
      renderSide();
    }
    return true;

    function create() { return CH.create(host); }
  }

  /* ── Points d'entrée publics ──────────────────────────────────── */

  global.atInit = function () {
    try { return init(); }
    catch (e) { console.error('[AT] initialisation', e); return false; }
  };

  global.atRefreshUI = function () {
    if (!booted) { global.atInit(); return; }
    fillTickerSelect();
    renderWatchlist();
    if (S.ticker && !S.bars.length) { loadTicker(S.ticker); return; }
    if (S.bars.length) { updateQuote(); draw(); }
    renderSide();
  };

  /* Appelé par le routeur à chaque affichage de la vue. */
  global.renderAnalyseTechnique = function () {
    if (!booted) { global.atInit(); return; }
    fillTickerSelect();
    setTimeout(function () {
      if (chart) chart.resize();
      draw();
    }, 30);
  };

  /* Compatibilité : quelques anciens appels subsistent ailleurs dans
     l'application. Ils sont redirigés plutôt que supprimés. */
  global.atRender = draw;
  global.atSetType = function (t) { S.type = t; store(LS.type, t); renderAll(); };
  global.atSetPeriod = function (n) { S.period = +n; S.zoom = { start: 0, end: 1 }; renderAll(); };
  global.atSetInterval = function (v) { S.interval = v; S.bars = aggregate(S.raw, v); S.zoom = { start: 0, end: 1 }; renderAll(); };
  global.atSetDraw = setTool;
  global.atClearDrawings = clearShapes;
  global.atToggleFocus = toggleFullscreen;
  global.atExportPNG = function () { if (chart && S.bars.length) chart.exportPNG(S.ticker); };
  global.atExportReport = exportReport;
  global.atCompare = doCompare;
  global.atZoomIn = function () { zoomBy(0.85); };
  global.atZoomOut = function () { zoomBy(1.18); };
  global.atZoomReset = function () { S.zoom = { start: 0, end: 1 }; draw(); };
  global.atPanLeft = function () { panBy(-0.15); };
  global.atPanRight = function () { panBy(0.15); };
  global.atGoToEnd = function () { var r = S.zoom.end - S.zoom.start; S.zoom = { start: 1 - r, end: 1 }; draw(); };
  global.atOpenIndModal = function () { S.tab = 'indicateurs'; renderSide(); };
  global.atUpdateWatchlist = renderWatchlist;

  /* Les cours peuvent arriver après le premier rendu de la vue. */
  global.addEventListener('tc:dataready', function () {
    if (booted) global.atRefreshUI();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(global.atInit, 0); }, { once: true });
  }
})(typeof window !== 'undefined' ? window : globalThis);
