<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import ModalSheet from '$lib/components/shared/ModalSheet.svelte';
import { validateNumber, validateText, sanitizeInput } from '$lib/validation.js';
import { SecurityMiddleware } from '$lib/security.js';

let cart = [];
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

onMount(() => {
  const saved = localStorage.getItem('pos_cart');
  if (saved) {
    try {
      cart = JSON.parse(saved);
    } catch {}
  }
});

$: totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
$: totalHarga = cart.reduce((sum, item) => sum + (item.qty * item.product.price + (item.addOns ? item.addOns.reduce((a, b) => a + (b.price * item.qty), 0) : 0)), 0);
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
    alert(`Error: ${cashValidation.errors.join(', ')}`);
    return;
  }
  
  // Check rate limiting
  if (!SecurityMiddleware.checkFormRateLimit('payment_completion')) {
    alert('Terlalu banyak transaksi. Silakan tunggu sebentar.');
    return;
  }
  
  // Sanitize inputs
  const sanitizedCashReceived = sanitizeInput(cashReceived);
  const sanitizedPaymentMethod = sanitizeInput(paymentMethod);
  
  // Check for suspicious activity
  const allInputs = `${sanitizedCashReceived}${sanitizedPaymentMethod}${totalHarga}`;
  if (SecurityMiddleware.detectSuspiciousActivity('payment_completion', allInputs)) {
    alert('Aktivitas pembayaran mencurigakan terdeteksi. Silakan coba lagi.');
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
  // TODO: Implementasi cetak struk ke printer thermal
  alert('Fitur cetak struk belum tersedia.');
}
</script>

<main class="flex-1 overflow-y-auto px-2 pt-2">
  <div class="px-2 py-4">
    <div class="font-semibold text-sm text-gray-700 mb-3">Pembayaran: #TRX123456</div>
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
              <span class="font-bold text-pink-500">Rp {(item.product.price * item.qty + (item.addOns ? item.addOns.reduce((a, b) => a + (b.price * item.qty), 0) : 0)).toLocaleString('id-ID')}</span>
            </div>
            {#if item.addOns && item.addOns.length > 0}
              <div class="text-xs text-gray-400 ml-1">+ {item.addOns.map(a => a.name).join(', ')}</div>
            {/if}
            {#if item.sugar && item.sugar !== 'normal'}
              <div class="text-xs text-blue-400 ml-1">Gula: {item.sugar === 'no' ? 'Tanpa Gula' : item.sugar === 'less' ? 'Sedikit Gula' : item.sugar}</div>
            {/if}
            {#if item.ice && item.ice !== 'normal'}
              <div class="text-xs text-cyan-500 ml-1">Es: {item.ice === 'no' ? 'Tanpa Es' : item.ice === 'less' ? 'Sedikit Es' : item.ice}</div>
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
    <button class="w-full bg-pink-500 text-white text-lg font-bold rounded-xl py-4 shadow-lg active:bg-pink-600 transition-all mt-2 disabled:opacity-50" onclick={handleBayar} disabled={!paymentMethod}>
      Konfirmasi & Bayar
    </button>
    {#if !paymentMethod}
      <div class="text-center text-xs text-red-400 mt-2">Pilih metode pembayaran dulu</div>
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
      <div class="text-gray-700 text-center mb-2">Pembayaran {paymentMethod === 'qris' ? 'QRIS' : 'tunai'} telah diterima.<br/>Kembalian: <span class='font-bold text-pink-500'>Rp {kembalian >= 0 ? kembalian.toLocaleString('id-ID') : '0'}</span></div>
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