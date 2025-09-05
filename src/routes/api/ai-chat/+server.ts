import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-chat';

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface OpenRouterRequest {
	model: string;
	messages: ChatMessage[];
	max_tokens: number;
	temperature: number;
}

interface OpenRouterResponse {
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
		const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
		
		if (!apiKey) {
			return json(
				{ success: false, error: 'API key OpenRouter tidak dikonfigurasi. Silakan tambahkan VITE_OPENROUTER_API_KEY di file .env' },
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

		// Prepare system message (persona pakar ekonomi/bisnis)
		const systemMessage: ChatMessage = {
			role: 'system',
			content: `Anda adalah Asisten AI yang berperan sebagai pakar ekonomi dan bisnis untuk aplikasi POS Zatiaras Juice.
Tujuan Anda: memberikan insight yang bermanfaat, praktis, dan dapat ditindaklanjuti bagi pemilik bisnis berdasarkan data laporan yang diberikan.

Konteks Data:
${reportContext}

Aturan Penting:
1) Jawab SELALU dalam Bahasa Indonesia yang profesional namun ramah.
2) Prioritaskan insight yang actionable, jelaskan "mengapa" dan "bagaimana".
3) Jika data terbatas/tidak ada, nyatakan keterbatasannya dan minta data pelengkap yang relevan.
4) Hindari klaim tanpa dukungan data pada konteks yang diberikan.
5) Gunakan format rapi dengan struktur berikut bila memungkinkan:
   - Ringkasan Utama (1-2 kalimat)
   - Insight Kunci (bullet points, gunakan angka/%, tren)
   - Rekomendasi Tindakan (langkah konkret jangka pendek)
   - Risiko/Perhatian (jika ada)
   - Langkah Berikutnya (opsional)

Pertanyaan pengguna: "${question}"`
		};

		// Prepare the request to OpenRouter
		const openRouterRequest: OpenRouterRequest = {
			model: MODEL,
			messages: [systemMessage],
			max_tokens: 2000,
			temperature: 0.6
		};

		// Make request to OpenRouter API
		const response = await fetch(OPENROUTER_API_URL, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://zatiaraspos.com',
				'X-Title': 'Zatiaras POS'
			},
			body: JSON.stringify(openRouterRequest)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('OpenRouter API Error:', errorData);
			
			return json(
				{ 
					success: false, 
					error: `API Error: ${response.status} - ${errorData.error?.message || response.statusText}` 
				},
				{ status: response.status }
			);
		}

		const data: OpenRouterResponse = await response.json();

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
