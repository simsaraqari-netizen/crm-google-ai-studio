import { createClient } from '@supabase/supabase-js';
const supabaseUrl = (typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_SUPABASE_URL : process.env.VITE_SUPABASE_URL) as string;
const supabaseAnonKey = (typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_SUPABASE_ANON_KEY : process.env.VITE_SUPABASE_ANON_KEY) as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
});
