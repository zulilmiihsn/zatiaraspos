import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import { smartCache, CacheUtils, CACHE_KEYS } from '$lib/utils/cache';
import {
	addDaysYmd,
	formatDateYmdWita,
	getLastDaysYmdWita,
	getMonthEndYmd,
	getTodayWita,
	witaToUtcRange
} from '$lib/utils/dateTime';
import { browser } from '$app/environment';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { subscribeToRealtimeTable } from '$lib/realtime/durableObjectClient';
import {
	dbGet,
	dbGetPage,
	dbGetStrict,
	dbPost,
	type DataPage,
	type DataRecord
} from '$lib/services/dataApiClient';

const REPORT_CACHE_VERSION = 'v4';

// ─── Internal API helpers ─────────────────────────────────────────────────────

// ─── 7-day cache helpers ──────────────────────────────────────────────────────

async function getCachedPosKas7Hari() {
	const todayStr = getTodayWita();
	const branch = selectedBranch.value || 'default';
	const cacheKey = `pos_kas_7hari_${branch}_${todayStr}`;
	const cached = await idbGet(cacheKey);
	if (cached && Array.isArray(cached.data) && Date.now() - cached.timestamp < 300000) {
		return cached.data;
	}

	const labels = getLastDaysYmdWita(7);
	const { startUtc } = witaToUtcRange(labels[0]);
	const { endUtc } = witaToUtcRange(labels[6]);

	const result = await dbGet('pos_kas_7hari', { start: startUtc, end: endUtc });
	await idbSet(cacheKey, { data: result, timestamp: Date.now() });
	return result;
}

async function getAvgTransaksiHarian(): Promise<number> {
	const todayStr = getTodayWita();
	const branch = selectedBranch.value || 'default';
	const cacheKey = `avg_transaksi_${branch}_${todayStr}`;
	const cached = await idbGet(cacheKey);
	if (cached && typeof cached.value === 'number' && Date.now() - cached.timestamp < 86400000) {
		return cached.value;
	}

	const kas7 = await getCachedPosKas7Hari();
	const labels = getLastDaysYmdWita(7);

	const perHari: Record<string, Set<string>> = {};
	labels.forEach((l) => (perHari[l] = new Set()));
	for (const t of kas7) {
		const date = formatDateYmdWita(t.waktu);
		if (perHari[date] && t.transaction_id) perHari[date].add(t.transaction_id);
	}
	const avg = Math.round(Object.values(perHari).reduce((s, set) => s + set.size, 0) / 7);
	await idbSet(cacheKey, { value: avg, timestamp: Date.now() });
	return avg;
}

async function getJamRamaiMingguan(): Promise<string> {
	const todayStr = getTodayWita();
	const branch = selectedBranch.value || 'default';
	const cacheKey = `jam_ramai_mingguan_${branch}_${todayStr}`;
	const cached = await idbGet(cacheKey);
	if (cached && typeof cached.value === 'string' && Date.now() - cached.timestamp < 86400000) {
		return cached.value;
	}

	const kas = await getCachedPosKas7Hari();
	const witaHour = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Makassar',
		hour: '2-digit',
		hour12: false
	});
	const jamCount: Record<number, number> = {};
	for (const t of kas) {
		const jam = Number(witaHour.format(new Date(t.waktu)));
		jamCount[jam] = (jamCount[jam] || 0) + 1;
	}

	let peak = -1,
		maxCount = 0;
	for (const [jam, count] of Object.entries(jamCount)) {
		if (count > maxCount) {
			maxCount = count;
			peak = Number(jam);
		}
	}

	const result =
		peak >= 0 ? `${String(peak).padStart(2, '0')}.00–${String(peak + 1).padStart(2, '0')}.00` : '';

	await idbSet(cacheKey, { value: result, timestamp: Date.now() });
	return result;
}

// ─── DataService ──────────────────────────────────────────────────────────────

export class DataService {
	private static instance: DataService;

	static getInstance(): DataService {
		if (!DataService.instance) DataService.instance = new DataService();
		return DataService.instance;
	}

