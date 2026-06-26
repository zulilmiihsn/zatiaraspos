import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { witaRangeToWitaQuery } from '$lib/utils/dateTime';
import { formatRupiah } from '$lib/utils/currency';
import { productAnalysisService } from '$lib/services/productAnalysisService';
import { getDrizzleDb, normalizeBranch } from '$lib/server/branchResolver';
import { kategori, produk, tambahan } from '$lib/database/schema';
import { eq } from 'drizzle-orm';
import {
	buildIdentifyDataRequirementsPrompt,
	buildAnalyzeBusinessDataPrompt,
	buildAnalyzeTransactionTextPrompt
} from './prompts';
import {
	fetchReportData,
	aggregateMonthly,
	computeAnalytics,
	buildReportContext
} from './reportData';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-chat';
const AI_WINDOW_MS = 15 * 60 * 1000;
const AI_MAX_REQUESTS = 30;
const aiRequests = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(identifier: string): boolean {
	const now = Date.now();
	const current = aiRequests.get(identifier);

	if (!current || now > current.resetAt) {
		aiRequests.set(identifier, { count: 1, resetAt: now + AI_WINDOW_MS });
		return false;
	}

	if (current.count >= AI_MAX_REQUESTS) {
		return true;
	}

	current.count += 1;
	return false;
}

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface OpenRouterOpts {
	title: string;
	maxTokens: number;
	temperature: number;
	errorLabel: string;
}

/** Panggil OpenRouter chat-completion, kembalikan konten string (caller terapkan default/parse). */
async function callOpenRouter(
	apiKey: string,
	systemMessage: ChatMessage,
	opts: OpenRouterOpts
): Promise<string> {
	const response = await fetch(OPENROUTER_API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://zatiaraspos.com',
			'X-Title': opts.title
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [systemMessage],
			max_tokens: opts.maxTokens,
			temperature: opts.temperature
		})
	});

	if (!response.ok) {
		throw new Error(`${opts.errorLabel}: ${response.status}`);
	}

	const data = await response.json();
	return data.choices?.[0]?.message?.content ?? '';
}

/** Bersihkan markdown code-fence (```json ... ```) dari output AI. */
function stripJsonFence(content: string): string {
	let clean = content.trim();
	if (clean.startsWith('```json')) {
		clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
	}
	if (clean.startsWith('```')) {
		clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
	}
	return clean;
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
		content: buildIdentifyDataRequirementsPrompt(question, todayWita)
	};

	const content =
		(await callOpenRouter(apiKey, systemMessage, {
			title: 'Zatiaras POS - Data Requirement Analyzer',
			maxTokens: 500,
			temperature: 0.3,
			errorLabel: 'AI 1 Error'
		})) || '{}';

	try {
		const cleanContent = stripJsonFence(content);

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
	reportData: string,
	dateRange: {
		start?: string;
		startFormatted?: string;
		end?: string;
		endFormatted?: string;
		type?: string;
		reasoning?: string;
		dataRequirements?: { jenisData?: string[]; prioritas?: string; scope?: string };
	},
	apiKey: string
): Promise<string> {
	const systemMessage: ChatMessage = {
		role: 'system',
		content: buildAnalyzeBusinessDataPrompt(question, reportData, dateRange)
	};

	return (
		(await callOpenRouter(apiKey, systemMessage, {
			title: 'Zatiaras POS - Business Analyst',
			maxTokens: 2000,
			temperature: 0.6,
			errorLabel: 'AI 2 Error'
		})) || 'Maaf, tidak dapat menghasilkan jawaban.'
	);
}

