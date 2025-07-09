<script lang="ts">
import { onMount } from 'svelte';
import { slide } from 'svelte/transition';
import { cubicIn, cubicOut } from 'svelte/easing';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { auth } from '$lib/auth.js';
import { supabase } from '$lib/database/supabaseClient';

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
let userRole = '';
let isLoadingBestSellers = true;
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

  await fetchDashboardStats();
  await fetchPin();
  await fetchDashboardStatsPOS();

  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Ambil session Supabase
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    userRole = profile?.role || '';
  }
  if (userRole === 'kasir') {
    const { data } = await supabase.from('security_settings').select('locked_pages').single();
    const lockedPages = data?.locked_pages || ['laporan', 'beranda'];
    if (lockedPages.includes('beranda')) {
      showPinModal = true;
    }
  }
});

async function fetchDashboardStats() {
  isLoadingBestSellers = true;
  // Omzet
  const { data: omzetData } = await supabase.rpc('get_omzet_today');
  omzet = omzetData?.omzet || 0;
  // Total transaksi
  const { count: transaksiCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  jumlahTransaksi = transaksiCount || 0;

  // Statistik 7 hari terakhir
  const now = new Date();
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
  const startDate = sevenDaysAgo.toISOString();

  // Rata-rata transaksi/hari dari cash_transactions (group by waktu detik per hari)
  const { data: transaksiKas } = await supabase
    .from('cash_transactions')
    .select('transaction_date')
    .gte('transaction_date', startDate)
    .eq('type', 'in');

  const transaksiPerHari = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    transaksiPerHari[key] = new Set();
  }
  if (transaksiKas) {
    transaksiKas.forEach(t => {
      const key = t.transaction_date.slice(0, 10);
      if (transaksiPerHari[key] !== undefined) transaksiPerHari[key].add(t.transaction_date);
    });
  }
  avgTransaksi = Math.round(
    Object.values(transaksiPerHari).reduce((a, b) => a + b.size, 0) / 7
  );

  // Jam paling ramai (pakai transaksiKas)
  const jamCount = {};
  if (transaksiKas) {
    transaksiKas.forEach(t => {
      const jam = new Date(t.transaction_date).getHours();
      jamCount[jam] = (jamCount[jam] || 0) + 1;
    });
  }
  const jamRamaiVal = Object.entries(jamCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '--';
  jamRamai = jamRamaiVal !== '--' ? `${jamRamaiVal}.00–${parseInt(jamRamaiVal) + 1}.00` : '--';

  // 2. Pendapatan 7 hari terakhir (grafik)
  const { data: pemasukan } = await supabase
    .from('cash_transactions')
    .select('amount, transaction_date')
    .gte('transaction_date', startDate)
    .eq('type', 'in');
  const pendapatanPerHari = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    pendapatanPerHari[key] = 0;
  }
  if (pemasukan) {
    pemasukan.forEach(t => {
      const key = t.transaction_date.slice(0, 10);
      if (pendapatanPerHari[key] !== undefined) pendapatanPerHari[key] += t.amount || 0;
    });
  }
  weeklyIncome = Object.values(pendapatanPerHari);

  // Setelah weeklyIncome diisi:
  weeklyIncome = weeklyIncome.map(x => (typeof x === 'number' && !isNaN(x) && x > 0 ? x : 0));
  weeklyMax = Math.max(...weeklyIncome, 1);

  // Best sellers: ambil semua transaction_items 7 hari terakhir, group dan sum qty di JS
  const { data: items, error } = await supabase
    .from('transaction_items')
    .select('menu_id, qty, created_at')
    .gte('created_at', startDate);
  if (!error && items) {
    // Group by menu_id, sum qty
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.menu_id]) grouped[item.menu_id] = 0;
      grouped[item.menu_id] += item.qty;
    }
    // Ambil 3 menu_id terlaris
    const topMenuIds = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([menu_id]) => menu_id);
    if (topMenuIds.length === 0) {
      bestSellers = [];
      return;
    }
    // Ambil semua produk
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, name, image');
    // Filter hanya menu_id yang ada di products
    const validMenuIds = topMenuIds.filter(id => allProducts && allProducts.some(p => p.id === id));
    if (validMenuIds.length === 0) {
      bestSellers = [];
      return;
    }
    const best = validMenuIds.map(menu_id => {
      const prod = allProducts.find(p => p.id === menu_id);
      return {
        name: prod?.name || '-',
        image: prod?.image || '',
        total_qty: grouped[menu_id]
      };
    });
    bestSellers = best;
  } else {
    bestSellers = [];
  }
  // ...tambahkan fetch lain sesuai kebutuhan (profit, itemTerjual, weeklyIncome, dsb)...
  isLoadingBestSellers = false;
}

