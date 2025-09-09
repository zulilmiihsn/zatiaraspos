/**
 * 🚀 PERFORMANCE TRACKER
 * Comprehensive performance monitoring dengan real-time metrics dan analytics
 */

interface PerformanceMetrics {
	timestamp: number;
	pageLoad: {
		domContentLoaded: number;
		loadComplete: number;
		firstPaint: number;
		firstContentfulPaint: number;
		largestContentfulPaint: number;
		firstInputDelay: number;
		cumulativeLayoutShift: number;
	};
	navigation: {
		type: string;
		redirectCount: number;
		transferSize: number;
		encodedBodySize: number;
		decodedBodySize: number;
	};
	resources: {
		totalRequests: number;
		totalSize: number;
		averageResponseTime: number;
		slowestResource: string;
	};
	memory: {
		usedJSHeapSize: number;
		totalJSHeapSize: number;
		jsHeapSizeLimit: number;
	};
	custom: {
		[key: string]: number;
	};
}

interface PerformanceThresholds {
	pageLoad: {
		domContentLoaded: number; // ms
		loadComplete: number; // ms
		firstPaint: number; // ms
		firstContentfulPaint: number; // ms
		largestContentfulPaint: number; // ms
		firstInputDelay: number; // ms
		cumulativeLayoutShift: number; // score
	};
	resources: {
		maxTotalSize: number; // bytes
		maxAverageResponseTime: number; // ms
		maxSlowestResource: number; // ms
	};
	memory: {
		maxUsedJSHeapSize: number; // bytes
		maxMemoryUsage: number; // percentage
	};
}

interface PerformanceAlert {
	id: string;
	type: 'warning' | 'error' | 'info';
	metric: string;
	value: number;
	threshold: number;
	message: string;
	timestamp: number;
}

export class PerformanceTracker {
	private static instance: PerformanceTracker;
	private metrics: PerformanceMetrics[] = [];
	private alerts: PerformanceAlert[] = [];
	private thresholds: PerformanceThresholds;
	private observers: Set<(metrics: PerformanceMetrics) => void> = new Set();
	private alertObservers: Set<(alert: PerformanceAlert) => void> = new Set();
	private isMonitoring = false;
	private monitoringInterval?: NodeJS.Timeout;
	private customMetrics = new Map<string, number[]>();
	private paintMetrics?: PerformancePaintTiming;
	private lcpMetrics?: PerformanceEntry;
	private fidMetrics?: PerformanceEventTiming;
	private clsMetrics?: PerformanceEntry;

	private constructor() {
		this.thresholds = {
			pageLoad: {
				domContentLoaded: 2000,
				loadComplete: 3000,
				firstPaint: 1500,
				firstContentfulPaint: 2000,
				largestContentfulPaint: 2500,
				firstInputDelay: 100,
				cumulativeLayoutShift: 0.1
			},
			resources: {
				maxTotalSize: 2000000, // 2MB
				maxAverageResponseTime: 1000,
				maxSlowestResource: 3000
			},
			memory: {
				maxUsedJSHeapSize: 50000000, // 50MB
				maxMemoryUsage: 80 // 80%
			}
		};

		this.initializePerformanceObserver();
	}

	static getInstance(): PerformanceTracker {
		if (!PerformanceTracker.instance) {
			PerformanceTracker.instance = new PerformanceTracker();
		}
		return PerformanceTracker.instance;
	}

	/**
	 * Initialize Performance Observer untuk automatic monitoring
	 */
	private initializePerformanceObserver(): void {
		if (typeof window === 'undefined') return;

		try {
			// Observe navigation timing
			if ('PerformanceObserver' in window) {
				const navObserver = new PerformanceObserver((list) => {
					const entries = list.getEntries();
					entries.forEach((entry) => {
						if (entry.entryType === 'navigation') {
							this.collectNavigationMetrics(entry as PerformanceNavigationTiming);
						}
					});
				});
				navObserver.observe({ entryTypes: ['navigation'] });

				// Observe paint timing
				const paintObserver = new PerformanceObserver((list) => {
					const entries = list.getEntries();
					entries.forEach((entry) => {
						if (entry.entryType === 'paint') {
							// Store paint metrics for later use
							this.paintMetrics = entry as PerformancePaintTiming;
						}
					});
				});
				paintObserver.observe({ entryTypes: ['paint'] });

				// Observe largest contentful paint
				const lcpObserver = new PerformanceObserver((list) => {
					const entries = list.getEntries();
					const lastEntry = entries[entries.length - 1];
					this.lcpMetrics = lastEntry as PerformanceEntry;
				});
				lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

				// Observe first input delay
				const fidObserver = new PerformanceObserver((list) => {
					const entries = list.getEntries();
					entries.forEach((entry) => {
						this.fidMetrics = entry as PerformanceEventTiming;
					});
				});
				fidObserver.observe({ entryTypes: ['first-input'] });

				// Observe layout shift
				const clsObserver = new PerformanceObserver((list) => {
					const entries = list.getEntries();
					entries.forEach((entry) => {
						this.clsMetrics = entry as PerformanceEntry;
					});
				});
				clsObserver.observe({ entryTypes: ['layout-shift'] });
			}
		} catch (error) {
			// Silently fail if Performance Observer is not supported
		}
	}

