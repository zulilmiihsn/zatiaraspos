import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { smartCache, CacheUtils, CACHE_KEYS } from '$lib/utils/cache';
import { getWitaDateRangeUtc, formatWitaDateTime, getTodayWita, getNowWita, witaToUtcRange, witaRangeToUtcRange } from '$lib/utils/dateTime';
import { browser } from '$app/environment';
import { get as getCache, set as setCache } from 'idb-keyval';
import {
	addPendingTransaction,
	getPendingTransactions,
	clearPendingTransactions
} from '$lib/utils/offline';
import { get as idbGet, set as idbSet } from 'idb-keyval';

// DEPRECATED: Gunakan getTodayWita() dari dateTime utils
function getTodayWitaStr() {
	console.warn('getTodayWitaStr is deprecated. Use getTodayWita() from dateTime utils instead.');
	return getTodayWita();
}

// Fungsi cache harian untuk rata-rata transaksi/hari
async function getAvgTransaksiHarian(supabase: any): Promise<number> {
	const todayStr = getTodayWitaStr();
	const cacheKey = `avg_transaksi_${todayStr}`;
	const cached = await getCache(cacheKey);
	if (cached && typeof cached.value === 'number' && Date.now() - cached.timestamp < 86400000) {
		return cached.value;
	}
	// Hitung ulang
	const hariLabels = [];
		const todayWita = new Date(getTodayWita() + 'T00:00:00+08:00');
	for (let i = 6; i >= 0; i--) {
		const d = new Date(todayWita);
		d.setDate(todayWita.getDate() - i);
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		hariLabels.push(`${yyyy}-${mm}-${dd}`);
	}
	const { startUtc: start7Utc } = getWitaDateRangeUtc(hariLabels[0]);
	const { endUtc: end7LastUtc } = getWitaDateRangeUtc(hariLabels[6]);
	const { data: kas7, error: error7 } = await supabase
		.from('buku_kas')
		.select('transaction_id, waktu')
		.gte('waktu', start7Utc)
		.lte('waktu', end7LastUtc)
		.eq('sumber', 'pos');
	let avgTransaksi = 0;
	if (!error7 && kas7) {
		const transaksiPerHari: { [key: string]: Set<any> } = {};
		for (const tanggal of hariLabels) {
			transaksiPerHari[tanggal] = new Set<any>();
		}
		for (const t of kas7) {
			const waktu = new Date(t.waktu);
			const yyyy = waktu.getFullYear();
			const mm = String(waktu.getMonth() + 1).padStart(2, '0');
			const dd = String(waktu.getDate()).padStart(2, '0');
			const tanggal = `${yyyy}-${mm}-${dd}`;
			if (transaksiPerHari[tanggal] && t.transaction_id) {
				transaksiPerHari[tanggal].add(t.transaction_id);
			}
		}
		const totalTransaksi7Hari = (Object.values(transaksiPerHari) as Set<any>[]).reduce(
			(sum, set) => sum + set.size,
			0
		);
		avgTransaksi = Math.round(totalTransaksi7Hari / 7);
	}
	await setCache(cacheKey, { value: avgTransaksi, timestamp: Date.now() });
	return avgTransaksi;
}

// Fungsi cache harian untuk jam paling ramai
async function getJamRamaiHarian(supabase: any): Promise<string> {
	const todayStr = getTodayWitaStr();
	const cacheKey = `jam_ramai_${todayStr}`;
	const cached = await getCache(cacheKey);
	if (cached && typeof cached.value === 'string' && Date.now() - cached.timestamp < 86400000) {
		return cached.value;
	}
	// Hitung ulang
	const { startUtc, endUtc } = getWitaDateRangeUtc(todayStr);
	const { data: kas, error } = await supabase
		.from('buku_kas')
		.select('waktu')
		.gte('waktu', startUtc)
		.lte('waktu', endUtc)
		.eq('sumber', 'pos');
	const jamCount: { [key: string]: number } = {};
	if (!error && kas) {
		for (const t of kas) {
			const waktu = new Date(t.waktu);
			const waktuWITA = new Date(waktu);
			const jam = waktuWITA.getHours();
			jamCount[jam] = (jamCount[jam] || 0) + 1;
		}
	}
	let peakHour = '';
	let maxCount = 0;
	for (const [jam, count] of Object.entries(jamCount)) {
		if (count > maxCount) {
			maxCount = count;
			peakHour = jam;
		}
	}
	let jamRamai = '';
	if (peakHour !== '') {
		const jamInt = parseInt(peakHour, 10);
		jamRamai = `${jamInt.toString().padStart(2, '0')}.00–${(jamInt + 1).toString().padStart(2, '0')}.00`;
	}
	await setCache(cacheKey, { value: jamRamai, timestamp: Date.now() });
	return jamRamai;
}

// Data service untuk fetching dengan smart caching
export class DataService {
	private static instance: DataService;
	private supabase: any;
	private isInitialLoad = true; // Add flag to prevent double fetching

