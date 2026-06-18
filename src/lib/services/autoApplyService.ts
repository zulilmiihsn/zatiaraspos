import type { AiRecommendation, AutoApplyResult } from '$lib/types/ai';
import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import { refreshBus } from '$lib/utils/refreshBus';

const apiFetch = (path: string, init?: RequestInit) => fetch(path, init);

export class AutoApplyService {
	private static instance: AutoApplyService;

	public static getInstance(): AutoApplyService {
		if (!AutoApplyService.instance) {
			AutoApplyService.instance = new AutoApplyService();
		}
		return AutoApplyService.instance;
	}

	async applyRecommendations(recommendations: AiRecommendation[]): Promise<AutoApplyResult> {
		const result: AutoApplyResult = {
			success: true,
			appliedRecommendations: [],
			errors: [],
			message: ''
		};

		try {
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

	private async createTransaction(data: any): Promise<void> {
		if (!data.type) throw new Error('Type transaksi tidak valid');
		if (!data.amount || data.amount <= 0)
			throw new Error('Amount transaksi tidak valid atau kosong');
		if (!data.description || data.description.trim() === '')
			throw new Error('Description transaksi tidak valid atau kosong');

		if (data.type === 'penjualan') {
			const products = Array.isArray(data.products) && data.products.length ? data.products : [];
			const res = await apiFetch('/api/pos/transaction', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					idempotency_key: crypto.randomUUID(),
					customer_name: data.customerName || null,
					payment_method: data.payment_method || 'tunai',
					cash_received: Number(data.amount),
					items: products.length
						? products.map((product: any) => ({
								product_id: product.id || null,
								custom_name: product.id ? null : product.name || data.description,
								custom_price: product.id ? null : Number(product.price || data.amount),
								qty: product.quantity || product.qty || 1,
								add_on_ids: (product.addOns || []).map((addOn: any) => addOn.id).filter(Boolean)
							}))
						: [
								{
									product_id: null,
									custom_name: String(data.description).trim(),
									custom_price: Number(data.amount),
									qty: 1,
									add_on_ids: []
								}
							]
				})
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(`Gagal menyimpan transaksi POS: ${err?.error ?? res.statusText}`);
			}
			return;
		}

		const branch = selectedBranch.value;
		const tipe = data.type === 'pemasukan' ? 'in' : data.type === 'penjualan' ? 'in' : 'out';
		const transactionId = crypto.randomUUID();

		const payload = {
			id: transactionId,
			tipe,
			amount: Number(data.amount),
			description: String(data.description).trim(),
			jenis: data.category || this.getDefaultCategory(data.type),
			sumber: data.type === 'penjualan' ? 'pos' : 'catat',
			waktu: new Date().toISOString(),
			payment_method: 'tunai',
			transaction_id: transactionId
		};

		const res = await apiFetch('/api/data', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ table: 'buku_kas', action: 'insert', branch, payload })
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`Gagal menyimpan transaksi: ${err?.error ?? res.statusText}`);
		}

		const inserted = await res.json();
		const bukuKasId = inserted?.id ?? transactionId;

		if (data.type === 'penjualan' && Array.isArray(data.products)) {
			await this.createTransactionItems(bukuKasId, data.products, transactionId, branch);
		}

		if (typeof window !== 'undefined') {
			try {
				window.dispatchEvent(
					new CustomEvent('ai-recommendations-applied', { detail: { success: true } })
				);
				refreshBus.emit('laporan');
				refreshBus.emit('riwayat');
			} catch {}
		}
	}

	private async createTransactionItems(
		bukuKasId: string,
		products: any[],
		transactionId: string,
		branch: string
	): Promise<void> {
		const items = products.map((product) => {
			const addOnsTotal = (product.addOns || []).reduce(
				(sum: number, addOn: any) => sum + (addOn.price || 0),
				0
			);
			const unitPrice = (product.price || 0) + addOnsTotal;
			const qty = product.quantity || 1;
			return {
				id: crypto.randomUUID(),
				buku_kas_id: bukuKasId,
				produk_id: product.id || null,
				qty,
				amount: unitPrice * qty,
				transaction_id: transactionId,
				custom_name: product.id ? null : product.name || 'Produk Custom'
			};
		});

		await apiFetch('/api/data', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				table: 'transaksi_kasir',
				action: 'insert',
				branch,
				payload: items
			})
		});
	}

	private async updateTransaction(data: any): Promise<void> {
		if (!data.id) throw new Error('ID transaksi diperlukan untuk update');
		const branch = selectedBranch.value;
		const payload = {
			tipe: data.type === 'pemasukan' ? 'in' : 'out',
			amount: data.amount,
			description: data.description,
			jenis: data.category
		};

		const res = await apiFetch('/api/data', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				table: 'buku_kas',
				action: 'update',
				branch,
				where: { id: data.id },
				payload
			})
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`Gagal mengupdate transaksi: ${err?.error ?? res.statusText}`);
		}
	}

	private async createCategory(data: any): Promise<void> {
		const branch = selectedBranch.value;
		const res = await apiFetch('/api/data', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				table: 'kategori',
				action: 'insert',
				branch,
				payload: { id: crypto.randomUUID(), name: data.name, description: data.description }
			})
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`Gagal membuat kategori: ${err?.error ?? res.statusText}`);
		}
	}

	private getDefaultCategory(type: string): string {
		const map: Record<string, string> = {
			pemasukan: 'pendapatan_usaha',
			pengeluaran: 'beban_usaha',
			penjualan: 'pendapatan_usaha'
		};
		return map[type] || 'lainnya';
	}

	validateRecommendations(recommendations: AiRecommendation[]): {
		valid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];
		recommendations.forEach((rec, i) => {
			if (!rec.id) errors.push(`Rekomendasi ${i + 1}: ID tidak valid`);
			if (!rec.action) errors.push(`Rekomendasi ${i + 1}: Action tidak valid`);
			if (!rec.data) errors.push(`Rekomendasi ${i + 1}: Data tidak valid`);
			if (rec.action === 'create_transaction' && (!rec.data.type || !rec.data.amount)) {
				errors.push(`Rekomendasi ${i + 1}: Data transaksi tidak lengkap`);
			}
		});
		return { valid: errors.length === 0, errors };
	}

	private deduplicateRecommendations(recommendations: AiRecommendation[]): AiRecommendation[] {
		const seen = new Set<string>();
		return recommendations.filter((rec) => {
			const key = `${rec.action}_${rec.data?.amount}_${rec.data?.type}_${rec.data?.description}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	async rollbackChanges(_appliedRecommendations: string[]): Promise<void> {
		// TODO: implement rollback
	}
}
