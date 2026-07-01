import { error as kitError } from '@sveltejs/kit';
import type {
	NormalizedItemInput,
	ComputedTransactionItem,
	AddOnRow,
	ProductRow,
	RecipeRow,
	StockDeductions,
	IngredientDeductions
} from '$lib/server/checkout/types';
import { normalizeMoney, normalizeCost, roundMoney, sanitizeShortText } from '$lib/server/checkout/utils';

interface ComputeItemParams {
	input: NormalizedItemInput;
	addOnsById: Map<string, AddOnRow>;
	productsById: Map<string, ProductRow>;
	recipesByProduct: Map<string, RecipeRow[]>;
	stockTrackingAvailable: boolean;
	ingredientTrackingAvailable: boolean;
	stockDeductions: StockDeductions;
	ingredientDeductions: IngredientDeductions;
	bukuKasId: string;
	transactionId: string;
}

export function computeItemFinancials(params: ComputeItemParams): ComputedTransactionItem {
	const {
		input,
		addOnsById,
		productsById,
		recipesByProduct,
		stockTrackingAvailable,
		ingredientTrackingAvailable,
		stockDeductions,
		ingredientDeductions,
		bukuKasId,
		transactionId
	} = params;

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
	return {
		id: crypto.randomUUID(),
		buku_kas_id: bukuKasId,
		produk_id: productId,
		nama_kustom: productId ? null : productName,
		jumlah,
		nominal: unitPrice * jumlah,
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
	};
}
