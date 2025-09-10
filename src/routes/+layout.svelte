<script lang="ts">
	import '../app.css';
	import Topbar from '$lib/components/shared/topBar.svelte';
	import BottomNav from '$lib/components/shared/bottomNav.svelte';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import { getSupabaseClient } from '$lib/database/supabaseClient';
	import { get as storeGet } from 'svelte/store';
	import { selectedBranch } from '$lib/stores/selectedBranch';
	import Download from 'lucide-svelte/icons/download';
	import { posGridView } from '$lib/stores/posGridView';
	import { slide, fade, fly } from 'svelte/transition';
	import { auth } from '$lib/auth/auth';
	import { userRole } from '$lib/stores/userRole';
	import { dataService } from '$lib/services/dataService';
	import { getPendingTransactions } from '$lib/utils/offline';
	import PinModal from '$lib/components/shared/pinModal.svelte';
	import { securitySettings } from '$lib/stores/securitySettings';
	import { requireAuth } from '$lib/utils/authGuard';

	// PWA Update Notification
	let showUpdateNotification = false;
	let updateAvailable = false;

	let hasPrefetched = false;
	let isOffline = !navigator.onLine;
	let pendingCount = 0;
	let showToast = false;

	async function updatePending() {
		pendingCount = (await getPendingTransactions()).length;
	}

	async function prefetchAllData() {
		if (hasPrefetched || !navigator.onLine) return;
		hasPrefetched = true;
		try {
			const today = new Date();
			const dateStrings = [];
			for (let i = 0; i < 30; i++) {
				const d = new Date(today);
				d.setDate(today.getDate() - i);
				dateStrings.push(d.toISOString().slice(0, 10));
			}
			await Promise.all([
				// Beranda, POS, POS/bayar, Catat
				dataService.getProducts(),
				dataService.getCategories(),
				dataService.getAddOns(),
				dataService.getBestSellers(),
				dataService.getWeeklyIncome(),
				// Laporan: prefetch laporan harian/mingguan/bulanan untuk 30 hari ke belakang
				...dateStrings.map((date) => dataService.getReportData(date, 'daily')),
				...dateStrings.map((date) => dataService.getReportData(date.slice(0, 7), 'weekly')),
				...dateStrings.map((date) => dataService.getReportData(date.slice(0, 7), 'monthly')),
				// Pengaturan, printer, pemilik, dsb.
				dataService.supabaseClient?.from?.('pengaturan')?.select?.('*'),
				// Manajemen menu, riwayat, dsb.
				dataService.supabaseClient?.from?.('produk')?.select?.('*'),
				dataService.supabaseClient?.from?.('kategori')?.select?.('*'),
				dataService.supabaseClient?.from?.('tambahan')?.select?.('*'),
				dataService.supabaseClient?.from?.('transaksi_kasir')?.select?.('*'),
				dataService.supabaseClient?.from?.('buku_kas')?.select?.('*'),
				// User profile (login)
				dataService.supabaseClient?.from?.('profil')?.select?.('*')
			]);
		} catch (e) {
			// Ignore prefetch error
		}
	}

	onMount(async () => {
		// Cek auth sebelum lanjut
		if (!requireAuth()) return;

		// Setup PWA update notification (only in production)
		if ('serviceWorker' in navigator && import.meta.env.PROD) {
			try {
				const { Workbox } = await import('workbox-window');
				const wb = new Workbox('/sw.js');
				
				wb.addEventListener('waiting', () => {
					updateAvailable = true;
					showUpdateNotification = true;
				});

				wb.addEventListener('controlling', () => {
					// Update applied, reload page
					window.location.reload();
				});

				await wb.register();
			} catch (error) {
				console.log('PWA registration failed:', error);
			}
		}

		isOffline = !navigator.onLine;
		updatePending();
		// Tunda prefetch berat ke idle agar tidak menambah critical path
		if ('requestIdleCallback' in window) {
			(window as any).requestIdleCallback(() => prefetchAllData());
		} else {
			setTimeout(() => prefetchAllData(), 500);
		}
		window.addEventListener('offline', () => {
			isOffline = true;
		});
		window.addEventListener('online', () => {
			isOffline = false;
			updatePending();
			if ('requestIdleCallback' in window) {
				(window as any).requestIdleCallback(() => prefetchAllData());
			} else {
				setTimeout(() => prefetchAllData(), 500);
			}
		});
		window.addEventListener('storage', () => {
			updatePending();
		});
		window.addEventListener('pending-synced', () => {
			showToast = true;
			updatePending();
			setTimeout(() => (showToast = false), 3000);
		});
	});

	// --- Logika Tampilan Navigasi ---
	let showNav = true;
	$: {
		const path = $page.url.pathname;
		const noNavRoutes = ['/login', '/unauthorized', '/pos/bayar'];
		if (noNavRoutes.includes(path) || path.startsWith('/pengaturan')) {
			showNav = false;
		} else {
			showNav = true;
		}
	}

	// --- Logika PinModal Global ---
	let showPinModal = false;
	let currentPin = '1234'; // Default fallback PIN
	let pinUnlockedForCurrentPage = false; // Flag untuk menandai PIN sudah dibuka untuk halaman saat ini
	let lastPath = '';

	// Helper: map nama halaman ke path sebenarnya
	function mapLockedNameToPath(name: string): string {
		if (!name) return '';
		const lowered = name.toLowerCase();
		if (lowered === 'beranda' || lowered === 'home') return '/';
		return `/${lowered}`;
	}

	// Reset pinUnlockedForCurrentPage jika navigasi ke halaman baru
	$: if ($navigating) {
		pinUnlockedForCurrentPage = false;
	}

	// Reactive statement untuk menangani PIN modal
	$: {
		const currentUserRole = $userRole;
		const currentSecuritySettings = $securitySettings;
		const currentPath = $page.url.pathname;

		// Reset pinUnlockedForCurrentPage jika path berubah
		if (currentPath !== lastPath) {
			pinUnlockedForCurrentPage = false;
			lastPath = currentPath;
		}

		// Cek apakah halaman saat ini termasuk dalam daftar halaman yang terkunci
		const isCurrentPageLocked =
			currentSecuritySettings?.lockedPages &&
			currentSecuritySettings.lockedPages.some((lockedPageName) => {
				const fullLockedPath = mapLockedNameToPath(lockedPageName);
				if (!fullLockedPath) return false;
				if (fullLockedPath === '/') return currentPath === '/';
				return (
					currentPath === fullLockedPath ||
					currentPath.startsWith(fullLockedPath + '/')
				);
			});

		// Tentukan apakah modal PIN harus ditampilkan
		if (currentUserRole === 'kasir' && isCurrentPageLocked && !pinUnlockedForCurrentPage) {
			showPinModal = true;
			currentPin = currentSecuritySettings?.pin || '1234'; // Gunakan PIN dari settings atau fallback
		} else {
			showPinModal = false;
		}
	}

	function handlePinSuccess() {
		pinUnlockedForCurrentPage = true;
		showPinModal = false;
	}

	function handlePinError(event: CustomEvent) {
		// Tampilkan toast error jika diperlukan
	}

	function handlePinClose() {
		// Jika user menutup modal tanpa memasukkan PIN yang benar, arahkan ke login
		if (!pinUnlockedForCurrentPage) {
			auth.logout();
			goto('/login');
		}
	}

	// PWA Update handlers
	async function applyUpdate() {
		if ('serviceWorker' in navigator && import.meta.env.PROD) {
			try {
				const { Workbox } = await import('workbox-window');
				const wb = new Workbox('/sw.js');
				await wb.messageSkipWaiting();
			} catch (error) {
				console.log('Failed to apply update:', error);
			}
		}
	}

	function dismissUpdate() {
		showUpdateNotification = false;
	}
	// --- Akhir Logika ---
