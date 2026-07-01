import type { D1Database } from '@cloudflare/workers-types';
import { error as kitError } from '@sveltejs/kit';
import type { BranchId } from '$lib/server/branchResolver';
import type {
	ProductRow,
	RecipeRow,
	AddOnRow,
	CheckoutCapabilities
} from '$lib/server/checkout/types';
import { chunks, IN_QUERY_CHUNK_SIZE, assertActive } from '$lib/server/checkout/utils';

const checkoutCapabilityCache = new Map<string, Promise<CheckoutCapabilities>>();

// ── Schema introspection ────────────────────────────────────────────────────

async function hasColumn(db: D1Database, table: string, column: string): Promise<boolean> {
	try {
		const { results = [] } = (await db.prepare(`PRAGMA table_info(${table})`).all()) as {
			results?: Array<{ name?: string }>;
		};
		return results.some((row) => row.name === column);
	} catch {
		return false;
	}
}

async function hasTable(db: D1Database, table: string): Promise<boolean> {
	try {
		const row = (await db
			.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
			.bind(table)
			.first()) as { name?: string } | null;
		return Boolean(row?.name);
	} catch {
		return false;
	}
}

// ── Capability detection ────────────────────────────────────────────────────

export async function getCheckoutCapabilities(
	db: D1Database,
	branch: BranchId
): Promise<CheckoutCapabilities> {
	const key = String(branch);
	let cached = checkoutCapabilityCache.get(key);
	if (!cached) {
		cached = (async () => {
			const [
				stockTrackingAvailable,
				trackIngredientsColumn,
				bahanTable,
				resepTable,
				mutasiTable,
				idempotencyAvailable,
				dailySalesTable,
				dailyProductSalesTable,
				transactionProductNameColumn,
				transactionHppColumn
			] = await Promise.all([
				hasColumn(db, 'produk', 'lacak_stok'),
				hasColumn(db, 'produk', 'lacak_bahan'),
				hasTable(db, 'bahan'),
				hasTable(db, 'resep_produk'),
				hasTable(db, 'bahan_mutasi'),
				hasColumn(db, 'buku_kas', 'idempotency_key'),
				hasTable(db, 'ringkasan_penjualan_harian'),
				hasTable(db, 'penjualan_produk_harian'),
				hasColumn(db, 'transaksi_kasir', 'nama_produk'),
				hasColumn(db, 'transaksi_kasir', 'nominal_hpp')
			]);

			return {
				stockTrackingAvailable,
				ingredientTrackingAvailable:
					trackIngredientsColumn && bahanTable && resepTable && mutasiTable,
				idempotencyAvailable,
				salesSummaryAvailable: dailySalesTable && dailyProductSalesTable,
				transactionSnapshotAvailable: transactionProductNameColumn && transactionHppColumn
			};
		})().catch((error) => {
			checkoutCapabilityCache.delete(key);
			throw error;
		});
		checkoutCapabilityCache.set(key, cached);
	}
	return cached;
}

// ── Session lookup ──────────────────────────────────────────────────────────

export async function getActiveSessionId(
	db: D1Database,
	branch: BranchId
): Promise<string | null> {
	const row = (await db
		.prepare(
			`SELECT id
			 FROM sesi_toko
			 WHERE cabang_id = ? AND is_active = 1
			 ORDER BY waktu_buka DESC
			 LIMIT 1`
		)
		.bind(branch)
		.first()) as { id: string } | null;
	return row?.id ?? null;
}

// ── Idempotency check ───────────────────────────────────────────────────────

export async function getExistingByIdempotency(
	db: D1Database,
	branch: BranchId,
	idempotencyKey: string,
	idempotencyAvailable = true
) {
	if (!idempotencyAvailable) return null;

	return (await db
		.prepare(
			`SELECT id, transaction_id, nominal, jumlah
			 FROM buku_kas
			 WHERE cabang_id = ? AND idempotency_key = ?
			 LIMIT 1`
		)
		.bind(branch, idempotencyKey)
		.first()) as { id: string; transaction_id: string; nominal: number; jumlah: number } | null;
}

