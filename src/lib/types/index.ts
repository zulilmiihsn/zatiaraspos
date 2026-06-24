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
// 👤 USER & AUTHENTICATION TYPES
// ============================================================================

export * from './user';

// ============================================================================
// 💰 TRANSACTION TYPES
// ============================================================================

export * from './transaction';

// ============================================================================
// 🧩 COMPONENT TYPES
// ============================================================================

export * from './components';

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
// 🎯 ENUM DEFINITIONS
// ============================================================================

export enum UserRole {
	KASIR = 'kasir',
	PEMILIK = 'pemilik',
	ADMIN = 'admin',
	MANAGER = 'manager'
}

export enum PaymentMethod {
	TUNAI = 'tunai',
	QRIS = 'qris',
	TRANSFER = 'transfer',
	E_WALLET = 'e-wallet',
	CARD = 'card'
}

export enum TransactionStatus {
	PENDING = 'pending',
	PROCESSING = 'processing',
	COMPLETED = 'completed',
	CANCELLED = 'cancelled',
	REFUNDED = 'refunded',
	FAILED = 'failed'
}

export enum ProductType {
	MINUMAN = 'minuman',
	MAKANAN = 'makanan',
	SNACK = 'snack'
}

export enum FinancialType {
	PEMASUKAN = 'pemasukan',
	PENGELUARAN = 'pengeluaran'
}

// ============================================================================
// 🔄 STATE MANAGEMENT TYPES
// ============================================================================

export interface AuthState {
	isAuthenticated: boolean;
	sessionId: string | null;
	token: string | null;
}

export interface UserState {
	profile: import('./user').UserProfile | null;
	role: string | null;
	permissions: string[];
}

export interface TransactionState {
	transactions: import('./transaction').Transaction[];
	isLoading: boolean;
	error: string | null;
}

export interface FinancialState {
	records: import('./laporan').BukuKasRecord[];
	summary: import('./laporan').LaporanSummary | null;
	isLoading: boolean;
}

export interface AppState {
	auth: AuthState;
	user: UserState;
	products: import('./product').ProductState;
	transactions: TransactionState;
	financial: FinancialState;
	ui: UIState;
}

export interface UIState {
	theme: 'light' | 'dark' | 'auto';
	language: 'id' | 'en';
	sidebar: {
		isOpen: boolean;
		isCollapsed: boolean;
	};
	modals: {
		[key: string]: boolean;
	};
	notifications: Notification[];
	loading: {
		[key: string]: boolean;
	};
}

export interface Notification {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message: string;
	duration?: number;
	isVisible: boolean;
	timestamp: number;
}

// ============================================================================
// 📱 COMPONENT PROP TYPES
// ============================================================================

export interface ComponentProps {
	className?: string;
	id?: string;
	style?: Record<string, string | number>;
	'data-testid'?: string;
}

export interface ButtonProps extends ComponentProps {
	variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
	size?: 'sm' | 'md' | 'lg' | 'xl';
	disabled?: boolean;
	loading?: boolean;
	type?: 'button' | 'submit' | 'reset';
	onClick?: (event: Event) => void;
}

export interface InputProps extends ComponentProps {
	type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
	placeholder?: string;
	value?: string | number;
	disabled?: boolean;
	required?: boolean;
	maxLength?: number;
	minLength?: number;
	pattern?: string;
	onInput?: (event: Event) => void;
	onChange?: (event: Event) => void;
	onBlur?: (event: Event) => void;
	onFocus?: (event: Event) => void;
}

export interface ModalProps extends ComponentProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
	closeOnOverlayClick?: boolean;
	closeOnEscape?: boolean;
}

// ============================================================================
// 🎯 EVENT HANDLER TYPES
// ============================================================================

