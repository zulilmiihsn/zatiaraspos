<script lang="ts">
	import '../app.css';
	import Topbar from '$lib/components/shared/topBar.svelte';
	import BottomNav from '$lib/components/shared/bottomNav.svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import Download from 'lucide-svelte/icons/download';
	import { posGridView } from '$lib/stores/posGridView.svelte';
	import { auth } from '$lib/auth/auth';
	import { userRole } from '$lib/stores/userRole.svelte';
	import { transactionService } from '$lib/services/transactionService';
	import PinModal from '$lib/components/shared/pinModal.svelte';
	import { securitySettings, setSecuritySettings } from '$lib/stores/securitySettings.svelte';
	import { requireAuth } from '$lib/utils/authGuard';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import WifiOff from 'lucide-svelte/icons/wifi-off';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { createLayoutState } from '$lib/stores/layoutState.svelte';

	let { children }: { children: Snippet } = $props();

	const layoutSt = createLayoutState();

	// ── Navigasi ──────────────────────────────────────────────────────────────
	let showNav = $state(true);
	$effect(() => {
		const path = $page.url.pathname;
		const noNavRoutes = ['/login', '/unauthorized', '/pos/bayar', '/offline'];
		showNav = !(noNavRoutes.includes(path) || path.startsWith('/pengaturan'));
	});

	// ── PIN Modal ─────────────────────────────────────────────────────────────
	let showPinModal = $state(false);
	let currentPin = $state('');
	let pinUnlockedForCurrentPage = false;
	let lastPath = '';
	let isLoadingSecuritySettings = false;

	async function loadKasirSecuritySettings() {
		if (isLoadingSecuritySettings) return;
		isLoadingSecuritySettings = true;
		try {
			const data = (await transactionService.getOne('pengaturan')) as {
				pin?: string;
				halaman_terkunci?: string[];
			} | null;
			if (data) {
				setSecuritySettings({ pin: data.pin || null, lockedPages: data.halaman_terkunci || [] });
			}
		} catch {
			// no-op
		} finally {
			isLoadingSecuritySettings = false;
		}
	}

	function mapLockedNameToPath(name: string): string {
		if (!name) return '';
		const lowered = name.toLowerCase();
		if (lowered === 'beranda' || lowered === 'home') return '/';
		return `/${lowered}`;
	}

	$effect(() => {
		if ($navigating) pinUnlockedForCurrentPage = false;
	});

	$effect(() => {
		if (!browser) return;
		const currentUserRole = userRole.value;
		const currentSecuritySettings = securitySettings.value;
		const currentPath = $page.url.pathname;
		if (currentUserRole === 'kasir' && (!currentSecuritySettings || !currentSecuritySettings.pin)) {
			void loadKasirSecuritySettings();
		}
		if (currentPath !== lastPath) {
			pinUnlockedForCurrentPage = false;
			lastPath = currentPath;
		}
		const isCurrentPageLocked =
			currentSecuritySettings?.lockedPages &&
			currentSecuritySettings.lockedPages.some((lockedPageName) => {
				const fullLockedPath = mapLockedNameToPath(lockedPageName);
				if (!fullLockedPath) return false;
				if (fullLockedPath === '/') return currentPath === '/';
				return currentPath === fullLockedPath || currentPath.startsWith(fullLockedPath + '/');
			});
		if (
			currentUserRole === 'kasir' &&
			isCurrentPageLocked &&
			!pinUnlockedForCurrentPage &&
			Boolean(currentSecuritySettings?.pin)
		) {
			showPinModal = true;
			currentPin = currentSecuritySettings?.pin || '';
		} else {
			showPinModal = false;
		}
	});

	function handlePinSuccess() {
		pinUnlockedForCurrentPage = true;
		showPinModal = false;
	}

	function handlePinError(_detail: { message: string }) {}

	function handlePinClose() {
		if (!pinUnlockedForCurrentPage) {
			auth.logout();
			goto('/login');
		}
	}

	onMount(async () => {
		await layoutSt.setupPwa();
		const publicRoutes = ['/login', '/offline', '/unauthorized'];
		if (!publicRoutes.includes($page.url.pathname) && !(await requireAuth())) return;
		layoutSt.setupWindowListeners();
	});
