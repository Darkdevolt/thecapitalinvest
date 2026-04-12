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
    const text = parsed.text;

    // --- 1. Extraction de la date de séance ---
    // Recherche de "Vendredi 10 avril 2026" ou "vendredi 10 avril 2026"
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
    
    // Indices principaux : BRVM-PRESTIGE, BRVM-PRINCIPAL, BRVM - COMPOSITE TOTAL RETURN
    const indicePattern = /(BRVM\s*-\s*[A-Z\s]+|BRVM\s+[A-Z]+)\s+(\d+)\s+([\d,\.]+)\s+([+-]?\d+[,\d]*\s*%)\s+([+-]?\d+[,\d]*\s*%)/gi;
    let match;
    while ((match = indicePattern.exec(text)) !== null) {
      const nomIndice = match[1].trim().replace(/\s+/g, ' ');
      const valeur = parseFloat(match[3].replace(/,/g, '').replace(/\s/g, ''));
      const variation = parseFloat(match[4].replace('%', '').replace(/,/g, '').replace(/\s/g, ''));
      if (!isNaN(valeur) && !isNaN(variation)) {
        indicesInsert.push({
          indice: nomIndice,
          date_seance: dateStr,
          valeur,
          variation
        });
      }
    }

    // Indices sectoriels (format spécifique avec "BRVM - TELECOMMUNICATIONS" etc.)
    const sectorPattern = /(BRVM\s*-\s*[A-Z\s]+)\s+(\d+)\s+([\d,\.]+)\s+([+-]?\d+[,\d]*\s*%)\s+([+-]?\d+[,\d]*\s*%)/gi;
    while ((match = sectorPattern.exec(text)) !== null) {
      const nomIndice = match[1].trim().replace(/\s+/g, ' ');
      const valeur = parseFloat(match[3].replace(/,/g, '').replace(/\s/g, ''));
      const variation = parseFloat(match[4].replace('%', '').replace(/,/g, '').replace(/\s/g, ''));
      if (!isNaN(valeur) && !isNaN(variation) && !indicesInsert.find(i => i.indice === nomIndice && i.date_seance === dateStr)) {
        indicesInsert.push({
          indice: nomIndice,
          date_seance: dateStr,
          valeur,
          variation
        });
      }
    }

    // --- 3. Extraction des cours d'actions ---
    const coursInsert = [];
    
    // Recherche des blocs "Titres Cours Evol. Jour Evol. annuelle"
    // Le tableau commence souvent par "TitresCoursEvol. JourEvol. annuelle"
    const actionPattern = /([A-Z]{4})\s+(?:CI|BN|BF|ML|NG|SN|TG)?\s*\(?[A-Z]{4}\)?\s+([\d\s]+[.,]?\d*)\s+([+-]?\d+[.,]\d{1,2})\s*%/gi;
    // Autre motif plus robuste pour les actions avec volume (dans la partie "Quantités résiduelles")
    const actionWithVolumePattern = /([A-Z]{4})\s+[A-Z\s]+\s+[\d,]+\s+([\d\s]+[.,]\d{2})\s+\/\s+([\d\s]+[.,]\d{2})/gi;
    
    // Utiliser le texte complet
    // 3a. Extraire les cours et variations depuis les tableaux de hausses/baisses
    const simpleActionPattern = /([A-Z]{4})\s+CI\s*\([A-Z]{4}\)\s+([\d\s]+)\s+([+-]?\d+[.,]\d{2})\s*%/gi;
    while ((match = simpleActionPattern.exec(text)) !== null) {
      const ticker = match[1];
      const cours = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
      const variation = parseFloat(match[3].replace(',', '.'));
      if (!isNaN(cours) && !isNaN(variation)) {
        // Vérifier si le ticker existe déjà pour cette date
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

    // 3b. Extraire depuis le tableau principal avec volumes (page 10-11 "QUANTITES RESIDUELLES")
    const volumePattern = /([A-Z]{4})\s+[A-Z\s]+\s+[\d,]+\s+([\d\s]+[.,]\d{2})\s+\/\s+([\d\s]+[.,]\d{2})/gi;
    while ((match = volumePattern.exec(text)) !== null) {
      const ticker = match[1];
      const coursStr = match[2].replace(/\s/g, '').replace(',', '.');
      const cours = parseFloat(coursStr);
      if (!isNaN(cours)) {
        const existing = coursInsert.find(c => c.ticker === ticker && c.date_seance === dateStr);
        if (existing) {
          existing.cours = cours; // Mise à jour avec le cours plus précis
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

    // 3c. Essayer d'extraire les volumes (dans la même section)
    const volumeOnlyPattern = /([A-Z]{4})\s+.*?\s+(\d+(?:[.,]\d+)?)\s*$/gm;
    // Trop imprécis, on va plutôt chercher dans les premières pages le tableau "Volumes et valeurs transigés"
    const volumeGlobalPattern = /Volume échangé.*?(\d[\d\s]*)/i;
    const volumeMatch = text.match(volumeGlobalPattern);
    const volumeTotal = volumeMatch ? parseInt(volumeMatch[1].replace(/\s/g, '')) : null;

    // --- 4. Insertion dans Supabase ---
    let insertedCours = 0, insertedIndices = 0;

    if (coursInsert.length > 0) {
      const { error } = await supabase
        .from('cours_brvm')
        .upsert(coursInsert, { onConflict: 'ticker,date_seance' });
      if (!error) insertedCours = coursInsert.length;
      else console.error('Erreur insertion cours:', error);
    }

    if (indicesInsert.length > 0) {
      const { error } = await supabase
        .from('indices_brvm')
        .upsert(indicesInsert, { onConflict: 'indice,date_seance' });
      if (!error) insertedIndices = indicesInsert.length;
      else console.error('Erreur insertion indices:', error);
    }

    // --- 5. Upload du PDF dans le storage (comme avant) ---
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
      debug_cours_count: coursInsert.length,
      debug_indices_count: indicesInsert.length
    });

  } catch (err) {
    console.error('BOC parsing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
