import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Store instances here
const supabaseClients: Partial<Record<'samarinda' | 'berau' | 'dev', SupabaseClient>> = {};

const supabaseConfig = {
  samarinda: {
    url: import.meta.env.VITE_SUPABASE_URL_SAMARINDA,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY_SAMARINDA
  },
  berau: {
    url: import.meta.env.VITE_SUPABASE_URL_BERAU,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY_BERAU
  },
  dev: {
    url: import.meta.env.VITE_SUPABASE_URL_DEV,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY_DEV
  }
};

export function getSupabaseClient(branch: 'samarinda' | 'berau' | 'dev'): SupabaseClient {
  if (!supabaseClients[branch]) {
    const { url, anonKey } = supabaseConfig[branch];
    if (!url || !anonKey) {
      throw new Error(`Supabase config for branch "${branch}" is missing.`);
    }
    supabaseClients[branch] = createClient(url, anonKey);
  }
  // The non-null assertion operator (!) is safe here because of the check above.
  return supabaseClients[branch]!;
} 