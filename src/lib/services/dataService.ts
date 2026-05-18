import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import { smartCache, CacheUtils, CACHE_KEYS } from '$lib/utils/cache';
import {
	getTodayWita,
	getNowWita,
	witaToUtcRange,
	witaRangeToWitaQuery
} from '$lib/utils/dateTime';
import { browser } from '$app/environment';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { getPendingTransactions, clearPendingTransactions } from '$lib/utils/offline';
import { subscribeToChannel } from '$lib/realtime/ablyClient';

// ─── Internal API helpers ─────────────────────────────────────────────────────

async function dbGet(table: string, params: Record<string, string> = {}): Promise<any[]> {
	const branch = selectedBranch.value || 'default';
	const qs = new URLSearchParams({ table, branch, ...params }).toString();
	const res = await fetch(`/api/data?${qs}`);
	if (!res.ok) return [];
	return res.json();
}

async function dbPost(
	table: string,
	action: 'insert' | 'update' | 'delete',
	payload: Record<string, unknown> | Record<string, unknown>[],
	where?: Record<string, string>
): Promise<{ ok: boolean }> {
	const branch = selectedBranch.value || 'default';
	const res = await fetch('/api/data', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ table, action, payload, branch, where })
	});
	if (!res.ok) throw new Error(`dbPost ${table}/${action} failed: ${res.status}`);
	return res.json();
}

// ─── 7-day cache helpers ──────────────────────────────────────────────────────

