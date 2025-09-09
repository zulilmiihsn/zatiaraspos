import type { TransactionAnalysis, DetectedTransaction, AiRecommendation } from '$lib/types/ai';
import { get } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';

export class AiAnalysisService {
	private static instance: AiAnalysisService;

	public static getInstance(): AiAnalysisService {
		if (!AiAnalysisService.instance) {
			AiAnalysisService.instance = new AiAnalysisService();
		}
		return AiAnalysisService.instance;
	}

	/**
	 * Menganalisis teks transaksi dari user
	 */
	async analyzeTransaction(text: string): Promise<TransactionAnalysis> {
		try {
			// Get current branch from store
			const currentBranch = get(selectedBranch) || 'default';

			// Kirim ke backend AI untuk analisis
			const response = await fetch('/api/aichat?action=analyze', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-branch': currentBranch
				},
				body: JSON.stringify({ text })
			});

			if (!response.ok) {
				throw new Error('Gagal menganalisis transaksi');
			}

			const data = await response.json();
			return this.parseAnalysisResponse(data, text);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Parse response dari AI menjadi struktur yang dapat digunakan
	 */
	private parseAnalysisResponse(data: any, originalText: string): TransactionAnalysis {
		const detectedTransactions: DetectedTransaction[] = [];
		const recommendations: AiRecommendation[] = [];

		// Parse detected transactions
		if (data.transactions) {
			data.transactions.forEach((tx: any, index: number) => {
				detectedTransactions.push({
					type: this.mapTransactionType(tx.type),
					amount: Number(tx.amount) || 0,
					description: String(tx.description || ''),
					category: tx.category,
					confidence: Number(tx.confidence) || 0.8,
					products: tx.products || [] // Include products data
				});
			});
		}

		// Generate recommendations - hanya jika AI tidak mengirim rekomendasi langsung
		if (!data.recommendations || data.recommendations.length === 0) {
			detectedTransactions.forEach((tx, index) => {
				if (tx.type !== 'unknown' && tx.amount > 0) {
					const recommendationData = {
						type: tx.type,
						amount: tx.amount,
						description: tx.description,
						category: tx.category,
						products: tx.products || [] // Include products data
					};

					recommendations.push({
						id: `rec_${Date.now()}_${index}`,
						action: 'create_transaction',
						title: `Catat ${this.getTransactionTypeLabel(tx.type)}`,
						description: `${this.getTransactionTypeLabel(tx.type)} sebesar Rp ${tx.amount.toLocaleString('id-ID')} - ${tx.description}`,
						data: recommendationData,
						priority: tx.confidence > 0.8 ? 'high' : 'medium'
					});
				}
			});
		} else {
			// Gunakan rekomendasi dari AI langsung
			data.recommendations.forEach((rec: any, index: number) => {
				// Jika AI tidak mengirim data, gunakan detected transactions
				let recommendationData = rec.data || {};

				// Jika data kosong, coba ambil dari detected transactions
				if (!recommendationData.type && detectedTransactions.length > 0) {
					const tx = detectedTransactions[index] || detectedTransactions[0];
					recommendationData = {
						type: tx.type,
						amount: tx.amount,
						description: tx.description,
						category: tx.category,
						products: tx.products || [] // Include products data
					};
				}

				recommendations.push({
					id: `rec_${Date.now()}_${index}`,
					action: rec.action || 'create_transaction',
					title: rec.title || `Rekomendasi ${index + 1}`,
					description: rec.description || '',
					data: recommendationData,
					priority: rec.priority || 'medium'
				});
			});
		}

		return {
			id: `analysis_${Date.now()}`,
			originalText,
			detectedTransactions,
			recommendations,
			confidence: data.confidence || 0.7
		};
	}

	/**
	 * Map transaction type dari AI ke enum yang digunakan
	 */
	private mapTransactionType(
		aiType: string
	): 'pemasukan' | 'pengeluaran' | 'penjualan' | 'unknown' {
		const typeMap: { [key: string]: 'pemasukan' | 'pengeluaran' | 'penjualan' | 'unknown' } = {
			income: 'pemasukan',
			expense: 'pengeluaran',
			sale: 'penjualan',
			pemasukan: 'pemasukan',
			pengeluaran: 'pengeluaran',
			penjualan: 'penjualan',
			unknown: 'unknown'
		};

		return typeMap[aiType.toLowerCase()] || 'unknown';
	}

	/**
	 * Get label untuk transaction type
	 */
	private getTransactionTypeLabel(type: string): string {
		const labels: { [key: string]: string } = {
			pemasukan: 'Pemasukan',
			pengeluaran: 'Pengeluaran',
			penjualan: 'Penjualan POS',
			unknown: 'Transaksi'
		};

		return labels[type] || 'Transaksi';
	}

	/**
	 * Generate response text untuk user
	 */
	generateResponseText(analysis: TransactionAnalysis): string {
		if (analysis.detectedTransactions.length === 0) {
			return 'Saya tidak dapat mengidentifikasi transaksi dari cerita Anda. Bisakah Anda memberikan detail yang lebih spesifik tentang transaksi yang ingin dicatat?';
		}

		let response = 'Saya telah menganalisis cerita Anda dan menemukan:\n\n';

		analysis.detectedTransactions.forEach((tx, index) => {
			response += `${index + 1}. ${this.getTransactionTypeLabel(tx.type)}: Rp ${tx.amount.toLocaleString('id-ID')}`;
			if (tx.description) {
				response += ` - ${tx.description}`;
			}
			response += '\n';
		});

		// Hanya tampilkan rekomendasi jika ada transaksi yang teridentifikasi
		if (analysis.recommendations.length > 0) {
			response += '\nRekomendasi saya:\n';
			analysis.recommendations.forEach((rec, index) => {
				response += `${index + 1}. ${rec.title}\n`;
			});

			response += '\nApakah Anda ingin saya menerapkan rekomendasi ini secara otomatis?';
		}

		return response;
	}
}
