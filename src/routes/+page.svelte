<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { slide, fade, fly } from 'svelte/transition';
import { cubicIn, cubicOut } from 'svelte/easing';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { auth } from '$lib/auth/auth';
import { browser } from '$app/environment';
import { userRole, userProfile, setUserRole } from '$lib/stores/userRole';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { dataService, realtimeManager } from '$lib/services/dataService';

let dashboardData = null;

let barsVisible = false;
let incomeChartRef: HTMLDivElement | null = null;
onMount(() => {
  if (incomeChartRef) {
    const observer = new window.IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        barsVisible = true;
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(incomeChartRef);
  }
});

// Lazy load icons
let Wallet, ShoppingBag, Coins, Users, Clock, TrendingUp;
let omzet = 0;
let jumlahTransaksi = 0;
let profit = 0;
let itemTerjual = 0;
let totalItem = 0;
let avgTransaksi = 0;
let jamRamai = '';
let weeklyIncome = [];
let weeklyMax = 1;
let bestSellers = [];

// Subscribe ke store
let currentUserRole = '';
let userProfileData = null;

userRole.subscribe(val => currentUserRole = val || '');
userProfile.subscribe(val => userProfileData = val);

let isLoadingBestSellers = true;
let errorBestSellers = '';
let isLoadingDashboard = true;

onMount(async () => {
  const icons = await Promise.all([
    import('lucide-svelte/icons/wallet'),
    import('lucide-svelte/icons/shopping-bag'),
    import('lucide-svelte/icons/coins'),
    import('lucide-svelte/icons/users'),
    import('lucide-svelte/icons/clock'),
    import('lucide-svelte/icons/trending-up')
  ]);
  Wallet = icons[0].default;
  ShoppingBag = icons[1].default;
  Coins = icons[2].default;
  Users = icons[3].default;
  Clock = icons[4].default;
  TrendingUp = icons[5].default;

  // Load data dengan smart caching
  await loadDashboardData();
  
  // Setup real-time subscriptions
  setupRealtimeSubscriptions();

  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
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
  
  await fetchPin();
  if (currentUserRole === 'kasir') {
    const { data } = await dataService.supabaseClient.from('pengaturan_keamanan').select('locked_pages').single();
    const lockedPages = data?.locked_pages || ['laporan', 'beranda'];
    if (lockedPages.includes('beranda')) {
      showPinModal = true;
    }
  }
});

// Load dashboard data dengan smart caching
async function loadDashboardData() {
  try {
    isLoadingDashboard = true;
    
    // Load dashboard stats dengan cache
    const dashboardStats = await dataService.getDashboardStats();
    applyDashboardData(dashboardStats);
    
    // Load best sellers dengan cache
    isLoadingBestSellers = true;
    bestSellers = await dataService.getBestSellers();
    isLoadingBestSellers = false;
    
    // Load weekly income dengan cache
    const weeklyData = await dataService.getWeeklyIncome();
    weeklyIncome = weeklyData.weeklyIncome;
    weeklyMax = weeklyData.weeklyMax;
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    errorBestSellers = 'Gagal memuat data dashboard';
  } finally {
    isLoadingDashboard = false;
    isLoadingBestSellers = false;
  }
}

// Setup real-time subscriptions
function setupRealtimeSubscriptions() {
  // Subscribe to buku_kas changes for real-time dashboard updates
  realtimeManager.subscribe('buku_kas', async (payload) => {
    console.log('Real-time update received:', payload);
    
    // Refresh dashboard data in background
    const dashboardStats = await dataService.getDashboardStats();
    applyDashboardData(dashboardStats);
    
    // Refresh best sellers in background
    bestSellers = await dataService.getBestSellers();
    
    // Refresh weekly income in background
    const weeklyData = await dataService.getWeeklyIncome();
    weeklyIncome = weeklyData.weeklyIncome;
    weeklyMax = weeklyData.weeklyMax;
  });
  
  // Subscribe to transaksi_kasir changes
  realtimeManager.subscribe('transaksi_kasir', async (payload) => {
    console.log('Transaction update received:', payload);
    
    // Refresh best sellers in background
    bestSellers = await dataService.getBestSellers();
    
    // Refresh weekly income in background
    const weeklyData = await dataService.getWeeklyIncome();
    weeklyIncome = weeklyData.weeklyIncome;
    weeklyMax = weeklyData.weeklyMax;
  });
}

