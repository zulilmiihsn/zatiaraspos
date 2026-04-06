# 🧠 ZatiarasPOS — STATE.md
*File ini adalah "memori" proyek. Update setiap kali ada perubahan signifikan.*

## 📌 Status Saat Ini
- **Tanggal**: 2026-04-05
- **Milestone**: v2.0 — Stabilisasi & Quality
- **Phase Aktif**: Phase 1 — Audit & Alignment
- **Pekerjaan Terakhir**: Setup GSD + Context7 MCP

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
│   │   └── shared/     # 9 komponen reusable (bottomNav, topBar, modals, dll)
│   ├── config/         # env.ts — environment variable access
│   ├── database/       # supabaseClient.ts — Supabase client singleton
│   ├── server/         # Server-side logic (sessionStore)
│   ├── services/       # Data services (dataService, optimizedDataService, aiAnalysis)
│   ├── stores/         # Svelte stores (userRole, selectedBranch, securitySettings)
│   ├── types/          # TypeScript interfaces (product, user, transaction, dll)
│   └── utils/          # 20 utility files (cache, security, validation, dll)
└── routes/
    ├── +layout.svelte  # Root layout (auth guard, bottomNav, PWA)
    ├── +page.svelte    # Dashboard (42KB — komplex)
    ├── pos/            # Point of Sale + /bayar
    ├── catat/          # Catat transaksi/buka-tutup toko
    ├── laporan/        # Laporan (77KB — paling besar)
    ├── pengaturan/     # Settings (kasir, pemilik, printer sub-routes)
    ├── login/          # Login PIN
    ├── unauthorized/   # 401 page
    └── api/            # Server-side API endpoints
```

## ⚠️ Tech Debt & Catatan Penting
- `AppState` di `types/index.ts` menggunakan `any` untuk auth, user, products, transactions, financial
- Beberapa stores masih pakai Svelte 4 pattern (perlu verifikasi)
- File `laporan/+page.svelte` berukuran 77KB — kemungkinan bisa dipecah
- File `pos/+page.svelte` berukuran 41KB — perlu dicek struktur componentnya

## 🔑 Keputusan Arsitektural Yang Sudah Dibuat
1. Auth pakai custom session (cookie-based), BUKAN Supabase Auth
2. CSRF protection aktif untuk route POST `/api/veriflogin`, `/api/gantikeamanan`, `/api/logout`
3. Supabase dipakai sebagai data store (bukan auth provider)
4. Offline-first via IndexedDB (`idb-keyval`)

## 📝 Instruksi Untuk AI (Antigravity/Claude)
Saat menerima task di proyek ini:
1. Baca `PROJECT.md` untuk memahami prinsip yang tidak boleh dilanggar
2. Cek `ROADMAP.md` untuk tahu prioritas saat ini
3. Update `STATE.md` ini setelah menyelesaikan task signifikan
4. Gunakan Context7 MCP untuk fetch dokumentasi Svelte 5 / Supabase jika diperlukan
5. Jangan ubah UI/UX yang sudah ada kecuali diminta secara eksplisit
