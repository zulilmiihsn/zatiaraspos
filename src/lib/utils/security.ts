import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get } from 'svelte/store';
import { selectedBranch } from "$lib/stores/selectedBranch";
import { checkRateLimit } from './validation.js';
import { browser } from '$app/environment';
import { auth } from '$lib/auth/auth';

// Security middleware untuk proteksi rute
export class SecurityMiddleware {
  // Check authentication untuk protected routes
  static async requireAuth(): Promise<boolean> {
    if (!browser) return true;
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
      return false;
    }
    return true;
  }

  // Check role-based access
  static async requireRole(requiredRole: string): Promise<boolean> {
    const ok = await this.requireAuth();
    if (!ok) return false;
    const user = auth.getCurrentUser();
    if (!user || user.role !== requiredRole) {
      window.location.href = '/unauthorized';
      return false;
    }
    return true;
  }

  // Check admin access
  static async requireAdmin(): Promise<boolean> {
    return await this.requireRole('admin');
  }

  // Check kasir access
  static async requireKasir(): Promise<boolean> {
    return await this.requireRole('kasir');
  }

  // Rate limiting untuk API calls
  static checkApiRateLimit(userId: string): boolean {
    return checkRateLimit(`api_${userId}`, 100, 60000); // 100 requests per minute
  }

  // Rate limiting untuk form submissions
  static checkFormRateLimit(userId: string): boolean {
    return checkRateLimit(`form_${userId}`, 10, 60000); // 10 submissions per minute
  }

  // Validate CSRF token (dummy implementation)
  static validateCSRFToken(token: string): boolean {
    // Dummy CSRF validation - in production this would validate against server
    return !!token && token.length > 10;
  }

  // Generate CSRF token (dummy implementation)
  static generateCSRFToken(): string {
    return 'csrf_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Sanitize data sebelum disimpan
  static sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    
    return data;
  }

  // Sanitize string input
  private static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/script/gi, '') // Remove script tags
      .replace(/iframe/gi, '') // Remove iframe tags
      .replace(/data:/gi, '') // Remove data protocol
      .replace(/vbscript:/gi, ''); // Remove vbscript protocol
  }

  // Validate file upload (dummy implementation)
  static validateFileUpload(file: File): { isValid: boolean; error?: string } {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { isValid: false, error: 'Ukuran file maksimal 5MB' };
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'Tipe file tidak diizinkan' };
    }

    return { isValid: true };
  }

  // Log security events (dummy implementation)
  static async logSecurityEvent(event: string, details: any = {}): Promise<void> {
    let currentUser = 'anonymous';
    if (browser) {
      try {
        const { data: { session } } = await getSupabaseClient(get(selectedBranch)).auth.getSession();
        const user = session?.user;
        if (user) {
          // Prefer username, fallback ke email, lalu id
          currentUser = user.user_metadata?.username || user.email || user.id || 'anonymous';
        }
      } catch {}
    }
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      user: currentUser,
      ip: 'dummy-ip',
      userAgent: browser ? navigator.userAgent : 'server'
    };
    // Hapus log ke console
  }

  // Check for suspicious activity
  static detectSuspiciousActivity(userId: string, action: string): boolean {
    // Dummy suspicious activity detection
    const suspiciousPatterns = [
      /script/i,
      /javascript:/i,
      /<iframe/i,
      /on\w+=/i,
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(action)) {
        this.logSecurityEvent('suspicious_activity_detected', {
          userId,
          action,
          pattern: pattern.source
        });
        return true;
      }
    }

    return false;
  }
}

// Auto-initialize security when module loads
if (browser) {
  // SecurityMiddleware.init();
} 