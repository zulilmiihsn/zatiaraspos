# ZatiarasPOS

Aplikasi Point of Sale (POS) modern yang dibangun dengan SvelteKit, dirancang untuk mengelola transaksi, laporan, dan pengaturan bisnis dengan fokus pada pengalaman pengguna yang intuitif dan kemampuan offline yang tangguh.

## Fitur Utama

-   **Manajemen Transaksi**: Pencatatan penjualan yang cepat dan efisien.
-   **Manajemen Menu**: Kelola produk, kategori, dan tambahan dengan mudah.
-   **Laporan Keuangan**: Ringkasan pendapatan dan pengeluaran harian, mingguan, bulanan, dan tahunan.
-   **Mode Offline**: Fungsionalitas penuh bahkan tanpa koneksi internet, dengan sinkronisasi otomatis saat online kembali.
-   **Manajemen Pengguna**: Sistem peran (pemilik, kasir) dengan kontrol akses.
-   **Pengaturan Struk**: Kustomisasi detail struk penjualan.

## Tumpukan Teknologi

-   **Framework Frontend**: [SvelteKit](https://kit.svelte.dev/)
-   **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Database & Backend as a Service**: [Supabase](https://supabase.com/)
-   **Package Manager**: [pnpm](https://pnpm.io/)
-   **PWA**: [@vite-pwa/sveltekit](https://vite-pwa.netlify.app/frameworks/sveltekit)

## Memulai Proyek

Pastikan Anda telah menginstal [Node.js](https://nodejs.org/) (disarankan versi LTS) dan [pnpm](https://pnpm.io/installation).

1.  **Instal Dependensi**:

    ```bash
    pnpm install
    ```

2.  **Jalankan Server Pengembangan**:

    ```bash
    pnpm dev
    ```

    Aplikasi akan berjalan di `http://localhost:5173/`.

3.  **Buka di Browser**:

    Buka browser Anda dan navigasikan ke alamat di atas.

## Build untuk Produksi

Untuk membuat versi produksi aplikasi:

```bash
pnpm build
```

Hasil build akan berada di direktori `.svelte-kit/build` atau `build` (tergantung adapter).

Anda dapat melihat pratinjau build produksi dengan:

```bash
pnpm preview
```

## PWA (Progressive Web App)

Aplikasi ini dirancang sebagai PWA, yang memungkinkan pengalaman seperti aplikasi native, termasuk kemampuan offline yang kuat.

**Sangat disarankan untuk menginstal aplikasi ini ke perangkat Anda** untuk pengalaman terbaik dan untuk memastikan data transaksi offline tersimpan dengan aman.

### Cara Menginstal PWA:

-   **Di Browser Desktop (Chrome/Edge)**: Cari ikon `Install` (biasanya ikon monitor dengan panah ke bawah) di address bar browser Anda.
-   **Di Android (Chrome)**: Buka menu browser (tiga titik) dan pilih `Instal aplikasi` atau `Add to Home screen`.
-   **Di iOS (Safari)**: Gunakan tombol `Share` (ikon kotak dengan panah ke atas), lalu gulir ke bawah dan pilih `Add to Home Screen`.

## Skrip yang Berguna

-   `pnpm dev`: Menjalankan server pengembangan.
-   `pnpm build`: Membuat aplikasi untuk produksi.
-   `pnpm preview`: Melihat pratinjau build produksi secara lokal.
-   `pnpm check`: Menjalankan `svelte-check` untuk memeriksa error pada komponen Svelte.
-   `pnpm format`: Memformat kode menggunakan Prettier.
-   `pnpm lint`: Menjalankan ESLint untuk memeriksa masalah gaya kode.

## Kontribusi

Jika Anda ingin berkontribusi pada proyek ini, pastikan untuk:

1.  Mengikuti konvensi koding yang ada.
2.  Menjalankan `pnpm lint` dan `pnpm format` sebelum melakukan commit.
3.  Menggunakan TypeScript untuk semua kode baru.