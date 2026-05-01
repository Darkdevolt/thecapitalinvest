import { supabase, supabaseAdmin } from './lib/supabase.js';
import { signToken } from './lib/jwt.js';
import { validate } from './lib/validate.js';
import { json, error, success, handleOptions } from './lib/response.js';
import { rateLimit, parseBody } from './lib/middleware.js';

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') return handleOptions();

  // Rate limiting
  const limit = rateLimit(req);
  if (limit) return limit;

  const { data: body, response: bodyError } = await parseBody(req);
  if (bodyError) return bodyError;

  const action = body?.action;

  switch (action) {
    case 'signup':
      return handleSignup(body);
    case 'login':
      return handleLogin(body);
    case 'refresh':
      return handleRefresh(body);
    default:
      return error('Action invalide', 400, 'INVALID_ACTION');
  }
}

async function handleSignup(body) {
  const schema = {
    email: { type: 'email', required: true },
    password: { type: 'password', required: true },
    nom: { type: 'name', required: true, sanitize: true },
  };

  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');

  // Vérifier si l'email existe déjà
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', sanitized.email)
    .single();

  if (existing) return error('Cet email est déjà utilisé', 409, 'EMAIL_EXISTS');

  // Créer l'utilisateur dans Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: sanitized.email,
    password: sanitized.password,
    email_confirm: true,
    user_metadata: { nom: sanitized.nom },
  });

  if (authError) return error(authError.message, 400, 'AUTH_ERROR');

  // Créer l'entrée dans la table users
  const { error: dbError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      email: sanitized.email,
      nom: sanitized.nom,
      plan: 'free',
      is_admin: false,
    });

  if (dbError) {
    // Rollback : supprimer l'utilisateur auth
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return error(dbError.message, 500, 'DB_ERROR');
  }

  // Générer le JWT
  const token = await signToken({
    sub: authData.user.id,
    email: sanitized.email,
    nom: sanitized.nom,
    plan: 'free',
    is_admin: false,
  });

  return success({
    access_token: token,
    user: {
      id: authData.user.id,
      email: sanitized.email,
      nom: sanitized.nom,
      plan: 'free',
    },
  }, 'Compte créé avec succès');
}

async function handleLogin(body) {
  const schema = {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 1, max: 128 },
  };

  const { valid, errors, sanitized } = validate(body, schema);
  if (!valid) return error(errors.join(', '), 400, 'VALIDATION_ERROR');

  // Authentifier via Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: sanitized.email,
    password: sanitized.password,
  });

  if (authError) return error('Email ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');

  // Récupérer les infos utilisateur
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  // Générer le JWT
  const token = await signToken({
    sub: authData.user.id,
    email: authData.user.email,
    nom: userData?.nom || authData.user.user_metadata?.nom || '',
    plan: userData?.plan || 'free',
    is_admin: userData?.is_admin || false,
  });

  return success({
    access_token: token,
    user: {
      id: authData.user.id,
      email: authData.user.email,
      nom: userData?.nom || authData.user.user_metadata?.nom || '',
      plan: userData?.plan || 'free',
      is_admin: userData?.is_admin || false,
    },
  });
}

async function handleRefresh(body) {
  return error('Session expirée, veuillez vous reconnecter', 401, 'SESSION_EXPIRED');
}