	/**
	 * Start performance monitoring
	 */
	startMonitoring(interval: number = 10000): void {
		if (this.isMonitoring) return;

		this.isMonitoring = true;
		this.monitoringInterval = setInterval(() => {
			this.collectCurrentMetrics();
		}, interval);

		// Collect initial metrics
		this.collectCurrentMetrics();
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
	collectCurrentMetrics(): void {
		if (typeof window === 'undefined') return;

		const metrics: PerformanceMetrics = {
			timestamp: Date.now(),
			pageLoad: this.collectPageLoadMetrics(),
			navigation: this.collectNavigationMetrics(),
			resources: this.collectResourceMetrics(),
			memory: this.collectMemoryMetrics(),
			custom: this.collectCustomMetrics()
		};

		this.metrics.push(metrics);
		this.checkThresholds(metrics);
		this.notifyObservers(metrics);

		// Keep only last 100 metrics
		if (this.metrics.length > 100) {
			this.metrics.shift();
		}
	}

	/**
	 * Collect page load metrics
	 */
	private collectPageLoadMetrics(): PerformanceMetrics['pageLoad'] {
		const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

		if (!navigation) {
			return {
				domContentLoaded: 0,
				loadComplete: 0,
				firstPaint: 0,
				firstContentfulPaint: 0,
				largestContentfulPaint: 0,
				firstInputDelay: 0,
				cumulativeLayoutShift: 0
			};
		}

		return {
			domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
			loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
			firstPaint: this.getFirstPaint(),
			firstContentfulPaint: this.getFirstContentfulPaint(),
			largestContentfulPaint: this.getLargestContentfulPaint(),
			firstInputDelay: this.getFirstInputDelay(),
			cumulativeLayoutShift: this.getCumulativeLayoutShift()
		};
	}

	/**
	 * Collect navigation metrics
	 */
	private collectNavigationMetrics(
		entry?: PerformanceNavigationTiming
	): PerformanceMetrics['navigation'] {
		const navigation =
			entry || (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming);

		if (!navigation) {
			return {
				type: 'unknown',
				redirectCount: 0,
				transferSize: 0,
				encodedBodySize: 0,
				decodedBodySize: 0
			};
		}

		return {
			type: navigation.type,
			redirectCount: navigation.redirectCount,
			transferSize: navigation.transferSize,
			encodedBodySize: navigation.encodedBodySize,
			decodedBodySize: navigation.decodedBodySize
		};
	}

	/**
	 * Collect resource metrics
	 */
	private collectResourceMetrics(): PerformanceMetrics['resources'] {
		const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

		if (resources.length === 0) {
			return {
				totalRequests: 0,
				totalSize: 0,
				averageResponseTime: 0,
				slowestResource: ''
			};
		}

		const totalSize = resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0);
		const totalResponseTime = resources.reduce(
			(sum, resource) => sum + (resource.responseEnd - resource.responseStart),
			0
		);
		const averageResponseTime = totalResponseTime / resources.length;

		const slowestResource = resources.reduce((slowest, resource) => {
			const responseTime = resource.responseEnd - resource.responseStart;
			const slowestTime = slowest.responseEnd - slowest.responseStart;
			return responseTime > slowestTime ? resource : slowest;
		}, resources[0]);

		return {
			totalRequests: resources.length,
			totalSize,
			averageResponseTime,
			slowestResource: slowestResource.name
		};
	}

