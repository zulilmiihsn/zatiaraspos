import { createEkstraCrud } from '$lib/services/manajemenmenuCrud';
import { formatRupiah, parseRupiah } from '$lib/utils/currency';
import { ErrorHandler } from '$lib/utils/errorHandling';
import type { AddOn } from '$lib/types/product';

interface EkstraDeps {
	showNotif: (msg: string, type: string) => void;
	afterUpdate: () => Promise<void>;
}

export function createEkstraState(deps: EkstraDeps) {
	const ekstraCrud = createEkstraCrud();

	let ekstraList = $state<(AddOn & { harga: number })[]>([]);
	let ekstraForm = $state({ nama: '', harga: '' });
	let showEkstraForm = $state(false);
	let editEkstraId = $state<string | number | null>(null);
	let showDeleteEkstraModal = $state(false);
	let ekstraIdToDelete = $state<string | number | null>(null);
	let searchEkstra = $state('');
	let isLoadingEkstra = $state(true);

	async function fetchEkstra() {
		isLoadingEkstra = true;
		try {
			ekstraList = await ekstraCrud.load();
		} catch (error) {
			const e = error as Error;
			deps.showNotif('Gagal mengambil data ekstra: ' + (e?.message || 'Unknown error'), 'error');
		}
		isLoadingEkstra = false;
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

	function closeEkstraForm() {
		showEkstraForm = false;
		editEkstraId = null;
		ekstraForm = { nama: '', harga: '' };
	}

	async function saveEkstra() {
		if (!ekstraForm.nama.trim()) {
			deps.showNotif('Nama ekstra wajib diisi', 'warning');
			return;
		}
		const harga = parseRupiah(ekstraForm.harga);
		if (isNaN(harga) || harga <= 0) {
			deps.showNotif('Harga wajib diisi dan harus lebih dari 0', 'warning');
			return;
		}
		try {
			await ekstraCrud.save({ nama: ekstraForm.nama, harga }, editEkstraId);
			await fetchEkstra();
			showEkstraForm = false;
			ekstraForm.nama = '';
			ekstraForm.harga = '';
			editEkstraId = null;
		} catch (error) {
			deps.showNotif(
				'Gagal menyimpan ekstra: ' + ErrorHandler.extractErrorMessage(error),
				'error'
			);
		}
		await deps.afterUpdate();
	}

	function confirmDeleteEkstra(id: string | number) {
		ekstraIdToDelete = id;
		showDeleteEkstraModal = true;
	}

	async function doDeleteEkstra() {
		if (ekstraIdToDelete !== null) {
			await ekstraCrud.remove(ekstraIdToDelete);
			showDeleteEkstraModal = false;
			ekstraIdToDelete = null;
			await fetchEkstra();
			await deps.afterUpdate();
		}
	}

	function cancelDeleteEkstra() {
		showDeleteEkstraModal = false;
		ekstraIdToDelete = null;
	}

	return {
		get ekstraList() {
			return ekstraList;
		},
		get ekstraForm() {
			return ekstraForm;
		},
		set ekstraForm(v) {
			ekstraForm = v;
		},
		get showEkstraForm() {
			return showEkstraForm;
		},
		get editEkstraId() {
			return editEkstraId;
		},
		get showDeleteEkstraModal() {
			return showDeleteEkstraModal;
		},
		get searchEkstra() {
			return searchEkstra;
		},
		set searchEkstra(v) {
			searchEkstra = v;
		},
		get isLoadingEkstra() {
			return isLoadingEkstra;
		},
		fetchEkstra,
		openEkstraForm,
		closeEkstraForm,
		saveEkstra,
		confirmDeleteEkstra,
		doDeleteEkstra,
		cancelDeleteEkstra
	};
}
