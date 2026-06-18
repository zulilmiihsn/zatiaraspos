DELETE FROM transaksi_kasir
WHERE branch_id = 'samarinda'
	AND transaction_id IN (
		SELECT transaction_id
		FROM buku_kas
		WHERE branch_id = 'samarinda'
			AND customer_name = 'UAT Browser'
	);

DELETE FROM buku_kas
WHERE branch_id = 'samarinda'
	AND customer_name = 'UAT Browser';
