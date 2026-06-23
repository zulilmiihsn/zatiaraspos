import { json, error as kitError } from '@sveltejs/kit';
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
	custom_name?: string | null;
	custom_price?: number | string | null;
	qty: number;
	add_on_ids?: Array<string | number>;
	sugar?: string | null;
	ice?: string | null;
	note?: string | null;
}

interface PosTransactionInput {
	idempotency_key?: string;
	customer_name?: string | null;
	payment_method?: string;
	cash_received?: number | string | null;
	items?: PosTransactionItemInput[];
}

interface ProductRow {
	id: string;
	name: string;
	price: number;
	stok: number | null;
	track_stock?: number | boolean | null;
	track_ingredients?: number | boolean | null;
	is_active: number | boolean | null;
}

interface RecipeRow {
	product_id: string;
	bahan_id: string;
	bahan_name: string;
	unit: string;
	qty_per_item: number;
	cost_per_unit: number;
}

interface AddOnRow {
	id: string;
	name: string;
	price: number;
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
	qty: number;
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

async function getActiveSessionId(db: any, branch: BranchId): Promise<string | null> {
	const row = (await db
		.prepare(
			`SELECT id
			 FROM sesi_toko
			 WHERE branch_id = ? AND is_active = 1
			 ORDER BY opening_time DESC
			 LIMIT 1`
		)
		.bind(branch)
		.first()) as { id: string } | null;
	return row?.id ?? null;
}

async function getExistingByIdempotency(
	db: any,
	branch: BranchId,
	idempotencyKey: string,
	idempotencyAvailable = true
) {
	if (!idempotencyAvailable) return null;

	return (await db
		.prepare(
			`SELECT id, transaction_id, amount, qty
			 FROM buku_kas
			 WHERE branch_id = ? AND idempotency_key = ?
			 LIMIT 1`
		)
		.bind(branch, idempotencyKey)
		.first()) as { id: string; transaction_id: string; amount: number; qty: number } | null;
}

async function hasColumn(db: any, table: string, column: string): Promise<boolean> {
	try {
		const { results = [] } = (await db.prepare(`PRAGMA table_info(${table})`).all()) as {
			results?: Array<{ name?: string }>;
		};
		return results.some((row) => row.name === column);
	} catch {
		return false;
	}
}

async function hasTable(db: any, table: string): Promise<boolean> {
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

async function getCheckoutCapabilities(db: any, branch: BranchId): Promise<CheckoutCapabilities> {
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
				hasColumn(db, 'produk', 'track_stock'),
				hasColumn(db, 'produk', 'track_ingredients'),
				hasTable(db, 'bahan'),
				hasTable(db, 'resep_produk'),
				hasTable(db, 'bahan_mutasi'),
				hasColumn(db, 'buku_kas', 'idempotency_key'),
				hasTable(db, 'daily_sales_summary'),
				hasTable(db, 'daily_product_sales'),
				hasColumn(db, 'transaksi_kasir', 'product_name'),
				hasColumn(db, 'transaksi_kasir', 'hpp_amount')
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
	db: any,
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
				`SELECT id, name, price, stok,
				 ${stockTrackingAvailable ? 'track_stock,' : ''}
				 ${ingredientTrackingAvailable ? 'track_ingredients,' : ''}
				 is_active
				 FROM produk
				 WHERE branch_id = ? AND id IN (${placeholders})`
			)
			.bind(branch, ...part)
			.all()) as { results?: ProductRow[] };
		rows.push(...results);
	}

	const products = new Map(rows.map((product) => [String(product.id), product]));
	for (const productId of productIds) {
		const product = products.get(productId);
		if (!product) throw kitError(404, `Produk tidak ditemukan: ${productId}`);
		assertActive(product, product.name);
	}
	return products;
}

