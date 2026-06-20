import { json, error as kitError } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import {
	produk,
	kategori,
	tambahan,
	bahan,
	resepProduk,
	bukuKas,
	transaksiKasir,
	profil,
	pengaturan,
	sesiToko
} from '$lib/database/schema';
import { payloadRows, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { reverseDailySummaryForTransaction } from '$lib/server/dailySummary';
import type { BranchId, DrizzleDb } from '$lib/server/branchResolver';
import type { D1Database } from '@cloudflare/workers-types';

export type DataWriteContext = {
	db: DrizzleDb;
	rawDb: D1Database;
	branch: BranchId;
	table: string;
	action: 'insert' | 'update' | 'delete';
	payload: Record<string, unknown> | Record<string, unknown>[];
	whereClause?: {
		id?: string;
		transaction_id?: string;
		kategori_id?: string | number;
		product_id?: string | number;
		bahan_id?: string | number;
	};
	session: App.Locals['authSession'];
	platform: App.Platform | undefined;
};

/** Menangani semua operasi tulis POST /api/data (insert/update/delete per tabel). */
export async function handleDataWrite(ctx: DataWriteContext): Promise<Response> {
	const { db, rawDb, branch, table, action, payload, whereClause, session, platform } = ctx;
	switch (table) {
		// ---- produk ----
		case 'produk': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(produk).values(rows as any);
				await publish(platform, branch, 'produk', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'produk', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(produk)
					.set({ ...(payload as any) })
					.where(and(eq(produk.branch_id, branch), eq(produk.id, String(whereClause.id))));
				await publish(platform, branch, 'produk', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'produk', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'update' && whereClause?.kategori_id !== undefined) {
				await db
					.update(produk)
					.set({ ...(payload as any) })
					.where(
						and(
							eq(produk.branch_id, branch),
							eq(produk.kategori_id, String(whereClause.kategori_id))
						)
					);
				await publish(platform, branch, 'produk', 'update');
				await auditDataChange(rawDb, branch, session, 'produk', 'bulk_update', null, {
					kategori_id: whereClause.kategori_id,
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(produk)
					.where(and(eq(produk.branch_id, branch), eq(produk.id, String(whereClause.id))));
				await publish(platform, branch, 'produk', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'produk', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- kategori ----
		case 'kategori': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(kategori).values(rows as any);
				await publish(platform, branch, 'kategori', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'kategori', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(kategori)
					.set({ ...(payload as any) })
					.where(and(eq(kategori.branch_id, branch), eq(kategori.id, String(whereClause.id))));
				await publish(platform, branch, 'kategori', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'kategori', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(kategori)
					.where(and(eq(kategori.branch_id, branch), eq(kategori.id, String(whereClause.id))));
				await publish(platform, branch, 'kategori', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'kategori', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- tambahan ----
		case 'tambahan': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(tambahan).values(rows as any);
				await publish(platform, branch, 'tambahan', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'tambahan', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(tambahan)
					.set({ ...(payload as any) })
					.where(and(eq(tambahan.branch_id, branch), eq(tambahan.id, String(whereClause.id))));
				await publish(platform, branch, 'tambahan', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'tambahan', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(tambahan)
					.where(and(eq(tambahan.branch_id, branch), eq(tambahan.id, String(whereClause.id))));
				await publish(platform, branch, 'tambahan', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'tambahan', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- bahan ----
		case 'bahan': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch).map((row) => ({
					...row,
					unit: row.unit || 'gram',
					current_stock: Number(row.current_stock || 0),
					low_stock_threshold: Number(row.low_stock_threshold || 0),
					cost_per_unit: Number(row.cost_per_unit || 0),
					last_purchase_qty: Number(row.last_purchase_qty || 0),
					last_purchase_cost: Number(row.last_purchase_cost || 0)
				})) as Array<Record<string, any>>;
				await db.insert(bahan).values(rows as any);
				await publish(platform, branch, 'bahan', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'bahan', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				const safePayload = { ...(payload as any) };
				if ('current_stock' in safePayload)
					safePayload.current_stock = Number(safePayload.current_stock || 0);
				if ('low_stock_threshold' in safePayload) {
					safePayload.low_stock_threshold = Number(safePayload.low_stock_threshold || 0);
				}
				if ('cost_per_unit' in safePayload) {
					safePayload.cost_per_unit = Number(safePayload.cost_per_unit || 0);
				}
				if ('last_purchase_qty' in safePayload) {
					safePayload.last_purchase_qty = Number(safePayload.last_purchase_qty || 0);
				}
				if ('last_purchase_cost' in safePayload) {
					safePayload.last_purchase_cost = Number(safePayload.last_purchase_cost || 0);
				}
				await db
					.update(bahan)
					.set(safePayload)
					.where(and(eq(bahan.branch_id, branch), eq(bahan.id, String(whereClause.id))));
				await publish(platform, branch, 'bahan', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'bahan', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				const used = await rawDb
					.prepare(`SELECT id FROM resep_produk WHERE branch_id = ? AND bahan_id = ? LIMIT 1`)
					.bind(branch, String(whereClause.id))
					.first();
				if (used) throw kitError(409, 'Bahan masih dipakai di resep menu');

				await db
					.delete(bahan)
					.where(and(eq(bahan.branch_id, branch), eq(bahan.id, String(whereClause.id))));
				await publish(platform, branch, 'bahan', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'bahan', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- resep produk ----
		case 'resep_produk': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch).map((row) => ({
					...row,
					product_id: String(row.product_id || ''),
					bahan_id: String(row.bahan_id || ''),
					qty_per_item: Number(row.qty_per_item || 0)
				})) as Array<Record<string, any>>;
				if (rows.some((row) => !row.product_id || !row.bahan_id || row.qty_per_item <= 0)) {
					throw kitError(400, 'Resep bahan tidak valid');
				}
				await db.insert(resepProduk).values(rows as any);
				await publish(platform, branch, 'resep_produk', 'insert', {
					id: rows[0]?.id,
					transaction_id: rows[0]?.product_id as string | undefined
				});
				await auditDataChange(rawDb, branch, session, 'resep_produk', 'insert', rows[0]?.id, {
					count: rows.length,
					product_id: rows[0]?.product_id
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'delete' && whereClause?.product_id) {
				await db
					.delete(resepProduk)
					.where(
						and(
							eq(resepProduk.branch_id, branch),
							eq(resepProduk.product_id, String(whereClause.product_id))
						)
					);
				await publish(platform, branch, 'resep_produk', 'delete', {
					transaction_id: String(whereClause.product_id)
				});
				await auditDataChange(rawDb, branch, session, 'resep_produk', 'delete_by_product', null, {
					product_id: whereClause.product_id
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(resepProduk)
					.where(
						and(eq(resepProduk.branch_id, branch), eq(resepProduk.id, String(whereClause.id)))
					);
				await publish(platform, branch, 'resep_produk', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'resep_produk', 'delete', whereClause.id);
				return json({ ok: true });
			}
			break;
		}

		// ---- mutasi bahan ----
		case 'bahan_mutasi': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				if (rows.length !== 1) throw kitError(400, 'Mutasi bahan harus satu per request');
				const row = rows[0];
				const bahanId = String(row.bahan_id || '');
				const quantityDelta = Number(row.quantity_delta || 0);
				if (!bahanId || !Number.isFinite(quantityDelta) || quantityDelta === 0) {
					throw kitError(400, 'Mutasi bahan tidak valid');
				}

				const item = (await rawDb
					.prepare(`SELECT id FROM bahan WHERE branch_id = ? AND id = ? LIMIT 1`)
					.bind(branch, bahanId)
					.first()) as { id: string } | null;
				if (!item) throw kitError(404, 'Bahan tidak ditemukan');

				const now = new Date().toISOString();
				try {
					await rawDb.batch([
						rawDb
							.prepare(
								`UPDATE bahan
								 SET current_stock = COALESCE(current_stock, 0) + ?, updated_at = ?
								 WHERE branch_id = ? AND id = ?`
							)
							.bind(quantityDelta, now, branch, bahanId),
						rawDb
							.prepare(
								`INSERT INTO bahan_mutasi (
									id, branch_id, bahan_id, quantity_delta, stock_after, source,
									reference_id, note, created_by, created_at
								)
								VALUES (
									?, ?, ?, ?,
									(SELECT current_stock FROM bahan WHERE branch_id = ? AND id = ?),
									?, ?, ?, ?, ?
								)`
							)
							.bind(
								row.id,
								branch,
								bahanId,
								quantityDelta,
								branch,
								bahanId,
								String(row.source || 'manual'),
								row.reference_id == null ? null : String(row.reference_id),
								row.note == null ? null : String(row.note).slice(0, 160),
								session?.username || session?.userId || null,
								now
							)
					]);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					if (message.includes('INSUFFICIENT_INGREDIENT')) {
						throw kitError(409, 'Stok bahan tidak boleh minus');
					}
					throw error;
				}

				await publish(platform, branch, 'bahan', 'update', { id: bahanId });
				await publish(platform, branch, 'bahan_mutasi', 'insert', { id: row.id });
				await auditDataChange(rawDb, branch, session, 'bahan_mutasi', 'insert', row.id, {
					bahan_id: bahanId,
					quantity_delta: quantityDelta
				});
				return json({ ok: true, data: [row] });
			}
			break;
		}

		// ---- HPP settings ----
		case 'hpp_settings': {
			if (action === 'insert' || action === 'update') {
				const input = Array.isArray(payload) ? payload[0] || {} : payload;
				const id = `${branch}:default`;
				const now = new Date().toISOString();
				const row = {
					id,
					branch_id: branch,
					rent_monthly: Number((input as any).rent_monthly || 0),
					electricity_monthly: Number((input as any).electricity_monthly || 0),
					water_monthly: Number((input as any).water_monthly || 0),
					salary_monthly: Number((input as any).salary_monthly || 0),
					other_monthly: Number((input as any).other_monthly || 0),
					target_items_monthly: Math.max(1, Number((input as any).target_items_monthly || 1000))
				};

				await rawDb
					.prepare(
						`INSERT INTO hpp_settings (
							id, branch_id, rent_monthly, electricity_monthly, water_monthly,
							salary_monthly, other_monthly, target_items_monthly, created_at, updated_at
						)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
						ON CONFLICT(id) DO UPDATE SET
							rent_monthly = excluded.rent_monthly,
							electricity_monthly = excluded.electricity_monthly,
							water_monthly = excluded.water_monthly,
							salary_monthly = excluded.salary_monthly,
							other_monthly = excluded.other_monthly,
							target_items_monthly = excluded.target_items_monthly,
							updated_at = excluded.updated_at`
					)
					.bind(
						row.id,
						row.branch_id,
						row.rent_monthly,
						row.electricity_monthly,
						row.water_monthly,
						row.salary_monthly,
						row.other_monthly,
						row.target_items_monthly,
						now,
						now
					)
					.run();

				await publish(platform, branch, 'hpp_settings', 'upsert', { id });
				await auditDataChange(rawDb, branch, session, 'hpp_settings', 'upsert', id, row);
				return json({ ok: true, data: [row] });
			}
			break;
		}

		// ---- buku_kas ----
		case 'buku_kas': {
			if (action === 'insert') {
				const rows: Array<Record<string, any>> = payloadRows(payload, branch).map((row) => ({
					...row,
					amount: row.amount ?? row.nominal ?? 0,
					nominal: row.nominal ?? row.amount ?? 0
				}));
				const newRows: Array<Record<string, any>> = [];
				for (const row of rows) {
					const existing = await rawDb
						.prepare('SELECT id FROM buku_kas WHERE branch_id = ? AND id = ? LIMIT 1')
						.bind(branch, String(row.id))
						.first();
					if (!existing) newRows.push(row);
				}

				if (newRows.length === 0) {
					return json({ ok: true, data: rows, duplicate: true });
				}

				await db.insert(bukuKas).values(newRows as any);
				await publish(platform, branch, 'buku_kas', 'insert', {
					id: newRows[0]?.id,
					transaction_id: newRows[0]?.transaction_id as string | undefined
				});
				await auditDataChange(rawDb, branch, session, 'buku_kas', 'insert', newRows[0]?.id, {
					count: newRows.length,
					transaction_id: newRows[0]?.transaction_id
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(bukuKas)
					.set({ ...(payload as any) })
					.where(and(eq(bukuKas.branch_id, branch), eq(bukuKas.id, String(whereClause.id))));
				await publish(platform, branch, 'buku_kas', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'buku_kas', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.id) {
				await db
					.delete(bukuKas)
					.where(and(eq(bukuKas.branch_id, branch), eq(bukuKas.id, String(whereClause.id))));
				await publish(platform, branch, 'buku_kas', 'delete', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'buku_kas', 'delete', whereClause.id);
				return json({ ok: true });
			}
			if (action === 'delete' && whereClause?.transaction_id) {
				await db
					.delete(bukuKas)
					.where(
						and(
							eq(bukuKas.branch_id, branch),
							eq(bukuKas.transaction_id, whereClause.transaction_id)
						)
					);
				await publish(platform, branch, 'buku_kas', 'delete', {
					transaction_id: whereClause.transaction_id
				});
				await auditDataChange(rawDb, branch, session, 'buku_kas', 'delete_by_transaction', null, {
					transaction_id: whereClause.transaction_id
				});
				return json({ ok: true });
			}
			break;
		}

		// ---- transaksi_kasir ----
		case 'transaksi_kasir': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(transaksiKasir).values(rows as any);
				await publish(platform, branch, 'transaksi_kasir', 'insert', {
					transaction_id: rows[0]?.transaction_id as string | undefined
				});
				await auditDataChange(rawDb, branch, session, 'transaksi_kasir', 'insert', rows[0]?.id, {
					count: rows.length,
					transaction_id: rows[0]?.transaction_id
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'delete' && whereClause?.transaction_id) {
				// Balikkan kontribusi transaksi ke ringkasan harian SEBELUM item dihapus
				// (item + buku_kas masih ada di sini). Jangan blok penghapusan bila gagal.
				try {
					await reverseDailySummaryForTransaction(
						rawDb,
						branch,
						String(whereClause.transaction_id)
					);
				} catch {
					// Tabel ringkasan mungkin belum ada / gagal sebagian — abaikan.
				}
				await db
					.delete(transaksiKasir)
					.where(
						and(
							eq(transaksiKasir.branch_id, branch),
							eq(transaksiKasir.transaction_id, whereClause.transaction_id)
						)
					);
				await publish(platform, branch, 'transaksi_kasir', 'delete', {
					transaction_id: whereClause.transaction_id
				});
				await auditDataChange(
					rawDb,
					branch,
					session,
					'transaksi_kasir',
					'delete_by_transaction',
					null,
					{ transaction_id: whereClause.transaction_id }
				);
				return json({ ok: true });
			}
			break;
		}

		// ---- profil ----
		case 'profil': {
			if (action === 'update' && whereClause?.id) {
				await db
					.update(profil)
					.set({ ...(payload as any) })
					.where(and(eq(profil.branch_id, branch), eq(profil.id, String(whereClause.id))));
				await publish(platform, branch, 'profil', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'profil', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			break;
		}

		// ---- sesi_toko ----
		case 'sesi_toko': {
			if (action === 'insert') {
				const rows = payloadRows(payload, branch);
				await db.insert(sesiToko).values(rows as any);
				await publish(platform, branch, 'sesi_toko', 'insert', { id: rows[0]?.id });
				await auditDataChange(rawDb, branch, session, 'sesi_toko', 'insert', rows[0]?.id, {
					count: rows.length
				});
				return json({ ok: true, data: rows });
			}
			if (action === 'update' && whereClause?.id) {
				await db
					.update(sesiToko)
					.set({ ...(payload as any) })
					.where(and(eq(sesiToko.branch_id, branch), eq(sesiToko.id, String(whereClause.id))));
				await publish(platform, branch, 'sesi_toko', 'update', { id: whereClause.id });
				await auditDataChange(rawDb, branch, session, 'sesi_toko', 'update', whereClause.id, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			break;
		}

		// ---- pengaturan ----
		case 'pengaturan': {
			if (action === 'insert') {
				const row = Array.isArray(payload) ? payload : [payload];
				await db.insert(pengaturan).values(row.map((r) => ({ ...r, branch_id: branch }) as any));
				await publish(platform, branch, 'pengaturan', 'insert', { id: (row[0] as any)?.id });
				await auditDataChange(rawDb, branch, session, 'pengaturan', 'insert', (row[0] as any)?.id);
				return json({ ok: true, data: row });
			}
			if (action === 'update' && whereClause?.id) {
				const idNum = Number(whereClause.id);
				await db
					.update(pengaturan)
					.set({ ...(payload as any) })
					.where(and(eq(pengaturan.branch_id, branch), eq(pengaturan.id, idNum)));
				await publish(platform, branch, 'pengaturan', 'update', { id: idNum });
				await auditDataChange(rawDb, branch, session, 'pengaturan', 'update', idNum, {
					fields: Object.keys(payload as any)
				});
				return json({ ok: true });
			}
			break;
		}

		default:
			throw kitError(400, `Unknown table: ${table}`);
	}

	throw kitError(400, `Invalid action '${action}' for table '${table}'`);
}
