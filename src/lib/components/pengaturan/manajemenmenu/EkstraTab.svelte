<script lang="ts">
	import { fade } from 'svelte/transition';
	import PlusCircle from 'lucide-svelte/icons/plus-circle';
	import Trash from 'lucide-svelte/icons/trash';
	import { formatRupiah } from '$lib/utils/currency';
	import type { AddOn } from '$lib/types/product';

	let {
		searchEkstra = $bindable(),
		isLoadingEkstra,
		ekstraList,
		openEkstraForm,
		confirmDeleteEkstra
	}: {
		searchEkstra: string;
		isLoadingEkstra: boolean;
		ekstraList: (AddOn & { harga: number })[];
		openEkstraForm: (ekstra?: (AddOn & { harga: number }) | null) => void;
		confirmDeleteEkstra: (id: string | number) => void;
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
				class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-10 text-base text-gray-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
				placeholder="Cari tambahan..."
				bind:value={searchEkstra}
			/>
		</div>
		<!-- Header Daftar Tambahan -->
		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-lg font-bold text-gray-800">Daftar Tambahan</h2>
		</div>
	</div>

	<!-- Scrollable Tambahan List -->
	<div class="flex-1 overflow-y-auto">
		<div class="px-4 pb-6">
			{#if isLoadingEkstra}
				<div class="flex min-h-screen flex-col gap-2">
					{#each Array(4) as _, i}
						<div
							class="flex animate-pulse items-center justify-between rounded-xl border border-green-200 bg-gradient-to-br from-green-50 via-purple-50 to-green-100 px-4 py-3 shadow-md"
						></div>
					{/each}
				</div>
			{:else if ekstraList.length === 0}
				<div
					class="pointer-events-none flex min-h-[30vh] flex-col items-center justify-center py-12 text-center"
				>
					<svelte:component this={PlusCircle} class="mb-4 h-12 w-12 text-green-300" />
					<div class="mb-1 text-base font-semibold text-gray-700">Belum ada Tambahan</div>
					<div class="text-sm text-gray-400">Silakan tambahkan tambahan terlebih dahulu.</div>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					{#each ekstraList.filter((ekstra) => ekstra.nama
							.toLowerCase()
							.includes(searchEkstra.trim().toLowerCase())) as ekstra}
						<div
							class="flex cursor-pointer items-center justify-between rounded-xl border border-green-200 bg-green-100 px-4 py-3 shadow-sm transition-all hover:bg-green-200"
							role="button"
							tabindex="0"
							onclick={() => openEkstraForm(ekstra)}
							onkeydown={(e) => e.key === 'Enter' && openEkstraForm(ekstra)}
							onkeypress={(e) => e.key === 'Enter' && openEkstraForm(ekstra)}
						>
							<div class="flex flex-col">
								<span class="mb-0.5 truncate text-base font-semibold text-green-900"
									>{ekstra.nama}</span
								>
								<span class="truncate text-xs text-green-700"
									>Rp {formatRupiah(ekstra.harga)}</span
								>
							</div>
							<div class="ml-2">
								<button
									class="rounded-full border border-red-200 bg-red-50 p-3 hover:bg-red-100"
									onclick={(e) => {
										e.stopPropagation();
										confirmDeleteEkstra(ekstra.id);
									}}
									aria-label="Hapus Tambahan"
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