	constructor() {
		this.supabase = getSupabaseClient(storeGet(selectedBranch));
		// Subscribe ke selectedBranch agar supabase client ikut berubah
		selectedBranch.subscribe((branch) => {
			// Skip jika ini adalah initial load
			if (this.isInitialLoad) {
				this.isInitialLoad = false;
				return;
			}
			this.supabase = getSupabaseClient(branch);
		});
	}

	// Getter untuk supabase client
	get supabaseClient() {
		return this.supabase;
	}

	static getInstance(): DataService {
		if (!DataService.instance) {
			DataService.instance = new DataService();
		}
		return DataService.instance;
	}

	// Dashboard data fetching dengan cache
	async getDashboardStats() {
		const branch = storeGet(selectedBranch);
		// Ambil data real-time untuk metrik lain
		const todayStr = getTodayWita();

		// Data hari ini untuk item terjual, jumlah transaksi, omzet, dst
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
		const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
		const startUTC = start.toISOString();
		const endUTC = end.toISOString();
		// Ambil transaksi kasir untuk item terjual
		const { data: kasir, error: errorKasir } = await this.supabase
			.from('transaksi_kasir')
			.select('qty, transaction_id')
			.gte('created_at', startUTC)
			.lte('created_at', endUTC);
		// Ambil transaksi summary untuk jumlah transaksi & omzet
		const { data: kas, error } = await this.supabase
			.from('buku_kas')
			.select('*')
			.gte('waktu', startUTC)
			.lte('waktu', endUTC)
			.eq('sumber', 'pos');
		if (error || errorKasir) {
			console.error('Error fetching dashboard stats:', error, errorKasir);
			return {
				itemTerjual: 0,
				jumlahTransaksi: 0,
				omzet: 0,
				profit: 0,
				totalItem: 0,
				avgTransaksi: 0,
				jamRamai: '',
				weeklyIncome: [],
				weeklyMax: 1,
				bestSellers: []
			};
		}
		const itemTerjual = kasir?.reduce((sum: number, t: any) => sum + (t.qty || 1), 0) || 0;
		const transactionIds = new Set((kas || []).map((t: any) => t.transaction_id).filter(Boolean));
		const jumlahTransaksi = transactionIds.size > 0 ? transactionIds.size : kas.length;
		const omzet = kas.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

		// Ambil avgTransaksi dan jamRamai dari cache harian
		const avgTransaksi = await getAvgTransaksiHarian(this.supabase);
		const jamRamai = await getJamRamaiHarian(this.supabase);

		return {
			itemTerjual,
			jumlahTransaksi,
			omzet,
			profit: omzet * 0.3, // Dummy profit calculation
			totalItem: itemTerjual,
			avgTransaksi,
			jamRamai,
			weeklyIncome: [],
			weeklyMax: 1,
			bestSellers: []
		};
	}

	// Best sellers dengan cache per cabang
	async getBestSellers() {
		const branch = storeGet(selectedBranch);
		return smartCache.get(
			`${CACHE_KEYS.BEST_SELLERS}_${branch}`,
			async () => {
				const todayWita = new Date(
					getNowWita()
				);
				const yyyy = todayWita.getFullYear();
				const mm = String(todayWita.getMonth() + 1).padStart(2, '0');
				const dd = String(todayWita.getDate()).padStart(2, '0');
				const todayStr = `${yyyy}-${mm}-${dd}`;

				// --- GRAFIK 7 HARI TERAKHIR (WITA) ---
				const hariLabels: string[] = [];
				const pendapatanPerHari: Record<string, number> = {};
				for (let i = 6; i >= 0; i--) {
					const d = new Date(todayWita);
					d.setDate(todayWita.getDate() - i);
					const yyyy = d.getFullYear();
					const mm = String(d.getMonth() + 1).padStart(2, '0');
					const dd = String(d.getDate()).padStart(2, '0');
					const tanggal = `${yyyy}-${mm}-${dd}`;
					hariLabels.push(tanggal);
					pendapatanPerHari[tanggal] = 0;
				}

				const { startUtc: start7Utc, endUtc: end7Utc } = getWitaDateRangeUtc(hariLabels[0]);
				const { endUtc: end7LastUtc } = getWitaDateRangeUtc(hariLabels[6]);

				const { data: items, error } = await this.supabase
					.from('transaksi_kasir')
					.select('produk_id, qty, created_at')
					.gte('created_at', start7Utc)
					.lte('created_at', end7LastUtc);

				let bestSellersResult: any[] = [];
				if (!error && items) {
					const grouped: { [key: string]: any } = {};
					for (const item of items) {
						if (!item.produk_id) continue;
						if (!grouped[item.produk_id]) grouped[item.produk_id] = 0;
						grouped[item.produk_id] += item.qty || 1;
					}

					const topProdukIds = Object.entries(grouped)
						.sort((a: any, b: any) => b[1] - a[1])
						.slice(0, 3)
						.map(([produk_id]) => produk_id);

					if (topProdukIds.length > 0) {
						const { data: allProducts } = await this.supabase
							.from('produk')
							.select('id, name, gambar');

						const validProdukIds = topProdukIds.filter(
							(id: string) => allProducts && allProducts.some((p: any) => p.id === id)
						);

						if (validProdukIds.length > 0) {
							bestSellersResult = validProdukIds.map((produk_id: string) => {
								const prod = allProducts.find((p: any) => p.id === produk_id);
								return {
									name: prod?.name || '-',
									image: prod?.gambar || '',
									total_qty: grouped[produk_id]
								};
							});
						}
					}
				}

				return bestSellersResult;
			},
			{
				ttl: 300000, // 5 minutes
				backgroundRefresh: true
			}
		);
	}

