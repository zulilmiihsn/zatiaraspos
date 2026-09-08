import { and, asc, eq, gte, lte, gt, or, type SQL } from 'drizzle-orm';
import { bukuKas } from '$lib/database/schema';
import type { D1Database } from '@cloudflare/workers-types';
import { getDb, publish, auditDataChange } from '$lib/server/dataApiHelpers';
import { toCursorPage } from '$lib/server/dataPagination';
import { sanitizeUpdatePayload } from '$lib/server/resourceRouteHelpers';
import { containsPosLedger, POS_LEDGER_ROUTE_MESSAGE } from '$lib/server/ledgerPolicy';
import { error as kitError } from '@sveltejs/kit';

export type Database = ReturnType<typeof getDb>;
export type SessionUser = App.Locals['authSession'];

export interface BukuKasFilter {
	startTime?: string | null;
	endTime?: string | null;
	sumber?: string | null;
	tipe?: string | null;
	id?: string | null;
	transactionId?: string | null;
	idSesiToko?: string | null;
}

/**
 * Mengambil daftar data buku_kas dengan filter dan opsi cursor pagination.
 */
export async function getBukuKasList(
	db: Database,
	branch: string,
	filter: BukuKasFilter,
	limit: number,
	cursor: { sortValue: string; id: string } | null,
	cursorPagination: boolean
) {
	const filters: SQL[] = [eq(bukuKas.cabang_id, branch)];
	if (filter.startTime) filters.push(gte(bukuKas.waktu, filter.startTime));
	if (filter.endTime) filters.push(lte(bukuKas.waktu, filter.endTime));
	if (filter.sumber) filters.push(eq(bukuKas.sumber, filter.sumber));
	if (filter.tipe) filters.push(eq(bukuKas.tipe, filter.tipe));
	if (filter.id) filters.push(eq(bukuKas.id, filter.id));
	if (filter.transactionId) filters.push(eq(bukuKas.transaction_id, filter.transactionId));
	if (filter.idSesiToko) filters.push(eq(bukuKas.id_sesi_toko, filter.idSesiToko));
	if (cursor) {
		filters.push(
			or(
				gt(bukuKas.waktu, cursor.sortValue),
				and(eq(bukuKas.waktu, cursor.sortValue), gt(bukuKas.id, cursor.id))
			)!
		);
	}

	const rows = await db
		.select()
		.from(bukuKas)
		.where(and(...filters))
		.orderBy(asc(bukuKas.waktu), asc(bukuKas.id))
		.limit(cursorPagination ? limit + 1 : limit);

	if (!cursorPagination) return { rows, isPage: false as const };
	return {
		page: toCursorPage(rows, limit, (row) => ({ sortValue: row.waktu, id: String(row.id) })),
		isPage: true as const
	};
}

/**
 * Menyisipkan baris buku_kas dengan verifikasi ledger policy dan deduplikasi id.
 */
export async function insertBukuKasRows(
	db: Database,
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	rows: Array<Record<string, unknown>>
) {
	if (containsPosLedger(rows)) throw kitError(409, POS_LEDGER_ROUTE_MESSAGE);

	// Dedup by id
	const newRows: Array<Record<string, unknown>> = [];
	for (const row of rows) {
		const existing = await rawDb
			.prepare('SELECT id FROM buku_kas WHERE cabang_id = ? AND id = ? LIMIT 1')
			.bind(branch, String(row.id))
			.first();
		if (!existing) newRows.push(row);
	}
	if (newRows.length === 0) {
		return { ok: true, data: rows, duplicate: true };
	}

	await db.insert(bukuKas).values(newRows as (typeof bukuKas.$inferInsert)[]);
	await publish(platform, branch, 'buku_kas', 'insert', {
		id: newRows[0]?.id as string | undefined,
		transaction_id: newRows[0]?.transaction_id as string | undefined
	});
	await auditDataChange(
		rawDb,
		branch,
		session,
		'buku_kas',
		'insert',
		newRows[0]?.id as string | number | null | undefined,
		{
			count: newRows.length,
			transaction_id: newRows[0]?.transaction_id
		}
	);
	return { ok: true, data: rows };
}

/**
 * Memperbarui baris buku_kas secara atomik, termasuk penyesuaian ringkasan harian jika transaksi POS.
 */
