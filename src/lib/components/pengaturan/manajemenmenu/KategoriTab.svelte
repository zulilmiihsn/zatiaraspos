<script lang="ts">
	import { fade } from 'svelte/transition';
	import FolderOpen from 'lucide-svelte/icons/folder-open';
	import Trash from 'lucide-svelte/icons/trash';
	import type { Product, Category } from '$lib/types/product';

	let {
		searchKategoriKeyword = $bindable(),
		isLoadingKategori,
		kategoriList,
		menus,
		openKategoriForm,
		confirmDeleteKategori
	}: {
		searchKategoriKeyword: string;
		isLoadingKategori: boolean;
		kategoriList: Category[];
		menus: Product[];
		openKategoriForm: (kat: Category | null) => void;
		confirmDeleteKategori: (id: string | number) => void;
	} = $props();
</script>

<div in:fade={{ duration: 150 }} class="flex min-h-0 flex-1 flex-col">
	<!-- Fixed Header Section -->
	<div class="flex-shrink-0 bg-white px-4">
		<!-- Search Bar -->
		<div class="relative mb-3 flex items-center">
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
				class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-10 text-base text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
				placeholder="Cari kategori..."
				bind:value={searchKategoriKeyword}
			/>
		</div>
		<!-- Header Daftar Kategori -->
		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-lg font-bold text-gray-800">Daftar Kategori</h2>
		</div>
	</div>

	<!-- Scrollable Kategori List -->
	<div class="flex-1 overflow-y-auto">
		<div class="px-4 pb-6">
			{#if isLoadingKategori}
				<div class="flex min-h-screen flex-col gap-2">
					{#each Array(4) as _, i}
						<div
							class="flex animate-pulse items-center justify-between rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100 px-4 py-3 shadow-md"
						></div>
					{/each}
				</div>
			{:else if kategoriList.length === 0}
				<div
					class="pointer-events-none flex min-h-[30vh] flex-col items-center justify-center py-12 text-center"
				>
					<svelte:component this={FolderOpen} class="mb-4 h-12 w-12 text-blue-300" />
					<div class="mb-1 text-base font-semibold text-gray-700">Belum ada Kategori</div>
					<div class="text-sm text-gray-400">Silakan tambahkan kategori terlebih dahulu.</div>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					{#each kategoriList.filter((kat) => kat.nama
							.toLowerCase()
							.includes(searchKategoriKeyword.trim().toLowerCase())) as kat}
						<div
							class="flex cursor-pointer items-center justify-between rounded-xl border border-blue-200 bg-blue-100 px-4 py-3 shadow-sm transition-all hover:bg-blue-200"
							role="button"
							tabindex="0"
							onclick={() => openKategoriForm(kat)}
							onkeydown={(e) => e.key === 'Enter' && openKategoriForm(kat)}
							onkeypress={(e) => e.key === 'Enter' && openKategoriForm(kat)}
						>
							<div class="flex flex-col">
								<span class="mb-0.5 truncate text-base font-semibold text-blue-900"
									>{kat.nama}</span
								>
								<span class="truncate text-xs text-blue-700"
									>{menus.filter((m) => m.kategori_id === kat.id).length} menu</span
								>
							</div>
							<div class="ml-2">
								<button
									class="rounded-full border border-red-200 bg-red-50 p-3 hover:bg-red-100"
									onclick={(e) => {
										e.stopPropagation();
										confirmDeleteKategori(kat.id);
									}}
									aria-label="Hapus Kategori"
								>
									<svelte:component this={Trash} class="h-5 w-5 text-red-600" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
