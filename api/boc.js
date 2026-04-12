import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = Buffer.from("thecapital_admin:TheCapital@BRVM2026!").toString('base64').replace(/=/g, "");

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Non autorisé' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  try {
    const { file } = req.body; // base64
    if (!file) return res.status(400).json({ error: 'Fichier requis' });

    const buffer = Buffer.from(file, 'base64');
    const parsed = await pdfParse(buffer);
    
    // Extraction basique (à améliorer selon format BOC)
    const dateMatch = parsed.text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const dateStr = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];

    // TODO: Parser le tableau des cours selon structure exacte du PDF BRVM
    
    return res.status(200).json({
      date: dateStr,
      cours: 0,
      indices: 0,
      histo: 0,
      titre: 'BOC reçu - parsing à compléter'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
