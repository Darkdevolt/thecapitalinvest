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

    // 1. NETTOYAGE GLOBAL
    // On enlève les guillemets et on normalise les espaces/virgules de structure
    let text = parsed.text
      .replace(/"/g, "")           // Supprime les guillemets (très fréquents dans l'export pdf-parse)
      .replace(/ ,+/g, " ")        // Nettoie les virgules suivies d'espaces
      .replace(/, /g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")     // Espaces multiples -> simple
      .replace(/–/g, "-")
      .trim();

    // -----------------------------
    // 2. EXTRACTION DE LA DATE
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
    // 3. INDICES
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
    // 4. ACTIONS (COURS)
    // -----------------------------
    const coursInsert = [];
    const sectors = "CB|CD|FIN|IND|ENE|SPU|TEL";
    
    // Cette regex capture :
    // (Secteur + Ticker) OU (Ticker + Secteur) + Nom + 6 blocs numériques
    const actionRegex = new RegExp(
      `\\b(?:(${sectors})\\s+([A-Z]{2,5})|([A-Z]{2,5})\\s+(${sectors}))\\s+(.+?)\\s+` +
      `(\\d[\\d\\s\\.]*)\\s+` + // Cours Précédent
      `(\\d[\\d\\s\\.]*)\\s+` + // Cours Ouverture
      `(\\d[\\d\\s\\.]*)\\s+` + // Cours Clôture
      `([+-]?\\d+,\\d{2})\\s*%\\s+` + // Variation %
      `([\\d\\s\\.]+)\\s+` + // Volume
      `([\\d\\s\\.]+)`, // Valeur
      "g"
    );

    const parseBOCNumber = (str) => {
      if (!str) return null;
      // Enlever espaces et points (séparateurs de milliers) et remplacer virgule par point
      return parseFloat(str.replace(/[\s\.]/g, "").replace(",", "."));
    };

    let match;
    let matchCount = 0;
    
    while ((match = actionRegex.exec(text)) !== null) {
      matchCount++;
      
      const secteur = match[1] || match[4];
      const ticker = match[2] || match[3];
      const nom = match[5].trim();
      
      const coursPrec = parseBOCNumber(match[6]);
      const coursOuv = parseBOCNumber(match[7]);
      const coursClot = parseBOCNumber(match[8]);
      const variation = parseFloat(match[9].replace(",", "."));
      const volume = parseBOCNumber(match[10]);
      const valeur = parseBOCNumber(match[11]);
      
      if (ticker && !isNaN(coursClot) && nom.length > 1) {
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

    // Déduplication
    const finalCours = Array.from(new Map(coursInsert.map(c => [`${c.ticker}_${c.date_seance}`, c])).values());
    const finalIndices = Array.from(new Map(indicesInsert.map(i => [`${i.indice}_${i.date_seance}`, i])).values());

    // -----------------------------
    // 5. INSERTIONS SUPABASE
    // -----------------------------
    let insertedCours = 0;
    let insertedIndices = 0;

    if (finalCours.length) {
      const { error: errC } = await supabase.from("cours_brvm").upsert(finalCours, { onConflict: "ticker,date_seance" });
      if (!errC) insertedCours = finalCours.length;
      else console.error("Erreur cours:", errC);
    }

    if (finalIndices.length) {
      const { error: errI } = await supabase.from("indices_brvm").upsert(finalIndices, { onConflict: "indice,date_seance" });
      if (!errI) insertedIndices = finalIndices.length;
      else console.error("Erreur indices:", errI);
    }

    // -----------------------------
    // 6. STORAGE & LOG
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
        matches_detectes: matchCount,
        tickers: finalCours.map(c => c.ticker)
      }
    });

  } catch (err) {
    console.error("BOC error:", err);
    return res.status(500).json({ error: err.message });
  }
}
