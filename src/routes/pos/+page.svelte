<script lang="ts">
import ModalSheet from '$lib/components/shared/ModalSheet.svelte';
import ImagePlaceholder from '$lib/components/shared/ImagePlaceholder.svelte';
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import BottomNav from '$lib/components/shared/BottomNav.svelte';
import { validateNumber, sanitizeInput } from '$lib/validation.js';
import { SecurityMiddleware } from '$lib/security.js';
import { fly } from 'svelte/transition';
import { slide } from 'svelte/transition';
import { supabase } from '$lib/database/supabaseClient';
import { posGridView } from '$lib/stores/posGridView';

// Lazy load icons
let Home, ShoppingBag, FileText, Book, Settings;
let isLoadingProducts = true;

onMount(async () => {
  const icons = await Promise.all([
    import('lucide-svelte/icons/home'),
    import('lucide-svelte/icons/shopping-bag'),
    import('lucide-svelte/icons/file-text'),
    import('lucide-svelte/icons/book'),
    import('lucide-svelte/icons/settings')
  ]);
  Home = icons[0].default;
  ShoppingBag = icons[1].default;
  FileText = icons[2].default;
  Book = icons[3].default;
  Settings = icons[4].default;

  await fetchCategories();
  await fetchAddOns();
  await fetchProducts();
  isLoadingProducts = false;
});

async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: false });
  if (!error) categories = data;
}
async function fetchProducts() {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (!error) products = data;
}
async function fetchAddOns() {
  const { data, error } = await supabase.from('add_ons').select('*').order('created_at', { ascending: false });
  if (!error) addOns = data;
}

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

// Kategori produk
let selectedCategory = 'all';

// Produk mock dengan kategori
let products = [];

// Topping mock tanpa emoji/icon
let addOns = [];

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

// Search produk
let search = '';

// Debounced search for better performance
let searchTimeout;
function handleSearchInput(value) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    search = value;
  }, 300); // 300ms delay
}

// Memoized computed values for performance
$: totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
$: totalHarga = cart.reduce((sum, item) => {
  const itemPrice = (item.product.price ?? item.product.harga ?? 0) * item.qty;
  const addOnsPrice = item.addOns ? item.addOns.reduce((a, b) => a + ((b.price ?? b.harga ?? 0) * item.qty), 0) : 0;
  return sum + itemPrice + addOnsPrice;
}, 0);

// Memoized filtered products
$: filteredProducts = products.filter(p => {
  // Filter berdasarkan kategori
  if (selectedCategory !== 'all' && p.kategori !== categories.find(c => c.id === selectedCategory)?.name) {
    return false;
  }
  // Filter berdasarkan search
  if (search) {
    return p.name.toLowerCase().includes(search.toLowerCase()) ||
           (p.kategori ?? '').toLowerCase().includes(search.toLowerCase());
  }
  return true;
});

let showCartModal = false;
function openCartModal() { showCartModal = true; }
function closeCartModal() { showCartModal = false; }
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

