// ═══════════════════════════════════════
// AT — Export (PNG, Report)
// ═══════════════════════════════════════

// ── Export ──
function atExportPNG() {
  const el = document.getElementById('cvMain'); if (!el) return;
  const a = document.createElement('a');
  a.download = `${AT.ticker||'chart'}_${new Date().toISOString().slice(0,10)}.png`;
  a.href = el.toDataURL('image/png'); a.click();
  toast('Graphique exporté en PNG', 'success');
}
function atExportReport() {
  if (!AT.ticker) { toast('Aucun ticker sélectionné', 'warn'); return; }
  const data = atVisibleData(); if (!data.length) return;
  const closes = data.map(d=>d.c);
  const n = closes.length;
  const rsi = atRSI(closes)[n-1];
  const sma20 = atSMA(closes,20)[n-1], sma50 = atSMA(closes,50)[n-1];
  const macd = atMACD(closes)[n-1];
  const report = `RAPPORT ANALYSE TECHNIQUE — THE CAPITAL\n${'═'.repeat(50)}\nTicker : ${AT.ticker}\nDate : ${new Date().toLocaleString('fr-FR')}\nPériode : ${AT.period===99999?'Max':AT.period+' séances'} · Intervalle : ${AT.interval}\nType : ${AT.type}\n\n${'─'.repeat(40)}\nDONNÉES DERNIER COURS\n${'─'.repeat(40)}\nClôture : ${fmt(data[n-1].c)} FCFA\nOuverture : ${fmt(data[n-1].o)} FCFA\nHaut : ${fmt(data[n-1].h)} FCFA\nBas : ${fmt(data[n-1].l)} FCFA\nVolume : ${fmt(data[n-1].v)}\n\n${'─'.repeat(40)}\nINDICATEURS\n${'─'.repeat(40)}\nRSI (14) : ${rsi?.toFixed(2)||'—'}\nSMA 20 : ${sma20?fmt(sma20):'—'}\nSMA 50 : ${sma50?fmt(sma50):'—'}\nMACD : ${macd?macd.macd.toFixed(2):'—'} · Signal : ${macd?macd.signal.toFixed(2):'—'}\n\n${'─'.repeat(40)}\nSIGNAUX\n${'─'.repeat(40)}\n${['sigGlob','sigTrend','sigMom','sigVol','sigVolTrend','sigRSI','sigMACD','sigStoch'].map(id=>{ const el=document.getElementById(id); return (id.replace('sig','')+' : '+(el?.textContent||'—')); }).join('\n')}\n\n${'═'.repeat(50)}\nGénéré par The Capital — Intelligence Financière BRVM`;
  const blob = new Blob([report],{type:'text/plain;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`rapport_${AT.ticker}_${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('Rapport exporté', 'success');
}