async function fetchDashboardStatsPOS() {
  // Hitung range hari ini (00:00 - 23:59 waktu lokal)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const startUTC = start.toISOString();
  const endUTC = end.toISOString();

  // Ambil semua transaksi kasir hari ini
  const { data: kas, error } = await supabase
    .from('cash_transactions')
    .select('*')
    .gte('transaction_date', startUTC)
    .lte('transaction_date', endUTC)
    .eq('jenis', 'pendapatan_usaha')
    .eq('type', 'in');

  if (!error && kas) {
    // Item terjual: sum semua qty (jika ada), fallback ke jumlah baris
    itemTerjual = kas.reduce((sum, t) => sum + (t.qty || 1), 0);
    // Jumlah transaksi: jumlah transaksi unik per waktu transaksi (atau jumlah baris jika 1 transaksi = 1 insert)
    jumlahTransaksi = kas.length;
    // Pendapatan: sum amount
    omzet = kas.reduce((sum, t) => sum + (t.amount || 0), 0);
  } else {
    itemTerjual = 0;
    jumlahTransaksi = 0;
    omzet = 0;
  }
}

async function fetchPin() {
  const { data } = await supabase.from('security_settings').select('pin').single();
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

let days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

// PIN Modal State
let showPinModal = false;
let pinInput = '';
let pinError = '';
let pin = '';
let errorTimeout: number;
let isClosing = false;

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
  
  touchEndX = e.touches[0].clientX;
  touchEndY = e.touches[0].clientY;
  
  const deltaX = Math.abs(touchEndX - touchStartX);
  const deltaY = Math.abs(touchEndY - touchStartY);
  const viewportWidth = window.innerWidth;
  const swipeThreshold = viewportWidth * 0.25; // 25% of viewport width (sama dengan pengaturan/pemilik)
  
  // Check if this is a horizontal swipe
  if (deltaX > swipeThreshold && deltaX > deltaY) {
    isSwiping = true;
    clickBlocked = true;
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
  
  if (isSwiping) {
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
</script>

{#if showPinModal}
  <div 
    class="fixed inset-0 z-40 flex items-center justify-center transition-transform duration-300 ease-out modal-pin"
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

<div class="flex flex-col h-max min-h-0 bg-white md:min-h-screen md:px-8 lg:px-16 md:pt-8 md:pb-12"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  <main class="flex flex-col h-max bg-white page-content md:max-w-3xl lg:max-w-5xl md:mx-auto md:rounded-2xl md:shadow-xl md:bg-white">
    <div class="px-4 py-4 md:px-8 md:py-8 lg:px-12 lg:py-10">
      <div class="flex flex-col space-y-6 md:space-y-10">
      <!-- Metrik Utama -->
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
          <div class="bg-gradient-to-br from-sky-200 to-sky-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start">
            {#if ShoppingBag}
              <svelte:component this={ShoppingBag} class="w-6 h-6 md:w-8 md:h-8 mb-2 text-sky-500" />
            {:else}
              <div class="w-6 h-6 md:w-8 md:h-8 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-xs md:text-base font-medium text-gray-500 mb-1">Item Terjual</div>
            <div class="text-xl md:text-3xl font-bold text-sky-600">{itemTerjual ?? '--'}</div>
          </div>
          <div class="bg-gradient-to-br from-purple-200 to-purple-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start">
            {#if TrendingUp}
              <svelte:component this={TrendingUp} class="w-6 h-6 md:w-8 md:h-8 mb-2 text-purple-500" />
            {:else}
              <div class="w-6 h-6 md:w-8 md:h-8 mb-2 flex items-center justify-center">
                <span class="block w-4 h-4 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></span>
              </div>
            {/if}
            <div class="text-xs md:text-base font-medium text-gray-500 mb-1">Jumlah Transaksi</div>
            <div class="text-xl md:text-3xl font-bold text-purple-600">{jumlahTransaksi ?? '--'}</div>
          </div>
          <!-- Di md+ dua box berikut tetap grid, di mobile mereka di luar grid -->
          <div class="hidden md:block bg-gradient-to-br from-green-200 to-green-400 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start">
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
          <div class="hidden md:block bg-gradient-to-br from-cyan-100 to-pink-200 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start">
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
        <div>
          <div class="text-pink-500 font-medium mb-2 text-base mt-2 md:text-lg md:mb-4">Menu Terlaris</div>
          {#if isLoadingBestSellers}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each Array(3) as _, i}
                <div class="flex items-center bg-gray-100 rounded-xl shadow-md p-3 gap-3 relative animate-pulse md:p-4 lg:p-5 h-16 md:h-20">
                  <div class="w-12 h-12 rounded-lg bg-gray-200"></div>
                  <div class="flex-1 min-w-0">
                    <div class="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div class="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              {/each}
            </div>
          {:else if bestSellers.length === 0}
            <div class="text-center text-gray-400 py-6 text-base md:text-lg">Belum ada data menu terlaris</div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each bestSellers as m, i}
                <div class="flex items-center bg-white rounded-xl shadow-md p-3 gap-3 relative {i === 0 ? 'border-2 border-yellow-400' : ''} md:p-4 lg:p-5">
                  {#if i === 0}
                    <span class="absolute -left-3 -top-4 text-2xl">👑</span>
                  {:else if i === 1}
                    <span class="absolute -left-3 -top-3 text-2xl">🥈</span>
                  {:else if i === 2}
                    <span class="absolute -left-3 -top-3 text-2xl">🥉</span>
                  {/if}
                  {#if m.image && !imageError[i]}
                    <img class="w-12 h-12 rounded-lg bg-pink-50 object-cover" src={m.image} alt={m.name} onerror={() => imageError[i] = true} />
                  {:else}
                    <div class="w-12 h-12 rounded-lg bg-pink-50 flex items-center justify-center text-xl text-pink-400">🍹</div>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-900 truncate text-base md:text-lg lg:text-xl">{m.name}</div>
                    <div class="text-sm text-pink-400 md:text-base">{m.total_qty} terjual</div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        <!-- Statistik -->
        <div>
          <div class="text-pink-500 font-medium mb-2 text-base mt-2 md:text-lg md:mb-4">Statistik</div>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center md:p-6">
              <div class="text-pink-400 text-xl font-bold md:text-2xl lg:text-3xl">{avgTransaksi ?? '--'}</div>
              <div class="text-xs text-gray-500 mt-1 md:text-sm">Rata-rata transaksi/hari</div>
            </div>
            <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center md:p-6">
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
          <div class="mt-8 md:mt-12">
            <div class="text-xs font-semibold text-gray-500 mb-2 mt-4 md:text-base">Pendapatan 7 Hari Terakhir</div>
            {#if weeklyIncome.length === 0}
              <div class="text-center text-gray-400 py-6 text-base md:text-lg">Belum ada data grafik pendapatan</div>
            {:else}
              <div class="flex items-end gap-2 h-32 md:h-40 lg:h-56">
                {#each weeklyIncome as income, i}
                  <div class="flex flex-col items-center flex-1">
                    <div class="bg-green-400 rounded-t w-6 md:w-8 lg:w-10" style="height: {income > 0 && weeklyMax > 0 ? Math.max(Math.min((income / weeklyMax) * 96, 96), 4) : 0}px"></div>
                    <div class="text-xs mt-1 md:text-sm">{days[i]}</div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </main>
  <div class="sticky bottom-0 z-30 bg-white md:hidden">
    <!-- BottomNav hanya muncul di mobile -->
  </div>
</div>
