<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { selectedBranch } from '$lib/stores/selectedBranch.svelte';

	import CropperDialog from '$lib/components/shared/cropperDialog.svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import { get as getCache, set as setCache } from 'idb-keyval';


	import { userRole } from '$lib/stores/userRole.svelte';
	import Plus from 'lucide-svelte/icons/plus';
	import Trash from 'lucide-svelte/icons/trash';
	import Utensils from 'lucide-svelte/icons/utensils';
	import FolderOpen from 'lucide-svelte/icons/folder-open';
	import PlusCircle from 'lucide-svelte/icons/plus-circle';
	import Wheat from 'lucide-svelte/icons/wheat';
	import CupSoda from 'lucide-svelte/icons/cup-soda';
	import Pizza from 'lucide-svelte/icons/pizza';
	import Calculator from 'lucide-svelte/icons/calculator';
	import Sparkles from 'lucide-svelte/icons/sparkles';

	import { dataService } from '$lib/services/dataService';
	import ToastNotification from '$lib/components/shared/toastNotification.svelte';
	import { createToastManager } from '$lib/utils/ui';
	import { ErrorHandler } from '$lib/utils/errorHandling';
	import { formatRupiah, parseRupiah, handleRupiahInput } from '$lib/utils/currency';

	import MenuTab from '$lib/components/pengaturan/manajemenmenu/MenuTab.svelte';
	import KategoriTab from '$lib/components/pengaturan/manajemenmenu/KategoriTab.svelte';
	import EkstraTab from '$lib/components/pengaturan/manajemenmenu/EkstraTab.svelte';
	import BahanTab from '$lib/components/pengaturan/manajemenmenu/BahanTab.svelte';
	import HppTab from '$lib/components/pengaturan/manajemenmenu/HppTab.svelte';

	import type {
		Product,
		Category,
		AddOn,
		Ingredient,
		ProductRecipe,
		HppSettings
	} from '$lib/types/product';

	// Data Menu
	let menus = $state<Product[]>([]);
	let imageError = $state<Record<string, boolean>>({});
	let kategoriList = $state<Category[]>([]);
	let ekstraList = $state<(AddOn & { harga: number })[]>([]);
	let bahanList = $state<Ingredient[]>([]);
	let allRecipes = $state<ProductRecipe[]>([]);
	let hppSettings = $state<HppSettings | null>(null);
	let showMenuForm = $state(false);

	let showEkstraForm = $state(false);
	let showBahanForm = $state(false);
	let showMutasiBahanForm = $state(false);
	let editMenuId = $state<string | number | null>(null);

	let editEkstraId = $state<string | number | null>(null);
	let editBahanId = $state<string | number | null>(null);
	let mutasiBahanId = $state<string | number | null>(null);

	let menuForm = $state({
		nama: '',
		kategori_id: null as string | number | null,
		tipe: 'minuman' as 'minuman' | 'makanan' | 'snack',
		harga: '',
		stok: '',
		lacak_stok: false,
		lacak_bahan: false,
		ekstra_ids: [] as Array<string | number>,
		gambar: ''
	});

	let ekstraForm = $state({ nama: '', harga: '' });
	let bahanForm = $state({
		nama: '',
		satuan: 'gram',
		stok_saat_ini: '',
		ambang_stok: '',
		jumlah_beli_terakhir: '',
		biaya_beli_terakhir: ''
	});
	let hppForm = $state({
		sewa_bulanan: '',
		listrik_bulanan: '',
		air_bulanan: '',
		gaji_bulanan: '',
		lainnya_bulanan: '',
		target_item_bulanan: '1000'
	});
	let hppPurchaseText = $state('');
	let hppParsedItems = $state<
		Array<{
			nama: string;
			satuan: string;
			purchase_qty: number;
			purchase_cost: number;
			biaya_per_satuan: number;
		}>
	>([]);
	let isParsingHpp = $state(false);
	let mutasiBahanForm = $state({ delta_jumlah: '', catatan: '' });
	let recipeItems = $state<Array<{ bahan_id: string | number; jumlah_per_item: string }>>([]);
	let recipeDraft = $state({ bahan_id: '', jumlah_per_item: '' });
	let selectedKategori = $state<string | number>('Semua');
	let searchKeyword = $state('');
	let showDeleteModal = $state(false);
	let menuIdToDelete = $state<string | number | null>(null);

	let showCropperDialog = $state(false);
	let cropperDialogImage = $state('');

	let showDeleteKategoriModal = $state(false);
	let kategoriIdToDelete = $state<string | number | null>(null);
	let showKategoriDetailModal = $state(false);
	let kategoriDetail = $state<Category | null>(null);
	let selectedMenuIds = $state<Array<string | number>>([]);
	let unselectedMenuIds = $state<Array<string | number>>([]);
	let kategoriDetailName = $state('');
	let searchKategoriKeyword = $state('');
	let searchEkstra = $state('');
	let searchBahan = $state('');
	let showDeleteEkstraModal = $state(false);
	let ekstraIdToDelete = $state<string | number | null>(null);
	let showDeleteBahanModal = $state(false);
	let bahanIdToDelete = $state<string | number | null>(null);

	let isGridView = $state(true);
	let showNotifModal = $state(false);
	let notifModalMsg = $state('');
	let notifModalType = $state('warning');
	let isCropping = $state(false);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let activeTab = $state('menu');
	let isLoadingMenus = $state(true);
	let isLoadingKategori = $state(true);
	let isLoadingEkstra = $state(true);
	let isLoadingBahan = $state(true);

	// Toast management
	const toastManager = createToastManager();

	let kategoriWithCount = $derived(
		kategoriList.map((kat: Category) => ({
			...kat,
			count: menus.filter((m: Product) => m.kategori_id === kat.id).length
		}))
	);

	let filteredMenus = $derived(
		(() => {
			const keyword = searchKeyword.trim().toLowerCase();
			return menus.filter((menu) => {
				if (!keyword)
					return selectedKategori === 'Semua' ? true : menu.kategori_id === selectedKategori;
				const kategoriNama =
					kategoriList.find((k) => k.id === menu.kategori_id)?.nama?.toLowerCase() || '';
				const match = menu.nama.toLowerCase().includes(keyword) || kategoriNama.includes(keyword);
				return (
					(selectedKategori === 'Semua' ? true : menu.kategori_id === selectedKategori) && match
				);
			});
		})()
	);

	async function fetchMenus() {
		isLoadingMenus = true;
		try {
			menus = await dataService.getProducts();
		} catch (error) {
			const e = error as Error;
			notifModalMsg = 'Gagal mengambil data menu: ' + (e?.message || 'Unknown error');
			notifModalType = 'error';
			showNotifModal = true;
		}
		isLoadingMenus = false;
	}

	async function fetchKategori() {
		isLoadingKategori = true;
		try {
			kategoriList = await dataService.getCategories();
		} catch (error) {
			const e = error as Error;
			notifModalMsg = 'Gagal mengambil data kategori: ' + (e?.message || 'Unknown error');
			notifModalType = 'error';
			showNotifModal = true;
		}
		isLoadingKategori = false;
	}

	async function fetchEkstra() {
		isLoadingEkstra = true;
		try {
			const data = await dataService.getAddOns();
			ekstraList = (data || []).map((e: AddOn) => ({ ...e, harga: e.harga }));
		} catch (error) {
			const e = error as Error;
			notifModalMsg = 'Gagal mengambil data ekstra: ' + (e?.message || 'Unknown error');
			notifModalType = 'error';
			showNotifModal = true;
		}
		isLoadingEkstra = false;
	}

	async function fetchBahan() {
		isLoadingBahan = true;
		try {
			bahanList = (await dataService.getIngredients()) as unknown as Ingredient[];
		} catch (error) {
			const e = error as Error;
			notifModalMsg = 'Gagal mengambil data bahan: ' + (e?.message || 'Unknown error');
			notifModalType = 'error';
			showNotifModal = true;
		}
		isLoadingBahan = false;
	}

	async function fetchRecipes() {
		try {
			allRecipes = (await dataService.getProductRecipes()) as unknown as ProductRecipe[];
		} catch {
			allRecipes = [];
		}
	}

	async function fetchHppSettings() {
		try {
			hppSettings = (await dataService.getHppSettings()) as unknown as HppSettings | null;
			const settings = hppSettings || ({} as Partial<HppSettings>);
			hppForm = {
				sewa_bulanan: formatRupiah(settings.sewa_bulanan),
				listrik_bulanan: formatRupiah(settings.listrik_bulanan),
				air_bulanan: formatRupiah(settings.air_bulanan),
				gaji_bulanan: formatRupiah(settings.gaji_bulanan),
				lainnya_bulanan: formatRupiah(settings.lainnya_bulanan),
				target_item_bulanan: formatRupiah(settings.target_item_bulanan) || '1.000'
			};
		} catch {
			hppSettings = null;
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			document.body.classList.add('hide-nav');
		}

		if (userRole.value !== 'pemilik') {
			goto('/unauthorized');
		}
	});

	$effect(() => {
		let _branch = selectedBranch.value;
		if (typeof window !== 'undefined') {
			(async () => {
				await Promise.all([
					fetchMenus(),
					fetchKategori(),
					fetchEkstra(),
					fetchBahan(),
					fetchRecipes(),
					fetchHppSettings()
				]);

				await setCache('pos-data', {
					produkData: JSON.parse(JSON.stringify(menus)),
					kategoriData: JSON.parse(JSON.stringify(kategoriList)),
					tambahanData: JSON.parse(JSON.stringify(ekstraList))
				});
			})();
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			document.body.classList.remove('hide-nav');
		}
	});

	async function openMenuForm(menu: Product | null = null): Promise<void> {
		if (showMenuForm && menu && editMenuId === menu.id) {
			return;
		}
		showMenuForm = true;
		recipeItems = [];
		recipeDraft = { bahan_id: '', jumlah_per_item: '' };
		if (menu) {
			editMenuId = menu.id;
			menuForm.nama = menu.nama;
			menuForm.kategori_id = menu.kategori_id as number;
			menuForm.tipe = menu.tipe;
			menuForm.harga = formatRupiah(menu.harga);
			menuForm.stok =
				menu.stok !== null && menu.stok !== undefined ? String(Number(menu.stok || 0)) : '';
			menuForm.lacak_stok = Boolean(menu.lacak_stok);
			menuForm.lacak_bahan = Boolean(menu.lacak_bahan);
			menuForm.ekstra_ids = menu.ekstra_ids ?? [];
			menuForm.gambar = menu.gambar || '';
			if (menuForm.lacak_bahan) {
				const recipes = (await dataService.getProductRecipes(
					menu.id
				)) as unknown as ProductRecipe[];
				recipeItems = recipes.map((recipe) => ({
					bahan_id: recipe.bahan_id,
					jumlah_per_item: String(recipe.jumlah_per_item || '')
				}));
			}
		} else {
			editMenuId = null;
			resetMenuForm();
		}
	}

	function resetMenuForm() {
		menuForm.nama = '';
		menuForm.kategori_id = null;
		menuForm.tipe = 'minuman';
		menuForm.harga = '';
		menuForm.stok = '';
		menuForm.lacak_stok = false;
		menuForm.lacak_bahan = false;
		menuForm.ekstra_ids = [];
		menuForm.gambar = '';
	}

	function closeMenuForm() {
		showMenuForm = false;
		editMenuId = null;
		resetMenuForm();
		recipeItems = [];
		recipeDraft = { bahan_id: '', jumlah_per_item: '' };
	}

	async function saveMenu() {
		if (!menuForm.nama || menuForm.nama.trim() === '') {
			notifModalMsg = 'Nama menu wajib diisi!';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}
		if (!menuForm.harga || menuForm.harga.toString().trim() === '') {
			notifModalMsg = 'Harga menu wajib diisi!';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}
		if (menuForm.lacak_bahan && recipeItems.length === 0) {
			notifModalMsg = 'Resep bahan wajib diisi untuk menu jus.';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}

		let imageUrl = menuForm.gambar;
		if (imageUrl && imageUrl.startsWith('data:image/')) {
			try {
				imageUrl = await uploadMenuImageFromDataUrl(imageUrl, String(editMenuId || Date.now()));
			} catch (err) {
				notifModalMsg = 'Gagal upload gambar: ' + ErrorHandler.extractErrorMessage(err);
				notifModalType = 'error';
				showNotifModal = true;
				return;
			}
		}
		const payload = {
			nama: menuForm.nama,
			kategori_id: menuForm.kategori_id,
			tipe: menuForm.tipe,
			harga: parseRupiah(menuForm.harga),
			stok: menuForm.lacak_stok ? Math.max(0, parseInt(menuForm.stok || '0', 10) || 0) : 0,
			lacak_stok: menuForm.lacak_stok && !menuForm.lacak_bahan,
			lacak_bahan: menuForm.lacak_bahan,
			ekstra_ids: menuForm.ekstra_ids,
			gambar: imageUrl
		};
		let result;
		try {
			if (editMenuId) {
				result = await dataService.updateRows('produk', payload, { id: String(editMenuId) });
			} else {
				result = await dataService.insertRows('produk', payload);
			}
			const productId = editMenuId ?? (result?.data?.[0]?.id as string);
			if (productId) {
				await saveMenuRecipe(productId);
			}
		} catch (error) {
			notifModalMsg = 'Gagal menyimpan menu: ' + ErrorHandler.extractErrorMessage(error);
			notifModalType = 'error';
			showNotifModal = true;
			return;
		}
		showMenuForm = false;
		await fetchMenus();
		await fetchRecipes();
		await afterUpdateCachePOS();

	}

	async function saveMenuRecipe(productId: string | number) {
		await dataService.deleteRows('resep_produk', { produk_id: String(productId) });
		if (!menuForm.lacak_bahan || recipeItems.length === 0) return;

		const rows = recipeItems.map((item) => ({
			produk_id: String(productId),
			bahan_id: String(item.bahan_id),
			jumlah_per_item: Number(item.jumlah_per_item || 0)
		}));
		await dataService.insertRows('resep_produk', rows);
	}

	function addRecipeItem() {
		const bahanId = recipeDraft.bahan_id;
		const jumlah = Number(recipeDraft.jumlah_per_item || 0);
		if (!bahanId || !Number.isFinite(jumlah) || jumlah <= 0) {
			notifModalMsg = 'Pilih bahan dan isi takaran resep.';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}
		const existing = recipeItems.find((item) => String(item.bahan_id) === String(bahanId));
		if (existing) {
			existing.jumlah_per_item = String(jumlah);
			recipeItems = [...recipeItems];
		} else {
			recipeItems = [...recipeItems, { bahan_id: bahanId, jumlah_per_item: String(jumlah) }];
		}
		recipeDraft = { bahan_id: '', jumlah_per_item: '' };
	}

	function removeRecipeItem(bahanId: string | number) {
		recipeItems = recipeItems.filter((item) => String(item.bahan_id) !== String(bahanId));
	}

	function getBahanName(id: string | number) {
		return bahanList.find((item) => String(item.id) === String(id))?.nama || 'Bahan';
	}

	function getBahanUnit(id: string | number) {
		return bahanList.find((item) => String(item.id) === String(id))?.satuan || '';
	}

	function getBahanCostPerUnit(id: string | number) {
		return Number(bahanList.find((item) => String(item.id) === String(id))?.biaya_per_satuan || 0);
	}

	function getOverheadMonthly() {
		const settings = hppSettings || ({} as Partial<HppSettings>);
		return (
			Number(settings.sewa_bulanan || 0) +
			Number(settings.listrik_bulanan || 0) +
			Number(settings.air_bulanan || 0) +
			Number(settings.gaji_bulanan || 0) +
			Number(settings.lainnya_bulanan || 0)
		);
	}

	function getOverheadPerItem() {
		const target = Math.max(1, Number(hppSettings?.target_item_bulanan || 1000));
		return Math.round(getOverheadMonthly() / target);
	}

	function getProductRecipeCost(productId: string | number) {
		return allRecipes
			.filter((recipe) => String(recipe.produk_id) === String(productId))
			.reduce(
				(sum, recipe) =>
					sum + Number(recipe.jumlah_per_item || 0) * getBahanCostPerUnit(recipe.bahan_id),
				0
			);
	}

	function getProductHpp(menu: Product) {
		const bahanCost = getProductRecipeCost(menu.id);
		return Math.round(bahanCost + getOverheadPerItem());
	}

	function getProductMargin(menu: Product) {
		const harga = Number(menu.harga || 0);
		return harga - getProductHpp(menu);
	}

	function formatCurrency(value: number) {
		return `Rp ${formatRupiah(Math.round(Number(value || 0)))}` ;
	}

	function confirmDeleteMenu(id: string | number) {
		menuIdToDelete = id;
		showDeleteModal = true;
	}

	async function doDeleteMenu() {
		if (menuIdToDelete !== null) {
			try {
				const menu = menus.find((m) => m.id === menuIdToDelete);
				if (menu?.gambar) {
					let key = '';
					if (menu.gambar.includes('/produk/')) {
						key = 'produk/' + menu.gambar.split('/produk/').pop();
					} else {
						const parts = menu.gambar.split('/');
						const filename = parts.pop();
						if (filename) {
							key = `produk/${filename}`;
						}
					}
					if (key) {
						await fetch('/api/upload', {
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ key })
						});
					}
				}
				await dataService.deleteRows('produk', { id: String(menuIdToDelete) });
				notifModalMsg = 'Menu berhasil dihapus!';
				notifModalType = 'success';
				showNotifModal = true;
			} catch (error) {
				notifModalMsg = 'Gagal menghapus menu: ' + ErrorHandler.extractErrorMessage(error);
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
	}

	function openKategoriForm(kat: Category | null) {
		if (!kat) {
			kategoriDetail = null;
			showKategoriDetailModal = true;
			kategoriDetailName = '';
			selectedMenuIds = [];
			unselectedMenuIds = menus.filter((m) => !m.kategori_id).map((m) => m.id);
			return;
		}
		kategoriDetail = kat;
		showKategoriDetailModal = true;
		kategoriDetailName = kat.nama;
		selectedMenuIds = menus.filter((m) => m.kategori_id === kat.id).map((m) => m.id);
		unselectedMenuIds = menus
			.filter((m) => !m.kategori_id)
			.map((m) => m.id)
			.filter((id) => !selectedMenuIds.includes(id));
	}

	function closeKategoriDetailModal() {
		showKategoriDetailModal = false;
		kategoriDetail = null;
	}

	async function saveKategoriDetail() {
		if (kategoriDetail) {
			await dataService.updateRows(
				'kategori',
				{ nama: kategoriDetailName },
				{ id: String(kategoriDetail.id) }
			);
			await updateMenusKategori(kategoriDetail.id, selectedMenuIds, kategoriDetail.id);
		} else {
			const { data } = await dataService.insertRows('kategori', { nama: kategoriDetailName });
			const newKategoriId = (data?.[0]?.id as string) ?? null;
			await updateMenusKategori(newKategoriId, selectedMenuIds, null);
		}
		showKategoriDetailModal = false;
		kategoriDetail = null;
		await fetchKategori();
		await fetchMenus();
		await afterUpdateCachePOS();
	}

	function confirmDeleteKategori(id: string | number) {
		kategoriIdToDelete = id;
		showDeleteKategoriModal = true;
	}

	async function doDeleteKategori() {
		if (kategoriIdToDelete !== null) {
			try {
				// Pertama, update semua menu yang menggunakan kategori ini menjadi null
				await dataService.updateRows(
					'produk',
					{ kategori_id: null },
					{ kategori_id: String(kategoriIdToDelete) }
				);

				// Kemudian hapus kategori
				await dataService.deleteRows('kategori', { id: String(kategoriIdToDelete) });

				showDeleteKategoriModal = false;
				kategoriIdToDelete = null;
				await fetchKategori();
				await fetchMenus();
				await afterUpdateCachePOS();
			} catch (error) {
				notifModalMsg = 'Gagal menghapus kategori: ' + ErrorHandler.extractErrorMessage(error);
				notifModalType = 'error';
				showNotifModal = true;
			}
		}
	}

	function cancelDeleteKategori() {
		showDeleteKategoriModal = false;
		kategoriIdToDelete = null;
	}

	function openEkstraForm(ekstra: (AddOn & { harga: number }) | null = null) {
		showEkstraForm = true;
		if (ekstra) {
			editEkstraId = ekstra.id;
			ekstraForm.nama = ekstra.nama;
			ekstraForm.harga = formatRupiah(ekstra.harga);
		} else {
			editEkstraId = null;
			ekstraForm.nama = '';
			ekstraForm.harga = '';
		}
	}

	async function saveEkstra() {
		if (!ekstraForm.nama.trim()) {
			notifModalMsg = 'Nama ekstra wajib diisi';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}
		const harga = parseRupiah(ekstraForm.harga);
		if (isNaN(harga) || harga <= 0) {
			notifModalMsg = 'Harga wajib diisi dan harus lebih dari 0';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}
		try {
			if (editEkstraId) {
				await dataService.updateRows(
					'tambahan',
					{ nama: ekstraForm.nama, harga: harga },
					{ id: String(editEkstraId) }
				);
			} else {
				await dataService.insertRows('tambahan', { nama: ekstraForm.nama, harga: harga });
			}
			await fetchEkstra();
			showEkstraForm = false;
			ekstraForm.nama = '';
			ekstraForm.harga = '';
			editEkstraId = null;
		} catch (error) {
			notifModalMsg = 'Gagal menyimpan ekstra: ' + ErrorHandler.extractErrorMessage(error);
			notifModalType = 'error';
			showNotifModal = true;
		}
		await afterUpdateCachePOS();
	}

	function confirmDeleteEkstra(id: string | number) {
		ekstraIdToDelete = id;
		showDeleteEkstraModal = true;
	}

	async function doDeleteEkstra() {
		if (ekstraIdToDelete !== null) {
			await dataService.deleteRows('tambahan', { id: String(ekstraIdToDelete) });
			showDeleteEkstraModal = false;
			ekstraIdToDelete = null;

			// Force refresh data dan clear memoization
			await fetchEkstra();

			await afterUpdateCachePOS();

		}
	}

	function cancelDeleteEkstra() {
		showDeleteEkstraModal = false;
		ekstraIdToDelete = null;
	}

	function openBahanForm(bahan: Ingredient | null = null) {
		showBahanForm = true;
		if (bahan) {
			editBahanId = bahan.id;
			bahanForm = {
				nama: bahan.nama,
				satuan: bahan.satuan || 'gram',
				stok_saat_ini: formatRupiah(bahan.stok_saat_ini) || '0',
				ambang_stok: formatRupiah(bahan.ambang_stok) || '0',
				jumlah_beli_terakhir: formatRupiah(bahan.jumlah_beli_terakhir),
				biaya_beli_terakhir: formatRupiah(bahan.biaya_beli_terakhir)
			};
		} else {
			editBahanId = null;
			bahanForm = {
				nama: '',
				satuan: 'gram',
				stok_saat_ini: '',
				ambang_stok: '',
				jumlah_beli_terakhir: '',
				biaya_beli_terakhir: ''
			};
		}
	}

	function closeBahanForm() {
		showBahanForm = false;
		editBahanId = null;
		bahanForm = {
			nama: '',
			satuan: 'gram',
			stok_saat_ini: '',
			ambang_stok: '',
			jumlah_beli_terakhir: '',
			biaya_beli_terakhir: ''
		};
	}

	async function saveBahan() {
		if (!bahanForm.nama.trim()) {
			notifModalMsg = 'Nama bahan wajib diisi';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}
		const payload = {
			nama: bahanForm.nama.trim(),
			satuan: bahanForm.satuan || 'gram',
			stok_saat_ini: Math.max(0, parseRupiah(bahanForm.stok_saat_ini)),
			ambang_stok: Math.max(0, parseRupiah(bahanForm.ambang_stok)),
			jumlah_beli_terakhir: Math.max(0, parseRupiah(bahanForm.jumlah_beli_terakhir)),
			biaya_beli_terakhir: Math.max(0, parseRupiah(bahanForm.biaya_beli_terakhir)),
			biaya_per_satuan:
				parseRupiah(bahanForm.jumlah_beli_terakhir) > 0
					? Math.round(
							(parseRupiah(bahanForm.biaya_beli_terakhir) /
								parseRupiah(bahanForm.jumlah_beli_terakhir)) *
								100
						) / 100
					: 0
		};
		try {
			if (editBahanId) {
				await dataService.updateRows('bahan', payload, { id: String(editBahanId) });
			} else {
				await dataService.insertRows('bahan', payload);
			}
			closeBahanForm();
			await dataService.invalidateCacheOnChange('bahan');
			await fetchBahan();
		} catch (error) {
			notifModalMsg = 'Gagal menyimpan bahan: ' + ErrorHandler.extractErrorMessage(error);
			notifModalType = 'error';
			showNotifModal = true;
		}
	}

	async function saveHppSettings() {
		const payload = {
			sewa_bulanan: parseRupiah(hppForm.sewa_bulanan),
			listrik_bulanan: parseRupiah(hppForm.listrik_bulanan),
			air_bulanan: parseRupiah(hppForm.air_bulanan),
			gaji_bulanan: parseRupiah(hppForm.gaji_bulanan),
			lainnya_bulanan: parseRupiah(hppForm.lainnya_bulanan),
			target_item_bulanan: Math.max(1, parseRupiah(hppForm.target_item_bulanan))
		};
		try {
			const result = await dataService.insertRows('hpp_settings', payload);
			hppSettings = (result.data?.[0] as unknown as HppSettings) || ({ ...payload } as HppSettings);
			await dataService.invalidateCacheOnChange('hpp_settings');
			await fetchHppSettings();
			notifModalMsg = 'Pengaturan HPP tersimpan';
			notifModalType = 'success';
			showNotifModal = true;
		} catch (error) {
			notifModalMsg = 'Gagal menyimpan HPP: ' + ErrorHandler.extractErrorMessage(error);
			notifModalType = 'error';
			showNotifModal = true;
		}
	}

	async function parseHppPurchaseText() {
		if (!hppPurchaseText.trim()) {
			notifModalMsg = 'Isi catatan belanja dulu';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}
		isParsingHpp = true;
		try {
			const res = await fetch('/api/hpp/parse', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: hppPurchaseText })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.message || 'Gagal parse belanja');
			hppParsedItems = data.items || [];
		} catch (error) {
			notifModalMsg = 'Gagal membaca catatan belanja: ' + ErrorHandler.extractErrorMessage(error);
			notifModalType = 'error';
			showNotifModal = true;
		}
		isParsingHpp = false;
	}

	async function saveParsedHppItem(item: {
		nama: string;
		satuan: string;
		purchase_qty: number;
		purchase_cost: number;
		biaya_per_satuan: number;
	}) {
		const existing = bahanList.find(
			(bahan) => bahan.nama.trim().toLowerCase() === item.nama.trim().toLowerCase()
		);
		try {
			if (existing) {
				await dataService.updateRows(
					'bahan',
					{
						satuan: item.satuan,
						jumlah_beli_terakhir: item.purchase_qty,
						biaya_beli_terakhir: item.purchase_cost,
						biaya_per_satuan: item.biaya_per_satuan
					},
					{ id: String(existing.id) }
				);
				await dataService.insertRows('bahan_mutasi', {
					bahan_id: String(existing.id),
					delta_jumlah: item.purchase_qty,
					source: 'purchase',
					catatan: `Belanja ${formatCurrency(item.purchase_cost)}`
				});
			} else {
				await dataService.insertRows('bahan', {
					nama: item.nama,
					satuan: item.satuan,
					stok_saat_ini: item.purchase_qty,
					ambang_stok: 0,
					jumlah_beli_terakhir: item.purchase_qty,
					biaya_beli_terakhir: item.purchase_cost,
					biaya_per_satuan: item.biaya_per_satuan
				});
			}
			await dataService.invalidateCacheOnChange('bahan');
			await fetchBahan();
			notifModalMsg = 'Bahan HPP tersimpan';
			notifModalType = 'success';
			showNotifModal = true;
		} catch (error) {
			notifModalMsg = 'Gagal menyimpan bahan HPP: ' + ErrorHandler.extractErrorMessage(error);
			notifModalType = 'error';
			showNotifModal = true;
		}
	}

	function openMutasiBahanForm(bahan: Ingredient) {
		mutasiBahanId = bahan.id;
		mutasiBahanForm = { delta_jumlah: '', catatan: '' };
		showMutasiBahanForm = true;
	}

	function closeMutasiBahanForm() {
		showMutasiBahanForm = false;
		mutasiBahanId = null;
		mutasiBahanForm = { delta_jumlah: '', catatan: '' };
	}

	async function saveMutasiBahan() {
		if (!mutasiBahanId) return;
		const delta = Number(mutasiBahanForm.delta_jumlah || 0);
		if (!Number.isFinite(delta) || delta === 0) {
			notifModalMsg = 'Jumlah stok masuk atau keluar wajib diisi';
			notifModalType = 'warning';
			showNotifModal = true;
			return;
		}
		try {
			await dataService.insertRows('bahan_mutasi', {
				bahan_id: String(mutasiBahanId),
				delta_jumlah: delta,
				source: 'manual',
				catatan: mutasiBahanForm.catatan
			});
			closeMutasiBahanForm();
			await dataService.invalidateCacheOnChange('bahan');
			await fetchBahan();
		} catch (error) {
			notifModalMsg = 'Gagal menyimpan stok bahan: ' + ErrorHandler.extractErrorMessage(error);
			notifModalType = 'error';
			showNotifModal = true;
		}
	}

	function confirmDeleteBahan(id: string | number) {
		bahanIdToDelete = id;
		showDeleteBahanModal = true;
	}

	async function doDeleteBahan() {
		if (bahanIdToDelete === null) return;
		try {
			await dataService.deleteRows('bahan', { id: String(bahanIdToDelete) });
			showDeleteBahanModal = false;
			bahanIdToDelete = null;
			await dataService.invalidateCacheOnChange('bahan');
			await fetchBahan();
		} catch (error) {
			notifModalMsg = 'Gagal menghapus bahan: ' + ErrorHandler.extractErrorMessage(error);
			notifModalType = 'error';
			showNotifModal = true;
		}
	}

	function cancelDeleteBahan() {
		showDeleteBahanModal = false;
		bahanIdToDelete = null;
	}

	// Helper functions for menu form
	function handleFileChange(e: Event) {
		if (isCropping) return;
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			cropperDialogImage = '';
			setTimeout(() => {
				cropperDialogImage = (ev.target as FileReader).result as string;
				showCropperDialog = true;
				isCropping = true;
			}, 10);
		};
		reader.readAsDataURL(file);
	}

	function handleCropperDone(data: { cropped: string }) {
		menuForm.gambar = data.cropped;
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
		menuForm.gambar = '';
		if (fileInputEl) {
			fileInputEl.value = '';
		}
	}



	function handleImgError(menuId: string | number) {
		imageError[menuId] = true;
	}



	function toggleMenuInKategoriRealtime(menuId: string | number) {
		if (selectedMenuIds.includes(menuId)) {
			selectedMenuIds = selectedMenuIds.filter((id) => id !== menuId);
			unselectedMenuIds = [...unselectedMenuIds, menuId];
		} else {
			unselectedMenuIds = unselectedMenuIds.filter((id) => id !== menuId);
			selectedMenuIds = [...selectedMenuIds, menuId];
		}
	}

	async function updateMenusKategori(
		kategoriId: string | number | null,
		menuIds: Array<string | number>,
		oldKategoriId: string | number | null
	) {
		try {
			// Update menu kategori untuk menu yang dipilih
			for (const menuId of menuIds) {
				await dataService.updateRows('produk', { kategori_id: kategoriId }, { id: String(menuId) });
			}

			// Jika ada kategori lama, update menu yang tidak dipilih untuk kembali ke kategori lama
			if (oldKategoriId) {
				const menusInOldKategori = menus.filter((m) => m.kategori_id === oldKategoriId);
				const menusToRemoveFromOldKategori = menusInOldKategori.filter(
					(m) => !menuIds.includes(m.id)
				);

				for (const menu of menusToRemoveFromOldKategori) {
					await dataService.updateRows('produk', { kategori_id: null }, { id: String(menu.id) });
				}
			}
		} catch (error) {
			ErrorHandler.logError(error, 'updateMenuCategories');
			throw error;
		}
	}

	async function uploadMenuImageFromDataUrl(dataUrl: string, menuId: string | number) {
		const res = await fetch(dataUrl);
		const blob = await res.blob();
		const file = new File([blob], `menu-${menuId}-${Date.now()}.jpg`, { type: 'image/jpeg' });
		const formData = new FormData();
		formData.append('file', file);

		const uploadRes = await fetch('/api/upload', {
			method: 'POST',
			body: formData
		});

		if (!uploadRes.ok) {
			const err = await uploadRes.json();
			throw new Error(err.error || 'Gagal mengunggah gambar');
		}

		const data = await uploadRes.json();
		return data.url;
	}

	// Helper functions for modal buttons
	function setMenuType(type: 'minuman' | 'makanan' | 'snack') {
		menuForm.tipe = type;
	}

	function setMenuKategori(kategoriId: string | number | null) {
		menuForm.kategori_id = kategoriId;
	}

	function toggleEkstra(ekstraId: string | number) {
		if (menuForm.ekstra_ids.includes(ekstraId)) {
			menuForm.ekstra_ids = menuForm.ekstra_ids.filter((id) => id !== ekstraId);
		} else {
			menuForm.ekstra_ids = [...menuForm.ekstra_ids, ekstraId];
		}
	}

	function setTrackStock(value: boolean) {
		menuForm.lacak_stok = value;
		if (value) menuForm.lacak_bahan = false;
	}

	function setTrackIngredients(value: boolean) {
		menuForm.lacak_bahan = value;
		if (value) menuForm.lacak_stok = false;
	}

	async function afterUpdateCachePOS() {
		await setCache('pos-data', {
			produkData: JSON.parse(JSON.stringify(menus)),
			kategoriData: JSON.parse(JSON.stringify(kategoriList)),
			tambahanData: JSON.parse(JSON.stringify(ekstraList))
		});

		// Clear dataService cache untuk memastikan data terbaru
		try {
			await dataService.clearAllCaches();
			await dataService.invalidateCacheOnChange('produk');
			await dataService.invalidateCacheOnChange('kategori');
			await dataService.invalidateCacheOnChange('tambahan');
			await dataService.invalidateCacheOnChange('bahan');
		} catch (error) {
			ErrorHandler.logError(error, 'clearDataServiceCache');
		}
	}


	// Tambahkan auto-dismiss 2 detik untuk notif
	$effect(() => {
		if (showNotifModal) {
			const timeout = setTimeout(() => {
				showNotifModal = false;
			}, 2000);
			return () => clearTimeout(timeout);
		}
	});
