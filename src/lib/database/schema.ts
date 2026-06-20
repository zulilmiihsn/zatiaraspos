import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = () => sql`CURRENT_TIMESTAMP`;

export const profil = sqliteTable(
	'profil',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		role: text('role').notNull(),
		username: text('username').notNull(),
		password: text('password').notNull(),
		nama_lengkap: text('nama_lengkap'),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [index('idx_profil_branch_username').on(table.branch_id, table.username)]
);

export const authSessions = sqliteTable(
	'auth_sessions',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		user_id: text('user_id').notNull(),
		username: text('username').notNull(),
		role: text('role').notNull(),
		created_at: integer('created_at').notNull(),
		expires_at: integer('expires_at').notNull()
	},
	(table) => [
		index('idx_auth_sessions_expires').on(table.expires_at),
		index('idx_auth_sessions_user').on(table.branch_id, table.user_id)
	]
);

export const produk = sqliteTable(
	'produk',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		name: text('name').notNull(),
		price: real('price').notNull(),
		harga: real('harga'),
		stok: integer('stok').default(0),
		track_stock: integer('track_stock', { mode: 'boolean' }).default(false),
		track_ingredients: integer('track_ingredients', { mode: 'boolean' }).default(false),
		gambar: text('gambar'),
		category_id: text('category_id'),
		kategori_id: text('kategori_id'),
		tipe: text('tipe').default('minuman'),
		deskripsi: text('deskripsi'),
		ekstra_ids: text('ekstra_ids', { mode: 'json' }).$type<Array<string | number>>().default([]),
		is_active: integer('is_active', { mode: 'boolean' }).default(true),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [
		index('idx_produk_branch_created').on(table.branch_id, table.created_at),
		index('idx_produk_branch_kategori').on(table.branch_id, table.kategori_id)
	]
);

export const bahan = sqliteTable(
	'bahan',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		name: text('name').notNull(),
		unit: text('unit').notNull().default('gram'),
		current_stock: real('current_stock').notNull().default(0),
		low_stock_threshold: real('low_stock_threshold').notNull().default(0),
		cost_per_unit: real('cost_per_unit').notNull().default(0),
		last_purchase_qty: real('last_purchase_qty').notNull().default(0),
		last_purchase_cost: real('last_purchase_cost').notNull().default(0),
		is_active: integer('is_active', { mode: 'boolean' }).default(true),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [
		index('idx_bahan_branch_created').on(table.branch_id, table.created_at),
		index('idx_bahan_branch_name').on(table.branch_id, table.name)
	]
);

export const hppSettings = sqliteTable(
	'hpp_settings',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		rent_monthly: real('rent_monthly').notNull().default(0),
		electricity_monthly: real('electricity_monthly').notNull().default(0),
		water_monthly: real('water_monthly').notNull().default(0),
		salary_monthly: real('salary_monthly').notNull().default(0),
		other_monthly: real('other_monthly').notNull().default(0),
		target_items_monthly: integer('target_items_monthly').notNull().default(1000),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [index('idx_hpp_settings_branch').on(table.branch_id)]
);

export const resepProduk = sqliteTable(
	'resep_produk',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		product_id: text('product_id').notNull(),
		bahan_id: text('bahan_id').notNull(),
		qty_per_item: real('qty_per_item').notNull(),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [
		index('idx_resep_produk_branch_product').on(table.branch_id, table.product_id),
		index('idx_resep_produk_branch_bahan').on(table.branch_id, table.bahan_id),
		uniqueIndex('idx_resep_produk_product_bahan').on(
			table.branch_id,
			table.product_id,
			table.bahan_id
		)
	]
);

export const bahanMutasi = sqliteTable(
	'bahan_mutasi',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		bahan_id: text('bahan_id').notNull(),
		quantity_delta: real('quantity_delta').notNull(),
		stock_after: real('stock_after'),
		source: text('source').notNull().default('manual'),
		reference_id: text('reference_id'),
		note: text('note'),
		created_by: text('created_by'),
		created_at: text('created_at').default(now())
	},
	(table) => [
		index('idx_bahan_mutasi_branch_created').on(table.branch_id, table.created_at),
		index('idx_bahan_mutasi_branch_bahan').on(table.branch_id, table.bahan_id)
	]
);

