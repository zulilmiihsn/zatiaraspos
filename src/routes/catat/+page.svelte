<script lang="ts">
	import { onMount } from 'svelte';

	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import DropdownSheet from '$lib/components/shared/dropdownSheet.svelte';
	import {
		validateNumber,
		validateText,
		validateTime,
		sanitizeInput,
		validateIncomeExpense
	} from '$lib/utils/validation';
	import { securityUtils } from '$lib/utils/security';
	import { auth } from '$lib/auth/auth';
	import { witaToUtcISO } from '$lib/utils/dateTime';
	import { userRole, setUserRole } from '$lib/stores/userRole.svelte';

	import { addPendingTransaction } from '$lib/utils/offline';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { dataService } from '$lib/services/dataService';
	import { createToastManager } from '$lib/utils/ui';
	import { getSesiAktif } from '$lib/services/sesiTokoService';

	import type { TokoSession } from '$lib/types';

	import { createSwipeNavigation } from '$lib/utils/touchNavigation';

	const swipeNav = createSwipeNavigation(2); // 2 = Catat

	let mode = $state<'pemasukan' | 'pengeluaran'>('pemasukan');
	let paymentMethod = $state<'tunai' | 'non-tunai'>('tunai');
	let date = $state('');
	let time = $state('');
	let rawNominal = $state('');
	let nominal = $state('');
	let jenis = $state('');
	let namaJenis = $state('');
	let nama = $state('');
	let error = $state('');

	let showDropdown = $state(false);

	// Toast notification - use shared createToastManager
	const toastManager = createToastManager();

	const jenisPemasukan = [
		{ value: 'pendapatan_usaha', label: 'Pendapatan Usaha' },
		{ value: 'lainnya', label: 'Lainnya' }
	];
	const jenisPengeluaran = [
		{ value: 'beban_usaha', label: 'Beban Usaha' },
		{ value: 'lainnya', label: 'Lainnya' }
	];

	let showSnackbar = $state(false);
	let snackbarMsg = $state('');

	// Helper untuk tanggal lokal user (YYYY-MM-DD)
	function getLocalDateString() {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	let currentUserRole = $state('');
	$effect(() => {
		currentUserRole = userRole.value || '';
	});

	let sesiAktif = $state<TokoSession | null>(null);
	async function cekSesiTokoAktif() {
		sesiAktif = await getSesiAktif();
	}

	onMount(async () => {
		// Preload ikon Catat (non-blocking)
		import('$lib/utils/iconLoader').then(({ loadRouteIcons }) => {
			loadRouteIcons('catat');
		});

		// Jika role belum ada di store, validasi dari session backend.
		if (!currentUserRole) {
			const res = await fetch('/api/session');
			if (res.ok) {
				const session = await res.json();
				if (session?.user) setUserRole(session.user.role, session.user);
			}
		}

		date = getLocalDateString();
		time = new Date().toTimeString().slice(0, 5);
		jenis = mode === 'pemasukan' ? 'pendapatan_usaha' : 'beban_usaha';
		await cekSesiTokoAktif();
	});

	let showNotifModal = $state(false);
	let notifModalMsg = $state('');
	let notifModalType = $state('warning'); // 'warning' | 'success' | 'error'

	function closeNotifModal() {
		showNotifModal = false;
	}

	async function saveTransaksi(form: {
		nominal: number;
		deskripsi: string;
		transaction_date: string;
		transaction_time: string;
		metode_bayar: string;
		jenis: string;
	}) {
		await cekSesiTokoAktif();
		const id_sesi_toko = sesiAktif?.id || null;
		if (!id_sesi_toko && currentUserRole === 'kasir') {
			notifModalMsg = 'Kasir tidak boleh melakukan transaksi saat toko tutup!';
			notifModalType = 'error';
			showNotifModal = true;
			return;
		}
		if (!id_sesi_toko && currentUserRole !== 'kasir') {
			notifModalMsg =
				'PERINGATAN: Tidak ada sesi toko aktif! Transaksi akan dianggap di luar sesi dan tidak masuk ringkasan tutup toko.';
			notifModalType = 'warning';
			showNotifModal = true;
			// Tidak ada return di sini, agar insert tetap lanjut untuk pemilik
		}

		const utcTime = witaToUtcISO(form.transaction_date, form.transaction_time || '00:00');

		const trx = {
			id: crypto.randomUUID(),
			tipe: mode === 'pemasukan' ? 'in' : 'out',
			sumber: 'catat',
			metode_bayar: form.metode_bayar,
			nominal: form.nominal,
			deskripsi: form.deskripsi,
			id_sesi_toko,
			waktu: utcTime,
			jenis: form.jenis
		};
		if (navigator.onLine) {
			try {
				await dataService.insertRows('buku_kas', trx);
			} catch (error) {
				if (error instanceof TypeError || !navigator.onLine) {
					await addPendingTransaction(trx);
					notifModalMsg = 'Koneksi terputus. Transaksi disimpan dan akan dikirim saat online.';
					notifModalType = 'success';
					showNotifModal = true;
					return;
				}
				notifModalMsg =
					'Gagal menyimpan transaksi ke database: ' +
					(error instanceof Error ? error.message : 'Unknown error');
				notifModalType = 'error';
				showNotifModal = true;
				return;
			}
			// Setelah transaksi berhasil, invalidate cache dashboard/laporan dan fetch ulang data
			await dataService.invalidateCacheOnChange('buku_kas');
			await dataService.invalidateCacheOnChange('transaksi_kasir');
		} else {
			// Offline mode: simpan transaksi ke pending
			await addPendingTransaction(trx);
			notifModalMsg = 'Transaksi disimpan offline dan akan otomatis sync saat online.';
			notifModalType = 'success';
			showNotifModal = true;
		}
	}

	$effect(() => {
		if (mode === 'pemasukan') {
			if (!jenis || (jenis !== 'pendapatan_usaha' && jenis !== 'lainnya')) {
				jenis = 'pendapatan_usaha';
			}
		} else if (mode === 'pengeluaran') {
			if (!jenis || (jenis !== 'beban_usaha' && jenis !== 'lainnya')) {
				jenis = 'beban_usaha';
			}
		}
	});

	function formatRupiah(angka: string | number): string {
		if (!angka) return '';
		return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	}

	function handleNominalInput(e: Event) {
		// Hanya izinkan angka
		const target = e.target as HTMLInputElement;
		let val = target.value.replace(/\D/g, '');
		rawNominal = val;
		nominal = formatRupiah(val);
	}

	function setTemplateNominal(val: number) {
		let current = parseInt(rawNominal || '0', 10);
		let next = current + val;
		rawNominal = next.toString();
		nominal = formatRupiah(next);
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		// Remove SecurityMiddleware references - use securityUtils instead
		// Check rate limiting
		if (!securityUtils.checkFormRateLimit('catat_form')) {
			error = 'Terlalu banyak submission. Silakan tunggu sebentar.';
			return;
		}

		// Sanitize inputs
		const sanitizedDate = sanitizeInput(date);
		const sanitizedTime = sanitizeInput(time);
		const sanitizedNominal = sanitizeInput(nominal);
		let sanitizedJenis = sanitizeInput(jenis);
		if (!sanitizedJenis) {
			sanitizedJenis = mode === 'pemasukan' ? 'pendapatan_usaha' : 'beban_usaha';
		}
		const sanitizedNamaJenis = sanitizeInput(namaJenis);
		const sanitizedNama = sanitizeInput(nama);
		const sanitizedPaymentMethod = sanitizeInput(paymentMethod);

		// Validate all fields
		const timeValidation = validateTime(sanitizedTime);
		const nominalValidation = validateNumber(sanitizedNominal, { required: true, min: 0 });
		const jenisValidation = validateText(sanitizedJenis, { required: true });
		const namaValidation = validateText(sanitizedNama, {
			required: true,
			minLength: 2,
			maxLength: 100
		});
		const paymentMethodValidation = validateText(sanitizedPaymentMethod, { required: true });

		// Check for suspicious activity
		const allInputs = `${sanitizedDate}${sanitizedTime}${sanitizedNominal}${sanitizedJenis}${sanitizedNamaJenis}${sanitizedNama}${sanitizedPaymentMethod}`;
		if (securityUtils.detectSuspiciousActivity('catat_form', allInputs)) {
			error = 'Input mencurigakan terdeteksi. Silakan coba lagi.';
			securityUtils.logSecurityEvent('suspicious_input_blocked', {
				form: 'catat',
				inputs: { date: sanitizedDate, time: sanitizedTime, nominal: sanitizedNominal }
			});
			return;
		}

		// Collect all validation errors
		const errors = [];
		if (!timeValidation.isValid) errors.push(`Waktu: ${timeValidation.errors.join(', ')}`);
		if (!nominalValidation.isValid) errors.push(`Nominal: ${nominalValidation.errors.join(', ')}`);
		if (!jenisValidation.isValid) errors.push(`Jenis: ${jenisValidation.errors.join(', ')}`);
		if (!namaValidation.isValid) errors.push(`Nama: ${namaValidation.errors.join(', ')}`);
		if (!paymentMethodValidation.isValid)
			errors.push(`Metode Pembayaran: ${paymentMethodValidation.errors.join(', ')}`);

		// Validate nama jenis if jenis is 'lainnya'
		if (sanitizedJenis === 'lainnya') {
			const namaJenisValidation = validateText(sanitizedNamaJenis, {
				required: true,
				minLength: 2,
				maxLength: 50
			});
			if (!namaJenisValidation.isValid) {
				errors.push(`Nama Jenis: ${namaJenisValidation.errors.join(', ')}`);
			}
		}

		if (errors.length > 0) {
			error = errors.join('\n');
			return;
		}

		// Validate complete data object
		const dataToValidate = {
			nominal: parseFloat(sanitizedNominal.replace(/\D/g, '')),
			deskripsi: sanitizedNama,
			transaction_date: sanitizedDate,
			transaction_time: sanitizedTime,
			metode_bayar: sanitizedPaymentMethod,
			jenis: sanitizedJenis
		};
		const completeValidation = validateIncomeExpense(dataToValidate);
		if (!completeValidation.isValid) {
			error = completeValidation.errors.join('\n');
			return;
		}

		// Simpan transaksi via saveTransaksi agar id_sesi_toko selalu terisi
		await saveTransaksi(dataToValidate);
		// Tampilkan snackbar sukses
		snackbarMsg = 'Transaksi berhasil dicatat!';
		showSnackbar = true;
		setTimeout(() => {
			showSnackbar = false;
		}, 1800);

		// Reset form
		rawNominal = '';
		namaJenis = '';
		nama = '';
	}

	function getJenisLabel(val: string): string {
		// Optimized to avoid array search on every call
		if (mode === 'pemasukan') {
			if (val === 'pendapatan_usaha') return 'Pendapatan Usaha';
			if (val === 'lainnya') return 'Lainnya';
		} else {
			if (val === 'beban_usaha') return 'Beban Usaha';
			if (val === 'lainnya') return 'Lainnya';
		}
		return '';
	}

	function handleSetPemasukan() {
		if (mode !== 'pemasukan') {
			mode = 'pemasukan';
			if (jenis !== 'pendapatan_usaha' && jenis !== 'lainnya') {
				jenis = 'pendapatan_usaha';
			}
			if (jenis === 'lainnya') {
				namaJenis = '';
			}
			nama = '';
		}
	}
	function handleSetPengeluaran() {
		if (mode !== 'pengeluaran') {
			mode = 'pengeluaran';
			if (jenis !== 'beban_usaha' && jenis !== 'lainnya') {
				jenis = 'beban_usaha';
			}
			if (jenis === 'lainnya') {
				namaJenis = '';
			}
			nama = '';
		}
	}
	function handleSetTemplateNominal(val: number) {
		return () => setTemplateNominal(val);
	}
</script>

<!-- Toast Notification -->
<ToastNotification
	show={toastManager.showToast}
	message={toastManager.toastMessage}
	type={toastManager.toastType}
	duration={2000}
	position="top"
/>

{#if showSnackbar}
	<div
		class="fixed top-24 left-1/2 z-50 flex min-w-[220px] items-center justify-center gap-3 rounded-xl bg-pink-500 px-6 py-3 text-base font-semibold text-white shadow-lg"
		style="transform: translateX(-50%);"
		in:fly={{ y: -32, duration: 300, easing: cubicOut }}
		out:fade={{ duration: 200 }}
	>
		<svg
			class="h-7 w-7 flex-shrink-0 text-white"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<circle cx="12" cy="12" r="10" fill="#f9a8d4" />
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9 12l2 2 4-4"
				stroke="#fff"
				stroke-width="2"
			/>
		</svg>
		<span class="flex-1 text-center">{snackbarMsg}</span>
	</div>
{/if}

{#if showNotifModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
		<div
			class="animate-slideUpModal flex w-full max-w-xs flex-col items-center rounded-2xl border-2 bg-white px-8 py-7 shadow-2xl"
			style="border-color: {notifModalType === 'success'
				? '#facc15'
				: notifModalType === 'error'
					? '#ef4444'
					: '#facc15'};"
		>
			<div
				class="mb-3 flex h-16 w-16 items-center justify-center rounded-full"
				style="background: {notifModalType === 'success'
					? '#fef9c3'
					: notifModalType === 'error'
						? '#fee2e2'
						: '#fef9c3'};"
			>
				{#if notifModalType === 'success'}
					<svg
						class="h-10 w-10 text-yellow-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" fill="#fef9c3" />
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 12l2 2 4-4"
							stroke="#facc15"
							stroke-width="2"
						/>
					</svg>
				{:else if notifModalType === 'error'}
					<svg
						class="h-10 w-10 text-red-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" fill="#fee2e2" />
						<line
							x1="9"
							y1="9"
							x2="15"
							y2="15"
							stroke="#ef4444"
							stroke-width="2"
							stroke-linecap="round"
						/>
						<line
							x1="15"
							y1="9"
							x2="9"
							y2="15"
							stroke="#ef4444"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				{:else}
					<svg
						class="h-10 w-10 text-yellow-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" fill="#fef9c3" />
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 8v4m0 4h.01"
							stroke="#facc15"
							stroke-width="2"
						/>
					</svg>
				{/if}
			</div>
			<div class="mb-4 text-center text-base font-medium text-gray-700">{notifModalMsg}</div>
			<button
				class="mt-2 rounded-xl bg-pink-500 px-6 py-2 font-bold text-white shadow transition-colors hover:bg-pink-600"
				onclick={closeNotifModal}>Tutup</button
			>
		</div>
	</div>
{/if}

<div
	class="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-white"
	ontouchstart={swipeNav.handleTouchStart}
	ontouchmove={swipeNav.handleTouchMove}
	ontouchend={swipeNav.handleTouchEnd}
	onkeydown={(e) => e.key === 'Escape' && swipeNav.handleGlobalClick(e as unknown as Event)}
	role="main"
	aria-label="Halaman catat pemasukan pengeluaran"
	tabindex="-1"
>
	<main
		class="page-content min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto"
		style="scrollbar-width:none;-ms-overflow-style:none;"
	>
		<div class="px-2 pt-4 pb-4 md:pt-8 lg:pt-10">
			<div
				class="mx-auto w-full max-w-md px-2 pb-2 md:mx-auto md:max-w-lg md:px-0 md:pb-4 lg:mx-auto lg:max-w-2xl"
			>
				<div
					class="relative mb-5 flex overflow-hidden rounded-full border border-pink-100 bg-gray-50 shadow-sm md:mx-auto md:max-w-lg"
				>
					<!-- Indicator Slide -->
					<div
						class="absolute top-0 left-0 z-0 h-full w-1/2 rounded-full border border-pink-200 bg-white shadow transition-transform duration-200 ease-out"
						style="transform: translateX({mode === 'pengeluaran' ? '100%' : '0'});"
					></div>
					<button
						class="z-10 h-14 min-h-0 flex-1 rounded-full text-sm font-semibold transition-all duration-200 focus:outline-none md:h-16 {mode ===
						'pemasukan'
							? 'text-pink-500'
							: 'text-gray-400'} md:text-lg"
						type="button"
						aria-current={mode === 'pemasukan' ? 'page' : undefined}
						onclick={handleSetPemasukan}
					>
						Catat Pemasukan
					</button>
					<button
						class="z-10 h-14 min-h-0 flex-1 rounded-full text-sm font-semibold transition-all duration-200 focus:outline-none md:h-16 {mode ===
						'pengeluaran'
							? 'text-pink-500'
							: 'text-gray-400'} md:text-lg"
						type="button"
						aria-current={mode === 'pengeluaran' ? 'page' : undefined}
						onclick={handleSetPengeluaran}
					>
						Catat Pengeluaran
					</button>
				</div>
				<form
					class="flex flex-col gap-4 px-1 md:rounded-2xl md:border md:border-pink-100 md:bg-white md:p-8 md:shadow {jenis ===
					'lainnya'
						? 'pb-18'
						: 'pb-14'} md:gap-6"
					onsubmit={handleSubmit}
					autocomplete="off"
					id="catat-form"
				>
					<div class="flex flex-col gap-4 sm:flex-row sm:gap-4 md:gap-6">
						<div class="flex-1">
							<label
								class="mb-1 block text-sm font-medium text-pink-500 md:text-base"
								for="tanggal-input">Tanggal</label
							>
							<input
								id="tanggal-input"
								type="date"
								class="mb-1 w-full rounded-lg border-[1.5px] border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 transition-colors duration-200 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 md:py-3 md:text-lg"
								bind:value={date}
								min="2020-01-01"
								max="2100-12-31"
								required
							/>
						</div>
						<div class="flex-1">
							<label
								class="mb-1 block text-sm font-medium text-pink-500 md:text-base"
								for="waktu-input">Waktu</label
							>
							<input
								id="waktu-input"
								type="time"
								class="mb-1 w-full rounded-lg border-[1.5px] border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 transition-colors duration-200 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 md:py-3 md:text-lg"
								bind:value={time}
								required
							/>
						</div>
					</div>
					<div>
						<label
							class="mb-1 block text-sm font-medium text-pink-500 md:text-base"
							for="nominal-input">Nominal</label
						>
						<input
							id="nominal-input"
							type="text"
							inputmode="numeric"
							class="mb-1 w-full rounded-lg border-[1.5px] border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 transition-colors duration-200 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 md:py-3 md:text-lg"
							value={nominal}
							oninput={handleNominalInput}
							required
							placeholder="Masukkan nominal"
							autocomplete="off"
						/>
						<div
							class="mt-2 mb-1 grid w-full grid-cols-3 gap-2 md:flex md:w-auto md:grid-cols-none md:flex-wrap md:justify-center md:gap-3"
						>
							<button
								type="button"
								class="w-full rounded-lg bg-pink-100 py-2 text-base font-semibold text-pink-500 shadow-sm active:bg-pink-200 md:w-auto md:px-6 md:py-3 md:text-lg md:whitespace-nowrap"
								onclick={handleSetTemplateNominal(5000)}>Rp 5.000</button
							>
							<button
								type="button"
								class="w-full rounded-lg bg-pink-100 py-2 text-base font-semibold text-pink-500 shadow-sm active:bg-pink-200 md:w-auto md:px-6 md:py-3 md:text-lg md:whitespace-nowrap"
								onclick={handleSetTemplateNominal(10000)}>Rp 10.000</button
							>
							<button
								type="button"
								class="w-full rounded-lg bg-pink-100 py-2 text-base font-semibold text-pink-500 shadow-sm active:bg-pink-200 md:w-auto md:px-6 md:py-3 md:text-lg md:whitespace-nowrap"
								onclick={handleSetTemplateNominal(20000)}>Rp 20.000</button
							>
							<button
								type="button"
								class="w-full rounded-lg bg-pink-100 py-2 text-base font-semibold text-pink-500 shadow-sm active:bg-pink-200 md:w-auto md:px-6 md:py-3 md:text-lg md:whitespace-nowrap"
								onclick={handleSetTemplateNominal(50000)}>Rp 50.000</button
							>
							<button
								type="button"
								class="w-full rounded-lg bg-pink-100 py-2 text-base font-semibold text-pink-500 shadow-sm active:bg-pink-200 md:w-auto md:px-6 md:py-3 md:text-lg md:whitespace-nowrap"
								onclick={handleSetTemplateNominal(100000)}>Rp 100.000</button
							>
						</div>
					</div>
					<div>
						<label
							class="mb-1 block text-sm font-medium text-pink-500 md:text-base"
							for="jenis-dropdown">Jenis {mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</label
						>
						<button
							type="button"
							id="jenis-dropdown"
							class="mb-1 flex w-full cursor-pointer items-center rounded-lg border-[1.5px] border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 transition-colors duration-200 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 md:py-3 md:text-lg"
							onclick={() => (showDropdown = true)}
							onkeydown={(e) => e.key === 'Enter' && (showDropdown = true)}
							style="user-select:none;"
						>
							<span class="truncate">{getJenisLabel(jenis)}</span>
						</button>
						<DropdownSheet
							open={showDropdown}
							value={jenis}
							options={mode === 'pemasukan' ? jenisPemasukan : jenisPengeluaran}
							on:close={() => (showDropdown = false)}
							on:select={(e) => {
								jenis = e.detail;
								showDropdown = false;
							}}
						/>
					</div>
					{#if jenis === 'lainnya'}
						<div>
							<label
								class="mb-1 block text-sm font-medium text-pink-500 md:text-base"
								for="nama-jenis-input">Nama Jenis</label
							>
							<input
								id="nama-jenis-input"
								type="text"
								class="mb-1 w-full rounded-lg border-[1.5px] border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 transition-colors duration-200 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 md:py-3 md:text-lg"
								bind:value={namaJenis}
								required
								placeholder="Masukkan nama jenis"
							/>
						</div>
					{/if}
					<div>
						<label
							class="mb-1 block text-sm font-medium text-pink-500 md:text-base"
							for="nama-input">Nama {mode === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</label
						>
						<input
							id="nama-input"
							type="text"
							class="mb-1 w-full rounded-lg border-[1.5px] border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 transition-colors duration-200 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 md:py-3 md:text-lg"
							bind:value={nama}
							required
						/>
					</div>

					<!-- Toggle Laci Kasir -->
					<div>
						<label
							class="mb-2 block text-sm font-medium text-pink-500 md:text-base"
							for="laci-kasir-toggle">Laci Kasir</label
						>
						<div
							class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 md:p-4"
						>
							<div class="flex items-center gap-3 md:gap-4">
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full md:h-10 md:w-10 {paymentMethod ===
									'tunai'
										? 'bg-green-500 text-white'
										: 'bg-gray-300 text-gray-600'}"
								>
									<svg
										class="h-4 w-4 md:h-5 md:w-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
								</div>
								<div>
									<div class="text-sm font-medium text-gray-800 md:text-base">
										Uang {mode === 'pemasukan' ? 'Masuk' : 'Keluar'} Laci
									</div>
									<div class="text-xs text-gray-500 md:text-sm">
										{paymentMethod === 'tunai'
											? 'Ya, dari laci kasir'
											: 'Tidak, bukan dari laci kasir'}
									</div>
								</div>
							</div>
							<button
								id="laci-kasir-toggle"
								type="button"
								class="relative h-6 w-12 rounded-full transition-colors duration-300 md:h-7 md:w-14 {paymentMethod ===
								'tunai'
									? 'bg-green-500'
									: 'bg-gray-300'}"
								onclick={() => (paymentMethod = paymentMethod === 'tunai' ? 'non-tunai' : 'tunai')}
								onkeydown={(e) =>
									e.key === 'Enter' &&
									(paymentMethod = paymentMethod === 'tunai' ? 'non-tunai' : 'tunai')}
								aria-label="Toggle laci kasir"
							>
								<div
									class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 md:h-6 md:w-6 {paymentMethod ===
									'tunai'
										? 'translate-x-6 md:translate-x-7'
										: 'translate-x-0'}"
								></div>
							</button>
						</div>
					</div>
					{#if error}
						<div class="mt-1 text-center text-sm text-pink-600 md:text-base">{error}</div>
					{/if}
				</form>
			</div>
		</div>
	</main>
	<!-- Button Simpan -->
	<div class="fixed right-0 bottom-[56px] left-0 z-30 px-4 pt-2 pb-3">
		<div class="mx-auto max-w-md md:mx-auto md:max-w-lg">
			<button
				type="submit"
				form="catat-form"
				class="mt-1 w-full rounded-xl border-none bg-pink-500 py-4 text-lg font-bold text-white shadow-lg shadow-pink-500/10 transition-all duration-300 hover:bg-pink-600 active:bg-pink-700"
			>
				Simpan
			</button>
		</div>
	</div>
</div>

<style>
	main {
		flex: 1 1 auto;
	}
	@keyframes slideUp {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
