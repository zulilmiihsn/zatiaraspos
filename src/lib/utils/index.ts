/**
 * 🚀 UTILITIES INDEX - OPTIMIZED FOR PERFORMANCE
 * 
 * Named exports untuk menghindari barrel export yang tidak optimal
 * Tree shaking friendly dan build time yang lebih cepat
 */

// DateTime utilities
export { 
	utcToWita, 
	witaToUtc, 
	getWitaDateRangeUtc, 
	formatWitaDateTime, 
	witaToUtcISO 
} from './dateTime';

// UI utilities
export { 
	createToastManager, 
	createSmoothScroll 
} from './ui';

// Error handling utilities
export { ErrorHandler, createErrorBoundary, ValidationHelper } from './errorHandling';

// Naming convention utilities
export { 
	toPascalCase, 
	toCamelCase, 
	toKebabCase, 
	toSnakeCase,
	dbColumnToJs,
	jsToDbColumn,
	normalizeEndpoint,
	generateIdName,
	generateFunctionName,
	generateVariableName,
	generateEventHandlerName,
	generateStoreName,
	generateApiFunctionName,
	generateFormFieldName,
	generateModalName,
	generateStateName,
	generateLoadingName,
	generateErrorName,
	generateSuccessName
} from './naming';

// Performance optimization utilities
export { cacheManager, cacheUtils } from './cacheManager';
export { performanceMonitor, performanceUtils } from './performanceMonitor';
export { routeLoader, routeUtils } from './routeLoader';

// Security utilities
export {
	csrfProtection,
	securityUtils,
	CSRFProtection,
	XSSProtection,
	InputValidation,
	RateLimiter,
	LoginSecurity,
	SessionSecurity
} from './security';


