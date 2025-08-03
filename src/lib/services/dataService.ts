import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { smartCache, CacheUtils, CACHE_KEYS } from '$lib/utils/cache';
import { getWitaDateRangeUtc, formatWitaDateTime } from '$lib/utils/index';
import { browser } from '$app/environment';
import { get as getCache, set as setCache } from 'idb-keyval';
import { addPendingTransaction, getPendingTransactions, clearPendingTransactions } from '$lib/utils/offline';
import { get as idbGet, set as idbSet } from 'idb-keyval';

// Konstanta
const MS_PER_DAY = 86400000; // Milidetik dalam sehari

// Helper untuk dapatkan tanggal hari ini WITA (YYYY-MM-DD)
export function getTodayWitaStr() {
  const todayWita = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
  const yyyy = todayWita.getFullYear();
  const mm = String(todayWita.getMonth() + 1).padStart(2, '0');
  const dd = String(todayWita.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper untuk mendapatkan rentang waktu UTC hari ini
function getTodayUtcRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return {
    startUTC: start.toISOString(),
    endUTC: end.toISOString()
  };
}

// Helper untuk mendapatkan label tanggal WITA untuk beberapa hari ke belakang
function getWitaDateLabels(days: number): string[] {
  const labels: string[] = [];
  const todayWita = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayWita);
    d.setDate(todayWita.getDate() - i);
    labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return labels;
}

// Fungsi cache harian untuk rata-rata transaksi/hari
async function getAvgTransaksiHarian(supabase: SupabaseClient): Promise<number> {
  const todayStr = getTodayWitaStr();
  const cacheKey = `avg_transaksi_${todayStr}`;
  const cached = await getCache(cacheKey);
  if (cached && typeof cached.value === 'number' && Date.now() - cached.timestamp < MS_PER_DAY) {
    return cached.value;
  }
  // Hitung ulang
  const hariLabels = getWitaDateLabels(7);
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
    const transaksiPerHari: { [key: string]: Set<string> } = {}; // Menggunakan Set<string> untuk transaction_id
    for (const tanggal of hariLabels) {
      transaksiPerHari[tanggal] = new Set<string>();
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
    const totalTransaksi7Hari = (Object.values(transaksiPerHari) as Set<string>[]).reduce((sum, set) => sum + set.size, 0);
    avgTransaksi = Math.round(totalTransaksi7Hari / 7);
  }
  await setCache(cacheKey, { value: avgTransaksi, timestamp: Date.now() });
  return avgTransaksi;
}

// Fungsi cache harian untuk jam paling ramai
async function getJamRamaiHarian(supabase: SupabaseClient): Promise<string> {
  const todayStr = getTodayWitaStr();
  const cacheKey = `jam_ramai_${todayStr}`;
  const cached = await getCache(cacheKey);
  if (cached && typeof cached.value === 'string' && Date.now() - cached.timestamp < MS_PER_DAY) {
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
      const waktuWITA = new Date(waktu.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
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
    jamRamai = `${jamInt.toString().padStart(2, '0')}.00–${(jamInt+1).toString().padStart(2, '0')}.00`;
  }
  await setCache(cacheKey, { value: jamRamai, timestamp: Date.now() });
  return jamRamai;
}

// Fungsi generik untuk mengambil data dari Supabase dengan fallback IndexedDB
async function fetchAndCacheData<T>(
  supabaseClient: SupabaseClient,
  tableName: string,
  cacheKey: string,
  orderByColumn: string = 'created_at',
  ascending: boolean = false
): Promise<T[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = await idbGet(cacheKey);
    if (cached) return cached;
    return [];
  }
  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('*')
      .order(orderByColumn, { ascending });
    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      return [];
    }
    await idbSet(cacheKey, data || []);
    return data || [];
  } catch (e) {
    console.error(`Unexpected error fetching ${tableName}:`, e);
    return [];
  }
}

