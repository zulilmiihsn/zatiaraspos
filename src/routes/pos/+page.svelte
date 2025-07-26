  <script lang="ts">
import ModalSheet from '$lib/components/shared/ModalSheet.svelte';
import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { validateNumber, sanitizeInput } from '$lib/utils/validation';
import { SecurityMiddleware } from '$lib/utils/security';
import { fly, fade } from 'svelte/transition';
import { slide } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { posGridView } from '$lib/stores/posGridView';
import { 
  debounce, 
  throttle, 
  memoize, 
  measureAsyncPerformance,
  calculateCartTotal,
  fuzzySearch
} from '$lib/utils/performance';
import { userRole } from '$lib/stores/userRole';
import { selectedBranch } from '$lib/stores/selectedBranch';
import { dataService, realtimeManager } from '$lib/services/dataService';
let currentUserRole = '';
userRole.subscribe(val => currentUserRole = val || '');

import { browser } from '$app/environment';
let sesiAktif = null;
async function cekSesiTokoAktif() {
  const { data } = await dataService.supabaseClient
    .from('sesi_toko')
    .select('*')
    .eq('is_active', true)
    .order('opening_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  sesiAktif = data || null;
}

onMount(() => {
  cekSesiTokoAktif();
  if (browser) {
    window.addEventListener('openTokoModal', cekSesiTokoAktif);
  }
});

let produkData = [];
let kategoriData = [];
let tambahanData = [];

let isLoadingProducts = true;

let unsubscribeBranch: (() => void) | null = null;
let isInitialLoad = true; // Add flag to prevent double fetching

onMount(async () => {
  // Load data dengan smart caching
  await loadPOSData();
  
  // Setup real-time subscriptions
  setupRealtimeSubscriptions();
  
  // Measure performance untuk data fetching
  await measureAsyncPerformance('data fetching', async () => {
    await loadPOSData();
  });
  
  isLoadingProducts = false;
  
  // Sync otomatis saat online dengan throttling
  if (typeof window !== 'undefined') {
    const throttledSync = throttle(async () => {
      await loadPOSData();
    }, 1000); // Throttle to 1 second

    window.addEventListener('online', throttledSync);
  }

  // Subscribe ke selectedBranch untuk fetch ulang data saat cabang berubah
  unsubscribeBranch = selectedBranch.subscribe(() => {
    // Skip jika ini adalah initial load
    if (isInitialLoad) {
      isInitialLoad = false;
      return;
    }
    loadPOSData();
  });
});

onDestroy(() => {
  if (unsubscribeBranch) unsubscribeBranch();
  realtimeManager.unsubscribeAll();
});

// Load POS data dengan smart caching
async function loadPOSData() {
  try {
    // Load products dengan cache
    produkData = await dataService.getProducts();
    
    // Load categories dengan cache
    kategoriData = await dataService.getCategories();
    
    // Load add-ons dengan cache
    tambahanData = await dataService.getAddOns();
    
  } catch (error) {
    // console.error('Error loading POS data:', error);
  }
}

// Setup real-time subscriptions
function setupRealtimeSubscriptions() {
  // Subscribe to product changes
  realtimeManager.subscribe('produk', async (payload) => {
    // console.log('Product update received:', payload);
    produkData = await dataService.getProducts();
  });
  
  // Subscribe to category changes
  realtimeManager.subscribe('kategori', async (payload) => {
    // console.log('Category update received:', payload);
    kategoriData = await dataService.getCategories();
  });
  
  // Subscribe to add-on changes
  realtimeManager.subscribe('tambahan', async (payload) => {
    // console.log('Add-on update received:', payload);
    tambahanData = await dataService.getAddOns();
  });
}

// Touch handling dengan throttling
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isSwiping = false;
let isTouchDevice = false;
let clickBlocked = false;

// Throttled touch handlers
const throttledTouchMove = throttle((e: TouchEvent) => {
  if (!isTouchDevice) return;
  const touch = e.touches[0];
  const deltaX = Math.abs(touch.clientX - touchStartX);
  const deltaY = Math.abs(touch.clientY - touchStartY);
  
  if (deltaX > deltaY && deltaX > 10) {
    isSwiping = true;
    clickBlocked = true;
  }
}, 16); // ~60fps

const throttledTouchEnd = throttle(() => {
  if (isTouchDevice) {
    setTimeout(() => {
      isSwiping = false;
      clickBlocked = false;
    }, 100);
  }
}, 16);

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  isTouchDevice = true;
}

