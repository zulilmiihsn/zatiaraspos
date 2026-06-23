import { json, error as kitError } from '@sveltejs/kit';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { bahanMutasi } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, payloadRows, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { parseBody, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/bahan-mutasi — Resource route untuk tabel `bahan_mutasi` (mutasi stok bahan).
 * Menggantikan dispatch dari /api/data?table=bahan_mutasi.
 * Invariant KRITIS:
 *   - POST hanya satu mutasi per request (bukan bulk).
 *   - Update stok `bahan` + insert `bahan_mutasi` dijalankan atomic via rawDb.batch
 *     (batch D1 itu transaksional). stock_after dihitung dari subquery pasca-update.
 *   - INSUFFICIENT_INGREDIENT → 409 (stok tidak boleh minus).
 * RBAC: pemilik (owner) untuk mutasi (mutasi manual lewat menu manajemen).
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);
	const limit = Number(url.searchParams.get('limit') || 200);
	const bahanId = url.searchParams.get('bahan_id');

	const filters: SQL[] = [eq(bahanMutasi.cabang_id, branch)];
	if (bahanId) filters.push(eq(bahanMutasi.bahan_id, bahanId));

	const rows = await db
		.select()
		.from(bahanMutasi)
		.where(and(...filters))
		.orderBy(desc(bahanMutasi.created_at))
		.limit(limit);
	return json(rows);
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload) throw kitError(400, 'Payload tidak valid');

	const rawDb = getRawDb(platform, branch);
	const rows = payloadRows(body.payload, branch);
	if (rows.length !== 1) throw kitError(400, 'Mutasi bahan harus satu per request');
	const row = rows[0];
	const bahanId = String(row.bahan_id || '');
	const quantityDelta = Number(row.quantity_delta || 0);
	if (!bahanId || !Number.isFinite(quantityDelta) || quantityDelta === 0) {
		throw kitError(400, 'Mutasi bahan tidak valid');
	}

	// Validasi: bahan harus ada.
	const item = (await rawDb
		.prepare(`SELECT id FROM bahan WHERE cabang_id = ? AND id = ? LIMIT 1`)
		.bind(branch, bahanId)
		.first()) as { id: string } | null;
	if (!item) throw kitError(404, 'Bahan tidak ditemukan');

	// Atomic: update stok bahan + catat mutasi dalam satu batch D1 (transaksional).
	const now = new Date().toISOString();
	try {
		await rawDb.batch([
			rawDb
				.prepare(
					`UPDATE bahan
					 SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ?
					 WHERE cabang_id = ? AND id = ?`
				)
				.bind(quantityDelta, now, branch, bahanId),
			rawDb
				.prepare(
					`INSERT INTO bahan_mutasi (
						id, cabang_id, bahan_id, quantity_delta, stock_after, source,
						reference_id, note, created_by, created_at
					)
					VALUES (
						?, ?, ?, ?,
						(SELECT current_stock FROM bahan WHERE cabang_id = ? AND id = ?),
						?, ?, ?, ?, ?
					)`
				)
				.bind(
					row.id,
					branch,
					bahanId,
					quantityDelta,
					branch,
					bahanId,
					String(row.source || 'manual'),
					row.reference_id == null ? null : String(row.reference_id),
					row.note == null ? null : String(row.note).slice(0, 160),
					session?.username || session?.userId || null,
					now
				)
		]);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('INSUFFICIENT_INGREDIENT')) {
			throw kitError(409, 'Stok bahan tidak boleh minus');
		}
		throw error;
	}

	// Mutasi menyentuh 2 resource: publish event untuk bahan (stok berubah) DAN bahan_mutasi.
	await publish(platform, branch, 'bahan', 'update', { id: bahanId });
	await publish(platform, branch, 'bahan_mutasi', 'insert', { id: row.id });
	await auditDataChange(rawDb, branch, session, 'bahan_mutasi', 'insert', row.id, {
		bahan_id: bahanId,
		quantity_delta: quantityDelta
	});
	return json({ ok: true, data: [row] });
};
