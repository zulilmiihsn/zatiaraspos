<script lang="ts">
import { onMount, onDestroy } from 'svelte';
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
import { fly, fade } from 'svelte/transition';
import { slide } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { supabase } from '$lib/database/supabaseClient';
import { produkCache } from '$lib/stores/produkCache';
import { kategoriCache } from '$lib/stores/kategoriCache';
import { tambahanCache } from '$lib/stores/tambahanCache';
import { saveMenuOffline, getPendingMenus, deleteMenuOffline, syncDeleteMenu } from '$lib/stores/transaksiOffline';
import ModalSheet from '$lib/components/shared/ModalSheet.svelte';
import { userRole, userProfile, setUserRole } from '$lib/stores/userRole';

let currentUser = null;
let currentUserRole = '';
let userProfileData = null;
let currentPage = 'main'; // 'main', 'menu', 'security'
let activeTab = 'menu'; // 'menu', 'kategori', 'ekstra'

// Data Menu
let menus = [];

// Untuk track error gambar per menu
let imageError: Record<string, boolean> = {};

// Data Kategori
let kategoriList = [];

// Data Ekstra Template
let ekstraList = [];

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
let menuTouchStartX = 0;
let menuTouchStartY = 0;
let menuTouchStartTime = 0;
let menuSwipeDetected = false;

// State untuk modal hapus kategori
let showDeleteKategoriModal = false;
let kategoriIdToDelete: number|null = null;

// State untuk modal edit/detail kategori
let showKategoriDetailModal = false;
let kategoriDetail = null;
let selectedMenuIds: number[] = [];
let unselectedMenuIds: number[] = [];

// Tambahkan state untuk input nama kategori
let kategoriDetailName = '';

// State untuk search kategori
let searchKategoriKeyword = '';

// State untuk tab ekstra
let searchEkstra = '';
let showDeleteEkstraModal = false;
let ekstraIdToDelete = null;

// Tambahkan state untuk tap vs swipe kategori
let kategoriTouchStartX = 0;
let kategoriTouchStartY = 0;
let kategoriTouchStartTime = 0;
let kategoriSwipeDetected = false;

// Tambahkan state untuk tap vs swipe ekstra
let ekstraTouchStartX = 0;
let ekstraTouchStartY = 0;
let ekstraTouchStartTime = 0;
let ekstraSwipeDetected = false;

// Deteksi perangkat touch
let isTouchDevice = false;
if (typeof window !== 'undefined') {
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

let justTapped = false;

let oldUsername = '';
let newUsername = '';
let oldPassword = '';
let newPassword = '';
let confirmPassword = '';
let userPassError = '';

let oldPin = '';
let newPin = '';
let confirmPin = '';
let lockedPages: string[] = ['laporan', 'beranda'];
let pinError = '';

let pin = '';

let isGridView = true;

let showNotifModal = false;
let notifModalMsg = '';
let notifModalType = 'warning'; // 'warning' | 'success' | 'error'

// Load saved settings on mount
onMount(async () => {
  // Ambil session Supabase
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (userId) {
    const { data: profile } = await supabase
      .from('profil')
      .select('role')
      .eq('id', userId)
      .single();
    userProfileData = profile;
    if (profile) {
      setUserRole(profile.role, profile);
    }
  }
  // Jika role belum ada di store, coba validasi dengan Supabase
  if (!currentUserRole) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profil')
        .select('role, username')
        .eq('id', session.user.id)
        .single();
      if (profile) {
        setUserRole(profile.role, profile);
      }
    }
  }
  await fetchSecuritySettings();
  await fetchMenus();
  await fetchKategori();
  await fetchEkstra();
  
  // Sync otomatis saat online
  if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
      // Clear cache untuk memaksa refresh data
      clearMasterCache();
  await fetchMenus();
  await fetchKategori();
  await fetchEkstra();
    });
  }
});

async function fetchSecuritySettings() {
  const { data, error } = await supabase.from('pengaturan_keamanan').select('*').single();
  if (!error && data) {
    pin = data.pin;
    lockedPages = data.locked_pages || ['laporan', 'beranda'];
  }
}

let showPinModal = false;
let pinInput = '';
let pinModalError = '';

function handleTabTouchStart(e: TouchEvent) {
  // Jangan tangani swipe jika target adalah elemen interaktif
  const target = e.target as HTMLElement;
  if (target.closest('input, button, select, textarea, [role="button"], [tabindex]')) {
    return;
  }
  // Reset touch coordinates
  touchStartX = e.touches[0].clientX;
}
function handleTabTouchMove(e: TouchEvent) {
  // Update touch coordinates
  touchEndX = e.touches[0].clientX;
}
function handleTabTouchEnd(e: TouchEvent) {
  const swipeThreshold = window.innerWidth * 0.25; // kurangi threshold dari 0.4 ke 0.25
  if (Math.abs(touchEndX - touchStartX) < 10) return; // kurangi threshold tap dari 20 ke 10
  if (Math.abs(touchEndX - touchStartX) > swipeThreshold) {
    if (touchEndX - touchStartX < 0) {
      // Swipe kiri: next tab
      if (activeTab === 'menu') activeTab = 'kategori';
      else if (activeTab === 'kategori') activeTab = 'ekstra';
      // Jika sudah di 'ekstra', jangan pindah tab
    } else {
      // Swipe kanan: prev tab
      if (activeTab === 'ekstra') activeTab = 'kategori';
      else if (activeTab === 'kategori') activeTab = 'menu';
      // Jika sudah di 'menu', jangan pindah tab
    }
  }
}

function handleKategoriTouchStart(e) {
  kategoriSwipeDetected = false;
  kategoriTouchStartX = e.touches[0].clientX;
  kategoriTouchStartY = e.touches[0].clientY;
  kategoriTouchStartTime = Date.now();
}
function handleKategoriTouchMove(e) {
  const deltaX = e.touches[0].clientX - kategoriTouchStartX;
  if (Math.abs(deltaX) > 40) {
    kategoriSwipeDetected = true;
  }
}
function handleKategoriTouchEnd(e, kat) {
  const deltaX = e.changedTouches[0].clientX - kategoriTouchStartX;
  const deltaY = e.changedTouches[0].clientY - kategoriTouchStartY;
  const duration = Date.now() - kategoriTouchStartTime;
  const swipeThreshold = window.innerWidth * 0.25; // konsisten dengan threshold tab
  const tapThreshold = 10; // px, lebih toleran
  if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold && duration < 300) {
    e.stopPropagation(); // block agar tidak bubble ke parent
    openKategoriForm(kat);
    window.addEventListener('click', blockNextClick, true);
  }
  // Jika swipe terdeteksi, biarkan event bubble ke handler tab
}

