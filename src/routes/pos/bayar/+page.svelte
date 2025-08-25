<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import ModalSheet from '$lib/components/shared/modalSheet.svelte';
import { validateNumber, validateText, sanitizeInput } from '$lib/utils/validation';
import { securityUtils } from '$lib/utils/security';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { formatWitaDateTime } from '$lib/utils/index';
import { fly, fade } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { userRole } from '$lib/stores/userRole';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import * as pako from 'pako';
import { Base64 } from 'js-base64';
import { memoize } from '$lib/utils/performance';
import { addPendingTransaction } from '$lib/utils/offline';
import { ErrorHandler } from '$lib/utils/index';

let cart: any[] = [];
let customerName = '';
let paymentMethod = '';
const paymentOptions = [
  { id: 'cash', label: 'Tunai' },
  { id: 'qris', label: 'QRIS' },
];
let showCancelModal = false;
let showCashModal = false;
let cashReceived = '';
const cashTemplates = [5000, 10000, 20000, 50000, 100000];
let keypad = [
  [1,2,3],
  [4,5,6],
  [7,8,9],
  ['⌫',0,'C'],
];
let showSuccessModal = false;
let showQrisWarning = false;
let transactionId = '';
let transactionCode = '';

let showErrorNotification = false;
let errorNotificationMessage = '';
let errorNotificationTimeout: any = null;
let showSuccessNotification = false;
let successNotificationMessage = '';
let successNotificationTimeout: any = null;

let showNoSessionModal = false;
let noSessionModalMsg = '';

let currentUserRole = '';
userRole.subscribe(val => currentUserRole = val || '');

let showNotifModal = false;
let notifModalMsg = '';
let notifModalType = 'warning'; // 'warning' | 'success' | 'error'

let pengaturanStruk: any = null;

function showErrorNotif(message: string) {
  errorNotificationMessage = message;
  showErrorNotification = true;
  clearTimeout(errorNotificationTimeout);
  errorNotificationTimeout = setTimeout(() => {
    showErrorNotification = false;
  }, 3000);
}

function showSuccessNotif(message: string) {
  successNotificationMessage = message;
  showSuccessNotification = true;
  clearTimeout(successNotificationTimeout);
  successNotificationTimeout = setTimeout(() => {
    showSuccessNotification = false;
  }, 3000);
}

function generateTransactionCode() {
  // Ambil nomor urut terakhir dari localStorage
  let lastNum = parseInt(localStorage.getItem('last_jus_id') || '0', 10);
  lastNum++;
  localStorage.setItem('last_jus_id', lastNum.toString());
  return `JUS${lastNum.toString().padStart(5, '0')}`;
}

