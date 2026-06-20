/**
 * /api/data/+server.ts
 * Unified edge data API for Cloudflare D1 via Drizzle ORM.
 * All DB access goes through this endpoint — never expose DB bindings to the browser.
 *
 * Pattern:  GET  /api/data?table=produk&branch=samarinda[&filters...]
 *           POST /api/data  { table, action, payload, branch }
 */

import { error as kitError } from '@sveltejs/kit';
import { requireDataWriteAccess, requireSessionBranch } from '$lib/server/apiAuth';
import {
	DataQueryValidationError,
	decodeDataCursor,
	parseDataLimit
} from '$lib/server/dataPagination';
import { getDb, getRawDb } from '$lib/server/dataApiHelpers';
import { handleDataRead } from '$lib/server/dataReadHandlers';
import { handleDataWrite } from '$lib/server/dataWriteHandlers';
import type { RequestHandler } from './$types';

// ---------- GET handler ----------

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const table = url.searchParams.get('table');
	const branch = requireSessionBranch(locals, url.searchParams.get('branch'));
	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);
	const startTime = url.searchParams.get('start');
	const endTime = url.searchParams.get('end');
	let limit: number;
	let cursor: ReturnType<typeof decodeDataCursor>;
	try {
		limit = parseDataLimit(url.searchParams.get('limit'));
		cursor = decodeDataCursor(url.searchParams.get('cursor'));
	} catch (error) {
		if (error instanceof DataQueryValidationError) throw kitError(400, error.message);
		throw error;
	}
	const cursorPagination = url.searchParams.get('pagination') === 'cursor' || cursor !== null;
	const sumber = url.searchParams.get('sumber');
	const tipe = url.searchParams.get('tipe');
	const id = url.searchParams.get('id');
	const transactionId = url.searchParams.get('transaction_id');
	const idSesiToko = url.searchParams.get('id_sesi_toko');
	const active = url.searchParams.get('is_active');

	return handleDataRead({ db, rawDb, branch, table, url, startTime, endTime, limit, cursor, cursorPagination, sumber, tipe, id, transactionId, idSesiToko, active });
};

// ---------- POST handler ----------

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const body = (await request.json()) as {
		table: string;
		action: 'insert' | 'update' | 'delete';
		payload: Record<string, unknown> | Record<string, unknown>[];
		branch: string;
		where?: {
			id?: string;
			transaction_id?: string;
			kategori_id?: string | number;
			product_id?: string | number;
			bahan_id?: string | number;
		};
	};

	const { table, action, payload, where: whereClause } = body;
	const session = locals.authSession;
	const branch = requireSessionBranch(locals, body.branch);
	const db = getDb(platform, branch);
	const rawDb = getRawDb(platform, branch);

	if (!table || !action || !branch) {
		throw kitError(400, 'table, action, branch are required');
	}
	requireDataWriteAccess(table, action, session?.role || '', payload);

	return handleDataWrite({ db, rawDb, branch, table, action, payload, whereClause, session, platform });
};
