// Validation utilities untuk sistem POS Zatiaras

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Sanitasi input untuk mencegah XSS dan injection
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/script/gi, '') // Remove script tags
    .replace(/iframe/gi, ''); // Remove iframe tags
}

// Validasi nomor (untuk harga, quantity, dll)
export function validateNumber(value: any, rules: ValidationRule = {}): ValidationResult {
  const errors: string[] = [];
  
  if (rules.required && (value === null || value === undefined || value === '')) {
    errors.push('Field ini wajib diisi');
    return { isValid: false, errors };
  }
  
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value);
  
  if (isNaN(numValue)) {
    errors.push('Nilai harus berupa angka');
    return { isValid: false, errors };
  }
  
  if (rules.min !== undefined && numValue < rules.min) {
    errors.push(`Nilai minimal adalah ${rules.min}`);
  }
  
  if (rules.max !== undefined && numValue > rules.max) {
    errors.push(`Nilai maksimal adalah ${rules.max}`);
  }
  
  return { isValid: errors.length === 0, errors };
}

// Validasi teks
export function validateText(value: any, rules: ValidationRule = {}): ValidationResult {
  const errors: string[] = [];
  
  if (rules.required && (!value || value.toString().trim() === '')) {
    errors.push('Field ini wajib diisi');
    return { isValid: false, errors };
  }
  
  if (!value || value.toString().trim() === '') {
    return { isValid: true, errors: [] };
  }
  
  const strValue = value.toString().trim();
  
  if (rules.minLength && strValue.length < rules.minLength) {
    errors.push(`Minimal ${rules.minLength} karakter`);
  }
  
  if (rules.maxLength && strValue.length > rules.maxLength) {
    errors.push(`Maksimal ${rules.maxLength} karakter`);
  }
  
  if (rules.pattern && !rules.pattern.test(strValue)) {
    errors.push('Format tidak valid');
  }
  
  if (rules.custom) {
    const customError = rules.custom(strValue);
    if (customError) {
      errors.push(customError);
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

// Validasi email
export function validateEmail(email: string): ValidationResult {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return validateText(email, {
    required: true,
    pattern: emailPattern,
    custom: (value) => {
      if (!emailPattern.test(value)) {
        return 'Format email tidak valid';
      }
      return null;
    }
  });
}

// Validasi password (strict - untuk production)
export function validatePassword(password: string): ValidationResult {
  return validateText(password, {
    required: true,
    minLength: 6,
    custom: (value) => {
      if (value.length < 6) {
        return 'Password minimal 6 karakter';
      }
      if (!/[A-Z]/.test(value)) {
        return 'Password harus mengandung huruf besar';
      }
      if (!/[a-z]/.test(value)) {
        return 'Password harus mengandung huruf kecil';
      }
      if (!/\d/.test(value)) {
        return 'Password harus mengandung angka';
      }
      return null;
    }
  });
}

// Validasi password (simplified - untuk demo)
export function validatePasswordDemo(password: string): ValidationResult {
  return validateText(password, {
    required: true,
    minLength: 6
  });
}

// Validasi produk
export function validateProduct(product: any): ValidationResult {
  const errors: string[] = [];
  
  // Validasi nama produk
  const nameValidation = validateText(product.name, {
    required: true,
    minLength: 2,
    maxLength: 100
  });
  if (!nameValidation.isValid) {
    errors.push(`Nama produk: ${nameValidation.errors.join(', ')}`);
  }
  
  // Validasi harga
  const priceValidation = validateNumber(product.price, {
    required: true,
    min: 0
  });
  if (!priceValidation.isValid) {
    errors.push(`Harga: ${priceValidation.errors.join(', ')}`);
  }
  
  // Validasi stok
  const stockValidation = validateNumber(product.stock, {
    required: true,
    min: 0
  });
  if (!stockValidation.isValid) {
    errors.push(`Stok: ${stockValidation.errors.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
}

// Validasi transaksi
export function validateTransaction(transaction: any): ValidationResult {
  const errors: string[] = [];
  
  // Validasi items
  if (!transaction.items || transaction.items.length === 0) {
    errors.push('Transaksi harus memiliki minimal 1 item');
  }
  
  // Validasi total
  const totalValidation = validateNumber(transaction.total, {
    required: true,
    min: 0
  });
  if (!totalValidation.isValid) {
    errors.push(`Total: ${totalValidation.errors.join(', ')}`);
  }
  
  // Validasi metode pembayaran
  if (!transaction.paymentMethod) {
    errors.push('Metode pembayaran harus dipilih');
  }
  
  return { isValid: errors.length === 0, errors };
}

// Validasi pemasukan/pengeluaran
export function validateIncomeExpense(data: any): ValidationResult {
  const errors: string[] = [];
  
  // Validasi nominal
  const amountValidation = validateNumber(data.amount, {
    required: true,
    min: 0
  });
  if (!amountValidation.isValid) {
    errors.push(`Nominal: ${amountValidation.errors.join(', ')}`);
  }
  
  // Validasi jenis
  if (!data.jenis) {
    errors.push('Jenis harus dipilih');
  }
  
  // Validasi deskripsi
  const descriptionValidation = validateText(data.description, {
    required: true,
    minLength: 3,
    maxLength: 200
  });
  if (!descriptionValidation.isValid) {
    errors.push(`Deskripsi: ${descriptionValidation.errors.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
}

// Rate limiting dummy untuk mencegah spam
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// Validasi tanggal
export function validateDate(date: string | Date): ValidationResult {
  const errors: string[] = [];
  if (!date) {
    errors.push('Tanggal harus diisi');
    return { isValid: false, errors };
  }
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    errors.push('Format tanggal tidak valid');
    return { isValid: false, errors };
  }
  return { isValid: errors.length === 0, errors };
}

// Validasi waktu
export function validateTime(time: string): ValidationResult {
  const errors: string[] = [];
  
  if (!time) {
    errors.push('Waktu harus diisi');
    return { isValid: false, errors };
  }
  
  const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (!timePattern.test(time)) {
    errors.push('Format waktu tidak valid (HH:MM)');
    return { isValid: false, errors };
  }
  
  return { isValid: true, errors: [] };
}

// Validasi kode produk (SKU)
export function validateSKU(sku: string): ValidationResult {
  return validateText(sku, {
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[A-Z0-9-]+$/,
    custom: (value) => {
      if (!/^[A-Z0-9-]+$/.test(value)) {
        return 'SKU hanya boleh mengandung huruf besar, angka, dan tanda hubung';
      }
      return null;
    }
  });
} 