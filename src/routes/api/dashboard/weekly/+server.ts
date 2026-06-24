import { json, error as kitError } from '@sveltejs/kit';
import { requireSessionBranch } from '$lib/server/apiAuth';
import { getDb } from '$lib/server/dataApiHelpers';
import { getWeeklyIncomeSummary } from '$lib/server/dashboardQueries';
import type { RequestHandler } from './$types';

/**
 * /api/dashboard/weekly — Ringkasan pemasukan harian untuk grafik mingguan.
 * Menggantikan dispatch dari /api/data?table=weekly_income_summary.
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);
	const start = url.searchParams.get('start');
	const end = url.searchParams.get('end');
	if (!start || !end) throw kitError(400, 'start dan end diperlukan');
	return json(await getWeeklyIncomeSummary(db, branch, start, end));
};
