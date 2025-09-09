/**
 * 🚀 LAZY LOADING UTILITIES
 * Dynamic imports dan code splitting untuk optimal bundle size
 */

interface LazyComponent {
	component: any;
	loading: boolean;
	error: Error | null;
}

interface LazyModule {
	module: any;
	loading: boolean;
	error: Error | null;
}

// Component cache untuk menghindari re-import
const componentCache = new Map<string, LazyComponent>();
const moduleCache = new Map<string, LazyModule>();

/**
 * Lazy load Svelte component
 */
export async function lazyLoadComponent(
	importFn: () => Promise<any>,
	cacheKey?: string
): Promise<any> {
	const key = cacheKey || importFn.toString();

	// Check cache first
	if (componentCache.has(key)) {
		const cached = componentCache.get(key)!;
		if (cached.component && !cached.loading && !cached.error) {
			return cached.component;
		}
	}

	// Set loading state
	componentCache.set(key, {
		component: null,
		loading: true,
		error: null
	});

	try {
		const module = await importFn();
		const component = module.default || module;

		// Cache successful result
		componentCache.set(key, {
			component,
			loading: false,
			error: null
		});

		return component;
	} catch (error) {
		// Cache error
		componentCache.set(key, {
			component: null,
			loading: false,
			error: error as Error
		});

		throw error;
	}
}

/**
 * Lazy load ES module
 */
export async function lazyLoadModule(
	importFn: () => Promise<any>,
	cacheKey?: string
): Promise<any> {
	const key = cacheKey || importFn.toString();

	// Check cache first
	if (moduleCache.has(key)) {
		const cached = moduleCache.get(key)!;
		if (cached.module && !cached.loading && !cached.error) {
			return cached.module;
		}
	}

	// Set loading state
	moduleCache.set(key, {
		module: null,
		loading: true,
		error: null
	});

	try {
		const module = await importFn();

		// Cache successful result
		moduleCache.set(key, {
			module,
			loading: false,
			error: null
		});

		return module;
	} catch (error) {
		// Cache error
		moduleCache.set(key, {
			module: null,
			loading: false,
			error: error as Error
		});

		throw error;
	}
}

/**
 * Preload components untuk faster navigation
 */
export async function preloadComponents(
	components: Array<{
		name: string;
		importFn: () => Promise<any>;
	}>
): Promise<void> {
	const preloadPromises = components.map(({ name, importFn }) =>
		lazyLoadComponent(importFn, name).catch(() => {
			// Silently fail preloading
		})
	);

	await Promise.allSettled(preloadPromises);
}

/**
 * Preload modules untuk faster access
 */
export async function preloadModules(
	modules: Array<{
		name: string;
		importFn: () => Promise<any>;
	}>
): Promise<void> {
	const preloadPromises = modules.map(({ name, importFn }) =>
		lazyLoadModule(importFn, name).catch(() => {
			// Silently fail preloading
		})
	);

	await Promise.allSettled(preloadPromises);
}

/**
 * Lazy load dengan retry mechanism
 */
export async function lazyLoadWithRetry<T>(
	importFn: () => Promise<T>,
	maxRetries: number = 3,
	delay: number = 1000
): Promise<T> {
	let lastError: Error;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await importFn();
		} catch (error) {
			lastError = error as Error;

			if (attempt < maxRetries) {
				// Wait before retry
				await new Promise((resolve) => setTimeout(resolve, delay * attempt));
			}
		}
	}

	throw lastError!;
}

/**
 * Conditional lazy loading berdasarkan feature flags
 */
export async function conditionalLazyLoad<T>(
	condition: boolean,
	importFn: () => Promise<T>,
	fallback?: T
): Promise<T | undefined> {
	if (!condition) {
		return fallback;
	}

	return lazyLoadWithRetry(importFn);
}

/**
 * Lazy load dengan loading state management
 */
export class LazyLoader {
	private loadingStates = new Map<string, boolean>();
	private errorStates = new Map<string, Error | null>();

	async load<T>(key: string, importFn: () => Promise<T>): Promise<T> {
		// Set loading state
		this.loadingStates.set(key, true);
		this.errorStates.set(key, null);

		try {
			const result = await importFn();
			this.loadingStates.set(key, false);
			return result;
		} catch (error) {
			this.loadingStates.set(key, false);
			this.errorStates.set(key, error as Error);
			throw error;
		}
	}

