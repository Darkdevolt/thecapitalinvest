export default function handler(req) {
  const url = new URL(req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    runtime: 'edge',
    method: req.method,
    path: url.pathname,
    time: new Date().toISOString(),
    env_check: {
      has_supabase_url: !!process.env.SUPABASE_URL,
      has_anon_key: !!process.env.SUPABASE_ANON_KEY,
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  });
}
