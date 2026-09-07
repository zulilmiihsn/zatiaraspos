import { and, desc, eq, type SQL } from 'drizzle-orm';
import { sesiToko } from '$lib/database/schema';
import type { D1Database } from '@cloudflare/workers-types';
import { getDb, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { sanitizeUpdatePayload } from '$lib/server/resourceRouteHelpers';

export type Database = ReturnType<typeof getDb>;
export type SessionUser = App.Locals['authSession'];

/**
 * Mengambil daftar sesi toko berdasarkan cabang dan filter aktif.
 */
export async function getSesiTokoList(
	db: Database,
	branch: string,
	id: string | null,
	active: string | null,
	limit: number
) {
	const filters: SQL[] = [eq(sesiToko.cabang_id, branch)];
	if (id) filters.push(eq(sesiToko.id, id));
	if (active === 'true') filters.push(eq(sesiToko.is_active, true));
	if (active === 'false') filters.push(eq(sesiToko.is_active, false));

	return db
		.select()
		.from(sesiToko)
		.where(and(...filters))
		.orderBy(desc(sesiToko.created_at))
		.limit(limit);
}

/**
 * Menyisipkan sesi toko baru (buka toko).
 */
export async function insertSesiTokoRows(
	db: Database,
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	rows: Array<Record<string, unknown>>
) {
	await db.insert(sesiToko).values(rows as (typeof sesiToko.$inferInsert)[]);
	await publish(platform, branch, 'sesi_toko', 'insert', { id: rows[0]?.id as string | undefined });
	await auditDataChange(
		rawDb,
		branch,
		session,
		'sesi_toko',
		'insert',
		rows[0]?.id as string | number | null | undefined,
		{
			count: rows.length
		}
	);
	return { ok: true, data: rows };
}

/**
 * Memperbarui data sesi toko (tutup toko, update kas akhir).
 */
export async function updateSesiTokoRow(
	db: Database,
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	id: string,
	payload: Record<string, unknown>
) {
	await db
		.update(sesiToko)
		.set(sanitizeUpdatePayload(payload as Partial<typeof sesiToko.$inferInsert>))
		.where(and(eq(sesiToko.cabang_id, branch), eq(sesiToko.id, id)));
	await publish(platform, branch, 'sesi_toko', 'update', { id });
	await auditDataChange(rawDb, branch, session, 'sesi_toko', 'update', id, {
		fields: Object.keys(payload)
	});
	return { ok: true };
}
