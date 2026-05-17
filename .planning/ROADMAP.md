# 🗺️ ZatiarasPOS — ROADMAP.md

## Milestone Aktif: v2.0 — Stabilisasi & Quality

### ✅ Phase 0: GSD Setup (SELESAI)

- [x] Pasang Context7 MCP di Antigravity
- [x] Inisialisasi GSD framework di `.claude/`
- [x] Buat `DDS.md`, `PHASES.md`, `.planning/` structure
- [x] Pemetaan arsitektur codebase

### ✅ Phase 1: Audit & Alignment (SELESAI)

- [x] Periksa semua route, hapus dead code, format dengan Prettier
- [x] Audit tipe TypeScript — hilangkan semua `any` di routes (270+ → 0)
- [x] Migrasi semua Svelte 4 stores → Svelte 5 runes (`$state`, `$derived`, `$effect`)
- [x] Ganti semua `(window as any).__refreshXxx` dengan `refreshBus`
- [x] Ekstrak komponen reusable dari route monolitik (laporan, dashboard, pos)
- [x] Deduplikasi: centralize touch nav, nav constants, toast manager, sesi toko service
- [x] Hapus semua `a11y-ignore` comments
- [x] `pnpm check` → 0 errors ✅

### 📋 Phase 2: Feature Improvement (MENUNGGU)

- [ ] Ditentukan berdasarkan kebutuhan user selanjutnya

### 📋 Phase 3: Performance & Polish (MENUNGGU)

- [ ] Optimasi loading time
- [ ] Audit aksesibilitas (sudah fix a11y-ignore, tapi perlu audit menyeluruh)
- [ ] PWA offline reliability check
- [ ] Migrasi `modalSheet.svelte` dari Svelte 4 `createEventDispatcher` ke rune callbacks

---

_Update roadmap ini setiap kali ada fitur baru atau perubahan prioritas._
