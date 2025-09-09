/**
 * 🚀 ADVANCED CACHING SYSTEM
 * Multi-layer caching dengan intelligent invalidation dan background refresh
 */

import * as pako from 'pako';

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
	etag?: string;
	version: number;
	accessCount: number;
	lastAccessed: number;
}

interface CacheConfig {
	maxSize: number;
	defaultTTL: number;
	backgroundRefresh: boolean;
	compression: boolean;
	persistence: boolean;
}

interface CacheStats {
	hits: number;
	misses: number;
	evictions: number;
	size: number;
	hitRate: number;
}

export class AdvancedCache {
	private static instance: AdvancedCache;
	private memoryCache = new Map<string, CacheEntry<any>>();
	private config: CacheConfig;
	private stats: CacheStats;
	private backgroundRefreshQueue = new Set<string>();
	private compressionEnabled: boolean;

	private constructor() {
		this.config = {
			maxSize: 1000,
			defaultTTL: 5 * 60 * 1000, // 5 minutes
			backgroundRefresh: true,
			compression: true,
			persistence: true
		};

		this.stats = {
			hits: 0,
			misses: 0,
			evictions: 0,
			size: 0,
			hitRate: 0
		};

		this.compressionEnabled = this.config.compression && typeof window !== 'undefined';

		// Initialize persistence
		if (this.config.persistence && typeof window !== 'undefined') {
			this.loadFromStorage();
		}
	}

	static getInstance(): AdvancedCache {
		if (!AdvancedCache.instance) {
			AdvancedCache.instance = new AdvancedCache();
		}
		return AdvancedCache.instance;
	}

	/**
	 * Get data with intelligent caching
	 */
	async get<T>(
		key: string,
		fetcher: () => Promise<T>,
		options: {
			ttl?: number;
			backgroundRefresh?: boolean;
			etag?: string;
			forceRefresh?: boolean;
			compression?: boolean;
		} = {}
	): Promise<T> {
		const {
			ttl = this.config.defaultTTL,
			backgroundRefresh = this.config.backgroundRefresh,
			etag,
			forceRefresh = false,
			compression = this.config.compression
		} = options;

		// Check cache first (unless force refresh)
		if (!forceRefresh) {
			const cached = this.getFromCache<T>(key);
			if (cached !== null) {
				this.stats.hits++;
				this.updateStats();

				// Trigger background refresh if enabled
				if (backgroundRefresh && this.shouldBackgroundRefresh(key)) {
					this.scheduleBackgroundRefresh(key, fetcher, ttl, etag, compression);
				}

				return cached;
			}
		}

		this.stats.misses++;
		this.updateStats();

		// Fetch fresh data
		const freshData = await fetcher();

		// Store in cache
		this.set(key, freshData, { ttl, etag, compression });

		return freshData;
	}

	/**
	 * Set data in cache with compression
	 */
	set<T>(
		key: string,
		data: T,
		options: {
			ttl?: number;
			etag?: string;
			compression?: boolean;
		} = {}
	): void {
		const { ttl = this.config.defaultTTL, etag, compression = this.config.compression } = options;

		// Compress data if enabled
		const processedData = compression && this.compressionEnabled ? this.compress(data) : data;

		const entry: CacheEntry<T> = {
			data: processedData,
			timestamp: Date.now(),
			ttl,
			etag,
			version: 1,
			accessCount: 1,
			lastAccessed: Date.now()
		};

		// Check if we need to evict
		if (this.memoryCache.size >= this.config.maxSize) {
			this.evictLRU();
		}

		this.memoryCache.set(key, entry);
		this.stats.size = this.memoryCache.size;

		// Persist to storage
		if (this.config.persistence && typeof window !== 'undefined') {
			this.saveToStorage();
		}
	}

	/**
	 * Get data from cache with decompression
	 */
	private getFromCache<T>(key: string): T | null {
		const entry = this.memoryCache.get(key);

		if (!entry) {
			return null;
		}

		// Check if expired
		if (this.isExpired(entry)) {
			this.memoryCache.delete(key);
			this.stats.evictions++;
			return null;
		}

		// Update access stats
		entry.accessCount++;
		entry.lastAccessed = Date.now();

		// Decompress if needed
		return this.compressionEnabled ? this.decompress(entry.data) : entry.data;
	}

