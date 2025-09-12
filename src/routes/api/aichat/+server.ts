import { json } from '@sveltejs/kit';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import type { RequestHandler } from './$types';
import { witaRangeToWitaQuery } from '$lib/utils/dateTime';
import { productAnalysisService } from '$lib/services/productAnalysisService';

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

// AI 1: Data Requirement Analyzer
async function identifyDataRequirements(
	question: string,
	apiKey: string
): Promise<{
	periode: {
		start: string;
		end: string;
		type: 'daily' | 'weekly' | 'monthly' | 'yearly';
	};
	jenisData: string[];
	prioritas: string;
	scope: string;
	reasoning: string;
}> {
	// Hitung tanggal saat ini dalam WITA
	const now = new Date();
	const todayWita = toYMDWita(now);

	const systemMessage: ChatMessage = {
		role: 'system',
		content: `Anda adalah AI yang bertugas mengidentifikasi kebutuhan data dari pertanyaan user untuk analisis laporan bisnis.

TANGGAL SAAT INI: ${todayWita} (WITA)

TUGAS ANDA:
1. Analisis pertanyaan user dan tentukan RENTANG TANGGAL yang diperlukan
2. Identifikasi JENIS DATA yang dibutuhkan user
3. Tentukan PRIORITAS analisis yang diperlukan
4. Tentukan SCOPE analisis yang tepat
5. Berikan reasoning singkat mengapa pilihan tersebut dipilih

JENIS DATA YANG TERSEDIA:
- buku_kas: Data transaksi keuangan (pendapatan, pengeluaran)
- transaksi_kasir: Detail transaksi per item dengan nama produk
- produk: Master data produk (nama, harga, kategori)
- kategori: Master data kategori produk
- daily_trends: Analisis tren harian dan performa
- payment_analysis: Analisis metode pembayaran (tunai, QRIS)
- product_performance: Performa produk (terlaris, revenue)
- financial_summary: Ringkasan keuangan (laba, pajak, dll)
- customer_behavior: Perilaku customer dan preferensi
- seasonal_analysis: Analisis musiman dan tren

PRIORITAS ANALISIS:
- product_analysis: Fokus pada analisis produk
- sales_analysis: Fokus pada analisis penjualan
- financial_analysis: Fokus pada analisis keuangan
- trend_analysis: Fokus pada analisis tren
- operational_analysis: Fokus pada analisis operasional
- customer_analysis: Fokus pada analisis customer

SCOPE ANALISIS:
- product_performance: Performa produk dan penjualan
- trend_analysis: Analisis tren dan perubahan
- revenue_analysis: Analisis pendapatan dan keuangan
- customer_insights: Insight customer dan behavior
- operational_efficiency: Efisiensi operasional
- market_analysis: Analisis pasar dan kompetitif

ATURAN TANGGAL:
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

CONTOH OUTPUT:
{
  "periode": {
    "start": "2025-09-01",
    "end": "2025-09-07",
    "type": "daily"
  },
  "jenisData": ["produk_terlaris", "transaksi_kasir"],
  "prioritas": "product_analysis",
  "scope": "product_performance",
  "reasoning": "User bertanya tentang produk terlaris, jadi fokus pada data produk dan transaksi"
}

CONTOH BERDASARKAN TANGGAL SAAT INI (${todayWita}):
- "Produk apa yang paling laris?" → periode: "2025-09-01 to ${todayWita}", jenisData: ["produk_terlaris", "transaksi_kasir"], prioritas: "product_analysis", scope: "product_performance"
- "Bagaimana tren penjualan 2 bulan terakhir?" → periode: "2025-07-01 to ${todayWita}", jenisData: ["buku_kas", "daily_trends"], prioritas: "trend_analysis", scope: "trend_analysis"
- "Berapa pendapatan hari ini?" → periode: "${todayWita} to ${todayWita}", jenisData: ["buku_kas"], prioritas: "financial_analysis", scope: "revenue_analysis"
- "Metode pembayaran apa yang paling banyak digunakan?" → periode: "2025-09-01 to ${todayWita}", jenisData: ["buku_kas", "payment_analysis"], prioritas: "operational_analysis", scope: "operational_efficiency"

Pertanyaan user: "${question}"`
	};

	const response = await fetch(OPENROUTER_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://zatiaraspos.com',
			'X-Title': 'Zatiaras POS - Data Requirement Analyzer'
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
		return {
			periode: {
				start: parsed.periode?.start || parsed.start || new Date().toISOString().split('T')[0],
				end: parsed.periode?.end || parsed.end || new Date().toISOString().split('T')[0],
				type: parsed.periode?.type || parsed.type || 'daily'
			},
			jenisData: parsed.jenisData || [],
			prioritas: parsed.prioritas || 'general_analysis',
			scope: parsed.scope || 'general_analysis',
			reasoning: parsed.reasoning || 'Kebutuhan data diidentifikasi berdasarkan pertanyaan user'
		};
	} catch (error) {
		// Tidak ada fallback, langsung error
		throw new Error(`AI 1 gagal mengidentifikasi kebutuhan data: ${error}`);
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

KEBUTUHAN DATA YANG DIPERLUKAN:
- Jenis Data: ${dateRange.dataRequirements?.jenisData?.join(', ') || 'semua data'}
- Prioritas: ${dateRange.dataRequirements?.prioritas || 'general_analysis'}
- Scope: ${dateRange.dataRequirements?.scope || 'general_analysis'}

ATURAN ANALISIS:
1) Jawab SELALU dalam Bahasa Indonesia yang profesional namun ramah.
2) Berikan jawaban LENGKAP dan DETAIL sesuai data, jangan disingkat, kecuali diminta singkat.
3) WAJIB analisis tren dan perbandingan dalam periode yang diminta.
4) Sertakan angka, persentase, tren, perbandingan periode dalam setiap analisis.
5) Jelaskan "mengapa" dan "bagaimana" (reasoning bisnis) untuk setiap insight penting.
6) Jika diminta perbandingan (bulan A vs bulan B, dll), WAJIB gunakan data yang tersedia dalam periode.
7) Jika data terbatas/tidak ada, nyatakan keterbatasannya dan sebutkan data tambahan yang diperlukan.
8) Hindari klaim tanpa dukungan data pada konteks yang diberikan.

