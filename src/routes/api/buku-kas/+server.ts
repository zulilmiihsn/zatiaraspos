import { json, error as kitError } from '@sveltejs/kit';
import { and, asc, eq, gte, lte, gt, or, type SQL } from 'drizzle-orm';
import { bukuKas } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, payloadRows, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { decodeDataCursor, parseDataLimit, toCursorPage } from '$lib/server/dataPagination';
import { parseBody, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/buku-kas — Resource route untuk tabel `buku_kas` (kas/ledger transaksi).
 * Menggantikan dispatch dari /api/data?table=buku_kas.
 * Invariant:
 *   - GET mendukung cursor pagination (?pagination=cursor&cursor=...&limit=...).
 *   - POST insert dedup by id: pre-select, skip baris yang sudah ada. Mempertahankan
 *     return shape { ok, data, duplicate } agar sinkronisasi offline idempotent.
 *   - DELETE mendukung dua mode: ?id= (single) atau ?transaction_id= (bulk, hapus semua kas terkait transaksi).
 * RBAC: insert → kasir/pemilik; update/delete → pemilik.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);
	const startTime = url.searchParams.get('start');
	const endTime = url.searchParams.get('end');
	const sumber = url.searchParams.get('sumber');
	const tipe = url.searchParams.get('tipe');
	const id = url.searchParams.get('id');
	const transactionId = url.searchParams.get('transaction_id');
	const idSesiToko = url.searchParams.get('id_sesi_toko');
	const limit = parseDataLimit(url.searchParams.get('limit'));
	const cursor = decodeDataCursor(url.searchParams.get('cursor'));
	const cursorPagination = url.searchParams.get('pagination') === 'cursor' || cursor !== null;

	const filters: SQL[] = [eq(bukuKas.cabang_id, branch)];
	if (startTime) filters.push(gte(bukuKas.waktu, startTime));
	if (endTime) filters.push(lte(bukuKas.waktu, endTime));
	if (sumber) filters.push(eq(bukuKas.sumber, sumber));
	if (tipe) filters.push(eq(bukuKas.tipe, tipe));
	if (id) filters.push(eq(bukuKas.id, id));
	if (transactionId) filters.push(eq(bukuKas.transaction_id, transactionId));
	if (idSesiToko) filters.push(eq(bukuKas.id_sesi_toko, idSesiToko));
	if (cursor) {
		filters.push(
			or(
				gt(bukuKas.waktu, cursor.sortValue),
				and(eq(bukuKas.waktu, cursor.sortValue), gt(bukuKas.id, cursor.id))
			)!
		);
	}

	const rows = await db
		.select()
		.from(bukuKas)
		.where(and(...filters))
		.orderBy(asc(bukuKas.waktu), asc(bukuKas.id))
		.limit(cursorPagination ? limit + 1 : limit);
	if (!cursorPagination) return json(rows);
	return json(toCursorPage(rows, limit, (row) => ({ sortValue: row.waktu, id: String(row.id) })));
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['kasir', 'pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload) throw kitError(400, 'Payload tidak valid');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);
	const rows: Array<Record<string, any>> = payloadRows(body.payload, branch).map((row) => ({
		...row,
		amount: row.amount ?? row.nominal ?? 0
	}));

	// Dedup by id: cek baris yang sudah ada, hanya insert yang baru.
	const newRows: Array<Record<string, any>> = [];
	for (const row of rows) {
		const existing = await rawDb
			.prepare('SELECT id FROM buku_kas WHERE cabang_id = ? AND id = ? LIMIT 1')
			.bind(branch, String(row.id))
			.first();
		if (!existing) newRows.push(row);
	}
	if (newRows.length === 0) {
		return json({ ok: true, data: rows, duplicate: true });
	}

	await db.insert(bukuKas).values(newRows as any);
	await publish(platform, branch, 'buku_kas', 'insert', {
		id: newRows[0]?.id,
		transaction_id: newRows[0]?.transaction_id as string | undefined
	});
	await auditDataChange(rawDb, branch, session, 'buku_kas', 'insert', newRows[0]?.id, {
		count: newRows.length,
		transaction_id: newRows[0]?.transaction_id
	});
	return json({ ok: true, data: rows });
};

export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload || !body.where?.id) throw kitError(400, 'Payload / id tidak valid');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);
	await db
		.update(bukuKas)
		.set({ ...(body.payload as any) })
		.where(and(eq(bukuKas.cabang_id, branch), eq(bukuKas.id, String(body.where.id))));
	await publish(platform, branch, 'buku_kas', 'update', { id: body.where.id });
	await auditDataChange(rawDb, branch, session, 'buku_kas', 'update', body.where.id, {
		fields: Object.keys(body.payload as any)
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const id = url.searchParams.get('id');
	const transactionId = url.searchParams.get('transaction_id');
	if (!id && !transactionId) throw kitError(400, 'id atau transaction_id diperlukan');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);

	if (transactionId) {
		// Bulk delete: hapus semua kas terkait satu transaksi.
		await db
			.delete(bukuKas)
			.where(and(eq(bukuKas.cabang_id, branch), eq(bukuKas.transaction_id, transactionId)));
		await publish(platform, branch, 'buku_kas', 'delete', { transaction_id: transactionId });
		await auditDataChange(rawDb, branch, session, 'buku_kas', 'delete_by_transaction', null, {
			transaction_id: transactionId
		});
		return json({ ok: true });
	}

	await db.delete(bukuKas).where(and(eq(bukuKas.cabang_id, branch), eq(bukuKas.id, String(id))));
	await publish(platform, branch, 'buku_kas', 'delete', { id });
	await auditDataChange(rawDb, branch, session, 'buku_kas', 'delete', id);
	return json({ ok: true });
};
