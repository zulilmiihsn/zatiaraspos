import { json, error as kitError } from '@sveltejs/kit';
import { requireSessionBranch, requireAnyRole } from '$lib/server/apiAuth';
import { getRawDb } from '$lib/server/dataApiHelpers';
import type { RequestHandler } from './$types';

/**
 * Arsip transaksi lama (sebelum tahun tertentu) milik cabang aktif.
 *
 * Alur AMAN untuk data uang:
 *   1. Ambil buku_kas + transaksi_kasir sebelum cutoff.
 *   2. Simpan sebagai JSON ke R2 LEBIH DULU (kalau gagal → batal, tidak hapus).
 *   3. Baru hapus dari DB (melegakan storage).
 *   4. Kembalikan isi JSON agar browser bisa mengunduh salinan.
 *
 * Tabel ringkasan (daily_sales_summary / daily_product_sales) SENGAJA tidak
 * disentuh — kecil & dipakai untuk laporan agregat historis.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const branch = requireSessionBranch(locals);
	const session = locals.authSession!;
	requireAnyRole(session.role, ['pemilik']);

	const body = (await request.json().catch(() => null)) as { before_year?: number } | null;
	const year = Number(body?.before_year);
	if (!Number.isInteger(year) || year < 2020 || year > 2100) {
		throw kitError(400, 'Tahun tidak valid');
	}
	const cutoff = `${year}-01-01T00:00:00.000Z`;

	const rawDb = getRawDb(platform, branch);
	const bucket = platform?.env?.STORAGE;
	if (!bucket) throw kitError(503, 'Storage tidak tersedia');

	const [bukuKasResult, transaksiKasirResult] = await Promise.all([
		rawDb
			.prepare('SELECT * FROM buku_kas WHERE cabang_id = ? AND waktu < ?')
			.bind(branch, cutoff)
			.all(),
		rawDb
			.prepare(
				`SELECT tk.* FROM transaksi_kasir tk
				 INNER JOIN buku_kas bk
					ON bk.cabang_id = tk.cabang_id AND bk.id = tk.buku_kas_id
				 WHERE tk.cabang_id = ? AND bk.waktu < ?`
			)
			.bind(branch, cutoff)
			.all()
	]);
	const bukuKas = (bukuKasResult.results || []) as unknown[];
	const transaksiKasir = (transaksiKasirResult.results || []) as unknown[];

	const total = bukuKas.length + transaksiKasir.length;
	if (total === 0) {
		return json({
			ok: true,
			count: 0,
			message: `Tidak ada transaksi sebelum ${year} untuk diarsipkan.`
		});
	}

	const archive = {
		meta: {
			branch,
			before_year: year,
			exported_at: new Date().toISOString(),
			counts: { buku_kas: bukuKas.length, transaksi_kasir: transaksiKasir.length }
		},
		buku_kas: bukuKas,
		transaksi_kasir: transaksiKasir
	};
	const content = JSON.stringify(archive);
	const filename = `arsip-${branch}-sebelum-${year}.json`;
	const key = `arsip/${branch}/${filename.replace('.json', '')}-${new Date().toISOString().slice(0, 10)}.json`;

	// Simpan ke R2 DULU — kalau gagal, lempar error & JANGAN hapus apa pun.
	await bucket.put(key, content, { httpMetadata: { contentType: 'application/json' } });

	// Baru hapus dari DB.
	await rawDb.batch([
		rawDb
			.prepare(
				`DELETE FROM transaksi_kasir
				 WHERE cabang_id = ?
					AND buku_kas_id IN (
						SELECT id FROM buku_kas WHERE cabang_id = ? AND waktu < ?
					)`
			)
			.bind(branch, branch, cutoff),
		rawDb.prepare('DELETE FROM buku_kas WHERE cabang_id = ? AND waktu < ?').bind(branch, cutoff)
	]);

	return json({ ok: true, count: total, key, filename, content });
};
