<script lang="ts">
import { onMount } from 'svelte';
import { Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-svelte';
let showFilter = false;
let filterType: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' = 'harian';
let filterDate = '';
let filterMonth = '';
let filterYear = '';
let showDownload = false;
let showPemasukan = true;
let showPendapatanUsaha = true;
let showPemasukanLain = true;
let showPengeluaran = true;
let showBebanUsaha = true;
let showBebanLain = true;

// Dummy data
let summary = {
  pendapatan: 1200000,
  pengeluaran: 450000,
  saldo: 750000
};

// Contoh data dummy
const pemasukanUsaha = [
  { label: 'Penjualan Jus Semangka', nominal: 10000 },
  { label: 'Penjualan Jus Alpukat', nominal: 12000 },
];
const pemasukanLain = [
  { label: 'Dana Hibah', nominal: 50000 },
  { label: 'Cashback', nominal: 5000 },
];
const bebanUsaha = [
  { label: 'Beli Es Batu', nominal: 3000 },
  { label: 'Beli Cup', nominal: 2000 },
];
const bebanLain = [
  { label: 'Sumbangan', nominal: 1000 },
];

onMount(() => {
  const now = new Date();
  filterDate = now.toISOString().slice(0, 10);
  filterMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  filterYear = now.getFullYear().toString();
});

function applyFilter() {
  showFilter = false;
  // TODO: fetch data sesuai filter
}
function download(type: string) {
  showDownload = false;
  alert('Download laporan dalam format ' + type.toUpperCase() + ' (dummy)');
}
</script>

<style>
.page-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #fff;
}
main {
  flex: 1 1 auto;
}
.animate-slideUpModal {
  animation: slideUp 0.22s cubic-bezier(.4,1.4,.6,1) 1;
}
@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>

