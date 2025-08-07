
# Panduan Refactoring Proyek ZatiarasPOS

Dokumen ini berisi analisis lengkap, arsitektur, dan rencana refactoring untuk proyek ZatiarasPOS. Tujuannya adalah untuk meningkatkan kualitas kode internal, performa, dan maintainability tanpa mengubah fungsionalitas yang sudah ada.

---

### **PERINGATAN PENTING**

Selama proses refactoring, **TIDAK BOLEH ADA PERUBAHAN** pada fungsionalitas yang sudah ada dari perspektif pengguna. UI/UX harus tetap identik. Alur kerja aplikasi tidak boleh diubah. Tujuan utama refactoring ini adalah internal (kualitas kode, performa, maintainability) bukan eksternal (fitur baru). Pastikan tidak ada error baru (regresi) yang muncul setelah setiap task selesai.

---

## 1. Daftar Fitur Aplikasi & Cara Kerja

Aplikasi ini adalah sistem Point of Sale (POS) yang dirancang untuk bisnis minuman dengan dukungan online dan offline.

### Fitur Utama:

*   **Dashboard (Beranda):**
    *   **Online:** Menampilkan metrik real-time seperti omzet, jumlah transaksi, dan item terjual untuk hari ini. Menampilkan grafik pendapatan 7 hari terakhir dan daftar menu terlaris. Status toko (buka/tutup) disinkronkan dengan server.
    *   **Offline:** Menampilkan data terakhir yang di-cache dari IndexedDB. Grafik dan metrik mungkin tidak up-to-date.

*   **Point of Sale (POS):**
    *   **Online:** Menampilkan daftar produk dan kategori dari database. Pengguna dapat menambahkan item ke keranjang, memilih tambahan (add-ons), dan memproses pembayaran. Transaksi langsung dikirim ke server.
    *   **Offline:** Daftar produk dan kategori diambil dari cache. Transaksi yang dibuat akan disimpan dalam antrean lokal (IndexedDB). Notifikasi akan muncul untuk menandakan adanya transaksi yang tertunda.

*   **Catat Transaksi Manual:**
    *   **Online:** Memungkinkan pengguna (biasanya pemilik) untuk mencatat pemasukan atau pengeluaran di luar transaksi POS. Data langsung disimpan ke server.
    *   **Offline:** Fungsionalitas ini kemungkinan besar terbatas atau tidak tersedia saat offline karena memerlukan pencatatan langsung ke `buku_kas`.

*   **Laporan:**
    *   **Online:** Menghasilkan laporan keuangan (pemasukan, pengeluaran, laba/rugi) berdasarkan rentang tanggal (harian, mingguan, bulanan).
    *   **Offline:** Data laporan yang sebelumnya pernah dibuka akan tersedia dari cache. Membuat laporan untuk rentang tanggal baru tidak akan berfungsi.

*   **Manajemen & Pengaturan:**
    *   **Online:** Pemilik dapat mengelola produk, kategori, dan tambahan. Pengguna juga dapat mengatur keamanan seperti PIN untuk kasir.
    *   **Offline:** Tidak tersedia. Manajemen data memerlukan koneksi langsung ke database.

*   **Otentikasi & Multi-peran:**
    *   **Online:** Pengguna login dengan peran yang berbeda (misalnya, `pemilik`, `kasir`). Aplikasi membatasi akses ke fitur tertentu berdasarkan peran.
    *   **Offline:** Sesi login yang ada tetap aktif (tersimpan di `localStorage`), tetapi login atau logout baru tidak dapat dilakukan.

---

## 2. Arsitektur Proyek & Alur Data

**Teknologi Inti:** SvelteKit, TypeScript, TailwindCSS, Supabase (Database & Auth), VitePWA.

### Struktur Proyek:

*   `src/routes`: Berbasis file-routing. Setiap folder mendefinisikan sebuah halaman atau API endpoint.
*   `src/lib`: Jantung aplikasi, berisi semua logika inti yang dapat digunakan kembali.
    *   `database/`: Mengelola koneksi ke Supabase.
    *   `services/`: Lapisan layanan (`DataService`) yang menjadi perantara antara UI dan sumber data (cache/API).
    *   `stores/`: Global state management menggunakan Svelte Stores (misal: `userRole`, `selectedBranch`).
    *   `utils/`: Berisi fungsi-fungsi pembantu seperti `cache.ts` (logika caching canggih), `security.ts`, dan `validation.ts`.
    *   `components/`: Komponen Svelte yang digunakan di banyak halaman.

### Alur Data (Data Flow):

1.  **Online Flow:**
    *   Komponen UI (misalnya, `+page.svelte`) memanggil fungsi dari `DataService`.
    *   `DataService` pertama-tama memeriksa `SmartCache` (`cache.ts`).
    *   Jika data ada di cache dan masih valid, data dikembalikan langsung ke UI.
    *   Jika tidak, `DataService` menggunakan `SupabaseClient` untuk mengambil data dari database Supabase.
    *   Data yang diterima dari Supabase disimpan di `SmartCache` (Memory & IndexedDB) lalu dikirim ke UI untuk ditampilkan.
    *   **Real-time:** Supabase mengirimkan pembaruan melalui WebSocket. `RealtimeManager` menangkapnya, menginvalidasi cache yang relevan, dan memicu pengambilan data baru, sehingga UI selalu terbarui.