</script>

{#if layoutSt.pendingCount > 0}
	<div
		class="animate-fade-in fixed right-3 bottom-3 left-3 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-lg border border-stone-700 bg-[#282423] px-4 py-3 text-white shadow-xl"
	>
		{#if layoutSt.isOffline}
			<WifiOff class="h-5 w-5 shrink-0 text-amber-300" />
		{:else}
			<RefreshCw
				class="h-5 w-5 shrink-0 text-[#e6a8b7] {layoutSt.isPendingSyncing ? 'animate-spin' : ''}"
			/>
		{/if}
		<div class="min-w-0 flex-1">
			<div class="text-sm font-bold">{layoutSt.pendingCount} transaksi belum tersinkron</div>
			<div class="text-xs text-stone-300">
				{layoutSt.isOffline
					? 'Menunggu koneksi internet'
					: layoutSt.pendingFailedCount > 0
						? `${layoutSt.pendingFailedCount} transaksi perlu dicoba ulang`
						: layoutSt.isPendingSyncing
							? 'Sedang mengirim transaksi'
							: 'Siap dikirim'}
			</div>
		</div>
		<button
			type="button"
			class="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-stone-900 transition-transform duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
			disabled={layoutSt.isOffline || layoutSt.isPendingSyncing}
			onclick={layoutSt.retryPendingTransactions}
		>
			{layoutSt.isPendingSyncing ? 'Mengirim' : 'Sinkronkan'}
		</button>
	</div>
{/if}

{#if layoutSt.toastManager.showToast}
	<ToastNotification
		show={layoutSt.toastManager.showToast}
		message={layoutSt.toastManager.toastMessage}
		type={layoutSt.toastManager.toastType}
	/>
{/if}

<!-- PWA Update Notification -->
{#if layoutSt.showUpdateNotification}
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
				onclick={layoutSt.applyUpdate}
				class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-500 transition-colors hover:bg-blue-50"
			>
				Update Sekarang
			</button>
			<button
				onclick={layoutSt.dismissUpdate}
				class="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
			>
				Nanti
			</button>
		</div>
	</div>
{/if}

{#if showNav}
	<div class="page-transition flex min-h-[100dvh] flex-col bg-white">
		<div class="sticky top-0 z-30 bg-white shadow-md">
			<Topbar>
				{#snippet actions()}
					{#if $page.url.pathname === '/pos'}
						<button
							class="mr-2 flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 transition-colors hover:bg-pink-50"
							onclick={() => posGridView.toggle()}
							aria-label={posGridView.value ? 'Tampilkan List' : 'Tampilkan Grid'}
							type="button"
						>
							{#if posGridView.value}
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
				{/snippet}
				{#snippet download()}
					{#if $page.url.pathname === '/laporan'}
						<button
							class="mr-2 flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-gray-200 bg-white text-2xl text-pink-500 shadow-lg shadow-pink-500/7 transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12"
							aria-label="Download Laporan"
						>
							<Download size={22} />
						</button>
					{/if}
				{/snippet}
			</Topbar>
		</div>
		<div
			class="min-h-0 flex-1 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			{@render children()}
		</div>
		<div class="sticky bottom-0 z-30 bg-white">
			<BottomNav />
		</div>
	</div>
{:else}
	<div class="page-transition flex min-h-[100dvh] flex-col bg-white">
		<div class="min-h-0 flex-1 overflow-y-auto">
			{@render children()}
		</div>
	</div>
{/if}

{#if showPinModal}
	<PinModal
		show={showPinModal}
		pin={currentPin}
		title="Akses Terkunci"
		subtitle="Masukkan PIN untuk mengakses halaman ini"
		onSuccess={handlePinSuccess}
		onError={handlePinError}
		onClose={handlePinClose}
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
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.animate-fade-in { animation: fade-in 0.4s ease; }

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
	:global(input, textarea, [contenteditable]) {
		-webkit-user-select: text;
		-khtml-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;
		user-select: text;
	}
</style>
