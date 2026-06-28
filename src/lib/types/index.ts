/**
 * 📚 TYPE DEFINITIONS INDEX
 *
 * Central export file untuk semua type definitions
 * Import semua types dari sini untuk konsistensi
 */

// ============================================================================
// 🍹 PRODUCT TYPES
// ============================================================================

export * from './product';

// ============================================================================
// 📊 LAPORAN & REPORT TYPES
// ============================================================================

export * from './laporan';

// ============================================================================
// 🏪 STORE & SESSION TYPES
// ============================================================================

export * from './store';

// ============================================================================
// 🔧 UTILITY & COMMON TYPES
// ============================================================================

export interface ApiResponse<T> {
	data: T;
	success: boolean;
	message?: string;
	error?: string;
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface BaseEntity {
	id: string | number;
	created_at: string;
	updated_at?: string;
}

export interface ActiveEntity extends BaseEntity {
	is_active: boolean;
}

// ============================================================================
// 🎯 ERROR & EXCEPTION TYPES
// ============================================================================

export interface AppError {
	code: string;
	message: string;
	details?: string;
	stack?: string;
	timestamp: number;
	user_id?: string;
	context?: Record<string, any>;
}

export interface ValidationError {
	field: string;
	message: string;
	value?: unknown;
}

export interface ApiError {
	status: number;
	statusText: string;
	message: string;
	errors?: ValidationError[];
	timestamp: number;
}