function applyDashboardData(data) {
  if (!data) return;
  omzet = data.omzet;
  jumlahTransaksi = data.jumlahTransaksi;
  profit = data.profit;
  itemTerjual = data.itemTerjual;
  totalItem = data.totalItem;
  avgTransaksi = data.avgTransaksi;
  jamRamai = data.jamRamai;
  weeklyIncome = data.weeklyIncome || [];
  weeklyMax = data.weeklyMax || 1;
  bestSellers = data.bestSellers || [];
}

// Cleanup real-time subscriptions on destroy
onDestroy(() => {
  realtimeManager.unsubscribeAll();
});

// Manual refresh function (for testing)
async function refreshDashboardData() {
  await loadDashboardData();
}

async function fetchPin() {
  const { data } = await dataService.supabaseClient.from('pengaturan_keamanan').select('pin').single();
  pin = data?.pin || '1234';
}

// Data dummy, nanti diisi dari Supabase
let modalAwal = null;

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

const stats = [
  {
    icon: TrendingUp,
    label: 'Rata-rata Transaksi/Hari',
    value: 'Rp 37.000',
    color: '#ff5fa2',
  },
  {
    icon: Users,
    label: 'Pelanggan Unik Hari Ini',
    value: '19',
    color: '#e94e8f',
  },
  {
    icon: Clock,
    label: 'Jam Paling Ramai',
    value: '15.00–16.00',
    color: '#ffb86c',
  },
];

let imageError = {};

// Hapus deklarasi let days = ...
// Tambahkan fungsi untuk generate label hari dinamis
function getLast7DaysLabels() {
  const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const today = new Date();
  let labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(hari[d.getDay()]);
  }
  return labels;
}

function getLast7DaysLabelsWITA() {
  const hari = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const todayWITA = getTodayWITA();
  let labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayWITA);
    d.setDate(todayWITA.getDate() - i);
    labels.push(hari[d.getDay()]);
  }
  return labels;
}

// PIN Modal State
let showPinModal = false;
let pinInput = '';
let pinError = '';
let pin = '';
let errorTimeout: number;
let isClosing = false;

let showTokoModal = false;
let isBukaToko = true; // true: buka toko, false: tutup toko
let modalAwalInput = '';
let pinInputToko = '';
let pinErrorToko = '';
let tokoAktifLocal = false;
let sesiAktif = null;
let ringkasanTutup = { modalAwal: 0, totalPenjualan: 0, pemasukanTunai: 0, pengeluaranTunai: 0, uangKasir: 0 };

function updateTokoAktif(val) {
  tokoAktifLocal = val;
  if (browser) window.tokoAktif = val;
}

