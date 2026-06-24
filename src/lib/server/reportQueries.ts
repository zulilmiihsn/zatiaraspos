import type { BranchId } from '$lib/server/branchResolver';
import type { D1Database } from '@cloudflare/workers-types';

export type LaporanAggregate = {
	summary: {
		pendapatan: number;
		pengeluaran: number;
		saldo: number;
		labaKotor: number;
		pajak: number;
		labaBersih: number;
	};
	pemasukanUsaha: Array<Record<string, any>>;
	pemasukanLain: Array<Record<string, any>>;
	bebanUsaha: Array<Record<string, any>>;
	bebanLain: Array<Record<string, any>>;
	transactions: Array<Record<string, any>>;
};

/**
 * Menyusun laporan ter-agregasi untuk rentang tanggal WITA dari tabel harian
 * (daily_sales_summary + daily_product_sales) + entri manual buku_kas.
 *
 * Tidak men-scan transaksi_kasir atau seluruh buku_kas: baca dibatasi oleh
 * (hari x produk), bukan volume transaksi. POS direpresentasikan sebagai baris
 * ringkas per (produk x metode); entri manual diteruskan apa adanya. Bentuk
 * keluaran identik dengan getReportData lama agar UI tidak perlu berubah.
 *
 * `startDate`/`endDate` adalah tanggal WITA 'YYYY-MM-DD'.
 */
export async function buildLaporanAggregate(
	rawDb: D1Database,
	branch: BranchId,
	startDate: string,
	endDate: string
): Promise<LaporanAggregate> {
	const summaryRow = (await rawDb
		.prepare(
			`SELECT COALESCE(SUM(penjualan_kotor),0) AS gross
			 FROM ringkasan_penjualan_harian
			 WHERE cabang_id = ? AND tanggal_penjualan >= ? AND tanggal_penjualan <= ?`
		)
		.bind(branch, startDate, endDate)
		.first()
		.catch(() => null)) as { gross?: number } | null;

	const productRows =
		(
			(await rawDb
				.prepare(
					`SELECT nama_produk,
					COALESCE(SUM(penjualan_tunai),0) AS cash,
					COALESCE(SUM(penjualan_nontunai),0) AS non_cash
				 FROM penjualan_produk_harian
				 WHERE cabang_id = ? AND tanggal_penjualan >= ? AND tanggal_penjualan <= ?
				 GROUP BY nama_produk`
				)
				.bind(branch, startDate, endDate)
				.all()
				.catch(() => ({ results: [] }))) as {
				results?: Array<{ nama_produk?: string; cash?: number; non_cash?: number }>;
			}
		).results || [];

	const manualRows =
		(
			(await rawDb
				.prepare(
					`SELECT id, transaction_id, waktu, sumber, tipe, jenis, nominal,
					deskripsi, metode_bayar, nama_pelanggan
				 FROM buku_kas
				 WHERE cabang_id = ?
					AND (sumber IS NULL OR sumber != 'pos')
					AND date(datetime(waktu, '+8 hours')) >= ?
					AND date(datetime(waktu, '+8 hours')) <= ?
				 ORDER BY waktu DESC`
				)
				.bind(branch, startDate, endDate)
				.all()
				.catch(() => ({ results: [] }))) as {
				results?: Array<Record<string, any>>;
			}
		).results || [];

	const transactions: Array<Record<string, any>> = [];
	for (const p of productRows) {
		const name = p.nama_produk || 'Item';
		const cash = Number(p.cash || 0);
		const nonCash = Number(p.non_cash || 0);
		if (cash > 0) {
			transactions.push({
				id: `pos:${name}:tunai`,
				transaction_id: null,
				waktu: endDate,
				sumber: 'pos',
				tipe: 'in',
				jenis: 'pendapatan_usaha',
				nominal: cash,
				deskripsi: name,
				metode_bayar: 'tunai'
			});
		}
		if (nonCash > 0) {
			transactions.push({
				id: `pos:${name}:qris`,
				transaction_id: null,
				waktu: endDate,
				sumber: 'pos',
				tipe: 'in',
				jenis: 'pendapatan_usaha',
				nominal: nonCash,
				deskripsi: name,
				metode_bayar: 'qris'
			});
		}
	}

	let manualIncome = 0;
	let manualExpense = 0;
	for (const m of manualRows) {
		// `amount` adalah field kanonik buku_kas (notNull).
		const value = Number(m.nominal) || 0;
		transactions.push({
			...m,
			sumber: m.sumber || 'catat',
			nominal: value,
			deskripsi: m.deskripsi || 'Transaksi Lainnya'
		});
		if (m.tipe === 'in') manualIncome += value;
		else if (m.tipe === 'out') manualExpense += value;
	}

	const posGross = Number(summaryRow?.gross || 0);
	const totalPemasukan = posGross + manualIncome;
	const totalPengeluaran = manualExpense;
	const labaKotor = totalPemasukan - totalPengeluaran;
	const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;
	const pemasukan = transactions.filter((t) => t.tipe === 'in');
	const pengeluaran = transactions.filter((t) => t.tipe === 'out');

	return {
		summary: {
			pendapatan: totalPemasukan,
			pengeluaran: totalPengeluaran,
			saldo: labaKotor,
			labaKotor,
			pajak,
			labaBersih: labaKotor - pajak
		},
		pemasukanUsaha: pemasukan.filter((t) => t.jenis === 'pendapatan_usaha'),
		pemasukanLain: pemasukan.filter((t) => t.jenis === 'lainnya'),
		bebanUsaha: pengeluaran.filter((t) => t.jenis === 'beban_usaha'),
		bebanLain: pengeluaran.filter((t) => t.jenis === 'lainnya'),
		transactions
	};
}
