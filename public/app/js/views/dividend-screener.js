// THE CAPITAL, Dividend Screener
// Valeur propre par rapport au Screener principal (screener.js, qui a déjà une
// colonne rendement) : trajectoire du dividende sur plusieurs exercices,
// signal de soutenabilité (payout ratio via financials), détachements à venir
// mis en avant, et comparaison au rendement médian du secteur.
// Sources : window.allDividendes (dividendes_calendrier) et window.allFinancials
// (financials), chargées une fois par loader.js et partagées par toute l'app —
// pas de fetch dédié ici, comme dans screener.js / opportunites.js.
(function () {
  if (window.__TC_DIVIDEND_SCREENER_LOADED__) return;
  window.__TC_DIVIDEND_SCREENER_LOADED__ = true;

  const esc = value => { const d = document.createElement('div'); d.textContent = value == null ? '' : String(value); return d.innerHTML; };
  const n = value => { if (value === '' || value == null) return null; const num = Number(value); return Number.isFinite(num) ? num : null; };
  const pct = value => value == null ? 'Donnée non disponible' : `${Number(value).toFixed(2)} %`;
  const ymd = value => value ? String(value).slice(0, 10) : '';
  const money = value => value == null ? '—' : Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const normalizeText = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  const parseDate = value => { const s = ymd(value); if (!s) return null; const d = new Date(s + 'T00:00:00'); return Number.isNaN(d.getTime()) ? null : d; };

  function dividendes() { return Array.isArray(window.allDividendes) ? window.allDividendes : []; }
  function financials() { return Array.isArray(window.allFinancials) ? window.allFinancials : []; }
  function sectorOf(ticker) {
    const e = (window.entMap && window.entMap[ticker]) || {};
    return e.sous_secteur || e.secteur || null;
  }

  function median(values) {
    const a = values.filter(v => v != null && Number.isFinite(v)).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  // Historique complet par ticker (toutes années confondues, indépendant du
  // filtre Exercice) pour la trajectoire du dividende — trié du plus ancien
  // au plus récent.
  function buildHistoryByTicker() {
    const map = {};
    dividendes().forEach(r => {
      const ticker = String(r.ticker || '').toUpperCase();
      const exercice = n(r.exercice ?? r.annee);
      if (!ticker || exercice == null) return;
      (map[ticker] || (map[ticker] = [])).push({ exercice, montant: n(r.montant_net ?? r.montant) });
    });
    Object.keys(map).forEach(t => map[t].sort((a, b) => a.exercice - b.exercice));
    return map;
  }

  // Nombre d'exercices consécutifs, en partant du plus récent, avec un
  // dividende versé (montant renseigné) — signal de régularité brut, sans
  // présumer d'une progression.
  function streakFromHistory(history) {
    let count = 0, prevYear = null;
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.montant == null) break;
      if (prevYear != null && prevYear - h.exercice !== 1) break;
      count++; prevYear = h.exercice;
    }
    return count;
  }

  // Financials le plus proche de l'exercice du dividende (même année, sinon
  // année antérieure la plus récente, sinon dernier exercice connu).
  function finFor(ticker, year) {
    /* Exercices annuels seulement : un semestre ou un cumul trimestriel de la même année n'a ni DPA ni payout. */
    const list = financials().filter(f => String(f.ticker || '').toUpperCase() === ticker && (!f.periode || String(f.periode).toLowerCase() === 'annuel')).sort((a, b) => n(b.annee) - n(a.annee));
    if (!list.length) return null;
    return list.find(f => n(f.annee) === year) || list.find(f => year == null || n(f.annee) <= year) || list[0];
  }

  // payout_ratio est déjà calculé côté admin (public/admin/js/financials/financials-schema.js)
  // et stocké sur financials.payout_ratio ; on retombe sur le même calcul
  // (dpa/bpa, sinon dpa×actions/résultat net) quand la colonne est vide.
  function payoutRatioFor(f) {
    if (!f) return null;
    const stored = n(f.payout_ratio);
    if (stored != null) return stored;
    const dpa = n(f.dpa), bpa = n(f.bpa), rn = n(f.resultat_net), actions = n(f.nombre_actions ?? f.nb_actions);
    if (dpa != null && bpa != null && bpa > 0) return (dpa / bpa) * 100;
    if (dpa != null && rn != null && rn > 0 && actions) return (dpa * actions / rn) * 100;
    return null;
  }

  function sparklineSvg(history) {
    const vals = history.map(h => h.montant).filter(v => v != null);
    if (vals.length < 2) return '';
    const w = 84, h = 22, pad = 2;
    const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
    const stepX = (w - pad * 2) / (vals.length - 1);
    const pts = vals.map((v, i) => `${(pad + i * stepX).toFixed(1)},${(h - pad - ((v - min) / range) * (h - pad * 2)).toFixed(1)}`).join(' ');
    const color = vals[vals.length - 1] >= vals[0] ? 'var(--green)' : 'var(--red)';
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="div-spark"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
  }

  function historyCell(history) {
    if (!history || history.length < 2) return '<span style="color:var(--dim)">—</span>';
    const title = history.map(h => `${h.exercice}: ${h.montant != null ? h.montant : '—'}`).join(' · ');
    return `<span title="${esc(title)}">${sparklineSvg(history)}</span>`;
  }

  function qualityCell(ratio, streakCount) {
    const badges = [];
    if (ratio != null) {
      const cls = ratio > 100 ? 'warn' : (ratio > 80 ? 'muted' : 'ok');
      badges.push(`<span class="div-badge ${cls}">Payout ${Math.round(ratio)} %${ratio > 100 ? ' ⚠' : ''}</span>`);
    }
    if (streakCount >= 2) badges.push(`<span class="div-badge muted">${streakCount} ans consécutifs</span>`);
    return badges.length ? `<div class="div-badges">${badges.join('')}</div>` : '<span style="color:var(--dim)">—</span>';
  }

  function sectorSubline(yieldValue, sectorMedian) {
    if (yieldValue == null || sectorMedian == null) return '';
    const diff = yieldValue - sectorMedian;
    if (Math.abs(diff) < 0.05) return `<div class="div-sub">≈ médiane secteur</div>`;
    const cls = diff > 0 ? 'ok' : 'muted';
    const arrow = diff > 0 ? '▲' : '▼';
    return `<div class="div-sub ${cls}">${arrow} médiane secteur (${pct(sectorMedian)})</div>`;
  }

  // Reconstruit la liste des exercices disponibles seulement si elle a
  // changé, pour rester correcte même quand ce rendu est rejoué avant que
  // window.allDividendes ne soit peuplé (premier rendu à froid, données
  // arrivant en tâche de fond) sans perdre la sélection en cours.
  function syncYearOptions(rows) {
    const select = document.getElementById('divYear');
    if (!select) return;
    const years = [...new Set(rows.map(r => r.exercice ?? r.annee).filter(Boolean))].sort((a, b) => b - a).map(String);
    const current = Array.from(select.options).slice(1).map(o => o.value);
    if (current.length === years.length && current.every((v, i) => v === years[i])) return;
    const prevValue = select.value;
    select.innerHTML = '<option value="">Tous</option>' + years.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('');
    if (years.includes(prevValue)) select.value = prevValue;
  }

  function daysLabel(days) {
    if (days === 0) return "aujourd'hui";
    if (days === 1) return 'demain';
    return `dans ${days} jours`;
  }

  // Détachements dont la date tombe dans les 45 prochains jours, tous
  // exercices confondus (indépendant du filtre Exercice de la liste
  // principale) — remontés à part plutôt que noyés dans un tableau trié par
  // rendement.
  function upcomingDetachments() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today.getTime() + 45 * 86400000);
    return dividendes()
      .map(r => {
        const dateStr = ymd(r.date_detachement ?? r.ex_date);
        if (!dateStr) return null;
        const d = new Date(dateStr + 'T00:00:00');
        if (Number.isNaN(d.getTime()) || d < today || d > horizon) return null;
        return {
          ticker: String(r.ticker || '').toUpperCase(),
          date: dateStr,
          paiement: ymd(r.date_paiement_cal ?? r.date_paiement),
          yieldValue: n(r.taux_rendement ?? r.rendement),
          statut: r.statut || '',
          days: Math.round((d - today) / 86400000)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.days - b.days);
  }

  function renderUpcoming() {
    const card = document.getElementById('divUpcomingCard');
    const tbody = document.getElementById('divUpcomingTable');
    if (!card || !tbody) return;
    const list = upcomingDetachments();
    card.style.display = list.length ? '' : 'none';
    const count = document.getElementById('divUpcomingCount');
    if (count) count.textContent = list.length + ' événement' + (list.length > 1 ? 's' : '');
    if (!list.length) return;
    tbody.innerHTML = list.map(u => `<tr>
      <td><strong style="color:var(--gold)">${esc(u.ticker)}</strong></td>
      <td>${esc(u.date.split('-').reverse().join('/'))} <span class="div-sub ok">${esc(daysLabel(u.days))}</span></td>
      <td>${u.paiement ? esc(u.paiement.split('-').reverse().join('/')) : '—'}</td>
      <td class="right">${pct(u.yieldValue)}</td>
      <td>${esc(u.statut || '—')}</td>
    </tr>`).join('');
  }

  function injectCss() {
    if (document.getElementById('tc-dividend-screener-css')) return;
    const s = document.createElement('style');
    s.id = 'tc-dividend-screener-css';
    s.textContent = [
      '#view-dividend-screener{--div-surface:rgba(255,255,255,.025)}',
      '#view-dividend-screener .div-hero{display:grid;grid-template-columns:minmax(0,1.7fr) repeat(3,minmax(150px,1fr));gap:12px;margin-bottom:16px}',
      '#view-dividend-screener .div-hero-main,#view-dividend-screener .div-stat{border:1px solid var(--border2);background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018));border-radius:14px;padding:18px;box-shadow:0 8px 28px rgba(0,0,0,.12)}',
      '#view-dividend-screener .div-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--gold);font-weight:700;margin-bottom:8px}',
      '#view-dividend-screener .div-hero h1{font-size:28px;margin:0 0 7px;letter-spacing:-.03em}',
      '#view-dividend-screener .div-hero p{margin:0;color:var(--dim);font-size:12px;line-height:1.55;max-width:680px}',
      '#view-dividend-screener .div-stat-label{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}',
      '#view-dividend-screener .div-stat-value{font-size:23px;font-weight:750;margin-top:7px;letter-spacing:-.02em}',
      '#view-dividend-screener .div-stat-note{font-size:10px;color:var(--dim);margin-top:4px}',
      '#view-dividend-screener .div-toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap}',
      '#view-dividend-screener .div-field{min-width:135px;flex:1}',
      '#view-dividend-screener .div-field.search{flex:2;min-width:220px}',
      '#view-dividend-screener .div-field label{display:block;font-size:10px;color:var(--dim);margin-bottom:6px}',
      '#view-dividend-screener .div-field input,#view-dividend-screener .div-field select{width:100%;box-sizing:border-box}',
      '#view-dividend-screener .div-reset{height:36px;border:1px solid var(--border2);background:transparent;color:var(--dim);border-radius:8px;padding:0 12px;cursor:pointer}',
      '#view-dividend-screener .div-reset:hover{border-color:var(--gold);color:var(--gold)}',
      '#view-dividend-screener .div-active{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}',
      '#view-dividend-screener .div-chip{font-size:10px;padding:5px 8px;border-radius:999px;background:rgba(196,157,83,.10);border:1px solid rgba(196,157,83,.28);color:var(--gold)}',
      '#view-dividend-screener .div-insights{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}',
      '#view-dividend-screener .div-insight{border:1px solid var(--border2);border-radius:12px;padding:13px 14px;background:var(--div-surface)}',
      '#view-dividend-screener .div-insight-title{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:6px}',
      '#view-dividend-screener .div-insight-text{font-size:12px;line-height:1.5}',
      '#view-dividend-screener .div-badges{display:flex;flex-wrap:wrap;gap:4px;align-items:center}',
      '#view-dividend-screener .div-badge{font-size:9px;padding:3px 7px;border-radius:999px;border:1px solid;white-space:nowrap;letter-spacing:.02em}',
      '#view-dividend-screener .div-badge.ok{color:var(--green);border-color:rgba(74,222,128,.35);background:rgba(74,222,128,.06)}',
      '#view-dividend-screener .div-badge.warn{color:var(--red);border-color:rgba(248,113,113,.35);background:rgba(248,113,113,.06)}',
      '#view-dividend-screener .div-badge.muted{color:var(--dim);border-color:var(--border2)}',
      '#view-dividend-screener .div-sub{font-size:9px;margin-top:3px;color:var(--dim)}',
      '#view-dividend-screener .div-sub.ok{color:var(--green)}',
      '#view-dividend-screener .div-spark{display:block;width:92px;height:26px}',
      '#view-dividend-screener .div-table thead th{position:sticky;top:0;z-index:2;background:var(--surface,#111)}',
      '#view-dividend-screener .div-table tbody tr{transition:background .16s ease,transform .16s ease}',
      '#view-dividend-screener .div-table tbody tr:hover{background:rgba(196,157,83,.055)}',
      '#view-dividend-screener .div-rank{display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:7px;background:rgba(196,157,83,.09);color:var(--gold);font-size:10px;margin-right:7px}',
      '#view-dividend-screener .div-ticker{font-weight:750;color:var(--gold);cursor:pointer}',
      '#view-dividend-screener .div-ticker:hover{text-decoration:underline}',
      '#view-dividend-screener .div-sort{cursor:pointer;user-select:none;white-space:nowrap}',
      '#view-dividend-screener .div-sort:hover{color:var(--gold)}',
      '#view-dividend-screener .div-sort-ind{font-size:9px;color:var(--gold);margin-left:3px}',
      '#view-dividend-screener .div-upcoming{border-color:rgba(196,157,83,.25)}',
      '#view-dividend-screener .div-count{font-size:11px;color:var(--dim)}',
      '@media(max-width:1050px){#view-dividend-screener .div-hero{grid-template-columns:1fr 1fr}#view-dividend-screener .div-hero-main{grid-column:1/-1}}',
      '@media(max-width:700px){#view-dividend-screener .div-hero{grid-template-columns:1fr}#view-dividend-screener .div-insights{grid-template-columns:1fr}#view-dividend-screener .div-field{min-width:100%}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function renderDividendScreener() {
    const view = document.getElementById('view-dividend-screener');
    if (!view) return;
    injectCss();

    if (view.dataset.tcBuilt === '1') { renderUpcoming(); apply(); return; }
    view.dataset.tcBuilt = '1';

    view.innerHTML = `
      <section class="div-hero">
        <div class="div-hero-main">
          <div class="div-eyebrow">The Capital · Dividend Intelligence</div>
          <h1>Screener <span style="color:var(--gold)">Dividendes</span></h1>
          <p>Identifiez rapidement les profils de rendement, de croissance et de régularité. Les données historiques restent séparées des projections et les indicateurs de soutenabilité sont rapprochés des états financiers.</p>
        </div>
        <div class="div-stat"><div class="div-stat-label">Titres analysés</div><div class="div-stat-value" id="divKpiCount">—</div><div class="div-stat-note">après filtres</div></div>
        <div class="div-stat"><div class="div-stat-label">Rendement médian</div><div class="div-stat-value" id="divKpiYield">—</div><div class="div-stat-note">univers affiché</div></div>
        <div class="div-stat"><div class="div-stat-label">Prochain détachement</div><div class="div-stat-value" id="divKpiNext">—</div><div class="div-stat-note">horizon 45 jours</div></div>
      </section>

      <div class="card mb20">
        <div class="card-body">
          <div class="div-toolbar">
            <div class="div-field search"><label>Recherche société / ticker</label><input type="search" id="divSearch" placeholder="Ex. SONATEL, BOA, TotalEnergies…"></div>
            <div class="div-field"><label>Rendement min %</label><input type="number" id="divMinYield" value="0" step="0.1"></div>
            <div class="div-field"><label>Rendement max %</label><input type="number" id="divMaxYield" placeholder="∞" step="0.1"></div>
            <div class="div-field"><label>Croissance min %</label><input type="number" id="divMinGrowth" placeholder="Aucune" step="0.1"></div>
            <div class="div-field"><label>Exercice</label><select id="divYear"><option value="">Tous</option></select></div>
            <button class="div-reset" id="divReset" type="button">Réinitialiser</button>
          </div>
          <div class="div-active" id="divActiveFilters"></div>
        </div>
      </div>

      <div class="div-insights">
        <div class="div-insight"><div class="div-insight-title">Lecture rapide</div><div class="div-insight-text" id="divInsightSummary">Chargement des données…</div></div>
        <div class="div-insight"><div class="div-insight-title">Point d’attention</div><div class="div-insight-text" id="divInsightRisk">Analyse de soutenabilité en cours…</div></div>
      </div>

      <div class="card div-upcoming mb20" id="divUpcomingCard" style="display:none">
        <div class="card-header"><div><div class="card-title">Détachements à venir</div><div style="font-size:10px;color:var(--dim);margin-top:3px">Calendrier des prochaines dates connues</div></div><div id="divUpcomingCount" class="div-count"></div></div>
        <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Détachement</th><th>Paiement</th><th class="right">Rendement</th><th>Statut</th></tr></thead><tbody id="divUpcomingTable"></tbody></table></div>
      </div>

      <div class="card">
        <div class="card-header"><div><div class="card-title">Univers dividendes</div><div style="font-size:10px;color:var(--dim);margin-top:3px">Tri par colonne · clic sur un ticker pour ouvrir sa fiche</div></div><div id="divCount" class="div-count"></div></div>
        <div class="table-wrap"><table class="div-table"><thead><tr>
          <th>#</th><th>Ticker</th><th>Exercice</th>
          <th class="right div-sort" data-sort="amount">Dividende <span class="div-sort-ind"></span></th>
          <th class="right div-sort" data-sort="yield">Rendement <span class="div-sort-ind">↓</span></th>
          <th class="right div-sort" data-sort="growth">Croissance <span class="div-sort-ind"></span></th>
          <th>Trajectoire</th><th>Soutenabilité</th><th>Détachement</th><th>Paiement</th>
        </tr></thead><tbody id="dividendScreenerTable"></tbody></table></div>
      </div>`;

    ['divMinYield', 'divMaxYield', 'divMinGrowth', 'divSearch'].forEach(id => document.getElementById(id)?.addEventListener('input', apply));
    document.getElementById('divYear')?.addEventListener('change', apply);
    document.getElementById('divReset')?.addEventListener('click', () => {
      document.getElementById('divSearch').value = '';
      document.getElementById('divMinYield').value = '0';
      document.getElementById('divMaxYield').value = '';
      document.getElementById('divMinGrowth').value = '';
      document.getElementById('divYear').value = '';
      window.__TC_DIV_SORT__ = { key:'yield', dir:-1 };
      apply();
    });
    view.querySelectorAll('.div-sort').forEach(th => th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const s = window.__TC_DIV_SORT__ || {key:'yield',dir:-1};
      window.__TC_DIV_SORT__ = s.key === key ? {key,dir:s.dir * -1} : {key,dir:-1};
      apply();
    }));
    renderUpcoming();
    apply();
  }

  function apply() {
    const minY = n(document.getElementById('divMinYield')?.value) ?? 0;
    const maxY = n(document.getElementById('divMaxYield')?.value) ?? Infinity;
    const minG = n(document.getElementById('divMinGrowth')?.value);
    const search = normalizeText(document.getElementById('divSearch')?.value);
    const rows = dividendes();
    syncYearOptions(rows);
    const selectedYear = document.getElementById('divYear')?.value || '';
    const historyByTicker = buildHistoryByTicker();

    const sourceRows = selectedYear ? rows.filter(r => String(r.exercice ?? r.annee) === selectedYear) : rows;
    const byTicker = new Map();
    sourceRows.forEach(r => {
      const ticker = String(r.ticker || '').toUpperCase();
      if (!ticker) return;
      const year = n(r.exercice ?? r.annee);
      const current = byTicker.get(ticker);
      if (!current || Number(year || 0) > Number(current.exercice ?? current.annee ?? 0)) byTicker.set(ticker, { ...r, ticker });
    });

    const sectorYields = {};
    byTicker.forEach(r => {
      const sec = sectorOf(r.ticker);
      const y = n(r.taux_rendement ?? r.rendement);
      if (sec && y != null) (sectorYields[sec] || (sectorYields[sec] = [])).push(y);
    });
    const sectorMedians = {};
    Object.keys(sectorYields).forEach(s => { if (sectorYields[s].length >= 3) sectorMedians[s] = median(sectorYields[s]); });

    let out = Array.from(byTicker.values()).map(r => {
      const current = n(r.montant_net ?? r.montant);
      const yieldValue = n(r.taux_rendement ?? r.rendement);
      const currentYear = n(r.exercice ?? r.annee);
      const previous = rows.find(x => String(x.ticker || '').toUpperCase() === r.ticker && n(x.exercice ?? x.annee) === currentYear - 1);
      const prevAmount = previous ? n(previous.montant_net ?? previous.montant) : null;
      const growth = current != null && prevAmount != null && prevAmount !== 0 ? (current / prevAmount - 1) * 100 : null;
      const history = historyByTicker[r.ticker] || [];
      const fin = finFor(r.ticker, currentYear);
      return { ...r, yieldValue, growth, history, payoutRatio:payoutRatioFor(fin), streak:streakFromHistory(history), sectorMedian:sectorMedians[sectorOf(r.ticker)] ?? null };
    }).filter(r => {
      const tickerMatch = !search || normalizeText(r.ticker).includes(search) || normalizeText((window.entMap && window.entMap[r.ticker] && (window.entMap[r.ticker].nom || window.entMap[r.ticker].name)) || '').includes(search);
      return tickerMatch && (r.yieldValue ?? -Infinity) >= minY && (r.yieldValue ?? Infinity) <= maxY && (minG == null || (r.growth != null && r.growth >= minG));
    });

    const sort = window.__TC_DIV_SORT__ || {key:'yield',dir:-1};
    const valFor = r => sort.key==='yield' ? (r.yieldValue ?? -Infinity) : sort.key==='growth' ? (r.growth ?? -Infinity) : (n(r.montant_net ?? r.montant) ?? -Infinity);
    out.sort((a,b) => (valFor(a)-valFor(b))*sort.dir);

    const yields = out.map(r=>r.yieldValue).filter(v=>v!=null);
    const medYield = median(yields);
    const next = upcomingDetachments()[0];

    const kCount=document.getElementById('divKpiCount'); if(kCount) kCount.textContent=out.length;
    const kYield=document.getElementById('divKpiYield'); if(kYield) kYield.textContent=medYield==null?'—':pct(medYield);
    const kNext=document.getElementById('divKpiNext'); if(kNext) kNext.textContent=next ? next.ticker : '—';
    const count=document.getElementById('divCount'); if(count) count.textContent=`${out.length} titre${out.length>1?'s':''}`;

    const active=document.getElementById('divActiveFilters');
    if(active){
      const chips=[];
      if(search) chips.push(`Recherche: ${esc(document.getElementById('divSearch').value)}`);
      if(minY>0) chips.push(`Rendement ≥ ${pct(minY)}`);
      if(maxY<Infinity) chips.push(`Rendement ≤ ${pct(maxY)}`);
      if(minG!=null) chips.push(`Croissance ≥ ${pct(minG)}`);
      if(selectedYear) chips.push(`Exercice ${esc(selectedYear)}`);
      active.innerHTML=chips.length?chips.map(x=>`<span class="div-chip">${x}</span>`).join(''):'<span style="font-size:10px;color:var(--dim)">Aucun filtre actif · univers complet</span>';
    }

    const risky=out.filter(r=>r.payoutRatio!=null && r.payoutRatio>100).length;
    const growing=out.filter(r=>r.growth!=null && r.growth>0).length;
    const summary=document.getElementById('divInsightSummary');
    if(summary) summary.textContent = out.length ? `${growing} titre${growing>1?'s':''} affichent une croissance du dividende sur le dernier exercice disponible. Rendement médian de l’univers affiché : ${medYield==null?'—':pct(medYield)}.` : 'Aucun titre ne correspond aux critères actuels.';
    const risk=document.getElementById('divInsightRisk');
    if(risk) risk.innerHTML = risky ? `<strong style="color:var(--red)">${risky} titre${risky>1?'s':''}</strong> présentent un payout supérieur à 100 %. Ce signal doit être lu avec le résultat net, le DPA et la qualité des données financières.` : 'Aucun payout supérieur à 100 % dans l’univers affiché, lorsque la donnée est disponible.';

    document.querySelectorAll('#view-dividend-screener .div-sort-ind').forEach(el=>el.textContent='');
    const activeTh=document.querySelector(`#view-dividend-screener .div-sort[data-sort="${sort.key}"] .div-sort-ind`);
    if(activeTh) activeTh.textContent=sort.dir===-1?'↓':'↑';

    const tbody=document.getElementById('dividendScreenerTable');
    if(!tbody) return;
    tbody.innerHTML=out.length ? out.map((r,i)=>`<tr>
      <td><span class="div-rank">${i+1}</span></td>
      <td><span class="div-ticker" data-ticker="${esc(r.ticker)}">${esc(r.ticker)}</span></td>
      <td>${esc(r.exercice ?? r.annee ?? '—')}</td>
      <td class="right">${money(r.montant_net ?? r.montant)}</td>
      <td class="right"><strong>${pct(r.yieldValue)}</strong>${sectorSubline(r.yieldValue,r.sectorMedian)}</td>
      <td class="right">${r.growth==null?'—':`<span class="${r.growth>=0?'':'div-sub'}">${pct(r.growth)}</span>`}</td>
      <td>${historyCell(r.history)}</td>
      <td>${qualityCell(r.payoutRatio,r.streak)}</td>
      <td>${esc(r.date_detachement ?? r.ex_date ?? '—')}</td>
      <td>${esc(r.date_paiement_cal ?? r.date_paiement ?? '—')}</td>
    </tr>`).join(''):'<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--dim)">Aucune société ne correspond aux critères.</td></tr>';

    tbody.querySelectorAll('.div-ticker').forEach(el=>el.addEventListener('click',()=>{
      const t=el.dataset.ticker;
      if(typeof window.nav==='function') window.nav('fiche='+encodeURIComponent(t));
      else if(typeof window.openSecuritySheet==='function') window.openSecuritySheet(t);
      else window.location.hash = '#fiche='+encodeURIComponent(t);
    }));
  }

  window.renderDividendScreener = renderDividendScreener;
})();
