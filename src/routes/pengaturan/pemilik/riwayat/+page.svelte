<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { goto } from '$app/navigation';
import { fly } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';
import { getWitaDateRangeUtc } from '$lib/utils/index';
import { userRole } from '$lib/stores/userRole';

let transaksiHariIni = [];
let loading = true;
let showDeleteModal = false;
let transaksiToDelete = null;
let notifMsg = '';
let showNotif = false;
let searchKeyword = '';
let filterPayment = 'all'; // 'all' | 'qris' | 'tunai'
let Trash;
let pollingInterval;

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
  // Ambil hanya dari buku_kas
  const { data, error } = await getSupabaseClient(storeGet(selectedBranch)).from('buku_kas').select('*').gte('waktu', start).lte('waktu', end).order('waktu', { ascending: false });
  transaksiHariIni = [];
  if (data) {
    transaksiHariIni.push(...data.map(t => ({
      id: t.id,
      waktu: t.waktu,
      nama: t.description || t.nama || '-',
      nominal: t.amount,
      tipe: t.type,
      sumber: t.sumber || 'catat',
      payment_method: t.payment_method || 'tunai',
    })));
  }
  // Urutkan terbaru dulu
  transaksiHariIni.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
  // Filter hanya nominal > 0
  transaksiHariIni = transaksiHariIni.filter(t => t.nominal && t.nominal > 0);
  // Filter berdasarkan search
  if (searchKeyword.trim()) {
    const keyword = searchKeyword.trim().toLowerCase();
    transaksiHariIni = transaksiHariIni.filter(t => t.nama?.toLowerCase().includes(keyword));
  }
  // Filter berdasarkan payment method
  if (filterPayment !== 'all') {
    transaksiHariIni = transaksiHariIni.filter(t => {
      if (filterPayment === 'qris') return t.payment_method === 'qris' || t.payment_method === 'non-tunai';
      if (filterPayment === 'tunai') return t.payment_method === 'tunai';
      return true;
    });
  }
  loading = false;
}

function confirmDeleteTransaksi(trx) {
  transaksiToDelete = trx;
  showDeleteModal = true;
}

async function deleteTransaksi() {
  if (!transaksiToDelete) return;
  loading = true;
  if (transaksiToDelete.sumber === 'catat') {
    await getSupabaseClient(storeGet(selectedBranch)).from('buku_kas').delete().eq('id', transaksiToDelete.id);
  } else if (transaksiToDelete.sumber === 'pos') {
    await getSupabaseClient(storeGet(selectedBranch)).from('transaksi').delete().eq('id', transaksiToDelete.id);
    await getSupabaseClient(storeGet(selectedBranch)).from('item_transaksi').delete().eq('transaction_id', transaksiToDelete.id);
  }
  showDeleteModal = false;
  notifMsg = 'Transaksi berhasil dihapus.';
  showNotif = true;
  // Auto hide notification after 3 seconds
  setTimeout(() => {
    showNotif = false;
  }, 3000);
  await fetchTransaksiHariIni();
  loading = false;
}

onMount(() => {
  userRole.subscribe(role => {
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
  pollingInterval = setInterval(fetchTransaksiHariIni, 5000); // polling setiap 5 detik
});
onDestroy(() => {
  if (typeof window !== 'undefined') {
    document.body.classList.remove('hide-nav');
  }
  clearInterval(pollingInterval);
});
</script>

<div transition:fly={{ y: 32, duration: 320, easing: cubicOut }}>
  <!-- Top Bar Custom -->
  <div class="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200 flex items-center px-4 py-4 mb-0">
    <button onclick={() => goto('/pengaturan/pemilik')} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors mr-2">
      <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
    </button>
    <h1 class="text-xl font-bold text-gray-800">Riwayat Transaksi Hari Ini</h1>
  </div>
  <!-- Search Bar dan Filter Payment Method digabung -->
  <div class="px-4 pt-3 pb-3 bg-white sticky top-[64px] z-30 space-y-3">
    <input type="text" class="w-full border border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" placeholder="Cari transaksi..." bind:value={searchKeyword} oninput={fetchTransaksiHariIni} />
    <div class="flex gap-2">
      <button class="px-4 py-2 rounded-lg border text-sm font-semibold transition-all focus:outline-none {filterPayment === 'all' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-200'}" onclick={() => { filterPayment = 'all'; fetchTransaksiHariIni(); }}>Semua</button>
      <button class="px-4 py-2 rounded-lg border text-sm font-semibold transition-all focus:outline-none {filterPayment === 'qris' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-200'}" onclick={() => { filterPayment = 'qris'; fetchTransaksiHariIni(); }}>QRIS</button>
      <button class="px-4 py-2 rounded-lg border text-sm font-semibold transition-all focus:outline-none {filterPayment === 'tunai' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-200'}" onclick={() => { filterPayment = 'tunai'; fetchTransaksiHariIni(); }}>Tunai</button>
    </div>
  </div>

  <div class="max-w-2xl mx-auto w-full pt-[2px] px-4 pb-4">
    {#if loading}
      <div class="text-center text-gray-400 py-10">Memuat data...</div>
    {:else if transaksiHariIni.length === 0}
      <div class="flex flex-col items-center justify-center h-64 w-full" style="min-height:16rem;">
        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" /></svg>
        <div class="text-base md:text-lg font-normal text-gray-300">Belum ada transaksi hari ini</div>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each transaksiHariIni as trx}
          <div class="bg-white rounded-xl shadow border border-gray-100 p-4 flex items-center justify-between gap-3">
            <div>
              <div class="font-semibold text-gray-800 text-sm">{trx.nama}</div>
              <div class="text-xs text-gray-500 mb-1 flex gap-2 items-center">
                <span>
                  {trx.sumber === 'pos' ? 'POS | ' : ''}
                  {trx.tipe === 'in' ? 'Pemasukan' : 'Pengeluaran'}
                  {trx.sumber === 'pos' ? ' | ' : ''}
                </span>
                <span class="uppercase font-semibold text-pink-500">
                  {trx.payment_method === 'qris' || trx.payment_method === 'non-tunai' ? 'QRIS' : 'Tunai'}
                </span>
              </div>
              <div class="text-xs text-gray-400">{new Date(trx.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div class="flex flex-col items-end gap-2">
              <div class="font-bold text-pink-500 text-base">Rp {trx.nominal?.toLocaleString('id-ID')}</div>
              <button class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md" onclick={() => confirmDeleteTransaksi(trx)} title="Hapus transaksi">
                <svelte:component this={Trash} class="w-5 h-5" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if showDeleteModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center animate-slideUpModal">
        <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
          <svelte:component this={Trash} class="w-8 h-8 text-red-500" />
        </div>
        <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Transaksi?</h2>
        <p class="text-gray-500 text-sm mb-6 text-center">Transaksi yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus transaksi ini?</p>
        <div class="flex gap-3 w-full">
          <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" onclick={() => showDeleteModal = false}>Batal</button>
          <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" onclick={deleteTransaksi}>Hapus</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showNotif}
    <div class="fixed top-20 left-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out" style="transform: translateX(-50%);">
      {notifMsg}
    </div>
  {/if}
</div>

<style>
.animate-slideUpModal {
  animation: slideUpModal 0.32s cubic-bezier(.4,0,.2,1);
}
@keyframes slideUpModal {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

:global(body.hide-nav) .topbar,
:global(body.hide-nav) .bottom-nav {
  display: none !important;
}
</style> 