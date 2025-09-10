import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'prompt',
			injectRegister: 'auto',
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,avif,woff2,woff}'],
				runtimeCaching: [
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|webp|avif)$/,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'images-cache',
							expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 }
						}
					},
					{
						urlPattern: /\.(?:woff2?|ttf|otf)$/,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'fonts-cache',
							expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 }
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
				screenshots: [
					{
						src: 'screenshots/app-1080x1920-01.png',
						sizes: '1080x1920',
						type: 'image/png',
						form_factor: 'narrow',
						label: 'Dashboard'
					},
					{
						src: 'screenshots/app-1080x1920-02.png',
						sizes: '1080x1920',
						type: 'image/png',
						form_factor: 'narrow',
						label: 'Kasir / POS'
					},
					{
						src: 'screenshots/app-1080x1920-03.png',
						sizes: '1080x1920',
						type: 'image/png',
						form_factor: 'narrow',
						label: 'Laporan'
					},
					{
						src: 'screenshots/app-1080x1920-04.png',
						sizes: '1080x1920',
						type: 'image/png',
						form_factor: 'narrow',
						label: 'Pengaturan'
					}
				],
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
			external: ['bcryptjs', 'bcrypt', 'crypto', 'fs', 'path', 'os'],
			output: {
				manualChunks: {
					// Vendor chunks
					'vendor-svelte': ['svelte', '@sveltejs/kit']
				}
			}
		},
		chunkSizeWarningLimit: 500, // Reduce warning limit for better optimization
		sourcemap: false, // Disable sourcemap untuk production
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true, // Remove console.log in production
				drop_debugger: true,
				pure_funcs: ['console.log', 'console.info', 'console.debug']
			}
		}
		// Tree shaking is enabled by default in Vite
	},
	css: {
		postcss: './postcss.config.cjs'
	},
	optimizeDeps: {
		include: ['svelte', '@sveltejs/kit', '@supabase/supabase-js'],
		exclude: ['bcryptjs', 'bcrypt', 'crypto', 'fs', 'path', 'os', 'lucide-svelte']
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
