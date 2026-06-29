import { browser } from '$app/environment';
import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import { smartCache, CacheUtils, CACHE_KEYS } from '$lib/utils/cache';
import { subscribeToRealtimeTable } from '$lib/realtime/durableObjectClient';
import type { Product, Category, AddOn } from '$lib/types/product';
import type { DataPage, DataRecord } from '$lib/services/dataApiClient';
import { REPORT_CACHE_VERSION } from '$lib/constants/cache';

import { dashboardService } from './dashboardService';
import { productService } from './productService';
import { transactionService } from './transactionService';

export class DataService {
	private static instance: DataService;

	static getInstance(): DataService {
		if (!DataService.instance) DataService.instance = new DataService();
		return DataService.instance;
	}

	// ── Facade: Dashboard Service ─────────────────────────────────────────────
	async getDashboardStats() {
		return dashboardService.getDashboardStats();
	}

	async getBestSellers() {
		return dashboardService.getBestSellers();
	}

	async getWeeklyIncome() {
		return dashboardService.getWeeklyIncome();
	}

	async getReportData(dateRange: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
		return dashboardService.getReportData(dateRange, type);
	}

	// ── Facade: Product Service ───────────────────────────────────────────────
	async getProducts(): Promise<Product[]> {
		return productService.getProducts();
	}

	async getCategories(): Promise<Category[]> {
		return productService.getCategories();
	}

	async getAddOns(): Promise<AddOn[]> {
		return productService.getAddOns();
	}

	async getIngredients() {
		return productService.getIngredients();
	}

	async getProductRecipes(productId?: string | number) {
		return productService.getProductRecipes(productId);
	}

	async getHppSettings() {
		return productService.getHppSettings();
	}

	// ── Facade: Transaction Service ───────────────────────────────────────────
	async getRows(
		table: string,
		params: Record<string, string> = {}
	): Promise<Record<string, any>[]> {
		return transactionService.getRows(table, params);
	}

	async getRowsPage<T extends DataRecord = DataRecord>(
		table: 'buku_kas' | 'transaksi_kasir',
		params: Record<string, string> = {},
		cursor?: string | null
	): Promise<DataPage<T>> {
		return transactionService.getRowsPage<T>(table, params, cursor);
	}

	async getOne(
		table: string,
		params: Record<string, string> = {}
	): Promise<Record<string, any> | null> {
		return transactionService.getOne(table, params);
	}

	async insertRows(table: string, payload: Record<string, unknown> | Record<string, unknown>[]) {
		return transactionService.insertRows(table, payload);
	}

	async updateRows(table: string, payload: Record<string, unknown>, where: Record<string, string>) {
		return transactionService.updateRows(table, payload, where);
	}

	async deleteRows(table: string, where: Record<string, string>) {
		return transactionService.deleteRows(table, where);
	}

	async fetchAllDataParallel(
		table: string,
		startTime: string,
		endTime: string,
		_filters: Record<string, unknown> = {}
	): Promise<Record<string, unknown>[]> {
		return transactionService.fetchAllDataParallel(table, startTime, endTime, _filters);
	}

	// ── Cache Invalidation & Orchestration ────────────────────────────────────

	async preloadCommonDateRanges() {
		await Promise.allSettled([
			this.getDashboardStats(),
			this.getBestSellers(),
			this.getWeeklyIncome()
		]);
	}

	subscribeToRealtimeData(table: string, callback: (payload: Record<string, unknown>) => void) {
		if (!browser) return null;
		return subscribeToRealtimeTable(table, callback);
	}

	private async invalidateDashboardCachesForBranch(branch: string) {
		await Promise.all([
			smartCache.invalidate(`${CACHE_KEYS.DASHBOARD_STATS}_${branch}`),
			smartCache.invalidate(`${CACHE_KEYS.BEST_SELLERS}_${branch}`),
			smartCache.invalidate(`${CACHE_KEYS.WEEKLY_INCOME}_${branch}`)
		]);
	}