function handleTouchMove(e: TouchEvent) {
  throttledTouchMove(e);
}

function handleTouchEnd() {
  throttledTouchEnd();
}

const navs = [
  { label: 'Beranda', path: '/' },
  { label: 'Kasir', path: '/pos' },
  { label: 'Catat', path: '/catat' },
  { label: 'Laporan', path: '/laporan' },
];

// Kategori produk
let selectedCategory = 'all';

// Produk mock dengan kategori
let products: any[] = [];
$: products = produkData;

// Topping mock tanpa emoji/icon
let addOns: any[] = [];
$: addOns = tambahanData;

// Jenis gula dan es
const sugarOptions = [
  { id: 'no', label: 'Tanpa Gula' },
  { id: 'less', label: 'Sedikit Gula' },
  { id: 'normal', label: 'Normal' },
];
const iceOptions = [
  { id: 'no', label: 'Tanpa Es' },
  { id: 'less', label: 'Sedikit Es' },
  { id: 'normal', label: 'Normal' },
];

let showModal = false;
let selectedProduct = null;
let selectedAddOns: number[] = [];
let selectedSugar = 'normal';
let selectedIce = 'normal';
let qty = 1;
let selectedNote = '';

// Keranjang sementara
let cart: Array<any> = [];

// Untuk track error gambar per produk (pakai string key)
let imageError: Record<string, boolean> = {};

// Search produk dengan debounce
let search = '';

// Debounced search dengan optimasi
const debouncedSearch = debounce((value: string) => {
  search = value;
}, 300);

function handleSearchInput(value: string) {
  debouncedSearch(value);
}

// Memoized computed values untuk performance
const memoizedCartTotal = memoize(calculateCartTotal);
$: cartTotal = memoizedCartTotal(cart);
$: totalItems = cartTotal.items;
$: totalHarga = cartTotal.total;

// Memoized filtered products dengan optimasi
const memoizedFilter = memoize((products: any[], categories: any[], selectedCategory: string, search: string) => {
  let filtered = products;
  // Filter berdasarkan search
  if (search) {
    filtered = fuzzySearch(search, products);
  }
  // Filter berdasarkan kategori
  if (selectedCategory !== 'all') {
    filtered = filtered.filter(p => p.kategori_id === selectedCategory);
  }
  return filtered;
}, (products, categories, selectedCategory, search) => 
  `${products.length}-${categories.length}-${selectedCategory}-${search}`
);

$: filteredProducts = memoizedFilter(products, categories, selectedCategory, search);

let showCartModal = false;
function openCartModal() {
  showModal = false;
  showCartModal = true;
}
function closeCartModal() {
  showCartModal = false;
}
function removeCartItem(idx) { cart = cart.filter((_, i) => i !== idx); }

function openAddOnModal(product) {
  showCartModal = false;
  selectedProduct = product;
  selectedAddOns = [];
  selectedSugar = 'normal';
  selectedIce = 'normal';
  qty = 1;
  selectedNote = '';
  showModal = true;
}

function closeModal() {
  showModal = false;
}

function toggleAddOn(id) {
  if (selectedAddOns.includes(id)) {
    selectedAddOns = selectedAddOns.filter(a => a !== id);
  } else {
    selectedAddOns = [...selectedAddOns, id];
  }
}

