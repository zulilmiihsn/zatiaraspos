<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { browser } from '$app/environment';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import Crown from 'lucide-svelte/icons/crown';
	import CreditCard from 'lucide-svelte/icons/credit-card';
	import User from 'lucide-svelte/icons/user';
	import { createPengaturanState } from '$lib/stores/pengaturanState.svelte';

	const s = createPengaturanState();

	onMount(async () => {
		await s.init();
	});
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
				<ArrowLeft class="h-5 w-5 text-gray-600" />
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
		{#if s.isLoading || !s.isProfileLoaded}
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
					{#if s.roleIcon}
						{@const RoleIcon = s.roleIcon}
						<RoleIcon class="h-8 w-8 text-white" />
					{:else}
						<div class="flex h-8 w-8 items-center justify-center">
							<span
								class="block h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
						</div>
					{/if}
				</div>
				{#if s.currentUserRole === 'admin' || s.currentUserRole === 'pemilik'}
					<div class="mb-1 text-2xl font-extrabold text-purple-700">Pemilik</div>
					<div class="mb-2 text-sm text-gray-600">Akses penuh ke seluruh sistem</div>
					<div class="mt-2 flex w-full items-center justify-between text-xs text-gray-500">
						<span>Login terakhir: {new Date().toLocaleString('id-ID')}</span>
						<span class="flex items-center gap-1"
							><span class="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>Session aktif</span
						>
					</div>
				{:else if s.currentUserRole === 'kasir'}
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
			{#if s.isLoading || !s.isProfileLoaded}
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
				<!-- Box Pemilik -->
				<button
					class="relative flex aspect-square min-h-[110px] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-purple-400 bg-gradient-to-br from-purple-500 to-pink-400 p-4 text-white shadow-lg transition-opacity duration-200 focus:outline-none {s.currentUserRole ===
						'admin' || s.currentUserRole === 'pemilik'
						? 'shimmer-highlight hover:scale-105'
						: ''} md:flex md:h-56 md:h-full md:w-full md:items-center md:justify-center md:gap-1 md:rounded-3xl md:p-8 md:shadow-xl md:transition-transform md:duration-200 md:hover:scale-105"
					onclick={() =>
						(s.currentUserRole === 'admin' || s.currentUserRole === 'pemilik') &&
						goto('/pengaturan/pemilik')}
					disabled={s.currentUserRole !== 'admin' && s.currentUserRole !== 'pemilik'}
					class:opacity-60={s.currentUserRole !== 'admin' && s.currentUserRole !== 'pemilik'}
					class:pointer-events-none={s.currentUserRole !== 'admin' &&
						s.currentUserRole !== 'pemilik'}
				>
					{#if Crown}
						<Crown class="mb-2 h-8 w-8" />
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
					onclick={s.handleInstallPWA}
				>
					{#if s.Download}
						{@const DownloadIcon = s.Download}
						<DownloadIcon class="mb-2 h-8 w-8 text-pink-500" />
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
					{#if s.Printer}
						{@const PrinterIcon = s.Printer}
						<PrinterIcon class="mb-2 h-8 w-8 text-blue-500" />
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
				<!-- Box Riwayat Transaksi -->
				<button
					class="flex aspect-square min-h-[110px] flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-4 shadow focus:outline-none md:flex md:h-56 md:h-full md:w-full md:items-center md:justify-center md:gap-1 md:rounded-3xl md:p-8 md:shadow-xl md:transition-transform md:duration-200 md:hover:scale-105"
					onclick={() => goto('/pengaturan/riwayat')}
				>
					{#if s.History}
						{@const HistoryIcon = s.History}
						<HistoryIcon class="mb-2 h-8 w-8 text-emerald-500" />
					{:else}
						<div class="mb-2 flex h-8 w-8 items-center justify-center">
							<span
								class="block h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-500"
							></span>
						</div>
					{/if}
					<div class="mb-1 text-lg font-bold text-emerald-700 md:mb-1 md:text-base">Riwayat</div>
					<span
						class="mb-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 md:mb-2 md:px-3 md:py-1 md:text-base"
						>Hari Ini</span
					>
					<div class="text-center text-xs text-gray-500 md:mt-1 md:mb-0 md:text-base">
						Lihat riwayat transaksi hari ini
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
					{#if s.LogOut}
						{@const LogOutIcon = s.LogOut}
						<LogOutIcon class="h-5 w-5 text-red-600" />
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
					onclick={s.handleLogout}
					class="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-medium text-white transition-colors hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
				>
					{#if s.LogOut}
						{@const LogOutIcon = s.LogOut}
						<LogOutIcon class="h-4 w-4" />
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
	{#if s.showLogoutModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div class="animate-slideUpModal w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
						{#if s.LogOut}
							{@const LogOutIcon = s.LogOut}
							<LogOutIcon class="h-5 w-5 text-red-600" />
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
						onclick={s.cancelLogout}
						class="flex-1 rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
					>
						Batal
					</button>
					<button
						onclick={s.confirmLogout}
						class="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600"
					>
						Keluar
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- PWA Installed Toast -->
	{#if s.showPwaInstalledToast}
		<div
			class="animate-fadeIn fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-white shadow-lg"
		>
			Aplikasi berhasil terpasang di Home Screen!
		</div>
	{/if}

	<!-- PWA Install Web Component (SSR-safe) -->
	{#if browser && s.isPwaLibraryLoaded}
		<pwa-install
			manifest-url="/manifest.webmanifest"
			name="Zatiaras POS"
			deskripsi="Install aplikasi ini untuk akses lebih cepat dan pengalaman lebih baik"
			icon="/img/192x192.png"
			manual-apple="true"
			manual-chrome="true"
			disable-install-deskripsi="false"
		></pwa-install>
	{/if}

	<!-- Custom styling for PWA install dialog -->
	<style>
		:global(pwa-install) {
			--pwa-install-dialog-header-color: #ffb6c1 !important;
			--header-color: #ffb6c1 !important;
		}
		:global(pwa-install::part(header)) {
			background-color: #ffb6c1 !important;
		}
	</style>

	{#if s.showNotification}
		<div
			class="fixed top-20 left-1/2 z-50 rounded-xl bg-yellow-500 px-6 py-3 text-center text-white shadow-lg transition-all duration-300 ease-out"
			style="transform: translateX(-50%);"
			in:fly={{ y: -32, duration: 300, easing: cubicOut }}
			out:fade={{ duration: 200 }}
		>
			{s.notificationMessage}
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
			rgba(255, 255, 255, 0.18) 50%,
			rgba(255, 255, 255, 0) 100%
		);
	}
</style>
