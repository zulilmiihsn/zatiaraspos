<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { auth } from '$lib/auth.js';
import Plus from 'lucide-svelte/icons/plus';
import Edit from 'lucide-svelte/icons/edit';
import Trash from 'lucide-svelte/icons/trash';
import ChevronDown from 'lucide-svelte/icons/chevron-down';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';
import Settings from 'lucide-svelte/icons/settings';
import Coffee from 'lucide-svelte/icons/coffee';
import Utensils from 'lucide-svelte/icons/utensils';
import Shield from 'lucide-svelte/icons/shield';
import Lock from 'lucide-svelte/icons/lock';
import Tag from 'lucide-svelte/icons/tag';
import ImagePlaceholder from '$lib/components/shared/ImagePlaceholder.svelte';
import CropperDialog from '$lib/components/shared/CropperDialog.svelte';
import { fly } from 'svelte/transition';

let currentUser = null;
let userRole = '';
let currentPage = 'main'; // 'main', 'menu', 'security'
let activeTab = 'menu'; // 'menu', 'kategori', 'ekstra'

// Data Menu
let menus = [
  { id: 1, name: 'Jus Alpukat', kategori: 'Minuman', tipe: 'minuman', harga: 15000, ekstraIds: [1, 2], gambar: '', gula: true },
  { id: 2, name: 'Nasi Goreng', kategori: 'Makanan', tipe: 'makanan', harga: 20000, ekstraIds: [3], gambar: '', gula: false },
  { id: 3, name: 'Es Teh Manis', kategori: 'Minuman', tipe: 'minuman', harga: 8000, ekstraIds: [], gambar: '', gula: true },
  { id: 4, name: 'Mie Goreng', kategori: 'Makanan', tipe: 'makanan', harga: 18000, ekstraIds: [3, 4], gambar: '', gula: false },
  { id: 5, name: 'Kopi Susu', kategori: 'Kopi', tipe: 'minuman', harga: 12000, ekstraIds: [1], gambar: '', gula: true },
  { id: 6, name: 'Roti Bakar', kategori: 'Roti', tipe: 'makanan', harga: 10000, ekstraIds: [2], gambar: '', gula: false },
  { id: 7, name: 'Jus Mangga', kategori: 'Jus', tipe: 'minuman', harga: 14000, ekstraIds: [], gambar: '', gula: true },
  { id: 8, name: 'Teh Tarik', kategori: 'Teh', tipe: 'minuman', harga: 9000, ekstraIds: [], gambar: '', gula: true },
  { id: 9, name: 'Brownies', kategori: 'Dessert', tipe: 'makanan', harga: 16000, ekstraIds: [], gambar: '', gula: false },
  { id: 10, name: 'Paket Hemat', kategori: 'Paket', tipe: 'makanan', harga: 25000, ekstraIds: [2, 3], gambar: '', gula: false },
  { id: 11, name: 'Keripik Kentang', kategori: 'Cemilan', tipe: 'makanan', harga: 7000, ekstraIds: [], gambar: '', gula: false },
  { id: 12, name: 'Donat', kategori: 'Dessert', tipe: 'makanan', harga: 8000, ekstraIds: [], gambar: '', gula: false },
  { id: 13, name: 'Jus Jeruk', kategori: 'Jus', tipe: 'minuman', harga: 13000, ekstraIds: [], gambar: '', gula: true },
  { id: 14, name: 'Sosis Bakar', kategori: 'Snack', tipe: 'makanan', harga: 9000, ekstraIds: [], gambar: '', gula: false },
  { id: 15, name: 'Teh Hijau', kategori: 'Teh', tipe: 'minuman', harga: 9500, ekstraIds: [], gambar: '', gula: true },
];

// Data Kategori
let kategoriList = [
  { id: 1, name: 'Minuman', menuIds: [1, 3] },
  { id: 2, name: 'Makanan', menuIds: [2, 4] },
  { id: 3, name: 'Snack', menuIds: [] },
  { id: 4, name: 'Kopi', menuIds: [] },
  { id: 5, name: 'Teh', menuIds: [] },
  { id: 6, name: 'Jus', menuIds: [] },
  { id: 7, name: 'Roti', menuIds: [] },
  { id: 8, name: 'Dessert', menuIds: [] },
  { id: 9, name: 'Paket', menuIds: [] },
  { id: 10, name: 'Cemilan', menuIds: [] },
];

// Data Ekstra Template
let ekstraList = [
  { id: 1, name: 'Coklat', harga: 2000 },
  { id: 2, name: 'Keju', harga: 3000 },
  { id: 3, name: 'Telur', harga: 2500 },
  { id: 4, name: 'Susu', harga: 1500 },
];

