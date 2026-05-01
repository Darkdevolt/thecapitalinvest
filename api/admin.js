import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_KEY requises');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function isAdmin(token) {
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profil } = await supabase.from('profils').select('is_admin, plan, email').eq('id', user.id).single();
  if (!profil?.is_admin) return null;
  return { ...user, ...profil };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const admin = await isAdmin(token);
  const action = req.query.action;

  if (action === 'check') {
    if (!admin) return res.status(403).json({ is_admin: false });
    return res.status(200).json({ is_admin: true, email: admin.email });
  }

  if (!admin) return res.status(403).json({ error: 'Accès refusé' });

  if (action === 'stats') {
    const [e, c, h, f, d, u, lu] = await Promise.all([
      supabase.from('entreprises').select('ticker', { count: 'exact', head: true }).eq('actif', true),
      supabase.from('cours_brvm').select('ticker', { count: 'exact', head: true }),
      supabase.from('historique_cours').select('id', { count: 'exact', head: true }),
      supabase.from('financials_annuels').select('id', { count: 'exact', head: true }),
      supabase.from('dividendes_calendrier').select('id', { count: 'exact', head: true }),
      supabase.from('profils').select('id', { count: 'exact', head: true }),
      supabase.from('cours_brvm').select('date_seance, scrape_at').order('scrape_at', { ascending: false }).limit(1)
    ]);
    return res.status(200).json({
      entreprises: e.count, cours: c.count, historique: h.count,
      financials: f.count, dividendes: d.count, users: u.count,
      last_seance: lu.data?.[0]?.date_seance || null,
      last_scrape: lu.data?.[0]?.scrape_at ? new Date(lu.data[0].scrape_at).toLocaleString('fr-FR') : null
    });
  }

  if (action === 'fallback' && req.method === 'POST') {
    const { data: tickers } = await supabase.from('entreprises').select('ticker, nom').eq('actif', true);
    let updated = 0;
    for (const e of (tickers || [])) {
      const { data: last } = await supabase.from('historique_cours').select('date_seance, cloture, volume').eq('ticker', e.ticker).order('date_seance', { ascending: false }).limit(2);
      if (!last?.length) continue;
      const curr = last[0], prev = last[1];
      const variation = prev?.cloture ? Math.round(((curr.cloture - prev.cloture) / prev.cloture) * 10000) / 100 : 0;
      await supabase.from('cours_brvm').upsert({ ticker: e.ticker, societe: e.nom, cours: curr.cloture, variation, volume: curr.volume || 0, date_seance: curr.date_seance, scrape_at: new Date().toISOString() }, { onConflict: 'ticker' });
      updated++;
    }
    return res.status(200).json({ success: true, updated });
  }

  if (action === 'boc' && req.method === 'POST') {
    const { date_seance, fichier_nom, fichier_url } = req.body || {};
    if (!date_seance || !fichier_nom || !fichier_url) return res.status(400).json({ error: 'Champs manquants' });
    const { error } = await supabase.from('boc_imports').insert({ date_seance, fichier_nom, fichier_url });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === 'entreprises') {
    const { data, error } = await supabase.from('entreprises').select('ticker, nom, secteur, pays, compartiment, actif').order('ticker');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (action === 'toggle_actif' && req.method === 'POST') {
    const { ticker, actif } = req.body || {};
    const { error } = await supabase.from('entreprises').update({ actif, updated_at: new Date().toISOString() }).eq('ticker', ticker);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === 'financials') {
    const { data, error } = await supabase.from('financials_annuels').select('ticker, annee, chiffre_affaires, resultat_net, bpa, dpa, roe, marge_nette, source').order('annee', { ascending: false }).order('ticker');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (action === 'add_financial' && req.method === 'POST') {
    const body = req.body || {};
    if (body.chiffre_affaires && body.resultat_net) {
      body.marge_nette = Math.round((body.resultat_net / body.chiffre_affaires) * 10000) / 100;
    }
    const { error } = await supabase.from('financials_annuels').upsert(body, { onConflict: 'ticker,annee' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === 'analyses') {
    const { data, error } = await supabase.from('analyses').select('*').order('date_analyse', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (action === 'add_analyse' && req.method === 'POST') {
    const { error } = await supabase.from('analyses').insert({ ...req.body, date_analyse: new Date().toISOString().split('T')[0] });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === 'delete_analyse' && req.method === 'DELETE') {
    const { error } = await supabase.from('analyses').delete().eq('id', req.query.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === 'users') {
    const { data: profils, error } = await supabase.from('profils').select('id, nom, email, plan, plan_expire_at, is_admin, created_at').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: profils });
  }

  if (action === 'set_plan' && req.method === 'POST') {
    const { user_id, plan } = req.body || {};
    const expire = plan === 'pro' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
    const { error } = await supabase.from('profils').update({ plan, plan_expire_at: expire }).eq('id', user_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: 'Action inconnue' });
}