	/**
	 * Collect memory metrics
	 */
	private collectMemoryMetrics(): PerformanceMetrics['memory'] {
		const memory = (performance as any).memory;

		if (!memory) {
			return {
				usedJSHeapSize: 0,
				totalJSHeapSize: 0,
				jsHeapSizeLimit: 0
			};
		}

		return {
			usedJSHeapSize: memory.usedJSHeapSize,
			totalJSHeapSize: memory.totalJSHeapSize,
			jsHeapSizeLimit: memory.jsHeapSizeLimit
		};
	}

	/**
	 * Collect custom metrics
	 */
	private collectCustomMetrics(): PerformanceMetrics['custom'] {
		const custom: { [key: string]: number } = {};

		this.customMetrics.forEach((values, key) => {
			if (values.length > 0) {
				custom[key] = values.reduce((a, b) => a + b, 0) / values.length;
			}
		});

		return custom;
	}

	/**
	 * Helper methods untuk specific metrics
	 */
	private getFirstPaint(): number {
		const paintEntries = performance.getEntriesByType('paint');
		const fpEntry = paintEntries.find((entry) => entry.name === 'first-paint');
		return fpEntry ? fpEntry.startTime : 0;
	}

	private getFirstContentfulPaint(): number {
		const paintEntries = performance.getEntriesByType('paint');
		const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
		return fcpEntry ? fcpEntry.startTime : 0;
	}

	private getLargestContentfulPaint(): number {
		const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
		const lastEntry = lcpEntries[lcpEntries.length - 1];
		return lastEntry ? lastEntry.startTime : 0;
	}

	private getFirstInputDelay(): number {
		const fidEntries = performance.getEntriesByType('first-input');
		const firstEntry = fidEntries[0];
		return firstEntry ? (firstEntry as any).processingStart - firstEntry.startTime : 0;
	}

	private getCumulativeLayoutShift(): number {
		const clsEntries = performance.getEntriesByType('layout-shift');
		return clsEntries.reduce((sum, entry) => sum + (entry as any).value, 0);
	}

	/**
	 * Check performance thresholds dan generate alerts
	 */
	private checkThresholds(metrics: PerformanceMetrics): void {
		// Check page load thresholds
		Object.entries(this.thresholds.pageLoad).forEach(([key, threshold]) => {
			const value = metrics.pageLoad[key as keyof typeof metrics.pageLoad];
			if (value > threshold) {
				this.createAlert(
					'warning',
					`pageLoad.${key}`,
					value,
					threshold,
					`Page load ${key} is ${value}ms, exceeding threshold of ${threshold}ms`
				);
			}
		});

		// Check resource thresholds
		if (metrics.resources.totalSize > this.thresholds.resources.maxTotalSize) {
			this.createAlert(
				'warning',
				'resources.totalSize',
				metrics.resources.totalSize,
				this.thresholds.resources.maxTotalSize,
				`Total resource size is ${Math.round(metrics.resources.totalSize / 1024)}KB, exceeding threshold`
			);
		}

		if (metrics.resources.averageResponseTime > this.thresholds.resources.maxAverageResponseTime) {
			this.createAlert(
				'warning',
				'resources.averageResponseTime',
				metrics.resources.averageResponseTime,
				this.thresholds.resources.maxAverageResponseTime,
				`Average response time is ${metrics.resources.averageResponseTime}ms, exceeding threshold`
			);
		}

		// Check memory thresholds
		if (metrics.memory.usedJSHeapSize > this.thresholds.memory.maxUsedJSHeapSize) {
			this.createAlert(
				'error',
				'memory.usedJSHeapSize',
				metrics.memory.usedJSHeapSize,
				this.thresholds.memory.maxUsedJSHeapSize,
				`Memory usage is ${Math.round(metrics.memory.usedJSHeapSize / 1024 / 1024)}MB, exceeding threshold`
			);
		}
	}

	/**
	 * Create performance alert
	 */
	private createAlert(
		type: PerformanceAlert['type'],
		metric: string,
		value: number,
		threshold: number,
		message: string
	): void {
		const alert: PerformanceAlert = {
			id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type,
			metric,
			value,
			threshold,
			message,
			timestamp: Date.now()
		};

		this.alerts.push(alert);
		this.notifyAlertObservers(alert);

		// Keep only last 50 alerts
		if (this.alerts.length > 50) {
			this.alerts.shift();
		}
	}

	/**
	 * Record custom metric
	 */
	recordCustomMetric(name: string, value: number): void {
		if (!this.customMetrics.has(name)) {
			this.customMetrics.set(name, []);
		}

		const values = this.customMetrics.get(name)!;
		values.push(value);

		// Keep only last 100 values
		if (values.length > 100) {
			values.shift();
		}
	}

