import { json } from '@sveltejs/kit';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import type { RequestHandler } from './$types';
import { witaRangeToWitaQuery } from '$lib/utils/dateTime';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-chat';

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}


// Util: format YYYY-MM-DD dalam zona WITA
function toYMDWita(date: Date): string {
	const d = new Date(date);
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}


// AI 1: Date Range Identifier
async function identifyDateRange(question: string, apiKey: string): Promise<{
	start: string;
	end: string;
	type: 'daily' | 'weekly' | 'monthly' | 'yearly';
	reasoning: string;
}> {
	// Hitung tanggal saat ini dalam WITA
	const now = new Date();
	const todayWita = toYMDWita(now);
	
	const systemMessage: ChatMessage = {
		role: 'system',
		content: `Anda adalah AI yang bertugas mengidentifikasi rentang tanggal dari pertanyaan user untuk analisis laporan bisnis.

TANGGAL SAAT INI: ${todayWita} (WITA)

TUGAS ANDA:
1. Analisis pertanyaan user dan tentukan rentang tanggal yang diperlukan
2. Berikan format tanggal YYYY-MM-DD untuk start dan end
3. Tentukan tipe periode (daily, weekly, monthly, yearly)
4. Berikan reasoning singkat mengapa rentang tersebut dipilih

ATURAN PENTING:
- Gunakan tanggal Indonesia (WITA)
- Tanggal saat ini: ${todayWita}
- Untuk "X bulan terakhir" (1, 2, 3, 4, 5, 6, dst), hitung dari AWAL BULAN X bulan yang lalu hingga hari ini
  Contoh: "2 bulan terakhir" dari 2025-09-07 = 2025-07-01 hingga 2025-09-07
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

CONTOH BERDASARKAN TANGGAL SAAT INI (${todayWita}):
- "2 bulan terakhir" → start: "2025-07-01", end: "${todayWita}", type: "monthly"
- "3 bulan terakhir" → start: "2025-06-01", end: "${todayWita}", type: "monthly"
- "6 bulan terakhir" → start: "2025-03-01", end: "${todayWita}", type: "monthly"
- "3 hari terakhir" → start: "2025-09-04", end: "${todayWita}", type: "daily"
- "5 hari pertama bulan ini" → start: "2025-09-01", end: "2025-09-05", type: "daily"
- "bulan ini vs bulan lalu" → start: "2025-08-01", end: "${todayWita}", type: "monthly"

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
		// Clean up response - remove markdown code blocks if present
		let cleanContent = content.trim();
		if (cleanContent.startsWith('```json')) {
			cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
		}
		if (cleanContent.startsWith('```')) {
			cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
		}
		
		const parsed = JSON.parse(cleanContent);
		console.log('AI 1 JSON Parse Success:', parsed);
		return {
			start: parsed.start || new Date().toISOString().split('T')[0],
			end: parsed.end || new Date().toISOString().split('T')[0],
			type: parsed.type || 'daily',
			reasoning: parsed.reasoning || 'Rentang tanggal diidentifikasi'
		};
	} catch (error) {
		console.error('AI 1 JSON Parse Error:', error);
		console.error('Raw AI 1 response:', content);
		console.error('Cleaned content:', content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
		// Tidak ada fallback, langsung error
		throw new Error(`AI 1 gagal mengidentifikasi rentang tanggal: ${error}`);
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
- Anda dapat menganalisis performa harian dan mengidentifikasi pola hari kerja vs weekend
- Anda dapat menganalisis rata-rata nilai transaksi dan memberikan insight tentang customer behavior
- Anda dapat mengidentifikasi hari terbaik dan terburuk serta memberikan rekomendasi strategis
- Anda dapat menganalisis konsistensi performa dan memberikan insight tentang stabilitas bisnis
- Anda dapat memberikan prediksi dan proyeksi berdasarkan tren yang teridentifikasi

FORMAT JAWABAN (jika memungkinkan):
- Ringkasan Utama (1-2 kalimat dengan konteks tanggal)
- Analisis Tren & Perbandingan (dengan angka dan persentase)
- Insight Kunci (bullet points dengan data pendukung)
- Analisis Performa Harian (pola hari kerja vs weekend, konsistensi)
- Analisis Customer Behavior (rata-rata nilai transaksi, frekuensi)
- Rekomendasi Tindakan (langkah konkret berdasarkan tren)
- Prediksi & Proyeksi (berdasarkan data historis)
- Risiko/Perhatian (berdasarkan analisis historis)
- Langkah Berikutnya (data tambahan yang diperlukan)

SPESIFIKASI ANALISIS BISNIS JUS:
- Fokus pada analisis musiman dan preferensi customer
- Analisis performa produk berdasarkan kategori (jus, smoothie, dll)
- Identifikasi jam-jam peak dan strategi staffing
- Analisis konsistensi kualitas layanan berdasarkan performa harian
- Rekomendasi pricing strategy berdasarkan analisis nilai transaksi
- Insight tentang customer retention dan loyalty patterns

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
		console.log('=== AI 1: DATE RANGE IDENTIFICATION ===');
		console.log('Question:', question);
		console.log('Current date (WITA):', toYMDWita(new Date()));
		
		const dateRange = await identifyDateRange(question, apiKey);
		
		console.log('=== AI 1 RESULT ===');
		console.log('✅ Start Date:', dateRange.start);
		console.log('✅ End Date:', dateRange.end);
		console.log('✅ Type:', dateRange.type);
		console.log('✅ Reasoning:', dateRange.reasoning);
		console.log('=== END AI 1 RESULT ===');

		// Ambil data langsung dari database sesuai branch & range yang diidentifikasi AI 1
		const supabase = getSupabaseClient((branch || 'dev') as any);

		// Hitung waktu WITA dari rentang yang diidentifikasi AI 1
		// STANDAR: Gunakan WITA untuk query database
		const { startWita, endWita } = witaRangeToWitaQuery(dateRange.start, dateRange.end);
		const startDate = startWita;
		const endDate = endWita;
		console.log('Query date range - start:', startDate, 'end:', endDate);
		console.log('Original date range from AI 1 - start:', dateRange.start, 'end:', dateRange.end);
		console.log('Timezone conversion - WITA format');

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

		// Function untuk fetch data dengan pagination dan timeout handling
		async function fetchAllData(table: string, filters: any) {
			let allData: any[] = [];
			let page = 0;
			const pageSize = 500; // Reduce page size untuk menghindari timeout
			let hasMore = true;
			const maxPages = 20; // Limit maksimal halaman untuk menghindari infinite loop
			
			console.log(`=== FETCHING ${table.toUpperCase()} WITH PAGINATION ===`);
			
			while (hasMore && page < maxPages) {
				try {
					// Add timeout wrapper - gunakan query yang lebih sederhana dulu
					let queryPromise = supabase
						.from(table)
						.select('*')
						.gte('waktu', startDate)
						.lte('waktu', endDate)
						.range(page * pageSize, (page + 1) * pageSize - 1)
						.order('waktu', { ascending: true });
					
					// Debug query untuk halaman pertama
					if (page === 0) {
						console.log(`🔍 Debug query for ${table}:`);
						console.log(`  - startDate: ${startDate}`);
						console.log(`  - endDate: ${endDate}`);
						console.log(`  - filters:`, filters);
					}
					
					// Apply filters
					if (filters.sumber) {
						queryPromise.eq('sumber', filters.sumber);
					}
					if (filters.excludeSumber) {
						queryPromise.neq('sumber', filters.excludeSumber);
					}
					// Note: Branch filtering is handled by getSupabaseClient(branch), not by column
					
					// Add timeout (30 seconds)
					const timeoutPromise = new Promise((_, reject) => 
						setTimeout(() => reject(new Error('Query timeout')), 30000)
					);
					
					const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
					
					if (error) {
						console.error(`❌ Error fetching ${table} page ${page + 1}:`, error);
						if (error.code === '57014' || error.message?.includes('timeout')) {
							console.warn(`⏰ Timeout detected for ${table}, stopping pagination`);
							break;
						}
						break;
					}
					
					if (data && data.length > 0) {
						allData = [...allData, ...data];
						console.log(`📄 ${table} page ${page + 1}: ${data.length} records (total: ${allData.length})`);
						
						// Jika data kurang dari pageSize, berarti sudah habis
						if (data.length < pageSize) {
							hasMore = false;
							console.log(`✅ ${table} fetch completed - no more data`);
						} else {
							page++;
						}
					} else {
						hasMore = false;
						console.log(`✅ ${table} fetch completed - no data found`);
					}
				} catch (timeoutError) {
					console.error(`⏰ Timeout error for ${table} page ${page + 1}:`, timeoutError);
					break;
				}
			}
			
			if (page >= maxPages) {
				console.warn(`⚠️ ${table} reached max pages limit (${maxPages}), stopping pagination`);
			}
			
			console.log(`🎯 ${table} FINAL TOTAL: ${allData.length} records`);
			return allData;
		}

		// Debug: Cek data yang ada di database dulu
		console.log('=== DEBUG: CHECKING EXISTING DATA ===');
		const { data: debugData, error: debugError } = await supabase
			.from('buku_kas')
			.select('waktu, sumber, amount, description')
			.order('waktu', { ascending: false })
			.limit(10);
		
		if (debugError) {
			console.error('Debug query error:', debugError);
		} else {
			console.log('Recent data in database:', debugData);
			if (debugData && debugData.length > 0) {
				console.log('Sample data dates:', debugData.map(d => d.waktu));
			}
		}
		console.log('=== END DEBUG ===');

		// Test query sederhana dulu tanpa filter
		console.log('=== TESTING SIMPLE QUERY ===');
		const { data: testData, error: testError } = await supabase
			.from('buku_kas')
			.select('waktu, sumber, amount, description')
			.gte('waktu', startDate)
			.lte('waktu', endDate)
			.limit(5);
		
		console.log('Test query result:', { testData, testError });
		console.log('Test query range:', { startDate, endDate });
		
		// Debug: Cek field amount vs nominal
		if (testData && testData.length > 0) {
			console.log('Sample data fields:', testData.map((d: any) => ({
				waktu: d.waktu,
				amount: d.amount,
				nominal: d.nominal,
				tipe: d.tipe,
				jenis: d.jenis,
				payment_method: d.payment_method,
				description: d.description
			})));
		}
		
		// Ambil data untuk periode yang diminta dengan pagination
		console.log('=== STARTING PAGINATED DATA FETCH ===');
		const [bukuKasPos, bukuKasManual] = await Promise.all([
			fetchAllData('buku_kas', { sumber: 'pos' }),
			fetchAllData('buku_kas', { excludeSumber: 'pos' })
		]);

		// Ambil data transaksi_kasir dengan relasi produk untuk data POS
		console.log('=== FETCHING TRANSAKSI_KASIR WITH PRODUCTS ===');
		let transaksiKasirData: any[] = [];
		if (bukuKasPos && bukuKasPos.length > 0) {
			// Ambil buku_kas_id dari data POS
			const bukuKasIds = bukuKasPos.map((item: any) => item.id).filter(Boolean);
			console.log('Buku kas IDs for transaksi_kasir:', bukuKasIds.length);
			
			if (bukuKasIds.length > 0) {
				try {
					const { data: transaksiKasir, error: errorTransaksiKasir } = await supabase
						.from('transaksi_kasir')
						.select('*, produk(name)')
						.in('buku_kas_id', bukuKasIds);
					
					if (errorTransaksiKasir) {
						console.error('Error fetching transaksi_kasir:', errorTransaksiKasir);
					} else {
						transaksiKasirData = transaksiKasir || [];
						console.log('Transaksi kasir fetched:', transaksiKasirData.length);
					}
				} catch (error) {
					console.error('Error in transaksi_kasir query:', error);
				}
			}
		}

		console.log('=== DATABASE QUERY RESULTS ===');
		console.log('📊 bukuKasPos count:', bukuKasPos?.length || 0);
		console.log('📊 bukuKasManual count:', bukuKasManual?.length || 0);
		console.log('📊 Total records found:', (bukuKasPos?.length || 0) + (bukuKasManual?.length || 0));
		console.log('=== END DATABASE QUERY RESULTS ===');

		// Handle case when no data found
		if ((!bukuKasPos || bukuKasPos.length === 0) && (!bukuKasManual || bukuKasManual.length === 0)) {
			console.warn('⚠️ No data found for the requested period');
			return new Response(
				JSON.stringify({
					success: false,
					error: 'Tidak ada data ditemukan untuk periode yang diminta',
					dateRange: `${dateRange.start} hingga ${dateRange.end}`,
					suggestion: 'Coba gunakan periode yang lebih pendek atau periksa apakah ada data transaksi dalam rentang waktu tersebut'
				}),
				{
					headers: { 'Content-Type': 'application/json' },
					status: 404
				}
			);
		}

		// Data periode yang diminta - gunakan logika yang sama dengan DataService
		const laporan: any[] = [];
		
		// 1. Tambahkan data POS dari buku_kas (sumber='pos')
		(bukuKasPos || []).forEach((item: any) => {
			laporan.push({
				...item,
				sumber: 'pos',
				nominal: item.amount || 0  // Map amount ke nominal seperti DataService
			});
		});
		
		// 2. Tambahkan data manual/catat
		(bukuKasManual || []).forEach((item: any) => {
			laporan.push({
				...item,
				sumber: item.sumber || 'catat',
				nominal: item.amount || 0  // Map amount ke nominal seperti DataService
			});
		});

		// Hitung data periode yang diminta
		const pemasukan = laporan.filter((t: any) => t.tipe === 'in');
		const pengeluaran = laporan.filter((t: any) => t.tipe === 'out');
		
		// Debug: Cek data pemasukan
		console.log('=== DEBUG PEMASUKAN ===');
		console.log('Total laporan records:', laporan.length);
		console.log('Pemasukan records:', pemasukan.length);
		console.log('Sample pemasukan:', pemasukan.slice(0, 3).map(p => ({
			tipe: p.tipe,
			jenis: p.jenis,
			nominal: p.nominal,
			amount: p.amount,
			payment_method: p.payment_method,
			description: p.description
		})));
		
		const totalPemasukan = pemasukan.reduce(
			(s: number, t: any) => s + (t.nominal || 0),
			0
		);
		const totalPengeluaran = pengeluaran.reduce(
			(s: number, t: any) => s + (t.nominal || 0),
			0
		);
		
		console.log('Total pemasukan calculated:', totalPemasukan);
		console.log('Total pengeluaran calculated:', totalPengeluaran);
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
			
			const amount = item.nominal || 0;
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

			// Hitung produk terlaris per bulan - akan dihitung terpisah menggunakan transaksiKasirData
		}

		// Hitung produk terlaris per bulan menggunakan data transaksi_kasir
		for (const item of transaksiKasirData || []) {
			const date = new Date(item.created_at || item.waktu);
			const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			
			if (requestedMonthlyData[monthKey]) {
				const pid = (item as any)?.produk_id;
				if (!pid) continue;
				const qty = Number((item as any)?.qty || 0) || 0;
				const unit = Number((item as any)?.price || (item as any)?.amount || 0) || 0;
				const revenue = unit * (qty || 1);
				const productName = (item as any)?.produk?.name || (item as any)?.custom_name || `Produk ${pid.slice(0, 8)}`;
				
				if (!requestedMonthlyData[monthKey].produkTerlaris[pid]) {
					requestedMonthlyData[monthKey].produkTerlaris[pid] = { qty: 0, revenue: 0, name: productName };
				}
				requestedMonthlyData[monthKey].produkTerlaris[pid].qty += qty || 0;
				requestedMonthlyData[monthKey].produkTerlaris[pid].revenue += revenue;
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
			const wita = new Date(waktu);
			const h = wita.getHours();
			const key = h.toString().padStart(2, '0');
			hourCount[key] = (hourCount[key] || 0) + 1;
		}
		const jamRamai = Object.entries(hourCount)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([h, c]) => `${h}:00 (${c} trx)`);

		// Analisis tren harian untuk insight lebih mendalam
		const dailyTrend: Record<string, { count: number; revenue: number; avgTicket: number }> = {};
		for (const t of bukuKasPos || []) {
			const waktu = new Date(t.waktu);
			const wita = new Date(waktu);
			const dateKey = wita.toISOString().split('T')[0];
			const revenue = t.amount || 0;
			
			if (!dailyTrend[dateKey]) {
				dailyTrend[dateKey] = { count: 0, revenue: 0, avgTicket: 0 };
			}
			dailyTrend[dateKey].count += 1;
			dailyTrend[dateKey].revenue += revenue;
		}
		
		// Hitung rata-rata per transaksi
		Object.keys(dailyTrend).forEach(date => {
			if (dailyTrend[date].count > 0) {
				dailyTrend[date].avgTicket = dailyTrend[date].revenue / dailyTrend[date].count;
			}
		});
		
		// Analisis performa harian
		const dailyPerformance = Object.entries(dailyTrend)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, data]) => ({
				date,
				formattedDate: new Date(date).toLocaleDateString('id-ID', { 
					weekday: 'long', 
					day: 'numeric', 
					month: 'long' 
				}),
				...data
			}));
		
		// Hitung statistik keseluruhan
		const totalDays = dailyPerformance.length;
		const avgTransactionsPerDay = totalDays > 0 ? dailyPerformance.reduce((sum, day) => sum + day.count, 0) / totalDays : 0;
		const avgRevenuePerDay = totalDays > 0 ? dailyPerformance.reduce((sum, day) => sum + day.revenue, 0) / totalDays : 0;
		const avgTicketSize = totalPemasukan > 0 && (bukuKasPos?.length || 0) > 0 ? totalPemasukan / (bukuKasPos?.length || 1) : 0;
		
		// Identifikasi hari terbaik dan terburuk
		const bestDay = dailyPerformance.reduce((best, current) => 
			current.revenue > best.revenue ? current : best, dailyPerformance[0] || { revenue: 0 });
		const worstDay = dailyPerformance.reduce((worst, current) => 
			current.revenue < worst.revenue ? current : worst, dailyPerformance[0] || { revenue: 0 });

		// Ambil metadata produk/kategori/tambahan
		const [{ data: products }, { data: categories }, { data: addons }] = await Promise.all([
			supabase.from('produk').select('id, name, price, category_id').limit(1000),
			supabase.from('kategori').select('id, name').limit(1000),
			supabase.from('tambahan').select('id, name, price').limit(1000)
		]);

		// Hitung produk terlaris berdasarkan transaksi_kasir yang sudah diambil
		const productIdToSale: Record<string, { qty: number; revenue: number; name?: string }> = {};
		for (const item of transaksiKasirData || []) {
			const pid = (item as any)?.produk_id;
			if (!pid) continue;
			const qty = Number((item as any)?.qty || 0) || 0;
			const unit = Number((item as any)?.price || (item as any)?.amount || 0) || 0;
			const revenue = unit * (qty || 1);
			// Ambil nama dari relasi produk atau custom_name
			const productName =
				(item as any)?.produk?.name || (item as any)?.custom_name || `Produk ${pid.slice(0, 8)}`;
			if (!productIdToSale[pid]) productIdToSale[pid] = { qty: 0, revenue: 0, name: productName };
			productIdToSale[pid].qty += qty || 0;
			productIdToSale[pid].revenue += revenue;
			if (!productIdToSale[pid].name) productIdToSale[pid].name = productName;
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
			produkTerlaris,
			// Data analisis mendalam
			dailyPerformance,
			analytics: {
				avgTransactionsPerDay: Math.round(avgTransactionsPerDay * 100) / 100,
				avgRevenuePerDay: Math.round(avgRevenuePerDay),
				avgTicketSize: Math.round(avgTicketSize),
				totalDays,
				bestDay: bestDay.revenue > 0 ? {
					date: bestDay.formattedDate,
					revenue: bestDay.revenue,
					transactions: bestDay.count,
					avgTicket: Math.round(bestDay.avgTicket)
				} : null,
				worstDay: worstDay.revenue > 0 ? {
					date: worstDay.formattedDate,
					revenue: worstDay.revenue,
					transactions: worstDay.count,
					avgTicket: Math.round(worstDay.avgTicket)
				} : null
			}
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

=== ANALISIS MENDALAM ===
Performa Harian:
- Rata-rata transaksi per hari: ${serverReportData.analytics?.avgTransactionsPerDay || 0} trx
- Rata-rata pendapatan per hari: Rp ${(serverReportData.analytics?.avgRevenuePerDay || 0).toLocaleString('id-ID')}
- Rata-rata nilai per transaksi: Rp ${(serverReportData.analytics?.avgTicketSize || 0).toLocaleString('id-ID')}
- Total hari aktif: ${serverReportData.analytics?.totalDays || 0} hari

Hari Terbaik: ${serverReportData.analytics?.bestDay ? `${serverReportData.analytics.bestDay.date} - Rp ${serverReportData.analytics.bestDay.revenue.toLocaleString('id-ID')} (${serverReportData.analytics.bestDay.transactions} trx, avg Rp ${serverReportData.analytics.bestDay.avgTicket.toLocaleString('id-ID')})` : 'Tidak ada data'}

Hari Terburuk: ${serverReportData.analytics?.worstDay ? `${serverReportData.analytics.worstDay.date} - Rp ${serverReportData.analytics.worstDay.revenue.toLocaleString('id-ID')} (${serverReportData.analytics.worstDay.transactions} trx, avg Rp ${serverReportData.analytics.worstDay.avgTicket.toLocaleString('id-ID')})` : 'Tidak ada data'}

Detail Performa Harian:
${(serverReportData.dailyPerformance || []).map((day: any) => 
	`- ${day.formattedDate}: ${day.count} trx, Rp ${day.revenue.toLocaleString('id-ID')} (avg Rp ${Math.round(day.avgTicket).toLocaleString('id-ID')})`
).join('\n') || '- (tidak ada data harian)'}
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
