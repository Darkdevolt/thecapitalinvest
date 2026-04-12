import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";

// Dictionnaire des mois en français
const moisFr = {
  'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
  'juillet': '07', 'août': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
};

export default async function handler(req, res) {
  // CORS et vérification token (inchangé)
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
    const { file, filename } = req.body;
    if (!file) return res.status(400).json({ error: 'Fichier base64 requis' });

    const buffer = Buffer.from(file, 'base64');
    const parsed = await pdfParse(buffer);
    
    // Remplacer les sauts de ligne par des espaces pour faciliter les regex
    const text = parsed.text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // 1. DATE DE SÉANCE
    let dateStr = new Date().toISOString().split('T')[0];
    // Recherche explicite de "Vendredi 10 avril 2026"
    const dateMatch = text.match(/([A-Za-z]+)\s+(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i);
    if (dateMatch) {
      const jour = dateMatch[2].padStart(2, '0');
      const mois = moisFr[dateMatch[3].toLowerCase()] || '01';
      const annee = dateMatch[4];
      dateStr = `${annee}-${mois}-${jour}`;
    }

    // 2. INDICES
    const indicesInsert = [];
    // Motif qui capture "BRVM-PRESTIGE 12 158,70 -0,04 %" et "BRVM - TELECOMMUNICATIONS 3 102,65 -0,27 %"
    const indiceRegex = /(BRVM[-\s]+[A-Z\s]+)\s+\d+\s+([\d\s]+[.,]\d{2})\s+([+-]?\d+[.,]\d{2})\s*%/gi;
    let match;
    while ((match = indiceRegex.exec(text)) !== null) {
      const nom = match[1].trim().replace(/\s+/g, ' ');
      const valeur = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
      const variation = parseFloat(match[3].replace(',', '.'));
      if (!isNaN(valeur) && !isNaN(variation)) {
        indicesInsert.push({ indice: nom, date_seance: dateStr, valeur, variation });
      }
    }
    // Nettoyage des doublons
    const uniqueIndices = [];
    const seenIdx = new Set();
    for (const idx of indicesInsert) {
      const key = `${idx.indice}_${idx.date_seance}`;
      if (!seenIdx.has(key)) {
        seenIdx.add(key);
        uniqueIndices.push(idx);
      }
    }

    // 3. COURS D'ACTIONS
    const coursInsert = [];
    // Motif pour les lignes du type "SAFCA CI (SAFC) 7 435 6,21 %"
    const actionRegex = /([A-Z]{4})\s+(?:CI|BN|BF|ML|NG|SN|TG)?\s*\([A-Z]{4}\)\s+([\d\s]+)\s+([+-]?\d+[.,]\d{1,2})\s*%/gi;
    while ((match = actionRegex.exec(text)) !== null) {
      const ticker = match[1];
      const cours = parseFloat(match[2].replace(/\s/g, ''));
      const variation = parseFloat(match[3].replace(',', '.'));
      if (!isNaN(cours) && !isNaN(variation)) {
        coursInsert.push({ ticker, date_seance: dateStr, cours, variation, volume: null });
      }
    }
    // Complément avec les cours de la section "QUANTITES RESIDUELLES" (pour les actions sans variation)
    const residuelleRegex = /([A-Z]{4})\s+[A-Z\s]+\s+[\d,]+\s+([\d\s]+[.,]\d{2,3})\s+\//gi;
    while ((match = residuelleRegex.exec(text)) !== null) {
      const ticker = match[1];
      const cours = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(cours)) {
        const existe = coursInsert.find(c => c.ticker === ticker);
        if (existe) {
          existe.cours = cours; // cours plus précis
        } else {
          coursInsert.push({ ticker, date_seance: dateStr, cours, variation: null, volume: null });
        }
      }
    }
    // Nettoyage des doublons (privilégier ceux avec variation)
    const finalCours = [];
    const seenTickers = new Set();
    coursInsert.sort((a, b) => (b.variation !== null ? 1 : 0) - (a.variation !== null ? 1 : 0));
    for (const c of coursInsert) {
      if (!seenTickers.has(c.ticker)) {
        seenTickers.add(c.ticker);
        finalCours.push(c);
      }
    }

    // 4. INSERTION DANS SUPABASE
    let insertedCours = 0, insertedIndices = 0;
    if (finalCours.length) {
      const { error } = await supabase.from('cours_brvm').upsert(finalCours, { onConflict: 'ticker,date_seance' });
      if (!error) insertedCours = finalCours.length;
    }
    if (uniqueIndices.length) {
      const { error } = await supabase.from('indices_brvm').upsert(uniqueIndices, { onConflict: 'indice,date_seance' });
      if (!error) insertedIndices = uniqueIndices.length;
    }

    // 5. STOCKAGE DU PDF (inchangé)
    const safeFileName = filename || `BOC_${dateStr}.pdf`;
    const filePath = `${dateStr}/${Date.now()}_${safeFileName}`;
    const { error: uploadError } = await supabase.storage
      .from('boc_pdfs')
      .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('boc_pdfs').getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;
    await supabase.from('boc_imports').insert({
      date_seance: dateStr,
      fichier_nom: safeFileName,
      fichier_url: publicUrl
    });

    return res.status(200).json({
      success: true,
      date: dateStr,
      cours_importes: insertedCours,
      indices_importes: insertedIndices,
      pdf_url: publicUrl,
      debug_cours_count: finalCours.length,
      debug_indices_count: uniqueIndices.length
    });

  } catch (err) {
    console.error('BOC error:', err);
    return res.status(500).json({ error: err.message });
  }
}
