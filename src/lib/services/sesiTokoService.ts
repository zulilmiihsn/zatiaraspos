/**
 * Shared service for sesi_toko (store session) queries.
 * All DB access via /api/data endpoint.
 */

import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import type { TokoSession } from '$lib/types/store';

const branch = () => selectedBranch.value || 'default';
const ACTIVE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedActiveSession {
	session: TokoSession;
	expiresAt: number;
}

function activeSessionKey() {
	return `active_store_session_${branch()}`;
}

function getCachedActiveSession(): TokoSession | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem(activeSessionKey());
		if (!raw) return null;
		const cached = JSON.parse(raw) as CachedActiveSession;
		if (
			!cached.session?.is_active ||
			!Number.isFinite(cached.expiresAt) ||
			cached.expiresAt <= Date.now()
		) {
			localStorage.removeItem(activeSessionKey());
			return null;
		}
		return cached.session;
	} catch {
		localStorage.removeItem(activeSessionKey());
		return null;
	}
}

function cacheActiveSession(session: TokoSession | null): void {
	if (typeof window === 'undefined') return;
	if (!session?.is_active) {
		localStorage.removeItem(activeSessionKey());
		return;
	}
	localStorage.setItem(
		activeSessionKey(),
		JSON.stringify({ session, expiresAt: Date.now() + ACTIVE_SESSION_TTL_MS })
	);
}

export async function getSesiAktif(): Promise<TokoSession | null> {
	if (typeof navigator !== 'undefined' && !navigator.onLine) return getCachedActiveSession();
	const qs = new URLSearchParams({ table: 'sesi_toko', branch: branch() }).toString();
	try {
		const res = await fetch(`/api/data?${qs}`);
		if (!res.ok) return null;
		const rows: TokoSession[] = await res.json();
		const active =
			rows
				.filter((r) => r.is_active)
				.sort(
					(a, b) => new Date(b.opening_time).getTime() - new Date(a.opening_time).getTime()
				)[0] || null;
		cacheActiveSession(active);
		return active;
	} catch {
		return typeof navigator !== 'undefined' && !navigator.onLine ? getCachedActiveSession() : null;
	}
}

export async function bukaToko(openingCash: number, openingTime: string): Promise<void> {
	const response = await fetch('/api/data', {
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
	if (!response.ok) throw new Error(`Gagal membuka toko: HTTP ${response.status}`);
	await getSesiAktif();
}

export async function tutupToko(sesiId: string, closingTime: string): Promise<void> {
	const response = await fetch('/api/data', {
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
	if (!response.ok) throw new Error(`Gagal menutup toko: HTTP ${response.status}`);
	cacheActiveSession(null);
}
