<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import Topbar from '$lib/components/shared/Topbar.svelte';
import { slide, fade, fly } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { goto } from '$app/navigation';
import { getWitaDateRangeUtc } from '$lib/utils/index';
import ModalSheet from '$lib/components/shared/ModalSheet.svelte';
import { userRole, userProfile, setUserRole } from '$lib/stores/userRole';
import { memoize } from '$lib/utils/performance';
import { dataService, realtimeManager } from '$lib/services/dataService';

// Lazy load icons
let Wallet, ArrowDownCircle, ArrowUpCircle, FilterIcon;
let pin = '';
// Hapus variabel userRole yang lama
// let userRole = '';

// Ganti dengan subscribe ke store
let currentUserRole = '';
let userProfileData = null;

userRole.subscribe(val => currentUserRole = val || '');
userProfile.subscribe(val => userProfileData = val);

onMount(async () => {
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
  
  await fetchPin();
  await loadLaporanData();
  setupRealtimeSubscriptions();

  // Jika role belum ada di store, coba validasi dengan Supabase
  if (!currentUserRole) {
    const { data: { session } } = await dataService.supabaseClient.auth.getSession();
    if (session?.user) {
      const { data: profile } = await dataService.supabaseClient
        .from('profil')
        .select('role, username')
        .eq('id', session.user.id)
        .single();
      if (profile) {
        setUserRole(profile.role, profile);
      }
    }
  }
  
  if (currentUserRole === 'kasir') {
    const { data } = await dataService.supabaseClient.from('pengaturan_keamanan').select('locked_pages').single();
    const lockedPages = data?.locked_pages || ['laporan', 'beranda'];
    if (lockedPages.includes('laporan')) {
      showPinModal = true;
    }
  }
  
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  filterDate = now.toISOString().slice(0, 10);
  filterMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  filterYear = now.getFullYear().toString();
});

// Load laporan data dengan smart caching
async function loadLaporanData() {
  try {
    // Gunakan startDate saja untuk daily report, atau range untuk multi-day
    const dateRange = startDate === endDate ? startDate : `${startDate}_${endDate}`;
    const reportData = await dataService.getReportData(dateRange, 'daily');
    
    // Apply report data with null checks
    summary = reportData?.summary || { pendapatan: 0, pengeluaran: 0, saldo: 0 };
    pemasukanUsaha = reportData?.pemasukanUsaha || [];
    pemasukanLain = reportData?.pemasukanLain || [];
    bebanUsaha = reportData?.bebanUsaha || [];
    bebanLain = reportData?.bebanLain || [];
    laporan = reportData?.transactions || [];
    
  } catch (error) {
    console.error('Error loading laporan data:', error);
    // Set default values on error
    summary = { pendapatan: 0, pengeluaran: 0, saldo: 0 };
    pemasukanUsaha = [];
    pemasukanLain = [];
    bebanUsaha = [];
    bebanLain = [];
    laporan = [];
  }
}

// Setup real-time subscriptions
function setupRealtimeSubscriptions() {
  // Subscribe to buku_kas changes for real-time report updates
  realtimeManager.subscribe('buku_kas', async (payload) => {
    console.log('Laporan update received:', payload);
    await loadLaporanData();
  });
}

// Cleanup real-time subscriptions on destroy
onDestroy(() => {
  realtimeManager.unsubscribeAll();
});

async function fetchPin() {
  const { data } = await dataService.supabaseClient.from('pengaturan_keamanan').select('pin').single();
  pin = data?.pin || '1234';
}

// Touch handling variables
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isSwiping = false;
let isTouchDevice = false;
let clickBlocked = false;

// Polling interval
let pollingInterval;

const navs = [
  { label: 'Beranda', path: '/' },
  { label: 'Kasir', path: '/pos' },
  { label: 'Catat', path: '/catat' },
  { label: 'Laporan', path: '/laporan' },
];

