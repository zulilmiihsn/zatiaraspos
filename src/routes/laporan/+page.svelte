<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { refreshBus } from '$lib/utils/refreshBus';

	import { formatDateYmdWita, getTodayWita, getNowWita } from '$lib/utils/dateTime';

	import { userRole, userProfile, setUserRole } from '$lib/stores/userRole.svelte';
	import { memoize } from '$lib/utils/performance';
	import { dataService, realtimeManager } from '$lib/services/dataService';
	import { reportCacheMetrics } from '$lib/utils/cacheMetrics';
	import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { createSwipeNavigation } from '$lib/utils/touchNavigation';
	import LaporanFilter from '$lib/components/laporan/LaporanFilter.svelte';
	import LaporanSummaryCards from '$lib/components/laporan/LaporanSummaryCards.svelte';
	import LaporanLabaRugiCard from '$lib/components/laporan/LaporanLabaRugiCard.svelte';
	import LaporanAccordions from '$lib/components/laporan/LaporanAccordions.svelte';
	import LaporanAISection from '$lib/components/laporan/LaporanAISection.svelte';
	import type { BukuKasRecord, LaporanSummary } from '$lib/types/laporan';
	import { createToastManager } from '$lib/utils/ui';
	import { ErrorHandler } from '$lib/utils/errorHandling';

	const swipeNav = createSwipeNavigation(3); // 3 = Laporan

	// Lazy load icons — using `any` is acceptable here since Lucide icon types
	// are complex and vary by version; they're only used in template rendering.

	let FilterIcon: any = $state(null);

	// Subscribe ke store

	let isInitialLoad = true; // Add flag to prevent double fetching
	let laporanRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	let laporanRefreshInFlight = false;
	let lastLaporanRefreshAt = 0;
	let lastAppliedReportFingerprint = '';

	function computeReportFingerprint(reportData: {
		summary?: LaporanSummary;
		transactions?: BukuKasRecord[];
	}): string {
		const summaryData: LaporanSummary = reportData?.summary || {
			pendapatan: null,
			pengeluaran: null,
			saldo: null,
			labaKotor: null,
			pajak: null,
			labaBersih: null
		};
		const transactions = reportData?.transactions || [];
		const txLength = Array.isArray(transactions) ? transactions.length : 0;

		let totalNominal = 0;
		let latestTs = '';
		let paymentSignature = '';
		let detailSignature = '';

		for (const tx of transactions) {
			totalNominal += Number(tx?.nominal ?? 0) || 0;
			const ts = String(tx?.waktu || tx?.created_at || '');
			if (ts > latestTs) latestTs = ts;
			paymentSignature += `|${tx?.id || ''}:${tx?.metode_bayar || ''}`;
			detailSignature += `|${tx?.id || ''}:${tx?.tipe || ''}:${tx?.jenis || ''}:${tx?.deskripsi || ''}`;
		}

		return [
			Number(summaryData?.pendapatan || 0),
			Number(summaryData?.pengeluaran || 0),
			Number(summaryData?.saldo || 0),
			Number(summaryData?.labaKotor || 0),
			Number(summaryData?.pajak || 0),
			Number(summaryData?.labaBersih || 0),
			txLength,
			totalNominal,
			latestTs,
			paymentSignature,
			detailSignature
		].join('|');
	}

	let currentUserRole = $derived(userRole.value || '');
	let userProfileData = $derived(userProfile.value as { role: string; username: string } | null);

	async function scheduleLaporanRefresh(delayMs = 220, force = false) {
		if (!force && Date.now() - lastLaporanRefreshAt < 400) {
			return;
		}

		if (laporanRefreshTimer) {
			clearTimeout(laporanRefreshTimer);
		}

		laporanRefreshTimer = setTimeout(async () => {
			laporanRefreshTimer = null;
			if (laporanRefreshInFlight) return;

			laporanRefreshInFlight = true;
			try {
				await loadLaporanData({ silent: true });
				lastLaporanRefreshAt = Date.now();
			} finally {
				laporanRefreshInFlight = false;
			}
		}, delayMs);
	}

	// Tambahkan deklarasi function loadLaporanData
	async function loadLaporanData(options: { silent?: boolean } = {}) {
		const silent = options.silent === true;
		try {
			if (!silent) {
				// LOADING STATE: Mulai loading
				isLoadingReport = true;
				loadingProgress = 0;
				loadingMessage = 'Memuat data...';
			}

			// Pastikan startDate dan endDate sudah ada
			if (!startDate || !endDate) {
				startDate = startDate || getLocalDateStringWITA();
				endDate = endDate || startDate;
			}

			if (!silent) {
				// LOADING PROGRESS: 20% - Prepare data
				loadingProgress = 20;
				loadingMessage = 'Menyiapkan...';
			}
			// Tidak perlu clear cache untuk setiap load

			// Gunakan startDate saja untuk daily report, atau range untuk multi-day
			const dateRange = startDate === endDate ? startDate : `${startDate}_${endDate}`;

			if (!silent) {
				// LOADING PROGRESS: 40% - Fetch data
				loadingProgress = 40;
				loadingMessage = 'Mengambil data...';
			}
			const reportData = await dataService.getReportData(dateRange, 'daily');

			if (!silent) {
				// LOADING PROGRESS: 70% - Process data
				loadingProgress = 70;
				loadingMessage = 'Memproses...';
			}

			// Apply report data with null checks - data ada di reportData.data
			const reportDataContent = (reportData as any)?.data || reportData;
			const nextFingerprint = computeReportFingerprint(reportDataContent);

			if (nextFingerprint === lastAppliedReportFingerprint) {
				await reportCacheMetrics('laporan');
				if (!silent) {
					loadingProgress = 100;
					loadingMessage = 'Selesai!';
				}
				return;
			}

			lastAppliedReportFingerprint = nextFingerprint;
			summary = reportDataContent?.summary || {
				pendapatan: 0,
				pengeluaran: 0,
				saldo: 0,
				labaKotor: 0,
				pajak: 0,
				labaBersih: 0
			};
			pemasukanUsaha = reportDataContent?.pemasukanUsaha || [];
			pemasukanLain = reportDataContent?.pemasukanLain || [];
			bebanUsaha = reportDataContent?.bebanUsaha || [];
			bebanLain = reportDataContent?.bebanLain || [];
			laporan = reportDataContent?.transactions || [];
			await reportCacheMetrics('laporan');

			if (!silent) {
				// LOADING PROGRESS: 100% - Complete
				loadingProgress = 100;
				loadingMessage = 'Selesai!';
			}
		} catch (error) {
			ErrorHandler.logError(error, 'loadLaporanData');
			if (!silent) {
				toastManager.showToastNotification('Gagal memuat data laporan', 'error');
			}
		} finally {
			if (!silent) {
				// LOADING STATE: Selesai loading
				setTimeout(() => {
					isLoadingReport = false;
					loadingProgress = 0;
					loadingMessage = 'Memuat data...';
				}, 300); // Delay lebih pendek untuk smooth transition
			}
		}
	}

	// Tambahkan deklarasi function setupRealtimeSubscriptions
	function setupRealtimeSubscriptions() {
		// Unsubscribe existing subscriptions first
		realtimeManager.unsubscribeAll();

		// Subscribe to buku_kas changes
		realtimeManager.subscribe('buku_kas', async (payload) => {
			await scheduleLaporanRefresh(220);
		});

		// Subscribe to transaksi_kasir changes
		realtimeManager.subscribe('transaksi_kasir', async (payload) => {
			await scheduleLaporanRefresh(220);
		});
	}

	// Tambahkan function untuk fetch data saat masuk halaman
	async function initializePageData() {
		// Set default date range jika belum ada
		if (!startDate) {
			startDate = getLocalDateStringWITA();
		}
		if (!endDate) {
			endDate = startDate;
		}

		// Load initial data (tidak perlu clear cache untuk initial load)
		await loadLaporanData();

		// Setup realtime subscriptions
		setupRealtimeSubscriptions();
	}

	onMount(() => {
		// Preload ikon Laporan untuk percepat render ikon header dan ringkasan
		import('$lib/utils/iconLoader').then(({ loadRouteIcons }) => {
			loadRouteIcons('laporan');
		});
		import('lucide-svelte/icons/filter').then((icon) => {
			FilterIcon = icon.default;
		});

		// Set default values untuk filter - gunakan WITA langsung
		filterDate = getTodayWita();
		// filterMonth dan filterYear sudah diinisialisasi di deklarasi awal, tidak perlu diinisialisasi ulang

		// Set default startDate dan endDate untuk filter harian
		startDate = getLocalDateStringWITA();
		endDate = startDate;

		// Removed fetchPin() and halaman_terkunci check
		initializePageData().then(() => {
			// Jika role belum ada di store, validasi dari session backend.
			if (!currentUserRole) {
				fetch('/api/session')
					.then((res) => (res.ok ? res.json() : null))
					.then((session) => {
						if (session?.user) setUserRole(session.user.role, session.user);
					});
			}
		});

		// Tambahkan event listener untuk visibility change (saat kembali ke tab)
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				void scheduleLaporanRefresh(100, true);
			}
		};

		// Tambahkan event listener untuk focus (saat kembali ke tab)
		const handleFocus = () => {
			void scheduleLaporanRefresh(100, true);
		};

		// Tambahkan event listener untuk navigation (saat user navigasi ke halaman ini)
		const handleNavigation = () => {
			void scheduleLaporanRefresh(100, true);
		};

		// Dengarkan event global dari Topbar ketika rekomendasi AI diterapkan
		const handleAiRecommendationsApplied = async () => {
			try {
				// Pastikan cache laporan ter-invalidate agar fetch berikutnya tidak menggunakan data lama
				await dataService.invalidateCacheOnChange('buku_kas');
			} catch {}
			await scheduleLaporanRefresh(80, true);
		};

		// Ekspor refresher global agar komponen lain bisa memicu refresh langsung
		let offLaporan: () => void;
		if (typeof window !== 'undefined') {
			offLaporan = refreshBus.on('laporan', async () => {
				try {
					await dataService.invalidateCacheOnChange('buku_kas');
				} catch {}
				await scheduleLaporanRefresh(80, true);
			});
		}

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleFocus);
		window.addEventListener('popstate', handleNavigation);
		window.addEventListener('ai-recommendations-applied', handleAiRecommendationsApplied as any);

		// Cleanup function untuk event listener
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('popstate', handleNavigation);
			window.removeEventListener(
				'ai-recommendations-applied',
				handleAiRecommendationsApplied as any
			);
			if (typeof window !== 'undefined') {
				if (offLaporan) offLaporan();
			}
		};
	});

	$effect(() => {
		let _branch = selectedBranch.value;
		if (typeof window !== 'undefined') {
			if (isInitialLoad) {
				isInitialLoad = false;
			} else {
				void scheduleLaporanRefresh(120, true);
			}
		}
	});

	onDestroy(() => {
		// Unsubscribe dari realtime
		realtimeManager.unsubscribeAll();
		if (laporanRefreshTimer) {
			clearTimeout(laporanRefreshTimer);
			laporanRefreshTimer = null;
		}

		// Unsubscribe dari branch changes

		// Clear any pending timeouts
		// Removed errorTimeout
		// if (filterChangeTimeout) clearTimeout(filterChangeTimeout);
	});

	// Removed fetchPin()

	// Touch handling variables

	let showFilter = $state(false);
	let showDatePicker = $state(false);
	let showEndDatePicker = $state(false);

	// LOADING STATES: Untuk better UX
	let isLoadingReport = $state(false);
	let loadingProgress = $state(0);
	let loadingMessage = $state('Memuat data...');
	let filterType: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' = $state('harian');

	let filterDate = $state(getLocalDateStringWITA());
	let filterMonth = $state((new Date(getNowWita()).getMonth() + 1).toString().padStart(2, '0'));
	let filterYear = $state(new Date(getNowWita()).getFullYear().toString());
	let startDate = $state(getLocalDateStringWITA());
	let endDate = $state(getLocalDateStringWITA());

	// Removed PIN Modal State (showPinModal, pin, errorTimeout, isClosing)

	// Inisialisasi summary dan list dengan default kosong
	let summary: LaporanSummary = $state({
		pendapatan: null,
		pengeluaran: null,
		saldo: null,
		labaKotor: null,
		pajak: null,
		labaBersih: null
	});
	let pemasukanUsaha: BukuKasRecord[] = [];
	let pemasukanLain: BukuKasRecord[] = [];
	let bebanUsaha: BukuKasRecord[] = [];
	let bebanLain: BukuKasRecord[] = [];
	let pengeluaran: number | null = null;
	let produkTerlaris: { nama: string; total: number }[] = [];
	let kategoriTerlaris: { nama: string; total: number }[] = [];

	let laporan: BukuKasRecord[] = $state([]);

	function normalizeReportJenis(t: BukuKasRecord): 'pendapatan_usaha' | 'beban_usaha' | 'lainnya' {
		const jenis = String(t?.jenis || '')
			.trim()
			.toLowerCase();
		if (jenis === 'pendapatan_usaha' || jenis === 'beban_usaha' || jenis === 'lainnya') {
			return jenis;
		}
		return t?.tipe === 'out' ? 'beban_usaha' : 'pendapatan_usaha';
	}

	function normalizePaymentMethod(t: BukuKasRecord): 'tunai' | 'non-tunai' {
		const method = String(t?.metode_bayar || '')
			.trim()
			.toLowerCase();
		return method === 'tunai' ? 'tunai' : 'non-tunai';
	}

	// Tambahan: Data transaksi kas terstruktur untuk accordion
	let pemasukanUsahaDetail = $derived(
		laporan.filter(
			(t: BukuKasRecord) => t.tipe === 'in' && normalizeReportJenis(t) === 'pendapatan_usaha'
		)
	);
	let pemasukanLainDetail = $derived(
		laporan.filter((t: BukuKasRecord) => t.tipe === 'in' && normalizeReportJenis(t) === 'lainnya')
	);
	let bebanUsahaDetail = $derived(
		laporan.filter(
			(t: BukuKasRecord) => t.tipe === 'out' && normalizeReportJenis(t) === 'beban_usaha'
		)
	);
	let bebanLainDetail = $derived(
		laporan.filter((t: BukuKasRecord) => t.tipe === 'out' && normalizeReportJenis(t) === 'lainnya')
	);

	let pemasukanUsahaQris = $derived(
		pemasukanUsahaDetail.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
	);
	let pemasukanUsahaTunai = $derived(
		pemasukanUsahaDetail.filter((t) => normalizePaymentMethod(t) === 'tunai')
	);
	let pemasukanLainQris = $derived(
		pemasukanLainDetail.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
	);
	let pemasukanLainTunai = $derived(
		pemasukanLainDetail.filter((t) => normalizePaymentMethod(t) === 'tunai')
	);

	let bebanUsahaQris = $derived(
		bebanUsahaDetail.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
	);
	let bebanUsahaTunai = $derived(
		bebanUsahaDetail.filter((t) => normalizePaymentMethod(t) === 'tunai')
	);
	let bebanLainQris = $derived(
		bebanLainDetail.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
	);
	let bebanLainTunai = $derived(
		bebanLainDetail.filter((t) => normalizePaymentMethod(t) === 'tunai')
	);

	// Reactive statements untuk total QRIS/Tunai
	let totalQrisAll = $derived(
		[...pemasukanUsahaDetail, ...pemasukanLainDetail, ...bebanUsahaDetail, ...bebanLainDetail]
			.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalTunaiAll = $derived(
		[...pemasukanUsahaDetail, ...pemasukanLainDetail, ...bebanUsahaDetail, ...bebanLainDetail]
			.filter((t) => normalizePaymentMethod(t) === 'tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalQrisPemasukan = $derived(
		[...pemasukanUsahaDetail, ...pemasukanLainDetail]
			.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalTunaiPemasukan = $derived(
		[...pemasukanUsahaDetail, ...pemasukanLainDetail]
			.filter((t) => normalizePaymentMethod(t) === 'tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalQrisPengeluaran = $derived(
		[...bebanUsahaDetail, ...bebanLainDetail]
			.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalTunaiPengeluaran = $derived(
		[...bebanUsahaDetail, ...bebanLainDetail]
			.filter((t) => normalizePaymentMethod(t) === 'tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	// Memoize untuk summary box
	const memoizedSummary = memoize(
		(
			pemasukanUsahaDetail: BukuKasRecord[],
			pemasukanLainDetail: BukuKasRecord[],
			bebanUsahaDetail: BukuKasRecord[],
			bebanLainDetail: BukuKasRecord[]
		) => {
			// Gunakan nominal seperti dataService, fallback ke amount jika nominal tidak ada
			const totalPemasukan = pemasukanUsahaDetail
				.concat(pemasukanLainDetail)
				.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0);
			const totalPengeluaran = bebanUsahaDetail
				.concat(bebanLainDetail)
				.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0);

			// Laba (Rugi) Kotor = Pendapatan - Pengeluaran
			const labaKotor = totalPemasukan - totalPengeluaran;

			// Pajak Penghasilan = 0,5% dari Laba Kotor, tapi 0 jika Laba Kotor < 0
			const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;

			// Laba (Rugi) Bersih = Laba Kotor - Pajak
			const labaBersih = labaKotor - pajak;

			return {
				pendapatan: totalPemasukan,
				pengeluaran: totalPengeluaran,
				saldo: totalPemasukan - totalPengeluaran,
				labaKotor,
				pajak,
				labaBersih
			};
		},
		(a: BukuKasRecord[], b: BukuKasRecord[], c: BukuKasRecord[], d: BukuKasRecord[]) =>
			`${a.length}-${b.length}-${c.length}-${d.length}`
	);

	// Fungsi untuk menghitung range tanggal berdasarkan filter type
	function calculateDateRange(type: string, date?: string, month?: string, year?: string) {
		if (!date && !month && !year) return { startDate: '', endDate: '' };

		try {
			switch (type) {
				case 'harian':
					if (date) {
						return { startDate: date, endDate: date };
					}
					break;
				case 'mingguan':
					if (date) {
						const startDate = new Date(date + 'T00:00:00');
						if (isNaN(startDate.getTime())) {
							return { startDate: '', endDate: '' };
						}
						const endDate = new Date(startDate);
						endDate.setDate(startDate.getDate() + 6);
						return {
							startDate: startDate.toISOString().split('T')[0],
							endDate: endDate.toISOString().split('T')[0]
						};
					}
					break;
				case 'bulanan':
					if (month && year) {
						const y = parseInt(year);
						const m = parseInt(month) - 1;
						if (isNaN(y) || isNaN(m) || m < 0 || m > 11) {
							return { startDate: '', endDate: '' };
						}
						const first = new Date(y, m, 1);
						const last = new Date(y, m + 1, 0);

						const formatDate = (date: Date) => {
							const year = date.getFullYear();
							const month = String(date.getMonth() + 1).padStart(2, '0');
							const day = String(date.getDate()).padStart(2, '0');
							return `${year}-${month}-${day}`;
						};

						return {
							startDate: formatDate(first),
							endDate: formatDate(last)
						};
					}
					break;
				case 'tahunan':
					if (year) {
						const y = parseInt(year);
						if (isNaN(y) || y < 1900 || y > 2100) {
							return { startDate: '', endDate: '' };
						}
						return {
							startDate: `${y}-01-01`,
							endDate: `${y}-12-31`
						};
					}
					break;
			}
		} catch (error) {
			// Silent error handling
		}
		return { startDate: '', endDate: '' };
	}

	// Helper function untuk format currency yang aman
	function formatCurrency(amount: number | null | undefined): string {
		if (amount === null || amount === undefined || isNaN(amount)) {
			return '0';
		}
		return amount.toLocaleString('id-ID');
	}

	// Fungsi untuk group dan sum item berdasarkan nama (deskripsi/catatan)
	function groupAndSumByName(items: BukuKasRecord[]): { nama: string; total: number }[] {
		const map = new Map<string, number>();
		for (const item of items) {
			const name = getDeskripsiLaporan(item);

			const prev = map.get(name) || 0;
			map.set(name, prev + (item.nominal || 0));
		}
		return Array.from(map.entries()).map(([name, total]) => ({ nama: name, total }));
	}

	// Reactive statements untuk total QRIS/Tunai per sub-group
	let totalQrisPendapatanUsaha = $derived(
		pemasukanUsahaDetail
			.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalTunaiPendapatanUsaha = $derived(
		pemasukanUsahaDetail
			.filter((t) => normalizePaymentMethod(t) === 'tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalQrisPemasukanLain = $derived(
		pemasukanLainDetail
			.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalTunaiPemasukanLain = $derived(
		pemasukanLainDetail
			.filter((t) => normalizePaymentMethod(t) === 'tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalQrisBebanUsaha = $derived(
		bebanUsahaDetail
			.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalTunaiBebanUsaha = $derived(
		bebanUsahaDetail
			.filter((t) => normalizePaymentMethod(t) === 'tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalQrisBebanLain = $derived(
		bebanLainDetail
			.filter((t) => normalizePaymentMethod(t) === 'non-tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	let totalTunaiBebanLain = $derived(
		bebanLainDetail
			.filter((t) => normalizePaymentMethod(t) === 'tunai')
			.reduce((sum: number, t: BukuKasRecord) => sum + (t.nominal || 0), 0)
	);

	function getDeskripsiLaporan(item: BukuKasRecord): string {
		return item?.deskripsi?.trim() || item?.catatan?.trim() || '-';
	}

	function getLocalDateStringWITA(): string {
		const now = new Date(getNowWita());
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatDate(dateString: string, isEndDate = false): string {
		if (!dateString) {
			return '';
		}
		// Langsung konversi ke WITA tanpa double conversion
		const date = new Date(dateString + 'T00:00:00+08:00');
		return date.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'Asia/Makassar' // Pastikan menggunakan WITA
		});
	}

	// Fungsi untuk membuka date picker
	function openDatePicker(): void {
		showDatePicker = true;
	}

	function openEndDatePicker(): void {
		showEndDatePicker = true;
	}

	// Fungsi untuk menerapkan filter
	async function applyFilter(): Promise<void> {
		// Update filter state
		showFilter = false;

		// Hitung ulang range tanggal berdasarkan filter type yang dipilih
		const range = calculateDateRange(filterType, startDate, filterMonth, filterYear);
		if (range.startDate && range.endDate) {
			startDate = range.startDate;
			endDate = range.endDate;
		}

		// Load data dengan filter baru
		await loadLaporanData();

		// Setup realtime subscriptions setelah filter berubah
		setupRealtimeSubscriptions();
	}

	// Tambahkan helper untuk normalisasi tanggal ke YYYY-MM-DD
	function toYMD(date: string | Date): string {
		if (typeof date === 'string') return date.slice(0, 10);
		return formatDateYmdWita(date);
	}

	// Toast notification state
	let showToast = false;
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'warning' | 'info' = 'success';

	function showToastNotification(
		message: string,
		type: 'success' | 'error' | 'warning' | 'info' = 'success'
	): void {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	// Toast management
	const toastManager = createToastManager();
</script>

<!-- PinModal removed -->

<!-- Toast Notification -->
{#if toastManager.showToast}
	<ToastNotification
		show={toastManager.showToast}
		message={toastManager.toastMessage}
		type={toastManager.toastType}
		duration={2000}
		position="top"
	/>
{/if}

<div
	class="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-white"
	ontouchstart={swipeNav.handleTouchStart}
	ontouchmove={swipeNav.handleTouchMove}
	ontouchend={swipeNav.handleTouchEnd}
	onclick={swipeNav.handleGlobalClick}
	onkeydown={(e) => e.key === 'Escape' && swipeNav.handleGlobalClick(e as unknown as Event)}
	role="main"
	tabindex="-1"
	aria-label="Halaman laporan keuangan"
>
	<main
		class="page-content min-h-0 w-full max-w-full flex-1 overflow-x-hidden"
		style="scrollbar-width:none;-ms-overflow-style:none;"
	>
		<!-- Konten utama halaman Laporan di sini -->
		<div
			class="mx-auto w-full max-w-md px-2 pt-4 pb-8 transition-all duration-300 md:max-w-3xl md:px-8 md:pt-8 lg:max-w-none lg:px-6 lg:pt-10"
		>
			<div class="mb-3 flex w-full items-center gap-2 px-2 md:mb-6 md:gap-4 md:px-0">
				<!-- Button Filter -->
				<div class="flex-none">
					<button
						class="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500 p-0 font-bold text-white shadow-sm transition-colors hover:bg-pink-600 active:bg-pink-700 md:h-14 md:w-14 md:text-xl"
						onclick={() => (showFilter = true)}
						aria-label="Filter laporan"
					>
						{#if FilterIcon}
							<svelte:component this={FilterIcon} class="h-5 w-5 md:h-7 md:w-7" />
						{:else}
							<div class="flex h-5 w-5 items-center justify-center md:h-7 md:w-7">
								<span
									class="block h-4 w-4 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500"
								></span>
							</div>
						{/if}
					</button>
				</div>
				<!-- Button Filter Tanggal -->
				<button
					class="h-12 min-w-[140px] flex-1 rounded-xl md:h-14 {startDate
						? 'border-pink-100 bg-white text-pink-500'
						: 'border-pink-200 bg-pink-50 text-pink-400'} flex items-center justify-center gap-2 border px-4 font-semibold shadow-sm transition-colors hover:bg-pink-50 active:bg-pink-100 md:px-6 md:text-lg"
					onclick={openDatePicker}
				>
					<svg
						class="h-5 w-5 md:h-7 md:w-7 {startDate
							? 'text-pink-300'
							: 'text-pink-200'} flex-shrink-0"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/></svg
					>
					<span class="truncate">{formatDate(startDate)}</span>
				</button>
				<button
					class="h-12 min-w-[140px] flex-1 rounded-xl md:h-14 {endDate
						? 'border-pink-100 bg-white text-pink-500'
						: 'border-pink-100 bg-pink-50 text-pink-200'} flex items-center justify-center gap-2 border px-4 font-semibold shadow-sm transition-colors hover:bg-pink-50 active:bg-pink-100 md:px-6 md:text-lg"
					onclick={openEndDatePicker}
				>
					<svg
						class="h-5 w-5 md:h-7 md:w-7 {endDate
							? 'text-pink-300'
							: 'text-pink-200'} flex-shrink-0"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/></svg
					>
					<span class="truncate select-none">{endDate ? formatDate(endDate, true) : '-'}</span>
				</button>
			</div>

			<!-- Ringkasan Keuangan ala Beranda -->
			<LaporanSummaryCards {isLoadingReport} {summary} {totalQrisAll} {totalTunaiAll} />

			<!-- Section Laporan Detail -->
			<div class="mt-4 flex flex-col gap-2 px-2 md:mt-8 md:gap-8 md:px-0 lg:flex-row lg:gap-6">
				<!-- Accordion: Pemasukan dan Pengeluaran -->
				<LaporanAccordions
					{isLoadingReport}
					{totalQrisPemasukan}
					{totalTunaiPemasukan}
					{totalQrisPengeluaran}
					{totalTunaiPengeluaran}
					{pemasukanUsahaQris}
					{pemasukanUsahaTunai}
					{pemasukanLainQris}
					{pemasukanLainTunai}
					{bebanUsahaQris}
					{bebanUsahaTunai}
					{bebanLainQris}
					{bebanLainTunai}
				/>
				<!-- Section Laba/Rugi - Desktop Layout -->
				<LaporanLabaRugiCard {isLoadingReport} {summary} />
			</div>
			<!-- AI Assistant Section -->
			<LaporanAISection />

			<LaporanFilter
				bind:showFilter
				bind:filterType
				bind:startDate
				bind:filterMonth
				bind:filterYear
				onapply={applyFilter}
			/>

			<!-- Modal Date Picker Start -->
			{#if showDatePicker}
				<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
					<div
						class="mx-auto w-full max-w-md rounded-t-2xl bg-white p-6 pb-8 shadow-lg"
						style="animation: slideUp 0.3s ease-out;"
					>
						<div class="mb-6 flex items-center justify-between">
							<h3 class="text-lg font-bold text-gray-800">Pilih Tanggal Awal</h3>
							<button
								class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
								onclick={() => (showDatePicker = false)}
								aria-label="Tutup date picker"
							>
								<svg
									class="h-5 w-5 text-gray-500"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<div class="mb-6">
							<label class="mb-2 block text-sm font-medium text-gray-700" for="date-picker-start"
								>Tanggal Awal</label
							>
							<input
								id="date-picker-start"
								type="date"
								class="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition-colors focus:border-pink-500 focus:outline-none"
								bind:value={startDate}
							/>
						</div>

						<div class="flex gap-3">
							<button
								class="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-600 transition-colors hover:bg-gray-200"
								onclick={() => (showDatePicker = false)}
							>
								Batal
							</button>
							<button
								class="flex-1 rounded-xl bg-pink-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-pink-600 active:bg-pink-700"
								onclick={() => {
									showDatePicker = false;
									applyFilter();
								}}
							>
								Pilih
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Modal Date Picker End -->
			{#if showEndDatePicker}
				<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
					<div
						class="mx-auto w-full max-w-md rounded-t-2xl bg-white p-6 pb-8 shadow-lg"
						style="animation: slideUp 0.3s ease-out;"
					>
						<div class="mb-6 flex items-center justify-between">
							<h3 class="text-lg font-bold text-gray-800">Pilih Tanggal Akhir</h3>
							<button
								class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
								onclick={() => (showEndDatePicker = false)}
								aria-label="Tutup end date picker"
							>
								<svg
									class="h-5 w-5 text-gray-500"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<div class="mb-6">
							<label class="mb-2 block text-sm font-medium text-gray-700" for="date-picker-end"
								>Tanggal Akhir</label
							>
							<input
								id="date-picker-end"
								type="date"
								class="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition-colors focus:border-pink-500 focus:outline-none"
								bind:value={endDate}
							/>
						</div>

						<div class="flex gap-3">
							<button
								class="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-600 transition-colors hover:bg-gray-200"
								onclick={() => (showEndDatePicker = false)}
							>
								Batal
							</button>
							<button
								class="flex-1 rounded-xl bg-pink-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-pink-600 active:bg-pink-700"
								onclick={() => {
									showEndDatePicker = false;
									applyFilter();
								}}
							>
								Pilih
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>

<style>
	.filter-sheet-anim {
		animation: slideUp 0.22s cubic-bezier(0.4, 1.4, 0.6, 1) 1;
	}
	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>