</script>

{#if toastManager.showToast}
	<ToastNotification
		show={toastManager.showToast}
		message={toastManager.toastMessage}
		type={toastManager.toastType}
		duration={3000}
		position="top"
	/>
{/if}

<!-- Seluruh markup manajemen menu, kategori, ekstra, dan modal dari file src/routes/pengaturan/pemilik/+page.svelte -->
<!-- Tambahkan seluruh markup (HTML/Svelte) untuk list/tabel menu, kategori, ekstra, form/modal tambah/edit/hapus, modal/modal sheet, komponen upload/crop gambar, dan semua tampilan serta interaksi CRUD menu, kategori, ekstra dari file /pemilik ke sini. Pastikan semua event handler, binding, dan logic tetap berjalan. Jangan sertakan bagian keamanan, riwayat, atau navigasi utama. -->

<div transition:fly={{ y: 32, duration: 320, easing: cubicOut }}>
	<!-- Custom Top Bar -->
	<div
		class="sticky top-0 z-40 mb-0 flex items-center border-b border-gray-200 bg-white px-4 py-4 shadow-sm"
	>
		<button
			onclick={() => goto('/pengaturan/pemilik')}
			class="mr-2 rounded-xl bg-gray-100 p-2 transition-colors hover:bg-gray-200"
		>
			<ArrowLeft class="h-5 w-5 text-gray-600" />
		</button>
		<h1 class="text-xl font-bold text-gray-800">Manajemen Menu</h1>
	</div>

	<!-- Navigasi Tab Menu/Kategori/Ekstra/Bahan -->
	<div class="mx-auto max-w-4xl px-4 pt-3">
		<div
			class="relative mb-3 flex overflow-hidden rounded-xl border border-gray-100 bg-white p-1 shadow md:h-16 md:gap-6 md:text-lg"
		>
			<!-- Sliding Background -->
			<div
				class="absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out {activeTab ===
				'menu'
					? 'left-1 w-[calc(20%-0.25rem)] bg-pink-500'
					: activeTab === 'kategori'
						? 'left-[calc(20%+0.125rem)] w-[calc(20%-0.25rem)] bg-blue-500'
						: activeTab === 'ekstra'
							? 'left-[calc(40%+0.125rem)] w-[calc(20%-0.25rem)] bg-green-500'
							: activeTab === 'bahan'
								? 'left-[calc(60%+0.125rem)] w-[calc(20%-0.25rem)] bg-amber-500'
								: 'left-[calc(80%+0.125rem)] w-[calc(20%-0.25rem)] bg-gray-700'}"
			></div>
			<button
				class="relative z-10 flex-1 rounded-lg py-2 text-[11px] sm:text-xs md:text-base font-semibold transition-all focus:outline-none {activeTab ===
				'menu'
					? 'text-white'
					: 'text-gray-700'} md:px-8 md:py-4"
				onclick={() => (activeTab = 'menu')}>Menu</button
			>
			<button
				class="relative z-10 flex-1 rounded-lg py-2 text-[11px] sm:text-xs md:text-base font-semibold transition-all focus:outline-none {activeTab ===
				'kategori'
					? 'text-white'
					: 'text-gray-700'} md:px-8 md:py-4"
				onclick={() => (activeTab = 'kategori')}>Kategori</button
			>
			<button
				class="relative z-10 flex-1 rounded-lg py-2 text-[11px] sm:text-xs md:text-base font-semibold transition-all focus:outline-none {activeTab ===
				'ekstra'
					? 'text-white'
					: 'text-gray-700'} md:px-8 md:py-4"
				onclick={() => (activeTab = 'ekstra')}>Tambahan</button
			>
			<button
				class="relative z-10 flex-1 rounded-lg py-2 text-[11px] sm:text-xs md:text-base font-semibold transition-all focus:outline-none {activeTab ===
				'bahan'
					? 'text-white'
					: 'text-gray-700'} md:px-8 md:py-4"
				onclick={() => (activeTab = 'bahan')}>Bahan</button
			>
			<button
				class="relative z-10 flex-1 rounded-lg py-2 text-[11px] sm:text-xs md:text-base font-semibold transition-all focus:outline-none {activeTab ===
				'hpp'
					? 'text-white'
					: 'text-gray-700'} md:px-8 md:py-4"
				onclick={() => (activeTab = 'hpp')}>HPP</button
			>
		</div>
	</div>

	<!-- Floating Action Button (FAB) bulat untuk tambah data sesuai tab aktif -->
	{#if activeTab === 'menu'}
		<button
			class="fixed right-6 bottom-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition-colors hover:bg-pink-600"
			onclick={() => openMenuForm()}
			aria-label="Tambah Menu"
		>
			<Plus class="h-8 w-8" />
		</button>
	{:else if activeTab === 'kategori'}
		<button
			class="fixed right-6 bottom-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-colors hover:bg-blue-600"
			onclick={() => openKategoriForm(null)}
			aria-label="Tambah Kategori"
		>
			<Plus class="h-8 w-8" />
		</button>
	{:else if activeTab === 'ekstra'}
		<button
			class="fixed right-6 bottom-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-colors hover:bg-green-600"
			onclick={() => openEkstraForm()}
			aria-label="Tambah Tambahan"
		>
			<Plus class="h-8 w-8" />
		</button>
	{:else if activeTab === 'bahan'}
		<button
			class="fixed right-6 bottom-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-colors hover:bg-amber-600"
			onclick={() => openBahanForm()}
			aria-label="Tambah Bahan"
		>
			<Plus class="h-8 w-8" />
		</button>
	{/if}

	<!-- Konten tab dengan transisi geser -->
	<div class="relative min-h-screen">
		{#if activeTab === 'menu'}
			<MenuTab
				bind:searchKeyword
				bind:selectedKategori
				bind:isGridView
				{isLoadingKategori}
				{isLoadingMenus}
				{kategoriList}
				{filteredMenus}
				{openMenuForm}
				{confirmDeleteMenu}
				{handleImgError}
			/>
		{:else if activeTab === 'kategori'}
			<KategoriTab
				bind:searchKategoriKeyword
				{isLoadingKategori}
				{kategoriList}
				{menus}
				{openKategoriForm}
				{confirmDeleteKategori}
			/>
		{:else if activeTab === 'ekstra'}
			<EkstraTab
				bind:searchEkstra
				{isLoadingEkstra}
				{ekstraList}
				{openEkstraForm}
				{confirmDeleteEkstra}
			/>
		{:else if activeTab === 'bahan'}
			<BahanTab
				bind:searchBahan
				{isLoadingBahan}
				{bahanList}
				{formatCurrency}
				{openBahanForm}
				{openMutasiBahanForm}
				{confirmDeleteBahan}
			/>
		{:else if activeTab === 'hpp'}
			<HppTab
				bind:hppForm
				bind:hppPurchaseText
				{hppSettings}
				{hppParsedItems}
				{isParsingHpp}
				{menus}
				{formatCurrency}
				{getOverheadMonthly}
				{getOverheadPerItem}
				{getProductRecipeCost}
				{getProductHpp}
				{getProductMargin}
				{saveHppSettings}
				{parseHppPurchaseText}
				{saveParsedHppItem}
			/>
		{/if}
	</div>

	<!-- Modal untuk tambah/edit menu -->
	{#if showMenuForm}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.target === e.currentTarget && closeMenuForm()}
			onkeydown={(e) => e.key === 'Escape' && closeMenuForm()}
			onkeypress={(e) => e.key === 'Enter' && closeMenuForm()}
			tabindex="-1"
		>
			<div
				class="animate-slideUpModal mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
				role="document"
				onclick={(e) => e.stopPropagation()}
			>
				<!-- Header -->
				<div class="flex-shrink-0 border-b border-gray-100 bg-white px-6 py-4">
					<h2 class="text-center text-xl font-bold text-gray-800">
						{editMenuId ? 'Edit Menu' : 'Tambah Menu Baru'}
					</h2>
				</div>

				<!-- Scrollable Form Content -->
				<form
					id="menu-form"
					class="flex flex-1 flex-col gap-6 overflow-y-auto p-6"
					onsubmit={saveMenu}
					autocomplete="off"
				>
					<!-- Preview Gambar Menu -->
					<div class="flex flex-col gap-3">
						<label for="menu-image" class="text-sm font-semibold text-gray-700">Gambar Menu</label>
						<div class="w-full">
							<button
								type="button"
								class="group relative w-full cursor-pointer"
								onclick={() => fileInputEl?.click()}
							>
								{#if menuForm.gambar}
									<div class="relative w-full">
										<img
											src={menuForm.gambar}
											alt="Preview Menu"
											class="aspect-square w-full rounded-xl border-2 border-gray-200 object-cover shadow-sm"
										/>
										<!-- Floating Delete Button -->
										<div
											class="absolute top-2 right-2 z-10 cursor-pointer rounded-full bg-red-500 p-2 text-white shadow-lg transition-all duration-200 hover:bg-red-600"
											role="button"
											tabindex="0"
											aria-label="Hapus gambar"
											onclick={(e) => {
												e.stopPropagation();
												removeImage();
											}}
											onkeydown={(e) => e.key === 'Enter' && (e.stopPropagation(), removeImage())}
											onkeypress={(e) => e.key === 'Enter' && (e.stopPropagation(), removeImage())}
										>
											<svg
												class="h-4 w-4"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</div>
										<div
											class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-all duration-200 group-hover:opacity-100"
										>
											<div class="text-center">
												<svg
													class="mx-auto mb-2 h-8 w-8 text-white"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
												<span class="text-sm font-medium text-white">Klik untuk Ubah Gambar</span>
											</div>
										</div>
									</div>
								{:else}
									<div
										class="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-all duration-200 group-hover:border-pink-300 group-hover:bg-gray-100"
									>
										<div class="text-center">
											<svg
												class="mx-auto mb-3 h-12 w-12 text-gray-400"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
												/>
											</svg>
											<span class="text-base font-medium text-gray-500"
												>Klik untuk Upload Gambar</span
											>
											<p class="mt-1 text-xs text-gray-400">PNG, JPG, atau GIF (Max. 5MB)</p>
										</div>
									</div>
								{/if}
							</button>
						</div>
						<input
							type="file"
							accept="image/*"
							class="hidden"
							bind:this={fileInputEl}
							onchange={handleFileChange}
						/>
					</div>

					<!-- Nama Menu -->
					<div class="flex flex-col gap-2">
						<label for="menu-name" class="text-sm font-semibold text-gray-700">Nama Menu</label>
						<input
							type="text"
							id="menu-name"
							class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base transition-all focus:border-transparent focus:ring-2 focus:ring-pink-500"
							bind:value={menuForm.nama}
							required
							placeholder="Contoh: Es Teh Manis"
						/>
					</div>

					<!-- Harga -->
					<div class="flex flex-col gap-2">
						<label for="menu-harga" class="text-sm font-semibold text-gray-700">Harga</label>
						<div class="relative">
							<span class="absolute top-1/2 left-4 -translate-y-1/2 font-medium text-gray-400"
								>Rp</span
							>
							<input
								type="text"
								id="menu-harga"
								class="w-full rounded-xl border border-gray-300 py-3 pr-4 pl-12 text-base transition-all focus:border-transparent focus:ring-2 focus:ring-pink-500"
								bind:value={menuForm.harga}
								oninput={handleRupiahInput(menuForm, 'harga')}
								required
								placeholder="0"
							/>
						</div>
					</div>

					<!-- Stok Menu -->
					<div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
						<label class="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
							<span>
								<span class="block text-sm font-semibold text-gray-800">Stok barang jadi</span>
								<span class="mt-1 block text-xs text-gray-500"
									>Untuk snack, pudding, makanan siap jual.</span
								>
							</span>
							<input
								type="checkbox"
								class="h-5 w-5 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
								bind:checked={menuForm.lacak_stok}
								onchange={(event) =>
									setTrackStock((event.currentTarget as HTMLInputElement).checked)}
							/>
						</label>
						{#if menuForm.lacak_stok}
							<div class="mt-4 flex flex-col gap-2">
								<label for="menu-stok" class="text-sm font-semibold text-gray-700"
									>Stok Saat Ini</label
								>
								<input
									type="number"
									id="menu-stok"
									min="0"
									step="1"
									class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base transition-all focus:border-transparent focus:ring-2 focus:ring-pink-500"
									bind:value={menuForm.stok}
									placeholder="0"
								/>
							</div>
						{/if}
						<label class="mt-4 flex items-center justify-between gap-4">
							<span>
								<span class="block text-sm font-semibold text-gray-800">Pakai resep bahan</span>
								<span class="mt-1 block text-xs text-gray-500"
									>Untuk jus made by order. Checkout potong stok buah, gula, susu, cup.</span
								>
							</span>
							<input
								type="checkbox"
								class="h-5 w-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
								bind:checked={menuForm.lacak_bahan}
								onchange={(event) =>
									setTrackIngredients((event.currentTarget as HTMLInputElement).checked)}
							/>
						</label>
						{#if menuForm.lacak_bahan}
							<div class="mt-4 rounded-xl border border-amber-200 bg-white p-3">
								<div class="mb-3 grid grid-cols-[1fr_96px_auto] gap-2">
									<select
										class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
										bind:value={recipeDraft.bahan_id}
									>
										<option value="">Pilih bahan</option>
										{#each bahanList as bahan}
											<option value={bahan.id}>{bahan.nama} ({bahan.satuan})</option>
										{/each}
									</select>
									<input
										type="number"
										min="0"
										step="0.01"
										class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
										bind:value={recipeDraft.jumlah_per_item}
										placeholder="Takaran"
									/>
									<button
										type="button"
										class="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white"
										onclick={addRecipeItem}
									>
										Tambah
									</button>
								</div>
								{#if recipeItems.length === 0}
									<div class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
										Belum ada bahan resep.
									</div>
								{:else}
									<div class="flex flex-col gap-2">
										{#each recipeItems as recipe}
											<div
												class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
											>
												<div class="min-w-0">
													<div class="truncate text-sm font-semibold text-gray-800">
														{getBahanName(recipe.bahan_id)}
													</div>
													<div class="text-xs text-gray-500">
														{formatRupiah(recipe.jumlah_per_item || 0)}
														{getBahanUnit(recipe.bahan_id)} per item
													</div>
												</div>
												<button
													type="button"
													class="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
													onclick={() => removeRecipeItem(recipe.bahan_id)}
												>
													Hapus
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Tipe Menu -->
					<div class="flex flex-col gap-3">
						<label for="menu-type" class="text-sm font-semibold text-gray-700">Tipe Menu</label>
						<div class="flex gap-3">
							<button
								type="button"
								class="flex-1 rounded-xl border-2 px-4 py-3 font-medium transition-all duration-200 {menuForm.tipe ===
								'minuman'
									? 'border-pink-500 bg-pink-500 text-white shadow-lg shadow-pink-200'
									: 'border-gray-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50'}"
								onclick={() => setMenuType('minuman')}
							>
								<div class="flex items-center justify-center gap-2">
									<CupSoda class="h-5 w-5" />
									<span class="text-sm">Minuman</span>
								</div>
							</button>
							<button
								type="button"
								class="flex-1 rounded-xl border-2 px-4 py-3 font-medium transition-all duration-200 {menuForm.tipe ===
								'makanan'
									? 'border-pink-500 bg-pink-500 text-white shadow-lg shadow-pink-200'
									: 'border-gray-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50'}"
								onclick={() => setMenuType('makanan')}
							>
								<div class="flex items-center justify-center gap-2">
									<Pizza class="h-5 w-5" />
									<span class="text-sm">Makanan</span>
								</div>
							</button>
						</div>
					</div>

					<!-- Kategori -->
					<div class="flex flex-col gap-3">
						<label for="menu-kategori" class="text-sm font-semibold text-gray-700">Kategori</label>
						<div class="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
							{#each kategoriList as kat}
								<button
									type="button"
									class="flex-shrink-0 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 {menuForm.kategori_id ===
									kat.id
										? 'border-pink-500 bg-pink-500 text-white shadow-lg shadow-pink-200'
										: 'border-gray-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50'}"
									onclick={() => setMenuKategori(menuForm.kategori_id === kat.id ? null : kat.id)}
								>
									{kat.nama}
								</button>
							{/each}
						</div>
					</div>

					<!-- Tambahan -->
					<div class="flex flex-col gap-3">
						<label for="menu-tambahan" class="text-sm font-semibold text-gray-700">Tambahan</label>
						<div class="grid grid-cols-2 gap-3">
							{#each ekstraList as ekstra}
								<button
									type="button"
									class="rounded-xl border-2 p-3 text-left transition-all duration-200 {menuForm.ekstra_ids.includes(
										ekstra.id
									)
										? 'border-pink-500 bg-pink-50 shadow-lg shadow-pink-100'
										: 'border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50'}"
									onclick={() => toggleEkstra(ekstra.id)}
								>
									<div class="mb-0.5 text-sm font-medium text-gray-800">{ekstra.nama}</div>
									<div class="text-xs font-semibold text-pink-600">
										+Rp {formatRupiah(ekstra.harga)}
									</div>
								</button>
							{/each}
						</div>
					</div>
				</form>

				<!-- Fixed Action Buttons -->
				<div class="flex flex-shrink-0 gap-3 border-t border-gray-100 bg-white p-6">
					<button
						type="submit"
						form="menu-form"
						class="flex-1 rounded-xl bg-pink-500 py-3 font-semibold text-white shadow-lg shadow-pink-200 transition-all duration-200 hover:bg-pink-600 active:bg-pink-700"
					>
						{editMenuId ? 'Update Menu' : 'Simpan Menu'}
					</button>
					<button
						type="button"
						class="flex-1 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-200 active:bg-gray-300"
						onclick={closeMenuForm}
					>
						Batal
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal untuk tambah/edit kategori -->
	{#if showKategoriDetailModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.target === e.currentTarget && closeKategoriDetailModal()}
			onkeydown={(e) => e.key === 'Escape' && closeKategoriDetailModal()}
			onkeypress={(e) => e.key === 'Enter' && closeKategoriDetailModal()}
			tabindex="-1"
		>
			<div
				class="animate-slideUpModal mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
				role="document"
				onclick={(e) => e.stopPropagation()}
			>
				<!-- Header -->
				<div class="flex-shrink-0 border-b border-gray-100 p-6">
					<h2 class="text-center text-xl font-bold text-gray-800">
						{kategoriDetail ? 'Edit Kategori' : 'Tambah Kategori'}
					</h2>
				</div>

				<!-- Content -->
				<div class="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
					<form
						id="kategori-form"
						class="flex flex-col gap-6"
						onsubmit={saveKategoriDetail}
						autocomplete="off"
					>
						<!-- Nama Kategori -->
						<div class="flex flex-col gap-2">
							<label for="kategori-name" class="mb-1 text-sm font-semibold text-gray-700"
								>Nama Kategori</label
							>
							<input
								type="text"
								id="kategori-name"
								class="w-full rounded-xl border border-blue-200 bg-white px-5 py-3 text-base placeholder-gray-400 shadow-sm transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
								bind:value={kategoriDetailName}
								required
								placeholder="Masukkan nama kategori"
							/>
						</div>

						<!-- Menu dalam Kategori -->
						<div class="flex flex-col gap-2">
							<label for="menu-dalam-kategori" class="mb-1 text-sm font-semibold text-gray-700"
								>Menu dalam Kategori</label
							>
							<div class="flex min-h-[48px] flex-wrap gap-2">
								{#if selectedMenuIds.length > 0}
									{#each menus.filter( (menu) => selectedMenuIds.includes(menu.id) ) as menu (menu.id)}
										<button
											type="button"
											class="inline-flex items-center rounded-full bg-blue-100 px-4 py-2 font-medium text-blue-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:ring-2 focus:ring-blue-200 focus:outline-none"
											style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
											title={menu.nama}
											onclick={() => toggleMenuInKategoriRealtime(menu.id)}
											in:fly={{ y: 16, duration: 180 }}
											out:fly={{ y: 16, duration: 180 }}
										>
											{menu.nama}
										</button>
									{/each}
								{:else}
									<span class="text-sm text-gray-400 italic">Belum ada menu dalam kategori ini</span
									>
								{/if}
							</div>
						</div>

						<!-- Menu non Kategori -->
						<div class="flex flex-col gap-2">
							<label for="menu-non-kategori" class="mb-1 text-sm font-semibold text-gray-700"
								>Menu non Kategori</label
							>
							<div class="flex min-h-[48px] flex-wrap gap-2">
								{#if unselectedMenuIds.length > 0}
									{#each menus.filter( (menu) => unselectedMenuIds.includes(menu.id) ) as menu (menu.id)}
										<button
											type="button"
											class="inline-flex items-center rounded-full border border-blue-200 bg-white px-4 py-2 font-medium text-blue-500 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md focus:ring-2 focus:ring-blue-100 focus:outline-none"
											style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
											title={menu.nama}
											onclick={() => toggleMenuInKategoriRealtime(menu.id)}
											in:fly={{ y: 16, duration: 180 }}
											out:fly={{ y: 16, duration: 180 }}
										>
											{menu.nama}
										</button>
									{/each}
								{:else}
									<span class="text-sm text-gray-400 italic">Semua menu sudah masuk kategori</span>
								{/if}
							</div>
						</div>
					</form>
				</div>

				<!-- Fixed Action Buttons -->
				<div class="flex flex-shrink-0 gap-3 border-t border-gray-100 bg-white p-6">
					<button
						type="submit"
						form="kategori-form"
						class="flex-1 rounded-xl bg-blue-500 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition-all duration-200 hover:bg-blue-600 active:bg-blue-700"
					>
						{kategoriDetail ? 'Update Kategori' : 'Simpan Kategori'}
					</button>
					<button
						type="button"
						class="flex-1 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-200 active:bg-gray-300"
						onclick={closeKategoriDetailModal}
					>
						Batal
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal untuk tambah/edit ekstra -->
	{#if showEkstraForm}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
			role="dialog"
			aria-modal="true"
			onclick={(e) =>
				e.target === e.currentTarget &&
				((showEkstraForm = false), (ekstraForm = { nama: '', harga: '' }), (editEkstraId = null))}
			onkeydown={(e) =>
				e.key === 'Escape' &&
				((showEkstraForm = false), (ekstraForm = { nama: '', harga: '' }), (editEkstraId = null))}
			onkeypress={(e) =>
				e.key === 'Enter' &&
				((showEkstraForm = false), (ekstraForm = { nama: '', harga: '' }), (editEkstraId = null))}
			tabindex="-1"
		>
			<div
				class="animate-slideUpModal relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
				role="document"
				onclick={(e) => e.stopPropagation()}
			>
				<h2 class="mb-4 text-center text-lg font-bold text-gray-800">
					{editEkstraId ? 'Edit Tambahan' : 'Tambah Tambahan'}
				</h2>
				<form class="flex flex-col gap-4" onsubmit={saveEkstra} autocomplete="off">
					<div class="flex flex-col gap-2">
						<label for="ekstra-name" class="font-semibold text-gray-700">Nama Tambahan</label>
						<input
							type="text"
							class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base transition-all focus:border-transparent focus:ring-2 focus:ring-green-500"
							bind:value={ekstraForm.nama}
							required
							placeholder="Contoh: Es Teh Manis"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<label for="ekstra-harga" class="font-semibold text-gray-700">Harga Tambahan</label>
						<div class="relative">
							<span class="absolute top-1/2 left-4 -translate-y-1/2 font-medium text-gray-400"
								>Rp</span
							>
							<input
								type="text"
								class="w-full rounded-xl border border-gray-300 py-3 pr-4 pl-12 text-base transition-all focus:border-transparent focus:ring-2 focus:ring-green-500"
								bind:value={ekstraForm.harga}
								oninput={handleRupiahInput(ekstraForm, 'harga')}
								required
								placeholder="0"
							/>
						</div>
					</div>
					<div class="mt-4 flex gap-2">
						<button
							type="submit"
							class="flex-1 rounded-xl bg-green-500 py-3 font-semibold text-white shadow-lg shadow-green-200 transition-all duration-200 hover:bg-green-600 active:bg-green-700"
							>Simpan</button
						>
						<button
							type="button"
							class="flex-1 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-200 active:bg-gray-300"
							onclick={() => {
								showEkstraForm = false;
								ekstraForm = { nama: '', harga: '' };
								editEkstraId = null;
							}}>Batal</button
						>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if showBahanForm}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.target === e.currentTarget && closeBahanForm()}
			onkeydown={(e) => e.key === 'Escape' && closeBahanForm()}
			tabindex="-1"
		>
			<div
				class="animate-slideUpModal relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
				role="document"
				onclick={(e) => e.stopPropagation()}
			>
				<h2 class="mb-4 text-center text-lg font-bold text-gray-800">
					{editBahanId ? 'Edit Bahan' : 'Tambah Bahan'}
				</h2>
				<form class="flex flex-col gap-4" onsubmit={saveBahan} autocomplete="off">
					<div class="flex flex-col gap-2">
						<label for="bahan-name" class="font-semibold text-gray-700">Nama Bahan</label>
						<input
							id="bahan-name"
							type="text"
							class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:ring-2 focus:ring-amber-300"
							bind:value={bahanForm.nama}
							required
							placeholder="Contoh: Alpukat"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="flex flex-col gap-2">
							<label for="bahan-satuan" class="font-semibold text-gray-700">Satuan</label>
							<select
								id="bahan-satuan"
								class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:ring-2 focus:ring-amber-300"
								bind:value={bahanForm.satuan}
							>
								<option value="gram">gram</option>
								<option value="ml">ml</option>
								<option value="pcs">pcs</option>
								<option value="buah">buah</option>
							</select>
						</div>
						<div class="flex flex-col gap-2">
							<label for="bahan-stock" class="font-semibold text-gray-700">Stok Awal</label>
							<input
								id="bahan-stock"
								type="text"
								class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:ring-2 focus:ring-amber-300"
								bind:value={bahanForm.stok_saat_ini}
								oninput={handleRupiahInput(bahanForm, 'stok_saat_ini')}
								placeholder="0"
							/>
						</div>
					</div>
					<div class="flex flex-col gap-2">
						<label for="bahan-low" class="font-semibold text-gray-700">Minimum Stok</label>
						<input
							id="bahan-low"
							type="text"
							class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:ring-2 focus:ring-amber-300"
							bind:value={bahanForm.ambang_stok}
							oninput={handleRupiahInput(bahanForm, 'ambang_stok')}
							placeholder="0"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="flex flex-col gap-2">
							<label for="bahan-purchase-jumlah" class="font-semibold text-gray-700"
								>Jumlah Beli</label
							>
							<input
								id="bahan-purchase-jumlah"
								type="text"
								class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:ring-2 focus:ring-amber-300"
								bind:value={bahanForm.jumlah_beli_terakhir}
								oninput={handleRupiahInput(bahanForm, 'jumlah_beli_terakhir')}
								placeholder="Contoh: 1.000"
							/>
						</div>
						<div class="flex flex-col gap-2">
							<label for="bahan-purchase-cost" class="font-semibold text-gray-700">Harga Beli</label>
							<div class="relative">
								<span class="absolute top-1/2 left-4 -translate-y-1/2 font-medium text-gray-400">Rp</span>
								<input
									id="bahan-purchase-cost"
									type="text"
									class="w-full rounded-xl border border-gray-300 py-3 pr-4 pl-12 text-base focus:ring-2 focus:ring-amber-300"
									bind:value={bahanForm.biaya_beli_terakhir}
									oninput={handleRupiahInput(bahanForm, 'biaya_beli_terakhir')}
									placeholder="18.000"
								/>
							</div>
						</div>
					</div>
					{#if Number(String(bahanForm.jumlah_beli_terakhir).replace(/\./g, '') || 0) > 0}
						<div class="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
							HPP bahan {formatCurrency(
								Number(String(bahanForm.biaya_beli_terakhir).replace(/\./g, '') || 0) /
									Number(String(bahanForm.jumlah_beli_terakhir).replace(/\./g, '') || 1)
							)}
							per {bahanForm.satuan}
						</div>
					{/if}
					<div class="mt-4 flex gap-2">
						<button
							type="submit"
							class="flex-1 rounded-xl bg-amber-500 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
							>Simpan</button
						>
						<button
							type="button"
							class="flex-1 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
							onclick={closeBahanForm}>Batal</button
						>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if showMutasiBahanForm}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.target === e.currentTarget && closeMutasiBahanForm()}
			onkeydown={(e) => e.key === 'Escape' && closeMutasiBahanForm()}
			tabindex="-1"
		>
			<div
				class="animate-slideUpModal relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
				role="document"
				onclick={(e) => e.stopPropagation()}
			>
				<h2 class="mb-4 text-center text-lg font-bold text-gray-800">Ubah Stok Bahan</h2>
				<form class="flex flex-col gap-4" onsubmit={saveMutasiBahan} autocomplete="off">
					<div class="flex flex-col gap-2">
						<label for="mutasi-delta" class="font-semibold text-gray-700">Jumlah</label>
						<input
							id="mutasi-delta"
							type="number"
							step="0.01"
							class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:ring-2 focus:ring-amber-300"
							bind:value={mutasiBahanForm.delta_jumlah}
							required
							placeholder="Contoh: 500 atau -100"
						/>
						<p class="text-xs text-gray-500">
							Angka positif untuk stok masuk, negatif untuk koreksi keluar.
						</p>
					</div>
					<div class="flex flex-col gap-2">
						<label for="mutasi-catatan" class="font-semibold text-gray-700">Catatan</label>
						<input
							id="mutasi-catatan"
							type="text"
							class="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:ring-2 focus:ring-amber-300"
							bind:value={mutasiBahanForm.catatan}
							placeholder="Belanja bahan / koreksi opname"
						/>
					</div>
					<div class="mt-4 flex gap-2">
						<button
							type="submit"
							class="flex-1 rounded-xl bg-amber-500 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
							>Simpan</button
						>
						<button
							type="button"
							class="flex-1 rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
							onclick={closeMutasiBahanForm}>Batal</button
						>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Modal konfirmasi hapus menu -->
	{#if showDeleteModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div
				class="animate-slideUpModal relative flex w-full max-w-xs flex-col items-center rounded-2xl bg-white p-6 shadow-xl"
			>
				<h2 class="mb-2 text-center text-lg font-bold text-gray-800">Hapus Menu?</h2>
				<p class="mb-6 text-center text-sm text-gray-500">
					Menu yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus menu ini?
				</p>
				<div class="flex w-full gap-3">
					<button
						class="flex-1 rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
						onclick={cancelDeleteMenu}>Batal</button
					>
					<button
						class="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600"
						onclick={doDeleteMenu}>Hapus</button
					>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal konfirmasi hapus kategori -->
	{#if showDeleteKategoriModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div
				class="animate-slideUpModal relative flex w-full max-w-xs flex-col items-center rounded-2xl bg-white p-6 shadow-xl"
			>
				<h2 class="mb-2 text-center text-lg font-bold text-gray-800">Hapus Kategori?</h2>
				<p class="mb-6 text-center text-sm text-gray-500">
					Kategori yang dihapus tidak dapat dikembalikan. Menu dalam kategori ini akan menjadi tanpa
					kategori. Yakin ingin menghapus kategori ini?
				</p>
				<div class="flex w-full gap-3">
					<button
						class="flex-1 rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
						onclick={cancelDeleteKategori}>Batal</button
					>
					<button
						class="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600"
						onclick={doDeleteKategori}>Hapus</button
					>
				</div>
			</div>
		</div>
	{/if}

	<!-- Modal konfirmasi hapus ekstra -->
	{#if showDeleteEkstraModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div
				class="animate-slideUpModal relative flex w-full max-w-xs flex-col items-center rounded-2xl bg-white p-6 shadow-xl"
			>
				<h2 class="mb-2 text-center text-lg font-bold text-gray-800">Hapus Ekstra?</h2>
				<p class="mb-6 text-center text-sm text-gray-500">
					Ekstra yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus ekstra ini?
				</p>
				<div class="flex w-full gap-3">
					<button
						class="flex-1 rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
						onclick={cancelDeleteEkstra}>Batal</button
					>
					<button
						class="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600"
						onclick={doDeleteEkstra}>Hapus</button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if showDeleteBahanModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div
				class="animate-slideUpModal relative flex w-full max-w-xs flex-col items-center rounded-2xl bg-white p-6 shadow-xl"
			>
				<h2 class="mb-2 text-center text-lg font-bold text-gray-800">Hapus Bahan?</h2>
				<p class="mb-6 text-center text-sm text-gray-500">
					Bahan tidak bisa dihapus kalau masih dipakai resep menu.
				</p>
				<div class="flex w-full gap-3">
					<button
						class="flex-1 rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
						onclick={cancelDeleteBahan}>Batal</button
					>
					<button
						class="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600"
						onclick={doDeleteBahan}>Hapus</button
					>
				</div>
			</div>
		</div>
	{/if}

	<!-- Notifikasi floating (toast) -->
	{#if showNotifModal}
		<ToastNotification
			show={showNotifModal}
			message={notifModalMsg}
			type={notifModalType === 'error' ? 'error' : 'success'}
			duration={2000}
			position="top"
		/>
	{/if}

	<!-- Komponen upload/crop gambar menu -->
	{#if showCropperDialog}
		<CropperDialog
			src={cropperDialogImage}
			bind:open={showCropperDialog}
			ondone={handleCropperDone}
			oncancel={handleCropperCancel}
		/>
	{/if}
</div>

<style>
	@keyframes slideUpModal {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	.animate-slideUpModal {
		animation: slideUpModal 0.32s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
