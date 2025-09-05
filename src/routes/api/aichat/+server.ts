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


// Util: format YYYY-MM-DD dalam zona WITA
function toYMDWita(date: Date): string {
	const d = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

// Fallback parser untuk AI 1 (jika AI gagal)
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

	// Basic patterns sebagai fallback
	if (q.includes('hari ini') || q.includes('today'))
		return { start: today, end: today, type: 'daily' };
	if (q.includes('kemarin') || q.includes('yesterday')) {
		const d = new Date(now);
		d.setDate(d.getDate() - 1);
		const y = toYMD(d);
		return { start: y, end: y, type: 'daily' };
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
	
	return { start: today, end: today, type: 'daily' };
}

// AI 1: Date Range Identifier
async function identifyDateRange(question: string, apiKey: string): Promise<{
	start: string;
	end: string;
	type: 'daily' | 'weekly' | 'monthly' | 'yearly';
	reasoning: string;
}> {
	const systemMessage: ChatMessage = {
		role: 'system',
		content: `Anda adalah AI yang bertugas mengidentifikasi rentang tanggal dari pertanyaan user untuk analisis laporan bisnis.

TUGAS ANDA:
1. Analisis pertanyaan user dan tentukan rentang tanggal yang diperlukan
2. Berikan format tanggal YYYY-MM-DD untuk start dan end
3. Tentukan tipe periode (daily, weekly, monthly, yearly)
4. Berikan reasoning singkat mengapa rentang tersebut dipilih

ATURAN:
- Gunakan tanggal Indonesia (WITA)
- Untuk "X bulan terakhir" (1, 2, 3, 4, 5, 6, dst), hitung dari X bulan yang lalu hingga hari ini
- Untuk "X hari terakhir" (1, 2, 3, 7, 14, 30, dst), hitung dari X hari yang lalu hingga hari ini
- Untuk "X minggu terakhir" (1, 2, 3, 4, dst), hitung dari X minggu yang lalu hingga hari ini
- Untuk "X hari pertama bulan ini" (1, 2, 3, 5, 7, 10, dst), hitung dari tanggal 1 hingga X bulan ini
- Untuk "X hari terakhir bulan lalu" (1, 2, 3, 5, 7, 10, dst), hitung X hari terakhir bulan lalu
- Untuk "bulan ini", berikan tanggal 1-akhir bulan ini
- Untuk "bulan lalu", berikan tanggal 1-akhir bulan lalu
- Untuk "tahun ini", berikan tanggal 1 Jan-31 Des tahun ini
- Untuk "tahun lalu", berikan tanggal 1 Jan-31 Des tahun lalu
- PASTIKAN rentang tanggal mencakup SEMUA data yang diminta user
- Jika user bertanya perbandingan (vs), berikan rentang yang mencakup kedua periode

CONTOH:
- "2 bulan terakhir" → start: "2024-11-01", end: "2024-12-31", type: "monthly"
- "3 hari terakhir" → start: "2024-12-29", end: "2024-12-31", type: "daily"
- "5 hari pertama bulan ini" → start: "2024-12-01", end: "2024-12-05", type: "daily"
- "bulan ini vs bulan lalu" → start: "2024-11-01", end: "2024-12-31", type: "monthly"
- "6 bulan terakhir" → start: "2024-07-01", end: "2024-12-31", type: "monthly"

FORMAT JAWABAN (JSON):
{
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD", 
  "type": "daily|weekly|monthly|yearly",
  "reasoning": "Penjelasan singkat mengapa rentang ini dipilih"
}

Pertanyaan user: "${question}"`
	};

	const response = await fetch(OPENROUTER_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://zatiaraspos.com',
			'X-Title': 'Zatiaras POS - Date Range Identifier'
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [systemMessage],
			max_tokens: 500,
			temperature: 0.3
		})
	});

	if (!response.ok) {
		throw new Error(`AI 1 Error: ${response.status}`);
	}

	const data = await response.json();
	const content = data.choices?.[0]?.message?.content || '{}';
	
	try {
		const parsed = JSON.parse(content);
		return {
			start: parsed.start || new Date().toISOString().split('T')[0],
			end: parsed.end || new Date().toISOString().split('T')[0],
			type: parsed.type || 'daily',
			reasoning: parsed.reasoning || 'Rentang tanggal diidentifikasi'
		};
	} catch (error) {
		console.error('AI 1 JSON Parse Error:', error);
		// Fallback ke parser lama
		const range = parseFlexibleRange(question);
		return {
			start: range.start,
			end: range.end,
			type: range.type,
			reasoning: 'Menggunakan parser fallback'
		};
	}
}

