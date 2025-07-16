<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { supabase } from '$lib/database/supabaseClient';
import Trash from 'lucide-svelte/icons/trash';
import { goto } from '$app/navigation';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';

let transaksiHariIni = [];
let loading = true;
let showDeleteModal = false;
let transaksiToDelete = null;
let notifMsg = '';
let showNotif = false;
let searchKeyword = '';

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

async function fetchTransaksiHariIni() {
  loading = true;
  const { start, end } = todayRange();
  // Ambil dari buku_kas (catat) dan transaksi (POS)
  const [catat, pos] = await Promise.all([
    supabase.from('buku_kas').select('*').gte('transaction_date', start).lte('transaction_date', end).order('transaction_date', { ascending: false }),
    supabase.from('transaksi').select('*').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false })
  ]);
  transaksiHariIni = [];
  if (catat.data) {
    transaksiHariIni.push(...catat.data.map(t => ({
      id: t.id,
      waktu: t.transaction_date,
      nama: t.description,
      nominal: t.amount,
      tipe: t.type,
      sumber: 'catat',
    })));
  }
  if (pos.data) {
    transaksiHariIni.push(...pos.data.map(t => ({
      id: t.id,
      waktu: t.created_at,
      nama: t.customer_name || 'Transaksi POS',
      nominal: t.total,
      tipe: 'in',
      sumber: 'pos',
      payment_method: t.payment_method // tambahkan ini
    })));
  }
  // Urutkan terbaru dulu
  transaksiHariIni.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
  // Filter hanya nominal > 0
  transaksiHariIni = transaksiHariIni.filter(t => t.nominal && t.nominal > 0);
  // Filter berdasarkan search
  if (searchKeyword.trim()) {
    const keyword = searchKeyword.trim().toLowerCase();
    transaksiHariIni = transaksiHariIni.filter(t => (t.nama?.toLowerCase().includes(keyword) || t.kategori?.toLowerCase().includes(keyword)));
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
    await supabase.from('buku_kas').delete().eq('id', transaksiToDelete.id);
  } else if (transaksiToDelete.sumber === 'pos') {
    await supabase.from('transaksi').delete().eq('id', transaksiToDelete.id);
    await supabase.from('item_transaksi').delete().eq('transaction_id', transaksiToDelete.id);
  }
  showDeleteModal = false;
  notifMsg = 'Transaksi berhasil dihapus.';
  showNotif = true;
  await fetchTransaksiHariIni();
  loading = false;
}

onMount(() => {
  if (typeof window !== 'undefined') {
    document.body.classList.add('hide-nav');
  }
  fetchTransaksiHariIni();
});
onDestroy(() => {
  if (typeof window !== 'undefined') {
    document.body.classList.remove('hide-nav');
  }
});
</script>

<!-- Top Bar Custom -->
<div class="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200 flex items-center px-4 py-4 mb-0">
  <button onclick={() => goto('/pengaturan/pemilik')} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors mr-2">
    <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
  </button>
  <h1 class="text-xl font-bold text-gray-800">Riwayat Transaksi Hari Ini</h1>
</div>
<!-- Search Bar di bawah top bar -->
<div class="px-4 pt-3 pb-2 bg-white sticky top-[64px] z-30">
  <input type="text" class="w-full border border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" placeholder="Cari transaksi atau kategori..." bind:value={searchKeyword} oninput={fetchTransaksiHariIni} />
</div>

<div class="max-w-2xl mx-auto w-full pt-[2px] px-4 pb-4">
  {#if loading}
    <div class="text-center text-gray-400 py-10">Memuat data...</div>
  {:else if transaksiHariIni.length === 0}
    <div class="text-center text-gray-400 py-10">Belum ada transaksi hari ini.</div>
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
              {#if trx.sumber === 'pos'}
                <span class="uppercase font-semibold text-pink-500">
                  {trx.payment_method === 'qris' || trx.payment_method === 'non-tunai' ? 'QRIS' : 'Tunai'}
                </span>
              {/if}
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
    <button class="ml-4 underline" onclick={() => showNotif = false}>Tutup</button>
  </div>
{/if}

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