function addToCart() {
  // Validate quantity
  const qtyValidation = validateNumber(qty, { required: true, min: 1, max: 99 });
  if (!qtyValidation.isValid) {
    alert(`Error: ${qtyValidation.errors.join(', ')}`);
    return;
  }
  
  // Check rate limiting
  if (!SecurityMiddleware.checkFormRateLimit('pos_add_to_cart')) {
    alert('Terlalu banyak item ditambahkan. Silakan tunggu sebentar.');
    return;
  }
  
  // Sanitize inputs
  const sanitizedSugar = sanitizeInput(selectedSugar);
  const sanitizedIce = sanitizeInput(selectedIce);
  
  // Check for suspicious activity
  const allInputs = `${selectedProduct?.name}${sanitizedSugar}${sanitizedIce}${qty}`;
  if (SecurityMiddleware.detectSuspiciousActivity('pos_add_to_cart', allInputs)) {
    alert('Aktivitas mencurigakan terdeteksi. Silakan coba lagi.');
    SecurityMiddleware.logSecurityEvent('suspicious_cart_activity', {
      product: selectedProduct?.name,
      qty,
      sugar: sanitizedSugar,
      ice: sanitizedIce
    });
    return;
  }
  
  // Cek apakah item dengan kombinasi sama sudah ada di cart
  const addOnsSelected = addOns.filter(a => selectedAddOns.includes(a.id));
  const existingIdx = cart.findIndex(item =>
    item.product.id === selectedProduct.id &&
    JSON.stringify(item.addOns.map(a => a.id).sort()) === JSON.stringify(addOnsSelected.map(a => a.id).sort()) &&
    item.sugar === sanitizedSugar &&
    item.ice === sanitizedIce &&
    item.note === selectedNote.trim()
  );
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
  localStorage.setItem('pos_cart', JSON.stringify(cart));
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

onMount(() => {
  // Detect touch device
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
});

function handleTouchStart(e) {
  if (!isTouchDevice) return;
  // Cek jika swipe di area preview keranjang, jangan trigger swipe navigasi
  if (cartPreviewRef && cartPreviewRef.contains(e.target)) return;
  
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
  if (cartPreviewRef && cartPreviewRef.contains(e.target)) return;
  
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
  if (cartPreviewRef && cartPreviewRef.contains(e.target)) return;
  
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
      const currentIndex = 1; // POS is index 1
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

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

let categories = [];

let skeletonCount = 9;
if (typeof window !== 'undefined' && window.innerWidth < 768) {
  skeletonCount = 6;
}
</script>

<div 
  class="flex flex-col h-100vh bg-white w-full max-w-full overflow-x-hidden"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  onclick={handleGlobalClick}
  onkeydown={(e) => e.key === 'Escape' && handleGlobalClick(e)}
  role="button"
  tabindex="0"
>
  <main class="flex-1 overflow-y-auto w-full max-w-full overflow-x-hidden page-content"
    style="scrollbar-width:none;-ms-overflow-style:none;"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <div class="sticky top-0 z-10 bg-white px-4 py-4 md:py-8 lg:py-10 flex items-center gap-3">
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
    <div class="flex gap-2 overflow-x-auto px-4 py-2 bg-white" style="scrollbar-width:none;-ms-overflow-style:none;" onwheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>
      <button
        class="flex-shrink-0 min-w-[96px] px-4 py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 mb-1 {selectedCategory === 'all' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-500'}"
        type="button"
        onclick={() => selectedCategory = 'all'}
      >Semua</button>
      {#if (categories ?? []).length === 0}
        <div class="flex items-center gap-2 h-[40px] px-4 text-sm text-gray-400">
          <span class="text-base" style="position:relative;top:-2px;">📁</span>
          <span>Belum ada Kategori</span>
        </div>
      {:else}
        {#each categories ?? [] as c}
          <button
            class="flex-shrink-0 min-w-[96px] px-4 py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 mb-1 {selectedCategory === c.id ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-500'}"
            type="button"
            onclick={() => selectedCategory = c.id}
          >{c.name}</button>
        {/each}
      {/if}
    </div>
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
            <div class="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-pink-50 transition-colors" tabindex="0" onclick={() => openAddOnModal(p)} onkeydown={(e) => e.key === 'Enter' && openAddOnModal(p)} role="button" aria-label="Tambah {p.name} ke keranjang">
              <div class="flex flex-col flex-1 min-w-0">
                <span class="font-medium text-gray-800 text-sm truncate">{p.name}</span>
                <span class="text-xs text-gray-400 truncate">{p.kategori ?? ''}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-pink-500 font-bold text-base whitespace-nowrap">Rp {(p.price ?? p.harga ?? 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-4 px-4 pb-4 min-h-[60vh]" transition:slide={{ duration: 250 }}>
        {#if isLoadingProducts}
          {#each Array(skeletonCount) as _, i}
            <div class="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 animate-pulse rounded-xl shadow-md flex flex-col items-center justify-between p-2.5 aspect-[3/3.7] max-h-[210px] min-h-[140px] cursor-pointer transition-shadow border border-gray-100"></div>
          {/each}
        {:else if filteredProducts.length === 0}
          <div class="col-span-2 flex flex-col items-center justify-center py-12 text-center min-h-[50vh] pointer-events-none">
            <div class="text-6xl mb-2">🍽️</div>
            <div class="text-base font-semibold text-gray-700 mb-1">Belum ada Menu</div>
            <div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
          </div>
        {:else}
          {#each filteredProducts as p}
            <div class="bg-white rounded-xl shadow-md flex flex-col items-center justify-between p-3 aspect-[3/4] max-h-[260px] min-h-[180px] cursor-pointer transition-shadow border border-gray-100" tabindex="0" onclick={() => openAddOnModal(p)} onkeydown={(e) => e.key === 'Enter' && openAddOnModal(p)} role="button" aria-label="Tambah {p.name} ke keranjang">
              {#if p.image && !imageError[String(p.id)]}
                <img class="w-20 h-20 object-cover rounded-lg mb-2 bg-gray-100 aspect-square" src={p.image} alt={p.name} loading="lazy" onerror={() => handleImgError(String(p.id))} />
              {:else}
                <div class="w-full aspect-square min-h-[80px] rounded-xl flex items-center justify-center mb-2 overflow-hidden text-4xl bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">🍹</div>
              {/if}
              <div class="w-full flex flex-col items-center">
                <h3 class="font-semibold text-gray-800 text-sm truncate w-full text-center mb-0.5">{p.name}</h3>
                <div class="text-pink-500 font-bold text-base">Rp {(p.price ?? p.harga ?? 0).toLocaleString('id-ID')}</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

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
          <div class="font-bold text-pink-500 text-lg truncate">Rp {totalHarga.toLocaleString('id-ID')}</div>
        </div>
        <div class="flex items-center justify-center ml-4">
          <button class="bg-pink-500 text-white font-bold text-lg rounded-lg px-6 py-2 shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700 flex items-center justify-center" onclick={(e) => { e.stopPropagation(); goToBayar(); }}>Bayar</button>
        </div>
      </div>
    {/if}

    {#if showCartModal}
      <ModalSheet open={showCartModal} title="Keranjang" on:close={closeCartModal}>
        <div class="flex-1 overflow-y-auto px-0 py-2 min-h-0"
          style="scrollbar-width:none;-ms-overflow-style:none;"
        >
          {#each cart as item, idx}
            <div class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mb-3 shadow-sm">
              <div class="flex flex-col min-w-0">
                <div class="text-base font-semibold text-gray-900 mb-0.5 truncate">{item.qty}x {item.product.name}</div>
                {#if (item.addOns && item.addOns.length > 0) || (item.sugar && item.sugar !== 'normal') || (item.ice && item.ice !== 'normal') || (item.note && item.note.trim())}
                  <div class="text-xs text-gray-500 font-medium">
                    {[
                      item.addOns && item.addOns.length > 0 ? `+ ${item.addOns.map(a => a.name).join(', ')}` : null,
                      item.sugar && item.sugar !== 'normal' ? (item.sugar === 'no' ? 'Tanpa Gula' : item.sugar === 'less' ? 'Sedikit Gula' : item.sugar) : null,
                      item.ice && item.ice !== 'normal' ? (item.ice === 'no' ? 'Tanpa Es' : item.ice === 'less' ? 'Sedikit Es' : item.ice) : null,
                      item.note && item.note.trim() ? item.note : null
                    ].filter(Boolean).join(', ')}
                  </div>
                {/if}
              </div>
              <button class="bg-pink-500 text-white border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700" onclick={() => removeCartItem(idx)}>Hapus</button>
            </div>
          {/each}
        </div>
        <div slot="footer">
          <button class="bg-pink-500 text-white font-bold text-lg rounded-lg px-6 py-3 w-full mt-4 shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700" onclick={goToBayar}>Bayar</button>
        </div>
      </ModalSheet>
    {/if}

    {#if showSnackbar}
      <div class="fixed left-1/2 bottom-28 -translate-x-1/2 bg-gray-900 text-white rounded-lg px-4 py-2 z-50 text-sm shadow-lg animate-fadeInOut">{snackbarMsg}</div>
    {/if}

    <ModalSheet bind:open={showModal} title={selectedProduct ? selectedProduct.name : ''} on:close={closeModal}>
      <div class="overflow-y-auto flex-1 min-h-0 addon-list addon-modal-content pb-48" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()}
        style="scrollbar-width:none;-ms-overflow-style:none;"
        role="button"
        tabindex="0"
      >
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
        <div class="font-semibold text-gray-800 mb-2 mt-4 text-base">Ekstra</div>
        {#if selectedProduct && selectedProduct.ekstraIds && selectedProduct.ekstraIds.length > 0 && addOns.filter(a => selectedProduct.ekstraIds.includes(a.id)).length > 0}
          <div class="grid grid-cols-2 gap-3 mb-6">
            {#each addOns.filter(a => selectedProduct.ekstraIds.includes(a.id)) as a}
              <button
                class="w-full justify-center py-2 rounded-lg border font-medium text-base cursor-pointer transition-colors duration-150 flex flex-col items-center text-center whitespace-normal overflow-hidden {selectedAddOns.includes(a.id) ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-pink-500 border-pink-500'}"
                type="button"
                onclick={() => toggleAddOn(a.id)}
              >
                <span>{a.name}</span>
                <span class="font-semibold mt-px {selectedAddOns.includes(a.id) ? 'text-white' : 'text-pink-500'}">+Rp {(a.price ?? a.harga ?? 0).toLocaleString('id-ID')}</span>
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
</style> 