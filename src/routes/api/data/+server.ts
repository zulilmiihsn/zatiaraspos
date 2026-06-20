/**
 * /api/data/+server.ts
 * Unified edge data API for Cloudflare D1 via Drizzle ORM.
 * All DB access goes through this endpoint — never expose DB bindings to the browser.
 *
 * Pattern:  GET  /api/data?table=produk&branch=samarinda[&filters...]
 *           POST /api/data  { table, action, payload, branch }
 */

import { json, error as kitError } from '@sveltejs/kit';
import { eq, and, or, gt, gte, lte, desc, asc, sql, type SQL } from 'drizzle-orm';
import {
	produk,
	kategori,
	tambahan,
	bahan,
	resepProduk,
	bahanMutasi,
	hppSettings,
	bukuKas,
	transaksiKasir,
	profil,
	pengaturan,
	sesiToko
} from '$lib/database/schema';
import { getD1Database, getDrizzleDb, requireBranch } from '$lib/server/branchResolver';
import { publishBranchEvent, type RealtimeTable } from '$lib/server/realtimePublisher';
import { requireDataWriteAccess, requireSessionBranch } from '$lib/server/apiAuth';
import { appendAuditLog } from '$lib/server/auditLog';
import {
	DataQueryValidationError,
	decodeDataCursor,
	parseDataLimit,
	toCursorPage
} from '$lib/server/dataPagination';
import { hasDatabaseColumn } from '$lib/server/schemaCapabilities';
import { reverseDailySummaryForTransaction } from '$lib/server/dailySummary';
import { buildLaporanAggregate } from '$lib/server/reportQueries';
import {
	getDashboardStats,
	getWeeklyIncomeSummary,
	getBestSellersSummary,
	getPosKas7Hari
} from '$lib/server/dashboardQueries';
import type { RequestHandler } from './$types';

// ---------- helpers ----------

function getDb(platform: App.Platform | undefined, branch: string) {
	return getDrizzleDb(platform, requireBranch(branch));
}

function getRawDb(platform: App.Platform | undefined, branch: string) {
	return getD1Database(platform?.env as Record<string, unknown> | undefined, requireBranch(branch));
}

function newId() {
	return crypto.randomUUID();
}

function payloadRows(payload: Record<string, unknown> | Record<string, unknown>[], branch: string) {
	const rows = Array.isArray(payload) ? payload : [payload];
	return rows.map((row) => ({
		id: typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : newId(),
		...row,
		branch_id: branch
	})) as Array<Record<string, any>>;
}

async function publish(
	platform: App.Platform | undefined,
	branch: string,
	table: RealtimeTable,
	action: 'insert' | 'update' | 'delete' | 'upsert',
	extra: Record<string, unknown> = {}
) {
	await publishBranchEvent(
		platform?.env as Record<string, unknown> | undefined,
		branch,
		table,
		action,
		extra
	);
}