2.  **Offline Flow:**
    *   Saat membuat transaksi (mutasi), data tidak dikirim ke server. Sebaliknya, data disimpan dalam antrean di IndexedDB melalui `offline.ts`.
    *   Saat membaca data (query), `DataService` akan mengambil data dari cache IndexedDB.
    *   Ketika koneksi internet pulih, `syncPendingTransactions` secara otomatis dipicu untuk mengirim semua transaksi dalam antrean ke Supabase.

---

## 3. Rencana Task Refactoring

Rencana ini disusun secara bertahap untuk meminimalkan risiko dan memastikan stabilitas di setiap langkah.

### **Tahap 1: Pembersihan Inti & Penguatan Keamanan (Fondasi)**

Tujuan: Membersihkan kode sisa, memperkuat keamanan, dan memastikan penanganan error yang andal.

*   **Task 1.1 (Auth):** Refactor `src/lib/auth/auth.ts` **[Selesai]**
    *   Hapus objek `DUMMY_CREDENTIALS` dan logika login terkait.
    *   Hapus fungsi `logout` yang terduplikasi.
    *   Pastikan hanya ada satu alur otentikasi yang jelas yang menggunakan endpoint `/api/verify-login`.
*   **Task 1.2 (Keamanan):** Refactor `src/lib/utils/security.ts` **[Selesai]**
    *   Ganti implementasi `validateCSRFToken` yang "dummy" dengan logika nyata (misalnya, token yang disimpan di store/sesi).
    *   Tambahkan komentar pada fungsi `logSecurityEvent` untuk menandai bahwa ini harus diintegrasikan dengan layanan logging eksternal di masa depan.
*   **Task 1.3 (Error Handling):** Terapkan penanganan error yang konsisten. **[Selesai]**
    *   Periksa semua blok `try...catch` di `DataService` dan `+layout.svelte`.
    *   Ganti `console.error` atau blok `catch` yang kosong dengan panggilan ke utilitas `handleError` yang sudah ada.

### **Tahap 2: Optimasi Performa & Alur Data**

Tujuan: Mengatasi masalah performa kritis dan membuat alur data lebih efisien.

*   **Task 2.1 (Prefetching):** Refactor strategi prefetching di `src/routes/+layout.svelte`.
    *   Hapus fungsi `prefetchAllData` yang terlalu agresif.
    *   Gantilah dengan strategi yang lebih ringan: hanya prefetch data esensial saat startup (misalnya, produk & kategori).
*   **Task 2.2 (API Efficiency):** Analisis dan beri catatan pada `getReportData` di `DataService`.
    *   Tambahkan komentar di dalam fungsi yang menjelaskan potensi masalah N+1 query dan sarankan penggunaan *database view* atau *function* di Supabase sebagai solusi jangka panjang.

### **Tahap 3: Refactoring Komponen & Manajemen State (Maintainability)**

Tujuan: Mengurangi kompleksitas, meningkatkan keterbacaan, dan membuat kode lebih mudah dipelihara.

*   **Task 3.1 (Pemisahan Komponen):** Refactor `src/routes/+page.svelte`.
    *   Buat komponen baru di `src/lib/components/dashboard/`:
        *   `DashboardMetrics.svelte`
        *   `BestSellersList.svelte`
        *   `WeeklyIncomeChart.svelte`
        *   `TokoStatusControl.svelte`
    *   Pindahkan markup dan logika yang relevan dari `+page.svelte` ke komponen-komponen baru ini.
*   **Task 3.2 (Manajemen State):** Bersihkan penggunaan state global.
    *   Hapus penggunaan properti `window` global (`window.refreshDashboardData`, `window.tokoAktif`) di `+page.svelte`.
    *   Gunakan Svelte Stores atau Context API untuk komunikasi antar komponen jika diperlukan.
*   **Task 3.3 (Sentralisasi State):** Pusatkan inisialisasi sesi.
    *   Pastikan validasi sesi pengguna dan pengisian `userRole` store terjadi secara terpusat di `+layout.svelte` untuk menghindari *race conditions*.

---

## 4. Panduan & Alur Kerja untuk AI

Untuk memastikan proses refactoring berjalan lancar dan terkontrol, ikuti alur kerja berikut:

1.  **Pilih Satu Task:** Saya akan memilih satu task dari rencana di atas, dimulai dari **Task 1.1**.
2.  **Eksekusi Task:** Saya akan fokus mengerjakan hanya task yang dipilih.
3.  **Berikan Ringkasan Perubahan:** Setelah selesai, saya akan memberikan ringkasan singkat dan jelas tentang file apa saja yang saya ubah dan apa inti perubahannya.
4.  **Berikan Instruksi Testing:** Saya akan memberikan instruksi spesifik tentang cara menguji area yang baru saja saya refactor untuk memastikan tidak ada regresi dan fungsionalitas tetap sama.
5.  **Tunggu Konfirmasi:** Saya akan berhenti dan menunggu konfirmasi dari Anda untuk melanjutkan ke task berikutnya.