// Form states
let showMenuForm = false;
let showKategoriForm = false;
let showEkstraForm = false;
let editMenuId = null;
let editKategoriId = null;
let editEkstraId = null;

let menuForm = {
  name: '',
  kategori: '',
  tipe: 'minuman',
  harga: '',
  ekstraIds: [],
  gambar: '',
  gula: true,
};

let kategoriForm = {
  name: '',
  menuIds: [],
};

let ekstraForm = {
  name: '',
  harga: '',
};

let selectedKategori = 'Semua';
let searchKeyword = '';

let showDeleteModal = false;
let menuIdToDelete: number|null = null;

// Untuk upload & crop gambar
let selectedImage: string|null = null;
let croppedImage: string|null = null;
let showCropperDialog = false;
let cropperDialogImage = '';

let touchStartX = 0;
let touchEndX = 0;
let ignoreSwipe = false;

// State untuk modal hapus kategori
let showDeleteKategoriModal = false;
let kategoriIdToDelete: number|null = null;

// State untuk modal edit/detail kategori
let showKategoriDetailModal = false;
let kategoriDetail = null;
let menuIdsInKategori: number[] = [];
let menuIdsNonKategori: number[] = [];

// Tambahkan state untuk input nama kategori
let kategoriDetailName = '';

// State untuk search kategori
let searchKategoriKeyword = '';

// State untuk tab ekstra
let searchEkstra = '';
let showDeleteEkstraModal = false;
let ekstraIdToDelete = null;

function handleTabTouchStart(e: TouchEvent) {
  const target = e.target as HTMLElement;
  if (target.closest('button, [tabindex], input, select, textarea, [role="button"], [data-kategori-box]')) {
    ignoreSwipe = true;
    return;
  }
  ignoreSwipe = false;
  touchStartX = e.touches[0].clientX;
}
function handleTabTouchMove(e: TouchEvent) {
  if (ignoreSwipe) return;
  touchEndX = e.touches[0].clientX;
}
function handleTabTouchEnd() {
  if (ignoreSwipe) return;
  const delta = touchEndX - touchStartX;
  if (Math.abs(delta) > 40) {
    if (delta < 0) {
      // Swipe kiri: next tab
      if (activeTab === 'menu') activeTab = 'kategori';
      else if (activeTab === 'kategori') activeTab = 'ekstra';
    } else {
      // Swipe kanan: prev tab
      if (activeTab === 'ekstra') activeTab = 'kategori';
      else if (activeTab === 'kategori') activeTab = 'menu';
    }
  }
}

onMount(() => {
  currentUser = auth.getCurrentUser();
  userRole = currentUser?.role || '';
  
  if (userRole !== 'admin') {
    alert('Anda tidak memiliki akses ke halaman ini.');
    goto('/pengaturan');
  }
});

// Menu functions
function openMenuForm(menu = null) {
  if (showMenuForm && menu && editMenuId === menu.id) {
    return;
  }
  showMenuForm = true;
  if (menu) {
    editMenuId = menu.id;
    menuForm = { ...menu, harga: menu.harga.toString() };
  } else {
    editMenuId = null;
    menuForm = { name: '', kategori: '', tipe: 'minuman', harga: '', ekstraIds: [], gambar: '', gula: true };
  }
}

function saveMenu() {
  if (editMenuId) {
    menus = menus.map(m => m.id === editId ? { ...menuForm, id: editId, harga: parseInt(menuForm.harga) } : m);
  } else {
    menus = [...menus, { ...menuForm, id: Date.now(), harga: parseInt(menuForm.harga) }];
  }
  showMenuForm = false;
}

function confirmDeleteMenu(id: number) {
  menuIdToDelete = id;
  showDeleteModal = true;
}

function doDeleteMenu() {
  if (menuIdToDelete !== null) {
    menus = menus.filter(m => m.id !== menuIdToDelete);
    showDeleteModal = false;
    menuIdToDelete = null;
  }
}

function cancelDeleteMenu() {
  showDeleteModal = false;
  menuIdToDelete = null;
}

// Kategori functions
function openKategoriForm(kat) {
  kategoriDetail = kat;
  showKategoriDetailModal = true;
  kategoriDetailName = kat.name;
  // Menu yang sudah masuk kategori
  menuIdsInKategori = kat.menuIds ? [...kat.menuIds] : [];
  // Menu non-kategorized: kategori kosong atau tidak terdaftar di kategori manapun
  menuIdsNonKategori = menus
    .filter(m => !m.kategori || !kategoriList.some(k => k.menuIds && k.menuIds.includes(m.id)))
    .map(m => m.id)
    .filter(id => !menuIdsInKategori.includes(id));
}

