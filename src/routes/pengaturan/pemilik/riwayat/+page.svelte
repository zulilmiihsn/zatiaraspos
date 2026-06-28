<script lang="ts">
	import { refreshBus } from '$lib/utils/refreshBus';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import { userRole } from '$lib/stores/userRole.svelte';
	import DropdownSheet from '$lib/components/shared/dropdownSheet.svelte';
	import { createToastManager } from '$lib/utils/ui';
	import { ErrorHandler } from '$lib/utils/errorHandling';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { dataService } from '$lib/services/dataService';
	import { formatRupiah } from '$lib/utils/currency';

	import type { HistoryItem, ReceiptSettings } from '$lib/types/laporan';
	import type { ComponentType } from 'svelte';
	import { fetchTransaksiHariIni as fetchRiwayatHarian } from '$lib/services/riwayatService';
	import { buildReceiptHtml, printViaIntent, loadReceiptSettings } from '$lib/utils/receiptPrint';

	let pengaturanStruk = $state<ReceiptSettings | null>(null);

	let transaksiHariIni = $state<HistoryItem[]>([]);
	let loading = $state(true);
	let showDeleteModal = $state(false);
	let transaksiToDelete = $state<HistoryItem | null>(null);
	let searchKeyword = $state('');
	let filterPayment = $state('all'); // 'all' | 'qris' | 'tunai'
	let Trash = $state<ComponentType | null>(null);

	let showDetailModal = $state(false);
	let selectedTransaksi = $state<HistoryItem | null>(null);
	let showDropdownPayment = $state(false);
	const paymentOptions = [
		{ value: 'tunai', label: 'Tunai' },
		{ value: 'qris', label: 'QRIS/Non-Tunai' }
	];

	// Toast management
	const toastManager = createToastManager();

	async function fetchTransaksiHariIni() {
		loading = true;
		try {
			transaksiHariIni = await fetchRiwayatHarian({ searchKeyword, filterPayment });
		} catch (error) {
			ErrorHandler.logError(error, 'fetchTransaksiHariIni');
			toastManager.showToastNotification('Gagal memuat data transaksi', 'error');
		} finally {
			loading = false;
		}
	}

	function confirmDeleteTransaksi(trx: HistoryItem) {
		transaksiToDelete = trx;
		showDeleteModal = true;
	}

	async function deleteTransaksi() {
		if (!transaksiToDelete) return;

		// Cek permission dulu
		if (!canDeleteTransaction()) {
			toastManager.showToastNotification(
				'Anda tidak memiliki izin untuk menghapus transaksi',
				'error'
			);
			return;
		}

		loading = true;

		try {
			if (transaksiToDelete.sumber === 'catat') {
				// Untuk transaksi manual/catat, hapus dari buku_kas saja
				await dataService.deleteRows('buku_kas', { id: transaksiToDelete.id });
			} else if (transaksiToDelete.sumber === 'pos') {
				// Transaksi POS: satu call atomik. Server (DELETE /api/transaksi-kasir)
				// reverse ringkasan + restore stok produk/bahan + hapus transaksi_kasir
				// DAN buku_kas dalam satu batch. Jangan panggil buku_kas terpisah.
				const transactionId = transaksiToDelete.transaction_id || transaksiToDelete.id;
				await dataService.deleteRows('transaksi_kasir', { transaction_id: transactionId });
			} else {
				// Fallback: hapus berdasarkan ID langsung
				await dataService.deleteRows('buku_kas', { id: transaksiToDelete.id });
			}

			showDeleteModal = false;
			toastManager.showToastNotification('Transaksi berhasil dihapus.', 'success');
			// Auto hide notification after 3 seconds
			setTimeout(() => {
				toastManager.hideToast();
			}, 3000);
		} catch (error) {
			const err = error as Error;
			ErrorHandler.logError(err, 'deleteTransaksi');
			const message = err?.message || 'Unknown error';
			toastManager.showToastNotification(`Gagal menghapus transaksi: ${message}`, 'error');
		} finally {
			await fetchTransaksiHariIni();
			loading = false;
		}
	}

	function refreshManual() {
		if (!loading) fetchTransaksiHariIni();
	}

	function openDetail(trx: HistoryItem) {
		selectedTransaksi = { ...trx };
		showDetailModal = true;
	}

	async function updatePaymentMethod(newMethod: string) {
		if (!selectedTransaksi) return;
		const currentMethod = selectedTransaksi.metode_bayar;
		const dbMethod = newMethod === 'qris' ? 'non-tunai' : newMethod;
		if (currentMethod === dbMethod) return;
		loading = true;
		try {
			await dataService.updateRows(
				'buku_kas',
				{ metode_bayar: dbMethod },
				{ id: selectedTransaksi.id }
			);
			selectedTransaksi = { ...selectedTransaksi, metode_bayar: dbMethod };
			toastManager.showToastNotification('Jenis pembayaran berhasil diubah.', 'success');
			setTimeout(() => {
				toastManager.hideToast();
			}, 2000);
			await fetchTransaksiHariIni();
		} catch (e) {
			ErrorHandler.logError(e, 'updatePaymentMethod');
			toastManager.showToastNotification('Gagal mengubah jenis pembayaran', 'error');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (userRole.value !== 'pemilik') {
			goto('/unauthorized');
		}
	});

	async function fetchPengaturanStruk() {
		pengaturanStruk = await loadReceiptSettings();
	}

	async function printStrukDariRiwayat() {
		if (!selectedTransaksi) return;

		loading = true;
		try {
			let items: Record<string, unknown>[] = [];
			if (selectedTransaksi.sumber === 'pos') {
				items = await dataService.getRows('transaksi_kasir', {
					transaction_id: selectedTransaksi.transaction_id || selectedTransaksi.id
				});
			}

			const html = buildReceiptHtml(selectedTransaksi, pengaturanStruk, items);
			printViaIntent(html);
		} catch (error) {
			ErrorHandler.logError(error as Error, 'printStrukDariRiwayat');
			toastManager.showToastNotification('Gagal mencetak struk', 'error');
		} finally {
			loading = false;
		}
	}

	// Cek role sebelum delete
	function canDeleteTransaction() {
		const currentRole = userRole.value;
		return currentRole === 'pemilik';
	}

	let aiHandler: EventListener;
	let offRiwayat: () => void;

	onMount(async () => {
		if (typeof window !== 'undefined') {
			document.body.classList.add('hide-nav');
		}
		await fetchPengaturanStruk();
		await fetchTransaksiHariIni();
		Trash = (await import('lucide-svelte/icons/trash')).default;
		// pollingInterval = setInterval(fetchTransaksiHariIni, 5000); // HAPUS polling otomatis
		// Dengarkan event global agar riwayat auto-refresh ketika rekomendasi AI diterapkan
		aiHandler = async () => {
			await fetchTransaksiHariIni();
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('ai-recommendations-applied', aiHandler);
			// Ekspor refresher global untuk dipanggil langsung
			offRiwayat = refreshBus.on('riwayat', async () => {
				await fetchTransaksiHariIni();
			});
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			document.body.classList.remove('hide-nav');
		}
		// clearInterval(pollingInterval); // HAPUS polling otomatis
		if (typeof window !== 'undefined' && aiHandler) {
			window.removeEventListener('ai-recommendations-applied', aiHandler);
			if (offRiwayat) offRiwayat();
		}
	});
