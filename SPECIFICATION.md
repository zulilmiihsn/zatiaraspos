# Zatiaras Juice - Point of Sale (POS) System
## Spesifikasi Lengkap Proyek

> **Catatan Penting:**
> - **Target utama adalah PWA Mobile.** Seluruh desain dan komponen UI WAJIB berorientasi **mobile first** dan harus sebisa mungkin menyerupai aplikasi mobile native (Android/iOS), BUKAN sekadar web yang diresponsifkan. Layout, navigasi, interaksi, dan komponen seperti tombol, modal sheet, bottom navigation, serta gesture harus mengikuti pola aplikasi mobile modern. Tidak boleh ada elemen web yang terasa canggung di HP (misal: sidebar desktop, hover-only, dsb). Semua ukuran, padding, dan font dioptimalkan untuk layar sentuh.

---

### ## 1. Pilar Utama Proyek
- **Cepat:** Kode harus sangat efisien untuk berjalan lancar di HP Android entry-level.
- **Andal:** Implementasikan arsitektur **"Offline First"**. Aplikasi tidak boleh macet atau kehilangan data jika internet terputus.
- **Mudah Digunakan:** Antarmuka harus sangat intuitif, bersih, dan mengikuti alur kerja yang logis.

---

### ## 2. Stack Teknologi
- **Frontend:** Progressive Web App (PWA) menggunakan **SvelteKit**.
- **Backend & Database:** **Supabase** (menggunakan PostgreSQL).
- **Hosting PWA:** **Vercel** atau **Netlify**.

---

