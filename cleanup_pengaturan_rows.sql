-- Script untuk membersihkan row yang tidak diperlukan di tabel pengaturan
-- Pastikan hanya ada 1 row dengan id=1

-- 1. Hapus semua row kecuali yang pertama (id=1)
DELETE FROM pengaturan WHERE id != 1;

-- 2. Pastikan ada row dengan id=1
INSERT INTO pengaturan (id, pin, locked_pages, nama_toko, alamat, telepon, instagram, ucapan)
VALUES (1, '1234', ARRAY['laporan', 'beranda'], 'Zatiaras Juice', 'Jl. Contoh Alamat No. 123, Kota', '0812-3456-7890', '@zatiarasjuice', 'Terima kasih sudah ngejus di\nZatiaras Juice!')
ON CONFLICT (id) DO NOTHING;

-- 3. Set sequence agar dimulai dari 1
SELECT setval('pengaturan_id_seq', 1, false);

-- 4. Verifikasi bahwa hanya ada 1 row
SELECT COUNT(*) as total_rows FROM pengaturan;
SELECT * FROM pengaturan WHERE id = 1; 