import { json, error as kitError } from '@sveltejs/kit';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb } from '$lib/server/dataApiHelpers';
import { parseBody, type WriteBody } from '$lib/server/resourceRouteHelpers';
import {
	getPengaturan,
	insertPengaturanRows,
	updatePengaturanRow
} from '$lib/server/services/pengaturanService';
import type { RequestHandler } from './$types';

/**
 * /api/pengaturan — Resource route controller untuk tabel `pengaturan` (1 row per cabang).
 * Menangani HTTP auth, validasi request, dan delegasi ke pengaturanService.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);

	const rows = await getPengaturan(db, branch);
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
	const requestedRows = Array.isArray(body.payload) ? body.payload : [body.payload];

	const result = await insertPengaturanRows(
		db,
		rawDb,
		branch,
		session,
		platform,
		requestedRows
	);
	return json(result);
};

export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload || body.where?.id == null) throw kitError(400, 'Payload / id tidak valid');

	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);
	const idStr = String(body.where!.id);

	const result = await updatePengaturanRow(
		db,
		rawDb,
		branch,
		session,
		platform,
		idStr,
		body.payload as Record<string, unknown>
	);
	return json(result);
};
