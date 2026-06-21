INSERT INTO profil (id,branch_id,role,username,password,nama_lengkap)
SELECT 'prod-pemilik-samarinda2','samarinda2','pemilik','pemilik','$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy','Pemilik samarinda2'
WHERE NOT EXISTS (SELECT 1 FROM profil WHERE branch_id='samarinda2' AND username='pemilik');
INSERT INTO profil (id,branch_id,role,username,password,nama_lengkap)
SELECT 'prod-kasir-samarinda2','samarinda2','kasir','kasir','$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy','Kasir samarinda2'
WHERE NOT EXISTS (SELECT 1 FROM profil WHERE branch_id='samarinda2' AND username='kasir');
INSERT INTO pengaturan (id,branch_id,pin,locked_pages,nama_toko)
SELECT 910002,'samarinda2','1234','["laporan","beranda","pengaturan","catat"]','Zatiaras Samarinda2'
WHERE NOT EXISTS (SELECT 1 FROM pengaturan WHERE branch_id='samarinda2');