export interface EventHandlers {
	onClick?: (event: Event) => void;
	onInput?: (event: Event) => void;
	onChange?: (event: Event) => void;
	onSubmit?: (event: Event) => void;
	onKeyDown?: (event: KeyboardEvent) => void;
	onKeyUp?: (event: KeyboardEvent) => void;
	onBlur?: (event: Event) => void;
	onFocus?: (event: Event) => void;
	onMouseEnter?: (event: MouseEvent) => void;
	onMouseLeave?: (event: MouseEvent) => void;
}

// ============================================================================
// 📊 FORM & VALIDATION TYPES
// ============================================================================

export interface FormField {
	nama: string;
	label: string;
	type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
	value: any;
	required?: boolean;
	validation?: ValidationRule[];
	options?: SelectOption[];
	placeholder?: string;
	helpText?: string;
	error?: string;
}

export interface ValidationRule {
	type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
	value?: any;
	message: string;
	validator?: (value: any) => boolean;
}

export interface SelectOption {
	value: string | number;
	label: string;
	disabled?: boolean;
}

export interface FormState {
	fields: Record<string, FormField>;
	isValid: boolean;
	isDirty: boolean;
	isSubmitting: boolean;
	errors: Record<string, string>;
}

// ============================================================================
// 🔍 SEARCH & FILTER TYPES
// ============================================================================

export interface SearchOptions {
	query: string;
	filters: Record<string, any>;
	sortBy: string;
	sortOrder: 'asc' | 'desc';
	page: number;
	limit: number;
}

export interface FilterOption {
	key: string;
	label: string;
	type: 'select' | 'multiselect' | 'range' | 'date' | 'boolean';
	options?: SelectOption[];
	min?: number;
	max?: number;
	defaultValue?: any;
}

// ============================================================================
// 📈 CHART & VISUALIZATION TYPES
// ============================================================================

export interface ChartData {
	labels: string[];
	datasets: ChartDataset[];
}

export interface ChartDataset {
	label: string;
	data: number[];
	backgroundColor?: string | string[];
	borderColor?: string | string[];
	borderWidth?: number;
	fill?: boolean;
}

export interface ChartOptions {
	responsive: boolean;
	maintainAspectRatio: boolean;
	plugins?: Record<string, any>;
	scales?: Record<string, any>;
	interaction?: Record<string, any>;
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
	value?: any;
}

export interface ApiError {
	status: number;
	statusText: string;
	message: string;
	errors?: ValidationError[];
	timestamp: number;
}

// ============================================================================
// 🔄 ASYNC & PROMISE TYPES
// ============================================================================

export interface AsyncState<T> {
	data: T | null;
	isLoading: boolean;
	error: string | null;
	lastUpdated?: number;
}

export interface AsyncAction {
	type: 'pending' | 'success' | 'error';
	payload?: any;
	error?: string;
	timestamp: number;
}

export type AsyncResult<T> = Promise<{
	success: boolean;
	data?: T;
	error?: string;
}>;

// ============================================================================
// 📱 PWA & OFFLINE TYPES
// ============================================================================

export interface PWAConfig {
	nama: string;
	short_name: string;
	deskripsi: string;
	theme_color: string;
	background_color: string;
	display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
	orientation: 'portrait' | 'landscape' | 'any';
	scope: string;
	start_url: string;
	icons: PWAIcon[];
}

export interface PWAIcon {
	src: string;
	sizes: string;
	type: string;
	purpose?: string;
}

export interface OfflineConfig {
	cache_name: string;
	urls_to_cache: string[];
	urls_to_cache_offline: string[];
	max_age: number;
	strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
}

// ============================================================================
// 🎯 TESTING TYPES
// ============================================================================

export interface TestCase {
	id: string;
	nama: string;
	deskripsi: string;
	test: () => Promise<TestResult>;
}

export interface TestResult {
	success: boolean;
	message: string;
	data?: any;
	error?: string;
	executionTime?: number;
}

export interface TestSuite {
	nama: string;
	tests: TestCase[];
}

export interface TestReport {
	totalTests: number;
	passedTests: number;
	failedTests: number;
	successRate: number;
	executionTime: number;
	results: TestResult[];
}
