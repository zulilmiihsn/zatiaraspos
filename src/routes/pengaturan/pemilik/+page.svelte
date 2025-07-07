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
import { supabase } from '$lib/database/supabaseClient';

let currentUser = null;
let userRole = '';
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

// Tambahkan state untuk tap vs swipe kategori
let kategoriTouchStartX = 0;
let kategoriTouchStartY = 0;
let kategoriTouchStartTime = 0;
let kategoriSwipeDetected = false;

// Tambahkan state untuk tap vs swipe menu
let menuTouchStartX = 0;
let menuTouchStartY = 0;
let menuTouchStartTime = 0;
let menuSwipeDetected = false;

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

let userRoleTab: 'pemilik' | 'kasir' = 'pemilik';
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

// Load saved settings on mount
onMount(async () => {
  // Ambil session Supabase
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    userRole = profile?.role || '';
    // Jika bukan admin/pemilik, set role jadi kasir
    if (userRole !== 'admin' && userRole !== 'pemilik') {
      userRole = 'kasir';
      await supabase.from('profiles').update({ role: 'kasir' }).eq('id', userId);
    }
  }
  await fetchSecuritySettings();
  await fetchMenus();
  await fetchKategori();
  await fetchEkstra();
});

async function fetchSecuritySettings() {
  const { data, error } = await supabase.from('security_settings').select('*').single();
  if (!error && data) {
    pin = data.pin;
    lockedPages = data.locked_pages || ['laporan', 'beranda'];
  }
}

let showPinModal = false;
let pinInput = '';
let pinModalError = '';

function handleTabTouchStart(e: TouchEvent) {
  if (ignoreSwipe) return; // abaikan swipe tab jika gesture kategori
  const target = e.target as HTMLElement;
  if (target.closest('button, [tabindex], input, select, textarea, [role="button"]')) {
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
  const swipeThreshold = window.innerWidth * 0.4;
  if (Math.abs(delta) < 20) return; // abaikan swipe tab jika gesture kecil/tap
  if (Math.abs(delta) > swipeThreshold) {
    if (delta < 0) {
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
  const swipeThreshold = window.innerWidth * 0.4;
  const tapThreshold = 40; // px, lebih toleran
  if (Math.abs(deltaX) > swipeThreshold) {
    // SWIPE: biarkan handler swipe tab global yang jalan, JANGAN buka modal
    return;
  }
  if (Math.abs(deltaX) < tapThreshold && Math.abs(deltaY) < tapThreshold && duration < 300) {
    e.stopPropagation(); // block agar tidak bubble ke parent
    openKategoriForm(kat);
    window.addEventListener('click', blockNextClick, true);
  }
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
    return;
  }
}
function handleMenuTouchEnd(e, menu) {
  const deltaX = e.changedTouches[0].clientX - menuTouchStartX;
  const deltaY = e.changedTouches[0].clientY - menuTouchStartY;
  const duration = Date.now() - menuTouchStartTime;
  const swipeThreshold = window.innerWidth * 0.4;
  if (Math.abs(deltaX) > swipeThreshold) {
    // SWIPE: biarkan handler swipe tab global yang jalan, JANGAN buka modal
    return;
  }
  if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20 && duration < 300) {
    openMenuForm(menu);
    window.addEventListener('click', blockNextClick, true);
  }
}

onMount(() => {
  currentUser = auth.getCurrentUser();
  userRole = currentUser?.role || '';
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
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase fetchMenus error:', error);
    alert('Gagal mengambil data menu: ' + error.message);
  }
  if (!error) menus = data;
}
async function fetchKategori() {
  const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase fetchKategori error:', error);
    alert('Gagal mengambil data kategori: ' + error.message);
  }
  if (!error) kategoriList = data;
}
async function fetchEkstra() {
  const { data, error } = await supabase.from('add_ons').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase fetchEkstra error:', error);
    alert('Gagal mengambil data ekstra: ' + error.message);
  }
  if (!error) ekstraList = data;
}

