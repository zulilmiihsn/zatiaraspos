INSERT INTO profil (id,branch_id,role,username,password,nama_lengkap)
SELECT 'prod-pemilik-balikpapan','balikpapan','pemilik','pemilik','$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy','Pemilik balikpapan'
WHERE NOT EXISTS (SELECT 1 FROM profil WHERE branch_id='balikpapan' AND username='pemilik');
INSERT INTO profil (id,branch_id,role,username,password,nama_lengkap)
SELECT 'prod-kasir-balikpapan','balikpapan','kasir','kasir','$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy','Kasir balikpapan'
WHERE NOT EXISTS (SELECT 1 FROM profil WHERE branch_id='balikpapan' AND username='kasir');
INSERT INTO pengaturan (id,branch_id,pin,locked_pages,nama_toko)
SELECT 910003,'balikpapan','1234','["laporan","beranda","pengaturan","catat"]','Zatiaras Balikpapan'
WHERE NOT EXISTS (SELECT 1 FROM pengaturan WHERE branch_id='balikpapan');
INSERT INTO profil (id,branch_id,role,username,password,nama_lengkap)
SELECT 'prod-pemilik-balikpapan2','balikpapan2','pemilik','pemilik','$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy','Pemilik balikpapan2'
WHERE NOT EXISTS (SELECT 1 FROM profil WHERE branch_id='balikpapan2' AND username='pemilik');
INSERT INTO profil (id,branch_id,role,username,password,nama_lengkap)
SELECT 'prod-kasir-balikpapan2','balikpapan2','kasir','kasir','$2b$10$ao/mv2wHSeOZdvuQj4bGLu8NT2CQiBUfbUcnmjXrb3Q2/BpEIPkAy','Kasir balikpapan2'
WHERE NOT EXISTS (SELECT 1 FROM profil WHERE branch_id='balikpapan2' AND username='kasir');
INSERT INTO pengaturan (id,branch_id,pin,locked_pages,nama_toko)
SELECT 910004,'balikpapan2','1234','["laporan","beranda","pengaturan","catat"]','Zatiaras Balikpapan2'
WHERE NOT EXISTS (SELECT 1 FROM pengaturan WHERE branch_id='balikpapan2');
