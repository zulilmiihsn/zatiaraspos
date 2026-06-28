import { error as kitError } from '@sveltejs/kit';

/**
 * Helper bersama untuk resource routes RESTful (pengganti dispatch /api/data).
 * Dipakai oleh semua route di src/routes/api/<resource>/+server.ts.
 */

/** Body tulis (POST/PATCH/DELETE): mengikuti bentuk lama dbPost({ table, action, payload, where, branch }). */
export type WriteBody = {
	payload?: Record<string, unknown> | Record<string, unknown>[];
	branch?: string;
	where?: {
		id?: string | number;
		transaction_id?: string;
		kategori_id?: string | number;
		produk_id?: string | number;
		bahan_id?: string | number;
	};
};

/** Parse body JSON dengan aman (default null bila bukan JSON valid). */
export async function parseBody<T = WriteBody>(request: Request): Promise<T | null> {
	return (await request.json().catch(() => null)) as T | null;
}

/** Ambil `payload` non-kosong dari body, lempar 400 bila absen. */
export function requirePayload(
	body: WriteBody | null
): Record<string, unknown> | Record<string, unknown>[] {
	if (!body?.payload) throw kitError(400, 'Payload tidak valid');
	return body.payload;
}

/**
 * Kunci immutable yang TIDAK boleh diubah lewat UPDATE: identitas baris (`id`) dan
 * scope tenant (`cabang_id`). Tanpa ini, PATCH yang spread payload mentah ke `.set()`
 * memungkinkan mass-assignment — caller bisa memindah baris ke cabang/tenant lain.
 */
const IMMUTABLE_UPDATE_KEYS = ['cabang_id', 'id'] as const;

/**
 * Buang kunci scoping immutable dari payload UPDATE. WAJIB dipakai di semua PATCH
 * sebelum `.set()` agar `cabang_id`/`id` tidak bisa ditimpa caller (lihat P0-3 audit).
 */
export function sanitizeUpdatePayload<T extends Record<string, unknown>>(
	payload: T
): Partial<T> {
	const clean: Record<string, unknown> = { ...payload };
	for (const key of IMMUTABLE_UPDATE_KEYS) delete clean[key];
	return clean as Partial<T>;
}
