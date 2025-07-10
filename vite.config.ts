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
				clientsClaim: true
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
				manualChunks: {
					'vendor': ['svelte', '@sveltejs/kit'],
					'icons': ['lucide-svelte']
				}
			}
		},
		chunkSizeWarningLimit: 1000
	},
	optimizeDeps: {
		include: ['lucide-svelte']
	}
});
