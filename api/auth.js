import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password, nom } = req.body;

  try {
    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return res.status(200).json({ session: data.session });
    }

    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nom },
          emailRedirectTo: `${req.headers.origin || 'https://thecapitalinvest.vercel.app'}/`
        }
      });
      
      if (error) throw error;
      
      // Si auto-confirmation activée, retourner la session
      if (data.session) {
        return res.status(200).json({ session: data.session });
      }
      
      // Sinon, informer que l'email de confirmation a été envoyé
      return res.status(200).json({ 
        message: 'Vérifiez votre email pour confirmer votre compte',
        user: data.user 
      });
    }

    return res.status(400).json({ error: 'Action invalide' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(400).json({ error: error.message || 'Erreur authentification' });
  }
}
