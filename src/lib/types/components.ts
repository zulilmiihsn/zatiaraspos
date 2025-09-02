/**
 * 🧩 COMPONENT TYPE DEFINITIONS
 *
 * Type definitions untuk komponen-komponen Svelte
 */

// ============================================================================
// 🧩 TOPBAR COMPONENT TYPES
// ============================================================================

export interface TopbarProps {
	showSettings?: boolean;
}

export interface TopbarSlots {
	default: any;
	actions?: any;
	download?: any;
}

// ============================================================================
// 🧩 OTHER COMPONENT TYPES
// ============================================================================

export interface ModalProps {
	show: boolean;
	title?: string;
	subtitle?: string;
}

export interface ModalSlots {
	default: any;
	header?: any;
	footer?: any;
}

export interface ButtonProps {
	variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
	size?: 'sm' | 'md' | 'lg';
	disabled?: boolean;
	loading?: boolean;
	type?: 'button' | 'submit' | 'reset';
}

export interface InputProps {
	type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	readonly?: boolean;
	error?: string;
	help?: string;
}