	/**
	 * Background refresh for stale data
	 */
	private async scheduleBackgroundRefresh<T>(
		key: string,
		fetcher: () => Promise<T>,
		ttl: number,
		etag?: string,
		compression?: boolean
	): Promise<void> {
		if (this.backgroundRefreshQueue.has(key)) {
			return; // Already scheduled
		}

		this.backgroundRefreshQueue.add(key);

		try {
			const freshData = await fetcher();
			this.set(key, freshData, { ttl, etag, compression });
		} catch (error) {
			// Silently fail background refresh
		} finally {
			this.backgroundRefreshQueue.delete(key);
		}
	}

	/**
	 * Check if background refresh should be triggered
	 */
	private shouldBackgroundRefresh(key: string): boolean {
		const entry = this.memoryCache.get(key);
		if (!entry) return false;

		const age = Date.now() - entry.timestamp;
		const refreshThreshold = entry.ttl * 0.8; // Refresh at 80% of TTL

		return age > refreshThreshold;
	}

	/**
	 * Evict least recently used entry
	 */
	private evictLRU(): void {
		let oldestKey = '';
		let oldestTime = Date.now();

		for (const [key, entry] of this.memoryCache.entries()) {
			if (entry.lastAccessed < oldestTime) {
				oldestTime = entry.lastAccessed;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.memoryCache.delete(oldestKey);
			this.stats.evictions++;
		}
	}

	/**
	 * Check if entry is expired
	 */
	private isExpired(entry: CacheEntry<any>): boolean {
		return Date.now() - entry.timestamp > entry.ttl;
	}

	/**
	 * Compress data using pako
	 */
	private compress<T>(data: T): any {
		if (!this.compressionEnabled) return data;

		try {
			const jsonString = JSON.stringify(data);
			const compressed = pako.gzip(jsonString);
			return compressed;
		} catch {
			return data; // Fallback to uncompressed
		}
	}

	/**
	 * Decompress data using pako
	 */
	private decompress<T>(data: any): T {
		if (!this.compressionEnabled || !(data instanceof Uint8Array)) {
			return data as T;
		}

		try {
			const decompressed = pako.ungzip(data, { to: 'string' });
			return JSON.parse(decompressed) as T;
		} catch {
			return data as T; // Fallback to original data
		}
	}

	/**
	 * Save cache to localStorage
	 */
	private saveToStorage(): void {
		try {
			const cacheData = Array.from(this.memoryCache.entries());
			localStorage.setItem('zatiaras_advanced_cache', JSON.stringify(cacheData));
		} catch {
			// Silently fail if storage is full
		}
	}

	/**
	 * Load cache from localStorage
	 */
	private loadFromStorage(): void {
		try {
			const stored = localStorage.getItem('zatiaras_advanced_cache');
			if (stored) {
				const cacheData = JSON.parse(stored);
				this.memoryCache = new Map(cacheData);
				this.stats.size = this.memoryCache.size;
			}
		} catch {
			// Silently fail if storage is corrupted
		}
	}

	/**
	 * Update cache statistics
	 */
	private updateStats(): void {
		const total = this.stats.hits + this.stats.misses;
		this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		return { ...this.stats };
	}

	/**
	 * Clear all cache
	 */
	clear(): void {
		this.memoryCache.clear();
		this.backgroundRefreshQueue.clear();
		this.stats = {
			hits: 0,
			misses: 0,
			evictions: 0,
			size: 0,
			hitRate: 0
		};

		if (typeof window !== 'undefined') {
			localStorage.removeItem('zatiaras_advanced_cache');
		}
	}

	/**
	 * Invalidate specific key
	 */
	invalidate(key: string): void {
		this.memoryCache.delete(key);
		this.backgroundRefreshQueue.delete(key);
		this.stats.size = this.memoryCache.size;
	}

	/**
	 * Invalidate keys matching pattern
	 */
	invalidatePattern(pattern: RegExp): void {
		for (const key of this.memoryCache.keys()) {
			if (pattern.test(key)) {
				this.memoryCache.delete(key);
				this.backgroundRefreshQueue.delete(key);
			}
		}
		this.stats.size = this.memoryCache.size;
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<CacheConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}
}

// Export singleton instance
export const advancedCache = AdvancedCache.getInstance();

// Cache key generators
export const cacheKeys = {
	products: (branch?: string) => `products_${branch || 'default'}`,
	categories: (branch?: string) => `categories_${branch || 'default'}`,
	addOns: (branch?: string) => `addons_${branch || 'default'}`,
	reportData: (date: string, type: string, branch?: string) =>
		`report_${type}_${date}_${branch || 'default'}`,
	transactionData: (date: string, branch?: string) => `transactions_${date}_${branch || 'default'}`,
	userProfile: (userId: string) => `user_${userId}`,
	aiAnalysis: (text: string) => `ai_${btoa(text).slice(0, 20)}`
};
