<script lang="ts">
import { onMount, onDestroy } from 'svelte';
	import Topbar from '$lib/components/shared/topbar.svelte';
import { slide, fade, fly } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { goto } from '$app/navigation';
import { getWitaDateRangeUtc, formatWitaDateTime } from '$lib/utils/index';
import ModalSheet from '$lib/components/shared/modalSheet.svelte';
import { userRole, userProfile, setUserRole } from '$lib/stores/userRole';
import { memoize } from '$lib/utils/performance';
import { dataService, realtimeManager } from '$lib/services/dataService';
import { selectedBranch } from '$lib/stores/selectedBranch';
import ToastNotification from '$lib/components/shared/toastNotification.svelte';
import { createToastManager, ErrorHandler } from '$lib/utils/index';

// Lazy load icons with proper typing
let Wallet: any, ArrowDownCircle: any, ArrowUpCircle: any, FilterIcon: any;
// Hapus variabel userRole yang lama
// let userRole = '';

// Ganti dengan subscribe ke store
let currentUserRole = '';
let userProfileData: any = null;
let unsubscribeBranch: (() => void) | null = null;
let isInitialLoad = true; // Add flag to prevent double fetching

userRole.subscribe(val => currentUserRole = val || '');
userProfile.subscribe(val => userProfileData = val);

// Tambahkan deklarasi function loadLaporanData
async function loadLaporanData() {
  try {
    // Pastikan startDate dan endDate sudah ada
    if (!startDate || !endDate) {
      startDate = startDate || getLocalDateStringWITA();
      endDate = endDate || startDate;
    }
    
    // Force clear cache untuk memastikan data terbaru
    await dataService.clearAllCaches();
    
    // Gunakan startDate saja untuk daily report, atau range untuk multi-day
    const dateRange = startDate === endDate ? startDate : `${startDate}_${endDate}`;
    const reportData = await dataService.getReportData(dateRange, 'daily');
    
    // Apply report data with null checks - HAPUS FILTERING KEDUA
    summary = reportData?.summary || { pendapatan: 0, pengeluaran: 0, saldo: 0, labaKotor: 0, pajak: 0, labaBersih: 0 };
    pemasukanUsaha = reportData?.pemasukanUsaha || [];
    pemasukanLain = reportData?.pemasukanLain || [];
    bebanUsaha = reportData?.bebanUsaha || [];
    bebanLain = reportData?.bebanLain || [];
    // Gunakan data langsung dari dataService tanpa filtering tambahan
    laporan = reportData?.transactions || [];
  } catch (error) {
    ErrorHandler.logError(error, 'loadLaporanData');
    toastManager.showToastNotification('Gagal memuat data laporan', 'error');
  }
}

// Tambahkan deklarasi function setupRealtimeSubscriptions
function setupRealtimeSubscriptions() {
  // Unsubscribe existing subscriptions first
  realtimeManager.unsubscribeAll();
  
  // Subscribe to buku_kas changes
  realtimeManager.subscribe('buku_kas', async (payload) => {
    // Reload data when buku_kas changes
    await loadLaporanData();
  });
  
  // Subscribe to transaksi_kasir changes
  realtimeManager.subscribe('transaksi_kasir', async (payload) => {
    // Reload data when transaksi_kasir changes
    await loadLaporanData();
  });
}

// Tambahkan function untuk fetch data saat masuk halaman
async function initializePageData() {
  // Set default date range jika belum ada
  if (!startDate) {
    startDate = getLocalDateStringWITA();
  }
  if (!endDate) {
    endDate = startDate;
  }
  
  // Clear cache untuk memastikan data terbaru
  await dataService.clearAllCaches();
  
  // Load initial data
  await loadLaporanData();
  
  // Setup realtime subscriptions
  setupRealtimeSubscriptions();
}