### ## 3. Desain & Pengalaman Pengguna (UI/UX)
- **Konsep:** **"Cerah & Segar"**, terinspirasi dari logo Zatiaras Juice.
- **Latar Belakang:** **Putih bersih (#FFFFFF)** untuk menciptakan kesan cerah.
- **Warna Aksen:** **Pink Cerah** (tombol utama), **Kuning Cerah**, dan **Hijau Segar** (notifikasi/highlight).
- **Teks:** **Abu-abu Tua (#333333)** untuk kenyamanan membaca.
- **Pola Interaksi Kasir:**
    - Antarmuka kasir utama harus memiliki area **"Menu Cepat"** untuk item terlaris yang bisa ditambahkan dengan satu sentuhan.
    - Pemilihan opsi tambahan (topping) harus menggunakan komponen **"Modal Sheet"** yang meluncur dari bawah layar untuk memberikan pengalaman *native*.

---

### ## 4. Spesifikasi Fungsional Detail

#### **4.1. Struktur Data (Tabel Supabase)**
```sql
-- Tabel Produk
products: 
- id (uuid, primary key)
- name (text, not null)
- price (decimal, not null) -- harga jual
- cost_price (decimal, not null) -- harga modal
- is_popular (boolean, default false) -- untuk menu cepat
- created_at (timestamp, default now)
- updated_at (timestamp, default now)

-- Tabel Add-ons/Topping
add_ons:
- id (uuid, primary key)
- name (text, not null)
- price (decimal, not null) -- harga tambahan
- category (text) -- kategori topping
- created_at (timestamp, default now)

-- Tabel Relasi Produk-Add-ons
product_add_ons:
- product_id (uuid, foreign key to products.id)
- add_on_id (uuid, foreign key to add_ons.id)
- primary key (product_id, add_on_id)

-- Tabel Pesanan
orders:
- id (uuid, primary key)
- total_amount (decimal, not null)
- payment_method (text, not null) -- 'tunai' atau 'qris'
- discount_amount (decimal, default 0)
- created_at (timestamp, default now)
- is_completed (boolean, default true)

-- Tabel Item Pesanan
order_items:
- id (uuid, primary key)
- order_id (uuid, foreign key to orders.id)
- product_id (uuid, foreign key to products.id)
- quantity (integer, not null)
- base_price (decimal, not null)
- total_price (decimal, not null)
- selected_add_ons (jsonb) -- array of add-on IDs
- created_at (timestamp, default now)

-- Tabel Transaksi Kas
cash_transactions:
- id (uuid, primary key)
- type (text, not null) -- 'pemasukan' atau 'pengeluaran'
- amount (decimal, not null)
- description (text)
- transaction_date (date, not null)
- created_at (timestamp, default now)

-- Tabel Sesi Toko
store_sessions:
- id (uuid, primary key)
- opening_cash (decimal, not null) -- modal awal
- opening_time (timestamp, not null)
- closing_time (timestamp)
- total_sales (decimal, default 0)
- total_cash_sales (decimal, default 0)
- total_qris_sales (decimal, default 0)
- is_active (boolean, default true)
- created_at (timestamp, default now)

-- Tabel Konfigurasi Sistem
system_config:
- id (uuid, primary key)
- auth_pin (text, not null) -- PIN 6-digit untuk akses terkunci
- store_name (text, default 'Zatiaras Juice')
- created_at (timestamp, default now)
- updated_at (timestamp, default now)
```

#### **4.2. Alur Kerja & Keamanan**
- **Mode Utama:** Aplikasi berjalan dalam **"Mode Kios"** di HP kasir, **tanpa login kasir** untuk memulai transaksi.
- **Siklus Harian:**
    - Dimulai dengan proses **"Buka Toko"** yang meminta input **Modal Awal**.
    - Diakhiri dengan proses **"Tutup Toko"** yang menampilkan ringkasan hari itu. Ringkasan ini harus secara eksplisit menampilkan kalkulasi: `(Modal Awal + Total Penjualan Tunai) = Total Uang Fisik Seharusnya`.
- **Sistem Akses:**
    1. **Akses Terbuka:** Transaksi penjualan normal.
    2. **Akses Terkunci (dilindungi PIN Otorisasi 6-digit):**
        - Memberi diskon manual (Rp).
        - Membatalkan transaksi.
        - Melihat Laporan Keuangan di HP Kasir.
        - Menjalankan proses "Tutup Toko".
    3. **Akses Pemilik (Login Email + Password):**
        - Mengelola Produk (CRUD, termasuk Harga Modal).
        - Mengelola Buku Kas Digital.
        - Mengubah PIN Otorisasi.
        - Mengakses semua fitur dari jarak jauh.

#### **4.3. Modul Keuangan & Laporan**
- **Dashboard Pemilik:** Saat Pemilik login, halaman utama harus menampilkan 3 kartu metrik utama secara *real-time* untuk hari ini:
    1. **Total Omzet.**
    2. **Total Item Terjual.**
    3. **Estimasi Keuntungan Kotor.**
- **Buku Kas Digital:** Fitur untuk Pemilik mencatat transaksi non-penjualan. Formulir input harus berisi: `Tanggal`, `Tipe` (Pemasukan/Pengeluaran), `Jumlah (Rp)`, dan `Keterangan`.
- **Laporan Laba Rugi:** Laporan dinamis yang menghitung `(Total Penjualan + Pemasukan Lain) - (Total Harga Modal + Pengeluaran Lain)`. Dapat difilter berdasarkan rentang tanggal.

---

### ## 5. Integrasi Perangkat Keras
- Aplikasi harus mendukung pencetakan struk ke **printer thermal** melalui koneksi **Bluetooth** menggunakan **Web Bluetooth API**

---

### ## 6. Fitur Offline-First
- **Service Worker:** Implementasi untuk caching data penting
- **IndexedDB:** Penyimpanan lokal untuk data produk, pesanan, dan konfigurasi
- **Sync Strategy:** Sinkronisasi otomatis saat koneksi internet tersedia
- **Conflict Resolution:** Penanganan konflik data saat sinkronisasi

---

### ## 7. Struktur Folder Proyek
```
zatiaraspos/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── pos/
│   │   │   ├── admin/
│   │   │   └── shared/
│   │   ├── stores/
│   │   ├── utils/
│   │   └── database/
│   ├── routes/
│   │   ├── pos/
│   │   ├── admin/
│   │   └── api/
│   └── app.html
├── static/
├── package.json
├── svelte.config.js
├── vite.config.js
└── SPECIFICATION.md
```

---

### ## 8. Workflow Transaksi
1. **Buka Toko** → Input modal awal
2. **Transaksi Normal** → Pilih produk → Pilih topping (opsional) → Bayar
3. **Akses Terkunci** → PIN → Fitur khusus (diskon, batal, laporan)
4. **Tutup Toko** → Ringkasan harian → Konfirmasi tutup

---

### ## 9. Keamanan & Validasi
- **PIN Otorisasi:** 6-digit, dienkripsi
- **Validasi Input:** Semua input harus divalidasi
- **Error Handling:** Penanganan error yang graceful
- **Data Integrity:** Konsistensi data di semua operasi

---

### ## 10. Performance Requirements
- **Load Time:** < 3 detik pada koneksi 3G
- **Offline Capability:** 100% fungsional tanpa internet
- **Memory Usage:** < 100MB RAM
- **Battery Efficiency:** Optimized untuk penggunaan seharian 