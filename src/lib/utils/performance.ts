// Performance utilities
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Memoization untuk expensive calculations
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map();
  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Performance measurement
export function measurePerformance(name: string, fn: () => void) {
  const start = performance.now();
  fn();
  const end = performance.now();
}

export async function measureAsyncPerformance(name: string, fn: () => Promise<void>) {
  const start = performance.now();
  await fn();
  const end = performance.now();
}

// Cart calculations dengan memoization
export const calculateCartTotal = memoize((cart: any[]) => {
  let items = 0;
  let total = 0;
  for (const item of cart) {
    const itemTotal = (item.product?.price ?? item.product?.harga ?? 0) * (item.qty ?? 1);
    const addOnsTotal = (item.addOns || []).reduce((sum: number, addon: any) => sum + (addon.price ?? addon.harga ?? 0), 0) * (item.qty ?? 1);
    total += itemTotal + addOnsTotal;
    items += item.qty ?? 1;
  }
  return { items, total };
});

// Fuzzy search dengan hasil lebih relevan
export function fuzzySearch(query: string, items: any[], key: string = 'name'): any[] {
  if (!query.trim()) return items;
  const searchTerm = query.toLowerCase();
  // Cari di name dan kategori (jika ada)
  return items
    .map(item => {
      const name = String(item[key] ?? '').toLowerCase();
      const kategori = String(item.kategori ?? '').toLowerCase();
      let score = 0;
      if (name.startsWith(searchTerm)) score = 3;
      else if (name.includes(searchTerm)) score = 2;
      else if (kategori && kategori.includes(searchTerm)) score = 1;
      return { item, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

// Image optimization
export function createImageObserver(callback: (entry: IntersectionObserverEntry) => void) {
  return new IntersectionObserver((entries) => {
    entries.forEach(callback);
  }, {
    rootMargin: '50px',
    threshold: 0.1
  });
}

// Cache management
export class CacheManager {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttl: number = 60000) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  clear() {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

// Bundle size analyzer
export function analyzeBundleSize() {
  if (typeof window !== 'undefined') {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const totalSize = resources.reduce((sum, resource) => {
      return sum + (resource.transferSize || 0);
    }, 0);
    
  }
} 