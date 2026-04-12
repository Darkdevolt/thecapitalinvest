import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";

const moisFr = {
  janvier: "01", février: "02", mars: "03", avril: "04",
  mai: "05", juin: "06", juillet: "07", août: "08",
  septembre: "09", octobre: "10", novembre: "11", décembre: "12",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");

  if (req.method === "OPTIONS") return res.status(200).end();

  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST requis" });
  }

  try {
    const { file, filename } = req.body;
    if (!file) {
      return res.status(400).json({ error: "Fichier requis" });
    }

    const buffer = Buffer.from(file, "base64");
    const parsed = await pdfParse(buffer);

    let text = parsed.text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/–/g, "-")
      .replace(/\u00A0/g, " ")
      .trim();

    // -----------------------------
    // 1. DATE
    // -----------------------------
    let dateStr = new Date().toISOString().split("T")[0];
    const dateRegex = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i;
    const dateMatch = text.match(dateRegex);
    
    if (dateMatch) {
      const jour = dateMatch[1].padStart(2, "0");
      const mois = moisFr[dateMatch[2].toLowerCase()];
      const annee = dateMatch[3];
      if (mois) dateStr = `${annee}-${mois}-${jour}`;
    }

    // -----------------------------
    // 2. INDICES
    // -----------------------------
    const indicesInsert = [];
    const indicePatterns = [
      { name: "BRVM COMPOSITE", regex: /BRVM\s+COMPOSITE[\s\S]{0,50}?(\d[\d\s]*,\d{2})[\s\S]{0,50}?Variation\s+Jour[\s\S]{0,30}?([+-]?\d+,\d{2})\s*%/i },
      { name: "BRVM 30", regex: /BRVM\s+30[\s\S]{0,50}?(\d[\d\s]*,\d{2})[\s\S]{0,50}?Variation\s+Jour[\s\S]{0,30}?([+-]?\d+,\d{2})\s*%/i },
      { name: "BRVM PRESTIGE", regex: /BRVM\s+PRESTIGE[\s\S]{0,50}?(\d[\d\s]*,\d{2})[\s\S]{0,50}?Variation\s+Jour[\s\S]{0,30}?([+-]?\d+,\d{2})\s*%/i }
    ];

    for (const pattern of indicePatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const valeur = parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
        const variation = parseFloat(match[2].replace(",", "."));
        if (!isNaN(valeur)) {
          indicesInsert.push({
            indice: pattern.name,
            date_seance: dateStr,
            valeur,
            variation: isNaN(variation) ? null : variation,
          });
        }
      }
    }

    // -----------------------------
    // 3. ACTIONS (NOUVELLE APPROCHE : DE LA FIN VERS LE DÉBUT)
    // -----------------------------
    const coursInsert = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 30);
    
    // Pattern pour les 6 dernières valeurs numériques (cours_prec, cours_ouv, cours_clot, variation%, volume, valeur)
    const dataEndPattern = /(\d[\d\s]*)\s+(\d[\d\s]*)\s+(\d[\d\s]*)\s+([+-]?\d+,\d{2})\s*%\s+([\d\s]+)\s+([\d\s]+)$/;
    
    for (const line of lines) {
      // Vérifier d'abord si la ligne finit par les données numériques attendues
      const dataMatch = line.match(dataEndPattern);
      if (!dataMatch) continue;
      
      // Extraire les données numériques
      const coursPrec = parseFloat(dataMatch[1].replace(/\s/g, ""));
      const coursOuv = parseFloat(dataMatch[2].replace(/\s/g, ""));
      const coursClot = parseFloat(dataMatch[3].replace(/\s/g, ""));
      const variation = parseFloat(dataMatch[4].replace(",", "."));
      const volume = parseInt(dataMatch[5].replace(/\s/g, ""), 10);
      const valeur = parseInt(dataMatch[6].replace(/\s/g, ""), 10);
      
      // Isoler le début de la ligne (avant les données numériques)
      const beforeData = line.substring(0, line.length - dataMatch[0].length).trim();
      
      // Maintenant chercher SECTEUR et TICKER dans ce début
      // Format: SECTEUR TICKER NOM
      const headerPattern = /^(CB|CD|FIN|IND|ENE|SPU|TEL)\s+([A-Z]{2,5})\s+(.+)$/;
      const headerMatch = beforeData.match(headerPattern);
      
      if (headerMatch) {
        const secteur = headerMatch[1];
        const ticker = headerMatch[2];
        const nom = headerMatch[3].trim();
        
        // Validation
        if (!isNaN(coursClot) && nom.length >= 2) {
          coursInsert.push({
            ticker,
            nom,
            secteur,
            date_seance: dateStr,
            cours: coursClot,
            cours_ouverture: isNaN(coursOuv) ? null : coursOuv,
            cours_precedent: isNaN(coursPrec) ? null : coursPrec,
            variation: isNaN(variation) ? null : variation,
            volume: isNaN(volume) ? null : volume,
            valeur: isNaN(valeur) ? null : valeur,
          });
        }
      }
    }

    // Suppression des doublons
    const seenTickers = new Set();
    const finalCours = coursInsert.filter(c => {
      const key = `${c.ticker}_${c.date_seance}`;
      if (seenTickers.has(key)) return false;
      seenTickers.add(key);
      return true;
    });

    const seenIdx = new Set();
    const uniqueIndices = indicesInsert.filter(idx => {
      const key = `${idx.indice}_${idx.date_seance}`;
      if (seenIdx.has(key)) return false;
      seenIdx.add(key);
      return true;
    });

    // -----------------------------
    // 4. INSERTION SUPABASE
    // -----------------------------
    let insertedCours = 0;
    let insertedIndices = 0;

    if (finalCours.length) {
      const { error } = await supabase
        .from("cours_brvm")
        .upsert(finalCours, { onConflict: "ticker,date_seance" });
      
      if (error) {
        console.error("Erreur insertion cours:", error);
      } else {
        insertedCours = finalCours.length;
      }
    }

    if (uniqueIndices.length) {
      const { error } = await supabase
        .from("indices_brvm")
        .upsert(uniqueIndices, { onConflict: "indice,date_seance" });
      
      if (error) {
        console.error("Erreur insertion indices:", error);
      } else {
        insertedIndices = uniqueIndices.length;
      }
    }

    // -----------------------------
    // 5. UPLOAD PDF
    // -----------------------------
    const safeFileName = filename || `BOC_${dateStr}.pdf`;
    const filePath = `${dateStr}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("boc_pdfs")
      .upload(filePath, buffer, { contentType: "application/pdf" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("boc_pdfs").getPublicUrl(filePath);
    
    await supabase.from("boc_imports").insert({
      date_seance: dateStr,
      fichier_nom: safeFileName,
      fichier_url: urlData.publicUrl,
    });

    return res.status(200).json({
      success: true,
      date: dateStr,
      cours_importes: insertedCours,
      indices_importes: insertedIndices,
      pdf_url: urlData.publicUrl,
      debug: {
        total_lignes_scannees: lines.length,
        actions_detectees: coursInsert.length,
        exemple_lignes: lines.slice(200, 210), // Affiche 10 lignes du milieu pour debug
        premiers_tickers: finalCours.slice(0, 5).map(c => ({ ticker: c.ticker, nom: c.nom }))
      }
    });

  } catch (err) {
    console.error("BOC error:", err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
