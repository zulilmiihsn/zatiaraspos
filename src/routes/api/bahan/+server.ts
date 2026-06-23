import { json, error as kitError } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { bahan } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, payloadRows, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { parseBody, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/bahan — Resource route untuk tabel `bahan` (bahan baku & stok).
 * Menggantikan dispatch dari /api/data?table=bahan.
 * Invariant:
 *   - Field numerik di-coerce (current_stock, cost_per_unit, dll) di insert & update.
 *   - DELETE menolak (409) bila bahan masih dipakai di resep_produk.
 * RBAC: pemilik (owner) untuk semua operasi tulis.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);
	const limit = Number(url.searchParams.get('limit') || 200);

	const rows = await db
		.select()
		.from(bahan)
		.where(eq(bahan.cabang_id, branch))
		.orderBy(asc(bahan.name))
		.limit(limit);
	return json(rows);
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload) throw kitError(400, 'Payload tidak valid');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);
	const rows = payloadRows(body.payload, branch).map((row) => ({
		...row,
		unit: row.unit || 'gram',
		current_stock: Number(row.current_stock || 0),
		low_stock_threshold: Number(row.low_stock_threshold || 0),
		cost_per_unit: Number(row.cost_per_unit || 0),
		last_purchase_qty: Number(row.last_purchase_qty || 0),
		last_purchase_cost: Number(row.last_purchase_cost || 0)
	})) as Array<Record<string, any>>;
	await db.insert(bahan).values(rows as any);
	await publish(platform, branch, 'bahan', 'insert', { id: rows[0]?.id });
	await auditDataChange(rawDb, branch, session, 'bahan', 'insert', rows[0]?.id, {
		count: rows.length
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
	const safePayload = { ...(body.payload as any) };
	// Coerce field numerik bila ada di payload.
	if ('current_stock' in safePayload)
		safePayload.current_stock = Number(safePayload.current_stock || 0);
	if ('low_stock_threshold' in safePayload) {
		safePayload.low_stock_threshold = Number(safePayload.low_stock_threshold || 0);
	}
	if ('cost_per_unit' in safePayload)
		safePayload.cost_per_unit = Number(safePayload.cost_per_unit || 0);
	if ('last_purchase_qty' in safePayload) {
		safePayload.last_purchase_qty = Number(safePayload.last_purchase_qty || 0);
	}
	if ('last_purchase_cost' in safePayload) {
		safePayload.last_purchase_cost = Number(safePayload.last_purchase_cost || 0);
	}
	await db
		.update(bahan)
		.set(safePayload)
		.where(and(eq(bahan.cabang_id, branch), eq(bahan.id, String(body.where.id))));
	await publish(platform, branch, 'bahan', 'update', { id: body.where.id });
	await auditDataChange(rawDb, branch, session, 'bahan', 'update', body.where.id, {
		fields: Object.keys(body.payload as any)
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const id = url.searchParams.get('id');
	if (!id) throw kitError(400, 'id diperlukan');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);

	// FK pre-check: tolak hapus bila bahan masih dipakai di resep menu.
	const used = await rawDb
		.prepare(`SELECT id FROM resep_produk WHERE cabang_id = ? AND bahan_id = ? LIMIT 1`)
		.bind(branch, id)
		.first();
	if (used) throw kitError(409, 'Bahan masih dipakai di resep menu');

	await db.delete(bahan).where(and(eq(bahan.cabang_id, branch), eq(bahan.id, id)));
	await publish(platform, branch, 'bahan', 'delete', { id });
	await auditDataChange(rawDb, branch, session, 'bahan', 'delete', id);
	return json({ ok: true });
};