	isLoading(key: string): boolean {
		return this.loadingStates.get(key) || false;
	}

	getError(key: string): Error | null {
		return this.errorStates.get(key) || null;
	}

	clearState(key: string): void {
		this.loadingStates.delete(key);
		this.errorStates.delete(key);
	}

	clearAllStates(): void {
		this.loadingStates.clear();
		this.errorStates.clear();
	}
}

// Export singleton instance
export const lazyLoader = new LazyLoader();

/**
 * Predefined lazy components untuk common use cases
 */
export const lazyComponents = {
	// AI Chat Modal
	aiChatModal: () =>
		lazyLoadComponent(() => import('$lib/components/shared/aiChatModal.svelte'), 'aiChatModal'),

	// POS Components (placeholder - adjust paths as needed)
	posGrid: () =>
		lazyLoadComponent(() => import('$lib/components/shared/modalSheet.svelte'), 'posGrid'),

	posCart: () =>
		lazyLoadComponent(() => import('$lib/components/shared/modalSheet.svelte'), 'posCart'),

	// Report Components (placeholder - adjust paths as needed)
	reportChart: () =>
		lazyLoadComponent(() => import('$lib/components/shared/modalSheet.svelte'), 'reportChart'),

	reportTable: () =>
		lazyLoadComponent(() => import('$lib/components/shared/modalSheet.svelte'), 'reportTable'),

	// Settings Components (placeholder - adjust paths as needed)
	settingsForm: () =>
		lazyLoadComponent(() => import('$lib/components/shared/modalSheet.svelte'), 'settingsForm'),

	// Modal Components
	modalSheet: () =>
		lazyLoadComponent(() => import('$lib/components/shared/modalSheet.svelte'), 'modalSheet'),

	pinModal: () =>
		lazyLoadComponent(() => import('$lib/components/shared/pinModal.svelte'), 'pinModal')
};

/**
 * Predefined lazy modules untuk services
 */
export const lazyModules = {
	// AI Services
	aiAnalysisService: () =>
		lazyLoadModule(() => import('$lib/services/aiAnalysisService'), 'aiAnalysisService'),

	autoApplyService: () =>
		lazyLoadModule(() => import('$lib/services/autoApplyService'), 'autoApplyService'),

	productAnalysisService: () =>
		lazyLoadModule(() => import('$lib/services/productAnalysisService'), 'productAnalysisService'),

	// Data Services
	optimizedDataService: () =>
		lazyLoadModule(() => import('$lib/services/optimizedDataService'), 'optimizedDataService'),

	// Utils
	advancedCache: () => lazyLoadModule(() => import('$lib/utils/advancedCache'), 'advancedCache'),

	performanceMonitor: () =>
		lazyLoadModule(() => import('$lib/utils/performanceMonitor'), 'performanceMonitor')
};

/**
 * Preload critical components untuk faster initial load
 */
export async function preloadCriticalComponents(): Promise<void> {
	const criticalComponents = [
		{ name: 'topBar', importFn: () => import('$lib/components/shared/topBar.svelte') },
		{ name: 'bottomNav', importFn: () => import('$lib/components/shared/bottomNav.svelte') },
		{ name: 'modalSheet', importFn: () => import('$lib/components/shared/modalSheet.svelte') }
	];

	await preloadComponents(criticalComponents);
}

/**
 * Preload feature-specific components berdasarkan route
 */
export async function preloadRouteComponents(route: string): Promise<void> {
	const routeComponents: { [key: string]: Array<{ name: string; importFn: () => Promise<any> }> } =
		{
			'/pos': [
				{ name: 'posGrid', importFn: () => import('$lib/components/shared/modalSheet.svelte') },
				{ name: 'posCart', importFn: () => import('$lib/components/shared/modalSheet.svelte') }
			],
			'/laporan': [
				{ name: 'reportChart', importFn: () => import('$lib/components/shared/modalSheet.svelte') },
				{ name: 'reportTable', importFn: () => import('$lib/components/shared/modalSheet.svelte') }
			],
			'/pengaturan': [
				{ name: 'settingsForm', importFn: () => import('$lib/components/shared/modalSheet.svelte') }
			]
		};

	const components = routeComponents[route];
	if (components) {
		await preloadComponents(components);
	}
}
