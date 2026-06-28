<script lang="ts">
	import { fade } from 'svelte/transition';
	import Utensils from 'lucide-svelte/icons/utensils';
	import Trash from 'lucide-svelte/icons/trash';
	import { formatRupiah } from '$lib/utils/currency';
	import type { Product, Category } from '$lib/types/product';

	let {
		searchKeyword = $bindable(),
		selectedKategori = $bindable(),
		isGridView = $bindable(),
		isLoadingKategori,
		isLoadingMenus,
		kategoriList,
		filteredMenus,
		openMenuForm,
		confirmDeleteMenu,
		handleImgError
	}: {
		searchKeyword: string;
		selectedKategori: string | number;
		isGridView: boolean;
		isLoadingKategori: boolean;
		isLoadingMenus: boolean;
		kategoriList: Category[];
		filteredMenus: Product[];
		openMenuForm: (menu?: Product | null) => void;
		confirmDeleteMenu: (id: string | number) => void;
		handleImgError: (menuId: string | number) => void;
	} = $props();
</script>

<div in:fade={{ duration: 150 }} class="flex min-h-0 flex-1 flex-col">
	<!-- Fixed Header Section -->
	<div class="flex-shrink-0 bg-white">
		<!-- Search Bar -->
		<div class="mx-auto max-w-4xl px-4 pb-2">
			<div class="relative flex items-center">
				<svg
					class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
					><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg
				>
				<input
					type="text"
					class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-10 text-base text-gray-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
					placeholder="Cari menu..."
					bind:value={searchKeyword}
				/>
			</div>
		</div>
		<!-- Header Daftar Menu -->
		<div class="mx-auto max-w-4xl px-4 pb-2">
			<h2 class="text-lg font-bold text-gray-800">Daftar Menu</h2>
		</div>
		<!-- Bar Filter Kategori (button group, horizontal scroll, seperti POS) -->
		<div class="mx-auto flex max-w-4xl items-center gap-2 px-4 pb-4">
			<button
				class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 border-pink-500 bg-pink-50 bg-white p-2 transition-colors hover:bg-gray-100"
				onclick={() => (isGridView = !isGridView)}
				aria-label={isGridView ? 'Tampilkan List' : 'Tampilkan Grid'}
			>
				{#if isGridView}
					<svg
						class="h-5 w-5 text-gray-600"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						transition:fade={{ duration: 120 }}
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 6h16M4 12h16M4 18h16"
						/></svg
					>
				{:else}
					<svg
						class="h-5 w-5 text-gray-600"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						transition:fade={{ duration: 120 }}
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
				{/if}
			</button>
			<div class="scrollbar-hide flex w-max items-center gap-2 overflow-x-auto">
				{#if isLoadingKategori}
					{#each Array(5) as _, i (i)}
						<div
							class="h-10 max-w-none animate-pulse rounded-lg bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 whitespace-nowrap"
							style="min-width:6rem;"
						></div>
					{/each}
				{:else}
					<button
						class="max-w-none rounded-lg border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all focus:outline-none {selectedKategori ===
						'Semua'
							? 'border-pink-500 bg-pink-500 text-white'
							: 'border-pink-200 bg-white text-pink-500'}"
						onclick={() => (selectedKategori = 'Semua')}>Semua</button
					>
					{#each kategoriList as kat (kat.id)}
						<button
							class="max-w-none rounded-lg border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all focus:outline-none {selectedKategori ==
							kat.id
								? 'border-pink-500 bg-pink-500 text-white'
								: 'border-pink-200 bg-white text-pink-500'}"
							onclick={() => (selectedKategori = kat.id)}>{kat.nama}</button
						>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- Scrollable Menu List -->
	<div class="flex-1 overflow-y-auto">
		<div class="mx-auto max-w-4xl px-4 pb-6">
			{#if isLoadingMenus}
				<div class="grid min-h-screen grid-cols-2 gap-3 pb-4">
					{#each Array(6) as _, i (i)}
						<div
							class="flex aspect-[3/4] max-h-[260px] min-h-[140px] w-full animate-pulse flex-col items-center justify-between rounded-xl border border-gray-100 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 shadow-md"
						>
							<div
								class="mb-2 aspect-square w-full rounded-lg border border-gray-100 bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100"
							></div>
							<div class="mb-1 h-4 w-full rounded bg-gray-200"></div>
							<div class="mb-1 h-3 w-2/3 rounded bg-gray-100"></div>
							<div class="h-3 w-1/2 rounded bg-gray-100"></div>
						</div>
					{/each}
				</div>
			{:else if filteredMenus.length === 0}
				<div
					class="pointer-events-none flex min-h-[50vh] flex-col items-center justify-center py-12 text-center"
				>
					<Utensils class="mb-4 h-14 w-14 text-pink-300" />
					<div class="mb-1 text-base font-semibold text-gray-700">Belum ada Menu</div>
					<div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
				</div>
			{:else if isGridView}
				<div
					class="grid grid-cols-2 gap-3 pb-4 md:mx-auto md:max-w-4xl md:grid-cols-3 md:gap-8"
					transition:fade={{ duration: 120 }}
				>
					{#each filteredMenus as menu (menu.id)}
						<div
							class="relative flex h-[260px] cursor-pointer flex-col rounded-xl border border-gray-100 bg-white p-4 shadow transition-shadow md:h-[300px] md:items-center md:justify-center md:gap-2 md:rounded-2xl md:p-6 md:text-base md:shadow-lg"
							role="button"
							tabindex="0"
							onclick={() => openMenuForm(menu)}
							onkeydown={(e) => e.key === 'Enter' && openMenuForm(menu)}
							onkeypress={(e) => e.key === 'Enter' && openMenuForm(menu)}
						>
							<!-- Tombol Delete floating di pojok kanan atas -->
							<div class="absolute top-2 right-2 z-10">
								<button
									class="rounded-full border border-red-200 bg-red-50 p-2 hover:bg-red-100"
									onclick={(e) => {
										e.stopPropagation();
										confirmDeleteMenu(menu.id);
									}}
									aria-label="Hapus Menu"
								>
									<Trash class="h-4 w-4 text-red-600 md:h-5 md:w-5" />
								</button>
							</div>
							<div class="flex h-full w-full flex-col items-center justify-center">
								<div class="mb-2 flex w-full flex-1 items-center justify-center">
									{#if menu.gambar}
										<img
											src={menu.gambar}
											alt={menu.nama}
											class="h-full w-full rounded-lg border border-gray-100 object-cover"
											onerror={() => handleImgError(menu.id)}
										/>
									{:else}
										<div
											class="flex h-full w-full items-center justify-center rounded-lg border border-gray-100 bg-pink-50/50"
										>
											<Utensils class="h-8 w-8 text-pink-300" />
										</div>
									{/if}
								</div>
								<div class="w-full flex-shrink-0 text-center">
									<div class="mb-1 truncate text-base font-semibold text-gray-800 md:text-base">
										{menu.nama}
									</div>
									<div class="mb-1 truncate text-xs text-gray-500 md:text-base">
										{kategoriList.find((k) => k.id === menu.kategori_id)?.nama || '-'}
									</div>
									<div class="text-xs font-bold text-pink-500 md:text-base">
										Rp {formatRupiah(menu.harga)}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex flex-col gap-2 px-0 pb-4" transition:fade={{ duration: 120 }}>
					{#each filteredMenus as menu (menu.id)}
						<div
							class="flex cursor-pointer items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md"
							role="button"
							tabindex="0"
							onclick={() => openMenuForm(menu)}
							onkeydown={(e) => e.key === 'Enter' && openMenuForm(menu)}
							onkeypress={(e) => e.key === 'Enter' && openMenuForm(menu)}
						>
							<div class="min-w-0 flex-1">
								<div class="mb-0.5 truncate text-base font-semibold text-gray-800">
									{menu.nama}
								</div>
								<div class="mb-0.5 truncate text-xs text-gray-500">
									{kategoriList.find((k) => k.id === menu.kategori_id)?.nama || '-'}
								</div>
								<div class="text-base font-bold text-pink-500">
									Rp {formatRupiah(menu.harga)}
								</div>
							</div>
							<div class="ml-2">
								<button
									class="rounded-full border border-red-200 bg-red-50 p-2 hover:bg-red-100"
									onclick={(e) => {
										e.stopPropagation();
										confirmDeleteMenu(menu.id);
									}}
									aria-label="Hapus Menu"
								>
									<Trash class="h-4 w-4 text-red-600" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
