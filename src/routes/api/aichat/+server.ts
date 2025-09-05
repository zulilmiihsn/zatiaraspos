import { json } from '@sveltejs/kit';
import { getSupabaseClient } from '$lib/database/supabaseClient';
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

// Util: format YYYY-MM-DD dalam zona WITA
function toYMDWita(date: Date): string {
	const d = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

// Parser rentang waktu yang lebih fleksibel
function parseFlexibleRange(question: string): {
	start: string;
	end: string;
	type: 'daily' | 'weekly' | 'monthly' | 'yearly';
} {
	const q = (question || '').toLowerCase();
	const now = new Date();
	const today = toYMDWita(now);
	const toYMD = (d: Date) => toYMDWita(d);
	const addDays = (d: Date, n: number) => {
		const x = new Date(d);
		x.setDate(x.getDate() + n);
		return x;
	};
	const addMonths = (d: Date, n: number) => {
		const x = new Date(d);
		x.setMonth(x.getMonth() + n);
		return x;
	};

	if (q.includes('hari ini') || q.includes('today'))
		return { start: today, end: today, type: 'daily' };
	if (q.includes('kemarin') || q.includes('yesterday')) {
		const d = new Date(now);
		d.setDate(d.getDate() - 1);
		const y = toYMD(d);
		return { start: y, end: y, type: 'daily' };
	}
	if (q.includes('minggu ini') || q.includes('pekan ini') || q.includes('this week')) {
		const d = new Date(now);
		const day = d.getDay();
		const diffToMonday = (day + 6) % 7;
		const startD = new Date(d);
		startD.setDate(d.getDate() - diffToMonday);
		const endD = new Date(startD);
		endD.setDate(startD.getDate() + 6);
		return { start: toYMD(startD), end: toYMD(endD), type: 'weekly' };
	}
	if (q.includes('dua minggu') || q.includes('2 minggu')) {
		const endD = new Date(now);
		const startD = new Date(endD);
		startD.setDate(endD.getDate() - 13);
		return { start: toYMD(startD), end: toYMD(endD), type: 'weekly' };
	}
	if (q.includes('bulan ini') || q.includes('this month')) {
		const startD = new Date(now.getFullYear(), now.getMonth(), 1);
		const endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		return { start: toYMD(startD), end: toYMD(endD), type: 'monthly' };
	}
	if (q.includes('bulan lalu') || q.includes('last month')) {
		const startD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endD = new Date(now.getFullYear(), now.getMonth(), 0);
		return { start: toYMD(startD), end: toYMD(endD), type: 'monthly' };
	}
	if (q.includes('dua bulan') || q.includes('2 bulan')) {
		const startD = new Date(now.getFullYear(), now.getMonth() - 2, 1);
		const endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		return { start: toYMD(startD), end: toYMD(endD), type: 'monthly' };
	}
	if (q.includes('tahun ini') || q.includes('this year')) {
		const startD = new Date(now.getFullYear(), 0, 1);
		const endD = new Date(now.getFullYear(), 11, 31);
		return { start: toYMD(startD), end: toYMD(endD), type: 'yearly' };
	}
	if (q.includes('tahun lalu') || q.includes('last year')) {
		const startD = new Date(now.getFullYear() - 1, 0, 1);
		const endD = new Date(now.getFullYear() - 1, 11, 31);
		return { start: toYMD(startD), end: toYMD(endD), type: 'yearly' };
	}
	const nMatch = q.match(/(\d+)\s*hari/);
	if (nMatch) {
		const n = Math.max(1, parseInt(nMatch[1], 10));
		const endD = new Date(now);
		const startD = addDays(endD, -(n - 1));
		return { start: toYMD(startD), end: toYMD(endD), type: n >= 28 ? 'monthly' : 'weekly' };
	}
	// X hari terakhir
	const lastDays = q.match(/(\d+)\s*hari\s*terakhir/);
	if (lastDays) {
		const n = Math.max(1, parseInt(lastDays[1], 10));
		const endD = new Date(now);
		const startD = addDays(endD, -(n - 1));
		return { start: toYMD(startD), end: toYMD(endD), type: 'daily' };
	}
	// X minggu terakhir
	const lastWeeks = q.match(/(\d+)\s*minggu\s*terakhir/);
	if (lastWeeks) {
		const n = Math.max(1, parseInt(lastWeeks[1], 10));
		const endD = new Date(now);
		const startD = addDays(endD, -(n * 7 - 1));
		return { start: toYMD(startD), end: toYMD(endD), type: 'weekly' };
	}
	// X bulan terakhir
	const lastMonths = q.match(/(\d+)\s*bulan\s*terakhir/);
	if (lastMonths) {
		const n = Math.max(1, parseInt(lastMonths[1], 10));
		const endD = new Date(now);
		const startD = addMonths(endD, -n);
		return { start: toYMD(startD), end: toYMD(endD), type: 'monthly' };
	}
	const rangeMatch = q.match(
		/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\s*[-–]\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/
	);
	if (rangeMatch) {
		const [, d1, m1, y1, d2, m2, y2] = rangeMatch;
		const y1Full = y1.length === 2 ? `20${y1}` : y1;
		const y2Full = y2.length === 2 ? `20${y2}` : y2;
		const startD = new Date(parseInt(y1Full, 10), parseInt(m1, 10) - 1, parseInt(d1, 10));
		const endD = new Date(parseInt(y2Full, 10), parseInt(m2, 10) - 1, parseInt(d2, 10));
		return { start: toYMD(startD), end: toYMD(endD), type: 'daily' };
	}
	return { start: today, end: today, type: 'daily' };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { question, branch } = await request.json();

		if (!question || typeof question !== 'string') {
			return json({ success: false, error: 'Pertanyaan diperlukan' }, { status: 400 });
		}

		// Get API key from environment
		const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

		if (!apiKey) {
			return json(
				{
					success: false,
					error:
						'API key OpenRouter tidak dikonfigurasi. Silakan tambahkan VITE_OPENROUTER_API_KEY di file .env'
				},
				{ status: 500 }
			);
		}

		// Tentukan rentang waktu berdasarkan pertanyaan
		const range = parseFlexibleRange(question);

		// Ambil data langsung dari database sesuai branch & range
		const supabase = getSupabaseClient((branch || 'dev') as any);

		// Hitung waktu UTC dari rentang WITA (approx: gunakan string Y-M-D 00:00:00/23:59:59 WITA yang dikonversi ke ISO)
		const startDate = new Date(`${range.start}T00:00:00+08:00`).toISOString();
		const endDate = new Date(`${range.end}T23:59:59+08:00`).toISOString();

		// Ambil buku_kas POS
		const { data: bukuKasPos } = await supabase
			.from('buku_kas')
			.select('*, transaksi_kasir (*, produk(name))')
			.gte('waktu', startDate)
			.lte('waktu', endDate)
			.eq('sumber', 'pos');

		// Ambil buku_kas manual/catat
		const { data: bukuKasManual } = await supabase
			.from('buku_kas')
			.select('*')
			.gte('waktu', startDate)
			.lte('waktu', endDate)
			.neq('sumber', 'pos');

		const laporan = [
			...(bukuKasPos || []).map((item: any) => ({
				...item,
				sumber: 'pos'
			})),
			...(bukuKasManual || []).map((item: any) => ({
				...item,
				sumber: item.sumber || 'catat'
			}))
		];

		const pemasukan = laporan.filter((t: any) => t.tipe === 'in');
		const pengeluaran = laporan.filter((t: any) => t.tipe === 'out');
		const totalPemasukan = pemasukan.reduce(
			(s: number, t: any) => s + (t.amount || t.nominal || 0),
			0
		);
		const totalPengeluaran = pengeluaran.reduce(
			(s: number, t: any) => s + (t.amount || t.nominal || 0),
			0
		);
		const labaKotor = totalPemasukan - totalPengeluaran;
		const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;
		const labaBersih = labaKotor - pajak;

		const summary = {
			pendapatan: totalPemasukan,
			pengeluaran: totalPengeluaran,
			saldo: totalPemasukan - totalPengeluaran,
			labaKotor,
			pajak,
			labaBersih,
			totalTransaksi: new Set((bukuKasPos || []).map((b: any) => b.transaction_id).filter(Boolean))
				.size
		};

		// Breakdown metode pembayaran & pola waktu
		const paymentBreakdown: Record<string, { jumlah: number; nominal: number }> = {};
		for (const t of laporan) {
			const pm = (t as any)?.payment_method || 'lainnya';
			if (!paymentBreakdown[pm]) paymentBreakdown[pm] = { jumlah: 0, nominal: 0 };
			paymentBreakdown[pm].jumlah += 1;
			paymentBreakdown[pm].nominal += (t.amount || t.nominal || 0) as number;
		}

		// Hitung jam ramai dari transaksi POS
		const hourCount: Record<string, number> = {};
		for (const t of bukuKasPos || []) {
			const waktu = new Date(t.waktu);
			const wita = new Date(waktu.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
			const h = wita.getHours();
			const key = h.toString().padStart(2, '0');
			hourCount[key] = (hourCount[key] || 0) + 1;
		}
		const jamRamai = Object.entries(hourCount)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([h, c]) => `${h}:00 (${c} trx)`);

		// Ambil metadata produk/kategori/tambahan
		const [{ data: products }, { data: categories }, { data: addons }] = await Promise.all([
			supabase.from('produk').select('id, name, price, category_id').limit(1000),
			supabase.from('kategori').select('id, name').limit(1000),
			supabase.from('tambahan').select('id, name, price').limit(1000)
		]);

		// Hitung produk terlaris berdasarkan transaksi_kasir yang terkait buku_kas POS
		const productIdToSale: Record<string, { qty: number; revenue: number; name?: string }> = {};
		for (const row of bukuKasPos || []) {
			const items = (row as any)?.transaksi_kasir || [];
			for (const it of items) {
				const pid = (it as any)?.produk_id;
				if (!pid) continue;
				const qty = Number((it as any)?.qty || 0) || 0;
				const unit = Number((it as any)?.price || (it as any)?.amount || 0) || 0;
				const revenue = unit * (qty || 1);
				// Ambil nama dari relasi produk atau custom_name
				const productName =
					(it as any)?.produk?.name || (it as any)?.custom_name || `Produk ${pid.slice(0, 8)}`;
				if (!productIdToSale[pid]) productIdToSale[pid] = { qty: 0, revenue: 0, name: productName };
				productIdToSale[pid].qty += qty || 0;
				productIdToSale[pid].revenue += revenue;
				if (!productIdToSale[pid].name) productIdToSale[pid].name = productName;
			}
		}
		const produkTerlaris = Object.entries(productIdToSale)
			.map(([pid, v]) => ({
				id: pid,
				nama: v.name || pid,
				totalTerjual: v.qty,
				totalPendapatan: v.revenue
			}))
			.sort((a, b) => b.totalTerjual - a.totalTerjual)
			.slice(0, 5);

		// Sederhanakan konteks server
		const serverReportData = {
			summary,
			startDate: range.start,
			endDate: range.end,
			tipe: range.type,
			pembayaran: paymentBreakdown,
			jamRamai,
			products: (products || []).map((p: any) => ({ id: p.id, name: p.name, price: p.price })),
			categories: (categories || []).map((c: any) => ({ id: c.id, name: c.name })),
			addons: (addons || []).map((a: any) => ({ id: a.id, name: a.name, price: a.price })),
			produkTerlaris
		};

		// Prepare context about the report data
		const reportContext = serverReportData
			? `
Data Laporan:
- Pendapatan: Rp ${serverReportData.summary?.pendapatan?.toLocaleString('id-ID') || '0'}
- Pengeluaran: Rp ${serverReportData.summary?.pengeluaran?.toLocaleString('id-ID') || '0'}
- Laba Kotor: Rp ${serverReportData.summary?.labaKotor?.toLocaleString('id-ID') || '0'}
- Pajak: Rp ${serverReportData.summary?.pajak?.toLocaleString('id-ID') || '0'}
- Laba Bersih: Rp ${serverReportData.summary?.labaBersih?.toLocaleString('id-ID') || '0'}
- Total Transaksi: ${serverReportData.summary?.totalTransaksi || '0'}

Rentang Waktu: ${serverReportData.startDate} s.d. ${serverReportData.endDate}

Rincian Pembayaran:
${
	Object.entries(serverReportData.pembayaran || {})
		.map(([k, v]: any) => {
			const methodLabels: Record<string, string> = {
				'tunai': 'Tunai (Cash)',
				'qris': 'QRIS (Digital Payment)',
				'lainnya': 'Lainnya'
			};
			const label = methodLabels[k] || k;
			return `- ${label}: ${v.jumlah} trx, Rp ${v.nominal.toLocaleString('id-ID')}`;
		})
		.join('\n') || '- (tidak ada)'
}

Jam Ramai (Top 3):
${(serverReportData.jamRamai || []).map((s: string, i: number) => `- ${i + 1}. ${s}`).join('\n') || '- (tidak ada)'}

Produk (sample): ${
					serverReportData.products
						?.slice(0, 5)
						.map((p: any) => p.name)
						.join(', ') || '-'
				}
Kategori (sample): ${
					serverReportData.categories
						?.slice(0, 5)
						.map((c: any) => c.name)
						.join(', ') || '-'
				}

Top Produk Terlaris:
${(serverReportData.produkTerlaris || []).map((p: any, i: number) => `- ${i + 1}. ${p.nama} • ${p.totalTerjual} terjual • Rp ${p.totalPendapatan.toLocaleString('id-ID')}`).join('\n') || '-'}
		`
			: 'Tidak ada data laporan tersedia.';

		// Prepare system message (persona pakar ekonomi/bisnis)
		const systemMessage: ChatMessage = {
			role: 'system',
			content: `Anda adalah Asisten AI yang berperan sebagai pakar ekonomi dan bisnis untuk aplikasi POS Zatiaras Juice.
Zatiaras Juice adalah brand jus buah segar yang menjual berbagai varian minuman jus, smoothie, dan minuman sehat lainnya.
Tujuan Anda: memberikan insight yang bermanfaat, praktis, dan dapat ditindaklanjuti bagi pemilik bisnis berdasarkan data laporan yang diberikan.

Konteks Data:
${reportContext}

Aturan Penting:
1) Jawab SELALU dalam Bahasa Indonesia yang profesional namun ramah.
2) Berikan jawaban LENGKAP dan DETAIL sesuai data, jangan disingkat, kecuali diminta singkat.
3) Sertakan angka, persentase, tren, perbandingan periode jika relevan.
4) Jelaskan "mengapa" dan "bagaimana" (reasoning bisnis singkat) untuk tiap insight penting.
5) Jika data terbatas/tidak ada, nyatakan keterbatasannya, sebutkan data tambahan yang diperlukan.
6) Hindari klaim tanpa dukungan data pada konteks yang diberikan.
7) Gunakan format rapi dengan struktur berikut bila memungkinkan:
   - Ringkasan Utama
   - Insight Kunci (bullet points, gunakan angka/%, tren)
   - Rekomendasi Tindakan (langkah konkret pendek/menengah)
   - Risiko/Perhatian (jika ada)
   - Langkah Berikutnya / Data yang disarankan dikumpulkan

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
				Authorization: `Bearer ${apiKey}`,
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
			return json({ success: false, error: data.error.message }, { status: 500 });
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