</script>

{#if pendingCount > 0}
	<div
		class="animate-fade-in fixed bottom-0 left-0 z-50 w-full animate-pulse bg-pink-500 py-2 text-center font-semibold text-white shadow"
	>
		{pendingCount} transaksi menunggu untuk dikirim ke server
	</div>
{/if}

{#if showToast}
	<div
		class="animate-fade-in fixed top-16 left-1/2 z-50 -translate-x-1/2 transform rounded-xl bg-green-500 px-6 py-3 text-center text-white shadow-lg"
	>
		Transaksi offline berhasil dikirim ke server!
	</div>
{/if}

<!-- PWA Update Notification -->
{#if showUpdateNotification}
	<div
		class="animate-fade-in fixed top-16 left-1/2 z-50 -translate-x-1/2 transform rounded-xl bg-blue-500 px-6 py-4 text-center text-white shadow-lg"
	>
		<div class="mb-2">
			<svg class="mx-auto h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
		</div>
		<p class="mb-3 font-semibold">Update Tersedia!</p>
		<p class="mb-4 text-sm opacity-90">Aplikasi akan diperbarui untuk performa yang lebih baik.</p>
		<div class="flex gap-2">
			<button
				on:click={applyUpdate}
				class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-500 transition-colors hover:bg-blue-50"
			>
				Update Sekarang
			</button>
			<button
				on:click={dismissUpdate}
				class="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
			>
				Nanti
			</button>
		</div>
	</div>
{/if}

{#if showNav}
	<!-- Layout standar dengan navigasi -->
	<div class="page-transition flex h-screen min-h-0 flex-col bg-white">
		<div class="sticky top-0 z-30 bg-white shadow-md">
			<Topbar>
				<svelte:fragment slot="actions">
					{#if $page.url.pathname === '/pos'}
						<button
							class="mr-2 flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 transition-colors hover:bg-pink-50"
							on:click={() => posGridView.update((v) => !v)}
							aria-label={$posGridView ? 'Tampilkan List' : 'Tampilkan Grid'}
							type="button"
						>
							{#if $posGridView}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5 text-gray-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
									><rect x="4" y="4" width="7" height="7" rx="2" /><rect
										x="13"
										y="4"
										width="7"
										height="7"
										rx="2"
									/><rect x="4" y="13" width="7" height="7" rx="2" /><rect
										x="13"
										y="13"
										width="7"
										height="7"
										rx="2"
									/></svg
								>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5 text-gray-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M4 6h16M4 12h16M4 18h16"
									/></svg
								>
							{/if}
						</button>
					{/if}
				</svelte:fragment>
				<svelte:fragment slot="download">
					{#if $page.url.pathname === '/laporan'}
						<button
							class="mr-2 flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-gray-200 bg-white text-2xl text-pink-500 shadow-lg shadow-pink-500/7 transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12"
							aria-label="Download Laporan"
						>
							<Download size={22} />
						</button>
					{/if}
				</svelte:fragment>
			</Topbar>
		</div>
		<div
			class="min-h-0 flex-1 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<slot />
		</div>
		<div class="sticky bottom-0 z-30 bg-white">
			<BottomNav />
		</div>
	</div>
{:else}
	<!-- Layout tanpa navigasi -->
	<div class="page-transition flex h-screen min-h-0 flex-col bg-white">
		<div class="min-h-0 flex-1 overflow-y-auto">
			<slot />
		</div>
	</div>
{/if}

<!-- Global PinModal -->
{#if showPinModal}
	<PinModal
		show={showPinModal}
		pin={currentPin}
		title="Akses Terkunci"
		subtitle="Masukkan PIN untuk mengakses halaman ini"
		on:success={handlePinSuccess}
		on:error={handlePinError}
		on:close={handlePinClose}
	/>
{/if}

<svelte:head>
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1"
	/>
	<title>ZatiarasPOS</title>
</svelte:head>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.animate-fade-in {
		animation: fade-in 0.4s ease;
	}
	
	/* Prevent unwanted zoom while maintaining accessibility */
	:global(html) {
		touch-action: manipulation;
		-webkit-text-size-adjust: 100%;
		-ms-text-size-adjust: 100%;
	}
	
	:global(body) {
		touch-action: manipulation;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		-khtml-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}
	
	/* Allow text selection in input fields */
	:global(input, textarea, [contenteditable]) {
		-webkit-user-select: text;
		-khtml-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;
		user-select: text;
	}
</style>
