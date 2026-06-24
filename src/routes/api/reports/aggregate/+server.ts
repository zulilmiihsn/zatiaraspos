import { json, error as kitError } from '@sveltejs/kit';
import { requireSessionBranch } from '$lib/server/apiAuth';
import { getRawDb } from '$lib/server/dataApiHelpers';
import { buildLaporanAggregate } from '$lib/server/reportQueries';
import type { RequestHandler } from './$types';

/**
 * /api/reports/aggregate — Laporan ter-agregasi dari tabel harian + buku_kas manual.
 * Menggantikan dispatch dari /api/data?table=laporan_aggregate.
 * Mengembalikan LaporanAggregate (summary, pemasukanUsaha, pemasukanLain, bebanUsaha, bebanLain, transactions).
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const rawDb = getRawDb(platform, branch);
	const startDate = url.searchParams.get('start_date');
	const endDate = url.searchParams.get('end_date');
	if (!startDate || !endDate) throw kitError(400, 'start_date dan end_date diperlukan');
	return json(await buildLaporanAggregate(rawDb, branch, startDate, endDate));
};
