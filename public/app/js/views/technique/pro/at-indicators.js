/* ═══════════════════════════════════════════════════════════════════
   THE CAPITAL — ANALYSE TECHNIQUE PRO
   at-indicators.js : catalogue déclaratif des indicateurs.

   Chaque entrée décrit un indicateur une seule fois : son nom, sa
   famille, ses paramètres réglables, et la façon de le calculer. Le
   graphique et la fenêtre de réglage lisent tous deux ce catalogue,
   si bien qu'ajouter un indicateur ne demande qu'une entrée ici.

   `compute` reçoit les séries brutes et les paramètres, et renvoie
   des primitives de tracé — lignes, bandes, histogrammes, nuages —
   que le moteur de rendu sait dessiner sans rien connaître de
   l'indicateur lui-même.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ATIndicators) return;

  var M = global.ATMath;

  var C = {
    or: '#c8a24e', bleu: '#5b9dfb', rouge: '#f0645e', vert: '#3fc98a',
    violet: '#a78bfa', rose: '#e879f9', ambre: '#f0a72a', cyan: '#22d3ee',
    gris: '#8a8578', blanc: '#e9e3d6', turquoise: '#2dd4bf', saumon: '#fb8f6a'
  };

  function src(d, kind) {
    switch (kind) {
      case 'open': return d.o;
      case 'high': return d.h;
      case 'low': return d.l;
      case 'hl2': return d.c.map(function (_, i) { return (d.h[i] + d.l[i]) / 2; });
      case 'hlc3': return d.c.map(function (_, i) { return (d.h[i] + d.l[i] + d.c[i]) / 3; });
      case 'ohlc4': return d.c.map(function (_, i) { return (d.o[i] + d.h[i] + d.l[i] + d.c[i]) / 4; });
      default: return d.c;
    }
  }

  var SOURCES = [
    { value: 'close', label: 'Clôture' }, { value: 'open', label: 'Ouverture' },
    { value: 'high', label: 'Plus haut' }, { value: 'low', label: 'Plus bas' },
    { value: 'hl2', label: 'Médiane (H+B)/2' }, { value: 'hlc3', label: 'Typique (H+B+C)/3' },
    { value: 'ohlc4', label: 'Moyenne OHLC' }
  ];

  var MA_KINDS = [
    { value: 'sma', label: 'Simple' }, { value: 'ema', label: 'Exponentielle' },
    { value: 'wma', label: 'Pondérée' }, { value: 'hma', label: 'Hull' },
    { value: 'dema', label: 'Double exp.' }, { value: 'tema', label: 'Triple exp.' },
    { value: 'rma', label: 'Wilder' }
  ];

  function line(key, values, color, opts) {
    opts = opts || {};
    return {
      key: key, values: values, color: color,
      width: opts.width || 1.4, dash: opts.dash || null,
      label: opts.label || key, fill: opts.fill || null, step: !!opts.step,
      segmentColor: opts.segmentColor || null, hideLabel: !!opts.hideLabel
    };
  }

  var DEFS = [

    /* ───────────────── Tendance ───────────────── */
    {
      id: 'ma', name: 'Moyenne mobile', short: 'MM', cat: 'Tendance', overlay: true, multi: true,
      desc: 'Lisse le cours pour dégager la direction dominante. Le croisement de deux moyennes de périodes différentes reste le signal de tendance le plus suivi.',
      params: [
        { key: 'kind', label: 'Type', type: 'select', options: MA_KINDS, def: 'sma' },
        { key: 'period', label: 'Périodes', type: 'number', min: 2, max: 400, def: 20 },
        { key: 'source', label: 'Source', type: 'select', options: SOURCES, def: 'close' },
        { key: 'color', label: 'Couleur', type: 'color', def: C.bleu }
      ],
      title: function (p) { return (p.kind || 'sma').toUpperCase() + ' ' + p.period; },
      compute: function (d, p) {
        var v = M.movingAverage(p.kind, src(d, p.source), +p.period);
        return { lines: [line('ma', v, p.color, { label: this.title(p), width: 1.6 })] };
      }
    },
    {
      id: 'bb', name: 'Bandes de Bollinger', short: 'BB', cat: 'Volatilité', overlay: true,
      desc: 'Enveloppe le cours à deux écarts-types de sa moyenne. Un resserrement des bandes précède souvent une expansion de volatilité ; il ne dit rien du sens.',
      params: [
        { key: 'period', label: 'Périodes', type: 'number', min: 5, max: 200, def: 20 },
        { key: 'mult', label: 'Écarts-types', type: 'number', min: 0.5, max: 5, step: 0.1, def: 2 },
        { key: 'source', label: 'Source', type: 'select', options: SOURCES, def: 'close' },
        { key: 'color', label: 'Couleur', type: 'color', def: C.or }
      ],
      title: function (p) { return 'BB ' + p.period + '/' + p.mult; },
      compute: function (d, p) {
        var b = M.bollinger(src(d, p.source), +p.period, +p.mult);
        return {
          bands: [{ upper: b.upper, lower: b.lower, color: p.color, alpha: 0.06 }],
          lines: [
            line('up', b.upper, p.color, { width: 1, dash: [4, 4], label: 'Sup.' }),
            line('mid', b.mid, p.color, { width: 1, label: 'Moy.' }),
            line('lo', b.lower, p.color, { width: 1, dash: [4, 4], label: 'Inf.' })
          ],
          readout: function (i) {
            return M.fin(b.percentB[i]) ? '%B ' + b.percentB[i].toFixed(2) + ' · largeur ' + b.width[i].toFixed(1) + '%' : null;
          }
        };
      }
    },
    {
      id: 'keltner', name: 'Canal de Keltner', short: 'KC', cat: 'Volatilité', overlay: true,
      desc: 'Enveloppe fondée sur l\'ATR plutôt que sur l\'écart-type. Les bandes de Bollinger entrant à l\'intérieur du canal de Keltner signalent une compression extrême.',
      params: [
        { key: 'period', label: 'Périodes', type: 'number', min: 5, max: 100, def: 20 },
        { key: 'mult', label: 'Multiple ATR', type: 'number', min: 0.5, max: 5, step: 0.1, def: 2 },
        { key: 'color', label: 'Couleur', type: 'color', def: C.turquoise }
      ],
      title: function (p) { return 'Keltner ' + p.period; },
      compute: function (d, p) {
        var k = M.keltner(d.h, d.l, d.c, +p.period, +p.mult);
        return {
          lines: [
            line('up', k.upper, p.color, { width: 1, dash: [2, 3], label: 'Sup.' }),
            line('mid', k.mid, p.color, { width: 1, label: 'Moy.' }),
            line('lo', k.lower, p.color, { width: 1, dash: [2, 3], label: 'Inf.' })
          ]
        };
      }
    },
    {
      id: 'donchian', name: 'Canal de Donchian', short: 'DC', cat: 'Volatilité', overlay: true,
      desc: 'Plus haut et plus bas des N dernières séances. Base des stratégies de cassure : franchir le canal, c\'est faire un extrême de période.',
      params: [
        { key: 'period', label: 'Périodes', type: 'number', min: 5, max: 200, def: 20 },
        { key: 'color', label: 'Couleur', type: 'color', def: C.saumon }
      ],
      title: function (p) { return 'Donchian ' + p.period; },
      compute: function (d, p) {
        var k = M.donchian(d.h, d.l, +p.period);
        return {
          bands: [{ upper: k.upper, lower: k.lower, color: p.color, alpha: 0.05 }],
          lines: [
            line('up', k.upper, p.color, { width: 1, label: 'Haut' }),
            line('mid', k.mid, p.color, { width: 0.8, dash: [3, 3], label: 'Milieu' }),
            line('lo', k.lower, p.color, { width: 1, label: 'Bas' })
          ]
        };
      }
    },
    {
      id: 'supertrend', name: 'SuperTrend', short: 'ST', cat: 'Tendance', overlay: true,
      desc: 'Ligne de suivi calée sur l\'ATR qui bascule au-dessus ou au-dessous du cours. Elle fournit un stop suiveur objectif tant que la tendance tient.',
      params: [
        { key: 'period', label: 'Périodes ATR', type: 'number', min: 3, max: 50, def: 10 },
        { key: 'mult', label: 'Multiple', type: 'number', min: 0.5, max: 8, step: 0.1, def: 3 }
      ],
      title: function (p) { return 'SuperTrend ' + p.period + '/' + p.mult; },
      compute: function (d, p) {
        var s = M.superTrend(d.h, d.l, d.c, +p.period, +p.mult);
        return {
          lines: [line('st', s.line, C.vert, {
            width: 2, label: 'SuperTrend', step: true,
            segmentColor: function (i) { return s.dir[i] === 1 ? C.vert : C.rouge; }
          })],
          readout: function (i) { return s.dir[i] == null ? null : (s.dir[i] === 1 ? 'tendance haussière' : 'tendance baissière'); }
        };
      }
    },
    {
      id: 'psar', name: 'SAR parabolique', short: 'PSAR', cat: 'Tendance', overlay: true,
      desc: 'Semis de points qui se resserre à mesure que la tendance mûrit. Le retournement du semis marque la sortie de position.',
      params: [
        { key: 'step', label: 'Pas', type: 'number', min: 0.005, max: 0.1, step: 0.005, def: 0.02 },
        { key: 'max', label: 'Pas maximal', type: 'number', min: 0.05, max: 0.5, step: 0.05, def: 0.2 }
      ],
      title: function () { return 'SAR parabolique'; },
      compute: function (d, p) {
        var s = M.psar(d.h, d.l, +p.step, +p.max);
        return { dots: [{ values: s, color: C.ambre, radius: 1.4, label: 'PSAR' }] };
      }
    },
    {
      id: 'ichimoku', name: 'Ichimoku Kinkō Hyō', short: 'ICH', cat: 'Tendance', overlay: true,
      desc: 'Système complet : deux lignes rapides, un nuage projeté en avant qui matérialise le support ou la résistance à venir, et une ligne retardée de confirmation.',
      params: [
        { key: 'conv', label: 'Tenkan', type: 'number', min: 2, max: 60, def: 9 },
        { key: 'base', label: 'Kijun', type: 'number', min: 5, max: 120, def: 26 },
        { key: 'span', label: 'Senkou B', type: 'number', min: 10, max: 240, def: 52 }
      ],
      title: function () { return 'Ichimoku'; },
      compute: function (d, p) {
        var k = M.ichimoku(d.h, d.l, d.c, +p.conv, +p.base, +p.span);
        return {
          cloud: { spanA: k.spanA, spanB: k.spanB, shift: k.shift, bull: C.vert, bear: C.rouge, alpha: 0.1 },
          lines: [
            line('conv', k.conversion, C.bleu, { width: 1.2, label: 'Tenkan' }),
            line('base', k.base, C.rouge, { width: 1.2, label: 'Kijun' }),
            line('lag', k.lagging, C.violet, { width: 1, dash: [3, 3], label: 'Chikou', shift: -k.shift })
          ]
        };
      }
    },
    {
      id: 'vwap', name: 'VWAP glissant', short: 'VWAP', cat: 'Volume', overlay: true,
      desc: 'Prix moyen pondéré par les volumes sur une fenêtre glissante. Référence du coût moyen des intervenants récents.',
      params: [
        { key: 'period', label: 'Périodes', type: 'number', min: 2, max: 250, def: 20 },
        { key: 'color', label: 'Couleur', type: 'color', def: C.rose }
      ],
      title: function (p) { return 'VWAP ' + p.period; },
      compute: function (d, p) {
        return { lines: [line('vwap', M.rollingVwap(d.h, d.l, d.c, d.v, +p.period), p.color, { width: 1.6, dash: [6, 4], label: 'VWAP' })] };
      }
    },
    {
      id: 'linreg', name: 'Canal de régression', short: 'REG', cat: 'Tendance', overlay: true,
      desc: 'Droite des moindres carrés encadrée à N écarts-types des résidus. Le R² indique dans quelle mesure la tendance linéaire décrit réellement les cours.',
      params: [
        { key: 'period', label: 'Périodes', type: 'number', min: 20, max: 500, def: 120 },
        { key: 'mult', label: 'Écarts-types', type: 'number', min: 0.5, max: 4, step: 0.1, def: 2 },
        { key: 'color', label: 'Couleur', type: 'color', def: C.violet }
      ],
      title: function (p) { return 'Régression ' + p.period; },
      compute: function (d, p) {
        var reg = M.linRegChannel(d.c, Math.min(+p.period, d.c.length), +p.mult);
        if (!reg) return {};
        var mid = M.nulls(d.c.length), up = M.nulls(d.c.length), lo = M.nulls(d.c.length);
        for (var i = reg.from; i <= reg.to; i++) {
          mid[i] = reg.at(i);
          up[i] = mid[i] + reg.mult * reg.sd;
          lo[i] = mid[i] - reg.mult * reg.sd;
        }
        return {
          bands: [{ upper: up, lower: lo, color: p.color, alpha: 0.05 }],
          lines: [
            line('up', up, p.color, { width: 1, dash: [3, 4], label: 'Sup.' }),
            line('mid', mid, p.color, { width: 1.5, label: 'Régression' }),
            line('lo', lo, p.color, { width: 1, dash: [3, 4], label: 'Inf.' })
          ],
          readout: function () { return reg.r2 == null ? null : 'R² ' + (reg.r2 * 100).toFixed(0) + '% · pente ' + reg.slope.toFixed(2) + '/séance'; }
        };
      }
    },
    {
      id: 'pivots', name: 'Points pivots', short: 'PP', cat: 'Niveaux', overlay: true,
      desc: 'Niveaux dérivés de la dernière séance complète. Très suivis en intraday, ils gardent une valeur de repère sur des marchés peu liquides.',
      params: [
        { key: 'method', label: 'Méthode', type: 'select', options: [{ value: 'classic', label: 'Classique' }, { value: 'fibonacci', label: 'Fibonacci' }], def: 'classic' }
      ],
      title: function () { return 'Points pivots'; },
      compute: function (d, p) {
        var i = d.c.length - 1;
        if (i < 1) return {};
        var pv = M.pivotPoints(d.h[i - 1], d.l[i - 1], d.c[i - 1], p.method);
        if (!pv) return {};
        return {
          levels: [
            { value: pv.r3, color: C.rouge, label: 'R3', dash: [2, 4] },
            { value: pv.r2, color: C.rouge, label: 'R2', dash: [4, 4] },
            { value: pv.r1, color: C.rouge, label: 'R1' },
            { value: pv.pivot, color: C.or, label: 'Pivot', width: 1.4 },
            { value: pv.s1, color: C.vert, label: 'S1' },
            { value: pv.s2, color: C.vert, label: 'S2', dash: [4, 4] },
            { value: pv.s3, color: C.vert, label: 'S3', dash: [2, 4] }
          ]
        };
      }
    },

    /* ───────────────── Panneaux ───────────────── */
    {
      id: 'volume', name: 'Volume', short: 'VOL', cat: 'Volume', overlay: false, height: 88,
      desc: 'Nombre de titres échangés. Un mouvement de prix sans volume est un mouvement fragile ; sur la BRVM, un volume nul signale simplement une absence de transaction.',
      params: [{ key: 'ma', label: 'Moyenne', type: 'number', min: 0, max: 100, def: 20 }],
      title: function () { return 'Volume'; },
      compute: function (d, p) {
        var out = {
          histogram: {
            values: d.v,
            colorAt: function (i) { return d.c[i] >= d.o[i] ? 'rgba(63,201,138,.45)' : 'rgba(240,100,94,.45)'; },
            baseline: 0
          },
          format: 'volume', zeroBase: true
        };
        if (+p.ma > 1) out.lines = [line('ma', M.sma(d.v, +p.ma), C.or, { width: 1.2, label: 'Moy. ' + p.ma })];
        return out;
      }
    },
    {
      id: 'rsi', name: 'RSI', short: 'RSI', cat: 'Momentum', overlay: false, height: 92,
      desc: 'Force relative des hausses face aux baisses, bornée de 0 à 100. Au-delà de 70 le titre est tendu, sous 30 il est déprimé — mais en tendance forte, un RSI extrême peut le rester longtemps.',
      params: [
        { key: 'period', label: 'Périodes', type: 'number', min: 2, max: 100, def: 14 },
        { key: 'high', label: 'Surachat', type: 'number', min: 50, max: 95, def: 70 },
        { key: 'low', label: 'Survente', type: 'number', min: 5, max: 50, def: 30 },
        { key: 'ma', label: 'Lissage', type: 'number', min: 0, max: 50, def: 0 }
      ],
      title: function (p) { return 'RSI ' + p.period; },
      compute: function (d, p) {
        var r = M.rsi(d.c, +p.period);
        var out = {
          scale: [0, 100],
          zones: [
            { from: +p.high, to: 100, color: 'rgba(240,100,94,.07)' },
            { from: 0, to: +p.low, color: 'rgba(63,201,138,.07)' }
          ],
          levels: [
            { value: +p.high, color: 'rgba(240,100,94,.35)', label: String(p.high) },
            { value: 50, color: 'rgba(200,162,78,.18)', dash: [3, 4] },
            { value: +p.low, color: 'rgba(63,201,138,.35)', label: String(p.low) }
          ],
          lines: [line('rsi', r, C.ambre, { width: 1.6, label: 'RSI' })]
        };
        if (+p.ma > 1) out.lines.push(line('ma', M.sma(r, +p.ma), C.bleu, { width: 1, label: 'MM ' + p.ma }));
        return out;
      }
    },
    {
      id: 'stochrsi', name: 'RSI stochastique', short: 'SRSI', cat: 'Momentum', overlay: false, height: 88,
      desc: 'Applique la formule du stochastique au RSI. Bien plus réactif que le RSI seul, donc plus bruité : à réserver aux entrées fines dans une tendance déjà identifiée.',
      params: [
        { key: 'rsiP', label: 'RSI', type: 'number', min: 2, max: 60, def: 14 },
        { key: 'stochP', label: 'Stochastique', type: 'number', min: 2, max: 60, def: 14 },
        { key: 'k', label: 'Lissage %K', type: 'number', min: 1, max: 20, def: 3 },
        { key: 'd', label: 'Lissage %D', type: 'number', min: 1, max: 20, def: 3 }
      ],
      title: function () { return 'RSI stochastique'; },
      compute: function (d, p) {
        var s = M.stochRsi(d.c, +p.rsiP, +p.stochP, +p.k, +p.d);
        return {
          scale: [0, 100],
          zones: [{ from: 80, to: 100, color: 'rgba(240,100,94,.07)' }, { from: 0, to: 20, color: 'rgba(63,201,138,.07)' }],
          levels: [{ value: 80, color: 'rgba(240,100,94,.3)' }, { value: 20, color: 'rgba(63,201,138,.3)' }],
          lines: [line('k', s.k, C.rose, { width: 1.4, label: '%K' }), line('d', s.d, C.bleu, { width: 1.2, label: '%D' })]
        };
      }
    },
    {
      id: 'stoch', name: 'Stochastique', short: 'STO', cat: 'Momentum', overlay: false, height: 88,
      desc: 'Situe la clôture dans l\'amplitude des N dernières séances. Le croisement %K/%D dans les zones extrêmes fournit le signal usuel.',
      params: [
        { key: 'k', label: '%K', type: 'number', min: 2, max: 100, def: 14 },
        { key: 'smooth', label: 'Lissage %K', type: 'number', min: 1, max: 20, def: 3 },
        { key: 'd', label: '%D', type: 'number', min: 1, max: 20, def: 3 }
      ],
      title: function (p) { return 'Stoch ' + p.k + ',' + p.smooth + ',' + p.d; },
      compute: function (d, p) {
        var s = M.stochastic(d.h, d.l, d.c, +p.k, +p.smooth, +p.d);
        return {
          scale: [0, 100],
          zones: [{ from: 80, to: 100, color: 'rgba(240,100,94,.07)' }, { from: 0, to: 20, color: 'rgba(63,201,138,.07)' }],
          levels: [{ value: 80, color: 'rgba(240,100,94,.3)' }, { value: 50, color: 'rgba(200,162,78,.15)', dash: [3, 4] }, { value: 20, color: 'rgba(63,201,138,.3)' }],
          lines: [line('k', s.k, C.rose, { width: 1.4, label: '%K' }), line('d', s.d, C.bleu, { width: 1.2, label: '%D' })]
        };
      }
    },
    {
      id: 'macd', name: 'MACD', short: 'MACD', cat: 'Momentum', overlay: false, height: 96,
      desc: 'Écart entre deux moyennes exponentielles, comparé à sa propre moyenne. L\'histogramme mesure l\'accélération : il se retourne avant le croisement des lignes.',
      params: [
        { key: 'fast', label: 'Rapide', type: 'number', min: 2, max: 100, def: 12 },
        { key: 'slow', label: 'Lente', type: 'number', min: 3, max: 200, def: 26 },
        { key: 'signal', label: 'Signal', type: 'number', min: 2, max: 50, def: 9 }
      ],
      title: function (p) { return 'MACD ' + p.fast + ',' + p.slow + ',' + p.signal; },
      compute: function (d, p) {
        var m = M.macd(d.c, +p.fast, +p.slow, +p.signal);
        return {
          histogram: {
            values: m.hist, baseline: 0,
            colorAt: function (i) {
              var v = m.hist[i], prev = m.hist[i - 1];
              if (!M.fin(v)) return 'transparent';
              var strong = !M.fin(prev) || Math.abs(v) >= Math.abs(prev);
              return v >= 0 ? (strong ? 'rgba(63,201,138,.6)' : 'rgba(63,201,138,.3)')
                : (strong ? 'rgba(240,100,94,.6)' : 'rgba(240,100,94,.3)');
            }
          },
          levels: [{ value: 0, color: 'rgba(200,162,78,.22)' }],
          lines: [line('macd', m.macd, C.bleu, { width: 1.4, label: 'MACD' }), line('sig', m.signal, C.rouge, { width: 1.2, label: 'Signal' })]
        };
      }
    },
    {
      id: 'adx', name: 'ADX / DMI', short: 'ADX', cat: 'Tendance', overlay: false, height: 88,
      desc: 'L\'ADX mesure la force d\'une tendance sans en donner le sens ; +DI et −DI donnent le sens. Sous 20, le marché n\'a pas de tendance exploitable.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 2, max: 100, def: 14 }],
      title: function (p) { return 'ADX ' + p.period; },
      compute: function (d, p) {
        var a = M.adx(d.h, d.l, d.c, +p.period);
        return {
          scale: [0, null],
          levels: [{ value: 25, color: 'rgba(200,162,78,.25)', dash: [4, 4], label: '25' }, { value: 20, color: 'rgba(138,133,120,.18)', dash: [2, 4] }],
          lines: [
            line('adx', a.adx, C.ambre, { width: 1.8, label: 'ADX' }),
            line('dip', a.diP, C.vert, { width: 1.1, label: '+DI' }),
            line('din', a.diN, C.rouge, { width: 1.1, label: '−DI' })
          ]
        };
      }
    },
    {
      id: 'cci', name: 'CCI', short: 'CCI', cat: 'Momentum', overlay: false, height: 88,
      desc: 'Écart du prix typique à sa moyenne, normalisé par la déviation moyenne. Au-delà de ±100, le mouvement sort de son régime habituel.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 2, max: 200, def: 20 }],
      title: function (p) { return 'CCI ' + p.period; },
      compute: function (d, p) {
        return {
          levels: [{ value: 100, color: 'rgba(240,100,94,.28)', label: '100' }, { value: 0, color: 'rgba(200,162,78,.15)', dash: [3, 4] }, { value: -100, color: 'rgba(63,201,138,.28)', label: '-100' }],
          lines: [line('cci', M.cci(d.h, d.l, d.c, +p.period), C.violet, { width: 1.5, label: 'CCI' })]
        };
      }
    },
    {
      id: 'mfi', name: 'Money Flow Index', short: 'MFI', cat: 'Volume', overlay: false, height: 88,
      desc: 'RSI pondéré par les volumes. Une divergence MFI/prix pèse plus lourd qu\'une divergence RSI, puisqu\'elle intègre l\'engagement financier.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 2, max: 100, def: 14 }],
      title: function (p) { return 'MFI ' + p.period; },
      compute: function (d, p) {
        return {
          scale: [0, 100],
          zones: [{ from: 80, to: 100, color: 'rgba(240,100,94,.07)' }, { from: 0, to: 20, color: 'rgba(63,201,138,.07)' }],
          levels: [{ value: 80, color: 'rgba(240,100,94,.3)' }, { value: 20, color: 'rgba(63,201,138,.3)' }],
          lines: [line('mfi', M.mfi(d.h, d.l, d.c, d.v, +p.period), C.cyan, { width: 1.5, label: 'MFI' })]
        };
      }
    },
    {
      id: 'obv', name: 'On-Balance Volume', short: 'OBV', cat: 'Volume', overlay: false, height: 82,
      desc: 'Cumule les volumes selon le sens de la séance. Sa pente confirme ou contredit celle du cours ; c\'est sa direction qui compte, jamais son niveau.',
      params: [{ key: 'ma', label: 'Moyenne', type: 'number', min: 0, max: 100, def: 20 }],
      title: function () { return 'OBV'; },
      compute: function (d, p) {
        var o = M.obv(d.c, d.v);
        var out = { format: 'volume', lines: [line('obv', o, C.vert, { width: 1.5, label: 'OBV', fill: 'rgba(63,201,138,.10)' })] };
        if (+p.ma > 1) out.lines.push(line('ma', M.sma(o, +p.ma), C.or, { width: 1, label: 'Moy.' }));
        return out;
      }
    },
    {
      id: 'cmf', name: 'Chaikin Money Flow', short: 'CMF', cat: 'Volume', overlay: false, height: 82,
      desc: 'Position de la clôture dans l\'amplitude de séance, pondérée par le volume. Durablement positif, il traduit une accumulation.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 2, max: 100, def: 20 }],
      title: function (p) { return 'CMF ' + p.period; },
      compute: function (d, p) {
        var c = M.cmf(d.h, d.l, d.c, d.v, +p.period);
        return {
          levels: [{ value: 0, color: 'rgba(200,162,78,.22)' }],
          histogram: {
            values: c, baseline: 0,
            colorAt: function (i) { return M.fin(c[i]) ? (c[i] >= 0 ? 'rgba(63,201,138,.5)' : 'rgba(240,100,94,.5)') : 'transparent'; }
          }
        };
      }
    },
    {
      id: 'atr', name: 'ATR', short: 'ATR', cat: 'Volatilité', overlay: false, height: 78,
      desc: 'Amplitude vraie moyenne, en francs CFA. Sert à dimensionner un stop : un stop plus serré qu\'un ATR sera emporté par le bruit ordinaire.',
      params: [
        { key: 'period', label: 'Périodes', type: 'number', min: 2, max: 100, def: 14 },
        { key: 'pct', label: 'En % du cours', type: 'bool', def: false }
      ],
      title: function (p) { return 'ATR ' + p.period; },
      compute: function (d, p) {
        var a = M.atr(d.h, d.l, d.c, +p.period);
        var vals = p.pct ? a.map(function (v, i) { return M.fin(v) && d.c[i] ? v / d.c[i] * 100 : null; }) : a;
        return { zeroBase: true, lines: [line('atr', vals, C.saumon, { width: 1.4, label: p.pct ? 'ATR %' : 'ATR', fill: 'rgba(251,143,106,.08)' })] };
      }
    },
    {
      id: 'willr', name: 'Williams %R', short: '%R', cat: 'Momentum', overlay: false, height: 82,
      desc: 'Miroir du stochastique, gradué de 0 à −100. Réagit vite, d\'où son usage comme filtre de timing plutôt que comme signal autonome.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 2, max: 100, def: 14 }],
      title: function (p) { return 'Williams %R ' + p.period; },
      compute: function (d, p) {
        return {
          scale: [-100, 0],
          levels: [{ value: -20, color: 'rgba(240,100,94,.28)' }, { value: -80, color: 'rgba(63,201,138,.28)' }],
          lines: [line('wr', M.williamsR(d.h, d.l, d.c, +p.period), C.rose, { width: 1.4, label: '%R' })]
        };
      }
    },
    {
      id: 'roc', name: 'Taux de variation', short: 'ROC', cat: 'Momentum', overlay: false, height: 78,
      desc: 'Variation en pourcentage sur N séances. Lecture directe du momentum, sans lissage ni normalisation.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 1, max: 250, def: 12 }],
      title: function (p) { return 'ROC ' + p.period; },
      compute: function (d, p) {
        var r = M.roc(d.c, +p.period);
        return {
          levels: [{ value: 0, color: 'rgba(200,162,78,.22)' }],
          histogram: { values: r, baseline: 0, colorAt: function (i) { return M.fin(r[i]) ? (r[i] >= 0 ? 'rgba(63,201,138,.5)' : 'rgba(240,100,94,.5)') : 'transparent'; } }
        };
      }
    },
    {
      id: 'trix', name: 'TRIX', short: 'TRIX', cat: 'Momentum', overlay: false, height: 78,
      desc: 'Variation d\'une moyenne exponentielle triplement lissée. Le triple lissage élimine presque tout le bruit, au prix d\'un retard assumé.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 2, max: 100, def: 15 }],
      title: function (p) { return 'TRIX ' + p.period; },
      compute: function (d, p) {
        var t = M.trix(d.c, +p.period);
        return {
          levels: [{ value: 0, color: 'rgba(200,162,78,.22)' }],
          lines: [line('trix', t, C.cyan, { width: 1.4, label: 'TRIX' }), line('sig', M.ema(t, 9), C.rouge, { width: 1, label: 'Signal' })]
        };
      }
    },
    {
      id: 'aroon', name: 'Aroon', short: 'ARO', cat: 'Tendance', overlay: false, height: 82,
      desc: 'Mesure l\'ancienneté du dernier extrême. Aroon haussier proche de 100 et baissier proche de 0 : la tendance est jeune et vigoureuse.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 5, max: 200, def: 25 }],
      title: function (p) { return 'Aroon ' + p.period; },
      compute: function (d, p) {
        var a = M.aroon(d.h, d.l, +p.period);
        return {
          scale: [0, 100],
          levels: [{ value: 70, color: 'rgba(200,162,78,.18)', dash: [3, 4] }, { value: 30, color: 'rgba(200,162,78,.18)', dash: [3, 4] }],
          lines: [line('up', a.up, C.vert, { width: 1.3, label: 'Haussier' }), line('dn', a.down, C.rouge, { width: 1.3, label: 'Baissier' })]
        };
      }
    },
    {
      id: 'uo', name: 'Ultimate Oscillator', short: 'UO', cat: 'Momentum', overlay: false, height: 82,
      desc: 'Combine trois horizons de momentum pour limiter les fausses divergences propres aux oscillateurs à fenêtre unique.',
      params: [
        { key: 's1', label: 'Court', type: 'number', min: 2, max: 30, def: 7 },
        { key: 's2', label: 'Moyen', type: 'number', min: 5, max: 60, def: 14 },
        { key: 's3', label: 'Long', type: 'number', min: 10, max: 120, def: 28 }
      ],
      title: function () { return 'Ultimate Oscillator'; },
      compute: function (d, p) {
        return {
          scale: [0, 100],
          levels: [{ value: 70, color: 'rgba(240,100,94,.28)' }, { value: 50, color: 'rgba(200,162,78,.15)', dash: [3, 4] }, { value: 30, color: 'rgba(63,201,138,.28)' }],
          lines: [line('uo', M.ultimateOscillator(d.h, d.l, d.c, +p.s1, +p.s2, +p.s3), C.violet, { width: 1.4, label: 'UO' })]
        };
      }
    },
    {
      id: 'hvol', name: 'Volatilité historique', short: 'HV', cat: 'Volatilité', overlay: false, height: 78,
      desc: 'Écart-type annualisé des rendements journaliers, en pourcentage. Situe le régime de risque courant par rapport à son propre passé.',
      params: [{ key: 'period', label: 'Périodes', type: 'number', min: 5, max: 250, def: 30 }],
      title: function (p) { return 'Volatilité ' + p.period; },
      compute: function (d, p) {
        var n = +p.period;
        var lr = M.nulls(d.c.length);
        for (var i = 1; i < d.c.length; i++) {
          if (M.fin(d.c[i]) && M.fin(d.c[i - 1]) && d.c[i - 1] > 0) lr[i] = Math.log(d.c[i] / d.c[i - 1]);
        }
        var out = M.nulls(d.c.length);
        for (var k = n; k < d.c.length; k++) {
          var w = lr.slice(k - n + 1, k + 1);
          var sd = M.stdev(w);
          if (M.fin(sd)) out[k] = sd * Math.sqrt(M.SEANCES_AN) * 100;
        }
        return { zeroBase: true, lines: [line('hv', out, C.ambre, { width: 1.4, label: 'Vol. ann. %', fill: 'rgba(240,167,42,.08)' })] };
      }
    }
  ];

  var BY_ID = {};
  DEFS.forEach(function (d) { BY_ID[d.id] = d; });

  function defaults(id) {
    var def = BY_ID[id];
    if (!def) return {};
    var p = {};
    (def.params || []).forEach(function (x) { p[x.key] = x.def; });
    return p;
  }

  /* Réglages prêts à l'emploi. Chaque profil est un point de départ
     assumé, pas une recommandation : l'utilisateur reste libre. */
  var PRESETS = {
    decouverte: {
      label: 'Découverte',
      hint: 'Le cours, sa moyenne longue et le volume. De quoi lire une tendance sans être noyé.',
      indicators: [
        { id: 'ma', params: { kind: 'sma', period: 50, source: 'close', color: C.bleu } },
        { id: 'volume', params: { ma: 20 } }
      ]
    },
    tendance: {
      label: 'Suivi de tendance',
      hint: 'Trois moyennes, SuperTrend et ADX : direction, stop suiveur et force de la tendance.',
      indicators: [
        { id: 'ma', params: { kind: 'ema', period: 20, source: 'close', color: C.bleu } },
        { id: 'ma', params: { kind: 'sma', period: 50, source: 'close', color: C.ambre } },
        { id: 'ma', params: { kind: 'sma', period: 200, source: 'close', color: C.violet } },
        { id: 'supertrend', params: { period: 10, mult: 3 } },
        { id: 'volume', params: { ma: 20 } },
        { id: 'adx', params: { period: 14 } }
      ]
    },
    momentum: {
      label: 'Momentum',
      hint: 'RSI, MACD et stochastique pour situer l\'essoufflement et repérer les divergences.',
      indicators: [
        { id: 'ma', params: { kind: 'ema', period: 20, source: 'close', color: C.bleu } },
        { id: 'volume', params: { ma: 20 } },
        { id: 'rsi', params: { period: 14, high: 70, low: 30, ma: 0 } },
        { id: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
        { id: 'stoch', params: { k: 14, smooth: 3, d: 3 } }
      ]
    },
    volatilite: {
      label: 'Volatilité',
      hint: 'Bollinger, Keltner et ATR : repérer les compressions et calibrer les stops.',
      indicators: [
        { id: 'bb', params: { period: 20, mult: 2, source: 'close', color: C.or } },
        { id: 'keltner', params: { period: 20, mult: 2, color: C.turquoise } },
        { id: 'volume', params: { ma: 20 } },
        { id: 'atr', params: { period: 14, pct: true } },
        { id: 'hvol', params: { period: 30 } }
      ]
    },
    volume: {
      label: 'Flux et volumes',
      hint: 'OBV, MFI et CMF : suivre l\'argent plutôt que le prix.',
      indicators: [
        { id: 'vwap', params: { period: 20, color: C.rose } },
        { id: 'volume', params: { ma: 20 } },
        { id: 'obv', params: { ma: 20 } },
        { id: 'mfi', params: { period: 14 } },
        { id: 'cmf', params: { period: 20 } }
      ]
    },
    complet: {
      label: 'Analyse complète',
      hint: 'Ichimoku, Bollinger, volumes, RSI, MACD et ADX. Dense, pour un poste de travail large.',
      indicators: [
        { id: 'ichimoku', params: { conv: 9, base: 26, span: 52 } },
        { id: 'bb', params: { period: 20, mult: 2, source: 'close', color: C.or } },
        { id: 'ma', params: { kind: 'sma', period: 200, source: 'close', color: C.violet } },
        { id: 'volume', params: { ma: 20 } },
        { id: 'rsi', params: { period: 14, high: 70, low: 30, ma: 0 } },
        { id: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
        { id: 'adx', params: { period: 14 } }
      ]
    }
  };

  global.ATIndicators = {
    COLORS: C,
    SOURCES: SOURCES,
    MA_KINDS: MA_KINDS,
    list: DEFS,
    byId: function (id) { return BY_ID[id]; },
    defaults: defaults,
    source: src,
    presets: PRESETS,
    categories: function () {
      var seen = [], out = [];
      DEFS.forEach(function (d) { if (seen.indexOf(d.cat) < 0) { seen.push(d.cat); out.push(d.cat); } });
      return out;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
