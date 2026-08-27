// THE CAPITAL — Correction des métriques Suivi
(function () {
  'use strict';
  if (window.__TC_SUIVI_METRICS_FIX__) return;
  window.__TC_SUIVI_METRICS_FIX__ = true;

  const token = () => { try { return JSON.parse(localStorage.getItem('tc_session') || 'null')?.access_token || ''; } catch (_) { return ''; } };
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const money = v => `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString('fr-FR')} FCFA`;
  async function get(url) {
    const headers = { Accept: 'application/json' }, t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch(url, { headers, cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [];
  }
  async function refresh() {
    if (!document.getElementById('view-suivi')) return;
    try {
      const [tx, cours] = await Promise.all([get('/api/portfolio-transactions'), get('/api/marche?type=cours&limit=1000')]);
      const rows = [...tx].sort((a,b) => String(a.date_transaction || '').localeCompare(String(b.date_transaction || '')) || String(a.id || '').localeCompare(String(b.id || '')));
      const lots = new Map();
      let capital = 0, cash = 0;
      for (const x of rows) {
        const t = String(x.type || '').toUpperCase();
        const q = n(x.quantite), p = n(x.cours), net = n(x.montant_net);
        if (t === 'DEPOT') { capital += Math.abs(net); cash += Math.abs(net); }
        else if (t === 'RETRAIT') { capital -= Math.abs(net); cash -= Math.abs(net); }
        else if (t === 'DIVIDENDE') cash += Math.abs(net);
        else if (t === 'ACHAT') { cash -= Math.abs(net); if (!lots.has(x.ticker)) lots.set(x.ticker, []); lots.get(x.ticker).push({ q, p }); }
        else if (t === 'VENTE') {
          cash += Math.abs(net);
          let rem = q, bucket = lots.get(x.ticker) || [];
          while (rem > 0 && bucket.length) { const lot = bucket[0], take = Math.min(rem, lot.q); lot.q -= take; rem -= take; if (lot.q <= 0) bucket.shift(); }
        }
      }
      const priceMap = new Map(cours.map(c => [String(c.ticker || '').toUpperCase(), n(c.cours_cloture ?? c.cours ?? c.price)]));
      let market = 0;
      for (const [ticker, bucket] of lots) for (const lot of bucket) market += lot.q * (priceMap.get(String(ticker).toUpperCase()) || lot.p);
      const performance = cash + market - capital;
      const el = document.getElementById('tc-net-performance');
      if (el) { el.textContent = money(performance); el.className = 'tc-suivi-value ' + (performance > 0 ? 'tc-up' : performance < 0 ? 'tc-down' : ''); }
    } catch (e) { console.warn('[SUIVI] métriques:', e.message); }
  }
  window.addEventListener('portfolio:updated', refresh);
  window.addEventListener('hashchange', () => setTimeout(refresh, 80));
  setInterval(refresh, 60000);
  setTimeout(refresh, 500);
})();
