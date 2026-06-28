import { dataService } from '$lib/services/dataService';
import type {
	AddOn,
	Category,
	HppSettings,
	Ingredient,
	Product,
	ProductRecipe
} from '$lib/types/product';

export interface HppParsedItem {
	nama: string;
	satuan: string;
	purchase_qty: number;
	purchase_cost: number;
	biaya_per_satuan: number;
}

export function createMenuCrud() {
	return {
		load: () => dataService.getProducts(),
		loadRecipes: async (productId?: string | number): Promise<ProductRecipe[]> =>
			(await dataService.getProductRecipes(productId)) as unknown as ProductRecipe[],
		save: (payload: Record<string, unknown>, id?: string | number | null) =>
			id
				? dataService.updateRows('produk', payload, { id: String(id) })
				: dataService.insertRows('produk', payload),
		async saveRecipes(
			productId: string | number,
			items: Array<{ bahan_id: string | number; jumlah_per_item: string }>,
			enabled: boolean
		) {
			await dataService.deleteRows('resep_produk', { produk_id: String(productId) });
			if (!enabled || items.length === 0) return;
			await dataService.insertRows(
				'resep_produk',
				items.map((item) => ({
					produk_id: String(productId),
					bahan_id: String(item.bahan_id),
					jumlah_per_item: Number(item.jumlah_per_item || 0)
				}))
			);
		},
		remove: (id: string | number) => dataService.deleteRows('produk', { id: String(id) }),
		updateCategory: (id: string | number, kategoriId: string | number | null) =>
			dataService.updateRows('produk', { kategori_id: kategoriId }, { id: String(id) })
	};
}

export function createKategoriCrud() {
	return {
		load: () => dataService.getCategories(),
		save: (name: string, id?: string | number | null) =>
			id
				? dataService.updateRows('kategori', { nama: name }, { id: String(id) })
				: dataService.insertRows('kategori', { nama: name }),
		clearProducts: (id: string | number) =>
			dataService.updateRows('produk', { kategori_id: null }, { kategori_id: String(id) }),
		remove: (id: string | number) => dataService.deleteRows('kategori', { id: String(id) })
	};
}

export function createEkstraCrud() {
	return {
		load: async (): Promise<Array<AddOn & { harga: number }>> =>
			(await dataService.getAddOns()).map((item) => ({ ...item, harga: item.harga })),
		save: (payload: { nama: string; harga: number }, id?: string | number | null) =>
			id
				? dataService.updateRows('tambahan', payload, { id: String(id) })
				: dataService.insertRows('tambahan', payload),
		remove: (id: string | number) => dataService.deleteRows('tambahan', { id: String(id) })
	};
}

export function createBahanCrud() {
	return {
		load: async (): Promise<Ingredient[]> =>
			(await dataService.getIngredients()) as unknown as Ingredient[],
		save: (payload: Record<string, unknown>, id?: string | number | null) =>
			id
				? dataService.updateRows('bahan', payload, { id: String(id) })
				: dataService.insertRows('bahan', payload),
		mutate: (id: string | number, delta: number, catatan: string) =>
			dataService.insertRows('bahan_mutasi', {
				bahan_id: String(id),
				delta_jumlah: delta,
				source: 'manual',
				catatan
			}),
		remove: (id: string | number) => dataService.deleteRows('bahan', { id: String(id) })
	};
}

export function createHppState() {
	return {
		loadSettings: async (): Promise<HppSettings | null> =>
			(await dataService.getHppSettings()) as unknown as HppSettings | null,
		loadRecipes: async (): Promise<ProductRecipe[]> =>
			(await dataService.getProductRecipes()) as unknown as ProductRecipe[],
		saveSettings: (payload: Record<string, unknown>) =>
			dataService.insertRows('hpp_settings', payload),
		async parsePurchase(text: string): Promise<HppParsedItem[]> {
			const response = await fetch('/api/hpp/parse', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data?.message || 'Gagal parse belanja');
			return data.items || [];
		},
		async savePurchasedItem(item: HppParsedItem, existing?: Ingredient) {
			if (existing) {
				await dataService.updateRows(
					'bahan',
					{
						satuan: item.satuan,
						jumlah_beli_terakhir: item.purchase_qty,
						biaya_beli_terakhir: item.purchase_cost,
						biaya_per_satuan: item.biaya_per_satuan
					},
					{ id: String(existing.id) }
				);
				await dataService.insertRows('bahan_mutasi', {
					bahan_id: String(existing.id),
					delta_jumlah: item.purchase_qty,
					source: 'purchase',
					catatan: `Belanja Rp ${Math.round(Number(item.purchase_cost || 0)).toLocaleString('id-ID')}`
				});
				return;
			}
			await dataService.insertRows('bahan', {
				nama: item.nama,
				satuan: item.satuan,
				stok_saat_ini: item.purchase_qty,
				ambang_stok: 0,
				jumlah_beli_terakhir: item.purchase_qty,
				biaya_beli_terakhir: item.purchase_cost,
				biaya_per_satuan: item.biaya_per_satuan
			});
		}
	};
}

export type MenuEntity = Product;
export type KategoriEntity = Category;