async function cekSesiToko() {
  const { data } = await dataService.supabaseClient
    .from('sesi_toko')
    .select('*')
    .eq('is_active', true)
    .order('opening_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  sesiAktif = data || null;
  updateTokoAktif(!!sesiAktif);
  // Update modalAwal agar box di beranda selalu sinkron
  modalAwal = sesiAktif?.opening_cash ?? null;
}

onMount(() => {
  cekSesiToko();
  if (browser) {
    window.addEventListener('openTokoModal', handleOpenTokoModal);
  }
});
onDestroy(() => {
  if (browser) {
    window.removeEventListener('openTokoModal', handleOpenTokoModal);
  }
});

function handleOpenTokoModal() {
  // Untuk kasir, tampilkan modal PIN dulu sebelum modal Buka Toko
  if (currentUserRole === 'kasir') {
    // Simpan callback untuk buka toko setelah PIN benar
    pendingAction = () => {
      cekSesiToko().then(() => {
        isBukaToko = !tokoAktifLocal;
        showTokoModal = true;
        modalAwalInput = '';
        pinInputToko = '';
        pinErrorToko = '';
        if (!isBukaToko) hitungRingkasanTutup();
      });
    };
    showPinModal = true;
    return;
  }
  // Untuk non-kasir, langsung buka modal
  cekSesiToko().then(() => {
    isBukaToko = !tokoAktifLocal;
    showTokoModal = true;
    modalAwalInput = '';
    pinInputToko = '';
    pinErrorToko = '';
    if (!isBukaToko) hitungRingkasanTutup();
  });
}

// Tambahkan state untuk pending action setelah PIN benar
let pendingAction = null;

async function handleBukaToko() {
  const modalAwalRaw = Number((modalAwalInput || '').replace(/\D/g, ''));
  if (!modalAwalRaw || isNaN(modalAwalRaw) || modalAwalRaw < 0) {
    pinErrorToko = 'Modal awal wajib diisi dan valid';
    return;
  }
  await dataService.supabaseClient.from('sesi_toko').insert({
    opening_cash: modalAwalRaw,
    opening_time: new Date().toISOString(),
    is_active: true
  });
  showTokoModal = false;
  cekSesiToko();
}

async function hitungRingkasanTutup() {
  if (!sesiAktif) return;
  const { data: kasRaw } = await dataService.supabaseClient
    .from('buku_kas')
    .select('*')
    .eq('id_sesi_toko', sesiAktif.id);
  type Kas = { payment_method?: string; tipe?: string; amount?: number; transaction_date?: string; id_sesi_toko?: string };
  let kas: Kas[] = Array.isArray(kasRaw) ? kasRaw : [];

  // Penjualan tunai (semua pemasukan tunai)
  const penjualanTunai = kas.filter((t) => t.tipe === 'in' && t.payment_method === 'tunai').reduce((a, b) => a + (b.amount || 0), 0);
  // Pengeluaran tunai
  const pengeluaranTunai = kas.filter((t) => t.tipe === 'out' && t.payment_method === 'tunai').reduce((a, b) => a + (b.amount || 0), 0);
  const modalAwal = sesiAktif.opening_cash || 0;
  // Total penjualan = semua pemasukan (in) dari sumber pos
  const totalPenjualan = kas.filter((t) => t.tipe === 'in' && t.sumber === 'pos').reduce((a, b) => a + (b.amount || 0), 0);
  // Uang kasir seharusnya
  const uangKasir = modalAwal + penjualanTunai - pengeluaranTunai;
  ringkasanTutup = {
    modalAwal,
    totalPenjualan,
    pemasukanTunai: penjualanTunai,
    pengeluaranTunai,
    uangKasir
  };
}

async function handleTutupToko() {
  if (!sesiAktif) return;
  await dataService.supabaseClient.from('sesi_toko').update({
    closing_time: new Date().toISOString(),
    is_active: false
  }).eq('id', sesiAktif.id);
  showTokoModal = false;
  cekSesiToko();
}

function handleTouchStart(e) {
  if (!isTouchDevice) return;
  
  // Don't handle touch on interactive elements
  const target = e.target;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || 
      target.closest('button') || target.closest('input') || target.closest('a')) {
    return;
  }
  
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isSwiping = false;
  clickBlocked = false;
}

function handleTouchMove(e) {
  if (!isTouchDevice) return;
  
  // Don't handle touch on interactive elements
  const target = e.target;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || 
      target.closest('button') || target.closest('input') || target.closest('a')) {
    return;
  }
  if (browser) {
  touchEndX = e.touches[0].clientX;
  touchEndY = e.touches[0].clientY;
  const deltaX = Math.abs(touchEndX - touchStartX);
  const deltaY = Math.abs(touchEndY - touchStartY);
  const viewportWidth = window.innerWidth;
    const swipeThreshold = viewportWidth * 0.25;
  if (deltaX > swipeThreshold && deltaX > deltaY) {
    isSwiping = true;
    clickBlocked = true;
    }
  }
}