	async invalidateDashboardCaches(branch?: string) {
		const b = branch || selectedBranch.value || 'default';
		await this.invalidateDashboardCachesForBranch(b);
	}

	async invalidateCacheOnChange(table: string) {
		const branch = selectedBranch.value || 'default';
		switch (table) {
			case 'produk':
			case 'kategori':
			case 'tambahan':
			case 'bahan':
			case 'resep_produk':
			case 'bahan_mutasi':
			case 'hpp_settings':
				await Promise.all([
					smartCache.invalidate(`${CACHE_KEYS.PRODUCTS}_${branch}`),
					smartCache.invalidate(`${CACHE_KEYS.CATEGORIES}_${branch}`),
					smartCache.invalidate(`${CACHE_KEYS.ADDONS}_${branch}`),
					smartCache.invalidate(`ingredients_${branch}`),
					smartCache.invalidate(`hpp_settings_${branch}`)
				]);
				break;
			case 'buku_kas':
			case 'transaksi_kasir':
				await this.invalidateDashboardCaches(branch);
				await CacheUtils.invalidateReportData();
				await this.invalidateAllReportCaches();
				break;
			case 'profil':
				await smartCache.invalidate(CACHE_KEYS.USER_PROFILE);
				await smartCache.invalidate(CACHE_KEYS.USER_ROLE);
				break;
		}
	}

	async invalidateAllReportCaches() {
		await Promise.allSettled(
			['daily', 'weekly', 'monthly', 'yearly'].map((type) => this.invalidateReportCache(type))
		);
	}

	async invalidateReportCache(type: string, dateRange?: string) {
		const branch = selectedBranch.value || 'default';
		if (dateRange) {
			const normalized = dashboardService.generateSmartCacheKey(type, dateRange, branch);
			await smartCache.invalidate(normalized);
		} else {
			await smartCache.invalidate(`smart_${type}_${REPORT_CACHE_VERSION}_${branch}_*`);
		}
	}

	getCacheStats() {
		return smartCache.getStats();
	}
	async clearAllCaches() {
		await smartCache.clear();
	}
}

export const dataService = DataService.getInstance();

// ─── RealtimeManager ─────────────────────────────────────────────────────────

class RealtimeManager {
	private unsubFns = new Map<string, (() => void) | null>();
	private pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private latestPayload = new Map<string, Record<string, unknown>>();

	subscribe(table: string, callback: (payload: Record<string, unknown>) => void) {
		if (this.unsubFns.has(table)) this.unsubscribe(table);

		const unsub = dataService.subscribeToRealtimeData(table, (payload) => {
			this.latestPayload.set(table, payload);
			if (this.pendingTimers.has(table)) return;

			const id = setTimeout(async () => {
				this.pendingTimers.delete(table);
				const latest = this.latestPayload.get(table);
				this.latestPayload.delete(table);
				await dataService.invalidateCacheOnChange(table);
				if (latest !== undefined) callback(latest);
			}, 250);
			this.pendingTimers.set(table, id);
		});

		this.unsubFns.set(table, unsub);
	}

	unsubscribe(table: string) {
		const timer = this.pendingTimers.get(table);
		if (timer) {
			clearTimeout(timer);
			this.pendingTimers.delete(table);
		}
		this.latestPayload.delete(table);
		const unsub = this.unsubFns.get(table);
		if (unsub) {
			unsub();
			this.unsubFns.delete(table);
		}
	}

	unsubscribeAll() {
		for (const id of this.pendingTimers.values()) clearTimeout(id);
		this.pendingTimers.clear();
		this.latestPayload.clear();
		for (const unsub of this.unsubFns.values()) unsub?.();
		this.unsubFns.clear();
	}
}

export const realtimeManager = new RealtimeManager();

if (browser) {
	window.addEventListener('beforeunload', () => realtimeManager.unsubscribeAll());
}

export { syncPendingTransactions } from './offlineSync';
