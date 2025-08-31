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

	onMount(() => {
		// Cek auth sebelum lanjut
		if (!requireAuth()) return;

		isOffline = !navigator.onLine;
		updatePending();
		prefetchAllData();
		window.addEventListener('offline', () => {
			isOffline = true;
		});
		window.addEventListener('online', () => {
			isOffline = false;
			updatePending();
			prefetchAllData();
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

	$: {
		const currentUserRole = $userRole;
		const currentSecuritySettings = $securitySettings;
		const currentPath = $page.url.pathname;

		// Reset pinUnlockedForCurrentPage jika navigasi ke halaman baru
		if ($navigating) {
			pinUnlockedForCurrentPage = false;
		}

		// Cek apakah halaman saat ini termasuk dalam daftar halaman yang terkunci
		const isCurrentPageLocked =
			currentSecuritySettings?.lockedPages &&
			currentSecuritySettings.lockedPages.some((lockedPageName) => {
				const fullLockedPath = `/${lockedPageName}`; // Tambahkan awalan '/'
				return (
					currentPath === fullLockedPath ||
					(currentPath.startsWith(fullLockedPath + '/') && fullLockedPath !== '/')
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
		content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no"
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
</style>
