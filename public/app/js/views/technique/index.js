// ═══════════════════════════════════════
// AT — Main Entry Point (CORRIGE — garde anti-double + window.AT)
// ═══════════════════════════════════════
if (window.__atIndexLoaded) {
  console.warn('[AT INDEX] Deja charge, skip.');
} else {
  window.__atIndexLoaded = true;

  // AT Configuration Object
  const AT = {
    ticker: '', type: 'line', period: 252, interval: 'daily',
    hist: [], draws: [], drawMode: 'cursor',
    trendPts: [], channelPts: [], rectPts: [],
    zoom: { start: 0, end: 1 }, panning: false, panStart: 0, panZoomStart: null,
    focus: false,
    activeInds: {
      sma20: { on: false, color: '#60a5fa', label: 'SMA 20', sub: null },
      sma50: { on: false, color: '#f87171', label: 'SMA 50', sub: null },
      sma200: { on: false, color: '#a78bfa', label: 'SMA 200', sub: null },
      ema12: { on: false, color: '#4ade80', label: 'EMA 12', sub: null },
      ema26: { on: false, color: '#fb923c', label: 'EMA 26', sub: null },
      bb: { on: false, color: 'rgba(184,150,78,0.5)', label: 'Bollinger (20)', sub: null },
      vwap: { on: false, color: '#e879f9', label: 'VWAP', sub: null },
      ichimoku: { on: false, color: '#06b6d4', label: 'Ichimoku', sub: null },
      vol: { on: false, color: '#4ade80', label: 'Volume', sub: 'subVol' },
      rsi: { on: false, color: '#fb923c', label: 'RSI (14)', sub: 'subRSI' },
      macd: { on: false, color: '#60a5fa', label: 'MACD', sub: 'subMACD' },
      stoch: { on: false, color: '#e879f9', label: 'Stochastique', sub: 'subStoch' },
      adx: { on: false, color: '#f59e0b', label: 'ADX (14)', sub: 'subADX' },
      cci: { on: false, color: '#a78bfa', label: 'CCI (20)', sub: 'subCCI' },
      obv: { on: false, color: '#4ade80', label: 'OBV', sub: 'subOBV' },
    },
    histCache: {},
    compareData: null,
    compareTicker: '',
    rafId: null,
  };

  // Exposer AT globalement pour crosshair.js, indicators.js, draw.js, etc.
  window.AT = AT;

  const IND_CATALOG = [
    { cat: 'Moyennes Mobiles', items: [
      { key: 'sma20', name: 'SMA 20', desc: 'Moyenne mobile simple 20 periodes' },
      { key: 'sma50', name: 'SMA 50', desc: 'Moyenne mobile simple 50 periodes' },
      { key: 'sma200', name: 'SMA 200', desc: 'Moyenne mobile simple 200 periodes' },
      { key: 'ema12', name: 'EMA 12', desc: 'Moyenne mobile exponentielle 12' },
      { key: 'ema26', name: 'EMA 26', desc: 'Moyenne mobile exponentielle 26' },
    ]},
    { cat: 'Volatilite', items: [
      { key: 'bb', name: 'Bollinger Bands', desc: 'Bandes SMA plusminus 2 ecarts-types' },
      { key: 'vwap', name: 'VWAP', desc: 'Prix moyen pondere par le volume' },
      { key: 'ichimoku', name: 'Ichimoku', desc: 'Nuage Ichimoku Kinko Hyo' },
    ]},
    { cat: 'Volume', items: [
      { key: 'vol', name: 'Volume', desc: 'Barres de volume colorees' },
      { key: 'obv', name: 'OBV', desc: 'On-Balance Volume' },
    ]},
    { cat: 'Momentum', items: [
      { key: 'rsi', name: 'RSI (14)', desc: 'Relative Strength Index' },
      { key: 'macd', name: 'MACD', desc: 'Moving Average Convergence Divergence' },
      { key: 'stoch', name: 'Stochastique', desc: '%K / %D (14,3)' },
      { key: 'cci', name: 'CCI (20)', desc: 'Commodity Channel Index' },
      { key: 'adx', name: 'ADX (14)', desc: 'Average Directional Index' },
    ]},
  ];

  // Exposer IND_CATALOG globalement
  window.IND_CATALOG = IND_CATALOG;

  // ── Formatage volume lisible ──
  function fmtVol(n) {
    if (n == null || isNaN(+n)) return '—';
    const v = +n;
    if (v >= 1e9) return (v/1e9).toFixed(2) + ' Mrd';
    if (v >= 1e6) return (v/1e6).toFixed(1) + ' M';
    if (v >= 1e3) return (v/1e3).toFixed(0) + ' k';
    return v.toLocaleString('fr-FR');
  }
  window.fmtVol = fmtVol;

  // ── Formatage date complete avec heure ──
  function fmtDateFull(d) {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
  window.fmtDateFull = fmtDateFull;

  // ── Chargement ticker ──
  async function atLoadTicker() {
    const ticker = document.getElementById('atTicker').value;
    if (!ticker) return;
    AT.ticker = ticker;
    AT.zoom = { start: 0, end: 1 };
    document.getElementById('atOhlcTicker').textContent = ticker;

    let raw = [];

    if (typeof allCoursHistorique !== 'undefined' && Array.isArray(allCoursHistorique) && allCoursHistorique.length > 0) {
      raw = allCoursHistorique.filter(h => h.ticker === ticker);
      console.log(`[AT] ${raw.length} points depuis allCoursHistorique pour ${ticker}`);
    }

    if (!raw.length && AT.histCache[ticker]) {
      raw = AT.histCache[ticker];
      console.log(`[AT] ${raw.length} points depuis cache pour ${ticker}`);
    }

    if (!raw.length) {
      try {
        raw = await sb('historique', { ticker: `eq.${ticker}`, order: 'date_seance.desc', limit: 3000 });
        if (Array.isArray(raw)) raw = raw.reverse();
        if (Array.isArray(raw) && raw.length) {
          AT.histCache[ticker] = raw;
          console.log(`[AT] ${raw.length} points depuis API pour ${ticker}`);
        } else {
          console.warn(`[AT] API historique vide pour ${ticker}`);
        }
      } catch(e) {
        console.error(`[AT] Erreur API historique:`, e);
        toast('Historique indisponible : ' + e.message, 'error');
        raw = [];
      }
    }

    AT.hist = atExtract(Array.isArray(raw) ? raw : []);

    if (!AT.hist.length) {
      const cur = allCours.find(c => c.ticker === ticker);
      if (cur) {
        AT.hist = [{ date: cur.date_seance || new Date().toISOString().slice(0,10), o: +cur.cours, h: +cur.cours, l: +cur.cours, c: +cur.cours, v: +cur.volume || 0 }];
        toast('Historique limite — cours actuel uniquement', 'warn');
      } else { toast('Aucune donnee pour ' + ticker, 'error'); return; }
    }

    atRender();
    atUpdateWatchlist();
  }
  window.atLoadTicker = atLoadTicker;

  // ── Setters ──
  function atSetType(t, btn) {
    AT.type = t;
    document.querySelectorAll('[id^="atBtn"]').forEach(b => { if(['atBtnLine','atBtnCandle','atBtnHA','atBtnBar'].includes(b.id)) b.classList.remove('on'); });
    if(btn) btn.classList.add('on');
    atRender();
  }
  window.atSetType = atSetType;

  function atSetPeriod(n, btn) {
    AT.period = n;
    document.querySelectorAll('.at-toolbar .at-btn').forEach(b => { if([5,20,60,120,252,504,99999].map(String).some(v => b.textContent.includes(v.replace('99999','Max'))||b.textContent===v+'J'||b.textContent==='Max')) b.classList.remove('on'); });
    if(btn) btn.classList.add('on');

    if (n === 99999 && AT.ticker) {
      delete AT.histCache[AT.ticker];
      atLoadTicker();
    } else {
      atRender();
    }
  }
  window.atSetPeriod = atSetPeriod;

  function atSetInterval(v, btn) {
    AT.interval = v;
    document.querySelectorAll('.at-toolbar .at-btn').forEach(b => { if(['Daily','Hebdo','Mensuel'].includes(b.textContent)) b.classList.remove('on'); });
    if(btn) btn.classList.add('on');
    atRender();
  }
  window.atSetInterval = atSetInterval;

  function atSetDraw(mode) {
    AT.drawMode = mode;
    AT.trendPts = []; AT.channelPts = []; AT.rectPts = [];
    document.querySelectorAll('[id^="atTool"],[id^="dBtn"]').forEach(el => el.classList.remove('on'));
    const toolMap = { cursor: ['atToolCursor','dBtnCursor'], hline: ['atToolHline','dBtnHLine'], trend: ['atToolTrend','dBtnTrend'], channel: ['atToolChannel','dBtnChannel'], rect: ['atToolRect','dBtnRect'], fib: ['atToolFib','dBtnFib'], pitch: ['atToolPitch','dBtnPitch'], text: ['atToolText','dBtnText'] };
    (toolMap[mode] || []).forEach(id => document.getElementById(id)?.classList.add('on'));
    const msgs = { 
      cursor: '', 
      hline: 'Cliquez pour placer un Support / Resistance horizontal', 
      trend: 'Cliquez point 1 de la ligne de tendance', 
      channel: 'Cliquez point 1 du canal de tendance', 
      rect: 'Cliquez coin 1 de la zone de prix', 
      fib: 'Cliquez bas puis haut pour les retracements de Fibonacci', 
      pitch: 'Cliquez 3 points pour le Pitchfork d'Andrews', 
      text: 'Cliquez pour ajouter une annotation texte' 
    };
    document.getElementById('atDrawStatus').textContent = msgs[mode] || '';
  }
  window.atSetDraw = atSetDraw;

  function atClearDrawings() { AT.draws = []; atRender(); toast('Dessins effaces', 'success'); }
  window.atClearDrawings = atClearDrawings;

  // ── Donnees visibles ──
  function atVisibleData() {
    let data = atAggregate(AT.hist, AT.interval);
    if (AT.period !== 99999) data = data.slice(-AT.period);
    const n = data.length;
    const s = Math.floor(AT.zoom.start * n);
    const e = Math.ceil(AT.zoom.end * n);
    return data.slice(Math.max(0, s), Math.max(1, e));
  }
  window.atVisibleData = atVisibleData;

  // ── Init AT ──
  function atInit() {
    const byTicker = {};
    allCours.forEach(c => { if(!byTicker[c.ticker]) byTicker[c.ticker]=c; });
    const tickers = Object.keys(byTicker).sort();
    const sel = document.getElementById('atTicker');
    if(sel) sel.innerHTML='<option value="">Ticker...</option>'+tickers.map(t=>`<option value="${t}">${t}</option>`).join('');

    document.getElementById('atBtnLine')?.classList.add('on');

    atInitCrosshair();
    atInitNav();
    atUpdateWatchlist();
    const ro = new ResizeObserver(() => { if(AT.hist.length) atRender(); });
    const wrap = document.getElementById('atWrap');
    if(wrap) ro.observe(wrap);
  }
  window.atInit = atInit;
}
