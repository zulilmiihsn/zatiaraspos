import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			workbox: {
				// Sederhanakan glob patterns
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
		// Sederhanakan konfigurasi build
		chunkSizeWarningLimit: 1000,
		sourcemap: false,
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true
			}
		}
	},
	optimizeDeps: {
		include: [
			'svelte',
			'lucide-svelte',
			'@supabase/supabase-js'
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