async function getCachedPosKas7Hari() {
	const todayStr = getTodayWita();
	const branch = selectedBranch.value || 'default';
	const cacheKey = `pos_kas_7hari_${branch}_${todayStr}`;
	const cached = await idbGet(cacheKey);
	if (cached && Array.isArray(cached.data) && Date.now() - cached.timestamp < 300000) {
		return cached.data;
	}

	const todayWita = new Date(todayStr + 'T00:00:00+08:00');
	const labels: string[] = [];
	for (let i = 6; i >= 0; i--) {
		const d = new Date(todayWita);
		d.setDate(todayWita.getDate() - i);
		labels.push(d.toISOString().slice(0, 10));
	}
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
	const todayWita = new Date(todayStr + 'T00:00:00+08:00');
	const labels: string[] = [];
	for (let i = 6; i >= 0; i--) {
		const d = new Date(todayWita);
		d.setDate(todayWita.getDate() - i);
		labels.push(d.toISOString().slice(0, 10));
	}

	const perHari: Record<string, Set<string>> = {};
	labels.forEach((l) => (perHari[l] = new Set()));
	for (const t of kas7) {
		const date = new Date(t.waktu).toISOString().slice(0, 10);
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
	const jamCount: Record<number, number> = {};
	for (const t of kas) {
		const jam = new Date(t.waktu).getHours();
		jamCount[jam] = (jamCount[jam] || 0) + 1;
	}

	let peak = -1, maxCount = 0;
	for (const [jam, count] of Object.entries(jamCount)) {
		if (count > maxCount) { maxCount = count; peak = Number(jam); }
	}

	const result = peak >= 0
		? `${String(peak).padStart(2, '0')}.00–${String(peak + 1).padStart(2, '0')}.00`
		: '';

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
				const now = new Date();
				const startUTC = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
				const endUTC = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

				const qs = new URLSearchParams({ table: 'dashboard_stats', branch, start: startUTC, end: endUTC }).toString();
				const res = await fetch(`/api/data?${qs}`);
				const { kasir = [], kas = [] } = res.ok ? await res.json() : {};

				const itemTerjual = kasir.reduce((s: number, t: any) => s + (t.qty || 1), 0);
				const txIds = new Set(kas.map((t: any) => t.transaction_id).filter(Boolean));
				const jumlahTransaksi = txIds.size || kas.length;
				const omzet = kas.reduce((s: number, t: any) => s + (t.amount || 0), 0);
				const pemasukan = kas.filter((t: any) => t.tipe === 'in').reduce((s: number, t: any) => s + (t.amount || 0), 0);
				const pengeluaran = kas.filter((t: any) => t.tipe === 'out').reduce((s: number, t: any) => s + (t.amount || 0), 0);

				const [avgTransaksi, jamRamai] = await Promise.all([
					getAvgTransaksiHarian(),
					getJamRamaiMingguan()
				]);

				return { itemTerjual, jumlahTransaksi, omzet, profit: pemasukan - pengeluaran, totalItem: itemTerjual, avgTransaksi, jamRamai, weeklyIncome: [], weeklyMax: 1, bestSellers: [] };
			},
			{ ttl: 45000, backgroundRefresh: true }
		);
	}

	async getBestSellers() {
		const branch = selectedBranch.value || 'default';
		return smartCache.get(
			`${CACHE_KEYS.BEST_SELLERS}_${branch}`,
			async () => {
				const todayWita = new Date(getNowWita());
				const labels: string[] = [];
				for (let i = 6; i >= 0; i--) {
					const d = new Date(todayWita);
					d.setDate(todayWita.getDate() - i);
					labels.push(d.toISOString().slice(0, 10));
				}
				const { startUtc } = witaToUtcRange(labels[0]);
				const { endUtc } = witaToUtcRange(labels[6]);

				const items = await dbGet('transaksi_kasir', { start: startUtc, end: endUtc });
				const grouped: Record<string, number> = {};
				for (const item of items) {
					if (!item.produk_id) continue;
					grouped[item.produk_id] = (grouped[item.produk_id] || 0) + (item.qty || 1);
				}

				const topIds = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
				if (!topIds.length) return [];

				const allProducts = await dbGet('produk', {});
				return topIds.map((id) => {
					const prod = allProducts.find((p: any) => p.id === id);
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
				const todayWita = new Date(getNowWita());
				const labels: string[] = [];
				const perHari: Record<string, number> = {};
				for (let i = 6; i >= 0; i--) {
					const d = new Date(todayWita);
					d.setDate(todayWita.getDate() - i);
					const tanggal = d.toISOString().slice(0, 10);
					labels.push(tanggal);
					perHari[tanggal] = 0;
				}

				const { startUtc } = witaToUtcRange(labels[0]);
				const { endUtc } = witaToUtcRange(labels[6]);

				const rows = await dbGet('buku_kas', { start: startUtc, end: endUtc, sumber: 'pos', tipe: 'in' });
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
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			return (await idbGet('products')) || [];
		}
		const data = await smartCache.get(
			`${CACHE_KEYS.PRODUCTS}_${branch}`,
			async () => dbGet('produk'),
			{ ttl: 180000, backgroundRefresh: true }
		);
		await idbSet('products', data || []);
		return data || [];
	}

	async getCategories() {
		const branch = selectedBranch.value || 'default';
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			return (await idbGet('categories')) || [];
		}
		const data = await smartCache.get(
			`${CACHE_KEYS.CATEGORIES}_${branch}`,
			async () => dbGet('kategori'),
			{ ttl: 180000, backgroundRefresh: true }
		);
		await idbSet('categories', data || []);
		return data || [];
	}

	async getAddOns() {
		const branch = selectedBranch.value || 'default';
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			return (await idbGet('addons')) || [];
		}
		const data = await smartCache.get(
			`${CACHE_KEYS.ADDONS}_${branch}`,
			async () => dbGet('tambahan'),
			{ ttl: 180000, backgroundRefresh: true }
		);
		await idbSet('addons', data || []);
		return data || [];
	}

	async getReportData(dateRange: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
		const branch = selectedBranch.value || 'default';
		const cacheKey = `smart_${type}_${branch}_${this.normalizeDateRange(dateRange, type)}`;

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
						const d = new Date(dateRange);
						const sow = new Date(d);
						sow.setDate(d.getDate() - d.getDay());
						const eow = new Date(sow);
						eow.setDate(sow.getDate() + 6);
						startDate = sow.toISOString().slice(0, 10);
						endDate = eow.toISOString().slice(0, 10);
						break;
					}
					case 'monthly':
						startDate = `${dateRange}-01`;
						endDate = new Date(Number(dateRange.split('-')[0]), Number(dateRange.split('-')[1]), 0).toISOString().slice(0, 10);
						break;
					case 'yearly':
						startDate = `${dateRange}-01-01`;
						endDate = `${dateRange}-12-31`;
						break;
					default:
						startDate = endDate = dateRange;
				}

				let startWita: string, endWita: string;
				try {
					({ startWita, endWita } = witaRangeToWitaQuery(startDate, endDate));
				} catch {
					const today = getTodayWita();
					startWita = today + 'T00:00:00+08:00';
					endWita = today + 'T23:59:59+08:00';
				}

				const allBukuKas = await dbGet('buku_kas', { start: startWita, end: endWita });
				const posBukuKas = allBukuKas.filter((i: any) => i.sumber === 'pos');
				const manualItems = allBukuKas.filter((i: any) => i.sumber && i.sumber !== 'pos');
				const uncategorized = allBukuKas.filter((i: any) => !i.sumber);

				let posItems: any[] = [];
				if (posBukuKas.length) {
					const bukuKasIds = posBukuKas.map((bk: any) => bk.id).filter(Boolean);
					const bukuKasById = new Map(posBukuKas.map((bk: any) => [bk.id, bk]));

					const tkParams: Record<string, string> = {};
					if (bukuKasIds.length <= 1000) {
						tkParams.buku_kas_ids = bukuKasIds.join(',');
					} else {
						tkParams.start = startWita;
						tkParams.end = endWita;
					}
					const tk = await dbGet('transaksi_kasir', tkParams);
					posItems = tk.map((t: any) => ({ ...t, buku_kas: bukuKasById.get(t.buku_kas_id) })).filter((t: any) => t.buku_kas);
				}

				const laporan: any[] = [
					...posItems.map((item: any) => ({
						...item,
						sumber: 'pos',
						payment_method: item.buku_kas?.payment_method,
						waktu: item.buku_kas?.waktu,
						jenis: item.buku_kas?.jenis,
						tipe: item.buku_kas?.tipe,
						description: item.custom_name || 'Item Custom',
						nominal: item.amount || 0
					})),
					...manualItems.map((item: any) => ({ ...item, sumber: item.sumber || 'catat', nominal: item.amount || 0 })),
					...uncategorized.map((item: any) => ({ ...item, sumber: 'lainnya', description: item.description || 'Transaksi Lainnya', nominal: item.amount || 0 }))
				];

				const pemasukan = laporan.filter((t) => t.tipe === 'in');
				const pengeluaran = laporan.filter((t) => t.tipe === 'out');
				const totalPemasukan = pemasukan.reduce((s, t) => s + (t.nominal || 0), 0);
				const totalPengeluaran = pengeluaran.reduce((s, t) => s + (t.nominal || 0), 0);
				const labaKotor = totalPemasukan - totalPengeluaran;
				const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;

				return {
					data: {
						summary: { pendapatan: totalPemasukan, pengeluaran: totalPengeluaran, saldo: labaKotor, labaKotor, pajak, labaBersih: labaKotor - pajak },
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

	subscribeToRealtimeData(table: string, callback: (payload: Record<string, unknown>) => void) {
		if (!browser) return null;
		const branch = selectedBranch.value || 'default';
		const channelName = `zatiaras:${branch}`;
		return subscribeToChannel(channelName, table, callback);
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
				await Promise.all([
					smartCache.invalidate(`${CACHE_KEYS.PRODUCTS}_${branch}`),
					smartCache.invalidate(`${CACHE_KEYS.CATEGORIES}_${branch}`),
					smartCache.invalidate(`${CACHE_KEYS.ADDONS}_${branch}`)
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
			await smartCache.invalidate(`smart_${type}_${branch}_*`);
		}
	}

	getCacheStats() { return smartCache.getStats(); }
	async clearAllCaches() { await smartCache.clear(); }

	// ── Helpers ───────────────────────────────────────────────────────────────

	private generateSmartCacheKey(type: string, dateRange: string, branch: string) {
		return `smart_${type}_${branch}_${this.normalizeDateRange(dateRange, type)}`;
	}

	private normalizeDateRange(dateRange: string, type: string): string {
		if (type === 'weekly') {
			const d = new Date(dateRange);
			const sow = new Date(d);
			sow.setDate(d.getDate() - d.getDay());
			return sow.toISOString().slice(0, 10);
		}
		return dateRange;
	}

	private getCacheOptionsForType(type: string): any {
		const base = { backgroundRefresh: true, staleWhileRevalidate: true };
		const ttlMap: Record<string, number> = { daily: 300000, weekly: 900000, monthly: 1800000, yearly: 3600000 };
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
		if (timer) { clearTimeout(timer); this.pendingTimers.delete(table); }
		this.latestPayload.delete(table);
		const unsub = this.unsubFns.get(table);
		if (unsub) { unsub(); this.unsubFns.delete(table); }
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

// ─── Offline sync ─────────────────────────────────────────────────────────────

export async function syncPendingTransactions() {
	const pendings = await getPendingTransactions();
	if (!pendings.length) return;

	for (const trx of pendings) {
		let attempt = 0;
		while (attempt < 3) {
			try {
				if (trx.bukuKas) {
					await dbPost('buku_kas', 'insert', trx.bukuKas);
					if (trx.transaksiKasir?.length) {
						const tkRows = trx.transaksiKasir.map((item: any) => ({
							...item,
							buku_kas_id: trx.bukuKas.id
						}));
						await dbPost('transaksi_kasir', 'insert', tkRows);
					}
				} else {
					await dbPost('buku_kas', 'insert', trx);
				}
				break;
			} catch {
				attempt++;
				if (attempt >= 3) break;
				await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt - 1)));
			}
		}
	}

	await clearPendingTransactions();
	window?.dispatchEvent(new CustomEvent('pending-synced'));
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', syncPendingTransactions);
}
