import { json, error as kitError } from '@sveltejs/kit';
import { eq, and, or, gt, gte, lte, desc, asc, type SQL } from 'drizzle-orm';
import {
	produk,
	kategori,
	tambahan,
	bahan,
	resepProduk,
	bahanMutasi,
	hppSettings,
	bukuKas,
	pengaturan,
	sesiToko
} from '$lib/database/schema';
import { toCursorPage, type DataCursor } from '$lib/server/dataPagination';
import { hasDatabaseColumn } from '$lib/server/schemaCapabilities';
import { buildLaporanAggregate } from '$lib/server/reportQueries';
import {
	getDashboardStats,
	getWeeklyIncomeSummary,
	getBestSellersSummary,
	getPosKas7Hari
} from '$lib/server/dashboardQueries';
import type { BranchId, DrizzleDb } from '$lib/server/branchResolver';
import type { D1Database } from '@cloudflare/workers-types';

export type DataReadContext = {
	db: DrizzleDb;
	rawDb: D1Database;
	branch: BranchId;
	table: string | null;
	url: URL;
	startTime: string | null;
	endTime: string | null;
	limit: number;
	cursor: DataCursor | null;
	cursorPagination: boolean;
	sumber: string | null;
	tipe: string | null;
	id: string | null;
	transactionId: string | null;
	idSesiToko: string | null;
	active: string | null;
};

/** Menangani semua operasi baca GET /api/data (list & agregasi per tabel). */
export async function handleDataRead(ctx: DataReadContext): Promise<Response> {
	const {
		db,
		rawDb,
		branch,
		table,
		url,
		startTime,
		endTime,
		limit,
		cursor,
		cursorPagination,
		sumber,
		tipe,
		id,
		transactionId,
		idSesiToko,
		active
	} = ctx;
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
}