onMount(() => {
  Promise.all([
    import('lucide-svelte/icons/wallet'),
    import('lucide-svelte/icons/arrow-down-circle'),
    import('lucide-svelte/icons/arrow-up-circle'),
    import('lucide-svelte/icons/filter')
  ]).then(icons => {
    Wallet = icons[0].default;
    ArrowDownCircle = icons[1].default;
    ArrowUpCircle = icons[2].default;
    FilterIcon = icons[3].default;
  });
  
  // Removed fetchPin() and locked_pages check
  initializePageData().then(() => {
    // Jika role belum ada di store, coba validasi dengan Supabase
    if (!currentUserRole) {
      dataService.supabaseClient.auth.getSession().then(({ data: { session } }: any) => {
        if (session?.user) {
          dataService.supabaseClient
            .from('profil')
            .select('role, username')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }: any) => {
              if (profile) {
                setUserRole(profile.role, profile);
              }
            });
        }
      });
    }
  });
  
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  filterDate = now.toISOString().slice(0, 10);
  filterMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  filterYear = now.getFullYear().toString();

  // Subscribe ke selectedBranch untuk fetch ulang data saat cabang berubah
  unsubscribeBranch = selectedBranch.subscribe(() => {
    // Skip jika ini adalah initial load
    if (isInitialLoad) {
      isInitialLoad = false;
      return;
    }
    loadLaporanData();
  });
  
  // Tambahkan event listener untuk visibility change (saat kembali ke tab)
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      loadLaporanData();
    }
  };
  
  // Tambahkan event listener untuk focus (saat kembali ke tab)
  const handleFocus = () => {
    loadLaporanData();
  };
  
  // Tambahkan event listener untuk navigation (saat user navigasi ke halaman ini)
  const handleNavigation = () => {
    loadLaporanData();
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('popstate', handleNavigation);
  
  // Cleanup function untuk event listener
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('popstate', handleNavigation);
  };
});

onDestroy(() => {
  // Unsubscribe dari realtime
  realtimeManager.unsubscribeAll();
  
  // Unsubscribe dari branch changes
  if (unsubscribeBranch) unsubscribeBranch();
  
  // Clear any pending timeouts
  // Removed errorTimeout
  if (filterChangeTimeout) clearTimeout(filterChangeTimeout);
});

