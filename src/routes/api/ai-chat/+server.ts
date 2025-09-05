import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// DeepSeek API configuration
const DEEPSEEK_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface DeepSeekRequest {
	model: string;
	messages: ChatMessage[];
	max_tokens: number;
	temperature: number;
}

interface DeepSeekResponse {
	choices: Array<{
		message: {
			content: string;
		};
	}>;
	error?: {
		message: string;
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { question, reportData } = await request.json();

		if (!question || typeof question !== 'string') {
			return json(
				{ success: false, error: 'Pertanyaan diperlukan' },
				{ status: 400 }
			);
		}

		// Get API key from environment
		const apiKey = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
		
		if (!apiKey) {
			return json(
				{ success: false, error: 'API key tidak dikonfigurasi' },
				{ status: 500 }
			);
		}

		// Prepare context about the report data
		const reportContext = reportData ? `
Data Laporan:
- Pendapatan: Rp ${reportData.summary?.pendapatan?.toLocaleString('id-ID') || '0'}
- Pengeluaran: Rp ${reportData.summary?.pengeluaran?.toLocaleString('id-ID') || '0'}
- Keuntungan: Rp ${reportData.summary?.keuntungan?.toLocaleString('id-ID') || '0'}
- Total Transaksi: ${reportData.summary?.totalTransaksi || '0'}
- Rata-rata per Transaksi: Rp ${reportData.summary?.rataRataPerTransaksi?.toLocaleString('id-ID') || '0'}

Data Pemasukan Usaha:
- Total Pemasukan: Rp ${reportData.pemasukanUsaha?.totalPemasukan?.toLocaleString('id-ID') || '0'}
- Jumlah Transaksi: ${reportData.pemasukanUsaha?.jumlahTransaksi || '0'}

Data Pengeluaran:
- Total Pengeluaran: Rp ${reportData.pengeluaran?.totalPengeluaran?.toLocaleString('id-ID') || '0'}
- Jumlah Item: ${reportData.pengeluaran?.jumlahItem || '0'}

Data Produk Terlaris:
${reportData.produkTerlaris?.slice(0, 5).map((item: any, index: number) => 
	`${index + 1}. ${item.nama} - ${item.totalTerjual} terjual - Rp ${item.totalPendapatan?.toLocaleString('id-ID')}`
).join('\n') || 'Tidak ada data'}

Data Kategori Terlaris:
${reportData.kategoriTerlaris?.slice(0, 5).map((item: any, index: number) => 
	`${index + 1}. ${item.nama} - ${item.totalTerjual} terjual - Rp ${item.totalPendapatan?.toLocaleString('id-ID')}`
).join('\n') || 'Tidak ada data'}
		` : 'Tidak ada data laporan tersedia.';

		// Prepare system message
		const systemMessage: ChatMessage = {
			role: 'system',
			content: `Anda adalah AI Assistant untuk sistem POS Zatiaras Juice. Anda membantu menganalisis data laporan penjualan dan memberikan insight yang berguna.

${reportContext}

Instruksi:
1. Jawab pertanyaan tentang data laporan dengan akurat dan informatif
2. Berikan analisis yang mendalam tentang tren penjualan
3. Saran perbaikan atau optimasi bisnis jika relevan
4. Gunakan format yang mudah dibaca dengan bullet points jika perlu
5. Jika data tidak tersedia, jelaskan dengan jelas
6. Gunakan bahasa Indonesia yang profesional namun ramah
7. Fokus pada insight bisnis yang actionable

Jawab pertanyaan: "${question}"`
		};

		// Prepare the request to DeepSeek
		const deepSeekRequest: DeepSeekRequest = {
			model: DEEPSEEK_MODEL,
			messages: [systemMessage],
			max_tokens: 2000,
			temperature: 0.7
		};

		// Make request to DeepSeek API
		const response = await fetch(DEEPSEEK_API_URL, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(deepSeekRequest)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('DeepSeek API Error:', errorData);
			
			return json(
				{ 
					success: false, 
					error: `API Error: ${response.status} - ${errorData.error?.message || response.statusText}` 
				},
				{ status: response.status }
			);
		}

		const data: DeepSeekResponse = await response.json();

		if (data.error) {
			return json(
				{ success: false, error: data.error.message },
				{ status: 500 }
			);
		}

		const answer = data.choices?.[0]?.message?.content || 'Maaf, tidak dapat menghasilkan jawaban.';

		return json({
			success: true,
			answer: answer.trim()
		});

	} catch (error) {
		console.error('AI Chat Error:', error);
		
		return json(
			{ 
				success: false, 
				error: 'Terjadi kesalahan saat memproses pertanyaan. Silakan coba lagi.' 
			},
			{ status: 500 }
		);
	}
};
