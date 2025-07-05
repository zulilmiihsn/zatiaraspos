// Security Testing Utilities untuk Zatiaras POS
// File ini berisi fungsi-fungsi untuk testing fitur keamanan

import { auth } from './auth.js';
import { SecurityMiddleware } from './security.js';
import { 
  validateText, 
  validateNumber, 
  validateEmail, 
  validatePassword,
  sanitizeInput,
  checkRateLimit 
} from './validation.js';

// Test Authentication
export function testAuthentication() {
  console.log('=== Testing Authentication ===');
  
  // Test valid login
  const validLogin = auth.login('admin', 'admin123');
  console.log('Valid login test:', validLogin);
  
  // Test invalid login
  const invalidLogin = auth.login('admin', 'wrongpassword');
  console.log('Invalid login test:', invalidLogin);
  
  // Test role checking
  const hasAdminRole = auth.hasRole('admin');
  console.log('Admin role check:', hasAdminRole);
  
  // Test session
  const isAuthenticated = auth.isAuthenticated();
  console.log('Is authenticated:', isAuthenticated);
  
  // Test logout
  auth.logout();
  const afterLogout = auth.isAuthenticated();
  console.log('After logout:', afterLogout);
}

// Test Input Validation
export function testInputValidation() {
  console.log('=== Testing Input Validation ===');
  
  // Test text validation
  const textValidation = validateText('test', { required: true, minLength: 2 });
  console.log('Text validation:', textValidation);
  
  // Test number validation
  const numberValidation = validateNumber('100', { required: true, min: 0 });
  console.log('Number validation:', numberValidation);
  
  // Test email validation
  const emailValidation = validateEmail('test@example.com');
  console.log('Email validation:', emailValidation);
  
  // Test password validation
  const passwordValidation = validatePassword('Test123');
  console.log('Password validation:', passwordValidation);
  
  // Test input sanitization
  const sanitizedInput = sanitizeInput('<script>alert("xss")</script>');
  console.log('Sanitized input:', sanitizedInput);
}

// Test Security Middleware
export function testSecurityMiddleware() {
  console.log('=== Testing Security Middleware ===');
  
  // Test rate limiting
  const rateLimitTest = checkRateLimit('test_user', 5, 60000);
  console.log('Rate limit test:', rateLimitTest);
  
  // Test suspicious activity detection
  const suspiciousTest = SecurityMiddleware.detectSuspiciousActivity('test', '<script>alert("xss")</script>');
  console.log('Suspicious activity test:', suspiciousTest);
  
  // Test CSRF token generation
  const csrfToken = SecurityMiddleware.generateCSRFToken();
  console.log('CSRF token:', csrfToken);
  
  // Test CSRF token validation
  const csrfValidation = SecurityMiddleware.validateCSRFToken(csrfToken);
  console.log('CSRF validation:', csrfValidation);
  
  // Test data sanitization
  const testData = {
    name: '<script>alert("xss")</script>',
    email: 'test@example.com',
    amount: '100'
  };
  const sanitizedData = SecurityMiddleware.sanitizeData(testData);
  console.log('Sanitized data:', sanitizedData);
}

// Test File Upload Validation
export function testFileUpload() {
  console.log('=== Testing File Upload Validation ===');
  
  // Mock file objects
  const validFile = {
    size: 1024 * 1024, // 1MB
    type: 'image/jpeg'
  } as File;
  
  const largeFile = {
    size: 10 * 1024 * 1024, // 10MB
    type: 'image/jpeg'
  } as File;
  
  const invalidFile = {
    size: 1024 * 1024, // 1MB
    type: 'application/exe'
  } as File;
  
  // Test valid file
  const validFileTest = SecurityMiddleware.validateFileUpload(validFile);
  console.log('Valid file test:', validFileTest);
  
  // Test large file
  const largeFileTest = SecurityMiddleware.validateFileUpload(largeFile);
  console.log('Large file test:', largeFileTest);
  
  // Test invalid file type
  const invalidFileTest = SecurityMiddleware.validateFileUpload(invalidFile);
  console.log('Invalid file test:', invalidFileTest);
}

