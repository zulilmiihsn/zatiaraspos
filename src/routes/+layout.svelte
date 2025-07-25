<script lang="ts">
	import '../app.css';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import BottomNav from '$lib/components/shared/BottomNav.svelte';
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
				...dateStrings.map(date => dataService.getReportData(date, 'daily')),
				...dateStrings.map(date => dataService.getReportData(date.slice(0, 7), 'weekly')),
				...dateStrings.map(date => dataService.getReportData(date.slice(0, 7), 'monthly')),
				// Pengaturan, printer, pemilik, dsb.
				dataService.supabaseClient?.from?.('pengaturan_struk')?.select?.('*'),
				dataService.supabaseClient?.from?.('pengaturan_keamanan')?.select?.('*'),
				dataService.supabaseClient?.from?.('printer')?.select?.('*'),
				// Manajemen menu, riwayat, dsb.
				dataService.supabaseClient?.from?.('produk')?.select?.('*'),
				dataService.supabaseClient?.from?.('kategori')?.select?.('*'),
				dataService.supabaseClient?.from?.('tambahan')?.select?.('*'),
				dataService.supabaseClient?.from?.('transaksi_kasir')?.select?.('*'),
				dataService.supabaseClient?.from?.('buku_kas')?.select?.('*'),
				// User profile (login)
				dataService.supabaseClient?.from?.('profil')?.select?.('*'),
			]);
		} catch (e) {
			// Ignore prefetch error
		}
	}

	onMount(() => {
		isOffline = !navigator.onLine;
		updatePending();
		prefetchAllData();
		window.addEventListener('offline', () => { isOffline = true; });
		window.addEventListener('online', () => { isOffline = false; updatePending(); prefetchAllData(); });
		window.addEventListener('storage', updatePending);
		window.addEventListener('pending-synced', () => {
			showToast = true;
			updatePending();
			setTimeout(() => showToast = false, 3000);
		});
	});

	onDestroy(() => {
		if (typeof window !== 'undefined' && $page.url.pathname === '/pengaturan/pemilik/gantikeamanan') {
			document.body.classList.remove('hide-nav');
		}
	});

	let isPosPage = false;
	let posGridViewValue = true;
	let tokoAktif = false; // TODO: Nanti dihubungkan ke state global/store dari page beranda

	$: isPosPage = $page.url.pathname === '/pos';

	$: if (isPosPage) {
		const unsubscribe = posGridView.subscribe(v => posGridViewValue = v);
	}

	$: hideNav = $page.url.pathname === '/pengaturan/pemilik/riwayat';

	// Subscribe ke selectedBranch: clear cache & fetch ulang data saat cabang berubah, tanpa reload
	if (typeof window !== 'undefined') {
		let lastBranch = sessionStorage.getItem('selectedBranch');
		selectedBranch.subscribe(async val => {
			if (val && val !== lastBranch) {
				await dataService.clearAllCaches();
				// Komponen/halaman lain harus subscribe ke selectedBranch dan fetch ulang data
			}
			lastBranch = val;
		});
	}
</script>

{#if pendingCount > 0}
	<div class="fixed bottom-0 left-0 w-full bg-pink-500 text-white text-center py-2 z-50 font-semibold shadow animate-pulse animate-fade-in">
		{pendingCount} transaksi menunggu untuk dikirim ke server
	</div>
{/if}

{#if showToast}
	<div class="fixed top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
		Transaksi offline berhasil dikirim ke server!
	</div>
{/if}

<!-- Loading indicator -->


{#if $page.url.pathname === '/login' || $page.url.pathname === '/unauthorized' || $page.url.pathname === '/pengaturan' || $page.url.pathname === '/pengaturan/printer' || $page.url.pathname === '/pengaturan/pemilik' || $page.url.pathname === '/pengaturan/pemilik/manajemenmenu'}
	<!-- Public pages and settings page without navigation -->
	<div class="flex flex-col h-screen min-h-0 bg-white page-transition">
		<div class="flex-1 min-h-0 overflow-y-auto">
		<slot />
		</div>
	</div>
{:else if $page.url.pathname === '/pos/bayar'}
	<div class="flex flex-col h-screen min-h-0 bg-white page-transition">
		<div class="flex-1 min-h-0 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<slot />
		</div>
	</div>
{:else}
	<div class="flex flex-col h-screen min-h-0 bg-white page-transition">
		{#if $page.url.pathname !== '/laporan' && $page.url.pathname !== '/pengaturan/pemilik/gantikeamanan' && $page.url.pathname !== '/pengaturan/pemilik/manajemenmenu'}
			{#if !hideNav}
				<div class="sticky top-0 z-30 bg-white shadow-md">
					<Topbar>
						<svelte:fragment slot="actions">
							{#if $page.url.pathname === '/'}
								<!-- Button Buka/Tutup Toko dihapus sesuai permintaan user -->
							{/if}
							{#if $page.url.pathname === '/pos'}
								<button
									class="p-2 rounded-lg border border-gray-200 bg-white hover:bg-pink-50 transition-colors flex items-center justify-center mr-2"
									onclick={() => posGridView.update(v => !v)}
									aria-label={$posGridView ? 'Tampilkan List' : 'Tampilkan Grid'}
									type="button"
								>
									{#if $posGridView}
										<!-- Icon Grid -->
										<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>
									{:else}
										<!-- Icon List -->
										<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
									{/if}
								</button>
							{/if}
						</svelte:fragment>
					</Topbar>
				</div>
			{/if}
		{/if}
		{#if $page.url.pathname === '/laporan'}
			<div class="sticky top-0 z-30 bg-white shadow-md">
				<Topbar>
					<svelte:fragment slot="download">
						<button class="w-[38px] h-[38px] rounded-lg bg-white border-[1.5px] border-gray-200 flex items-center justify-center text-2xl text-pink-500 shadow-lg shadow-pink-500/7 cursor-pointer transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12 mr-2" aria-label="Download Laporan">
							<Download size={22} />
						</button>
					</svelte:fragment>
					<svelte:fragment slot="actions"></svelte:fragment>
				</Topbar>
			</div>
		{/if}
		<div class="flex-1 min-h-0 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<slot />
		</div>
	</div>
{/if}

{#if !hideNav && $page.url.pathname !== '/login' && $page.url.pathname !== '/unauthorized' && $page.url.pathname !== '/pengaturan' && $page.url.pathname !== '/pengaturan/printer' && $page.url.pathname !== '/pengaturan/pemilik' && $page.url.pathname !== '/pos/bayar' && $page.url.pathname !== '/pengaturan/pemilik/gantikeamanan' && $page.url.pathname !== '/pengaturan/pemilik/manajemenmenu'}
	<div class="sticky bottom-0 z-30 bg-white">
		<BottomNav />
	</div>
{/if}



<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no" />
	<title>ZatiarasPOS</title>
</svelte:head>

<style>
@keyframes fade-in {
	from { opacity: 0; }
	to { opacity: 1; }
}
.animate-fade-in {
	animation: fade-in 0.4s ease;
}
</style>