// AI 2: Business Analyst
async function analyzeBusinessData(
	question: string, 
	reportData: any, 
	dateRange: any,
	apiKey: string
): Promise<string> {
	const systemMessage: ChatMessage = {
		role: 'system',
		content: `Anda adalah Asisten AI yang berperan sebagai pakar ekonomi dan bisnis untuk aplikasi POS Zatiaras Juice.
Zatiaras Juice adalah brand jus buah segar yang menjual berbagai varian minuman jus, smoothie, dan minuman sehat lainnya.

KONTEKS DATA LENGKAP:
${reportData}

RENTANG TANGGAL YANG DIANALISIS:
- Start: ${dateRange.start} (${dateRange.startFormatted})
- End: ${dateRange.end} (${dateRange.endFormatted})
- Tipe: ${dateRange.type}
- Reasoning: ${dateRange.reasoning}

ATURAN ANALISIS:
1) Jawab SELALU dalam Bahasa Indonesia yang profesional namun ramah.
2) Berikan jawaban LENGKAP dan DETAIL sesuai data, jangan disingkat, kecuali diminta singkat.
3) WAJIB analisis tren dan perbandingan dalam periode yang diminta.
4) Sertakan angka, persentase, tren, perbandingan periode dalam setiap analisis.
5) Jelaskan "mengapa" dan "bagaimana" (reasoning bisnis) untuk setiap insight penting.
6) Jika diminta perbandingan (bulan A vs bulan B, dll), WAJIB gunakan data yang tersedia dalam periode.
7) Jika data terbatas/tidak ada, nyatakan keterbatasannya dan sebutkan data tambahan yang diperlukan.
8) Hindari klaim tanpa dukungan data pada konteks yang diberikan.

PENTING - KONTEKS TANGGAL:
- Data yang Anda terima sudah difilter berdasarkan rentang waktu yang diminta user
- Untuk SEMUA jenis periode (X bulan terakhir, X hari terakhir, X minggu terakhir, dll), data sudah di-fetch sesuai konteks
- Jika user bertanya "2 bulan terakhir", data yang diberikan sudah mencakup 2 bulan terakhir
- Jika user bertanya "5 hari pertama bulan ini", data yang diberikan sudah mencakup 5 hari pertama bulan ini
- Jika user bertanya "3 bulan terakhir", data yang diberikan sudah mencakup 3 bulan terakhir
- Jika user bertanya "bulan lalu", data yang diberikan sudah mencakup bulan lalu
- Jika user bertanya perbandingan (vs), data sudah mencakup kedua periode yang diminta
- JANGAN PERNAH katakan "data tidak tersedia" atau "tidak ada data" - data sudah di-fetch sesuai konteks
- Gunakan konteks tanggal yang jelas dalam jawaban Anda
- Selalu sebutkan rentang tanggal yang dianalisis
- Data di bagian "DATA LAPORAN PERIODE YANG DIMINTA" sudah sesuai dengan konteks pertanyaan user
- Jika ada data dalam konteks, ANALISIS data tersebut, jangan katakan tidak ada
- Untuk perbandingan, gunakan data yang tersedia dalam periode yang diminta

KEMAMPUAN ANALISIS TREN:
- Anda dapat menganalisis data per bulan dalam periode yang diminta
- Anda dapat membandingkan performa antar bulan (Bulan A vs Bulan B vs Bulan C)
- Anda dapat mengidentifikasi bulan terbaik dan terburuk dalam periode
- Anda dapat menganalisis tren produk terlaris per bulan
- Anda dapat menganalisis preferensi metode pembayaran per bulan
- Anda dapat menghitung persentase perubahan dan tren pertumbuhan dalam periode
- Anda dapat mengidentifikasi pola dan fluktuasi dalam periode yang diminta

FORMAT JAWABAN (jika memungkinkan):
- Ringkasan Utama (1-2 kalimat dengan konteks tanggal)
- Analisis Tren & Perbandingan (dengan angka dan persentase)
- Insight Kunci (bullet points dengan data pendukung)
- Rekomendasi Tindakan (langkah konkret berdasarkan tren)
- Risiko/Perhatian (berdasarkan analisis historis)
- Langkah Berikutnya (data tambahan yang diperlukan)

Pertanyaan pengguna: "${question}"`
	};

	const response = await fetch(OPENROUTER_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://zatiaraspos.com',
			'X-Title': 'Zatiaras POS - Business Analyst'
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [systemMessage],
			max_tokens: 2000,
			temperature: 0.6
		})
	});

	if (!response.ok) {
		throw new Error(`AI 2 Error: ${response.status}`);
	}

	const data = await response.json();
	return data.choices?.[0]?.message?.content || 'Maaf, tidak dapat menghasilkan jawaban.';
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

		// AI 1: Identifikasi rentang tanggal
		console.log('AI 1: Identifying date range for question:', question);
		const dateRange = await identifyDateRange(question, apiKey);
		console.log('AI 1 Result:', dateRange);

		// Ambil data langsung dari database sesuai branch & range yang diidentifikasi AI 1
		const supabase = getSupabaseClient((branch || 'dev') as any);

		// Hitung waktu UTC dari rentang WITA (approx: gunakan string Y-M-D 00:00:00/23:59:59 WITA yang dikonversi ke ISO)
		const startDate = new Date(`${dateRange.start}T00:00:00+08:00`).toISOString();
		const endDate = new Date(`${dateRange.end}T23:59:59+08:00`).toISOString();

		// Konversi tanggal untuk konteks AI

		// Konversi tanggal untuk konteks AI
		const formatDateForAI = (dateStr: string) => {
			const date = new Date(dateStr);
			return date.toLocaleDateString('id-ID', { 
				weekday: 'long', 
				year: 'numeric', 
				month: 'long', 
				day: 'numeric' 
			});
		};

		const rangeContext = {
			requested: {
				start: dateRange.start,
				end: dateRange.end,
				startFormatted: formatDateForAI(dateRange.start),
				endFormatted: formatDateForAI(dateRange.end),
				type: dateRange.type
			}
		};

		// Ambil data untuk periode yang diminta
		const [
			{ data: bukuKasPos },
			{ data: bukuKasManual }
		] = await Promise.all([
			supabase
				.from('buku_kas')
				.select('*, transaksi_kasir (*, produk(name))')
				.gte('waktu', startDate)
				.lte('waktu', endDate)
				.eq('sumber', 'pos'),
			supabase
				.from('buku_kas')
				.select('*')
				.gte('waktu', startDate)
				.lte('waktu', endDate)
				.neq('sumber', 'pos')
		]);

		// Data periode yang diminta
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

		// Hitung data periode yang diminta
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


		// Hitung data per bulan untuk periode yang diminta (untuk analisis detail)
		const requestedMonthlyData: Record<string, { 
			pemasukan: number; 
			pengeluaran: number; 
			laba: number; 
			transaksi: number;
			produkTerlaris: Record<string, { qty: number; revenue: number; name: string }>;
			paymentMethods: Record<string, { jumlah: number; nominal: number }>;
		}> = {};
		
		// Proses data periode yang diminta per bulan
		for (const item of laporan) {
			const date = new Date(item.waktu);
			const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			const monthName = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
			
			if (!requestedMonthlyData[monthKey]) {
				requestedMonthlyData[monthKey] = { 
					pemasukan: 0, 
					pengeluaran: 0, 
					laba: 0, 
					transaksi: 0,
					produkTerlaris: {},
					paymentMethods: {}
				};
			}
			
			const amount = item.amount || item.nominal || 0;
			if (item.tipe === 'in') {
				requestedMonthlyData[monthKey].pemasukan += amount;
			} else {
				requestedMonthlyData[monthKey].pengeluaran += amount;
			}
			requestedMonthlyData[monthKey].laba = requestedMonthlyData[monthKey].pemasukan - requestedMonthlyData[monthKey].pengeluaran;
			
			if (item.sumber === 'pos' && item.transaction_id) {
				requestedMonthlyData[monthKey].transaksi += 1;
			}

			// Hitung metode pembayaran per bulan
			const pm = (item as any)?.payment_method || 'lainnya';
			if (!requestedMonthlyData[monthKey].paymentMethods[pm]) {
				requestedMonthlyData[monthKey].paymentMethods[pm] = { jumlah: 0, nominal: 0 };
			}
			requestedMonthlyData[monthKey].paymentMethods[pm].jumlah += 1;
			requestedMonthlyData[monthKey].paymentMethods[pm].nominal += amount;

			// Hitung produk terlaris per bulan
			if (item.sumber === 'pos' && (item as any)?.transaksi_kasir) {
				for (const it of (item as any).transaksi_kasir) {
					const pid = (it as any)?.produk_id;
					if (!pid) continue;
					const qty = Number((it as any)?.qty || 0) || 0;
					const unit = Number((it as any)?.price || (it as any)?.amount || 0) || 0;
					const revenue = unit * (qty || 1);
					const productName = (it as any)?.produk?.name || (it as any)?.custom_name || `Produk ${pid.slice(0, 8)}`;
					
					if (!requestedMonthlyData[monthKey].produkTerlaris[pid]) {
						requestedMonthlyData[monthKey].produkTerlaris[pid] = { qty: 0, revenue: 0, name: productName };
					}
					requestedMonthlyData[monthKey].produkTerlaris[pid].qty += qty || 0;
					requestedMonthlyData[monthKey].produkTerlaris[pid].revenue += revenue;
				}
			}
		}


		// Format data per bulan untuk AI
		const formattedRequestedMonthlyData = Object.entries(requestedMonthlyData)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([monthKey, data]) => {
				const date = new Date(monthKey + '-01');
				const monthName = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
				const topProducts = Object.entries(data.produkTerlaris)
					.map(([pid, prod]) => ({ id: pid, nama: prod.name, totalTerjual: prod.qty, totalPendapatan: prod.revenue }))
					.sort((a, b) => b.totalTerjual - a.totalTerjual)
					.slice(0, 3);
				
				return {
					month: monthKey,
					monthName,
					pemasukan: data.pemasukan,
					pengeluaran: data.pengeluaran,
					laba: data.laba,
					transaksi: data.transaksi,
					paymentMethods: data.paymentMethods,
					topProducts
				};
			});

		const summary = {
			pendapatan: totalPemasukan,
			pengeluaran: totalPengeluaran,
			saldo: totalPemasukan - totalPengeluaran,
			labaKotor,
			pajak,
			labaBersih,
			totalTransaksi: new Set((bukuKasPos || []).map((b: any) => b.transaction_id).filter(Boolean))
				.size,
			// Data per bulan untuk periode yang diminta
			requestedMonthlyData: formattedRequestedMonthlyData
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
			startDate: dateRange.start,
			endDate: dateRange.end,
			tipe: dateRange.type,
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
=== KONTEKS RENTANG WAKTU ===
PERIODE YANG DIMINTA USER:
- Rentang: ${rangeContext.requested.startFormatted} s.d. ${rangeContext.requested.endFormatted}
- Format: ${rangeContext.requested.start} s.d. ${rangeContext.requested.end}
- Tipe: ${rangeContext.requested.type}

=== DATA LAPORAN PERIODE YANG DIMINTA (SUDAH DIFETCH SESUAI KONTEKS) ===
Rentang Waktu: ${serverReportData.startDate} s.d. ${serverReportData.endDate}
- Pendapatan: Rp ${serverReportData.summary?.pendapatan?.toLocaleString('id-ID') || '0'}
- Pengeluaran: Rp ${serverReportData.summary?.pengeluaran?.toLocaleString('id-ID') || '0'}
- Laba Kotor: Rp ${serverReportData.summary?.labaKotor?.toLocaleString('id-ID') || '0'}
- Pajak: Rp ${serverReportData.summary?.pajak?.toLocaleString('id-ID') || '0'}
- Laba Bersih: Rp ${serverReportData.summary?.labaBersih?.toLocaleString('id-ID') || '0'}
- Total Transaksi: ${serverReportData.summary?.totalTransaksi || '0'}

PENTING: Data di atas sudah sesuai dengan periode yang diminta user. Jika user bertanya "2 bulan terakhir", maka data di atas adalah data untuk 2 bulan terakhir. Jika user bertanya "5 hari pertama bulan ini", maka data di atas adalah data untuk 5 hari pertama bulan ini, bukan data bulan penuh. ANALISIS data yang tersedia, jangan katakan tidak ada data.

=== DATA PER BULAN UNTUK PERIODE YANG DIMINTA ===
${(serverReportData.summary?.requestedMonthlyData || []).map((month: any) => `
Bulan ${month.monthName} (${month.month}):
- Pendapatan: Rp ${month.pemasukan.toLocaleString('id-ID')}
- Pengeluaran: Rp ${month.pengeluaran.toLocaleString('id-ID')}
- Laba: Rp ${month.laba.toLocaleString('id-ID')}
- Total Transaksi: ${month.transaksi}
- Metode Pembayaran: ${Object.entries(month.paymentMethods).map(([method, data]: any) => {
	const methodLabels: Record<string, string> = {
		'tunai': 'Tunai (Cash)',
		'qris': 'QRIS (Digital Payment)',
		'lainnya': 'Lainnya'
	};
	const label = methodLabels[method] || method;
	return `${label}: ${data.jumlah} trx (Rp ${data.nominal.toLocaleString('id-ID')})`;
}).join(', ')}
- Top 3 Produk Terlaris: ${month.topProducts.map((p: any) => `${p.nama} (${p.totalTerjual} terjual, Rp ${p.totalPendapatan.toLocaleString('id-ID')})`).join(', ')}
`).join('\n') || '- (tidak ada data per bulan)'}

=== RINCIAN PEMBAYARAN ===
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

=== POLA WAKTU ===
Jam Ramai (Top 3):
${(serverReportData.jamRamai || []).map((s: string, i: number) => `- ${i + 1}. ${s}`).join('\n') || '- (tidak ada)'}

=== PRODUK & KATEGORI ===
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

		// AI 2: Analisis data bisnis
		console.log('AI 2: Analyzing business data...');
		console.log('Data summary:', {
			pendapatan: serverReportData?.summary?.pendapatan,
			totalTransaksi: serverReportData?.summary?.totalTransaksi,
			dateRange: `${dateRange.start} to ${dateRange.end}`
		});
		const answer = await analyzeBusinessData(question, reportContext, rangeContext, apiKey);
		console.log('AI 2 Result: Analysis completed');

		return json({
			success: true,
			answer: answer.trim(),
			dateRange: {
				start: dateRange.start,
				end: dateRange.end,
				reasoning: dateRange.reasoning
			}
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
