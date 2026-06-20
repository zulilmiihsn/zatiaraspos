import { and, eq, gte, lte, asc } from 'drizzle-orm';
import { dailySalesSummary, transaksiKasir, bukuKas } from '$lib/database/schema';
import type { BranchId } from '$lib/server/branchResolver';

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
 * Statistik dashboard untuk rentang. Jalur cepat: baca ringkasan harian
 * (daily_sales_summary, sudah memuat hpp_total). Fallback (tabel ringkasan belum
 * ada): scan transaksi mentah seperti perilaku lama.
 */
export async function getDashboardStats(
	db: any,
	branch: BranchId,
	startTime: string,
	endTime: string
): Promise<Record<string, unknown>> {
	try {
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
		if (summary.length) {
			return { summary };
		}
	} catch {
		// Tabel ringkasan mungkin belum ada sampai migrasi terbaru diterapkan.
	}

	const [kasir, kas] = await Promise.all([
		db
			.select({ qty: transaksiKasir.qty, transaction_id: bukuKas.transaction_id })
			.from(transaksiKasir)
			.innerJoin(bukuKas, eq(transaksiKasir.buku_kas_id, bukuKas.id))
			.where(
				and(
					eq(transaksiKasir.branch_id, branch),
					gte(transaksiKasir.created_at, startTime),
					lte(transaksiKasir.created_at, endTime)
				)
			),
		db
			.select({ amount: bukuKas.amount, tipe: bukuKas.tipe, transaction_id: bukuKas.transaction_id })
			.from(bukuKas)
			.where(
				and(
					eq(bukuKas.branch_id, branch),
					eq(bukuKas.sumber, 'pos'),
					gte(bukuKas.waktu, startTime),
					lte(bukuKas.waktu, endTime)
				)
			)
	]);

	return { kasir, kas };
}

/** Ringkasan pemasukan harian untuk grafik mingguan, dari daily_sales_summary. */
export async function getWeeklyIncomeSummary(
	db: any,
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
	rawDb: any,
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
	db: any,
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