function closeKategoriDetailModal() {
  showKategoriDetailModal = false;
  kategoriDetail = null;
}

function toggleMenuInKategori(id) {
  if (menuIdsInKategori.includes(id)) {
    menuIdsInKategori = menuIdsInKategori.filter(mid => mid !== id);
    if (!menus.find(m => m.id === id)?.kategori || !kategoriList.some(k => k.menuIds && k.menuIds.includes(id))) {
      menuIdsNonKategori = [id, ...menuIdsNonKategori];
    }
  } else {
    menuIdsNonKategori = menuIdsNonKategori.filter(mid => mid !== id);
    menuIdsInKategori = [id, ...menuIdsInKategori];
  }
}

function saveKategoriDetail() {
  if (kategoriDetail) {
    kategoriList = kategoriList.map(k => k.id === kategoriDetail.id ? { ...k, name: kategoriDetailName, menuIds: [...menuIdsInKategori] } : k);
    showKategoriDetailModal = false;
    kategoriDetail = null;
  }
}

function confirmDeleteKategori(id: number) {
  kategoriIdToDelete = id;
  showDeleteKategoriModal = true;
}

function doDeleteKategori() {
  if (kategoriIdToDelete !== null) {
    kategoriList = kategoriList.filter(k => k.id !== kategoriIdToDelete);
    showDeleteKategoriModal = false;
    kategoriIdToDelete = null;
  }
}

function cancelDeleteKategori() {
  showDeleteKategoriModal = false;
  kategoriIdToDelete = null;
}

// Ekstra functions
function openEkstraForm(ekstra = null) {
  showEkstraForm = true;
  if (ekstra) {
    editEkstraId = ekstra.id;
    ekstraForm = { ...ekstra, harga: ekstra.harga.toString() };
  } else {
    editEkstraId = null;
    ekstraForm = { name: '', harga: '' };
  }
}

function saveEkstra() {
  if (!ekstraForm.name.trim() || !ekstraForm.harga || isNaN(parseInt(ekstraForm.harga)) || parseInt(ekstraForm.harga) <= 0) return;
  if (editEkstraId) {
    ekstraList = ekstraList.map(e => e.id === editEkstraId ? { ...ekstraForm, id: editEkstraId, harga: parseInt(ekstraForm.harga) } : e);
  } else {
    ekstraList = [...ekstraList, { ...ekstraForm, id: Date.now(), harga: parseInt(ekstraForm.harga) }];
  }
  showEkstraForm = false;
}

function confirmDeleteEkstra(id) {
  ekstraIdToDelete = id;
  showDeleteEkstraModal = true;
}

function doDeleteEkstra() {
  if (ekstraIdToDelete !== null) {
    ekstraList = ekstraList.filter(e => e.id !== ekstraIdToDelete);
    showDeleteEkstraModal = false;
    ekstraIdToDelete = null;
  }
}

function cancelDeleteEkstra() {
  showDeleteEkstraModal = false;
  ekstraIdToDelete = null;
}

// Helper functions
function getEkstraNames(ekstraIds) {
  return ekstraIds.map(id => ekstraList.find(e => e.id === id)?.name).filter(Boolean).join(', ');
}

function getEkstraTotalPrice(ekstraIds) {
  return ekstraIds.reduce((total, id) => {
    const ekstra = ekstraList.find(e => e.id === id);
    return total + (ekstra?.harga || 0);
  }, 0);
}

function getFilteredMenus() {
  if (selectedKategori === 'Semua') return menus;
  return menus.filter(menu => menu.kategori === selectedKategori);
}

function getKategoriNames() {
  return kategoriList.map(k => k.name);
}

$: filteredMenus = menus.filter(menu => {
  const keyword = searchKeyword.trim().toLowerCase();
  if (!keyword) return selectedKategori === 'Semua' ? true : menu.kategori === selectedKategori;
  const match = menu.name.toLowerCase().includes(keyword) || (menu.kategori && menu.kategori.toLowerCase().includes(keyword));
  return (selectedKategori === 'Semua' ? true : menu.kategori === selectedKategori) && match;
});

function handleFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
    cropperDialogImage = '';
    setTimeout(() => {
      cropperDialogImage = ev.target.result as string;
      showCropperDialog = true;
    }, 10);
    };
    reader.readAsDataURL(file);
  }

