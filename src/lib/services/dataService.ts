import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { smartCache, CacheUtils, CACHE_KEYS } from '$lib/utils/cache';
import { formatWitaDateTime, getTodayWita, getNowWita, witaToUtcRange, witaRangeToUtcRange } from '$lib/utils/dateTime';
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
	const { startUtc: start7Utc } = witaToUtcRange(hariLabels[0]);
	const { endUtc: end7LastUtc } = witaToUtcRange(hariLabels[6]);
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
	const { startUtc, endUtc } = witaToUtcRange(todayStr);
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

				const { startUtc: start7Utc, endUtc: end7Utc } = witaToUtcRange(hariLabels[0]);
				const { endUtc: end7LastUtc } = witaToUtcRange(hariLabels[6]);

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

					const { startUtc, endUtc } = witaToUtcRange(tanggal);
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

		return CacheUtils.getReportData(cacheKey, dateRange, async (etag?: string) => {
			// Generate ETag based on date range and type
			const etagValue = `${type}_${dateRange}_${Date.now()}`;

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
					const { startUtc: startUtcTemp, endUtc } = witaToUtcRange(today);
					const { endUtc: endUtcFinalTemp } = witaToUtcRange(today);
					startUtc = startUtcTemp;
					endUtcFinal = endUtcFinalTemp;
				} catch (fallbackError) {
					console.error('Fallback date conversion also failed:', fallbackError);
					// Use hardcoded fallback
					startUtc = new Date().toISOString();
					endUtcFinal = new Date().toISOString();
				}
			}

			// PARALLEL PAGINATION: Ambil posBukuKas secara parallel
			const posBukuKas = await this.fetchAllDataParallel(
				'buku_kas',
				startDate + 'T00:00:00',
				endDate + 'T23:59:59',
				{ sumber: 'pos' }
			);
				

			// Ambil detail transaksi kasir untuk POS yang sudah difilter
			let posItems = [];
			if (posBukuKas && posBukuKas.length > 0) {
				// Gunakan buku_kas_id untuk relasi yang benar
				const bukuKasIds = posBukuKas.map((bk: any) => bk.id).filter(Boolean);
				
				// Batasi query jika terlalu banyak buku_kas_id
				let transaksiKasir, errorTransaksiKasir;
				if (bukuKasIds.length > 1000) {
					// Gunakan query berdasarkan created_at range sebagai alternatif
					const { data: transaksiKasirAlt, error: errorTransaksiKasirAlt } = await this.supabase
						.from('transaksi_kasir')
						.select('*, produk(name)')
						.gte('created_at', startDate + 'T00:00:00')
						.lte('created_at', endDate + 'T23:59:59');
					
					transaksiKasir = transaksiKasirAlt;
					errorTransaksiKasir = errorTransaksiKasirAlt;
				} else {
					const { data: transaksiKasirData, error: errorTransaksiKasirData } = await this.supabase
						.from('transaksi_kasir')
						.select('*, produk(name)')
						.in('buku_kas_id', bukuKasIds);
					
					transaksiKasir = transaksiKasirData;
					errorTransaksiKasir = errorTransaksiKasirData;
				}


				if (!errorTransaksiKasir && transaksiKasir) {
					// Gabungkan data buku_kas dengan transaksi_kasir menggunakan buku_kas_id
					posItems = transaksiKasir.map((tk: any) => {
						const bukuKas = posBukuKas.find((bk: any) => bk.id === tk.buku_kas_id);
						return {
							...tk,
							buku_kas: bukuKas
						};
					}).filter((item: any) => item.buku_kas); // Hanya ambil yang ada buku_kas-nya
					
				} else {
					posItems = [];
				}
			}

			// PARALLEL PAGINATION: Ambil manualItems secara parallel
			const manualItems = await this.fetchAllDataParallel(
				'buku_kas',
				startDate + 'T00:00:00',
				endDate + 'T23:59:59',
				{ sumber: { neq: 'pos' } }
			);


			// PARALLEL PAGINATION: Ambil semua data secara parallel
			const allBukuKas = await this.fetchAllDataParallel(
				'buku_kas',
				startDate + 'T00:00:00',
				endDate + 'T23:59:59'
			);
			



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
		await smartCache.clear();
	}

	// PARALLEL PAGINATION: Fetch all data using parallel queries
	async fetchAllDataParallel(
		table: string, 
		startTime: string, 
		endTime: string, 
		additionalFilters: any = {}
	): Promise<any[]> {
		try {
			// First, get total count to determine how many batches we need
			let query = this.supabase
				.from(table)
				.select('*', { count: 'exact', head: true })
				.gte('waktu', startTime)
				.lte('waktu', endTime);

			// Apply additional filters
			Object.keys(additionalFilters).forEach(key => {
				const filter = additionalFilters[key];
				if (typeof filter === 'object' && filter.neq) {
					query = query.neq(key, filter.neq);
				} else {
					query = query.eq(key, filter);
				}
			});

			const { count, error: countError } = await query;
			
			if (countError) {
				console.error('Error getting count:', countError);
				return [];
			}

			if (!count || count === 0) {
				return [];
			}

			// Calculate number of batches needed
			const batchSize = 1000;
			const totalBatches = Math.ceil(count / batchSize);
			
			// Create parallel queries for all batches
			const batchPromises = [];
			
			for (let i = 0; i < totalBatches; i++) {
				const offset = i * batchSize;
				const promise = this.fetchBatch(table, startTime, endTime, offset, batchSize, additionalFilters);
				batchPromises.push(promise);
			}

			// Execute all queries in parallel
			const batchResults = await Promise.all(batchPromises);
			
			// Combine all results
			const allData = [];
			for (const batchData of batchResults) {
				if (batchData && batchData.length > 0) {
					allData.push(...batchData);
				}
			}

			return allData;
		} catch (error) {
			console.error('Error in fetchAllDataParallel:', error);
			return [];
		}
	}

	// Helper function to fetch a single batch
	private async fetchBatch(
		table: string, 
		startTime: string, 
		endTime: string, 
		offset: number, 
		limit: number, 
		additionalFilters: any = {}
	): Promise<any[]> {
		try {
			let query = this.supabase
				.from(table)
				.select('*')
				.gte('waktu', startTime)
				.lte('waktu', endTime)
				.range(offset, offset + limit - 1)
				.order('waktu', { ascending: true });

			// Apply additional filters
			Object.keys(additionalFilters).forEach(key => {
				const filter = additionalFilters[key];
				if (typeof filter === 'object' && filter.neq) {
					query = query.neq(key, filter.neq);
				} else {
					query = query.eq(key, filter);
				}
			});

			const { data, error } = await query;
			
			if (error) {
				console.error(`Error fetching batch ${offset}-${offset + limit - 1}:`, error);
				return [];
			}

			return data || [];
		} catch (error) {
			console.error(`Error in fetchBatch ${offset}-${offset + limit - 1}:`, error);
			return [];
		}
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
