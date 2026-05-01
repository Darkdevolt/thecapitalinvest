import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 30 };

// ── VALIDATION DES VARIABLES D'ENVIRONNEMENT ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_SECRET_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY || !ADMIN_TOKEN) {
  throw new Error('Variables d\'environnement SUPABASE_URL, SUPABASE_SERVICE_KEY et ADMIN_SECRET_TOKEN requises');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MOIS_FR = {
  janvier:"01", "février":"02", mars:"03", avril:"04",
  mai:"05", juin:"06", juillet:"07", "août":"08",
  septembre:"09", octobre:"10", novembre:"11", "décembre":"12",
};

const SECTEURS = new Set(["CB","CD","FIN","IND","ENE","SPU","TEL"]);
const NUM_RE = /\d{1,3}(?: \d{3})*/g;

async function extractLines(uint8Array) {
  const pdf = await getDocument({ data: uint8Array }).promise;
  const allLines = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();

    const lineMap = new Map();
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push({ x: item.transform[4], str: item.str });
    }

    const sorted = [...lineMap.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, items] of sorted) {
      items.sort((a, b) => a.x - b.x);
      const line = items.map(i => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (line) allLines.push(line);
    }
  }

  return allLines;
}

function parseActionLine(line) {
  const varMatch = line.match(/([+-]?\d+,\d{2})\s*%/);
  if (!varMatch) return null;

  const variation = parseFloat(varMatch[1].replace(",", "."));
  const before    = line.slice(0, varMatch.index).trim();
  const after     = line.slice(varMatch.index + varMatch[0].length).trim();

  const symMatch = before.match(/^([A-Z]{2,5})\s+/);
  if (!symMatch) return null;
  const ticker = symMatch[1];

  const rest       = before.slice(symMatch[0].length);
  const firstNumId = rest.search(/\d/);
  if (firstNumId < 0) return null;
  const nom = rest.slice(0, firstNumId).trim();
  if (!nom) return null;

  const nums = [...before.matchAll(NUM_RE)].map(m => parseInt(m[0].replace(/ /g, ""), 10));
  if (nums.length < 3) return null;

  const coursPrec = nums[nums.length - 3];
  const coursOuv  = nums[nums.length - 2];
  const coursClot = nums[nums.length - 1];
  if (coursClot <= 0) return null;

  const afterNums = [...after.matchAll(NUM_RE)].map(m => parseInt(m[0].replace(/ /g, ""), 10));

  return {
    ticker, nom, coursPrec, coursOuv, coursClot, variation,
    volume: afterNums[0] ?? null,
    valeur: afterNums[1] ?? null,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-admin-token"] !== ADMIN_TOKEN)
    return res.status(401).json({ error: "Non autorisé" });
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST requis" });

  const startTime = Date.now();

  try {
    const { file, filename } = req.body;
    if (!file) return res.status(400).json({ error: "Fichier requis" });

    const buffer = Buffer.from(file, "base64");
    const uint8  = new Uint8Array(buffer);

    // ── 1. EXTRACTION ────────────────────────────────────────────────────
    const lines = await extractLines(uint8);

    // ── 2. DATE ──────────────────────────────────────────────────────────
    let dateStr = new Date().toISOString().split("T")[0];
    let dateSource = "fallback (today)";
    const dateRE = /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s*(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})/i;

    for (const line of lines) {
      const m = line.match(dateRE);
      if (m) {
        const jour  = m[1].padStart(2, "0");
        const mois  = MOIS_FR[m[2].toLowerCase()];
        const annee = m[3];
        if (mois) {
          dateStr    = `${annee}-${mois}-${jour}`;
          dateSource = `"${line.trim()}"`;
          break;
        }
      }
    }

    // ── 3. INDICES ───────────────────────────────────────────────────────
    const indicesInsert = [];
    const indiceDebug   = {};
    const indiceTargets = [
      { name: "BRVM COMPOSITE", re: /^BRVM COMPOSITE ([\d,]+)/ },
      { name: "BRVM 30",        re: /\bBRVM 30 ([\d,]+)/       },
      { name: "BRVM PRESTIGE",  re: /\bBRVM PRESTIGE ([\d,]+)/ },
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const { name, re } of indiceTargets) {
        if (indiceDebug[name]) continue; // already found
        const m = lines[i].match(re);
        if (!m) continue;
        const valeur = parseFloat(m[1].replace(",", "."));
        if (isNaN(valeur)) continue;
        let variation = null;
        let varLine   = null;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const vm = lines[j].match(/([+-]?\d+,\d{2})\s*%/);
          if (vm) {
            variation = parseFloat(vm[1].replace(",", "."));
            varLine   = lines[j].trim();
            break;
          }
        }
        indicesInsert.push({ indice: name, date_seance: dateStr, valeur, variation });
        indiceDebug[name] = {
          valeur, variation,
          ligne_valeur:     lines[i].trim(),
          ligne_variation:  varLine,
        };
      }
    }

    // ── 4. ACTIONS ───────────────────────────────────────────────────────
    const coursInsert  = [];
    const parseErrors  = [];   // lignes rejetées dans la section actions
    const sectionLines = [];   // toutes les lignes de la section actions
    let inAction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/COMPARTIMENT PRESTIGE|COMPARTIMENT PRINCIPAL/i.test(line)) {
        inAction = true; continue;
      }
      if (inAction && /TOTAL\s*-\s*MARCHE DES ACTIONS|MARCHE DES DROITS|MARCHE DES OBLIGATIONS/i.test(line)) {
        inAction = false; continue;
      }
      if (!inAction) continue;
      if (/^TOTAL\b/i.test(line)) continue;
      if (SECTEURS.has(line.split(" ")[0]) && line.length < 15) continue;

      sectionLines.push(line);

      const data = parseActionLine(line);
      if (!data) {
        parseErrors.push(line);
        continue;
      }
      if (/^(COMPARTIMENT|TOTAL|MARCHE|INDICE)/i.test(data.ticker)) continue;

      let secteur = null;
      for (const off of [-1, 1, -2, 2]) {
        const idx = i + off;
        if (idx < 0 || idx >= lines.length) continue;
        const cand = lines[idx].trim();
        if (SECTEURS.has(cand.split(" ")[0]) && cand.length < 12) {
          secteur = cand.split(" ")[0]; break;
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

    const finalCours   = Array.from(new Map(coursInsert.map(c  => [`${c.ticker}_${c.date_seance}`,  c])).values());
    const finalIndices = Array.from(new Map(indicesInsert.map(i => [`${i.indice}_${i.date_seance}`, i])).values());

    // ── 5. SUPABASE ──────────────────────────────────────────────────────
    let insertedCours   = 0;
    let insertedIndices = 0;
    let erreurCours     = null;
    let erreurIndices   = null;

    if (finalCours.length) {
      const { error: errC } = await supabase
        .from("cours_brvm")
        .upsert(finalCours, { onConflict: "ticker,date_seance" });
      if (!errC) insertedCours = finalCours.length;
      else erreurCours = errC.message;
    }
    if (finalIndices.length) {
      const { error: errI } = await supabase
        .from("indices_brvm")
        .upsert(finalIndices, { onConflict: "indice,date_seance" });
      if (!errI) insertedIndices = finalIndices.length;
      else erreurIndices = errI.message;
    }

    // ── 6. STORAGE & LOG ─────────────────────────────────────────────────
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

    // ── 7. RÉPONSE AVEC DEBUG COMPLET ─────────────────────────────────────
    return res.status(200).json({
      success:          true,
      duree_ms:         Date.now() - startTime,

      // ── Résultats
      date:             dateStr,
      cours_importes:   insertedCours,
      indices_importes: insertedIndices,
      pdf_url:          urlData.publicUrl,

      // ── Debug parsing
      debug: {
        // Date
        date_source:        dateSource,

        // Indices
        indices_trouves:    indiceDebug,
        indices_erreur:     erreurIndices,

        // Actions
        total_lignes_pdf:         lines.length,
        lignes_section_actions:   sectionLines.length,
        actions_parsees:          finalCours.length,
        actions_erreur_supabase:  erreurCours,

        // Toutes les actions parsées avec détail
        actions: finalCours.map(c => ({
          ticker:    c.ticker,
          nom:       c.nom,
          secteur:   c.secteur,
          prec:      c.cours_precedent,
          ouv:       c.cours_ouverture,
          clot:      c.cours,
          var:       c.variation,
          volume:    c.volume,
          valeur:    c.valeur,
        })),

        // Lignes de la section actions qui n'ont pas pu être parsées
        lignes_non_parsees: parseErrors,

        // Échantillon des 10 premières lignes brutes du PDF (pour diagnostic)
        sample_lignes_pdf: lines.slice(0, 10),
      },
    });

  } catch (err) {
    console.error("BOC error:", err);
    return res.status(500).json({
      error:    err.message,
      duree_ms: Date.now() - startTime,
    });
  }
}
