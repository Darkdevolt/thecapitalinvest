import { supabaseAdmin } from './lib/supabase.js';
import { json, error, success } from './lib/response.js';
import { rateLimit, parseBody } from './lib/middleware.js';
import { validate } from './lib/validate.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') return error('Méthode non autorisée', 405);

  const limit = rateLimit(req);
  if (limit) return limit;

  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const schema = {
    prenom: { type: 'name', required: true, sanitize: true },
    nom: { type: 'name', required: false, sanitize: true },
    email: { type: 'email', required: true },
    objet: { type: 'enum', required: true, values: ['info', 'pro', 'institution', 'partenariat', 'bug', 'autre'] },
    message: { type: 'string', required: true, min: 10, max: 5000 },
  };

  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');

  try {
    const { error: dbError } = await supabaseAdmin
      .from('contacts')
      .insert({
        prenom: sanitized.prenom,
        nom: sanitized.nom || null,
        email: sanitized.email,
        objet: sanitized.objet,
        message: sanitized.message,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        user_agent: req.headers.get('user-agent') || null,
      });

    if (dbError) throw dbError;
    return success({}, 'Message envoyé avec succès');
  } catch (e) {
    console.error('Contact API error:', e);
    return error('Erreur serveur', 500, 'SERVER_ERROR');
  }
}
