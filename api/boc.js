import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";

const moisFr = {
  janvier: "01",
  février: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  août: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  décembre: "12",
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

    // Nettoyage amélioré du texte
    let text = parsed.text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/–/g, "-")
      .replace(/\u00A0/g, " ") // Espaces insécables
      .trim();

    console.log("Texte extrait (premiers 2000 caractères):", text.substring(0, 2000));

    // -----------------------------
    // 1. DATE DE SÉANCE
    // -----------------------------
    let dateStr = new Date().toISOString().split("T")[0];
    
    // Format: "vendredi 10 avril 2026" ou "10 avril 2026"
    const dateRegex = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i;
    const dateMatch = text.match(dateRegex);
    
    if (dateMatch) {
      const jour = dateMatch[1].padStart(2, "0");
      const mois = moisFr[dateMatch[2].toLowerCase()];
      const annee = dateMatch[3];
      if (mois) {
        dateStr = `${annee}-${mois}-${jour}`;
        console.log("Date trouvée:", dateStr);
      }
    }

    // -----------------------------
    // 2. INDICES (CORRIGÉ)
    // -----------------------------
    const indicesInsert = [];
    
    // Pattern pour BRVM COMPOSITE, BRVM 30, BRVM PRESTIGE
    // Le format est: Nom [texte intermédiaire] Valeur [texte] Variation Jour [texte] X,XX %
    const indicePatterns = [
      { name: "BRVM COMPOSITE", regex: /BRVM\s+COMPOSITE[\s\S]{0,50}?(\d{1,3}(?:\s?\d{3})*,\d{2})[\s\S]{0,100}?Variation\s+Jour[\s\S]{0,50}?([+-]?\d+,\d{2})\s*%/i },
      { name: "BRVM 30", regex: /BRVM\s+30[\s\S]{0,100}?(\d{1,3}(?:\s?\d{3})*,\d{2})[\s\S]{0,100}?Variation\s+Jour[\s\S]{0,50}?([+-]?\d+,\d{2})\s*%/i },
      { name: "BRVM PRESTIGE", regex: /BRVM\s+PRESTIGE[\s\S]{0,100}?(\d{1,3}(?:\s?\d{3})*,\d{2})[\s\S]{0,100}?Variation\s+Jour[\s\S]{0,50}?([+-]?\d+,\d{2})\s*%/i }
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
          console.log(`Indice trouvé: ${pattern.name} = ${valeur}, Var = ${variation}`);
        }
      }
    }

    // Fallback: recherche générique des indices
    const genericIndiceRegex = /(BRVM\s*[-]?\s*(?:COMPOSITE|30|PRESTIGE|[A-Z]+))\s+(\d{1,3}(?:\s?\d{3})*,\d{2})/gi;
    let match;
    while ((match = genericIndiceRegex.exec(text)) !== null) {
      const indiceName = match[1].replace(/\s+/g, " ").trim();
      // Vérifier si déjà ajouté
      if (!indicesInsert.find(i => i.indice === indiceName)) {
        const valeur = parseFloat(match[2].replace(/\s/g, "").replace(",", "."));
        // Chercher la variation proche
        const surroundingText = text.substring(Math.max(0, match.index - 100), match.index + 200);
        const varMatch = surroundingText.match(/Variation\s+Jour.*?([+-]?\d+,\d{2})\s*%/);
        const variation = varMatch ? parseFloat(varMatch[1].replace(",", ".")) : null;
        
        indicesInsert.push({
          indice: indiceName,
          date_seance: dateStr,
          valeur,
          variation,
        });
      }
    }

    // -----------------------------
    // 3. ACTIONS (CORRIGÉ)
    // -----------------------------
    const coursInsert = [];
    
    // Pattern amélioré pour les lignes d'actions
    // Format: SECTEUR SYMBOLE NOM COURS_PREC COURS_OUV COURS_CLOT VARIATION% VOLUME VALEUR
    const actionRegex = /(CB|CD|FIN|IND|ENE|SPU|TEL)\s+([A-Z]{2,5})\s+([A-Z][A-Z\s'&-]+?)\s+(\d[\d\s]*)\s+(\d[\d\s]*)\s+(\d[\d\s]*)\s+([+-]?\d+,\d{2})\s*%\s+(\d[\d\s]*)\s+(\d[\d\s]*)/gi;
    
    while ((match = actionRegex.exec(text)) !== null) {
      try {
        const secteur = match[1];
        const symbole = match[2];
        const nom = match[3].trim();
        const coursPrec = parseFloat(match[4].replace(/\s/g, ""));
        const coursOuv = parseFloat(match[5].replace(/\s/g, ""));
        const coursClot = parseFloat(match[6].replace(/\s/g, ""));
        const variation = parseFloat(match[7].replace(",", "."));
        const volume = parseInt(match[8].replace(/\s/g, ""), 10);
        const valeur = parseInt(match[9].replace(/\s/g, ""), 10);

        if (!isNaN(coursClot)) {
          coursInsert.push({
            ticker: symbole,
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
      } catch (e) {
        console.error("Erreur parsing action:", e);
      }
    }

    // Si aucune action trouvée, essayer avec une approche ligne par ligne (fallback)
    if (coursInsert.length === 0) {
      console.log("Tentative avec parsing ligne par ligne...");
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      for (let i = 0; i < lines.length - 8; i++) {
        const secteurs = ['CB', 'CD', 'FIN', 'IND', 'ENE', 'SPU', 'TEL'];
        if (secteurs.includes(lines[i]) && lines[i+1].match(/^[A-Z]{2,5}$/)) {
          // Potentielle ligne d'action
          try {
            const secteur = lines[i];
            const symbole = lines[i+1];
            const nom = lines[i+2];
            const cloture = parseFloat(lines[i+5].replace(/\s/g, ""));
            const variation = parseFloat(lines[i+6].replace(/[+%\s]/g, "").replace(",", "."));
            const volume = parseInt(lines[i+7].replace(/\s/g, ""));
            const valeur = parseInt(lines[i+8].replace(/\s/g, ""));
            
            if (!isNaN(cloture)) {
              coursInsert.push({
                ticker: symbole,
                nom,
                secteur,
                date_seance: dateStr,
                cours: cloture,
                variation: isNaN(variation) ? null : variation,
                volume: isNaN(volume) ? null : volume,
                valeur: isNaN(valeur) ? null : valeur,
              });
            }
          } catch (e) {
            // Ignorer les erreurs de parsing ligne par ligne
          }
        }
      }
    }

    console.log(`Actions trouvées: ${coursInsert.length}`);
    console.log(`Indices trouvés: ${indicesInsert.length}`);

    // Suppression des doublons
    const uniqueIndices = [];
    const seenIdx = new Set();
    for (const idx of indicesInsert) {
      const key = `${idx.indice}_${idx.date_seance}`;
      if (!seenIdx.has(key)) {
        seenIdx.add(key);
        uniqueIndices.push(idx);
      }
    }

    const finalCours = [];
    const seenTickers = new Set();
    for (const c of coursInsert) {
      const key = `${c.ticker}_${c.date_seance}`;
      if (!seenTickers.has(key)) {
        seenTickers.add(key);
        finalCours.push(c);
      }
    }

    // -----------------------------
    // 4. INSERTION SUPABASE
    // -----------------------------
    let insertedCours = 0;
    let insertedIndices = 0;

    if (finalCours.length) {
      const { error } = await supabase
        .from("cours_brvm")
        .upsert(finalCours, {
          onConflict: "ticker,date_seance",
        });
      if (error) {
        console.error("Erreur insertion cours:", error);
      } else {
        insertedCours = finalCours.length;
      }
    }

    if (uniqueIndices.length) {
      const { error } = await supabase
        .from("indices_brvm")
        .upsert(uniqueIndices, {
          onConflict: "indice,date_seance",
        });
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
      .upload(filePath, buffer, {
        contentType: "application/pdf",
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("boc_pdfs")
      .getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    await supabase.from("boc_imports").insert({
      date_seance: dateStr,
      fichier_nom: safeFileName,
      fichier_url: publicUrl,
    });

    return res.status(200).json({
      success: true,
      date: dateStr,
      cours_importes: insertedCours,
      indices_importes: insertedIndices,
      pdf_url: publicUrl,
      details: {
        actions_detectees: coursInsert.length,
        indices_detectes: indicesInsert.length
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
