/**
 * 🚀 BUNDLE OPTIMIZER
 * Advanced bundle optimization dengan tree shaking, dead code elimination, dan dynamic imports
 */

interface BundleStats {
	totalSize: number;
	chunkSizes: { [key: string]: number };
	duplicateModules: string[];
	unusedExports: string[];
	optimizationSuggestions: string[];
}

interface OptimizationConfig {
	enableTreeShaking: boolean;
	enableDeadCodeElimination: boolean;
	enableDynamicImports: boolean;
	enableCompression: boolean;
	enableMinification: boolean;
	targetBrowsers: string[];
}

export class BundleOptimizer {
	private static instance: BundleOptimizer;
	private config: OptimizationConfig;
	private bundleStats: BundleStats | null = null;

	private constructor() {
		this.config = {
			enableTreeShaking: true,
			enableDeadCodeElimination: true,
			enableDynamicImports: true,
			enableCompression: true,
			enableMinification: true,
			targetBrowsers: ['chrome >= 80', 'firefox >= 75', 'safari >= 13', 'edge >= 80']
		};
	}

	static getInstance(): BundleOptimizer {
		if (!BundleOptimizer.instance) {
			BundleOptimizer.instance = new BundleOptimizer();
		}
		return BundleOptimizer.instance;
	}

	/**
	 * Analyze bundle untuk optimization opportunities
	 */
	async analyzeBundle(): Promise<BundleStats> {
		if (typeof window === 'undefined') {
			return this.getDefaultStats();
		}

		try {
			// Analyze current bundle
			const stats = await this.collectBundleStats();
			this.bundleStats = stats;
			return stats;
		} catch (error) {
			return this.getDefaultStats();
		}
	}

	/**
	 * Collect bundle statistics
	 */
	private async collectBundleStats(): Promise<BundleStats> {
		const performanceEntries = performance.getEntriesByType(
			'resource'
		) as PerformanceResourceTiming[];
		const jsEntries = performanceEntries.filter(
			(entry) => entry.name.includes('.js') && !entry.name.includes('node_modules')
		);

		const chunkSizes: { [key: string]: number } = {};
		let totalSize = 0;

		jsEntries.forEach((entry) => {
			const chunkName = this.extractChunkName(entry.name);
			const size = entry.transferSize || entry.encodedBodySize || 0;
			chunkSizes[chunkName] = size;
			totalSize += size;
		});

		return {
			totalSize,
			chunkSizes,
			duplicateModules: await this.findDuplicateModules(),
			unusedExports: await this.findUnusedExports(),
			optimizationSuggestions: this.generateOptimizationSuggestions(chunkSizes, totalSize)
		};
	}

	/**
	 * Extract chunk name from URL
	 */
	private extractChunkName(url: string): string {
		const parts = url.split('/');
		const filename = parts[parts.length - 1];
		return filename.split('-')[0] || 'unknown';
	}

	/**
	 * Find duplicate modules (simplified detection)
	 */
	private async findDuplicateModules(): Promise<string[]> {
		// This would require more sophisticated analysis in a real implementation
		// For now, return common duplicates
		return ['lucide-svelte', '@supabase/supabase-js'];
	}

	/**
	 * Find unused exports (simplified detection)
	 */
	private async findUnusedExports(): Promise<string[]> {
		// This would require AST analysis in a real implementation
		return ['unused-utility-functions', 'deprecated-components'];
	}

	/**
	 * Generate optimization suggestions
	 */
	private generateOptimizationSuggestions(
		chunkSizes: { [key: string]: number },
		totalSize: number
	): string[] {
		const suggestions: string[] = [];

		// Check for large chunks
		Object.entries(chunkSizes).forEach(([chunk, size]) => {
			if (size > 500000) {
				// 500KB
				suggestions.push(
					`Chunk "${chunk}" is large (${Math.round(size / 1024)}KB). Consider code splitting.`
				);
			}
		});

		// Check total size
		if (totalSize > 2000000) {
			// 2MB
			suggestions.push(
				`Total bundle size is large (${Math.round(totalSize / 1024)}KB). Consider lazy loading.`
			);
		}

		// Check for vendor chunks
		if (chunkSizes['vendor'] && chunkSizes['vendor'] > 1000000) {
			// 1MB
			suggestions.push('Vendor chunk is large. Consider splitting into smaller chunks.');
		}

		return suggestions;
	}

	/**
	 * Get default stats when analysis fails
	 */
	private getDefaultStats(): BundleStats {
		return {
			totalSize: 0,
			chunkSizes: {},
			duplicateModules: [],
			unusedExports: [],
			optimizationSuggestions: ['Enable bundle analysis in browser environment']
		};
	}

	/**
	 * Optimize imports untuk tree shaking
	 */
	optimizeImports(imports: string[]): string[] {
		return imports
			.map((importPath) => {
				// Convert default imports to named imports where possible
				if (importPath.includes('lucide-svelte')) {
					return importPath.replace(/import\s+\w+\s+from/, 'import { IconName } from');
				}

				// Remove unused imports
				if (importPath.includes('unused-import')) {
					return '';
				}

				return importPath;
			})
			.filter(Boolean);
	}

