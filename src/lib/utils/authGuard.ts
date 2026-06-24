import { goto } from '$app/navigation';
import { LoginSecurity, RateLimiter } from './security';
import { setUserRole } from '$lib/stores/userRole.svelte';
import {
	clearOfflineSessionSnapshot,
	isOfflinePosPath,
	persistOfflineSessionSnapshot,
	readOfflineSessionSnapshot
} from '$lib/auth/offlineSession';

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
	 * Fetch session payload from server
	 */
	private async fetchSessionPayload(): Promise<any | null> {
		const response = await fetch('/api/session', {
			method: 'GET',
			credentials: 'include'
		});

		if (!response.ok) {
			return null;
		}

		return response.json();
	}

	private allowOfflinePosAccess(): boolean {
		if (!isOfflinePosPath(window.location.pathname)) {
			goto('/offline');
			return false;
		}
		const snapshot = readOfflineSessionSnapshot();
		if (!snapshot) {
			clearOfflineSessionSnapshot();
			goto('/login?reason=offline_session_expired');
			return false;
		}
		setUserRole(String(snapshot.user.role || ''), snapshot.user);
		return true;
	}

	private persistValidatedSession(payload: Record<string, unknown>): void {
		if (!payload?.authenticated || !payload?.user || !Number.isFinite(Number(payload.expiresAt))) {
			return;
		}
		persistOfflineSessionSnapshot(payload.user, Number(payload.expiresAt));
		setUserRole(String(payload.user.role || ''), payload.user);
		window.dispatchEvent(new CustomEvent('auth-session-refreshed'));
	}

	/**
	 * Check authentication dengan security validation
	 */
	async requireAuth(): Promise<boolean> {
		if (typeof window === 'undefined') return true;
		if (!navigator.onLine) return this.allowOfflinePosAccess();

		try {
			// Rate limiting check
			const clientId = this.getClientIdentifier();
			if (!RateLimiter.isAllowed(`auth_${clientId}`)) {
				goto('/login?reason=rate_limit');
				return false;
			}

			const payload = await this.fetchSessionPayload();
			if (!payload) {
				this.recordFailedAuth(clientId);
				goto('/login');
				return false;
			}

			if (!payload?.authenticated || !payload?.user) {
				this.recordFailedAuth(clientId);
				localStorage.removeItem('zatiaras_session');
				localStorage.removeItem('selectedBranch');
				goto('/login?reason=session_expired');
				return false;
			}

			this.persistValidatedSession(payload);
			return true;
		} catch {
			return this.allowOfflinePosAccess();
		}
	}

	/**
	 * Check if user is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		if (typeof window === 'undefined') return false;

		try {
			const payload = await this.fetchSessionPayload();
			if (!payload) return false;
			return Boolean(payload?.authenticated && payload?.user);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Check role-based access
	 */
	async requireRole(requiredRole: string): Promise<boolean> {
		if (typeof window === 'undefined') return true;

		try {
			const clientId = this.getClientIdentifier();
			if (!RateLimiter.isAllowed(`auth_${clientId}`)) {
				goto('/login?reason=rate_limit');
				return false;
			}

			const payload = await this.fetchSessionPayload();
			if (!payload?.authenticated || !payload?.user) {
				this.recordFailedAuth(clientId);
				localStorage.removeItem('zatiaras_session');
				localStorage.removeItem('selectedBranch');
				goto('/login?reason=session_expired');
				return false;
			}

			if (!payload) {
				goto('/unauthorized');
				return false;
			}

			const userRole = payload?.user?.role;
			if (typeof userRole !== 'string') {
				goto('/unauthorized');
				return false;
			}

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
	async requireAdmin(): Promise<boolean> {
		return this.requireRole('admin');
	}

	/**
	 * Check kasir access
	 */
	async requireKasir(): Promise<boolean> {
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
export async function requireAuth(): Promise<boolean> {
	return authGuard.requireAuth();
}

export async function isAuthenticated(): Promise<boolean> {
	return authGuard.isAuthenticated();
}
