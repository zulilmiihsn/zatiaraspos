# 🔬 ZatiarasPOS — STACK.md (Codebase Map)

## Languages & Runtimes

- **TypeScript 5.x** — strict mode, semua file `.ts` dan `.svelte`
- **Svelte 5.x** — Runes-based reactivity (`$state`, `$derived`, `$effect`, `$props`)
- **Node.js** — Runtime via Vite dev server

## Frameworks & Libraries

| Library                 | Versi  | Fungsi                    |
| ----------------------- | ------ | ------------------------- |
| `@sveltejs/kit`         | ^2.16  | Full-stack web framework  |
| `svelte`                | ^5.0   | UI components (Runes)     |
| `tailwindcss`           | ^4.1   | Utility-first CSS         |
| `@supabase/supabase-js` | ^2.50  | Database client           |
| `@vite-pwa/sveltekit`   | ^1.0   | PWA support               |
| `idb-keyval`            | ^6.2   | IndexedDB key-value store |
| `lucide-svelte`         | ^0.535 | Icon library              |
| `pako`                  | ^2.1   | Compression               |
| `bcryptjs`              | ^3.0   | Password hashing          |
| `uuid`                  | ^11.1  | UUID generation           |

## Build & Dev Tools

- **Vite 6.x** — Build tool + HMR
- **ESLint 9.x** — Linting (flat config)
- **Prettier 3.x** — Formatting (+ svelte + tailwind plugins)
- **tsx** — TypeScript runner untuk test scripts

## Authentication System

- **Type**: Custom session-based (BUKAN Supabase Auth)
- **Session**: Cookie `zatiaras_sid` (httpOnly, server-side)
- **CSRF**: Token via cookie `zatiaras_csrf` + header `x-csrf-token`
- **PIN**: bcryptjs hashing
- **Role**: UserRole enum (kasir, pemilik, admin, manager)

## Security Headers (via hooks.server.ts)

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy` — ketat, whitelist Supabase + Google Fonts
- `Referrer-Policy: strict-origin-when-cross-origin`

## Data Flow

```
Browser → SvelteKit Route → +page.svelte
                          ↓
                    Service Layer (dataService.ts)
                          ↓
               Supabase Client (supabaseClient.ts)
                          ↓
                  PostgreSQL (Supabase Cloud)
                          ↕ (realtime)
               IndexedDB (idb-keyval) — offline cache
```