// ── Product loading ─────────────────────────────────────────────────────────

export async function loadProducts(
	db: D1Database,
	branch: BranchId,
	productIds: string[],
	stockTrackingAvailable: boolean,
	ingredientTrackingAvailable: boolean
): Promise<Map<string, ProductRow>> {
	const rows: ProductRow[] = [];
	for (const part of chunks(productIds, IN_QUERY_CHUNK_SIZE)) {
		if (!part.length) continue;
		const placeholders = part.map(() => '?').join(',');
		const { results = [] } = (await db
			.prepare(
				`SELECT id, nama, harga, stok,
				 ${stockTrackingAvailable ? 'lacak_stok,' : ''}
				 ${ingredientTrackingAvailable ? 'lacak_bahan,' : ''}
				 is_active
				 FROM produk
				 WHERE cabang_id = ? AND id IN (${placeholders})`
			)
			.bind(branch, ...part)
			.all()) as { results?: ProductRow[] };
		rows.push(...results);
	}

	const products = new Map(rows.map((product) => [String(product.id), product]));
	for (const productId of productIds) {
		const product = products.get(productId);
		if (!product) throw kitError(404, `Produk tidak ditemukan: ${productId}`);
		assertActive(product, product.nama);
	}
	return products;
}

// ── Recipe loading ──────────────────────────────────────────────────────────

export async function loadRecipesByProduct(
	db: D1Database,
	branch: BranchId,
	productIds: string[]
): Promise<Map<string, RecipeRow[]>> {
	const grouped = new Map<string, RecipeRow[]>();
	for (const part of chunks(productIds, IN_QUERY_CHUNK_SIZE)) {
		if (!part.length) continue;
		const placeholders = part.map(() => '?').join(',');
		const { results = [] } = (await db
			.prepare(
				`SELECT rp.produk_id, rp.bahan_id, b.nama AS bahan_name, b.satuan, rp.jumlah_per_item
					, COALESCE(b.biaya_per_satuan, 0) AS biaya_per_satuan
				 FROM resep_produk rp
				 INNER JOIN bahan b ON b.cabang_id = rp.cabang_id AND b.id = rp.bahan_id
				 WHERE rp.cabang_id = ? AND rp.produk_id IN (${placeholders}) AND b.is_active = 1
				 ORDER BY rp.produk_id ASC, b.nama ASC`
			)
			.bind(branch, ...part)
			.all()) as { results?: RecipeRow[] };

		for (const row of results) {
			const rows = grouped.get(row.produk_id) || [];
			rows.push(row);
			grouped.set(row.produk_id, rows);
		}
	}
	return grouped;
}

// ── Add-on loading ──────────────────────────────────────────────────────────

export async function loadAddOns(
	db: D1Database,
	branch: BranchId,
	ids: string[]
): Promise<Map<string, AddOnRow>> {
	if (!ids.length) return new Map();
	const rows: AddOnRow[] = [];
	for (const part of chunks(ids, IN_QUERY_CHUNK_SIZE)) {
		if (!part.length) continue;
		const placeholders = part.map(() => '?').join(',');
		const { results = [] } = (await db
			.prepare(
				`SELECT id, nama, harga, is_active
				 FROM tambahan
				 WHERE cabang_id = ? AND id IN (${placeholders})`
			)
			.bind(branch, ...part)
			.all()) as { results?: AddOnRow[] };
		rows.push(...results);
	}

	const addOns = new Map(rows.map((addOn) => [String(addOn.id), addOn]));
	for (const id of ids) {
		const addOn = addOns.get(id);
		if (!addOn) throw kitError(404, 'Tambahan tidak ditemukan');
		assertActive(addOn, addOn.nama);
	}
	return addOns;
}
