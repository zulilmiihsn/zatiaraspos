-- Backfill kolom ringkasan_penjualan_harian.hpp_total dari data transaksi lama.
--
-- Diperlukan sekali setelah migration 0007_daily_sales_hpp diterapkan, supaya
-- laporan/dashboard periode lama tetap menampilkan HPP & profit yang akurat
-- tanpa perlu scan transaksi_kasir tiap kali.
--
-- Mengelompokkan hpp_amount per tanggal WITA (created_at + 8 jam) — sama persis
-- dengan cara checkout menentukan sales_date.
--
-- Idempoten: menulis ulang nilai (bukan increment), aman dijalankan berulang.
--
-- Jalankan per database cabang, mis:
--   npx wrangler d1 execute DB_SAMARINDA_GROUP --remote \
--     --config=wrangler.pages.jsonc --file=scripts/backfill-daily-sales-hpp.sql

UPDATE ringkasan_penjualan_harian
SET hpp_total = COALESCE(
		(
			SELECT SUM(tk.hpp_amount)
			FROM transaksi_kasir tk
			WHERE tk.cabang_id = ringkasan_penjualan_harian.cabang_id
				AND date(datetime(tk.created_at, '+8 hours')) = ringkasan_penjualan_harian.sales_date
		),
		0
	);