function handleMenuTouchStart(e) {
  menuSwipeDetected = false;
  menuTouchStartX = e.touches[0].clientX;
  menuTouchStartY = e.touches[0].clientY;
  menuTouchStartTime = Date.now();
}
function handleMenuTouchMove(e) {
  const deltaX = e.touches[0].clientX - menuTouchStartX;
  if (Math.abs(deltaX) > 40) {
    // SWIPE: biarkan handler swipe tab global yang jalan, JANGAN buka modal
    // Tidak perlu return, biarkan event bubble ke parent
  }
}
function handleMenuTouchEnd(e, menu) {
  const deltaX = e.changedTouches[0].clientX - menuTouchStartX;
  const deltaY = e.changedTouches[0].clientY - menuTouchStartY;
  const duration = Date.now() - menuTouchStartTime;
  const swipeThreshold = window.innerWidth * 0.25; // konsisten dengan threshold tab
  const tapThreshold = 10; // px, lebih toleran
  if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold && duration < 300) {
    e.stopPropagation(); // block agar tidak bubble ke parent
    openMenuForm(menu);
    window.addEventListener('click', blockNextClick, true);
  }
  // Jika swipe terdeteksi, biarkan event bubble ke handler tab
}

onMount(() => {
  currentUser = auth.getCurrentUser();
  currentUserRole = currentUser?.role || '';
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
});

