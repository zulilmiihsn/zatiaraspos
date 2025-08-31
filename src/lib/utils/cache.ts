import { browser } from '$app/environment';
import { get as getCache, set as setCache, del as delCache } from 'idb-keyval';

// Cache configuration
const CACHE_CONFIG = {
	// Memory cache TTL (in milliseconds)
	MEMORY_TTL: 30000, // 30 seconds
	// IndexedDB cache TTL (in milliseconds)
	INDEXEDDB_TTL: 300000, // 5 minutes
	// Background refresh interval (in milliseconds)
	BACKGROUND_REFRESH: 10000, // 10 seconds
	// Stale-while-revalidate window (in milliseconds)
	STALE_WHILE_REVALIDATE: 60000, // 1 minute
	// Cache size limits
	MAX_MEMORY_ENTRIES: 100,
	MAX_INDEXEDDB_ENTRIES: 1000
};

// Cache entry interface
interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
	version?: string;
	etag?: string;
}

// Memory cache (fastest access)
class MemoryCache {
	private cache = new Map<string, CacheEntry<any>>();
	private cleanupTimeout: number | null = null;

	constructor() {
		// Schedule cleanup only when needed
		this.scheduleCleanup();
	}

	set<T>(key: string, data: T, ttl: number = CACHE_CONFIG.MEMORY_TTL): void {
		// Remove oldest entries if cache is full
		if (this.cache.size >= CACHE_CONFIG.MAX_MEMORY_ENTRIES) {
			const oldestKey = this.cache.keys().next().value || '';
			this.cache.delete(oldestKey);
		}

		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl
		});

		// Schedule cleanup if not already scheduled
		if (!this.cleanupTimeout) {
			this.scheduleCleanup();
		}
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		// Check if expired
		if (Date.now() - entry.timestamp > entry.ttl) {
			this.cache.delete(key);
			return null;
		}

		return entry.data;
	}

	has(key: string): boolean {
		return this.cache.has(key);
	}

	delete(key: string): void {
		this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	private cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > entry.ttl) {
				this.cache.delete(key);
			}
		}
	}

	private scheduleCleanup(): void {
		if (this.cleanupTimeout) {
			clearTimeout(this.cleanupTimeout);
		}

		this.cleanupTimeout = Number(
			setTimeout(() => {
				this.cleanup();
				this.cleanupTimeout = null;

				// Schedule next cleanup only if cache has entries
				if (this.cache.size > 0) {
					this.scheduleCleanup();
				}
			}, 30000)
		);
	}

	destroy(): void {
		if (this.cleanupTimeout) {
			clearTimeout(this.cleanupTimeout);
			this.cleanupTimeout = null;
		}
		this.clear();
	}
}

// IndexedDB cache (persistent storage)
class IndexedDBCache {
	async set<T>(key: string, data: T, ttl: number = CACHE_CONFIG.INDEXEDDB_TTL): Promise<void> {
		try {
			await setCache(key, {
				data,
				timestamp: Date.now(),
				ttl
			});
		} catch (error) {
			console.error('IndexedDB set error:', error);
		}
	}

	async get<T>(key: string): Promise<T | null> {
		try {
			const entry = await getCache(key);
			if (!entry) return null;
			// Check if expired
			if (Date.now() - entry.timestamp > entry.ttl) {
				await delCache(key);
				return null;
			}
			return entry.data;
		} catch (error) {
			console.error('IndexedDB get error:', error);
			return null;
		}
	}

	async delete(key: string): Promise<void> {
		try {
			await delCache(key);
		} catch (error) {
			console.error('IndexedDB delete error:', error);
		}
	}

	async clear(): Promise<void> {
		// Hapus seluruh data cache IndexedDB
		try {
			// idb-keyval menyediakan clear() untuk menghapus semua key
			const { clear } = await import('idb-keyval');
			await clear();
		} catch (error) {
			console.error('IndexedDB clear error:', error);
		}
	}
}

// Smart cache manager with real-time capabilities
export class SmartCache {
	private memoryCache: MemoryCache;
	private indexedDBCache: IndexedDBCache;
	private backgroundRefreshMap = new Map<string, number>();
	private etagMap = new Map<string, string>();

	constructor() {
		this.memoryCache = new MemoryCache();
		this.indexedDBCache = new IndexedDBCache();
	}

