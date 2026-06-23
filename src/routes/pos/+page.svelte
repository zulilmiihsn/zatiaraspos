<script lang="ts">
	import ModalSheet from '$lib/components/shared/modalSheet.svelte';
	import ProductGrid from '$lib/components/pos/ProductGrid.svelte';
	import CustomItemModal from '$lib/components/pos/CustomItemModal.svelte';
	import CartPreview from '$lib/components/pos/CartPreview.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	import type { TokoSession } from '$lib/types/store';
	import { validateNumber, sanitizeInput } from '$lib/utils/validation';
	import { securityUtils } from '$lib/utils/security';
	import { fly, fade } from 'svelte/transition';

	import { cubicOut } from 'svelte/easing';
	import { posGridView } from '$lib/stores/posGridView.svelte';
	import {
		debounce,
		throttle,
		memoize,
		measureAsyncPerformance,
		calculateCartTotal,
		fuzzySearch
	} from '$lib/utils/performance';
	import { userRole } from '$lib/stores/userRole.svelte';
	import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
	import { dataService, realtimeManager } from '$lib/services/dataService';
	import { getSesiAktif } from '$lib/services/sesiTokoService';
	import { reportCacheMetrics } from '$lib/utils/cacheMetrics';
	import { Plus, Search } from 'lucide-svelte';
	let currentUserRole = $state('');
	$effect(() => {
		currentUserRole = userRole.value || '';
	});

	import { browser } from '$app/environment';
	let sesiAktif: TokoSession | null = null;
	async function cekSesiTokoAktif(): Promise<void> {
		sesiAktif = await getSesiAktif();
	}

	onMount(() => {
		cekSesiTokoAktif();
		if (browser) {
			window.addEventListener('openTokoModal', cekSesiTokoAktif);
		}
	});

	interface PosProduct {
		id: string;
		name: string;
		price: number;
		tipe: string;
		image?: string;
		gambar?: string;
		ekstra_ids?: string[];
		kategori_id?: string;
	}
	interface PosCategory {
		id: string;
		name: string;
	}
	interface PosAddOn {
		id: string;
		name: string;
		price: number;
	}
	interface PosCartItem {
		product: PosProduct;
		qty: number;
		addOns: PosAddOn[];
		sugar: string;
		ice: string;
		note: string;
	}

	let produkData = $state<PosProduct[]>([]);
	let kategoriData = $state<PosCategory[]>([]);
	let tambahanData = $state<PosAddOn[]>([]);

	let isLoadingProducts = $state(true);
	let posLoadError = $state('');

	let unsubscribeBranch: (() => void) | null = null;
	let isInitialLoad = true; // Add flag to prevent double fetching
	let posRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	let posRefreshInFlight = false;
	let lastPOSPayloadFingerprint = '';

	onMount(async () => {
		// Preload ikon POS untuk percepat transisi dan render ikon inti
		import('$lib/utils/iconLoader').then(({ loadRouteIcons }) => {
			loadRouteIcons('pos');
		});
		// Load data dengan smart caching
		await loadPOSData();

		// Setup real-time subscriptions
		setupRealtimeSubscriptions();

		// Measure performance tanpa double-fetch
		await measureAsyncPerformance('data fetching', async () => Promise.resolve());

		isLoadingProducts = false;

		// Sync otomatis saat online dengan throttling
		if (typeof window !== 'undefined') {
			const throttledSync = throttle(async () => {
				await loadPOSData();
			}, 1000); // Throttle to 1 second

			window.addEventListener('online', throttledSync);

			// Store reference for cleanup
			(window as any)._onlineSyncHandler = throttledSync;
		}

		// Subscribe ke selectedBranch untuk fetch ulang data saat cabang berubah
		if (!isInitialLoad && selectedBranch.value) {
			loadPOSData();
		}
		isInitialLoad = false;
	});

	onDestroy(() => {
		realtimeManager.unsubscribeAll();
		if (posRefreshTimer) {
			clearTimeout(posRefreshTimer);
			posRefreshTimer = null;
		}

		// Cleanup event listeners
		if (typeof window !== 'undefined' && (window as any)._onlineSyncHandler) {
			window.removeEventListener('online', (window as any)._onlineSyncHandler);
			delete (window as any)._onlineSyncHandler;
		}
	});

	// Load POS data dengan smart caching
	async function loadPOSData() {
		try {
			const [nextProducts, nextCategories, nextAddons] = await Promise.all([
				dataService.getProducts(),
				dataService.getCategories(),
				dataService.getAddOns()
			]);

			const nextFingerprint = [
				(nextProducts || []).length,
				(nextProducts || [])
					.map(
						(item: { id?: string; price?: number }) =>
							`${item?.id || ''}:${item?.price ?? 0}`
					)
					.join(','),
				(nextCategories || []).length,
				(nextCategories || []).map((item: { id?: string }) => item?.id || '').join(','),
				(nextAddons || []).length,
				(nextAddons || [])
					.map(
						(item: { id?: string; price?: number }) =>
							`${item?.id || ''}:${item?.price ?? 0}`
					)
					.join(',')
			].join('|');

			if (nextFingerprint === lastPOSPayloadFingerprint) {
				posLoadError = '';
				await reportCacheMetrics('pos');
				return;
			}

			lastPOSPayloadFingerprint = nextFingerprint;
			produkData = nextProducts || [];
			kategoriData = nextCategories || [];
			tambahanData = nextAddons || [];
			posLoadError = '';
			await reportCacheMetrics('pos');
		} catch (error) {
			posLoadError = 'Koneksi atau data POS bermasalah. Coba muat ulang daftar menu.';
		}
	}

	async function retryLoadPOSData() {
		isLoadingProducts = true;
		await loadPOSData();
		isLoadingProducts = false;
	}

	function schedulePOSRefresh(delayMs = 180) {
		if (posRefreshTimer) {
			clearTimeout(posRefreshTimer);
		}

		posRefreshTimer = setTimeout(async () => {
			posRefreshTimer = null;
			if (posRefreshInFlight) return;

			posRefreshInFlight = true;
			try {
				await loadPOSData();
			} finally {
				posRefreshInFlight = false;
			}
		}, delayMs);
	}

	// Setup real-time subscriptions
	function setupRealtimeSubscriptions() {
		// Subscribe to product changes
		realtimeManager.subscribe('produk', async (payload) => {
			schedulePOSRefresh();
		});

		// Subscribe to category changes
		realtimeManager.subscribe('kategori', async (payload) => {
			schedulePOSRefresh();
		});

		// Subscribe to add-on changes
		realtimeManager.subscribe('tambahan', async (payload) => {
			schedulePOSRefresh();
		});
	}

	import { createSwipeNavigation } from '$lib/utils/touchNavigation';

	const swipeNav = createSwipeNavigation(1); // 1 = Kasir

	// Kategori produk
	let selectedCategory = $state('all');

	// Produk mock dengan kategori
	let categories = $derived(kategoriData);
	let products = $derived(produkData);

	// Topping mock tanpa emoji/icon
	let addOns = $derived(tambahanData);

	// Jenis gula dan es
	const sugarOptions = [
		{ id: 'no', label: 'Tanpa Gula' },
		{ id: 'less', label: 'Sedikit Gula' },
		{ id: 'normal', label: 'Normal' }
	];
	const iceOptions = [
		{ id: 'no', label: 'Tanpa Es' },
		{ id: 'less', label: 'Sedikit Es' },
		{ id: 'normal', label: 'Normal' }
	];

	let showModal = $state(false);
	let selectedProduct = $state<PosProduct | null>(null);
	let selectedAddOns = $state<string[]>([]);
	let selectedSugar = $state('normal');
	let selectedIce = $state('normal');
	let qty = $state(1);
	let selectedNote = $state('');

	// Keranjang sementara
	let cart = $state<PosCartItem[]>([]);

	// Untuk track error gambar per produk (pakai string key)
	let imageError = $state<Record<string, boolean>>({});

	// Search produk dengan debounce
	let search = $state('');

	// Debounced search dengan optimasi
	const debouncedSearch = debounce((value: string) => {
		search = value;
	}, 300);

	function handleSearchInput(value: string) {
		debouncedSearch(value);
	}

	// Memoized computed values untuk performance
	const memoizedCartTotal = memoize(calculateCartTotal);
	let cartTotal = $derived(memoizedCartTotal(cart));
	let totalItems = $derived(cartTotal.items);
	let totalHarga = $derived(cartTotal.total);

	// Memoized filtered products dengan optimasi
	const memoizedFilter = memoize(
		(
			products: PosProduct[],
			categories: PosCategory[],
			selectedCategory: string,
			search: string
		) => {
			let filtered = products;
			if (search) {
				filtered = fuzzySearch(search, products);
			}
			if (selectedCategory !== 'all') {
				filtered = filtered.filter((p) => p.kategori_id === selectedCategory);
			}
			return filtered;
		},
		(products, categories, selectedCategory, search) =>
			`${products.length}-${categories.length}-${selectedCategory}-${search}`
	);

	let filteredProducts = $derived(memoizedFilter(products, categories, selectedCategory, search));

	let showCartModal = $state(false);
	function openCartModal() {
		showModal = false;
		showCartModal = true;
	}
	function closeCartModal() {
		showCartModal = false;
	}
	function removeCartItem(idx: number): void {
		cart = cart.filter((_, i) => i !== idx);
	}

	function openAddOnModal(product: PosProduct): void {
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

	function toggleAddOn(id: string): void {
		if (selectedAddOns.includes(id)) {
			selectedAddOns = selectedAddOns.filter((a) => a !== id);
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
		if (!securityUtils.checkFormRateLimit('pos_add_to_cart')) {
			showErrorNotif('Terlalu banyak item ditambahkan. Silakan tunggu sebentar.');
			return;
		}

		// Sanitize inputs
		const sanitizedSugar = sanitizeInput(selectedSugar);
		const sanitizedIce = sanitizeInput(selectedIce);

		// Check for suspicious activity
		const allInputs = `${selectedProduct?.name}${sanitizedSugar}${sanitizedIce}${qty}`;
		if (securityUtils.detectSuspiciousActivity('pos_add_to_cart', allInputs)) {
			showErrorNotif('Aktivitas mencurigakan terdeteksi. Silakan coba lagi.');
			securityUtils.logSecurityEvent('suspicious_cart_activity', {
				product: selectedProduct?.name,
				qty,
				sugar: sanitizedSugar,
				ice: sanitizedIce
			});
			return;
		}

		// Optimized cart item check dengan memoization
		const addOnsSelected = addOns.filter((a: PosAddOn) => selectedAddOns.includes(a.id));
		const addOnsKey = addOnsSelected
			.map((a: PosAddOn) => a.id)
			.sort()
			.join(',');
		const itemKey = `${selectedProduct?.id}-${addOnsKey}-${sanitizedSugar}-${sanitizedIce}-${selectedNote.trim()}`;

		const existingIdx = cart.findIndex((item: PosCartItem) => {
			const itemAddOnsKey = (item.addOns || [])
				.map((a: PosAddOn) => a.id)
				.sort()
				.join(',');
			const currentItemKey = `${item.product.id}-${itemAddOnsKey}-${item.sugar}-${item.ice}-${item.note}`;
			return currentItemKey === itemKey;
		});

		if (existingIdx !== -1) {
			// Jika sudah ada, tambahkan qty
			cart = cart.map((item, idx) =>
				idx === existingIdx ? { ...item, qty: item.qty + qty } : item
			);
		} else if (selectedProduct) {
			// Jika belum ada, tambahkan item baru
			cart = [
				...cart,
				{
					product: selectedProduct,
					addOns: addOnsSelected,
					sugar: sanitizedSugar,
					ice: sanitizedIce,
					qty,
					note: selectedNote.trim()
				}
			];
		}

		// Log successful add to cart
		securityUtils.logSecurityEvent('product_added_to_cart', {
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

	let showSnackbar = $state(false);
	let snackbarMsg = $state('');

	function clearCart() {
		cart = [];
		showSnackbar = true;
		snackbarMsg = 'Keranjang dikosongkan';
		setTimeout(() => {
			showSnackbar = false;
		}, 1800);
	}

	function capitalizeFirst(str: string): string {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	let skeletonCount = $state(9);
	if (typeof window !== 'undefined') {
		if (window.innerWidth < 768) {
			skeletonCount = 6;
		} else if (window.innerWidth >= 1024) {
			skeletonCount = 12;
		} else {
			skeletonCount = 9;
		}
	}

	let showErrorNotification = $state(false);
	let errorNotificationMessage = $state('');
	let errorNotificationTimeout: ReturnType<typeof setTimeout> | null = null;

	function showErrorNotif(message: string) {
		errorNotificationMessage = message;
		showErrorNotification = true;
		if (errorNotificationTimeout) clearTimeout(errorNotificationTimeout);
		errorNotificationTimeout = setTimeout(() => {
			showErrorNotification = false;
		}, 3000);
	}

	let showCustomItemModal = $state(false);

	function addCustomItemToCart(item: any) {
		cart = [...cart, item];
	}

	// Helper untuk ambil nama kategori dari kategori_id
	function getKategoriNameById(id: string | number): string {
		if (!id) return '';
		const kat = categories?.find((k) => String(k.id) === String(id));
		return kat?.name || '';
	}

	// Sinkronisasi cart ke localStorage setiap kali cart berubah
	$effect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('pos_cart', JSON.stringify(cart));
		}
	});

	function handleSelectCategoryAll(): void {
		selectedCategory = 'all';
	}
	function handleSelectCategory(id: string | number): void {
		selectedCategory = String(id);
	}
	function handleOpenAddOnModal(product: PosProduct): void {
		openAddOnModal(product);
	}
	function handleShowCustomItemModal(): void {
		qty = 1;
		showCustomItemModal = true;
	}
	function handleImgErrorId(id: string | number): void {
		handleImgError(String(id));
	}
	function handleGoToBayar(e: Event): void {
		e.stopPropagation();
		goToBayar();
	}
	function handleStopPropagation(e: Event): void {
		e.stopPropagation();
	}
	function handleRemoveCartItem(idx: number): void {
		removeCartItem(idx);
	}
	function handleKeydownOpenAddOnModal(product: PosProduct, e: KeyboardEvent): void {
		if (e.key === 'Enter') openAddOnModal(product);
	}
</script>

<div
	class="flex min-h-[100dvh] w-full max-w-full flex-col overflow-x-hidden overflow-y-auto bg-[#faf8f6]"
	ontouchstart={swipeNav.handleTouchStart}
	ontouchmove={swipeNav.handleTouchMove}
	ontouchend={swipeNav.handleTouchEnd}
	onclick={swipeNav.handleGlobalClick}
	onkeydown={(e) => e.key === 'Escape' && swipeNav.handleGlobalClick(e as unknown as Event)}
	role="button"
	tabindex="0"
>
	<main
		class="page-content w-full max-w-full flex-1 overflow-x-hidden"
		style="scrollbar-width:none;-ms-overflow-style:none;"
	>
		<div class="bg-[#faf8f6] px-4 pt-4 pb-3 md:px-8 md:pt-8 lg:px-10">
			<div class="mb-3 flex items-end justify-between gap-4">
				<div>
					<div class="text-xs font-semibold tracking-wide text-stone-500 uppercase">Kasir</div>
					<div class="text-2xl font-bold text-stone-950">Pilih Menu</div>
				</div>
				<div class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-600 shadow-sm">
					{totalItems} item
				</div>
			</div>
			<div class="relative w-full">
				<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
					<Search class="h-5 w-5" />
				</span>
				<input
					class="w-full flex-1 rounded-xl border border-stone-200 bg-white py-3 pr-3 pl-10 text-base text-stone-900 shadow-sm transition-all duration-200 outline-none placeholder:text-stone-400 focus:border-[#b85c72] focus:ring-4 focus:ring-[#b85c72]/10"
					type="text"
					placeholder="Cari produk..."
					bind:value={search}
					autocomplete="off"
					oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
				/>
			</div>
		</div>
		<div
			class="flex gap-2 overflow-x-auto bg-[#faf8f6] px-4 py-2 md:px-8 lg:px-10"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<button
				class="mb-1 min-w-[96px] flex-shrink-0 cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98] {selectedCategory ===
				'all'
					? 'border-[#b85c72] bg-[#b85c72] text-white shadow-sm'
					: 'border-stone-200 bg-white text-stone-700'}"
				type="button"
				onclick={handleSelectCategoryAll}>Semua</button
			>
			{#if (categories ?? []).length === 0 && isLoadingProducts}
				{#each Array(4) as _, i}
					<div
						class="mb-1 h-[40px] min-w-[96px] flex-shrink-0 animate-pulse rounded-lg bg-gray-100"
					></div>
				{/each}
			{:else if (categories ?? []).length === 0}
				<!-- Button Custom Item di samping 'Semua' jika tidak ada kategori -->
				<button
					class="mb-1 flex w-12 min-w-[48px] flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#b85c72] bg-[#b85c72] px-3 py-2 text-base font-medium text-white transition-transform duration-200 active:scale-[0.98]"
					type="button"
					aria-label="Tambah item custom"
					onclick={handleShowCustomItemModal}
				>
					<Plus class="h-5 w-5" />
				</button>
				<div class="flex h-[40px] items-center gap-2 px-4 text-sm text-stone-500">
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
					<span>Belum ada kategori</span>
				</div>
			{:else}
				{#each categories ?? [] as c}
					<button
						class="mb-1 min-w-[96px] flex-shrink-0 cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98] {selectedCategory ===
						String(c.id)
							? 'border-[#b85c72] bg-[#b85c72] text-white shadow-sm'
							: 'border-stone-200 bg-white text-stone-700'}"
						type="button"
						onclick={() => handleSelectCategory(c.id)}>{c.name}</button
					>
				{/each}
				<!-- Button Custom Item di paling kanan -->
				<button
					class="mb-1 flex min-w-[96px] flex-shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-[#b85c72] bg-[#b85c72] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98]"
					type="button"
					onclick={handleShowCustomItemModal}
				>
					<Plus class="h-5 w-5" />
					Menu Kustom
				</button>
			{/if}
		</div>
		<ProductGrid
			posGridView={posGridView.value}
			{isLoadingProducts}
			skeletonCount={12}
			{filteredProducts}
			{categories}
			{imageError}
			loadError={posLoadError}
			onSelectProduct={handleOpenAddOnModal}
			onImgError={handleImgErrorId}
			onRetry={retryLoadPOSData}
		/>

		<CustomItemModal bind:show={showCustomItemModal} onAdd={addCustomItemToCart} />

		<CartPreview
			{cart}
			{totalItems}
			{totalHarga}
			onOpenCart={openCartModal}
			onGoToBayar={handleGoToBayar}
			onClearCart={clearCart}
		/>

		{#if showCartModal}
			<ModalSheet bind:open={showCartModal} title="Keranjang" onclose={closeCartModal}>
				<div
					class="min-h-0 flex-1 overflow-y-auto px-0 py-2"
					onclick={handleStopPropagation}
					onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()}
					style="scrollbar-width:none;-ms-overflow-style:none;"
					role="button"
					tabindex="0"
				>
					{#each cart as item, idx}
						<div
							class="mb-3 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 shadow-sm"
						>
							<div class="flex min-w-0 flex-col">
								<div class="mb-0.5 truncate text-base font-semibold text-gray-900">
									{item.qty}x {item.product.name}
								</div>
								<div class="text-xs font-medium text-gray-500">
									{[
										item.addOns && item.addOns.length > 0
											? item.addOns.map((a) => a.name).join(', ')
											: '',
										item.note ? `${item.note}` : '',
										item.product.tipe === 'minuman' && item.sugar !== 'normal'
											? (sugarOptions.find((s) => s.id === item.sugar)?.label ?? item.sugar)
											: '',
										item.product.tipe === 'minuman' && item.ice !== 'normal'
											? (iceOptions.find((i) => i.id === item.ice)?.label ?? item.ice)
											: ''
									]
										.filter(Boolean)
										.join(', ')}
								</div>
								<div class="mt-1 text-base font-bold text-pink-500">
									Rp {Number(item.product.price ?? 0).toLocaleString('id-ID')}
								</div>
							</div>
							<button
								class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white"
								onclick={() => handleRemoveCartItem(idx)}>Hapus</button
							>
						</div>
					{/each}
				</div>
				{#snippet footer()}
					<div>
						<button
							class="mb-1 w-full rounded-lg bg-pink-500 px-6 py-3 text-lg font-bold text-white shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700"
							onclick={handleGoToBayar}>Bayar</button
						>
					</div>
				{/snippet}
			</ModalSheet>
		{/if}

		{#if showSnackbar}
			<div
				class="animate-fadeInOut fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
			>
				{snackbarMsg}
			</div>
		{/if}

		{#if showErrorNotification}
			<div
				class="fixed top-20 left-1/2 z-[9999] w-full max-w-xs rounded-xl bg-red-500 px-6 py-3 text-white shadow-lg transition-all duration-300 ease-out md:max-w-md"
				style="transform: translateX(-50%);"
				in:fly={{ y: -32, duration: 300, easing: cubicOut }}
				out:fade={{ duration: 200 }}
			>
				{errorNotificationMessage}
			</div>
		{/if}

		{#if showModal}
			<ModalSheet
				bind:open={showModal}
				title={selectedProduct ? selectedProduct.name : ''}
				onclose={closeModal}
			>
				<div
					class="addon-list addon-modal-content min-h-0 flex-1 overflow-y-auto pb-48"
					onclick={handleStopPropagation}
					onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()}
					style="scrollbar-width:none;-ms-overflow-style:none;"
					role="button"
					tabindex="0"
				>
					{#if selectedProduct && selectedProduct.tipe === 'minuman'}
						<div class="mt-4 mb-2 text-base font-semibold text-gray-800">Jenis Gula</div>
						<div class="mb-3 flex gap-2">
							{#each sugarOptions as s}
								<button
									class="flex-1 cursor-pointer rounded-lg border px-0 py-2 text-base font-medium transition-colors duration-150 {selectedSugar ===
									s.id
										? 'border-pink-500 bg-pink-500 text-white'
										: 'border-pink-500 bg-white text-pink-500'}"
									type="button"
									onclick={() => (selectedSugar = s.id)}>{s.label}</button
								>
							{/each}
						</div>
					{/if}
					{#if selectedProduct && selectedProduct.tipe === 'minuman'}
						<div class="mt-4 mb-2 text-base font-semibold text-gray-800">Jenis Es</div>
						<div class="mb-3 flex gap-2">
							{#each iceOptions as i}
								<button
									class="flex-1 cursor-pointer rounded-lg border px-0 py-2 text-base font-medium transition-colors duration-150 {selectedIce ===
									i.id
										? 'border-pink-500 bg-pink-500 text-white'
										: 'border-pink-500 bg-white text-pink-500'}"
									type="button"
									onclick={() => (selectedIce = i.id)}>{i.label}</button
								>
							{/each}
						</div>
					{/if}
					<div class="mt-4 mb-2 text-base font-semibold text-gray-800">Ekstra</div>
					{#if selectedProduct && selectedProduct.ekstra_ids && selectedProduct.ekstra_ids.length > 0 && addOns.filter( (a) => selectedProduct?.ekstra_ids?.includes(a.id) ).length > 0}
						<div class="mb-6 grid grid-cols-2 gap-3">
							{#each addOns.filter((a) => selectedProduct?.ekstra_ids?.includes(a.id)) as a}
								<button
									class="flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border py-1.5 text-center text-base font-medium whitespace-normal transition-colors duration-150 {selectedAddOns.includes(
										a.id
									)
										? 'border-pink-500 bg-pink-500 text-white'
										: 'border-pink-500 bg-white text-pink-500'}"
									type="button"
									onclick={() => toggleAddOn(a.id)}
								>
									<span class="w-full truncate">{a.name}</span>
									<span
										class="mt-0 text-sm font-semibold {selectedAddOns.includes(a.id)
											? 'text-white'
											: 'text-pink-500'}"
										>+Rp {Number(a.price ?? 0).toLocaleString('id-ID')}</span
									>
								</button>
							{/each}
						</div>
					{:else}
						<div class="mb-6 text-center text-sm font-medium text-gray-400">
							Tidak ada ekstra untuk menu ini.
						</div>
					{/if}
					<div class="mt-4 mb-2 text-base font-semibold text-gray-800">Catatan</div>
					<textarea
						class="mb-1 w-full resize-none rounded-lg border-[1.5px] border-pink-200 bg-white px-3 py-2.5 text-base text-gray-800 transition-colors duration-200 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
						placeholder="Contoh: Tidak terlalu manis, tambah es batu, dll..."
						bind:value={selectedNote}
						rows="3"
						maxlength="200"
						oninput={(e) => {
							selectedNote = capitalizeFirst((e.target as HTMLTextAreaElement).value);
						}}
					></textarea>
					<div class="mt-1 text-right text-xs text-gray-500">{selectedNote.length}/200</div>
				</div>
				{#snippet footer()}
					<div>
						<div class="mt-0 mb-2 text-base font-semibold text-gray-800">Jumlah</div>
						<div class="mb-4 flex items-center justify-center gap-3">
							<button
								class="flex h-10 w-10 items-center justify-center rounded-lg border border-pink-400 text-xl font-bold text-pink-400 transition-colors duration-150"
								type="button"
								onclick={decQty}>-</button
							>
							<input
								class="w-12 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-center text-lg font-semibold text-gray-800 outline-none"
								type="number"
								min="1"
								max="99"
								bind:value={qty}
							/>
							<button
								class="flex h-10 w-10 items-center justify-center rounded-lg border border-pink-400 text-xl font-bold text-pink-400 transition-colors duration-150"
								type="button"
								onclick={incQty}>+</button
							>
						</div>
						<button
							class="mb-1 w-full rounded-lg bg-pink-500 px-6 py-3 text-lg font-bold text-white shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700"
							onclick={addToCart}>Tambah ke Keranjang</button
						>
					</div>
				{/snippet}
			</ModalSheet>
		{/if}
	</main>
</div>

<style>
	@keyframes fadeInOut {
		0% {
			opacity: 0;
			transform: translateY(16px);
		}
		10% {
			opacity: 1;
			transform: translateY(0);
		}
		90% {
			opacity: 1;
			transform: translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateY(-8px);
		}
	}
	.animate-fadeInOut {
		animation: fadeInOut 1.8s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.animate-pulse {
		animation: pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	/* Hilangkan tombol spinner up/down di input number (Chrome, Edge, Safari) */
	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}

	/* Hilangkan spinner di Firefox */
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
