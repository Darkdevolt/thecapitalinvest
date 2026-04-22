// api/watchlist.js — Gestion de la watchlist utilisateur
import { createClient } from ‘@supabase/supabase-js’;

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET, POST, DELETE, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Authorization, Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();

// Récupérer l’utilisateur depuis le token
const token = (req.headers.authorization || ‘’).replace(’Bearer ’, ‘’);
if (!token) return res.status(401).json({ error: ‘Non authentifié’ });

const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
if (authErr || !user) return res.status(401).json({ error: ‘Token invalide’ });

// GET — Récupérer la watchlist avec les cours actuels
if (req.method === ‘GET’) {
const { data: wl, error } = await supabase
.from(‘watchlist’)
.select(‘id, ticker, note, created_at’)
.eq(‘user_id’, user.id)
.order(‘created_at’, { ascending: false });

```
if (error) return res.status(500).json({ error: error.message });

// Enrichir avec les cours depuis cours_brvm
const tickers = wl.map(w => w.ticker);
let cours = [];
if (tickers.length > 0) {
  const { data: c } = await supabase
    .from('cours_brvm')
    .select('ticker, societe, cours, variation')
    .in('ticker', tickers);
  cours = c || [];
}

const enriched = wl.map(w => {
  const c = cours.find(x => x.ticker === w.ticker);
  return { ...w, nom: c?.societe || null, cours: c?.cours || null, variation: c?.variation || null };
});

return res.status(200).json({ data: enriched });
```

}

// POST — Ajouter un titre
if (req.method === ‘POST’) {
const { ticker, note } = req.body || {};
if (!ticker) return res.status(400).json({ error: ‘Ticker requis’ });

```
// Vérifier que le ticker existe
const { data: e } = await supabase
  .from('entreprises')
  .select('ticker')
  .eq('ticker', ticker.toUpperCase())
  .single();
if (!e) return res.status(400).json({ error: `Ticker ${ticker} introuvable sur la BRVM` });

// Éviter les doublons
const { data: existing } = await supabase
  .from('watchlist')
  .select('id')
  .eq('user_id', user.id)
  .eq('ticker', ticker.toUpperCase())
  .single();
if (existing) return res.status(400).json({ error: `${ticker} est déjà dans votre watchlist` });

const { data, error } = await supabase
  .from('watchlist')
  .insert({ user_id: user.id, ticker: ticker.toUpperCase(), note: note || null })
  .select()
  .single();

if (error) return res.status(500).json({ error: error.message });
return res.status(201).json({ data });
```

}

// DELETE — Supprimer un titre
if (req.method === ‘DELETE’) {
const id = req.query.id;
if (!id) return res.status(400).json({ error: ‘ID requis’ });

```
const { error } = await supabase
  .from('watchlist')
  .delete()
  .eq('id', id)
  .eq('user_id', user.id);

if (error) return res.status(500).json({ error: error.message });
return res.status(200).json({ success: true });
```

}

return res.status(405).json({ error: ‘Méthode non autorisée’ });
}