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
    const { file, filename } = req.body;
    if (!file) return res.status(400).json({ error: 'Fichier base64 requis' });

    const buffer = Buffer.from(file, 'base64');
    const parsed = await pdfParse(buffer);
    const text = parsed.text.replace(/\n/g, ' ').replace(/\s+/g, ' '); // Normaliser les espaces

    // --- 1. Extraction de la date de séance ---
    // Chercher "Vendredi 10 avril 2026" ou "vendredi 10 avril 2026"
    let dateStr = new Date().toISOString().split('T')[0];
    const dateMatch = text.match(/([A-Za-z]+)\s+(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i);
    if (dateMatch) {
      const moisFr = {
        'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
        'juillet': '07', 'août': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
      };
      const jour = dateMatch[2].padStart(2, '0');
      const mois = moisFr[dateMatch[3].toLowerCase()] || '01';
      const annee = dateMatch[4];
      dateStr = `${annee}-${mois}-${jour}`;
    }

    // --- 2. Extraction des indices ---
    const indicesInsert = [];
    
    // Motif pour les indices principaux (ex: "BRVM-PRESTIGE 12 158,70 -0,04 % 10,02 %")
    const indicePrincipalPattern = /(BRVM\s*[-]?\s*[A-Z\s]+)\s+(\d+)\s+([\d\s]+[.,]\d{2})\s+([+-]?\d+[.,]\d{2})\s*%\s+([+-]?\d+[.,]\d{2})\s*%/gi;
    let match;
    while ((match = indicePrincipalPattern.exec(text)) !== null) {
      const nomIndice = match[1].trim().replace(/\s+/g, ' ');
      const valeurStr = match[3].replace(/\s/g, '').replace(',', '.');
      const variationStr = match[4].replace(',', '.');
      const valeur = parseFloat(valeurStr);
      const variation = parseFloat(variationStr);
      if (!isNaN(valeur) && !isNaN(variation)) {
        indicesInsert.push({
          indice: nomIndice,
          date_seance: dateStr,
          valeur,
          variation
        });
      }
    }

    // Motif pour les indices sectoriels (ex: "BRVM - TELECOMMUNICATIONS 3 102,65 -0,27 % 8,17 %")
    const indiceSectorielPattern = /(BRVM\s*-\s*[A-Z\s]+)\s+(\d+)\s+([\d\s]+[.,]\d{2})\s+([+-]?\d+[.,]\d{2})\s*%\s+([+-]?\d+[.,]\d{2})\s*%/gi;
    while ((match = indiceSectorielPattern.exec(text)) !== null) {
      const nomIndice = match[1].trim().replace(/\s+/g, ' ');
      const valeurStr = match[3].replace(/\s/g, '').replace(',', '.');
      const variationStr = match[4].replace(',', '.');
      const valeur = parseFloat(valeurStr);
      const variation = parseFloat(variationStr);
      if (!isNaN(valeur) && !isNaN(variation)) {
        indicesInsert.push({
          indice: nomIndice,
          date_seance: dateStr,
          valeur,
          variation
        });
      }
    }

    // --- 3. Extraction des cours d'actions (avec variation) ---
    const coursInsert = [];
    
    // Motif pour les lignes d'actions avec variation (ex: "SAFCA CI (SAFC) 7 435 6,21 % 124,96 %")
    const actionVarPattern = /([A-Z]{4})\s+(?:CI|BN|BF|ML|NG|SN|TG)?\s*\([A-Z]{4}\)\s+([\d\s]+)\s+([+-]?\d+[.,]\d{1,2})\s*%/gi;
    while ((match = actionVarPattern.exec(text)) !== null) {
      const ticker = match[1];
      const coursStr = match[2].replace(/\s/g, '');
      const variationStr = match[3].replace(',', '.');
      const cours = parseFloat(coursStr);
      const variation = parseFloat(variationStr);
      if (!isNaN(cours) && !isNaN(variation)) {
        // Vérifier si déjà présent
        const exists = coursInsert.find(c => c.ticker === ticker && c.date_seance === dateStr);
        if (!exists) {
          coursInsert.push({
            ticker,
            date_seance: dateStr,
            cours,
            variation,
            volume: null
          });
        }
      }
    }

    // Motif pour les lignes d'actions sans variation explicite (dans les tableaux "Titres Cours Evol. Jour Evol. annuelle")
    // Ex: "SAFCA CI (SAFC) 7 435 6,21 % 124,96 %"
    // La regex précédente capture déjà cela, mais vérifions aussi un motif plus large
    const actionFullPattern = /([A-Z]{4})\s+[A-Z\s]*\s*\([A-Z]{4}\)\s+([\d\s]+)\s+([+-]?\d+[.,]\d{1,2})\s*%\s+([+-]?\d+[.,]\d{1,2})\s*%/gi;
    while ((match = actionFullPattern.exec(text)) !== null) {
      const ticker = match[1];
      const coursStr = match[2].replace(/\s/g, '');
      const variationStr = match[3].replace(',', '.');
      const cours = parseFloat(coursStr);
      const variation = parseFloat(variationStr);
      if (!isNaN(cours) && !isNaN(variation)) {
        const exists = coursInsert.find(c => c.ticker === ticker && c.date_seance === dateStr);
        if (!exists) {
          coursInsert.push({
            ticker,
            date_seance: dateStr,
            cours,
            variation,
            volume: null
          });
        }
      }
    }

    // Motif pour les actions dans la section "QUANTITES RESIDUELLES" (sans variation)
    // Ex: "ABJC SERVAIR ABIDJAN CI 373,435 / 3,475 243 3 470"
    const actionVolumePattern = /([A-Z]{4})\s+[A-Z\s]+\s+[\d,]+\s+([\d\s]+[.,]\d{2,3})\s+\/\s+([\d\s]+[.,]\d{2,3})/gi;
    while ((match = actionVolumePattern.exec(text)) !== null) {
      const ticker = match[1];
      const coursStr = match[2].replace(/\s/g, '').replace(',', '.');
      const cours = parseFloat(coursStr);
      if (!isNaN(cours)) {
        const existing = coursInsert.find(c => c.ticker === ticker && c.date_seance === dateStr);
        if (existing) {
          existing.cours = cours; // Mettre à jour avec le cours le plus précis
        } else {
          coursInsert.push({
            ticker,
            date_seance: dateStr,
            cours,
            variation: null,
            volume: null
          });
        }
      }
    }

    // Nettoyer les doublons éventuels (garder celui avec variation si possible)
    const finalCours = [];
    const seenTickers = new Set();
    // Trier pour avoir d'abord ceux avec variation
    coursInsert.sort((a, b) => (b.variation !== null ? 1 : 0) - (a.variation !== null ? 1 : 0));
    for (const c of coursInsert) {
      if (!seenTickers.has(c.ticker)) {
        seenTickers.add(c.ticker);
        finalCours.push(c);
      }
    }

    // --- 4. Insertion dans Supabase ---
    let insertedCours = 0, insertedIndices = 0;

    if (finalCours.length > 0) {
      const { error } = await supabase
        .from('cours_brvm')
        .upsert(finalCours, { onConflict: 'ticker,date_seance' });
      if (!error) insertedCours = finalCours.length;
      else console.error('Erreur insertion cours:', error);
    }

    if (indicesInsert.length > 0) {
      // Nettoyer les doublons d'indices
      const uniqueIndices = [];
      const seenIndices = new Set();
      for (const idx of indicesInsert) {
        const key = `${idx.indice}_${idx.date_seance}`;
        if (!seenIndices.has(key)) {
          seenIndices.add(key);
          uniqueIndices.push(idx);
        }
      }
      const { error } = await supabase
        .from('indices_brvm')
        .upsert(uniqueIndices, { onConflict: 'indice,date_seance' });
      if (!error) insertedIndices = uniqueIndices.length;
      else console.error('Erreur insertion indices:', error);
    }

    // --- 5. Upload du PDF dans le storage ---
    const safeFileName = filename || `BOC_${dateStr}.pdf`;
    const filePath = `${dateStr}/${Date.now()}_${safeFileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('boc_pdfs')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: false
      });
    
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('boc_pdfs')
      .getPublicUrl(filePath);
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
      debug_indices_count: indicesInsert.length
    });

  } catch (err) {
    console.error('BOC parsing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
