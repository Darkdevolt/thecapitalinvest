import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_TOKEN = "thecapital_admin:TheCapital@BRVM2026!";

const moisFr = {
  janvier: "01", "f\u00e9vrier": "02", mars: "03", avril: "04",
  mai: "05", juin: "06", juillet: "07", "ao\u00fbt": "08",
  septembre: "09", octobre: "10", novembre: "11", "d\u00e9cembre": "12",
};

const SECTEURS = new Set(["CB", "CD", "FIN", "IND", "ENE", "SPU", "TEL"]);

// Regex : nombre entier avec séparateur millier optionnel ("12 300", "3 147 800", "34")
const NUM_RE = /\d{1,3}(?: \d{3})*/g;

/**
 * Parse une ligne de cours d'action.
 * Utilise la première occurrence de "±X,XX %" comme ancre :
 *  - à gauche : SYMBOLE NOM COURS_PREC COURS_OUV COURS_CLOT
 *  - à droite : VOLUME VALEUR_TOTALE ...
 */
function parseActionLine(line) {
  const varMatch = line.match(/([+-]?\d+,\d{2})\s*%/);
  if (!varMatch) return null;

  const variation = parseFloat(varMatch[1].replace(",", "."));
  const varPos    = varMatch.index;
  const before    = line.slice(0, varPos).trim();
  const after     = line.slice(varPos + varMatch[0].length).trim();

  // Symbole = premier mot tout-majuscules, 2-5 caractères
  const symMatch = before.match(/^([A-Z]{2,5})\s+/);
  if (!symMatch) return null;
  const ticker = symMatch[1];

  // Nom = texte entre le symbole et le premier chiffre
  const rest         = before.slice(symMatch[0].length);
  const firstNumIdx  = rest.search(/\d/);
  if (firstNumIdx < 0) return null;
  const nom = rest.slice(0, firstNumIdx).trim();
  if (!nom) return null;

  // Extraire tous les entiers de `before` (les 3 derniers = prec, ouv, clot)
  const nums = [...before.matchAll(NUM_RE)].map(m => parseInt(m[0].replace(/ /g, ""), 10));
  if (nums.length < 3) return null;
  const coursPrec = nums[nums.length - 3];
  const coursOuv  = nums[nums.length - 2];
  const coursClot = nums[nums.length - 1];
  if (coursClot <= 0) return null;

  // Volume et valeur dans la partie droite
  const afterNums = [...after.matchAll(NUM_RE)].map(m => parseInt(m[0].replace(/ /g, ""), 10));
  const volume = afterNums[0] ?? null;
  const valeur = afterNums[1] ?? null;

  return { ticker, nom, coursPrec, coursOuv, coursClot, variation, volume, valeur };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");

  if (req.method === "OPTIONS") return res.status(200).end();

  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "Non autorisé" });
  if (req.method !== "POST")  return res.status(405).json({ error: "POST requis" });

  try {
    const { file, filename } = req.body;
    if (!file) return res.status(400).json({ error: "Fichier requis" });

    const buffer = Buffer.from(file, "base64");
    const parsed = await pdfParse(buffer);

    // ── 1. NETTOYAGE ─────────────────────────────────────────────────────────
    const text = parsed.text
      .replace(/"/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\u2013/g, "-")
      .trim();

    // ── 2. DATE ──────────────────────────────────────────────────────────────
    // CORRECTION : pdf-parse mélange parfois les colonnes de la page 1.
    // On cherche la date sur l'ensemble du texte (le BOC inclut toujours le
    // nom complet du jour de semaine + date en toutes lettres).
    let dateStr = new Date().toISOString().split("T")[0];
    const dateRegex = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s*(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})/i;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      const jour  = dateMatch[1].padStart(2, "0");
      const moisKey = dateMatch[2].toLowerCase()
        .replace(/[éè]/g, "e").replace(/û/g, "u").replace(/é/g, "e"); // normalize accents for lookup
      // Try direct lookup first, then normalized
      const mois = moisFr[dateMatch[2].toLowerCase()] ?? moisFr[moisKey];
      const annee = dateMatch[3];
      if (mois) dateStr = `${annee}-${mois}-${jour}`;
    }

    // ── 3. INDICES ───────────────────────────────────────────────────────────
    const indicesInsert = [];
    const indicePatterns = [
      { name: "BRVM COMPOSITE", re: /BRVM\s+COMPOSITE\s+([\d ,]+)\s+Variation\s+Jour\s+([+-]?\d+,\d{2})\s*%/i },
      { name: "BRVM 30",        re: /BRVM\s+30\s+([\d ,]+)\s+Variation\s+Jour\s+([+-]?\d+,\d{2})\s*%/i },
      { name: "BRVM PRESTIGE",  re: /BRVM\s+PRESTIGE\s+([\d ,]+)\s+Variation\s+Jour\s+([+-]?\d+,\d{2})\s*%/i },
    ];
    for (const { name, re } of indicePatterns) {
      const m = text.match(re);
      if (!m) continue;
      const valeur    = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
      const variation = parseFloat(m[2].replace(",", "."));
      if (!isNaN(valeur)) {
        indicesInsert.push({ indice: name, date_seance: dateStr, valeur, variation: isNaN(variation) ? null : variation });
      }
    }

    // ── 4. ACTIONS ───────────────────────────────────────────────────────────
    // CORRECTION PRINCIPALE : dans le texte brut extrait par pdf-parse,
    // le code secteur (CB, FIN, TEL…) est sur une LIGNE SÉPARÉE, pas en préfixe.
    // Format réel (exemple page 3 du BOC) :
    //   "NTLC NESTLE CI 12 300 12 300 12 280 -0,16 % 256 3 147 800 ..."
    //   "CB"
    //   "PALC PALM CI 8 700 8 700 8 600 -1,15 % ..."
    //   "CB"
    //   ...
    const coursInsert = [];
    const lines = text.split("\n");
    let inActionSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Bascule sur/hors de la section actions
      if (/COMPARTIMENT PRESTIGE|COMPARTIMENT PRINCIPAL/i.test(line)) {
        inActionSection = true;
        continue;
      }
      if (inActionSection && /TOTAL\s*-\s*MARCHE DES ACTIONS|MARCHE DES DROITS|MARCHE DES OBLIGATIONS/i.test(line)) {
        inActionSection = false;
        continue;
      }
      if (!inActionSection) continue;

      // Sauter les lignes récapitulatives et les lignes "secteur seul"
      if (/^TOTAL\b/i.test(line)) continue;
      if (SECTEURS.has(line.split(" ")[0]) && line.length < 15) continue;

      const data = parseActionLine(line);
      if (!data) continue;
      if (/^(COMPARTIMENT|TOTAL|MARCHE|INDICE)/i.test(data.ticker)) continue;

      // Secteur : chercher sur les lignes immédiatement avant/après
      let secteur = null;
      for (const offset of [-1, 1, -2, 2]) {
        const idx  = i + offset;
        if (idx < 0 || idx >= lines.length) continue;
        const cand = lines[idx].trim();
        if (SECTEURS.has(cand.split(" ")[0]) && cand.length < 12) {
          secteur = cand.split(" ")[0];
          break;
        }
      }

      coursInsert.push({
        ticker:          data.ticker,
        nom:             data.nom,
        secteur,
        date_seance:     dateStr,
        cours:           data.coursClot,
        cours_ouverture: data.coursOuv,
        cours_precedent: data.coursPrec,
        variation:       data.variation,
        volume:          data.volume,
        valeur:          data.valeur,
      });
    }

    // Déduplication
    const finalCours   = Array.from(new Map(coursInsert.map(c  => [`${c.ticker}_${c.date_seance}`, c ])).values());
    const finalIndices = Array.from(new Map(indicesInsert.map(i => [`${i.indice}_${i.date_seance}`, i ])).values());

    // ── 5. SUPABASE ──────────────────────────────────────────────────────────
    let insertedCours   = 0;
    let insertedIndices = 0;

    if (finalCours.length) {
      const { error: errC } = await supabase
        .from("cours_brvm")
        .upsert(finalCours, { onConflict: "ticker,date_seance" });
      if (!errC) insertedCours = finalCours.length;
      else console.error("Erreur cours:", errC);
    }
    if (finalIndices.length) {
      const { error: errI } = await supabase
        .from("indices_brvm")
        .upsert(finalIndices, { onConflict: "indice,date_seance" });
      if (!errI) insertedIndices = finalIndices.length;
      else console.error("Erreur indices:", errI);
    }

    // ── 6. STORAGE & LOG ─────────────────────────────────────────────────────
    const safeFileName = filename || `BOC_${dateStr}.pdf`;
    const filePath     = `${dateStr}/${Date.now()}_${safeFileName}`;

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
      success:          true,
      date:             dateStr,
      cours_importes:   insertedCours,
      indices_importes: insertedIndices,
      pdf_url:          urlData.publicUrl,
      debug: {
        tickers: finalCours.map(c => c.ticker),
        indices: finalIndices.map(i => i.indice),
      },
    });

  } catch (err) {
    console.error("BOC error:", err);
    return res.status(500).json({ error: err.message });
  }
}
