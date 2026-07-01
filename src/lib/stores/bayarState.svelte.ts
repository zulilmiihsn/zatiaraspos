import { goto } from '$app/navigation';
import { v4 as uuidv4 } from 'uuid';
import { validateNumber, sanitizeInput } from '$lib/utils/validation';
import { securityUtils } from '$lib/utils/security';
import { userRole } from '$lib/stores/userRole.svelte';
import { buildSaleReceiptHtml, printViaIntent } from '$lib/utils/receiptPrint';
import { addPendingTransaction } from '$lib/utils/offline';
import { ErrorHandler, parseApiError } from '$lib/utils/errorHandling';
import { formatRupiah } from '$lib/utils/currency';
import { NOTIF } from '$lib/constants/ui';
import { transactionService } from '$lib/services/transactionService';
import { cacheOrchestrator } from '$lib/utils/cacheOrchestrator';
import { refreshBus } from '$lib/utils/refreshBus';
import { getSesiAktif } from '$lib/services/sesiTokoService';
import { fetchWithCsrfRetry } from '$lib/utils/csrf';
import type { ReceiptSettings } from '$lib/types/laporan';
import type { TokoSession } from '$lib/types/store';
import type { CartItem } from '$lib/types/cart';
import type { NotifModalType } from '$lib/components/shared/NotifModal.svelte';

