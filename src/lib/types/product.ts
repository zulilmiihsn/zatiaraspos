/**
 * 🏷️ PRODUCT TYPE DEFINITIONS
 *
 * Type definitions untuk semua entity yang berkaitan dengan produk
 */

// ============================================================================
// 🍹 PRODUCT INTERFACES
// ============================================================================

export interface Product {
	id: number;
	name: string;
	price: number;
	harga?: number; // Alternative price field
	category_id: number;
	kategori_id?: number; // Indonesian field name from DB
	tipe: 'minuman' | 'makanan' | 'snack';
	gambar?: string;
	deskripsi?: string;
	ekstra_ids: number[];
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface Category {
	id: number;
	name: string;
	description?: string;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface AddOn {
	id: number;
	name: string;
	price: number;
	harga?: number; // Alternative price field
	is_active: boolean;
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
	id?: number;
	name: string;
	price: number;
	tipe: 'minuman' | 'makanan' | 'snack';
	kategori_id: number;
	gambar: string;
	deskripsi: string;
	ekstra_ids: number[];
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
