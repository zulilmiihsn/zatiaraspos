<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Topbar from '$lib/components/shared/topBar.svelte';
	import { slide, fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import {
		getTodayWita,
		getNowWita,
		witaToUtcRange,
		witaRangeToUtcRange
	} from '$lib/utils/dateTime';
	import ModalSheet from '$lib/components/shared/modalSheet.svelte';
	import { userRole, userProfile, setUserRole } from '$lib/stores/userRole';
	import { memoize } from '$lib/utils/performance';
	import { dataService, realtimeManager } from '$lib/services/dataService';
	import { selectedBranch } from '$lib/stores/selectedBranch';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { createToastManager } from '$lib/utils/ui';
	import { ErrorHandler } from '$lib/utils/errorHandling';

	// Lazy load icons with proper typing
	let Wallet: any, ArrowDownCircle: any, ArrowUpCircle: any, FilterIcon: any;
	// Hapus variabel userRole yang lama
	// let userRole = '';

	// Ganti dengan subscribe ke store
	let currentUserRole = '';
	let userProfileData: any = null;
	let unsubscribeBranch: (() => void) | null = null;
	let isInitialLoad = true; // Add flag to prevent double fetching

	// AI Chat state
	let aiQuestion = '';
	let aiAnswer = '';
	let showAiModal = false;
	let isAiLoading = false;

	// Renderer Markdown sederhana agar output rapi
	function renderMarkdown(md: string): string {
		if (!md) return '';
		// Escape HTML terlebih dulu
		const escapeHtml = (s: string) =>
			s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		let text = escapeHtml(md.trim());

		// Heading markdown (###, ##, #) -> heading kecil
		text = text.replace(/^(?:\s*)###\s+(.+)$/gm, '<h4 class="text-gray-900 font-semibold">$1</h4>');
		text = text.replace(/^(?:\s*)##\s+(.+)$/gm, '<h4 class="text-gray-900 font-semibold">$1</h4>');
		text = text.replace(/^(?:\s*)#\s+(.+)$/gm, '<h4 class="text-gray-900 font-semibold">$1</h4>');

		// Bold **teks**
		text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		// Italic *teks*
		text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
		// Garis miring _teks_
		text = text.replace(/_(.*?)_/g, '<em>$1</em>');
		// Heading sederhana: **Ringkasan Utama:** sudah dibold, jadikan h4 jika berada di awal baris
		text = text.replace(
			/(^|\n)\s*<strong>([^<]+)<\/strong>\s*:?\s*(?=\n|$)/g,
			'$1<h4 class="text-gray-900 font-semibold">$2</h4>'
		);

		// List: baris yang diawali "- " menjadi <li>
		const lines = text.split(/\n/);
		let html = '';
		let inList = false;
		for (const line of lines) {
			const trimmed = line.trim();
			if (/^-\s+/.test(trimmed)) {
				if (!inList) {
					html += '<ul class="list-disc pl-5 space-y-1">';
					inList = true;
				}
				html += `<li>${trimmed.replace(/^-\s+/, '')}</li>`;
			} else if (trimmed.length === 0) {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
				html += '<br/>';
			} else {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
				html += `<p>${trimmed}</p>`;
			}
		}
		if (inList) html += '</ul>';
		return html;
	}

	userRole.subscribe((val) => (currentUserRole = val || ''));
	userProfile.subscribe((val) => (userProfileData = val));

	// AI Chat functions

	async function handleAiAsk(question: string) {
		aiQuestion = question;
		showAiModal = true;
		isAiLoading = true;
		aiAnswer = '';

		try {
			const response = await fetch('/api/aichat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					question: question,
					branch: $selectedBranch
				})
			});

			const result = await response.json();

			if (result.success) {
				aiAnswer = result.answer;
			} else {
				aiAnswer = `Error: ${result.error || 'Terjadi kesalahan saat memproses pertanyaan.'}`;
			}
		} catch (error) {
			aiAnswer =
				'Maaf, terjadi kesalahan saat menghubungi Asisten AI. Pastikan API key sudah dikonfigurasi dengan benar di file .env. Silakan coba lagi nanti.';
		} finally {
			isAiLoading = false;
		}
	}

	function handleAiClose() {
		showAiModal = false;
		aiQuestion = '';
		aiAnswer = '';
		isAiLoading = false;
	}

	// Tambahkan deklarasi function loadLaporanData
	async function loadLaporanData() {
		try {
			// LOADING STATE: Mulai loading
			isLoadingReport = true;
			loadingProgress = 0;
			loadingMessage = 'Memuat data...';

			// Pastikan startDate dan endDate sudah ada
			if (!startDate || !endDate) {
				startDate = startDate || getLocalDateStringWITA();
				endDate = endDate || startDate;
			}

			// LOADING PROGRESS: 20% - Prepare data
			loadingProgress = 20;
			loadingMessage = 'Menyiapkan...';
			// Tidak perlu clear cache untuk setiap load

			// Gunakan startDate saja untuk daily report, atau range untuk multi-day
			const dateRange = startDate === endDate ? startDate : `${startDate}_${endDate}`;

			// LOADING PROGRESS: 40% - Fetch data
			loadingProgress = 40;
			loadingMessage = 'Mengambil data...';
			const reportData = await dataService.getReportData(dateRange, 'daily');

			// LOADING PROGRESS: 70% - Process data
			loadingProgress = 70;
			loadingMessage = 'Memproses...';

			// Apply report data with null checks - data ada di reportData.data
			const reportDataContent = (reportData as any)?.data || reportData;
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

			// LOADING PROGRESS: 100% - Complete
			loadingProgress = 100;
			loadingMessage = 'Selesai!';
		} catch (error) {
			ErrorHandler.logError(error, 'loadLaporanData');
			toastManager.showToastNotification('Gagal memuat data laporan', 'error');
		} finally {
			// LOADING STATE: Selesai loading
			setTimeout(() => {
				isLoadingReport = false;
				loadingProgress = 0;
				loadingMessage = 'Memuat data...';
			}, 300); // Delay lebih pendek untuk smooth transition
		}
	}

	// Tambahkan deklarasi function setupRealtimeSubscriptions
	function setupRealtimeSubscriptions() {
		// Unsubscribe existing subscriptions first
		realtimeManager.unsubscribeAll();

		// Subscribe to buku_kas changes
		realtimeManager.subscribe('buku_kas', async (payload) => {
			// Reload data when buku_kas changes
			await loadLaporanData();
		});

		// Subscribe to transaksi_kasir changes
		realtimeManager.subscribe('transaksi_kasir', async (payload) => {
			// Reload data when transaksi_kasir changes
			await loadLaporanData();
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
		Promise.all([
			import('lucide-svelte/icons/wallet'),
			import('lucide-svelte/icons/arrow-down-circle'),
			import('lucide-svelte/icons/arrow-up-circle'),
			import('lucide-svelte/icons/filter')
		]).then((icons) => {
			Wallet = icons[0].default;
			ArrowDownCircle = icons[1].default;
			ArrowUpCircle = icons[2].default;
			FilterIcon = icons[3].default;
		});

		// Set default values untuk filter - gunakan WITA langsung
		filterDate = getTodayWita();
		// filterMonth dan filterYear sudah diinisialisasi di deklarasi awal, tidak perlu diinisialisasi ulang

		// Set default startDate dan endDate untuk filter harian
		startDate = getLocalDateStringWITA();
		endDate = startDate;

		// Removed fetchPin() and locked_pages check
		initializePageData().then(() => {
			// SMART CACHING: Preload common date ranges untuk performa yang lebih baik
			dataService.preloadCommonDateRanges().catch((error) => {
				// Silent error handling
			});

			// Jika role belum ada di store, coba validasi dengan Supabase
			if (!currentUserRole) {
				dataService.supabaseClient.auth.getSession().then(({ data: { session } }: any) => {
					if (session?.user) {
						dataService.supabaseClient
							.from('profil')
							.select('role, username')
							.eq('id', session.user.id)
							.single()
							.then(({ data: profile }: any) => {
								if (profile) {
									setUserRole(profile.role, profile);
								}
							});
					}
				});
			}
		});

		// Subscribe ke selectedBranch untuk fetch ulang data saat cabang berubah
		unsubscribeBranch = selectedBranch.subscribe(() => {
			// Skip jika ini adalah initial load
			if (isInitialLoad) {
				isInitialLoad = false;
				return;
			}
			loadLaporanData();
		});

		// Tambahkan event listener untuk visibility change (saat kembali ke tab)
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				loadLaporanData();
			}
		};

		// Tambahkan event listener untuk focus (saat kembali ke tab)
		const handleFocus = () => {
			loadLaporanData();
		};

		// Tambahkan event listener untuk navigation (saat user navigasi ke halaman ini)
		const handleNavigation = () => {
			loadLaporanData();
		};

		// Dengarkan event global dari Topbar ketika rekomendasi AI diterapkan
		const handleAiRecommendationsApplied = async () => {
			try {
				// Pastikan cache laporan ter-invalidate agar fetch berikutnya tidak menggunakan data lama
				await dataService.invalidateCacheOnChange('buku_kas');
			} catch {}
			await loadLaporanData();
		};

		// Ekspor refresher global agar komponen lain bisa memicu refresh langsung
		if (typeof window !== 'undefined') {
			(window as any).__refreshLaporan = async () => {
				try {
					await dataService.invalidateCacheOnChange('buku_kas');
				} catch {}
				await loadLaporanData();
			};
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
				delete (window as any).__refreshLaporan;
			}
		};
	});

	onDestroy(() => {
		// Unsubscribe dari realtime
		realtimeManager.unsubscribeAll();

		// Unsubscribe dari branch changes
		if (unsubscribeBranch) unsubscribeBranch();

		// Clear any pending timeouts
		// Removed errorTimeout
		// if (filterChangeTimeout) clearTimeout(filterChangeTimeout);
	});

	// Removed fetchPin()

	// Touch handling variables
	let touchStartX = 0;
	let touchStartY = 0;
	let touchEndX = 0;
	let touchEndY = 0;
	let isSwiping = false;
	let isTouchDevice = false;
	let clickBlocked = false;

	// Polling interval
	let pollingInterval;

	const navs = [
		{ label: 'Beranda', path: '/' },
		{ label: 'Kasir', path: '/pos' },
		{ label: 'Catat', path: '/catat' },
		{ label: 'Laporan', path: '/laporan' }
	];

	let showFilter = false;
	let showDatePicker = false;
	let showEndDatePicker = false;

	// LOADING STATES: Untuk better UX
	let isLoadingReport = false;
	let loadingProgress = 0;
	let loadingMessage = 'Memuat data...';
	let filterType: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' = 'harian';

	let filterDate = getLocalDateStringWITA();
	let filterMonth = (new Date(getNowWita()).getMonth() + 1).toString().padStart(2, '0');
	let filterYear = new Date(getNowWita()).getFullYear().toString();
	let startDate = getLocalDateStringWITA();
	let endDate = getLocalDateStringWITA();
	let showPemasukan = true;
	let showPendapatanUsaha = true;
	let showPemasukanLain = true;
	let showPengeluaran = true;
	let showBebanUsaha = true;
	let showBebanLain = true;

	// Removed PIN Modal State (showPinModal, pin, errorTimeout, isClosing)

	// Inisialisasi summary dan list dengan default kosong
	let summary: {
		pendapatan: number | null;
		pengeluaran: number | null;
		saldo: number | null;
		labaKotor: number | null;
		pajak: number | null;
		labaBersih: number | null;
	} = {
		pendapatan: null,
		pengeluaran: null,
		saldo: null,
		labaKotor: null,
		pajak: null,
		labaBersih: null
	};
	let pemasukanUsaha: any[] = [];
	let pemasukanLain: any[] = [];
	let bebanUsaha: any[] = [];
	let bebanLain: any[] = [];
	let pengeluaran: any = null;
	let produkTerlaris: any[] = [];
	let kategoriTerlaris: any[] = [];

	let laporan: any[] = [];

	// Tambahan: Data transaksi kas terstruktur untuk accordion
	$: pemasukanUsahaDetail = laporan.filter(
		(t: any) => t.tipe === 'in' && t.jenis === 'pendapatan_usaha'
	);
	$: pemasukanLainDetail = laporan.filter((t: any) => t.tipe === 'in' && t.jenis === 'lainnya');
	$: bebanUsahaDetail = laporan.filter((t: any) => t.tipe === 'out' && t.jenis === 'beban_usaha');
	$: bebanLainDetail = laporan.filter((t: any) => t.tipe === 'out' && t.jenis === 'lainnya');

	$: pemasukanUsahaQris = pemasukanUsahaDetail.filter((t) => t.payment_method === 'non-tunai');
	$: pemasukanUsahaTunai = pemasukanUsahaDetail.filter((t) => t.payment_method === 'tunai');
	$: pemasukanLainQris = pemasukanLainDetail.filter((t) => t.payment_method === 'non-tunai');
	$: pemasukanLainTunai = pemasukanLainDetail.filter((t) => t.payment_method === 'tunai');

	$: bebanUsahaQris = bebanUsahaDetail.filter((t) => t.payment_method === 'non-tunai');
	$: bebanUsahaTunai = bebanUsahaDetail.filter((t) => t.payment_method === 'tunai');
	$: bebanLainQris = bebanLainDetail.filter((t) => t.payment_method === 'non-tunai');
	$: bebanLainTunai = bebanLainDetail.filter((t) => t.payment_method === 'tunai');

	// Reactive statements untuk total QRIS/Tunai
	$: totalQrisAll = [
		...pemasukanUsahaDetail,
		...pemasukanLainDetail,
		...bebanUsahaDetail,
		...bebanLainDetail
	]
		.filter((t) => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalTunaiAll = [
		...pemasukanUsahaDetail,
		...pemasukanLainDetail,
		...bebanUsahaDetail,
		...bebanLainDetail
	]
		.filter((t) => t.payment_method === 'tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalQrisPemasukan = [...pemasukanUsahaDetail, ...pemasukanLainDetail]
		.filter((t) => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalTunaiPemasukan = [...pemasukanUsahaDetail, ...pemasukanLainDetail]
		.filter((t) => t.payment_method === 'tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalQrisPengeluaran = [...bebanUsahaDetail, ...bebanLainDetail]
		.filter((t) => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalTunaiPengeluaran = [...bebanUsahaDetail, ...bebanLainDetail]
		.filter((t) => t.payment_method === 'tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	// Memoize untuk summary box
	const memoizedSummary = memoize(
		(
			pemasukanUsahaDetail: any[],
			pemasukanLainDetail: any[],
			bebanUsahaDetail: any[],
			bebanLainDetail: any[]
		) => {
			// Gunakan nominal seperti dataService, fallback ke amount jika nominal tidak ada
			const totalPemasukan = pemasukanUsahaDetail
				.concat(pemasukanLainDetail)
				.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);
			const totalPengeluaran = bebanUsahaDetail
				.concat(bebanLainDetail)
				.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

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
		(a: any, b: any, c: any, d: any) => `${a.length}-${b.length}-${c.length}-${d.length}`
	);

	// HAPUS reactive statement yang konflik - gunakan summary dari dataService langsung
	// $: summary = memoizedSummary(pemasukanUsahaDetail, pemasukanLainDetail, bebanUsahaDetail, bebanLainDetail);

	// HAPUS watcher universal yang menyebabkan double fetching
	// $: if (startDate && endDate) {
	//   loadLaporanData();
	// }

	// Watcher untuk reload data saat filter berubah - DISABLED untuk mencegah double fetching
	// let filterChangeTimeout: number;
	// $: if (!showFilter && startDate && endDate && filterType) {
	// 	// Clear existing timeout
	// 	if (filterChangeTimeout) clearTimeout(filterChangeTimeout);

	// 	// Debounce untuk menghindari multiple calls
	// 	filterChangeTimeout = setTimeout(() => {
	// 		loadLaporanData();
	// 	}, 300) as any;
	// }

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
						// Validasi tanggal
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
						// Validasi bulan dan tahun
						if (isNaN(y) || isNaN(m) || m < 0 || m > 11) {
							return { startDate: '', endDate: '' };
						}
						// Gunakan timezone WITA untuk konsistensi
						const first = new Date(y, m, 1);
						const last = new Date(y, m + 1, 0);

						// Format tanggal dengan padding nol
						const formatDate = (date: Date) => {
							const year = date.getFullYear();
							const month = String(date.getMonth() + 1).padStart(2, '0');
							const day = String(date.getDate()).padStart(2, '0');
							return `${year}-${month}-${day}`;
						};

						const result = {
							startDate: formatDate(first),
							endDate: formatDate(last)
						};

						return result;
					}
					break;
				case 'tahunan':
					if (year) {
						const y = parseInt(year);
						// Validasi tahun
						if (isNaN(y) || y < 1900 || y > 2100) {
							return { startDate: '', endDate: '' };
						}
						const result = {
							startDate: `${y}-01-01`,
							endDate: `${y}-12-31`
						};
						return result;
					}
					break;
			}
		} catch (error) {
			// Silent error handling
		}
		return { startDate: '', endDate: '' };
	}

	// Watcher untuk filter harian - DISABLED untuk mencegah double fetching
	// $: if (filterType === 'harian' && startDate) {
	// 	const range = calculateDateRange('harian', startDate);
	// 	if (range.startDate && range.endDate) {
	// 		endDate = range.endDate;
	// 		// Panggil loadLaporanData setelah update range
	// 		loadLaporanData();
	// 	}
	// }

	// Watcher untuk filter mingguan - DISABLED untuk mencegah double fetching
	// $: if (filterType === 'mingguan' && startDate) {
	// 	const range = calculateDateRange('mingguan', startDate);
	// 	if (range.startDate && range.endDate) {
	// 		endDate = range.endDate;
	// 		// Panggil loadLaporanData setelah update range
	// 		loadLaporanData();
	// 	}
	// }

	// Watcher untuk filter bulanan - DISABLED untuk mencegah double fetching
	// $: if (filterType === 'bulanan' && filterMonth && filterYear) {
	// 	const range = calculateDateRange('bulanan', undefined, filterMonth, filterYear);
	// 	if (range.startDate && range.endDate) {
	// 		startDate = range.startDate;
	// 		endDate = range.endDate;
	// 		// Panggil loadLaporanData setelah update range
	// 		loadLaporanData();
	// 	}
	// }

	// Watcher untuk filter tahunan - DISABLED untuk mencegah double fetching
	// $: if (filterType === 'tahunan') {
	// 	if (filterYear) {
	// 		const range = calculateDateRange('tahunan', undefined, undefined, filterYear);
	// 		if (range.startDate && range.endDate) {
	// 			startDate = range.startDate;
	// 			endDate = range.endDate;
	// 			// Panggil loadLaporanData setelah update range
	// 			loadLaporanData();
	// 		}
	// 	}
	// }

	// Helper function untuk format currency yang aman
	function formatCurrency(amount: any): string {
		if (amount === null || amount === undefined || isNaN(amount)) {
			return '0';
		}
		return amount.toLocaleString('id-ID');
	}

	// Fungsi untuk group dan sum item berdasarkan nama (description/catatan)
	function groupAndSumByName(items: any[]): any[] {
		const map = new Map();
		for (const item of items) {
			// Gunakan nama produk yang sebenarnya tanpa flag
			const name = getDeskripsiLaporan(item);

			const prev = map.get(name) || 0;
			map.set(name, prev + (item.nominal || item.amount || 0));
		}
		// Kembalikan array of { name, total }
		return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
	}

	// Reactive statements untuk total QRIS/Tunai per sub-group
	$: totalQrisPendapatanUsaha = pemasukanUsahaDetail
		.filter((t) => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalTunaiPendapatanUsaha = pemasukanUsahaDetail
		.filter((t) => t.payment_method === 'tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalQrisPemasukanLain = pemasukanLainDetail
		.filter((t) => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalTunaiPemasukanLain = pemasukanLainDetail
		.filter((t) => t.payment_method === 'tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalQrisBebanUsaha = bebanUsahaDetail
		.filter((t) => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalTunaiBebanUsaha = bebanUsahaDetail
		.filter((t) => t.payment_method === 'tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalQrisBebanLain = bebanLainDetail
		.filter((t) => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	$: totalTunaiBebanLain = bebanLainDetail
		.filter((t) => t.payment_method === 'tunai')
		.reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

	function getDeskripsiLaporan(item: any): string {
		return item?.description?.trim() || item?.catatan?.trim() || '-';
	}

	function getLocalDateStringWITA(): string {
		const now = new Date(getNowWita());
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatDate(dateString: any, isEndDate = false): string {
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

	// State untuk item yang sedang diperpanjang (expanded)
	let expandedItems = new Set();
	function toggleExpand(name: any): void {
		if (expandedItems.has(name)) {
			expandedItems.delete(name);
		} else {
			expandedItems.add(name);
		}
		// trigger reactivity
		expandedItems = new Set(expandedItems);
	}

	// Tambahkan helper untuk normalisasi tanggal ke YYYY-MM-DD
	function toYMD(date: string | Date): string {
		if (typeof date === 'string') return date.slice(0, 10);
		return date.toISOString().slice(0, 10);
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
	role="main"
	aria-label="Halaman laporan keuangan"
>
	<main
		class="page-content min-h-0 w-full max-w-full flex-1 overflow-x-hidden"
		style="scrollbar-width:none;-ms-overflow-style:none;"
	>
		<!-- LOADING BLUR: Elegant loading dengan blur effect -->
		{#if isLoadingReport}
			<div class="pointer-events-none fixed inset-0 z-40">
				<!-- Loading indicator di tengah tanpa background overlay -->
				<div class="absolute inset-0 flex items-center justify-center">
					<div
						class="rounded-2xl border border-white/30 bg-white/95 p-6 shadow-2xl backdrop-blur-lg"
					>
						<div class="text-center">
							<!-- Elegant Spinner -->
							<div class="mb-4 flex justify-center">
								<div class="relative">
									<div
										class="h-10 w-10 animate-spin rounded-full border-3 border-pink-100 border-t-pink-500"
									></div>
									<div
										class="absolute inset-0 h-10 w-10 animate-ping rounded-full border-3 border-pink-200 opacity-20"
									></div>
								</div>
							</div>

							<!-- Progress Bar -->
							<div class="mb-3 h-1.5 w-48 rounded-full bg-gray-100">
								<div
									class="h-1.5 rounded-full bg-gradient-to-r from-pink-400 to-pink-600 transition-all duration-500 ease-out"
									style="width: {loadingProgress}%"
								></div>
							</div>

							<!-- Loading Message -->
							<p class="text-sm font-medium text-gray-700">{loadingMessage}</p>
							<p class="mt-1 text-xs text-gray-500">{loadingProgress}%</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Konten utama halaman Laporan di sini -->
		<div
			class="mx-auto w-full max-w-md px-2 pt-4 pb-8 transition-all duration-300 md:max-w-3xl md:px-8 md:pt-8 lg:max-w-none lg:px-6 lg:pt-10 {isLoadingReport
				? 'opacity-60 blur-sm'
				: 'blur-0 opacity-100'}"
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
			<div class="px-2 py-3 md:mb-8 md:rounded-2xl md:px-0 md:py-6 md:shadow">
				<div class="md:px-6">
					<div class="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-6">
						<div
							class="flex flex-col items-start rounded-xl bg-gradient-to-br from-green-100 to-green-300 p-3 shadow-sm md:items-center md:justify-center md:gap-1 md:rounded-2xl md:p-4 lg:p-3"
						>
							{#if ArrowDownCircle}
								<svelte:component
									this={ArrowDownCircle}
									class="mb-2 h-6 w-6 text-green-500 md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6"
								/>
							{:else}
								<div
									class="mb-2 flex h-6 w-6 items-center justify-center md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6"
								>
									<span
										class="block h-4 w-4 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500"
									></span>
								</div>
							{/if}
							<div
								class="text-sm font-medium text-green-900/80 md:text-center md:text-base lg:text-sm"
							>
								Pemasukan
							</div>
							<div class="text-xl font-bold text-green-900 md:text-center md:text-2xl lg:text-lg">
								{#if isLoadingReport}
									<div class="h-6 w-24 animate-pulse rounded bg-gray-200"></div>
								{:else}
									Rp {summary?.pendapatan !== null && summary?.pendapatan !== undefined
										? summary.pendapatan.toLocaleString('id-ID')
										: '--'}
								{/if}
							</div>
						</div>
						<div
							class="flex flex-col items-start rounded-xl bg-gradient-to-br from-red-100 to-red-300 p-3 shadow-sm md:items-center md:justify-center md:gap-1 md:rounded-2xl md:p-4 lg:p-3"
						>
							{#if ArrowUpCircle}
								<svelte:component
									this={ArrowUpCircle}
									class="mb-2 h-6 w-6 text-red-500 md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6"
								/>
							{:else}
								<div
									class="mb-2 flex h-6 w-6 items-center justify-center md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6"
								>
									<span
										class="block h-4 w-4 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500"
									></span>
								</div>
							{/if}
							<div
								class="text-sm font-medium text-red-900/80 md:text-center md:text-base lg:text-sm"
							>
								Pengeluaran
							</div>
							<div class="text-xl font-bold text-red-900 md:text-center md:text-2xl lg:text-lg">
								{#if isLoadingReport}
									<div class="h-6 w-24 animate-pulse rounded bg-gray-200"></div>
								{:else}
									Rp {summary?.pengeluaran !== null && summary?.pengeluaran !== undefined
										? summary.pengeluaran.toLocaleString('id-ID')
										: '--'}
								{/if}
							</div>
						</div>
						<div
							class="col-span-2 flex flex-col items-start rounded-xl bg-gradient-to-br from-cyan-100 to-pink-200 p-3 shadow-sm md:col-span-1 md:items-center md:justify-center md:gap-1 md:rounded-2xl md:p-4 lg:p-3"
						>
							{#if Wallet}
								<svelte:component
									this={Wallet}
									class="mb-2 h-6 w-6 text-cyan-900 md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6"
								/>
							{:else}
								<div
									class="mb-2 flex h-6 w-6 items-center justify-center md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6"
								>
									<span
										class="block h-4 w-4 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500"
									></span>
								</div>
							{/if}
							<div
								class="text-sm font-medium text-cyan-900/80 md:text-center md:text-base lg:text-sm"
							>
								Laba (Rugi)
							</div>
							<div class="text-xl font-bold text-cyan-900 md:text-center md:text-2xl lg:text-lg">
								{#if isLoadingReport}
									<div class="h-6 w-24 animate-pulse rounded bg-gray-200"></div>
								{:else}
									Rp {summary?.saldo !== null && summary?.saldo !== undefined
										? summary.saldo.toLocaleString('id-ID')
										: '--'}
								{/if}
							</div>
						</div>
					</div>
					<!-- Insight Total QRIS & Tunai Keseluruhan -->
					<div
						class="mt-3 flex flex-wrap gap-4 px-1 text-xs font-semibold text-gray-500 md:mt-6 md:gap-6 md:px-0 md:text-base lg:mt-4 lg:text-sm"
					>
						<span
							>Total QRIS: <span class="font-bold text-pink-500"
								>Rp {totalQrisAll.toLocaleString('id-ID')}</span
							></span
						>
						<span
							>Total Tunai: <span class="font-bold text-pink-500"
								>Rp {totalTunaiAll.toLocaleString('id-ID')}</span
							></span
						>
					</div>
				</div>
			</div>

			<!-- Section Laporan Detail -->
			<div class="mt-4 flex flex-col gap-2 px-2 md:mt-8 md:gap-8 md:px-0 lg:flex-row lg:gap-6">
				<!-- Accordion: Pemasukan -->
				<div
					class="overflow-hidden rounded-xl bg-white shadow-sm md:mb-4 md:rounded-2xl md:p-4 md:shadow lg:mb-0 lg:flex-1"
				>
					<button
						class="mb-1 flex min-h-[44px] w-full items-center justify-between rounded-xl bg-white px-4 py-2 text-base font-bold text-gray-700 md:mb-2 md:rounded-2xl md:px-6 md:py-4 md:text-lg"
						onclick={() => (showPemasukan = !showPemasukan)}
					>
						<span>Pemasukan</span>
						<svg class="ml-2 h-5 w-5 md:h-6 md:w-6" viewBox="0 0 20 20"
							><polygon
								points="5,8 10,13 15,8"
								fill="currentColor"
								style="transform:rotate({showPemasukan ? 0 : 180}deg);transform-origin:center"
							/></svg
						>
					</button>
					{#if showPemasukan}
						<div
							class="flex gap-4 px-4 pt-1 pb-2 text-xs font-semibold text-gray-500 md:gap-6 md:px-6 md:pt-2 md:pb-4 md:text-base"
						>
							<span
								>QRIS: <span class="font-bold text-pink-500"
									>Rp {totalQrisPemasukan.toLocaleString('id-ID')}</span
								></span
							>
							<span
								>Tunai: <span class="font-bold text-pink-500"
									>Rp {totalTunaiPemasukan.toLocaleString('id-ID')}</span
								></span
							>
						</div>
						<div
							class="flex flex-col gap-0.5 bg-white py-2 md:gap-2 md:py-4"
							transition:slide|local
						>
							<!-- Sub: Pendapatan Usaha -->
							<button
								class="mb-0.5 flex w-full items-center justify-between px-4 py-1 text-sm font-semibold text-gray-700 md:mb-1 md:px-6 md:py-2 md:text-base"
								onclick={() => (showPendapatanUsaha = !showPendapatanUsaha)}
							>
								<span>Pendapatan Usaha</span>
								<svg class="ml-2 h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20"
									><polygon
										points="5,8 10,13 15,8"
										fill="currentColor"
										style="transform:rotate({showPendapatanUsaha
											? 0
											: 180}deg);transform-origin:center"
									/></svg
								>
							</button>
							{#if showPendapatanUsaha}
								<div
									class="flex flex-col gap-1 px-4 pt-0.5 pb-1 md:gap-2 md:px-6 md:pt-1 md:pb-2"
									transition:slide|local
								>
									<div
										class="mt-1 mb-1 text-xs font-semibold text-pink-500 md:mt-2 md:mb-2 md:text-sm"
									>
										QRIS
									</div>
									<ul class="flex flex-col gap-0.5 md:gap-1">
										{#if pemasukanUsahaQris.length === 0}
											<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">
												Tidak ada data
											</li>
										{/if}
										{#if isLoadingReport}
											{#each Array(3) as _}
												<li class="flex justify-between text-sm text-gray-600 md:text-base">
													<div class="h-4 w-32 animate-pulse rounded bg-gray-200"></div>
													<div class="h-4 w-20 animate-pulse rounded bg-gray-200"></div>
												</li>
											{/each}
										{:else}
											{#each groupAndSumByName(pemasukanUsahaQris).sort((a, b) => b.total - a.total) as grouped}
												<li class="flex justify-between text-sm text-gray-600 md:text-base">
													<span
														class="{expandedItems.has(grouped.name)
															? ''
															: 'max-w-[60%] truncate'} cursor-pointer"
														title={grouped.name}
														onclick={() => toggleExpand(grouped.name)}
														onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)}
														role="button"
														tabindex="0">{grouped.name}</span
													>
													<span class="font-bold whitespace-nowrap text-gray-700"
														>Rp {grouped.total.toLocaleString('id-ID')}</span
													>
												</li>
											{/each}
										{/if}
									</ul>
									<div
										class="mt-2 mb-1 text-xs font-semibold text-pink-500 md:mt-3 md:mb-2 md:text-sm"
									>
										Tunai
									</div>
									<ul class="flex flex-col gap-0.5 md:gap-1">
										{#if pemasukanUsahaTunai.length === 0}
											<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">
												Tidak ada data
											</li>
										{/if}
										{#each groupAndSumByName(pemasukanUsahaTunai).sort((a, b) => b.total - a.total) as grouped}
											<li class="flex justify-between text-sm text-gray-600 md:text-base">
												<span
													class="{expandedItems.has(grouped.name)
														? ''
														: 'max-w-[60%] truncate'} cursor-pointer"
													title={grouped.name}
													onclick={() => toggleExpand(grouped.name)}
													onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)}
													role="button"
													tabindex="0">{grouped.name}</span
												>
												<span class="font-bold whitespace-nowrap text-gray-700"
													>Rp {grouped.total.toLocaleString('id-ID')}</span
												>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							<!-- Sub: Pemasukan Lainnya -->
							<button
								class="mt-2 mb-0.5 flex w-full items-center justify-between px-4 py-1 text-sm font-semibold text-gray-700 md:mt-3 md:mb-1 md:px-6 md:py-2 md:text-base"
								onclick={() => (showPemasukanLain = !showPemasukanLain)}
							>
								<span>Pemasukan Lainnya</span>
								<svg class="ml-2 h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20"
									><polygon
										points="5,8 10,13 15,8"
										fill="currentColor"
										style="transform:rotate({showPemasukanLain
											? 0
											: 180}deg);transform-origin:center"
									/></svg
								>
							</button>
							{#if showPemasukanLain}
								<div
									class="flex flex-col gap-1 px-4 pt-0.5 pb-1 md:gap-2 md:px-6 md:pt-1 md:pb-2"
									transition:slide|local
								>
									<div
										class="mt-1 mb-1 text-xs font-semibold text-pink-500 md:mt-2 md:mb-2 md:text-sm"
									>
										QRIS
									</div>
									<ul class="flex flex-col gap-0.5 md:gap-1">
										{#if pemasukanLainQris.length === 0}
											<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">
												Tidak ada data
											</li>
										{/if}
										{#each groupAndSumByName(pemasukanLainQris).sort((a, b) => b.total - a.total) as grouped}
											<li class="flex justify-between text-sm text-gray-600 md:text-base">
												<span
													class="{expandedItems.has(grouped.name)
														? ''
														: 'max-w-[60%] truncate'} cursor-pointer"
													title={grouped.name}
													onclick={() => toggleExpand(grouped.name)}
													onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)}
													role="button"
													tabindex="0">{grouped.name}</span
												>
												<span class="font-bold whitespace-nowrap text-gray-700"
													>Rp {grouped.total.toLocaleString('id-ID')}</span
												>
											</li>
										{/each}
									</ul>
									<div
										class="mt-2 mb-1 text-xs font-semibold text-pink-500 md:mt-3 md:mb-2 md:text-sm"
									>
										Tunai
									</div>
									<ul class="flex flex-col gap-0.5 md:gap-1">
										{#if pemasukanLainTunai.length === 0}
											<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">
												Tidak ada data
											</li>
										{/if}
										{#each groupAndSumByName(pemasukanLainTunai).sort((a, b) => b.total - a.total) as grouped}
											<li class="flex justify-between text-sm text-gray-600 md:text-base">
												<span
													class="{expandedItems.has(grouped.name)
														? ''
														: 'max-w-[60%] truncate'} cursor-pointer"
													title={grouped.name}
													onclick={() => toggleExpand(grouped.name)}
													onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)}
													role="button"
													tabindex="0">{grouped.name}</span
												>
												<span class="font-bold whitespace-nowrap text-gray-700"
													>Rp {grouped.total.toLocaleString('id-ID')}</span
												>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/if}
				</div>
				<!-- Accordion: Pengeluaran -->
				<div
					class="overflow-hidden rounded-xl bg-white shadow-sm md:mb-4 md:rounded-2xl md:p-4 md:shadow lg:mb-0 lg:flex-1"
				>
					<button
						class="mb-1 flex min-h-[44px] w-full items-center justify-between rounded-xl bg-white px-4 py-2 text-base font-bold text-gray-700 md:mb-2 md:rounded-2xl md:px-6 md:py-4 md:text-lg"
						onclick={() => (showPengeluaran = !showPengeluaran)}
					>
						<span>Pengeluaran</span>
						<svg class="ml-2 h-5 w-5 md:h-6 md:w-6" viewBox="0 0 20 20"
							><polygon
								points="5,8 10,13 15,8"
								fill="currentColor"
								style="transform:rotate({showPengeluaran ? 0 : 180}deg);transform-origin:center"
							/></svg
						>
					</button>
					{#if showPengeluaran}
						<div
							class="flex gap-4 px-4 pt-1 pb-2 text-xs font-semibold text-gray-500 md:gap-6 md:px-6 md:pt-2 md:pb-4 md:text-base"
						>
							<span
								>QRIS: <span class="font-bold text-pink-500"
									>Rp {totalQrisPengeluaran.toLocaleString('id-ID')}</span
								></span
							>
							<span
								>Tunai: <span class="font-bold text-pink-500"
									>Rp {totalTunaiPengeluaran.toLocaleString('id-ID')}</span
								></span
							>
						</div>
						<div
							class="flex flex-col gap-0.5 bg-white py-2 md:gap-2 md:py-4"
							transition:slide|local
						>
							<!-- Sub: Beban Usaha -->
							<button
								class="mb-0.5 flex w-full items-center justify-between px-4 py-1 text-sm font-semibold text-gray-700 md:mb-1 md:px-6 md:py-2 md:text-base"
								onclick={() => (showBebanUsaha = !showBebanUsaha)}
							>
								<span>Beban Usaha</span>
								<svg class="ml-2 h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20"
									><polygon
										points="5,8 10,13 15,8"
										fill="currentColor"
										style="transform:rotate({showBebanUsaha ? 0 : 180}deg);transform-origin:center"
									/></svg
								>
							</button>
							{#if showBebanUsaha}
								<div
									class="flex flex-col gap-1 px-4 pt-0.5 pb-1 md:gap-2 md:px-6 md:pt-1 md:pb-2"
									transition:slide|local
								>
									<div
										class="mt-1 mb-1 text-xs font-semibold text-pink-500 md:mt-2 md:mb-2 md:text-sm"
									>
										QRIS
									</div>
									<ul class="flex flex-col gap-0.5 md:gap-1">
										{#if bebanUsahaQris.length === 0}
											<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">
												Tidak ada data
											</li>
										{/if}
										{#each groupAndSumByName(bebanUsahaQris).sort((a, b) => b.total - a.total) as grouped}
											<li class="flex justify-between text-sm text-gray-600 md:text-base">
												<span
													class="{expandedItems.has(grouped.name)
														? ''
														: 'max-w-[60%] truncate'} cursor-pointer"
													title={grouped.name}
													onclick={() => toggleExpand(grouped.name)}
													onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)}
													role="button"
													tabindex="0">{grouped.name}</span
												>
												<span class="font-bold whitespace-nowrap text-gray-700"
													>Rp {grouped.total.toLocaleString('id-ID')}</span
												>
											</li>
										{/each}
									</ul>
									<div
										class="mt-2 mb-1 text-xs font-semibold text-pink-500 md:mt-3 md:mb-2 md:text-sm"
									>
										Tunai
									</div>
									<ul class="flex flex-col gap-0.5 md:gap-1">
										{#if bebanUsahaTunai.length === 0}
											<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">
												Tidak ada data
											</li>
										{/if}
										{#each groupAndSumByName(bebanUsahaTunai).sort((a, b) => b.total - a.total) as grouped}
											<li class="flex justify-between text-sm text-gray-600 md:text-base">
												<span
													class="{expandedItems.has(grouped.name)
														? ''
														: 'max-w-[60%] truncate'} cursor-pointer"
													title={grouped.name}
													onclick={() => toggleExpand(grouped.name)}
													onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)}
													role="button"
													tabindex="0">{grouped.name}</span
												>
												<span class="font-bold whitespace-nowrap text-gray-700"
													>Rp {grouped.total.toLocaleString('id-ID')}</span
												>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							<!-- Sub: Beban Lainnya -->
							<button
								class="mt-2 mb-0.5 flex w-full items-center justify-between px-4 py-1 text-sm font-semibold text-gray-700 md:mt-3 md:mb-1 md:px-6 md:py-2 md:text-base"
								onclick={() => (showBebanLain = !showBebanLain)}
							>
								<span>Beban Lainnya</span>
								<svg class="ml-2 h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20"
									><polygon
										points="5,8 10,13 15,8"
										fill="currentColor"
										style="transform:rotate({showBebanLain ? 0 : 180}deg);transform-origin:center"
									/></svg
								>
							</button>
							{#if showBebanLain}
								<div
									class="flex flex-col gap-1 px-4 pt-0.5 pb-1 md:gap-2 md:px-6 md:pt-1 md:pb-2"
									transition:slide|local
								>
									<div
										class="mt-1 mb-1 text-xs font-semibold text-pink-500 md:mt-2 md:mb-2 md:text-sm"
									>
										QRIS
									</div>
									<ul class="flex flex-col gap-0.5 md:gap-1">
										{#if bebanLainQris.length === 0}
											<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">
												Tidak ada data
											</li>
										{/if}
										{#each groupAndSumByName(bebanLainQris).sort((a, b) => b.total - a.total) as grouped}
											<li class="flex justify-between text-sm text-gray-600 md:text-base">
												<span
													class="{expandedItems.has(grouped.name)
														? ''
														: 'max-w-[60%] truncate'} cursor-pointer"
													title={grouped.name}
													onclick={() => toggleExpand(grouped.name)}
													onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)}
													role="button"
													tabindex="0">{grouped.name}</span
												>
												<span class="font-bold whitespace-nowrap text-gray-700"
													>Rp {grouped.total.toLocaleString('id-ID')}</span
												>
											</li>
										{/each}
									</ul>
									<div
										class="mt-2 mb-1 text-xs font-semibold text-pink-500 md:mt-3 md:mb-2 md:text-sm"
									>
										Tunai
									</div>
									<ul class="flex flex-col gap-0.5 md:gap-1">
										{#if bebanLainTunai.length === 0}
											<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">
												Tidak ada data
											</li>
										{/if}
										{#each groupAndSumByName(bebanLainTunai).sort((a, b) => b.total - a.total) as grouped}
											<li class="flex justify-between text-sm text-gray-600 md:text-base">
												<span
													class="{expandedItems.has(grouped.name)
														? ''
														: 'max-w-[60%] truncate'} cursor-pointer"
													title={grouped.name}
													onclick={() => toggleExpand(grouped.name)}
													onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)}
													role="button"
													tabindex="0">{grouped.name}</span
												>
												<span class="font-bold whitespace-nowrap text-gray-700"
													>Rp {grouped.total.toLocaleString('id-ID')}</span
												>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/if}
				</div>
				<!-- Section Laba/Rugi - Desktop Layout -->
				<div class="lg:flex lg:flex-1 lg:flex-col lg:gap-4">
					<!-- Laba (Rugi) Kotor -->
					<div
						class="mb-1 flex items-center justify-between rounded-xl border border-pink-100 bg-white px-4 py-3 text-base font-bold text-gray-700 shadow-sm md:mb-0 md:justify-center md:gap-4 md:rounded-2xl md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:p-6 md:text-center md:text-2xl md:shadow-sm lg:mb-0 lg:h-full lg:min-h-[120px] lg:flex-col lg:justify-center"
					>
						<span>Laba (Rugi) Kotor</span>
						<span
							>Rp {summary?.labaKotor !== null && summary?.labaKotor !== undefined
								? summary.labaKotor.toLocaleString('id-ID')
								: '--'}</span
						>
					</div>
					<!-- Pajak Penghasilan -->
					<div
						class="mb-1 flex items-center justify-between rounded-xl border border-pink-100 bg-white px-4 py-3 text-base font-bold text-gray-700 shadow-sm md:mb-0 md:justify-center md:gap-4 md:rounded-2xl md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:p-6 md:text-center md:text-2xl md:shadow-sm lg:mb-0 lg:h-full lg:min-h-[120px] lg:flex-col lg:justify-center"
					>
						<span>Pajak Penghasilan (0,5%)</span>
						<span
							>Rp {summary?.pajak !== null && summary?.pajak !== undefined
								? summary.pajak.toLocaleString('id-ID')
								: '--'}</span
						>
					</div>
					<!-- Laba (Rugi) Bersih -->
					<div
						class="flex items-center justify-between rounded-xl border border-pink-100 bg-white px-4 py-3 text-base font-bold text-pink-600 shadow-sm md:mb-0 md:justify-center md:gap-4 md:rounded-2xl md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:p-6 md:text-center md:text-2xl md:shadow-sm lg:mb-0 lg:h-full lg:min-h-[120px] lg:flex-col lg:justify-center"
					>
						<span>Laba (Rugi) Bersih</span>
						<span
							>Rp {summary?.labaBersih !== null && summary?.labaBersih !== undefined
								? summary.labaBersih.toLocaleString('id-ID')
								: '--'}</span
						>
					</div>
				</div>
			</div>

			<!-- AI Assistant Section -->
			<div class="mt-4 px-2 md:mt-8 md:px-0">
				<div
					class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700 p-8 shadow-2xl"
				>
					<!-- Background Pattern -->
					<div class="absolute inset-0 opacity-10">
						<svg class="h-full w-full" viewBox="0 0 100 100" fill="currentColor">
							<defs>
								<pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
									<path
										d="M 10 0 L 0 0 0 10"
										fill="none"
										stroke="currentColor"
										stroke-width="0.5"
									/>
								</pattern>
							</defs>
							<rect width="100" height="100" fill="url(#grid)" />
						</svg>
					</div>

					<!-- Floating Elements -->
					<div class="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/10 blur-xl"></div>
					<div
						class="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-pink-300/20 blur-2xl"
					></div>

					<!-- Content -->
					<div class="relative z-10">
						<!-- Header -->
						<div class="mb-6 flex items-center gap-4">
							<div class="relative">
								<div
									class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm"
								>
									<svg
										class="h-8 w-8 text-white"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
										/>
									</svg>
								</div>
							</div>
							<div class="flex-1">
								<h3 class="mb-1 text-2xl font-bold text-white">Asisten AI</h3>
								<p class="text-sm text-pink-100">
									Dapatkan insight cerdas dan analisis mendalam tentang laporan keuangan Anda
								</p>
							</div>
						</div>

						<!-- Input Section -->
						<div class="relative">
							<div class="flex items-center gap-3">
								<div class="relative flex-1">
									<input
										type="text"
										placeholder="Tanya AI tentang laporan ini... (contoh: 'Bagaimana performa penjualan hari ini?')"
										bind:value={aiQuestion}
										onkeypress={(e) => e.key === 'Enter' && !isAiLoading && handleAiAsk(aiQuestion)}
										disabled={isAiLoading}
										class="w-full rounded-2xl border-0 bg-white/90 px-6 py-4 pr-16 text-gray-800 placeholder-gray-500 shadow-lg backdrop-blur-sm transition-all duration-300 focus:bg-white focus:ring-4 focus:ring-white/30 focus:outline-none disabled:cursor-not-allowed disabled:bg-white/70"
									/>

									<!-- Send Button -->
									<button
										onclick={() => !isAiLoading && handleAiAsk(aiQuestion)}
										disabled={!aiQuestion.trim() || isAiLoading}
										class="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 shadow-lg transition-all duration-300 hover:from-pink-600 hover:to-purple-700 hover:shadow-xl disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none"
									>
										{#if isAiLoading}
											<svg class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
												<circle
													class="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													stroke-width="4"
												></circle>
												<path
													class="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
										{:else}
											<svg
												class="h-5 w-5 text-white"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
												/>
											</svg>
										{/if}
									</button>
								</div>
							</div>

							<!-- Quick Suggestions -->
							<div class="mt-4 flex flex-wrap gap-2">
								<button
									onclick={() => (aiQuestion = 'Bagaimana performa penjualan hari ini?')}
									class="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
								>
									📊 Performa Penjualan
								</button>
								<button
									onclick={() => (aiQuestion = 'Produk apa yang paling laris?')}
									class="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
								>
									🏆 Produk Terlaris
								</button>
								<button
									onclick={() => (aiQuestion = 'Berapa keuntungan bersih hari ini?')}
									class="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
								>
									💰 Keuntungan Bersih
								</button>
								<button
									onclick={() => (aiQuestion = 'Bagaimana tren penjualan minggu ini?')}
									class="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/30"
								>
									📈 Tren Penjualan
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Modal Filter -->
			{#if showFilter}
				<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
					<div
						class="filter-sheet-anim mx-auto w-full max-w-md rounded-t-2xl bg-white p-6 pb-8 shadow-lg"
					>
						<div class="mb-6 flex items-center justify-between">
							<h3 class="text-lg font-bold text-gray-800">Filter Laporan</h3>
							<button
								class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
								onclick={() => (showFilter = false)}
								aria-label="Tutup filter"
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
						<!-- Pilihan Tipe Filter -->
						<div class="mb-6">
							<label class="mb-3 block text-sm font-medium text-gray-700" for="filter-type-buttons"
								>Pilih Periode</label
							>
							<div
								class="grid grid-cols-2 gap-3"
								id="filter-type-buttons"
								role="group"
								aria-labelledby="filter-type-buttons"
							>
								<button
									class="rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-200 {filterType ===
									'harian'
										? 'border-pink-500 bg-pink-50 text-pink-600'
										: 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}"
									onclick={() => (filterType = 'harian')}
									onkeydown={(e) => e.key === 'Enter' && (filterType = 'harian')}
								>
									Harian
								</button>
								<button
									class="rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-200 {filterType ===
									'mingguan'
										? 'border-pink-500 bg-pink-50 text-pink-600'
										: 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}"
									onclick={() => (filterType = 'mingguan')}
									onkeydown={(e) => e.key === 'Enter' && (filterType = 'mingguan')}
								>
									Mingguan
								</button>
								<button
									class="rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-200 {filterType ===
									'bulanan'
										? 'border-pink-500 bg-pink-50 text-pink-600'
										: 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}"
									onclick={() => (filterType = 'bulanan')}
									onkeydown={(e) => e.key === 'Enter' && (filterType = 'bulanan')}
								>
									Bulanan
								</button>
								<button
									class="rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-200 {filterType ===
									'tahunan'
										? 'border-pink-500 bg-pink-50 text-pink-600'
										: 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}"
									onclick={() => {
										filterType = 'tahunan';
									}}
									onkeydown={(e) => e.key === 'Enter' && (filterType = 'tahunan')}
								>
									Tahunan
								</button>
							</div>
						</div>
						<!-- Input Filter Berdasarkan Tipe -->
						{#if filterType === 'harian'}
							<div class="mb-6">
								<label class="mb-2 block text-sm font-medium text-gray-700" for="harian-date"
									>Pilih Tanggal</label
								>
								<input
									id="harian-date"
									type="date"
									class="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition-colors focus:border-pink-500 focus:outline-none"
									bind:value={startDate}
								/>
							</div>
						{:else if filterType === 'mingguan'}
							<div class="mb-6">
								<label class="mb-2 block text-sm font-medium text-gray-700" for="mingguan-date"
									>Pilih Tanggal Awal Minggu</label
								>
								<input
									id="mingguan-date"
									type="date"
									class="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition-colors focus:border-pink-500 focus:outline-none"
									bind:value={startDate}
								/>
							</div>
						{:else if filterType === 'bulanan'}
							<div class="mb-6">
								<label class="mb-2 block text-sm font-medium text-gray-700" for="bulanan-month"
									>Pilih Bulan dan Tahun</label
								>
								<div class="flex gap-3">
									<select
										id="bulanan-month"
										class="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition-colors focus:border-pink-500 focus:outline-none"
										bind:value={filterMonth}
									>
										{#each Array(12) as _, i}
											<option value={(i + 1).toString().padStart(2, '0')}>
												{new Date(2024, i).toLocaleDateString('id-ID', { month: 'long' })}
											</option>
										{/each}
									</select>
									<select
										class="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition-colors focus:border-pink-500 focus:outline-none"
										bind:value={filterYear}
									>
										{#each Array(6) as _, i}
											<option value={(2020 + i).toString()}>{2020 + i}</option>
										{/each}
									</select>
								</div>
							</div>
						{:else if filterType === 'tahunan'}
							<div class="mb-6">
								<label class="mb-2 block text-sm font-medium text-gray-700" for="tahunan-year"
									>Pilih Tahun</label
								>
								<select
									id="tahunan-year"
									class="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition-colors focus:border-pink-500 focus:outline-none"
									bind:value={filterYear}
								>
									{#each Array(6) as _, i}
										<option value={(2020 + i).toString()}>{2020 + i}</option>
									{/each}
								</select>
							</div>
						{/if}
						<!-- Button Actions -->
						<div class="flex gap-3">
							<button
								class="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-600 transition-colors hover:bg-gray-200"
								onclick={() => (showFilter = false)}
							>
								Batal
							</button>
							<button
								class="flex-1 rounded-xl bg-pink-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-pink-600 active:bg-pink-700"
								onclick={applyFilter}
							>
								Terapkan
							</button>
						</div>
					</div>
				</div>
			{/if}

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

<!-- AI Response Modal -->
{#if showAiModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-2 py-2 backdrop-blur-sm sm:px-4 sm:py-4"
		onclick={(e) => e.target === e.currentTarget && handleAiClose()}
		onkeydown={(e) => e.key === 'Escape' && handleAiClose()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="mx-auto max-h-[80vh] w-full max-w-[500px] overflow-hidden rounded-2xl bg-white shadow-2xl md:max-w-[720px]"
			transition:slide={{ duration: 300, easing: cubicOut }}
		>
			<!-- Modal Header -->
			<div class="bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<h3 class="text-lg font-bold text-white">Asisten AI</h3>
					</div>
					<button
						onclick={handleAiClose}
						class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
						aria-label="Tutup"
					>
						<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Modal Content -->
			<div class="max-h-[60vh] overflow-y-auto p-3 md:p-4">
				{#if isAiLoading}
					<div class="flex items-center justify-center px-4 py-8">
						<div class="flex flex-col items-center gap-3 text-center">
							<svg class="h-8 w-8 animate-spin text-pink-500" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<span class="mx-auto max-w-xs text-sm font-medium text-gray-600 md:text-base"
								>Asisten AI sedang memproses pertanyaan Anda...</span
							>
						</div>
					</div>
				{:else if aiAnswer}
					<div class="space-y-4">
						<!-- Card Pertanyaan -->
						<div
							class="rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50 to-purple-50 p-3"
						>
							<p class="mb-0 text-sm text-gray-700">
								<span class="inline-flex items-center gap-2 font-semibold text-pink-700">
									<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 4H7a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v9a2 2 0 01-2 2z"
										/></svg
									>
									Pertanyaan
								</span>
							</p>
							<p class="mt-1 text-gray-800">{aiQuestion}</p>
						</div>

						<!-- Card Jawaban Asisten AI (tanpa header) -->
						<div class="overflow-hidden rounded-xl border border-gray-200 p-3 shadow-sm md:p-4">
							<!-- Konten markdown dari AI -->
							<div class="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800">
								{@html renderMarkdown(aiAnswer)}
							</div>

							<!-- Divider -->
							<div class="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
								Catatan: Saran bersifat umum. Sesuaikan dengan kondisi bisnis Anda.
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="border-t border-gray-200 bg-gray-50 px-3 py-3">
				<div class="flex items-center justify-end">
					<button
						onclick={handleAiClose}
						class="rounded-lg bg-pink-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pink-600"
					>
						Tutup
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

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
