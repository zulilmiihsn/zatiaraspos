-- Backfill kolom daily_sales_summary.hpp_total dari data transaksi lama.
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

UPDATE daily_sales_summary
SET hpp_total = COALESCE(
		(
			SELECT SUM(tk.hpp_amount)
			FROM transaksi_kasir tk
			WHERE tk.branch_id = daily_sales_summary.branch_id
				AND date(datetime(tk.created_at, '+8 hours')) = daily_sales_summary.sales_date
		),
		0
	);