export function createBayarState() {
	let cart = $state<CartItem[]>([]);
	let customerName = $state('');
	let paymentMethod = $state('');
	let isOffline = $state(false);
	let showCancelModal = $state(false);
	let showCashModal = $state(false);
	let cashReceived = $state('');
	let showSuccessModal = $state(false);
	let showQrisWarning = $state(false);
	let transactionId = $state('');
	let transactionCode = $state('');
	let transactionQueuedOffline = $state(false);
	let showErrorNotification = $state(false);
	let errorNotificationMessage = $state('');
	let showNotifModal = $state(false);
	let notifModalMsg = $state('');
	let notifModalType = $state<NotifModalType>('warning');

	let pengaturanStruk: ReceiptSettings | null = null;
	let sesiAktif: TokoSession | null = null;
	let errorNotificationTimeout: number | null = null;

	const currentUserRole = $derived(userRole.value || '');

	const totalQty = $derived(cart.reduce((sum, item) => sum + item.jumlah, 0));
	const totalHarga = $derived(
		cart.reduce((sum, item) => {
			let itemTotal = item.jumlah * (item.product.harga ?? 0);
			if (item.addOns) {
				itemTotal += item.addOns.reduce(
					(total, addOn) => total + (addOn.harga ?? 0) * item.jumlah,
					0
				);
			}
			return sum + itemTotal;
		}, 0)
	);
	const kembalian = $derived((parseInt(cashReceived) || 0) - totalHarga);
	const formattedCashReceived = $derived(cashReceived ? formatRupiah(parseInt(cashReceived)) : '');
	const canPay = $derived(
		Boolean(
			paymentMethod &&
				customerName.trim() &&
				cart.length > 0 &&
				(!isOffline || paymentMethod === 'tunai')
		)
	);

	function cartItemKey(item: CartItem): string {
		return [
			item.product.id,
			item.addOns
				.map((addOn) => addOn.id)
				.sort()
				.join(','),
			item.gula,
			item.es,
			item.catatan
		].join('|');
	}

	function showErrorNotif(message: string) {
		errorNotificationMessage = message;
		showErrorNotification = true;
		if (errorNotificationTimeout !== null) clearTimeout(errorNotificationTimeout);
		errorNotificationTimeout = window.setTimeout(() => {
			showErrorNotification = false;
		}, NOTIF.TOAST_MS);
	}

	function generateTransactionCode() {
		let lastNum = parseInt(localStorage.getItem('last_jus_id') || '0', 10);
		lastNum++;
		localStorage.setItem('last_jus_id', lastNum.toString());
		return `JUS${lastNum.toString().padStart(5, '0')}`;
	}

	async function cekSesiTokoAktif() {
		sesiAktif = await getSesiAktif();
	}

	async function fetchPengaturanStruk() {
		try {
			const data = (await transactionService.getOne(
				'pengaturan'
			)) as unknown as ReceiptSettings | null;
			if (data) {
				pengaturanStruk = data;
				localStorage.setItem('pengaturan_struk', JSON.stringify(data));
			} else {
				const local = localStorage.getItem('pengaturan_struk');
				if (local) pengaturanStruk = JSON.parse(local);
			}
		} catch {
			const local = localStorage.getItem('pengaturan_struk');
			if (local) pengaturanStruk = JSON.parse(local);
		}
	}

	function init() {
		const saved = localStorage.getItem('pos_cart');
		if (saved) {
			try {
				cart = JSON.parse(saved);
			} catch {
				/* cart localStorage korup → biarkan keranjang kosong */
			}
		}
		transactionId = uuidv4();
		transactionCode = generateTransactionCode();
		cekSesiTokoAktif();
		fetchPengaturanStruk();
	}

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
			showQrisWarning = true;
		}
	}
	async function confirmQrisChecked() {
		showQrisWarning = false;
		cashReceived = totalHarga.toString();
		showSuccessModal = await catatTransaksiKeLaporan();
	}
	function addCashTemplate(nom: number) {
		cashReceived = ((parseInt(cashReceived) || 0) + nom).toString();
	}
	function closeCashModal() {
		showCashModal = false;
	}
	async function finishCash() {
		const cashValidation = validateNumber(cashReceived, { required: true, min: totalHarga });
		if (!cashValidation.isValid) {
			showErrorNotif(`Error: ${cashValidation.errors.join(', ')}`);
			return;
		}
		if (!securityUtils.checkFormRateLimit('payment_completion')) {
			showErrorNotif('Terlalu banyak transaksi. Silakan tunggu sebentar.');
			return;
		}
		const sanitizedCashReceived = sanitizeInput(cashReceived);
		const sanitizedPaymentMethod = sanitizeInput(paymentMethod);
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
			items: cart.map((item) => {
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
				const response = await fetchWithCsrfRetry('/api/pos/transaction', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestPayload)
				});
				if (!response.ok) {
					throw new Error(await parseApiError(response, `HTTP ${response.status}`));
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
				notifModalMsg =
					'Gagal mencatat transaksi: ' + ErrorHandler.extractErrorMessage(error);
				notifModalType = 'error';
				showNotifModal = true;
				return false;
			}
			await cacheOrchestrator.invalidateCacheOnChange('buku_kas');
			await cacheOrchestrator.invalidateCacheOnChange('transaksi_kasir');
			refreshBus.emit('dashboard');
		} else {
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
		printViaIntent(
			buildSaleReceiptHtml({
				settings: pengaturanStruk,
				items: cart,
				customerName,
				total: totalHarga,
				paymentMethod,
				cashReceived: parseInt(cashReceived) || 0,
				change: kembalian,
				queuedOffline: transactionQueuedOffline
			})
		);
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
	function setOffline(value: boolean) {
		isOffline = value;
		if (isOffline && paymentMethod && paymentMethod !== 'tunai') paymentMethod = 'tunai';
	}

	return {
		get cart() { return cart; },
		set cart(v) { cart = v; },
		get customerName() { return customerName; },
		set customerName(v) { customerName = v; },
		get paymentMethod() { return paymentMethod; },
		set paymentMethod(v) { paymentMethod = v; },
		get isOffline() { return isOffline; },
		set isOffline(v) { isOffline = v; },
		get showCancelModal() { return showCancelModal; },
		get showCashModal() { return showCashModal; },
		get cashReceived() { return cashReceived; },
		set cashReceived(v) { cashReceived = v; },
		get showSuccessModal() { return showSuccessModal; },
		get showQrisWarning() { return showQrisWarning; },
		get transactionId() { return transactionId; },
		set transactionId(v) { transactionId = v; },
		get transactionCode() { return transactionCode; },
		set transactionCode(v) { transactionCode = v; },
		get transactionQueuedOffline() { return transactionQueuedOffline; },
		get showErrorNotification() { return showErrorNotification; },
		get errorNotificationMessage() { return errorNotificationMessage; },
		get showNotifModal() { return showNotifModal; },
		set showNotifModal(v) { showNotifModal = v; },
		get notifModalMsg() { return notifModalMsg; },
		get notifModalType() { return notifModalType; },
		get currentUserRole() { return currentUserRole; },
		get totalQty() { return totalQty; },
		get totalHarga() { return totalHarga; },
		get kembalian() { return kembalian; },
		get formattedCashReceived() { return formattedCashReceived; },
		set formattedCashReceived(_v) { /* oninput handles cashReceived directly */ },
		get canPay() { return canPay; },
		cartItemKey,
		init,
		setOffline,
		cekSesiTokoAktif,
		fetchPengaturanStruk,
		generateTransactionCode,
		handleCancel,
		confirmCancel,
		closeModal,
		handleBayar,
		confirmQrisChecked,
		addCashTemplate,
		closeCashModal,
		finishCash,
		handleKeypad,
		closeNotifModal,
		printStrukViaEscPosService,
		handleAddCashTemplate,
		handleKeypadButton,
		handleSetPaymentMethod,
		handleBackToKasir
	};
}
