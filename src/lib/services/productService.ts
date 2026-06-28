import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import type { Product, Category, AddOn } from '$lib/types/product';
import { smartCache, CACHE_KEYS } from '$lib/utils/cache';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { dbGet, dbGetStrict } from '$lib/services/dataApiClient';

export class ProductService {
	private static instance: ProductService;

	static getInstance(): ProductService {
		if (!ProductService.instance) ProductService.instance = new ProductService();
		return ProductService.instance;
	}

	private async getCachedTable(table: string, cacheKey: string, offlineKeyPrefix: string) {
		const branch = selectedBranch.value || 'default';
		const offlineKey = `${offlineKeyPrefix}_${branch}`;
		const offlineData = ((await idbGet(offlineKey)) as Record<string, any>[] | undefined) || [];
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			return offlineData;
		}
		try {
			const data = await smartCache.get(`${cacheKey}_${branch}`, async () => dbGetStrict(table), {
				ttl: 180000,
				backgroundRefresh: true
			});
			await idbSet(offlineKey, data || []);
			return data || [];
		} catch {
			return offlineData;
		}
	}

	async getProducts(): Promise<Product[]> {
		return this.getCachedTable('produk', CACHE_KEYS.PRODUCTS, 'products') as unknown as Product[];
	}

	async getCategories(): Promise<Category[]> {
		return this.getCachedTable('kategori', CACHE_KEYS.CATEGORIES, 'categories') as unknown as Category[];
	}

	async getAddOns(): Promise<AddOn[]> {
		return this.getCachedTable('tambahan', CACHE_KEYS.ADDONS, 'addons') as unknown as AddOn[];
	}

	async getIngredients() {
		const branch = selectedBranch.value || 'default';
		return smartCache.get(`ingredients_${branch}`, async () => dbGet('bahan'), {
			ttl: 180000,
			backgroundRefresh: true
		});
	}

	async getProductRecipes(productId?: string | number) {
		const params: Record<string, string> = productId ? { produk_id: String(productId) } : {};
		return dbGet('resep_produk', params);
	}

	async getHppSettings() {
		const branch = selectedBranch.value || 'default';
		const rows = await smartCache.get(`hpp_settings_${branch}`, async () => dbGet('hpp_settings'), {
			ttl: 180000,
			backgroundRefresh: true
		});
		return rows?.[0] || null;
	}
}

export const productService = ProductService.getInstance();
