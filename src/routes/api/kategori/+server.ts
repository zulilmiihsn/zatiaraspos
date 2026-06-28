import { json, error as kitError } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { kategori } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, payloadRows, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { parseBody, sanitizeUpdatePayload, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/kategori — Resource route untuk tabel `kategori`.
 * Menggantikan dispatch dari /api/data?table=kategori.
 * RBAC: pemilik (owner) untuk semua operasi tulis.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);
	const limit = Number(url.searchParams.get('limit') || 200);

	const rows = await db
		.select()
		.from(kategori)
		.where(eq(kategori.cabang_id, branch))
		.orderBy(desc(kategori.created_at))
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
	await db.insert(kategori).values(rows as (typeof kategori.$inferInsert)[]);
	await publish(platform, branch, 'kategori', 'insert', { id: rows[0]?.id });
	await auditDataChange(rawDb, branch, session, 'kategori', 'insert', rows[0]?.id, {
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
	await db
		.update(kategori)
		.set(sanitizeUpdatePayload(body.payload as Partial<typeof kategori.$inferInsert>))
		.where(and(eq(kategori.cabang_id, branch), eq(kategori.id, String(body.where.id))));
	await publish(platform, branch, 'kategori', 'update', { id: body.where.id });
	await auditDataChange(rawDb, branch, session, 'kategori', 'update', body.where.id, {
		fields: Object.keys(body.payload as Record<string, unknown>)
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
	await db.delete(kategori).where(and(eq(kategori.cabang_id, branch), eq(kategori.id, id)));
	await publish(platform, branch, 'kategori', 'delete', { id });
	await auditDataChange(rawDb, branch, session, 'kategori', 'delete', id);
	return json({ ok: true });
};
