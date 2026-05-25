// ═══════════════════════════════════════
// AT — Signal Generation
// ═══════════════════════════════════════

// ── Signaux ──
function atUpdateSignals(closes, highs, lows, vols, liveVar, liveC) {
  const n = closes.length;
  const sma20 = atSMA(closes,20), sma50 = atSMA(closes,50);
  const lc = closes[n-1], lsma20 = sma20[n-1], lsma50 = sma50[n-1];

  const trend = lsma20 && lsma50 ? (lc > lsma20 && lsma20 > lsma50 ? ['HAUSSIÈRE','b'] : lc < lsma20 && lsma20 < lsma50 ? ['BAISSIÈRE','s'] : ['LATÉRALE','n']) : ['—','n'];
  const rsi = atRSI(closes); const lr = rsi[n-1];
  const mom = lr > 65 ? ['ACHAT FORT','b'] : lr > 55 ? ['ACHAT','b'] : lr < 35 ? ['VENTE','s'] : lr < 45 ? ['NEUTRE-','n'] : ['NEUTRE','n'];
  const bb = atBB(closes); const lb = bb[n-1];
  const volatility = lb.upper ? ((lb.upper-lb.lower)/lb.mid*100) > 5 ? ['ÉLEVÉE','s'] : ((lb.upper-lb.lower)/lb.mid*100) < 1.5 ? ['COMPRESSION','n'] : ['NORMALE','n'] : ['—','n'];
  const volSMA = atSMA(vols,20); const lv = vols[n-1], lvsma = volSMA[n-1];
  const volTrend = lvsma && lv > lvsma*1.5 ? (lc > closes[n-2] ? ['FORT ACHAT','b'] : ['DISTRIBUTION','s']) : ['NORMAL','n'];
  const rsiSig = lr > 70 ? ['SURACHAT','s'] : lr < 30 ? ['SURVENTE','b'] : [`${lr.toFixed(1)}`,'n'];
  const macd = atMACD(closes); const lm = macd[n-1], lm2 = macd[n-2];
  const macdSig = lm && lm2 ? (lm.macd > lm.signal && lm2.macd <= lm2.signal ? ['CROISEMENT ↑','b'] : lm.hist > 0 ? ['HAUSSIER','b'] : ['BAISSIER','s']) : ['—','n'];
  const st = atStoch(highs,lows,closes); const sk=st.K[n-1], sd=st.D[n-1];
  const stochSig = sk && sd ? [`${sk.toFixed(0)}/${sd.toFixed(0)}`, sk>80?'s':sk<20?'b':'n'] : ['—','n'];

  let score = 0;
  if (trend[1]==='b') score+=2; if (trend[1]==='s') score-=2;
  if (mom[1]==='b') score+=1; if (mom[1]==='s') score-=1;
  if (volTrend[1]==='b') score+=1; if (volTrend[1]==='s') score-=1;
  if (macdSig[1]==='b') score+=1; if (macdSig[1]==='s') score-=1;
  const glob = score >= 3 ? ['ACHAT FORT','b'] : score >= 1 ? ['ACHAT','b'] : score <= -3 ? ['VENTE FORTE','s'] : score <= -1 ? ['VENTE','s'] : ['NEUTRE','n'];

  [['sigGlob',glob],['sigTrend',trend],['sigMom',mom],['sigVol',volatility],['sigVolTrend',volTrend],['sigRSI',rsiSig],['sigMACD',macdSig],['sigStoch',stochSig]].forEach(([id,[label,cls]])=>{
    const el = document.getElementById(id); if (!el) return;
    el.textContent = label;
    el.className = `sig-badge ${cls==='b'?'sig-b':cls==='s'?'sig-s':'sig-n'}`;
  });
}
