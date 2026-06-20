-- Backfill kolom daily_product_sales.cash_sales / non_cash_sales dari data lama.
--
-- Diperlukan sekali setelah migration 0008_daily_product_payment_split, supaya
-- rincian Pendapatan Usaha per produk (split QRIS/Tunai) di laporan periode lama
-- tetap akurat tanpa scan transaksi_kasir.
--
-- Split per produk per tanggal WITA berdasarkan payment_method buku_kas induk.
-- Idempoten: menulis ulang nilai (bukan increment), aman dijalankan berulang.
--
-- Jalankan per database cabang, mis:
--   npx wrangler d1 execute DB_SAMARINDA_GROUP --remote \
--     --config=wrangler.pages.jsonc --file=scripts/backfill-daily-product-split.sql

UPDATE daily_product_sales
SET
	cash_sales = COALESCE(
		(
			SELECT SUM(tk.amount)
			FROM transaksi_kasir tk
			INNER JOIN buku_kas bk ON bk.branch_id = tk.branch_id AND bk.id = tk.buku_kas_id
			WHERE tk.branch_id = daily_product_sales.branch_id
				AND tk.produk_id = daily_product_sales.product_id
				AND date(datetime(tk.created_at, '+8 hours')) = daily_product_sales.sales_date
				AND bk.payment_method = 'tunai'
		),
		0
	),
	non_cash_sales = COALESCE(
		(
			SELECT SUM(tk.amount)
			FROM transaksi_kasir tk
			INNER JOIN buku_kas bk ON bk.branch_id = tk.branch_id AND bk.id = tk.buku_kas_id
			WHERE tk.branch_id = daily_product_sales.branch_id
				AND tk.produk_id = daily_product_sales.product_id
				AND date(datetime(tk.created_at, '+8 hours')) = daily_product_sales.sales_date
				AND bk.payment_method != 'tunai'
		),
		0
	);
