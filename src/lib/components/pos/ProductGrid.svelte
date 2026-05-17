<script lang="ts">
	import { slide } from 'svelte/transition';

	let {
		posGridView,
		isLoadingProducts,
		skeletonCount = 4,
		filteredProducts = [],
		categories = [],
		imageError = {},
		onSelectProduct,
		onImgError
	} = $props<{
		posGridView: boolean;
		isLoadingProducts: boolean;
		skeletonCount?: number;
		filteredProducts: any[];
		categories: any[];
		imageError: Record<string, boolean>;
		onSelectProduct: (product: any) => void;
		onImgError: (id: string | number) => void;
	}>();

	// Helper untuk ambil nama kategori dari kategori_id
	function getKategoriNameById(id: string | number): string {
		if (!id) return '';
		const kat = categories?.find((k: any) => String(k.id) === String(id));
		return kat?.name || '';
	}
</script>

<div class="w-full max-w-full flex-1 px-0" style="min-height:0;">
	<div
		class="h-[calc(100vh-112px-48px)] overflow-y-auto md:h-[calc(100vh-128px-48px)] lg:h-[calc(100vh-160px-48px)]"
		style="scrollbar-width:none;-ms-overflow-style:none;"
	>
		{#if posGridView}
			<div class="flex min-h-[60vh] flex-col gap-1 px-4 pb-4" transition:slide={{ duration: 250 }}>
				{#if isLoadingProducts}
					{#each Array(skeletonCount) as _, i}
						<div
							class="flex max-h-[80px] min-h-[56px] animate-pulse cursor-pointer items-center justify-between rounded-lg border border-gray-100 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 px-3 py-2 shadow-md transition-shadow"
						></div>
					{/each}
				{:else if filteredProducts.length === 0}
					<div
						class="pointer-events-none flex min-h-[50vh] flex-col items-center justify-center py-12 text-center"
					>
						<div class="mb-2 text-6xl">🍽️</div>
						<div class="mb-1 text-base font-semibold text-gray-700">Belum ada Menu</div>
						<div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
					</div>
				{:else}
					{#each filteredProducts as p}
						<div
							class="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2 transition-colors hover:bg-pink-50"
							tabindex="0"
							onclick={() => onSelectProduct(p)}
							onkeydown={(e) => {
								if (e.key === 'Enter') onSelectProduct(p);
							}}
							role="button"
							aria-label="Tambah {p.name} ke keranjang"
						>
							<div class="flex min-w-0 flex-1 flex-col">
								<span class="mb-0.5 truncate text-sm font-medium text-gray-800">{p.name}</span>
								<span class="mb-0.5 min-h-[18px] truncate text-xs text-gray-400"
									>{getKategoriNameById(p.kategori_id || '')}</span
								>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-base font-bold whitespace-nowrap text-pink-500"
									>Rp {Number(p.price ?? p.harga ?? 0).toLocaleString('id-ID')}</span
								>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{:else}
			<div
				class="grid min-h-0 grid-cols-2 gap-3 px-4 pb-4 md:grid-cols-3 md:gap-6 md:px-8 md:pb-8 lg:grid-cols-6"
				transition:slide={{ duration: 250 }}
			>
				{#if isLoadingProducts}
					{#each Array(skeletonCount) as _, i}
						<div
							class="flex aspect-[3/4] max-h-[260px] min-h-[140px] animate-pulse cursor-pointer flex-col items-center justify-between rounded-xl border border-gray-100 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-2.5 shadow-md transition-shadow md:max-h-[320px] md:min-h-[180px] md:p-6"
						></div>
					{/each}
				{:else if filteredProducts.length === 0}
					<div
						class="pointer-events-none col-span-2 flex min-h-[50vh] flex-col items-center justify-center py-12 text-center md:col-span-3"
					>
						<div class="mb-2 text-6xl">🍽️</div>
						<div class="mb-1 text-base font-semibold text-gray-700">Belum ada Menu</div>
						<div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
					</div>
				{:else}
					{#each filteredProducts as p}
						<div
							class="flex aspect-[3/4] max-h-[260px] min-h-[140px] cursor-pointer flex-col items-center justify-between rounded-xl border border-gray-100 bg-white p-3 shadow-md transition-shadow md:max-h-[320px] md:min-h-[180px] md:gap-3 md:rounded-2xl md:p-6 md:hover:shadow-lg"
							tabindex="0"
							onclick={() => onSelectProduct(p)}
							onkeydown={(e) => {
								if (e.key === 'Enter') onSelectProduct(p);
							}}
							role="button"
							aria-label="Tambah {p.name} ke keranjang"
						>
							{#if (p.gambar || p.image) && !imageError[String(p.id)]}
								<img
									class="mb-2 aspect-square h-full min-h-[80px] w-full rounded-xl object-cover md:mb-3 md:rounded-2xl"
									src={p.gambar || p.image}
									alt={p.name}
									loading="lazy"
									onerror={() => onImgError(p.id)}
								/>
							{:else}
								<div
									class="mb-2 flex aspect-square min-h-[80px] w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 text-4xl md:mb-3 md:rounded-2xl md:text-5xl"
								>
									🍹
								</div>
							{/if}
							<div class="flex w-full flex-col items-center">
								<h3
									class="mb-0.5 w-full truncate text-center text-sm font-semibold text-gray-800 md:mb-1 md:text-lg"
								>
									{p.name}
								</h3>
								<span class="min-h-[18px] truncate text-xs text-gray-400 md:text-sm"
									>{getKategoriNameById(p.kategori_id || '')}</span
								>
								<div class="text-base font-bold text-pink-500 md:mt-1 md:text-xl">
									Rp {Number(p.price ?? p.harga ?? 0).toLocaleString('id-ID')}
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>
