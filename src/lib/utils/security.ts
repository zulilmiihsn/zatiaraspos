/**
 * Comprehensive security utilities for Zatiaras POS
 * Implements CSRF protection, XSS prevention, input sanitization, and rate limiting
 */

// Security configuration
const SECURITY_CONFIG = {
	CSRF_TOKEN_LENGTH: 32,
	RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
	MAX_REQUESTS_PER_WINDOW: 100,
	MAX_LOGIN_ATTEMPTS: 5,
	LOGIN_BLOCK_DURATION: 30 * 60 * 1000, // 30 minutes
	SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
	PASSWORD_MIN_LENGTH: 8,
	PASSWORD_REQUIREMENTS: {
		uppercase: true,
		lowercase: true,
		numbers: true,
		symbols: true
	}
};

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

/**
 * CSRF Token Management
 */
export class CSRFProtection {
	private static instance: CSRFProtection;
	private tokens: Set<string> = new Set();

	private constructor() {}

	static getInstance(): CSRFProtection {
		if (!CSRFProtection.instance) {
			CSRFProtection.instance = new CSRFProtection();
		}
		return CSRFProtection.instance;
	}

	/**
	 * Generate a new CSRF token
	 */
	generateToken(): string {
		const token = this.generateRandomString(SECURITY_CONFIG.CSRF_TOKEN_LENGTH);
		this.tokens.add(token);

		// Clean up old tokens periodically
		if (this.tokens.size > 1000) {
			this.cleanupOldTokens();
		}

		return token;
	}

	/**
	 * Validate a CSRF token
	 */
	validateToken(token: string): boolean {
		if (!token || typeof token !== 'string') {
			return false;
		}

		const isValid = this.tokens.has(token);
		if (isValid) {
			// Remove used token (one-time use)
			this.tokens.delete(token);
		}

		return isValid;
	}

	/**
	 * Generate random string for tokens
	 */
	private generateRandomString(length: number): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Clean up old tokens
	 */
	private cleanupOldTokens(): void {
		// Keep only the last 500 tokens
		const tokenArray = Array.from(this.tokens);
		this.tokens.clear();
		tokenArray.slice(-500).forEach((token) => this.tokens.add(token));
	}
}

/**
 * Rate Limiting Implementation
 */
export class RateLimiter {
	/**
	 * Check if request is allowed
	 */
	static isAllowed(identifier: string): boolean {
		const now = Date.now();
		const record = rateLimitStore.get(identifier);

		if (!record || now > record.resetTime) {
			// Reset or create new record
			rateLimitStore.set(identifier, {
				count: 1,
				resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW
			});
			return true;
		}

		if (record.count >= SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
			return false;
		}

		// Increment count
		record.count++;
		return true;
	}

	/**
	 * Get remaining requests for identifier
	 */
	static getRemainingRequests(identifier: string): number {
		const record = rateLimitStore.get(identifier);
		if (!record) {
			return SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW;
		}

		const remaining = SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW - record.count;
		return Math.max(0, remaining);
	}

	/**
	 * Get reset time for identifier
	 */
	static getResetTime(identifier: string): number {
		const record = rateLimitStore.get(identifier);
		return record ? record.resetTime : Date.now();
	}
}

/**
 * Login Security Management
 */
export class LoginSecurity {
	/**
	 * Check if login is blocked for IP/username
	 */
	static isLoginBlocked(identifier: string): boolean {
		const record = loginAttempts.get(identifier);
		if (!record) {
			return false;
		}

		return Date.now() < record.blockedUntil;
	}

	/**
	 * Record failed login attempt
	 */
	static recordFailedLogin(identifier: string): void {
		const record = loginAttempts.get(identifier);
		const now = Date.now();

		if (!record) {
			loginAttempts.set(identifier, {
				count: 1,
				blockedUntil: 0
			});
		} else {
			record.count++;

			if (record.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
				record.blockedUntil = now + SECURITY_CONFIG.LOGIN_BLOCK_DURATION;
			}
		}
	}

	/**
	 * Reset login attempts for successful login
	 */
	static resetLoginAttempts(identifier: string): void {
		loginAttempts.delete(identifier);
	}

	/**
	 * Get remaining login attempts
	 */
	static getRemainingLoginAttempts(identifier: string): number {
		const record = loginAttempts.get(identifier);
		if (!record) {
			return SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS;
		}

		return Math.max(0, SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - record.count);
	}
}

/**
 * Session Security
 */
export class SessionSecurity {
	/**
	 * Validate session token
	 */
	static validateSession(sessionData: unknown): boolean {
		if (!sessionData || typeof sessionData !== 'object') {
			return false;
		}

		const { timestamp, userId, branchId } = sessionData as {
			timestamp?: number;
			userId?: string;
			branchId?: string;
		};

		if (!timestamp || !userId || !branchId) {
			return false;
		}

		// Check if session has expired
		const now = Date.now();
		if (now - timestamp > SECURITY_CONFIG.SESSION_TIMEOUT) {
			return false;
		}

		return true;
	}

	/**
	 * Generate secure session data
	 */
	static generateSession(
		userId: string,
		branchId: string
	): { userId: string; branchId: string; timestamp: number; token: string } {
		return {
			userId,
			branchId,
			timestamp: Date.now(),
			token: CSRFProtection.getInstance().generateToken()
		};
	}
}

// Export singleton instances
export const csrfProtection = CSRFProtection.getInstance();

// Export utility functions
export const securityUtils = {
	isRateLimited: RateLimiter.isAllowed,
	getRemainingRequests: RateLimiter.getRemainingRequests,
	isLoginBlocked: LoginSecurity.isLoginBlocked,
	recordFailedLogin: LoginSecurity.recordFailedLogin,
	validateSession: SessionSecurity.validateSession,
	generateSession: SessionSecurity.generateSession,

	// Additional methods for form security
	checkFormRateLimit: (formName: string): boolean => {
		return RateLimiter.isAllowed(`form_${formName}`);
	},

	detectSuspiciousActivity: (action: string, input: string): boolean => {
		// Simple suspicious activity detection
		const suspiciousPatterns = [
			/<script/i,
			/javascript:/i,
			/on\w+\s*=/i,
			/eval\s*\(/i,
			/alert\s*\(/i
		];

		return suspiciousPatterns.some((pattern) => pattern.test(input));
	},

	logSecurityEvent: (eventType: string, data: unknown): void => {
		if (typeof window === 'undefined') {
			return;
		}

		const payload = JSON.stringify({
			eventType,
			data,
			timestamp: Date.now()
		});

		try {
			if (navigator.sendBeacon) {
				const blob = new Blob([payload], { type: 'application/json' });
				navigator.sendBeacon('/api/security-events', blob);
				return;
			}

			void fetch('/api/security-events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: payload,
				keepalive: true,
				credentials: 'include'
			});
		} catch {
			// no-op
		}
	}
};
