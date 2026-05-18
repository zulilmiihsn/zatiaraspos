/**
 * 🚀 OPTIMIZED DATA SERVICE
 * Caching layer atas /api/data endpoint (Cloudflare D1 via Drizzle).
 * Tidak ada Supabase dependency.
 */

import { advancedCache, cacheKeys } from '$lib/utils/advancedCache';
import { selectedBranch } from '$lib/stores/selectedBranch.svelte';

interface QueryOptions {
	ttl?: number;
	backgroundRefresh?: boolean;
	compression?: boolean;
	batchSize?: number;
	timeout?: number;
}

interface BatchQuery {
	key: string;
	query: () => Promise<any>;
	options?: QueryOptions;
}

interface QueryStats {
	totalQueries: number;
	cacheHits: number;
	cacheMisses: number;
	averageResponseTime: number;
	errors: number;
}

async function apiFetch(table: string, branch: string, params?: Record<string, string>): Promise<any[]> {
	const qs = new URLSearchParams({ table, branch, ...params }).toString();
	const res = await fetch(`/api/data?${qs}`);
	if (!res.ok) throw new Error(`API error ${res.status} for table ${table}`);
	return res.json();
}

export class OptimizedDataService {
	private static instance: OptimizedDataService;
	private queryStats: QueryStats = {
		totalQueries: 0,
		cacheHits: 0,
		cacheMisses: 0,
		averageResponseTime: 0,
		errors: 0
	};
	private responseTimes: number[] = [];

	static getInstance(): OptimizedDataService {
		if (!OptimizedDataService.instance) {
			OptimizedDataService.instance = new OptimizedDataService();
		}
		return OptimizedDataService.instance;
	}

	private branch(branch?: string): string {
		return branch || selectedBranch.value || 'default';
	}

