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
import { getWitaDateRangeUtc } from '$lib/utils/index';
import { userRole } from '$lib/stores/userRole';
import DropdownSheet from '$lib/components/shared/dropdownSheet.svelte';
import { createToastManager, ErrorHandler } from '$lib/utils/index';
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
      transaksiHariIni.push(...data.map(t => ({
        id: t.id,
        transaction_id: t.transaction_id, // Tambahkan transaction_id untuk delete operation
        waktu: t.waktu,
        nama: t.description || t.customer_name || t.nama || '-',
        nominal: t.amount,
        tipe: t.tipe || t.type, // Handle kemungkinan perbedaan nama kolom
        sumber: t.sumber || 'catat',
        payment_method: t.payment_method || 'tunai',
        customer_name: t.customer_name || '',
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
    setTimeout(() => { toastManager.hideToast(); }, 2000);
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
  <div class="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200 flex items-center px-4 py-4 mb-0">
    <button onclick={() => goto('/pengaturan/pemilik')} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors mr-2">
      <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
    </button>
    <h1 class="text-xl font-bold text-gray-800 flex-1">Riwayat Transaksi Hari Ini</h1>
    <button onclick={refreshManual} class="p-2 rounded-xl bg-pink-50 hover:bg-pink-100 transition-colors ml-2" aria-label="Refresh">
      <svelte:component this={RefreshCw} class="w-5 h-5 text-pink-500 {loading ? 'animate-spin' : ''}" />
    </button>
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
                  <div class="bg-white rounded-xl shadow border border-gray-100 p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-pink-50 transition-colors" onclick={() => openDetail(trx)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(trx); } }} role="button" tabindex="0">
                    <div>
                      <div class="font-semibold text-gray-800 text-sm truncate max-w-[10rem] md:max-w-[16rem] lg:max-w-[18rem] overflow-hidden" title={trx.nama}>{trx.nama}</div>
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
                      <button class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md" onclick={(e) => { e.stopPropagation(); confirmDeleteTransaksi(trx); }} title="Hapus transaksi">
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

  {#if showDetailModal && selectedTransaksi}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 md:px-0">
      <div class="bg-white rounded-2xl shadow-2xl border border-pink-100 max-w-md w-full p-6 md:p-8 relative animate-slideUpModal flex flex-col gap-3">
        <button class="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200 shadow-sm" onclick={() => showDetailModal = false} aria-label="Tutup">
          <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 class="text-xl font-bold text-pink-600 mb-2 text-center">Detail Transaksi</h2>
        <div class="mb-1 flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Deskripsi</span>
          <div class="text-gray-800 break-words whitespace-pre-line text-base font-medium bg-pink-50 rounded-lg px-3 py-2">{selectedTransaksi.nama}</div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Customer</span>
          <div class="text-gray-700 text-base">{selectedTransaksi.customer_name || '-'}</div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Waktu</span>
          <div class="text-gray-700 text-base">{new Date(selectedTransaksi.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Nominal</span>
          <div class="text-pink-500 font-bold text-lg">Rp {selectedTransaksi.nominal?.toLocaleString('id-ID')}</div>
        </div>
        <div class="flex flex-col gap-1 mb-2">
          <span class="font-semibold text-gray-500">Jenis Pembayaran</span>
          <button type="button" class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 bg-white text-pink-500 font-medium flex items-center justify-between shadow-sm hover:bg-pink-50 transition-colors" onclick={() => showDropdownPayment = true} style="user-select:none;">
            <span class="truncate">{paymentOptions.find(opt => opt.value === selectedTransaksi.payment_method)?.label || 'Pilih'}</span>
            <svg class="w-4 h-4 text-pink-400 ml-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <DropdownSheet open={showDropdownPayment} value={selectedTransaksi.payment_method} options={paymentOptions} on:close={() => showDropdownPayment = false} on:select={e => { showDropdownPayment = false; updatePaymentMethod(e.detail); }} />
        </div>
        <button class="mt-2 w-full py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors shadow-lg shadow-pink-200/30 text-base" onclick={() => showDetailModal = false}>Tutup</button>
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
  animation: slideUpModal 0.32s cubic-bezier(.4,0,.2,1);
}
@keyframes slideUpModal {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>