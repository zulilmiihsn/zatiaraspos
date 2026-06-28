import { json, error as kitError } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { pengaturan } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { parseBody, sanitizeUpdatePayload, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/pengaturan — Resource route untuk tabel `pengaturan` (1 row per cabang).
 * Menggantikan dispatch dari /api/data?table=pengaturan.
 * Catatan: `id` di tabel ini bertipe INTEGER (bukan TEXT) — di-coerce ke Number saat PATCH.
 * RBAC: pemilik (owner) untuk insert/update. GET boleh untuk semua yang login.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);

	const rows = await db.select().from(pengaturan).where(eq(pengaturan.cabang_id, branch)).limit(1);
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
	const row = Array.isArray(body.payload) ? body.payload : [body.payload];
	await db
		.insert(pengaturan)
		.values(row.map((r) => ({ ...r, cabang_id: branch }) as typeof pengaturan.$inferInsert));
	await publish(platform, branch, 'pengaturan', 'insert', {
		id: (row[0] as { id?: string | number })?.id
	});
	await auditDataChange(
		rawDb,
		branch,
		session,
		'pengaturan',
		'insert',
		(row[0] as { id?: string | number })?.id
	);
	return json({ ok: true, data: row });
};

export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload || body.where?.id == null) throw kitError(400, 'Payload / id tidak valid');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);
	// id di tabel pengaturan adalah INTEGER — coerce dari string ke Number.
	const idNum = Number(body.where!.id);
	await db
		.update(pengaturan)
		.set(sanitizeUpdatePayload(body.payload as Partial<typeof pengaturan.$inferInsert>))
		.where(and(eq(pengaturan.cabang_id, branch), eq(pengaturan.id, idNum)));
	await publish(platform, branch, 'pengaturan', 'update', { id: idNum });
	await auditDataChange(rawDb, branch, session, 'pengaturan', 'update', idNum, {
		fields: Object.keys(body.payload as Record<string, unknown>)
	});
	return json({ ok: true });
};