function handleCropperDone(e) {
  console.log('Hasil crop:', e.detail.cropped);
  menuForm.gambar = e.detail.cropped;
  menuForm = { ...menuForm };
  showCropperDialog = false;
  cropperDialogImage = '';
}

function handleCropperCancel() {
  showCropperDialog = false;
  cropperDialogImage = '';
}

function removeImage() {
  selectedImage = null;
  croppedImage = null;
  menuForm.gambar = '';
}

// Format harga input
function formatRupiahInput(e) {
  let value = e.target.value.replace(/[^\d]/g, '');
  value = value ? parseInt(value).toLocaleString('id-ID') : '';
  menuForm.harga = value;
}
</script>

<svelte:head>
  <title>Admin Panel - ZatiarasPOS</title>
</svelte:head>

{#if userRole === 'admin'}
  <div class="h-screen max-h-screen bg-gray-50 overflow-hidden">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="flex items-center">
          <button onclick={() => currentPage === 'main' ? goto('/pengaturan') : currentPage = 'main'} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
            <ArrowLeft class="w-5 h-5 text-gray-600" />
          </button>
          {#if currentPage !== 'main'}
            <h1 class="ml-4 text-xl font-bold text-gray-800">
              {currentPage === 'menu' ? 'Manajemen Menu' : 'Ganti Keamanan'}
            </h1>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main Menu -->
    {#if currentPage === 'main'}
      <div class="max-w-lg mx-auto px-4 py-2">
        <div class="grid grid-cols-2 gap-2 w-full">
          <!-- Manajemen Menu -->
          <button 
            class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-all hover:border-pink-300 group text-left flex flex-col justify-center"
            onclick={() => currentPage = 'menu'}
          >
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded flex items-center justify-center group-hover:scale-105 transition-transform">
                <Utensils class="w-5 h-5 text-white" />
              </div>
              <h3 class="text-sm font-semibold text-gray-800">Manajemen Menu</h3>
            </div>
            <p class="text-xs text-gray-500 leading-tight">Kelola menu, kategori, dan ekstra toko</p>
          </button>

          <!-- Ganti Keamanan -->
          <button 
            class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-all hover:border-blue-300 group text-left flex flex-col justify-center"
            onclick={() => currentPage = 'security'}
          >
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded flex items-center justify-center group-hover:scale-105 transition-transform">
                <Shield class="w-5 h-5 text-white" />
              </div>
              <h3 class="text-sm font-semibold text-gray-800 leading-tight">
                Ganti<br />Keamanan
              </h3>
            </div>
            <p class="text-xs text-gray-500 leading-tight">Ubah password dan pengaturan keamanan</p>
          </button>
        </div>
      </div>
    {/if}

    <!-- Menu Management Page -->
    {#if currentPage === 'menu'}
      <div class="max-w-4xl mx-auto px-4 pb-6 pt-2 h-full flex flex-col"
        ontouchstart={handleTabTouchStart}
        ontouchmove={handleTabTouchMove}
        ontouchend={handleTabTouchEnd}
      >
        <!-- Tab Navigation -->
        <div class="relative flex bg-white rounded-xl p-1 shadow-sm border border-gray-200 mb-4 mt-0 gap-2 overflow-hidden">
          <!-- Indicator Slide & Color Transition -->
          <div
            class="absolute top-1 left-1 h-[calc(100%-0.5rem)] w-1/3 rounded-lg z-0 transition-transform transition-colors duration-300 ease-in-out"
            style="
              transform: translateX({activeTab === 'menu' ? '0%' : activeTab === 'kategori' ? '100%' : '200%'});
              background: {activeTab === 'menu' ? '#ec4899' : activeTab === 'kategori' ? '#3b82f6' : '#22c55e'};
            "
          ></div>
          <button 
            class="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 {activeTab === 'menu' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}"
            onclick={() => activeTab = 'menu'}
          >
            <Utensils class="w-4 h-4" />
            Menu
          </button>
          <button 
            class="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 {activeTab === 'kategori' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}"
            onclick={() => activeTab = 'kategori'}
          >
            <Tag class="w-4 h-4" />
            Kategori
          </button>
          <button 
            class="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 {activeTab === 'ekstra' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}"
            onclick={() => activeTab = 'ekstra'}
          >
            <Coffee class="w-4 h-4" />
            Ekstra
          </button>
        </div>

        {#if activeTab === 'menu'}
        <!-- Search Produk -->
          <div class="w-full mb-4 px-0">
          <div class="relative">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" /></svg>
            </span>
            <input
              type="text"
                class="block w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 placeholder-gray-400"
              placeholder="Cari produk…"
              bind:value={searchKeyword}
            />
          </div>
        </div>

          <!-- Daftar Menu & Filter -->
          <div class="flex items-center gap-2 mb-4 mt-0 px-0">
          <h2 class="text-base font-bold text-gray-800">Daftar Menu</h2>
          <span class="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full text-xs font-medium">{filteredMenus.length} menu</span>
        </div>
        <!-- Kategori Filter -->
          <div class="flex gap-2 overflow-x-auto pb-0 pt-0 px-0 border-b border-gray-100 mb-4">
          <button 
              class="px-3 py-2.5 min-w-[88px] rounded-md font-medium transition-colors whitespace-nowrap text-xs {selectedKategori === 'Semua' ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
            onclick={() => selectedKategori = 'Semua'}
          >
            Semua
          </button>
          {#each getKategoriNames() as kategori}
            <button 
                class="px-3 py-2.5 min-w-[88px] rounded-md font-medium transition-colors whitespace-nowrap text-xs {selectedKategori === kategori ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
              onclick={() => selectedKategori = kategori}
            >
              {kategori}
            </button>
          {/each}
        </div>
        <!-- Menu Grid Scrollable -->
        <div class="flex-1 overflow-y-auto pb-16 pr-1">
          <div class="grid grid-cols-2 gap-3">
            {#each filteredMenus as menu}
              <div class="bg-white rounded-xl shadow border border-gray-100 p-2 flex flex-col items-center relative group cursor-pointer hover:bg-pink-50 transition-colors"
                onclick={() => openMenuForm(menu)}
              >
                <div class="absolute top-2 right-2 opacity-100 transition-opacity z-10 flex gap-2">
                  <button 
                    class="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md"
                    onclick={e => { e.stopPropagation(); confirmDeleteMenu(menu.id); }}
                  >
                    <Trash class="w-5 h-5" />
                  </button>
                </div>
                <div class="w-full aspect-square min-h-[140px] bg-white rounded-xl flex items-center justify-center mb-1 overflow-hidden">
                  <ImagePlaceholder size={140} />
                </div>
                <div class="w-full flex flex-col items-center">
                  <h3 class="font-semibold text-gray-800 text-sm truncate w-full text-center mb-0.5">{menu.name}</h3>
                  <div class="text-xs text-gray-400 mb-0.5">{menu.kategori}</div>
                  <div class="text-pink-500 font-bold text-base">Rp {menu.harga.toLocaleString('id-ID')}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      <!-- Floating Action Button Tambah Menu -->
        <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-pink-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-pink-600 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-400" onclick={() => openMenuForm()} aria-label="Tambah Menu">
          <Plus class="w-7 h-7" />
        </button>
      {/if}

        {#if activeTab === 'kategori'}
          <div class="w-full mb-4 px-0">
            <div class="relative">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" /></svg>
              </span>
              <input
                type="text"
                class="block w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 placeholder-gray-400"
                placeholder="Cari kategori…"
                bind:value={searchKategoriKeyword}
              />
            </div>
          </div>
          <div class="flex-1 overflow-y-auto pb-16 pr-1">
            <div class="flex items-center gap-2 mb-5 mt-1 px-1">
              <h2 class="text-base font-bold text-blue-700">Daftar Kategori</h2>
              <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{kategoriList.length} kategori</span>
            </div>
            {#if kategoriList.length === 0}
              <div class="text-center text-blue-400 py-12 text-sm">Belum ada kategori.<br/>Klik tombol + untuk menambah.</div>
            {:else}
              <div class="space-y-3">
                {#each kategoriList.filter(kat => kat.name.toLowerCase().includes(searchKategoriKeyword.trim().toLowerCase())) as kat}
                  <div class="bg-blue-50 rounded-xl shadow border border-blue-100 p-3 flex items-center justify-between group cursor-pointer hover:bg-blue-100 transition-colors"
                    data-kategori-box
                    onclick={() => openKategoriForm(kat)}>
                    <div>
                      <div class="font-semibold text-blue-700 text-sm">{kat.name}</div>
                      <div class="text-xs text-blue-400">{kat.menuIds.length} menu</div>
                    </div>
                    <div class="flex gap-2" onclick={e => e.stopPropagation()}>
                      <button class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md" onclick={() => confirmDeleteKategori(kat.id)}>
                        <Trash class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          <!-- Floating Action Button Tambah Kategori -->
          <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-blue-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400" onclick={() => openKategoriForm()} aria-label="Tambah Kategori">
            <Plus class="w-7 h-7" />
          </button>
        {/if}

        {#if activeTab === 'ekstra'}
          <div class="w-full mb-4 px-0">
            <div class="relative mb-2">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" /></svg>
              </span>
              <input
                type="text"
                class="block w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 placeholder-gray-400"
                placeholder="Cari ekstra…"
                bind:value={searchEkstra}
              />
            </div>
            <div class="flex items-center gap-2 mb-2 mt-1 px-1">
              <h2 class="text-base font-bold text-green-700">Daftar Ekstra</h2>
              <span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{ekstraList.length} ekstra</span>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto pb-16 pr-1">
            <div class="grid grid-cols-2 gap-3">
              {#each ekstraList.filter(e => e.name.toLowerCase().includes(searchEkstra.trim().toLowerCase())) as ekstra (ekstra.id)}
                <div class="bg-green-50 rounded-xl shadow border border-green-200 p-3 flex flex-col items-center relative transition-all duration-200 cursor-pointer hover:bg-green-100"
                  transition:fade
                  onclick={() => openEkstraForm(ekstra)}
                >
                  <div class="absolute top-2 right-2 z-10 flex gap-2">
                    <button class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md" onclick={e => { e.stopPropagation(); confirmDeleteEkstra(ekstra.id); }}>
                      <Trash class="w-5 h-5" />
                    </button>
                  </div>
                  <div class="w-full flex flex-col items-center">
                    <h3 class="font-semibold text-green-700 text-sm truncate w-full text-center mb-0.5">{ekstra.name}</h3>
                    <div class="text-green-400 font-bold text-xs">Rp {ekstra.harga.toLocaleString('id-ID')}</div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
          <!-- Floating Action Button Tambah Ekstra -->
          <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-green-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400" onclick={() => openEkstraForm()} aria-label="Tambah Ekstra">
            <Plus class="w-7 h-7" />
          </button>
        {/if}
      </div>
    {/if}

    <!-- Security Page -->
    {#if currentPage === 'security'}
      <div class="max-w-4xl mx-auto px-4 py-6">
        <div class="space-y-6">
          <div class="text-center mb-8">
            <div class="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock class="w-10 h-10 text-white" />
            </div>
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Pengaturan Keamanan</h2>
            <p class="text-gray-600">Kelola password dan keamanan akun</p>
          </div>

          <!-- Security Options -->
          <div class="grid gap-4">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Lock class="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 class="text-lg font-bold text-gray-800">Ubah Password</h3>
                    <p class="text-gray-600">Ganti password akun admin</p>
                  </div>
                </div>
                <button class="px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors">
                  Ubah
                </button>
              </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Shield class="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 class="text-lg font-bold text-gray-800">Riwayat Login</h3>
                    <p class="text-gray-600">Lihat aktivitas login terakhir</p>
                  </div>
                </div>
                <button class="px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors">
                  Lihat
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Menu Form Modal -->
    {#if showMenuForm}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-0 relative flex flex-col h-[90vh]">
          <div class="w-full flex flex-row items-center gap-4 px-4 pt-3 pb-2 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]">
            <div class="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
              <Utensils class="w-5 h-5 text-pink-500" />
            </div>
            <h2 class="text-base font-semibold text-gray-700">{editMenuId ? 'Edit Menu' : 'Tambah Menu'}</h2>
          </div>
          <div class="flex-1 w-full overflow-y-auto px-6 pb-2 pt-4 space-y-6">
            <!-- Upload & Crop Gambar -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="menu-gambar">Gambar Produk</label>
              {#if menuForm.gambar}
                <label class="w-full aspect-square min-h-[140px] flex flex-col items-center justify-center mb-2 gap-2 cursor-pointer">
                  <img src={menuForm.gambar} alt="Preview" class="rounded-xl object-cover w-full h-full border border-gray-200 aspect-square" />
                  <input type="file" accept="image/*" class="hidden" onchange={handleFileChange} />
                </label>
                {:else}
                  <label class="w-full aspect-square min-h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-pink-200 rounded-xl cursor-pointer hover:bg-pink-50 transition-colors">
                    <span class="text-pink-400 font-medium mb-2">Klik untuk upload gambar</span>
                    <input type="file" accept="image/*" class="hidden" onchange={handleFileChange} />
                    <span class="text-xs text-gray-400">Format: JPG, PNG, max 2MB</span>
                  </label>
              {/if}
            </div>
            <div class="border-t border-gray-100 my-2"></div>
            <!-- Nama Menu -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="menu-nama">Nama Menu</label>
              <input id="menu-nama"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Contoh: Jus Alpukat"
                bind:value={menuForm.name}
              />
            </div>
            <!-- Tipe (Box Selector) -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Tipe</label>
              <div class="flex gap-3">
                <button type="button"
                  class="flex-1 px-0 py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 {menuForm.tipe === 'makanan' ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                  onclick={() => menuForm.tipe = 'makanan'}>
                  Makanan
                </button>
                <button type="button"
                  class="flex-1 px-0 py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 {menuForm.tipe === 'minuman' ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                  onclick={() => menuForm.tipe = 'minuman'}>
                  Minuman
                </button>
              </div>
            </div>
            <!-- Kategori (Box Selector) -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
              <div class="flex gap-2 overflow-x-auto pb-1">
                {#each kategoriList as kat}
                  <button type="button"
                    class="px-4 py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 whitespace-nowrap {menuForm.kategori === kat.name ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                    onclick={() => menuForm.kategori = kat.name}>
                    {kat.name}
                  </button>
                {/each}
              </div>
            </div>
            <!-- Harga (Input Format Rupiah) -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="menu-harga">Harga</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">Rp</span>
                <input 
                  class="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="0"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  id="menu-harga"
                  bind:value={menuForm.harga}
                  oninput={(e) => {
                    let value = e.target.value.replace(/[^\d]/g, '');
                    if (value) {
                      value = parseInt(value, 10).toLocaleString('id-ID');
                    } else {
                      value = '';
                    }
                    menuForm.harga = value;
                    setTimeout(() => {
                      e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
                    }, 0);
                  }}
                />
              </div>
            </div>
            <!-- Ekstra (Box Selector Grid) -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Ekstra (Opsional)</label>
              <div class="grid grid-cols-2 gap-2">
                {#each ekstraList as ekstra}
                  <button type="button"
                    class="w-full justify-center py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 flex items-center text-center whitespace-normal overflow-hidden {menuForm.ekstraIds.includes(ekstra.id) ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                    onclick={() => {
                      if (menuForm.ekstraIds.includes(ekstra.id)) {
                        menuForm.ekstraIds = menuForm.ekstraIds.filter(id => id !== ekstra.id);
                      } else {
                        menuForm.ekstraIds = [...menuForm.ekstraIds, ekstra.id];
                      }
                    }}
                  >
                    <span class="mx-auto">{ekstra.name}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
          <div class="sticky bottom-0 left-0 w-full px-6 pb-6 pt-4 flex gap-3 z-10 shadow-[0_-4px_24px_-6px_rgba(0,0,0,0.12)]">
            <button 
              class="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-base"
              onclick={() => showMenuForm = false}
            >
              Batal
            </button>
            <button 
              class="flex-1 py-3 px-4 bg-pink-500 text-white rounded-xl font-bold hover:bg-pink-600 transition-colors text-base shadow-md"
              onclick={saveMenu}
            >
              {editMenuId ? 'Simpan' : 'Tambah Menu'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Kategori Form Modal -->
    {#if showKategoriDetailModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-0 relative flex flex-col h-[90vh] max-h-[600px]">
          <div class="w-full flex flex-row items-center gap-4 px-4 pt-3 pb-2 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]">
            <div class="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
              <Tag class="w-5 h-5 text-blue-500" />
            </div>
            <h2 class="text-base font-semibold text-gray-700">Edit Kategori</h2>
          </div>
          <div class="flex-1 w-full overflow-y-auto px-6 pb-2 pt-4">
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="kategori-nama-input">Nama Kategori</label>
              <input id="kategori-nama-input"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Contoh: Minuman"
                bind:value={kategoriDetailName}
              />
            </div>
            <div class="mb-6">
              <div class="text-xs font-semibold text-blue-500 mb-2">Menu dalam Kategori</div>
              <div class="flex flex-wrap gap-2 min-h-[36px]">
                {#each menuIdsInKategori as id (id)}
                  <div class="px-3 py-2 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium cursor-pointer select-none transition-all duration-200 shadow-sm hover:bg-blue-200"
                    transition:fly={{ y: -16, duration: 200 }}
                    onclick={() => toggleMenuInKategori(id)}>
                    {menus.find(m => m.id === id)?.name}
                  </div>
                {/each}
                {#if menuIdsInKategori.length === 0}
                  <div class="text-gray-300 text-xs italic">Belum ada menu</div>
                {/if}
              </div>
            </div>
            <div class="mb-6">
              <div class="text-xs font-semibold text-gray-400 mb-2">Menu Non-Kategori</div>
              <div class="flex flex-wrap gap-2 min-h-[36px]">
                {#each menuIdsNonKategori as id (id)}
                  <div class="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium cursor-pointer select-none transition-all duration-200 shadow-sm hover:bg-blue-50"
                    transition:fly={{ y: 16, duration: 200 }}
                    onclick={() => toggleMenuInKategori(id)}>
                    {menus.find(m => m.id === id)?.name}
                  </div>
                {/each}
                {#if menuIdsNonKategori.length === 0}
                  <div class="text-gray-300 text-xs italic">Tidak ada menu non-kategori</div>
                {/if}
              </div>
            </div>
          </div>
          <div class="sticky bottom-0 left-0 w-full px-6 pb-6 pt-4 flex gap-3 z-10 shadow-[0_-4px_24px_-6px_rgba(0,0,0,0.12)]">
            <button 
              class="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-base"
              onclick={closeKategoriDetailModal}
            >
              Batal
            </button>
            <button 
              class="flex-1 py-3 px-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors text-base shadow-md"
              onclick={saveKategoriDetail}
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Delete Confirmation Modal -->
    {#if showDeleteModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center">
          <button class="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200" onclick={cancelDeleteMenu} aria-label="Tutup">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <Trash class="w-8 h-8 text-red-500" />
          </div>
          <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Menu?</h2>
          <p class="text-gray-500 text-sm mb-6 text-center">Menu yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus menu ini?</p>
          <div class="flex gap-3 w-full">
            <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" onclick={cancelDeleteMenu}>Batal</button>
            <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" onclick={doDeleteMenu}>Hapus</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Cropper Dialog -->
    <CropperDialog bind:open={showCropperDialog} src={cropperDialogImage} aspect={1} on:done={handleCropperDone} on:cancel={handleCropperCancel} />

    <!-- Delete Confirmation Modal Kategori -->
    {#if showDeleteKategoriModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center">
          <button class="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200" onclick={cancelDeleteKategori} aria-label="Tutup">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <Trash class="w-8 h-8 text-red-500" />
          </div>
          <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Kategori?</h2>
          <p class="text-gray-500 text-sm mb-6 text-center">Kategori yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus kategori ini?</p>
          <div class="flex gap-3 w-full">
            <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" onclick={cancelDeleteKategori}>Batal</button>
            <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" onclick={doDeleteKategori}>Hapus</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Delete Confirmation Modal Ekstra -->
    {#if showDeleteEkstraModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center">
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <Trash class="w-8 h-8 text-red-500" />
          </div>
          <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Ekstra?</h2>
          <p class="text-gray-500 text-sm mb-6 text-center">Ekstra yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus ekstra ini?</p>
          <div class="flex gap-3 w-full">
            <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" onclick={cancelDeleteEkstra}>Batal</button>
            <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" onclick={doDeleteEkstra}>Hapus</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Ekstra Form Modal -->
    {#if showEkstraForm}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-0 relative flex flex-col h-[90vh] max-h-[600px]">
          <div class="w-full flex flex-row items-center gap-4 px-4 pt-3 pb-2 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]">
            <div class="w-8 h-8 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center">
              <Coffee class="w-5 h-5 text-green-500" />
            </div>
            <h2 class="text-base font-semibold text-gray-700">{editEkstraId ? 'Edit Ekstra' : 'Tambah Ekstra'}</h2>
          </div>
          <div class="flex-1 w-full overflow-y-auto px-6 pb-2 pt-4">
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="ekstra-nama">Nama Ekstra</label>
              <input 
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Contoh: Coklat"
                id="ekstra-nama"
                bind:value={ekstraForm.name}
              />
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="ekstra-harga">Harga</label>
              <input 
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0"
                type="number"
                min="0"
                id="ekstra-harga"
                bind:value={ekstraForm.harga}
              />
            </div>
          </div>
          <div class="sticky bottom-0 left-0 w-full px-6 pb-6 pt-4 flex gap-3 z-10 shadow-[0_-4px_24px_-6px_rgba(0,0,0,0.12)]">
            <button 
              class="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-base"
              onclick={() => showEkstraForm = false}
            >
              Batal
            </button>
            <button 
              class="flex-1 py-3 px-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors text-base shadow-md"
              onclick={saveEkstra}
              disabled={!ekstraForm.name.trim() || !ekstraForm.harga || isNaN(parseInt(ekstraForm.harga)) || parseInt(ekstraForm.harga) <= 0}
            >
              {editEkstraId ? 'Simpan' : 'Tambah Ekstra'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <div class="text-6xl mb-4">🔒</div>
      <h2 class="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
      <p class="text-gray-600 mb-6">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      <button 
        class="bg-pink-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-pink-600 transition-colors"
        onclick={() => goto('/pengaturan')}
      >
        Kembali ke Pengaturan
      </button>
    </div>
  </div>
{/if}   