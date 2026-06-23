import { json, error as kitError } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { transaksiKasir } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, payloadRows, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { reverseDailySummaryForTransaction } from '$lib/server/dailySummary';
import { hasDatabaseColumn } from '$lib/server/schemaCapabilities';
import { decodeDataCursor, parseDataLimit, toCursorPage } from '$lib/server/dataPagination';
import { parseBody, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/transaksi-kasir — Resource route untuk tabel `transaksi_kasir` (item transaksi POS).
 * Menggantikan dispatch dari /api/data?table=transaksi_kasir.
 * Invariant KRITIS:
 *   1. GET pakai raw SQL + deteksi kolom snapshot opsional (migrasi skema bertahap).
 *      Cursor pagination pada (created_at, id).
 *   2. POST menolak insert POS (sumber='pos' atau insert apa pun ke tabel ini) → 409,
 *      arahkan ke /api/pos/transaction (yang juga maintain tabel agregat harian).
 *   3. DELETE by transaction_id: REVERSE kontribusi ke daily_sales_summary +
 *      daily_product_sales SEBELUM hapus item. Bungkus try/catch yang swallow —
 *      penghapusan tidak boleh gagal hanya karena agregat gagal.
 * RBAC: insert → kasir/pemilik (tapi POS diblokir lihat di atas); delete → pemilik.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const rawDb = getRawDb(platform, branch);
	const startTime = url.searchParams.get('start');
	const endTime = url.searchParams.get('end');
	const id = url.searchParams.get('id');
	const transactionId = url.searchParams.get('transaction_id');
	const limit = parseDataLimit(url.searchParams.get('limit'));
	const cursor = decodeDataCursor(url.searchParams.get('cursor'));
	const cursorPagination = url.searchParams.get('pagination') === 'cursor' || cursor !== null;

	const filters = ['branch_id = ?'];
	const values: unknown[] = [branch];
	if (startTime) {
		filters.push('created_at >= ?');
		values.push(startTime);
	}
	if (endTime) {
		filters.push('created_at <= ?');
		values.push(endTime);
	}
	if (id) {
		filters.push('id = ?');
		values.push(id);
	}
	if (transactionId) {
		filters.push('transaction_id = ?');
		values.push(transactionId);
	}
	if (cursor) {
		filters.push('(created_at > ? OR (created_at = ? AND id > ?))');
		values.push(cursor.sortValue, cursor.sortValue, cursor.id);
	}
	const bukuKasIdsParam = url.searchParams.get('buku_kas_ids');
	if (bukuKasIdsParam) {
		const ids = bukuKasIdsParam.split(',').filter(Boolean);
		if (ids.length) {
			filters.push(`buku_kas_id IN (${ids.map(() => '?').join(',')})`);
			values.push(...ids);
		}
	}

	// Deteksi apakah kolom snapshot sudah ada (migrasi skema bertahap antar-DB).
	const hasSnapshots = await hasDatabaseColumn(rawDb, branch, 'transaksi_kasir', 'nama_produk');
	const snapshotSelect = hasSnapshots
		? `nama_produk, base_price, add_on_total, add_on_snapshot, sugar, ice, note, hpp_snapshot, hpp_amount`
		: `NULL AS nama_produk, NULL AS base_price, 0 AS add_on_total, NULL AS add_on_snapshot,
			NULL AS sugar, NULL AS ice, NULL AS note, NULL AS hpp_snapshot, 0 AS hpp_amount`;
	const rows = await rawDb
		.prepare(
			`SELECT
				id, branch_id, buku_kas_id, produk_id, custom_name, qty, amount, price,
				${snapshotSelect},
				transaction_id, created_at, updated_at
			 FROM transaksi_kasir
			 WHERE ${filters.join(' AND ')}
				 ORDER BY created_at ASC, id ASC
				 LIMIT ?`
		)
		.bind(...values, cursorPagination ? limit + 1 : limit)
		.all();
	const data = (rows.results || []) as Array<{ id: string; created_at: string }>;
	if (!cursorPagination) return json(data);
	return json(
		toCursorPage(data, limit, (row) => ({ sortValue: row.created_at, id: String(row.id) }))
	);
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['kasir', 'pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload) throw kitError(400, 'Payload tidak valid');

	// Blokir: transaksi POS harus lewat /api/pos/transaction (yang juga maintain agregat harian).
	const rows = Array.isArray(body.payload) ? body.payload : [body.payload];
	const hasPosInsert = rows.some((row) => (row as Record<string, unknown>)?.sumber === 'pos');
	if (hasPosInsert) {
		throw kitError(409, 'Transaksi POS harus lewat /api/pos/transaction');
	}
	// Tabel transaksi_kasir sendiri juga dilarang di-insert langsung (semua insert datang dari POS).
	throw kitError(409, 'Transaksi POS harus lewat /api/pos/transaction');
};

export const DELETE: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const transactionId = url.searchParams.get('transaction_id');
	if (!transactionId) throw kitError(400, 'transaction_id diperlukan');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);

	// Balikkan kontribusi transaksi ke ringkasan harian SEBELUM item dihapus
	// (item + buku_kas masih ada di sini). Jangan blok penghapusan bila gagal.
	try {
		await reverseDailySummaryForTransaction(rawDb, branch, transactionId);
	} catch {
		// Tabel ringkasan mungkin belum ada / gagal sebagian — abaikan.
	}

	await db
		.delete(transaksiKasir)
		.where(
			and(eq(transaksiKasir.branch_id, branch), eq(transaksiKasir.transaction_id, transactionId))
		);
	await publish(platform, branch, 'transaksi_kasir', 'delete', { transaction_id: transactionId });
	await auditDataChange(rawDb, branch, session, 'transaksi_kasir', 'delete_by_transaction', null, {
		transaction_id: transactionId
	});
	return json({ ok: true });
};