async function loadRecipesByProduct(
	db: any,
	branch: BranchId,
	productIds: string[]
): Promise<Map<string, RecipeRow[]>> {
	const grouped = new Map<string, RecipeRow[]>();
	for (const part of chunks(productIds, IN_QUERY_CHUNK_SIZE)) {
		if (!part.length) continue;
		const placeholders = part.map(() => '?').join(',');
		const { results = [] } = (await db
			.prepare(
				`SELECT rp.product_id, rp.bahan_id, b.name AS bahan_name, b.unit, rp.qty_per_item
					, COALESCE(b.cost_per_unit, 0) AS cost_per_unit
				 FROM resep_produk rp
				 INNER JOIN bahan b ON b.branch_id = rp.branch_id AND b.id = rp.bahan_id
				 WHERE rp.branch_id = ? AND rp.product_id IN (${placeholders}) AND b.is_active = 1
				 ORDER BY rp.product_id ASC, b.name ASC`
			)
			.bind(branch, ...part)
			.all()) as { results?: RecipeRow[] };

		for (const row of results) {
			const rows = grouped.get(row.product_id) || [];
			rows.push(row);
			grouped.set(row.product_id, rows);
		}
	}
	return grouped;
}

async function loadAddOns(
	db: any,
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
				`SELECT id, name, price, is_active
				 FROM tambahan
				 WHERE branch_id = ? AND id IN (${placeholders})`
			)
			.bind(branch, ...part)
			.all()) as { results?: AddOnRow[] };
		rows.push(...results);
	}

	const addOns = new Map(rows.map((addOn) => [String(addOn.id), addOn]));
	for (const id of ids) {
		const addOn = addOns.get(id);
		if (!addOn) throw kitError(404, 'Tambahan tidak ditemukan');
		assertActive(addOn, addOn.name);
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

	const paymentMethod = normalizePaymentMethod(body.payment_method);
	const customerName = sanitizeShortText(body.customer_name, 60);

	const existing = await getExistingByIdempotency(db, branch, idempotencyKey, idempotencyAvailable);
	if (existing) {
		return json({
			ok: true,
			idempotent: true,
			data: {
				buku_kas_id: existing.id,
				transaction_id: existing.transaction_id,
				total_amount: existing.amount,
				total_qty: existing.qty
			}
		});
	}

	const normalizedInputs: NormalizedItemInput[] = body.items.slice(0, 100).map((item) => {
		const qty = Number(item.qty);
		if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
			throw kitError(400, 'Qty item tidak valid');
		}

		return {
			source: item,
			productId: item.product_id ? String(item.product_id) : null,
			addOnIds: uniqueStrings((item.add_on_ids ?? []).map((id) => String(id))),
			qty
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

	// Resep butuh hasil produk (flag track_ingredients), jadi wave kedua.
	const recipeProductIds = ingredientTrackingAvailable
		? productIds.filter((productId) => {
				const product = productsById.get(productId);
				return product?.track_ingredients === true || product?.track_ingredients === 1;
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
		custom_name: string | null;
		qty: number;
		amount: number;
		price: number;
		product_name: string;
		base_price: number;
		add_on_total: number;
		add_on_snapshot: string | null;
		sugar: string | null;
		ice: string | null;
		note: string | null;
		hpp_snapshot: string | null;
		hpp_amount: number;
		transaction_id: string;
	}> = [];
	const itemNames: string[] = [];
	const stockDeductions = new Map<string, { name: string; qty: number }>();
	const ingredientDeductions = new Map<
		string,
		{ name: string; unit: string; qty: number; products: string[] }
	>();

	for (const input of normalizedInputs) {
		const { source: item, productId, qty } = input;
		const addOns = input.addOnIds.map((id) => addOnsById.get(id)!);
		const addOnTotal = addOns.reduce((sum, addOn) => sum + normalizeMoney(addOn.price), 0);
		const addOnSnapshot = addOns.map((addOn) => ({
			id: String(addOn.id),
			name: addOn.name,
			price: normalizeMoney(addOn.price)
		}));
		const sugar = sanitizeShortText(item.sugar, 24);
		const ice = sanitizeShortText(item.ice, 24);
		const note = sanitizeShortText(item.note, 160);

		let productName: string;
		let productPrice: number;
		let hppSnapshot: string | null = null;
		let hppAmount = 0;

		if (productId) {
			const product = productsById.get(productId)!;
			productName = product.name;
			productPrice = normalizeMoney(product.price);
			if (stockTrackingAvailable && (product.track_stock === true || product.track_stock === 1)) {
				const current = stockDeductions.get(productId) || { name: productName, qty: 0 };
				current.qty += qty;
				stockDeductions.set(productId, current);
			}
			if (
				ingredientTrackingAvailable &&
				(product.track_ingredients === true || product.track_ingredients === 1)
			) {
				const recipe = recipesByProduct.get(productId) || [];
				if (!recipe.length) {
					throw kitError(409, `Resep bahan belum diatur untuk ${productName}`);
				}
				const hppIngredients = recipe.map((ingredient) => ({
					bahan_id: ingredient.bahan_id,
					name: ingredient.bahan_name,
					unit: ingredient.unit,
					qty_per_item: normalizeCost(ingredient.qty_per_item),
					cost_per_unit: normalizeCost(ingredient.cost_per_unit)
				}));
				const hppPerItem = hppIngredients.reduce(
					(sum, ingredient) => sum + ingredient.qty_per_item * ingredient.cost_per_unit,
					0
				);
				hppAmount = roundMoney(hppPerItem * qty);
				hppSnapshot = JSON.stringify({
					product_id: productId,
					product_name: productName,
					qty,
					hpp_per_item: roundMoney(hppPerItem),
					hpp_amount: hppAmount,
					ingredients: hppIngredients
				}).slice(0, 4096);
				for (const ingredient of recipe) {
					const current = ingredientDeductions.get(ingredient.bahan_id) || {
						name: ingredient.bahan_name,
						unit: ingredient.unit,
						qty: 0,
						products: []
					};
					current.qty += Number(ingredient.qty_per_item || 0) * qty;
					if (!current.products.includes(productName)) current.products.push(productName);
					ingredientDeductions.set(ingredient.bahan_id, current);
				}
			}
		} else {
			productName = sanitizeShortText(item.custom_name, 80) ?? 'Item Custom';
			productPrice = normalizeMoney(item.custom_price);
			if (productPrice <= 0) throw kitError(400, 'Harga custom item tidak valid');
		}

		const unitPrice = productPrice + addOnTotal;
		const amount = unitPrice * qty;
		itemNames.push(productName);
		items.push({
			id: crypto.randomUUID(),
			buku_kas_id: bukuKasId,
			produk_id: productId,
			custom_name: productId ? null : productName,
			qty,
			amount,
			price: unitPrice,
			product_name: productName,
			base_price: productPrice,
			add_on_total: addOnTotal,
			add_on_snapshot: addOnSnapshot.length ? JSON.stringify(addOnSnapshot).slice(0, 2048) : null,
			sugar,
			ice,
			note,
			hpp_snapshot: hppSnapshot,
			hpp_amount: hppAmount,
			transaction_id: transactionId
		});
	}

	if (!items.length) {
		throw kitError(400, 'Item transaksi kosong');
	}

	const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
	const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
	const totalHpp = items.reduce((sum, item) => sum + (item.hpp_amount || 0), 0);
	const cashReceived = normalizeMoney(body.cash_received);
	if (paymentMethod === 'tunai' && cashReceived > 0 && cashReceived < totalAmount) {
		throw kitError(400, 'Nominal tunai kurang dari total');
	}

	const description = `Penjualan ${itemNames.join(', ')}`.slice(0, 240);
	const salesDate = getWitaSalesDate(createdAt);
	const productSummaries = new Map<
		string,
		{ productName: string; qty: number; grossSales: number; transactionCount: number }
	>();
	for (const item of items) {
		// Item custom (produk_id NULL) dikelompokkan ke satu bucket sintetis agar
		// tetap punya baris di daily_product_sales -> muncul di laporan, bukan
		// cuma nyumbang ke total.
		const summaryKey = item.produk_id || CUSTOM_PRODUCT_BUCKET_ID;
		const current = productSummaries.get(summaryKey) || {
			productName: item.produk_id ? item.product_name : 'Item Custom',
			qty: 0,
			grossSales: 0,
			transactionCount: 0
		};
		current.qty += item.qty;
		current.grossSales += item.amount;
		current.transactionCount = 1;
		productSummaries.set(summaryKey, current);
	}
	const statements = [
		...Array.from(stockDeductions.entries()).map(([productId, deduction]) =>
			db
				.prepare(
					`UPDATE produk
					 SET stok = COALESCE(stok, 0) - ?, updated_at = ?
					 WHERE branch_id = ? AND id = ? AND track_stock = 1`
				)
				.bind(deduction.qty, createdAt, branch, productId)
		),
		...Array.from(ingredientDeductions.entries()).flatMap(([bahanId, deduction]) => [
			db
				.prepare(
					`UPDATE bahan
					 SET current_stock = COALESCE(current_stock, 0) - ?, updated_at = ?
					 WHERE branch_id = ? AND id = ?`
				)
				.bind(deduction.qty, createdAt, branch, bahanId),
			db
				.prepare(
					`INSERT INTO bahan_mutasi (
						id, branch_id, bahan_id, quantity_delta, stock_after, source,
						reference_id, note, created_by, created_at
					)
					VALUES (
						?, ?, ?, ?,
						(SELECT current_stock FROM bahan WHERE branch_id = ? AND id = ?),
						'pos_transaction', ?, ?, ?, ?
					)`
				)
				.bind(
					crypto.randomUUID(),
					branch,
					bahanId,
					-deduction.qty,
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
					branch_id,
					waktu,
					sumber,
					tipe,
					jenis,
					amount,
					qty,
					description,
					customer_name,
					payment_method,
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
				description,
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
							branch_id,
							buku_kas_id,
							produk_id,
							custom_name,
							qty,
							amount,
							price,
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
						item.custom_name,
						item.qty,
						item.amount,
						item.price,
						item.transaction_id,
						createdAt,
						createdAt
					);
			}

			return db
				.prepare(
					`INSERT INTO transaksi_kasir (
						id,
						branch_id,
						buku_kas_id,
						produk_id,
						custom_name,
						qty,
						amount,
						price,
						product_name,
						base_price,
						add_on_total,
						add_on_snapshot,
						sugar,
						ice,
						note,
						hpp_snapshot,
						hpp_amount,
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
					item.custom_name,
					item.qty,
					item.amount,
					item.price,
					item.product_name,
					item.base_price,
					item.add_on_total,
					item.add_on_snapshot,
					item.sugar,
					item.ice,
					item.note,
					item.hpp_snapshot,
					item.hpp_amount,
					item.transaction_id,
					createdAt,
					createdAt
				);
		}),
		...(salesSummaryAvailable
			? [
					db
						.prepare(
							`INSERT INTO daily_sales_summary (
								id, branch_id, sales_date, transaction_count, item_count,
								gross_sales, cash_sales, non_cash_sales, hpp_total, created_at, updated_at
							)
							VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
							ON CONFLICT(branch_id, sales_date) DO UPDATE SET
								transaction_count = transaction_count + 1,
								item_count = item_count + excluded.item_count,
								gross_sales = gross_sales + excluded.gross_sales,
								cash_sales = cash_sales + excluded.cash_sales,
								non_cash_sales = non_cash_sales + excluded.non_cash_sales,
									hpp_total = hpp_total + excluded.hpp_total,
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
								`INSERT INTO daily_product_sales (
									id, branch_id, sales_date, product_id, product_name, qty,
									gross_sales, cash_sales, non_cash_sales, transaction_count, created_at, updated_at
								)
								VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
								ON CONFLICT(branch_id, sales_date, product_id) DO UPDATE SET
									product_name = excluded.product_name,
									qty = qty + excluded.qty,
									gross_sales = gross_sales + excluded.gross_sales,
									cash_sales = cash_sales + excluded.cash_sales,
									non_cash_sales = non_cash_sales + excluded.non_cash_sales,
									transaction_count = transaction_count + excluded.transaction_count,
									updated_at = excluded.updated_at`
							)
							.bind(
								`${branch}:${salesDate}:${productId}`,
								branch,
								salesDate,
								productId,
								summary.productName,
								summary.qty,
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
					total_amount: duplicate.amount,
					total_qty: duplicate.qty
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
