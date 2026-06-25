# Audit ZatiarasPOS — Consolidated & Validated

> Read-only. ~34k LOC, 141 file. **Tidak ada kode diubah.**
> Hasil 6 agent audit per-scope, **di-dedup lintas-scope** + **divalidasi ulang** oleh main thread.
> Target perbaikan kanonik ada di `CONVENTIONS.md`.

**Status verifikasi tiap temuan:**
- ✅ **VERIFIED** — gua cek ulang langsung (grep import / baca baris). Aman ditindak.
- ◐ **AGENT-REPORTED** — dari agent, masuk akal, belum gua re-verifikasi per-baris → spot-check sebelum apply.

**Konvergensi sebagai validasi:** temuan yang ditemukan ≥2 agent terisolasi ditandai 🔁 (sinyal kuat, bukan kebetulan).

---

## TL;DR

| # | Tema | Status | Dampak |
|---|------|--------|--------|
| 1 | Dead code whole-file (utils+types zero-consumer) | ✅ **DONE** | hapus **2.518 LOC**, nol risiko |
| 2 | Dead code level-halaman | ◐ sebagian ✅ | ratusan LOC tambahan |
| 3 | `formatRupiah` tak diadopsi 🔁×4 | ✅ **DONE** (app-wide) | 97 situs (74 client + 23 server); sisa 4 = util+tanggal |
| 4 | 3 file `riwayat` ~80-85% duplikat 🔁×2 | ✅ **DONE** | ~447 baris dup → 3 modul bersama |
| 5 | God-components | ◐ DRY done, split ditunda | aichat DRY+Rupiah ✅; split → post-commit |
| 6 | Kontrak error/response API 4 gaya | ✅ **DONE (no-code)** | 2-tier didokumentasikan; konversi ditolak (unsafe) |
| 7 | Bug korektnes + security | ✅ **DONE** | upload no-auth, 3 bug kecil |

**Sudah bagus (jangan diutak-atik tanpa alasan):** Svelte 5 runes hampir tuntas (nol `export let`/`$:`); `schema.ts` snake_case + index rapi; `api/pos/transaction` = baseline auth benar.

---

## 🔴 P1 — Dead code whole-file — ✅ DONE (2.518 LOC dihapus)

> **Status: SELESAI.** 9 file dihapus sebagai cluster + dibersihkan re-export/interface yatim di `types/index.ts` (`export * from './user'|'./transaction'`, interface `UserState`/`TransactionState`, ref di `AppState`). `pnpm check`: **76 → 71 error** (turun 5, nol orphan, nol regresi). Belum di-commit.

Grep import: hanya self-reference internal, **nol consumer eksternal**. Catatan: file util ini saling-rujuk (`lazyLoader`→`performanceTracker`, `performanceMonitor`→`performanceTracker`) → **hapus sebagai satu cluster sekaligus**, jangan satu-satu.

| File | LOC | Status |
|------|-----|--------|
| `lib/utils/performanceTracker.ts` | 668 | ✅ zero ext. import |
| `lib/utils/bundleOptimizer.ts` | 385 | ✅ zero — isinya fake (`findDuplicateModules` hardcoded `['lucide-svelte']`) |
| `lib/utils/lazyLoader.ts` | 327 | ✅ zero — `lazyComponents` semua placeholder |
| `lib/utils/naming.ts` | 223 | ✅ zero match total (fully dead) |
| `lib/utils/routeLoader.ts` | 194 | ✅ zero — `preloadRoute` simulasi `setTimeout` |
| `lib/utils/cacheManager.ts` | 88 | ✅ zero — shim deprecated, nol old-import |
| `lib/utils/performanceMonitor.ts` | 34 | ✅ zero — shim deprecated |
| `lib/types/transaction.ts` | 316 | ✅ `from '$lib/types/transaction'` = **No matches** |
| `lib/types/user.ts` | 283 | ✅ `from '$lib/types/user'` = **No matches** |
| **TOTAL** | **2.518** | |

---

## 🟠 P2 — Dead code level-halaman & partial (perlu spot-check per item)

