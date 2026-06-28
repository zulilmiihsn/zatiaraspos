import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import { smartCache, CACHE_KEYS } from '$lib/utils/cache';
import {
	addDaysYmd,
	formatDateYmdWita,
	getLastDaysYmdWita,
	getMonthEndYmd,
	getTodayWita,
	witaToUtcRange
} from '$lib/utils/dateTime';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { dbGet } from '$lib/services/dataApiClient';

const REPORT_CACHE_VERSION = 'v4';

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

export class DashboardService {
	private static instance: DashboardService;

	static getInstance(): DashboardService {
		if (!DashboardService.instance) DashboardService.instance = new DashboardService();
		return DashboardService.instance;
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
					const itemTerjual = summary.reduce(
						(s: number, row: Record<string, any>) => s + (row.jumlah_item || 0),
						0
					);
					const jumlahTransaksi = summary.reduce(
						(s: number, row: Record<string, any>) => s + (row.jumlah_transaksi || 0),
						0
					);
					const omzet = summary.reduce(
						(s: number, row: Record<string, any>) => s + (row.penjualan_kotor || 0),
						0
					);
					const hppTotal = summary.reduce(
						(s: number, row: Record<string, any>) => s + (row.total_hpp || 0),
						0
					);

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

				const itemTerjual = kasir.reduce(
					(s: number, t: Record<string, any>) => s + (t.jumlah || 1),
					0
				);
				const txIds = new Set(
					kas.map((t: Record<string, any>) => t.transaction_id).filter(Boolean)
				);
				const jumlahTransaksi = txIds.size || kas.length;
				const omzet = kas.reduce((s: number, t: Record<string, any>) => s + (t.nominal || 0), 0);
				const pemasukan = kas
					.filter((t: Record<string, any>) => t.tipe === 'in')
					.reduce((s: number, t: Record<string, any>) => s + (t.nominal || 0), 0);
				const pengeluaran = kas
					.filter((t: Record<string, any>) => t.tipe === 'out')
					.reduce((s: number, t: Record<string, any>) => s + (t.nominal || 0), 0);

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
					return summaryItems.map((item: Record<string, any>) => ({
						nama: item.nama_produk || '-',
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
					grouped[item.produk_id] = (grouped[item.produk_id] || 0) + (item.jumlah || 1);
				}

				const topIds = Object.entries(grouped)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 3)
					.map(([id]) => id);
				if (!topIds.length) return [];

				const allProducts = await dbGet<Record<string, any>>('produk', {});
				return topIds.map((id) => {
					const prod = allProducts.find((p) => p.id === id);
					return { nama: prod?.nama || '-', image: prod?.gambar || '', total_qty: grouped[id] };
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
						const tanggal = String(row.tanggal_penjualan || '');
						if (tanggal in perHari) perHari[tanggal] += Number(row.penjualan_kotor || 0);
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
					if (tanggal in perHari) perHari[tanggal] += Number(t.nominal || 0);
				}

				const weeklyIncome = labels.map((l) => perHari[l] || 0);
				return { weeklyIncome, weeklyMax: Math.max(1, ...weeklyIncome) };
			},
			{ ttl: 300000, backgroundRefresh: true }
		);
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

				const aggParams = new URLSearchParams({
					branch,
					start_date: startDate,
					end_date: endDate
				}).toString();
				const aggRes = await fetch(`/api/reports/aggregate?${aggParams}`);
				const aggData = aggRes.ok ? await aggRes.json() : null;
				const laporan: Record<string, unknown>[] = Array.isArray(aggData?.transactions)
					? aggData.transactions
					: [];

				const pemasukan = laporan.filter((t) => t.tipe === 'in');
				const pengeluaran = laporan.filter((t) => t.tipe === 'out');
				const totalPemasukan = pemasukan.reduce((s, t) => s + ((t.nominal as number) || 0), 0);
				const totalPengeluaran = pengeluaran.reduce((s, t) => s + ((t.nominal as number) || 0), 0);
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

	generateSmartCacheKey(type: string, dateRange: string, branch: string) {
		return `smart_${type}_${REPORT_CACHE_VERSION}_${branch}_${this.normalizeDateRange(dateRange, type)}`;
	}

	private normalizeDateRange(dateRange: string, type: string): string {
		if (type === 'weekly') {
			const day = new Date(`${dateRange}T00:00:00Z`).getUTCDay();
			return addDaysYmd(dateRange, -day);
		}
		return dateRange;
	}

	private getCacheOptionsForType(type: string): Record<string, unknown> {
		const base = { backgroundRefresh: true, staleWhileRevalidate: true };
		const ttlMap: Record<string, number> = {
			daily: 300000,
			weekly: 900000,
			monthly: 1800000,
			yearly: 3600000
		};
		return { ...base, ttl: ttlMap[type] || 300000 };
	}
}

export const dashboardService = DashboardService.getInstance();