async function uploadMenuImage(file, menuId) {
  const ext = file.name.split('.').pop();
  const filePath = `menu-${menuId}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('menu-images').upload(filePath, file, { upsert: true });
  if (error) throw error;
  // Dapatkan public URL
  const { data: publicUrlData } = supabase.storage.from('menu-images').getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

async function saveMenu() {
  let imageUrl = menuForm.gambar;
  // Jika user memilih file baru (bukan string URL)
  if (selectedImage && selectedImage instanceof File) {
    imageUrl = await uploadMenuImage(selectedImage, editMenuId || Date.now());
  }
  const payload = { ...menuForm, gambar: imageUrl, harga: parseInt(menuForm.harga) };
  let result;
  if (editMenuId) {
    result = await supabase.from('products').update(payload).eq('id', editMenuId);
  } else {
    result = await supabase.from('products').insert([payload]);
  }
  if (result.error) {
    console.error('Supabase saveMenu error:', result.error);
    alert('Gagal menyimpan menu: ' + result.error.message);
  }
  showMenuForm = false;
  await fetchMenus();
}

function confirmDeleteMenu(id: number) {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
  menuIdToDelete = id;
  showDeleteModal = true;
  touchStartX = 0;
  touchEndX = 0;
  ignoreSwipe = false;
}

async function doDeleteMenu() {
  if (menuIdToDelete !== null) {
    // Hapus gambar dari storage jika ada
    const menu = menus.find(m => m.id === menuIdToDelete);
    if (menu?.gambar) {
      const path = menu.gambar.split('/').pop();
      await supabase.storage.from('menu-images').remove([path]);
    }
    await supabase.from('products').delete().eq('id', menuIdToDelete);
    showDeleteModal = false;
    menuIdToDelete = null;
    await fetchMenus();
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
  ignoreSwipe = false;
}

// Kategori functions
function openKategoriForm(kat) {
  if (!kat) {
    // Create kategori baru
    kategoriDetail = null;
    showKategoriDetailModal = true;
    kategoriDetailName = '';
    menuIdsInKategori = [];
    menuIdsNonKategori = menus.map(m => m.id);
    return;
  }
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
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
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

async function saveKategoriDetail() {
  if (kategoriDetail) {
    const { error } = await supabase.from('categories').update({ name: kategoriDetailName, menuIds: menuIdsInKategori }).eq('id', kategoriDetail.id);
    if (error) {
      console.error('Supabase saveKategoriDetail error:', error);
      alert('Gagal menyimpan kategori: ' + error.message);
    }
    // Update kategori pada menu/products
    await updateMenusKategori(kategoriDetailName, menuIdsInKategori, kategoriDetail.menuIds ?? []);
  } else {
    // INSERT kategori baru
    const { data, error } = await supabase.from('categories').insert([{ name: kategoriDetailName, menuIds: menuIdsInKategori }]).select();
    if (error) {
      console.error('Supabase insertKategori error:', error);
      alert('Gagal menambah kategori: ' + error.message);
    }
    // Update kategori pada menu/products
    await updateMenusKategori(kategoriDetailName, menuIdsInKategori, []);
  }
  showKategoriDetailModal = false;
  kategoriDetail = null;
  await fetchKategori();
  await fetchMenus();
}

// Update kategori pada tabel menu/products
async function updateMenusKategori(namaKategori, menuIdsBaru, menuIdsLama) {
  // Set kategori pada menu yang baru masuk kategori
  for (const id of menuIdsBaru) {
    await supabase.from('products').update({ kategori: namaKategori }).eq('id', id);
  }
  // Hapus kategori pada menu yang sebelumnya ada tapi sekarang tidak
  for (const id of menuIdsLama) {
    if (!menuIdsBaru.includes(id)) {
      await supabase.from('products').update({ kategori: null }).eq('id', id);
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
  ignoreSwipe = false;
}

async function doDeleteKategori() {
  if (kategoriIdToDelete !== null) {
    // Ambil nama kategori yang akan dihapus
    const kategori = kategoriList.find(k => k.id === kategoriIdToDelete);
    const kategoriName = kategori?.name || '';
    await supabase.from('categories').delete().eq('id', kategoriIdToDelete);
    // Update semua produk yang punya kategori ini menjadi null
    if (kategoriName) {
      await supabase.from('products').update({ kategori: null }).eq('kategori', kategoriName);
    }
    showDeleteKategoriModal = false;
    kategoriIdToDelete = null;
    await fetchKategori();
    await fetchMenus();
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
  ignoreSwipe = false;
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
  if (!ekstraForm.name.trim() || !ekstraForm.harga) return;
  const hargaValue = ekstraForm.harga.toString().replace(/[^\d]/g, '');
  const hargaNumber = parseInt(hargaValue);
  if (isNaN(hargaNumber) || hargaNumber <= 0) return;
  let result;
  if (editEkstraId) {
    result = await supabase.from('add_ons').update({ ...ekstraForm, harga: hargaNumber }).eq('id', editEkstraId);
  } else {
    result = await supabase.from('add_ons').insert([{ ...ekstraForm, harga: hargaNumber }]);
  }
  if (result.error) {
    console.error('Supabase saveEkstra error:', result.error);
    alert('Gagal menyimpan ekstra: ' + result.error.message);
  }
  showEkstraForm = false;
  await fetchEkstra();
}

function confirmDeleteEkstra(id) {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', blockNextClick, true);
  }
  ekstraIdToDelete = id;
  showDeleteEkstraModal = true;
  touchStartX = 0;
  touchEndX = 0;
  ignoreSwipe = false;
}

async function doDeleteEkstra() {
  if (ekstraIdToDelete !== null) {
    await supabase.from('add_ons').delete().eq('id', ekstraIdToDelete);
    showDeleteEkstraModal = false;
    ekstraIdToDelete = null;
    await fetchEkstra();
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
  ignoreSwipe = false;
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
  const swipeThreshold = window.innerWidth * 0.4;
  if (Math.abs(deltaX) > swipeThreshold) {
    // SWIPE: biarkan handler swipe tab global yang jalan, JANGAN buka modal
    return;
  }
  if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20 && duration < 300) {
    openEkstraForm(ekstra);
    window.addEventListener('click', blockNextClick, true);
  }
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
  // Update username di profiles (pakai full_name)
  const { error: usernameError } = await supabase.from('profiles').update({ full_name: newUsername }).eq('id', userId);
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
  await supabase.from('security_settings').update({ pin: newPin, locked_pages: lockedPages }).eq('id', 1);
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
</script>

<svelte:head>
  <title>Admin Panel - ZatiarasPOS</title>
</svelte:head>

{#if userRole === 'admin' || userRole === 'pemilik'}
  <div class="min-h-screen bg-gray-50 flex flex-col page-content">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="flex items-center">
          <button on:click={() => currentPage === 'main' ? goto('/pengaturan') : currentPage = 'main'} class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
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
            on:click={() => currentPage = 'menu'}
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
            on:click={() => currentPage = 'security'}
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
              <div class="w-full max-w-4xl mx-auto px-4 pb-6 pt-2 h-full flex flex-col overflow-x-hidden"
        on:touchstart={handleTabTouchStart}
        on:touchmove={handleTabTouchMove}
        on:touchend={handleTabTouchEnd}
      >
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
            on:click={() => activeTab = 'menu'}
          >
            <svelte:component this={Utensils} class="w-4 h-4" />
            Menu
          </button>
          <button 
            class="flex-1 flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 {activeTab === 'kategori' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}"
            on:click={() => activeTab = 'kategori'}
          >
            <svelte:component this={Tag} class="w-4 h-4" />
            Kategori
          </button>
          <button 
            class="flex-1 flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 {activeTab === 'ekstra' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}"
            on:click={() => activeTab = 'ekstra'}
          >
            <svelte:component this={Coffee} class="w-4 h-4" />
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
              on:blur={() => { touchStartX = 0; touchEndX = 0; ignoreSwipe = false; }}
            />
          </div>
        </div>

          <!-- Daftar Menu & Filter -->
          <div class="flex items-center gap-2 mb-4 mt-0 px-0">
          <h2 class="text-base font-bold text-gray-800">Daftar Menu</h2>
          <span class="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full text-xs font-medium">{filteredMenus.length} menu</span>
        </div>
        <!-- Kategori Filter -->
          <div class="flex gap-1.5 overflow-x-auto pb-0 pt-0 px-0 border-b border-gray-100 mb-4"
            style="scrollbar-width:none;-ms-overflow-style:none;"
          >
          <button 
              class="px-2.5 py-2 min-w-[70px] rounded-md font-medium transition-colors whitespace-nowrap text-xs {selectedKategori === 'Semua' ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
              on:click={() => { selectedKategori = 'Semua'; touchStartX = 0; touchEndX = 0; ignoreSwipe = false; }}
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
                  class="px-2.5 py-2 min-w-[70px] rounded-md font-medium transition-colors whitespace-nowrap text-xs {selectedKategori === kategori ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}"
                  on:click={() => { selectedKategori = kategori; touchStartX = 0; touchEndX = 0; ignoreSwipe = false; }}
            >
              {kategori}
            </button>
          {/each}
          {/if}
        </div>
        <!-- Menu Grid Scrollable -->
        <div class="flex-1 overflow-y-auto pb-16 w-full"
          style="scrollbar-width:none;-ms-overflow-style:none;"
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
          <div class="grid grid-cols-2 gap-2 w-full">
            {#each filteredMenus as menu}
              <div class="bg-white rounded-xl shadow border border-gray-100 p-2 flex flex-col items-center relative group cursor-pointer hover:bg-pink-50 transition-colors"
                data-menu-card
                on:touchstart={handleMenuTouchStart}
                on:touchmove={handleMenuTouchMove}
                on:touchend={(e) => handleMenuTouchEnd(e, menu)}
                on:click={(e) => handleMenuClick(e, menu)}
              >
                <div class="absolute top-2 right-2 opacity-100 transition-opacity z-10 flex gap-2">
                  <button 
                    class="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md"
                    on:click={(e) => { e.stopPropagation(); confirmDeleteMenu(menu.id); }}
                    on:touchend={(e) => { e.stopPropagation(); e.preventDefault(); confirmDeleteMenu(menu.id); }}
                  >
                    <svelte:component this={Trash} class="w-5 h-5" />
                  </button>
                </div>
                <div class="w-full aspect-square min-h-[140px] rounded-xl flex items-center justify-center mb-1 overflow-hidden">
                  {#if menu.gambar && !imageError[String(menu.id)]}
                    <img src={menu.gambar} alt={menu.name} class="w-full h-full object-cover rounded-xl bg-gray-100 min-h-[140px] aspect-square" on:error={() => handleImgError(String(menu.id))} />
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
        </div>
      <!-- Floating Action Button Tambah Menu -->
        <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-pink-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-pink-600 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-400" on:click={() => openMenuForm()} aria-label="Tambah Menu">
          <svelte:component this={Plus} class="w-7 h-7" />
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
                on:blur={() => { touchStartX = 0; touchEndX = 0; ignoreSwipe = false; }}
              />
            </div>
          </div>
          <div class="flex-1 overflow-y-auto pb-16 w-full"
            style="scrollbar-width:none;-ms-overflow-style:none;"
          >
            <div class="flex items-center gap-2 mb-5">
              <h2 class="text-base font-bold text-blue-700">Daftar Kategori</h2>
              <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{kategoriList.length} kategori</span>
                  </div>
            {#if kategoriList.length === 0}
              <div class="flex flex-col justify-center items-center min-h-[300px] w-full text-gray-400 font-medium text-base text-center">
                Belum ada kategori.<br />Klik tombol + untuk menambah.
              </div>
            {:else}
              <div class="space-y-3">
                {#each kategoriList.filter(kat => kat.name.toLowerCase().includes(searchKategoriKeyword.trim().toLowerCase())) as kat}
                  <div class="bg-blue-50 rounded-xl shadow border border-blue-100 p-3 flex items-center justify-between group cursor-pointer hover:bg-blue-100 transition-colors"
                    data-kategori-box
                    on:touchstart={handleKategoriTouchStart}
                    on:touchmove={handleKategoriTouchMove}
                    on:touchend={(e) => handleKategoriTouchEnd(e, kat)}
                    on:click={(e) => handleKategoriClick(e, kat)}
                  >
                  <div>
                      <div class="font-semibold text-blue-700 text-sm">{kat.name}</div>
                      <div class="text-xs text-blue-400">{kat.menuIds.length} menu</div>
                  </div>
                    <div class="flex gap-2" role="group">
                      <button class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md"
                        on:click={(e) => { e.stopPropagation(); confirmDeleteKategori(kat.id); }}
                        on:touchend={(e) => { e.stopPropagation(); e.preventDefault(); confirmDeleteKategori(kat.id); }}
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
          <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-blue-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400" on:click={() => openKategoriForm()} aria-label="Tambah Kategori">
            <svelte:component this={Plus} class="w-7 h-7" />
                </button>
        {/if}

        {#if activeTab === 'ekstra'}
          <div class="flex flex-col flex-1 min-h-0 h-full w-full">
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
                  on:blur={() => { touchStartX = 0; touchEndX = 0; ignoreSwipe = false; }}
                />
              </div>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto pb-16 w-full"
              style="scrollbar-width:none;-ms-overflow-style:none;"
              on:touchstart={handleTabTouchStart}
              on:touchmove={handleTabTouchMove}
              on:touchend={handleTabTouchEnd}
            >
              <div class="flex items-center gap-2 mb-5">
                <h2 class="text-base font-bold text-green-700">Daftar Ekstra</h2>
                <span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{ekstraList.length} ekstra</span>
              </div>
              {#if ekstraList.length === 0}
                <div class="flex flex-col justify-center items-center min-h-[300px] w-full text-gray-400 font-medium text-base text-center">
                  Belum ada ekstra.<br />Klik tombol + untuk menambah.
                </div>
              {/if}
              <div class="grid grid-cols-2 gap-2 w-full">
                {#each ekstraList.filter(e => e.name.toLowerCase().includes(searchEkstra.trim().toLowerCase())) as ekstra (ekstra.id)}
                  <div class="bg-green-50 rounded-xl shadow border border-green-200 p-3 flex flex-col items-center relative transition-all duration-200 cursor-pointer hover:bg-green-100"
                    transition:fade
                    on:touchstart={handleEkstraTouchStart}
                    on:touchmove={handleEkstraTouchMove}
                    on:touchend={(e) => handleEkstraTouchEnd(e, ekstra)}
                    on:click={(e) => handleEkstraClick(e, ekstra)}
                  >
                    <div class="absolute top-2 right-2 z-10 flex gap-2">
                      <button class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors shadow-md" on:click={(e) => { e.stopPropagation(); confirmDeleteEkstra(ekstra.id); }} on:touchend={(e) => { e.stopPropagation(); e.preventDefault(); confirmDeleteEkstra(ekstra.id); }}>
                        <svelte:component this={Trash} class="w-5 h-5" />
                </button>
              </div>
                    <div class="w-full flex flex-col items-center">
                      <h3 class="font-semibold text-green-700 text-sm truncate w-full text-center mb-0.5">{ekstra.name}</h3>
                      <div class="text-green-400 font-bold text-xs">Rp {ekstra.harga.toLocaleString('id-ID')}</div>
            </div>
          </div>
                {/each}
              </div>
              <div class="flex-1 min-h-[100px]"></div>
            </div>
            <!-- Floating Action Button Tambah Ekstra -->
            <button class="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-green-500 shadow-md flex items-center justify-center text-white text-3xl hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400" on:click={() => openEkstraForm()} aria-label="Tambah Ekstra">
              <svelte:component this={Plus} class="w-7 h-7" />
            </button>
          </div>
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
                  transform: translateX({userRoleTab === 'pemilik' ? '0%' : '100%'});
                  background: {userRoleTab === 'pemilik' ? '#ec4899' : '#3b82f6'};
                "
              ></div>
              <button 
                class={`flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 ${userRoleTab === 'pemilik' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                on:click={() => userRoleTab = 'pemilik'}
              >
                Pemilik
              </button>
              <button 
                class={`flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg font-medium transition-all text-xs relative z-10 ${userRoleTab === 'kasir' ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                on:click={() => userRoleTab = 'kasir'}
              >
                Kasir
              </button>
                  </div>
            <form class="flex flex-col gap-4" on:submit={handleChangeUserPass} autocomplete="off">
              <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Username Lama" bind:value={oldUsername} required />
              <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Username Baru" bind:value={newUsername} required />
              <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Password Lama" bind:value={oldPassword} required />
              <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Password Baru" bind:value={newPassword} required />
              <input type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Konfirmasi Password Baru" bind:value={confirmPassword} required />
              {#if userPassError}
                <div class="text-pink-600 text-sm text-center mt-1">{userPassError}</div>
              {/if}
              <button 
                class={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition-colors duration-200 ${userRoleTab === 'pemilik' ? 'bg-pink-500 hover:bg-pink-600 active:bg-pink-700' : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'}`}
                type="submit"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
          <!-- Section 2: Ganti PIN Keamanan -->
          {#if userRoleTab === 'pemilik'}
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
              <h3 class="text-lg font-bold text-gray-800 mb-2">Ganti PIN Keamanan</h3>
              <p class="text-gray-500 text-sm mb-6">Pengaturan PIN keamanan untuk mengunci halaman tertentu.</p>
              <form class="flex flex-col gap-4 w-full" on:submit={handleChangePin} autocomplete="off">
                <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="PIN Lama" bind:value={oldPin} required inputmode="numeric" pattern="[0-9]*" maxlength="4" on:input={(e) => { e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4); oldPin = e.target.value; }} />
                <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="PIN Baru (4 digit)" bind:value={newPin} required inputmode="numeric" pattern="[0-9]*" maxlength="4" on:input={(e) => { e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4); newPin = e.target.value; }} />
                <input type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" placeholder="Konfirmasi PIN Baru" bind:value={confirmPin} required inputmode="numeric" pattern="[0-9]*" maxlength="4" on:input={(e) => { e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4); confirmPin = e.target.value; }} />
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
                  <input type="file" accept="image/*" class="hidden" on:change={handleFileChange} />
                </label>
                {:else}
                  <label class="w-full aspect-square min-h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-pink-200 rounded-xl cursor-pointer hover:bg-pink-50 transition-colors">
                    <span class="text-pink-400 font-medium mb-2">Klik untuk upload gambar</span>
                    <input type="file" accept="image/*" class="hidden" on:change={handleFileChange} />
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
                  on:click={() => menuForm.tipe = 'makanan'}>
                  Makanan
                </button>
                <button type="button"
                  class="flex-1 px-0 py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 {menuForm.tipe === 'minuman' ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                  on:click={() => menuForm.tipe = 'minuman'}>
                  Minuman
                </button>
            </div>
              </div>
            <!-- Kategori (Box Selector) -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
              <div class="flex gap-2 overflow-x-auto pb-1">
                {#if kategoriList.length === 0}
                  <div class="flex items-center gap-2 h-[40px] px-4 text-sm text-gray-400">
                    <span class="text-base" style="position:relative;top:-2px;">📁</span>
                    <span>Belum ada Kategori</span>
            </div>
                {:else}
                  {#each kategoriList as kat}
                    <button type="button"
                      class="px-4 py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 whitespace-nowrap {menuForm.kategori === kat.name ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                      on:click={() => menuForm.kategori = kat.name}>
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
                  on:input={(e) => {
                    let value = e.target.value.replace(/[^\d]/g, '');
                    menuForm.harga = value;
                  }}
                />
              </div>
            </div>
            <!-- Ekstra (Box Selector Grid) -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Ekstra</label>
              <div class="grid grid-cols-2 gap-2">
                {#each ekstraList as ekstra}
                  <button type="button"
                    class="w-full justify-center py-2.5 rounded-lg border border-pink-400 font-medium text-sm cursor-pointer transition-colors duration-150 flex items-center text-center whitespace-normal overflow-hidden {menuForm.ekstraIds.includes(ekstra.id) ? 'bg-pink-500 text-white shadow' : 'bg-white text-pink-500'}"
                    on:click={(e) => {
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
              on:click={() => showMenuForm = false}
            >
              Batal
            </button>
            <button 
              class="flex-1 py-3 px-4 bg-pink-500 text-white rounded-xl font-bold hover:bg-pink-600 transition-colors text-base shadow-md"
              on:click={saveMenu}
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
                {#each menuIdsInKategori as id (id)}
                  <div class="px-3 py-2 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium cursor-pointer select-none transition-all duration-200 shadow-sm hover:bg-blue-200"
                    transition:fly={{ y: -16, duration: 200 }}
                    on:click={(e) => { e.stopPropagation(); toggleMenuInKategori(id); }}>
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
                    on:click={(e) => { e.stopPropagation(); toggleMenuInKategori(id); }}>
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
              on:click={closeKategoriDetailModal}
            >
              Batal
            </button>
            <button 
              class="flex-1 py-3 px-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors text-base shadow-md"
              on:click={saveKategoriDetail}
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
          <button class="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200" on:click={cancelDeleteMenu} aria-label="Tutup">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <svelte:component this={Trash} class="w-8 h-8 text-red-500" />
          </div>
          <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Menu?</h2>
          <p class="text-gray-500 text-sm mb-6 text-center">Menu yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus menu ini?</p>
          <div class="flex gap-3 w-full">
            <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" on:click={cancelDeleteMenu}>Batal</button>
            <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" on:click={doDeleteMenu}>Hapus</button>
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
          <button class="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200" on:click={cancelDeleteKategori} aria-label="Tutup">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <svelte:component this={Trash} class="w-8 h-8 text-red-500" />
          </div>
          <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Kategori?</h2>
          <p class="text-gray-500 text-sm mb-6 text-center">Kategori yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus kategori ini?</p>
          <div class="flex gap-3 w-full">
            <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" on:click={cancelDeleteKategori}>Batal</button>
            <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" on:click={doDeleteKategori}>Hapus</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Delete Confirmation Modal Ekstra -->
    {#if showDeleteEkstraModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 relative flex flex-col items-center">
          <div class="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <svelte:component this={Trash} class="w-8 h-8 text-red-500" />
          </div>
          <h2 class="text-lg font-bold text-gray-800 mb-2 text-center">Hapus Ekstra?</h2>
          <p class="text-gray-500 text-sm mb-6 text-center">Ekstra yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus ekstra ini?</p>
          <div class="flex gap-3 w-full">
            <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors" on:click={cancelDeleteEkstra}>Batal</button>
            <button class="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" on:click={doDeleteEkstra}>Hapus</button>
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
                  on:input={(e) => {
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
              on:click={() => showEkstraForm = false}
            >
              Batal
            </button>
            <button 
              class="flex-1 py-3 px-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors text-base shadow-md"
              on:click={saveEkstra}
              disabled={!ekstraForm.name.trim() || !ekstraForm.harga || isNaN(parseInt(ekstraForm.harga.toString().replace(/[^\d]/g, ''))) || parseInt(ekstraForm.harga.toString().replace(/[^\d]/g, '')) <= 0}
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
        on:click={() => goto('/pengaturan')}
      >
        Kembali ke Pengaturan
      </button>
    </div>
  </div>
{/if} 