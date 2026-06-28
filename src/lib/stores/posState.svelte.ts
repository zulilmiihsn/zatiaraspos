import { dataService, realtimeManager } from '$lib/services/dataService';
import { reportCacheMetrics } from '$lib/utils/cacheMetrics';
import { throttle, measureAsyncPerformance } from '$lib/utils/performance';
import { selectedBranch } from '$lib/stores/selectedBranch.svelte';
import { browser } from '$app/environment';

export interface PosProduct {
	id: string;
	nama: string;
	harga: number;
	tipe: string;
	image?: string;
	gambar?: string;
	ekstra_ids?: string[];
	kategori_id?: string;
}

export interface PosCategory {
	id: string;
	nama: string;
}

export interface PosAddOn {
	id: string;
	nama: string;
	harga: number;
}

export function createPosState() {
	let produkData = $state<PosProduct[]>([]);
	let kategoriData = $state<PosCategory[]>([]);
	let tambahanData = $state<PosAddOn[]>([]);
	let isLoadingProducts = $state(true);
	let posLoadError = $state('');

	let posRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	let posRefreshInFlight = false;
	let lastPOSPayloadFingerprint = '';
	let isInitialLoad = true;

	async function loadPOSData() {
		try {
			const [nextProducts, nextCategories, nextAddons] = await Promise.all([
				dataService.getProducts(),
				dataService.getCategories(),
				dataService.getAddOns()
			]);

			const nextFingerprint = [
				(nextProducts || []).length,
				(nextProducts || []).map((item) => `${item?.id || ''}:${item?.harga ?? 0}`).join(','),
				(nextCategories || []).length,
				(nextCategories || []).map((item) => item?.id || '').join(','),
				(nextAddons || []).length,
				(nextAddons || []).map((item) => `${item?.id || ''}:${item?.harga ?? 0}`).join(',')
			].join('|');

			if (nextFingerprint === lastPOSPayloadFingerprint) {
				posLoadError = '';
				await reportCacheMetrics('pos');
				return;
			}

			lastPOSPayloadFingerprint = nextFingerprint;
			produkData = (nextProducts as unknown as PosProduct[]) || [];
			kategoriData = (nextCategories as unknown as PosCategory[]) || [];
			tambahanData = (nextAddons as unknown as PosAddOn[]) || [];
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

	function setupRealtimeSubscriptions() {
		realtimeManager.subscribe('produk', async () => {
			schedulePOSRefresh();
		});
		realtimeManager.subscribe('kategori', async () => {
			schedulePOSRefresh();
		});
		realtimeManager.subscribe('tambahan', async () => {
			schedulePOSRefresh();
		});
	}

	$effect(() => {
		let throttledSync: (() => void) | null = null;

		(async () => {
			await loadPOSData();
			setupRealtimeSubscriptions();
			await measureAsyncPerformance('data fetching', async () => Promise.resolve());
			isLoadingProducts = false;

			if (browser) {
				throttledSync = throttle(async () => {
					await loadPOSData();
				}, 1000);
				window.addEventListener('online', throttledSync);
			}
		})();

		return () => {
			realtimeManager.unsubscribeAll();
			if (posRefreshTimer) {
				clearTimeout(posRefreshTimer);
				posRefreshTimer = null;
			}
			if (browser && throttledSync) {
				window.removeEventListener('online', throttledSync);
			}
		};
	});

	$effect(() => {
		const branch = selectedBranch.value;
		if (!isInitialLoad && branch) {
			loadPOSData();
		}
		isInitialLoad = false;
	});

	return {
		get produkData() {
			return produkData;
		},
		get kategoriData() {
			return kategoriData;
		},
		get tambahanData() {
			return tambahanData;
		},
		get isLoadingProducts() {
			return isLoadingProducts;
		},
		get posLoadError() {
			return posLoadError;
		},
		retryLoadPOSData
	};
}
