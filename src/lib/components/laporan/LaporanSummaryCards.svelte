<script lang="ts">
	import type { LaporanSummary } from '$lib/types/laporan';
	import Wallet from 'lucide-svelte/icons/wallet';
	import ArrowDownCircle from 'lucide-svelte/icons/arrow-down-circle';
	import ArrowUpCircle from 'lucide-svelte/icons/arrow-up-circle';

	let {
		isLoadingReport,
		summary,
		totalQrisAll,
		totalTunaiAll
	}: {
		isLoadingReport: boolean;
		summary: LaporanSummary;
		totalQrisAll: number;
		totalTunaiAll: number;
	} = $props();
</script>

<!-- Ringkasan Keuangan ala Beranda -->
<div class="px-2 py-3 md:mb-8 md:rounded-2xl md:px-0 md:py-6 md:shadow">
	<div class="md:px-6">
		<div class="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-6">
			<div
				class="flex flex-col items-start rounded-xl bg-gradient-to-br from-green-100 to-green-300 p-3 shadow-sm md:items-center md:justify-center md:gap-1 md:rounded-2xl md:p-4 lg:p-3"
			>
				<ArrowDownCircle
					class="mb-2 h-6 w-6 text-green-500 md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6"
				/>
				<div class="text-sm font-medium text-green-900/80 md:text-center md:text-base lg:text-sm">
					Pemasukan
				</div>
				<div class="text-xl font-bold text-green-900 md:text-center md:text-2xl lg:text-lg">
					{#if isLoadingReport}
						<div class="h-6 w-24 animate-pulse rounded bg-gray-200"></div>
					{:else}
						Rp {summary?.pendapatan !== null && summary?.pendapatan !== undefined
							? summary.pendapatan.toLocaleString('id-ID')
							: '--'}
					{/if}
				</div>
			</div>
			<div
				class="flex flex-col items-start rounded-xl bg-gradient-to-br from-red-100 to-red-300 p-3 shadow-sm md:items-center md:justify-center md:gap-1 md:rounded-2xl md:p-4 lg:p-3"
			>
				<ArrowUpCircle
					class="mb-2 h-6 w-6 text-red-500 md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6"
				/>
				<div class="text-sm font-medium text-red-900/80 md:text-center md:text-base lg:text-sm">
					Pengeluaran
				</div>
				<div class="text-xl font-bold text-red-900 md:text-center md:text-2xl lg:text-lg">
					{#if isLoadingReport}
						<div class="h-6 w-24 animate-pulse rounded bg-gray-200"></div>
					{:else}
						Rp {summary?.pengeluaran !== null && summary?.pengeluaran !== undefined
							? summary.pengeluaran.toLocaleString('id-ID')
							: '--'}
					{/if}
				</div>
			</div>
			<div
				class="col-span-2 flex flex-col items-start rounded-xl bg-gradient-to-br from-cyan-100 to-pink-200 p-3 shadow-sm md:col-span-1 md:items-center md:justify-center md:gap-1 md:rounded-2xl md:p-4 lg:p-3"
			>
				<Wallet class="mb-2 h-6 w-6 text-cyan-900 md:mb-2 md:h-8 md:w-8 lg:mb-1 lg:h-6 lg:w-6" />
				<div class="text-sm font-medium text-cyan-900/80 md:text-center md:text-base lg:text-sm">
					Laba (Rugi)
				</div>
				<div class="text-xl font-bold text-cyan-900 md:text-center md:text-2xl lg:text-lg">
					{#if isLoadingReport}
						<div class="h-6 w-24 animate-pulse rounded bg-gray-200"></div>
					{:else}
						Rp {summary?.saldo !== null && summary?.saldo !== undefined
							? summary.saldo.toLocaleString('id-ID')
							: '--'}
					{/if}
				</div>
			</div>
		</div>
		<!-- Insight Total QRIS & Tunai Keseluruhan -->
		<div
			class="mt-3 flex flex-wrap gap-4 px-1 text-xs font-semibold text-gray-500 md:mt-6 md:gap-6 md:px-0 md:text-base lg:mt-4 lg:text-sm"
		>
			<span
				>Total QRIS: <span class="font-bold text-pink-500"
					>Rp {totalQrisAll.toLocaleString('id-ID')}</span
				></span
			>
			<span
				>Total Tunai: <span class="font-bold text-pink-500"
					>Rp {totalTunaiAll.toLocaleString('id-ID')}</span
				></span
			>
		</div>
	</div>
</div>