let showFilter = false;
let showDatePicker = false;
let showEndDatePicker = false;
let filterType: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' = 'harian';
let filterDate = '';
let filterMonth = '';
let filterYear = '';
let startDate = getLocalDateString();
let endDate = getLocalDateString();
let showPemasukan = true;
let showPendapatanUsaha = true;
let showPemasukanLain = true;
let showPengeluaran = true;
let showBebanUsaha = true;
let showBebanLain = true;

// PIN Modal State
let showPinModal = false;
let pinInput = '';
let pinError = '';
let errorTimeout: number;
let isClosing = false;

// Inisialisasi summary dan list dengan default kosong
let summary = { pendapatan: null, pengeluaran: null, saldo: null };
let pemasukanUsaha = [];
let pemasukanLain = [];
let bebanUsaha = [];
let bebanLain = [];

let laporan = [];

// Tambahan: Data transaksi kas terstruktur untuk accordion
$: pemasukanUsahaDetail = laporan.filter(t => t.tipe === 'in' && t.jenis === 'pendapatan_usaha');
$: pemasukanLainDetail = laporan.filter(t => t.tipe === 'in' && t.jenis === 'lainnya');
$: bebanUsahaDetail = laporan.filter(t => t.tipe === 'out' && t.jenis === 'beban_usaha');
$: bebanLainDetail = laporan.filter(t => t.tipe === 'out' && t.jenis === 'lainnya');

$: pemasukanUsahaQris = pemasukanUsahaDetail.filter(t => t.payment_method === 'non-tunai');
$: pemasukanUsahaTunai = pemasukanUsahaDetail.filter(t => t.payment_method === 'tunai');
$: pemasukanLainQris = pemasukanLainDetail.filter(t => t.payment_method === 'non-tunai');
$: pemasukanLainTunai = pemasukanLainDetail.filter(t => t.payment_method === 'tunai');

$: bebanUsahaQris = bebanUsahaDetail.filter(t => t.payment_method === 'non-tunai');
$: bebanUsahaTunai = bebanUsahaDetail.filter(t => t.payment_method === 'tunai');
$: bebanLainQris = bebanLainDetail.filter(t => t.payment_method === 'non-tunai');
$: bebanLainTunai = bebanLainDetail.filter(t => t.payment_method === 'tunai');

// Reactive statements untuk total QRIS/Tunai
$: totalQrisAll = [...pemasukanUsahaDetail, ...pemasukanLainDetail, ...bebanUsahaDetail, ...bebanLainDetail]
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalTunaiAll = [...pemasukanUsahaDetail, ...pemasukanLainDetail, ...bebanUsahaDetail, ...bebanLainDetail]
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalQrisPemasukan = [...pemasukanUsahaDetail, ...pemasukanLainDetail]
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalTunaiPemasukan = [...pemasukanUsahaDetail, ...pemasukanLainDetail]
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalQrisPengeluaran = [...bebanUsahaDetail, ...bebanLainDetail]
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalTunaiPengeluaran = [...bebanUsahaDetail, ...bebanLainDetail]
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

// Memoize untuk summary box
const memoizedSummary = memoize((pemasukanUsahaDetail, pemasukanLainDetail, bebanUsahaDetail, bebanLainDetail) => {
  const totalPemasukan = pemasukanUsahaDetail.concat(pemasukanLainDetail).reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalPengeluaran = bebanUsahaDetail.concat(bebanLainDetail).reduce((sum, t) => sum + (t.amount || 0), 0);
  
  // Laba (Rugi) Kotor = Pendapatan - Pengeluaran
  const labaKotor = totalPemasukan - totalPengeluaran;
  
  // Pajak Penghasilan = 0,5% dari Laba Kotor, tapi 0 jika Laba Kotor < 0
  const pajak = labaKotor > 0 ? Math.round(labaKotor * 0.005) : 0;
  
  // Laba (Rugi) Bersih = Laba Kotor - Pajak
  const labaBersih = labaKotor - pajak;
  
  return {
    pendapatan: totalPemasukan,
    pengeluaran: totalPengeluaran,
    saldo: totalPemasukan - totalPengeluaran,
    labaKotor,
    pajak,
    labaBersih
  };
}, (a, b, c, d) => `${a.length}-${b.length}-${c.length}-${d.length}`);

