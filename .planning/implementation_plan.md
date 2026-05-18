# Goal
Migrasi total Zatiaras POS dari ekosistem Supabase ke **Cloudflare (D1 + R2 + Pages)** dan **Ably Realtime**. 
Tujuan: 100% serverless, edge-optimized, bebas biaya infrastruktur berlebih, dan menghilangkan vendor-lock Supabase.

## User Review Required
> [!WARNING]
> Perubahan ini bersifat **destruktif** terhadap arsitektur backend saat ini. Semua data dari PostgreSQL Supabase harus dimigrasi secara manual ke SQLite (Cloudflare D1). Pastikan backup data Supabase selesai sebelum eksekusi script migrasi.

> [!CAUTION]
> Cloudflare D1 tidak mendukung fitur Realtime/WebSocket bawaan seperti Supabase. Mekanisme realtime akan ditulis ulang sepenuhnya menggunakan **Ably Pub/Sub**.

## Open Questions
> [!IMPORTANT]
> **Skema Cabang (Multi-Branch):** Saat ini aplikasi memisahkan instance Supabase per cabang (`samarinda`, `berau`, `balikpapan`). 
> 
> **Pertanyaan:** Apakah kita ingin membuat **1 Database D1 Global** (dengan kolom `branch_id`) ATAU **5 Binding D1 Terpisah** (satu database untuk tiap cabang)? Saran: 1 Database D1 Global dengan `branch_id` lebih mudah dikelola untuk reporting pusat.

> [!IMPORTANT]
> **Data Image (Storage):** Apakah kita perlu membuat script migrasi otomatis yang menarik file dari bucket Supabase dan mengunggahnya ke Cloudflare R2?

## Proposed Changes

---
### 1. Database & ORM (D1)
Migrasi query builder Supabase ke **Drizzle ORM** yang dioptimalkan untuk Cloudflare D1.

#### [NEW] `src/lib/database/schema.ts`
Berisi definisi skema Drizzle (SQLite) untuk tabel: `buku_kas`, `transaksi_kasir`, `produk`, `kategori`, `tambahan`, dan `profil`. (Akan ditambahkan kolom `branch_id` jika menggunakan opsi 1 database).

#### [NEW] `drizzle.config.ts`
Konfigurasi migrasi Drizzle untuk Cloudflare D1.

#### [MODIFY] `src/lib/services/dataService.ts`
Menghapus pemanggilan `this.supabase.from(...)`. Mengubah semua operasi CRUD agar memanggil endpoint lokal (`fetch('/api/...')`) atau langsung menggunakan binding `platform.env.DB` + Drizzle ORM jika dijalankan di sisi server.

#### [DELETE] `src/lib/database/supabaseClient.ts`
Dihapus sepenuhnya. Koneksi klien database langsung dari sisi frontend sudah tidak relevan (tidak aman). Semua akses DB pindah ke `+server.ts` (API routes).

---
### 2. Realtime (Ably)
Mengganti Supabase Realtime dengan Ably WebSocket.

#### [NEW] `src/routes/api/ably-token/+server.ts`
Endpoint untuk men-generate signed `TokenRequest` dari sisi Edge Worker menggunakan Rahasia `ABLY_API_KEY`. Aman karena API Key asli tidak pernah dikirim ke frontend.

#### [NEW] `src/lib/realtime/ablyClient.ts`
Menginisialisasi Ably SDK di browser menggunakan fitur JWT auth (`authUrl: '/api/ably-token'`). Menyediakan listener pengganti `supabase.channel(...)`.

#### [MODIFY] `src/lib/services/dataService.ts`
Fungsi `subscribeToRealtimeData` dimodifikasi untuk menggunakan langganan channel Ably. Backend API yang memutasi DB wajib mem-publish notifikasi ke channel Ably.

---
### 3. Storage (R2)
Mengganti Supabase Storage bucket.

#### [NEW] `src/lib/server/s3Client.ts`
Menggunakan `@aws-sdk/client-s3` untuk interaksi dengan Cloudflare R2 (R2 mendukung S3 API) di sisi edge server.

#### [MODIFY] `src/routes/api/upload/+server.ts` (Atau endpoint upload baru)
Menerima FormData gambar produk, mengunggah langsung ke Cloudflare R2 via S3 Client, lalu menyimpan Public URL-nya ke D1.

---
### 4. Konfigurasi Cloudflare & SvelteKit
Adaptasi framework ke lingkungan Cloudflare.

#### [MODIFY] `wrangler.jsonc`
- Tambahkan binding untuk D1 (`[[d1_databases]]`).
- Tambahkan binding untuk R2 (`[[r2_buckets]]`).
- Deklarasi Secrets (`ABLY_API_KEY`).

#### [MODIFY] `package.json`
- `npm uninstall @supabase/supabase-js`
- `npm install ably drizzle-orm @aws-sdk/client-s3`
- `npm install -D drizzle-kit @types/better-sqlite3 wrangler`

## Verification Plan

### Automated Tests
- Menjalankan `npm run lint` & `npm run check` untuk memverifikasi tipe Drizzle dan penghapusan `@supabase/supabase-js`.
- Menjalankan `npm run build` untuk memastikan adapter Cloudflare berhasil merakit SvelteKit dan env bindings tidak bermasalah.

### Manual Verification
1. **D1 Test:** Membuat entri POS lokal via UI ➡️ Cek perubahan di lokal `.wrangler/state/v3/d1` (database emulasi).
2. **Ably Test:** Membuka 2 tab browser ➡️ Menambahkan transaksi di Tab 1 ➡️ Pastikan Tab 2 UI diperbarui instan melalui Ably Realtime tanpa reload.
3. **R2 Test:** Upload gambar produk ➡️ Verifikasi gambar dapat diakses publik melalui domain Cloudflare R2.
