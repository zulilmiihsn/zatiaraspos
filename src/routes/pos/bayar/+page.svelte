<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import ModalSheet from '$lib/components/shared/ModalSheet.svelte';

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
  ['⌫',0],
];

onMount(() => {
  const saved = localStorage.getItem('pos_cart');
  if (saved) {
    try {
      cart = JSON.parse(saved);
    } catch {}
  }
});

$: total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
$: kembalian = (parseInt(cashReceived) || 0) - total;
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
    // QRIS: langsung proses (bisa tambahkan flow QRIS nanti)
    alert('Pembayaran QRIS berhasil!');
    goto('/pos');
  }
}
function addCashTemplate(nom) {
  cashReceived = ((parseInt(cashReceived) || 0) + nom).toString();
}
function closeCashModal() {
  showCashModal = false;
}
function finishCash() {
  // Proses pembayaran tunai selesai
  alert('Pembayaran tunai berhasil!');
  goto('/pos');
}
function handleKeypad(val) {
  if (val === '⌫') {
    cashReceived = cashReceived.slice(0, -1);
  } else {
    cashReceived = (cashReceived + val).replace(/^0+(?!$)/, '');
  }
}
</script>

<main class="flex-1 overflow-y-auto px-4 pb-28 pt-2">
  <div class="font-semibold text-sm text-gray-700 mb-3">Pembayaran: #TRX123456</div>
  <!-- Info Pesanan -->
  <div class="bg-pink-50 rounded-xl p-4 mb-4">
    <div class="font-semibold text-pink-500 mb-2">Pesanan</div>
    <ul class="divide-y divide-pink-100">
      {#each cart as item}
        <li class="py-2 flex flex-col gap-0.5">
          <div class="flex justify-between items-center">
            <span class="font-medium text-gray-900">{item.name}</span>
            <span class="text-sm text-gray-500">x{item.qty}</span>
            <span class="font-bold text-pink-500">Rp {item.price.toLocaleString('id-ID')}</span>
          </div>
          {#if item.addOns.length > 0}
            <div class="text-xs text-gray-400 ml-1">+ {item.addOns.join(', ')}</div>
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
          on:click={() => paymentMethod = opt.id}>
          {opt.label}
        </button>
      {/each}
    </div>
  </div>
  <!-- Summary Total -->
  <div class="flex justify-between items-center bg-white rounded-xl shadow p-4 mb-4 mt-6">
    <div class="font-semibold text-gray-700">Total</div>
    <div class="text-2xl font-bold text-pink-500">Rp {total.toLocaleString('id-ID')}</div>
  </div>
  <!-- Tombol Konfirmasi -->
  <button class="w-full bg-pink-500 text-white text-lg font-bold rounded-xl py-4 shadow-lg active:bg-pink-600 transition-all mt-2 disabled:opacity-50" on:click={handleBayar} disabled={!paymentMethod}>
    Konfirmasi & Bayar
  </button>
  {#if !paymentMethod}
    <div class="text-center text-xs text-red-400 mt-2">Pilih metode pembayaran dulu</div>
  {/if}
  <button class="block mx-auto mt-4 text-sm text-gray-400 underline hover:text-pink-400" type="button" on:click={handleCancel}>
    Batalkan
  </button>
</main>

{#if showCancelModal}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
    <div class="w-full max-w-sm mx-auto bg-white rounded-t-2xl shadow-lg animate-slideUpModal p-6 pb-4">
      <div class="font-bold text-lg text-gray-800 mb-2 text-center">Batalkan Pembayaran?</div>
      <div class="text-gray-500 text-center mb-6">Apakah Anda yakin ingin membatalkan pembayaran dan kembali ke kasir?</div>
      <div class="flex flex-col gap-2">
        <button class="w-full bg-red-500 text-white font-bold rounded-lg py-3 text-base active:bg-red-600" on:click={confirmCancel}>Ya, batalkan</button>
        <button class="w-full bg-gray-100 text-gray-500 font-semibold rounded-lg py-3 text-base" on:click={closeModal}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

{#if showCashModal}
  <ModalSheet open={showCashModal} title="Pembayaran Tunai" on:close={closeCashModal}>
    <div class="pb-24">
      <div class="text-gray-500 text-center mb-4 md:mb-6 md:text-lg">Masukkan jumlah uang diterima</div>
      <input type="text" inputmode="numeric" pattern="[0-9]*" class="w-full border-2 border-pink-200 rounded-lg px-4 py-3 md:py-5 text-xl md:text-2xl text-center font-bold mb-3 md:mb-5 focus:border-pink-400 outline-none" bind:value={formattedCashReceived} on:input={(e) => {
        const raw = e.target.value.replace(/\D/g, '');
        cashReceived = raw;
      }} placeholder="0" />
      <div class="flex flex-wrap gap-2 md:gap-4 justify-center mb-4 md:mb-6">
        {#each cashTemplates as t}
          <button type="button" class="bg-pink-100 text-pink-500 font-bold rounded-lg px-4 md:px-8 py-2 md:py-3 text-base md:text-lg" on:click={() => addCashTemplate(t)}>
            Rp {t.toLocaleString('id-ID')}
          </button>
        {/each}
      </div>
      <div class="grid grid-cols-3 gap-2 md:gap-6 max-w-xs md:max-w-md w-full mx-auto">
        {#each keypad as row}
          {#each row as key}
            <button type="button" class="w-full bg-gray-100 text-gray-700 font-bold rounded-xl py-3 md:py-8 text-xl md:text-3xl active:bg-pink-100 transition-all {key === '⌫' ? 'col-span-1 text-pink-500' : ''}" on:click={() => handleKeypad(key)}>{key}</button>
          {/each}
        {/each}
      </div>
    </div>
    <div slot="footer" class="flex flex-col gap-2 md:gap-4">
      <div class="text-center text-gray-700 mb-2 md:mb-4 md:text-lg">
        Kembalian:
        <span class="font-bold {kembalian < 0 ? 'text-red-500' : 'text-green-500'}">Rp {kembalian >= 0 ? kembalian.toLocaleString('id-ID') : '0'}</span>
      </div>
      <button class="w-full bg-pink-500 text-white font-bold rounded-lg py-3 md:py-5 text-base md:text-xl active:bg-pink-600 disabled:opacity-50" on:click={finishCash} disabled={kembalian < 0 || !cashReceived}>
        Selesai
      </button>
    </div>
  </ModalSheet>
{/if}

<style>
@keyframes slideUpModal {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-slideUpModal {
  animation: slideUpModal 0.32s cubic-bezier(.4,0,.2,1);
}
</style> 