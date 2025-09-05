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

	// Handle specific day ranges like "5 hari pertama bulan ini"
	const firstDaysMatch = q.match(/(\d+)\s*hari\s*pertama\s*bulan\s*ini/);
	if (firstDaysMatch) {
		const days = Math.max(1, parseInt(firstDaysMatch[1], 10));
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfFirstDays = new Date(startOfMonth);
		endOfFirstDays.setDate(startOfMonth.getDate() + days - 1);
		return { start: toYMD(startOfMonth), end: toYMD(endOfFirstDays), type: 'daily' };
	}

	// Handle "5 hari terakhir bulan lalu"
	const lastDaysMatch = q.match(/(\d+)\s*hari\s*terakhir\s*bulan\s*lalu/);
	if (lastDaysMatch) {
		const days = Math.max(1, parseInt(lastDaysMatch[1], 10));
		const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
		const startOfLastDays = new Date(endOfLastMonth);
		startOfLastDays.setDate(endOfLastMonth.getDate() - days + 1);
		return { start: toYMD(startOfLastDays), end: toYMD(endOfLastMonth), type: 'daily' };
	}

	// Handle "minggu pertama bulan ini"
	if (q.includes('minggu pertama bulan ini')) {
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfFirstWeek = new Date(startOfMonth);
		endOfFirstWeek.setDate(startOfMonth.getDate() + 6);
		return { start: toYMD(startOfMonth), end: toYMD(endOfFirstWeek), type: 'weekly' };
	}

	// Handle "minggu terakhir bulan lalu"
	if (q.includes('minggu terakhir bulan lalu')) {
		const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
		const startOfLastWeek = new Date(endOfLastMonth);
		startOfLastWeek.setDate(endOfLastMonth.getDate() - 6);
		return { start: toYMD(startOfLastWeek), end: toYMD(endOfLastMonth), type: 'weekly' };
	}

	// Handle "pertengahan bulan ini"
	if (q.includes('pertengahan bulan ini')) {
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const midMonth = new Date(startOfMonth);
		midMonth.setDate(15);
		const endOfMidMonth = new Date(midMonth);
		endOfMidMonth.setDate(15);
		return { start: toYMD(midMonth), end: toYMD(endOfMidMonth), type: 'daily' };
	}

	// Handle "akhir bulan ini"
	if (q.includes('akhir bulan ini')) {
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		const startOfEndMonth = new Date(endOfMonth);
		startOfEndMonth.setDate(endOfMonth.getDate() - 6);
		return { start: toYMD(startOfEndMonth), end: toYMD(endOfMonth), type: 'daily' };
	}

	// Handle "awal bulan lalu"
	if (q.includes('awal bulan lalu')) {
		const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endOfFirstWeek = new Date(lastMonth);
		endOfFirstWeek.setDate(lastMonth.getDate() + 6);
		return { start: toYMD(lastMonth), end: toYMD(endOfFirstWeek), type: 'weekly' };
	}

	// Handle "akhir bulan lalu"
	if (q.includes('akhir bulan lalu')) {
		const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
		const startOfEndMonth = new Date(endOfLastMonth);
		startOfEndMonth.setDate(endOfLastMonth.getDate() - 6);
		return { start: toYMD(startOfEndMonth), end: toYMD(endOfLastMonth), type: 'daily' };
	}

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
		
		// Debug logging
		console.log('AI Question:', question);
		console.log('Parsed Range:', range);

		// Ambil data langsung dari database sesuai branch & range
		const supabase = getSupabaseClient((branch || 'dev') as any);

		// Hitung waktu UTC dari rentang WITA (approx: gunakan string Y-M-D 00:00:00/23:59:59 WITA yang dikonversi ke ISO)
		const startDate = new Date(`${range.start}T00:00:00+08:00`).toISOString();
		const endDate = new Date(`${range.end}T23:59:59+08:00`).toISOString();

		// Untuk analisis tren, ambil data historis yang lebih luas (6 bulan terakhir)
		const now = new Date();
		const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
		const historicalStartDate = new Date(`${toYMDWita(sixMonthsAgo)}T00:00:00+08:00`).toISOString();
		const historicalEndDate = new Date(`${toYMDWita(now)}T23:59:59+08:00`).toISOString();

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
				start: range.start,
				end: range.end,
				startFormatted: formatDateForAI(range.start),
				endFormatted: formatDateForAI(range.end),
				type: range.type
			},
			historical: {
				start: toYMDWita(sixMonthsAgo),
				end: toYMDWita(now),
				startFormatted: formatDateForAI(toYMDWita(sixMonthsAgo)),
				endFormatted: formatDateForAI(toYMDWita(now))
			}
		};

		// Ambil data untuk periode yang diminta
		const { data: bukuKasPos } = await supabase
			.from('buku_kas')
			.select('*, transaksi_kasir (*, produk(name))')
			.gte('waktu', startDate)
			.lte('waktu', endDate)
			.eq('sumber', 'pos');

		const { data: bukuKasManual } = await supabase
			.from('buku_kas')
			.select('*')
			.gte('waktu', startDate)
			.lte('waktu', endDate)
			.neq('sumber', 'pos');

		// Ambil data historis untuk perbandingan tren (6 bulan terakhir)
		const { data: historicalBukuKasPos } = await supabase
			.from('buku_kas')
			.select('*, transaksi_kasir (*, produk(name))')
			.gte('waktu', historicalStartDate)
			.lte('waktu', historicalEndDate)
			.eq('sumber', 'pos');

		const { data: historicalBukuKasManual } = await supabase
			.from('buku_kas')
			.select('*')
			.gte('waktu', historicalStartDate)
			.lte('waktu', historicalEndDate)
			.neq('sumber', 'pos');

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

		// Data historis untuk perbandingan
		const historicalLaporan = [
			...(historicalBukuKasPos || []).map((item: any) => ({
				...item,
				sumber: 'pos'
			})),
			...(historicalBukuKasManual || []).map((item: any) => ({
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

		// Hitung data historis untuk perbandingan
		const historicalPemasukan = historicalLaporan.filter((t: any) => t.tipe === 'in');
		const historicalPengeluaran = historicalLaporan.filter((t: any) => t.tipe === 'out');
		const historicalTotalPemasukan = historicalPemasukan.reduce(
			(s: number, t: any) => s + (t.amount || t.nominal || 0),
			0
		);
		const historicalTotalPengeluaran = historicalPengeluaran.reduce(
			(s: number, t: any) => s + (t.amount || t.nominal || 0),
			0
		);
		const historicalLabaKotor = historicalTotalPemasukan - historicalTotalPengeluaran;
		const historicalPajak = historicalLabaKotor > 0 ? Math.round(historicalLabaKotor * 0.005) : 0;
		const historicalLabaBersih = historicalLabaKotor - historicalPajak;

		// Hitung tren bulanan untuk perbandingan
		const monthlyData: Record<string, { pemasukan: number; pengeluaran: number; laba: number; transaksi: number }> = {};
		
		// Proses data historis per bulan
		for (const item of historicalLaporan) {
			const date = new Date(item.waktu);
			const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			
			if (!monthlyData[monthKey]) {
				monthlyData[monthKey] = { pemasukan: 0, pengeluaran: 0, laba: 0, transaksi: 0 };
			}
			
			const amount = item.amount || item.nominal || 0;
			if (item.tipe === 'in') {
				monthlyData[monthKey].pemasukan += amount;
			} else {
				monthlyData[monthKey].pengeluaran += amount;
			}
			monthlyData[monthKey].laba = monthlyData[monthKey].pemasukan - monthlyData[monthKey].pengeluaran;
			
			if (item.sumber === 'pos' && item.transaction_id) {
				monthlyData[monthKey].transaksi += 1;
			}
		}

		// Urutkan data bulanan
		const sortedMonthlyData = Object.entries(monthlyData)
			.sort(([a], [b]) => a.localeCompare(b))
			.slice(-6); // Ambil 6 bulan terakhir

		// Hitung tren (perbandingan bulan ini vs bulan lalu)
		const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
		const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
		
		const currentMonthData = monthlyData[currentMonth] || { pemasukan: 0, pengeluaran: 0, laba: 0, transaksi: 0 };
		const lastMonthData = monthlyData[lastMonth] || { pemasukan: 0, pengeluaran: 0, laba: 0, transaksi: 0 };
		
		const trenPemasukan = lastMonthData.pemasukan > 0 
			? ((currentMonthData.pemasukan - lastMonthData.pemasukan) / lastMonthData.pemasukan * 100)
			: 0;
		const trenPengeluaran = lastMonthData.pengeluaran > 0 
			? ((currentMonthData.pengeluaran - lastMonthData.pengeluaran) / lastMonthData.pengeluaran * 100)
			: 0;
		const trenLaba = lastMonthData.laba > 0 
			? ((currentMonthData.laba - lastMonthData.laba) / lastMonthData.laba * 100)
			: 0;

		const summary = {
			pendapatan: totalPemasukan,
			pengeluaran: totalPengeluaran,
			saldo: totalPemasukan - totalPengeluaran,
			labaKotor,
			pajak,
			labaBersih,
			totalTransaksi: new Set((bukuKasPos || []).map((b: any) => b.transaction_id).filter(Boolean))
				.size,
			// Data historis untuk perbandingan
			historicalPendapatan: historicalTotalPemasukan,
			historicalPengeluaran: historicalTotalPengeluaran,
			historicalLabaBersih: historicalLabaBersih,
			// Tren bulanan
			monthlyData: sortedMonthlyData,
			trenPemasukan,
			trenPengeluaran,
			trenLaba,
			currentMonthData,
			lastMonthData
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
=== KONTEKS RENTANG WAKTU ===
PERIODE YANG DIMINTA USER:
- Rentang: ${rangeContext.requested.startFormatted} s.d. ${rangeContext.requested.endFormatted}
- Format: ${rangeContext.requested.start} s.d. ${rangeContext.requested.end}
- Tipe: ${rangeContext.requested.type}

DATA HISTORIS UNTUK PERBANDINGAN:
- Rentang: ${rangeContext.historical.startFormatted} s.d. ${rangeContext.historical.endFormatted}
- Format: ${rangeContext.historical.start} s.d. ${rangeContext.historical.end}

=== DATA LAPORAN PERIODE YANG DIMINTA (SUDAH DIFETCH SESUAI KONTEKS) ===
Rentang Waktu: ${serverReportData.startDate} s.d. ${serverReportData.endDate}
- Pendapatan: Rp ${serverReportData.summary?.pendapatan?.toLocaleString('id-ID') || '0'}
- Pengeluaran: Rp ${serverReportData.summary?.pengeluaran?.toLocaleString('id-ID') || '0'}
- Laba Kotor: Rp ${serverReportData.summary?.labaKotor?.toLocaleString('id-ID') || '0'}
- Pajak: Rp ${serverReportData.summary?.pajak?.toLocaleString('id-ID') || '0'}
- Laba Bersih: Rp ${serverReportData.summary?.labaBersih?.toLocaleString('id-ID') || '0'}
- Total Transaksi: ${serverReportData.summary?.totalTransaksi || '0'}

PENTING: Data di atas sudah sesuai dengan periode yang diminta user. Jika user bertanya "5 hari pertama bulan ini", maka data di atas adalah data untuk 5 hari pertama bulan ini, bukan data bulan penuh.

=== DATA HISTORIS UNTUK PERBANDINGAN (6 BULAN TERAKHIR) ===
- Total Pendapatan 6 Bulan: Rp ${serverReportData.summary?.historicalPendapatan?.toLocaleString('id-ID') || '0'}
- Total Pengeluaran 6 Bulan: Rp ${serverReportData.summary?.historicalPengeluaran?.toLocaleString('id-ID') || '0'}
- Total Laba Bersih 6 Bulan: Rp ${serverReportData.summary?.historicalLabaBersih?.toLocaleString('id-ID') || '0'}

=== TREN BULANAN (6 BULAN TERAKHIR) ===
${(serverReportData.summary?.monthlyData || []).map(([month, data]: any) => 
	`- ${month}: Pendapatan Rp ${data.pemasukan.toLocaleString('id-ID')}, Pengeluaran Rp ${data.pengeluaran.toLocaleString('id-ID')}, Laba Rp ${data.laba.toLocaleString('id-ID')}, Transaksi ${data.transaksi}`
).join('\n') || '- (tidak ada data historis)'}

=== PERBANDINGAN BULAN INI VS BULAN LALU ===
Bulan Ini (${serverReportData.summary?.currentMonthData ? Object.keys(serverReportData.summary.currentMonthData).length > 0 ? 'Data tersedia' : 'Tidak ada data' : 'Tidak ada data'}):
- Pendapatan: Rp ${serverReportData.summary?.currentMonthData?.pemasukan?.toLocaleString('id-ID') || '0'}
- Pengeluaran: Rp ${serverReportData.summary?.currentMonthData?.pengeluaran?.toLocaleString('id-ID') || '0'}
- Laba: Rp ${serverReportData.summary?.currentMonthData?.laba?.toLocaleString('id-ID') || '0'}

Bulan Lalu (${serverReportData.summary?.lastMonthData ? Object.keys(serverReportData.summary.lastMonthData).length > 0 ? 'Data tersedia' : 'Tidak ada data' : 'Tidak ada data'}):
- Pendapatan: Rp ${serverReportData.summary?.lastMonthData?.pemasukan?.toLocaleString('id-ID') || '0'}
- Pengeluaran: Rp ${serverReportData.summary?.lastMonthData?.pengeluaran?.toLocaleString('id-ID') || '0'}
- Laba: Rp ${serverReportData.summary?.lastMonthData?.laba?.toLocaleString('id-ID') || '0'}

Tren Perubahan:
- Tren Pendapatan: ${serverReportData.summary?.trenPemasukan ? (serverReportData.summary.trenPemasukan > 0 ? '+' : '') + serverReportData.summary.trenPemasukan.toFixed(1) + '%' : 'Tidak dapat dihitung'}
- Tren Pengeluaran: ${serverReportData.summary?.trenPengeluaran ? (serverReportData.summary.trenPengeluaran > 0 ? '+' : '') + serverReportData.summary.trenPengeluaran.toFixed(1) + '%' : 'Tidak dapat dihitung'}
- Tren Laba: ${serverReportData.summary?.trenLaba ? (serverReportData.summary.trenLaba > 0 ? '+' : '') + serverReportData.summary.trenLaba.toFixed(1) + '%' : 'Tidak dapat dihitung'}

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

		// Prepare system message (persona pakar ekonomi/bisnis)
		const systemMessage: ChatMessage = {
			role: 'system',
			content: `Anda adalah Asisten AI yang berperan sebagai pakar ekonomi dan bisnis untuk aplikasi POS Zatiaras Juice.
Zatiaras Juice adalah brand jus buah segar yang menjual berbagai varian minuman jus, smoothie, dan minuman sehat lainnya.

KONTEKS DATA LENGKAP:
${reportContext}

ATURAN ANALISIS:
1) Jawab SELALU dalam Bahasa Indonesia yang profesional namun ramah.
2) Berikan jawaban LENGKAP dan DETAIL sesuai data, jangan disingkat, kecuali diminta singkat.
3) WAJIB analisis tren dan perbandingan periode - gunakan data historis yang tersedia.
4) Sertakan angka, persentase, tren, perbandingan periode dalam setiap analisis.
5) Jelaskan "mengapa" dan "bagaimana" (reasoning bisnis) untuk setiap insight penting.
6) Jika diminta perbandingan (bulan lalu vs bulan ini, 3 bulan terakhir, dll), WAJIB gunakan data tren yang tersedia.
7) Jika data terbatas/tidak ada, nyatakan keterbatasannya dan sebutkan data tambahan yang diperlukan.
8) Hindari klaim tanpa dukungan data pada konteks yang diberikan.

PENTING - KONTEKS TANGGAL:
- Data yang Anda terima sudah difilter berdasarkan rentang waktu yang diminta user
- Jika user bertanya "5 hari pertama bulan ini", data yang diberikan sudah mencakup 5 hari pertama bulan ini
- Jika user bertanya "3 bulan terakhir", data yang diberikan sudah mencakup 3 bulan terakhir
- Jika user bertanya "bulan lalu", data yang diberikan sudah mencakup bulan lalu
- JANGAN katakan "tidak ada data" jika data tersedia untuk periode yang diminta
- Gunakan konteks tanggal yang jelas dalam jawaban Anda
- Selalu sebutkan rentang tanggal yang dianalisis
- Data di bagian "DATA LAPORAN PERIODE YANG DIMINTA" sudah sesuai dengan konteks pertanyaan user

KEMAMPUAN ANALISIS TREN:
- Anda memiliki akses ke data 6 bulan terakhir untuk analisis tren
- Anda dapat membandingkan bulan ini vs bulan lalu
- Anda dapat menganalisis tren 3 bulan terakhir, 6 bulan terakhir
- Anda dapat menghitung persentase perubahan dan tren pertumbuhan
- Anda dapat mengidentifikasi pola musiman dan fluktuasi

FORMAT JAWABAN (jika memungkinkan):
- Ringkasan Utama (1-2 kalimat dengan konteks tanggal)
- Analisis Tren & Perbandingan (dengan angka dan persentase)
- Insight Kunci (bullet points dengan data pendukung)
- Rekomendasi Tindakan (langkah konkret berdasarkan tren)
- Risiko/Perhatian (berdasarkan analisis historis)
- Langkah Berikutnya (data tambahan yang diperlukan)

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
