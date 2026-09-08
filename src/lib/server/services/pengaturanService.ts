import { and, eq } from 'drizzle-orm';
import { pengaturan } from '$lib/database/schema';
import type { D1Database } from '@cloudflare/workers-types';
import { getDb, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { sanitizeUpdatePayload } from '$lib/server/resourceRouteHelpers';
import { error as kitError } from '@sveltejs/kit';

export type Database = ReturnType<typeof getDb>;
export type SessionUser = App.Locals['authSession'];

function containsPinFields(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	return Object.hasOwn(value, 'pin') || Object.hasOwn(value, 'pin_hash');
}

/**
 * Mengambil pengaturan cabang toko (1 baris per cabang).
 */
export async function getPengaturan(db: Database, branch: string) {
	const rows = await db.select().from(pengaturan).where(eq(pengaturan.cabang_id, branch)).limit(1);
	return rows.map(({ pin, pin_hash, ...row }) => ({
		...row,
		pinConfigured: Boolean(pin_hash || (pin && pin !== '1234'))
	}));
}

/**
 * Menyisipkan pengaturan toko dengan proteksi PIN.
 */
export async function insertPengaturanRows(
	db: Database,
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	requestedRows: Array<Record<string, unknown>>
) {
	if (requestedRows.some(containsPinFields)) {
		throw kitError(400, 'PIN hanya dapat diubah melalui endpoint keamanan');
	}

	await db
		.insert(pengaturan)
		.values(
			requestedRows.map((r) => ({ ...r, cabang_id: branch }) as typeof pengaturan.$inferInsert)
		);
	await publish(platform, branch, 'pengaturan', 'insert', {
		id: (requestedRows[0] as { id?: string | number })?.id
	});
	await auditDataChange(
		rawDb,
		branch,
		session,
		'pengaturan',
		'insert',
		(requestedRows[0] as { id?: string | number })?.id
	);
	return { ok: true, data: requestedRows };
}

/**
 * Memperbarui pengaturan toko dengan proteksi PIN.
 */
export async function updatePengaturanRow(
	db: Database,
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	id: string,
	payload: Record<string, unknown>
) {
	if (containsPinFields(payload)) {
		throw kitError(400, 'PIN hanya dapat diubah melalui endpoint keamanan');
	}

	await db
		.update(pengaturan)
		.set(sanitizeUpdatePayload(payload as Partial<typeof pengaturan.$inferInsert>))
		.where(and(eq(pengaturan.cabang_id, branch), eq(pengaturan.id, id)));
	await publish(platform, branch, 'pengaturan', 'update', { id });
	await auditDataChange(rawDb, branch, session, 'pengaturan', 'update', id, {
		fields: Object.keys(payload)
	});
	return { ok: true };
}
