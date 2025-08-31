import type { AppError, ValidationError, ApiError } from '$lib/types';

/**
 * Standardized error handling utilities
 */

export class ErrorHandler {
  /**
   * Create a standardized error object
   */
  static createError(
    message: string,
    code?: string,
    details?: Record<string, any>
  ): AppError {
    return {
      message,
      code: code || 'UNKNOWN_ERROR',
      details: details ? JSON.stringify(details) : undefined,
      timestamp: Date.now(),
      stack: new Error().stack
    };
  }

  /**
   * Create a validation error
   */
  static createValidationError(
    field: string,
    message: string,
    value?: any
  ): ValidationError {
    return {
      field,
      message,
      value
    };
  }

  /**
   * Create an API error
   */
  static createApiError(
    message: string,
    statusCode: number,
    endpoint?: string
  ): ApiError {
    return {
      status: statusCode,
      statusText: 'Error',
      message,
      errors: [],
      timestamp: Date.now()
    };
  }

  /**
   * Safely extract error message from various error types
   */
  static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      // Handle PostgrestError
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
      
      // Handle error_description
      if ('error_description' in error && typeof error.error_description === 'string') {
        return error.error_description;
      }
      
      // Handle any other object with message property
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
    }
    
    return 'Unknown error occurred';
  }

  /**
   * Log error with consistent format
   */
  static logError(error: unknown, context?: string): void {
    const errorMessage = this.extractErrorMessage(error);
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context}]` : '';
    
    console.error(`[${timestamp}]${contextStr} Error:`, errorMessage);
    
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }

  /**
   * Handle async operations with consistent error handling
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<{ data: T | null; error: AppError | null }> {
    try {
      const data = await operation();
      return { data, error: null };
    } catch (error) {
      const appError = this.createError(
        this.extractErrorMessage(error),
        'ASYNC_OPERATION_FAILED',
        { context }
      );
      
      this.logError(error, context);
      return { data: null, error: appError };
    }
  }

  /**
   * Format error for user display
   */
  static formatForUser(error: unknown): string {
    const message = this.extractErrorMessage(error);
    
    // Map common error messages to user-friendly versions
    const userFriendlyMessages: Record<string, string> = {
      'Failed to fetch': 'Gagal mengambil data dari server',
      'Network Error': 'Koneksi internet bermasalah',
      'Unauthorized': 'Sesi login telah berakhir, silakan login ulang',
      'Forbidden': 'Anda tidak memiliki akses ke fitur ini',
      'Not Found': 'Data yang dicari tidak ditemukan',
      'Internal Server Error': 'Terjadi kesalahan pada server',
      'Bad Request': 'Data yang dikirim tidak valid'
    };

    return userFriendlyMessages[message] || message;
  }
}

/**
 * Error boundary for Svelte components
 */
export function createErrorBoundary() {
  let error: AppError | null = null;
  
  return {
    get error() { return error; },
    set error(value: AppError | null) { error = value; },
    
    handleError(err: unknown, context?: string) {
      error = ErrorHandler.createError(
        ErrorHandler.extractErrorMessage(err),
        'COMPONENT_ERROR',
        { context }
      );
      ErrorHandler.logError(err, context);
    },
    
    clearError() {
      error = null;
    }
  };
}

/**
 * Validation helper functions
 */
export const ValidationHelper = {
  /**
   * Validate required field
   */
  required(value: any, fieldName: string): ValidationError | null {
    if (value === null || value === undefined || value === '') {
      return ErrorHandler.createValidationError(
        fieldName,
        `${fieldName} harus diisi`,
        value
      );
    }
    return null;
  },

  /**
   * Validate string length
   */
  minLength(value: string, min: number, fieldName: string): ValidationError | null {
    if (value && value.length < min) {
      return ErrorHandler.createValidationError(
        fieldName,
        `${fieldName} minimal ${min} karakter`,
        value
      );
    }
    return null;
  },

  /**
   * Validate numeric value
   */
  numeric(value: any, fieldName: string): ValidationError | null {
    if (value && isNaN(Number(value))) {
      return ErrorHandler.createValidationError(
        fieldName,
        `${fieldName} harus berupa angka`,
        value
      );
    }
    return null;
  },

  /**
   * Validate positive number
   */
  positive(value: any, fieldName: string): ValidationError | null {
    const num = Number(value);
    if (value && (isNaN(num) || num <= 0)) {
      return ErrorHandler.createValidationError(
        fieldName,
        `${fieldName} harus lebih dari 0`,
        value
      );
    }
    return null;
  }
};