$: summary = memoizedSummary(pemasukanUsahaDetail, pemasukanLainDetail, bebanUsahaDetail, bebanLainDetail);

// Tambahkan watcher universal untuk fetch data setiap kali startDate atau endDate berubah
$: if (startDate && endDate) {
  loadLaporanData();
}

// Tambahkan watcher khusus untuk filter bulanan
$: if (filterType === 'bulanan' && filterMonth && filterYear) {
  const y = parseInt(filterYear);
  const m = parseInt(filterMonth) - 1;
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
    const pad = n => n.toString().padStart(2, '0');
    startDate = `${y}-${pad(m + 1)}-01`;
    endDate = `${y}-${pad(m + 1)}-${pad(last.getDate())}`;
}

// Tambahkan watcher khusus untuk filter tahunan
$: if (filterType === 'tahunan' && filterYear) {
  startDate = `${filterYear}-01-01`;
  endDate = `${filterYear}-12-31`;
}

// Watcher khusus untuk filter mingguan di luar modal filter
$: if (!showFilter && filterType === 'mingguan' && startDate) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + 6);
  endDate = d.toISOString().slice(0, 10);
}

// Perbaiki watcher khusus untuk filter harian agar hanya aktif saat modal filter terbuka
$: if (showFilter && filterType === 'harian' && startDate) {
  endDate = startDate;
}

// Watcher khusus untuk filter bulanan di luar modal filter
$: if (!showFilter && filterType === 'bulanan' && startDate) {
  const d = new Date(startDate);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const pad = n => n.toString().padStart(2, '0');
  endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

// Watcher khusus untuk filter tahunan di luar modal filter
$: if (!showFilter && filterType === 'tahunan' && startDate) {
  const y = new Date(startDate).getFullYear();
  endDate = `${y}-12-31`;
}

function handlePinInput(num) {
  if (pinInput.length < 4) {
    pinInput += num.toString();
    
    if (pinInput.length === 4) {
      if (pinInput === pin) {
        showPinModal = false;
        pinInput = '';
        pinError = '';
      } else {
        pinError = 'PIN salah!';
        pinInput = '';
        if (errorTimeout) clearTimeout(errorTimeout);
        errorTimeout = setTimeout(() => {
          pinError = '';
        }, 2000);
      }
    }
  }
}



// Helper function untuk format currency yang aman
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '--';
  }
  return amount.toLocaleString('id-ID');
}



// Reactive statements untuk total QRIS/Tunai per sub-group
$: totalQrisPendapatanUsaha = pemasukanUsahaDetail
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalTunaiPendapatanUsaha = pemasukanUsahaDetail
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalQrisPemasukanLain = pemasukanLainDetail
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalTunaiPemasukanLain = pemasukanLainDetail
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalQrisBebanUsaha = bebanUsahaDetail
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalTunaiBebanUsaha = bebanUsahaDetail
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalQrisBebanLain = bebanLainDetail
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

$: totalTunaiBebanLain = bebanLainDetail
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum, t) => sum + (t.amount || 0), 0);