// AI 3: Transaction Analyzer
async function analyzeTransactionText(
	text: string,
	apiKey: string,
	request?: Request
): Promise<{
	transactions: Record<string, unknown>[];
	confidence: number;
	recommendations: Record<string, unknown>[];
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
		content: buildAnalyzeTransactionTextPrompt(text, productData)
	};

	const content =
		(await callOpenRouter(apiKey, systemMessage, {
			title: 'Zatiaras POS - Transaction Analyzer',
			maxTokens: 1000,
			temperature: 0.3,
			errorLabel: 'AI 3 Error'
		})) || '{}';

	try {
		const cleanContent = stripJsonFence(content);

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
				deskripsi: 'Setoran ke kas',
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
				deskripsi: 'Pengeluaran',
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
				deskripsi: `Penjualan ${quantity} ${productName}`,
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
export const POST: RequestHandler = async (event) => {
	const { request, url, getClientAddress } = event;
	const clientIp = getClientAddress();
	if (isRateLimited(clientIp)) {
		return json(
			{
				success: false,
				error: 'Terlalu banyak request. Coba lagi beberapa menit lagi.',
				code: 'RATE_LIMITED',
				retryAfterSeconds: Math.ceil(AI_WINDOW_MS / 1000)
			},
			{ status: 429 }
		);
	}

	// Cek apakah ini request untuk analisis transaksi
	const action = url.searchParams.get('action');

	if (action === 'analyze') {
		return await handleTransactionAnalysis(event);
	}

	// Default: handle regular AI chat
	return await handleRegularChat(event);
};

// Handler untuk analisis transaksi
async function handleTransactionAnalysis(event: import('./$types').RequestEvent) {
	const request = event.request;
	try {
		const { text } = await request.json();

		if (!text || typeof text !== 'string') {
			return json(
				{ success: false, error: 'Teks transaksi diperlukan', code: 'VALIDATION_ERROR' },
				{ status: 400 }
			);
		}

		// Get API key from environment
		const apiKey = env.OPENROUTER_API_KEY;

		if (!apiKey) {
			return json(
				{
					success: false,
					error: 'API key OpenRouter tidak dikonfigurasi',
					code: 'SERVICE_UNAVAILABLE'
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
				error: 'Terjadi kesalahan saat menganalisis transaksi',
				code: 'SERVER_ERROR'
			},
			{ status: 500 }
		);
	}
}

// Handler untuk regular AI chat
async function handleRegularChat(event: import('./$types').RequestEvent) {
	const request = event.request;
	try {
		const { question, branch } = await request.json();

		if (!question || typeof question !== 'string') {
			return json(
				{ success: false, error: 'Pertanyaan diperlukan', code: 'VALIDATION_ERROR' },
				{ status: 400 }
			);
		}

		// Get API key from environment
		const apiKey = env.OPENROUTER_API_KEY;

		if (!apiKey) {
			return json(
				{
					success: false,
					error:
						'API key OpenRouter tidak dikonfigurasi. Silakan tambahkan OPENROUTER_API_KEY di file .env',
					code: 'SERVICE_UNAVAILABLE'
				},
				{ status: 500 }
			);
		}

		if (question.length > 2000) {
			return json(
				{ success: false, error: 'Pertanyaan terlalu panjang', code: 'VALIDATION_ERROR' },
				{ status: 400 }
			);
		}

		let requestedBranch: ReturnType<typeof normalizeBranch>;
		try {
			requestedBranch = normalizeBranch(branch || 'balikpapan');
		} catch {
			return json(
				{ success: false, error: 'Branch tidak valid', code: 'INVALID_BRANCH' },
				{ status: 400 }
			);
		}

		// AI 1: Identifikasi kebutuhan data
		const dataRequirements = await identifyDataRequirements(question, apiKey);

		const db = getDrizzleDb(event.platform, requestedBranch);

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

		// Ambil data berpaginasi untuk periode yang diminta
		const { bukuKasPos, bukuKasManual, transaksiKasirData } = await fetchReportData(
			db,
			requestedBranch,
			startDate,
			endDate
		);

		// Handle case when no data found
		if (
			(!bukuKasPos || bukuKasPos.length === 0) &&
			(!bukuKasManual || bukuKasManual.length === 0)
		) {
			return new Response(
				JSON.stringify({
					success: false,
					code: 'NO_DATA',
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
		const laporan: Record<string, unknown>[] = [];

		// 1. Tambahkan data POS dari buku_kas (sumber='pos')
		(bukuKasPos || []).forEach((item: Record<string, unknown>) => {
			laporan.push({
				...item,
				sumber: 'pos',
				nominal: item.nominal || 0 // Map amount ke nominal seperti DataService
			});
		});

		// 2. Tambahkan data manual/catat
		(bukuKasManual || []).forEach((item: Record<string, unknown>) => {
			laporan.push({
				...item,
				sumber: item.sumber || 'catat',
				nominal: item.nominal || 0 // Map amount ke nominal seperti DataService
			});
		});

		// Hitung data periode yang diminta
		const pemasukan = laporan.filter((t: Record<string, unknown>) => t.tipe === 'in');
		const pengeluaran = laporan.filter((t: Record<string, unknown>) => t.tipe === 'out');

		const totalPemasukan = pemasukan.reduce(
			(s: number, t: Record<string, unknown>) => s + ((t.nominal as number) || 0),
			0
		);
		const totalPengeluaran = pengeluaran.reduce(
			(s: number, t: Record<string, unknown>) => s + ((t.nominal as number) || 0),
			0
		);
		const labaKotor = totalPemasukan - totalPengeluaran;
		const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;
		const labaBersih = labaKotor - pajak;

		// Format data per bulan untuk AI
		const formattedRequestedMonthlyData = aggregateMonthly(laporan, transaksiKasirData);

		const summary = {
			pendapatan: totalPemasukan,
			pengeluaran: totalPengeluaran,
			saldo: totalPemasukan - totalPengeluaran,
			labaKotor,
			pajak,
			labaBersih,
			totalTransaksi: new Set(
				(bukuKasPos || []).map((b: { transaction_id?: string }) => b.transaction_id).filter(Boolean)
			).size,
			// Data per bulan untuk periode yang diminta
			requestedMonthlyData: formattedRequestedMonthlyData
		};

		// Breakdown pembayaran, pola waktu, tren harian, & statistik
		const {
			paymentBreakdown,
			jamRamai,
			dailyPerformance,
			avgTransactionsPerDay,
			avgRevenuePerDay,
			avgTicketSize,
			totalDays,
			bestDay,
			worstDay
		} = computeAnalytics(laporan, bukuKasPos, totalPemasukan);

		// Ambil metadata produk/kategori/tambahan berdasarkan kebutuhan data
		let products: { id: string; nama: string; harga: number; kategori_id?: string | null }[] = [];
		let categories: { id: string; nama: string }[] = [];
		let addons: { id: string; nama: string; harga: number }[] = [];

		// Fetch data berdasarkan jenis data yang diperlukan
		if (dataRequirements.jenisData.includes('produk') || dataRequirements.jenisData.length === 0) {
			products = await db
				.select({
					id: produk.id,
					nama: produk.nama,
					harga: produk.harga,
					kategori_id: produk.kategori_id
				})
				.from(produk)
				.where(eq(produk.cabang_id, requestedBranch))
				.limit(1000);
		}

		if (
			dataRequirements.jenisData.includes('kategori') ||
			dataRequirements.jenisData.length === 0
		) {
			categories = await db
				.select({ id: kategori.id, nama: kategori.nama })
				.from(kategori)
				.where(eq(kategori.cabang_id, requestedBranch))
				.limit(1000);
		}

		if (
			dataRequirements.jenisData.includes('tambahan') ||
			dataRequirements.jenisData.length === 0
		) {
			addons = await db
				.select({ id: tambahan.id, nama: tambahan.nama, harga: tambahan.harga })
				.from(tambahan)
				.where(eq(tambahan.cabang_id, requestedBranch))
				.limit(1000);
		}

		// Hitung produk terlaris berdasarkan transaksi_kasir yang sudah diambil
		const productIdToSale: Record<string, { jumlah: number; revenue: number; nama?: string }> = {};
		// Prototype pollution guard: reject dangerous keys
		const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
		interface TransaksiItem {
			produk_id?: string;
			jumlah?: number;
			harga?: number;
			amount?: number;
			nama_kustom?: string;
			produk?: { nama?: string };
		}
		for (const item of transaksiKasirData || []) {
			const typedItem = item as TransaksiItem;
			const pid = typedItem.produk_id;
			if (!pid || typeof pid !== 'string' || FORBIDDEN_KEYS.has(pid)) continue;
			const jumlah = Number(typedItem.jumlah || 0) || 0;
			const satuan = Number(typedItem.harga || typedItem.amount || 0) || 0;
			const revenue = satuan * (jumlah || 1);
			// Ambil nama dari relasi produk atau nama_kustom
			const productName =
				typedItem.produk?.nama || typedItem.nama_kustom || `Produk ${pid.slice(0, 8)}`;
			if (!Object.prototype.hasOwnProperty.call(productIdToSale, pid)) {
				productIdToSale[pid] = { jumlah: 0, revenue: 0, nama: productName };
			}
			productIdToSale[pid].jumlah += jumlah || 0;
			productIdToSale[pid].revenue += revenue;
			if (!productIdToSale[pid].nama) productIdToSale[pid].nama = productName;
		}
		const produkTerlaris = Object.entries(productIdToSale)
			.map(([pid, v]) => ({
				id: pid,
				nama: v.nama || pid,
				totalTerjual: v.jumlah,
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
				specificProduct = products.find((p) => p.nama.toLowerCase().includes(foundKeyword));
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
			products: (products || []).map((p: { id: string; nama: string; harga: number }) => ({
				id: p.id,
				nama: p.nama,
				harga: p.harga
			})),
			categories: (categories || []).map((c: { id: string; nama: string }) => ({
				id: c.id,
				nama: c.nama
			})),
			addons: (addons || []).map((a: { id: string; nama: string; harga: number }) => ({
				id: a.id,
				nama: a.nama,
				harga: a.harga
			})),
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
		const reportContext = buildReportContext(serverReportData, rangeContext);

		// AI 2: Analisis data bisnis
		const answer = await analyzeBusinessData(
			question,
			reportContext,
			{
				start: rangeContext.requested.start,
				startFormatted: rangeContext.requested.startFormatted,
				end: rangeContext.requested.end,
				endFormatted: rangeContext.requested.endFormatted,
				type: rangeContext.requested.type,
				dataRequirements: rangeContext.dataRequirements
			},
			apiKey
		);

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
				error: 'Terjadi kesalahan saat memproses pertanyaan. Silakan coba lagi.',
				code: 'SERVER_ERROR'
			},
			{ status: 500 }
		);
	}
}
