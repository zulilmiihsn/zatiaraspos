/**
 * Performance monitoring utility for tracking bundle size, memory usage, and rendering performance
 * Provides insights for optimization and debugging
 */

interface PerformanceMetrics {
	bundleSize: number;
	memoryUsage: number;
	renderTime: number;
	cacheHitRate: number;
	loadTime: number;
	timestamp: number;
}

interface PerformanceThresholds {
	bundleSizeWarning: number; // MB
	memoryUsageWarning: number; // MB
	renderTimeWarning: number; // ms
	cacheHitRateWarning: number; // percentage
}

class PerformanceMonitor {
	private static instance: PerformanceMonitor;
	private metrics: PerformanceMetrics[] = [];
	private thresholds: PerformanceThresholds = {
		bundleSizeWarning: 2, // 2MB
		memoryUsageWarning: 100, // 100MB
		renderTimeWarning: 100, // 100ms
		cacheHitRateWarning: 70 // 70%
	};
	private observers: Set<(metrics: PerformanceMetrics) => void> = new Set();
	private isMonitoring = false;
	private monitoringInterval?: NodeJS.Timeout;

	private constructor() {}

	static getInstance(): PerformanceMonitor {
		if (!PerformanceMonitor.instance) {
			PerformanceMonitor.instance = new PerformanceMonitor();
		}
		return PerformanceMonitor.instance;
	}

	/**
	 * Start performance monitoring
	 */
	startMonitoring(intervalMs: number = 5000): void {
		if (this.isMonitoring) return;

		this.isMonitoring = true;
		this.monitoringInterval = setInterval(() => {
			this.collectMetrics();
		}, intervalMs);

		// Initial collection
		this.collectMetrics();
	}