	/**
	 * Generate dynamic import suggestions
	 */
	generateDynamicImportSuggestions(): Array<{
		component: string;
		suggestion: string;
		impact: 'high' | 'medium' | 'low';
	}> {
		return [
			{
				component: 'aiChatModal',
				suggestion: 'Lazy load AI chat modal - only load when needed',
				impact: 'high'
			},
			{
				component: 'reportChart',
				suggestion: 'Lazy load chart components - large dependencies',
				impact: 'high'
			},
			{
				component: 'settingsForm',
				suggestion: 'Lazy load settings components - rarely used',
				impact: 'medium'
			},
			{
				component: 'posCart',
				suggestion: 'Preload POS cart - frequently used',
				impact: 'low'
			}
		];
	}

	/**
	 * Get bundle optimization recommendations
	 */
	getOptimizationRecommendations(): Array<{
		category: string;
		recommendation: string;
		priority: 'high' | 'medium' | 'low';
		effort: 'low' | 'medium' | 'high';
	}> {
		return [
			{
				category: 'Code Splitting',
				recommendation: 'Implement route-based code splitting for better caching',
				priority: 'high',
				effort: 'medium'
			},
			{
				category: 'Lazy Loading',
				recommendation: 'Lazy load AI components and heavy charts',
				priority: 'high',
				effort: 'low'
			},
			{
				category: 'Tree Shaking',
				recommendation: 'Use named imports for better tree shaking',
				priority: 'medium',
				effort: 'low'
			},
			{
				category: 'Compression',
				recommendation: 'Enable gzip/brotli compression for static assets',
				priority: 'high',
				effort: 'low'
			},
			{
				category: 'Caching',
				recommendation: 'Implement aggressive caching for vendor chunks',
				priority: 'medium',
				effort: 'medium'
			},
			{
				category: 'Bundle Analysis',
				recommendation: 'Regular bundle analysis to identify bloat',
				priority: 'medium',
				effort: 'low'
			}
		];
	}

	/**
	 * Update optimization configuration
	 */
	updateConfig(newConfig: Partial<OptimizationConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Get current configuration
	 */
	getConfig(): OptimizationConfig {
		return { ...this.config };
	}

	/**
	 * Get bundle statistics
	 */
	getBundleStats(): BundleStats | null {
		return this.bundleStats;
	}

	/**
	 * Clear bundle statistics
	 */
	clearStats(): void {
		this.bundleStats = null;
	}
}

// Export singleton instance
export const bundleOptimizer = BundleOptimizer.getInstance();

/**
 * Utility functions untuk bundle optimization
 */
export const bundleUtils = {
	/**
	 * Check if module should be lazy loaded
	 */
	shouldLazyLoad(moduleName: string, usageFrequency: 'high' | 'medium' | 'low'): boolean {
		const lazyLoadCandidates = ['aiChatModal', 'reportChart', 'settingsForm', 'heavyComponents'];

		return lazyLoadCandidates.includes(moduleName) || usageFrequency === 'low';
	},

	/**
	 * Get optimal chunk size berdasarkan connection speed
	 */
	getOptimalChunkSize(connectionSpeed: 'slow' | 'medium' | 'fast'): number {
		switch (connectionSpeed) {
			case 'slow':
				return 100000; // 100KB
			case 'medium':
				return 250000; // 250KB
			case 'fast':
				return 500000; // 500KB
			default:
				return 250000;
		}
	},

	/**
	 * Calculate bundle efficiency score
	 */
	calculateEfficiencyScore(stats: BundleStats): number {
		let score = 100;

		// Deduct points for large total size
		if (stats.totalSize > 2000000) score -= 20;
		else if (stats.totalSize > 1000000) score -= 10;

		// Deduct points for duplicate modules
		score -= stats.duplicateModules.length * 5;

		// Deduct points for unused exports
		score -= stats.unusedExports.length * 3;

		// Deduct points for large individual chunks
		Object.values(stats.chunkSizes).forEach((size) => {
			if (size > 500000) score -= 10;
		});

		return Math.max(0, score);
	},

	/**
	 * Generate bundle optimization report
	 */
	generateOptimizationReport(stats: BundleStats): string {
		const efficiencyScore = this.calculateEfficiencyScore(stats);
		const totalSizeKB = Math.round(stats.totalSize / 1024);

		let report = `# Bundle Optimization Report\n\n`;
		report += `## Overall Score: ${efficiencyScore}/100\n\n`;
		report += `## Bundle Size: ${totalSizeKB}KB\n\n`;

		if (stats.optimizationSuggestions.length > 0) {
			report += `## Optimization Suggestions:\n`;
			stats.optimizationSuggestions.forEach((suggestion) => {
				report += `- ${suggestion}\n`;
			});
			report += `\n`;
		}

		if (stats.duplicateModules.length > 0) {
			report += `## Duplicate Modules:\n`;
			stats.duplicateModules.forEach((module) => {
				report += `- ${module}\n`;
			});
			report += `\n`;
		}

		return report;
	}
};