function handleTouchEnd(e) {
  if (!isTouchDevice) return;
  
  // Don't handle touch on interactive elements
  const target = e.target;
  if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A' || 
      target.closest('button') || target.closest('input') || target.closest('a')) {
    return;
  }
  
  if (browser && isSwiping) {
    // Handle swipe navigation
    const deltaX = touchEndX - touchStartX;
    const viewportWidth = window.innerWidth;
    const swipeThreshold = viewportWidth * 0.25; // 25% of viewport width (sama dengan pengaturan/pemilik)
    
    if (Math.abs(deltaX) > swipeThreshold) {
      const currentIndex = 0; // Beranda is index 0
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
  if (clickBlocked) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
}

function handlePinSubmit() {
  if (pinInput === pin) {
    isClosing = true;
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    setTimeout(() => {
      showPinModal = false;
      pinError = '';
      pinInput = '';
      isClosing = false;
      if (pendingAction) {
        pendingAction();
        pendingAction = null;
      }
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

// New function to format modalAwalInput to Rupiah format
function formatModalAwalInput(e) {
  let value = e.target.value.replace(/[^0-9]/g, ''); // Remove non-numeric characters
  if (value.length > 0) {
    value = Number(value).toLocaleString('id-ID'); // Format as Rupiah
  }
  modalAwalInput = value;
}

// New function to get the raw number from formatted input
function getModalAwalInputRaw() {
  return Number(modalAwalInput.replace(/\./g, '')); // Remove dots and convert to number
}

// New function to set the raw number to formatted input
function setModalAwalInputRaw(value) {
  modalAwalInput = value.toLocaleString('id-ID'); // Format as Rupiah
}

// New function to get the formatted value for binding
function getModalAwalInputFormatted() {
  return modalAwalInput;
}

// New function to set the formatted value for binding
function setModalAwalInputFormatted(value) {
  modalAwalInput = value;
}

let hideTopbar = false;
let topbarRef: HTMLDivElement | null = null;
let sentinelRef: HTMLDivElement | null = null;
onMount(() => {
  // Observer untuk sticky topbar
  if (sentinelRef && topbarRef) {
    const observer = new window.IntersectionObserver((entries) => {
      hideTopbar = !entries[0].isIntersecting;
    }, { threshold: 0 });
    observer.observe(sentinelRef);
  }
});

// Fungsi untuk mendapatkan tanggal hari ini WITA (tanpa jam)
function getTodayWITA() {
  const now = new Date();
  now.setHours(now.getHours() + 8, 0, 0, 0); // ke WITA, jam 00:00
  // Kembalikan tanggal WITA (YYYY-MM-DDT00:00:00.000Z)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
}

// Inisialisasi range 7 hari terakhir berdasarkan hari WITA
const todayWITA = getTodayWITA();
const sevenDaysAgoWITA = new Date(todayWITA);
sevenDaysAgoWITA.setDate(todayWITA.getDate() - 6); // 6 hari ke belakang + hari ini = 7 hari
const startDate = sevenDaysAgoWITA.toISOString().slice(0, 10) + 'T00:00:00.000Z';

</script>

{#if showPinModal}
  <div 
    class="fixed inset-0 z-40 flex items-center justify-center transition-transform duration-300 ease-out modal-pin"
    class:translate-y-full={isClosing}
    style="top: 58px; bottom: 58px; background: linear-gradient(to bottom right, #f472b6, #ec4899, #a855f7);"
  >
    {#if pinError}
      <div 
        class="fixed top-40 left-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out"
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
          <h2 class="text-xl font-bold text-white mb-2">Akses Beranda</h2>
          <p class="text-pink-100 text-sm">Masukkan PIN untuk melihat beranda</p>
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
                    setTimeout(() => handlePinSubmit(), 200);
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
                  setTimeout(() => handlePinSubmit(), 200);
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

<!-- Modal Buka/Tutup Toko -->
{#if showTokoModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onclick={() => showTokoModal = false} onkeydown={(e) => e.key === 'Escape' && (showTokoModal = false)} role="dialog" aria-modal="true" aria-label="Modal buka tutup toko" onkeyup={(e) => e.key === 'Enter' && (showTokoModal = false)}>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] box-border mx-auto modal-slideup modal-padding-custom" style="padding-left:3rem;padding-right:3rem;padding-top:3rem;padding-bottom:3rem;" onclick={event => event.stopPropagation()} role="document">
      {#if isBukaToko}
        <div class="flex flex-col items-center mb-4">
          <div class="text-4xl mb-2">🍹</div>
          <h2 class="font-bold text-xl mb-1 text-pink-500">Buka Toko</h2>
          <div class="text-sm text-gray-400 mb-2">Yuk, buka toko dan mulai hari ini.</div>
        </div>
        <div class="mb-4">
          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400 font-semibold select-none">Rp</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" min="0"
              bind:value={modalAwalInput}
              oninput={formatModalAwalInput}
              class="w-full border-2 border-pink-200 bg-pink-50 rounded-xl pl-12 pr-4 py-3 text-lg font-bold text-gray-800 focus:ring-2 focus:ring-pink-300 outline-none transition placeholder-pink-300 shadow-sm"
              placeholder="Modal awal kas hari ini" />
          </div>
        </div>
        {#if pinErrorToko}
          <div 
            class="fixed top-20 left-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out"
            style="transform: translateX(-50%);"
            in:fly={{ y: -32, duration: 300, easing: cubicOut }}
            out:fade={{ duration: 200 }}
          >
            {pinErrorToko}
          </div>
        {/if}
        <button class="w-full bg-gradient-to-r from-pink-500 to-pink-400 text-white font-extrabold rounded-xl py-3 mt-2 shadow-xl hover:scale-105 hover:shadow-2xl active:scale-100 transition-all text-lg flex items-center justify-center gap-2" onclick={handleBukaToko}>
          <span class="text-2xl">🍹</span>
          <span>Buka Toko Sekarang</span>
        </button>
      {:else}
        <div class="flex flex-col items-center mb-4">
          <div class="text-4xl mb-2">🔒</div>
          <h2 class="font-bold text-xl mb-1 text-pink-500">Tutup Toko</h2>
          <div class="text-sm text-gray-400 mb-2 text-center">Terima kasih atas kerja keras hari ini! Cek ringkasan sebelum tutup toko.</div>
        </div>
        <div class="space-y-3 text-gray-700 text-base mb-4">
          <div class="rounded-xl bg-pink-50 border border-pink-100 px-4 py-3 flex justify-between items-center font-semibold">
            <span>Modal Awal</span><span>Rp {ringkasanTutup.modalAwal.toLocaleString('id-ID')}</span>
          </div>
          <div class="rounded-xl bg-pink-50 border border-pink-100 px-4 py-3 flex justify-between items-center font-semibold">
            <span>Total Penjualan</span><span>Rp {ringkasanTutup.totalPenjualan.toLocaleString('id-ID')}</span>
          </div>
          <div class="rounded-xl bg-pink-50 border border-pink-100 px-4 py-3 flex justify-between items-center font-semibold">
            <span>Pemasukan Tunai</span><span>Rp {ringkasanTutup.pemasukanTunai.toLocaleString('id-ID')}</span>
          </div>
          <div class="rounded-xl bg-pink-50 border border-pink-100 px-4 py-3 flex justify-between items-center font-semibold">
            <span>Pengeluaran Tunai</span><span>Rp {ringkasanTutup.pengeluaranTunai.toLocaleString('id-ID')}</span>
          </div>
          <div class="mb-1 flex flex-col items-center">
            <div class="font-bold text-pink-600 mb-1 text-base md:text-lg text-center">Uang Kasir Seharusnya</div>
            <div class="rounded-xl bg-white border-2 border-pink-400 px-2 py-5 flex flex-col items-center justify-center w-full max-w-xs mx-8 md:mx-16 shadow-sm">
              <div class="text-4xl mb-1">💸</div>
              <span class="whitespace-nowrap text-2xl md:text-3xl font-extrabold text-pink-600 animate-glow">Rp {ringkasanTutup.uangKasir.toLocaleString('id-ID')}</span>
              <div class="text-xs text-gray-400 mt-2 text-center">Pastikan uang kasir sesuai sebelum tutup toko</div>
            </div>
          </div>
        </div>
        <button class="w-full bg-gradient-to-r from-pink-500 to-pink-400 text-white font-extrabold rounded-xl py-3 mt-2 shadow-xl hover:scale-105 hover:shadow-2xl active:scale-100 transition-all text-lg flex items-center justify-center gap-2" onclick={handleTutupToko}>
          <span class="text-2xl">🔒</span>
          <span>Tutup Toko Sekarang</span>
        </button>
      {/if}
    </div>
  </div>
{/if}

<!-- Top Bar Status Toko -->
<div class="relative w-full min-h-[64px] overflow-hidden md:mx-0 md:mt-4 mb-2">
  {#key tokoAktifLocal}
    <div bind:this={topbarRef} class="absolute left-0 top-0 w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-pink-400 to-pink-500 text-white gap-4 transition-transform duration-500 ease-in-out" style="height:64px"
      in:fly={{ x: -64, duration: 350 }} out:fly={{ x: 64, duration: 350 }}>
      <div class="flex items-center gap-3">
        <span class="text-3xl md:text-4xl">{tokoAktifLocal ? '🍹' : '🔒'}</span>
        <div class="flex flex-col">
          <span class="font-extrabold text-base md:text-lg tracking-wide">{tokoAktifLocal ? 'Toko Sedang Buka' : 'Toko Sedang Tutup'}</span>
          <span class="text-xs md:text-sm opacity-80">{tokoAktifLocal ? 'Siap melayani pelanggan' : 'Belum menerima transaksi'}</span>
        </div>
      </div>
      {#if currentUserRole === ''}
        <div class="min-w-[92px] h-9 md:min-w-[110px] md:h-10 px-3 py-2 rounded-lg bg-white/30 animate-pulse"></div>
      {:else if currentUserRole === 'kasir' || currentUserRole === 'pemilik'}
        <button class="flex items-center gap-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-bold rounded-lg px-3 py-2 shadow transition-all text-xs md:text-sm min-w-[92px] h-9 md:min-w-[110px] md:h-10" onclick={handleOpenTokoModal}>
          <span class="text-lg">{tokoAktifLocal ? '🔒' : '🍹'}</span>
          <span>{tokoAktifLocal ? 'Tutup Toko' : 'Buka Toko'}</span>
        </button>
      {/if}
    </div>
  {/key}
</div>
<div bind:this={sentinelRef} style="height:1px;width:100%"></div>

<div 
  class="flex flex-col min-h-screen bg-white w-full max-w-full overflow-x-hidden"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  <main class="flex-1 min-h-0 w-full max-w-full overflow-x-hidden page-content md:max-w-3xl lg:max-w-5xl md:mx-auto md:rounded-2xl md:shadow-xl md:bg-white">
    <div class="px-4 pt-2 pb-4 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-10">
      <div class="flex flex-col space-y-3 md:space-y-10">
      <!-- Metrik Utama -->
        <div class="grid grid-cols-2 gap-3 md:grid-cols-2 md:grid-rows-2 md:gap-6 md:rounded-2xl md:bg-white md:p-6 md:shadow-lg md:border md:border-gray-100">
          <div class="bg-gradient-to-br from-sky-200 to-sky-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start md:items-center md:justify-center md:gap-2 md:shadow-none md:bg-transparent md:border md:border-sky-200">
            {#if ShoppingBag}
              <svelte:component this={ShoppingBag} class="w-6 h-6 md:w-10 md:h-10 mb-2 text-sky-500" />
            {:else}
              <div class="w-6 h-6 md:w-10 md:h-10 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-xs md:text-base font-medium text-gray-500 mb-1 md:mb-0 md:text-center">Item Terjual</div>
            <div class="text-xl md:text-3xl font-bold text-sky-600 md:text-center">{itemTerjual ?? '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-purple-200 to-purple-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start md:items-center md:justify-center md:gap-2 md:shadow-none md:bg-transparent md:border md:border-purple-200">
            {#if TrendingUp}
              <svelte:component this={TrendingUp} class="w-6 h-6 md:w-10 md:h-10 mb-2 text-purple-500" />
            {:else}
              <div class="w-6 h-6 md:w-10 md:h-10 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-xs md:text-base font-medium text-gray-500 mb-1 md:mb-0 md:text-center">Jumlah Transaksi</div>
            <div class="text-xl md:text-3xl font-bold text-purple-600 md:text-center">{jumlahTransaksi ?? '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-green-200 to-green-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start md:items-center md:justify-center md:gap-2 md:shadow-none md:bg-transparent md:border md:border-green-200 hidden md:block">
            {#if Wallet}
              <svelte:component this={Wallet} class="w-6 h-6 md:w-10 md:h-10 mb-2 text-green-900" />
            {:else}
              <div class="w-6 h-6 md:w-10 md:h-10 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm md:text-base font-medium text-green-900/80 md:text-center">Pendapatan</div>
            <div class="text-xl md:text-3xl font-bold text-green-900 md:text-center">{omzet !== null ? `Rp ${omzet.toLocaleString('id-ID')}` : '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-cyan-100 to-pink-200 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start md:items-center md:justify-center md:gap-2 md:shadow-none md:bg-transparent md:border md:border-cyan-200 hidden md:block">
            {#if Wallet}
              <svelte:component this={Wallet} class="w-6 h-6 md:w-10 md:h-10 mb-2 text-cyan-900" />
            {:else}
              <div class="w-6 h-6 md:w-10 md:h-10 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm md:text-base font-medium text-cyan-900/80 md:text-center">Modal Awal</div>
            <div class="text-xl md:text-3xl font-bold text-cyan-900 md:text-center">{modalAwal !== null ? `Rp ${modalAwal.toLocaleString('id-ID')}` : '--'}</div>
          </div>
        </div>
        <!-- Box pendapatan & modal awal satu baris penuh di mobile, hilang di md+ -->
        <div class="flex flex-col gap-3 md:hidden">
          <div class="bg-gradient-to-br from-green-200 to-green-400 rounded-xl shadow-md p-4 flex flex-col items-start">
            {#if Wallet}
              <svelte:component this={Wallet} class="w-6 h-6 mb-2 text-green-900" />
            {:else}
              <div class="w-6 h-6 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm font-medium text-green-900/80">Pendapatan</div>
            <div class="text-xl font-bold text-green-900">{omzet !== null ? `Rp ${omzet.toLocaleString('id-ID')}` : '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-cyan-100 to-pink-200 rounded-xl shadow-md p-4 flex flex-col items-start">
            {#if Wallet}
              <svelte:component this={Wallet} class="w-6 h-6 mb-2 text-cyan-900" />
            {:else}
              <div class="w-6 h-6 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm font-medium text-cyan-900/80">Modal Awal</div>
            <div class="text-xl font-bold text-cyan-900">{modalAwal !== null ? `Rp ${modalAwal.toLocaleString('id-ID')}` : '--'}</div>
          </div>
        </div>
        <!-- Menu Terlaris -->
        <div class="mt-6 md:mt-12">
          <div class="text-pink-500 font-medium mb-2 text-base mt-2 md:text-lg md:mb-6 md:mt-0 md:font-bold md:text-2xl md:tracking-tight">Menu Terlaris</div>
          {#if isLoadingBestSellers}
            <div class="flex flex-col gap-3 md:gap-4 md:space-y-0 md:divide-y md:divide-pink-100">
              {#each Array(3) as _, i}
                <div class="flex items-center bg-gray-100 rounded-xl shadow-md p-3 gap-3 relative animate-pulse md:p-6 md:rounded-2xl md:shadow-none md:bg-white md:gap-6 md:min-h-[88px] md:items-center">
                  <div class="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-gray-200"></div>
                  <div class="flex-1 min-w-0">
                    <div class="h-4 bg-gray-200 rounded w-24 mb-2 md:w-32 md:mb-3"></div>
                    <div class="h-3 bg-gray-200 rounded w-16 md:w-24"></div>
                  </div>
                </div>
              {/each}
            </div>
          {:else if errorBestSellers}
            <div class="text-center text-red-400 py-6 text-base md:text-lg">{errorBestSellers}</div>
          {:else if bestSellers.length === 0}
            <div class="text-center text-gray-400 py-6 text-base md:text-lg">Belum ada data menu terlaris</div>
          {:else}
            <div class="flex flex-col gap-3 md:gap-4 md:space-y-0 md:divide-y md:divide-pink-100">
              {#each bestSellers.slice(0,3) as m, i}
                <div class="flex items-center bg-white rounded-xl shadow-md p-3 gap-3 relative md:p-6 md:rounded-2xl md:shadow-none md:bg-white md:gap-6 md:min-h-[88px] md:items-center md:border md:border-pink-200 {i === 0 ? 'border-2 border-yellow-400 md:border-pink-200 md:border-2 md:border-yellow-400' : ''}">
                  {#if i === 0}
                    <span class="absolute -left-3 -top-4 text-2xl md:static md:mr-4 md:text-3xl">👑</span>
                  {:else if i === 1}
                    <span class="absolute -left-3 -top-3 text-2xl md:static md:mr-4 md:text-3xl">🥈</span>
                  {:else if i === 2}
                    <span class="absolute -left-3 -top-3 text-2xl md:static md:mr-4 md:text-3xl">🥉</span>
                  {/if}
                  {#if m.image && !imageError[i]}
                    <img class="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-pink-50 object-cover" src={m.image} alt={m.name} onerror={() => imageError[i] = true} />
                  {:else}
                    <div class="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-pink-50 flex items-center justify-center text-xl md:text-2xl text-pink-400">🍹</div>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-900 truncate text-base md:text-xl lg:text-2xl md:mb-1">{m.name}</div>
                    <div class="text-sm text-pink-400 md:text-lg">{m.total_qty} terjual</div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        <!-- Statistik -->
        <div class="mt-6 md:mt-12">
          <div class="text-pink-500 font-medium mb-2 text-base mt-2 md:text-lg md:mb-6 md:mt-0 md:font-bold md:text-2xl md:tracking-tight">Statistik</div>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 md:mb-6">
            <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center md:p-6 md:rounded-2xl md:shadow-none md:border md:border-pink-100">
              <div class="text-pink-400 text-xl font-bold md:text-2xl lg:text-3xl">{avgTransaksi ?? '--'}</div>
              <div class="text-xs text-gray-500 mt-1 md:text-sm">Rata-rata transaksi/hari</div>
            </div>
            <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center md:p-6 md:rounded-2xl md:shadow-none md:border md:border-pink-100">
              <div class="text-pink-400 text-xl font-bold md:text-2xl lg:text-3xl">
                {#if jamRamai}
                  {jamRamai}
                {:else}
                  --
                {/if}
              </div>
              <div class="text-xs text-gray-500 mt-1 md:text-sm">Jam paling ramai</div>
            </div>
          </div>
          <!-- Grafik Pendapatan 7 Hari -->
          <div class="mt-3 md:mt-0">
            <div class="bg-white rounded-xl shadow p-4 md:p-8 flex flex-col md:rounded-2xl md:shadow-none md:border md:border-pink-100" bind:this={incomeChartRef}>
              <div class="text-xs text-gray-500 mt-1 md:text-sm mb-2">Pendapatan 7 Hari Terakhir</div>
              <div class="flex items-end gap-2 h-32 md:h-56 lg:h-64">
              {#if weeklyIncome.length === 0}
                  <div class="flex items-end gap-2 h-32 md:h-56 lg:h-64 w-full relative">
                    {#each getLast7DaysLabelsWITA() as label, i}
                      <div class="flex flex-col items-center flex-1">
                        <div class="bg-gray-100 rounded-t w-6 md:w-8 lg:w-10" style="height: 8px;"></div>
                        <div class="text-xs mt-1 md:text-sm text-gray-400">{label}</div>
                      </div>
                    {/each}
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span class="text-gray-400 text-base md:text-lg text-center">Belum ada data grafik pendapatan</span>
                    </div>
                  </div>
              {:else}
                  {#each weeklyIncome as income, i}
                    <div class="flex flex-col items-center flex-1">
                      <div class="bg-green-400 rounded-t w-6 md:w-8 lg:w-10 transition-all duration-700" style="height: {barsVisible && income > 0 && weeklyMax > 0 ? Math.max(Math.min((income / weeklyMax) * 96, 96), 4) : 0}px"></div>
                      <div class="text-xs mt-1 md:text-sm">{getLast7DaysLabelsWITA()[i]}</div>
                    </div>
                  {/each}
              {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
  <div class="sticky bottom-0 z-30 bg-white md:hidden">
    <!-- BottomNav hanya muncul di mobile -->
  </div>
</div>

<style>
.modal-slideup {
  animation: modalSlideUp 0.28s cubic-bezier(.4,1.4,.6,1);
}
@keyframes modalSlideUp {
  from { transform: translateY(64px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.modal-padding-custom {
  max-width: 95vw !important;
  box-sizing: border-box !important;
  padding-left: 3rem !important;
  padding-right: 3rem !important;
  padding-top: 3rem !important;
  padding-bottom: 3rem !important;
}
@media (min-width: 768px) {
  .modal-padding-custom {
    padding-left: 4rem !important;
    padding-right: 4rem !important;
    padding-top: 4rem !important;
    padding-bottom: 4rem !important;
  }
}
@media (min-width: 1024px) {
  .modal-padding-custom {
    padding-left: 6rem !important;
    padding-right: 6rem !important;
    padding-top: 6rem !important;
    padding-bottom: 6rem !important;
  }
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 0 #ec489980; }
  50% { box-shadow: 0 0 16px 4px #ec489980; }
}
.animate-glow {
  animation: glow 1.5s ease-in-out 1;
}
</style>