onDestroy(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
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

async function fetchMenus() {
  try {
    const { data, error } = await supabase.from('produk').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    menus = data || [];
  } catch (error) {
    notifModalMsg = 'Gagal mengambil data menu: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
}

async function fetchKategori() {
  try {
    const { data, error } = await supabase.from('kategori').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    kategoriList = data || [];
  } catch (error) {
    notifModalMsg = 'Gagal mengambil data kategori: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
}

async function fetchEkstra() {
  try {
    const { data, error } = await supabase.from('tambahan').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    ekstraList = data || [];
  } catch (error) {
    notifModalMsg = 'Gagal mengambil data ekstra: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
}

async function uploadMenuImage(file, menuId) {
  const MAX_SIZE_MB = 2;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 2MB. Silakan pilih gambar yang lebih kecil.');
  }
  const ext = file.name.split('.').pop();
  const filePath = `menu-${menuId}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('gambar-menu').upload(filePath, file, { upsert: true });
  if (error) {
    console.error('Supabase uploadMenuImage error:', error);
    throw error;
  }
  // Dapatkan public URL
  const { data: publicUrlData } = supabase.storage.from('gambar-menu').getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

async function saveMenu() {
  // Validasi field harga
  if (!menuForm.harga || menuForm.harga.toString().trim() === '') {
    notifModalMsg = 'Harga menu wajib diisi!';
    notifModalType = 'warning';
    showNotifModal = true;
    return;
  }
  let imageUrl = menuForm.gambar;
  // Jika user memilih file baru (bukan string URL)
  if (selectedImage && selectedImage instanceof File) {
    try {
      imageUrl = await uploadMenuImage(selectedImage, editMenuId || Date.now());
    } catch (err) {
      notifModalMsg = 'Gagal upload gambar: ' + (err?.message || err?.error_description || 'Unknown error');
      notifModalType = 'error';
      showNotifModal = true;
      return;
    }
  }
  const payload = { ...menuForm, gambar: imageUrl, harga: parseInt(menuForm.harga) };
  let result;
  try {
  if (editMenuId) {
    result = await supabase.from('produk').update(payload).eq('id', editMenuId);
  } else {
    result = await supabase.from('produk').insert([payload]);
  }
  if (result.error) {
      throw result.error;
    }
  } catch (error) {
    // Jika offline, simpan ke IndexedDB
    if (navigator.onLine === false || error.message?.includes('fetch')) {
      try {
        await saveMenuOffline(payload);
        notifModalMsg = 'Menu berhasil disimpan offline. Akan tersinkronisasi saat online.';
        notifModalType = 'success';
        showNotifModal = true;
      } catch (offlineError) {
        notifModalMsg = 'Gagal menyimpan menu offline: ' + offlineError.message;
        notifModalType = 'error';
        showNotifModal = true;
        return;
      }
    } else {
      notifModalMsg = 'Gagal menyimpan menu: ' + error.message;
      notifModalType = 'error';
      showNotifModal = true;
      return;
    }
  }
  showMenuForm = false;
  await fetchMenus();
  clearMasterCache();
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
    // Hapus gambar dari storage jika ada
    const menu = menus.find(m => m.id === menuIdToDelete);
    if (menu?.gambar) {
      const path = menu.gambar.split('/').pop();
      await supabase.storage.from('gambar-menu').remove([path]);
    }
      
      // Coba hapus dari database online
      const { error } = await supabase.from('produk').delete().eq('id', menuIdToDelete);
      
      if (error) {
        throw error;
      }
      
      // Jika berhasil hapus online, sync delete
      await syncDeleteMenu(menuIdToDelete);
      
      notifModalMsg = 'Menu berhasil dihapus!';
      notifModalType = 'success';
      showNotifModal = true;
      
    } catch (error) {
      // Jika offline atau error, hapus dari pending menus
      if (navigator.onLine === false || error.message?.includes('fetch')) {
        try {
          await deleteMenuOffline(menuIdToDelete);
          notifModalMsg = 'Menu berhasil dihapus offline. Akan tersinkronisasi saat online.';
          notifModalType = 'success';
          showNotifModal = true;
        } catch (offlineError) {
          notifModalMsg = 'Gagal menghapus menu offline: ' + offlineError.message;
          notifModalType = 'error';
          showNotifModal = true;
          return;
        }
      } else {
        notifModalMsg = 'Gagal menghapus menu: ' + error.message;
        notifModalType = 'error';
        showNotifModal = true;
        return;
      }
    }
    
    showDeleteModal = false;
    menuIdToDelete = null;
    await fetchMenus();
    clearMasterCache();
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

// Kategori functions
function openKategoriForm(kat) {
  if (!kat) {
    // Kategori baru
    kategoriDetail = null;
    showKategoriDetailModal = true;
    kategoriDetailName = '';
    selectedMenuIds = [];
    unselectedMenuIds = menus.filter(m => !m.kategori).map(m => m.id);
    return;
  }
  kategoriDetail = kat;
  showKategoriDetailModal = true;
  kategoriDetailName = kat.name;
  // Menu yang sudah masuk kategori (berdasarkan field kategori di produk)
  selectedMenuIds = menus.filter(m => m.kategori === kat.name).map(m => m.id);
  // Menu non-kategori
  unselectedMenuIds = menus.filter(m => !m.kategori || m.kategori === '').map(m => m.id).filter(id => !selectedMenuIds.includes(id));
}

function closeKategoriDetailModal() {
  showKategoriDetailModal = false;
  kategoriDetail = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
}

function toggleMenuInKategori(id) {
  if (selectedMenuIds.includes(id)) {
    selectedMenuIds = selectedMenuIds.filter(mid => mid !== id);
    unselectedMenuIds = [id, ...unselectedMenuIds];
  } else {
    unselectedMenuIds = unselectedMenuIds.filter(mid => mid !== id);
    selectedMenuIds = [id, ...selectedMenuIds];
  }
}

async function saveKategoriDetail() {
  if (kategoriDetail) {
    // Update nama kategori
    const { error } = await supabase.from('kategori').update({ name: kategoriDetailName }).eq('id', kategoriDetail.id);
    if (error) {
      console.error('Supabase saveKategoriDetail error:', error);
      alert('Gagal menyimpan kategori: ' + error.message);
    }
    // Update kategori pada produk
    await updateMenusKategori(kategoriDetailName, selectedMenuIds, kategoriDetail.name);
  } else {
    // INSERT kategori baru
    const { data, error } = await supabase.from('kategori').insert([{ name: kategoriDetailName }]).select();
    if (error) {
      console.error('Supabase insertKategori error:', error);
      alert('Gagal menambah kategori: ' + error.message);
    }
    // Update kategori pada produk
    await updateMenusKategori(kategoriDetailName, selectedMenuIds, null);
  }
  showKategoriDetailModal = false;
  kategoriDetail = null;
  await fetchKategori();
  await fetchMenus();
  clearMasterCache();
}

// Update kategori pada tabel menu/products
async function updateMenusKategori(namaKategori, menuIdsBaru, namaKategoriLama) {
  // Set kategori pada menu yang baru masuk kategori
  for (const id of menuIdsBaru) {
    await supabase.from('produk').update({ kategori: namaKategori }).eq('id', id);
  }
  // Hapus kategori pada menu yang sebelumnya ada tapi sekarang tidak
  if (namaKategoriLama) {
    const produkLama = menus.filter(m => m.kategori === namaKategoriLama && !menuIdsBaru.includes(m.id));
    for (const m of produkLama) {
      await supabase.from('produk').update({ kategori: null }).eq('id', m.id);
    }
  }
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
    // Ambil nama kategori yang akan dihapus
    const kategori = kategoriList.find(k => k.id === kategoriIdToDelete);
    const kategoriName = kategori?.name || '';
    await supabase.from('kategori').delete().eq('id', kategoriIdToDelete);
    // Update semua produk yang punya kategori ini menjadi null
    if (kategoriName) {
      await supabase.from('produk').update({ kategori: null }).eq('kategori', kategoriName);
    }
    showDeleteKategoriModal = false;
    kategoriIdToDelete = null;
    await fetchKategori();
    await fetchMenus();
    clearMasterCache();
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

// Ekstra functions
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
      const { error } = await supabase
        .from('tambahan')
        .update({ 
          name: ekstraForm.name,
          harga: harga
        })
        .eq('id', editEkstraId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('tambahan')
        .insert([{ 
          name: ekstraForm.name,
          harga: harga
        }]);
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
    await supabase.from('tambahan').delete().eq('id', ekstraIdToDelete);
    showDeleteEkstraModal = false;
    ekstraIdToDelete = null;
    await fetchEkstra();
    clearMasterCache();
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
  selectedImage = file;
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

function handleImgError(id: string) {
  imageError = { ...imageError, [id]: true };
}

// Format harga input
function formatRupiahInput(e) {
  let value = e.target.value.replace(/[^\d]/g, '');
  value = value ? parseInt(value).toLocaleString('id-ID') : '';
  menuForm.harga = value;
}

// Tambahkan state untuk tap vs swipe ekstra
function handleEkstraTouchStart(e) {
  ekstraSwipeDetected = false;
  ekstraTouchStartX = e.touches[0].clientX;
  ekstraTouchStartY = e.touches[0].clientY;
  ekstraTouchStartTime = Date.now();
}
function handleEkstraTouchMove(e) {
  const deltaX = e.touches[0].clientX - ekstraTouchStartX;
  if (Math.abs(deltaX) > 40) {
    ekstraSwipeDetected = true;
  }
}
function handleEkstraTouchEnd(e, ekstra) {
  const deltaX = e.changedTouches[0].clientX - ekstraTouchStartX;
  const deltaY = e.changedTouches[0].clientY - ekstraTouchStartY;
  const duration = Date.now() - ekstraTouchStartTime;
  const swipeThreshold = window.innerWidth * 0.25; // konsisten dengan threshold tab
  const tapThreshold = 10; // px, lebih toleran
  if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold && duration < 300) {
    e.stopPropagation(); // block agar tidak bubble ke parent
    openEkstraForm(ekstra);
    window.addEventListener('click', blockNextClick, true);
  }
  // Jika swipe terdeteksi, biarkan event bubble ke handler tab
}

// Handler universal untuk desktop click
function handleKategoriClick(event, kat) {
  if (isTouchDevice && justTapped) {
    event.preventDefault();
    return;
  }
  openKategoriForm(kat);
}
function handleMenuClick(event, menu) {
  if (isTouchDevice && justTapped) {
    event.preventDefault();
    return;
  }
  openMenuForm(menu);
}
function handleEkstraClick(event, ekstra) {
  if (isTouchDevice && justTapped) {
    event.preventDefault();
    return;
  }
  openEkstraForm(ekstra);
}

function blockNextClick(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
}

async function handleChangeUserPass(e) {
  e.preventDefault();
  userPassError = '';
  if (!oldUsername || !newUsername || !oldPassword || !newPassword || !confirmPassword) {
    userPassError = 'Semua field wajib diisi.';
    return;
  }
  if (newPassword !== confirmPassword) {
    userPassError = 'Konfirmasi password tidak cocok.';
    return;
  }
  if (oldUsername === newUsername) {
    userPassError = 'Username baru tidak boleh sama dengan username lama.';
    return;
  }
  // Ambil userId dari session
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    userPassError = 'Session tidak valid.';
    return;
  }
  // Update username di profiles (pakai username)
  const { error: usernameError } = await supabase.from('profil').update({ username: newUsername }).eq('id', userId);
  if (usernameError) {
    userPassError = 'Gagal update nama user.';
    return;
  }
  // Update password via Supabase Auth
  const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
  if (passError) {
    userPassError = 'Gagal update password.';
    return;
  }
  userPassError = '';
  alert('Perubahan username/password berhasil disimpan.');
}

async function handleChangePin() {
  pinError = '';
  if (!oldPin || !newPin || !confirmPin) {
    pinError = 'Semua field wajib diisi.';
    return;
  }
  if (newPin !== confirmPin) {
    pinError = 'Konfirmasi PIN tidak cocok.';
    return;
  }
  if (!/^[0-9]{4,6}$/.test(newPin)) {
    pinError = 'PIN harus 4-6 digit angka.';
    return;
  }
  // Cek PIN lama
  if (oldPin !== pin) {
    pinError = 'PIN lama salah.';
    return;
  }
  // Update ke Supabase
  await supabase.from('pengaturan_keamanan').update({ pin: newPin, locked_pages: lockedPages }).eq('id', 1);
  pin = newPin;
  pinError = '';
  alert('Perubahan PIN & pengaturan kunci berhasil disimpan.');
}

function handlePinSubmit() {
  pinModalError = '';
  if (pinInput !== '1234') { // Dummy PIN check
    pinModalError = 'PIN salah.';
    return;
  }
  showPinModal = false;
  alert('Akses halaman berhasil dibuka (dummy).');
}

function closeMenuForm() {
  showMenuForm = false;
  editMenuId = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
}

function clearMasterCache() {
  localStorage.removeItem('produkCache');
  localStorage.removeItem('kategoriCache');
  localStorage.removeItem('tambahanCache');
  produkCache.set({ data: null, lastFetched: 0 });
  kategoriCache.set({ data: null, lastFetched: 0 });
  tambahanCache.set({ data: null, lastFetched: 0 });
}

async function saveKategori() {
  try {
    if (editKategoriId) {
      const { error } = await supabase
        .from('kategori')
        .update({ name: kategoriForm.name })
        .eq('id', editKategoriId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('kategori')
        .insert([{ name: kategoriForm.name }]);
      if (error) throw error;
    }
    await fetchKategori();
    showKategoriForm = false;
    kategoriForm = { name: '' };
    editKategoriId = null;
  } catch (error) {
    notifModalMsg = 'Gagal menyimpan kategori: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
}

async function addKategori() {
  if (!kategoriForm.name.trim()) {
    notifModalMsg = 'Nama kategori wajib diisi';
    notifModalType = 'warning';
    showNotifModal = true;
    return;
  }
  try {
    const { error } = await supabase
      .from('kategori')
      .insert([{ name: kategoriForm.name }]);
    if (error) throw error;
    await fetchKategori();
    kategoriForm = { name: '' };
  } catch (error) {
    notifModalMsg = 'Gagal menambah kategori: ' + error.message;
    notifModalType = 'error';
    showNotifModal = true;
  }
}

async function saveUserPass() {
  if (!oldUsername.trim() || !newUsername.trim() || !oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
    userPassError = 'Semua field wajib diisi.';
    return;
  }
  
  if (newPassword !== confirmPassword) {
    userPassError = 'Konfirmasi password tidak cocok.';
    return;
  }
  
  if (newPassword.length < 6) {
    userPassError = 'Password minimal 6 karakter.';
    return;
  }

  try {
    // Simulasi update username/password
    await new Promise(resolve => setTimeout(resolve, 1000));
    notifModalMsg = 'Perubahan username/password berhasil disimpan.';
    notifModalType = 'success';
    showNotifModal = true;
    
    oldUsername = '';
    newUsername = '';
    oldPassword = '';
    newPassword = '';
    confirmPassword = '';
    userPassError = '';
  } catch (error) {
    userPassError = 'Gagal menyimpan perubahan: ' + error.message;
  }
}

async function savePinSettings() {
  if (!oldPin.trim() || !newPin.trim() || !confirmPin.trim()) {
    pinError = 'Semua field wajib diisi.';
    return;
  }
  
  if (newPin !== confirmPin) {
    pinError = 'Konfirmasi PIN tidak cocok.';
    return;
  }
  
  if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
    pinError = 'PIN harus 4-6 digit angka.';
    return;
  }
  
  if (oldPin !== '1234') { // Simulasi PIN lama
    pinError = 'PIN lama salah.';
    return;
  }

  try {
    // Simulasi update PIN
    await new Promise(resolve => setTimeout(resolve, 1000));
    notifModalMsg = 'Perubahan PIN & pengaturan kunci berhasil disimpan.';
    notifModalType = 'success';
    showNotifModal = true;
    
    oldPin = '';
    newPin = '';
    confirmPin = '';
    pinError = '';
  } catch (error) {
    pinError = 'Gagal menyimpan perubahan: ' + error.message;
  }
}

function openPageAccess() {
  notifModalMsg = 'Akses halaman berhasil dibuka (dummy).';
  notifModalType = 'success';
  showNotifModal = true;
}
</script>

<svelte:head>
  <title>Admin Panel - ZatiarasPOS</title>
</svelte:head>

{#if currentUserRole === 'admin' || currentUserRole === 'pemilik'}
  <div class="min-h-screen bg-gray-50 flex flex-col page-content">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="flex items-center">
          <button onclick={() => currentPage === 'main' ? goto('/pengaturan') : currentPage = 'main'} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
            <svelte:component this={ArrowLeft} class="w-5 h-5 text-gray-600" />
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
              <svelte:component this={Utensils} class="w-5 h-5 text-pink-500" />
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
              <svelte:component this={Shield} class="w-5 h-5 text-blue-500" />
              <h3 class="text-sm font-semibold text-gray-800 leading-tight">
                Ganti Keamanan
              </h3>
            </div>
            <p class="text-xs text-gray-500 leading-tight">Ubah password dan pengaturan keamanan</p>
          </button>
          

        </div>
      </div>
    {/if}

    <!-- Menu Management Page -->
    {#if currentPage === 'menu'}
      <!-- Tambahkan handler swipe tab di container utama agar swipe bisa di area kosong -->
      <div class="w-full max-w-4xl mx-auto px-4 pb-6 pt-2 h-full flex flex-col overflow-x-hidden flex-1 min-h-0">
        <!-- Tab Navigation -->
        <div class="relative flex bg-white rounded-xl p-1 shadow-sm border border-gray-200 mb-4 mt-0 overflow-hidden">
          <!-- Indicator Slide & Color Transition -->
          <div
            class="absolute top-1 left-1 h-[calc(100%-0.5rem)] w-1/3 rounded-lg z-0 transition-transform transition-colors duration-300 ease-in-out"
            style="
              transform: translateX({activeTab === 'menu' ? '0%' : activeTab === 'kategori' ? '100%' : '200%'});
              background: {activeTab === 'menu' ? '#ec4899' : activeTab === 'kategori' ? '#3b82f6' : '#22c55e'};
            "
          ></div>
          <button 
            class="flex-1 flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 {activeTab === 'menu' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}"
            onclick={() => { activeTab = 'menu'; }}
          >
            <svelte:component this={Utensils} class="w-4 h-4" />
            Menu
          </button>
          <button 
            class="flex-1 flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 {activeTab === 'kategori' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}"
            onclick={() => { activeTab = 'kategori'; }}
          >
            <svelte:component this={Tag} class="w-4 h-4" />
            Kategori
          </button>
          <button 
            class="flex-1 flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 {activeTab === 'ekstra' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}"
            onclick={() => { activeTab = 'ekstra'; }}
          >
            <svelte:component this={Coffee} class="w-4 h-4" />
            Ekstra
          </button>
        </div>

        {#if activeTab === 'menu'}
        <!-- Handler swipe tab untuk tab menu -->
        <div class="flex-1 w-full"
          ontouchstart={handleTabTouchStart}
          ontouchmove={handleTabTouchMove}
          ontouchend={handleTabTouchEnd}
          style="touch-action: pan-y;"
        >
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
              onblur={() => { touchStartX = 0; touchEndX = 0; }}
            />
          </div>
        </div>

          <!-- Daftar Menu & Badge -->
          <div class="flex items-center justify-between gap-2 mb-2 -mt-[8px] px-0">
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold text-gray-800">Daftar Menu</h2>
              <span class="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full text-xs font-medium">{filteredMenus.length} menu</span>
            </div>
            <button
              class="p-2 rounded-lg border border-gray-200 bg-white hover:bg-pink-50 transition-colors flex items-center justify-center"
              onclick={() => { isGridView = !isGridView; }}
              aria-label={isGridView ? 'Tampilkan List' : 'Tampilkan Grid'}
              type="button"
            >
              {#if isGridView}
                <!-- Icon List -->
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              {:else}
                <!-- Icon Grid -->
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>
              {/if}
            </button>
          </div>
          <!-- Kategori Filter -->
          <div class="flex gap-1.5 overflow-x-auto pb-0 pt-0 px-0 border-b border-gray-100 mb-4"
            style="scrollbar-width:none;-ms-overflow-style:none;"
          >
          <button 
              class="min-w-[70px] w-auto max-w-full px-2.5 py-2 rounded-md font-medium transition-colors whitespace-nowrap text-xs {selectedKategori === 'Semua' ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
              style="max-width:fit-content"
              onclick={() => { selectedKategori = 'Semua'; touchStartX = 0; touchEndX = 0; }}
          >
            Semua
          </button>
          {#if kategoriList.length === 0}
            <div class="flex items-center gap-2 h-[32px] px-2 text-xs text-gray-400">
              <span class="text-base" style="position:relative;top:-2px;">📁</span>
              <span>Belum ada Kategori</span>
            </div>
          {:else}
          {#each getKategoriNames() as kategori}
            <button 
                  class="w-full px-2.5 py-2 rounded-md font-medium transition-colors whitespace-nowrap text-xs {selectedKategori === kategori ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
                  onclick={() => { selectedKategori = kategori; touchStartX = 0; touchEndX = 0; }}
            >
              {kategori}
            </button>
          {/each}
          {/if}
        </div>
        <!-- Menu Grid Scrollable -->
        <div class="flex-1 overflow-y-auto pb-16 w-full"
          style="scrollbar-width:none;-ms-overflow-style:none;touch-action:pan-y;"
        >
          {#if selectedKategori === 'Semua' && filteredMenus.length === 0}
            <div class="flex flex-col justify-center items-center min-h-[200px] w-full text-gray-400 font-medium text-base text-center">
              Belum ada menu.<br />Klik tombol + untuk menambah.
            </div>
          {:else if selectedKategori !== 'Semua' && filteredMenus.length === 0}
            <div class="flex flex-col justify-center items-center min-h-[200px] w-full text-gray-400 font-medium text-base text-center">
              Belum ada menu di kategori ini.
            </div>
          {/if}
          {#if isGridView}
            <div class="grid grid-cols-2 gap-2 w-full" transition:slide={{ duration: 250 }}>
              {#each filteredMenus as menu}
                <div class="bg-white rounded-xl shadow border border-gray-100 p-2 flex flex-col items-center relative group cursor-pointer hover:bg-pink-50 transition-colors"
                  data-menu-card
                  ontouchstart={handleMenuTouchStart}
                  ontouchmove={handleMenuTouchMove}
                  ontouchend={(e) => handleMenuTouchEnd(e, menu)}
                  onclick={(e) => handleMenuClick(e, menu)}
                  onkeydown={(e) => e.key === 'Enter' && handleMenuClick(e, menu)}
                  role="button"
                  tabindex="0"
                  aria-label="Edit menu {menu.name}"
                >
                  <div class="absolute top-2 right-2 opacity-100 transition-opacity z-10 flex gap-2">
                    <button 
                      class="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md"
                      onclick={(e) => { e.stopPropagation(); confirmDeleteMenu(menu.id); }}
                      ontouchend={(e) => { e.stopPropagation(); e.preventDefault(); confirmDeleteMenu(menu.id); }}
                    >
                      <svelte:component this={Trash} class="w-5 h-5" />
                    </button>
                  </div>
                  <div class="w-full aspect-square min-h-[140px] rounded-xl flex items-center justify-center mb-1 overflow-hidden">
                    {#if menu.gambar && !imageError[String(menu.id)]}
                      <img src={menu.gambar} alt={menu.name} class="w-full h-full object-cover rounded-xl bg-gray-100 min-h-[140px] aspect-square" onerror={() => handleImgError(String(menu.id))} />
                    {:else}
                      <div class="w-full aspect-square min-h-[140px] rounded-xl flex items-center justify-center text-4xl bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
                        🍹
                      </div>
                    {/if}
                  </div>
                  <div class="w-full flex flex-col items-center">
                    <h3 class="font-semibold text-gray-800 text-sm truncate w-full text-center mb-0.5">{menu.name}</h3>
                    <div class="text-xs text-gray-400 mb-0.5 min-h-[20px]">{menu.kategori ? menu.kategori : '\u00A0'}</div>
                    <div class="text-pink-500 font-bold text-base">Rp {menu.harga.toLocaleString('id-ID')}</div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex flex-col gap-1 w-full" transition:slide={{ duration: 250 }}>
              {#each filteredMenus as menu}
                <div class="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-pink-50 transition-colors"
                  data-menu-list
                  ontouchstart={handleMenuTouchStart}
                  ontouchmove={handleMenuTouchMove}
                  ontouchend={(e) => handleMenuTouchEnd(e, menu)}
                  onclick={(e) => handleMenuClick(e, menu)}
                  onkeydown={(e) => e.key === 'Enter' && handleMenuClick(e, menu)}
                  role="button"
                  tabindex="0"
                  aria-label="Edit menu {menu.name}"
                >
                  <div class="flex flex-col flex-1 min-w-0">
                    <span class="font-medium text-gray-800 text-sm truncate">{menu.name}</span>
                    <span class="text-xs text-gray-400 truncate">{menu.kategori ? menu.kategori : '\u00A0'}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-pink-500 font-bold text-base whitespace-nowrap">Rp {menu.harga.toLocaleString('id-ID')}</span>
                    <button 
                      class="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors ml-1"
                      onclick={(e) => { e.stopPropagation(); confirmDeleteMenu(menu.id); }}
                      aria-label="Hapus menu {menu.name}"
                    >
                      <svelte:component this={Trash} class="w-5 h-5" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        </div>
      <!-- Floating Action Button Tambah Menu -->
        <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-pink-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-pink-600 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-400" onclick={() => openMenuForm()} aria-label="Tambah Menu">
          <svelte:component this={Plus} class="w-7 h-7" />
        </button>
    {/if}

        {#if activeTab === 'kategori'}
          <!-- Handler swipe tab untuk tab kategori -->
          <div class="flex-1 w-full"
            ontouchstart={handleTabTouchStart}
            ontouchmove={handleTabTouchMove}
            ontouchend={handleTabTouchEnd}
            style="touch-action: pan-y;"
          >
            <!-- Search Kategori -->
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
                  onblur={() => { touchStartX = 0; touchEndX = 0; }}
                />
              </div>
            </div>
            <!-- Daftar Kategori & Badge -->
            <div class="flex items-center gap-2 mb-4 mt-0 px-0">
              <h2 class="text-base font-bold text-blue-700">Daftar Kategori</h2>
              <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{kategoriList.length} kategori</span>
            </div>
            <div class="flex-1 overflow-y-auto pb-16 w-full"
              style="scrollbar-width:none;-ms-overflow-style:none;touch-action:pan-y;"
            >
              {#if kategoriList.length === 0}
                <div class="flex flex-col justify-center items-center min-h-[300px] w-full text-gray-400 font-medium text-base text-center">
                  Belum ada kategori.<br />Klik tombol + untuk menambah.
                </div>
              {:else}
                <div class="space-y-3">
                  {#each kategoriList.filter(kat => kat.name.toLowerCase().includes(searchKategoriKeyword.trim().toLowerCase())) as kat}
                    <div class="bg-blue-50 rounded-xl shadow border border-blue-100 p-3 flex items-center justify-between group cursor-pointer hover:bg-blue-100 transition-colors"
                      data-kategori-box
                      ontouchstart={handleKategoriTouchStart}
                      ontouchmove={handleKategoriTouchMove}
                      ontouchend={(e) => handleKategoriTouchEnd(e, kat)}
                      onclick={(e) => handleKategoriClick(e, kat)}
                      onkeydown={(e) => e.key === 'Enter' && handleKategoriClick(e, kat)}
                      role="button"
                      tabindex="0"
                      aria-label="Edit kategori {kat.name}"
                    >
                      <div>
                        <div class="font-semibold text-blue-700 text-sm">{kat.name}</div>
                        <div class="text-xs text-blue-400">
                          {menus.filter(m => m.kategori === kat.name).length} menu
                        </div>
                      </div>
                      <div class="flex gap-2" role="group">
                        <button class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md"
                          onclick={(e) => { e.stopPropagation(); confirmDeleteKategori(kat.id); }}
                          ontouchend={(e) => { e.stopPropagation(); e.preventDefault(); confirmDeleteKategori(kat.id); }}
                        >
                          <svelte:component this={Trash} class="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
            <!-- Floating Action Button Tambah Kategori -->
            <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-blue-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400" onclick={() => openKategoriForm()} aria-label="Tambah Kategori">
              <svelte:component this={Plus} class="w-7 h-7" />
            </button>
          </div>
        {/if}

        {#if activeTab === 'ekstra'}
          <!-- Handler swipe tab untuk tab ekstra -->
          <div class="flex-1 w-full"
            ontouchstart={handleTabTouchStart}
            ontouchmove={handleTabTouchMove}
            ontouchend={handleTabTouchEnd}
            style="touch-action: pan-y;"
          >
            <!-- Search Ekstra -->
            <div class="w-full mb-4 px-0">
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" /></svg>
                </span>
                <input
                  type="text"
                  class="block w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 placeholder-gray-400"
                  placeholder="Cari ekstra…"
                  bind:value={searchEkstra}
                  onblur={() => { touchStartX = 0; touchEndX = 0; }}
                />
              </div>
            </div>
            <!-- Daftar Ekstra & Badge -->
            <div class="flex items-center gap-2 mb-4 mt-0 px-0">
              <h2 class="text-base font-bold text-green-700">Daftar Ekstra</h2>
              <span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{ekstraList.length} ekstra</span>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto pb-16 w-full"
              style="scrollbar-width:none;-ms-overflow-style:none;touch-action:pan-y;"
            >
              {#if ekstraList.length === 0}
                <div class="flex flex-col justify-center items-center min-h-[300px] w-full text-gray-400 font-medium text-base text-center">
                  Belum ada ekstra.<br />Klik tombol + untuk menambah.
                </div>
              {/if}
              <div class="grid grid-cols-2 gap-2 w-full">
                {#each ekstraList.filter(e => e.name.toLowerCase().includes(searchEkstra.trim().toLowerCase())) as ekstra (ekstra.id)}
                  <div class="bg-green-50 rounded-xl shadow border border-green-200 p-3 flex flex-col items-start relative transition-all duration-200 cursor-pointer hover:bg-green-100"
                    transition:fade
                    ontouchstart={handleEkstraTouchStart}
                    ontouchmove={handleEkstraTouchMove}
                    ontouchend={(e) => handleEkstraTouchEnd(e, ekstra)}
                    onclick={(e) => handleEkstraClick(e, ekstra)}
                    onkeydown={(e) => e.key === 'Enter' && handleEkstraClick(e, ekstra)}
                    role="button"
                    tabindex="0"
                    aria-label="Edit ekstra {ekstra.name}"
                  >
                    <div class="absolute top-2 right-2 z-10 flex gap-2">
                      <button class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md" onclick={(e) => { e.stopPropagation(); confirmDeleteEkstra(ekstra.id); }} 
                        ontouchend={(e) => { e.stopPropagation(); e.preventDefault(); confirmDeleteEkstra(ekstra.id); }}>
                        <svelte:component this={Trash} class="w-5 h-5" />
                      </button>
                    </div>
                    <div class="w-full flex flex-col items-start">
                      <h3 class="font-semibold text-green-700 text-sm truncate w-full mb-0.5 text-left">{ekstra.name}</h3>
                      <div class="text-green-400 font-bold text-xs text-left">Rp {ekstra.harga.toLocaleString('id-ID')}</div>
                    </div>
                  </div>
                {/each}
              </div>
              <div class="flex-1 min-h-[100px]"></div>
            </div>
          </div>
            <!-- Floating Action Button Tambah Ekstra -->
            <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-green-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400" onclick={() => openEkstraForm()} aria-label="Tambah Ekstra">
              <svelte:component this={Plus} class="w-7 h-7" />
            </button>
        {/if}
      </div>
    {/if}

    <!-- Security Page -->
    {#if currentPage === 'security'}
      <div class="h-screen flex flex-col">
        <div class="max-w-2xl px-4 py-6 flex-1 overflow-y-auto"
          style="scrollbar-width:none;-ms-overflow-style:none;"
        >
          <!-- Section 1: Ganti Username & Password -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
            <h3 class="text-lg font-bold text-gray-800 mb-2">Ganti Username & Password</h3>
            <p class="text-gray-500 text-sm mb-6">Ubah username dan password akun kasir Anda secara berkala untuk menjaga keamanan akun.</p>
            <!-- Tab Navigation -->
            <div class="relative flex bg-white rounded-xl p-1 shadow-sm border border-gray-200 mb-4 mt-0 gap-2 overflow-hidden">
              <!-- Indicator Slide & Color Transition -->
              <div
                class="absolute top-1 left-1 h-[calc(100%-0.5rem)] w-1/2 rounded-lg z-0 transition-transform transition-colors duration-300 ease-in-out"
                style="
                  transform: translateX({currentUserRole === 'pemilik' ? '0%' : '100%'});
                  background: {currentUserRole === 'pemilik' ? '#ec4899' : '#3b82f6'};
                "
              ></div>
              <button 
                class={`flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 ${currentUserRole === 'pemilik' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                onclick={() => setUserRole('pemilik')}
              >
                Pemilik
              </button>
              <button 
                class={`flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 ${currentUserRole === 'kasir' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                onclick={() => setUserRole('kasir')}
              >
                Kasir
              </button>
                  </div>
            <form class="flex flex-col gap-4" 
                  onsubmit={handleChangeUserPass} 
                  autocomplete="off">
              <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Username Lama" bind:value={oldUsername} required />
              <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Username Baru" bind:value={newUsername} required />
              <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Password Lama" bind:value={oldPassword} required />
              <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Password Baru" bind:value={newPassword} required />
              <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Konfirmasi Password Baru" bind:value={confirmPassword} required />
              {#if userPassError}
                <div class="text-pink-600 text-sm text-center mt-1">{userPassError}</div>
              {/if}
              <button 
                class={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 ${currentUserRole === 'pemilik' ? 'bg-pink-500 hover:bg-pink-600 active:bg-pink-700' : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'}`}
                type="submit"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
          <!-- Section 2: Ganti PIN Keamanan -->
          {#if currentUserRole === 'pemilik'}
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
              <h3 class="text-lg font-bold text-gray-800 mb-2">Ganti PIN Keamanan</h3>
              <p class="text-gray-500 text-sm mb-6">Pengaturan PIN keamanan untuk mengunci halaman tertentu.</p>
              <form class="flex flex-col gap-4 w-full" 
                  onsubmit={handleChangePin} 
                  autocomplete="off">
                <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="PIN Lama" bind:value={oldPin} required inputmode="numeric" pattern="[0-9]*" maxlength="4" 
                  oninput={(e) => { e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4); oldPin = e.target.value; }} />
                <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="PIN Baru (4 digit)" bind:value={newPin} required inputmode="numeric" pattern="[0-9]*" maxlength="4" 
                  oninput={(e) => { e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4); newPin = e.target.value; }} />
                <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Konfirmasi PIN Baru" bind:value={confirmPin} required inputmode="numeric" pattern="[0-9]*" maxlength="4" 
                  oninput={(e) => { e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4); confirmPin = e.target.value; }} />
                <div>
                  <div class="font-semibold text-gray-700 mb-2">Kunci PIN untuk halaman:</div>
                  <div class="flex flex-wrap gap-3">
                    <!-- Hapus opsi pengaturan -->
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" bind:group={lockedPages} value="laporan" class="hidden peer" />
                      <span class="w-5 h-5 rounded-full border-2 border-pink-400 flex items-center justify-center transition-colors duration-150 peer-checked:bg-pink-500 peer-checked:border-pink-500 bg-white">
                        <svg class="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                      <span class="text-sm text-gray-700">Laporan</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" bind:group={lockedPages} value="catat" class="hidden peer" />
                      <span class="w-5 h-5 rounded-full border-2 border-pink-400 flex items-center justify-center transition-colors duration-150 peer-checked:bg-pink-500 peer-checked:border-pink-500 bg-white">
                        <svg class="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                      <span class="text-sm text-gray-700">Catat</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" bind:group={lockedPages} value="beranda" class="hidden peer" />
                      <span class="w-5 h-5 rounded-full border-2 border-pink-400 flex items-center justify-center transition-colors duration-150 peer-checked:bg-pink-500 peer-checked:border-pink-500 bg-white">
                        <svg class="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                      <span class="text-sm text-gray-700">Beranda</span>
                    </label>
                  </div>
                </div>
                {#if pinError}
                  <div class="text-pink-600 text-sm text-center mt-1">{pinError}</div>
                {/if}
                <button class="w-full bg-pink-500 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-pink-600 active:bg-pink-700 transition-colors duration-200" type="submit">Simpan PIN & Pengaturan Kunci</button>
              </form>
            </div>
          {:else}
            <div></div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Menu Form Modal -->
    {#if showMenuForm}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-0 relative flex flex-col h-[90vh]">
          <div class="w-full flex flex-row items-center gap-4 px-4 pt-3 pb-2 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]">
            <div class="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
              <svelte:component this={Utensils} class="w-5 h-5 text-pink-500" />
            </div>
            <h2 class="text-base font-semibold text-gray-700">{editMenuId ? 'Edit Menu' : 'Tambah Menu'}</h2>
          </div>
          <div class="flex-1 w-full overflow-y-auto px-6 pb-2 pt-4 space-y-6"
            style="scrollbar-width:none;-ms-overflow-style:none;"
          >
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
              <label class="block text-sm font-medium text-gray-700 mb-2" for="menu-tipe">Tipe</label>
              <div class="flex gap-3" id="menu-tipe">
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
              <label class="block text-sm font-medium text-gray-700 mb-2" for="menu-kategori">Kategori</label>
              <div class="flex gap-2 overflow-x-auto pb-1" id="menu-kategori">
                {#if kategoriList.length === 0}
                  <div class="flex items-center gap-2 h-[40px] px-4 text-sm text-gray-400">
                    <span class="text-base" style="position:relative;top:-2px;">📁</span>
                    <span>Belum ada Kategori</span>
            </div>
                {:else}
                  {#each kategoriList as kat}
                    <button type="button"
                      class="px-4 py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 whitespace-nowrap {menuForm.kategori === kat.name ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                      onclick={() => menuForm.kategori = kat.name}>
                      {kat.name}
                    </button>
                  {/each}
                {/if}
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
                    menuForm.harga = value;
                  }}
                />
              </div>
            </div>
            <!-- Ekstra (Box Selector Grid) -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="menu-ekstra">Ekstra</label>
              <div class="grid grid-cols-2 gap-2" id="menu-ekstra">
                {#each ekstraList as ekstra}
                  <button type="button"
                    class="w-full justify-center py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 flex items-center text-center whitespace-normal overflow-hidden {menuForm.ekstraIds.includes(ekstra.id) ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                    onclick={(e) => {
                      e.stopPropagation();
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
              <svelte:component this={Tag} class="w-5 h-5 text-blue-500" />
          </div>
            <h2 class="text-base font-semibold text-gray-700">Edit Kategori</h2>
          </div>
          <div class="flex-1 w-full overflow-y-auto px-6 pb-2 pt-4"
            style="scrollbar-width:none;-ms-overflow-style:none;"
          >
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
                {#each selectedMenuIds as id (id)}
                  <div class="px-3 py-2 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium cursor-pointer select-none transition-all duration-200 shadow-sm hover:bg-blue-200"
                    transition:fly={{ y: -16, duration: 200 }}
                    onclick={(e) => { e.stopPropagation(); toggleMenuInKategori(id); }}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleMenuInKategori(id)}>
                    {menus.find(m => m.id === id)?.name}
                  </div>
                {/each}
                {#if selectedMenuIds.length === 0}
                  <div class="text-gray-300 text-xs italic">Belum ada menu</div>
                {/if}
            </div>
          </div>
            <div class="mb-6">
              <div class="text-xs font-semibold text-gray-400 mb-2">Menu Non-Kategori</div>
              <div class="flex flex-wrap gap-2 min-h-[36px]">
                {#each unselectedMenuIds as id (id)}
                  <div class="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium cursor-pointer select-none transition-all duration-200 shadow-sm hover:bg-blue-50"
                    transition:fly={{ y: 16, duration: 200 }}
                    onclick={(e) => { e.stopPropagation(); toggleMenuInKategori(id); }}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleMenuInKategori(id)}>
                    {menus.find(m => m.id === id)?.name}
                  </div>
                {/each}
                {#if unselectedMenuIds.length === 0}
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
        <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center animate-slideUpModal">
          <button class="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200" onclick={cancelDeleteMenu} aria-label="Tutup">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <svelte:component this={Trash} class="w-8 h-8 text-red-500" />
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
    <CropperDialog bind:open={showCropperDialog} src={cropperDialogImage} aspect={1} ondone={handleCropperDone} oncancel={handleCropperCancel} />

    <!-- Delete Confirmation Modal Kategori -->
    {#if showDeleteKategoriModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center animate-slideUpModal">
          <button class="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200" onclick={cancelDeleteKategori} aria-label="Tutup">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <svelte:component this={Trash} class="w-8 h-8 text-red-500" />
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
        <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center animate-slideUpModal">
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <svelte:component this={Trash} class="w-8 h-8 text-red-500" />
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
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-0 relative flex flex-col max-h-[400px]">
          <div class="w-full flex flex-row items-center gap-4 px-4 pt-3 pb-2 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]">
            <div class="w-8 h-8 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center">
              <svelte:component this={Coffee} class="w-5 h-5 text-green-500" />
            </div>
            <h2 class="text-base font-semibold text-gray-700">{editEkstraId ? 'Edit Ekstra' : 'Tambah Ekstra'}</h2>
          </div>
          <div class="flex-1 w-full overflow-y-auto px-6 pb-2 pt-4"
            style="scrollbar-width:none;-ms-overflow-style:none;"
          >
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
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">Rp</span>
              <input 
                  class="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0"
                  inputmode="numeric"
                  pattern="[0-9]*"
                id="ekstra-harga"
                bind:value={ekstraForm.harga}
                  oninput={(e) => {
                    let value = e.target.value.replace(/[^\d]/g, '');
                    if (value) {
                      value = parseInt(value, 10).toLocaleString('id-ID');
                    } else {
                      value = '';
                    }
                    ekstraForm.harga = value;
                    setTimeout(() => {
                      e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
                    }, 0);
                  }}
              />
            </div>
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
              disabled={!ekstraForm.name.trim() || !ekstraForm.harga || isNaN(parseInt(ekstraForm.harga.toString().replace(/[^\d]/g, ''))) || parseInt(ekstraForm.harga.toString().replace(/[^\d]/g, '')) <= 0}
            >
              {editEkstraId ? 'Simpan' : 'Tambah Ekstra'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if showNotifModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div class="bg-white rounded-2xl shadow-2xl border-2 px-8 py-7 max-w-xs w-full flex flex-col items-center animate-slideUpModal"
          style="border-color: {notifModalType === 'success' ? '#facc15' : notifModalType === 'error' ? '#ef4444' : '#facc15'};">
          <div class="flex items-center justify-center w-16 h-16 rounded-full mb-3"
            style="background: {notifModalType === 'success' ? '#fef9c3' : notifModalType === 'error' ? '#fee2e2' : '#fef9c3'};">
            {#if notifModalType === 'success'}
              <svg class="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" fill="#fef9c3" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" stroke="#facc15" stroke-width="2" />
              </svg>
            {:else if notifModalType === 'error'}
              <svg class="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" fill="#fee2e2" />
                <line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
                <line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
              </svg>
            {:else}
              <svg class="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" fill="#fef9c3" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01" stroke="#facc15" stroke-width="2" />
              </svg>
            {/if}
          </div>
          <div class="text-center text-base font-semibold text-gray-700 mb-2">{notifModalMsg}</div>
          <button class="w-full py-2 bg-yellow-400 text-white rounded-lg font-semibold mt-2" onclick={() => showNotifModal = false}>Tutup</button>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <div class="text-6xl mb-4">🔒</div>
      <h2 class="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
      <p class="text-gray-600 mb-6 mx-24">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      <button 
        class="bg-pink-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-pink-600 transition-colors"
        onclick={() => goto('/pengaturan')}
      >
        Kembali ke Pengaturan
      </button>
    </div>
  </div>
{/if} 

<style>
@keyframes slideUpModal {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-slideUpModal {
  animation: slideUpModal 0.32s cubic-bezier(.4,0,.2,1);
}
</style>