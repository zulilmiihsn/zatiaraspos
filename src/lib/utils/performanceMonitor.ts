import { performanceTracker, performanceUtils as trackerUtils } from '$lib/utils/performanceTracker';

/**
 * @deprecated Use `performanceTracker` from `$lib/utils/performanceTracker`.
 * Compatibility shim kept to avoid breaking old imports.
 */
export const performanceMonitor = {
	startMonitoring: (intervalMs: number = 5000): void => {
		performanceTracker.startMonitoring(intervalMs);
	},
	stopMonitoring: (): void => {
		performanceTracker.stopMonitoring();
	},
	collectMetrics: () => {
		performanceTracker.collectCurrentMetrics();
		return performanceTracker.getCurrentMetrics();
	},
	getCurrentMetrics: () => performanceTracker.getCurrentMetrics(),
	getMetricsHistory: () => performanceTracker.getAllMetrics(),
	measureSync: <T>(_name: string, fn: () => T): T => fn(),
	measureExecution: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn()
};

/**
 * @deprecated Use `performanceUtils` from `$lib/utils/performanceTracker`.
 */
export const performanceUtils = {
	quickCheck: trackerUtils.quickCheck,
	startDefaultMonitoring: trackerUtils.startDefaultMonitoring,
	measureComponent: trackerUtils.measureComponent
};
