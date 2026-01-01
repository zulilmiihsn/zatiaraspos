import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Global singleton to prevent multiple instances
let supabaseClients: Record<string, SupabaseClient> | null = null;

function initializeClients() {
	if (!supabaseClients) {
		// Create clients with unique storage keys to prevent conflicts
		supabaseClients = {
			samarinda: createClient(
				import.meta.env.VITE_SUPABASE_URL_SAMARINDA || 'https://placeholder.supabase.co',
				import.meta.env.VITE_SUPABASE_ANON_KEY_SAMARINDA || 'placeholder',
				{
					auth: {
						storageKey: 'zatiaras-samarinda'
					}
				}
			),
			berau: createClient(
				import.meta.env.VITE_SUPABASE_URL_BERAU || 'https://placeholder.supabase.co',
				import.meta.env.VITE_SUPABASE_ANON_KEY_BERAU || 'placeholder',
				{
					auth: {
						storageKey: 'zatiaras-berau'
					}
				}
			),
			Balikpapan: createClient(
				import.meta.env.VITE_SUPABASE_URL_BALIKPAPAN || 'https://placeholder.supabase.co',
				import.meta.env.VITE_SUPABASE_ANON_KEY_BALIKPAPAN || 'placeholder',
				{
					auth: {
						storageKey: 'zatiaras-balikpapan'
					}
				}
			),
			samarinda2: createClient(
				import.meta.env.VITE_SUPABASE_URL_SAMARINDA2 || 'https://placeholder.supabase.co',
				import.meta.env.VITE_SUPABASE_ANON_KEY_SAMARINDA2 || 'placeholder',
				{
					auth: {
						storageKey: 'zatiaras-samarinda2'
					}
				}
			)
		};
	}
	return supabaseClients;
}

export function getSupabaseClient(branch: 'samarinda' | 'berau' | 'Balikpapan' | 'samarinda2'): SupabaseClient {
	const clients = initializeClients();
	return clients[branch];
}