export async function updateBukuKasRow(
	db: Database,
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	id: string,
	payload: Record<string, unknown>
) {
	const existing = (await rawDb
		.prepare(
			'SELECT id, sumber, transaction_id, nominal, waktu, metode_bayar FROM buku_kas WHERE cabang_id = ? AND id = ? LIMIT 1'
		)
		.bind(branch, String(id))
		.first()) as {
		id: string;
		sumber?: string;
		transaction_id?: string;
		nominal?: number;
		waktu?: string;
		metode_bayar?: string;
	} | null;
	if (!existing) throw kitError(404, 'Entri buku kas tidak ditemukan');

	const isPos = String(existing.sumber || '').toLowerCase() === 'pos';
	const payloadKeys = Object.keys(payload).filter((k) => k !== 'updated_at');
	const isOnlyUpdatingPaymentMethod = payloadKeys.length === 1 && payloadKeys[0] === 'metode_bayar';

	if (isPos && !isOnlyUpdatingPaymentMethod) {
		throw kitError(409, POS_LEDGER_ROUTE_MESSAGE);
	}
	if (containsPosLedger([payload])) {
		throw kitError(409, POS_LEDGER_ROUTE_MESSAGE);
	}

	if (isPos && isOnlyUpdatingPaymentMethod) {
		const oldMethod =
			String(existing.metode_bayar || '').toLowerCase() === 'tunai' ? 'tunai' : 'non-tunai';
		const newMethod =
			String(payload.metode_bayar || '').toLowerCase() === 'tunai' ? 'tunai' : 'non-tunai';

		if (oldMethod !== newMethod) {
			const now = new Date().toISOString();
			const statements = [];

			if (existing.transaction_id) {
				statements.push(
					rawDb
						.prepare(
							'UPDATE buku_kas SET metode_bayar = ?, updated_at = ? WHERE cabang_id = ? AND transaction_id = ?'
						)
						.bind(newMethod, now, branch, existing.transaction_id)
				);
			} else {
				statements.push(
					rawDb
						.prepare(
							'UPDATE buku_kas SET metode_bayar = ?, updated_at = ? WHERE cabang_id = ? AND id = ?'
						)
						.bind(newMethod, now, branch, String(id))
				);
			}

			const gross = Number(existing.nominal || 0);
			const salesDateRow = (await rawDb
				.prepare("SELECT date(datetime(?, '+8 hours')) AS tanggal_penjualan")
				.bind(existing.waktu || now)
				.first()) as { tanggal_penjualan?: string } | null;
			const salesDate = salesDateRow?.tanggal_penjualan;

			if (salesDate && gross > 0) {
				if (newMethod === 'non-tunai') {
					statements.push(
						rawDb
							.prepare(
								`UPDATE ringkasan_penjualan_harian SET
									penjualan_tunai = MAX(0, penjualan_tunai - ?),
									penjualan_nontunai = penjualan_nontunai + ?,
									updated_at = ?
								WHERE cabang_id = ? AND tanggal_penjualan = ?`
							)
							.bind(gross, gross, now, branch, salesDate)
					);
				} else {
					statements.push(
						rawDb
							.prepare(
								`UPDATE ringkasan_penjualan_harian SET
									penjualan_nontunai = MAX(0, penjualan_nontunai - ?),
									penjualan_tunai = penjualan_tunai + ?,
									updated_at = ?
								WHERE cabang_id = ? AND tanggal_penjualan = ?`
							)
							.bind(gross, gross, now, branch, salesDate)
					);
				}

				if (existing.transaction_id) {
					const products =
						(
							(await rawDb
								.prepare(
									`SELECT COALESCE(produk_id, 'custom:' || nama_produk) AS produk_id,
										COALESCE(SUM(nominal), 0) AS gross
								 FROM transaksi_kasir
								 WHERE cabang_id = ? AND transaction_id = ?
								 GROUP BY COALESCE(produk_id, 'custom:' || nama_produk)`
								)
								.bind(branch, existing.transaction_id)
								.all()) as { results?: Array<{ produk_id?: string; gross?: number }> }
						).results || [];

					for (const p of products) {
						if (!p.produk_id) continue;
						const itemGross = Number(p.gross || 0);
						if (newMethod === 'non-tunai') {
							statements.push(
								rawDb
									.prepare(
										`UPDATE penjualan_produk_harian SET
											penjualan_tunai = MAX(0, penjualan_tunai - ?),
											penjualan_nontunai = penjualan_nontunai + ?,
											updated_at = ?
										WHERE cabang_id = ? AND tanggal_penjualan = ? AND produk_id = ?`
									)
									.bind(itemGross, itemGross, now, branch, salesDate, p.produk_id)
							);
						} else {
							statements.push(
								rawDb
									.prepare(
										`UPDATE penjualan_produk_harian SET
											penjualan_nontunai = MAX(0, penjualan_nontunai - ?),
											penjualan_tunai = penjualan_tunai + ?,
											updated_at = ?
										WHERE cabang_id = ? AND tanggal_penjualan = ? AND produk_id = ?`
									)
									.bind(itemGross, itemGross, now, branch, salesDate, p.produk_id)
							);
						}
					}
				}
			}

			if (statements.length > 0) {
				await rawDb.batch(statements);
			}

			await publish(platform, branch, 'buku_kas', 'update', {
				id,
				transaction_id: existing.transaction_id
			});
			if (existing.transaction_id) {
				await publish(platform, branch, 'transaksi_kasir', 'update', {
					transaction_id: existing.transaction_id
				});
			}
			await auditDataChange(rawDb, branch, session, 'buku_kas', 'update_metode_bayar', id, {
				transaction_id: existing.transaction_id,
				from: oldMethod,
				to: newMethod
			});
			return { ok: true };
		}
		return { ok: true };
	}

	await db
		.update(bukuKas)
		.set(sanitizeUpdatePayload(payload as Partial<typeof bukuKas.$inferInsert>))
		.where(and(eq(bukuKas.cabang_id, branch), eq(bukuKas.id, String(id))));
	await publish(platform, branch, 'buku_kas', 'update', { id });
	await auditDataChange(rawDb, branch, session, 'buku_kas', 'update', id, {
		fields: Object.keys(payload)
	});
	return { ok: true };
}