// Optimized cart operations
function addToCart() {
  // Blokir kasir jika sesi toko belum dibuka
  if (currentUserRole === 'kasir' && !sesiAktif) {
    showErrorNotif('Toko belum dibuka. Silakan buka toko terlebih dahulu!');
    return;
  }
  // Validate quantity
  const qtyValidation = validateNumber(qty, { required: true, min: 1, max: 99 });
  if (!qtyValidation.isValid) {
    showErrorNotif(`Error: ${qtyValidation.errors.join(', ')}`);
    return;
  }
  
  // Check rate limiting
  if (!SecurityMiddleware.checkFormRateLimit('pos_add_to_cart')) {
    showErrorNotif('Terlalu banyak item ditambahkan. Silakan tunggu sebentar.');
    return;
  }
  
  // Sanitize inputs
  const sanitizedSugar = sanitizeInput(selectedSugar);
  const sanitizedIce = sanitizeInput(selectedIce);
  
  // Check for suspicious activity
  const allInputs = `${selectedProduct?.name}${sanitizedSugar}${sanitizedIce}${qty}`;
  if (SecurityMiddleware.detectSuspiciousActivity('pos_add_to_cart', allInputs)) {
    showErrorNotif('Aktivitas mencurigakan terdeteksi. Silakan coba lagi.');
    SecurityMiddleware.logSecurityEvent('suspicious_cart_activity', {
      product: selectedProduct?.name,
      qty,
      sugar: sanitizedSugar,
      ice: sanitizedIce
    });
    return;
  }
  
  // Optimized cart item check dengan memoization
  const addOnsSelected = addOns.filter(a => selectedAddOns.includes(a.id));
  const addOnsKey = addOnsSelected.map(a => a.id).sort().join(',');
  const itemKey = `${selectedProduct.id}-${addOnsKey}-${sanitizedSugar}-${sanitizedIce}-${selectedNote.trim()}`;
  
  const existingIdx = cart.findIndex(item => {
    const itemAddOnsKey = (item.addOns || []).map(a => a.id).sort().join(',');
    const currentItemKey = `${item.product.id}-${itemAddOnsKey}-${item.sugar}-${item.ice}-${item.note}`;
    return currentItemKey === itemKey;
  });
  
  if (existingIdx !== -1) {
    // Jika sudah ada, tambahkan qty
    cart = cart.map((item, idx) => idx === existingIdx ? { ...item, qty: item.qty + qty } : item);
  } else {
    // Jika belum ada, tambahkan item baru
    cart = [
      ...cart,
      {
        product: selectedProduct,
        addOns: addOnsSelected,
        sugar: sanitizedSugar,
        ice: sanitizedIce,
        qty,
        note: selectedNote.trim(),
      },
    ];
  }
  
  // Log successful add to cart
  SecurityMiddleware.logSecurityEvent('product_added_to_cart', {
    product: selectedProduct?.name,
    qty,
    totalItems: cart.length
  });
  
  showModal = false;
}

function handleImgError(id: string) {
  imageError = { ...imageError, [id]: true };
}

function goToBayar() {
  showCartModal = false;
  goto('/pos/bayar');
}

function incQty() {
  if (qty < 99) qty++;
}
function decQty() {
  if (qty > 1) qty--;
}

let cartPreviewX = 0;
let cartPreviewStartX = 0;
let cartPreviewDragging = false;
let cartPreviewRef;
let cartPreviewWidth = 0;
let showSnackbar = false;
let snackbarMsg = '';
let prevCartLength = 0;

function handleCartPreviewTouchStart(e) {
  if (e.touches.length !== 1) return;
  cartPreviewDragging = true;
  cartPreviewStartX = e.touches[0].clientX;
  cartPreviewWidth = cartPreviewRef?.offsetWidth || 1;
}
function handleCartPreviewTouchMove(e) {
  if (!cartPreviewDragging) return;
  const deltaX = e.touches[0].clientX - cartPreviewStartX;
  cartPreviewX = Math.min(0, deltaX); // hanya ke kiri
}
function handleCartPreviewTouchEnd() {
  if (!cartPreviewDragging) return;
  cartPreviewDragging = false;
  if (Math.abs(cartPreviewX) > cartPreviewWidth * 0.6) {
    cart = [];
    cartPreviewX = -cartPreviewWidth;
    showSnackbar = true;
    snackbarMsg = 'Keranjang dikosongkan';
    setTimeout(() => { showSnackbar = false; }, 1800);
  } else {
    cartPreviewX = 0;
  }
}

$: {
  if (prevCartLength === 0 && cart.length > 0 && !cartPreviewDragging) {
    cartPreviewX = 0;
  }
  prevCartLength = cart.length;
}

