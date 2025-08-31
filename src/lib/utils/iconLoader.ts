/**
 * Optimized icon loading utility with lazy loading and caching
 * Reduces initial bundle size by loading icons on-demand
 */

interface IconCache {
  [key: string]: Promise<any>;
}

class IconLoader {
  private static instance: IconLoader;
  private cache: IconCache = {};
  private loadedIcons: Set<string> = new Set();

  private constructor() {}

  static getInstance(): IconLoader {
    if (!IconLoader.instance) {
      IconLoader.instance = new IconLoader();
    }
    return IconLoader.instance;
  }

  /**
   * Load icon dynamically with caching
   */
  async loadIcon(iconName: string): Promise<any> {
    // Check if already loaded
    if (this.loadedIcons.has(iconName)) {
      return this.cache[iconName];
    }

    // Check cache first
    const cachedIcon = this.cache[iconName];
    if (cachedIcon && this.loadedIcons.has(iconName) && !(cachedIcon instanceof Promise)) {
      return cachedIcon;
    }

    try {
      // Dynamic import with caching
      const iconPromise = import(`lucide-svelte/icons/${iconName}`).then(module => module.default);
      this.cache[iconName] = iconPromise;
      
      // Mark as loaded when resolved
      iconPromise.then(() => {
        this.loadedIcons.add(iconName);
      }).catch(() => {
        // Remove from cache if loading fails
        delete this.cache[iconName];
      });

      return iconPromise;
    } catch (error) {
      console.warn(`Failed to load icon: ${iconName}`, error);
      throw error;
    }
  }

  /**
   * Preload multiple icons
   */
  async preloadIcons(iconNames: string[]): Promise<void> {
    const promises = iconNames.map(name => 
      this.loadIcon(name).catch(() => null)
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Get loaded icons count
   */
  getLoadedCount(): number {
    return this.loadedIcons.size;
  }

  /**
   * Get cached icons count
   */
  getCachedCount(): number {
    return Object.keys(this.cache).length;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = {};
    this.loadedIcons.clear();
  }
}

// Export singleton instance
export const iconLoader = IconLoader.getInstance();

// Route-specific icon mappings for better code splitting
export const ROUTE_ICONS = {
  dashboard: ['home', 'trending-up', 'users', 'dollar-sign'],
  pos: ['shopping-cart', 'credit-card', 'receipt', 'calculator'],
  laporan: ['bar-chart-3', 'pie-chart', 'file-text', 'download'],
  catat: ['edit-3', 'plus-circle', 'minus-circle', 'save'],
  pengaturan: ['settings', 'user', 'shield', 'printer']
};

/**
 * Load icons for specific route
 */
export async function loadRouteIcons(routeName: keyof typeof ROUTE_ICONS): Promise<void> {
  const icons = ROUTE_ICONS[routeName] || [];
  await iconLoader.preloadIcons(icons);
}
