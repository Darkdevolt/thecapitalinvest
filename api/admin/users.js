import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";
const ADMIN_TOKEN_B64 = Buffer.from(ADMIN_TOKEN).toString('base64').replace(/=/g, "");

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN_B64) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    if (req.method === 'GET') {
      // Utilisation de l'API Admin Supabase pour lister les utilisateurs
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;
      // On ne renvoie que les infos non sensibles
      const users = data.users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        raw_user_meta_data: u.user_metadata
      }));
      return res.status(200).json(users);
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('Admin users error:', err);
    return res.status(500).json({ error: err.message });
  }
}
