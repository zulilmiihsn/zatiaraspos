/**
 * Shared service for sesi_toko (store session) queries.
 * Centralizes `cekSesiAktif` logic used in dashboard, pos, catat, riwayat routes.
 */

import { dataService } from '$lib/services/dataService';
import type { TokoSession } from '$lib/types/store';

/**
 * Fetch the currently active toko session from Supabase.
 * Returns null if no active session exists.
 */
export async function getSesiAktif(): Promise<TokoSession | null> {
	const { data } = await dataService.supabaseClient
		.from('sesi_toko')
		.select('*')
		.eq('is_active', true)
		.order('opening_time', { ascending: false })
		.limit(1)
		.maybeSingle();

	return (data as TokoSession) || null;
}

/**
 * Open a new toko session.
 */
export async function bukaToko(openingCash: number, openingTime: string): Promise<void> {
	await dataService.supabaseClient.from('sesi_toko').insert({
		opening_cash: openingCash,
		opening_time: openingTime,
		is_active: true
	});
}

/**
 * Close an active toko session.
 */
export async function tutupToko(sesiId: string, closingTime: string): Promise<void> {
	await dataService.supabaseClient
		.from('sesi_toko')
		.update({
			closing_time: closingTime,
			is_active: false
		})
		.eq('id', sesiId);
}
