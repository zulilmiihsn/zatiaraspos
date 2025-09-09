import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Global singleton to prevent multiple instances
let supabaseClients: Record<string, SupabaseClient> | null = null;

function initializeClients() {
	if (!supabaseClients) {
		// Create clients with unique storage keys to prevent conflicts
		supabaseClients = {
			samarinda: createClient(
				import.meta.env.VITE_SUPABASE_URL_SAMARINDA,
				import.meta.env.VITE_SUPABASE_ANON_KEY_SAMARINDA,
				{
					auth: {
						storageKey: 'zatiaras-samarinda'
					}
				}
			),
			berau: createClient(
				import.meta.env.VITE_SUPABASE_URL_BERAU,
				import.meta.env.VITE_SUPABASE_ANON_KEY_BERAU,
				{
					auth: {
						storageKey: 'zatiaras-berau'
					}
				}
			),
			dev: createClient(
				import.meta.env.VITE_SUPABASE_URL_DEV,
				import.meta.env.VITE_SUPABASE_ANON_KEY_DEV,
				{
					auth: {
						storageKey: 'zatiaras-dev'
					}
				}
			)
		};
	}
	return supabaseClients;
}

export function getSupabaseClient(branch: 'samarinda' | 'berau' | 'dev'): SupabaseClient {
	const clients = initializeClients();
	return clients[branch];
}
