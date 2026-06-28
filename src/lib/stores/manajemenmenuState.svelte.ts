/**
 * State + CRUD logic untuk Manajemen Menu (SRP extract).
 *
 * Semua state, derived, fetch, dan CRUD handlers dipindah dari
 * +page.svelte agar parent jadi thin orchestrator.
 *
 * Lihat CONVENTIONS.md §7 — komponen UI.
 */
import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import { get as getCache, set as setCache } from 'idb-keyval';
import { dataService } from '$lib/services/dataService';
import { createToastManager } from '$lib/utils/ui';
import { ErrorHandler } from '$lib/utils/errorHandling';
import { formatRupiah, parseRupiah, handleRupiahInput } from '$lib/utils/currency';
import type {
	Product,
	Category,
	AddOn,
	Ingredient,
	ProductRecipe,
	HppSettings
} from '$lib/types/product';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HppParsedItem {
	nama: string;
	satuan: string;
	purchase_qty: number;
	purchase_cost: number;
	biaya_per_satuan: number;
}

// ── Store factory ────────────────────────────────────────────────────────────

export function createManajemenmenuState() {
	// ── Data state ──────────────────────────────────────────────────────────
	let menus = $state<Product[]>([]);
	let imageError = $state<Record<string, boolean>>({});
	let kategoriList = $state<Category[]>([]);
	let ekstraList = $state<(AddOn & { harga: number })[]>([]);
	let bahanList = $state<Ingredient[]>([]);
	let allRecipes = $state<ProductRecipe[]>([]);
	let hppSettings = $state<HppSettings | null>(null);

	// ── Form visibility state ──────────────────────────────────────────────
	let showMenuForm = $state(false);
	let showEkstraForm = $state(false);
	let showBahanForm = $state(false);
	let showMutasiBahanForm = $state(false);
	let editMenuId = $state<string | number | null>(null);
	let editEkstraId = $state<string | number | null>(null);
	let editBahanId = $state<string | number | null>(null);
	let mutasiBahanId = $state<string | number | null>(null);

	// ── Form data ──────────────────────────────────────────────────────────
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
	let hppParsedItems = $state<HppParsedItem[]>([]);
	let isParsingHpp = $state(false);
	let mutasiBahanForm = $state({ delta_jumlah: '', catatan: '' });
	let recipeItems = $state<Array<{ bahan_id: string | number; jumlah_per_item: string }>>([]);
	let recipeDraft = $state({ bahan_id: '', jumlah_per_item: '' });

	// ── UI state ───────────────────────────────────────────────────────────
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

	// Toast
	const toastManager = createToastManager();

	// ── Derived ────────────────────────────────────────────────────────────

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

	// ── Notif auto-dismiss ─────────────────────────────────────────────────
	$effect(() => {
		if (showNotifModal) {
			const timeout = setTimeout(() => {
				showNotifModal = false;
			}, 2000);
			return () => clearTimeout(timeout);
		}
	});

	// ── Branch-reactive data loading ───────────────────────────────────────
	let isInitialLoad = true;
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
		isInitialLoad = false;
	});

	// ── Fetch functions ────────────────────────────────────────────────────

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

	// ── Menu CRUD ──────────────────────────────────────────────────────────

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

	// ── Kategori CRUD ──────────────────────────────────────────────────────

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
				await dataService.updateRows(
					'produk',
					{ kategori_id: null },
					{ kategori_id: String(kategoriIdToDelete) }
				);
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

	// ── Ekstra CRUD ────────────────────────────────────────────────────────

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
			await fetchEkstra();
			await afterUpdateCachePOS();
		}
	}

	function cancelDeleteEkstra() {
		showDeleteEkstraModal = false;
		ekstraIdToDelete = null;
	}

	// ── Bahan CRUD ─────────────────────────────────────────────────────────

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

	// ── HPP functions ──────────────────────────────────────────────────────

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

	async function saveParsedHppItem(item: HppParsedItem) {
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

	// ── Helper functions ───────────────────────────────────────────────────

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
		return `Rp ${formatRupiah(Math.round(Number(value || 0)))}`;
	}

	// ── Image helpers ──────────────────────────────────────────────────────

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

	// ── Kategori-menu assignment ───────────────────────────────────────────

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
			for (const menuId of menuIds) {
				await dataService.updateRows('produk', { kategori_id: kategoriId }, { id: String(menuId) });
			}
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

	// ── Menu form helpers ──────────────────────────────────────────────────

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

	// ── Cache sync ─────────────────────────────────────────────────────────

	async function afterUpdateCachePOS() {
		await setCache('pos-data', {
			produkData: JSON.parse(JSON.stringify(menus)),
			kategoriData: JSON.parse(JSON.stringify(kategoriList)),
			tambahanData: JSON.parse(JSON.stringify(ekstraList))
		});

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

	// ── Public API ─────────────────────────────────────────────────────────

	return {
		// Data (read-only getters)
		get menus() { return menus; },
		get imageError() { return imageError; },
		get kategoriList() { return kategoriList; },
		get ekstraList() { return ekstraList; },
		get bahanList() { return bahanList; },
		get allRecipes() { return allRecipes; },
		get hppSettings() { return hppSettings; },
		get filteredMenus() { return filteredMenus; },
		get kategoriWithCount() { return kategoriWithCount; },

		// Form state (read/write for bindings)
		get menuForm() { return menuForm; },
		set menuForm(v) { menuForm = v; },
		get ekstraForm() { return ekstraForm; },
		set ekstraForm(v) { ekstraForm = v; },
		get bahanForm() { return bahanForm; },
		set bahanForm(v) { bahanForm = v; },
		get hppForm() { return hppForm; },
		set hppForm(v) { hppForm = v; },
		get hppPurchaseText() { return hppPurchaseText; },
		set hppPurchaseText(v) { hppPurchaseText = v; },
		get hppParsedItems() { return hppParsedItems; },
		get isParsingHpp() { return isParsingHpp; },
		get mutasiBahanForm() { return mutasiBahanForm; },
		set mutasiBahanForm(v) { mutasiBahanForm = v; },
		get recipeItems() { return recipeItems; },
		set recipeItems(v) { recipeItems = v; },
		get recipeDraft() { return recipeDraft; },
		set recipeDraft(v) { recipeDraft = v; },

		// UI state (read/write for bindings)
		get selectedKategori() { return selectedKategori; },
		set selectedKategori(v) { selectedKategori = v; },
		get searchKeyword() { return searchKeyword; },
		set searchKeyword(v) { searchKeyword = v; },
		get searchKategoriKeyword() { return searchKategoriKeyword; },
		set searchKategoriKeyword(v) { searchKategoriKeyword = v; },
		get searchEkstra() { return searchEkstra; },
		set searchEkstra(v) { searchEkstra = v; },
		get searchBahan() { return searchBahan; },
		set searchBahan(v) { searchBahan = v; },
		get isGridView() { return isGridView; },
		set isGridView(v) { isGridView = v; },
		get activeTab() { return activeTab; },
		set activeTab(v) { activeTab = v; },

		// Visibility state
		get showMenuForm() { return showMenuForm; },
		get editMenuId() { return editMenuId; },
		get showEkstraForm() { return showEkstraForm; },
		get editEkstraId() { return editEkstraId; },
		get showBahanForm() { return showBahanForm; },
		get editBahanId() { return editBahanId; },
		get showMutasiBahanForm() { return showMutasiBahanForm; },
		get mutasiBahanId() { return mutasiBahanId; },
		get showDeleteModal() { return showDeleteModal; },
		get showDeleteKategoriModal() { return showDeleteKategoriModal; },
		get showKategoriDetailModal() { return showKategoriDetailModal; },
		get kategoriDetail() { return kategoriDetail; },
		get selectedMenuIds() { return selectedMenuIds; },
		set selectedMenuIds(v) { selectedMenuIds = v; },
		get unselectedMenuIds() { return unselectedMenuIds; },
		set unselectedMenuIds(v) { unselectedMenuIds = v; },
		get kategoriDetailName() { return kategoriDetailName; },
		set kategoriDetailName(v) { kategoriDetailName = v; },
		get showDeleteEkstraModal() { return showDeleteEkstraModal; },
		get showDeleteBahanModal() { return showDeleteBahanModal; },
		get showNotifModal() { return showNotifModal; },
		set showNotifModal(v) { showNotifModal = v; },
		get notifModalMsg() { return notifModalMsg; },
		get notifModalType() { return notifModalType; },
		get showCropperDialog() { return showCropperDialog; },
		get cropperDialogImage() { return cropperDialogImage; },
		get isCropping() { return isCropping; },
		get fileInputEl() { return fileInputEl; },
		set fileInputEl(v) { fileInputEl = v; },
		get isLoadingMenus() { return isLoadingMenus; },
		get isLoadingKategori() { return isLoadingKategori; },
		get isLoadingEkstra() { return isLoadingEkstra; },
		get isLoadingBahan() { return isLoadingBahan; },

		// Toast
		toastManager,

		// Formatters
		formatRupiah,
		parseRupiah,
		handleRupiahInput,
		formatCurrency,

		// Menu CRUD
		openMenuForm, closeMenuForm, saveMenu,
		confirmDeleteMenu, doDeleteMenu, cancelDeleteMenu,
		addRecipeItem, removeRecipeItem,

		// Kategori CRUD
		openKategoriForm, closeKategoriDetailModal, saveKategoriDetail,
		confirmDeleteKategori, doDeleteKategori, cancelDeleteKategori,
		toggleMenuInKategoriRealtime,

		// Ekstra CRUD
		openEkstraForm, saveEkstra,
		confirmDeleteEkstra, doDeleteEkstra, cancelDeleteEkstra,

		// Bahan CRUD
		openBahanForm, closeBahanForm, saveBahan,
		openMutasiBahanForm, closeMutasiBahanForm, saveMutasiBahan,
		confirmDeleteBahan, doDeleteBahan, cancelDeleteBahan,

		// HPP
		saveHppSettings, parseHppPurchaseText, saveParsedHppItem,
		getOverheadMonthly, getOverheadPerItem,
		getProductRecipeCost, getProductHpp, getProductMargin,

		// Helpers
		getBahanName, getBahanUnit,
		handleFileChange, handleCropperDone, handleCropperCancel,
		removeImage, handleImgError,
		setMenuType, setMenuKategori, toggleEkstra,
		setTrackStock, setTrackIngredients
	};
}
