import { createMenuCrud } from '$lib/services/manajemenmenuCrud';
import {
	deleteMenuImage,
	readImageFile,
	uploadMenuImageFromDataUrl
} from '$lib/utils/manajemenmenuImage';
import { formatRupiah, parseRupiah } from '$lib/utils/currency';
import { ErrorHandler } from '$lib/utils/errorHandling';
import type { Product } from '$lib/types/product';

interface MenuDeps {
	showNotif: (msg: string, type: string) => void;
	afterUpdate: () => Promise<void>;
	fetchRecipes: () => Promise<void>;
}

export function createMenuState(deps: MenuDeps) {
	const menuCrud = createMenuCrud();

	let menus = $state<Product[]>([]);
	const imageError = $state<Record<string, boolean>>({});
	let showMenuForm = $state(false);
	let editMenuId = $state<string | number | null>(null);
	let showDeleteModal = $state(false);
	let menuIdToDelete = $state<string | number | null>(null);
	let showCropperDialog = $state(false);
	let cropperDialogImage = $state('');
	let isCropping = $state(false);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let recipeItems = $state<Array<{ bahan_id: string | number; jumlah_per_item: string }>>([]);
	let recipeDraft = $state({ bahan_id: '', jumlah_per_item: '' });
	let selectedKategori = $state<string | number>('Semua');
	let searchKeyword = $state('');
	let isGridView = $state(true);
	let isLoadingMenus = $state(true);

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

	async function fetchMenus() {
		isLoadingMenus = true;
		try {
			menus = await menuCrud.load();
		} catch (error) {
			const e = error as Error;
			deps.showNotif('Gagal mengambil data menu: ' + (e?.message || 'Unknown error'), 'error');
		}
		isLoadingMenus = false;
	}

	async function openMenuForm(menu: Product | null = null): Promise<void> {
		if (showMenuForm && menu && editMenuId === menu.id) return;
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
				const recipes = await menuCrud.loadRecipes(menu.id);
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

	async function saveMenuRecipe(productId: string | number) {
		await menuCrud.saveRecipes(productId, recipeItems, menuForm.lacak_bahan);
	}

	async function saveMenu() {
		if (!menuForm.nama || menuForm.nama.trim() === '') {
			deps.showNotif('Nama menu wajib diisi!', 'warning');
			return;
		}
		if (!menuForm.harga || menuForm.harga.toString().trim() === '') {
			deps.showNotif('Harga menu wajib diisi!', 'warning');
			return;
		}
		if (menuForm.lacak_bahan && recipeItems.length === 0) {
			deps.showNotif('Resep bahan wajib diisi untuk menu jus.', 'warning');
			return;
		}

		let imageUrl = menuForm.gambar;
		if (imageUrl && imageUrl.startsWith('data:image/')) {
			try {
				imageUrl = await uploadMenuImageFromDataUrl(imageUrl, String(editMenuId || Date.now()));
			} catch (err) {
				deps.showNotif('Gagal upload gambar: ' + ErrorHandler.extractErrorMessage(err), 'error');
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
			result = await menuCrud.save(payload, editMenuId);
			const productId = editMenuId ?? (result?.data?.[0]?.id as string);
			if (productId) {
				await saveMenuRecipe(productId);
			}
		} catch (error) {
			deps.showNotif('Gagal menyimpan menu: ' + ErrorHandler.extractErrorMessage(error), 'error');
			return;
		}
		showMenuForm = false;
		await fetchMenus();
		await deps.fetchRecipes();
		await deps.afterUpdate();
	}

	function addRecipeItem() {
		const bahanId = recipeDraft.bahan_id;
		const jumlah = Number(recipeDraft.jumlah_per_item || 0);
		if (!bahanId || !Number.isFinite(jumlah) || jumlah <= 0) {
			deps.showNotif('Pilih bahan dan isi takaran resep.', 'warning');
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
				await deleteMenuImage(menu?.gambar);
				await menuCrud.remove(menuIdToDelete);
				deps.showNotif('Menu berhasil dihapus!', 'success');
			} catch (error) {
				deps.showNotif(
					'Gagal menghapus menu: ' + ErrorHandler.extractErrorMessage(error),
					'error'
				);
				return;
			}
			showDeleteModal = false;
			menuIdToDelete = null;
			await fetchMenus();
			await deps.afterUpdate();
		}
	}

	function cancelDeleteMenu() {
		showDeleteModal = false;
		menuIdToDelete = null;
	}

	async function handleFileChange(e: Event) {
		if (isCropping) return;
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		cropperDialogImage = await readImageFile(file);
		showCropperDialog = true;
		isCropping = true;
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
		if (fileInputEl) fileInputEl.value = '';
	}

	function handleImgError(menuId: string | number) {
		imageError[menuId] = true;
	}

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

	return {
		get menus() {
			return menus;
		},
		get imageError() {
			return imageError;
		},
		get menuForm() {
			return menuForm;
		},
		set menuForm(v) {
			menuForm = v;
		},
		get showMenuForm() {
			return showMenuForm;
		},
		get editMenuId() {
			return editMenuId;
		},
		get showDeleteModal() {
			return showDeleteModal;
		},
		get showCropperDialog() {
			return showCropperDialog;
		},
		get cropperDialogImage() {
			return cropperDialogImage;
		},
		get isCropping() {
			return isCropping;
		},
		get fileInputEl() {
			return fileInputEl;
		},
		set fileInputEl(v) {
			fileInputEl = v;
		},
		get recipeItems() {
			return recipeItems;
		},
		set recipeItems(v) {
			recipeItems = v;
		},
		get recipeDraft() {
			return recipeDraft;
		},
		set recipeDraft(v) {
			recipeDraft = v;
		},
		get selectedKategori() {
			return selectedKategori;
		},
		set selectedKategori(v) {
			selectedKategori = v;
		},
		get searchKeyword() {
			return searchKeyword;
		},
		set searchKeyword(v) {
			searchKeyword = v;
		},
		get isGridView() {
			return isGridView;
		},
		set isGridView(v) {
			isGridView = v;
		},
		get isLoadingMenus() {
			return isLoadingMenus;
		},
		fetchMenus,
		openMenuForm,
		closeMenuForm,
		saveMenu,
		confirmDeleteMenu,
		doDeleteMenu,
		cancelDeleteMenu,
		addRecipeItem,
		removeRecipeItem,
		handleFileChange,
		handleCropperDone,
		handleCropperCancel,
		removeImage,
		handleImgError,
		setMenuType,
		setMenuKategori,
		toggleEkstra,
		setTrackStock,
		setTrackIngredients
	};
}
