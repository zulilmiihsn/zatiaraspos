/**
 * Advanced cache manager with TTL, memory management, and performance monitoring
 * Optimizes data access and reduces memory usage
 */

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
	accessCount: number;
	lastAccessed: number;
}

interface CacheStats {
	hits: number;
	misses: number;
	size: number;
	memoryUsage: number;
	hitRate: number;
}

class CacheManager {
	private static instance: CacheManager;
	private cache: Map<string, CacheEntry<any>> = new Map();
	private stats: CacheStats = {
		hits: 0,
		misses: 0,
		size: 0,
		memoryUsage: 0,
		hitRate: 0
	};
	private maxSize: number = 1000; // Maximum cache entries
	private maxMemoryMB: number = 50; // Maximum memory usage in MB
	private cleanupInterval: number = 60000; // Cleanup every minute
	private cleanupTimer?: NodeJS.Timeout;

	private constructor() {
		this.startCleanupTimer();
	}

	static getInstance(): CacheManager {
		if (!CacheManager.instance) {
			CacheManager.instance = new CacheManager();
		}
		return CacheManager.instance;
	}

	/**
	 * Set cache entry with TTL
	 */
	set<T>(key: string, data: T, ttl: number = 300000): void {
		// Default 5 minutes
		// Check memory limit
		if (this.shouldEvict()) {
			this.evictOldest();
		}

		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl,
			accessCount: 0,
			lastAccessed: Date.now()
		};

		this.cache.set(key, entry);
		this.updateStats();
	}

	/**
	 * Get cache entry with access tracking
	 */
	get<T>(key: string): T | null {
		const entry = this.cache.get(key) as CacheEntry<T>;

		if (!entry) {
			this.stats.misses++;
			this.updateStats();
			return null;
		}

		// Check if expired
		if (this.isExpired(entry)) {
			this.cache.delete(key);
			this.stats.misses++;
			this.updateStats();
			return null;
		}

		// Update access stats
		entry.accessCount++;
		entry.lastAccessed = Date.now();
		this.stats.hits++;
		this.updateStats();

		return entry.data;
	}

	/**
	 * Check if entry exists and is valid
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;

		if (this.isExpired(entry)) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * Delete specific cache entry
	 */
	delete(key: string): boolean {
		const deleted = this.cache.delete(key);
		if (deleted) {
			this.updateStats();
		}
		return deleted;
	}

	/**
	 * Clear all cache
	 */
	clear(): void {
		this.cache.clear();
		this.resetStats();
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		return { ...this.stats };
	}

	/**
	 * Get memory usage estimate
	 */
	getMemoryUsage(): number {
		let totalSize = 0;
		for (const [key, entry] of this.cache) {
			totalSize += this.estimateSize(key) + this.estimateSize(entry.data);
		}
		return totalSize;
	}

	/**
	 * Set maximum cache size
	 */
	setMaxSize(size: number): void {
		this.maxSize = size;
		if (this.cache.size > size) {
			this.evictOldest();
		}
	}

	/**
	 * Set maximum memory usage
	 */
	setMaxMemory(memoryMB: number): void {
		this.maxMemoryMB = memoryMB;
		if (this.getMemoryUsage() > memoryMB * 1024 * 1024) {
			this.evictOldest();
		}
	}

	/**
	 * Preload data with priority
	 */
	async preload<T>(key: string, loader: () => Promise<T>, ttl: number = 300000): Promise<T> {
		try {
			const data = await loader();
			this.set(key, data, ttl);
			return data;
		} catch (error) {
			console.warn(`Failed to preload cache for key: ${key}`, error);
			throw error;
		}
	}

	/**
	 * Batch preload multiple entries
	 */
	async preloadBatch<T>(
		entries: Array<{ key: string; loader: () => Promise<T>; ttl?: number }>
	): Promise<void> {
		const promises = entries.map(({ key, loader, ttl }) =>
			this.preload(key, loader, ttl).catch(() => null)
		);

		await Promise.allSettled(promises);
	}

	private isExpired(entry: CacheEntry<any>): boolean {
		return Date.now() - entry.timestamp > entry.ttl;
	}

	private shouldEvict(): boolean {
		return (
			this.cache.size >= this.maxSize || this.getMemoryUsage() >= this.maxMemoryMB * 1024 * 1024
		);
	}

	private evictOldest(): void {
		if (this.cache.size === 0) return;

		// Find oldest and least accessed entries
		let oldestKey = '';
		let oldestTime = Date.now();
		let lowestAccess = Infinity;

		for (const [key, entry] of this.cache) {
			const age = Date.now() - entry.timestamp;
			if (age > oldestTime || (age === oldestTime && entry.accessCount < lowestAccess)) {
				oldestTime = age;
				lowestAccess = entry.accessCount;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
		}
	}

	private estimateSize(obj: any): number {
		if (obj === null || obj === undefined) return 0;

		const type = typeof obj;
		if (type === 'string') return obj.length * 2; // UTF-16
		if (type === 'number') return 8;
		if (type === 'boolean') return 4;
		if (type === 'object') {
			if (Array.isArray(obj)) {
				return obj.reduce((size, item) => size + this.estimateSize(item), 0);
			}
			return Object.keys(obj).reduce(
				(size, key) => size + this.estimateSize(key) + this.estimateSize(obj[key]),
				0
			);
		}

		return 0;
	}

	private updateStats(): void {
		this.stats.size = this.cache.size;
		this.stats.memoryUsage = this.getMemoryUsage();
		this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
	}

	private resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			size: 0,
			memoryUsage: 0,
			hitRate: 0
		};
	}

	private startCleanupTimer(): void {
		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, this.cleanupInterval);
	}

	private cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache) {
			if (this.isExpired(entry)) {
				this.cache.delete(key);
			}
		}
		this.updateStats();
	}

	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}
		this.clear();
	}
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();

// Utility functions for common cache operations
export const cacheUtils = {
	/**
	 * Cache with automatic TTL based on data type
	 */
	smartCache: <T>(
		key: string,
		data: T,
		type: 'user' | 'product' | 'transaction' | 'report'
	): void => {
		const ttlMap = {
			user: 300000, // 5 minutes
			product: 600000, // 10 minutes
			transaction: 180000, // 3 minutes
			report: 900000 // 15 minutes
		};

		cacheManager.set(key, data, ttlMap[type]);
	},

	/**
	 * Get or set cache with fallback
	 */
	getOrSet: async <T>(key: string, loader: () => Promise<T>, ttl: number = 300000): Promise<T> => {
		const cached = cacheManager.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		const data = await loader();
		cacheManager.set(key, data, ttl);
		return data;
	},

	/**
	 * Invalidate cache by pattern
	 */
	invalidatePattern: (pattern: string): void => {
		for (const key of cacheManager['cache'].keys()) {
			if (key.includes(pattern)) {
				cacheManager.delete(key);
			}
		}
	}
};
