<script lang="ts">
import ModalSheet from '$lib/components/shared/ModalSheet.svelte';
import ImagePlaceholder from '$lib/components/shared/ImagePlaceholder.svelte';
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import Home from 'lucide-svelte/icons/home';
import ShoppingBag from 'lucide-svelte/icons/shopping-bag';
import FileText from 'lucide-svelte/icons/file-text';
import Book from 'lucide-svelte/icons/book';
import Settings from 'lucide-svelte/icons/settings';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import Topbar from '$lib/components/shared/Topbar.svelte';
import BottomNav from '$lib/components/shared/BottomNav.svelte';

// Kategori produk
const categories = [
  { id: 'all', name: 'Semua' },
  { id: 'buah', name: 'Jus Buah' },
  { id: 'campur', name: 'Jus Campur' },
  { id: 'signature', name: 'Signature' },
];
let selectedCategory = 'all';

// Produk mock dengan kategori
const products = [
  {
    id: 1,
    name: 'Jus Alpukat',
    price: 18000,
    image: '/img/jus-alpukat.jpg',
    category: 'buah',
  },
  {
    id: 2,
    name: 'Jus Mangga',
    price: 15000,
    image: '/img/jus-mangga.jpg',
    category: 'buah',
  },
  {
    id: 3,
    name: 'Jus Strawberry',
    price: 17000,
    image: '',
    category: 'buah',
  },
  {
    id: 4,
    name: 'Jus Campur Segar',
    price: 20000,
    image: '',
    category: 'campur',
  },
  {
    id: 5,
    name: 'Zatiaras Signature',
    price: 25000,
    image: '',
    category: 'signature',
  },
  // ... tambahkan produk lain
];

// Topping mock tanpa emoji/icon
const addOns = [
  { id: 1, name: 'Susu Kental Manis', price: 2000 },
  { id: 2, name: 'Coklat', price: 2500 },
  { id: 3, name: 'Keju Parut', price: 3000 },
  { id: 4, name: 'Oreo', price: 2500 },
  { id: 5, name: 'Boba', price: 3000 },
  { id: 6, name: 'Nata de Coco', price: 2000 },
  { id: 7, name: 'Jelly', price: 2000 },
];

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

// Keranjang sementara
let cart: Array<any> = [];

// Untuk track error gambar per produk (pakai string key)
let imageError: Record<string, boolean> = {};

// Search produk
let search = '';

// Filter produk berdasarkan kategori & search
$: filteredProducts = products.filter(p =>
  (selectedCategory === 'all' || p.category === selectedCategory) &&
  p.name.toLowerCase().includes(search.toLowerCase())
);

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
  cart = [
    ...cart,
    {
      product: selectedProduct,
      addOns: addOns.filter(a => selectedAddOns.includes(a.id)),
      sugar: selectedSugar,
      ice: selectedIce,
      qty,
    },
  ];
  showModal = false;
}

function handleImgError(id: string) {
  imageError = { ...imageError, [id]: true };
}
</script>

