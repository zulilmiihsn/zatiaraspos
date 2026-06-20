<script lang="ts">
	import { slide } from 'svelte/transition';
	import { ImageOff, PackageOpen, RefreshCw } from 'lucide-svelte';

	let {
		posGridView,
		isLoadingProducts,
		skeletonCount = 4,
		filteredProducts = [],
		categories = [],
		imageError = {},
		loadError = '',
		onSelectProduct,
		onImgError,
		onRetry
	} = $props<{
		posGridView: boolean;
		isLoadingProducts: boolean;
		skeletonCount?: number;
		filteredProducts: any[];
		categories: any[];
		imageError: Record<string, boolean>;
		loadError?: string;
		onSelectProduct: (product: any) => void;
		onImgError: (id: string | number) => void;
		onRetry?: () => void;
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
							class="flex max-h-[80px] min-h-[56px] animate-pulse items-center justify-between rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 shadow-sm"
						></div>
					{/each}
				{:else if loadError}
					<div
						class="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50 px-5 py-12 text-center"
					>
						<RefreshCw class="mb-3 h-8 w-8 text-red-500" />
						<div class="mb-1 text-base font-semibold text-stone-900">Produk gagal dimuat</div>
						<div class="mb-4 max-w-xs text-sm text-stone-500">{loadError}</div>
						<button
							type="button"
							class="rounded-lg bg-[#b85c72] px-4 py-2 text-sm font-semibold text-white transition-transform duration-200 active:scale-[0.98]"
							onclick={() => onRetry?.()}>Coba lagi</button
						>
					</div>
				{:else if filteredProducts.length === 0}
					<div
						class="pointer-events-none flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center"
					>
						<PackageOpen class="mb-3 h-9 w-9 text-stone-400" />
						<div class="mb-1 text-base font-semibold text-stone-800">Menu belum tersedia</div>
						<div class="text-sm text-stone-500">Tambah menu atau ubah filter kategori.</div>
					</div>
				{:else}
					{#each filteredProducts as p}
						<div
							class="flex cursor-pointer items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm transition-all duration-200 hover:border-[#d4a0ad] hover:bg-[#fff8f9] active:scale-[0.98]"
							tabindex="0"
							onclick={() => onSelectProduct(p)}
							onkeydown={(e) => {
								if (e.key === 'Enter') onSelectProduct(p);
							}}
							role="button"
							aria-label="Tambah {p.name} ke keranjang"
						>
							<div class="flex min-w-0 flex-1 flex-col">
								<span class="mb-0.5 truncate text-sm font-semibold text-stone-900">{p.name}</span>
								<span class="mb-0.5 min-h-[18px] truncate text-xs text-stone-500"
									>{getKategoriNameById(p.kategori_id || '')}</span
								>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-base font-bold whitespace-nowrap text-[#b85c72]"
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
							class="flex aspect-[3/4] max-h-[260px] min-h-[140px] animate-pulse flex-col items-center justify-between rounded-xl border border-stone-200 bg-stone-100 p-2.5 shadow-sm md:max-h-[320px] md:min-h-[180px] md:p-6"
						></div>
					{/each}
				{:else if loadError}
					<div
						class="col-span-2 flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50 px-5 py-12 text-center md:col-span-3 lg:col-span-6"
					>
						<RefreshCw class="mb-3 h-9 w-9 text-red-500" />
						<div class="mb-1 text-base font-semibold text-stone-900">Produk gagal dimuat</div>
						<div class="mb-4 max-w-xs text-sm text-stone-500">{loadError}</div>
						<button
							type="button"
							class="rounded-lg bg-[#b85c72] px-4 py-2 text-sm font-semibold text-white transition-transform duration-200 active:scale-[0.98]"
							onclick={() => onRetry?.()}>Coba lagi</button
						>
					</div>
				{:else if filteredProducts.length === 0}
					<div
						class="pointer-events-none col-span-2 flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center md:col-span-3 lg:col-span-6"
					>
						<PackageOpen class="mb-3 h-10 w-10 text-stone-400" />
						<div class="mb-1 text-base font-semibold text-stone-800">Menu belum tersedia</div>
						<div class="text-sm text-stone-500">Tambah menu atau ubah filter kategori.</div>
					</div>
				{:else}
					{#each filteredProducts as p}
						<div
							class="flex aspect-[3/4] max-h-[260px] min-h-[140px] cursor-pointer flex-col items-center justify-between rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-[#d4a0ad] hover:shadow-md active:scale-[0.98] md:max-h-[320px] md:min-h-[180px] md:gap-3 md:rounded-2xl md:p-6"
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
									class="mb-2 aspect-square h-full min-h-[80px] w-full rounded-xl bg-stone-100 object-cover md:mb-3 md:rounded-2xl"
									src={p.gambar || p.image}
									alt={p.name}
									loading="lazy"
									onerror={() => onImgError(p.id)}
								/>
							{:else}
								<div
									class="mb-2 flex aspect-square min-h-[80px] w-full items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-stone-400 md:mb-3 md:rounded-2xl"
								>
									<ImageOff class="h-9 w-9" />
								</div>
							{/if}
							<div class="flex w-full flex-col items-center">
								<h3
									class="mb-0.5 w-full truncate text-center text-sm font-semibold text-stone-900 md:mb-1 md:text-lg"
								>
									{p.name}
								</h3>
								<span class="min-h-[18px] truncate text-xs text-stone-500 md:text-sm"
									>{getKategoriNameById(p.kategori_id || '')}</span
								>
								<div class="text-base font-bold text-[#b85c72] md:mt-1 md:text-xl">
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
