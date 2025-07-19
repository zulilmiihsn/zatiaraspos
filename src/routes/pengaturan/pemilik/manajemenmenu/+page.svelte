<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import { get as storeGet } from 'svelte/store';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { writable } from 'svelte/store';
import CropperDialog from '$lib/components/shared/CropperDialog.svelte';
import { fly, fade, slide } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { getSupabaseClient } from '$lib/database/supabaseClient';
import ImagePlaceholder from '$lib/components/shared/ImagePlaceholder.svelte';
import ArrowLeft from 'lucide-svelte/icons/arrow-left';
import { get as getCache, set as setCache } from 'idb-keyval';
import { memoize } from '$lib/utils/performance';

// Data Menu
let menus: any[] = [];
let imageError: Record<string, boolean> = {};
let kategoriList: any[] = [];
let ekstraList: any[] = [];
let showMenuForm = false;
let showKategoriForm = false;
let showEkstraForm = false;
let editMenuId: any = null;
let editKategoriId = null;
let editEkstraId: any = null;
let menuForm = writable({ name: '', kategori_id: '', tipe: 'minuman', price: '', ekstra_ids: [], gambar: '' });
let kategoriForm = { name: '' };
let ekstraForm = { name: '', harga: '' };
let selectedKategori = 'Semua';
let searchKeyword = '';
let showDeleteModal = false;
let menuIdToDelete: number|null = null;
let selectedImage: File|null = null;
let croppedImage: string|null = null;
let showCropperDialog = false;
let cropperDialogImage = '';
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let menuTouchStartX = 0;
let menuTouchStartY = 0;
let menuTouchStartTime = 0;
let menuSwipeDetected = false;
let showDeleteKategoriModal = false;
let kategoriIdToDelete: number|null = null;
let showKategoriDetailModal = false;
let kategoriDetail: any = null;
let selectedMenuIds: number[] = [];
let unselectedMenuIds: number[] = [];
let kategoriDetailName = '';
let searchKategoriKeyword = '';
let searchEkstra = '';
let showDeleteEkstraModal = false;
let ekstraIdToDelete: any = null;
let kategoriTouchStartX = 0;
let kategoriTouchStartY = 0;
let kategoriTouchStartTime = 0; 
let kategoriSwipeDetected = false;
let ekstraTouchStartX = 0;
let ekstraTouchStartY = 0;
let ekstraTouchStartTime = 0;
let ekstraSwipeDetected = false;
let isTouchDevice = false;
if (typeof window !== 'undefined') {
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
let justTapped = false;
let isGridView = true;
let showNotifModal = false;
let notifModalMsg = '';
let notifModalType = 'warning';
let isCropping = false;
let fileInputEl;
let activeTab = 'menu';
let Plus, Edit, Trash, Coffee, Utensils, Tag;
let isLoadingMenus = true;
let isLoadingKategori = true;
let isLoadingEkstra = true;

const memoizedKategoriWithCount = memoize((menus, kategoriList) =>
  kategoriList.map(kat => ({
    ...kat,
    count: menus.filter(m => m.kategori_id === kat.id).length
  })),
  (menus, kategoriList) => `${menus.length}-${kategoriList.length}`
);

$: kategoriWithCount = memoizedKategoriWithCount(menus, kategoriList);

const memoizedFilteredMenus = memoize((menus, kategoriList, selectedKategori, searchKeyword) => {
  const keyword = searchKeyword.trim().toLowerCase();
  return menus.filter(menu => {
    if (!keyword) return selectedKategori === 'Semua' ? true : menu.kategori_id === selectedKategori;
    const kategoriNama = kategoriList.find(k => k.id === menu.kategori_id)?.name?.toLowerCase() || '';
    const match = menu.name.toLowerCase().includes(keyword) || kategoriNama.includes(keyword);
    return (selectedKategori === 'Semua' ? true : menu.kategori_id === selectedKategori) && match;
  });
}, (menus, kategoriList, selectedKategori, searchKeyword) => `${menus.length}-${kategoriList.length}-${selectedKategori}-${searchKeyword}`);

$: filteredMenus = memoizedFilteredMenus(menus, kategoriList, selectedKategori, searchKeyword);

async function fetchMenus() {
  isLoadingMenus = true;
  try {
    const { data, error } = await getSupabaseClient(storeGet(selectedBranch)).from('produk').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    menus = data || [];
  } catch (error) {
    notifModalMsg = 'Gagal mengambil data menu: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
  isLoadingMenus = false;
}

async function fetchKategori() {
  isLoadingKategori = true;
  try {
    const { data, error } = await getSupabaseClient(storeGet(selectedBranch)).from('kategori').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    kategoriList = data || [];
  } catch (error) {
    notifModalMsg = 'Gagal mengambil data kategori: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
  isLoadingKategori = false;
}

async function fetchEkstra() {
  isLoadingEkstra = true;
  try {
    const { data, error } = await getSupabaseClient(storeGet(selectedBranch)).from('tambahan').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    ekstraList = (data || []).map(e => ({ ...e, harga: e.price }));
  } catch (error) {
    notifModalMsg = 'Gagal mengambil data ekstra: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
  isLoadingEkstra = false;
}

onMount(async () => {
  // 1. Tampilkan cache POS jika ada
  const cachedPOS = await getCache('pos-data');
  if (cachedPOS) {
    menus = cachedPOS.produkData || [];
    kategoriList = cachedPOS.kategoriData || [];
    ekstraList = cachedPOS.tambahanData || [];
  }

  // 2. Fetch data terbaru dari server
  await fetchMenus();
  await fetchKategori();
  await fetchEkstra();

  // 3. Update cache POS setelah fetch sukses
  await setCache('pos-data', {
    produkData: menus,
    kategoriData: kategoriList,
    tambahanData: ekstraList
  });

  if (typeof window !== 'undefined') {
    document.body.classList.add('hide-nav');
  }
  Plus = (await import('lucide-svelte/icons/plus')).default;
  Edit = (await import('lucide-svelte/icons/edit')).default;
  Trash = (await import('lucide-svelte/icons/trash')).default;
  Coffee = (await import('lucide-svelte/icons/coffee')).default;
  Utensils = (await import('lucide-svelte/icons/utensils')).default;
  Tag = (await import('lucide-svelte/icons/tag')).default;
});

onDestroy(() => {
  if (typeof window !== 'undefined') {
    document.body.classList.remove('hide-nav');
  }
});

function openMenuForm(menu = null) {
  if (showMenuForm && menu && editMenuId === menu.id) {
    return;
  }
  showMenuForm = true;
  if (menu) {
    editMenuId = menu.id;
    $menuForm = { ...menu, ekstra_ids: menu.ekstra_ids ?? [] };
  } else {
    editMenuId = null;
    $menuForm = { name: '', kategori_id: '', tipe: 'minuman', price: '', ekstra_ids: [], gambar: '' };
  }
}

function closeMenuForm() {
  showMenuForm = false;
  editMenuId = null;
  $menuForm = { name: '', kategori_id: '', tipe: 'minuman', price: '', ekstra_ids: [], gambar: '' };
}

async function saveMenu() {
  if (!$menuForm.name || $menuForm.name.toString().trim() === '') {
    notifModalMsg = 'Nama menu wajib diisi!';
    notifModalType = 'warning';
    showNotifModal = true;
    return;
  }
  if (!$menuForm.price || $menuForm.price.toString().trim() === '') {
    notifModalMsg = 'Harga menu wajib diisi!';
    notifModalType = 'warning';
    showNotifModal = true;
    return;
  }
  if (!$menuForm.kategori_id || $menuForm.kategori_id.trim() === '') {
    $menuForm = { ...$menuForm, kategori_id: null };
  }
  let imageUrl = $menuForm.gambar;
  if (imageUrl && imageUrl.startsWith('data:image/')) {
    try {
      imageUrl = await uploadMenuImageFromDataUrl(imageUrl, editMenuId || Date.now());
    } catch (err) {
      notifModalMsg = 'Gagal upload gambar: ' + (err?.message || err?.error_description || 'Unknown error');
      notifModalType = 'error';
      showNotifModal = true;
      return;
    }
  }
  const payload = { ...$menuForm, gambar: imageUrl, price: parseInt($menuForm.price), ekstra_ids: $menuForm.ekstra_ids };
  let result;
  try {
    if (editMenuId) {
      result = await getSupabaseClient(storeGet(selectedBranch)).from('produk').update(payload).eq('id', editMenuId);
    } else {
      result = await getSupabaseClient(storeGet(selectedBranch)).from('produk').insert([payload]);
    }
    if (result.error) {
      throw result.error;
    }
  } catch (error) {
      notifModalMsg = 'Gagal menyimpan menu: ' + error.message;
      notifModalType = 'error';
      showNotifModal = true;
      return;
  }
  showMenuForm = false;
  await fetchMenus();
  await afterUpdateCachePOS();
}

function confirmDeleteMenu(id: number) {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
  menuIdToDelete = id;
  showDeleteModal = true;
  touchStartX = 0;
  touchEndX = 0;
}

async function doDeleteMenu() {
  if (menuIdToDelete !== null) {
    try {
      const menu = menus.find(m => m.id === menuIdToDelete);
      if (menu?.gambar) {
        const path = menu.gambar.split('/').pop();
        await getSupabaseClient(storeGet(selectedBranch)).storage.from('gambar-menu').remove([path]);
      }
      const { error } = await getSupabaseClient(storeGet(selectedBranch)).from('produk').delete().eq('id', menuIdToDelete);
      if (error) {
        throw error;
      }
      notifModalMsg = 'Menu berhasil dihapus!';
      notifModalType = 'success';
      showNotifModal = true;
    } catch (error) {
        notifModalMsg = 'Gagal menghapus menu: ' + error.message;
        notifModalType = 'error';
        showNotifModal = true;
        return;
    }
    showDeleteModal = false;
    menuIdToDelete = null;
    await fetchMenus();
    await afterUpdateCachePOS();
  }
}

function cancelDeleteMenu() {
  showDeleteModal = false;
  menuIdToDelete = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
  touchStartX = 0;
  touchEndX = 0;
}

function openKategoriForm(kat) {
  if (!kat) {
    kategoriDetail = null;
    showKategoriDetailModal = true;
    kategoriDetailName = '';
    selectedMenuIds = [];
    unselectedMenuIds = menus.filter(m => !m.kategori_id).map(m => m.id);
    return;
  }
  kategoriDetail = kat;
  showKategoriDetailModal = true;
  kategoriDetailName = kat.name;
  selectedMenuIds = menus.filter(m => m.kategori_id === kat.id).map(m => m.id);
  unselectedMenuIds = menus.filter(m => !m.kategori_id).map(m => m.id).filter(id => !selectedMenuIds.includes(id));
}

function closeKategoriDetailModal() {
  showKategoriDetailModal = false;
  kategoriDetail = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
}

async function saveKategoriDetail() {
  if (kategoriDetail) {
    const { error } = await getSupabaseClient(storeGet(selectedBranch)).from('kategori').update({ name: kategoriDetailName }).eq('id', kategoriDetail.id);
    if (error) {
      notifModalMsg = 'Gagal menyimpan kategori: ' + error.message;
      notifModalType = 'error';
      showNotifModal = true;
      return;
    }
    await updateMenusKategori(kategoriDetail.id, selectedMenuIds, kategoriDetail.id);
  } else {
    const { data, error } = await getSupabaseClient(storeGet(selectedBranch)).from('kategori').insert([{ name: kategoriDetailName }]).select();
    if (error) {
      notifModalMsg = 'Gagal menambah kategori: ' + error.message;
      notifModalType = 'error';
      showNotifModal = true;
      return;
    }
    const newKategoriId = data?.[0]?.id ?? null;
    await updateMenusKategori(newKategoriId, selectedMenuIds, null);
  }
  showKategoriDetailModal = false;
  kategoriDetail = null;
  await fetchKategori();
  await fetchMenus();
  await afterUpdateCachePOS();
}

function confirmDeleteKategori(id: number) {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
  kategoriIdToDelete = id;
  showDeleteKategoriModal = true;
  touchStartX = 0;
  touchEndX = 0;
}

async function doDeleteKategori() {
  if (kategoriIdToDelete !== null) {
    const kategori = kategoriList.find(k => k.id === kategoriIdToDelete);
    const kategoriName = kategori?.name || '';
    await getSupabaseClient(storeGet(selectedBranch)).from('kategori').delete().eq('id', kategoriIdToDelete);
    if (kategoriName) {
      await getSupabaseClient(storeGet(selectedBranch)).from('produk').update({ kategori: null }).eq('kategori', kategoriName);
    }
    showDeleteKategoriModal = false;
    kategoriIdToDelete = null;
    await fetchKategori();
    await fetchMenus();
    await afterUpdateCachePOS();
  }
}

function cancelDeleteKategori() {
  showDeleteKategoriModal = false;
  kategoriIdToDelete = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
  touchStartX = 0;
  touchEndX = 0;
}

function openEkstraForm(ekstra = null) {
  showEkstraForm = true;
  if (ekstra) {
    editEkstraId = ekstra.id;
    ekstraForm = { ...ekstra, harga: ekstra.harga.toLocaleString('id-ID') };
  } else {
    editEkstraId = null;
    ekstraForm = { name: '', harga: '' };
  }
}

async function saveEkstra() {
  if (!ekstraForm.name.trim()) {
    notifModalMsg = 'Nama ekstra wajib diisi';
    notifModalType = 'warning';
    showNotifModal = true;
    return;
  }
  const harga = parseInt(ekstraForm.harga.toString().replace(/[^\d]/g, ''));
  if (isNaN(harga) || harga <= 0) {
    notifModalMsg = 'Harga wajib diisi dan harus lebih dari 0';
    notifModalType = 'warning';
    showNotifModal = true;
    return;
  }
  try {
    if (editEkstraId) {
      const { error } = await getSupabaseClient(storeGet(selectedBranch)).from('tambahan')
        .update({ name: ekstraForm.name, price: harga })
        .eq('id', editEkstraId);
      if (error) throw error;
    } else {
      const { error } = await getSupabaseClient(storeGet(selectedBranch)).from('tambahan')
        .insert([{ name: ekstraForm.name, price: harga }]);
      if (error) throw error;
    }
    await fetchEkstra();
    showEkstraForm = false;
    ekstraForm = { name: '', harga: '' };
    editEkstraId = null;
  } catch (error) {
    notifModalMsg = 'Gagal menyimpan ekstra: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
  await afterUpdateCachePOS();
}

function confirmDeleteEkstra(id) {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
  ekstraIdToDelete = id;
  showDeleteEkstraModal = true;
  touchStartX = 0;
  touchEndX = 0;
}

async function doDeleteEkstra() {
  if (ekstraIdToDelete !== null) {
    await getSupabaseClient(storeGet(selectedBranch)).from('tambahan').delete().eq('id', ekstraIdToDelete);
    showDeleteEkstraModal = false;
    ekstraIdToDelete = null;
    await fetchEkstra();
    await afterUpdateCachePOS();
  }
}

function cancelDeleteEkstra() {
  showDeleteEkstraModal = false;
  ekstraIdToDelete = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
  touchStartX = 0;
  touchEndX = 0;
}

// Helper functions for menu form
function handleFileChange(e) {
  if (isCropping) return;
  const file = e.target.files[0];
  if (!file) return;
  selectedImage = file;
    const reader = new FileReader();
  reader.onload = (ev) => {
    cropperDialogImage = '';
    setTimeout(() => {
      cropperDialogImage = ev.target.result as string;
      showCropperDialog = true;
      isCropping = true;
    }, 10);
    };
    reader.readAsDataURL(file);
  }

function handleCropperDone(e) {
  $menuForm = { ...$menuForm, gambar: e.detail.cropped };
  showCropperDialog = false;
  cropperDialogImage = '';
  isCropping = false;
  if (fileInputEl) fileInputEl.value = '';
}

function handleCropperCancel() {
  showCropperDialog = false;
  cropperDialogImage = '';
  isCropping = false;
}

function removeImage() {
  $menuForm = { ...$menuForm, gambar: '' };
  if (fileInputEl) {
    fileInputEl.value = '';
  }
}

function formatRupiahInput(e) {
  let value = e.target.value.replace(/[^\d]/g, '');
  if (value) {
    value = parseInt(value).toLocaleString('id-ID');
  }
  $menuForm = { ...$menuForm, price: value };
}

function handleImgError(menuId) {
  imageError[menuId] = true;
  imageError = imageError; // trigger reactivity
}

function handleKategoriClick(e, kat) {
  // Handle kategori click if needed
}

function handleEkstraClick(e, ekstra) {
  // Handle ekstra click if needed
}

function toggleMenuInKategoriRealtime(menuId) {
  if (selectedMenuIds.includes(menuId)) {
    selectedMenuIds = selectedMenuIds.filter(id => id !== menuId);
    unselectedMenuIds = [...unselectedMenuIds, menuId];
  } else {
    unselectedMenuIds = unselectedMenuIds.filter(id => id !== menuId);
    selectedMenuIds = [...selectedMenuIds, menuId];
  }
}

async function updateMenusKategori(kategoriId, menuIds, oldKategoriId) {
  // Update menu kategori
  for (const menuId of menuIds) {
    await getSupabaseClient(storeGet(selectedBranch)).from('produk').update({ kategori_id: kategoriId }).eq('id', menuId);
  }
}

async function uploadMenuImageFromDataUrl(dataUrl, menuId) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const filePath = `menu-${menuId}-${Date.now()}.jpg`;
  const { data, error } = await getSupabaseClient(storeGet(selectedBranch)).storage.from('gambar-menu').upload(filePath, blob, { upsert: true });
  if (error) throw error;
  const { data: publicUrlData } = getSupabaseClient(storeGet(selectedBranch)).storage.from('gambar-menu').getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

function blockNextClick(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Helper functions for modal buttons
function setMenuType(type) {
  $menuForm = { ...$menuForm, tipe: type };
}

function setMenuKategori(kategoriId) {
  $menuForm = { ...$menuForm, kategori_id: kategoriId };
}

function toggleEkstra(ekstraId) {
  if ($menuForm.ekstra_ids.includes(ekstraId)) {
    $menuForm = { ...$menuForm, ekstra_ids: $menuForm.ekstra_ids.filter(id => id !== ekstraId) };
  } else {
    $menuForm = { ...$menuForm, ekstra_ids: [...$menuForm.ekstra_ids, ekstraId] };
  }
}

async function afterUpdateCachePOS() {
  await setCache('pos-data', {
    produkData: menus,
    kategoriData: kategoriList,
    tambahanData: ekstraList
  });
}
</script>

<!-- Seluruh markup manajemen menu, kategori, ekstra, dan modal dari file src/routes/pengaturan/pemilik/+page.svelte -->
<!-- Tambahkan seluruh markup (HTML/Svelte) untuk list/tabel menu, kategori, ekstra, form/modal tambah/edit/hapus, modal/modal sheet, komponen upload/crop gambar, dan semua tampilan serta interaksi CRUD menu, kategori, ekstra dari file /pemilik ke sini. Pastikan semua event handler, binding, dan logic tetap berjalan. Jangan sertakan bagian keamanan, riwayat, atau navigasi utama. -->

<div transition:fly={{ y: 32, duration: 320, easing: cubicOut }}>
<!-- Custom Top Bar -->
<div class="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200 flex items-center px-4 py-4 mb-0">
  <button onclick={() => goto('/pengaturan/pemilik')} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors mr-2">
    <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
  </button>
  <h1 class="text-xl font-bold text-gray-800">Manajemen Menu</h1>
</div>

<!-- Navigasi Tab Menu/Kategori/Ekstra -->
<div class="max-w-4xl mx-auto px-4 pt-3">
  <div class="bg-white rounded-xl shadow border border-gray-100 flex overflow-hidden p-1 mb-3 relative">
    <!-- Sliding Background -->
    <div class="absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out {activeTab === 'menu' ? 'left-1 w-[calc(33.333%-0.25rem)] bg-pink-500' : activeTab === 'kategori' ? 'left-[calc(33.333%+0.125rem)] w-[calc(33.333%-0.25rem)] bg-blue-500' : 'left-[calc(66.666%+0.125rem)] w-[calc(33.333%-0.25rem)] bg-green-500'}"></div>
    
    <button class="flex-1 py-2 rounded-lg font-semibold text-base transition-all focus:outline-none relative z-10 {activeTab === 'menu' ? 'text-white' : 'text-gray-700'}" onclick={() => activeTab = 'menu'}>Menu</button>
    <button class="flex-1 py-2 rounded-lg font-semibold text-base transition-all focus:outline-none relative z-10 {activeTab === 'kategori' ? 'text-white' : 'text-gray-700'}" onclick={() => activeTab = 'kategori'}>Kategori</button>
    <button class="flex-1 py-2 rounded-lg font-semibold text-base transition-all focus:outline-none relative z-10 {activeTab === 'ekstra' ? 'text-white' : 'text-gray-700'}" onclick={() => activeTab = 'ekstra'}>Tambahan</button>
  </div>
</div>

<!-- Floating Action Button (FAB) bulat untuk tambah data sesuai tab aktif -->
{#if activeTab === 'menu'}
  <button class="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-lg hover:bg-pink-600 transition-colors" onclick={() => openMenuForm()} aria-label="Tambah Menu">
    <svelte:component this={Plus} class="w-8 h-8" />
  </button>
{:else if activeTab === 'kategori'}
  <button class="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors" onclick={() => openKategoriForm()} aria-label="Tambah Kategori">
    <svelte:component this={Plus} class="w-8 h-8" />
  </button>
{:else if activeTab === 'ekstra'}
  <button class="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors" onclick={() => openEkstraForm()} aria-label="Tambah Tambahan">
    <svelte:component this={Plus} class="w-8 h-8" />
  </button>
{/if}

<!-- Konten tab dengan transisi geser -->
<div class="relative min-h-screen">
  {#if activeTab === 'menu'}
    <div transition:slide|local class="flex flex-col h-[calc(100vh-200px)]">
      <!-- Fixed Header Section -->
      <div class="flex-shrink-0 bg-white">
        <!-- Search Bar -->
        <div class="max-w-4xl mx-auto px-4 pb-2">
          <div class="relative flex items-center">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" class="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-base bg-white text-gray-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" placeholder="Cari menu..." bind:value={searchKeyword} />
          </div>
        </div>
        <!-- Header Daftar Menu -->
        <div class="max-w-4xl mx-auto px-4 pb-2">
          <h2 class="text-lg font-bold text-gray-800">Daftar Menu</h2>
        </div>
        <!-- Bar Filter Kategori (button group, horizontal scroll, seperti POS) -->
        <div class="max-w-4xl mx-auto px-4 pb-4 overflow-x-auto">
          <div class="flex gap-2 w-max min-w-full items-center">
            <!-- Toggle Grid/List -->
            <button class="p-2 w-9 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center transition-colors border-pink-500 bg-pink-50" onclick={() => isGridView = !isGridView} aria-label={isGridView ? 'Tampilkan List' : 'Tampilkan Grid'}>
              {#if isGridView}
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" transition:fade={{ duration: 120 }}><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              {:else}
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" transition:fade={{ duration: 120 }}><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>
              {/if}
            </button>
            <button class="px-4 py-2 rounded-lg border text-sm font-semibold transition-all focus:outline-none {selectedKategori === 'Semua' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-200'}" onclick={() => selectedKategori = 'Semua'}>Semua</button>
            {#each kategoriList as kat}
              <button class="px-4 py-2 rounded-lg border text-sm font-semibold transition-all focus:outline-none {selectedKategori == kat.id ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-200'}" onclick={() => selectedKategori = kat.id}>{kat.name}</button>
            {/each}
          </div>
        </div>
      </div>
      
      <!-- Scrollable Menu List -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto px-4 pb-6">
            {#if isLoadingMenus}
              <div class="grid grid-cols-2 gap-3 pb-4 min-h-screen">
                {#each Array(6) as _, i}
                  <div class="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 animate-pulse rounded-xl shadow-md border border-gray-100 p-4 flex flex-col items-center justify-between aspect-[3/4] min-h-[140px] max-h-[260px] w-full">
                    <div class="w-full aspect-square rounded-lg border border-gray-100 bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 mb-2"></div>
                    <div class="w-full h-4 bg-gray-200 rounded mb-1"></div>
                    <div class="w-2/3 h-3 bg-gray-100 rounded mb-1"></div>
                    <div class="w-1/2 h-3 bg-gray-100 rounded"></div>
                  </div>
                {/each}
              </div>
            {:else if filteredMenus.length === 0}
              <div class="flex flex-col items-center justify-center py-12 text-center min-h-[50vh] pointer-events-none">
                <div class="text-6xl mb-2">🍽️</div>
                <div class="text-base font-semibold text-gray-700 mb-1">Belum ada Menu</div>
                <div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
              </div>
            {:else}
          {#if isGridView}
            <div class="grid grid-cols-2 gap-3 pb-4" transition:fade={{ duration: 120 }}>
              {#each filteredMenus as menu}
                <div class="bg-white rounded-xl shadow border border-gray-100 p-4 flex flex-col cursor-pointer transition-shadow relative h-[260px]" onclick={() => openMenuForm(menu)}>
                  <!-- Tombol Delete floating di pojok kanan atas -->
                  <div class="absolute top-2 right-2 z-10">
                    <button class="p-2 rounded-full bg-red-50 hover:bg-red-100 border border-red-200" onclick={(e) => { e.stopPropagation(); confirmDeleteMenu(menu.id); }} aria-label="Hapus Menu">
                      <svelte:component this={Trash} class="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                  <div class="flex flex-col h-full w-full">
                    <div class="w-full flex-1 flex items-center justify-center" style="padding-top: 0; margin-top: -8px;">
                      {#if menu.gambar}
                        <img src={menu.gambar} alt={menu.name} class="w-full aspect-square object-cover rounded-lg border border-gray-100" onerror={() => handleImgError(menu.id)} />
                      {:else}
                        <div class="w-full aspect-square rounded-lg border border-gray-100 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center text-4xl">
                          🍹
                        </div>
                      {/if}
                    </div>
                    <div class="w-full text-center flex-shrink-0">
                      <div class="font-semibold text-gray-800 text-base truncate mb-1">{menu.name}</div>
                      <div class="text-xs text-gray-500 truncate mb-1">{kategoriList.find(k => k.id === menu.kategori_id)?.name || '-'}</div>
                      <div class="text-xs font-bold text-pink-500">Rp {menu.price.toLocaleString('id-ID')}</div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex flex-col gap-2 px-0 pb-4" transition:fade={{ duration: 120 }}>
              {#each filteredMenus as menu}
                <div class="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer" onclick={() => openMenuForm(menu)}>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-800 text-base truncate mb-0.5">{menu.name}</div>
                    <div class="text-xs text-gray-500 truncate mb-0.5">{kategoriList.find(k => k.id === menu.kategori_id)?.name || '-'}</div>
                    <div class="text-pink-500 font-bold text-base">Rp {menu.price.toLocaleString('id-ID')}</div>
                  </div>
                  <div class="ml-2">
                    <button class="p-2 rounded-full bg-red-50 hover:bg-red-100 border border-red-200" onclick={(e) => { e.stopPropagation(); confirmDeleteMenu(menu.id); }} aria-label="Hapus Menu">
                      <svelte:component this={Trash} class="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
              {/if}
          {/if}
        </div>
      </div>
    </div>
  {:else if activeTab === 'kategori'}
    <div transition:slide|local class="flex flex-col h-[calc(100vh-200px)]">
      <!-- Fixed Header Section -->
      <div class="flex-shrink-0 bg-white px-4">
        <!-- Search Bar -->
        <div class="relative flex items-center mb-3">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" class="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-base bg-white text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Cari kategori..." bind:value={searchKategoriKeyword} />
        </div>
        <!-- Header Daftar Kategori -->
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-bold text-gray-800">Daftar Kategori</h2>
        </div>
      </div>
      
      <!-- Scrollable Kategori List -->
      <div class="flex-1 overflow-y-auto">
        <div class="px-4 pb-6">
            {#if isLoadingKategori}
              <div class="flex flex-col gap-2 min-h-screen">
                {#each Array(4) as _, i}
                  <div class="bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100 animate-pulse rounded-xl shadow-md border border-blue-200 px-4 py-3 flex items-center justify-between"></div>
                {/each}
              </div>
            {:else if kategoriList.length === 0}
              <div class="flex flex-col items-center justify-center py-12 text-center min-h-[30vh] pointer-events-none">
                <div class="text-5xl mb-2">📂</div>
                <div class="text-base font-semibold text-gray-700 mb-1">Belum ada Kategori</div>
                <div class="text-sm text-gray-400">Silakan tambahkan kategori terlebih dahulu.</div>
              </div>
            {:else}
          <div class="flex flex-col gap-2">
            {#each kategoriList.filter(kat => kat.name.toLowerCase().includes(searchKategoriKeyword.trim().toLowerCase())) as kat}
              <div class="bg-blue-100 rounded-xl border border-blue-200 px-4 py-3 flex items-center justify-between shadow-sm hover:bg-blue-200 transition-all cursor-pointer" onclick={() => openKategoriForm(kat)}>
                <div class="flex flex-col">
                  <span class="font-semibold text-blue-900 text-base truncate mb-0.5">{kat.name}</span>
                  <span class="text-xs text-blue-700 truncate">{menus.filter(m => m.kategori_id === kat.id).length} menu</span>
                </div>
                <div class="ml-2">
                  <button class="p-3 rounded-full bg-red-50 hover:bg-red-100 border border-red-200" onclick={(e) => { e.stopPropagation(); confirmDeleteKategori(kat.id); }} aria-label="Hapus Kategori">
                    <svelte:component this={Trash} class="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
            {/if}
        </div>
      </div>
    </div>
  {:else if activeTab === 'ekstra'}
    <div transition:slide|local class="flex flex-col h-[calc(100vh-200px)]">
      <!-- Fixed Header Section -->
      <div class="flex-shrink-0 bg-white px-4">
        <!-- Search Bar -->
        <div class="relative flex items-center mb-3">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" class="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-base bg-white text-gray-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" placeholder="Cari tambahan..." bind:value={searchEkstra} />
        </div>
        <!-- Header Daftar Tambahan -->
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-bold text-gray-800">Daftar Tambahan</h2>
        </div>
      </div>
      
      <!-- Scrollable Tambahan List -->
      <div class="flex-1 overflow-y-auto">
        <div class="px-4 pb-6">
            {#if isLoadingEkstra}
              <div class="flex flex-col gap-2 min-h-screen">
                {#each Array(4) as _, i}
                  <div class="bg-gradient-to-br from-green-50 via-purple-50 to-green-100 animate-pulse rounded-xl shadow-md border border-green-200 px-4 py-3 flex items-center justify-between"></div>
                {/each}
              </div>
            {:else if ekstraList.length === 0}
              <div class="flex flex-col items-center justify-center py-12 text-center min-h-[30vh] pointer-events-none">
                <div class="text-5xl mb-2">➕</div>
                <div class="text-base font-semibold text-gray-700 mb-1">Belum ada Tambahan</div>
                <div class="text-sm text-gray-400">Silakan tambahkan tambahan terlebih dahulu.</div>
              </div>
            {:else}
          <div class="flex flex-col gap-2">
            {#each ekstraList.filter(ekstra => ekstra.name.toLowerCase().includes(searchEkstra.trim().toLowerCase())) as ekstra}
              <div class="bg-green-100 rounded-xl border border-green-200 px-4 py-3 flex items-center justify-between shadow-sm hover:bg-green-200 transition-all cursor-pointer" onclick={() => openEkstraForm(ekstra)}>
                <div class="flex flex-col">
                  <span class="font-semibold text-green-900 text-base truncate mb-0.5">{ekstra.name}</span>
                  <span class="text-xs text-green-700 truncate">Rp {ekstra.harga.toLocaleString('id-ID')}</span>
                </div>
                <div class="ml-2">
                  <button class="p-3 rounded-full bg-red-50 hover:bg-red-100 border border-red-200" onclick={(e) => { e.stopPropagation(); confirmDeleteEkstra(ekstra.id); }} aria-label="Hapus Tambahan">
                    <svelte:component this={Trash} class="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
            {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Modal untuk tambah/edit menu -->
{#if showMenuForm}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onclick={(e) => e.target === e.currentTarget && closeMenuForm()}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col animate-slideUpModal" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4">
        <h2 class="text-xl font-bold text-gray-800 text-center">{editMenuId ? 'Edit Menu' : 'Tambah Menu Baru'}</h2>
        </div>
      
      <!-- Scrollable Form Content -->
      <form id="menu-form" class="flex flex-col gap-6 p-6 overflow-y-auto flex-1" onsubmit={saveMenu} autocomplete="off">
          <!-- Preview Gambar Menu -->
          <div class="flex flex-col gap-3">
            <label class="font-semibold text-gray-700 text-sm">Gambar Menu</label>
            <div class="w-full">
              <div class="relative group cursor-pointer w-full" onclick={() => fileInputEl?.click()}>
                              {#if $menuForm.gambar}
                <div class="relative w-full">
                  <img src={$menuForm.gambar} alt="Preview Menu" class="w-full aspect-square object-cover rounded-xl border-2 border-gray-200 shadow-sm" />
                  <!-- Floating Delete Button -->
                  <button type="button" class="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all duration-200 z-10" onclick={(e) => { e.stopPropagation(); removeImage(); }}>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <div class="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
                    <div class="text-center">
                      <svg class="w-8 h-8 text-white mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span class="text-white text-sm font-medium">Klik untuk Ubah Gambar</span>
        </div>
                  </div>
                </div>
              {:else}
                  <div class="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 group-hover:bg-gray-100 group-hover:border-pink-300 transition-all duration-200">
                    <div class="text-center">
                      <svg class="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span class="text-base text-gray-500 font-medium">Klik untuk Upload Gambar</span>
                      <p class="text-xs text-gray-400 mt-1">PNG, JPG, atau GIF (Max. 5MB)</p>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
            <input type="file" accept="image/*" class="hidden" bind:this={fileInputEl} onchange={handleFileChange} />
          </div>

          <!-- Nama Menu -->
        <div class="flex flex-col gap-2">
            <label for="menu-name" class="font-semibold text-gray-700 text-sm">Nama Menu</label>
            <input type="text" id="menu-name" class="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all" bind:value={$menuForm.name} required placeholder="Contoh: Es Teh Manis" />
        </div>

          <!-- Harga -->
        <div class="flex flex-col gap-2">
            <label for="menu-price" class="font-semibold text-gray-700 text-sm">Harga</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Rp</span>
              <input type="text" id="menu-price" class="w-full border border-gray-300 rounded-xl pl-12 pr-4 py-3 text-base focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all" bind:value={$menuForm.price} oninput={formatRupiahInput} required placeholder="0" />
            </div>
          </div>

          <!-- Tipe Menu -->
          <div class="flex flex-col gap-3">
            <label class="font-semibold text-gray-700 text-sm">Tipe Menu</label>
            <div class="flex gap-3">
              <button type="button" class="flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all duration-200 {$menuForm.tipe === 'minuman' ? 'border-pink-500 bg-pink-500 text-white shadow-lg shadow-pink-200' : 'border-gray-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50'}" onclick={() => setMenuType('minuman')}>
                <div class="flex items-center justify-center gap-2">
                  <span class="text-base">🥤</span>
                  <span class="text-sm">Minuman</span>
                </div>
              </button>
              <button type="button" class="flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all duration-200 {$menuForm.tipe === 'makanan' ? 'border-pink-500 bg-pink-500 text-white shadow-lg shadow-pink-200' : 'border-gray-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50'}" onclick={() => setMenuType('makanan')}>
                <div class="flex items-center justify-center gap-2">
                  <span class="text-base">🍽️</span>
                  <span class="text-sm">Makanan</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Kategori -->
          <div class="flex flex-col gap-3">
            <label class="font-semibold text-gray-700 text-sm">Kategori</label>
            <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {#each kategoriList as kat}
                <button type="button" class="flex-shrink-0 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all duration-200 {$menuForm.kategori_id === kat.id ? 'bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-200' : 'bg-white text-gray-700 border-gray-200 hover:border-pink-300 hover:bg-pink-50'}" onclick={() => setMenuKategori($menuForm.kategori_id === kat.id ? '' : kat.id)}>
                  {kat.name}
                </button>
            {/each}
        </div>
          </div>

                  <!-- Tambahan -->
        <div class="flex flex-col gap-3">
          <label class="font-semibold text-gray-700 text-sm">Tambahan</label>
          <div class="grid grid-cols-2 gap-3">
            {#each ekstraList as ekstra}
              <button type="button" class="p-3 rounded-xl border-2 text-left transition-all duration-200 {$menuForm.ekstra_ids.includes(ekstra.id) ? 'border-pink-500 bg-pink-50 shadow-lg shadow-pink-100' : 'border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50'}" onclick={() => toggleEkstra(ekstra.id)}>
                <div class="font-medium text-sm text-gray-800 mb-0.5">{ekstra.name}</div>
                <div class="text-xs text-pink-600 font-semibold">+Rp {ekstra.harga?.toLocaleString('id-ID')}</div>
              </button>
            {/each}
        </div>
        </div>
      </form>

        <!-- Fixed Action Buttons -->
        <div class="flex-shrink-0 flex gap-3 p-6 border-t border-gray-100 bg-white">
          <button type="submit" form="menu-form" class="flex-1 bg-pink-500 text-white py-3 rounded-xl font-semibold hover:bg-pink-600 active:bg-pink-700 transition-all duration-200 shadow-lg shadow-pink-200">
            {editMenuId ? 'Update Menu' : 'Simpan Menu'}
          </button>
          <button type="button" class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 active:bg-gray-300 transition-all duration-200" onclick={closeMenuForm}>
            Batal
          </button>
        </div>
    </div>
  </div>
{/if}

<!-- Modal untuk tambah/edit kategori -->
{#if showKategoriDetailModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={(e) => e.target === e.currentTarget && closeKategoriDetailModal()}>
    <div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col animate-slideUpModal" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="flex-shrink-0 p-6 border-b border-gray-100">
        <h2 class="text-xl font-bold text-gray-800 text-center">{kategoriDetail ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <form id="kategori-form" class="flex flex-col gap-6" onsubmit={saveKategoriDetail} autocomplete="off">
          <!-- Nama Kategori -->
        <div class="flex flex-col gap-2">
            <label for="kategori-name" class="font-semibold text-gray-700 text-sm mb-1">Nama Kategori</label>
            <input 
              type="text" 
              id="kategori-name"
              class="w-full border border-blue-200 rounded-xl px-5 py-3 text-base focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all shadow-sm bg-white placeholder-gray-400" 
              bind:value={kategoriDetailName} 
              required 
              placeholder="Masukkan nama kategori"
            />
        </div>

          <!-- Menu dalam Kategori -->
        <div class="flex flex-col gap-2">
            <label class="font-semibold text-gray-700 text-sm mb-1">Menu dalam Kategori</label>
            <div class="flex flex-wrap gap-2 min-h-[48px]">
              {#if selectedMenuIds.length > 0}
                {#each menus.filter(menu => selectedMenuIds.includes(menu.id)) as menu (menu.id)}
                  <button
                    type="button"
                    class="inline-flex items-center rounded-full px-4 py-2 bg-blue-100 text-blue-700 font-medium shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                    title={menu.name}
                    onclick={() => toggleMenuInKategoriRealtime(menu.id)}
                    in:fly={{ y: 16, duration: 180 }} out:fly={{ y: 16, duration: 180 }}
                  >
                    {menu.name}
                  </button>
            {/each}
              {:else}
                <span class="text-gray-400 text-sm italic">Belum ada menu dalam kategori ini</span>
              {/if}
          </div>
        </div>

          <!-- Menu non Kategori -->
          <div class="flex flex-col gap-2">
            <label class="font-semibold text-gray-700 text-sm mb-1">Menu non Kategori</label>
            <div class="flex flex-wrap gap-2 min-h-[48px]">
              {#if unselectedMenuIds.length > 0}
                {#each menus.filter(menu => unselectedMenuIds.includes(menu.id)) as menu (menu.id)}
                  <button
                    type="button"
                    class="inline-flex items-center rounded-full px-4 py-2 bg-white border border-blue-200 text-blue-500 font-medium shadow-sm transition-all hover:bg-blue-50 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                    title={menu.name}
                    onclick={() => toggleMenuInKategoriRealtime(menu.id)}
                    in:fly={{ y: 16, duration: 180 }} out:fly={{ y: 16, duration: 180 }}
                  >
                    {menu.name}
                  </button>
                {/each}
              {:else}
                <span class="text-gray-400 text-sm italic">Semua menu sudah masuk kategori</span>
              {/if}
            </div>
        </div>
      </form>
      </div>

      <!-- Fixed Action Buttons -->
      <div class="flex-shrink-0 flex gap-3 p-6 border-t border-gray-100 bg-white">
        <button type="submit" form="kategori-form" class="flex-1 bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-200">
          {kategoriDetail ? 'Update Kategori' : 'Simpan Kategori'}
        </button>
        <button type="button" class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 active:bg-gray-300 transition-all duration-200" onclick={closeKategoriDetailModal}>
          Batal
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal untuk tambah/edit ekstra -->
{#if showEkstraForm}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={(e) => e.target === e.currentTarget && (showEkstraForm = false, ekstraForm = { name: '', harga: '' }, editEkstraId = null)}>
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 relative animate-slideUpModal" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-bold text-gray-800 mb-4 text-center">{editEkstraId ? 'Edit Tambahan' : 'Tambah Tambahan'}</h2>
      <form class="flex flex-col gap-4" onsubmit={saveEkstra} autocomplete="off">
        <div class="flex flex-col gap-2">
          <label for="ekstra-name" class="font-semibold text-gray-700">Nama Tambahan</label>
          <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" bind:value={ekstraForm.name} required />
        </div>
        <div class="flex flex-col gap-2">
          <label for="ekstra-harga" class="font-semibold text-gray-700">Harga Tambahan</label>
          <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" bind:value={ekstraForm.harga} required />
        </div>
        <div class="flex gap-2 mt-4">
          <button type="submit" class="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors">Simpan</button>
          <button type="button" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors" onclick={() => { showEkstraForm = false; ekstraForm = { name: '', harga: '' }; editEkstraId = null; }}>Batal</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal konfirmasi hapus menu -->
{#if showDeleteModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center animate-slideUpModal">
      <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Menu?</h2>
      <p class="text-gray-500 text-sm mb-6 text-center">Menu yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus menu ini?</p>
      <div class="flex gap-3 w-full">
        <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" onclick={cancelDeleteMenu}>Batal</button>
        <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" onclick={doDeleteMenu}>Hapus</button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal konfirmasi hapus kategori -->
{#if showDeleteKategoriModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center animate-slideUpModal">
      <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Kategori?</h2>
      <p class="text-gray-500 text-sm mb-6 text-center">Kategori yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus kategori ini?</p>
      <div class="flex gap-3 w-full">
        <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" onclick={cancelDeleteKategori}>Batal</button>
        <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" onclick={doDeleteKategori}>Hapus</button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal konfirmasi hapus ekstra -->
{#if showDeleteEkstraModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center animate-slideUpModal">
      <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Ekstra?</h2>
      <p class="text-gray-500 text-sm mb-6 text-center">Ekstra yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus ekstra ini?</p>
      <div class="flex gap-3 w-full">
        <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" onclick={cancelDeleteEkstra}>Batal</button>
        <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" onclick={doDeleteEkstra}>Hapus</button>
      </div>
    </div>
  </div>
{/if}

<!-- Notifikasi floating (toast) -->
{#if showNotifModal}
  <div class="fixed top-20 left-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out" style="transform: translateX(-50%);">
    {notifModalMsg}
    <button class="ml-4 underline" onclick={() => showNotifModal = false}>Tutup</button>
  </div>
{/if}

<!-- Komponen upload/crop gambar menu -->
{#if showCropperDialog}
  <CropperDialog src={cropperDialogImage} open={true} on:done={handleCropperDone} on:cancel={handleCropperCancel} />
{/if}
</div>

<style>
@keyframes slideUpModal {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-slideUpModal {
  animation: slideUpModal 0.32s cubic-bezier(.4,0,.2,1);
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>