<div class="flex flex-col min-h-screen bg-white w-full max-w-full overflow-x-hidden">
  <main class="flex-1 overflow-y-auto pb-24 w-full max-w-full overflow-x-hidden">
    <div class="sticky top-0 z-10 bg-white px-4 py-2 flex items-center gap-3">
      <input
        class="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-base bg-gray-50 text-gray-800 outline-none focus:border-pink-400"
        type="text"
        placeholder="Cari produk..."
        bind:value={search}
        autocomplete="off"
      />
    </div>
    <div class="flex gap-2 overflow-x-auto px-4 py-2 bg-white" style="scrollbar-width:none;-ms-overflow-style:none;" on:wheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}>
      {#each categories as c}
        <button
          class="flex-shrink-0 min-w-[96px] px-4 py-2 rounded-lg border border-pink-400 font-medium text-base cursor-pointer transition-colors duration-150 mb-1 {selectedCategory === c.id ? 'text-white' : 'text-pink-400'}"
          type="button"
          style={selectedCategory === c.id ? 'background:#ff5fa2' : 'background:#fff'}
          on:click={() => selectedCategory = c.id}
        >{c.name}</button>
      {/each}
    </div>
    <div class="grid grid-cols-2 gap-4 px-4">
      {#each filteredProducts as p}
        <div class="bg-white rounded-lg shadow-md flex flex-col items-center justify-start p-4 transition-shadow border-none cursor-pointer min-h-[128px]" tabindex="0" on:click={() => openAddOnModal(p)}>
          {#if p.image && !imageError[String(p.id)]}
            <img class="w-22 h-22 object-cover rounded-lg mb-3 bg-gray-100" src={p.image} alt={p.name} loading="lazy" on:error={() => handleImgError(String(p.id))} />
          {:else}
            <ImagePlaceholder size={88} />
          {/if}
          <div class="text-base font-semibold text-gray-900 mb-1 text-center tracking-tight leading-tight">{p.name}</div>
          <div class="text-pink-400 font-bold text-sm text-center tracking-tight leading-tight mt-0.5">Rp {p.price.toLocaleString('id-ID')}</div>
        </div>
      {/each}
    </div>

    {#if cart.length > 0}
      <div class="fixed left-0 right-0 bottom-16 flex items-center justify-between bg-white border-t-2 border-gray-100 shadow-md px-6 py-3 z-20 rounded-t-lg min-h-[56px] text-base font-medium text-gray-900 cursor-pointer" on:click={openCartModal}>
        <div>{cart.length} item di keranjang</div>
        <button class="bg-pink-400 text-white font-bold text-lg rounded-lg px-6 py-2 shadow transition-colors duration-150 hover:bg-pink-500 active:bg-pink-600" on:click|stopPropagation={openCartModal}>Bayar</button>
      </div>
    {/if}

    {#if showCartModal}
      <div class="fixed inset-0 bg-black/20 z-[200] flex items-end justify-center">
        <div class="w-full max-w-[480px] mx-auto bg-white rounded-t-2xl shadow-lg pb-safe min-h-[120px] max-h-[80vh] flex flex-col animate-slideUp will-change-transform border-b-0" style="border-bottom-left-radius:0!important;border-bottom-right-radius:0!important;">
          <div class="flex items-center justify-between px-6 pt-6 pb-2 text-lg font-semibold text-pink-400">
            <span>Keranjang</span>
            <button class="bg-transparent border-none text-2xl text-gray-400 cursor-pointer" on:click={closeCartModal}>✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-6 py-2 min-h-0">
            {#each cart as item, idx}
              <div class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mb-3 shadow-sm">
                <div class="flex flex-col min-w-0">
                  <div class="text-base font-semibold text-gray-900 mb-0.5 truncate">{item.qty}x {item.product.name}</div>
                  {#if item.addOns && item.addOns.length > 0}
                    <div class="text-sm text-pink-400 font-medium">+ {item.addOns.map(a => a.name).join(', ')}</div>
                  {/if}
                </div>
                <button class="bg-[#ff5fa2] text-white border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-colors duration-150 hover:opacity-90 active:opacity-95" on:click={() => removeCartItem(idx)}>Hapus</button>
              </div>
            {/each}
          </div>
          <button class="bg-[#ff5fa2] text-white font-bold text-lg rounded-t-lg px-6 py-3 w-full mt-4 shadow transition-colors duration-150 hover:opacity-90 active:opacity-95" on:click={closeCartModal}>Bayar</button>
        </div>
      </div>
    {/if}

    <ModalSheet bind:open={showModal} title={selectedProduct ? selectedProduct.name : ''} on:close={closeModal}>
      <div class="overflow-y-auto flex-1 min-h-0 addon-list addon-modal-content pb-56" on:click|stopPropagation>
        <div class="font-semibold text-gray-800 mb-2 mt-4 text-base">Jenis Gula</div>
        <div class="flex gap-2 mb-3">
          {#each sugarOptions as s}
            <button
              class="flex-1 px-0 py-2 rounded-lg border border-pink-400 bg-white text-pink-400 font-medium text-base cursor-pointer transition-colors duration-150"
              type="button"
              style={selectedSugar === s.id ? 'background:#ff5fa2;color:#fff' : ''}
              on:click={() => selectedSugar = s.id}
            >{s.label}</button>
          {/each}
        </div>
        <div class="font-semibold text-gray-800 mb-2 mt-4 text-base">Jenis Es</div>
        <div class="flex gap-2 mb-3">
          {#each iceOptions as i}
            <button
              class="flex-1 px-0 py-2 rounded-lg border border-pink-400 bg-white text-pink-400 font-medium text-base cursor-pointer transition-colors duration-150"
              type="button"
              style={selectedIce === i.id ? 'background:#ff5fa2;color:#fff' : ''}
              on:click={() => selectedIce = i.id}
            >{i.label}</button>
          {/each}
        </div>
        <div class="font-semibold text-gray-800 mb-2 mt-4 text-base">Ekstra</div>
        <div class="grid grid-cols-2 gap-3 mb-6">
          {#each addOns as a}
            <button
              class="w-full justify-center py-3 rounded-lg border border-pink-400 bg-white text-pink-400 font-medium text-base cursor-pointer transition-colors duration-150 flex flex-col items-center gap-1 text-center whitespace-normal overflow-hidden"
              type="button"
              style={selectedAddOns.includes(a.id) ? 'background:#ff5fa2;color:#fff' : ''}
              on:click={() => toggleAddOn(a.id)}
            >
              <span>{a.name}</span>
              <span class="font-semibold mt-px" style={selectedAddOns.includes(a.id) ? 'color:#fff' : 'color:#ff5fa2'}>+Rp {a.price.toLocaleString('id-ID')}</span>
            </button>
          {/each}
        </div>
      </div>
      <div slot="footer">
        <div class="font-semibold text-gray-800 mb-2 mt-0 text-base">Jumlah</div>
        <div class="flex items-center justify-center gap-3 mb-4">
          <button class="w-10 h-10 rounded-lg border border-pink-400 text-pink-400 text-xl font-bold flex items-center justify-center transition-colors duration-150" type="button" on:click={decQty}>-</button>
          <input class="w-12 text-center text-lg font-semibold border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-800 outline-none" type="number" min="1" max="99" bind:value={qty} />
          <button class="w-10 h-10 rounded-lg border border-pink-400 text-pink-400 text-xl font-bold flex items-center justify-center transition-colors duration-150" type="button" on:click={incQty}>+</button>
        </div>
        <button style="background:#ff5fa2" class="text-white font-bold text-lg rounded-lg px-6 py-3 w-full mb-1 shadow transition-colors duration-150 hover:opacity-90 active:opacity-95" on:click={addToCart}>Tambah ke Keranjang</button>
      </div>
    </ModalSheet>
  </main>
</div>

<style>
.category-scroll::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}
</style> 