import type { HppSettings, Ingredient, Product, ProductRecipe } from '$lib/types/product';

type HppSources = {
	getSettings: () => HppSettings | null;
	getIngredients: () => Ingredient[];
	getRecipes: () => ProductRecipe[];
};

export function createHppCalculator(sources: HppSources) {
	const ingredient = (id: string | number) =>
		sources.getIngredients().find((item) => String(item.id) === String(id));

	const getOverheadMonthly = () => {
		const settings = sources.getSettings();
		if (!settings) return 0;
		return (
			Number(settings.sewa_bulanan || 0) +
			Number(settings.listrik_bulanan || 0) +
			Number(settings.air_bulanan || 0) +
			Number(settings.gaji_bulanan || 0) +
			Number(settings.lainnya_bulanan || 0)
		);
	};

	const getOverheadPerItem = () => {
		const target = Math.max(1, Number(sources.getSettings()?.target_item_bulanan || 1000));
		return Math.round(getOverheadMonthly() / target);
	};

	const getProductRecipeCost = (productId: string | number) =>
		sources
			.getRecipes()
			.filter((recipe) => String(recipe.produk_id) === String(productId))
			.reduce(
				(total, recipe) =>
					total +
					Number(recipe.jumlah_per_item || 0) *
						Number(ingredient(recipe.bahan_id)?.biaya_per_satuan || 0),
				0
			);

	const getProductHpp = (menu: Product) =>
		Math.round(getProductRecipeCost(menu.id) + getOverheadPerItem());
	const getProductMargin = (menu: Product) => Number(menu.harga || 0) - getProductHpp(menu);

	return {
		getBahanName: (id: string | number) => ingredient(id)?.nama || 'Bahan',
		getBahanUnit: (id: string | number) => ingredient(id)?.satuan || '',
		getBahanCostPerUnit: (id: string | number) => Number(ingredient(id)?.biaya_per_satuan || 0),
		getOverheadMonthly,
		getOverheadPerItem,
		getProductRecipeCost,
		getProductHpp,
		getProductMargin
	};
}
