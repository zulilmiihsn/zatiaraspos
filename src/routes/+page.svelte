<script lang="ts">
import { Wallet, ShoppingBag, Coins, Users, Clock, TrendingUp } from 'lucide-svelte';
// Data dummy, nanti diisi dari Supabase
let omzet = 1250000;
let totalItem = 87;
let profit = 420000;
let jumlahTransaksi = 45;
let modalAwal = 500000; // Dummy, ganti dengan data asli jika ada

const bestSellers = [
  {
    name: 'Strawberry Yakult',
    sold: 32,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=facearea&w=96&h=96',
  },
  {
    name: 'Mango Smoothie',
    sold: 27,
    image: '', // kosong, pakai placeholder
  },
  {
    name: 'Avocado Coffee',
    sold: 21,
    image: 'https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=facearea&w=96&h=96',
  },
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

let avgTransaksi = 27;
let jamRamai = '16:00-17:00';
let weeklyIncome = [320000, 410000, 380000, 500000, 450000, 600000, 550000];
let days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
let weeklyMax = Math.max(...weeklyIncome);

let itemTerjual = 123;
</script>

<div class="flex flex-col h-screen min-h-0 bg-white">
  <div class="sticky top-0 z-30 bg-white">
    <!-- Topbar -->
  </div>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <main class="flex flex-col min-h-full bg-white">
      <div class="flex flex-col gap-5 px-3 py-4">
        <!-- Metrik Utama -->
        <div class="flex flex-col gap-3 w-full">
          <div class="grid grid-cols-2 gap-3 md:gap-6">
            <div class="bg-sky-100 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start">
              <ShoppingBag class="w-6 h-6 md:w-8 md:h-8 mb-2 text-sky-500" />
              <div class="text-xs md:text-base font-medium text-gray-500 mb-1">Item Terjual</div>
              <div class="text-xl md:text-3xl font-bold text-sky-600">{itemTerjual}</div>
            </div>
            <div class="bg-purple-100 rounded-xl shadow-md p-4 md:p-6 flex flex-col items-start">
              <TrendingUp class="w-6 h-6 md:w-8 md:h-8 mb-2 text-purple-500" />
              <div class="text-xs md:text-base font-medium text-gray-500 mb-1">Jumlah Transaksi</div>
              <div class="text-xl md:text-3xl font-bold text-purple-600">{jumlahTransaksi}</div>
            </div>
          </div>
          <div class="bg-gradient-to-br from-green-200 to-green-400 rounded-xl shadow-md p-4 flex flex-col items-start">
            <Wallet class="w-6 h-6 mb-2 text-green-900" />
            <div class="text-sm font-medium text-green-900/80">Pendapatan</div>
            <div class="text-xl font-bold text-green-900">Rp {omzet.toLocaleString('id-ID')}</div>
          </div>
          <div class="bg-gradient-to-br from-cyan-100 to-pink-200 rounded-xl shadow-md p-4 flex flex-col items-start">
            <Wallet class="w-6 h-6 mb-2 text-cyan-900" />
            <div class="text-sm font-medium text-cyan-900/80">Modal Awal</div>
            <div class="text-xl font-bold text-cyan-900">Rp {modalAwal.toLocaleString('id-ID')}</div>
          </div>
        </div>
        <!-- Menu Terlaris -->
        <div>
          <div class="text-pink-500 font-semibold mb-2 text-base">Menu Terlaris</div>
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
                  <img class="w-12 h-12 rounded-lg bg-pink-50 object-cover" src={m.image} alt={m.name} on:error={() => imageError[i] = true} />
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
        </div>
        <!-- Statistik -->
        <div class="mt-6">
          <div class="font-bold text-lg mb-2">Statistik</div>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center">
              <div class="text-pink-400 text-xl font-bold">{avgTransaksi}</div>
              <div class="text-xs text-gray-500 mt-1">Rata-rata transaksi/hari</div>
            </div>
            <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center">
              <div class="text-pink-400 text-xl font-bold">{jamRamai}</div>
              <div class="text-xs text-gray-500 mt-1">Jam paling ramai</div>
            </div>
          </div>
          <!-- Grafik Pendapatan 7 Hari -->
          <div class="mt-6">
            <div class="font-semibold text-base mb-2">Pendapatan 7 Hari Terakhir</div>
            <div class="flex items-end gap-2 h-32">
              {#each weeklyIncome as income, i}
                <div class="flex flex-col items-center flex-1">
                  <div class="bg-green-400 rounded-t w-6" style="height: {income/weeklyMax*96}px"></div>
                  <div class="text-xs mt-1">{days[i]}</div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
  <div class="sticky bottom-0 z-30 bg-white">
    <!-- BottomNav -->
  </div>
</div>
