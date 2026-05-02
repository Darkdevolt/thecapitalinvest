// FIX A-01 : Refactorisé pour utiliser les modules lib/ comme les autres handlers
// FIX S-01 : Retourne le token Supabase natif — cohérent avec middleware.js qui utilise supabase.auth.getUser()
import { supabase } from './lib/supabase.js';
import { error, success } from './lib/response.js';
import { rateLimit, parseBody } from './lib/middleware.js';
import { validate } from './lib/validate.js';
import { corsHeaders, handleOptions } from './lib/cors.js';

const CORS_TYPE = 'public';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return handleOptions(corsHeaders(CORS_TYPE));

  if (req.method !== 'POST') {
    return error('Méthode non autorisée', 405);
  }

  const limit = rateLimit(req);
  if (limit) return limit;

  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const { action } = body;

  // Validation commune email + password
  const schema = {
    email: { type: 'email', required: true },
    password: { type: 'password', required: true },
  };
  const { valid, errors } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');

  const { email, password } = body;

  try {
    if (action === 'login') {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      return success({ session: data.session });
    }

    if (action === 'signup') {
      const nameSchema = { nom: { type: 'string', required: false, max: 100 } };
      const { sanitized } = validate(body, nameSchema);

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nom: sanitized.nom || '' } },
      });
      if (authError) throw authError;
      return success({ session: data.session });
    }

    return error('Action invalide', 400, 'INVALID_ACTION');
  } catch (e) {
    console.error('Erreur auth:', e.message);
    return error(e.message, 400, 'AUTH_ERROR');
  }
}