function handleGlobalClick(e) {
  if (clickBlocked) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

let categories = [];
$: categories = kategoriData;

let skeletonCount = 9;
if (typeof window !== 'undefined') {
  if (window.innerWidth < 768) {
  skeletonCount = 6;
  } else if (window.innerWidth >= 1024) {
    skeletonCount = 12;
  } else {
    skeletonCount = 9;
  }
}

let showErrorNotification = false;
let errorNotificationMessage = '';
let errorNotificationTimeout: any = null;

function showErrorNotif(message: string) {
  errorNotificationMessage = message;
  showErrorNotification = true;
  clearTimeout(errorNotificationTimeout);
  errorNotificationTimeout = setTimeout(() => {
    showErrorNotification = false;
  }, 3000);
}

let showCustomItemModal = false;
let customItemName = '';
let customItemPriceRaw = '';
let customItemPriceFormatted = '';
let customItemNote = '';

function formatRupiahInput(value) {
  // Hanya angka
  const numberString = value.replace(/[^\d]/g, '');
  if (!numberString) return '';
  return numberString.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function handleCustomPriceInput(e) {
  const raw = e.target.value.replace(/[^\d]/g, '');
  customItemPriceRaw = raw;
  customItemPriceFormatted = formatRupiahInput(raw);
}

function addCustomItemToCart(e?: Event) {
  if (e) e.preventDefault();
  if (!customItemName.trim() || !customItemPriceRaw || isNaN(Number(customItemPriceRaw)) || Number(customItemPriceRaw) <= 0) return;
  cart = [
    ...cart,
    {
      product: { id: `custom-${Date.now()}`, name: customItemName.trim(), harga: Number(customItemPriceRaw), price: Number(customItemPriceRaw), tipe: 'custom' },
      addOns: [],
      sugar: '',
      ice: '',
      qty: qty, // Gunakan qty dari modal
      note: customItemNote.trim(),
    },
  ];
  showCustomItemModal = false;
  customItemName = '';
  customItemPriceRaw = '';
  customItemPriceFormatted = '';
  customItemNote = '';
}

// Helper untuk ambil nama kategori dari kategori_id
function getKategoriNameById(id) {
  if (!id) return '';
  const kat = categories?.find(k => k.id === id);
  return kat?.name || '';
}

// Sinkronisasi cart ke localStorage setiap kali cart berubah
$: if (typeof window !== 'undefined') {
  localStorage.setItem('pos_cart', JSON.stringify(cart));
}

function handleSelectCategoryAll() { selectedCategory = 'all'; }
function handleSelectCategory(id) { selectedCategory = id; }
function handleOpenAddOnModal(product) { openAddOnModal(product); }
function handleShowCustomItemModal() { showCustomItemModal = true; }
function handleImgErrorId(id) { handleImgError(String(id)); }
function handleGoToBayar(e) { e.stopPropagation(); goToBayar(); }
function handleStopPropagation(e) { e.stopPropagation(); }
function handleRemoveCartItem(idx) { removeCartItem(idx); }
function handleKeydownOpenAddOnModal(product, e) { if (e.key === 'Enter') openAddOnModal(product); }
</script>

<div 
  class="flex flex-col h-100vh bg-white w-full max-w-full overflow-x-hidden overflow-y-auto"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  onclick={handleGlobalClick}
  onkeydown={(e) => e.key === 'Escape' && handleGlobalClick(e)}
  role="button"
  tabindex="0"
>
  <main class="flex-1 w-full max-w-full overflow-x-hidden page-content"
    style="scrollbar-width:none;-ms-overflow-style:none;"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <div class="bg-white px-4 py-4 md:py-8 lg:py-10 flex items-center gap-3">
      <div class="relative w-full">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" /></svg>
        </span>
        <input
          class="flex-1 border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-base bg-gray-50 text-gray-800 outline-none focus:border-pink-400 w-full"
          type="text"
          placeholder="Cari produk..."
          bind:value={search}
          autocomplete="off"
          oninput={(e) => handleSearchInput(e.target.value)}
        />
      </div>
    </div>
    <div class="flex gap-2 overflow-x-auto px-4 py-2 bg-white -mt-2 md:-mt-4 lg:-mt-6" style="scrollbar-width:none;-ms-overflow-style:none;">
      <button
        class="flex-shrink-0 min-w-[96px] px-4 py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 mb-1 {selectedCategory === 'all' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-500'}"
        type="button"
        onclick={handleSelectCategoryAll}
      >Semua</button>
      {#if (categories ?? []).length === 0 && isLoadingProducts}
        {#each Array(4) as _, i}
          <div class="flex-shrink-0 min-w-[96px] h-[40px] rounded-lg bg-gray-100 animate-pulse mb-1"></div>
        {/each}
      {:else if (categories ?? []).length === 0}
        <!-- Button Custom Item di samping 'Semua' jika tidak ada kategori -->
        <button class="flex-shrink-0 min-w-[48px] w-12 px-3 py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 mb-1 bg-pink-500 text-white border-pink-500 flex items-center justify-center" type="button" onclick={handleShowCustomItemModal}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
        <div class="flex items-center gap-2 h-[40px] px-4 text-sm text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Belum ada kategori</span>
        </div>
      {:else}
        {#each categories ?? [] as c}
          <button
            class="flex-shrink-0 min-w-[96px] px-4 py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 mb-1 {selectedCategory === c.id ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-500'}"
            type="button"
            onclick={() => handleSelectCategory(c.id)}
          >{c.name}</button>
        {/each}
        <!-- Button Custom Item di paling kanan -->
        <button class="flex-shrink-0 min-w-[96px] px-4 py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 mb-1 bg-pink-500 text-white border-pink-500 flex items-center gap-2" type="button" onclick={handleShowCustomItemModal}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
          Menu Kustom
        </button>
      {/if}
    </div>
    <div class="flex-1 w-full max-w-full px-0" style="min-height:0;">
      <div class="overflow-y-auto h-[calc(100vh-112px-48px)] md:h-[calc(100vh-128px-48px)] lg:h-[calc(100vh-160px-48px)]" style="scrollbar-width:none;-ms-overflow-style:none;">
    {#if $posGridView}
      <div class="flex flex-col gap-1 px-4 pb-4 min-h-[60vh]" transition:slide={{ duration: 250 }}>
        {#if isLoadingProducts}
          {#each Array(skeletonCount) as _, i}
            <div class="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 animate-pulse rounded-lg shadow-md flex items-center justify-between px-3 py-2 min-h-[56px] max-h-[80px] cursor-pointer transition-shadow border border-gray-100"></div>
          {/each}
        {:else if filteredProducts.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-center min-h-[50vh] pointer-events-none">
            <div class="text-6xl mb-2">🍽️</div>
            <div class="text-base font-semibold text-gray-700 mb-1">Belum ada Menu</div>
            <div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
          </div>
        {:else}
          {#each filteredProducts as p}
            <div class="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-pink-50 transition-colors" tabindex="0" onclick={() => handleOpenAddOnModal(p)} onkeydown={(e) => handleKeydownOpenAddOnModal(p, e)} role="button" aria-label="Tambah {p.name} ke keranjang">
              <div class="flex flex-col flex-1 min-w-0">
                <span class="font-medium text-gray-800 text-sm truncate mb-0.5">{p.name}</span>
                <span class="text-xs text-gray-400 truncate min-h-[18px] mb-0.5">{getKategoriNameById(p.kategori_id)}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-pink-500 font-bold text-base whitespace-nowrap">Rp {Number(p.price ?? p.harga ?? 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-3 px-4 pb-4 min-h-0 md:grid-cols-3 md:gap-6 md:px-8 md:pb-8 lg:grid-cols-6" transition:slide={{ duration: 250 }}>
        {#if isLoadingProducts}
          {#each Array(skeletonCount) as _, i}
            <div class="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 animate-pulse rounded-xl shadow-md flex flex-col items-center justify-between p-2.5 aspect-[3/4] max-h-[260px] min-h-[140px] cursor-pointer transition-shadow border border-gray-100 md:p-6 md:max-h-[320px] md:min-h-[180px]" />
          {/each}
        {:else if filteredProducts.length === 0}
          <div class="col-span-2 md:col-span-3 flex flex-col items-center justify-center py-12 text-center min-h-[50vh] pointer-events-none">
            <div class="text-6xl mb-2">🍽️</div>
            <div class="text-base font-semibold text-gray-700 mb-1">Belum ada Menu</div>
            <div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
          </div>
        {:else}
          {#each filteredProducts as p}
            <div class="bg-white rounded-xl shadow-md border border-gray-100 p-3 flex flex-col items-center justify-between aspect-[3/4] max-h-[260px] min-h-[140px] cursor-pointer transition-shadow md:p-6 md:max-h-[320px] md:min-h-[180px] md:gap-3 md:hover:shadow-lg md:rounded-2xl" tabindex="0" onclick={() => handleOpenAddOnModal(p)} onkeydown={(e) => handleKeydownOpenAddOnModal(p, e)} role="button" aria-label="Tambah {p.name} ke keranjang">
              {#if (p.gambar || p.image) && !imageError[String(p.id)]}
                <img class="w-full h-full object-cover rounded-xl aspect-square min-h-[80px] mb-2 md:mb-3 md:rounded-2xl" src={p.gambar || p.image} alt={p.name} loading="lazy" onerror={() => handleImgErrorId(p.id)} />
              {:else}
                <div class="w-full aspect-square min-h-[80px] rounded-xl flex items-center justify-center mb-2 md:mb-3 overflow-hidden text-4xl md:text-5xl bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 md:rounded-2xl">🍹</div>
              {/if}
              <div class="w-full flex flex-col items-center">
                <h3 class="font-semibold text-gray-800 text-sm truncate w-full text-center mb-0.5 md:text-lg md:mb-1">{p.name}</h3>
                <span class="text-xs text-gray-400 truncate min-h-[18px] md:text-sm">{getKategoriNameById(p.kategori_id)}</span>
                <div class="text-pink-500 font-bold text-base md:text-xl md:mt-1">Rp {Number(p.price ?? p.harga ?? 0).toLocaleString('id-ID')}</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/if}
        <!-- Tombol Custom Item -->
        <!-- Modal Custom Item -->
        {#if showCustomItemModal}
          <ModalSheet bind:open={showCustomItemModal} title={customItemName ? customItemName : 'Menu Kustom'} on:close={() => showCustomItemModal = false}>
            <div class="overflow-y-auto flex-1 min-h-0 addon-list addon-modal-content pb-48" onclick={handleStopPropagation} onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()} style="scrollbar-width:none;-ms-overflow-style:none;" role="button" tabindex="0">
              <div class="mb-6 mt-4">
                <label class="font-semibold text-gray-800 text-base mb-2 block" for="custom-nama">Nama Menu</label>
                <input id="custom-nama" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base font-semibold focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white text-gray-800 outline-none" type="text" bind:value={customItemName} required maxlength="50" placeholder="Contoh: Jus Mangga Spesial" />
              </div>
              <div class="mb-6">
                <label class="font-semibold text-gray-800 text-base mb-2 block mt-4" for="custom-harga">Harga</label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">Rp</span>
                  <input id="custom-harga" class="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-base font-semibold focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white text-gray-800 outline-none" type="text" inputmode="numeric" pattern="[0-9]*" min="1" max="99999999" value={customItemPriceFormatted} oninput={handleCustomPriceInput} required placeholder="0" />
                </div>
              </div>
              <div class="mb-6">
                <label class="font-semibold text-gray-800 text-base mb-2 block mt-4" for="custom-catatan">Catatan</label>
                <textarea id="custom-catatan" class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base font-normal focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white text-gray-800 outline-none" bind:value={customItemNote} maxlength="100" rows="2" placeholder="Contoh: Tanpa gula, es sedikit, dsb"></textarea>
              </div>
              <div class="font-semibold text-gray-800 mb-2 mt-0 text-base">Jumlah</div>
              <div class="flex items-center justify-center gap-3 mb-4">
                <button class="w-10 h-10 rounded-lg border border-pink-400 text-pink-400 text-xl font-bold flex items-center justify-center transition-colors duration-150" type="button" onclick={decQty}>-</button>
                <input class="w-12 text-center text-lg font-semibold border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-800 outline-none" type="number" min="1" max="99" bind:value={qty} />
                <button class="w-10 h-10 rounded-lg border border-pink-400 text-pink-400 text-xl font-bold flex items-center justify-center transition-colors duration-150" type="button" onclick={incQty}>+</button>
              </div>
              <div class="flex gap-3 mt-2">
                <button type="button" class="bg-pink-500 text-white font-bold text-lg rounded-lg px-6 py-3 w-full mb-1 shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700" onclick={addCustomItemToCart}>Tambah ke Keranjang</button>
              </div>
            </div>
          </ModalSheet>
        {/if}
      </div>
    </div>

    {#if cart.length > 0}
      <div
        bind:this={cartPreviewRef}
        class="fixed left-0 right-0 bottom-16 flex items-center justify-between bg-white border-t-2 border-gray-100 shadow-md px-6 py-3 z-20 rounded-t-lg min-h-[56px] text-base font-medium text-gray-900"
        style="transform: translateX({cartPreviewX}px); transition: {cartPreviewDragging ? 'none' : 'transform 0.25s cubic-bezier(.4,0,.2,1)'}; touch-action: pan-y;"
        ontouchstart={handleCartPreviewTouchStart}
        ontouchmove={handleCartPreviewTouchMove}
        ontouchend={handleCartPreviewTouchEnd}
        transition:fly={{ x: -64, duration: 320, opacity: 0.9 }}
      >
        <div class="flex flex-col justify-center flex-1 cursor-pointer select-none" onclick={openCartModal} onkeydown={(e) => e.key === 'Enter' && openCartModal()} role="button" tabindex="0" aria-label="Buka keranjang belanja" style="min-width:0;">
          <div class="text-sm text-gray-500 truncate">{totalItems} item pesanan</div>
          <div class="font-bold text-pink-500 text-lg truncate">Rp {Number(totalHarga ?? 0).toLocaleString('id-ID')}</div>
        </div>
        <div class="flex items-center justify-center ml-4">
          <button class="bg-pink-500 text-white font-bold text-lg rounded-lg px-6 py-2 shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700 flex items-center justify-center" onclick={handleGoToBayar}>Bayar</button>
        </div>
      </div>
    {/if}

    {#if showCartModal}
      <ModalSheet bind:open={showCartModal} title="Keranjang" on:close={closeCartModal}>
        <div class="flex-1 overflow-y-auto px-0 py-2 min-h-0" onclick={handleStopPropagation} onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()}
          style="scrollbar-width:none;-ms-overflow-style:none;"
          role="button"
          tabindex="0"
        >
          {#each cart as item, idx}
            <div class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mb-3 shadow-sm">
              <div class="flex flex-col min-w-0">
                <div class="text-base font-semibold text-gray-900 mb-0.5 truncate">{item.qty}x {item.product.name}</div>
                <div class="text-xs text-gray-500 font-medium">
                  {[
                    item.addOns && item.addOns.length > 0 ? item.addOns.map(a => a.name).join(', ') : '',
                    item.note ? `${item.note}` : '',
                    item.product.tipe === 'minuman' && item.sugar !== 'normal' ? (sugarOptions.find(s => s.id === item.sugar)?.label ?? item.sugar) : '',
                    item.product.tipe === 'minuman' && item.ice !== 'normal' ? (iceOptions.find(i => i.id === item.ice)?.label ?? item.ice) : ''
                  ].filter(Boolean).join(', ')}
                </div>
                <div class="text-pink-500 font-bold text-base mt-1">Rp {Number(item.product.price ?? item.product.harga ?? 0).toLocaleString('id-ID')}</div>
              </div>
              <button class="bg-red-500 text-white rounded-lg px-4 py-2 text-sm font-semibold" onclick={() => handleRemoveCartItem(idx)}>Hapus</button>
            </div>
          {/each}
        </div>
        <div slot="footer">
          <button class="bg-pink-500 text-white font-bold text-lg rounded-lg px-6 py-3 w-full mb-1 shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700" onclick={handleGoToBayar}>Bayar</button>
        </div>
      </ModalSheet>
    {/if}

    {#if showSnackbar}
      <div class="fixed left-1/2 bottom-28 -translate-x-1/2 bg-gray-900 text-white rounded-lg px-4 py-2 z-50 text-sm shadow-lg animate-fadeInOut">{snackbarMsg}</div>
    {/if}

    {#if showErrorNotification}
      <div 
        class="fixed top-20 left-1/2 z-[9999] bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 ease-out w-full max-w-xs md:max-w-md"
        style="transform: translateX(-50%);"
        in:fly={{ y: -32, duration: 300, easing: cubicOut }}
        out:fade={{ duration: 200 }}
      >
        {errorNotificationMessage}
      </div>
    {/if}

    {#if showModal}
      <ModalSheet bind:open={showModal} title={selectedProduct ? selectedProduct.name : ''} on:close={closeModal}>
        <div class="overflow-y-auto flex-1 min-h-0 addon-list addon-modal-content pb-48" onclick={handleStopPropagation} onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()}
          style="scrollbar-width:none;-ms-overflow-style:none;"
          role="button"
          tabindex="0"
        >
          {#if selectedProduct && selectedProduct.tipe === 'minuman'}
            <div class="font-semibold text-gray-800 mb-2 mt-4 text-base">Jenis Gula</div>
            <div class="flex gap-2 mb-3">
              {#each sugarOptions as s}
                <button
                  class="flex-1 px-0 py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 {selectedSugar === s.id ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-500'}"
                  type="button"
                  onclick={() => selectedSugar = s.id}
                >{s.label}</button>
              {/each}
            </div>
          {/if}
          {#if selectedProduct && selectedProduct.tipe === 'minuman'}
            <div class="font-semibold text-gray-800 mb-2 mt-4 text-base">Jenis Es</div>
            <div class="flex gap-2 mb-3">
              {#each iceOptions as i}
                <button
                  class="flex-1 px-0 py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 {selectedIce === i.id ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-500'}"
                  type="button"
                  onclick={() => selectedIce = i.id}
                >{i.label}</button>
              {/each}
            </div>
          {/if}
          <div class="font-semibold text-gray-800 mb-2 mt-4 text-base">Ekstra</div>
          {#if selectedProduct && selectedProduct.ekstra_ids && selectedProduct.ekstra_ids.length > 0 && addOns.filter(a => selectedProduct.ekstra_ids.includes(a.id)).length > 0}
            <div class="grid grid-cols-2 gap-3 mb-6">
              {#each addOns.filter(a => selectedProduct.ekstra_ids.includes(a.id)) as a}
                <button
                  class="w-full justify-center py-1.5 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 flex flex-col items-center text-center whitespace-normal overflow-hidden {selectedAddOns.includes(a.id) ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-500'}"
                  type="button"
                  onclick={() => toggleAddOn(a.id)}
                >
                  <span class="truncate w-full">{a.name}</span>
                  <span class="font-semibold mt-0 text-sm {selectedAddOns.includes(a.id) ? 'text-white' : 'text-pink-500'}">+Rp {Number(a.price ?? a.harga ?? 0).toLocaleString('id-ID')}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="mb-6 text-sm text-gray-400 font-medium text-center">Tidak ada ekstra untuk menu ini.</div>
          {/if}
          <div class="font-semibold text-gray-800 mb-2 mt-4 text-base">Catatan</div>
          <textarea
            class="w-full border-[1.5px] border-pink-200 rounded-lg px-3 py-2.5 text-base bg-white text-gray-800 outline-none transition-colors duration-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 mb-1 resize-none"
            placeholder="Contoh: Tidak terlalu manis, tambah es batu, dll..."
            bind:value={selectedNote}
            rows="3"
            maxlength="200"
            oninput={(e) => { selectedNote = capitalizeFirst(e.target.value); }}
          ></textarea>
          <div class="text-xs text-gray-500 text-right mt-1">{selectedNote.length}/200</div>
        </div>
        <div slot="footer">
          <div class="font-semibold text-gray-800 mb-2 mt-0 text-base">Jumlah</div>
          <div class="flex items-center justify-center gap-3 mb-4">
            <button class="w-10 h-10 rounded-lg border border-pink-400 text-pink-400 text-xl font-bold flex items-center justify-center transition-colors duration-150" type="button" onclick={decQty}>-</button>
            <input class="w-12 text-center text-lg font-semibold border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-800 outline-none" type="number" min="1" max="99" bind:value={qty} />
                      <button class="w-10 h-10 rounded-lg border border-pink-400 text-pink-400 text-xl font-bold flex items-center justify-center transition-colors duration-150" type="button" onclick={incQty}>+</button>
          </div>
                  <button class="bg-pink-500 text-white font-bold text-lg rounded-lg px-6 py-3 w-full mb-1 shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700" onclick={addToCart}>Tambah ke Keranjang</button>
        </div>
      </ModalSheet>
    {/if}
  </main>
</div>

<style>
@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(16px); }
  10% { opacity: 1; transform: translateY(0); }
  90% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-8px); }
}
.animate-fadeInOut {
  animation: fadeInOut 1.8s cubic-bezier(.4,0,.2,1);
}
.animate-pulse {
  animation: pulse 1.2s cubic-bezier(.4,0,.6,1) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style> 