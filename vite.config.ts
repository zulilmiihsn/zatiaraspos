import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		tailwindcss(), 
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit
				skipWaiting: true,
				clientsClaim: true,
				// Optimasi caching
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							}
						}
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'gstatic-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							}
						}
					}
				]
			},
			manifest: {
				name: 'Zatiaras Juice POS',
				short_name: 'Zatiaras POS',
				description: 'Aplikasi kasir modern untuk bisnis minuman',
				theme_color: '#ec4899',
				background_color: '#ffffff',
				display: 'standalone',
				orientation: 'portrait',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'img/android-chrome-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'img/android-chrome-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'img/android-chrome-maskable-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					},
					{
						src: 'img/android-chrome-maskable-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			}
		})
	],
	build: {
		rollupOptions: {
			output: {
				// Optimasi chunk splitting
				manualChunks: {
					// Vendor chunks
					vendor: ['svelte', '@sveltejs/kit'],
					ui: ['lucide-svelte'],
					utils: ['uuid', 'idb-keyval']
				},
				// Optimasi asset naming
				assetFileNames: (assetInfo) => {
					if (!assetInfo.name) return 'assets/[name]-[hash][extname]';
					const info = assetInfo.name.split('.');
					const ext = info[info.length - 1];
					if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
						return `assets/images/[name]-[hash][extname]`;
					}
					if (/woff2?|eot|ttf|otf/i.test(ext)) {
						return `assets/fonts/[name]-[hash][extname]`;
					}
					return `assets/[name]-[hash][extname]`;
				},
				chunkFileNames: 'assets/js/[name]-[hash].js',
				entryFileNames: 'assets/js/[name]-[hash].js'
			}
		},
		// Optimasi build
		target: 'esnext',
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				pure_funcs: ['console.log', 'console.info', 'console.debug']
			}
		},
		// Optimasi chunk size
		chunkSizeWarningLimit: 1000,
		// Source maps untuk production (opsional)
		sourcemap: false
	},
	// Optimasi development
	server: {
		hmr: {
			overlay: false
		}
	},
	// Optimasi dependencies
	optimizeDeps: {
		include: [
			'svelte',
			'@sveltejs/kit',
			'lucide-svelte',
			'uuid',
			'idb-keyval'
		],
		exclude: ['@lottiefiles/dotlottie-svelte'] // Exclude karena bisa menyebabkan masalah
	},
	// Preload critical modules
	preview: {
		port: 4173,
		host: true
	},
	// Optimasi CSS
	css: {
		devSourcemap: false
	},
	// Optimasi esbuild
	esbuild: {
		target: 'esnext',
		drop: ['console', 'debugger']
	}
});
