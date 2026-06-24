// Performance utilities
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

export function throttle<T extends (...args: unknown[]) => unknown>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}


// Performance measurement
export async function measureAsyncPerformance(_name: string, fn: () => Promise<void>) {
	const _start = performance.now();
	await fn();
	const _end = performance.now();
}

// Cart calculations (without memoization)
export const calculateCartTotal = (cart: Record<string, unknown>[]) => {
	let items = 0;
	let total = 0;
	for (const item of cart) {
		const itemTotal = (item.product?.harga ?? 0) * (item.jumlah ?? 1);
		const addOnsTotal =
			(item.addOns || []).reduce(
				(sum: number, addon: Record<string, unknown>) => sum + (addon.harga ?? 0),
				0
			) * (item.jumlah ?? 1);
		total += itemTotal + addOnsTotal;
		items += item.jumlah ?? 1;
	}
	return { items, total };
};

// Fuzzy search dengan hasil lebih relevan
export function fuzzySearch(
	query: string,
	items: Record<string, unknown>[],
	key: string = 'nama'
): Record<string, unknown>[] {
	if (!query.trim()) return items;
	const searchTerm = query.toLowerCase();
	// Cari di name dan kategori (jika ada)
	return items
		.map((item) => {
			const name = String(item[key] ?? '').toLowerCase();
			const kategori = String(item.kategori ?? '').toLowerCase();
			let score = 0;
			if (name.startsWith(searchTerm)) score = 3;
			else if (name.includes(searchTerm)) score = 2;
			else if (kategori && kategori.includes(searchTerm)) score = 1;
			return { item, score };
		})
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score)
		.map((x) => x.item);
}

// Image optimization
export function createImageObserver(callback: (entry: IntersectionObserverEntry) => void) {
	return new IntersectionObserver(
		(entries) => {
			entries.forEach(callback);
		},
		{
			rootMargin: '50px',
			threshold: 0.1
		}
	);
}
