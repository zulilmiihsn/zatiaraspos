<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';

// Lazy load icons
let Wallet, ShoppingBag, Coins, Users, Clock, TrendingUp;
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
});

// Data dummy, nanti diisi dari Supabase
let omzet = null;
let totalItem = null;
let profit = null;
let jumlahTransaksi = null;
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

const bestSellers = [];

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

let avgTransaksi = null;
let jamRamai = null;
let weeklyIncome = [];
let days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
let weeklyMax = 1;
let itemTerjual = null;

onMount(() => {
  // Detect touch device
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
});

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
  const swipeThreshold = viewportWidth * 0.4; // 40% of viewport width
  
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
    const swipeThreshold = viewportWidth * 0.4;
    
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
</script>

<div class="flex flex-col h-screen min-h-0 bg-white">
  <main class="flex flex-col h-max bg-white page-content">
    <div class="px-4 py-4">
      <!-- Metrik Utama -->
      <div class="flex flex-col gap-3 w-full mb-6">
        <div class="grid grid-cols-2 gap-3 md:gap-6">
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
        </div>
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
      <div class="mb-4">
        <div class="text-pink-500 font-medium mb-2 text-base mt-2">Menu Terlaris</div>
        {#if bestSellers.length === 0}
          <div class="text-center text-gray-400 py-6 text-base">Belum ada data menu terlaris</div>
        {:else}
          <div class="flex flex-col gap-3">
            {#each bestSellers as m, i}
              <div class="flex items-center bg-white rounded-xl shadow-md p-3 gap-3 relative {i === 0 ? 'border-2 border-yellow-400' : ''}">
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
                  <div class="font-semibold text-gray-900 truncate text-base">{m.name}</div>
                  <div class="text-sm text-pink-400">{m.sold} terjual</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <!-- Statistik -->
      <div class="mt-0 mb-2">
        <div class="text-pink-500 font-medium mb-2 text-base mt-2">Statistik</div>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center">
            <div class="text-pink-400 text-xl font-bold">{avgTransaksi ?? '--'}</div>
            <div class="text-xs text-gray-500 mt-1">Rata-rata transaksi/hari</div>
          </div>
          <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center">
            <div class="text-pink-400 text-xl font-bold">{jamRamai ?? '--'}</div>
            <div class="text-xs text-gray-500 mt-1">Jam paling ramai</div>
          </div>
        </div>
        <!-- Grafik Pendapatan 7 Hari -->
        <div class="mt-8">
          <div class="text-xs font-semibold text-gray-500 mb-2 mt-4">Pendapatan 7 Hari Terakhir</div>
          {#if weeklyIncome.length === 0}
            <div class="text-center text-gray-400 py-6 text-base">Belum ada data grafik pendapatan</div>
          {:else}
            <div class="flex items-end gap-2 h-32">
              {#each weeklyIncome as income, i}
                <div class="flex flex-col items-center flex-1">
                  <div class="bg-green-400 rounded-t w-6" style="height: {income/weeklyMax*96}px"></div>
                  <div class="text-xs mt-1">{days[i]}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </main>
  <div class="sticky bottom-0 z-30 bg-white">
    <!-- BottomNav -->
  </div>
</div>