	/**
	 * Start timing untuk custom metric
	 */
	startTiming(name: string): () => void {
		const startTime = performance.now();
		return () => {
			const duration = performance.now() - startTime;
			this.recordCustomMetric(name, duration);
		};
	}

	/**
	 * Get current metrics
	 */
	getCurrentMetrics(): PerformanceMetrics | null {
		return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
	}

	/**
	 * Get all metrics
	 */
	getAllMetrics(): PerformanceMetrics[] {
		return [...this.metrics];
	}

	/**
	 * Get performance alerts
	 */
	getAlerts(): PerformanceAlert[] {
		return [...this.alerts];
	}

	/**
	 * Get performance summary
	 */
	getPerformanceSummary(): {
		averagePageLoad: number;
		averageMemoryUsage: number;
		totalAlerts: number;
		performanceScore: number;
	} {
		if (this.metrics.length === 0) {
			return {
				averagePageLoad: 0,
				averageMemoryUsage: 0,
				totalAlerts: 0,
				performanceScore: 100
			};
		}

		const averagePageLoad =
			this.metrics.reduce((sum, m) => sum + m.pageLoad.loadComplete, 0) / this.metrics.length;
		const averageMemoryUsage =
			this.metrics.reduce((sum, m) => sum + m.memory.usedJSHeapSize, 0) / this.metrics.length;
		const totalAlerts = this.alerts.length;

		// Calculate performance score (0-100)
		let performanceScore = 100;
		if (averagePageLoad > 3000) performanceScore -= 20;
		if (averageMemoryUsage > 50000000) performanceScore -= 20;
		if (totalAlerts > 10) performanceScore -= 20;

		return {
			averagePageLoad,
			averageMemoryUsage,
			totalAlerts,
			performanceScore: Math.max(0, performanceScore)
		};
	}

	/**
	 * Update thresholds
	 */
	updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
		this.thresholds = { ...this.thresholds, ...newThresholds };
	}

	/**
	 * Add metrics observer
	 */
	addMetricsObserver(callback: (metrics: PerformanceMetrics) => void): () => void {
		this.observers.add(callback);
		return () => this.observers.delete(callback);
	}

	/**
	 * Add alert observer
	 */
	addAlertObserver(callback: (alert: PerformanceAlert) => void): () => void {
		this.alertObservers.add(callback);
		return () => this.alertObservers.delete(callback);
	}

	/**
	 * Notify metrics observers
	 */
	private notifyObservers(metrics: PerformanceMetrics): void {
		this.observers.forEach((callback) => {
			try {
				callback(metrics);
			} catch (error) {
				// Silently fail observer callbacks
			}
		});
	}

	/**
	 * Notify alert observers
	 */
	private notifyAlertObservers(alert: PerformanceAlert): void {
		this.alertObservers.forEach((callback) => {
			try {
				callback(alert);
			} catch (error) {
				// Silently fail observer callbacks
			}
		});
	}

	/**
	 * Clear all data
	 */
	clear(): void {
		this.metrics = [];
		this.alerts = [];
		this.customMetrics.clear();
	}
}

// Export singleton instance
export const performanceTracker = PerformanceTracker.getInstance();

// Utility functions
export const performanceUtils = {
	/**
	 * Quick performance check
	 */
	quickCheck: (): void => {
		const metrics = performanceTracker.getCurrentMetrics();
		if (metrics) {
			const summary = performanceTracker.getPerformanceSummary();
			if (summary.performanceScore < 70) {
				console.warn('Performance issues detected:', summary);
			}
		}
	},

	/**
	 * Start monitoring with default settings
	 */
	startDefaultMonitoring: (): void => {
		performanceTracker.startMonitoring(10000); // Every 10 seconds
	},

	/**
	 * Measure component render time
	 */
	measureComponent: <T>(componentName: string, renderFn: () => T): T => {
		const stopTiming = performanceTracker.startTiming(`component_${componentName}`);
		try {
			return renderFn();
		} finally {
			stopTiming();
		}
	},

	/**
	 * Measure async operation
	 */
	measureAsync: async <T>(operationName: string, operation: () => Promise<T>): Promise<T> => {
		const stopTiming = performanceTracker.startTiming(`async_${operationName}`);
		try {
			return await operation();
		} finally {
			stopTiming();
		}
	}
};