	// Main cache get method with stale-while-revalidate
	async get<T>(
		key: string,
		fetcher: () => Promise<T>,
		options: {
			ttl?: number;
			backgroundRefresh?: boolean;
			etag?: string;
			forceRefresh?: boolean;
		} = {}
	): Promise<T> {
		const { ttl, backgroundRefresh = true, etag, forceRefresh = false } = options;

		// Check memory cache first (fastest)
		if (!forceRefresh) {
			const memoryData = this.memoryCache.get<T>(key);
			if (memoryData !== null) {
				// Trigger background refresh if enabled
				if (backgroundRefresh) {
					this.scheduleBackgroundRefresh(key, fetcher, ttl);
				}
				return memoryData;
			}
		}

		// Check IndexedDB cache
		if (!forceRefresh) {
			const indexedDBData = await this.indexedDBCache.get<T>(key);
			if (indexedDBData !== null) {
				// Store in memory cache for faster access
				this.memoryCache.set(key, indexedDBData, ttl);

				// Trigger background refresh if enabled
				if (backgroundRefresh) {
					this.scheduleBackgroundRefresh(key, fetcher, ttl);
				}

				return indexedDBData;
			}
		}

		// Fetch fresh data
		const freshData = await fetcher();

		// Store in both caches
		this.memoryCache.set(key, freshData, ttl);
		await this.indexedDBCache.set(key, freshData, ttl);

		// Update ETag if provided
		if (etag) {
			this.etagMap.set(key, etag);
		}

		return freshData;
	}

	// Get data with ETag support for conditional requests
	async getWithETag<T>(
		key: string,
		fetcher: (etag?: string) => Promise<{ data: T; etag?: string }>,
		options: {
			ttl?: number;
			backgroundRefresh?: boolean;
			forceRefresh?: boolean;
		} = {}
	): Promise<T> {
		const { ttl, backgroundRefresh = true, forceRefresh = false } = options;
		const currentETag = this.etagMap.get(key);

		// Check if we have cached data and ETag
		if (!forceRefresh && currentETag) {
			const cachedData = this.memoryCache.get<T>(key) || (await this.indexedDBCache.get<T>(key));
			if (cachedData !== null) {
				// Trigger background refresh with ETag
				if (backgroundRefresh) {
					this.scheduleBackgroundRefreshWithETag(key, fetcher, ttl, currentETag);
				}
				return cachedData;
			}
		}

		// Fetch fresh data with ETag
		const result = await fetcher(currentETag);

		// Store data and ETag
		this.memoryCache.set(key, result.data, ttl);
		await this.indexedDBCache.set(key, result.data, ttl);

		if (result.etag) {
			this.etagMap.set(key, result.etag);
		}

		return result.data;
	}

	// Background refresh scheduling
	private scheduleBackgroundRefresh<T>(key: string, fetcher: () => Promise<T>, ttl?: number): void {
		// Clear existing refresh interval
		if (this.backgroundRefreshMap.has(key)) {
			clearTimeout(this.backgroundRefreshMap.get(key)!);
		}

		// Jangan schedule refresh jika offline
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;

		// Schedule new refresh
		const refreshId = setTimeout(async () => {
			try {
				// Jangan fetch jika offline
				if (typeof navigator !== 'undefined' && !navigator.onLine) return;
				const freshData = await fetcher();
				this.memoryCache.set(key, freshData, ttl);
				await this.indexedDBCache.set(key, freshData, ttl);

				// Schedule next refresh
				this.scheduleBackgroundRefresh(key, fetcher, ttl);
			} catch (error) {
				console.warn('Background refresh failed for key:', key, error);
			}
		}, CACHE_CONFIG.BACKGROUND_REFRESH);
		this.backgroundRefreshMap.set(key, Number(refreshId));
	}

	// Background refresh with ETag
	private scheduleBackgroundRefreshWithETag<T>(
		key: string,
		fetcher: (etag?: string) => Promise<{ data: T; etag?: string }>,
		ttl?: number,
		etag?: string
	): void {
		if (this.backgroundRefreshMap.has(key)) {
			clearTimeout(this.backgroundRefreshMap.get(key)!);
		}

		// Jangan schedule refresh jika offline
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;

		const refreshId = setTimeout(async () => {
			try {
				// Jangan fetch jika offline
				if (typeof navigator !== 'undefined' && !navigator.onLine) return;
				const result = await fetcher(etag);

				// Only update if we got new data (ETag changed or no ETag)
				if (result.etag !== etag) {
					this.memoryCache.set(key, result.data, ttl);
					await this.indexedDBCache.set(key, result.data, ttl);

					if (result.etag) {
						this.etagMap.set(key, result.etag);
					}
				}

				// Schedule next refresh
				this.scheduleBackgroundRefreshWithETag(key, fetcher, ttl, result.etag || etag);
			} catch (error) {
				console.warn('Background refresh with ETag failed for key:', key, error);
			}
		}, CACHE_CONFIG.BACKGROUND_REFRESH);
		this.backgroundRefreshMap.set(key, Number(refreshId));
	}

