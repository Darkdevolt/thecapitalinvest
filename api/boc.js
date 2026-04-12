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

const SECTEURS = ['CB', 'CD', 'FIN', 'IND', 'ENE', 'SPU', 'TEL'];

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
    // 3. ACTIONS (RECHERCHE EXPLICITE)
    // -----------------------------
    const coursInsert = [];
    const allLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    let debugLines = [];
    
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      
      // Vérifier si la ligne commence par un secteur valide
      const secteurMatch = line.match(/^(CB|CD|FIN|IND|ENE|SPU|TEL)\s+/);
      if (!secteurMatch) continue;
      
      const secteur = secteurMatch[1];
      let rest = line.substring(secteurMatch[0].length).trim();
      
      // Extraire le ticker (2-5 lettres majuscules)
      const tickerMatch = rest.match(/^([A-Z]{2,5})\s+/);
      if (!tickerMatch) continue;
      
      const ticker = tickerMatch[1];
      rest = rest.substring(tickerMatch[0].length).trim();
      
      // Chercher les 6 nombres à la fin : cours_prec cours_ouv cours_clot variation% volume valeur
      // Format: 12 300 12 300 12 280 -0,16 % 256 3 147 800
      const numsMatch = rest.match(/([\d\s]+)\s+([\d\s]+)\s+([\d\s]+)\s+([+-]?\d+,\d{2})\s*%\s+([\d\s]+)\s+([\d\s]+)(?:\s+\d|$)/);
      
      if (!numsMatch) {
        // Essayer un format plus souple (sans espace avant %)
        const altMatch = rest.match(/([\d\s]+)\s+([\d\s]+)\s+([\d\s]+)\s+([+-]?\d+,\d{2})%\s+([\d\s]+)\s+([\d\s]+)/);
        if (!altMatch) {
          if (debugLines.length < 5) debugLines.push({line: line.substring(0, 100), reason: "no_nums_match"});
          continue;
        }
      }
      
      const m = numsMatch;
      const coursPrec = parseFloat(m[1].replace(/\s/g, ""));
      const coursOuv = parseFloat(m[2].replace(/\s/g, ""));
      const coursClot = parseFloat(m[3].replace(/\s/g, ""));
      const variation = parseFloat(m[4].replace(",", "."));
      const volume = parseInt(m[5].replace(/\s/g, ""), 10);
      const valeur = parseInt(m[6].replace(/\s/g, ""), 10);
      
      // Le nom est ce qui reste avant les nombres
      const nom = rest.substring(0, rest.indexOf(m[0])).trim() || rest.substring(0, rest.length - m[0].length).trim();
      
      if (!isNaN(coursClot) && nom.length >= 2 && !nom.match(/^\d+$/)) {
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
        total_lignes: allLines.length,
        actions_detectees: coursInsert.length,
        rejected_samples: debugLines,
        last_lines_checked: allLines.slice(-10) // Dernières lignes du fichier
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
