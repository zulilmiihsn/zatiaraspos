<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth/auth';
	import { securityUtils } from '$lib/utils/security';
	import { getSupabaseClient } from '$lib/database/supabaseClient';
	import { userRole, setUserRole } from '$lib/stores/userRole';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { get as storeGet } from 'svelte/store';
	import { selectedBranch } from '$lib/stores/selectedBranch';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import Crown from 'lucide-svelte/icons/crown';
	import CreditCard from 'lucide-svelte/icons/credit-card';
	import User from 'lucide-svelte/icons/user';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { createToastManager, ErrorHandler } from '$lib/utils/index';

	// Type definitions
	interface PengaturanData {
		locked_pages?: string[];
		pin?: string;
	}

	let pengaturanData = null;

	// State untuk loading
	let isLoading = true;
	let isProfileLoaded = false;
	let isPengaturanLoaded = false;

	let currentUserRole = '';

	// Subscribe ke store
	userRole.subscribe((val) => (currentUserRole = val || ''));
	let showLogoutModal = false;
	let deferredPrompt: any = null;
	let canInstallPWA = false;
	let currentPage = 'security';

	// Removed showPinModal, pin, errorTimeout, isClosing
	let showPwaInstalledToast = false;
	let pwaStatus = '';
	let showPwaManualToast = false;
	let pengaturan: PengaturanData = { locked_pages: ['laporan', 'beranda'], pin: '1234' };

	let showNotification = false;
	let notificationMessage = '';
	let notificationTimeout: any = null;

	// Toast notification state
	let showToast = false;
	let toastMessage = '';
	let toastType: 'success' | 'error' | 'warning' | 'info' = 'success';

	function showToastNotification(
		message: string,
		type: 'success' | 'error' | 'warning' | 'info' = 'success'
	) {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}

	let LogOut: any,
		Shield: any,
		Palette: any,
		Database: any,
		HelpCircle: any,
		Settings: any,
		Bell: any,
		Download: any,
		Printer: any;

	function showNotif(message: string) {
		notificationMessage = message;
		showNotification = true;
		clearTimeout(notificationTimeout);
		notificationTimeout = setTimeout(() => {
			showNotification = false;
		}, 3000);
	}

	async function fetchPengaturan() {
		const { data, error } = await getSupabaseClient(storeGet(selectedBranch))
			.from('pengaturan')
			.select('locked_pages, pin')
			.eq('id', 1)
			.single();
		pengaturanData = !error ? data : null;
	}

	onMount(async () => {
		try {
			// Hapus query profile dari Supabase, gunakan store
			// const { data: { session } } = await supabase.auth.getSession();
			// const userId = session?.user?.id;
			//
			// if (userId) {
			//   const { data: profile, error } = await supabase
			//     .from('profil')
			//     .select('role, username')
			//     .eq('id', userId)
			//     .single();
			//   userRole = profile?.role || '';
			//   userName = profile?.username || '';
			// }

			// Jika role belum ada di store, coba validasi dengan Supabase
			if (!currentUserRole) {
				const {
					data: { session }
				} = await getSupabaseClient(storeGet(selectedBranch)).auth.getSession();
				if (session?.user) {
					const { data: profile } = await getSupabaseClient(storeGet(selectedBranch))
						.from('profil')
						.select('role, username')
						.eq('id', session.user.id)
						.single();
					if (profile) {
						setUserRole(profile.role, profile);
					}
				}
			}

			isProfileLoaded = true;

			// Setup PWA detection
			if (typeof window !== 'undefined') {
				const ua = window.navigator.userAgent.toLowerCase();
				const isIOS = /iphone|ipad|ipod/.test(ua);
				const isInStandaloneMode = 'standalone' in window.navigator && window.navigator.standalone;
				if (isIOS && !isInStandaloneMode) {
					pwaStatus = 'Untuk install, buka menu Share lalu pilih "Add to Home Screen"';
					canInstallPWA = false;
				} else if ('serviceWorker' in navigator) {
					window.addEventListener('beforeinstallprompt', (e) => {
						e.preventDefault();
						deferredPrompt = e;
						canInstallPWA = true;
						pwaStatus = '';
					});
					if (window.matchMedia('(display-mode: standalone)').matches) {
						pwaStatus = 'PWA sudah terpasang';
						canInstallPWA = false;
					}
				} else {
					pwaStatus = 'Browser tidak mendukung PWA';
					canInstallPWA = false;
				}
				window.addEventListener('appinstalled', () => {
					showPwaInstalledToast = true;
					canInstallPWA = false;
					pwaStatus = 'PWA sudah terpasang';
					setTimeout(() => (showPwaInstalledToast = false), 4000);
				});
			}

			// Removed locked_pages check for kasir role

			// Set loading selesai
			isLoading = false;

			// Load icons
			LogOut = (await import('lucide-svelte/icons/log-out')).default;
			Shield = (await import('lucide-svelte/icons/shield')).default;
			Palette = (await import('lucide-svelte/icons/palette')).default;
			Database = (await import('lucide-svelte/icons/database')).default;
			HelpCircle = (await import('lucide-svelte/icons/help-circle')).default;
			Settings = (await import('lucide-svelte/icons/settings')).default;
			Bell = (await import('lucide-svelte/icons/bell')).default;
			Download = (await import('lucide-svelte/icons/download')).default;
			Printer = (await import('lucide-svelte/icons/printer')).default;
		} catch (error) {
			ErrorHandler.logError(error, 'loadPengaturanPage');
			// toastManager.showToastNotification('Gagal memuat halaman pengaturan', 'error');
		}
	});

	function handleLogout() {
		showLogoutModal = true;
	}

	function confirmLogout() {
		// SecurityMiddleware.logSecurityEvent('user_logout', {
		//   user: currentUserRole,
		//   from: 'settings_page'
		// });
		auth.logout();
		goto('/login');
	}

	function cancelLogout() {
		showLogoutModal = false;
	}

	function getRoleIcon() {
		if (currentUserRole === 'admin' || currentUserRole === 'pemilik') return Crown;
		if (currentUserRole === 'kasir') return CreditCard;
		return User;
	}

	function getRoleLabel() {
		if (currentUserRole === 'admin' || currentUserRole === 'pemilik') return 'Pemilik';
		if (currentUserRole === 'kasir') return 'Kasir';
		return 'User';
	}

	function getRoleDesc() {
		if (currentUserRole === 'admin' || currentUserRole === 'pemilik')
			return 'Akses penuh ke seluruh sistem';
		if (currentUserRole === 'kasir') return 'Akses standar';
		return 'Akses standar';
	}

	function getRoleColor() {
		if (currentUserRole === 'admin' || currentUserRole === 'pemilik') {
			return 'from-purple-500 to-pink-500';
		} else if (currentUserRole === 'kasir') {
			return 'from-green-500 to-blue-500';
		}
		return 'from-gray-500 to-gray-600';
	}

	function getRoleBadgeColor() {
		if (currentUserRole === 'admin' || currentUserRole === 'pemilik') {
			return 'bg-purple-100 text-purple-800';
		} else if (currentUserRole === 'kasir') {
			return 'bg-green-100 text-green-800';
		}
		return 'bg-gray-100 text-gray-800';
	}

	function getRoleDescription() {
		if (currentUserRole === 'admin' || currentUserRole === 'pemilik') {
			return 'Akses penuh ke semua fitur sistem';
		} else if (currentUserRole === 'kasir') {
			return 'Akses terbatas untuk POS dan laporan';
		}
		return 'Akses standar';
	}

	function handleInstallPWA() {
		if (deferredPrompt) {
			deferredPrompt.prompt();
			deferredPrompt.userChoice.then((choiceResult: any) => {
				if (choiceResult.outcome === 'accepted') {
					showPwaInstalledToast = true;
					setTimeout(() => (showPwaInstalledToast = false), 4000);
				} else {
					showPwaManualToast = true;
					pwaStatus = 'Pemasangan aplikasi dibatalkan.';
					setTimeout(() => (showPwaManualToast = false), 4000);
				}
				deferredPrompt = null;
				canInstallPWA = false;
				pwaStatus = 'PWA sudah terpasang';
			});
		} else {
			// Tampilkan instruksi manual
			const ua = window.navigator.userAgent.toLowerCase();
			const isIOS = /iphone|ipad|ipod/.test(ua);
			if (isIOS) {
				pwaStatus = 'Untuk install, buka menu Share lalu pilih "Add to Home Screen".';
			} else {
				pwaStatus = 'Silakan install melalui menu browser (ikon titik tiga > Install App).';
			}
			showPwaManualToast = true;
			setTimeout(() => (showPwaManualToast = false), 4000);
		}
	}

	const settingsSections = [
		{
			title: 'Akun & Keamanan',
			icon: Shield,
			items: [
				{
					label: 'Profil Pengguna',
					icon: User,
					action: () => showNotif('Fitur profil belum tersedia')
				},
				{
					label: 'Ubah Password',
					icon: Shield,
					action: () => showNotif('Fitur ubah password belum tersedia')
				},
				{
					label: 'Riwayat Login',
					icon: Bell,
					action: () => showNotif('Fitur riwayat login belum tersedia')
				}
			]
		},
		{
			title: 'Tampilan & Tema',
			icon: Palette,
			items: [
				{
					label: 'Tema Aplikasi',
					icon: Palette,
					action: () => showNotif('Fitur tema belum tersedia')
				},
				{
					label: 'Ukuran Font',
					icon: Settings,
					action: () => showNotif('Fitur ukuran font belum tersedia')
				},
				{
					label: 'Animasi',
					icon: Settings,
					action: () => showNotif('Fitur animasi belum tersedia')
				}
			]
		},
		{
			title: 'Data & Backup',
			icon: Database,
			items: [
				{
					label: 'Export Data',
					icon: Database,
					action: () => showNotif('Fitur export data belum tersedia')
				},
				{
					label: 'Import Data',
					icon: Database,
					action: () => showNotif('Fitur import data belum tersedia')
				},
				{
					label: 'Backup Otomatis',
					icon: Settings,
					action: () => showNotif('Fitur backup belum tersedia')
				}
			]
		},
		{
			title: 'Bantuan & Dukungan',
			icon: HelpCircle,
			items: [
				{
					label: 'Panduan Penggunaan',
					icon: HelpCircle,
					action: () => showNotif('Panduan belum tersedia')
				},
				{ label: 'Hubungi Support', icon: Bell, action: () => showNotif('Support belum tersedia') },
				{
					label: 'Tentang Aplikasi',
					icon: Settings,
					action: () => showNotif('Versi 1.0.0 - Zatiaras Juice POS')
				}
			]
		}
	];

	// Filter sections based on user role
	$: filteredSections =
		currentUserRole === 'admin' || currentUserRole === 'pemilik'
			? settingsSections
			: settingsSections.filter((section) => section.title !== 'Data & Backup');

	// Get role icon once and store it
	$: roleIcon = getRoleIcon();

	// Tambahkan fungsi upload gambar menu ke bucket 'gambar-menu' Supabase Storage
	async function uploadMenuImage(file: File, menuId: string) {
		const ext = file.name.split('.').pop();
		const filePath = `menu-${menuId}-${Date.now()}.${ext}`;
		// Upload ke bucket 'gambar-menu'
		const { data, error } = await getSupabaseClient(storeGet(selectedBranch))
			.storage.from('gambar-menu')
			.upload(filePath, file, { upsert: true });
		if (error) throw error;
		// Dapatkan public URL
		const { data: publicUrlData } = getSupabaseClient(storeGet(selectedBranch))
			.storage.from('gambar-menu')
			.getPublicUrl(filePath);
		return publicUrlData.publicUrl;
	}