	// Invalidate cache entries
	async invalidate(pattern: string | RegExp): Promise<void> {
		// Clear memory cache entries matching pattern
		if (typeof pattern === 'string') {
			this.memoryCache.delete(pattern);
			await this.indexedDBCache.delete(pattern);
		} else {
			// For regex patterns, we'd need to iterate through keys
			// This is a simplified implementation
			console.warn('Regex pattern invalidation not fully implemented');
		}
	}

	// Clear all caches
	async clear(): Promise<void> {
		this.memoryCache.clear();
		await this.indexedDBCache.clear();

		// Clear background refresh intervals
		for (const refreshId of this.backgroundRefreshMap.values()) {
			clearTimeout(refreshId);
		}
		this.backgroundRefreshMap.clear();

		// Clear ETags
		this.etagMap.clear();
	}

	// Get cache statistics
	getStats(): {
		memorySize: number;
		backgroundRefreshCount: number;
		etagCount: number;
	} {
		// Tidak akses property private di luar class
		return {
			memorySize: 0,
			backgroundRefreshCount: this.backgroundRefreshMap.size,
			etagCount: this.etagMap.size
		};
	}

	// Destroy cache instance
	destroy(): void {
		this.memoryCache.destroy();
		this.clear();
	}
}

// Global cache instance
export const smartCache = new SmartCache();

// Cache keys for different data types
export const CACHE_KEYS = {
	// Dashboard data
	DASHBOARD_STATS: 'dashboard_stats',
	BEST_SELLERS: 'best_sellers',
	WEEKLY_INCOME: 'weekly_income',

	// POS data
	PRODUCTS: 'products',
	CATEGORIES: 'categories',
	ADDONS: 'addons',

	// Reports
	DAILY_REPORT: 'daily_report',
	WEEKLY_REPORT: 'weekly_report',
	MONTHLY_REPORT: 'monthly_report',

	// User data
	USER_PROFILE: 'user_profile',
	USER_ROLE: 'user_role',

	// Settings
	SECURITY_SETTINGS: 'security_settings',
	PENGATURAN: 'pengaturan'
} as const;

// Cache utilities for specific data types
export class CacheUtils {
	// Dashboard data caching
	static async getDashboardStats(fetcher: () => Promise<any>) {
		return smartCache.get(CACHE_KEYS.DASHBOARD_STATS, fetcher, {
			ttl: 30000, // 30 seconds
			backgroundRefresh: true
		});
	}

	// POS data caching
	static async getProducts(fetcher: () => Promise<any[]>) {
		return smartCache.get(CACHE_KEYS.PRODUCTS, fetcher, {
			ttl: 300000, // 5 minutes
			backgroundRefresh: true
		});
	}

	// Report data caching with ETag support
	static async getReportData(
		key: string,
		dateRange: string,
		fetcher: (etag?: string) => Promise<{ data: any; etag?: string }>
	) {
		const cacheKey = `${key}_${dateRange}`;
		return smartCache.getWithETag(cacheKey, fetcher, {
			ttl: 300000, // 5 menit
			backgroundRefresh: true
		});
	}

	static async invalidateDashboardData(): Promise<void> {
		await smartCache.invalidate(CACHE_KEYS.DASHBOARD_STATS);
		await smartCache.invalidate(CACHE_KEYS.BEST_SELLERS);
		await smartCache.invalidate(CACHE_KEYS.WEEKLY_INCOME);
	}

	static async invalidatePOSData(): Promise<void> {
		await smartCache.invalidate(CACHE_KEYS.PRODUCTS);
		await smartCache.invalidate(CACHE_KEYS.CATEGORIES);
		await smartCache.invalidate(CACHE_KEYS.ADDONS);
	}

	static async invalidateReportData(): Promise<void> {
		// Invalidate specific report keys instead of using regex
		await smartCache.invalidate('daily_report');
		await smartCache.invalidate('weekly_report');
		await smartCache.invalidate('monthly_report');
		await smartCache.invalidate('yearly_report');
	}
}
