/**
 * The Capital AI — assistant d'analyse.
 *
 * CORRECTIF MAJEUR : ce fichier était écrit pour le runtime Edge (handler(req)
 * retournant un objet Response, req.json()) alors que le projet tourne sur le
 * runtime Node et qu'aucun `export const config = { runtime: 'edge' }` n'était
 * déclaré. La route ne répondait donc jamais correctement. Réécrite en Node.
 */
import { authenticate, rateLimited, handlePreflight } from '../lib/middleware.js';
import { ok, fail, readBody, BodyError } from '../lib/http.js';

const MAX_QUESTION = 2000;
const MAX_CONTEXT = 12000;
const PROVIDER_TIMEOUT_MS = 25000;

const SYSTEM_PROMPT = contexte => [
  "Tu es The Capital AI, assistant d'intelligence financière spécialisé sur la BRVM et l'UEMOA.",
  'Réponds en français, avec un ton professionnel et précis.',
  'Ne fabrique jamais de cours, ratios, résultats ou actualités.',
  "Si une donnée n'est pas présente dans le contexte fourni, dis-le clairement.",
  'Distingue toujours les faits, les calculs et les hypothèses.',
  "Tu n'es pas un conseiller financier agréé : ne présente jamais une recommandation comme une certitude.",
  `Contexte financier fourni par l'application : ${contexte || 'aucun contexte fourni.'}`
].join(' ');

export default async function handler(req, res) {
  if (handlePreflight(req, res, { methods: 'POST,OPTIONS' })) return;
  if (req.method !== 'POST') return fail(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
  if (rateLimited(req, res, 'ai')) return;

  const user = await authenticate(req, res);
  if (!user) return;

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return fail(res, e instanceof BodyError ? 400 : 500, 'Requête illisible.', 'INVALID_BODY', e);
  }

  const question = String(body?.question || '').trim();
  const contexte = String(body?.context || '').trim().slice(0, MAX_CONTEXT);
  if (!question) return fail(res, 400, 'Question requise.', 'QUESTION_REQUIRED');
  if (question.length > MAX_QUESTION) return fail(res, 400, 'Question trop longue.', 'QUESTION_TOO_LONG');

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return fail(res, 503, "The Capital AI n'est pas configurée côté serveur (OPENAI_API_KEY manquante).", 'AI_NOT_CONFIGURED');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT(contexte) }] },
          { role: 'user', content: [{ type: 'input_text', text: question }] }
        ],
        max_output_tokens: 900
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('[CAPITAL-AI] fournisseur', response.status, data?.error?.message || '');
      return fail(res, 502, 'Le moteur IA est temporairement indisponible.', 'AI_PROVIDER_ERROR');
    }

    const text = data?.output_text
      || (data?.output || [])
        .flatMap(item => item.content || [])
        .filter(part => part.type === 'output_text')
        .map(part => part.text)
        .join('\n')
      || '';

    if (!text.trim()) return fail(res, 502, 'Réponse IA vide.', 'AI_EMPTY_RESPONSE');
    return ok(res, { answer: text, model, generatedAt: new Date().toISOString() });
  } catch (e) {
    if (e?.name === 'AbortError') {
      return fail(res, 504, 'Le moteur IA met trop de temps à répondre.', 'AI_TIMEOUT', e);
    }
    return fail(res, 502, 'Impossible de contacter le moteur IA.', 'AI_NETWORK_ERROR', e);
  } finally {
    clearTimeout(timer);
  }
}
