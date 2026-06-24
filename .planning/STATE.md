# 🧠 ZatiarasPOS — STATE.md

_File ini adalah "memori" proyek. Update setiap kali ada perubahan signifikan._

## 📌 Status Saat Ini

- **Tanggal**: 2026-06-19
- **Milestone**: v2.0 — Stabilisasi & Quality
- **Phase Aktif**: **Phase 3 AKTIF** — POS Production Polish
- **Pekerjaan Terakhir**: Scope Phase 3 ditentukan, quality test runner diperbaiki, `pnpm test:all` lewat, dan live Cloudflare smoke check dasar selesai.

## 🎉 Milestone Tercapai

- ✅ **Fase 1** — Formatting & Dead Code Cleanup
- ✅ **Fase 2** — Type Safety (0 `any` di routes)
- ✅ **Fase 3** — Svelte 5 Migration (semua stores → runes, `$:` → `$derived/$effect`)
- ✅ **Fase 4** — Component Extraction (13 komponen baru di `components/`)
- ✅ **Fase 5** — Deduplikasi & Polish
- ✅ **`pnpm check`** → 0 errors
- 🔄 **Phase 3** — POS checkout reliability, loading/error states, offline/realtime smoke, premium cashier UI polish

## ✅ Verifikasi Terakhir

- `pnpm test:all` → 30/30 passed (8 code quality, 22 feature tests)
- `pnpm deploy:check` → deploy config ready
- `https://zatiaraspos.pages.dev` → 200 OK
- `https://zatiaraspos.pages.dev/login` → 200 OK
- `https://zatiaraspos.pages.dev/api/data?table=produk&branch=samarinda` tanpa session → 401 Unauthorized
- `https://zatiaraspos.pages.dev/api/realtime?branch=samarinda` tanpa session → 401 Unauthorized
- `wrangler deployments list --config wrangler.realtime.jsonc` → realtime worker deployments visible

## 🛠️ Setup Yang Sudah Selesai

- ✅ Context7 MCP terpasang di `mcp_config.json` dengan API key
- ✅ GSD framework di-install via `npx get-shit-done-cc@latest` → `.claude/`
- ✅ `.planning/` structure dibuat (PROJECT, ROADMAP, STATE, codebase/)
- ✅ `DDS.md` dan `PHASES.md` ada di root proyek

## 🗂️ Arsitektur Codebase (Ringkasan)

```
src/
├── hooks.server.ts     # CSRF + Security headers + Session middleware
├── app.html            # HTML shell + PWA meta
├── app.css             # Global styles (Tailwind base)
├── lib/
│   ├── auth/           # auth.ts — PIN-based session management
│   ├── components/
│   │   ├── shared/     # 9 komponen reusable (bottomNav, topBar, modals, dll)
│   │   ├── dashboard/  # DashboardMetrics, WeeklyChart, TokoModal [NEW]
│   │   ├── laporan/    # LaporanFilter, LaporanSummaryCards, LaporanAccordion [NEW]
│   │   └── pos/        # ProductGrid, CartPreview, CustomItemModal [NEW]
│   ├── config/         # env.ts — environment variable access
│   ├── constants/      # navigation.ts — NAV_ITEMS, getNavIndex [NEW]
│   ├── database/       # schema.ts — Cloudflare D1 schema via Drizzle
│   ├── server/         # Server-side logic (sessionStore)
│   ├── services/       # dataService, sesiTokoService [NEW], aiAnalysis
│   ├── stores/         # Svelte 5 rune stores (userRole, selectedBranch, securitySettings, posGridView)
│   ├── types/          # TypeScript interfaces (product, user, transaction, laporan, store)
│   └── utils/          # 20+ utility files (touchNavigation, refreshBus, ui, dateTime, dll)
└── routes/
    ├── +layout.svelte  # Root layout (auth guard, bottomNav, PWA)
    ├── +page.svelte    # Dashboard (modular, thin orchestrator)
    ├── pos/            # Point of Sale + /bayar
    ├── catat/          # Catat transaksi/buka-tutup toko
    ├── laporan/        # Laporan (modular dengan LaporanFilter, dll)
    ├── pengaturan/     # Settings (kasir, pemilik, printer sub-routes)
    ├── login/          # Login PIN
    ├── unauthorized/   # 401 page
    └── api/            # Server-side API endpoints
```

## ⚠️ Tech Debt Tersisa

- `pos/bayar/+page.svelte` masih punya beberapa `non_reactive_update` warnings (cart, customerName, paymentMethod)
- `modalSheet.svelte` masih pakai Svelte 4 `createEventDispatcher` — bisa migrasi ke rune callbacks di Fase 6

## 🔑 Keputusan Arsitektural Yang Sudah Dibuat

1. Auth pakai custom session (cookie-based), BUKAN Supabase Auth
2. CSRF protection aktif untuk route POST `/api/veriflogin`, `/api/gantikeamanan`, `/api/logout`
3. Cloudflare D1 dipakai sebagai data store utama, dengan Drizzle schema dan branch-scoped server access
4. Offline-first via IndexedDB (`idb-keyval`)
5. Toast standardized ke `createToastManager()` dari `$lib/utils/ui`
6. sesi_toko fetch centralized ke `$lib/services/sesiTokoService`
7. Touch navigation centralized ke `$lib/utils/touchNavigation`
8. Nav constants di `$lib/constants/navigation`
9. Window event bus di `$lib/utils/refreshBus`

## 📝 Instruksi Untuk AI (Antigravity/Claude)

Saat menerima task di proyek ini:

1. Baca `PROJECT.md` untuk memahami prinsip yang tidak boleh dilanggar
2. Cek `ROADMAP.md` untuk tahu prioritas saat ini
3. Update `STATE.md` ini setelah menyelesaikan task signifikan
4. Gunakan Context7 MCP untuk fetch dokumentasi Svelte 5 / Supabase jika diperlukan
5. Jangan ubah UI/UX yang sudah ada kecuali diminta secara eksplisit
