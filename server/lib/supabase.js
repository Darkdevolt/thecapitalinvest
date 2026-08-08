import { createClient } from '@supabase/supabase-js';
import config from './config.js';
const supabaseUrl=config.supabaseUrl;
export const supabase=supabaseUrl&&config.supabasePublishableKey?createClient(supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;
export const supabaseAdmin=supabaseUrl&&config.supabaseSecretKey?createClient(supabaseUrl,config.supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;
export function isSupabaseReady(){return !!supabase;} export function isSupabaseAdminReady(){return !!supabaseAdmin;}
export function requireSupabase(){if(!supabase)throw new Error('Supabase public client is not configured.');return supabase;}
export function requireSupabaseAdmin(){if(!supabaseAdmin)throw new Error('Supabase admin client is not configured.');return supabaseAdmin;}
export default supabase;
