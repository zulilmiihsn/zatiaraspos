<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import ModalSheet from '$lib/components/shared/modalSheet.svelte';
	import { validateNumber, sanitizeInput } from '$lib/utils/validation';
	import { securityUtils } from '$lib/utils/security';
	import { v4 as uuidv4 } from 'uuid';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { userRole } from '$lib/stores/userRole.svelte';
	import { LOGO_BASE64 } from '$lib/utils/logoBase64';
	import { printViaIntent, DEFAULT_RECEIPT_SETTINGS, METHOD_LABELS } from '$lib/utils/receiptPrint';

	import { addPendingTransaction } from '$lib/utils/offline';
	import { ErrorHandler } from '$lib/utils/errorHandling';
	import { formatRupiah } from '$lib/utils/currency';
	import { dataService } from '$lib/services/dataService';
	import { refreshBus } from '$lib/utils/refreshBus';
	import { getSesiAktif } from '$lib/services/sesiTokoService';
	import type { ReceiptSettings } from '$lib/types/laporan';
	import type { TokoSession } from '$lib/types/store';
	import {
		ArrowLeft,
		Banknote,
		CreditCard,
		ReceiptText,
		ShoppingBag,
		UserRound,
		WifiOff
	} from 'lucide-svelte';

	interface BayarAddOn {
		id: string;
		nama: string;
		harga: number;
	}
	interface BayarCartItem {
		product: { id: string; nama: string; harga: number; tipe: string };
		jumlah: number;
		addOns: BayarAddOn[];
		gula: string;
		es: string;
		catatan: string;
	}

	let cart: BayarCartItem[] = $state([]);
	let customerName = $state('');
	let paymentMethod = $state('');
	let isOffline = $state(false);
	const paymentOptions = [
		{ id: 'tunai', label: 'Tunai' },
		{ id: 'qris', label: 'QRIS' }
	];
	let showCancelModal = $state(false);
	let showCashModal = $state(false);
	let cashReceived = $state('');
	const cashTemplates = [5000, 10000, 20000, 50000, 100000];
	let keypad = [
		[1, 2, 3],
		[4, 5, 6],
		[7, 8, 9],
		['⌫', 0, 'C']
	];
	let showSuccessModal = $state(false);
	let showQrisWarning = $state(false);
	let transactionId = $state('');
	let transactionCode = $state('');
	let transactionQueuedOffline = $state(false);

	let showErrorNotification = $state(false);
	let errorNotificationMessage = $state('');
	let errorNotificationTimeout: number | null = null;

	let currentUserRole = $derived(userRole.value || '');

	let showNotifModal = $state(false);
	let notifModalMsg = $state('');
	let notifModalType = $state('warning'); // 'warning' | 'success' | 'error'

	let pengaturanStruk: ReceiptSettings | null = null;

	function showErrorNotif(message: string) {
		errorNotificationMessage = message;
		showErrorNotification = true;
		if (errorNotificationTimeout !== null) clearTimeout(errorNotificationTimeout);
		errorNotificationTimeout = window.setTimeout(() => {
			showErrorNotification = false;
		}, 3000);
	}

	function generateTransactionCode() {
		// Ambil nomor urut terakhir dari localStorage
		let lastNum = parseInt(localStorage.getItem('last_jus_id') || '0', 10);
		lastNum++;
		localStorage.setItem('last_jus_id', lastNum.toString());
		return `JUS${lastNum.toString().padStart(5, '0')}`;
	}

	let sesiAktif: TokoSession | null = null;
	async function cekSesiTokoAktif() {
		sesiAktif = await getSesiAktif();
	}

	async function fetchPengaturanStruk() {
		try {
			const data = (await dataService.getOne('pengaturan')) as unknown as ReceiptSettings | null;
			if (data) {
				pengaturanStruk = data;
				localStorage.setItem('pengaturan_struk', JSON.stringify(data));
			} else {
				// fallback ke localStorage
				const local = localStorage.getItem('pengaturan_struk');
				if (local) pengaturanStruk = JSON.parse(local);
			}
		} catch {
			const local = localStorage.getItem('pengaturan_struk');
			if (local) pengaturanStruk = JSON.parse(local);
		}
	}

	onMount(() => {
		const updateConnectionState = () => {
			isOffline = !navigator.onLine;
			if (isOffline && paymentMethod && paymentMethod !== 'tunai') paymentMethod = 'tunai';
		};
		updateConnectionState();
		window.addEventListener('online', updateConnectionState);
		window.addEventListener('offline', updateConnectionState);
		cekSesiTokoAktif();
		fetchPengaturanStruk();
		const saved = localStorage.getItem('pos_cart');
		if (saved) {
			try {
				cart = JSON.parse(saved);
			} catch {}
		}
		transactionId = uuidv4(); // UUID untuk database
		transactionCode = generateTransactionCode(); // Untuk tampilan/struk
		return () => {
			window.removeEventListener('online', updateConnectionState);
			window.removeEventListener('offline', updateConnectionState);
		};
	});

	let { totalQty, totalHarga } = $derived(
		(() => {
			let totalQty = 0;
			let totalHarga = 0;
			for (const item of cart) {
				totalQty += item.jumlah;
				totalHarga += item.jumlah * (item.product.harga ?? 0);
				if (item.addOns) {
					totalHarga += item.addOns.reduce(
						(a: number, b: BayarAddOn) => a + (b.harga ?? 0) * item.jumlah,
						0
					);
				}
			}
			return { totalQty, totalHarga };
		})()
	);
	let kembalian = $derived((parseInt(cashReceived) || 0) - totalHarga);
	let formattedCashReceived = $derived(
		cashReceived ? formatRupiah(parseInt(cashReceived)) : ''
	);
	let canPay = $derived(
		Boolean(
			paymentMethod &&
				customerName.trim() &&
				cart.length > 0 &&
				(!isOffline || paymentMethod === 'tunai')
		)
	);

	function handleCancel() {
		showCancelModal = true;
	}
	function confirmCancel() {
		showCancelModal = false;
		goto('/pos');
	}
	function closeModal() {
		showCancelModal = false;
	}
	function handleBayar() {
		if (isOffline && paymentMethod !== 'tunai') {
			showErrorNotif('Saat offline, pembayaran hanya tersedia untuk tunai.');
			return;
		}
		if (paymentMethod === 'tunai') {
			showCashModal = true;
			cashReceived = '';
		} else {
			// Non-tunai: tampilkan modal warning dulu
			showQrisWarning = true;
		}
	}
	async function confirmQrisChecked() {
		showQrisWarning = false;
		cashReceived = totalHarga.toString(); // QRIS = dibayar pas → kembalian otomatis 0 via $derived
		showSuccessModal = await catatTransaksiKeLaporan();
	}
	function addCashTemplate(nom: number) {
		cashReceived = ((parseInt(cashReceived) || 0) + nom).toString();
	}
	function closeCashModal() {
		showCashModal = false;
	}
	async function finishCash() {
		// Validate cash received
		const cashValidation = validateNumber(cashReceived, { required: true, min: totalHarga });
		if (!cashValidation.isValid) {
			showErrorNotif(`Error: ${cashValidation.errors.join(', ')}`);
			return;
		}

		// Check rate limiting
		if (!securityUtils.checkFormRateLimit('payment_completion')) {
			showErrorNotif('Terlalu banyak transaksi. Silakan tunggu sebentar.');
			return;
		}

		// Sanitize inputs
		const sanitizedCashReceived = sanitizeInput(cashReceived);
		const sanitizedPaymentMethod = sanitizeInput(paymentMethod);

		// Check for suspicious activity
		const allInputs = `${sanitizedCashReceived}${sanitizedPaymentMethod}${totalHarga}`;
		if (securityUtils.detectSuspiciousActivity('payment_completion', allInputs)) {
			showErrorNotif('Aktivitas pembayaran mencurigakan terdeteksi. Silakan coba lagi.');
			securityUtils.logSecurityEvent('suspicious_payment_activity', {
				cashReceived: sanitizedCashReceived,
				paymentMethod: sanitizedPaymentMethod,
				totalHarga
			});
			return;
		}

		// Proses pembayaran tunai selesai
		if (await catatTransaksiKeLaporan()) {
			securityUtils.logSecurityEvent('payment_completed', {
				paymentMethod: sanitizedPaymentMethod,
				totalAmount: totalHarga,
				cashReceived: parseInt(sanitizedCashReceived),
				change: kembalian,
				itemsCount: cart.length,
				queuedOffline: transactionQueuedOffline
			});
			showCashModal = false;
			showSuccessModal = true;
		}
	}
	function handleKeypad(val: string | number) {
		if (val === '⌫') {
			cashReceived = cashReceived.slice(0, -1);
		} else {
			cashReceived = (cashReceived + val).replace(/^0+(?!$)/, '');
		}
	}

	async function catatTransaksiKeLaporan(): Promise<boolean> {
		transactionQueuedOffline = false;
		await cekSesiTokoAktif();
		if (!cart || cart.length === 0 || totalHarga <= 0) {
			notifModalMsg = 'Transaksi tidak valid: keranjang kosong atau total harga 0.';
			notifModalType = 'error';
			showNotifModal = true;
			return false;
		}
		const id_sesi_toko = sesiAktif?.id || null;
		if (!id_sesi_toko && currentUserRole === 'kasir') {
			notifModalMsg = 'Kasir tidak boleh melakukan transaksi saat toko tutup!';
			notifModalType = 'error';
			showNotifModal = true;
			return false;
		}
		if (!id_sesi_toko && currentUserRole === 'pemilik') {
			notifModalMsg =
				'PERINGATAN: Tidak ada sesi toko aktif! Transaksi akan dianggap di luar sesi dan tidak masuk ringkasan tutup toko.';
			notifModalType = 'warning';
			showNotifModal = true;
		}
		const payment = paymentMethod === 'qris' ? 'non-tunai' : paymentMethod;
		if (!payment) {
			notifModalMsg = 'Metode pembayaran tidak valid!';
			notifModalType = 'error';
			showNotifModal = true;
			return false;
		}

		const requestPayload = {
			idempotency_key: transactionId || uuidv4(),
			nama_pelanggan: customerName || null,
			metode_bayar: payment,
			cash_received: cashReceived ? Number(cashReceived) : null,
			items: cart.map((item: BayarCartItem) => {
				const isCustom = item.product.id.toString().startsWith('custom-');
				return {
					product_id: isCustom ? null : item.product.id,
					nama_kustom: isCustom ? item.product.nama : null,
					custom_price: isCustom ? (item.product.harga ?? 0) : null,
					jumlah: item.jumlah,
					add_on_ids: (item.addOns || []).map((addOn) => addOn.id),
					gula: item.gula || null,
					es: item.es || null,
					catatan: item.catatan || null
				};
			})
		};

		if (navigator.onLine) {
			try {
				const response = await fetch('/api/pos/transaction', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestPayload)
				});
				if (!response.ok) {
					const errorBody = await response.json().catch(() => ({}));
					throw new Error(errorBody?.message || errorBody?.error || `HTTP ${response.status}`);
				}
			} catch (error) {
				if (error instanceof TypeError || !navigator.onLine) {
					try {
						await queueCurrentPosTransaction(requestPayload);
					} catch (queueError) {
						notifModalMsg = ErrorHandler.extractErrorMessage(queueError);
						notifModalType = 'error';
						showNotifModal = true;
						return false;
					}
					notifModalMsg = 'Transaksi tersimpan lokal. Status: menunggu sinkronisasi.';
					notifModalType = 'success';
					showNotifModal = true;
					transactionQueuedOffline = true;
					return true;
				}
				notifModalMsg = 'Gagal mencatat transaksi: ' + ErrorHandler.extractErrorMessage(error);
				notifModalType = 'error';
				showNotifModal = true;
				return false;
			}
			// Setelah transaksi berhasil, invalidate cache dashboard/laporan dan fetch ulang data
			await dataService.invalidateCacheOnChange('buku_kas');
			await dataService.invalidateCacheOnChange('transaksi_kasir');
			refreshBus.emit('dashboard');
		} else {
			// Offline mode: simpan request POS mentah, server tetap menghitung harga saat sync.
			try {
				await queueCurrentPosTransaction(requestPayload);
			} catch (queueError) {
				notifModalMsg = ErrorHandler.extractErrorMessage(queueError);
				notifModalType = 'error';
				showNotifModal = true;
				return false;
			}
			notifModalMsg = 'Transaksi tersimpan lokal. Status: menunggu sinkronisasi.';
			notifModalType = 'success';
			showNotifModal = true;
			transactionQueuedOffline = true;
		}
		return true;
	}

	async function queueCurrentPosTransaction(request: Record<string, unknown>): Promise<void> {
		await addPendingTransaction({
			type: 'pos_transaction',
			request,
			summary: {
				transaction_code: transactionCode,
				total_amount: totalHarga,
				jumlah_item: totalQty,
				created_at: new Date().toISOString()
			}
		});
	}

	function closeNotifModal() {
		showNotifModal = false;
	}

	function printStrukViaEscPosService() {
		// Gunakan pengaturanStruk jika ada, fallback default
		const pengaturan = pengaturanStruk || DEFAULT_RECEIPT_SETTINGS;
		let html = `<html><body style='font-family:monospace;color:#000;font-size:14px;line-height:1.5;margin:0;padding:8px;'>`;
		// Header
		html += `<div style='text-align:center;margin-bottom:16px;'>`;
		html += `<img src='${LOGO_BASE64}' style='width:80px;height:80px;margin:0 auto 8px;display:block;' />`;
		html += `<div style='font-weight:bold;font-size:20px;text-transform:uppercase;'>${pengaturan.nama_toko}</div>`;
		html += `<div style='font-size:13px;margin-top:4px;'>${pengaturan.alamat}</div>`;
		if (pengaturan.instagram || pengaturan.telepon) {
			html += `<div style='font-size:13px;margin-top:2px;'>${pengaturan.instagram ? pengaturan.instagram : ''}${pengaturan.instagram && pengaturan.telepon ? ' | ' : ''}${pengaturan.telepon ? pengaturan.telepon : ''}</div>`;
		}
		html += `</div>`;
		html += `<div style='border-bottom:1px dashed #333;margin-bottom:12px;'></div>`;
		// Info pelanggan & waktu
		html += `<div style='text-align:left;font-size:13px;margin-bottom:12px;display:flex;justify-content:space-between;'>`;
		html += `<div>${customerName || ''}</div>`;
		html += `<div>${new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</div>`;
		html += `</div>`;
		if (transactionQueuedOffline) {
			html += `<div style='font-size:12px;margin-bottom:12px;'><b>STATUS: MENUNGGU SINKRONISASI</b></div>`;
		}
		// Daftar pesanan
		html += `<table style='width:100%;font-size:14px;margin-bottom:12px;border-collapse:collapse;'><tbody>`;
		cart.forEach((item: BayarCartItem, idx: number) => {
			html += `<tr><td style='text-align:left;padding-bottom:4px;font-weight:bold;'>${item.product.nama} <span style='font-size:12px;font-weight:normal;'>x${item.jumlah}</span></td><td style='text-align:right;padding-bottom:4px;'>Rp${formatRupiah(item.product.harga ?? 0)}</td></tr>`;
			if (item.addOns && item.addOns.length > 0) {
				item.addOns.forEach((a: BayarAddOn) => {
					html += `<tr><td style='font-size:12px;padding-left:8px;color:#333;'>+ ${a.nama}</td><td style='font-size:12px;text-align:right;color:#333;'>Rp${formatRupiah((a.harga ?? 0) * item.jumlah)}</td></tr>`;
				});
			}
			const detail = [
				item.gula && item.gula !== 'normal'
					? item.gula === 'no'
						? 'Tanpa Gula'
						: item.gula === 'less'
							? 'Sedikit Gula'
							: item.gula
					: null,
				item.es && item.es !== 'normal'
					? item.es === 'no'
						? 'Tanpa Es'
						: item.es === 'less'
							? 'Sedikit Es'
							: item.es
					: null,
				item.catatan && item.catatan.trim() ? item.catatan : null
			]
				.filter(Boolean)
				.join(', ');
			if (detail)
				html += `<tr><td colspan='2' style='font-size:12px;padding-left:8px;padding-bottom:8px;color:#333;font-style:italic;'>${detail}</td></tr>`;
		});
		html += `</tbody></table>`;
		html += `<div style='border-bottom:1px dashed #333;margin-bottom:12px;'></div>`;
		// Ringkasan
		html += `<table style='width:100%;font-size:14px;margin-bottom:24px;border-collapse:collapse;'><tbody>`;
		html += `<tr><td style='text-align:left;padding-bottom:4px;'>Total:</td><td style='text-align:right;font-weight:bold;font-size:16px;'>Rp${formatRupiah(totalHarga)}</td></tr>`;
		html += `<tr><td style='text-align:left;font-size:13px;padding-top:4px;'>Metode:</td><td style='text-align:right;font-size:13px;padding-top:4px;'>${METHOD_LABELS[paymentMethod] || paymentMethod}</td></tr>`;
		if (paymentMethod === 'tunai') {
			html += `<tr><td style='text-align:left;font-size:13px;'>Dibayar:</td><td style='text-align:right;font-size:13px;'>Rp${formatRupiah(parseInt(cashReceived) || 0)}</td></tr>`;
			html += `<tr><td style='text-align:left;font-size:13px;'>Kembalian:</td><td style='text-align:right;font-size:13px;'>Rp${kembalian >= 0 ? formatRupiah(kembalian) : '0'}</td></tr>`;
		}
		html += `</tbody></table>`;
		// Ucapan
		html += `<div style='text-align:center;font-size:13px;white-space:pre-line;'>${pengaturan.ucapan}</div>`;
		html += `</body></html>`;

		printViaIntent(html);
	}

	function handleAddCashTemplate(t: number) {
		addCashTemplate(t);
	}
	function handleKeypadButton(key: string | number) {
		if (key === 'C') cashReceived = '';
		else handleKeypad(key);
	}
	function handleSetPaymentMethod(id: string) {
		if (isOffline && id !== 'tunai') {
			showErrorNotif('QRIS membutuhkan koneksi internet.');
			return;
		}
		paymentMethod = id;
	}
	function handleBackToKasir() {
		showSuccessModal = false;
		goto('/pos');
	}
