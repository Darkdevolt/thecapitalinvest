/**
 * Dépôt d'un Bulletin Officiel de la Cote (réservé aux administrateurs).
 *
 * CORRECTIFS :
 *  - un refus d'authentification renvoyait un code 500 accompagné du message
 *    interne ; il renvoie désormais 401 ou 403 selon le cas ;
 *  - l'URL publique du bucket n'est plus construite sur une chaîne de repli
 *    codée en dur pointant vers le projet Supabase ; l'absence de configuration
 *    est traitée comme une erreur explicite ;
 *  - la date de séance ne peut plus être postérieure à aujourd'hui ;
 *  - le contrôle du type PDF précède la génération de l'URL signée.
 */
import { supabaseAdmin } from '../lib/supabase.js';
import { authenticateAdmin, rateLimited, handlePreflight } from '../lib/middleware.js';
import { ok, fail, readBody, BodyError } from '../lib/http.js';
import config from '../lib/config.js';

const BUCKET = 'boc_pdfs';

const safeName = value => String(value || 'BOC.pdf')
  .normalize('NFKD')
  .replace(/[^\w.\-]+/g, '_')
  .replace(/^\.+/, '')
  .slice(0, 160) || 'BOC.pdf';

const isValidDate = value => /^20\d{2}-\d{2}-\d{2}$/.test(String(value || ''))
  && !Number.isNaN(Date.parse(value))
  && String(value) <= new Date().toISOString().slice(0, 10);

function publicUrl(path) {
  if (!config.supabaseUrl) throw new Error('SUPABASE_URL non configurée');
  return `${config.supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'POST,OPTIONS' })) return;
  if (req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (rateLimited(req, res, 'boc-upload')) return;
  if (!supabaseAdmin) return fail(res, 503, 'Service temporairement indisponible.', 'SERVICE_UNAVAILABLE');

  const admin = await authenticateAdmin(req, res);
  if (!admin) return;

  let body;
  try { body = await readBody(req); }
  catch (e) { return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY', e); }

  try {
    if (body?.action === 'prepare') {
      if (!isValidDate(body.date_seance)) {
        return fail(res, 400, 'Date de séance invalide.', 'INVALID_DATE');
      }
      const filename = safeName(body.filename);
      if (!/\.pdf$/i.test(filename)) {
        return fail(res, 400, 'Le document BOC doit être un fichier PDF.', 'INVALID_FILE_TYPE');
      }
      const path = `${body.date_seance}/${Date.now()}_${filename}`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET)
        .createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return ok(res, {
        path, token: data.token, signedUrl: data.signedUrl, publicUrl: publicUrl(path)
      });
    }

    if (body?.action === 'finalize') {
      if (!isValidDate(body.date_seance) || !body.path || !body.filename) {
        return fail(res, 400, 'Informations BOC incomplètes.', 'INCOMPLETE_PAYLOAD');
      }
      const record = {
        date_seance: body.date_seance,
        fichier_nom: safeName(body.filename),
        fichier_url: publicUrl(body.path)
      };
      const { data: existing, error: lookupError } = await supabaseAdmin
        .from('boc').select('id').eq('date_seance', body.date_seance).limit(1);
      if (lookupError) throw lookupError;

      const query = existing?.[0]
        ? supabaseAdmin.from('boc').update(record).eq('id', existing[0].id)
        : supabaseAdmin.from('boc').insert(record);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return ok(res, data, { message: 'Document BOC enregistré.' });
    }

    return fail(res, 400, 'Action inconnue.', 'UNKNOWN_ACTION');
  } catch (error) {
    return fail(res, 500, 'Enregistrement du document impossible.', 'BOC_UPLOAD_ERROR', error);
  }
}