	// Weekly income dengan cache per cabang
	async getWeeklyIncome() {
		const branch = storeGet(selectedBranch);
		return smartCache.get(
			`${CACHE_KEYS.WEEKLY_INCOME}_${branch}`,
			async () => {
				const todayWita = new Date(
					getNowWita()
				);
				const weeklyIncome = [];
				let weeklyMax = 1;

				for (let i = 6; i >= 0; i--) {
					const d = new Date(todayWita);
					d.setDate(todayWita.getDate() - i);
					const yyyy = d.getFullYear();
					const mm = String(d.getMonth() + 1).padStart(2, '0');
					const dd = String(d.getDate()).padStart(2, '0');
					const tanggal = `${yyyy}-${mm}-${dd}`;

					const { startUtc, endUtc } = getWitaDateRangeUtc(tanggal);
					const { data: kas } = await this.supabase
						.from('buku_kas')
						.select('amount')
						.gte('waktu', startUtc)
						.lte('waktu', endUtc)
						.eq('sumber', 'pos')
						.eq('tipe', 'in');

					const dailyIncome = kas?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0;
					weeklyIncome.push(dailyIncome);
					weeklyMax = Math.max(weeklyMax, dailyIncome);
				}

				return { weeklyIncome, weeklyMax };
			},
			{
				ttl: 300000, // 5 minutes
				backgroundRefresh: true
			}
		);
	}