// Test Rate Limiting
export function testRateLimiting() {
  console.log('=== Testing Rate Limiting ===');
  
  const userId = 'test_user_123';
  
  // Test multiple requests
  for (let i = 0; i < 12; i++) {
    const allowed = checkRateLimit(userId, 10, 60000);
    console.log(`Request ${i + 1}: ${allowed ? 'Allowed' : 'Blocked'}`);
  }
  
  // Test different rate limits
  const apiLimit = SecurityMiddleware.checkApiRateLimit(userId);
  const formLimit = SecurityMiddleware.checkFormRateLimit(userId);
  
  console.log('API rate limit:', apiLimit);
  console.log('Form rate limit:', formLimit);
}

// Test Security Logging
export function testSecurityLogging() {
  console.log('=== Testing Security Logging ===');
  
  // Test various security events
  SecurityMiddleware.logSecurityEvent('test_login_attempt', {
    username: 'test_user',
    success: true
  });
  
  SecurityMiddleware.logSecurityEvent('test_suspicious_activity', {
    activity: 'xss_attempt',
    blocked: true
  });
  
  SecurityMiddleware.logSecurityEvent('test_payment_completed', {
    amount: 50000,
    method: 'cash'
  });
  
  console.log('Security events logged successfully');
}

// Comprehensive Security Test
export function runAllSecurityTests() {
  console.log('🚀 Starting Comprehensive Security Tests...\n');
  
  try {
    testAuthentication();
    console.log('');
    
    testInputValidation();
    console.log('');
    
    testSecurityMiddleware();
    console.log('');
    
    testFileUpload();
    console.log('');
    
    testRateLimiting();
    console.log('');
    
    testSecurityLogging();
    console.log('');
    
    console.log('✅ All security tests completed successfully!');
  } catch (error) {
    console.error('❌ Security test failed:', error);
  }
}

// Test specific security scenarios
export function testSecurityScenarios() {
  console.log('=== Testing Security Scenarios ===');
  
  // Scenario 1: XSS Attack Prevention
  console.log('Scenario 1: XSS Attack Prevention');
  const xssInput = '<script>alert("XSS")</script><img src="x" onerror="alert(\'XSS\')">';
  const sanitizedXss = sanitizeInput(xssInput);
  console.log('Original:', xssInput);
  console.log('Sanitized:', sanitizedXss);
  console.log('XSS prevented:', !sanitizedXss.includes('<script>'));
  
  // Scenario 2: SQL Injection Prevention
  console.log('\nScenario 2: SQL Injection Prevention');
  const sqlInput = "'; DROP TABLE users; --";
  const suspiciousSql = SecurityMiddleware.detectSuspiciousActivity('sql_test', sqlInput);
  console.log('SQL injection detected:', suspiciousSql);
  
  // Scenario 3: Brute Force Prevention
  console.log('\nScenario 3: Brute Force Prevention');
  for (let i = 0; i < 6; i++) {
    const loginAllowed = checkRateLimit('brute_force_test', 5, 60000);
    console.log(`Login attempt ${i + 1}: ${loginAllowed ? 'Allowed' : 'Blocked'}`);
  }
  
  // Scenario 4: Invalid Data Validation
  console.log('\nScenario 4: Invalid Data Validation');
  const invalidAmount = validateNumber('abc', { required: true, min: 0 });
  const invalidEmail = validateEmail('invalid-email');
  const invalidPassword = validatePassword('weak');
  
  console.log('Invalid amount validation:', invalidAmount);
  console.log('Invalid email validation:', invalidEmail);
  console.log('Invalid password validation:', invalidPassword);
}

// Export test functions for manual testing
export const SecurityTests = {
  testAuthentication,
  testInputValidation,
  testSecurityMiddleware,
  testFileUpload,
  testRateLimiting,
  testSecurityLogging,
  runAllSecurityTests,
  testSecurityScenarios
}; 