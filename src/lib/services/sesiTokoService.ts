/**
 * Shared service for sesi_toko (store session) queries.
 * All DB access via /api/data endpoint.
 */

import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import type { TokoSession } from '$lib/types/store';

const branch = () => selectedBranch.value || 'default';

export async function getSesiAktif(): Promise<TokoSession | null> {
	const qs = new URLSearchParams({ table: 'sesi_toko', branch: branch() }).toString();
	const res = await fetch(`/api/data?${qs}`);
	if (!res.ok) return null;
	const rows: TokoSession[] = await res.json();
	// Filter active, sort by opening_time desc, return first
	const active = rows
		.filter((r) => r.is_active)
		.sort((a, b) => new Date(b.opening_time).getTime() - new Date(a.opening_time).getTime());
	return active[0] || null;
}

export async function bukaToko(openingCash: number, openingTime: string): Promise<void> {
	await fetch('/api/data', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			table: 'sesi_toko',
			action: 'insert',
			branch: branch(),
			payload: {
				id: crypto.randomUUID(),
				opening_cash: openingCash,
				opening_time: openingTime,
				is_active: true
			}
		})
	});
}

export async function tutupToko(sesiId: string, closingTime: string): Promise<void> {
	await fetch('/api/data', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			table: 'sesi_toko',
			action: 'update',
			branch: branch(),
			where: { id: sesiId },
			payload: { closing_time: closingTime, is_active: false }
		})
	});
}
