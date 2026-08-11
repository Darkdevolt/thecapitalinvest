import { authenticate, rateLimit, parseBody, handleOptions } from '../lib/middleware.js';
import { error, success } from '../lib/response.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') return error('Méthode non autorisée', 405, 'METHOD_NOT_ALLOWED');
  const limited=rateLimit(req);if(limited)return limited;
  const auth=await authenticate(req);if(auth.response)return auth.response;
  const body=await parseBody(req);if(body.response)return body.response;
  const question=String(body.data?.question||'').trim();const context=String(body.data?.context||'').trim();
  if(!question)return error('Question requise',400,'QUESTION_REQUIRED');if(question.length>2000)return error('Question trop longue',400,'QUESTION_TOO_LONG');
  const apiKey=process.env.OPENAI_API_KEY||'';if(!apiKey)return error('The Capital AI n’est pas encore configurée côté serveur. Ajoute OPENAI_API_KEY dans les variables Vercel.',503,'AI_NOT_CONFIGURED');
  const model=process.env.OPENAI_MODEL||'gpt-5-mini';const safeContext=context.slice(0,12000);const system=`Tu es The Capital AI, assistant d’intelligence financière spécialisé dans la BRVM et l’UEMOA. Réponds en français, avec un ton professionnel et précis. Ne fabrique jamais de cours, ratios, résultats ou actualités. Si une donnée n’est pas présente dans le contexte fourni, dis-le clairement. Distingue toujours faits, calculs et hypothèses. Tu n’es pas un conseiller financier agréé et tu ne dois pas présenter une recommandation comme une certitude. Contexte financier fourni par l’application : ${safeContext||'Aucun contexte financier fourni.'}`;
  try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:question}]}],max_output_tokens:900})});const data=await response.json();if(!response.ok){console.error('[CAPITAL-AI]',response.status,data?.error?.message||'provider error');return error('Le moteur IA est temporairement indisponible.',502,'AI_PROVIDER_ERROR');}const text=data.output_text||data.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||'';if(!text)return error('Réponse IA vide.',502,'AI_EMPTY_RESPONSE');return success({answer:text,model,generatedAt:new Date().toISOString()});}catch(e){console.error('[CAPITAL-AI]',e.message);return error('Impossible de contacter le moteur IA.',502,'AI_NETWORK_ERROR');}
}
