# Setup AI Feature untuk Zatiaras POS

## Konfigurasi Environment

1. Buat file `.env` di root project dengan isi:
```env
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
NODE_ENV=development
```

2. Dapatkan API key dari:
   - Buka https://openrouter.ai/keys
   - Login dengan akun OpenRouter
   - Buat API key baru
   - Copy dan paste ke file `.env`

## Fitur AI Chat

- **Lokasi**: Halaman Laporan (`/laporan`)
- **Fungsi**: Menganalisis data laporan dan memberikan insight
- **Input**: Pertanyaan tentang data laporan
- **Output**: Jawaban AI dalam modal yang dapat ditutup

## Cara Penggunaan

1. Buka halaman Laporan
2. Scroll ke bawah untuk melihat input AI Chat
3. Ketik pertanyaan tentang data laporan
4. Tekan Enter atau klik tombol kirim
5. Modal akan muncul dengan jawaban AI
6. Tutup modal untuk membersihkan input

## Contoh Pertanyaan

- "Bagaimana performa penjualan hari ini?"
- "Produk apa yang paling laris?"
- "Berapa keuntungan bersih hari ini?"
- "Bagaimana tren penjualan minggu ini?"
- "Kategori mana yang memberikan pendapatan tertinggi?"

## Troubleshooting

- Pastikan API key sudah benar di file `.env`
- Restart development server setelah mengubah `.env`
- Cek console browser untuk error messages
- Pastikan koneksi internet stabil
- Pastikan API key OpenRouter masih aktif dan memiliki kredit
