/**
 * 🚀 OPTIMIZED DATA SERVICE
 * Advanced database operations dengan connection pooling, batch queries, dan intelligent caching
 */

import { getSupabaseClient } from '$lib/database/supabaseClient';
import { advancedCache, cacheKeys } from '$lib/utils/advancedCache';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { get as storeGet } from 'svelte/store';
import { browser } from '$app/environment';

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

interface ConnectionPool {
  [branch: string]: any;
}

interface QueryStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  errors: number;
}

export class OptimizedDataService {
  private static instance: OptimizedDataService;
  private connectionPool: ConnectionPool = {};
  private queryStats: QueryStats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    errors: 0
  };
  private responseTimes: number[] = [];

  private constructor() {
    // Initialize connection pool
    this.initializeConnectionPool();
  }

  static getInstance(): OptimizedDataService {
    if (!OptimizedDataService.instance) {
      OptimizedDataService.instance = new OptimizedDataService();
    }
    return OptimizedDataService.instance;
  }

  /**
   * Initialize connection pool for all branches
   */
  private initializeConnectionPool(): void {
    // Pre-initialize connections for known branches
    const branches = ['default', 'dev', 'samarinda', 'berau']; // Add your branches
    
    branches.forEach(branch => {
      this.connectionPool[branch] = getSupabaseClient(branch as any);
    });
  }

  /**
   * Get optimized connection for branch
   */
  private getConnection(branch?: string): any {
    const branchKey = branch || storeGet(selectedBranch) || 'default';
    
    if (!this.connectionPool[branchKey]) {
      this.connectionPool[branchKey] = getSupabaseClient(branchKey as any);
    }
    
    return this.connectionPool[branchKey];
  }

  /**
   * Execute single query with caching and optimization
   */
  async executeQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const {
        ttl = 5 * 60 * 1000, // 5 minutes default
        backgroundRefresh = true,
        compression = true,
        timeout = 30000 // 30 seconds timeout
      } = options;

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeout);
      });

      // Execute query with caching
      const result = await Promise.race([
        advancedCache.get(key, queryFn, { ttl, backgroundRefresh, compression }),
        timeoutPromise
      ]);

      // Update stats
      this.updateStats(performance.now() - startTime, true);
      
      return result;
    } catch (error) {
      this.updateStats(performance.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Execute multiple queries in parallel with intelligent batching
   */
  async executeBatchQueries(queries: BatchQuery[]): Promise<any[]> {
    const startTime = performance.now();
    
    try {
      // Group queries by cache status
      const cacheableQueries = queries.filter(q => q.options?.ttl !== 0);
      const nonCacheableQueries = queries.filter(q => q.options?.ttl === 0);

      // Execute cacheable queries in parallel
      const cacheablePromises = cacheableQueries.map(query => 
        this.executeQuery(query.key, query.query, query.options)
      );

      // Execute non-cacheable queries in parallel
      const nonCacheablePromises = nonCacheableQueries.map(query => 
        query.query()
      );

      // Wait for all queries to complete
      const [cacheableResults, nonCacheableResults] = await Promise.all([
        Promise.all(cacheablePromises),
        Promise.all(nonCacheablePromises)
      ]);

      // Combine results in original order
      const results: any[] = [];
      let cacheableIndex = 0;
      let nonCacheableIndex = 0;

      queries.forEach(query => {
        if (query.options?.ttl === 0) {
          results.push(nonCacheableResults[nonCacheableIndex++]);
        } else {
          results.push(cacheableResults[cacheableIndex++]);
        }
      });

      this.updateStats(performance.now() - startTime, true);
      return results;
    } catch (error) {
      this.updateStats(performance.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Optimized products fetching with intelligent caching
   */
  async getProducts(branch?: string, options: QueryOptions = {}): Promise<any[]> {
    const key = cacheKeys.products(branch);
    const connection = this.getConnection(branch);
    
    return this.executeQuery(key, async () => {
      const { data, error } = await connection
        .from('produk')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }, { ttl: 10 * 60 * 1000, ...options }); // 10 minutes cache
  }

  /**
   * Optimized categories fetching
   */
  async getCategories(branch?: string, options: QueryOptions = {}): Promise<any[]> {
    const key = cacheKeys.categories(branch);
    const connection = this.getConnection(branch);
    
    return this.executeQuery(key, async () => {
      const { data, error } = await connection
        .from('kategori')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }, { ttl: 15 * 60 * 1000, ...options }); // 15 minutes cache
  }

  /**
   * Optimized add-ons fetching
   */
  async getAddOns(branch?: string, options: QueryOptions = {}): Promise<any[]> {
    const key = cacheKeys.addOns(branch);
    const connection = this.getConnection(branch);
    
    return this.executeQuery(key, async () => {
      const { data, error } = await connection
        .from('tambahan')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }, { ttl: 15 * 60 * 1000, ...options }); // 15 minutes cache
  }

  /**
   * Optimized report data fetching with pagination
   */
  async getReportData(
    date: string,
    type: 'daily' | 'weekly' | 'monthly',
    branch?: string,
    options: QueryOptions = {}
  ): Promise<any> {
    const key = cacheKeys.reportData(date, type, branch);
    const connection = this.getConnection(branch);
    
    return this.executeQuery(key, async () => {
      const startTime = this.getDateRange(date, type).start;
      const endTime = this.getDateRange(date, type).end;

      // Execute multiple queries in parallel
      const [bukuKasData, transaksiKasirData, produkData] = await Promise.all([
        this.fetchBukuKasData(connection, startTime, endTime),
        this.fetchTransaksiKasirData(connection, startTime, endTime),
        this.getProducts(branch, { ttl: 0 }) // Don't cache here, already cached
      ]);

      return this.processReportData(bukuKasData, transaksiKasirData, produkData, type);
    }, { ttl: 2 * 60 * 1000, ...options }); // 2 minutes cache for reports
  }

  /**
   * Batch fetch all essential data
   */
  async fetchAllEssentialData(branch?: string): Promise<{
    products: any[];
    categories: any[];
    addOns: any[];
    userProfile: any;
  }> {
    const queries: BatchQuery[] = [
      {
        key: cacheKeys.products(branch),
        query: () => this.getProducts(branch, { ttl: 0 }),
        options: { ttl: 10 * 60 * 1000 }
      },
      {
        key: cacheKeys.categories(branch),
        query: () => this.getCategories(branch, { ttl: 0 }),
        options: { ttl: 15 * 60 * 1000 }
      },
      {
        key: cacheKeys.addOns(branch),
        query: () => this.getAddOns(branch, { ttl: 0 }),
        options: { ttl: 15 * 60 * 1000 }
      },
      {
        key: cacheKeys.userProfile('current'),
        query: () => this.getUserProfile(branch),
        options: { ttl: 30 * 60 * 1000 }
      }
    ];

    const [products, categories, addOns, userProfile] = await this.executeBatchQueries(queries);

    return {
      products,
      categories,
      addOns,
      userProfile
    };
  }

  /**
   * Optimized transaction data fetching with intelligent pagination
   */
  async getTransactionData(
    startDate: string,
    endDate: string,
    branch?: string,
    options: QueryOptions = {}
  ): Promise<any[]> {
    const key = cacheKeys.transactionData(`${startDate}_${endDate}`, branch);
    const connection = this.getConnection(branch);
    
    return this.executeQuery(key, async () => {
      const batchSize = options.batchSize || 1000;
      const allData: any[] = [];

      // Get total count first
      const { count } = await connection
        .from('buku_kas')
        .select('*', { count: 'exact', head: true })
        .gte('waktu', startDate)
        .lte('waktu', endDate);

      if (!count || count === 0) {
        return [];
      }

      // Calculate batches needed
      const totalBatches = Math.ceil(count / batchSize);
      
      // Execute batches in parallel (limited concurrency)
      const concurrency = 3; // Limit concurrent requests
      for (let i = 0; i < totalBatches; i += concurrency) {
        const batchPromises = [];
        
        for (let j = 0; j < concurrency && (i + j) < totalBatches; j++) {
          const offset = (i + j) * batchSize;
          batchPromises.push(
            this.fetchBatch(connection, startDate, endDate, offset, batchSize)
          );
        }
        
        const batchResults = await Promise.all(batchPromises);
        allData.push(...batchResults.flat());
      }

      return allData;
    }, { ttl: 1 * 60 * 1000, ...options }); // 1 minute cache for transactions
  }

  /**
   * Helper methods
   */
  private async fetchBukuKasData(connection: any, startTime: string, endTime: string): Promise<any[]> {
    const { data, error } = await connection
      .from('buku_kas')
      .select('*')
      .gte('waktu', startTime)
      .lte('waktu', endTime)
      .order('waktu', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  private async fetchTransaksiKasirData(connection: any, startTime: string, endTime: string): Promise<any[]> {
    const { data, error } = await connection
      .from('transaksi_kasir')
      .select('*')
      .gte('waktu', startTime)
      .lte('waktu', endTime)
      .order('waktu', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  private async fetchBatch(
    connection: any,
    startTime: string,
    endTime: string,
    offset: number,
    limit: number
  ): Promise<any[]> {
    const { data, error } = await connection
      .from('buku_kas')
      .select('*')
      .gte('waktu', startTime)
      .lte('waktu', endTime)
      .order('waktu', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  private getDateRange(date: string, type: string): { start: string; end: string } {
    const dateObj = new Date(date);
    
    switch (type) {
      case 'daily':
        return {
          start: dateObj.toISOString().split('T')[0] + 'T00:00:00.000Z',
          end: dateObj.toISOString().split('T')[0] + 'T23:59:59.999Z'
        };
      case 'weekly':
        const weekStart = new Date(dateObj);
        weekStart.setDate(dateObj.getDate() - dateObj.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
          start: weekStart.toISOString().split('T')[0] + 'T00:00:00.000Z',
          end: weekEnd.toISOString().split('T')[0] + 'T23:59:59.999Z'
        };
      case 'monthly':
        const monthStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
        const monthEnd = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
        return {
          start: monthStart.toISOString().split('T')[0] + 'T00:00:00.000Z',
          end: monthEnd.toISOString().split('T')[0] + 'T23:59:59.999Z'
        };
      default:
        return {
          start: dateObj.toISOString().split('T')[0] + 'T00:00:00.000Z',
          end: dateObj.toISOString().split('T')[0] + 'T23:59:59.999Z'
        };
    }
  }

  private processReportData(bukuKasData: any[], transaksiKasirData: any[], produkData: any[], type: string): any {
    // Process and combine data for reports
    return {
      bukuKas: bukuKasData,
      transaksiKasir: transaksiKasirData,
      produk: produkData,
      summary: this.calculateSummary(bukuKasData, transaksiKasirData),
      type
    };
  }

  private calculateSummary(bukuKasData: any[], transaksiKasirData: any[]): any {
    const totalPemasukan = bukuKasData
      .filter(t => t.tipe === 'in')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const totalPengeluaran = bukuKasData
      .filter(t => t.tipe === 'out')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      totalPemasukan,
      totalPengeluaran,
      profit: totalPemasukan - totalPengeluaran,
      totalTransaksi: bukuKasData.length,
      totalItemTerjual: transaksiKasirData.length
    };
  }

  private async getUserProfile(branch?: string): Promise<any> {
    const connection = this.getConnection(branch);
    const { data, error } = await connection
      .from('profil')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Update query statistics
   */
  private updateStats(responseTime: number, success: boolean): void {
    this.queryStats.totalQueries++;
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    this.queryStats.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    if (!success) {
      this.queryStats.errors++;
    }
  }

  /**
   * Get query statistics
   */
  getQueryStats(): QueryStats {
    return { ...this.queryStats };
  }

  /**
   * Clear cache for specific branch
   */
  clearBranchCache(branch?: string): void {
    const branchKey = branch || storeGet(selectedBranch) || 'default';
    advancedCache.invalidatePattern(new RegExp(`_${branchKey}$`));
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    advancedCache.clear();
  }
}

// Export singleton instance
export const optimizedDataService = OptimizedDataService.getInstance();