	// Products dengan cache
	async getProducts() {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			const cached = await idbGet('products');
			if (cached) return cached;
			return [];
		}
		const { data, error } = await this.supabase
			.from('produk')
			.select('*')
			.order('created_at', { ascending: false });
		if (error) {
			console.error('Error fetching products:', error);
			return [];
		}
		await idbSet('products', data || []);
		return data || [];
	}

	// Categories dengan cache
	async getCategories() {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			const cached = await idbGet('categories');
			if (cached) return cached;
			return [];
		}
		const { data, error } = await this.supabase
			.from('kategori')
			.select('*')
			.order('created_at', { ascending: false });
		if (error) {
			console.error('Error fetching categories:', error);
			return [];
		}
		await idbSet('categories', data || []);
		return data || [];
	}

	// Add-ons dengan cache
	async getAddOns() {
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			const cached = await idbGet('addons');
			if (cached) return cached;
			return [];
		}
		const { data, error } = await this.supabase
			.from('tambahan')
			.select('*')
			.order('created_at', { ascending: false });
		if (error) {
			console.error('Error fetching add-ons:', error);
			return [];
		}
		await idbSet('addons', data || []);
		return data || [];
	}

	// Report data dengan ETag support
	async getReportData(dateRange: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
		const cacheKey = `${type}_report_${dateRange}`;

		console.log('getReportData - Cache key:', cacheKey);

		// Debug: Bypass cache untuk troubleshooting
		console.log('getReportData - BYPASSING CACHE FOR DEBUG');
		return this.fetchReportDataDirectly(dateRange, type);
	}

	// Direct data fetch without cache for debugging
	async fetchReportDataDirectly(dateRange: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
		const cacheKey = `${type}_report_${dateRange}`;
		return CacheUtils.getReportData(cacheKey, dateRange, async (etag?: string) => {
			// Generate ETag based on date range and type
			const etagValue = `${type}_${dateRange}_${Date.now()}`;
			
			console.log('getReportData - Starting fresh data fetch:', {
				cacheKey,
				dateRange,
				type,
				etagValue
			});

			let startDate: string, endDate: string;

			switch (type) {
				case 'daily':
					// Handle both single date and date range
					if (dateRange.includes('_')) {
						const [start, end] = dateRange.split('_');
						startDate = start;
						endDate = end;
					} else {
						startDate = dateRange;
						endDate = dateRange;
					}
					break;
				case 'weekly':
					// Calculate week range
					const date = new Date(dateRange);
					const startOfWeek = new Date(date);
					startOfWeek.setDate(date.getDate() - date.getDay());
					const endOfWeek = new Date(startOfWeek);
					endOfWeek.setDate(startOfWeek.getDate() + 6);
					startDate = startOfWeek.toISOString().split('T')[0];
					endDate = endOfWeek.toISOString().split('T')[0];
					break;
				case 'monthly':
					startDate = `${dateRange}-01`;
					const lastDay = new Date(
						parseInt(dateRange.split('-')[0]),
						parseInt(dateRange.split('-')[1]),
						0
					);
					endDate = lastDay.toISOString().split('T')[0];
					break;
				case 'yearly':
					startDate = `${dateRange}-01-01`;
					endDate = `${dateRange}-12-31`;
					break;
				default:
					startDate = dateRange;
					endDate = dateRange;
			}

			let startUtc: string, endUtcFinal: string;

			console.log('getReportData - Processing date range:', {
				dateRange,
				type,
				startDate,
				endDate,
				cacheKey
			});

			try {
				// STANDAR: Gunakan fungsi timezone yang konsisten
				if (startDate === endDate) {
					// Single date: gunakan witaToUtcRange
					const { startUtc: startUtcTemp, endUtc: endUtcTemp } = witaToUtcRange(startDate);
					startUtc = startUtcTemp;
					endUtcFinal = endUtcTemp;
				} else {
					// Range date: gunakan witaRangeToUtcRange
					const { startUtc: startUtcTemp, endUtc: endUtcTemp } = witaRangeToUtcRange(startDate, endDate);
				startUtc = startUtcTemp;
					endUtcFinal = endUtcTemp;
				}
				
			console.log('getReportData - UTC conversion (simplified):', {
				startDate,
				endDate,
				startUtc,
				endUtcFinal,
				cacheKey,
				startUtcDate: new Date(startUtc),
				endUtcDate: new Date(endUtcFinal)
			});
			} catch (error) {
				console.error(
					'Error converting date range:',
					error,
					'startDate:',
					startDate,
					'endDate:',
					endDate
				);
				// Fallback to current date if date conversion fails
				const today = new Date().toISOString().split('T')[0];
				try {
					const { startUtc: startUtcTemp, endUtc } = getWitaDateRangeUtc(today);
					const { endUtc: endUtcFinalTemp } = getWitaDateRangeUtc(today);
					startUtc = startUtcTemp;
					endUtcFinal = endUtcFinalTemp;
				} catch (fallbackError) {
					console.error('Fallback date conversion also failed:', fallbackError);
					// Use hardcoded fallback
					startUtc = new Date().toISOString();
					endUtcFinal = new Date().toISOString();
				}
			}

			// PERBAIKAN: Gunakan pagination untuk posBukuKas juga
			console.log('getReportData - Querying posBukuKas with pagination...');
			let posBukuKas: any[] = [];
			let posHasMore = true;
			let posOffset = 0;
			const posLimit = 1000;
			
			while (posHasMore) {
				const { data: posBatchData, error: errorPosBatch } = await this.supabase
					.from('buku_kas')
					.select('*')
					.gte('waktu', startDate + 'T00:00:00')
					.lte('waktu', endDate + 'T23:59:59')
					.eq('sumber', 'pos')
					.range(posOffset, posOffset + posLimit - 1)
					.order('waktu', { ascending: true });
				
				if (errorPosBatch) {
					console.error('getReportData - Error fetching pos batch:', errorPosBatch);
					break;
				}
				
				if (posBatchData && posBatchData.length > 0) {
					posBukuKas = posBukuKas.concat(posBatchData);
					posOffset += posLimit;
					posHasMore = posBatchData.length === posLimit;
					
					console.log(`getReportData - Fetched pos batch ${Math.floor(posOffset/posLimit)}: ${posBatchData.length} records (total: ${posBukuKas.length})`);
				} else {
					posHasMore = false;
				}
			}
				
			console.log('getReportData - posBukuKas query result:', {
				dataCount: posBukuKas?.length || 0,
				totalAmount: posBukuKas?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0,
				sampleData: posBukuKas?.slice(0, 2)
			});

			// Ambil detail transaksi kasir untuk POS yang sudah difilter
			let posItems = [];
			if (posBukuKas && posBukuKas.length > 0) {
				// Gunakan buku_kas_id untuk relasi yang benar
				const bukuKasIds = posBukuKas.map((bk: any) => bk.id).filter(Boolean);
				console.log('getReportData - Querying transaksi_kasir by buku_kas_id:', {
					bukuKasIdsCount: bukuKasIds.length,
					sampleBukuKasIds: bukuKasIds.slice(0, 5),
					posBukuKasCount: posBukuKas.length,
					samplePosBukuKas: posBukuKas.slice(0, 2)
				});
				
				// PERBAIKAN: Batasi query jika terlalu banyak buku_kas_id
				let transaksiKasir, errorTransaksiKasir;
				if (bukuKasIds.length > 1000) {
					console.log('getReportData - Too many buku_kas_ids, using alternative query method');
					// Gunakan query berdasarkan created_at range sebagai alternatif
					const { data: transaksiKasirAlt, error: errorTransaksiKasirAlt } = await this.supabase
						.from('transaksi_kasir')
						.select('*, produk(name)')
						.gte('created_at', startDate + 'T00:00:00')
						.lte('created_at', endDate + 'T23:59:59');
					
					transaksiKasir = transaksiKasirAlt;
					errorTransaksiKasir = errorTransaksiKasirAlt;
					
					console.log('getReportData - Alternative transaksi_kasir query result:', {
						dataCount: transaksiKasir?.length || 0,
						error: errorTransaksiKasir,
						query: `created_at >= '${startDate}T00:00:00' AND created_at <= '${endDate}T23:59:59'`
					});
				} else {
					const { data: transaksiKasirData, error: errorTransaksiKasirData } = await this.supabase
						.from('transaksi_kasir')
						.select('*, produk(name)')
						.in('buku_kas_id', bukuKasIds);
					
					transaksiKasir = transaksiKasirData;
					errorTransaksiKasir = errorTransaksiKasirData;
				}

				console.log('getReportData - transaksi_kasir query result:', {
					dataCount: transaksiKasir?.length || 0,
					error: errorTransaksiKasir,
					errorDetails: errorTransaksiKasir ? {
						message: errorTransaksiKasir.message,
						details: errorTransaksiKasir.details,
						hint: errorTransaksiKasir.hint,
						code: errorTransaksiKasir.code
					} : null,
					sampleData: transaksiKasir?.slice(0, 2),
					bukuKasIdsCount: bukuKasIds.length,
					sampleBukuKasIds: bukuKasIds.slice(0, 5)
				});

				if (!errorTransaksiKasir && transaksiKasir) {
					// Gabungkan data buku_kas dengan transaksi_kasir menggunakan buku_kas_id
					posItems = transaksiKasir.map((tk: any) => {
						const bukuKas = posBukuKas.find((bk: any) => bk.id === tk.buku_kas_id);
						return {
							...tk,
							buku_kas: bukuKas
						};
					}).filter((item: any) => item.buku_kas); // Hanya ambil yang ada buku_kas-nya
					
					console.log('getReportData - posItems created from transaksi_kasir:', {
						posItemsCount: posItems.length,
						totalTransaksiKasir: transaksiKasir.length,
						matchedWithBukuKas: posItems.length,
						samplePosItem: posItems[0]
					});
				} else {
					console.log('getReportData - Error or no data in transaksi_kasir:', {
						error: errorTransaksiKasir,
						dataCount: transaksiKasir?.length || 0
					});
					posItems = [];
				}
			}

			// PERBAIKAN: Gunakan pagination untuk manualItems juga
			console.log('getReportData - Querying manualItems with pagination...');
			let manualItems: any[] = [];
			let manualHasMore = true;
			let manualOffset = 0;
			const manualLimit = 1000;
			
			while (manualHasMore) {
				const { data: manualBatchData, error: errorManualBatch } = await this.supabase
					.from('buku_kas')
					.select('*')
					.gte('waktu', startDate + 'T00:00:00')
					.lte('waktu', endDate + 'T23:59:59')
					.neq('sumber', 'pos')
					.range(manualOffset, manualOffset + manualLimit - 1)
					.order('waktu', { ascending: true });
				
				if (errorManualBatch) {
					console.error('getReportData - Error fetching manual batch:', errorManualBatch);
					break;
				}
				
				if (manualBatchData && manualBatchData.length > 0) {
					manualItems = manualItems.concat(manualBatchData);
					manualOffset += manualLimit;
					manualHasMore = manualBatchData.length === manualLimit;
					
					console.log(`getReportData - Fetched manual batch ${Math.floor(manualOffset/manualLimit)}: ${manualBatchData.length} records (total: ${manualItems.length})`);
				} else {
					manualHasMore = false;
				}
			}

			console.log('getReportData - manual items query result:', {
				dataCount: manualItems?.length || 0,
				totalAmount: manualItems?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0,
				sampleData: manualItems?.slice(0, 2)
			});

			// PERBAIKAN: Gunakan pagination untuk mengambil semua data (mengatasi limit 1000)
			let allBukuKas: any[] = [];
			let hasMore = true;
			let offset = 0;
			const limit = 1000;
			
			console.log('getReportData - Fetching all data with pagination...');
			
			while (hasMore) {
				const { data: batchData, error: errorBatch } = await this.supabase
					.from('buku_kas')
					.select('*')
					.gte('waktu', startDate + 'T00:00:00')
					.lte('waktu', endDate + 'T23:59:59')
					.range(offset, offset + limit - 1)
					.order('waktu', { ascending: true });
				
				if (errorBatch) {
					console.error('getReportData - Error fetching batch:', errorBatch);
					break;
				}
				
				if (batchData && batchData.length > 0) {
					allBukuKas = allBukuKas.concat(batchData);
					offset += limit;
					hasMore = batchData.length === limit; // Lanjut jika batch penuh
					
					console.log(`getReportData - Fetched batch ${Math.floor(offset/limit)}: ${batchData.length} records (total: ${allBukuKas.length})`);
				} else {
					hasMore = false;
				}
			}
			
			console.log('getReportData - Pagination complete:', {
				totalRecords: allBukuKas.length,
				totalBatches: Math.ceil(offset / limit)
			});

			console.log('getReportData - All buku_kas (using pagination):', {
				dataCount: allBukuKas?.length || 0,
				totalAmount: allBukuKas?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0,
				query: `waktu >= '${startDate}T00:00:00' AND waktu <= '${endDate}T23:59:59'`,
				dateRange: `${startDate} to ${endDate}`,
				sampleData: allBukuKas?.slice(0, 2)
			});

			// DEBUG: Periksa data yang tersimpan di database untuk troubleshooting
			if (type === 'yearly' && allBukuKas && allBukuKas.length > 0) {
				console.log('DEBUG - Sample data timestamps from database:');
				allBukuKas.slice(0, 5).forEach((item: any, index: number) => {
					console.log(`Item ${index + 1}:`, {
						id: item.id,
						waktu: item.waktu,
						waktuLocal: new Date(item.waktu).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }),
						amount: item.amount,
						sumber: item.sumber,
						description: item.description
					});
				});

				// DEBUG: Periksa data Agustus dan September secara spesifik
				const augustData = allBukuKas.filter((item: any) => {
					const date = new Date(item.waktu);
					return date.getMonth() === 7 && date.getFullYear() === 2025; // Agustus = month 7
				});
				const septemberData = allBukuKas.filter((item: any) => {
					const date = new Date(item.waktu);
					return date.getMonth() === 8 && date.getFullYear() === 2025; // September = month 8
				});

				console.log('DEBUG - August 2025 data:', {
					count: augustData.length,
					totalAmount: augustData.reduce((sum: number, item: any) => sum + (item.amount || 0), 0),
					sample: augustData.slice(0, 2)
				});

				console.log('DEBUG - September 2025 data:', {
					count: septemberData.length,
					totalAmount: septemberData.reduce((sum: number, item: any) => sum + (item.amount || 0), 0),
					sample: septemberData.slice(0, 2)
				});

				// DEBUG: Periksa apakah ada data yang tidak ter-fetch karena timezone
				console.log('DEBUG - Checking for data outside query range:');
				const allData = allBukuKas;
				const dataOutsideRange = allData.filter((item: any) => {
					const itemDate = new Date(item.waktu);
					const itemYear = itemDate.getFullYear();
					const itemMonth = itemDate.getMonth();
					return itemYear === 2025 && (itemMonth === 7 || itemMonth === 8); // Agustus atau September
				});

				console.log('DEBUG - Data outside query range (Aug-Sep 2025):', {
					count: dataOutsideRange.length,
					totalAmount: dataOutsideRange.reduce((sum: number, item: any) => sum + (item.amount || 0), 0),
					sample: dataOutsideRange.slice(0, 3)
				});
			}

			// Debug: Bandingkan dengan query UTC untuk troubleshooting
			const { data: allBukuKasUtc, error: errorAllBukuKasUtc } = await this.supabase
				.from('buku_kas')
				.select('*')
				.gte('waktu', startUtc)
				.lte('waktu', endUtcFinal);

			console.log('getReportData - All buku_kas (UTC query comparison):', {
				dataCount: allBukuKasUtc?.length || 0,
				error: errorAllBukuKasUtc,
				totalAmount: allBukuKasUtc?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0,
				query: `waktu >= '${startUtc}' AND waktu <= '${endUtcFinal}'`,
				dateRange: `${startDate} to ${endDate}`,
				comparison: {
					stringQuery: `waktu >= '${startDate}T00:00:00' AND waktu <= '${endDate}T23:59:59'`,
					utcQuery: `waktu >= '${startUtc}' AND waktu <= '${endUtcFinal}'`
				}
			});

			// DEBUG: Periksa data yang tersimpan di database dengan range yang lebih luas
			if (type === 'yearly') {
				console.log('DEBUG - Checking all data in database for 2025:');
				const { data: allData2025, error: errorAllData2025 } = await this.supabase
					.from('buku_kas')
					.select('*')
					.gte('waktu', '2025-01-01T00:00:00')
					.lte('waktu', '2025-12-31T23:59:59');

				console.log('DEBUG - All data in 2025:', {
					dataCount: allData2025?.length || 0,
					error: errorAllData2025,
					totalAmount: allData2025?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0,
					query: `waktu >= '2025-01-01T00:00:00' AND waktu <= '2025-12-31T23:59:59'`
				});

				// DEBUG: Periksa data per bulan untuk 2025
				if (allData2025 && allData2025.length > 0) {
					const monthlyData: { [key: string]: { count: number; total: number } } = {};
					allData2025.forEach((item: any) => {
						const date = new Date(item.waktu);
						const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
						if (!monthlyData[monthKey]) {
							monthlyData[monthKey] = { count: 0, total: 0 };
						}
						monthlyData[monthKey].count++;
						monthlyData[monthKey].total += item.amount || 0;
					});

					console.log('DEBUG - Monthly breakdown for 2025:', monthlyData);
				}

				// DEBUG: Periksa data yang tersimpan dengan timezone yang berbeda
				console.log('DEBUG - Checking data with different timezone ranges:');
				const { data: dataWithTimezone1, error: errorTz1 } = await this.supabase
					.from('buku_kas')
					.select('*')
					.gte('waktu', '2024-12-31T16:00:00.000Z') // UTC untuk 2025-01-01 00:00 WITA
					.lte('waktu', '2025-12-31T15:59:59.999Z'); // UTC untuk 2025-12-31 23:59 WITA

				console.log('DEBUG - Data with WITA timezone range:', {
					dataCount: dataWithTimezone1?.length || 0,
					error: errorTz1,
					totalAmount: dataWithTimezone1?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0,
					query: `waktu >= '2024-12-31T16:00:00.000Z' AND waktu <= '2025-12-31T15:59:59.999Z'`
				});

				// DEBUG: Periksa data yang tersimpan dengan timezone browser (UTC+7)
				const { data: dataWithTimezone2, error: errorTz2 } = await this.supabase
					.from('buku_kas')
					.select('*')
					.gte('waktu', '2024-12-31T17:00:00.000Z') // UTC untuk 2025-01-01 00:00 WIB
					.lte('waktu', '2025-12-31T16:59:59.999Z'); // UTC untuk 2025-12-31 23:59 WIB

				console.log('DEBUG - Data with WIB timezone range:', {
					dataCount: dataWithTimezone2?.length || 0,
					error: errorTz2,
					totalAmount: dataWithTimezone2?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0,
					query: `waktu >= '2024-12-31T17:00:00.000Z' AND waktu <= '2025-12-31T16:59:59.999Z'`
				});
			}

			// Error handling sudah ditangani dalam loop pagination

			// Gunakan data yang lebih lengkap untuk laporan
			const laporan: any[] = [];
			
			// Tambahkan data POS dari transaksi_kasir
			posItems.forEach((item: any) => {
				laporan.push({
					...item,
					sumber: 'pos',
					payment_method: item.buku_kas?.payment_method,
					waktu: item.buku_kas?.waktu,
					jenis: item.buku_kas?.jenis,
					tipe: item.buku_kas?.tipe,
					description: item.produk?.name || item.custom_name || 'Item Custom',
					nominal: item.amount || 0
				});
			});
			
			// Tambahkan data manual/catat
			(manualItems || []).forEach((item: any) => {
				laporan.push({
					...item,
					sumber: item.sumber || 'catat',
					payment_method: item.payment_method,
					waktu: item.waktu,
					jenis: item.jenis,
					tipe: item.tipe,
					description: item.description,
					nominal: item.amount || 0
				});
			});
			
			// Jika masih kurang data, gunakan data buku_kas yang belum terhitung
			const usedBukuKasIds = new Set(posItems.map((item: any) => item.buku_kas?.id).filter(Boolean));
			const remainingBukuKas = (allBukuKas || []).filter((item: any) => !usedBukuKasIds.has(item.id));
			
			remainingBukuKas.forEach((item: any) => {
				laporan.push({
					...item,
					sumber: item.sumber || 'lainnya',
					payment_method: item.payment_method,
					waktu: item.waktu,
					jenis: item.jenis,
					tipe: item.tipe,
					description: item.description || 'Transaksi Lainnya',
					nominal: item.amount || 0
				});
			});

			console.log('getReportData - Final laporan data:', {
				totalLaporanItems: laporan.length,
				posItemsCount: posItems.length,
				manualItemsCount: manualItems?.length || 0,
				remainingBukuKasCount: remainingBukuKas.length,
				totalBukuKasCount: allBukuKas?.length || 0,
				totalAmount: laporan.reduce((sum: number, item: any) => sum + (item.nominal || 0), 0),
				dateRange: `${startDate} to ${endDate}`,
				cacheKey,
				sampleLaporanItem: laporan[0]
			});

			// Debug: Breakdown data berdasarkan sumber
			const posData = laporan.filter(item => item.sumber === 'pos');
			const manualData = laporan.filter(item => item.sumber !== 'pos');
			
			console.log('getReportData - Data breakdown by source:', {
				posDataCount: posData.length,
				posDataTotal: posData.reduce((sum: number, item: any) => sum + (item.nominal || 0), 0),
				manualDataCount: manualData.length,
				manualDataTotal: manualData.reduce((sum: number, item: any) => sum + (item.nominal || 0), 0),
				totalLaporanAmount: laporan.reduce((sum: number, item: any) => sum + (item.nominal || 0), 0),
				dateRange: `${startDate} to ${endDate}`,
				filterType: type,
				cacheKey
			});

			// Pemasukan/pengeluaran per jenis
			const pemasukan = laporan.filter((t: any) => t.tipe === 'in');
			const pengeluaran = laporan.filter((t: any) => t.tipe === 'out');

			// Hitung total pemasukan dan pengeluaran
			const totalPemasukan = pemasukan.reduce((sum: number, t: any) => sum + (t.nominal || 0), 0);
			const totalPengeluaran = pengeluaran.reduce(
				(sum: number, t: any) => sum + (t.nominal || 0),
				0
			);

			// Hitung Laba (Rugi) Kotor
			const labaKotor = totalPemasukan - totalPengeluaran;

			// Hitung Pajak Penghasilan (0,5% dari Laba Kotor, tapi 0 jika Laba Kotor < 0)
			const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;

			// Hitung Laba (Rugi) Bersih
			const labaBersih = labaKotor - pajak;

			console.log('getReportData - Summary calculation:', {
				totalPemasukan,
				totalPengeluaran,
				labaKotor,
				pajak,
				labaBersih,
				dateRange: `${startDate} to ${endDate}`,
				filterType: type,
				cacheKey
			});

			const reportData = {
				summary: {
					pendapatan: totalPemasukan,
					pengeluaran: totalPengeluaran,
					saldo: totalPemasukan - totalPengeluaran,
					labaKotor,
					pajak,
					labaBersih
				},
				pemasukanUsaha: pemasukan.filter((t: any) => t.jenis === 'pendapatan_usaha'),
				pemasukanLain: pemasukan.filter((t: any) => t.jenis === 'lainnya'),
				bebanUsaha: pengeluaran.filter((t: any) => t.jenis === 'beban_usaha'),
				bebanLain: pengeluaran.filter((t: any) => t.jenis === 'lainnya'),
				transactions: laporan
			};
			console.log('getReportData - Final report data:', {
				summary: reportData.summary,
				dateRange: `${startDate} to ${endDate}`,
				filterType: type,
				cacheKey
			});

			return { data: reportData, etag: etagValue };
		});
	}

	// Real-time data subscription
	subscribeToRealtimeData(table: string, callback: (payload: any) => void) {
		if (!browser) return null;

		const subscription = this.supabase
			.channel(`realtime_${table}`)
			.on('postgres_changes', { event: '*', schema: 'public', table }, callback)
			.subscribe();

		return subscription;
	}

	// Invalidate cache when data changes
	async invalidateCacheOnChange(table: string) {
		switch (table) {
			case 'produk':
			case 'kategori':
			case 'tambahan':
				await CacheUtils.invalidatePOSData();
				break;
			case 'buku_kas':
			case 'transaksi_kasir':
				await CacheUtils.invalidateDashboardData();
				await CacheUtils.invalidateReportData();
				break;
			case 'profil':
				await smartCache.invalidate(CACHE_KEYS.USER_PROFILE);
				await smartCache.invalidate(CACHE_KEYS.USER_ROLE);
				break;
			case 'pengaturan':
				await smartCache.invalidate(CACHE_KEYS.SECURITY_SETTINGS);
				break;
		}
	}

	// Force refresh specific data
	async forceRefresh(key: string) {
		await smartCache.invalidate(key);
	}

	// Get cache statistics
	getCacheStats() {
		return smartCache.getStats();
	}

	// Clear all caches
	async clearAllCaches() {
		console.log('clearAllCaches - Clearing all caches');
		await smartCache.clear();
		console.log('clearAllCaches - All caches cleared');
	}
}

