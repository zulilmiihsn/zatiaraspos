/**
 * 📊 LAPORAN (REPORT) TYPE DEFINITIONS
 *
 * Tipe-tipe untuk halaman laporan keuangan dan buku kas.
 */

// ============================================================================
// 📒 BUKU KAS RECORD
// ============================================================================

/**
 * Representasi satu baris dari tabel `buku_kas` di Supabase.
 * Digunakan di laporan, riwayat, dan kalkulasi keuangan.
 */
export interface BukuKasRecord {
	id: string;
	tipe: 'in' | 'out';
	jenis: 'pendapatan_usaha' | 'beban_usaha' | 'lainnya';
	nominal: number;
	amount?: number; // Alias legacy, gunakan `nominal`
	catatan?: string;
	description?: string; // Alias legacy
	payment_method: 'tunai' | 'non-tunai' | 'qris';
	sumber?: 'pos' | 'manual' | 'catat';
	waktu?: string;
	created_at: string;
	transaction_date?: string;
	id_sesi_toko?: string;
	branch_id?: string;
	user_id?: string;
	// Fields dari join transaksi_kasir
	ref_transaksi_kasir_id?: string;
	nama_produk?: string;
	produk_detail?: string;
	transaction_id?: string;
	nama?: string;
	customer_name?: string;
}

// ============================================================================
// 📈 LAPORAN SUMMARY
// ============================================================================

/**
 * Ringkasan keuangan yang ditampilkan di summary cards laporan.
 */
export interface LaporanSummary {
	pendapatan: number | null;
	pengeluaran: number | null;
	saldo: number | null;
	labaKotor: number | null;
	pajak: number | null;
	labaBersih: number | null;
}

// ============================================================================
// 🧾 RECEIPT SETTINGS
// ============================================================================

/**
 * Pengaturan struk/receipt dari tabel `pengaturan_struk`.
 */
export interface ReceiptSettings {
	id?: string;
	nama_toko: string;
	alamat_toko?: string;
	alamat?: string; // Alias from `pengaturan` table
	no_telp?: string;
	telepon?: string; // Alias from `pengaturan` table
	instagram?: string;
	ucapan?: string;
	catatan_bawah?: string;
	show_logo?: boolean;
	logo_url?: string;
	show_alamat?: boolean;
	show_telp?: boolean;
	show_tanggal?: boolean;
	show_kasir?: boolean;
	show_catatan?: boolean;
	paper_size?: 'thermal58' | 'thermal80' | 'a4';
}

// ============================================================================
// 📊 REPORT FILTER
// ============================================================================

export type FilterType = 'harian' | 'mingguan' | 'bulanan' | 'tahunan';

export interface ReportDateRange {
	startDate: string;
	endDate: string;
}

// ============================================================================
// 💹 DASHBOARD STATS
// ============================================================================

export interface DashboardStats {
	omzet: number;
	jumlahTransaksi: number;
	profit: number;
	itemTerjual: number;
	totalItem: number;
	avgTransaksi: number;
	jamRamai: string;
}

export interface WeeklyIncomeData {
	weeklyIncome: number[];
	weeklyMax: number;
}

export interface BestSeller {
	name: string;
	image?: string;
	total_qty: number;
}
