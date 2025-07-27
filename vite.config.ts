import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,avif}'],
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
						urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'supabase-cache',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 // 1 day
							}
						}
					}
				]
			},
			includeAssets: ['favicon.svg', '180x180.png', '192x192.png', '144x144.png', '512x512.png'],
			manifest: {
				name: 'Zatiaras POS',
				short_name: 'ZatiarasPOS',
				description: 'Point of Sale System untuk Bisnis Minuman',
				theme_color: '#ec4899',
				background_color: '#ffffff',
				display: 'standalone',
				orientation: 'portrait',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'img/192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'img/512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'img/180x180.png',
						sizes: '180x180',
						type: 'image/png'
					},
					{
						src: 'img/144x144.png',
						sizes: '144x144',
						type: 'image/png'
					}
				]
			}
		})
	],
	build: {
		rollupOptions: {
			external: [
				'bcryptjs',
				'bcrypt',
				'crypto',
				'fs',
				'path',
				'os'
			],
			output: {
				manualChunks: {
					// Vendor chunks
					'vendor-svelte': ['svelte', '@sveltejs/kit'],
					'vendor-ui': ['lucide-svelte'],
					// Route chunks
					'route-pos': ['./src/routes/pos/+page.svelte'],
					'route-pengaturan': ['./src/routes/pengaturan/+page.svelte'],
					'route-laporan': ['./src/routes/laporan/+page.svelte']
				}
			}
		},
		chunkSizeWarningLimit: 1000,
		sourcemap: false, // Disable sourcemap untuk production
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true, // Remove console.log in production
				drop_debugger: true
			}
		}
	},
	optimizeDeps: {
		include: [
			'svelte',
			'@sveltejs/kit',
			'lucide-svelte',
			'@supabase/supabase-js'
		],
		exclude: [
			'bcryptjs',
			'bcrypt',
			'crypto',
			'fs',
			'path',
			'os'
		]
	},
	server: {
		fs: {
			allow: ['..']
		}
	},
	preview: {
		port: 4173,
		strictPort: false
	}
});
