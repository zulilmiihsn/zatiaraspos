<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { BukuKasRecord } from '$lib/types/laporan';
	import { formatRupiah } from '$lib/utils/currency';

	let {
		isLoadingReport,
		totalQrisPemasukan,
		totalTunaiPemasukan,
		totalQrisPengeluaran,
		totalTunaiPengeluaran,
		pemasukanUsahaQris,
		pemasukanUsahaTunai,
		pemasukanLainQris,
		pemasukanLainTunai,
		bebanUsahaQris,
		bebanUsahaTunai,
		bebanLainQris,
		bebanLainTunai
	}: {
		isLoadingReport: boolean;
		totalQrisPemasukan: number;
		totalTunaiPemasukan: number;
		totalQrisPengeluaran: number;
		totalTunaiPengeluaran: number;
		pemasukanUsahaQris: BukuKasRecord[];
		pemasukanUsahaTunai: BukuKasRecord[];
		pemasukanLainQris: BukuKasRecord[];
		pemasukanLainTunai: BukuKasRecord[];
		bebanUsahaQris: BukuKasRecord[];
		bebanUsahaTunai: BukuKasRecord[];
		bebanLainQris: BukuKasRecord[];
		bebanLainTunai: BukuKasRecord[];
	} = $props();

	// Local states for accordions
	let showPemasukan = $state(true);
	let showPendapatanUsaha = $state(true);
	let showPemasukanLain = $state(true);
	let showPengeluaran = $state(true);
	let showBebanUsaha = $state(true);
	let showBebanLain = $state(true);

	// Track expanded items
	let expandedItems = $state(new Set<string>());

	function toggleExpand(name: string) {
		if (expandedItems.has(name)) {
			expandedItems.delete(name);
		} else {
			expandedItems.add(name);
		}
		expandedItems = new Set(expandedItems);
	}

	function groupAndSumByName(items: BukuKasRecord[]): { nama: string; total: number }[] {
		if (!items || items.length === 0) return [];
		const groups = items.reduce((acc: Record<string, number>, item) => {
			const name = item.deskripsi?.trim() || item.catatan?.trim() || 'Lain-lain';
			acc[name] = (acc[name] || 0) + (item.nominal || 0);
			return acc;
		}, {});
		return Object.entries(groups).map(([name, total]) => ({ nama: name, total }));
	}
</script>

{#snippet accordionGroup(
	judul: string,
	show: boolean,
	toggle: () => void,
	qrisData: BukuKasRecord[],
	tunaiData: BukuKasRecord[],
	isFirst: boolean
)}
	<button
		class="{isFirst
			? 'mb-0.5 md:mb-1'
			: 'mt-2 mb-0.5 md:mt-3 md:mb-1'} flex w-full items-center justify-between px-4 py-1 text-sm font-semibold text-gray-700 md:px-6 md:py-2 md:text-base"
		onclick={toggle}
	>
		<span>{judul}</span>
		<svg class="ml-2 h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20">
			<polygon
				points="5,8 10,13 15,8"
				fill="currentColor"
				style="transform:rotate({show ? 0 : 180}deg);transform-origin:center"
			/>
		</svg>
	</button>
	{#if show}
		<div
			class="flex flex-col gap-1 px-4 pt-0.5 pb-1 md:gap-2 md:px-6 md:pt-1 md:pb-2"
			transition:slide|local
		>
			<div class="mt-1 mb-1 text-xs font-semibold text-pink-500 md:mt-2 md:mb-2 md:text-sm">
				QRIS
			</div>
			<ul class="flex flex-col gap-0.5 md:gap-1">
				{#if qrisData.length === 0}
					<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">Tidak ada data</li>
				{/if}
				{#each groupAndSumByName(qrisData).sort((a, b) => b.total - a.total) as grouped}
						<li class="flex justify-between text-sm text-gray-600 md:text-base">
							<span
								class="{expandedItems.has(grouped.nama)
									? ''
									: 'max-w-[60%] truncate'} cursor-pointer"
								title={grouped.nama}
								onclick={() => toggleExpand(grouped.nama)}
								onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.nama)}
								role="button"
								tabindex="0">{grouped.nama}</span>
							<span class="font-bold whitespace-nowrap text-gray-700"
								>Rp {formatRupiah(grouped.total)}</span>
						</li>
					{/each}
			</ul>
			<div class="mt-2 mb-1 text-xs font-semibold text-pink-500 md:mt-3 md:mb-2 md:text-sm">
				Tunai
			</div>
			<ul class="flex flex-col gap-0.5 md:gap-1">
				{#if tunaiData.length === 0}
					<li class="py-2 text-sm text-gray-400 italic md:py-3 md:text-base">Tidak ada data</li>
				{/if}
				{#each groupAndSumByName(tunaiData).sort((a, b) => b.total - a.total) as grouped}
						<li class="flex justify-between text-sm text-gray-600 md:text-base">
							<span
								class="{expandedItems.has(grouped.nama)
									? ''
									: 'max-w-[60%] truncate'} cursor-pointer"
								title={grouped.nama}
								onclick={() => toggleExpand(grouped.nama)}
								onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.nama)}
								role="button"
								tabindex="0">{grouped.nama}</span>
							<span class="font-bold whitespace-nowrap text-gray-700"
								>Rp {formatRupiah(grouped.total)}</span>
						</li>
					{/each}
			</ul>
		</div>
	{/if}
{/snippet}