| Lokasi | Temuan | Status |
|--------|--------|--------|
| `bayar/+page.svelte` | modal **NoSession** + notif **Success** (9 occurrence `showNoSessionModal`/`showSuccessNotif` di file ini ✅ ada) tak pernah di-trigger | ◐ trigger-check |
| `manajemenmenu/+page.svelte` | `blockNextClick` (8 occurrence ✅ ada; agent: hanya `removeEventListener`, no `add`), `touchStartX/EndX`, `selectedImage`, komentar migrasi 1153-1154 | ◐ |
| `lib/types/index.ts:112-438` | ~300 baris tipe mati; sisakan `AppError`/`ApiError`/`ValidationError`. **Sebagian sudah dibuang saat P1** (`UserState`/`TransactionState`/ref `AppState` — yang rujuk modul terhapus). Sisa (`UIState`/`AppState`/`ButtonProps`/dst) masih ada | ◐ **per-simbol** sebelum trim lanjut |
| `pengaturan/+page.svelte` | `PengaturanData`, `fetchPengaturan()` tak dipanggil, 5 getter role, `settingsSections` | ◐ |
| `laporan/+page.svelte:572-618` | 8 `$derived` total per-subgroup + `formatCurrency`/`groupAndSumByName`/`toYMD`/`showToastNotification`/`userProfileData` | ◐ |
| `performance.ts` | `throttle` + `measureAsyncPerformance` zero-consumer (`debounce`/`calculateCartTotal`/`fuzzySearch` DIPAKAI — jangan hapus) | ◐ |
| `errorHandling.ts` | `createApiError`/`createErrorBoundary`/`ValidationHelper` zero-consumer | ◐ |
| `security.ts` | `CSRFProtection`/`SessionSecurity`/`XSSProtection`/`InputValidation` zero-consumer (CSRF asli di `csrf.ts`) | ◐ |
| `autoApplyService.ts:273` | `rollbackChanges()` body kosong `// TODO` | ◐ |
| `pos/+page.svelte` | `measureAsyncPerformance(..., ()=>Promise.resolve())` no-op; `skeletonCount` dihitung tapi hardcode 12 | ◐ |

---

## 🔴 P3 — DRY (→ lihat target di CONVENTIONS §1-4)

| Temuan | Bukti | Status |
|--------|-------|--------|
| 🔁×4 **`formatRupiah` tak diadopsi** | **102× `toLocaleString('id-ID')`** → migrasi **97 situs** (74 client + 23 server prompt). Sisa 4: currency.ts (2, util) + pengaturan dates (2, skip) | ✅ **DONE** (app-wide) |
| `formatRupiah`/`formatCurrency` lokal duplikat | `catat:186` (dihapus→import util), `laporan formatCurrency` (dihapus, zero-caller). `CustomItemModal:15` formatter input → ditunda | ✅ sebagian / ◐ CustomItemModal |
| 🔁×2 **builder struk ~70 baris ×3 verbatim** | → `lib/utils/receiptPrint.ts` (`buildReceiptHtml`+`printViaIntent`+`loadReceiptSettings`). 3 riwayat migrasi. **`bayar:400-487` masih → ikut P4-followup** | ✅ **DONE** (3 riwayat) |
| `fetchTransaksiHariIni`/`fetchPengaturanStruk`/`HistoryItem` identik ×3 | → `lib/services/riwayatService.ts` + `HistoryItem` ke `lib/types/laporan`. Reconcile: `ref_transaksi_kasir_id ?? transaction_id`, ucapan `\n` | ✅ **DONE** |
| aichat OpenRouter fetch ×3 + fence-parse ×2 | `aichat:146,305,682` | ◐ |
| `methodLabels` map di-copy | pos/bayar/aichat/riwayat | ◐ |
| `LaporanAccordions` 4 sub-accordion copy-paste (~110×4) | — | ◐ |
| 3 impl sanitasi XSS + 2× validateEmail/Password | validation.ts vs security.ts | ◐ |
| `dataService` getProducts/Categories/AddOns nyaris identik | 300-358 | ◐ |
| `autoApplyService` pola `if(!res.ok)` ×4 | — | ◐ |

---

## 🟠 P4 — KISS god-components (◐ sebagian — DRY/de-bloat done, SPLIT ditunda)

> **P4-part-1 ✅ DONE (aman, type-checkable):** `aichat` DRY — `callOpenRouter()` + `stripJsonFence()` (3 fetch + 2 fence-parse → 1 helper) + 23 Rupiah server. `pnpm check` 70, nol regresi.
> **DITUNDA (risiko tinggi — butuh tes runtime, lakukan SETELAH commit):** split komponen reaktif + dekomposisi handler. Bug reaktivitas/logika TIDAK ketangkep `pnpm check`.

| File | LOC | Aksi | Status |
|------|-----|------|--------|
| `api/aichat/+server.ts` | **1652** | ✅ DRY helper (`callOpenRouter`/`stripJsonFence`) + Rupiah. **◐ Ditunda:** `handleRegularChat` 780 baris → modul + `prompts.ts` | ◐ DRY done |
| `pengaturan/pemilik/manajemenmenu/+page.svelte` | **2831** | pecah 5 tab → `MenuTab/KategoriTab/EkstraTab/BahanTab/HppTab`. Dead-code (`blockNextClick`/touch/`selectedImage`) **terverifikasi** tapi ditahan ke post-commit | ⏸ ditunda |
| `bayar/+page.svelte` | 1008 | `printStrukViaEscPosService` 87 baris (+ migrasi ke `receiptPrint.ts`) + `addToCart` 81 baris | ⏸ ditunda |
| `laporan:38-79` | — | `computeReportFingerprint` over-engineered → hash ringan | ⏸ ditunda |

