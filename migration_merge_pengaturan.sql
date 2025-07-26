-- Migration script untuk menggabungkan tabel pengaturan_keamanan dan pengaturan_struk
-- menjadi satu tabel 'pengaturan'

-- 1. Buat tabel baru 'pengaturan' jika belum ada
CREATE TABLE IF NOT EXISTS pengaturan (
  id SERIAL PRIMARY KEY,
  -- Keamanan (dari pengaturan_keamanan)
  pin VARCHAR(10) DEFAULT '1234',
  locked_pages TEXT[] DEFAULT ARRAY['laporan', 'beranda'],
  -- Struk (dari pengaturan_struk)
  nama_toko VARCHAR(100) DEFAULT 'Zatiaras Juice',
  alamat TEXT DEFAULT 'Jl. Contoh Alamat No. 123, Kota',
  telepon VARCHAR(20) DEFAULT '0812-3456-7890',
  instagram VARCHAR(50) DEFAULT '@zatiarasjuice',
  ucapan TEXT DEFAULT 'Terima kasih sudah ngejus di\nZatiaras Juice!',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Pastikan ada minimal 1 row di tabel pengaturan
INSERT INTO pengaturan (id, pin, locked_pages, nama_toko, alamat, telepon, instagram, ucapan)
VALUES (1, '1234', ARRAY['laporan', 'beranda'], 'Zatiaras Juice', 'Jl. Contoh Alamat No. 123, Kota', '0812-3456-7890', '@zatiarasjuice', 'Terima kasih sudah ngejus di\nZatiaras Juice!')
ON CONFLICT (id) DO NOTHING;

-- 3. Migrasi data dari pengaturan_keamanan (jika ada)
UPDATE pengaturan 
SET 
  pin = COALESCE((SELECT pin FROM pengaturan_keamanan LIMIT 1), '1234'),
  locked_pages = COALESCE((SELECT locked_pages FROM pengaturan_keamanan LIMIT 1), ARRAY['laporan', 'beranda'])
WHERE id = 1;

-- 4. Migrasi data dari pengaturan_struk (jika ada)
UPDATE pengaturan 
SET 
  nama_toko = COALESCE((SELECT nama_toko FROM pengaturan_struk LIMIT 1), 'Zatiaras Juice'),
  alamat = COALESCE((SELECT alamat FROM pengaturan_struk LIMIT 1), 'Jl. Contoh Alamat No. 123, Kota'),
  telepon = COALESCE((SELECT telepon FROM pengaturan_struk LIMIT 1), '0812-3456-7890'),
  instagram = COALESCE((SELECT instagram FROM pengaturan_struk LIMIT 1), '@zatiarasjuice'),
  ucapan = COALESCE((SELECT ucapan FROM pengaturan_struk LIMIT 1), 'Terima kasih sudah ngejus di\nZatiaras Juice!')
WHERE id = 1;

-- 5. Set sequence untuk id agar dimulai dari 1
SELECT setval('pengaturan_id_seq', 1, false);

-- Catatan: Setelah memastikan aplikasi berjalan normal, Anda bisa menghapus tabel lama:
-- DROP TABLE IF EXISTS pengaturan_keamanan;
-- DROP TABLE IF EXISTS pengaturan_struk; 