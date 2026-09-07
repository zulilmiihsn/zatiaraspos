import type { D1Database } from '@cloudflare/workers-types';
import { buildDailySummaryReversalStatements } from '$lib/server/dailySummary';
import { requireBranch } from '$lib/server/branchResolver';
import { toCursorPage } from '$lib/server/dataPagination';
import { publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { error as kitError } from '@sveltejs/kit';

export type SessionUser = App.Locals['authSession'];

export interface TransaksiKasirFilter {
	startTime?: string | null;
	endTime?: string | null;
	id?: string | null;
	transactionId?: string | null;
	bukuKasIds?: string[] | null;
}

/**
 * Mengambil daftar baris transaksi_kasir (item POS).
 */
export async function getTransaksiKasirList(
	rawDb: D1Database,
	branch: string,
	filter: TransaksiKasirFilter,
	limit: number,
	cursor: { sortValue: string; id: string } | null,
	cursorPagination: boolean
) {
	const filters = ['cabang_id = ?'];
	const values: unknown[] = [branch];
	if (filter.startTime) {
		filters.push('created_at >= ?');
		values.push(filter.startTime);
	}
	if (filter.endTime) {
		filters.push('created_at <= ?');
		values.push(filter.endTime);
	}
	if (filter.id) {
		filters.push('id = ?');
		values.push(filter.id);
	}
	if (filter.transactionId) {
		filters.push('transaction_id = ?');
		values.push(filter.transactionId);
	}
	if (cursor) {
		filters.push('(created_at > ? OR (created_at = ? AND id > ?))');
		values.push(cursor.sortValue, cursor.sortValue, cursor.id);
	}
	if (filter.bukuKasIds && filter.bukuKasIds.length) {
		filters.push(`buku_kas_id IN (${filter.bukuKasIds.map(() => '?').join(',')})`);
		values.push(...filter.bukuKasIds);
	}

	const snapshotSelect = `nama_produk, harga_dasar, total_tambahan, snapshot_tambahan, gula, es, catatan, snapshot_hpp, nominal_hpp`;
	const rows = await rawDb
		.prepare(
			`SELECT
				id, cabang_id, buku_kas_id, produk_id, nama_kustom, jumlah, nominal, harga,
				${snapshotSelect},
				transaction_id, created_at, updated_at
			 FROM transaksi_kasir
			 WHERE ${filters.join(' AND ')}
				 ORDER BY created_at ASC, id ASC
				 LIMIT ?`
		)
		.bind(...values, cursorPagination ? limit + 1 : limit)
		.all();
	const data = (rows.results || []) as Array<{ id: string; created_at: string }>;

	if (!cursorPagination) return { rows: data, isPage: false as const };
	return {
		page: toCursorPage(data, limit, (row) => ({ sortValue: row.created_at, id: String(row.id) })),
		isPage: true as const
	};
}

/**
 * Membatalkan/void transaksi POS:
 * 1. Menghitung pembalikan ringkasan harian
 * 2. Memulihkan stok produk (lacak_stok)
 * 3. Memulihkan stok bahan mutasi
 * 4. Menghapus transaksi_kasir & buku_kas dalam 1 batch atomik
 */
export async function voidTransaksiKasir(
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	transactionId: string
) {
	const itemRows = ((
		await rawDb
			.prepare(
				`SELECT produk_id, jumlah FROM transaksi_kasir WHERE cabang_id = ? AND transaction_id = ?`
			)
			.bind(branch, transactionId)
			.all()
	).results || []) as Array<{ produk_id: string | null; jumlah: number }>;
	if (itemRows.length === 0) throw kitError(404, 'Transaksi POS tidak ditemukan');

	const branchId = requireBranch(branch);
	const summaryReversal = await buildDailySummaryReversalStatements(rawDb, branchId, transactionId);
	if (!summaryReversal.found) {
		throw kitError(409, 'Transaksi POS tidak konsisten dengan buku kas');
	}

	const mutasiRows = ((
		await rawDb
			.prepare(
				`SELECT bahan_id, delta_jumlah FROM bahan_mutasi
				 WHERE cabang_id = ? AND referensi_id = ? AND sumber IN ('pos', 'pos_transaction')`
			)
			.bind(branch, transactionId)
			.all()
	).results || []) as Array<{ bahan_id: string; delta_jumlah: number }>;

	const now = new Date().toISOString();
	const actor = session?.username || session?.userId || 'system';
	const statements = [...summaryReversal.statements];

	for (const it of itemRows) {
		if (!it.produk_id) continue;
		statements.push(
			rawDb
				.prepare(
					`UPDATE produk SET stok = COALESCE(stok, 0) + ?, updated_at = ?
					 WHERE cabang_id = ? AND id = ? AND lacak_stok = 1`
				)
				.bind(it.jumlah, now, branch, it.produk_id)
		);
	}

	for (const m of mutasiRows) {
		const restore = -m.delta_jumlah;
		statements.push(
			rawDb
				.prepare(
					`UPDATE bahan SET stok_saat_ini = COALESCE(stok_saat_ini, 0) + ?, updated_at = ?
					 WHERE cabang_id = ? AND id = ?`
				)
				.bind(restore, now, branch, m.bahan_id)
		);
		statements.push(
			rawDb
				.prepare(
					`INSERT INTO bahan_mutasi (
						id, cabang_id, bahan_id, delta_jumlah, stok_setelah, sumber,
						referensi_id, catatan, dibuat_oleh, created_at
					)
					VALUES (?, ?, ?, ?,
						(SELECT stok_saat_ini FROM bahan WHERE cabang_id = ? AND id = ?),
						'void', ?, ?, ?, ?)`
				)
				.bind(
					crypto.randomUUID(),
					branch,
					m.bahan_id,
					restore,
					branch,
					m.bahan_id,
					transactionId,
					`Void transaksi ${transactionId}`.slice(0, 160),
					actor,
					now
				)
		);
	}

	statements.push(
		rawDb
			.prepare(`DELETE FROM transaksi_kasir WHERE cabang_id = ? AND transaction_id = ?`)
			.bind(branch, transactionId)
	);
	statements.push(
		rawDb
			.prepare(`DELETE FROM buku_kas WHERE cabang_id = ? AND transaction_id = ?`)
			.bind(branch, transactionId)
	);

	await rawDb.batch(statements);

	await publish(platform, branch, 'transaksi_kasir', 'delete', { transaction_id: transactionId });
	await publish(platform, branch, 'buku_kas', 'delete', { transaction_id: transactionId });
	await auditDataChange(rawDb, branch, session, 'transaksi_kasir', 'void', null, {
		transaction_id: transactionId,
		restored_products: itemRows.length,
		restored_bahan: mutasiRows.length
	});

	return { ok: true };
}
