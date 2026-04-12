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

    let text = parsed.text
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/–/g, "-")
      .trim();

    // -----------------------------
    // 1. DATE DE SÉANCE
    // -----------------------------
    let dateStr = new Date().toISOString().split("T")[0];
    const dateRegex =
      /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      const jour = dateMatch[2].padStart(2, "0");
      const mois = moisFr[dateMatch[3].toLowerCase()];
      const annee = dateMatch[4];
      if (mois) {
        dateStr = `${annee}-${mois}-${jour}`;
      }
    }

    // -----------------------------
    // 2. INDICES
    // -----------------------------
    const indicesInsert = [];
    const indiceRegex =
      /(BRVM\s*[-]\s*[A-Z\s]+|BRVM-[A-Z]+)\s+([\d\s]+,\d{2})\s+([+-]?\d+,\d{2})\s*%/gi;
    let match;
    while ((match = indiceRegex.exec(text)) !== null) {
      const indice = match[1].replace(/\s+/g, " ").trim();
      const valeur = parseFloat(
        match[2].replace(/\s/g, "").replace(",", ".")
      );
      const variation = parseFloat(match[3].replace(",", "."));
      if (!isNaN(valeur)) {
        indicesInsert.push({
          indice,
          date_seance: dateStr,
          valeur,
          variation,
        });
      }
    }

    const uniqueIndices = [];
    const seenIdx = new Set();
    for (const idx of indicesInsert) {
      const key = `${idx.indice}_${idx.date_seance}`;
      if (!seenIdx.has(key)) {
        seenIdx.add(key);
        uniqueIndices.push(idx);
      }
    }

    // -----------------------------
    // 3. ACTIONS
    // -----------------------------
    const coursInsert = [];

    // Regex basée sur la structure des lignes d'actions du PDF
    // Exemple : "CB SAFC SAFCA CI 7 000 7 000 7 435 6,21 % 3 679 26 254 870"
    const actionRegex =
      /(CB|CD|FIN|IND|ENE|SPU|TEL)\s+([A-Z]{3,5})\s+([A-Z\s']+?)\s+(CI|SN|BF|ML|BN|TG)?\s+([\d\s]+)\s+([\d\s]+)\s+([\d\s]+)\s+([+-]?\d+,\d{2})\s*%\s+([\d\s]+)\s+([\d\s]+)/gi;

    while ((match = actionRegex.exec(text)) !== null) {
      const secteur = match[1];
      const symbole = match[2];
      const nom = match[3].trim();
      const cours = parseFloat(match[7].replace(/\s/g, "")); // Clôture
      const variation = parseFloat(match[8].replace(",", "."));
      const volume = parseInt(match[9].replace(/\s/g, ""), 10);
      const valeur = parseInt(match[10].replace(/\s/g, ""), 10);

      if (!isNaN(cours)) {
        coursInsert.push({
          ticker: symbole,
          nom,
          secteur,
          date_seance: dateStr,
          cours,
          variation: isNaN(variation) ? null : variation,
          volume: isNaN(volume) ? null : volume,
          valeur: isNaN(valeur) ? null : valeur,
        });
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
      if (!error) insertedCours = finalCours.length;
    }

    if (uniqueIndices.length) {
      const { error } = await supabase
        .from("indices_brvm")
        .upsert(uniqueIndices, {
          onConflict: "indice,date_seance",
        });
      if (!error) insertedIndices = uniqueIndices.length;
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
    });

  } catch (err) {
    console.error("BOC error:", err);
    return res.status(500).json({
      error: err.message,
    });
  }
}