</script>

<main class="page-content min-h-[100dvh] flex-1 overflow-y-auto bg-white px-4 pt-4 pb-28">
	<div class="mx-auto max-w-4xl">

		{#if cart.length === 0}
			<div
				class="flex min-h-[62dvh] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-12 text-center shadow-sm"
			>
				<ShoppingBag class="mb-4 h-12 w-12 text-stone-400" />
				<div class="mb-2 text-xl font-bold text-stone-950">Keranjang kosong</div>
				<div class="mb-5 max-w-xs text-sm text-stone-500">
					Tambah menu dari layar kasir sebelum lanjut pembayaran.
				</div>
				<button
					class="rounded-xl bg-pink-500 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 active:scale-[0.98]"
					type="button"
					onclick={() => goto('/pos')}>Kembali ke Kasir</button
				>
			</div>
		{:else}
			<div class="mx-auto flex max-w-lg flex-col gap-4 pb-8">
				{#if isOffline}
					<div class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
						<WifiOff class="mt-0.5 h-5 w-5 shrink-0" />
						<div>
							<div class="text-sm font-bold">Mode offline</div>
							<div class="mt-0.5 text-xs leading-5 text-amber-800">
								Pembayaran tunai akan disimpan lokal sampai koneksi kembali.
							</div>
						</div>
					</div>
				{/if}

				<!-- 1. Nama Pelanggan -->
				<div class="rounded-2xl border-[1.5px] border-pink-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]">
					<label class="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700" for="nama">
						<UserRound class="h-4 w-4 text-pink-500" />
						Nama Pelanggan
					</label>
					<input id="nama" type="text" class="w-full rounded-xl border-[1.5px] border-pink-100 bg-pink-50/30 px-3 py-3 text-base text-stone-900 transition-all duration-200 outline-none placeholder:text-stone-400 focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-500/10" placeholder="Masukkan nama pelanggan..." bind:value={customerName} maxlength="50" />
				</div>

				<!-- 2. Pesanan & 3. Total Tagihan -->
				<div class="rounded-2xl border-[1.5px] border-pink-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]">
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2 font-semibold text-stone-900">
							<ReceiptText class="h-5 w-5 text-pink-500" />
							Pesanan
						</div>
						<div class="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
							{totalQty} item
						</div>
					</div>
					<ul class="divide-y divide-stone-100">
						{#each cart as item}
							<li class="flex flex-col gap-1 py-3">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<div class="truncate font-semibold text-stone-950">{item.product.nama}</div>
										<div class="mt-0.5 text-xs font-semibold text-stone-500">x{item.jumlah}</div>
									</div>
									<span class="shrink-0 font-bold text-pink-500">Rp {formatRupiah((item.product.harga ?? 0) * item.jumlah)}</span>
								</div>
								{#if item.addOns && item.addOns.length > 0}
									<div class="mt-1 flex flex-col gap-0.5 rounded-lg bg-stone-50 px-3 py-2">
										{#each item.addOns as ekstra}
											<div class="flex justify-between gap-3 text-xs font-medium text-stone-600">
												<span class="truncate">+ {ekstra.nama}</span>
												<span class="shrink-0">Rp {formatRupiah((ekstra.harga ?? 0) * item.jumlah)}</span>
											</div>
										{/each}
									</div>
								{/if}
								{#if (item.gula && item.gula !== 'normal') || (item.es && item.es !== 'normal') || (item.catatan && item.catatan.trim())}
									<div class="text-xs font-medium text-stone-500">
										{[item.gula && item.gula !== 'normal' ? item.gula === 'no' ? 'Tanpa Gula' : item.gula === 'less' ? 'Sedikit Gula' : item.gula : null, item.es && item.es !== 'normal' ? item.es === 'no' ? 'Tanpa Es' : item.es === 'less' ? 'Sedikit Es' : item.es : null, item.catatan && item.catatan.trim() ? item.catatan : null].filter(Boolean).join(', ')}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
					<!-- Total Tagihan -->
					<div class="mt-2 flex items-end justify-between border-t border-dashed border-stone-200 pt-4 pb-1">
						<div class="text-sm font-semibold text-stone-500">Total Tagihan</div>
						<div class="text-2xl font-bold tracking-tight text-stone-900">Rp {formatRupiah(totalHarga)}</div>
					</div>
				</div>

				<!-- 4. Metode Pembayaran -->
				<div class="rounded-2xl border-[1.5px] border-pink-100 bg-white p-4 shadow-[0_2px_8px_-2px_rgba(236,72,153,0.05)]">
					<div class="mb-3 text-sm font-semibold text-stone-700">Metode Pembayaran</div>
					<div class="grid grid-cols-2 gap-3">
						{#each paymentOptions as opt}
							<button type="button" class="flex flex-col items-center justify-center gap-2 rounded-xl border px-4 py-4 text-base font-semibold transition-all duration-200 active:scale-[0.98] {paymentMethod === opt.id ? 'border-pink-500 bg-pink-50 text-pink-500 shadow-sm' : 'border-pink-100 bg-white text-stone-700'} {isOffline && opt.id !== 'tunai' ? 'cursor-not-allowed opacity-45' : ''}" onclick={() => handleSetPaymentMethod(opt.id)} disabled={isOffline && opt.id !== 'tunai'}>
								{#if opt.id === 'tunai'}
									<Banknote class="h-5 w-5" />
								{:else}
									<CreditCard class="h-5 w-5" />
								{/if}
								{opt.label}{isOffline && opt.id !== 'tunai' ? ' (online)' : ''}
							</button>
						{/each}
					</div>
				</div>

				<!-- 5. Konfirmasi & Batalkan Buttons -->
				<div class="mt-2 flex flex-col gap-3">
					<button class="w-full rounded-xl bg-pink-500 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-500/20 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-[1.5px] disabled:border-pink-100 disabled:bg-pink-50 disabled:text-pink-300 disabled:shadow-none" onclick={handleBayar} disabled={!canPay}>
						Konfirmasi & Bayar
					</button>
					{#if !canPay}
						<div class="text-center text-xs text-red-500">
							{#if !paymentMethod && !customerName.trim()}
								Isi nama pelanggan dan pilih metode pembayaran dulu
							{:else if !paymentMethod}
								Pilih metode pembayaran dulu
							{:else}
								Isi nama pelanggan dulu
							{/if}
						</div>
					{/if}
					<button class="mx-auto block w-full rounded-xl border-[1.5px] border-stone-200 bg-white py-3 text-sm font-bold text-stone-500 shadow-sm transition-all duration-200 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600 active:scale-[0.98]" type="button" onclick={handleCancel}>
						Batalkan pembayaran
					</button>
				</div>
			</div>
		{/if}
	</div>
</main>

{#if showCancelModal}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
		<div
			class="animate-slideUpModal mx-auto w-full max-w-sm rounded-t-2xl bg-white p-6 pb-4 shadow-lg"
		>
			<div class="mb-2 text-center text-lg font-bold text-gray-800">Batalkan Pembayaran?</div>
			<div class="mb-6 text-center text-gray-500">
				Apakah Anda yakin ingin membatalkan pembayaran dan kembali ke kasir?
			</div>
			<div class="flex flex-col gap-2">
				<button
					class="w-full rounded-lg bg-red-500 py-3 text-base font-bold text-white active:bg-red-600"
					onclick={confirmCancel}>Ya, batalkan</button
				>
				<button
					class="w-full rounded-lg bg-gray-100 py-3 text-base font-semibold text-gray-500"
					onclick={closeModal}>Tutup</button
				>
			</div>
		</div>
	</div>
{/if}

{#if showCashModal}
	<ModalSheet open={showCashModal} title="Pembayaran Tunai" onClose={closeCashModal}>
		<div class="pb-24 md:min-h-[60vh]">
			<div class="mb-4 text-center text-gray-500 md:mb-6 md:text-lg">
				Masukkan jumlah uang diterima
			</div>
			<input
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				class="mb-3 w-full rounded-lg border-2 border-pink-200 px-2 py-3 text-center text-xl font-bold outline-none focus:border-pink-400 md:mb-5 md:py-5 md:text-2xl"
				bind:value={formattedCashReceived}
				oninput={(e) => {
					const target = e.target as HTMLInputElement;
					const raw = target.value.replace(/\D/g, '');
					cashReceived = raw;
				}}
				placeholder="0"
			/>
			<div class="mb-4 flex flex-wrap justify-center gap-2 md:mb-6 md:gap-4">
				{#each cashTemplates as t}
					<button
						type="button"
						class="rounded-lg bg-pink-100 px-4 py-2 text-base font-bold text-pink-500 md:px-8 md:py-3 md:text-lg"
						onclick={() => handleAddCashTemplate(t)}
					>
						Rp {formatRupiah(t)}
					</button>
				{/each}
			</div>
			<div class="mx-auto grid w-full grid-cols-3 gap-2 md:gap-6">
				{#each keypad as row}
					{#each row as key}
						<button
							type="button"
							class="w-full rounded-xl bg-gray-100 py-3 text-xl font-bold text-gray-700 transition-all active:bg-pink-100 md:py-8 md:text-3xl {key ===
							'⌫'
								? 'col-span-1 text-pink-500'
								: ''} {key === 'C' ? 'text-red-500' : ''}"
							onclick={() => handleKeypadButton(key)}>{key}</button
						>
					{/each}
				{/each}
			</div>
		</div>
		{#snippet footer()}
			<div class="flex flex-col gap-2 md:gap-4">
				<div class="mb-2 text-center text-gray-700 md:mb-4 md:text-lg">
					Kembalian:
					<span class="font-bold {kembalian < 0 ? 'text-red-500' : 'text-green-500'}"
						>Rp {kembalian >= 0 ? formatRupiah(kembalian) : '0'}</span
					>
				</div>
				<button
					class="w-full rounded-lg bg-pink-500 py-3 text-base font-bold text-white active:bg-pink-600 disabled:opacity-50 md:py-5 md:text-xl"
					onclick={finishCash}
					disabled={kembalian < 0 || !cashReceived}
				>
					Selesai
				</button>
			</div>
		{/snippet}
	</ModalSheet>
{/if}

{#if showQrisWarning}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
		<div
			class="animate-slideUpModal qris-warning-modal mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-t-2xl bg-white p-8 pb-6 shadow-lg"
		>
			<div
				class="animate-bounceIn warning-icon mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100"
			>
				<svg width="40" height="40" fill="none" viewBox="0 0 24 24"
					><circle cx="12" cy="12" r="12" fill="#fde047" opacity="0.18" /><path
						d="M12 8v4m0 4h.01"
						stroke="#f59e42"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				>
			</div>
			<div class="warning-title mb-1 text-center text-xl font-bold text-yellow-600">
				Periksa Pembayaran QRIS
			</div>
			<div class="mb-2 text-center text-gray-700">
				Pastikan kasir sudah <span class="font-semibold text-pink-500">memeriksa nama merchant</span
				>
				dan <span class="font-semibold text-pink-500">nominal pembayaran</span> di aplikasi konsumen
				sebelum melanjutkan.
			</div>
			<button
				class="warning-btn mt-2 w-full rounded-lg bg-pink-500 py-3 text-base font-bold text-white transition-all active:bg-pink-600"
				onclick={confirmQrisChecked}>Sudah Diperiksa</button
			>
		</div>
	</div>
{/if}

{#if showSuccessModal}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
		<div
			class="animate-slideUpModal mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-t-2xl bg-white p-8 pb-6 shadow-lg"
		>
			<div
				class="animate-bounceIn mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-green-100"
			>
				<svg width="48" height="48" fill="none" viewBox="0 0 24 24"
					><circle cx="12" cy="12" r="12" fill="#4ade80" opacity="0.18" /><path
						d="M7 13l3 3 7-7"
						stroke="#22c55e"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				>
			</div>
			<div class="mb-1 text-center text-2xl font-bold text-green-600">
				{transactionQueuedOffline ? 'Transaksi Tersimpan' : 'Transaksi Berhasil!'}
			</div>
			<div class="mb-2 text-center text-gray-700">
				{#if transactionQueuedOffline}
					Tersimpan di perangkat dan menunggu sinkronisasi.<br />
				{:else}
					Pembayaran {paymentMethod === 'tunai' ? 'tunai' : paymentMethod.toUpperCase()} telah diterima.<br
					/>
				{/if}
				{#if customerName.trim()}
					<span class="font-semibold text-pink-500">{customerName.trim()}</span><br />
				{/if}
				Kembalian:
				<span class="font-bold text-pink-500"
					>Rp {kembalian >= 0 ? formatRupiah(kembalian) : '0'}</span
				>
			</div>
			<div class="mb-2 flex w-full flex-col gap-1 rounded-lg bg-pink-50 p-3">
				<div class="flex justify-between text-sm text-gray-500">
					<span>Total</span><span class="font-bold text-pink-500"
						>Rp {formatRupiah(totalHarga)}</span
					>
				</div>
				<div class="flex justify-between text-sm text-gray-500">
					<span>Dibayar</span><span class="font-bold text-green-600"
						>Rp {cashReceived ? formatRupiah(parseInt(cashReceived)) : '0'}</span
					>
				</div>
				<div class="flex justify-between text-sm text-gray-500">
					<span>Kembalian</span><span class="font-bold text-green-600"
						>Rp {kembalian >= 0 ? formatRupiah(kembalian) : '0'}</span
					>
				</div>
			</div>
			<div class="flex w-full flex-col gap-2">
				<button
					class="w-full rounded-lg bg-green-500 py-3 text-base font-bold text-white transition-all active:bg-green-600"
					onclick={printStrukViaEscPosService}>Cetak Struk</button
				>
				<button
					class="w-full rounded-lg bg-pink-500 py-3 text-base font-bold text-white transition-all active:bg-pink-600"
					onclick={handleBackToKasir}>Kembali ke Kasir</button
				>
			</div>
		</div>
	</div>
{/if}

{#if showErrorNotification}
	<div
		class="fixed top-20 left-1/2 z-50 rounded-xl bg-red-500 px-6 py-3 text-white shadow-lg transition-all duration-300 ease-out"
		style="transform: translateX(-50%);"
		in:fly={{ y: -32, duration: 300, easing: cubicOut }}
		out:fade={{ duration: 200 }}
	>
		{errorNotificationMessage}
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

<style>
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
	.animate-slideUpModal {
		animation: slideUpModal 0.32s cubic-bezier(0.4, 0, 0.2, 1);
	}
	@keyframes bounceIn {
		0% {
			transform: scale(0.7);
			opacity: 0;
		}
		60% {
			transform: scale(1.1);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}
	.animate-bounceIn {
		animation: bounceIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}
	/* Tambahan untuk modal warning QRIS di tablet */
	@media (min-width: 768px) {
		.qris-warning-modal {
			padding: 3rem 2.5rem 2.5rem 2.5rem !important;
		}
		.qris-warning-modal .warning-icon {
			width: 88px !important;
			height: 88px !important;
			min-width: 88px;
			min-height: 88px;
		}
		.qris-warning-modal .warning-title {
			font-size: 2rem !important;
		}
		.qris-warning-modal .warning-btn {
			font-size: 1.25rem !important;
			padding-top: 1.25rem !important;
			padding-bottom: 1.25rem !important;
		}
	}
</style>