function getDeskripsiLaporan(item) {
  return item?.description?.trim() || item?.catatan?.trim() || '-';
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateString, isEndDate = false) {
  if (!dateString) {
    return isEndDate ? 'Pilih tanggal akhir' : 'Pilih tanggal awal';
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

// Fungsi untuk membuka date picker
function openDatePicker() {
  showDatePicker = true;
}

function openEndDatePicker() {
  showEndDatePicker = true;
}

// Fungsi untuk menerapkan filter
async function applyFilter() {
  showFilter = false;
  await loadLaporanData();
}


</script>

{#if showPinModal}
  <div 
    class="fixed inset-0 z-40 flex items-center justify-center transition-transform duration-300 ease-out modal-pin"
    class:translate-y-full={isClosing}
    style="top: 58px; bottom: 58px; background: linear-gradient(to bottom right, #f472b6, #ec4899, #a855f7);"
  >
    {#if pinError}
      <div 
        class="fixed top-24 left-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out"
        style="transform: translateX(-50%);"
        in:fly={{ y: -32, duration: 300, easing: cubicOut }}
        out:fade={{ duration: 200 }}
      >
        {pinError}
      </div>
    {/if}
    <div class="w-full h-full flex flex-col items-center justify-center p-4">
      <div class="bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 max-w-sm w-full">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Akses Laporan</h2>
          <p class="text-pink-100 text-sm">Masukkan PIN untuk melihat laporan</p>
        </div>
        
        <!-- PIN Display -->
        <div class="flex justify-center gap-2 mb-6">
          {#each Array(4) as _, i}
            <div class="w-4 h-4 rounded-full {pinInput.length > i ? 'bg-white' : 'bg-white/30 border border-white/50'}"></div>
          {/each}
        </div>
        
        <!-- Numpad -->
        <div class="grid grid-cols-3 gap-3 mb-4 justify-items-center">
          {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num}
            <button
              type="button"
              class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 text-white text-2xl font-bold hover:bg-white/30 active:bg-white/40 active:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-200 shadow-lg"
              onclick={() => handlePinInput(num)}
            >
              {num}
            </button>
          {/each}
          <div class="w-16 h-16"></div>
          <button
            type="button"
            class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 text-white text-2xl font-bold hover:bg-white/30 active:bg-white/40 active:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-200 shadow-lg"
            onclick={() => handlePinInput(0)}
          >
            0
          </button>
          <div class="w-16 h-16"></div>
        </div>
      </div>
    </div>
  </div>
{/if}

<div 
  class="flex flex-col min-h-screen bg-white w-full max-w-full overflow-x-hidden"
  role="main"
  aria-label="Halaman laporan keuangan"
>
  <main class="flex-1 min-h-0 w-full max-w-full overflow-x-hidden page-content"
    style="scrollbar-width:none;-ms-overflow-style:none;"
  >
    <!-- Konten utama halaman Laporan di sini -->
    <div class="max-w-md mx-auto w-full pt-4 md:pt-8 lg:pt-10 pb-8 px-2">
      <div class="flex w-full items-center gap-2 px-2 mb-3">
        <!-- Button Filter -->
        <div class="flex-none">
          <button class="w-12 h-12 p-0 rounded-xl bg-pink-500 text-white font-bold shadow-sm hover:bg-pink-600 active:bg-pink-700 transition-colors flex items-center justify-center" onclick={() => showFilter = true} aria-label="Filter laporan">
            {#if FilterIcon}
              <svelte:component this={FilterIcon} class="w-5 h-5" />
            {:else}
              <div class="w-5 h-5 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
          </button>
        </div>
        <!-- Button Filter Tanggal -->
        <button class="flex-1 h-12 min-w-[140px] rounded-xl {startDate ? 'bg-white border-pink-100 text-pink-500' : 'bg-pink-50 border-pink-200 text-pink-400'} border px-4 shadow-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-50 active:bg-pink-100 transition-colors" onclick={openDatePicker}>
          <svg class="w-5 h-5 {startDate ? 'text-pink-300' : 'text-pink-200'} flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span class="truncate">{formatDate(startDate)}</span>
        </button>
        <button class="flex-1 h-12 min-w-[140px] rounded-xl {endDate ? 'bg-white border-pink-100 text-pink-500' : 'bg-pink-50 border-pink-100 text-pink-200'} border px-4 shadow-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-50 active:bg-pink-100 transition-colors" onclick={openEndDatePicker}>
          <svg class="w-5 h-5 {endDate ? 'text-pink-300' : 'text-pink-200'} flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span class="truncate select-none">{endDate ? formatDate(endDate, true) : '-'}</span>
        </button>
      </div>

      <!-- Ringkasan Keuangan ala Beranda -->
      <div class="px-2 py-3">
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-gradient-to-br from-green-100 to-green-300 rounded-xl shadow-sm p-3 flex flex-col items-start">
            {#if ArrowDownCircle}
              <svelte:component this={ArrowDownCircle} class="w-6 h-6 mb-2 text-green-500" />
            {:else}
              <div class="w-6 h-6 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm font-medium text-green-900/80">Pemasukan</div>
            <div class="text-xl font-bold text-green-900">Rp {summary?.pendapatan !== null && summary?.pendapatan !== undefined ? summary.pendapatan.toLocaleString('id-ID') : '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-red-100 to-red-300 rounded-xl shadow-sm p-3 flex flex-col items-start">
            {#if ArrowUpCircle}
              <svelte:component this={ArrowUpCircle} class="w-6 h-6 mb-2 text-red-500" />
            {:else}
              <div class="w-6 h-6 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm font-medium text-red-900/80">Pengeluaran</div>
            <div class="text-xl font-bold text-red-900">Rp {summary?.pengeluaran !== null && summary?.pengeluaran !== undefined ? summary.pengeluaran.toLocaleString('id-ID') : '--'}</div>
          </div>
          <div class="col-span-2 bg-gradient-to-br from-cyan-100 to-pink-200 rounded-xl shadow-sm p-3 flex flex-col items-start">
            {#if Wallet}
              <svelte:component this={Wallet} class="w-6 h-6 mb-2 text-cyan-900" />
            {:else}
              <div class="w-6 h-6 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm font-medium text-cyan-900/80">Laba (Rugi)</div>
            <div class="text-xl font-bold text-cyan-900">Rp {summary?.saldo !== null && summary?.saldo !== undefined ? summary.saldo.toLocaleString('id-ID') : '--'}</div>
          </div>
        </div>
        <!-- Insight Total QRIS & Tunai Keseluruhan -->
        <div class="flex flex-wrap gap-4 mt-3 px-1 text-xs text-gray-500 font-semibold">
          <span>Total QRIS: <span class="text-pink-500 font-bold">Rp {totalQrisAll.toLocaleString('id-ID')}</span></span>
          <span>Total Tunai: <span class="text-pink-500 font-bold">Rp {totalTunaiAll.toLocaleString('id-ID')}</span></span>
        </div>
      </div>

      <!-- Section Laporan Detail -->
      <div class="px-2 mt-4 flex flex-col gap-2">
        <!-- Accordion: Pemasukan -->
        <div class="rounded-xl bg-white shadow-sm overflow-hidden">
          <button class="w-full flex justify-between items-center rounded-xl px-4 py-2 bg-white text-base font-bold text-gray-700 mb-1 min-h-[44px]" onclick={() => showPemasukan = !showPemasukan}>
            <span>Pemasukan</span>
            <svg class="w-5 h-5 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukan ? 0 : 180}deg);transform-origin:center"/></svg>
          </button>
          {#if showPemasukan}
            <div class="flex gap-4 px-4 pb-2 pt-1 text-xs text-gray-500 font-semibold">
              <span>QRIS: <span class="text-pink-500 font-bold">Rp {totalQrisPemasukan.toLocaleString('id-ID')}</span></span>
              <span>Tunai: <span class="text-pink-500 font-bold">Rp {totalTunaiPemasukan.toLocaleString('id-ID')}</span></span>
            </div>
            <div class="bg-white flex flex-col gap-0.5 py-2" transition:slide|local>
              <!-- Sub: Pendapatan Usaha -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5" onclick={() => showPendapatanUsaha = !showPendapatanUsaha}>
                <span>Pendapatan Usaha</span>
                <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPendapatanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPendapatanUsaha}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1">QRIS</div>
                  <ul class="flex flex-col gap-0.5">
                    {#if pemasukanUsahaQris.length === 0}
                      <li class="text-gray-400 italic text-sm py-2">Tidak ada data</li>
                    {/if}
                    {#each pemasukanUsahaQris as item}
                      <li class="flex justify-between text-sm text-gray-600">
                        <span>{getDeskripsiLaporan(item)}</span>
                        <span class="font-bold text-gray-700">Rp {item.amount !== null ? item.amount.toLocaleString('id-ID') : '--'}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2">Tunai</div>
                  <ul class="flex flex-col gap-0.5">
                    {#if pemasukanUsahaTunai.length === 0}
                      <li class="text-gray-400 italic text-sm py-2">Tidak ada data</li>
                    {/if}
                    {#each pemasukanUsahaTunai as item}
                      <li class="flex justify-between text-sm text-gray-600">
                        <span>{getDeskripsiLaporan(item)}</span>
                        <span class="font-bold text-gray-700">Rp {item.amount !== null ? item.amount.toLocaleString('id-ID') : '--'}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <!-- Sub: Pemasukan Lainnya -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 mt-2" onclick={() => showPemasukanLain = !showPemasukanLain}>
                <span>Pemasukan Lainnya</span>
                <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPemasukanLain}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1">QRIS</div>
                  <ul class="flex flex-col gap-0.5">
                    {#if pemasukanLainQris.length === 0}
                      <li class="text-gray-400 italic text-sm py-2">Tidak ada data</li>
                    {/if}
                    {#each pemasukanLainQris as item}
                      <li class="flex justify-between text-sm text-gray-600">
                        <span>{getDeskripsiLaporan(item)}</span>
                        <span class="font-bold text-gray-700">Rp {item.amount !== null ? item.amount.toLocaleString('id-ID') : '--'}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2">Tunai</div>
                  <ul class="flex flex-col gap-0.5">
                    {#if pemasukanLainTunai.length === 0}
                      <li class="text-gray-400 italic text-sm py-2">Tidak ada data</li>
                    {/if}
                    {#each pemasukanLainTunai as item}
                      <li class="flex justify-between text-sm text-gray-600">
                        <span>{getDeskripsiLaporan(item)}</span>
                        <span class="font-bold text-gray-700">Rp {item.amount !== null ? item.amount.toLocaleString('id-ID') : '--'}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        <!-- Accordion: Pengeluaran -->
        <div class="rounded-xl bg-white shadow-sm overflow-hidden">
          <button class="w-full flex justify-between items-center rounded-xl px-4 py-2 bg-white text-base font-bold text-gray-700 mb-1 min-h-[44px]" onclick={() => showPengeluaran = !showPengeluaran}>
            <span>Pengeluaran</span>
            <svg class="w-5 h-5 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPengeluaran ? 0 : 180}deg);transform-origin:center"/></svg>
          </button>
          {#if showPengeluaran}
            <div class="flex gap-4 px-4 pb-2 pt-1 text-xs text-gray-500 font-semibold">
              <span>QRIS: <span class="text-pink-500 font-bold">Rp {totalQrisPengeluaran.toLocaleString('id-ID')}</span></span>
              <span>Tunai: <span class="text-pink-500 font-bold">Rp {totalTunaiPengeluaran.toLocaleString('id-ID')}</span></span>
            </div>
            <div class="bg-white flex flex-col gap-0.5 py-2" transition:slide|local>
              <!-- Sub: Beban Usaha -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5" onclick={() => showBebanUsaha = !showBebanUsaha}>
                <span>Beban Usaha</span>
                <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanUsaha}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1">QRIS</div>
                  <ul class="flex flex-col gap-0.5">
                    {#if bebanUsahaQris.length === 0}
                      <li class="text-gray-400 italic text-sm py-2">Tidak ada data</li>
                    {/if}
                    {#each bebanUsahaQris as item}
                      <li class="flex justify-between text-sm text-gray-600">
                        <span>{getDeskripsiLaporan(item)}</span>
                        <span class="font-bold text-gray-700">Rp {item.amount !== null ? item.amount.toLocaleString('id-ID') : '--'}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2">Tunai</div>
                  <ul class="flex flex-col gap-0.5">
                    {#if bebanUsahaTunai.length === 0}
                      <li class="text-gray-400 italic text-sm py-2">Tidak ada data</li>
                    {/if}
                    {#each bebanUsahaTunai as item}
                      <li class="flex justify-between text-sm text-gray-600">
                        <span>{getDeskripsiLaporan(item)}</span>
                        <span class="font-bold text-gray-700">Rp {item.amount !== null ? item.amount.toLocaleString('id-ID') : '--'}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <!-- Sub: Beban Lainnya -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 mt-2" onclick={() => showBebanLain = !showBebanLain}>
                <span>Beban Lainnya</span>
                <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanLain}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1">QRIS</div>
                  <ul class="flex flex-col gap-0.5">
                    {#if bebanLainQris.length === 0}
                      <li class="text-gray-400 italic text-sm py-2">Tidak ada data</li>
                    {/if}
                    {#each bebanLainQris as item}
                      <li class="flex justify-between text-sm text-gray-600">
                        <span>{getDeskripsiLaporan(item)}</span>
                        <span class="font-bold text-gray-700">Rp {item.amount !== null ? item.amount.toLocaleString('id-ID') : '--'}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2">Tunai</div>
                  <ul class="flex flex-col gap-0.5">
                    {#if bebanLainTunai.length === 0}
                      <li class="text-gray-400 italic text-sm py-2">Tidak ada data</li>
                    {/if}
                    {#each bebanLainTunai as item}
                      <li class="flex justify-between text-sm text-gray-600">
                        <span>{getDeskripsiLaporan(item)}</span>
                        <span class="font-bold text-gray-700">Rp {item.amount !== null ? item.amount.toLocaleString('id-ID') : '--'}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        <!-- Laba (Rugi) Kotor -->
        <div class="border border-pink-100 rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-bold text-gray-700 text-base shadow-sm">
          <span>Laba (Rugi) Kotor</span>
          <span>Rp {summary?.labaKotor !== null && summary?.labaKotor !== undefined ? summary.labaKotor.toLocaleString('id-ID') : '--'}</span>
        </div>
        <!-- Pajak Penghasilan -->
        <div class="border border-pink-100 rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-bold text-gray-700 text-base shadow-sm">
          <span>Pajak Penghasilan (0,5%)</span>
          <span>Rp {summary?.pajak !== null && summary?.pajak !== undefined ? summary.pajak.toLocaleString('id-ID') : '--'}</span>
        </div>
        <!-- Laba (Rugi) Bersih -->
        <div class="border border-pink-100 rounded-xl px-4 py-3 bg-white flex justify-between items-center font-bold text-pink-600 text-base shadow-sm">
          <span>Laba (Rugi) Bersih</span>
          <span>Rp {summary?.labaBersih !== null && summary?.labaBersih !== undefined ? summary.labaBersih.toLocaleString('id-ID') : '--'}</span>
        </div>
      </div>

      <!-- Modal Filter -->
      {#if showFilter}
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div class="w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg p-6 pb-8 filter-sheet-anim">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-bold text-gray-800">Filter Laporan</h3>
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" onclick={() => showFilter = false} aria-label="Tutup filter">
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
                  onclick={() => filterType = 'harian'}
                  onkeydown={(e) => e.key === 'Enter' && (filterType = 'harian')}
                >
                  Harian
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'mingguan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  onclick={() => filterType = 'mingguan'}
                  onkeydown={(e) => e.key === 'Enter' && (filterType = 'mingguan')}
                >
                  Mingguan
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'bulanan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  onclick={() => filterType = 'bulanan'}
                  onkeydown={(e) => e.key === 'Enter' && (filterType = 'bulanan')}
                >
                  Bulanan
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'tahunan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  onclick={() => filterType = 'tahunan'}
                  onkeydown={(e) => e.key === 'Enter' && (filterType = 'tahunan')}
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
                onchange={() => { if (filterType === 'harian') endDate = startDate; }}
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
                  onchange={() => {
                    if (filterType === 'mingguan' && startDate) {
                      const d = new Date(startDate);
                      d.setDate(d.getDate() + 6);
                      endDate = d.toISOString().slice(0, 10);
                    }
                  }}
                />
              </div>
            {:else if filterType === 'bulanan'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2" for="bulanan-month">Pilih Bulan dan Tahun</label>
                <div class="flex gap-3">
                  <select id="bulanan-month" class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" bind:value={filterMonth} onchange={() => {
                    if (filterType === 'bulanan') {
                      const y = parseInt(filterYear);
                      const m = parseInt(filterMonth) - 1;
                      const first = new Date(y, m, 1);
                      const last = new Date(y, m + 1, 0);
                      const pad = n => n.toString().padStart(2, '0');
                      startDate = `${y}-${pad(m + 1)}-01`;
                      endDate = `${y}-${pad(m + 1)}-${pad(last.getDate())}`;
                    }
                  }}>
                    {#each Array(12) as _, i}
                      <option value={(i+1).toString().padStart(2, '0')}>
                        {new Date(2024, i).toLocaleDateString('id-ID', { month: 'long' })}
                      </option>
                    {/each}
                  </select>
                  <select class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" bind:value={filterYear} onchange={() => {
                    if (filterType === 'bulanan') {
                      const y = parseInt(filterYear);
                      const m = parseInt(filterMonth) - 1;
                      const first = new Date(y, m, 1);
                      const last = new Date(y, m + 1, 0);
                      const pad = n => n.toString().padStart(2, '0');
                      startDate = `${y}-${pad(m + 1)}-01`;
                      endDate = `${y}-${pad(m + 1)}-${pad(last.getDate())}`;
                    }
                  }}>
                    {#each Array(6) as _, i}
                      <option value={(2020+i).toString()}>{2020+i}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {:else if filterType === 'tahunan'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2" for="tahunan-year">Pilih Tahun</label>
                <select id="tahunan-year" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" bind:value={filterYear} onchange={() => {
                  if (filterType === 'tahunan') {
                    const y = parseInt(filterYear);
                    startDate = `${y}-01-01`;
                    endDate = `${y}-12-31`;
                  }
                }}>
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
                onclick={() => showFilter = false}
              >
                Batal
              </button>
              <button 
                class="flex-1 py-3 px-4 bg-pink-500 text-white font-semibold rounded-xl hover:bg-pink-600 active:bg-pink-700 transition-colors" 
                onclick={applyFilter}
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
          <div class="w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg p-6 pb-8" style="animation: slideUp 0.3s ease-out;">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-bold text-gray-800">Pilih Tanggal Awal</h3>
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" onclick={() => showDatePicker = false} aria-label="Tutup date picker">
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
                onclick={() => showDatePicker = false}
              >
                Batal
              </button>
              <button 
                class="flex-1 py-3 px-4 bg-pink-500 text-white font-semibold rounded-xl hover:bg-pink-600 active:bg-pink-700 transition-colors" 
                onclick={() => { showDatePicker = false; applyFilter(); }}
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
          <div class="w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg p-6 pb-8" style="animation: slideUp 0.3s ease-out;">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-bold text-gray-800">Pilih Tanggal Akhir</h3>
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" onclick={() => showEndDatePicker = false} aria-label="Tutup end date picker">
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
                onclick={() => showEndDatePicker = false}
              >
                Batal
              </button>
              <button 
                class="flex-1 py-3 px-4 bg-pink-500 text-white font-semibold rounded-xl hover:bg-pink-600 active:bg-pink-700 transition-colors" 
                onclick={() => { showEndDatePicker = false; applyFilter(); }}
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
.filter-sheet-anim {
  animation: slideUp 0.22s cubic-bezier(.4,1.4,.6,1) 1;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style> 