</script>

<div transition:fly={{ y: 32, duration: 320, easing: cubicOut }}>
	<!-- Top Bar Custom -->
	<div
		class="sticky top-0 z-40 mb-0 flex items-center border-b border-gray-200 bg-white px-4 py-4 shadow-sm"
	>
		<button
			onclick={() => goto('/pengaturan/pemilik')}
			class="mr-2 rounded-xl bg-gray-100 p-2 transition-colors hover:bg-gray-200"
		>
			<ArrowLeft class="h-5 w-5 text-gray-600" />
		</button>
		<h1 class="flex-1 text-xl font-bold text-gray-800">Riwayat Transaksi Hari Ini</h1>
		<button
			onclick={refreshManual}
			class="ml-2 rounded-xl bg-pink-50 p-2 transition-colors hover:bg-pink-100"
			aria-label="Refresh"
		>
			<RefreshCw class="h-5 w-5 text-pink-500 {loading ? 'animate-spin' : ''}" />
		</button>
	</div>
	<!-- Search Bar dan Filter Payment Method digabung -->
	<div class="sticky top-[64px] z-30 space-y-3 bg-white px-4 pt-3 pb-3">
		<input
			type="text"
			class="w-full rounded-lg border border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
			placeholder="Cari transaksi..."
			bind:value={searchKeyword}
			oninput={fetchTransaksiHariIni}
		/>
		<div class="flex gap-2">
			<button
				class="rounded-lg border px-4 py-2 text-sm font-semibold transition-all focus:outline-none {filterPayment ===
				'all'
					? 'border-pink-500 bg-pink-500 text-white'
					: 'border-pink-200 bg-white text-pink-500'}"
				onclick={() => {
					filterPayment = 'all';
					fetchTransaksiHariIni();
				}}>Semua</button
			>
			<button
				class="rounded-lg border px-4 py-2 text-sm font-semibold transition-all focus:outline-none {filterPayment ===
				'qris'
					? 'border-pink-500 bg-pink-500 text-white'
					: 'border-pink-200 bg-white text-pink-500'}"
				onclick={() => {
					filterPayment = 'qris';
					fetchTransaksiHariIni();
				}}>QRIS</button
			>
			<button
				class="rounded-lg border px-4 py-2 text-sm font-semibold transition-all focus:outline-none {filterPayment ===
				'tunai'
					? 'border-pink-500 bg-pink-500 text-white'
					: 'border-pink-200 bg-white text-pink-500'}"
				onclick={() => {
					filterPayment = 'tunai';
					fetchTransaksiHariIni();
				}}>Tunai</button
			>
		</div>
	</div>

	<div class="mx-auto w-full max-w-2xl px-4 pt-[2px] pb-4">
		{#if loading}
			<div class="py-10 text-center text-gray-400">Memuat data...</div>
		{:else if transaksiHariIni.length === 0}
			<div class="flex h-64 w-full flex-col items-center justify-center" style="min-height:16rem;">
				<svg
					class="mb-4 h-16 w-16 text-gray-300"
					fill="none"
					stroke="currentColor"
					stroke-width="1"
					viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
					/></svg
				>
				<div class="text-base font-normal text-gray-300 md:text-lg">
					Belum ada transaksi hari ini
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-2">
				{#each transaksiHariIni as trx}
					<div
						class="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow transition-colors hover:bg-pink-50"
						onclick={() => openDetail(trx)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								openDetail(trx);
							}
						}}
						role="button"
						tabindex="0"
					>
						<div>
							<div
								class="max-w-[10rem] truncate overflow-hidden text-sm font-semibold text-gray-800 md:max-w-[16rem] lg:max-w-[18rem]"
								title={trx.nama}
							>
								{trx.nama}
							</div>
							<div class="mb-1 flex items-center gap-2 text-xs text-gray-500">
								<span>
									{trx.sumber === 'pos' ? 'POS | ' : ''}
									{trx.tipe === 'in' ? 'Pemasukan' : 'Pengeluaran'}
									{trx.sumber === 'pos' ? ' | ' : ''}
								</span>
								<span class="font-semibold text-pink-500 uppercase">
									{trx.metode_bayar === 'qris' || trx.metode_bayar === 'non-tunai'
										? 'QRIS'
										: 'Tunai'}
								</span>
							</div>
							<div class="text-xs text-gray-400">
								{new Date(trx.waktu).toLocaleTimeString('id-ID', {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</div>
						</div>
						<div class="flex flex-col items-end gap-2">
							<div class="text-base font-bold text-pink-500">
								Rp {formatRupiah(trx.nominal)}
							</div>
							{#if canDeleteTransaction()}
								<button
									class="rounded-xl bg-red-50 p-2 text-red-600 shadow-md transition-colors hover:bg-red-100"
									onclick={(e) => {
										e.stopPropagation();
										confirmDeleteTransaksi(trx);
									}}
									title="Hapus transaksi"
								>
									<Trash class="h-5 w-5" />
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if showDeleteModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div
				class="animate-slideUpModal relative flex w-full max-w-xs flex-col items-center rounded-2xl bg-white p-6 shadow-xl"
			>
				<div class="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-red-100">
					<Trash class="h-8 w-8 text-red-500" />
				</div>
				<h2 class="mb-2 text-center text-lg font-bold text-gray-800">Hapus Transaksi?</h2>
				<p class="mb-6 text-center text-sm text-gray-500">
					Transaksi yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus transaksi ini?
				</p>
				<div class="flex w-full gap-3">
					<button
						class="flex-1 rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
						onclick={() => (showDeleteModal = false)}>Batal</button
					>
					<button
						class="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600"
						onclick={deleteTransaksi}>Hapus</button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if showDetailModal && selectedTransaksi}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm md:px-0"
		>
			<div
				class="animate-slideUpModal relative flex w-full max-w-md flex-col gap-3 rounded-2xl border border-pink-100 bg-white p-6 shadow-2xl md:p-8"
			>
				<button
					class="absolute top-3 right-3 rounded-full bg-gray-100 p-2 shadow-sm hover:bg-gray-200"
					onclick={() => (showDetailModal = false)}
					aria-label="Tutup"
				>
					<svg
						class="h-5 w-5 text-gray-500"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
					>
				</button>
				<h2 class="mb-2 text-center text-xl font-bold text-pink-600">Detail Transaksi</h2>
				<div class="mb-1 flex flex-col gap-1">
					<span class="font-semibold text-gray-500">Deskripsi</span>
					<div
						class="rounded-lg bg-pink-50 px-3 py-2 text-base font-medium break-words whitespace-pre-line text-gray-800"
					>
						{selectedTransaksi.nama}
					</div>
				</div>
				<div class="flex flex-col gap-1">
					<span class="font-semibold text-gray-500">Customer</span>
					<div class="text-base text-gray-700">{selectedTransaksi.nama_pelanggan || '-'}</div>
				</div>
				<div class="flex flex-col gap-1">
					<span class="font-semibold text-gray-500">Waktu</span>
					<div class="text-base text-gray-700">
						{new Date(selectedTransaksi.waktu).toLocaleString('id-ID', {
							dateStyle: 'medium',
							timeStyle: 'short'
						})}
					</div>
				</div>
				<div class="flex flex-col gap-1">
					<span class="font-semibold text-gray-500">Nominal</span>
					<div class="text-lg font-bold text-pink-500">
						Rp {formatRupiah(selectedTransaksi.nominal)}
					</div>
				</div>
				<div class="mb-2 flex flex-col gap-1">
					<span class="font-semibold text-gray-500">Jenis Pembayaran</span>
					<button
						type="button"
						class="flex w-full items-center justify-between rounded-lg border-[1.5px] border-pink-200 bg-white px-3 py-2.5 font-medium text-pink-500 shadow-sm transition-colors hover:bg-pink-50"
						onclick={() => (showDropdownPayment = true)}
						style="user-select:none;"
					>
						<span class="truncate"
							>{paymentOptions.find(
								(opt) =>
									opt.value ===
									(selectedTransaksi?.metode_bayar === 'non-tunai'
										? 'qris'
										: selectedTransaksi?.metode_bayar)
							)?.label || 'Pilih'}</span
						>
						<svg
							class="ml-2 h-4 w-4 text-pink-400"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
						>
					</button>
					<DropdownSheet
						open={showDropdownPayment}
						value={selectedTransaksi.metode_bayar === 'non-tunai'
							? 'qris'
							: selectedTransaksi.metode_bayar}
						options={paymentOptions}
						onClose={() => (showDropdownPayment = false)}
						onSelect={(value) => {
							showDropdownPayment = false;
							updatePaymentMethod(value);
						}}
					/>
				</div>
				<div class="mt-2 flex w-full gap-2">
					<button
						class="flex-1 rounded-xl bg-pink-100 py-3 text-base font-bold text-pink-600 transition-colors hover:bg-pink-200"
						onclick={printStrukDariRiwayat}>Cetak Struk</button
					>
					<button
						class="flex-1 rounded-xl bg-pink-500 py-3 text-base font-bold text-white shadow-lg shadow-pink-200/30 transition-colors hover:bg-pink-600"
						onclick={() => (showDetailModal = false)}>Tutup</button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if toastManager.showToast}
		<ToastNotification
			show={toastManager.showToast}
			message={toastManager.toastMessage}
			type={toastManager.toastType}
			duration={3000}
			position="top"
		/>
	{/if}
</div>

<style>
	.animate-slideUpModal {
		animation: slideUpModal 0.32s cubic-bezier(0.4, 0, 0.2, 1);
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

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}
</style>