	async getDashboardStats() {
		const branch = selectedBranch.value || 'default';
		return smartCache.get(
			`${CACHE_KEYS.DASHBOARD_STATS}_${branch}`,
			async () => {
				const { startUtc: startUTC, endUtc: endUTC } = witaToUtcRange(getTodayWita());

				const qs = new URLSearchParams({
						branch,
						start: startUTC,
						end: endUTC
					}).toString();
					const res = await fetch(`/api/dashboard/stats?${qs}`);
				const payload = res.ok ? await res.json() : {};
				const { kasir = [], kas = [], summary = [] } = payload;

				if (Array.isArray(summary) && summary.length) {
					const itemTerjual = summary.reduce((s: number, row: any) => s + (row.item_count || 0), 0);
					const jumlahTransaksi = summary.reduce(
						(s: number, row: any) => s + (row.transaction_count || 0),
						0
					);
					const omzet = summary.reduce((s: number, row: any) => s + (row.gross_sales || 0), 0);
					const hppTotal = summary.reduce((s: number, row: any) => s + (row.hpp_total || 0), 0);

					const [avgTransaksi, jamRamai] = await Promise.all([
						getAvgTransaksiHarian(),
						getJamRamaiMingguan()
					]);

					return {
						itemTerjual,
						jumlahTransaksi,
						omzet,
						profit: omzet - hppTotal,
						totalItem: itemTerjual,
						avgTransaksi,
						jamRamai,
						weeklyIncome: [],
						weeklyMax: 1,
						bestSellers: []
					};
				}

				const itemTerjual = kasir.reduce((s: number, t: any) => s + (t.qty || 1), 0);
				const txIds = new Set(kas.map((t: any) => t.transaction_id).filter(Boolean));
				const jumlahTransaksi = txIds.size || kas.length;
				const omzet = kas.reduce((s: number, t: any) => s + (t.amount || 0), 0);
				const pemasukan = kas
					.filter((t: any) => t.tipe === 'in')
					.reduce((s: number, t: any) => s + (t.amount || 0), 0);
				const pengeluaran = kas
					.filter((t: any) => t.tipe === 'out')
					.reduce((s: number, t: any) => s + (t.amount || 0), 0);

				const [avgTransaksi, jamRamai] = await Promise.all([
					getAvgTransaksiHarian(),
					getJamRamaiMingguan()
				]);

				return {
					itemTerjual,
					jumlahTransaksi,
					omzet,
					profit: pemasukan - pengeluaran,
					totalItem: itemTerjual,
					avgTransaksi,
					jamRamai,
					weeklyIncome: [],
					weeklyMax: 1,
					bestSellers: []
				};
			},
			{ ttl: 45000, backgroundRefresh: true }
		);
	}