	/**
	 * Stop performance monitoring
	 */
	stopMonitoring(): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = undefined;
		}
		this.isMonitoring = false;
	}

	/**
	 * Collect current performance metrics
	 */
	collectMetrics(): PerformanceMetrics {
		const metrics: PerformanceMetrics = {
			bundleSize: this.getBundleSize(),
			memoryUsage: this.getMemoryUsage(),
			renderTime: this.getRenderTime(),
			cacheHitRate: this.getCacheHitRate(),
			loadTime: this.getLoadTime(),
			timestamp: Date.now()
		};

		this.metrics.push(metrics);

		// Keep only last 100 metrics
		if (this.metrics.length > 100) {
			this.metrics.shift();
		}

		// Check thresholds and notify observers
		this.checkThresholds(metrics);
		this.notifyObservers(metrics);

		return metrics;
	}

	/**
	 * Get current metrics
	 */
	getCurrentMetrics(): PerformanceMetrics | null {
		return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
	}

	/**
	 * Get metrics history
	 */
	getMetricsHistory(): PerformanceMetrics[] {
		return [...this.metrics];
	}

	/**
	 * Get performance trends
	 */
	getPerformanceTrends(): {
		bundleSize: { trend: 'improving' | 'stable' | 'degrading'; change: number };
		memoryUsage: { trend: 'improving' | 'stable' | 'degrading'; change: number };
		renderTime: { trend: 'improving' | 'stable' | 'degrading'; change: number };
	} {
		if (this.metrics.length < 2) {
			return {
				bundleSize: { trend: 'stable', change: 0 },
				memoryUsage: { trend: 'stable', change: 0 },
				renderTime: { trend: 'stable', change: 0 }
			};
		}

		const recent = this.metrics.slice(-5);
		const older = this.metrics.slice(-10, -5);

		const getTrend = (key: keyof PerformanceMetrics) => {
			const recentAvg = recent.reduce((sum, m) => sum + (m[key] as number), 0) / recent.length;
			const olderAvg = older.reduce((sum, m) => sum + (m[key] as number), 0) / older.length;
			const change = ((recentAvg - olderAvg) / olderAvg) * 100;

			if (change < -5) return { trend: 'improving' as const, change };
			if (change > 5) return { trend: 'degrading' as const, change };
			return { trend: 'stable' as const, change };
		};

		return {
			bundleSize: getTrend('bundleSize'),
			memoryUsage: getTrend('memoryUsage'),
			renderTime: getTrend('renderTime')
		};
	}

	/**
	 * Set performance thresholds
	 */
	setThresholds(thresholds: Partial<PerformanceThresholds>): void {
		this.thresholds = { ...this.thresholds, ...thresholds };
	}

	/**
	 * Subscribe to performance updates
	 */
	subscribe(callback: (metrics: PerformanceMetrics) => void): () => void {
		this.observers.add(callback);

		// Return unsubscribe function
		return () => {
			this.observers.delete(callback);
		};
	}

	/**
	 * Measure function execution time
	 */
	async measureExecution<T>(name: string, fn: () => Promise<T>): Promise<T> {
		const start = performance.now();
		try {
			const result = await fn();
			const duration = performance.now() - start;

			// Performance monitoring disabled for production

			return result;
		} catch (error) {
			const duration = performance.now() - start;
			throw error;
		}
	}

	/**
	 * Measure synchronous function execution time
	 */
	measureSync<T>(name: string, fn: () => T): T {
		const start = performance.now();
		try {
			const result = fn();
			const duration = performance.now() - start;

			// Performance monitoring disabled for production

			return result;
		} catch (error) {
			const duration = performance.now() - start;
			throw error;
		}
	}

	/**
	 * Generate performance report
	 */
	generateReport(): string {
		const current = this.getCurrentMetrics();
		if (!current) return 'No performance data available';

		const trends = this.getPerformanceTrends();

		return `
📊 Performance Report - ${new Date(current.timestamp).toLocaleString()}

📦 Bundle Size: ${(current.bundleSize / 1024 / 1024).toFixed(2)} MB ${trends.bundleSize.trend === 'improving' ? '✅' : trends.bundleSize.trend === 'degrading' ? '⚠️' : '➡️'}
🧠 Memory Usage: ${(current.memoryUsage / 1024 / 1024).toFixed(2)} MB ${trends.memoryUsage.trend === 'improving' ? '✅' : trends.memoryUsage.trend === 'degrading' ? '⚠️' : '➡️'}
⚡ Render Time: ${current.renderTime.toFixed(2)} ms ${trends.renderTime.trend === 'improving' ? '✅' : trends.renderTime.trend === 'degrading' ? '⚠️' : '➡️'}
🎯 Cache Hit Rate: ${(current.cacheHitRate * 100).toFixed(1)}%
⏱️ Load Time: ${current.loadTime.toFixed(2)} ms

📈 Trends:
- Bundle Size: ${trends.bundleSize.change > 0 ? '+' : ''}${trends.bundleSize.change.toFixed(1)}%
- Memory Usage: ${trends.memoryUsage.change > 0 ? '+' : ''}${trends.memoryUsage.change.toFixed(1)}%
- Render Time: ${trends.renderTime.change > 0 ? '+' : ''}${trends.renderTime.change.toFixed(1)}%
    `.trim();
	}

	private getBundleSize(): number {
		// Estimate bundle size based on loaded modules
		if (typeof window !== 'undefined' && window.performance) {
			const navigation = performance.getEntriesByType(
				'navigation'
			)[0] as PerformanceNavigationTiming;
			if (navigation) {
				return navigation.transferSize || 0;
			}
		}
		return 0;
	}

	private getMemoryUsage(): number {
		if (typeof window !== 'undefined' && (performance as any).memory) {
			return (performance as any).memory.usedJSHeapSize || 0;
		}
		return 0;
	}

	private getRenderTime(): number {
		// Measure time since last render
		const now = performance.now();
		const lastRender =
			this.metrics.length > 0 ? this.metrics[this.metrics.length - 1].timestamp : now;
		return now - lastRender;
	}

	private getCacheHitRate(): number {
		// This would integrate with the cache manager
		return 0.85; // Placeholder
	}

	private getLoadTime(): number {
		if (typeof window !== 'undefined' && window.performance) {
			const navigation = performance.getEntriesByType(
				'navigation'
			)[0] as PerformanceNavigationTiming;
			if (navigation) {
				return navigation.loadEventEnd - navigation.loadEventStart;
			}
		}
		return 0;
	}

	private checkThresholds(metrics: PerformanceMetrics): void {
		const warnings = [];

		if (metrics.bundleSize > this.thresholds.bundleSizeWarning * 1024 * 1024) {
			warnings.push(
				`Bundle size (${(metrics.bundleSize / 1024 / 1024).toFixed(2)}MB) exceeds warning threshold`
			);
		}

		if (metrics.memoryUsage > this.thresholds.memoryUsageWarning * 1024 * 1024) {
			warnings.push(
				`Memory usage (${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB) exceeds warning threshold`
			);
		}

		if (metrics.renderTime > this.thresholds.renderTimeWarning) {
			warnings.push(`Render time (${metrics.renderTime.toFixed(2)}ms) exceeds warning threshold`);
		}

		if (metrics.cacheHitRate < this.thresholds.cacheHitRateWarning / 100) {
			warnings.push(
				`Cache hit rate (${(metrics.cacheHitRate * 100).toFixed(1)}%) below warning threshold`
			);
		}

		// Performance warnings disabled for production
	}

	private notifyObservers(metrics: PerformanceMetrics): void {
		this.observers.forEach((callback) => {
			try {
				callback(metrics);
			} catch (error) {
				// Silent error handling
			}
		});
	}
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Utility functions for common performance operations
export const performanceUtils = {
	/**
	 * Quick performance check
	 */
	quickCheck: (): void => {
		const metrics = performanceMonitor.getCurrentMetrics();
		// Performance reporting disabled for production
	},

	/**
	 * Start monitoring with default settings
	 */
	startDefaultMonitoring: (): void => {
		performanceMonitor.startMonitoring(10000); // Every 10 seconds
	},

	/**
	 * Measure component render time
	 */
	measureComponent: <T>(componentName: string, renderFn: () => T): T => {
		return performanceMonitor.measureSync(`Component: ${componentName}`, renderFn);
	}
};