// Export singleton instance
export const dataService = DataService.getInstance();

// Real-time subscription manager
export class RealtimeManager {
	private subscriptions = new Map<string, any>();

	subscribe(table: string, callback: (payload: any) => void) {
		// Unsubscribe if already subscribed
		if (this.subscriptions.has(table)) {
			this.unsubscribe(table);
		}

		const subscription = dataService.subscribeToRealtimeData(table, async (payload) => {
			// Invalidate cache when data changes
			await dataService.invalidateCacheOnChange(table);

			// Call the callback
			callback(payload);
		});

		this.subscriptions.set(table, subscription);
	}

	unsubscribe(table: string) {
		const subscription = this.subscriptions.get(table);
		if (subscription) {
			subscription.unsubscribe();
			this.subscriptions.delete(table);
		}
	}

	unsubscribeAll() {
		for (const [table, subscription] of this.subscriptions.entries()) {
			subscription.unsubscribe();
		}
		this.subscriptions.clear();
	}
}

export const realtimeManager = new RealtimeManager();

// Auto-cleanup on page unload
if (browser) {
	window.addEventListener('beforeunload', () => {
		realtimeManager.unsubscribeAll();
	});
}

export async function syncPendingTransactions() {
	const pendings = await getPendingTransactions();
	if (!pendings.length) return;
	for (const trx of pendings) {
		try {
			let bukuKasId = null;
			if (trx.bukuKas) {
				// Insert ke buku_kas
				await dataService.supabaseClient.from('buku_kas').insert(trx.bukuKas);
				// Ambil id row yang baru berdasarkan transaction_id
				const { data: lastBukuKas } = await dataService.supabaseClient
					.from('buku_kas')
					.select('id')
					.eq('transaction_id', trx.bukuKas.transaction_id)
					.order('waktu', { ascending: false })
					.limit(1)
					.maybeSingle();
				bukuKasId = lastBukuKas?.id || null;
			} else {
				await dataService.supabaseClient.from('buku_kas').insert(trx);
			}
			if (trx.transaksiKasir && Array.isArray(trx.transaksiKasir) && trx.transaksiKasir.length) {
				// Update semua transaksiKasir dengan buku_kas_id
				const transaksiKasirWithId = trx.transaksiKasir.map((item: any) => ({
					...item,
					buku_kas_id: bukuKasId
				}));
				await dataService.supabaseClient.from('transaksi_kasir').insert(transaksiKasirWithId);
			}
		} catch (e) {
			// Jika gagal, stop sync (biar tidak hilang)
			return;
		}
	}
	await clearPendingTransactions();
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('pending-synced'));
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', syncPendingTransactions);
}
