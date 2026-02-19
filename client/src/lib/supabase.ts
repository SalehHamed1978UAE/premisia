import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigError = isSupabaseConfigured
  ? null
  : 'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

if (!isSupabaseConfigured) {
  console.error('[Auth Config] Supabase environment variables not found.');
  console.error('[Auth Config] Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'invalid-missing-supabase-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    }
  }
);

export async function getSession() {
  if (!isSupabaseConfigured) {
    return null;
  }
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return session;
}

export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    return null;
  }
  const session = await getSession();
  return session?.access_token || null;
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session;
}
