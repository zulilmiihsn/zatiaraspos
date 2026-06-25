import { json, error as kitError } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { profil } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { parseBody, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/profil — Resource route untuk tabel `profil` (akun pengguna per cabang).
 * Menggantikan dispatch dari /api/data?table=profil (yang hanya mendukung `update`).
 * Hanya PATCH. GET profil tidak lewat endpoint publik ini (dijaga ketat di alur auth).
 * RBAC: pemilik (owner).
 */
export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload || !body.where?.id) throw kitError(400, 'Payload / id tidak valid');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);
	await db
		.update(profil)
		.set({ ...(body.payload as Partial<typeof profil.$inferInsert>) })
		.where(and(eq(profil.cabang_id, branch), eq(profil.id, String(body.where.id))));
	await publish(platform, branch, 'profil', 'update', { id: body.where.id });
	await auditDataChange(rawDb, branch, session, 'profil', 'update', body.where.id, {
		fields: Object.keys(body.payload as Record<string, unknown>)
	});
	return json({ ok: true });
};
