INSERT INTO profil (id,branch_id,role,username,password,nama_lengkap)
SELECT 'prod-pemilik-berau','berau','pemilik','pemilik','$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy','Pemilik berau'
WHERE NOT EXISTS (SELECT 1 FROM profil WHERE branch_id='berau' AND username='pemilik');
INSERT INTO profil (id,branch_id,role,username,password,nama_lengkap)
SELECT 'prod-kasir-berau','berau','kasir','kasir','$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy','Kasir berau'
WHERE NOT EXISTS (SELECT 1 FROM profil WHERE branch_id='berau' AND username='kasir');
INSERT INTO pengaturan (id,branch_id,pin,locked_pages,nama_toko)
SELECT 910005,'berau','1234','["laporan","beranda","pengaturan","catat"]','Zatiaras Berau'
WHERE NOT EXISTS (SELECT 1 FROM pengaturan WHERE branch_id='berau');