// Data service untuk fetching dengan smart caching
export class DataService {
  private static instance: DataService;
  private supabase: SupabaseClient; // Menggunakan tipe SupabaseClient
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
  get supabaseClient(): SupabaseClient {
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
    const { startUTC, endUTC } = getTodayUtcRange(); // Menggunakan helper

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
        profit: 0 // Default profit
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
      profit: omzet * 0.3, // Perhitungan profit dummy
      avgTransaksi,
      jamRamai
    };
  }

  // Best sellers dengan cache per cabang
  async getBestSellers() {
    const branch = storeGet(selectedBranch);
    return smartCache.get(`${CACHE_KEYS.BEST_SELLERS}_${branch}`, async () => {
      const hariLabels = getWitaDateLabels(7);
      const { startUtc: start7Utc, endUtc: end7LastUtc } = getWitaDateRangeUtc(hariLabels[0]);

      interface TransaksiKasirItem {
        produk_id: string | null;
        qty: number;
        created_at: string;
      }

      const { data: items, error } = await this.supabase
        .from('transaksi_kasir')
        .select('produk_id, qty, created_at')
        .gte('created_at', start7Utc)
        .lte('created_at', end7LastUtc) as { data: TransaksiKasirItem[] | null; error: any };

      let bestSellersResult: { name: string; image: string; total_qty: number }[] = [];
      if (!error && items) {
        const grouped: { [key: string]: number } = {};
        for (const item of items) {
          if (!item.produk_id) continue;
          grouped[item.produk_id] = (grouped[item.produk_id] || 0) + (item.qty || 1);
        }

        const topProdukIds = Object.entries(grouped)
          .sort(([, qtyA], [, qtyB]) => (qtyB as number) - (qtyA as number))
          .slice(0, 3)
          .map(([produk_id]) => produk_id);

        if (topProdukIds.length > 0) {
          interface ProdukItem {
            id: string;
            name: string;
            gambar: string;
          }
          const { data: allProducts } = await this.supabase
            .from('produk')
            .select('id, name, gambar') as { data: ProdukItem[] | null };
          
          if (allProducts) {
            bestSellersResult = topProdukIds.map((produk_id: string) => {
              const prod = allProducts.find((p: ProdukItem) => p.id === produk_id);
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
    }, {
      ttl: 300000, // 5 minutes
      backgroundRefresh: true
    });
  }

  // Weekly income dengan cache per cabang
  async getWeeklyIncome() {
    const branch = storeGet(selectedBranch);
    return smartCache.get(`${CACHE_KEYS.WEEKLY_INCOME}_${branch}`, async () => {
      const hariLabels = getWitaDateLabels(7);
      const weeklyIncome: number[] = [];
      let weeklyMax = 1;

      for (let i = 6; i >= 0; i--) {
        const tanggal = hariLabels[6 - i]; // Ambil tanggal dari hariLabels
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
    }, {
      ttl: 300000, // 5 minutes
      backgroundRefresh: true
    });
  }

  // Products dengan cache
  async getProducts() {
    return fetchAndCacheData<any>(this.supabase, 'produk', 'products', 'created_at', false);
  }

  // Categories dengan cache
  async getCategories() {
    return fetchAndCacheData<any>(this.supabase, 'kategori', 'categories', 'created_at', false);
  }

  // Add-ons dengan cache
  async getAddOns() {
    return fetchAndCacheData<any>(this.supabase, 'tambahan', 'addons', 'created_at', false);
  }

  // Report data dengan ETag support
  async getReportData(dateRange: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const cacheKey = `${type}_report_${dateRange}`;
    
    return CacheUtils.getReportData(cacheKey, dateRange, async (etag?: string) => {
      // ETag tidak lagi digenerate di sini, CacheUtils.getReportData yang menanganinya
      
      let startDateStr: string, endDateStr: string;
      
      switch (type) {
        case 'daily':
          startDateStr = dateRange.split('_')[0];
          endDateStr = dateRange.includes('_') ? dateRange.split('_')[1] : dateRange;
          break;
        case 'weekly':
          const date = new Date(dateRange);
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          startDateStr = startOfWeek.toISOString().split('T')[0];
          endDateStr = endOfWeek.toISOString().split('T')[0];
          break;
        case 'monthly':
          startDateStr = `${dateRange}-01`;
          const lastDayOfMonth = new Date(parseInt(dateRange.split('-')[0]), parseInt(dateRange.split('-')[1]), 0);
          endDateStr = lastDayOfMonth.toISOString().split('T')[0];
          break;
        case 'yearly':
          startDateStr = `${dateRange}-01-01`;
          endDateStr = `${dateRange}-12-31`;
          break;
        default:
          startDateStr = dateRange;
          endDateStr = dateRange;
      }

      let startUtc: string, endUtcFinal: string;
      
      try {
        const { startUtc: tempStartUtc, endUtc: tempEndUtc } = getWitaDateRangeUtc(startDateStr);
        const { endUtc: tempEndUtcFinal } = getWitaDateRangeUtc(endDateStr);
        startUtc = tempStartUtc;
        endUtcFinal = tempEndUtcFinal;
      } catch (error) {
        console.error('Error converting date range for report:', error, 'startDate:', startDateStr, 'endDate:', endDateStr);
        // Fallback to current date if date conversion fails
        const today = new Date().toISOString().split('T')[0];
        const { startUtc: tempStartUtc, endUtc: tempEndUtc } = getWitaDateRangeUtc(today);
        startUtc = tempStartUtc;
        endUtcFinal = tempEndUtc;
      }

      // Ambil transaksi POS dari buku_kas dulu
      const { data: posBukuKas, error: errorPosBukuKas } = await this.supabase
        .from('buku_kas')
        .select('*')
        .gte('waktu', startUtc)
        .lt('waktu', endUtcFinal)
        .eq('sumber', 'pos');
        
      // Ambil detail transaksi kasir untuk POS yang sudah difilter
      let posItems: any[] = [];
      if (posBukuKas && posBukuKas.length > 0) {
        const bukuKasIds = posBukuKas.map(bk => bk.id);
        const { data: transaksiKasir, error: errorTransaksiKasir } = await this.supabase
        .from('transaksi_kasir')
          .select('*, produk(name)')
          .in('buku_kas_id', bukuKasIds);
        
        if (!errorTransaksiKasir && transaksiKasir) {
          posItems = transaksiKasir.map(tk => {
            const bukuKas = posBukuKas.find(bk => bk.id === tk.buku_kas_id);
            return {
              ...tk,
              buku_kas: bukuKas
            };
          });
        }
      }
      
      // Ambil transaksi manual/catat
      const { data: manualItems, error: errorManual } = await this.supabase
        .from('buku_kas')
        .select('*')
        .gte('waktu', startUtc)
        .lt('waktu', endUtcFinal)
        .neq('sumber', 'pos');
        
      if (errorPosBukuKas || errorManual) {
        console.error('Error fetching report data:', errorPosBukuKas, errorManual);
        return { data: [], etag: etag }; // Menggunakan etag yang diterima
      }
      
      // Gabungkan hasil
      const laporan = [
        ...posItems.map(item => ({
          ...item,
          sumber: 'pos',
          payment_method: item.buku_kas?.payment_method,
          waktu: item.buku_kas?.waktu,
          jenis: item.buku_kas?.jenis,
          tipe: item.buku_kas?.tipe,
          // Untuk item POS, gunakan nama produk atau custom_name
          description: item.produk?.name || item.custom_name || 'Item Custom',
          // nominal transaksi per item = amount (sudah total, tidak perlu dikali qty lagi)
          nominal: item.amount || 0,
        })),
        ...(manualItems || []).map(item => ({
          ...item,
          sumber: item.sumber || 'catat',
          payment_method: item.payment_method,
          waktu: item.waktu,
          jenis: item.jenis,
          tipe: item.tipe,
          description: item.description,
          nominal: item.amount || 0,
        }))
      ];
      
      // Pemasukan/pengeluaran per jenis
      const pemasukan = laporan.filter((t: any) => t.tipe === 'in');
      const pengeluaran = laporan.filter((t: any) => t.tipe === 'out');
      
      // Hitung total pemasukan dan pengeluaran
      const totalPemasukan = pemasukan.reduce((sum: number, t: any) => sum + (t.nominal || 0), 0);
      const totalPengeluaran = pengeluaran.reduce((sum: number, t: any) => sum + (t.nominal || 0), 0);
      
      // Hitung Laba (Rugi) Kotor
      const labaKotor = totalPemasukan - totalPengeluaran;
      
      // Hitung Pajak Penghasilan (0,5% dari Laba Kotor, tapi 0 jika Laba Kotor < 0)
      const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0; // Perhitungan dummy
      
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
      return { data: reportData, etag: etag }; // Menggunakan etag yang diterima
    });
  }

  // Real-time data subscription
  subscribeToRealtimeData(table: string, callback: (payload: any) => void) {
    if (!browser) return null;

    const subscription = this.supabase
      .channel(`realtime_${table}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table }, 
        callback
      )
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
}

// Export singleton instance
export const dataService = DataService.getInstance();

// Real-time subscription manager
export class RealtimeManager {
  private subscriptions = new Map<string, RealtimeChannel>(); // Menggunakan tipe RealtimeChannel

  subscribe(table: string, callback: (payload: any) => void) {
    // Unsubscribe if already subscribed
    if (this.subscriptions.has(table)) {
      this.unsubscribe(table);
    }

    // FIX: Memanggil dataService.subscribeToRealtimeData
    const subscription = dataService.subscribeToRealtimeData(table, async (payload) => {
      // Invalidate cache when data changes
      await dataService.invalidateCacheOnChange(table);
      
      // Call the callback
      callback(payload);
    });

    if (subscription) { // Pastikan subscription tidak null
      this.subscriptions.set(table, subscription);
    }
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
        const { data: insertedBukuKas, error: bukuKasError } = await DataService.getInstance().supabase
          .from('buku_kas')
          .insert(trx.bukuKas)
          .select('id') // Meminta ID yang baru di-insert
          .single();
        
        if (bukuKasError) throw bukuKasError;
        bukuKasId = insertedBukuKas?.id || null;
      } else {
        // Jika tidak ada trx.bukuKas, berarti ini transaksi manual yang langsung masuk buku_kas
        await DataService.getInstance().supabase
          .from('buku_kas')
          .insert(trx);
      }

      if (trx.transaksiKasir && Array.isArray(trx.transaksiKasir) && trx.transaksiKasir.length) {
        // Update semua transaksiKasir dengan buku_kas_id
        const transaksiKasirWithId = trx.transaksiKasir.map(item => ({ ...item, buku_kas_id: bukuKasId }));
        await DataService.getInstance().supabase
          .from('transaksi_kasir')
          .insert(transaksiKasirWithId);
      }
    } catch (e) {
      console.error("Error syncing pending transaction:", e);
      // Jika gagal, stop sync (biar tidak hilang) dan biarkan di antrean
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