import { json, error as kitError } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';
import { getD1Database } from '$lib/server/branchResolver';
import { requireAnyRole, requireSessionBranch } from '$lib/server/apiAuth';
import { publishBranchEvent } from '$lib/server/realtimePublisher';
import type { BranchId } from '$lib/server/branchResolver';
import { appendAuditLog } from '$lib/server/auditLog';
import { consumeRateLimit } from '$lib/server/rateLimit';
import { recordErrorEvent } from '$lib/server/observability';
import { CUSTOM_PRODUCT_BUCKET_ID } from '$lib/server/dailySummary';
import type { RequestHandler } from './$types';

const CHECKOUT_WINDOW_MS = 60 * 1000;
const CHECKOUT_MAX_PER_WINDOW = 30;

interface PosTransactionItemInput {
	product_id?: string | null;
	nama_kustom?: string | null;
	custom_price?: number | string | null;
	jumlah: number;
	add_on_ids?: Array<string | number>;
	gula?: string | null;
	es?: string | null;
	catatan?: string | null;
}

interface PosTransactionInput {
	idempotency_key?: string;
	nama_pelanggan?: string | null;
	metode_bayar?: string;
	cash_received?: number | string | null;
	items?: PosTransactionItemInput[];
}

interface ProductRow {
	id: string;
	nama: string;
	harga: number;
	stok: number | null;
	lacak_stok?: number | boolean | null;
	lacak_bahan?: number | boolean | null;
	is_active: number | boolean | null;
}

interface RecipeRow {
	produk_id: string;
	bahan_id: string;
	bahan_name: string;
	satuan: string;
	jumlah_per_item: number;
	biaya_per_satuan: number;
}

interface AddOnRow {
	id: string;
	nama: string;
	harga: number;
	is_active: number | boolean | null;
}

interface CheckoutCapabilities {
	stockTrackingAvailable: boolean;
	ingredientTrackingAvailable: boolean;
	idempotencyAvailable: boolean;
	salesSummaryAvailable: boolean;
	transactionSnapshotAvailable: boolean;
}

interface NormalizedItemInput {
	source: PosTransactionItemInput;
	productId: string | null;
	addOnIds: string[];
	jumlah: number;
}

const IN_QUERY_CHUNK_SIZE = 80;
const checkoutCapabilityCache = new Map<string, Promise<CheckoutCapabilities>>();

function getDb(platform: App.Platform | undefined, branch: BranchId) {
	return getD1Database(platform?.env as Record<string, unknown> | undefined, branch);
}

function normalizeMoney(value: unknown): number {
	const amount = Number(value);
	if (!Number.isFinite(amount) || amount < 0) return 0;
	return Math.round(amount);
}

function normalizeCost(value: unknown): number {
	const amount = Number(value);
	if (!Number.isFinite(amount) || amount < 0) return 0;
	return Math.round(amount * 10000) / 10000;
}

function roundMoney(value: number): number {
	return Math.round(value * 100) / 100;
}

function summarizeD1Meta(results: unknown): string | null {
	if (!Array.isArray(results)) return null;

	const summary = {
		statements: results.length,
		rows_read: 0,
		rows_written: 0,
		changes: 0,
		duration_ms: 0
	};
	let hasMeta = false;

	for (const result of results) {
		if (!result || typeof result !== 'object') continue;
		const meta = (result as { meta?: Record<string, unknown> }).meta;
		if (!meta || typeof meta !== 'object') continue;
		hasMeta = true;
		summary.rows_read += Number(meta.rows_read ?? meta.rowsRead ?? 0) || 0;
		summary.rows_written += Number(meta.rows_written ?? meta.rowsWritten ?? 0) || 0;
		summary.changes += Number(meta.changes ?? 0) || 0;
		summary.duration_ms += Number(meta.duration ?? meta.duration_ms ?? 0) || 0;
	}

	if (!hasMeta) return null;
	summary.duration_ms = roundMoney(summary.duration_ms);
	return JSON.stringify(summary);
}

