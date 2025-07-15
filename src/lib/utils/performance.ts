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
  console.log(`${name} took ${end - start}ms`);
}

export async function measureAsyncPerformance(name: string, fn: () => Promise<void>) {
  const start = performance.now();
  await fn();
  const end = performance.now();
  console.log(`${name} took ${end - start}ms`);
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

// Fuzzy search dengan optimasi
export function fuzzySearch(query: string, items: any[], key: string = 'name'): any[] {
  if (!query.trim()) return items;
  
  const searchTerm = query.toLowerCase();
  return items.filter(item => {
    const text = String(item[key]).toLowerCase();
    return text.includes(searchTerm) || 
           searchTerm.split('').every(char => text.includes(char));
  });
}

// Virtual scrolling utilities
export function createVirtualScroller(
  items: any[],
  itemHeight: number,
  containerHeight: number,
  scrollTop: number,
  overscan: number = 5
) {
  const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount, items.length);
  
  return {
    visibleItems: items.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    totalHeight: items.length * itemHeight,
    offsetY: startIndex * itemHeight
  };
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
    
    console.log(`Total bundle size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    // Log largest resources
    const sortedResources = resources
      .filter(r => r.transferSize > 0)
      .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
      .slice(0, 5);
    
    console.log('Largest resources:', sortedResources.map(r => ({
      name: r.name,
      size: `${((r.transferSize || 0) / 1024).toFixed(2)}KB`
    })));
  }
} 