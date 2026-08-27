// THE CAPITAL — Suivi & Trading intégré à l'application principale
(function () {
  'use strict';
  if (window.__TC_SUIVI_INTEGRATED__) return;
  window.__TC_SUIVI_INTEGRATED__ = true;

  const money = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' FCFA' : '—';
  const num = n => { const v = Number(n); return Number.isFinite(v) ? v : null; };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const token = () => { try { return JSON.parse(localStorage.getItem('tc_session') || 'null')?.access_token || ''; } catch (_) { return ''; } };
  async function api(path, options) {
    const headers = Object.assign({ Accept: 'application/json' }, options?.headers || {});
    const t = token(); if (t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch(path, Object.assign({ cache: 'no-store', headers }, options || {}));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }
  const rows = d => Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : Array.isArray(d?.transactions) ? d.transactions : [];
  const type = t => String(t || '').toUpperCase();
  const dateOf = t => String(t?.date_transaction || t?.date || '').slice(0, 10);
  const amountOf = t => num(t?.montant_net ?? t?.amount ?? t?.montant) || 0;

  let state = { transactions: [], watch: [], cours: [], companies: [], tab: 'overview' };
  let fifoLots = [];

  function css() {
    if (document.getElementById('tc-suivi-style')) return;
    const s = document.createElement('style'); s.id = 'tc-suivi-style';
    s.textContent = `
#view-suivi{padding-bottom:32px}.tc-suivi-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:18px}.tc-suivi-kicker{font:10px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}.tc-suivi-title{font:700 32px var(--serif);margin:5px 0}.tc-suivi-sub{font-size:13px;color:var(--muted);max-width:760px;line-height:1.6}.tc-suivi-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}.tc-suivi-tab{border:1px solid var(--border2);background:var(--surface);color:var(--muted);border-radius:7px;padding:9px 13px;cursor:pointer;font-size:11px}.tc-suivi-tab.active{background:var(--gold);color:var(--bg);border-color:var(--gold);font-weight:600}.tc-suivi-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px}.tc-suivi-kpi{background:var(--card);border:1px solid var(--border2);border-radius:10px;padding:14px}.tc-suivi-label{font-size:9px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase}.tc-suivi-value{font:500 19px var(--mono);margin-top:7px}.tc-suivi-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,1fr);gap:16px}.tc-suivi-card{background:var(--card);border:1px solid var(--border2);border-radius:10px;overflow:hidden;margin-bottom:16px}.tc-suivi-card-head{padding:12px 15px;border-bottom:1px solid var(--border2);display:flex;align-items:center;justify-content:space-between;gap:10px}.tc-suivi-card-title{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.tc-suivi-body{padding:15px}.tc-suivi-table{width:100%;border-collapse:collapse;font-size:11px}.tc-suivi-table th{font-size:9px;color:var(--dim);text-align:left;text-transform:uppercase;letter-spacing:.08em;padding:9px;border-bottom:1px solid var(--border2)}.tc-suivi-table td{padding:10px 9px;border-bottom:1px solid rgba(184,150,78,.07);font-family:var(--mono)}.tc-suivi-table tr:last-child td{border-bottom:0}.tc-up{color:#4ade80}.tc-down{color:#f87171}.tc-muted{color:var(--muted)}.tc-suivi-form{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.tc-suivi-input,.tc-suivi-select{width:100%;padding:10px;background:var(--surface);border:1px solid var(--border2);border-radius:7px;color:var(--cream);outline:0;font-size:11px}.tc-suivi-input:focus,.tc-suivi-select:focus{border-color:var(--gold)}.tc-suivi-full{grid-column:1/-1}.tc-suivi-btn{border:1px solid var(--border2);background:var(--surface);color:var(--cream);border-radius:7px;padding:9px 12px;cursor:pointer;font-size:11px}.tc-suivi-btn.primary{background:var(--gold);border-color:var(--gold);color:var(--bg);font-weight:600}.tc-suivi-watch{display:grid;grid-template-columns:1.5fr .8fr .7fr auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid rgba(184,150,78,.07)}.tc-suivi-watch:last-child{border-bottom:0}.tc-ticker{font:600 12px var(--mono);color:var(--gold2)}.tc-company{font-size:11px;margin-top:2px}.tc-suivi-empty{padding:25px;text-align:center;color:var(--muted);font-size:11px}.tc-flux{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(184,150,78,.07);font-size:11px}.tc-flux:last-child{border-bottom:0}.tc-badge{font-size:9px;padding:4px 6px;border-radius:5px;border:1px solid var(--border2)}.tc-badge.trade{color:var(--gold2)}.tc-badge.apport{color:#60a5fa}.tc-badge.div{color:#4ade80}@media(max-width:1050px){.tc-suivi-kpis{grid-template-columns:repeat(3,1fr)}.tc-suivi-grid{grid-template-columns:1fr}}@media(max-width:650px){.tc-suivi-head{align-items:flex-start;flex-direction:column}.tc-suivi-title{font-size:27px}.tc-suivi-kpis{grid-template-columns:1fr 1fr}.tc-suivi-form{grid-template-columns:1fr}.tc-suivi-watch{grid-template-columns:1fr 1fr}.tc-suivi-watch>div:first-child{grid-column:1/-1}.tc-suivi-full{grid-column:auto}.tc-suivi-table{min-width:650px}.tc-suivi-body.table-scroll{overflow:auto}}
    `;
    document.head.appendChild(s);
  }

  function installView() {
    if (document.getElementById('view-suivi')) return document.getElementById('view-suivi');
    const main = document.querySelector('.main'); if (!main) return null;
    const v = document.createElement('div'); v.className = 'view'; v.id = 'view-suivi';
    v.innerHTML = `
      <div class="tc-suivi-head"><div><div class="tc-suivi-kicker">Gestion personnelle</div><div class="tc-suivi-title">Suivi & <span style="color:var(--gold)">Trading</span></div><div class="tc-suivi-sub">Un seul espace dans The Capital : ce que vous surveillez, vos opérations de trading et vos apports de capital. Le résultat du trading est séparé du capital que vous apportez.</div></div></div>
      <div class="tc-suivi-tabs"><button class="tc-suivi-tab active" data-tab="overview">Vue d'ensemble</button><button class="tc-suivi-tab" data-tab="trading">Trading</button><button class="tc-suivi-tab" data-tab="apports">Apports & flux</button></div>
      <div class="tc-suivi-kpis"><div class="tc-suivi-kpi"><div class="tc-suivi-label">Capital apporté net</div><div class="tc-suivi-value" id="tc-capital">—</div></div><div class="tc-suivi-kpi"><div class="tc-suivi-label">Résultat trading</div><div class="tc-suivi-value" id="tc-trading-pnl">—</div></div><div class="tc-suivi-kpi"><div class="tc-suivi-label">Dividendes</div><div class="tc-suivi-value" id="tc-dividendes">—</div></div><div class="tc-suivi-kpi"><div class="tc-suivi-label">Valeur portefeuille</div><div class="tc-suivi-value" id="tc-market-value">—</div></div><div class="tc-suivi-kpi"><div class="tc-suivi-label">Performance vs apports</div><div class="tc-suivi-value" id="tc-net-performance">—</div></div></div>
      <div class="tc-suivi-grid"><div>
        <section class="tc-suivi-card tc-suivi-panel" data-panel="overview"><div class="tc-suivi-card-head"><div class="tc-suivi-card-title">Mes valeurs suivies</div><button class="tc-suivi-btn" id="tc-refresh">↻ Actualiser</button></div><div class="tc-suivi-body" id="tc-watch"></div></section>
        <section class="tc-suivi-card tc-suivi-panel" data-panel="trading" style="display:none"><div class="tc-suivi-card-head"><div class="tc-suivi-card-title">Journal de trading</div><span class="tc-muted">ACHAT / VENTE uniquement</span></div><div class="tc-suivi-body table-scroll"><table class="tc-suivi-table"><thead><tr><th>Date</th><th>Type</th><th>Titre</th><th>Qté</th><th>Prix</th><th>Montant net</th><th>Résultat</th></tr></thead><tbody id="tc-trades"></tbody></table></div></section>
        <section class="tc-suivi-card tc-suivi-panel" data-panel="apports" style="display:none"><div class="tc-suivi-card-head"><div class="tc-suivi-card-title">Apports & flux de trésorerie</div><span class="tc-muted">Capital externe, séparé du trading</span></div><div class="tc-suivi-body" id="tc-flux"></div></section>
      </div><aside>
        <section class="tc-suivi-card"><div class="tc-suivi-card-head"><div class="tc-suivi-card-title">Nouvelle opération</div></div><div class="tc-suivi-body"><form id="tc-tx-form" class="tc-suivi-form"><select class="tc-suivi-select tc-suivi-full" id="tc-tx-type"><option value="ACHAT">Achat</option><option value="VENTE">Vente</option><option value="DEPOT">Apport de capital</option><option value="RETRAIT">Retrait</option><option value="DIVIDENDE">Dividende reçu</option></select><input class="tc-suivi-input" id="tc-tx-ticker" placeholder="Ticker, ex. SNTS"><input class="tc-suivi-input" id="tc-tx-qty" type="number" min="1" step="1" placeholder="Quantité"><input class="tc-suivi-input" id="tc-tx-price" type="number" min="0" step="0.01" placeholder="Prix / montant"><input class="tc-suivi-input" id="tc-tx-date" type="date"><input class="tc-suivi-input tc-suivi-full" id="tc-tx-note" placeholder="Note / stratégie (optionnel)"><button class="tc-suivi-btn primary tc-suivi-full" type="submit">Enregistrer</button></form><div class="tc-muted" style="font-size:10px;line-height:1.5;margin-top:9px">Pour un apport, saisissez le montant dans « Prix / montant ». Il augmente le capital apporté mais ne devient pas un gain de trading.</div></div></section>
        <section class="tc-suivi-card"><div class="tc-suivi-card-head"><div class="tc-suivi-card-title">Principe de lecture</div></div><div class="tc-suivi-body"><div class="tc-flux"><span>Apport</span><b>Capital injecté</b></div><div class="tc-flux"><span>Trading</span><b>Gain / perte réalisé</b></div><div class="tc-flux"><span>Dividende</span><b>Revenu encaissé</b></div><div class="tc-flux"><span>Retrait</span><b>Capital sorti</b></div></div></section>
      </aside></div>`;
    main.appendChild(v);
    v.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    v.querySelector('#tc-refresh').onclick = () => load(true);
    v.querySelector('#tc-tx-form').addEventListener('submit', saveTransaction);
    const date = v.querySelector('#tc-tx-date'); if (date) date.value = new Date().toISOString().slice(0,10);
    return v;
  }

  function setTab(tab) {
    state.tab = tab || 'overview';
    document.querySelectorAll('#view-suivi [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
    document.querySelectorAll('#view-suivi [data-panel]').forEach(p => p.style.display = p.dataset.panel === state.tab ? '' : 'none');
    render();
  }

  function installNavigation() {
    if (window.__TC_SUIVI_NAV__) return;
    const original = window.nav;
    if (typeof original !== 'function') return;
    window.nav = function (id, noHash) {
      if (id === 'suivi') {
        const view = installView();
        document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
        view.classList.add('active'); view.style.display = '';
        document.querySelectorAll('.nav-dropdown-item,.nav-dropdown-btn,.nav-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('[data-tc-suivi]').forEach(el => el.classList.add('active'));
        if (!noHash && location.hash !== '#suivi') history.pushState({ view: 'suivi' }, '', '#suivi');
        document.title = 'Suivi & Trading, The Capital';
        if (typeof window.closeDropdowns === 'function') window.closeDropdowns();
        if (typeof window.closeSidebar === 'function') window.closeSidebar();
        setTimeout(() => { load(false); }, 0);
        return true;
      }
      return original.apply(this, arguments);
    };
    window.__TC_SUIVI_NAV__ = true;
  }

  function rewriteNavigationLinks() {
    document.querySelectorAll('[data-tc-suivi]').forEach(el => {
      el.id = 'nav-suivi'; el.setAttribute('href', '#suivi'); el.setAttribute('target', '_self');
      el.onclick = e => { e.preventDefault(); window.nav('suivi'); };
      if (el.classList.contains('nav-item')) el.style.textDecoration = 'none';
    });
    document.querySelectorAll('[data-tc-desk]').forEach(el => { el.style.display = 'none'; });
  }

  function computeTrading() {
    const lots = new Map(); let realized = 0;
    const sorted = [...state.transactions].sort((a,b) => dateOf(a).localeCompare(dateOf(b)) || String(a.id||'').localeCompare(String(b.id||'')));
    for (const tx of sorted) {
      const t = type(tx.type), ticker = String(tx.ticker || '').toUpperCase(), qty = num(tx.quantite ?? tx.quantity) || 0, price = num(tx.cours ?? tx.price) || 0;
      if (!ticker || !qty) continue;
      if (t === 'ACHAT') { if (!lots.has(ticker)) lots.set(ticker, []); lots.get(ticker).push({ qty, price }); }
      if (t === 'VENTE') {
        let rem = qty; const bucket = lots.get(ticker) || [];
        while (rem > 0 && bucket.length) { const lot = bucket[0], take = Math.min(rem, lot.qty); realized += take * (price - lot.price); lot.qty -= take; rem -= take; if (lot.qty <= 0) bucket.shift(); }
      }
    }
    fifoLots = [...lots.entries()].flatMap(([ticker, lots]) => lots.filter(x => x.qty > 0).map(x => ({ ticker, ...x })));
    return realized;
  }

  function renderKpis() {
    const depots = state.transactions.filter(t => type(t.type) === 'DEPOT').reduce((s,t) => s + Math.abs(amountOf(t)), 0);
    const retraits = state.transactions.filter(t => type(t.type) === 'RETRAIT').reduce((s,t) => s + Math.abs(amountOf(t)), 0);
    const capital = depots - retraits;
    const trading = computeTrading();
    const dividends = state.transactions.filter(t => type(t.type) === 'DIVIDENDE').reduce((s,t) => s + Math.abs(amountOf(t)), 0);
    const prices = new Map(state.cours.map(c => [String(c.ticker||'').toUpperCase(), num(c.cours_cloture ?? c.cours ?? c.price)]));
    const market = fifoLots.reduce((s,l) => s + l.qty * (prices.get(l.ticker) || l.price), 0);
    const net = trading + dividends + market - capital;
    const set = (id,val,cls) => { const e=document.getElementById(id); if(e){e.textContent=money(val);e.className='tc-suivi-value '+(cls||'');} };
    set('tc-capital', capital); set('tc-trading-pnl', trading, trading > 0 ? 'tc-up' : trading < 0 ? 'tc-down' : ''); set('tc-dividendes', dividends, 'tc-up'); set('tc-market-value', market); set('tc-net-performance', net, net > 0 ? 'tc-up' : net < 0 ? 'tc-down' : '');
  }

  function company(t) { const c = state.companies.find(x => String(x.ticker||'').toUpperCase() === String(t||'').toUpperCase()); return c?.nom || c?.name || ''; }
  function course(t) { const r = state.cours.find(x => String(x.ticker||'').toUpperCase() === String(t||'').toUpperCase()); return r || null; }

  function renderWatch() {
    const box = document.getElementById('tc-watch'); if (!box) return;
    if (!state.watch.length) { box.innerHTML = '<div class="tc-suivi-empty">Aucune valeur suivie. Utilisez la fiche d’un titre pour l’ajouter à votre suivi.</div>'; return; }
    box.innerHTML = state.watch.map(w => { const t=String(w.ticker||'').toUpperCase(), c=course(t), v=num(c?.variation_pct ?? c?.variation), p=num(c?.cours_cloture ?? c?.cours ?? c?.price); return `<div class="tc-suivi-watch"><div><div class="tc-ticker">${esc(t)}</div><div class="tc-company">${esc(company(t))}</div></div><div>${p==null?'—':money(p)}</div><div class="${v>0?'tc-up':v<0?'tc-down':'tc-muted'}">${v==null?'—':(v>0?'+':'')+v.toLocaleString('fr-FR',{maximumFractionDigits:2})+'%'}</div><button class="tc-suivi-btn" data-remove="${esc(w.id||'')}">Retirer</button></div>`; }).join('');
    box.querySelectorAll('[data-remove]').forEach(b => b.onclick = async () => { try { await api('/api/user-data?mode=watchlist&id='+encodeURIComponent(b.dataset.remove), { method:'DELETE' }); await load(true); } catch(e) { window.toast?.(e.message,'error'); } });
  }

  function renderTrades() {
    const body = document.getElementById('tc-trades'); if (!body) return;
    const trades = state.transactions.filter(t => ['ACHAT','VENTE'].includes(type(t.type))).sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));
    if (!trades.length) { body.innerHTML = '<tr><td colspan="7" class="tc-muted" style="text-align:center;padding:24px">Aucun trade enregistré.</td></tr>'; return; }
    const fifo = new Map(), out=[];
    [...trades].sort((a,b)=>dateOf(a).localeCompare(dateOf(b))).forEach(tx => { const t=type(tx.type), ticker=String(tx.ticker||'').toUpperCase(), q=num(tx.quantite)||0,p=num(tx.cours)||0;if(t==='ACHAT'){if(!fifo.has(ticker))fifo.set(ticker,[]);fifo.get(ticker).push({q,p});out.push({tx,pnl:null});}else{let rem=q,pnl=0,b=fifo.get(ticker)||[];while(rem>0&&b.length){const l=b[0],take=Math.min(rem,l.q);pnl+=take*(p-l.p);l.q-=take;rem-=take;if(l.q<=0)b.shift();}out.push({tx,pnl});}});
    body.innerHTML = out.reverse().map(x=>{const tx=x.tx,t=type(tx.type),p=num(tx.cours)||0,amt=amountOf(tx),pnl=x.pnl;return `<tr><td>${esc(dateOf(tx))}</td><td><span class="tc-badge trade">${esc(t)}</span></td><td>${esc(String(tx.ticker||'').toUpperCase())}</td><td>${num(tx.quantite)||0}</td><td>${money(p)}</td><td>${money(amt)}</td><td class="${pnl>0?'tc-up':pnl<0?'tc-down':'tc-muted'}">${pnl==null?'—':(pnl>0?'+':'')+money(pnl)}</td></tr>`;}).join('');
  }

  function renderFlows() {
    const box = document.getElementById('tc-flux'); if (!box) return;
    const flows = state.transactions.filter(t => ['DEPOT','RETRAIT','DIVIDENDE'].includes(type(t.type))).sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));
    if (!flows.length) { box.innerHTML='<div class="tc-suivi-empty">Aucun apport, retrait ou dividende enregistré.</div>'; return; }
    box.innerHTML=flows.map(tx=>{const t=type(tx.type), cls=t==='DIVIDENDE'?'div':'apport', label=t==='DEPOT'?'APPORT':t==='RETRAIT'?'RETRAIT':'DIVIDENDE', a=amountOf(tx);return `<div class="tc-flux"><span><span class="tc-badge ${cls}">${label}</span> &nbsp;${esc(dateOf(tx))}</span><b class="${t==='RETRAIT'?'tc-down':t==='DIVIDENDE'?'tc-up':'tc-muted'}">${t==='RETRAIT'?'-': '+'}${money(Math.abs(a))}</b></div>`;}).join('');
  }

  function render() { if (!document.getElementById('view-suivi')) return; renderKpis(); renderWatch(); renderTrades(); renderFlows(); }

  async function saveTransaction(e) {
    e.preventDefault();
    const form=e.currentTarget, t=type(document.getElementById('tc-tx-type').value), ticker=String(document.getElementById('tc-tx-ticker').value||'').trim().toUpperCase(), qty=Number(document.getElementById('tc-tx-qty').value), price=Number(document.getElementById('tc-tx-price').value), date=document.getElementById('tc-tx-date').value || new Date().toISOString().slice(0,10), note=document.getElementById('tc-tx-note').value.trim();
    try {
      const cash=['DEPOT','RETRAIT','DIVIDENDE'].includes(t);
      if (cash) { if (!Number.isFinite(price)||price<=0) throw new Error('Le montant doit être supérieur à 0.'); }
      else { if (!ticker) throw new Error('Le ticker est obligatoire.'); if (!Number.isInteger(qty)||qty<=0) throw new Error('La quantité doit être un entier positif.'); if (!Number.isFinite(price)||price<=0) throw new Error('Le prix doit être supérieur à 0.'); }
      const body={ type:t, ticker: cash && (t==='DEPOT'||t==='RETRAIT') ? 'CASH' : ticker, quantity: cash ? 1 : qty, price: cash ? price : price, amount: cash ? price : undefined, date, note };
      await api('/api/portfolio-transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      form.reset(); document.getElementById('tc-tx-date').value=new Date().toISOString().slice(0,10); window.toast?.('Opération enregistrée','success'); await load(true);
    } catch(err) { window.toast?.(err.message || 'Impossible d’enregistrer l’opération','error'); }
  }

  async function load(showError) {
    try {
      const [tx, watch, cours, companies] = await Promise.all([
        api('/api/portfolio-transactions'),
        api('/api/user-data?mode=watchlist'),
        api('/api/marche?type=cours&limit=1000'),
        api('/api/marche?type=entreprises')
      ]);
      state.transactions=rows(tx); state.watch=rows(watch); state.cours=rows(cours); state.companies=rows(companies); render();
    } catch (e) { console.error('[SUIVI] load',e); if(showError) window.toast?.('Impossible de synchroniser le suivi : '+e.message,'error'); }
  }

  function boot() {
    css(); installView(); installNavigation(); rewriteNavigationLinks();
    const observer = new MutationObserver(() => rewriteNavigationLinks()); observer.observe(document.body,{childList:true,subtree:true});
    if (location.hash === '#suivi') window.nav('suivi', true);
    setTimeout(() => { rewriteNavigationLinks(); if (location.hash === '#suivi') window.nav('suivi', true); }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
