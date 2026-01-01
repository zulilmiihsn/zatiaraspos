# Dokumentasi Fitur & Spesifikasi Teknis Zatiaras POS (v2 - Rebuild Basis)

Dokumen ini berisi analisis lengkap fitur, teknologi, dan fungsionalitas aplikasi Zatiaras POS sebagai acuan untuk proses rebuild/refactoring.

## 1. Core Tech Stack & Tools (Eksisting)
Pondasi teknis aplikasi saat ini:
- **Framework**: SvelteKit (Fullstack framework).
- **Language**: TypeScript.
- **Database**: Supabase (PostgreSQL).
- **Styling**: TailwindCSS.
- **Icons**: Lucide Svelte.
- **State Management**: Svelte Stores (`writable`).
- **Local Storage/Caching**: `idb-keyval` (IndexedDB Wrapper), `localStorage`.
- **Realtime**: Supabase Realtime.
- **PWA**: `@vite-pwa/sveltekit`.
- **Animations**: Lottie & Svelte Transition/Motion.

## 2. Fitur Fungsional (Functional Requirements)

### A. Autentikasi & Keamanan
- **Login**: Username/Password dengan Rate Limiting.
- **RBAC (Role-Based Access Control)**:
  - **Pemilik**: Akses penuh (Settings, Reports, Edit Menu).
  - **Kasir**: Akses terbatas (POS, Catat Transaksi).
- **Session Management**: Persistent session dengan Supabase Auth.
- **PIN Protection**: Proteksi halaman sensitif (Laporan/Pengaturan) dengan PIN.

### B. POS (Point of Sales)
- **Katalog Produk**:
  - Grid View responsif.
  - Kategori & Filter.
  - **Add-Ons**: Topping berbayar.
  - **Varian**: Opsi (Gula, Es) tanpa/dengan harga kustom.
  - **Fuzzy Search**: Pencarian produk toleran typo.
- **Keranjang (Cart)**:
  - Grouping item identik.
  - Quantity control & Delete gesture.
  - Kalkulasi Realtime: Subtotal, Pajak, Diskon.
- **Checkout**:
  - Tipe Order: Dine-in / Take-away.
  - Metode Bayar: Tunai (dengan quick cash buttons), QRIS, Transfer.
  - Kalkulator Kembalian.
  - **Offline Transaction**: Simpan lokal jika internet mati, auto-sync saat online.

### C. Manajemen Menu (Backoffice)
- **CRUD Operations**: Tambah/Edit/Hapus Produk, Kategori, dan Add-Ons.
- **Mobile UX**: Swipe gestures untuk hapus/edit.
- **Media**: Upload foto produk ke Supabase Storage.

### D. Laporan & Analitik (Business Intelligence)
- **Dashboard**: Omzet harian, Breakdown metode bayar, Grafik tren.
- **Laba Rugi (P&L)**: Analisis pendapatan vs pengeluaran operasional.
- **AI Analysis**:
  - **Natural Language Query**: Tanya jawab data laporan ("Berapa omzet kemarin?").
  - **Smart Input**: Input pengeluaran via cerita ("Beli gas 20rb") -> Parsed by AI.
  - **Insights**: Rekomendasi bisnis otomatis.

### E. Pencatatan Manual (Buku Kas)
- **Buku Kas**: Catat Pemasukan/Pengeluaran non-POS.
- **Smart Recorder**: Input transaksi operasional menggunakan AI parsing text.

## 3. Fitur Teknis Lanjutan (Non-Functional)
- **Multi-Branch**: Arsitektur multi-tenant (Cabang Samarinda, Berau, dll).
- **Smart Caching**:
  - Preload data kritikal.
  - Invalidate cache otomatis saat ada update (supaya data real-time).
- **Offline First**: Aplikasi berfungsi penuh tanpa internet (kecuali login awal).

## 4. Rencana Peningkatan (Rebuild Focus)
Area arsitektural yang perlu diperbaiki saat rebuild:
1.  **Refactor "God Store"**: Hapus hardcoded multi-tenancy di client. Pindah ke dynamic config.
2.  **Modern Caching**: Ganti manual caching (`DataService`) dengan library standar (TanStack Query).
3.  **Server-Side Logic**: Pindahkan kalkulasi uang/laporan ke Backend/API Routes untuk keamanan dan performa.
4.  **Component Splitting**: Pecah file UI raksasa (`pos/+page.svelte`) menjadi komponen-komponen kecil (Atomic Design).
