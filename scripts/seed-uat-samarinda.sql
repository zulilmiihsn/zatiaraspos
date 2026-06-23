INSERT INTO profil (
	id,
	branch_id,
	role,
	username,
	password,
	nama_lengkap
)
SELECT
	'uat-pemilik-samarinda',
	'samarinda',
	'pemilik',
	'pemilik',
	'$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy',
	'Pemilik UAT Samarinda'
WHERE NOT EXISTS (
	SELECT 1 FROM profil WHERE branch_id = 'samarinda' AND username = 'pemilik'
);

INSERT INTO profil (
	id,
	branch_id,
	role,
	username,
	password,
	nama_lengkap
)
SELECT
	'uat-kasir-samarinda',
	'samarinda',
	'kasir',
	'kasir',
	'$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy',
	'Kasir UAT Samarinda'
WHERE NOT EXISTS (
	SELECT 1 FROM profil WHERE branch_id = 'samarinda' AND username = 'kasir'
);

INSERT INTO pengaturan (
	id,
	branch_id,
	pin,
	locked_pages,
	nama_toko,
	alamat,
	telepon,
	instagram,
	ucapan
)
SELECT
	910001,
	'samarinda',
	'1234',
	'["laporan","beranda","pengaturan","catat"]',
	'Zatiaras UAT Samarinda',
	'Samarinda',
	'081234567890',
	'@zatiaras.uat',
	'Terima kasih'
WHERE NOT EXISTS (
	SELECT 1 FROM pengaturan WHERE branch_id = 'samarinda'
);

INSERT INTO kategori (
	id,
	branch_id,
	name,
	description,
	is_active
)
SELECT
	'uat-cat-minuman',
	'samarinda',
	'Minuman',
	'Kategori UAT',
	1
WHERE NOT EXISTS (
	SELECT 1 FROM kategori WHERE branch_id = 'samarinda' AND id = 'uat-cat-minuman'
);

INSERT INTO produk (
	id,
	branch_id,
	name,
	price,
	stok,
	kategori_id,
	tipe,
	deskripsi,
	ekstra_ids,
	is_active
)
SELECT
	'uat-produk-es-teh',
	'samarinda',
	'Es Teh UAT',
	10000,
	100,
	'uat-cat-minuman',
	'minuman',
	'Produk UAT',
	'[]',
	1
WHERE NOT EXISTS (
	SELECT 1 FROM produk WHERE branch_id = 'samarinda' AND id = 'uat-produk-es-teh'
);

INSERT INTO sesi_toko (
	id,
	branch_id,
	opening_cash,
	opening_time,
	is_active
)
SELECT
	'uat-sesi-samarinda',
	'samarinda',
	100000,
	CURRENT_TIMESTAMP,
	1
WHERE NOT EXISTS (
	SELECT 1 FROM sesi_toko WHERE branch_id = 'samarinda' AND is_active = 1
);
