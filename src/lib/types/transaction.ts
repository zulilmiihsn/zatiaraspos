/**
 * 💰 TRANSACTION TYPE DEFINITIONS
 *
 * Type definitions untuk semua entity yang berkaitan dengan transaksi dan keuangan
 */

// ============================================================================
// 💳 TRANSACTION INTERFACES
// ============================================================================

export interface Transaction {
	id: string;
	transaction_number: string;
	user_id: string;
	branch_id: string;
	customer_name?: string;
	total_amount: number;
	payment_method: PaymentMethod;
	cash_received?: number;
	change_amount?: number;
	status: TransactionStatus;
	items: TransactionItem[];
	notes?: string;
	created_at: string;
	updated_at: string;
}

export interface TransactionItem {
	id: string;
	transaction_id: string;
	product_id: number;
	product_name: string;
	product_price: number;
	quantity: number;
	add_ons: TransactionAddOn[];
	sugar?: string;
	ice?: string;
	note?: string;
	subtotal: number;
}

export interface TransactionAddOn {
	id: number;
	name: string;
	price: number;
	quantity: number;
}

// ============================================================================
// 💰 PAYMENT & FINANCIAL TYPES
// ============================================================================

export type PaymentMethod = 'tunai' | 'qris' | 'transfer' | 'e-wallet' | 'card';

export interface PaymentDetails {
	method: PaymentMethod;
	amount: number;
	reference_number?: string;
	transaction_id?: string;
	status: PaymentStatus;
	processed_at?: string;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export interface CashTransaction {
	cash_received: number;
	change_amount: number;
	denominations: CashDenomination[];
}

export interface CashDenomination {
	value: number;
	count: number;
	total: number;
}

// ============================================================================
// 📊 FINANCIAL RECORDS
// ============================================================================

export interface FinancialRecord {
	id: string;
	type: 'pemasukan' | 'pengeluaran';
	category: string;
	amount: number;
	description: string;
	payment_method: PaymentMethod;
	date: string;
	time: string;
	user_id: string;
	branch_id: string;
	reference_id?: string;
	created_at: string;
}

export interface FinancialCategory {
	id: string;
	name: string;
	type: 'pemasukan' | 'pengeluaran';
	description?: string;
	is_active: boolean;
	created_at: string;
}

export interface FinancialSummary {
	total_pemasukan: number;
	total_pengeluaran: number;
	saldo: number;
	laba_kotor: number;
	laba_bersih: number;
	period: {
		start_date: string;
		end_date: string;
		days: number;
	};
}

// ============================================================================
// 🏪 SESSION & STORE MANAGEMENT
// ============================================================================

export interface StoreSession {
	id: string;
	branch_id: string;
	user_id: string;
	opened_at: string;
	closed_at?: string;
	initial_cash: number;
	final_cash?: number;
	status: 'open' | 'closed';
	notes?: string;
	created_at: string;
}

export interface CashRegister {
	id: string;
	branch_id: string;
	session_id: string;
	opening_balance: number;
	current_balance: number;
	total_sales: number;
	total_refunds: number;
	cash_in: number;
	cash_out: number;
	last_updated: string;
}

// ============================================================================
// 📈 REPORTING & ANALYTICS
// ============================================================================

export interface SalesReport {
	period: string;
	total_transactions: number;
	total_sales: number;
	average_transaction: number;
	top_products: TopProduct[];
	payment_methods: PaymentMethodSummary[];
	daily_sales: DailySales[];
}

export interface TopProduct {
	product_id: number;
	product_name: string;
	quantity_sold: number;
	total_revenue: number;
	percentage: number;
}

export interface PaymentMethodSummary {
	method: PaymentMethod;
	count: number;
	total_amount: number;
	percentage: number;
}

export interface DailySales {
	date: string;
	transactions: number;
	revenue: number;
	average: number;
}

// ============================================================================
// 🔄 TRANSACTION STATUS & WORKFLOW
// ============================================================================

export type TransactionStatus =
	| 'pending'
	| 'processing'
	| 'completed'
	| 'cancelled'
	| 'refunded'
	| 'failed';

export interface TransactionWorkflow {
	current_status: TransactionStatus;
	next_status: TransactionStatus[];
	allowed_actions: TransactionAction[];
	workflow_history: WorkflowStep[];
}

export type TransactionAction = 'confirm' | 'process' | 'complete' | 'cancel' | 'refund' | 'void';

export interface WorkflowStep {
	action: TransactionAction;
	status: TransactionStatus;
	user_id: string;
	timestamp: string;
	notes?: string;
}

// ============================================================================
// 📱 OFFLINE & SYNC TYPES
// ============================================================================

export interface OfflineTransaction {
	id: string;
	local_id: string;
	transaction_data: Transaction;
	sync_status: 'pending' | 'synced' | 'failed';
	created_at: number;
	synced_at?: number;
	retry_count: number;
	error_message?: string;
}

export interface SyncStatus {
	is_online: boolean;
	last_sync: number;
	pending_transactions: number;
	sync_errors: number;
	sync_latency: number;
}

// ============================================================================
// 🎯 API RESPONSE TYPES
// ============================================================================

export interface TransactionApiResponse extends ApiResponse<Transaction> {}
export interface TransactionsApiResponse extends PaginatedResponse<Transaction> {}
export interface FinancialRecordApiResponse extends ApiResponse<FinancialRecord> {}
export interface SalesReportApiResponse extends ApiResponse<SalesReport> {}

// ============================================================================
// 📝 UTILITY TYPES
// ============================================================================

export interface TransactionFilters {
	date_range?: {
		start_date: string;
		end_date: string;
	};
	payment_method?: PaymentMethod;
	status?: TransactionStatus;
	user_id?: string;
	branch_id?: string;
	min_amount?: number;
	max_amount?: number;
}

export interface TransactionSortOptions {
	field: 'created_at' | 'total_amount' | 'transaction_number' | 'customer_name';
	order: 'asc' | 'desc';
}

export interface TransactionExportOptions {
	format: 'pdf' | 'excel' | 'csv';
	include_items: boolean;
	include_addons: boolean;
	date_range: {
		start_date: string;
		end_date: string;
	};
}

// ============================================================================
// 🔄 STATE MANAGEMENT TYPES
// ============================================================================

export interface TransactionState {
	transactions: Transaction[];
	currentTransaction: Transaction | null;
	cart: any[]; // CartItem dari product.ts
	filters: TransactionFilters;
	sortOptions: TransactionSortOptions;
	isLoading: boolean;
	error: string | null;
}

export interface FinancialState {
	records: FinancialRecord[];
	categories: FinancialCategory[];
	summary: FinancialSummary | null;
	filters: FinancialFilters;
	isLoading: boolean;
	error: string | null;
}

export interface FinancialFilters {
	date_range?: {
		start_date: string;
		end_date: string;
	};
	type?: 'pemasukan' | 'pengeluaran';
	category_id?: string;
	payment_method?: PaymentMethod;
	min_amount?: number;
	max_amount?: number;
}

// ============================================================================
// 🎯 GENERIC TYPES (Re-export from other files)
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

// CartItem sudah di-export dari product.ts
