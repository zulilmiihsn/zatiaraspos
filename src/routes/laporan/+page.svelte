<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide, fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { page } from '$app/stores';
  import { userRole } from '$lib/stores/userRole';
  import { dataService, realtimeManager } from '$lib/services/dataService';
  import DropdownSheet from '$lib/components/shared/DropdownSheet.svelte';
  import ToastNotification from '$lib/components/shared/ToastNotification.svelte';
  import { createToastManager, handleError } from '$lib/utils/index';
  import { getWitaDateRangeUtc, formatWitaDateTime } from '$lib/utils/index';
  import { getTodayWitaStr } from '$lib/services/dataService'; // Import from dataService

  // Lazy load icons
  let Wallet: any, ArrowDownCircle: any, ArrowUpCircle: any, FilterIcon: any;

  // Store Subscriptions
  let currentUserRole: string = '';
  userRole.subscribe(val => currentUserRole = val || '');

  // Toast Manager
  const toastManager = createToastManager();

  // Report Data State
  let summary: any = { pendapatan: null, pengeluaran: null, saldo: null, labaKotor: null, pajak: null, labaBersih: null };
  let pemasukanUsaha: any[] = [];
  let pemasukanLain: any[] = [];
  let bebanUsaha: any[] = [];
  let bebanLain: any[] = [];
  let laporan: any[] = [];

  // Filter State
  let showFilter: boolean = false;
  let showDatePicker: boolean = false;
  let showEndDatePicker: boolean = false;
  let filterType: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' = 'harian';
  let filterDate: string = getTodayWitaStr();
  let filterMonth: string = (new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' })).getMonth() + 1).toString().padStart(2, '0');
  let filterYear: string = (new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' })).getFullYear()).toString();
  let startDate: string = getTodayWitaStr();
  let endDate: string = getTodayWitaStr();

  // Accordion State
  let showPemasukan: boolean = true;
  let showPendapatanUsaha: boolean = true;
  let showPemasukanLain: boolean = true;
  let showPengeluaran: boolean = true;
  let showBebanUsaha: boolean = true;
  let showBebanLain: boolean = true;

  // Bar Chart Interaction
  let selectedBarIndex: number | null = null;
  let showBarInsight: boolean = false;
  let barHoldTimeout: number | null = null;

  // Reactive statements for filtered data
  $: pemasukanUsahaDetail = laporan.filter(t => t.tipe === 'in' && t.jenis === 'pendapatan_usaha');
  $: pemasukanLainDetail = laporan.filter(t => t.tipe === 'in' && t.jenis === 'lainnya');
  $: bebanUsahaDetail = laporan.filter(t => t.tipe === 'out' && t.jenis === 'beban_usaha');
  $: bebanLainDetail = laporan.filter(t => t.tipe === 'out' && t.jenis === 'lainnya');

  $: totalQrisAll = [...pemasukanUsahaDetail, ...pemasukanLainDetail, ...bebanUsahaDetail, ...bebanLainDetail]
    .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
    .reduce((sum, t) => sum + (t.nominal || t.amount || 0), 0);

  $: totalTunaiAll = [...pemasukanUsahaDetail, ...pemasukanLainDetail, ...bebanUsahaDetail, ...bebanLainDetail]
    .filter(t => t.payment_method === 'tunai')
    .reduce((sum, t) => sum + (t.nominal || t.amount || 0), 0);

  $: totalQrisPemasukan = [...pemasukanUsahaDetail, ...pemasukanLainDetail]
    .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
    .reduce((sum, t) => sum + (t.nominal || t.amount || 0), 0);

  $: totalTunaiPemasukan = [...pemasukanUsahaDetail, ...pemasukanLainDetail]
    .filter(t => t.payment_method === 'tunai')
    .reduce((sum, t) => sum + (t.nominal || t.amount || 0), 0);

  $: totalQrisPengeluaran = [...bebanUsahaDetail, ...bebanLainDetail]
    .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
    .reduce((sum, t) => sum + (t.nominal || t.amount || 0), 0);

  $: totalTunaiPengeluaran = [...bebanUsahaDetail, ...bebanLainDetail]
    .filter(t => t.payment_method === 'tunai')
    .reduce((sum, t) => sum + (t.nominal || t.amount || 0), 0);

  // Reactive statement to load data when filter changes (debounced)
  let filterChangeTimeout: number | undefined;
  let unsubscribePage: () => void;

  onMount(async () => {
    // Lazy load Lucide icons
    const icons = await Promise.all([
      import('lucide-svelte/icons/wallet'),
      import('lucide-svelte/icons/arrow-down-circle'),
      import('lucide-svelte/icons/arrow-up-circle'),
      import('lucide-svelte/icons/filter')
    ]);
    Wallet = icons[0].default;
    ArrowDownCircle = icons[1].default;
    ArrowUpCircle = icons[2].default;
    FilterIcon = icons[3].default;

    // Load initial data
    await loadLaporanData();
    
    // Setup real-time subscriptions
    setupRealtimeSubscriptions();

    // Reactive statement to load data when filter changes (debounced)
    unsubscribePage = page.subscribe(() => {
      if (startDate && endDate && filterType) {
        if (filterChangeTimeout) clearTimeout(filterChangeTimeout);
        filterChangeTimeout = window.setTimeout(() => {
          loadLaporanData();
        }, 100); // Debounce to avoid multiple calls
      }
    });
  });

  // Reactive statements for date range based on filterType
  $: if (filterType === 'harian') {
    endDate = startDate;
  } else if (filterType === 'mingguan') {
    const d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    endDate = d.toISOString().slice(0, 10);
  } else if (filterType === 'bulanan') {
    const y = parseInt(filterYear);
    const m = parseInt(filterMonth) - 1;
    const lastDay = new Date(y, m + 1, 0);
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = lastDay.toISOString().slice(0, 10);
  } else if (filterType === 'tahunan') {
    const y = parseInt(filterYear);
    startDate = `${y}-01-01`;
    endDate = `${y}-12-31`;
  }

  onDestroy(() => {
    realtimeManager.unsubscribeAll();
    if (filterChangeTimeout) clearTimeout(filterChangeTimeout);
    if (unsubscribePage) unsubscribePage();
  });

  async function loadLaporanData() {
    try {
      const dateRange = filterType === 'harian' ? startDate : `${startDate}_${endDate}`;
      const reportData = await dataService.getReportData(dateRange, filterType);
      
      summary = reportData?.summary || { pendapatan: 0, pengeluaran: 0, saldo: 0, labaKotor: 0, pajak: 0, labaBersih: 0 };
      pemasukanUsaha = reportData?.pemasukanUsaha || [];
      pemasukanLain = reportData?.pemasukanLain || [];
      bebanUsaha = reportData?.bebanUsaha || [];
      bebanLain = reportData?.bebanLain || [];
      laporan = reportData?.transactions || [];
    } catch (error) {
      handleError(error, 'loadLaporanData', true);
      toastManager.showToastNotification('Gagal memuat data laporan', 'error');
    }
  }

  function setupRealtimeSubscriptions() {
    realtimeManager.unsubscribeAll();
    realtimeManager.subscribe('buku_kas', async () => {
      await loadLaporanData();
    });
    realtimeManager.subscribe('transaksi_kasir', async () => {
      await loadLaporanData();
    });
  }

  // Helper function to format currency safely
  function formatCurrency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '--';
    }
    return amount.toLocaleString('id-ID');
  }

  // Function to group and sum items by name (description/notes)
  function groupAndSumByName(items: any[]): { name: string; total: number }[] {
    const map = new Map<string, number>();
    for (const item of items) {
      const name = getDeskripsiLaporan(item);
      const prev = map.get(name) || 0;
      map.set(name, prev + (item.nominal || item.amount || 0));
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }

  function getDeskripsiLaporan(item: any): string {
    return item?.description?.trim() || item?.catatan?.trim() || '-';
  }

  function openDatePicker() {
    showDatePicker = true;
  }

  function openEndDatePicker() {
    showEndDatePicker = true;
  }

  async function applyFilter() {
    showFilter = false;
    await loadLaporanData();
  }

  // State for expanded items in accordions
  let expandedItems = new Set<string>();
  function toggleExpand(name: string) {
    if (expandedItems.has(name)) {
      expandedItems.delete(name);
    } else {
      expandedItems.add(name);
    }
    expandedItems = new Set(expandedItems); // Trigger reactivity
  }
</script>

<!-- Toast Notification -->
{#if toastManager.showToast}
  <ToastNotification
    show={toastManager.showToast}
    message={toastManager.toastMessage}
    type={toastManager.toastType}
    duration={3000} 
    position="top"
  />
{/if}

<div 
  class="flex flex-col min-h-screen bg-white w-full max-w-full overflow-x-hidden"
  role="main"
  aria-label="Halaman laporan keuangan"
>
  <main class="flex-1 min-h-0 overflow-y-auto w-full max-w-full overflow-x-hidden page-content scrollbar-hide">
    <!-- Konten utama halaman Laporan di sini -->
    <div class="max-w-md mx-auto w-full pt-4 md:pt-8 lg:pt-10 pb-8 px-2 md:max-w-3xl md:px-8 lg:max-w-none lg:px-6">
      <div class="flex w-full items-center gap-2 px-2 mb-3 md:gap-4 md:px-0 md:mb-6">
        <!-- Button Filter -->
        <div class="flex-none">
          <button class="w-12 h-12 md:w-14 md:h-14 p-0 rounded-xl bg-pink-500 text-white font-bold shadow-sm hover:bg-pink-600 active:bg-pink-700 transition-colors flex items-center justify-center md:text-xl" on:click={() => showFilter = true} aria-label="Filter laporan">
            {#if FilterIcon}
              <svelte:component this={FilterIcon} class="w-5 h-5 md:w-7 md:h-7" />
            {:else}
              <div class="w-5 h-5 md:w-7 md:h-7 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
          </button>
        </div>
        <!-- Button Filter Tanggal -->
        <button class="flex-1 h-12 md:h-14 min-w-[140px] rounded-xl {startDate ? 'bg-white border-pink-100 text-pink-500' : 'bg-pink-50 border-pink-200 text-pink-400'} border px-4 md:px-6 shadow-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-50 active:bg-pink-100 transition-colors md:text-lg" on:click={openDatePicker}>
          <svg class="w-5 h-5 md:w-7 md:h-7 {startDate ? 'text-pink-300' : 'text-pink-200'} flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span class="truncate">{formatWitaDateTime(startDate)}</span>
        </button>
        <button class="flex-1 h-12 md:h-14 min-w-[140px] rounded-xl {endDate ? 'bg-white border-pink-100 text-pink-500' : 'bg-pink-50 border-pink-100 text-pink-200'} border px-4 md:px-6 shadow-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-50 active:bg-pink-100 transition-colors md:text-lg" on:click={openEndDatePicker}>
          <svg class="w-5 h-5 md:w-7 md:h-7 {endDate ? 'text-pink-300' : 'text-pink-200'} flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span class="truncate select-none">{endDate ? formatWitaDateTime(endDate) : '-'}</span>
        </button>
      </div>

      <!-- Ringkasan Keuangan ala Beranda -->
      <div class="px-2 py-3 md:px-0 md:py-6 md:rounded-2xl md:shadow md:mb-8">
        <div class="md:px-6">
          <div class="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-6">
            <div class="bg-gradient-to-br from-green-100 to-green-300 rounded-xl shadow-sm p-3 flex flex-col items-start md:p-4 md:rounded-2xl md:gap-1 md:items-center md:justify-center lg:p-3">
            {#if ArrowDownCircle}
                <svelte:component this={ArrowDownCircle} class="w-6 h-6 mb-2 text-green-500 md:w-8 md:h-8 md:mb-2 lg:w-6 lg:h-6 lg:mb-1" />
            {:else}
                <div class="w-6 h-6 mb-2 flex items-center justify-center md:w-8 md:h-8 md:mb-2 lg:w-6 lg:h-6 lg:mb-1">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
              <div class="text-sm font-medium text-green-900/80 md:text-base md:text-center lg:text-sm">Pemasukan</div>
              <div class="text-xl font-bold text-green-900 md:text-2xl md:text-center lg:text-lg">Rp {formatCurrency(summary?.pendapatan)}</div>
          </div>
            <div class="bg-gradient-to-br from-red-100 to-red-300 rounded-xl shadow-sm p-3 flex flex-col items-start md:p-4 md:rounded-2xl md:gap-1 md:items-center md:justify-center lg:p-3">
            {#if ArrowUpCircle}
                <svelte:component this={ArrowUpCircle} class="w-6 h-6 mb-2 text-red-500 md:w-8 md:h-8 md:mb-2 lg:w-6 lg:h-6 lg:mb-1" />
            {:else}
                <div class="w-6 h-6 mb-2 flex items-center justify-center md:w-8 md:h-8 md:mb-2 lg:w-6 lg:h-6 lg:mb-1">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
              <div class="text-sm font-medium text-red-900/80 md:text-base md:text-center lg:text-sm">Pengeluaran</div>
              <div class="text-xl font-bold text-red-900 md:text-2xl md:text-center lg:text-lg">Rp {formatCurrency(summary?.pengeluaran)}</div>
          </div>
            <div class="col-span-2 md:col-span-1 bg-gradient-to-br from-cyan-100 to-pink-200 rounded-xl shadow-sm p-3 flex flex-col items-start md:p-4 md:rounded-2xl md:gap-1 md:items-center md:justify-center lg:p-3">
            {#if Wallet}
                <svelte:component this={Wallet} class="w-6 h-6 mb-2 text-cyan-900 md:w-8 md:h-8 md:mb-2 lg:w-6 lg:h-6 lg:mb-1" />
            {:else}
                <div class="w-6 h-6 mb-2 flex items-center justify-center md:w-8 md:h-8 md:mb-2 lg:w-6 lg:h-6 lg:mb-1">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
              <div class="text-sm font-medium text-cyan-900/80 md:text-base md:text-center lg:text-sm">Laba (Rugi)</div>
              <div class="text-xl font-bold text-cyan-900 md:text-2xl md:text-center lg:text-lg">Rp {formatCurrency(summary?.saldo)}</div>
          </div>
        </div>
        <!-- Insight Total QRIS & Tunai Keseluruhan -->
          <div class="flex flex-wrap gap-4 mt-3 px-1 text-xs text-gray-500 font-semibold md:gap-6 md:text-base md:px-0 md:mt-6 lg:text-sm lg:mt-4">
            <span>Total QRIS: <span class="text-pink-500 font-bold">Rp {formatCurrency(totalQrisAll)}</span></span>
            <span>Total Tunai: <span class="text-pink-500 font-bold">Rp {formatCurrency(totalTunaiAll)}</span></span>
          </div>
        </div>
      </div>

      <!-- Section Laporan Detail -->
      <div class="px-2 mt-4 flex flex-col gap-2 md:px-0 md:mt-8 md:gap-8 lg:flex-row lg:gap-6">
        <!-- Accordion: Pemasukan -->
        <div class="rounded-xl bg-white shadow-sm overflow-hidden md:rounded-2xl md:shadow md:p-4 md:mb-4 lg:flex-1 lg:mb-0">
          <button class="w-full flex justify-between items-center rounded-xl px-4 py-2 bg-white text-base font-bold text-gray-700 mb-1 min-h-[44px] md:rounded-2xl md:px-6 md:py-4 md:text-lg md:mb-2" on:click={() => showPemasukan = !showPemasukan}>
            <span>Pemasukan</span>
            <svg class="w-5 h-5 ml-2 md:w-6 md:h-6" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukan ? 0 : 180}deg);transform-origin:center"/></svg>
          </button>
          {#if showPemasukan}
            <div class="flex gap-4 px-4 pb-2 pt-1 text-xs text-gray-500 font-semibold md:gap-6 md:px-6 md:text-base md:pb-4 md:pt-2">
              <span>QRIS: <span class="text-pink-500 font-bold">Rp {formatCurrency(totalQrisPemasukan)}</span></span>
              <span>Tunai: <span class="text-pink-500 font-bold">Rp {formatCurrency(totalTunaiPemasukan)}</span></span>
            </div>
            <div class="bg-white flex flex-col gap-0.5 py-2 md:gap-2 md:py-4" transition:slide|local>
              <!-- Sub: Pendapatan Usaha -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 md:px-6 md:py-2 md:text-base md:mb-1" on:click={() => showPendapatanUsaha = !showPendapatanUsaha}>
                <span>Pendapatan Usaha</span>
                <svg class="w-4 h-4 ml-2 md:w-5 md:h-5" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPendapatanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPendapatanUsaha}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1 md:px-6 md:pb-2 md:pt-1 md:gap-2" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1 md:text-sm md:mb-2 md:mt-2">QRIS</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if pemasukanUsahaDetail.filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai').length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(pemasukanUsahaDetail.filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} on:click={() => toggleExpand(grouped.name)}>{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {formatCurrency(grouped.total)}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2 md:text-sm md:mb-2 md:mt-3">Tunai</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if pemasukanUsahaDetail.filter(t => t.payment_method === 'tunai').length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(pemasukanUsahaDetail.filter(t => t.payment_method === 'tunai')).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} on:click={() => toggleExpand(grouped.name)}>{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {formatCurrency(grouped.total)}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <!-- Sub: Pemasukan Lainnya -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 mt-2 md:px-6 md:py-2 md:text-base md:mb-1 md:mt-3" on:click={() => showPemasukanLain = !showPemasukanLain}>
                <span>Pemasukan Lainnya</span>
                <svg class="w-4 h-4 ml-2 md:w-5 md:h-5" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPemasukanLain}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1 md:px-6 md:pb-2 md:pt-1 md:gap-2" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1 md:text-sm md:mb-2 md:mt-2">QRIS</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if pemasukanLainDetail.filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai').length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(pemasukanLainDetail.filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} on:click={() => toggleExpand(grouped.name)}>{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {formatCurrency(grouped.total)}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2 md:text-sm md:mb-2 md:mt-3">Tunai</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if pemasukanLainDetail.filter(t => t.payment_method === 'tunai').length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(pemasukanLainDetail.filter(t => t.payment_method === 'tunai')).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} on:click={() => toggleExpand(grouped.name)}>{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {formatCurrency(grouped.total)}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        <!-- Accordion: Pengeluaran -->
        <div class="rounded-xl bg-white shadow-sm overflow-hidden md:rounded-2xl md:shadow md:p-4 md:mb-4 lg:flex-1 lg:mb-0">
          <button class="w-full flex justify-between items-center rounded-xl px-4 py-2 bg-white text-base font-bold text-gray-700 mb-1 min-h-[44px] md:rounded-2xl md:px-6 md:py-4 md:text-lg md:mb-2" on:click={() => showPengeluaran = !showPengeluaran}>
            <span>Pengeluaran</span>
            <svg class="w-5 h-5 ml-2 md:w-6 md:h-6" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPengeluaran ? 0 : 180}deg);transform-origin:center"/></svg>
          </button>
          {#if showPengeluaran}
            <div class="flex gap-4 px-4 pb-2 pt-1 text-xs text-gray-500 font-semibold md:gap-6 md:px-6 md:text-base md:pb-4 md:pt-2">
              <span>QRIS: <span class="text-pink-500 font-bold">Rp {formatCurrency(totalQrisPengeluaran)}</span></span>
              <span>Tunai: <span class="text-pink-500 font-bold">Rp {formatCurrency(totalTunaiPengeluaran)}</span></span>
            </div>
            <div class="bg-white flex flex-col gap-0.5 py-2 md:gap-2 md:py-4" transition:slide|local>
              <!-- Sub: Beban Usaha -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 md:px-6 md:py-2 md:text-base md:mb-1" on:click={() => showBebanUsaha = !showBebanUsaha}>
                <span>Beban Usaha</span>
                <svg class="w-4 h-4 ml-2 md:w-5 md:h-5" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanUsaha}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1 md:px-6 md:pb-2 md:pt-1 md:gap-2" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1 md:text-sm md:mb-2 md:mt-2">QRIS</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if bebanUsahaDetail.filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai').length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(bebanUsahaDetail.filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} on:click={() => toggleExpand(grouped.name)}>{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {formatCurrency(grouped.total)}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2 md:text-sm md:mb-2 md:mt-3">Tunai</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if bebanUsahaDetail.filter(t => t.payment_method === 'tunai').length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(bebanUsahaDetail.filter(t => t.payment_method === 'tunai')).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} on:click={() => toggleExpand(grouped.name)}>{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {formatCurrency(grouped.total)}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <!-- Sub: Beban Lainnya -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 mt-2 md:px-6 md:py-2 md:text-base md:mb-1 md:mt-3" on:click={() => showBebanLain = !showBebanLain}>
                <span>Beban Lainnya</span>
                <svg class="w-4 h-4 ml-2 md:w-5 md:h-5" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanLain}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1 md:px-6 md:pb-2 md:pt-1 md:gap-2" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1 md:text-sm md:mb-2 md:mt-2">QRIS</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if bebanLainDetail.filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai').length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(bebanLainDetail.filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} on:click={() => toggleExpand(grouped.name)}>{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {formatCurrency(grouped.total)}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2 md:text-sm md:mb-2 md:mt-3">Tunai</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if bebanLainDetail.filter(t => t.payment_method === 'tunai').length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(bebanLainDetail.filter(t => t.payment_method === 'tunai')).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} on:click={() => toggleExpand(grouped.name)}>{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {formatCurrency(grouped.total)}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        <!-- Section Laba/Rugi - Desktop Layout -->
        <div class="lg:flex-1 lg:flex lg:flex-col lg:gap-4">
          <!-- Laba (Rugi) Kotor -->
          <div class="border border-pink-100 rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-bold text-gray-700 text-base shadow-sm md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:rounded-2xl md:shadow-sm md:p-6 md:mb-0 md:text-center md:text-2xl md:justify-center md:gap-4 lg:flex-col lg:justify-center lg:min-h-[120px] lg:mb-0 lg:h-full">
            <span>Laba (Rugi) Kotor</span>
            <span>Rp {formatCurrency(summary?.labaKotor)}</span>
          </div>
          <!-- Pajak Penghasilan -->
          <div class="border border-pink-100 rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-bold text-gray-700 text-base shadow-sm md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:rounded-2xl md:shadow-sm md:p-6 md:mb-0 md:text-center md:text-2xl md:justify-center md:gap-4 lg:flex-col lg:justify-center lg:min-h-[120px] lg:mb-0 lg:h-full">
            <span>Pajak Penghasilan (0,5%)</span>
            <span>Rp {formatCurrency(summary?.pajak)}</span>
          </div>
          <!-- Laba (Rugi) Bersih -->
          <div class="border border-pink-100 rounded-xl px-4 py-3 bg-white flex justify-between items-center font-bold text-pink-600 text-base shadow-sm md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:rounded-2xl md:shadow-sm md:p-6 md:mb-0 md:text-center md:text-2xl md:justify-center md:gap-4 lg:flex-col lg:justify-center lg:min-h-[120px] lg:mb-0 lg:h-full">
            <span>Laba (Rugi) Bersih</span>
            <span>Rp {formatCurrency(summary?.labaBersih)}</span>
          </div>
        </div>
      </div>

      <!-- Modal Filter -->
      {#if showFilter}
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div class="w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg p-6 pb-8 filter-sheet-anim">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-bold text-gray-800">Filter Laporan</h3>
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" on:click={() => showFilter = false} aria-label="Tutup filter">
                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <!-- Pilihan Tipe Filter -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-3" for="filter-type-buttons">Pilih Periode</label>
              <div class="grid grid-cols-2 gap-3" id="filter-type-buttons" role="group" aria-labelledby="filter-type-buttons">
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'harian' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  on:click={() => filterType = 'harian'}
                >
                  Harian
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'mingguan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  on:click={() => filterType = 'mingguan'}
                >
                  Mingguan
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'bulanan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  on:click={() => filterType = 'bulanan'}
                >
                  Bulanan
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'tahunan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  on:click={() => filterType = 'tahunan'}
                >
                  Tahunan
                </button>
              </div>
            </div>
            <!-- Input Filter Berdasarkan Tipe -->
            {#if filterType === 'harian'}
              <div class="mb-6">
                              <label class="block text-sm font-medium text-gray-700 mb-2" for="harian-date">Pilih Tanggal</label>
              <input 
                id="harian-date"
                type="date" 
                class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" 
                bind:value={startDate}
              />
              </div>
            {:else if filterType === 'mingguan'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2" for="mingguan-date">Pilih Tanggal Awal Minggu</label>
                <input 
                  id="mingguan-date"
                  type="date" 
                  class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" 
                  bind:value={startDate}
                />
              </div>
            {:else if filterType === 'bulanan'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2" for="bulanan-month">Pilih Bulan dan Tahun</label>
                <div class="flex gap-3">
                  <select id="bulanan-month" class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" bind:value={filterMonth}>
                    {#each Array(12) as _, i}
                      <option value={(i+1).toString().padStart(2, '0')}>
                        {new Date(2024, i).toLocaleDateString('id-ID', { month: 'long' })}
                      </option>
                    {/each}
                  </select>
                  <select class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" bind:value={filterYear}>
                    {#each Array(6) as _, i}
                      <option value={(2020+i).toString()}>{2020+i}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {:else if filterType === 'tahunan'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2" for="tahunan-year">Pilih Tahun</label>
                <select id="tahunan-year" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" bind:value={filterYear}>
                  {#each Array(6) as _, i}
                    <option value={(2020+i).toString()}>{2020+i}</option>
                  {/each}
                </select>
              </div>
            {/if}
            <!-- Button Actions -->
            <div class="flex gap-3">
              <button 
                class="flex-1 py-3 px-4 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors" 
                on:click={() => showFilter = false}
              >
                Batal
              </button>
              <button 
                class="flex-1 py-3 px-4 bg-pink-500 text-white font-semibold rounded-xl hover:bg-pink-600 active:bg-pink-700 transition-colors" 
                on:click={applyFilter}
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Modal Date Picker Start -->
      {#if showDatePicker}
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div class="w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg p-6 pb-8 modal-sheet-anim">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-bold text-gray-800">Pilih Tanggal Awal</h3>
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" on:click={() => showDatePicker = false} aria-label="Tutup date picker">
                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="date-picker-start">Tanggal Awal</label>
              <input 
                id="date-picker-start"
                type="date" 
                class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" 
                bind:value={startDate}
              />
            </div>

            <div class="flex gap-3">
              <button 
                class="flex-1 py-3 px-4 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors" 
                on:click={() => showDatePicker = false}
              >
                Batal
              </button>
              <button 
                class="flex-1 py-3 px-4 bg-pink-500 text-white font-semibold rounded-xl hover:bg-pink-600 active:bg-pink-700 transition-colors" 
                on:click={() => { showDatePicker = false; applyFilter(); }}
              >
                Pilih
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Modal Date Picker End -->
      {#if showEndDatePicker}
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div class="w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg p-6 pb-8 modal-sheet-anim">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-bold text-gray-800">Pilih Tanggal Akhir</h3>
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" on:click={() => showEndDatePicker = false} aria-label="Tutup end date picker">
                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="date-picker-end">Tanggal Akhir</label>
              <input 
                id="date-picker-end"
                type="date" 
                class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" 
                bind:value={endDate}
              />
            </div>

            <div class="flex gap-3">
              <button 
                class="flex-1 py-3 px-4 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors" 
                on:click={() => showEndDatePicker = false}
              >
                Batal
              </button>
              <button 
                class="flex-1 py-3 px-4 bg-pink-500 text-white font-semibold rounded-xl hover:bg-pink-600 active:bg-pink-700 transition-colors" 
                on:click={() => { showEndDatePicker = false; applyFilter(); }}
              >
                Pilih
              </button>
            </div>
          </div>
        </div>
      {/if}

    </div>
  </main>
</div> 

<style>
.filter-sheet-anim, .modal-sheet-anim {
  animation: slideUp 0.22s cubic-bezier(.4,1.4,.6,1) 1;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>