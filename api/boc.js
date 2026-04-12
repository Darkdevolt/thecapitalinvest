import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode POST requise' });
  }

  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'Fichier base64 requis' });

    const buffer = Buffer.from(file, 'base64');
    const parsed = await pdfParse(buffer);
    const text = parsed.text;

    // Extraction de la date de séance
    const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const dateStr = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().split('T')[0];

    // --- PARSING DES INDICES (exemple basique) ---
    const indicesInsert = [];
    const indicesPattern = /(BRVM\s*(?:COMPOSITE|30|PRESTIGE|-\s*[A-Z\s]+))\s+([\d\s]+[.,]\d{2})\s+([+-]?\d+[.,]\d{2})%/gi;
    let match;
    while ((match = indicesPattern.exec(text)) !== null) {
      const indice = match[1].trim();
      const valeur = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
      const variation = parseFloat(match[3].replace(',', '.'));
      indicesInsert.push({ indice, date_seance: dateStr, valeur, variation });
    }

    // --- PARSING DES COURS (exemple basique) ---
    const coursInsert = [];
    const lignePattern = /([A-Z]{4})\s+([\d\s]+)\s+([\d\s]+)\s+([+-]?\d+[.,]\d{2})%/g;
    while ((match = lignePattern.exec(text)) !== null) {
      const ticker = match[1];
      const cours = parseFloat(match[2].replace(/\s/g, ''));
      const volume = parseInt(match[3].replace(/\s/g, ''), 10);
      const variation = parseFloat(match[4].replace(',', '.'));
      coursInsert.push({
        ticker,
        date_seance: dateStr,
        cours,
        volume: isNaN(volume) ? null : volume,
        variation
      });
    }

    // Insertion dans Supabase
    let insertedCours = 0, insertedIndices = 0;
    if (coursInsert.length) {
      const { error } = await supabase
        .from('cours_brvm')
        .upsert(coursInsert, { onConflict: 'ticker,date_seance' });
      if (!error) insertedCours = coursInsert.length;
    }
    if (indicesInsert.length) {
      const { error } = await supabase
        .from('indices_brvm')
        .upsert(indicesInsert, { onConflict: 'indice,date_seance' });
      if (!error) insertedIndices = indicesInsert.length;
    }

    return res.status(200).json({
      success: true,
      date: dateStr,
      cours_importes: insertedCours,
      indices_importes: insertedIndices,
      raw_sample: text.slice(0, 500)
    });

  } catch (err) {
    console.error('BOC parsing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
