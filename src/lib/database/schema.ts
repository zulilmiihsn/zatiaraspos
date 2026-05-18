import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Semua tabel ditambahkan 'branch_id' untuk arsitektur 1 DB Global (Multi-tenant)

export const profil = sqliteTable('profil', {
	id: text('id').primaryKey(),
	branch_id: text('branch_id').notNull(),
	role: text('role').notNull(),
	username: text('username').notNull(),
	nama_lengkap: text('nama_lengkap'),
	created_at: text('created_at').default(new Date().toISOString())
});

export const produk = sqliteTable('produk', {
	id: text('id').primaryKey(),
	branch_id: text('branch_id').notNull(),
	name: text('name').notNull(),
	harga: real('harga').notNull(),
	stok: integer('stok').default(0),
	gambar: text('gambar'),
	kategori_id: text('kategori_id'),
	created_at: text('created_at').default(new Date().toISOString())
});

export const kategori = sqliteTable('kategori', {
	id: text('id').primaryKey(),
	branch_id: text('branch_id').notNull(),
	nama: text('nama').notNull(),
	created_at: text('created_at').default(new Date().toISOString())
});

export const tambahan = sqliteTable('tambahan', {
	id: text('id').primaryKey(),
	branch_id: text('branch_id').notNull(),
	nama: text('nama').notNull(),
	harga: real('harga').notNull(),
	created_at: text('created_at').default(new Date().toISOString())
});

export const bukuKas = sqliteTable('buku_kas', {
	id: text('id').primaryKey(),
	branch_id: text('branch_id').notNull(),
	waktu: text('waktu').notNull(),
	sumber: text('sumber').notNull(), // 'pos', 'catat'
	tipe: text('tipe').notNull(), // 'in', 'out'
	jenis: text('jenis').notNull(), // 'pendapatan_usaha', 'beban_usaha', 'lainnya'
	amount: real('amount').notNull(),
	description: text('description'),
	payment_method: text('payment_method'),
	transaction_id: text('transaction_id')
});

export const transaksiKasir = sqliteTable('transaksi_kasir', {
	id: text('id').primaryKey(),
	branch_id: text('branch_id').notNull(),
	buku_kas_id: text('buku_kas_id').notNull(),
	produk_id: text('produk_id'),
	custom_name: text('custom_name'),
	qty: integer('qty').notNull(),
	amount: real('amount').notNull(),
	created_at: text('created_at').default(new Date().toISOString())
});

export const pengaturan = sqliteTable('pengaturan', {
	id: integer('id').primaryKey(),
	branch_id: text('branch_id').notNull(),
	pin: text('pin').default('1234'),
	locked_pages: text('locked_pages'), // JSON array stored as text
	nama_toko: text('nama_toko'),
	alamat: text('alamat'),
	telepon: text('telepon'),
	instagram: text('instagram'),
	ucapan: text('ucapan')
});

export const sesiToko = sqliteTable('sesi_toko', {
	id: text('id').primaryKey(),
	branch_id: text('branch_id').notNull(),
	opening_cash: real('opening_cash').notNull(),
	opening_time: text('opening_time').notNull(),
	closing_time: text('closing_time'),
	is_active: integer('is_active', { mode: 'boolean' }).default(true),
	created_at: text('created_at').default(new Date().toISOString())
});
