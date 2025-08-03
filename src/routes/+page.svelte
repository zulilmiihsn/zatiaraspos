<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide, fade, fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth/auth';
  import { browser } from '$app/environment';
  import { userRole, userProfile, setUserRole } from '$lib/stores/userRole';
  import { dataService, realtimeManager } from '$lib/services/dataService';
  import ToastNotification from '$lib/components/shared/ToastNotification.svelte';
  import { createToastManager, getLast7DaysLabelsWITA } from '$lib/utils/index';
  import type { UserProfile } from '$lib/stores/userRole';

  // Lazy load icons
  let Wallet: any, ShoppingBag: any, Coins: any, Users: any, Clock: any, TrendingUp: any;

  // Dashboard Metrics
  let omzet: number = 0;
  let modalAwal: number = 0; // Explicitly initialized
  let jumlahTransaksi: number = 0;
  let profit: number = 0;
  let itemTerjual: number = 0;
  let avgTransaksi: number = 0;
  let jamRamai: string = '';
  let weeklyIncome: number[] = [];
  let weeklyMax: number = 1;
  let bestSellers: { name: string; image: string; total_qty: number }[] = [];

  // Store Subscriptions
  let currentUserRole: string = '';
  let userProfileData: UserProfile | null = null;

  userRole.subscribe(val => currentUserRole = val || '');
  userProfile.subscribe(val => userProfileData = val);

  // Loading States
  let isLoadingBestSellers: boolean = true;
  let errorBestSellers: string = '';
  let isLoadingDashboard: boolean = true;

  // Intersection Observer for Income Chart
  let barsVisible: boolean = false;
  let incomeChartRef: HTMLDivElement | null = null;
  onMount(() => {
    if (incomeChartRef) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          barsVisible = true;
          observer.disconnect();
        }
      }, { threshold: 0.3 });
      observer.observe(incomeChartRef);
    }
  });

  // Toast Manager
  const toastManager = createToastManager();

  // Shop Session State
  let showTokoModal: boolean = false;
  let isBukaToko: boolean = true; // true: buka toko, false: tutup toko
  let modalAwalInput: string = '';
  let pinErrorToko: string = '';
  let tokoAktifLocal: boolean = false;
  let sesiAktif: any = null; // Consider a more specific type for sesiAktif
  let ringkasanTutup: { modalAwal: number; totalPenjualan: number; pemasukanTunai: number; pengeluaranTunai: number; uangKasir: number } = {
    modalAwal: 0,
    totalPenjualan: 0,
    pemasukanTunai: 0,
    pengeluaranTunai: 0,
    uangKasir: 0
  };

  // Image Error Map
  let imageErrorMap = new Map<number, boolean>();

  // Pending Action for PIN Modal
  let pendingAction: (() => void) | null = null;

  onMount(async () => {
    // Lazy load Lucide icons
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

    // Load initial dashboard data
    await loadDashboardData();
    
    // Setup real-time subscriptions
    setupRealtimeSubscriptions();

    // Check shop session status
    await cekSesiToko();

    // Expose refreshDashboardData globally for external calls (e.g., from +layout.svelte)
    if (browser) {
      (window as any).refreshDashboardData = loadDashboardData;
    }
  });

  onDestroy(() => {
    realtimeManager.unsubscribeAll();
    if (browser) {
      delete (window as any).refreshDashboardData;
    }
  });

  // Load dashboard data with smart caching
  async function loadDashboardData() {
    try {
      isLoadingDashboard = true;
      
      // Load dashboard stats with cache
      const dashboardStats = await dataService.getDashboardStats();
      applyDashboardData(dashboardStats);
      
      // Load best sellers with cache
      isLoadingBestSellers = true;
      bestSellers = await dataService.getBestSellers();
      isLoadingBestSellers = false;
      
      // Load weekly income with cache
      const weeklyData = await dataService.getWeeklyIncome();
      weeklyIncome = weeklyData.weeklyIncome;
      weeklyMax = weeklyData.weeklyMax;
      
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      errorBestSellers = 'Gagal memuat data dashboard';
    } finally {
      isLoadingDashboard = false;
      isLoadingBestSellers = false;
    }
  }

  // Apply fetched dashboard data to local variables
  function applyDashboardData(data: any) {
    if (!data) return;
    omzet = data.omzet ?? 0;
    jumlahTransaksi = data.jumlahTransaksi ?? 0;
    profit = data.profit ?? 0;
    itemTerjual = data.itemTerjual ?? 0;
    avgTransaksi = data.avgTransaksi ?? 0;
    jamRamai = data.jamRamai ?? '';
    // weeklyIncome dan bestSellers di-set langsung di loadDashboardData
  }

  // Setup real-time subscriptions
  function setupRealtimeSubscriptions() {
    // Subscribe to buku_kas changes for real-time dashboard updates
    realtimeManager.subscribe('buku_kas', async (payload) => {
      console.log('Realtime update for buku_kas:', payload);
      await loadDashboardData(); // Reload all dashboard data
    });
    
    // Subscribe to transaksi_kasir changes
    realtimeManager.subscribe('transaksi_kasir', async (payload) => {
      console.log('Realtime update for transaksi_kasir:', payload);
      await loadDashboardData(); // Reload all dashboard data
    });
  }

  // Shop Session Management
  function updateTokoAktif(val: boolean) {
    tokoAktifLocal = val;
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
    modalAwal = sesiAktif?.opening_cash ?? 0; // Initialize modalAwal directly
  }

  function handleOpenTokoModal() {
    if (currentUserRole === 'kasir') {
      pendingAction = () => {
        isBukaToko = !tokoAktifLocal;
        showTokoModal = true;
        modalAwalInput = '';
        pinErrorToko = '';
        if (!isBukaToko) hitungRingkasanTutup();
      };
      // PinModal is handled by +layout.svelte, it will trigger pendingAction on success
    } else {
      isBukaToko = !tokoAktifLocal;
      showTokoModal = true;
      modalAwalInput = '';
      pinErrorToko = '';
      if (!isBukaToko) hitungRingkasanTutup();
    }
  }

  async function handleBukaToko() {
    const modalAwalRaw = Number((modalAwalInput || '').replace(/\D/g, ''));
    if (!modalAwalRaw || isNaN(modalAwalRaw) || modalAwalRaw < 0) {
      pinErrorToko = 'Modal awal wajib diisi dan valid';
      return;
    }
    try {
      const { error } = await dataService.supabaseClient.from('sesi_toko').insert({
        opening_cash: modalAwalRaw,
        opening_time: new Date().toISOString(),
        is_active: true
      });
      if (error) throw error;
      showTokoModal = false;
      await cekSesiToko();
      toastManager.showToastNotification('Toko berhasil dibuka!', 'success');
    } catch (e: any) {
      console.error("Error opening shop:", e);
      pinErrorToko = e.message || 'Gagal membuka toko';
    }
  }

  async function hitungRingkasanTutup() {
    if (!sesiAktif) return;
    interface BukuKasEntry {
      payment_method?: string;
      tipe?: string;
      amount?: number;
      sumber?: string;
      transaction_date?: string;
      id_sesi_toko?: string;
    }
    const { data: kasRaw } = await dataService.supabaseClient
      .from('buku_kas')
      .select('*')
      .eq('id_sesi_toko', sesiAktif.id);
    let kas: BukuKasEntry[] = Array.isArray(kasRaw) ? kasRaw : [];

    const penjualanTunai = kas.filter((t) => t.tipe === 'in' && t.payment_method === 'tunai').reduce((a, b) => a + (b.amount || 0), 0);
    const pengeluaranTunai = kas.filter((t) => t.tipe === 'out' && t.payment_method === 'tunai').reduce((a, b) => a + (b.amount || 0), 0);
    const modalAwal = sesiAktif.opening_cash || 0;
    const totalPenjualan = kas.filter((t) => t.tipe === 'in' && t.sumber === 'pos').reduce((a, b) => a + (b.amount || 0), 0);
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
    try {
      const { error } = await dataService.supabaseClient.from('sesi_toko').update({
        closing_time: new Date().toISOString(),
        is_active: false
      }).eq('id', sesiAktif.id);
      if (error) throw error;
      showTokoModal = false;
      await cekSesiToko();
      toastManager.showToastNotification('Toko berhasil ditutup!', 'success');
    } catch (e: any) {
      console.error("Error closing shop:", e);
      toastManager.showToastNotification(e.message || 'Gagal menutup toko', 'error');
    }
  }

  // Input Formatting Functions
  function formatModalAwalInput(e: Event) {
    const target = e.target as HTMLInputElement;
    let value = target.value.replace(/[^0-9]/g, '');
    if (value.length > 0) {
      value = Number(value).toLocaleString('id-ID');
    }
    modalAwalInput = value;
  }

  // Bar Chart Interaction
  let selectedBarIndex: number | null = null;
  let showBarInsight: boolean = false;
  let barHoldTimeout: number | null = null;

  function handleBarPointerDown(i: number) {
    barHoldTimeout = window.setTimeout(() => {
      selectedBarIndex = i;
      showBarInsight = true;
    }, 120);
  }

  function handleBarPointerUp() {
    if (barHoldTimeout) clearTimeout(barHoldTimeout);
    showBarInsight = false;
    selectedBarIndex = null;
  }

  // Image Error Handling
  function handleImgError(index: number) {
    imageErrorMap.set(index, true);
    imageErrorMap = imageErrorMap; // Trigger Svelte reactivity
  }
