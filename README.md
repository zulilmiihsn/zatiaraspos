# 🍹 ZatiarasPOS

**Zatiaras POS** adalah aplikasi Point of Sale (POS) modern yang dirancang khusus untuk bisnis retailnya Zatiaras dengan fitur multi-branch yang powerful.

## ✨ Tentang Aplikasi

ZatiarasPOS dibuat untuk menjadi solusi lengkap untuk mengelola operasional usaha Zatiaras dengan interface yang user-friendly dan fitur yang komprehensif. Aplikasi ini dibangun dengan teknologi modern untuk memberikan pengalaman terbaik bagi kasir, manajer, dan pemilik bisnis.

## 🎯 Fitur Utama

### 🏠 Dashboard & Analytics

- **Metrik Real-time**: Omzet, transaksi, item terjual, profit
- **Grafik Pendapatan**: Visualisasi 7 hari terakhir dengan animasi
- **Menu Terlaris**: Ranking produk dengan statistik penjualan
- **Statistik WITA**: Analisis berdasarkan waktu Indonesia Tengah

### 💰 Point of Sale (POS)

- Interface kasir yang intuitif dan responsif
- Pencarian produk dengan fuzzy search
- Manajemen cart dengan kalkulasi otomatis
- Multiple payment methods (Tunai/Non-tunai)
- Real-time inventory synchronization

### 📊 Sistem Transaksi

- **Buka/Tutup Toko**: Manajemen sesi dengan modal awal
- Pencatatan pemasukan & pengeluaran
- Kategorisasi transaksi (Usaha/Lainnya)
- Offline support dengan pending transactions

### 📈 Laporan & Analytics

- Laporan harian dan multi-day
- Filter berdasarkan tanggal WITA
- Breakdown pemasukan & pengeluaran
- Analisis profit & laba
- Real-time report updates

### ⚙️ Manajemen Sistem

- **Keamanan**: PIN protection, role-based access
- **Menu Management**: Pengaturan produk dan kategori
- **Printer Settings**: Konfigurasi printer
- **Branch Management**: Multi-cabang support

## 🏗️ Arsitektur Teknologi

### Frontend

- **SvelteKit 5.0** - Framework modern dengan performa tinggi
- **TypeScript** - Type safety dan developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **PWA Support** - Installable dengan offline capabilities

### Backend & Database

- **Cloudflare Pages** - Edge SSR via SvelteKit `adapter-cloudflare`
- **Cloudflare D1** - Database SQLite di edge, **di-shard per grup cabang** (3 DB terpisah: samarinda/balikpapan/berau)
- **Cloudflare R2** - Penyimpanan gambar produk (disajikan via proxy same-origin `/api/upload?key=...`, di-cache 1 tahun)
- **Durable Objects** - Realtime (WebSocket Hibernation) + rate limiting akurat lintas-isolate
- **Drizzle ORM** - Query type-safe + generate migration; diterapkan via `wrangler d1 execute`
- **Custom Auth System** - Sesi cookie (httpOnly, SameSite=Lax) + PIN, terisolasi per cabang
- **Laporan via tabel agregat harian** - `daily_sales_summary` / `daily_product_sales` diisi saat checkout → laporan cepat tanpa scan transaksi mentah

### Performance & Security

- **Smart Caching** - Multi-layer caching system
- **Real-time Updates** - Live synchronization
- **Security Middleware** - XSS protection, rate limiting
- **Input Validation** - Sanitasi dan validasi data

## 🎨 Design & UX

- **Mobile-First Design** - Optimized untuk perangkat mobile
- **Touch Gestures** - Swipe navigation, long press insights
- **Smooth Animations** - Transisi yang halus dan engaging
- **Responsive Layout** - Adaptif untuk berbagai ukuran layar
- **Accessibility** - Keyboard navigation dan screen reader support

## 🚀 Keunggulan

- **Multi-Branch Ready** - Support untuk multiple cabang
- **Offline Capability** - Bisa beroperasi tanpa internet
- **Real-time Sync** - Data selalu up-to-date
- **Performance Optimized** - Caching dan optimization
- **Security First** - Keamanan tingkat enterprise
- **User Experience** - Interface yang intuitif dan mudah digunakan

## 🎭 Target Pengguna

- **Kasir** - Interface yang simple dan cepat
- **Manajer** - Laporan dan analisis yang detail
- **Pemilik** - Overview bisnis yang komprehensif
- **Admin** - Manajemen sistem yang powerful

## 🛠️ Catatan Teknis & Perbaikan Mendatang

Status arsitektur saat ini: type-safe (`svelte-check` 0 error), checkout idempoten, rate limiting **fail-closed**, laporan dibaca dari tabel agregat harian, dan **satu field kanonik `amount`** di `buku_kas` (kolom `nominal` redundan sudah dihapus, migrasi `0009`).

Perbaikan **opsional** (tidak mendesak — aplikasi sudah berfungsi & teruji):

- **Pecah god-endpoint `/api/data` menjadi resource routes per-tabel.**
  Saat ini satu endpoint men-dispatch berdasarkan `?table=`. Memecah menjadi route RESTful per-resource (mis. `/api/produk`, `/api/buku-kas`) lebih lazim & mudah dipelihara. Logikanya sudah dimodularisasi internal ke `src/lib/server/dataReadHandlers.ts` & `dataWriteHandlers.ts`, jadi tinggal pemisahan route-nya.

- **Otomasi migrasi 3-shard.** D1 di-shard menjadi 3 database (`DB_SAMARINDA_GROUP`, `DB_BALIKPAPAN_GROUP`, `DB_BERAU_GROUP`). Migrasi & backfill saat ini diterapkan manual ke tiap DB. Buat satu script yang menjalankan `wrangler d1 execute` untuk semua shard sekaligus (lokal `--local` & prod `--remote`) agar tidak ada DB yang terlewat.

## 🌟 Visi

Zatiaras POS hadir untuk mengubah cara bisnis retail dan restoran mengelola operasional mereka. Dengan teknologi modern dan design yang user-friendly, kami berkomitmen memberikan solusi POS terbaik yang memudahkan pengguna dalam menjalankan bisnis mereka.

---

\_Dibuat dengan ❤️ untuk Zatiaras
