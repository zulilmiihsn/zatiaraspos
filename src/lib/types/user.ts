/**
 * 👤 USER & AUTHENTICATION TYPE DEFINITIONS
 *
 * Type definitions untuk semua entity yang berkaitan dengan user dan authentication
 */

// ============================================================================
// 👤 USER INTERFACES
// ============================================================================

export interface User {
	id: string;
	username: string;
	email?: string;
	role: UserRole;
	cabang_id: string;
	branch_name: string;
	is_active: boolean;
	last_login?: string;
	created_at: string;
	updated_at: string;
}

export interface UserProfile {
	id: string;
	username: string;
	full_name?: string;
	email?: string;
	phone?: string;
	avatar?: string;
	role: UserRole;
	branch: Branch;
	preferences: UserPreferences;
	last_login: string;
	created_at: string;
}

// ============================================================================
// 🏢 BRANCH & ORGANIZATION TYPES
// ============================================================================

export interface Branch {
	id: string;
	name: string;
	code: string;
	address?: string;
	phone?: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface OrganizationSettings {
	theme: 'light' | 'dark' | 'auto';
	language: 'id' | 'en';
	timezone: string;
	currency: string;
	tax_rate: number;
	allow_negative_stock: boolean;
	require_pin_for_refund: boolean;
}

export interface Organization {
	id: string;
	name: string;
	branches: Branch[];
	settings: OrganizationSettings;
	created_at: string;
	updated_at: string;
}

// ============================================================================
// 🔐 AUTHENTICATION TYPES
// ============================================================================

export interface AuthSession {
	user_id: string;
	username: string;
	role: UserRole;
	cabang_id: string;
	branch_name: string;
	token: string;
	expires_at: number;
	created_at: number;
}

export interface LoginCredentials {
	username: string;
	password: string;
	cabang_id?: string;
}

export interface LoginResponse {
	success: boolean;
	user: User;
	session: AuthSession;
	message?: string;
	error?: string;
}

export interface LogoutResponse {
	success: boolean;
	message: string;
}

// ============================================================================
// 🎭 ROLE & PERMISSION TYPES
// ============================================================================

export type UserRole = 'kasir' | 'pemilik' | 'admin' | 'manager';

export interface RolePermissions {
	role: UserRole;
	permissions: Permission[];
	access_level: AccessLevel;
}

export type Permission =
	| 'pos_access'
	| 'menu_management'
	| 'user_management'
	| 'report_access'
	| 'settings_access'
	| 'branch_management'
	| 'financial_access'
	| 'system_admin';

export type AccessLevel = 'read' | 'write' | 'admin' | 'super_admin';

// ============================================================================
// 🔒 SECURITY TYPES
// ============================================================================

export interface SecuritySettings {
	pin: string;
	halaman_terkunci: string[];
	session_timeout: number;
	max_login_attempts: number;
	require_pin_for_sensitive_actions: boolean;
}

export interface SecurityEvent {
	id: string;
	user_id: string;
	event_type: SecurityEventType;
	deskripsi: string;
	ip_address?: string;
	user_agent?: string;
	timestamp: string;
	severity: SecuritySeverity;
}

export type SecurityEventType =
	| 'login_success'
	| 'login_failed'
	| 'logout'
	| 'unauthorized_access'
	| 'suspicious_activity'
	| 'permission_violation'
	| 'data_access'
	| 'system_change';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// 📱 SESSION & STATE TYPES
// ============================================================================

export interface SessionState {
	isAuthenticated: boolean;
	user: User | null;
	session: AuthSession | null;
	isLoading: boolean;
	error: string | null;
}

export interface UserState {
	currentUser: User | null;
	userProfile: UserProfile | null;
	selectedBranch: Branch | null;
	isLoading: boolean;
	error: string | null;
}

// ============================================================================
// 🎯 API RESPONSE TYPES
// ============================================================================

export interface UserApiResponse extends ApiResponse<User> {}
export interface UsersApiResponse extends PaginatedResponse<User> {}
export interface BranchApiResponse extends ApiResponse<Branch> {}
export interface BranchesApiResponse extends PaginatedResponse<Branch> {}

// ============================================================================
// 📝 UTILITY TYPES
// ============================================================================

export interface UserPreferences {
	theme: 'light' | 'dark' | 'auto';
	language: 'id' | 'en';
	notifications: NotificationSettings;
	ui_preferences: UIPreferences;
}

export interface NotificationSettings {
	email_notifications: boolean;
	push_notifications: boolean;
	transaction_alerts: boolean;
	system_alerts: boolean;
}

export interface UIPreferences {
	compact_mode: boolean;
	show_animations: boolean;
	auto_refresh_interval: number;
	default_page_size: number;
}

// ============================================================================
// 🔄 STATE MANAGEMENT TYPES
// ============================================================================

export interface AuthState {
	session: SessionState;
	user: UserState;
	security: SecurityState;
}

export interface SecurityState {
	settings: SecuritySettings | null;
	recentEvents: SecurityEvent[];
	isLocked: boolean;
	failedAttempts: number;
	lastLockTime?: number;
}

// ============================================================================
// 📋 FORM & VALIDATION TYPES
// ============================================================================

export interface UserForm {
	username: string;
	email?: string;
	full_name?: string;
	phone?: string;
	role: UserRole;
	cabang_id: string;
	password?: string;
	confirm_password?: string;
}

export interface ChangePasswordForm {
	current_password: string;
	new_password: string;
	confirm_password: string;
}

export interface SecurityForm {
	current_pin: string;
	new_pin: string;
	confirm_pin: string;
	halaman_terkunci: string[];
	session_timeout: number;
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