</script>

<!-- Toast Notification -->
<ToastNotification
  show={toastManager.showToast}
  message={toastManager.toastMessage}
  type={toastManager.toastType}
  duration={3000} 
  position="top"
/>

<!-- Modal Buka/Tutup Toko -->
{#if showTokoModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" on:click|self={() => showTokoModal = false} on:keydown={(e) => e.key === 'Escape' && (showTokoModal = false)} role="dialog" aria-modal="true" aria-label="Modal buka tutup toko">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] box-border mx-auto modal-slideup p-8 md:p-12 lg:max-w-lg lg:p-10 xl:max-w-xl xl:p-12 2xl:max-w-2xl 2xl:p-16" on:click={(event) => event.stopPropagation()} role="document">
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
              on:input={formatModalAwalInput}
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
        <button class="w-full bg-gradient-to-r from-pink-500 to-pink-400 text-white font-extrabold rounded-xl py-3 mt-2 shadow-xl hover:scale-105 hover:shadow-2xl active:scale-100 transition-all text-lg flex items-center justify-center gap-2" on:click={handleBukaToko}>
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
        <button class="w-full bg-gradient-to-r from-pink-500 to-pink-400 text-white font-extrabold rounded-xl py-3 mt-2 shadow-xl hover:scale-105 hover:shadow-2xl active:scale-100 transition-all text-lg flex items-center justify-center gap-2" on:click={handleTutupToko}>
          <span class="text-2xl">🔒</span>
          <span>Tutup Toko Sekarang</span>
        </button>
      {/if}
    </div>
  </div>
{/if}

<!-- Top Bar Status Toko -->
<div class="relative w-full min-h-[64px] overflow-hidden md:mx-0">
  {#key tokoAktifLocal}
    <div class="absolute left-0 top-0 w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-pink-400 to-pink-500 text-white gap-4 transition-transform duration-500 ease-in-out" style="height:64px" 
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
        <button class="flex items-center gap-2 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-bold rounded-lg px-3 py-2 shadow transition-all text-xs md:text-sm min-w-[92px] h-9 md:min-w-[110px] md:h-10" on:click={handleOpenTokoModal}>
          <span class="text-lg">{tokoAktifLocal ? '🔒' : '🍹'}</span>
          <span>{tokoAktifLocal ? 'Tutup Toko' : 'Buka Toko'}</span>
        </button>
      {/if}
    </div>
  {/key}
</div>

<div 
  class="flex flex-col min-h-screen bg-white w-full max-w-full overflow-x-hidden"
>
  <main class="flex-1 min-h-0 overflow-y-auto w-full max-w-full overflow-x-hidden page-content md:max-w-3xl lg:max-w-5xl md:mx-auto md:rounded-2xl md:shadow-xl md:bg-white">
    <div class="px-4 pt-2 pb-4 md:px-8 md:pt-4 md:pb-8 lg:px-12 lg:pt-6 lg:pb-10">
      <div class="flex flex-col space-y-3 md:space-y-10">
      <!-- Metrik Utama -->
        <div class="grid grid-cols-2 gap-3 md:grid-cols-2 md:grid-rows-2 md:gap-6 md:rounded-2xl md:bg-white md:p-6 md:shadow-lg md:border md:border-gray-100">
          <div class="bg-gradient-to-br from-sky-200 to-sky-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start md:items-center md:justify-center md:gap-2 md:shadow-none md:bg-transparent md:border md:border-sky-200 lg:flex-col lg:items-center lg:justify-center">
            {#if ShoppingBag}
              <svelte:component this={ShoppingBag} class="w-6 h-6 md:w-10 md:h-10 mb-2 text-sky-500 lg:mx-auto lg:mb-2" />
            {:else}
              <div class="w-6 h-6 md:w-10 md:h-10 mb-2 flex items-center justify-center lg:mx-auto lg:mb-2">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-xs md:text-base font-medium text-gray-500 mb-1 md:mb-0 md:text-center">Item Terjual</div>
            <div class="text-xl md:text-3xl font-bold text-sky-600 md:text-center">{itemTerjual ?? '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-purple-200 to-purple-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start md:items-center md:justify-center md:gap-2 md:shadow-none md:bg-transparent md:border md:border-purple-200 lg:flex-col lg:items-center lg:justify-center">
            {#if TrendingUp}
              <svelte:component this={TrendingUp} class="w-6 h-6 md:w-10 md:h-10 mb-2 text-purple-500 lg:mx-auto lg:mb-2" />
            {:else}
              <div class="w-6 h-6 md:w-10 md:h-10 mb-2 flex items-center justify-center lg:mx-auto lg:mb-2">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-xs md:text-base font-medium text-gray-500 mb-1 md:mb-0 md:text-center">Jumlah Transaksi</div>
            <div class="text-xl md:text-3xl font-bold text-purple-600 md:text-center">{jumlahTransaksi ?? '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-green-200 to-green-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start md:items-center md:justify-center md:gap-2 md:shadow-none md:bg-transparent md:border md:border-green-200 hidden md:block lg:flex-col lg:items-center lg:justify-center">
            {#if Wallet}
              <svelte:component this={Wallet} class="w-6 h-6 md:w-10 md:h-10 mb-2 text-green-900 lg:mx-auto lg:mb-2" />
            {:else}
              <div class="w-6 h-6 md:w-10 md:h-10 mb-2 flex items-center justify-center lg:mx-auto lg:mb-2">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm md:text-base font-medium text-green-900/80 md:text-center">Pendapatan</div>
            <div class="text-xl font-bold text-green-900 md:text-center">{omzet !== null ? `Rp ${omzet.toLocaleString('id-ID')}` : '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-cyan-100 to-pink-200 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start md:items-center md:justify-center md:gap-2 md:shadow-none md:bg-transparent md:border md:border-cyan-200 hidden md:block lg:flex-col lg:items-center lg:justify-center">
            {#if Wallet}
              <svelte:component this={Wallet} class="w-6 h-6 md:w-10 md:h-10 mb-2 text-cyan-900 lg:mx-auto lg:mb-2" />
            {:else}
              <div class="w-6 h-6 md:w-10 md:h-10 mb-2 flex items-center justify-center lg:mx-auto lg:mb-2">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-sm md:text-base font-medium text-cyan-900/80 md:text-center">Modal Awal</div>
            <div class="text-xl font-bold text-cyan-900 md:text-center">{modalAwal !== null ? `Rp ${modalAwal.toLocaleString('id-ID')}` : 'Rp 0'}</div>
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
            <div class="text-xl font-bold text-cyan-900">{modalAwal !== null ? `Rp ${modalAwal.toLocaleString('id-ID')}` : 'Rp 0'}</div>
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
                    <span class="absolute -left-3 -top-4 text-2xl md:static md:mr-4 md:text-3xl">🥈</span>
                  {:else if i === 2}
                    <span class="absolute -left-3 -top-4 text-2xl md:static md:mr-4 md:text-3xl">🥉</span>
                  {/if}
                  {#if m.image && !imageErrorMap.get(i)}
                    <img class="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-pink-50 object-cover" src={m.image} alt={m.name} on:error={() => handleImgError(i)} />
                  {:else}
                    <div class="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-pink-50 flex items-center justify-center text-4xl md:text-5xl text-pink-400">🍹</div>
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
                  00.00
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
                    <div class="flex flex-col items-center flex-1 relative">
                      <div
                        class="bg-green-400 rounded-t w-6 md:w-8 lg:w-10 transition-all duration-700 cursor-pointer"
                        style="height: {barsVisible && income > 0 && weeklyMax > 0 ? Math.max(Math.min((income / weeklyMax) * 96, 96), 4) : 0}px"
                        on:pointerdown={() => handleBarPointerDown(i)}
                        on:pointerup={handleBarPointerUp}
                        on:pointerleave={handleBarPointerUp}
                        on:touchstart={() => handleBarPointerDown(i)}
                        on:touchend={handleBarPointerUp}
                        on:touchcancel={handleBarPointerUp}
                      ></div>
                      <div class="text-xs mt-1 md:text-sm">{getLast7DaysLabelsWITA()[i]}</div>
                      {#if showBarInsight && selectedBarIndex === i}
                        <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-pink-200 rounded-xl shadow-lg px-4 py-2 text-center text-sm font-bold text-pink-600 animate-fade-in pointer-events-none">
                          <span class="text-gray-700 font-normal">Rp {income.toLocaleString('id-ID')}</span>
                        </div>
                      {/if}
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
</div>

<style>
  .modal-slideup {
    animation: modalSlideUp 0.28s cubic-bezier(0.4, 1.4, 0.6, 1);
  }
  @keyframes modalSlideUp {
    from {
      transform: translateY(64px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  @keyframes glow {
    0%, 100% {
      box-shadow: 0 0 0 0 #ec489980;
    }
    50% {
      box-shadow: 0 0 16px 4px #ec489980;
    }
  }
  .animate-glow {
    animation: glow 1.5s ease-in-out 1;
  }
</style>