import type { AiRecommendation, AutoApplyResult } from '$lib/types/ai';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { get as storeGet } from 'svelte/store';

export class AutoApplyService {
  private static instance: AutoApplyService;
  
  public static getInstance(): AutoApplyService {
    if (!AutoApplyService.instance) {
      AutoApplyService.instance = new AutoApplyService();
    }
    return AutoApplyService.instance;
  }

  /**
   * Menerapkan rekomendasi AI secara otomatis
   */
  async applyRecommendations(recommendations: AiRecommendation[]): Promise<AutoApplyResult> {
    const result: AutoApplyResult = {
      success: true,
      appliedRecommendations: [],
      errors: [],
      message: ''
    };

    try {
      // Validasi untuk mencegah duplikasi
      const uniqueRecommendations = this.deduplicateRecommendations(recommendations);
      
      for (const recommendation of uniqueRecommendations) {
        try {
          await this.applySingleRecommendation(recommendation);
          result.appliedRecommendations.push(recommendation.id);
        } catch (error) {
          result.errors.push(`Gagal menerapkan ${recommendation.title}: ${error}`);
        }
      }

      if (result.appliedRecommendations.length > 0) {
        result.message = `Berhasil menerapkan ${result.appliedRecommendations.length} rekomendasi. Transaksi telah tercatat di laporan dan riwayat.`;
      }

      if (result.errors.length > 0) {
        result.success = false;
        result.message += `. ${result.errors.length} rekomendasi gagal diterapkan.`;
      }

    } catch (error) {
      result.success = false;
      result.message = 'Terjadi kesalahan saat menerapkan rekomendasi';
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Menerapkan satu rekomendasi
   */
  private async applySingleRecommendation(recommendation: AiRecommendation): Promise<void> {

    switch (recommendation.action) {
      case 'create_transaction':
        await this.createTransaction(recommendation.data);
        break;
      case 'update_transaction':
        await this.updateTransaction(recommendation.data);
        break;
      case 'create_category':
        await this.createCategory(recommendation.data);
        break;
      default:
        throw new Error(`Action tidak didukung: ${recommendation.action}`);
    }

  }

  /**
   * Membuat transaksi baru
   */
  private async createTransaction(data: any): Promise<void> {
    
    // Validasi data yang diperlukan
    if (!data.type) {
      throw new Error('Type transaksi tidak valid');
    }
    
    if (!data.amount || data.amount <= 0) {
      throw new Error('Amount transaksi tidak valid atau kosong');
    }
    
    if (!data.description || data.description.trim() === '') {
      throw new Error('Description transaksi tidak valid atau kosong');
    }
    
    const branch = storeGet(selectedBranch);
    const supabase = getSupabaseClient(branch as any);
    
    // Map type ke tipe yang digunakan di database
    const tipe = data.type === 'pemasukan' ? 'in' : data.type === 'penjualan' ? 'in' : 'out';
    
    const transactionData = {
      tipe: tipe,
      amount: Number(data.amount),
      description: String(data.description).trim(),
      jenis: data.category || this.getDefaultCategory(data.type),
      sumber: data.type === 'penjualan' ? 'pos' : 'catat', // POS untuk penjualan, catat untuk manual
      waktu: new Date().toISOString(),
      payment_method: 'tunai' // Default payment method
    };


    // Simpan ke database melalui supabase
    const { data: insertedData, error } = await supabase
      .from('buku_kas')
      .insert(transactionData)
      .select();

    if (error) {
      throw new Error(`Gagal menyimpan transaksi: ${error.message}`);
    }


    // Jika ini adalah transaksi penjualan dengan produk, buat detail transaksi kasir
    if (data.type === 'penjualan' && data.products && Array.isArray(data.products)) {
      await this.createTransactionItems(insertedData[0].id, data.products, supabase);
    }
  }

  /**
   * Membuat detail transaksi kasir untuk penjualan produk
   */
  private async createTransactionItems(bukuKasId: number, products: any[], supabase: any): Promise<void> {
    
    const transactionItems = products.map((product, index) => {
      const addOns = product.addOns || [];
      const addOnsTotal = addOns.reduce((sum: number, addOn: any) => sum + (addOn.price || 0), 0);
      const subtotal = (product.price || 0) + addOnsTotal;
      
      return {
        buku_kas_id: bukuKasId,
        product_id: product.id || null,
        product_name: product.name || 'Produk Custom',
        product_price: product.price || 0,
        quantity: 1, // Default quantity
        add_ons: addOns.map((addOn: any) => ({
          id: addOn.id || null,
          name: addOn.name || '',
          price: addOn.price || 0
        })),
        subtotal: subtotal,
        created_at: new Date().toISOString()
      };
    });


    const { data: insertedItems, error } = await supabase
      .from('transaksi_kasir')
      .insert(transactionItems)
      .select();

    if (error) {
      // Jangan throw error karena transaksi utama sudah berhasil
    }
  }

  /**
   * Update transaksi yang sudah ada
   */
  private async updateTransaction(data: any): Promise<void> {
    if (!data.id) {
      throw new Error('ID transaksi diperlukan untuk update');
    }

    const branch = storeGet(selectedBranch);
    const supabase = getSupabaseClient(branch as any);
    
    const tipe = data.type === 'pemasukan' ? 'in' : 'out';
    
    const updateData = {
      tipe: tipe,
      amount: data.amount,
      description: data.description,
      jenis: data.category
    };

    const { error } = await supabase
      .from('buku_kas')
      .update(updateData)
      .eq('id', data.id);

    if (error) {
      throw new Error(`Gagal mengupdate transaksi: ${error.message}`);
    }
  }

  /**
   * Membuat kategori baru
   */
  private async createCategory(data: any): Promise<void> {
    const branch = storeGet(selectedBranch);
    const supabase = getSupabaseClient(branch as any);
    
    const categoryData = {
      name: data.name,
      description: data.description
    };

    const { error } = await supabase
      .from('kategori')
      .insert(categoryData);

    if (error) {
      throw new Error(`Gagal membuat kategori: ${error.message}`);
    }
  }

  /**
   * Get default category berdasarkan type
   */
  private getDefaultCategory(type: string): string {
    const defaultCategories: { [key: string]: string } = {
      'pemasukan': 'pendapatan_usaha', // Sesuaikan dengan kategori di laporan
      'pengeluaran': 'beban_usaha',    // Sesuaikan dengan kategori di laporan
      'penjualan': 'pendapatan_usaha'  // Penjualan masuk ke pendapatan usaha
    };

    return defaultCategories[type] || 'lainnya';
  }

  /**
   * Validasi rekomendasi sebelum diterapkan
   */
  validateRecommendations(recommendations: AiRecommendation[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    recommendations.forEach((rec, index) => {
      if (!rec.id) {
        errors.push(`Rekomendasi ${index + 1}: ID tidak valid`);
      }

      if (!rec.action) {
        errors.push(`Rekomendasi ${index + 1}: Action tidak valid`);
      }

      if (!rec.data) {
        errors.push(`Rekomendasi ${index + 1}: Data tidak valid`);
      }

      if (rec.action === 'create_transaction') {
        if (!rec.data.type || !rec.data.amount) {
          errors.push(`Rekomendasi ${index + 1}: Data transaksi tidak lengkap`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Deduplikasi rekomendasi untuk mencegah duplikasi transaksi
   */
  private deduplicateRecommendations(recommendations: AiRecommendation[]): AiRecommendation[] {
    const seen = new Set<string>();
    const unique: AiRecommendation[] = [];
    
    for (const rec of recommendations) {
      // Buat key unik berdasarkan action, amount, dan description
      const key = `${rec.action}_${rec.data?.amount}_${rec.data?.type}_${rec.data?.description}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rec);
      }
    }
    
    return unique;
  }

  /**
   * Rollback perubahan jika ada error
   */
  async rollbackChanges(appliedRecommendations: string[]): Promise<void> {
    // Implementasi rollback jika diperlukan
    // TODO: Implement rollback logic
  }
}