FOKUS ANALISIS BERDASARKAN KEBUTUHAN DATA:
- Prioritas: ${dateRange.dataRequirements?.prioritas || 'general_analysis'}
- Scope: ${dateRange.dataRequirements?.scope || 'general_analysis'}
- Jenis Data: ${dateRange.dataRequirements?.jenisData?.join(', ') || 'semua data'}

PENTING: Sesuaikan analisis Anda dengan prioritas dan scope yang ditentukan. Jika prioritas adalah "product_analysis", fokus pada analisis produk. Jika scope adalah "trend_analysis", fokus pada analisis tren dan perubahan.

KHUSUS UNTUK PERTANYAAN HARGA PRODUK:
- Jika user bertanya tentang harga produk spesifik, gunakan data di bagian "PRODUK SPESIFIK YANG DICARI"
- Berikan jawaban langsung dan jelas tentang harga produk yang diminta
- Jika produk tidak ditemukan, berikan daftar produk yang tersedia dengan harganya
- Gunakan format: "Harga [nama produk] adalah Rp [harga]"

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

// AI 3: Transaction Analyzer
async function analyzeTransactionText(
	text: string,
	apiKey: string,
	request?: Request
): Promise<{
	transactions: any[];
	confidence: number;
	recommendations: any[];
}> {
	// Fetch product data untuk analisis
	let productData = '';
	try {
		// Get current branch from request headers or use default
		const branch = request?.headers.get('x-branch') || 'default';

		productData = await productAnalysisService.generateProductPromptData(branch);
	} catch (error) {
		productData =
			'Data produk tidak tersedia saat ini. JIKA USER MENYEBUTKAN PRODUK, JANGAN berikan rekomendasi untuk penjualan produk karena tidak ada informasi harga. Minta user untuk memberikan informasi harga atau detail transaksi yang lebih spesifik.';
	}

	const systemMessage: ChatMessage = {
		role: 'system',
		content: `Halo! Saya adalah Asisten AI untuk aplikasi POS Zatiaras. Saya di sini untuk membantu Anda mencatat dan mengelola transaksi bisnis dengan mudah dan akurat.

🎯 **PERAN SAYA:**
Saya adalah asisten cerdas yang membantu Anda:
- Mencatat transaksi penjualan produk (POS)
- Mengelola pemasukan dan pengeluaran kas
- Menganalisis cerita transaksi dari percakapan sehari-hari
- Memberikan rekomendasi pencatatan yang tepat
- Memastikan semua transaksi tercatat dengan benar di sistem

🏪 **TENTANG APLIKASI ZATIARAS POS:**
Zatiaras adalah sistem Point of Sale (POS) yang dirancang khusus untuk toko, kafe, dan bisnis retail. Aplikasi ini membantu Anda:
- Mengelola penjualan produk secara real-time
- Mencatat transaksi keuangan (pemasukan/pengeluaran)
- Melacak stok produk dan harga
- Membuat laporan keuangan harian
- Mengelola sesi buka/tutup toko
- Mendukung multi-branch (cabang)

📊 **JENIS TRANSAKSI YANG SAYA BANTU:**

1. **PENJUALAN PRODUK (POS):**
   - Customer membeli produk di toko
   - Transaksi melalui sistem POS
   - Otomatis menghitung harga berdasarkan data produk

2. **PEMASUKAN KAS (Manual):**
   - Setoran modal ke kas
   - Tambahan dana operasional
   - Pemasukan dari sumber lain

3. **PENGELUARAN KAS (Manual):**
   - Belanja operasional
   - Pembayaran tagihan
   - Pengambilan pribadi

🔍 **CARA KERJA SAYA:**
Saya menganalisis cerita transaksi Anda dalam bahasa Indonesia sehari-hari, kemudian:
- Mengidentifikasi jenis transaksi
- Mengekstrak detail (jumlah, produk, deskripsi)
- Menghitung harga otomatis untuk produk
- Memberikan rekomendasi pencatatan yang tepat
- Memastikan data tersimpan dengan benar

💡 **CONTOH CARA BERINTERAKSI:**
- "Tadi ada customer beli 2 jus mangga dan 1 kerupuk"
- "Masukkan uang 50rb ke kas untuk modal"
- "Ambil 20rb buat beli bahan baku"
- "Customer pesan 3 nasi goreng tadi siang"
- "Terjual 5 jus jeruk dan 2 jus apel"

KATA KUNCI UNTUK IDENTIFIKASI (DIPERLUAS):

PEMASUKAN (Manual) - Kata kunci:
- "masukkan uang", "setor uang", "modal", "tambah uang", "masuk uang", "setoran", "tambahan modal"
- "isi kas", "isi uang", "top up", "deposit", "investasi", "modal kerja"
- "dari bank", "transfer masuk", "setor tunai", "masuk kas", "tambah modal"
- "dari investor", "pinjaman masuk", "hibah", "bantuan modal"
- "setor pagi", "setor siang", "setor sore", "setor malam"
- "tambah kas", "isi kas", "isi modal", "tambah dana"

PENGELUARAN (Manual) - Kata kunci:
- "ambil uang", "keluar", "pengambilan", "belanja operasional", "beli bahan", "bayar tagihan"
- "bayar listrik", "bayar air", "bayar internet", "bayar sewa", "bayar gaji", "bayar karyawan"
- "beli bahan baku", "beli peralatan", "beli perlengkapan", "beli jajan", "beli makan"
- "ambil untuk", "keluar untuk", "pengambilan pribadi", "ambil modal", "ambil keuntungan"
- "bayar supplier", "bayar vendor", "bayar kontraktor", "bayar tukang"
- "beli gas", "beli minyak", "beli bensin", "beli solar", "beli oli"
- "perbaikan", "maintenance", "servis", "service", "perawatan"
- "bayar pajak", "bayar retribusi", "bayar ijin", "bayar lisensi"

PENJUALAN (POS) - Kata kunci:
- "customer", "pembeli", "membeli", "pesan", "order", "jual", "terjual", "laku", "ada yang beli"
- "catat", "catatlah", "tadi ada", "ada customer", "beli [produk]", "membeli [produk]"
- "ada yang pesan", "ada yang order", "ada yang ambil", "ada yang beli"
- "tadi customer", "baru customer", "customer tadi", "pembeli tadi"
- "terjual", "laku", "habis", "sold out", "kehabisan"
- "ada yang ambil", "ada yang beli", "ada yang pesan", "ada yang order"
- "customer ambil", "customer beli", "customer pesan", "customer order"
- "pembeli ambil", "pembeli beli", "pembeli pesan", "pembeli order"
- "tadi ada yang", "baru ada yang", "ada yang", "tadi customer"
- "catat penjualan", "catat transaksi", "catat pembelian", "catat pesanan"
- "catatlah penjualan", "catatlah transaksi", "catatlah pembelian", "catatlah pesanan"
- "jual [produk]", "terjual [produk]", "laku [produk]", "habis [produk]"
- "ada yang jual", "ada yang terjual", "ada yang laku", "ada yang habis", "ada yang beli", "aku jualin"

ATURAN PENTING:
- "masukkan uang ke kas" = PEMASUKAN (setoran modal)
- "ambil uang dari kas" = PENGELUARAN (pengambilan pribadi/operasional)
- "customer membeli [produk]" = PENJUALAN (transaksi POS)
- "ada yang pesan [produk]" = PENJUALAN (transaksi POS)
- "terjual [produk]" = PENJUALAN (transaksi POS)
- "tadi ada customer membeli [produk]" = PENJUALAN (transaksi POS)
- "ada customer membeli [produk]" = PENJUALAN (transaksi POS)
- "catat [produk]" = PENJUALAN (transaksi POS)
- "catatlah [produk]" = PENJUALAN (transaksi POS)
- JIKA user menyebutkan "customer" + "membeli" + nama produk = PENJUALAN
- JIKA user menyebutkan "ada" + "membeli" + nama produk = PENJUALAN
- JIKA user menyebutkan "catat" + nama produk = PENJUALAN

HANDLING MULTIPLE PRODUK:
- User: "customer beli 2 jus mangga, 3 kerupuk, 1 nasi goreng" = 1 transaksi penjualan dengan multiple produk
- User: "ada yang pesan 5 jus jeruk dan 2 jus apel" = 1 transaksi penjualan dengan multiple produk
- User: "terjual 10 kerupuk, 5 jus mangga, 3 nasi goreng" = 1 transaksi penjualan dengan multiple produk
- User: "tadi customer ambil 2 jus mangga, 1 jus jeruk, 3 kerupuk" = 1 transaksi penjualan dengan multiple produk

ATURAN PENTING:
- HANYA identifikasi transaksi yang JELAS disebutkan dalam cerita
- JANGAN buat asumsi atau inferensi tambahan
- JIKA user bilang "masukkan uang 12rb", itu HANYA 1 transaksi pemasukan 12rb
- JANGAN duplikasi transaksi yang sama
- UNTUK PENJUALAN: Gunakan data produk di bawah untuk menghitung harga yang tepat
- JIKA USER MENYEBUTKAN PRODUK: Cari nama produk yang cocok di data produk (case insensitive)
- JIKA PRODUK DITEMUKAN: Hitung total harga = harga_produk × jumlah
- JIKA PRODUK TIDAK DITEMUKAN: Return transactions array kosong
- JIKA TIDAK DAPAT MENGIDENTIFIKASI TRANSAKSI: Return transactions array kosong dan JANGAN berikan rekomendasi apapun

CONTOH PENCARIAN PRODUK (SINGLE):
- User: "membeli 5 kerupuk" → Cari "kerupuk" di data produk → Ditemukan "Kerupuk" harga 1000 → Total: 1000 × 5 = 5000
- User: "membeli 3 Kerupuk" → Cari "Kerupuk" di data produk → Ditemukan "Kerupuk" harga 1000 → Total: 1000 × 3 = 3000
- User: "membeli 2 nasi goreng" → Cari "nasi goreng" di data produk → Tidak ditemukan → Return transactions array kosong

CONTOH PENCARIAN PRODUK (MULTIPLE):
- User: "customer beli 2 jus mangga, 3 kerupuk" → 
  Cari "jus mangga" → Ditemukan harga 15000 → 15000 × 2 = 30000
  Cari "kerupuk" → Ditemukan harga 1000 → 1000 × 3 = 3000
  Total: 30000 + 3000 = 33000
- User: "ada yang pesan 5 jus jeruk dan 2 jus apel" →
  Cari "jus jeruk" → Ditemukan harga 12000 → 12000 × 5 = 60000
  Cari "jus apel" → Ditemukan harga 18000 → 18000 × 2 = 36000
  Total: 60000 + 36000 = 96000

${productData}

CONTOH ANALISIS (SINGLE PRODUK):
Input: "Tadi masukkan uang 2000, ambil 5000 buat beli jajan"
Output: [
  { type: "pemasukan", amount: 2000, description: "Setoran modal ke kas", confidence: 0.9 },
  { type: "pengeluaran", amount: 5000, description: "Pengambilan uang untuk belanja pribadi", confidence: 0.9 }
]

Input: "Customer membeli jus mangga reguler dengan topping milo"
Output: [
  { type: "penjualan", amount: [harga_jus_mangga + harga_milo], description: "Penjualan jus mangga reguler + topping milo", confidence: 0.95 }
]

Input: "ada yang pesan nasi goreng"
Output: [
  { type: "penjualan", amount: [harga_nasi_goreng], description: "Penjualan nasi goreng", confidence: 0.95 }
]

Input: "terjual 2 jus jeruk"
Output: [
  { type: "penjualan", amount: [harga_jus_jeruk * 2], description: "Penjualan 2 jus jeruk", confidence: 0.95 }
]

Input: "tadi ada customer membeli 5 kerupuk, catatlah itu"
Output: [
  { type: "penjualan", amount: 5000, description: "Penjualan 5 kerupuk", confidence: 0.95, products: [{ name: "Kerupuk", price: 1000, quantity: 5 }] }
]

CONTOH ANALISIS (MULTIPLE PRODUK):
Input: "customer beli 2 jus mangga, 3 kerupuk, 1 nasi goreng"
Output: [
  { 
    type: "penjualan", 
    amount: [harga_jus_mangga * 2 + harga_kerupuk * 3 + harga_nasi_goreng * 1], 
    description: "Penjualan 2 jus mangga, 3 kerupuk, 1 nasi goreng", 
    confidence: 0.95,
    products: [
      { name: "Jus Mangga", price: harga_jus_mangga, quantity: 2 },
      { name: "Kerupuk", price: harga_kerupuk, quantity: 3 },
      { name: "Nasi Goreng", price: harga_nasi_goreng, quantity: 1 }
    ]
  }
]

Input: "ada yang pesan 5 jus jeruk dan 2 jus apel"
Output: [
  { 
    type: "penjualan", 
    amount: [harga_jus_jeruk * 5 + harga_jus_apel * 2], 
    description: "Penjualan 5 jus jeruk dan 2 jus apel", 
    confidence: 0.95,
    products: [
      { name: "Jus Jeruk", price: harga_jus_jeruk, quantity: 5 },
      { name: "Jus Apel", price: harga_jus_apel, quantity: 2 }
    ]
  }
]

Input: "terjual 10 kerupuk, 5 jus mangga, 3 nasi goreng"
Output: [
  { 
    type: "penjualan", 
    amount: [harga_kerupuk * 10 + harga_jus_mangga * 5 + harga_nasi_goreng * 3], 
    description: "Penjualan 10 kerupuk, 5 jus mangga, 3 nasi goreng", 
    confidence: 0.95,
    products: [
      { name: "Kerupuk", price: harga_kerupuk, quantity: 10 },
      { name: "Jus Mangga", price: harga_jus_mangga, quantity: 5 },
      { name: "Nasi Goreng", price: harga_nasi_goreng, quantity: 3 }
    ]
  }
]

Input: "masukkan uang 10rb"
Output: [
  { type: "pemasukan", amount: 10000, description: "Setoran modal ke kas", confidence: 0.95 }
]

Input: "ambil uang 50rb"
Output: [
  { type: "pengeluaran", amount: 50000, description: "Pengambilan uang dari kas", confidence: 0.95 }
]

Input: "beli bahan baku 100rb"
Output: [
  { type: "pengeluaran", amount: 100000, description: "Pembelian bahan baku", confidence: 0.95 }
]

Input: "hari ini cuacanya bagus"
Output: {
  "transactions": [],
  "confidence": 0.0,
  "recommendations": []
}

Input: "apa kabar?"
Output: {
  "transactions": [],
  "confidence": 0.0,
  "recommendations": []
}

Input: "toko buka jam berapa?"
Output: {
  "transactions": [],
  "confidence": 0.0,
  "recommendations": []
}

Input: "customer membeli kerupuk 5 biji" (jika data produk tidak tersedia)
Output: {
  "transactions": [],
  "confidence": 0.0,
  "recommendations": []
}

Input: "ada yang beli jus mangga" (jika data produk tidak tersedia)
Output: {
  "transactions": [],
  "confidence": 0.0,
  "recommendations": []
}

🤝 **CARA BERINTERAKSI DENGAN SAYA:**
- Sampaikan transaksi dalam bahasa Indonesia sehari-hari
- Saya akan menganalisis dan memberikan rekomendasi
- Klik "Terapkan Rekomendasi" untuk menyimpan transaksi
- Semua transaksi akan otomatis tersimpan di laporan dan riwayat

⚠️ **PENTING:**
- Saya hanya akan memberikan rekomendasi jika ada transaksi yang jelas teridentifikasi
- Jika tidak ada transaksi yang bisa diidentifikasi, saya akan meminta detail yang lebih spesifik
- Semua data transaksi akan tersimpan dengan aman di sistem Zatiara

${productData}

FORMAT OUTPUT (JSON):
{
  "transactions": [
    {
      "type": "pemasukan|pengeluaran|penjualan",
      "amount": number,
      "description": "string",
      "confidence": number (0-1),
      "products": [
        {
          "name": "string",
          "price": number,
          "quantity": number,
          "addOns": [
            {
              "name": "string",
              "price": number
            }
          ]
        }
      ]
    }
  ],
  "confidence": number (0-1),
  "recommendations": [
    {
      "action": "create_transaction",
      "title": "string",
      "description": "string"
    }
  ]
}

PENTING: HANYA return JSON, JANGAN tambahkan penjelasan atau teks lain di luar JSON!

PENTING:
- Selalu gunakan Bahasa Indonesia
- Pastikan amount adalah angka positif
- Berikan confidence score yang realistis
- Buat rekomendasi yang actionable
- JANGAN duplikasi transaksi
- UNTUK PENJUALAN: Hitung total harga berdasarkan produk + add-ons yang disebutkan
- JIKA TIDAK ADA TRANSAKSI YANG DAPAT DIIDENTIFIKASI: Return transactions array kosong dan confidence 0.0
- JANGAN berikan rekomendasi jika tidak ada transaksi yang teridentifikasi
- UNTUK MULTIPLE PRODUK: Buat 1 transaksi penjualan dengan array products yang berisi semua produk
- UNTUK MULTIPLE PRODUK: Hitung total amount dari semua produk yang disebutkan

LANGKAH-LANGKAH UNTUK PENJUALAN PRODUK:
1. Identifikasi semua nama produk yang disebutkan user
2. Cari setiap produk di data produk (case insensitive)
3. Jika semua produk ditemukan: hitung total = (harga_produk1 × jumlah1) + (harga_produk2 × jumlah2) + ...
4. Jika ada produk yang tidak ditemukan: return transactions array kosong
5. Buat rekomendasi dengan amount yang sudah dihitung dan array products yang lengkap

💬 **RESPONS SAYA:**
Saya akan menganalisis pesan Anda dan memberikan rekomendasi transaksi yang tepat. Jika tidak ada transaksi yang bisa diidentifikasi, saya akan meminta detail yang lebih spesifik.

Teks user: "${text}"`
	};

	const response = await fetch(OPENROUTER_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://zatiaraspos.com',
			'X-Title': 'Zatiaras POS - Transaction Analyzer'
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [systemMessage],
			max_tokens: 1000,
			temperature: 0.3
		})
	});

	if (!response.ok) {
		throw new Error(`AI 3 Error: ${response.status}`);
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

		return {
			transactions: parsed.transactions || [],
			confidence: parsed.confidence || 0.7,
			recommendations: parsed.recommendations || []
		};
	} catch (error) {
		// Fallback: coba parse manual berdasarkan kata kunci
		const fallbackTransactions = [];

		// Cari pola "masukkan uang X" atau "setor X"
		const masukkanMatch = text.match(
			/(?:masukkan|setor|tambah|masuk)\s*(?:uang\s*)?(\d+(?:rb|ribu|k|000)?)/i
		);
		if (masukkanMatch) {
			let amount = parseInt(masukkanMatch[1].replace(/[^\d]/g, ''));
			if (
				masukkanMatch[1].includes('rb') ||
				masukkanMatch[1].includes('ribu') ||
				masukkanMatch[1].includes('k')
			) {
				amount *= 1000;
			}

			fallbackTransactions.push({
				type: 'pemasukan',
				amount: amount,
				description: 'Setoran ke kas',
				confidence: 0.8
			});
		}

		// Cari pola "ambil X" atau "beli X" (bukan untuk produk)
		const ambilMatch = text.match(
			/(?:ambil|bayar|keluar|belanja|jajan)\s*(?:uang\s*)?(\d+(?:rb|ribu|k|000)?)/i
		);
		if (ambilMatch) {
			let amount = parseInt(ambilMatch[1].replace(/[^\d]/g, ''));
			if (
				ambilMatch[1].includes('rb') ||
				ambilMatch[1].includes('ribu') ||
				ambilMatch[1].includes('k')
			) {
				amount *= 1000;
			}

			fallbackTransactions.push({
				type: 'pengeluaran',
				amount: amount,
				description: 'Pengeluaran',
				confidence: 0.8
			});
		}

		// Cari pola penjualan produk
		const penjualanMatch = text.match(
			/(?:customer|ada|tadi|membeli|beli|catat|catatlah).*?(\d+)\s*([a-zA-Z\s]+)/i
		);

		if (penjualanMatch) {
			const quantity = parseInt(penjualanMatch[1]);
			const productName = penjualanMatch[2].trim().toLowerCase();

			// Untuk fallback, kita tidak bisa hitung harga tanpa data produk
			// Tapi kita bisa identifikasi sebagai penjualan
			fallbackTransactions.push({
				type: 'penjualan',
				amount: 0, // Akan diisi oleh user atau sistem
				description: `Penjualan ${quantity} ${productName}`,
				confidence: 0.7
			});
		}

		return {
			transactions: fallbackTransactions,
			confidence: 0.6,
			recommendations: []
		};
	}
}

