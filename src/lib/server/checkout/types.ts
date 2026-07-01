import type { D1Database } from '@cloudflare/workers-types';
import type { BranchId } from '$lib/server/branchResolver';

// ── Input types ─────────────────────────────────────────────────────────────

export interface PosTransactionItemInput {
	product_id?: string | null;
	nama_kustom?: string | null;
	custom_price?: number | string | null;
	jumlah: number;
	add_on_ids?: Array<string | number>;
	gula?: string | null;
	es?: string | null;
	catatan?: string | null;
}

export interface PosTransactionInput {
	idempotency_key?: string;
	nama_pelanggan?: string | null;
	metode_bayar?: string;
	cash_received?: number | string | null;
	items?: PosTransactionItemInput[];
}

// ── DB row types ────────────────────────────────────────────────────────────

export interface ProductRow {
	id: string;
	nama: string;
	harga: number;
	stok: number | null;
	lacak_stok?: number | boolean | null;
	lacak_bahan?: number | boolean | null;
	is_active: number | boolean | null;
}

export interface RecipeRow {
	produk_id: string;
	bahan_id: string;
	bahan_name: string;
	satuan: string;
	jumlah_per_item: number;
	biaya_per_satuan: number;
}

export interface AddOnRow {
	id: string;
	nama: string;
	harga: number;
	is_active: number | boolean | null;
}

// ── Capability detection ────────────────────────────────────────────────────

export interface CheckoutCapabilities {
	stockTrackingAvailable: boolean;
	ingredientTrackingAvailable: boolean;
	idempotencyAvailable: boolean;
	salesSummaryAvailable: boolean;
	transactionSnapshotAvailable: boolean;
}

// ── Intermediate computation types ──────────────────────────────────────────

export interface NormalizedItemInput {
	source: PosTransactionItemInput;
	productId: string | null;
	addOnIds: string[];
	jumlah: number;
}

export interface ComputedTransactionItem {
	id: string;
	buku_kas_id: string;
	produk_id: string | null;
	nama_kustom: string | null;
	jumlah: number;
	nominal: number;
	harga: number;
	product_name: string;
	harga_dasar: number;
	total_tambahan: number;
	snapshot_tambahan: string | null;
	gula: string | null;
	es: string | null;
	catatan: string | null;
	snapshot_hpp: string | null;
	nominal_hpp: number;
	transaction_id: string;
}

export type StockDeductions = Map<string, { nama: string; jumlah: number }>;
export type IngredientDeductions = Map<
	string,
	{ nama: string; satuan: string; jumlah: number; products: string[] }
>;

// ── Context passed through the checkout pipeline ────────────────────────────

export interface CheckoutContext {
	db: D1Database;
	branch: BranchId;
	capabilities: CheckoutCapabilities;
	session: { userId: string; username?: string; role: string };
	platform: App.Platform | undefined;
}
