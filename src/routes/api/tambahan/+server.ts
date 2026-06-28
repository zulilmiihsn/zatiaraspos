import { json, error as kitError } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { tambahan } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, payloadRows, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { parseBody, sanitizeUpdatePayload, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/tambahan — Resource route untuk tabel `tambahan` (ekstra/add-on menu).
 * Menggantikan dispatch dari /api/data?table=tambahan.
 * RBAC: pemilik (owner) untuk semua operasi tulis.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);
	const limit = Number(url.searchParams.get('limit') || 200);

	const rows = await db
		.select()
		.from(tambahan)
		.where(eq(tambahan.cabang_id, branch))
		.orderBy(desc(tambahan.created_at))
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
	await db.insert(tambahan).values(rows as (typeof tambahan.$inferInsert)[]);
	await publish(platform, branch, 'tambahan', 'insert', { id: rows[0]?.id });
	await auditDataChange(rawDb, branch, session, 'tambahan', 'insert', rows[0]?.id, {
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
		.update(tambahan)
		.set(sanitizeUpdatePayload(body.payload as Partial<typeof tambahan.$inferInsert>))
		.where(and(eq(tambahan.cabang_id, branch), eq(tambahan.id, String(body.where.id))));
	await publish(platform, branch, 'tambahan', 'update', { id: body.where.id });
	await auditDataChange(rawDb, branch, session, 'tambahan', 'update', body.where.id, {
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
	await db.delete(tambahan).where(and(eq(tambahan.cabang_id, branch), eq(tambahan.id, id)));
	await publish(platform, branch, 'tambahan', 'delete', { id });
	await auditDataChange(rawDb, branch, session, 'tambahan', 'delete', id);
	return json({ ok: true });
};