export const kategori = sqliteTable(
	'kategori',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		name: text('name').notNull(),
		nama: text('nama'),
		description: text('description'),
		is_active: integer('is_active', { mode: 'boolean' }).default(true),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [index('idx_kategori_branch_created').on(table.branch_id, table.created_at)]
);

export const tambahan = sqliteTable(
	'tambahan',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		name: text('name').notNull(),
		nama: text('nama'),
		price: real('price').notNull(),
		harga: real('harga'),
		is_active: integer('is_active', { mode: 'boolean' }).default(true),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [index('idx_tambahan_branch_created').on(table.branch_id, table.created_at)]
);

export const bukuKas = sqliteTable(
	'buku_kas',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		waktu: text('waktu').notNull(),
		sumber: text('sumber').notNull(),
		tipe: text('tipe').notNull(),
		jenis: text('jenis').notNull(),
		amount: real('amount').notNull(),
		nominal: real('nominal'),
		qty: integer('qty'),
		description: text('description'),
		customer_name: text('customer_name'),
		payment_method: text('payment_method'),
		transaction_id: text('transaction_id'),
		idempotency_key: text('idempotency_key'),
		id_sesi_toko: text('id_sesi_toko'),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [
		index('idx_buku_kas_branch_waktu').on(table.branch_id, table.waktu),
		index('idx_buku_kas_branch_waktu_id').on(table.branch_id, table.waktu, table.id),
		index('idx_buku_kas_branch_transaction').on(table.branch_id, table.transaction_id),
		index('idx_buku_kas_branch_sesi').on(table.branch_id, table.id_sesi_toko),
		uniqueIndex('idx_buku_kas_branch_idempotency').on(table.branch_id, table.idempotency_key)
	]
);

export const transaksiKasir = sqliteTable(
	'transaksi_kasir',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		buku_kas_id: text('buku_kas_id').notNull(),
		produk_id: text('produk_id'),
		custom_name: text('custom_name'),
		qty: integer('qty').notNull(),
		amount: real('amount').notNull(),
		price: real('price'),
		product_name: text('product_name'),
		base_price: real('base_price'),
		add_on_total: real('add_on_total').default(0),
		add_on_snapshot: text('add_on_snapshot'),
		sugar: text('sugar'),
		ice: text('ice'),
		note: text('note'),
		hpp_snapshot: text('hpp_snapshot'),
		hpp_amount: real('hpp_amount').default(0),
		transaction_id: text('transaction_id'),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [
		index('idx_transaksi_kasir_branch_created').on(table.branch_id, table.created_at),
		index('idx_transaksi_kasir_branch_created_id').on(
			table.branch_id,
			table.created_at,
			table.id
		),
		index('idx_transaksi_kasir_branch_transaction').on(table.branch_id, table.transaction_id),
		index('idx_transaksi_kasir_branch_buku').on(table.branch_id, table.buku_kas_id)
	]
);

export const dailySalesSummary = sqliteTable(
	'daily_sales_summary',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		sales_date: text('sales_date').notNull(),
		transaction_count: integer('transaction_count').notNull().default(0),
		item_count: integer('item_count').notNull().default(0),
		gross_sales: real('gross_sales').notNull().default(0),
		cash_sales: real('cash_sales').notNull().default(0),
		non_cash_sales: real('non_cash_sales').notNull().default(0),
		hpp_total: real('hpp_total').notNull().default(0),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [
		uniqueIndex('idx_daily_sales_branch_date').on(table.branch_id, table.sales_date),
		index('idx_daily_sales_branch_date_range').on(table.branch_id, table.sales_date)
	]
);

export const dailyProductSales = sqliteTable(
	'daily_product_sales',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		sales_date: text('sales_date').notNull(),
		product_id: text('product_id').notNull(),
		product_name: text('product_name').notNull(),
		qty: integer('qty').notNull().default(0),
		gross_sales: real('gross_sales').notNull().default(0),
		transaction_count: integer('transaction_count').notNull().default(0),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [
		uniqueIndex('idx_daily_product_sales_unique').on(
			table.branch_id,
			table.sales_date,
			table.product_id
		),
		index('idx_daily_product_sales_branch_date').on(table.branch_id, table.sales_date),
		index('idx_daily_product_sales_branch_product').on(table.branch_id, table.product_id)
	]
);

