import config from './config.js';
const CORS={'Access-Control-Allow-Origin':config.allowedOrigin||'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Requested-With'};
export function success(data,message){return new Response(JSON.stringify({success:true,data,message}),{status:200,headers:{'Content-Type':'application/json',...CORS}});}
export function error(message,status=400,code='ERROR'){return new Response(JSON.stringify({success:false,error:message,code}),{status,headers:{'Content-Type':'application/json',...CORS}});}
export function unauthorized(message='Non autorisé'){return new Response(JSON.stringify({success:false,error:message,code:'UNAUTHORIZED'}),{status:401,headers:{'Content-Type':'application/json',...CORS}});}
export function tooManyRequests(resetTime){return new Response(JSON.stringify({success:false,error:'Trop de requêtes',code:'RATE_LIMITED',resetTime}),{status:429,headers:{'Content-Type':'application/json',...CORS}});}
