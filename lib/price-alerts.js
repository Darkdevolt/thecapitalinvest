/**
 * Alertes de prix : compare chaque alerte active au dernier cours de clôture
 * connu (table historique, alimentée toutes les 15 min en séance) et prévient
 * le client par e-mail. Une alerte atteinte est envoyée une seule fois puis
 * mise en pause ; le client la réarme depuis l'app (« activer »).
 * Appelée par api/process-brvm.js (scope price-alerts, pg_cron).
 */
import { supabaseAdmin } from './supabase.js';
import { mailerReady, sendMail, MAILS } from './mailer.js';

const LOOKBACK_DAYS = 10;

async function latestCloses(tickers) {
  const floor = new Date(Date.now() - LOOKBACK_DAYS * 86400e3).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin.from('historique')
    .select('ticker,date_seance,cours_cloture,cloture')
    .in('ticker', tickers).gte('date_seance', floor)
    .order('date_seance', { ascending: false });
  if (error) throw error;
  const out = new Map();
  for (const r of data || []) {
    if (out.has(r.ticker)) continue;
    const price = Number(r.cours_cloture ?? r.cloture);
    if (Number.isFinite(price) && price > 0) out.set(r.ticker, { price, date: r.date_seance });
  }
  return out;
}

export async function runPriceAlerts() {
  if (!mailerReady()) return { checked: 0, sent: 0, skipped: 'MAILER_UNAVAILABLE' };
  const { data: alerts, error } = await supabaseAdmin.from('alertes_cours')
    .select('id,user_id,ticker,type_alerte,seuil,note').eq('active', true);
  if (error) throw error;
  if (!alerts?.length) return { checked: 0, sent: 0 };

  const tickers = [...new Set(alerts.map(a => String(a.ticker).toUpperCase()))];
  const closes = await latestCloses(tickers);
  const hits = alerts.filter(a => {
    const q = closes.get(String(a.ticker).toUpperCase());
    const seuil = Number(a.seuil);
    if (!q || !Number.isFinite(seuil)) return false;
    return a.type_alerte === 'HAUSSE' ? q.price >= seuil : a.type_alerte === 'BAISSE' ? q.price <= seuil : false;
  });
  if (!hits.length) return { checked: alerts.length, sent: 0 };

  const userIds = [...new Set(hits.map(a => a.user_id))];
  const [{ data: users }, { data: companies }] = await Promise.all([
    supabaseAdmin.from('users').select('id,email,nom').in('id', userIds),
    supabaseAdmin.from('entreprises').select('ticker,nom').in('ticker', [...new Set(hits.map(a => String(a.ticker).toUpperCase()))])
  ]);
  const userById = new Map((users || []).map(u => [u.id, u]));
  const nameOf = new Map((companies || []).map(c => [c.ticker, c.nom]));

  let sent = 0; const failed = [];
  for (const a of hits) {
    const u = userById.get(a.user_id);
    const t = String(a.ticker).toUpperCase();
    const q = closes.get(t);
    if (!u?.email) continue;
    const m = MAILS.priceAlert({ nom: u.nom, ticker: t, societe: nameOf.get(t) || null, direction: a.type_alerte, seuil: Number(a.seuil), cours: q.price, date: q.date, note: a.note });
    const r = await sendMail({ to: u.email, name: u.nom, subject: m.subject, content: m.content });
    if (!r.sent) { failed.push(a.id); continue; }
    /* Mise en pause seulement si l'e-mail est parti : sinon on réessaie au passage suivant. */
    const { error: ue } = await supabaseAdmin.from('alertes_cours')
      .update({ active: false, triggered_at: new Date().toISOString(), triggered_price: q.price })
      .eq('id', a.id).eq('active', true);
    if (ue) console.error('[PRICE-ALERTS] mise à jour', a.id, ue.message);
    sent++;
  }
  return { checked: alerts.length, hits: hits.length, sent, failed: failed.length };
}
