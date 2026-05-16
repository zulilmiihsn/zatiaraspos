export const NAV_ITEMS = [
	{ name: 'Beranda', path: '/' },
	{ name: 'POS', path: '/pos' },
	{ name: 'Catat', path: '/catat' },
	{ name: 'Laporan', path: '/laporan' },
	{ name: 'Pengaturan', path: '/pengaturan' }
];

export function getNavIndex(path: string): number {
	// Exact match first
	const exactIndex = NAV_ITEMS.findIndex((nav) => nav.path === path);
	if (exactIndex !== -1) return exactIndex;

	// For sub-routes (e.g. /pos/bayar, /pengaturan/riwayat)
	// We want to find the longest matching path
	let bestIndex = -1;
	let longestMatch = 0;

	for (let i = 0; i < NAV_ITEMS.length; i++) {
		const navPath = NAV_ITEMS[i].path;
		if (path.startsWith(navPath) && navPath.length > longestMatch) {
			// Ignore root match '/' if we are on another route,
			// actually, root is length 1, so if something else matches, it will be longer.
			bestIndex = i;
			longestMatch = navPath.length;
		}
	}

	// If no match but we are at root, return 0.
	if (bestIndex === -1 && path === '/') return 0;

	return bestIndex !== -1 ? bestIndex : 0;
}