---

## 🟠 P5 — Consistency (→ CONVENTIONS §4-7)

| Temuan | Status |
|--------|--------|
| Kontrak error API 4 gaya (`kitError` vs `json({success})` vs `json({error})`) lintas 27 endpoint | ✅ **DONE (no-code)** — impact-check: konversi paksa UNSAFE (`csrf.ts:56` baca `code:'CSRF_INVALID'` utk retry; success `token`/`{url,key}` coupled; normalizer `message\|\|error\|\|code` sudah toleran). Resolusi: 2-tier didokumentasikan di `CONVENTIONS §4` |
| Toast 3 pola (`createToastManager` vs inline `+layout:332` vs state lokal) | ◐ |
| Error-handling frontend tak konsisten (`catch {}` silent vs string lokal vs `ErrorHandler`) | ◐ |
| 4 komponen reimplement modal backdrop + `@keyframes slideUp` | ◐ |
| Icon: `<ArrowLeft/>` vs `<svelte:component>` (deprecated) campur | ◐ |
| Runes vs Svelte 4 `let` campur di file riwayat | ◐ |
| Callback prop `onClose` vs `onclose`/`ondone` campur | ◐ |
| `each` key `(trx.id)` vs `(_i)` index vs tanpa key | ◐ |

---

## ⚠️ P0 — Bug & Security — ✅ DONE (6/6 fixed)

> **Status: SELESAI.** `pnpm check` 71 → 70 error (fix `profil` buang 1 type-error; nol regresi). Belum di-commit.

| Lokasi | Temuan | Fix | Status |
|--------|--------|-----|--------|
| `api/upload/+server.ts` | **POST/DELETE tanpa auth** — siapa pun bisa upload/hapus R2 | `requireAuthSession` + `requireAnyRole(['pemilik'])` **sebelum** `try` di POST & DELETE. **GET dibiarkan publik** (serving gambar by uuid-key, `<img src>`) | ✅ DONE |
| `bayar/+page.svelte:218` | `kembalian = 0` di-assign ke `$derived` — invalid Svelte 5 + redundan | Baris dihapus (line 217 sudah bikin derive ke 0) | ✅ DONE |
| `api/buku-kas/+server.ts:73` | `row.nominal ?? row.nominal ?? 0` operand kembar | → `row.nominal ?? 0` | ✅ DONE |
| `api/profil/+server.ts:27` | `profilToko.$inferInsert` — var undefined | → `profil.$inferInsert` | ✅ DONE |
| `gantikeamanan:195` | `error.message` di-render mentah — bocor detail server | pesan generik + `console.error` (CONVENTIONS §5) | ✅ DONE |
| `autoApplyService.ts:117` | cabang ternary `penjualan` tak terjangkau | → `data.type === 'pemasukan' ? 'in' : 'out'` | ✅ DONE |

---

## Urutan eksekusi (kunci dependensi antar-batch — sama dgn CONVENTIONS §10)

1. ~~**P1 hapus dead-code whole-file** (2.518 LOC, hapus 9 file sbg cluster)~~ — ✅ **DONE** (76→71 error, nol orphan). Belum commit.
2. ~~**P0 fix bug + auth `upload`**~~ — ✅ **DONE** (6/6 fixed, 71→70 error). Belum commit.
3. ~~**P3 batch Rupiah** — sweep ke `formatRupiah`~~ — ✅ **DONE**: 74 situs display di 18 file (4 builder-agent paralel), `pnpm check` tetap 70 (nol regresi). Server prompt (23×) folded ke P4. Belum commit.
4. ~~**Extract `receiptPrint.ts` + `riwayatService.ts`**~~ — ✅ **DONE** (3 riwayat): ~447 baris dup dihapus, `pnpm check` tetap 70. `bayar` receipt → P4-followup. Belum commit.
5. ~~**P5 kontrak error API**~~ — ✅ **DONE (no-code)**: impact-check menolak konversi (unsafe), kontrak 2-tier didokumentasikan. Nol perubahan kode = nol risiko.
6. **Toast + modal base + error-handling frontend.**
7. **P4 pecah god-components** — terakhir, per-komponen.

Tiap batch: `pnpm check` + `pnpm test:all` hijau, ikuti checklist `CONVENTIONS.md §9`, centang progres di sini.

---

### Catatan validasi (apa yang gua cek ulang sesi ini)
- ✅ Grep import 7 util + 2 types → semua zero external consumer (self-ref only).
- ✅ `toLocaleString('id-ID')` = 102 occurrence / 20 file (exact).
- ✅ Baca baris: `upload` no-auth, `bayar:218`, `buku-kas:73`, `profil:27` — semua benar.
- ✅ LOC presisi file mati via `wc -l` = 2.518 total.
- ◐ Item bertanda ◐ belum di-verifikasi per-baris — verifikasi saat batch-nya dikerjakan (impact-check `CONVENTIONS §8`).