export const pengaturan = sqliteTable(
	'pengaturan',
	{
		id: integer('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		pin: text('pin').default('1234'),
		locked_pages: text('locked_pages', { mode: 'json' }).$type<string[]>().default([]),
		nama_toko: text('nama_toko'),
		alamat: text('alamat'),
		telepon: text('telepon'),
		instagram: text('instagram'),
		ucapan: text('ucapan'),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [index('idx_pengaturan_branch').on(table.branch_id)]
);

export const sesiToko = sqliteTable(
	'sesi_toko',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		opening_cash: real('opening_cash').notNull(),
		opening_time: text('opening_time').notNull(),
		closing_time: text('closing_time'),
		is_active: integer('is_active', { mode: 'boolean' }).default(true),
		created_at: text('created_at').default(now()),
		updated_at: text('updated_at').default(now())
	},
	(table) => [
		index('idx_sesi_toko_branch_active').on(table.branch_id, table.is_active),
		index('idx_sesi_toko_branch_opening').on(table.branch_id, table.opening_time)
	]
);

export const auditLogs = sqliteTable(
	'audit_logs',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		actor_user_id: text('actor_user_id'),
		actor_username: text('actor_username'),
		actor_role: text('actor_role'),
		action: text('action').notNull(),
		entity_type: text('entity_type').notNull(),
		entity_id: text('entity_id'),
		transaction_id: text('transaction_id'),
		amount: real('amount'),
		metadata: text('metadata'),
		ip_hash: text('ip_hash'),
		created_at: text('created_at').default(now())
	},
	(table) => [
		index('idx_audit_logs_branch_created').on(table.branch_id, table.created_at),
		index('idx_audit_logs_branch_action').on(table.branch_id, table.action),
		index('idx_audit_logs_branch_transaction').on(table.branch_id, table.transaction_id)
	]
);

export const rateLimits = sqliteTable(
	'rate_limits',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		identifier: text('identifier').notNull(),
		count: integer('count').notNull(),
		reset_at: integer('reset_at').notNull(),
		updated_at: integer('updated_at').notNull()
	},
	(table) => [
		index('idx_rate_limits_branch_identifier').on(table.branch_id, table.identifier),
		index('idx_rate_limits_reset').on(table.reset_at)
	]
);

export const errorEvents = sqliteTable(
	'error_events',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		source: text('source').notNull(),
		message: text('message').notNull(),
		stack: text('stack'),
		status: integer('status'),
		context: text('context'),
		user_id: text('user_id'),
		role: text('role'),
		created_at: text('created_at').default(now())
	},
	(table) => [
		index('idx_error_events_branch_created').on(table.branch_id, table.created_at),
		index('idx_error_events_branch_source').on(table.branch_id, table.source)
	]
);

export const requestMetrics = sqliteTable(
	'request_metrics',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		method: text('method').notNull(),
		path: text('path').notNull(),
		status: integer('status').notNull(),
		duration_ms: real('duration_ms').notNull(),
		db_meta: text('db_meta'),
		user_id: text('user_id'),
		role: text('role'),
		created_at: text('created_at').default(now())
	},
	(table) => [
		index('idx_request_metrics_branch_created').on(table.branch_id, table.created_at),
		index('idx_request_metrics_branch_path').on(table.branch_id, table.path)
	]
);

export const d1BackupRuns = sqliteTable(
	'd1_backup_runs',
	{
		id: text('id').primaryKey(),
		branch_id: text('branch_id').notNull(),
		database_name: text('database_name').notNull(),
		operation: text('operation').notNull(),
		status: text('status').notNull(),
		file_path: text('file_path'),
		file_size_bytes: integer('file_size_bytes'),
		message: text('message'),
		started_at: text('started_at').notNull(),
		finished_at: text('finished_at')
	},
	(table) => [
		index('idx_d1_backup_runs_branch_started').on(table.branch_id, table.started_at),
		index('idx_d1_backup_runs_db_started').on(table.database_name, table.started_at)
	]
);
