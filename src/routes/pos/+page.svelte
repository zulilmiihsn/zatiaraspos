<script lang="ts">
	import ModalSheet from '$lib/components/shared/modalSheet.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { validateNumber, sanitizeInput } from '$lib/utils/validation';
	import { securityUtils } from '$lib/utils/security';
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
	userRole.subscribe((val) => (currentUserRole = val || ''));

	import { browser } from '$app/environment';
	let sesiAktif: {
		id: string;
		opening_cash: number;
		opening_time: string;
		is_active: boolean;
	} | null = null;
	async function cekSesiTokoAktif(): Promise<void> {
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

	let produkData: {
		id: string;
		name: string;
		price: number;
		harga: number;
		tipe: string;
		image?: string;
		ekstra_ids?: string[];
	}[] = [];
	let kategoriData: { id: string; name: string }[] = [];
	let tambahanData: { id: string; name: string; price: number; harga: number }[] = [];

	let isLoadingProducts = true;

	let unsubscribeBranch: (() => void) | null = null;
	let isInitialLoad = true; // Add flag to prevent double fetching

	onMount(async () => {
		// Preload ikon POS untuk percepat transisi dan render ikon inti
		import('$lib/utils/iconLoader').then(({ loadRouteIcons }) => {
			loadRouteIcons('pos');
		});
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

			// Store reference for cleanup
			(window as any)._onlineSyncHandler = throttledSync;
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

		// Cleanup event listeners
		if (typeof window !== 'undefined' && (window as any)._onlineSyncHandler) {
			window.removeEventListener('online', (window as any)._onlineSyncHandler);
			delete (window as any)._onlineSyncHandler;
		}
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
			// Handle error silently
		}
	}

	// Setup real-time subscriptions
	function setupRealtimeSubscriptions() {
		// Subscribe to product changes
		realtimeManager.subscribe('produk', async (payload) => {
			produkData = await dataService.getProducts();
		});

		// Subscribe to category changes
		realtimeManager.subscribe('kategori', async (payload) => {
			kategoriData = await dataService.getCategories();
		});

		// Subscribe to add-on changes
		realtimeManager.subscribe('tambahan', async (payload) => {
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
		{ label: 'Laporan', path: '/laporan' }
	];

	// Kategori produk
	let selectedCategory = 'all';

	// Produk mock dengan kategori
	let products: unknown[] = [];
	$: products = produkData;

	// Topping mock tanpa emoji/icon
	let addOns: unknown[] = [];
	$: addOns = tambahanData;

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

	let showModal = false;
	let selectedProduct: {
		id: string;
		name: string;
		price: number;
		harga: number;
		tipe: string;
		image?: string;
		ekstra_ids?: string[];
	} | null = null;
	let selectedAddOns: string[] = [];
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
	const memoizedFilter = memoize(
		(products: any[], categories: any[], selectedCategory: string, search: string) => {
			let filtered = products;
			// Filter berdasarkan search
			if (search) {
				filtered = fuzzySearch(search, products);
			}
			// Filter berdasarkan kategori
			if (selectedCategory !== 'all') {
				filtered = filtered.filter((p) => p.kategori_id === selectedCategory);
			}
			return filtered;
		},
		(products, categories, selectedCategory, search) =>
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
	function removeCartItem(idx: number): void {
		cart = cart.filter((_, i) => i !== idx);
	}

	function openAddOnModal(product: any): void {
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
		const addOnsSelected = addOns.filter((a: any) => selectedAddOns.includes(a.id));
		const addOnsKey = addOnsSelected
			.map((a: any) => a.id)
			.sort()
			.join(',');
		const itemKey = `${selectedProduct?.id}-${addOnsKey}-${sanitizedSugar}-${sanitizedIce}-${selectedNote.trim()}`;

		const existingIdx = cart.findIndex((item: any) => {
			const itemAddOnsKey = (item.addOns || [])
				.map((a: any) => a.id)
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

	let cartPreviewX = 0;
	let cartPreviewStartX = 0;
	let cartPreviewDragging = false;
	let cartPreviewRef: unknown;
	let cartPreviewWidth = 0;
	let showSnackbar = false;
	let snackbarMsg = '';
	let prevCartLength = 0;

	function handleCartPreviewTouchStart(e: TouchEvent): void {
		if (e.touches.length !== 1) return;
		cartPreviewDragging = true;
		cartPreviewStartX = e.touches[0].clientX;
		cartPreviewWidth = (cartPreviewRef as HTMLElement)?.offsetWidth || 1;
	}
	function handleCartPreviewTouchMove(e: TouchEvent): void {
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
			setTimeout(() => {
				showSnackbar = false;
			}, 1800);
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

	function handleGlobalClick(e: Event): void {
		if (clickBlocked) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
	}

	function capitalizeFirst(str: string): string {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	let categories: unknown[] = [];
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
	let errorNotificationTimeout: ReturnType<typeof setTimeout> | null = null;

	function showErrorNotif(message: string) {
		errorNotificationMessage = message;
		showErrorNotification = true;
		if (errorNotificationTimeout) clearTimeout(errorNotificationTimeout);
		errorNotificationTimeout = setTimeout(() => {
			showErrorNotification = false;
		}, 3000);
	}

	let showCustomItemModal = false;
	let customItemName = '';
	let customItemPriceRaw = '';
	let customItemPriceFormatted = '';
	let customItemNote = '';

	function formatRupiahInput(value: string): string {
		// Hanya angka
		const numberString = value.replace(/[^\d]/g, '');
		if (!numberString) return '';
		return numberString.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	}

	function handleCustomPriceInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		const raw = target.value.replace(/[^\d]/g, '');
		customItemPriceRaw = raw;
		customItemPriceFormatted = formatRupiahInput(raw);
	}

	function addCustomItemToCart(e?: Event) {
		if (e) e.preventDefault();
		if (
			!customItemName.trim() ||
			!customItemPriceRaw ||
			isNaN(Number(customItemPriceRaw)) ||
			Number(customItemPriceRaw) <= 0
		)
			return;
		cart = [
			...cart,
			{
				product: {
					id: `custom-${Date.now()}`,
					name: customItemName.trim(),
					harga: Number(customItemPriceRaw),
					price: Number(customItemPriceRaw),
					tipe: 'custom'
				},
				addOns: [],
				sugar: '',
				ice: '',
				qty: qty, // Gunakan qty dari modal
				note: customItemNote.trim()
			}
		];
		showCustomItemModal = false;
		customItemName = '';
		customItemPriceRaw = '';
		customItemPriceFormatted = '';
		customItemNote = '';
	}

	// Helper untuk ambil nama kategori dari kategori_id
	function getKategoriNameById(id: string | number): string {
		if (!id) return '';
		const kat = categories?.find((k: any) => k.id === id);
		return (kat as any)?.name || '';
	}

	// Sinkronisasi cart ke localStorage setiap kali cart berubah
	$: if (typeof window !== 'undefined') {
		localStorage.setItem('pos_cart', JSON.stringify(cart));
	}

	function handleSelectCategoryAll(): void {
		selectedCategory = 'all';
	}
	function handleSelectCategory(id: string | number): void {
		selectedCategory = id as any;
	}
	function handleOpenAddOnModal(product: any): void {
		openAddOnModal(product);
	}
	function handleShowCustomItemModal(): void {
		qty = 1; // Reset quantity agar tidak mewarisi dari modal produk sebelumnya
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
	function handleKeydownOpenAddOnModal(product: any, e: KeyboardEvent): void {
		if (e.key === 'Enter') openAddOnModal(product);
	}
</script>

<div
	class="h-100vh flex w-full max-w-full flex-col overflow-x-hidden overflow-y-auto bg-white"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	onclick={handleGlobalClick}
	onkeydown={(e) => e.key === 'Escape' && handleGlobalClick(e)}
	role="button"
	tabindex="0"
>
	<main
		class="page-content w-full max-w-full flex-1 overflow-x-hidden"
		style="scrollbar-width:none;-ms-overflow-style:none;"
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		<div class="flex items-center gap-3 bg-white px-4 py-4 md:py-8 lg:py-10">
			<div class="relative w-full">
				<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
					<svg
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
						/></svg
					>
				</span>
				<input
					class="w-full flex-1 rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-3 pl-10 text-base text-gray-800 outline-none focus:border-pink-400"
					type="text"
					placeholder="Cari produk..."
					bind:value={search}
					autocomplete="off"
					oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
				/>
			</div>
		</div>
		<div
			class="-mt-2 flex gap-2 overflow-x-auto bg-white px-4 py-2 md:-mt-4 lg:-mt-6"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<button
				class="mb-1 min-w-[96px] flex-shrink-0 cursor-pointer rounded-lg border px-4 py-2 text-base font-medium transition-colors duration-150 {selectedCategory ===
				'all'
					? 'border-pink-500 bg-pink-500 text-white'
					: 'border-pink-500 bg-white text-pink-500'}"
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
					class="mb-1 flex w-12 min-w-[48px] flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-pink-500 bg-pink-500 px-3 py-2 text-base font-medium text-white transition-colors duration-150"
					type="button"
					aria-label="Tambah item custom"
					onclick={handleShowCustomItemModal}
				>
					<svg
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg
					>
				</button>
				<div class="flex h-[40px] items-center gap-2 px-4 text-sm text-gray-400">
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
						class="mb-1 min-w-[96px] flex-shrink-0 cursor-pointer rounded-lg border px-4 py-2 text-base font-medium transition-colors duration-150 {selectedCategory ===
						(c as any).id
							? 'border-pink-500 bg-pink-500 text-white'
							: 'border-pink-500 bg-white text-pink-500'}"
						type="button"
						onclick={() => handleSelectCategory((c as any).id)}>{(c as any).name}</button
					>
				{/each}
				<!-- Button Custom Item di paling kanan -->
				<button
					class="mb-1 flex min-w-[96px] flex-shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-pink-500 bg-pink-500 px-4 py-2 text-base font-medium text-white transition-colors duration-150"
					type="button"
					onclick={handleShowCustomItemModal}
				>
					<svg
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg
					>
					Menu Kustom
				</button>
			{/if}
		</div>
		<div class="w-full max-w-full flex-1 px-0" style="min-height:0;">
			<div
				class="h-[calc(100vh-112px-48px)] overflow-y-auto md:h-[calc(100vh-128px-48px)] lg:h-[calc(100vh-160px-48px)]"
				style="scrollbar-width:none;-ms-overflow-style:none;"
			>
				{#if $posGridView}
					<div
						class="flex min-h-[60vh] flex-col gap-1 px-4 pb-4"
						transition:slide={{ duration: 250 }}
					>
						{#if isLoadingProducts}
							{#each Array(skeletonCount) as _, i}
								<div
									class="flex max-h-[80px] min-h-[56px] animate-pulse cursor-pointer items-center justify-between rounded-lg border border-gray-100 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 px-3 py-2 shadow-md transition-shadow"
								></div>
							{/each}
						{:else if filteredProducts.length === 0}
							<div
								class="pointer-events-none flex min-h-[50vh] flex-col items-center justify-center py-12 text-center"
							>
								<div class="mb-2 text-6xl">🍽️</div>
								<div class="mb-1 text-base font-semibold text-gray-700">Belum ada Menu</div>
								<div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
							</div>
						{:else}
							{#each filteredProducts as p}
								<div
									class="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2 transition-colors hover:bg-pink-50"
									tabindex="0"
									onclick={() => handleOpenAddOnModal(p)}
									onkeydown={(e) => handleKeydownOpenAddOnModal(p, e)}
									role="button"
									aria-label="Tambah {p.name} ke keranjang"
								>
								<div class="flex min-w-0 flex-1 flex-col">
									<span class="mb-0.5 truncate text-sm font-medium text-gray-800">{p.name}</span>
									<span class="mb-0.5 min-h-[18px] truncate text-xs text-gray-400"
										>{getKategoriNameById(p.kategori_id)}</span
									>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-base font-bold whitespace-nowrap text-pink-500"
										>Rp {Number(p.price ?? p.harga ?? 0).toLocaleString('id-ID')}</span
									>
								</div>
								</div>
							{/each}
						{/if}
					</div>
				{:else}
					<div
						class="grid min-h-0 grid-cols-2 gap-3 px-4 pb-4 md:grid-cols-3 md:gap-6 md:px-8 md:pb-8 lg:grid-cols-6"
						transition:slide={{ duration: 250 }}
					>
						{#if isLoadingProducts}
							{#each Array(skeletonCount) as _, i}
								<div
									class="flex aspect-[3/4] max-h-[260px] min-h-[140px] animate-pulse cursor-pointer flex-col items-center justify-between rounded-xl border border-gray-100 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-2.5 shadow-md transition-shadow md:max-h-[320px] md:min-h-[180px] md:p-6"
								></div>
							{/each}
						{:else if filteredProducts.length === 0}
							<div
								class="pointer-events-none col-span-2 flex min-h-[50vh] flex-col items-center justify-center py-12 text-center md:col-span-3"
							>
								<div class="mb-2 text-6xl">🍽️</div>
								<div class="mb-1 text-base font-semibold text-gray-700">Belum ada Menu</div>
								<div class="text-sm text-gray-400">Silakan tambahkan menu terlebih dahulu.</div>
							</div>
						{:else}
							{#each filteredProducts as p}
								<div
									class="flex aspect-[3/4] max-h-[260px] min-h-[140px] cursor-pointer flex-col items-center justify-between rounded-xl border border-gray-100 bg-white p-3 shadow-md transition-shadow md:max-h-[320px] md:min-h-[180px] md:gap-3 md:rounded-2xl md:p-6 md:hover:shadow-lg"
									tabindex="0"
									onclick={() => handleOpenAddOnModal(p)}
									onkeydown={(e) => handleKeydownOpenAddOnModal(p, e)}
									role="button"
									aria-label="Tambah {p.name} ke keranjang"
								>
									{#if (p.gambar || p.image) && !imageError[String(p.id)]}
										<img
											class="mb-2 aspect-square h-full min-h-[80px] w-full rounded-xl object-cover md:mb-3 md:rounded-2xl"
											src={p.gambar || p.image}
											alt={p.name}
											loading="lazy"
											onerror={() => handleImgErrorId(p.id)}
										/>
									{:else}
										<div
											class="mb-2 flex aspect-square min-h-[80px] w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 text-4xl md:mb-3 md:rounded-2xl md:text-5xl"
										>
											🍹
										</div>
									{/if}
									<div class="flex w-full flex-col items-center">
										<h3
											class="mb-0.5 w-full truncate text-center text-sm font-semibold text-gray-800 md:mb-1 md:text-lg"
										>
											{p.name}
										</h3>
										<span class="min-h-[18px] truncate text-xs text-gray-400 md:text-sm"
											>{getKategoriNameById(p.kategori_id)}</span
										>
										<div class="text-base font-bold text-pink-500 md:mt-1 md:text-xl">
											Rp {Number(p.price ?? p.harga ?? 0).toLocaleString('id-ID')}
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{/if}
				<!-- Tombol Custom Item -->
				<!-- Modal Custom Item -->
				{#if showCustomItemModal}
					<ModalSheet
						bind:open={showCustomItemModal}
						title={customItemName ? customItemName : 'Menu Kustom'}
						on:close={() => (showCustomItemModal = false)}
					>
						<div
							class="addon-list addon-modal-content min-h-0 flex-1 overflow-y-auto pb-48"
							onclick={handleStopPropagation}
							onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()}
							style="scrollbar-width:none;-ms-overflow-style:none;"
							role="button"
							tabindex="0"
						>
							<div class="mt-4 mb-6">
								<label class="mb-2 block text-base font-semibold text-gray-800" for="custom-nama"
									>Nama Menu</label
								>
								<input
									id="custom-nama"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base font-semibold text-gray-800 outline-none focus:border-pink-400 focus:outline-2 focus:outline-pink-400"
									type="text"
									bind:value={customItemName}
									required
									maxlength="50"
									placeholder="Contoh: Jus Mangga Spesial"
								/>
							</div>
							<div class="mb-6">
								<label
									class="mt-4 mb-2 block text-base font-semibold text-gray-800"
									for="custom-harga">Harga</label
								>
								<div class="relative">
									<span class="absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-gray-400"
										>Rp</span
									>
									<input
										id="custom-harga"
										class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-10 text-base font-semibold text-gray-800 outline-none focus:border-pink-400 focus:outline-2 focus:outline-pink-400"
										type="text"
										inputmode="numeric"
										pattern="[0-9]*"
										min="1"
										max="99999999"
										value={customItemPriceFormatted}
										oninput={handleCustomPriceInput}
										required
										placeholder="0"
									/>
								</div>
							</div>
							<div class="mb-6">
								<label
									class="mt-4 mb-2 block text-base font-semibold text-gray-800"
									for="custom-catatan">Catatan</label
								>
								<textarea
									id="custom-catatan"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base font-normal text-gray-800 outline-none focus:border-pink-400 focus:outline-2 focus:outline-pink-400"
									bind:value={customItemNote}
									maxlength="100"
									rows="2"
									placeholder="Contoh: Tanpa gula, es sedikit, dsb"
								></textarea>
							</div>
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
							<div class="mt-2 flex gap-3">
								<button
									type="button"
									class="mb-1 w-full rounded-lg bg-pink-500 px-6 py-3 text-lg font-bold text-white shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700"
									onclick={addCustomItemToCart}>Tambah ke Keranjang</button
								>
							</div>
						</div>
					</ModalSheet>
				{/if}
			</div>
		</div>

		{#if cart.length > 0}
			<div
				bind:this={cartPreviewRef}
				class="fixed right-0 bottom-16 left-0 z-20 flex min-h-[56px] items-center justify-between rounded-t-lg border-t-2 border-gray-100 bg-white px-6 py-3 text-base font-medium text-gray-900 shadow-md"
				style="transform: translateX({cartPreviewX}px); transition: {cartPreviewDragging
					? 'none'
					: 'transform 0.25s cubic-bezier(.4,0,.2,1)'}; touch-action: pan-y;"
				ontouchstart={handleCartPreviewTouchStart}
				ontouchmove={handleCartPreviewTouchMove}
				ontouchend={handleCartPreviewTouchEnd}
				transition:fly={{ x: -64, duration: 320, opacity: 0.9 }}
			>
				<div
					class="flex flex-1 cursor-pointer flex-col justify-center select-none"
					onclick={openCartModal}
					onkeydown={(e) => e.key === 'Enter' && openCartModal()}
					role="button"
					tabindex="0"
					aria-label="Buka keranjang belanja"
					style="min-width:0;"
				>
					<div class="truncate text-sm text-gray-500">{totalItems} item pesanan</div>
					<div class="truncate text-lg font-bold text-pink-500">
						Rp {Number(totalHarga ?? 0).toLocaleString('id-ID')}
					</div>
				</div>
				<div class="ml-4 flex items-center justify-center">
					<button
						class="flex items-center justify-center rounded-lg bg-pink-500 px-6 py-2 text-lg font-bold text-white shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700"
						onclick={handleGoToBayar}>Bayar</button
					>
				</div>
			</div>
		{/if}

		{#if showCartModal}
			<ModalSheet bind:open={showCartModal} title="Keranjang" on:close={closeCartModal}>
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
											? item.addOns.map((a: any) => a.name).join(', ')
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
									Rp {Number(item.product.price ?? item.product.harga ?? 0).toLocaleString('id-ID')}
								</div>
							</div>
							<button
								class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white"
								onclick={() => handleRemoveCartItem(idx)}>Hapus</button
							>
						</div>
					{/each}
				</div>
				<div slot="footer">
					<button
						class="mb-1 w-full rounded-lg bg-pink-500 px-6 py-3 text-lg font-bold text-white shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700"
						onclick={handleGoToBayar}>Bayar</button
					>
				</div>
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
				on:close={closeModal}
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
					{#if selectedProduct && selectedProduct.ekstra_ids && selectedProduct.ekstra_ids.length > 0 && addOns.filter( (a: any) => selectedProduct?.ekstra_ids?.includes(a.id) ).length > 0}
						<div class="mb-6 grid grid-cols-2 gap-3">
							{#each addOns.filter((a: any) => selectedProduct?.ekstra_ids?.includes(a.id)) as a}
								<button
									class="flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border py-1.5 text-center text-base font-medium whitespace-normal transition-colors duration-150 {selectedAddOns.includes(
										(a as any).id
									)
										? 'border-pink-500 bg-pink-500 text-white'
										: 'border-pink-500 bg-white text-pink-500'}"
									type="button"
									onclick={() => toggleAddOn((a as any).id)}
								>
									<span class="w-full truncate">{(a as any).name}</span>
									<span
										class="mt-0 text-sm font-semibold {selectedAddOns.includes((a as any).id)
											? 'text-white'
											: 'text-pink-500'}"
										>+Rp {Number((a as any).price ?? (a as any).harga ?? 0).toLocaleString(
											'id-ID'
										)}</span
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
				<div slot="footer">
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
