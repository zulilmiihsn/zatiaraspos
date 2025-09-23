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
  import { witaToUtcRange, getTodayWita } from '$lib/utils/dateTime';
  import { userRole } from '$lib/stores/userRole';
  import DropdownSheet from '$lib/components/shared/dropdownSheet.svelte';
  import { createToastManager } from '$lib/utils/ui';
  import { ErrorHandler } from '$lib/utils/errorHandling';
  import ToastNotification from '$lib/components/shared/toastNotification.svelte';

  let transaksiHariIni: any[] = [];
  let loading = true;
  let searchKeyword = '';
  let filterPayment = 'all'; // 'all' | 'qris' | 'tunai'
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
    const todayWita = getTodayWita();
    return witaToUtcRange(todayWita);
  }

  async function fetchTransaksiHariIni() {
    loading = true;
    const { startUtc: start, endUtc: end } = todayRange();

    try {
      const { data, error } = await getSupabaseClient(storeGet(selectedBranch))
        .from('buku_kas')
        .select('*')
        .gte('waktu', start)
        .lte('waktu', end)
        .order('waktu', { ascending: false });

      transaksiHariIni = [];
      if (data && !error) {
        transaksiHariIni.push(
          ...data.map((t) => ({
            id: t.id,
            transaction_id: t.transaction_id,
            waktu: t.waktu,
            nama: t.description || t.customer_name || t.nama || '-',
            nominal: t.amount || t.nominal,
            amount: t.amount || t.nominal,
            tipe: t.tipe || t.type,
            sumber: t.sumber || 'catat',
            payment_method: t.payment_method || 'tunai',
            customer_name: t.customer_name || ''
          }))
        );
      }

      transaksiHariIni.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

      transaksiHariIni = transaksiHariIni.filter(
        (t) => (t.nominal && t.nominal > 0) || (t.amount && t.amount > 0)
      );

      if (searchKeyword.trim()) {
        const keyword = searchKeyword.trim().toLowerCase();
        transaksiHariIni = transaksiHariIni.filter((t) => t.nama?.toLowerCase().includes(keyword));
      }

      if (filterPayment !== 'all') {
        transaksiHariIni = transaksiHariIni.filter((t) => {
          if (filterPayment === 'qris') return t.payment_method === 'qris' || t.payment_method === 'non-tunai';
          if (filterPayment === 'tunai') return t.payment_method === 'tunai';
          return true;
        });
      }
    } catch (error) {
      ErrorHandler.logError(error, 'fetchTransaksiHariIniKasir');
      toastManager.showToastNotification('Gagal memuat data transaksi', 'error');
    } finally {
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

  // Guard: hanya kasir yang boleh akses
  onMount(() => {
    userRole.subscribe((role) => {
      if (role !== 'kasir') {
        goto('/unauthorized');
      }
    })();
  });

  let aiHandler: any;
  onMount(async () => {
    if (typeof window !== 'undefined') {
      document.body.classList.add('hide-nav');
    }
    await fetchTransaksiHariIni();
    aiHandler = async () => {
      await fetchTransaksiHariIni();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('ai-recommendations-applied', aiHandler as any);
      (window as any).__refreshRiwayatKasir = async () => {
        await fetchTransaksiHariIni();
      };
    }
  });
  onDestroy(() => {
    if (typeof window !== 'undefined') {
      document.body.classList.remove('hide-nav');
    }
    if (typeof window !== 'undefined' && aiHandler) {
      window.removeEventListener('ai-recommendations-applied', aiHandler as any);
      delete (window as any).__refreshRiwayatKasir;
    }
  });
</script>

<div transition:fly={{ y: 32, duration: 320, easing: cubicOut }}>
  <!-- Top Bar Custom -->
  <div
    class="sticky top-0 z-40 mb-0 flex items-center border-b border-gray-200 bg-white px-4 py-4 shadow-sm"
  >
    <button
      onclick={() => goto('/pengaturan')}
      class="mr-2 rounded-xl bg-gray-100 p-2 transition-colors hover:bg-gray-200"
    >
      <svelte:component this={ArrowLeft} class="h-5 w-5 text-gray-600" />
    </button>
    <h1 class="flex-1 text-xl font-bold text-gray-800">Riwayat Transaksi Hari Ini</h1>
    <button
      onclick={refreshManual}
      class="ml-2 rounded-xl bg-pink-50 p-2 transition-colors hover:bg-pink-100"
      aria-label="Refresh"
    >
      <svelte:component
        this={RefreshCw}
        class="h-5 w-5 text-pink-500 {loading ? 'animate-spin' : ''}"
      />
    </button>
  </div>

  <!-- Search & Filter -->
  <div class="sticky top-[64px] z-30 space-y-3 bg-white px-4 pt-3 pb-3">
    <input
      type="text"
      class="w-full rounded-lg border border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
      placeholder="Cari transaksi..."
      bind:value={searchKeyword}
      oninput={fetchTransaksiHariIni}
    />
    <div class="flex gap-2">
      <button
        class="rounded-lg border px-4 py-2 text-sm font-semibold transition-all focus:outline-none {filterPayment ===
        'all'
          ? 'border-pink-500 bg-pink-500 text-white'
          : 'border-pink-200 bg-white text-pink-500'}"
        onclick={() => {
          filterPayment = 'all';
          fetchTransaksiHariIni();
        }}>Semua</button
      >
      <button
        class="rounded-lg border px-4 py-2 text-sm font-semibold transition-all focus:outline-none {filterPayment ===
        'qris'
          ? 'border-pink-500 bg-pink-500 text-white'
          : 'border-pink-200 bg-white text-pink-500'}"
        onclick={() => {
          filterPayment = 'qris';
          fetchTransaksiHariIni();
        }}>QRIS</button
      >
      <button
        class="rounded-lg border px-4 py-2 text-sm font-semibold transition-all focus:outline-none {filterPayment ===
        'tunai'
          ? 'border-pink-500 bg-pink-500 text-white'
          : 'border-pink-200 bg-white text-pink-500'}"
        onclick={() => {
          filterPayment = 'tunai';
          fetchTransaksiHariIni();
        }}>Tunai</button
      >
    </div>
  </div>

  <div class="mx-auto w-full max-w-2xl px-4 pt-[2px] pb-4">
    {#if loading}
      <div class="py-10 text-center text-gray-400">Memuat data...</div>
    {:else if transaksiHariIni.length === 0}
      <div class="flex h-64 w-full flex-col items-center justify-center" style="min-height:16rem;">
        <svg
          class="mb-4 h-16 w-16 text-gray-300"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          /></svg
        >
        <div class="text-base font-normal text-gray-300 md:text-lg">
          Belum ada transaksi hari ini
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each transaksiHariIni as trx}
          <div
            class="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow transition-colors hover:bg-pink-50"
            onclick={() => openDetail(trx)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDetail(trx);
              }
            }}
            role="button"
            tabindex="0"
          >
            <div>
              <div
                class="max-w-[10rem] truncate overflow-hidden text-sm font-semibold text-gray-800 md:max-w-[16rem] lg:max-w-[18rem]"
                title={trx.nama}
              >
                {trx.nama}
              </div>
              <div class="mb-1 flex items-center gap-2 text-xs text-gray-500">
                <span>
                  {trx.sumber === 'pos' ? 'POS | ' : ''}
                  {trx.tipe === 'in' ? 'Pemasukan' : 'Pengeluaran'}
                  {trx.sumber === 'pos' ? ' | ' : ''}
                </span>
                <span class="font-semibold text-pink-500 uppercase">
                  {trx.payment_method === 'qris' || trx.payment_method === 'non-tunai'
                    ? 'QRIS'
                    : 'Tunai'}
                </span>
              </div>
              <div class="text-xs text-gray-400">
                {new Date(trx.waktu).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              <div class="text-base font-bold text-pink-500">
                Rp {trx.nominal?.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if showDetailModal && selectedTransaksi}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm md:px-0"
    >
      <div
        class="animate-slideUpModal relative flex w-full max-w-md flex-col gap-3 rounded-2xl border border-pink-100 bg-white p-6 shadow-2xl md:p-8"
      >
        <button
          class="absolute top-3 right-3 rounded-full bg-gray-100 p-2 shadow-sm hover:bg-gray-200"
          onclick={() => (showDetailModal = false)}
          aria-label="Tutup"
        >
          <svg
            class="h-5 w-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
            ><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
          >
        </button>
        <h2 class="mb-2 text-center text-xl font-bold text-pink-600">Detail Transaksi</h2>
        <div class="mb-1 flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Deskripsi</span>
          <div
            class="rounded-lg bg-pink-50 px-3 py-2 text-base font-medium break-words whitespace-pre-line text-gray-800"
          >
            {selectedTransaksi.nama}
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Customer</span>
          <div class="text-base text-gray-700">{selectedTransaksi.customer_name || '-'}</div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Waktu</span>
          <div class="text-base text-gray-700">
            {new Date(selectedTransaksi.waktu).toLocaleString('id-ID', {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Nominal</span>
          <div class="text-lg font-bold text-pink-500">
            Rp {selectedTransaksi.nominal?.toLocaleString('id-ID')}
          </div>
        </div>
        <div class="mb-2 flex flex-col gap-1">
          <span class="font-semibold text-gray-500">Jenis Pembayaran</span>
          <!-- Dibuat read-only untuk kasir -->
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg border-[1.5px] border-pink-200 bg-gray-50 px-3 py-2.5 font-medium text-gray-400"
            title="Hanya dapat dilihat oleh kasir"
            disabled
          >
            <span class="truncate">
              {paymentOptions.find((opt) => opt.value === selectedTransaksi.payment_method)?.label || 'Pilih'}
            </span>
            <svg
              class="ml-2 h-4 w-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
            >
          </button>
        </div>
        <button
          class="mt-2 w-full rounded-xl bg-pink-500 py-3 text-base font-bold text-white shadow-lg shadow-pink-200/30 transition-colors hover:bg-pink-600"
          onclick={() => (showDetailModal = false)}>Tutup</button
        >
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
    animation: slideUpModal 0.32s cubic-bezier(0.4, 0, 0.2, 1);
  }
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

  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }
</style>

