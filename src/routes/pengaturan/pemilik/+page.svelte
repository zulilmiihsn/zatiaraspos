<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import { userRole } from '$lib/stores/userRole';
	let Utensils: any, Shield: any;
	onMount(() => {
		userRole.subscribe((role) => {
			if (role !== 'pemilik') {
				goto('/unauthorized');
			}
		})();
	});
	onMount(async () => {
		Utensils = (await import('lucide-svelte/icons/utensils')).default;
		Shield = (await import('lucide-svelte/icons/shield')).default;
	});
</script>

<div class="page-content flex min-h-screen flex-col bg-gray-50">
	<!-- Header -->
	<div
		class="sticky top-0 z-40 flex w-full items-center justify-start border-b border-gray-200 bg-white px-4 py-4 shadow-sm"
	>
		<button
			onclick={() => goto('/pengaturan')}
			class="mr-2 rounded-xl bg-gray-100 p-2 transition-colors hover:bg-gray-200"
		>
			<svelte:component this={ArrowLeft} class="h-5 w-5 text-gray-600" />
		</button>
		<h1 class="text-xl font-bold text-gray-800">Pengaturan Draft Struk</h1>
	</div>

	<!-- Main Menu -->
	<div class="mx-auto max-w-lg px-4 py-2 md:mx-auto md:max-w-3xl md:py-8">
		<div class="grid w-full grid-cols-2 gap-2 md:grid-cols-3 md:gap-8">
			<a
				href="/pengaturan/pemilik/manajemenmenu"
				class="group flex flex-col justify-center rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:border-pink-300 hover:shadow-md md:h-48 md:items-center md:justify-center md:gap-3 md:rounded-2xl md:p-8 md:shadow-lg lg:text-base"
				style="text-decoration:none;"
			>
				<div class="mb-2 flex items-center gap-2 md:mb-2 md:gap-2">
					<svelte:component this={Utensils} class="h-5 w-5 text-pink-500 md:h-12 md:w-12" />
					<h3 class="text-sm font-semibold text-gray-800 lg:text-lg">Manajemen Menu</h3>
				</div>
				<p class="text-xs leading-tight text-gray-500 lg:text-sm">
					Kelola menu, kategori, dan ekstra toko
				</p>
			</a>
			<a
				href="/pengaturan/pemilik/gantikeamanan"
				class="group flex flex-col justify-center rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md md:h-48 md:items-center md:justify-center md:gap-3 md:rounded-2xl md:p-8 md:shadow-lg lg:text-base"
				style="text-decoration:none;"
			>
				<div class="mb-2 flex items-center gap-2 md:mb-2 md:gap-2">
					<svelte:component this={Shield} class="h-5 w-5 text-blue-500 md:h-12 md:w-12" />
					<h3 class="text-sm leading-tight font-semibold text-gray-800 lg:text-lg">
						Ganti Keamanan
					</h3>
				</div>
				<p class="text-xs leading-tight text-gray-500 lg:text-sm">
					Ubah password dan pengaturan keamanan
				</p>
			</a>
			<a
				href="/pengaturan/pemilik/riwayat"
				class="group flex flex-col justify-center rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:border-yellow-300 hover:shadow-md md:h-48 md:items-center md:justify-center md:gap-3 md:rounded-2xl md:p-8 md:shadow-lg lg:text-base"
				style="text-decoration:none;"
			>
				<div class="mb-2 flex items-center gap-2 md:mb-2 md:gap-2">
					<svg
						class="h-5 w-5 text-yellow-500 md:h-12 md:w-12"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/></svg
					>
					<h3 class="text-sm leading-tight font-semibold text-gray-800 lg:text-lg">
						Riwayat Transaksi
					</h3>
				</div>
				<p class="text-xs leading-tight text-gray-500 lg:text-sm">
					Lihat & hapus transaksi hari ini
				</p>
			</a>
			<div></div>
		</div>
	</div>
</div>
