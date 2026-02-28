import { smartCache, CacheUtils } from '$lib/utils/cache';

const localMirror = new Map<string, { value: unknown; expiresAt: number }>();

function isExpired(entry: { expiresAt: number }): boolean {
	return Date.now() > entry.expiresAt;
}

/**
 * @deprecated Use `smartCache` / `CacheUtils` from `$lib/utils/cache`.
 * Compatibility shim kept to avoid breaking old imports.
 */
export const cacheManager = {
	set: <T>(key: string, data: T, ttl: number = 300000): void => {
		localMirror.set(key, { value: data, expiresAt: Date.now() + ttl });
		void smartCache.get(
			key,
			async () => data,
			{ ttl, forceRefresh: true, backgroundRefresh: false }
		);
	},
	get: <T>(key: string): T | null => {
		const entry = localMirror.get(key);
		if (!entry || isExpired(entry)) {
			localMirror.delete(key);
			return null;
		}
		return entry.value as T;
	},
	has: (key: string): boolean => {
		const entry = localMirror.get(key);
		if (!entry || isExpired(entry)) {
			localMirror.delete(key);
			return false;
		}
		return true;
	},
	delete: (key: string): boolean => localMirror.delete(key),
	clear: (): void => {
		localMirror.clear();
		void smartCache.clear();
	},
	getStats: () => ({
		size: localMirror.size,
		hits: 0,
		misses: 0,
		hitRate: 0,
		memoryUsage: 0
	})
};

/**
 * @deprecated Use `CacheUtils` from `$lib/utils/cache`.
 */
export const cacheUtils = {
	smartCache: <T>(key: string, data: T, type: 'user' | 'product' | 'transaction' | 'report'): void => {
		const ttlMap = {
			user: 300000,
			product: 600000,
			transaction: 180000,
			report: 900000
		};
		cacheManager.set(key, data, ttlMap[type]);
	},
	getOrSet: async <T>(key: string, loader: () => Promise<T>, ttl: number = 300000): Promise<T> => {
		const cached = cacheManager.get<T>(key);
		if (cached !== null) {
			return cached;
		}
		const data = await loader();
		cacheManager.set(key, data, ttl);
		return data;
	},
	invalidatePattern: (pattern: string): void => {
		for (const key of Array.from(localMirror.keys())) {
			if (key.includes(pattern)) {
				localMirror.delete(key);
			}
		}
	},
	invalidateDashboardData: CacheUtils.invalidateDashboardData,
	invalidatePOSData: CacheUtils.invalidatePOSData,
	invalidateReportData: CacheUtils.invalidateReportData
};
