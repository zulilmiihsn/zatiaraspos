-- Rebuild POS daily summary tables from historical buku_kas/transaksi_kasir rows.
-- Run after 0004_daily_sales_summary and 0005_transaction_snapshots are applied.

DELETE FROM daily_sales_summary;
--> statement-breakpoint
INSERT INTO daily_sales_summary (
	id,
	branch_id,
	sales_date,
	transaction_count,
	item_count,
	gross_sales,
	cash_sales,
	non_cash_sales,
	created_at,
	updated_at
)
SELECT
	branch_id || ':' || date(datetime(waktu, '+8 hours')) AS id,
	branch_id,
	date(datetime(waktu, '+8 hours')) AS sales_date,
	COUNT(DISTINCT transaction_id) AS transaction_count,
	COALESCE(SUM(qty), 0) AS item_count,
	COALESCE(SUM(amount), 0) AS gross_sales,
	COALESCE(SUM(CASE WHEN payment_method = 'tunai' THEN amount ELSE 0 END), 0) AS cash_sales,
	COALESCE(SUM(CASE WHEN payment_method <> 'tunai' THEN amount ELSE 0 END), 0) AS non_cash_sales,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
FROM buku_kas
WHERE sumber = 'pos' AND tipe = 'in'
GROUP BY branch_id, sales_date;
--> statement-breakpoint
DELETE FROM daily_product_sales;
--> statement-breakpoint
INSERT INTO daily_product_sales (
	id,
	branch_id,
	sales_date,
	product_id,
	product_name,
	qty,
	gross_sales,
	transaction_count,
	created_at,
	updated_at
)
SELECT
	tk.branch_id || ':' || date(datetime(bk.waktu, '+8 hours')) || ':' || tk.produk_id AS id,
	tk.branch_id,
	date(datetime(bk.waktu, '+8 hours')) AS sales_date,
	tk.produk_id,
	COALESCE(tk.product_name, p.name, tk.custom_name, 'Item Custom') AS product_name,
	COALESCE(SUM(tk.qty), 0) AS qty,
	COALESCE(SUM(tk.amount), 0) AS gross_sales,
	COUNT(DISTINCT tk.transaction_id) AS transaction_count,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
FROM transaksi_kasir tk
INNER JOIN buku_kas bk ON bk.branch_id = tk.branch_id AND bk.id = tk.buku_kas_id
LEFT JOIN produk p ON p.branch_id = tk.branch_id AND p.id = tk.produk_id
WHERE tk.produk_id IS NOT NULL AND bk.sumber = 'pos' AND bk.tipe = 'in'
GROUP BY tk.branch_id, sales_date, tk.produk_id;