<div class="page-root">
  <main>
    <!-- Konten utama halaman Laporan di sini -->
    <div class="max-w-md mx-auto w-full pt-2 pb-8">
      <div class="flex flex-wrap justify-center gap-2 mb-1">
        <button class="bg-pink-100 text-pink-500 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 shadow-sm active:bg-pink-200" on:click={() => showFilter = true}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" stroke="#ff5fa2" stroke-width="2" stroke-linecap="round"/></svg>
          Filter
        </button>
        <div class="relative">
          <button class="bg-pink-100 text-pink-500 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 shadow-sm active:bg-pink-200" on:click={() => showDownload = !showDownload}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" stroke="#ff5fa2" stroke-width="2" stroke-linecap="round"/></svg>
            Download
          </button>
          {#if showDownload}
            <div class="absolute right-0 mt-2 bg-white border border-pink-100 rounded-lg shadow z-20 min-w-[120px]">
              <button class="block w-full text-left px-4 py-2 hover:bg-pink-50" on:click={() => download('pdf')}>PDF</button>
              <button class="block w-full text-left px-4 py-2 hover:bg-pink-50" on:click={() => download('csv')}>CSV</button>
              <button class="block w-full text-left px-4 py-2 hover:bg-pink-50" on:click={() => download('excel')}>Excel</button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Ringkasan Keuangan ala Beranda -->
      <div class="px-3 py-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-green-50 rounded-xl shadow-md p-4 flex flex-col items-start">
            <ArrowDownCircle class="w-6 h-6 mb-2 text-green-500" />
            <div class="text-xs font-medium text-gray-500 mb-1">Pendapatan</div>
            <div class="text-xl font-bold text-green-600">Rp {summary.pendapatan.toLocaleString('id-ID')}</div>
          </div>
          <div class="bg-red-50 rounded-xl shadow-md p-4 flex flex-col items-start">
            <ArrowUpCircle class="w-6 h-6 mb-2 text-red-500" />
            <div class="text-xs font-medium text-gray-500 mb-1">Pengeluaran</div>
            <div class="text-xl font-bold text-red-600">Rp {summary.pengeluaran.toLocaleString('id-ID')}</div>
          </div>
          <div class="col-span-2 bg-pink-50 rounded-xl shadow-md p-4 flex flex-col items-start">
            <Wallet class="w-6 h-6 mb-2 text-pink-500" />
            <div class="text-xs font-medium text-gray-500 mb-1">Uang Saat Ini</div>
            <div class="text-xl font-bold text-pink-600">Rp {summary.saldo.toLocaleString('id-ID')}</div>
          </div>
        </div>
      </div>

      <!-- Section Laporan Detail -->
      <div class="px-3 mt-4">
        <!-- Accordion: Pemasukan -->
        <div class="border rounded-xl mb-1 overflow-hidden">
          <button class="w-full flex justify-between items-center px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700 mb-1" on:click={() => showPemasukan = !showPemasukan}>
            <span>Pemasukan</span>
            <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukan ? 0 : 180}deg);transform-origin:center"/></svg>
          </button>
          {#if showPemasukan}
            <div class="bg-white border-t">
              <!-- Sub: Pendapatan Usaha -->
              <button class="w-full flex justify-between items-center px-2 py-1 text-sm font-semibold text-gray-700 mb-1" on:click={() => showPendapatanUsaha = !showPendapatanUsaha}>
                <span>Pendapatan Usaha</span>
                <svg class="w-3 h-3 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPendapatanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPendapatanUsaha}
                <ul class="px-2 pb-1 pt-0.5">
                  {#each pemasukanUsaha as item}
                    <li class="flex justify-between text-xs text-gray-600 mb-0.5">
                      <span>{item.label}</span>
                      <span>Rp {item.nominal.toLocaleString('id-ID')}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              <!-- Sub: Pemasukan Lainnya -->
              <button class="w-full flex justify-between items-center px-2 py-1 text-sm font-semibold text-gray-700 mb-1" on:click={() => showPemasukanLain = !showPemasukanLain}>
                <span>Pemasukan Lainnya</span>
                <svg class="w-3 h-3 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPemasukanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showPemasukanLain}
                <ul class="px-2 pb-1 pt-0.5">
                  {#each pemasukanLain as item}
                    <li class="flex justify-between text-xs text-gray-600 mb-0.5">
                      <span>{item.label}</span>
                      <span>Rp {item.nominal.toLocaleString('id-ID')}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>
        <!-- Accordion: Pengeluaran -->
        <div class="border rounded-xl mb-1 overflow-hidden">
          <button class="w-full flex justify-between items-center px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700 mb-1" on:click={() => showPengeluaran = !showPengeluaran}>
            <span>Pengeluaran</span>
            <svg class="w-4 h-4 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showPengeluaran ? 0 : 180}deg);transform-origin:center"/></svg>
          </button>
          {#if showPengeluaran}
            <div class="bg-white border-t">
              <!-- Sub: Beban Usaha -->
              <button class="w-full flex justify-between items-center px-2 py-1 text-sm font-semibold text-gray-700 mb-1" on:click={() => showBebanUsaha = !showBebanUsaha}>
                <span>Beban Usaha</span>
                <svg class="w-3 h-3 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanUsaha ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanUsaha}
                <ul class="px-2 pb-1 pt-0.5">
                  {#each bebanUsaha as item}
                    <li class="flex justify-between text-xs text-gray-600 mb-0.5">
                      <span>{item.label}</span>
                      <span>Rp {item.nominal.toLocaleString('id-ID')}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
              <!-- Sub: Beban Lainnya -->
              <button class="w-full flex justify-between items-center px-2 py-1 text-sm font-semibold text-gray-700 mb-1" on:click={() => showBebanLain = !showBebanLain}>
                <span>Beban Lainnya</span>
                <svg class="w-3 h-3 ml-2" viewBox="0 0 20 20"><polygon points="5,8 10,13 15,8" fill="currentColor" style="transform:rotate({showBebanLain ? 0 : 180}deg);transform-origin:center"/></svg>
              </button>
              {#if showBebanLain}
                <ul class="px-2 pb-1 pt-0.5">
                  {#each bebanLain as item}
                    <li class="flex justify-between text-xs text-gray-600 mb-0.5">
                      <span>{item.label}</span>
                      <span>Rp {item.nominal.toLocaleString('id-ID')}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>
        <!-- Laba (Rugi) Kotor -->
        <div class="border rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-semibold text-gray-700 text-base">
          <span>Laba (Rugi) Kotor</span>
          <span>Rp 0</span>
        </div>
        <!-- Pajak Pendapatan UMKM -->
        <div class="border rounded-xl mb-1 px-4 py-3 bg-white flex justify-between items-center font-semibold text-gray-700 text-base">
          <span>Pajak Pendapatan UMKM (0,5%)</span>
          <span>Rp 0</span>
        </div>
        <!-- Laba (Rugi) Bersih -->
        <div class="border rounded-xl px-4 py-3 bg-white flex justify-between items-center font-bold text-pink-600 text-base">
          <span>Laba (Rugi) Bersih</span>
          <span>Rp 0</span>
        </div>
      </div>

      <!-- Modal Filter -->
      {#if showFilter}
        <div class="fixed inset-0 z-40 flex items-end justify-center bg-black/30">
          <div class="w-full max-w-md mx-auto bg-white rounded-t-2xl shadow-lg animate-slideUpModal p-6 pb-4">
            <div class="font-bold text-pink-500 text-lg mb-3">Filter Laporan</div>
            <div class="flex gap-2 mb-4">
              <button class="flex-1 py-2 rounded-lg font-semibold text-base shadow-sm border border-pink-200 bg-pink-50 text-pink-500 {filterType === 'harian' ? 'ring-2 ring-pink-400' : ''}" on:click={() => filterType = 'harian'}>Harian</button>
              <button class="flex-1 py-2 rounded-lg font-semibold text-base shadow-sm border border-pink-200 bg-pink-50 text-pink-500 {filterType === 'mingguan' ? 'ring-2 ring-pink-400' : ''}" on:click={() => filterType = 'mingguan'}>Mingguan</button>
              <button class="flex-1 py-2 rounded-lg font-semibold text-base shadow-sm border border-pink-200 bg-pink-50 text-pink-500 {filterType === 'bulanan' ? 'ring-2 ring-pink-400' : ''}" on:click={() => filterType = 'bulanan'}>Bulanan</button>
              <button class="flex-1 py-2 rounded-lg font-semibold text-base shadow-sm border border-pink-200 bg-pink-50 text-pink-500 {filterType === 'tahunan' ? 'ring-2 ring-pink-400' : ''}" on:click={() => filterType = 'tahunan'}>Tahunan</button>
            </div>
            {#if filterType === 'harian'}
              <input type="date" class="catat-input w-full mb-3" bind:value={filterDate} />
            {:else if filterType === 'mingguan'}
              <label class="block text-xs text-pink-500 mb-1">Pilih tanggal dalam minggu</label>
              <input type="date" class="catat-input w-full mb-3" bind:value={filterDate} />
            {:else if filterType === 'bulanan'}
              <div class="flex gap-2 mb-3">
                <select class="catat-input flex-1" bind:value={filterMonth}>
                  {#each Array(12) as _, i}
                    <option value={(i+1).toString().padStart(2, '0')}>{(i+1).toString().padStart(2, '0')}</option>
                  {/each}
                </select>
                <select class="catat-input flex-1" bind:value={filterYear}>
                  {#each Array(6) as _, i}
                    <option value={(2020+i).toString()}>{2020+i}</option>
                  {/each}
                </select>
              </div>
            {:else if filterType === 'tahunan'}
              <select class="catat-input w-full mb-3" bind:value={filterYear}>
                {#each Array(6) as _, i}
                  <option value={(2020+i).toString()}>{2020+i}</option>
                {/each}
              </select>
            {/if}
            <div class="flex gap-2 mt-2">
              <button class="flex-1 py-2 rounded-lg bg-pink-500 text-white font-bold shadow active:bg-pink-600" on:click={applyFilter}>Terapkan</button>
              <button class="flex-1 py-2 rounded-lg bg-gray-100 text-gray-500 font-bold shadow" on:click={() => showFilter = false}>Batal</button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </main>
</div> 