</script>

<div class="page-content flex min-h-screen flex-col bg-gray-50">
	<!-- Button Kembali -->
	<div
		class="sticky top-0 z-30 mx-0 mt-0 mb-2 flex items-center border-b border-gray-100 bg-gray-50/95 px-4 py-3 shadow-md backdrop-blur-lg"
		style="min-height:56px"
	>
		<button
			onclick={() => goto('/')}
			class="rounded-xl bg-gray-100 p-2 transition-colors hover:bg-gray-200"
		>
			{#if ArrowLeft}
				<svelte:component this={ArrowLeft} class="h-5 w-5 text-gray-600" />
			{:else}
				<div class="flex h-5 w-5 items-center justify-center">
					<span
						class="block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
					></span>
				</div>
			{/if}
		</button>
	</div>
	<!-- Grid Menu Pengaturan -->
	<div class="mt-0 flex flex-1 flex-col items-center justify-center px-4 md:justify-start md:px-0">
		<!-- Box Informasi Role -->
		{#if isLoading || !isProfileLoaded}
			<div
				class="mb-2 flex w-full max-w-4xl animate-pulse flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:mx-auto"
			>
				<div class="mb-2 h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100"></div>
				<div class="mb-1 h-6 w-24 rounded bg-gray-200"></div>
				<div class="mb-2 h-4 w-32 rounded bg-gray-100"></div>
				<div class="mt-2 flex w-full items-center justify-between text-xs text-gray-300">
					<div class="h-3 w-1/3 rounded bg-gray-100"></div>
					<div class="h-3 w-1/4 rounded bg-gray-100"></div>
				</div>
				<div class="h-2 w-full"></div>
			</div>
		{:else}
			<div
				class="mb-2 flex w-full max-w-4xl flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:mx-auto"
			>
				<div
					class="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 shadow-lg"
				>
					{#if roleIcon}
						<svelte:component this={roleIcon} class="h-8 w-8 text-white" />
					{:else}
						<div class="flex h-8 w-8 items-center justify-center">
							<span
								class="block h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
						</div>
					{/if}
				</div>
				{#if currentUserRole === 'admin' || currentUserRole === 'pemilik'}
					<div class="mb-1 text-2xl font-extrabold text-purple-700">Pemilik</div>
					<div class="mb-2 text-sm text-gray-600">Akses penuh ke seluruh sistem</div>
					<div class="mt-2 flex w-full items-center justify-between text-xs text-gray-500">
						<span>Login terakhir: {new Date().toLocaleString('id-ID')}</span>
						<span class="flex items-center gap-1"
							><span class="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>Session aktif</span
						>
					</div>
				{:else if currentUserRole === 'kasir'}
					<div class="mb-1 text-2xl font-extrabold text-green-700">Kasir</div>
					<div class="mb-2 text-sm text-gray-600">Akses standar</div>
					<div class="mt-2 flex w-full items-center justify-between text-xs text-gray-500">
						<span>Login terakhir: {new Date().toLocaleString('id-ID')}</span>
						<span class="flex items-center gap-1"
							><span class="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>Session aktif</span
						>
					</div>
				{/if}
			</div>
		{/if}

		<div
			class="mt-2 grid w-full max-w-md grid-cols-2 gap-4 md:mx-auto md:mt-4 md:max-w-4xl md:grid-cols-3 md:gap-8 md:py-8"
		>
			{#if isLoading || !isProfileLoaded}
				{#each Array(4) as _, i}
					<div
						class="flex aspect-square min-h-[110px] animate-pulse flex-col items-center justify-center rounded-xl border-2 border-gray-100 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 shadow-lg"
					>
						<div
							class="mb-2 h-8 w-8 rounded-lg bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100"
						></div>
						<div class="mb-2 h-4 w-2/3 rounded bg-gray-200"></div>
						<div class="h-3 w-1/2 rounded bg-gray-100"></div>
					</div>
				{/each}
			{:else}
				<!-- Box Pemilik (selalu tampil, disable jika bukan admin/pemilik) -->
				<button
					class="relative flex aspect-square min-h-[110px] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-purple-400 bg-gradient-to-br from-purple-500 to-pink-400 p-4 text-white shadow-lg transition-opacity duration-200 focus:outline-none {currentUserRole ===
						'admin' || currentUserRole === 'pemilik'
						? 'shimmer-highlight hover:scale-105'
						: ''} md:flex md:h-56 md:h-full md:w-full md:items-center md:justify-center md:gap-1 md:rounded-3xl md:p-8 md:shadow-xl md:transition-transform md:duration-200 md:hover:scale-105"
					onclick={() =>
						(currentUserRole === 'admin' || currentUserRole === 'pemilik') &&
						goto('/pengaturan/pemilik')}
					disabled={currentUserRole !== 'admin' && currentUserRole !== 'pemilik'}
					class:opacity-60={currentUserRole !== 'admin' && currentUserRole !== 'pemilik'}
					class:pointer-events-none={currentUserRole !== 'admin' && currentUserRole !== 'pemilik'}
				>
					{#if Crown}
						<svelte:component this={Crown} class="mb-2 h-8 w-8" />
					{:else}
						<div class="mb-2 flex h-8 w-8 items-center justify-center">
							<span
								class="block h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
						</div>
					{/if}
					<div class="mb-1 text-lg font-bold md:mb-1 md:text-base">Pemilik</div>
					<span
						class="mb-2 inline-block rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold md:mb-2 md:px-3 md:py-1 md:text-base"
						>Privileged</span
					>
					<div class="text-center text-xs text-white/80 md:mt-1 md:mb-0 md:text-base">
						Akses penuh ke seluruh sistem
					</div>
				</button>
				<!-- Box Install PWA -->
				<button
					class="flex aspect-square min-h-[110px] flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-4 shadow focus:outline-none md:flex md:h-56 md:h-full md:w-full md:items-center md:justify-center md:gap-1 md:rounded-3xl md:p-8 md:shadow-xl md:transition-transform md:duration-200 md:hover:scale-105"
					onclick={handleInstallPWA}
				>
					{#if Download}
						<svelte:component this={Download} class="mb-2 h-8 w-8 text-pink-500" />
					{:else}
						<div class="mb-2 flex h-8 w-8 items-center justify-center">
							<span
								class="block h-6 w-6 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500"
							></span>
						</div>
					{/if}
					<div class="mb-1 text-lg font-bold text-pink-500 md:mb-1 md:text-base">Install PWA</div>
					<span
						class="mb-2 inline-block rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-700 md:mb-2 md:px-3 md:py-1 md:text-base"
						>Aplikasi</span
					>
					<div class="text-center text-xs text-gray-500 md:mt-1 md:mb-0 md:text-base">
						Pasang ke Home Screen
					</div>
				</button>
				<!-- Box Printer (Draft Struk) -->
				<button
					class="flex aspect-square min-h-[110px] flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-4 shadow focus:outline-none md:flex md:h-56 md:h-full md:w-full md:items-center md:justify-center md:gap-1 md:rounded-3xl md:p-8 md:shadow-xl md:transition-transform md:duration-200 md:hover:scale-105"
					onclick={() => goto('/pengaturan/printer')}
				>
					{#if Printer}
						<svelte:component this={Printer} class="mb-2 h-8 w-8 text-blue-500" />
					{:else}
						<div class="mb-2 flex h-8 w-8 items-center justify-center">
							<span
								class="block h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500"
							></span>
						</div>
					{/if}
					<div class="mb-1 text-lg font-bold text-blue-700 md:mb-1 md:text-base">Draft Struk</div>
					<span
						class="mb-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 md:mb-2 md:px-3 md:py-1 md:text-base"
						>Struk</span
					>
					<div class="text-center text-xs text-gray-500 md:mt-1 md:mb-0 md:text-base">
						Atur tampilan dan informasi draft struk
					</div>
				</button>
			{/if}
		</div>

		<!-- Logout Section -->
		<div
			class="mt-4 mb-6 w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:mx-auto"
		>
			<div class="border-b border-red-200 bg-red-50 px-6 py-4">
				<div class="flex items-center gap-3">
					{#if LogOut}
						<svelte:component this={LogOut} class="h-5 w-5 text-red-600" />
					{:else}
						<div class="flex h-5 w-5 items-center justify-center">
							<span
								class="block h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600"
							></span>
						</div>
					{/if}
					<h3 class="font-semibold text-red-800">Keluar dari Sistem</h3>
				</div>
			</div>
			<div class="p-6">
				<p class="mb-4 text-sm text-gray-600">
					Anda akan keluar dari sistem dan harus login kembali untuk mengakses aplikasi.
				</p>
				<button
					onclick={handleLogout}
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-medium text-white transition-colors hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
				>
					{#if LogOut}
						<svelte:component this={LogOut} class="h-4 w-4" />
					{:else}
						<div class="flex h-4 w-4 items-center justify-center">
							<span
								class="block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
						</div>
					{/if}
					Keluar dari Sistem
				</button>
			</div>
		</div>
	</div>

	<!-- Logout Confirmation Modal -->
	{#if showLogoutModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div class="animate-slideUpModal w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
						{#if LogOut}
							<svelte:component this={LogOut} class="h-5 w-5 text-red-600" />
						{:else}
							<div class="flex h-5 w-5 items-center justify-center">
								<span
									class="block h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600"
								></span>
							</div>
						{/if}
					</div>
					<div>
						<h3 class="font-semibold text-gray-800">Konfirmasi Logout</h3>
						<p class="text-sm text-gray-600">Apakah Anda yakin ingin keluar?</p>
					</div>
				</div>
				<div class="flex gap-3">
					<button
						onclick={cancelLogout}
						class="flex-1 rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
					>
						Batal
					</button>
					<button
						onclick={confirmLogout}
						class="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600"
					>
						Keluar
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- PWA Installed Toast -->
	{#if showPwaInstalledToast}
		<div
			class="animate-fadeIn fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-white shadow-lg"
		>
			Aplikasi berhasil terpasang di Home Screen!
		</div>
	{/if}

	<!-- Modal instruksi install PWA -->
	{#if showPwaManualToast}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div class="animate-slideUpModal mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
				<div class="flex flex-col items-center">
					{#if Settings}
						<svelte:component this={Settings} class="mb-2 h-8 w-8 text-pink-500" />
					{/if}
					<h3 class="mb-2 text-lg font-bold text-pink-600">Cara Install Aplikasi</h3>
					<p class="mb-4 text-center text-sm text-gray-600">{pwaStatus}</p>
					<button
						class="mt-2 w-full rounded-xl bg-pink-500 py-3 font-bold text-white"
						onclick={() => (showPwaManualToast = false)}>Tutup</button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if showNotification}
		<div
			class="fixed top-20 left-1/2 z-50 rounded-xl bg-yellow-500 px-6 py-3 text-center text-white shadow-lg transition-all duration-300 ease-out"
			style="transform: translateX(-50%);"
			in:fly={{ y: -32, duration: 300, easing: cubicOut }}
			out:fade={{ duration: 200 }}
		>
			{notificationMessage}
		</div>
	{/if}
</div>

<!-- App Info -->
<div class="py-4 text-center">
	<p class="text-xs text-gray-500">ZatiarasPOS v1.0</p>
	<p class="mt-1 text-xs text-gray-400">© 2024 Zatiaras Juice.</p>
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fadeIn {
		animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}
	@keyframes slideUpModal {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	.animate-slideUpModal {
		animation: slideUpModal 0.32s cubic-bezier(0.4, 0, 0.2, 1);
	}
	@keyframes shimmer {
		0% {
			background-position: -200px 0;
		}
		100% {
			background-position: 200px 0;
		}
	}
	.shimmer-highlight::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0.18) 50%,
			rgba(255, 255, 255, 0) 100%
		);
		background-size: 200px 100%;
		animation: shimmer 1.2s infinite;
		pointer-events: none;
		border-radius: 1rem;
	}
	.shimmer-highlight:hover::after {
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0.28) 50%,
			rgba(255, 255, 255, 0) 100%
		);
	}
</style>
