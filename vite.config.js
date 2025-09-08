import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
	plugins: [
		sveltekit(),
		// Bundle analyzer
		visualizer({
			filename: 'dist/stats.html',
			open: false,
			gzipSize: true,
			brotliSize: true
		})
	],
	build: {
		// Optimize bundle size
		target: 'es2020',
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				pure_funcs: ['console.log', 'console.info', 'console.debug']
			},
			mangle: {
				safari10: true
			}
		},
		rollupOptions: {
			output: {
				// Manual chunk splitting for better caching
				manualChunks: (id) => {
					// Vendor chunks
					if (id.includes('node_modules')) {
						if (id.includes('svelte') || id.includes('@sveltejs')) {
							return 'vendor-svelte';
						}
						if (id.includes('lucide-svelte') || id.includes('@lottiefiles')) {
							return 'vendor-ui';
						}
						if (id.includes('uuid') || id.includes('bcryptjs') || id.includes('pako') || id.includes('js-base64')) {
							return 'vendor-utils';
						}
						if (id.includes('idb-keyval')) {
							return 'vendor-cache';
						}
						return 'vendor';
					}
					
					// Feature chunks
					if (id.includes('src/lib/services/ai') || id.includes('aiChatModal')) {
						return 'feature-ai';
					}
					if (id.includes('src/routes/pos') || id.includes('src/lib/components/pos')) {
						return 'feature-pos';
					}
					if (id.includes('src/routes/laporan') || id.includes('src/lib/components/reports')) {
						return 'feature-reports';
					}
					if (id.includes('src/routes/pengaturan') || id.includes('src/lib/components/settings')) {
						return 'feature-settings';
					}
				},
				// Optimize chunk names
				chunkFileNames: (chunkInfo) => {
					const facadeModuleId = chunkInfo.facadeModuleId
						? chunkInfo.facadeModuleId.split('/').pop().replace('.svelte', '').replace('.ts', '')
						: 'chunk';
					return `js/${facadeModuleId}-[hash].js`;
				},
				entryFileNames: 'js/[name]-[hash].js',
				assetFileNames: (assetInfo) => {
					const extType = assetInfo.name.split('.').pop();
					if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
						return `images/[name]-[hash][extname]`;
					}
					if (/woff2?|eot|ttf|otf/i.test(extType)) {
						return `fonts/[name]-[hash][extname]`;
					}
					return `assets/[name]-[hash][extname]`;
				}
			},
			// External dependencies that shouldn't be bundled
			external: (id) => {
				// Don't bundle large dependencies that are better served from CDN
				return false; // Keep everything bundled for offline capability
			}
		},
		// Optimize chunk size
		chunkSizeWarningLimit: 1000,
		// Source maps for production debugging
		sourcemap: false
	},
	// Optimize dependencies
	optimizeDeps: {
		include: [
			'svelte',
			'@sveltejs/kit',
			'@supabase/supabase-js',
			'lucide-svelte',
			'uuid',
			'bcryptjs',
			'pako',
			'js-base64',
			'idb-keyval'
		],
		exclude: [
			'@lottiefiles/dotlottie-svelte' // Large animation library
		]
	},
	// Server configuration
	server: {
		fs: {
			allow: ['..']
		}
	},
	// Preview configuration
	preview: {
		port: 4173,
		strictPort: true
	}
});
