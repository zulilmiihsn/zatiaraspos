import { build, files, version } from '$service-worker';

// Create a unique cache name for this version
const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself
	...files  // everything in `static`
];

self.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		// Cari semua file nodes/*.js dan tambahkan ke ASSETS
		let nodeFiles: string[] = [];
		try {
			const res = await fetch('/.svelte-kit/generated/client/nodes/manifest.json');
			if (res.ok) {
				nodeFiles = await res.json();
			}
		} catch {}
		const allAssets = [...ASSETS, ...nodeFiles];
		await cache.addAll(allAssets);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	// ignore POST requests etc
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// `build`/`files` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			return cache.match(url.pathname);
		}

		// for everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch {
			const cached = await cache.match(event.request);
			// PATCH: Always return a Response object
			return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
		}
	}

	event.respondWith(respond());
}); 