<script lang="ts">
import { onMount } from 'svelte';
import Topbar from '$lib/components/shared/Topbar.svelte';
import { slide, fade } from 'svelte/transition';
import { cubicOut, cubicIn } from 'svelte/easing';
import { auth } from '$lib/auth.js';
import { goto } from '$app/navigation';

// Lazy load icons
let Wallet, ArrowDownCircle, ArrowUpCircle, FilterIcon, DownloadIcon;
onMount(async () => {
  const icons = await Promise.all([
    import('lucide-svelte/icons/wallet'),
    import('lucide-svelte/icons/arrow-down-circle'),
    import('lucide-svelte/icons/arrow-up-circle'),
    import('lucide-svelte/icons/filter'),
    import('lucide-svelte/icons/download')
  ]);
  Wallet = icons[0].default;
  ArrowDownCircle = icons[1].default;
  ArrowUpCircle = icons[2].default;
  FilterIcon = icons[3].default;
  DownloadIcon = icons[4].default;
});

// Touch handling variables
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isSwiping = false;
let isTouchDevice = false;
let clickBlocked = false;

const navs = [
  { label: 'Beranda', path: '/' },
  { label: 'Kasir', path: '/pos' },
  { label: 'Catat', path: '/catat' },
  { label: 'Laporan', path: '/laporan' },
];

let showFilter = false;
let showDatePicker = false;
let showEndDatePicker = false;
let showDownloadModal = false;
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
const DUMMY_PIN = '1234';
let userRole = '';
let errorTimeout: number;
let isClosing = false;

// Inisialisasi summary dan list dengan default kosong
let summary = { pendapatan: null, pengeluaran: null, saldo: null };
let pemasukanUsaha = [];
let pemasukanLain = [];
let bebanUsaha = [];
let bebanLain = [];

// Fungsi untuk tanggal lokal sesuai waktu sistem
function getLocalDateString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

let today = getLocalDateString();
let filterTanggal = today;

onMount(() => {
  // Detect touch device
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  const user = auth.getCurrentUser();
  userRole = user?.role || '';
  if (userRole === 'kasir') {
    showPinModal = true;
  }
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  filterDate = now.toISOString().slice(0, 10);
  filterMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  filterYear = now.getFullYear().toString();
});

// Auto-calculate end date when start date or filter type changes
$: if (startDate && filterType) {
  endDate = calculateEndDate(startDate, filterType);
}

function handleTouchStart(e) {
  if (!isTouchDevice) return;
  
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isSwiping = false;
  clickBlocked = false;
}

function handleTouchMove(e) {
  if (!isTouchDevice) return;
  
  touchEndX = e.touches[0].clientX;
  touchEndY = e.touches[0].clientY;
  
  const deltaX = Math.abs(touchEndX - touchStartX);
  const deltaY = Math.abs(touchEndY - touchStartY);
  const viewportWidth = window.innerWidth;
  const swipeThreshold = viewportWidth * 0.4; // 40% of viewport width
  
  // Check if this is a horizontal swipe
  if (deltaX > swipeThreshold && deltaX > deltaY) {
    isSwiping = true;
    clickBlocked = true;
  }
}

function handleTouchEnd(e) {
  if (!isTouchDevice) return;
  
  if (isSwiping) {
    // Handle swipe navigation
    const deltaX = touchEndX - touchStartX;
    const viewportWidth = window.innerWidth;
    const swipeThreshold = viewportWidth * 0.4;
    
    if (Math.abs(deltaX) > swipeThreshold) {
      const currentIndex = 3; // Laporan is index 3
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        goto(navs[currentIndex - 1].path);
      } else if (deltaX < 0 && currentIndex < navs.length - 1) {
        // Swipe left - go to next tab
        goto(navs[currentIndex + 1].path);
      }
    }
    
    // Block any subsequent click events
    setTimeout(() => {
      clickBlocked = false;
    }, 100);
  }
}

function handleGlobalClick(e) {
  // Don't block clicks on interactive elements even if swipe was detected
  const target = e.target;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || 
      target.closest('button') || target.closest('input') || target.closest('a')) {
    return;
  }
  
  if (clickBlocked) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
}