let sesiAktif: any = null;
async function cekSesiTokoAktif() {
  const { data } = await getSupabaseClient(storeGet(selectedBranch))
    .from('sesi_toko')
    .select('*')
    .eq('is_active', true)
    .order('opening_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  sesiAktif = data || null;
}

async function fetchPengaturanStruk() {
  try {
    const { data, error } = await getSupabaseClient(storeGet(selectedBranch))
      .from('pengaturan')
      .select('*')
      .eq('id', 1)
      .single();
    if (data) {
      pengaturanStruk = data;
    } else if (error) {
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
});

const calculateCartSummary = memoize((cart) => {
  let totalQty = 0;
  let totalHarga = 0;
  for (const item of cart) {
    totalQty += item.qty;
    totalHarga += item.qty * (item.product.price ?? item.product.harga ?? 0);
    if (item.addOns) {
      totalHarga += item.addOns.reduce((a: any, b: any) => a + ((b.price ?? b.harga ?? 0) * item.qty), 0);
    }
  }
  return { totalQty, totalHarga };
});

$: ({ totalQty, totalHarga } = calculateCartSummary(cart));
$: kembalian = (parseInt(cashReceived) || 0) - totalHarga;
$: formattedCashReceived = cashReceived ? parseInt(cashReceived).toLocaleString('id-ID') : '';

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
  if (paymentMethod === 'cash') {
    showCashModal = true;
    cashReceived = '';
  } else {
    // QRIS: tampilkan modal warning dulu
    showQrisWarning = true;
  }
}
function confirmQrisChecked() {
  showQrisWarning = false;
  showSuccessModal = true;
  cashReceived = totalHarga.toString(); // QRIS = dibayar pas
  kembalian = 0;
  // Catat ke laporan
  catatTransaksiKeLaporan();
}
function addCashTemplate(nom: any) {
  cashReceived = ((parseInt(cashReceived) || 0) + nom).toString();
}
function closeCashModal() {
  showCashModal = false;
}
function finishCash() {
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
  
  // Log successful payment
  securityUtils.logSecurityEvent('payment_completed', {
    paymentMethod: sanitizedPaymentMethod,
    totalAmount: totalHarga,
    cashReceived: parseInt(sanitizedCashReceived),
    change: kembalian,
    itemsCount: cart.length
  });
  
  // Proses pembayaran tunai selesai
  showCashModal = false;
  showSuccessModal = true;
  // Catat ke laporan
  catatTransaksiKeLaporan();
}
function handleKeypad(val: any) {
  if (val === '⌫') {
    cashReceived = cashReceived.slice(0, -1);
  } else {
    cashReceived = (cashReceived + val).replace(/^0+(?!$)/, '');
  }
}

function getLocalOffsetString() {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (n: any) => n.toString().padStart(2, '0');
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  return `${sign}${hours}:${minutes}`;
}

async function catatTransaksiKeLaporan() {
  await cekSesiTokoAktif();
  if (!cart || cart.length === 0 || totalHarga <= 0) {
    notifModalMsg = 'Transaksi tidak valid: keranjang kosong atau total harga 0.';
    notifModalType = 'error';
    showNotifModal = true;
    return;
  }
  const id_sesi_toko = sesiAktif?.id || null;
  if (!id_sesi_toko && currentUserRole === 'kasir') {
    notifModalMsg = 'Kasir tidak boleh melakukan transaksi saat toko tutup!';
    notifModalType = 'error';
    showNotifModal = true;
    return;
  }
  if (!id_sesi_toko && currentUserRole === 'pemilik') {
    notifModalMsg = 'PERINGATAN: Tidak ada sesi toko aktif! Transaksi akan dianggap di luar sesi dan tidak masuk ringkasan tutup toko.';
    notifModalType = 'warning';
    showNotifModal = true;
  }
  const now = new Date();
  const waktu = now.toISOString();
  const payment = paymentMethod === 'cash' ? 'tunai' : 'non-tunai';
  // Generate transaction_id sekali per transaksi
  const transactionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : uuidv4();
  // Satu row summary untuk buku_kas
  const totalAmount = cart.reduce((sum: any, item: any) => sum + item.qty * ((item.product.price ?? item.product.harga ?? 0) + (item.addOns ? item.addOns.reduce((a: any, b: any) => a + (b.price ?? b.harga ?? 0), 0) : 0)), 0);
  const description = 'Penjualan ' + cart.map((item: any) => item.product.name).join(', ');
  const totalQty = cart.reduce((sum: any, item: any) => sum + item.qty, 0);
  const insert = {
    tipe: 'in',
    sumber: 'pos',
    payment_method: payment,
    amount: totalAmount,
    description,
    customer_name: customerName || null,
    id_sesi_toko,
    waktu,
    jenis: 'pendapatan_usaha',
    qty: totalQty,
    transaction_id: transactionId
  };
  // Detail transaksi untuk transaksi_kasir
  const transaksiKasirInserts = cart.map((item: any) => {
    const addOnTotal = (item.addOns ? item.addOns.reduce((a: any, b: any) => a + (b.price ?? b.harga ?? 0), 0) : 0);
    const unitPrice = (item.product.price ?? item.product.harga ?? 0) + addOnTotal;
    return {
      // buku_kas_id: diisi saat online, biarkan null saat offline
      // Untuk custom item, set produk_id ke null dan simpan nama di custom_name
      produk_id: item.product.id.toString().startsWith('custom-') ? null : item.product.id,
      qty: item.qty,
      amount: unitPrice * item.qty,
      price: unitPrice,
      transaction_id: transactionId,
      // Tambahkan nama custom item jika ini adalah custom item
      custom_name: item.product.id.toString().startsWith('custom-') ? item.product.name : null
    };
  });
  if (!payment) {
    notifModalMsg = 'Metode pembayaran tidak valid!';
    notifModalType = 'error';
    showNotifModal = true;
    return;
  }
  if (navigator.onLine) {
    const { error } = await getSupabaseClient(storeGet(selectedBranch)).from('buku_kas').insert(insert);
    if (error) {
      notifModalMsg = 'Gagal mencatat transaksi: ' + ErrorHandler.extractErrorMessage(error);
      notifModalType = 'error';
      showNotifModal = true;
      return;
    }
    const { data: lastBukuKas, error: lastBukuKasError } = await getSupabaseClient(storeGet(selectedBranch))
      .from('buku_kas')
      .select('id, transaction_id, sumber, waktu')
      .eq('customer_name', customerName || null)
      .eq('transaction_id', transactionId)
      .order('waktu', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastBukuKas && lastBukuKas.id) {
      const transaksiKasirInserts = cart.map((item: any) => {
        const addOnTotal = (item.addOns ? item.addOns.reduce((a: any, b: any) => a + (b.price ?? b.harga ?? 0), 0) : 0);
        const unitPrice = (item.product.price ?? item.product.harga ?? 0) + addOnTotal;
        return {
        buku_kas_id: lastBukuKas.id,
        // Untuk custom item, set produk_id ke null dan simpan nama di custom_name
        produk_id: item.product.id.toString().startsWith('custom-') ? null : item.product.id,
        qty: item.qty,
          amount: unitPrice * item.qty,
          price: unitPrice,
        transaction_id: transactionId,
        // Tambahkan nama custom item jika ini adalah custom item
        custom_name: item.product.id.toString().startsWith('custom-') ? item.product.name : null
        };
      });
      if (transaksiKasirInserts.length) {
        const { error: errorKasir } = await getSupabaseClient(storeGet(selectedBranch)).from('transaksi_kasir').insert(transaksiKasirInserts);
      }
    }
    // Setelah transaksi berhasil, invalidate cache dashboard/laporan dan fetch ulang data
    import('$lib/services/dataService').then(async ({ dataService }) => {
      await dataService.invalidateCacheOnChange('buku_kas');
      await dataService.invalidateCacheOnChange('transaksi_kasir');
      if (typeof window !== 'undefined' && (window as any).refreshDashboardData) {
        await (window as any).refreshDashboardData();
      }
    });
  } else {
    // Offline mode: simpan summary dan detail ke pending
    addPendingTransaction({ bukuKas: insert, transaksiKasir: transaksiKasirInserts });
    notifModalMsg = 'Transaksi disimpan offline dan akan otomatis sync saat online.';
    notifModalType = 'success';
    showNotifModal = true;
  }
  // Hapus proses insert ke transaksi dan item_transaksi, karena sudah tidak digunakan
}

function closeNotifModal() {
  showNotifModal = false;
}

function printStrukViaEscPosService() {
  // Gunakan pengaturanStruk jika ada, fallback default
  const pengaturan = pengaturanStruk || {
    nama_toko: 'Zatiaras Juice',
    alamat: 'Jl. Contoh Alamat No. 123, Kota',
    telepon: '0812-3456-7890',
    instagram: '@zatiarasjuice',
    ucapan: 'Terima kasih sudah ngejus di\nZatiaras Juice!'
  };
  let html = `<html><body style='font-family:monospace;font-size:24px;line-height:2.0;margin:0;padding:0;'>`;
  // Header
  html += `<div style='text-align:center;margin-bottom:16px;line-height:1.5;'>`;
  html += `<div style='font-weight:bold;font-size:26px;'>${pengaturan.nama_toko}</div>`;
  html += `<div style='font-weight:bold;font-size:18px;'>${pengaturan.alamat}</div>`;
  if (pengaturan.instagram || pengaturan.telepon) {
    html += `<div style='font-weight:bold;font-size:18px;'>${pengaturan.instagram ? pengaturan.instagram : ''}${pengaturan.instagram && pengaturan.telepon ? ' ' : ''}${pengaturan.telepon ? pengaturan.telepon : ''}</div>`;
  }
  html += `</div>`;
  html += `<div style='border-bottom:1px dashed #000;margin-bottom:16px;'></div>`;
  // Info pelanggan & waktu
  html += `<div style='text-align:left;font-weight:normal;margin-bottom:16px;line-height:1.5;'>`;
  html += `${customerName ? customerName + '<br/>' : ''}`;
  html += `${new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}<br/>`;
  html += `</div>`;
  // Daftar pesanan
  html += `<table style='width:100%;font-size:24px;margin-bottom:16px;'><tbody>`;
  cart.forEach((item: any, idx: any) => {
    html += `<tr style='line-height:1.5;'><td style='text-align:left;'>${item.product.name} x${item.qty}</td><td style='text-align:right;'>Rp${(item.product.price ?? item.product.harga ?? 0).toLocaleString('id-ID')}</td></tr>`;
    if (item.addOns && item.addOns.length > 0) {
      item.addOns.forEach((a: any) => {
        html += `<tr style='line-height:1.5;'><td style='font-size:18px;padding-left:8px;color:#000;'>+ ${a.name}</td><td style='font-size:18px;text-align:right;color:#000;'>Rp${((a.price ?? a.harga ?? 0) * item.qty).toLocaleString('id-ID')}</td></tr>`;
      });
    }
    const detail = [
      item.sugar && item.sugar !== 'normal' ? (item.sugar === 'no' ? 'Tanpa Gula' : item.sugar === 'less' ? 'Sedikit Gula' : item.sugar) : null,
      item.ice && item.ice !== 'normal' ? (item.ice === 'no' ? 'Tanpa Es' : item.ice === 'less' ? 'Sedikit Es' : item.ice) : null,
      item.note && item.note.trim() ? item.note : null
    ].filter(Boolean).join(', ');
    if (detail) html += `<tr style='line-height:1.5;'><td colspan='2' style='font-size:18px;padding-left:8px;color:#000;'>${detail}</td></tr>`;
    if (idx < cart.length-1) html += `<tr><td colspan='2' style='height:20px;'></td></tr>`;
  });
  html += `</tbody></table>`;
  html += `<div style='border-bottom:1px dashed #000;margin-bottom:16px;'></div>`;
  // Ringkasan
  html += `<table style='width:100%;font-size:24px;margin-bottom:16px;line-height:1.5;'><tbody>`;
  html += `<tr><td style='text-align:left;'>Total:</td><td style='text-align:right;'><b>Rp${totalHarga.toLocaleString('id-ID')}</b></td></tr>`;
  html += `<tr><td style='text-align:left;'>Metode:</td><td style='text-align:right;'>${paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}</td></tr>`;
  if (paymentMethod === 'cash') {
    html += `<tr><td style='text-align:left;'>Dibayar:</td><td style='text-align:right;'>Rp${(parseInt(cashReceived) || 0).toLocaleString('id-ID')}</td></tr>`;
    html += `<tr><td style='text-align:left;'>Kembalian:</td><td style='text-align:right;'>Rp${kembalian >= 0 ? kembalian.toLocaleString('id-ID') : '0'}</td></tr>`;
  }
  html += `</tbody></table>`;
  // Ucapan
  html += `<div style='margin-top:16px;text-align:center;white-space:pre-line;line-height:1.5;'>${pengaturan.ucapan}</div>`;
  html += `</body></html>`;

  // 2. Gzip + base64 encode
  const gzip = pako.gzip(JSON.stringify([html]));
  const base64 = Base64.fromUint8Array(gzip);
  // 3. Intent URL
  const intentUrl = `intent://#Intent;scheme=print-intent;S.content=${base64};end`;
  window.location.href = intentUrl;
}

function handleAddCashTemplate(t: any) { addCashTemplate(t); }
function handleKeypadButton(key: any) { if (key === 'C') cashReceived = ''; else handleKeypad(key); }
function handleSetPaymentMethod(id: any) { paymentMethod = id; }
function handleBackToKasir() { showSuccessModal = false; goto('/pos'); }
function handleCloseNoSessionModal() { showNoSessionModal = false; }
</script>

<main class="flex-1 overflow-y-auto px-2 pt-2 page-content">
  <div class="px-2 py-4">
    <div class="font-semibold text-sm text-gray-700 mb-3">Pembayaran: #{transactionCode}</div>
    <!-- Input Nama Pelanggan -->
    <div class="mb-4">
      <div class="block text-sm text-gray-500 mb-2">Nama Pelanggan</div>
      <input
        type="text"
        class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1"
        placeholder="Masukkan nama pelanggan..."
        bind:value={customerName}
        maxlength="50"
      />
    </div>
    <!-- Info Pesanan -->
    <div class="bg-pink-50 rounded-xl p-4 mb-4">
      <div class="font-semibold text-pink-500 mb-2">Pesanan</div>
      <ul class="divide-y divide-pink-100">
        {#each cart as item}
          <li class="py-2 flex flex-col gap-0.5">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-medium text-gray-900 truncate">{item.product.name}</span>
                <span class="text-sm text-gray-500 flex-shrink-0">x{item.qty}</span>
              </div>
              <span class="font-bold text-pink-500">Rp {((item.product.price ?? item.product.harga ?? 0) * item.qty).toLocaleString('id-ID')}</span>
            </div>
            {#if item.addOns && item.addOns.length > 0}
              <div class="flex flex-col ml-1 mt-1 gap-0.5">
                {#each item.addOns as ekstra}
                  <div class="flex justify-between text-xs text-gray-500 font-medium">
                    <span>+ {ekstra.name}</span>
                    <span>Rp {((ekstra.price ?? ekstra.harga ?? 0) * item.qty).toLocaleString('id-ID')}</span>
                  </div>
                {/each}
              </div>
            {/if}
            {#if (item.sugar && item.sugar !== 'normal') || (item.ice && item.ice !== 'normal') || (item.note && item.note.trim())}
              <div class="text-xs text-gray-400 font-medium ml-1">
                {[item.sugar && item.sugar !== 'normal' ? (item.sugar === 'no' ? 'Tanpa Gula' : item.sugar === 'less' ? 'Sedikit Gula' : item.sugar) : null,
                  item.ice && item.ice !== 'normal' ? (item.ice === 'no' ? 'Tanpa Es' : item.ice === 'less' ? 'Sedikit Es' : item.ice) : null,
                  item.note && item.note.trim() ? item.note : null].filter(Boolean).join(', ')}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
    <!-- Metode Pembayaran -->
    <div class="mb-4">
      <div class="block text-sm text-gray-500 mb-2">Metode Pembayaran</div>
      <div class="grid grid-cols-2 gap-3">
        {#each paymentOptions as opt}
          <button type="button" class="rounded-lg border-2 px-4 py-3 font-semibold text-base transition-all
            {paymentMethod === opt.id ? 'border-pink-500 bg-pink-50 text-pink-500' : 'border-pink-200 bg-white text-gray-700'}"
            onclick={() => handleSetPaymentMethod(opt.id)}>
            {opt.label}
          </button>
        {/each}
      </div>
    </div>
    <!-- Summary Total -->
    <div class="flex justify-between items-center bg-white rounded-xl shadow p-4 mb-4 mt-6">
      <div class="font-semibold text-gray-700">Total</div>
      <div class="text-2xl font-bold text-pink-500">Rp {totalHarga.toLocaleString('id-ID')}</div>
    </div>
    <!-- Tombol Konfirmasi -->
    <button class="w-full bg-pink-500 text-white text-lg font-bold rounded-xl py-4 shadow-lg active:bg-pink-600 transition-all mt-2 disabled:opacity-50"
      onclick={handleBayar}
      disabled={!paymentMethod || !customerName.trim()}
    >
      Konfirmasi & Bayar
    </button>
    {#if !paymentMethod || !customerName.trim()}
      <div class="text-center text-xs text-red-400 mt-2">
        {#if !paymentMethod && !customerName.trim()}
          Isi nama pelanggan & pilih metode pembayaran dulu
        {:else if !paymentMethod}
          Pilih metode pembayaran dulu
        {:else}
          Isi nama pelanggan dulu
        {/if}
      </div>
    {/if}
    <button class="block mx-auto mt-4 text-sm text-gray-400 underline hover:text-pink-400" type="button" onclick={handleCancel}>
      Batalkan
    </button>
  </div>
</main>

{#if showCancelModal}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
    <div class="w-full max-w-sm mx-auto bg-white rounded-t-2xl shadow-lg animate-slideUpModal p-6 pb-4">
      <div class="font-bold text-lg text-gray-800 mb-2 text-center">Batalkan Pembayaran?</div>
      <div class="text-gray-500 text-center mb-6">Apakah Anda yakin ingin membatalkan pembayaran dan kembali ke kasir?</div>
      <div class="flex flex-col gap-2">
        <button class="w-full bg-red-500 text-white font-bold rounded-lg py-3 text-base active:bg-red-600" onclick={confirmCancel}>Ya, batalkan</button>
        <button class="w-full bg-gray-100 text-gray-500 font-semibold rounded-lg py-3 text-base" onclick={closeModal}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

{#if showCashModal}
  <ModalSheet open={showCashModal} title="Pembayaran Tunai" on:close={closeCashModal}>
    <div class="pb-24 md:min-h-[60vh]">
      <div class="text-gray-500 text-center mb-4 md:mb-6 md:text-lg">Masukkan jumlah uang diterima</div>
      <input type="text" inputmode="numeric" pattern="[0-9]*" class="w-full border-2 border-pink-200 rounded-lg px-2 py-3 md:py-5 text-xl md:text-2xl text-center font-bold mb-3 md:mb-5 focus:border-pink-400 outline-none" bind:value={formattedCashReceived} oninput={(e) => {
        const target = e.target as HTMLInputElement;
        const raw = target.value.replace(/\D/g, '');
        cashReceived = raw;
      }} placeholder="0" />
      <div class="flex flex-wrap gap-2 md:gap-4 justify-center mb-4 md:mb-6">
        {#each cashTemplates as t}
          <button type="button" class="bg-pink-100 text-pink-500 font-bold rounded-lg px-4 md:px-8 py-2 md:py-3 text-base md:text-lg" onclick={() => handleAddCashTemplate(t)}>
            Rp {t.toLocaleString('id-ID')}
          </button>
        {/each}
      </div>
      <div class="grid grid-cols-3 gap-2 md:gap-6 w-full mx-auto">
        {#each keypad as row}
          {#each row as key}
            <button type="button" class="w-full bg-gray-100 text-gray-700 font-bold rounded-xl py-3 md:py-8 text-xl md:text-3xl active:bg-pink-100 transition-all {key === '⌫' ? 'col-span-1 text-pink-500' : ''} {key === 'C' ? 'text-red-500' : ''}" onclick={() => handleKeypadButton(key)}>{key}</button>
          {/each}
        {/each}
      </div>
    </div>
    <div slot="footer" class="flex flex-col gap-2 md:gap-4">
      <div class="text-center text-gray-700 mb-2 md:mb-4 md:text-lg">
        Kembalian:
        <span class="font-bold {kembalian < 0 ? 'text-red-500' : 'text-green-500'}">Rp {kembalian >= 0 ? kembalian.toLocaleString('id-ID') : '0'}</span>
      </div>
      <button class="w-full bg-pink-500 text-white font-bold rounded-lg py-3 md:py-5 text-base md:text-xl active:bg-pink-600 disabled:opacity-50" onclick={finishCash} disabled={kembalian < 0 || !cashReceived}>
        Selesai
      </button>
    </div>
  </ModalSheet>
{/if}

{#if showQrisWarning}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
    <div class="w-full max-w-sm mx-auto bg-white rounded-t-2xl shadow-lg animate-slideUpModal p-8 pb-6 flex flex-col items-center gap-4 qris-warning-modal">
      <div class="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-2 animate-bounceIn warning-icon">
        <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#fde047" opacity="0.18"/><path d="M12 8v4m0 4h.01" stroke="#f59e42" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="text-xl font-bold text-yellow-600 mb-1 text-center warning-title">Periksa Pembayaran QRIS</div>
      <div class="text-gray-700 text-center mb-2">Pastikan kasir sudah <span class='font-semibold text-pink-500'>memeriksa nama merchant</span> dan <span class='font-semibold text-pink-500'>nominal pembayaran</span> di aplikasi konsumen sebelum melanjutkan.</div>
      <button class="w-full bg-pink-500 text-white font-bold rounded-lg py-3 text-base active:bg-pink-600 transition-all mt-2 warning-btn" onclick={confirmQrisChecked}>Sudah Diperiksa</button>
    </div>
  </div>
{/if}

{#if showSuccessModal}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
    <div class="w-full max-w-sm mx-auto bg-white rounded-t-2xl shadow-lg animate-slideUpModal p-8 pb-6 flex flex-col items-center gap-4">
      <div class="flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-2 animate-bounceIn">
        <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#4ade80" opacity="0.18"/><path d="M7 13l3 3 7-7" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="text-2xl font-bold text-green-600 mb-1 text-center">Transaksi Berhasil!</div>
      <div class="text-gray-700 text-center mb-2">
        Pembayaran {paymentMethod === 'qris' ? 'QRIS' : 'tunai'} telah diterima.<br/>
        {#if customerName.trim()}
          <span class="font-semibold text-pink-500">{customerName.trim()}</span><br/>
        {/if}
        Kembalian: <span class='font-bold text-pink-500'>Rp {kembalian >= 0 ? kembalian.toLocaleString('id-ID') : '0'}</span>
      </div>
      <div class="w-full flex flex-col gap-1 bg-pink-50 rounded-lg p-3 mb-2">
        <div class="flex justify-between text-sm text-gray-500"><span>Total</span><span class="font-bold text-pink-500">Rp {totalHarga.toLocaleString('id-ID')}</span></div>
        <div class="flex justify-between text-sm text-gray-500"><span>Dibayar</span><span class="font-bold text-green-600">Rp {cashReceived ? parseInt(cashReceived).toLocaleString('id-ID') : '0'}</span></div>
        <div class="flex justify-between text-sm text-gray-500"><span>Kembalian</span><span class="font-bold text-green-600">Rp {kembalian >= 0 ? kembalian.toLocaleString('id-ID') : '0'}</span></div>
      </div>
      <div class="flex flex-col gap-2 w-full">
        <button class="w-full bg-green-500 text-white font-bold rounded-lg py-3 text-base active:bg-green-600 transition-all" onclick={printStrukViaEscPosService}>Cetak Struk</button>
        <button class="w-full bg-pink-500 text-white font-bold rounded-lg py-3 text-base active:bg-pink-600 transition-all" onclick={handleBackToKasir}>Kembali ke Kasir</button>
      </div>
    </div>
  </div>
{/if}

{#if showErrorNotification}
  <div 
    class="fixed top-20 left-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out"
    style="transform: translateX(-50%);"
    in:fly={{ y: -32, duration: 300, easing: cubicOut }}
    out:fade={{ duration: 200 }}
  >
    {errorNotificationMessage}
  </div>
{/if}

{#if showSuccessNotification}
  <div 
    class="fixed top-20 left-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out"
    style="transform: translateX(-50%);"
    in:fly={{ y: -32, duration: 300, easing: cubicOut }}
    out:fade={{ duration: 200 }}
  >
    {successNotificationMessage}
  </div>
{/if}

{#if showNoSessionModal}
  <ModalSheet open={showNoSessionModal} title="Peringatan" on:close={handleCloseNoSessionModal}>
    <div class="text-center text-gray-700 text-base py-6">{noSessionModalMsg}</div>
    <div slot="footer" class="flex flex-col gap-2">
      <button class="w-full bg-pink-500 text-white font-bold rounded-lg py-3 text-base active:bg-pink-600" onclick={handleCloseNoSessionModal}>Tutup</button>
    </div>
  </ModalSheet>
{/if}

{#if showNotifModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="bg-white rounded-2xl shadow-2xl border-2 px-8 py-7 max-w-xs w-full flex flex-col items-center animate-slideUpModal"
      style="border-color: {notifModalType === 'success' ? '#facc15' : notifModalType === 'error' ? '#ef4444' : '#facc15'};">
      <div class="flex items-center justify-center w-16 h-16 rounded-full mb-3"
        style="background: {notifModalType === 'success' ? '#fef9c3' : notifModalType === 'error' ? '#fee2e2' : '#fef9c3'};">
        {#if notifModalType === 'success'}
          <svg class="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="#fef9c3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" stroke="#facc15" stroke-width="2" />
          </svg>
        {:else if notifModalType === 'error'}
          <svg class="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="#fee2e2" />
            <line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
            <line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
          </svg>
        {:else}
          <svg class="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="#fef9c3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01" stroke="#facc15" stroke-width="2" />
          </svg>
        {/if}
      </div>
      <div class="text-center text-gray-700 font-medium text-base mb-4">{notifModalMsg}</div>
      <button class="mt-2 px-6 py-2 rounded-xl bg-pink-500 text-white font-bold shadow hover:bg-pink-600 transition-colors" onclick={closeNotifModal}>Tutup</button>
    </div>
  </div>
{/if}

<style>
@keyframes slideUpModal {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-slideUpModal {
  animation: slideUpModal 0.32s cubic-bezier(.4,0,.2,1);
}
@keyframes bounceIn {
  0% { transform: scale(0.7); opacity: 0; }
  60% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); }
}
.animate-bounceIn {
  animation: bounceIn 0.5s cubic-bezier(.4,0,.2,1);
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