# 🔗 ZatiarasPOS — INTEGRATIONS.md

## Cloudflare (Database, Storage, Realtime)

- **D1 (Database)**: SQLite di edge. Binding `DB_SAMARINDA_GROUP` / `DB_BALIKPAPAN_GROUP` / `DB_BERAU_GROUP` — **sharded per grup cabang** (3 DB terpisah). Akses via Drizzle ORM di endpoint server; binding tidak diekspos ke browser.
- **R2 (Storage)**: bucket `zatiaras-assets` (binding `STORAGE`) untuk gambar produk; disajikan via proxy same-origin `/api/upload?key=...`.
- **Durable Objects**: `REALTIME_HUB` (worker `zatiaraspos-realtime`) untuk sinkronisasi live antar device (WebSocket Hibernation) + rate limiting.
- **CLI/local**: wrangler pakai `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (di `.env`).

## OpenRouter AI

- **Endpoint**: `https://openrouter.ai` (ada di CSP)
- **Fungsi**: AI chat assist (`src/lib/services/aiAnalysisService.ts`)
- **Komponen**: `src/lib/components/shared/aiChatModal.svelte`

## Google Fonts

- **Font**: Inter (diload via CDN fonts.googleapis.com)
- **Fallback**: system-ui, sans-serif

## PWA (Progressive Web App)

- **Package**: `@vite-pwa/sveltekit` + `workbox-window`
- **Install Dialog**: `src/lib/components/shared/pwaInstallDialog.svelte`
- **Icons**: di folder `static/`

## External CDN (whitelist di CSP)

- `fonts.googleapis.com` — Google Fonts CSS
- `fonts.gstatic.com` — Google Fonts files
- `unpkg.com` / `cdn.jsdelivr.net` — Worker scripts
- `*.workers.dev` / `wss://*.workers.dev` — worker realtime Cloudflare (Durable Object)

## Internal API Routes

| Route                | Method | Fungsi               |
| -------------------- | ------ | -------------------- |
| `/api/veriflogin`    | POST   | Verifikasi PIN login |
| `/api/logout`        | POST   | Logout session       |
| `/api/gantikeamanan` | POST   | Ganti PIN/security   |
| `/api/aichat`        | POST   | AI chat endpoint     |