function handlePinSubmit() {
  if (pinInput === DUMMY_PIN) {
    isClosing = true;
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    // Delay untuk animasi swipe up
    setTimeout(() => {
      showPinModal = false;
      pinError = '';
      pinInput = '';
      isClosing = false;
    }, 300);
  } else {
    pinError = 'PIN salah. Silakan coba lagi.';
    pinInput = '';
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    errorTimeout = setTimeout(() => {
      pinError = '';
    }, 2000);
  }
}

function applyFilter() {
  showFilter = false;
  // TODO: fetch data sesuai filter
  console.log('Filter applied:', { filterType, filterDate, filterMonth, filterYear, startDate, endDate });
}

function openDatePicker() {
  showDatePicker = true;
}

function openEndDatePicker() {
  showEndDatePicker = true;
}

function calculateEndDate(startDateStr: string, type: string) {
  if (!startDateStr) return '';
  
  const startDate = new Date(startDateStr);
  const endDate = new Date(startDate);
  
  switch (type) {
    case 'harian':
      // Untuk harian, endDate sama dengan startDate
      return startDateStr;
    case 'mingguan':
      // Tambah 6 hari (total 7 hari)
      endDate.setDate(startDate.getDate() + 6);
      break;
    case 'bulanan':
      // Tambah 1 bulan kurang 1 hari
      endDate.setMonth(startDate.getMonth() + 1);
      endDate.setDate(startDate.getDate() - 1);
      break;
    case 'tahunan':
      // Tambah 1 tahun kurang 1 hari
      endDate.setFullYear(startDate.getFullYear() + 1);
      endDate.setDate(startDate.getDate() - 1);
      break;
  }
  
  return endDate.toISOString().slice(0, 10);
}