function normalizePaymentMethod(value: unknown): 'tunai' | 'non-tunai' {
	if (value === 'qris' || value === 'non-tunai') return 'non-tunai';
	if (value === 'tunai') return 'tunai';
	throw kitError(400, 'Metode pembayaran tidak valid');
}

function sanitizeShortText(value: unknown, maxLength: number): string | null {
	const text = String(value ?? '').trim();
	if (!text) return null;
	return text.slice(0, maxLength);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
	return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function getWitaSalesDate(value: string): string {
	return new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'Asia/Makassar',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(value));
}

function chunks<T>(values: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let index = 0; index < values.length; index += size) {
		result.push(values.slice(index, index + size));
	}
	return result;
}

function assertActive(row: { is_active: number | boolean | null }, label: string) {
	if (row.is_active === false || row.is_active === 0) {
		throw kitError(409, `${label} tidak aktif`);
	}
}

async function getActiveSessionId(db: D1Database, branch: BranchId): Promise<string | null> {
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

async function getExistingByIdempotency(
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

async function getCheckoutCapabilities(
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

async function loadProducts(
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

async function loadRecipesByProduct(
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

async function loadAddOns(
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

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['kasir', 'pemilik']);
	const db = getDb(platform, branch);
	const {
		stockTrackingAvailable,
		ingredientTrackingAvailable,
		idempotencyAvailable,
		salesSummaryAvailable,
		transactionSnapshotAvailable
	} = await getCheckoutCapabilities(db, branch);

	const checkoutLimit = await consumeRateLimit(
		db,
		branch,
		`checkout:${session.userId}`,
		CHECKOUT_MAX_PER_WINDOW,
		CHECKOUT_WINDOW_MS,
		platform
	);
	if (!checkoutLimit.available) {
		throw kitError(503, 'Checkout sementara tidak tersedia. Coba lagi beberapa saat.');
	}
	if (!checkoutLimit.allowed) {
		throw kitError(
			429,
			`Terlalu banyak transaksi. Coba lagi ${checkoutLimit.retryAfterSeconds} detik lagi`
		);
	}

	const body = (await request.json().catch(() => null)) as PosTransactionInput | null;
	if (!body || !Array.isArray(body.items) || body.items.length === 0) {
		throw kitError(400, 'Item transaksi kosong');
	}

	const idempotencyKey = sanitizeShortText(body.idempotency_key, 120);
	if (!idempotencyKey || idempotencyKey.length < 8) {
		throw kitError(400, 'idempotency_key tidak valid');
	}

	const paymentMethod = normalizePaymentMethod(body.metode_bayar);
	const customerName = sanitizeShortText(body.nama_pelanggan, 60);

	const existing = await getExistingByIdempotency(db, branch, idempotencyKey, idempotencyAvailable);
	if (existing) {
		return json({
			ok: true,
			idempotent: true,
			data: {
				buku_kas_id: existing.id,
				transaction_id: existing.transaction_id,
				total_amount: existing.nominal,
				total_qty: existing.jumlah
			}
		});
	}

	const normalizedInputs: NormalizedItemInput[] = body.items.slice(0, 100).map((item) => {
		const jumlah = Number(item.jumlah);
		if (!Number.isInteger(jumlah) || jumlah <= 0 || jumlah > 99) {
			throw kitError(400, 'Qty item tidak valid');
		}

		return {
			source: item,
			productId: item.product_id ? String(item.product_id) : null,
			addOnIds: uniqueStrings((item.add_on_ids ?? []).map((id) => String(id))),
			jumlah
		};
	});
	const productIds = uniqueStrings(normalizedInputs.map((item) => item.productId));
	const addOnIds = uniqueStrings(normalizedInputs.flatMap((item) => item.addOnIds));

	// Fase baca paralel: sesi toko, produk, dan add-on saling independen —
	// jalankan barengan agar tidak menumpuk round-trip D1 secara serial.
	const [idSesiToko, productsById, addOnsById] = await Promise.all([
		getActiveSessionId(db, branch),
		loadProducts(db, branch, productIds, stockTrackingAvailable, ingredientTrackingAvailable),
		loadAddOns(db, branch, addOnIds)
	]);
	if (!idSesiToko && session.role === 'kasir') {
		throw kitError(409, 'Kasir tidak boleh transaksi saat toko tutup');
	}

	// Resep butuh hasil produk (flag lacak_bahan), jadi wave kedua.
	const recipeProductIds = ingredientTrackingAvailable
		? productIds.filter((productId) => {
				const product = productsById.get(productId);
				return product?.lacak_bahan === true || product?.lacak_bahan === 1;
			})
		: [];
	const recipesByProduct = await loadRecipesByProduct(db, branch, recipeProductIds);

	const transactionId = crypto.randomUUID();
	const bukuKasId = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const items: Array<{
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
	}> = [];
	const itemNames: string[] = [];
	const stockDeductions = new Map<string, { nama: string; jumlah: number }>();
	const ingredientDeductions = new Map<
		string,
		{ nama: string; satuan: string; jumlah: number; products: string[] }
	>();

	for (const input of normalizedInputs) {
		const { source: item, productId, jumlah } = input;
		const addOns = input.addOnIds.map((id) => addOnsById.get(id)!);
		const addOnTotal = addOns.reduce((sum, addOn) => sum + normalizeMoney(addOn.harga), 0);
		const addOnSnapshot = addOns.map((addOn) => ({
			id: String(addOn.id),
			nama: addOn.nama,
			harga: normalizeMoney(addOn.harga)
		}));
		const gula = sanitizeShortText(item.gula, 24);
		const es = sanitizeShortText(item.es, 24);
		const catatan = sanitizeShortText(item.catatan, 160);

		let productName: string;
		let productPrice: number;
		let hppSnapshot: string | null = null;
		let hppAmount = 0;

		if (productId) {
			const product = productsById.get(productId)!;
			productName = product.nama;
			productPrice = normalizeMoney(product.harga);
			if (stockTrackingAvailable && (product.lacak_stok === true || product.lacak_stok === 1)) {
				const current = stockDeductions.get(productId) || { nama: productName, jumlah: 0 };
				current.jumlah += jumlah;
				stockDeductions.set(productId, current);
			}
			if (
				ingredientTrackingAvailable &&
				(product.lacak_bahan === true || product.lacak_bahan === 1)
			) {
				const recipe = recipesByProduct.get(productId) || [];
				if (!recipe.length) {
					throw kitError(409, `Resep bahan belum diatur untuk ${productName}`);
				}
				const hppIngredients = recipe.map((ingredient) => ({
					bahan_id: ingredient.bahan_id,
					nama: ingredient.bahan_name,
					satuan: ingredient.satuan,
					jumlah_per_item: normalizeCost(ingredient.jumlah_per_item),
					biaya_per_satuan: normalizeCost(ingredient.biaya_per_satuan)
				}));
				const hppPerItem = hppIngredients.reduce(
					(sum, ingredient) => sum + ingredient.jumlah_per_item * ingredient.biaya_per_satuan,
					0
				);
				hppAmount = roundMoney(hppPerItem * jumlah);
				hppSnapshot = JSON.stringify({
					product_id: productId,
					product_name: productName,
					jumlah,
					hpp_per_item: roundMoney(hppPerItem),
					nominal_hpp: hppAmount,
					ingredients: hppIngredients
				}).slice(0, 4096);
				for (const ingredient of recipe) {
					const current = ingredientDeductions.get(ingredient.bahan_id) || {
						nama: ingredient.bahan_name,
						satuan: ingredient.satuan,
						jumlah: 0,
						products: []
					};
					current.jumlah += Number(ingredient.jumlah_per_item || 0) * jumlah;
					if (!current.products.includes(productName)) current.products.push(productName);
					ingredientDeductions.set(ingredient.bahan_id, current);
				}
			}
		} else {
			productName = sanitizeShortText(item.nama_kustom, 80) ?? 'Item Custom';
			productPrice = normalizeMoney(item.custom_price);
			if (productPrice <= 0) throw kitError(400, 'Harga custom item tidak valid');
		}

		const unitPrice = productPrice + addOnTotal;
		const amount = unitPrice * jumlah;
		itemNames.push(productName);
		items.push({
			id: crypto.randomUUID(),
			buku_kas_id: bukuKasId,
			produk_id: productId,
			nama_kustom: productId ? null : productName,
			jumlah,
			nominal: amount,
			harga: unitPrice,
			product_name: productName,
			harga_dasar: productPrice,
			total_tambahan: addOnTotal,
			snapshot_tambahan: addOnSnapshot.length ? JSON.stringify(addOnSnapshot).slice(0, 2048) : null,
			gula,
			es,
			catatan,
			snapshot_hpp: hppSnapshot,
			nominal_hpp: hppAmount,
			transaction_id: transactionId
		});
	}

	if (!items.length) {
		throw kitError(400, 'Item transaksi kosong');
	}

	const totalAmount = items.reduce((sum, item) => sum + item.nominal, 0);
	const totalQty = items.reduce((sum, item) => sum + item.jumlah, 0);
	const totalHpp = items.reduce((sum, item) => sum + (item.nominal_hpp || 0), 0);
	const cashReceived = normalizeMoney(body.cash_received);
	if (paymentMethod === 'tunai' && cashReceived > 0 && cashReceived < totalAmount) {
		throw kitError(400, 'Nominal tunai kurang dari total');
	}

	const deskripsi = `Penjualan ${itemNames.join(', ')}`.slice(0, 240);
	const salesDate = getWitaSalesDate(createdAt);
	const productSummaries = new Map<
		string,
		{ productName: string; jumlah: number; grossSales: number; transactionCount: number }
	>();
	for (const item of items) {
		// Item custom (produk_id NULL) dikelompokkan ke satu bucket sintetis agar
		// tetap punya baris di daily_product_sales -> muncul di laporan, bukan
		// cuma nyumbang ke total.
		const summaryKey = item.produk_id || CUSTOM_PRODUCT_BUCKET_ID;
		const current = productSummaries.get(summaryKey) || {
			productName: item.produk_id ? item.product_name : 'Item Custom',
			jumlah: 0,
			grossSales: 0,
			transactionCount: 0
		};
		current.jumlah += item.jumlah;
		current.grossSales += item.nominal;
		current.transactionCount = 1;
		productSummaries.set(summaryKey, current);
	}
	const statements = [
		...Array.from(stockDeductions.entries()).map(([productId, deduction]) =>
			db
				.prepare(
					`UPDATE produk
					 SET stok = COALESCE(stok, 0) - ?, updated_at = ?
					 WHERE cabang_id = ? AND id = ? AND lacak_stok = 1`
				)
				.bind(deduction.jumlah, createdAt, branch, productId)
		),
		...Array.from(ingredientDeductions.entries()).flatMap(([bahanId, deduction]) => [
			db
				.prepare(
					`UPDATE bahan
					 SET stok_saat_ini = COALESCE(stok_saat_ini, 0) - ?, updated_at = ?
					 WHERE cabang_id = ? AND id = ?`
				)
				.bind(deduction.jumlah, createdAt, branch, bahanId),
			db
				.prepare(
					`INSERT INTO bahan_mutasi (
						id, cabang_id, bahan_id, delta_jumlah, stok_setelah, sumber,
						referensi_id, catatan, dibuat_oleh, created_at
					)
					VALUES (
						?, ?, ?, ?,
						(SELECT stok_saat_ini FROM bahan WHERE cabang_id = ? AND id = ?),
						'pos_transaction', ?, ?, ?, ?
					)`
				)
				.bind(
					crypto.randomUUID(),
					branch,
					bahanId,
					-deduction.jumlah,
					branch,
					bahanId,
					transactionId,
					`Checkout ${deduction.products.join(', ')}`.slice(0, 160),
					session.username || session.userId,
					createdAt
				)
		]),
		db
			.prepare(
				`INSERT INTO buku_kas (
					id,
					cabang_id,
					waktu,
					sumber,
					tipe,
					jenis,
					nominal,
					jumlah,
					deskripsi,
					nama_pelanggan,
					metode_bayar,
					transaction_id,
					${idempotencyAvailable ? 'idempotency_key,' : ''}
					id_sesi_toko,
					created_at,
					updated_at
				) VALUES (?, ?, ?, 'pos', 'in', 'pendapatan_usaha', ?, ?, ?, ?, ?, ?,
					${idempotencyAvailable ? '?,' : ''} ?, ?, ?)`
			)
			.bind(
				bukuKasId,
				branch,
				createdAt,
				totalAmount,
				totalQty,
				deskripsi,
				customerName,
				paymentMethod,
				transactionId,
				...(idempotencyAvailable ? [idempotencyKey] : []),
				idSesiToko,
				createdAt,
				createdAt
			),
		...items.map((item) => {
			if (!transactionSnapshotAvailable) {
				return db
					.prepare(
						`INSERT INTO transaksi_kasir (
							id,
							cabang_id,
							buku_kas_id,
							produk_id,
							nama_kustom,
							jumlah,
							nominal,
							harga,
							transaction_id,
							created_at,
							updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						item.id,
						branch,
						item.buku_kas_id,
						item.produk_id,
						item.nama_kustom,
						item.jumlah,
						item.nominal,
						item.harga,
						item.transaction_id,
						createdAt,
						createdAt
					);
			}

			return db
				.prepare(
					`INSERT INTO transaksi_kasir (
						id,
						cabang_id,
						buku_kas_id,
						produk_id,
						nama_kustom,
						jumlah,
						nominal,
						harga,
						nama_produk,
						harga_dasar,
						total_tambahan,
						snapshot_tambahan,
						gula,
						es,
						catatan,
						snapshot_hpp,
						nominal_hpp,
						transaction_id,
						created_at,
						updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					item.id,
					branch,
					item.buku_kas_id,
					item.produk_id,
					item.nama_kustom,
					item.jumlah,
					item.nominal,
					item.harga,
					item.product_name,
					item.harga_dasar,
					item.total_tambahan,
					item.snapshot_tambahan,
					item.gula,
					item.es,
					item.catatan,
					item.snapshot_hpp,
					item.nominal_hpp,
					item.transaction_id,
					createdAt,
					createdAt
				);
		}),
		...(salesSummaryAvailable
			? [
					db
						.prepare(
							`INSERT INTO ringkasan_penjualan_harian (
								id, cabang_id, tanggal_penjualan, jumlah_transaksi, jumlah_item,
								penjualan_kotor, penjualan_tunai, penjualan_nontunai, total_hpp, created_at, updated_at
							)
							VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
							ON CONFLICT(cabang_id, tanggal_penjualan) DO UPDATE SET
								jumlah_transaksi = jumlah_transaksi + 1,
								jumlah_item = jumlah_item + excluded.jumlah_item,
								penjualan_kotor = penjualan_kotor + excluded.penjualan_kotor,
								penjualan_tunai = penjualan_tunai + excluded.penjualan_tunai,
								penjualan_nontunai = penjualan_nontunai + excluded.penjualan_nontunai,
									total_hpp = total_hpp + excluded.total_hpp,
								updated_at = excluded.updated_at`
						)
						.bind(
							`${branch}:${salesDate}`,
							branch,
							salesDate,
							totalQty,
							totalAmount,
							paymentMethod === 'tunai' ? totalAmount : 0,
							paymentMethod === 'non-tunai' ? totalAmount : 0,
							totalHpp,
							createdAt,
							createdAt
						),
					...Array.from(productSummaries.entries()).map(([productId, summary]) =>
						db
							.prepare(
								`INSERT INTO penjualan_produk_harian (
									id, cabang_id, tanggal_penjualan, produk_id, nama_produk, jumlah,
									penjualan_kotor, penjualan_tunai, penjualan_nontunai, jumlah_transaksi, created_at, updated_at
								)
								VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
								ON CONFLICT(cabang_id, tanggal_penjualan, produk_id) DO UPDATE SET
									nama_produk = excluded.nama_produk,
									jumlah = jumlah + excluded.jumlah,
									penjualan_kotor = penjualan_kotor + excluded.penjualan_kotor,
									penjualan_tunai = penjualan_tunai + excluded.penjualan_tunai,
									penjualan_nontunai = penjualan_nontunai + excluded.penjualan_nontunai,
									jumlah_transaksi = jumlah_transaksi + excluded.jumlah_transaksi,
									updated_at = excluded.updated_at`
							)
							.bind(
								`${branch}:${salesDate}:${productId}`,
								branch,
								salesDate,
								productId,
								summary.productName,
								summary.jumlah,
								summary.grossSales,
								paymentMethod === 'tunai' ? summary.grossSales : 0,
								paymentMethod === 'tunai' ? 0 : summary.grossSales,
								summary.transactionCount,
								createdAt,
								createdAt
							)
					)
				]
			: [])
	];

	let d1Meta: string | null = null;
	try {
		d1Meta = summarizeD1Meta(await db.batch(statements));
	} catch (error) {
		const duplicate = await getExistingByIdempotency(
			db,
			branch,
			idempotencyKey,
			idempotencyAvailable
		);
		if (duplicate) {
			return json({
				ok: true,
				idempotent: true,
				data: {
					buku_kas_id: duplicate.id,
					transaction_id: duplicate.transaction_id,
					total_amount: duplicate.nominal,
					total_qty: duplicate.jumlah
				}
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('INSUFFICIENT_STOCK')) {
			await recordErrorEvent(platform, branch, {
				source: 'POST /api/pos/transaction',
				error,
				status: 409,
				session,
				context: { idempotencyKey, stockDeductions: Object.fromEntries(stockDeductions) }
			});
			throw kitError(409, 'Stok tidak cukup untuk salah satu item');
		}
		if (message.includes('INSUFFICIENT_INGREDIENT')) {
			await recordErrorEvent(platform, branch, {
				source: 'POST /api/pos/transaction',
				error,
				status: 409,
				session,
				context: { idempotencyKey, ingredientDeductions: Object.fromEntries(ingredientDeductions) }
			});
			throw kitError(409, 'Stok bahan tidak cukup untuk salah satu menu');
		}

		await recordErrorEvent(platform, branch, {
			source: 'POST /api/pos/transaction',
			error,
			status: 500,
			session,
			context: { idempotencyKey, totalAmount, totalQty }
		});
		throw error;
	}

	// Audit log + publish realtime dijalankan paralel sesudah batch commit.
	// appendAuditLog menelan error sendiri, jadi audit tetap tidak memblok UX.
	await Promise.all([
		appendAuditLog(db, branch, {
			action: 'pos_transaction.created',
			entityType: 'buku_kas',
			entityId: bukuKasId,
			transactionId,
			amount: totalAmount,
			session,
			metadata: {
				customerName,
				paymentMethod,
				totalQty,
				itemCount: items.length,
				stockDeductions: Object.fromEntries(stockDeductions),
				ingredientDeductions: Object.fromEntries(ingredientDeductions)
			}
		}),
		publishBranchEvent(
			platform?.env as Record<string, unknown> | undefined,
			branch,
			'buku_kas',
			'insert',
			{
				id: bukuKasId,
				transaction_id: transactionId
			}
		),
		publishBranchEvent(
			platform?.env as Record<string, unknown> | undefined,
			branch,
			'transaksi_kasir',
			'insert',
			{ transaction_id: transactionId }
		),
		...Array.from(ingredientDeductions.keys()).map((bahanId) =>
			publishBranchEvent(
				platform?.env as Record<string, unknown> | undefined,
				branch,
				'bahan',
				'update',
				{ id: bahanId }
			)
		)
	]);

	return json(
		{
			ok: true,
			idempotent: false,
			data: {
				buku_kas_id: bukuKasId,
				transaction_id: transactionId,
				total_amount: totalAmount,
				total_qty: totalQty,
				change: paymentMethod === 'tunai' && cashReceived > 0 ? cashReceived - totalAmount : 0
			}
		},
		{
			headers: d1Meta ? { 'x-d1-meta': d1Meta } : undefined
		}
	);
};
