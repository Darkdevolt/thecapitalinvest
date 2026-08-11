import config from './config.js';
export function corsHeaders(type='private'){const origin=type==='public'?'*':config.allowedOrigin;return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Requested-With','Access-Control-Max-Age':'86400'};}
export function handleOptions(type='private'){return new Response(null,{status:204,headers:corsHeaders(type)});}
export function withCors(response,type='private'){const headers=new Headers(response.headers);for(const [k,v] of Object.entries(corsHeaders(type)))headers.set(k,v);return new Response(response.body,{status:response.status,headers});}
