import { goto } from '$app/navigation';
import { SessionSecurity, LoginSecurity, RateLimiter } from './security';

/**
 * Enhanced auth guard dengan security features
 * Implements session validation, rate limiting, dan security checks
 */
export class AuthGuard {
	private static instance: AuthGuard;
	private loginAttempts: Map<string, number> = new Map();

	private constructor() {}

	static getInstance(): AuthGuard {
		if (!AuthGuard.instance) {
			AuthGuard.instance = new AuthGuard();
		}
		return AuthGuard.instance;
	}

	/**
	 * Check authentication dengan security validation
	 */
	requireAuth(): boolean {
		if (typeof window === 'undefined') return true;

		try {
			// Rate limiting check
			const clientId = this.getClientIdentifier();
			if (!RateLimiter.isAllowed(`auth_${clientId}`)) {
				goto('/login?error=rate_limit');
				return false;
			}

			const session = localStorage.getItem('zatiaras_session');
			const branch = localStorage.getItem('selectedBranch');

			if (!session || !branch) {
				this.recordFailedAuth(clientId);
				goto('/login');
				return false;
			}

			// Validate session data
			let sessionData;
			try {
				sessionData = JSON.parse(session);
			} catch {
				this.recordFailedAuth(clientId);
				goto('/login');
				return false;
			}

			// Validate session data structure
			if (!sessionData.isAuthenticated || !sessionData.user) {
				this.recordFailedAuth(clientId);
				localStorage.removeItem('zatiaras_session');
				localStorage.removeItem('selectedBranch');
				goto('/login?error=session_expired');
				return false;
			}

			return true;
		} catch (error) {
			goto('/login');
			return false;
		}
	}

	/**
	 * Check if user is authenticated
	 */
	isAuthenticated(): boolean {
		if (typeof window === 'undefined') return false;

		try {
			const session = localStorage.getItem('zatiaras_session');
			const branch = localStorage.getItem('selectedBranch');

			if (!session || !branch) return false;

			let sessionData;
			try {
				sessionData = JSON.parse(session);
			} catch {
				return false;
			}

			return SessionSecurity.validateSession(sessionData);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Check role-based access
	 */
	requireRole(requiredRole: string): boolean {
		if (!this.requireAuth()) return false;

		try {
			const session = localStorage.getItem('zatiaras_session');
			if (!session) return false;

			const sessionData = JSON.parse(session);
			const userRole = sessionData.user?.role || 'kasir';

			if (userRole !== requiredRole && userRole !== 'admin') {
				goto('/unauthorized');
				return false;
			}

			return true;
		} catch (error) {
			goto('/unauthorized');
			return false;
		}
	}

	/**
	 * Check admin access
	 */
	requireAdmin(): boolean {
		return this.requireRole('admin');
	}

	/**
	 * Check kasir access
	 */
	requireKasir(): boolean {
		return this.requireRole('kasir');
	}

	/**
	 * Get client identifier for rate limiting
	 */
	private getClientIdentifier(): string {
		// Use user agent hash for client identification
		const userAgent = navigator.userAgent;
		const hash = this.simpleHash(userAgent);
		return `client_${hash}`;
	}

	/**
	 * Simple hash function for user agent
	 */
	private simpleHash(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash);
	}

	/**
	 * Record failed authentication attempt
	 */
	private recordFailedAuth(clientId: string): void {
		const attempts = this.loginAttempts.get(clientId) || 0;
		this.loginAttempts.set(clientId, attempts + 1);

		// Block after 5 failed attempts
		if (attempts >= 4) {
			LoginSecurity.recordFailedLogin(clientId);
		}
	}

	/**
	 * Reset failed authentication attempts
	 */
	resetFailedAttempts(clientId: string): void {
		this.loginAttempts.delete(clientId);
		LoginSecurity.resetLoginAttempts(clientId);
	}
}

// Export singleton instance
export const authGuard = AuthGuard.getInstance();

// Legacy function exports for backward compatibility
export function requireAuth(): boolean {
	return authGuard.requireAuth();
}

export function isAuthenticated(): boolean {
	return authGuard.isAuthenticated();
}