async function auditDataChange(
	db: any,
	branch: string,
	session: App.Locals['authSession'],
	table: string,
	action: string,
	entityId: string | number | null | undefined,
	metadata: Record<string, unknown> = {}
) {
	await appendAuditLog(db, requireBranch(branch), {
		action: `${table}.${action}`,
		entityType: table,
		entityId: entityId == null ? null : String(entityId),
		session,
		metadata
	});
}

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

	switch (table) {
		// Laporan ter-agregasi dari tabel harian (daily_sales_summary +
		// daily_product_sales) + entri manual. Tidak men-scan transaksi_kasir
		// atau seluruh buku_kas: baca dibatasi oleh (hari x produk), bukan volume
		// transaksi. Mengembalikan bentuk yang sama dengan getReportData lama
		// sehingga UI laporan tidak perlu berubah.
		case 'laporan_aggregate': {
			const startDate = url.searchParams.get('start_date');
			const endDate = url.searchParams.get('end_date');
			if (!startDate || !endDate) throw kitError(400, 'start_date and end_date required');
			return json(await buildLaporanAggregate(rawDb, branch, startDate, endDate));
		}
		case 'produk': {
			const rows = await db
				.select()
				.from(produk)
				.where(eq(produk.branch_id, branch))
				.orderBy(desc(produk.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'kategori': {
			const rows = await db
				.select()
				.from(kategori)
				.where(eq(kategori.branch_id, branch))
				.orderBy(desc(kategori.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'tambahan': {
			const rows = await db
				.select()
				.from(tambahan)
				.where(eq(tambahan.branch_id, branch))
				.orderBy(desc(tambahan.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'bahan': {
			const rows = await db
				.select()
				.from(bahan)
				.where(eq(bahan.branch_id, branch))
				.orderBy(asc(bahan.name))
				.limit(limit);
			return json(rows);
		}

		case 'resep_produk': {
			const productId = url.searchParams.get('product_id');
			const filters: SQL[] = [eq(resepProduk.branch_id, branch)];
			if (productId) filters.push(eq(resepProduk.product_id, productId));

			const rows = await db
				.select()
				.from(resepProduk)
				.where(and(...filters))
				.orderBy(desc(resepProduk.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'bahan_mutasi': {
			const bahanId = url.searchParams.get('bahan_id');
			const filters: SQL[] = [eq(bahanMutasi.branch_id, branch)];
			if (bahanId) filters.push(eq(bahanMutasi.bahan_id, bahanId));

			const rows = await db
				.select()
				.from(bahanMutasi)
				.where(and(...filters))
				.orderBy(desc(bahanMutasi.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'hpp_settings': {
			const rows = await db
				.select()
				.from(hppSettings)
				.where(eq(hppSettings.branch_id, branch))
				.limit(1);
			return json(rows);
		}

		case 'buku_kas': {
			const filters: SQL[] = [eq(bukuKas.branch_id, branch)];
			if (startTime) filters.push(gte(bukuKas.waktu, startTime));
			if (endTime) filters.push(lte(bukuKas.waktu, endTime));
			if (sumber) filters.push(eq(bukuKas.sumber, sumber));
			if (tipe) filters.push(eq(bukuKas.tipe, tipe));
			if (id) filters.push(eq(bukuKas.id, id));
			if (transactionId) filters.push(eq(bukuKas.transaction_id, transactionId));
			if (idSesiToko) filters.push(eq(bukuKas.id_sesi_toko, idSesiToko));
			if (cursor) {
				filters.push(
					or(
						gt(bukuKas.waktu, cursor.sortValue),
						and(eq(bukuKas.waktu, cursor.sortValue), gt(bukuKas.id, cursor.id))
					)!
				);
			}

			const rows = await db
				.select()
				.from(bukuKas)
				.where(and(...filters))
				.orderBy(asc(bukuKas.waktu), asc(bukuKas.id))
				.limit(cursorPagination ? limit + 1 : limit);
			if (!cursorPagination) return json(rows);
			return json(
				toCursorPage(rows, limit, (row) => ({ sortValue: row.waktu, id: String(row.id) }))
			);
		}

		case 'transaksi_kasir': {
			const filters = ['branch_id = ?'];
			const values: unknown[] = [branch];
			if (startTime) {
				filters.push('created_at >= ?');
				values.push(startTime);
			}
			if (endTime) {
				filters.push('created_at <= ?');
				values.push(endTime);
			}
			if (id) {
				filters.push('id = ?');
				values.push(id);
			}
			if (transactionId) {
				filters.push('transaction_id = ?');
				values.push(transactionId);
			}
			if (cursor) {
				filters.push('(created_at > ? OR (created_at = ? AND id > ?))');
				values.push(cursor.sortValue, cursor.sortValue, cursor.id);
			}
			const bukuKasIdsParam = url.searchParams.get('buku_kas_ids');
			if (bukuKasIdsParam) {
				const ids = bukuKasIdsParam.split(',').filter(Boolean);
				if (ids.length) {
					filters.push(`buku_kas_id IN (${ids.map(() => '?').join(',')})`);
					values.push(...ids);
				}
			}

			const hasSnapshots = await hasDatabaseColumn(
				rawDb,
				branch,
				'transaksi_kasir',
				'product_name'
			);
			const snapshotSelect = hasSnapshots
				? `product_name, base_price, add_on_total, add_on_snapshot, sugar, ice, note, hpp_snapshot, hpp_amount`
				: `NULL AS product_name, NULL AS base_price, 0 AS add_on_total, NULL AS add_on_snapshot,
					NULL AS sugar, NULL AS ice, NULL AS note, NULL AS hpp_snapshot, 0 AS hpp_amount`;
			const rows = await rawDb
				.prepare(
					`SELECT
						id, branch_id, buku_kas_id, produk_id, custom_name, qty, amount, price,
						${snapshotSelect},
						transaction_id, created_at, updated_at
					 FROM transaksi_kasir
					 WHERE ${filters.join(' AND ')}
						 ORDER BY created_at ASC, id ASC
						 LIMIT ?`
					)
					.bind(...values, cursorPagination ? limit + 1 : limit)
					.all();
			const data = (rows.results || []) as Array<{ id: string; created_at: string }>;
			if (!cursorPagination) return json(data);
			return json(
				toCursorPage(data, limit, (row) => ({ sortValue: row.created_at, id: String(row.id) }))
			);
		}

		case 'dashboard_stats': {
			if (!branch) throw kitError(400, 'branch required');
			if (!startTime || !endTime) throw kitError(400, 'start and end required');
			return json(await getDashboardStats(db, branch, startTime, endTime));
		}
		case 'weekly_income_summary': {
			if (!branch || !startTime || !endTime) throw kitError(400, 'branch, start, end required');
			return json(await getWeeklyIncomeSummary(db, branch, startTime, endTime));
		}
		case 'best_sellers_summary': {
			if (!branch || !startTime || !endTime) throw kitError(400, 'branch, start, end required');
			return json(await getBestSellersSummary(rawDb, branch, startTime, endTime));
		}
		case 'pos_kas_7hari': {
			if (!branch || !startTime || !endTime) throw kitError(400, 'branch, start, end required');
			return json(await getPosKas7Hari(db, branch, startTime, endTime));
		}

		case 'sesi_toko': {
			const filters: SQL[] = [eq(sesiToko.branch_id, branch)];
			if (id) filters.push(eq(sesiToko.id, id));
			if (active === 'true') filters.push(eq(sesiToko.is_active, true));
			if (active === 'false') filters.push(eq(sesiToko.is_active, false));

			const rows = await db
				.select()
				.from(sesiToko)
				.where(and(...filters))
				.orderBy(desc(sesiToko.created_at))
				.limit(limit);
			return json(rows);
		}

		case 'pengaturan': {
			const rows = await db
				.select()
				.from(pengaturan)
				.where(eq(pengaturan.branch_id, branch))
				.limit(1);
			return json(rows);
		}

		default:
			throw kitError(400, `Unknown table: ${table}`);
	}
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

	switch (table) {
		// ---- produk ----
		case 'produk': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(produk).values(rows as any);
				await publish(platform, branch, 'produk', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'produk', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(produk)
					.set({ ...(payload as any) })
					.where(and(eq(produk.branch_id, branch), eq(produk.id, String(whereClause.id))));
				await publish(platform, branch, 'produk', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'produk', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'update' && whereClause?.kategori_id !== undefined) {
				await db
					.update(produk)
					.set({ ...(payload as any) })
					.where(
						and(
							eq(produk.branch_id, branch),
							eq(produk.kategori_id, String(whereClause.kategori_id))
						)
					);
				await publish(platform, branch, 'produk', 'update');
				await auditDataChange(rawDb, branch, session, 'produk', 'bulk_update', null, {
					kategori_id: whereClause.kategori_id,
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(produk)
					.where(and(eq(produk.branch_id, branch), eq(produk.id, String(whereClause.id))));
				await publish(platform, branch, 'produk', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'produk', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- kategori ----
		case 'kategori': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(kategori).values(rows as any);
				await publish(platform, branch, 'kategori', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'kategori', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(kategori)
					.set({ ...(payload as any) })
					.where(and(eq(kategori.branch_id, branch), eq(kategori.id, String(whereClause.id))));
				await publish(platform, branch, 'kategori', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'kategori', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(kategori)
					.where(and(eq(kategori.branch_id, branch), eq(kategori.id, String(whereClause.id))));
				await publish(platform, branch, 'kategori', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'kategori', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- tambahan ----
		case 'tambahan': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(tambahan).values(rows as any);
				await publish(platform, branch, 'tambahan', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'tambahan', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(tambahan)
					.set({ ...(payload as any) })
					.where(and(eq(tambahan.branch_id, branch), eq(tambahan.id, String(whereClause.id))));
				await publish(platform, branch, 'tambahan', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'tambahan', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(tambahan)
					.where(and(eq(tambahan.branch_id, branch), eq(tambahan.id, String(whereClause.id))));
				await publish(platform, branch, 'tambahan', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'tambahan', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- bahan ----
		case 'bahan': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch).map((row) => ({
					...row,
					unit: row.unit || 'gram',
					current_stock: Number(row.current_stock || 0),
					low_stock_threshold: Number(row.low_stock_threshold || 0),
					cost_per_unit: Number(row.cost_per_unit || 0),
					last_purchase_qty: Number(row.last_purchase_qty || 0),
					last_purchase_cost: Number(row.last_purchase_cost || 0)
				})) as Array<Record<string, any>>;
				await db.insert(bahan).values(rows as any);
				await publish(platform, branch, 'bahan', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'bahan', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				const safePayload = { ...(payload as any) };
				if ('current_stock' in safePayload)
					safePayload.current_stock = Number(safePayload.current_stock || 0);
				if ('low_stock_threshold' in safePayload) {
					safePayload.low_stock_threshold = Number(safePayload.low_stock_threshold || 0);
				}
				if ('cost_per_unit' in safePayload) {
					safePayload.cost_per_unit = Number(safePayload.cost_per_unit || 0);
				}
				if ('last_purchase_qty' in safePayload) {
					safePayload.last_purchase_qty = Number(safePayload.last_purchase_qty || 0);
				}
				if ('last_purchase_cost' in safePayload) {
					safePayload.last_purchase_cost = Number(safePayload.last_purchase_cost || 0);
				}
				await db
					.update(bahan)
					.set(safePayload)
					.where(and(eq(bahan.branch_id, branch), eq(bahan.id, String(whereClause.id))));
				await publish(platform, branch, 'bahan', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'bahan', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				const used = await rawDb
					.prepare(`SELECT id FROM resep_produk WHERE branch_id = ? AND bahan_id = ? LIMIT 1`)
					.bind(branch, String(whereClause.id))
					.first();
				if (used) throw kitError(409, 'Bahan masih dipakai di resep menu');

				await db
					.delete(bahan)
					.where(and(eq(bahan.branch_id, branch), eq(bahan.id, String(whereClause.id))));
				await publish(platform, branch, 'bahan', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'bahan', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- resep produk ----
		case 'resep_produk': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch).map((row) => ({
					...row,
					product_id: String(row.product_id || ''),
					bahan_id: String(row.bahan_id || ''),
					qty_per_item: Number(row.qty_per_item || 0)
				})) as Array<Record<string, any>>;
				if (rows.some((row) => !row.product_id || !row.bahan_id || row.qty_per_item <= 0)) {
					throw kitError(400, 'Resep bahan tidak valid');
				}
				await db.insert(resepProduk).values(rows as any);
				await publish(platform, branch, 'resep_produk', 'insert', {
					id: rows[0]?.id,
					transaction_id: rows[0]?.product_id as string | undefined
				});
				await auditDataChange(rawDb, branch, session, 'resep_produk', 'insert', rows[0]?.id, {
					count: rows.length,
					product_id: rows[0]?.product_id
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'delete' && whereClause?.product_id) {
				await db
					.delete(resepProduk)
					.where(
						and(
							eq(resepProduk.branch_id, branch),
							eq(resepProduk.product_id, String(whereClause.product_id))
						)
					);
				await publish(platform, branch, 'resep_produk', 'delete', {
					transaction_id: String(whereClause.product_id)
				});
				await auditDataChange(rawDb, branch, session, 'resep_produk', 'delete_by_product', null, {
					product_id: whereClause.product_id
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(resepProduk)
					.where(
						and(eq(resepProduk.branch_id, branch), eq(resepProduk.id, String(whereClause.id)))
					);
				await publish(platform, branch, 'resep_produk', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'resep_produk', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- mutasi bahan ----
		case 'bahan_mutasi': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				if (rows.length !== 1) throw kitError(400, 'Mutasi bahan harus satu per request');
				const row = rows[0];
				const bahanId = String(row.bahan_id || '');
				const quantityDelta = Number(row.quantity_delta || 0);
				if (!bahanId || !Number.isFinite(quantityDelta) || quantityDelta === 0) {
					throw kitError(400, 'Mutasi bahan tidak valid');
				}

				const item = (await rawDb
					.prepare(`SELECT id FROM bahan WHERE branch_id = ? AND id = ? LIMIT 1`)
					.bind(branch, bahanId)
					.first()) as { id: string } | null;
				if (!item) throw kitError(404, 'Bahan tidak ditemukan');

				const now = new Date().toISOString();
				try {
					await rawDb.batch([
						rawDb
							.prepare(
								`UPDATE bahan
								 SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ?
								 WHERE branch_id = ? AND id = ?`
							)
							.bind(quantityDelta, now, branch, bahanId),
						rawDb
							.prepare(
								`INSERT INTO bahan_mutasi (
									id, branch_id, bahan_id, quantity_delta, stock_after, source,
									reference_id, note, created_by, created_at
								)
								VALUES (
									?, ?, ?, ?,
									(SELECT current_stock FROM bahan WHERE branch_id = ? AND id = ?),
									?, ?, ?, ?, ?
								)`
							)
							.bind(
								row.id,
								branch,
								bahanId,
								quantityDelta,
								branch,
								bahanId,
								String(row.source || 'manual'),
								row.reference_id == null ? null : String(row.reference_id),
								row.note == null ? null : String(row.note).slice(0, 160),
								session?.username || session?.userId || null,
								now
							)
					]);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					if (message.includes('INSUFFICIENT_INGREDIENT')) {
						throw kitError(409, 'Stok bahan tidak boleh minus');
					}
					throw error;
				}

				await publish(platform, branch, 'bahan', 'update', { id: bahanId });
				await publish(platform, branch, 'bahan_mutasi', 'insert', { id: row.id });
				await auditDataChange(rawDb, branch, session, 'bahan_mutasi', 'insert', row.id, {
					bahan_id: bahanId,
					quantity_delta: quantityDelta
				});
				return json({ ok: true, data: [row] });
			}
			break;
		}

		// ---- HPP settings ----
		case 'hpp_settings': {
			if (action === 'insert' || action === 'update') {
				const input = Array.isArray(payload) ? payload[0] || {} : payload;
				const id = `${branch}:default`;
				const now = new Date().toISOString();
				const row = {
					id,
					branch_id: branch,
					rent_monthly: Number((input as any).rent_monthly || 0),
					electricity_monthly: Number((input as any).electricity_monthly || 0),
					water_monthly: Number((input as any).water_monthly || 0),
					salary_monthly: Number((input as any).salary_monthly || 0),
					other_monthly: Number((input as any).other_monthly || 0),
					target_items_monthly: Math.max(1, Number((input as any).target_items_monthly || 1000))
				};

				await rawDb
					.prepare(
						`INSERT INTO hpp_settings (
							id, branch_id, rent_monthly, electricity_monthly, water_monthly,
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
						row.branch_id,
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
			}
			break;
		}

		// ---- buku_kas ----
		case 'buku_kas': {
			if (action === 'insert') {
				const rows: Array<Record<string, any>> = payloadRows(payload, branch).map((row) => ({
					...row,
					amount: row.amount ?? row.nominal ?? 0,
					nominal: row.nominal ?? row.amount ?? 0
				}));
				const newRows: Array<Record<string, any>> = [];
				for (const row of rows) {
					const existing = await rawDb
						.prepare('SELECT id FROM buku_kas WHERE branch_id = ? AND id = ? LIMIT 1')
						.bind(branch, String(row.id))
						.first();
					if (!existing) newRows.push(row);
				}

				if (newRows.length === 0) {
					return json({ ok: true, data: rows, duplicate: true });
				}

				await db.insert(bukuKas).values(newRows as any);
				await publish(platform, branch, 'buku_kas', 'insert', {
					id: newRows[0]?.id,
					transaction_id: newRows[0]?.transaction_id as string | undefined
				});
				await auditDataChange(rawDb, branch, session, 'buku_kas', 'insert', newRows[0]?.id, {
					count: newRows.length,
					transaction_id: newRows[0]?.transaction_id
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(bukuKas)
					.set({ ...(payload as any) })
					.where(and(eq(bukuKas.branch_id, branch), eq(bukuKas.id, String(whereClause.id))));
				await publish(platform, branch, 'buku_kas', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'buku_kas', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(bukuKas)
					.where(and(eq(bukuKas.branch_id, branch), eq(bukuKas.id, String(whereClause.id))));
				await publish(platform, branch, 'buku_kas', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'buku_kas', 'delete', whereClause.id);
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.transaction_id) {
				await db
					.delete(bukuKas)
					.where(
						and(
							eq(bukuKas.branch_id, branch),
							eq(bukuKas.transaction_id, whereClause.transaction_id)
						)
					);
				await publish(platform, branch, 'buku_kas', 'delete', {
					transaction_id: whereClause.transaction_id
				});
				await auditDataChange(rawDb, branch, session, 'buku_kas', 'delete_by_transaction', null, {
					transaction_id: whereClause.transaction_id
				});
				return json({ ok: true });
			}
			break;
		}

		// ---- transaksi_kasir ----
		case 'transaksi_kasir': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(transaksiKasir).values(rows as any);
				await publish(platform, branch, 'transaksi_kasir', 'insert', {
					transaction_id: rows[0]?.transaction_id as string | undefined
				});
				await auditDataChange(rawDb, branch, session, 'transaksi_kasir', 'insert', rows[0]?.id, {
					count: rows.length,
					transaction_id: rows[0]?.transaction_id
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'delete' && whereClause?.transaction_id) {
				// Balikkan kontribusi transaksi ke ringkasan harian SEBELUM item dihapus
				// (item + buku_kas masih ada di sini). Jangan blok penghapusan bila gagal.
				try {
					await reverseDailySummaryForTransaction(
						rawDb,
						branch,
						String(whereClause.transaction_id)
					);
				} catch {
					// Tabel ringkasan mungkin belum ada / gagal sebagian — abaikan.
				}
				await db
					.delete(transaksiKasir)
					.where(
						and(
							eq(transaksiKasir.branch_id, branch),
							eq(transaksiKasir.transaction_id, whereClause.transaction_id)
						)
					);
				await publish(platform, branch, 'transaksi_kasir', 'delete', {
					transaction_id: whereClause.transaction_id
				});
				await auditDataChange(
					rawDb,
					branch,
					session,
					'transaksi_kasir',
					'delete_by_transaction',
					null,
					{ transaction_id: whereClause.transaction_id }
				);
				return json({ ok: true });
			}
			break;
		}

		// ---- profil ----
		case 'profil': {
			if (action === 'update' && whereClause?.id) {
				await db
					.update(profil)
					.set({ ...(payload as any) })
					.where(and(eq(profil.branch_id, branch), eq(profil.id, String(whereClause.id))));
				await publish(platform, branch, 'profil', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'profil', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			break;
		}

		// ---- sesi_toko ----
		case 'sesi_toko': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(sesiToko).values(rows as any);
				await publish(platform, branch, 'sesi_toko', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'sesi_toko', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(sesiToko)
					.set({ ...(payload as any) })
					.where(and(eq(sesiToko.branch_id, branch), eq(sesiToko.id, String(whereClause.id))));
				await publish(platform, branch, 'sesi_toko', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'sesi_toko', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			break;
		}

		// ---- pengaturan ----
		case 'pengaturan': {
			if (action === 'insert') {
				const row = Array.isArray(payload) ? payload : [payload];
				await db.insert(pengaturan).values(row.map((r) => ({ ...r, branch_id: branch }) as any));
				await publish(platform, branch, 'pengaturan', 'insert', { id: (row[0] as any)?.id });
				await auditDataChange(rawDb, branch, session, 'pengaturan', 'insert', (row[0] as any)?.id);
				return json({ ok: true, data: row });
			}
			if (action === 'update' && whereClause?.id) {
				const idNum = Number(whereClause.id);
				await db
					.update(pengaturan)
					.set({ ...(payload as any) })
					.where(and(eq(pengaturan.branch_id, branch), eq(pengaturan.id, idNum)));
				await publish(platform, branch, 'pengaturan', 'update', { id: idNum });
				await auditDataChange(rawDb, branch, session, 'pengaturan', 'update', idNum, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			break;
		}

		default:
			throw kitError(400, `Unknown table: ${table}`);
	}

	throw kitError(400, `Invalid action '${action}' for table '${table}'`);
};
