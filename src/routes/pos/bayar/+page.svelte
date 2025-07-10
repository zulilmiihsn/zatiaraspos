<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import ModalSheet from '$lib/components/shared/ModalSheet.svelte';
import { validateNumber, validateText, sanitizeInput } from '$lib/validation.js';
import { SecurityMiddleware } from '$lib/security.js';
import { supabase } from '$lib/database/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { formatWitaDateTime } from '$lib/index';
import { saveTransaksiOffline } from '$lib/stores/transaksiOffline';
import { fly, fade } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';

let cart = [];
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

onMount(() => {
  const saved = localStorage.getItem('pos_cart');
  if (saved) {
    try {
      cart = JSON.parse(saved);
    } catch {}
  }
  transactionId = uuidv4(); // UUID untuk database
  transactionCode = generateTransactionCode(); // Untuk tampilan/struk
});

$: totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
$: totalHarga = cart.reduce((sum, item) => sum + (item.qty * (item.product.price ?? item.product.harga ?? 0) + (item.addOns ? item.addOns.reduce((a, b) => a + ((b.price ?? b.harga ?? 0) * item.qty), 0) : 0)), 0);
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
  localStorage.removeItem('pos_cart');
}
function addCashTemplate(nom) {
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
  if (!SecurityMiddleware.checkFormRateLimit('payment_completion')) {
    showErrorNotif('Terlalu banyak transaksi. Silakan tunggu sebentar.');
    return;
  }
  
  // Sanitize inputs
  const sanitizedCashReceived = sanitizeInput(cashReceived);
  const sanitizedPaymentMethod = sanitizeInput(paymentMethod);
  
  // Check for suspicious activity
  const allInputs = `${sanitizedCashReceived}${sanitizedPaymentMethod}${totalHarga}`;
  if (SecurityMiddleware.detectSuspiciousActivity('payment_completion', allInputs)) {
    showErrorNotif('Aktivitas pembayaran mencurigakan terdeteksi. Silakan coba lagi.');
    SecurityMiddleware.logSecurityEvent('suspicious_payment_activity', {
      cashReceived: sanitizedCashReceived,
      paymentMethod: sanitizedPaymentMethod,
      totalHarga
    });
    return;
  }
  
  // Log successful payment
  SecurityMiddleware.logSecurityEvent('payment_completed', {
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
  // Kosongkan keranjang di localStorage jika perlu
  localStorage.removeItem('pos_cart');
}
function handleKeypad(val) {
  if (val === '⌫') {
    cashReceived = cashReceived.slice(0, -1);
  } else {
    cashReceived = (cashReceived + val).replace(/^0+(?!$)/, '');
  }
}
function printReceipt() {
  // Ambil printer yang sudah dipilih user
  const printerData = localStorage.getItem('connectedPrinter');
  if (!printerData) {
    showErrorNotif('Belum ada printer yang tersambung. Silakan sandingkan printer di pengaturan.');
    return;
  }
  const printer = JSON.parse(printerData);

  // Format struk
  let receipt = '';
  receipt += '      Zatiaras Juice\n';
  receipt += '-----------------------------\n';
  receipt += `Pelanggan : ${customerName.trim() || 'Pelanggan'}\n`;
  receipt += `Waktu     : ${new Date().toLocaleString('id-ID')}\n`;
  receipt += '-----------------------------\n';
  cart.forEach(item => {
    receipt += `${item.product.name} x${item.qty}  Rp${(item.product.price ?? item.product.harga ?? 0).toLocaleString('id-ID')}\n`;
    if ((item.addOns && item.addOns.length > 0) || (item.sugar && item.sugar !== 'normal') || (item.ice && item.ice !== 'normal') || (item.note && item.note.trim())) {
      receipt += '  ';
      if (item.addOns && item.addOns.length > 0) receipt += `+ ${item.addOns.map(a => a.name).join(', ')}; `;
      if (item.sugar && item.sugar !== 'normal') receipt += item.sugar === 'no' ? 'Tanpa Gula; ' : item.sugar === 'less' ? 'Sedikit Gula; ' : item.sugar + '; ';
      if (item.ice && item.ice !== 'normal') receipt += item.ice === 'no' ? 'Tanpa Es; ' : item.ice === 'less' ? 'Sedikit Es; ' : item.ice + '; ';
      if (item.note && item.note.trim()) receipt += item.note + '; ';
      receipt += '\n';
    }
  });
  receipt += '-----------------------------\n';
  receipt += `Total     : Rp${totalHarga.toLocaleString('id-ID')}\n`;
  receipt += `Metode    : ${paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}\n`;
  if (paymentMethod === 'cash') {
    receipt += `Dibayar   : Rp${(parseInt(cashReceived) || 0).toLocaleString('id-ID')}\n`;
    receipt += `Kembalian : Rp${kembalian >= 0 ? kembalian.toLocaleString('id-ID') : '0'}\n`;
  }
  receipt += '-----------------------------\n';
  receipt += 'Terima kasih sudah ngejus di\n          Zatiaras Juice!\n\n';

  // Kirim ke printer bluetooth
  sendToBluetoothPrinter(printer.id, receipt);
}

// Helper untuk kirim data ke printer bluetooth
async function sendToBluetoothPrinter(deviceId, text) {
  try {
    // Deteksi iOS/iPhone
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
    if (isIOS) {
      showErrorNotif('Maaf, fitur print Bluetooth tidak didukung di iPhone/iOS karena keterbatasan browser. Silakan gunakan Android atau desktop.');
      return;
    }
    // Cari device berdasarkan id
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access', 'device_information']
    });
    if (!device) throw new Error('Printer tidak ditemukan');
    const server = await device.gatt.connect();
    // Biasanya printer thermal pakai service custom, perlu disesuaikan dengan printer yang digunakan
    // Di sini contoh: cari service & characteristic yang bisa write
    const services = await server.getPrimaryServices();
    let found = false;
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          // Kirim data (convert ke Uint8Array)
          const encoder = new TextEncoder();
          await char.writeValue(encoder.encode(text));
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) throw new Error('Tidak ada karakteristik write pada printer');
    showSuccessNotif('Struk berhasil dikirim ke printer!');
  } catch (err) {
    showErrorNotif('Gagal mencetak struk: ' + err.message);
  }
}

