import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseClients: Record<string, SupabaseClient> = {
  samarinda: createClient(
    import.meta.env.VITE_SUPABASE_URL_SAMARINDA,
    import.meta.env.VITE_SUPABASE_ANON_KEY_SAMARINDA
  ),
  berau: createClient(
    import.meta.env.VITE_SUPABASE_URL_BERAU,
    import.meta.env.VITE_SUPABASE_ANON_KEY_BERAU
  )
};

export function getSupabaseClient(branch: 'samarinda' | 'berau'): SupabaseClient {
  return supabaseClients[branch];
} 