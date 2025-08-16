/**
 * Comprehensive security utilities for Zatiaras POS
 * Implements CSRF protection, XSS prevention, input sanitization, and rate limiting
 */

import { browser } from '$app/environment';

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
    tokenArray.slice(-500).forEach(token => this.tokens.add(token));
  }
}

/**
 * XSS Prevention Utilities
 */
export class XSSProtection {
  /**
   * Sanitize HTML content
   */
  static sanitizeHTML(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Remove potentially dangerous HTML tags and attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]*>/g, '');
  }

  /**
   * Escape HTML entities
   */
  static escapeHTML(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    return text.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
  }

  /**
   * Validate and sanitize URLs
   */
  static sanitizeURL(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // Remove javascript: and data: protocols
    if (url.toLowerCase().startsWith('javascript:') || url.toLowerCase().startsWith('data:')) {
      return '';
    }

    // Ensure URL starts with http:// or https://
    if (!url.match(/^https?:\/\//)) {
      return '';
    }

    return url;
  }
}

/**
 * Input Validation and Sanitization
 */
export class InputValidation {
  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
    score: number;
  } {
    if (!password || typeof password !== 'string') {
      return {
        isValid: false,
        errors: ['Password is required'],
        score: 0
      };
    }

    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
    } else {
      score += 1;
    }

    // Character requirements
    if (SECURITY_CONFIG.PASSWORD_REQUIREMENTS.uppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIREMENTS.lowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIREMENTS.numbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIREMENTS.symbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    const isValid = errors.length === 0;
    return { isValid, errors, score };
  }

  /**
   * Sanitize text input
   */
  static sanitizeText(text: string, maxLength: number = 1000): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, '');
  }

  /**
   * Validate numeric input
   */
  static validateNumber(value: string | number, min?: number, max?: number): boolean {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) {
      return false;
    }

    if (min !== undefined && num < min) {
      return false;
    }

    if (max !== undefined && num > max) {
      return false;
    }

        return true;
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
  static validateSession(sessionData: any): boolean {
    if (!sessionData || typeof sessionData !== 'object') {
      return false;
    }

    const { timestamp, userId, branchId } = sessionData;
    
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
  static generateSession(userId: string, branchId: string): any {
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
  sanitizeHTML: XSSProtection.sanitizeHTML,
  escapeHTML: XSSProtection.escapeHTML,
  sanitizeURL: XSSProtection.sanitizeURL,
  validateEmail: InputValidation.isValidEmail,
  validatePassword: InputValidation.validatePassword,
  sanitizeText: InputValidation.sanitizeText,
  validateNumber: InputValidation.validateNumber,
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
    
    return suspiciousPatterns.some(pattern => pattern.test(input));
  },
  
  logSecurityEvent: (eventType: string, data: any): void => {
    // Log security events (in production, this would go to a security log)
    if (browser && console) {
      console.log(`[SECURITY] ${eventType}:`, data);
    }
  }
}; 