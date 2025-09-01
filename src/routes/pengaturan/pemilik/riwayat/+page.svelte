<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getSupabaseClient } from '$lib/database/supabaseClient';
	import { get as storeGet } from 'svelte/store';
	import { selectedBranch } from '$lib/stores/selectedBranch';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import { getWitaDateRangeUtc } from '$lib/utils/dateTime';
	import { userRole } from '$lib/stores/userRole';
	import DropdownSheet from '$lib/components/shared/dropdownSheet.svelte';
	import { createToastManager } from '$lib/utils/ui';
	import { ErrorHandler } from '$lib/utils/errorHandling';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';

	let transaksiHariIni: any[] = [];
	let loading = true;
	let showDeleteModal = false;
	let transaksiToDelete: any = null;
	let searchKeyword = '';
	let filterPayment = 'all'; // 'all' | 'qris' | 'tunai'
	let Trash: any;
	let pollingInterval: any;
	let showDetailModal = false;
	let selectedTransaksi: any = null;
	let showDropdownPayment = false;
	const paymentOptions = [
		{ value: 'tunai', label: 'Tunai' },
		{ value: 'qris', label: 'QRIS/Non-Tunai' }
	];

	// Toast management
	const toastManager = createToastManager();

	function todayRange() {
		// Hari ini dalam zona waktu WITA
		const todayWita = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
		const yyyy = todayWita.getFullYear();
		const mm = String(todayWita.getMonth() + 1).padStart(2, '0');
		const dd = String(todayWita.getDate()).padStart(2, '0');
		return getWitaDateRangeUtc(`${yyyy}-${mm}-${dd}`);
	}

	async function fetchTransaksiHariIni() {
		loading = true;
		const { startUtc: start, endUtc: end } = todayRange();

		try {
			// Ambil data dari buku_kas
			const { data, error } = await getSupabaseClient(storeGet(selectedBranch))
				.from('buku_kas')
				.select('*')
				.gte('waktu', start)
				.lte('waktu', end)
				.order('waktu', { ascending: false });

			transaksiHariIni = [];
			if (data && !error) {
				transaksiHariIni.push(
					...data.map((t) => ({
						id: t.id,
						transaction_id: t.transaction_id, // Tambahkan transaction_id untuk delete operation
						waktu: t.waktu,
						nama: t.description || t.customer_name || t.nama || '-',
						nominal: t.amount,
						tipe: t.tipe || t.type, // Handle kemungkinan perbedaan nama kolom
						sumber: t.sumber || 'catat',
						payment_method: t.payment_method || 'tunai',
						customer_name: t.customer_name || ''
					}))
				);
			}

			// Urutkan terbaru dulu
			transaksiHariIni.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

			// Filter hanya nominal > 0
			transaksiHariIni = transaksiHariIni.filter((t) => t.nominal && t.nominal > 0);

			// Filter berdasarkan search
			if (searchKeyword.trim()) {
				const keyword = searchKeyword.trim().toLowerCase();
				transaksiHariIni = transaksiHariIni.filter((t) => t.nama?.toLowerCase().includes(keyword));
			}

			// Filter berdasarkan payment method
			if (filterPayment !== 'all') {
				transaksiHariIni = transaksiHariIni.filter((t) => {
					if (filterPayment === 'qris')
						return t.payment_method === 'qris' || t.payment_method === 'non-tunai';
					if (filterPayment === 'tunai') return t.payment_method === 'tunai';
					return true;
				});
			}
		} catch (error) {
			ErrorHandler.logError(error, 'fetchTransaksiHariIni');
			toastManager.showToastNotification('Gagal memuat data transaksi', 'error');
		} finally {
			loading = false;
		}
	}

	function confirmDeleteTransaksi(trx: any) {
		transaksiToDelete = trx;
		showDeleteModal = true;
	}

	async function deleteTransaksi() {
		if (!transaksiToDelete) return;
		loading = true;

		try {
			if (transaksiToDelete.sumber === 'catat') {
				// Untuk transaksi manual/catat, hapus dari buku_kas saja
				await getSupabaseClient(storeGet(selectedBranch))
					.from('buku_kas')
					.delete()
					.eq('id', transaksiToDelete.id);
			} else if (transaksiToDelete.sumber === 'pos') {
				// Untuk transaksi POS, hapus detail items dulu, lalu hapus total pembayaran
				const transactionId = transaksiToDelete.transaction_id || transaksiToDelete.id;

				// Hapus detail transaksi dari transaksi_kasir
				await getSupabaseClient(storeGet(selectedBranch))
					.from('transaksi_kasir')
					.delete()
					.eq('transaction_id', transactionId);

				// Hapus total pembayaran dari buku_kas
				await getSupabaseClient(storeGet(selectedBranch))
					.from('buku_kas')
					.delete()
					.eq('transaction_id', transactionId);
			}

			showDeleteModal = false;
			toastManager.showToastNotification('Transaksi berhasil dihapus.', 'success');
			// Auto hide notification after 3 seconds
			setTimeout(() => {
				toastManager.hideToast();
			}, 3000);
		} catch (error) {
			ErrorHandler.logError(error, 'deleteTransaksi');
			toastManager.showToastNotification('Gagal menghapus transaksi', 'error');
		} finally {
			await fetchTransaksiHariIni();
			loading = false;
		}
	}

	function refreshManual() {
		if (!loading) fetchTransaksiHariIni();
	}

	function openDetail(trx: any) {
		selectedTransaksi = { ...trx };
		showDetailModal = true;
	}

	async function updatePaymentMethod(newMethod: any) {
		if (!selectedTransaksi) return;
		loading = true;
		try {
			await getSupabaseClient(storeGet(selectedBranch))
				.from('buku_kas')
				.update({ payment_method: newMethod })
				.eq('id', selectedTransaksi.id);
			toastManager.showToastNotification('Jenis pembayaran berhasil diubah.', 'success');
			setTimeout(() => {
				toastManager.hideToast();
			}, 2000);
			showDetailModal = false;
			await fetchTransaksiHariIni();
		} catch (e) {
			ErrorHandler.logError(e, 'updatePaymentMethod');
			toastManager.showToastNotification('Gagal mengubah jenis pembayaran', 'error');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		userRole.subscribe((role) => {
			if (role !== 'pemilik') {
				goto('/unauthorized');
			}
		})();
	});

	onMount(async () => {
		if (typeof window !== 'undefined') {
			document.body.classList.add('hide-nav');
		}
		await fetchTransaksiHariIni();
		Trash = (await import('lucide-svelte/icons/trash')).default;
		// pollingInterval = setInterval(fetchTransaksiHariIni, 5000); // HAPUS polling otomatis
	});
	onDestroy(() => {
		if (typeof window !== 'undefined') {
			document.body.classList.remove('hide-nav');
		}
		// clearInterval(pollingInterval); // HAPUS polling otomatis
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
			<svelte:component this={ArrowLeft} class="h-5 w-5 text-gray-600" />
		</button>
		<h1 class="flex-1 text-xl font-bold text-gray-800">Riwayat Transaksi Hari Ini</h1>
		<button
			onclick={refreshManual}
			class="ml-2 rounded-xl bg-pink-50 p-2 transition-colors hover:bg-pink-100"
			aria-label="Refresh"
		>
			<svelte:component
				this={RefreshCw}
				class="h-5 w-5 text-pink-500 {loading ? 'animate-spin' : ''}"
			/>
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
									{trx.payment_method === 'qris' || trx.payment_method === 'non-tunai'
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
								Rp {trx.nominal?.toLocaleString('id-ID')}
							</div>
							<button
								class="rounded-xl bg-red-50 p-2 text-red-600 shadow-md transition-colors hover:bg-red-100"
								onclick={(e) => {
									e.stopPropagation();
									confirmDeleteTransaksi(trx);
								}}
								title="Hapus transaksi"
							>
								<svelte:component this={Trash} class="h-5 w-5" />
							</button>
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
					<svelte:component this={Trash} class="h-8 w-8 text-red-500" />
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
					<div class="text-base text-gray-700">{selectedTransaksi.customer_name || '-'}</div>
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
						Rp {selectedTransaksi.nominal?.toLocaleString('id-ID')}
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
							>{paymentOptions.find((opt) => opt.value === selectedTransaksi.payment_method)
								?.label || 'Pilih'}</span
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
						value={selectedTransaksi.payment_method}
						options={paymentOptions}
						on:close={() => (showDropdownPayment = false)}
						on:select={(e) => {
							showDropdownPayment = false;
							updatePaymentMethod(e.detail);
						}}
					/>
				</div>
				<button
					class="mt-2 w-full rounded-xl bg-pink-500 py-3 text-base font-bold text-white shadow-lg shadow-pink-200/30 transition-colors hover:bg-pink-600"
					onclick={() => (showDetailModal = false)}>Tutup</button
				>
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
