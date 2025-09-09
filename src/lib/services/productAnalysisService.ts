import type { Product, AddOn } from '$lib/types/product';
import { dataService } from './dataService';

export interface ProductWithAddOns extends Product {
	addOns: AddOn[];
}

export interface ProductAnalysisData {
	products: ProductWithAddOns[];
	categories: any[];
	addOns: AddOn[];
}

export class ProductAnalysisService {
	private static instance: ProductAnalysisService;
	private cache: ProductAnalysisData | null = null;
	private cacheTimestamp: number = 0;
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	public static getInstance(): ProductAnalysisService {
		if (!ProductAnalysisService.instance) {
			ProductAnalysisService.instance = new ProductAnalysisService();
		}
		return ProductAnalysisService.instance;
	}

	/**
	 * Fetch semua data produk, kategori, dan add-ons untuk analisis AI
	 */
	async getProductAnalysisData(branch?: string): Promise<ProductAnalysisData> {
		const now = Date.now();

		// Return cached data if still valid
		if (this.cache && now - this.cacheTimestamp < this.CACHE_DURATION) {
			return this.cache;
		}

		try {
			let products: any[] = [];
			let categories: any[] = [];
			let addOns: any[] = [];

			// Check if we're in browser environment
			if (typeof window === 'undefined') {
				// For server-side, use getSupabaseClient with the provided branch
				const { getSupabaseClient } = await import('$lib/database/supabaseClient');
				const supabase = getSupabaseClient((branch || 'default') as any);

				if (!supabase) {
					throw new Error(`Supabase client not available for branch: ${branch || 'default'}`);
				}

				const [productsResult, categoriesResult, addOnsResult] = await Promise.all([
					supabase.from('produk').select('*').order('created_at', { ascending: false }),
					supabase.from('kategori').select('*').order('created_at', { ascending: false }),
					supabase.from('tambahan').select('*').order('created_at', { ascending: false })
				]);

				products = productsResult.data || [];
				categories = categoriesResult.data || [];
				addOns = addOnsResult.data || [];
			} else {
				// Browser environment - use dataService with cache
				[products, categories, addOns] = await Promise.all([
					dataService.getProducts(),
					dataService.getCategories(),
					dataService.getAddOns()
				]);
			}

			// Enrich products dengan add-ons yang tersedia
			const productsWithAddOns: ProductWithAddOns[] = products.map((product) => ({
				...product,
				addOns: addOns.filter((addOn) => product.ekstra_ids.includes(addOn.id) && addOn.is_active)
			}));

			this.cache = {
				products: productsWithAddOns,
				categories,
				addOns
			};
			this.cacheTimestamp = now;

			return this.cache;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Generate formatted product data untuk AI prompt
	 */
	async generateProductPromptData(branch?: string): Promise<string> {
		const data = await this.getProductAnalysisData(branch);

		let promptData = 'DAFTAR PRODUK DAN HARGA:\n\n';

		// Group products by category
		const productsByCategory = data.products.reduce(
			(acc, product) => {
				const category = data.categories.find((cat) => cat.id === product.category_id);
				const categoryName = category?.name || 'Lainnya';

				if (!acc[categoryName]) {
					acc[categoryName] = [];
				}
				acc[categoryName].push(product);
				return acc;
			},
			{} as Record<string, ProductWithAddOns[]>
		);

		// Format products by category
		Object.entries(productsByCategory).forEach(([categoryName, products]) => {
			promptData += `📂 ${categoryName.toUpperCase()}:\n`;

			products.forEach((product) => {
				if (product.is_active) {
					promptData += `  • ${product.name}: Rp ${product.price.toLocaleString('id-ID')}`;

					// Add add-ons if available
					if (product.addOns.length > 0) {
						promptData += `\n    Topping/Tambahan:`;
						product.addOns.forEach((addOn) => {
							promptData += `\n      - ${addOn.name}: Rp ${addOn.price.toLocaleString('id-ID')}`;
						});
					}
					promptData += `\n`;
				}
			});
			promptData += `\n`;
		});

		// Add standalone add-ons
		const standaloneAddOns = data.addOns.filter(
			(addOn) =>
				addOn.is_active && !data.products.some((product) => product.ekstra_ids.includes(addOn.id))
		);

		if (standaloneAddOns.length > 0) {
			promptData += `📂 TAMBAHAN/TOPPING STANDALONE:\n`;
			standaloneAddOns.forEach((addOn) => {
				promptData += `  • ${addOn.name}: Rp ${addOn.price.toLocaleString('id-ID')}\n`;
			});
			promptData += `\n`;
		}

		return promptData;
	}

	/**
	 * Find product by name (case insensitive)
	 */
	async findProductByName(productName: string): Promise<ProductWithAddOns | null> {
		const data = await this.getProductAnalysisData();

		const normalizedName = productName.toLowerCase().trim();

		return (
			data.products.find(
				(product) =>
					(product.is_active && product.name.toLowerCase().includes(normalizedName)) ||
					normalizedName.includes(product.name.toLowerCase())
			) || null
		);
	}

	/**
	 * Find add-on by name (case insensitive)
	 */
	async findAddOnByName(addOnName: string): Promise<AddOn | null> {
		const data = await this.getProductAnalysisData();

		const normalizedName = addOnName.toLowerCase().trim();

		return (
			data.addOns.find(
				(addOn) =>
					(addOn.is_active && addOn.name.toLowerCase().includes(normalizedName)) ||
					normalizedName.includes(addOn.name.toLowerCase())
			) || null
		);
	}

	/**
	 * Calculate total price for a product with add-ons
	 */
	calculateTotalPrice(product: ProductWithAddOns, selectedAddOns: AddOn[] = []): number {
		let total = product.price;

		selectedAddOns.forEach((addOn) => {
			total += addOn.price;
		});

		return total;
	}

	/**
	 * Clear cache (useful for testing or when data changes)
	 */
	clearCache(): void {
		this.cache = null;
		this.cacheTimestamp = 0;
	}
}

export const productAnalysisService = ProductAnalysisService.getInstance();
