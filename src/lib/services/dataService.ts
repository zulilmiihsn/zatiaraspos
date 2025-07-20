import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { smartCache, CacheUtils, CACHE_KEYS } from '$lib/utils/cache';
import { getWitaDateRangeUtc, formatWitaDateTime } from '$lib/utils/index';
import { browser } from '$app/environment';

// Data service untuk fetching dengan smart caching
export class DataService {
  private static instance: DataService;
  private supabase: any;

  constructor() {
    this.supabase = getSupabaseClient(storeGet(selectedBranch));
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
    return CacheUtils.getDashboardStats(async () => {
      const todayWita = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
      const yyyy = todayWita.getFullYear();
      const mm = String(todayWita.getMonth() + 1).padStart(2, '0');
      const dd = String(todayWita.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      // --- Perhitungan 7 hari terakhir untuk avgTransaksi ---
      const hariLabels = [];
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
      // Ambil semua transaksi 7 hari terakhir
      const { data: kas7, error: error7 } = await this.supabase
        .from('buku_kas')
        .select('transaction_id, waktu')
        .gte('waktu', start7Utc)
        .lte('waktu', end7LastUtc)
        .eq('sumber', 'pos');
      let avgTransaksi = 0;
      if (!error7 && kas7) {
        // Group by hari, hitung unique transaction_id per hari
        const transaksiPerHari = {};
        for (const tanggal of hariLabels) {
          transaksiPerHari[tanggal] = new Set();
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
        const totalTransaksi7Hari = Object.values(transaksiPerHari).reduce((sum, set) => sum + set.size, 0);
        avgTransaksi = Math.round(totalTransaksi7Hari / 7);
      }

      // Data hari ini untuk item terjual, jumlah transaksi, omzet, dst
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const startUTC = start.toISOString();
      const endUTC = end.toISOString();
      const { data: kas, error } = await this.supabase
        .from('buku_kas')
        .select('*')
        .gte('waktu', startUTC)
        .lte('waktu', endUTC)
        .eq('sumber', 'pos');
      if (error) {
        console.error('Error fetching dashboard stats:', error);
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
      const itemTerjual = kas.reduce((sum: number, t: any) => sum + (t.qty || 1), 0);
      const transactionIds = new Set((kas || []).map((t: any) => t.transaction_id).filter(Boolean));
      const jumlahTransaksi = transactionIds.size > 0 ? transactionIds.size : kas.length;
      const omzet = kas.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      return {
        itemTerjual,
        jumlahTransaksi,
        omzet,
        profit: omzet * 0.3, // Dummy profit calculation
        totalItem: itemTerjual,
        avgTransaksi, // Sudah diperbaiki: jumlah transaksi per hari (7 hari terakhir)
        jamRamai: '15.00-16.00', // Dummy data
        weeklyIncome: [],
        weeklyMax: 1,
        bestSellers: []
      };
    }, {
      ttl: 86400000, // 24 jam
      backgroundRefresh: false
    });
  }

  // Best sellers dengan cache
  async getBestSellers() {
    return smartCache.get(CACHE_KEYS.BEST_SELLERS, async () => {
      const todayWita = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
      const yyyy = todayWita.getFullYear();
      const mm = String(todayWita.getMonth() + 1).padStart(2, '0');
      const dd = String(todayWita.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      // --- GRAFIK 7 HARI TERAKHIR (WITA) ---
      const hariLabels = [];
      const pendapatanPerHari = {};
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

      let bestSellersResult = [];
      if (!error && items) {
        const grouped = {};
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
          
          const validProdukIds = topProdukIds.filter((id: string) => 
            allProducts && allProducts.some((p: any) => p.id === id)
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
    }, {
      ttl: 300000, // 5 minutes
      backgroundRefresh: true
    });
  }

  // Weekly income dengan cache
  async getWeeklyIncome() {
    return smartCache.get(CACHE_KEYS.WEEKLY_INCOME, async () => {
      const todayWita = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
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
    }, {
      ttl: 300000, // 5 minutes
      backgroundRefresh: true
    });
  }

  // Products dengan cache
  async getProducts() {
    return CacheUtils.getProducts(async () => {
      const { data, error } = await this.supabase
        .from('produk')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }

      return data || [];
    });
  }

  // Categories dengan cache
  async getCategories() {
    return smartCache.get(CACHE_KEYS.CATEGORIES, async () => {
      const { data, error } = await this.supabase
        .from('kategori')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }

      return data || [];
    }, {
      ttl: 600000, // 10 minutes
      backgroundRefresh: true
    });
  }

  // Add-ons dengan cache
  async getAddOns() {
    return smartCache.get(CACHE_KEYS.ADDONS, async () => {
      const { data, error } = await this.supabase
        .from('tambahan')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching add-ons:', error);
        return [];
      }

      return data || [];
    }, {
      ttl: 600000, // 10 minutes
      backgroundRefresh: true
    });
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
          
          // Clean up any remaining underscores in the dates
          startDate = startDate.replace(/_/g, '');
          endDate = endDate.replace(/_/g, '');
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
          const lastDay = new Date(parseInt(dateRange.split('-')[0]), parseInt(dateRange.split('-')[1]), 0);
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
        const { startUtc: startUtcTemp, endUtc } = getWitaDateRangeUtc(startDate);
        const { endUtc: endUtcFinalTemp } = getWitaDateRangeUtc(endDate);
        startUtc = startUtcTemp;
        endUtcFinal = endUtcFinalTemp;
      } catch (error) {
        console.error('Error converting date range:', error, 'startDate:', startDate, 'endDate:', endDate);
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

      const { data: transactions, error } = await this.supabase
        .from('buku_kas')
        .select('*')
        .gte('waktu', startUtc)
        .lt('waktu', endUtcFinal);

      if (error) {
        console.error('Error fetching report data:', error);
        return { data: [], etag: etagValue };
      }

      // Process transactions
      const pemasukan = transactions.filter((t: any) => t.tipe === 'in');
      const pengeluaran = transactions.filter((t: any) => t.tipe === 'out');

      const reportData = {
        summary: {
          pendapatan: pemasukan.reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
          pengeluaran: pengeluaran.reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
          saldo: pemasukan.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) - 
                 pengeluaran.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
        },
        pemasukanUsaha: pemasukan.filter((t: any) => t.jenis === 'pendapatan_usaha'),
        pemasukanLain: pemasukan.filter((t: any) => t.jenis === 'lainnya'),
        bebanUsaha: pengeluaran.filter((t: any) => t.jenis === 'beban_usaha'),
        bebanLain: pengeluaran.filter((t: any) => t.jenis === 'lainnya'),
        transactions
      };

      return { data: reportData, etag: etagValue };
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
      case 'pengaturan_keamanan':
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