// Removed fetchPin()

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
let filterDate = getLocalDateStringWITA();
let filterMonth = (new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' })).getMonth() + 1).toString().padStart(2, '0');
let filterYear = (new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' })).getFullYear()).toString();
let startDate = getLocalDateStringWITA();
let endDate = getLocalDateStringWITA();
let showPemasukan = true;
let showPendapatanUsaha = true;
let showPemasukanLain = true;
let showPengeluaran = true;
let showBebanUsaha = true;
let showBebanLain = true;

// Removed PIN Modal State (showPinModal, pin, errorTimeout, isClosing)

// Inisialisasi summary dan list dengan default kosong
let summary: { pendapatan: number | null; pengeluaran: number | null; saldo: number | null; labaKotor: number | null; pajak: number | null; labaBersih: number | null } = { pendapatan: null, pengeluaran: null, saldo: null, labaKotor: null, pajak: null, labaBersih: null };
let pemasukanUsaha = [];
let pemasukanLain = [];
let bebanUsaha = [];
let bebanLain = [];

let laporan: any[] = [];

// Tambahan: Data transaksi kas terstruktur untuk accordion
$: pemasukanUsahaDetail = laporan.filter((t: any) => t.tipe === 'in' && t.jenis === 'pendapatan_usaha');
$: pemasukanLainDetail = laporan.filter((t: any) => t.tipe === 'in' && t.jenis === 'lainnya');
$: bebanUsahaDetail = laporan.filter((t: any) => t.tipe === 'out' && t.jenis === 'beban_usaha');
$: bebanLainDetail = laporan.filter((t: any) => t.tipe === 'out' && t.jenis === 'lainnya');

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
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalTunaiAll = [...pemasukanUsahaDetail, ...pemasukanLainDetail, ...bebanUsahaDetail, ...bebanLainDetail]
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalQrisPemasukan = [...pemasukanUsahaDetail, ...pemasukanLainDetail]
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalTunaiPemasukan = [...pemasukanUsahaDetail, ...pemasukanLainDetail]
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalQrisPengeluaran = [...bebanUsahaDetail, ...bebanLainDetail]
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalTunaiPengeluaran = [...bebanUsahaDetail, ...bebanLainDetail]
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

// Memoize untuk summary box
const memoizedSummary = memoize((pemasukanUsahaDetail: any[], pemasukanLainDetail: any[], bebanUsahaDetail: any[], bebanLainDetail: any[]) => {
  // Gunakan nominal seperti dataService, fallback ke amount jika nominal tidak ada
  const totalPemasukan = pemasukanUsahaDetail.concat(pemasukanLainDetail).reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);
  const totalPengeluaran = bebanUsahaDetail.concat(bebanLainDetail).reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);
  
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

// HAPUS reactive statement yang konflik - gunakan summary dari dataService langsung
// $: summary = memoizedSummary(pemasukanUsahaDetail, pemasukanLainDetail, bebanUsahaDetail, bebanLainDetail);

// HAPUS watcher universal yang menyebabkan double fetching
// $: if (startDate && endDate) {
//   loadLaporanData();
// }

// Tambahkan watcher untuk reload data saat filter berubah (hanya jika tidak sedang di modal filter)
let filterChangeTimeout: number;
$: if (!showFilter && startDate && endDate && filterType) {
  // Clear existing timeout
  if (filterChangeTimeout) clearTimeout(filterChangeTimeout);
  
  // Debounce untuk menghindari multiple calls
  filterChangeTimeout = setTimeout(() => {
    loadLaporanData();
  }, 300) as any;
}

// Tambahkan watcher khusus untuk filter bulanan
$: if (filterType === 'bulanan' && filterMonth && filterYear) {
  const y = parseInt(filterYear);
  const m = parseInt(filterMonth) - 1;
  const first = new Date(new Date(`${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`).toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
  const last = new Date(new Date(first).setMonth(first.getMonth() + 1) - 1);
  startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  endDate = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

// Tambahkan watcher khusus untuk filter tahunan
$: if (filterType === 'tahunan' && filterYear) {
  startDate = `${filterYear}-01-01`;
  endDate = `${filterYear}-12-31`;
}

// Watcher khusus untuk filter mingguan di luar modal filter
$: if (!showFilter && filterType === 'mingguan' && startDate) {
  const d = new Date(new Date(startDate + 'T00:00:00').toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
  d.setDate(d.getDate() + 6);
  endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Perbaiki watcher khusus untuk filter harian agar hanya aktif saat modal filter terbuka
$: if (showFilter && filterType === 'harian' && startDate) {
  endDate = startDate;
}

// Watcher khusus untuk filter bulanan di luar modal filter
$: if (!showFilter && filterType === 'bulanan' && startDate) {
  const d = new Date(new Date(startDate + 'T00:00:00').toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
}

// Watcher khusus untuk filter tahunan di luar modal filter
$: if (!showFilter && filterType === 'tahunan' && startDate) {
  const y = new Date(new Date(startDate + 'T00:00:00').toLocaleString('en-US', { timeZone: 'Asia/Makassar' })).getFullYear();
  endDate = `${y}-12-31`;
}

// Helper function untuk format currency yang aman
function formatCurrency(amount: any): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0';
  }
  return amount.toLocaleString('id-ID');
}

// Fungsi untuk group dan sum item berdasarkan nama (description/catatan)
function groupAndSumByName(items: any[]): any[] {
  const map = new Map();
  for (const item of items) {
    // Gunakan nama produk yang sebenarnya tanpa flag
    const name = getDeskripsiLaporan(item);
    
    const prev = map.get(name) || 0;
    map.set(name, prev + (item.nominal || item.amount || 0));
  }
  // Kembalikan array of { name, total }
  return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
}


// Reactive statements untuk total QRIS/Tunai per sub-group
$: totalQrisPendapatanUsaha = pemasukanUsahaDetail
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalTunaiPendapatanUsaha = pemasukanUsahaDetail
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalQrisPemasukanLain = pemasukanLainDetail
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalTunaiPemasukanLain = pemasukanLainDetail
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalQrisBebanUsaha = bebanUsahaDetail
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalTunaiBebanUsaha = bebanUsahaDetail
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalQrisBebanLain = bebanLainDetail
  .filter(t => t.payment_method === 'qris' || t.payment_method === 'non-tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

$: totalTunaiBebanLain = bebanLainDetail
  .filter(t => t.payment_method === 'tunai')
  .reduce((sum: number, t: any) => sum + (t.nominal || t.amount || 0), 0);

function getDeskripsiLaporan(item: any): string {
  return item?.description?.trim() || item?.catatan?.trim() || '-';
}

function getLocalDateStringWITA(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateString: any, isEndDate = false): string {
  if (!dateString) {
    return '';
  }
  const date = new Date(new Date(dateString + 'T00:00:00').toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
  return date.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

// Fungsi untuk membuka date picker
function openDatePicker(): void {
  showDatePicker = true;
}

function openEndDatePicker(): void {
  showEndDatePicker = true;
}

// Fungsi untuk menerapkan filter
async function applyFilter(): Promise<void> {
  // Update filter state
  showFilter = false;
  
  // Load data dengan filter baru
  await loadLaporanData();
  
  // Setup realtime subscriptions setelah filter berubah
  setupRealtimeSubscriptions();
}

// State untuk item yang sedang diperpanjang (expanded)
let expandedItems = new Set();
function toggleExpand(name: any): void {
  if (expandedItems.has(name)) {
    expandedItems.delete(name);
  } else {
    expandedItems.add(name);
  }
  // trigger reactivity
  expandedItems = new Set(expandedItems);
}

// Tambahkan helper untuk normalisasi tanggal ke YYYY-MM-DD
function toYMD(date: string | Date): string {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

// Toast notification state
let showToast = false;
let toastMessage = '';
let toastType: 'success' | 'error' | 'warning' | 'info' = 'success';

function showToastNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
  toastMessage = message;
  toastType = type;
  showToast = true;
}

// Toast management
const toastManager = createToastManager();

</script>

<!-- PinModal removed -->

<!-- Toast Notification -->
{#if toastManager.showToast}
  <ToastNotification
    show={toastManager.showToast}
    message={toastManager.toastMessage}
    type={toastManager.toastType}
    duration={2000}
    position="top"
  />
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
    <div class="max-w-md mx-auto w-full pt-4 md:pt-8 lg:pt-10 pb-8 px-2 md:max-w-3xl md:px-8 lg:max-w-none lg:px-6">
      <div class="flex w-full items-center gap-2 px-2 mb-3 md:gap-4 md:px-0 md:mb-6">
        <!-- Button Filter -->
        <div class="flex-none">
          <button class="w-12 h-12 md:w-14 md:h-14 p-0 rounded-xl bg-pink-500 text-white font-bold shadow-sm hover:bg-pink-600 active:bg-pink-700 transition-colors flex items-center justify-center md:text-xl" onclick={() => showFilter = true} aria-label="Filter laporan">
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
        <button class="flex-1 h-12 md:h-14 min-w-[140px] rounded-xl {startDate ? 'bg-white border-pink-100 text-pink-500' : 'bg-pink-50 border-pink-200 text-pink-400'} border px-4 md:px-6 shadow-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-50 active:bg-pink-100 transition-colors md:text-lg" onclick={openDatePicker}>
          <svg class="w-5 h-5 md:w-7 md:h-7 {startDate ? 'text-pink-300' : 'text-pink-200'} flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span class="truncate">{formatDate(startDate)}</span>
        </button>
        <button class="flex-1 h-12 md:h-14 min-w-[140px] rounded-xl {endDate ? 'bg-white border-pink-100 text-pink-500' : 'bg-pink-50 border-pink-100 text-pink-200'} border px-4 md:px-6 shadow-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-50 active:bg-pink-100 transition-colors md:text-lg" onclick={openEndDatePicker}>
          <svg class="w-5 h-5 md:w-7 md:h-7 {endDate ? 'text-pink-300' : 'text-pink-200'} flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span class="truncate select-none">{endDate ? formatDate(endDate, true) : '-'}</span>
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
              <div class="text-xl font-bold text-green-900 md:text-2xl md:text-center lg:text-lg">Rp {summary?.pendapatan !== null && summary?.pendapatan !== undefined ? summary.pendapatan.toLocaleString('id-ID') : '--'}</div>
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
              <div class="text-xl font-bold text-red-900 md:text-2xl md:text-center lg:text-lg">Rp {summary?.pengeluaran !== null && summary?.pengeluaran !== undefined ? summary.pengeluaran.toLocaleString('id-ID') : '--'}</div>
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
              <div class="text-xl font-bold text-cyan-900 md:text-2xl md:text-center lg:text-lg">Rp {summary?.saldo !== null && summary?.saldo !== undefined ? summary.saldo.toLocaleString('id-ID') : '--'}</div>
          </div>
        </div>
        <!-- Insight Total QRIS & Tunai Keseluruhan -->
          <div class="flex flex-wrap gap-4 mt-3 px-1 text-xs text-gray-500 font-semibold md:gap-6 md:text-base md:px-0 md:mt-6 lg:text-sm lg:mt-4">
            <span>Total QRIS: <span class="text-pink-500 font-bold">Rp {totalQrisAll.toLocaleString('id-ID')}</span></span>
            <span>Total Tunai: <span class="text-pink-500 font-bold">Rp {totalTunaiAll.toLocaleString('id-ID')}</span></span>
          </div>
        </div>
      </div>

      <!-- Section Laporan Detail -->
      <div class="px-2 mt-4 flex flex-col gap-2 md:px-0 md:mt-8 md:gap-8 lg:flex-row lg:gap-6">
        <!-- Accordion: Pemasukan -->
        <div class="rounded-xl bg-white shadow-sm overflow-hidden md:rounded-2xl md:shadow md:p-4 md:mb-4 lg:flex-1 lg:mb-0">
          <button class="w-full flex justify-between items-center rounded-xl px-4 py-2 bg-white text-base font-bold text-gray-700 mb-1 min-h-[44px] md:rounded-2xl md:px-6 md:py-4 md:text-lg md:mb-2" onclick={() => showPemasukan = !showPemasukan}>
            <span>Pemasukan</span>
            <svg class="w-5 h-5 ml-2 md:w-6 md:h-6" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukan ? 0 : 180}deg);transform-origin:center"/></svg>
          </button>
          {#if showPemasukan}
            <div class="flex gap-4 px-4 pb-2 pt-1 text-xs text-gray-500 font-semibold md:gap-6 md:px-6 md:text-base md:pb-4 md:pt-2">
              <span>QRIS: <span class="text-pink-500 font-bold">Rp {totalQrisPemasukan.toLocaleString('id-ID')}</span></span>
              <span>Tunai: <span class="text-pink-500 font-bold">Rp {totalTunaiPemasukan.toLocaleString('id-ID')}</span></span>
            </div>
            <div class="bg-white flex flex-col gap-0.5 py-2 md:gap-2 md:py-4" transition:slide|local>
              <!-- Sub: Pendapatan Usaha -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 md:px-6 md:py-2 md:text-base md:mb-1" onclick={() => showPendapatanUsaha = !showPendapatanUsaha}>
                <span>Pendapatan Usaha</span>
                <svg class="w-4 h-4 ml-2 md:w-5 md:h-5" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPendapatanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPendapatanUsaha}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1 md:px-6 md:pb-2 md:pt-1 md:gap-2" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1 md:text-sm md:mb-2 md:mt-2">QRIS</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if pemasukanUsahaQris.length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(pemasukanUsahaQris).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} onclick={() => toggleExpand(grouped.name)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)} role="button" tabindex="0">{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {grouped.total.toLocaleString('id-ID')}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2 md:text-sm md:mb-2 md:mt-3">Tunai</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if pemasukanUsahaTunai.length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(pemasukanUsahaTunai).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} onclick={() => toggleExpand(grouped.name)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)} role="button" tabindex="0">{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {grouped.total.toLocaleString('id-ID')}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <!-- Sub: Pemasukan Lainnya -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 mt-2 md:px-6 md:py-2 md:text-base md:mb-1 md:mt-3" onclick={() => showPemasukanLain = !showPemasukanLain}>
                <span>Pemasukan Lainnya</span>
                <svg class="w-4 h-4 ml-2 md:w-5 md:h-5" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPemasukanLain}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1 md:px-6 md:pb-2 md:pt-1 md:gap-2" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1 md:text-sm md:mb-2 md:mt-2">QRIS</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if pemasukanLainQris.length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(pemasukanLainQris).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} onclick={() => toggleExpand(grouped.name)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)} role="button" tabindex="0">{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {grouped.total.toLocaleString('id-ID')}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2 md:text-sm md:mb-2 md:mt-3">Tunai</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if pemasukanLainTunai.length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(pemasukanLainTunai).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} onclick={() => toggleExpand(grouped.name)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)} role="button" tabindex="0">{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {grouped.total.toLocaleString('id-ID')}</span>
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
          <button class="w-full flex justify-between items-center rounded-xl px-4 py-2 bg-white text-base font-bold text-gray-700 mb-1 min-h-[44px] md:rounded-2xl md:px-6 md:py-4 md:text-lg md:mb-2" onclick={() => showPengeluaran = !showPengeluaran}>
            <span>Pengeluaran</span>
            <svg class="w-5 h-5 ml-2 md:w-6 md:h-6" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPengeluaran ? 0 : 180}deg);transform-origin:center"/></svg>
          </button>
          {#if showPengeluaran}
            <div class="flex gap-4 px-4 pb-2 pt-1 text-xs text-gray-500 font-semibold md:gap-6 md:px-6 md:text-base md:pb-4 md:pt-2">
              <span>QRIS: <span class="text-pink-500 font-bold">Rp {totalQrisPengeluaran.toLocaleString('id-ID')}</span></span>
              <span>Tunai: <span class="text-pink-500 font-bold">Rp {totalTunaiPengeluaran.toLocaleString('id-ID')}</span></span>
            </div>
            <div class="bg-white flex flex-col gap-0.5 py-2 md:gap-2 md:py-4" transition:slide|local>
              <!-- Sub: Beban Usaha -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 md:px-6 md:py-2 md:text-base md:mb-1" onclick={() => showBebanUsaha = !showBebanUsaha}>
                <span>Beban Usaha</span>
                <svg class="w-4 h-4 ml-2 md:w-5 md:h-5" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanUsaha}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1 md:px-6 md:pb-2 md:pt-1 md:gap-2" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1 md:text-sm md:mb-2 md:mt-2">QRIS</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if bebanUsahaQris.length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(bebanUsahaQris).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} onclick={() => toggleExpand(grouped.name)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)} role="button" tabindex="0">{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {grouped.total.toLocaleString('id-ID')}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2 md:text-sm md:mb-2 md:mt-3">Tunai</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if bebanUsahaTunai.length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(bebanUsahaTunai).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} onclick={() => toggleExpand(grouped.name)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)} role="button" tabindex="0">{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {grouped.total.toLocaleString('id-ID')}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              <!-- Sub: Beban Lainnya -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 mt-2 md:px-6 md:py-2 md:text-base md:mb-1 md:mt-3" onclick={() => showBebanLain = !showBebanLain}>
                <span>Beban Lainnya</span>
                <svg class="w-4 h-4 ml-2 md:w-5 md:h-5" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanLain}
                <div class="px-4 pb-1 pt-0.5 flex flex-col gap-1 md:px-6 md:pb-2 md:pt-1 md:gap-2" transition:slide|local>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-1 md:text-sm md:mb-2 md:mt-2">QRIS</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if bebanLainQris.length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(bebanLainQris).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} onclick={() => toggleExpand(grouped.name)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)} role="button" tabindex="0">{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {grouped.total.toLocaleString('id-ID')}</span>
                      </li>
                    {/each}
                  </ul>
                  <div class="font-semibold text-xs text-pink-500 mb-1 mt-2 md:text-sm md:mb-2 md:mt-3">Tunai</div>
                  <ul class="flex flex-col gap-0.5 md:gap-1">
                    {#if bebanLainTunai.length === 0}
                      <li class="text-gray-400 italic text-sm py-2 md:text-base md:py-3">Tidak ada data</li>
                    {/if}
                    {#each groupAndSumByName(bebanLainTunai).sort((a, b) => b.total - a.total) as grouped }
                      <li class="flex justify-between text-sm text-gray-600 md:text-base">
                        <span class="{expandedItems.has(grouped.name) ? '' : 'truncate max-w-[60%]'} cursor-pointer" title={grouped.name} onclick={() => toggleExpand(grouped.name)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(grouped.name)} role="button" tabindex="0">{grouped.name}</span>
                        <span class="font-bold text-gray-700 whitespace-nowrap">Rp {grouped.total.toLocaleString('id-ID')}</span>
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
            <span>Rp {summary?.labaKotor !== null && summary?.labaKotor !== undefined ? summary.labaKotor.toLocaleString('id-ID') : '--'}</span>
          </div>
          <!-- Pajak Penghasilan -->
          <div class="border border-pink-100 rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-bold text-gray-700 text-base shadow-sm md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:rounded-2xl md:shadow-sm md:p-6 md:mb-0 md:text-center md:text-2xl md:justify-center md:gap-4 lg:flex-col lg:justify-center lg:min-h-[120px] lg:mb-0 lg:h-full">
            <span>Pajak Penghasilan (0,5%)</span>
            <span>Rp {summary?.pajak !== null && summary?.pajak !== undefined ? summary.pajak.toLocaleString('id-ID') : '--'}</span>
          </div>
          <!-- Laba (Rugi) Bersih -->
          <div class="border border-pink-100 rounded-xl px-4 py-3 bg-white flex justify-between items-center font-bold text-pink-600 text-base shadow-sm md:bg-gradient-to-br md:from-gray-50 md:to-pink-100 md:rounded-2xl md:shadow-sm md:p-6 md:mb-0 md:text-center md:text-2xl md:justify-center md:gap-4 lg:flex-col lg:justify-center lg:min-h-[120px] lg:mb-0 lg:h-full">
            <span>Laba (Rugi) Bersih</span>
            <span>Rp {summary?.labaBersih !== null && summary?.labaBersih !== undefined ? summary.labaBersih.toLocaleString('id-ID') : '--'}</span>
          </div>
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
                      const first = new Date(new Date(`${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`).toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
                      const last = new Date(new Date(first).setMonth(first.getMonth() + 1) - 1);
                      startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
                      endDate = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
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
                      const first = new Date(new Date(`${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`).toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
                      const last = new Date(new Date(first).setMonth(first.getMonth() + 1) - 1);
                      startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
                      endDate = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
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