function getLocalOffsetString() {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = n => n.toString().padStart(2, '0');
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  return `${sign}${hours}:${minutes}`;
}

async function catatTransaksiKeLaporan() {
  const now = new Date();
  const transaction_date = now.toISOString();
  const payment = paymentMethod === 'qris' ? 'non-tunai' : 'tunai';
  const inserts = cart.map(item => ({
    amount: item.qty * (item.product.price ?? item.product.harga ?? 0),
    qty: item.qty,
    type: 'in',
    description: `Penjualan ${item.product.name}`,
    transaction_date,
    payment_method: payment,
    jenis: 'pendapatan_usaha'
  }));
  if (navigator.onLine) {
    await supabase.from('buku_kas').insert(inserts);
  } else {
    for (const trx of inserts) {
      await saveTransaksiOffline(trx);
    }
  }

  // 1. Insert ke transaksi (header)
  const transaksiHeader = {
    id: transactionId, // UUID
    type: 'penjualan',
    amount: totalHarga,
    is_cash: paymentMethod === 'cash',
    description: 'Penjualan kasir',
    created_at: new Date().toISOString()
  };
  const { error: trxError } = await supabase.from('transaksi').insert([transaksiHeader]);
  if (trxError) {
    console.error('Gagal insert transaksi:', trxError, transaksiHeader);
    return;
  }

  // 2. Insert ke item_transaksi (detail)
  const itemInserts = cart.map(item => ({
    transaction_id: transactionId,
    menu_id: item.product.id,
    qty: item.qty,
    price: item.product.price ?? item.product.harga ?? 0
  }));
  if (itemInserts.some(i => !i.menu_id || typeof i.menu_id !== 'string' || i.menu_id.length < 10)) {
    console.error('Gagal insert item_transaksi: menu_id bukan UUID', itemInserts);
  } else if (itemInserts.length > 0) {
    const { error: insertError } = await supabase.from('item_transaksi').insert(itemInserts);
    if (insertError) {
      console.error('Gagal insert item_transaksi:', insertError, itemInserts);
    }
  }
}
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
              <span class="font-bold text-pink-500">Rp {(item.product.price ?? item.product.harga ?? 0).toLocaleString('id-ID')}</span>
            </div>
            {#if (item.addOns && item.addOns.length > 0) || (item.sugar && item.sugar !== 'normal') || (item.ice && item.ice !== 'normal') || (item.note && item.note.trim())}
              <div class="text-xs text-gray-500 font-medium ml-1">
                {[
                  item.addOns && item.addOns.length > 0 ? `+ ${item.addOns.map(a => a.name).join(', ')}` : null,
                  item.sugar && item.sugar !== 'normal' ? (item.sugar === 'no' ? 'Tanpa Gula' : item.sugar === 'less' ? 'Sedikit Gula' : item.sugar) : null,
                  item.ice && item.ice !== 'normal' ? (item.ice === 'no' ? 'Tanpa Es' : item.ice === 'less' ? 'Sedikit Es' : item.ice) : null,
                  item.note && item.note.trim() ? item.note : null
                ].filter(Boolean).join(', ')}
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
            onclick={() => paymentMethod = opt.id}>
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
        const raw = e.target.value.replace(/\D/g, '');
        cashReceived = raw;
      }} placeholder="0" />
      <div class="flex flex-wrap gap-2 md:gap-4 justify-center mb-4 md:mb-6">
        {#each cashTemplates as t}
          <button type="button" class="bg-pink-100 text-pink-500 font-bold rounded-lg px-4 md:px-8 py-2 md:py-3 text-base md:text-lg" onclick={() => addCashTemplate(t)}>
            Rp {t.toLocaleString('id-ID')}
          </button>
        {/each}
      </div>
      <div class="grid grid-cols-3 gap-2 md:gap-6 w-full mx-auto">
        {#each keypad as row}
          {#each row as key}
            <button type="button" class="w-full bg-gray-100 text-gray-700 font-bold rounded-xl py-3 md:py-8 text-xl md:text-3xl active:bg-pink-100 transition-all {key === '⌫' ? 'col-span-1 text-pink-500' : ''} {key === 'C' ? 'text-red-500' : ''}" onclick={() => key === 'C' ? cashReceived = '' : handleKeypad(key)}>{key}</button>
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
        <button class="w-full bg-green-500 text-white font-bold rounded-lg py-3 text-base active:bg-green-600 transition-all" onclick={printReceipt}>Cetak Struk</button>
        <button class="w-full bg-pink-500 text-white font-bold rounded-lg py-3 text-base active:bg-pink-600 transition-all" onclick={() => { showSuccessModal = false; goto('/pos'); }}>Kembali ke Kasir</button>
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