import { json, error as kitError } from '@sveltejs/kit';
import { getD1Database } from '$lib/server/branchResolver';
import { requireAnyRole, requireSessionBranch } from '$lib/server/apiAuth';
import { publishBranchEvent } from '$lib/server/realtimePublisher';
import { appendAuditLog } from '$lib/server/auditLog';
import { consumeRateLimit } from '$lib/server/rateLimit';
import { recordErrorEvent } from '$lib/server/observability';
import type { RequestHandler } from './$types';
import type { PosTransactionInput } from '$lib/server/checkout/types';
import {
	normalizePaymentMethod,
	sanitizeShortText,
	uniqueStrings,
	getWitaSalesDate,
	normalizeMoney,
	summarizeD1Meta,
	CHECKOUT_WINDOW_MS,
	CHECKOUT_MAX_PER_WINDOW
} from '$lib/server/checkout/utils';
import {
	getCheckoutCapabilities,
	getActiveSessionId,
	getExistingByIdempotency,
	loadProducts,
	loadRecipesByProduct,
	loadAddOns
} from '$lib/server/checkout/dataLoader';
import { computeItemFinancials } from '$lib/server/checkout/financials';
import { buildCheckoutStatements } from '$lib/server/checkout/statementBuilder';
import type { StockDeductions, IngredientDeductions } from '$lib/server/checkout/types';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['kasir', 'pemilik']);
	const db = getD1Database(platform?.env as Record<string, unknown> | undefined, branch);

	const capabilities = await getCheckoutCapabilities(db, branch);
	const { stockTrackingAvailable, ingredientTrackingAvailable, idempotencyAvailable } = capabilities;

	const checkoutLimit = await consumeRateLimit(
		db, branch, `checkout:${session.userId}`,
		CHECKOUT_MAX_PER_WINDOW, CHECKOUT_WINDOW_MS, platform
	);
	if (!checkoutLimit.available) throw kitError(503, 'Checkout sementara tidak tersedia. Coba lagi beberapa saat.');
	if (!checkoutLimit.allowed) throw kitError(429, `Terlalu banyak transaksi. Coba lagi ${checkoutLimit.retryAfterSeconds} detik lagi`);

	const body = (await request.json().catch(() => null)) as PosTransactionInput | null;
	if (!body || !Array.isArray(body.items) || body.items.length === 0) throw kitError(400, 'Item transaksi kosong');

	const idempotencyKey = sanitizeShortText(body.idempotency_key, 120);
	if (!idempotencyKey || idempotencyKey.length < 8) throw kitError(400, 'idempotency_key tidak valid');

	const paymentMethod = normalizePaymentMethod(body.metode_bayar);
	const customerName = sanitizeShortText(body.nama_pelanggan, 60);

	const existing = await getExistingByIdempotency(db, branch, idempotencyKey, idempotencyAvailable);
	if (existing) {
		return json({ ok: true, idempotent: true, data: { buku_kas_id: existing.id, transaction_id: existing.transaction_id, total_amount: existing.nominal, total_qty: existing.jumlah } });
	}

	const normalizedInputs = body.items.slice(0, 100).map((item) => {
		const jumlah = Number(item.jumlah);
		if (!Number.isInteger(jumlah) || jumlah <= 0 || jumlah > 99) throw kitError(400, 'Qty item tidak valid');
		return {
			source: item,
			productId: item.product_id ? String(item.product_id) : null,
			addOnIds: uniqueStrings((item.add_on_ids ?? []).map((id) => String(id))),
			jumlah
		};
	});

	const productIds = uniqueStrings(normalizedInputs.map((item) => item.productId));
	const addOnIds = uniqueStrings(normalizedInputs.flatMap((item) => item.addOnIds));

	// Fase baca paralel: sesi toko, produk, dan add-on saling independen.
	const [idSesiToko, productsById, addOnsById] = await Promise.all([
		getActiveSessionId(db, branch),
		loadProducts(db, branch, productIds, stockTrackingAvailable, ingredientTrackingAvailable),
		loadAddOns(db, branch, addOnIds)
	]);
	if (!idSesiToko && session.role === 'kasir') throw kitError(409, 'Kasir tidak boleh transaksi saat toko tutup');

	// Resep butuh hasil produk (flag lacak_bahan), jadi wave kedua.
	const recipeProductIds = ingredientTrackingAvailable
		? productIds.filter((id) => { const p = productsById.get(id); return p?.lacak_bahan === true || p?.lacak_bahan === 1; })
		: [];
	const recipesByProduct = await loadRecipesByProduct(db, branch, recipeProductIds);

	const transactionId = crypto.randomUUID();
	const bukuKasId = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const stockDeductions: StockDeductions = new Map();
	const ingredientDeductions: IngredientDeductions = new Map();

	const items = normalizedInputs.map((input) =>
		computeItemFinancials({ input, addOnsById, productsById, recipesByProduct, stockTrackingAvailable, ingredientTrackingAvailable, stockDeductions, ingredientDeductions, bukuKasId, transactionId })
	);
	if (!items.length) throw kitError(400, 'Item transaksi kosong');

	const totalAmount = items.reduce((sum, item) => sum + item.nominal, 0);
	const totalQty = items.reduce((sum, item) => sum + item.jumlah, 0);
	const totalHpp = items.reduce((sum, item) => sum + (item.nominal_hpp || 0), 0);
	const cashReceived = normalizeMoney(body.cash_received);
	if (paymentMethod === 'tunai' && cashReceived > 0 && cashReceived < totalAmount) throw kitError(400, 'Nominal tunai kurang dari total');

	const statements = buildCheckoutStatements({
		db, branch, items, stockDeductions, ingredientDeductions,
		totalAmount, totalQty, totalHpp, paymentMethod, customerName,
		salesDate: getWitaSalesDate(createdAt), bukuKasId, transactionId,
		createdAt, idSesiToko, idempotencyKey, session, capabilities
	});

	let d1Meta: string | null = null;
	try {
		d1Meta = summarizeD1Meta(await db.batch(statements));
	} catch (error) {
		const duplicate = await getExistingByIdempotency(db, branch, idempotencyKey, idempotencyAvailable);
		if (duplicate) {
			return json({ ok: true, idempotent: true, data: { buku_kas_id: duplicate.id, transaction_id: duplicate.transaction_id, total_amount: duplicate.nominal, total_qty: duplicate.jumlah } });
		}
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('INSUFFICIENT_STOCK')) {
			await recordErrorEvent(platform, branch, { source: 'POST /api/pos/transaction', error, status: 409, session, context: { idempotencyKey, stockDeductions: Object.fromEntries(stockDeductions) } });
			throw kitError(409, 'Stok tidak cukup untuk salah satu item');
		}
		if (message.includes('INSUFFICIENT_INGREDIENT')) {
			await recordErrorEvent(platform, branch, { source: 'POST /api/pos/transaction', error, status: 409, session, context: { idempotencyKey, ingredientDeductions: Object.fromEntries(ingredientDeductions) } });
			throw kitError(409, 'Stok bahan tidak cukup untuk salah satu menu');
		}
		await recordErrorEvent(platform, branch, { source: 'POST /api/pos/transaction', error, status: 500, session, context: { idempotencyKey, totalAmount, totalQty } });
		throw error;
	}

	// Audit + realtime publish paralel sesudah batch commit.
	await Promise.all([
		appendAuditLog(db, branch, {
			action: 'pos_transaction.created', entityType: 'buku_kas', entityId: bukuKasId,
			transactionId, amount: totalAmount, session,
			metadata: { customerName, paymentMethod, totalQty, itemCount: items.length, stockDeductions: Object.fromEntries(stockDeductions), ingredientDeductions: Object.fromEntries(ingredientDeductions) }
		}),
		publishBranchEvent(platform?.env as Record<string, unknown> | undefined, branch, 'buku_kas', 'insert', { id: bukuKasId, transaction_id: transactionId }),
		publishBranchEvent(platform?.env as Record<string, unknown> | undefined, branch, 'transaksi_kasir', 'insert', { transaction_id: transactionId }),
		...Array.from(ingredientDeductions.keys()).map((bahanId) =>
			publishBranchEvent(platform?.env as Record<string, unknown> | undefined, branch, 'bahan', 'update', { id: bahanId })
		)
	]);

	return json(
		{ ok: true, idempotent: false, data: { buku_kas_id: bukuKasId, transaction_id: transactionId, total_amount: totalAmount, total_qty: totalQty, change: paymentMethod === 'tunai' && cashReceived > 0 ? cashReceived - totalAmount : 0 } },
		{ headers: d1Meta ? { 'x-d1-meta': d1Meta } : undefined }
	);
};