function formatDate(dateString: string, isEndDate: boolean = false) {
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
</script>

{#if showPinModal}
  <div 
    class="fixed inset-0 z-40 flex items-center justify-center transition-transform duration-300 ease-out"
    class:translate-y-full={isClosing}
    style="top: 58px; bottom: 58px; background: linear-gradient(to bottom right, #f472b6, #ec4899, #a855f7);"
  >
    {#if pinError}
      <div 
        class="fixed top-20 left-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out"
        style="transform: translateX(-50%);"
        in:slide={{ duration: 300, easing: cubicOut }}
        out:slide={{ duration: 300, easing: cubicIn }}
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
              onclick={() => {
                if (pinInput.length < 4) {
                  pinInput += num.toString();
                  if (pinInput.length === 4) {
                    handlePinSubmit();
                  }
                }
              }}
            >
              {num}
            </button>
          {/each}
          <div class="w-16 h-16"></div>
          <button
            type="button"
            class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 text-white text-2xl font-bold hover:bg-white/30 active:bg-white/40 active:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-200 shadow-lg"
            onclick={() => {
              if (pinInput.length < 4) {
                pinInput += '0';
                if (pinInput.length === 4) {
                  handlePinSubmit();
                }
              }
            }}
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
  class="flex flex-col h-100vh bg-white w-full max-w-full overflow-x-hidden"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  onclick={handleGlobalClick}
>
  <Topbar>
    <span slot="download">
      <button class="w-[38px] h-[38px] rounded-lg bg-white border-[1.5px] border-gray-200 flex items-center justify-center text-xl text-pink-500 shadow-lg shadow-pink-500/7 cursor-pointer transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12 mr-2" aria-label="Download" onclick={() => showDownloadModal = true}>
        {#if DownloadIcon}
          <svelte:component this={DownloadIcon} size={22} />
        {:else}
          <div class="w-[22px] h-[22px] flex items-center justify-center">
            <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
          </div>
        {/if}
      </button>
    </span>
  </Topbar>

  {#if showDownloadModal}
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div class="w-full max-w-xs mx-auto bg-white rounded-2xl shadow-lg p-6 mb-8 animate-[slideUp_0.2s] flex flex-col gap-3">
        <div class="flex items-center justify-between mb-2">
          <div class="font-bold text-lg text-gray-800">Download Laporan</div>
          <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" onclick={() => showDownloadModal = false}>
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <button class="w-full py-3 rounded-xl bg-pink-500 text-white font-semibold text-base shadow hover:bg-pink-600 transition-colors" onclick={() => { showDownloadModal = false; alert('Download PDF!'); }}>Download PDF</button>
        <button class="w-full py-3 rounded-xl bg-pink-100 text-pink-500 font-semibold text-base shadow hover:bg-pink-200 transition-colors" onclick={() => { showDownloadModal = false; alert('Download XLSX!'); }}>Download XLSX</button>
        <button class="w-full py-3 rounded-xl bg-pink-50 text-pink-500 font-semibold text-base shadow hover:bg-pink-100 transition-colors" onclick={() => { showDownloadModal = false; alert('Download CSV!'); }}>Download CSV</button>
      </div>
    </div>
  {/if}

  <main class="flex-1 overflow-y-auto w-full max-w-full overflow-x-hidden page-content"
    style="scrollbar-width:none;-ms-overflow-style:none;"
  >
    <!-- Konten utama halaman Laporan di sini -->
    <div class="max-w-md mx-auto w-full pt-2 pb-8 px-2">
      <div class="flex w-full items-center gap-2 px-2 mb-3">
        <!-- Button Filter -->
        <div class="flex-none">
          <button class="w-12 h-12 p-0 rounded-xl bg-pink-500 text-white font-bold shadow-sm hover:bg-pink-600 active:bg-pink-700 transition-colors flex items-center justify-center" onclick={() => showFilter = true} aria-label="Filter">
            {#if FilterIcon}
              <svelte:component this={FilterIcon} class="w-5 h-5" />
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
            <div class="text-xl font-bold text-green-900">Rp {summary.pendapatan !== null ? summary.pendapatan.toLocaleString('id-ID') : '--'}</div>
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
            <div class="text-xl font-bold text-red-900">Rp {summary.pengeluaran !== null ? summary.pengeluaran.toLocaleString('id-ID') : '--'}</div>
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
            <div class="text-xl font-bold text-cyan-900">Rp {summary.saldo !== null ? summary.saldo.toLocaleString('id-ID') : '--'}</div>
          </div>
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
            <div class="bg-white flex flex-col gap-0.5 py-2" transition:slide|local>
              <!-- Sub: Pendapatan Usaha -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5" onclick={() => showPendapatanUsaha = !showPendapatanUsaha}>
                <span>Pendapatan Usaha</span>
                <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPendapatanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPendapatanUsaha}
                <ul class="px-4 pb-1 pt-0.5 flex flex-col gap-0.5" transition:slide|local>
                  {#each pemasukanUsaha as item}
                    <li class="flex justify-between text-sm text-gray-600">
                      <span>{item.label}</span>
                      <span>Rp {item.nominal !== null ? item.nominal.toLocaleString('id-ID') : '--'}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              <!-- Sub: Pemasukan Lainnya -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 mt-2" onclick={() => showPemasukanLain = !showPemasukanLain}>
                <span>Pemasukan Lainnya</span>
                <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPemasukanLain}
                <ul class="px-4 pb-1 pt-0.5 flex flex-col gap-0.5" transition:slide|local>
                  {#each pemasukanLain as item}
                    <li class="flex justify-between text-sm text-gray-600">
                      <span>{item.label}</span>
                      <span>Rp {item.nominal !== null ? item.nominal.toLocaleString('id-ID') : '--'}</span>
                    </li>
                  {/each}
                </ul>
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
            <div class="bg-white flex flex-col gap-0.5 py-2" transition:slide|local>
              <!-- Sub: Beban Usaha -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5" onclick={() => showBebanUsaha = !showBebanUsaha}>
                <span>Beban Usaha</span>
                <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanUsaha}
                <ul class="px-4 pb-1 pt-0.5 flex flex-col gap-0.5" transition:slide|local>
                  {#each bebanUsaha as item}
                    <li class="flex justify-between text-sm text-gray-600">
                      <span>{item.label}</span>
                      <span>Rp {item.nominal !== null ? item.nominal.toLocaleString('id-ID') : '--'}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              <!-- Sub: Beban Lainnya -->
              <button class="w-full flex justify-between items-center px-4 py-1 text-sm font-semibold text-gray-700 mb-0.5 mt-2" onclick={() => showBebanLain = !showBebanLain}>
                <span>Beban Lainnya</span>
                <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanLain}
                <ul class="px-4 pb-1 pt-0.5 flex flex-col gap-0.5" transition:slide|local>
                  {#each bebanLain as item}
                    <li class="flex justify-between text-sm text-gray-600">
                      <span>{item.label}</span>
                      <span>Rp {item.nominal !== null ? item.nominal.toLocaleString('id-ID') : '--'}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>
        <!-- Laba (Rugi) Kotor -->
        <div class="border border-pink-100 rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-bold text-gray-700 text-base shadow-sm">
          <span>Laba (Rugi) Kotor</span>
          <span>Rp 0</span>
        </div>
        <!-- Pajak Pendapatan UMKM -->
        <div class="border border-pink-100 rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-bold text-gray-700 text-base shadow-sm">
          <span>Pajak Pendapatan UMKM (0,5%)</span>
          <span>Rp 0</span>
        </div>
        <!-- Laba (Rugi) Bersih -->
        <div class="border border-pink-100 rounded-xl px-4 py-3 bg-white flex justify-between items-center font-bold text-pink-600 text-base shadow-sm">
          <span>Laba (Rugi) Bersih</span>
          <span>Rp 0</span>
        </div>
      </div>

      <!-- Modal Filter -->
      {#if showFilter}
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div class="w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg p-6 pb-8" style="animation: slideUp 0.3s ease-out;">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-bold text-gray-800">Filter Laporan</h3>
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" onclick={() => showFilter = false}>
                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <!-- Pilihan Tipe Filter -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-3">Pilih Periode</label>
              <div class="grid grid-cols-2 gap-3">
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'harian' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  onclick={() => filterType = 'harian'}
                >
                  Harian
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'mingguan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  onclick={() => filterType = 'mingguan'}
                >
                  Mingguan
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'bulanan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  onclick={() => filterType = 'bulanan'}
                >
                  Bulanan
                </button>
                <button 
                  class="py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 {filterType === 'tahunan' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-600 hover:border-pink-200'}" 
                  onclick={() => filterType = 'tahunan'}
                >
                  Tahunan
                </button>
              </div>
            </div>

            <!-- Input Filter Berdasarkan Tipe -->
            {#if filterType === 'harian'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Tanggal</label>
                <input 
                  type="date" 
                  class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" 
                  bind:value={startDate}
                  onchange={() => endDate = calculateEndDate(startDate, filterType)}
                />
              </div>
            {:else if filterType === 'mingguan'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Tanggal Awal Minggu</label>
                <input 
                  type="date" 
                  class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" 
                  bind:value={startDate}
                  onchange={() => endDate = calculateEndDate(startDate, filterType)}
                />
              </div>
            {:else if filterType === 'bulanan'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Bulan dan Tahun</label>
                <div class="flex gap-3">
                  <select class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" bind:value={filterMonth}>
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
                <div class="mt-3">
                  <button 
                    class="w-full py-3 px-4 bg-pink-100 text-pink-600 font-semibold rounded-xl hover:bg-pink-200 transition-colors" 
                    onclick={() => {
                      startDate = `${filterYear}-${filterMonth}-01`;
                      endDate = calculateEndDate(startDate, filterType);
                    }}
                  >
                    Set Tanggal Awal Bulan
                  </button>
                </div>
              </div>
            {:else if filterType === 'tahunan'}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Tahun</label>
                <select class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" bind:value={filterYear}>
                  {#each Array(6) as _, i}
                    <option value={(2020+i).toString()}>{2020+i}</option>
                  {/each}
                </select>
                <div class="mt-3">
                  <button 
                    class="w-full py-3 px-4 bg-pink-100 text-pink-600 font-semibold rounded-xl hover:bg-pink-200 transition-colors" 
                    onclick={() => {
                      startDate = `${filterYear}-01-01`;
                      endDate = calculateEndDate(startDate, filterType);
                    }}
                  >
                    Set Tanggal Awal Tahun
                  </button>
                </div>
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
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" onclick={() => showDatePicker = false}>
                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal Awal</label>
              <input 
                type="date" 
                class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-pink-500 focus:outline-none transition-colors" 
                bind:value={startDate}
                  onchange={() => endDate = calculateEndDate(startDate, filterType)}
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
              <button class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" onclick={() => showEndDatePicker = false}>
                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Tanggal Akhir</label>
              <input 
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