	async getBestSellers() {
		const branch = selectedBranch.value || 'default';
		return smartCache.get(
			`${CACHE_KEYS.BEST_SELLERS}_${branch}`,
			async () => {
				const labels = getLastDaysYmdWita(7);
				const { startUtc } = witaToUtcRange(labels[0]);
				const { endUtc } = witaToUtcRange(labels[6]);

				const summaryItems = await dbGet('best_sellers_summary', { start: startUtc, end: endUtc });
				if (summaryItems.length) {
					return summaryItems.map((item: any) => ({
						name: item.nama_produk || '-',
						image: '',
						total_qty: Number(item.total_qty || 0)
					}));
				}

				const items = await dbGet<Record<string, any>>('transaksi_kasir', {
					start: startUtc,
					end: endUtc
				});
				const grouped: Record<string, number> = {};
				for (const item of items) {
					if (!item.produk_id) continue;
					grouped[item.produk_id] = (grouped[item.produk_id] || 0) + (item.qty || 1);
				}

				const topIds = Object.entries(grouped)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 3)
					.map(([id]) => id);
				if (!topIds.length) return [];

				const allProducts = await dbGet<Record<string, any>>('produk', {});
				return topIds.map((id) => {
					const prod = allProducts.find((p) => p.id === id);
					return { name: prod?.name || '-', image: prod?.gambar || '', total_qty: grouped[id] };
				});
			},
			{ ttl: 300000, backgroundRefresh: true }
		);
	}

	async getWeeklyIncome() {
		const branch = selectedBranch.value || 'default';
		return smartCache.get(
			`${CACHE_KEYS.WEEKLY_INCOME}_${branch}`,
			async () => {
				const labels = getLastDaysYmdWita(7);
				const perHari: Record<string, number> = {};
				for (const tanggal of labels) {
					perHari[tanggal] = 0;
				}

				const { startUtc } = witaToUtcRange(labels[0]);
				const { endUtc } = witaToUtcRange(labels[6]);

				const summaryRows = await dbGet('weekly_income_summary', {
					start: startUtc,
					end: endUtc
				});
				if (summaryRows.length) {
					for (const row of summaryRows) {
						const tanggal = String(row.sales_date || '');
						if (tanggal in perHari) perHari[tanggal] += Number(row.gross_sales || 0);
					}
					const weeklyIncome = labels.map((l) => perHari[l] || 0);
					return { weeklyIncome, weeklyMax: Math.max(1, ...weeklyIncome) };
				}

				const rows = await dbGet<Record<string, any>>('buku_kas', {
					start: startUtc,
					end: endUtc,
					sumber: 'pos',
					tipe: 'in'
				});
				const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Makassar' });
				for (const t of rows) {
					const d = new Date(t.waktu);
					if (isNaN(d.getTime())) continue;
					const tanggal = fmt.format(d);
					if (tanggal in perHari) perHari[tanggal] += Number(t.amount || 0);
				}

				const weeklyIncome = labels.map((l) => perHari[l] || 0);
				return { weeklyIncome, weeklyMax: Math.max(1, ...weeklyIncome) };
			},
			{ ttl: 300000, backgroundRefresh: true }
		);
	}

	async getProducts() {
		const branch = selectedBranch.value || 'default';
		const offlineKey = `products_${branch}`;
		const offlineData = ((await idbGet(offlineKey)) as any[] | undefined) || [];
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			return offlineData;
		}
		try {
			const data = await smartCache.get(
				`${CACHE_KEYS.PRODUCTS}_${branch}`,
				async () => dbGetStrict('produk'),
				{ ttl: 180000, backgroundRefresh: true }
			);
			await idbSet(offlineKey, data || []);
			return data || [];
		} catch {
			return offlineData;
		}
	}

	async getCategories() {
		const branch = selectedBranch.value || 'default';
		const offlineKey = `categories_${branch}`;
		const offlineData = ((await idbGet(offlineKey)) as any[] | undefined) || [];
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			return offlineData;
		}
		try {
			const data = await smartCache.get(
				`${CACHE_KEYS.CATEGORIES}_${branch}`,
				async () => dbGetStrict('kategori'),
				{ ttl: 180000, backgroundRefresh: true }
			);
			await idbSet(offlineKey, data || []);
			return data || [];
		} catch {
			return offlineData;
		}
	}

	async getAddOns() {
		const branch = selectedBranch.value || 'default';
		const offlineKey = `addons_${branch}`;
		const offlineData = ((await idbGet(offlineKey)) as any[] | undefined) || [];
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			return offlineData;
		}
		try {
			const data = await smartCache.get(
				`${CACHE_KEYS.ADDONS}_${branch}`,
				async () => dbGetStrict('tambahan'),
				{ ttl: 180000, backgroundRefresh: true }
			);
			await idbSet(offlineKey, data || []);
			return data || [];
		} catch {
			return offlineData;
		}
	}

	async getIngredients() {
		const branch = selectedBranch.value || 'default';
		return smartCache.get(`ingredients_${branch}`, async () => dbGet('bahan'), {
			ttl: 180000,
			backgroundRefresh: true
		});
	}

	async getProductRecipes(productId?: string | number) {
		const params: Record<string, string> = productId ? { produk_id: String(productId) } : {};
		return dbGet('resep_produk', params);
	}

	async getHppSettings() {
		const branch = selectedBranch.value || 'default';
		const rows = await smartCache.get(`hpp_settings_${branch}`, async () => dbGet('hpp_settings'), {
			ttl: 180000,
			backgroundRefresh: true
		});
		return rows?.[0] || null;
	}

	async getRows(
		table: string,
		params: Record<string, string> = {}
	): Promise<Record<string, any>[]> {
		return dbGet(table, params) as Promise<Record<string, any>[]>;
	}

	async getRowsPage<T extends DataRecord = DataRecord>(
		table: 'buku_kas' | 'transaksi_kasir',
		params: Record<string, string> = {},
		cursor?: string | null
	): Promise<DataPage<T>> {
		return dbGetPage<T>(table, params, cursor);
	}

	async getOne(
		table: string,
		params: Record<string, string> = {}
	): Promise<Record<string, any> | null> {
		const rows = await dbGet(table, { limit: '1', ...params });
		return (rows[0] as Record<string, any>) || null;
	}

	async insertRows(table: string, payload: Record<string, unknown> | Record<string, unknown>[]) {
		return dbPost(table, 'insert', payload);
	}

	async updateRows(table: string, payload: Record<string, unknown>, where: Record<string, string>) {
		return dbPost(table, 'update', payload, where);
	}

	async deleteRows(table: string, where: Record<string, string>) {
		return dbPost(table, 'delete', {}, where);
	}

	async getReportData(dateRange: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
		const branch = selectedBranch.value || 'default';
		const cacheKey = this.generateSmartCacheKey(type, dateRange, branch);

		return smartCache.get(
			cacheKey,
			async () => {
				let startDate: string, endDate: string;
				switch (type) {
					case 'daily':
						if (dateRange.includes('_')) {
							[startDate, endDate] = dateRange.split('_');
						} else {
							startDate = endDate = dateRange;
						}
						break;
					case 'weekly': {
						const day = new Date(`${dateRange}T00:00:00Z`).getUTCDay();
						startDate = addDaysYmd(dateRange, -day);
						endDate = addDaysYmd(startDate, 6);
						break;
					}
					case 'monthly':
						startDate = `${dateRange}-01`;
						endDate = getMonthEndYmd(dateRange);
						break;
					case 'yearly':
						startDate = `${dateRange}-01-01`;
						endDate = `${dateRange}-12-31`;
						break;
					default:
						startDate = endDate = dateRange;
				}

				// Ambil laporan ter-agregasi dari server (tabel harian) alih-alih menarik
				// seluruh buku_kas + transaksi_kasir mentah. transactions sudah berupa
				// baris ringkas (POS per produk x metode + entri manual), jadi
				// perhitungan ringkasan di bawah tetap menghasilkan angka identik.
				const aggParams = new URLSearchParams({
					branch,
					start_date: startDate,
					end_date: endDate
				}).toString();
				const aggRes = await fetch(`/api/reports/aggregate?${aggParams}`);
				const aggData = aggRes.ok ? await aggRes.json() : null;
				const laporan: any[] = Array.isArray(aggData?.transactions) ? aggData.transactions : [];

				const pemasukan = laporan.filter((t) => t.tipe === 'in');
				const pengeluaran = laporan.filter((t) => t.tipe === 'out');
				const totalPemasukan = pemasukan.reduce((s, t) => s + (t.amount || 0), 0);
				const totalPengeluaran = pengeluaran.reduce((s, t) => s + (t.amount || 0), 0);
				const labaKotor = totalPemasukan - totalPengeluaran;
				const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;

				return {
					data: {
						summary: {
							pendapatan: totalPemasukan,
							pengeluaran: totalPengeluaran,
							saldo: labaKotor,
							labaKotor,
							pajak,
							labaBersih: labaKotor - pajak
						},
						pemasukanUsaha: pemasukan.filter((t) => t.jenis === 'pendapatan_usaha'),
						pemasukanLain: pemasukan.filter((t) => t.jenis === 'lainnya'),
						bebanUsaha: pengeluaran.filter((t) => t.jenis === 'beban_usaha'),
						bebanLain: pengeluaran.filter((t) => t.jenis === 'lainnya'),
						transactions: laporan
					},
					etag: `${type}_${dateRange}_${Date.now()}`
				};
			},
			this.getCacheOptionsForType(type)
		);
	}

	// ── Realtime ──────────────────────────────────────────────────────────────

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

	// ── Cache invalidation ────────────────────────────────────────────────────

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
			await smartCache.invalidate(this.generateSmartCacheKey(type, dateRange, branch));
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

	// ── Helpers ───────────────────────────────────────────────────────────────

	private generateSmartCacheKey(type: string, dateRange: string, branch: string) {
		return `smart_${type}_${REPORT_CACHE_VERSION}_${branch}_${this.normalizeDateRange(dateRange, type)}`;
	}

	private normalizeDateRange(dateRange: string, type: string): string {
		if (type === 'weekly') {
			const day = new Date(`${dateRange}T00:00:00Z`).getUTCDay();
			return addDaysYmd(dateRange, -day);
		}
		return dateRange;
	}

	private getCacheOptionsForType(type: string): any {
		const base = { backgroundRefresh: true, staleWhileRevalidate: true };
		const ttlMap: Record<string, number> = {
			daily: 300000,
			weekly: 900000,
			monthly: 1800000,
			yearly: 3600000
		};
		return { ...base, ttl: ttlMap[type] || 300000 };
	}

	// ── Parallel fetch (kept for API compatibility) ───────────────────────────

	async fetchAllDataParallel(
		table: string,
		startTime: string,
		endTime: string,
		_filters: Record<string, unknown> = {}
	): Promise<Record<string, unknown>[]> {
		return dbGet(table, { start: startTime, end: endTime });
	}
}

export const dataService = DataService.getInstance();

// ─── RealtimeManager ─────────────────────────────────────────────────────────

export class RealtimeManager {
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
