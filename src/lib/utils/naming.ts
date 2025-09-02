/**
 * Naming convention utilities for consistent code style
 */

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
	return str
		.replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
		.replace(/^(.)/, (_, chr) => chr.toLowerCase());
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
	const camelCase = toCamelCase(str);
	return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/[\s_]+/g, '-')
		.toLowerCase();
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		.replace(/[\s-]+/g, '_')
		.toLowerCase();
}

/**
 * Convert database column names to camelCase for JavaScript
 */
export function dbColumnToJs(columnName: string): string {
	return toCamelCase(columnName);
}

/**
 * Convert JavaScript property names to database column names
 */
export function jsToDbColumn(propertyName: string): string {
	return toSnakeCase(propertyName);
}

/**
 * Convert API endpoint names to consistent format
 */
export function normalizeEndpoint(endpoint: string): string {
	return endpoint
		.replace(/^\/+/, '') // Remove leading slashes
		.replace(/\/+$/, '') // Remove trailing slashes
		.replace(/\/+/g, '/'); // Normalize multiple slashes
}

/**
 * Generate consistent ID names
 */
export function generateIdName(baseName: string, suffix?: string): string {
	const normalized = toCamelCase(baseName);
	return suffix ? `${normalized}${toPascalCase(suffix)}` : normalized;
}

/**
 * Generate consistent function names
 */
export function generateFunctionName(action: string, target: string, prefix?: string): string {
	const actionName = toCamelCase(action);
	const targetName = toCamelCase(target);
	const prefixName = prefix ? toCamelCase(prefix) : '';

	if (prefixName) {
		return `${prefixName}${toPascalCase(actionName)}${toPascalCase(targetName)}`;
	}

	return `${actionName}${toPascalCase(targetName)}`;
}

/**
 * Generate consistent variable names
 */
export function generateVariableName(type: string, name: string, suffix?: string): string {
	const typeName = toCamelCase(type);
	const nameName = toCamelCase(name);
	const suffixName = suffix ? toCamelCase(suffix) : '';

	if (suffixName) {
		return `${typeName}${toPascalCase(nameName)}${toPascalCase(suffixName)}`;
	}

	return `${typeName}${toPascalCase(nameName)}`;
}

/**
 * Generate consistent constant names
 */
export function generateConstantName(category: string, name: string): string {
	return `${toSnakeCase(category).toUpperCase()}_${toSnakeCase(name).toUpperCase()}`;
}

/**
 * Generate consistent CSS class names
 */
export function generateCssClass(baseClass: string, modifier?: string, state?: string): string {
	const base = toKebabCase(baseClass);
	const mod = modifier ? `--${toKebabCase(modifier)}` : '';
	const st = state ? `--${toKebabCase(state)}` : '';

	return `${base}${mod}${st}`;
}

/**
 * Generate consistent event handler names
 */
export function generateEventHandlerName(event: string, action: string, target?: string): string {
	const eventName = toCamelCase(event);
	const actionName = toCamelCase(action);
	const targetName = target ? toCamelCase(target) : '';

	if (targetName) {
		return `handle${toPascalCase(eventName)}${toPascalCase(actionName)}${toPascalCase(targetName)}`;
	}

	return `handle${toPascalCase(eventName)}${toPascalCase(actionName)}`;
}

/**
 * Generate consistent store names
 */
export function generateStoreName(
	name: string,
	type: 'store' | 'derived' | 'writable' = 'store'
): string {
	const nameName = toCamelCase(name);
	const typeName = toPascalCase(type);

	return `${nameName}${typeName}`;
}

/**
 * Generate consistent API function names
 */
export function generateApiFunctionName(method: string, resource: string, action?: string): string {
	const methodName = toCamelCase(method);
	const resourceName = toCamelCase(resource);
	const actionName = action ? toCamelCase(action) : '';

	if (actionName) {
		return `${methodName}${toPascalCase(resourceName)}${toPascalCase(actionName)}`;
	}

	return `${methodName}${toPascalCase(resourceName)}`;
}

/**
 * Generate consistent form field names
 */
export function generateFormFieldName(form: string, field: string): string {
	const formName = toCamelCase(form);
	const fieldName = toCamelCase(field);

	return `${formName}${toPascalCase(fieldName)}`;
}

/**
 * Generate consistent modal names
 */
export function generateModalName(action: string, target: string): string {
	const actionName = toCamelCase(action);
	const targetName = toCamelCase(target);

	return `show${toPascalCase(actionName)}${toPascalCase(targetName)}Modal`;
}

/**
 * Generate consistent state variable names
 */
export function generateStateName(base: string, state: string): string {
	const baseName = toCamelCase(base);
	const stateName = toCamelCase(state);

	return `${baseName}${toPascalCase(stateName)}`;
}

/**
 * Generate consistent loading state names
 */
export function generateLoadingName(action: string, target: string): string {
	const actionName = toCamelCase(action);
	const targetName = toCamelCase(target);

	return `loading${toPascalCase(actionName)}${toPascalCase(targetName)}`;
}

/**
 * Generate consistent error state names
 */
export function generateErrorName(action: string, target: string): string {
	const actionName = toCamelCase(action);
	const targetName = toCamelCase(target);

	return `error${toPascalCase(actionName)}${toPascalCase(targetName)}`;
}

/**
 * Generate consistent success state names
 */
export function generateSuccessName(action: string, target: string): string {
	const actionName = toCamelCase(action);
	const targetName = toCamelCase(target);

	return `success${toPascalCase(actionName)}${toPascalCase(targetName)}`;
}