/**
 * Menghapus satu baris buku_kas berdasarkan id.
 */
export async function deleteBukuKasRow(
	db: Database,
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	id: string
) {
	const existing = (await rawDb
		.prepare('SELECT id, sumber FROM buku_kas WHERE cabang_id = ? AND id = ? LIMIT 1')
		.bind(branch, String(id))
		.first()) as { id: string; sumber?: string } | null;
	if (!existing) throw kitError(404, 'Entri buku kas tidak ditemukan');
	if (containsPosLedger([existing])) throw kitError(409, POS_LEDGER_ROUTE_MESSAGE);

	await db.delete(bukuKas).where(and(eq(bukuKas.cabang_id, branch), eq(bukuKas.id, String(id))));
	await publish(platform, branch, 'buku_kas', 'delete', { id });
	await auditDataChange(rawDb, branch, session, 'buku_kas', 'delete', id);
	return { ok: true };
}

/**
 * Menghapus semua baris buku_kas berdasarkan transaction_id.
 */
export async function deleteBukuKasByTransaction(
	db: Database,
	rawDb: D1Database,
	branch: string,
	session: SessionUser,
	platform: App.Platform | undefined,
	transactionId: string
) {
	const existing = ((
		await rawDb
			.prepare('SELECT id, sumber FROM buku_kas WHERE cabang_id = ? AND transaction_id = ?')
			.bind(branch, transactionId)
			.all()
	).results || []) as Array<{ id: string; sumber?: string }>;
	if (existing.length === 0) throw kitError(404, 'Entri buku kas tidak ditemukan');
	if (containsPosLedger(existing)) throw kitError(409, POS_LEDGER_ROUTE_MESSAGE);

	await db
		.delete(bukuKas)
		.where(and(eq(bukuKas.cabang_id, branch), eq(bukuKas.transaction_id, transactionId)));
	await publish(platform, branch, 'buku_kas', 'delete', { transaction_id: transactionId });
	await auditDataChange(rawDb, branch, session, 'buku_kas', 'delete_by_transaction', null, {
		transaction_id: transactionId
	});
	return { ok: true };
}
