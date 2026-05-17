# 🔗 ZatiarasPOS — INTEGRATIONS.md

## Supabase

- **Project URL**: dari env `PUBLIC_SUPABASE_URL`
- **Anon Key**: dari env `PUBLIC_SUPABASE_ANON_KEY`
- **Client**: `src/lib/database/supabaseClient.ts` — singleton pattern
- **RLS**: Wajib aktif di semua tabel (Row Level Security)
- **Realtime**: Digunakan untuk sinkronisasi live data antar device

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
- `*.supabase.co` / `wss://*.supabase.co` — Supabase DB + Realtime

## Internal API Routes

| Route                | Method | Fungsi               |
| -------------------- | ------ | -------------------- |
| `/api/veriflogin`    | POST   | Verifikasi PIN login |
| `/api/logout`        | POST   | Logout session       |
| `/api/gantikeamanan` | POST   | Ganti PIN/security   |
| `/api/aichat`        | POST   | AI chat endpoint     |
