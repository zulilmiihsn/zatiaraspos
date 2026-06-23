import { json, error as kitError } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { produk } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, payloadRows, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { parseBody, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/produk — Resource route untuk tabel `produk` (menu).
 * Menggantikan dispatch dari /api/data?table=produk.
 * PATCH mendukung dua mode:
 *   - body.where.id           → update satu produk
 *   - body.where.kategori_id  → bulk update semua produk dalam kategori
 * RBAC: pemilik (owner) untuk semua operasi tulis.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);
	const limit = Number(url.searchParams.get('limit') || 200);

	const rows = await db
		.select()
		.from(produk)
		.where(eq(produk.cabang_id, branch))
		.orderBy(desc(produk.created_at))
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
	const rows = payloadRows(body.payload, branch);
	await db.insert(produk).values(rows as any);
	await publish(platform, branch, 'produk', 'insert', { id: rows[0]?.id });
	await auditDataChange(rawDb, branch, session, 'produk', 'insert', rows[0]?.id, {
		count: rows.length
	});
	return json({ ok: true, data: rows });
};

export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload) throw kitError(400, 'Payload tidak valid');
	const { id, kategori_id: kategoriId } = body.where || {};
	if (id == null && kategoriId === undefined) throw kitError(400, 'id atau kategori_id diperlukan');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);

	// Mode bulk: update semua produk dalam kategori.
	if (kategoriId !== undefined && id == null) {
		await db
			.update(produk)
			.set({ ...(body.payload as any) })
			.where(and(eq(produk.cabang_id, branch), eq(produk.kategori_id, String(kategoriId))));
		await publish(platform, branch, 'produk', 'update');
		await auditDataChange(rawDb, branch, session, 'produk', 'bulk_update', null, {
			kategori_id: kategoriId,
			fields: Object.keys(body.payload as any)
		});
		return json({ ok: true });
	}

	// Mode single: update satu produk by id.
	await db
		.update(produk)
		.set({ ...(body.payload as any) })
		.where(and(eq(produk.cabang_id, branch), eq(produk.id, String(id))));
	await publish(platform, branch, 'produk', 'update', { id });
	await auditDataChange(rawDb, branch, session, 'produk', 'update', id, {
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
	await db.delete(produk).where(and(eq(produk.cabang_id, branch), eq(produk.id, id)));
	await publish(platform, branch, 'produk', 'delete', { id });
	await auditDataChange(rawDb, branch, session, 'produk', 'delete', id);
	return json({ ok: true });
};
