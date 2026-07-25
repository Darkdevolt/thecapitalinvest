// SCREENER MODULE — Advanced filtering
(function() {
  if (window.__TC_SCREENER_LOADED__) return;
  window.__TC_SCREENER_LOADED__ = true;

  let screenerData = [];
  const fmt = n => n != null ? parseFloat(n).toLocaleString('fr-FR') : '—';

  async function runScreener() {
    if (!screenerData.length) {
      const [cours, fins] = await Promise.allSettled([
        (window.sbQuery ? window.sbQuery('cours', { order: 'date_seance.desc', limit: 300 }) : Promise.resolve([])),
        (window.sbQuery ? window.sbQuery('financials', { order: 'annee.desc', limit: 300 }) : Promise.resolve([]))
      ]);
      const allCours = cours.status === 'fulfilled' ? (cours.value || []) : [];
      const allFins = fins.status === 'fulfilled' ? (fins.value || []) : [];
      
      const byTicker = {};
      allCours.forEach(c => { if (!byTicker[c.ticker]) byTicker[c.ticker] = { ...c }; });
      allFins.forEach(f => {
        if (byTicker[f.ticker]) {
          byTicker[f.ticker] = { ...byTicker[f.ticker], ...f };
        }
      });
      screenerData = Object.values(byTicker);
    }

    const filters = {
      per: document.getElementById('filt-per').checked,
      pb: document.getElementById('filt-pb').checked,
      rdt: document.getElementById('filt-rdt').checked,
      ev: document.getElementById('filt-ev').checked,
      roe: document.getElementById('filt-roe').checked,
      roa: document.getElementById('filt-roa').checked,
      marge: document.getElementById('filt-marge').checked,
      var1m: document.getElementById('filt-var1m').checked,
      var3m: document.getElementById('filt-var3m').checked,
      var1a: document.getElementById('filt-var1a').checked,
      volat: document.getElementById('filt-volat').checked,
      sharpe: document.getElementById('filt-sharpe').checked,
      beta: document.getElementById('filt-beta').checked,
      dettes: document.getElementById('filt-dettes').checked,
      secteur: document.getElementById('filt-secteur').value,
      pays: document.getElementById('filt-pays').value,
    };

    let results = screenerData.filter(d => {
      const cp = parseFloat(d.cours) || 0;
      const bpa = parseFloat(d.bpa) || 0;
      const per = bpa > 0 ? cp / bpa : 999;
      const fp = parseFloat(d.fonds_propres) || 0;
      const na = parseFloat(d.nombre_actions) || 1;
      const pan = fp / na;
      const pb = pan > 0 ? cp / pan : 999;
      const dpa = parseFloat(d.dpa) || 0;
      const rdt = cp > 0 ? (dpa / cp) * 100 : 0;
      const roe = fp > 0 ? (parseFloat(d.resultat_net) || 0) / fp * 100 : 0;
      const roa = (parseFloat(d.total_actif) || 1) > 0 ? (parseFloat(d.resultat_net) || 0) / parseFloat(d.total_actif) * 100 : 0;
      const ca = parseFloat(d.chiffre_affaires) || 1;
      const rn = parseFloat(d.resultat_net) || 0;
      const marge = ca > 0 ? rn / ca * 100 : 0;
      const dettes = parseFloat(d.dettes_financieres) || 0;
      const ratioDette = fp > 0 ? dettes / fp : 999;

      if (filters.per && per >= 15) return false;
      if (filters.pb && pb >= 2) return false;
      if (filters.rdt && rdt <= 5) return false;
      if (filters.ev) return false;
      if (filters.roe && roe <= 15) return false;
      if (filters.roa && roa <= 5) return false;
      if (filters.marge && marge <= 10) return false;
      if (filters.var1m && (parseFloat(d.variation_1m) || 0) <= 5) return false;
      if (filters.var3m && (parseFloat(d.variation_3m) || 0) <= 10) return false;
      if (filters.var1a && (parseFloat(d.variation_1a) || 0) <= 20) return false;
      if (filters.volat && (parseFloat(d.volatilite) || 100) >= 30) return false;
      if (filters.sharpe && (parseFloat(d.sharpe) || 0) <= 1) return false;
      if (filters.beta && (parseFloat(d.beta) || 2) >= 1) return false;
      if (filters.dettes && ratioDette >= 1) return false;
      if (filters.secteur && (window.getSector ? window.getSector(d.ticker) : '') !== filters.secteur) return false;
      if (filters.pays && (d.pays || '') !== filters.pays) return false;

      return true;
    });

    results = results.map(d => {
      const cp = parseFloat(d.cours) || 0;
      const bpa = parseFloat(d.bpa) || 0;
      const per = bpa > 0 ? cp / bpa : 999;
      const fp = parseFloat(d.fonds_propres) || 0;
      const na = parseFloat(d.nombre_actions) || 1;
      const pb = (fp / na) > 0 ? cp / (fp / na) : 999;
      const dpa = parseFloat(d.dpa) || 0;
      const rdt = cp > 0 ? (dpa / cp) * 100 : 0;
      const roe = fp > 0 ? (parseFloat(d.resultat_net) || 0) / fp * 100 : 0;
      
      let score = 0;
      if (per < 10) score += 20; else if (per < 15) score += 10;
      if (pb < 1.5) score += 15; else if (pb < 2) score += 8;
      if (rdt > 5) score += 15; else if (rdt > 3) score += 8;
      if (roe > 20) score += 20; else if (roe > 15) score += 12;
      if (parseFloat(d.variation_1a) > 20) score += 15;
      if (parseFloat(d.sharpe) > 1) score += 15;

      return { ...d, per: per.toFixed(1), pb: pb.toFixed(2), rdt: rdt.toFixed(2), roe: roe.toFixed(1), score };
    }).sort((a, b) => b.score - a.score);

    const countEl = document.getElementById('screener-count');
    if(countEl) countEl.textContent = `${results.length} résultat${results.length > 1 ? 's' : ''}`;

    const resultsEl = document.getElementById('screener-results');
    if(resultsEl) {
      resultsEl.innerHTML = results.length
        ? results.map(r => `<tr>
            <td><span style="font-family:var(--mono);font-size:12px;color:var(--gold);font-weight:500">${r.ticker}</span></td>
            <td style="font-size:12px;color:var(--cream)">${r.nom || r.ticker}</td>
            <td class="right">${fmt(r.cours)}</td>
            <td class="right">${r.per}</td>
            <td class="right">${r.pb}</td>
            <td class="right" style="color:${parseFloat(r.rdt)>5?'var(--green)':'var(--muted)'">${r.rdt}%</td>
            <td class="right">${r.roe}%</td>
            <td class="right">${fmt(r.variation_1a)}%</td>
            <td class="right">${fmt(r.sharpe)}</td>
            <td><span class="sector-tag">${(window.getSector ? window.getSector(r.ticker) : '')}</span></td>
            <td><span class="score-badge" style="color:${r.score>=70?'var(--green)':r.score>=40?'var(--gold)':'var(--red)'">${r.score}</span></td>
          </tr>`).join('')
        : '<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--dim)">Aucun titre ne correspond à vos critères</td></tr>';
    }
  }

  function resetFilters() {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('select').forEach(s => s.value = '');
    runScreener();
  }

  function exportResults() {
    const rows = document.querySelectorAll('#screener-results tr');
    let csv = 'Ticker,Société,Cours,PER,PB,DivYield,ROE,Perf1A,Sharpe,Secteur,Score\n';
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 1) {
        csv += Array.from(cells).map(c => c.textContent.trim()).join(',') + '\n';
      }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'screener_brvm.csv'; a.click();
  }

  window.runScreener = runScreener;
  window.resetFilters = resetFilters;
  window.exportResults = exportResults;
  console.log('[SCREENER] Charge avec succes');
})();