// Endpoint untuk analisis transaksi AI
export const POST: RequestHandler = async ({ request, url }) => {
	// Cek apakah ini request untuk analisis transaksi
	const action = url.searchParams.get('action');

	if (action === 'analyze') {
		return await handleTransactionAnalysis(request);
	}

	// Default: handle regular AI chat
	return await handleRegularChat(request);
};

// Handler untuk analisis transaksi
async function handleTransactionAnalysis(request: Request) {
	try {
		const { text } = await request.json();

		if (!text || typeof text !== 'string') {
			return json({ success: false, error: 'Teks transaksi diperlukan' }, { status: 400 });
		}

		// Get API key from environment
		const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

		if (!apiKey) {
			return json(
				{
					success: false,
					error: 'API key OpenRouter tidak dikonfigurasi'
				},
				{ status: 500 }
			);
		}

		// Analisis transaksi menggunakan AI
		const analysis = await analyzeTransactionText(text, apiKey, request);

		return json({
			success: true,
			transactions: analysis.transactions,
			confidence: analysis.confidence,
			recommendations: analysis.recommendations
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: 'Terjadi kesalahan saat menganalisis transaksi'
			},
			{ status: 500 }
		);
	}
}

// Handler untuk regular AI chat
async function handleRegularChat(request: Request) {
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

		// AI 1: Identifikasi kebutuhan data
		const dataRequirements = await identifyDataRequirements(question, apiKey);

		// Ambil data langsung dari database sesuai branch & range yang diidentifikasi AI 1
		const supabase = getSupabaseClient((branch || 'dev') as any);

		// Hitung waktu WITA dari rentang yang diidentifikasi AI 1
		// STANDAR: Gunakan WITA untuk query database
		const { startWita, endWita } = witaRangeToWitaQuery(
			dataRequirements.periode.start,
			dataRequirements.periode.end
		);
		const startDate = startWita;
		const endDate = endWita;

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
				start: dataRequirements.periode.start,
				end: dataRequirements.periode.end,
				startFormatted: formatDateForAI(dataRequirements.periode.start),
				endFormatted: formatDateForAI(dataRequirements.periode.end),
				type: dataRequirements.periode.type
			},
			dataRequirements: {
				jenisData: dataRequirements.jenisData,
				prioritas: dataRequirements.prioritas,
				scope: dataRequirements.scope
			}
		};

		// Function untuk fetch data dengan pagination dan timeout handling
		async function fetchAllData(table: string, filters: any) {
			let allData: any[] = [];
			let page = 0;
			const pageSize = 500; // Reduce page size untuk menghindari timeout
			let hasMore = true;
			const maxPages = 20; // Limit maksimal halaman untuk menghindari infinite loop

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

					const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any;

					if (error) {
						if (error.code === '57014' || error.message?.includes('timeout')) {
							break;
						}
						break;
					}

					if (data && data.length > 0) {
						allData = [...allData, ...data];

						// Jika data kurang dari pageSize, berarti sudah habis
						if (data.length < pageSize) {
							hasMore = false;
						} else {
							page++;
						}
					} else {
						hasMore = false;
					}
				} catch (timeoutError) {
					break;
				}
			}
			return allData;
		}

		// Ambil data untuk periode yang diminta dengan pagination
		const [bukuKasPos, bukuKasManual] = await Promise.all([
			fetchAllData('buku_kas', { sumber: 'pos' }),
			fetchAllData('buku_kas', { excludeSumber: 'pos' })
		]);

		// Ambil data transaksi_kasir dengan relasi produk untuk data POS
		let transaksiKasirData: any[] = [];
		if (bukuKasPos && bukuKasPos.length > 0) {
			// Ambil buku_kas_id dari data POS
			const bukuKasIds = bukuKasPos.map((item: any) => item.id).filter(Boolean);

			if (bukuKasIds.length > 0) {
				try {
					const { data: transaksiKasir, error: errorTransaksiKasir } = await supabase
						.from('transaksi_kasir')
						.select('*, produk(name)')
						.in('buku_kas_id', bukuKasIds);

					if (!errorTransaksiKasir) {
						transaksiKasirData = transaksiKasir || [];
					}
				} catch (error) {
					// Silent error handling
				}
			}
		}

		// Handle case when no data found
		if (
			(!bukuKasPos || bukuKasPos.length === 0) &&
			(!bukuKasManual || bukuKasManual.length === 0)
		) {
			return new Response(
				JSON.stringify({
					success: false,
					error: 'Tidak ada data ditemukan untuk periode yang diminta',
					dateRange: `${dataRequirements.periode.start} hingga ${dataRequirements.periode.end}`,
					dataRequirements: {
						jenisData: dataRequirements.jenisData,
						prioritas: dataRequirements.prioritas,
						scope: dataRequirements.scope
					},
					suggestion:
						'Coba gunakan periode yang lebih pendek atau periksa apakah ada data transaksi dalam rentang waktu tersebut'
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
				nominal: item.amount || 0 // Map amount ke nominal seperti DataService
			});
		});

		// 2. Tambahkan data manual/catat
		(bukuKasManual || []).forEach((item: any) => {
			laporan.push({
				...item,
				sumber: item.sumber || 'catat',
				nominal: item.amount || 0 // Map amount ke nominal seperti DataService
			});
		});

		// Hitung data periode yang diminta
		const pemasukan = laporan.filter((t: any) => t.tipe === 'in');
		const pengeluaran = laporan.filter((t: any) => t.tipe === 'out');

		const totalPemasukan = pemasukan.reduce((s: number, t: any) => s + (t.nominal || 0), 0);
		const totalPengeluaran = pengeluaran.reduce((s: number, t: any) => s + (t.nominal || 0), 0);
		const labaKotor = totalPemasukan - totalPengeluaran;
		const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;
		const labaBersih = labaKotor - pajak;

		// Hitung data per bulan untuk periode yang diminta (untuk analisis detail)
		const requestedMonthlyData: Record<
			string,
			{
				pemasukan: number;
				pengeluaran: number;
				laba: number;
				transaksi: number;
				produkTerlaris: Record<string, { qty: number; revenue: number; name: string }>;
				paymentMethods: Record<string, { jumlah: number; nominal: number }>;
			}
		> = {};

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
			requestedMonthlyData[monthKey].laba =
				requestedMonthlyData[monthKey].pemasukan - requestedMonthlyData[monthKey].pengeluaran;

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
				const productName =
					(item as any)?.produk?.name || (item as any)?.custom_name || `Produk ${pid.slice(0, 8)}`;

				if (!requestedMonthlyData[monthKey].produkTerlaris[pid]) {
					requestedMonthlyData[monthKey].produkTerlaris[pid] = {
						qty: 0,
						revenue: 0,
						name: productName
					};
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
					.map(([pid, prod]) => ({
						id: pid,
						nama: prod.name,
						totalTerjual: prod.qty,
						totalPendapatan: prod.revenue
					}))
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
		Object.keys(dailyTrend).forEach((date) => {
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
		const avgTransactionsPerDay =
			totalDays > 0 ? dailyPerformance.reduce((sum, day) => sum + day.count, 0) / totalDays : 0;
		const avgRevenuePerDay =
			totalDays > 0 ? dailyPerformance.reduce((sum, day) => sum + day.revenue, 0) / totalDays : 0;
		const avgTicketSize =
			totalPemasukan > 0 && (bukuKasPos?.length || 0) > 0
				? totalPemasukan / (bukuKasPos?.length || 1)
				: 0;

		// Identifikasi hari terbaik dan terburuk
		const bestDay = dailyPerformance.reduce(
			(best, current) => (current.revenue > best.revenue ? current : best),
			dailyPerformance[0] || { revenue: 0 }
		);
		const worstDay = dailyPerformance.reduce(
			(worst, current) => (current.revenue < worst.revenue ? current : worst),
			dailyPerformance[0] || { revenue: 0 }
		);

		// Ambil metadata produk/kategori/tambahan berdasarkan kebutuhan data
		let products: any[] = [];
		let categories: any[] = [];
		let addons: any[] = [];

		// Fetch data berdasarkan jenis data yang diperlukan
		if (dataRequirements.jenisData.includes('produk') || dataRequirements.jenisData.length === 0) {
			const { data: productsData } = await supabase
				.from('produk')
				.select('id, name, price, category_id')
				.limit(1000);
			products = productsData || [];
		}

		if (
			dataRequirements.jenisData.includes('kategori') ||
			dataRequirements.jenisData.length === 0
		) {
			const { data: categoriesData } = await supabase
				.from('kategori')
				.select('id, name')
				.limit(1000);
			categories = categoriesData || [];
		}

		if (
			dataRequirements.jenisData.includes('tambahan') ||
			dataRequirements.jenisData.length === 0
		) {
			const { data: addonsData } = await supabase
				.from('tambahan')
				.select('id, name, price')
				.limit(1000);
			addons = addonsData || [];
		}

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

		// Cari produk spesifik jika user bertanya tentang harga
		let specificProduct = null;
		if (
			dataRequirements.prioritas === 'product_analysis' &&
			question.toLowerCase().includes('harga')
		) {
			// Cari produk yang disebutkan dalam pertanyaan
			const productKeywords = [
				'alpukat',
				'mangga',
				'jeruk',
				'apel',
				'pisang',
				'semangka',
				'melon',
				'pepaya',
				'naga',
				'strawberry'
			];
			const foundKeyword = productKeywords.find((keyword) =>
				question.toLowerCase().includes(keyword)
			);

			if (foundKeyword) {
				specificProduct = products.find((p) => p.name.toLowerCase().includes(foundKeyword));
			}
		}

		// Sederhanakan konteks server
		const serverReportData = {
			summary,
			startDate: dataRequirements.periode.start,
			endDate: dataRequirements.periode.end,
			tipe: dataRequirements.periode.type,
			pembayaran: paymentBreakdown,
			jamRamai,
			products: (products || []).map((p: any) => ({ id: p.id, name: p.name, price: p.price })),
			categories: (categories || []).map((c: any) => ({ id: c.id, name: c.name })),
			addons: (addons || []).map((a: any) => ({ id: a.id, name: a.name, price: a.price })),
			produkTerlaris,
			specificProduct, // Produk spesifik yang dicari
			// Data analisis mendalam
			dailyPerformance,
			analytics: {
				avgTransactionsPerDay: Math.round(avgTransactionsPerDay * 100) / 100,
				avgRevenuePerDay: Math.round(avgRevenuePerDay),
				avgTicketSize: Math.round(avgTicketSize),
				totalDays,
				bestDay:
					bestDay.revenue > 0
						? {
								date: bestDay.formattedDate,
								revenue: bestDay.revenue,
								transactions: bestDay.count,
								avgTicket: Math.round(bestDay.avgTicket)
							}
						: null,
				worstDay:
					worstDay.revenue > 0
						? {
								date: worstDay.formattedDate,
								revenue: worstDay.revenue,
								transactions: worstDay.count,
								avgTicket: Math.round(worstDay.avgTicket)
							}
						: null
			},
			// Data requirements untuk konteks AI
			dataRequirements: {
				jenisData: dataRequirements.jenisData,
				prioritas: dataRequirements.prioritas,
				scope: dataRequirements.scope
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

=== KEBUTUHAN DATA YANG DIPERLUKAN ===
- Jenis Data: ${rangeContext.dataRequirements?.jenisData?.join(', ') || 'semua data'}
- Prioritas: ${rangeContext.dataRequirements?.prioritas || 'general_analysis'}
- Scope: ${rangeContext.dataRequirements?.scope || 'general_analysis'}

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
${
	(serverReportData.summary?.requestedMonthlyData || [])
		.map(
			(month: any) => `
Bulan ${month.monthName} (${month.month}):
- Pendapatan: Rp ${month.pemasukan.toLocaleString('id-ID')}
- Pengeluaran: Rp ${month.pengeluaran.toLocaleString('id-ID')}
- Laba: Rp ${month.laba.toLocaleString('id-ID')}
- Total Transaksi: ${month.transaksi}
- Metode Pembayaran: ${Object.entries(month.paymentMethods)
				.map(([method, data]: any) => {
					const methodLabels: Record<string, string> = {
						tunai: 'Tunai (Cash)',
						qris: 'QRIS (Digital Payment)',
						lainnya: 'Lainnya'
					};
					const label = methodLabels[method] || method;
					return `${label}: ${data.jumlah} trx (Rp ${data.nominal.toLocaleString('id-ID')})`;
				})
				.join(', ')}
- Top 3 Produk Terlaris: ${month.topProducts.map((p: any) => `${p.nama} (${p.totalTerjual} terjual, Rp ${p.totalPendapatan.toLocaleString('id-ID')})`).join(', ')}
`
		)
		.join('\n') || '- (tidak ada data per bulan)'
}

=== RINCIAN PEMBAYARAN ===
${
	Object.entries(serverReportData.pembayaran || {})
		.map(([k, v]: any) => {
			const methodLabels: Record<string, string> = {
				tunai: 'Tunai (Cash)',
				qris: 'QRIS (Digital Payment)',
				lainnya: 'Lainnya'
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

${
	serverReportData.specificProduct
		? `
=== PRODUK SPESIFIK YANG DICARI ===
Nama: ${serverReportData.specificProduct.name}
Harga: Rp ${serverReportData.specificProduct.price?.toLocaleString('id-ID') || 'Tidak tersedia'}
ID: ${serverReportData.specificProduct.id}
`
		: ''
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
${
	(serverReportData.dailyPerformance || [])
		.map(
			(day: any) =>
				`- ${day.formattedDate}: ${day.count} trx, Rp ${day.revenue.toLocaleString('id-ID')} (avg Rp ${Math.round(day.avgTicket).toLocaleString('id-ID')})`
		)
		.join('\n') || '- (tidak ada data harian)'
}
		`
			: 'Tidak ada data laporan tersedia.';

		// AI 2: Analisis data bisnis
		const answer = await analyzeBusinessData(question, reportContext, rangeContext, apiKey);

		return json({
			success: true,
			answer: answer.trim(),
			dateRange: {
				start: dataRequirements.periode.start,
				end: dataRequirements.periode.end,
				reasoning: dataRequirements.reasoning
			},
			dataRequirements: {
				jenisData: dataRequirements.jenisData,
				prioritas: dataRequirements.prioritas,
				scope: dataRequirements.scope
			}
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: 'Terjadi kesalahan saat memproses pertanyaan. Silakan coba lagi.'
			},
			{ status: 500 }
		);
	}
}
