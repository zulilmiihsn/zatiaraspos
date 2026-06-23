import { and, eq, gte, lte, asc } from 'drizzle-orm';
import { dailySalesSummary, bukuKas } from '$lib/database/schema';
import type { BranchId, DrizzleDb } from '$lib/server/branchResolver';
import type { D1Database } from '@cloudflare/workers-types';
import { CUSTOM_PRODUCT_BUCKET_ID } from '$lib/server/dailySummary';

/** Konversi timestamp ISO ke tanggal WITA 'YYYY-MM-DD' (zona Asia/Makassar). */
function witaDate(ts: string): string {
	return new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'Asia/Makassar',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(ts));
}

/**
 * Statistik dashboard untuk rentang, dari ringkasan harian
 * (daily_sales_summary, sudah memuat hpp_total). Satu metode — tabel ringkasan
 * dijamin ada (migrasi 0004/0007) dan dijaga konsisten oleh checkout/void.
 * Periode tanpa penjualan → summary kosong (konsumen menghitungnya nol).
 */
export async function getDashboardStats(
	db: DrizzleDb,
	branch: BranchId,
	startTime: string,
	endTime: string
): Promise<Record<string, unknown>> {
	const startDate = witaDate(startTime);
	const endDate = witaDate(endTime);
	const summary = await db
		.select()
		.from(dailySalesSummary)
		.where(
			and(
				eq(dailySalesSummary.branch_id, branch),
				gte(dailySalesSummary.sales_date, startDate),
				lte(dailySalesSummary.sales_date, endDate)
			)
		)
		.orderBy(asc(dailySalesSummary.sales_date));
	return { summary };
}

/** Ringkasan pemasukan harian untuk grafik mingguan, dari daily_sales_summary. */
export async function getWeeklyIncomeSummary(
	db: DrizzleDb,
	branch: BranchId,
	startTime: string,
	endTime: string
): Promise<unknown[]> {
	try {
		const startDate = witaDate(startTime);
		const endDate = witaDate(endTime);
		return await db
			.select()
			.from(dailySalesSummary)
			.where(
				and(
					eq(dailySalesSummary.branch_id, branch),
					gte(dailySalesSummary.sales_date, startDate),
					lte(dailySalesSummary.sales_date, endDate)
				)
			)
			.orderBy(asc(dailySalesSummary.sales_date));
	} catch {
		return [];
	}
}

/** Top 3 produk terlaris untuk rentang, dari daily_product_sales. */
export async function getBestSellersSummary(
	rawDb: D1Database,
	branch: BranchId,
	startTime: string,
	endTime: string
): Promise<unknown[]> {
	try {
		const startDate = witaDate(startTime);
		const endDate = witaDate(endTime);
		const rows = await rawDb
			.prepare(
				`SELECT product_id, product_name, SUM(qty) AS total_qty, SUM(gross_sales) AS gross_sales
				 FROM daily_product_sales
				 WHERE branch_id = ? AND sales_date >= ? AND sales_date <= ?
					AND product_id != '${CUSTOM_PRODUCT_BUCKET_ID}'
				 GROUP BY product_id, product_name
				 ORDER BY total_qty DESC
				 LIMIT 3`
			)
			.bind(branch, startDate, endDate)
			.all();
		return rows.results || [];
	} catch {
		return [];
	}
}

/** Header transaksi POS dalam rentang (untuk agregasi kas 7 hari di klien). */
export async function getPosKas7Hari(
	db: DrizzleDb,
	branch: BranchId,
	startTime: string,
	endTime: string
): Promise<unknown[]> {
	return db
		.select({ transaction_id: bukuKas.transaction_id, waktu: bukuKas.waktu })
		.from(bukuKas)
		.where(
			and(
				eq(bukuKas.branch_id, branch),
				eq(bukuKas.sumber, 'pos'),
				gte(bukuKas.waktu, startTime),
				lte(bukuKas.waktu, endTime)
			)
		);
}