	async executeQuery<T>(key: string, queryFn: () => Promise<T>, options: QueryOptions = {}): Promise<T> {
		const startTime = performance.now();
		try {
			const { ttl = 5 * 60 * 1000, backgroundRefresh = true, compression = true, timeout = 30000 } = options;
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Query timeout')), timeout)
			);
			const result = await Promise.race([
				advancedCache.get(key, queryFn, { ttl, backgroundRefresh, compression }),
				timeoutPromise
			]);
			this.updateStats(performance.now() - startTime, true);
			return result;
		} catch (error) {
			this.updateStats(performance.now() - startTime, false);
			throw error;
		}
	}

	async executeBatchQueries(queries: BatchQuery[]): Promise<any[]> {
		const startTime = performance.now();
		try {
			const cacheable = queries.filter((q) => q.options?.ttl !== 0);
			const nonCacheable = queries.filter((q) => q.options?.ttl === 0);

			const [cacheableResults, nonCacheableResults] = await Promise.all([
				Promise.all(cacheable.map((q) => this.executeQuery(q.key, q.query, q.options))),
				Promise.all(nonCacheable.map((q) => q.query()))
			]);

			const results: any[] = [];
			let ci = 0;
			let ni = 0;
			queries.forEach((q) => {
				results.push(q.options?.ttl === 0 ? nonCacheableResults[ni++] : cacheableResults[ci++]);
			});
			this.updateStats(performance.now() - startTime, true);
			return results;
		} catch (error) {
			this.updateStats(performance.now() - startTime, false);
			throw error;
		}
	}

	async getProducts(branch?: string, options: QueryOptions = {}): Promise<any[]> {
		const b = this.branch(branch);
		const key = cacheKeys.products(b);
		return this.executeQuery(key, () => apiFetch('produk', b, { is_active: '1' }), {
			ttl: 10 * 60 * 1000,
			...options
		});
	}

	async getCategories(branch?: string, options: QueryOptions = {}): Promise<any[]> {
		const b = this.branch(branch);
		const key = cacheKeys.categories(b);
		return this.executeQuery(key, () => apiFetch('kategori', b), { ttl: 15 * 60 * 1000, ...options });
	}

	async getAddOns(branch?: string, options: QueryOptions = {}): Promise<any[]> {
		const b = this.branch(branch);
		const key = cacheKeys.addOns(b);
		return this.executeQuery(key, () => apiFetch('tambahan', b), { ttl: 15 * 60 * 1000, ...options });
	}

	async fetchAllEssentialData(branch?: string): Promise<{
		products: any[];
		categories: any[];
		addOns: any[];
		userProfile: any;
	}> {
		const b = this.branch(branch);
		const queries: BatchQuery[] = [
			{ key: cacheKeys.products(b), query: () => this.getProducts(b, { ttl: 0 }), options: { ttl: 10 * 60 * 1000 } },
			{ key: cacheKeys.categories(b), query: () => this.getCategories(b, { ttl: 0 }), options: { ttl: 15 * 60 * 1000 } },
			{ key: cacheKeys.addOns(b), query: () => this.getAddOns(b, { ttl: 0 }), options: { ttl: 15 * 60 * 1000 } },
			{ key: cacheKeys.userProfile('current'), query: () => this.getUserProfile(b), options: { ttl: 30 * 60 * 1000 } }
		];

		const [products, categories, addOns, userProfile] = await this.executeBatchQueries(queries);
		return { products, categories, addOns, userProfile };
	}

	async getTransactionData(startDate: string, endDate: string, branch?: string, options: QueryOptions = {}): Promise<any[]> {
		const b = this.branch(branch);
		const key = cacheKeys.transactionData(`${startDate}_${endDate}`, b);
		return this.executeQuery(
			key,
			() => apiFetch('buku_kas', b, { start: startDate, end: endDate }),
			{ ttl: 60 * 1000, ...options }
		);
	}

	async getReportData(date: string, type: 'daily' | 'weekly' | 'monthly', branch?: string, options: QueryOptions = {}): Promise<any> {
		const b = this.branch(branch);
		const key = cacheKeys.reportData(date, type, b);
		return this.executeQuery(
			key,
			async () => {
				const { start, end } = this.getDateRange(date, type);
				const [bukuKas, transaksiKasir, produk] = await Promise.all([
					apiFetch('buku_kas', b, { start, end }),
					apiFetch('transaksi_kasir', b, { start, end }),
					this.getProducts(b, { ttl: 0 })
				]);
				return { bukuKas, transaksiKasir, produk, summary: this.calculateSummary(bukuKas, transaksiKasir), type };
			},
			{ ttl: 2 * 60 * 1000, ...options }
		);
	}

	private async getUserProfile(branch: string): Promise<any> {
		const rows = await apiFetch('profil', branch);
		return rows[0] || null;
	}

	private getDateRange(date: string, type: string): { start: string; end: string } {
		const d = new Date(date);
		switch (type) {
			case 'weekly': {
				const ws = new Date(d);
				ws.setDate(d.getDate() - d.getDay());
				const we = new Date(ws);
				we.setDate(ws.getDate() + 6);
				return { start: ws.toISOString().split('T')[0] + 'T00:00:00.000Z', end: we.toISOString().split('T')[0] + 'T23:59:59.999Z' };
			}
			case 'monthly': {
				const ms = new Date(d.getFullYear(), d.getMonth(), 1);
				const me = new Date(d.getFullYear(), d.getMonth() + 1, 0);
				return { start: ms.toISOString().split('T')[0] + 'T00:00:00.000Z', end: me.toISOString().split('T')[0] + 'T23:59:59.999Z' };
			}
			default:
				return {
					start: d.toISOString().split('T')[0] + 'T00:00:00.000Z',
					end: d.toISOString().split('T')[0] + 'T23:59:59.999Z'
				};
		}
	}

	private calculateSummary(bukuKasData: any[], transaksiKasirData: any[]): any {
		const totalPemasukan = bukuKasData.filter((t) => t.tipe === 'in').reduce((s, t) => s + (t.amount || 0), 0);
		const totalPengeluaran = bukuKasData.filter((t) => t.tipe === 'out').reduce((s, t) => s + (t.amount || 0), 0);
		return {
			totalPemasukan,
			totalPengeluaran,
			profit: totalPemasukan - totalPengeluaran,
			totalTransaksi: bukuKasData.length,
			totalItemTerjual: transaksiKasirData.length
		};
	}

	private updateStats(responseTime: number, success: boolean): void {
		this.queryStats.totalQueries++;
		this.responseTimes.push(responseTime);
		if (this.responseTimes.length > 100) this.responseTimes.shift();
		this.queryStats.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
		if (!success) this.queryStats.errors++;
	}

	getQueryStats(): QueryStats {
		return { ...this.queryStats };
	}

	clearBranchCache(branch?: string): void {
		const branchKey = branch || selectedBranch.value || 'default';
		advancedCache.invalidatePattern(new RegExp(`_${branchKey}$`));
	}

	clearAllCaches(): void {
		advancedCache.clear();
	}
}

export const optimizedDataService = OptimizedDataService.getInstance();