<div
	class="overflow-hidden rounded-xl bg-white shadow-sm md:mb-4 md:rounded-2xl md:p-4 md:shadow lg:mb-0 lg:flex-1"
>
	<button
		class="mb-1 flex min-h-[44px] w-full items-center justify-between rounded-xl bg-white px-4 py-2 text-base font-bold text-gray-700 md:mb-2 md:rounded-2xl md:px-6 md:py-4 md:text-lg"
		onclick={() => (showPemasukan = !showPemasukan)}
	>
		<span>Pemasukan</span>
		<svg class="ml-2 h-5 w-5 md:h-6 md:w-6" viewBox="0 0 20 20">
			<polygon
				points="5,8 10,13 15,8"
				fill="currentColor"
				style="transform:rotate({showPemasukan ? 0 : 180}deg);transform-origin:center"
			/>
		</svg>
	</button>
	{#if showPemasukan}
		<div
			class="flex gap-4 px-4 pt-1 pb-2 text-xs font-semibold text-gray-500 md:gap-6 md:px-6 md:pt-2 md:pb-4 md:text-base"
		>
			<span
				>QRIS: <span class="font-bold text-pink-500"
					>Rp {formatRupiah(totalQrisPemasukan)}</span
				></span
			>
			<span
				>Tunai: <span class="font-bold text-pink-500"
					>Rp {formatRupiah(totalTunaiPemasukan)}</span
				></span
			>
		</div>
		<div class="flex flex-col gap-0.5 bg-white py-2 md:gap-2 md:py-4" transition:slide|local>
			{@render accordionGroup(
				'Pendapatan Usaha',
				showPendapatanUsaha,
				() => (showPendapatanUsaha = !showPendapatanUsaha),
				pemasukanUsahaQris,
				pemasukanUsahaTunai,
				true
			)}
			{@render accordionGroup(
				'Pemasukan Lainnya',
				showPemasukanLain,
				() => (showPemasukanLain = !showPemasukanLain),
				pemasukanLainQris,
				pemasukanLainTunai,
				false
			)}
		</div>
	{/if}
</div>

<div
	class="overflow-hidden rounded-xl bg-white shadow-sm md:mb-4 md:rounded-2xl md:p-4 md:shadow lg:mb-0 lg:flex-1"
>
	<button
		class="mb-1 flex min-h-[44px] w-full items-center justify-between rounded-xl bg-white px-4 py-2 text-base font-bold text-gray-700 md:mb-2 md:rounded-2xl md:px-6 md:py-4 md:text-lg"
		onclick={() => (showPengeluaran = !showPengeluaran)}
	>
		<span>Pengeluaran</span>
		<svg class="ml-2 h-5 w-5 md:h-6 md:w-6" viewBox="0 0 20 20">
			<polygon
				points="5,8 10,13 15,8"
				fill="currentColor"
				style="transform:rotate({showPengeluaran ? 0 : 180}deg);transform-origin:center"
			/>
		</svg>
	</button>
	{#if showPengeluaran}
		<div
			class="flex gap-4 px-4 pt-1 pb-2 text-xs font-semibold text-gray-500 md:gap-6 md:px-6 md:pt-2 md:pb-4 md:text-base"
		>
			<span
				>QRIS: <span class="font-bold text-pink-500"
					>Rp {formatRupiah(totalQrisPengeluaran)}</span
				></span
			>
			<span
				>Tunai: <span class="font-bold text-pink-500"
					>Rp {formatRupiah(totalTunaiPengeluaran)}</span
				></span
			>
		</div>
		<div class="flex flex-col gap-0.5 bg-white py-2 md:gap-2 md:py-4" transition:slide|local>
			{@render accordionGroup(
				'Beban Usaha',
				showBebanUsaha,
				() => (showBebanUsaha = !showBebanUsaha),
				bebanUsahaQris,
				bebanUsahaTunai,
				true
			)}
			{@render accordionGroup(
				'Beban Lainnya',
				showBebanLain,
				() => (showBebanLain = !showBebanLain),
				bebanLainQris,
				bebanLainTunai,
				false
			)}
		</div>
	{/if}
</div>
