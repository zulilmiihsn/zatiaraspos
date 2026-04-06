# ⚠️ ZatiarasPOS — CONCERNS.md (Tech Debt & Known Issues)

## 🔴 Priority Tinggi

### 1. `AppState` Masih Menggunakan `any`
- **File**: `src/lib/types/index.ts` (baris 104-111)
- **Masalah**: Fields `auth`, `user`, `products`, `transactions`, `financial` bertipe `any`
- **Dampak**: Kehilangan type safety di seluruh app state
- **Fix**: Definisikan interface yang proper untuk setiap field

### 2. File Laporan Sangat Besar (77KB)
- **File**: `src/routes/laporan/+page.svelte`
- **Masalah**: Satu file 77KB — terlalu besar, sulit di-maintain
- **Dampak**: Performa, readability
- **Fix**: Pecah menjadi sub-komponen (belum dikerjakan)

### 3. File POS Besar (41KB)
- **File**: `src/routes/pos/+page.svelte`
- **Masalah**: Satu file 41KB
- **Fix**: Evaluasi apakah perlu dipecah

## 🟡 Priority Menengah

### 4. Multiple Cache Utilities
- **Files**: `cache.ts`, `advancedCache.ts`, `cacheManager.ts`, `cacheMetrics.ts`
- **Masalah**: 4 file cache terpisah — kemungkinan ada duplikasi logika
- **Fix**: Konsolidasi ke satu cache layer yang jelas

### 5. Stores Mungkin Masih Svelte 4
- **Files**: `src/lib/stores/*.ts`
- **Masalah**: Perlu diverifikasi apakah sudah pakai Runes atau masih `writable()`
- **Fix**: Audit dan migrate jika perlu

### 6. Dua Data Services
- **Files**: `dataService.ts` (36KB) dan `optimizedDataService.ts` (14KB)
- **Masalah**: Tidak jelas kapan pakai yang mana
- **Fix**: Dokumentasikan perbedaannya atau konsolidasi

## 🟢 Priority Rendah

### 7. `performanceTracker.ts` Sangat Besar (17KB)
- Mungkin bisa disederhanakan

### 8. Security utils terpisah
- `security.ts` dan `csrf.ts` terpisah — mungkin bisa dimerge

---
*Update file ini setiap menemukan tech debt baru.*
