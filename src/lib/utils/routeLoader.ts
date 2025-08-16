/**
 * Route lazy loading utility for improved initial page load performance
 * Loads route components and data on-demand
 */

interface RouteConfig {
  path: string;
  priority: 'high' | 'medium' | 'low';
  preload: boolean;
  cache: boolean;
}

interface RouteCache {
  [key: string]: {
    component: any;
    data: any;
    timestamp: number;
    ttl: number;
  };
}

class RouteLoader {
  private static instance: RouteLoader;
  private cache: RouteCache = {};
  private loadingRoutes: Set<string> = new Set();
  private routeConfigs: Map<string, RouteConfig> = new Map();

  private constructor() {
    this.initializeRouteConfigs();
  }

  static getInstance(): RouteLoader {
    if (!RouteLoader.instance) {
      RouteLoader.instance = new RouteLoader();
    }
    return RouteLoader.instance;
  }

  /**
   * Initialize route configurations with priorities
   */
  private initializeRouteConfigs(): void {
    const configs: RouteConfig[] = [
      { path: '/', priority: 'high', preload: true, cache: true },
      { path: '/pos', priority: 'high', preload: true, cache: true },
      { path: '/laporan', priority: 'medium', preload: false, cache: true },
      { path: '/catat', priority: 'medium', preload: false, cache: true },
      { path: '/pengaturan', priority: 'low', preload: false, cache: false }
    ];

    configs.forEach(config => {
      this.routeConfigs.set(config.path, config);
    });
  }

  /**
   * Preload high priority routes
   */
  async preloadHighPriorityRoutes(): Promise<void> {
    const highPriorityRoutes = Array.from(this.routeConfigs.values())
      .filter(config => config.priority === 'high' && config.preload);

    const promises = highPriorityRoutes.map(config => 
      this.preloadRoute(config.path).catch(() => null)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Preload specific route
   */
  async preloadRoute(path: string): Promise<void> {
    if (this.loadingRoutes.has(path)) return;

    this.loadingRoutes.add(path);
    
    try {
      // Simulate route preloading (in real app, this would load actual components)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (this.routeConfigs.get(path)?.cache) {
        this.cache[path] = {
          component: null,
          data: null,
          timestamp: Date.now(),
          ttl: 300000 // 5 minutes
        };
      }
    } finally {
      this.loadingRoutes.delete(path);
    }
  }

  /**
   * Get route configuration
   */
  getRouteConfig(path: string): RouteConfig | undefined {
    return this.routeConfigs.get(path);
  }

  /**
   * Get all route configurations
   */
  getRouteConfigs(): Map<string, RouteConfig> {
    return this.routeConfigs;
  }

  /**
   * Check if route is cached
   */
  isRouteCached(path: string): boolean {
    const cached = this.cache[path];
    if (!cached) return false;
    
    return Date.now() - cached.timestamp < cached.ttl;
  }

  /**
   * Get cached route data
   */
  getCachedRoute(path: string): any {
    const cached = this.cache[path];
    if (!cached || !this.isRouteCached(path)) return null;
    
    return cached;
  }

  /**
   * Clear route cache
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Get loading status
   */
  isLoading(path: string): boolean {
    return this.loadingRoutes.has(path);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; routes: string[] } {
    return {
      size: Object.keys(this.cache).length,
      routes: Object.keys(this.cache)
    };
  }
}

// Export singleton instance
export const routeLoader = RouteLoader.getInstance();

// Utility functions for route management
export const routeUtils = {
  /**
   * Preload routes based on user navigation patterns
   */
  preloadUserRoutes: async (currentPath: string): Promise<void> => {
    const config = routeLoader.getRouteConfig(currentPath);
    if (config?.priority === 'high') {
      // Preload related routes
      const relatedPaths = ['/pos', '/laporan'];
      for (const path of relatedPaths) {
        if (path !== currentPath) {
          await routeLoader.preloadRoute(path);
        }
      }
    }
  },

  /**
   * Smart preloading based on user behavior
   */
  smartPreload: async (): Promise<void> => {
    // Preload high priority routes immediately
    await routeLoader.preloadHighPriorityRoutes();
    
    // Preload medium priority routes after a delay
    setTimeout(async () => {
      const mediumRoutes = Array.from(routeLoader.getRouteConfigs?.() || [])
        .filter(([_, config]) => config.priority === 'medium');
      
      for (const [path] of mediumRoutes) {
        await routeLoader.preloadRoute(path);
      }
    }, 2000);
  }
};
