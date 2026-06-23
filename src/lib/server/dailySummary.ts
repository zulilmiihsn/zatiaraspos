import type { BranchId } from '$lib/server/branchResolver';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Product_id sintetis untuk mengelompokkan item custom (penjualan non-produk
 * dari kasir, yang `produk_id`-nya NULL) di daily_product_sales. Tanpa ini item
 * custom hanya masuk total (daily_sales_summary) tapi tak punya baris rincian,
 * sehingga hilang dari laporan. Dipakai bersama oleh penulisan ringkasan POS,
 * pembalikan saat void, dan dikecualikan dari best-sellers.
 */
export const CUSTOM_PRODUCT_BUCKET_ID = '__custom__';

/**
 * Membalik (decrement) kontribusi sebuah transaksi POS terhadap tabel ringkasan
 * harian ketika transaksi tersebut dihapus/void.
 *
 * Harus dipanggil SEBELUM baris transaksi_kasir dihapus, selagi item dan
 * buku_kas-nya masih ada (alur hapus di UI menghapus transaksi_kasir lebih dulu,
 * lalu buku_kas).
 *
 * Tanpa ini, menghapus penjualan tidak mengurangi omzet/HPP/profit di laporan —
 * angka jadi overstated seiring waktu.
 *
 * Aman dijalankan walau tabel ringkasan belum ada (gagal => di-skip diam-diam):
 * pemanggil membungkus dengan try/catch agar penghapusan tidak pernah terblok.
 * Semua decrement di-clamp di 0 supaya ringkasan tidak pernah negatif.
 */
export async function reverseDailySummaryForTransaction(
	rawDb: D1Database,
	branch: BranchId,
	transactionId: string
): Promise<void> {
	// Agregat kontribusi transaksi: tanggal WITA dari created_at item, dan
	// metode bayar dari buku_kas induknya.
	const header = (await rawDb
		.prepare(
			`SELECT
				date(datetime(tk.created_at, '+8 hours')) AS sales_date,
				bk.payment_method AS payment_method,
				COALESCE(SUM(tk.qty), 0) AS item_qty,
				COALESCE(SUM(tk.amount), 0) AS gross,
				COALESCE(SUM(tk.hpp_amount), 0) AS hpp
			 FROM transaksi_kasir tk
			 INNER JOIN buku_kas bk
				ON bk.branch_id = tk.branch_id AND bk.id = tk.buku_kas_id
			 WHERE tk.branch_id = ? AND tk.transaction_id = ?
			 GROUP BY sales_date, bk.payment_method
			 LIMIT 1`
		)
		.bind(branch, transactionId)
		.first()) as {
		sales_date?: string;
		payment_method?: string;
		item_qty?: number;
		gross?: number;
		hpp?: number;
	} | null;

	if (!header || !header.sales_date) return;

	const salesDate = header.sales_date;
	const itemQty = Number(header.item_qty || 0);
	const gross = Number(header.gross || 0);
	const hpp = Number(header.hpp || 0);
	const isCash = header.payment_method === 'tunai';
	const cashDelta = isCash ? gross : 0;
	const nonCashDelta = isCash ? 0 : gross;
	const now = new Date().toISOString();

	// Kontribusi per produk untuk daily_product_sales.
	const products = ((await rawDb
		.prepare(
			`SELECT COALESCE(produk_id, '${CUSTOM_PRODUCT_BUCKET_ID}') AS produk_id,
				COALESCE(SUM(qty), 0) AS qty,
				COALESCE(SUM(amount), 0) AS gross
			 FROM transaksi_kasir
			 WHERE branch_id = ? AND transaction_id = ?
			 GROUP BY COALESCE(produk_id, '${CUSTOM_PRODUCT_BUCKET_ID}')`
		)
		.bind(branch, transactionId)
		.all()
		.catch(() => ({ results: [] }))) as {
		results?: Array<{ produk_id?: string; qty?: number; gross?: number }>;
	}).results || [];

	const statements = [
		rawDb
			.prepare(
				`UPDATE ringkasan_penjualan_harian SET
					transaction_count = MAX(0, transaction_count - 1),
					item_count = MAX(0, item_count - ?),
					gross_sales = MAX(0, gross_sales - ?),
					cash_sales = MAX(0, cash_sales - ?),
					non_cash_sales = MAX(0, non_cash_sales - ?),
					hpp_total = MAX(0, hpp_total - ?),
					updated_at = ?
				 WHERE branch_id = ? AND sales_date = ?`
			)
			.bind(itemQty, gross, cashDelta, nonCashDelta, hpp, now, branch, salesDate),
		...products.map((p) =>
			rawDb
				.prepare(
					`UPDATE penjualan_produk_harian SET
						qty = MAX(0, qty - ?),
						gross_sales = MAX(0, gross_sales - ?),
						cash_sales = MAX(0, cash_sales - ?),
						non_cash_sales = MAX(0, non_cash_sales - ?),
						transaction_count = MAX(0, transaction_count - 1),
						updated_at = ?
					 WHERE branch_id = ? AND sales_date = ? AND produk_id = ?`
				)
				.bind(
					Number(p.qty || 0),
					Number(p.gross || 0),
					isCash ? Number(p.gross || 0) : 0,
					isCash ? 0 : Number(p.gross || 0),
					now,
					branch,
					salesDate,
					String(p.produk_id)
				)
		)
	];

	await rawDb.batch(statements);
}
