import { json, error as kitError } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hppSettings } from '$lib/database/schema';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getDb, getRawDb, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { parseBody, type WriteBody } from '$lib/server/resourceRouteHelpers';
import type { RequestHandler } from './$types';

/**
 * /api/hpp-settings — Resource route untuk tabel `hpp_settings` (1 row per cabang).
 * Menggantikan dispatch dari /api/data?table=hpp_settings.
 * Invariant: upsert via `ON CONFLICT(id) DO UPDATE` dengan id tetap `${branch}:default`.
 * RBAC: pemilik (owner) untuk upsert. GET boleh untuk semua yang login.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);

	const rows = await db
		.select()
		.from(hppSettings)
		.where(eq(hppSettings.cabang_id, branch))
		.limit(1);
	return json(rows);
};

type HppPayload = {
	rent_monthly?: number;
	electricity_monthly?: number;
	water_monthly?: number;
	salary_monthly?: number;
	other_monthly?: number;
	target_items_monthly?: number;
};

export const PUT: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = await parseBody<WriteBody>(request);
	if (!body?.payload) throw kitError(400, 'Payload tidak valid');

	const input = (Array.isArray(body.payload) ? body.payload[0] : body.payload) as HppPayload;
	const id = `${branch}:default`;
	const now = new Date().toISOString();
	const row = {
		id,
		cabang_id: branch,
		rent_monthly: Number(input.rent_monthly || 0),
		electricity_monthly: Number(input.electricity_monthly || 0),
		water_monthly: Number(input.water_monthly || 0),
		salary_monthly: Number(input.salary_monthly || 0),
		other_monthly: Number(input.other_monthly || 0),
		target_items_monthly: Math.max(1, Number(input.target_items_monthly || 1000))
	};

	const rawDb = getRawDb(platform, branch);
	await rawDb
		.prepare(
			`INSERT INTO pengaturan_hpp (
				id, cabang_id, rent_monthly, electricity_monthly, water_monthly,
				salary_monthly, other_monthly, target_items_monthly, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				rent_monthly = excluded.rent_monthly,
				electricity_monthly = excluded.electricity_monthly,
				water_monthly = excluded.water_monthly,
				salary_monthly = excluded.salary_monthly,
				other_monthly = excluded.other_monthly,
				target_items_monthly = excluded.target_items_monthly,
				updated_at = excluded.updated_at`
		)
		.bind(
			row.id,
			row.cabang_id,
			row.rent_monthly,
			row.electricity_monthly,
			row.water_monthly,
			row.salary_monthly,
			row.other_monthly,
			row.target_items_monthly,
			now,
			now
		)
		.run();

	await publish(platform, branch, 'hpp_settings', 'upsert', { id });
	await auditDataChange(rawDb, branch, session, 'hpp_settings', 'upsert', id, row);
	return json({ ok: true, data: [row] });
};
