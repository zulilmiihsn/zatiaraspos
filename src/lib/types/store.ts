/**
 * 🏪 STORE & SESSION TYPE DEFINITIONS
 *
 * Tipe-tipe untuk state management dan session toko.
 */

// ============================================================================
// 🌿 BRANCH TYPES
// ============================================================================

/**
 * ID cabang yang valid. Sesuaikan dengan data di tabel `cabang`.
 */
export type BranchId = string;

// ============================================================================
// 🏬 TOKO SESSION
// ============================================================================

/**
 * Representasi sesi toko aktif dari tabel `sesi_toko`.
 * Digunakan di dashboard (buka/tutup toko) dan POS.
 */
export interface TokoSession {
	id: string;
	kas_awal: number;
	waktu_buka: string;
	waktu_tutup?: string;
	is_active: boolean;
}

/**
 * Ringkasan untuk modal tutup toko.
 */
export interface TutupTokoSummary {
	modalAwal: number;
	totalPenjualan: number;
	pemasukanTunai: number;
	pengeluaranTunai: number;
	uangKasir: number;
}

// ============================================================================
// 🎨 LAZY ICON TYPE
// ============================================================================

/**
 * Tipe untuk ikon Lucide yang di-lazy-load.
 * Gunakan ini menggantikan `any` untuk ikon yang di-import secara dinamis.
 */
export type LazyIcon = typeof import('svelte').SvelteComponent | null;

// ============================================================================
// 🔐 SECURITY SETTINGS
// ============================================================================

export interface SecuritySettingsData {
	pin: string;
	halaman_terkunci: string[];
}
