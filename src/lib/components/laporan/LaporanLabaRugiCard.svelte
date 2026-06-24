<script lang="ts">
	import type { LaporanSummary } from '$lib/types/laporan';

	let {
		isLoadingReport,
		summary
	}: {
		isLoadingReport: boolean;
		summary: LaporanSummary;
	} = $props();
</script>

<div class="lg:flex lg:flex-1 lg:flex-col lg:gap-4">
	<!-- Laba (Rugi) Kotor -->
	<div
		class="mb-1 flex items-center justify-between rounded-xl border border-pink-100 bg-white px-4 py-3 text-base font-bold text-gray-700 shadow-sm md:mb-0 md:justify-center md:gap-4 md:rounded-2xl md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:p-6 md:text-center md:text-2xl md:shadow-sm lg:mb-0 lg:h-full lg:min-h-[120px] lg:flex-col lg:justify-center"
	>
		<span>Laba (Rugi) Kotor</span>
		{#if isLoadingReport}
			<div class="h-6 w-32 animate-pulse rounded bg-gray-200 md:h-8"></div>
		{:else}
			<span
				>Rp {summary?.labaKotor !== null && summary?.labaKotor !== undefined
					? summary.labaKotor.toLocaleString('id-ID')
					: '--'}</span
			>
		{/if}
	</div>
	<!-- Pajak Penghasilan -->
	<div
		class="mb-1 flex items-center justify-between rounded-xl border border-pink-100 bg-white px-4 py-3 text-base font-bold text-gray-700 shadow-sm md:mb-0 md:justify-center md:gap-4 md:rounded-2xl md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:p-6 md:text-center md:text-2xl md:shadow-sm lg:mb-0 lg:h-full lg:min-h-[120px] lg:flex-col lg:justify-center"
	>
		<span>Pajak Penghasilan (0,5%)</span>
		{#if isLoadingReport}
			<div class="h-6 w-32 animate-pulse rounded bg-gray-200 md:h-8"></div>
		{:else}
			<span
				>Rp {summary?.pajak !== null && summary?.pajak !== undefined
					? summary.pajak.toLocaleString('id-ID')
					: '--'}</span
			>
		{/if}
	</div>
	<!-- Laba (Rugi) Bersih -->
	<div
		class="flex items-center justify-between rounded-xl border border-pink-100 bg-white px-4 py-3 text-base font-bold text-pink-600 shadow-sm md:mb-0 md:justify-center md:gap-4 md:rounded-2xl md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:p-6 md:text-center md:text-2xl md:shadow-sm lg:mb-0 lg:h-full lg:min-h-[120px] lg:flex-col lg:justify-center"
	>
		<span>Laba (Rugi) Bersih</span>
		{#if isLoadingReport}
			<div class="h-6 w-32 animate-pulse rounded bg-gray-200 md:h-8"></div>
		{:else}
			<span
				>Rp {summary?.labaBersih !== null && summary?.labaBersih !== undefined
					? summary.labaBersih.toLocaleString('id-ID')
					: '--'}</span
			>
		{/if}
	</div>
</div>
