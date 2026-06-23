/**
 * 🏷️ PRODUCT TYPE DEFINITIONS
 *
 * Type definitions untuk semua entity yang berkaitan dengan produk
 */

// ============================================================================
// 🍹 PRODUCT INTERFACES
// ============================================================================

export interface Product {
	id: string | number;
	name: string;
	price: number;
	stok?: number | null;
	track_stock?: boolean | number | null;
	track_ingredients?: boolean | number | null;
	kategori_id?: string | number | null;
	tipe: 'minuman' | 'makanan' | 'snack';
	gambar?: string;
	deskripsi?: string;
	ekstra_ids: Array<string | number>;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface Category {
	id: string | number;
	name: string;
	description?: string;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface AddOn {
	id: string | number;
	name: string;
	price: number;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface Ingredient {
	id: string | number;
	name: string;
	unit: string;
	current_stock: number;
	low_stock_threshold?: number;
	cost_per_unit?: number;
	last_purchase_qty?: number;
	last_purchase_cost?: number;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface HppSettings {
	id: string;
	branch_id: string;
	rent_monthly: number;
	electricity_monthly: number;
	water_monthly: number;
	salary_monthly: number;
	other_monthly: number;
	target_items_monthly: number;
	created_at?: string;
	updated_at?: string;
}

export interface ProductRecipe {
	id: string | number;
	produk_id: string | number;
	bahan_id: string | number;
	qty_per_item: number;
	created_at?: string;
	updated_at?: string;
}

// ============================================================================
// 🛒 CART & TRANSACTION TYPES
// ============================================================================

export interface CartItem {
	product: Product;
	qty: number;
	addOns: AddOn[];
	sugar?: string;
	ice?: string;
	note?: string;
	total: number;
}

export interface CartSummary {
	totalQty: number;
	totalHarga: number;
}

// ============================================================================
// 📊 MENU MANAGEMENT TYPES
// ============================================================================

export interface MenuForm {
	id?: string | number;
	name: string;
	price: number;
	stok?: number | null;
	track_stock?: boolean | number | null;
	track_ingredients?: boolean | number | null;
	tipe: 'minuman' | 'makanan' | 'snack';
	kategori_id: string | number;
	gambar: string;
	deskripsi: string;
	ekstra_ids: Array<string | number>;
	is_active: boolean;
}

export interface MenuFormState {
	isEditing: boolean;
	isLoading: boolean;
	error: string | null;
}

// ============================================================================
// 🔍 SEARCH & FILTER TYPES
// ============================================================================

export interface SearchFilters {
	category: string | number;
	searchKeyword: string;
	priceRange?: {
		min: number;
		max: number;
	};
}

export interface FilteredProducts {
	products: Product[];
	totalCount: number;
	categories: Category[];
}

// ============================================================================
// 📝 UTILITY TYPES
// ============================================================================

export type ProductType = 'minuman' | 'makanan' | 'snack';
export type SortOrder = 'asc' | 'desc';
export type SortField = 'name' | 'price' | 'created_at';

export interface ProductSortOptions {
	field: SortField;
	order: SortOrder;
}

// ApiResponse dan PaginatedResponse sudah didefinisikan di index.ts
// Import via re-export chain (index.ts → product.ts consumers)
import type { PaginatedResponse } from './index';

export interface ProductListResponse extends PaginatedResponse<Product> {
	categories: Category[];
	addOns: AddOn[];
}

// ============================================================================
// 🔄 STATE MANAGEMENT TYPES
// ============================================================================

export interface ProductState {
	products: Product[];
	categories: Category[];
	addOns: AddOn[];
	selectedCategory: string | number;
	searchKeyword: string;
	isLoading: boolean;
	error: string | null;
}

export interface MenuManagementState {
	menus: Product[];
	categories: Category[];
	addOns: AddOn[];
	selectedMenu: Product | null;
	formState: MenuFormState;
	isLoading: boolean;
	error: string | null;
}
